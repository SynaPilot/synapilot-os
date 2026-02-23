export interface N8nIntegrationSettings {
  webhook_url: string;
  enabled: boolean;
}

export interface TwilioIntegrationSettings {
  account_sid: string;
  auth_token: string;
  from_number: string;
  enabled: boolean;
}

export interface OrgSettings {
  integrations?: {
    n8n?: N8nIntegrationSettings;
    twilio?: TwilioIntegrationSettings;
  };
}

export interface NotificationSettings {
  email_followup_reminder: boolean;
  email_new_lead: boolean;
  in_app_deal_update: boolean;
  daily_brief: boolean;
}

export interface ProfileSettings {
  notifications?: NotificationSettings;
}
