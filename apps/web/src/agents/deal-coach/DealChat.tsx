import { useState, useEffect, useRef } from 'react';
import type { DealChatMessageRow } from '@pipeagent/shared';

const SUGGESTED_PROMPTS = [
  'Why is this at risk?',
  'Who are the stakeholders?',
  'Compare to similar won deals',
];

interface DealChatProps {
  messages: DealChatMessageRow[];
  onSend: (message: string) => void;
}

export function DealChat({ messages, onSend }: DealChatProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggest = (prompt: string) => {
    onSend(prompt);
  };

  return (
    <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e0e4e8]">
        <p className="text-[12px] font-semibold text-[#6a7178] uppercase tracking-wider">
          Ask About This Deal
        </p>
      </div>

      {/* Messages */}
      <div className="max-h-[320px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-[13px] text-[#a8b1b8] text-center py-4">
            Ask a question about this deal
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#1b1f23] text-white rounded-br-sm'
                  : 'bg-[#f0f2f4] text-[#1b1f23] rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length === 0 && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSuggest(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-[#e0e4e8] text-[#6a7178] hover:bg-[#f0f2f4] transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something about this deal..."
          className="flex-1 text-[13px] border border-[#e0e4e8] rounded-md px-3 py-2 outline-none focus:border-[#368764] transition-colors text-[#1b1f23] placeholder:text-[#a8b1b8]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="bg-[#368764] hover:bg-[#2b6b4f] text-white font-semibold rounded-md px-4 py-2 text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
