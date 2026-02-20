-- Add missing columns to contacts table that the code expects
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS last_contact_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_followup_date timestamp with time zone;