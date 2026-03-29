import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';
import type { AppEnv } from '../middleware/auth.js';

const leads = new Hono<AppEnv>();

leads.get('/', async (c) => {
  const connectionId = c.get('connectionId');

  const client = await getClientForConnection(connectionId);
  const data = await client.getLeads({ limit: 50 });
  return c.json(data);
});

export default leads;
