import { useState } from 'react';
import { useDeals } from '../../hooks/useDeals';
import { useDealAnalysis } from '../../hooks/useDealAnalysis';
import { useActivityLogs } from '../../hooks/useSupabaseRealtime';
import { DealList } from './DealList';
import { DealAnalysis } from './DealAnalysis';
import { DealChat } from './DealChat';
import { AgentInspector } from '../../components/AgentInspector';

export function DealCoachWorkspace() {
  const { deals, loading: dealsLoading } = useDeals();
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const selectedDeal = deals.find((d) => d.id === selectedDealId) || null;
  const { analysis, loading: analysisLoading, analyze, chatMessages, sendChat, runId } = useDealAnalysis(selectedDealId);
  const logs = useActivityLogs(runId);

  return (
    <div className="flex h-full">
      <DealList
        deals={deals}
        selectedDealId={selectedDealId}
        onSelectDeal={setSelectedDealId}
        loading={dealsLoading}
      />
      <div className="flex-1 flex min-w-0">
        {/* Analysis + Chat */}
        <div className="flex-1 overflow-auto p-6">
          {selectedDeal ? (
            <>
              <DealAnalysis
                deal={selectedDeal}
                analysis={analysis}
                loading={analysisLoading}
                onAnalyze={analyze}
              />
              <DealChat messages={chatMessages} onSend={sendChat} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-[#a8b1b8]">
              Select a deal to analyze
            </div>
          )}
        </div>

        {/* Agent Inspector */}
        {selectedDeal && (
          <div className="w-72 flex-shrink-0 border-l border-gray-700 overflow-hidden">
            <AgentInspector logs={logs} />
          </div>
        )}
      </div>
    </div>
  );
}
