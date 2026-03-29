# PipeAgent — Lead Qualification Agent for Pipedrive

**Date:** 2026-03-29
**Author:** Kristjan Elias
**Status:** Draft

## Purpose

A proof-of-concept agentic workflow built on top of Pipedrive's public API. The goal is to make "agentic AI" tangible for the Pipedrive engineering team — not a production system, but a working, shareable demo that shows what agents can do in a CRM context.

The first agent qualifies inbound leads: it researches the company, scores against ICP criteria, drafts personalized outreach, and presents everything in a transparent UI where humans can inspect the agent's reasoning and override its decisions.

## Architecture

```
Cloudflare Pages (React dashboard + chat UI)
        ↕  Supabase Realtime
Railway Node.js server (LangGraph agent + API)
        ↕               ↕
Supabase Postgres    Pipedrive API
(checkpoints,        (leads, orgs,
 memory, logs)        persons, activities)
```

### Components

**Cloudflare Pages — Web Dashboard**
- Three-panel layout: Leads List | Agent Inspector | Chat
- Bottom bar for email draft review (appears on HITL interrupt)
- "Generate Leads" button for seeding test data
- Supabase Realtime subscriptions for live agent activity updates
- Pipedrive OAuth login (one-click for colleagues on the same PD company)

**Railway — Node.js Agent Server**
- Hono API server
- LangGraph.js orchestrator with three sub-agents (Research, Scoring, Outreach)
- Pipedrive webhook receiver (webhooks registered on first OAuth connection per user; cleaned up on token revocation)
- OAuth token management with automatic refresh
- Lead seeder (CLI + API endpoint)

**Supabase — Data Layer**
- Postgres: LangGraph checkpointing, application tables, agent memory
- Realtime: push agent activity to the dashboard as it happens

## Agent Workflow

The LangGraph orchestrator is a StateGraph with the following flow:

### Main Graph

1. **Receive Input** — webhook payload (new lead) or chat message from user
2. **Fetch Lead Context** — GET lead, person, and organization from Pipedrive API
3. **Check Memory** — query `org_memory` table. If fresh research exists (< 7 days), skip to Scoring
4. **Research Sub-Agent** — Claude-powered web research on the organization (company website, size, industry, funding, tech stack, recent news)
5. **Save Research** — write structured findings to `org_memory` table and Pipedrive org custom fields
6. **Scoring Sub-Agent** — applies ICP criteria to research data, outputs score (1-100), confidence, and reasoning breakdown
7. **Decision** (conditional edge) — Hot (≥70), Warm (40–69), Cold (<40)
8. **Write Back to Pipedrive** — update lead label, custom fields (score, reasoning), add note with research summary
9. **Outreach Sub-Agent** — drafts personalized email based on research and score tier (Cold leads skip this step)
10. **HITL Interrupt** — graph pauses, email draft appears in dashboard. User can Edit, Send (dummy), or Discard
11. **Log Activity** — write to `activity_logs` table, triggers Realtime push to UI

### Sub-Agents

**Research Sub-Agent (sub-graph)**
- System prompt focused on company research
- Tools: web search (Tavily API — LangChain-native, free tier available), website fetch/summarize
- Outputs structured data: employee count, industry, funding stage, tech stack, recent news, company description
- Claude reasons about what information is relevant and trustworthy

**Scoring Sub-Agent (sub-graph)**
- System prompt with ICP criteria (configurable)
- Takes research data as input
- Outputs: overall score (1-100), per-criterion scores with reasoning, confidence level
- Criteria: company size fit, industry fit, budget signals, timing signals

**Outreach Sub-Agent (sub-graph)**
- System prompt for sales email drafting
- Takes research data + score + tier as input
- Hot leads: eager, specific, reference concrete company details
- Warm leads: softer touch, exploratory
- Cold leads: skipped entirely (conditional edge)

### LangGraph Concepts Demonstrated

- **StateGraph** — typed state flowing through the orchestrator
- **Sub-graphs** — each sub-agent is a separate compiled graph, composed into the parent
- **Conditional edges** — routing based on memory freshness, score thresholds, lead tier
- **Checkpointing** — Postgres checkpointer saves state after every node; agent resumes after crashes
- **Human-in-the-loop** — uses LangGraph's `interrupt()` function + `Command({ resume })` pattern in the outreach node; graph pauses, checkpoints, and resumes with the user's edit/send/discard decision passed back as the resume value
- **Memory** — org research persisted across runs; agent behavior changes over time

## Auth & Multi-Tenancy

**Pipedrive Custom App (OAuth 2.0)**
- Registered in Pipedrive Developer Hub as a Custom App (instant, no marketplace approval)
- Scoped to the Pipedrive company account — works for all colleagues on the same PD instance
- OAuth flow: "Sign in with Pipedrive" → authorize → redirect back with token
- Tokens stored in Supabase `connections` table (protected via service-role-only access; application-level encryption is a stretch goal)
- Automatic refresh token rotation

**Multi-user scoping:**
- All agent runs, logs, memory, and drafts scoped by `connection_id`
- Each user's webhook subscriptions include their user ID for routing
- No role-based access — everyone gets the same experience

## Data Model

### connections
| Column | Type | Description |
|---|---|---|
| id | uuid, PK | |
| pipedrive_user_id | int | PD user identifier |
| pipedrive_company_id | int | PD company identifier |
| api_domain | text | e.g., "xtian.pipedrive.com" |
| access_token | text | OAuth access token (service-role access only) |
| refresh_token | text | OAuth refresh token (service-role access only) |
| scopes | text[] | Granted OAuth scopes |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### agent_runs
| Column | Type | Description |
|---|---|---|
| id | uuid, PK | |
| connection_id | FK → connections | |
| lead_id | int | Pipedrive lead ID |
| trigger | text | "webhook", "chat", "manual" |
| status | text | "running", "paused", "completed", "failed" |
| graph_state | jsonb | Current LangGraph state snapshot |
| score | int, nullable | Final qualification score |
| label | text, nullable | "hot", "warm", "cold" |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### activity_logs
| Column | Type | Description |
|---|---|---|
| id | uuid, PK | |
| run_id | FK → agent_runs | |
| node_name | text | "research", "scoring", "outreach", etc. |
| event_type | text | "node_enter", "node_exit", "llm_call", "tool_call", "decision", "error" |
| payload | jsonb | Flexible: prompt, response, tool args, reasoning, scores |
| created_at | timestamptz | |

### org_memory
| Column | Type | Description |
|---|---|---|
| id | uuid, PK | |
| connection_id | FK → connections | |
| pipedrive_org_id | int | Pipedrive organization ID |
| org_name | text | |
| research_data | jsonb | { employees, industry, funding, tech_stack, ... } |
| last_researched_at | timestamptz | For freshness checks |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### email_drafts
| Column | Type | Description |
|---|---|---|
| id | uuid, PK | |
| run_id | FK → agent_runs | |
| subject | text | |
| body | text | |
| status | text | "pending", "sent", "discarded", "edited" |
| created_at | timestamptz | |
| updated_at | timestamptz | |

LangGraph's Postgres checkpointer creates its own internal tables alongside these.

## UI Design

### Three-Panel Layout

**Left: Leads List**
- All leads for the connected user
- Shows name, score badge, label (Hot/Warm/Cold color-coded)
- Click to select — populates Inspector and Chat panels
- "Generate Leads" button at the bottom for seeding

**Center: Agent Inspector**
- The educational centerpiece of the app
- Live step-by-step execution log for the selected lead
- Expandable sections per node: Research, Scoring, Outreach
- Shows for each step:
  - Node name and status (running/complete)
  - Claude prompts and responses (truncated, expandable)
  - Tool calls (API endpoint, args, result summary)
  - Scoring breakdown with per-criterion reasoning
  - Timing (how long each step took)
- Collapsible "Graph State" panel showing raw LangGraph state JSON
- Powered by Supabase Realtime — updates stream in as the agent works

**Right: Chat Panel**
- Conversational interface to the agent about the selected lead
- "Tell me about the Datadog lead" / "Re-score this with stricter criteria" / "Why did you rate budget signals low?"
- Each chat message creates a new `agent_run` (trigger: "chat") for the selected lead. The agent receives the user message plus the lead's existing research/score from memory, then decides which nodes to execute (e.g., a "why" question only runs a reasoning step, "re-score" reruns the scoring sub-agent with the existing research)
- Chat responses stream back via Supabase Realtime, same as the Inspector updates

**Bottom: Email Draft Bar**
- Appears when agent hits the HITL interrupt (outreach draft ready)
- Shows subject + body of the drafted email
- Three actions: Edit (inline editing), Send (dummy — logs to PD as activity), Discard
- Resuming the LangGraph checkpoint on user action

## Lead Seeder

Generates realistic test leads using real companies with fake contacts.

**Real company data:**
- Curated list of ~50-100 real companies across varied sizes and industries
- Mix of good ICP fit (e.g., Notion, Datadog, Figma) and poor fit (e.g., McDonald's, a local bakery)
- Real org names + real websites stored in Pipedrive

**Fake contact data:**
- Generated person names and email addresses
- Varied deal values, lead sources, and notes
- Ensures the research sub-agent can find real company info online

**Two interfaces:**
- CLI: `npm run seed -- --count 20` for bulk creation
- API + UI: "Generate Leads" button creates 1-5 leads on demand for live demos

## Tech Stack

| Technology | Role |
|---|---|
| TypeScript | Language (everything) |
| pnpm workspaces | Monorepo management |
| LangGraph.js (`@langchain/langgraph`) | Agent orchestration, sub-graphs, checkpointing |
| `@langchain/langgraph-checkpoint-postgres` | Persistent checkpointing via Supabase Postgres |
| `@langchain/anthropic` | Claude as the LLM for all sub-agents |
| `@langchain/community` (Tavily) | Web search tool for Research sub-agent |
| Hono | API server on Railway |
| `@supabase/supabase-js` | Database access + Realtime subscriptions |
| React + Vite | Dashboard SPA |
| Tailwind CSS | Styling |
| Cloudflare Pages | Dashboard hosting |
| Railway | Agent server hosting |

## Project Structure

```
pipeagent/
├── apps/
│   ├── web/                        # Cloudflare Pages
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── LeadsList.tsx
│   │   │   │   ├── AgentInspector.tsx
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── EmailDraftBar.tsx
│   │   │   │   └── SeedLeadsButton.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useSupabaseRealtime.ts
│   │   │   │   └── useAgentChat.ts
│   │   │   ├── lib/
│   │   │   │   └── supabase.ts
│   │   │   └── App.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/                     # Railway
│       ├── src/
│       │   ├── server.ts
│       │   ├── routes/
│       │   │   ├── webhooks.ts
│       │   │   ├── chat.ts
│       │   │   ├── auth.ts
│       │   │   └── seed.ts
│       │   ├── agent/
│       │   │   ├── graph.ts
│       │   │   ├── state.ts
│       │   │   ├── nodes/
│       │   │   │   ├── fetchContext.ts
│       │   │   │   ├── checkMemory.ts
│       │   │   │   ├── saveResearch.ts
│       │   │   │   ├── writeBack.ts
│       │   │   │   └── logActivity.ts
│       │   │   └── subagents/
│       │   │       ├── research.ts
│       │   │       ├── scoring.ts
│       │   │       └── outreach.ts
│       │   ├── pipedrive/
│       │   │   ├── client.ts
│       │   │   ├── oauth.ts
│       │   │   └── types.ts
│       │   ├── memory/
│       │   │   └── orgMemory.ts
│       │   └── seed/
│       │       ├── companies.ts
│       │       └── generator.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/
│       ├── types.ts
│       └── package.json
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
│
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Environment Variables

### Server (Railway)
```
ANTHROPIC_API_KEY=
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=
PIPEDRIVE_REDIRECT_URI=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=              # Direct Postgres connection for LangGraph checkpointer
```

### Web (Cloudflare Pages)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=              # Railway server URL
```

## Success Criteria

1. A colleague can visit the URL, connect their Pipedrive account, and see the agent qualify a lead end-to-end
2. The Agent Inspector makes the agent's reasoning fully transparent — every step, every decision, every API call
3. The chat interface lets users ask questions about leads and override agent decisions
4. The email draft flow demonstrates human-in-the-loop patterns concretely
5. The codebase is readable enough that an engineer can understand how LangGraph works by reading it
