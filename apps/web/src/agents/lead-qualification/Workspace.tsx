import { useState } from 'react';
import { useConnection } from '../../hooks/useConnection';
import { useLeads } from '../../hooks/useLeads';
import { useAgentRuns, useActivityLogs, useEmailDraft } from '../../hooks/useSupabaseRealtime';
import { useSettings } from '../../hooks/useSettings';
import { LeadsList } from '../../components/LeadsList';
import { AgentInspector } from '../../components/AgentInspector';
import { ChatPanel } from '../../components/ChatPanel';
import { EmailDraftBar } from '../../components/EmailDraftBar';
import { SettingsPanel } from '../../components/SettingsPanel';
import { apiFetch } from '../../lib/api';
import type { BusinessProfile } from '@pipeagent/shared';

export function LeadQualificationWorkspace() {
  const { connectionId } = useConnection();
  const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeads(connectionId);
  const runs = useAgentRuns(connectionId);
  const { settings, saving, saveSettings } = useSettings(connectionId);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Derive the latest run for the selected lead
  const selectedRun = runs
    .filter((r) => r.lead_id === selectedLeadId)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] ?? null;

  const logs = useActivityLogs(selectedRun?.id ?? null);
  const draft = useEmailDraft(selectedRun?.id ?? null);

  const handleRunAgent = async (leadId: string) => {
    try {
      await apiFetch('/chat/run', {
        method: 'POST',
        body: JSON.stringify({ leadId }),
      });
      setSelectedLeadId(leadId);
    } catch (err) {
      console.error('Failed to start agent run:', err);
    }
  };

  const handleGenerateLeads = async () => {
    setGenerating(true);
    try {
      await apiFetch('/seed/generate', { method: 'POST' });
      await refetchLeads();
    } catch (err) {
      console.error('Failed to generate leads:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSettings = async (updated: BusinessProfile) => {
    await saveSettings(updated);
    setShowSettings(false);
  };

  if (leadsLoading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Loading leads...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Settings button row */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-gray-800">
        <button
          onClick={() => setShowSettings(true)}
          className="text-xs text-gray-400 hover:text-white transition"
        >
          Settings
        </button>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Leads list */}
        <div className="w-64 flex-shrink-0 border-r border-gray-800 overflow-hidden">
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

        {/* Center: Agent Inspector */}
        <div className="flex-1 border-r border-gray-800 overflow-hidden">
          <AgentInspector logs={logs} />
        </div>

        {/* Right: Chat */}
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel leadId={selectedLeadId} logs={logs} />
          </div>

          {/* Email draft bar appears at bottom of chat panel when pending */}
          {draft && draft.status === 'pending' && (
            <EmailDraftBar draft={draft} runId={selectedRun?.id ?? null} />
          )}
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          saving={saving}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
