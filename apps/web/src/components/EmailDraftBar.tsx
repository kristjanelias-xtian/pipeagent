import { useState } from 'react';
import { apiFetch } from '../lib/api';
import type { EmailDraftRow } from '@pipeagent/shared';

interface EmailDraftBarProps {
  draft: EmailDraftRow | null;
  runId: string | null;
}

export function EmailDraftBar({ draft, runId }: EmailDraftBarProps) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  if (!draft || draft.status !== 'pending') return null;

  const startEdit = () => {
    setSubject(draft.subject);
    setBody(draft.body);
    setEditing(true);
  };

  const resume = async (action: 'send' | 'discard' | 'edit') => {
    if (!runId) return;
    setSending(true);
    try {
      await apiFetch('/chat/resume', {
        method: 'POST',
        body: JSON.stringify({
          runId,
          action,
          ...(action === 'edit' ? { editedEmail: { subject, body } } : {}),
        }),
      });
    } finally {
      setSending(false);
      setEditing(false);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-900/80 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">Draft Email</h3>
        <div className="flex gap-2">
          <button
            onClick={() => resume('discard')}
            disabled={sending}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
          >
            Discard
          </button>
          {!editing && (
            <button
              onClick={startEdit}
              disabled={sending}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => resume(editing ? 'edit' : 'send')}
            disabled={sending}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 rounded transition font-medium"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full bg-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-gray-200">{draft.subject}</p>
          <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{draft.body}</p>
        </div>
      )}
    </div>
  );
}
