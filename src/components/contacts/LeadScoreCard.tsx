import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  calculateLeadScore,
  getTemperatureLabel,
  getTemperatureBadgeClasses,
  type LeadScoreResult,
  type ScoringCriterion,
} from '@/lib/scoring-engine';
import { motion } from 'framer-motion';
import {
  Flame,
  Snowflake,
  Sun,
  TrendingUp,
  Phone,
  CheckCircle,
  Sparkles,
  Target,
  CircleMinus,
  CircleAlert,
  PhoneCall,
  CalendarPlus,
  MailPlus,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Activity = Tables<'activities'>;

interface LeadScoreCardProps {
  contact: Contact;
  activities: Activity[];
  searchCriteria?: {
    id: string;
    budget_min?: number | null;
    budget_max?: number | null;
    property_types?: string[] | null;
    cities?: string[] | null;
  } | null;
  onCallNow?: () => void;
  onPrioritize?: () => void;
  compact?: boolean;
  className?: string;
}

function TemperatureIcon({ temperature, className }: { temperature: 'cold' | 'warm' | 'hot'; className?: string }) {
  const icons = {
    cold: Snowflake,
    warm: Sun,
    hot: Flame,
  };
  const Icon = icons[temperature];
  return <Icon className={className} />;
}

function ScoreGauge({ score, temperature }: { score: number; temperature: 'cold' | 'warm' | 'hot' }) {
  const getGradient = () => {
    if (temperature === 'hot') return 'from-error via-warning to-error';
    if (temperature === 'warm') return 'from-warning via-primary to-warning';
    return 'from-info via-primary to-info';
  };

  return (
    <div className="relative w-24 h-24">
      {/* Background circle */}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={cn('stroke-current', 
            temperature === 'hot' && 'text-error',
            temperature === 'warm' && 'text-warning',
            temperature === 'cold' && 'text-info'
          )}
          initial={{ strokeDasharray: '0 251.2' }}
          animate={{ strokeDasharray: `${(score / 100) * 251.2} 251.2` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-2xl font-bold tabular-nums"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function CriteriaChecklist({ criteria }: { criteria: ScoringCriterion[] }) {
  return (
    <div className="space-y-1.5">
      {criteria.map((c, i) => {
        const isPositive = c.points > 0;
        return (
          <div
            key={i}
            className={cn(
              'flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg',
              isPositive ? 'bg-success/5' : 'bg-error/5'
            )}
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {isPositive ? (
                <CheckCircle className="w-3 h-3 text-success shrink-0" />
              ) : (
                <CircleMinus className="w-3 h-3 text-error shrink-0" />
              )}
              {c.label}
            </span>
            <span
              className={cn(
                'font-semibold tabular-nums shrink-0 ml-2',
                isPositive ? 'text-success' : 'text-error'
              )}
            >
              {isPositive ? '+' : ''}{c.points}pts
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ActionRecommendation({ score, temperature }: { score: number; temperature: 'cold' | 'warm' | 'hot' }) {
  const config = (() => {
    if (score >= 80)
      return {
        icon: PhoneCall,
        text: 'Appeler immédiatement',
        sub: 'Lead chaud, conversion probable',
        style: 'border-error/30 bg-error/5 text-error',
      };
    if (score >= 60)
      return {
        icon: CalendarPlus,
        text: 'Planifier une visite',
        sub: 'Intérêt confirmé, passer à l\'action',
        style: 'border-warning/30 bg-warning/5 text-warning',
      };
    if (score >= 30)
      return {
        icon: MailPlus,
        text: 'Envoyer une relance',
        sub: 'Maintenir le contact, qualifier davantage',
        style: 'border-primary/30 bg-primary/5 text-primary',
      };
    return {
      icon: Clock,
      text: 'Enrichir le profil',
      sub: 'Manque d\'informations pour qualifier',
      style: 'border-info/30 bg-info/5 text-info',
    };
  })();

  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-3', config.style)}>
      <div className="mt-0.5 shrink-0">
        <CircleAlert className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" />
          {config.text}
        </p>
        <p className="text-[10px] opacity-70 mt-0.5">{config.sub}</p>
      </div>
    </div>
  );
}

export function LeadScoreCard({
  contact,
  activities,
  searchCriteria,
  onCallNow,
  onPrioritize,
  compact = false,
  className,
}: LeadScoreCardProps) {
  const scoreResult = useMemo(() => {
    return calculateLeadScore(contact, activities, searchCriteria);
  }, [contact, activities, searchCriteria]);

  const { score, temperature, reasons, criteria, breakdown } = scoreResult;
  const tempLabel = getTemperatureLabel(temperature);
  const tempBadgeClasses = getTemperatureBadgeClasses(temperature);

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1.5', className)}>
            <TemperatureIcon 
              temperature={temperature} 
              className={cn(
                'w-3.5 h-3.5',
                temperature === 'hot' && 'text-error',
                temperature === 'warm' && 'text-warning',
                temperature === 'cold' && 'text-info'
              )} 
            />
            <span className={cn(
              'text-xs font-semibold tabular-nums',
              temperature === 'hot' && 'text-error',
              temperature === 'warm' && 'text-warning',
              temperature === 'cold' && 'text-info'
            )}>
              {score}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={cn('text-[10px]', tempBadgeClasses)}>
                {tempLabel}
              </Badge>
              <span className="text-xs">Score: {score}/100</span>
            </div>
            {reasons.length > 0 && (
              <ul className="text-[10px] text-muted-foreground">
                {reasons.slice(0, 3).map((reason, i) => (
                  <li key={i}>• {reason}</li>
                ))}
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn('border-border bg-card/50 overflow-hidden', className)}>
        {/* Gradient accent based on temperature */}
        <div className={cn(
          'h-1 w-full bg-gradient-to-r',
          temperature === 'hot' && 'from-error via-warning to-error',
          temperature === 'warm' && 'from-warning via-primary to-warning',
          temperature === 'cold' && 'from-info via-primary to-info'
        )} />
        
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Lead Score
            <Badge className={cn('ml-auto', tempBadgeClasses)}>
              <TemperatureIcon temperature={temperature} className="w-3 h-3 mr-1" />
              {tempLabel}
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Score Gauge */}
          <div className="flex items-center gap-4">
            <ScoreGauge score={score} temperature={temperature} />
            
            <div className="flex-1 space-y-2">
              {/* Breakdown bars */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Profil</span>
                  <span className="font-medium tabular-nums">{breakdown.profile}/30</span>
                </div>
                <Progress value={(breakdown.profile / 30) * 100} className="h-1.5" />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Engagement</span>
                  <span className="font-medium tabular-nums">{breakdown.engagement}/40</span>
                </div>
                <Progress value={(breakdown.engagement / 40) * 100} className="h-1.5" />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Pipeline</span>
                  <span className="font-medium tabular-nums">{breakdown.pipeline}/30</span>
                </div>
                <Progress value={(breakdown.pipeline / 30) * 100} className="h-1.5" />
              </div>
            </div>
          </div>
          
          {/* Criteria checklist */}
          {criteria.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>Détail du scoring</span>
              </div>
              <CriteriaChecklist criteria={criteria} />
            </div>
          )}

          {/* Action recommendation */}
          <ActionRecommendation score={score} temperature={temperature} />

          {/* Action buttons for hot leads */}
          {score >= 70 && (onCallNow || onPrioritize) && (
            <div className="flex gap-2 pt-2 border-t border-border/50">
              {onCallNow && contact.phone && (
                <Button 
                  size="sm" 
                  className="flex-1 gap-1.5"
                  onClick={onCallNow}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Appeler
                </Button>
              )}
              {onPrioritize && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={onPrioritize}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Prioriser
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Compact score indicator for list views
 */
export function LeadScoreIndicator({
  contact,
  activities,
  searchCriteria,
  className,
}: {
  contact: Contact;
  activities: Activity[];
  searchCriteria?: { id: string; budget_min?: number | null; budget_max?: number | null; property_types?: string[] | null; cities?: string[] | null } | null;
  className?: string;
}) {
  const scoreResult = useMemo(() => {
    return calculateLeadScore(contact, activities, searchCriteria);
  }, [contact, activities, searchCriteria]);

  const { score, temperature } = scoreResult;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
          temperature === 'hot' && 'bg-error/10 text-error',
          temperature === 'warm' && 'bg-warning/10 text-warning',
          temperature === 'cold' && 'bg-info/10 text-info',
          className
        )}>
          <TemperatureIcon temperature={temperature} className="w-3 h-3" />
          <span className="tabular-nums">{score}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Lead Score: {score}/100 ({getTemperatureLabel(temperature)})</p>
      </TooltipContent>
    </Tooltip>
  );
}
