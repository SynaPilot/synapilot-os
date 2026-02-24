import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { KanbanColumnSkeleton } from '@/components/skeletons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Calendar,
  Loader2,
  Download,
  Columns,
  List,
  Sparkles,
  TrendingUp,
  Check,
  ChevronsUpDown,
  Home,
  User,
} from 'lucide-react';
import { GuidedEmptyState } from '@/components/GuidedEmptyState';
import { PipelineAnalytics } from '@/components/pipeline/PipelineAnalytics';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import * as XLSX from 'xlsx';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from '@/lib/constants';
import { formatCurrency, formatShortDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DealHealthScore } from '@/components/DealHealthScore';
import type { Tables } from '@/integrations/supabase/types';

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

type Deal = Tables<'deals'> & {
  contacts?: { full_name: string } | null;
};

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

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function DealCard({ deal, isDragging }: { deal: Deal; isDragging?: boolean }) {
  const getProbabilityColor = (probability: number | null) => {
    if (!probability) return 'text-muted-foreground';
    if (probability >= 80) return 'text-success';
    if (probability >= 50) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <motion.div
      whileHover={!isDragging ? { scale: 1.02, y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Card className={cn(
        'border-border transition-all duration-200',
        isDragging
          ? 'opacity-60 scale-105 shadow-glow rotate-2 border-primary/40'
          : 'hover:border-primary/30 hover:shadow-card-hover'
      )}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <p className="font-medium text-sm truncate">{deal.name}</p>
            <p className="text-xl font-display font-semibold text-primary">
              {formatCurrency(deal.amount)}
            </p>
            <div className="flex items-center justify-between text-caption">
              <span className="text-muted-foreground font-mono">
                Com: {formatCurrency(deal.commission_amount || 0)}
              </span>
              <span className={cn("font-medium", getProbabilityColor(deal.probability))}>
                {deal.probability || 0} %
              </span>
            </div>
            {deal.expected_close_date && (
              <p className="text-caption text-muted-foreground flex items-center gap-1.5 font-mono">
                <Calendar className="w-3 h-3" />
                {formatShortDate(deal.expected_close_date)}
              </p>
            )}
            {/* Deal Health Score */}
            <DealHealthScore
              deal={{
                updated_at: deal.updated_at,
                probability: deal.probability,
                expected_close_date: deal.expected_close_date,
                stage: deal.stage
              }}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SortableDealCard({ deal }: { deal: Deal }) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
      onClick={() => {
        if (!isDragging) navigate(`/deals/${deal.id}`);
      }}
    >
      <DealCard deal={deal} isDragging={isDragging} />
    </div>
  );
}

function KanbanColumn({
  stage,
  deals,
  totalAmount
}: {
  stage: DealStage;
  deals: Deal[];
  totalAmount: number;
}) {
  // Use droppable to make the column a valid drop target
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${stage}`,
    data: { stage }
  });

  const getStageColor = (stage: DealStage) => {
    const colors: Record<DealStage, string> = {
      nouveau: 'border-l-blue-500',
      qualification: 'border-l-slate-500',
      estimation: 'border-l-purple-500',
      mandat: 'border-l-green-500',
      commercialisation: 'border-l-sky-500',
      visite: 'border-l-cyan-500',
      offre: 'border-l-yellow-500',
      negociation: 'border-l-orange-500',
      compromis: 'border-l-pink-500',
      financement: 'border-l-indigo-500',
      acte: 'border-l-lime-500',
      vendu: 'border-l-emerald-500',
      perdu: 'border-l-red-500',
    };
    return colors[stage];
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        `flex-shrink-0 w-64 min-w-[16rem] rounded-lg border-l-4 ${getStageColor(stage)} bg-card/50 border border-l-0 border-white/10 flex flex-col transition-all duration-200`,
        isOver && 'ring-2 ring-primary/50 bg-primary/5'
      )}
    >
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-sm">{DEAL_STAGE_LABELS[stage]}</h3>
          <Badge variant="secondary" className="text-xs font-mono">{deals.length}</Badge>
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto flex-1">
        <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {deals.map((deal) => (
              <motion.div
                key={deal.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <SortableDealCard deal={deal} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
      </div>
      {/* Column Total */}
      <div className="mt-auto pt-3 pb-3 border-t border-white/10">
        <div className="flex items-center justify-between px-3">
          <span className="text-sm text-muted-foreground font-medium">Total</span>
          <span className="text-base font-semibold font-mono">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Deals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [usePremiumView, setUsePremiumView] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Combobox search state
  const [contactSearch, setContactSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const userEditedProbability = useRef(false);

  const form = useForm<DealFormValues>({
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

  const { organizationId, user } = useAuth();

  // Safe query key that works even when organizationId is null
  const dealsQueryKey = organizationId ? (['deals', organizationId] as const) : (['deals'] as const);

  // Query options for cache key consistency
  const queryOptions = {
    select: '*, contacts:contact_id(full_name)',
    orderBy: { column: 'created_at', ascending: false }
  };

  // Use organization-aware query
  const { data: deals, isLoading } = useOrgQuery<Deal[]>('deals', queryOptions);

  // Lookup lists for comboboxes
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

  // Filtered lists for comboboxes
  const filteredContacts = contacts?.filter(c =>
    !contactSearch ||
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase())
  ) || [];

  const filteredProperties = properties?.filter(p =>
    !propertySearch ||
    p.title.toLowerCase().includes(propertySearch.toLowerCase())
  ) || [];

  const filteredProfiles = profiles?.filter(p =>
    !assigneeSearch ||
    (p.full_name && p.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
  ) || [];

  // Selected item lookups for combobox trigger display
  const selectedContact = contacts?.find(c => c.id === form.watch('contact_id'));
  const selectedProperty = properties?.find(p => p.id === form.watch('property_id'));
  const selectedAssignee = profiles?.find(p => p.id === form.watch('assigned_to'));

  // Auto-suggest probability when stage changes (unless user manually edited it)
  const watchedStage = form.watch('stage');
  useEffect(() => {
    if (!userEditedProbability.current) {
      form.setValue('probability', STAGE_PROBABILITY_MAP[watchedStage as DealStage] ?? 10);
    }
  }, [watchedStage, form]);

  const createMutation = useMutation({
    mutationFn: async (values: DealFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');

      const tagsArray = values.tags
        ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const { error } = await supabase
        .from('deals')
        .insert({
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
          organization_id: organizationId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealsQueryKey });
      setIsDialogOpen(false);
      userEditedProbability.current = false;
      setContactSearch('');
      setPropertySearch('');
      setAssigneeSearch('');
      form.reset();
      toast.success('Opportunité créée avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: DealStage }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');

      const updates: { stage: DealStage; probability?: number } = { stage };
      if (stage === 'vendu') updates.probability = 100;
      else if (stage === 'perdu') updates.probability = 0;

      const { error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      if (!organizationId) return;

      await queryClient.cancelQueries({ queryKey: dealsQueryKey });
      const previousDeals = queryClient.getQueryData<Deal[]>(dealsQueryKey);

      queryClient.setQueryData<Deal[]>(dealsQueryKey, (old) =>
        old?.map((deal) => (deal.id === id ? { ...deal, stage } : deal))
      );

      return { previousDeals };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(dealsQueryKey, context?.previousDeals);
      toast.error('Erreur lors de la mise à jour');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dealsQueryKey });
    },
  });

  const dealsByStage = useMemo(() => {
    return DEAL_STAGES.reduce((acc, stage) => {
      acc[stage] = deals?.filter((d) => d.stage === stage) || [];
      return acc;
    }, {} as Record<DealStage, Deal[]>);
  }, [deals]);

  const totalAmountByStage = (stage: DealStage) => {
    return dealsByStage[stage].reduce((sum, deal) => sum + deal.amount, 0);
  };

  const totalPipeline = useMemo(() => {
    return deals?.reduce((sum, deal) => {
      if (deal.stage !== 'vendu' && deal.stage !== 'perdu') {
        return sum + deal.amount * ((deal.probability || 0) / 100);
      }
      return sum;
    }, 0) || 0;
  }, [deals]);

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals?.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const draggedDealId = active.id as string;
    const overId = over.id as string;

    // Determine target stage from over data or ID
    let targetStage: DealStage | undefined;

    // Check if dropped over a column (column IDs are "column-{stage}")
    if (overId.startsWith('column-')) {
      targetStage = overId.replace('column-', '') as DealStage;
    } else {
      // Dropped over another deal card - find which column it's in
      for (const stage of DEAL_STAGES) {
        if (dealsByStage[stage].some((d) => d.id === overId)) {
          targetStage = stage;
          break;
        }
      }
    }

    if (targetStage && DEAL_STAGES.includes(targetStage)) {
      const draggedDeal = deals?.find((d) => d.id === draggedDealId);
      if (draggedDeal && draggedDeal.stage !== targetStage) {
        console.log(`Moving deal ${draggedDealId} from ${draggedDeal.stage} to ${targetStage}`);
        updateStageMutation.mutate({ id: draggedDealId, stage: targetStage });
      }
    }
  };

  const exportToExcel = () => {
    if (!deals || deals.length === 0) {
      toast.error('Aucune donnée', {
        description: 'Il n\'y a aucun deal à exporter'
      });
      return;
    }

    // Transform deals data for Excel
    const excelData = deals.map(deal => ({
      'Titre': deal.name,
      'Montant (€)': deal.amount,
      'Statut': DEAL_STAGE_LABELS[deal.stage as DealStage] || deal.stage,
      'Probabilité (%)': deal.probability || 0,
      'Commission (€)': deal.commission_amount || 0,
      'Date de clôture': deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString('fr-FR') : '',
      'Créé le': new Date(deal.created_at).toLocaleDateString('fr-FR')
    }));

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Deals');

    // Download file
    const fileName = `deals_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success('Export réussi', {
      description: `${deals.length} deals exportés`
    });
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
            <p className="text-muted-foreground">
              Pondéré: <span className="text-primary font-medium font-mono">{formatCurrency(totalPipeline)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportToExcel} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exporter Excel
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/30">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle opportunité
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 backdrop-blur-xl shadow-2xl shadow-black/50 border-white/10 rounded-xl">

              {/* Gradient header */}
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-8 pb-6 border-b border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-semibold text-white flex items-center gap-3 antialiased">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                    Créer une opportunité
                  </DialogTitle>
                  <DialogDescription className="text-white/60 font-[Poppins]">
                    Ajoutez une nouvelle opportunité à votre pipeline
                  </DialogDescription>
                </DialogHeader>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="p-8 space-y-8">

                  {/* ── Section 1 : Informations principales ── */}
                  <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                    <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">
                      Informations principales
                    </h3>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-white">
                            Nom <span className="text-purple-400">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: Vente Appartement Dupont 75 m²"
                              className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-white">
                              Montant (€) <span className="text-purple-400">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="350000"
                                className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-white">
                              Étape <span className="text-purple-400">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white">
                                  <SelectValue placeholder="Sélectionner une étape" />
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

                  {/* ── Section 2 : Données financières ── */}
                  <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                    <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">
                      Données financières
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="commission_rate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-white">
                              Commission (%)
                              <Badge variant="outline" className="text-xs ml-2 font-normal border-white/20 text-white/50">Optionnel</Badge>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="5"
                                className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 5)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="probability"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-white">
                              Probabilité (%)
                              <Badge variant="outline" className="text-xs ml-2 font-normal border-white/20 text-white/50">Optionnel</Badge>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="50"
                                className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
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

                  {/* ── Section 3 : Liaisons & Assignation ── */}
                  <div className="border-l-2 border-purple-500/30 pl-4 bg-white/5 rounded-r-xl py-4 pr-4 space-y-6">
                    <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                      Liaisons & Assignation
                    </h3>

                    {/* Contact combobox */}
                    <FormField
                      control={form.control}
                      name="contact_id"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                            <User className="w-4 h-4 text-purple-400" />
                            Contact lié
                            <Badge variant="outline" className="text-xs ml-1 font-normal border-white/20 text-white/50">Optionnel</Badge>
                          </FormLabel>
                          <Popover open={contactOpen} onOpenChange={setContactOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "justify-between bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white",
                                    !field.value && "text-white/40 italic"
                                  )}
                                >
                                  {selectedContact ? (
                                    <div className="flex items-center gap-2 truncate">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                                        {selectedContact.full_name.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="truncate">{selectedContact.full_name}</span>
                                    </div>
                                  ) : (
                                    "Rechercher un contact..."
                                  )}
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
                                  className="text-white placeholder:text-white/40 italic"
                                />
                                <CommandList>
                                  <CommandEmpty className="text-white/40 py-4 text-center">Aucun contact trouvé</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="none"
                                      onSelect={() => {
                                        field.onChange(undefined);
                                        setContactOpen(false);
                                      }}
                                      className="text-white/60 hover:bg-purple-500/20"
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100 text-purple-400" : "opacity-0")} />
                                      Aucun contact
                                    </CommandItem>
                                    {filteredContacts.map((contact) => (
                                      <CommandItem
                                        key={contact.id}
                                        value={contact.full_name}
                                        onSelect={() => {
                                          field.onChange(contact.id);
                                          setContactOpen(false);
                                        }}
                                        className="text-white hover:bg-purple-500/20"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", field.value === contact.id ? "opacity-100 text-purple-400" : "opacity-0")} />
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-semibold text-white">
                                            {contact.full_name.charAt(0).toUpperCase()}
                                          </div>
                                          <span className={contactSearch && contact.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ? "text-purple-400" : ""}>
                                            {contact.full_name}
                                          </span>
                                        </div>
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

                    {/* Property combobox */}
                    <FormField
                      control={form.control}
                      name="property_id"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                            <Home className="w-4 h-4 text-blue-400" />
                            Bien lié
                            <Badge variant="outline" className="text-xs ml-1 font-normal border-white/20 text-white/50">Optionnel</Badge>
                          </FormLabel>
                          <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "justify-between bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 rounded-xl text-white",
                                    !field.value && "text-white/40 italic"
                                  )}
                                >
                                  {selectedProperty ? (
                                    <div className="flex items-center gap-2 truncate">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
                                        <Home className="w-3 h-3 text-white" />
                                      </div>
                                      <span className="truncate">{selectedProperty.title}</span>
                                    </div>
                                  ) : (
                                    "Rechercher un bien..."
                                  )}
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
                                  className="text-white placeholder:text-white/40 italic"
                                />
                                <CommandList>
                                  <CommandEmpty className="text-white/40 py-4 text-center">Aucun bien trouvé</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="none"
                                      onSelect={() => {
                                        field.onChange(undefined);
                                        setPropertyOpen(false);
                                      }}
                                      className="text-white/60 hover:bg-blue-500/20"
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100 text-blue-400" : "opacity-0")} />
                                      Aucun bien
                                    </CommandItem>
                                    {filteredProperties.map((property) => (
                                      <CommandItem
                                        key={property.id}
                                        value={property.title}
                                        onSelect={() => {
                                          field.onChange(property.id);
                                          setPropertyOpen(false);
                                        }}
                                        className="text-white hover:bg-blue-500/20"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", field.value === property.id ? "opacity-100 text-blue-400" : "opacity-0")} />
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                            <Home className="w-3 h-3 text-white" />
                                          </div>
                                          <span className={propertySearch && property.title.toLowerCase().includes(propertySearch.toLowerCase()) ? "text-blue-400" : ""}>
                                            {property.title}
                                          </span>
                                        </div>
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

                    {/* Assigned_to combobox */}
                    <FormField
                      control={form.control}
                      name="assigned_to"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                            <User className="w-4 h-4 text-purple-400" />
                            Assigné à
                            <Badge variant="outline" className="text-xs ml-1 font-normal border-white/20 text-white/50">Optionnel</Badge>
                          </FormLabel>
                          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "justify-between bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white",
                                    !field.value && "text-white/40 italic"
                                  )}
                                >
                                  {selectedAssignee ? (
                                    <div className="flex items-center gap-2 truncate">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                                        {(selectedAssignee.full_name ?? '?').charAt(0).toUpperCase()}
                                      </div>
                                      <span className="truncate">
                                        {selectedAssignee.full_name ?? '—'}
                                        {selectedAssignee.id === user?.id && (
                                          <span className="ml-1 text-purple-400 text-xs">(Moi)</span>
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    "Choisir un collaborateur..."
                                  )}
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
                                  className="text-white placeholder:text-white/40 italic"
                                />
                                <CommandList>
                                  <CommandEmpty className="text-white/40 py-4 text-center">Aucun collaborateur trouvé</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="none"
                                      onSelect={() => {
                                        field.onChange(undefined);
                                        setAssigneeOpen(false);
                                      }}
                                      className="text-white/60 hover:bg-purple-500/20"
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100 text-purple-400" : "opacity-0")} />
                                      Non assigné
                                    </CommandItem>
                                    {filteredProfiles.map((profile) => (
                                      <CommandItem
                                        key={profile.id}
                                        value={profile.full_name ?? profile.id}
                                        onSelect={() => {
                                          field.onChange(profile.id);
                                          setAssigneeOpen(false);
                                        }}
                                        className="text-white hover:bg-purple-500/20"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", field.value === profile.id ? "opacity-100 text-purple-400" : "opacity-0")} />
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-semibold text-white">
                                            {(profile.full_name ?? '?').charAt(0).toUpperCase()}
                                          </div>
                                          <span>
                                            {profile.full_name ?? '—'}
                                            {profile.id === user?.id && (
                                              <span className="ml-1 text-purple-400 text-xs">(Moi)</span>
                                            )}
                                          </span>
                                        </div>
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

                  {/* ── Section 4 : Planning ── */}
                  <div className="border-l-2 border-blue-500/30 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                    <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">
                      Planning
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="expected_close_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-white">
                              Date clôture prévue
                              <Badge variant="outline" className="text-xs ml-2 font-normal border-white/20 text-white/50">Optionnel</Badge>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="actual_close_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-white">
                              Date clôture réelle
                              <Badge variant="outline" className="text-xs ml-2 font-normal border-white/20 text-white/50">Optionnel</Badge>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* ── Section 5 : Notes & Tags ── */}
                  <div className="border-l-2 border-white/20 pl-4 bg-white/5 rounded-r-xl py-4 pr-4 space-y-6">
                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
                      Notes & Tags
                    </h3>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-white">
                            Notes
                            <Badge variant="outline" className="text-xs ml-2 font-normal border-white/20 text-white/50">Optionnel</Badge>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              placeholder="Informations complémentaires..."
                              className="resize-none bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-white">
                            Tags
                            <Badge variant="outline" className="text-xs ml-2 font-normal border-white/20 text-white/50">Optionnel</Badge>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="immo, paris, luxe"
                              className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
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
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/30 transition-all duration-200 hover:scale-[1.02] rounded-xl font-semibold tracking-wide text-white h-12"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Création en cours...
                      </>
                    ) : (
                      "Créer l'opportunité"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Empty state for fresh organizations */}
        {!isLoading && (!deals || deals.length === 0) ? (
          <GuidedEmptyState
            variant="deals"
            onPrimaryAction={() => setIsDialogOpen(true)}
          />
        ) : (
        <>
        {/* Pipeline Analytics Dashboard */}
        <PipelineAnalytics deals={deals} />

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Vue pipeline</h2>
          <div className="flex items-center gap-3">
            {/* Premium Toggle */}
            <Button
              variant={usePremiumView ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setUsePremiumView(!usePremiumView)}
              className={usePremiumView
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white gap-2'
                : 'text-muted-foreground hover:text-white gap-2'
              }
            >
              <Sparkles className="w-4 h-4" />
              Premium
            </Button>

            {/* Kanban/List Toggle */}
            {!usePremiumView && (
              <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className={viewMode === 'kanban' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'text-muted-foreground hover:text-white'}
                >
                  <Columns className="w-4 h-4 mr-2" />
                  Kanban
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'text-muted-foreground hover:text-white'}
                >
                  <List className="w-4 h-4 mr-2" />
                  Liste
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline View */}
        {usePremiumView ? (
          <PipelineBoard
            deals={deals}
            isLoading={isLoading}
            onDragEnd={(dealId, newStage) => {
              updateStageMutation.mutate({ id: dealId, stage: newStage as DealStage });
            }}
          />
        ) : isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6">
            {DEAL_STAGES.map((stage) => (
              <KanbanColumnSkeleton key={stage} />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6">
              {DEAL_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  deals={dealsByStage[stage]}
                  totalAmount={totalAmountByStage(stage)}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              {activeDeal ? (
                <motion.div
                  initial={{ scale: 1, rotate: 0 }}
                  animate={{ scale: 1.08, rotate: -3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="shadow-glow"
                >
                  <DealCard deal={activeDeal} isDragging />
                </motion.div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        </>
        )}
    </motion.div>
  );
}
