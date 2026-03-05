import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Building2, Mail, Bell, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWizardStore } from '@/store/wizardStore';

const STEPS = [
  { icon: Building2, label: 'Votre agence' },
  { icon: Mail, label: 'Email' },
  { icon: Bell, label: 'Notifications' },
  { icon: Zap, label: 'Activation' },
] as const;

interface WizardLayoutProps {
  children: ReactNode;
  isStepValid: boolean;
}

export function WizardLayout({ children, isStepValid }: WizardLayoutProps) {
  const { currentStep, nextStep, prevStep } = useWizardStore();
  const progressValue = (currentStep / 3) * 100;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[640px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
        {/* Stepper */}
        <div className="relative flex items-start justify-between mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;

            return (
              <div key={index} className="relative flex flex-col items-center flex-1">
                {/* Connecting line */}
                {index < STEPS.length - 1 && (
                  <div className="absolute top-5 left-1/2 w-full h-px bg-zinc-800 -z-0">
                    <motion.div
                      className="h-full bg-green-500 origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: isCompleted ? 1 : 0 }}
                      transition={{ duration: 0.4, ease: 'easeInOut' }}
                    />
                  </div>
                )}

                {/* Step circle */}
                <motion.div
                  className={[
                    'relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    isCompleted
                      ? 'bg-green-500'
                      : isActive
                        ? 'bg-violet-600 ring-2 ring-violet-500/50'
                        : 'bg-zinc-800',
                  ].join(' ')}
                  layout
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className="w-5 h-5 text-zinc-100" />
                  )}
                </motion.div>

                {/* Label */}
                <span
                  className={[
                    'mt-2 text-xs text-center',
                    isActive ? 'text-zinc-100' : 'text-zinc-500',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Progress
              value={progressValue}
              className="h-1.5 bg-zinc-800 [&>div]:bg-violet-600 [&>div]:transition-all [&>div]:duration-500"
            />
          </motion.div>
        </div>

        {/* Step content */}
        <div className="min-h-[320px]">{children}</div>

        {/* Navigation */}
        {currentStep < 3 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <div>
              {currentStep > 0 && currentStep < 3 && (
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  Précédent
                </Button>
              )}
            </div>
            <Button
              onClick={nextStep}
              disabled={!isStepValid}
              className="bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40"
            >
              Continuer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
