import { useState, useEffect, useRef } from 'react';
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
  DialogDescription,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Phone, 
  Mail, 
  Calendar as CalendarIcon, 
  MapPin,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Home,
  Play,
  FileText,
  CreditCard,
  Check,
  ChevronsUpDown,
  User,
  Building2,
  Clock
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
  properties?: { address: string; type?: string } | null;
};

type Contact = { id: string; full_name: string; email: string | null };
type Property = { id: string; address: string; type: string | null };

const activitySchema = z.object({
  name: z.string()
    .min(3, "Le titre doit contenir au moins 3 caractères")
    .max(100, "Le titre ne peut pas dépasser 100 caractères"),
  type: z.enum(['Appel', 'Email', 'Visite', 'Relance', 'RDV', 'Administratif', 'Paiement']),
  date: z.date(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:mm requis"),
  priority: z.enum(['Haute', 'Moyenne', 'Basse']),
  status: z.enum(['À faire', 'En cours', 'Terminée']),
  related_contact_id: z.string().uuid().nullable(),
  related_property_id: z.string().uuid().nullable(),
  content: z.string().max(500, "Maximum 500 caractères").optional(),
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
  };
  return icons[type] || CalendarIcon;
}

function getPriorityColor(priority: string) {
  const colors: Record<string, string> = {
    'Haute': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Moyenne': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Basse': 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  return colors[priority] || 'bg-muted text-muted-foreground';
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    'À faire': 'bg-info/20 text-info border-info/30',
    'En cours': 'bg-warning/20 text-warning border-warning/30',
    'Terminée': 'bg-success/20 text-success border-success/30',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
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
  const isCompleted = activity.status === 'Terminée';

  return (
    <motion.div
      className={`p-4 transition-colors ${
        isCompleted ? 'bg-secondary/30' : 'hover:bg-white/5'
      }`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isCompleted ? 'bg-success/10' : 'bg-primary/20'}`}>
          <Icon className={`w-5 h-5 ${isCompleted ? 'text-success' : 'text-primary'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium truncate ${isCompleted ? 'text-muted-foreground line-through' : 'text-white'}`}>
            {activity.name || activity.type}
          </h4>
          
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-xs">{activity.type}</Badge>
            {activity.priority && (
              <Badge className={`text-xs ${getPriorityColor(activity.priority)}`}>
                {activity.priority}
              </Badge>
            )}
            <Badge className={`text-xs ${getStatusColor(activity.status || '')}`}>
              {activity.status}
            </Badge>
          </div>
          
          {activity.content && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {activity.content}
            </p>
          )}
          
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            {activity.contacts?.full_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {activity.contacts.full_name}
              </span>
            )}
            {activity.properties?.address && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
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
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onComplete} 
            className="shrink-0 hover:bg-success/20 hover:text-success"
          >
            <CheckCircle2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default function Activities() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const queryClient = useQueryClient();
  const { organizationId, user } = useAuth();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const activitiesQueryKey = organizationId 
    ? (['activities', organizationId] as const) 
    : (['activities'] as const);

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: '',
      type: 'Appel',
      date: now,
      time: currentTime,
      priority: 'Moyenne',
      status: 'À faire',
      related_contact_id: null,
      related_property_id: null,
      content: '',
    },
  });

  // Focus name input when dialog opens
  useEffect(() => {
    if (isDialogOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isDialogOpen]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      const newNow = new Date();
      const newTime = `${String(newNow.getHours()).padStart(2, '0')}:${String(newNow.getMinutes()).padStart(2, '0')}`;
      form.reset({
        name: '',
        type: 'Appel',
        date: newNow,
        time: newTime,
        priority: 'Moyenne',
        status: 'À faire',
        related_contact_id: null,
        related_property_id: null,
        content: '',
      });
      setContactSearch('');
      setPropertySearch('');
    }
  }, [isDialogOpen, form]);

  const { data: activities, isLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*, contacts:related_contact_id(full_name), properties:related_property_id(address, type)',
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
    p.address.toLowerCase().includes(propertySearch.toLowerCase()) ||
    (p.type && p.type.toLowerCase().includes(propertySearch.toLowerCase()))
  ) || [];

  const createMutation = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      // Combine date and time
      const [hours, minutes] = values.time.split(':').map(Number);
      const dateTime = new Date(values.date);
      dateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from('activities')
        .insert({
          organization_id: organizationId,
          name: values.name,
          type: values.type,
          date: dateTime.toISOString(),
          priority: values.priority,
          status: values.status,
          content: values.content || null,
          related_contact_id: values.related_contact_id || null,
          related_property_id: values.related_property_id || null,
          assigned_to: user?.id || null,
          created_by: user?.id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
      setIsDialogOpen(false);
      toast.success('✅ Activité créée avec succès');
    },
    onError: (error) => {
      toast.error(`❌ Erreur : ${error.message}`);
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
      toast.success('✅ Activité terminée');
    },
  });

  const filteredActivities = activities?.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  const todoCount = activities?.filter((a) => a.status === 'À faire').length || 0;
  const completedToday = activities?.filter((a) => {
    const today = new Date().toDateString();
    return a.status === 'Terminée' && a.date && new Date(a.date).toDateString() === today;
  }).length || 0;

  const selectedContact = contacts?.find(c => c.id === form.watch('related_contact_id'));
  const selectedProperty = properties?.find(p => p.id === form.watch('related_property_id'));

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
            <Button variant="accent">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle activité
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une activité</DialogTitle>
              <DialogDescription>
                Planifiez une nouvelle tâche ou un rendez-vous
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-6">
                {/* 1. Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white">
                        Nom de l'activité <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          ref={nameInputRef}
                          placeholder="Ex: Relancer Marie Martin" 
                          className="focus:ring-2 focus:ring-primary"
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* 2. Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white">
                        Type <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACTIVITY_TYPES.map((type) => {
                            const Icon = getActivityIcon(type);
                            return (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-primary" />
                                  {type}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* 3. Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium text-white">
                          Date <span className="text-red-500">*</span>
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "EEE d MMM yyyy", { locale: fr })
                                ) : (
                                  <span>Choisir une date</span>
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
                              locale={fr}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-white">
                          Heure <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="time" 
                            className="focus:ring-2 focus:ring-primary"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 4. Priority */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white">
                        Priorité <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACTIVITY_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              <Badge className={getPriorityColor(priority)}>
                                {priority}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* 5. Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white">
                        Statut <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACTIVITY_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              <Badge className={getStatusColor(status)}>
                                {status}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* 6. Related Contact */}
                <FormField
                  control={form.control}
                  name="related_contact_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-medium text-white">
                        Contact lié
                      </FormLabel>
                      <Popover open={contactOpen} onOpenChange={setContactOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {selectedContact ? (
                                <div className="flex items-center gap-2 truncate">
                                  <User className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{selectedContact.full_name}</span>
                                  {selectedContact.email && (
                                    <span className="text-muted-foreground text-xs truncate">
                                      ({selectedContact.email})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "Aucun contact"
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Rechercher un contact..." 
                              value={contactSearch}
                              onValueChange={setContactSearch}
                            />
                            <CommandList>
                              <CommandEmpty>Aucun contact trouvé</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => {
                                    field.onChange(null);
                                    setContactOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                                  Aucun contact
                                </CommandItem>
                                {filteredContacts.map((contact) => (
                                  <CommandItem
                                    key={contact.id}
                                    value={contact.full_name}
                                    onSelect={() => {
                                      field.onChange(contact.id);
                                      setContactOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", field.value === contact.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                      <span>{contact.full_name}</span>
                                      {contact.email && (
                                        <span className="text-xs text-muted-foreground">{contact.email}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* 7. Related Property */}
                <FormField
                  control={form.control}
                  name="related_property_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-medium text-white">
                        Bien lié
                      </FormLabel>
                      <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {selectedProperty ? (
                                <div className="flex items-center gap-2 truncate">
                                  <Building2 className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{selectedProperty.address}</span>
                                  {selectedProperty.type && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {selectedProperty.type}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                "Aucun bien"
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Rechercher un bien..." 
                              value={propertySearch}
                              onValueChange={setPropertySearch}
                            />
                            <CommandList>
                              <CommandEmpty>Aucun bien trouvé</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => {
                                    field.onChange(null);
                                    setPropertyOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                                  Aucun bien
                                </CommandItem>
                                {filteredProperties.map((property) => (
                                  <CommandItem
                                    key={property.id}
                                    value={property.address}
                                    onSelect={() => {
                                      field.onChange(property.id);
                                      setPropertyOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", field.value === property.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex items-center gap-2">
                                      <span>{property.address}</span>
                                      {property.type && (
                                        <Badge variant="outline" className="text-xs">{property.type}</Badge>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* 8. Description */}
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white">
                        Description
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Notes ou détails supplémentaires..." 
                          rows={4}
                          className="resize-none focus:ring-2 focus:ring-primary"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <FormMessage className="text-red-400" />
                        <span>{field.value?.length || 0}/500</span>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  variant="accent"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {createMutation.isPending ? 'Création...' : "Créer l'activité"}
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
