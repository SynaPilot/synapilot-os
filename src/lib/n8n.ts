// n8n Webhook Integration
// Configure VITE_N8N_WEBHOOK_URL in your environment

type N8nAction = 
  | 'qualify_lead'
  | 'generate_mandate'
  | 'send_sms_reminder'
  | 'sync_property'
  | 'notify_agent';

interface N8nPayload {
  action: N8nAction;
  [key: string]: unknown;
}

export async function callN8nWebhook(action: N8nAction, payload: Record<string, unknown> = {}) {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('N8N_WEBHOOK_URL not configured - action skipped:', action);
    return { success: false, error: 'Webhook not configured' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload } as N8nPayload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('n8n webhook error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
