import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useConnection } from './hooks/useConnection';
import { HubShell } from './components/HubShell';
import { LoginPage } from './pages/LoginPage';
import { Home } from './pages/Home';
import { LeadQualificationWorkspace } from './agents/lead-qualification/Workspace';
import { DealCoachWorkspace } from './agents/deal-coach/Workspace';
import { MeetingPrepWorkspace } from './agents/meeting-prep/Workspace';
import { EmailComposerWorkspace } from './agents/email-composer/Workspace';
import { DataEnrichmentWorkspace } from './agents/data-enrichment/Workspace';
import { PipelineForecasterWorkspace } from './agents/pipeline-forecaster/Workspace';

export default function App() {
  const { user, loading, login } = useConnection();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-[#6a7178]">
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {!user ? (
          <Route path="*" element={<LoginPage onLogin={login} />} />
        ) : (
          <Route element={<HubShell user={user} />}>
            <Route index element={<Home />} />
            {/* Agent workspace routes */}
            <Route path="agent/lead-qualification" element={<LeadQualificationWorkspace />} />
            <Route path="agent/deal-coach" element={<DealCoachWorkspace />} />
            <Route path="agent/meeting-prep" element={<MeetingPrepWorkspace />} />
            <Route path="agent/email-composer" element={<EmailComposerWorkspace />} />
            <Route path="agent/data-enrichment" element={<DataEnrichmentWorkspace />} />
            <Route path="agent/pipeline-forecaster" element={<PipelineForecasterWorkspace />} />
            <Route
              path="agent/*"
              element={
                <div className="flex items-center justify-center h-full text-[#6a7178]">
                  Workspace coming soon
                </div>
              }
            />
            <Route
              path="settings"
              element={
                <div className="p-6 text-[#6a7178]">Settings coming soon</div>
              }
            />
            <Route
              path="build"
              element={
                <div className="p-6 text-[#6a7178]">
                  Build Your Own coming soon
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
