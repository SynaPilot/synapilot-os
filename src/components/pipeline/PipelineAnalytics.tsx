import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  TrendingUp, 
  TrendingDown,
  Target, 
  Euro, 
  Zap,
  ChevronDown,
  AlertTriangle,
  Clock,
  Flame,
  Lightbulb
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkline } from '@/components/charts/Sparkline';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;

interface PipelineAnalyticsProps {
  deals: Deal[] | null | undefined;
}

// Sparkline mock data generator
const generateSparklineData = (baseValue: number, variance: number = 0.2) => {
  return Array.from({ length: 12 }, () => 
    baseValue * (1 + (Math.random() - 0.5) * variance)
  );
};

export function PipelineAnalytics({ deals }: PipelineAnalyticsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stats = useMemo(() => {
    if (!deals || deals.length === 0) {
      return {
        weightedRevenue: 0,
        revenueSparkline: generateSparklineData(0),
        revenueTrend: 0,
        conversionRate: 0,
        avgCommission: 0,
        velocity: 45,
        funnelData: [],
        stalledDeals: 0,
        noFollowupDeals: 0,
        hotDeals: 0,
        totalActiveDeals: 0
      };
    }

    // Active deals (not closed)
    const activeDeals = deals.filter(d => d.stage !== 'vendu' && d.stage !== 'perdu');
    
    // Weighted Revenue = Σ(amount × probability)
    const weightedRevenue = activeDeals.reduce((sum, d) => 
      sum + ((d.amount || 0) * (d.probability || 0) / 100), 0
    );

    // Monthly trend calculation
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const thisMonthDeals = deals.filter(d => new Date(d.created_at) >= startOfMonth);
    const lastMonthDeals = deals.filter(d => {
      const date = new Date(d.created_at);
      return date >= startOfLastMonth && date <= endOfLastMonth;
    });
    
    const thisMonthRevenue = thisMonthDeals.reduce((sum, d) => 
      sum + ((d.amount || 0) * (d.probability || 0) / 100), 0
    );
    const lastMonthRevenue = lastMonthDeals.reduce((sum, d) => 
      sum + ((d.amount || 0) * (d.probability || 0) / 100), 0
    );
    
    const revenueTrend = lastMonthRevenue > 0 
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : thisMonthRevenue > 0 ? 100 : 0;

    // Conversion Rate
    const wonDeals = deals.filter(d => d.stage === 'vendu').length;
    const closedDeals = deals.filter(d => d.stage === 'vendu' || d.stage === 'perdu').length;
    const conversionRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

    // Average Commission
    const dealsWithCommission = deals.filter(d => d.commission_amount && d.commission_amount > 0);
    const avgCommission = dealsWithCommission.length > 0 
      ? dealsWithCommission.reduce((sum, d) => sum + (d.commission_amount || 0), 0) / dealsWithCommission.length
      : 0;

    // Velocity (days to close)
    const closedWithDates = deals.filter(d => 
      (d.stage === 'vendu' || d.stage === 'perdu') && d.actual_close_date
    );
    const velocity = closedWithDates.length > 0
      ? Math.round(closedWithDates.reduce((sum, d) => {
          const days = (new Date(d.actual_close_date!).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / closedWithDates.length)
      : 45;

    // Funnel data
    const funnelStages = [
      { stage: 'Prospect', key: ['nouveau', 'qualification'] },
      { stage: 'Mandat', key: ['estimation', 'mandat'] },
      { stage: 'Offre', key: ['commercialisation', 'visite', 'offre', 'negociation'] },
      { stage: 'Acte', key: ['compromis', 'financement', 'acte', 'vendu'] }
    ];

    const funnelData = funnelStages.map(({ stage, key }) => ({
      stage,
      count: deals.filter(d => key.includes(d.stage || '')).length
    }));

    // Health indicators
    const stalledDeals = activeDeals.filter(d => {
      const daysSinceUpdate = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 14;
    }).length;

    const noFollowupDeals = activeDeals.filter(d => {
      const daysSinceUpdate = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 7 && daysSinceUpdate <= 14;
    }).length;

    const hotDeals = activeDeals.filter(d => (d.probability || 0) >= 70).length;

    return {
      weightedRevenue,
      revenueSparkline: generateSparklineData(weightedRevenue, 0.15),
      revenueTrend,
      conversionRate,
      avgCommission,
      velocity,
      funnelData,
      stalledDeals,
      noFollowupDeals,
      hotDeals,
      totalActiveDeals: activeDeals.length
    };
  }, [deals]);

  const kpiCards = [
    {
      label: 'CA Pondéré',
      value: formatCurrency(stats.weightedRevenue),
      trend: stats.revenueTrend,
      icon: Euro,
      sparkline: stats.revenueSparkline,
      color: 'text-emerald-400'
    },
    {
      label: 'Taux de Transformation',
      value: `${stats.conversionRate}%`,
      icon: Target,
      sparkline: generateSparklineData(stats.conversionRate, 0.3),
      color: 'text-blue-400'
    },
    {
      label: 'Commission Moyenne',
      value: formatCurrency(stats.avgCommission),
      icon: TrendingUp,
      sparkline: generateSparklineData(stats.avgCommission, 0.2),
      color: 'text-violet-400'
    },
    {
      label: 'Vélocité',
      value: `${stats.velocity}j`,
      icon: Zap,
      sparkline: generateSparklineData(stats.velocity, 0.25),
      color: 'text-amber-400'
    }
  ];

  const funnelColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];
  const maxFunnelCount = Math.max(...stats.funnelData.map(d => d.count), 1);

  // Health bars data
  const healthBars = [
    { 
      label: 'Deals Bloqués', 
      count: stats.stalledDeals, 
      total: stats.totalActiveDeals,
      color: 'bg-red-500',
      textColor: 'text-red-400'
    },
    { 
      label: 'Sans relance > 7j', 
      count: stats.noFollowupDeals, 
      total: stats.totalActiveDeals,
      color: 'bg-orange-500',
      textColor: 'text-orange-400'
    },
    { 
      label: 'Deals Chauds', 
      count: stats.hotDeals, 
      total: stats.totalActiveDeals,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400'
    }
  ];

  const needsAttention = stats.stalledDeals + stats.noFollowupDeals;

  return (
    <div className="space-y-4">
      {/* KPI Ribbon */}
      <motion.div 
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {kpiCards.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <Card className="bg-slate-900/80 border-slate-800/60 backdrop-blur-sm overflow-hidden relative group hover:border-slate-700/80 transition-colors">
              {/* Background Sparkline */}
              <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                <Sparkline 
                  data={kpi.sparkline} 
                  width={200} 
                  height={60} 
                  color="hsl(var(--primary))"
                  showArea={true}
                  gradient={true}
                />
              </div>
              
              <CardContent className="p-4 relative z-10">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
                      {kpi.value}
                    </p>
                    {kpi.trend !== undefined && (
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        kpi.trend >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {kpi.trend >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>{kpi.trend >= 0 ? '+' : ''}{kpi.trend}%</span>
                      </div>
                    )}
                  </div>
                  <div className={cn("p-2 rounded-lg bg-slate-800/50", kpi.color)}>
                    <kpi.icon className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Collapsible Performance Panel */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/50 border border-slate-800/60 rounded-lg py-2"
          >
            <span className="text-xs font-medium">
              {isExpanded ? 'Masquer' : 'Afficher'} l'analyse détaillée
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform duration-200",
              isExpanded && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Conversion Funnel */}
                <Card className="bg-slate-900/80 border-slate-800/60 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-400" />
                      Entonnoir de Conversion
                    </h3>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={stats.funnelData} 
                          layout="vertical"
                          margin={{ top: 0, right: 20, left: 60, bottom: 0 }}
                        >
                          <XAxis 
                            type="number" 
                            hide 
                            domain={[0, maxFunnelCount]}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="stage" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            width={55}
                          />
                          <Bar 
                            dataKey="count" 
                            radius={[0, 4, 4, 0]}
                            barSize={24}
                          >
                            {stats.funnelData.map((_, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={funnelColors[index % funnelColors.length]}
                                opacity={0.9}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
                      {stats.funnelData.map((item, index) => (
                        <div key={item.stage} className="text-center">
                          <div 
                            className="text-lg font-bold tabular-nums"
                            style={{ color: funnelColors[index] }}
                          >
                            {item.count}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                            {item.stage}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Pipeline Health */}
                <Card className="bg-slate-900/80 border-slate-800/60 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      Santé du Pipeline
                    </h3>
                    
                    <div className="space-y-4">
                      {healthBars.map((bar) => (
                        <div key={bar.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{bar.label}</span>
                            <Badge 
                              variant="outline" 
                              className={cn("border-0 font-mono text-xs", bar.textColor)}
                            >
                              {bar.count}
                            </Badge>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              className={cn("h-full rounded-full", bar.color)}
                              initial={{ width: 0 }}
                              animate={{ 
                                width: bar.total > 0 
                                  ? `${Math.min((bar.count / bar.total) * 100, 100)}%` 
                                  : '0%' 
                              }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Insight */}
                    {needsAttention > 0 && (
                      <motion.div 
                        className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-200/90">
                            <span className="font-semibold">{needsAttention} deals</span> nécessitent une relance immédiate pour maintenir le momentum.
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {needsAttention === 0 && stats.hotDeals > 0 && (
                      <motion.div 
                        className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <div className="flex items-start gap-2">
                          <Flame className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-emerald-200/90">
                            Excellent ! <span className="font-semibold">{stats.hotDeals} deals chauds</span> en cours. Pipeline en bonne santé.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
