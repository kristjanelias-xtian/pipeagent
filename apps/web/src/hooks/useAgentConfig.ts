import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { AgentConfigRow } from '@pipeagent/shared';

export function useAgentConfig() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingAgent, setSavingAgent] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/agent-config').then(async res => {
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        (data.configs as AgentConfigRow[]).forEach(c => { map[c.agent_id] = c.local_context; });
        setConfigs(map);
      }
      setLoading(false);
    });
  }, []);

  const save = async (agentId: string, localContext: string) => {
    setSavingAgent(agentId);
    await apiFetch(`/agent-config/${agentId}`, { method: 'PUT', body: JSON.stringify({ local_context: localContext }) });
    setConfigs(prev => ({ ...prev, [agentId]: localContext }));
    setSavingAgent(null);
  };

  return { configs, loading, savingAgent, save };
}
