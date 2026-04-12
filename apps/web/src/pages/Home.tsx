import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useConnectionContext } from '../context/ConnectionContext';
import { agents } from '../agents/registry';
import { AgentAvatar } from '../components/AgentAvatar';
import { AgentIcon, type LucideIconName } from '../components/AgentIcon';
import { CompanyProfileEditor } from '../components/CompanyProfileEditor';
import { useCompanyProfile } from '../hooks/useCompanyProfile';
import { useAgentRuns } from '../hooks/useSupabaseRealtime';

export function Home() {
  const { connectionId, user } = useConnectionContext();
  const { profile } = useCompanyProfile();
  const runs = useAgentRuns(connectionId);
  const [showCompanyEdit, setShowCompanyEdit] = useState(false);

  const domain = user?.api_domain
    ?.replace('https://', '')
    ?.replace('http://', '')
    ?.replace('.pipedrive.com', '')
    ?? '';

  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
      ? 'Good afternoon'
      : 'Good evening';

  const activeAgents = agents.filter((a) => a.status === 'active');
  const simulatedAgents = agents.filter((a) => a.status === 'simulated');
  const runningRuns = runs.filter((r) => r.status === 'running').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Company header */}
      {profile?.name ? (
        <div className="flex items-center gap-4 p-5 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-xl mb-5">
          <div
            className="rounded-xl bg-gradient-to-br from-[var(--color-primary-bright)] to-[var(--color-primary-dark)] flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ width: 52, height: 52 }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
              {profile.name}
            </div>
            {profile.description && (
              <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                {profile.description}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCompanyEdit(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border-default)] rounded text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)]"
          >
            <Pencil size={14} strokeWidth={2} />
            Edit company profile
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCompanyEdit(true)}
          className="w-full flex items-center gap-4 p-5 bg-[var(--color-card)] border border-dashed border-[var(--color-border-default)] rounded-xl mb-5 text-left hover:border-[var(--color-primary-dark)] hover:bg-[#f8fcfa] transition"
        >
          <div
            className="rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-tertiary)] flex-shrink-0"
            style={{ width: 52, height: 52 }}
          >
            <Pencil size={22} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--color-text-secondary)] leading-tight">
              Set up your company profile
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              Give every agent shared context about your business, ICP, and positioning.
            </div>
          </div>
        </button>
      )}

      {/* Greeting */}
      <div className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight mb-1">
        {greeting}{domain ? `, ${domain}` : ''}.
      </div>
      <div className="text-sm text-[var(--color-text-secondary)] mb-6 flex items-center gap-2">
        {runningRuns > 0 && (
          <span className="inline-block w-2 h-2 bg-[var(--color-primary-bright)] rounded-full animate-pulse shadow-[0_0_0_3px_rgba(38,182,124,0.2)]" />
        )}
        Your team is ready -- {runningRuns === 0
          ? 'nothing running right now'
          : `${runningRuns} agent${runningRuns === 1 ? '' : 's'} working`}
      </div>

      {/* Your team */}
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-2.5">
        Your team
      </div>
      <div className="grid grid-cols-2 gap-3.5 mb-7">
        {activeAgents.map((agent, i) => (
          <Link
            key={agent.id}
            to={`/agent/${agent.id}`}
            className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-4 hover:border-[var(--color-primary-bright)] hover:shadow-[var(--shadow-hover)] transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <AgentAvatar name={agent.defaultIdentity.name || '?'} paletteIndex={i % 6} size={46} />
              <div>
                <div className="text-base font-bold text-[var(--color-text-primary)] leading-tight">
                  {agent.defaultIdentity.name || agent.name}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{agent.role}</div>
              </div>
            </div>
            <div className="text-xs italic text-[var(--color-text-secondary)] py-2.5 border-y border-[var(--color-border-subtle)]">
              "{agent.defaultIdentity.mission}"
            </div>
            <div className="flex items-center justify-between mt-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]" />
                Idle
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Coming to the team */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Coming to the team
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">{simulatedAgents.length} more hires planned</div>
      </div>
      <div className="grid grid-cols-5 gap-2.5 mb-6">
        {simulatedAgents.map((agent) => (
          <div
            key={agent.id}
            className="bg-[var(--color-card)] border border-dashed border-[var(--color-border-default)] rounded-lg p-3 text-center"
          >
            <div className="w-8 h-8 mx-auto mb-2 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center text-[var(--color-text-secondary)]">
              <AgentIcon name={agent.icon as LucideIconName} size={18} />
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{agent.name}</div>
            <div className="text-[9px] uppercase tracking-wide text-[var(--color-text-tertiary)] mt-0.5">
              Coming soon
            </div>
          </div>
        ))}
        <Link
          to="/build"
          className="bg-[#f0faf5] border border-[var(--color-primary-dark)] rounded-lg p-3 text-center hover:shadow-[0_4px_12px_rgba(38,182,124,0.2)]"
        >
          <div className="w-8 h-8 mx-auto mb-2 bg-[rgba(38,182,124,0.15)] rounded-lg flex items-center justify-center text-[var(--color-primary-dark)]">
            <AgentIcon name="Sparkles" size={18} />
          </div>
          <div className="text-xs font-semibold text-[var(--color-primary-dark)]">Build your own</div>
          <div className="text-[9px] uppercase tracking-wide text-[var(--color-primary-dark)] mt-0.5">Start here</div>
        </Link>
      </div>

      {showCompanyEdit && <CompanyProfileEditor onClose={() => setShowCompanyEdit(false)} />}
    </div>
  );
}
