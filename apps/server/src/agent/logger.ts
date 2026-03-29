import { getSupabase } from '../lib/supabase.js';

export async function logActivity(
  runId: string,
  nodeName: string,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await getSupabase().from('activity_logs').insert({
    run_id: runId,
    node_name: nodeName,
    event_type: eventType,
    payload,
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
}): Promise<string> {
  const { data: run, error } = await getSupabase()
    .from('agent_runs')
    .insert(data)
    .select('id')
    .single();

  if (error || !run) throw new Error(`Failed to create run: ${error?.message}`);
  return run.id;
}
