import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  FileText,
  Check,
  ChevronsUpDown,
  User,
  Clock,
  Edit3,
  MessageSquare,
  Sparkles,
  List,
  CalendarDays,
} from 'lucide-react';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES, ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS, ACTIVITY_PRIORITY_LABELS } from '@/lib/constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { AIMessageGenerator } from '@/components/activities/AIMessageGenerator';
import { ActivityListView } from '@/components/activities/ActivityListView';
import { ActivityCalendarView } from '@/components/activities/ActivityCalendarView';

type Activity = Tables<'activities'> & {
  contacts?: { full_name: string } | null;
  properties?: { address: string; type?: string } | null;
  ai_generated?: boolean;
};

type Contact = { id: string; full_name: string; email: string | null };
type Property = { id: string; address: string; type: string | null };

const activitySchema = z.object({
  name: z.string()
    .min(3, "Le titre doit contenir au moins 3 caractères")
    .max(100, "Le titre ne peut pas dépasser 100 caractères"),
  type: z.enum(['appel', 'email', 'visite', 'rdv', 'relance', 'signature', 'note', 'tache', 'autre']),
  date: z.date(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:mm requis"),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']),
  status: z.enum(['planifie', 'en_cours', 'termine', 'annule']),
  contact_id: z.string().uuid().nullable(),
  property_id: z.string().uuid().nullable(),
  description: z.string().max(500, "Maximum 500 caractères").optional(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// Type icons with color dots for the create form
function getActivityTypeIcon(type: string | null) {
  const config: Record<string, { icon: React.ElementType; dotColor: string }> = {
    'appel': { icon: Phone, dotColor: 'bg-purple-400' },
    'email': { icon: Mail, dotColor: 'bg-blue-400' },
    'visite': { icon: MapPin, dotColor: 'bg-purple-600' },
    'relance': { icon: RefreshCw, dotColor: 'bg-blue-600' },
    'rdv': { icon: CalendarIcon, dotColor: 'bg-purple-500' },
    'signature': { icon: FileText, dotColor: 'bg-blue-500' },
    'note': { icon: FileText, dotColor: 'bg-purple-400' },
    'tache': { icon: CheckCircle2, dotColor: 'bg-blue-400' },
    'autre': { icon: CalendarIcon, dotColor: 'bg-gray-400' },
  };
  return config[type || ''] || { icon: CalendarIcon, dotColor: 'bg-gray-400' };
}

function getPriorityColor(priority: string | null) {
  const colors: Record<string, string> = {
    'urgente': 'bg-purple-600/20 text-purple-300 border-purple-600/30',
    'haute': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'normale': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'basse': 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  };
  return colors[priority || ''] || 'bg-muted text-muted-foreground';
}

function getStatusColor(status: string | null) {
  const colors: Record<string, string> = {
    'planifie': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'en_cours': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'termine': 'bg-blue-700/30 text-blue-200 border-blue-700/40',
    'annule': 'bg-gray-600/20 text-gray-400 border-gray-600/30',
  };
  return colors[status || ''] || 'bg-muted text-muted-foreground';
}

export default function Activities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('vue') || 'liste';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<ActivityFormValues> | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
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
      type: 'appel',
      date: now,
      time: currentTime,
      priority: 'normale',
      status: 'planifie',
      contact_id: null,
      property_id: null,
      description: '',
    },
  });

  // Focus name input when dialog opens
  useEffect(() => {
    if (isDialogOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isDialogOpen]);

  // Apply prefill data when dialog opens with prefill
  useEffect(() => {
    if (isDialogOpen && prefillData) {
      form.reset({
        name: prefillData.name || '',
        type: prefillData.type || 'appel',
        date: prefillData.date || new Date(),
        time: prefillData.time || currentTime,
        priority: prefillData.priority || 'normale',
        status: prefillData.status || 'planifie',
        contact_id: prefillData.contact_id || null,
        property_id: prefillData.property_id || null,
        description: prefillData.description || '',
      });
    }
  }, [isDialogOpen, prefillData, form, currentTime]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      const newNow = new Date();
      const newTime = `${String(newNow.getHours()).padStart(2, '0')}:${String(newNow.getMinutes()).padStart(2, '0')}`;
      form.reset({
        name: '',
        type: 'appel',
        date: newNow,
        time: newTime,
        priority: 'normale',
        status: 'planifie',
        contact_id: null,
        property_id: null,
        description: '',
      });
      setContactSearch('');
      setPropertySearch('');
      setPrefillData(null);
      setAiGenerated(false);
    }
  }, [isDialogOpen, form]);

  const { data: activities, isLoading } = useOrgQuery<Activity[]>('activities', {
    select: '*, contacts:contact_id(full_name), properties:property_id(address, type)',
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

      const [hours, minutes] = values.time.split(':').map(Number);
      const dateTime = new Date(values.date);
      dateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from('activities')
        .insert([{
          organization_id: organizationId,
          name: values.name,
          type: values.type,
          date: dateTime.toISOString(),
          priority: values.priority,
          status: values.status,
          description: values.description || null,
          contact_id: values.contact_id || null,
          property_id: values.property_id || null,
          assigned_to: user?.id || null,
          ai_generated: aiGenerated,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
      setIsDialogOpen(false);
      toast.success(aiGenerated ? 'Activité IA créée avec succès' : 'Activité créée avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const todoCount = activities?.filter((a) => a.status === 'planifie' || a.status === 'en_cours').length || 0;
  const completedToday = activities?.filter((a) => {
    const today = new Date().toDateString();
    return a.status === 'termine' && a.date && new Date(a.date).toDateString() === today;
  }).length || 0;

  const selectedContact = contacts?.find(c => c.id === form.watch('contact_id'));
  const selectedProperty = properties?.find(p => p.id === form.watch('property_id'));

  const handleTabChange = (value: string) => {
    setSearchParams({ vue: value }, { replace: true });
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
            {todoCount} à faire &bull; {completedToday} terminées aujourd'hui
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="accent">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle activité
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 backdrop-blur-xl shadow-2xl shadow-black/50 border-white/10 rounded-xl">
            {/* Premium Header with gradient */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-8 pb-6 border-b border-white/10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold text-white flex items-center gap-3 antialiased">
                  <CalendarIcon className="w-6 h-6 text-purple-400" />
                  Créer une activité
                </DialogTitle>
                <DialogDescription className="text-white/60 font-[Poppins]">
                  Planifiez une nouvelle tâche ou un rendez-vous
                </DialogDescription>
              </DialogHeader>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="p-8 space-y-8">

                {/* SECTION 1: Détails de l'activité */}
                <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                  <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">
                    Détails de l'activité
                  </h3>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-purple-400" />
                          Nom de l'activité <span className="text-purple-400">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            ref={nameInputRef}
                            placeholder="Ex: Relancer Marie Martin"
                            className="text-lg bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:shadow-lg focus:shadow-purple-500/20 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                          />
                        </FormControl>
                        <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-white">
                          Type <span className="text-purple-400">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#1a1a1a] border-white/20">
                            {ACTIVITY_TYPES.map((type) => {
                              const { icon: TypeIcon, dotColor } = getActivityTypeIcon(type);
                              return (
                                <SelectItem key={type} value={type} className="focus:bg-purple-500/20">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                    <TypeIcon className="w-4 h-4 text-purple-400" />
                                    <span>{ACTIVITY_TYPE_LABELS[type as keyof typeof ACTIVITY_TYPE_LABELS] || type}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-purple-400" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => {
                        const isRdv = form.watch('type') === 'rdv';
                        return (
                          <FormItem className="flex flex-col">
                            <FormLabel className={cn(
                              "text-sm font-semibold flex items-center gap-2",
                              isRdv ? "text-purple-400 font-bold" : "text-white"
                            )}>
                              <Clock className="w-4 h-4 text-blue-400" />
                              Date <span className="text-purple-400">*</span>
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "pl-3 text-left font-normal bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white",
                                      !field.value && "text-white/40"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "EEE d MMM yyyy", { locale: fr })
                                    ) : (
                                      <span>Choisir une date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 text-blue-400" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border border-gradient-to-r from-purple-500/30 to-blue-500/30" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  locale={fr}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage className="text-purple-400" />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400" />
                            Heure <span className="text-purple-400">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="time"
                              className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white"
                            />
                          </FormControl>
                          <FormMessage className="text-purple-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* SECTION 2: Priorité & Statut */}
                <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                  <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">
                    Priorité & Statut
                  </h3>

                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-white">
                            Priorité <span className="text-purple-400">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 rounded-xl text-white">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-[#1a1a1a] border-white/20">
                              {ACTIVITY_PRIORITIES.map((priority) => (
                                <SelectItem key={priority} value={priority} className="focus:bg-blue-500/20">
                                  <Badge className={cn(
                                    getPriorityColor(priority),
                                    priority === 'haute' || priority === 'urgente' ? 'animate-pulse' : ''
                                  )}>
                                    {ACTIVITY_PRIORITY_LABELS[priority as keyof typeof ACTIVITY_PRIORITY_LABELS] || priority}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-purple-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-white">
                            Statut <span className="text-purple-400">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 rounded-xl text-white">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-[#1a1a1a] border-white/20">
                              {ACTIVITY_STATUSES.map((status) => (
                                <SelectItem key={status} value={status} className="focus:bg-blue-500/20">
                                  <Badge className={getStatusColor(status)}>
                                    {ACTIVITY_STATUS_LABELS[status as keyof typeof ACTIVITY_STATUS_LABELS] || status}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-purple-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* SECTION 3: Relations & Notes */}
                <div className="border-l-2 border-purple-500/30 pl-4 bg-white/5 rounded-r-xl py-4 pr-4 space-y-6">
                  <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                    Relations & Notes
                  </h3>

                  <FormField
                    control={form.control}
                    name="contact_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                          <User className="w-4 h-4 text-purple-400" />
                          Contact lié
                        </FormLabel>
                        <Popover open={contactOpen} onOpenChange={setContactOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "justify-between bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white",
                                  !field.value && "text-white/40 italic"
                                )}
                              >
                                {selectedContact ? (
                                  <div className="flex items-center gap-2 truncate">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                                      {selectedContact.full_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate">{selectedContact.full_name}</span>
                                    {selectedContact.email && (
                                      <span className="text-white/40 text-xs truncate">
                                        ({selectedContact.email})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  "Rechercher un contact (optionnel)"
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-purple-400" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0 bg-[#1a1a1a] border-white/20" align="start">
                            <Command className="bg-transparent">
                              <CommandInput
                                placeholder="Rechercher..."
                                value={contactSearch}
                                onValueChange={setContactSearch}
                                className="text-white placeholder:text-white/40 italic"
                              />
                              <CommandList>
                                <CommandEmpty className="text-white/40 py-4 text-center">Aucun contact trouvé</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="none"
                                    onSelect={() => {
                                      field.onChange(null);
                                      setContactOpen(false);
                                    }}
                                    className="text-white/60 hover:bg-purple-500/20"
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100 text-purple-400" : "opacity-0")} />
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
                                      className="text-white hover:bg-purple-500/20"
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value === contact.id ? "opacity-100 text-purple-400" : "opacity-0")} />
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-semibold text-white">
                                          {contact.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className={contactSearch && contact.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ? "text-purple-400" : ""}>
                                            {contact.full_name}
                                          </span>
                                          {contact.email && (
                                            <span className="text-xs text-white/40">{contact.email}</span>
                                          )}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="text-purple-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="property_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                          <Home className="w-4 h-4 text-blue-400" />
                          Bien lié
                        </FormLabel>
                        <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "justify-between bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 rounded-xl text-white",
                                  !field.value && "text-white/40 italic"
                                )}
                              >
                                {selectedProperty ? (
                                  <div className="flex items-center gap-2 truncate">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
                                      <Home className="w-3 h-3 text-white" />
                                    </div>
                                    <span className="truncate">{selectedProperty.address}</span>
                                    {selectedProperty.type && (
                                      <Badge variant="outline" className="text-xs shrink-0 border-blue-500/30 text-blue-400">
                                        {selectedProperty.type}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  "Rechercher un bien (optionnel)"
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-blue-400" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0 bg-[#1a1a1a] border-white/20" align="start">
                            <Command className="bg-transparent">
                              <CommandInput
                                placeholder="Rechercher..."
                                value={propertySearch}
                                onValueChange={setPropertySearch}
                                className="text-white placeholder:text-white/40 italic"
                              />
                              <CommandList>
                                <CommandEmpty className="text-white/40 py-4 text-center">Aucun bien trouvé</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="none"
                                    onSelect={() => {
                                      field.onChange(null);
                                      setPropertyOpen(false);
                                    }}
                                    className="text-white/60 hover:bg-blue-500/20"
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100 text-blue-400" : "opacity-0")} />
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
                                      className="text-white hover:bg-blue-500/20"
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value === property.id ? "opacity-100 text-blue-400" : "opacity-0")} />
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                          <Home className="w-3 h-3 text-white" />
                                        </div>
                                        <span className={propertySearch && property.address.toLowerCase().includes(propertySearch.toLowerCase()) ? "text-blue-400" : ""}>
                                          {property.address}
                                        </span>
                                        {property.type && (
                                          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">{property.type}</Badge>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="text-purple-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => {
                      const activityType = form.watch('type');
                      const contactId = form.watch('contact_id');
                      const propertyId = form.watch('property_id');
                      const showAIButton = activityType === 'relance' || activityType === 'email';

                      return (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-semibold text-white flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-purple-400" />
                              Description
                            </FormLabel>
                            {showAIButton && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAIGenerator(true)}
                                disabled={!contactId}
                                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 px-2"
                              >
                                <Sparkles className="w-4 h-4 mr-1" />
                                Générer avec IA
                              </Button>
                            )}
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Textarea
                                {...field}
                                value={field.value || ''}
                                placeholder={showAIButton && !contactId
                                  ? "Sélectionnez un contact pour activer la génération IA..."
                                  : "Notes ou détails supplémentaires..."
                                }
                                rows={4}
                                className="resize-none min-h-[100px] bg-white/10 hover:bg-white/15 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 rounded-xl text-white placeholder:text-white/40"
                                style={{
                                  borderImage: 'linear-gradient(to right, rgba(124, 58, 237, 0.3), rgba(59, 130, 246, 0.3)) 1'
                                }}
                              />
                            </div>
                          </FormControl>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <FormMessage className="text-purple-400" />
                              {aiGenerated && field.value && (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 h-5">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  DeepSeek IA
                                </Badge>
                              )}
                            </div>
                            <span className="text-blue-400">{(field.value || '').length}/500</span>
                          </div>

                          <AIMessageGenerator
                            open={showAIGenerator}
                            onOpenChange={setShowAIGenerator}
                            contactId={contactId}
                            propertyId={propertyId}
                            activityType={activityType}
                            onSelectMessage={(message) => {
                              field.onChange(message);
                              setAiGenerated(true);
                            }}
                          />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/30 transition-all duration-200 hover:scale-[1.02] rounded-xl font-semibold tracking-wide text-white h-12"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    "Créer l'activité"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs: Liste / Calendrier */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="liste" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 gap-2">
            <List className="w-4 h-4" />
            Vue Liste
          </TabsTrigger>
          <TabsTrigger value="calendrier" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 gap-2">
            <CalendarDays className="w-4 h-4" />
            Vue Calendrier
          </TabsTrigger>
        </TabsList>

        <TabsContent value="liste">
          <ActivityListView
            activities={activities}
            isLoading={isLoading}
            onOpenCreate={() => setIsDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="calendrier">
          <ActivityCalendarView
            activities={activities}
            isLoading={isLoading}
            onOpenCreate={() => setIsDialogOpen(true)}
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
