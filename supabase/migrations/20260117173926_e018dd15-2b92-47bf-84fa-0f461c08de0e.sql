-- Add transaction_type column to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'vente';

-- Add check constraint for transaction_type
ALTER TABLE public.properties 
ADD CONSTRAINT properties_transaction_type_check 
CHECK (transaction_type IN ('vente', 'location', 'viager'));