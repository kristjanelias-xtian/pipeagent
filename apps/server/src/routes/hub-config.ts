import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import type { AppEnv } from '../middleware/auth.js';

const hubConfig = new Hono<AppEnv>();

hubConfig.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data } = await supabase
    .from('hub_config').select('*').eq('connection_id', connectionId).single();
  return c.json({ config: data || { global_context: '' } });
});

hubConfig.put('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { global_context } = await c.req.json();
  const { data, error } = await supabase
    .from('hub_config')
    .upsert({ connection_id: connectionId, global_context }, { onConflict: 'connection_id' })
    .select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ config: data });
});

export default hubConfig;
