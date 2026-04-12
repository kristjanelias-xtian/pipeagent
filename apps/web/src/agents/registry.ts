import type { AgentMeta, IcpCriterion } from '@pipeagent/shared';

const DEFAULT_ICP_CRITERIA: IcpCriterion[] = [
  { name: 'Company Size', description: 'Number of employees or revenue band', weight: 25 },
  { name: 'Industry Fit', description: 'Alignment with target verticals', weight: 25 },
  { name: 'Budget Signals', description: 'Evidence of budget or purchasing intent', weight: 25 },
  { name: 'Timing Signals', description: 'Urgency or project timeline indicators', weight: 25 },
];

export const agents: AgentMeta[] = [
  {
    id: 'lead-qualification',
    name: 'Lead Qualifier',
    role: 'Lead Qualifier',
    icon: 'UserSearch',
    description: 'Qualifies incoming leads against your ICP and drafts outreach.',
    status: 'active',
    dataScope: 'leads',
    scopeIn: 'New leads, research, ICP scoring, first outreach draft, human review handoff.',
    scopeOut: 'Deals, site visits, contracts, follow-up sequencing.',
    defaultIdentity: {
      name: 'Nora',
      mission: 'Qualify solar inbound. I care about roof, budget, and timeline.',
      personality: 'Warm, professional, no pressure.',
    },
    defaultConfig: {
      icp_criteria: DEFAULT_ICP_CRITERIA,
      followup_days: 3,
    },
  },
  {
    id: 'deal-coach',
    name: 'Deal Coach',
    role: 'Deal Coach',
    icon: 'TrendingUp',
    description: 'Watches the pipeline and flags deals that are stuck.',
    status: 'active',
    dataScope: 'deals',
    scopeIn: 'Deal health scoring, stuck-deal detection, coaching suggestions, pipeline-wide context.',
    scopeOut: 'Lead intake, scoring, outreach drafting.',
    defaultIdentity: {
      name: 'Dex',
      mission: 'I watch the pipeline and nudge deals that are stuck.',
      personality: 'Direct, numbers-oriented, light on narration.',
    },
    defaultConfig: {},
  },
  {
    id: 'meeting-prep',
    name: 'Meeting Prep',
    role: 'Meeting Prep',
    icon: 'Calendar',
    description: 'Generates briefing docs before calls',
    status: 'simulated',
    dataScope: 'contacts',
    scopeIn: 'Upcoming meetings, participant research, agenda suggestions.',
    scopeOut: 'Everything else.',
    defaultIdentity: { name: '', mission: '', personality: '' },
    defaultConfig: {},
  },
  {
    id: 'email-composer',
    name: 'Email Composer',
    role: 'Email Composer',
    icon: 'Mail',
    description: 'Drafts personalized outreach & follow-ups',
    status: 'simulated',
    dataScope: 'contacts',
    scopeIn: 'Email drafting, follow-up sequences, personalization.',
    scopeOut: 'Everything else.',
    defaultIdentity: { name: '', mission: '', personality: '' },
    defaultConfig: {},
  },
  {
    id: 'data-enrichment',
    name: 'Data Enrichment',
    role: 'Data Enrichment',
    icon: 'Database',
    description: 'Auto-fills missing contact & company fields',
    status: 'simulated',
    dataScope: 'contacts',
    scopeIn: 'Contact and company data lookup, field completion.',
    scopeOut: 'Everything else.',
    defaultIdentity: { name: '', mission: '', personality: '' },
    defaultConfig: {},
  },
  {
    id: 'pipeline-forecaster',
    name: 'Pipeline Forecaster',
    role: 'Pipeline Forecaster',
    icon: 'LineChart',
    description: 'Scores deal health and predicts close probability',
    status: 'simulated',
    dataScope: 'pipeline',
    scopeIn: 'Pipeline analytics, close probability, revenue forecasting.',
    scopeOut: 'Everything else.',
    defaultIdentity: { name: '', mission: '', personality: '' },
    defaultConfig: {},
  },
];

export function getAgent(id: string): AgentMeta | undefined {
  return agents.find((a) => a.id === id);
}
