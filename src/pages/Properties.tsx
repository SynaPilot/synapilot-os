import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PropertyCardSkeleton } from '@/components/skeletons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Plus,
  Search,
  Home,
  Bed,
  Square,
  Building2,
  Upload,
  Camera,
  MapPin,
  Share2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { GuidedEmptyState } from '@/components/GuidedEmptyState';
import { EmptyState } from '@/components/EmptyState';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { PROPERTY_STATUSES, PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';
import PropertyDetailsSheet from '@/components/properties/PropertyDetailsSheet';
import { PropertyFormDialog } from '@/components/properties/PropertyFormDialog';
import { PropertyComplianceAudit } from '@/components/properties/PropertyComplianceAudit';

type Property = Tables<'properties'>;
type Contact = Tables<'contacts'>;

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

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function getDpeStatus(dpeLabel: string | null): 'critical' | 'warning' | 'ok' {
  if (!dpeLabel) return 'warning';
  const upper = dpeLabel.trim().toUpperCase();
  if (upper === 'F' || upper === 'G') return 'critical';
  return 'ok';
}

function DpeAuditIcon({ dpeLabel }: { dpeLabel: string | null }) {
  const status = getDpeStatus(dpeLabel);
  if (status === 'critical') return <ShieldAlert className="w-4 h-4" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4" />;
  return <ShieldCheck className="w-4 h-4" />;
}

function getDpeAuditStyle(dpeLabel: string | null): string {
  const status = getDpeStatus(dpeLabel);
  if (status === 'critical') return 'border-red-500/40 text-red-400 hover:bg-red-500/10';
  if (status === 'warning') return 'border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10';
  return 'border-green-500/40 text-green-400 hover:bg-green-500/10';
}

function PropertyKpiBar({ properties }: { properties: Property[] | undefined }) {
  const counts = {
    disponible:     properties?.filter(p => p.status === 'disponible').length ?? 0,
    sous_compromis: properties?.filter(p => p.status === 'sous_compromis').length ?? 0,
    vendu:          properties?.filter(p => p.status === 'vendu').length ?? 0,
    total:          properties?.length ?? 0,
  };
  const totalValue = properties
    ?.filter(p => p.status === 'disponible' && p.price)
    .reduce((sum, p) => sum + (p.price ?? 0), 0) ?? 0;

  const chips = [
    { label: 'Disponibles',        value: String(counts.disponible),         color: 'text-blue-400' },
    { label: 'Sous compromis',     value: String(counts.sous_compromis),      color: 'text-purple-400' },
    { label: 'Vendus',             value: String(counts.vendu),               color: 'text-blue-200' },
    { label: 'Valeur portefeuille', value: formatCurrency(totalValue),        color: 'text-primary font-mono' },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {chips.map((chip, i) => (
        <motion.div
          key={chip.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.06 }}
          className="flex items-center gap-2 border border-white/10 bg-white/5 rounded-xl px-4 py-2"
        >
          <span className="text-xs text-muted-foreground">{chip.label}</span>
          <span className={`text-sm font-semibold ${chip.color}`}>{chip.value}</span>
        </motion.div>
      ))}
    </div>
  );
}

function PropertyThumbnail({ images }: { images: string[] | null }) {
  const firstImage = images?.[0] ?? null;

  if (firstImage) {
    return (
      <div className="h-36 overflow-hidden relative">
        <img
          src={firstImage}
          alt="Photo du bien"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            e.currentTarget.parentElement
              ?.querySelector('.thumb-fallback')
              ?.classList.remove('hidden');
          }}
        />
        <div className="thumb-fallback hidden h-full w-full absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
          <Home className="w-10 h-10 text-blue-400/40" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
        {(images?.length ?? 0) > 1 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-xs font-mono">
            <Camera className="w-3 h-3" />
            {images!.length}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-36 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
      <Home className="w-10 h-10 text-blue-400/40" />
    </div>
  );
}

function PropertyCard({ property, index, onClick, onAudit }: { property: Property; index: number; onClick: () => void; onAudit: () => void }) {
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
        <PropertyThumbnail images={property.images} />
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <Badge className={`text-xs ${getStatusColor(property.status)}`}>
              {PROPERTY_STATUS_LABELS[property.status as keyof typeof PROPERTY_STATUS_LABELS] || property.status}
            </Badge>
            <div className="flex items-center gap-1.5">
              {property.type && <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">{PROPERTY_TYPE_LABELS[property.type as keyof typeof PROPERTY_TYPE_LABELS] || property.type}</Badge>}
              {property.transaction_type && (
                <Badge variant="outline" className="text-xs border-blue-500/20 text-blue-300">
                  {property.transaction_type === 'vente' ? 'Vente' :
                   property.transaction_type === 'location' ? 'Location' :
                   property.transaction_type}
                </Badge>
              )}
            </div>
          </div>
          <p className="font-medium text-sm line-clamp-2 mb-1">{property.title || 'Bien sans titre'}</p>
          {(property.city || property.address) && (
            <p className="text-xs text-muted-foreground line-clamp-1 mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {property.city || property.address}
            </p>
          )}
          <p className="text-lg font-semibold text-blue-400 mb-1">
            {property.price ? formatCurrency(property.price) : 'Prix non défini'}
          </p>
          {property.price && property.surface && property.price > 0 && property.surface > 0 && (
            <p className="text-xs text-muted-foreground font-mono -mt-0 mb-3">
              {formatNumber(Math.round(property.price / property.surface))} €/m²
            </p>
          )}
          <div className="flex items-center justify-between">
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
            <Button
              variant="outline"
              size="sm"
              className={`text-xs gap-1.5 ${getDpeAuditStyle(property.dpe_label)}`}
              onClick={(e) => {
                e.stopPropagation();
                onAudit();
              }}
            >
              <DpeAuditIcon dpeLabel={property.dpe_label} />
              Audit
            </Button>
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
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [auditProperty, setAuditProperty] = useState<Property | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'price_asc' | 'price_desc' | 'surface'>('date');
  const { organizationId } = useAuth();

  const { data: properties, isLoading } = useOrgQuery<Property[]>('properties', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Fetch all contacts for owner selection
  const { data: contacts } = useOrgQuery<Contact[]>('contacts', {
    select: 'id, full_name, email, role',
    orderBy: { column: 'full_name', ascending: true }
  });

  const filteredProperties = properties?.filter((p) => {
    const matchesSearch = (p.address?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (p.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                          (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedProperties = [...(filteredProperties ?? [])].sort((a, b) => {
    if (sortBy === 'price_asc')  return (a.price ?? 0) - (b.price ?? 0);
    if (sortBy === 'price_desc') return (b.price ?? 0) - (a.price ?? 0);
    if (sortBy === 'surface')    return (b.surface ?? 0) - (a.surface ?? 0);
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
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
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau bien
        </Button>
      </div>

      {/* Property Form Dialog */}
      <PropertyFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        contacts={contacts}
      />

      {/* KPI Bar */}
      <PropertyKpiBar properties={properties} />

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
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Plus récents</SelectItem>
            <SelectItem value="price_desc">Prix décroissant</SelectItem>
            <SelectItem value="price_asc">Prix croissant</SelectItem>
            <SelectItem value="surface">Surface</SelectItem>
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
      ) : !properties || properties.length === 0 ? (
        /* Empty state - no properties at all (welcome screen) */
        <GuidedEmptyState
          variant="properties"
          onPrimaryAction={() => setIsDialogOpen(true)}
        />
      ) : filteredProperties?.length === 0 ? (
        /* Empty state - no results after filtering */
        <EmptyState
          icon={Search}
          iconGradient="from-purple-500/20 to-blue-500/20"
          title="Aucun bien trouvé"
          description="Essayez de modifier vos critères de recherche ou réinitialisez les filtres."
          action={{
            label: "Réinitialiser les filtres",
            onClick: () => {
              setSearchQuery('');
              setStatusFilter('all');
            },
            icon: <RefreshCw className="w-5 h-5" />
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedProperties.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              index={index}
              onClick={() => {
                setSelectedPropertyId(property.id);
                setIsSheetOpen(true);
              }}
              onAudit={() => setAuditProperty(property)}
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

      {/* Audit de Conformité Sheet */}
      <Sheet open={!!auditProperty} onOpenChange={(open) => { if (!open) setAuditProperty(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg md:max-w-xl overflow-y-auto border-white/10 bg-[#111111]/95 backdrop-blur-xl"
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              Audit : {auditProperty?.title || 'Bien sans titre'}
            </SheetTitle>
            <SheetDescription>
              Diagnostic de conformité énergétique (DPE / GES)
            </SheetDescription>
          </SheetHeader>
          {auditProperty && (
            <PropertyComplianceAudit property={auditProperty} />
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
