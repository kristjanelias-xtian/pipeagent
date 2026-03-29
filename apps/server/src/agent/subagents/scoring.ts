import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { ResearchData, ScoringResult, LeadLabel } from '@pipeagent/shared';
import { logActivity } from '../logger.js';

const ScoringState = Annotation.Root({
  research: Annotation<ResearchData>,
  leadTitle: Annotation<string>,
  runId: Annotation<string>,
  result: Annotation<ScoringResult | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  label: Annotation<LeadLabel | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

const model = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

async function scoreLead(state: typeof ScoringState.State) {
  const { research, leadTitle, runId } = state;

  const prompt = `You are a lead qualification analyst for a B2B SaaS company. Score this lead based on the research data below.

**Lead:** ${leadTitle}
**Company:** ${research.company_description}
**Employees:** ${research.employee_count ?? 'Unknown'}
**Industry:** ${research.industry ?? 'Unknown'}
**Funding:** ${research.funding_stage ?? 'Unknown'}
**Tech Stack:** ${research.tech_stack.join(', ') || 'Unknown'}
**Recent News:** ${research.recent_news.join('; ') || 'None'}

Score each criterion from 0-10 and provide reasoning:
1. **Company Size Fit** (0-10): Mid-market (50-1000 employees) scores highest
2. **Industry Fit** (0-10): Tech, SaaS, and digital-first businesses score highest
3. **Budget Signals** (0-10): Recent funding, growth indicators suggest budget
4. **Timing Signals** (0-10): Recent hiring, news, or tech changes suggest active buying

Respond with ONLY a JSON block:
\`\`\`json
{
  "overall_score": 72,
  "confidence": 0.8,
  "criteria": [
    {"name": "Company Size Fit", "score": 8, "max_score": 10, "reasoning": "..."},
    {"name": "Industry Fit", "score": 9, "max_score": 10, "reasoning": "..."},
    {"name": "Budget Signals", "score": 6, "max_score": 10, "reasoning": "..."},
    {"name": "Timing Signals", "score": 7, "max_score": 10, "reasoning": "..."}
  ],
  "recommendation": "Strong fit. Recommend immediate outreach focused on..."
}
\`\`\`

The overall_score should be calculated as: sum of criteria scores * 2.5 (to normalize to 0-100).`;

  await logActivity(runId, 'scoring', 'llm_call', { lead: leadTitle });
  const response = await model.invoke([new HumanMessage(prompt)]);
  const content = typeof response.content === 'string' ? response.content : '';

  await logActivity(runId, 'scoring', 'node_exit', { response_preview: content.slice(0, 300) });

  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[1]) as ScoringResult;
      const label: LeadLabel =
        result.overall_score >= 70 ? 'hot' : result.overall_score >= 40 ? 'warm' : 'cold';
      return { result, label };
    } catch {
      // Fall through
    }
  }

  // Default scoring if parsing fails
  return {
    result: {
      overall_score: 50,
      confidence: 0.3,
      criteria: [],
      recommendation: 'Unable to parse scoring response. Manual review recommended.',
    },
    label: 'warm' as LeadLabel,
  };
}

const scoringGraph = new StateGraph(ScoringState)
  .addNode('score', scoreLead)
  .addEdge('__start__', 'score')
  .addEdge('score', '__end__');

export const scoringSubgraph = scoringGraph.compile();
