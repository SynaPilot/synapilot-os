import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

function FeatureCard({ icon, title, desc }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center p-4 rounded-xl bg-background-secondary/50 border border-border hover:border-primary/30 transition-all group"
    >
      <div className="p-2 rounded-lg bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-caption text-muted-foreground text-center">{desc}</p>
    </motion.div>
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
  }>;
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  iconGradient = 'from-primary/20 to-purple-500/20',
  title, 
  description, 
  action,
  secondaryAction,
  features,
  className
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[60vh] px-4", className)}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 200,
          damping: 20,
          delay: 0.1
        }}
      >
        <div className={cn(
          "w-32 h-32 rounded-full flex items-center justify-center mb-6",
          `bg-gradient-to-br ${iconGradient}`
        )}>
          <Icon className="w-16 h-16 text-primary" strokeWidth={1.5} />
        </div>
      </motion.div>
      
      <motion.h3 
        className="text-h2 font-display font-semibold mb-2 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {title}
      </motion.h3>
      
      <motion.p 
        className="text-body text-muted-foreground text-center max-w-md mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        {description}
      </motion.p>

      {(action || secondaryAction) && (
        <motion.div 
          className="flex flex-col sm:flex-row gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          {action && (
            <Button size="lg" onClick={action.onClick} className="gap-2">
              {action.icon}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" size="lg" onClick={secondaryAction.onClick} className="gap-2">
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )}
        </motion.div>
      )}

      {features && features.length > 0 && (
        <motion.div 
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full"
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
