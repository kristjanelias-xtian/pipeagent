import { useState } from 'react';
import type { PipedriveDeal, DealAnalysisRow } from '@pipeagent/shared';

type FilterType = 'all' | 'at-risk' | 'action-needed';

function getStatusBadge(analysis: DealAnalysisRow | undefined) {
  if (!analysis) {
    return { label: 'Not analyzed', className: 'bg-[#e8eaed] text-[#6a7178]' };
  }
  const score = analysis.health_score;
  if (score < 40) {
    return { label: 'At Risk', className: 'bg-red-100 text-red-700' };
  }
  if (score <= 70) {
    return { label: 'Needs Action', className: 'bg-yellow-100 text-yellow-700' };
  }
  return { label: 'On Track', className: 'bg-green-100 text-green-700' };
}

interface DealListProps {
  deals: PipedriveDeal[];
  selectedDealId: number | null;
  onSelectDeal: (id: number) => void;
  loading: boolean;
  analyses?: Record<number, DealAnalysisRow>;
}

export function DealList({ deals, selectedDealId, onSelectDeal, loading, analyses = {} }: DealListProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredDeals = deals.filter((deal) => {
    if (filter === 'all') return true;
    const analysis = analyses[deal.id];
    if (!analysis) return false;
    const score = analysis.health_score;
    if (filter === 'at-risk') return score < 40;
    if (filter === 'action-needed') return score >= 40 && score <= 70;
    return true;
  });

  return (
    <div className="w-[280px] flex-shrink-0 flex flex-col bg-white border-r border-[#e0e4e8] h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#e0e4e8]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧠</span>
          <span className="text-[15px] font-semibold text-[#1b1f23]">Deal Coach</span>
        </div>
        <p className="text-[12px] text-[#6a7178]">Analyzes deal health and suggests next actions</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 px-3 py-2.5 border-b border-[#e0e4e8] flex-wrap">
        {(['all', 'at-risk', 'action-needed'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
              filter === f
                ? 'bg-[#368764] text-white'
                : 'bg-[#f0f2f4] text-[#6a7178] hover:bg-[#e4e7ea]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'at-risk' ? 'At Risk' : 'Action Needed'}
          </button>
        ))}
      </div>

      {/* Deal list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-[#a8b1b8] text-sm">
            Loading deals...
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[#a8b1b8] text-sm">
            No deals found
          </div>
        ) : (
          filteredDeals.map((deal) => {
            const analysis = analyses[deal.id];
            const badge = getStatusBadge(analysis);
            const isSelected = deal.id === selectedDealId;
            return (
              <button
                key={deal.id}
                onClick={() => onSelectDeal(deal.id)}
                className={`w-full text-left px-3 py-3 border-b border-[#f0f2f4] transition-colors hover:bg-[#f8f9fa] ${
                  isSelected ? 'border-l-2 border-l-[#368764] bg-[#f0faf5]' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="text-[13px] font-medium text-[#1b1f23] truncate mb-1">
                  {deal.title}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#6a7178]">
                    {deal.currency} {deal.value?.toLocaleString() ?? '0'}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
