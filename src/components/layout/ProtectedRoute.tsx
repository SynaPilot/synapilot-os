import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, useTrialDaysLeft } from '@/hooks/useSubscription';
import { DashboardLayout } from './DashboardLayout';
import { Loader2, AlertTriangle, CreditCard, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const EXEMPT_ROUTES = ['/billing', '/settings'];

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const location = useLocation();
  const trialDaysLeft = useTrialDaysLeft(subscription?.trial_ends_at ?? null);

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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isExemptRoute = EXEMPT_ROUTES.some((r) => location.pathname.startsWith(r));
  const status = subscription?.status;
  const isBlocked = (status === 'past_due' || status === 'canceled') && !isExemptRoute;
  const isTrial = status === 'trialing';

  return (
    <DashboardLayout>
      {/* Trial banner — non-blocking */}
      {isTrial && !subLoading && (
        <Alert className="mx-4 mt-4 border-yellow-500/50 bg-yellow-500/10 rounded-lg">
          <Clock className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            <span>
              Essai gratuit — <strong>{trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''}</strong> restant{trialDaysLeft > 1 ? 's' : ''}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
              onClick={() => { window.location.href = '/billing'; }}
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              Activer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Blocked modal — past_due or canceled on non-exempt routes */}
      {isBlocked && !subLoading && (
        <Dialog open modal>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <DialogTitle>Acces suspendu</DialogTitle>
              </div>
              <DialogDescription>
                {status === 'past_due'
                  ? 'Votre dernier paiement a echoue. Veuillez mettre a jour vos informations de paiement pour retrouver l\'acces.'
                  : 'Votre abonnement est annule. Reactivez-le pour acceder a SynaPilot.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => { window.location.href = '/billing'; }}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Gerer la facturation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {children}
    </DashboardLayout>
  );
}
