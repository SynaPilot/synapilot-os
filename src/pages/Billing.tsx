import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useSubscription, useTrialDaysLeft } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, AlertTriangle, CheckCircle2, Clock, XCircle, Loader2, Users, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const STATUS_CONFIG = {
  trialing: {
    label: 'Essai gratuit',
    variant: 'warning' as const,
    icon: Clock,
  },
  active: {
    label: 'Actif',
    variant: 'success' as const,
    icon: CheckCircle2,
  },
  past_due: {
    label: 'Paiement echoue',
    variant: 'destructive' as const,
    icon: AlertTriangle,
  },
  canceled: {
    label: 'Annule',
    variant: 'secondary' as const,
    icon: XCircle,
  },
  incomplete: {
    label: 'Incomplet',
    variant: 'secondary' as const,
    icon: Clock,
  },
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Essai gratuit',
  pilot: 'SynaPilot',
  standard: 'Standard',
};

export default function Billing() {
  const { organizationId } = useAuth();
  const { isAdmin } = useRole();
  const { data: subscription, isLoading } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const trialDaysLeft = useTrialDaysLeft(subscription?.trial_ends_at ?? null);

  const handlePortal = async () => {
    if (!organizationId) return;

    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { organization_id: organizationId },
      });

      if (error) {
        toast.error(error.message || 'Erreur lors de l\'ouverture du portail');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!organizationId) return;

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { organization_id: organizationId },
      });

      if (error) {
        toast.error(error.message || 'Erreur lors de la creation de la session');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <motion.div
        className="space-y-6 max-w-2xl"
        initial="initial"
        animate="animate"
        variants={pageVariants}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Facturation</h1>
          <p className="text-muted-foreground">Gerez votre abonnement SynaPilot</p>
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </motion.div>
    );
  }

  const status = subscription?.status || 'trialing';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.trialing;
  const StatusIcon = config.icon;

  return (
    <motion.div
      className="space-y-6 max-w-2xl"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Facturation</h1>
        <p className="text-muted-foreground">Gerez votre abonnement SynaPilot</p>
      </div>

      {/* ====== TRIAL BANNER ====== */}
      {status === 'trialing' && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <Clock className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">Essai gratuit</AlertTitle>
          <AlertDescription>
            Il vous reste <strong>{trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''}</strong> d'essai gratuit.
            Activez votre abonnement pour continuer a utiliser SynaPilot sans interruption.
          </AlertDescription>
        </Alert>
      )}

      {/* ====== PAST DUE ALERT ====== */}
      {status === 'past_due' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Paiement echoue</AlertTitle>
          <AlertDescription>
            Votre dernier paiement a echoue. Veuillez mettre a jour vos informations de paiement
            pour eviter une interruption de service.
          </AlertDescription>
        </Alert>
      )}

      {/* ====== CANCELED ALERT ====== */}
      {status === 'canceled' && (
        <Alert className="border-muted">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Abonnement annule</AlertTitle>
          <AlertDescription>
            Votre abonnement est annule. Vous avez un acces en lecture seule.
            Reactivez votre abonnement pour retrouver toutes les fonctionnalites.
          </AlertDescription>
        </Alert>
      )}

      {/* ====== SUBSCRIPTION CARD ====== */}
      <Card className="glass">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4 text-primary" />
            Abonnement
          </CardTitle>
          <CardDescription>Details de votre plan actuel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div className="space-y-1">
              <p className="text-sm font-medium">Statut</p>
              <div className="flex items-center gap-2">
                <StatusIcon className="w-4 h-4" />
                <Badge variant={config.variant}>{config.label}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div className="space-y-1">
              <p className="text-sm font-medium">Plan</p>
              <p className="text-sm text-muted-foreground">
                {PLAN_LABELS[subscription?.plan || 'trial'] || subscription?.plan}
              </p>
            </div>
          </div>

          {status === 'active' && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Sieges</p>
                    <p className="text-sm text-muted-foreground">{subscription?.seats || 1} utilisateur{(subscription?.seats || 1) > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              {subscription?.current_period_end && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Prochain renouvellement</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(subscription.current_period_end).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ====== PORTAL BUTTON (active subscribers) ====== */}
      {isAdmin && status === 'active' && (
        <Card className="glass">
          <CardContent className="pt-6">
            <Button
              onClick={handlePortal}
              disabled={portalLoading}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Gérer mon abonnement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ====== CTA BUTTON ====== */}
      {isAdmin && (status === 'trialing' || status === 'canceled' || status === 'past_due') && (
        <Card className="glass">
          <CardContent className="pt-6">
            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full"
              size="lg"
            >
              {checkoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              {status === 'trialing' && 'Activer SynaPilot'}
              {status === 'canceled' && 'Reactiver l\'abonnement'}
              {status === 'past_due' && 'Mettre a jour le paiement'}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isAdmin && (status === 'trialing' || status === 'canceled' || status === 'past_due') && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Action requise</AlertTitle>
          <AlertDescription>
            Contactez l'administrateur de votre organisation pour gerer l'abonnement.
          </AlertDescription>
        </Alert>
      )}
    </motion.div>
  );
}
