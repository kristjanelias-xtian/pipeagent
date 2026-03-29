import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';
import { getSupabase } from '../lib/supabase.js';
import { runDealAnalysis, chatAboutDeal } from '../agents/deal-coach/graph.js';
import type { AppEnv } from '../middleware/auth.js';

const deals = new Hono<AppEnv>();

// GET /deals — list deals from Pipedrive
deals.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const client = await getClientForConnection(connectionId);
  const data = await client.getDeals({ limit: 50 });
  return c.json(data ?? []);
});

// POST /deals/:dealId/analyze — trigger analysis (background)
deals.post('/:dealId/analyze', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));

  if (isNaN(dealId)) {
    return c.json({ error: 'Invalid dealId' }, 400);
  }

  // Run in background
  runDealAnalysis({ connectionId, dealId }).catch((err) => {
    console.error(`Deal analysis failed for deal ${dealId}:`, err);
  });

  return c.json({ status: 'started', dealId });
});

// GET /deals/:dealId/analysis — get cached analysis
deals.get('/:dealId/analysis', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));

  if (isNaN(dealId)) {
    return c.json({ error: 'Invalid dealId' }, 400);
  }

  const { data, error } = await getSupabase()
    .from('deal_analyses')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_deal_id', dealId)
    .single();

  if (error || !data) {
    return c.json({ error: 'No analysis found' }, 404);
  }

  return c.json(data);
});

// POST /deals/:dealId/chat — send chat message
deals.post('/:dealId/chat', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));

  if (isNaN(dealId)) {
    return c.json({ error: 'Invalid dealId' }, 400);
  }

  const { message } = (await c.req.json()) as { message: string };

  if (!message) {
    return c.json({ error: 'Missing message' }, 400);
  }

  const reply = await chatAboutDeal({ connectionId, dealId, message });

  return c.json({ reply });
});

// GET /deals/:dealId/chat — get chat history
deals.get('/:dealId/chat', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));

  if (isNaN(dealId)) {
    return c.json({ error: 'Invalid dealId' }, 400);
  }

  const { data } = await getSupabase()
    .from('deal_chat_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_deal_id', dealId)
    .order('created_at', { ascending: true });

  return c.json(data ?? []);
});

export default deals;
