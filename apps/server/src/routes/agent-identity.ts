import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import type { AppEnv } from '../middleware/auth.js';

const agentIdentity = new Hono<AppEnv>();

agentIdentity.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data, error } = await getSupabase()
    .from('agent_identity')
    .select('*')
    .eq('connection_id', connectionId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ identities: data ?? [] });
});

agentIdentity.get('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');

  const { data, error } = await getSupabase()
    .from('agent_identity')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);

  if (!data) {
    return c.json({
      identity: {
        connection_id: connectionId,
        agent_id: agentId,
        name: '',
        mission: '',
        personality: '',
        rulebook: '',
        config: {},
      },
    });
  }
  return c.json({ identity: data });
});

agentIdentity.put('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');
  const body = await c.req.json();
  const {
    name = '',
    mission = '',
    personality = '',
    rulebook = '',
    config = {},
  } = body;

  const { data, error } = await getSupabase()
    .from('agent_identity')
    .upsert(
      {
        connection_id: connectionId,
        agent_id: agentId,
        name,
        mission,
        personality,
        rulebook,
        config,
      },
      { onConflict: 'connection_id,agent_id' },
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ identity: data });
});

export default agentIdentity;
