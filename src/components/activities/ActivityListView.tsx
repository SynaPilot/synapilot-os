import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActivityItemSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import {
  Phone,
  Mail,
  Calendar as CalendarIcon,
  MapPin,
  RefreshCw,
  CheckCircle2,
  FileText,
  User,
  Building2,
  Clock,
  Sparkles,
  Trash2,
  CalendarClock,
  ListFilter,
} from 'lucide-react';
import { GuidedEmptyState } from '@/components/GuidedEmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_PRIORITY_LABELS,
} from '@/lib/constants';
import { formatRelativeTime } from '@/lib/formatters';
import {
  format,
  isToday,
  isTomorrow,
  isThisWeek,
  startOfDay,
  compareAsc,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
  properties?: { address: string; type?: string } | null;
  ai_generated?: boolean;
};

// --- Color/Icon Helpers ---

function getActivityIcon(type: string | null) {
  const icons: Record<string, React.ElementType> = {
    appel: Phone,
    email: Mail,
    visite: MapPin,
    relance: RefreshCw,
    rdv: CalendarIcon,
    signature: FileText,
    note: FileText,
    tache: CheckCircle2,
    autre: CalendarIcon,
  };
  return icons[type || ''] || CalendarIcon;
}

function getTypeAccent(type: string | null) {
  const accents: Record<string, { bg: string; text: string; border: string }> = {
    appel: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20' },
    email: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/20' },
    visite: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20' },
    relance: { bg: 'bg-purple-600/15', text: 'text-purple-300', border: 'border-purple-600/20' },
    rdv: { bg: 'bg-blue-600/15', text: 'text-blue-300', border: 'border-blue-600/20' },
    signature: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20' },
    note: { bg: 'bg-purple-400/15', text: 'text-purple-300', border: 'border-purple-400/20' },
    tache: { bg: 'bg-blue-400/15', text: 'text-blue-300', border: 'border-blue-400/20' },
    autre: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/20' },
  };
  return accents[type || ''] || accents.autre;
}

function getPriorityColor(priority: string | null) {
  const colors: Record<string, string> = {
    urgente: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
    haute: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    normale: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    basse: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  };
  return colors[priority || ''] || 'bg-muted text-muted-foreground';
}

// --- Type Filter Config ---

type TypeFilter = 'tout' | 'appel' | 'visite' | 'email';

const TYPE_FILTERS: { key: TypeFilter; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'tout', label: 'Tout', icon: ListFilter, color: 'bg-white/10 text-white border-white/20 data-[active=true]:bg-white/20' },
  { key: 'appel', label: 'Appels', icon: Phone, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20 data-[active=true]:bg-purple-500/25' },
  { key: 'visite', label: 'Visites', icon: MapPin, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 data-[active=true]:bg-blue-500/25' },
  { key: 'email', label: 'Emails', icon: Mail, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20 data-[active=true]:bg-gray-500/25' },
];

// --- Date Grouping ---

interface DateGroup {
  label: string;
  activities: Activity[];
}

function groupByDate(activities: Activity[]): DateGroup[] {
  const groups: Record<string, Activity[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    done: [],
  };

  for (const act of activities) {
    if (act.status === 'termine' || act.status === 'annule') {
      groups.done.push(act);
      continue;
    }

    if (!act.date) {
      groups.later.push(act);
      continue;
    }

    const d = new Date(act.date);
    const now = startOfDay(new Date());

    if (d < now) {
      groups.overdue.push(act);
    } else if (isToday(d)) {
      groups.today.push(act);
    } else if (isTomorrow(d)) {
      groups.tomorrow.push(act);
    } else if (isThisWeek(d, { weekStartsOn: 1 })) {
      groups.thisWeek.push(act);
    } else {
      groups.later.push(act);
    }
  }

  // Sort each group by date ascending
  const sortByDate = (a: Activity, b: Activity) =>
    compareAsc(new Date(a.date || 0), new Date(b.date || 0));

  const result: DateGroup[] = [];

  if (groups.overdue.length > 0) {
    result.push({ label: 'En retard', activities: groups.overdue.sort(sortByDate) });
  }
  if (groups.today.length > 0) {
    result.push({ label: "Aujourd'hui", activities: groups.today.sort(sortByDate) });
  }
  if (groups.tomorrow.length > 0) {
    result.push({ label: 'Demain', activities: groups.tomorrow.sort(sortByDate) });
  }
  if (groups.thisWeek.length > 0) {
    result.push({ label: 'Cette semaine', activities: groups.thisWeek.sort(sortByDate) });
  }
  if (groups.later.length > 0) {
    result.push({ label: 'Plus tard', activities: groups.later.sort(sortByDate) });
  }
  if (groups.done.length > 0) {
    result.push({ label: 'Terminées', activities: groups.done.sort(sortByDate).reverse() });
  }

  return result;
}

// --- Activity Row ---

function ActivityRow({
  activity,
  onComplete,
  onDelete,
  index,
}: {
  activity: Activity;
  onComplete: () => void;
  onDelete: () => void;
  index: number;
}) {
  const Icon = getActivityIcon(activity.type);
  const accent = getTypeAccent(activity.type);
  const isCompleted = activity.status === 'termine' || activity.status === 'annule';
  const isOverdue =
    !isCompleted &&
    activity.date &&
    new Date(activity.date) < startOfDay(new Date());

  return (
    <motion.div
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors',
        isCompleted ? 'opacity-50' : 'hover:bg-white/[0.03]',
        isOverdue && 'border-l-2 border-l-red-500/60'
      )}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      layout
    >
      {/* Complete button */}
      <button
        onClick={onComplete}
        disabled={isCompleted}
        className={cn(
          'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
          isCompleted
            ? 'bg-green-500/20 border-green-500/50'
            : 'border-white/30 hover:border-purple-400 hover:bg-purple-500/10'
        )}
      >
        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
      </button>

      {/* Icon */}
      <div className={cn('shrink-0 p-1.5 rounded-lg', accent.bg)}>
        <Icon className={cn('w-4 h-4', accent.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium text-sm truncate',
              isCompleted ? 'line-through text-muted-foreground' : 'text-white'
            )}
          >
            {activity.name || activity.type}
          </span>
          {activity.ai_generated && (
            <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {activity.date && (
            <span className={cn('flex items-center gap-1', isOverdue && 'text-red-400')}>
              <Clock className="w-3 h-3" />
              {format(new Date(activity.date), 'HH:mm', { locale: fr })}
            </span>
          )}
          {activity.contacts?.full_name && (
            <span className="flex items-center gap-1 truncate">
              <User className="w-3 h-3" />
              {activity.contacts.full_name}
            </span>
          )}
          {activity.properties?.address && (
            <span className="hidden sm:flex items-center gap-1 truncate">
              <Building2 className="w-3 h-3" />
              {activity.properties.address}
            </span>
          )}
        </div>
      </div>

      {/* Right side: badges + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant="outline"
          className={cn('text-[10px] hidden sm:inline-flex', accent.border, accent.text)}
        >
          {ACTIVITY_TYPE_LABELS[activity.type as keyof typeof ACTIVITY_TYPE_LABELS] || activity.type}
        </Badge>
        {activity.priority && activity.priority !== 'normale' && (
          <Badge className={cn('text-[10px]', getPriorityColor(activity.priority))}>
            {ACTIVITY_PRIORITY_LABELS[activity.priority as keyof typeof ACTIVITY_PRIORITY_LABELS]}
          </Badge>
        )}

        {/* Hover actions */}
        {!isCompleted && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 hover:bg-red-500/10 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- Main List View ---

interface ActivityListViewProps {
  activities: Activity[] | undefined;
  isLoading: boolean;
  onOpenCreate: () => void;
}

export function ActivityListView({ activities, isLoading, onOpenCreate }: ActivityListViewProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('tout');
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();

  const activitiesQueryKey = organizationId
    ? (['activities', organizationId] as const)
    : (['activities'] as const);

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      const { error } = await supabase
        .from('activities')
        .update({ status: 'termine' })
        .eq('id', id)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
      toast.success('Activité terminée');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
      toast.success('Activité supprimée');
    },
  });

  // Apply type filter
  const filtered = activities?.filter((a) => {
    if (typeFilter === 'tout') return true;
    return a.type === typeFilter;
  });

  const groups = groupByDate(filtered || []);

  return (
    <div className="space-y-4">
      {/* Quick type filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_FILTERS.map((f) => {
          const FIcon = f.icon;
          const isActive = typeFilter === f.key;
          const count =
            f.key === 'tout'
              ? activities?.length || 0
              : activities?.filter((a) => a.type === f.key).length || 0;
          return (
            <button
              key={f.key}
              data-active={isActive}
              onClick={() => setTypeFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                f.color,
                isActive && 'ring-1 ring-white/20'
              )}
            >
              <FIcon className="w-3.5 h-3.5" />
              {f.label}
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Activities grouped by date */}
      <Card className="glass border-white/10 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-white/5">
              {[...Array(5)].map((_, i) => (
                <ActivityItemSkeleton key={i} />
              ))}
            </div>
          ) : !activities || activities.length === 0 ? (
            <GuidedEmptyState variant="activities" onPrimaryAction={onOpenCreate} />
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarIcon className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucune activité avec ce filtre</p>
              <Button
                variant="link"
                onClick={() => setTypeFilter('tout')}
                className="text-purple-400 mt-2"
              >
                Voir toutes les activités
              </Button>
            </div>
          ) : (
            <div>
              <AnimatePresence mode="popLayout">
                {groups.map((group) => (
                  <div key={group.label}>
                    {/* Group header */}
                    <div
                      className={cn(
                        'sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b border-white/5 backdrop-blur-md',
                        group.label === 'En retard'
                          ? 'bg-red-500/10 text-red-400'
                          : group.label === "Aujourd'hui"
                            ? 'bg-purple-500/10 text-purple-400'
                            : group.label === 'Terminées'
                              ? 'bg-white/5 text-muted-foreground'
                              : 'bg-white/5 text-white/60'
                      )}
                    >
                      {group.label}
                      <span className="ml-2 opacity-60">({group.activities.length})</span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-white/[0.03]">
                      {group.activities.map((activity, idx) => (
                        <ActivityRow
                          key={activity.id}
                          activity={activity}
                          index={idx}
                          onComplete={() => completeMutation.mutate(activity.id)}
                          onDelete={() => deleteMutation.mutate(activity.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
