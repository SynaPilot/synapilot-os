import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Target,
  Mail,
  Phone,
  UserCheck,
  AlertCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Send,
  X,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { useContactSearchesWithContacts, type ContactSearch } from '@/hooks/useContactSearches';
import { useActivities } from '@/hooks/useActivities';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { injectVariables } from '@/components/emails/VariableInjector';
import { formatCurrency } from '@/lib/formatters';
import type { Property } from '@/hooks/useProperties';
import type { Tables } from '@/integrations/supabase/types';

interface PropertyMatchingWidgetProps {
  property: Property;
  onContactBuyer?: (contactId: string) => void;
}

interface MatchResult {
  search: ContactSearch & {
    contact: {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      role: string | null;
    }
  };
  score: number;
  details: {
    budgetMatch: 'perfect' | 'tight' | 'over' | null;
    surfaceMatch: boolean;
    roomsMatch: boolean;
    typeMatch: boolean;
    cityMatch: boolean;
  };
  warnings: string[];
}

function calculateMatchScore(
  property: Property,
  search: ContactSearch
): { score: number; details: MatchResult['details']; warnings: string[] } {
  let score = 0;
  let maxScore = 0;
  const warnings: string[] = [];

  const details: MatchResult['details'] = {
    budgetMatch: null,
    surfaceMatch: false,
    roomsMatch: false,
    typeMatch: false,
    cityMatch: false,
  };

  // Budget matching (40% weight)
  if (search.budget_max && property.price) {
    maxScore += 40;
    const budgetDiff = (search.budget_max - property.price) / property.price;

    if (budgetDiff >= 0) {
      score += 40;
      details.budgetMatch = 'perfect';
    } else if (budgetDiff >= -0.1) {
      score += 25;
      details.budgetMatch = 'tight';
      warnings.push(`Budget serré (+${Math.abs(Math.round(budgetDiff * 100))}%)`);
    } else {
      details.budgetMatch = 'over';
      warnings.push(`Hors budget (+${Math.abs(Math.round(budgetDiff * 100))}%)`);
    }
  }

  // Surface matching (20% weight)
  if (search.min_surface && property.surface) {
    maxScore += 20;
    if (property.surface >= search.min_surface) {
      score += 20;
      details.surfaceMatch = true;
    } else {
      warnings.push(`Surface insuffisante (${property.surface}m² vs ${search.min_surface}m² min)`);
    }
  }

  // Rooms matching (15% weight)
  if (search.min_rooms && property.rooms) {
    maxScore += 15;
    if (property.rooms >= search.min_rooms) {
      score += 15;
      details.roomsMatch = true;
    } else {
      warnings.push(`Pièces insuffisantes (${property.rooms} vs ${search.min_rooms} min)`);
    }
  }

  // Property type matching (15% weight)
  if (search.property_types && search.property_types.length > 0 && property.type) {
    maxScore += 15;
    if (search.property_types.includes(property.type)) {
      score += 15;
      details.typeMatch = true;
    } else {
      warnings.push(`Type non recherché`);
    }
  }

  // City matching (10% weight)
  if (search.cities && search.cities.length > 0 && property.city) {
    maxScore += 10;
    if (search.cities.some(city =>
      city.toLowerCase() === property.city?.toLowerCase()
    )) {
      score += 10;
      details.cityMatch = true;
    }
  }

  const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return { score: finalScore, details, warnings };
}

function MatchScoreBadge({ score }: { score: number }) {
  if (score >= 80) {
    return (
      <Badge variant="success" className="gap-1">
        <TrendingUp className="h-3 w-3" />
        {score}% Match
      </Badge>
    );
  }
  if (score >= 50) {
    return (
      <Badge variant="warning" className="gap-1">
        <Minus className="h-3 w-3" />
        {score}% Match
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <TrendingDown className="h-3 w-3" />
      {score}% Match
    </Badge>
  );
}

function BuyerCard({
  match,
  onContact,
  property,
  selected,
  onToggleSelect,
  alreadyContacted,
}: {
  match: MatchResult;
  onContact?: (contactId: string) => void;
  property: Property;
  selected: boolean;
  onToggleSelect: (contactId: string) => void;
  alreadyContacted: boolean;
}) {
  const { contact } = match.search;
  const initials = contact.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const { create: createActivity, isCreating } = useActivities();

  const handleLogActivity = async () => {
    await createActivity({
      name: `Matching: ${contact.full_name} ↔ ${property.title}`,
      type: 'relance',
      description: `Proposition du bien "${property.title}" à ${contact.full_name} - Score: ${match.score}%`,
      contact_id: contact.id,
      property_id: property.id,
      date: new Date().toISOString(),
    });
    onContact?.(contact.id);
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-2">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(contact.id)}
              className="mt-0.5"
            />
          </div>
          <Avatar className="h-10 w-10 border border-border">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="font-medium text-sm truncate">{contact.full_name}</h4>
                {alreadyContacted && (
                  <Badge variant="outline" className="text-xs py-0 h-5 shrink-0 text-green-500 border-green-500/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Contacté
                  </Badge>
                )}
              </div>
              <MatchScoreBadge score={match.score} />
            </div>

            {/* Budget info */}
            {match.search.budget_max && (
              <p className="text-xs text-muted-foreground mb-2">
                Budget: {formatCurrency(match.search.budget_max)}
                {match.details.budgetMatch === 'tight' && (
                  <span className="text-warning ml-1">(serré)</span>
                )}
                {match.details.budgetMatch === 'over' && (
                  <span className="text-error ml-1">(dépassé)</span>
                )}
              </p>
            )}

            {/* Match details pills */}
            <div className="flex flex-wrap gap-1 mb-3">
              {match.details.surfaceMatch && (
                <Badge variant="outline" className="text-xs py-0 h-5">
                  Surface ✓
                </Badge>
              )}
              {match.details.roomsMatch && (
                <Badge variant="outline" className="text-xs py-0 h-5">
                  Pièces ✓
                </Badge>
              )}
              {match.details.typeMatch && (
                <Badge variant="outline" className="text-xs py-0 h-5">
                  Type ✓
                </Badge>
              )}
              {match.details.cityMatch && (
                <Badge variant="outline" className="text-xs py-0 h-5">
                  Ville ✓
                </Badge>
              )}
            </div>

            {/* Warnings */}
            {match.warnings.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-3">
                <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>{match.warnings.slice(0, 2).join(' • ')}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {contact.email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  asChild
                >
                  <a href={`mailto:${contact.email}?subject=Bien: ${property.title}`}>
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Email
                  </a>
                </Button>
              )}
              {contact.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  asChild
                >
                  <a href={`tel:${contact.phone}`}>
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Appeler
                  </a>
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs ml-auto"
                onClick={handleLogActivity}
                loading={isCreating}
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Logger
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BulkProposalDialog({
  open,
  onOpenChange,
  selectedBuyers,
  matches,
  property,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBuyers: string[];
  matches: MatchResult[];
  property: Property;
  onSuccess: () => void;
}) {
  const { organizationId, user } = useAuth();
  const [templates, setTemplates] = useState<Tables<'email_templates'>[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [logActivity, setLogActivity] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Fetch offer templates
  useEffect(() => {
    if (!open || !organizationId) return;

    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('category', 'property_proposal');

      setTemplates(data || []);
      if (data?.length && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
      setIsLoadingTemplates(false);
    };

    fetchTemplates();
  }, [open, organizationId, selectedTemplateId]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Preview with first selected buyer
  const previewBuyer = matches.find(m => selectedBuyers.includes(m.search.contact.id));
  const previewContact = previewBuyer?.search.contact;

  const previewText = useMemo(() => {
    if (!selectedTemplate || !previewContact) return '';

    return injectVariables(selectedTemplate.content, {
      contact: {
        full_name: previewContact.full_name,
        email: previewContact.email,
      } as Tables<'contacts'>,
      property: property as Tables<'properties'>,
      agent: user ? { full_name: (user as { user_metadata?: { full_name?: string } }).user_metadata?.full_name } : null,
    });
  }, [selectedTemplate, previewContact, property, user]);

  const previewSubject = useMemo(() => {
    if (!selectedTemplate || !previewContact) return '';

    return injectVariables(selectedTemplate.subject, {
      contact: {
        full_name: previewContact.full_name,
        email: previewContact.email,
      } as Tables<'contacts'>,
      property: property as Tables<'properties'>,
      agent: user ? { full_name: (user as { user_metadata?: { full_name?: string } }).user_metadata?.full_name } : null,
    });
  }, [selectedTemplate, previewContact, property, user]);

  const handleSend = async () => {
    if (!selectedTemplateId || selectedBuyers.length === 0) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-property-proposal', {
        body: {
          propertyId: property.id,
          contactIds: selectedBuyers,
          templateId: selectedTemplateId,
          logActivity,
        },
      });

      if (error) throw error;

      const { summary, results } = data as {
        summary: { total: number; success: number; failed: number };
        results: Array<{ contactId: string; contactName: string; success: boolean; error?: string }>;
      };

      if (summary.failed === 0) {
        toast.success(`${summary.success} email${summary.success > 1 ? 's' : ''} envoyé${summary.success > 1 ? 's' : ''} avec succès`);
      } else if (summary.success > 0) {
        const failedNames = results.filter(r => !r.success).map(r => r.contactName).join(', ');
        toast.warning(
          `${summary.success} envoyé${summary.success > 1 ? 's' : ''}, ${summary.failed} échoué${summary.failed > 1 ? 's' : ''}`,
          { description: `Échecs : ${failedNames}` }
        );
      } else {
        toast.error('Aucun email envoyé', {
          description: results[0]?.error || 'Erreur inconnue',
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error('Erreur lors de l\'envoi', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposer le bien à {selectedBuyers.length} acheteur{selectedBuyers.length > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Envoyez un email personnalisé de proposition du bien "{property.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Modèle d'email</label>
            {isLoadingTemplates ? (
              <Skeleton className="h-10 w-full" />
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun modèle de type "Proposition de biens" trouvé. Créez-en un dans la section Emails.
              </p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Email preview */}
          {selectedTemplate && previewContact && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Aperçu (pour {previewContact.full_name})
              </label>
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">
                  Objet : {previewSubject}
                </p>
                <hr className="border-border" />
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {previewText}
                </p>
              </div>
            </div>
          )}

          {/* Log activity checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="log-activity"
              checked={logActivity}
              onCheckedChange={(checked) => setLogActivity(checked === true)}
            />
            <label htmlFor="log-activity" className="text-sm cursor-pointer">
              Logger automatiquement l'activité
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !selectedTemplateId || templates.length === 0}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Envoyer à {selectedBuyers.length} acheteur{selectedBuyers.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="rounded-full bg-muted/50 p-3 mb-3">
        <Target className="h-6 w-6 text-muted-foreground" />
      </div>
      <h4 className="font-medium text-sm mb-1">Aucun acquéreur correspondant</h4>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        Aucun acquéreur ne correspond à ce bien pour le moment. Ajoutez des critères de recherche aux contacts acquéreurs.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertyMatchingWidget({ property, onContactBuyer }: PropertyMatchingWidgetProps) {
  const { data: searches, isLoading, isError } = useContactSearchesWithContacts();
  const { organizationId } = useAuth();
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());

  // Fetch already contacted buyer IDs for this property
  useEffect(() => {
    if (!property?.id || !organizationId) return;

    const fetchProposals = async () => {
      const { data } = await supabase
        .from('property_proposals')
        .select('contact_id')
        .eq('property_id', property.id)
        .eq('organization_id', organizationId);

      if (data) {
        setContactedIds(new Set(data.map(p => p.contact_id).filter(Boolean) as string[]));
      }
    };

    fetchProposals();
  }, [property?.id, organizationId]);

  const toggleBuyer = useCallback((contactId: string) => {
    setSelectedBuyers(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : prev.length < 10
          ? [...prev, contactId]
          : prev
    );
  }, []);

  const handleSendSuccess = useCallback(() => {
    // Refresh contacted IDs
    if (property?.id && organizationId) {
      supabase
        .from('property_proposals')
        .select('contact_id')
        .eq('property_id', property.id)
        .eq('organization_id', organizationId)
        .then(({ data }) => {
          if (data) {
            setContactedIds(new Set(data.map(p => p.contact_id).filter(Boolean) as string[]));
          }
        });
    }
    setSelectedBuyers([]);
  }, [property?.id, organizationId]);

  const matches = useMemo(() => {
    if (!searches || !property) return [];

    const results: MatchResult[] = [];

    for (const search of searches) {
      if (search.contact?.role && !['acheteur', 'vendeur_acheteur', 'prospect'].includes(search.contact.role)) {
        continue;
      }

      const { score, details, warnings } = calculateMatchScore(property, search);

      if (score > 0) {
        results.push({
          search: search as MatchResult['search'],
          score,
          details,
          warnings,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }, [searches, property]);

  const perfectMatches = matches.filter(m => m.score >= 80);
  const goodMatches = matches.filter(m => m.score >= 50 && m.score < 80);

  const renderBuyerCard = (match: MatchResult) => (
    <BuyerCard
      key={match.search.id}
      match={match}
      property={property}
      onContact={onContactBuyer}
      selected={selectedBuyers.includes(match.search.contact.id)}
      onToggleSelect={toggleBuyer}
      alreadyContacted={contactedIds.has(match.search.contact.id)}
    />
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Smart Matching</CardTitle>
              <CardDescription className="text-xs">
                Acquéreurs correspondants
              </CardDescription>
            </div>
          </div>
          {matches.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <UserCheck className="h-3 w-3" />
              {matches.length} match{matches.length > 1 ? 'es' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mr-2" />
            Erreur de chargement
          </div>
        ) : matches.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="space-y-3 p-4 pb-16">
              {/* Perfect matches section */}
              {perfectMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-success">
                    <TrendingUp className="h-3 w-3" />
                    Excellents matchs ({perfectMatches.length})
                  </div>
                  {perfectMatches.map(renderBuyerCard)}
                </div>
              )}

              {/* Good matches section */}
              {goodMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Minus className="h-3 w-3" />
                    Matchs potentiels ({goodMatches.length})
                  </div>
                  {goodMatches.map(renderBuyerCard)}
                </div>
              )}

              {/* Other matches */}
              {matches.filter(m => m.score < 50).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <TrendingDown className="h-3 w-3" />
                    Autres ({matches.filter(m => m.score < 50).length})
                  </div>
                  {matches.filter(m => m.score < 50).map(renderBuyerCard)}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Sticky footer for bulk action */}
        <AnimatePresence>
          {selectedBuyers.length > 0 && (
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {selectedBuyers.length} sélectionné{selectedBuyers.length > 1 ? 's' : ''}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setSelectedBuyers([])}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Effacer
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowProposalDialog(true)}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Proposer à {selectedBuyers.length} acheteur{selectedBuyers.length > 1 ? 's' : ''}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {/* Bulk proposal dialog */}
      <BulkProposalDialog
        open={showProposalDialog}
        onOpenChange={setShowProposalDialog}
        selectedBuyers={selectedBuyers}
        matches={matches}
        property={property}
        onSuccess={handleSendSuccess}
      />
    </Card>
  );
}
