-- Create contact_searches table for buyer search criteria
CREATE TABLE public.contact_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Budget criteria
  budget_min NUMERIC NULL,
  budget_max NUMERIC NULL,
  
  -- Property criteria
  min_surface NUMERIC NULL,
  max_surface NUMERIC NULL,
  min_rooms INTEGER NULL,
  max_rooms INTEGER NULL,
  min_bedrooms INTEGER NULL,
  max_bedrooms INTEGER NULL,
  
  -- Property types (array of enum values)
  property_types TEXT[] NULL DEFAULT '{}',
  
  -- Location preferences
  cities TEXT[] NULL DEFAULT '{}',
  postal_codes TEXT[] NULL DEFAULT '{}',
  
  -- Transaction type preference
  transaction_type TEXT NULL DEFAULT 'vente',
  
  -- Additional criteria
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view contact_searches in their organization"
ON public.contact_searches
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert contact_searches in their organization"
ON public.contact_searches
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update contact_searches in their organization"
ON public.contact_searches
FOR UPDATE
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete contact_searches in their organization"
ON public.contact_searches
FOR DELETE
USING (organization_id = get_user_organization_id(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_contact_searches_contact_id ON public.contact_searches(contact_id);
CREATE INDEX idx_contact_searches_organization_id ON public.contact_searches(organization_id);
CREATE INDEX idx_contact_searches_active ON public.contact_searches(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_contact_searches_updated_at
BEFORE UPDATE ON public.contact_searches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();