import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import { PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS, TRANSACTION_TYPE_LABELS, PROPERTY_TYPES, PROPERTY_STATUSES, TRANSACTION_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { PropertyMatchingWidget } from '@/components/properties/PropertyMatchingWidget';
import { PropertyOwnerReport } from '@/components/properties/PropertyOwnerReport';
import { PropertyImageUpload } from '@/components/properties/PropertyImageUpload';
import {
  Pencil,
  Copy,
  Home,
  ChevronLeft,
  ChevronRight,
  Euro,
  Square,
  Bed,
  Calendar,
  MapPin,
  ExternalLink,
  Plus,
  User,
  UserCheck,
  Phone,
  Mail,
  Building2,
  Image as ImageIcon,
  X,
  Loader2,
  FileText,
  Maximize,
  Grid3X3,
  TrendingUp,
  Key,
  Heart,
  Trees,
  Store,
  Building,
  Castle,
  Car,
  Users,
  Activity,
  Briefcase,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Property = Tables<'properties'>;

interface ProposalWithContact {
  id: string;
  contact_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  template_id: string | null;
  contact: { full_name: string } | null;
}

interface ContactPartial {
  id: string;
  full_name: string;
  email: string | null;
}

interface ProfilePartial {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface PropertyWithRelations extends Property {
  owner?: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  agent?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface PropertyDetailsSheetProps {
  propertyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Premium status colors
const PREMIUM_STATUS_COLORS: Record<string, string> = {
  'disponible': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'sous_compromis': 'bg-purple-600/20 text-purple-300 border border-purple-600/30',
  'vendu': 'bg-blue-800/30 text-blue-200 border border-blue-800/40',
  'loue': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  'retire': 'bg-gray-600/20 text-gray-400 border border-gray-600/30',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  'disponible': 'bg-blue-400',
  'sous_compromis': 'bg-purple-400',
  'vendu': 'bg-blue-600',
  'loue': 'bg-purple-600',
  'retire': 'bg-gray-600',
};

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

const TRANSACTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  'vente': <TrendingUp className="w-4 h-4" />,
  'location': <Key className="w-4 h-4" />,
  'viager': <Heart className="w-4 h-4" />,
};

const DPE_BADGE_COLORS: Record<string, string> = {
  'A': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'B': 'bg-green-500/20 text-green-400 border border-green-500/30',
  'C': 'bg-lime-500/20 text-lime-400 border border-lime-500/30',
  'D': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  'E': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  'F': 'bg-red-500/20 text-red-400 border border-red-500/30',
  'G': 'bg-red-700/30 text-red-300 border border-red-700/40',
};

// Edit form schema
const editPropertySchema = z.object({
  title: z.string().min(5, 'Titre requis (min 5 caractères)').max(255),
  address: z.string().optional().nullable(),
  type: z.enum(['appartement', 'maison', 'terrain', 'commerce', 'bureau', 'immeuble', 'parking', 'autre']),
  status: z.enum(['disponible', 'sous_compromis', 'vendu', 'loue', 'retire']),
  transaction_type: z.string().optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  surface: z.number().min(0).optional().nullable(),
  rooms: z.number().min(0).optional().nullable(),
  bedrooms: z.number().min(0).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  dpe_label: z.string().max(1).optional().nullable(),
  ges_label: z.string().max(1).optional().nullable(),
  mandate_number: z.string().max(100).optional().nullable(),
  mandate_type: z.string().max(50).optional().nullable(),
  floor: z.number().min(0).max(200).optional().nullable(),
  total_floors: z.number().min(0).max(200).optional().nullable(),
  year_built: z.number().min(1800).max(2030).optional().nullable(),
  heating_type: z.string().max(100).optional().nullable(),
  co_ownership_charges: z.number().min(0).optional().nullable(),
  tax_property: z.number().min(0).optional().nullable(),
  cadastral_ref: z.string().max(50).optional().nullable(),
});

type EditPropertyFormValues = z.infer<typeof editPropertySchema>;

const premiumInputClass = "bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-white placeholder:text-white/40 transition-all duration-200 rounded-xl";
const premiumSelectTriggerClass = "bg-white/10 hover:bg-white/15 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-white transition-all duration-200 rounded-xl";

export default function PropertyDetailsSheet({ propertyId, open, onOpenChange }: PropertyDetailsSheetProps) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch property with relations
  const { data: property, isLoading, error } = useQuery<PropertyWithRelations>({
    queryKey: ['property', propertyId, organizationId],
    queryFn: async () => {
      if (!propertyId || !organizationId) throw new Error('Missing IDs');
      
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          owner:contacts!properties_contact_id_fkey (id, full_name, email, phone),
          agent:profiles!properties_assigned_to_fkey (id, full_name, avatar_url)
        `)
        .eq('id', propertyId)
        .eq('organization_id', organizationId)
        .single();
      
      if (error) throw error;
      return data as PropertyWithRelations;
    },
    enabled: !!propertyId && !!organizationId && open,
  });

  // Fetch contacts for owner selection
  const { data: contacts } = useQuery<ContactPartial[]>({
    queryKey: ['contacts-partial', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Missing organizationId');
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, email')
        .eq('organization_id', organizationId)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as ContactPartial[];
    },
    enabled: !!organizationId && editDialogOpen,
  });

  // Fetch profiles for agent selection
  const { data: profiles } = useQuery<ProfilePartial[]>({
    queryKey: ['profiles-partial', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Missing organizationId');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('organization_id', organizationId)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as ProfilePartial[];
    },
    enabled: !!organizationId && editDialogOpen,
  });

  // Fetch market stats for this property's postal code (read-only)
  const { data: marketStats } = useQuery({
    queryKey: ['market_stats_cache', property?.postal_code],
    queryFn: async () => {
      if (!property?.postal_code) return null;
      const { data, error } = await supabase
        .from('market_stats_cache')
        .select('avg_price_m2, median_price_m2, transaction_count, last_updated_at')
        .eq('postal_code', property.postal_code)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!property?.postal_code && open,
  });

  // Fetch property proposals with contact names
  const { data: proposals } = useQuery<ProposalWithContact[]>({
    queryKey: ['property_proposals', propertyId, organizationId],
    queryFn: async () => {
      if (!propertyId || !organizationId) return [];
      const { data, error } = await supabase
        .from('property_proposals')
        .select('id, contact_id, sent_at, opened_at, template_id, contact:contacts!property_proposals_contact_id_fkey(full_name)')
        .eq('property_id', propertyId)
        .eq('organization_id', organizationId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProposalWithContact[];
    },
    enabled: !!propertyId && !!organizationId && open,
  });

  const form = useForm<EditPropertyFormValues>({
    resolver: zodResolver(editPropertySchema),
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
      contact_id: null,
      assigned_to: null,
      description: null,
    },
  });

  // Reset form when property changes
  useEffect(() => {
    if (property) {
      form.reset({
        title: property.title,
        address: property.address,
        type: property.type || 'appartement',
        status: property.status || 'disponible',
        transaction_type: property.transaction_type || 'vente',
        price: property.price,
        surface: property.surface,
        rooms: property.rooms,
        bedrooms: property.bedrooms,
        contact_id: property.contact_id,
        assigned_to: property.assigned_to,
        description: property.description,
        dpe_label: property.dpe_label,
        ges_label: property.ges_label,
        mandate_number: property.mandate_number,
        mandate_type: property.mandate_type,
        floor: property.floor,
        total_floors: property.total_floors,
        year_built: property.year_built,
        heating_type: property.heating_type,
        co_ownership_charges: property.co_ownership_charges,
        tax_property: property.tax_property,
        cadastral_ref: property.cadastral_ref,
      });
    }
  }, [property, form]);

  const descriptionValue = form.watch('description') || '';

  // Scroll-based header auto-hide
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentScrollY = scrollContainer.scrollTop;

      // Show header when at top or scrolling up
      if (currentScrollY < 50 || currentScrollY < lastScrollY.current) {
        setHeaderVisible(true);
      }
      // Hide header when scrolling down and past threshold
      else if (currentScrollY > 100 && currentScrollY > lastScrollY.current) {
        setHeaderVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (values: EditPropertyFormValues) => {
      if (!propertyId || !organizationId) throw new Error('Missing IDs');
      
      const { error } = await supabase
        .from('properties')
        .update({
          title: values.title,
          address: values.address || null,
          type: values.type,
          status: values.status,
          transaction_type: values.transaction_type || null,
          price: values.price || null,
          surface: values.surface || null,
          rooms: values.rooms || null,
          bedrooms: values.bedrooms || null,
          contact_id: values.contact_id || null,
          assigned_to: values.assigned_to || null,
          description: values.description || null,
          dpe_label: values.dpe_label || null,
          ges_label: values.ges_label || null,
          mandate_number: values.mandate_number || null,
          mandate_type: values.mandate_type || null,
          floor: values.floor ?? null,
          total_floors: values.total_floors ?? null,
          year_built: values.year_built ?? null,
          heating_type: values.heating_type || null,
          co_ownership_charges: values.co_ownership_charges ?? null,
          tax_property: values.tax_property ?? null,
          cadastral_ref: values.cadastral_ref || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId)
        .eq('organization_id', organizationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId, organizationId] });
      queryClient.invalidateQueries({ queryKey: ['properties', organizationId] });
      setEditDialogOpen(false);
      toast.success('Bien mis à jour avec succès', {
        style: {
          background: 'linear-gradient(135deg, rgba(75, 139, 255, 0.9), rgba(124, 58, 237, 0.9))',
          border: 'none',
          color: 'white',
        }
      });
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour', {
        description: error.message,
        style: {
          background: 'rgba(124, 58, 237, 0.1)',
          borderColor: 'rgba(124, 58, 237, 0.3)',
          color: 'rgb(192, 132, 252)',
        }
      });
    },
  });

  // Images mutation (separate from form to allow immediate save)
  const imagesMutation = useMutation({
    mutationFn: async (newImages: string[]) => {
      if (!propertyId || !organizationId) throw new Error('Missing IDs');
      const { error } = await supabase
        .from('properties')
        .update({ images: newImages, updated_at: new Date().toISOString() })
        .eq('id', propertyId)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId, organizationId] });
      queryClient.invalidateQueries({ queryKey: ['properties', organizationId] });
    },
    onError: (error) => {
      toast.error('Erreur de mise a jour des photos', { description: error.message });
    },
  });

  // Photo carousel
  const photos = useMemo(() => property?.images || [], [property]);
  const hasPhotos = photos.length > 0;

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const copyAddress = async () => {
    if (property?.address) {
      await navigator.clipboard.writeText(property.address);
      toast.success('Adresse copiée', {
        style: {
          background: 'linear-gradient(135deg, rgba(75, 139, 255, 0.9), rgba(124, 58, 237, 0.9))',
          border: 'none',
          color: 'white',
        }
      });
    }
  };

  const openGoogleMaps = () => {
    if (property?.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`, '_blank');
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Custom Premium Overlay with blur */}
        <DialogOverlay className="bg-black/60 backdrop-blur-md">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
        </DialogOverlay>
        
        <DialogContent 
          className="w-[min(1600px,95vw)] max-h-[90vh] overflow-hidden p-0 rounded-2xl border border-white/10 bg-[#111111]/95 shadow-2xl backdrop-blur-xl data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out"
        >
          {isLoading ? (
            <div className="p-8 space-y-6 overflow-y-auto max-h-[85vh]">
              <Skeleton className="h-8 w-2/3 bg-white/10" />
              <Skeleton className="h-4 w-1/2 bg-white/10" />
              <Skeleton className="h-64 w-full bg-white/10 rounded-xl" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 bg-white/10 rounded-xl" />
                <Skeleton className="h-24 bg-white/10 rounded-xl" />
                <Skeleton className="h-24 bg-white/10 rounded-xl" />
                <Skeleton className="h-24 bg-white/10 rounded-xl" />
              </div>
            </div>
          ) : error || !property ? (
            <div className="p-8">
              <EmptyState
                icon={Home}
                iconGradient="from-blue-500/20 to-purple-500/20"
                title="Bien introuvable"
                description="Ce bien n'existe pas ou vous n'avez pas accès à cette fiche."
                action={{
                  label: "Fermer",
                  onClick: () => onOpenChange(false),
                  icon: <X className="w-5 h-5" />
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col max-h-[90vh] overflow-hidden">
              {/* Sticky Header */}
              <motion.div
                className="relative z-10 bg-[#111111]/95 backdrop-blur-xl border-b border-white/10 overflow-hidden"
                animate={{
                  height: headerVisible ? 'auto' : 0,
                  opacity: headerVisible ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 md:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white mb-2 line-clamp-2">
                        {property.title || property.address || 'Bien sans titre'}
                      </h2>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {property.owner && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-blue-400" />
                            {property.owner.full_name}
                          </span>
                        )}
                        {property.owner && property.agent && (
                          <span className="text-white/20">•</span>
                        )}
                        {property.agent && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-purple-400" />
                            {property.agent.full_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        {property.type && (
                          <Badge variant="outline" className="shrink-0 border-blue-500/30 text-blue-400">
                            {PROPERTY_TYPE_ICONS[property.type]}
                            <span className="ml-1">{PROPERTY_TYPE_LABELS[property.type as keyof typeof PROPERTY_TYPE_LABELS]}</span>
                          </Badge>
                        )}
                        {property.status && (
                          <Badge className={`shrink-0 ${PREMIUM_STATUS_COLORS[property.status]}`}>
                            {PROPERTY_STATUS_LABELS[property.status as keyof typeof PROPERTY_STATUS_LABELS]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 shrink-0">
                      <PropertyOwnerReport property={property} />
                      <Button 
                        onClick={() => setEditDialogOpen(true)}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      <Button 
                        variant="outline" 
                        className="border-white/20 hover:bg-white/10"
                        onClick={copyAddress}
                        disabled={!property.address}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copier
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Scrollable Content */}
              <div ref={scrollContainerRef} className="overflow-y-auto flex-1 min-h-0 p-4 md:p-5 space-y-8">
                {/* Photo Carousel */}
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg shadow-blue-500/5">
                  {hasPhotos ? (
                    <>
                      <div 
                        className="relative aspect-video cursor-pointer"
                        onClick={() => setLightboxOpen(true)}
                      >
                        <img 
                          src={photos[currentPhotoIndex]} 
                          alt={`Photo ${currentPhotoIndex + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {photos.length > 1 && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
                            >
                              <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
                            >
                              <ChevronRight className="w-5 h-5 text-white" />
                            </button>
                          </>
                        )}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {photos.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(idx); }}
                              className={`w-2 h-2 rounded-full transition-colors ${idx === currentPhotoIndex ? 'bg-blue-400' : 'bg-white/50'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {photos.length > 1 && (
                        <div className="flex gap-2 p-3 overflow-x-auto">
                          {photos.map((photo, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentPhotoIndex(idx)}
                              className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${idx === currentPhotoIndex ? 'border-blue-500' : 'border-transparent'}`}
                            >
                              <img src={photo} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                      {organizationId && propertyId ? (
                        <PropertyImageUpload
                          propertyId={propertyId}
                          organizationId={organizationId}
                          existingImages={[]}
                          onImagesChange={(images) => imagesMutation.mutate(images)}
                        />
                      ) : (
                        <div className="aspect-video flex flex-col items-center justify-center">
                          <ImageIcon className="w-16 h-16 text-blue-400/30 mb-4" />
                          <p className="text-muted-foreground">Aucune photo</p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Upload strip below existing carousel */}
                  {hasPhotos && organizationId && propertyId && (
                    <div className="p-4 border-t border-white/10">
                      <PropertyImageUpload
                        propertyId={propertyId}
                        organizationId={organizationId}
                        existingImages={photos}
                        onImagesChange={(images) => imagesMutation.mutate(images)}
                      />
                    </div>
                  )}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 hover:bg-white/10 transition-all hover:scale-[1.01]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Euro className="w-3 h-3 text-blue-400" />
                        Prix
                      </div>
                      <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {property.price ? formatCurrency(property.price) : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-[1.01]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Square className="w-3 h-3 text-purple-400" />
                        Surface
                      </div>
                      <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {property.surface ? `${formatNumber(property.surface)} m²` : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-[1.01]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Bed className="w-3 h-3 text-blue-400" />
                        Pièces / Chambres
                      </div>
                      <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {property.rooms || '–'} / {property.bedrooms || '–'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-[1.01]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Calendar className="w-3 h-3 text-purple-400" />
                        Créé le
                      </div>
                      <p className="text-sm font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {formatDate(property.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="w-full bg-white/5 border border-white/10 rounded-xl p-1">
                    <TabsTrigger value="details" className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500">
                      Détails
                    </TabsTrigger>
                    <TabsTrigger value="description" className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500">
                      Description
                    </TabsTrigger>
                    <TabsTrigger value="attribution" className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500">
                      Attribution
                    </TabsTrigger>
                    <TabsTrigger value="propositions" className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500">
                      Propositions
                      {proposals && proposals.length > 0 && (
                        <span className="ml-1.5 bg-blue-500/30 text-blue-300 text-xs px-1.5 py-0.5 rounded-full">
                          {proposals.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                      {property.address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-blue-400 mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Adresse</p>
                            <p className="text-white">{property.address}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 text-purple-400 mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Type</p>
                          <p className="text-white">{PROPERTY_TYPE_LABELS[property.type as keyof typeof PROPERTY_TYPE_LABELS] || 'Non défini'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Activity className="w-4 h-4 text-blue-400 mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Statut</p>
                          <Badge className={`mt-1 ${PREMIUM_STATUS_COLORS[property.status || '']}`}>
                            {PROPERTY_STATUS_LABELS[property.status as keyof typeof PROPERTY_STATUS_LABELS] || 'Non défini'}
                          </Badge>
                        </div>
                      </div>
                      {property.transaction_type && (
                        <div className="flex items-start gap-3">
                          <TrendingUp className="w-4 h-4 text-purple-400 mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Transaction</p>
                            <p className="text-white">{TRANSACTION_TYPE_LABELS[property.transaction_type as keyof typeof TRANSACTION_TYPE_LABELS] || property.transaction_type}</p>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="flex items-start gap-3">
                          <Euro className="w-4 h-4 text-blue-400 mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Prix</p>
                            <p className="text-white font-semibold">{property.price ? formatCurrency(property.price) : 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Maximize className="w-4 h-4 text-purple-400 mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Surface</p>
                            <p className="text-white">{property.surface ? `${formatNumber(property.surface)} m²` : 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Grid3X3 className="w-4 h-4 text-blue-400 mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Pièces</p>
                            <p className="text-white">{property.rooms || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Bed className="w-4 h-4 text-purple-400 mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Chambres</p>
                            <p className="text-white">{property.bedrooms || 'N/A'}</p>
                          </div>
                        </div>
                        {property.floor != null && (
                          <div className="flex items-start gap-3">
                            <Building2 className="w-4 h-4 text-blue-400 mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Étage</p>
                              <p className="text-white">Étage {property.floor}{property.total_floors != null ? ` / ${property.total_floors}` : ''}</p>
                            </div>
                          </div>
                        )}
                        {property.year_built != null && (
                          <div className="flex items-start gap-3">
                            <Calendar className="w-4 h-4 text-purple-400 mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Année de construction</p>
                              <p className="text-white">{property.year_built}</p>
                            </div>
                          </div>
                        )}
                        {property.heating_type && (
                          <div className="flex items-start gap-3">
                            <Home className="w-4 h-4 text-blue-400 mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Chauffage</p>
                              <p className="text-white">{property.heating_type}</p>
                            </div>
                          </div>
                        )}
                        {property.co_ownership_charges != null && property.co_ownership_charges > 0 && (
                          <div className="flex items-start gap-3">
                            <Euro className="w-4 h-4 text-purple-400 mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Charges de copropriété</p>
                              <p className="text-white">{formatCurrency(property.co_ownership_charges)}/mois</p>
                            </div>
                          </div>
                        )}
                        {property.tax_property != null && property.tax_property > 0 && (
                          <div className="flex items-start gap-3">
                            <Euro className="w-4 h-4 text-blue-400 mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Taxe foncière</p>
                              <p className="text-white">{formatCurrency(property.tax_property)}/an</p>
                            </div>
                          </div>
                        )}
                        {property.cadastral_ref && (
                          <div className="flex items-start gap-3">
                            <FileText className="w-4 h-4 text-purple-400 mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Référence cadastrale</p>
                              <p className="text-white font-mono text-sm">{property.cadastral_ref}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Performance Énergétique */}
                      {property.dpe_label && (
                        <div className="pt-4 border-t border-white/10 space-y-3">
                          <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Performance Énergétique</h4>
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge className={`text-sm px-3 py-1 ${DPE_BADGE_COLORS[property.dpe_label.toUpperCase()] || 'bg-white/10 text-white/70 border border-white/20'}`}>
                              DPE · {property.dpe_label.toUpperCase()}
                            </Badge>
                            {property.ges_label && (
                              <Badge className={`text-sm px-3 py-1 ${DPE_BADGE_COLORS[property.ges_label.toUpperCase()] || 'bg-white/10 text-white/70 border border-white/20'}`}>
                                GES · {property.ges_label.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          {property.energy_rating && (
                            <p className="text-sm text-muted-foreground">Conso : {property.energy_rating}</p>
                          )}
                        </div>
                      )}

                      {/* Mandat */}
                      {(property.mandate_number || property.mandate_type) && (
                        <div className="pt-4 border-t border-white/10 space-y-3">
                          <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Mandat</h4>
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5">
                            <Key className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="text-white text-sm">
                              Mandat {property.mandate_type || '—'} n°{property.mandate_number || '—'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="description" className="mt-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                      {property.description ? (
                        <p className="text-white whitespace-pre-wrap">{property.description}</p>
                      ) : (
                        <p className="text-muted-foreground italic">Aucune description</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="attribution" className="mt-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
                      {/* Owner */}
                      <div>
                        <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">Propriétaire</h4>
                        {property.owner ? (
                          <div className="flex items-center gap-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-lg font-semibold text-white">
                              {getInitials(property.owner.full_name)}
                            </div>
                            <div className="flex-1">
                              <p className="text-white font-medium">{property.owner.full_name}</p>
                              <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                                {property.owner.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-blue-400" />
                                    {property.owner.email}
                                  </span>
                                )}
                                {property.owner.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-purple-400" />
                                    {property.owner.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic">Aucun propriétaire assigné</p>
                        )}
                      </div>

                      {/* Agent */}
                      <div>
                        <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Agent assigné</h4>
                        {property.agent ? (
                          <div className="flex items-center gap-4 p-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-lg font-semibold text-white">
                              {getInitials(property.agent.full_name)}
                            </div>
                            <p className="text-white font-medium">{property.agent.full_name || 'Agent'}</p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic">Aucun agent assigné</p>
                        )}
                      </div>

                      {/* Timestamps */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div>
                          <p className="text-xs text-muted-foreground">Créé le</p>
                          <p className="text-white text-sm">{formatDate(property.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Modifié le</p>
                          <p className="text-white text-sm">{formatDate(property.updated_at)}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="propositions" className="mt-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                      {!proposals || proposals.length === 0 ? (
                        <p className="text-muted-foreground italic text-sm text-center py-4">
                          Aucune proposition envoyée pour ce bien
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {proposals.map((proposal) => (
                            <div
                              key={proposal.id}
                              className="flex items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-xl"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white font-medium text-sm truncate">
                                    {proposal.contact?.full_name ?? 'Contact supprimé'}
                                  </p>
                                  {proposal.sent_at && (
                                    <p className="text-xs text-muted-foreground">
                                      Envoyée le {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(proposal.sent_at))}
                                    </p>
                                  )}
                                  {proposal.opened_at && (
                                    <p className="text-xs text-blue-400">
                                      Ouvert le {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(proposal.opened_at))}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge className={`shrink-0 ${
                                proposal.opened_at
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {proposal.opened_at ? 'Vue ✓' : 'Envoyée'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Market Stats */}
                {(() => {
                  const pricePerM2 = property.price && property.surface
                    ? property.price / property.surface
                    : null;
                  const marketDelta = pricePerM2 && marketStats?.avg_price_m2
                    ? ((pricePerM2 - marketStats.avg_price_m2) / marketStats.avg_price_m2) * 100
                    : null;
                  return (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-lg shadow-blue-500/5">
                      <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Marché Local
                      </h4>
                      {marketStats ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                              <p className="text-xs text-muted-foreground mb-1">Prix moyen/m²</p>
                              <p className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                {formatNumber(Math.round(marketStats.avg_price_m2))} €/m²
                              </p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                              <p className="text-xs text-muted-foreground mb-1">Prix médian/m²</p>
                              <p className="text-lg font-bold text-white">
                                {formatNumber(Math.round(marketStats.median_price_m2))} €/m²
                              </p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                              <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                              <p className="text-lg font-bold text-white">
                                {formatNumber(marketStats.transaction_count)}
                              </p>
                            </div>
                          </div>
                          {marketDelta !== null && (
                            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                              Math.abs(marketDelta) <= 5
                                ? 'bg-white/5 text-white/70'
                                : marketDelta > 0
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              <TrendingUp className="w-4 h-4 shrink-0" />
                              <span>
                                {Math.abs(marketDelta) <= 5
                                  ? '≈ dans la moyenne du marché'
                                  : marketDelta > 0
                                    ? `+${Math.round(marketDelta)}% vs marché`
                                    : `${Math.round(marketDelta)}% vs marché`}
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Données du {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(marketStats.last_updated_at))}
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-sm">
                          Données marché non disponibles pour ce secteur
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Smart Matching Widget */}
                <PropertyMatchingWidget
                  property={property} 
                  onContactBuyer={(contactId) => {
                    toast.success('Activité enregistrée', {
                      description: 'La proposition a été loguée dans les activités'
                    });
                  }}
                />

                {/* Quick Actions */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Actions rapides</h4>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      variant="outline" 
                      className="border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/activities?property_id=${property.id}`);
                      }}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Créer une activité
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/deals?property_id=${property.id}`);
                      }}
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      Créer une opportunité
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-white/20 hover:bg-white/10"
                      onClick={openGoogleMaps}
                      disabled={!property.address}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Google Maps
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl h-[90vh] bg-black/95 border-white/10 p-0">
          {hasPhotos && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={photos[currentPhotoIndex]} 
                alt={`Photo ${currentPhotoIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                </>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                {currentPhotoIndex + 1} / {photos.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#111111] border-white/10 backdrop-blur-xl shadow-2xl shadow-black/50 rounded-xl p-0">
          <DialogHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-8 pb-6 border-b border-white/10">
            <DialogTitle className="text-2xl font-semibold text-white flex items-center gap-3">
              <Pencil className="w-6 h-6 text-blue-400" />
              Modifier le bien
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="p-8 space-y-8">
              
              {/* Section 1: Infos principales */}
              <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Informations principales</h3>
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Titre <span className="text-blue-400">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} className={premiumInputClass} />
                      </FormControl>
                      <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-400" />
                        Adresse
                      </FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} className={premiumInputClass} />
                      </FormControl>
                      <FormMessage className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Type</FormLabel>
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
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Statut</FormLabel>
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
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="transaction_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Transaction</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'vente'}>
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
                    </FormItem>
                  )}
                />
              </div>

              {/* Section 2: Caractéristiques */}
              <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">Caractéristiques</h3>
                
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Prix (€)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                          <Input 
                            type="number"
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

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="surface"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Surface m²</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            className={premiumInputClass}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Pièces</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            className={premiumInputClass}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Chambres</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
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
              </div>

              {/* Section 2.5: Détails techniques */}
              <div className="border-l-2 border-blue-400/40 pl-4 bg-blue-400/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Détails techniques</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mandate_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Type de mandat</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="Exclusif, simple…" className={premiumInputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mandate_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">N° de mandat</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} className={premiumInputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dpe_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">DPE (A-G)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} maxLength={1} placeholder="A" className={`${premiumInputClass} uppercase`} onChange={(e) => field.onChange(e.target.value.toUpperCase() || null)} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ges_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">GES (A-G)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} maxLength={1} placeholder="A" className={`${premiumInputClass} uppercase`} onChange={(e) => field.onChange(e.target.value.toUpperCase() || null)} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="floor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Étage</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} className={premiumInputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="total_floors"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Nb. étages</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} className={premiumInputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="year_built"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Année de construction</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} placeholder="2005" onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} className={premiumInputClass} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="heating_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Chauffage</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="Gaz collectif, électrique…" className={premiumInputClass} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="co_ownership_charges"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Charges copro (€/mois)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} className={premiumInputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tax_property"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Taxe foncière (€/an)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} className={premiumInputClass} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cadastral_ref"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Référence cadastrale</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="AB 1234" className={`${premiumInputClass} font-mono`} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Section 3: Photos */}
              <div className="border-l-2 border-blue-400/30 pl-4 bg-blue-400/5 rounded-r-xl py-4 pr-4 space-y-4">
                <h3 className="text-sm font-semibold text-blue-400/80 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Photos
                </h3>
                {organizationId && propertyId && (
                  <PropertyImageUpload
                    propertyId={propertyId}
                    organizationId={organizationId}
                    existingImages={property?.images || []}
                    onImagesChange={(images) => imagesMutation.mutate(images)}
                  />
                )}
              </div>

              {/* Section 3: Attribution */}
              <div className="border-l-2 border-blue-500/30 pl-4 bg-white/5 rounded-r-xl py-4 pr-4 space-y-6">
                <h3 className="text-sm font-semibold text-blue-400/80 uppercase tracking-wider mb-4">Attribution</h3>
                
                <FormField
                  control={form.control}
                  name="contact_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        Propriétaire
                      </FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === 'none' ? null : val)} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger className={premiumSelectTriggerClass}>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-[#1a1a1a] border-white/20">
                          <SelectItem value="none" className="hover:bg-blue-500/10 text-white">Aucun</SelectItem>
                          {contacts?.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="hover:bg-blue-500/10 text-white">
                              {c.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-purple-400" />
                        Agent assigné
                      </FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === 'none' ? null : val)} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger className={premiumSelectTriggerClass}>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-[#1a1a1a] border-white/20">
                          <SelectItem value="none" className="hover:bg-blue-500/10 text-white">Aucun</SelectItem>
                          {profiles?.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="hover:bg-blue-500/10 text-white">
                              {p.full_name || p.email || 'Agent'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

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
                          {...field}
                          value={field.value || ''}
                          rows={5}
                          maxLength={2000}
                          className={`${premiumInputClass} min-h-[100px]`}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 font-semibold text-white tracking-wide transition-all duration-200 hover:scale-[1.02] rounded-xl h-12" 
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Enregistrer les modifications'
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
