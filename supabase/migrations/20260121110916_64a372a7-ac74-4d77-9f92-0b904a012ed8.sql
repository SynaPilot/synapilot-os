-- Table email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  category text NOT NULL CHECK (category IN ('first_contact', 'followup', 'property_proposal', 'post_visit', 'appointment', 'newsletter', 'custom')),
  variables text[] DEFAULT '{}',
  is_predefined boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_email_templates_org ON public.email_templates(organization_id, category);

-- RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org templates"
  ON public.email_templates FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can create templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update org templates"
  ON public.email_templates FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()) AND NOT is_predefined);

CREATE POLICY "Users can delete org templates"
  ON public.email_templates FOR DELETE
  USING (organization_id = get_user_organization_id(auth.uid()) AND NOT is_predefined);

-- Trigger updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();