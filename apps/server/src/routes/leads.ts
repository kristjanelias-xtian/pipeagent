import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';

const leads = new Hono();

leads.get('/', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const client = await getClientForConnection(connectionId);
  const data = await client.getLeads({ limit: 50 });
  return c.json(data);
});

export default leads;
