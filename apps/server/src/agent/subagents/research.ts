import Anthropic from '@anthropic-ai/sdk';
import { StateGraph, Annotation } from '@langchain/langgraph';
import type { ResearchData } from '@pipeagent/shared';
import { logActivity } from '../logger.js';

const ResearchState = Annotation.Root({
  orgName: Annotation<string>,
  orgAddress: Annotation<string | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  runId: Annotation<string>,
  result: Annotation<ResearchData | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

async function researchAgent(state: typeof ResearchState.State) {
  const { orgName, orgAddress, runId } = state;

  const prompt = `You are a company research analyst. Research the company "${orgName}"${orgAddress ? ` (address: ${orgAddress})` : ''}.

Find and report briefly (keep it tight -- this is a demo):
1. What the company does (one sentence)
2. Approximate employee count
3. Industry/vertical

Use the web search tool sparingly. After gathering enough info, respond with a JSON block in this exact format:

\`\`\`json
{
  "company_description": "...",
  "employee_count": 150,
  "industry": "...",
  "funding_stage": null,
  "tech_stack": [],
  "recent_news": [],
  "website_url": null,
  "raw_summary": "..."
}
\`\`\``;

  await logActivity(runId, 'research', 'phase', { phase: 'opening' });

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
    messages: [{ role: 'user', content: prompt }],
  });

  let textBuffer = '';
  let lastEmit = Date.now();
  const EMIT_INTERVAL_MS = 200;

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        const query = (block.input as { query?: string } | undefined)?.query ?? '';
        await logActivity(runId, 'research', 'phase', { phase: 'searching', query });
      } else if (block.type === 'web_search_tool_result') {
        await logActivity(runId, 'research', 'phase', { phase: 'reading' });
      } else if (block.type === 'text') {
        await logActivity(runId, 'research', 'phase', { phase: 'writing' });
      }
    } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      textBuffer += event.delta.text;
      if (Date.now() - lastEmit > EMIT_INTERVAL_MS) {
        await logActivity(runId, 'research', 'token', { partial: textBuffer });
        lastEmit = Date.now();
      }
    }
  }

  // Final token flush
  if (textBuffer.length > 0) {
    await logActivity(runId, 'research', 'token', { partial: textBuffer });
  }

  const finalMessage = await stream.finalMessage();

  const textContent = finalMessage.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  await logActivity(runId, 'research', 'phase', { phase: 'done' });
  await logActivity(runId, 'research', 'node_exit', {
    response_preview: textContent.slice(0, 300),
    stop_reason: finalMessage.stop_reason,
  });

  const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as ResearchData;
      return { result: parsed };
    } catch {
      // Fall through
    }
  }

  return {
    result: {
      company_description: textContent.slice(0, 500),
      employee_count: null,
      industry: null,
      funding_stage: null,
      tech_stack: [],
      recent_news: [],
      website_url: null,
      raw_summary: textContent,
    } satisfies ResearchData,
  };
}

const researchGraph = new StateGraph(ResearchState)
  .addNode('research', researchAgent)
  .addEdge('__start__', 'research')
  .addEdge('research', '__end__');

export const researchSubgraph = researchGraph.compile();
export type ResearchInput = typeof ResearchState.State;
