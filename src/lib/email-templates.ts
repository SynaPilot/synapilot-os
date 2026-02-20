// Predefined email templates for real estate agents
// Variables use the {variable_name} format for smart injection

export type EmailTemplateCategory = 
  | 'onboarding' 
  | 'followup' 
  | 'mandate' 
  | 'visit' 
  | 'offer'
  | 'nurture';

export interface EmailTemplate {
  id: string;
  category: EmailTemplateCategory;
  title: string;
  subject: string;
  body: string;
  variables: string[];
  emoji: string;
  description: string;
}

export const EMAIL_TEMPLATE_CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  onboarding: 'Première prise de contact',
  followup: 'Relances',
  mandate: 'Mandats',
  visit: 'Visites',
  offer: 'Offres',
  nurture: 'Nurturing',
};

export const EMAIL_TEMPLATE_CATEGORY_ICONS: Record<EmailTemplateCategory, string> = {
  onboarding: '👋',
  followup: '🔄',
  mandate: '📝',
  visit: '🏠',
  offer: '💰',
  nurture: '🌱',
};

export const PREDEFINED_EMAIL_TEMPLATES: EmailTemplate[] = [
  // ONBOARDING
  {
    id: 'welcome-new-contact',
    category: 'onboarding',
    title: 'Bienvenue nouveau contact',
    emoji: '👋',
    description: 'Email de bienvenue pour un lead entrant',
    subject: '{contact_civilite} {contact_nom}, bienvenue chez {agence_nom} !',
    body: `Bonjour {contact_civilite} {contact_nom},

Je suis {agent_prenom} {agent_nom}, conseiller immobilier chez {agence_nom}.

Je vous remercie pour l'intérêt que vous portez à nos services. Je serai votre interlocuteur privilégié pour vous accompagner dans votre projet immobilier.

N'hésitez pas à me contacter pour toute question ou pour planifier un premier échange téléphonique.

À très bientôt,

{agent_prenom} {agent_nom}
{agence_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'agent_prenom', 'agent_nom', 'agence_nom'],
  },
  {
    id: 'first-contact-buyer',
    category: 'onboarding',
    title: 'Premier contact acheteur',
    emoji: '🏡',
    description: 'Prise de contact avec un acheteur potentiel',
    subject: 'Votre projet d\'achat immobilier - Faisons connaissance',
    body: `Bonjour {contact_civilite} {contact_nom},

Suite à votre demande concernant un bien immobilier, je me permets de vous contacter pour échanger sur votre projet.

Afin de mieux cerner vos attentes et vous proposer des biens adaptés, pourriez-vous me préciser :
- Votre budget envisagé
- Le type de bien recherché (appartement, maison)
- Le secteur géographique souhaité
- Vos critères essentiels

Je reste à votre disposition pour convenir d'un rendez-vous.

Bien cordialement,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'agent_prenom', 'agent_nom'],
  },

  // FOLLOWUP
  {
    id: 'followup-cold-lead',
    category: 'followup',
    title: 'Relance lead froid',
    emoji: '🔔',
    description: 'Réengagement contact sans activité depuis 15+ jours',
    subject: '{contact_prenom}, avez-vous eu le temps de réfléchir ?',
    body: `Bonjour {contact_civilite} {contact_nom},

Je me permets de vous recontacter suite à notre dernier échange.

Votre projet immobilier est-il toujours d'actualité ? Le marché évolue constamment et de nouvelles opportunités apparaissent régulièrement.

Si vous souhaitez faire le point sur votre projet ou si votre situation a évolué, je reste à votre entière disposition.

N'hésitez pas à me recontacter au moment qui vous conviendra.

Cordialement,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'contact_prenom', 'agent_prenom', 'agent_nom'],
  },
  {
    id: 'followup-after-call',
    category: 'followup',
    title: 'Suite à notre appel',
    emoji: '📞',
    description: 'Récapitulatif après un appel téléphonique',
    subject: 'Suite à notre échange téléphonique',
    body: `Bonjour {contact_civilite} {contact_nom},

Je fais suite à notre conversation téléphonique de ce jour.

Comme convenu, je vous transmets les informations évoquées ensemble. Je reste à votre disposition pour tout complément d'information.

Prochaine étape : [À personnaliser]

Belle fin de journée,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'agent_prenom', 'agent_nom'],
  },

  // VISIT
  {
    id: 'invite-visit',
    category: 'visit',
    title: 'Invitation visite',
    emoji: '🗓️',
    description: 'Proposer une visite de bien',
    subject: 'Visite du bien à {bien_adresse} - Proposition de créneaux',
    body: `Bonjour {contact_civilite} {contact_nom},

J'ai le plaisir de vous proposer la visite d'un bien qui pourrait correspondre à vos critères :

📍 {bien_type} à {bien_adresse}
💰 Prix : {bien_prix}
📐 Surface : {bien_surface}

Seriez-vous disponible pour une visite aux créneaux suivants ?
- [Jour 1] à [Heure 1]
- [Jour 2] à [Heure 2]

N'hésitez pas à me proposer d'autres disponibilités si ces créneaux ne vous conviennent pas.

Dans l'attente de votre retour,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'bien_type', 'bien_adresse', 'bien_prix', 'bien_surface', 'agent_prenom', 'agent_nom'],
  },
  {
    id: 'post-visit-feedback',
    category: 'visit',
    title: 'Suivi post-visite',
    emoji: '💬',
    description: 'Recueillir les impressions après visite',
    subject: 'Votre avis sur le bien visité à {bien_adresse}',
    body: `Bonjour {contact_civilite} {contact_nom},

Je fais suite à notre visite du bien situé {bien_adresse}.

Quelles sont vos premières impressions ? Ce bien correspond-il à vos attentes ?

Points à retenir :
- [Points positifs du bien]
- [Points d'attention]

Si vous souhaitez approfondir votre réflexion ou visiter d'autres biens, je reste à votre disposition.

Bien cordialement,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'bien_adresse', 'agent_prenom', 'agent_nom'],
  },

  // MANDATE
  {
    id: 'confirm-mandate',
    category: 'mandate',
    title: 'Confirmation mandat',
    emoji: '✅',
    description: 'Email post-signature de mandat',
    subject: 'Confirmation de votre mandat de vente - {bien_adresse}',
    body: `Bonjour {contact_civilite} {contact_nom},

Je vous confirme la bonne réception de votre mandat de vente pour le bien situé :
📍 {bien_adresse}
💰 Prix de mise en vente : {bien_prix}

Prochaines étapes :
1. Prise de photos professionnelles
2. Rédaction de l'annonce
3. Diffusion sur les portails immobiliers
4. Organisation des premières visites

Je vous tiendrai régulièrement informé(e) de l'avancement de la commercialisation.

Merci pour votre confiance,

{agent_prenom} {agent_nom}
{agence_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'bien_adresse', 'bien_prix', 'agent_prenom', 'agent_nom', 'agence_nom'],
  },
  {
    id: 'estimation-request',
    category: 'mandate',
    title: 'Suite estimation',
    emoji: '📊',
    description: 'Après une demande d\'estimation',
    subject: 'Votre demande d\'estimation - Planifions un rendez-vous',
    body: `Bonjour {contact_civilite} {contact_nom},

Je vous remercie pour votre demande d'estimation.

Pour vous fournir une évaluation précise de votre bien, je vous propose de nous rencontrer directement sur place. Cela me permettra d'apprécier l'ensemble des caractéristiques de votre propriété.

L'estimation est gratuite et sans engagement.

Êtes-vous disponible cette semaine pour un rendez-vous ?

Dans l'attente de votre retour,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'agent_prenom', 'agent_nom'],
  },

  // OFFER
  {
    id: 'offer-received',
    category: 'offer',
    title: 'Offre reçue (vendeur)',
    emoji: '💰',
    description: 'Informer le vendeur d\'une offre d\'achat',
    subject: 'Bonne nouvelle - Offre d\'achat reçue pour votre bien',
    body: `Bonjour {contact_civilite} {contact_nom},

J'ai le plaisir de vous informer qu'une offre d'achat a été déposée pour votre bien situé {bien_adresse}.

Détails de l'offre :
💰 Montant proposé : [Montant]
📅 Date de dépôt : [Date]
💳 Financement : [Comptant / Crédit]

Je vous invite à me contacter rapidement afin d'échanger sur cette proposition.

Bien cordialement,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'bien_adresse', 'agent_prenom', 'agent_nom'],
  },
  {
    id: 'matched-properties',
    category: 'offer',
    title: 'Nouveaux biens matchés',
    emoji: '✨',
    description: 'Alerte acheteur avec biens correspondants',
    subject: '✨ {contact_prenom}, nouveaux biens correspondant à vos critères !',
    body: `Bonjour {contact_civilite} {contact_nom},

De nouveaux biens correspondant à vos critères de recherche viennent d'être mis en vente :

🏠 **Bien 1**
📍 [Adresse]
💰 [Prix] | 📐 [Surface] | 🛏️ [Chambres]

🏠 **Bien 2**
📍 [Adresse]
💰 [Prix] | 📐 [Surface] | 🛏️ [Chambres]

Ces biens vous intéressent ? Contactez-moi pour organiser une visite !

Bien cordialement,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'contact_prenom', 'agent_prenom', 'agent_nom'],
  },

  // NURTURE
  {
    id: 'market-update',
    category: 'nurture',
    title: 'Actualités du marché',
    emoji: '📈',
    description: 'Newsletter sur l\'évolution du marché',
    subject: 'Le marché immobilier ce mois-ci - Tendances et opportunités',
    body: `Bonjour {contact_civilite} {contact_nom},

Voici les dernières tendances du marché immobilier local :

📊 **Évolution des prix**
[Données sur les prix]

🏠 **Opportunités du moment**
[Biens coup de cœur]

💡 **Conseil du mois**
[Conseil personnalisé]

Pour toute question sur votre projet, n'hésitez pas à me contacter.

Bien cordialement,

{agent_prenom} {agent_nom}
{agence_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'agent_prenom', 'agent_nom', 'agence_nom'],
  },
  {
    id: 'last-chance',
    category: 'nurture',
    title: 'Dernière relance',
    emoji: '🎯',
    description: 'Relance finale avant archivage',
    subject: '{contact_prenom}, je reste à votre disposition',
    body: `Bonjour {contact_civilite} {contact_nom},

Cela fait quelque temps que nous n'avons pas échangé et je voulais simplement vous rappeler que je reste à votre disposition pour tout projet immobilier.

Que vous soyez acheteur, vendeur ou simplement en phase de réflexion, je serais ravi de vous accompagner.

N'hésitez pas à me recontacter quand vous le souhaiterez.

À bientôt j'espère,

{agent_prenom} {agent_nom}`,
    variables: ['contact_civilite', 'contact_nom', 'contact_prenom', 'agent_prenom', 'agent_nom'],
  },
];

// Variable definitions with human-readable labels
export const EMAIL_VARIABLES = [
  { key: 'contact_prenom', label: 'Prénom contact', icon: 'User', source: 'contact' },
  { key: 'contact_nom', label: 'Nom contact', icon: 'User', source: 'contact' },
  { key: 'contact_civilite', label: 'Civilité', icon: 'User', source: 'contact' },
  { key: 'contact_email', label: 'Email contact', icon: 'Mail', source: 'contact' },
  { key: 'agent_prenom', label: 'Prénom agent', icon: 'User', source: 'agent' },
  { key: 'agent_nom', label: 'Nom agent', icon: 'User', source: 'agent' },
  { key: 'agence_nom', label: 'Nom agence', icon: 'Building2', source: 'organization' },
  { key: 'bien_type', label: 'Type de bien', icon: 'Home', source: 'property' },
  { key: 'bien_adresse', label: 'Adresse bien', icon: 'MapPin', source: 'property' },
  { key: 'bien_ville', label: 'Ville bien', icon: 'MapPin', source: 'property' },
  { key: 'bien_prix', label: 'Prix bien', icon: 'Euro', source: 'property' },
  { key: 'bien_surface', label: 'Surface bien', icon: 'Ruler', source: 'property' },
  { key: 'deal_montant', label: 'Montant deal', icon: 'Euro', source: 'deal' },
  { key: 'date_rdv', label: 'Date RDV', icon: 'Calendar', source: 'activity' },
] as const;

export type EmailVariableKey = typeof EMAIL_VARIABLES[number]['key'];

// Sequence template presets
export interface SequenceStep {
  delay_days: number;
  subject: string;
  body: string;
}

export interface SequenceTemplate {
  id: string;
  name: string;
  description: string;
  category: EmailTemplateCategory;
  steps: SequenceStep[];
}

export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    id: 'nurture-cold-lead',
    name: 'Nurture Lead Froid',
    description: 'Réengager un lead inactif en 3 étapes sur 7 jours',
    category: 'nurture',
    steps: [
      {
        delay_days: 0,
        subject: '{contact_prenom}, avez-vous eu le temps de réfléchir ?',
        body: `Bonjour {contact_civilite} {contact_nom},

Je me permets de vous recontacter suite à notre dernier échange. Votre projet immobilier est-il toujours d'actualité ?

Je reste à votre disposition pour en discuter.

{agent_prenom} {agent_nom}`,
      },
      {
        delay_days: 3,
        subject: 'Voici 3 biens qui pourraient vous intéresser',
        body: `Bonjour {contact_civilite} {contact_nom},

En attendant votre retour, voici quelques biens qui pourraient correspondre à vos critères :

[Biens à insérer]

N'hésitez pas à me contacter pour organiser des visites.

{agent_prenom} {agent_nom}`,
      },
      {
        delay_days: 7,
        subject: 'Dernière relance - Je reste à votre disposition',
        body: `Bonjour {contact_civilite} {contact_nom},

Cela fait quelques jours que je n'ai pas eu de nouvelles. Je comprends que votre agenda puisse être chargé.

Sachez que je reste disponible quand vous le souhaitez pour avancer sur votre projet.

À bientôt j'espère,

{agent_prenom} {agent_nom}`,
      },
    ],
  },
  {
    id: 'post-estimation',
    name: 'Suivi post-estimation',
    description: 'Accompagner après une estimation gratuite',
    category: 'mandate',
    steps: [
      {
        delay_days: 0,
        subject: 'Votre rapport d\'estimation - Récapitulatif',
        body: `Bonjour {contact_civilite} {contact_nom},

Suite à notre rendez-vous, je vous confirme l'estimation de votre bien :
📍 {bien_adresse}
💰 Estimation : {bien_prix}

Je reste à votre disposition pour discuter de la mise en vente.

{agent_prenom} {agent_nom}`,
      },
      {
        delay_days: 5,
        subject: 'Avez-vous des questions sur notre estimation ?',
        body: `Bonjour {contact_civilite} {contact_nom},

Je fais suite à l'estimation de votre bien. Avez-vous eu le temps d'y réfléchir ?

Je serais ravi de répondre à toutes vos questions.

{agent_prenom} {agent_nom}`,
      },
      {
        delay_days: 10,
        subject: 'Le marché évolue - Point sur votre projet',
        body: `Bonjour {contact_civilite} {contact_nom},

Le marché immobilier local continue d'évoluer. Si vous envisagez toujours de vendre, c'est peut-être le bon moment.

Souhaitez-vous qu'on fasse le point ensemble ?

{agent_prenom} {agent_nom}`,
      },
    ],
  },
  {
    id: 'buyer-journey',
    name: 'Parcours acheteur',
    description: 'Accompagner un acheteur dans sa recherche',
    category: 'onboarding',
    steps: [
      {
        delay_days: 0,
        subject: 'Bienvenue ! Démarrons votre recherche immobilière',
        body: `Bonjour {contact_civilite} {contact_nom},

Merci pour votre confiance ! Je suis {agent_prenom} {agent_nom} et je serai votre conseiller pour ce projet.

Pour bien démarrer, pourriez-vous me préciser vos critères de recherche ?

À très vite,

{agent_prenom}`,
      },
      {
        delay_days: 2,
        subject: 'Premiers biens sélectionnés pour vous',
        body: `Bonjour {contact_civilite} {contact_nom},

J'ai identifié quelques biens qui pourraient vous correspondre. Les voici :

[Biens à insérer]

Dites-moi lesquels vous intéressent pour organiser des visites !

{agent_prenom} {agent_nom}`,
      },
      {
        delay_days: 7,
        subject: 'Comment avance votre projet ?',
        body: `Bonjour {contact_civilite} {contact_nom},

Cela fait une semaine que nous avons démarré ensemble. Comment avance votre réflexion ?

N'hésitez pas à me faire part de vos retours sur les biens proposés.

À bientôt,

{agent_prenom} {agent_nom}`,
      },
    ],
  },
];

// Helper function to get templates by category
export function getTemplatesByCategory(category: EmailTemplateCategory): EmailTemplate[] {
  return PREDEFINED_EMAIL_TEMPLATES.filter(t => t.category === category);
}

// Helper function to count templates by category
export function getTemplateCounts(): Record<EmailTemplateCategory, number> {
  const counts: Record<EmailTemplateCategory, number> = {
    onboarding: 0,
    followup: 0,
    mandate: 0,
    visit: 0,
    offer: 0,
    nurture: 0,
  };
  
  PREDEFINED_EMAIL_TEMPLATES.forEach(t => {
    counts[t.category]++;
  });
  
  return counts;
}
