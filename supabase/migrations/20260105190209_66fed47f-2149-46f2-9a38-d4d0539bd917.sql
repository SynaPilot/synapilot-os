-- =====================================================
-- ENUM TYPES
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('Admin', 'Manager', 'Agent');
CREATE TYPE public.contact_role AS ENUM ('Vendeur', 'Acheteur', 'Investisseur');
CREATE TYPE public.pipeline_stage AS ENUM ('Nouveau', 'Qualifié', 'Visite', 'Offre', 'Clos');
CREATE TYPE public.property_type AS ENUM ('Appartement', 'Maison', 'Terrain', 'Commerce', 'Immeuble');
CREATE TYPE public.property_status AS ENUM ('Estimation', 'Mandat', 'Sous Offre', 'Vendu', 'Archivé');
CREATE TYPE public.activity_type AS ENUM ('Call', 'SMS', 'Email', 'Meeting', 'Visite', 'Relance');
CREATE TYPE public.activity_status AS ENUM ('À faire', 'En cours', 'Terminé', 'Annulé');
CREATE TYPE public.deal_stage AS ENUM ('Lead', 'Qualification', 'Mandat', 'Négociation', 'Vendu', 'Perdu');
CREATE TYPE public.compte_type AS ENUM ('Particulier', 'Entreprise', 'SCI');

-- =====================================================
-- TABLES DE GESTION MULTI-TENANT
-- =====================================================

-- 1. ORGANIZATIONS (Les Agences Clientes)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROFILES (Extension de auth.users avec lien Organisation)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. USER_ROLES (Séparation des rôles pour sécurité)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'Agent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- =====================================================
-- TABLES MÉTIER (CRM IMMOBILIER)
-- =====================================================

-- 4. CONTACTS (Leads Vendeurs/Acheteurs)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role contact_role,
  pipeline_stage pipeline_stage DEFAULT 'Nouveau',
  urgency_score INTEGER CHECK (urgency_score BETWEEN 0 AND 10) DEFAULT 0,
  source TEXT,
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_followup_date TIMESTAMP WITH TIME ZONE,
  assigned_agent_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PROPERTIES (Biens Immobiliers)
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  type property_type,
  status property_status DEFAULT 'Estimation',
  price DECIMAL(12,2),
  surface_m2 DECIMAL(8,2),
  rooms INTEGER,
  bedrooms INTEGER,
  description TEXT,
  photos_url TEXT[],
  owner_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ACTIVITIES (Journal des Actions)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  status activity_status DEFAULT 'À faire',
  content TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  related_contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  related_property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. DEALS (Opportunités Commerciales)
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 5.00,
  commission_amount DECIMAL(12,2) GENERATED ALWAYS AS (amount * commission_rate / 100) STORED,
  stage deal_stage DEFAULT 'Lead',
  probability INTEGER CHECK (probability BETWEEN 0 AND 100) DEFAULT 0,
  expected_close_date DATE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. COMPTES (Foyers/Entreprises)
CREATE TABLE public.comptes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type compte_type DEFAULT 'Particulier',
  sector TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. MOIS (KPIs Mensuels)
CREATE TABLE public.mois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  month_date DATE NOT NULL,
  ca_total DECIMAL(12,2) DEFAULT 0,
  objectif_ca DECIMAL(12,2) DEFAULT 0,
  nb_visites INTEGER DEFAULT 0,
  total_commissions DECIMAL(12,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, month_date)
);

-- =====================================================
-- INDEXES POUR PERFORMANCE
-- =====================================================
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX idx_contacts_stage ON public.contacts(pipeline_stage);
CREATE INDEX idx_contacts_urgency ON public.contacts(urgency_score DESC);
CREATE INDEX idx_properties_org ON public.properties(organization_id);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_activities_org ON public.activities(organization_id);
CREATE INDEX idx_activities_date ON public.activities(date DESC);
CREATE INDEX idx_deals_org ON public.deals(organization_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_comptes_org ON public.comptes(organization_id);
CREATE INDEX idx_mois_org ON public.mois(organization_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - SÉCURITÉ CRITIQUE
-- =====================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comptes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mois ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECURITY DEFINER FUNCTIONS
-- =====================================================

-- Fonction pour obtenir l'organization_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Fonction pour vérifier si un utilisateur a un rôle spécifique
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =====================================================
-- RLS POLICIES - ORGANIZATIONS
-- =====================================================
CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_org_id());

-- =====================================================
-- RLS POLICIES - PROFILES
-- =====================================================
CREATE POLICY "Users can view profiles in their org"
  ON public.profiles FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Allow profile creation during signup"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- =====================================================
-- RLS POLICIES - USER_ROLES
-- =====================================================
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Allow role creation during signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- RLS POLICIES - CONTACTS
-- =====================================================
CREATE POLICY "Users can view contacts in their org"
  ON public.contacts FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert contacts in their org"
  ON public.contacts FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update contacts in their org"
  ON public.contacts FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete contacts in their org"
  ON public.contacts FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- =====================================================
-- RLS POLICIES - PROPERTIES
-- =====================================================
CREATE POLICY "Users can view properties in their org"
  ON public.properties FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert properties in their org"
  ON public.properties FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update properties in their org"
  ON public.properties FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete properties in their org"
  ON public.properties FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- =====================================================
-- RLS POLICIES - ACTIVITIES
-- =====================================================
CREATE POLICY "Users can view activities in their org"
  ON public.activities FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert activities in their org"
  ON public.activities FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update activities in their org"
  ON public.activities FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete activities in their org"
  ON public.activities FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- =====================================================
-- RLS POLICIES - DEALS
-- =====================================================
CREATE POLICY "Users can view deals in their org"
  ON public.deals FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert deals in their org"
  ON public.deals FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update deals in their org"
  ON public.deals FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete deals in their org"
  ON public.deals FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- =====================================================
-- RLS POLICIES - COMPTES
-- =====================================================
CREATE POLICY "Users can view comptes in their org"
  ON public.comptes FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert comptes in their org"
  ON public.comptes FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update comptes in their org"
  ON public.comptes FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete comptes in their org"
  ON public.comptes FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- =====================================================
-- RLS POLICIES - MOIS
-- =====================================================
CREATE POLICY "Users can view mois in their org"
  ON public.mois FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert mois in their org"
  ON public.mois FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update mois in their org"
  ON public.mois FOR UPDATE
  USING (organization_id = public.get_user_org_id());

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comptes_updated_at
  BEFORE UPDATE ON public.comptes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();