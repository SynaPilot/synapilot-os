import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageContainerProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

// Stagger container for lists
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

// Stagger item for list children
export const staggerItem = {
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
};

// Fade up variant for cards
export const fadeUpVariant = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

// Scale variant for hover effects
export const scaleOnHover = {
  hover: { 
    scale: 1.02, 
    y: -4,
    transition: { type: "spring", stiffness: 400, damping: 17 }
  },
  tap: { scale: 0.98 }
};

// Card hover with glow
export const cardHoverGlow = {
  rest: { 
    scale: 1,
    y: 0,
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)"
  },
  hover: { 
    scale: 1.02, 
    y: -4,
    boxShadow: "0 8px 32px rgba(20, 184, 166, 0.15)",
    transition: { type: "spring", stiffness: 400, damping: 17 }
  }
};

export function PageContainer({ 
  title, 
  description, 
  action,
  children 
}: PageContainerProps) {
  return (
    <motion.div
      className="space-y-6 w-full max-w-full"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Page Header */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div>
          <h1 className="font-display text-h1">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {action}
          </motion.div>
        )}
      </motion.div>

      {/* Page Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
