# WIZARD_SPEC — SynaPilot Onboarding Wizard

## Stack
- React 18 + TypeScript strict
- Tailwind CSS + Shadcn/UI (déjà installés)
- Framer Motion (déjà installé)
- Zustand (state management wizard)
- react-hook-form + zod (validation formulaires)
- Supabase JS client (déjà configuré dans src/lib/supabase.ts)

## Design system
- Background: bg-zinc-950 / bg-zinc-900
- Glassmorphism: bg-white/5 backdrop-blur border border-white/10
- Accent primaire: violet-600 / indigo-500
- Succès: green-500 | Erreur: red-500 | Warning: amber-500
- Texte principal: text-zinc-100 | Secondaire: text-zinc-400
- Composants: Shadcn/UI (Button, Input, Label, Card, Badge, Progress)
- Animations: Framer Motion — spring, stagger, scale-in

## Schéma Supabase (tables concernées)

### organizations
- id: uuid PK
- name: text (pré-rempli wizard step 1)
- slug: text unique
- logo_url: text nullable (pré-rempli wizard step 1)
- settings: jsonb (stocke { smtp: {...}, agent_count: n })
- onboarding_completed: boolean DEFAULT false  ← NOUVELLE
- director_email: text nullable               ← NOUVELLE
- whatsapp_number: text nullable              ← NOUVELLE
- updated_at: timestamp

### profiles
- id: uuid PK
- user_id: uuid → auth.users
- organization_id: uuid → organizations
- email: text
- full_name: text

### user_roles
- user_id: uuid → auth.users
- organization_id: uuid → organizations
- role: app_role enum ('admin' | 'director' | 'agent')

### subscriptions
- organization_id: uuid
- seats: integer (= nombre d'agents)
- status: text

## Types TypeScript
"// src/types/wizard.types.ts

export interface WizardStepData {
  step1: AgencyData;
  step2: EmailConfigData;
  step3: NotificationsData;
}

export interface AgencyData {
  org_name: string;        // pré-rempli depuis organizations.name
  logo_url: string | null; // pré-rempli depuis organizations.logo_url
  agent_count: number;     // miroir de subscriptions.seats
}

export interface EmailConfigData {
  smtp_host: string;
  smtp_port: number;       // défaut: 587
  smtp_user: string;
  smtp_password: string;
  test_passed: boolean;    // le bouton "Tester" doit passer à true
}

export interface NotificationsData {
  director_email: string;
  whatsapp_number: string | null;
}

// Payload envoyé à N8N
export interface N8NProvisioningPayload {
  organization_id: string;
  org_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;   // chiffré par l'Edge Function avant envoi
  director_email: string;
  whatsapp_number: string | null;
  agent_emails: string[];  // fetchés depuis profiles WHERE organization_id
  agent_count: number;
}

// Réponse N8N attendue
export interface N8NProvisioningResponse {
  success: boolean;
  workflows_activated: number; // idéalement 8
  error?: string;
}
"

## Fichiers à créer / modifier

src/
├── types/wizard.types.ts          ← types + payload N8N
├── store/wizardStore.ts           ← Zustand store
├── hooks/useOnboardingGuard.ts    ← redirect guard
├── pages/Onboarding.tsx           ← page principale
├── components/wizard/
│   ├── WizardLayout.tsx           ← shell + stepper
│   ├── Step1AgencyInfo.tsx
│   ├── Step2EmailConfig.tsx
│   ├── Step3Notifications.tsx
│   └── Step4Activation.tsx
└── lib/
    └── wizardApi.ts               ← calls Edge Functions

## Edge Functions Supabase
- supabase/functions/test-smtp/index.ts
- supabase/functions/trigger-n8n-provisioning/index.ts

## Variables d'environnement
VITE_SUPABASE_URL="https://svtwaxnaghrjyogcljnp.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2dHdheG5hZ2hyanlvZ2Nsam5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MzA1NTgsImV4cCI6MjA4MzIwNjU1OH0.-NEmSNvKezv6v3ObwfOd_B0YgcHbn_2yRbrsroibNb0"
N8N_WEBHOOK_URL = "https://n8n.synapilot.fr/webhook/synapilot"

## Routing
Route: /onboarding
Guard: si onboarding_completed = true OU role !== 'admin' → redirect /dashboard
Le wizard ne doit jamais s'afficher à un agent lambda.

## Comportement critique Step 4
- S'auto-déclenche au montage (useEffect, pas de bouton "Lancer")
- Affiche 8 workflow cards qui s'activent avec 600ms stagger
- Appelle trigger-n8n-provisioning Edge Function
- En cas d'erreur : retry possible, jamais de blocage définitif
- En cas de succès : confetti + CTA "Accéder au Dashboard"

## N8N
- URL unique : https://n8n.synapilot.fr/webhook/synapilot
- Payload requis pour le provisioning :
  {
    "action": "provision_org",
    "organization_id": "uuid",
    "org_name": "string",
    "smtp_host": "string",
    "smtp_port": 587,
    "smtp_user": "string",
    "smtp_password": "string",
    "director_email": "string",
    "whatsapp_number": "string | null",
    "agent_emails": ["string"],
    "agent_count": 5
  }
