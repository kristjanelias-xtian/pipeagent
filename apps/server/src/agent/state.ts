import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type {
  ResearchData,
  ScoringResult,
  LeadLabel,
  EmailDraft,
  CompanyProfile,
  AgentIdentityRow,
  PipedriveLead,
  PipedrivePerson,
  PipedriveOrganization,
} from '@pipeagent/shared';

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  connectionId: Annotation<string>,
  leadId: Annotation<string>,
  runId: Annotation<string>,
  trigger: Annotation<'webhook' | 'chat' | 'manual'>,
  userMessage: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  lead: Annotation<PipedriveLead | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  person: Annotation<PipedrivePerson | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  organization: Annotation<PipedriveOrganization | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  existingResearch: Annotation<ResearchData | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  memoryFresh: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  research: Annotation<ResearchData | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  scoring: Annotation<ScoringResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  label: Annotation<LeadLabel | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  emailDraft: Annotation<EmailDraft | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlAction: Annotation<'send' | 'discard' | 'edit' | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  editedEmail: Annotation<EmailDraft | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  companyProfile: Annotation<CompanyProfile | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  identity: Annotation<AgentIdentityRow | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
