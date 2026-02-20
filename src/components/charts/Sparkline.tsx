import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  gradient?: boolean;
  className?: string;
  showArea?: boolean;
}

export function Sparkline({ 
  data, 
  width = 120, 
  height = 32, 
  color = 'hsl(var(--primary))',
  gradient = true,
  className,
  showArea = true
}: SparklineProps) {
  const { path, areaPath, points } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', areaPath: '', points: [] };
    }
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const padding = 4;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const pts = data.map((value, index) => ({
      x: padding + (index / (data.length - 1)) * chartWidth,
      y: padding + chartHeight - ((value - min) / range) * chartHeight
    }));
    
    // Create smooth curve using quadratic bezier
    let linePath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp = {
        x: (pts[i - 1].x + pts[i].x) / 2,
        y: pts[i - 1].y
      };
      const cp2 = {
        x: (pts[i - 1].x + pts[i].x) / 2,
        y: pts[i].y
      };
      linePath += ` C ${cp.x} ${cp.y}, ${cp2.x} ${cp2.y}, ${pts[i].x} ${pts[i].y}`;
    }
    
    // Area path
    const areaPathD = `${linePath} L ${pts[pts.length - 1].x} ${height - padding} L ${pts[0].x} ${height - padding} Z`;
    
    return { path: linePath, areaPath: areaPathD, points: pts };
  }, [data, width, height]);
  
  if (!data || data.length < 2) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground text-xs', className)}>
        Pas de données
      </div>
    );
  }
  
  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2)}`;
  
  return (
    <svg 
      width={width} 
      height={height} 
      className={cn('overflow-visible', className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      
      {/* Area fill */}
      {showArea && (
        <motion.path
          d={areaPath}
          fill={gradient ? `url(#${gradientId})` : `${color}20`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
      
      {/* Line */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      
      {/* End point */}
      {points.length > 0 && (
        <motion.circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
        />
      )}
    </svg>
  );
}
