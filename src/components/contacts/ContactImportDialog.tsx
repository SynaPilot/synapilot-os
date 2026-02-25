import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Upload, Lock, ShieldCheck, RefreshCw, CheckCircle, AlertCircle,
  Check, Loader2, AlertTriangle, FileText, ChevronRight, ChevronLeft,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  parseCSVWithSheetJS,
  autoMapColumns,
  validateAndTransformRows,
  type TransformedContact,
} from '@/lib/contact-import-utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNAPILOT_FIELDS = [
  { value: '__ignore__', label: 'Ne pas importer', required: false },
  { value: 'full_name', label: 'Nom complet', required: true },
  { value: 'email', label: 'Email', required: false },
  { value: 'phone', label: 'Téléphone', required: false },
  { value: 'role', label: 'Rôle', required: false },
  { value: 'source', label: 'Source', required: false },
  { value: 'city', label: 'Ville', required: false },
  { value: 'postal_code', label: 'Code postal', required: false },
  { value: 'notes', label: 'Notes', required: false },
  { value: 'tags', label: 'Tags (séparés par virgule)', required: false },
];

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nom complet',
  email: 'Email',
  phone: 'Téléphone',
  role: 'Rôle',
  source: 'Source',
  city: 'Ville',
  postal_code: 'Code postal',
  notes: 'Notes',
  tags: 'Tags',
};

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 40 : -40, opacity: 0 }),
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStep = 1 | 2 | 3 | 4;
type DuplicateStrategy = 'ignore' | 'update';

interface ImportResults {
  imported: number;
  updated: number;
  errors: number;
  skipped: number;
}

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: ImportStep }) {
  const steps = ['Fichier', 'Colonnes', 'Aperçu', 'Import'];
  return (
    <div className="flex items-start justify-center">
      {steps.map((label, index) => {
        const n = (index + 1) as ImportStep;
        const isCompleted = n < currentStep;
        const isActive = n === currentStep;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300',
                  isCompleted
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : isActive
                    ? 'bg-gradient-to-br from-blue-500 to-purple-500 border-blue-400 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-transparent border-white/20 text-white/30',
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'text-blue-400' : isCompleted ? 'text-white/60' : 'text-white/30',
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 sm:w-12 mx-1 mb-4 transition-all duration-300',
                  isCompleted ? 'bg-blue-500' : 'bg-white/10',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('update');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToImport, setTotalToImport] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep(1);
        setDirection(1);
        setIsDragOver(false);
        setIsParsing(false);
        setParsedData(null);
        setMapping({});
        setDuplicateStrategy('update');
        setIsImporting(false);
        setImportProgress(0);
        setProcessedCount(0);
        setTotalToImport(0);
        setImportResults(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && isImporting) return; // Block close during import
    if (!next && importResults !== null && organizationId) {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
    }
    onOpenChange(next);
  };

  const goNext = () => {
    setDirection(1);
    setStep((prev) => (prev + 1) as ImportStep);
  };

  const goPrev = () => {
    setDirection(-1);
    setStep((prev) => (prev - 1) as ImportStep);
  };

  // ── File processing ────────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Format non supporté', {
          description: 'Veuillez sélectionner un fichier CSV (.csv)',
        });
        return;
      }

      setIsParsing(true);
      const result = await parseCSVWithSheetJS(file, (msg) => {
        toast.error(msg);
      });
      setIsParsing(false);

      if (!result) return;

      setParsedData(result);
      setMapping(autoMapColumns(result.headers));
      goNext();
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFile],
  );

  // ── Derived state for step 2 / 3 ──────────────────────────────────────────

  const isFullNameMapped = Object.values(mapping).includes('full_name');
  const isEmailMapped = Object.values(mapping).includes('email');

  const mappedFields = parsedData
    ? parsedData.headers
        .filter((h) => mapping[h] && mapping[h] !== '__ignore__')
        .map((h) => ({ header: h, field: mapping[h] as string }))
    : [];

  const previewRows = parsedData?.rows.slice(0, 8) ?? [];

  const fullNameHeaderIndex = parsedData
    ? parsedData.headers.findIndex((h) => mapping[h] === 'full_name')
    : -1;

  const invalidRowCount = parsedData
    ? parsedData.rows.filter((row) => !String(row[fullNameHeaderIndex] ?? '').trim()).length
    : 0;

  const validRowCount = (parsedData?.rows.length ?? 0) - invalidRowCount;

  // ── Import logic ───────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!parsedData || !organizationId) return;

    // TODO: add UNIQUE(email, organization_id) constraint to enable upsert duplicate detection
    toast.warning('Détection des doublons désactivée — contrainte DB manquante', {
      duration: 5000,
    });

    const { valid, invalid: skipped } = validateAndTransformRows(
      parsedData.rows,
      parsedData.headers,
      mapping,
      organizationId,
    );

    const BATCH_SIZE = 50;
    const batches: TransformedContact[][] = [];
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      batches.push(valid.slice(i, i + BATCH_SIZE));
    }

    setIsImporting(true);
    setImportProgress(0);
    setProcessedCount(0);
    setTotalToImport(valid.length);

    let importedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const rowsToInsert = batch.map((contact) => ({
        ...contact,
        pipeline_stage: 'nouveau' as const,
      }));

      // TODO: add UNIQUE(email, organization_id) constraint to use:
      // supabase.from('contacts').upsert(rowsToInsert, { onConflict: 'email,organization_id' })
      const { error } = await supabase.from('contacts').insert(rowsToInsert);

      if (error) {
        errorCount += batch.length;
      } else {
        importedCount += batch.length;
      }

      const done = (i + 1) * BATCH_SIZE;
      setProcessedCount(Math.min(done, valid.length));
      setImportProgress(Math.round(((i + 1) / batches.length) * 100));
    }

    setIsImporting(false);
    setImportResults({
      imported: importedCount,
      updated: 0, // No upsert without unique constraint
      errors: errorCount,
      skipped,
    });
  };

  const handleClose = () => {
    if (importResults !== null && organizationId) {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
    }
    onOpenChange(false);
  };

  const handleViewContacts = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
    }
    onOpenChange(false);
    navigate('/contacts');
  };

  // ── Render steps ───────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isParsing && fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer min-h-[200px]',
          isDragOver
            ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
            : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-blue-500/50',
          isParsing && 'pointer-events-none opacity-60',
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          {isParsing ? (
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
          ) : (
            <Upload className="w-7 h-7 text-blue-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-white">
            {isParsing ? 'Analyse en cours...' : isDragOver ? 'Déposez votre fichier CSV' : 'Glissez votre fichier CSV ici'}
          </p>
          {!isParsing && (
            <p className="text-sm text-white/50 mt-1">ou cliquez pour parcourir</p>
          )}
        </div>
      </div>

      {/* Supported formats */}
      <div className="space-y-2">
        <p className="text-xs text-white/40 font-medium uppercase tracking-wide">Fichiers supportés</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/20">
            <FileText className="w-3 h-3" />
            CSV (.csv)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-white/40 border border-white/10">
            <Lock className="w-3 h-3" />
            Excel (.xlsx) — bientôt
          </span>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (!parsedData) return null;
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          Associez chaque colonne de votre fichier à un champ SynaPilot.
        </p>

        {/* Email warning */}
        {!isEmailMapped && (
          <div className="flex items-center gap-2 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Sans email, les doublons ne pourront pas être détectés</span>
          </div>
        )}

        <ScrollArea className="max-h-[340px] pr-2">
          <div className="space-y-2">
            {parsedData.headers.map((header) => (
              <div key={header} className="flex items-center gap-3">
                <span className="flex-1 text-xs font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2 truncate text-white/70">
                  {header || <span className="text-white/30 italic">colonne vide</span>}
                </span>
                <span className="text-white/30 shrink-0">→</span>
                <Select
                  value={mapping[header] ?? '__ignore__'}
                  onValueChange={(value) =>
                    setMapping((prev) => ({ ...prev, [header]: value }))
                  }
                >
                  <SelectTrigger className="w-52 bg-white/10 border-white/20 text-sm shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95 backdrop-blur-xl border-white/20">
                    {SYNAPILOT_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                        {field.required && (
                          <span className="ml-1 text-red-400 text-xs">*</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </ScrollArea>

        <p className="text-xs text-white/30">
          <span className="text-red-400">*</span> Champ obligatoire
        </p>
      </div>
    );
  };

  const renderStep3 = () => {
    if (!parsedData) return null;

    return (
      <div className="space-y-5">
        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-white/10 text-white/80 border-0">
            {parsedData.rows.length} contacts détectés
          </Badge>
          {invalidRowCount > 0 && (
            <Badge className="bg-red-500/10 text-red-300 border-red-500/20">
              {invalidRowCount} lignes ignorées
            </Badge>
          )}
          <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20">
            {validRowCount} à importer
          </Badge>
        </div>

        {/* Preview table */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <ScrollArea className="max-h-[220px]">
            <table className="w-full text-sm">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  {mappedFields.map(({ field }) => (
                    <th
                      key={field}
                      className="text-left text-xs font-medium text-white/50 px-3 py-2 whitespace-nowrap"
                    >
                      {FIELD_LABELS[field] ?? field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => {
                  const isInvalid =
                    fullNameHeaderIndex >= 0 &&
                    !String(row[fullNameHeaderIndex] ?? '').trim();
                  return (
                    <tr
                      key={rowIndex}
                      className={cn(
                        'border-t border-white/5 transition-colors',
                        isInvalid ? 'bg-red-500/10' : 'hover:bg-white/5',
                      )}
                    >
                      {mappedFields.map(({ header, field }) => {
                        const colIdx = parsedData.headers.indexOf(header);
                        const value = String(row[colIdx] ?? '').trim();
                        const truncated = value.length > 30 ? value.slice(0, 30) + '…' : value;
                        return (
                          <td key={field} className="px-3 py-2 text-white/70">
                            {isInvalid && field === 'full_name' ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="text-red-400 italic text-xs">
                                      Nom manquant
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Nom manquant — ligne ignorée
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : truncated ? (
                              truncated
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        {/* Duplicate strategy — only when email is mapped */}
        {isEmailMapped && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/80">
              Que faire si un email existe déjà ?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Ignore */}
              <button
                type="button"
                onClick={() => setDuplicateStrategy('ignore')}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                  duplicateStrategy === 'ignore'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10',
                )}
              >
                <ShieldCheck
                  className={cn(
                    'w-5 h-5 mt-0.5 shrink-0',
                    duplicateStrategy === 'ignore' ? 'text-blue-400' : 'text-white/40',
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-white">Ignorer le doublon</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Le contact existant n'est pas modifié
                  </p>
                </div>
              </button>

              {/* Update */}
              <button
                type="button"
                onClick={() => setDuplicateStrategy('update')}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                  duplicateStrategy === 'update'
                    ? 'border-purple-500/50 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10',
                )}
              >
                <RefreshCw
                  className={cn(
                    'w-5 h-5 mt-0.5 shrink-0',
                    duplicateStrategy === 'update' ? 'text-purple-400' : 'text-white/40',
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-white">Mettre à jour le contact</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Les champs non-vides du fichier écrasent les données existantes
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    // Results screen
    if (importResults !== null) {
      const hasErrors = importResults.errors > 0;
      return (
        <div className="flex flex-col items-center gap-6 py-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            {hasErrors ? (
              <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-yellow-400" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-blue-400" />
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full space-y-3"
          >
            <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-white/70">Contacts importés</span>
                <span className="text-sm font-semibold text-blue-400">
                  ✅ {importResults.imported}
                </span>
              </div>
              {importResults.updated > 0 && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-white/70">Mis à jour</span>
                  <span className="text-sm font-semibold text-purple-400">
                    🔄 {importResults.updated}
                  </span>
                </div>
              )}
              {importResults.errors > 0 && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-white/70">Erreurs</span>
                  <span className="text-sm font-semibold text-red-400">
                    ⚠️ {importResults.errors}
                  </span>
                </div>
              )}
              {importResults.skipped > 0 && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-white/70">Ignorés (nom manquant)</span>
                  <span className="text-sm font-semibold text-white/50">
                    ⏭️ {importResults.skipped}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/20 hover:bg-white/10"
                onClick={handleClose}
              >
                Fermer
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={handleViewContacts}
              >
                Voir les contacts
              </Button>
            </div>
          </motion.div>
        </div>
      );
    }

    // Importing screen
    if (isImporting) {
      return (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
          <div className="w-full space-y-3">
            <div className="h-2 rounded-full overflow-hidden bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                animate={{ width: `${importProgress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <p className="text-center text-sm text-white/60">
              Import en cours...{' '}
              <span className="text-white font-medium">
                {processedCount}/{totalToImport}
              </span>{' '}
              contacts traités
            </p>
          </div>
        </div>
      );
    }

    // Ready to import screen
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
          <p className="text-sm font-medium text-white">Récapitulatif</p>
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex justify-between">
              <span>Fichier</span>
              <span className="text-white">{parsedData?.rows.length ?? 0} lignes</span>
            </div>
            <div className="flex justify-between">
              <span>À importer</span>
              <span className="text-blue-400 font-semibold">{validRowCount} contacts</span>
            </div>
            {invalidRowCount > 0 && (
              <div className="flex justify-between">
                <span>Ignorées (nom vide)</span>
                <span className="text-red-400">{invalidRowCount}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Colonnes mappées</span>
              <span className="text-white">{mappedFields.length}</span>
            </div>
          </div>
        </div>

        {validRowCount === 0 && (
          <div className="flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Aucun contact valide à importer. Vérifiez le mapping des colonnes.</span>
          </div>
        )}
      </div>
    );
  };

  // ── Footer actions ─────────────────────────────────────────────────────────

  const renderFooter = () => {
    if (step === 4) {
      if (importResults !== null || isImporting) return null;
      return (
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            className="border-white/20 hover:bg-white/10"
            onClick={goPrev}
            disabled={isImporting}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/20"
            onClick={handleImport}
            disabled={isImporting || validRowCount === 0 || !organizationId}
          >
            {isImporting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Import en cours...</>
            ) : (
              <>Lancer l'import ({validRowCount} contacts)</>
            )}
          </Button>
        </div>
      );
    }

    if (step === 1) return null;

    return (
      <div className="flex gap-3 pt-4 border-t border-white/10">
        <Button
          variant="outline"
          className="border-white/20 hover:bg-white/10"
          onClick={goPrev}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <Button
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          onClick={goNext}
          disabled={step === 2 && !isFullNameMapped}
        >
          {step === 3 ? (
            'Confirmer'
          ) : (
            <>
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  const stepTitles: Record<ImportStep, string> = {
    1: 'Importer des contacts',
    2: 'Associer les colonnes',
    3: 'Aperçu et stratégie',
    4: importResults !== null ? 'Import terminé' : isImporting ? 'Import en cours' : 'Lancer l\'import',
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-4xl w-full backdrop-blur-xl border-white/20 p-0 overflow-hidden"
        onInteractOutside={(e) => {
          if (isImporting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isImporting) e.preventDefault();
        }}
      >
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-6 pt-6 pb-5 border-b border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Upload className="w-5 h-5 text-blue-400" />
            </div>
            <DialogTitle className="text-xl font-semibold text-white">
              {stepTitles[step]}
            </DialogTitle>
          </div>
          <StepIndicator currentStep={step} />
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">{renderFooter()}</div>
      </DialogContent>
    </Dialog>
  );
}
