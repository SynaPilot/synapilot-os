import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Home, 
  Euro,
  Target,
  Calendar,
  BarChart3
} from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

function StatCard({ 
  title, 
  value, 
  subvalue, 
  icon: Icon, 
  trend, 
  loading 
}: { 
  title: string; 
  value: string; 
  subvalue?: string;
  icon: React.ElementType; 
  trend?: { value: number; label: string }; 
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="glass">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass hover:border-primary/30 transition-all">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {subvalue && (
          <p className="text-sm text-muted-foreground mt-1">{subvalue}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value >= 0 ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-destructive" />
            )}
            <span className={`text-sm ${trend.value >= 0 ? 'text-success' : 'text-destructive'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Stats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['statistics'],
    queryFn: async () => {
      // Contacts stats
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      const { count: newContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_stage', 'lead');

      const { count: wonContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_stage', 'won');

      // Properties stats
      const { count: totalProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      const { count: activeProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Mandat', 'Sous Offre']);

      const { count: soldProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Vendu');

      // Deals stats
      const { data: deals } = await supabase
        .from('deals')
        .select('amount, commission_amount, stage');

      const totalDealsValue = deals?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const wonDealsValue = deals?.filter(d => d.stage === 'vendu')
        .reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const totalCommissions = deals?.filter(d => d.stage === 'vendu')
        .reduce((sum, d) => sum + (d.commission_amount || 0), 0) || 0;

      // Activities stats
      const { count: totalActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true });

      const { count: completedActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Terminé');

      // Calculate conversion rate
      const conversionRate = totalContacts && wonContacts 
        ? Math.round((wonContacts / totalContacts) * 100) 
        : 0;

      return {
        contacts: {
          total: totalContacts || 0,
          new: newContacts || 0,
          won: wonContacts || 0,
        },
        properties: {
          total: totalProperties || 0,
          active: activeProperties || 0,
          sold: soldProperties || 0,
        },
        deals: {
          totalValue: totalDealsValue,
          wonValue: wonDealsValue,
          commissions: totalCommissions,
        },
        activities: {
          total: totalActivities || 0,
          completed: completedActivities || 0,
        },
        conversionRate,
      };
    },
  });

  return (
    <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Statistiques</h1>
          <p className="text-muted-foreground">Vue d'ensemble de vos performances</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="CA Réalisé"
            value={formatCurrency(stats?.deals.wonValue || 0)}
            subvalue={`${formatCurrency(stats?.deals.commissions || 0)} de commissions`}
            icon={Euro}
            loading={isLoading}
          />
          <StatCard
            title="Leads Actifs"
            value={String(stats?.contacts.total || 0)}
            subvalue={`${stats?.contacts.new || 0} nouveaux`}
            icon={Users}
            loading={isLoading}
          />
          <StatCard
            title="Biens en Portefeuille"
            value={String(stats?.properties.active || 0)}
            subvalue={`${stats?.properties.sold || 0} vendus`}
            icon={Home}
            loading={isLoading}
          />
          <StatCard
            title="Taux de Conversion"
            value={`${stats?.conversionRate || 0}%`}
            subvalue={`${stats?.contacts.won || 0} clôturés`}
            icon={Target}
            loading={isLoading}
          />
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Value */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                Pipeline Commercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-secondary/50">
                    <span className="text-muted-foreground text-sm">Valeur totale pipeline</span>
                    <span className="text-xl font-semibold">
                      {formatCurrency(stats?.deals.totalValue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-success/10 border border-success/20">
                    <span className="text-success text-sm">Deals gagnés</span>
                    <span className="text-xl font-semibold text-success">
                      {formatCurrency(stats?.deals.wonValue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-primary text-sm">Commissions générées</span>
                    <span className="text-xl font-semibold text-primary">
                      {formatCurrency(stats?.deals.commissions || 0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Summary */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4 text-primary" />
                Activités
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-secondary/50">
                    <span className="text-muted-foreground text-sm">Total activités</span>
                    <span className="text-xl font-semibold">
                      {stats?.activities.total || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-success/10 border border-success/20">
                    <span className="text-success text-sm">Terminées</span>
                    <span className="text-xl font-semibold text-success">
                      {stats?.activities.completed || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <span className="text-warning text-sm">À faire</span>
                    <span className="text-xl font-semibold text-warning">
                      {(stats?.activities.total || 0) - (stats?.activities.completed || 0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Properties by Status */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Répartition des Biens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-info/10 border border-info/20 text-center">
                  <p className="text-3xl font-semibold text-info">
                    {stats?.properties.total || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-center">
                  <p className="text-3xl font-semibold text-success">
                    {stats?.properties.active || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Actifs</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-3xl font-semibold text-primary">
                    {stats?.properties.sold || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Vendus</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
