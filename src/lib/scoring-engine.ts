/**
 * Lead Scoring Engine
 * Heuristic-based scoring system to prioritize contacts by business potential
 */

import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Activity = Tables<'activities'>;

export interface ScoringCriterion {
  label: string;
  points: number;
  category: 'profile' | 'engagement' | 'pipeline';
}

export interface LeadScoreResult {
  score: number; // 0-100
  temperature: 'cold' | 'warm' | 'hot';
  color: string; // Tailwind color class
  reasons: string[];
  criteria: ScoringCriterion[];
  breakdown: {
    profile: number;
    engagement: number;
    pipeline: number;
  };
}

interface ContactSearch {
  id: string;
  budget_min?: number | null;
  budget_max?: number | null;
  property_types?: string[] | null;
  cities?: string[] | null;
}

/**
 * Calculate lead score based on profile completeness, engagement, and pipeline status
 * @param contact - The contact to score
 * @param activities - Activities related to this contact
 * @param searchCriteria - Optional search criteria for the contact
 * @returns LeadScoreResult with score, temperature, and reasons
 */
export function calculateLeadScore(
  contact: Contact,
  activities: Activity[] = [],
  searchCriteria?: ContactSearch | null
): LeadScoreResult {
  const reasons: string[] = [];
  const criteria: ScoringCriterion[] = [];
  let profileScore = 0;
  let engagementScore = 0;
  let pipelineScore = 0;

  function addCriterion(label: string, points: number, category: ScoringCriterion['category']) {
    criteria.push({ label, points, category });
    if (points > 0) reasons.push(label);
  }

  // ========== PROFILE COMPLETENESS (30 points max) ==========

  // Phone (+10)
  if (contact.phone && contact.phone.trim().length > 0) {
    profileScore += 10;
    addCriterion('Téléphone renseigné', 10, 'profile');
  }

  // Email (+10)
  if (contact.email && contact.email.trim().length > 0) {
    profileScore += 10;
    addCriterion('Email renseigné', 10, 'profile');
  }

  // Budget defined via search criteria (+10)
  if (searchCriteria?.budget_max || searchCriteria?.budget_min) {
    profileScore += 10;
    addCriterion('Budget défini', 10, 'profile');
  } else {
    addCriterion('Pas de budget renseigné', -5, 'profile');
  }

  // ========== ENGAGEMENT (40 points max) ==========

  const now = new Date();
  const contactActivities = activities.filter(a => a.contact_id === contact.id);

  // Find last activity date
  const sortedActivities = [...contactActivities].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastActivity = sortedActivities[0];

  if (lastActivity) {
    const lastActivityDate = new Date(lastActivity.date);
    const daysSinceActivity = Math.floor(
      (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Last activity < 7 days (+15)
    if (daysSinceActivity < 7) {
      engagementScore += 15;
      addCriterion('Actif récemment', 15, 'engagement');
    }
    // Last activity < 30 days (+5)
    else if (daysSinceActivity < 30) {
      engagementScore += 5;
      addCriterion('Contacté ce mois', 5, 'engagement');
    } else {
      addCriterion('Inactif depuis 30j+', -10, 'engagement');
    }
  } else {
    addCriterion('Aucune interaction', -10, 'engagement');
  }

  // Has > 3 total activities (+15)
  if (contactActivities.length > 3) {
    engagementScore += 15;
    addCriterion(`${contactActivities.length} interactions`, 15, 'engagement');
  } else if (contactActivities.length > 0) {
    engagementScore += 5;
    addCriterion(`${contactActivities.length} interaction(s)`, 5, 'engagement');
  }

  // Has a future task planned (+10)
  const futureTasks = contactActivities.filter(a => {
    const activityDate = new Date(a.date);
    return activityDate > now && a.status !== 'termine' && a.status !== 'annule';
  });

  if (futureTasks.length > 0) {
    engagementScore += 10;
    addCriterion('Relance planifiée', 10, 'engagement');
  } else {
    addCriterion('Pas de relance prévue', -5, 'engagement');
  }

  // ========== PIPELINE STATUS (30 points max) ==========

  const stage = contact.pipeline_stage;

  // Stage = "Nouveau" (freshness) (+10)
  if (stage === 'nouveau') {
    pipelineScore += 10;
    addCriterion('Lead récent', 10, 'pipeline');
  }

  // Stage = "Visite" (high intent) (+20)
  if (stage === 'visite') {
    pipelineScore += 20;
    addCriterion('Visite réalisée', 20, 'pipeline');
  }

  // Advanced stages
  if (stage === 'offre' || stage === 'negociation') {
    pipelineScore += 25;
    addCriterion('En négociation', 25, 'pipeline');
  }

  if (stage === 'compromis' || stage === 'financement') {
    pipelineScore += 15;
    addCriterion('Dossier avancé', 15, 'pipeline');
  }

  // Project defined (search criteria present) (+10)
  if (searchCriteria) {
    const hasSearchCriteria =
      searchCriteria.budget_max ||
      searchCriteria.property_types?.length ||
      searchCriteria.cities?.length;

    if (hasSearchCriteria) {
      pipelineScore += 10;
      addCriterion('Projet défini', 10, 'pipeline');
    }
  }

  // ========== CALCULATE FINAL SCORE ==========
  
  const totalScore = Math.min(100, profileScore + engagementScore + pipelineScore);
  
  // Determine temperature
  let temperature: 'cold' | 'warm' | 'hot';
  let color: string;
  
  if (totalScore >= 70) {
    temperature = 'hot';
    color = 'text-error';
  } else if (totalScore >= 30) {
    temperature = 'warm';
    color = 'text-warning';
  } else {
    temperature = 'cold';
    color = 'text-info';
  }

  return {
    score: totalScore,
    temperature,
    color,
    reasons: reasons.slice(0, 5), // Max 5 reasons
    criteria,
    breakdown: {
      profile: profileScore,
      engagement: engagementScore,
      pipeline: pipelineScore,
    },
  };
}

/**
 * Get temperature label in French
 */
export function getTemperatureLabel(temperature: 'cold' | 'warm' | 'hot'): string {
  const labels = {
    cold: 'Froid',
    warm: 'Tiède',
    hot: 'Chaud',
  };
  return labels[temperature];
}

/**
 * Get temperature badge color classes
 */
export function getTemperatureBadgeClasses(temperature: 'cold' | 'warm' | 'hot'): string {
  const classes = {
    cold: 'bg-info/20 text-info border-info/30',
    warm: 'bg-warning/20 text-warning border-warning/30',
    hot: 'bg-error/20 text-error border-error/30',
  };
  return classes[temperature];
}

/**
 * Get score color classes for progress/gauge
 */
export function getScoreColorClasses(score: number): string {
  if (score >= 70) return 'from-error to-warning';
  if (score >= 30) return 'from-warning to-primary';
  return 'from-info to-primary';
}

/**
 * Sort contacts by lead score (highest first)
 */
export function sortContactsByScore(
  contacts: Contact[],
  activitiesMap: Map<string, Activity[]>,
  searchesMap?: Map<string, ContactSearch>
): Contact[] {
  return [...contacts].sort((a, b) => {
    const scoreA = calculateLeadScore(
      a,
      activitiesMap.get(a.id) || [],
      searchesMap?.get(a.id)
    ).score;
    const scoreB = calculateLeadScore(
      b,
      activitiesMap.get(b.id) || [],
      searchesMap?.get(b.id)
    ).score;
    return scoreB - scoreA;
  });
}
