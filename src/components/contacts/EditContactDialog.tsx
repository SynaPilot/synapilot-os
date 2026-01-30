import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, User, Briefcase, BarChart3, FileText } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { CONTACT_ROLES, CONTACT_ROLE_LABELS, PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/constants';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;

// Validation schema
const editContactSchema = z.object({
  full_name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  role: z.enum(CONTACT_ROLES).optional().nullable(),
  source: z.string().optional().or(z.literal('')),
  pipeline_stage: z.enum(PIPELINE_STAGES).optional().nullable(),
  urgency_score: z.number().min(0).max(10),
  notes: z.string().optional().or(z.literal('')),
});

type EditContactFormValues = z.infer<typeof editContactSchema>;

interface EditContactDialogProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SOURCE_OPTIONS = [
  'Leboncoin',
  'SeLoger',
  'Bien\'ici',
  'PAP',
  'Instagram',
  'Facebook',
  'Bouche à oreille',
  'Site web',
  'Recommandation',
  'Autre',
];

function getScoreLabel(score: number): string {
  if (score <= 3) return 'Froid';
  if (score <= 6) return 'Tiède';
  return 'Chaud 🔥';
}

function getScoreColor(score: number): string {
  if (score <= 3) return 'text-blue-400';
  if (score <= 6) return 'text-purple-400';
  return 'text-primary';
}

export function EditContactDialog({ contact, open, onOpenChange }: EditContactDialogProps) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<EditContactFormValues>({
    resolver: zodResolver(editContactSchema),
    defaultValues: {
      full_name: contact.full_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role || null,
      source: contact.source || '',
      pipeline_stage: contact.pipeline_stage || null,
      urgency_score: contact.urgency_score || 0,
      notes: contact.notes || '',
    },
  });

  // Reset form when contact changes
  useEffect(() => {
    if (open && contact) {
      form.reset({
        full_name: contact.full_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || null,
        source: contact.source || '',
        pipeline_stage: contact.pipeline_stage || null,
        urgency_score: contact.urgency_score || 0,
        notes: contact.notes || '',
      });
    }
  }, [open, contact, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: EditContactFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');

      // Use TablesUpdate type for type-safe updates
      // Pipeline stages and roles are validated by Zod schema which matches DB enums
      const updateData: Partial<Contact> = {
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null,
        role: values.role || null,
        source: values.source || null,
        pipeline_stage: values.pipeline_stage || null,
        urgency_score: values.urgency_score,
        notes: values.notes || null,
      };

      const { error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contact.id)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['contact', contact.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts', organizationId] });
      toast.success('Contact mis à jour ✅');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const onSubmit = (values: EditContactFormValues) => {
    updateMutation.mutate(values);
  };

  const urgencyScore = form.watch('urgency_score');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Modifier le contact
          </DialogTitle>
          <DialogDescription>
            Modifiez les informations du contact ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section Identité */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="w-4 h-4" />
                Identité
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nom complet <span className="text-primary">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Jean Dupont" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jean@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="06 12 34 56 78" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section Qualification */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="w-4 h-4" />
                Qualification
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rôle</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={(val) => field.onChange(val || null)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un rôle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTACT_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {CONTACT_ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={(val) => field.onChange(val || '')}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="D'où vient ce contact ?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section Pipeline */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="w-4 h-4" />
                Pipeline
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pipeline_stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Étape du pipeline</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(val) => field.onChange(val || null)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une étape" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PIPELINE_STAGES.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {PIPELINE_STAGE_LABELS[stage]}
                            </SelectItem>
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
                      <FormLabel className="flex items-center justify-between">
                        <span>Score d'urgence</span>
                        <span className={`text-sm font-medium ${getScoreColor(urgencyScore)}`}>
                          {urgencyScore}/10 - {getScoreLabel(urgencyScore)}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={10}
                          step={1}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-4"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section Notes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="w-4 h-4" />
                Notes
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes internes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ajouter des notes sur ce contact..."
                        className="min-h-[100px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="gap-2"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
