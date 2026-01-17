import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  iconBgClass?: string;
}

function FeatureCard({ icon, title, desc, iconBgClass = 'bg-purple-500/20' }: FeatureCardProps) {
  return (
    <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
      <CardContent className="p-6 text-center">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3", iconBgClass)}>
          {icon}
        </div>
        <h4 className="font-medium text-white mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  iconGradient?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  features?: Array<{
    icon: React.ReactNode;
    title: string;
    desc: string;
    iconBgClass?: string;
  }>;
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  iconGradient = 'from-purple-500/20 to-blue-500/20',
  title, 
  description, 
  action,
  secondaryAction,
  features,
  className
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[60vh] px-4", className)}>
      {/* Icon principale with glow effect */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 200,
          damping: 20,
          delay: 0.1
        }}
        className="relative"
      >
        {/* Glow background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-20 blur-3xl rounded-full" />
        
        <div className={cn(
          "relative p-8 rounded-full backdrop-blur-sm border border-white/10",
          `bg-gradient-to-br ${iconGradient}`
        )}>
          <Icon className="w-16 h-16 text-blue-400" strokeWidth={1.5} />
        </div>
      </motion.div>
      
      {/* Titre */}
      <motion.h3 
        className="text-2xl font-semibold text-white mt-8 mb-3 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {title}
      </motion.h3>
      
      {/* Description */}
      <motion.p 
        className="text-muted-foreground text-center max-w-md mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        {description}
      </motion.p>

      {/* Boutons CTA */}
      {(action || secondaryAction) && (
        <motion.div 
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          {action && (
            <Button 
              size="lg" 
              onClick={action.onClick} 
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/30 gap-2"
            >
              {action.icon}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={secondaryAction.onClick} 
              className="border-white/20 gap-2"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )}
        </motion.div>
      )}

      {/* Cards suggestions en bas */}
      {features && features.length > 0 && (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 w-full max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
