import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { 
  TrendingUp, 
  Users, 
  HandCoins, 
  AlertTriangle, 
  Phone, 
  ArrowRight,
  Calendar,
  CheckCircle,
  Zap,
  Inbox
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/constants';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;
type Contact = Tables<'contacts'>;
type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
};

function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  subtext,
  loading,
  delay = 0
}: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  subtext?: string; 
  loading?: boolean;
  delay?: number;
}) {
  if (loading) {
    return (
      <Card className="glass">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="glass hover:border-primary/30 transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          {subtext && (
            <p className="text-xs text-muted-foreground mt-2">{subtext}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Fetch deals with useOrgQuery (automatically filtered by organization)
  const { data: deals, isLoading: dealsLoading } = useOrgQuery<Deal[]>('deals', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Fetch contacts with useOrgQuery
  const { data: contacts, isLoading: contactsLoading } = useOrgQuery<Contact[]>('contacts', {
    select: '*',
    orderBy: { column: 'urgency_score', ascending: false }
  });

  // Fetch activities with useOrgQuery
  const { data: activities, isLoading: activitiesLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*, contacts:related_contact_id(full_name)',
    orderBy: { column: 'date', ascending: false },
    limit: 10
  }, {
    refetchInterval: 30000 // Auto-refresh every 30s
  });

  // Calculate KPIs from fetched data
  const revenue = deals?.filter(d => d.stage === 'vendu').reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
  const activeDeals = deals?.filter(d => d.stage !== 'vendu' && d.stage !== 'perdu').length || 0;
  const activeLeads = contacts?.filter(c => c.pipeline_stage !== 'won' && c.pipeline_stage !== 'lost').length || 0;
  
  const today = new Date().toISOString().split('T')[0];
  const todayActivities = activities?.filter(a => a.date?.startsWith(today)).length || 0;

  // Urgent leads (high score, new stage)
  const urgentLeads = contacts?.filter(c => (c.urgency_score || 0) >= 7 && c.pipeline_stage === 'lead').slice(0, 5) || [];

  const isLoading = dealsLoading || contactsLoading || activitiesLoading;
  const hasNoData = !deals?.length && !contacts?.length && !activities?.length;

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ElementType> = {
      Call: Phone,
      Meeting: Calendar,
      Email: Zap,
    };
    return icons[type] || CheckCircle;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Cockpit</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
        </div>

        {/* Empty state for fresh organizations */}
        {!isLoading && hasNoData ? (
          <EmptyState
            icon={Inbox}
            title="Bienvenue sur Synapilot"
            description="Commencez par créer votre première opportunité ou votre premier contact pour voir vos données ici."
            action={{
              label: "Créer une opportunité",
              onClick: () => navigate('/deals')
            }}
            secondaryAction={{
              label: "Ajouter un contact",
              onClick: () => navigate('/contacts')
            }}
          />
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="CA Réalisé"
                value={formatCurrency(revenue)}
                icon={HandCoins}
                loading={isLoading}
                delay={0}
              />
              <KPICard
                title="Deals Actifs"
                value={String(activeDeals)}
                icon={TrendingUp}
                subtext="Opportunités en cours"
                loading={isLoading}
                delay={0.1}
              />
              <KPICard
                title="Contacts"
                value={String(activeLeads)}
                icon={Users}
                subtext="Contacts actifs"
                loading={isLoading}
                delay={0.2}
              />
              <KPICard
                title="Activités Aujourd'hui"
                value={String(todayActivities)}
                icon={Calendar}
                loading={isLoading}
                delay={0.3}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Urgent Leads */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
              >
                <Card className="glass">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        Focus du Jour
                      </CardTitle>
                      <CardDescription>Contacts urgents à traiter</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/contacts">
                        Voir tout <ArrowRight className="ml-1 w-3 h-3" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {contactsLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-14 w-full" />
                        ))}
                      </div>
                    ) : urgentLeads.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Aucun contact urgent</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {urgentLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                          >
                            <div>
                              <p className="font-medium text-sm">{lead.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {lead.phone || 'Pas de téléphone'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-xs font-mono">
                                {lead.urgency_score}/10
                              </Badge>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Live Activity Feed */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
              >
                <Card className="glass">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-base">Activité en Direct</CardTitle>
                      <CardDescription>Dernières actions</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/activities">
                        Voir tout <ArrowRight className="ml-1 w-3 h-3" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {activitiesLoading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : !activities?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Aucune activité récente</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {activities.map((activity) => {
                          const Icon = getActivityIcon(activity.type);
                          return (
                            <div
                              key={activity.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                            >
                              <div className="p-1.5 rounded-md bg-primary/10">
                                <Icon className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {activity.content || activity.type}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {activity.contacts?.full_name && `${activity.contacts.full_name} • `}
                                  {activity.date && formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: fr })}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {activity.status}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
