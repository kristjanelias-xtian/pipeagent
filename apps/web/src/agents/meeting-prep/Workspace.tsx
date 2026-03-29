import { useState } from 'react';
import { meetings } from '../simulated/fixtures';
import type { Meeting } from '../simulated/fixtures';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function MeetingListItem({
  meeting,
  selected,
  onClick,
}: {
  meeting: Meeting;
  selected: boolean;
  onClick: () => void;
}) {
  const primaryAttendee = meeting.attendees[0];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 transition-colors border-l-2 ${
        selected
          ? 'border-[#368764] bg-[#f0f7f4]'
          : 'border-transparent hover:bg-[#f5f6f7]'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] font-medium text-[#368764]">
          {formatDate(meeting.date)} · {meeting.time}
        </span>
        <span className="text-[10px] text-[#a8b1b8]">
          {meeting.durationMins}m
        </span>
      </div>
      <p className="text-[13px] font-medium text-[#1b1f23] truncate">
        {primaryAttendee.name}
      </p>
      <p className="text-[12px] text-[#6a7178] truncate">{meeting.company}</p>
    </button>
  );
}

function BriefingDocument({ meeting }: { meeting: Meeting }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#f5f6f7]">
      {/* Header */}
      <div className="bg-white border-b border-[#e0e4e8] px-6 py-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-[#368764] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              AI-generated
            </span>
            <span className="text-[11px] text-[#a8b1b8]">
              {formatDate(meeting.date)} at {meeting.time} · {meeting.durationMins} min
            </span>
          </div>
          <h1 className="text-[17px] font-semibold text-[#1b1f23]">
            {meeting.company}
          </h1>
          <p className="text-[12px] text-[#6a7178] mt-0.5">{meeting.industry}</p>
        </div>
        <button
          disabled
          className="text-[12px] text-[#a8b1b8] border border-[#e0e4e8] px-3 py-1.5 rounded-md cursor-not-allowed"
        >
          Regenerate
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Company Overview */}
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider mb-3">
            Company Overview
          </h2>
          <p className="text-[13px] text-[#1b1f23] leading-relaxed">
            {meeting.companyOverview}
          </p>
        </div>

        {/* Attendees */}
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider mb-3">
            Attendees
          </h2>
          <div className="space-y-4">
            {meeting.attendees.map((attendee, i) => (
              <div key={attendee.name} className="flex gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-semibold ${
                    avatarColors[i % avatarColors.length]
                  }`}
                >
                  {getInitials(attendee.name)}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#1b1f23]">
                    {attendee.name}
                  </p>
                  <p className="text-[11px] text-[#6a7178] mb-1">
                    {attendee.title}
                  </p>
                  <p className="text-[12px] text-[#4a5058] leading-relaxed">
                    {attendee.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Talking Points */}
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider mb-3">
            Talking Points
          </h2>
          <ol className="space-y-2">
            {meeting.talkingPoints.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#368764] text-white text-[10px] font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[13px] text-[#1b1f23] leading-relaxed">
                  {point}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Suggested Questions */}
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider mb-3">
            Suggested Questions
          </h2>
          <ul className="space-y-2">
            {meeting.suggestedQuestions.map((q, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex-shrink-0 text-[#368764] mt-0.5 text-[14px] leading-none">
                  ?
                </span>
                <p className="text-[13px] text-[#1b1f23] leading-relaxed">
                  {q}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function MeetingPrepWorkspace() {
  const [selectedId, setSelectedId] = useState<string>(meetings[0].id);
  const selected = meetings.find((m) => m.id === selectedId) ?? meetings[0];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Meeting list */}
      <div className="w-[280px] flex-shrink-0 bg-white border-r border-[#e0e4e8] flex flex-col">
        <div className="px-4 py-3 border-b border-[#e0e4e8]">
          <h2 className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
            Upcoming Meetings
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#e0e4e8]">
          {meetings.map((meeting) => (
            <MeetingListItem
              key={meeting.id}
              meeting={meeting}
              selected={meeting.id === selectedId}
              onClick={() => setSelectedId(meeting.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: Briefing document */}
      <div className="flex-1 overflow-hidden">
        <BriefingDocument meeting={selected} />
      </div>
    </div>
  );
}
