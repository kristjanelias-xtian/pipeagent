import type { AgentRunRow } from '@pipeagent/shared';

interface Lead {
  id: string;
  title: string;
}

export function InboxStrip({
  leads,
  runs,
  selectedLeadId,
  onSelect,
}: {
  leads: Lead[];
  runs: AgentRunRow[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
}) {
  const runByLead = new Map(runs.map((r) => [r.lead_id, r]));

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg overflow-x-auto flex-shrink-0">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mr-2 flex-shrink-0">
        Inbox
      </span>

      {leads.length === 0 && (
        <span className="text-xs text-[var(--color-text-tertiary)] italic">
          No leads yet.
        </span>
      )}

      {leads.map((lead) => {
        const run = runByLead.get(String(lead.id));
        const isSelected = String(lead.id) === selectedLeadId;
        const isRunning = run?.status === 'running';
        return (
          <button
            key={lead.id}
            onClick={() => onSelect(String(lead.id))}
            className={`min-w-[160px] flex-shrink-0 text-left px-2.5 py-1.5 rounded border text-xs transition ${
              isSelected
                ? 'border-[var(--color-primary-dark)] bg-[#f0faf5]'
                : 'border-[var(--color-border-default)] hover:border-[var(--color-primary-bright)]'
            }`}
          >
            <div className="text-[var(--color-text-primary)] font-medium truncate">{lead.title}</div>
            <div className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1 mt-0.5">
              {isRunning && <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
              {run?.status ?? 'idle'}
              {run?.score !== null && run?.score !== undefined && ` -- ${run.score}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
