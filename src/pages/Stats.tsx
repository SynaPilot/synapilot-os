import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  Users, 
  Home, 
  Euro,
  Target,
  Calendar,
  BarChart3,
  Download,
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { EnhancedKPICard } from '@/components/charts/EnhancedKPICard';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from '@/lib/constants';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Legend
} from 'recharts';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;
type Activity = Tables<'activities'>;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background-secondary border border-border rounded-xl p-3 shadow-modal">
        <p className="text-sm font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs text-muted-foreground">
            {entry.name}: <span className="font-medium text-foreground">{formatCurrency(entry.value)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Stats() {
  const { organizationId } = useAuth();

  // Fetch deals
  const { data: deals, isLoading: dealsLoading } = useOrgQuery<Deal[]>('deals', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Fetch activities for heatmap
  const { data: activities, isLoading: activitiesLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*',
    orderBy: { column: 'date', ascending: false }
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['statistics', organizationId],
    queryFn: async () => {
      // Contacts stats
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      const { count: newContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_stage', 'nouveau');

      const { count: wonContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_stage', 'vendu');

      // Properties stats
      const { count: totalProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      const { count: activeProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .in('status', ['disponible', 'sous_compromis']);

      const { count: soldProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'vendu');

      // Activities stats
      const { count: totalActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true });

      const { count: completedActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'termine');

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
        activities: {
          total: totalActivities || 0,
          completed: completedActivities || 0,
        },
        conversionRate,
      };
    },
  });

  const isLoading = dealsLoading || statsLoading || activitiesLoading;

  // Calculate deals stats
  const dealsStats = useMemo(() => {
    if (!deals) return { totalValue: 0, wonValue: 0, commissions: 0 };
    
    const totalValue = deals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const wonValue = deals.filter(d => d.stage === 'vendu').reduce((sum, d) => sum + (d.amount || 0), 0);
    const commissions = deals.filter(d => d.stage === 'vendu').reduce((sum, d) => sum + (d.commission_amount || 0), 0);
    
    return { totalValue, wonValue, commissions };
  }, [deals]);

  // Monthly revenue data for bar chart
  const monthlyData = useMemo(() => {
    if (!deals) return [];
    
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = new Date().getFullYear();
    
    return months.map((month, index) => {
      const monthDeals = deals.filter(d => {
        if (!d.updated_at) return false;
        const date = new Date(d.updated_at);
        return date.getFullYear() === currentYear && date.getMonth() === index && d.stage === 'vendu';
      });
      
      return {
        month,
        ca: monthDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
        commissions: monthDeals.reduce((sum, d) => sum + (d.commission_amount || 0), 0),
      };
    });
  }, [deals]);

  // Pipeline funnel data
  const funnelData = useMemo(() => {
    if (!deals) return [];
    
    const stages: DealStage[] = ['nouveau', 'estimation', 'mandat', 'visite', 'offre', 'negociation', 'compromis', 'vendu'];
    const totalDeals = deals.filter(d => d.stage !== 'perdu').length || 1;
    
    return stages.map((stage, index) => {
      const stageDeals = deals.filter(d => d.stage === stage);
      const count = stageDeals.length;
      const value = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
      
      return {
        name: DEAL_STAGE_LABELS[stage],
        count,
        value,
        percentage: Math.round((count / totalDeals) * 100),
      };
    });
  }, [deals]);

  // Activity heatmap data
  const activityHeatmapData = useMemo(() => {
    if (!activities) return [];
    
    const days = eachDayOfInterval({
      start: subDays(new Date(), 180),
      end: new Date()
    });
    
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = activities.filter(a => a.date?.startsWith(dateStr)).length;
      return { date: dateStr, count };
    });
  }, [activities]);

  // Sparkline data
  const revenueSparkline = useMemo(() => {
    if (!deals) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      return deals
        .filter(d => d.stage === 'vendu' && d.updated_at?.startsWith(date))
        .reduce((sum, d) => sum + (d.amount || 0), 0);
    });
  }, [deals]);

  return (
    <motion.div 
      className="space-y-8"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Statistiques</h1>
          <p className="text-muted-foreground">Vue d'ensemble de vos performances</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Enhanced KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EnhancedKPICard
          title="CA Réalisé"
          value={formatCurrency(dealsStats.wonValue)}
          subtext={`${formatCurrency(dealsStats.commissions)} de commissions`}
          icon={Euro}
          trend={15}
          sparklineData={revenueSparkline}
          gradientFrom="from-emerald-500/10"
          iconColor="text-emerald-500"
          loading={isLoading}
          delay={0}
        />
        <EnhancedKPICard
          title="Leads Actifs"
          value={String(stats?.contacts.total || 0)}
          subtext={`${stats?.contacts.new || 0} nouveaux`}
          icon={Users}
          trend={8}
          gradientFrom="from-blue-500/10"
          iconColor="text-blue-500"
          loading={isLoading}
          delay={0.1}
        />
        <EnhancedKPICard
          title="Biens en Portefeuille"
          value={String(stats?.properties.active || 0)}
          subtext={`${stats?.properties.sold || 0} vendus`}
          icon={Home}
          trend={-2}
          gradientFrom="from-purple-500/10"
          iconColor="text-purple-500"
          loading={isLoading}
          delay={0.2}
        />
        <EnhancedKPICard
          title="Taux de Conversion"
          value={`${stats?.conversionRate || 0}%`}
          subtext={`${stats?.contacts.won || 0} clôturés`}
          icon={Target}
          trend={5}
          gradientFrom="from-orange-500/10"
          iconColor="text-orange-500"
          loading={isLoading}
          delay={0.3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Évolution du CA
                  </CardTitle>
                  <CardDescription>Chiffre d'affaires mensuel</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="ca" 
                      fill="url(#colorCA)" 
                      radius={[8, 8, 0, 0]}
                      name="CA"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pipeline Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                Entonnoir de Conversion
              </CardTitle>
              <CardDescription>Progression des opportunités</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <FunnelChart data={funnelData} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activity Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-primary" />
              Votre Activité
            </CardTitle>
            <CardDescription>Derniers 6 mois</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ActivityHeatmap data={activityHeatmapData} months={6} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pipeline & Activities Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Value */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
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
                  <div className="flex justify-between items-center p-4 rounded-xl bg-secondary/50">
                    <span className="text-muted-foreground text-sm">Valeur totale pipeline</span>
                    <span className="text-xl font-semibold font-mono">
                      {formatCurrency(dealsStats.totalValue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl bg-success/10 border border-success/20">
                    <span className="text-success text-sm">Deals gagnés</span>
                    <span className="text-xl font-semibold text-success font-mono">
                      {formatCurrency(dealsStats.wonValue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <span className="text-primary text-sm">Commissions générées</span>
                    <span className="text-xl font-semibold text-primary font-mono">
                      {formatCurrency(dealsStats.commissions)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
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
                  <div className="flex justify-between items-center p-4 rounded-xl bg-secondary/50">
                    <span className="text-muted-foreground text-sm">Total activités</span>
                    <span className="text-xl font-semibold font-mono">
                      {stats?.activities.total || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl bg-success/10 border border-success/20">
                    <span className="text-success text-sm">Terminées</span>
                    <span className="text-xl font-semibold text-success font-mono">
                      {stats?.activities.completed || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl bg-warning/10 border border-warning/20">
                    <span className="text-warning text-sm">À faire</span>
                    <span className="text-xl font-semibold text-warning font-mono">
                      {(stats?.activities.total || 0) - (stats?.activities.completed || 0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Properties by Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Home className="w-4 h-4 text-primary" />
              Répartition des Biens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div 
                  className="p-6 rounded-xl bg-info/10 border border-info/20 text-center"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <p className="text-4xl font-bold text-info font-mono">
                    {stats?.properties.total || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Total</p>
                </motion.div>
                <motion.div 
                  className="p-6 rounded-xl bg-success/10 border border-success/20 text-center"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <p className="text-4xl font-bold text-success font-mono">
                    {stats?.properties.active || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Actifs</p>
                </motion.div>
                <motion.div 
                  className="p-6 rounded-xl bg-primary/10 border border-primary/20 text-center"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <p className="text-4xl font-bold text-primary font-mono">
                    {stats?.properties.sold || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Vendus</p>
                </motion.div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
