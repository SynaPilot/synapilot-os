import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanColumnSkeleton, ContactCardSkeleton } from '@/components/skeletons';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, Search, Phone, Mail, User, Loader2, Upload, TrendingUp, Users, Target, 
  ExternalLink, UserPlus, Home, Key, Globe, FileText, LayoutList, LayoutGrid,
  ArrowUpDown, Filter, Clock, Flame, UserX, CalendarClock, ChevronDown,
  Calendar, MapPin, ArrowUpRight, MoreHorizontal
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { SmartBadges } from '@/components/SmartBadges';
import { getContactBadges } from '@/lib/smart-features';
import { useOrgQuery } from '@/hooks/useOrgQuery';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, CONTACT_ROLES, CONTACT_ROLE_LABELS, type PipelineStage, type ContactRole } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;

// ==================== SCHEMA ====================
const contactSchema = z.object({
  full_name: z.string().min(2, 'Nom requis').max(100),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  role: z.enum(['vendeur', 'acheteur', 'vendeur_acheteur', 'locataire', 'proprietaire', 'prospect', 'partenaire', 'notaire', 'banquier', 'autre']).optional(),
  urgency_score: z.number().min(0).max(10).default(0),
  source: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

// ==================== TYPES ====================
type ViewMode = 'list' | 'kanban';
type SortOption = 'followup' | 'urgency' | 'name' | 'last_contact';
type FilterOption = 'all' | 'overdue' | 'hot' | 'unassigned' | 'vendeur' | 'acheteur';

// ==================== UTILS ====================
const isToday = (date: string | null) => {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

const isOverdue = (date: string | null) => {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

const isSoon = (date: string | null) => {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return d > today && d <= weekFromNow;
};

const formatFollowUpDate = (date: string | null) => {
  if (!date) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(date));
};

const formatLastContact = (date: string | null) => {
  if (!date) return 'Jamais';
  return formatRelativeTime(date);
};

// ==================== ANIMATION VARIANTS ====================
const pageVariants = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const staggerContainer = { animate: { transition: { staggerChildren: 0.03 } } };
const staggerItem = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

// ==================== CONTACT CARD (KANBAN) ====================
function ContactCard({ contact, isDragging, onClick }: { contact: Contact; isDragging?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  const badges = getContactBadges({ last_contact_date: contact.updated_at });
  const urgencyScore = contact.urgency_score || 0;
  const isHot = urgencyScore >= 8;
  const overdueStatus = isOverdue(contact.next_followup_date);
  const todayStatus = isToday(contact.next_followup_date);

  return (
    <motion.div
      whileHover={!isDragging ? { scale: 1.02, y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={onClick}
    >
      <Card className={cn(
        'border-white/10 bg-white/5 transition-all duration-200',
        isDragging 
          ? 'opacity-60 scale-105 shadow-glow rotate-2 border-primary/40' 
          : 'hover:border-primary/30 hover:bg-white/10 cursor-pointer'
      )}>
        <CardContent className="p-3 space-y-2">
          {/* Name & Role */}
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm truncate">{contact.full_name}</p>
            {contact.role && (
              <Badge variant="outline" className="text-[10px] shrink-0 border-white/20">
                {CONTACT_ROLE_LABELS[contact.role as ContactRole]}
              </Badge>
            )}
          </div>
          
          {/* Urgency Bar */}
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${urgencyScore * 10}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={cn(
                urgencyScore <= 3 ? 'text-blue-400' : urgencyScore <= 6 ? 'text-purple-400' : 'text-purple-500'
              )}>
                {urgencyScore <= 3 ? 'Froid' : urgencyScore <= 6 ? 'Tiède' : 'Chaud'}
              </span>
              {isHot && <Flame className="w-3 h-3 text-purple-500" />}
            </div>
          </div>
          
          {/* Follow-up Badge */}
          <div className="flex items-center justify-between gap-2">
            {overdueStatus ? (
              <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">
                En retard
              </Badge>
            ) : todayStatus ? (
              <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">
                Aujourd'hui
              </Badge>
            ) : contact.next_followup_date ? (
              <Badge variant="outline" className="text-[10px] border-white/20">
                {formatFollowUpDate(contact.next_followup_date)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-blue-400/30 text-blue-400">
                À planifier
              </Badge>
            )}
            
            {/* Quick Actions on Hover */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded">
                  <Phone className="w-3 h-3 text-blue-400" />
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded">
                  <Mail className="w-3 h-3 text-purple-400" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==================== SORTABLE CONTACT CARD ====================
function SortableContactCard({ contact, onNavigate }: { contact: Contact; onNavigate: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: contact.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      e.stopPropagation();
      onNavigate(contact.id);
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing group">
      <ContactCard contact={contact} isDragging={isDragging} onClick={handleClick} />
    </div>
  );
}

// ==================== KANBAN COLUMN ====================
function KanbanColumn({ stage, contacts, onNavigate }: { stage: PipelineStage; contacts: Contact[]; onNavigate: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}` });

  // Only use blue/violet gradient for stage colors
  const getStageGradient = (index: number) => {
    const gradients = [
      'from-blue-500/80 to-blue-500/40',
      'from-blue-400/80 to-purple-500/40',
      'from-purple-500/80 to-purple-400/40',
      'from-purple-400/80 to-blue-500/40',
    ];
    return gradients[index % gradients.length];
  };

  const stageIndex = PIPELINE_STAGES.indexOf(stage);

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-72 rounded-xl bg-white/5 border transition-all duration-200',
        isOver ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/30 shadow-glow' : 'border-white/10'
      )}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full bg-gradient-to-r', getStageGradient(stageIndex))} />
            <h3 className="font-medium text-sm">{PIPELINE_STAGE_LABELS[stage]}</h3>
          </div>
          <Badge variant="outline" className="text-xs font-mono border-white/20">
            {contacts.length}
          </Badge>
        </div>
      </div>
      
      {/* Cards Container */}
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-420px)] overflow-y-auto">
        <SortableContext items={contacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {contacts.map((contact) => (
              <motion.div key={contact.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                <SortableContactCard contact={contact} onNavigate={onNavigate} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
        
        {contacts.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg">
            Glissez un contact ici
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== CONTACT ROW (LIST VIEW) ====================
function ContactRow({ contact, onNavigate, index }: { contact: Contact; onNavigate: (id: string) => void; index: number }) {
  const urgencyScore = contact.urgency_score || 0;
  const isHot = urgencyScore >= 8;
  const overdueStatus = isOverdue(contact.next_followup_date);
  const todayStatus = isToday(contact.next_followup_date);
  const neverContacted = !contact.last_contact_date && isHot;

  const getUrgencyLabel = (score: number) => {
    if (score <= 3) return { label: 'Froid', color: 'text-blue-400' };
    if (score <= 6) return { label: 'Tiède', color: 'text-purple-400' };
    return { label: 'Chaud', color: 'text-purple-500' };
  };

  const urgencyInfo = getUrgencyLabel(urgencyScore);

  return (
    <motion.div
      variants={staggerItem}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.02 }}
      className="group"
    >
      <Card 
        className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all duration-200 cursor-pointer"
        onClick={() => onNavigate(contact.id)}
      >
        <CardContent className="p-4">
          <div className="grid grid-cols-12 gap-4 items-center">
            {/* Col 1: Identity (4 cols) */}
            <div className="col-span-12 md:col-span-4 flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-white">
                  {contact.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{contact.full_name}</p>
                  {contact.role && (
                    <Badge variant="outline" className="text-[10px] border-white/20 shrink-0">
                      {CONTACT_ROLE_LABELS[contact.role as ContactRole]}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {contact.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 shrink-0" />{contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 shrink-0" />{contact.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Col 2: Priority & Follow-up (4 cols) */}
            <div className="col-span-12 md:col-span-4 space-y-2">
              {/* Follow-up status */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Relance:</span>
                {overdueStatus ? (
                  <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30 animate-pulse">
                    <Clock className="w-3 h-3 mr-1" />En retard
                  </Badge>
                ) : todayStatus ? (
                  <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">
                    <Calendar className="w-3 h-3 mr-1" />Aujourd'hui
                  </Badge>
                ) : contact.next_followup_date ? (
                  <Badge variant="outline" className="text-[10px] border-white/20">
                    {formatFollowUpDate(contact.next_followup_date)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-blue-400/30 text-blue-400">
                    À planifier
                  </Badge>
                )}
                
                {neverContacted && (
                  <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                    Jamais contacté
                  </Badge>
                )}
              </div>
              
              {/* Mini timeline */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Dernier contact: <span className="text-foreground">{formatLastContact(contact.last_contact_date)}</span></span>
                {contact.source && <span>Source: <span className="text-foreground">{contact.source}</span></span>}
              </div>
              
              {/* Urgency Bar */}
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 max-w-32 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${urgencyScore * 10}%` }}
                  />
                </div>
                <span className={cn('text-xs font-medium', urgencyInfo.color)}>
                  {urgencyInfo.label}
                </span>
                {isHot && <Flame className="w-3 h-3 text-purple-500" />}
              </div>
            </div>

            {/* Col 3: Pipeline & Actions (4 cols) */}
            <div className="col-span-12 md:col-span-4 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Badge className="text-[10px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-500/30">
                  {PIPELINE_STAGE_LABELS[contact.pipeline_stage as PipelineStage]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {contact.assigned_to ? 'Assigné' : 'Non assigné'}
                </span>
              </div>
              
              {/* Quick Actions */}
              <TooltipProvider>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {contact.phone && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a 
                          href={`tel:${contact.phone}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Phone className="w-4 h-4 text-blue-400" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Appeler</TooltipContent>
                    </Tooltip>
                  )}
                  
                  {contact.email && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a 
                          href={`mailto:${contact.email}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4 text-purple-400" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Email</TooltipContent>
                    </Tooltip>
                  )}
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={(e) => { e.stopPropagation(); /* TODO: Open activity modal */ }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4 text-blue-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Créer activité</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => onNavigate(contact.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4 text-purple-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Ouvrir fiche</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==================== KPI CARD ====================
function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: 'blue' | 'purple' }) {
  return (
    <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-200">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg',
          color === 'blue' ? 'bg-blue-500/20' : 'bg-purple-500/20'
        )}>
          <Icon className={cn('w-4 h-4', color === 'blue' ? 'text-blue-400' : 'text-purple-400')} />
        </div>
        <div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== MAIN COMPONENT ====================
export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortOption, setSortOption] = useState<SortOption>('followup');
  const [filterOption, setFilterOption] = useState<FilterOption>(() => {
    return searchParams.get('filter') === 'to_follow_up' ? 'overdue' : 'all';
  });
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  const navigate = useNavigate();
  
  // Clear query param after applying filter
  useEffect(() => {
    if (searchParams.get('filter')) {
      searchParams.delete('filter');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleNavigateToContact = (id: string) => navigate(`/contacts/${id}`);

  const contactsQueryKey = organizationId ? (['contacts', organizationId] as const) : (['contacts'] as const);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { full_name: '', email: '', phone: '', urgency_score: 0, source: '', notes: '' },
  });

  const { data: contacts, isLoading } = useOrgQuery<Contact[]>('contacts', {
    select: '*', orderBy: { column: 'created_at', ascending: false }
  });

  // ==================== COMPUTED STATS ====================
  const stats = useMemo(() => {
    if (!contacts) return { total: 0, overdue: 0, today: 0, hot: 0, unassigned: 0, noFollowUp: 0 };
    
    return {
      total: contacts.length,
      overdue: contacts.filter(c => isOverdue(c.next_followup_date)).length,
      today: contacts.filter(c => isToday(c.next_followup_date)).length,
      hot: contacts.filter(c => (c.urgency_score || 0) >= 8).length,
      unassigned: contacts.filter(c => !c.assigned_to).length,
      noFollowUp: contacts.filter(c => !c.next_followup_date).length,
    };
  }, [contacts]);

  // ==================== FILTERED & SORTED CONTACTS ====================
  const processedContacts = useMemo(() => {
    let result = contacts?.filter((c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
    ) || [];

    // Apply filter
    switch (filterOption) {
      case 'overdue':
        result = result.filter(c => isOverdue(c.next_followup_date) || isToday(c.next_followup_date));
        break;
      case 'hot':
        result = result.filter(c => (c.urgency_score || 0) >= 8);
        break;
      case 'unassigned':
        result = result.filter(c => !c.assigned_to);
        break;
      case 'vendeur':
        result = result.filter(c => c.role === 'vendeur' || c.role === 'vendeur_acheteur');
        break;
      case 'acheteur':
        result = result.filter(c => c.role === 'acheteur' || c.role === 'vendeur_acheteur');
        break;
    }

    // Apply sort
    switch (sortOption) {
      case 'followup':
        result.sort((a, b) => {
          // Overdue first, then today, then soon, then by urgency
          const aOverdue = isOverdue(a.next_followup_date);
          const bOverdue = isOverdue(b.next_followup_date);
          const aToday = isToday(a.next_followup_date);
          const bToday = isToday(b.next_followup_date);
          
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          if (aToday && !bToday) return -1;
          if (!aToday && bToday) return 1;
          
          return (b.urgency_score || 0) - (a.urgency_score || 0);
        });
        break;
      case 'urgency':
        result.sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0));
        break;
      case 'name':
        result.sort((a, b) => a.full_name.localeCompare(b.full_name));
        break;
      case 'last_contact':
        result.sort((a, b) => {
          if (!a.last_contact_date) return 1;
          if (!b.last_contact_date) return -1;
          return new Date(b.last_contact_date).getTime() - new Date(a.last_contact_date).getTime();
        });
        break;
    }

    return result;
  }, [contacts, searchQuery, filterOption, sortOption]);

  const contactsByStage = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = processedContacts?.filter((c) => c.pipeline_stage === stage) || [];
      return acc;
    }, {} as Record<PipelineStage, Contact[]>);
  }, [processedContacts]);

  // ==================== MUTATIONS ====================
  const createMutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      const { error } = await supabase.from('contacts').insert({
        full_name: values.full_name, email: values.email || null, phone: values.phone || null,
        role: values.role || null, urgency_score: values.urgency_score, source: values.source || null,
        notes: values.notes || null, organization_id: organizationId, pipeline_stage: 'nouveau',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactsQueryKey });
      setIsDialogOpen(false);
      form.reset();
      toast.success('Contact créé avec succès');
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`),
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      if (!organizationId) throw new Error('Organisation non trouvée');
      const { error } = await supabase.from('contacts').update({ pipeline_stage: stage }).eq('id', id).eq('organization_id', organizationId);
      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: contactsQueryKey });
      const previousContacts = queryClient.getQueryData<Contact[]>(contactsQueryKey);
      queryClient.setQueryData<Contact[]>(contactsQueryKey, (old) =>
        old?.map((contact) => (contact.id === id ? { ...contact, pipeline_stage: stage } : contact))
      );
      return { previousContacts };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(contactsQueryKey, context?.previousContacts);
      toast.error('Erreur lors de la mise à jour');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: contactsQueryKey }),
  });

  // ==================== DRAG HANDLERS ====================
  const handleDragStart = (event: DragStartEvent) => {
    const contact = contacts?.find((c) => c.id === event.active.id);
    if (contact) setActiveContact(contact);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);
    
    if (!over) return;
    
    const draggedContactId = active.id as string;
    const overId = over.id as string;
    
    let targetStage: PipelineStage | undefined;
    
    if (overId.startsWith('column-')) {
      const stageFromColumn = overId.replace('column-', '') as PipelineStage;
      if (PIPELINE_STAGES.includes(stageFromColumn)) {
        targetStage = stageFromColumn;
      }
    } else {
      for (const stage of PIPELINE_STAGES) {
        if (contactsByStage[stage].some((c) => c.id === overId)) {
          targetStage = stage;
          break;
        }
      }
    }
    
    if (!targetStage) return;
    
    const draggedContact = contacts?.find((c) => c.id === draggedContactId);
    
    if (draggedContact && draggedContact.pipeline_stage !== targetStage) {
      updateStageMutation.mutate({ id: draggedContactId, stage: targetStage });
    }
  };

  // ==================== FILTER CHIPS ====================
  const filterChips: { key: FilterOption; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'Tous', icon: Users },
    { key: 'overdue', label: 'À relancer', icon: Clock },
    { key: 'hot', label: 'Chauds', icon: Flame },
    { key: 'unassigned', label: 'Non assignés', icon: UserX },
    { key: 'vendeur', label: 'Vendeurs', icon: Home },
    { key: 'acheteur', label: 'Acheteurs', icon: User },
  ];

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'followup', label: 'Prochaine relance' },
    { key: 'urgency', label: 'Urgence décroissante' },
    { key: 'name', label: 'Nom A→Z' },
    { key: 'last_contact', label: 'Dernier contact' },
  ];

  return (
    <motion.div className="space-y-6 p-8" initial="initial" animate="animate" variants={pageVariants} transition={{ duration: 0.3 }}>
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-semibold">{stats.total}</span> contacts
            {stats.overdue > 0 && (
              <> · <span className="text-purple-400 font-semibold">{stats.overdue}</span> en retard</>
            )}
            {stats.today > 0 && (
              <> · <span className="text-blue-400 font-semibold">{stats.today}</span> aujourd'hui</>
            )}
            {stats.hot > 0 && (
              <> · <span className="text-purple-500 font-semibold">{stats.hot}</span> chauds</>
            )}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02]">
              <Plus className="w-4 h-4 mr-2" />Nouveau contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg backdrop-blur-xl border-white/20">
            <DialogHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 -mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-xl border-b border-white/10">
              <DialogTitle className="flex items-center gap-3 text-2xl font-semibold text-white">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                  <UserPlus className="w-6 h-6 text-blue-400" />
                </div>
                Créer un contact
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-6 pt-4">
                {/* Section 1 - Identité */}
                <div className="border-l-2 border-blue-500/50 pl-4 bg-blue-500/5 rounded-r-xl py-4 space-y-4">
                  <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wide mb-3">Identité</h3>
                  
                  <FormField control={form.control} name="full_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        Nom complet <span className="text-blue-400">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Jean Dupont" 
                          {...field} 
                          autoFocus
                          className="bg-white/10 hover:bg-white/15 border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-lg font-semibold"
                        />
                      </FormControl>
                      <FormMessage className="text-blue-400" />
                    </FormItem>
                  )} />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white flex items-center gap-2">
                          <Mail className="w-4 h-4 text-purple-400" />Email
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="email@exemple.com" {...field} className="bg-white/10 hover:bg-white/15 border-white/20 focus:border-blue-500" />
                        </FormControl>
                        <FormMessage className="text-blue-400" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white flex items-center gap-2">
                          <Phone className="w-4 h-4 text-blue-400" />Téléphone
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="06 12 34 56 78" {...field} className="bg-white/10 hover:bg-white/15 border-white/20 focus:border-blue-500" />
                        </FormControl>
                        <FormMessage className="text-blue-400" />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section 2 - Profil & Priorité */}
                <div className="border-l-2 border-purple-500/50 pl-4 bg-purple-500/5 rounded-r-xl py-4 space-y-4">
                  <h3 className="text-sm font-medium text-purple-400 uppercase tracking-wide mb-3">Profil & Priorité</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />Type
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/10 border-white/20 focus:border-purple-500">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background/95 backdrop-blur-xl border-white/20">
                            {CONTACT_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>{CONTACT_ROLE_LABELS[role]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="source" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white flex items-center gap-2">
                          <Globe className="w-4 h-4 text-blue-400" />Source
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger className="bg-white/10 border-white/20 focus:border-blue-500">
                              <SelectValue placeholder="Origine" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background/95 backdrop-blur-xl border-white/20">
                            {['Site web', 'Portail immo', 'Référencement', 'Prospection', 'Événement', 'Bouche à oreille'].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  
                  <FormField control={form.control} name="urgency_score" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-purple-400" />Score d'urgence
                        </span>
                        <span className={cn(
                          "text-2xl font-bold",
                          field.value <= 3 ? "text-blue-400" : field.value <= 6 ? "text-purple-400" : "text-purple-500"
                        )}>
                          {field.value}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider value={[field.value]} onValueChange={(v) => field.onChange(v[0])} min={0} max={10} step={1} className="py-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="text-blue-400">0 - Froid</span>
                            <span className="text-purple-400">5 - Tiède</span>
                            <span className="text-purple-500">10 - Chaud</span>
                          </div>
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Section 3 - Notes */}
                <div className="border-l-2 border-blue-500/30 pl-4 bg-white/5 rounded-r-xl py-4 space-y-4">
                  <h3 className="text-sm font-medium text-blue-400/70 uppercase tracking-wide mb-3">Notes</h3>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Textarea 
                            placeholder="Informations complémentaires..." 
                            {...field} 
                            rows={3}
                            maxLength={1000}
                            className="bg-white/10 border-white/20 focus:border-blue-500 min-h-[80px] resize-none"
                          />
                          <span className="absolute bottom-2 right-2 text-xs text-purple-400">{field.value?.length || 0}/1000</span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 h-12 text-base font-semibold" 
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Création...</>
                  ) : (
                    <><UserPlus className="mr-2 h-5 w-5" />Créer le contact</>
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ==================== KPI CARDS ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Clock} label="À relancer" value={stats.overdue + stats.today} color="purple" />
        <KpiCard icon={Flame} label="Chauds (≥8)" value={stats.hot} color="purple" />
        <KpiCard icon={UserX} label="Non assignés" value={stats.unassigned} color="blue" />
        <KpiCard icon={CalendarClock} label="Sans relance" value={stats.noFollowUp} color="blue" />
      </div>

      {/* ==================== COMMAND CENTER ==================== */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher nom, email, téléphone..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="pl-10 bg-white/10 border-white/20 focus:border-primary"
          />
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filterChips.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={filterOption === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterOption(key)}
              className={cn(
                'text-xs',
                filterOption === key 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 border-0' 
                  : 'border-white/20 hover:bg-white/10'
              )}
            >
              <Icon className="w-3 h-3 mr-1" />
              {label}
            </Button>
          ))}
        </div>
        
        {/* Sort & View Toggle */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-white/20 hover:bg-white/10">
                <ArrowUpDown className="w-3 h-3 mr-1" />
                Trier
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-background/95 backdrop-blur-xl border-white/20">
              {sortOptions.map(({ key, label }) => (
                <DropdownMenuItem 
                  key={key} 
                  onClick={() => setSortOption(key)}
                  className={cn(sortOption === key && 'bg-white/10')}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* View Toggle */}
          <div className="flex bg-white/10 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-md px-3',
                viewMode === 'list' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'hover:bg-white/10'
              )}
            >
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('kanban')}
              className={cn(
                'rounded-md px-3',
                viewMode === 'kanban' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'hover:bg-white/10'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ==================== CONTENT ==================== */}
      {viewMode === 'list' ? (
        // LIST VIEW
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : processedContacts.length === 0 ? (
            <EmptyState
              icon={Users}
              iconGradient="from-blue-500/20 to-purple-500/20"
              title="Votre pipeline commence ici"
              description="Importez vos contacts ou créez-en de nouveaux pour démarrer votre activité commerciale."
              action={{
                label: "Créer un contact",
                onClick: () => setIsDialogOpen(true),
                icon: <Plus className="w-5 h-5" />
              }}
              secondaryAction={{
                label: "Importer un fichier CSV",
                onClick: () => {},
                icon: <Upload className="w-5 h-5" />
              }}
              features={[
                { icon: <Home className="w-5 h-5 text-blue-400" />, title: "Vendeurs", desc: "Ajoutez vos propriétaires" },
                { icon: <User className="w-5 h-5 text-purple-400" />, title: "Acquéreurs", desc: "Suivez vos acheteurs" },
                { icon: <Clock className="w-5 h-5 text-blue-400" />, title: "Relances", desc: "Planifiez vos suivis" }
              ]}
            />
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
              {processedContacts.map((contact, index) => (
                <ContactRow key={contact.id} contact={contact} onNavigate={handleNavigateToContact} index={index} />
              ))}
            </motion.div>
          )}
        </div>
      ) : (
        // KANBAN VIEW
        <div>
          {isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {PIPELINE_STAGES.slice(0, 6).map((stage) => (
                <KanbanColumnSkeleton key={stage} />
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map((stage) => (
                  <KanbanColumn key={stage} stage={stage} contacts={contactsByStage[stage]} onNavigate={handleNavigateToContact} />
                ))}
              </div>
              <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }}>
                {activeContact ? (
                  <motion.div 
                    initial={{ scale: 1, rotate: 0 }} 
                    animate={{ scale: 1.08, rotate: -3 }} 
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="shadow-glow"
                  >
                    <ContactCard contact={activeContact} isDragging />
                  </motion.div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}
    </motion.div>
  );
}
