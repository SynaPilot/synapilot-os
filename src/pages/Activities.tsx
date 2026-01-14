import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ActivityItemSkeleton } from '@/components/skeletons';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Plus, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar as CalendarIcon, 
  MapPin,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Home,
  Play,
  FileText,
  Briefcase,
  CreditCard,
  Clock
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// Activity type from the database with relations
type Activity = {
  id: string;
  organization_id: string;
  type: string;
  content: string | null;
  status: string | null;
  date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string | null;
  related_contact_id: string | null;
  related_property_id: string | null;
  name?: string | null;
  priority?: string | null;
  contacts?: { id: string; full_name: string; email: string | null } | null;
  properties?: { id: string; address: string; type: string | null } | null;
};

// Contact type for select dropdown
type Contact = {
  id: string;
  full_name: string;
  email: string | null;
};

// Property type for select dropdown
type Property = {
  id: string;
  address: string;
  type: string | null;
};

const activitySchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire').max(100, 'Maximum 100 caractères'),
  type: z.enum(['Appel', 'Email', 'Visite', 'Relance', 'RDV', 'Administratif', 'Paiement']),
  date: z.date({ required_error: 'La date est obligatoire' }),
  priority: z.enum(['Haute', 'Moyenne', 'Basse']),
  status: z.enum(['À faire', 'En cours', 'Terminée']),
  related_contact_id: z.string().optional().nullable(),
  related_property_id: z.string().optional().nullable(),
  content: z.string().max(1000).optional(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function getActivityIcon(type: string) {
  const icons: Record<string, React.ElementType> = {
    'Appel': Phone,
    'Email': Mail,
    'Visite': MapPin,
    'Relance': RefreshCw,
    'RDV': CalendarIcon,
    'Administratif': FileText,
    'Paiement': CreditCard,
    // Legacy types
    'Call': Phone,
    'SMS': MessageSquare,
    'Meeting': CalendarIcon,
  };
  return icons[type] || CalendarIcon;
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    'À faire': 'bg-info/20 text-info border-info/30',
    'En cours': 'bg-warning/20 text-warning border-warning/30',
    'Terminée': 'bg-success/20 text-success border-success/30',
    'Terminé': 'bg-success/20 text-success border-success/30',
    'Annulé': 'bg-muted text-muted-foreground border-muted',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

function getPriorityColor(priority: string) {
  const colors: Record<string, string> = {
    'Haute': 'bg-destructive/20 text-destructive border-destructive/30',
    'Moyenne': 'bg-warning/20 text-warning border-warning/30',
    'Basse': 'bg-success/20 text-success border-success/30',
  };
  return colors[priority] || 'bg-muted text-muted-foreground';
}

function ActivityItem({ 
  activity, 
  onComplete,
  index 
}: { 
  activity: Activity; 
  onComplete: () => void;
  index: number;
}) {
  const Icon = getActivityIcon(activity.type);
  const isCompleted = activity.status === 'Terminée' || activity.status === 'Terminé';
  const displayName = activity.name || activity.type;
  const priority = activity.priority || 'Moyenne';

  return (
    <motion.div
      className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
        isCompleted ? 'bg-secondary/30' : 'bg-card hover:bg-secondary/50'
      }`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      whileHover={{ scale: 1.005 }}
    >
      <div className={`p-2 rounded-lg ${isCompleted ? 'bg-success/10' : 'bg-primary/10'}`}>
        <Icon className={`w-4 h-4 ${isCompleted ? 'text-success' : 'text-primary'}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-sm">{displayName}</span>
          <Badge variant="outline" className="text-xs">{activity.type}</Badge>
          <Badge className={`text-xs ${getStatusColor(activity.status || '')}`}>
            {activity.status}
          </Badge>
          <Badge className={`text-xs ${getPriorityColor(priority)}`}>
            {priority}
          </Badge>
        </div>
        
        {activity.content && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{activity.content}</p>
        )}
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
          {activity.contacts?.full_name && (
            <span>{activity.contacts.full_name}</span>
          )}
          {activity.properties?.address && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {activity.properties.address}
            </span>
          )}
          {activity.date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(activity.date)}
            </span>
          )}
        </div>
      </div>

      {!isCompleted && (
        <Button size="icon" variant="ghost" onClick={onComplete} className="h-8 w-8">
          <CheckCircle2 className="w-4 h-4" />
        </Button>
      )}
    </motion.div>
  );
}

export default function Activities() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const queryClient = useQueryClient();
  const { organizationId, user } = useAuth();

  const activitiesQueryKey = organizationId 
    ? (['activities', organizationId] as const) 
    : (['activities'] as const);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: '',
      type: 'Appel',
      date: new Date(),
      priority: 'Moyenne',
      status: 'À faire',
      related_contact_id: null,
      related_property_id: null,
      content: '',
    },
  });

  const { data: activities, isLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*, contacts:related_contact_id(id, full_name, email), properties:related_property_id(id, address, type)',
    orderBy: { column: 'date', ascending: false }
  });

  const { data: contacts } = useOrgQuery<Contact[]>('contacts', {
    select: 'id, full_name, email',
    orderBy: { column: 'full_name', ascending: true }
  });

  const { data: properties } = useOrgQuery<Property[]>('properties', {
    select: 'id, address, type',
    orderBy: { column: 'address', ascending: true }
  });

  const filteredContacts = contacts?.filter(c => 
    !contactSearch || 
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(contactSearch.toLowerCase()))
  ) || [];

  const filteredProperties = properties?.filter(p => 
    !propertySearch || 
    p.address.toLowerCase().includes(propertySearch.toLowerCase())
  ) || [];

  const createMutation = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const insertData: Record<string, unknown> = {
        type: values.type,
        content: values.content || null,
        status: values.status,
        organization_id: organizationId,
        date: values.date.toISOString(),
        assigned_to: user?.id || null,
        related_contact_id: values.related_contact_id || null,
        related_property_id: values.related_property_id || null,
      };

      // Add name and priority if columns exist (will work once migration is applied)
      // For now, we store them but the DB might ignore them if columns don't exist
      // In that case, we embed them in content as a workaround
      const activityName = values.name;
      const activityPriority = values.priority;
      
      // Try to insert with new columns, fallback to storing in content
      try {
        const { error } = await supabase
          .from('activities')
          .insert({
            ...insertData,
            name: activityName,
            priority: activityPriority,
          } as Record<string, unknown>);

        if (error) {
          // If columns don't exist, try without them
          if (error.message.includes('name') || error.message.includes('priority')) {
            const contentWithMeta = `[${activityPriority}] ${activityName}${values.content ? '\n\n' + values.content : ''}`;
            const { error: fallbackError } = await supabase
              .from('activities')
              .insert({
                ...insertData,
                content: contentWithMeta,
              } as Record<string, unknown>);
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }
      } catch (e) {
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
      setIsDialogOpen(false);
      form.reset({
        name: '',
        type: 'Appel',
        date: new Date(),
        priority: 'Moyenne',
        status: 'À faire',
        related_contact_id: null,
        related_property_id: null,
        content: '',
      });
      toast.success('Activité créée avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('activities')
        .update({ status: 'Terminée' })
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
      toast.success('Activité terminée');
    },
  });

  const filteredActivities = activities?.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  const todoCount = activities?.filter((a) => a.status === 'À faire').length || 0;
  const completedToday = activities?.filter((a) => {
    const today = new Date().toDateString();
    return (a.status === 'Terminée' || a.status === 'Terminé') && a.date && new Date(a.date).toDateString() === today;
  }).length || 0;

  const onSubmit = (values: ActivityFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <motion.div 
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Activités</h1>
          <p className="text-muted-foreground">
            {todoCount} à faire • {completedToday} terminées aujourd'hui
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle activité
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une activité</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Champ 1: Nom */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-foreground">Nom *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Relancer Marie Martin pour visite" 
                          maxLength={100}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Champ 2: Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-foreground">Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACTIVITY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const Icon = getActivityIcon(type);
                                  return <Icon className="w-4 h-4" />;
                                })()}
                                {type}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Champ 3: Date et Heure */}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-medium text-foreground">Date et Heure *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP 'à' HH:mm", { locale: fr })
                              ) : (
                                <span>Sélectionner une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={field.value ? format(field.value, 'HH:mm') : ''}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(':').map(Number);
                                const newDate = new Date(field.value || new Date());
                                newDate.setHours(hours, minutes);
                                field.onChange(newDate);
                              }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Champ 4: Priorité */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-foreground">Priorité *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACTIVITY_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${getPriorityColor(priority)}`}>
                                  {priority}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Champ 5: Statut */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-foreground">Statut *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACTIVITY_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              <Badge className={`text-xs ${getStatusColor(status)}`}>
                                {status}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Champ 6: Contact lié */}
                <FormField
                  control={form.control}
                  name="related_contact_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-foreground">Contact lié</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un contact (optionnel)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Rechercher un contact..."
                              value={contactSearch}
                              onChange={(e) => setContactSearch(e.target.value)}
                              className="mb-2"
                            />
                          </div>
                          <SelectItem value="none">Aucun contact</SelectItem>
                          {filteredContacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              <div className="flex flex-col">
                                <span>{contact.full_name}</span>
                                {contact.email && (
                                  <span className="text-xs text-muted-foreground">{contact.email}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Champ 7: Bien lié */}
                <FormField
                  control={form.control}
                  name="related_property_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-foreground">Bien lié</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un bien (optionnel)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Rechercher un bien..."
                              value={propertySearch}
                              onChange={(e) => setPropertySearch(e.target.value)}
                              className="mb-2"
                            />
                          </div>
                          <SelectItem value="none">Aucun bien</SelectItem>
                          {filteredProperties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              <div className="flex flex-col">
                                <span>{property.address}</span>
                                {property.type && (
                                  <span className="text-xs text-muted-foreground">{property.type}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Champ 8: Description */}
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-foreground">Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Détails supplémentaires..." 
                          rows={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {createMutation.isPending ? 'Création...' : 'Créer l\'activité'}
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
      <Card className="glass border-white/10">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-white/5">
              {[...Array(5)].map((_, i) => (
                <ActivityItemSkeleton key={i} />
              ))}
            </div>
          ) : filteredActivities?.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              iconGradient="from-blue-500/20 to-purple-500/20"
              title="Organisez votre journée"
              description="Créez des tâches, planifiez des visites et suivez vos relances. Toutes vos activités au même endroit."
              action={{
                label: "Créer ma première activité",
                onClick: () => setIsDialogOpen(true),
                icon: <Plus className="w-5 h-5" />
              }}
              secondaryAction={{
                label: "Voir la démo",
                onClick: () => {},
                icon: <Play className="w-5 h-5" />
              }}
              features={[
                { icon: <Phone className="w-5 h-5 text-primary" />, title: "Relances", desc: "Programmez des rappels automatiques" },
                { icon: <Home className="w-5 h-5 text-primary" />, title: "Visites", desc: "Planifiez vos rendez-vous terrain" },
                { icon: <Mail className="w-5 h-5 text-primary" />, title: "Emails", desc: "Suivez vos échanges clients" }
              ]}
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-white/5">
              {filteredActivities?.map((activity, index) => (
                <ActivityItem 
                  key={activity.id} 
                  activity={activity}
                  index={index}
                  onComplete={() => completeMutation.mutate(activity.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
