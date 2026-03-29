import type { AgentRunRow } from '@pipeagent/shared';

interface LeadsListProps {
  runs: AgentRunRow[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
  onGenerateLeads: () => void;
  generating: boolean;
}

const labelColors: Record<string, string> = {
  hot: 'bg-red-500',
  warm: 'bg-amber-500',
  cold: 'bg-blue-500',
};

export function LeadsList({ runs, selectedLeadId, onSelectLead, onGenerateLeads, generating }: LeadsListProps) {
  // Group runs by lead, show latest run per lead
  const leadMap = new Map<string, AgentRunRow>();
  for (const run of runs) {
    const existing = leadMap.get(run.lead_id);
    if (!existing || run.created_at > existing.created_at) {
      leadMap.set(run.lead_id, run);
    }
  }
  const leads = Array.from(leadMap.values());

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Leads</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No leads yet. Generate some!</p>
        )}
        {leads.map((run) => (
          <button
            key={run.lead_id}
            onClick={() => onSelectLead(run.lead_id)}
            className={`w-full text-left p-3 border-b border-gray-800 hover:bg-gray-800/50 transition ${
              selectedLeadId === run.lead_id ? 'bg-gray-800' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-200 truncate">
                {run.lead_id.slice(0, 8)}...
              </span>
              <div className="flex items-center gap-2">
                {run.score != null && (
                  <span className="text-xs text-gray-400">{run.score}</span>
                )}
                {run.label && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${labelColors[run.label]} text-white`}>
                    {run.label.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${
                run.status === 'running' ? 'bg-green-400 animate-pulse' :
                run.status === 'paused' ? 'bg-amber-400' :
                run.status === 'completed' ? 'bg-gray-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-gray-500">{run.status}</span>
              <span className="text-xs text-gray-600">{run.trigger}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={onGenerateLeads}
          disabled={generating}
          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded text-sm font-medium transition"
        >
          {generating ? 'Generating...' : '+ Generate Leads'}
        </button>
      </div>
    </div>
  );
}
