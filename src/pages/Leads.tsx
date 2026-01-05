import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  User, 
  GripVertical,
  Loader2,
  MessageSquare
} from 'lucide-react';
import { useProfile } from '@/hooks/useOrganization';
import { callN8nWebhook } from '@/lib/n8n';

const PIPELINE_STAGES = ['Nouveau', 'Qualifié', 'Visite', 'Offre', 'Clos'] as const;
const CONTACT_ROLES = ['Vendeur', 'Acheteur', 'Investisseur'] as const;

const contactSchema = z.object({
  full_name: z.string().min(2, 'Nom requis').max(100),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  role: z.enum(CONTACT_ROLES).optional(),
  urgency_score: z.number().min(0).max(10).default(0),
  source: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'Vendeur' | 'Acheteur' | 'Investisseur' | null;
  pipeline_stage: 'Nouveau' | 'Qualifié' | 'Visite' | 'Offre' | 'Clos';
  urgency_score: number;
  source: string | null;
  notes: string | null;
  created_at: string;
};

function LeadCard({ contact, onDragStart }: { contact: Contact; onDragStart: () => void }) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (score >= 5) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card 
      className="glass border-border/50 hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={onDragStart}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{contact.full_name}</p>
            {contact.phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {contact.phone}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {contact.role && (
                <Badge variant="outline" className="text-xs">
                  {contact.role}
                </Badge>
              )}
              <Badge className={`text-xs ${getScoreColor(contact.urgency_score)}`}>
                {contact.urgency_score}/10
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({ 
  stage, 
  contacts, 
  onDrop 
}: { 
  stage: typeof PIPELINE_STAGES[number]; 
  contacts: Contact[];
  onDrop: (stage: typeof PIPELINE_STAGES[number]) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div 
      className={`flex-1 min-w-[280px] max-w-[320px] rounded-lg border transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-card/50'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => {
        setIsDragOver(false);
        onDrop(stage);
      }}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">{stage}</h3>
          <Badge variant="secondary">{contacts.length}</Badge>
        </div>
      </div>
      <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
        {contacts.map((contact) => (
          <LeadCard key={contact.id} contact={contact} onDragStart={() => {}} />
        ))}
      </div>
    </div>
  );
}

export default function Leads() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

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
      if (!profile?.organization_id) throw new Error('Organization not found');
      
      const { data, error } = await supabase
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
          pipeline_stage: 'Nouveau' as const,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: 'Lead créé avec succès' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: typeof PIPELINE_STAGES[number] }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ pipeline_stage: stage })
        .eq('id', id);

      if (error) throw error;

      // Trigger n8n webhook when qualifying
      if (stage === 'Qualifié') {
        await callN8nWebhook('qualify_lead', { contactId: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const filteredContacts = contacts?.filter((c) =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  const contactsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = filteredContacts?.filter((c) => c.pipeline_stage === stage) || [];
    return acc;
  }, {} as Record<typeof PIPELINE_STAGES[number], Contact[]>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground">Gérez vos contacts et prospects</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un Lead</DialogTitle>
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
                            <Input placeholder="email@example.com" {...field} />
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
                          <FormLabel>Score urgence (0-10)</FormLabel>
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
                          <Textarea placeholder="Informations complémentaires..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer le lead
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Kanban View */}
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">Liste</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            {isLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map((stage) => (
                  <div key={stage} className="flex-1 min-w-[280px] max-w-[320px]">
                    <Skeleton className="h-[400px] w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map((stage) => (
                  <KanbanColumn
                    key={stage}
                    stage={stage}
                    contacts={contactsByStage[stage]}
                    onDrop={(newStage) => {
                      if (draggedContact) {
                        updateStageMutation.mutate({ id: draggedContact.id, stage: newStage });
                        setDraggedContact(null);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <Card className="glass border-border/50">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredContacts?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun lead trouvé</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredContacts?.map((contact) => (
                      <div key={contact.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{contact.full_name}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
                          <Badge variant="outline">{contact.pipeline_stage}</Badge>
                          {contact.role && <Badge variant="secondary">{contact.role}</Badge>}
                          <Button size="sm" variant="ghost">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
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
