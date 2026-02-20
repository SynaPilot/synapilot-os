import { useAuth } from '@/contexts/AuthContext';

export function useRole() {
  const { userRole, profileId } = useAuth();

  return {
    role: userRole,
    isAdmin: userRole === 'admin',
    isManager: userRole === 'manager',
    isAgent: userRole === 'agent',
    canManageTeam: userRole === 'admin' || userRole === 'manager',
    profileId,
  };
}
