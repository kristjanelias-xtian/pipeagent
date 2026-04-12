import { Annotation } from '@langchain/langgraph';
import type {
  PipedriveDeal,
  PipedriveActivity,
  PipedriveNote,
  PipedrivePerson,
  PipedriveOrganization,
  CompanyProfile,
  AgentIdentityRow,
  DealSignal,
  DealAction,
} from '@pipeagent/shared';

export const DealCoachState = Annotation.Root({
  connectionId: Annotation<string>,
  dealId: Annotation<number>,
  runId: Annotation<string>,
  deal: Annotation<PipedriveDeal | null>({ reducer: (_, v) => v, default: () => null }),
  activities: Annotation<PipedriveActivity[]>({ reducer: (_, v) => v, default: () => [] }),
  notes: Annotation<PipedriveNote[]>({ reducer: (_, v) => v, default: () => [] }),
  participants: Annotation<PipedrivePerson[]>({ reducer: (_, v) => v, default: () => [] }),
  organization: Annotation<PipedriveOrganization | null>({ reducer: (_, v) => v, default: () => null }),
  stageName: Annotation<string>({ reducer: (_, v) => v, default: () => '' }),
  signals: Annotation<DealSignal[]>({ reducer: (_, v) => v, default: () => [] }),
  healthScore: Annotation<number>({ reducer: (_, v) => v, default: () => 0 }),
  actions: Annotation<DealAction[]>({ reducer: (_, v) => v, default: () => [] }),
  companyProfile: Annotation<CompanyProfile | null>({ reducer: (_, v) => v, default: () => null }),
  identity: Annotation<AgentIdentityRow | null>({ reducer: (_, v) => v, default: () => null }),
});

export type DealCoachStateType = typeof DealCoachState.State;
