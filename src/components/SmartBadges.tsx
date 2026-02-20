import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type SmartBadge } from '@/lib/smart-features';

interface SmartBadgesProps {
  badges: SmartBadge[];
  className?: string;
  compact?: boolean;
}

export function SmartBadges({ badges, className, compact = false }: SmartBadgesProps) {
  if (badges.length === 0) return null;
  
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {badges.map((badge) => (
        <Badge 
          key={badge.type}
          variant={badge.color}
          className={cn(
            'font-medium',
            compact ? 'text-[10px] px-1.5 py-0' : 'text-xs'
          )}
        >
          <span className="mr-1">{badge.icon}</span>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
