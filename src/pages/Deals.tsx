import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  TrendingUp, 
  Euro,
  Loader2,
  GripVertical,
  Calendar
} from 'lucide-react';
import { useProfile } from '@/hooks/useOrganization';
import { callN8nWebhook } from '@/lib/n8n';

const DEAL_STAGES = ['Lead', 'Qualification', 'Mandat', 'Négociation', 'Vendu', 'Perdu'] as const;

const dealSchema = z.object({
  name: z.string().min(2, 'Nom requis').max(100),
  amount: z.number().min(0, 'Montant requis'),
  commission_rate: z.number().min(0).max(100).default(5),
  probability: z.number().min(0).max(100).default(0),
  expected_close_date: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

type Deal = {
  id: string;
  name: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  stage: typeof DEAL_STAGES[number];
  probability: number;
  expected_close_date: string | null;
  created_at: string;
  contacts?: { full_name: string } | null;
};

function DealCard({ deal, onDragStart }: { deal: Deal; onDragStart: () => void }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'text-green-400';
    if (probability >= 50) return 'text-orange-400';
    return 'text-muted-foreground';
  };

  return (
    <Card 
      className="glass border-border/50 hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={onDragStart}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{deal.name}</p>
            <p className="text-lg font-display font-bold text-primary mt-1">
              {formatCurrency(deal.amount)}
            </p>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-muted-foreground">
                Commission: {formatCurrency(deal.commission_amount)}
              </span>
              <span className={getProbabilityColor(deal.probability)}>
                {deal.probability}%
              </span>
            </div>
            {deal.expected_close_date && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(deal.expected_close_date).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({ 
  stage, 
  deals, 
  onDrop,
  totalAmount
}: { 
  stage: typeof DEAL_STAGES[number]; 
  deals: Deal[];
  onDrop: (stage: typeof DEAL_STAGES[number]) => void;
  totalAmount: number;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Lead': 'border-l-blue-500',
      'Qualification': 'border-l-purple-500',
      'Mandat': 'border-l-green-500',
      'Négociation': 'border-l-orange-500',
      'Vendu': 'border-l-primary',
      'Perdu': 'border-l-red-500',
    };
    return colors[stage] || '';
  };

  return (
    <div 
      className={`flex-1 min-w-[280px] max-w-[300px] rounded-lg border-l-4 transition-colors ${getStageColor(stage)} ${
        isDragOver ? 'border-r border-t border-b border-primary bg-primary/5' : 'border-r border-t border-b border-border bg-card/50'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => {
        setIsDragOver(false);
        onDrop(stage);
      }}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-foreground">{stage}</h3>
          <Badge variant="secondary">{deals.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{formatCurrency(totalAmount)}</p>
      </div>
      <div className="p-2 space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDragStart={() => {}} />
        ))}
      </div>
    </div>
  );
}

export default function Deals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

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

  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, contacts:contact_id(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Deal[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: DealFormValues) => {
      if (!profile?.organization_id) throw new Error('Organization not found');
      
      const { data, error } = await supabase
        .from('deals')
        .insert({
          name: values.name,
          amount: values.amount,
          commission_rate: values.commission_rate,
          probability: values.probability,
          expected_close_date: values.expected_close_date || null,
          organization_id: profile.organization_id,
          stage: 'Lead' as const,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: 'Deal créé avec succès' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: typeof DEAL_STAGES[number] }) => {
      const probability = stage === 'Vendu' ? 100 : stage === 'Perdu' ? 0 : undefined;
      
      const { error } = await supabase
        .from('deals')
        .update({ stage, ...(probability !== undefined && { probability }) })
        .eq('id', id);

      if (error) throw error;

      // Trigger n8n when generating mandate
      if (stage === 'Mandat') {
        await callN8nWebhook('generate_mandate', { dealId: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const dealsByStage = DEAL_STAGES.reduce((acc, stage) => {
    acc[stage] = deals?.filter((d) => d.stage === stage) || [];
    return acc;
  }, {} as Record<typeof DEAL_STAGES[number], Deal[]>);

  const totalAmountByStage = (stage: typeof DEAL_STAGES[number]) => {
    return dealsByStage[stage].reduce((sum, deal) => sum + deal.amount, 0);
  };

  const totalPipeline = deals?.reduce((sum, deal) => {
    if (deal.stage !== 'Vendu' && deal.stage !== 'Perdu') {
      return sum + deal.amount * (deal.probability / 100);
    }
    return sum;
  }, 0) || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Deals</h1>
            <p className="text-muted-foreground">
              Pipeline pondéré: <span className="text-primary font-medium">{formatCurrency(totalPipeline)}</span>
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer un Deal</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du deal *</FormLabel>
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
                          <FormLabel>Date de clôture prévue</FormLabel>
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
                    Créer le deal
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Kanban */}
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DEAL_STAGES.map((stage) => (
              <div key={stage} className="flex-1 min-w-[280px] max-w-[300px]">
                <Skeleton className="h-[400px] w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DEAL_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage]}
                totalAmount={totalAmountByStage(stage)}
                onDrop={(newStage) => {
                  if (draggedDeal) {
                    updateStageMutation.mutate({ id: draggedDeal.id, stage: newStage });
                    setDraggedDeal(null);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
