import { differenceInDays, isToday, isPast } from 'date-fns';

// Smart Badge Types
export type SmartBadgeType = 'hot' | 'cold' | 'followup' | 'high-value';

export interface SmartBadge {
  type: SmartBadgeType;
  label: string;
  icon: string;
  color: 'destructive' | 'info' | 'warning' | 'success';
}

// Contact Badge Logic
export function getContactBadges(contact: {
  last_contact_date?: string | null;
  next_followup_date?: string | null;
  deals?: Array<{ amount: number }> | null;
}): SmartBadge[] {
  const badges: SmartBadge[] = [];
  
  // Hot/Cold based on last contact
  if (contact.last_contact_date) {
    const daysSinceContact = differenceInDays(new Date(), new Date(contact.last_contact_date));
    
    if (daysSinceContact <= 2) {
      badges.push({ 
        type: 'hot', 
        label: 'Chaud', 
        icon: '🔥', 
        color: 'destructive' 
      });
    } else if (daysSinceContact > 14) {
      badges.push({ 
        type: 'cold', 
        label: 'Froid', 
        icon: '❄️', 
        color: 'info' 
      });
    }
  }
  
  // Follow-up due
  if (contact.next_followup_date) {
    const followupDate = new Date(contact.next_followup_date);
    if (isToday(followupDate) || isPast(followupDate)) {
      badges.push({ 
        type: 'followup', 
        label: 'Relance', 
        icon: '⏰', 
        color: 'warning' 
      });
    }
  }
  
  // High value (deal > 300k)
  if (contact.deals?.some(d => d.amount > 300000)) {
    badges.push({ 
      type: 'high-value', 
      label: 'High Value', 
      icon: '💰', 
      color: 'success' 
    });
  }
  
  return badges;
}

// Deal Health Score Logic
export function calculateDealHealth(deal: {
  updated_at?: string | null;
  probability?: number | null;
  expected_close_date?: string | null;
  stage?: string;
}): number {
  let score = 50; // Base score
  
  // Positive factors
  if (deal.updated_at) {
    const daysSinceUpdate = differenceInDays(new Date(), new Date(deal.updated_at));
    if (daysSinceUpdate < 3) score += 20;
    else if (daysSinceUpdate > 7) score -= 30;
    else if (daysSinceUpdate > 14) score -= 40;
  }
  
  if (deal.probability) {
    if (deal.probability > 70) score += 15;
    else if (deal.probability > 50) score += 10;
    else if (deal.probability < 30) score -= 10;
  }
  
  // Stage-based scoring
  const advancedStages = ['offre', 'negociation', 'compromis'];
  if (deal.stage && advancedStages.includes(deal.stage)) {
    score += 10;
  }
  
  // Close date proximity
  if (deal.expected_close_date) {
    const daysUntilClose = differenceInDays(new Date(deal.expected_close_date), new Date());
    if (daysUntilClose >= 0 && daysUntilClose <= 14) score += 10;
    if (daysUntilClose < 0) score -= 15; // Overdue
  }
  
  return Math.max(0, Math.min(100, score));
}

export function getDealHealthColor(score: number): string {
  if (score >= 70) return 'text-success';
  if (score >= 40) return 'text-warning';
  return 'text-error';
}

export function getDealHealthLabel(score: number): string {
  if (score >= 70) return 'Bon';
  if (score >= 40) return 'Attention';
  return 'Critique';
}

// Smart Action Types
export type ActionPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface SmartAction {
  id: string;
  priority: ActionPriority;
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  route?: string;
  count?: number;
}

// Notification Types
export type NotificationType = 'warning' | 'success' | 'info' | 'error';

export interface SmartNotification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  time: string;
  route?: string;
  read?: boolean;
}
