// Pipeline stages for contacts (must match database enum exactly)
export const PIPELINE_STAGES = ['lead', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];

// French labels for pipeline stages
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  lead: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  proposal: 'Proposition',
  won: 'Gagné',
  lost: 'Perdu',
};

// Deal stages (must match database enum exactly)
export const DEAL_STAGES = ['nouveau', 'estimation', 'mandat', 'visite', 'offre', 'negociation', 'compromis', 'vendu', 'perdu'] as const;
export type DealStage = typeof DEAL_STAGES[number];

// French labels for deal stages
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  nouveau: 'Nouveau',
  estimation: 'Estimation',
  mandat: 'Mandat signé',
  visite: 'Visites en cours',
  offre: 'Offre déposée',
  negociation: 'Négociation',
  compromis: 'Compromis',
  vendu: 'Vendu ✅',
  perdu: 'Perdu ❌',
};

// Contact roles (must match database enum exactly)
export const CONTACT_ROLES = ['Acheteur', 'Vendeur', 'Investisseur', 'Locataire'] as const;
export type ContactRole = typeof CONTACT_ROLES[number];

// Property status (must match database enum exactly)
export const PROPERTY_STATUSES = ['Estimation', 'Mandat', 'Sous Offre', 'Vendu', 'Archivé'] as const;
export type PropertyStatus = typeof PROPERTY_STATUSES[number];

// Property types (must match database enum exactly)
export const PROPERTY_TYPES = ['Appartement', 'Maison', 'Terrain', 'Commerce', 'Immeuble'] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

// Activity types (must match database enum exactly)
export const ACTIVITY_TYPES = ['Call', 'SMS', 'Email', 'Meeting', 'Visite', 'Relance'] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

// Activity statuses (must match database enum exactly)
export const ACTIVITY_STATUSES = ['À faire', 'En cours', 'Terminé', 'Annulé'] as const;
export type ActivityStatus = typeof ACTIVITY_STATUSES[number];

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
