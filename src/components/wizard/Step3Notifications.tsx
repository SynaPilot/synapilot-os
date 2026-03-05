import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Bell, BarChart2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWizardStore } from '@/store/wizardStore';

const schema = z.object({
  director_email: z.string().email('Email invalide'),
  whatsapp_number: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Format invalide (ex: +33612345678)')
    .or(z.literal(''))
    .optional(),
});

type FormData = z.infer<typeof schema>;

const emailValidator = z.string().email();

export function Step3Notifications({ className }: { className?: string }) {
  const { stepData, setStepData, setIsStepValid } = useWizardStore();

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      director_email: stepData.step3.director_email ?? '',
      whatsapp_number: stepData.step3.whatsapp_number ?? '',
    },
  });

  const watched = watch();
  const isValid = emailValidator.safeParse(watched.director_email).success;

  useEffect(() => {
    setIsStepValid(isValid);
  }, [isValid, setIsStepValid]);

  useEffect(() => {
    setStepData('step3', {
      director_email: watched.director_email,
      whatsapp_number: watched.whatsapp_number || null,
    });
  }, [watched.director_email, watched.whatsapp_number, setStepData]);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Notifications</h2>
      <p className="text-zinc-400 text-sm mb-6">
        Configurez les destinataires des alertes et rapports.
      </p>

      <div className="space-y-5">
        {/* director_email */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">Email du directeur *</Label>
          <Input
            {...register('director_email')}
            type="email"
            placeholder="directeur@votreagence.fr"
            className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
          />
          <p className="text-zinc-600 text-xs">
            Reçoit les alertes pipeline et rapports hebdomadaires
          </p>
          {errors.director_email && (
            <p className="text-red-400 text-xs">{errors.director_email.message}</p>
          )}
        </div>

        {/* whatsapp_number */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">
            Numéro WhatsApp{' '}
            <span className="text-zinc-600">(optionnel)</span>
          </Label>
          <Input
            {...register('whatsapp_number')}
            type="tel"
            placeholder="+33 6 XX XX XX XX"
            className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
          />
          <p className="text-zinc-600 text-xs">
            Notifications instantanées pour les leads urgents
          </p>
          {errors.whatsapp_number && (
            <p className="text-red-400 text-xs">{errors.whatsapp_number.message}</p>
          )}
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-violet-400 shrink-0" />
              <span className="text-zinc-200 text-sm font-medium">Alertes Pipeline</span>
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Leads non-contactés &gt; 48h · Deals sans activité &gt; 7 jours
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-zinc-200 text-sm font-medium">Rapport Hebdomadaire</span>
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Chaque lundi 7h : KPIs semaine + comparaison N-1
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
