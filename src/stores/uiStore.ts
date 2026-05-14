import { create } from 'zustand';

export type WizardStep =
  | 'connect'
  | 'upload'
  | 'analyze'
  | 'review'
  | 'approve'
  | 'generate'
  | 'logs';

const STEP_ORDER: WizardStep[] = [
  'connect',
  'upload',
  'analyze',
  'review',
  'approve',
  'generate',
  'logs',
];

interface UiStore {
  currentStep: WizardStep;
  sidebarCollapsed: boolean;

  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  toggleSidebar: () => void;
  stepIndex: () => number;
  steps: () => WizardStep[];
}

export const useUiStore = create<UiStore>((set, get) => ({
  currentStep: 'connect',
  sidebarCollapsed: false,

  setStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const idx = STEP_ORDER.indexOf(get().currentStep);
    if (idx < STEP_ORDER.length - 1) {
      set({ currentStep: STEP_ORDER[idx + 1] });
    }
  },

  prevStep: () => {
    const idx = STEP_ORDER.indexOf(get().currentStep);
    if (idx > 0) {
      set({ currentStep: STEP_ORDER[idx - 1] });
    }
  },

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  stepIndex: () => STEP_ORDER.indexOf(get().currentStep),
  steps: () => STEP_ORDER,
}));
