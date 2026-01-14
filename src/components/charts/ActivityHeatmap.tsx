import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { subDays, format, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActivityData {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  data: ActivityData[];
  months?: number;
  className?: string;
}

export function ActivityHeatmap({ data, months = 6, className }: ActivityHeatmapProps) {
  const { weeks, maxCount } = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, months * 30);
    const start = startOfWeek(startDate, { weekStartsOn: 1 });
    
    const days = eachDayOfInterval({ start, end: endDate });
    
    // Group by weeks
    const weeksArr: Date[][] = [];
    let currentWeek: Date[] = [];
    
    days.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || index === days.length - 1) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    });
    
    const max = Math.max(...data.map(d => d.count), 1);
    
    return { weeks: weeksArr, maxCount: max };
  }, [data, months]);
  
  const getCountForDate = (date: Date): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const found = data.find(d => d.date === dateStr);
    return found?.count || 0;
  };
  
  const getColorClass = (count: number): string => {
    if (count === 0) return 'bg-secondary/30';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'bg-primary/20';
    if (intensity < 0.5) return 'bg-primary/40';
    if (intensity < 0.75) return 'bg-primary/60';
    return 'bg-primary';
  };
  
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  
  return (
    <div className={cn('space-y-2', className)}>
      {/* Week day labels */}
      <div className="flex gap-1">
        <div className="w-6" /> {/* Spacer */}
        {weekDays.map((day, i) => (
          <div 
            key={i} 
            className="w-3 text-[10px] text-muted-foreground text-center"
          >
            {i % 2 === 0 ? day : ''}
          </div>
        ))}
      </div>
      
      {/* Heatmap grid */}
      <div className="flex gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day, dayIndex) => {
              const count = getCountForDate(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <Tooltip key={dayIndex}>
                  <TooltipTrigger asChild>
                    <motion.div
                      className={cn(
                        'w-3 h-3 rounded-sm cursor-pointer transition-all duration-200',
                        getColorClass(count),
                        isToday && 'ring-1 ring-primary ring-offset-1 ring-offset-background'
                      )}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ 
                        delay: weekIndex * 0.01 + dayIndex * 0.005,
                        type: 'spring',
                        stiffness: 300
                      }}
                      whileHover={{ scale: 1.5 }}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p className="font-medium">
                      {format(day, 'd MMMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-muted-foreground">
                      {count} activité{count !== 1 ? 's' : ''}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="text-xs text-muted-foreground">Moins</span>
        <div className="flex gap-1">
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
            <div
              key={intensity}
              className={cn(
                'w-3 h-3 rounded-sm',
                intensity === 0 ? 'bg-secondary/30' :
                intensity < 0.25 ? 'bg-primary/20' :
                intensity < 0.5 ? 'bg-primary/40' :
                intensity < 0.75 ? 'bg-primary/60' :
                'bg-primary'
              )}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Plus</span>
      </div>
    </div>
  );
}
