import type { OrgMemoryRow, ResearchData } from '@pipeagent/shared';
import { getSupabase } from '../lib/supabase.js';

const FRESHNESS_DAYS = 7;

export async function getOrgMemory(
  connectionId: string,
  orgId: number,
): Promise<OrgMemoryRow | null> {
  const { data } = await getSupabase()
    .from('org_memory')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_org_id', orgId)
    .single();

  return (data as OrgMemoryRow) ?? null;
}

export function isMemoryFresh(memory: OrgMemoryRow | null): boolean {
  if (!memory) return false;
  const age = Date.now() - new Date(memory.last_researched_at).getTime();
  return age < FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

export async function saveOrgMemory(
  connectionId: string,
  orgId: number,
  orgName: string,
  researchData: ResearchData,
): Promise<void> {
  await getSupabase()
    .from('org_memory')
    .upsert(
      {
        connection_id: connectionId,
        pipedrive_org_id: orgId,
        org_name: orgName,
        research_data: researchData,
        last_researched_at: new Date().toISOString(),
      },
      { onConflict: 'connection_id,pipedrive_org_id' },
    );
}
