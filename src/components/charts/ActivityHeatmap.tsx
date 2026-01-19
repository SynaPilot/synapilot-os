import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { subDays, format, startOfWeek, eachDayOfInterval, isSameDay, getMonth } from 'date-fns';
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
  const { weeks, maxCount, monthLabels } = useMemo(() => {
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
    
    // Calculate month labels positions
    const labels: { name: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    weeksArr.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0];
      const month = getMonth(firstDayOfWeek);
      if (month !== lastMonth) {
        labels.push({
          name: format(firstDayOfWeek, 'MMM', { locale: fr }),
          weekIndex
        });
        lastMonth = month;
      }
    });
    
    return { weeks: weeksArr, maxCount: max, monthLabels: labels };
  }, [data, months]);
  
  const getCountForDate = (date: Date): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const found = data.find(d => d.date === dateStr);
    return found?.count || 0;
  };
  
  const getColorClass = (count: number): string => {
    if (count === 0) return 'bg-white/5';
    if (count <= 2) return 'bg-blue-500/20';
    if (count <= 5) return 'bg-blue-500/40';
    if (count <= 10) return 'bg-purple-500/40';
    return 'bg-purple-500/60 shadow-[0_0_8px_rgba(139,92,246,0.3)]';
  };

  const getIntensityLabel = (count: number): string => {
    if (count === 0) return 'Aucune activité';
    if (count <= 2) return 'Activité faible';
    if (count <= 5) return 'Activité modérée';
    if (count <= 10) return 'Activité élevée';
    return 'Activité intense';
  };
  
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  
  return (
    <div className={cn('space-y-3', className)}>
      {/* Month labels */}
      <div className="flex pl-7">
        {monthLabels.map((label, i) => (
          <div
            key={i}
            className="text-xs text-muted-foreground capitalize"
            style={{
              marginLeft: i === 0 ? `${label.weekIndex * 14}px` : 
                `${(label.weekIndex - (monthLabels[i - 1]?.weekIndex || 0)) * 14 - 24}px`,
            }}
          >
            {label.name}
          </div>
        ))}
      </div>

      {/* Grid container */}
      <div className="flex gap-[3px]">
        {/* Week day labels */}
        <div className="flex flex-col gap-[3px] pr-1">
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className="h-3 text-[10px] text-muted-foreground flex items-center justify-end w-5"
            >
              {i % 2 === 0 ? day : ''}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
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
                          isToday && 'ring-1 ring-blue-400 ring-offset-1 ring-offset-[#111111]'
                        )}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ 
                          delay: Math.min(weekIndex * 0.005 + dayIndex * 0.002, 0.5),
                          type: 'spring',
                          stiffness: 400,
                          damping: 25
                        }}
                        whileHover={{ scale: 1.4 }}
                      />
                    </TooltipTrigger>
                    <TooltipContent 
                      className="bg-[#111111]/95 border-white/10 backdrop-blur-xl rounded-lg p-3"
                      sideOffset={8}
                    >
                      <p className="font-medium text-sm capitalize">
                        {format(day, 'EEEE d MMMM', { locale: fr })}
                      </p>
                      <p className="text-blue-400 font-semibold mt-1">
                        {count} activité{count !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getIntensityLabel(count)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <span className="text-xs text-muted-foreground">Moins</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-white/5" />
          <div className="w-3 h-3 rounded-sm bg-blue-500/20" />
          <div className="w-3 h-3 rounded-sm bg-blue-500/40" />
          <div className="w-3 h-3 rounded-sm bg-purple-500/40" />
          <div className="w-3 h-3 rounded-sm bg-purple-500/60" />
        </div>
        <span className="text-xs text-muted-foreground">Plus</span>
      </div>
    </div>
  );
}
