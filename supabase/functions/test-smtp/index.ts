/**
 * test-smtp — Tests an SMTP connection using provided credentials.
 * Called by the Wizard Step 2 "Tester la connexion" button before the user can proceed.
 */

import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmtpTestPayload {
  host: string;
  port: number;
  user: string;
  password: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: SmtpTestPayload = await req.json();
    const { host, port, user, password } = body;

    if (!host || !port || !user || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: host, port, user, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    });

    // Race transporter.verify() against a hard 10-second deadline
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SMTP connection timed out after 10 seconds")), 10_000)
    );

    await Promise.race([transporter.verify(), timeout]);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    // Always return 200 with structured JSON — never let the caller see a 5xx
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
