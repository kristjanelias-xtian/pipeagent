import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import type { IcpCriterion } from '@pipeagent/shared';

const settings = new Hono();

const DEFAULT_ICP_CRITERIA: IcpCriterion[] = [
  { name: 'Company Size Fit', description: 'Mid-market (50-1000 employees) scores highest', weight: 10 },
  { name: 'Industry Fit', description: 'Tech, SaaS, and digital-first businesses score highest', weight: 10 },
  { name: 'Budget Signals', description: 'Recent funding, growth indicators suggest budget', weight: 10 },
  { name: 'Timing Signals', description: 'Recent hiring, news, or tech changes suggest active buying', weight: 10 },
];

settings.get('/', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

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
    })
    .select()
    .single();

  return c.json(created);
});

settings.put('/', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const body = await c.req.json();
  const { business_description, value_proposition, icp_criteria, outreach_tone } = body;

  const { data, error } = await getSupabase()
    .from('business_profiles')
    .upsert(
      {
        connection_id: connectionId,
        business_description: business_description ?? '',
        value_proposition: value_proposition ?? '',
        icp_criteria: icp_criteria ?? DEFAULT_ICP_CRITERIA,
        outreach_tone: outreach_tone ?? '',
      },
      { onConflict: 'connection_id' },
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

export default settings;
