import { useState } from 'react';
import type { ActivityLogRow } from '@pipeagent/shared';

interface AgentInspectorProps {
  logs: ActivityLogRow[];
}

const nodeIcons: Record<string, string> = {
  fetchContext: '📥',
  checkMemory: '🧠',
  research: '🔍',
  saveResearch: '💾',
  scoring: '📊',
  writeBack: '✏️',
  outreach: '📧',
  complete: '✅',
};

const nodeLabels: Record<string, string> = {
  fetchContext: 'Fetch Context',
  checkMemory: 'Check Memory',
  research: 'Research',
  saveResearch: 'Save Research',
  scoring: 'Scoring',
  writeBack: 'Write Back',
  outreach: 'Outreach',
};

const eventLabels: Record<string, string> = {
  node_enter: 'Started',
  node_exit: 'Completed',
  llm_call: 'LLM Call',
  tool_call: 'API Call',
  decision: 'Decision',
};

function summarizePayload(log: ActivityLogRow): string | null {
  const p = log.payload as Record<string, unknown>;

  if (log.event_type === 'node_enter') {
    if (log.node_name === 'research' && p.org) return `Researching ${p.org}`;
    if (log.node_name === 'scoring') return p.lead ? `Scoring ${p.lead}` : null;
    if (log.node_name === 'outreach' && p.label) return `Drafting email (${String(p.label).toUpperCase()} lead)`;
    return null;
  }

  if (log.event_type === 'node_exit') {
    if (log.node_name === 'fetchContext') {
      const parts: string[] = [];
      if (p.lead_title) parts.push(`Lead: ${p.lead_title}`);
      if (p.org_name) parts.push(`Org: ${p.org_name}`);
      if (p.person_name) parts.push(`Contact: ${p.person_name}`);
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    if (log.node_name === 'research') {
      const parts: string[] = [];
      if (p.industry) parts.push(String(p.industry));
      if (p.employee_count) parts.push(`~${p.employee_count} employees`);
      return parts.length > 0 ? parts.join(' · ') : 'Research complete';
    }
    if (log.node_name === 'scoring') {
      if (p.response_preview) {
        // response_preview is a stringified JSON possibly wrapped in markdown code fences
        const raw = String(p.response_preview).replace(/^```json\s*\n?/, '').replace(/\n?```$/, '');
        try {
          const parsed = JSON.parse(raw);
          if (parsed.overall_score != null) {
            const parts = [`Score: ${parsed.overall_score}/100`];
            if (parsed.recommendation) parts.push(parsed.recommendation);
            return parts.join(' — ');
          }
        } catch { /* fall through */ }
      }
      return null;
    }
    if (log.node_name === 'saveResearch') {
      return p.org ? `Saved research for ${p.org}` : null;
    }
    if (log.node_name === 'outreach') {
      if (p.subject) return `Subject: "${p.subject}"`;
      if (p.body_preview) return String(p.body_preview).slice(0, 100);
      return null;
    }
    return null;
  }

  if (log.event_type === 'tool_call') {
    if (p.tool) return String(p.tool).replace('pipedrive.', '');
    return null;
  }

  if (log.event_type === 'llm_call') {
    if (p.lead) return `Analyzing: ${p.lead}`;
    if (p.label && p.person) return `Drafting for ${p.person ?? 'contact'}`;
    return null;
  }

  if (log.event_type === 'decision') {
    if (p.type === 'hitl_interrupt') return '⏸ Waiting for human review';
    if (p.type === 'hitl_response') return `Human action: ${p.action}`;
    if (p.score != null && p.label) {
      return `Score: ${p.score}/100 → ${String(p.label).toUpperCase()}`;
    }
    return null;
  }

  return null;
}

function formatPayload(payload: Record<string, unknown>): string {
  // Deep-parse any stringified JSON values (e.g. response_preview)
  const cleaned = Object.fromEntries(
    Object.entries(payload).map(([key, val]) => {
      if (typeof val === 'string') {
        const stripped = val.replace(/^```json\s*\n?/, '').replace(/\n?```$/, '');
        try {
          return [key, JSON.parse(stripped)];
        } catch { /* keep original */ }
      }
      return [key, val];
    })
  );
  return JSON.stringify(cleaned, null, 2);
}

function LogEntry({ log }: { log: ActivityLogRow }) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizePayload(log);
  const icon = nodeIcons[log.node_name] ?? '⚙️';
  const nodeLabel = nodeLabels[log.node_name] ?? log.node_name;
  const eventLabel = eventLabels[log.event_type] ?? log.event_type;

  const isDecision = log.event_type === 'decision';
  const isStart = log.event_type === 'node_enter';
  const isEnd = log.event_type === 'node_exit';

  return (
    <div
      className={`border-l-2 pl-3 py-1.5 cursor-pointer hover:bg-gray-800/30 transition ${
        isDecision ? 'border-amber-500' : isEnd ? 'border-green-700' : 'border-gray-700'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-medium text-indigo-400">{nodeLabel}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          isDecision ? 'bg-amber-900/50 text-amber-300' :
          isEnd ? 'text-green-400' :
          isStart ? 'text-blue-400' :
          'text-gray-500'
        }`}>
          {eventLabel}
        </span>
        <span className="text-xs text-gray-600 ml-auto">
          {new Date(log.created_at).toLocaleTimeString()}
        </span>
      </div>
      {summary && (
        <p className="text-xs text-gray-400 mt-0.5 ml-5">{summary}</p>
      )}
      {expanded && (
        <pre className="mt-2 text-xs text-gray-500 overflow-x-auto max-h-40 bg-gray-900/80 p-2 rounded ml-5">
          {formatPayload(log.payload)}
        </pre>
      )}
    </div>
  );
}

export function AgentInspector({ logs }: AgentInspectorProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Agent Inspector
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {logs.length === 0 && (
          <p className="text-sm text-gray-500">Select a lead to see agent activity</p>
        )}
        {logs.map((log) => (
          <LogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}
