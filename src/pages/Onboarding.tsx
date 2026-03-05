import { useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { useWizardStore } from '@/store/wizardStore';
import { WizardLayout } from '@/components/wizard/WizardLayout';

const Step1AgencyInfo = lazy(() =>
  import('../components/wizard/Step1AgencyInfo').then((m) => ({ default: m.Step1AgencyInfo }))
);
const Step2EmailConfig = lazy(() =>
  import('../components/wizard/Step2EmailConfig').then((m) => ({ default: m.Step2EmailConfig }))
);
const Step3Notifications = lazy(() =>
  import('../components/wizard/Step3Notifications').then((m) => ({
    default: m.Step3Notifications,
  }))
);
const Step4Activation = lazy(() =>
  import('../components/wizard/Step4Activation').then((m) => ({
    default: m.Step4Activation,
  }))
);

function StepFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[320px]">
      <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
    </div>
  );
}

export default function Onboarding() {
  const { isLoading } = useOnboardingGuard();
  const currentStep = useWizardStore((s) => s.currentStep);
  const isStepValid = useWizardStore((s) => s.isStepValid);

  useEffect(() => {
    document.title = 'Configuration de votre agence — SynaPilot';
  }, []);

  useEffect(() => {
    if (currentStep > 0 && currentStep < 3) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "Votre configuration n'est pas terminée. Quitter ?";
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [currentStep]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <Step1AgencyInfo />;
      case 1:
        return <Step2EmailConfig />;
      case 2:
        return <Step3Notifications />;
      case 3:
        return <Step4Activation />;
    }
  };

  return (
    <WizardLayout isStepValid={isStepValid}>
      <Suspense fallback={<StepFallback />}>{renderStep()}</Suspense>
    </WizardLayout>
  );
}
