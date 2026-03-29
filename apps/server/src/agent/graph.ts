import { StateGraph } from '@langchain/langgraph';
import { AgentState, type AgentStateType } from './state.js';
import { getCheckpointer } from './checkpointer.js';
import { fetchContext } from './nodes/fetchContext.js';
import { checkMemory } from './nodes/checkMemory.js';
import { saveResearch } from './nodes/saveResearch.js';
import { writeBack } from './nodes/writeBack.js';
import { logActivityNode } from './nodes/logActivity.js';
import { researchSubgraph } from './subagents/research.js';
import { scoringSubgraph } from './subagents/scoring.js';
import { outreachSubgraph } from './subagents/outreach.js';
import { logActivity, updateRunStatus } from './logger.js';
import { getSupabase } from '../lib/supabase.js';

// Wrapper nodes that bridge parent state → sub-agent state

async function runResearch(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { organization, runId } = state;
  await logActivity(runId, 'research', 'node_enter', { org: organization?.name });

  const result = await researchSubgraph.invoke({
    orgName: organization?.name ?? 'Unknown',
    orgAddress: organization?.address ?? null,
    runId,
    result: null,
  });

  await logActivity(runId, 'research', 'node_exit', {
    employee_count: result.result?.employee_count,
    industry: result.result?.industry,
  });

  return { research: result.result };
}

async function runScoring(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { research, lead, runId, settings } = state;
  if (!research) return {};

  await logActivity(runId, 'scoring', 'node_enter');

  const result = await scoringSubgraph.invoke({
    research,
    leadTitle: lead?.title ?? 'Unknown Lead',
    runId,
    icpCriteria: settings?.icp_criteria ?? [],
    result: null,
    label: null,
  });

  await logActivity(runId, 'scoring', 'decision', {
    score: result.result?.overall_score,
    label: result.label,
    criteria: result.result?.criteria,
  });

  return { scoring: result.result, label: result.label };
}

async function runOutreach(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { research, scoring, label, lead, person, runId, settings } = state;
  if (!research || !scoring || !label) return {};

  await logActivity(runId, 'outreach', 'node_enter', { label });

  // Only run the drafting part — HITL interrupt is a separate node in parent graph
  const result = await outreachSubgraph.invoke({
    research,
    scoring,
    label,
    leadTitle: lead?.title ?? 'Unknown Lead',
    personName: person?.name ?? null,
    businessDescription: settings?.business_description ?? '',
    valueProposition: settings?.value_proposition ?? '',
    outreachTone: settings?.outreach_tone ?? '',
    runId,
    draft: null,
  });

  return { emailDraft: result.draft };
}

async function hitlReview(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { runId, emailDraft } = state;

  await logActivity(runId, 'outreach', 'decision', {
    type: 'hitl_interrupt',
    message: 'Waiting for human to review email draft',
    draft_subject: emailDraft?.subject,
  });

  // Update run status to paused
  await updateRunStatus(runId, 'paused');

  // interrupt() at the parent graph level — this properly checkpoints
  const { interrupt } = await import('@langchain/langgraph');
  const humanResponse = interrupt({
    type: 'email_review',
    draft: emailDraft,
    actions: ['send', 'edit', 'discard'],
  });

  const action = (humanResponse as { action: string; editedEmail?: { subject: string; body: string } }).action;
  const editedEmail = (humanResponse as { editedEmail?: { subject: string; body: string } }).editedEmail ?? null;

  // Update draft status in DB
  const statusMap: Record<string, string> = { send: 'sent', discard: 'discarded', edit: 'edited' };
  await getSupabase()
    .from('email_drafts')
    .update({ status: statusMap[action] ?? 'pending' })
    .eq('run_id', runId);

  await logActivity(runId, 'outreach', 'decision', { type: 'hitl_response', action });

  return {
    hitlAction: action as 'send' | 'discard' | 'edit',
    editedEmail: editedEmail as AgentStateType['editedEmail'],
  };
}

// Conditional edge functions

function shouldSkipResearch(state: AgentStateType): string {
  return state.memoryFresh ? 'runScoring' : 'runResearch';
}

function shouldSkipOutreach(state: AgentStateType): string {
  return state.label === 'cold' ? 'logActivityNode' : 'runOutreach';
}

// Build the graph

const workflow = new StateGraph(AgentState)
  .addNode('fetchContext', fetchContext)
  .addNode('checkMemory', checkMemory)
  .addNode('runResearch', runResearch)
  .addNode('saveResearch', saveResearch)
  .addNode('runScoring', runScoring)
  .addNode('writeBack', writeBack)
  .addNode('runOutreach', runOutreach)
  .addNode('hitlReview', hitlReview)
  .addNode('logActivityNode', logActivityNode)
  // Edges
  .addEdge('__start__', 'fetchContext')
  .addEdge('fetchContext', 'checkMemory')
  .addConditionalEdges('checkMemory', shouldSkipResearch, {
    runResearch: 'runResearch',
    runScoring: 'runScoring',
  })
  .addEdge('runResearch', 'saveResearch')
  .addEdge('saveResearch', 'runScoring')
  .addEdge('runScoring', 'writeBack')
  .addConditionalEdges('writeBack', shouldSkipOutreach, {
    runOutreach: 'runOutreach',
    logActivityNode: 'logActivityNode',
  })
  .addEdge('runOutreach', 'hitlReview')
  .addEdge('hitlReview', 'logActivityNode')
  .addEdge('logActivityNode', '__end__');

export async function getCompiledGraph() {
  const checkpointer = await getCheckpointer();
  return workflow.compile({ checkpointer });
}

export async function runQualification(input: {
  connectionId: string;
  leadId: string;
  runId: string;
  trigger: 'webhook' | 'chat' | 'manual';
  userMessage?: string;
}): Promise<AgentStateType> {
  const graph = await getCompiledGraph();

  const result = await graph.invoke(
    {
      connectionId: input.connectionId,
      leadId: input.leadId,
      runId: input.runId,
      trigger: input.trigger,
      userMessage: input.userMessage ?? null,
    },
    {
      configurable: { thread_id: `${input.connectionId}-${input.leadId}-${input.runId}` },
    },
  );

  return result;
}
