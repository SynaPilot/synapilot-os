import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useOrganization';
import {
  Plus,
  Search,
  User,
  TrendingUp,
  Calendar,
  Home,
  Settings,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { CONTACT_ROLES, ACTIVITY_TYPES } from '@/lib/constants';

// Schemas
const quickContactSchema = z.object({
  full_name: z.string().min(2, 'Nom requis'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

const quickDealSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  amount: z.number().min(0, 'Montant requis'),
});

const quickActivitySchema = z.object({
  type: z.enum(['appel', 'email', 'visite', 'rdv', 'relance', 'signature', 'note', 'tache', 'autre']),
  description: z.string().min(2, 'Description requise'),
});

type QuickContactValues = z.infer<typeof quickContactSchema>;
type QuickDealValues = z.infer<typeof quickDealSchema>;
type QuickActivityValues = z.infer<typeof quickActivitySchema>;

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Forms
  const contactForm = useForm<QuickContactValues>({
    resolver: zodResolver(quickContactSchema),
    defaultValues: { full_name: '', email: '', phone: '' },
  });

  const dealForm = useForm<QuickDealValues>({
    resolver: zodResolver(quickDealSchema),
    defaultValues: { name: '', amount: 0 },
  });

  const activityForm = useForm<QuickActivityValues>({
    resolver: zodResolver(quickActivitySchema),
    defaultValues: { type: 'appel', description: '' },
  });

  // Mutations
  const createContactMutation = useMutation({
    mutationFn: async (values: QuickContactValues) => {
      if (!profile?.organization_id) throw new Error('Organisation non trouvée');
      const { error } = await supabase.from('contacts').insert([{
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null,
        organization_id: profile.organization_id,
        pipeline_stage: 'nouveau',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setContactDialogOpen(false);
      contactForm.reset();
      toast.success('Contact créé');
    },
    onError: (e) => toast.error(`Erreur: ${e.message}`),
  });

  const createDealMutation = useMutation({
    mutationFn: async (values: QuickDealValues) => {
      if (!profile?.organization_id) throw new Error('Organisation non trouvée');
      const { error } = await supabase.from('deals').insert({
        name: values.name,
        amount: values.amount,
        organization_id: profile.organization_id,
        stage: 'nouveau',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setDealDialogOpen(false);
      dealForm.reset();
      toast.success('Opportunité créée');
    },
    onError: (e) => toast.error(`Erreur: ${e.message}`),
  });

  const createActivityMutation = useMutation({
    mutationFn: async (values: QuickActivityValues) => {
      if (!profile?.organization_id) throw new Error('Organisation non trouvée');
      const { error } = await supabase.from('activities').insert([{
        name: values.description.slice(0, 100),
        type: values.type,
        description: values.description,
        organization_id: profile.organization_id,
        status: 'planifie',
        date: new Date().toISOString(),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setActivityDialogOpen(false);
      activityForm.reset();
      toast.success('Activité créée');
    },
    onError: (e) => toast.error(`Erreur: ${e.message}`),
  });

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      {/* Floating button for mobile */}
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg glow-sm z-50 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher ou créer..." />
        <CommandList>
          <CommandEmpty>Aucun résultat</CommandEmpty>
          
          <CommandGroup heading="Actions rapides">
            <CommandItem onSelect={() => runCommand(() => setContactDialogOpen(true))}>
              <User className="mr-2 h-4 w-4" />
              Créer un contact
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setDealDialogOpen(true))}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Créer une opportunité
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setActivityDialogOpen(true))}>
              <Calendar className="mr-2 h-4 w-4" />
              Logger une activité
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))}>
              <Home className="mr-2 h-4 w-4" />
              Cockpit
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/deals'))}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Pipeline
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/leads'))}>
              <User className="mr-2 h-4 w-4" />
              Contacts
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/stats'))}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Statistiques
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
              <Settings className="mr-2 h-4 w-4" />
              Réglages
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Quick Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit((v) => createContactMutation.mutate(v))} className="space-y-4">
              <FormField
                control={contactForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Jean Dupont" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
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
                control={contactForm.control}
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
              <Button type="submit" className="w-full" disabled={createContactMutation.isPending}>
                {createContactMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Quick Deal Dialog */}
      <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle opportunité</DialogTitle>
          </DialogHeader>
          <Form {...dealForm}>
            <form onSubmit={dealForm.handleSubmit((v) => createDealMutation.mutate(v))} className="space-y-4">
              <FormField
                control={dealForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Vente Appartement..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dealForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant (€) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="350000"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createDealMutation.isPending}>
                {createDealMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Quick Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle activité</DialogTitle>
          </DialogHeader>
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit((v) => createActivityMutation.mutate(v))} className="space-y-4">
              <FormField
                control={activityForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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
                control={activityForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description de l'activité..." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createActivityMutation.isPending}>
                {createActivityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
