import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';
import { generateLeads } from '../seed/generator.js';
import type { AppEnv } from '../middleware/auth.js';

const seed = new Hono<AppEnv>();

seed.post('/generate', async (c) => {
  const connectionId = c.get('connectionId');

  const client = await getClientForConnection(connectionId);
  const result = await generateLeads(client);

  return c.json(result);
});

export default seed;
