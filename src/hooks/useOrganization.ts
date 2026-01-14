import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Cast supabase to any to bypass strict typing with empty database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useOrganization() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['organization', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) return null;

      const { data: org, error: orgError } = await db
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;

      return org;
    },
    enabled: !!user,
  });
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await db
        .from('profiles')
        .select('*, user_roles(role)')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
