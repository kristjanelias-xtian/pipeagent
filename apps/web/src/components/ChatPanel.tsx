import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { ActivityLogRow } from '@pipeagent/shared';

interface ChatPanelProps {
  leadId: string | null;
  logs: ActivityLogRow[];
}

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

function formatAgentMessage(log: ActivityLogRow): string | null {
  const p = log.payload as Record<string, unknown>;

  if (log.node_name === 'fetchContext' && log.event_type === 'node_exit') {
    const parts: string[] = [];
    if (p.lead_title) parts.push(`**${p.lead_title}**`);
    if (p.org_name) parts.push(`at ${p.org_name}`);
    if (p.person_name) parts.push(`(contact: ${p.person_name})`);
    return parts.length > 0 ? `Found lead: ${parts.join(' ')}` : null;
  }

  if (log.node_name === 'checkMemory' && log.event_type === 'node_exit') {
    if (p.fresh) return 'Found recent research in memory — skipping web search.';
    return 'No recent research found. Starting web research...';
  }

  if (log.node_name === 'research' && log.event_type === 'node_exit') {
    const parts: string[] = ['Research complete.'];
    if (p.industry) parts.push(`Industry: ${p.industry}.`);
    if (p.employee_count) parts.push(`~${p.employee_count} employees.`);
    return parts.join(' ');
  }

  if (log.node_name === 'scoring' && log.event_type === 'decision') {
    if (p.score != null && p.label) {
      const label = String(p.label).toUpperCase();
      const criteria = p.criteria as Array<{ name: string; score: number; max_score: number }> | undefined;
      let msg = `**Score: ${p.score}/100 → ${label}**`;
      if (criteria && criteria.length > 0) {
        msg += '\n' + criteria.map(c => `  ${c.name}: ${c.score}/${c.max_score}`).join('\n');
      }
      return msg;
    }
    return null;
  }

  if (log.node_name === 'writeBack' && log.event_type === 'node_exit') {
    return 'Updated lead in Pipedrive with score and label.';
  }

  if (log.node_name === 'outreach' && log.event_type === 'node_exit') {
    if (p.subject) return `Email drafted: "${p.subject}"`;
    return 'Email draft ready for review.';
  }

  if (log.event_type === 'decision' && p.type === 'hitl_interrupt') {
    return 'Waiting for your review of the email draft below.';
  }

  if (log.event_type === 'decision' && p.type === 'hitl_response') {
    const action = String(p.action);
    const labels: Record<string, string> = {
      send: 'Email sent.',
      discard: 'Email discarded.',
      edit: 'Email edited and sent.',
    };
    return labels[action] ?? `Action: ${action}`;
  }

  return null;
}

export function ChatPanel({ leadId, logs }: ChatPanelProps) {
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset user messages when lead changes
  useEffect(() => {
    setUserMessages([]);
    setInput('');
  }, [leadId]);

  // Build agent messages from logs
  const agentMessages: ChatMessage[] = [];
  for (const log of logs) {
    const content = formatAgentMessage(log);
    if (content) {
      agentMessages.push({ role: 'agent', content, timestamp: log.created_at });
    }
  }

  const allMessages = [...userMessages, ...agentMessages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const send = async () => {
    if (!input.trim() || !leadId || sending) return;

    const msg = input.trim();
    setInput('');
    setSending(true);
    setUserMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);

    try {
      const httpRes = await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ leadId, message: msg }),
      });
      const res = await httpRes.json();
      if (res.existing) {
        const label = res.label ? ` (${String(res.label).toUpperCase()})` : '';
        const score = res.score != null ? `, score ${res.score}/100` : '';
        setUserMessages((prev) => [
          ...prev,
          { role: 'agent', content: `Lead already qualified${label}${score}. Use "Requalify" to run again.`, timestamp: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      setUserMessages((prev) => [
        ...prev,
        { role: 'agent', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Chat</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!leadId && <p className="text-sm text-gray-500">Select a lead to start chatting</p>}
        {allMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={leadId ? 'Ask about this lead...' : 'Select a lead first'}
            disabled={!leadId || sending}
            className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!leadId || sending || !input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded text-sm font-medium transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
