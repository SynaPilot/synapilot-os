import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Edit,
  Plus,
  Clock,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  FileText,
  Calendar as CalendarIcon,
  RefreshCw,
  CheckCircle2,
  User,
  TrendingUp,
  Loader2,
  Home,
  Edit3,
  Check,
  ChevronsUpDown,
  DollarSign,
  Target,
} from 'lucide-react';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate, formatShortDate, formatRelativeTime } from '@/lib/formatters';
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_LABELS,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  type DealStage,
} from '@/lib/constants';
import { DealHealthScore } from '@/components/DealHealthScore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type DealWithRelations = Tables<'deals'> & {
  contacts?: { full_name: string; id: string } | null;
  properties?: { title: string } | null;
  profiles?: { full_name: string | null } | null;
};

type Activity = Tables<'activities'> & {
  profiles?: { full_name: string } | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGE_PROBABILITY_MAP: Record<DealStage, number> = {
  nouveau: 10,
  qualification: 20,
  estimation: 30,
  mandat: 50,
  commercialisation: 60,
  visite: 70,
  offre: 80,
  negociation: 85,
  compromis: 90,
  financement: 95,
  acte: 98,
  vendu: 100,
  perdu: 0,
};


// Stages shown in the progress bar (excluding 'perdu')
const PROGRESS_STAGES = DEAL_STAGES.filter((s) => s !== 'perdu');

// Select string for deal queries — used in both the query and optimistic update
const DEAL_SELECT = '*, contacts:contact_id(id, full_name), properties:property_id(title), profiles:assigned_to(full_name)' as const;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const dealSchema = z.object({
  name: z.string().min(2, 'Nom requis').max(100),
  amount: z.number().min(0, 'Montant requis'),
  stage: z.enum(DEAL_STAGES).default('nouveau'),
  commission_rate: z.number().min(0).max(100).default(5),
  probability: z.number().min(0).max(100).default(10),
  contact_id: z.string().optional(),
  property_id: z.string().optional(),
  assigned_to: z.string().optional(),
  expected_close_date: z.string().optional(),
  actual_close_date: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

const activitySchema = z.object({
  name: z
    .string()
    .min(3, 'Le titre doit contenir au moins 3 caractères')
    .max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  type: z.enum(['appel', 'email', 'visite', 'rdv', 'relance', 'signature', 'note', 'tache', 'autre']),
  date: z.date(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format HH:mm requis'),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']),
  status: z.enum(['planifie', 'en_cours', 'termine', 'annule']),
  description: z.string().max(500, 'Maximum 500 caractères').optional(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActivityTypeIcon(type: string | null): { icon: React.ElementType; dotColor: string } {
  const config: Record<string, { icon: React.ElementType; dotColor: string }> = {
    appel: { icon: Phone, dotColor: 'bg-purple-400' },
    email: { icon: Mail, dotColor: 'bg-blue-400' },
    visite: { icon: MapPin, dotColor: 'bg-purple-600' },
    relance: { icon: RefreshCw, dotColor: 'bg-blue-600' },
    rdv: { icon: CalendarIcon, dotColor: 'bg-purple-500' },
    signature: { icon: FileText, dotColor: 'bg-blue-500' },
    note: { icon: FileText, dotColor: 'bg-purple-400' },
    tache: { icon: CheckCircle2, dotColor: 'bg-blue-400' },
    autre: { icon: CalendarIcon, dotColor: 'bg-gray-400' },
  };
  return config[type || ''] || { icon: CalendarIcon, dotColor: 'bg-gray-400' };
}

function getPriorityColor(priority: string | null): string {
  const colors: Record<string, string> = {
    urgente: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
    haute: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    normale: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    basse: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  };
  return colors[priority || ''] || 'bg-muted text-muted-foreground';
}

function getStatusColor(status: string | null): string {
  const colors: Record<string, string> = {
    planifie: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    en_cours: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    termine: 'bg-blue-700/30 text-blue-200 border-blue-700/40',
    annule: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
  };
  return colors[status || ''] || 'bg-muted text-muted-foreground';
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface HeroSectionProps {
  deal: DealWithRelations;
  onEdit: () => void;
  onNavigateBack: () => void;
  onStageChange: (stage: DealStage) => void;
  isUpdatingStage: boolean;
}

function HeroSection({ deal, onEdit, onNavigateBack, onStageChange, isUpdatingStage }: HeroSectionProps) {
  const stage = deal.stage as DealStage;
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10">
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-blue-800/10 bg-[size:200%]"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      <div className="relative p-6 space-y-4">
        {/* Row 1: nav + actions */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onNavigateBack} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Retour au pipeline
          </Button>
          <div className="flex items-center gap-2">
            <Select
              value={stage}
              onValueChange={(v) => onStageChange(v as DealStage)}
              disabled={isUpdatingStage}
            >
              <SelectTrigger className="w-44 h-8 text-xs bg-white/5 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {DEAL_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0 bg-white/5 border-white/10"
              onClick={onEdit}
            >
              <Edit className="w-4 h-4" />
              Modifier
            </Button>
          </div>
        </div>

        {/* Row 2: deal name */}
        <h1 className="text-3xl font-display font-semibold tracking-tight">{deal.name}</h1>

        {/* Row 3: KPI chips */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
            <DollarSign className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-muted-foreground">Montant</span>
            <span className="text-sm font-semibold font-mono">{formatCurrency(deal.amount)}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-muted-foreground">Commission</span>
            <span className="text-sm font-semibold font-mono">
              {formatCurrency(deal.commission_amount ?? 0)}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
            <Target className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-muted-foreground">Probabilité</span>
            <span className="text-sm font-semibold">{deal.probability ?? 0} %</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface StageStepperProps {
  deal: DealWithRelations;
  currentStageIndex: number;
}

function StageStepper({ deal, currentStageIndex }: StageStepperProps) {
  const stage = deal.stage as DealStage;
  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.updated_at).getTime()) / 86400000
  );

  return (
    <div>
      {PROGRESS_STAGES.map((s, idx) => {
        const isCompleted = idx < currentStageIndex && stage !== 'perdu';
        const isCurrent = idx === currentStageIndex && stage !== 'perdu';
        const isLast = idx === PROGRESS_STAGES.length - 1;

        return (
          <motion.div
            key={s}
            className="flex gap-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-3 h-3 rounded-full shrink-0 mt-0.5',
                  isCompleted && 'bg-primary',
                  isCurrent &&
                    'bg-blue-500 ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-[0_0_8px_rgba(59,130,246,0.6)]',
                  !isCompleted && !isCurrent && 'border border-border bg-background'
                )}
              />
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 my-1 min-h-[12px]',
                    isCompleted ? 'bg-primary/40' : 'bg-border'
                  )}
                />
              )}
            </div>
            <div
              className={cn(
                'pb-2 text-xs',
                isCurrent
                  ? 'text-primary font-semibold'
                  : isCompleted
                  ? 'text-foreground/60'
                  : 'text-muted-foreground'
              )}
            >
              {DEAL_STAGE_LABELS[s]}
              {isCurrent && (
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {daysInStage === 0 ? "Aujourd'hui" : `${daysInStage} j dans cette étape`}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Perdu node */}
      <motion.div
        className="flex gap-3 mt-1"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: PROGRESS_STAGES.length * 0.03 }}
      >
        <div
          className={cn(
            'w-3 h-3 rounded-full shrink-0 mt-0.5 border',
            stage === 'perdu'
              ? 'bg-red-500/30 border-red-500'
              : 'bg-background border-border'
          )}
        />
        <div
          className={cn(
            'text-xs',
            stage === 'perdu' ? 'text-red-400 font-semibold' : 'text-muted-foreground'
          )}
        >
          {DEAL_STAGE_LABELS['perdu']}
          {stage === 'perdu' && (
            <p className="text-xs text-muted-foreground font-normal mt-0.5">
              {daysInStage === 0 ? "Aujourd'hui" : `${daysInStage} j dans cette étape`}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId, user } = useAuth();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const userEditedProbability = useRef(false);

  // Combobox open state for edit form
  const [contactOpen, setContactOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data: deal, isLoading: isLoadingDeal } = useOrgQuery<DealWithRelations>(
    'deals',
    {
      select: DEAL_SELECT,
      filters: id ? { id } : undefined,
      single: true,
    },
    { enabled: !!id }
  );

  const { data: activities, isLoading: isLoadingActivities } = useOrgQuery<Activity[]>(
    'activities',
    {
      select: '*, profiles:assigned_to(full_name)',
      filters: id ? { deal_id: id } : undefined,
      orderBy: { column: 'date', ascending: false },
    },
    { enabled: !!id }
  );

  // Lookup lists for edit form comboboxes
  const { data: contacts } = useOrgQuery<{ id: string; full_name: string }[]>('contacts', {
    select: 'id, full_name',
    orderBy: { column: 'full_name', ascending: true },
  });
  const { data: properties } = useOrgQuery<{ id: string; title: string }[]>('properties', {
    select: 'id, title',
    orderBy: { column: 'title', ascending: true },
  });
  const { data: profiles } = useOrgQuery<{ id: string; full_name: string | null }[]>('profiles', {
    select: 'id, full_name',
    orderBy: { column: 'full_name', ascending: true },
  });

  // ── Forms ────────────────────────────────────────────────────────────────

  const editForm = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: '',
      amount: 0,
      stage: 'nouveau',
      commission_rate: 5,
      probability: 10,
      contact_id: undefined,
      property_id: undefined,
      assigned_to: undefined,
      expected_close_date: '',
      actual_close_date: '',
      notes: '',
      tags: '',
    },
  });

  // Pre-fill edit form whenever deal data arrives or the dialog opens
  useEffect(() => {
    if (deal) {
      const tagsString = Array.isArray(deal.tags)
        ? (deal.tags as string[]).join(', ')
        : deal.tags
          ? String(deal.tags)
          : '';
      editForm.reset({
        name: deal.name,
        amount: deal.amount,
        stage: deal.stage as DealStage,
        commission_rate: deal.commission_rate ?? 5,
        probability: deal.probability ?? 10,
        contact_id: deal.contact_id ?? undefined,
        property_id: deal.property_id ?? undefined,
        assigned_to: deal.assigned_to ?? undefined,
        expected_close_date: deal.expected_close_date ?? '',
        actual_close_date: deal.actual_close_date ?? '',
        notes: deal.notes ?? '',
        tags: tagsString,
      });
    }
  }, [deal, isEditDialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-suggest probability when stage changes (unless user manually edited it)
  const watchedStage = editForm.watch('stage');
  useEffect(() => {
    if (!userEditedProbability.current) {
      editForm.setValue('probability', STAGE_PROBABILITY_MAP[watchedStage as DealStage] ?? 10);
    }
  }, [watchedStage, editForm]);

  const activityForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: '',
      type: 'appel',
      date: now,
      time: currentTime,
      priority: 'normale',
      status: 'planifie',
      description: '',
    },
  });

  const handleActivityDialogChange = (open: boolean) => {
    setIsActivityDialogOpen(open);
    if (!open) {
      const newNow = new Date();
      const newTime = `${String(newNow.getHours()).padStart(2, '0')}:${String(newNow.getMinutes()).padStart(2, '0')}`;
      activityForm.reset({
        name: '',
        type: 'appel',
        date: newNow,
        time: newTime,
        priority: 'normale',
        status: 'planifie',
        description: '',
      });
    }
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      userEditedProbability.current = false;
      setContactSearch('');
      setPropertySearch('');
      setAssigneeSearch('');
    }
  };

  // ── Mutations ────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (values: DealFormValues) => {
      if (!organizationId || !id) throw new Error('Organisation non trouvée');
      const tagsArray = values.tags
        ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
      const { error } = await supabase
        .from('deals')
        .update({
          name: values.name,
          amount: values.amount,
          stage: values.stage,
          commission_rate: values.commission_rate,
          probability: values.probability,
          contact_id: values.contact_id || null,
          property_id: values.property_id || null,
          assigned_to: values.assigned_to || null,
          expected_close_date: values.expected_close_date || null,
          actual_close_date: values.actual_close_date || null,
          notes: values.notes || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
        })
        .eq('id', id)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
      setIsEditDialogOpen(false);
      userEditedProbability.current = false;
      toast.success('Opportunité mise à jour');
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`),
  });

  const createActivityMutation = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      if (!organizationId || !id) throw new Error('Organisation non trouvée');
      const [hours, minutes] = values.time.split(':').map(Number);
      const dateTime = new Date(values.date);
      dateTime.setHours(hours, minutes, 0, 0);
      const { error } = await supabase.from('activities').insert([{
        name: values.name,
        type: values.type,
        description: values.description || null,
        date: dateTime.toISOString(),
        deal_id: id,
        contact_id: deal?.contact_id ?? null,
        organization_id: organizationId,
        status: values.status,
        priority: values.priority,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', organizationId] });
      setIsActivityDialogOpen(false);
      activityForm.reset();
      toast.success('Activité ajoutée ✅');
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`),
  });

  const stageUpdateMutation = useMutation({
    mutationFn: async (newStage: DealStage) => {
      if (!organizationId || !id) throw new Error('Organisation non trouvée');
      const { error } = await supabase
        .from('deals')
        .update({ stage: newStage, probability: STAGE_PROBABILITY_MAP[newStage] })
        .eq('id', id)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onMutate: async (newStage: DealStage) => {
      await queryClient.cancelQueries({ queryKey: ['deals', organizationId] });
      const previousDeal = queryClient.getQueryData<DealWithRelations>([
        'deals',
        organizationId,
        { id },
        DEAL_SELECT,
      ]);
      queryClient.setQueryData<DealWithRelations>(
        ['deals', organizationId, { id }, DEAL_SELECT],
        (old) => (old ? { ...old, stage: newStage, probability: STAGE_PROBABILITY_MAP[newStage] } : old)
      );
      return { previousDeal };
    },
    onError: (_err, _newStage, context) => {
      queryClient.setQueryData(
        ['deals', organizationId, { id }, DEAL_SELECT],
        context?.previousDeal
      );
      toast.error('Erreur lors de la mise à jour du stade');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
    },
  });

  // ── Derived values ───────────────────────────────────────────────────────

  const filteredContacts = contacts?.filter((c) =>
    !contactSearch || c.full_name.toLowerCase().includes(contactSearch.toLowerCase())
  ) || [];
  const filteredProperties = properties?.filter((p) =>
    !propertySearch || p.title.toLowerCase().includes(propertySearch.toLowerCase())
  ) || [];
  const filteredProfiles = profiles?.filter((p) =>
    !assigneeSearch || (p.full_name && p.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
  ) || [];

  const selectedEditContact = contacts?.find((c) => c.id === editForm.watch('contact_id'));
  const selectedEditProperty = properties?.find((p) => p.id === editForm.watch('property_id'));
  const selectedEditAssignee = profiles?.find((p) => p.id === editForm.watch('assigned_to'));

  // ── Loading / not found states ───────────────────────────────────────────

  if (isLoadingDeal) {
    return (
      <motion.div className="space-y-6" initial="initial" animate="animate" variants={pageVariants}>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </motion.div>
    );
  }

  if (!deal) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-20"
        initial="initial"
        animate="animate"
        variants={pageVariants}
      >
        <TrendingUp className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Opportunité non trouvée</h2>
        <p className="text-muted-foreground mb-6">Cette opportunité n'existe pas ou a été supprimée.</p>
        <Button onClick={() => navigate('/deals')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au pipeline
        </Button>
      </motion.div>
    );
  }

  const stage = deal.stage as DealStage;
  const currentStageIndex = PROGRESS_STAGES.indexOf(stage);
  const tagsArray = Array.isArray(deal.tags) ? (deal.tags as string[]) : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
      {/* Hero section */}
      <HeroSection
        deal={deal}
        onEdit={() => setIsEditDialogOpen(true)}
        onNavigateBack={() => navigate('/deals')}
        onStageChange={(newStage) => stageUpdateMutation.mutate(newStage)}
        isUpdatingStage={stageUpdateMutation.isPending}
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: Overview ── */}
        <div className="space-y-6">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Vue d'ensemble
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Deal Health Score */}
              <DealHealthScore
                deal={{
                  updated_at: deal.updated_at,
                  probability: deal.probability,
                  expected_close_date: deal.expected_close_date,
                  stage: deal.stage,
                }}
                showLabel
              />

              <Separator />

              {/* Stage stepper */}
              <div>
                <p className="text-xs text-muted-foreground mb-3">Progression</p>
                <StageStepper deal={deal} currentStageIndex={currentStageIndex} />
              </div>

              <Separator />

              {/* Key metrics */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Probabilité</span>
                  <span className="font-medium">{deal.probability ?? 0} %</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taux commission</span>
                  <span className="font-medium font-mono">{deal.commission_rate ?? 5} %</span>
                </div>
                {deal.expected_close_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clôture prévue</span>
                    <span className="font-medium font-mono text-xs">
                      {formatShortDate(deal.expected_close_date)}
                    </span>
                  </div>
                )}
                {deal.actual_close_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clôture réelle</span>
                    <span className="font-medium font-mono text-xs">
                      {formatShortDate(deal.actual_close_date)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créé le</span>
                  <span className="font-medium font-mono text-xs">
                    {formatDate(deal.created_at)}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Linked contact */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Contact lié</p>
                {deal.contacts ? (
                  <button
                    onClick={() => navigate(`/contacts/${deal.contacts!.id}`)}
                    className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium hover:underline underline-offset-2">
                      {deal.contacts.full_name}
                    </span>
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* Linked property */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Bien lié</p>
                {deal.properties ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{deal.properties.title}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* Assigned to */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Assigné à</p>
                {deal.profiles?.full_name ? (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{deal.profiles.full_name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* Notes */}
              {deal.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Notes</p>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{deal.notes}</p>
                  </div>
                </>
              )}

              {/* Tags */}
              {tagsArray.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tagsArray.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: Tabs ── */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="activities">
            <TabsList className="mb-4">
              <TabsTrigger value="activities">Activités</TabsTrigger>
              <TabsTrigger value="info">Informations</TabsTrigger>
            </TabsList>

            {/* Activities tab */}
            <TabsContent value="activities">
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Activité
                    </CardTitle>
                    <Dialog open={isActivityDialogOpen} onOpenChange={handleActivityDialogChange}>
                      <Button
                        size="sm"
                        className="gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                        onClick={() => setIsActivityDialogOpen(true)}
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter
                      </Button>
                      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 backdrop-blur-xl shadow-2xl border-border rounded-xl">
                        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-6 pb-4 border-b border-border">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-semibold flex items-center gap-3">
                              <CalendarIcon className="w-5 h-5 text-purple-400" />
                              Nouvelle activité
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              Pour <span className="font-medium text-primary">{deal.name}</span>
                            </p>
                          </DialogHeader>
                        </div>
                        <Form {...activityForm}>
                          <form
                            onSubmit={activityForm.handleSubmit((v) => createActivityMutation.mutate(v))}
                            className="p-6 space-y-6"
                          >
                            {/* Détails */}
                            <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 pr-4 space-y-4">
                              <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                                Détails de l'activité
                              </h3>
                              <FormField
                                control={activityForm.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium flex items-center gap-2">
                                      <Edit3 className="w-4 h-4 text-purple-400" />
                                      Nom <span className="text-purple-400">*</span>
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Ex: Appel de suivi"
                                        className="bg-background/50 border-border focus:border-purple-500"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={activityForm.control}
                                name="type"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">
                                      Type <span className="text-purple-400">*</span>
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="bg-background/50 border-border">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {ACTIVITY_TYPES.map((type) => {
                                          const { icon: TypeIcon, dotColor } = getActivityTypeIcon(type);
                                          return (
                                            <SelectItem key={type} value={type}>
                                              <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                                <TypeIcon className="w-4 h-4 text-muted-foreground" />
                                                <span>
                                                  {ACTIVITY_TYPE_LABELS[type as keyof typeof ACTIVITY_TYPE_LABELS] || type}
                                                </span>
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={activityForm.control}
                                  name="date"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        Date <span className="text-purple-400">*</span>
                                      </FormLabel>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <FormControl>
                                            <Button
                                              variant="outline"
                                              className={cn(
                                                'pl-3 text-left font-normal bg-background/50 border-border',
                                                !field.value && 'text-muted-foreground'
                                              )}
                                            >
                                              {field.value
                                                ? format(field.value, 'd MMM yyyy', { locale: fr })
                                                : <span>Choisir</span>}
                                              <CalendarIcon className="ml-auto h-4 w-4 text-muted-foreground" />
                                            </Button>
                                          </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            locale={fr}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={activityForm.control}
                                  name="time"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        Heure <span className="text-purple-400">*</span>
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="time"
                                          className="bg-background/50 border-border"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            {/* Priorité & Statut */}
                            <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-4">
                              <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                                Priorité & Statut
                              </h3>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={activityForm.control}
                                  name="priority"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">Priorité</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="bg-background/50 border-border">
                                            <SelectValue />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {ACTIVITY_PRIORITIES.map((priority) => (
                                            <SelectItem key={priority} value={priority}>
                                              <Badge
                                                className={cn(
                                                  getPriorityColor(priority),
                                                  (priority === 'haute' || priority === 'urgente') && 'animate-pulse'
                                                )}
                                              >
                                                {ACTIVITY_PRIORITY_LABELS[priority as keyof typeof ACTIVITY_PRIORITY_LABELS] || priority}
                                              </Badge>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={activityForm.control}
                                  name="status"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">Statut</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="bg-background/50 border-border">
                                            <SelectValue />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {ACTIVITY_STATUSES.map((status) => (
                                            <SelectItem key={status} value={status}>
                                              <Badge className={getStatusColor(status)}>
                                                {ACTIVITY_STATUS_LABELS[status as keyof typeof ACTIVITY_STATUS_LABELS] || status}
                                              </Badge>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            {/* Description */}
                            <div className="border-l-2 border-border pl-4 bg-muted/20 rounded-r-xl py-4 pr-4 space-y-4">
                              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Notes & Description
                              </h3>
                              <FormField
                                control={activityForm.control}
                                name="description"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium flex items-center gap-2">
                                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                      Description
                                    </FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Décrivez l'activité..."
                                        {...field}
                                        rows={3}
                                        className="bg-background/50 border-border resize-none"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleActivityDialogChange(false)}
                              >
                                Annuler
                              </Button>
                              <Button
                                type="submit"
                                disabled={createActivityMutation.isPending}
                                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                              >
                                {createActivityMutation.isPending && (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                )}
                                Créer l'activité
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingActivities ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activities && activities.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-6">
                        {activities.map((activity, index) => {
                          const { icon: TypeIcon } = getActivityTypeIcon(activity.type);
                          return (
                            <motion.div
                              key={activity.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="relative flex gap-4 pl-2"
                            >
                              <div className="w-8 h-8 rounded-full flex items-center justify-center border border-border bg-muted/50 z-10 shrink-0">
                                <TypeIcon className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 pb-6">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium text-sm">{activity.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {ACTIVITY_TYPE_LABELS[activity.type as keyof typeof ACTIVITY_TYPE_LABELS] || activity.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {activity.date ? formatRelativeTime(activity.date) : ''}
                                  </span>
                                </div>
                                {activity.description && (
                                  <p className="text-sm text-muted-foreground mb-1">
                                    {activity.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {activity.priority && (
                                    <Badge className={cn('text-xs', getPriorityColor(activity.priority))}>
                                      {ACTIVITY_PRIORITY_LABELS[activity.priority as keyof typeof ACTIVITY_PRIORITY_LABELS] || activity.priority}
                                    </Badge>
                                  )}
                                  {activity.status && (
                                    <Badge className={cn('text-xs', getStatusColor(activity.status))}>
                                      {ACTIVITY_STATUS_LABELS[activity.status as keyof typeof ACTIVITY_STATUS_LABELS] || activity.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Aucune activité enregistrée</p>
                      <p className="text-xs mt-1">Ajoutez une activité pour commencer le suivi</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Informations tab */}
            <TabsContent value="info">
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Informations complètes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Nom', value: deal.name },
                      { label: 'Étape', value: DEAL_STAGE_LABELS[stage] },
                      { label: 'Montant', value: formatCurrency(deal.amount) },
                      { label: 'Taux commission', value: `${deal.commission_rate ?? 5} %` },
                      {
                        label: 'Commission (€)',
                        value: deal.commission_amount != null && deal.commission_amount > 0
                          ? formatCurrency(deal.commission_amount)
                          : '—',
                      },
                      { label: 'Probabilité', value: `${deal.probability ?? 0} %` },
                      { label: 'Contact', value: deal.contacts?.full_name ?? '—' },
                      { label: 'Bien', value: deal.properties?.title ?? '—' },
                      { label: 'Assigné à', value: deal.profiles?.full_name ?? '—' },
                      {
                        label: 'Clôture prévue',
                        value: deal.expected_close_date ? formatDate(deal.expected_close_date) : '—',
                      },
                      {
                        label: 'Clôture réelle',
                        value: deal.actual_close_date ? formatDate(deal.actual_close_date) : '—',
                      },
                      { label: 'Créé le', value: formatDate(deal.created_at) },
                      {
                        label: 'Mis à jour',
                        value: deal.updated_at ? formatRelativeTime(deal.updated_at) : '—',
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5 p-3 rounded-lg bg-muted/20">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                    {deal.notes && (
                      <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-muted/20 sm:col-span-2">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <span className="font-medium whitespace-pre-wrap">{deal.notes}</span>
                      </div>
                    )}
                    {tagsArray.length > 0 && (
                      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/20 sm:col-span-2">
                        <span className="text-xs text-muted-foreground">Tags</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tagsArray.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 backdrop-blur-xl shadow-2xl shadow-black/50 border-white/10 rounded-xl">
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-8 pb-6 border-b border-white/10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold flex items-center gap-3">
                <Edit className="w-6 h-6 text-purple-400" />
                Modifier l'opportunité
              </DialogTitle>
            </DialogHeader>
          </div>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((v) => updateMutation.mutate(v))}
              className="p-8 space-y-8"
            >
              {/* Informations principales */}
              <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">
                  Informations principales
                </h3>
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-white">
                        Nom <span className="text-purple-400">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 rounded-xl text-white placeholder:text-white/40"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white">
                          Montant (€) <span className="text-purple-400">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 rounded-xl text-white placeholder:text-white/40"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white">
                          Étape <span className="text-purple-400">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/10 border border-white/20 focus:border-purple-500 rounded-xl text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#1a1a1a] border-white/20">
                            {DEAL_STAGES.map((s) => (
                              <SelectItem key={s} value={s} className="focus:bg-purple-500/20">
                                {DEAL_STAGE_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Données financières */}
              <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">
                  Données financières
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="commission_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white">Commission (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            className="bg-white/10 border border-white/20 focus:border-purple-500 rounded-xl text-white placeholder:text-white/40"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 5)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="probability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white">Probabilité (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="bg-white/10 border border-white/20 focus:border-purple-500 rounded-xl text-white placeholder:text-white/40"
                            {...field}
                            onChange={(e) => {
                              userEditedProbability.current = true;
                              field.onChange(parseInt(e.target.value) || 0);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Liaisons & Assignation */}
              <div className="border-l-2 border-purple-500/30 pl-4 bg-white/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                  Liaisons & Assignation
                </h3>

                {/* Contact */}
                <FormField
                  control={editForm.control}
                  name="contact_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-400" />
                        Contact lié
                      </FormLabel>
                      <Popover open={contactOpen} onOpenChange={setContactOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'justify-between bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white',
                                !field.value && 'text-white/40 italic'
                              )}
                            >
                              {selectedEditContact ? selectedEditContact.full_name : 'Rechercher un contact...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-purple-400" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[380px] p-0 bg-[#1a1a1a] border-white/20" align="start">
                          <Command className="bg-transparent">
                            <CommandInput
                              placeholder="Rechercher un contact..."
                              value={contactSearch}
                              onValueChange={setContactSearch}
                              className="text-white placeholder:text-white/40"
                            />
                            <CommandList>
                              <CommandEmpty className="text-white/40 py-4 text-center">
                                Aucun contact trouvé
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => { field.onChange(undefined); setContactOpen(false); }}
                                  className="text-white/60 hover:bg-purple-500/20"
                                >
                                  <Check className={cn('mr-2 h-4 w-4', !field.value ? 'opacity-100 text-purple-400' : 'opacity-0')} />
                                  Aucun contact
                                </CommandItem>
                                {filteredContacts.map((contact) => (
                                  <CommandItem
                                    key={contact.id}
                                    value={contact.full_name}
                                    onSelect={() => { field.onChange(contact.id); setContactOpen(false); }}
                                    className="text-white hover:bg-purple-500/20"
                                  >
                                    <Check className={cn('mr-2 h-4 w-4', field.value === contact.id ? 'opacity-100 text-purple-400' : 'opacity-0')} />
                                    {contact.full_name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Property */}
                <FormField
                  control={editForm.control}
                  name="property_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                        <Home className="w-4 h-4 text-blue-400" />
                        Bien lié
                      </FormLabel>
                      <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'justify-between bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white',
                                !field.value && 'text-white/40 italic'
                              )}
                            >
                              {selectedEditProperty ? selectedEditProperty.title : 'Rechercher un bien...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-blue-400" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[380px] p-0 bg-[#1a1a1a] border-white/20" align="start">
                          <Command className="bg-transparent">
                            <CommandInput
                              placeholder="Rechercher un bien..."
                              value={propertySearch}
                              onValueChange={setPropertySearch}
                              className="text-white placeholder:text-white/40"
                            />
                            <CommandList>
                              <CommandEmpty className="text-white/40 py-4 text-center">
                                Aucun bien trouvé
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => { field.onChange(undefined); setPropertyOpen(false); }}
                                  className="text-white/60 hover:bg-blue-500/20"
                                >
                                  <Check className={cn('mr-2 h-4 w-4', !field.value ? 'opacity-100 text-blue-400' : 'opacity-0')} />
                                  Aucun bien
                                </CommandItem>
                                {filteredProperties.map((property) => (
                                  <CommandItem
                                    key={property.id}
                                    value={property.title}
                                    onSelect={() => { field.onChange(property.id); setPropertyOpen(false); }}
                                    className="text-white hover:bg-blue-500/20"
                                  >
                                    <Check className={cn('mr-2 h-4 w-4', field.value === property.id ? 'opacity-100 text-blue-400' : 'opacity-0')} />
                                    {property.title}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assigned to */}
                <FormField
                  control={editForm.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-400" />
                        Assigné à
                      </FormLabel>
                      <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'justify-between bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white',
                                !field.value && 'text-white/40 italic'
                              )}
                            >
                              {selectedEditAssignee
                                ? selectedEditAssignee.full_name ?? '—'
                                : 'Choisir un collaborateur...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-purple-400" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[380px] p-0 bg-[#1a1a1a] border-white/20" align="start">
                          <Command className="bg-transparent">
                            <CommandInput
                              placeholder="Rechercher un collaborateur..."
                              value={assigneeSearch}
                              onValueChange={setAssigneeSearch}
                              className="text-white placeholder:text-white/40"
                            />
                            <CommandList>
                              <CommandEmpty className="text-white/40 py-4 text-center">
                                Aucun collaborateur trouvé
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => { field.onChange(undefined); setAssigneeOpen(false); }}
                                  className="text-white/60 hover:bg-purple-500/20"
                                >
                                  <Check className={cn('mr-2 h-4 w-4', !field.value ? 'opacity-100 text-purple-400' : 'opacity-0')} />
                                  Non assigné
                                </CommandItem>
                                {filteredProfiles.map((profile) => (
                                  <CommandItem
                                    key={profile.id}
                                    value={profile.full_name ?? profile.id}
                                    onSelect={() => { field.onChange(profile.id); setAssigneeOpen(false); }}
                                    className="text-white hover:bg-purple-500/20"
                                  >
                                    <Check className={cn('mr-2 h-4 w-4', field.value === profile.id ? 'opacity-100 text-purple-400' : 'opacity-0')} />
                                    {profile.full_name ?? '—'}
                                    {profile.id === user?.id && (
                                      <span className="ml-1 text-purple-400 text-xs">(Moi)</span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Planning */}
              <div className="border-l-2 border-blue-500/30 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">
                  Planning
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="expected_close_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white">
                          Date clôture prévue
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="bg-white/10 border border-white/20 focus:border-purple-500 rounded-xl text-white"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="actual_close_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white">
                          Date clôture réelle
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="bg-white/10 border border-white/20 focus:border-purple-500 rounded-xl text-white"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Notes & Tags */}
              <div className="border-l-2 border-white/20 pl-4 bg-white/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
                  Notes & Tags
                </h3>
                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-white">Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Informations complémentaires..."
                          className="resize-none bg-white/10 border border-white/20 focus:border-purple-500 rounded-xl text-white placeholder:text-white/40"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-white">Tags</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="immo, paris, luxe"
                          className="bg-white/10 border border-white/20 focus:border-purple-500 rounded-xl text-white placeholder:text-white/40"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-white/40">Séparez les tags par une virgule</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/30 rounded-xl font-semibold h-12"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Enregistrer les modifications'
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
