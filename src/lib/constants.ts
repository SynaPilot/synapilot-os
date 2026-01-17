// Pipeline stages for contacts (must match database enum exactly)
export const PIPELINE_STAGES = ['nouveau', 'qualification', 'estimation', 'mandat', 'commercialisation', 'visite', 'offre', 'negociation', 'compromis', 'financement', 'acte', 'vendu', 'perdu'] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];

// French labels for pipeline stages
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  nouveau: 'Nouveau',
  qualification: 'Qualification',
  estimation: 'Estimation',
  mandat: 'Mandat signé',
  commercialisation: 'Commercialisation',
  visite: 'Visites en cours',
  offre: 'Offre déposée',
  negociation: 'Négociation',
  compromis: 'Compromis',
  financement: 'Financement',
  acte: 'Acte',
  vendu: 'Vendu ✅',
  perdu: 'Perdu ❌',
};

// Deal stages (must match database enum exactly)
export const DEAL_STAGES = ['nouveau', 'qualification', 'estimation', 'mandat', 'commercialisation', 'visite', 'offre', 'negociation', 'compromis', 'financement', 'acte', 'vendu', 'perdu'] as const;
export type DealStage = typeof DEAL_STAGES[number];

// French labels for deal stages
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  nouveau: 'Nouveau',
  qualification: 'Qualification',
  estimation: 'Estimation',
  mandat: 'Mandat signé',
  commercialisation: 'Commercialisation',
  visite: 'Visites en cours',
  offre: 'Offre déposée',
  negociation: 'Négociation',
  compromis: 'Compromis',
  financement: 'Financement',
  acte: 'Acte',
  vendu: 'Vendu ✅',
  perdu: 'Perdu ❌',
};

// Contact roles (must match database enum exactly)
export const CONTACT_ROLES = ['vendeur', 'acheteur', 'vendeur_acheteur', 'locataire', 'proprietaire', 'prospect', 'partenaire', 'notaire', 'banquier', 'autre'] as const;
export type ContactRole = typeof CONTACT_ROLES[number];

// French labels for contact roles
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  vendeur: 'Vendeur',
  acheteur: 'Acheteur',
  vendeur_acheteur: 'Vendeur/Acheteur',
  locataire: 'Locataire',
  proprietaire: 'Propriétaire',
  prospect: 'Prospect',
  partenaire: 'Partenaire',
  notaire: 'Notaire',
  banquier: 'Banquier',
  autre: 'Autre',
};

// Property status (must match database enum exactly)
export const PROPERTY_STATUSES = ['disponible', 'sous_compromis', 'vendu', 'loue', 'retire'] as const;
export type PropertyStatus = typeof PROPERTY_STATUSES[number];

// French labels for property statuses
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  disponible: 'Disponible',
  sous_compromis: 'Sous compromis',
  vendu: 'Vendu',
  loue: 'Loué',
  retire: 'Retiré',
};

// Property types (must match database enum exactly)
export const PROPERTY_TYPES = ['appartement', 'maison', 'terrain', 'commerce', 'bureau', 'immeuble', 'parking', 'autre'] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

// French labels for property types
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  terrain: 'Terrain',
  commerce: 'Commerce',
  bureau: 'Bureau',
  immeuble: 'Immeuble',
  parking: 'Parking',
  autre: 'Autre',
};

// Transaction types (custom - stored as text in DB)
export const TRANSACTION_TYPES = ['vente', 'location', 'viager'] as const;
export type TransactionType = typeof TRANSACTION_TYPES[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  vente: 'Vente',
  location: 'Location',
  viager: 'Viager',
};

// Activity types (must match database enum exactly)
export const ACTIVITY_TYPES = ['appel', 'email', 'visite', 'rdv', 'relance', 'signature', 'note', 'tache', 'autre'] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

// French labels for activity types
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  appel: 'Appel',
  email: 'Email',
  visite: 'Visite',
  rdv: 'Rendez-vous',
  relance: 'Relance',
  signature: 'Signature',
  note: 'Note',
  tache: 'Tâche',
  autre: 'Autre',
};

// Activity priorities (must match database enum exactly)
export const ACTIVITY_PRIORITIES = ['basse', 'normale', 'haute', 'urgente'] as const;
export type ActivityPriority = typeof ACTIVITY_PRIORITIES[number];

export const ACTIVITY_PRIORITY_LABELS: Record<ActivityPriority, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
};

// Activity statuses (must match database enum exactly)
export const ACTIVITY_STATUSES = ['planifie', 'en_cours', 'termine', 'annule'] as const;
export type ActivityStatus = typeof ACTIVITY_STATUSES[number];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
};

// Utility functions
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeDate(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
  return formatDate(date);
}
