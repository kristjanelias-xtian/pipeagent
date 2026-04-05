# PipeAgent

AI-powered agent hub for Pipedrive CRM. PipeAgent hosts a registry of specialized agents that automate different parts of your sales workflow. Currently ships with two active agents — **Lead Qualification** (auto-score leads against ICP criteria with outreach drafting) and **Deal Coach** (analyze deal health, surface risk signals, suggest next actions) — plus four simulated agents demonstrating the extensibility pattern.

## Architecture

```
┌──────────┐    webhook/manual     ┌──────────────────────────────────────────┐
│ Pipedrive├──────────────────────►│           Hono Server (port 3001)        │
│   CRM    │◄──────────────────────┤                                          │
└──────────┘  labels, notes, deals │  ┌────────────────────────────────────┐  │
                                   │  │  Lead Qualification (LangGraph)    │  │
┌──────────┐   realtime +          │  │  fetchContext → research → score   │  │
│ Supabase │◄─────────────────────►│  │  → writeBack → outreach → HITL    │  │
│ Postgres │   checkpointing       │  ├────────────────────────────────────┤  │
│ Realtime │                       │  │  Deal Coach (LangGraph)            │  │
└────┬─────┘                       │  │  fetchDeal → signals → score       │  │
     │                             │  │  → actions + chat                  │  │
     │ subscriptions               │  └────────────────────────────────────┘  │
     │                             │                                          │
     ▼                             │  Hub config, agent registry,             │
┌──────────┐    API calls          │  static file serving (production)        │
│  React   │◄──────────────────────└──────────────┬───────────────────────────┘
│ Hub UI   │   JWT auth                           │
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
| **Auth** | | |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| **Optional** | | |
| `TAVILY_API_KEY` | No | Tavily API key (enhances web search) |

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
│   ├── server/                     # Hono HTTP server + agent pipelines
│   │   ├── src/
│   │   │   ├── server.ts           # Entry point, route mounting, static serving
│   │   │   ├── middleware/         # JWT auth middleware
│   │   │   ├── agent/              # Lead Qualification agent
│   │   │   │   ├── graph.ts        # LangGraph StateGraph definition
│   │   │   │   ├── state.ts        # Agent state (Annotation system)
│   │   │   │   ├── checkpointer.ts # PostgreSQL checkpointer (PG_* env vars)
│   │   │   │   ├── logger.ts       # Activity logging to Supabase
│   │   │   │   ├── nodes/          # Graph node implementations
│   │   │   │   └── subagents/      # Research, scoring, outreach sub-agents
│   │   │   ├── agents/
│   │   │   │   └── deal-coach/     # Deal Coach agent (graph, nodes, state)
│   │   │   ├── pipedrive/
│   │   │   │   ├── client.ts       # Pipedrive API v1 wrapper
│   │   │   │   └── oauth.ts        # OAuth token exchange + refresh
│   │   │   ├── routes/             # auth, chat, leads, deals, settings, hub/agent config
│   │   │   ├── lib/                # Supabase client, connection helpers
│   │   │   ├── memory/             # Org research cache (7-day TTL)
│   │   │   └── seed/               # Test data generation
│   │   └── Dockerfile              # Multi-stage production build
│   │
│   └── web/                        # React 19 SPA (hub UI)
│       └── src/
│           ├── components/         # HubShell, TopBar, Sidebar
│           ├── pages/              # Home, Settings, BuildYourOwn, LoginPage
│           ├── agents/             # Per-agent workspaces + registry
│           │   ├── registry.ts     # Agent metadata registry
│           │   ├── lead-qualification/  # LeadsList, AgentInspector, ChatPanel
│           │   └── deal-coach/     # DealList, DealAnalysis, DealChat
│           ├── hooks/              # useConnection, useLeads, useDeals, useDealAnalysis
│           └── lib/                # API client, Supabase client
│
├── packages/
│   └── shared/                     # TypeScript types (CRM, agent state, DB rows)
│
├── supabase/
│   └── migrations/                 # 001-004: initial, profiles, followup, agent hub
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
3. Required scopes: `leads:full`, `deals:full`, `persons:full`, `organizations:full`, `activities:read`, `users:read`, `notes:full`
4. Copy Client ID and Client Secret to your environment variables
5. Once authenticated, the webhook for `lead.added` is registered automatically during the OAuth callback

## API Endpoints

All routes except `/auth` and `/webhooks` require JWT authentication (`Authorization: Bearer <token>`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| **Auth** | | |
| `GET` | `/auth/login` | Initiate Pipedrive OAuth |
| `GET` | `/auth/callback` | OAuth callback + webhook registration |
| `GET` | `/me` | Current user/connection info |
| `POST` | `/webhooks/pipedrive` | Pipedrive webhook handler (`lead.added`) |
| **Lead Qualification** | | |
| `POST` | `/chat/message` | Trigger agent run (skips if existing run) |
| `POST` | `/chat/run` | Force new agent run (requalify) |
| `POST` | `/chat/resume` | Resume paused run with HITL response |
| `GET` | `/chat/runs/:leadId` | List runs for a lead |
| `GET` | `/chat/logs/:runId` | Activity logs for a run |
| `GET` | `/leads` | Proxy to Pipedrive leads API |
| **Deal Coach** | | |
| `POST` | `/deals/:dealId/analyze` | Trigger deal analysis (background) |
| `GET` | `/deals/:dealId/analysis` | Get cached analysis |
| `POST` | `/deals/:dealId/chat` | Send coaching question |
| `GET` | `/deals/:dealId/chat` | Get chat history |
| `GET` | `/deals` | List deals from Pipedrive |
| **Configuration** | | |
| `GET/PUT` | `/settings` | Business profile (ICP criteria, outreach tone) |
| `GET/PUT` | `/hub-config` | Global context (shared across all agents) |
| `GET/PUT` | `/agent-config/:agentId` | Per-agent local context |
| `POST` | `/settings/register-webhook` | Manually register Pipedrive webhook |
| `POST` | `/seed/generate` | Generate test leads (1-10) |

## Further reading

Essays and docs in [`docs/`](./docs):

- **[Agents in the CRM](./docs/agents-in-the-crm.md)** — non-technical companion essay. What "agent" actually means in a CRM context, the six jobs in the registry, and an opinionated recommendation for which philosophy fits each job.
- **[Two ways to build agents that touch your CRM](./docs/two-ways-to-build-crm-agents.md)** — technical comparison between pipeagent (engineered LangGraph pipeline) and [digital-pd-team](https://github.com/kristjanelias-xtian/digital-pd-team) (embodied Claude Code bots in a Telegram group). Architectures, frameworks, state, and where authority over control flow lives.
- **[Architecture](./docs/architecture.md)** — deeper dive into the server + agent internals.
- **[Setup guide](./docs/setup-guide.md)** — extended setup walkthrough beyond the Quick Start above.
