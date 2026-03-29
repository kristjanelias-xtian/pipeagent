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

export function ChatPanel({ leadId, logs }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Convert relevant logs to chat messages
  useEffect(() => {
    const agentMessages: ChatMessage[] = [];
    for (const log of logs) {
      if (log.event_type === 'llm_call' && log.payload.prompt_preview) {
        agentMessages.push({
          role: 'agent',
          content: `**${log.node_name}** reasoning: ${String(log.payload.prompt_preview).slice(0, 150)}...`,
          timestamp: log.created_at,
        });
      }
      if (log.event_type === 'decision' && log.payload.type !== 'hitl_interrupt') {
        agentMessages.push({
          role: 'agent',
          content: `**${log.node_name}**: ${JSON.stringify(log.payload, null, 0).slice(0, 200)}`,
          timestamp: log.created_at,
        });
      }
      if (log.event_type === 'node_exit' && log.node_name === 'scoring') {
        const p = log.payload as Record<string, unknown>;
        agentMessages.push({
          role: 'agent',
          content: `Scored lead: **${p.score ?? 'N/A'}**/100 → ${String(p.label ?? 'unknown').toUpperCase()}`,
          timestamp: log.created_at,
        });
      }
    }
    setMessages((prev) => {
      const userMsgs = prev.filter((m) => m.role === 'user');
      return [...userMsgs, ...agentMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    });
  }, [logs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !leadId || sending) return;

    const msg = input.trim();
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);

    try {
      await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ leadId, message: msg }),
      });
    } catch (err) {
      setMessages((prev) => [
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
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
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
