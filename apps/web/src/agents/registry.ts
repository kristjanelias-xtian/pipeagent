import type { AgentMeta } from '@pipeagent/shared';

export const agents: AgentMeta[] = [
  {
    id: 'lead-qualification',
    name: 'Lead Qualification',
    icon: '\u{1F3AF}',
    description: 'Researches & scores incoming leads against ICP',
    status: 'active',
    dataScope: 'leads',
    defaultConfig:
      'Score leads on: Company Size, Industry Fit, Budget Signals, Timing Signals.',
  },
  {
    id: 'deal-coach',
    name: 'Deal Coach',
    icon: '\u{1F9E0}',
    description: 'Analyzes deal health and suggests next actions',
    status: 'active',
    dataScope: 'deals',
    defaultConfig:
      'A deal is "at risk" if: no activity in 10+ days, missing decision maker, or competitor mentioned.',
  },
  {
    id: 'meeting-prep',
    name: 'Meeting Prep',
    icon: '\u{1F4CB}',
    description: 'Generates briefing docs before calls',
    status: 'simulated',
    dataScope: 'contacts',
    defaultConfig: '',
  },
  {
    id: 'email-composer',
    name: 'Email Composer',
    icon: '\u{2709}\u{FE0F}',
    description: 'Drafts personalized outreach & follow-ups',
    status: 'simulated',
    dataScope: 'contacts',
    defaultConfig: '',
  },
  {
    id: 'data-enrichment',
    name: 'Data Enrichment',
    icon: '\u{1F50D}',
    description: 'Auto-fills missing contact & company fields',
    status: 'simulated',
    dataScope: 'contacts',
    defaultConfig: '',
  },
  {
    id: 'pipeline-forecaster',
    name: 'Pipeline Forecaster',
    icon: '\u{1F4CA}',
    description: 'Scores deal health and predicts close probability',
    status: 'simulated',
    dataScope: 'pipeline',
    defaultConfig: '',
  },
];

export function getAgent(id: string): AgentMeta | undefined {
  return agents.find((a) => a.id === id);
}
