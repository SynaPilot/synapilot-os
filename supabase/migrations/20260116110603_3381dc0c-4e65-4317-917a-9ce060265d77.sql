-- Table activation_keys pour les clés d'activation des agences
CREATE TABLE public.activation_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Index pour recherche rapide par clé
CREATE INDEX idx_activation_keys_key ON public.activation_keys(key);

-- Enable RLS
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can check if a key exists (for signup validation)
CREATE POLICY "Anyone can check activation keys" 
ON public.activation_keys 
FOR SELECT 
USING (true);

-- Policy: System can update activation keys (via service role or during signup)
CREATE POLICY "Authenticated users can claim unused keys" 
ON public.activation_keys 
FOR UPDATE 
USING (is_used = false)
WITH CHECK (is_used = true);

-- Insert a test key for development
INSERT INTO public.activation_keys (key, is_used) VALUES ('SYNAPILOT-BETA-2024', false);