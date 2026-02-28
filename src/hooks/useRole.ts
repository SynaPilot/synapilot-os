import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppRole = Database['public']['Enums']['app_role'];

export interface UseRoleReturn {
  role: AppRole | null;
  isAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  /** True for Admin or Manager — can manage contacts, properties, deals. */
  canManageTeam: boolean;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// useRole
// ---------------------------------------------------------------------------

/**
 * Fetches the current user's role from public.user_roles.
 *
 * Bypasses AuthContext's userRole which has a bug: it queries
 * user_roles.organization_id — a column that doesn't exist in the schema.
 * This hook queries user_roles directly by user_id (the correct FK).
 *
 * Role enum values (case-sensitive): 'Admin' | 'Manager' | 'Agent'
 */
export function useRole(): UseRoleReturn {
  const { user } = useAuth();

  const { data: role = null, isLoading } = useQuery<AppRole | null>({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        // Take the highest-privilege role if a user has multiple rows
        // (edge case during migrations). Admin > Manager > Agent.
        .order('role', { ascending: true })
        .maybeSingle();

      if (error) {
        console.error('[useRole] Failed to fetch user role:', error.message);
        return null;
      }

      return (data?.role as AppRole) ?? null;
    },
    enabled: !!user?.id,
    // Roles change rarely — cache for 10 minutes.
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    role,
    isAdmin: role === 'Admin',
    isManager: role === 'Manager',
    isAgent: role === 'Agent',
    canManageTeam: role === 'Admin' || role === 'Manager',
    isLoading,
  };
}
