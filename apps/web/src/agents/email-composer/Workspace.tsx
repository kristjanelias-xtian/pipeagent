import { useState } from 'react';
import { emails } from '../simulated/fixtures';
import type { Email, EmailStatus, EmailTone } from '../simulated/fixtures';

const statusConfig: Record<EmailStatus, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  sent: { label: 'Sent', classes: 'bg-green-50 text-[#368764] border-green-200' },
  scheduled: { label: 'Scheduled', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
};

function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

function EmailListItem({
  email,
  selected,
  onClick,
}: {
  email: Email;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 transition-colors border-l-2 ${
        selected
          ? 'border-[#368764] bg-[#f0f7f4]'
          : 'border-transparent hover:bg-[#f5f6f7]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-[12px] font-medium text-[#1b1f23] truncate flex-1 pr-2">
          {email.subject}
        </p>
        <StatusBadge status={email.status} />
      </div>
      <p className="text-[11px] text-[#6a7178] truncate">{email.to}</p>
      <p className="text-[11px] text-[#a8b1b8] truncate">{email.company}</p>
    </button>
  );
}

const tones: EmailTone[] = ['Professional', 'Friendly', 'Direct'];

function EmailEditor({ email }: { email: Email }) {
  const [tone, setTone] = useState<EmailTone>(email.tone);
  const [body, setBody] = useState(email.body);
  const [to, setTo] = useState(email.to);
  const [subject, setSubject] = useState(email.subject);

  // Reset when email changes
  useState(() => {
    setTone(email.tone);
    setBody(email.body);
    setTo(email.to);
    setSubject(email.subject);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f5f6f7]">
      {/* Toolbar */}
      <div className="bg-white border-b border-[#e0e4e8] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Personalization score */}
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#368764]" />
            <span className="text-[11px] font-semibold text-[#368764]">
              Personalization score: {email.personalizationScore}%
            </span>
          </div>
          <span className="text-[11px] text-[#a8b1b8]">AI-generated</span>
        </div>

        {/* Tone selector */}
        <div className="flex items-center gap-1 bg-[#f5f6f7] rounded-md p-0.5 border border-[#e0e4e8]">
          {tones.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
                tone === t
                  ? 'bg-white shadow-sm text-[#1b1f23] font-medium border border-[#e0e4e8]'
                  : 'text-[#6a7178] hover:text-[#1b1f23]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* To */}
          <div className="flex items-center border-b border-[#e0e4e8] px-4 py-3">
            <label className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider w-14 flex-shrink-0">
              To
            </label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 text-[13px] text-[#1b1f23] outline-none"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center border-b border-[#e0e4e8] px-4 py-3">
            <label className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider w-14 flex-shrink-0">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 text-[13px] text-[#1b1f23] font-medium outline-none"
            />
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="w-full text-[13px] text-[#1b1f23] leading-relaxed outline-none resize-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-white border-t border-[#e0e4e8] px-5 py-3 flex items-center gap-3">
        <button className="bg-[#368764] text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-[#2e7356] transition-colors">
          Send
        </button>
        <button className="text-[13px] text-[#1b1f23] border border-[#e0e4e8] px-4 py-2 rounded-md hover:bg-[#f5f6f7] transition-colors">
          Save Draft
        </button>
        <button className="text-[13px] text-[#6a7178] px-3 py-2 hover:text-[#1b1f23] transition-colors ml-auto">
          Discard
        </button>
      </div>
    </div>
  );
}

export function EmailComposerWorkspace() {
  const [selectedId, setSelectedId] = useState<string>(emails[0].id);
  const selected = emails.find((e) => e.id === selectedId) ?? emails[0];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Email list */}
      <div className="w-[280px] flex-shrink-0 bg-white border-r border-[#e0e4e8] flex flex-col">
        <div className="px-4 py-3 border-b border-[#e0e4e8] flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
            Emails
          </h2>
          <button className="text-[11px] text-[#368764] font-medium hover:underline">
            + Compose
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#e0e4e8]">
          {emails.map((email) => (
            <EmailListItem
              key={email.id}
              email={email}
              selected={email.id === selectedId}
              onClick={() => setSelectedId(email.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: Email editor */}
      <div className="flex-1 overflow-hidden">
        <EmailEditor key={selected.id} email={selected} />
      </div>
    </div>
  );
}
