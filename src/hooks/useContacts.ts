import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Contact = Tables<'contacts'>;
export type ContactInsert = TablesInsert<'contacts'>;
export type ContactUpdate = TablesUpdate<'contacts'>;

interface UseContactsOptions {
  filters?: Record<string, string | number | boolean | null>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
}

export function useContacts(options?: UseContactsOptions) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  
  const queryKey = ['contacts', organizationId, options?.filters] as const;

  const query = useOrgQuery<Contact[]>('contacts', {
    select: '*',
    filters: options?.filters,
    orderBy: options?.orderBy ?? { column: 'created_at', ascending: false },
    limit: options?.limit,
  });

  const createMutation = useMutation({
    mutationFn: async (values: Omit<ContactInsert, 'organization_id'>) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('contacts')
        .insert([{ ...values, organization_id: organizationId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
      toast.success('Contact créé avec succès');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: ContactUpdate & { id: string }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('contacts')
        .update(values)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
      toast.success('Contact mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
      toast.success('Contact supprimé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', { description: error.message });
    },
  });

  const updatePipelineStageMutation = useMutation({
    mutationFn: async ({ id, pipeline_stage }: { id: string; pipeline_stage: string }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('contacts')
        .update({ pipeline_stage: pipeline_stage as Contact['pipeline_stage'] })
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
    },
    onError: (error) => {
      toast.error('Erreur lors du déplacement', { description: error.message });
    },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    updatePipelineStage: updatePipelineStageMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useContact(id: string | undefined) {
  const { organizationId } = useAuth();
  
  return useOrgQuery<Contact>('contacts', {
    select: '*',
    filters: id ? { id } : undefined,
    single: true,
  }, {
    enabled: !!id && !!organizationId,
  });
}
