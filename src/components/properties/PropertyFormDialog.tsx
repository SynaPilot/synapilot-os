import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { 
  Zap,
  FileText,
  Image as ImageIcon,
  Home, 
  Bed,
  Square,
  Loader2,
  Building2,
  MapPin,
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
  Check,
  ChevronsUpDown,
  FileSignature,
  Thermometer,
  Landmark,
  Coins,
  CloudCog,
  Flame
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PROPERTY_TYPES, 
  PROPERTY_STATUSES, 
  PROPERTY_TYPE_LABELS, 
  PROPERTY_STATUS_LABELS, 
  TRANSACTION_TYPES, 
  TRANSACTION_TYPE_LABELS,
  DPE_GES_LABELS,
  DPE_COLORS,
  MANDATE_TYPES,
  MANDATE_TYPE_LABELS,
  HEATING_TYPES,
  HEATING_TYPE_LABELS,
} from '@/lib/constants';
import type { Tables } from '@/integrations/supabase/types';

type Property = Tables<'properties'>;
type Contact = Tables<'contacts'>;

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

// Extended schema with new administrative fields
const propertySchema = z.object({
  // Essential fields
  title: z.string().min(3, 'Titre requis (min 3 caractères)').max(255),
  address: z.string().max(255).optional().nullable(),
  type: z.enum(['appartement', 'maison', 'terrain', 'commerce', 'bureau', 'immeuble', 'parking', 'autre']),
  status: z.enum(['disponible', 'sous_compromis', 'vendu', 'loue', 'retire']),
  transaction_type: z.enum(['vente', 'location', 'viager']),
  price: z.number().min(0, 'Prix invalide').optional().nullable(),
  surface: z.number().min(0).optional().nullable(),
  rooms: z.number().min(0).optional().nullable(),
  bedrooms: z.number().min(0).optional().nullable(),
  
  // Administrative fields (all optional)
  mandate_number: z.string().max(50).optional().nullable(),
  mandate_type: z.enum(['simple', 'exclusif', 'semi_exclusif', 'recherche']).optional().nullable(),
  dpe_label: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional().nullable(),
  ges_label: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional().nullable(),
  cadastral_ref: z.string().max(100).optional().nullable(),
  year_built: z.number().min(1800).max(2030).optional().nullable(),
  tax_property: z.number().min(0).optional().nullable(),
  co_ownership_charges: z.number().min(0).optional().nullable(),
  heating_type: z.enum(['gaz', 'electrique', 'fioul', 'bois', 'pompe_chaleur', 'geothermie', 'solaire', 'collectif', 'autre']).optional().nullable(),
  
  // Description
  description: z.string().max(2000, 'Description trop longue (max 2000 caractères)').optional().nullable(),
}).refine((data) => {
  if (data.bedrooms && data.rooms && data.bedrooms > data.rooms) {
    return false;
  }
  return true;
}, {
  message: "Le nombre de chambres ne peut pas dépasser le nombre de pièces",
  path: ["bedrooms"],
});

type PropertyFormValues = z.infer<typeof propertySchema>;

interface PropertyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts?: Contact[];
}

const premiumInputClass = "bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-white placeholder:text-white/40 transition-all duration-200 rounded-xl";
const premiumSelectTriggerClass = "bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-white transition-all duration-200 rounded-xl";

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export function PropertyFormDialog({ open, onOpenChange, contacts }: PropertyFormDialogProps) {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [openContactCombobox, setOpenContactCombobox] = useState(false);
  const [activeTab, setActiveTab] = useState('essentiel');

  const propertiesQueryKey = organizationId 
    ? (['properties', organizationId] as const) 
    : (['properties'] as const);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: '',
      address: null,
      type: 'appartement',
      status: 'disponible',
      transaction_type: 'vente',
      price: null,
      surface: null,
      rooms: null,
      bedrooms: null,
      mandate_number: null,
      mandate_type: null,
      dpe_label: null,
      ges_label: null,
      cadastral_ref: null,
      year_built: null,
      tax_property: null,
      co_ownership_charges: null,
      heating_type: null,
      description: null,
    },
  });

  const transactionType = form.watch('transaction_type');
  const propertyType = form.watch('type');
  const isSurfaceDisabled = propertyType === 'parking';

  const createMutation = useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      
      const propertyInsert = {
        organization_id: organizationId,
        title: values.title,
        address: values.address || null,
        type: values.type ?? null,
        status: values.status ?? 'disponible',
        transaction_type: values.transaction_type ?? 'vente',
        price: values.price ?? null,
        surface: values.surface ?? null,
        rooms: values.rooms ?? null,
        bedrooms: values.bedrooms ?? null,
        contact_id: selectedContactId || null,
        // New administrative fields
        mandate_number: values.mandate_number || null,
        mandate_type: values.mandate_type || null,
        dpe_label: values.dpe_label || null,
        ges_label: values.ges_label || null,
        cadastral_ref: values.cadastral_ref || null,
        year_built: values.year_built || null,
        tax_property: values.tax_property || null,
        co_ownership_charges: values.co_ownership_charges || null,
        heating_type: values.heating_type || null,
        description: values.description ?? null,
      };

      const { error } = await supabase
        .from('properties')
        .insert([propertyInsert as any]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
      onOpenChange(false);
      setSelectedContactId(null);
      setActiveTab('essentiel');
      form.reset();
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
      });
    },
  });

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-[#111111] border-white/10 backdrop-blur-xl shadow-2xl shadow-black/50 rounded-2xl p-0">
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={modalVariants}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full max-h-[90vh]"
            >
              {/* Premium Header */}
              <DialogHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 pb-4 border-b border-white/10 flex-shrink-0">
                <DialogTitle className="text-xl font-semibold text-white flex items-center gap-3 antialiased">
                  <Home className="w-5 h-5 text-blue-400" />
                  Ajouter un bien
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="flex flex-col flex-1 overflow-hidden">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
                    {/* Tab List */}
                    <div className="px-6 pt-4 flex-shrink-0">
                      <TabsList className="grid w-full grid-cols-3 bg-white/5 p-1 rounded-xl">
                        <TabsTrigger 
                          value="essentiel" 
                          className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-white rounded-lg transition-all"
                        >
                          <Zap className="w-4 h-4" />
                          <span className="hidden sm:inline">L'Essentiel</span>
                          <span className="sm:hidden">Essentiel</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="admin" 
                          className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-white rounded-lg transition-all"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="hidden sm:inline">Administratif</span>
                          <span className="sm:hidden">Admin</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="medias" 
                          className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-white rounded-lg transition-all"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Médias
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Tab Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                      {/* TAB 1: L'Essentiel */}
                      <TabsContent value="essentiel" className="mt-0 space-y-6">
                        <p className="text-sm text-muted-foreground mb-4">
                          Remplissez les informations clés pour créer rapidement votre bien.
                        </p>
                        
                        {/* Title */}
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white font-semibold">Titre du bien <span className="text-blue-400">*</span></FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Appartement T3 lumineux - Centre-ville" 
                                  {...field} 
                                  className={premiumInputClass}
                                />
                              </FormControl>
                              <FormMessage className="text-purple-400" />
                            </FormItem>
                          )}
                        />

                        {/* Type & Status Row */}
                        <div className="grid grid-cols-2 gap-4">
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Transaction Type & Price */}
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="transaction_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold">Transaction <span className="text-blue-400">*</span></FormLabel>
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold">
                                  {transactionType === 'location' ? 'Loyer (€/mois)' : 'Prix (€)'}
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                                    <Input 
                                      type="number" 
                                      placeholder="350000"
                                      {...field} 
                                      value={field.value ?? ''}
                                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                      className={`${premiumInputClass} pl-10`}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Address */}
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white font-semibold flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-purple-400" />
                                Adresse
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="123 Rue de la Paix, 75001 Paris" 
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(e.target.value || null)}
                                  className={premiumInputClass}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Surface, Rooms, Bedrooms */}
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="surface"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold flex items-center gap-1">
                                  <Maximize className="w-3 h-3 text-purple-400" />
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
                                      className={`${premiumInputClass} pr-10 ${isSurfaceDisabled ? 'opacity-50' : ''}`}
                                      disabled={isSurfaceDisabled}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs">m²</span>
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
                                <FormLabel className="text-white font-semibold flex items-center gap-1">
                                  <Grid3X3 className="w-3 h-3 text-purple-400" />
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bedrooms"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white font-semibold flex items-center gap-1">
                                  <Bed className="w-3 h-3 text-purple-400" />
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Contact lié */}
                        <div className="flex flex-col gap-2">
                          <label className="text-white font-semibold flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-blue-400" />
                            Contact lié
                            <span className="text-xs text-muted-foreground font-normal">(Optionnel)</span>
                          </label>
                          <Popover open={openContactCombobox} onOpenChange={setOpenContactCombobox}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openContactCombobox}
                                className={cn(
                                  "w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 text-left font-normal",
                                  !selectedContactId && "text-muted-foreground"
                                )}
                              >
                                {selectedContactId
                                  ? contacts?.find((contact) => contact.id === selectedContactId)?.full_name
                                  : "Rechercher un contact..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 bg-[#1a1a1a] border-white/20" align="start">
                              <Command className="bg-transparent">
                                <CommandInput placeholder="Rechercher un contact..." className="border-white/10" />
                                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                  Aucun contact trouvé.
                                </CommandEmpty>
                                <CommandGroup className="max-h-[200px] overflow-y-auto">
                                  <CommandItem
                                    value="aucun"
                                    onSelect={() => {
                                      setSelectedContactId(null);
                                      setOpenContactCombobox(false);
                                    }}
                                    className="text-muted-foreground italic cursor-pointer hover:bg-white/10"
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !selectedContactId ? "opacity-100" : "opacity-0")} />
                                    Aucun contact
                                  </CommandItem>
                                  {contacts?.map((contact) => (
                                    <CommandItem
                                      key={contact.id}
                                      value={contact.full_name}
                                      onSelect={() => {
                                        setSelectedContactId(contact.id);
                                        setOpenContactCombobox(false);
                                      }}
                                      className="cursor-pointer hover:bg-white/10"
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", selectedContactId === contact.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-semibold text-white">
                                          {getInitials(contact.full_name)}
                                        </div>
                                        <span className="text-white">{contact.full_name}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TabsContent>

                      {/* TAB 2: Administratif & Légal */}
                      <TabsContent value="admin" className="mt-0 space-y-6">
                        <p className="text-sm text-muted-foreground mb-4">
                          Informations légales et administratives pour une gestion complète.
                        </p>

                        {/* Mandate Section */}
                        <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-4">
                          <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                            <FileSignature className="w-4 h-4" />
                            Mandat
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="mandate_number"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">N° de mandat</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="M24-055"
                                      {...field}
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value || null)}
                                      className={premiumInputClass}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="mandate_type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">Type de mandat</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl>
                                      <SelectTrigger className={premiumSelectTriggerClass}>
                                        <SelectValue placeholder="Sélectionner..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-[#1a1a1a] border-white/20">
                                      {MANDATE_TYPES.map((type) => (
                                        <SelectItem key={type} value={type} className="hover:bg-blue-500/10">
                                          <span className="text-white">{MANDATE_TYPE_LABELS[type]}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Financial Section */}
                        <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 pr-4 space-y-4">
                          <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                            <Coins className="w-4 h-4" />
                            Finances
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="tax_property"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">Taxe foncière (€/an)</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                                      <Input 
                                        type="number"
                                        placeholder="1200"
                                        {...field}
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                        className={`${premiumInputClass} pl-10`}
                                      />
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="co_ownership_charges"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">Charges copro (€/mois)</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                                      <Input 
                                        type="number"
                                        placeholder="150"
                                        {...field}
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                        className={`${premiumInputClass} pl-10`}
                                      />
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Technical Section */}
                        <div className="border-l-2 border-blue-400/50 pl-4 bg-blue-400/5 rounded-r-xl py-4 pr-4 space-y-4">
                          <h4 className="text-sm font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                            <Thermometer className="w-4 h-4" />
                            Technique
                          </h4>
                          
                          {/* DPE & GES */}
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="dpe_label"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">DPE</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl>
                                      <SelectTrigger className={premiumSelectTriggerClass}>
                                        <SelectValue placeholder="A - G" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-[#1a1a1a] border-white/20">
                                      {DPE_GES_LABELS.map((label) => (
                                        <SelectItem key={label} value={label} className="hover:bg-blue-500/10">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm ${DPE_COLORS[label]}`}>
                                              {label}
                                            </span>
                                            <span className="text-white">Classe {label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="ges_label"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">GES</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl>
                                      <SelectTrigger className={premiumSelectTriggerClass}>
                                        <SelectValue placeholder="A - G" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-[#1a1a1a] border-white/20">
                                      {DPE_GES_LABELS.map((label) => (
                                        <SelectItem key={label} value={label} className="hover:bg-blue-500/10">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm ${DPE_COLORS[label]}`}>
                                              {label}
                                            </span>
                                            <span className="text-white">Classe {label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Heating & Year Built */}
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="heating_type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80 flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-orange-400" />
                                    Chauffage
                                  </FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl>
                                      <SelectTrigger className={premiumSelectTriggerClass}>
                                        <SelectValue placeholder="Type..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-[#1a1a1a] border-white/20">
                                      {HEATING_TYPES.map((type) => (
                                        <SelectItem key={type} value={type} className="hover:bg-blue-500/10">
                                          <span className="text-white">{HEATING_TYPE_LABELS[type]}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="year_built"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">Année de construction</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      placeholder="1985"
                                      {...field}
                                      value={field.value ?? ''}
                                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                      className={premiumInputClass}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Cadastral Reference */}
                          <FormField
                            control={form.control}
                            name="cadastral_ref"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white/80">Référence cadastrale</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="AB 123"
                                    {...field}
                                    value={field.value || ''}
                                    onChange={(e) => field.onChange(e.target.value || null)}
                                    className={premiumInputClass}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </TabsContent>

                      {/* TAB 3: Médias */}
                      <TabsContent value="medias" className="mt-0 space-y-6">
                        <div className="text-center py-12 text-muted-foreground">
                          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm font-medium text-white">Photos disponibles apres creation</p>
                          <p className="text-xs mt-2">
                            Enregistrez d'abord le bien, puis ajoutez des photos depuis la fiche du bien.
                          </p>
                        </div>
                      </TabsContent>
                    </div>

                    {/* Footer - Fixed */}
                    <div className="border-t border-white/10 p-6 flex justify-between items-center flex-shrink-0 bg-[#111111]">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-muted-foreground hover:text-white"
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 min-w-[140px]"
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Création...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Créer le bien
                          </>
                        )}
                      </Button>
                    </div>
                  </Tabs>
                </form>
              </Form>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
