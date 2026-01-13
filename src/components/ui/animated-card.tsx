import { motion, HTMLMotionProps } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  clickable?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ clickable = false, className, children, ...props }, ref) => {
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
          'cursor-pointer transition-all duration-300 ease-premium',
          className
        )}
        whileHover={{ 
          scale: 1.02, 
          y: -2,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(20, 184, 166, 0.15)',
          transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
        }}
        whileTap={{ 
          scale: 0.98,
          transition: { duration: 0.1 }
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';
