import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { DealCoachState, type DealCoachStateType } from './state.js';
import { fetchDealContext, analyzeSignals, scoreHealth, generateActions } from './nodes.js';
import { createRun, updateRunStatus } from '../../agent/logger.js';
import { getSupabase } from '../../lib/supabase.js';

const AGENT_ID = 'deal-coach';

const workflow = new StateGraph(DealCoachState)
  .addNode('fetchDealContext', fetchDealContext)
  .addNode('analyzeSignals', analyzeSignals)
  .addNode('scoreHealth', scoreHealth)
  .addNode('generateActions', generateActions)
  .addEdge(START, 'fetchDealContext')
  .addEdge('fetchDealContext', 'analyzeSignals')
  .addEdge('analyzeSignals', 'scoreHealth')
  .addEdge('scoreHealth', 'generateActions')
  .addEdge('generateActions', END);

const compiledGraph = workflow.compile();

export async function runDealAnalysis(input: {
  connectionId: string;
  dealId: number;
}): Promise<DealCoachStateType> {
  const runId = await createRun({
    connection_id: input.connectionId,
    lead_id: String(input.dealId),
    trigger: 'manual',
    agent_id: AGENT_ID,
  });

  await updateRunStatus(runId, 'running');

  try {
    const result = await compiledGraph.invoke({
      connectionId: input.connectionId,
      dealId: input.dealId,
      runId,
    });

    await updateRunStatus(runId, 'completed', {
      score: result.healthScore,
    });

    return result;
  } catch (err) {
    await updateRunStatus(runId, 'failed', { error: String(err) });
    throw err;
  }
}

export async function chatAboutDeal(input: {
  connectionId: string;
  dealId: number;
  message: string;
}): Promise<string> {
  const supabase = getSupabase();

  // Fetch cached analysis
  const { data: analysis } = await supabase
    .from('deal_analyses')
    .select('*')
    .eq('connection_id', input.connectionId)
    .eq('pipedrive_deal_id', input.dealId)
    .single();

  // Fetch recent chat history
  const { data: history } = await supabase
    .from('deal_chat_messages')
    .select('*')
    .eq('connection_id', input.connectionId)
    .eq('pipedrive_deal_id', input.dealId)
    .order('created_at', { ascending: true })
    .limit(20);

  const llm = new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
  });

  const systemPrompt = analysis
    ? `You are a deal coach assistant. Here is the current deal analysis:
Deal health score: ${analysis.health_score}/100
Signals: ${JSON.stringify(analysis.signals)}
Recommended actions: ${JSON.stringify(analysis.actions)}

Answer questions and provide coaching advice based on this context. Be concise and actionable.`
    : `You are a deal coach assistant. No analysis is available for this deal yet.
Suggest running an analysis first, but answer general sales coaching questions as best you can.`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: input.message },
  ];

  const response = await llm.invoke(messages);
  const assistantMessage =
    typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  // Persist both messages
  await supabase.from('deal_chat_messages').insert([
    {
      connection_id: input.connectionId,
      pipedrive_deal_id: input.dealId,
      role: 'user',
      content: input.message,
    },
    {
      connection_id: input.connectionId,
      pipedrive_deal_id: input.dealId,
      role: 'assistant',
      content: assistantMessage,
    },
  ]);

  return assistantMessage;
}
