-- Fix RLS policies for signup flow
-- These policies allow new users to create their organization, profile, and role during signup

-- Drop existing restrictive policies if they exist and recreate them
DROP POLICY IF EXISTS "Allow authenticated users to create organizations" ON public.organizations;
DROP POLICY IF EXISTS "public_insert_organizations_for_signup" ON public.organizations;

-- Allow any authenticated user to create an organization (needed for signup)
CREATE POLICY "Allow authenticated users to create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Drop existing profile insert policy and recreate
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "public_insert_profiles_for_signup" ON public.profiles;

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Drop existing admin-only policy for user_roles INSERT and add signup-friendly one
DROP POLICY IF EXISTS "Admins can manage roles in their organization" ON public.user_roles;
DROP POLICY IF EXISTS "public_insert_roles_for_signup" ON public.user_roles;

-- Allow authenticated users to insert their own role (for signup - they can only set their own user_id)
CREATE POLICY "Users can insert their own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow admins to manage all roles in their organization (for admin management after signup)
CREATE POLICY "Admins can manage roles in their organization"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);