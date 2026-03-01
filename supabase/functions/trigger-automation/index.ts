import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// n8n is called exclusively via this Edge Function.
// The N8N_WEBHOOK_BASE_URL secret is set in Supabase Dashboard → Settings → Edge Functions → Secrets.
// Frontend code must never reference N8N_WEBHOOK_BASE_URL or call n8n directly.
//
// This function accepts two authentication paths:
//   1. User JWT (from React frontend) — looks up organization_id via profiles table.
//   2. Service role key (from DB triggers via pg_net) — uses organization_id from payload directly.

interface AutomationSettings {
  new_contact?: boolean;
  visit_completed?: boolean;
  daily_pipeline_check?: boolean;
  new_mandate?: boolean;
  cold_leads_reactivation?: boolean;
  [key: string]: boolean | undefined;
}

interface OrgSettings {
  automations?: AutomationSettings;
  communications?: {
    sms_enabled?: boolean;
    whatsapp_enabled?: boolean;
  };
  onboarding?: {
    completed?: boolean;
    n8n_provisioned?: boolean;
    smtp_configured?: boolean;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Non autorisé" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");

    // 2. Parse request body
    const { action, payload = {} }: { action: string; payload: Record<string, unknown> } =
      await req.json();

    if (!action) {
      return json({ success: false, error: "action requis" }, 400);
    }

    // 3. Read N8N_WEBHOOK_BASE_URL from Deno.env (Supabase Secret — never in frontend)
    const webhookUrl = Deno.env.get("N8N_WEBHOOK_BASE_URL");

    if (!webhookUrl) {
      console.warn("N8N_WEBHOOK_BASE_URL not configured — automation skipped:", action);
      return json({ success: false, reason: "not_configured" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 4. Resolve organization_id — two paths depending on caller
    let organizationId: string;

    const isServiceCall = token === serviceRoleKey;

    if (isServiceCall) {
      // Internal call from DB trigger via pg_net — trust payload.organization_id
      const payloadOrgId = payload.organization_id as string | undefined;
      if (!payloadOrgId) {
        return json({ success: false, error: "organization_id requis pour appel interne" }, 400);
      }
      organizationId = payloadOrgId;
    } else {
      // Normal user JWT path — resolve org via profiles table
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: authError } = await userClient.auth.getUser(token);

      if (authError || !userData?.user) {
        return json({ success: false, error: "Token invalide" }, 401);
      }

      const userId = userData.user.id;

      // profiles.id IS the auth user_id (PK references auth.users.id)
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("organization_id")
        .eq("id", userId) // ← FIXED: was .eq("user_id", userId) — column does not exist
        .single();

      if (profileError || !profile) {
        console.error("Profile lookup failed:", profileError?.message);
        return json({ success: false, error: "Profil introuvable" }, 403);
      }

      organizationId = profile.organization_id;
    }

    // 5. Read organizations.settings.automations[action] — check if enabled
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      console.error("Org lookup failed:", orgError?.message);
      return json({ success: false, error: "Organisation introuvable" }, 403);
    }

    const orgSettings = org.settings as unknown as OrgSettings | null;
    const automations = orgSettings?.automations;

    // If the automation key exists and is explicitly false, skip
    if (automations && action in automations && automations[action] === false) {
      console.log(`Automation '${action}' is disabled for org ${organizationId}`);
      return json({ success: false, reason: "disabled" });
    }

    // 6. POST to n8n with 5-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let n8nResponse: Response;
    try {
      n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload,
          organization_id: organizationId,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const msg = fetchError instanceof Error ? fetchError.message : "fetch error";
      console.error("n8n fetch failed:", msg);
      return json({ success: false, error: msg });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!n8nResponse.ok) {
      const body = await n8nResponse.text().catch(() => "");
      console.error(`n8n returned ${n8nResponse.status}:`, body);
      return json({ success: false, error: `n8n status ${n8nResponse.status}` });
    }

    return json({ success: true });
  } catch (err) {
    // Never throw — always return JSON
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("trigger-automation unexpected error:", msg);
    return json({ success: false, error: msg });
  }
});
