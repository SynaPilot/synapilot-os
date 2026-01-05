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
  { name: 'Cockpit', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Biens', href: '/properties', icon: Home },
  { name: 'Deals', href: '/deals', icon: TrendingUp },
  { name: 'Activités', href: '/activities', icon: CheckSquare },
  { name: 'Statistiques', href: '/stats', icon: BarChart3 },
  { name: 'Réglages', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground">SynaPilot</h1>
            <p className="text-xs text-muted-foreground">Agency OS</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                          isActive
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        <item.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                        <span className="font-medium">{item.name}</span>
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
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
