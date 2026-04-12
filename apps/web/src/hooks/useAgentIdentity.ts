import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import type { AgentIdentityRow, AgentId } from '@pipeagent/shared';
import { getAgent } from '../agents/registry';

function mergeWithDefaults(agentId: AgentId, row: AgentIdentityRow): AgentIdentityRow {
  const defaults = getAgent(agentId)?.defaultIdentity;
  return {
    ...row,
    name: row.name || defaults?.name || '',
    mission: row.mission || defaults?.mission || '',
    personality: row.personality || defaults?.personality || '',
  };
}

export function useAgentIdentity(agentId: AgentId) {
  const [identity, setIdentity] = useState<AgentIdentityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/agent-identity/${agentId}`);
      const data = await res.json();
      setIdentity(mergeWithDefaults(agentId, data.identity));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load identity');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const save = useCallback(
    async (updates: Partial<AgentIdentityRow>) => {
      const res = await apiFetch(`/agent-identity/${agentId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      const merged = mergeWithDefaults(agentId, data.identity);
      setIdentity(merged);
      return merged;
    },
    [agentId],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { identity, loading, error, refetch, save };
}
