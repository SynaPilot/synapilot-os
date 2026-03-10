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
      const { data, error } = await supabase
        .from('organizations')
        .select('onboarding_completed')
        .eq('id', organizationId!)
        .single();

      if (error) {
        // DB query failed — non-admins go to dashboard; admins see the wizard
        // (same routing outcome as when onboarding_completed is indeterminate)
        if (userRole !== 'admin') {
          navigate('/dashboard', { replace: true });
          return;
        }
        localStorage.removeItem('synapilot-wizard');
        setIsLoading(false);
        return;
      }

      if (data.onboarding_completed === true || userRole !== 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        localStorage.removeItem('synapilot-wizard');
        setIsLoading(false);
      }
    }

    check();
  }, [authLoading, user, organizationId, userRole, navigate]);

  return { isLoading };
}
