-- Create email_sequences table for drip campaigns
CREATE TABLE public.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]', -- Array of {delay_days, template_id, subject, body}
  category TEXT DEFAULT 'custom',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence_enrollments table to track contacts in sequences
CREATE TABLE public.sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_step INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_send_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, contact_id) -- Prevent duplicate enrollments
);

-- Enable RLS
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_sequences
CREATE POLICY "Users can view sequences in their organization"
ON public.email_sequences FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can create sequences in their organization"
ON public.email_sequences FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update sequences in their organization"
ON public.email_sequences FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete sequences in their organization"
ON public.email_sequences FOR DELETE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- RLS policies for sequence_enrollments
CREATE POLICY "Users can view enrollments in their organization"
ON public.sequence_enrollments FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can create enrollments in their organization"
ON public.sequence_enrollments FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update enrollments in their organization"
ON public.sequence_enrollments FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete enrollments in their organization"
ON public.sequence_enrollments FOR DELETE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_email_sequences_updated_at
BEFORE UPDATE ON public.email_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sequence_enrollments_updated_at
BEFORE UPDATE ON public.sequence_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_email_sequences_org ON public.email_sequences(organization_id);
CREATE INDEX idx_sequence_enrollments_sequence ON public.sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_enrollments_contact ON public.sequence_enrollments(contact_id);
CREATE INDEX idx_sequence_enrollments_next_send ON public.sequence_enrollments(next_send_at) WHERE status = 'active';