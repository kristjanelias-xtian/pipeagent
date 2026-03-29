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

Find and report:
1. What the company does (brief description)
2. Approximate employee count
3. Industry/vertical
4. Funding stage and notable investors (if applicable)
5. Key technologies they use
6. Recent notable news

Use the web search tool to find this information. Be thorough but concise. After gathering enough info, respond with a JSON block in this exact format:

\`\`\`json
{
  "company_description": "...",
  "employee_count": 150,
  "industry": "...",
  "funding_stage": "Series B",
  "tech_stack": ["React", "AWS"],
  "recent_news": ["Raised $50M in March 2025"],
  "website_url": "https://...",
  "raw_summary": "..."
}
\`\`\``;

  await logActivity(runId, 'research', 'llm_call', { prompt_preview: prompt.slice(0, 200) });

  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text blocks from the response
  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  await logActivity(runId, 'research', 'node_exit', {
    response_preview: textContent.slice(0, 300),
    stop_reason: response.stop_reason,
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
