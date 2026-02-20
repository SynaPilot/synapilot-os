import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const stripePriceId = Deno.env.get('STRIPE_PRICE_PILOT')!;

    // ========== JWT AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorise - Token manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userSupabase.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Non autorise - Token invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUid = userData.user.id;

    // ========== PARSE BODY ==========
    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'Champ requis : organization_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ADMIN CHECK ==========
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminCheck, error: adminError } = await adminSupabase
      .from('user_roles')
      .select('id')
      .eq('user_id', callerUid)
      .eq('organization_id', organization_id)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminError || !adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Acces refuse - Vous devez etre administrateur' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== GET OR CREATE STRIPE CUSTOMER ==========
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { data: subscription, error: subError } = await adminSupabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organization_id)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'Abonnement introuvable pour cette organisation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let stripeCustomerId = subscription.stripe_customer_id;

    if (!stripeCustomerId) {
      // Fetch org name for Stripe customer
      const { data: org } = await adminSupabase
        .from('organizations')
        .select('name')
        .eq('id', organization_id)
        .single();

      const customer = await stripe.customers.create({
        email: userData.user.email,
        name: org?.name || undefined,
        metadata: { organization_id },
      });

      stripeCustomerId = customer.id;

      await adminSupabase
        .from('subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('organization_id', organization_id);
    }

    // ========== CREATE CHECKOUT SESSION ==========
    const origin = req.headers.get('origin') || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: subscription.seats || 1,
        },
      ],
      success_url: `${origin}/settings?billing=success`,
      cancel_url: `${origin}/settings?billing=canceled`,
      client_reference_id: organization_id,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Erreur serveur',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
