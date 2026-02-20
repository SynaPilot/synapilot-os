import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  User, 
  Building2, 
  Home, 
  MapPin, 
  Euro, 
  Ruler, 
  Calendar, 
  Mail,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMAIL_VARIABLES, type EmailVariableKey } from '@/lib/email-templates';
import { formatCurrency } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Property = Tables<'properties'>;
type Deal = Tables<'deals'>;

interface VariableContext {
  contact?: Contact | null;
  property?: Property | null;
  deal?: Deal | null;
  agent?: { full_name?: string; email?: string } | null;
  organization?: { name?: string } | null;
}

interface VariableInjectorProps {
  context: VariableContext;
  usedVariables?: string[];
  onInsertVariable?: (variable: string) => void;
  showOnlyUsed?: boolean;
}

const ICON_MAP: Record<string, typeof User> = {
  User,
  Building2,
  Home,
  MapPin,
  Euro,
  Ruler,
  Calendar,
  Mail,
};

export function VariableInjector({ 
  context, 
  usedVariables = [], 
  onInsertVariable,
  showOnlyUsed = false
}: VariableInjectorProps) {
  // Calculate resolved values for each variable
  const resolvedValues = useMemo(() => {
    const values: Record<EmailVariableKey, { value: string | null; available: boolean }> = {} as any;

    const { contact, property, deal, agent, organization } = context;

    // Parse agent name
    const agentNames = agent?.full_name?.split(' ') || [];
    const agentPrenom = agentNames[0] || '';
    const agentNom = agentNames.slice(1).join(' ') || '';

    // Parse contact name
    const contactNames = contact?.full_name?.split(' ') || [];
    const contactPrenom = contactNames[0] || '';
    const contactNom = contactNames.slice(1).join(' ') || '';

    // Contact variables
    values['contact_prenom'] = { 
      value: contactPrenom || null, 
      available: !!contactPrenom 
    };
    values['contact_nom'] = { 
      value: contactNom || null, 
      available: !!contactNom 
    };
    values['contact_civilite'] = { 
      value: 'Madame/Monsieur', // Default
      available: true 
    };
    values['contact_email'] = { 
      value: contact?.email || null, 
      available: !!contact?.email 
    };

    // Agent variables
    values['agent_prenom'] = { 
      value: agentPrenom || null, 
      available: !!agentPrenom 
    };
    values['agent_nom'] = { 
      value: agentNom || null, 
      available: !!agentNom 
    };

    // Organization
    values['agence_nom'] = { 
      value: organization?.name || null, 
      available: !!organization?.name 
    };

    // Property variables
    values['bien_type'] = { 
      value: property?.type || null, 
      available: !!property?.type 
    };
    values['bien_adresse'] = { 
      value: property?.address || null, 
      available: !!property?.address 
    };
    values['bien_ville'] = { 
      value: property?.city || null, 
      available: !!property?.city 
    };
    values['bien_prix'] = { 
      value: property?.price ? formatCurrency(Number(property.price)) : null, 
      available: !!property?.price 
    };
    values['bien_surface'] = { 
      value: property?.surface ? `${property.surface} m²` : null, 
      available: !!property?.surface 
    };

    // Deal variables
    values['deal_montant'] = { 
      value: deal?.amount ? formatCurrency(Number(deal.amount)) : null, 
      available: !!deal?.amount 
    };

    // Activity variables
    values['date_rdv'] = { 
      value: null, // Would need activity context
      available: false 
    };

    return values;
  }, [context]);

  // Filter variables to show
  const displayVariables = useMemo(() => {
    if (showOnlyUsed && usedVariables.length > 0) {
      return EMAIL_VARIABLES.filter(v => 
        usedVariables.some(used => used.includes(v.key))
      );
    }
    return EMAIL_VARIABLES;
  }, [showOnlyUsed, usedVariables]);

  // Group by source
  const groupedVariables = useMemo(() => {
    const groups: Record<string, Array<typeof EMAIL_VARIABLES[number]>> = {};
    displayVariables.forEach(v => {
      if (!groups[v.source]) groups[v.source] = [];
      groups[v.source].push(v);
    });
    return groups;
  }, [displayVariables]);

  const sourceLabels: Record<string, string> = {
    contact: 'Contact',
    agent: 'Agent',
    organization: 'Agence',
    property: 'Bien',
    deal: 'Deal',
    activity: 'Activité',
  };

  // Check for missing required variables
  const missingVariables = usedVariables.filter(v => {
    const key = v.replace(/[{}]/g, '') as EmailVariableKey;
    return resolvedValues[key] && !resolvedValues[key].available;
  });

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Variables disponibles</span>
          {missingVariables.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {missingVariables.length} manquante{missingVariables.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedVariables).map(([source, variables]) => (
          <div key={source}>
            <p className="text-xs text-muted-foreground mb-2">
              {sourceLabels[source] || source}
            </p>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => {
                const resolved = resolvedValues[variable.key as EmailVariableKey];
                const isUsed = usedVariables.some(v => v.includes(variable.key));
                const IconComponent = ICON_MAP[variable.icon] || User;

                return (
                  <Tooltip key={variable.key}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "cursor-pointer transition-all text-xs",
                          resolved?.available
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20"
                            : "bg-muted/30 text-muted-foreground border-muted/50",
                          isUsed && "ring-2 ring-purple-500/30"
                        )}
                        onClick={() => onInsertVariable?.(`{${variable.key}}`)}
                      >
                        <IconComponent className="w-3 h-3 mr-1" />
                        {`{${variable.key}}`}
                        {resolved?.available ? (
                          <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3 ml-1 text-orange-400" />
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <p className="font-medium">{variable.label}</p>
                        {resolved?.available ? (
                          <p className="text-green-400">
                            → {resolved.value}
                          </p>
                        ) : (
                          <p className="text-orange-400">
                            Non disponible (données manquantes)
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}

        {onInsertVariable && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Cliquez sur une variable pour l'insérer
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to inject variables into text
export function injectVariables(
  text: string, 
  context: VariableContext
): string {
  const { contact, property, deal, agent, organization } = context;

  // Parse names
  const agentNames = agent?.full_name?.split(' ') || [];
  const agentPrenom = agentNames[0] || 'Votre conseiller';
  const agentNom = agentNames.slice(1).join(' ') || '';

  const contactNames = contact?.full_name?.split(' ') || [];
  const contactPrenom = contactNames[0] || 'Client';
  const contactNom = contactNames.slice(1).join(' ') || '';

  const replacements: Record<string, string> = {
    '{contact_prenom}': contactPrenom,
    '{contact_nom}': contactNom,
    '{contact_civilite}': 'Madame/Monsieur',
    '{contact_email}': contact?.email || '[email]',
    '{agent_prenom}': agentPrenom,
    '{agent_nom}': agentNom,
    '{agence_nom}': organization?.name || '[Agence]',
    '{bien_type}': property?.type || '[type de bien]',
    '{bien_adresse}': property?.address || '[adresse]',
    '{bien_ville}': property?.city || '[ville]',
    '{bien_prix}': property?.price ? formatCurrency(Number(property.price)) : '[prix]',
    '{bien_surface}': property?.surface ? `${property.surface} m²` : '[surface]',
    '{deal_montant}': deal?.amount ? formatCurrency(Number(deal.amount)) : '[montant]',
    '{date_rdv}': '[date du RDV]',
  };

  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}
