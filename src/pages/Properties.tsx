import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Search, 
  Home, 
  MapPin, 
  Bed,
  Square,
  Euro,
  Loader2,
  Building2
} from 'lucide-react';
import { useProfile } from '@/hooks/useOrganization';

const PROPERTY_TYPES = ['Appartement', 'Maison', 'Terrain', 'Commerce', 'Immeuble'] as const;
const PROPERTY_STATUSES = ['Estimation', 'Mandat', 'Sous Offre', 'Vendu', 'Archivé'] as const;

const propertySchema = z.object({
  address: z.string().min(5, 'Adresse requise').max(255),
  type: z.enum(PROPERTY_TYPES),
  price: z.number().min(0).optional(),
  surface_m2: z.number().min(0).optional(),
  rooms: z.number().min(0).optional(),
  bedrooms: z.number().min(0).optional(),
  description: z.string().max(2000).optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

type Property = {
  id: string;
  address: string;
  type: typeof PROPERTY_TYPES[number] | null;
  status: typeof PROPERTY_STATUSES[number];
  price: number | null;
  surface_m2: number | null;
  rooms: number | null;
  bedrooms: number | null;
  description: string | null;
  photos_url: string[] | null;
  created_at: string;
};

function PropertyCard({ property }: { property: Property }) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Estimation': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Mandat': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Sous Offre': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Vendu': 'bg-primary/20 text-primary border-primary/30',
      'Archivé': 'bg-muted text-muted-foreground border-muted',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const formatPrice = (price: number | null) => {
    if (!price) return 'Prix non défini';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Card className="glass border-border/50 hover:border-primary/30 transition-all group overflow-hidden">
      <div className="h-40 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
        <Home className="w-12 h-12 text-muted-foreground/50" />
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Badge className={getStatusColor(property.status)}>{property.status}</Badge>
          {property.type && <Badge variant="outline">{property.type}</Badge>}
        </div>
        <p className="font-medium text-foreground line-clamp-2 mb-2">{property.address}</p>
        <p className="text-xl font-display font-bold text-primary mb-3">
          {formatPrice(property.price)}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {property.surface_m2 && (
            <span className="flex items-center gap-1">
              <Square className="w-3 h-3" />
              {property.surface_m2} m²
            </span>
          )}
          {property.rooms && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {property.rooms} pièces
            </span>
          )}
          {property.bedrooms && (
            <span className="flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {property.bedrooms}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Properties() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: '',
      type: 'Appartement',
      price: undefined,
      surface_m2: undefined,
      rooms: undefined,
      bedrooms: undefined,
      description: '',
    },
  });

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Property[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      if (!profile?.organization_id) throw new Error('Organization not found');
      
      const { data, error } = await supabase
        .from('properties')
        .insert({
          address: values.address,
          type: values.type,
          price: values.price || null,
          surface_m2: values.surface_m2 || null,
          rooms: values.rooms || null,
          bedrooms: values.bedrooms || null,
          description: values.description || null,
          organization_id: profile.organization_id,
          status: 'Estimation' as const,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: 'Bien créé avec succès' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const filteredProperties = properties?.filter((p) => {
    const matchesSearch = p.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Biens</h1>
            <p className="text-muted-foreground">Gérez votre portefeuille immobilier</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Bien
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un Bien</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse *</FormLabel>
                        <FormControl>
                          <Input placeholder="123 rue de la Paix, 75001 Paris" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PROPERTY_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix (€)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="350000"
                              {...field} 
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="surface_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Surface (m²)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="75"
                              {...field} 
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rooms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pièces</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="4"
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bedrooms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chambres</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="2"
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Description du bien..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer le bien
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par adresse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {PROPERTY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Properties Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[300px] w-full" />
            ))}
          </div>
        ) : filteredProperties?.length === 0 ? (
          <Card className="glass border-border/50">
            <CardContent className="py-12 text-center">
              <Home className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Aucun bien trouvé</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un bien
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties?.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
