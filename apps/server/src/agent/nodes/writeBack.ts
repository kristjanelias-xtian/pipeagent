import type { AgentStateType } from '../state.js';
import { logActivity, updateRunStatus } from '../logger.js';
import { getClientForConnection } from '../../lib/connections.js';

export async function writeBack(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, leadId, scoring, label, research, runId } = state;
  await logActivity(runId, 'writeBack', 'node_enter', { score: scoring?.overall_score, label });

  const client = await getClientForConnection(connectionId);

  if (label) {
    const labels = await client.getLeadLabels();
    const labelMap: Record<string, string> = {
      hot: 'Hot',
      warm: 'Warm',
      cold: 'Cold',
    };
    const targetLabel = labels.find((l) => l.name === labelMap[label]);
    if (targetLabel) {
      await client.updateLead(leadId, { label_ids: [targetLabel.id] });
      await logActivity(runId, 'writeBack', 'tool_call', {
        tool: 'pipedrive.updateLead',
        label: label,
      });
    }
  }

  if (research) {
    const noteContent = [
      `## Agent Qualification Report`,
      `**Score:** ${scoring?.overall_score ?? 'N/A'}/100 (${label?.toUpperCase() ?? 'N/A'})`,
      `**Company:** ${research.company_description}`,
      `**Employees:** ${research.employee_count ?? 'Unknown'}`,
      `**Industry:** ${research.industry ?? 'Unknown'}`,
      `**Funding:** ${research.funding_stage ?? 'Unknown'}`,
      scoring ? `\n### Scoring Breakdown\n${scoring.criteria.map((c) => `- ${c.name}: ${c.score}/${c.max_score} — ${c.reasoning}`).join('\n')}` : '',
      scoring ? `\n**Recommendation:** ${scoring.recommendation}` : '',
    ].join('\n');

    await client.addNote({ content: noteContent, lead_id: leadId });
    await logActivity(runId, 'writeBack', 'tool_call', {
      tool: 'pipedrive.addNote',
      content_length: noteContent.length,
    });
  }

  await updateRunStatus(runId, label === 'cold' ? 'completed' : 'running', {
    score: scoring?.overall_score ?? null,
    label,
  });

  await logActivity(runId, 'writeBack', 'node_exit', { label });
  return {};
}
