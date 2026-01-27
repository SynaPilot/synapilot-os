import { useState, useMemo } from 'react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
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
  Share2,
  Building,
  Castle,
  Trees,
  Store,
  Car,
  TrendingUp,
  Key,
  Heart,
  Euro,
  Maximize,
  Grid3X3,
  Users,
  FileText,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { PROPERTY_TYPES, PROPERTY_STATUSES, PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS, TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';
import PropertyDetailsSheet from '@/components/properties/PropertyDetailsSheet';

type Property = Tables<'properties'>;
type Contact = Tables<'contacts'>;
type Profile = Tables<'profiles'>;

// Premium status colors - Blue/Violet only (Synapilot branding)
const PREMIUM_STATUS_COLORS: Record<string, string> = {
  'disponible': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'sous_compromis': 'bg-purple-600/20 text-purple-300 border border-purple-600/30',
  'vendu': 'bg-blue-800/30 text-blue-200 border border-blue-800/40',
  'loue': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  'retire': 'bg-gray-600/20 text-gray-400 border border-gray-600/30',
};

// Status dot colors for select items
const STATUS_DOT_COLORS: Record<string, string> = {
  'disponible': 'bg-blue-400',
  'sous_compromis': 'bg-purple-400',
  'vendu': 'bg-blue-600',
  'loue': 'bg-purple-600',
  'retire': 'bg-gray-600',
};

// Property type icons
const PROPERTY_TYPE_ICONS: Record<string, React.ReactNode> = {
  'appartement': <Building2 className="w-4 h-4" />,
  'maison': <Home className="w-4 h-4" />,
  'terrain': <Trees className="w-4 h-4" />,
  'commerce': <Store className="w-4 h-4" />,
  'bureau': <Building className="w-4 h-4" />,
  'immeuble': <Castle className="w-4 h-4" />,
  'parking': <Car className="w-4 h-4" />,
  'autre': <Building2 className="w-4 h-4" />,
};

// Transaction type icons
const TRANSACTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  'vente': <TrendingUp className="w-4 h-4" />,
  'location': <Key className="w-4 h-4" />,
  'viager': <Heart className="w-4 h-4" />,
};

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
  description: z.string().max(2000, 'Description trop longue (max 2000 caractères)').optional(),
}).refine((data) => {
  // Bedrooms must be <= rooms if both are provided
  if (data.bedrooms && data.rooms && data.bedrooms > data.rooms) {
    return false;
  }
  return true;
}, {
  message: "Le nombre de chambres ne peut pas dépasser le nombre de pièces",
  path: ["bedrooms"],
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

function PropertyCard({ property, index, onClick }: { property: Property; index: number; onClick: () => void }) {
  const getStatusColor = (status: string | null) => {
    return PREMIUM_STATUS_COLORS[status || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className="glass border-white/10 hover:border-blue-500/30 transition-all group overflow-hidden">
        <div className="h-36 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
          <Home className="w-10 h-10 text-blue-400/40" />
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <Badge className={`text-xs ${getStatusColor(property.status)}`}>
              {PROPERTY_STATUS_LABELS[property.status as keyof typeof PROPERTY_STATUS_LABELS] || property.status}
            </Badge>
            {property.type && <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">{PROPERTY_TYPE_LABELS[property.type as keyof typeof PROPERTY_TYPE_LABELS] || property.type}</Badge>}
          </div>
          <p className="font-medium text-sm line-clamp-2 mb-2">{property.title}</p>
          <p className="text-lg font-semibold text-blue-400 mb-3">
            {property.price ? formatCurrency(property.price) : 'Prix non défini'}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            {property.surface && (
              <span className="flex items-center gap-1">
                <Square className="w-3 h-3 text-blue-400" />
                {formatNumber(property.surface)} m²
              </span>
            )}
            {property.rooms && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-purple-400" />
                {property.rooms}p
              </span>
            )}
            {property.bedrooms && (
              <span className="flex items-center gap-1">
                <Bed className="w-3 h-3 text-blue-400" />
                {property.bedrooms}ch
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Premium input styles
const premiumInputClass = "bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-white placeholder:text-white/40 transition-all duration-200 rounded-xl";
const premiumSelectTriggerClass = "bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-white transition-all duration-200 rounded-xl";

export default function Properties() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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
      description: '',
    },
  });

  const descriptionValue = form.watch('description') || '';
  const transactionType = form.watch('transaction_type');
  const propertyType = form.watch('type');

  // Disable surface for parking type
  const isSurfaceDisabled = propertyType === 'parking';

  const { data: properties, isLoading } = useOrgQuery<Property[]>('properties', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Fetch all contacts for owner selection (removed role filter - was causing enum error)
  const { data: contacts } = useOrgQuery<Contact[]>('contacts', {
    select: 'id, full_name, email, role',
    orderBy: { column: 'full_name', ascending: true }
  });

  // State for contact combobox
  const [openContactCombobox, setOpenContactCombobox] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      // Force owner_id (nom réel de la colonne dans la BDD)
      const propertyData = {
        title: values.title,
        type: values.type,
        status: values.status,
        transaction_type: values.transaction_type,
        price: values.price || null,
        surface_m2: values.surface || null,
        rooms: values.rooms || null,
        bedrooms: values.bedrooms || null,
        owner_id: values.contact_id || null, // owner_id est le nom réel en BDD
        description: values.description || null,
        organization_id: organizationId,
      } as any;

      const { error } = await supabase
        .from('properties')
        .insert([propertyData]);

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
        description: '',
      });
      toast.success('Bien créé avec succès', {
        style: {
          background: 'linear-gradient(135deg, rgba(75, 139, 255, 0.9), rgba(124, 58, 237, 0.9))',
          border: 'none',
          color: 'white',
        }
      });
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', {
        description: error.message,
        style: {
          background: 'rgba(124, 58, 237, 0.1)',
          borderColor: 'rgba(124, 58, 237, 0.3)',
          color: 'rgb(192, 132, 252)',
        }
      });
    },
  });

  const filteredProperties = properties?.filter((p) => {
    const matchesSearch = (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (p.address?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Generate initials for avatar
  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Format price with spaces
  const formatPriceInput = (value: number | undefined) => {
    if (!value) return '';
    return value.toLocaleString('fr-FR');
  };

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
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02]">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau bien
              </Button>
            </DialogTrigger>
            <AnimatePresence>
              {isDialogOpen && (
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#111111] border-white/10 backdrop-blur-xl shadow-2xl shadow-black/50 rounded-xl p-0">
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={modalVariants}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Premium Header */}
                    <DialogHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-8 pb-6 border-b border-white/10">
                      <DialogTitle className="text-2xl font-semibold text-white flex items-center gap-3 antialiased">
                        <Home className="w-6 h-6 text-blue-400" />
                        Ajouter un bien
                      </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="p-8 space-y-8">
                        
                        {/* SECTION 1: Informations principales */}
                        <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Informations principales</h3>
                          
                          {/* Title */}
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold">Titre <span className="text-blue-400">*</span></FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Appartement T3 centre-ville" 
                                    {...field} 
                                    className={premiumInputClass}
                                  />
                                </FormControl>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                              </FormItem>
                            )}
                          />

                          {/* Type with icons */}
                          <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold">Type <span className="text-blue-400">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className={premiumSelectTriggerClass}>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-[#1a1a1a] border-white/20">
                                    {PROPERTY_TYPES.map((type) => (
                                      <SelectItem key={type} value={type} className="hover:bg-blue-500/10">
                                        <div className="flex items-center gap-2 text-white">
                                          <span className="text-blue-400">{PROPERTY_TYPE_ICONS[type]}</span>
                                          {PROPERTY_TYPE_LABELS[type]}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                              </FormItem>
                            )}
                          />

                          {/* Status with colored dots */}
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold">Statut <span className="text-blue-400">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className={premiumSelectTriggerClass}>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-[#1a1a1a] border-white/20">
                                    {PROPERTY_STATUSES.map((status) => (
                                      <SelectItem key={status} value={status} className="hover:bg-blue-500/10">
                                        <div className="flex items-center gap-2 text-white">
                                          <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
                                          {PROPERTY_STATUS_LABELS[status]}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                              </FormItem>
                            )}
                          />

                          {/* Transaction Type with icons */}
                          <FormField
                            control={form.control}
                            name="transaction_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold">Type de transaction <span className="text-blue-400">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className={premiumSelectTriggerClass}>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-[#1a1a1a] border-white/20">
                                    {TRANSACTION_TYPES.map((type) => (
                                      <SelectItem key={type} value={type} className="hover:bg-blue-500/10">
                                        <div className="flex items-center gap-2 text-white">
                                          <span className="text-purple-400">{TRANSACTION_TYPE_ICONS[type]}</span>
                                          {TRANSACTION_TYPE_LABELS[type]}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* SECTION 2: Caractéristiques */}
                        <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">Caractéristiques</h3>
                          
                          {/* Price - Premium styling */}
                          <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold">
                                  {transactionType === 'location' ? 'Loyer mensuel (€)' : 'Prix (€)'} <span className="text-blue-400">*</span>
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                                    <Input 
                                      type="number" 
                                      placeholder="350000"
                                      {...field} 
                                      value={field.value ?? ''}
                                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                      className={`${premiumInputClass} pl-10 text-lg font-semibold focus:shadow-lg focus:shadow-blue-500/20`}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                              </FormItem>
                            )}
                          />

                          {/* Surface & Rooms - 2 columns */}
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="surface"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white font-semibold flex items-center gap-2">
                                    <Maximize className="w-4 h-4 text-purple-400" />
                                    Surface
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input 
                                        type="number" 
                                        placeholder="75"
                                        {...field} 
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                        className={`${premiumInputClass} pr-10 ${isSurfaceDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={isSurfaceDisabled}
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm font-medium">m²</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="rooms"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white font-semibold flex items-center gap-2">
                                    <Grid3X3 className="w-4 h-4 text-purple-400" />
                                    Pièces
                                  </FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="4"
                                      {...field} 
                                      value={field.value ?? ''}
                                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                      className={premiumInputClass}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
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
                                <FormLabel className="text-white font-semibold flex items-center gap-2">
                                  <Bed className="w-4 h-4 text-purple-400" />
                                  Chambres
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="2"
                                    {...field} 
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                    className={premiumInputClass}
                                  />
                                </FormControl>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* SECTION 3: Attribution */}
                        <div className="border-l-2 border-blue-500/30 pl-4 bg-white/5 rounded-r-xl py-4 pr-4 space-y-6">
                          <h3 className="text-sm font-semibold text-blue-400/80 uppercase tracking-wider mb-4">Attribution</h3>
                          
                          {/* Contact lié (Combobox recherchable) */}
                          <FormField
                            control={form.control}
                            name="contact_id"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-white font-semibold flex items-center gap-2">
                                  <Users className="w-4 h-4 text-blue-400" />
                                  Contact lié
                                  <span className="text-xs text-muted-foreground font-normal">(Optionnel)</span>
                                </FormLabel>
                                <Popover open={openContactCombobox} onOpenChange={setOpenContactCombobox}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openContactCombobox}
                                        className={cn(
                                          "w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 text-left font-normal",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value
                                          ? contacts?.find((contact) => contact.id === field.value)?.full_name
                                          : "Rechercher un contact..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[400px] p-0 bg-[#1a1a1a] border-white/20" align="start">
                                    <Command className="bg-transparent">
                                      <CommandInput placeholder="Rechercher un contact..." className="border-white/10" />
                                      <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                        Aucun contact trouvé.
                                      </CommandEmpty>
                                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                                        <CommandItem
                                          value="aucun"
                                          onSelect={() => {
                                            field.onChange(null);
                                            setOpenContactCombobox(false);
                                          }}
                                          className="text-muted-foreground italic cursor-pointer hover:bg-white/10"
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              !field.value ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          Aucun contact
                                        </CommandItem>
                                        {contacts?.map((contact) => (
                                          <CommandItem
                                            key={contact.id}
                                            value={contact.full_name}
                                            onSelect={() => {
                                              field.onChange(contact.id);
                                              setOpenContactCombobox(false);
                                            }}
                                            className="cursor-pointer hover:bg-white/10"
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                field.value === contact.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex items-center gap-3">
                                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-semibold text-white">
                                                {getInitials(contact.full_name)}
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="text-white">{contact.full_name}</span>
                                                {contact.email && (
                                                  <span className="text-xs text-white/50">{contact.email}</span>
                                                )}
                                              </div>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <p className="text-xs text-muted-foreground">
                                  Lier ce bien à un propriétaire ou prospect existant
                                </p>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
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
                                  <FormLabel className="text-white font-semibold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    Description
                                  </FormLabel>
                                  <span className="text-xs text-purple-400">
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
                                    className={`${premiumInputClass} min-h-[120px] border-l-2 border-l-blue-500/30 border-r-2 border-r-purple-500/30`}
                                  />
                                </FormControl>
                                <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Premium Submit Button */}
                        <Button 
                          type="submit" 
                          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 font-semibold text-white tracking-wide transition-all duration-200 hover:scale-[1.02] rounded-xl h-12" 
                          disabled={createMutation.isPending}
                        >
                          {createMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Création...
                            </>
                          ) : (
                            'Créer le bien'
                          )}
                        </Button>
                      </form>
                    </Form>
                  </motion.div>
                </DialogContent>
              )}
            </AnimatePresence>
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
                <SelectItem key={status} value={status}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
                    {PROPERTY_STATUS_LABELS[status]}
                  </div>
                </SelectItem>
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
            iconGradient="from-blue-500/20 to-purple-500/20"
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
              { icon: <Camera className="w-5 h-5 text-blue-400" />, title: "Photos HD", desc: "Galerie photos haute qualité" },
              { icon: <MapPin className="w-5 h-5 text-purple-400" />, title: "Géolocalisation", desc: "Cartographie intégrée" },
              { icon: <Share2 className="w-5 h-5 text-blue-400" />, title: "Partage clients", desc: "Envoyez en un clic" }
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProperties?.map((property, index) => (
              <PropertyCard 
                key={property.id} 
                property={property} 
                index={index} 
                onClick={() => {
                  setSelectedPropertyId(property.id);
                  setIsSheetOpen(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Property Details Sheet */}
        <PropertyDetailsSheet
          propertyId={selectedPropertyId}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
        />
    </motion.div>
  );
}