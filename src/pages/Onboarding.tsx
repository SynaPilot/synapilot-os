import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { useWizardStore } from '@/store/wizardStore';
import { WizardLayout } from '@/components/wizard/WizardLayout';

function StepPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[320px]">
      <p className="text-zinc-500 text-sm">{name}</p>
    </div>
  );
}

const stepComponents = [
  <StepPlaceholder key="step1" name="Step1AgencyInfo" />,
  <StepPlaceholder key="step2" name="Step2EmailConfig" />,
  <StepPlaceholder key="step3" name="Step3Notifications" />,
  <StepPlaceholder key="step4" name="Step4Activation" />,
];

export default function Onboarding() {
  const { isLoading } = useOnboardingGuard();
  const currentStep = useWizardStore((s) => s.currentStep);

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

  return (
    <WizardLayout isStepValid={true}>
      {stepComponents[currentStep]}
    </WizardLayout>
  );
}
