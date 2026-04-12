import type { AgentStateType } from '../state.js';
import { logActivity as log, updateRunStatus } from '../logger.js';
import { getClientForConnection } from '../../lib/connections.js';

export async function logActivityNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { runId, connectionId, leadId, person, organization, scoring, label, emailDraft, editedEmail, hitlAction, identity } = state;

  await log(runId, 'complete', 'node_enter', {
    score: scoring?.overall_score,
    label,
    email_status: hitlAction ?? (label === 'cold' ? 'skipped' : 'pending'),
  });

  if (hitlAction === 'send') {
    const finalEmail = editedEmail ?? emailDraft;
    if (finalEmail) {
      try {
        const client = await getClientForConnection(connectionId);

        // Activity 1: Completed email
        await client.createActivity({
          subject: finalEmail.subject,
          type: 'email',
          done: 1,
          lead_id: leadId,
          person_id: person?.id,
          org_id: organization?.id,
          note: finalEmail.body,
        });

        await log(runId, 'complete', 'pipedrive_activity_created', {
          activity: 'email_sent',
          subject: finalEmail.subject,
        });

        // Activity 2: Scheduled follow-up
        const followupDays =
          (identity?.config as { followup_days?: number } | undefined)?.followup_days ?? 3;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + followupDays);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        await client.createActivity({
          subject: `Follow up: ${finalEmail.subject}`,
          type: 'email',
          done: 0,
          due_date: dueDateStr,
          lead_id: leadId,
          person_id: person?.id,
          org_id: organization?.id,
        });

        await log(runId, 'complete', 'pipedrive_activity_created', {
          activity: 'followup_scheduled',
          due_date: dueDateStr,
          followup_days: followupDays,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await log(runId, 'complete', 'pipedrive_activity_error', { error: message });
      }
    }
  }

  await updateRunStatus(runId, 'completed');
  await log(runId, 'complete', 'node_exit', { final: true });

  return {};
}
