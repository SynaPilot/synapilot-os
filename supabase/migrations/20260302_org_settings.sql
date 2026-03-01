-- =====================================================
-- Migration: organizations.settings JSONB column
-- =====================================================
-- Adds a JSONB settings column to the organizations table.
-- The trigger-automation Edge Function reads
-- settings.automations[action] to decide whether to fire.
--
-- Default settings structure:
-- {
--   "automations": {
--     "new_contact":              true,   -- fires on INSERT INTO contacts
--     "visit_completed":          true,   -- fires when activity type=Visite reaches Terminé
--     "daily_pipeline_check":     true,   -- scheduled (cron) — not a DB trigger
--     "new_mandate":              true,   -- fires when property.status changes to Mandat
--     "cold_leads_reactivation":  true    -- scheduled (cron) — not a DB trigger
--   },
--   "communications": {
--     "sms_enabled":       false,
--     "whatsapp_enabled":  false
--   },
--   "onboarding": {
--     "completed":         false,
--     "n8n_provisioned":   false,
--     "smtp_configured":   false
--   }
-- }

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
