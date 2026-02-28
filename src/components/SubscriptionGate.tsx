import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Routes that are never blocked, even when the subscription is canceled or
 * past_due — users must always be able to reach Billing to reactivate.
 */
const EXEMPT_PATHS = ['/billing'];

const SESSION_KEY = 'synapilot_past_due_banner_dismissed';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionGateProps {
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SubscriptionGate wraps authenticated routes and enforces billing status.
 *
 * Behavior by status:
 *   'active' | 'trialing' → render children normally (no extra UI)
 *   'past_due'            → dismissable top banner (non-blocking)
 *   'canceled'            → full-page blocking overlay (non-dismissable)
 *   loading / null        → render children as-is (avoid flash)
 *
 * The /billing route is always exempt so users can reactivate.
 *
 * NOTE: ProtectedRoute also has subscription-block logic (a modal dialog).
 * If SubscriptionGate is active, that logic in ProtectedRoute can be removed
 * to avoid duplicate UI.
 */
export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { data: subscription, isLoading } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();

  // Read dismissal state from sessionStorage so the banner stays gone for
  // the duration of the browser session, but reappears on the next visit.
  const [pastDueDismissed, setPastDueDismissed] = useState<boolean>(
    () => sessionStorage.getItem(SESSION_KEY) === 'true',
  );

  const dismissPastDueBanner = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setPastDueDismissed(true);
  };

  // Always allow access to billing so users can fix their subscription.
  const isExempt = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p));

  // Don't gate while loading — renders children directly to avoid a flash
  // where the app briefly looks locked before the subscription resolves.
  if (isLoading || !subscription || isExempt) {
    return <>{children}</>;
  }

  const { status } = subscription;

  // ── Canceled: full-page blocking overlay ──────────────────────────────────
  // Rendered on top of children (which remain in the DOM for SSR/a11y).
  // The overlay captures all pointer events, making it non-dismissable.
  if (status === 'canceled') {
    return (
      <>
        {/* Children stay in DOM; overlay blocks interaction visually. */}
        <div aria-hidden="true">{children}</div>

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-blocked-title"
          aria-describedby="subscription-blocked-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
        >
          <div className="mx-4 w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
            {/* Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h2
                id="subscription-blocked-title"
                className="text-2xl font-semibold text-foreground"
              >
                Abonnement suspendu
              </h2>
              <p
                id="subscription-blocked-desc"
                className="text-sm leading-relaxed text-muted-foreground"
              >
                Votre abonnement est suspendu. Rendez-vous dans{' '}
                <strong className="text-foreground">Facturation</strong> pour le
                réactiver.
              </p>
            </div>

            {/* CTA */}
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate('/billing')}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Gérer la facturation
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── Past due: dismissable top banner ──────────────────────────────────────
  // Non-blocking: the user can still navigate the app but sees a persistent
  // warning until they dismiss it for the session or fix their payment.
  if (status === 'past_due' && !pastDueDismissed) {
    return (
      <>
        {/* Fixed banner — sits above the DashboardLayout header. */}
        <div
          role="alert"
          className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between gap-4 border-b border-destructive/30 bg-destructive/10 px-4 py-3 backdrop-blur-sm"
        >
          <div className="flex min-w-0 items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="truncate text-sm text-foreground">
              <span className="font-semibold">Paiement échoué.</span>{' '}
              Mettez à jour votre moyen de paiement.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => navigate('/billing')}
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Mettre à jour
            </Button>
            <button
              onClick={dismissPastDueBanner}
              aria-label="Fermer le bandeau de paiement"
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/*
          Push the DashboardLayout down so the fixed banner doesn't overlap
          the app header. Height matches the banner (py-3 + text-sm ≈ 52px).
        */}
        <div className="pt-[52px]">{children}</div>
      </>
    );
  }

  // ── Active, trialing, incomplete, or dismissed past_due ───────────────────
  return <>{children}</>;
}
