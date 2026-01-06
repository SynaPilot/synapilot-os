import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  Users, 
  HandCoins, 
  AlertTriangle, 
  Phone, 
  ArrowRight,
  Calendar,
  CheckCircle,
  UserPlus,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatCurrency, PIPELINE_STAGE_LABELS, DEAL_STAGE_LABELS } from '@/lib/constants';

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
  // Fetch KPI data
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      // Active leads count (not won or lost)
      const { count: activeLeads } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .not('pipeline_stage', 'in', '(won,lost)');

      // Active deals count (exclude vendu and perdu)
      const { count: activeDeals } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .not('stage', 'in', '(vendu,perdu)');

      // Won deals value for revenue
      const { data: wonDeals } = await supabase
        .from('deals')
        .select('amount')
        .eq('stage', 'vendu');

      const totalRevenue = wonDeals?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      // Today's activities
      const today = new Date().toISOString().split('T')[0];
      const { count: todayActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .gte('date', today);

      return {
        revenue: totalRevenue,
        leads: activeLeads || 0,
        deals: activeDeals || 0,
        activities: todayActivities || 0,
      };
    },
  });

  // Fetch urgent leads (high score, new stage)
  const { data: urgentLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['urgent-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, urgency_score, pipeline_stage, created_at')
        .gte('urgency_score', 7)
        .eq('pipeline_stage', 'lead')
        .order('urgency_score', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch live activity feed
  const { data: activityFeed, isLoading: feedLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id, type, status, content, date,
          contacts:related_contact_id(full_name)
        `)
        .order('date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });

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

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="CA Réalisé"
            value={formatCurrency(kpis?.revenue || 0)}
            icon={HandCoins}
            loading={kpisLoading}
            delay={0}
          />
          <KPICard
            title="Deals Actifs"
            value={String(kpis?.deals || 0)}
            icon={TrendingUp}
            subtext="Opportunités en cours"
            loading={kpisLoading}
            delay={0.1}
          />
          <KPICard
            title="Leads"
            value={String(kpis?.leads || 0)}
            icon={Users}
            subtext="Contacts actifs"
            loading={kpisLoading}
            delay={0.2}
          />
          <KPICard
            title="Activités Aujourd'hui"
            value={String(kpis?.activities || 0)}
            icon={Calendar}
            loading={kpisLoading}
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
                  <CardDescription>Leads urgents à traiter</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/leads">
                    Voir tout <ArrowRight className="ml-1 w-3 h-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : urgentLeads?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Aucun lead urgent</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {urgentLeads?.map((lead) => (
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
                {feedLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : activityFeed?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Aucune activité récente</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activityFeed?.map((activity) => {
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
                              {formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: fr })}
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
      </div>
    </DashboardLayout>
  );
}
