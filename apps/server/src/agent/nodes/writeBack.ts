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
    const criteriaRows = scoring
      ? scoring.criteria.map((c) =>
          `<tr><td>${c.name}</td><td><strong>${c.score}/${c.max_score}</strong></td><td>${c.reasoning}</td></tr>`
        ).join('')
      : '';

    const noteContent = [
      `<h2>Agent Qualification Report</h2>`,
      `<p><strong>Score:</strong> ${scoring?.overall_score ?? 'N/A'}/100 (${label?.toUpperCase() ?? 'N/A'})</p>`,
      `<p><strong>Company:</strong> ${research.company_description}</p>`,
      `<p><strong>Employees:</strong> ${research.employee_count ?? 'Unknown'}</p>`,
      `<p><strong>Industry:</strong> ${research.industry ?? 'Unknown'}</p>`,
      `<p><strong>Funding:</strong> ${research.funding_stage ?? 'Unknown'}</p>`,
      scoring ? `<h3>Scoring Breakdown</h3><table><tr><th>Criterion</th><th>Score</th><th>Reasoning</th></tr>${criteriaRows}</table>` : '',
      scoring ? `<p><strong>Recommendation:</strong> ${scoring.recommendation}</p>` : '',
    ].join('');

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
