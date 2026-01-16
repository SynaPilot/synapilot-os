
-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent', 'viewer');

CREATE TYPE public.pipeline_stage AS ENUM (
  'nouveau',
  'qualification', 
  'estimation',
  'mandat',
  'commercialisation',
  'visite',
  'offre',
  'negociation',
  'compromis',
  'financement',
  'acte',
  'vendu',
  'perdu'
);

CREATE TYPE public.deal_stage AS ENUM (
  'nouveau',
  'qualification',
  'estimation', 
  'mandat',
  'commercialisation',
  'visite',
  'offre',
  'negociation',
  'compromis',
  'financement',
  'acte',
  'vendu',
  'perdu'
);

CREATE TYPE public.contact_role AS ENUM (
  'vendeur',
  'acheteur',
  'vendeur_acheteur',
  'locataire',
  'proprietaire',
  'prospect',
  'partenaire',
  'notaire',
  'banquier',
  'autre'
);

CREATE TYPE public.activity_type AS ENUM (
  'appel',
  'email',
  'visite',
  'rdv',
  'relance',
  'signature',
  'note',
  'tache',
  'autre'
);

CREATE TYPE public.activity_status AS ENUM (
  'planifie',
  'en_cours',
  'termine',
  'annule'
);

CREATE TYPE public.activity_priority AS ENUM (
  'basse',
  'normale',
  'haute',
  'urgente'
);

CREATE TYPE public.property_type AS ENUM (
  'appartement',
  'maison',
  'terrain',
  'commerce',
  'bureau',
  'immeuble',
  'parking',
  'autre'
);

CREATE TYPE public.property_status AS ENUM (
  'disponible',
  'sous_compromis',
  'vendu',
  'loue',
  'retire'
);

CREATE TYPE public.compte_type AS ENUM (
  'client',
  'fournisseur',
  'partenaire',
  'prospect'
);

-- =====================================================
-- TABLES
-- =====================================================

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  role public.contact_role DEFAULT 'prospect',
  pipeline_stage public.pipeline_stage DEFAULT 'nouveau',
  urgency_score INTEGER DEFAULT 0 CHECK (urgency_score >= 0 AND urgency_score <= 100),
  source TEXT,
  notes TEXT,
  tags TEXT[],
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type public.property_type DEFAULT 'appartement',
  status public.property_status DEFAULT 'disponible',
  address TEXT,
  city TEXT,
  postal_code TEXT,
  price NUMERIC(12,2),
  surface NUMERIC(10,2),
  rooms INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  floor INTEGER,
  total_floors INTEGER,
  year_built INTEGER,
  energy_rating TEXT,
  features JSONB DEFAULT '{}',
  images TEXT[],
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deals table
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  stage public.deal_stage DEFAULT 'nouveau',
  amount NUMERIC(12,2) DEFAULT 0,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  commission_rate NUMERIC(5,2) DEFAULT 0,
  commission_amount NUMERIC(12,2) DEFAULT 0,
  expected_close_date DATE,
  actual_close_date DATE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type public.activity_type DEFAULT 'tache',
  status public.activity_status DEFAULT 'planifie',
  priority public.activity_priority DEFAULT 'normale',
  description TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type public.compte_type DEFAULT 'client',
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  siret TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Months table (for monthly statistics)
CREATE TABLE public.months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  revenue NUMERIC(12,2) DEFAULT 0,
  deals_count INTEGER DEFAULT 0,
  deals_won INTEGER DEFAULT 0,
  deals_lost INTEGER DEFAULT 0,
  contacts_added INTEGER DEFAULT 0,
  activities_count INTEGER DEFAULT 0,
  properties_added INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, year, month)
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_organization_id ON public.user_roles(organization_id);
CREATE INDEX idx_contacts_organization_id ON public.contacts(organization_id);
CREATE INDEX idx_contacts_pipeline_stage ON public.contacts(pipeline_stage);
CREATE INDEX idx_contacts_assigned_to ON public.contacts(assigned_to);
CREATE INDEX idx_properties_organization_id ON public.properties(organization_id);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_type ON public.properties(type);
CREATE INDEX idx_deals_organization_id ON public.deals(organization_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_deals_contact_id ON public.deals(contact_id);
CREATE INDEX idx_deals_property_id ON public.deals(property_id);
CREATE INDEX idx_activities_organization_id ON public.activities(organization_id);
CREATE INDEX idx_activities_type ON public.activities(type);
CREATE INDEX idx_activities_status ON public.activities(status);
CREATE INDEX idx_activities_date ON public.activities(date);
CREATE INDEX idx_accounts_organization_id ON public.accounts(organization_id);
CREATE INDEX idx_months_organization_id ON public.months(organization_id);
CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- =====================================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKING
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - ORGANIZATIONS
-- =====================================================

CREATE POLICY "Users can view their organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (id = public.get_user_organization_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- RLS POLICIES - PROFILES
-- =====================================================

CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- RLS POLICIES - USER ROLES
-- =====================================================

CREATE POLICY "Users can view roles in their organization"
  ON public.user_roles FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage roles in their organization"
  ON public.user_roles FOR ALL
  USING (organization_id = public.get_user_organization_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- RLS POLICIES - CONTACTS
-- =====================================================

CREATE POLICY "Users can view contacts in their organization"
  ON public.contacts FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert contacts in their organization"
  ON public.contacts FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update contacts in their organization"
  ON public.contacts FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete contacts in their organization"
  ON public.contacts FOR DELETE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - PROPERTIES
-- =====================================================

CREATE POLICY "Users can view properties in their organization"
  ON public.properties FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert properties in their organization"
  ON public.properties FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update properties in their organization"
  ON public.properties FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete properties in their organization"
  ON public.properties FOR DELETE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - DEALS
-- =====================================================

CREATE POLICY "Users can view deals in their organization"
  ON public.deals FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert deals in their organization"
  ON public.deals FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update deals in their organization"
  ON public.deals FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete deals in their organization"
  ON public.deals FOR DELETE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - ACTIVITIES
-- =====================================================

CREATE POLICY "Users can view activities in their organization"
  ON public.activities FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert activities in their organization"
  ON public.activities FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update activities in their organization"
  ON public.activities FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete activities in their organization"
  ON public.activities FOR DELETE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - ACCOUNTS
-- =====================================================

CREATE POLICY "Users can view accounts in their organization"
  ON public.accounts FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert accounts in their organization"
  ON public.accounts FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update accounts in their organization"
  ON public.accounts FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete accounts in their organization"
  ON public.accounts FOR DELETE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - MONTHS
-- =====================================================

CREATE POLICY "Users can view months in their organization"
  ON public.months FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert months in their organization"
  ON public.months FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update months in their organization"
  ON public.months FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- =====================================================
-- RLS POLICIES - AUDIT LOGS
-- =====================================================

CREATE POLICY "Users can view audit logs in their organization"
  ON public.audit_logs FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_months_updated_at BEFORE UPDATE ON public.months FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- POLICY FOR INITIAL SIGNUP (allows creating org/profile during signup)
-- =====================================================

CREATE POLICY "Allow authenticated users to create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
