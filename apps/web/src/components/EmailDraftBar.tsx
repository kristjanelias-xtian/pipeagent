import { useState } from 'react';
import { apiFetch } from '../lib/api';
import type { EmailDraftRow } from '@pipeagent/shared';

interface EmailDraftBarProps {
  draft: EmailDraftRow;
  runId: string;
}

export function EmailDraftBar({ draft, runId }: EmailDraftBarProps) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  if (draft.status !== 'pending') return null;

  const startEdit = () => {
    setSubject(draft.subject);
    setBody(draft.body);
    setEditing(true);
  };

  const resume = async (action: 'send' | 'discard' | 'edit') => {
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
    <div className="border-t border-[var(--color-border-default)] bg-[var(--color-card)] p-3 mt-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Draft -- {draft.status}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => resume('discard')}
            disabled={sending}
            className="px-3 py-1 text-xs border border-[var(--color-border-default)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition"
          >
            Discard
          </button>
          {!editing && (
            <button
              onClick={startEdit}
              disabled={sending}
              className="px-3 py-1 text-xs border border-[var(--color-border-default)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => resume(editing ? 'edit' : 'send')}
            disabled={sending}
            className="px-3 py-1 text-xs bg-[var(--color-primary-dark)] text-white rounded font-medium hover:bg-[var(--color-primary-bright)] transition"
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
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-primary-dark)] focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-primary-dark)] focus:outline-none"
          />
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{draft.subject}</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 whitespace-pre-wrap">{draft.body}</p>
        </div>
      )}
    </div>
  );
}
