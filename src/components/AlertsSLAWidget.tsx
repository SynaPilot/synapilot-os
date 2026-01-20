import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Clock, 
  Users,
  TrendingDown,
  ArrowRight,
  CheckCircle,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { differenceInDays, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Deal = Tables<'deals'>;
type Activity = Tables<'activities'>;

type Severity = 'critical' | 'warning' | 'info';

interface AlertCardProps {
  severity: Severity;
  icon: React.ReactNode;
  title: string;
  count: number;
  items?: Array<{ id: string; label: string; sublabel?: string }>;
  actionLabel: string;
  onClick: () => void;
  delay?: number;
}

function AlertCard({ 
  severity, 
  icon, 
  title, 
  count, 
  items, 
  actionLabel, 
  onClick, 
  delay = 0 
}: AlertCardProps) {
  const severityStyles = {
    critical: {
      border: 'border-accent/40',
      bg: 'bg-accent/5',
      hoverBg: 'hover:bg-accent/10',
      badge: 'bg-accent/20 text-accent border-accent/30',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent'
    },
    warning: {
      border: 'border-primary/40',
      bg: 'bg-primary/5',
      hoverBg: 'hover:bg-primary/10',
      badge: 'bg-primary/20 text-primary border-primary/30',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary'
    },
    info: {
      border: 'border-muted-foreground/20',
      bg: 'bg-muted/30',
      hoverBg: 'hover:bg-muted/50',
      badge: 'bg-muted text-muted-foreground border-muted-foreground/30',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground'
    }
  };

  const style = severityStyles[severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div 
        className={cn(
          'p-4 rounded-xl border transition-all duration-200 cursor-pointer group',
          style.border,
          style.bg,
          style.hoverBg
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', style.iconBg)}>
              {icon}
            </div>
            <div>
              <h4 className="font-semibold text-sm">{title}</h4>
              <Badge 
                variant="outline" 
                className={cn('text-[10px] mt-1', style.badge)}
              >
                {count} alerte{count > 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            {actionLabel}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        
        {items && items.length > 0 && (
          <div className="space-y-1.5 mt-3">
            {items.slice(0, 3).map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-background/40"
              >
                <span className="font-medium truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="text-muted-foreground shrink-0 ml-2">{item.sublabel}</span>
                )}
              </div>
            ))}
            {items.length > 3 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{items.length - 3} autre{items.length - 3 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function AlertsSLAWidget() {
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  
  // Fetch contacts for overdue analysis
  const { data: contacts, isLoading: contactsLoading } = useOrgQuery<Contact[]>('contacts', {
    select: '*'
  });
  
  // Fetch deals for blocked deals analysis  
  const { data: deals, isLoading: dealsLoading } = useOrgQuery<Deal[]>('deals', {
    select: '*'
  });
  
  // Fetch activities for SLA breach analysis
  const { data: activities, isLoading: activitiesLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*'
  });
  
  const isLoading = contactsLoading || dealsLoading || activitiesLoading;
  
  // Calculate alerts
  const alerts = useMemo(() => {
    // 1. Blocked deals (stage unchanged > 15 days)
    const blockedDeals = deals?.filter(d => {
      if (!d.updated_at || d.stage === 'vendu' || d.stage === 'perdu') return false;
      const daysSince = differenceInDays(new Date(), new Date(d.updated_at));
      return daysSince >= 15;
    }).map(d => ({
      id: d.id,
      label: d.name,
      sublabel: `${differenceInDays(new Date(), new Date(d.updated_at!))}j bloqué`,
      amount: d.amount
    })) || [];
    
    // 2. Overdue contacts (next_followup_date < today)
    const overdueContacts = contacts?.filter(c => {
      if (!c.next_followup_date) return false;
      return isBefore(new Date(c.next_followup_date), today);
    }).map(c => ({
      id: c.id,
      label: c.full_name,
      sublabel: `${differenceInDays(today, new Date(c.next_followup_date!))}j de retard`
    })) || [];
    
    // 3. SLA breach (activities "À faire" created > 7 days ago)
    const slaBreaches = activities?.filter(a => {
      if (!a.created_at || a.status !== 'planifie') return false;
      const daysSince = differenceInDays(new Date(), new Date(a.created_at));
      return daysSince >= 7;
    }).map(a => ({
      id: a.id,
      label: a.name,
      sublabel: `${differenceInDays(new Date(), new Date(a.created_at!))}j en attente`,
      priority: a.priority
    })) || [];
    
    return {
      blockedDeals,
      overdueContacts,
      slaBreaches
    };
  }, [contacts, deals, activities, today]);
  
  const totalAlerts = alerts.blockedDeals.length + alerts.overdueContacts.length + alerts.slaBreaches.length;
  
  // Determine overall severity
  const overallSeverity: Severity = useMemo(() => {
    if (alerts.blockedDeals.length >= 3 || alerts.slaBreaches.length >= 5) return 'critical';
    if (alerts.overdueContacts.length >= 5 || alerts.blockedDeals.length >= 1) return 'warning';
    return 'info';
  }, [alerts]);
  
  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-accent" />
            Alertes & SLA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  if (totalAlerts === 0) {
    return (
      <Card className="glass border-success/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="w-4 h-4 text-success" />
            Alertes & SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="w-10 h-10 mx-auto mb-3 text-success opacity-60" />
            <p className="text-sm font-medium text-success">Aucune alerte active</p>
            <p className="text-xs mt-1">Tous les SLA sont respectés ! 🎉</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={cn(
      'glass transition-colors',
      overallSeverity === 'critical' && 'border-accent/30',
      overallSeverity === 'warning' && 'border-primary/30'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={cn(
              'w-4 h-4',
              overallSeverity === 'critical' && 'text-accent',
              overallSeverity === 'warning' && 'text-primary',
              overallSeverity === 'info' && 'text-muted-foreground'
            )} />
            Alertes & SLA
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs',
              overallSeverity === 'critical' && 'bg-accent/10 text-accent border-accent/30',
              overallSeverity === 'warning' && 'bg-primary/10 text-primary border-primary/30'
            )}
          >
            {totalAlerts} alerte{totalAlerts > 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blocked Deals */}
        {alerts.blockedDeals.length > 0 && (
          <AlertCard
            severity={alerts.blockedDeals.length >= 3 ? 'critical' : 'warning'}
            icon={<TrendingDown className={cn(
              'w-4 h-4',
              alerts.blockedDeals.length >= 3 ? 'text-accent' : 'text-primary'
            )} />}
            title="Deals Bloqués"
            count={alerts.blockedDeals.length}
            items={alerts.blockedDeals.map(d => ({
              id: d.id,
              label: d.label,
              sublabel: d.sublabel
            }))}
            actionLabel="Voir détails"
            onClick={() => navigate('/deals')}
            delay={0}
          />
        )}
        
        {/* Overdue Contacts */}
        {alerts.overdueContacts.length > 0 && (
          <AlertCard
            severity={alerts.overdueContacts.length >= 5 ? 'critical' : 'warning'}
            icon={<Users className={cn(
              'w-4 h-4',
              alerts.overdueContacts.length >= 5 ? 'text-accent' : 'text-primary'
            )} />}
            title="Contacts à Relancer"
            count={alerts.overdueContacts.length}
            items={alerts.overdueContacts.map(c => ({
              id: c.id,
              label: c.label,
              sublabel: c.sublabel
            }))}
            actionLabel="Voir détails"
            onClick={() => navigate('/contacts?filter=overdue')}
            delay={0.1}
          />
        )}
        
        {/* SLA Breaches */}
        {alerts.slaBreaches.length > 0 && (
          <AlertCard
            severity={alerts.slaBreaches.length >= 5 ? 'critical' : 'warning'}
            icon={<Clock className={cn(
              'w-4 h-4',
              alerts.slaBreaches.length >= 5 ? 'text-accent' : 'text-primary'
            )} />}
            title="SLA en Dépassement"
            count={alerts.slaBreaches.length}
            items={alerts.slaBreaches.map(a => ({
              id: a.id,
              label: a.label,
              sublabel: a.sublabel
            }))}
            actionLabel="Voir détails"
            onClick={() => navigate('/activities')}
            delay={0.2}
          />
        )}
      </CardContent>
    </Card>
  );
}

