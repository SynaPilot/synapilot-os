import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_PRIORITY_LABELS,
  ACTIVITY_STATUS_LABELS,
} from '@/lib/constants';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
  properties?: { address: string; type?: string } | null;
  ai_generated?: boolean;
};

// --- Color helpers ---

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

function getTypeDotColor(type: string | null) {
  const colors: Record<string, string> = {
    appel: 'bg-purple-400',
    email: 'bg-gray-400',
    visite: 'bg-blue-400',
    relance: 'bg-purple-600',
    rdv: 'bg-blue-600',
    signature: 'bg-blue-500',
    note: 'bg-purple-300',
    tache: 'bg-blue-300',
    autre: 'bg-gray-500',
  };
  return colors[type || ''] || 'bg-gray-500';
}

function getTypeAccent(type: string | null) {
  const accents: Record<string, { bg: string; text: string }> = {
    appel: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    email: { bg: 'bg-gray-500/15', text: 'text-gray-400' },
    visite: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    relance: { bg: 'bg-purple-600/15', text: 'text-purple-300' },
    rdv: { bg: 'bg-blue-600/15', text: 'text-blue-300' },
    signature: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    note: { bg: 'bg-purple-400/15', text: 'text-purple-300' },
    tache: { bg: 'bg-blue-400/15', text: 'text-blue-300' },
    autre: { bg: 'bg-gray-500/15', text: 'text-gray-400' },
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

function getStatusColor(status: string | null) {
  const colors: Record<string, string> = {
    planifie: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    en_cours: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    termine: 'bg-blue-700/30 text-blue-200 border-blue-700/40',
    annule: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
  };
  return colors[status || ''] || 'bg-muted text-muted-foreground';
}

// --- Activity Detail Dialog ---

function ActivityDetailDialog({
  activity,
  open,
  onOpenChange,
  onComplete,
}: {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  if (!activity) return null;

  const Icon = getActivityIcon(activity.type);
  const accent = getTypeAccent(activity.type);
  const isCompleted = activity.status === 'termine' || activity.status === 'annule';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', accent.bg)}>
              <Icon className={cn('w-5 h-5', accent.text)} />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {activity.name || activity.type}
              </DialogTitle>
              <DialogDescription>
                {activity.date && format(new Date(activity.date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn('text-xs', accent.text)}>
              {ACTIVITY_TYPE_LABELS[activity.type as keyof typeof ACTIVITY_TYPE_LABELS] || activity.type}
            </Badge>
            {activity.priority && (
              <Badge className={cn('text-xs', getPriorityColor(activity.priority))}>
                {ACTIVITY_PRIORITY_LABELS[activity.priority as keyof typeof ACTIVITY_PRIORITY_LABELS]}
              </Badge>
            )}
            <Badge className={cn('text-xs', getStatusColor(activity.status))}>
              {ACTIVITY_STATUS_LABELS[activity.status as keyof typeof ACTIVITY_STATUS_LABELS] || activity.status}
            </Badge>
            {activity.ai_generated && (
              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                <Sparkles className="w-3 h-3 mr-1" />
                IA
              </Badge>
            )}
          </div>

          {/* Description */}
          {activity.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {activity.description}
            </p>
          )}

          {/* Relations */}
          <div className="space-y-2 text-sm">
            {activity.contacts?.full_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4 text-purple-400" />
                {activity.contacts.full_name}
              </div>
            )}
            {activity.properties?.address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="w-4 h-4 text-blue-400" />
                {activity.properties.address}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          {!isCompleted && (
            <Button
              onClick={() => {
                onComplete();
                onOpenChange(false);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marquer terminée
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Calendar Grid ---

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface ActivityCalendarViewProps {
  activities: Activity[] | undefined;
  isLoading: boolean;
  onOpenCreate: () => void;
}

export function ActivityCalendarView({
  activities,
  isLoading,
  onOpenCreate,
}: ActivityCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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

  // Build activities map by date string
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    if (!activities) return map;

    for (const act of activities) {
      if (!act.date) continue;
      const key = format(new Date(act.date), 'yyyy-MM-dd');
      const existing = map.get(key) || [];
      existing.push(act);
      map.set(key, existing);
    }

    return map;
  }, [activities]);

  // Calendar grid days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrev = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNext = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleToday} className="text-xs">
          Aujourd'hui
        </Button>
      </div>

      {/* Calendar grid */}
      <Card className="glass border-white/10 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center text-muted-foreground">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 animate-pulse" />
                <p className="text-sm">Chargement du calendrier...</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-white/10">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="px-2 py-2 text-xs font-semibold text-center text-muted-foreground uppercase tracking-wider"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayActivities = activitiesByDate.get(key) || [];
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const maxVisible = 3;

                  return (
                    <div
                      key={key}
                      className={cn(
                        'min-h-[100px] border-b border-r border-white/[0.04] p-1.5 transition-colors',
                        !inMonth && 'opacity-30',
                        today && 'bg-purple-500/[0.05]',
                        // Remove right border on last column
                        (i + 1) % 7 === 0 && 'border-r-0'
                      )}
                    >
                      {/* Day number */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                            today
                              ? 'bg-purple-500 text-white'
                              : inMonth
                                ? 'text-white/80'
                                : 'text-muted-foreground'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        {dayActivities.length > maxVisible && (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayActivities.length - maxVisible}
                          </span>
                        )}
                      </div>

                      {/* Activity pills */}
                      <div className="space-y-0.5">
                        {dayActivities.slice(0, maxVisible).map((act) => {
                          const dotColor = getTypeDotColor(act.type);
                          const isDone = act.status === 'termine' || act.status === 'annule';
                          return (
                            <button
                              key={act.id}
                              onClick={() => handleActivityClick(act)}
                              className={cn(
                                'w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-left text-[11px] leading-tight truncate transition-colors',
                                isDone
                                  ? 'opacity-40 line-through'
                                  : 'hover:bg-white/10 cursor-pointer'
                              )}
                            >
                              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
                              <span className="truncate">
                                {act.date && format(new Date(act.date), 'HH:mm')}{' '}
                                {act.name || act.type}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty state when no activities at all */}
      {!isLoading && (!activities || activities.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">Votre calendrier est vide</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Planifiez vos premières activités pour les voir ici
          </p>
          <Button variant="accent" onClick={onOpenCreate}>
            Créer une activité
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <ActivityDetailDialog
        activity={selectedActivity}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onComplete={() => {
          if (selectedActivity) {
            completeMutation.mutate(selectedActivity.id);
          }
        }}
      />
    </div>
  );
}
