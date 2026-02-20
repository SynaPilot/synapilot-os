import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  clickable?: boolean;
  children: React.ReactNode;
  className?: string;
  hoverGlow?: boolean;
}

const hoverGlowVariants: Variants = {
  rest: { 
    scale: 1,
    y: 0,
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)"
  },
  hover: { 
    scale: 1.02, 
    y: -4,
    boxShadow: "0 12px 40px rgba(20, 184, 166, 0.2)",
    transition: { 
      type: "spring", 
      stiffness: 400, 
      damping: 17 
    }
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 }
  }
};

const simpleHoverVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { 
    scale: 1.02,
    y: -2,
    transition: { 
      type: "spring", 
      stiffness: 400, 
      damping: 17 
    }
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 }
  }
};

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ clickable = false, hoverGlow = false, className, children, ...props }, ref) => {
    if (!clickable) {
      return (
        <Card ref={ref} className={cn("card-hover", className)}>
          {children}
        </Card>
      );
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-2xl border border-border bg-card text-card-foreground shadow-card',
          'cursor-pointer',
          className
        )}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        variants={hoverGlow ? hoverGlowVariants : simpleHoverVariants}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';

// Reusable animation components
export const MotionCard = motion(Card);

// Fade in animation wrapper
interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  children: React.ReactNode;
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ delay = 0, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay,
        ease: [0.4, 0, 0.2, 1]
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
FadeIn.displayName = 'FadeIn';

// Scale in animation wrapper
export const ScaleIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ delay = 0, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.3, 
        delay,
        ease: [0.4, 0, 0.2, 1]
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
ScaleIn.displayName = 'ScaleIn';

// Stagger container for lists
interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  staggerDelay?: number;
}

export const StaggerContainer = forwardRef<HTMLDivElement, StaggerContainerProps>(
  ({ staggerDelay = 0.08, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1
          }
        }
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
StaggerContainer.displayName = 'StaggerContainer';

// Stagger item
export const StaggerItem = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ children, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={{
        hidden: { opacity: 0, x: -20 },
        show: { 
          opacity: 1, 
          x: 0,
          transition: {
            type: "spring",
            stiffness: 300,
            damping: 24
          }
        }
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
StaggerItem.displayName = 'StaggerItem';
