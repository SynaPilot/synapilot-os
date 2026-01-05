import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  MapPin,
  RefreshCw,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useProfile } from '@/hooks/useOrganization';
import { callN8nWebhook } from '@/lib/n8n';

const ACTIVITY_TYPES = ['Call', 'SMS', 'Email', 'Meeting', 'Visite', 'Relance'] as const;
const ACTIVITY_STATUSES = ['À faire', 'En cours', 'Terminé', 'Annulé'] as const;

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  content: z.string().max(500).optional(),
  status: z.enum(ACTIVITY_STATUSES).default('À faire'),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

type Activity = {
  id: string;
  type: typeof ACTIVITY_TYPES[number];
  status: typeof ACTIVITY_STATUSES[number];
  content: string | null;
  date: string;
  created_at: string;
  contacts?: { full_name: string } | null;
  properties?: { address: string } | null;
};

function getActivityIcon(type: string) {
  const icons: Record<string, React.ElementType> = {
    'Call': Phone,
    'SMS': MessageSquare,
    'Email': Mail,
    'Meeting': Calendar,
    'Visite': MapPin,
    'Relance': RefreshCw,
  };
  return icons[type] || Calendar;
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    'À faire': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'En cours': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Terminé': 'bg-green-500/20 text-green-400 border-green-500/30',
    'Annulé': 'bg-muted text-muted-foreground border-muted',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

function ActivityItem({ activity, onComplete }: { activity: Activity; onComplete: () => void }) {
  const Icon = getActivityIcon(activity.type);
  const isCompleted = activity.status === 'Terminé';

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
      isCompleted ? 'bg-muted/20' : 'bg-card hover:bg-muted/30'
    }`}>
      <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-500/10' : 'bg-primary/10'}`}>
        <Icon className={`w-5 h-5 ${isCompleted ? 'text-green-400' : 'text-primary'}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground">{activity.type}</span>
          <Badge className={getStatusColor(activity.status)}>{activity.status}</Badge>
        </div>
        
        {activity.content && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{activity.content}</p>
        )}
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {activity.contacts?.full_name && (
            <span>{activity.contacts.full_name}</span>
          )}
          {activity.properties?.address && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {activity.properties.address}
            </span>
          )}
          <span>{formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: fr })}</span>
        </div>
      </div>

      {!isCompleted && (
        <Button size="sm" variant="ghost" onClick={onComplete}>
          <CheckCircle2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

export default function Activities() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: 'Call',
      content: '',
      status: 'À faire',
    },
  });

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          contacts:related_contact_id(full_name),
          properties:related_property_id(address)
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Activity[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      if (!profile?.organization_id) throw new Error('Organization not found');
      
      const { data, error } = await supabase
        .from('activities')
        .insert({
          type: values.type,
          content: values.content || null,
          status: values.status,
          organization_id: profile.organization_id,
          created_by: profile.id,
          date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: 'Activité créée' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('activities')
        .update({ status: 'Terminé' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast({ title: 'Activité terminée' });
    },
  });

  const filteredActivities = activities?.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  const todoCount = activities?.filter((a) => a.status === 'À faire').length || 0;
  const completedToday = activities?.filter((a) => {
    const today = new Date().toDateString();
    return a.status === 'Terminé' && new Date(a.date).toDateString() === today;
  }).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Activités</h1>
            <p className="text-muted-foreground">
              {todoCount} à faire • {completedToday} terminées aujourd'hui
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Activité
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer une Activité</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACTIVITY_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Détails de l'activité..."
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACTIVITY_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer l'activité
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {ACTIVITY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Activities List */}
        <Card className="glass border-border/50">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredActivities?.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Aucune activité</p>
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une activité
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredActivities?.map((activity) => (
                  <ActivityItem 
                    key={activity.id} 
                    activity={activity}
                    onComplete={() => completeMutation.mutate(activity.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
