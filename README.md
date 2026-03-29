# PipeAgent

AI-powered lead qualification agent for Pipedrive CRM. When a lead is added — via webhook or manual trigger — PipeAgent runs a multi-step agentic workflow: fetches CRM context, researches the company via web search, scores against your ICP criteria, updates the lead label in Pipedrive, and drafts a personalized outreach email with human-in-the-loop review before sending.

## Architecture

```
┌──────────┐    webhook/manual     ┌──────────────────────────────────────────┐
│ Pipedrive├──────────────────────►│           Hono Server (port 3001)        │
│   CRM    │◄──────────────────────┤                                          │
└──────────┘   labels, notes       │  ┌────────────────────────────────────┐  │
                                   │  │     LangGraph Agent Pipeline       │  │
┌──────────┐   realtime +          │  │                                    │  │
│ Supabase │◄─────────────────────►│  │  fetchContext → checkMemory        │  │
│ Postgres │   checkpointing       │  │    → research → scoring            │  │
│ Realtime │                       │  │    → writeBack → outreach          │  │
└────┬─────┘                       │  │    → hitlReview → logActivity      │  │
     │                             │  └────────────────────────────────────┘  │
     │ subscriptions               │                                          │
     │                             │  Static file serving (production)        │
     ▼                             └──────────────┬───────────────────────────┘
┌──────────┐    API calls                         │
│  React   │◄─────────────────────────────────────┘
│ Frontend │   X-Connection-Id header
└──────────┘
```

## Tech Stack

- **Server:** [Hono](https://hono.dev) (Node.js HTTP framework)
- **Agent:** [LangGraph](https://langchain-ai.github.io/langgraphjs/) (state machine with PostgreSQL checkpointing)
- **AI:** [Claude API](https://docs.anthropic.com) via `@anthropic-ai/sdk` (research) and `@langchain/anthropic` (scoring, outreach)
- **Database:** [Supabase](https://supabase.com) (PostgreSQL + Realtime)
- **Frontend:** React 19, Vite 6, Tailwind CSS 4
- **CRM:** Pipedrive API v1 (OAuth 2.0)
- **Deployment:** Railway (Docker)

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- Supabase project (for PostgreSQL + Realtime)
- Pipedrive developer account (for Custom App / OAuth)
- Anthropic API key

### Setup

```bash
git clone <repo-url> && cd pipeagent
pnpm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# Create apps/web/.env
cat > apps/web/.env << 'EOF'
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_API_URL=http://localhost:3001
EOF

# Push database schema to Supabase
supabase db push

# Start development servers
pnpm dev
```

This starts the server on `http://localhost:3001` and the web app on `http://localhost:5173`.

### Generate Test Leads

```bash
pnpm seed
```

## Environment Variables

### Server (root `.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| **Anthropic** | | |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| **Pipedrive** | | |
| `PIPEDRIVE_CLIENT_ID` | Yes | OAuth app client ID |
| `PIPEDRIVE_CLIENT_SECRET` | Yes | OAuth app client secret |
| `PIPEDRIVE_REDIRECT_URI` | Yes | OAuth callback URL |
| **Supabase** | | |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (backend) |
| **PostgreSQL** (LangGraph checkpointer) | | |
| `PG_HOST` | Yes | PostgreSQL host (Supabase pooler) |
| `PG_PORT` | No | Port (default: `5432`) |
| `PG_DATABASE` | No | Database (default: `postgres`) |
| `PG_USER` | Yes | PostgreSQL user |
| `PG_PASSWORD` | Yes | PostgreSQL password |
| **URLs** | | |
| `PUBLIC_SERVER_URL` | Yes | Server URL for callbacks |
| `WEB_URL` | Yes | Frontend URL |
| `WEBHOOK_URL` | No | Pipedrive webhook endpoint |
| `FRONTEND_URL` | No | Alias for `WEB_URL` |
| `PORT` | No | Server port (default: `3001`) |
| `NODE_TLS_REJECT_UNAUTHORIZED` | No | Set to `0` for Supabase pooler SSL |

### Web (`apps/web/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_API_URL` | Yes | Backend API URL |

## Project Structure

```
pipeagent/
├── apps/
│   ├── server/                     # Hono HTTP server + LangGraph agent
│   │   ├── src/
│   │   │   ├── server.ts           # Entry point, route mounting, static serving
│   │   │   ├── agent/
│   │   │   │   ├── graph.ts        # LangGraph StateGraph definition
│   │   │   │   ├── state.ts        # Agent state (Annotation system)
│   │   │   │   ├── checkpointer.ts # PostgreSQL checkpointer (PG_* env vars)
│   │   │   │   ├── logger.ts       # Activity logging to Supabase
│   │   │   │   ├── nodes/          # Graph node implementations
│   │   │   │   └── subagents/      # Research, scoring, outreach sub-agents
│   │   │   ├── pipedrive/
│   │   │   │   ├── client.ts       # Pipedrive API v1 wrapper
│   │   │   │   └── oauth.ts        # OAuth token exchange + refresh
│   │   │   ├── routes/             # auth, chat, leads, settings, seed, webhooks
│   │   │   ├── lib/                # Supabase client, connection helpers
│   │   │   ├── memory/             # Org research cache (7-day TTL)
│   │   │   └── seed/               # Test data generation
│   │   └── Dockerfile              # Multi-stage production build
│   │
│   └── web/                        # React 19 SPA
│       └── src/
│           ├── components/         # LeadsList, AgentInspector, ChatPanel, etc.
│           ├── hooks/              # useConnection, useLeads, useSupabaseRealtime
│           └── lib/                # API client, Supabase client
│
├── packages/
│   └── shared/                     # TypeScript types (CRM, agent state, DB rows)
│
├── supabase/
│   └── migrations/                 # 001_initial.sql, 002_business_profiles.sql
│
├── .env.example
├── CLAUDE.md                       # AI coding assistant context
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Deployment (Railway)

1. Create a new Railway service pointing to this repo
2. Set **Dockerfile path** to `apps/server/Dockerfile`
3. Add all server environment variables from the table above
4. Add **build arguments** for the frontend:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Set custom domain (e.g. `pipeagent.xtian.me`)
6. If using Cloudflare DNS, set SSL mode to **Full (strict)**

The single Railway service serves both the API and the built frontend.

## Pipedrive Setup

1. Go to **Pipedrive Developer Hub** → Create a **Custom App**
2. Set OAuth redirect URI to `https://<your-domain>/auth/callback`
3. Required scopes: `leads:full`, `contacts:full`, `base` (at minimum)
4. Copy Client ID and Client Secret to your environment variables
5. Once authenticated, the webhook for `lead.added` is registered automatically during the OAuth callback

## API Endpoints

All routes except auth and webhooks require the `X-Connection-Id` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/auth/login` | Initiate Pipedrive OAuth |
| `GET` | `/auth/callback` | OAuth callback + webhook registration |
| `GET` | `/auth/me` | Current user info |
| `POST` | `/webhooks/pipedrive` | Pipedrive webhook handler (`lead.added`) |
| `POST` | `/chat/message` | Trigger agent run (skips if existing run) |
| `POST` | `/chat/run` | Force new agent run (requalify) |
| `POST` | `/chat/resume` | Resume paused run with HITL response |
| `GET` | `/chat/runs/:leadId` | List runs for a lead |
| `GET` | `/chat/logs/:runId` | Activity logs for a run |
| `GET` | `/leads` | Proxy to Pipedrive leads API |
| `GET` | `/settings` | Get business profile |
| `PUT` | `/settings` | Update business profile |
| `POST` | `/settings/register-webhook` | Manually register Pipedrive webhook |
| `POST` | `/seed/generate` | Generate test leads (1-10) |
