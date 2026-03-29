import { useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import type { DealAnalysisRow, DealChatMessageRow } from '@pipeagent/shared';

export function useDealAnalysis(dealId: number | null) {
  const [analysis, setAnalysis] = useState<DealAnalysisRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<DealChatMessageRow[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const startRes = await apiFetch(`/deals/${dealId}/analyze`, { method: 'POST' });
      const startData = await startRes.json();
      if (startData.runId) setRunId(startData.runId);

      // Poll until result or timeout (60s)
      const start = Date.now();
      const poll = async (): Promise<void> => {
        if (Date.now() - start > 60_000) {
          setLoading(false);
          return;
        }
        const res = await apiFetch(`/deals/${dealId}/analysis`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.health_score != null) {
            setAnalysis(data);
            setLoading(false);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 2000));
        return poll();
      };
      await poll();
    } catch {
      setLoading(false);
    }
  }, [dealId]);

  const sendChat = useCallback(async (message: string) => {
    if (!dealId) return;

    const optimisticMsg: DealChatMessageRow = {
      id: `temp-${Date.now()}`,
      connection_id: '',
      pipedrive_deal_id: dealId,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await apiFetch(`/deals/${dealId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          const assistantMsg: DealChatMessageRow = {
            id: `assistant-${Date.now()}`,
            connection_id: '',
            pipedrive_deal_id: dealId,
            role: 'assistant',
            content: data.reply,
            created_at: new Date().toISOString(),
          };
          setChatMessages((prev) => [...prev, assistantMsg]);
        }
      }
    } catch {
      // Remove optimistic message on failure
      setChatMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    }
  }, [dealId]);

  return { analysis, loading, chatMessages, analyze, sendChat, runId };
}
