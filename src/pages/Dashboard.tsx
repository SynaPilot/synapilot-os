import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { SmartActions } from '@/components/SmartActions';
import { EnhancedKPICard } from '@/components/charts/EnhancedKPICard';
import { 
  KPICardSkeleton, 
  UrgentLeadsSkeleton, 
  ActivityFeedSkeleton 
} from '@/components/skeletons';
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
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import { SmartBadges } from '@/components/SmartBadges';
import { getContactBadges } from '@/lib/smart-features';
import { subDays, format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;
type Contact = Tables<'contacts'>;
type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
};

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

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

  // Fetch stagnant deals (no activity in 7+ days)
  const { data: stagnantDeals, isLoading: stagnantLoading } = useOrgQuery<Deal[]>('deals', {
    select: 'id, name, amount, stage, updated_at',
    orderBy: { column: 'updated_at', ascending: true },
    limit: 5
  });

  // Calculate KPIs from fetched data
  const revenue = deals?.filter(d => d.stage === 'vendu').reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
  const commissions = deals?.filter(d => d.stage === 'vendu').reduce((sum, d) => sum + (d.commission_amount || 0), 0) || 0;
  const activeDeals = deals?.filter(d => d.stage !== 'vendu' && d.stage !== 'perdu').length || 0;
  const activeLeads = contacts?.filter(c => c.pipeline_stage !== 'won' && c.pipeline_stage !== 'lost').length || 0;
  
  const today = new Date().toISOString().split('T')[0];
  const todayActivities = activities?.filter(a => a.date?.startsWith(today)).length || 0;

  // Generate sparkline data from last 7 days
  const revenueSparkline = useMemo(() => {
    if (!deals) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      return deals
        .filter(d => d.stage === 'vendu' && d.updated_at?.startsWith(date))
        .reduce((sum, d) => sum + (d.amount || 0), 0);
    });
  }, [deals]);

  const dealsSparkline = useMemo(() => {
    if (!deals) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      return deals.filter(d => d.created_at?.startsWith(date)).length;
    });
  }, [deals]);

  const contactsSparkline = useMemo(() => {
    if (!contacts) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      return contacts.filter(c => c.created_at?.startsWith(date)).length;
    });
  }, [contacts]);

  const activitiesSparkline = useMemo(() => {
    if (!activities) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      return activities.filter(a => a.date?.startsWith(date)).length;
    });
  }, [activities]);

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
    <motion.div 
      className="space-y-8"
        initial="initial"
        animate="animate"
        variants={pageVariants}
        transition={{ duration: 0.3 }}
      >
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
            {/* Enhanced KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <EnhancedKPICard
                title="CA Réalisé"
                value={formatCurrency(revenue)}
                subtext={`${formatCurrency(commissions)} de commissions`}
                icon={HandCoins}
                trend={12}
                trendLabel="vs mois dernier"
                sparklineData={revenueSparkline}
                gradientFrom="from-emerald-500/10"
                iconColor="text-emerald-500"
                loading={isLoading}
                delay={0}
              />
              <EnhancedKPICard
                title="Deals Actifs"
                value={String(activeDeals)}
                subtext="Opportunités en cours"
                icon={TrendingUp}
                trend={8}
                sparklineData={dealsSparkline}
                gradientFrom="from-blue-500/10"
                iconColor="text-blue-500"
                loading={isLoading}
                delay={0.1}
              />
              <EnhancedKPICard
                title="Contacts"
                value={String(activeLeads)}
                subtext="Contacts actifs"
                icon={Users}
                trend={-3}
                sparklineData={contactsSparkline}
                gradientFrom="from-purple-500/10"
                iconColor="text-purple-500"
                loading={isLoading}
                delay={0.2}
              />
              <EnhancedKPICard
                title="Activités Aujourd'hui"
                value={String(todayActivities)}
                subtext="Tâches planifiées"
                icon={Calendar}
                trend={0}
                sparklineData={activitiesSparkline}
                gradientFrom="from-orange-500/10"
                iconColor="text-orange-500"
                loading={isLoading}
                delay={0.3}
              />
            </div>

            {/* Stagnant Deals Widget */}
            {(() => {
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              const filteredStagnant = stagnantDeals?.filter(d => 
                d.stage !== 'vendu' && 
                d.stage !== 'perdu' && 
                d.updated_at && 
                new Date(d.updated_at) < sevenDaysAgo
              ) || [];

              return filteredStagnant.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                >
                  <Card className="glass border-orange-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        Deals Stagnants
                      </CardTitle>
                      <CardDescription>
                        Aucune activité depuis 7+ jours
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {filteredStagnant.slice(0, 5).map((deal) => {
                          const daysSinceUpdate = Math.floor(
                            (new Date().getTime() - new Date(deal.updated_at!).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          
                          return (
                            <motion.div 
                              key={deal.id}
                              className="flex items-center justify-between p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-colors cursor-pointer"
                              whileHover={{ scale: 1.01 }}
                              onClick={() => navigate('/deals')}
                            >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{deal.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {formatCurrency(deal.amount || 0)}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {deal.stage}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <p className="text-sm font-semibold text-orange-500">
                                  {daysSinceUpdate}j
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  inactif
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : null;
            })()}

            {/* Smart Actions - AI Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35 }}
            >
              <SmartActions />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Urgent Leads */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
              >
                <Card className="glass border-white/10">
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
                      <UrgentLeadsSkeleton count={3} />
                    ) : urgentLeads.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Aucun contact urgent</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {urgentLeads.map((lead) => {
                          const badges = getContactBadges({
                            last_contact_date: lead.updated_at,
                          });
                          return (
                            <motion.div
                              key={lead.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                              whileHover={{ scale: 1.01 }}
                              transition={{ duration: 0.15 }}
                            >
                              <div className="space-y-1">
                                <p className="font-medium text-sm">{lead.full_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {lead.phone || 'Pas de téléphone'}
                                </p>
                                <SmartBadges badges={badges} compact />
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive" className="text-xs font-mono">
                                  {lead.urgency_score}/10
                                </Badge>
                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                  <Phone className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </motion.div>
                          );
                        })}
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
                <Card className="glass border-white/10">
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
                      <ActivityFeedSkeleton count={5} />
                    ) : !activities?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Aucune activité récente</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {activities.map((activity, index) => {
                          const Icon = getActivityIcon(activity.type);
                          return (
                            <motion.div
                              key={activity.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.05 }}
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
                                  {activity.date && formatRelativeTime(activity.date)}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {activity.status}
                              </Badge>
                            </motion.div>
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
    </motion.div>
  );
}
