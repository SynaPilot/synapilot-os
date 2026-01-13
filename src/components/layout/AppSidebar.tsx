import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Home,
  TrendingUp,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Building2,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contacts', href: '/leads', icon: Users },
  { name: 'Biens', href: '/properties', icon: Home },
  { name: 'Pipeline', href: '/deals', icon: TrendingUp },
  { name: 'Activités', href: '/activities', icon: CheckSquare },
  { name: 'Statistiques', href: '/stats', icon: BarChart3 },
  { name: 'Paramètres', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="p-5 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:shadow-glow-sm transition-all duration-300">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-gradient">SynaPilot</h1>
            <p className="text-caption text-muted-foreground">Agency OS</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ease-premium',
                          isActive
                            ? 'bg-primary/10 text-primary border border-primary/20 shadow-glow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background-hover'
                        )}
                      >
                        <item.icon className={cn('w-5 h-5 stroke-2', isActive && 'text-primary')} />
                        <span className="font-medium text-sm">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-error hover:bg-error/10 rounded-xl"
          onClick={() => signOut()}
        >
          <LogOut className="w-5 h-5 stroke-2" />
          <span className="text-sm">Déconnexion</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
