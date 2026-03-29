// --- Pipedrive entities ---

export interface PipedriveConnection {
  id: string;
  pipedrive_user_id: number;
  pipedrive_company_id: number;
  api_domain: string;
  access_token: string;
  refresh_token: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface PipedriveLead {
  id: string;
  title: string;
  person_id: number | null;
  organization_id: number | null;
  value: { amount: number; currency: string } | null;
  label_ids: string[];
  source_name: string | null;
}

export interface PipedrivePerson {
  id: number;
  name: string;
  email: { value: string; primary: boolean }[];
  phone: { value: string; primary: boolean }[];
  org_id: number | null;
}

export interface PipedriveOrganization {
  id: number;
  name: string;
  address: string | null;
  cc_email: string | null;
}

// --- Agent state ---

export interface ResearchData {
  company_description: string;
  employee_count: number | null;
  industry: string | null;
  funding_stage: string | null;
  tech_stack: string[];
  recent_news: string[];
  website_url: string | null;
  raw_summary: string;
}

export interface ScoringResult {
  overall_score: number;
  confidence: number;
  criteria: {
    name: string;
    score: number;
    max_score: number;
    reasoning: string;
  }[];
  recommendation: string;
}

export type LeadLabel = 'hot' | 'warm' | 'cold';

export interface EmailDraft {
  subject: string;
  body: string;
}

// --- Business profile / ICP ---

export interface IcpCriterion {
  name: string;
  description: string;
  weight: number;
}

export interface BusinessProfile {
  business_description: string;
  value_proposition: string;
  icp_criteria: IcpCriterion[];
  outreach_tone: string;
  followup_days: number;
}

// --- Agent Hub types ---

export type AgentId =
  | 'lead-qualification'
  | 'deal-coach'
  | 'meeting-prep'
  | 'email-composer'
  | 'data-enrichment'
  | 'pipeline-forecaster';

export type AgentStatus = 'active' | 'simulated' | 'coming-soon';

export interface AgentMeta {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  status: AgentStatus;
  dataScope: 'leads' | 'deals' | 'contacts' | 'pipeline';
  defaultConfig: string;
}

// --- Database rows ---

export type AgentRunTrigger = 'webhook' | 'chat' | 'manual';
export type AgentRunStatus = 'running' | 'paused' | 'completed' | 'failed';
export type EmailDraftStatus = 'pending' | 'sent' | 'discarded' | 'edited';

export interface AgentRunRow {
  id: string;
  connection_id: string;
  lead_id: string;
  agent_id: AgentId;
  trigger: AgentRunTrigger;
  status: AgentRunStatus;
  graph_state: Record<string, unknown> | null;
  score: number | null;
  label: LeadLabel | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogRow {
  id: string;
  run_id: string;
  agent_id: AgentId | null;
  node_name: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface OrgMemoryRow {
  id: string;
  connection_id: string;
  pipedrive_org_id: number;
  org_name: string;
  research_data: ResearchData;
  last_researched_at: string;
  created_at: string;
  updated_at: string;
}

export interface EmailDraftRow {
  id: string;
  run_id: string;
  subject: string;
  body: string;
  status: EmailDraftStatus;
  created_at: string;
  updated_at: string;
}

// Deal Coach types
export interface DealSignal {
  type: 'positive' | 'negative' | 'warning';
  text: string;
}

export interface DealAction {
  priority: number;
  title: string;
  reasoning: string;
  actionType: 'email' | 'task' | 'meeting' | 'research';
}

export interface DealAnalysis {
  healthScore: number;
  scoreTrend: number;
  signals: DealSignal[];
  actions: DealAction[];
}

// Database row types for new tables
export interface HubConfigRow {
  id: string;
  connection_id: string;
  global_context: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConfigRow {
  id: string;
  connection_id: string;
  agent_id: AgentId;
  local_context: string;
  created_at: string;
  updated_at: string;
}

export interface DealAnalysisRow {
  id: string;
  connection_id: string;
  pipedrive_deal_id: number;
  health_score: number;
  signals: DealSignal[];
  actions: DealAction[];
  raw_context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DealChatMessageRow {
  id: string;
  connection_id: string;
  pipedrive_deal_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// Pipedrive Deal type
export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string;
  stage_id: number;
  stage_order_nr: number;
  pipeline_id: number;
  person_id: number | null;
  org_id: number | null;
  user_id: number;
  add_time: string;
  update_time: string;
  stage_change_time: string | null;
  won_time: string | null;
  lost_time: string | null;
  expected_close_date: string | null;
  label: string | null;
  probability: number | null;
}

export interface PipedriveActivity {
  id: number;
  type: string;
  subject: string;
  done: boolean;
  due_date: string | null;
  due_time: string | null;
  add_time: string;
  marked_as_done_time: string | null;
  person_id: number | null;
  deal_id: number | null;
  org_id: number | null;
  note: string | null;
}

export interface PipedriveNote {
  id: number;
  content: string;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  add_time: string;
  update_time: string;
}
