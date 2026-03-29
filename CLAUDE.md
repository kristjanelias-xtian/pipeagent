# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PipeAgent is an AI-powered lead qualification agent for Pipedrive CRM. When a lead is added (via webhook or manual trigger), it runs a multi-step agentic workflow: fetch CRM context → research the company → score against ICP criteria → update lead label → draft personalized outreach email with human-in-the-loop review.

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
- `/auth` — Pipedrive OAuth flow (login → callback → /me)
- `/webhooks` — Pipedrive `lead.added` webhook handler
- `/chat` — Agent trigger/resume endpoints (/message, /run, /resume, /runs/:leadId, /logs/:runId)
- `/leads` — Proxy to Pipedrive leads API
- `/settings` — Business profile CRUD (ICP criteria, outreach tone)
- `/seed` — Test data generation

**Route behavior notes:**
- `POST /chat/message` — skips if an existing run (completed/paused/running) already exists for the lead; returns the existing run info instead
- `POST /chat/run` — always creates a new run (used for requalification)

### Agent Graph (`apps/server/src/agent/`)

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

### Web (`apps/web`)

React 19 + Vite + Tailwind CSS 4. Three-panel layout:

- **LeadsList** (left) — leads from Pipedrive with score badges
- **AgentInspector** (center) — realtime activity log viewer
- **ChatPanel** (right) — agent messages + action buttons
- **EmailDraftBar** (bottom) — email preview with send/edit/discard

Realtime updates via Supabase channel subscriptions (hooks in `src/hooks/`). API calls go through `lib/api.ts` which attaches `X-Connection-Id` header from localStorage.

### Shared (`packages/shared`)

TypeScript types only — CRM entities, agent state types, database row types. Referenced by both apps via project references.

### Pipedrive Integration (`apps/server/src/pipedrive/`)

- `client.ts` — API v1 wrapper (leads, persons, orgs, labels, notes, webhooks)
- `oauth.ts` — Token exchange and proactive refresh
- Tokens stored in `connections` table; `getClientForConnection()` refreshes before use

### Database (Supabase/PostgreSQL)

Migrations in `supabase/migrations/`:
- `001_initial.sql` — connections, agent_runs, activity_logs, org_memory, email_drafts
- `002_business_profiles.sql` — ICP settings per connection

Supabase Realtime enabled on: `activity_logs`, `agent_runs`, `email_drafts`

## Key Patterns

- **All routes require `X-Connection-Id` header** — connection ID is the auth boundary (no Supabase Auth)
- **Org memory caching** — research results cached 7 days in `org_memory` table to avoid redundant web searches
- **Conditional graph routing** — skips research if cache fresh, skips outreach if lead scored cold
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
