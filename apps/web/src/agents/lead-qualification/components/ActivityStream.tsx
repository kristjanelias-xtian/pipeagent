import { useMemo, useState } from 'react';
import type { ActivityLogRow } from '@pipeagent/shared';
import { AgentAvatar } from '../../../components/AgentAvatar';

type StepDef = {
  key: string;
  verb: string;
  technical?: boolean;
};

const NODES_ORDER: StepDef[] = [
  { key: 'fetchContext', verb: 'opened the lead' },
  { key: 'checkMemory', verb: 'checked memory' },
  { key: 'research', verb: 'researching the web' },
  { key: 'saveResearch', verb: 'saved research to memory', technical: true },
  { key: 'scoring', verb: 'scoring against ICP' },
  { key: 'writeBack', verb: 'writing back to Pipedrive' },
  { key: 'outreach', verb: 'drafting outreach' },
  { key: 'hitlReview', verb: 'waiting for your review' },
  { key: 'complete', verb: 'finishing up' },
];

type StepState = 'future' | 'active' | 'done';

type SubEvent = {
  type: string;
  label: string;
  time: string;
};

type Step = {
  key: string;
  verb: string;
  technical?: boolean;
  state: StepState;
  phase?: string;
  query?: string;
  partial?: string;
  summary?: string;
  time?: string;
  subEvents: SubEvent[];
};

function formatSubEvent(log: ActivityLogRow): string {
  const payload = log.payload as Record<string, unknown>;
  if (log.event_type === 'tool_call') {
    const tool = (payload.tool as string) ?? '';
    if (tool === 'fetch_lead') return 'Fetched lead from Pipedrive';
    if (tool === 'fetch_person') return `Fetched person: ${payload.person_name ?? ''}`;
    if (tool === 'fetch_org') return `Fetched org: ${payload.org_name ?? ''}`;
    if (tool === 'update_label') return `Updated label to ${payload.label ?? ''}`;
    if (tool === 'add_note') return 'Added scoring note';
    return `Called ${tool}`;
  }
  if (log.event_type === 'llm_call') return 'Called LLM';
  if (log.event_type === 'pipedrive_activity_created') {
    const activity = payload.activity as string;
    if (activity === 'email_sent') return `Created email activity: "${payload.subject ?? ''}"`;
    if (activity === 'followup_scheduled') return `Scheduled follow-up for ${payload.due_date ?? ''}`;
    return `Created Pipedrive activity`;
  }
  if (log.event_type === 'pipedrive_activity_error') return `Pipedrive error: ${payload.error ?? ''}`;
  return log.event_type;
}

function buildSteps(logs: ActivityLogRow[], showTechnical: boolean): Step[] {
  const defs = showTechnical ? NODES_ORDER : NODES_ORDER.filter((n) => !n.technical);
  const steps: Step[] = defs.map((n) => ({ ...n, state: 'future', subEvents: [] }));

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
      } else if (step.key === 'complete' && payload.final) {
        step.summary = 'Done';
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
    } else if (log.event_type === 'decision') {
      if (log.node_name === 'scoring') {
        step.state = 'done';
        const payload = log.payload as Record<string, unknown>;
        step.summary = `Score: ${payload.score} -> ${String(payload.label ?? '').toUpperCase()}`;
      } else if (log.node_name === 'outreach') {
        const payload = log.payload as Record<string, unknown>;
        if (payload.type === 'hitl_response') {
          step.summary = `Decision: ${payload.action}`;
        }
      }
    } else if (showTechnical && ['tool_call', 'llm_call', 'pipedrive_activity_created', 'pipedrive_activity_error'].includes(log.event_type)) {
      step.subEvents.push({
        type: log.event_type,
        label: formatSubEvent(log),
        time: log.created_at,
      });
    }

    // Show pipedrive activities in product mode too (on 'complete' step)
    if (!showTechnical && ['pipedrive_activity_created', 'pipedrive_activity_error'].includes(log.event_type) && log.node_name === 'complete') {
      step.subEvents.push({
        type: log.event_type,
        label: formatSubEvent(log),
        time: log.created_at,
      });
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
  const [showTechnical, setShowTechnical] = useState(false);
  const steps = useMemo(() => buildSteps(logs, showTechnical), [logs, showTechnical]);

  return (
    <div className="flex-1 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {agentName} is working on -- <span className="text-[var(--color-text-primary)]">{leadTitle}</span>
        </div>
        <button
          onClick={() => setShowTechnical((v) => !v)}
          className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border-default)] text-[var(--color-text-tertiary)] hover:border-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)]"
        >
          {showTechnical ? 'Product view' : 'Technical view'}
        </button>
      </div>

      {steps.map((step) => (
        <StepCard key={step.key} step={step} agentName={agentName} expandable={showTechnical} />
      ))}
    </div>
  );
}

function StepCard({ step, agentName, expandable }: { step: Step; agentName: string; expandable: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = step.subEvents.length > 0;

  const borderColor =
    step.state === 'done'
      ? 'border-l-green-500'
      : step.state === 'active'
      ? 'border-l-indigo-500'
      : 'border-l-[var(--color-border-default)] opacity-40';

  const bg = step.state === 'active' ? 'bg-indigo-50/50' : 'bg-[var(--color-border-subtle)]/40';

  return (
    <div className={`mb-2.5 p-2.5 rounded border-l-2 ${borderColor} ${bg}`}>
      <div
        className={`flex items-center text-[var(--color-text-primary)] mb-1 ${expandable && hasDetail ? 'cursor-pointer' : ''}`}
        onClick={expandable && hasDetail ? () => setExpanded((v) => !v) : undefined}
      >
        <AgentAvatar name={agentName} size={20} className="mr-2" />
        <strong className="font-semibold mr-1.5 text-xs">{agentName}</strong>
        <span className="text-[var(--color-text-secondary)] text-xs">{step.verb}</span>
        {step.state === 'active' && <span className="ml-2 inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
        {expandable && hasDetail && (
          <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
            {expanded ? 'v' : `${step.subEvents.length} events >`}
          </span>
        )}
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

      {/* Sub-events: always show pipedrive activities, expand for technical */}
      {step.subEvents.length > 0 && (expanded || !expandable) && (
        <div className="pl-[26px] mt-1.5 flex flex-col gap-1">
          {step.subEvents.map((ev, i) => (
            <div key={i} className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1.5">
              <span className={`inline-block w-1 h-1 rounded-full flex-shrink-0 ${
                ev.type === 'pipedrive_activity_error' ? 'bg-red-400' : 'bg-[var(--color-text-tertiary)]'
              }`} />
              {ev.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
