import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X,
  TrendingDown,
  Mail,
  UserPlus,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Local type definitions
interface Contact {
  id: string;
  full_name: string;
  created_at: string;
}

interface Deal {
  id: string;
  name: string;
  updated_at: string | null;
  stage: string | null;
}

interface Activity {
  id: string;
  type: string;
  content: string | null;
  date: string | null;
  status: string | null;
  created_at: string;
}

type NotificationType = 'warning' | 'success' | 'info' | 'error';

interface SmartNotification {
  id: string;
  type: NotificationType;
  icon: React.ReactNode;
  message: string;
  description?: string;
  time: string;
  route?: string;
}

function NotificationItem({ 
  notification, 
  onClick,
  onDismiss 
}: { 
  notification: SmartNotification;
  onClick?: () => void;
  onDismiss?: () => void;
}) {
  const typeStyles: Record<NotificationType, string> = {
    warning: 'bg-warning/10 border-warning/20',
    success: 'bg-success/10 border-success/20',
    info: 'bg-info/10 border-info/20',
    error: 'bg-error/10 border-error/20',
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className={cn(
        'p-3 rounded-xl border transition-all duration-200 cursor-pointer group relative',
        typeStyles[notification.type],
        'hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {notification.icon}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="font-medium text-sm leading-tight">{notification.message}</p>
          {notification.description && (
            <p className="text-caption text-muted-foreground mt-0.5 line-clamp-1">
              {notification.description}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {notification.time}
          </p>
        </div>
      </div>
      {onDismiss && (
        <button
          className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-background/50 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </motion.div>
  );
}

export function SmartNotifications() {
  const navigate = useNavigate();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch data for generating smart notifications
  const { data: contacts } = useOrgQuery<Contact[]>('contacts', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false },
    limit: 20
  });
  
  const { data: deals } = useOrgQuery<Deal[]>('deals', {
    select: '*',
    orderBy: { column: 'updated_at', ascending: true },
    limit: 20
  });
  
  const { data: activities } = useOrgQuery<Activity[]>('activities', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false },
    limit: 10
  });
  
  // Generate smart notifications
  const notifications = useMemo(() => {
    const result: SmartNotification[] = [];
    
    // New contacts (last 24h)
    const newContacts = contacts?.filter(c => {
      const hoursSince = differenceInHours(new Date(), new Date(c.created_at));
      return hoursSince <= 24;
    }) || [];
    
    if (newContacts.length > 0) {
      result.push({
        id: 'new-contacts',
        type: 'info',
        icon: <UserPlus className="w-4 h-4 text-info" />,
        message: `${newContacts.length} nouveau${newContacts.length > 1 ? 'x' : ''} contact${newContacts.length > 1 ? 's' : ''} capturé${newContacts.length > 1 ? 's' : ''}`,
        description: newContacts[0]?.full_name,
        time: formatDistanceToNow(new Date(newContacts[0].created_at), { addSuffix: true, locale: fr }),
        route: '/contacts'
      });
    }
    
    // Stagnant deals (warning)
    const stagnantDeals = deals?.filter(d => {
      if (!d.updated_at) return false;
      const daysSince = differenceInDays(new Date(), new Date(d.updated_at));
      return daysSince >= 10 && d.stage !== 'vendu' && d.stage !== 'perdu';
    }) || [];
    
    stagnantDeals.slice(0, 2).forEach(deal => {
      const daysSince = differenceInDays(new Date(), new Date(deal.updated_at!));
      result.push({
        id: `stagnant-${deal.id}`,
        type: 'warning',
        icon: <TrendingDown className="w-4 h-4 text-warning" />,
        message: `Deal "${deal.name}" inactif`,
        description: `Aucune mise à jour depuis ${daysSince} jours`,
        time: formatDistanceToNow(new Date(deal.updated_at!), { addSuffix: true, locale: fr }),
        route: '/deals'
      });
    });
    
    // Completed activities (success)
    const completedActivities = activities?.filter(a => a.status === 'Terminé').slice(0, 1) || [];
    
    completedActivities.forEach(activity => {
      result.push({
        id: `completed-${activity.id}`,
        type: 'success',
        icon: <CheckCircle className="w-4 h-4 text-success" />,
        message: activity.type || 'Activité complétée',
        description: activity.content || undefined,
        time: formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: fr }),
        route: '/activities'
      });
    });
    
    // Overdue activities (error)
    const today = new Date().toISOString().split('T')[0];
    const overdueActivities = activities?.filter(a => 
      a.date && a.date < today && a.status !== 'Terminé'
    ) || [];
    
    if (overdueActivities.length > 0) {
      result.push({
        id: 'overdue-activities',
        type: 'error',
        icon: <AlertTriangle className="w-4 h-4 text-error" />,
        message: `${overdueActivities.length} activité${overdueActivities.length > 1 ? 's' : ''} en retard`,
        description: 'À traiter en priorité',
        time: 'Urgent',
        route: '/activities'
      });
    }
    
    // Filter out dismissed notifications
    return result.filter(n => !dismissedIds.has(n.id)).slice(0, 6);
  }, [contacts, deals, activities, dismissedIds]);
  
  const unreadCount = notifications.length;
  
  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };
  
  const handleClick = (notification: SmartNotification) => {
    if (notification.route) {
      navigate(notification.route);
      setIsOpen(false);
    }
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          <Bell className="w-5 h-5 text-muted-foreground stroke-2" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-error text-error-foreground rounded-full text-[10px] font-semibold flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0 bg-background-secondary border border-border shadow-modal rounded-xl" 
        align="end"
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-semibold flex items-center gap-2">
              Notifications
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                IA
              </Badge>
            </h4>
            <Badge variant="secondary" className="rounded-lg">{unreadCount}</Badge>
          </div>
        </div>
        
        <div className="p-2 max-h-[400px] overflow-y-auto space-y-2">
          <AnimatePresence mode="popLayout">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleClick(notification)}
                  onDismiss={() => handleDismiss(notification.id)}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10 text-muted-foreground"
              >
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucune notification</p>
                <p className="text-xs mt-1">Tout est à jour ! 🎉</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {notifications.length > 0 && (
          <div className="p-3 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-muted-foreground"
              onClick={() => setDismissedIds(new Set(notifications.map(n => n.id)))}
            >
              Tout marquer comme lu
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
