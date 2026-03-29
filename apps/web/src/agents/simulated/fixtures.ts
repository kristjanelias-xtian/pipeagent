// ─── Meeting Prep ──────────────────────────────────────────────────────────────

export interface MeetingAttendee {
  name: string;
  title: string;
  bio: string;
  linkedIn?: string;
}

export interface Meeting {
  id: string;
  date: string; // ISO date string
  time: string;
  durationMins: number;
  attendees: MeetingAttendee[];
  company: string;
  companyOverview: string;
  industry: string;
  talkingPoints: string[];
  suggestedQuestions: string[];
}

export const meetings: Meeting[] = [
  {
    id: 'mtg-1',
    date: '2026-03-31',
    time: '10:00 AM',
    durationMins: 45,
    company: 'Solviq Technologies',
    industry: 'B2B SaaS · 280 employees',
    companyOverview:
      'Solviq Technologies is a Berlin-based B2B SaaS platform specializing in supply-chain visibility for mid-market manufacturers. Founded in 2019, they raised a €22M Series B in January 2026 and are aggressively expanding their sales org. Their flagship product, FlowTrack, integrates with ERPs like SAP and Microsoft Dynamics to provide real-time logistics dashboards.',
    attendees: [
      {
        name: 'Maren Schulz',
        title: 'VP of Sales',
        bio: 'Maren joined Solviq in 2023 after 6 years at Salesforce EMEA. She leads a 35-person sales team and recently championed the move to a centralized CRM. She is known for data-driven decision making and a preference for concise demos.',
      },
      {
        name: 'Tobias Kremer',
        title: 'Head of Revenue Operations',
        bio: 'Tobias manages the RevOps function including tech stack, deal desk, and forecasting. He has a strong technical background and will likely probe on API integrations and data accuracy. He evaluates vendors on total cost of ownership.',
      },
    ],
    talkingPoints: [
      'Congratulate them on the Series B and acknowledge their growth trajectory.',
      'Lead with the sales-velocity story — teams using Pipedrive close 26% faster on average.',
      'Highlight the Pipedrive ↔ SAP native connector as a differentiator vs Salesforce.',
      'Reference similar mid-market manufacturing wins: Fronius, Kässbohrer.',
      'Position AI-powered lead scoring as a key feature for their expanding SDR team.',
    ],
    suggestedQuestions: [
      'What does your current CRM reporting process look like, and where does it break down?',
      'How are your SDRs currently prioritizing which accounts to work first?',
      'What does a successful RevOps tool look like to you 12 months from now?',
      'Are there specific ERP data points you need surfaced inside your CRM today?',
      'What is your typical evaluation timeline before a tool like this goes to procurement?',
    ],
  },
  {
    id: 'mtg-2',
    date: '2026-03-31',
    time: '2:30 PM',
    durationMins: 30,
    company: 'Lantern Capital Partners',
    industry: 'Private Equity · 45 employees',
    companyOverview:
      'Lantern Capital Partners is a London-based growth equity firm focused on B2B software companies in the €5M–€50M ARR range. They manage €800M AUM across two funds. Their portfolio companies often adopt standardized operational tooling post-investment, creating an opportunity for multi-seat enterprise deals.',
    attendees: [
      {
        name: 'Charlotte Davies',
        title: 'Operating Partner',
        bio: 'Charlotte works directly with Lantern portfolio companies on go-to-market strategy and tooling. She has driven CRM standardization across 6 portfolio companies in the past 3 years. She moves fast and values vendors who can support portfolio-wide rollouts.',
      },
    ],
    talkingPoints: [
      'Frame Pipedrive as the preferred CRM layer for scaling B2B software companies.',
      'Introduce the Pipedrive Partner Program and volume licensing for portfolio deals.',
      'Share the case study: Nordics PE firm standardized Pipedrive across 8 portfolio cos.',
      'Mention dedicated onboarding and a named CSM for portfolio-level accounts.',
    ],
    suggestedQuestions: [
      'How many of your current portfolio companies have an active CRM in place?',
      'What is the biggest operational pain point you see across portfolio GTM teams?',
      'Would a portfolio-level master agreement be interesting to explore?',
      'Who typically owns the CRM decision post-investment — the CEO or VP Sales?',
    ],
  },
  {
    id: 'mtg-3',
    date: '2026-04-02',
    time: '11:15 AM',
    durationMins: 60,
    company: 'Meridian Health Networks',
    industry: 'Health Tech · 510 employees',
    companyOverview:
      'Meridian Health Networks is a US-based digital health company providing B2B care coordination software to hospital systems and clinics. They recently expanded into Europe and are building out an enterprise sales team from scratch. Regulatory compliance (HIPAA, GDPR) is a top concern for any tooling decision.',
    attendees: [
      {
        name: 'Priya Nair',
        title: 'Chief Revenue Officer',
        bio: 'Priya joined Meridian 8 months ago from Epic Systems. She is rebuilding the commercial org to support enterprise motion and is currently evaluating CRM vendors. She has a strong preference for tools with HIPAA Business Associate Agreements and robust audit logging.',
      },
      {
        name: 'James Whitfield',
        title: 'Director of Enterprise Sales',
        bio: 'James leads the 12-person enterprise sales team. He is frustrated by their current spreadsheet-based pipeline management and is pushing for a CRM decision within Q2. He will focus heavily on ease of use and adoption rates for his reps.',
      },
    ],
    talkingPoints: [
      'Lead with Pipedrive\'s security credentials: SOC 2 Type II, GDPR compliance, BAA availability.',
      'Address HIPAA proactively — have the BAA documentation ready to share.',
      'Demo the pipeline view and show how reps can update deals in under 30 seconds.',
      'Share adoption benchmarks: 94% rep adoption at similar health-tech customers.',
      'Propose a 30-day pilot with 10 seats on the enterprise plan.',
    ],
    suggestedQuestions: [
      'What is your current process for tracking enterprise deals end-to-end?',
      'Are there specific compliance certifications that are table stakes for your IT team?',
      'What does onboarding and change management look like for a tool like this at Meridian?',
      'What is the biggest risk you see in making a CRM change right now?',
      'If this pilot goes well, what would expansion look like — how many seats, which teams?',
    ],
  },
];

// ─── Email Composer ────────────────────────────────────────────────────────────

export type EmailStatus = 'draft' | 'sent' | 'scheduled';
export type EmailTone = 'Professional' | 'Friendly' | 'Direct';

export interface Email {
  id: string;
  to: string;
  company: string;
  subject: string;
  body: string;
  status: EmailStatus;
  tone: EmailTone;
  personalizationScore: number;
  scheduledFor?: string;
  sentAt?: string;
}

export const emails: Email[] = [
  {
    id: 'email-1',
    to: 'maren.schulz@solviq.io',
    company: 'Solviq Technologies',
    subject: 'Following up — Pipedrive × Solviq next steps',
    body: `Hi Maren,

Great speaking with you and Tobias on Tuesday. I wanted to follow up with the resources we discussed.

I've attached the Pipedrive ↔ SAP connector overview and the Kässbohrer case study (23% reduction in average sales cycle, 31% improvement in forecast accuracy after 6 months).

A few things I heard that I think we can address directly:

→ Real-time ERP data sync inside deal cards — live today, no middleware required
→ Forecasting module with historical trend overlay for Tobias's reporting needs
→ Dedicated onboarding for your SDR expansion (we can have 30 seats live in 2 weeks)

Would you be open to a 30-minute deep-dive with our solutions team next week? I have Thursday 2pm or Friday 10am CET available.

Best,
Kristjan`,
    status: 'draft',
    tone: 'Professional',
    personalizationScore: 91,
  },
  {
    id: 'email-2',
    to: 'charlotte.davies@lanterncapital.com',
    company: 'Lantern Capital Partners',
    subject: 'Pipedrive for Lantern portfolio — volume program details',
    body: `Hi Charlotte,

Thanks for the time last week — it's clear you've thought deeply about the operational consistency problem across your portfolio.

I've put together a summary of our Portfolio Partner Program:

• Single master agreement covering all portfolio companies
• Blended per-seat pricing based on total committed seats (typically 30–40% below list)
• Named Customer Success Manager for portfolio-level coordination
• Shared reporting dashboard so you can see adoption and pipeline health across all cos

We've done this with 3 other growth equity firms in Europe — happy to make an intro to one of them if useful.

Want to grab 20 minutes this week to walk through the commercial structure?

Kristjan`,
    status: 'sent',
    sentAt: '2026-03-28T09:14:00Z',
    tone: 'Professional',
    personalizationScore: 87,
  },
  {
    id: 'email-3',
    to: 'priya.nair@meridianhealth.com',
    company: 'Meridian Health Networks',
    subject: 'Pipedrive BAA + compliance docs — as promised',
    body: `Hi Priya,

As promised, attaching our security and compliance package:

1. HIPAA Business Associate Agreement (pre-signed by our DPO)
2. SOC 2 Type II report (latest audit: Feb 2026)
3. GDPR Data Processing Addendum
4. Penetration test summary (Nov 2025)

On the pilot: I'd suggest starting with James's enterprise team — 10 seats, 30 days, we'll migrate your existing Salesforce pipeline data at no charge. Our health-tech CSM, Ana, has done this migration 12 times.

Happy to loop in our Security team for a 30-minute Q&A with your IT team before you sign anything.

Best,
Kristjan`,
    status: 'scheduled',
    scheduledFor: '2026-04-01T08:00:00Z',
    tone: 'Direct',
    personalizationScore: 94,
  },
  {
    id: 'email-4',
    to: 'tobias.kremer@solviq.io',
    company: 'Solviq Technologies',
    subject: 'API docs + data dictionary for your review',
    body: `Hi Tobias,

Quick note — I've shared access to our developer portal where you'll find:

• Full REST API reference with rate limits and auth details
• Webhook event catalog (all 47 deal/contact/activity events)
• SAP S/4HANA and Dynamics 365 field mapping guide
• Sandbox environment credentials (valid 30 days)

Let me know if you want to set up a technical session with our solutions engineer. He's done the SAP integration for Fronius and can walk you through the implementation in detail.

Kristjan`,
    status: 'sent',
    sentAt: '2026-03-26T14:32:00Z',
    tone: 'Direct',
    personalizationScore: 82,
  },
  {
    id: 'email-5',
    to: 'james.whitfield@meridianhealth.com',
    company: 'Meridian Health Networks',
    subject: 'Quick check-in — pilot kickoff timing',
    body: `Hey James,

Just wanted to check in ahead of the pilot discussion. A couple of things that might be helpful to know:

We can import your existing deals from Salesforce in about 2 hours — including all custom fields, contact history, and attached notes. Your reps won't lose a thing.

For onboarding, I'd recommend a 90-minute live session for your team. Most reps tell us they feel confident after the first week. We also have a health-tech specific playbook we can share upfront.

Are you still targeting a Q2 decision? Happy to work backwards from your timeline.

Talk soon,
Kristjan`,
    status: 'draft',
    tone: 'Friendly',
    personalizationScore: 78,
  },
];

// ─── Data Enrichment ───────────────────────────────────────────────────────────

export type EnrichmentStatus = 'enriched' | 'pending' | 'not-found';

export interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  linkedIn: string | null;
  title: string;
  location: string | null;
  companySize: string | null;
  status: EnrichmentStatus;
  enrichedAt?: string;
  newFields: string[]; // field keys that were added by enrichment
}

export const contacts: Contact[] = [
  {
    id: 'c-1',
    name: 'Maren Schulz',
    company: 'Solviq Technologies',
    email: 'maren.schulz@solviq.io',
    phone: '+49 30 8844 2201',
    linkedIn: 'linkedin.com/in/maren-schulz-solviq',
    title: 'VP of Sales',
    location: 'Berlin, Germany',
    companySize: '280 employees',
    status: 'enriched',
    enrichedAt: '2026-03-29T08:12:00Z',
    newFields: ['phone', 'linkedIn', 'location', 'companySize'],
  },
  {
    id: 'c-2',
    name: 'Tobias Kremer',
    company: 'Solviq Technologies',
    email: 'tobias.kremer@solviq.io',
    phone: '+49 30 8844 2209',
    linkedIn: 'linkedin.com/in/tobias-kremer',
    title: 'Head of Revenue Operations',
    location: 'Berlin, Germany',
    companySize: '280 employees',
    status: 'enriched',
    enrichedAt: '2026-03-29T08:13:00Z',
    newFields: ['phone', 'linkedIn', 'location'],
  },
  {
    id: 'c-3',
    name: 'Charlotte Davies',
    company: 'Lantern Capital Partners',
    email: 'charlotte.davies@lanterncapital.com',
    phone: '+44 20 7946 0312',
    linkedIn: 'linkedin.com/in/charlotte-davies-vc',
    title: 'Operating Partner',
    location: 'London, UK',
    companySize: '45 employees',
    status: 'enriched',
    enrichedAt: '2026-03-28T14:22:00Z',
    newFields: ['phone', 'linkedIn', 'location', 'companySize'],
  },
  {
    id: 'c-4',
    name: 'Priya Nair',
    company: 'Meridian Health Networks',
    email: 'priya.nair@meridianhealth.com',
    phone: '+1 628 555 0193',
    linkedIn: 'linkedin.com/in/priya-nair-cro',
    title: 'Chief Revenue Officer',
    location: 'San Francisco, CA',
    companySize: '510 employees',
    status: 'enriched',
    enrichedAt: '2026-03-29T09:01:00Z',
    newFields: ['phone', 'linkedIn', 'location', 'companySize'],
  },
  {
    id: 'c-5',
    name: 'James Whitfield',
    company: 'Meridian Health Networks',
    email: 'james.whitfield@meridianhealth.com',
    phone: '+1 628 555 0187',
    linkedIn: 'linkedin.com/in/james-whitfield-sales',
    title: 'Director of Enterprise Sales',
    location: 'San Francisco, CA',
    companySize: '510 employees',
    status: 'enriched',
    enrichedAt: '2026-03-29T09:03:00Z',
    newFields: ['phone', 'linkedIn'],
  },
  {
    id: 'c-6',
    name: 'Rafael Monteiro',
    company: 'Arcturus Software',
    email: 'rmonteiro@arcturussoft.com',
    phone: null,
    linkedIn: null,
    title: 'CEO',
    location: null,
    companySize: null,
    status: 'pending',
    newFields: [],
  },
  {
    id: 'c-7',
    name: 'Sophie Lindqvist',
    company: 'Nordic Ventures Group',
    email: 'sophie.l@nordicventures.se',
    phone: null,
    linkedIn: null,
    title: 'Investment Manager',
    location: null,
    companySize: null,
    status: 'pending',
    newFields: [],
  },
  {
    id: 'c-8',
    name: 'Arjun Mehta',
    company: 'Zenova Logistics',
    email: 'arjun@zenova-unknown.io',
    phone: null,
    linkedIn: null,
    title: 'Head of Operations',
    location: null,
    companySize: null,
    status: 'not-found',
    newFields: [],
  },
];

// ─── Pipeline Forecaster ───────────────────────────────────────────────────────

export type DealStage =
  | 'Qualified'
  | 'Demo Scheduled'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Contract Review';

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  stage: DealStage;
  closeProbability: number; // 0–100
  confidence: ConfidenceLevel;
  expectedCloseDate: string;
  owner: string;
}

export interface PipelineSummary {
  totalValue: number;
  weightedValue: number;
  predictedThisMonth: number;
  predictedThisQuarter: number;
}

export const deals: Deal[] = [
  {
    id: 'd-1',
    title: 'Solviq Technologies — Enterprise (50 seats)',
    company: 'Solviq Technologies',
    value: 47500,
    stage: 'Negotiation',
    closeProbability: 82,
    confidence: 'High',
    expectedCloseDate: '2026-03-31',
    owner: 'Kristjan E.',
  },
  {
    id: 'd-2',
    title: 'Meridian Health Networks — Pilot Expansion',
    company: 'Meridian Health Networks',
    value: 63200,
    stage: 'Proposal Sent',
    closeProbability: 68,
    confidence: 'Medium',
    expectedCloseDate: '2026-04-15',
    owner: 'Kristjan E.',
  },
  {
    id: 'd-3',
    title: 'Lantern Capital — Portfolio Program',
    company: 'Lantern Capital Partners',
    value: 112000,
    stage: 'Contract Review',
    closeProbability: 91,
    confidence: 'High',
    expectedCloseDate: '2026-03-31',
    owner: 'Kristjan E.',
  },
  {
    id: 'd-4',
    title: 'Arcturus Software — SMB (15 seats)',
    company: 'Arcturus Software',
    value: 14250,
    stage: 'Demo Scheduled',
    closeProbability: 45,
    confidence: 'Medium',
    expectedCloseDate: '2026-04-22',
    owner: 'Sara K.',
  },
  {
    id: 'd-5',
    title: 'Nordic Ventures Group — Starter',
    company: 'Nordic Ventures Group',
    value: 8900,
    stage: 'Qualified',
    closeProbability: 28,
    confidence: 'Low',
    expectedCloseDate: '2026-05-10',
    owner: 'Sara K.',
  },
  {
    id: 'd-6',
    title: 'Zenova Logistics — Mid-Market (30 seats)',
    company: 'Zenova Logistics',
    value: 29700,
    stage: 'Proposal Sent',
    closeProbability: 55,
    confidence: 'Medium',
    expectedCloseDate: '2026-04-30',
    owner: 'Kristjan E.',
  },
];

export const pipelineSummary: PipelineSummary = {
  totalValue: 275550,
  weightedValue: 178640,
  predictedThisMonth: 142380,
  predictedThisQuarter: 178640,
};
