import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Mail, 
  Edit2, 
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Layers,
  Sparkles,
  ArrowRight,
  Users,
  Loader2,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useQueryClient } from '@tanstack/react-query';
import {
  SEQUENCE_TEMPLATES,
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  type SequenceStep,
  type SequenceTemplate,
} from '@/lib/email-templates';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;

interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  steps: SequenceStep[];
  category: string;
  is_active: boolean;
  created_at: string;
  organization_id: string;
}

interface SequenceBuilderProps {
  onEnrollContact?: (sequenceId: string, contactId: string) => void;
}

export function SequenceBuilder({ onEnrollContact }: SequenceBuilderProps) {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<EmailSequence | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  
  // Form state
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceDescription, setSequenceDescription] = useState('');
  const [steps, setSteps] = useState<SequenceStep[]>([
    { delay_days: 0, subject: '', body: '' }
  ]);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Fetch sequences
  const { data: sequences, isLoading: sequencesLoading } = useOrgQuery<EmailSequence[]>(
    'email_sequences',
    {
      select: '*',
      orderBy: { column: 'created_at', ascending: false },
    }
  );

  // Fetch contacts for enrollment
  const { data: contacts } = useOrgQuery<Contact[]>('contacts', {
    select: 'id, full_name, email',
    orderBy: { column: 'full_name', ascending: true },
  });

  // Apply template preset
  const handleApplyTemplate = (template: SequenceTemplate) => {
    setSequenceName(template.name);
    setSequenceDescription(template.description);
    setSteps(template.steps);
    setSelectedTemplateId(template.id);
    toast.success(`Template "${template.name}" appliqué`);
  };

  // Add step
  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([
      ...steps,
      { 
        delay_days: (lastStep?.delay_days || 0) + 3, 
        subject: '', 
        body: '' 
      }
    ]);
  };

  // Remove step
  const removeStep = (index: number) => {
    if (steps.length <= 1) {
      toast.error('Une séquence doit contenir au moins 1 étape');
      return;
    }
    setSteps(steps.filter((_, i) => i !== index));
  };

  // Update step
  const updateStep = (index: number, field: keyof SequenceStep, value: string | number) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  // Move step
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
  };

  // Save sequence
  const handleSaveSequence = async () => {
    if (!sequenceName.trim()) {
      toast.error('Veuillez donner un nom à la séquence');
      return;
    }
    
    if (steps.some(s => !s.subject || !s.body)) {
      toast.error('Tous les emails doivent avoir un objet et un contenu');
      return;
    }

    setIsCreating(true);
    try {
      // Fetch current user's profile id for created_by
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .single();

      const insertData = {
        organization_id: organizationId!,
        name: sequenceName,
        description: sequenceDescription || null,
        steps: steps,
        category: 'custom',
        is_active: true,
        created_by: profileData?.id || null,
      };
      
      const { error } = await supabase.from('email_sequences').insert(insertData as any);

      toast.success('Séquence créée avec succès !');
      queryClient.invalidateQueries({ queryKey: ['email_sequences', organizationId] });
      resetForm();
      setShowCreateDialog(false);
    } catch (err) {
      console.error('Error creating sequence:', err);
      toast.error('Erreur lors de la création de la séquence');
    } finally {
      setIsCreating(false);
    }
  };

  // Enroll contact
  const handleEnrollContact = async () => {
    if (!selectedSequence || !selectedContactId) {
      toast.error('Sélectionnez un contact');
      return;
    }

    setIsEnrolling(true);
    try {
      // Calculate next send date based on first step delay
      const firstStep = (selectedSequence.steps as SequenceStep[])[0];
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + (firstStep?.delay_days || 0));

      const enrollmentData = {
        sequence_id: selectedSequence.id,
        contact_id: selectedContactId,
        organization_id: organizationId,
        current_step: 0,
        status: 'active',
        next_send_at: nextSendAt.toISOString(),
      };
      
      const { error } = await supabase.from('sequence_enrollments').insert(enrollmentData as any);

      if (error) {
        if (error.code === '23505') {
          toast.error('Ce contact est déjà inscrit à cette séquence');
        } else {
          throw error;
        }
        return;
      }

      // Also create scheduled activities for each step
      const stepsData = selectedSequence.steps as SequenceStep[];
      for (const step of stepsData) {
        const sendDate = new Date();
        sendDate.setDate(sendDate.getDate() + step.delay_days);

        await supabase.from('activities').insert({
          organization_id: organizationId,
          name: `📧 ${step.subject}`,
          description: `Email automatique de la séquence "${selectedSequence.name}"`,
          type: 'email',
          status: 'planifie',
          priority: 'normale',
          date: sendDate.toISOString(),
          contact_id: selectedContactId,
          ai_generated: true,
        });
      }

      toast.success('Contact inscrit à la séquence !');
      setShowEnrollDialog(false);
      setSelectedContactId('');
      
      if (onEnrollContact) {
        onEnrollContact(selectedSequence.id, selectedContactId);
      }
    } catch (err) {
      console.error('Error enrolling contact:', err);
      toast.error('Erreur lors de l\'inscription');
    } finally {
      setIsEnrolling(false);
    }
  };

  // Toggle sequence active status
  const toggleSequenceActive = async (sequence: EmailSequence) => {
    try {
      const { error } = await supabase
        .from('email_sequences')
        .update({ is_active: !sequence.is_active })
        .eq('id', sequence.id);

      if (error) throw error;

      toast.success(sequence.is_active ? 'Séquence mise en pause' : 'Séquence activée');
      queryClient.invalidateQueries({ queryKey: ['email_sequences', organizationId] });
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Delete sequence
  const handleDeleteSequence = async (sequence: EmailSequence) => {
    try {
      const { error } = await supabase
        .from('email_sequences')
        .delete()
        .eq('id', sequence.id);

      if (error) throw error;

      toast.success('Séquence supprimée');
      queryClient.invalidateQueries({ queryKey: ['email_sequences', organizationId] });
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setSequenceName('');
    setSequenceDescription('');
    setSteps([{ delay_days: 0, subject: '', body: '' }]);
    setSelectedTemplateId('');
    setEditingStepIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Mes Séquences</h3>
          <p className="text-sm text-muted-foreground">
            Automatisez vos relances avec des campagnes email
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle séquence
        </Button>
      </div>

      {/* Sequences List */}
      {sequencesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : sequences && sequences.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {sequences.map((sequence, index) => {
            const stepsData = sequence.steps as SequenceStep[];
            const totalDays = stepsData.reduce((max, s) => Math.max(max, s.delay_days), 0);
            
            return (
              <motion.div
                key={sequence.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={cn(
                  "bg-card/50 border-border/50 hover:border-purple-500/50 transition-all",
                  !sequence.is_active && "opacity-60"
                )}>
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-400" />
                          {sequence.name}
                        </h4>
                        {sequence.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {sequence.description}
                          </p>
                        )}
                      </div>
                      <Badge variant={sequence.is_active ? 'default' : 'outline'}>
                        {sequence.is_active ? 'Active' : 'En pause'}
                      </Badge>
                    </div>

                    {/* Timeline Preview */}
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                      {stepsData.map((step, i) => (
                        <div key={i} className="flex items-center">
                          <div className="flex flex-col items-center min-w-[60px]">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <Mail className="w-4 h-4 text-purple-400" />
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1">
                              J+{step.delay_days}
                            </span>
                          </div>
                          {i < stepsData.length - 1 && (
                            <div className="w-8 h-px bg-border/50 mx-1" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {stepsData.length} email{stepsData.length > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {totalDays} jour{totalDays > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => toggleSequenceActive(sequence)}
                      >
                        {sequence.is_active ? (
                          <><Pause className="w-3 h-3 mr-1" /> Pause</>
                        ) : (
                          <><Play className="w-3 h-3 mr-1" /> Activer</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setSelectedSequence(sequence);
                          setShowEnrollDialog(true);
                        }}
                        disabled={!sequence.is_active}
                      >
                        <Users className="w-3 h-3 mr-1" />
                        Inscrire
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive ml-auto"
                        onClick={() => handleDeleteSequence(sequence)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-12 text-center">
            <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucune séquence créée
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Automatisez vos relances avec des campagnes email intelligentes
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-purple-500 to-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer ma première séquence
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preset Templates */}
      <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Templates de séquences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {SEQUENCE_TEMPLATES.map((template) => (
              <Card 
                key={template.id}
                className="bg-card/50 border-border/50 hover:border-purple-500/30 cursor-pointer transition-all group"
                onClick={() => {
                  handleApplyTemplate(template);
                  setShowCreateDialog(true);
                }}
              >
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm text-foreground mb-1">
                    {template.name}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                    <span>{template.steps.length} emails</span>
                    <span>•</span>
                    <span>{template.steps[template.steps.length - 1]?.delay_days || 0}j</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Sequence Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Créer une séquence email
            </DialogTitle>
            <DialogDescription>
              Définissez les étapes de votre campagne automatisée
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom de la séquence *</label>
                <Input
                  value={sequenceName}
                  onChange={(e) => setSequenceName(e.target.value)}
                  placeholder="Ex: Nurture Lead Froid"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={sequenceDescription}
                  onChange={(e) => setSequenceDescription(e.target.value)}
                  placeholder="Objectif de cette séquence"
                />
              </div>
            </div>

            {/* Steps Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Étapes de la séquence</label>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="w-3 h-3 mr-1" />
                  Ajouter une étape
                </Button>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <motion.div
                    key={index}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative"
                  >
                    {/* Timeline connector */}
                    {index > 0 && (
                      <div className="absolute left-5 -top-4 h-4 w-px bg-purple-500/30" />
                    )}
                    
                    <Card className={cn(
                      "bg-card/50 border-border/50",
                      editingStepIndex === index && "ring-2 ring-purple-500/50"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Step indicator */}
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <span className="text-sm font-bold text-purple-400">
                                {index + 1}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveStep(index, 'up')}
                                disabled={index === 0}
                              >
                                <ChevronUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveStep(index, 'down')}
                                disabled={index === steps.length - 1}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Step content */}
                          <div className="flex-1 space-y-3">
                            {/* Delay */}
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Envoyer</span>
                              <Input
                                type="number"
                                value={step.delay_days}
                                onChange={(e) => updateStep(index, 'delay_days', parseInt(e.target.value) || 0)}
                                className="w-16 h-8 text-center"
                                min={0}
                              />
                              <span className="text-sm text-muted-foreground">
                                jour{step.delay_days !== 1 ? 's' : ''} après inscription
                              </span>
                            </div>

                            {/* Subject */}
                            <Input
                              value={step.subject}
                              onChange={(e) => updateStep(index, 'subject', e.target.value)}
                              placeholder="Objet de l'email"
                              className="font-medium"
                            />

                            {/* Body */}
                            <Textarea
                              value={step.body}
                              onChange={(e) => updateStep(index, 'body', e.target.value)}
                              placeholder="Contenu de l'email..."
                              rows={4}
                              className="text-sm"
                            />
                          </div>

                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeStep(index)}
                            disabled={steps.length <= 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveSequence}
              disabled={isCreating}
              className="bg-gradient-to-r from-purple-500 to-blue-500"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Créer la séquence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll Contact Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Inscrire un contact
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un contact à inscrire dans la séquence "{selectedSequence?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <Select value={selectedContactId} onValueChange={setSelectedContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts?.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.full_name}
                    {contact.email && ` (${contact.email})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedSequence && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm">
                <p className="text-muted-foreground mb-2">
                  Cette séquence contient :
                </p>
                <ul className="space-y-1">
                  {(selectedSequence.steps as SequenceStep[]).map((step, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground/80">
                      <Mail className="w-3 h-3 text-purple-400" />
                      <span>J+{step.delay_days}:</span>
                      <span className="truncate">{step.subject}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => {
              setShowEnrollDialog(false);
              setSelectedContactId('');
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleEnrollContact}
              disabled={!selectedContactId || isEnrolling}
              className="bg-gradient-to-r from-purple-500 to-blue-500"
            >
              {isEnrolling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Inscrire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
