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
  Calendar 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  loading 
}: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  trend?: string; 
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50 hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <p className="text-3xl font-display font-bold text-foreground">{value}</p>
        {trend && (
          <p className="text-xs text-primary mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  // Fetch KPI data
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      // CA du mois
      const { data: moisData } = await supabase
        .from('mois')
        .select('ca_total, objectif_ca')
        .gte('month_date', firstDayOfMonth)
        .single();

      // Leads actifs
      const { count: activeLeads } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .neq('pipeline_stage', 'Clos');

      // Deals en cours
      const { count: activeDeals } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .in('stage', ['Mandat', 'Négociation']);

      return {
        ca: moisData?.ca_total || 0,
        objectif: moisData?.objectif_ca || 0,
        leads: activeLeads || 0,
        deals: activeDeals || 0,
      };
    },
  });

  // Fetch urgent leads
  const { data: urgentLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['urgent-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, urgency_score, pipeline_stage, created_at')
        .gte('urgency_score', 7)
        .eq('pipeline_stage', 'Nouveau')
        .order('urgency_score', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent activities
  const { data: recentActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id, type, status, content, date,
          contacts:related_contact_id(full_name)
        `)
        .order('date', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ElementType> = {
      Call: Phone,
      Meeting: Calendar,
    };
    return icons[type] || Calendar;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Cockpit</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="CA du Mois"
            value={formatCurrency(kpis?.ca || 0)}
            icon={HandCoins}
            trend={kpis?.objectif ? `Objectif: ${formatCurrency(kpis.objectif)}` : undefined}
            loading={kpisLoading}
          />
          <KPICard
            title="Leads Actifs"
            value={String(kpis?.leads || 0)}
            icon={Users}
            loading={kpisLoading}
          />
          <KPICard
            title="Deals en Cours"
            value={String(kpis?.deals || 0)}
            icon={TrendingUp}
            loading={kpisLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Urgent Leads */}
          <Card className="glass border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Focus du Jour
                </CardTitle>
                <CardDescription>Leads urgents à traiter</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/leads">
                  Voir tout <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : urgentLeads?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucun lead urgent</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {urgentLeads?.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{lead.full_name}</p>
                        <p className="text-sm text-muted-foreground">{lead.phone || 'Pas de téléphone'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          Score: {lead.urgency_score}
                        </Badge>
                        <Button size="sm" variant="outline">
                          <Phone className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card className="glass border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Activités Récentes</CardTitle>
                <CardDescription>Dernières actions enregistrées</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/activities">
                  Voir tout <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentActivities?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune activité récente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivities?.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {activity.content || activity.type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.contacts?.full_name && `${activity.contacts.full_name} • `}
                            {formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
