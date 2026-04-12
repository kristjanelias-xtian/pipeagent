import { useState } from 'react';
import { useConnectionContext } from '../context/ConnectionContext';
import { CompanyProfileEditor } from '../components/CompanyProfileEditor';
import { useCompanyProfile } from '../hooks/useCompanyProfile';

type Tab = 'context' | 'connection' | 'notifications';

function CompanyContextTab() {
  const { profile, loading } = useCompanyProfile();
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="max-w-2xl">
      <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Company Profile</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
            Shared context available to every agent. Edit your company profile to update name, description, value proposition, and more.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-[var(--color-text-tertiary)]">Loading...</div>
        ) : (
          <div className="space-y-2 text-sm">
            <Row label="Name" value={profile?.name} />
            <Row label="Description" value={profile?.description} />
            <Row label="Value proposition" value={profile?.value_proposition} />
            <Row label="Service area" value={profile?.service_area} />
          </div>
        )}

        <button
          onClick={() => setShowEditor(true)}
          className="px-4 py-2 bg-[var(--color-primary-dark)] text-white font-semibold rounded text-sm hover:bg-[var(--color-primary-bright)] transition-colors"
        >
          Edit company profile
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg p-4 text-xs leading-relaxed mt-4">
        <strong>Agent identities</strong> are now configured per-agent inside each agent workspace. Open an agent and click "Edit identity" to set its name, mission, personality, ICP criteria, and rulebook.
      </div>

      {showEditor && <CompanyProfileEditor onClose={() => setShowEditor(false)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-[var(--color-border-subtle)]">
      <span className="text-xs text-[var(--color-text-tertiary)] w-32 flex-shrink-0">{label}</span>
      <span className="text-xs text-[var(--color-text-primary)]">{value || '--'}</span>
    </div>
  );
}

function PipedriveConnectionTab() {
  const { user } = useConnectionContext();

  return (
    <div className="max-w-lg">
      <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Pipedrive Connection</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)]">
            <span className="text-xs text-[var(--color-text-tertiary)]">Domain</span>
            <span className="text-xs font-medium text-[var(--color-text-primary)]">
              {user?.api_domain || '--'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)]">
            <span className="text-xs text-[var(--color-text-tertiary)]">Status</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-[var(--color-primary-dark)]">Connected</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-[var(--color-text-tertiary)]">User ID</span>
            <span className="text-xs font-medium text-[var(--color-text-primary)]">
              {user?.pipedrive_user_id || '--'}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            disabled
            className="border border-[var(--color-border-default)] text-[var(--color-text-tertiary)] font-semibold rounded px-4 py-2 text-sm opacity-50 cursor-not-allowed"
          >
            Disconnect
          </button>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
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
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Notifications</p>
        <p className="text-xs text-[var(--color-text-tertiary)]">Coming soon -- configure alerts for agent activity, deal changes, and more.</p>
      </div>
    </div>
  );
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('context');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'context', label: 'Company Context' },
    { id: 'connection', label: 'Pipedrive Connection' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Configure your company profile and manage your Pipedrive connection
        </p>
      </div>

      <div className="flex gap-0 border-b border-[var(--color-border-default)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-[var(--color-primary-dark)] text-[var(--color-primary-dark)] font-semibold'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'context' && <CompanyContextTab />}
      {activeTab === 'connection' && <PipedriveConnectionTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
    </div>
  );
}
