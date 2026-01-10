import { useState } from 'react';
import { Search, Bell, User, Mail, Phone, Calendar, FileText, DollarSign, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { formatRelativeTime, formatCurrency } from '@/lib/formatters';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type ActivityType = 'email' | 'phone' | 'meeting' | 'note' | 'visit' | 'other';

interface Notification {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  created_at: string;
  contact: { name: string } | null;
}

interface SearchResults {
  contacts: Array<{ id: string; full_name: string; email: string | null; phone: string | null }>;
  deals: Array<{ id: string; name: string; amount: number | null; stage: string }>;
  properties: Array<{ id: string; address: string | null; price: number | null }>;
}

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { data: notifications } = useOrgQuery<Notification[]>(
    'activities',
    {
      select: `
        id,
        type,
        title,
        description,
        created_at,
        contact:contacts(name)
      `,
      orderBy: { column: 'created_at', ascending: false },
      limit: 5
    }
  );

  const { data: searchData } = useQuery({
    queryKey: ['global-search', searchQuery],
    queryFn: async (): Promise<SearchResults> => {
      if (!searchQuery || searchQuery.length < 2) {
        return { contacts: [], deals: [], properties: [] };
      }
      
      const query = `%${searchQuery}%`;
      
      const [contactsRes, dealsRes, propertiesRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, full_name, email, phone')
          .or(`full_name.ilike.${query},email.ilike.${query},phone.ilike.${query}`)
          .limit(5),
        supabase
          .from('deals')
          .select('id, name, amount, stage')
          .ilike('name', query)
          .limit(5),
        supabase
          .from('properties')
          .select('id, address, price')
          .ilike('address', query)
          .limit(5)
      ]);
      
      return { 
        contacts: contactsRes.data || [], 
        deals: dealsRes.data || [], 
        properties: propertiesRes.data || [] 
      };
    },
    enabled: searchQuery.length >= 2
  });

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : 'U';

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-primary" />;
      case 'phone':
        return <Phone className="w-4 h-4 text-primary" />;
      case 'meeting':
      case 'visit':
        return <Calendar className="w-4 h-4 text-primary" />;
      default:
        return <FileText className="w-4 h-4 text-primary" />;
    }
  };

  const handleResultClick = (type: 'contact' | 'deal' | 'property', id: string) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    
    switch (type) {
      case 'contact':
        navigate('/contacts');
        break;
      case 'deal':
        navigate('/leads');
        break;
      case 'property':
        navigate('/biens');
        break;
    }
  };

  const hasResults = searchData && (
    searchData.contacts.length > 0 || 
    searchData.deals.length > 0 || 
    searchData.properties.length > 0
  );

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between h-full px-4 gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden" />
          <Popover open={isSearchOpen && searchQuery.length >= 2} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher contacts, deals, biens..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(e.target.value.length >= 2);
                  }}
                  className="pl-10 w-80 bg-muted/50 border-border focus:bg-background"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-popover border border-border shadow-xl" align="start">
              <div className="max-h-96 overflow-y-auto">
                {/* Contacts */}
                {searchData?.contacts && searchData.contacts.length > 0 && (
                  <div className="p-2">
                    <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Contacts</p>
                    {searchData.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => handleResultClick('contact', contact.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{contact.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Deals */}
                {searchData?.deals && searchData.deals.length > 0 && (
                  <div className="p-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Deals</p>
                    {searchData.deals.map((deal) => (
                      <div
                        key={deal.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => handleResultClick('deal', deal.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{deal.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(deal.amount || 0)}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{deal.stage}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Properties */}
                {searchData?.properties && searchData.properties.length > 0 && (
                  <div className="p-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Biens</p>
                    {searchData.properties.map((property) => (
                      <div
                        key={property.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => handleResultClick('property', property.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <Home className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{property.address || 'Sans adresse'}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(property.price || 0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* No results */}
                {searchQuery.length >= 2 && !hasResults && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun résultat pour "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                {notifications && notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Notifications</h4>
                  <Badge variant="secondary">{notifications?.length || 0}</Badge>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {notifications && notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className="p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {getActivityIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{notif.title}</p>
                            {notif.description && (
                              <p className="text-xs text-muted-foreground truncate">{notif.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatRelativeTime(notif.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune notification</p>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border-2 border-border">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user?.user_metadata?.full_name || 'Utilisateur'}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
