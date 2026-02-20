import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Menu,
  Plus,
  UserPlus,
  BadgeEuro,
  Home,
  CalendarPlus,
  CheckSquare,
  Mail,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const mainNavItems = [
  { name: 'Cockpit', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contacts', href: '/leads', icon: Users },
  { name: 'Action', href: '#action', icon: Plus, isAction: true },
  { name: 'Pipeline', href: '/deals', icon: TrendingUp },
  { name: 'Menu', href: '#menu', icon: Menu, isMenu: true },
];

const quickActions = [
  { name: 'Nouveau Contact', icon: UserPlus, href: '/leads', action: 'contact' },
  { name: 'Nouveau Deal', icon: BadgeEuro, href: '/deals', action: 'deal' },
  { name: 'Nouveau Bien', icon: Home, href: '/properties', action: 'property' },
  { name: 'Nouvelle Tâche', icon: CalendarPlus, href: '/activities', action: 'activity' },
];

const menuItems = [
  { name: 'Biens', href: '/properties', icon: Home },
  { name: 'Activités', href: '/activities', icon: CheckSquare },
  { name: 'Emails IA', href: '/emails-ia', icon: Mail },
  { name: 'Statistiques', href: '/stats', icon: BarChart3 },
  { name: 'Paramètres', href: '/settings', icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href);
  };

  const handleNavClick = (item: typeof mainNavItems[0]) => {
    if (item.isAction) {
      setActionDrawerOpen(true);
    } else if (item.isMenu) {
      setMenuDrawerOpen(true);
    } else {
      navigate(item.href);
    }
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    setActionDrawerOpen(false);
    // Navigate to the page - the page will handle opening the creation dialog
    navigate(action.href, { state: { openCreate: action.action } });
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden">
        <div className="w-full bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe">
          <div className="flex items-center justify-around h-16 px-2">
            {mainNavItems.map((item) => {
              const active = !item.isAction && !item.isMenu && isActive(item.href);
              const isCenter = item.isAction;

              if (isCenter) {
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavClick(item)}
                    className="relative -mt-4 flex items-center justify-center"
                  >
                    <motion.div
                      whileTap={{ scale: 0.95 }}
                      className="w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center"
                    >
                      <Plus className="w-7 h-7 text-primary-foreground stroke-[2.5]" />
                    </motion.div>
                  </button>
                );
              }

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[44px] rounded-xl transition-all duration-200',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="relative">
                    <item.icon className={cn('w-6 h-6', active && 'drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]')} />
                    {active && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Quick Action Drawer */}
      <Drawer open={actionDrawerOpen} onOpenChange={setActionDrawerOpen}>
        <DrawerContent className="bg-background/95 backdrop-blur-xl border-t border-border/50">
          <DrawerHeader className="flex items-center justify-between pb-2">
            <DrawerTitle className="text-lg font-display font-semibold">
              Création rapide
            </DrawerTitle>
            <DrawerClose asChild>
              <button className="p-2 rounded-full hover:bg-muted/50 transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </DrawerClose>
          </DrawerHeader>
          <div className="grid grid-cols-2 gap-3 p-4 pt-2">
            <AnimatePresence>
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleQuickAction(action)}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 border border-border/50 transition-all duration-200 active:scale-95"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <action.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {action.name}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          <div className="h-4" />
        </DrawerContent>
      </Drawer>

      {/* Menu Drawer */}
      <Drawer open={menuDrawerOpen} onOpenChange={setMenuDrawerOpen}>
        <DrawerContent className="bg-background/95 backdrop-blur-xl border-t border-border/50">
          <DrawerHeader className="flex items-center justify-between pb-2">
            <DrawerTitle className="text-lg font-display font-semibold">
              Menu
            </DrawerTitle>
            <DrawerClose asChild>
              <button className="p-2 rounded-full hover:bg-muted/50 transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex flex-col gap-1 p-4 pt-2">
            <AnimatePresence>
              {menuItems.map((item, index) => {
                const active = isActive(item.href);
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={item.href}
                      onClick={() => setMenuDrawerOpen(false)}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200',
                        active
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'hover:bg-muted/50 text-foreground'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          <div className="h-4" />
        </DrawerContent>
      </Drawer>
    </>
  );
}
