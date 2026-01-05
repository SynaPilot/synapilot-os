import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
      <Card className="glass border-border/50">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <p className="text-3xl font-display font-bold text-foreground">{value}</p>
        {subvalue && (
          <p className="text-sm text-muted-foreground mt-1">{subvalue}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
        .eq('pipeline_stage', 'Nouveau');

      const { count: closedContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_stage', 'Clos');

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
      const wonDealsValue = deals?.filter(d => d.stage === 'Vendu')
        .reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const totalCommissions = deals?.filter(d => d.stage === 'Vendu')
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
      const conversionRate = totalContacts && closedContacts 
        ? Math.round((closedContacts / totalContacts) * 100) 
        : 0;

      return {
        contacts: {
          total: totalContacts || 0,
          new: newContacts || 0,
          closed: closedContacts || 0,
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Statistiques</h1>
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
            subvalue={`${stats?.contacts.closed || 0} clôturés`}
            icon={Target}
            loading={isLoading}
          />
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Value */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Pipeline Commercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground">Valeur totale pipeline</span>
                    <span className="text-2xl font-display font-bold text-foreground">
                      {formatCurrency(stats?.deals.totalValue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="text-green-400">Deals gagnés</span>
                    <span className="text-2xl font-display font-bold text-green-400">
                      {formatCurrency(stats?.deals.wonValue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-primary">Commissions générées</span>
                    <span className="text-2xl font-display font-bold text-primary">
                      {formatCurrency(stats?.deals.commissions || 0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Summary */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Activités
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground">Total activités</span>
                    <span className="text-2xl font-display font-bold text-foreground">
                      {stats?.activities.total || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="text-green-400">Terminées</span>
                    <span className="text-2xl font-display font-bold text-green-400">
                      {stats?.activities.completed || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <span className="text-orange-400">À faire</span>
                    <span className="text-2xl font-display font-bold text-orange-400">
                      {(stats?.activities.total || 0) - (stats?.activities.completed || 0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Properties by Status */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Répartition des Biens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-3xl font-display font-bold text-blue-400">
                    {stats?.properties.total || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-3xl font-display font-bold text-green-400">
                    {stats?.properties.active || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Actifs</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-3xl font-display font-bold text-primary">
                    {stats?.properties.sold || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Vendus</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
