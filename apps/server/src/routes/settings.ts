import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';
import type { AppEnv } from '../middleware/auth.js';

const settings = new Hono<AppEnv>();

settings.get('/webhooks', async (c) => {
  const connectionId = c.get('connectionId');
  try {
    const client = await getClientForConnection(connectionId);
    const result = await (client as any).request('/webhooks');
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

settings.post('/register-webhook', async (c) => {
  const connectionId = c.get('connectionId');
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return c.json({ error: 'WEBHOOK_URL not configured' }, 500);

  try {
    const client = await getClientForConnection(connectionId);
    const result = await client.createWebhook({
      subscription_url: `${webhookUrl}/webhooks/pipedrive`,
      event_action: 'create',
      event_object: 'lead',
    });
    return c.json({ status: 'registered', result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default settings;
