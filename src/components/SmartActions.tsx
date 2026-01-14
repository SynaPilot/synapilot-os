import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Phone, 
  TrendingDown, 
  Calendar, 
  ArrowRight,
  AlertCircle,
  Clock,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Deal = Tables<'deals'>;
type Activity = Tables<'activities'>;

interface ActionCardProps {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  delay?: number;
}

function ActionCard({ priority, icon, title, description, actionLabel, onClick, delay = 0 }: ActionCardProps) {
  const priorityStyles = {
    urgent: 'border-error/30 bg-error/5 hover:bg-error/10',
    high: 'border-warning/30 bg-warning/5 hover:bg-warning/10',
    medium: 'border-primary/30 bg-primary/5 hover:bg-primary/10',
    low: 'border-border bg-muted/30 hover:bg-muted/50',
  };
  
  const priorityBadge = {
    urgent: { label: 'Urgent', variant: 'destructive' as const },
    high: { label: 'Important', variant: 'warning' as const },
    medium: { label: 'Normal', variant: 'default' as const },
    low: { label: 'Faible', variant: 'secondary' as const },
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className={cn(
        'flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer group',
        priorityStyles[priority]
      )}
      onClick={onClick}
      >
        <div className="p-2 rounded-lg bg-background/50 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{title}</h4>
            <Badge variant={priorityBadge[priority].variant} className="text-[10px]">
              {priorityBadge[priority].label}
            </Badge>
          </div>
          <p className="text-caption text-muted-foreground line-clamp-2">{description}</p>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {actionLabel}
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}

export function SmartActions() {
  const navigate = useNavigate();
  
  // Fetch contacts for cold contacts analysis
  const { data: contacts, isLoading: contactsLoading } = useOrgQuery<Contact[]>('contacts', {
    select: '*',
    orderBy: { column: 'updated_at', ascending: true }
  });
  
  // Fetch deals for stagnant deals analysis
  const { data: deals, isLoading: dealsLoading } = useOrgQuery<Deal[]>('deals', {
    select: '*',
    orderBy: { column: 'updated_at', ascending: true }
  });
  
  // Fetch today's activities
  const { data: activities, isLoading: activitiesLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*',
    orderBy: { column: 'date', ascending: true }
  });
  
  const isLoading = contactsLoading || dealsLoading || activitiesLoading;
  
  // Calculate smart actions
  const actions = useMemo(() => {
    const result: Array<{
      id: string;
      priority: 'urgent' | 'high' | 'medium' | 'low';
      icon: React.ReactNode;
      title: string;
      description: string;
      actionLabel: string;
      route: string;
    }> = [];
    
    // Cold contacts (no update in 10+ days)
    const coldContacts = contacts?.filter(c => {
      if (!c.updated_at) return false;
      const daysSince = differenceInDays(new Date(), new Date(c.updated_at));
      return daysSince >= 10 && c.pipeline_stage !== 'won' && c.pipeline_stage !== 'lost';
    }) || [];
    
    if (coldContacts.length > 0) {
      const names = coldContacts.slice(0, 3).map(c => c.full_name).join(', ');
      result.push({
        id: 'cold-contacts',
        priority: 'high',
        icon: <Phone className="w-4 h-4 text-warning" />,
        title: `${coldContacts.length} contact${coldContacts.length > 1 ? 's' : ''} à relancer`,
        description: `${names}${coldContacts.length > 3 ? ` et ${coldContacts.length - 3} autres` : ''} n'ont pas été contactés depuis 10+ jours`,
        actionLabel: 'Relancer',
        route: '/contacts'
      });
    }
    
    // Stagnant deals (no update in 7+ days)
    const stagnantDeals = deals?.filter(d => {
      if (!d.updated_at) return false;
      const daysSince = differenceInDays(new Date(), new Date(d.updated_at));
      return daysSince >= 7 && d.stage !== 'vendu' && d.stage !== 'perdu';
    }) || [];
    
    if (stagnantDeals.length > 0) {
      const names = stagnantDeals.slice(0, 2).map(d => d.name).join(' et ');
      result.push({
        id: 'stagnant-deals',
        priority: stagnantDeals.length >= 3 ? 'high' : 'medium',
        icon: <TrendingDown className="w-4 h-4 text-warning" />,
        title: `${stagnantDeals.length} deal${stagnantDeals.length > 1 ? 's' : ''} bloqué${stagnantDeals.length > 1 ? 's' : ''}`,
        description: `${names}${stagnantDeals.length > 2 ? ` et ${stagnantDeals.length - 2} autres` : ''} n'ont pas évolué depuis 7 jours`,
        actionLabel: 'Voir',
        route: '/deals'
      });
    }
    
    // Today's activities
    const today = new Date().toISOString().split('T')[0];
    const todayActivities = activities?.filter(a => a.date?.startsWith(today) && a.status !== 'Terminé') || [];
    
    if (todayActivities.length > 0) {
      const nextActivity = todayActivities[0];
      result.push({
        id: 'today-activity',
        priority: 'urgent',
        icon: <Calendar className="w-4 h-4 text-error" />,
        title: `${todayActivities.length} activité${todayActivities.length > 1 ? 's' : ''} aujourd'hui`,
        description: nextActivity.content || 'Activité à préparer',
        actionLabel: 'Préparer',
        route: '/activities'
      });
    }
    
    // Low urgency contacts that need attention
    const lowUrgencyContacts = contacts?.filter(c => 
      (c.urgency_score || 0) >= 8 && c.pipeline_stage === 'lead'
    ) || [];
    
    if (lowUrgencyContacts.length > 0) {
      result.push({
        id: 'urgent-leads',
        priority: 'high',
        icon: <Users className="w-4 h-4 text-primary" />,
        title: `${lowUrgencyContacts.length} lead${lowUrgencyContacts.length > 1 ? 's' : ''} chaud${lowUrgencyContacts.length > 1 ? 's' : ''}`,
        description: 'Prospects avec score élevé en attente de qualification',
        actionLabel: 'Qualifier',
        route: '/contacts'
      });
    }
    
    return result.slice(0, 4); // Max 4 actions
  }, [contacts, deals, activities]);
  
  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-accent" />
            Actions Recommandées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  if (actions.length === 0) {
    return (
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-accent" />
            Actions Recommandées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucune action recommandée</p>
            <p className="text-xs mt-1">Tout est à jour ! 🎉</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="glass border-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-accent" />
            Actions Recommandées
          </CardTitle>
          <Badge variant="accent">
            IA
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <ActionCard
            key={action.id}
            priority={action.priority}
            icon={action.icon}
            title={action.title}
            description={action.description}
            actionLabel={action.actionLabel}
            onClick={() => navigate(action.route)}
            delay={index * 0.1}
          />
        ))}
      </CardContent>
    </Card>
  );
}
