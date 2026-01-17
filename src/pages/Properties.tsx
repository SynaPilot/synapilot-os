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
  Building2,
  Upload,
  Camera,
  MapPin,
  Share2
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { PROPERTY_TYPES, PROPERTY_STATUSES, PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS, TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type Property = Tables<'properties'>;
type Contact = Tables<'contacts'>;
type Profile = Tables<'profiles'>;

const propertySchema = z.object({
  title: z.string().min(5, 'Titre requis (min 5 caractères)').max(255),
  type: z.enum(['appartement', 'maison', 'terrain', 'commerce', 'bureau', 'immeuble', 'parking', 'autre']),
  status: z.enum(['disponible', 'sous_compromis', 'vendu', 'loue', 'retire']),
  transaction_type: z.enum(['vente', 'location', 'viager']),
  price: z.number().min(0, 'Prix invalide').optional(),
  surface: z.number().min(0).optional().nullable(),
  rooms: z.number().min(0).optional().nullable(),
  bedrooms: z.number().min(0).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  description: z.string().max(2000, 'Description trop longue (max 2000 caractères)').optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const STATUS_COLORS: Record<string, string> = {
  'disponible': 'bg-info/20 text-info border-info/30',
  'sous_compromis': 'bg-warning/20 text-warning border-warning/30',
  'vendu': 'bg-success/20 text-success border-success/30',
  'loue': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'retire': 'bg-muted text-muted-foreground border-muted',
};

function PropertyCard({ property, index }: { property: Property; index: number }) {
  const getStatusColor = (status: string | null) => {
    return STATUS_COLORS[status || ''] || 'bg-muted text-muted-foreground';
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
              {PROPERTY_STATUS_LABELS[property.status as keyof typeof PROPERTY_STATUS_LABELS] || property.status}
            </Badge>
            {property.type && <Badge variant="outline" className="text-xs">{PROPERTY_TYPE_LABELS[property.type as keyof typeof PROPERTY_TYPE_LABELS] || property.type}</Badge>}
          </div>
          <p className="font-medium text-sm line-clamp-2 mb-2">{property.title}</p>
          <p className="text-lg font-semibold text-primary mb-3">
            {property.price ? formatCurrency(property.price) : 'Prix non défini'}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            {property.surface && (
              <span className="flex items-center gap-1">
                <Square className="w-3 h-3" />
                {formatNumber(property.surface)} m²
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
  const { organizationId, user } = useAuth();

  const propertiesQueryKey = organizationId 
    ? (['properties', organizationId] as const) 
    : (['properties'] as const);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: '',
      type: 'appartement',
      status: 'disponible',
      transaction_type: 'vente',
      price: undefined,
      surface: null,
      rooms: null,
      bedrooms: null,
      contact_id: null,
      assigned_to: user?.id || null,
      description: '',
    },
  });

  const descriptionValue = form.watch('description') || '';

  const { data: properties, isLoading } = useOrgQuery<Property[]>('properties', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Fetch contacts with role 'vendeur' for owner selection
  const { data: vendeurs } = useOrgQuery<Contact[]>('contacts', {
    select: 'id, full_name, email',
    filters: { role: 'vendeur' },
    orderBy: { column: 'full_name', ascending: true }
  });

  // Fetch profiles for agent assignment
  const { data: profiles } = useOrgQuery<Profile[]>('profiles', {
    select: 'id, full_name, email',
    orderBy: { column: 'full_name', ascending: true }
  });
  const createMutation = useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const { error } = await supabase
        .from('properties')
        .insert([{
          title: values.title,
          type: values.type,
          status: values.status,
          transaction_type: values.transaction_type,
          price: values.price || null,
          surface: values.surface || null,
          rooms: values.rooms || null,
          bedrooms: values.bedrooms || null,
          contact_id: values.contact_id || null,
          assigned_to: values.assigned_to || null,
          description: values.description || null,
          organization_id: organizationId,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
      setIsDialogOpen(false);
      form.reset({
        title: '',
        type: 'appartement',
        status: 'disponible',
        transaction_type: 'vente',
        price: undefined,
        surface: null,
        rooms: null,
        bedrooms: null,
        contact_id: null,
        assigned_to: user?.id || null,
        description: '',
      });
      toast.success('Bien créé avec succès');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', {
        description: error.message,
      });
    },
  });

  const filteredProperties = properties?.filter((p) => {
    const matchesSearch = (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (p.address?.toLowerCase() || '').includes(searchQuery.toLowerCase());
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter un bien</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-6">
                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titre <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Appartement T3 centre-ville" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Type */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROPERTY_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{PROPERTY_TYPE_LABELS[type]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status with colored badges */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROPERTY_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]?.split(' ')[0] || 'bg-muted'}`} />
                                  {PROPERTY_STATUS_LABELS[status]}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Transaction Type */}
                  <FormField
                    control={form.control}
                    name="transaction_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de transaction <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TRANSACTION_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{TRANSACTION_TYPE_LABELS[type]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Price */}
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix (€) <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="350000"
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Surface & Rooms - 2 columns */}
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="surface"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Surface</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                placeholder="75"
                                {...field} 
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                className="pr-10"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">m²</span>
                            </div>
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
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Bedrooms */}
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
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Owner (contact_id) - Searchable select of contacts with role='vendeur' */}
                  <FormField
                    control={form.control}
                    name="contact_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propriétaire</FormLabel>
                        <Select onValueChange={(val) => field.onChange(val === 'none' ? null : val)} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un propriétaire" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            {vendeurs?.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                <div className="flex flex-col">
                                  <span>{contact.full_name}</span>
                                  {contact.email && <span className="text-xs text-muted-foreground">{contact.email}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Assigned Agent */}
                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent assigné</FormLabel>
                        <Select onValueChange={(val) => field.onChange(val === 'none' ? null : val)} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un agent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            {profiles?.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.full_name || profile.email || 'Agent'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description with character counter */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Description</FormLabel>
                          <span className="text-xs text-muted-foreground">
                            {descriptionValue.length}/2000
                          </span>
                        </div>
                        <FormControl>
                          <Textarea 
                            placeholder="Description détaillée du bien..." 
                            {...field} 
                            value={field.value || ''}
                            rows={6}
                            maxLength={2000}
                          />
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
                <SelectItem key={status} value={status}>{PROPERTY_STATUS_LABELS[status]}</SelectItem>
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
          <EmptyState
            icon={Home}
            iconGradient="from-purple-500/20 to-pink-500/20"
            title="Votre portefeuille immobilier"
            description="Ajoutez vos biens avec photos, géolocalisation et partagez-les facilement avec vos clients."
            action={{
              label: "Ajouter mon premier bien",
              onClick: () => setIsDialogOpen(true),
              icon: <Plus className="w-5 h-5" />
            }}
            secondaryAction={{
              label: "Importer depuis Excel",
              onClick: () => {},
              icon: <Upload className="w-5 h-5" />
            }}
            features={[
              { icon: <Camera className="w-5 h-5 text-primary" />, title: "Photos HD", desc: "Galerie photos haute qualité" },
              { icon: <MapPin className="w-5 h-5 text-primary" />, title: "Géolocalisation", desc: "Cartographie intégrée" },
              { icon: <Share2 className="w-5 h-5 text-primary" />, title: "Partage clients", desc: "Envoyez en un clic" }
            ]}
          />
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
