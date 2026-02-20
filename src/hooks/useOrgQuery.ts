import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TableNames = keyof Database['public']['Tables'];

interface OrgQueryOptions {
  select?: string;
  filters?: Record<string, string | number | boolean | null>;
  single?: boolean;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  skipOrgFilter?: boolean;
}

/**
 * Organization-aware query hook that automatically filters by organization_id
 * Prevents cross-organization data leaks
 */
export function useOrgQuery<T = unknown>(
  table: TableNames,
  options?: OrgQueryOptions,
  queryOptions?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  const { organizationId } = useAuth();

  return useQuery<T, Error>({
    queryKey: [table, organizationId, options?.filters, options?.select],
    queryFn: async (): Promise<T> => {
      if (!organizationId && !options?.skipOrgFilter) {
        throw new Error('Organisation non trouvée');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from(table).select(options?.select || '*');
      
      // Apply organization filter
      if (!options?.skipOrgFilter && table !== 'profiles' && table !== 'organizations') {
        query = query.eq('organization_id', organizationId);
      }

      // Apply additional filters
      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }

      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true
        });
      }

      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      // Execute query
      const result = options?.single 
        ? await query.single()
        : await query;

      if (result.error) {
        // Handle RLS 403 errors specifically
        if (result.error.code === '42501' || result.error.message?.includes('permission') || result.error.message?.includes('policy')) {
          toast.error('Accès refusé', {
            description: 'Vous n\'avez pas accès à ces données.'
          });
        }
        throw result.error;
      }

      return result.data as T;
    },
    enabled: (!!organizationId || !!options?.skipOrgFilter) && queryOptions?.enabled !== false,
    ...queryOptions
  });
}

/**
 * Hook to get the current organization ID for use in mutations
 */
export function useOrganizationId(): string | null {
  const { organizationId } = useAuth();
  return organizationId;
}
