import type { AgentRunRow } from '@pipeagent/shared';
import type { PipedriveLead } from '../hooks/useLeads';

interface LeadsListProps {
  leads: PipedriveLead[];
  runs: AgentRunRow[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
  onRunAgent: (leadId: string) => void;
  onGenerateLeads: () => void;
  generating: boolean;
}

const labelColors: Record<string, string> = {
  hot: 'bg-red-500',
  warm: 'bg-amber-500',
  cold: 'bg-blue-500',
};

export function LeadsList({ leads, runs, selectedLeadId, onSelectLead, onRunAgent, onGenerateLeads, generating }: LeadsListProps) {
  // Map runs by lead_id for quick lookup
  const runMap = new Map<string, AgentRunRow>();
  for (const run of runs) {
    const existing = runMap.get(run.lead_id);
    if (!existing || run.created_at > existing.created_at) {
      runMap.set(run.lead_id, run);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Leads</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No leads yet. Generate some!</p>
        )}
        {leads.map((lead) => {
          const run = runMap.get(lead.id);
          const isSelected = selectedLeadId === lead.id;

          return (
            <button
              key={lead.id}
              onClick={() => onSelectLead(lead.id)}
              className={`w-full text-left p-3 border-b border-gray-800 hover:bg-gray-800/50 transition ${
                isSelected ? 'bg-gray-800' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200 truncate">
                  {lead.title}
                </span>
                <div className="flex items-center gap-2">
                  {run?.score != null && (
                    <span className="text-xs text-gray-400">{run.score}</span>
                  )}
                  {run?.label && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${labelColors[run.label]} text-white`}>
                      {run.label.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {run ? (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      run.status === 'running' ? 'bg-green-400 animate-pulse' :
                      run.status === 'paused' ? 'bg-amber-400' :
                      run.status === 'completed' ? 'bg-gray-500' : 'bg-red-500'
                    }`} />
                    <span className="text-xs text-gray-500">{run.status}</span>
                    {(run.status === 'completed' || run.status === 'failed') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunAgent(lead.id);
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 ml-auto"
                      >
                        Requalify
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunAgent(lead.id);
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Run Agent
                  </button>
                )}
              </div>
            </button>
          );
        })}
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
