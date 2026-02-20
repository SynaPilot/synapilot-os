import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
  properties?: { address: string; type?: string } | null;
};
export type ActivityInsert = TablesInsert<'activities'>;
export type ActivityUpdate = TablesUpdate<'activities'>;

interface UseActivitiesOptions {
  filters?: Record<string, string | number | boolean | null>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  withRelations?: boolean;
}

export function useActivities(options?: UseActivitiesOptions) {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  
  const selectQuery = options?.withRelations !== false 
    ? '*, contacts:contact_id(full_name), properties:property_id(address, type)'
    : '*';

  const query = useOrgQuery<Activity[]>('activities', {
    select: selectQuery,
    filters: options?.filters,
    orderBy: options?.orderBy ?? { column: 'date', ascending: false },
    limit: options?.limit,
  });

  const createMutation = useMutation({
    mutationFn: async (values: Omit<ActivityInsert, 'organization_id'>) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('activities')
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities', organizationId] });
      const isAI = variables.ai_generated;
      toast.success(isAI ? '✅ Activité IA créée avec succès ✨' : '✅ Activité créée avec succès');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: ActivityUpdate & { id: string }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('activities')
        .update(values)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', organizationId] });
      toast.success('Activité mise à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour', { description: error.message });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('activities')
        .update({ status: 'termine' })
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', organizationId] });
      toast.success('✅ Activité terminée');
    },
    onError: (error) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', organizationId] });
      toast.success('Activité supprimée');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', { description: error.message });
    },
  });

  // Computed stats
  const todoCount = query.data?.filter((a) => a.status === 'planifie').length ?? 0;
  const completedToday = query.data?.filter((a) => {
    const today = new Date().toDateString();
    return a.status === 'termine' && a.date && new Date(a.date).toDateString() === today;
  }).length ?? 0;

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    complete: completeMutation.mutate,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isCompleting: completeMutation.isPending,
    isDeleting: deleteMutation.isPending,
    // Stats
    todoCount,
    completedToday,
  };
}

export function useActivity(id: string | undefined) {
  const { organizationId } = useAuth();
  
  return useOrgQuery<Activity>('activities', {
    select: '*, contacts:contact_id(full_name), properties:property_id(address, type)',
    filters: id ? { id } : undefined,
    single: true,
  }, {
    enabled: !!id && !!organizationId,
  });
}
