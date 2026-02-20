import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GuidedEmptyState } from '@/components/GuidedEmptyState';
import { AlertsSLAWidget } from '@/components/AlertsSLAWidget';
import { DailyBrief } from '@/components/DailyBrief';
import {
  ActivityFeedSkeleton
} from '@/components/skeletons';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useRole } from '@/hooks/useRole';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  DollarSign,
  Eye,
  Home,
  Phone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  UserPlus,
  Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatCurrency, formatRelativeTime, formatCompactNumber } from '@/lib/formatters';
import { MarketPulse } from '@/components/dashboard/MarketPulse';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;
type Contact = Tables<'contacts'>;
type Property = Tables<'properties'>;
type PropertyProposal = Tables<'property_proposals'>;
type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
};
type DealWithProfile = Deal & {
  profiles: { full_name: string } | null;
};

// Orchestrated stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const tierVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ── Data calculation helpers ──

function calculateMonthlyRevenue(deals: Deal[], months: number) {
  const now = new Date();
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const revenue = deals
      .filter(d =>
        d.stage === 'vendu' &&
        d.updated_at &&
        new Date(d.updated_at) >= monthDate &&
        new Date(d.updated_at) <= monthEnd
      )
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    result.push({
      month: monthDate.toLocaleDateString('fr-FR', { month: 'short' }),
      revenue
    });
  }

  return result;
}

function calculateTrend(current: number, previous: number): { value: string; positive: boolean } {
  if (previous === 0) return { value: current > 0 ? '+100%' : '—', positive: current >= 0 };
  const change = ((current - previous) / previous) * 100;
  return {
    value: `${change >= 0 ? '+' : ''}${Math.round(change)}%`,
    positive: change >= 0
  };
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getStartOfLastWeek(): Date {
  const start = getStartOfWeek();
  start.setDate(start.getDate() - 7);
  return start;
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getStartOfLastMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [chartRange, setChartRange] = useState<'6' | '12'>('6');
  const { isAgent, canManageTeam, profileId } = useRole();

  // Fetch deals — filtered by assigned_to for agents
  const agentDealsFilter = isAgent && profileId ? { assigned_to: profileId } : undefined;
  const { data: deals, isLoading: dealsLoading } = useOrgQuery<Deal[]>('deals', {
    select: '*',
    filters: agentDealsFilter,
    orderBy: { column: 'created_at', ascending: false }
  }, {
    enabled: isAgent ? !!profileId : true
  });

  // Fetch contacts — filtered by assigned_to for agents
  const agentContactsFilter = isAgent && profileId ? { assigned_to: profileId } : undefined;
  const { data: contacts, isLoading: contactsLoading } = useOrgQuery<Contact[]>('contacts', {
    select: '*',
    filters: agentContactsFilter,
    orderBy: { column: 'urgency_score', ascending: false }
  }, {
    enabled: isAgent ? !!profileId : true
  });

  // Fetch team deals with agent profiles — only for managers/admins
  const { data: teamDeals } = useOrgQuery<DealWithProfile[]>('deals', {
    select: '*, profiles:assigned_to(full_name)',
    orderBy: { column: 'created_at', ascending: false }
  }, {
    enabled: canManageTeam
  });

  // Fetch properties
  const { data: properties, isLoading: propertiesLoading } = useOrgQuery<Property[]>('properties', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Fetch property proposals (for AI match count)
  const { data: proposals } = useOrgQuery<PropertyProposal[]>('property_proposals', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Fetch activities
  const { data: activities, isLoading: activitiesLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*, contacts:contact_id(full_name)',
    orderBy: { column: 'date', ascending: false },
    limit: 10
  }, {
    refetchInterval: 30000
  });

  // ── KPI Calculations ──

  const kpiData = useMemo(() => {
    const weekStart = getStartOfWeek();
    const lastWeekStart = getStartOfLastWeek();
    const monthStart = getStartOfMonth();
    const lastMonthStart = getStartOfLastMonth();
    const lastMonthEnd = new Date(monthStart.getTime() - 1);
    const today = getStartOfToday();

    // Pipeline Value: sum active deals
    const activeDeals = (deals || []).filter(d => d.stage !== 'vendu' && d.stage !== 'perdu');
    const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const lastMonthActiveDeals = (deals || []).filter(d =>
      d.stage !== 'vendu' && d.stage !== 'perdu' &&
      d.created_at && new Date(d.created_at) < monthStart
    );
    const lastMonthPipeline = lastMonthActiveDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const pipelineTrend = calculateTrend(pipelineValue, lastMonthPipeline);

    // Conversions: deals closed this week / visits this week
    const dealsClosedThisWeek = (deals || []).filter(d =>
      d.stage === 'vendu' && d.updated_at && new Date(d.updated_at) >= weekStart
    ).length;
    const visitsThisWeek = (activities || []).filter(a =>
      a.type === 'Meeting' && a.date && new Date(a.date) >= weekStart
    ).length;
    const conversionRate = visitsThisWeek > 0 ? Math.round((dealsClosedThisWeek / visitsThisWeek) * 100) : 0;
    const dealsClosedLastWeek = (deals || []).filter(d =>
      d.stage === 'vendu' && d.updated_at &&
      new Date(d.updated_at) >= lastWeekStart && new Date(d.updated_at) < weekStart
    ).length;
    const visitsLastWeek = (activities || []).filter(a =>
      a.type === 'Meeting' && a.date &&
      new Date(a.date) >= lastWeekStart && new Date(a.date) < weekStart
    ).length;
    const lastWeekRate = visitsLastWeek > 0 ? Math.round((dealsClosedLastWeek / visitsLastWeek) * 100) : 0;
    const conversionTrend = calculateTrend(conversionRate, lastWeekRate);

    // New Leads: contacts created this week
    const newLeadsThisWeek = (contacts || []).filter(c =>
      c.created_at && new Date(c.created_at) >= weekStart
    ).length;
    const newLeadsLastWeek = (contacts || []).filter(c =>
      c.created_at &&
      new Date(c.created_at) >= lastWeekStart && new Date(c.created_at) < weekStart
    ).length;
    const newLeadsToday = (contacts || []).filter(c =>
      c.created_at && new Date(c.created_at) >= today
    ).length;
    const leadsTrend = calculateTrend(newLeadsThisWeek, newLeadsLastWeek);

    // Active Properties
    const activeProperties = (properties || []).filter(p => p.status === 'disponible');
    const activePropsCount = activeProperties.length;
    const venteCount = activeProperties.filter(p => p.transaction_type === 'vente').length;
    const locationCount = activeProperties.filter(p => p.transaction_type === 'location').length;
    const otherCount = activePropsCount - venteCount - locationCount;
    const lastMonthProps = (properties || []).filter(p =>
      p.status === 'disponible' &&
      p.created_at && new Date(p.created_at) < monthStart
    ).length;
    const propsTrend = calculateTrend(activePropsCount, lastMonthProps || activePropsCount);

    // Sub-detail for properties
    const propsSubParts = [];
    if (venteCount > 0) propsSubParts.push(`${venteCount} vente`);
    if (locationCount > 0) propsSubParts.push(`${locationCount} location`);
    if (otherCount > 0) propsSubParts.push(`${otherCount} autre`);
    const propsSubDetail = propsSubParts.length > 0 ? propsSubParts.join(' · ') : null;

    // Monthly Goal
    const monthlyGoal = 50000;
    const currentMonthRevenue = (deals || [])
      .filter(d => d.stage === 'vendu' && d.updated_at && new Date(d.updated_at) >= monthStart)
      .reduce((sum, d) => sum + (d.amount || 0), 0);
    const goalProgress = Math.round((currentMonthRevenue / monthlyGoal) * 100);
    const remainingToGoal = monthlyGoal - currentMonthRevenue;

    return {
      pipelineValue, pipelineTrend,
      conversionRate, dealsClosedThisWeek, visitsThisWeek, conversionTrend,
      newLeadsThisWeek, newLeadsToday, leadsTrend,
      activePropsCount, propsSubDetail, propsTrend,
      currentMonthRevenue, monthlyGoal, goalProgress, remainingToGoal
    };
  }, [deals, contacts, properties, activities]);

  // ── Performance Chart Data ──

  const monthlyRevenue = useMemo(() => {
    if (!deals) return [];
    return calculateMonthlyRevenue(deals, parseInt(chartRange));
  }, [deals, chartRange]);

  // ── Smart Actions Data ──

  const smartActions = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const followUpCount = (contacts || []).filter(c =>
      c.last_contact_date &&
      new Date(c.last_contact_date) < sevenDaysAgo &&
      c.role === 'acheteur'
    ).length;

    const stagnantPropsCount = (properties || []).filter(p =>
      p.status === 'disponible' &&
      p.updated_at &&
      new Date(p.updated_at) < thirtyDaysAgo
    ).length;

    const aiMatchCount = new Set(
      (proposals || [])
        .filter(p => p.created_at && new Date(p.created_at) >= sevenDaysAgo)
        .map(p => p.property_id)
        .filter(Boolean)
    ).size;

    return { followUpCount, stagnantPropsCount, aiMatchCount };
  }, [contacts, properties, proposals]);

  // ── Today's Agenda ──

  const todayActivities = useMemo(() => {
    if (!activities) return [];
    const todayStart = getStartOfToday();
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    return activities
      .filter(a => a.date && new Date(a.date) >= todayStart && new Date(a.date) < todayEnd)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
      .slice(0, 5);
  }, [activities]);


  // ── Stagnant Deals ──

  const stagnantDeals = useMemo(() => {
    if (!deals) return [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return deals
      .filter(d =>
        d.stage !== 'vendu' &&
        d.stage !== 'perdu' &&
        d.updated_at &&
        new Date(d.updated_at) < sevenDaysAgo
      )
      .sort((a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime())
      .slice(0, 5);
  }, [deals]);

  // ── Team Performance (managers/admins only) ──

  const teamStats = useMemo(() => {
    if (!teamDeals) return [];

    const byAgent = new Map<string, { name: string; activeDeals: number; revenue: number; commission: number }>();

    for (const deal of teamDeals) {
      const agentId = deal.assigned_to;
      if (!agentId) continue;

      const name = deal.profiles?.full_name ?? 'Agent inconnu';
      const existing = byAgent.get(agentId) ?? { name, activeDeals: 0, revenue: 0, commission: 0 };

      if (deal.stage !== 'vendu' && deal.stage !== 'perdu') {
        existing.activeDeals += 1;
      }
      if (deal.stage === 'vendu') {
        existing.revenue += deal.amount ?? 0;
        existing.commission += deal.commission_amount ?? 0;
      }

      byAgent.set(agentId, existing);
    }

    return Array.from(byAgent.values()).sort((a, b) => b.revenue - a.revenue);
  }, [teamDeals]);

  const isLoading = dealsLoading || contactsLoading || activitiesLoading || propertiesLoading;
  const hasNoData = !deals?.length && !contacts?.length && !activities?.length;

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ElementType> = {
      Call: Phone,
      Meeting: Calendar,
      Email: Zap,
    };
    return icons[type] || CheckCircle;
  };

  const getAgendaTypeStyle = (type: string) => {
    const styles: Record<string, { border: string; bg: string; iconBg: string; Icon: React.ElementType }> = {
      'visite': { border: 'border-blue-500', bg: 'bg-blue-500/10', iconBg: 'bg-blue-500/20', Icon: Eye },
      'Call': { border: 'border-orange-500', bg: 'bg-orange-500/10', iconBg: 'bg-orange-500/20', Icon: Phone },
      'appel': { border: 'border-orange-500', bg: 'bg-orange-500/10', iconBg: 'bg-orange-500/20', Icon: Phone },
      'Meeting': { border: 'border-purple-500', bg: 'bg-purple-500/10', iconBg: 'bg-purple-500/20', Icon: Calendar },
      'rdv': { border: 'border-purple-500', bg: 'bg-purple-500/10', iconBg: 'bg-purple-500/20', Icon: Calendar },
      'Email': { border: 'border-green-500', bg: 'bg-green-500/10', iconBg: 'bg-green-500/20', Icon: Zap },
      'relance': { border: 'border-green-500', bg: 'bg-green-500/10', iconBg: 'bg-green-500/20', Icon: Zap },
    };
    return styles[type] || { border: 'border-primary', bg: 'bg-primary/10', iconBg: 'bg-primary/20', Icon: CheckCircle };
  };

  const progressBarColor = kpiData.goalProgress >= 75
    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
    : kpiData.goalProgress >= 50
      ? 'bg-gradient-to-r from-orange-500 to-amber-400'
      : 'bg-gradient-to-r from-red-500 to-rose-400';

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={tierVariants} className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isAgent ? 'Mon Cockpit' : 'Cockpit Directeur'}
          </h1>
          <p className="text-muted-foreground">
            {isAgent ? 'Votre activité personnelle' : 'Vue d\'ensemble de l\'agence'}
          </p>
        </div>
        {isAgent ? (
          <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Agent
          </Badge>
        ) : canManageTeam ? (
          <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-200 border border-purple-500/30">
            Directeur
          </Badge>
        ) : null}
      </motion.div>

      {/* Empty state for fresh organizations */}
      {!isLoading && hasNoData ? (
        <GuidedEmptyState
          variant="dashboard"
          onPrimaryAction={() => navigate('/contacts')}
        />
      ) : (
        <>
          {/* ── TIER 1: KPI Cards ── */}
          <motion.div variants={tierVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pipeline Value */}
            <Card
              className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-card/50 to-transparent border border-primary/20 shadow-lg shadow-primary/5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 hover:shadow-primary/10 group cursor-pointer"
              onClick={() => navigate('/deals')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={`gap-1 text-xs ${kpiData.pipelineTrend.positive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                  >
                    {kpiData.pipelineTrend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpiData.pipelineTrend.value}
                  </Badge>
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {formatCompactNumber(kpiData.pipelineValue)}€
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Pipeline en cours
                </p>
              </CardContent>
            </Card>

            {/* Conversions */}
            <Card
              className="relative overflow-hidden bg-gradient-to-br from-green-500/10 via-card/50 to-transparent border border-green-500/20 shadow-lg shadow-green-500/5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-green-500/40 hover:shadow-green-500/10 group cursor-pointer"
              onClick={() => navigate('/deals')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Target className="w-5 h-5 text-green-500" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={`gap-1 text-xs ${kpiData.conversionTrend.positive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                  >
                    {kpiData.conversionTrend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpiData.conversionTrend.value}
                  </Badge>
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {kpiData.conversionRate}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Taux de conversion
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  {kpiData.dealsClosedThisWeek}/{kpiData.visitsThisWeek} cette semaine
                </p>
              </CardContent>
            </Card>

            {/* New Leads */}
            <Card
              className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-card/50 to-transparent border border-blue-500/20 shadow-lg shadow-blue-500/5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/40 hover:shadow-blue-500/10 group cursor-pointer"
              onClick={() => navigate('/contacts')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <UserPlus className="w-5 h-5 text-blue-500" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={`gap-1 text-xs ${kpiData.leadsTrend.positive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                  >
                    {kpiData.leadsTrend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpiData.leadsTrend.value}
                  </Badge>
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {kpiData.newLeadsThisWeek} <span className="text-lg font-normal text-muted-foreground">nouveaux</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Leads cette semaine
                </p>
                {kpiData.newLeadsToday > 0 && (
                  <p className="text-xs text-blue-400 mt-3">
                    +{kpiData.newLeadsToday} aujourd'hui
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Active Properties */}
            <Card
              className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-card/50 to-transparent border border-amber-500/20 shadow-lg shadow-amber-500/5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/40 hover:shadow-amber-500/10 group cursor-pointer"
              onClick={() => navigate('/biens')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Home className="w-5 h-5 text-amber-500" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={`gap-1 text-xs ${kpiData.propsTrend.positive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                  >
                    {kpiData.propsTrend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpiData.propsTrend.value}
                  </Badge>
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {kpiData.activePropsCount} <span className="text-lg font-normal text-muted-foreground">biens</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Portefeuille actif
                </p>
                {kpiData.propsSubDetail && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {kpiData.propsSubDetail}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── TIER 1.1: Team Performance (managers/admins only) ── */}
          {canManageTeam && (
            <motion.div variants={tierVariants}>
              <Card className="glass border-purple-500/20 shadow-lg shadow-purple-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-purple-400" />
                    Performance Équipe
                  </CardTitle>
                  <CardDescription>CA et deals actifs par agent</CardDescription>
                </CardHeader>
                <CardContent>
                  {teamStats.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left pb-2 text-muted-foreground font-medium">Agent</th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">Deals actifs</th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">CA réalisé</th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">Commission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {teamStats.map((agent, index) => (
                            <motion.tr
                              key={index}
                              className="hover:bg-white/5 transition-colors"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.05 }}
                            >
                              <td className="py-2.5 font-medium">{agent.name}</td>
                              <td className="py-2.5 text-right">
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-300">
                                  {agent.activeDeals}
                                </Badge>
                              </td>
                              <td className="py-2.5 text-right font-semibold">
                                {formatCurrency(agent.revenue)}
                              </td>
                              <td className="py-2.5 text-right text-purple-300">
                                {formatCurrency(agent.commission)}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Aucun deal assigné à un agent pour le moment
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── TIER 1.2: Goal + Agenda + Funnel ── */}
          <motion.div variants={tierVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly Goal - Full width */}
            <div className="lg:col-span-3">
              <Card className="glass border-white/10 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Trophy className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Objectif Mensuel</p>
                        <p className="text-xs text-muted-foreground">
                          {kpiData.goalProgress >= 100
                            ? 'Objectif atteint !'
                            : `Il vous reste ${formatCurrency(kpiData.remainingToGoal)}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={kpiData.goalProgress >= 75 ? 'bg-green-500/20 text-green-400' : kpiData.goalProgress >= 50 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}>
                      {kpiData.goalProgress}%
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 rounded-full bg-secondary/50 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${progressBarColor}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(kpiData.goalProgress, 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>

                  {/* Values */}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">0 &euro;</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(kpiData.currentMonthRevenue)} / {formatCurrency(kpiData.monthlyGoal)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Today's Agenda */}
            <div className="lg:col-span-1">
              <Card className="glass border-white/5 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5 text-primary" />
                    Agenda du Jour
                  </CardTitle>
                  <CardDescription>Vos rendez-vous aujourd'hui</CardDescription>
                </CardHeader>
                <CardContent>
                  {todayActivities.length > 0 ? (
                    <div className="space-y-2">
                      {todayActivities.map((activity) => {
                        const style = getAgendaTypeStyle(activity.type);
                        const TypeIcon = style.Icon;
                        return (
                          <div
                            key={activity.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border-l-2 ${style.border} ${style.bg}`}
                          >
                            <span className="text-xs font-mono text-muted-foreground min-w-[40px] mt-0.5">
                              {new Date(activity.date!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className={`p-1.5 rounded-md ${style.iconBg} flex-shrink-0`}>
                              <TypeIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{activity.name || activity.description}</p>
                              {activity.contacts?.full_name && (
                                <p className="text-xs text-muted-foreground">{activity.contacts.full_name}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                        <Link to="/activities">
                          Voir tout <ArrowRight className="ml-1 w-3 h-3" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="w-10 h-10 text-primary/40 mx-auto" />
                      <p className="font-medium mt-3 text-sm">Aucun RDV aujourd'hui</p>
                      <p className="text-xs text-muted-foreground mt-1">Profitez-en !</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Daily Brief */}
            <div className="lg:col-span-2">
              <DailyBrief />
            </div>
          </motion.div>


          {/* ── TIER 2: Performance Chart + Smart Actions ── */}
          <motion.div variants={tierVariants} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Performance Chart (3/5 = 60%) */}
            <Card className="glass border-white/5 h-full lg:col-span-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Performance CA</CardTitle>
                    <CardDescription>Évolution du chiffre d'affaires</CardDescription>
                  </div>
                  <Select value={chartRange} onValueChange={(v) => setChartRange(v as '6' | '12')}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 mois</SelectItem>
                      <SelectItem value="12">12 mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={monthlyRevenue}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatCompactNumber(v) + '€'} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [formatCurrency(value), 'CA']}
                        labelFormatter={(label) => `Mois: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        fill="url(#revenueGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                    Aucune donnée de vente disponible
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Smart Actions Widget (2/5 = 40%) */}
            <Card className="glass border-orange-500/20 shadow-lg shadow-orange-500/5 h-full lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5 text-orange-500" />
                  Actions Urgentes
                </CardTitle>
                <CardDescription>Priorités du jour</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Follow-ups */}
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 hover:bg-orange-500/10 cursor-pointer group transition-all duration-200"
                  onClick={() => navigate('/contacts')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{smartActions.followUpCount} relances à faire</p>
                      <p className="text-xs text-muted-foreground">Contacts à recontacter</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>

                {/* Stagnant Properties */}
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 cursor-pointer group transition-all duration-200"
                  onClick={() => navigate('/biens')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Home className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{smartActions.stagnantPropsCount} biens stagnants</p>
                      <p className="text-xs text-muted-foreground">Aucune action depuis 30j</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>

                {/* AI Matching */}
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 cursor-pointer group transition-all duration-200"
                  onClick={() => navigate('/biens')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{smartActions.aiMatchCount} nouveaux matchs</p>
                      <p className="text-xs text-muted-foreground">Smart Matching AI</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 text-xs">
                    Nouveau
                  </Badge>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Tier 3: Urgent Alerts (2-col grid) ── */}
          <motion.div variants={tierVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stagnant Deals */}
            <Card className="glass border-orange-500/30 shadow-lg shadow-orange-500/5 ring-1 ring-orange-500/10 h-full">
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
                {stagnantDeals.length > 0 ? (
                  <div className="space-y-2">
                    {stagnantDeals.map((deal) => {
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
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                    <p className="font-medium text-green-600 mt-3">Pipeline sain !</p>
                    <p className="text-sm text-muted-foreground mt-1">Aucun deal stagnant</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alerts & SLA */}
            <AlertsSLAWidget className="glass border-orange-500/30 shadow-lg shadow-orange-500/5 ring-1 ring-orange-500/10 h-full" />
          </motion.div>

          {/* ── Tier 4: Context & Info (2-col grid) ── */}
          <motion.div variants={tierVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Market Pulse */}
            <MarketPulse className="glass border-white/5 bg-secondary/20 h-full" />

            {/* Live Activity Feed */}
            <Card className="glass border-white/5 bg-secondary/20 h-full">
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
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 text-purple-400 mx-auto" />
                    <p className="font-medium text-purple-400 mt-3">Prêt à démarrer</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vos prochaines actions apparaîtront ici
                    </p>
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
                              {activity.description || activity.name || activity.type}
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
        </>
      )}
    </motion.div>
  );
}
