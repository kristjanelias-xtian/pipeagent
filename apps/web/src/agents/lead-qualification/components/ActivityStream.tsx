import { useMemo } from 'react';
import type { ActivityLogRow } from '@pipeagent/shared';
import { AgentAvatar } from '../../../components/AgentAvatar';

const NODES_ORDER: Array<{ key: string; verb: string }> = [
  { key: 'fetchContext', verb: 'opened the lead' },
  { key: 'checkMemory', verb: 'checked memory' },
  { key: 'research', verb: 'researching the web' },
  { key: 'scoring', verb: 'scoring against ICP' },
  { key: 'writeBack', verb: 'writing back to Pipedrive' },
  { key: 'outreach', verb: 'drafting outreach' },
];

type StepState = 'future' | 'active' | 'done';

type Step = {
  key: string;
  verb: string;
  state: StepState;
  phase?: string;
  query?: string;
  partial?: string;
  summary?: string;
  time?: string;
};

function buildSteps(logs: ActivityLogRow[]): Step[] {
  const steps: Step[] = NODES_ORDER.map((n) => ({ ...n, state: 'future' }));

  for (const log of logs) {
    const i = steps.findIndex((s) => s.key === log.node_name);
    if (i === -1) continue;
    const step = steps[i];
    if (!step) continue;

    if (log.event_type === 'node_enter') {
      step.state = 'active';
      step.time = log.created_at;
    } else if (log.event_type === 'node_exit') {
      step.state = 'done';
      step.time = log.created_at;
      const payload = log.payload as Record<string, unknown>;
      if (step.key === 'fetchContext') {
        step.summary = [payload.lead_title, payload.org_name].filter(Boolean).join(' -- ') as string;
      } else if (step.key === 'checkMemory') {
        step.summary = payload.fresh ? 'Using cached research' : 'No cached research';
      } else if (step.key === 'research') {
        step.summary = [payload.industry, payload.employee_count && `~${payload.employee_count} employees`]
          .filter(Boolean)
          .join(' -- ') as string;
      } else if (step.key === 'outreach') {
        step.summary = `Subject: "${payload.subject ?? ''}"`;
      }
    } else if (log.event_type === 'phase' && log.node_name === 'research') {
      step.state = 'active';
      const payload = log.payload as Record<string, unknown>;
      step.phase = (payload.phase as string) ?? undefined;
      step.query = (payload.query as string) ?? undefined;
    } else if (log.event_type === 'token' && log.node_name === 'research') {
      step.state = 'active';
      const payload = log.payload as Record<string, unknown>;
      step.partial = payload.partial as string;
    } else if (log.event_type === 'decision' && log.node_name === 'scoring') {
      step.state = 'done';
      const payload = log.payload as Record<string, unknown>;
      step.summary = `Score: ${payload.score} -> ${String(payload.label ?? '').toUpperCase()}`;
    }
  }

  return steps;
}

export function ActivityStream({
  agentName,
  leadTitle,
  logs,
}: {
  agentName: string;
  leadTitle: string;
  logs: ActivityLogRow[];
}) {
  const steps = useMemo(() => buildSteps(logs), [logs]);

  return (
    <div className="flex-1 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-4 overflow-y-auto">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-3">
        {agentName} is working on -- <span className="text-[var(--color-text-primary)]">{leadTitle}</span>
      </div>

      {steps.map((step) => (
        <StepCard key={step.key} step={step} agentName={agentName} />
      ))}
    </div>
  );
}

function StepCard({ step, agentName }: { step: Step; agentName: string }) {
  const borderColor =
    step.state === 'done'
      ? 'border-l-green-500'
      : step.state === 'active'
      ? 'border-l-indigo-500'
      : 'border-l-[var(--color-border-default)] opacity-40';

  const bg = step.state === 'active' ? 'bg-indigo-50/50' : 'bg-[var(--color-border-subtle)]/40';

  return (
    <div className={`mb-2.5 p-2.5 rounded border-l-2 ${borderColor} ${bg}`}>
      <div className="flex items-center text-[var(--color-text-primary)] mb-1">
        <AgentAvatar name={agentName} size={20} className="mr-2" />
        <strong className="font-semibold mr-1.5 text-xs">{agentName}</strong>
        <span className="text-[var(--color-text-secondary)] text-xs">{step.verb}</span>
        {step.state === 'active' && <span className="ml-2 inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
      </div>

      {step.state === 'active' && step.phase && (
        <div className="pl-[26px] text-[11px] text-[var(--color-text-secondary)] italic">
          {step.phase === 'opening' && 'Opening research...'}
          {step.phase === 'searching' && `Searching: "${step.query ?? ''}"`}
          {step.phase === 'reading' && 'Reading results...'}
          {step.phase === 'writing' && 'Summarizing findings...'}
          {step.phase === 'done' && 'Finished research'}
        </div>
      )}

      {step.state === 'active' && step.partial && (
        <div className="pl-[26px] text-[11px] text-[var(--color-text-secondary)] mt-1 italic whitespace-pre-wrap line-clamp-6">
          {step.partial}
        </div>
      )}

      {step.state === 'done' && step.summary && (
        <div className="pl-[26px] text-[11px] text-[var(--color-text-secondary)]">{step.summary}</div>
      )}
    </div>
  );
}
