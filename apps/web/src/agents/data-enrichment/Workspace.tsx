import { useState } from 'react';
import { contacts } from '../simulated/fixtures';
import type { EnrichmentStatus } from '../simulated/fixtures';

const statusConfig: Record<EnrichmentStatus, { label: string; classes: string; dot: string }> = {
  enriched: {
    label: 'Enriched',
    classes: 'bg-green-50 text-[#368764] border-green-200',
    dot: 'bg-[#368764]',
  },
  pending: {
    label: 'Pending',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
  },
  'not-found': {
    label: 'Not Found',
    classes: 'bg-[#f5f6f7] text-[#6a7178] border-[#e0e4e8]',
    dot: 'bg-[#a8b1b8]',
  },
};

function StatusBadge({ status }: { status: EnrichmentStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function CellValue({
  value,
  isNew,
}: {
  value: string | null;
  isNew: boolean;
}) {
  if (!value) {
    return <span className="text-[#a8b1b8] text-[12px]">—</span>;
  }
  return (
    <span
      className={`text-[12px] ${
        isNew ? 'bg-green-50 text-[#1b6b43] px-1 py-0.5 rounded font-medium' : 'text-[#1b1f23]'
      }`}
    >
      {value}
    </span>
  );
}

export function DataEnrichmentWorkspace() {
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);

  const enrichedCount = contacts.filter((c) => c.status === 'enriched').length;
  const pendingCount = contacts.filter((c) => c.status === 'pending').length;
  const notFoundCount = contacts.filter((c) => c.status === 'not-found').length;

  const handleRun = () => {
    if (running || ran) return;
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setRan(true);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f5f6f7]">
      {/* Header */}
      <div className="bg-white border-b border-[#e0e4e8] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-[#1b1f23]">
            Data Enrichment
          </h1>
          <p className="text-[12px] text-[#6a7178] mt-0.5">
            Auto-fill missing contact and company fields from LinkedIn, Clearbit, and public sources.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running || ran}
          className={`flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-md transition-colors ${
            ran
              ? 'bg-green-50 text-[#368764] border border-green-200 cursor-default'
              : running
              ? 'bg-[#368764]/70 text-white cursor-not-allowed'
              : 'bg-[#368764] text-white hover:bg-[#2e7356]'
          }`}
        >
          {running ? (
            <>
              <svg
                className="w-3.5 h-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Running…
            </>
          ) : ran ? (
            'Enrichment Complete'
          ) : (
            'Run Enrichment'
          )}
        </button>
      </div>

      {/* Summary stats */}
      <div className="px-6 py-3 flex items-center gap-6 bg-white border-b border-[#e0e4e8]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#368764]" />
          <span className="text-[12px] text-[#1b1f23]">
            <span className="font-semibold">{enrichedCount}</span>
            <span className="text-[#6a7178]"> enriched</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[12px] text-[#1b1f23]">
            <span className="font-semibold">{pendingCount}</span>
            <span className="text-[#6a7178]"> pending</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#a8b1b8]" />
          <span className="text-[12px] text-[#1b1f23]">
            <span className="font-semibold">{notFoundCount}</span>
            <span className="text-[#6a7178]"> not found</span>
          </span>
        </div>
        <span className="text-[12px] text-[#a8b1b8] ml-auto">
          Last run: 2 hours ago
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <table className="w-full text-left min-w-[820px]">
            <thead>
              <tr className="border-b border-[#e0e4e8] bg-[#f9fafb]">
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  LinkedIn
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4e8]">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-[#f9fafb] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-[#1b1f23]">
                        {contact.name}
                      </p>
                      <p className="text-[11px] text-[#6a7178]">
                        {contact.title}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CellValue
                      value={contact.company}
                      isNew={contact.newFields.includes('company')}
                    />
                    {contact.companySize && (
                      <div>
                        <CellValue
                          value={contact.companySize}
                          isNew={contact.newFields.includes('companySize')}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CellValue
                      value={contact.email}
                      isNew={contact.newFields.includes('email')}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <CellValue
                      value={contact.phone}
                      isNew={contact.newFields.includes('phone')}
                    />
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <CellValue
                      value={contact.linkedIn}
                      isNew={contact.newFields.includes('linkedIn')}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={contact.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
