import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Local type definitions for database tables
interface Profile {
  id: string;
  organization_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  organizationId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, orgName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cast supabase to any to bypass strict typing with empty database
const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
      };
    };
    insert: (data: Record<string, unknown>) => {
      select: () => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
  auth: typeof supabase.auth;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch organization ID when user changes
  useEffect(() => {
    async function fetchOrganizationId() {
      if (user) {
        const { data, error } = await db
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        
        if (data && !error) {
          setOrganizationId(data.organization_id as string);
        } else {
          console.error('Failed to fetch organization:', error);
          setOrganizationId(null);
        }
      } else {
        setOrganizationId(null);
      }
    }
    
    fetchOrganizationId();
  }, [user]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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
    const { data: orgData, error: orgError } = await db
      .from('organizations')
      .insert({ name: orgName, slug })
      .select()
      .single();

    if (orgError || !orgData) {
      return { error: new Error(`Erreur création agence: ${orgError?.message || 'Unknown error'}`) };
    }

    const orgId = orgData.id as string;

    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          organization_id: orgId
        }
      }
    });

    if (authError) {
      // Rollback org creation
      await db.from('organizations').delete().eq('id', orgId);
      return { error: authError };
    }

    if (authData.user) {
      // Create profile
      const { error: profileError } = await db
        .from('profiles')
        .insert({
          id: authData.user.id,
          organization_id: orgId,
          full_name: fullName
        })
        .select()
        .single();

      if (profileError) {
        return { error: new Error(`Erreur création profil: ${profileError.message}`) };
      }

      // Create user role (Admin for first user)
      const { error: roleError } = await db
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'Admin'
        })
        .select()
        .single();

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
    <AuthContext.Provider value={{ user, session, organizationId, loading, signIn, signUp, signOut }}>
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
