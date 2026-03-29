import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import type { AppEnv } from '../middleware/auth.js';

const agentConfig = new Hono<AppEnv>();

agentConfig.get('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');
  const { data } = await supabase
    .from('agent_config').select('*').eq('connection_id', connectionId).eq('agent_id', agentId).single();
  return c.json({ config: data || { agent_id: agentId, local_context: '' } });
});

agentConfig.put('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');
  const { local_context } = await c.req.json();
  const { data, error } = await supabase
    .from('agent_config')
    .upsert({ connection_id: connectionId, agent_id: agentId, local_context }, { onConflict: 'connection_id,agent_id' })
    .select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ config: data });
});

agentConfig.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data } = await supabase
    .from('agent_config').select('*').eq('connection_id', connectionId);
  return c.json({ configs: data || [] });
});

export default agentConfig;
