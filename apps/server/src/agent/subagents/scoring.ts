import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { ResearchData, ScoringResult, LeadLabel, IcpCriterion } from '@pipeagent/shared';
import { logActivity } from '../logger.js';

const DEFAULT_CRITERIA: IcpCriterion[] = [
  { name: 'Company Size Fit', description: 'Mid-market (50-1000 employees) scores highest', weight: 10 },
  { name: 'Industry Fit', description: 'Tech, SaaS, and digital-first businesses score highest', weight: 10 },
  { name: 'Budget Signals', description: 'Recent funding, growth indicators suggest budget', weight: 10 },
  { name: 'Timing Signals', description: 'Recent hiring, news, or tech changes suggest active buying', weight: 10 },
];

const ScoringState = Annotation.Root({
  research: Annotation<ResearchData>,
  leadTitle: Annotation<string>,
  runId: Annotation<string>,
  icpCriteria: Annotation<IcpCriterion[]>({
    reducer: (_, n) => n,
    default: () => [],
  }),
  result: Annotation<ScoringResult | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  label: Annotation<LeadLabel | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

function getModel() {
  return new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
  });
}

async function scoreLead(state: typeof ScoringState.State) {
  const { research, leadTitle, runId, icpCriteria } = state;

  const criteria = icpCriteria.length > 0 ? icpCriteria : DEFAULT_CRITERIA;
  const maxPossible = criteria.reduce((sum, c) => sum + c.weight, 0);

  const criteriaLines = criteria
    .map((c, i) => `${i + 1}. **${c.name}** (0-${c.weight}): ${c.description}`)
    .join('\n');

  const criteriaExample = criteria
    .map((c) => `    {"name": "${c.name}", "score": ${Math.round(c.weight * 0.7)}, "max_score": ${c.weight}, "reasoning": "..."}`)
    .join(',\n');

  const prompt = `You are a lead qualification analyst. Score this lead based on the research data below.

**Lead:** ${leadTitle}
**Company:** ${research.company_description}
**Employees:** ${research.employee_count ?? 'Unknown'}
**Industry:** ${research.industry ?? 'Unknown'}
**Funding:** ${research.funding_stage ?? 'Unknown'}
**Tech Stack:** ${research.tech_stack.join(', ') || 'Unknown'}
**Recent News:** ${research.recent_news.join('; ') || 'None'}

Score each criterion and provide reasoning:
${criteriaLines}

Respond with ONLY a JSON block:
\`\`\`json
{
  "overall_score": 72,
  "confidence": 0.8,
  "criteria": [
${criteriaExample}
  ],
  "recommendation": "..."
}
\`\`\`

The overall_score should be calculated as: (sum of criteria scores / ${maxPossible}) * 100, normalized to 0-100.`;

  await logActivity(runId, 'scoring', 'llm_call', { lead: leadTitle, criteria_count: criteria.length });
  const response = await getModel().invoke([new HumanMessage(prompt)]);
  const content = typeof response.content === 'string' ? response.content : '';

  await logActivity(runId, 'scoring', 'node_exit', { response_preview: content.slice(0, 300) });

  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[1]) as ScoringResult;
      // Normalize score to 0-100 based on actual max possible
      const rawSum = result.criteria.reduce((sum, c) => sum + c.score, 0);
      result.overall_score = Math.round((rawSum / maxPossible) * 100);
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
