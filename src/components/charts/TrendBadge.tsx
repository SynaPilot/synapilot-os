import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TrendBadgeProps {
  value: number;
  suffix?: string;
  className?: string;
  showIcon?: boolean;
}

export function TrendBadge({ value, suffix = '%', className, showIcon = true }: TrendBadgeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const colorClass = isNeutral 
    ? 'bg-muted/50 text-muted-foreground' 
    : isPositive 
      ? 'bg-success/10 text-success border-success/20' 
      : 'bg-error/10 text-error border-error/20';
  
  return (
    <motion.div 
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium',
        colorClass,
        className
      )}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      <span>
        {isPositive && '+'}{value}{suffix}
      </span>
    </motion.div>
  );
}
