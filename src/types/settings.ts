export interface OrgSettings {
  automations?: {
    qualify_lead: boolean;       // default: true
    send_sms_reminder: boolean;  // default: true
    notify_agent: boolean;       // default: true
    sync_property: boolean;      // default: false
  };
  communications?: {
    sms_enabled: boolean;        // default: true
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
