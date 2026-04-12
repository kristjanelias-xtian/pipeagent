import { useState } from 'react';
import { useAgentIdentity } from '../../../hooks/useAgentIdentity';
import { useCompanyProfile } from '../../../hooks/useCompanyProfile';
import { getAgent } from '../../registry';
import { AgentAvatar } from '../../../components/AgentAvatar';
import { IcpEditor } from './IcpEditor';
import { CompanyProfileEditor } from '../../../components/CompanyProfileEditor';
import type { IcpCriterion, LeadQualificationConfig } from '@pipeagent/shared';

const AGENT_ID = 'lead-qualification' as const;

export function IdentityRail() {
  const { identity, loading, save } = useAgentIdentity(AGENT_ID);
  const { profile } = useCompanyProfile();
  const [editMode, setEditMode] = useState(false);
  const [showIcp, setShowIcp] = useState(false);
  const [showCompany, setShowCompany] = useState(false);

  const meta = getAgent(AGENT_ID)!;
  const config = (identity?.config ?? {}) as LeadQualificationConfig;
  const criteria: IcpCriterion[] = config.icp_criteria ?? [];

  if (loading || !identity) {
    return (
      <aside className="w-[300px] bg-[#f0faf5] border border-[var(--color-primary-dark)] rounded-lg p-4">
        <div className="text-[var(--color-text-secondary)]">Loading identity...</div>
      </aside>
    );
  }

  return (
    <>
      <aside className="w-[300px] bg-[#f0faf5] border border-[var(--color-primary-dark)] rounded-lg flex flex-col flex-shrink-0 min-h-0 overflow-hidden">
        <div className="p-4 pb-2 flex-shrink-0">
          <AgentAvatar name={identity.name || meta.defaultIdentity.name} size={56} className="mx-auto" />
          <div className="text-center font-bold text-[var(--color-text-primary)] mt-2">
            {identity.name || meta.defaultIdentity.name}
          </div>
          <div className="text-center text-xs text-[var(--color-text-tertiary)] mb-3">
            {meta.role} -- {profile?.name || 'Your company'}
          </div>

          <button
            onClick={() => setShowCompany(true)}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded text-xs text-[var(--color-text-secondary)] hover:border-indigo-400"
          >
            <span>
              Company: <strong className="text-[var(--color-text-primary)]">{profile?.name || 'Set up'}</strong>
            </span>
            <span>&rarr;</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
          {editMode ? (
            <IdentityEditForm
              identity={identity}
              onManageIcp={() => setShowIcp(true)}
              onSave={async (updates) => {
                await save(updates);
                setEditMode(false);
              }}
              onCancel={() => setEditMode(false)}
            />
          ) : (
            <IdentityReadOnly
              identity={identity}
              criteriaCount={criteria.length}
              totalWeight={criteria.reduce((s, c) => s + (c.weight || 0), 0)}
              onEdit={() => setEditMode(true)}
            />
          )}
        </div>
      </aside>

      {showIcp && (
        <IcpEditor
          initial={criteria}
          onClose={() => setShowIcp(false)}
          onSave={async (next) => {
            await save({
              config: { ...config, icp_criteria: next },
            });
            setShowIcp(false);
          }}
        />
      )}

      {showCompany && <CompanyProfileEditor onClose={() => setShowCompany(false)} />}
    </>
  );
}

function IdentityReadOnly({
  identity,
  criteriaCount,
  totalWeight,
  onEdit,
}: {
  identity: NonNullable<ReturnType<typeof useAgentIdentity>['identity']>;
  criteriaCount: number;
  totalWeight: number;
  onEdit: () => void;
}) {
  const meta = getAgent(AGENT_ID)!;
  return (
    <div className="flex flex-col gap-3 text-xs">
      <Section title="The Job" badge="locked">
        <Field label="Role" value={meta.role} locked />
        <Field label="What I own" value={meta.scopeIn} locked />
        <Field label="What I don't touch" value={meta.scopeOut} locked />
      </Section>

      <Section title="Your Shape" badge="editable">
        <Field label="Mission" value={identity.mission || meta.defaultIdentity.mission} />
        <Field label="Personality" value={identity.personality || meta.defaultIdentity.personality} />
        <Field label="ICP criteria" value={`${criteriaCount} criteria, total weight ${totalWeight}`} />
        {identity.rulebook && <Field label="Rulebook" value={identity.rulebook} />}
      </Section>

      <button
        onClick={onEdit}
        className="mt-auto py-2 border border-dashed border-[var(--color-border-default)] rounded text-[var(--color-text-secondary)] text-xs hover:border-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)]"
      >
        Edit identity
      </button>
    </div>
  );
}

function IdentityEditForm({
  identity,
  onManageIcp,
  onSave,
  onCancel,
}: {
  identity: NonNullable<ReturnType<typeof useAgentIdentity>['identity']>;
  onManageIcp: () => void;
  onSave: (updates: { name: string; mission: string; personality: string; rulebook: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const meta = getAgent(AGENT_ID)!;
  const [form, setForm] = useState({
    name: identity.name || meta.defaultIdentity.name,
    mission: identity.mission || meta.defaultIdentity.mission,
    personality: identity.personality || meta.defaultIdentity.personality,
    rulebook: identity.rulebook,
  });

  return (
    <div className="flex flex-col gap-2 text-xs">
      <Section title="The Job" badge="locked">
        <Field label="Role" value={meta.role} locked />
        <Field label="What I own" value={meta.scopeIn} locked />
        <Field label="What I don't touch" value={meta.scopeOut} locked />
      </Section>

      <Section title="Your Shape" badge="editable">
        <EditField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <EditField label="Mission" value={form.mission} onChange={(v) => setForm({ ...form, mission: v })} multiline />
        <EditField label="Personality" value={form.personality} onChange={(v) => setForm({ ...form, personality: v })} multiline />

        <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mt-2">
          ICP criteria
        </label>
        <button
          onClick={onManageIcp}
          className="w-full flex items-center justify-between px-2 py-1.5 bg-white border border-[var(--color-border-default)] rounded text-xs hover:border-[var(--color-primary-dark)]"
        >
          <span className="text-[var(--color-text-primary)]">Manage &rarr;</span>
        </button>

        <EditField label="Rulebook" value={form.rulebook} onChange={(v) => setForm({ ...form, rulebook: v })} multiline large />
      </Section>

      <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--color-primary-dark)]/20">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-xs"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          className="flex-1 py-1.5 rounded bg-[var(--color-primary-dark)] text-white font-semibold text-xs"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="pb-3 border-b border-dashed border-[var(--color-primary-dark)]/25">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-primary)]">
          {title}
        </div>
        <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]">
          {badge}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, locked = false }: { label: string; value: string; locked?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{label}</div>
      <div
        className={`text-[11px] leading-snug px-2 py-1 rounded ${
          locked
            ? 'italic text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)]/50'
            : 'text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  multiline = false,
  large = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  large?: boolean;
}) {
  const common = 'w-full px-2 py-1 text-[11px] rounded border border-[var(--color-border-default)] focus:border-[var(--color-primary-dark)] focus:outline-none';
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {label}
      </label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={large ? 3 : 2} className={common} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={common} />
      )}
    </div>
  );
}
