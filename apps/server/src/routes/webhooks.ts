import { Hono } from 'hono';
import type { PipedriveWebhookPayload } from '../pipedrive/types.js';
import type { LeadQualificationConfig } from '@pipeagent/shared';
import { getConnectionByPipedriveUser } from '../lib/connections.js';
import { getSupabase } from '../lib/supabase.js';
import { createRun } from '../agent/logger.js';
import { runQualification } from '../agent/graph.js';

const webhooks = new Hono();

webhooks.post('/pipedrive', async (c) => {
  const payload = (await c.req.json()) as PipedriveWebhookPayload;

  // Only handle lead.added events
  if (payload.meta.object !== 'lead' || (payload.meta.action !== 'added' && payload.meta.action !== 'create')) {
    return c.json({ status: 'ignored', reason: `${payload.meta.action}.${payload.meta.object}` });
  }

  const leadId = String(payload.meta.id);
  const { company_id, user_id } = payload.meta;

  // Find the connection for this user
  const connection = await getConnectionByPipedriveUser(user_id, company_id);
  if (!connection) {
    return c.json({ status: 'ignored', reason: 'no_connection' });
  }

  // Check if auto-qualification is enabled
  const { data: identity } = await getSupabase()
    .from('agent_identity')
    .select('config')
    .eq('connection_id', connection.id)
    .eq('agent_id', 'lead-qualification')
    .maybeSingle();

  const config = (identity?.config ?? {}) as Partial<LeadQualificationConfig>;
  if (!config.auto_qualify) {
    return c.json({ status: 'ignored', reason: 'auto_qualify_disabled' });
  }

  // Create a run and kick off qualification (non-blocking)
  const runId = await createRun({
    connection_id: connection.id,
    lead_id: leadId,
    trigger: 'webhook',
  });

  // Run qualification in background (don't await)
  runQualification({
    connectionId: connection.id,
    leadId,
    runId,
    trigger: 'webhook',
  }).catch((err) => {
    console.error(`Qualification failed for run ${runId}:`, err);
  });

  return c.json({ status: 'accepted', run_id: runId });
});

export default webhooks;
