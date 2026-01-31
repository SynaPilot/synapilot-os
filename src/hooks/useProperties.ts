import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;
export type PropertyInsert = TablesInsert<'properties'>;
export type PropertyUpdate = TablesUpdate<'properties'>;

interface UsePropertiesOptions {
  filters?: Record<string, string | number | boolean | null>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
}

export function useProperties(options?: UsePropertiesOptions) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  
  const queryKey = ['properties', organizationId, options?.filters] as const;

  const query = useOrgQuery<Property[]>('properties', {
    select: '*',
    filters: options?.filters,
    orderBy: options?.orderBy ?? { column: 'created_at', ascending: false },
    limit: options?.limit,
  });

  const createMutation = useMutation({
    mutationFn: async (values: Omit<PropertyInsert, 'organization_id'>) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('properties')
        .insert([{ ...values, organization_id: organizationId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', organizationId] });
      toast.success('Bien créé avec succès', {
        style: {
          background: 'linear-gradient(135deg, rgba(75, 139, 255, 0.9), rgba(124, 58, 237, 0.9))',
          border: 'none',
          color: 'white',
        }
      });
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: PropertyUpdate & { id: string }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { data, error } = await supabase
        .from('properties')
        .update(values)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', organizationId] });
      toast.success('Bien mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', organizationId] });
      toast.success('Bien supprimé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', { description: error.message });
    },
  });

  return {
    properties: query.data ?? [],
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

export function useProperty(id: string | undefined) {
  const { organizationId } = useAuth();
  
  return useOrgQuery<Property>('properties', {
    select: '*',
    filters: id ? { id } : undefined,
    single: true,
  }, {
    enabled: !!id && !!organizationId,
  });
}
