import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  TrendingUp,
  Users,
  Home,
  Euro,
  Target,
  Calendar,
  BarChart3,
  Download,
  Zap,
  Sparkles,
  Building2,
  PieChart,
  Clock,
  Award,
  MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency, formatCompactNumber } from '@/lib/formatters';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { EnhancedKPICard } from '@/components/charts/EnhancedKPICard';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import { FunnelChart } from '@/components/charts/FunnelChart';
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
  Legend,
  Cell
} from 'recharts';
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  DPE_GES_LABELS,
  type PropertyType,
  type PropertyStatus
} from '@/lib/constants';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;
type Activity = Tables<'activities'>;
type Contact = Tables<'contacts'>;
type Property = Tables<'properties'>;

// Dummy monthly objective (will be configurable later)
const MONTHLY_OBJECTIVE = 50000;

// DPE bar colors (A=green → G=dark red)
const DPE_BAR_COLORS = ['#22c55e', '#84cc16', '#facc15', '#f59e0b', '#f97316', '#ef4444', '#b91c1c'];

// Shared card class for consistent glassmorphism + micro-interactions
const BENTO_CARD = 'bg-white/[0.03] backdrop-blur-md border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:border-primary/40';
const BENTO_CARD_GLOW = `${BENTO_CARD} shadow-[0_0_20px_rgba(168,85,247,0.12)]`;

// Placeholder monthly data for ghost charts
const GHOST_MONTHLY = [
  { month: 'Jan', ca: 35000, commissions: 8000, objectif: 50000 },
  { month: 'Fév', ca: 42000, commissions: 12000, objectif: 50000 },
  { month: 'Mar', ca: 28000, commissions: 6500, objectif: 50000 },
  { month: 'Avr', ca: 55000, commissions: 15000, objectif: 50000 },
  { month: 'Mai', ca: 48000, commissions: 13000, objectif: 50000 },
  { month: 'Juin', ca: 62000, commissions: 18000, objectif: 50000 },
  { month: 'Juil', ca: 45000, commissions: 11000, objectif: 50000 },
  { month: 'Août', ca: 30000, commissions: 7000, objectif: 50000 },
  { month: 'Sep', ca: 52000, commissions: 14000, objectif: 50000 },
  { month: 'Oct', ca: 58000, commissions: 16000, objectif: 50000 },
  { month: 'Nov', ca: 47000, commissions: 12500, objectif: 50000 },
  { month: 'Déc', ca: 65000, commissions: 19000, objectif: 50000 },
];

const GHOST_DPE = [
  { name: 'A', value: 4 }, { name: 'B', value: 8 }, { name: 'C', value: 12 },
  { name: 'D', value: 15 }, { name: 'E', value: 9 }, { name: 'F', value: 5 }, { name: 'G', value: 2 },
];

const GHOST_TYPE = [
  { name: 'Appartement', value: 18 }, { name: 'Maison', value: 12 },
  { name: 'Terrain', value: 5 }, { name: 'Commerce', value: 3 },
];

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const tierVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
};

// Premium tooltip with color-matched left border
const CurrencyTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const borderColor = payload[0]?.color || '#a855f7';
    return (
      <div
        className="bg-[#0d0f14]/95 backdrop-blur-lg border border-white/10 rounded-xl p-3.5 shadow-2xl"
        style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
      >
        <p className="text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-white/50">{entry.name}</span>
            <span className="text-xs font-semibold text-white ml-auto tabular-nums">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const CountTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const borderColor = payload[0]?.color || payload[0]?.fill || '#a855f7';
    return (
      <div
        className="bg-[#0d0f14]/95 backdrop-blur-lg border border-white/10 rounded-xl p-3.5 shadow-2xl"
        style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
      >
        <p className="text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-white/50">{entry.name}</span>
            <span className="text-xs font-semibold text-white ml-auto tabular-nums">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Section header with gradient icon box
function SectionHeader({ icon: Icon, iconColor, title, description }: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Ghost chart overlay — blurred placeholder chart + CTA
function GhostOverlay({ children, message }: { children: React.ReactNode; message: string }) {
  return (
    <div className="relative">
      <div className="opacity-[0.08] blur-[2px] pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="px-5 py-3 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/10">
          <p className="text-sm text-muted-foreground text-center">{message}</p>
        </div>
      </div>
    </div>
  );
}

// Insight chip — small contextual pill
function InsightChip({ icon: Icon, label, value, color = 'text-blue-400' }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span className={`text-xs font-semibold ml-auto tabular-nums shrink-0 ${color}`}>{value}</span>
    </div>
  );
}

export default function Stats() {
  // --- Data Queries (4 useOrgQuery, all org-filtered) ---

  const { data: deals, isLoading: dealsLoading } = useOrgQuery<Deal[]>('deals', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  const { data: activities, isLoading: activitiesLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*',
    orderBy: { column: 'date', ascending: false }
  });

  const { data: contacts, isLoading: contactsLoading } = useOrgQuery<Contact[]>('contacts', {
    select: 'id,pipeline_stage,urgency_score,role',
    orderBy: { column: 'created_at', ascending: false }
  });

  const { data: properties, isLoading: propertiesLoading } = useOrgQuery<Property[]>('properties', {
    select: 'id,type,status,price,surface,dpe_label',
    orderBy: { column: 'created_at', ascending: false }
  });

  const isLoading = dealsLoading || activitiesLoading || contactsLoading || propertiesLoading;

  // --- Computed Data (7 useMemo blocks) ---

  const contactsStats = useMemo(() => {
    if (!contacts) return { total: 0, new: 0, won: 0, conversionRate: 0 };
    const total = contacts.length;
    const newCount = contacts.filter(c => c.pipeline_stage === 'nouveau').length;
    const wonCount = contacts.filter(c => c.pipeline_stage === 'vendu').length;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;
    return { total, new: newCount, won: wonCount, conversionRate };
  }, [contacts]);

  const dealsStats = useMemo(() => {
    if (!deals) return { totalValue: 0, wonValue: 0, commissions: 0, previsionnel: 0, openCount: 0, avgProbability: 0 };
    const totalValue = deals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const wonDeals = deals.filter(d => d.stage === 'vendu');
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const commissions = wonDeals.reduce((sum, d) => sum + (d.commission_amount || 0), 0);
    const openDeals = deals.filter(d => d.stage !== 'vendu' && d.stage !== 'perdu');
    const previsionnel = openDeals.reduce((sum, d) =>
      sum + ((d.amount || 0) * (d.probability || 0) / 100), 0
    );
    const avgProbability = openDeals.length > 0
      ? Math.round(openDeals.reduce((sum, d) => sum + (d.probability || 0), 0) / openDeals.length)
      : 0;
    return { totalValue, wonValue, commissions, previsionnel, openCount: openDeals.length, avgProbability };
  }, [deals]);

  const monthlyData = useMemo(() => {
    if (!deals) return [];
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = new Date().getFullYear();
    return months.map((month, index) => {
      const wonDeals = deals.filter(d => {
        if (!d.updated_at) return false;
        const date = new Date(d.updated_at);
        return date.getFullYear() === currentYear && date.getMonth() === index && d.stage === 'vendu';
      });
      return {
        month,
        ca: wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
        commissions: wonDeals.reduce((sum, d) => sum + (d.commission_amount || 0), 0),
        objectif: MONTHLY_OBJECTIVE,
      };
    });
  }, [deals]);

  const funnelData = useMemo(() => {
    if (!deals) return [];
    const macroStages = [
      { name: 'Prospect', stages: ['nouveau', 'qualification'] },
      { name: 'Mandat', stages: ['estimation', 'mandat'] },
      { name: 'Offre', stages: ['commercialisation', 'visite', 'offre', 'negociation'] },
      { name: 'Acte Authentique', stages: ['compromis', 'financement', 'acte', 'vendu'] },
    ];
    const total = deals.filter(d => d.stage !== 'perdu').length || 1;
    return macroStages.map(({ name, stages }) => {
      const stageDeals = deals.filter(d => stages.includes(d.stage || ''));
      const count = stageDeals.length;
      const value = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
      return { name, count, value, percentage: Math.round((count / total) * 100) };
    });
  }, [deals]);

  const propertyDistributions = useMemo(() => {
    if (!properties) return { byType: [] as { name: string; value: number }[], byDpe: [] as { name: string; value: number }[], byStatus: [] as { name: string; key: string; value: number }[], avgPrice: 0, medianPrice: 0, total: 0 };

    const typeMap = new Map<string, number>();
    properties.forEach(p => {
      const t = (p.type || 'autre') as PropertyType;
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    });
    const byType = Array.from(typeMap.entries()).map(([type, count]) => ({
      name: PROPERTY_TYPE_LABELS[type as PropertyType] || type,
      value: count,
    })).sort((a, b) => b.value - a.value);

    const dpeMap = new Map<string, number>();
    properties.forEach(p => {
      if (p.dpe_label) dpeMap.set(p.dpe_label, (dpeMap.get(p.dpe_label) || 0) + 1);
    });
    const byDpe = [...DPE_GES_LABELS].map(label => ({
      name: label,
      value: dpeMap.get(label) || 0,
    }));

    const statusMap = new Map<string, number>();
    properties.forEach(p => {
      const s = (p.status || 'disponible') as PropertyStatus;
      statusMap.set(s, (statusMap.get(s) || 0) + 1);
    });
    const byStatus = [...PROPERTY_STATUSES].map(s => ({
      name: PROPERTY_STATUS_LABELS[s],
      key: s,
      value: statusMap.get(s) || 0,
    }));

    const withPrice = properties.filter(p => p.price && p.price > 0);
    const sorted = [...withPrice].sort((a, b) => (a.price || 0) - (b.price || 0));
    const avgPrice = withPrice.length > 0
      ? withPrice.reduce((sum, p) => sum + (p.price || 0), 0) / withPrice.length
      : 0;
    const medianPrice = sorted.length > 0
      ? (sorted[Math.floor(sorted.length / 2)].price || 0)
      : 0;

    return { byType, byDpe, byStatus, avgPrice, medianPrice, total: properties.length };
  }, [properties]);

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

  const revenueSparkline = useMemo(() => {
    if (!deals) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      return deals
        .filter(d => d.stage === 'vendu' && d.updated_at?.startsWith(date))
        .reduce((sum, d) => sum + (d.amount || 0), 0);
    });
  }, [deals]);

  // Helper: is data truly empty
  const hasRevenue = monthlyData.length > 0 && monthlyData.some(d => d.ca > 0);
  const hasFunnel = funnelData.length > 0 && funnelData.some(d => d.count > 0);
  const hasActivity = activityHeatmapData.length > 0 && activityHeatmapData.some(d => d.count > 0);
  const hasProperties = propertyDistributions.byType.length > 0;
  const hasDpe = propertyDistributions.byDpe.some(d => d.value > 0);

  // Shared SVG gradient definitions (rendered once, referenced by all charts)
  const sharedGradientDefs = (
    <defs>
      <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7} />
        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.15} />
      </linearGradient>
      <linearGradient id="gradBlueH" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.8} />
      </linearGradient>
      <linearGradient id="gradEmerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
      </linearGradient>
    </defs>
  );

  // --- Render ---

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={tierVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Statistiques</h1>
          <p className="text-muted-foreground text-sm">Intelligence d'affaires immobilière</p>
        </div>
        <Button variant="outline" size="sm" className="border-white/10 hover:border-primary/40">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </motion.div>

      {/* KPI Row — 12-col grid, glow on first card */}
      <motion.div variants={tierVariants} className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <div className="shadow-[0_0_25px_rgba(168,85,247,0.15)] rounded-2xl">
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
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <EnhancedKPICard
            title="Leads Actifs"
            value={String(contactsStats.total)}
            subtext={`${contactsStats.new} nouveaux`}
            icon={Users}
            trend={8}
            gradientFrom="from-blue-500/10"
            iconColor="text-blue-500"
            loading={isLoading}
            delay={0.1}
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <EnhancedKPICard
            title="Biens en Portefeuille"
            value={String(propertyDistributions.total)}
            subtext={`${propertyDistributions.byStatus.find(s => s.key === 'vendu')?.value || 0} vendus`}
            icon={Home}
            trend={-2}
            gradientFrom="from-purple-500/10"
            iconColor="text-purple-500"
            loading={isLoading}
            delay={0.2}
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <EnhancedKPICard
            title="Taux de Conversion"
            value={`${contactsStats.conversionRate}%`}
            subtext={`${contactsStats.won} clôturés`}
            icon={Target}
            trend={5}
            gradientFrom="from-orange-500/10"
            iconColor="text-orange-500"
            loading={isLoading}
            delay={0.3}
          />
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={tierVariants}>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:border-white/10">Vue Globale</TabsTrigger>
            <TabsTrigger value="finances" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:border-white/10">Finances</TabsTrigger>
            <TabsTrigger value="biens" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:border-white/10">Biens</TabsTrigger>
          </TabsList>

          {/* ======================== TAB 1: Vue Globale ======================== */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Bento: Revenue 8-col + Quick Insights 4-col */}
            <div className="grid grid-cols-12 gap-5">
              {/* Revenue Chart — 8 cols */}
              <motion.div
                className="col-span-12 lg:col-span-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} h-full`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={BarChart3}
                      iconColor="text-blue-400"
                      title="Aperçu Financier"
                      description="Chiffre d'affaires mensuel"
                    />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full rounded-xl" />
                    ) : !hasRevenue ? (
                      <GhostOverlay message="Enregistrez vos premières transactions pour voir les tendances">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={GHOST_MONTHLY}>
                            {sharedGradientDefs}
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                            <Bar dataKey="ca" fill="url(#gradBlue)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </GhostOverlay>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyData}>
                          {sharedGradientDefs}
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                          <Tooltip content={<CurrencyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                          <Bar dataKey="ca" fill="url(#gradBlue)" radius={[6, 6, 0, 0]} name="CA" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Insights Sidebar — 4 cols */}
              <motion.div
                className="col-span-12 lg:col-span-4 flex flex-col gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                {/* Prévisionnel mini */}
                <Card className={`${BENTO_CARD_GLOW} flex-1`}>
                  <CardContent className="p-5 flex flex-col justify-between h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prévisionnel</span>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-10 w-32" />
                    ) : (
                      <p className="text-3xl font-bold font-mono bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                        {formatCurrency(dealsStats.previsionnel)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {dealsStats.openCount} deals &middot; {dealsStats.avgProbability}% probabilité moy.
                    </p>
                  </CardContent>
                </Card>

                {/* Insight Chips */}
                <div className="flex flex-col gap-2">
                  <InsightChip icon={Clock} label="Délai vente moyen" value="45j" color="text-blue-400" />
                  <InsightChip icon={Award} label="Meilleur mois" value={
                    monthlyData.length > 0
                      ? monthlyData.reduce((best, m) => m.ca > best.ca ? m : best, monthlyData[0]).month
                      : '—'
                  } color="text-violet-400" />
                  <InsightChip icon={MapPin} label="Pipeline actif" value={formatCompactNumber(dealsStats.totalValue)} color="text-emerald-400" />
                  <InsightChip icon={Users} label="Contacts chauds" value={String(contactsStats.new)} color="text-amber-400" />
                </div>
              </motion.div>
            </div>

            {/* Bento: Funnel 7-col + Heatmap 5-col */}
            <div className="grid grid-cols-12 gap-5">
              {/* Conversion Funnel */}
              <motion.div
                className="col-span-12 lg:col-span-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} h-full`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={Target}
                      iconColor="text-violet-400"
                      title="Performance Commerciale"
                      description="Funnel de conversion des deals"
                    />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[260px] w-full rounded-xl" />
                    ) : !hasFunnel ? (
                      <GhostOverlay message="Créez vos premiers deals pour visualiser le funnel">
                        <FunnelChart data={[
                          { name: 'Prospect', count: 24, value: 450000, percentage: 100 },
                          { name: 'Mandat', count: 16, value: 320000, percentage: 67 },
                          { name: 'Offre', count: 8, value: 180000, percentage: 33 },
                          { name: 'Acte', count: 3, value: 95000, percentage: 13 },
                        ]} />
                      </GhostOverlay>
                    ) : (
                      <FunnelChart data={funnelData} />
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Activity Heatmap */}
              <motion.div
                className="col-span-12 lg:col-span-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} h-full`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={Calendar}
                      iconColor="text-blue-400"
                      title="Activité Équipe / IA"
                      description="Derniers 6 mois"
                    />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-3 w-32 ml-auto" />
                      </div>
                    ) : !hasActivity ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                          <Calendar className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">Commencez à enregistrer vos activités</p>
                      </div>
                    ) : (
                      <ActivityHeatmap data={activityHeatmapData} months={6} />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* ======================== TAB 2: Finances ======================== */}
          <TabsContent value="finances" className="space-y-6 mt-0">
            {/* Multi-line AreaChart (full width) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <Card className={BENTO_CARD}>
                <CardHeader className="pb-2">
                  <SectionHeader
                    icon={TrendingUp}
                    iconColor="text-blue-400"
                    title="Évolution CA vs Commissions"
                    description="Comparaison mensuelle avec objectif"
                  />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[340px] w-full rounded-xl" />
                  ) : !hasRevenue ? (
                    <GhostOverlay message="Finalisez vos premiers deals pour analyser les tendances financières">
                      <ResponsiveContainer width="100%" height={340}>
                        <AreaChart data={GHOST_MONTHLY}>
                          {sharedGradientDefs}
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                          <Area type="monotone" dataKey="ca" stroke="#3b82f6" fill="url(#gradCA)" strokeWidth={2} />
                          <Area type="monotone" dataKey="commissions" stroke="#10b981" fill="url(#gradEmerald)" strokeWidth={2} />
                          <Area type="monotone" dataKey="objectif" stroke="#6b7280" strokeDasharray="5 5" fill="none" strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </GhostOverlay>
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <AreaChart data={monthlyData}>
                        {sharedGradientDefs}
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactNumber(v)} />
                        <Tooltip content={<CurrencyTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: 12 }} />
                        <Area type="monotone" dataKey="ca" stroke="#3b82f6" fill="url(#gradCA)" name="CA" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                        <Area type="monotone" dataKey="commissions" stroke="#10b981" fill="url(#gradEmerald)" name="Commissions Net" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                        <Area type="monotone" dataKey="objectif" stroke="#6b7280" strokeDasharray="6 4" fill="none" name="Objectif" strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Bento: Prévisionnel 5-col + Monthly Grid 7-col */}
            <div className="grid grid-cols-12 gap-5">
              <motion.div
                className="col-span-12 lg:col-span-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD_GLOW} h-full bg-gradient-to-br from-violet-500/[0.07] via-transparent to-blue-500/[0.07]`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={Sparkles}
                      iconColor="text-violet-400"
                      title="Prévisionnel"
                      description="Revenus pondérés des deals ouverts"
                    />
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {isLoading ? (
                      <Skeleton className="h-28 w-full rounded-xl" />
                    ) : (
                      <>
                        <p className="text-5xl font-bold font-mono bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent leading-tight">
                          {formatCurrency(dealsStats.previsionnel)}
                        </p>
                        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Deals ouverts</span>
                            <span className="font-mono font-medium">{dealsStats.openCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Probabilité moyenne</span>
                            <span className="font-mono font-medium">{dealsStats.avgProbability}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pipeline total</span>
                            <span className="font-mono font-medium">{formatCurrency(dealsStats.totalValue)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Deals gagnés</span>
                            <span className="font-mono font-medium text-emerald-400">{formatCurrency(dealsStats.wonValue)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                className="col-span-12 lg:col-span-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} h-full`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={BarChart3}
                      iconColor="text-blue-400"
                      title="Détail Mensuel"
                      description="CA et commissions par mois"
                    />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-48 w-full rounded-xl" />
                    ) : (
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                        {monthlyData.map((m, i) => {
                          const isTop = monthlyData.length > 0 && m.ca === Math.max(...monthlyData.map(x => x.ca)) && m.ca > 0;
                          return (
                            <motion.div
                              key={m.month}
                              className={`p-3.5 rounded-xl border text-center transition-all duration-300 hover:scale-[1.03] ${
                                isTop
                                  ? 'bg-gradient-to-b from-violet-500/10 to-transparent border-violet-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                                  : 'bg-white/[0.02] border-white/[0.06] hover:border-primary/30'
                              }`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.3 }}
                            >
                              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{m.month}</p>
                              <p className="text-sm font-bold font-mono">{formatCompactNumber(m.ca)}</p>
                              <p className="text-[10px] text-emerald-400/80 font-mono">{formatCompactNumber(m.commissions)}</p>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* ======================== TAB 3: Biens ======================== */}
          <TabsContent value="biens" className="space-y-6 mt-0">
            {/* Bento: Type 7-col + DPE 5-col */}
            <div className="grid grid-cols-12 gap-5">
              <motion.div
                className="col-span-12 lg:col-span-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} h-full`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={Building2}
                      iconColor="text-purple-400"
                      title="Répartition par Type"
                      description="Distribution du portefeuille"
                    />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[280px] w-full rounded-xl" />
                    ) : !hasProperties ? (
                      <GhostOverlay message="Ajoutez vos premiers biens pour visualiser la répartition">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={GHOST_TYPE} layout="vertical">
                            {sharedGradientDefs}
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                            <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                            <Bar dataKey="value" fill="url(#gradBlueH)" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </GhostOverlay>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={propertyDistributions.byType} layout="vertical">
                          {sharedGradientDefs}
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                          <Bar dataKey="value" fill="url(#gradBlueH)" radius={[0, 6, 6, 0]} name="Biens" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                className="col-span-12 lg:col-span-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} h-full`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={Zap}
                      iconColor="text-amber-400"
                      title="Diagnostic Énergétique"
                      description="Répartition DPE (A → G)"
                    />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[280px] w-full rounded-xl" />
                    ) : !hasDpe ? (
                      <GhostOverlay message="Renseignez les DPE pour suivre la performance énergétique">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={GHOST_DPE}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={14} tickLine={false} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                              {GHOST_DPE.map((_, index) => (
                                <Cell key={index} fill={DPE_BAR_COLORS[index]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </GhostOverlay>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={propertyDistributions.byDpe}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={14} tickLine={false} axisLine={false} fontWeight={600} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Biens">
                            {propertyDistributions.byDpe.map((_, index) => (
                              <Cell key={index} fill={DPE_BAR_COLORS[index]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Status Grid + Price KPIs — single bento row */}
            <div className="grid grid-cols-12 gap-5">
              {/* Status boxes — 8 cols */}
              <motion.div
                className="col-span-12 lg:col-span-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} h-full`}>
                  <CardHeader className="pb-2">
                    <SectionHeader
                      icon={PieChart}
                      iconColor="text-blue-400"
                      title="Statut des Biens"
                      description="Répartition par état actuel"
                    />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-24 w-full rounded-xl" />
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {propertyDistributions.byStatus.map((status, i) => {
                          const statusColors: Record<string, { card: string; text: string }> = {
                            disponible: { card: 'bg-blue-500/[0.07] border-blue-500/20 hover:border-blue-400/40', text: 'text-blue-400' },
                            sous_compromis: { card: 'bg-amber-500/[0.07] border-amber-500/20 hover:border-amber-400/40', text: 'text-amber-400' },
                            vendu: { card: 'bg-emerald-500/[0.07] border-emerald-500/20 hover:border-emerald-400/40', text: 'text-emerald-400' },
                            loue: { card: 'bg-purple-500/[0.07] border-purple-500/20 hover:border-purple-400/40', text: 'text-purple-400' },
                            retire: { card: 'bg-white/[0.02] border-white/[0.06] hover:border-white/20', text: 'text-muted-foreground' },
                          };
                          const c = statusColors[status.key] || statusColors.retire;
                          return (
                            <motion.div
                              key={status.key}
                              className={`p-5 rounded-xl border text-center transition-all duration-300 hover:scale-[1.02] ${c.card}`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05, duration: 0.3 }}
                            >
                              <p className={`text-3xl font-bold font-mono ${c.text}`}>{status.value}</p>
                              <p className="text-xs text-muted-foreground mt-1">{status.name}</p>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Price KPIs — 4 cols */}
              <motion.div
                className="col-span-12 lg:col-span-4 flex flex-col gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                <Card className={`${BENTO_CARD} flex-1 bg-gradient-to-br from-blue-500/[0.06] via-transparent to-transparent`}>
                  <CardContent className="p-5 flex flex-col justify-center h-full">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Euro className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Prix Moyen</span>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-9 w-40" />
                    ) : (
                      <p className="text-2xl font-bold font-mono">
                        {propertyDistributions.avgPrice > 0 ? formatCurrency(propertyDistributions.avgPrice) : '—'}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className={`${BENTO_CARD} flex-1 bg-gradient-to-br from-purple-500/[0.06] via-transparent to-transparent`}>
                  <CardContent className="p-5 flex flex-col justify-center h-full">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Euro className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Prix Médian</span>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-9 w-40" />
                    ) : (
                      <p className="text-2xl font-bold font-mono">
                        {propertyDistributions.medianPrice > 0 ? formatCurrency(propertyDistributions.medianPrice) : '—'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
