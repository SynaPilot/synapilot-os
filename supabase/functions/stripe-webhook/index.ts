import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ========== VERIFY STRIPE SIGNATURE ==========
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Signature Stripe manquante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Signature invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== LOG EVENT TO billing_events ==========
    const logEvent = async (organizationId: string) => {
      await adminSupabase.from('billing_events').insert({
        organization_id: organizationId,
        stripe_event_id: event.id,
        event_type: event.type,
        data: event.data.object as Record<string, unknown>,
      });
    };

    // ========== HANDLE EVENTS ==========
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.client_reference_id;

        if (!organizationId) {
          console.error('checkout.session.completed: missing client_reference_id');
          break;
        }

        await adminSupabase
          .from('subscriptions')
          .update({
            status: 'active',
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            plan: 'pilot',
          })
          .eq('organization_id', organizationId);

        await logEvent(organizationId);
        console.log('checkout.session.completed for org:', organizationId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        // Fetch org from subscription
        const { data: sub } = await adminSupabase
          .from('subscriptions')
          .select('organization_id')
          .eq('stripe_subscription_id', stripeSubId)
          .single();

        if (!sub) {
          console.error('subscription.updated: subscription not found for', stripeSubId);
          break;
        }

        const status = subscription.status === 'active' ? 'active'
          : subscription.status === 'past_due' ? 'past_due'
          : subscription.status === 'canceled' ? 'canceled'
          : subscription.status === 'trialing' ? 'trialing'
          : subscription.status === 'incomplete' ? 'incomplete'
          : 'active';

        await adminSupabase
          .from('subscriptions')
          .update({
            status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            seats: subscription.items.data[0]?.quantity || 1,
          })
          .eq('stripe_subscription_id', stripeSubId);

        await logEvent(sub.organization_id);
        console.log('subscription.updated for org:', sub.organization_id, 'status:', status);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        const { data: sub } = await adminSupabase
          .from('subscriptions')
          .select('organization_id')
          .eq('stripe_subscription_id', stripeSubId)
          .single();

        if (!sub) {
          console.error('subscription.deleted: subscription not found for', stripeSubId);
          break;
        }

        await adminSupabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', stripeSubId);

        await logEvent(sub.organization_id);
        console.log('subscription.deleted for org:', sub.organization_id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string;

        const { data: sub } = await adminSupabase
          .from('subscriptions')
          .select('organization_id')
          .eq('stripe_customer_id', stripeCustomerId)
          .single();

        if (!sub) {
          console.error('invoice.payment_failed: subscription not found for customer', stripeCustomerId);
          break;
        }

        await adminSupabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', stripeCustomerId);

        await logEvent(sub.organization_id);
        console.log('invoice.payment_failed for org:', sub.organization_id);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Return 200 immediately (Stripe timeout = 30s)
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur webhook' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
