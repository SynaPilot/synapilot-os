-- Add administrative and legal columns to properties table
-- These fields are optional for quick entry but available for advanced users

-- DPE (Diagnostic de Performance Énergétique) label A-G
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS dpe_label text;

-- GES (Gaz à Effet de Serre) label A-G  
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ges_label text;

-- Mandate information
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS mandate_number text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS mandate_type text;

-- Financial information
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tax_property numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS co_ownership_charges numeric;

-- Technical information
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cadastral_ref text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS heating_type text;

-- Add comments for documentation
COMMENT ON COLUMN public.properties.dpe_label IS 'Diagnostic Performance Énergétique (A-G)';
COMMENT ON COLUMN public.properties.ges_label IS 'Gaz à Effet de Serre (A-G)';
COMMENT ON COLUMN public.properties.mandate_number IS 'Numéro de mandat';
COMMENT ON COLUMN public.properties.mandate_type IS 'Type de mandat (simple, exclusif, semi-exclusif)';
COMMENT ON COLUMN public.properties.tax_property IS 'Taxe foncière annuelle en euros';
COMMENT ON COLUMN public.properties.co_ownership_charges IS 'Charges de copropriété mensuelles';
COMMENT ON COLUMN public.properties.cadastral_ref IS 'Référence cadastrale';
COMMENT ON COLUMN public.properties.heating_type IS 'Type de chauffage';