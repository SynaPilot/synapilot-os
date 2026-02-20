import { useState, useRef, useCallback } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Zap,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Leaf,
  ThermometerSun,
  Upload,
  FileCheck,
  Loader2,
} from 'lucide-react';

type Property = Tables<'properties'>;

interface PropertyComplianceAuditProps {
  property: Property;
}

const DPE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
type DpeClass = (typeof DPE_CLASSES)[number];

const DPE_CONFIG: Record<DpeClass, { color: string; bg: string; border: string; width: string }> = {
  A: { color: 'text-green-400', bg: 'bg-green-500', border: 'border-green-500', width: 'w-[20%]' },
  B: { color: 'text-green-300', bg: 'bg-green-400', border: 'border-green-400', width: 'w-[30%]' },
  C: { color: 'text-lime-300', bg: 'bg-lime-400', border: 'border-lime-400', width: 'w-[40%]' },
  D: { color: 'text-yellow-300', bg: 'bg-yellow-400', border: 'border-yellow-400', width: 'w-[55%]' },
  E: { color: 'text-amber-300', bg: 'bg-amber-500', border: 'border-amber-500', width: 'w-[70%]' },
  F: { color: 'text-orange-300', bg: 'bg-orange-500', border: 'border-orange-500', width: 'w-[85%]' },
  G: { color: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500', width: 'w-full' },
};

const GES_CONFIG: Record<DpeClass, { bg: string }> = {
  A: { bg: 'bg-violet-300' },
  B: { bg: 'bg-violet-400' },
  C: { bg: 'bg-purple-400' },
  D: { bg: 'bg-purple-500' },
  E: { bg: 'bg-fuchsia-500' },
  F: { bg: 'bg-pink-500' },
  G: { bg: 'bg-rose-600' },
};

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function normalizeDpeLabel(raw: string | null): DpeClass | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (DPE_CLASSES.includes(upper as DpeClass)) return upper as DpeClass;
  return null;
}

function getComplianceStatus(dpe: DpeClass | null): 'critical' | 'warning' | 'ok' {
  if (!dpe) return 'warning';
  if (dpe === 'F' || dpe === 'G') return 'critical';
  return 'ok';
}

function DpeSpectrum({ activeLabel }: { activeLabel: DpeClass | null }) {
  return (
    <div className="space-y-1.5">
      {DPE_CLASSES.map((letter) => {
        const config = DPE_CONFIG[letter];
        const isActive = letter === activeLabel;

        return (
          <div key={letter} className="flex items-center gap-2">
            <div
              className={`
                ${config.width} h-7 ${config.bg} rounded-r-md flex items-center
                transition-all duration-300
                ${isActive ? 'opacity-100 ring-2 ring-white/50 shadow-lg' : 'opacity-30'}
              `}
            >
              <span
                className={`
                  ml-2 text-xs font-bold text-white
                  ${isActive ? 'text-sm' : ''}
                `}
              >
                {letter}
              </span>
            </div>
            {isActive && (
              <span className={`text-sm font-semibold ${config.color}`}>
                {letter}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GesIndicator({ gesLabel }: { gesLabel: DpeClass | null }) {
  if (!gesLabel) return null;
  const config = GES_CONFIG[gesLabel];

  return (
    <div className="flex items-center gap-3">
      <Leaf className="w-4 h-4 text-purple-400" />
      <span className="text-sm text-muted-foreground">GES</span>
      <div
        className={`${config.bg} text-white text-xs font-bold px-3 py-1 rounded-md`}
      >
        {gesLabel}
      </div>
    </div>
  );
}

interface AnalysisResult {
  dpe: DpeClass;
  ges: DpeClass;
}

type UploadPhase = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

function DpeUploadZone({
  propertyId,
  organizationId,
  onAnalysisComplete,
}: {
  propertyId: string;
  organizationId: string;
  onAnalysisComplete: (result: AnalysisResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { session } = useAuth();
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Format non supporté. Utilisez PDF, JPG ou PNG.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Fichier trop volumineux. Maximum 5 Mo.';
    }
    return null;
  }, []);

  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error('Fichier invalide', { description: validationError });
      return;
    }

    if (!session?.access_token) {
      toast.error('Session expirée', { description: 'Veuillez vous reconnecter.' });
      return;
    }

    setFileName(file.name);
    setLastFile(file);
    setResult(null);

    // --- Upload to Supabase Storage ---
    setPhase('uploading');
    const filePath = `${organizationId}/${propertyId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('dpe-documents')
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      setPhase('error');
      toast.error('Erreur d\'envoi', {
        description: 'Impossible de téléverser le fichier. Réessayez.',
      });
      return;
    }

    // --- Get a signed URL for the Edge Function (private bucket) ---
    const { data: signedData, error: signedError } = await supabase.storage
      .from('dpe-documents')
      .createSignedUrl(filePath, 300); // 5 minutes

    if (signedError || !signedData?.signedUrl) {
      console.error('Signed URL error:', signedError);
      setPhase('error');
      toast.error('Erreur interne', {
        description: 'Impossible de générer le lien du fichier.',
      });
      return;
    }

    // --- Call the analyze-dpe Edge Function ---
    setPhase('analyzing');

    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'analyze-dpe',
      {
        body: {
          file_url: signedData.signedUrl,
          organization_id: organizationId,
          property_id: propertyId,
        },
      },
    );

    if (fnError) {
      console.error('Edge Function error:', fnError);
      setPhase('error');

      const message = fnError.message || '';
      let description = 'Erreur lors de l\'analyse du document.';
      if (message.includes('422') || message.includes('invalides')) {
        description = 'Document illisible — les labels DPE/GES n\'ont pas pu être extraits.';
      } else if (message.includes('400')) {
        description = 'Format non supporté par l\'analyse IA.';
      } else if (message.includes('429')) {
        description = 'Quota API dépassé. Réessayez dans quelques minutes.';
      }

      toast.error('Analyse échouée', {
        description,
        action: {
          label: 'Réessayer',
          onClick: () => processFile(file),
        },
      });
      return;
    }

    // --- Validate the response ---
    const dpe = normalizeDpeLabel(fnData?.dpe);
    const ges = normalizeDpeLabel(fnData?.ges);

    if (!dpe || !ges) {
      setPhase('error');
      toast.error('Analyse échouée', {
        description: 'Document illisible — impossible d\'extraire les classes DPE/GES.',
        action: {
          label: 'Réessayer',
          onClick: () => processFile(file),
        },
      });
      return;
    }

    // --- Success ---
    const analysisResult: AnalysisResult = { dpe, ges };
    setResult(analysisResult);
    setPhase('complete');
    onAnalysisComplete(analysisResult);

    toast.success(`DPE analysé et mis à jour (Classe ${dpe})`, {
      description: `DPE : ${dpe} — GES : ${ges}`,
    });
  }, [validateFile, session, organizationId, propertyId, onAnalysisComplete]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setFileName(null);
    setResult(null);
    setLastFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  if (phase === 'uploading' || phase === 'analyzing') {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              {phase === 'uploading' ? 'Envoi du fichier...' : 'Analyse IA en cours...'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {fileName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'complete' && result) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <FileCheck className="w-5 h-5 text-green-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-300">
              Classe détectée : DPE {result.dpe} — GES {result.ges}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {fileName}
            </p>
          </div>
          <Badge
            className={`
              text-lg font-bold px-3 py-1 border
              ${DPE_CONFIG[result.dpe].border} ${DPE_CONFIG[result.dpe].color}
              bg-transparent
            `}
          >
            {result.dpe}
          </Badge>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-muted-foreground hover:text-white transition-colors underline underline-offset-2"
        >
          Analyser un autre document
        </button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-300">
              Échec de l'analyse
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {fileName}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => lastFile && processFile(lastFile)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-white transition-colors underline underline-offset-2"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        rounded-xl border-2 border-dashed p-6 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragOver
            ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
            : 'border-white/20 bg-white/5 hover:border-blue-500/40 hover:bg-blue-500/5'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />
      <Upload
        className={`w-8 h-8 mx-auto mb-3 transition-colors ${
          isDragOver ? 'text-blue-400' : 'text-muted-foreground'
        }`}
      />
      <p className="text-sm font-medium text-white mb-1">
        Glisser-déposer le DPE ici
      </p>
      <p className="text-xs text-muted-foreground">
        PDF, JPG ou PNG (max 5 Mo) — Analyse automatique par IA
      </p>
    </div>
  );
}

export function PropertyComplianceAudit({ property }: PropertyComplianceAuditProps) {
  const { organizationId } = useAuth();
  const [overrideDpe, setOverrideDpe] = useState<DpeClass | null>(null);
  const [overrideGes, setOverrideGes] = useState<DpeClass | null>(null);

  const dpeLabel = overrideDpe ?? normalizeDpeLabel(property.dpe_label);
  const gesLabel = overrideGes ?? normalizeDpeLabel(property.ges_label);
  const status = getComplianceStatus(dpeLabel);

  const handleAnalysisComplete = useCallback((result: AnalysisResult) => {
    setOverrideDpe(result.dpe);
    setOverrideGes(result.ges);
  }, []);

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <ThermometerSun className="w-5 h-5 text-blue-400" />
            Diagnostic de Performance Énergétique
          </CardTitle>
          {dpeLabel && (
            <Badge
              className={`
                text-lg font-bold px-3 py-1 border
                ${DPE_CONFIG[dpeLabel].border} ${DPE_CONFIG[dpeLabel].color}
                bg-transparent
              `}
            >
              {dpeLabel}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* DPE Spectrum */}
        <DpeSpectrum activeLabel={dpeLabel} />

        {/* Energy consumption */}
        {property.energy_rating && (
          <div className="flex items-center gap-3 text-sm">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-muted-foreground">Consommation</span>
            <span className="text-white font-medium">
              {property.energy_rating} kWh/m².an
            </span>
          </div>
        )}

        {/* GES */}
        <GesIndicator gesLabel={gesLabel} />

        {/* Upload & Analyze */}
        <div className="pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Importer un diagnostic
          </p>
          {organizationId ? (
            <DpeUploadZone
              propertyId={property.id}
              organizationId={organizationId}
              onAnalysisComplete={handleAnalysisComplete}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Chargement de l'organisation...
            </p>
          )}
        </div>

        {/* Compliance Alert */}
        {status === 'critical' && (
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle className="text-red-400 font-semibold">
              Interdit à la location
            </AlertTitle>
            <AlertDescription className="text-red-300/80">
              Les logements classés F ou G sont interdits à la location depuis 2025
              (loi Climat et Résilience). Une rénovation énergétique est requise.
            </AlertDescription>
          </Alert>
        )}

        {status === 'warning' && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <AlertTitle className="text-yellow-400 font-semibold">
              DPE non renseigné
            </AlertTitle>
            <AlertDescription className="text-yellow-300/80">
              Le diagnostic de performance énergétique est obligatoire pour toute
              mise en vente ou location. Veuillez compléter cette information.
            </AlertDescription>
          </Alert>
        )}

        {status === 'ok' && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <ShieldCheck className="h-4 w-4 text-green-400" />
            <AlertTitle className="text-green-400 font-semibold">
              Conforme
            </AlertTitle>
            <AlertDescription className="text-green-300/80">
              Ce bien respecte les exigences énergétiques en vigueur pour la
              mise en location et la vente.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
