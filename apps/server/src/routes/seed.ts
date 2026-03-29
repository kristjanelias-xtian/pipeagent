import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';
import { generateLeads } from '../seed/generator.js';

const seed = new Hono();

seed.post('/generate', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const { count = 5 } = (await c.req.json()) as { count?: number };
  const clampedCount = Math.min(Math.max(count, 1), 10);

  const client = await getClientForConnection(connectionId);
  const result = await generateLeads(client, clampedCount);

  return c.json(result);
});

export default seed;
