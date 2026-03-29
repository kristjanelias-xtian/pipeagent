import { useState } from 'react';
import { useConnection } from './hooks/useConnection';
import { useAgentRuns, useActivityLogs, useEmailDraft } from './hooks/useSupabaseRealtime';
import { apiFetch } from './lib/api';
import { LoginScreen } from './components/LoginScreen';
import { LeadsList } from './components/LeadsList';
import { AgentInspector } from './components/AgentInspector';
import { ChatPanel } from './components/ChatPanel';
import { EmailDraftBar } from './components/EmailDraftBar';

export default function App() {
  const { connectionId, user, loading, login, logout } = useConnection();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const runs = useAgentRuns(connectionId);

  // Find the latest run for selected lead
  const selectedRun = selectedLeadId
    ? runs.find((r) => r.lead_id === selectedLeadId) ?? null
    : null;

  const logs = useActivityLogs(selectedRun?.id ?? null);
  const draft = useEmailDraft(selectedRun?.id ?? null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!connectionId || !user) {
    return <LoginScreen onLogin={login} />;
  }

  const handleGenerateLeads = async () => {
    setGenerating(true);
    try {
      await apiFetch('/seed/generate', {
        method: 'POST',
        body: JSON.stringify({ count: 5 }),
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">PipeAgent</h1>
          <span className="text-xs text-gray-500">{user.api_domain}</span>
        </div>
        <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-300">
          Disconnect
        </button>
      </header>

      {/* Main three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Leads */}
        <div className="w-64 border-r border-gray-800 flex-shrink-0">
          <LeadsList
            runs={runs}
            selectedLeadId={selectedLeadId}
            onSelectLead={setSelectedLeadId}
            onGenerateLeads={handleGenerateLeads}
            generating={generating}
          />
        </div>

        {/* Center: Inspector */}
        <div className="flex-1 border-r border-gray-800 min-w-0">
          <AgentInspector
            logs={logs}
            graphState={selectedRun?.graph_state ?? null}
          />
        </div>

        {/* Right: Chat */}
        <div className="w-80 flex-shrink-0">
          <ChatPanel leadId={selectedLeadId} logs={logs} />
        </div>
      </div>

      {/* Bottom: Email draft bar */}
      <EmailDraftBar draft={draft} runId={selectedRun?.id ?? null} />
    </div>
  );
}
