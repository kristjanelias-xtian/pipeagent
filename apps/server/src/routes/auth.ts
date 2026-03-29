import { Hono } from 'hono';
import { getAuthorizationUrl, exchangeCodeForToken } from '../pipedrive/oauth.js';
import { upsertConnection, getConnection } from '../lib/connections.js';
import { PipedriveClient } from '../pipedrive/client.js';
import { createSessionToken, type AppEnv } from '../middleware/auth.js';

const auth = new Hono<AppEnv>();

auth.get('/login', (c) => {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  const redirectUri = process.env.PIPEDRIVE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return c.json({ error: 'OAuth not configured' }, 500);
  }

  const state = crypto.randomUUID();
  const url = getAuthorizationUrl(clientId, redirectUri, state);

  return c.redirect(url);
});

auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error || !code) {
    return c.json({ error: error ?? 'Missing code' }, 400);
  }

  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;
  const redirectUri = process.env.PIPEDRIVE_REDIRECT_URI;
  const frontendUrl = process.env.FRONTEND_URL || process.env.PUBLIC_SERVER_URL || '';
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!clientId || !clientSecret || !redirectUri) {
    return c.json({ error: 'OAuth not configured' }, 500);
  }

  try {
    const tokens = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    // api_domain from Pipedrive is like "https://company.pipedrive.com"
    const pdClient = new PipedriveClient(tokens.api_domain, tokens.access_token);

    // Fetch current user info to get pipedrive_user_id and company_id
    const meResponse = await fetch(`${tokens.api_domain}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!meResponse.ok) {
      throw new Error(`Failed to fetch user info: ${meResponse.status}`);
    }

    const meJson = (await meResponse.json()) as {
      success: boolean;
      data: { id: number; company_id: number };
    };

    if (!meJson.success) {
      throw new Error('Failed to fetch user info');
    }

    const { id: pdUserId, company_id: pdCompanyId } = meJson.data;

    const connection = await upsertConnection({
      pipedrive_user_id: pdUserId,
      pipedrive_company_id: pdCompanyId,
      api_domain: tokens.api_domain,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scopes: tokens.scope.split(' '),
    });

    // Register webhook for lead.added
    if (webhookUrl) {
      try {
        await pdClient.createWebhook({
          subscription_url: `${webhookUrl}/webhooks/pipedrive`,
          event_action: 'create',
          event_object: 'lead',
        });
        console.log(`Webhook registered: ${webhookUrl}/webhooks/pipedrive`);
      } catch (webhookErr) {
        console.error('Webhook registration failed:', webhookErr);
      }
    } else {
      console.warn('WEBHOOK_URL not set, skipping webhook registration');
    }

    const token = await createSessionToken({
      connectionId: connection.id,
      pipedriveUserId: pdUserId,
      companyId: pdCompanyId,
    });

    return c.redirect(`${frontendUrl}?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// /auth/me is mounted separately in server.ts (needs auth middleware)

export { auth };
