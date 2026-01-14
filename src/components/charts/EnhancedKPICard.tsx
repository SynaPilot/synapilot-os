import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from './Sparkline';
import { TrendBadge } from './TrendBadge';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EnhancedKPICardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  gradientFrom?: string;
  gradientTo?: string;
  loading?: boolean;
  delay?: number;
  iconColor?: string;
}

export function EnhancedKPICard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendLabel,
  sparklineData,
  gradientFrom = 'from-primary/5',
  gradientTo = 'to-transparent',
  loading = false,
  delay = 0,
  iconColor = 'text-primary'
}: EnhancedKPICardProps) {
  if (loading) {
    return (
      <Card className="glass relative overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <Skeleton className="w-16 h-6 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-28 mb-4" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="glass relative overflow-hidden hover:border-primary/30 transition-all duration-300 group">
        {/* Gradient background */}
        <div className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-100 transition-opacity duration-300',
          gradientFrom,
          gradientTo
        )} />
        
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            {/* Animated Icon */}
            <motion.div 
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                iconColor.replace('text-', 'bg-') + '/10'
              )}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Icon className={cn('w-6 h-6', iconColor)} />
            </motion.div>
            
            {/* Trend Badge */}
            {trend !== undefined && (
              <TrendBadge value={trend} />
            )}
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <motion.h3 
              className="text-3xl font-display font-bold tracking-tight"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.1 }}
            >
              {value}
            </motion.h3>
            {subtext && (
              <p className="text-xs text-muted-foreground">{subtext}</p>
            )}
            {trendLabel && (
              <p className="text-xs text-muted-foreground">{trendLabel}</p>
            )}
          </div>
          
          {/* Sparkline */}
          {sparklineData && sparklineData.length > 1 && (
            <motion.div 
              className="mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.3 }}
            >
              <Sparkline 
                data={sparklineData} 
                width={180} 
                height={40}
                color={`hsl(var(--primary))`}
              />
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
