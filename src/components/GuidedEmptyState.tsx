import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  Users, 
  TrendingUp, 
  Home, 
  Calendar, 
  Rocket, 
  ArrowRight, 
  Eye,
  Phone,
  Mail,
  MapPin,
  Square,
  Bed,
  Building2,
  User,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

// ==================== TYPES ====================
export type EmptyStateVariant = 'contacts' | 'deals' | 'properties' | 'activities' | 'dashboard';

interface GuidedEmptyStateProps {
  variant: EmptyStateVariant;
  onPrimaryAction: () => void;
  onDemoClick?: () => void;
}

// ==================== VARIANT CONFIGS ====================
interface VariantConfig {
  icon: React.ElementType;
  iconGradient: string;
  title: string;
  description: string;
  ctaLabel: string;
  demoTitle: string;
  demoDescription: string;
}

const VARIANT_CONFIGS: Record<EmptyStateVariant, VariantConfig> = {
  contacts: {
    icon: Users,
    iconGradient: 'from-blue-500/20 to-purple-500/20',
    title: "Votre carnet d'adresses est vide",
    description: "Ajoutez vos premiers contacts pour commencer à gérer vos relations clients et prospects.",
    ctaLabel: "Ajouter mon premier contact",
    demoTitle: "Aperçu d'un contact",
    demoDescription: "Voici à quoi ressemblera votre fiche contact une fois créée.",
  },
  deals: {
    icon: TrendingUp,
    iconGradient: 'from-purple-500/20 to-blue-500/20',
    title: "Aucune opportunité en cours",
    description: "Créez votre premier deal pour suivre une vente de bout en bout avec probabilités et commissions.",
    ctaLabel: "Créer mon premier deal",
    demoTitle: "Aperçu d'une opportunité",
    demoDescription: "Voici comment vous suivrez vos ventes dans le pipeline.",
  },
  properties: {
    icon: Home,
    iconGradient: 'from-blue-500/20 to-purple-500/20',
    title: "Pas encore de biens à vendre",
    description: "Ajoutez vos mandats pour les gérer et trouver des acheteurs qualifiés.",
    ctaLabel: "Ajouter un bien",
    demoTitle: "Aperçu d'un bien",
    demoDescription: "Voici comment vos biens apparaîtront dans votre portefeuille.",
  },
  activities: {
    icon: Calendar,
    iconGradient: 'from-purple-500/20 to-blue-500/20',
    title: "Votre planning est libre",
    description: "Planifiez vos appels et visites pour organiser votre semaine efficacement.",
    ctaLabel: "Planifier une activité",
    demoTitle: "Aperçu d'une activité",
    demoDescription: "Voici comment vous organiserez vos tâches et rendez-vous.",
  },
  dashboard: {
    icon: Rocket,
    iconGradient: 'from-blue-500/20 to-purple-500/20',
    title: "Bienvenue sur SynaPilot !",
    description: "Commençons par créer votre premier contact pour démarrer votre CRM intelligent.",
    ctaLabel: "Démarrer (3 min)",
    demoTitle: "Votre parcours de démarrage",
    demoDescription: "3 étapes simples pour être opérationnel.",
  },
};

// ==================== DEMO CONTENT COMPONENTS ====================
function ContactDemo() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <span className="text-lg font-semibold text-white">JD</span>
          </div>
          <div>
            <p className="font-semibold text-white">Jean Dupont</p>
            <p className="text-sm text-muted-foreground">Acheteur potentiel</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4 text-blue-400" />
            <span className="font-mono">06 12 34 56 78</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-4 h-4 text-purple-400" />
            <span>jean.dupont@email.com</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Acheteur</Badge>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Score: 8/10</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DealDemo() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4 space-y-3">
        <p className="font-semibold text-white">Appartement Paris 15ème</p>
        <p className="text-2xl font-bold text-primary">450 000 €</p>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-mono">Commission: 22 500 €</span>
          <span className="text-blue-400">75%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 w-3/4" />
        </div>
        <div className="flex gap-2">
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Négociation</Badge>
          <Badge variant="outline" className="border-white/20">Clôture: 15 fév</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyDemo() {
  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <div className="h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
        <Home className="w-10 h-10 text-blue-400/60" />
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex gap-2">
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Disponible</Badge>
          <Badge variant="outline" className="border-purple-500/30 text-purple-400">Appartement</Badge>
        </div>
        <p className="font-semibold text-white">3 pièces lumineux avec balcon</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          12 Rue de Rivoli, Paris 4ème
        </p>
        <p className="text-xl font-bold text-blue-400">320 000 €</p>
        <div className="flex gap-4 text-xs text-muted-foreground font-mono">
          <span className="flex items-center gap-1"><Square className="w-3 h-3" />65 m²</span>
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />3p</span>
          <span className="flex items-center gap-1"><Bed className="w-3 h-3" />2ch</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityDemo() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Phone className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Appel de qualification</p>
            <p className="text-sm text-muted-foreground">Discuter du budget et des critères</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Haute priorité</Badge>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Planifié</Badge>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><User className="w-3 h-3" />Jean Dupont</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Aujourd'hui, 14h30</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardDemo() {
  const steps = [
    { num: 1, label: 'Contact', done: false, icon: Users },
    { num: 2, label: 'Bien', done: false, icon: Home },
    { num: 3, label: 'Deal', done: false, icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      <Progress value={0} className="h-2" />
      <div className="grid grid-cols-3 gap-3">
        {steps.map((step) => (
          <Card key={step.num} className="bg-white/5 border-white/10">
            <CardContent className="p-4 text-center">
              <div className={cn(
                "w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center",
                step.done ? "bg-blue-500/20" : "bg-white/10"
              )}>
                {step.done ? (
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                ) : (
                  <step.icon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs font-medium">{step.num}. {step.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-center text-muted-foreground">
        <Sparkles className="w-4 h-4 inline mr-1 text-purple-400" />
        En 3 minutes, votre CRM sera prêt !
      </p>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export function GuidedEmptyState({ variant, onPrimaryAction, onDemoClick }: GuidedEmptyStateProps) {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const config = VARIANT_CONFIGS[variant];
  const Icon = config.icon;

  const handleDemoClick = () => {
    if (onDemoClick) {
      onDemoClick();
    } else {
      setIsDemoOpen(true);
    }
  };

  const getDemoContent = () => {
    switch (variant) {
      case 'contacts': return <ContactDemo />;
      case 'deals': return <DealDemo />;
      case 'properties': return <PropertyDemo />;
      case 'activities': return <ActivityDemo />;
      case 'dashboard': return <DashboardDemo />;
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        {/* Animated Icon with Glow */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          className="relative"
        >
          {/* Glow background */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-20 blur-3xl rounded-full"
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <motion.div
            className={cn(
              "relative p-8 rounded-full backdrop-blur-sm border border-white/10",
              `bg-gradient-to-br ${config.iconGradient}`
            )}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon className="w-16 h-16 text-blue-400" strokeWidth={1.5} />
          </motion.div>
        </motion.div>
        
        {/* Title */}
        <motion.h3 
          className="text-2xl font-semibold text-white mt-8 mb-3 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {config.title}
        </motion.h3>
        
        {/* Description */}
        <motion.p 
          className="text-muted-foreground text-center max-w-md mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          {config.description}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div 
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Button 
            size="lg" 
            onClick={onPrimaryAction}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/30 gap-2 transition-transform hover:scale-[1.02]"
          >
            {config.ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="lg" 
            onClick={handleDemoClick}
            className="border-white/20 gap-2 transition-transform hover:scale-[1.02]"
          >
            <Eye className="w-4 h-4" />
            Voir un exemple
          </Button>
        </motion.div>
      </div>

      {/* Demo Modal */}
      <Dialog open={isDemoOpen} onOpenChange={setIsDemoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-purple-400" />
              {config.demoTitle}
            </DialogTitle>
            <DialogDescription>
              {config.demoDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {getDemoContent()}
          </div>

          <Button 
            onClick={() => {
              setIsDemoOpen(false);
              onPrimaryAction();
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            Créer maintenant
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
