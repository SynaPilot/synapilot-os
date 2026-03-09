import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  BarChart2,
  Check,
  CheckCircle,
  Flame,
  Loader2,
  RefreshCw,
  Share2,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useWizardStore } from '@/store/wizardStore';
import type { N8NProvisioningResponse } from '@/types/wizard.types';

// ─── Workflow items ───────────────────────────────────────────────────────────
const WORKFLOWS = [
  { label: 'Qualification Lead automatique', Icon: Zap },
  { label: 'Relance post-visite', Icon: RefreshCw },
  { label: 'Alerte directeur pipeline', Icon: AlertTriangle },
  { label: 'Rapport hebdomadaire', Icon: BarChart2 },
  { label: 'Diffusion mandats multi-portails', Icon: Share2 },
  { label: 'Smart Matching acquéreurs', Icon: Target },
  { label: 'Onboarding nouveaux agents', Icon: Users },
  { label: 'Réactivation leads froids', Icon: Flame },
] as const;

// ─── State machine ────────────────────────────────────────────────────────────
type Phase = 'idle' | 'animating' | 'waiting_n8n' | 'success' | 'error';

interface ActivationState {
  phase: Phase;
  activatedCount: number;            // 0-8 items fully done
  pendingN8nSuccess: boolean | null; // N8N resolved before animation finished
}

type ActivationAction =
  | { type: 'START' }
  | { type: 'ITEM_ACTIVATED' }
  | { type: 'N8N_RESOLVED'; success: boolean }
  | { type: 'RETRY' };

function activationReducer(
  state: ActivationState,
  action: ActivationAction,
): ActivationState {
  switch (action.type) {
    case 'START':
      if (state.phase !== 'idle') return state;
      return { ...state, phase: 'animating' };

    case 'ITEM_ACTIVATED': {
      const newCount = state.activatedCount + 1;
      if (newCount < 8) return { ...state, activatedCount: newCount };
      // All 8 activated — resolve immediately if N8N already responded
      if (state.pendingN8nSuccess !== null) {
        return {
          phase: state.pendingN8nSuccess ? 'success' : 'error',
          activatedCount: 8,
          pendingN8nSuccess: null,
        };
      }
      return { ...state, activatedCount: 8, phase: 'waiting_n8n' };
    }

    case 'N8N_RESOLVED': {
      if (state.phase === 'animating') {
        // Store it — consumed when the last item activates
        return { ...state, pendingN8nSuccess: action.success };
      }
      if (state.phase === 'waiting_n8n' || state.phase === 'error') {
        return {
          ...state,
          phase: action.success ? 'success' : 'error',
          pendingN8nSuccess: null,
        };
      }
      return state;
    }

    case 'RETRY':
      if (state.phase !== 'error') return state;
      return { ...state, phase: 'waiting_n8n', pendingN8nSuccess: null };

    default:
      return state;
  }
}

const INITIAL_STATE: ActivationState = {
  phase: 'idle',
  activatedCount: 0,
  pendingN8nSuccess: null,
};

// ─── Framer Motion variants ───────────────────────────────────────────────────
const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const cardEntryVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function Step4Activation() {
  const navigate = useNavigate();
  const { stepData, markComplete } = useWizardStore();
  const [state, dispatch] = useReducer(activationReducer, INITIAL_STATE);
  const { phase, activatedCount } = state;

  // Index of the card currently playing its pulse animation (visual only, not in reducer)
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);

  // Screen reader announcement
  const [announcement, setAnnouncement] = useState('');

  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const confettiFiredRef = useRef(false);
  const hasCalledEdgeFunction = useRef(false);

  // ── Cleanup all timers on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(window.clearTimeout);
    };
  }, []);

  // ── N8N call (used on mount and on retry) ─────────────────────────────────
  const callN8N = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      if (profileError || !profile || !mountedRef.current) return;

      const { data: agentProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('organization_id', profile.organization_id);
      if (!mountedRef.current) return;

      const agentEmails = (agentProfiles ?? [])
        .map((p) => p.email)
        .filter((e): e is string => Boolean(e));

      const payload = {
        action: 'provision_org',
        organization_id: profile.organization_id,
        org_name: stepData.step1.org_name ?? '',
        smtp_host: stepData.step2.smtp_host ?? '',
        smtp_port: stepData.step2.smtp_port ?? 587,
        smtp_user: stepData.step2.smtp_user ?? '',
        smtp_password: stepData.step2.smtp_password ?? '',
        director_email: stepData.step3.director_email ?? '',
        whatsapp_number: stepData.step3.whatsapp_number ?? null,
        agent_emails: agentEmails,
        agent_count: stepData.step1.agent_count ?? 1,
      };

      // Race the invoke against a 20-second timeout
      const { data, error } = await Promise.race([
        supabase.functions.invoke('trigger-n8n-provisioning', { body: payload }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('N8N timeout after 20s')), 20_000),
        ),
      ]);

      if (!mountedRef.current) return;

      if (error) {
        dispatch({ type: 'N8N_RESOLVED', success: false });
        return;
      }

      const result = data as N8NProvisioningResponse | null;
      dispatch({ type: 'N8N_RESOLVED', success: result?.success === true });
    } catch {
      if (mountedRef.current) {
        dispatch({ type: 'N8N_RESOLVED', success: false });
      }
    }
  }, [stepData]);

  // ── Activation: user-triggered, fires once per session ────────────────────
  const startActivation = useCallback(() => {
    if (hasCalledEdgeFunction.current) return;
    hasCalledEdgeFunction.current = true;

    dispatch({ type: 'START' });

    for (let i = 0; i < 8; i++) {
      const activateId = window.setTimeout(() => {
        if (!mountedRef.current) return;
        dispatch({ type: 'ITEM_ACTIVATED' });
        setPulsingIndex(i);
        setAnnouncement(`Workflow ${WORKFLOWS[i].label} activé`);
        const clearId = window.setTimeout(() => {
          if (mountedRef.current) setPulsingIndex(null);
        }, 400);
        timersRef.current.push(clearId);
      }, 600 + i * 700);
      timersRef.current.push(activateId);
    }

    const n8nId = window.setTimeout(() => {
      if (mountedRef.current) callN8N();
    }, 600);
    timersRef.current.push(n8nId);
  }, [callN8N]);

  // ── Announce phase transitions to screen readers ───────────────────────────
  useEffect(() => {
    if (phase === 'success') {
      setAnnouncement('Votre agence est opérationnelle. 8 workflows activés.');
    } else if (phase === 'error') {
      setAnnouncement('Erreur de connexion. Veuillez réessayer.');
    }
  }, [phase]);

  // ── Confetti fires once on success ────────────────────────────────────────
  useEffect(() => {
    if (phase === 'success' && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#7c3aed', '#6d28d9', '#4f46e5', '#10b981', '#ffffff'],
      });
    }
  }, [phase]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    dispatch({ type: 'RETRY' });
    callN8N();
  }, [callN8N]);

  const handleNavigateDashboard = useCallback(() => {
    markComplete();
    navigate('/dashboard');
  }, [markComplete, navigate]);

  const progressPercent = (activatedCount / 8) * 100;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full py-8">
      {/* Accessible live region for screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="max-w-lg mx-auto space-y-6">

        {/* Title — changes on success */}
        <AnimatePresence mode="wait">
          {phase === 'success' ? (
            <motion.div
              key="title-success"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-1"
            >
              <h2 className="text-xl font-semibold text-zinc-100">
                ✅ Votre agence est opérationnelle
              </h2>
              <p className="text-sm text-zinc-400">
                8 workflows activés · Système opérationnel 24h/24
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="title-activating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="text-xl font-semibold text-zinc-100">
                Activation de votre système...
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-1"
        >
          <Progress
            value={progressPercent}
            className="h-1.5 bg-zinc-800 [&>div]:bg-violet-500"
          />
          <p className="text-xs text-zinc-500 text-right">
            {activatedCount} / 8 workflows
          </p>
        </motion.div>

        {/* Workflow cards with stagger entry */}
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {WORKFLOWS.map(({ label, Icon }, index) => {
            const isDone = index < activatedCount;
            const isPulsing = pulsingIndex === index;

            return (
              <motion.div key={label} variants={cardEntryVariants}>
                {/*
                 * Inner motion.div controls:
                 *   - borderLeftColor: zinc-700 → violet-500
                 *   - backgroundColor: white/5 → pulse violet/20 → settle violet/10
                 *   - scale: ring pulse 1 → 1.05 → 1
                 *   - boxShadow: none → violet glow
                 */}
                <motion.div
                  animate={{
                    borderLeftColor: isDone ? '#8b5cf6' : '#3f3f46',
                    backgroundColor: isPulsing
                      ? [
                          'rgba(255,255,255,0.05)',
                          'rgba(139,92,246,0.20)',
                          'rgba(139,92,246,0.10)',
                        ]
                      : isDone
                        ? 'rgba(139,92,246,0.10)'
                        : 'rgba(255,255,255,0.05)',
                    scale: isPulsing ? [1, 1.05, 1] : 1,
                    boxShadow: isDone
                      ? '0 0 12px rgba(139,92,246,0.3)'
                      : '0 0 0px rgba(0,0,0,0)',
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="border-l-2 rounded-lg px-4 py-3 flex items-center gap-3 backdrop-blur"
                >
                  {/* Workflow icon */}
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors duration-300 ${
                      isDone ? 'text-violet-400' : 'text-zinc-500'
                    }`}
                  />

                  {/* Workflow name */}
                  <span
                    className={`text-sm font-medium flex-1 transition-colors duration-300 ${
                      isDone ? 'text-zinc-100' : 'text-zinc-400'
                    }`}
                  >
                    {label}
                  </span>

                  {/* Status badge */}
                  <AnimatePresence mode="wait">
                    {isDone ? (
                      <motion.span
                        key="done"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-1 text-xs text-green-400 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Activé
                      </motion.span>
                    ) : (
                      <motion.span
                        key="pending"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 text-xs text-zinc-500 shrink-0"
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        En attente
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Activation CTA — shown only in idle state, explicit user trigger */}
        <AnimatePresence>
          {phase === 'idle' && (
            <motion.div
              key="activate-cta"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                onClick={startActivation}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium h-11"
              >
                Activer mes 8 workflows →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* "Finalisation..." pulsing text while waiting for N8N */}
        <AnimatePresence>
          {phase === 'waiting_n8n' && (
            <motion.p
              key="finalisation"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-sm text-zinc-400 text-center"
            >
              Finalisation...
            </motion.p>
          )}
        </AnimatePresence>

        {/* Success: large checkmark + CTA */}
        <AnimatePresence>
          {phase === 'success' && (
            <motion.div
              key="success-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center"
                >
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </motion.div>
              </div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              >
                <Button
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium h-11"
                  onClick={handleNavigateDashboard}
                >
                  Accéder au Dashboard →
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error: red banner + retry / continue */}
        <AnimatePresence>
          {phase === 'error' && (
            <motion.div
              key="error-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">
                  Connexion au moteur d'automation échouée. Vos paramètres sont sauvegardés.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
                  onClick={handleRetry}
                >
                  Réessayer
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-600 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  onClick={handleNavigateDashboard}
                >
                  Continuer quand même
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
