import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  User, 
  Loader2
} from 'lucide-react';
import { useProfile } from '@/hooks/useOrganization';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  PIPELINE_STAGES, 
  PIPELINE_STAGE_LABELS, 
  CONTACT_ROLES,
  formatRelativeDate,
  type PipelineStage 
} from '@/lib/constants';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;

const contactSchema = z.object({
  full_name: z.string().min(2, 'Nom requis').max(100),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  role: z.enum(['Acheteur', 'Vendeur', 'Investisseur', 'Locataire']).optional(),
  urgency_score: z.number().min(0).max(10).default(0),
  source: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

function ContactCard({ contact, isDragging }: { contact: Contact; isDragging?: boolean }) {
  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 8) return 'bg-destructive/20 text-destructive border-destructive/30';
    if (score >= 5) return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className={`glass transition-all ${isDragging ? 'opacity-50 scale-105' : 'hover:border-primary/30'}`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          <p className="font-medium text-sm truncate">{contact.full_name}</p>
          {contact.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
              <Phone className="w-3 h-3" />
              {contact.phone}
            </p>
          )}
          <div className="flex items-center gap-2">
            {contact.role && (
              <Badge variant="outline" className="text-xs">
                {contact.role}
              </Badge>
            )}
            <Badge className={`text-xs ${getScoreColor(contact.urgency_score)}`}>
              {contact.urgency_score || 0}/10
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableContactCard({ contact }: { contact: Contact }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <ContactCard contact={contact} isDragging={isDragging} />
    </div>
  );
}

function KanbanColumn({ 
  stage, 
  contacts 
}: { 
  stage: PipelineStage; 
  contacts: Contact[];
}) {
  const getStageColor = (stage: PipelineStage) => {
    const colors: Record<PipelineStage, string> = {
      lead: 'border-l-blue-500',
      contacted: 'border-l-purple-500',
      qualified: 'border-l-cyan-500',
      proposal: 'border-l-orange-500',
      won: 'border-l-emerald-500',
      lost: 'border-l-red-500',
    };
    return colors[stage];
  };

  return (
    <div className={`flex-shrink-0 w-72 rounded-lg border-l-4 ${getStageColor(stage)} bg-card/50 border border-l-0 border-white/5`}>
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{PIPELINE_STAGE_LABELS[stage]}</h3>
          <Badge variant="secondary" className="text-xs font-mono">{contacts.length}</Badge>
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto">
        <SortableContext items={contacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {contacts.map((contact) => (
              <motion.div
                key={contact.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <SortableContactCard contact={contact} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
      </div>
    </div>
  );
}

export default function Leads() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      urgency_score: 0,
      source: '',
      notes: '',
    },
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Contact[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      if (!profile?.organization_id) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('contacts')
        .insert({
          full_name: values.full_name,
          email: values.email || null,
          phone: values.phone || null,
          role: values.role || null,
          urgency_score: values.urgency_score,
          source: values.source || null,
          notes: values.notes || null,
          organization_id: profile.organization_id,
          pipeline_stage: 'lead',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsDialogOpen(false);
      form.reset();
      toast.success('Lead créé avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ pipeline_stage: stage })
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['contacts'] });
      const previousContacts = queryClient.getQueryData<Contact[]>(['contacts']);
      
      queryClient.setQueryData<Contact[]>(['contacts'], (old) =>
        old?.map((contact) => (contact.id === id ? { ...contact, pipeline_stage: stage } : contact))
      );
      
      return { previousContacts };
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(['contacts'], context?.previousContacts);
      toast.error('Erreur lors de la mise à jour');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const filteredContacts = useMemo(() => {
    return contacts?.filter((c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
    );
  }, [contacts, searchQuery]);

  const contactsByStage = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = filteredContacts?.filter((c) => c.pipeline_stage === stage) || [];
      return acc;
    }, {} as Record<PipelineStage, Contact[]>);
  }, [filteredContacts]);

  const handleDragStart = (event: DragStartEvent) => {
    const contact = contacts?.find((c) => c.id === event.active.id);
    if (contact) setActiveContact(contact);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);
    
    if (!over) return;
    
    const draggedContactId = active.id as string;
    const overId = over.id as string;
    
    const targetStage = PIPELINE_STAGES.find((stage) => 
      contactsByStage[stage].some((c) => c.id === overId) || stage === overId
    );
    
    if (targetStage) {
      const draggedContact = contacts?.find((c) => c.id === draggedContactId);
      if (draggedContact && draggedContact.pipeline_stage !== targetStage) {
        updateStageMutation.mutate({ id: draggedContactId, stage: targetStage });
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-muted-foreground">{contacts?.length || 0} contacts</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer un contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau contact</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom complet *</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean Dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="email@exemple.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <Input placeholder="06 12 34 56 78" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CONTACT_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="urgency_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Score (0-10)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0} 
                              max={10} 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <FormControl>
                          <Input placeholder="SeLoger, Prospection..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Notes..." {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer le contact
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Views */}
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">Liste</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            {isLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map((stage) => (
                  <div key={stage} className="flex-shrink-0 w-72">
                    <Skeleton className="h-[400px] w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {PIPELINE_STAGES.map((stage) => (
                    <KanbanColumn
                      key={stage}
                      stage={stage}
                      contacts={contactsByStage[stage]}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeContact ? <ContactCard contact={activeContact} isDragging /> : null}
                </DragOverlay>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <Card className="glass">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredContacts?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Aucun contact trouvé</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredContacts?.map((contact) => (
                      <div key={contact.id} className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{contact.full_name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {contact.role && (
                            <Badge variant="outline" className="text-xs">{contact.role}</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {PIPELINE_STAGE_LABELS[contact.pipeline_stage as PipelineStage]}
                          </Badge>
                          {contact.last_contact_date && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatRelativeDate(contact.last_contact_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
