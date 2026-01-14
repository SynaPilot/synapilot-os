import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';

interface FunnelStage {
  name: string;
  count: number;
  value: number;
  percentage: number;
  color?: string;
}

interface FunnelChartProps {
  data: FunnelStage[];
  className?: string;
}

export function FunnelChart({ data, className }: FunnelChartProps) {
  const maxPercentage = Math.max(...data.map(d => d.percentage), 1);
  
  const defaultColors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-cyan-500 to-cyan-600',
    'from-orange-500 to-orange-600',
    'from-emerald-500 to-emerald-600',
    'from-rose-500 to-rose-600',
  ];
  
  return (
    <div className={cn('space-y-4', className)}>
      {data.map((stage, index) => {
        const widthPercent = (stage.percentage / maxPercentage) * 100;
        const gradientClass = stage.color || defaultColors[index % defaultColors.length];
        
        return (
          <motion.div 
            key={stage.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{stage.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {stage.count} ({stage.percentage}%)
              </span>
            </div>
            <div className="relative h-12 bg-secondary/50 rounded-xl overflow-hidden">
              <motion.div
                className={cn(
                  'absolute inset-y-0 left-0 bg-gradient-to-r rounded-xl',
                  gradientClass
                )}
                initial={{ width: 0 }}
                animate={{ width: `${widthPercent}%` }}
                transition={{ 
                  duration: 0.8, 
                  delay: index * 0.1 + 0.2,
                  ease: [0.4, 0, 0.2, 1]
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span 
                  className="text-sm font-semibold text-foreground drop-shadow-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.5 }}
                >
                  {formatCurrency(stage.value)}
                </motion.span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
