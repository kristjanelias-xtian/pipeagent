import { deals, pipelineSummary } from '../simulated/fixtures';
import type { Deal, ConfidenceLevel } from '../simulated/fixtures';

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return `$${value}`;
}

function formatFullCurrency(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

const confidenceConfig: Record<ConfidenceLevel, { classes: string }> = {
  High: { classes: 'bg-green-50 text-[#368764] border-green-200' },
  Medium: { classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  Low: { classes: 'bg-[#f5f6f7] text-[#6a7178] border-[#e0e4e8]' },
};

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const cfg = confidenceConfig[level];
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.classes}`}
    >
      {level}
    </span>
  );
}

function ProbabilityBar({ value }: { value: number }) {
  const color =
    value >= 70
      ? 'bg-[#368764]'
      : value >= 40
      ? 'bg-amber-400'
      : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#e0e4e8] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[12px] font-medium text-[#1b1f23] w-8 text-right">
        {value}%
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 ${
        accent ? 'border-[#368764]/30' : 'border-[#e0e4e8]'
      }`}
    >
      <p className="text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-[22px] font-semibold ${
          accent ? 'text-[#368764]' : 'text-[#1b1f23]'
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-[#a8b1b8] mt-0.5">{sub}</p>
      )}
    </div>
  );
}

const sortedDeals = [...deals].sort(
  (a, b) => b.closeProbability - a.closeProbability
);

const stageOrder: Record<Deal['stage'], number> = {
  'Contract Review': 5,
  Negotiation: 4,
  'Proposal Sent': 3,
  'Demo Scheduled': 2,
  Qualified: 1,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PipelineForecasterWorkspace() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f5f6f7]">
      {/* Header */}
      <div className="bg-white border-b border-[#e0e4e8] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-[#1b1f23]">
              Pipeline Forecaster
            </h1>
            <p className="text-[12px] text-[#6a7178] mt-0.5">
              AI-powered close probability scoring and revenue predictions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#368764] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              AI-generated
            </span>
            <span className="text-[11px] text-[#a8b1b8]">
              Updated 14 min ago
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard
            label="Total Pipeline"
            value={formatCurrency(pipelineSummary.totalValue)}
            sub={formatFullCurrency(pipelineSummary.totalValue)}
          />
          <SummaryCard
            label="Weighted Value"
            value={formatCurrency(pipelineSummary.weightedValue)}
            sub="probability-adjusted"
          />
          <SummaryCard
            label="Predicted Close · Month"
            value={formatCurrency(pipelineSummary.predictedThisMonth)}
            sub="March 2026"
            accent
          />
          <SummaryCard
            label="Predicted Close · Quarter"
            value={formatCurrency(pipelineSummary.predictedThisQuarter)}
            sub="Q1 2026"
            accent
          />
        </div>

        {/* Deal table */}
        <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e0e4e8]">
            <h2 className="text-[12px] font-semibold text-[#1b1f23]">
              Open Deals
            </h2>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#e0e4e8] bg-[#f9fafb]">
                <th className="px-5 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Deal
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Value
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider w-44">
                  Close Probability
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Expected Close
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider">
                  Owner
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4e8]">
              {sortedDeals.map((deal) => (
                <tr
                  key={deal.id}
                  className="hover:bg-[#f9fafb] transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-medium text-[#1b1f23]">
                      {deal.title}
                    </p>
                    <p className="text-[11px] text-[#6a7178]">{deal.company}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[13px] font-semibold text-[#1b1f23]">
                      {formatFullCurrency(deal.value)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] text-[#1b1f23]">
                      {deal.stage}
                    </span>
                    <div className="flex mt-1">
                      {[1, 2, 3, 4, 5].map((step) => (
                        <div
                          key={step}
                          className={`h-1 w-4 rounded-full mr-0.5 ${
                            step <= stageOrder[deal.stage]
                              ? 'bg-[#368764]'
                              : 'bg-[#e0e4e8]'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <ProbabilityBar value={deal.closeProbability} />
                  </td>
                  <td className="px-5 py-3">
                    <ConfidenceBadge level={deal.confidence} />
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] text-[#1b1f23]">
                      {formatDate(deal.expectedCloseDate)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] text-[#6a7178]">
                      {deal.owner}
                    </span>
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
