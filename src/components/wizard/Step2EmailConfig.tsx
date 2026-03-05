import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Plug, Lock, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function Step2EmailConfig({ className }: { className?: string }) {
  const { stepData, setStepData, setIsStepValid } = useWizardStore();

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
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      smtp_host: stepData.step2.smtp_host ?? '',
      smtp_port: stepData.step2.smtp_port ?? 587,
      smtp_user: stepData.step2.smtp_user ?? '',
      smtp_password: stepData.step2.smtp_password ?? '',
    },
  });

  const watched = watch();
  const allFilled =
    (watched.smtp_host?.length ?? 0) > 0 &&
    (watched.smtp_user?.length ?? 0) > 0 &&
    (watched.smtp_password?.length ?? 0) > 0;

  const isValid = allFilled && testPassed;

  useEffect(() => {
    setIsStepValid(isValid);
  }, [isValid, setIsStepValid]);

  // Sync form values to store
  useEffect(() => {
    setStepData('step2', {
      smtp_host: watched.smtp_host,
      smtp_port: watched.smtp_port,
      smtp_user: watched.smtp_user,
      smtp_password: watched.smtp_password,
    });
  }, [watched.smtp_host, watched.smtp_port, watched.smtp_user, watched.smtp_password, setStepData]);

  // Reset test when credentials change (skip first mount)
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

  const handleTest = async () => {
    const valid = await trigger();
    if (!valid) return;

    setTestStatus('loading');
    setTestError('');

    const values = getValues();
    const { data, error } = await supabase.functions.invoke('test-smtp', {
      body: {
        host: values.smtp_host,
        port: values.smtp_port,
        user: values.smtp_user,
        password: values.smtp_password,
      },
    });

    if (error || data?.success === false) {
      const msg = data?.error ?? error?.message ?? 'Connexion échouée';
      setTestStatus('error');
      setTestError(msg);
      setTestPassed(false);
      setStepData('step2', { test_passed: false });
    } else {
      setTestStatus('success');
      setTestPassed(true);
      setStepData('step2', { test_passed: true });
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

      <div className="space-y-4">
        {/* smtp_host */}
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

        {/* smtp_port */}
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

        {/* smtp_user */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">Utilisateur SMTP *</Label>
          <Input
            {...register('smtp_user')}
            type="email"
            placeholder="contact@votreagence.fr"
            className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
          />
          {errors.smtp_user && (
            <p className="text-red-400 text-xs">{errors.smtp_user.message}</p>
          )}
        </div>

        {/* smtp_password */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">Mot de passe SMTP *</Label>
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
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.smtp_password && (
            <p className="text-red-400 text-xs">{errors.smtp_password.message}</p>
          )}
        </div>

        {/* Test button */}
        <div className="pt-2 space-y-3">
          <Button
            type="button"
            onClick={handleTest}
            disabled={testStatus === 'loading'}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60"
          >
            {testStatus === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <Plug className="w-4 h-4 mr-2" />
                Tester la connexion
              </>
            )}
          </Button>

          {testStatus === 'success' && (
            <Badge className="w-full justify-center py-2 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/20">
              ✅ Connexion réussie — vous pouvez continuer
            </Badge>
          )}

          {testStatus === 'error' && (
            <Badge className="w-full justify-center py-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/20">
              {testError}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}
