// n8n is called exclusively via the trigger-automation Edge Function.
// Do not call n8n webhooks directly from the frontend.
// To trigger an automation, use:
//   supabase.functions.invoke('trigger-automation', { body: { action, payload } })

export type N8nAction =
  | 'qualify_lead'
  | 'generate_mandate'
  | 'send_sms_reminder'
  | 'sync_property'
  | 'notify_agent';
