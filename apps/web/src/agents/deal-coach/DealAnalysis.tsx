import type { PipedriveDeal, DealAnalysisRow, DealSignal } from '@pipeagent/shared';

function getScoreColor(score: number) {
  if (score < 40) return 'text-red-600';
  if (score <= 70) return 'text-yellow-600';
  return 'text-green-600';
}

function getScoreBarColor(score: number) {
  if (score < 40) return 'bg-red-500';
  if (score <= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getStatusBadge(score: number) {
  if (score < 40) return { label: 'At Risk', className: 'bg-red-100 text-red-700' };
  if (score <= 70) return { label: 'Needs Action', className: 'bg-yellow-100 text-yellow-700' };
  return { label: 'On Track', className: 'bg-green-100 text-green-700' };
}

function SignalIcon({ type }: { type: DealSignal['type'] }) {
  if (type === 'positive') return <span className="text-green-600 font-bold">✓</span>;
  if (type === 'negative') return <span className="text-red-600 font-bold">✕</span>;
  return <span className="text-yellow-600 font-bold">⚠</span>;
}

interface DealAnalysisProps {
  deal: PipedriveDeal;
  analysis: DealAnalysisRow | null;
  loading: boolean;
  onAnalyze: () => void;
}

const cardClass = 'bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 mb-4';
const sectionHeaderClass = 'text-[11px] font-semibold text-[#6a7178] uppercase tracking-wider mb-3';

export function DealAnalysis({ deal, analysis, loading, onAnalyze }: DealAnalysisProps) {
  const badge = analysis ? getStatusBadge(analysis.health_score) : null;

  return (
    <div className="mb-4">
      {/* Header card */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-[16px] font-semibold text-[#1b1f23] truncate">{deal.title}</h2>
              {badge && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#6a7178]">
              {deal.currency} {deal.value?.toLocaleString() ?? '0'}
            </p>
          </div>
          <button
            onClick={onAnalyze}
            disabled={loading}
            className="bg-[#368764] hover:bg-[#2b6b4f] text-white font-semibold rounded-md px-3 py-1.5 text-[13px] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? 'Analyzing...' : 'Re-analyze'}
          </button>
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className={`${cardClass} flex items-center justify-center py-10`}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#368764] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
            <span className="text-[13px] text-[#6a7178]">Analyzing deal health...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !analysis && (
        <div className={`${cardClass} flex items-center justify-center py-10`}>
          <p className="text-[#a8b1b8] text-[14px]">Click Re-analyze to get started</p>
        </div>
      )}

      {/* Analysis content */}
      {!loading && analysis && (
        <>
          {/* Health Score */}
          <div className={cardClass}>
            <p className={sectionHeaderClass}>Health Score</p>
            <div className="flex items-end gap-3 mb-3">
              <span className={`text-[48px] font-bold leading-none ${getScoreColor(analysis.health_score)}`}>
                {analysis.health_score}
              </span>
              <span className="text-[18px] text-[#a8b1b8] pb-1">/100</span>
            </div>
            <div className="w-full h-2 bg-[#e8eaed] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(analysis.health_score)}`}
                style={{ width: `${analysis.health_score}%` }}
              />
            </div>
          </div>

          {/* Key Signals */}
          {analysis.signals && analysis.signals.length > 0 && (
            <div className={cardClass}>
              <p className={sectionHeaderClass}>Key Signals</p>
              <ul className="space-y-2">
                {analysis.signals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-[13px]">
                      <SignalIcon type={signal.type} />
                    </span>
                    <span className="text-[13px] text-[#1b1f23]">{signal.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Actions */}
          {analysis.actions && analysis.actions.length > 0 && (
            <div className={cardClass}>
              <p className={sectionHeaderClass}>Recommended Actions</p>
              <ol className="space-y-3">
                {analysis.actions
                  .sort((a, b) => a.priority - b.priority)
                  .map((action, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#368764] text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1b1f23]">{action.title}</p>
                        <p className="text-[12px] text-[#6a7178] mt-0.5">{action.reasoning}</p>
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f0f2f4] text-[#6a7178] capitalize">
                        {action.actionType}
                      </span>
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
