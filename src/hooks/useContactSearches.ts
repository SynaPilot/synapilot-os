import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ContactSearch {
  id: string;
  contact_id: string;
  organization_id: string;
  budget_min: number | null;
  budget_max: number | null;
  min_surface: number | null;
  max_surface: number | null;
  min_rooms: number | null;
  max_rooms: number | null;
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  property_types: string[] | null;
  cities: string[] | null;
  postal_codes: string[] | null;
  transaction_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactSearchInsert {
  contact_id: string;
  budget_min?: number | null;
  budget_max?: number | null;
  min_surface?: number | null;
  max_surface?: number | null;
  min_rooms?: number | null;
  max_rooms?: number | null;
  min_bedrooms?: number | null;
  max_bedrooms?: number | null;
  property_types?: string[] | null;
  cities?: string[] | null;
  postal_codes?: string[] | null;
  transaction_type?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface ContactSearchUpdate extends Partial<ContactSearchInsert> {
  id: string;
}

interface UseContactSearchesOptions {
  filters?: Record<string, string | number | boolean | null>;
  onlyActive?: boolean;
}

export function useContactSearches(options?: UseContactSearchesOptions) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const filters = {
    ...options?.filters,
    ...(options?.onlyActive !== false && { is_active: true }),
  };

  const query = useOrgQuery<ContactSearch[]>('contact_searches' as any, {
    select: '*',
    filters,
    orderBy: { column: 'created_at', ascending: false },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ContactSearchInsert) => {
      if (!organizationId) throw new Error('Organisation non trouvée');

      const { data, error } = await supabase
        .from('contact_searches' as any)
        .insert([{ ...values, organization_id: organizationId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_searches', organizationId] });
      toast.success('Critères de recherche enregistrés');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: ContactSearchUpdate) => {
      if (!organizationId) throw new Error('Organisation non trouvée');

      const { data, error } = await supabase
        .from('contact_searches' as any)
        .update(values)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_searches', organizationId] });
      toast.success('Critères mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');

      const { error } = await supabase
        .from('contact_searches' as any)
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_searches', organizationId] });
      toast.success('Critères supprimés');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', { description: error.message });
    },
  });

  return {
    searches: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Hook to get searches with contact data for matching
export function useContactSearchesWithContacts() {
  const { organizationId } = useAuth();

  return useOrgQuery<(ContactSearch & { contact: { id: string; full_name: string; email: string | null; phone: string | null; role: string | null } })[]>(
    'contact_searches' as any,
    {
      select: '*, contact:contacts!contact_id(id, full_name, email, phone, role)',
      filters: { is_active: true },
      orderBy: { column: 'created_at', ascending: false },
    }
  );
}
