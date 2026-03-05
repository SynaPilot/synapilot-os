// src/types/wizard.types.ts
// Ce fichier sera injecté tel quel dans les prompts Claude Code

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
