import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { calculateDealHealth, getDealHealthColor, getDealHealthLabel } from '@/lib/smart-features';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DealHealthScoreProps {
  deal: {
    updated_at?: string | null;
    probability?: number | null;
    expected_close_date?: string | null;
    stage?: string;
  };
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function DealHealthScore({ deal, showLabel = false, compact = false, className }: DealHealthScoreProps) {
  const score = calculateDealHealth(deal);
  const colorClass = getDealHealthColor(score);
  const label = getDealHealthLabel(score);
  
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1.5', className)}>
            <Activity className={cn('w-3 h-3', colorClass)} />
            <span className={cn('text-xs font-medium tabular-nums', colorClass)}>
              {score}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Santé du deal: {label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Santé
        </span>
        <span className={cn('text-xs font-semibold tabular-nums', colorClass)}>
          {score}%
        </span>
      </div>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ originX: 0 }}
      >
        <Progress 
          value={score} 
          className={cn(
            'h-1.5',
            score >= 70 && '[&>div]:bg-success',
            score >= 40 && score < 70 && '[&>div]:bg-warning',
            score < 40 && '[&>div]:bg-error'
          )}
        />
      </motion.div>
      {showLabel && (
        <span className={cn('text-xs font-medium', colorClass)}>
          {label}
        </span>
      )}
    </div>
  );
}
