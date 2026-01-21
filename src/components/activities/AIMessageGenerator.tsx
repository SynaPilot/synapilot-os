import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, 
  Loader2, 
  Check, 
  RefreshCw, 
  AlertCircle,
  Briefcase,
  Heart,
  Zap
} from 'lucide-react';

interface AIVariation {
  tone: 'professional' | 'warm' | 'direct';
  text: string;
}

interface AIMessageGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  propertyId: string | null;
  activityType: string;
  onSelectMessage: (message: string) => void;
}

export function AIMessageGenerator({
  open,
  onOpenChange,
  contactId,
  propertyId,
  activityType,
  onSelectMessage,
}: AIMessageGeneratorProps) {
  const { organizationId, user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiVariations, setAiVariations] = useState<AIVariation[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerateAI = async () => {
    if (!contactId) {
      toast.error("Sélectionnez d'abord un contact");
      return;
    }

    if (!organizationId) {
      toast.error("Organisation non trouvée");
      return;
    }

    setIsGenerating(true);
    setAiVariations([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            organization_id: organizationId,
            contact_id: contactId,
            property_id: propertyId || null,
            activity_type: activityType,
            additional_context: additionalContext.trim() || null,
            user_name: user?.user_metadata?.full_name || 'Votre Conseiller'
          })
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erreur génération IA');
      }

      const { variations, usage } = await res.json();

      setAiVariations(variations || []);
      setHasGenerated(true);

      const totalTokens = usage?.total_tokens || 0;
      toast.success(`3 variations générées (${totalTokens} tokens)`);

    } catch (err) {
      console.error('Generation error:', err);
      toast.error(err instanceof Error ? err.message : "Erreur lors de la génération IA");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectVariation = (text: string) => {
    onSelectMessage(text);
    onOpenChange(false);
    toast.success("Message IA inséré ✨");
  };

  const handleRegenerateAI = () => {
    setAiVariations([]);
    handleGenerateAI();
  };

  const handleClose = () => {
    onOpenChange(false);
    setAiVariations([]);
    setAdditionalContext('');
    setHasGenerated(false);
  };

  const getToneIcon = (tone: string) => {
    switch (tone) {
      case 'professional':
        return <Briefcase className="w-4 h-4" />;
      case 'warm':
        return <Heart className="w-4 h-4" />;
      case 'direct':
        return <Zap className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getToneLabel = (tone: string) => {
    switch (tone) {
      case 'professional':
        return '👔 Professionnel';
      case 'warm':
        return '😊 Chaleureux';
      case 'direct':
        return '⚡ Direct';
      default:
        return tone;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Génération IA de message
          </DialogTitle>
          <DialogDescription>
            DeepSeek génère 3 variations de relance contextuelles pour vous
          </DialogDescription>
        </DialogHeader>

        {/* Additional context input */}
        <div className="space-y-2 bg-white/5 p-4 rounded-lg border border-white/10">
          <label className="text-sm font-medium text-white">
            Contexte additionnel (optionnel)
          </label>
          <Textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Ex: Le client a mentionné vouloir un jardin, budget flexible, urgent..."
            rows={2}
            className="resize-none text-sm bg-white/5 border-white/10"
          />
          <p className="text-xs text-muted-foreground">
            Ajoutez des détails spécifiques pour personnaliser les messages
          </p>
        </div>

        {/* Loading state */}
        {isGenerating && (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400" />
            <p className="text-sm text-muted-foreground mt-4">
              Génération en cours avec DeepSeek...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Analyse du contexte et création de 3 variations
            </p>
          </div>
        )}

        {/* Variations display */}
        {!isGenerating && aiVariations.length > 0 && (
          <div className="space-y-3">
            {aiVariations.map((variation, idx) => (
              <Card
                key={idx}
                className="bg-white/5 border-white/10 p-4 hover:border-purple-500/50 transition cursor-pointer group relative"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20"
                    >
                      {getToneIcon(variation.tone)}
                      <span className="ml-1">{getToneLabel(variation.tone)}</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ~{variation.text.split(' ').length} mots
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSelectVariation(variation.text)}
                    className="opacity-0 group-hover:opacity-100 transition bg-purple-500 hover:bg-purple-600"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Utiliser
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-white/90">
                  {variation.text}
                </p>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state after failed generation */}
        {!isGenerating && hasGenerated && aiVariations.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Aucune variation générée</p>
            <p className="text-xs mt-1">Vérifiez votre connexion et réessayez</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Annuler
          </Button>
          {aiVariations.length > 0 && (
            <Button
              onClick={handleRegenerateAI}
              variant="outline"
              className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Régénérer
            </Button>
          )}
          {!isGenerating && aiVariations.length === 0 && (
            <Button
              onClick={handleGenerateAI}
              disabled={!contactId}
              className="bg-purple-500 hover:bg-purple-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Générer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
