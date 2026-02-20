import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Subscription {
  id: string;
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  seats: number;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { organizationId } = useAuth();

  return useQuery<Subscription | null>({
    queryKey: ['subscription', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error) {
        // Table may not exist yet or no row — graceful fallback
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return null;
        }
        throw error;
      }

      return data as Subscription;
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}

export function useTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
