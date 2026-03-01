-- =====================================================
-- Migration: DB Triggers → trigger-automation Edge Function
-- =====================================================
-- These triggers fire automatically when CRM events happen,
-- calling the trigger-automation Edge Function via pg_net
-- (async HTTP POST, fire-and-forget — never blocks the transaction).
--
-- PREREQUISITE: store two secrets in Supabase Vault before deploying:
--   SELECT vault.create_secret('https://<project-ref>.supabase.co', 'SUPABASE_URL');
--   SELECT vault.create_secret('<service_role_key>', 'SUPABASE_SERVICE_ROLE_KEY');
-- These are read at runtime by call_trigger_automation() below.
-- =====================================================

-- Enable pg_net (async HTTP from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =====================================================
-- HELPER: call_trigger_automation(action, payload)
-- =====================================================
-- SECURITY DEFINER so it can read vault secrets without
-- granting vault access to every caller role.
-- Never inlines the service role key — always reads from vault.

CREATE OR REPLACE FUNCTION public.call_trigger_automation(
  p_action  TEXT,
  p_payload JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url              TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Read secrets from Supabase Vault (set up via Supabase dashboard or vault.create_secret)
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  -- If vault secrets are not yet configured, skip silently
  IF v_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'call_trigger_automation: vault secrets not configured, skipping action=%', p_action;
    RETURN;
  END IF;

  -- Async HTTP POST — does not block the triggering transaction
  PERFORM extensions.http_post(
    url     := v_url || '/functions/v1/trigger-automation',
    body    := jsonb_build_object('action', p_action, 'payload', p_payload)::text,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    )::text
  );

EXCEPTION WHEN OTHERS THEN
  -- Never let an automation failure roll back the business transaction
  RAISE WARNING 'call_trigger_automation: http_post failed for action=%, error=%', p_action, SQLERRM;
END;
$$;

-- =====================================================
-- TRIGGER 1 — new_contact
-- Fires: AFTER INSERT ON contacts
-- =====================================================

CREATE OR REPLACE FUNCTION public.trg_new_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_trigger_automation(
    'new_contact',
    jsonb_build_object(
      'contact_id',      NEW.id,
      'full_name',       NEW.full_name,
      'email',           NEW.email,
      'phone',           NEW.phone,
      'role',            NEW.role::text,
      'pipeline_stage',  NEW.pipeline_stage::text,
      'organization_id', NEW.organization_id
    )
  );
  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

CREATE TRIGGER trigger_new_contact
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_new_contact();

-- =====================================================
-- TRIGGER 2 — visit_completed
-- Fires: AFTER UPDATE ON activities
-- Condition: type = 'Visite', status transitions to 'Terminé'
-- =====================================================

CREATE OR REPLACE FUNCTION public.trg_visit_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_trigger_automation(
    'visit_completed',
    jsonb_build_object(
      'activity_id',          NEW.id,
      'related_contact_id',   NEW.related_contact_id,
      'related_property_id',  NEW.related_property_id,
      'organization_id',      NEW.organization_id
    )
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_visit_completed
  AFTER UPDATE ON public.activities
  FOR EACH ROW
  WHEN (
    NEW.type    = 'Visite'::activity_type
    AND NEW.status = 'Terminé'::activity_status
    AND OLD.status != 'Terminé'::activity_status
  )
  EXECUTE FUNCTION public.trg_visit_completed();

-- =====================================================
-- TRIGGER 3 — new_mandate
-- Fires: AFTER UPDATE ON properties
-- Condition: status transitions to 'Mandat'
-- =====================================================

CREATE OR REPLACE FUNCTION public.trg_new_mandate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_trigger_automation(
    'new_mandate',
    jsonb_build_object(
      'property_id',       NEW.id,
      'address',           NEW.address,
      'type',              NEW.type::text,
      'price',             NEW.price,
      'owner_id',          NEW.owner_id,
      'assigned_agent_id', NEW.assigned_agent_id,
      'organization_id',   NEW.organization_id
    )
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_new_mandate
  AFTER UPDATE ON public.properties
  FOR EACH ROW
  WHEN (
    NEW.status = 'Mandat'::property_status
    AND OLD.status != 'Mandat'::property_status
  )
  EXECUTE FUNCTION public.trg_new_mandate();

-- =====================================================
-- TASK 4 — Provision N8N on org creation
-- Updates create_default_subscription() (defined in
-- 20260218120000_stripe_billing.sql) to also fire
-- the provision_org automation after creating the
-- trial subscription.
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create trial subscription (existing behaviour)
  INSERT INTO public.subscriptions (organization_id)
  VALUES (NEW.id);

  -- Initiate N8N workspace provisioning for the new agency
  PERFORM public.call_trigger_automation(
    'provision_org',
    jsonb_build_object(
      'organization_id', NEW.id,
      'org_name',        NEW.name,
      'slug',            NEW.slug
    )
  );

  RETURN NEW;
END;
$$;

-- The on_organization_created trigger already exists and points to
-- create_default_subscription() — no need to recreate it.
