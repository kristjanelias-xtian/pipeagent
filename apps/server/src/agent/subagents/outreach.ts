import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { ResearchData, ScoringResult, LeadLabel, EmailDraft } from '@pipeagent/shared';
import { logActivity } from '../logger.js';
import { getSupabase } from '../../lib/supabase.js';

const OutreachState = Annotation.Root({
  research: Annotation<ResearchData>,
  scoring: Annotation<ScoringResult>,
  label: Annotation<LeadLabel>,
  leadTitle: Annotation<string>,
  personName: Annotation<string | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  businessDescription: Annotation<string>({
    reducer: (_, n) => n,
    default: () => '',
  }),
  valueProposition: Annotation<string>({
    reducer: (_, n) => n,
    default: () => '',
  }),
  outreachTone: Annotation<string>({
    reducer: (_, n) => n,
    default: () => '',
  }),
  runId: Annotation<string>,
  draft: Annotation<EmailDraft | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

function getModel() {
  return new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
  });
}

async function draftEmail(state: typeof OutreachState.State) {
  const { research, scoring, label, leadTitle, personName, businessDescription, valueProposition, outreachTone, runId } = state;

  const defaultTone =
    label === 'hot'
      ? 'Eager and specific. Reference concrete company details. Show clear value prop.'
      : 'Soft touch, exploratory. Ask discovery questions. Low pressure.';

  const toneGuide = outreachTone || defaultTone;

  const businessContext = businessDescription
    ? `\n**Your Company:** ${businessDescription}`
    : '';
  const valuePropContext = valueProposition
    ? `\n**What you sell:** ${valueProposition}`
    : '';

  const prompt = `You are a sales development representative writing a personalized outreach email.
${businessContext}${valuePropContext}

**Lead:** ${leadTitle}
**Contact:** ${personName ?? 'the team'}
**Company:** ${research.company_description}
**Industry:** ${research.industry ?? 'Unknown'}
**Employees:** ${research.employee_count ?? 'Unknown'}
**Score:** ${scoring.overall_score}/100 (${label.toUpperCase()})
**Key insight:** ${scoring.recommendation}

**Tone:** ${toneGuide}

Write a short, personalized email (3-5 sentences max). No generic templates. Reference specific details about their company. Be human.

Respond with ONLY a JSON block:
\`\`\`json
{
  "subject": "...",
  "body": "..."
}
\`\`\``;

  await logActivity(runId, 'outreach', 'llm_call', { label, person: personName });
  const response = await getModel().invoke([new HumanMessage(prompt)]);
  const content = typeof response.content === 'string' ? response.content : '';

  let draft: EmailDraft = { subject: 'Follow up', body: content };
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      draft = JSON.parse(jsonMatch[1]) as EmailDraft;
    } catch {
      // Use default
    }
  }

  // Save draft to DB
  await getSupabase().from('email_drafts').insert({
    run_id: runId,
    subject: draft.subject,
    body: draft.body,
    status: 'pending',
  });

  await logActivity(runId, 'outreach', 'node_exit', {
    subject: draft.subject,
    body_preview: draft.body.slice(0, 100),
  });

  return { draft };
}

// Outreach sub-graph only handles drafting. HITL interrupt lives in parent graph.
const outreachGraph = new StateGraph(OutreachState)
  .addNode('draftEmail', draftEmail)
  .addEdge('__start__', 'draftEmail')
  .addEdge('draftEmail', '__end__');

export const outreachSubgraph = outreachGraph.compile();
