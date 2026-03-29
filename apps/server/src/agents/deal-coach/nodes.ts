import { ChatAnthropic } from '@langchain/anthropic';
import type { DealSignal, DealAction, PipedrivePerson } from '@pipeagent/shared';
import { logActivity } from '../../agent/logger.js';
import { getClientForConnection } from '../../lib/connections.js';
import { getSupabase } from '../../lib/supabase.js';
import type { DealCoachStateType } from './state.js';

const AGENT_ID = 'deal-coach';

const llm = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

// --- fetchDealContext ---

export async function fetchDealContext(
  state: DealCoachStateType,
): Promise<Partial<DealCoachStateType>> {
  const { connectionId, dealId, runId } = state;

  await logActivity(runId, 'fetchDealContext', 'node_enter', { dealId }, AGENT_ID);

  const client = await getClientForConnection(connectionId);
  const supabase = getSupabase();

  // Fetch deal (required) and optional enrichment data
  const deal = await client.getDeal(dealId);

  // These calls may fail with 403 if OAuth scopes are missing — gracefully degrade
  const safeCall = <T>(fn: () => Promise<T>, fallback: T): Promise<T> =>
    fn().catch(() => fallback);

  const [activities, notes, participantsRaw, stages] = await Promise.all([
    safeCall(() => client.getDealActivities(dealId), []),
    safeCall(() => client.getDealNotes(dealId), []),
    safeCall(() => client.getDealParticipants(dealId), []),
    safeCall(() => client.getStages(), []),
  ]);

  // Resolve participants to persons (may also fail on scope)
  const participants: PipedrivePerson[] = (
    await Promise.all(
      participantsRaw
        .filter((p) => p.person_id)
        .map((p) => safeCall(() => client.getPerson(p.person_id), null as unknown as PipedrivePerson)),
    )
  ).filter(Boolean);

  // Resolve organization if present
  let organization = null;
  if (deal.org_id) {
    organization = await safeCall(() => client.getOrganization(deal.org_id!), null);
  }

  // Resolve stage name
  const stage = stages.find((s) => s.id === deal.stage_id);
  const stageName = stage?.name ?? '';

  // Fetch hub_config and agent_config from Supabase
  const [hubConfigResult, agentConfigResult] = await Promise.all([
    supabase
      .from('hub_config')
      .select('global_context')
      .eq('connection_id', connectionId)
      .single(),
    supabase
      .from('agent_config')
      .select('local_context')
      .eq('connection_id', connectionId)
      .eq('agent_id', AGENT_ID)
      .single(),
  ]);

  const globalContext = hubConfigResult.data?.global_context ?? '';
  const localContext = agentConfigResult.data?.local_context ?? '';

  await logActivity(
    runId,
    'fetchDealContext',
    'node_exit',
    { dealTitle: deal.title, stageName, activitiesCount: activities.length },
    AGENT_ID,
  );

  return { deal, activities, notes, participants, organization, stageName, globalContext, localContext };
}

// --- analyzeSignals ---

export async function analyzeSignals(
  state: DealCoachStateType,
): Promise<Partial<DealCoachStateType>> {
  const { deal, activities, notes, participants, organization, stageName, globalContext, localContext, runId } = state;

  await logActivity(runId, 'analyzeSignals', 'node_enter', {}, AGENT_ID);

  const contextParts: string[] = [];
  if (globalContext) contextParts.push(`Business context: ${globalContext}`);
  if (localContext) contextParts.push(`Deal Coach instructions: ${localContext}`);

  const prompt = `You are analyzing a Pipedrive deal to identify signals about its health.

${contextParts.length ? contextParts.join('\n') + '\n\n' : ''}Deal: "${deal?.title}" — Stage: ${stageName}, Value: ${deal?.value} ${deal?.currency}
Status: ${deal?.status}
Expected close: ${deal?.expected_close_date ?? 'not set'}
Last updated: ${deal?.update_time}
Stage changed: ${deal?.stage_change_time ?? 'unknown'}

Organization: ${organization?.name ?? 'unknown'}

Participants: ${participants.map((p) => p.name).join(', ') || 'none'}

Recent activities (${activities.length}):
${activities.slice(0, 10).map((a) => `- [${a.done ? 'done' : 'pending'}] ${a.type}: ${a.subject} (${a.add_time})`).join('\n') || 'none'}

Notes (${notes.length}):
${notes.slice(0, 5).map((n) => `- ${n.content.slice(0, 200)} (${n.add_time})`).join('\n') || 'none'}

Return a JSON array of signals. Each signal: { "type": "positive"|"negative"|"warning", "text": "<concise signal description>" }
Only return the JSON array, no other text.`;

  const response = await llm.invoke(prompt);
  const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  let signals: DealSignal[] = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      signals = JSON.parse(match[0]) as DealSignal[];
    }
  } catch {
    signals = [];
  }

  await logActivity(runId, 'analyzeSignals', 'node_exit', { signalCount: signals.length }, AGENT_ID);

  return { signals };
}

// --- scoreHealth ---

export async function scoreHealth(
  state: DealCoachStateType,
): Promise<Partial<DealCoachStateType>> {
  const { signals, activities, deal, runId } = state;

  await logActivity(runId, 'scoreHealth', 'node_enter', {}, AGENT_ID);

  const total = signals.length;
  const positive = signals.filter((s) => s.type === 'positive').length;
  const negative = signals.filter((s) => s.type === 'negative').length;

  // Base score from signal ratio
  let score = total > 0 ? Math.round((positive / total) * 100) : 50;

  // Penalize for no recent activity (last 14 days)
  const now = new Date();
  const recentActivity = activities.some((a) => {
    const activityDate = new Date(a.add_time);
    const diffDays = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  });

  if (!recentActivity && activities.length > 0) {
    score = Math.max(0, score - 20);
  }

  // Penalize for negative signals domination
  if (negative > positive) {
    score = Math.max(0, score - 10);
  }

  // Penalize for stale deal (no stage change in 30+ days)
  if (deal?.stage_change_time) {
    const stageChangeDate = new Date(deal.stage_change_time);
    const staleDays = (now.getTime() - stageChangeDate.getTime()) / (1000 * 60 * 60 * 24);
    if (staleDays > 30) {
      score = Math.max(0, score - 15);
    }
  }

  const healthScore = Math.min(100, Math.max(0, score));

  await logActivity(runId, 'scoreHealth', 'node_exit', { healthScore }, AGENT_ID);

  return { healthScore };
}

// --- generateActions ---

export async function generateActions(
  state: DealCoachStateType,
): Promise<Partial<DealCoachStateType>> {
  const { signals, healthScore, deal, stageName, globalContext, localContext, connectionId, dealId, runId, activities } = state;

  await logActivity(runId, 'generateActions', 'node_enter', { healthScore }, AGENT_ID);

  const contextParts: string[] = [];
  if (globalContext) contextParts.push(`Business context: ${globalContext}`);
  if (localContext) contextParts.push(`Deal Coach instructions: ${localContext}`);

  const prompt = `You are a sales coach. Based on the deal analysis below, suggest 3-5 specific actions to advance this deal.

${contextParts.length ? contextParts.join('\n') + '\n\n' : ''}Deal: "${deal?.title}" — Stage: ${stageName}
Health Score: ${healthScore}/100
Expected close: ${deal?.expected_close_date ?? 'not set'}

Signals:
${signals.map((s) => `- [${s.type}] ${s.text}`).join('\n') || 'none'}

Recent activity count: ${activities.length}

Return a JSON array of actions. Each action: { "priority": 1-5 (1=highest), "title": "<action title>", "reasoning": "<why this action>", "actionType": "email"|"task"|"meeting"|"research" }
Only return the JSON array, no other text.`;

  const response = await llm.invoke(prompt);
  const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  let actions: DealAction[] = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      actions = JSON.parse(match[0]) as DealAction[];
    }
  } catch {
    actions = [];
  }

  // Persist analysis to deal_analyses table
  const supabase = getSupabase();
  await supabase.from('deal_analyses').upsert(
    {
      connection_id: connectionId,
      pipedrive_deal_id: dealId,
      health_score: healthScore,
      signals,
      actions,
      raw_context: {
        stageName: stageName,
        dealTitle: deal?.title,
        signalCount: signals.length,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'connection_id,pipedrive_deal_id' },
  );

  await logActivity(
    runId,
    'generateActions',
    'node_exit',
    { actionCount: actions.length, healthScore },
    AGENT_ID,
  );

  return { actions };
}
