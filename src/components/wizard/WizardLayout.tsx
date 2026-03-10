import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Building2, Mail, Bell, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[640px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-8">

        {/* Stepper — vertical on mobile, horizontal on desktop */}
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-3 md:gap-0">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;

            return (
              <div
                key={index}
                className="relative flex flex-row items-center md:flex-col md:items-center flex-1 gap-3 md:gap-0"
              >
                {/* Connecting line — hidden on mobile */}
                {index < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-1/2 w-full h-px bg-zinc-800 -z-0">
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
                    'relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0',
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

                {/* Label — inline on mobile (row layout), centered below on desktop */}
                <span
                  className={[
                    'text-xs ml-2 md:ml-0 md:mt-2 md:text-center',
                    isActive ? 'text-zinc-100' : 'text-zinc-500',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[320px]">{children}</div>

        {/* Navigation — stacked vertically on mobile, horizontal on desktop */}
        {currentStep < 3 && (
          <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between mt-8 pt-6 border-t border-white/10">
            <div>
              {currentStep > 0 && currentStep < 3 && (
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  className="w-full md:w-auto text-zinc-400 hover:text-zinc-100"
                >
                  Précédent
                </Button>
              )}
            </div>
            <Button
              onClick={nextStep}
              disabled={!isStepValid}
              className="w-full md:w-auto bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
