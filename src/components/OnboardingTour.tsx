import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';

const tourSteps: Step[] = [
  {
    target: '.sidebar-dashboard',
    content: '👋 Bienvenue ! Voici votre Cockpit, votre vue d\'ensemble quotidienne avec les KPIs et activités récentes.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.sidebar-contacts',
    content: '📇 Gérez tous vos contacts et suivez leur progression dans le pipeline de vente.',
    placement: 'right',
  },
  {
    target: '.sidebar-deals',
    content: '💰 Visualisez vos opportunités en cours et leur valeur totale sur le Kanban.',
    placement: 'right',
  },
  {
    target: '.sidebar-properties',
    content: '🏠 Gérez votre portefeuille de biens immobiliers avec photos et détails.',
    placement: 'right',
  },
  {
    target: '.header-search',
    content: '🔍 Recherchez instantanément n\'importe quel contact, bien ou deal en temps réel.',
    placement: 'bottom',
  },
  {
    target: '.header-user-menu',
    content: '⚙️ Configurez votre compte et vos intégrations ici.',
    placement: 'bottom-end',
  },
  {
    target: 'body',
    content: '✨ Astuce Pro : Appuyez sur Cmd+K (ou Ctrl+K) pour ouvrir la recherche rapide !',
    placement: 'center',
  },
];

const joyrideStyles = {
  options: {
    arrowColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
    overlayColor: 'rgba(0, 0, 0, 0.75)',
    primaryColor: '#14b8a6',
    textColor: '#f4f4f5',
    spotlightShadow: '0 0 30px rgba(20, 184, 166, 0.3)',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: 16,
    padding: 20,
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  },
  tooltipContent: {
    fontSize: 14,
    lineHeight: 1.6,
  },
  buttonNext: {
    backgroundColor: '#14b8a6',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    padding: '10px 20px',
  },
  buttonBack: {
    color: '#a1a1aa',
    fontSize: 14,
    marginRight: 10,
  },
  buttonSkip: {
    color: '#71717a',
    fontSize: 13,
  },
  spotlight: {
    borderRadius: 12,
  },
  beaconInner: {
    backgroundColor: '#14b8a6',
  },
  beaconOuter: {
    backgroundColor: '#14b8a6',
    border: '2px solid #14b8a6',
  },
};

interface OnboardingTourProps {
  run?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ run = false, onComplete }: OnboardingTourProps) {
  const [isRunning, setIsRunning] = useState(run);

  useEffect(() => {
    setIsRunning(run);
  }, [run]);

  const handleCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setIsRunning(false);
      onComplete?.();
    }
  };

  return (
    <Joyride
      steps={tourSteps}
      run={isRunning}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      spotlightClicks
      disableOverlayClose
      callback={handleCallback}
      styles={joyrideStyles}
      locale={{
        back: 'Retour',
        close: 'Fermer',
        last: 'Terminer',
        next: 'Suivant',
        skip: 'Passer',
      }}
      floaterProps={{
        styles: {
          floater: {
            filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5))',
          },
        },
      }}
    />
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const STORAGE_KEY = 'synapilot_onboarding_completed';
  
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Auto-start tour for new users after a short delay
    if (!hasCompletedOnboarding) {
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding]);

  const completeTour = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasCompletedOnboarding(true);
    setShowTour(false);
  };

  const restartTour = () => {
    setShowTour(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHasCompletedOnboarding(false);
  };

  return {
    hasCompletedOnboarding,
    showTour,
    completeTour,
    restartTour,
    resetOnboarding,
  };
}
