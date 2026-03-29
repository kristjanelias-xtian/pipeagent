import type { AgentStateType } from '../state.js';
import type { BusinessProfile, IcpCriterion } from '@pipeagent/shared';
import { logActivity } from '../logger.js';
import { getClientForConnection } from '../../lib/connections.js';
import { getSupabase } from '../../lib/supabase.js';

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

  // Fetch business profile / settings
  let settings: BusinessProfile | null = null;
  const { data: profile } = await getSupabase()
    .from('business_profiles')
    .select('business_description, value_proposition, icp_criteria, outreach_tone, followup_days')
    .eq('connection_id', connectionId)
    .single();

  if (profile) {
    settings = {
      business_description: profile.business_description,
      value_proposition: profile.value_proposition,
      icp_criteria: profile.icp_criteria as IcpCriterion[],
      outreach_tone: profile.outreach_tone,
      followup_days: profile.followup_days ?? 3,
    };
  }

  await logActivity(runId, 'fetchContext', 'node_exit', {
    lead_title: lead.title,
    org_name: organization?.name ?? 'none',
    has_settings: !!settings,
  });

  return { lead, person, organization, settings };
}
