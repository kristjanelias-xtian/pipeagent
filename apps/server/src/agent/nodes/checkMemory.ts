import type { AgentStateType } from '../state.js';
import { logActivity } from '../logger.js';
import { getOrgMemory, isMemoryFresh } from '../../memory/orgMemory.js';

export async function checkMemory(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, organization, runId } = state;
  await logActivity(runId, 'checkMemory', 'node_enter');

  if (!organization) {
    await logActivity(runId, 'checkMemory', 'node_exit', { result: 'no_org' });
    return { existingResearch: null, memoryFresh: false };
  }

  const memory = await getOrgMemory(connectionId, organization.id);
  const fresh = isMemoryFresh(memory);

  await logActivity(runId, 'checkMemory', 'node_exit', {
    org: organization.name,
    has_memory: !!memory,
    fresh,
    last_researched: memory?.last_researched_at ?? null,
  });

  return {
    existingResearch: memory?.research_data ?? null,
    memoryFresh: fresh,
    research: fresh ? memory!.research_data : null,
  };
}
