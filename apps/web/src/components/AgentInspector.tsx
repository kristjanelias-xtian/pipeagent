import { useState } from 'react';
import type { ActivityLogRow } from '@pipeagent/shared';

interface AgentInspectorProps {
  logs: ActivityLogRow[];
  graphState: Record<string, unknown> | null;
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

function LogEntry({ log }: { log: ActivityLogRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border-l-2 border-gray-700 pl-3 py-1 cursor-pointer hover:bg-gray-800/30"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs">{nodeIcons[log.node_name] ?? '⚙️'}</span>
        <span className="text-xs font-mono text-indigo-400">{log.node_name}</span>
        <span className="text-xs text-gray-500">{log.event_type}</span>
        <span className="text-xs text-gray-600 ml-auto">
          {new Date(log.created_at).toLocaleTimeString()}
        </span>
      </div>
      {expanded && (
        <pre className="mt-1 text-xs text-gray-400 overflow-x-auto max-h-60 bg-gray-900 p-2 rounded">
          {JSON.stringify(log.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AgentInspector({ logs, graphState }: AgentInspectorProps) {
  const [showState, setShowState] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Agent Inspector
        </h2>
        <button
          onClick={() => setShowState(!showState)}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          {showState ? 'Hide' : 'Show'} Graph State
        </button>
      </div>

      {showState && graphState && (
        <div className="p-3 border-b border-gray-800 bg-gray-900/50">
          <pre className="text-xs text-gray-400 overflow-x-auto max-h-40">
            {JSON.stringify(graphState, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
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
