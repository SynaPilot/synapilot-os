import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sunrise, 
  CheckCircle, 
  Clock, 
  Phone, 
  AlertTriangle,
  Handshake,
  UserPlus,
  RefreshCw,
  PartyPopper,
  Sparkles
} from 'lucide-react';
import { format, subDays, subHours, differenceInDays, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Deal = Tables<'deals'>;
type Activity = Tables<'activities'>;

interface DailyAction {
  id: string;
  type: 'contact_call' | 'deal_followup' | 'new_lead' | 'stagnant_deal';
  priority: 'urgent' | 'important' | 'normal' | 'low';
  title: string;
  subtitle: string;
  entityId: string;
  entityType: 'contact' | 'deal';
  dueDate?: string;
  meta: {
    urgencyScore?: number;
    budget?: number;
    daysSinceLastActivity?: number;
    stage?: string;
  };
}

const priorityConfig = {
  urgent: { 
    label: 'Urgent', 
    variant: 'destructive' as const, 
    icon: AlertTriangle,
    order: 0 
  },
  important: { 
    label: 'Important', 
    variant: 'default' as const, 
    icon: Handshake,
    order: 1 
  },
  normal: { 
    label: 'À faire', 
    variant: 'secondary' as const, 
    icon: UserPlus,
    order: 2 
  },
  low: { 
    label: 'Relance', 
    variant: 'outline' as const, 
    icon: RefreshCw,
    order: 3 
  },
};

const actionTypeIcons = {
  contact_call: Phone,
  deal_followup: Handshake,
  new_lead: UserPlus,
  stagnant_deal: RefreshCw,
};

// Confetti component
function Confetti() {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    color: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 5)],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute w-2 h-2 rounded-sm"
          style={{ 
            left: `${piece.x}%`, 
            backgroundColor: piece.color,
            top: -10 
          }}
          initial={{ y: -10, opacity: 1, rotate: 0 }}
          animate={{ 
            y: 400, 
            opacity: 0, 
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1) 
          }}
          transition={{ 
            duration: piece.duration, 
            delay: piece.delay,
            ease: 'easeOut'
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  className?: string;
}

export function DailyBrief({ className }: Props) {
  const navigate = useNavigate();
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [snoozedActions, setSnoozedActions] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch data
  const { data: contacts } = useOrgQuery<Contact[]>('contacts', {
    select: '*',
    orderBy: { column: 'urgency_score', ascending: false }
  });

  const { data: deals } = useOrgQuery<Deal[]>('deals', {
    select: '*',
    orderBy: { column: 'updated_at', ascending: false }
  });

  const { data: activities } = useOrgQuery<Activity[]>('activities', {
    select: '*',
    orderBy: { column: 'date', ascending: false },
    limit: 200
  });

  // Build activity lookup by entity
  const activityLookup = useMemo(() => {
    const lookup: Record<string, Activity[]> = {};
    activities?.forEach(activity => {
      if (activity.contact_id) {
        if (!lookup[activity.contact_id]) lookup[activity.contact_id] = [];
        lookup[activity.contact_id].push(activity);
      }
      if (activity.deal_id) {
        if (!lookup[activity.deal_id]) lookup[activity.deal_id] = [];
        lookup[activity.deal_id].push(activity);
      }
    });
    return lookup;
  }, [activities]);

  // Calculate prioritized actions
  const allActions = useMemo((): DailyAction[] => {
    const actions: DailyAction[] = [];
    const now = new Date();
    const hours48Ago = subHours(now, 48);
    const hours24Ago = subHours(now, 24);
    const days5Ago = subDays(now, 5);
    const days7FromNow = subDays(now, -7);

    // P0 - Urgent: Leads with urgency_score >= 80 AND no activity in last 48h
    contacts?.forEach(contact => {
      if ((contact.urgency_score || 0) >= 80) {
        const contactActivities = activityLookup[contact.id] || [];
        const lastActivity = contactActivities[0];
        const hasRecentActivity = lastActivity && new Date(lastActivity.date) > hours48Ago;

        if (!hasRecentActivity) {
          const daysSince = lastActivity
            ? differenceInDays(now, new Date(lastActivity.date))
            : differenceInDays(now, new Date(contact.created_at));

          actions.push({
            id: `urgent-${contact.id}`,
            type: 'contact_call',
            priority: 'urgent',
            title: `Appeler ${contact.full_name}`,
            subtitle: `Lead chaud (${contact.urgency_score}/100) • Dernier contact: ${daysSince > 0 ? `il y a ${daysSince}j` : "aujourd'hui"}`,
            entityId: contact.id,
            entityType: 'contact',
            meta: {
              urgencyScore: contact.urgency_score || 0,
              daysSinceLastActivity: daysSince,
            }
          });
        }
      }
    });

    // P1 - Important: Deals in "negociation" with expected_close_date within 7 days
    deals?.forEach(deal => {
      if (deal.stage === 'negociation' && deal.expected_close_date) {
        const closeDate = new Date(deal.expected_close_date);
        if (closeDate <= days7FromNow && closeDate >= now) {
          const daysUntilClose = differenceInDays(closeDate, now);
          actions.push({
            id: `important-${deal.id}`,
            type: 'deal_followup',
            priority: 'important',
            title: `Suivre ${deal.name}`,
            subtitle: `Négociation • Clôture dans ${daysUntilClose}j${deal.amount ? ` • ${formatCurrency(deal.amount)}` : ''}`,
            entityId: deal.id,
            entityType: 'deal',
            dueDate: deal.expected_close_date,
            meta: {
              budget: deal.amount || 0,
              stage: deal.stage,
            }
          });
        }
      }
    });

    // P2 - À faire: New contacts created in last 24h in stage "nouveau"
    contacts?.forEach(contact => {
      if (contact.pipeline_stage === 'nouveau') {
        const createdAt = new Date(contact.created_at);
        if (createdAt > hours24Ago) {
          const hoursSince = differenceInHours(now, createdAt);
          actions.push({
            id: `new-${contact.id}`,
            type: 'new_lead',
            priority: 'normal',
            title: `Qualifier ${contact.full_name}`,
            subtitle: `Nouveau lead • Créé il y a ${hoursSince}h${contact.source ? ` • Source: ${contact.source}` : ''}`,
            entityId: contact.id,
            entityType: 'contact',
            meta: {
              stage: contact.pipeline_stage,
            }
          });
        }
      }
    });

    // P3 - Low: Deals with no activity in 5+ days (not closed)
    deals?.forEach(deal => {
      if (deal.stage !== 'vendu' && deal.stage !== 'perdu') {
        const dealActivities = activityLookup[deal.id] || [];
        const lastActivity = dealActivities[0];
        const lastActivityDate = lastActivity ? new Date(lastActivity.date) : new Date(deal.created_at);
        
        if (lastActivityDate < days5Ago) {
          const daysSince = differenceInDays(now, lastActivityDate);
          // Avoid duplicates with P1
          if (!(deal.stage === 'negociation' && deal.expected_close_date)) {
            actions.push({
              id: `stagnant-${deal.id}`,
              type: 'stagnant_deal',
              priority: 'low',
              title: `Relancer ${deal.name}`,
              subtitle: `Inactif depuis ${daysSince}j • ${deal.stage}${deal.amount ? ` • ${formatCurrency(deal.amount)}` : ''}`,
              entityId: deal.id,
              entityType: 'deal',
              meta: {
                daysSinceLastActivity: daysSince,
                budget: deal.amount || 0,
                stage: deal.stage,
              }
            });
          }
        }
      }
    });

    // Sort by priority order
    return actions.sort((a, b) => 
      priorityConfig[a.priority].order - priorityConfig[b.priority].order
    );
  }, [contacts, deals, activityLookup]);

  // Filter out completed and snoozed actions, limit to 5
  const visibleActions = useMemo(() => {
    return allActions
      .filter(a => !completedActions.has(a.id) && !snoozedActions.has(a.id))
      .slice(0, 5);
  }, [allActions, completedActions, snoozedActions]);

  const totalActions = Math.min(allActions.length, 5);
  const completedCount = completedActions.size;
  const progressPercent = totalActions > 0 ? (completedCount / totalActions) * 100 : 0;
  const allDone = visibleActions.length === 0 && completedCount > 0;

  const handleComplete = useCallback((actionId: string) => {
    setCompletedActions(prev => {
      const next = new Set(prev);
      next.add(actionId);
      
      // Check if this completes all actions
      const remaining = allActions
        .filter(a => !next.has(a.id) && !snoozedActions.has(a.id))
        .slice(0, 5);
      
      if (remaining.length === 0 && next.size > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
      
      return next;
    });
  }, [allActions, snoozedActions]);

  const handleSnooze = useCallback((actionId: string) => {
    setSnoozedActions(prev => {
      const next = new Set(prev);
      next.add(actionId);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setCompletedActions(new Set());
    setSnoozedActions(new Set());
  }, []);

  const handleNavigate = useCallback((action: DailyAction) => {
    if (action.entityType === 'contact') {
      navigate(`/contacts/${action.entityId}`);
    } else {
      navigate('/deals');
    }
  }, [navigate]);

  const formattedDate = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <motion.div
      className={cn("flex flex-col", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass border-white/10 relative overflow-hidden h-full">
        {showConfetti && <Confetti />}
        
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <Sunrise className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Brief du Jour
                  {allDone && <Sparkles className="w-4 h-4 text-amber-500" />}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{capitalizedDate}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {totalActions > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {completedCount}/{totalActions} complétées
                  </span>
                  <div className="w-24">
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                </div>
              )}
              
              {!allDone && visibleActions.length > 0 && (
                <Badge variant="outline" className="font-mono">
                  {visibleActions.length} action{visibleActions.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <AnimatePresence mode="popLayout">
            {/* Empty state - no actions at all */}
            {allActions.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-lg font-medium">Tout est sous contrôle ! 🎉</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Aucune action prioritaire pour le moment
                </p>
              </motion.div>
            )}

            {/* All done state */}
            {allDone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
                  <PartyPopper className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-lg font-medium">Excellent travail ! 🎉</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Vous avez traité toutes vos priorités
                </p>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Nouvelle journée
                </Button>
              </motion.div>
            )}

            {/* Action cards */}
            {visibleActions.length > 0 && (
              <div className="space-y-2">
                {visibleActions.map((action, index) => {
                  const config = priorityConfig[action.priority];
                  const ActionIcon = actionTypeIcons[action.type];
                  
                  return (
                    <motion.div
                      key={action.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className={cn(
                        "group flex items-center gap-3 p-3 rounded-lg border transition-all",
                        "bg-secondary/30 hover:bg-secondary/50 border-border/50",
                        action.priority === 'urgent' && "border-destructive/30 bg-destructive/5"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "shrink-0 p-2 rounded-lg",
                        action.priority === 'urgent' && "bg-destructive/10",
                        action.priority === 'important' && "bg-primary/10",
                        action.priority === 'normal' && "bg-secondary",
                        action.priority === 'low' && "bg-muted"
                      )}>
                        <ActionIcon className={cn(
                          "w-4 h-4",
                          action.priority === 'urgent' && "text-destructive",
                          action.priority === 'important' && "text-primary",
                          action.priority === 'normal' && "text-foreground",
                          action.priority === 'low' && "text-muted-foreground"
                        )} />
                      </div>

                      {/* Content */}
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleNavigate(action)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={config.variant} className="text-xs shrink-0">
                            {config.label}
                          </Badge>
                          <p className="font-medium text-sm truncate">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {action.subtitle}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleSnooze(action.id)}
                        >
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          Snooze
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleComplete(action.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          C'est fait
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
