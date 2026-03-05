import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgencyData, EmailConfigData, NotificationsData } from '@/types/wizard.types';

type StepKey = 'step1' | 'step2' | 'step3';

type StepDataMap = {
  step1: Partial<AgencyData>;
  step2: Partial<EmailConfigData>;
  step3: Partial<NotificationsData>;
};

interface WizardState {
  currentStep: 0 | 1 | 2 | 3;
  stepData: StepDataMap;
  isComplete: boolean;
  isStepValid: boolean;
  nextStep: () => void;
  prevStep: () => void;
  setStepData: <K extends StepKey>(step: K, data: Partial<StepDataMap[K]>) => void;
  setIsStepValid: (val: boolean) => void;
  markComplete: () => void;
  resetWizard: () => void;
}

const initialState = {
  currentStep: 0 as const,
  stepData: {
    step1: {},
    step2: {},
    step3: {},
  },
  isComplete: false,
  isStepValid: false,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      nextStep: () => {
        const current = get().currentStep;
        if (current < 3) {
          set({ currentStep: (current + 1) as 0 | 1 | 2 | 3 });
        }
      },

      prevStep: () => {
        const current = get().currentStep;
        if (current > 0) {
          set({ currentStep: (current - 1) as 0 | 1 | 2 | 3 });
        }
      },

      setStepData: <K extends StepKey>(step: K, data: Partial<StepDataMap[K]>) => {
        set((state) => ({
          stepData: {
            ...state.stepData,
            [step]: { ...state.stepData[step], ...data },
          },
        }));
      },

      setIsStepValid: (val: boolean) => set({ isStepValid: val }),

      markComplete: () => set({ isComplete: true }),

      resetWizard: () => set(initialState),
    }),
    {
      name: 'synapilot-wizard',
    }
  )
);
