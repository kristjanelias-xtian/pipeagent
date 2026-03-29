import type { AgentStateType } from '../state.js';
import { logActivity as log, updateRunStatus } from '../logger.js';

export async function logActivityNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { runId, scoring, label, emailDraft, hitlAction } = state;

  await log(runId, 'complete', 'node_enter', {
    score: scoring?.overall_score,
    label,
    email_status: hitlAction ?? (label === 'cold' ? 'skipped' : 'pending'),
  });

  await updateRunStatus(runId, 'completed');
  await log(runId, 'complete', 'node_exit', { final: true });

  return {};
}
