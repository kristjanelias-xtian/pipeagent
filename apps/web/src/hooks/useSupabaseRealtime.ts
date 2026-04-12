import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLogRow, AgentRunRow, EmailDraftRow } from '@pipeagent/shared';

export function useActivityLogs(runId: string | null) {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    if (!runId) { setLogs([]); return; }

    // Fetch existing logs
    supabase
      .from('activity_logs')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setLogs((data as ActivityLogRow[]) ?? []));

    // Subscribe to new logs
    const channel = supabase
      .channel(`logs-${runId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `run_id=eq.${runId}` },
        (payload) => {
          setLogs((prev) => [...prev, payload.new as ActivityLogRow]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);

  return logs;
}

export function useAgentRuns(connectionId: string | null) {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);

  useEffect(() => {
    if (!connectionId) return;

    supabase
      .from('agent_runs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setRuns((data as AgentRunRow[]) ?? []));

    const channel = supabase
      .channel(`runs-${connectionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_runs', filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRuns((prev) => [payload.new as AgentRunRow, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRuns((prev) =>
              prev.map((r) => (r.id === (payload.new as AgentRunRow).id ? (payload.new as AgentRunRow) : r)),
            );
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [connectionId]);

  return runs;
}

export function useEmailDraft(runId: string | null) {
  const [draft, setDraft] = useState<EmailDraftRow | null>(null);

  useEffect(() => {
    if (!runId) { setDraft(null); return; }

    supabase
      .from('email_drafts')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setDraft((data as EmailDraftRow) ?? null));

    const channel = supabase
      .channel(`draft-${runId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_drafts', filter: `run_id=eq.${runId}` },
        (payload) => setDraft(payload.new as EmailDraftRow),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);

  return draft;
}
