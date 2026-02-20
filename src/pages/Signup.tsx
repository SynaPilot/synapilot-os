import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

// ==================== SCHEMAS ====================
const signupSchema = z.object({
  fullName: z.string().min(2, 'Minimum 2 caractères').max(100, 'Maximum 100 caractères'),
  agencyName: z.string().min(2, 'Minimum 2 caractères').max(100, 'Maximum 100 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  activationKey: z.string().optional(),
});

const inviteSchema = z.object({
  fullName: z.string().min(2, 'Minimum 2 caractères').max(100, 'Maximum 100 caractères'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  confirmPassword: z.string().min(6, 'Minimum 6 caractères'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupSchema>;
type InviteFormValues = z.infer<typeof inviteSchema>;

// BYPASS FLAG
const BYPASS_ACTIVATION_KEY = true;

// ==================== INVITE FLOW COMPONENT ====================
function InviteFlow() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [redirectToDashboard, setRedirectToDashboard] = useState(false);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { fullName: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    // Listen for the session from the invite link token exchange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setSessionReady(true);
      }
    });

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (redirectToDashboard) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleInviteSignup = async (values: InviteFormValues) => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Session invalide. Veuillez réutiliser le lien d\'invitation.',
        });
        setIsSubmitting(false);
        return;
      }

      const user = session.user;
      const orgId = user.user_metadata?.organization_id as string | undefined;
      const invitedRole = (user.user_metadata?.invited_role as AppRole) ?? 'agent';

      if (!orgId) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Organisation non trouvée dans l\'invitation.',
        });
        setIsSubmitting(false);
        return;
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: updateError.message,
        });
        setIsSubmitting(false);
        return;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          organization_id: orgId,
          full_name: values.fullName,
          email: user.email,
        });

      if (profileError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: `Erreur création profil: ${profileError.message}`,
        });
        setIsSubmitting(false);
        return;
      }

      // Check if user_role already exists before inserting
      const { count, error: countError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('organization_id', orgId);

      if (countError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: `Erreur vérification rôle: ${countError.message}`,
        });
        setIsSubmitting(false);
        return;
      }

      if ((count ?? 0) === 0) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            organization_id: orgId,
            role: invitedRole,
          });

        if (roleError) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: `Erreur attribution rôle: ${roleError.message}`,
          });
          setIsSubmitting(false);
          return;
        }
      }

      toast({
        title: 'Bienvenue !',
        description: 'Votre compte a été configuré avec succès.',
      });

      setRedirectToDashboard(true);
    } catch (error) {
      console.error('Invite signup error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Une erreur inattendue est survenue.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Validation de l'invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold">SynaPilot</CardTitle>
          <CardDescription>Finalisez votre compte</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleInviteSignup)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom Complet</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jean Dupont"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configuration...
                  </>
                ) : (
                  'Activer mon compte'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN SIGNUP COMPONENT ====================
export default function Signup() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Detect invite flow via URL hash
  const isInviteFlow = window.location.hash.includes('access_token=');

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      agencyName: '',
      email: '',
      password: '',
      activationKey: ''
    },
  });

  // If invite flow, render InviteFlow component
  if (isInviteFlow) {
    return <InviteFlow />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignup = async (values: SignupFormValues) => {
    setIsSubmitting(true);

    try {
      // Verify activation key (if bypass disabled)
      let activationKeyId: string | null = null;

      if (!BYPASS_ACTIVATION_KEY) {
        if (!values.activationKey) {
          toast({
            variant: 'destructive',
            title: 'Clé requise',
            description: 'Veuillez entrer une clé d\'activation.',
          });
          setIsSubmitting(false);
          return;
        }

        const { data: keyData, error: keyError } = await supabase
          .from('activation_keys')
          .select('id, is_used')
          .eq('key', values.activationKey.trim())
          .single();

        if (keyError || !keyData) {
          toast({
            variant: 'destructive',
            title: 'Clé invalide',
            description: 'Clé invalide ou déjà utilisée. Contactez le support Synapilot.',
          });
          setIsSubmitting(false);
          return;
        }

        if (keyData.is_used) {
          toast({
            variant: 'destructive',
            title: 'Clé déjà utilisée',
            description: 'Clé invalide ou déjà utilisée. Contactez le support Synapilot.',
          });
          setIsSubmitting(false);
          return;
        }

        activationKeyId = keyData.id;
      }

      // Generate slug and create organization
      const slug = values.agencyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: values.agencyName, slug })
        .select()
        .single();

      if (orgError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: `Erreur création agence: ${orgError.message}`,
        });
        setIsSubmitting(false);
        return;
      }

      // Create user via auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: values.fullName,
            organization_id: orgData.id
          }
        }
      });

      if (authError) {
        await supabase.from('organizations').delete().eq('id', orgData.id);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: authError.message === 'User already registered'
            ? 'Cet email est déjà utilisé'
            : authError.message,
        });
        setIsSubmitting(false);
        return;
      }

      if (!authData.user) {
        await supabase.from('organizations').delete().eq('id', orgData.id);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Erreur lors de la création du compte',
        });
        setIsSubmitting(false);
        return;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          organization_id: orgData.id,
          full_name: values.fullName,
          email: values.email
        });

      if (profileError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: `Erreur création profil: ${profileError.message}`,
        });
        setIsSubmitting(false);
        return;
      }

      // Create admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          organization_id: orgData.id,
          role: 'admin'
        });

      if (roleError) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: `Erreur attribution rôle: ${roleError.message}`,
        });
        setIsSubmitting(false);
        return;
      }

      // Mark activation key as used (if not bypassed)
      if (!BYPASS_ACTIVATION_KEY && activationKeyId) {
        await supabase
          .from('activation_keys')
          .update({
            is_used: true,
            used_by: authData.user.id,
            used_at: new Date().toISOString()
          })
          .eq('id', activationKeyId);
      }

      toast({
        title: 'Espace agence créé !',
        description: 'Bienvenue chez Synapilot.',
      });

    } catch (error) {
      console.error('Signup error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Une erreur inattendue est survenue.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold">SynaPilot</CardTitle>
          <CardDescription>Créez votre espace agence</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
              {/* Nom Complet */}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom Complet</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jean Dupont"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nom de l'Agence */}
              <FormField
                control={form.control}
                name="agencyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'Agence</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Immobilier Paris Centre"
                        autoComplete="organization"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="vous@agence.fr"
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Mot de passe */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Clé d'Activation */}
              <FormField
                control={form.control}
                name="activationKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Clé d'Activation
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="XXXX-XXXX-XXXX"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  'Créer mon espace agence'
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Déjà un compte ?{' '}
            <Link
              to="/login"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
