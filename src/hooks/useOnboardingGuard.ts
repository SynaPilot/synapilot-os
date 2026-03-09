import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOnboardingGuard() {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user, organizationId, userRole, loading: authLoading } = useAuth();

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

    if (userRole === null) return;

    async function check() {
      const { data } = await supabase
        .from('organizations')
        .select('onboarding_completed')
        .eq('id', organizationId!)
        .single();

      const onboardingCompleted = data?.onboarding_completed;

      if (onboardingCompleted === true || userRole !== 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        // Clear any stale wizard state persisted from a previous aborted session
        localStorage.removeItem('synapilot-wizard');
        setIsLoading(false);
      }
    }

    check();
  }, [authLoading, user, organizationId, userRole, navigate]);

  return { isLoading };
}
