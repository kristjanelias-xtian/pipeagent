import { ChatAnthropic } from '@langchain/anthropic';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { StateGraph, Annotation, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
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

const tools = [
  new TavilySearchResults({
    apiKey: process.env.TAVILY_API_KEY,
    maxResults: 5,
  }),
];

const model = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
}).bindTools(tools);

async function researchAgent(state: typeof ResearchState.State) {
  const { orgName, orgAddress, runId, messages } = state;

  if (messages.length === 0) {
    // Initial prompt
    const prompt = `You are a company research analyst. Research the company "${orgName}"${orgAddress ? ` (address: ${orgAddress})` : ''}.

Find and report:
1. What the company does (brief description)
2. Approximate employee count
3. Industry/vertical
4. Funding stage and notable investors (if applicable)
5. Key technologies they use
6. Recent notable news

Use the search tool to find this information. Be thorough but concise. After gathering enough info, respond with a JSON block in this exact format:

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
    const response = await model.invoke([new HumanMessage(prompt)]);
    return { messages: [new HumanMessage(prompt), response] };
  }

  // Continue conversation (tool results fed back)
  const lastMessage = messages[messages.length - 1];
  await logActivity(runId, 'research', 'llm_call', { continuation: true });
  const response = await model.invoke(messages);
  return { messages: [response] };
}

function parseResearchResult(state: typeof ResearchState.State) {
  const { messages, runId } = state;
  const lastMsg = messages[messages.length - 1];
  const content = typeof lastMsg.content === 'string' ? lastMsg.content : '';

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

function shouldContinue(state: typeof ResearchState.State): string {
  const lastMsg = state.messages[state.messages.length - 1];
  if (
    lastMsg &&
    'tool_calls' in lastMsg &&
    Array.isArray(lastMsg.tool_calls) &&
    lastMsg.tool_calls.length > 0
  ) {
    return 'tools';
  }
  return 'parse';
}

const toolNode = new ToolNode(tools);

const researchGraph = new StateGraph(ResearchState)
  .addNode('agent', researchAgent)
  .addNode('tools', toolNode)
  .addNode('parse', parseResearchResult)
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    parse: 'parse',
  })
  .addEdge('tools', 'agent')
  .addEdge('parse', '__end__');

export const researchSubgraph = researchGraph.compile();
export type ResearchInput = typeof ResearchState.State;
