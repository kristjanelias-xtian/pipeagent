import { Hono } from 'hono';
import type { LeadQualificationConfig } from '@pipeagent/shared';
import { getConnectionByPipedriveUser, getConnectionByCompany } from '../lib/connections.js';
import { getSupabase } from '../lib/supabase.js';
import { createRun } from '../agent/logger.js';
import { runQualification } from '../agent/graph.js';

const webhooks = new Hono();

// Pipedrive v2 webhook payload
interface PipedriveV2Webhook {
  data: {
    id: string;
    creator_id?: number;
    owner_id?: number;
    [key: string]: unknown;
  };
  previous: Record<string, unknown> | null;
  meta: {
    action: string;
    object: string;
    id: number | string;
    company_id: number;
    user_id: number;
    [key: string]: unknown;
  };
  // v1 fields (may not exist in v2)
  event?: string;
  v?: number;
}

webhooks.post('/pipedrive', async (c) => {
  const raw = await c.req.json();
  console.log('Webhook payload:', JSON.stringify(raw).slice(0, 500));

  // Support both v1 and v2 payload formats
  // v2: lead data in `data`, meta may have different fields
  // v1: meta.object, meta.action, meta.id
  const payload = raw as PipedriveV2Webhook;

  // Extract lead ID: v2 has data.id, v1 has meta.id
  const leadId = String(payload.data?.id ?? payload.meta?.id ?? '');
  if (!leadId) {
    console.log('Webhook: no lead ID found in payload');
    return c.json({ status: 'ignored', reason: 'no_lead_id' });
  }

  // v1 filter: check meta.object if present (v2 webhooks are pre-filtered by subscription)
  if (payload.meta?.object && payload.meta.object !== 'lead') {
    return c.json({ status: 'ignored', reason: `not_lead: ${payload.meta.object}` });
  }

  // Extract user/company IDs from meta or data
  const userId = payload.meta?.user_id ?? payload.data?.creator_id ?? payload.data?.owner_id;
  const companyId = payload.meta?.company_id;

  console.log(`Webhook lead: id=${leadId} user=${userId} company=${companyId}`);

  // Find the connection
  let connection = null;
  if (userId && companyId) {
    connection = await getConnectionByPipedriveUser(Number(userId), Number(companyId));
  }
  if (!connection && companyId) {
    connection = await getConnectionByCompany(Number(companyId));
  }
  if (!connection) {
    console.log(`Webhook: no connection for user=${userId} company=${companyId}`);
    return c.json({ status: 'ignored', reason: 'no_connection' });
  }

  // Skip if a run already exists for this lead (prevents duplicate notes from duplicate webhooks)
  const { data: existingRun } = await getSupabase()
    .from('agent_runs')
    .select('id, status')
    .eq('connection_id', connection.id)
    .eq('lead_id', leadId)
    .in('status', ['pending', 'running', 'paused', 'completed'])
    .limit(1)
    .maybeSingle();

  if (existingRun) {
    console.log(`Webhook: run already exists for lead ${leadId} (${existingRun.status}), skipping`);
    return c.json({ status: 'ignored', reason: 'run_exists', run_id: existingRun.id });
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
    // Create a pending run so the frontend knows about the new lead via Realtime
    await createRun({
      connection_id: connection.id,
      lead_id: leadId,
      trigger: 'webhook',
      status: 'pending',
    });
    return c.json({ status: 'pending', reason: 'auto_qualify_disabled' });
  }

  // Create a run and kick off qualification (non-blocking)
  const runId = await createRun({
    connection_id: connection.id,
    lead_id: leadId,
    trigger: 'webhook',
  });

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
