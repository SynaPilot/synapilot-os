import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  Copy, 
  Check,
  FileText,
  Users,
  Handshake,
  Bell,
  PenLine,
  ListTodo,
  HelpCircle
} from 'lucide-react';
import { useActivities, type Activity } from '@/hooks/useActivities';
import { format, subDays, isAfter } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import type { Tables } from '@/integrations/supabase/types';

type Property = Tables<'properties'>;

type PeriodFilter = '7days' | '30days' | 'all';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: '7days', label: '7 derniers jours' },
  { value: '30days', label: '30 derniers jours' },
  { value: 'all', label: 'Tout l\'historique' },
];

interface PropertyOwnerReportProps {
  property: Property;
}

const ACTIVITY_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  appel: { icon: Phone, label: 'Appels', color: 'text-blue-400' },
  email: { icon: Mail, label: 'Emails', color: 'text-purple-400' },
  visite: { icon: MapPin, label: 'Visites', color: 'text-emerald-400' },
  rdv: { icon: Calendar, label: 'Rendez-vous', color: 'text-amber-400' },
  relance: { icon: Bell, label: 'Relances', color: 'text-orange-400' },
  signature: { icon: Handshake, label: 'Signatures', color: 'text-green-400' },
  note: { icon: PenLine, label: 'Notes', color: 'text-slate-400' },
  tache: { icon: ListTodo, label: 'Tâches', color: 'text-indigo-400' },
  autre: { icon: HelpCircle, label: 'Autres', color: 'text-gray-400' },
};

function ActivityCard({ activity }: { activity: Activity }) {
  const config = ACTIVITY_TYPE_CONFIG[activity.type || 'autre'] || ACTIVITY_TYPE_CONFIG.autre;
  const Icon = config.icon;
  
  const statusColors: Record<string, string> = {
    planifie: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    en_cours: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    termine: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    annule: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const statusLabels: Record<string, string> = {
    planifie: 'Planifié',
    en_cours: 'En cours',
    termine: 'Terminé',
    annule: 'Annulé',
  };

  return (
    <Card className="glass border-white/10 hover:border-blue-500/20 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-background-hover ${config.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-medium text-sm truncate">{activity.name}</p>
              <Badge className={`text-xs ${statusColors[activity.status || 'planifie']} border`}>
                {statusLabels[activity.status || 'planifie']}
              </Badge>
            </div>
            {activity.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{activity.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(activity.date), 'dd MMM yyyy', { locale: fr })}
              </span>
              {activity.contacts?.full_name && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {activity.contacts.full_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertyOwnerReport({ property }: PropertyOwnerReportProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const { activities: allActivities, isLoading } = useActivities({
    filters: { property_id: property.id },
    orderBy: { column: 'date', ascending: false },
  });

  // Filter activities based on period
  const activities = useMemo(() => {
    if (!allActivities?.length || period === 'all') return allActivities ?? [];
    
    const now = new Date();
    const cutoffDate = period === '7days' ? subDays(now, 7) : subDays(now, 30);
    
    return allActivities.filter(a => isAfter(new Date(a.date), cutoffDate));
  }, [allActivities, period]);

  // Compute stats and groupings
  const stats = useMemo(() => {
    if (!activities?.length) return null;

    const byType = activities.reduce((acc, act) => {
      const type = act.type || 'autre';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completed = activities.filter(a => a.status === 'termine');
    const planned = activities.filter(a => a.status === 'planifie');
    const lastAction = completed[0];
    const nextAction = planned.length > 0 
      ? planned.reduce((a, b) => new Date(a.date) < new Date(b.date) ? a : b)
      : null;

    return {
      total: activities.length,
      completed: completed.length,
      planned: planned.length,
      byType,
      lastAction,
      nextAction,
    };
  }, [activities]);

  const handleCopyReport = () => {
    if (!stats || !activities?.length) return;

    const reportDate = format(new Date(), 'dd MMMM yyyy', { locale: fr });
    const lines = [
      `📊 RAPPORT PROPRIÉTAIRE - ${property.title || property.address}`,
      `Généré le ${reportDate}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '📈 RÉSUMÉ',
      `• Total d'activités : ${stats.total}`,
      `• Actions terminées : ${stats.completed}`,
      `• Actions planifiées : ${stats.planned}`,
      '',
      '📊 PAR TYPE',
      ...Object.entries(stats.byType).map(([type, count]) => {
        const config = ACTIVITY_TYPE_CONFIG[type] || ACTIVITY_TYPE_CONFIG.autre;
        return `• ${config.label} : ${count}`;
      }),
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '📋 HISTORIQUE DÉTAILLÉ',
      '',
      ...activities.map(act => {
        const date = format(new Date(act.date), 'dd/MM/yyyy', { locale: fr });
        const config = ACTIVITY_TYPE_CONFIG[act.type || 'autre'] || ACTIVITY_TYPE_CONFIG.autre;
        return `[${date}] ${config.label} - ${act.name}${act.description ? `\n   → ${act.description}` : ''}`;
      }),
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Rapport généré par SynaPilot OS',
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success('Rapport copié dans le presse-papiers');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BarChart3 className="w-4 h-4" />
          Rapport Propriétaire
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Rapport d'activité
          </DialogTitle>
          <div className="flex items-center justify-between gap-4">
            <DialogDescription className="text-muted-foreground">
              {property.title || property.address}
            </DialogDescription>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : !activities?.length ? (
          <EmptyState
            icon={FileText}
            iconGradient="from-blue-500/20 to-purple-500/20"
            title="Aucune activité enregistrée"
            description="Aucune activité n'est liée à ce bien pour le moment. Commencez par planifier une visite ou un appel."
          />
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card className="glass border-white/10">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">{stats?.total}</p>
                  <p className="text-xs text-muted-foreground">Total activités</p>
                </CardContent>
              </Card>
              <Card className="glass border-white/10">
                <CardContent className="p-4 text-center">
                  {stats?.lastAction ? (
                    <>
                      <p className="text-sm font-medium text-emerald-400">
                        {format(new Date(stats.lastAction.date), 'dd MMM', { locale: fr })}
                      </p>
                      <p className="text-xs text-muted-foreground">Dernière action</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune action terminée</p>
                  )}
                </CardContent>
              </Card>
              <Card className="glass border-white/10">
                <CardContent className="p-4 text-center">
                  {stats?.nextAction ? (
                    <>
                      <p className="text-sm font-medium text-amber-400">
                        {format(new Date(stats.nextAction.date), 'dd MMM', { locale: fr })}
                      </p>
                      <p className="text-xs text-muted-foreground">Prochaine action</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Rien de planifié</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Activity Type Breakdown */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(stats?.byType || {}).map(([type, count]) => {
                const config = ACTIVITY_TYPE_CONFIG[type] || ACTIVITY_TYPE_CONFIG.autre;
                const Icon = config.icon;
                return (
                  <Badge key={type} variant="outline" className="gap-1.5 px-3 py-1">
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    <span>{config.label}</span>
                    <span className="font-bold">{count}</span>
                  </Badge>
                );
              })}
            </div>

            <Separator className="bg-white/10" />

            {/* Activities List */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-3 py-4">
                {activities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </ScrollArea>

            <Separator className="bg-white/10" />

            {/* Export Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyReport}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copier le rapport
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
