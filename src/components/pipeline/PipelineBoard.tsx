import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { KanbanColumnSkeleton } from '@/components/skeletons';
import {
  Flame,
  Snowflake,
  ThermometerSun,
  Building2,
  User,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import type { Deal } from '@/hooks/useDeals';
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from '@/lib/constants';
import {
  DndContext,
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

// Premium board shows all stages except 'perdu'
const PREMIUM_STAGES = DEAL_STAGES.filter((s): s is Exclude<DealStage, 'perdu'> => s !== 'perdu');

const STAGE_COLORS: Record<string, string> = {
  nouveau: 'border-l-slate-500',
  qualification: 'border-l-gray-500',
  estimation: 'border-l-purple-500',
  mandat: 'border-l-emerald-500',
  commercialisation: 'border-l-sky-500',
  visite: 'border-l-cyan-500',
  offre: 'border-l-amber-500',
  negociation: 'border-l-orange-500',
  compromis: 'border-l-blue-500',
  financement: 'border-l-indigo-500',
  acte: 'border-l-green-500',
  vendu: 'border-l-lime-500',
};

const STAGE_BG_COLORS: Record<string, string> = {
  nouveau: 'bg-slate-500/20',
  qualification: 'bg-gray-500/20',
  estimation: 'bg-purple-500/20',
  mandat: 'bg-emerald-500/20',
  commercialisation: 'bg-sky-500/20',
  visite: 'bg-cyan-500/20',
  offre: 'bg-amber-500/20',
  negociation: 'bg-orange-500/20',
  compromis: 'bg-blue-500/20',
  financement: 'bg-indigo-500/20',
  acte: 'bg-green-500/20',
  vendu: 'bg-lime-500/20',
};

type Hotness = 'cold' | 'warm' | 'hot';

function getHotness(probability: number | null): Hotness {
  if (probability != null && probability >= 70) return 'hot';
  if (probability != null && probability >= 40) return 'warm';
  return 'cold';
}

function getDealFees(deal: Deal): number {
  if (deal.commission_amount != null && deal.commission_amount > 0) {
    return deal.commission_amount;
  }
  return (deal.amount ?? 0) * ((deal.commission_rate ?? 5) / 100);
}

// ============ DEAL SUPER-CARD ============
interface DealSuperCardProps {
  deal: Deal;
  stageId: string;
  isDragging?: boolean;
}

function DealSuperCard({ deal, stageId, isDragging }: DealSuperCardProps) {
  const hotnessConfig = {
    cold: { icon: Snowflake, color: 'text-blue-400 bg-blue-400/10', label: 'Froid' },
    warm: { icon: ThermometerSun, color: 'text-amber-400 bg-amber-400/10', label: 'Tiède' },
    hot: { icon: Flame, color: 'text-red-400 bg-red-400/10', label: 'Chaud' },
  };

  const hotness = hotnessConfig[getHotness(deal.probability)];
  const HotnessIcon = hotness.icon;
  const fees = getDealFees(deal);
  const clientName = deal.contacts?.full_name ?? 'Client inconnu';
  const bgColor = STAGE_BG_COLORS[stageId] ?? 'bg-muted';

  return (
    <motion.div
      whileHover={!isDragging ? { scale: 1.02, y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <Card className={cn(
        'bg-background-tertiary/50 backdrop-blur-sm border-border/50 overflow-hidden transition-all duration-200',
        isDragging
          ? 'opacity-80 scale-105 shadow-glow rotate-1 border-primary/50'
          : 'hover:border-primary/30 hover:shadow-card-hover'
      )}>
        <CardContent className="p-0">
          {/* Top: icon + name + client */}
          <div className="flex items-center gap-3 p-3 pb-2">
            <div className={cn(
              'w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center',
              bgColor
            )}>
              <Building2 className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {deal.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">
                  {clientName}
                </p>
              </div>
            </div>
          </div>

          {/* Middle: monetary values — never truncated */}
          <div className="px-3 pb-2 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Prix</span>
              <span className="text-sm font-semibold font-mono text-foreground whitespace-nowrap">
                {formatCurrency(deal.amount ?? 0)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Com.</span>
              <span className="text-sm font-medium font-mono text-primary whitespace-nowrap">
                +{formatCurrency(fees)}
              </span>
            </div>
          </div>

          {/* Bottom: badges + recency */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0 gap-1', hotness.color)}
              >
                <HotnessIcon className="w-2.5 h-2.5" />
                {hotness.label}
              </Badge>
              {deal.probability != null && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {deal.probability}%
                </Badge>
              )}
            </div>
            {deal.updated_at && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatRelativeTime(deal.updated_at)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ SORTABLE DEAL CARD ============
function SortableDealCard({ deal, stageId }: { deal: Deal; stageId: string }) {
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
      <DealSuperCard deal={deal} stageId={stageId} isDragging={isDragging} />
    </div>
  );
}

// ============ KANBAN COLUMN ============
interface KanbanColumnProps {
  stageId: DealStage;
  stageLabel: string;
  deals: Deal[];
  totalFees: number;
}

function KanbanColumn({ stageId, stageLabel, deals, totalFees }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${stageId}`,
    data: { stage: stageId }
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-72 min-w-[18rem] rounded-xl border-l-4 bg-background-secondary/60 border border-l-0 border-border/50 flex flex-col transition-all duration-200',
        STAGE_COLORS[stageId] ?? 'border-l-primary',
        isOver && 'ring-2 ring-primary/50 bg-primary/5'
      )}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {stageLabel}
            </h3>
            <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
              {deals.length}
            </Badge>
          </div>
          <span className="text-sm font-medium text-primary font-mono">
            {formatCurrency(totalFees)}
          </span>
        </div>
      </div>

      {/* Deals List */}
      <ScrollArea className="flex-1 px-2">
        <div className="p-2 space-y-2 min-h-[200px]">
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
                  <SortableDealCard deal={deal} stageId={stageId} />
                </motion.div>
              ))}
            </AnimatePresence>
          </SortableContext>

          {deals.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Building2 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Aucune affaire</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ MAIN PIPELINE BOARD ============
interface PipelineBoardProps {
  deals?: Deal[];
  isLoading?: boolean;
  onDragEnd?: (dealId: string, newStage: string) => void;
}

export function PipelineBoard({ deals, isLoading, onDragEnd }: PipelineBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const allDeals = useMemo(() => deals ?? [], [deals]);

  // Group deals by stage (only premium stages)
  const dealsByStage = useMemo(() => {
    return PREMIUM_STAGES.reduce((acc, stage) => {
      acc[stage] = allDeals.filter((d) => d.stage === stage);
      return acc;
    }, {} as Record<string, Deal[]>);
  }, [allDeals]);

  // Calculate fees by stage
  const feesByStage = useMemo(() => {
    return PREMIUM_STAGES.reduce((acc, stage) => {
      acc[stage] = (dealsByStage[stage] ?? []).reduce((sum, d) => sum + getDealFees(d), 0);
      return acc;
    }, {} as Record<string, number>);
  }, [dealsByStage]);

  const handleDragStart = (_event: DragStartEvent) => {
    // Could set active deal state for overlay
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const overId = over.id as string;

    let targetStage: string | undefined;
    if (overId.startsWith('column-')) {
      targetStage = overId.replace('column-', '');
    }

    if (targetStage && onDragEnd) {
      // Only call if the deal actually moved to a different stage
      const currentDeal = allDeals.find((d) => d.id === dealId);
      if (currentDeal && currentDeal.stage !== targetStage) {
        onDragEnd(dealId, targetStage);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <KanbanColumnSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-h-[calc(100vh-320px)]">
          {PREMIUM_STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stageId={stage}
              stageLabel={DEAL_STAGE_LABELS[stage]}
              deals={dealsByStage[stage] ?? []}
              totalFees={feesByStage[stage] ?? 0}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DndContext>
  );
}

export default PipelineBoard;
