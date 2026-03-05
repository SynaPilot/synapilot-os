// <!-- CREATE BUCKET: org-logos, public -->
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { useWizardStore } from '@/store/wizardStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  org_name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
});

type FormData = z.infer<typeof schema>;

export function Step1AgencyInfo({ className }: { className?: string }) {
  const { stepData, setStepData, setIsStepValid } = useWizardStore();
  const { organizationId } = useAuth();

  const [agentCount, setAgentCount] = useState(stepData.step1.agent_count ?? 1);
  const [logoUrl, setLogoUrl] = useState<string | null>(stepData.step1.logo_url ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fetchedRef = useRef(false);

  const { register, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { org_name: stepData.step1.org_name ?? '' },
  });

  const orgName = watch('org_name');

  // Pre-fill from Supabase if empty
  useEffect(() => {
    if (fetchedRef.current || orgName || !organizationId) return;
    fetchedRef.current = true;

    supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', organizationId)
      .single()
      .then(({ data }) => {
        if (data?.name) {
          setValue('org_name', data.name, { shouldValidate: true });
          setStepData('step1', { org_name: data.name });
        }
        if (data?.logo_url) {
          setLogoUrl(data.logo_url);
          setStepData('step1', { logo_url: data.logo_url });
        }
      });
  }, [organizationId, orgName, setValue, setStepData]);

  const isValid = orgName.length >= 2;

  useEffect(() => {
    setIsStepValid(isValid);
  }, [isValid, setIsStepValid]);

  useEffect(() => {
    setStepData('step1', { org_name: orgName, agent_count: agentCount });
  }, [orgName, agentCount, setStepData]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setUploadError('Type de fichier invalide');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setUploadError('Fichier trop lourd (max 2 Mo)');
        return;
      }
      if (!organizationId) return;

      setIsUploading(true);
      setUploadError(null);

      const ext = file.name.split('.').pop();
      const path = `${organizationId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { upsert: true });

      if (error) {
        const msg = error.message ?? '';
        const isBucketMissing =
          msg.toLowerCase().includes('not found') ||
          msg.toLowerCase().includes('bucket');
        setUploadError(
          isBucketMissing
            ? "Upload indisponible — vous pourrez ajouter votre logo plus tard"
            : 'Erreur upload'
        );
        setIsUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('org-logos')
        .getPublicUrl(path);

      setLogoUrl(urlData.publicUrl);
      setStepData('step1', { logo_url: urlData.publicUrl });
      setIsUploading(false);
    },
    [organizationId, setStepData]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Votre agence</h2>
      <p className="text-zinc-400 text-sm mb-6">
        Configurez les informations de base de votre agence.
      </p>

      <div className="space-y-6">
        {/* org_name */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">Nom de l'agence *</Label>
          <Input
            {...register('org_name')}
            placeholder="Agence Dupont Immobilier"
            className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500"
          />
          {errors.org_name && (
            <p className="text-red-400 text-xs">{errors.org_name.message}</p>
          )}
        </div>

        {/* agent_count */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-zinc-400 text-sm">Nombre d'agents</Label>
            <span className="text-zinc-100 text-sm font-medium">
              {agentCount} agent{agentCount > 1 ? 's' : ''}
            </span>
          </div>
          <Slider
            min={1}
            max={50}
            step={1}
            value={[agentCount]}
            onValueChange={([val]) => {
              setAgentCount(val);
              setStepData('step1', { agent_count: val });
            }}
            className="[&_[data-radix-slider-range]]:bg-violet-600 [&_[data-radix-slider-thumb]]:border-violet-600"
          />
          <div className="flex justify-between text-xs text-zinc-600">
            <span>1</span>
            <span>50</span>
          </div>
        </div>

        {/* logo_url */}
        <div className="space-y-2">
          <Label className="text-zinc-400 text-sm">
            Logo de l'agence{' '}
            <span className="text-zinc-600">(optionnel)</span>
          </Label>

          {logoUrl ? (
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <img
                src={logoUrl}
                alt="Logo agence"
                className="max-h-20 object-contain rounded"
              />
              <span className="text-zinc-300 text-sm flex-1 truncate">Logo chargé</span>
              <button
                type="button"
                onClick={() => {
                  setLogoUrl(null);
                  setStepData('step1', { logo_url: null });
                }}
                className="text-red-400 text-xs hover:text-red-300 transition-colors"
              >
                Supprimer
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                if (isUploading) return;
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => {
                if (isUploading) return;
                setIsDragging(false);
              }}
              onDrop={(e) => {
                if (isUploading) return;
                onDrop(e);
              }}
              className={[
                'relative border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors',
                isUploading ? 'pointer-events-none opacity-70' : '',
                isDragging
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-white/10 hover:border-white/20',
              ].join(' ')}
            >
              <input
                type="file"
                accept="image/*"
                disabled={isUploading}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {isUploading ? (
                <div className="w-full space-y-3 py-2">
                  <Progress
                    value={50}
                    className="h-1.5 bg-zinc-800 animate-pulse [&>div]:bg-violet-600 [&>div]:transition-none"
                  />
                  <p className="text-xs text-zinc-500 text-center">Chargement en cours...</p>
                </div>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-zinc-600" />
                  <p className="text-zinc-400 text-sm text-center">
                    Glissez votre logo ici ou{' '}
                    <span className="text-violet-400">parcourez</span>
                  </p>
                  <p className="text-zinc-600 text-xs">PNG, JPG, SVG · max 2 Mo</p>
                </>
              )}
            </div>
          )}

          {uploadError && (
            <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
              {uploadError}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}
