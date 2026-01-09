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
        <Card ref={ref} className={className}>
          {children}
        </Card>
      );
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-lg border bg-card text-card-foreground shadow-sm',
          'glass cursor-pointer',
          className
        )}
        whileHover={{ 
          scale: 1.02, 
          borderColor: 'rgba(255, 255, 255, 0.2)',
          transition: { duration: 0.15 }
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
