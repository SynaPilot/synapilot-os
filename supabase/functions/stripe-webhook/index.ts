import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

// ---------------------------------------------------------------------------
// Stripe webhook handler
//
// Security model:
//   - No JWT auth: Stripe calls this directly, not from the browser.
//   - Signature verification (HMAC-SHA256) is the sole auth mechanism.
//   - All DB writes use service_role key (bypasses RLS).
//   - Idempotency: billing_events.stripe_event_id has a UNIQUE constraint;
//     duplicate events are detected with a SELECT before INSERT and skipped.
//
// Handled events:
//   checkout.session.completed      → activate subscription + set seats
//   customer.subscription.updated   → sync status / period / seats
//   customer.subscription.deleted   → mark canceled
//   invoice.payment_failed          → mark past_due
//   invoice.payment_succeeded       → mark active + update period end
// ---------------------------------------------------------------------------

// CORS headers — Stripe does not send preflight, but kept for consistency.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

/** Convert a Stripe unix timestamp to an ISO string safe for Postgres timestamptz. */
function toIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Map Stripe subscription status to our DB enum.
 * Unmapped statuses (e.g. 'unpaid', 'paused') are treated as 'past_due'
 * so the org can still read their data but is blocked from writes.
 */
function mapSubStatus(
  stripeStatus: Stripe.Subscription.Status,
): "trialing" | "active" | "past_due" | "canceled" | "incomplete" {
  const map: Record<
    Stripe.Subscription.Status,
    "trialing" | "active" | "past_due" | "canceled" | "incomplete"
  > = {
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    unpaid: "past_due",
    paused: "past_due",
  };
  return map[stripeStatus] ?? "past_due";
}

// ---------------------------------------------------------------------------
// Core business logic — one function per event type
// ---------------------------------------------------------------------------

type SupabaseAdmin = ReturnType<typeof createClient>;

/**
 * Resolve organization_id from:
 *   1. session/subscription metadata.organization_id  (preferred)
 *   2. client_reference_id on checkout sessions        (fallback)
 *   3. stripe_customer_id lookup in subscriptions      (last resort)
 */
async function resolveOrgId(
  admin: SupabaseAdmin,
  opts: {
    metadataOrgId?: string | null;
    clientReferenceId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
): Promise<string | null> {
  if (opts.metadataOrgId) return opts.metadataOrgId;
  if (opts.clientReferenceId) return opts.clientReferenceId;

  if (opts.stripeSubscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("organization_id")
      .eq("stripe_subscription_id", opts.stripeSubscriptionId)
      .maybeSingle();
    if (data?.organization_id) return data.organization_id;
  }

  if (opts.stripeCustomerId) {
    const { data } = await admin
      .from("subscriptions")
      .select("organization_id")
      .eq("stripe_customer_id", opts.stripeCustomerId)
      .maybeSingle();
    if (data?.organization_id) return data.organization_id;
  }

  return null;
}

/**
 * Log the event to billing_events.
 * Returns false and logs a warning if the event was already processed
 * (idempotency guard via the UNIQUE constraint on stripe_event_id).
 */
async function logBillingEvent(
  admin: SupabaseAdmin,
  event: Stripe.Event,
  organizationId: string,
): Promise<boolean> {
  // Check idempotency before INSERT to avoid relying on error codes.
  const { data: existing } = await admin
    .from("billing_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    console.log(`[stripe-webhook] Event ${event.id} already processed — skipping`);
    return false;
  }

  const { error } = await admin.from("billing_events").insert({
    organization_id: organizationId,
    stripe_event_id: event.id,
    event_type: event.type,
    data: event.data.object as Record<string, unknown>,
  });

  if (error) {
    // Unique constraint violation means concurrent duplicate — safe to ignore.
    if (error.code === "23505") {
      console.log(`[stripe-webhook] Concurrent duplicate for ${event.id} — skipping`);
      return false;
    }
    console.error("[stripe-webhook] Failed to log billing event:", error);
  }

  return true;
}

// ── checkout.session.completed ─────────────────────────────────────────────

async function handleCheckoutCompleted(
  admin: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  const organizationId = await resolveOrgId(admin, {
    metadataOrgId: session.metadata?.organization_id,
    clientReferenceId: session.client_reference_id,
    stripeCustomerId: session.customer as string | null,
  });

  if (!organizationId) {
    console.error("[checkout.session.completed] Cannot resolve organization_id");
    return;
  }

  // Expand line_items to get the purchased seat quantity.
  // Line items are not included in the base session object.
  const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items"],
  });
  const seats = expandedSession.line_items?.data[0]?.quantity ?? 1;

  const { error } = await admin
    .from("subscriptions")
    .update({
      plan: "standard",
      status: "active",
      stripe_subscription_id: session.subscription as string,
      stripe_customer_id: session.customer as string,
      seats,
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[checkout.session.completed] DB update failed:", error);
  }

  await logBillingEvent(admin, event, organizationId);
  console.log(`[checkout.session.completed] org=${organizationId} seats=${seats}`);
}

// ── customer.subscription.updated ─────────────────────────────────────────

async function handleSubscriptionUpdated(
  admin: SupabaseAdmin,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;

  const organizationId = await resolveOrgId(admin, {
    metadataOrgId: sub.metadata?.organization_id,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: sub.customer as string,
  });

  if (!organizationId) {
    console.error("[subscription.updated] Cannot resolve organization_id for sub:", sub.id);
    return;
  }

  const seats = sub.items.data[0]?.quantity ?? 1;
  const status = mapSubStatus(sub.status);

  const { error } = await admin
    .from("subscriptions")
    .update({
      status,
      current_period_end: toIso(sub.current_period_end),
      seats,
    })
    .eq("stripe_subscription_id", sub.id);

  if (error) {
    console.error("[subscription.updated] DB update failed:", error);
  }

  await logBillingEvent(admin, event, organizationId);
  console.log(`[subscription.updated] org=${organizationId} status=${status} seats=${seats}`);
}

// ── customer.subscription.deleted ─────────────────────────────────────────

async function handleSubscriptionDeleted(
  admin: SupabaseAdmin,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;

  const organizationId = await resolveOrgId(admin, {
    metadataOrgId: sub.metadata?.organization_id,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: sub.customer as string,
  });

  if (!organizationId) {
    console.error("[subscription.deleted] Cannot resolve organization_id for sub:", sub.id);
    return;
  }

  const { error } = await admin
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", sub.id);

  if (error) {
    console.error("[subscription.deleted] DB update failed:", error);
  }

  await logBillingEvent(admin, event, organizationId);
  console.log(`[subscription.deleted] org=${organizationId}`);
}

// ── invoice.payment_failed ─────────────────────────────────────────────────

async function handlePaymentFailed(
  admin: SupabaseAdmin,
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeCustomerId = invoice.customer as string;

  const organizationId = await resolveOrgId(admin, {
    stripeCustomerId,
    stripeSubscriptionId: invoice.subscription as string | null,
  });

  if (!organizationId) {
    console.error("[payment_failed] Cannot resolve organization_id for customer:", stripeCustomerId);
    return;
  }

  const { error } = await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", stripeCustomerId);

  if (error) {
    console.error("[payment_failed] DB update failed:", error);
  }

  await logBillingEvent(admin, event, organizationId);
  console.log(`[payment_failed] org=${organizationId}`);
}

// ── invoice.payment_succeeded ──────────────────────────────────────────────

async function handlePaymentSucceeded(
  admin: SupabaseAdmin,
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeCustomerId = invoice.customer as string;

  // period_end on the invoice lines up with the subscription's next period.
  const periodEnd = invoice.lines.data[0]?.period?.end;

  const organizationId = await resolveOrgId(admin, {
    stripeCustomerId,
    stripeSubscriptionId: invoice.subscription as string | null,
  });

  if (!organizationId) {
    console.error("[payment_succeeded] Cannot resolve organization_id for customer:", stripeCustomerId);
    return;
  }

  const updatePayload: Record<string, unknown> = { status: "active" };
  if (periodEnd) {
    updatePayload.current_period_end = toIso(periodEnd);
  }

  const { error } = await admin
    .from("subscriptions")
    .update(updatePayload)
    .eq("stripe_customer_id", stripeCustomerId);

  if (error) {
    console.error("[payment_succeeded] DB update failed:", error);
  }

  await logBillingEvent(admin, event, organizationId);
  console.log(`[payment_succeeded] org=${organizationId}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  // ── Read raw body BEFORE anything else (required for HMAC verification) ──
  const rawBody = await req.text();

  const stripeSignature = req.headers.get("stripe-signature");
  if (!stripeSignature) {
    return jsonResponse({ error: "En-tête stripe-signature manquant" }, 400);
  }

  try {
    // ── Env vars ─────────────────────────────────────────────────────────
    const stripeSecretKey  = getRequiredEnv("STRIPE_SECRET_KEY");
    const webhookSecret    = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl      = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey   = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const admin  = createClient(supabaseUrl, serviceRoleKey);

    // ── Verify Stripe signature ────────────────────────────────────────────
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        stripeSignature,
        webhookSecret,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[stripe-webhook] Signature verification failed:", msg);
      return jsonResponse({ error: "Signature invalide" }, 400);
    }

    // ── Dispatch ───────────────────────────────────────────────────────────
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, stripe, event);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(admin, event);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(admin, event);
        break;

      default:
        // Acknowledge immediately — Stripe retries unacknowledged events.
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    // Always return 200 to Stripe within 30 s to prevent retries.
    return jsonResponse({ received: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[stripe-webhook] Unhandled error:", message);
    // Return 500 so Stripe retries — only for unexpected infra failures.
    return jsonResponse({ error: "Erreur serveur", detail: message }, 500);
  }
});
