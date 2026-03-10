import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOnboardingGuard() {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user, organizationId, userRole, loading: authLoading } = useAuth();

  useEffect(() => {
  const t = performance.now().toFixed(1);
  console.log(`[Guard t=${t}ms] authLoading:`, authLoading, 'user:', !!user, 'orgId:', organizationId, 'role:', userRole);

  if (authLoading) return;

  if (!user) {
    console.log('[Guard] → /login (no user)');
    navigate('/login', { replace: true });
    return;
  }

  if (!organizationId) {
    console.log('[Guard] → /dashboard (no orgId)');
    navigate('/dashboard', { replace: true });
    return;
  }

  if (userRole === null) {
    console.log('[Guard] waiting for role...');
    return;
  }

  async function check() {
    const { data, error } = await supabase
      .from('organizations')
      .select('onboarding_completed')
      .eq('id', organizationId!)
      .single();

    console.log('[Guard] DB response:', data, 'error:', error);

    const onboardingCompleted = data?.onboarding_completed;

    if (onboardingCompleted === true || userRole !== 'admin') {
      console.log('[Guard] → /dashboard. onboarding_completed:', onboardingCompleted, 'role:', userRole);
      navigate('/dashboard', { replace: true });
    } else {
      console.log('[Guard] ✅ PASS — showing onboarding');
      localStorage.removeItem('synapilot-wizard');
      setIsLoading(false);
    }
  }

  check();
}, [authLoading, user, organizationId, userRole, navigate]);

  return { isLoading };
}
