import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOnboardingGuard() {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user, organizationId, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (!organizationId) {
      navigate('/dashboard', { replace: true });
      return;
    }

    async function check() {
      const [orgResult, roleResult] = await Promise.all([
        supabase
          .from('organizations')
          .select('onboarding_completed')
          .eq('id', organizationId!)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id)
          .eq('organization_id', organizationId!)
          .single(),
      ]);

      const onboardingCompleted = orgResult.data?.onboarding_completed;
      const role = roleResult.data?.role;

      if (onboardingCompleted || role !== 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        setIsLoading(false);
      }
    }

    check();
  }, [authLoading, user, organizationId, navigate]);

  return { isLoading };
}
