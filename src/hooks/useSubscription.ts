import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// useSubscription
// ---------------------------------------------------------------------------

/**
 * Fetch the subscription row for the current user's organization.
 * Returns null when the user is unauthenticated or no subscription row exists.
 */
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
        // PGRST116 = no rows found (trial not yet created, edge case)
        // 42P01    = table does not exist yet
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return null;
        }
        throw error;
      }

      return data as Subscription;
    },
    enabled: !!organizationId,
    // Cache for 5 minutes; webhook updates will invalidate via supabase realtime
    // or the user can force-refresh by focusing the window.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ---------------------------------------------------------------------------
// useTrialDaysLeft
// ---------------------------------------------------------------------------

/**
 * Returns the number of full days remaining in the trial period.
 * Returns 0 if trial_ends_at is null or the date has passed.
 */
export function useTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const msLeft = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// useIsSubscriptionActive
// ---------------------------------------------------------------------------

/**
 * Returns true when the org subscription allows full app access.
 * Returns true optimistically while loading to prevent UI flashes.
 */
export function useIsSubscriptionActive(): boolean {
  const { data: subscription, isLoading } = useSubscription();

  // Optimistic: assume active while loading to avoid blocking the UI.
  if (isLoading || !subscription) return true;

  return subscription.status === 'active' || subscription.status === 'trialing';
}
