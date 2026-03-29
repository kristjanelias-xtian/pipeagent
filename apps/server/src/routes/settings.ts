import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import { getClientForConnection } from '../lib/connections.js';
import type { IcpCriterion } from '@pipeagent/shared';
import type { AppEnv } from '../middleware/auth.js';

const settings = new Hono<AppEnv>();

const DEFAULT_ICP_CRITERIA: IcpCriterion[] = [
  { name: 'Company Size Fit', description: 'Mid-market (50-1000 employees) scores highest', weight: 10 },
  { name: 'Industry Fit', description: 'Tech, SaaS, and digital-first businesses score highest', weight: 10 },
  { name: 'Budget Signals', description: 'Recent funding, growth indicators suggest budget', weight: 10 },
  { name: 'Timing Signals', description: 'Recent hiring, news, or tech changes suggest active buying', weight: 10 },
];

settings.get('/', async (c) => {
  const connectionId = c.get('connectionId');

  const { data } = await getSupabase()
    .from('business_profiles')
    .select('*')
    .eq('connection_id', connectionId)
    .single();

  if (data) {
    return c.json(data);
  }

  // Upsert defaults
  const { data: created } = await getSupabase()
    .from('business_profiles')
    .insert({
      connection_id: connectionId,
      business_description: '',
      value_proposition: '',
      icp_criteria: DEFAULT_ICP_CRITERIA,
      outreach_tone: '',
      followup_days: 3,
    })
    .select()
    .single();

  return c.json(created);
});

settings.put('/', async (c) => {
  const connectionId = c.get('connectionId');

  const body = await c.req.json();
  const { business_description, value_proposition, icp_criteria, outreach_tone, followup_days } = body;

  const { data, error } = await getSupabase()
    .from('business_profiles')
    .upsert(
      {
        connection_id: connectionId,
        business_description: business_description ?? '',
        value_proposition: value_proposition ?? '',
        icp_criteria: icp_criteria ?? DEFAULT_ICP_CRITERIA,
        outreach_tone: outreach_tone ?? '',
        followup_days: followup_days ?? 3,
      },
      { onConflict: 'connection_id' },
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Register Pipedrive webhook for lead.added
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
