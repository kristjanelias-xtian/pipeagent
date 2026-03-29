import { useState } from 'react';
import { useConnection } from './hooks/useConnection';
import { useLeads } from './hooks/useLeads';
import { useSettings } from './hooks/useSettings';
import { useAgentRuns, useActivityLogs, useEmailDraft } from './hooks/useSupabaseRealtime';
import { apiFetch } from './lib/api';
import { LoginScreen } from './components/LoginScreen';
import { LeadsList } from './components/LeadsList';
import { AgentInspector } from './components/AgentInspector';
import { ChatPanel } from './components/ChatPanel';
import { EmailDraftBar } from './components/EmailDraftBar';
import { SettingsPanel } from './components/SettingsPanel';

export default function App() {
  const { connectionId, user, loading, login, logout } = useConnection();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { leads, refetch: refetchLeads } = useLeads(connectionId);
  const { settings, saving: savingSettings, saveSettings } = useSettings(connectionId);
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
      await refetchLeads();
    } finally {
      setGenerating(false);
    }
  };

  const handleRunAgent = async (leadId: string) => {
    try {
      await apiFetch('/chat/run', {
        method: 'POST',
        body: JSON.stringify({ leadId }),
      });
    } catch (err) {
      console.error('Failed to start agent run:', err);
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-400 hover:text-white transition"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-300">
            Disconnect
          </button>
        </div>
      </header>

      {/* Main three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Leads */}
        <div className="w-64 border-r border-gray-800 flex-shrink-0">
          <LeadsList
            leads={leads}
            runs={runs}
            selectedLeadId={selectedLeadId}
            onSelectLead={setSelectedLeadId}
            onRunAgent={handleRunAgent}
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

      {/* Settings modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          saving={savingSettings}
          onSave={async (updated) => {
            await saveSettings(updated);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
