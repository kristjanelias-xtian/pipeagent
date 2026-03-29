import { useState } from 'react';
import { useConnection } from '../hooks/useConnection';
import { useHubConfig } from '../hooks/useHubConfig';
import { useAgentConfig } from '../hooks/useAgentConfig';
import { agents } from '../agents/registry';

type Tab = 'context' | 'connection' | 'notifications';

function GlobalContextCard() {
  const { globalContext, setGlobalContext, loading, saving, save } = useHubConfig();
  const [draft, setDraft] = useState<string | null>(null);

  const value = draft !== null ? draft : globalContext;

  const handleSave = async () => {
    await save(value);
    setDraft(null);
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
        <div className="text-sm text-[#a8b1b8]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[#1b1f23]">Global Context</h3>
        <p className="text-xs text-[#6a7178] mt-1 leading-relaxed">
          Describe your business, ideal customer profile, and any instructions that apply to all agents. This context is passed to every agent run.
        </p>
      </div>
      <textarea
        className="w-full border border-[#d5d8dc] rounded-md p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#368764]/25 resize-none"
        rows={10}
        placeholder="We are a B2B SaaS company targeting mid-market tech companies. Our ICP is: 50–500 employees, Series A–C funded, using Salesforce or HubSpot. We prioritize companies in fintech and HR tech. Our value proposition is..."
        value={value}
        onChange={e => setDraft(e.target.value)}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#a8b1b8]">
          {saving ? 'Saving...' : draft !== null ? 'Unsaved changes' : 'Saved'}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || draft === null}
          className="bg-[#368764] text-white font-semibold rounded-md px-4 py-2 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d7356] transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function AgentConfigsPanel() {
  const { configs, loading, savingAgent, save } = useAgentConfig();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const getValue = (agentId: string) =>
    drafts[agentId] !== undefined ? drafts[agentId] : (configs[agentId] || '');

  const handleChange = (agentId: string, text: string) => {
    setDrafts(prev => ({ ...prev, [agentId]: text }));
  };

  const handleSave = async (agentId: string) => {
    const text = getValue(agentId);
    await save(agentId, text);
    setDrafts(prev => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[#1b1f23]">Agent Configs</h3>
        <p className="text-xs text-[#6a7178] mt-1 leading-relaxed">
          Override or extend global context for individual agents.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-[#a8b1b8]">Loading...</div>
      ) : (
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] divide-y divide-[#e0e4e8]">
          {agents.map(agent => {
            const isOpen = expanded === agent.id;
            const isSaving = savingAgent === agent.id;
            const hasDraft = drafts[agent.id] !== undefined;

            return (
              <div key={agent.id}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f7f8f9] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : agent.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{agent.icon}</span>
                    <span className="text-[13px] font-medium text-[#1b1f23]">{agent.name}</span>
                    {configs[agent.id] && (
                      <span className="text-[10px] bg-green-50 text-[#368764] px-1.5 py-0.5 rounded-full font-medium">
                        Configured
                      </span>
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-[#a8b1b8] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-2.5 bg-[#fafbfc]">
                    <p className="text-xs text-[#6a7178]">{agent.description}</p>
                    <textarea
                      className="w-full border border-[#d5d8dc] rounded-md p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#368764]/25 resize-none bg-white"
                      rows={5}
                      placeholder={agent.defaultConfig || `Add specific instructions for the ${agent.name} agent...`}
                      value={getValue(agent.id)}
                      onChange={e => handleChange(agent.id, e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#a8b1b8]">
                        {isSaving ? 'Saving...' : hasDraft ? 'Unsaved changes' : 'Saved'}
                      </span>
                      <button
                        onClick={() => handleSave(agent.id)}
                        disabled={isSaving || !hasDraft}
                        className="bg-[#368764] text-white font-semibold rounded-md px-3 py-1.5 text-[12px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d7356] transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[#eef2ff] border border-[#d5deff] text-[#317ae2] rounded-lg p-4 text-[12px] leading-relaxed">
        <strong>Context inheritance:</strong> Global context is always included in every agent run. Agent-specific configs are appended on top, allowing you to customize behavior per agent without losing your global business context.
      </div>
    </div>
  );
}

function BusinessContextTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <GlobalContextCard />
      <AgentConfigsPanel />
    </div>
  );
}

function PipedriveConnectionTab() {
  const { user } = useConnection();

  return (
    <div className="max-w-lg">
      <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#1b1f23]">Pipedrive Connection</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[#e0e4e8]">
            <span className="text-xs text-[#6a7178]">Domain</span>
            <span className="text-xs font-medium text-[#1b1f23]">
              {user?.api_domain || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#e0e4e8]">
            <span className="text-xs text-[#6a7178]">Status</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-[#368764]">Connected</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-[#6a7178]">User ID</span>
            <span className="text-xs font-medium text-[#1b1f23]">
              {user?.pipedrive_user_id || '—'}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            disabled
            className="border border-[#e0e4e8] text-[#6a7178] font-semibold rounded-md px-4 py-2 text-[13px] opacity-50 cursor-not-allowed"
          >
            Disconnect
          </button>
          <p className="text-xs text-[#a8b1b8] mt-2">
            Disconnecting will remove your access token and stop all agent activity.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-[#1b1f23]">Notifications</p>
        <p className="text-xs text-[#a8b1b8]">Coming soon — configure alerts for agent activity, deal changes, and more.</p>
      </div>
    </div>
  );
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('context');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'context', label: 'Business Context' },
    { id: 'connection', label: 'Pipedrive Connection' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1f23]">Settings</h1>
        <p className="text-sm text-[#6a7178] mt-1">
          Configure your agents and manage your Pipedrive connection
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[#e0e4e8]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-[13px] -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-[#368764] text-[#368764] font-semibold'
                : 'text-[#6a7178] hover:text-[#1b1f23]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'context' && <BusinessContextTab />}
      {activeTab === 'connection' && <PipedriveConnectionTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
    </div>
  );
}
