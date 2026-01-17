import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  User,
  Edit,
  Trash2,
  Plus,
  Clock,
  MessageSquare,
  Eye,
  PhoneCall,
  FileText,
  Building,
  TrendingUp,
  Loader2,
  Save,
} from 'lucide-react';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { SmartBadges } from '@/components/SmartBadges';
import { getContactBadges } from '@/lib/smart-features';
import { formatDate, formatRelativeTime, formatCurrency } from '@/lib/formatters';
import { CONTACT_ROLES, ACTIVITY_TYPES, DEAL_STAGE_LABELS, type DealStage } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Activity = Tables<'activities'> & {
  profiles?: { full_name: string } | null;
};
type Deal = Tables<'deals'>;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const activitySchema = z.object({
  type: z.enum(['appel', 'email', 'visite', 'rdv', 'relance', 'signature', 'note', 'tache', 'autre']),
  description: z.string().min(1, 'Description requise').max(1000),
  date: z.string().optional(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

function getActivityIcon(type: string) {
  switch (type) {
    case 'Call':
      return <PhoneCall className="w-4 h-4" />;
    case 'Email':
      return <Mail className="w-4 h-4" />;
    case 'SMS':
      return <MessageSquare className="w-4 h-4" />;
    case 'Meeting':
      return <User className="w-4 h-4" />;
    case 'Visite':
      return <Eye className="w-4 h-4" />;
    case 'Relance':
      return <Clock className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'Call':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Email':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'SMS':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Meeting':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Visite':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'Relance':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState<string | null>(null);

  const contactQueryKey = ['contact', id, organizationId];

  // Fetch contact details
  const { data: contact, isLoading: isLoadingContact } = useOrgQuery<Contact>(
    'contacts',
    {
      filters: { id },
      single: true,
    },
    {
      enabled: !!id,
    }
  );

  // Fetch related activities
  const { data: activities, isLoading: isLoadingActivities } = useOrgQuery<Activity[]>(
    'activities',
    {
      select: '*, profiles:assigned_to(full_name)',
      filters: { related_contact_id: id },
      orderBy: { column: 'date', ascending: false },
    },
    {
      enabled: !!id,
    }
  );

  // Fetch related deals
  const { data: deals, isLoading: isLoadingDeals } = useOrgQuery<Deal[]>(
    'deals',
    {
      filters: { contact_id: id },
      orderBy: { column: 'created_at', ascending: false },
    },
    {
      enabled: !!id,
    }
  );

  const activityForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: 'appel',
      description: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      if (!organizationId || !id) throw new Error('Organisation non trouvée');
      const { error } = await supabase.from('activities').insert([{
        name: values.description.slice(0, 100),
        type: values.type,
        description: values.description,
        date: values.date || new Date().toISOString(),
        contact_id: id,
        organization_id: organizationId,
        status: 'termine',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', organizationId] });
      setIsActivityDialogOpen(false);
      activityForm.reset();
      toast.success('Activité ajoutée');
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`),
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!organizationId || !id) throw new Error('Organisation non trouvée');
      const { error } = await supabase
        .from('contacts')
        .update({ notes })
        .eq('id', id)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactQueryKey });
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
      toast.success('Notes mises à jour');
      setIsSavingNotes(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
      setIsSavingNotes(false);
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId || !id) throw new Error('Organisation non trouvée');
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
      toast.success('Contact supprimé');
      navigate('/contacts');
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`),
  });

  const handleSaveNotes = () => {
    if (localNotes !== null) {
      setIsSavingNotes(true);
      updateNotesMutation.mutate(localNotes);
    }
  };

  // Get smart badges
  const badges = contact
    ? getContactBadges({
        last_contact_date: contact.last_contact_date || contact.updated_at,
        next_followup_date: contact.next_followup_date,
      })
    : [];

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 8) return 'bg-error/20 text-error border-error/30';
    if (score >= 5) return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-muted text-muted-foreground';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoadingContact) {
    return (
      <motion.div
        className="space-y-6"
        initial="initial"
        animate="animate"
        variants={pageVariants}
      >
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80 lg:col-span-2" />
        </div>
      </motion.div>
    );
  }

  if (!contact) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-20"
        initial="initial"
        animate="animate"
        variants={pageVariants}
      >
        <User className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Contact non trouvé</h2>
        <p className="text-muted-foreground mb-6">Ce contact n'existe pas ou a été supprimé.</p>
        <Button onClick={() => navigate('/contacts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux contacts
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/contacts')}
        className="gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux contacts
      </Button>

      {/* Header */}
      <Card className="border-border bg-card/50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16 border-2 border-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-lg font-semibold">
                  {getInitials(contact.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">{contact.full_name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {contact.phone}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {contact.role && (
                    <Badge variant="outline" className="text-xs">
                      {contact.role}
                    </Badge>
                  )}
                  <Badge className={cn('text-xs', getScoreColor(contact.urgency_score))}>
                    Score: {contact.urgency_score || 0}/10
                  </Badge>
                  <SmartBadges badges={badges} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Edit className="w-4 h-4" />
                Modifier
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Toutes les données associées à {contact.full_name} seront
                      définitivement supprimées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteContactMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteContactMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section 1: Informations */}
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium">{contact.source || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent assigné</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date de création</span>
                <span className="font-medium font-mono text-xs">
                  {contact.created_at ? formatDate(contact.created_at) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dernier contact</span>
                <span className="font-medium font-mono text-xs">
                  {contact.last_contact_date ? formatRelativeTime(contact.last_contact_date) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prochain follow-up</span>
                <span className="font-medium font-mono text-xs">
                  {contact.next_followup_date ? formatDate(contact.next_followup_date) : '—'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Notes</span>
                {localNotes !== null && localNotes !== contact.notes && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="h-7 gap-1.5"
                  >
                    {isSavingNotes ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Sauvegarder
                  </Button>
                )}
              </div>
              <Textarea
                placeholder="Ajouter des notes..."
                value={localNotes ?? contact.notes ?? ''}
                onChange={(e) => setLocalNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Activités */}
        <Card className="border-border bg-card/50 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Activité
              </CardTitle>
              <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouvelle activité</DialogTitle>
                  </DialogHeader>
                  <Form {...activityForm}>
                    <form
                      onSubmit={activityForm.handleSubmit((v) => createActivityMutation.mutate(v))}
                      className="space-y-4"
                    >
                      <FormField
                        control={activityForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type d'activité</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ACTIVITY_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={activityForm.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={activityForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Décrivez l'activité..."
                                {...field}
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={createActivityMutation.isPending}>
                          {createActivityMutation.isPending && (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          )}
                          Ajouter l'activité
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingActivities ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-6">
                  {activities.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative flex gap-4 pl-2"
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center border z-10',
                          getActivityColor(activity.type)
                        )}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{activity.type}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {activity.date ? formatRelativeTime(activity.date) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucune activité enregistrée</p>
                <p className="text-xs mt-1">Ajoutez une activité pour commencer le suivi</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Deals & Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals liés */}
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Deals en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDeals ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : deals && deals.length > 0 ? (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <motion.div
                    key={deal.id}
                    whileHover={{ scale: 1.01 }}
                    className="p-3 rounded-lg border border-border bg-background/50 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => navigate('/deals')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{deal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {DEAL_STAGE_LABELS[deal.stage as DealStage] || deal.stage}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary font-mono">
                          {formatCurrency(deal.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{deal.probability || 0}%</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucun deal associé</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Biens correspondants */}
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              Biens correspondants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <Building className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Aucun bien correspondant</p>
              <p className="text-xs mt-1">Les biens seront suggérés selon les critères du contact</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
