import { Hono } from 'hono';
import { createRun } from '../agent/logger.js';
import { runQualification } from '../agent/graph.js';
import { getSupabase } from '../lib/supabase.js';

const chat = new Hono();

// Trigger a chat-based agent run (skips if lead already has a completed/paused/running run)
chat.post('/message', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const { leadId, message } = (await c.req.json()) as {
    leadId: string;
    message: string;
  };

  if (!leadId || !message) {
    return c.json({ error: 'Missing leadId or message' }, 400);
  }

  // Check for existing run on this lead
  const { data: existingRun } = await getSupabase()
    .from('agent_runs')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('lead_id', leadId)
    .in('status', ['completed', 'paused', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingRun) {
    return c.json({
      existing: true,
      run_id: existingRun.id,
      status: existingRun.status,
      score: existingRun.score,
      label: existingRun.label,
    });
  }

  const runId = await createRun({
    connection_id: connectionId,
    lead_id: leadId,
    trigger: 'chat',
  });

  // Run in background
  runQualification({
    connectionId,
    leadId,
    runId,
    trigger: 'chat',
    userMessage: message,
  }).catch((err) => {
    console.error(`Chat qualification failed for run ${runId}:`, err);
  });

  return c.json({ run_id: runId });
});

// Force a new agent run (requalify), always creates a new run
chat.post('/run', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const { leadId } = (await c.req.json()) as { leadId: string };

  if (!leadId) {
    return c.json({ error: 'Missing leadId' }, 400);
  }

  const runId = await createRun({
    connection_id: connectionId,
    lead_id: leadId,
    trigger: 'chat',
  });

  runQualification({
    connectionId,
    leadId,
    runId,
    trigger: 'chat',
    userMessage: 'Requalify this lead',
  }).catch((err) => {
    console.error(`Requalify failed for run ${runId}:`, err);
  });

  return c.json({ run_id: runId });
});

// Resume a paused run (HITL response)
chat.post('/resume', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const { runId, action, editedEmail } = (await c.req.json()) as {
    runId: string;
    action: 'send' | 'discard' | 'edit';
    editedEmail?: { subject: string; body: string };
  };

  // Resume the graph with the HITL response
  const { getCompiledGraph } = await import('../agent/graph.js');
  const graph = await getCompiledGraph();

  // Get the run to find the thread_id
  const { data: run } = await getSupabase()
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (!run) return c.json({ error: 'Run not found' }, 404);

  const { Command } = await import('@langchain/langgraph');

  // Resume the graph from the interrupt
  graph
    .invoke(new Command({ resume: { action, editedEmail: editedEmail ?? null } }), {
      configurable: {
        thread_id: `${connectionId}-${run.lead_id}-${runId}`,
      },
    })
    .catch((err: Error) => {
      console.error(`Resume failed for run ${runId}:`, err);
    });

  return c.json({ status: 'resumed', run_id: runId });
});

// Get runs for a lead
chat.get('/runs/:leadId', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const leadId = c.req.param('leadId');
  const { data } = await getSupabase()
    .from('agent_runs')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(20);

  return c.json(data ?? []);
});

// Get activity logs for a run
chat.get('/logs/:runId', async (c) => {
  const runId = c.req.param('runId');
  const { data } = await getSupabase()
    .from('activity_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  return c.json(data ?? []);
});

export default chat;
