import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, Annotation, messagesStateReducer } from '@langchain/langgraph';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import type { ResearchData } from '@pipeagent/shared';
import { logActivity } from '../logger.js';

const ResearchState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
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

function getModel() {
  return new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
  }).bindTools([
    {
      name: 'web_search',
      type: 'web_search_20250305',
    } as any,
  ]);
}

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

Use the web_search tool to find this information. Be thorough but concise. After gathering enough info, respond with a JSON block in this exact format:

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
  const response = await getModel().invoke([new HumanMessage(prompt)]);
  return { messages: [new HumanMessage(prompt), response] };
}

function extractTextContent(msg: BaseMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');
  }
  return '';
}

function parseResearchResult(state: typeof ResearchState.State) {
  const { messages } = state;
  const lastMsg = messages[messages.length - 1];
  const content = extractTextContent(lastMsg);

  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as ResearchData;
      return { result: parsed };
    } catch {
      // Fall through to default
    }
  }

  // Default if parsing fails
  return {
    result: {
      company_description: content.slice(0, 500),
      employee_count: null,
      industry: null,
      funding_stage: null,
      tech_stack: [],
      recent_news: [],
      website_url: null,
      raw_summary: content,
    } satisfies ResearchData,
  };
}

const researchGraph = new StateGraph(ResearchState)
  .addNode('agent', researchAgent)
  .addNode('parse', parseResearchResult)
  .addEdge('__start__', 'agent')
  .addEdge('agent', 'parse')
  .addEdge('parse', '__end__');

export const researchSubgraph = researchGraph.compile();
export type ResearchInput = typeof ResearchState.State;
