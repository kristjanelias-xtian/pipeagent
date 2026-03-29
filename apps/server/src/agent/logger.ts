import { getSupabase } from '../lib/supabase.js';

export async function logActivity(
  runId: string,
  nodeName: string,
  eventType: string,
  payload: Record<string, unknown> = {},
  agentId?: string,
): Promise<void> {
  await getSupabase().from('activity_logs').insert({
    run_id: runId,
    node_name: nodeName,
    event_type: eventType,
    payload,
    agent_id: agentId || null,
  });
}

export async function updateRunStatus(
  runId: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await getSupabase()
    .from('agent_runs')
    .update({ status, ...extra })
    .eq('id', runId);
}

export async function createRun(data: {
  connection_id: string;
  lead_id: string;
  trigger: string;
  agent_id?: string;
}): Promise<string> {
  const { data: run, error } = await getSupabase()
    .from('agent_runs')
    .insert({
      ...data,
      agent_id: data.agent_id || 'lead-qualification',
      status: 'running',
    })
    .select('id')
    .single();

  if (error || !run) throw new Error(`Failed to create run: ${error?.message}`);
  return run.id;
}
