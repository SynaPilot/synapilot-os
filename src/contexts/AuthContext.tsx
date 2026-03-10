import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  organizationId: string | null;
  userRole: AppRole | null;
  profileId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, orgName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);

  // Fetch organization ID, profile ID and role when user changes
  useEffect(() => {
    setLoading(true);
    retryCountRef.current = 0;
    console.log(`[AUTH] useEffect([user]) fired. user=${user?.id ?? 'null'}, loading is currently=${loading}`);

    async function fetchOrganizationId() {
      if (user) {
        console.log(`[AUTH] fetchOrganizationId: user=${user.id}, querying profiles...`);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, organization_id')
          .eq('user_id', user.id)
          .single();

        console.log(`[AUTH] profiles response: data=${JSON.stringify(data)}, error=${JSON.stringify(error)}`);

        if (data && !error) {
          retryCountRef.current = 0;
          console.log(`[AUTH] Setting organizationId=${data.organization_id}, querying user_roles...`);
          setOrganizationId(data.organization_id);
          setProfileId(data.id);

          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('organization_id', data.organization_id)
            .single();

          console.log(`[AUTH] user_roles response: role=${roleData?.role ?? 'null'}`);
          setUserRole(roleData?.role ?? null);
          console.log(`[AUTH] ✅ setLoading(false) — orgId=${data.organization_id}, role=${roleData?.role}`);
          setLoading(false);
        } else {
          console.error('Failed to fetch organization:', error);
          if (retryCountRef.current === 0) {
            console.log(`[AUTH] profiles failed, scheduling retry in 1500ms...`);
            retryCountRef.current = 1;
            retryTimeoutRef.current = window.setTimeout(() => {
              retryTimeoutRef.current = null;
              fetchOrganizationId();
            }, 1500);
          } else {
            console.log(`[AUTH] ⚠️ retry also failed. setLoading(false) with null orgId.`);
            setOrganizationId(null);
            setProfileId(null);
            setUserRole(null);
            setLoading(false);
          }
        }
      } else {
        console.log(`[AUTH] user=null → setLoading(false) with null orgId. THIS IS THE DANGEROUS WINDOW.`);
        setOrganizationId(null);
        setProfileId(null);
        setUserRole(null);
        setLoading(false);
      }
    }

    fetchOrganizationId();

    return () => {
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [user]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, orgName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Generate slug from org name
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Create organization first
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, slug })
      .select()
      .single();

    if (orgError) {
      return { error: new Error(`Erreur création agence: ${orgError.message}`) };
    }

    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          organization_id: orgData.id
        }
      }
    });

    if (authError) {
      // Rollback org creation
      await supabase.from('organizations').delete().eq('id', orgData.id);
      return { error: authError };
    }

    if (authData.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          organization_id: orgData.id,
          full_name: fullName
        });

      if (profileError) {
        return { error: new Error(`Erreur création profil: ${profileError.message}`) };
      }

      // Create user role (Admin for first user)
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          organization_id: orgData.id,
          role: 'admin'
        });

      if (roleError) {
        return { error: new Error(`Erreur attribution rôle: ${roleError.message}`) };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, organizationId, userRole, profileId, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
