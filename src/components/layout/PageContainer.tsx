import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageContainerProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
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
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Page Content */}
      {children}
    </motion.div>
  );
}
