/**
 * trigger-n8n-provisioning — Receives the full wizard payload, persists SMTP
 * settings to Supabase (AES-256-GCM encrypted), triggers N8N provisioning,
 * and marks the organization as onboarded. Called once at Step 4 activation.
 */

import { createClient } from "npm:@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardPayload {
  organization_id: string;
  org_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string; // plain — encrypted before storage
  director_email: string;
  whatsapp_number: string | null;
  agent_count: number;
}

interface ProfileRow {
  email: string | null;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Helper — AES-256-GCM password encryption
// ---------------------------------------------------------------------------

/**
 * Encrypts `plaintext` with AES-256-GCM derived from a 64-char hex key.
 * Returns the string  base64(iv) + ":" + base64(ciphertext).
 */
async function encryptPassword(plaintext: string, hexKey: string): Promise<string> {
  // Hex-decode the 64-char key → 32 bytes
  const keyBytes = new Uint8Array(
    hexKey.match(/.{2}/g)!.map((byte: string) => parseInt(byte, 16))
  );

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoded
  );

  const uint8ToBase64 = (arr: Uint8Array): string =>
    btoa(String.fromCharCode(...arr));

  return `${uint8ToBase64(iv)}:${uint8ToBase64(new Uint8Array(cipherBuffer))}`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonResponse = (body: object): Response =>
    new Response(JSON.stringify(body), {
      status: 200, // Always 200 — errors are expressed in the body
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const payload: WizardPayload = await req.json();
    const {
      organization_id,
      org_name,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      director_email,
      whatsapp_number,
      agent_count,
    } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_BASE_URL")!;
    const smtpEncryptionKey = Deno.env.get("SMTP_ENCRYPTION_KEY")!;

    // Service-role client — bypasses RLS for trusted server-side writes
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ------------------------------------------------------------------
    // STEP 1 — Fetch agent emails
    // ------------------------------------------------------------------
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email")
      .eq("organization_id", organization_id);

    const agent_emails: string[] = profilesError
      ? []
      : (profiles as ProfileRow[])
          .map((p) => p.email)
          .filter((e): e is string => e !== null);

    // ------------------------------------------------------------------
    // STEP 2 — Encrypt smtp_password
    // ------------------------------------------------------------------
    const password_encrypted = await encryptPassword(smtp_password, smtpEncryptionKey);

    // ------------------------------------------------------------------
    // STEP 3 — Persist settings to Supabase
    // ------------------------------------------------------------------
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        settings: {
          smtp: {
            host: smtp_host,
            port: smtp_port,
            user: smtp_user,
            password_encrypted,
          },
          agent_count,
        },
        director_email,
        whatsapp_number,
      })
      .eq("id", organization_id);

    if (updateError) {
      console.error("DB update error:", updateError.message);
      return jsonResponse({ success: false, error: "db_error" });
    }

    // ------------------------------------------------------------------
    // STEP 4 — Trigger N8N (non-fatal if unreachable)
    // ------------------------------------------------------------------
    let n8n_failed = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      const n8nRes = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "provision_org",
          organization_id,
          org_name,
          smtp_host,
          smtp_port,
          smtp_user,
          smtp_password, // plain text — N8N needs it to configure the mail node
          director_email,
          whatsapp_number,
          agent_emails,
          agent_count,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!n8nRes.ok) {
        console.error("N8N returned non-2xx:", n8nRes.status);
        n8n_failed = true;
      }
    } catch (_err) {
      console.error("N8N unreachable or timed out");
      n8n_failed = true;
    }

    // ------------------------------------------------------------------
    // STEP 5 — Mark onboarding complete (regardless of N8N result)
    // ------------------------------------------------------------------
    const { error: onboardingError } = await supabase
      .from("organizations")
      .update({ onboarding_completed: true })
      .eq("id", organization_id);

    if (onboardingError) {
      console.error("Failed to set onboarding_completed:", onboardingError.message);
    }

    // ------------------------------------------------------------------
    // STEP 6 — Return
    // ------------------------------------------------------------------
    if (n8n_failed) {
      return jsonResponse({ success: false, error: "n8n_unreachable" });
    }

    return jsonResponse({ success: true, workflows_activated: 8 });
  } catch (error) {
    console.error("Unhandled Edge Function error:", error instanceof Error ? error.message : error);
    return jsonResponse({ success: false, error: "db_error" });
  }
});
