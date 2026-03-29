# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PipeAgent is an AI-powered agent hub for Pipedrive CRM. It provides a registry of specialized agents — currently Lead Qualification and Deal Coach (active), plus four simulated agents (Meeting Prep, Email Composer, Data Enrichment, Pipeline Forecaster). Each agent has its own workspace, LangGraph pipeline, and configurable context. A hub-level global context is shared across all agents, with per-agent local context for customization.

**Live at:** `pipeagent.xtian.me` (deployed on Railway)

## Commands

```bash
# Development (runs server + web concurrently)
pnpm dev

# Individual dev servers
pnpm dev:server          # tsx watch on apps/server (port 3001)
pnpm dev:web             # vite dev server (port 5173)

# Build
pnpm build               # builds shared package first, then server + web in parallel

# Generate test leads in Pipedrive
pnpm seed
```

No test framework is configured yet.

## Architecture

**Monorepo** (pnpm workspaces): `apps/server`, `apps/web`, `packages/shared`

### Server (`apps/server`)

Hono HTTP server with these route groups mounted in `server.ts`:
- `/auth` — Pipedrive OAuth flow (login → callback), JWT token generation
- `/me` — Get authenticated user/connection info
- `/webhooks` — Pipedrive `lead.added` webhook handler
- `/chat` — Lead qualification agent trigger/resume endpoints (/message, /run, /resume, /runs/:leadId, /logs/:runId)
- `/leads` — Proxy to Pipedrive leads API
- `/deals` — Deal Coach endpoints (analyze, get analysis, chat)
- `/settings` — Business profile CRUD (ICP criteria, outreach tone)
- `/hub-config` — Global context CRUD (shared across all agents)
- `/agent-config` — Per-agent local context CRUD
- `/seed` — Test data generation

**Auth middleware** uses JWT tokens (HS256, 7-day expiry) with a whitelist pattern — only routes `/me`, `/chat`, `/seed`, `/leads`, `/deals`, `/settings`, `/hub-config`, `/agent-config` require auth. `/auth` and `/webhooks` skip it.

**Route behavior notes:**
- `POST /chat/message` — skips if an existing run (completed/paused/running) already exists for the lead; returns the existing run info instead
- `POST /chat/run` — always creates a new run (used for requalification)
- `POST /deals/:dealId/analyze` — triggers Deal Coach analysis in background, returns immediately
- `GET /deals/:dealId/analysis` — returns cached analysis
- `POST /deals/:dealId/chat` — send coaching question, get AI response

### Agents

Multi-agent architecture with a registry pattern. Each agent has its own graph, state, and sub-agents.

#### Lead Qualification (`apps/server/src/agent/`)

LangGraph `StateGraph` with PostgreSQL checkpointing for resumable execution:

```
fetchContext → checkMemory →[fresh?]→ runResearch → saveResearch → runScoring → writeBack →[cold?]→ runOutreach → hitlReview → logActivity
                              ↓ (skip)                                              ↓ (skip to end)
                         runScoring                                              logActivity
```

- **State** defined in `state.ts` using LangGraph's `Annotation` system
- **Sub-agents** in `subagents/`:
  - **research** — uses `@anthropic-ai/sdk` directly with built-in `web_search` tool (not LangChain)
  - **scoring** and **outreach** — use `@langchain/anthropic` `ChatAnthropic`
  - All invoke Claude Sonnet with specific system prompts and structured JSON output
- **HITL interrupt** at `hitlReview` — pauses execution, resumes via `POST /chat/resume` with user's send/edit/discard decision
- **Activity logging** (`logger.ts`) — every node writes to `activity_logs` table, powering the Inspector UI

#### Deal Coach (`apps/server/src/agents/deal-coach/`)

LangGraph `StateGraph` that analyzes deal health and suggests actions:

```
fetchDealContext → analyzeSignals → scoreHealth → generateActions
```

- **fetchDealContext** — fetches deal, activities, notes, participants, org, and stage from Pipedrive; loads hub_config global context and agent_config local context
- **analyzeSignals** — Claude Sonnet analyzes deal data to extract signals (positive/negative/warning)
- **scoreHealth** — calculates health score (0-100) based on signal ratio, activity recency, stage staleness
- **generateActions** — suggests 3-5 prioritized actions (email/task/meeting/research); upserts results to `deal_analyses` table
- **Chat** — separate from the graph; uses cached analysis + conversation history to answer coaching questions via Claude

### Web (`apps/web`)

React 19 + Vite + Tailwind CSS 4. Hub layout with React Router.

**Layout:**
- **HubShell** — top-level container with Sidebar + TopBar + content outlet
- **TopBar** — logo ("Agent Hub"), Pipedrive domain, user avatar
- **Sidebar** — collapsible navigation: Home, agent list (all 6), Build Your Own, Settings

**Pages:**
- **Home** — agent grid (3 columns) with status badges + recent activity feed
- **Agent Workspaces** (`/agent/:agentId`) — per-agent UI loaded from `apps/web/src/agents/`
  - Lead Qualification: three-panel layout (LeadsList + AgentInspector + ChatPanel) with EmailDraftBar
  - Deal Coach: three-panel layout (DealList + DealAnalysis + DealChat) with health scores and signal cards
- **Settings** — tabs for Business Context (global + per-agent config), Pipedrive Connection, Notifications
- **Build Your Own** — placeholder for custom agent development
- **LoginPage** — OAuth login (shown when unauthenticated)

**Agent Registry** (`apps/web/src/agents/registry.ts`):
- Defines all 6 agents with metadata: id, name, icon, description, status (active/simulated), data scope, default config
- Workspace components loaded per-agent; simulated agents show placeholder UI

Realtime updates via Supabase channel subscriptions (hooks in `src/hooks/`). API calls go through `lib/api.ts` which attaches JWT token from localStorage.

### Shared (`packages/shared`)

TypeScript types — CRM entities, agent state types, database row types, plus hub types (`AgentMeta`, `AgentId`, `AgentStatus`, `DealSignal`, `DealAction`, `DealAnalysis`). Referenced by both apps via project references.

### Pipedrive Integration (`apps/server/src/pipedrive/`)

- `client.ts` — API v1 wrapper (leads, persons, orgs, labels, notes, webhooks)
- `oauth.ts` — Token exchange and proactive refresh
- Tokens stored in `connections` table; `getClientForConnection()` refreshes before use

### Database (Supabase/PostgreSQL)

Migrations in `supabase/migrations/`:
- `001_initial.sql` — connections, agent_runs, activity_logs, org_memory, email_drafts
- `002_business_profiles.sql` — ICP settings per connection
- `003_followup_days.sql` — adds followup_days to business_profiles
- `004_agent_hub.sql` — hub_config, agent_config, deal_analyses, deal_chat_messages; adds agent_id to agent_runs and activity_logs

Supabase Realtime enabled on: `activity_logs`, `agent_runs`, `email_drafts`, `deal_analyses`, `deal_chat_messages`

## Key Patterns

- **JWT auth with API path whitelist** — JWT tokens (HS256, 7-day expiry) applied only to known API paths; `/auth` and `/webhooks` skip auth
- **Agent registry pattern** — agents registered in `registry.ts` with metadata; hub iterates registry for UI and routing
- **Hub-level vs agent-level context** — `hub_config.global_context` shared across all agents; `agent_config.local_context` per agent per connection
- **Org memory caching** — research results cached 7 days in `org_memory` table to avoid redundant web searches
- **Conditional graph routing** — Lead Qual skips research if cache fresh, skips outreach if lead scored cold
- **Server uses ES modules** — `"type": "module"` in package.json, imports need `.js` extensions in compiled output
- **Environment variables** — loaded from root `.env` by server; web uses `VITE_` prefixed vars in `apps/web/.env`

## Environment Setup

### Server (root `.env`)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key (powers research, scoring, outreach sub-agents) |
| `PIPEDRIVE_CLIENT_ID` | OAuth app client ID |
| `PIPEDRIVE_CLIENT_SECRET` | OAuth app client secret |
| `PIPEDRIVE_REDIRECT_URI` | OAuth callback URL (e.g. `https://pipeagent.xtian.me/auth/callback`) |
| `PG_HOST` | PostgreSQL host (Supabase pooler) |
| `PG_PORT` | PostgreSQL port (default: `5432`) |
| `PG_DATABASE` | Database name (default: `postgres`) |
| `PG_USER` | PostgreSQL user |
| `PG_PASSWORD` | PostgreSQL password |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend access) |
| `PUBLIC_SERVER_URL` | Server URL for external callbacks (e.g. `https://pipeagent.xtian.me`) |
| `WEB_URL` / `FRONTEND_URL` | Frontend URL for auth redirects |
| `WEBHOOK_URL` | Pipedrive webhook endpoint (e.g. `https://pipeagent.xtian.me/webhooks/pipedrive`) |
| `PORT` | Server port (default: `3001`) |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Set to `0` in production for Supabase pooler SSL compatibility |
| `JWT_SECRET` | Secret for signing JWT auth tokens (any random string) |
| `TAVILY_API_KEY` | Tavily API key for web search (optional, enhances research) |

### Web (`apps/web/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (realtime subscriptions) |
| `VITE_API_URL` | Backend API URL |

**Note:** Web env vars are baked into the build at compile time via Vite. The Dockerfile accepts `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build args.

## Deployment

Deployed on **Railway** with a single service:
- **Dockerfile:** `apps/server/Dockerfile` — multi-stage build (Node 20 Alpine + pnpm)
- **Domain:** `pipeagent.xtian.me` (custom domain via Cloudflare DNS)
- **SSL:** Cloudflare proxy with Full (strict) SSL mode
- **Port:** 3001 (exposed in Dockerfile)
- The server serves both the API and the built frontend static files in production
- `PG_*` env vars connect to Supabase PostgreSQL via connection pooler (not `DATABASE_URL`)
