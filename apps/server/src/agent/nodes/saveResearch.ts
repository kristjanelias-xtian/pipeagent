import type { AgentStateType } from '../state.js';
import { logActivity } from '../logger.js';
import { saveOrgMemory } from '../../memory/orgMemory.js';

export async function saveResearch(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, organization, research, runId } = state;
  await logActivity(runId, 'saveResearch', 'node_enter');

  if (organization && research) {
    await saveOrgMemory(connectionId, organization.id, organization.name, research);
    await logActivity(runId, 'saveResearch', 'node_exit', {
      org: organization.name,
      saved: true,
    });
  }

  return {};
}
