import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Loader2,
  Lock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useWizardStore } from '@/store/wizardStore';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type DetectedProvider =
  | 'gmail'
  | 'outlook-personal'
  | 'outlook-365'
  | 'ovh'
  | 'ionos'
  | 'custom';

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

// ── Provider SMTP configs ─────────────────────────────────────────────────────

interface ProviderConfig {
  host: string;
  port: number;
}

const PROVIDER_CONFIGS: Record<Exclude<DetectedProvider, 'custom'>, ProviderConfig> = {
  gmail:              { host: 'smtp.gmail.com',        port: 587 },
  'outlook-personal': { host: 'smtp-mail.outlook.com', port: 587 },
  'outlook-365':      { host: 'smtp.office365.com',    port: 587 },
  ovh:                { host: 'ssl0.ovh.net',           port: 465 },
  ionos:              { host: 'smtp.ionos.fr',          port: 587 },
};

// ── Provider detection ────────────────────────────────────────────────────────

function detectProviderSync(email: string): DetectedProvider {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return 'custom';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail';
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain))
    return 'outlook-personal';
  if (domain.endsWith('.onmicrosoft.com')) return 'outlook-365';
  if (domain.includes('ionos') || domain.includes('1and1')) return 'ionos';
  if (domain.includes('ovh')) return 'ovh';
  return 'custom';
}

async function detectProviderAsync(email: string): Promise<DetectedProvider> {
  const syncResult = detectProviderSync(email);
  if (syncResult !== 'custom') return syncResult;

  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return 'custom';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const json = (await res.json()) as { Answer?: Array<{ data: string }> };
      const mx = (json.Answer ?? []).map((a) => a.data.toLowerCase());
      if (mx.some((r) => r.includes('ovh'))) return 'ovh';
      if (mx.some((r) => r.includes('protection.outlook.com'))) return 'outlook-365';
    }
  } catch {
    // DNS lookup failed — fall through
  }

  return 'custom';
}

function restoreProvider(host: string, email: string): DetectedProvider {
  if (host) {
    const entry = (
      Object.entries(PROVIDER_CONFIGS) as Array<
        [Exclude<DetectedProvider, 'custom'>, ProviderConfig]
      >
    ).find(([, cfg]) => cfg.host === host);
    if (entry) return entry[0];
    return 'custom';
  }
  if (email) return detectProviderSync(email);
  return 'custom';
}

// ── Password config per provider ──────────────────────────────────────────────

function getPasswordConfig(provider: DetectedProvider): {
  label: string;
  placeholder: string;
  helper: string | null;
} {
  switch (provider) {
    case 'gmail':
      return {
        label: "Mot de passe d'application Google *",
        placeholder: 'xxxx xxxx xxxx xxxx',
        helper: null,
      };
    case 'outlook-personal':
      return {
        label: 'Mot de passe Microsoft *',
        placeholder: '',
        helper: 'Votre mot de passe de connexion habituel.',
      };
    case 'outlook-365':
      return {
        label: 'Mot de passe Microsoft 365 *',
        placeholder: '',
        helper: 'Votre mot de passe de connexion professionnel.',
      };
    case 'ovh':
      return {
        label: 'Mot de passe de votre compte email *',
        placeholder: '',
        helper:
          "C'est le mot de passe que vous avez défini dans votre espace client OVH, pas votre mot de passe OVH principal.",
      };
    case 'ionos':
      return {
        label: 'Mot de passe de votre compte email *',
        placeholder: '',
        helper: 'Le mot de passe défini dans votre interface IONOS pour cette adresse email.',
      };
    case 'custom':
      return { label: 'Mot de passe *', placeholder: '', helper: null };
  }
}

// ── Provider-aware error messages ─────────────────────────────────────────────

function mapTestError(raw: string, provider: DetectedProvider): string {
  const s = raw.toLowerCase();

  const isAuth =
    s.includes('auth') ||
    s.includes('credential') ||
    s.includes('535') ||
    s.includes('534') ||
    s.includes('invalid login') ||
    s.includes('password') ||
    s.includes('username');

  const isNetwork =
    s.includes('timeout') ||
    s.includes('timed out') ||
    s.includes('enotfound') ||
    s.includes('econnrefused') ||
    s.includes('getaddrinfo');

  if (isNetwork) return 'Le serveur ne répond pas. Vérifiez votre connexion internet.';

  if (isAuth) {
    switch (provider) {
      case 'gmail':
        return "Mot de passe incorrect. Assurez-vous d'utiliser un mot de passe d'application (16 caractères), pas votre mot de passe Gmail habituel.";
      case 'outlook-personal':
        return 'Mot de passe incorrect. Vérifiez votre mot de passe Microsoft.';
      case 'outlook-365':
        return 'Mot de passe incorrect. Vérifiez votre mot de passe Microsoft 365.';
      case 'ovh':
        return "Mot de passe incorrect. Utilisez le mot de passe de votre compte email OVH, pas celui de votre espace client.";
      case 'ionos':
        return "Mot de passe incorrect. Utilisez le mot de passe de votre compte email IONOS, pas celui de votre interface principale.";
      default:
        return 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
    }
  }

  return 'Connexion échouée. Vérifiez vos identifiants et réessayez.';
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  smtp_host:     z.string().min(1, "Serveur d'envoi requis"),
  smtp_port:     z.number({ invalid_type_error: 'Port requis' }).int().min(1).max(65535),
  smtp_user:     z.string().email('Email invalide'),
  smtp_password: z.string().min(1, 'Mot de passe requis'),
});

type FormData = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

export function Step2EmailConfig({ className }: { className?: string }) {
  const { stepData, setStepData, setIsStepValid } = useWizardStore();

  const [provider, setProvider] = useState<DetectedProvider>(() =>
    restoreProvider(
      stepData.step2.smtp_host ?? '',
      stepData.step2.smtp_user ?? '',
    ),
  );

  const [isDetecting, setIsDetecting]       = useState(false);
  const [showAdvanced, setShowAdvanced]     = useState(false);
  const [showGmailGuide, setShowGmailGuide] = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [testStatus, setTestStatus]         = useState<TestStatus>('idle');
  const [testError, setTestError]           = useState('');
  const [testPassed, setTestPassed]         = useState(stepData.step2.test_passed ?? false);
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
    (watched.smtp_user?.length ?? 0) > 0 &&
    (watched.smtp_password?.length ?? 0) > 0 &&
    (provider !== 'custom' || (watched.smtp_host?.length ?? 0) > 0);

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

  // Invalidate test whenever credentials change (skip first mount)
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

  // ── Apply a detected/selected provider ────────────────────────────────────

  const applyProvider = (p: DetectedProvider) => {
    setProvider(p);
    if (p !== 'custom') {
      const cfg = PROVIDER_CONFIGS[p];
      setValue('smtp_host', cfg.host, { shouldValidate: true });
      setValue('smtp_port', cfg.port, { shouldValidate: true });
    }
  };

  // ── Email onBlur: detect provider asynchronously ───────────────────────────

  const emailRegistration = register('smtp_user');

  const handleEmailBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    void emailRegistration.onBlur(e); // preserve RHF touched/validation state
    const email = e.target.value;
    if (!email.includes('@')) return;

    setIsDetecting(true);
    try {
      const p = await detectProviderAsync(email);
      applyProvider(p);
      if (p !== 'custom') {
        setShowAdvanced(false);
        setShowGmailGuide(false);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // ── Manual override: revert to custom ─────────────────────────────────────

  const switchToCustom = () => {
    setProvider('custom');
    setValue('smtp_host', '', { shouldValidate: false });
    setValue('smtp_port', 587, { shouldValidate: false });
    setTestPassed(false);
    setTestStatus('idle');
    setStepData('step2', { test_passed: false });
  };

  // ── Connection test ────────────────────────────────────────────────────────

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
          setTimeout(() => reject(new Error('timeout')), 15_000),
        ),
      ]);

      if (error || data?.success === false) {
        const raw = data?.error ?? error?.message ?? 'Connexion échouée';
        setTestStatus('error');
        setTestError(mapTestError(raw, provider));
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
      setTestError(mapTestError(raw, provider));
      setTestPassed(false);
      setStepData('step2', { test_passed: false });
    }
  };

  const pwdCfg    = getPasswordConfig(provider);
  const emailTyped = (watched.smtp_user?.length ?? 0) > 0;

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

        {/* ── Email (detection trigger) ─────────────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">Votre adresse email professionnelle *</Label>
          <div className="relative">
            <Input
              {...emailRegistration}
              onBlur={handleEmailBlur}
              type="email"
              placeholder="contact@votreagence.fr"
              className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
            />
            {isDetecting && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
              </div>
            )}
          </div>
          {errors.smtp_user && (
            <p className="text-red-400 text-xs">{errors.smtp_user.message}</p>
          )}

          {/* Detected provider badge + override link */}
          <AnimatePresence>
            {provider !== 'custom' && emailTyped && !isDetecting && (
              <motion.div
                key="provider-badge"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between"
              >
                <p className="text-xs text-zinc-500">
                  {provider === 'gmail'            && '✓ Gmail détecté'}
                  {provider === 'outlook-personal' && '✓ Microsoft Outlook / Hotmail détecté'}
                  {provider === 'outlook-365'      && '✓ Microsoft 365 professionnel détecté'}
                  {provider === 'ovh'              && '✓ OVH détecté'}
                  {provider === 'ionos'            && '✓ IONOS détecté'}
                </p>
                <button
                  type="button"
                  onClick={switchToCustom}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Changer de configuration
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Outlook 365: admin IT notice ──────────────────────────────────── */}
        <AnimatePresence>
          {provider === 'outlook-365' && (
            <motion.div
              key="o365-notice"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 rounded-lg bg-zinc-800/60 border border-white/5 px-3 py-2.5"
            >
              <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                Si la connexion échoue, votre administrateur IT doit activer{' '}
                <span className="text-zinc-400 font-medium">
                  l'authentification SMTP dans le centre d'administration Microsoft 365.
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Custom: provider name hint ────────────────────────────────────── */}
        <AnimatePresence>
          {provider === 'custom' && emailTyped && (
            <motion.div
              key="provider-name"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <Label className="text-zinc-400 text-sm">Votre hébergeur email</Label>
              <Input
                type="text"
                placeholder="Ex: Gandi, Infomaniak, La Poste..."
                className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Password ─────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">{pwdCfg.label}</Label>
          <div className="relative">
            <Input
              {...register('smtp_password')}
              type={showPassword ? 'text' : 'password'}
              placeholder={pwdCfg.placeholder}
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

          {/* Static helper for non-Gmail providers */}
          {pwdCfg.helper && (
            <p className="text-zinc-500 text-xs leading-relaxed">{pwdCfg.helper}</p>
          )}

          {/* ── Feature 3: Gmail inline step-by-step guide ─────────────────── */}
          {provider === 'gmail' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowGmailGuide((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Comment obtenir ce mot de passe ?
              </button>

              <AnimatePresence>
                {showGmailGuide && (
                  <motion.div
                    key="gmail-guide"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 space-y-3">
                      <div className="flex gap-3">
                        <span className="text-zinc-400 text-sm shrink-0">1.</span>
                        <div className="space-y-1">
                          <p className="text-zinc-300 text-sm">
                            🔒 Activez la validation en 2 étapes sur votre compte Google
                          </p>
                          <a
                            href="https://myaccount.google.com/signinoptions/two-step-verification"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 text-xs inline-flex items-center gap-0.5"
                          >
                            Activer la validation en 2 étapes
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="text-zinc-400 text-sm shrink-0">2.</span>
                        <div className="space-y-1">
                          <p className="text-zinc-300 text-sm">
                            🔑 Créez un mot de passe d'application
                          </p>
                          <a
                            href="https://myaccount.google.com/apppasswords"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 text-xs inline-flex items-center gap-0.5"
                          >
                            Créer un mot de passe d'application
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                          <p className="text-zinc-500 text-xs">
                            Choisissez "Autre" → tapez "SynaPilot" → Générer
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="text-zinc-400 text-sm shrink-0">3.</span>
                        <div className="space-y-1">
                          <p className="text-zinc-300 text-sm">
                            📋 Copiez le code à 16 caractères et collez-le ici
                          </p>
                          <p className="text-zinc-500 text-xs">
                            Supprimez les espaces avant de coller
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Custom: collapsible advanced settings (host + port) ───────────── */}
        <AnimatePresence>
          {provider === 'custom' && emailTyped && (
            <motion.div
              key="advanced-section"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronDown
                  className={[
                    'w-4 h-4 transition-transform duration-200',
                    showAdvanced ? 'rotate-180' : '',
                  ].join(' ')}
                />
                Paramètres avancés
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    key="advanced-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4">

                      {/* Host */}
                      <div className="space-y-2">
                        <Label className="text-zinc-400 text-sm">Serveur d'envoi *</Label>
                        <Input
                          {...register('smtp_host')}
                          placeholder="smtp.votreagence.fr"
                          className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
                        />
                        {errors.smtp_host && (
                          <p className="text-red-400 text-xs">{errors.smtp_host.message}</p>
                        )}
                      </div>

                      {/* Port */}
                      <div className="space-y-2">
                        <Label className="text-zinc-400 text-sm">Port</Label>
                        <Input
                          {...register('smtp_port', { valueAsNumber: true })}
                          type="number"
                          min={1}
                          max={65535}
                          placeholder="587"
                          className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
                        />
                        {errors.smtp_port && (
                          <p className="text-red-400 text-xs">{errors.smtp_port.message}</p>
                        )}
                        <p className="text-zinc-600 text-xs leading-relaxed">
                          587 fonctionne pour la plupart des hébergeurs. Utilisez 465 si votre
                          hébergeur le demande explicitement.
                        </p>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

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
                Vérification en cours...
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
                  ✓ Connexion réussie — vous pouvez continuer
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
