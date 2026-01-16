import { useState } from 'react';
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

const signupSchema = z.object({
  fullName: z.string().min(2, 'Minimum 2 caractères').max(100, 'Maximum 100 caractères'),
  agencyName: z.string().min(2, 'Minimum 2 caractères').max(100, 'Maximum 100 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  activationKey: z.string().optional(),
});

type SignupFormValues = z.infer<typeof signupSchema>;

// BYPASS FLAG - À SUPPRIMER EN PRODUCTION
const BYPASS_ACTIVATION_KEY = true;

export default function Signup() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignup = async (values: SignupFormValues) => {
    setIsSubmitting(true);

    try {
      // ÉTAPE A: Vérifier la clé d'activation (si bypass désactivé)
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

      // ÉTAPE C: Générer le slug et créer l'organisation
      const slug = values.agencyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Créer l'organisation
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

      // Créer l'utilisateur via auth
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
        // Rollback: supprimer l'organisation créée
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

      // ÉTAPE D: Créer le profil
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

      // Créer le rôle admin
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

      // Marquer la clé comme utilisée (si pas en bypass)
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

      // La redirection sera automatique via le AuthContext

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
