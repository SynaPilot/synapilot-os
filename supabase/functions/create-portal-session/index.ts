import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

// ---------------------------------------------------------------------------
// Edge Function
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  try {
    // ── Env vars ───────────────────────────────────────────────────────────
    const supabaseUrl     = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey  = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    const appUrl          = getRequiredEnv("APP_URL");

    // ── Auth: verify JWT ───────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Non autorisé — token manquant" }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "Non autorisé — token invalide" }, 401);
    }

    const callerUid = authData.user.id;

    // ── Parse request body ─────────────────────────────────────────────────
    let body: { organization_id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corps de requête JSON invalide" }, 400);
    }

    const { organization_id } = body;
    if (!organization_id) {
      return jsonResponse({ error: "Champ requis : organization_id" }, 400);
    }

    // ── Service-role client ────────────────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Authorization: caller must belong to the requested org ─────────────
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", callerUid)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: "Profil utilisateur introuvable" }, 404);
    }

    if (profile.organization_id !== organization_id) {
      return jsonResponse({ error: "Accès refusé — organisation incorrecte" }, 403);
    }

    // ── Authorization: caller must be Admin ────────────────────────────────
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUid)
      .maybeSingle();

    if (!roleRow || roleRow.role !== "Admin") {
      return jsonResponse(
        { error: "Accès refusé — rôle Administrateur requis" },
        403,
      );
    }

    // ── Fetch Stripe customer ID ───────────────────────────────────────────
    const { data: subscription, error: subError } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organization_id)
      .single();

    if (subError || !subscription) {
      return jsonResponse(
        { error: "Abonnement introuvable pour cette organisation" },
        404,
      );
    }

    if (!subscription.stripe_customer_id) {
      return jsonResponse(
        {
          error:
            "Aucun abonnement actif. Veuillez d'abord souscrire à un forfait.",
        },
        404,
      );
    }

    // ── Create Billing Portal Session ──────────────────────────────────────
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id as string,
      return_url: `${appUrl}/billing`,
    });

    return jsonResponse({ url: portalSession.url });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[create-portal-session] Error:", message);
    return jsonResponse({ error: "Erreur serveur", detail: message }, 500);
  }
});
