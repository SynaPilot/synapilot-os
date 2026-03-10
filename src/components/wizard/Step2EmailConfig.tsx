import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Settings2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useWizardStore } from '@/store/wizardStore';
import { supabase } from '@/integrations/supabase/client';

const schema = z.object({
  smtp_host: z.string().min(1, 'Hôte SMTP requis'),
  smtp_port: z
    .number({ invalid_type_error: 'Port requis' })
    .int()
    .min(1)
    .max(65535),
  smtp_user: z.string().email('Email invalide'),
  smtp_password: z.string().min(1, 'Mot de passe requis'),
});

type FormData = z.infer<typeof schema>;
type TestStatus = 'idle' | 'loading' | 'success' | 'error';
type Preset = 'gmail' | 'outlook' | 'custom';

const PRESETS: Record<Exclude<Preset, 'custom'>, { host: string; port: number }> = {
  gmail:   { host: 'smtp.gmail.com',       port: 587 },
  outlook: { host: 'smtp.office365.com',   port: 587 },
};

// Maps raw SMTP error strings to human-readable French messages
function mapTestError(raw: string): string {
  const s = raw.toLowerCase();
  if (
    s.includes('auth') || s.includes('credential') ||
    s.includes('535')  || s.includes('534')         ||
    s.includes('invalid login') || s.includes('password') ||
    s.includes('username')
  ) {
    return 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
  }
  if (
    s.includes('timeout')    || s.includes('timed out') ||
    s.includes('enotfound')  || s.includes('econnrefused') ||
    s.includes('getaddrinfo')
  ) {
    return 'Le serveur ne répond pas. Vérifiez votre hôte SMTP ou réessayez.';
  }
  return 'Connexion échouée. Vérifiez vos paramètres.';
}

export function Step2EmailConfig({ className }: { className?: string }) {
  const { stepData, setStepData, setIsStepValid } = useWizardStore();

  // Restore active preset from previously stored host value
  const [preset, setPreset] = useState<Preset>(() => {
    const host = stepData.step2.smtp_host;
    if (host === PRESETS.gmail.host)   return 'gmail';
    if (host === PRESETS.outlook.host) return 'outlook';
    return 'custom';
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');
  const [testPassed, setTestPassed] = useState(stepData.step2.test_passed ?? false);
  const isFirstRender = useRef(true);

  const {
    register,
    watch,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      smtp_host:     stepData.step2.smtp_host     ?? '',
      smtp_port:     stepData.step2.smtp_port     ?? 587,
      smtp_user:     stepData.step2.smtp_user     ?? '',
      smtp_password: stepData.step2.smtp_password ?? '',
    },
  });

  const watched = watch();

  const allFilled =
    (watched.smtp_host?.length     ?? 0) > 0 &&
    (watched.smtp_user?.length     ?? 0) > 0 &&
    (watched.smtp_password?.length ?? 0) > 0;

  const isValid = allFilled && testPassed;

  useEffect(() => {
    setIsStepValid(isValid);
  }, [isValid, setIsStepValid]);

  // Sync form values → wizard store
  useEffect(() => {
    setStepData('step2', {
      smtp_host:     watched.smtp_host,
      smtp_port:     watched.smtp_port,
      smtp_user:     watched.smtp_user,
      smtp_password: watched.smtp_password,
    });
  }, [watched.smtp_host, watched.smtp_port, watched.smtp_user, watched.smtp_password, setStepData]);

  // Invalidate test result whenever any credential field changes (skip first mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setTestPassed(false);
    setTestStatus('idle');
    setStepData('step2', { test_passed: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.smtp_host, watched.smtp_port, watched.smtp_user, watched.smtp_password]);

  // Apply a provider preset (auto-fills host + port, resets test)
  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      setValue('smtp_host', PRESETS[p].host, { shouldValidate: true });
      setValue('smtp_port', PRESETS[p].port, { shouldValidate: true });
    }
    setTestPassed(false);
    setTestStatus('idle');
    setStepData('step2', { test_passed: false });
  };

  const handleTest = async () => {
    const valid = await trigger();
    if (!valid) return;

    setTestStatus('loading');
    setTestError('');

    const values = getValues();

    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke('test-smtp', {
          body: {
            host:     values.smtp_host,
            port:     values.smtp_port,
            user:     values.smtp_user,
            password: values.smtp_password,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15_000)
        ),
      ]);

      if (error || data?.success === false) {
        const raw = data?.error ?? error?.message ?? 'Connexion échouée';
        setTestStatus('error');
        setTestError(mapTestError(raw));
        setTestPassed(false);
        setStepData('step2', { test_passed: false });
      } else {
        setTestStatus('success');
        setTestPassed(true);
        setStepData('step2', { test_passed: true });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Connexion échouée';
      setTestStatus('error');
      setTestError(mapTestError(raw));
      setTestPassed(false);
      setStepData('step2', { test_passed: false });
    }
  };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Configuration email</h2>
      <div className="flex items-center gap-1.5 mb-6">
        <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <p className="text-zinc-400 text-sm">
          Vos identifiants sont chiffrés avant d'être stockés.
        </p>
      </div>

      <div className="space-y-5">

        {/* ── Provider selector ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-zinc-400 text-sm">Votre messagerie professionnelle</p>
          <div className="grid grid-cols-3 gap-2">
            {(['gmail', 'outlook', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={[
                  'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 border text-sm font-medium transition-all',
                  preset === p
                    ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200',
                ].join(' ')}
              >
                {p === 'gmail'   && <span className="font-bold text-base leading-none">G</span>}
                {p === 'outlook' && <span className="font-bold text-base leading-none">O</span>}
                {p === 'custom'  && <Settings2 className="w-4 h-4" />}
                <span>
                  {p === 'gmail' ? 'Gmail' : p === 'outlook' ? 'Outlook' : 'Autre'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Configuration avancée notice (custom only) ────────────────────── */}
        <AnimatePresence>
          {preset === 'custom' && (
            <motion.div
              key="custom-notice"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 rounded-lg bg-zinc-800/60 border border-white/5 px-3 py-2.5"
            >
              <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                <span className="text-zinc-400 font-medium">Configuration avancée</span>
                {' '}— Pour les autres messageries professionnelles (OVH, Ionos, etc.)
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── smtp_host — hidden for Gmail / Outlook presets ────────────────── */}
        {preset === 'custom' && (
          <div className="space-y-2">
            <Label className="text-zinc-400 text-sm">Hôte SMTP *</Label>
            <Input
              {...register('smtp_host')}
              placeholder="smtp.votreagence.fr"
              className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
            />
            {errors.smtp_host && (
              <p className="text-red-400 text-xs">{errors.smtp_host.message}</p>
            )}
          </div>
        )}

        {/* ── smtp_port — hidden for Gmail / Outlook presets ────────────────── */}
        {preset === 'custom' && (
          <div className="space-y-2">
            <Label className="text-zinc-400 text-sm">Port SMTP *</Label>
            <Input
              {...register('smtp_port', { valueAsNumber: true })}
              type="number"
              placeholder="587"
              className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
            />
            {errors.smtp_port && (
              <p className="text-red-400 text-xs">{errors.smtp_port.message}</p>
            )}
          </div>
        )}

        {/* ── smtp_user — label and placeholder adapt per preset ────────────── */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">
            {preset === 'gmail'
              ? 'Votre adresse Gmail *'
              : preset === 'outlook'
                ? 'Votre adresse Outlook / Microsoft 365 *'
                : 'Adresse email *'}
          </Label>
          <Input
            {...register('smtp_user')}
            type="email"
            placeholder={
              preset === 'gmail'
                ? 'votre.prenom@gmail.com'
                : preset === 'outlook'
                  ? 'prenom.nom@votredomaine.fr'
                  : 'contact@votreagence.fr'
            }
            className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
          />
          {errors.smtp_user && (
            <p className="text-red-400 text-xs">{errors.smtp_user.message}</p>
          )}
        </div>

        {/* ── smtp_password — label + contextual helper adapt per preset ───── */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">
            {preset === 'gmail' ? "Mot de passe d'application *" : 'Mot de passe *'}
          </Label>
          <div className="relative">
            <Input
              {...register('smtp_password')}
              type={showPassword ? 'text' : 'password'}
              className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.smtp_password && (
            <p className="text-red-400 text-xs">{errors.smtp_password.message}</p>
          )}

          {/* Gmail: warn about app passwords + link */}
          {preset === 'gmail' && (
            <p className="text-zinc-500 text-xs leading-relaxed">
              Pas votre mot de passe habituel —{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                Comment créer un mot de passe d'application Gmail
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </p>
          )}

          {/* Outlook: link to setup guide */}
          {preset === 'outlook' && (
            <p className="text-zinc-500 text-xs leading-relaxed">
              <a
                href="https://support.microsoft.com/fr-fr/office/param%C3%A8tres-pop-imap-et-smtp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                Comment configurer Outlook pour SynaPilot
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </p>
          )}
        </div>

        {/* ── Test button + feedback ────────────────────────────────────────── */}
        <div className="pt-2 space-y-3">
          <Button
            type="button"
            onClick={handleTest}
            disabled={testStatus === 'loading' || testStatus === 'success'}
            className={[
              'w-full text-white font-medium transition-colors',
              testStatus === 'success'
                ? 'bg-green-600 hover:bg-green-600 disabled:opacity-100 cursor-default'
                : 'bg-violet-600 hover:bg-violet-500 disabled:opacity-60',
            ].join(' ')}
          >
            {testStatus === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : testStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Connexion vérifiée ✓
              </>
            ) : (
              'Tester la connexion'
            )}
          </Button>

          <AnimatePresence>
            {testStatus === 'success' && (
              <motion.div
                key="feedback-success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3"
              >
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <p className="text-green-300 text-sm">
                  Connexion réussie — vous pouvez continuer
                </p>
              </motion.div>
            )}

            {testStatus === 'error' && (
              <motion.div
                key="feedback-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{testError}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
}
