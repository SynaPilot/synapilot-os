import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Calendar, Loader2, Kanban } from 'lucide-react';
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
import { CSS } from '@dnd-kit/utilities';
import { DEAL_STAGES, DEAL_STAGE_LABELS, formatCurrency, type DealStage } from '@/lib/constants';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'> & {
  contacts?: { full_name: string } | null;
};

const dealSchema = z.object({
  name: z.string().min(2, 'Nom requis').max(100),
  amount: z.number().min(0, 'Montant requis'),
  commission_rate: z.number().min(0).max(100).default(5),
  probability: z.number().min(0).max(100).default(0),
  expected_close_date: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

function DealCard({ deal, isDragging }: { deal: Deal; isDragging?: boolean }) {
  const getProbabilityColor = (probability: number | null) => {
    if (!probability) return 'text-muted-foreground';
    if (probability >= 80) return 'text-success';
    if (probability >= 50) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <Card className={`glass transition-all ${isDragging ? 'opacity-50 scale-105' : 'hover:border-primary/30'}`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          <p className="font-medium text-sm truncate">{deal.name}</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(deal.amount)}
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">
              Com: {formatCurrency(deal.commission_amount || 0)}
            </span>
            <span className={getProbabilityColor(deal.probability)}>
              {deal.probability || 0}%
            </span>
          </div>
          {deal.expected_close_date && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3" />
              {new Date(deal.expected_close_date).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SortableDealCard({ deal }: { deal: Deal }) {
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
  const getStageColor = (stage: DealStage) => {
    const colors: Record<DealStage, string> = {
      nouveau: 'border-l-blue-500',
      estimation: 'border-l-purple-500',
      mandat: 'border-l-green-500',
      visite: 'border-l-cyan-500',
      offre: 'border-l-yellow-500',
      negociation: 'border-l-orange-500',
      compromis: 'border-l-pink-500',
      vendu: 'border-l-emerald-500',
      perdu: 'border-l-red-500',
    };
    return colors[stage];
  };

  return (
    <div className={`flex-shrink-0 w-72 rounded-lg border-l-4 ${getStageColor(stage)} bg-card/50 border border-l-0 border-white/5`}>
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-sm">{DEAL_STAGE_LABELS[stage]}</h3>
          <Badge variant="secondary" className="text-xs font-mono">{deals.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono">{formatCurrency(totalAmount)}</p>
      </div>
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto">
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
    </div>
  );
}

export default function Deals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: '',
      amount: 0,
      commission_rate: 5,
      probability: 0,
      expected_close_date: '',
    },
  });

  const { organizationId } = useAuth();

  // Query options for cache key consistency
  const queryOptions = {
    select: '*, contacts:contact_id(full_name)',
    orderBy: { column: 'created_at', ascending: false }
  };

  // Use organization-aware query
  const { data: deals, isLoading } = useOrgQuery<Deal[]>('deals', queryOptions);

  const createMutation = useMutation({
    mutationFn: async (values: DealFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('deals')
        .insert({
          name: values.name,
          amount: values.amount,
          commission_rate: values.commission_rate,
          probability: values.probability,
          expected_close_date: values.expected_close_date || null,
          organization_id: organizationId,
          stage: 'nouveau',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate with exact key used by useOrgQuery
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
      setIsDialogOpen(false);
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
      
      const probability = stage === 'vendu' ? 100 : stage === 'perdu' ? 0 : undefined;
      
      const { error } = await supabase
        .from('deals')
        .update({ stage, ...(probability !== undefined && { probability }) })
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      // Optimistic update with exact query key
      const queryKey = ['deals', organizationId];
      await queryClient.cancelQueries({ queryKey });
      const previousDeals = queryClient.getQueryData<Deal[]>(queryKey);
      
      queryClient.setQueryData<Deal[]>(queryKey, (old) =>
        old?.map((deal) => (deal.id === id ? { ...deal, stage } : deal))
      );
      
      return { previousDeals };
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(['deals', organizationId], context?.previousDeals);
      toast.error('Erreur lors de la mise à jour');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', organizationId] });
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
    
    // Check if dropped over a column (stage)
    const targetStage = DEAL_STAGES.find((stage) => 
      dealsByStage[stage].some((d) => d.id === overId) || stage === overId
    );
    
    if (targetStage) {
      const draggedDeal = deals?.find((d) => d.id === draggedDealId);
      if (draggedDeal && draggedDeal.stage !== targetStage) {
        updateStageMutation.mutate({ id: draggedDealId, stage: targetStage });
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
            <p className="text-muted-foreground">
              Pondéré: <span className="text-primary font-medium font-mono">{formatCurrency(totalPipeline)}</span>
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle opportunité
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer une opportunité</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input placeholder="Vente Appartement Dupont" {...field} />
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
                          <FormLabel>Montant (€) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="350000"
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
                      name="commission_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1"
                              placeholder="5"
                              {...field} 
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 5)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="probability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Probabilité (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0}
                              max={100}
                              placeholder="50"
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expected_close_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date clôture</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer l'opportunité
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DEAL_STAGES.map((stage) => (
              <div key={stage} className="flex-shrink-0 w-72">
                <Skeleton className="h-[400px] w-full" />
              </div>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {DEAL_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  deals={dealsByStage[stage]}
                  totalAmount={totalAmountByStage(stage)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </DashboardLayout>
  );
}
