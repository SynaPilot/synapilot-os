import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Target, 
  Euro, 
  Calendar, 
  BarChart3, 
  Activity,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { DEAL_STAGE_LABELS, type DealStage } from '@/lib/constants';
import { motion } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;

interface PipelineStatsProps {
  deals: Deal[] | null | undefined;
}

export function PipelineStats({ deals }: PipelineStatsProps) {
  const stats = useMemo(() => {
    if (!deals || deals.length === 0) {
      return {
        totalWeighted: 0,
        conversionRate: 0,
        avgCommission: 0,
        dealsThisMonth: 0,
        percentageChange: 0,
        dealsCount: 0,
        stageDistribution: [],
        healthScore: 0,
        velocity: 0,
        stalledDeals: 0,
        momentum: 'Stable'
      };
    }

    // CA Pondéré = Σ(montant × probabilité)
    const activeDeals = deals.filter(d => d.stage !== 'vendu' && d.stage !== 'perdu');
    const totalWeighted = activeDeals.reduce((sum, d) => 
      sum + ((d.amount || 0) * (d.probability || 0) / 100), 0
    );

    // Taux conversion = (Deals gagnés / Total deals) × 100
    const wonDeals = deals.filter(d => d.stage === 'vendu').length;
    const closedDeals = deals.filter(d => d.stage === 'vendu' || d.stage === 'perdu').length;
    const conversionRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

    // Commission moyenne
    const dealsWithCommission = deals.filter(d => d.commission_amount && d.commission_amount > 0);
    const avgCommission = dealsWithCommission.length > 0 
      ? dealsWithCommission.reduce((sum, d) => sum + (d.commission_amount || 0), 0) / dealsWithCommission.length
      : 0;

    // Deals ce mois
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const dealsThisMonth = deals.filter(d => new Date(d.created_at) >= startOfMonth).length;
    const dealsLastMonth = deals.filter(d => {
      const date = new Date(d.created_at);
      return date >= startOfLastMonth && date <= endOfLastMonth;
    }).length;
    
    const percentageChange = dealsLastMonth > 0 
      ? Math.round(((dealsThisMonth - dealsLastMonth) / dealsLastMonth) * 100)
      : dealsThisMonth > 0 ? 100 : 0;

    // Stage distribution
    const stageAmounts: Record<string, number> = {};
    activeDeals.forEach(deal => {
      const stage = deal.stage || 'nouveau';
      stageAmounts[stage] = (stageAmounts[stage] || 0) + (deal.amount || 0);
    });
    
    const totalActiveAmount = Object.values(stageAmounts).reduce((a, b) => a + b, 0);
    const stageDistribution = Object.entries(stageAmounts)
      .map(([stage, total]) => ({
        stage: stage as DealStage,
        name: DEAL_STAGE_LABELS[stage as DealStage] || stage,
        total,
        percentage: totalActiveAmount > 0 ? Math.round((total / totalActiveAmount) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Health Score calculation
    const stalledDeals = activeDeals.filter(d => {
      const daysSinceUpdate = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 14;
    }).length;

    const stalledRatio = activeDeals.length > 0 ? stalledDeals / activeDeals.length : 0;
    const avgProbability = activeDeals.length > 0 
      ? activeDeals.reduce((sum, d) => sum + (d.probability || 0), 0) / activeDeals.length 
      : 0;
    
    // Health score: 100 - (stalled ratio * 30) + (avg probability * 0.5) + (conversion rate * 0.2)
    const healthScore = Math.min(100, Math.max(0, Math.round(
      100 - (stalledRatio * 40) + (avgProbability * 0.3) + (conversionRate * 0.3)
    )));

    // Velocity (average days in pipeline for closed deals)
    const closedWithDates = deals.filter(d => 
      (d.stage === 'vendu' || d.stage === 'perdu') && d.actual_close_date
    );
    const velocity = closedWithDates.length > 0
      ? Math.round(closedWithDates.reduce((sum, d) => {
          const days = (new Date(d.actual_close_date!).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / closedWithDates.length)
      : 45; // Default estimate

    // Momentum
    const recentActivity = deals.filter(d => {
      const daysSinceUpdate = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate < 7;
    }).length;
    const momentum = recentActivity > deals.length * 0.5 ? 'Fort' : recentActivity > deals.length * 0.2 ? 'Modéré' : 'Faible';

    return {
      totalWeighted,
      conversionRate,
      avgCommission,
      dealsThisMonth,
      percentageChange,
      dealsCount: activeDeals.length,
      stageDistribution,
      healthScore,
      velocity,
      stalledDeals,
      momentum
    };
  }, [deals]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut" as const
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 hover:scale-[1.02] transition-transform duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CA Pondéré</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {formatCurrency(stats.totalWeighted)}
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    {stats.dealsCount} opportunités
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-white/5 border-white/10 hover:scale-[1.02] transition-transform duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taux conversion</p>
                  <p className="text-3xl font-bold text-purple-400 mt-1">
                    {stats.conversionRate}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    deals conclus
                  </p>
                </div>
                <Target className="w-10 h-10 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-white/5 border-white/10 hover:scale-[1.02] transition-transform duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Commission moy.</p>
                  <p className="text-3xl font-bold text-blue-400 mt-1">
                    {formatCurrency(stats.avgCommission)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    par deal
                  </p>
                </div>
                <Euro className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-white/5 border-white/10 hover:scale-[1.02] transition-transform duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ce mois</p>
                  <p className="text-3xl font-bold text-purple-400 mt-1">
                    {stats.dealsThisMonth}
                  </p>
                  <p className={`text-xs mt-1 ${stats.percentageChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.percentageChange >= 0 ? '+' : ''}{stats.percentageChange}% vs M-1
                  </p>
                </div>
                <Calendar className="w-10 h-10 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts Row */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Distribution Chart */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Distribution pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {stats.stageDistribution.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Aucun deal actif</p>
              ) : (
                <div className="space-y-4">
                  {stats.stageDistribution.map((stage, index) => (
                    <motion.div 
                      key={stage.stage}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                    >
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-white font-medium">{stage.name}</span>
                        <span className="text-muted-foreground font-mono">
                          {formatCurrency(stage.total)}
                        </span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${stage.percentage}%` }}
                          transition={{ delay: 0.4 + index * 0.1, duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Health Score */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Activity className="w-5 h-5 text-purple-400" />
                Santé du pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-40 h-40">
                  {/* Background circle */}
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-white/10"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="url(#healthGradient)"
                      strokeWidth="12"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${stats.healthScore * 4.4} 440`}
                      initial={{ strokeDasharray: "0 440" }}
                      animate={{ strokeDasharray: `${stats.healthScore * 4.4} 440` }}
                      transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <motion.span 
                      className="text-4xl font-bold text-white"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5, duration: 0.3 }}
                    >
                      {stats.healthScore}
                    </motion.span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="text-muted-foreground">Vélocité deals :</span>
                  <span className="text-white font-medium ml-auto">{stats.velocity}j</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  <span className="text-muted-foreground">Deals bloqués :</span>
                  <span className="text-white font-medium ml-auto">{stats.stalledDeals}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-muted-foreground">Momentum :</span>
                  <span className={`font-medium ml-auto ${
                    stats.momentum === 'Fort' ? 'text-green-400' : 
                    stats.momentum === 'Modéré' ? 'text-blue-400' : 'text-orange-400'
                  }`}>{stats.momentum}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
