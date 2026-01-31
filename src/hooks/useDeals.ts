import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Deal = Tables<'deals'> & {
  contacts?: { full_name: string } | null;
  properties?: { address: string; title?: string } | null;
};
export type DealInsert = TablesInsert<'deals'>;
export type DealUpdate = TablesUpdate<'deals'>;

interface UseDealsOptions {
  filters?: Record<string, string | number | boolean | null>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  withRelations?: boolean;
}

export function useDeals(options?: UseDealsOptions) {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  
  const selectQuery = options?.withRelations !== false 
    ? '*, contacts:contact_id(full_name), properties:property_id(address, title)'
    : '*';

  const query = useOrgQuery<Deal[]>('deals', {
    select: selectQuery,
    filters: options?.filters,
    orderBy: options?.orderBy ?? { column: 'created_at', ascending: false },
    limit: options?.limit,
  });

  const createMutation = useMutation({
    mutationFn: async (values: Omit<DealInsert, 'organization_id'>) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('deals')
        .insert([{ 
          ...values, 
          organization_id: organizationId,
          assigned_to: values.assigned_to ?? user?.id ?? null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
      toast.success('Affaire créée avec succès');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: DealUpdate & { id: string }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('deals')
        .update(values)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
      toast.success('Affaire mise à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour', { description: error.message });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('deals')
        .update({ stage: stage as Deal['stage'] })
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
    },
    onError: (error) => {
      toast.error('Erreur lors du déplacement', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
      toast.success('Affaire supprimée');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', { description: error.message });
    },
  });

  // Computed stats
  const totalValue = query.data?.reduce((sum, deal) => sum + (deal.amount || 0), 0) ?? 0;
  const wonDeals = query.data?.filter((d) => d.stage === 'vendu').length ?? 0;
  const activeDeals = query.data?.filter((d) => !['vendu', 'perdu'].includes(d.stage || '')).length ?? 0;

  return {
    deals: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    updateStage: updateStageMutation.mutate,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    // Stats
    totalValue,
    wonDeals,
    activeDeals,
  };
}

export function useDeal(id: string | undefined) {
  const { organizationId } = useAuth();
  
  return useOrgQuery<Deal>('deals', {
    select: '*, contacts:contact_id(full_name), properties:property_id(address, title)',
    filters: id ? { id } : undefined,
    single: true,
  }, {
    enabled: !!id && !!organizationId,
  });
}
