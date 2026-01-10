import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PropertyCardSkeleton } from '@/components/skeletons';
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
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Search, 
  Home, 
  Bed,
  Square,
  Loader2,
  Building2
} from 'lucide-react';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { PROPERTY_TYPES, PROPERTY_STATUSES } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type Property = Tables<'properties'>;

const propertySchema = z.object({
  address: z.string().min(5, 'Adresse requise').max(255),
  type: z.enum(['Appartement', 'Maison', 'Terrain', 'Commerce', 'Immeuble']),
  price: z.number().min(0).optional(),
  surface_m2: z.number().min(0).optional(),
  rooms: z.number().min(0).optional(),
  bedrooms: z.number().min(0).optional(),
  description: z.string().max(2000).optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function PropertyCard({ property, index }: { property: Property; index: number }) {
  const getStatusColor = (status: string | null) => {
    const colors: Record<string, string> = {
      'Estimation': 'bg-info/20 text-info border-info/30',
      'Mandat': 'bg-success/20 text-success border-success/30',
      'Sous Offre': 'bg-warning/20 text-warning border-warning/30',
      'Vendu': 'bg-primary/20 text-primary border-primary/30',
      'Archivé': 'bg-muted text-muted-foreground border-muted',
    };
    return colors[status || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="glass border-white/10 hover:border-primary/30 transition-all group overflow-hidden">
        <div className="h-36 bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
          <Home className="w-10 h-10 text-muted-foreground/40" />
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <Badge className={`text-xs ${getStatusColor(property.status)}`}>
              {property.status}
            </Badge>
            {property.type && <Badge variant="outline" className="text-xs">{property.type}</Badge>}
          </div>
          <p className="font-medium text-sm line-clamp-2 mb-2">{property.address}</p>
          <p className="text-lg font-semibold text-primary mb-3">
            {property.price ? formatCurrency(property.price) : 'Prix non défini'}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            {property.surface_m2 && (
              <span className="flex items-center gap-1">
                <Square className="w-3 h-3" />
                {formatNumber(property.surface_m2)} m²
              </span>
            )}
            {property.rooms && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {property.rooms}p
              </span>
            )}
            {property.bedrooms && (
              <span className="flex items-center gap-1">
                <Bed className="w-3 h-3" />
                {property.bedrooms}ch
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Properties() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();

  const propertiesQueryKey = organizationId 
    ? (['properties', organizationId] as const) 
    : (['properties'] as const);

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

  const { data: properties, isLoading } = useOrgQuery<Property[]>('properties', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createMutation = useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('properties')
        .insert({
          address: values.address,
          type: values.type,
          price: values.price || null,
          surface_m2: values.surface_m2 || null,
          rooms: values.rooms || null,
          bedrooms: values.bedrooms || null,
          description: values.description || null,
          organization_id: organizationId,
          status: 'Estimation',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
      setIsDialogOpen(false);
      form.reset();
      toast.success('Bien créé avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const filteredProperties = properties?.filter((p) => {
    const matchesSearch = p.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <motion.div 
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Biens</h1>
            <p className="text-muted-foreground">{properties?.length || 0} biens en portefeuille</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau bien
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un bien</DialogTitle>
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
                          <Input placeholder="123 rue de la Paix, Paris" {...field} />
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
                                <SelectValue />
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
                          <FormLabel>Surface</FormLabel>
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
                          <Textarea placeholder="Description..." {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {createMutation.isPending ? 'Création...' : 'Créer le bien'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProperties?.length === 0 ? (
          <Card className="glass border-white/10">
            <CardContent className="py-12 text-center">
              <Home className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aucun bien trouvé</p>
              <Button className="mt-4" size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un bien
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProperties?.map((property, index) => (
              <PropertyCard key={property.id} property={property} index={index} />
            ))}
          </div>
        )}
    </motion.div>
  );
}
