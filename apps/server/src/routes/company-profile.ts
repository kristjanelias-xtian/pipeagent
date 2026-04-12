import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import type { AppEnv } from '../middleware/auth.js';

const companyProfile = new Hono<AppEnv>();

companyProfile.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data, error } = await getSupabase()
    .from('company_profile')
    .select('*')
    .eq('connection_id', connectionId)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);

  if (!data) {
    return c.json({
      profile: {
        connection_id: connectionId,
        name: '',
        description: '',
        value_proposition: '',
        service_area: '',
        extra_context: '',
      },
    });
  }
  return c.json({ profile: data });
});

companyProfile.put('/', async (c) => {
  const connectionId = c.get('connectionId');
  const body = await c.req.json();
  const {
    name = '',
    description = '',
    value_proposition = '',
    service_area = '',
    extra_context = '',
  } = body;

  const { data, error } = await getSupabase()
    .from('company_profile')
    .upsert(
      {
        connection_id: connectionId,
        name,
        description,
        value_proposition,
        service_area,
        extra_context,
      },
      { onConflict: 'connection_id' },
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ profile: data });
});

export default companyProfile;
