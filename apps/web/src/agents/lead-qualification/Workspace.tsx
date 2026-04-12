import { useState, useCallback } from 'react';
import { useConnectionContext } from '../../context/ConnectionContext';
import { useLeads } from '../../hooks/useLeads';
import { useAgentRuns, useActivityLogs, useEmailDraft, useLeadNotifications } from '../../hooks/useSupabaseRealtime';
import { useAgentIdentity } from '../../hooks/useAgentIdentity';
import { apiFetch } from '../../lib/api';
import { IdentityRail } from './components/IdentityRail';
import { ActivityStream } from './components/ActivityStream';
import { InboxStrip } from './components/InboxStrip';
import { EmailDraftBar } from '../../components/EmailDraftBar';

const AGENT_ID = 'lead-qualification' as const;

export function LeadQualificationWorkspace() {
  const { connectionId } = useConnectionContext();
  const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeads(connectionId);
  const runs = useAgentRuns(connectionId);
  const { identity } = useAgentIdentity(AGENT_ID);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Refetch leads when webhook notifies of a new lead
  useLeadNotifications(connectionId, refetchLeads);

  const selectedRun = runs
    .filter((r) => r.lead_id === selectedLeadId)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] ?? null;

  const logs = useActivityLogs(selectedRun?.id ?? null);
  const draft = useEmailDraft(selectedRun?.id ?? null);

  const [qualifying, setQualifying] = useState(false);

  const startQualification = useCallback(async (leadId: string) => {
    setQualifying(true);
    try {
      await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ leadId }),
      });
    } finally {
      setQualifying(false);
    }
  }, []);

  const agentName = identity?.name || 'Nora';
  const selectedLead = leads.find((l) => String(l.id) === selectedLeadId);
  const leadTitle = selectedLead?.title ?? 'No lead selected';

  return (
    <div className="flex flex-col h-full gap-2 p-3 overflow-hidden">
      <div className="flex gap-2 flex-1 min-h-0">
        <IdentityRail />

        <div className="flex flex-col flex-1 min-h-0">
          {selectedRun ? (
            <ActivityStream agentName={agentName} leadTitle={leadTitle} logs={logs} />
          ) : selectedLeadId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg">
              <div className="text-sm text-[var(--color-text-secondary)]">{leadTitle}</div>
              <button
                onClick={() => startQualification(selectedLeadId)}
                disabled={qualifying}
                className="px-4 py-2 rounded bg-[var(--color-primary-dark)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {qualifying ? 'Starting...' : 'Qualify this lead'}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)] text-sm bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg">
              Select a lead from the inbox below
            </div>
          )}
        </div>

        <div className="w-[280px] bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col flex-shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-2">
            Verdict
          </div>
          {selectedRun?.score !== null && selectedRun?.score !== undefined ? (
            <ScoreCard score={selectedRun.score} label={selectedRun.label ?? 'warm'} />
          ) : (
            <div className="text-center text-[var(--color-text-tertiary)] text-xs italic py-10">
              {selectedRun ? `${agentName} is still working...` : 'No run selected'}
            </div>
          )}
          {draft && selectedRun && (
            <EmailDraftBar runId={selectedRun.id} draft={draft} />
          )}
        </div>
      </div>

      <InboxStrip
        leads={leads}
        runs={runs}
        selectedLeadId={selectedLeadId}
        onSelect={setSelectedLeadId}
        loading={leadsLoading}
      />
    </div>
  );
}

function ScoreCard({ score, label }: { score: number; label: string }) {
  const color =
    label === 'hot' ? '#dc2626' : label === 'warm' ? '#f59e0b' : '#3b82f6';
  return (
    <div className="text-center">
      <div
        className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-2xl font-bold text-white mb-2"
        style={{ background: color }}
      >
        {score}
      </div>
      <div className="text-xs uppercase tracking-wide font-semibold" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
