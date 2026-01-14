import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Check, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useOrganization, useProfile } from '@/hooks/useOrganization';
import { useOrgQuery } from '@/hooks/useOrgQuery';

interface ChecklistItemProps {
  done: boolean;
  label: string;
  action?: string;
  onAction?: () => void;
}

function ChecklistItem({ done, label, action, onAction }: ChecklistItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl transition-all",
        done 
          ? "bg-success/5 border border-success/20" 
          : "bg-background-secondary border border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
          done ? "bg-success text-success-foreground" : "bg-muted"
        )}>
          {done ? (
            <Check className="w-4 h-4" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <span className={cn(
          "text-sm font-medium",
          done && "text-muted-foreground line-through"
        )}>
          {label}
        </span>
      </div>
      {!done && action && onAction && (
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onAction}
          className="text-primary hover:text-primary hover:bg-primary/10"
        >
          {action}
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </motion.div>
  );
}

interface OnboardingProgressProps {
  onNavigate?: (path: string) => void;
  onRestartTour?: () => void;
}

export function OnboardingProgress({ onNavigate, onRestartTour }: OnboardingProgressProps) {
  const { data: organization } = useOrganization();
  const { data: profile } = useProfile();
  const { data: contacts } = useOrgQuery<any[]>('contacts', { select: 'id', orderBy: { column: 'created_at', ascending: false } });
  const { data: properties } = useOrgQuery<any[]>('properties', { select: 'id', orderBy: { column: 'created_at', ascending: false } });

  const checklistItems = useMemo(() => [
    {
      id: 'organization',
      done: !!organization?.name,
      label: 'Informations agence complétées',
      action: 'Compléter',
      path: '/settings',
    },
    {
      id: 'profile',
      done: !!profile?.full_name,
      label: 'Profil configuré',
      action: 'Configurer',
      path: '/settings',
    },
    {
      id: 'contact',
      done: (contacts?.length || 0) > 0,
      label: 'Premier contact créé',
      action: 'Créer',
      path: '/contacts',
    },
    {
      id: 'property',
      done: (properties?.length || 0) > 0,
      label: 'Premier bien ajouté',
      action: 'Ajouter',
      path: '/biens',
    },
  ], [organization, profile, contacts, properties]);

  const completedCount = checklistItems.filter(item => item.done).length;
  const progress = Math.round((completedCount / checklistItems.length) * 100);
  const isComplete = progress === 100;

  return (
    <Card className="glass border-border overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Démarrage rapide
          </CardTitle>
          {onRestartTour && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRestartTour}
              className="text-muted-foreground hover:text-foreground"
            >
              Revoir le tour
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className={cn(
              "font-medium font-mono",
              isComplete ? "text-success" : "text-foreground"
            )}>
              {progress}%
            </span>
          </div>
          <Progress 
            value={progress} 
            className={cn(
              "h-2",
              isComplete && "[&>div]:bg-success"
            )} 
          />
        </div>

        {isComplete ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-xl bg-success/10 border border-success/20 text-center"
          >
            <Check className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="font-medium text-success">Configuration terminée !</p>
            <p className="text-sm text-muted-foreground mt-1">
              Votre espace de travail est prêt à l'emploi.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {checklistItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ChecklistItem
                  done={item.done}
                  label={item.label}
                  action={item.action}
                  onAction={() => onNavigate?.(item.path)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
