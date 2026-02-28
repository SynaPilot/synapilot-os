-- =============================================================================
-- Migration : 20260228_rls_fix_and_roles.sql
-- Author    : SynaPilot Security Audit
-- Date      : 2026-02-28
-- =============================================================================
-- Purpose:
--   1. Fix broken billing RLS (wrong function name: get_user_organization_id
--      → get_user_org_id), which caused 0 rows returned for all users.
--   2. Add service_role INSERT/UPDATE policies on billing tables for the
--      Stripe webhook handler.
--   3. Add Admin-only UPDATE on organizations.
--   4. Add Admin management of user_roles (view all + INSERT/UPDATE/DELETE).
--   5. Replace open DELETE on contacts/properties/deals with Admin+Manager gate.
--   6. Add public.is_subscription_active() helper.
--
-- IDEMPOTENCY: Every DROP POLICY uses IF EXISTS. Safe to re-run.
--
-- POLICIES MANAGED IN THIS FILE:
-- ┌──────────────────┬─────────┬──────────────────────────────────────────────┐
-- │ Table            │ Op      │ Policy name                                  │
-- ├──────────────────┼─────────┼──────────────────────────────────────────────┤
-- │ subscriptions    │ DROP    │ "Users can view their org subscription"      │
-- │ subscriptions    │ CREATE  │ "Users can view their org subscription"      │
-- │ subscriptions    │ CREATE  │ "Service role can manage subscriptions"      │
-- │ billing_events   │ DROP    │ "Users can view their org billing events"    │
-- │ billing_events   │ CREATE  │ "Users can view their org billing events"    │
-- │ billing_events   │ CREATE  │ "Service role can manage billing events"     │
-- │ organizations    │ DROP    │ "Admins can update their organization"       │
-- │ organizations    │ CREATE  │ "Admins can update their organization"       │
-- │ user_roles       │ DROP    │ "Admins can view all roles in their org"     │
-- │ user_roles       │ CREATE  │ "Admins can view all roles in their org"     │
-- │ user_roles       │ DROP    │ "Admins can manage roles in their org"       │
-- │ user_roles       │ CREATE  │ "Admins can manage roles in their org"       │
-- │ contacts         │ DROP    │ "Users can delete contacts in their org"     │
-- │ contacts         │ CREATE  │ "Admins and Managers can delete contacts"    │
-- │ properties       │ DROP    │ "Users can delete properties in their org"   │
-- │ properties       │ CREATE  │ "Admins and Managers can delete properties"  │
-- │ deals            │ DROP    │ "Users can delete deals in their org"        │
-- │ deals            │ CREATE  │ "Admins and Managers can delete deals"       │
-- └──────────────────┴─────────┴──────────────────────────────────────────────┘
-- =============================================================================


-- =============================================================================
-- TASK 1 — Fix broken billing RLS (function name bug)
-- Root cause: 20260218120000_stripe_billing.sql called
--   public.get_user_organization_id(auth.uid())  ← does not exist
-- Correct call: public.get_user_org_id()          ← no argument needed
-- =============================================================================

-- ── subscriptions ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their org subscription"
  ON public.subscriptions;

CREATE POLICY "Users can view their org subscription"
  ON public.subscriptions FOR SELECT
  USING (organization_id = public.get_user_org_id());

-- Service role bypass: allows the Stripe webhook Edge Function (running with
-- the service_role key) to upsert subscription records. The service_role Postgres
-- role already has BYPASSRLS, but explicit policies make the intent auditable.
DROP POLICY IF EXISTS "Service role can manage subscriptions"
  ON public.subscriptions;

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── billing_events ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their org billing events"
  ON public.billing_events;

CREATE POLICY "Users can view their org billing events"
  ON public.billing_events FOR SELECT
  USING (organization_id = public.get_user_org_id());

-- Service role: webhook handler inserts billing_events for every Stripe event.
DROP POLICY IF EXISTS "Service role can manage billing events"
  ON public.billing_events;

CREATE POLICY "Service role can manage billing events"
  ON public.billing_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TASK 2 — Role-differentiated policies
-- =============================================================================

-- ── organizations: Admin UPDATE ───────────────────────────────────────────────
-- Allows an Admin to update their own agency's name / settings.
-- Non-admin roles are read-only (SELECT policy already exists from initial migration).

DROP POLICY IF EXISTS "Admins can update their organization"
  ON public.organizations;

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    id = public.get_user_org_id()
    AND public.has_role(auth.uid(), 'Admin')
  )
  WITH CHECK (
    id = public.get_user_org_id()
    AND public.has_role(auth.uid(), 'Admin')
  );

-- ── user_roles: Admin visibility across org ───────────────────────────────────
-- The initial migration already created:
--   "Users can view their own roles"  → user_id = auth.uid()   (covers agents)
--   "Allow role creation during signup" → INSERT for self       (kept as-is)
--
-- We add two additional Admin-scoped policies.
-- user_roles has no organization_id column; we join through profiles to scope
-- queries to the admin's organization.

DROP POLICY IF EXISTS "Admins can view all roles in their org"
  ON public.user_roles;

CREATE POLICY "Admins can view all roles in their org"
  ON public.user_roles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'Admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.organization_id = public.get_user_org_id()
    )
  );

-- Admins can INSERT (assign a role to a new team member), UPDATE (promote/demote),
-- and DELETE (remove a role) for any user in their organization.
DROP POLICY IF EXISTS "Admins can manage roles in their org"
  ON public.user_roles;

CREATE POLICY "Admins can manage roles in their org"
  ON public.user_roles
  FOR ALL  -- covers INSERT / UPDATE / DELETE
  USING (
    public.has_role(auth.uid(), 'Admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'Admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.organization_id = public.get_user_org_id()
    )
  );

-- ── contacts: restrict DELETE to Admin + Manager ─────────────────────────────

DROP POLICY IF EXISTS "Users can delete contacts in their org"
  ON public.contacts;

DROP POLICY IF EXISTS "Admins and Managers can delete contacts"
  ON public.contacts;

CREATE POLICY "Admins and Managers can delete contacts"
  ON public.contacts FOR DELETE
  USING (
    organization_id = public.get_user_org_id()
    AND (
      public.has_role(auth.uid(), 'Admin')
      OR public.has_role(auth.uid(), 'Manager')
    )
  );

-- ── properties: restrict DELETE to Admin + Manager ───────────────────────────

DROP POLICY IF EXISTS "Users can delete properties in their org"
  ON public.properties;

DROP POLICY IF EXISTS "Admins and Managers can delete properties"
  ON public.properties;

CREATE POLICY "Admins and Managers can delete properties"
  ON public.properties FOR DELETE
  USING (
    organization_id = public.get_user_org_id()
    AND (
      public.has_role(auth.uid(), 'Admin')
      OR public.has_role(auth.uid(), 'Manager')
    )
  );

-- ── deals: restrict DELETE to Admin + Manager ────────────────────────────────

DROP POLICY IF EXISTS "Users can delete deals in their org"
  ON public.deals;

DROP POLICY IF EXISTS "Admins and Managers can delete deals"
  ON public.deals;

CREATE POLICY "Admins and Managers can delete deals"
  ON public.deals FOR DELETE
  USING (
    organization_id = public.get_user_org_id()
    AND (
      public.has_role(auth.uid(), 'Admin')
      OR public.has_role(auth.uid(), 'Manager')
    )
  );

-- ── activities: keep fully open within org ───────────────────────────────────
-- The initial migration already grants SELECT/INSERT/UPDATE/DELETE to all roles.
-- Activity logs are intentionally open: agents must be able to log and correct
-- their own actions. No changes made here.


-- =============================================================================
-- TASK 3 — Subscription status helper
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_subscription_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE organization_id = public.get_user_org_id()
      AND status IN ('active', 'trialing')
  )
$$;

-- =============================================================================
-- SUBSCRIPTION GATE — DESIGN NOTE (do NOT implement as RLS on data tables)
-- =============================================================================
-- public.is_subscription_active() is intentionally NOT used as a USING clause
-- on data tables (contacts, properties, deals, activities, etc.).
--
-- Rationale for a CRM:
--   • An agency that cancels or has a failed payment must still be able to
--     read and export their historical client and property data. Locking them
--     out at the DB level would violate RGPD data portability obligations.
--   • "past_due" is a temporary state (3–7 day Stripe grace period); blocking
--     data access immediately would cause unnecessary churn.
--
-- Recommended implementation pattern instead:
--   1. Frontend: call is_subscription_active() on app load and show an
--      upgrade banner / read-only mode for 'past_due' / 'canceled'.
--   2. Edge Functions: guard write operations (create contact, create deal)
--      via is_subscription_active() before executing the INSERT.
--   3. Feature flags: disable AI features, bulk exports, etc. for inactive orgs.
--
-- Tables that COULD gate on subscription status (write operations only):
--   • contacts    → block INSERT when canceled
--   • properties  → block INSERT when canceled
--   • deals       → block INSERT when canceled
--   • activities  → keep open always (audit trail must remain writable)
--   • mois        → block INSERT when canceled
-- =============================================================================
