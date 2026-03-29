import type { AgentStateType } from '../state.js';
import { logActivity } from '../logger.js';
import { getClientForConnection } from '../../lib/connections.js';

export async function fetchContext(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, leadId, runId } = state;
  await logActivity(runId, 'fetchContext', 'node_enter', { leadId });

  const client = await getClientForConnection(connectionId);
  const lead = await client.getLead(leadId);

  await logActivity(runId, 'fetchContext', 'tool_call', {
    tool: 'pipedrive.getLead',
    result: { title: lead.title, person_id: lead.person_id, org_id: lead.organization_id },
  });

  let person = null;
  let organization = null;

  if (lead.person_id) {
    person = await client.getPerson(lead.person_id);
    await logActivity(runId, 'fetchContext', 'tool_call', {
      tool: 'pipedrive.getPerson',
      result: { name: person.name },
    });
  }

  if (lead.organization_id) {
    organization = await client.getOrganization(lead.organization_id);
    await logActivity(runId, 'fetchContext', 'tool_call', {
      tool: 'pipedrive.getOrganization',
      result: { name: organization.name },
    });
  }

  await logActivity(runId, 'fetchContext', 'node_exit', {
    lead_title: lead.title,
    org_name: organization?.name ?? 'none',
  });

  return { lead, person, organization };
}
