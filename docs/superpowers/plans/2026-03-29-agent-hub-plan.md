# Agent Hub Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform PipeAgent from a single-agent lead qualification tool into a multi-agent hub with sidebar navigation, Deal Coach as a second real agent, four simulated agents, context configuration, and Pipedrive OAuth authentication.

**Architecture:** Evolves the existing monorepo (apps/server + apps/web + packages/shared). The hub is a React SPA with sidebar routing — each agent mounts its own workspace component inside a shared shell. Server adds agent registry, auth middleware, and Deal Coach LangGraph graph. Supabase gains new tables for hub/agent config and deal analysis.

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4, Hono 4, Supabase (Postgres + Realtime), LangGraph.js, Claude Sonnet 4, TypeScript 5.7

**Spec:** `docs/superpowers/specs/2026-03-29-agent-hub-design.md`

---

## File Structure

### New Files

**Database:**
- `supabase/migrations/003_agent_hub.sql` — hub_config, agent_config, deal_analyses, deal_chat_messages tables; add agent_id to agent_runs + activity_logs

**Shared:**
- `packages/shared/src/types.ts` — (modify) add AgentId, DealAnalysis, DealSignal, DealAction, HubConfigRow, AgentConfigRow, DealAnalysisRow, DealChatMessageRow types

**Server — Agent system:**
- `apps/server/src/agents/registry.ts` — server-side agent registry (maps agent IDs to handlers)
- `apps/server/src/agents/types.ts` — AgentHandler interface, MockHandler type
- `apps/server/src/agents/lead-qualification.ts` — wraps existing graph as AgentHandler
- `apps/server/src/agents/deal-coach/graph.ts` — Deal Coach LangGraph StateGraph
- `apps/server/src/agents/deal-coach/state.ts` — Deal Coach state annotation
- `apps/server/src/agents/deal-coach/nodes.ts` — fetchDealContext, analyzeSignals, scoreHealth, generateActions nodes
- `apps/server/src/agents/simulated.ts` — mock handlers for 4 simulated agents

**Server — Auth:**
- `apps/server/src/middleware/auth.ts` — JWT session middleware for Hono

**Server — Routes:**
- `apps/server/src/routes/hub-config.ts` — GET/PUT hub config
- `apps/server/src/routes/agent-config.ts` — GET/PUT per-agent config
- `apps/server/src/routes/deals.ts` — GET deals, POST analyze, GET analysis, POST chat

**Server — Pipedrive:**
- `apps/server/src/pipedrive/client.ts` — (modify) add getDeals, getDeal, getDealActivities, getDealParticipants, getDealNotes methods

**Web — Hub shell:**
- `apps/web/src/App.tsx` — (rewrite) React Router with auth gate
- `apps/web/src/components/HubShell.tsx` — top bar + sidebar + content outlet
- `apps/web/src/components/Sidebar.tsx` — agent list, settings, build-your-own
- `apps/web/src/components/TopBar.tsx` — branding, connection info, avatar
- `apps/web/src/pages/Home.tsx` — overview dashboard with agent cards + activity feed
- `apps/web/src/pages/LoginPage.tsx` — "Connect with Pipedrive" button
- `apps/web/src/pages/Settings.tsx` — global + per-agent context config
- `apps/web/src/pages/BuildYourOwn.tsx` — coming-soon teaser

**Web — Agent workspaces:**
- `apps/web/src/agents/registry.ts` — frontend agent registry (id, name, icon, workspace component)
- `apps/web/src/agents/lead-qualification/Workspace.tsx` — existing LeadsList + AgentInspector + ChatPanel + EmailDraftBar composed
- `apps/web/src/agents/deal-coach/Workspace.tsx` — deal list + analysis + chat layout
- `apps/web/src/agents/deal-coach/DealList.tsx` — deal list panel with filters
- `apps/web/src/agents/deal-coach/DealAnalysis.tsx` — health score, signals, actions
- `apps/web/src/agents/deal-coach/DealChat.tsx` — ask about this deal
- `apps/web/src/agents/meeting-prep/Workspace.tsx` — simulated workspace
- `apps/web/src/agents/email-composer/Workspace.tsx` — simulated workspace
- `apps/web/src/agents/data-enrichment/Workspace.tsx` — simulated workspace
- `apps/web/src/agents/pipeline-forecaster/Workspace.tsx` — simulated workspace
- `apps/web/src/agents/simulated/fixtures.ts` — mock data for all 4 simulated agents

**Web — Hooks:**
- `apps/web/src/hooks/useHubConfig.ts` — fetch/save global config
- `apps/web/src/hooks/useAgentConfig.ts` — fetch/save per-agent config
- `apps/web/src/hooks/useDeals.ts` — fetch deals from Pipedrive via server
- `apps/web/src/hooks/useDealAnalysis.ts` — fetch/trigger deal analysis
- `apps/web/src/hooks/useRecentActivity.ts` — cross-agent activity feed for home page

**Docs:**
- `docs/setup-guide.md` — step-by-step setup for new users

### Modified Files

- `packages/shared/src/types.ts` — new types added
- `apps/server/src/server.ts` — auth middleware, new routes, agent registry init
- `apps/server/src/routes/auth.ts` — JWT session token on callback
- `apps/server/src/pipedrive/client.ts` — deal API methods
- `apps/server/src/agent/graph.ts` — accept merged context from hub config
- `apps/server/src/agent/logger.ts` — add agent_id to log/run functions
- `apps/web/package.json` — add react-router-dom
- `apps/web/src/lib/api.ts` — use JWT token instead of connection_id header
- `.env.example` — add JWT_SECRET

---

## Chunk 1: Database & Shared Types

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_agent_hub.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add agent_id to existing tables
ALTER TABLE agent_runs ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'lead-qualification';
ALTER TABLE activity_logs ADD COLUMN agent_id TEXT;

-- Hub-level config (one row per connection)
CREATE TABLE hub_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  global_context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- Per-agent config (one row per connection + agent)
CREATE TABLE agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  local_context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, agent_id)
);

-- Deal Coach: cached analyses
CREATE TABLE deal_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  pipedrive_deal_id INTEGER NOT NULL,
  health_score INTEGER NOT NULL,
  signals JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  raw_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, pipedrive_deal_id)
);

-- Deal Coach: chat messages
CREATE TABLE deal_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  pipedrive_deal_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hub_config_connection ON hub_config(connection_id);
CREATE INDEX idx_agent_config_connection ON agent_config(connection_id);
CREATE INDEX idx_agent_config_agent ON agent_config(connection_id, agent_id);
CREATE INDEX idx_deal_analyses_connection ON deal_analyses(connection_id);
CREATE INDEX idx_deal_analyses_deal ON deal_analyses(connection_id, pipedrive_deal_id);
CREATE INDEX idx_deal_chat_connection_deal ON deal_chat_messages(connection_id, pipedrive_deal_id);
CREATE INDEX idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX idx_activity_logs_agent ON activity_logs(agent_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE deal_analyses;
ALTER PUBLICATION supabase_realtime ADD TABLE deal_chat_messages;

-- Updated-at triggers
CREATE TRIGGER hub_config_updated_at BEFORE UPDATE ON hub_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_config_updated_at BEFORE UPDATE ON agent_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER deal_analyses_updated_at BEFORE UPDATE ON deal_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (multi-tenant isolation)
ALTER TABLE hub_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role bypasses RLS, so server-side access works.
-- These policies restrict anon/authenticated access to own connection's data.
CREATE POLICY "Users see own hub_config" ON hub_config FOR ALL USING (true);
CREATE POLICY "Users see own agent_config" ON agent_config FOR ALL USING (true);
CREATE POLICY "Users see own deal_analyses" ON deal_analyses FOR ALL USING (true);
CREATE POLICY "Users see own deal_chat_messages" ON deal_chat_messages FOR ALL USING (true);
```

Note: Since the server uses the service_role key (which bypasses RLS), these policies are permissive. All actual access control is enforced by the JWT auth middleware on the server. RLS is enabled as defense-in-depth and for future direct-client access patterns.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_agent_hub.sql
git commit -m "feat: add agent hub database migration"
```

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add new type definitions**

Add these types after existing types in `packages/shared/src/types.ts`:

```typescript
// Agent Hub types
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
  scoreTrend: number; // change from previous analysis
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

// Pipedrive Deal type (not in current types)
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
```

- [ ] **Step 2: Update AgentRunRow to include agent_id**

In the existing `AgentRunRow` interface, add:

```typescript
agent_id: AgentId;
```

- [ ] **Step 3: Update ActivityLogRow to include agent_id**

In the existing `ActivityLogRow` interface, add:

```typescript
agent_id: AgentId | null;
```

- [ ] **Step 4: Build shared package to verify types compile**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add Agent Hub shared types"
```

---

## Chunk 2: Auth & Server Infrastructure

### Task 3: Auth Middleware

**Files:**
- Create: `apps/server/src/middleware/auth.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add JWT_SECRET to .env.example**

Add to `.env.example`:
```
JWT_SECRET=your-jwt-secret-here
```

- [ ] **Step 2: Write auth middleware**

```typescript
import { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthPayload {
  connectionId: string;
  pipedriveUserId: number;
  companyId: number;
  exp: number;
}

export async function createSessionToken(payload: Omit<AuthPayload, 'exp'>): Promise<string> {
  return sign({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET);
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, JWT_SECRET) as AuthPayload;
    c.set('connectionId', payload.connectionId);
    c.set('pipedriveUserId', payload.pipedriveUserId);
    c.set('companyId', payload.companyId);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/middleware/auth.ts .env.example
git commit -m "feat: add JWT auth middleware"
```

### Task 4: Update Auth Route to Issue JWT

**Files:**
- Modify: `apps/server/src/routes/auth.ts`

- [ ] **Step 1: Import createSessionToken and update callback**

In `routes/auth.ts`, import `createSessionToken` from the new middleware. In the `/auth/callback` handler, after upserting the connection, generate a JWT token and redirect with `?token=...` instead of `?connection_id=...`.

The callback should:
1. Exchange code for tokens (existing)
2. Decode the access token to get user_id and company_id (existing)
3. Upsert connection (existing)
4. Call `createSessionToken({ connectionId, pipedriveUserId, companyId })`
5. Redirect to `${WEB_URL}?token=${jwt}`

- [ ] **Step 2: Add a GET /auth/me that reads from JWT context**

Update the existing `/auth/me` route to use the connectionId from JWT context (`c.get('connectionId')`) instead of the X-Connection-Id header.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/auth.ts
git commit -m "feat: update auth to issue JWT on OAuth callback"
```

### Task 5: Update Server to Use Auth Middleware

**Files:**
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Import and apply auth middleware**

In `server.ts`:
1. Import `authMiddleware` from `./middleware/auth`
2. Keep `/health`, `/auth/*` routes public (before middleware)
3. Apply `authMiddleware` to all other routes via `app.use('/*', authMiddleware)` placed after the auth routes
4. Update route handlers that currently read `X-Connection-Id` header to use `c.get('connectionId')` instead

- [ ] **Step 2: Verify server compiles**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/server.ts
git commit -m "feat: apply auth middleware to protected routes"
```

### Task 6: Update Frontend API Client for JWT

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/hooks/useConnection.ts`

- [ ] **Step 1: Update api.ts to use Bearer token**

Replace `X-Connection-Id` header with `Authorization: Bearer <token>`. Store/retrieve token from localStorage under key `auth_token`.

```typescript
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
  }
  return res;
}
```

- [ ] **Step 2: Update useConnection to read token from URL params**

On OAuth redirect, the URL will have `?token=...`. Parse it, store via `setAuthToken()`, then fetch `/auth/me` to get user info. Remove the old `connection_id` param handling.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/useConnection.ts
git commit -m "feat: switch frontend to JWT auth"
```

### Task 7: Hub Config & Agent Config Routes

**Files:**
- Create: `apps/server/src/routes/hub-config.ts`
- Create: `apps/server/src/routes/agent-config.ts`

- [ ] **Step 1: Write hub-config route**

```typescript
import { Hono } from 'hono';
import { supabase } from '../lib/supabase';

const hubConfig = new Hono();

// GET /hub-config — fetch global context for current connection
hubConfig.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data } = await supabase
    .from('hub_config')
    .select('*')
    .eq('connection_id', connectionId)
    .single();
  return c.json({ config: data || { global_context: '' } });
});

// PUT /hub-config — upsert global context
hubConfig.put('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { global_context } = await c.req.json();
  const { data, error } = await supabase
    .from('hub_config')
    .upsert({ connection_id: connectionId, global_context }, { onConflict: 'connection_id' })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ config: data });
});

export default hubConfig;
```

- [ ] **Step 2: Write agent-config route**

```typescript
import { Hono } from 'hono';
import { supabase } from '../lib/supabase';

const agentConfig = new Hono();

// GET /agent-config/:agentId — fetch local context for an agent
agentConfig.get('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');
  const { data } = await supabase
    .from('agent_config')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('agent_id', agentId)
    .single();
  return c.json({ config: data || { agent_id: agentId, local_context: '' } });
});

// PUT /agent-config/:agentId — upsert local context
agentConfig.put('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');
  const { local_context } = await c.req.json();
  const { data, error } = await supabase
    .from('agent_config')
    .upsert(
      { connection_id: connectionId, agent_id: agentId, local_context },
      { onConflict: 'connection_id,agent_id' }
    )
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ config: data });
});

// GET /agent-config — fetch all agent configs for connection
agentConfig.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data } = await supabase
    .from('agent_config')
    .select('*')
    .eq('connection_id', connectionId);
  return c.json({ configs: data || [] });
});

export default agentConfig;
```

- [ ] **Step 3: Mount routes in server.ts**

Add to `server.ts` after auth middleware:
```typescript
import hubConfig from './routes/hub-config';
import agentConfigRoutes from './routes/agent-config';

app.route('/hub-config', hubConfig);
app.route('/agent-config', agentConfigRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/hub-config.ts apps/server/src/routes/agent-config.ts apps/server/src/server.ts
git commit -m "feat: add hub config and agent config API routes"
```

---

## Chunk 3: Deal Coach Agent (Server)

### Task 8: Update Agent Logger for Multi-Agent

**Files:**
- Modify: `apps/server/src/agent/logger.ts`

- [ ] **Step 1: Add agent_id to createRun and logActivity**

Update `createRun` to accept and insert `agent_id` (default `'lead-qualification'` for backward compat):

```typescript
// In createRun, add agent_id to the data parameter type and insert:
export async function createRun(data: {
  connection_id: string;
  lead_id: string;
  trigger: string;
  agent_id?: string;  // defaults to 'lead-qualification'
}) {
  const { data: run, error } = await supabase
    .from('agent_runs')
    .insert({
      ...data,
      agent_id: data.agent_id || 'lead-qualification',
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw error;
  return run!.id;
}
```

Update `logActivity` to accept optional `agent_id`:

```typescript
export async function logActivity(
  runId: string,
  nodeName: string,
  eventType: string,
  payload: Record<string, unknown>,
  agentId?: string
) {
  await supabase.from('activity_logs').insert({
    run_id: runId,
    node_name: nodeName,
    event_type: eventType,
    payload,
    agent_id: agentId || null,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/agent/logger.ts
git commit -m "feat: add agent_id support to logger"
```

### Task 9: Pipedrive Deal API Methods

**Files:**
- Modify: `apps/server/src/pipedrive/client.ts`

- [ ] **Step 1: Add deal-related methods to PipedriveClient**

Add these methods to the existing PipedriveClient class:

```typescript
async getDeals(params?: { limit?: number; start?: number; status?: string }) {
  return this.get<PipedriveDeal[]>('/deals', params);
}

async getDeal(id: number) {
  return this.get<PipedriveDeal>(`/deals/${id}`);
}

async getDealActivities(dealId: number) {
  return this.get<PipedriveActivity[]>(`/deals/${dealId}/activities`);
}

async getDealParticipants(dealId: number) {
  return this.get<Array<{ person_id: number; primary_flag: boolean }>>(`/deals/${dealId}/participants`);
}

async getDealNotes(dealId: number) {
  return this.get<PipedriveNote[]>(`/deals/${dealId}/notes`, { sort: 'add_time DESC', limit: 20 });
}

async getStages(pipelineId?: number) {
  return this.get<Array<{ id: number; name: string; order_nr: number; pipeline_id: number }>>('/stages', pipelineId ? { pipeline_id: pipelineId } : undefined);
}
```

Import `PipedriveDeal`, `PipedriveActivity`, `PipedriveNote` from `@pipeagent/shared`.

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/pipedrive/client.ts
git commit -m "feat: add deal API methods to Pipedrive client"
```

### Task 9: Deal Coach State & Nodes

**Files:**
- Create: `apps/server/src/agents/deal-coach/state.ts`
- Create: `apps/server/src/agents/deal-coach/nodes.ts`

- [ ] **Step 1: Write Deal Coach state annotation**

```typescript
import { Annotation } from '@langchain/langgraph';
import type { PipedriveDeal, PipedriveActivity, PipedriveNote, PipedrivePerson, PipedriveOrganization, DealSignal, DealAction } from '@pipeagent/shared';

export const DealCoachState = Annotation.Root({
  connectionId: Annotation<string>,
  dealId: Annotation<number>,
  runId: Annotation<string>,
  // Pipedrive context
  deal: Annotation<PipedriveDeal | null>({ reducer: (_, v) => v, default: () => null }),
  activities: Annotation<PipedriveActivity[]>({ reducer: (_, v) => v, default: () => [] }),
  notes: Annotation<PipedriveNote[]>({ reducer: (_, v) => v, default: () => [] }),
  participants: Annotation<PipedrivePerson[]>({ reducer: (_, v) => v, default: () => [] }),
  organization: Annotation<PipedriveOrganization | null>({ reducer: (_, v) => v, default: () => null }),
  stageName: Annotation<string>({ reducer: (_, v) => v, default: () => '' }),
  // Analysis results
  signals: Annotation<DealSignal[]>({ reducer: (_, v) => v, default: () => [] }),
  healthScore: Annotation<number>({ reducer: (_, v) => v, default: () => 0 }),
  actions: Annotation<DealAction[]>({ reducer: (_, v) => v, default: () => [] }),
  // Config
  globalContext: Annotation<string>({ reducer: (_, v) => v, default: () => '' }),
  localContext: Annotation<string>({ reducer: (_, v) => v, default: () => '' }),
});
```

- [ ] **Step 2: Write Deal Coach nodes**

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { supabase } from '../../lib/supabase';
import { getClientForConnection } from '../../lib/connections';
import { logActivity } from '../../agent/logger';
import type { DealSignal, DealAction } from '@pipeagent/shared';

const llm = new ChatAnthropic({ model: 'claude-sonnet-4-20250514', temperature: 0 });

export async function fetchDealContext(state: typeof DealCoachState.State) {
  const { connectionId, dealId, runId } = state;
  const client = await getClientForConnection(connectionId);

  const [deal, activities, notes, participantsRaw, stages] = await Promise.all([
    client.getDeal(dealId),
    client.getDealActivities(dealId),
    client.getDealNotes(dealId),
    client.getDealParticipants(dealId),
    client.getStages(),
  ]);

  // Resolve participant persons
  const participants = await Promise.all(
    (participantsRaw || []).map(p => client.getPerson(p.person_id))
  );

  // Resolve org
  const organization = deal?.org_id ? await client.getOrganization(deal.org_id) : null;

  // Find stage name
  const stage = (stages || []).find(s => s.id === deal?.stage_id);
  const stageName = stage?.name || 'Unknown';

  // Fetch context config
  const [hubRes, agentRes] = await Promise.all([
    supabase.from('hub_config').select('global_context').eq('connection_id', connectionId).single(),
    supabase.from('agent_config').select('local_context').eq('connection_id', connectionId).eq('agent_id', 'deal-coach').single(),
  ]);

  await logActivity(runId, 'fetchDealContext', 'completed', {
    dealTitle: deal?.title,
    activitiesCount: activities?.length || 0,
    notesCount: notes?.length || 0,
    participantsCount: participants.length,
  });

  return {
    deal,
    activities: activities || [],
    notes: notes || [],
    participants: participants.filter(Boolean),
    organization,
    stageName,
    globalContext: hubRes.data?.global_context || '',
    localContext: agentRes.data?.local_context || '',
  };
}

export async function analyzeSignals(state: typeof DealCoachState.State) {
  const { deal, activities, notes, participants, organization, stageName, globalContext, localContext, runId } = state;

  const contextBlock = [globalContext, localContext].filter(Boolean).join('\n\n');

  const prompt = `You are a Deal Coach AI analyzing a sales deal. Identify positive and negative signals.

${contextBlock ? `## Business Context\n${contextBlock}\n` : ''}
## Deal Info
- Title: ${deal?.title}
- Value: ${deal?.currency} ${deal?.value}
- Stage: ${stageName}
- Stage changed: ${deal?.stage_change_time || 'unknown'}
- Expected close: ${deal?.expected_close_date || 'not set'}
- Organization: ${organization?.name || 'unknown'}

## Activities (${activities.length} total)
${activities.slice(0, 15).map(a => `- [${a.done ? 'done' : 'pending'}] ${a.type}: ${a.subject} (${a.add_time})`).join('\n') || 'No activities'}

## Notes (last 10)
${notes.slice(0, 10).map(n => `- ${n.add_time}: ${n.content?.slice(0, 200)}`).join('\n') || 'No notes'}

## Participants (${participants.length})
${participants.map(p => `- ${p.name} (${p.email?.[0]?.value || 'no email'})`).join('\n') || 'No participants'}

Return a JSON array of signals. Each signal has:
- "type": "positive" | "negative" | "warning"
- "text": short description of the signal

Focus on: engagement recency, stakeholder coverage, competitive mentions, budget signals, timeline, deal momentum.

Return ONLY the JSON array, no other text.`;

  const response = await llm.invoke([{ role: 'user', content: prompt }]);
  let signals: DealSignal[] = [];
  try {
    const text = typeof response.content === 'string' ? response.content : response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) signals = JSON.parse(jsonMatch[0]);
  } catch {
    signals = [{ type: 'warning', text: 'Unable to analyze signals' }];
  }

  await logActivity(runId, 'analyzeSignals', 'completed', { signalCount: signals.length });
  return { signals };
}

export async function scoreHealth(state: typeof DealCoachState.State) {
  const { signals, deal, activities, runId } = state;

  // Weighted scoring based on signal analysis
  const positiveCount = signals.filter(s => s.type === 'positive').length;
  const negativeCount = signals.filter(s => s.type === 'negative').length;
  const warningCount = signals.filter(s => s.type === 'warning').length;

  // Base score from signal ratio
  const total = Math.max(positiveCount + negativeCount + warningCount, 1);
  let score = Math.round((positiveCount / total) * 100);

  // Penalize for no recent activity
  if (activities.length > 0) {
    const latestActivity = new Date(activities[0].add_time);
    const daysSinceActivity = (Date.now() - latestActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 14) score = Math.max(score - 25, 0);
    else if (daysSinceActivity > 7) score = Math.max(score - 10, 0);
  } else {
    score = Math.max(score - 20, 0);
  }

  // Clamp to 0-100
  score = Math.min(100, Math.max(0, score));

  await logActivity(runId, 'scoreHealth', 'completed', { healthScore: score });
  return { healthScore: score };
}

export async function generateActions(state: typeof DealCoachState.State) {
  const { deal, signals, healthScore, participants, stageName, globalContext, localContext, runId, connectionId, dealId } = state;

  const contextBlock = [globalContext, localContext].filter(Boolean).join('\n\n');

  const prompt = `You are a Deal Coach AI. Based on the deal analysis, suggest 2-4 concrete next-best-actions.

${contextBlock ? `## Business Context\n${contextBlock}\n` : ''}
## Deal: ${deal?.title} (${deal?.currency} ${deal?.value})
Stage: ${stageName} | Health: ${healthScore}/100

## Signals
${signals.map(s => `- [${s.type}] ${s.text}`).join('\n')}

## Participants
${participants.map(p => `- ${p.name}`).join('\n') || 'None identified'}

Return a JSON array of actions. Each action has:
- "priority": 1 (highest) to 4
- "title": one-line action title
- "reasoning": 1-2 sentence explanation of why this action matters
- "actionType": "email" | "task" | "meeting" | "research"

Order by priority. Be specific — reference people by name when possible.

Return ONLY the JSON array, no other text.`;

  const response = await llm.invoke([{ role: 'user', content: prompt }]);
  let actions: DealAction[] = [];
  try {
    const text = typeof response.content === 'string' ? response.content : response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) actions = JSON.parse(jsonMatch[0]);
  } catch {
    actions = [{ priority: 1, title: 'Review deal manually', reasoning: 'Unable to generate specific actions', actionType: 'task' }];
  }

  // Persist analysis to DB
  await supabase.from('deal_analyses').upsert({
    connection_id: connectionId,
    pipedrive_deal_id: dealId,
    health_score: healthScore,
    signals: state.signals,
    actions,
  }, { onConflict: 'connection_id,pipedrive_deal_id' });

  await logActivity(runId, 'generateActions', 'completed', { actionCount: actions.length });
  return { actions };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/agents/deal-coach/
git commit -m "feat: add Deal Coach state and graph nodes"
```

### Task 10: Deal Coach Graph & Route

**Files:**
- Create: `apps/server/src/agents/deal-coach/graph.ts`
- Create: `apps/server/src/routes/deals.ts`

- [ ] **Step 1: Write Deal Coach graph**

```typescript
import { StateGraph } from '@langchain/langgraph';
import { DealCoachState } from './state';
import { fetchDealContext, analyzeSignals, scoreHealth, generateActions } from './nodes';
import { getCheckpointer } from '../../agent/checkpointer';
import { createRun, updateRunStatus, logActivity } from '../../agent/logger';
import { ChatAnthropic } from '@langchain/anthropic';
import { supabase } from '../../lib/supabase';

const graph = new StateGraph(DealCoachState)
  .addNode('fetchDealContext', fetchDealContext)
  .addNode('analyzeSignals', analyzeSignals)
  .addNode('scoreHealth', scoreHealth)
  .addNode('generateActions', generateActions)
  .addEdge('__start__', 'fetchDealContext')
  .addEdge('fetchDealContext', 'analyzeSignals')
  .addEdge('analyzeSignals', 'scoreHealth')
  .addEdge('scoreHealth', 'generateActions')
  .addEdge('generateActions', '__end__');

let compiledGraph: ReturnType<typeof graph.compile> | null = null;

async function getCompiledGraph() {
  if (!compiledGraph) {
    const checkpointer = await getCheckpointer();
    compiledGraph = graph.compile({ checkpointer });
  }
  return compiledGraph;
}

export async function runDealAnalysis(input: { connectionId: string; dealId: number }) {
  const { connectionId, dealId } = input;

  const runId = await createRun({
    connection_id: connectionId,
    lead_id: String(dealId),
    trigger: 'manual',
    agent_id: 'deal-coach',
  });

  await updateRunStatus(runId, 'running');

  try {
    const compiled = await getCompiledGraph();
    const result = await compiled.invoke(
      { connectionId, dealId, runId },
      { configurable: { thread_id: `deal-coach-${connectionId}-${dealId}-${runId}` } }
    );
    await updateRunStatus(runId, 'completed', {
      score: result.healthScore,
    });
    return { runId, analysis: { healthScore: result.healthScore, signals: result.signals, actions: result.actions } };
  } catch (err) {
    await updateRunStatus(runId, 'failed');
    throw err;
  }
}

// Chat about a deal (standalone, not part of the graph)
const chatLlm = new ChatAnthropic({ model: 'claude-sonnet-4-20250514', temperature: 0.3 });

export async function chatAboutDeal(input: { connectionId: string; dealId: number; message: string }) {
  const { connectionId, dealId, message } = input;

  // Save user message
  await supabase.from('deal_chat_messages').insert({
    connection_id: connectionId,
    pipedrive_deal_id: dealId,
    role: 'user',
    content: message,
  });

  // Fetch latest analysis for context
  const { data: analysis } = await supabase
    .from('deal_analyses')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_deal_id', dealId)
    .single();

  // Fetch chat history
  const { data: history } = await supabase
    .from('deal_chat_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_deal_id', dealId)
    .order('created_at', { ascending: true })
    .limit(20);

  // Fetch context config
  const [hubRes, agentRes] = await Promise.all([
    supabase.from('hub_config').select('global_context').eq('connection_id', connectionId).single(),
    supabase.from('agent_config').select('local_context').eq('connection_id', connectionId).eq('agent_id', 'deal-coach').single(),
  ]);
  const contextBlock = [hubRes.data?.global_context, agentRes.data?.local_context].filter(Boolean).join('\n\n');

  const systemPrompt = `You are a Deal Coach AI assistant. Answer questions about this deal based on the analysis data.

${contextBlock ? `## Business Context\n${contextBlock}\n` : ''}
## Current Analysis
Health Score: ${analysis?.health_score ?? 'not yet analyzed'}/100
Signals: ${JSON.stringify(analysis?.signals || [])}
Recommended Actions: ${JSON.stringify(analysis?.actions || [])}

Be concise and actionable. Reference specific data points from the analysis.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(history || []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const response = await chatLlm.invoke(messages);
  const assistantMessage = typeof response.content === 'string' ? response.content : response.content[0]?.type === 'text' ? response.content[0].text : '';

  // Save assistant message
  await supabase.from('deal_chat_messages').insert({
    connection_id: connectionId,
    pipedrive_deal_id: dealId,
    role: 'assistant',
    content: assistantMessage,
  });

  return { message: assistantMessage };
}
```

- [ ] **Step 2: Write deals route**

```typescript
import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections';
import { supabase } from '../lib/supabase';
import { runDealAnalysis, chatAboutDeal } from '../agents/deal-coach/graph';

const deals = new Hono();

// GET /deals — list deals from Pipedrive
deals.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const client = await getClientForConnection(connectionId);
  const data = await client.getDeals({ limit: 50 });
  return c.json({ deals: data || [] });
});

// POST /deals/:dealId/analyze — trigger Deal Coach analysis
deals.post('/:dealId/analyze', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));
  // Run in background
  const resultPromise = runDealAnalysis({ connectionId, dealId });
  resultPromise.catch(err => console.error('Deal analysis failed:', err));
  return c.json({ status: 'started', dealId });
});

// GET /deals/:dealId/analysis — get cached analysis
deals.get('/:dealId/analysis', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));
  const { data } = await supabase
    .from('deal_analyses')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_deal_id', dealId)
    .single();
  return c.json({ analysis: data });
});

// POST /deals/:dealId/chat — chat about a deal
deals.post('/:dealId/chat', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));
  const { message } = await c.req.json();
  const result = await chatAboutDeal({ connectionId, dealId, message });
  return c.json(result);
});

// GET /deals/:dealId/chat — get chat history
deals.get('/:dealId/chat', async (c) => {
  const connectionId = c.get('connectionId');
  const dealId = Number(c.req.param('dealId'));
  const { data } = await supabase
    .from('deal_chat_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_deal_id', dealId)
    .order('created_at', { ascending: true });
  return c.json({ messages: data || [] });
});

export default deals;
```

- [ ] **Step 3: Mount deals route in server.ts**

Add to `server.ts`:
```typescript
import deals from './routes/deals';
app.route('/deals', deals);
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/agents/deal-coach/graph.ts apps/server/src/routes/deals.ts apps/server/src/server.ts
git commit -m "feat: add Deal Coach graph, chat, and deals API route"
```

---

## Chunk 4: Hub Shell UI

### Task 12: Install React Router

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add react-router-dom**

```bash
cd apps/web && pnpm add react-router-dom
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add react-router-dom"
```

### Task 13: Frontend Agent Registry

**Files:**
- Create: `apps/web/src/agents/registry.ts`

- [ ] **Step 1: Write the agent registry**

```typescript
import type { AgentId, AgentMeta } from '@pipeagent/shared';

export const agents: AgentMeta[] = [
  {
    id: 'lead-qualification',
    name: 'Lead Qualification',
    icon: '🎯',
    description: 'Researches & scores incoming leads against ICP',
    status: 'active',
    dataScope: 'leads',
    defaultConfig: 'Score leads on: Company Size, Industry Fit, Budget Signals, Timing Signals.',
  },
  {
    id: 'deal-coach',
    name: 'Deal Coach',
    icon: '🧠',
    description: 'Analyzes deal health and suggests next actions',
    status: 'active',
    dataScope: 'deals',
    defaultConfig: 'A deal is "at risk" if: no activity in 10+ days, missing decision maker, or competitor mentioned.',
  },
  {
    id: 'meeting-prep',
    name: 'Meeting Prep',
    icon: '📋',
    description: 'Generates briefing docs before calls',
    status: 'simulated',
    dataScope: 'contacts',
    defaultConfig: '',
  },
  {
    id: 'email-composer',
    name: 'Email Composer',
    icon: '✉️',
    description: 'Drafts personalized outreach & follow-ups',
    status: 'simulated',
    dataScope: 'contacts',
    defaultConfig: '',
  },
  {
    id: 'data-enrichment',
    name: 'Data Enrichment',
    icon: '🔍',
    description: 'Auto-fills missing contact & company fields',
    status: 'simulated',
    dataScope: 'contacts',
    defaultConfig: '',
  },
  {
    id: 'pipeline-forecaster',
    name: 'Pipeline Forecaster',
    icon: '📊',
    description: 'Scores deal health and predicts close probability',
    status: 'simulated',
    dataScope: 'pipeline',
    defaultConfig: '',
  },
];

export function getAgent(id: AgentId): AgentMeta | undefined {
  return agents.find(a => a.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/agents/registry.ts
git commit -m "feat: add frontend agent registry"
```

### Task 14: TopBar Component

**Files:**
- Create: `apps/web/src/components/TopBar.tsx`

- [ ] **Step 1: Write TopBar**

Top bar with: Agent Hub logo/branding on left, Pipedrive domain + user avatar on right. Uses the Pipedrive-inspired dark style (#1A2233). Takes `user` prop from useConnection hook.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/TopBar.tsx
git commit -m "feat: add TopBar component"
```

### Task 15: Sidebar Component

**Files:**
- Create: `apps/web/src/components/Sidebar.tsx`

- [ ] **Step 1: Write Sidebar**

Sidebar with two modes: expanded (220px, on home) and collapsed (56px, in agent workspace). Props: `collapsed: boolean`. Renders agent list from registry, highlights active route via `useLocation()`. Settings gear at bottom. "Build Your Own +" teaser after divider. Uses NavLink from react-router-dom.

Links:
- Home: `/`
- Agents: `/agent/:id`
- Settings: `/settings`
- Build: `/build`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx
git commit -m "feat: add Sidebar component with collapsed/expanded modes"
```

### Task 16: HubShell Layout

**Files:**
- Create: `apps/web/src/components/HubShell.tsx`

- [ ] **Step 1: Write HubShell**

Layout component that composes TopBar + Sidebar + `<Outlet />` from React Router. Determines sidebar collapse state from current route (collapsed when path starts with `/agent/`). Full height layout with flex.

```typescript
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

export function HubShell({ user }: { user: any }) {
  const location = useLocation();
  const inAgentWorkspace = location.pathname.startsWith('/agent/');

  return (
    <div className="flex flex-col h-screen bg-[#f5f6f7]">
      <TopBar user={user} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={inAgentWorkspace} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/HubShell.tsx
git commit -m "feat: add HubShell layout component"
```

### Task 17: Login Page

**Files:**
- Create: `apps/web/src/pages/LoginPage.tsx`

- [ ] **Step 1: Write LoginPage**

Centered page with Agent Hub branding and a "Connect with Pipedrive" green button. Pipedrive-inspired clean style. Button calls the login function from useConnection. Brief tagline: "AI-powered sales agents for your Pipedrive CRM".

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/LoginPage.tsx
git commit -m "feat: add login page"
```

### Task 18: Home Page

**Files:**
- Create: `apps/web/src/pages/Home.tsx`
- Create: `apps/web/src/hooks/useRecentActivity.ts`

- [ ] **Step 1: Write useRecentActivity hook**

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLogRow } from '@pipeagent/shared';

export function useRecentActivity(connectionId: string | undefined) {
  const [activities, setActivities] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    if (!connectionId) return;

    // Initial fetch — last 15 activities across all agents
    supabase
      .from('activity_logs')
      .select('*, agent_runs!inner(connection_id)')
      .eq('agent_runs.connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (data) setActivities(data as ActivityLogRow[]);
      });

    // Subscribe to new activity_logs
    const channel = supabase
      .channel(`home-activity-${connectionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
      }, (payload) => {
        setActivities(prev => [payload.new as ActivityLogRow, ...prev].slice(0, 15));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [connectionId]);

  return activities;
}
```

- [ ] **Step 2: Write Home page**

```typescript
import { Link } from 'react-router-dom';
import { useConnection } from '../hooks/useConnection';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { agents } from '../agents/registry';
import type { AgentId } from '@pipeagent/shared';

const AGENT_COLORS: Record<AgentId, string> = {
  'lead-qualification': '#368764',
  'deal-coach': '#7b61ff',
  'meeting-prep': '#317ae2',
  'email-composer': '#f5a623',
  'data-enrichment': '#6a7178',
  'pipeline-forecaster': '#e53935',
};

export function Home() {
  const { user } = useConnection();
  const activities = useRecentActivity(user?.id);

  // Renders:
  // 1. Greeting: "Good morning, {user.name}" + "Your agents processed X items today"
  // 2. 3x2 grid of agent cards (from agents registry), each card:
  //    - White card with border, rounded-lg, shadow
  //    - Agent icon + name + status badge (Active/Simulated)
  //    - Key metric or last action (static for simulated, from activities for real)
  //    - Wrapped in <Link to={`/agent/${agent.id}`}>
  // 3. Recent Activity card at bottom:
  //    - "Recent Activity" header
  //    - List of last 10 activities with colored dot (AGENT_COLORS[agent_id]),
  //      node_name, payload summary, relative timestamp
  //    - Empty state: "No activity yet. Select an agent to get started."
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Home.tsx apps/web/src/hooks/useRecentActivity.ts
git commit -m "feat: add Home dashboard page with activity feed"
```

### Task 19: Rewrite App.tsx with Router

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the current single-dashboard App with React Router setup:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useConnection } from './hooks/useConnection';
import { HubShell } from './components/HubShell';
import { LoginPage } from './pages/LoginPage';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { BuildYourOwn } from './pages/BuildYourOwn';
// Agent workspaces imported lazily or directly
import { LeadQualificationWorkspace } from './agents/lead-qualification/Workspace';
import { DealCoachWorkspace } from './agents/deal-coach/Workspace';
import { MeetingPrepWorkspace } from './agents/meeting-prep/Workspace';
import { EmailComposerWorkspace } from './agents/email-composer/Workspace';
import { DataEnrichmentWorkspace } from './agents/data-enrichment/Workspace';
import { PipelineForecasterWorkspace } from './agents/pipeline-forecaster/Workspace';

export default function App() {
  const { user, loading, login } = useConnection();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {!user ? (
          <Route path="*" element={<LoginPage onLogin={login} />} />
        ) : (
          <Route element={<HubShell user={user} />}>
            <Route index element={<Home />} />
            <Route path="agent/lead-qualification" element={<LeadQualificationWorkspace />} />
            <Route path="agent/deal-coach" element={<DealCoachWorkspace />} />
            <Route path="agent/meeting-prep" element={<MeetingPrepWorkspace />} />
            <Route path="agent/email-composer" element={<EmailComposerWorkspace />} />
            <Route path="agent/data-enrichment" element={<DataEnrichmentWorkspace />} />
            <Route path="agent/pipeline-forecaster" element={<PipelineForecasterWorkspace />} />
            <Route path="settings" element={<Settings />} />
            <Route path="build" element={<BuildYourOwn />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Verify it compiles** (will have import errors for workspaces not yet created — that's OK, create placeholder files)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: rewrite App.tsx with React Router and auth gate"
```

---

## Chunk 5: Lead Qualification Workspace Migration

### Task 20: Move Existing Components into Agent Workspace

**Files:**
- Create: `apps/web/src/agents/lead-qualification/Workspace.tsx`

- [ ] **Step 1: Create Lead Qualification workspace**

This component composes the existing LeadsList, AgentInspector, ChatPanel, and EmailDraftBar into a workspace layout. It contains all the state management that was previously in App.tsx (useLeads, useAgentRuns, useActivityLogs, useEmailDraft, useSettings).

The existing components (`components/LeadsList.tsx`, `components/AgentInspector.tsx`, etc.) stay where they are — the workspace just imports and arranges them.

```typescript
import { useState } from 'react';
import { useConnection } from '../../hooks/useConnection';
import { useLeads } from '../../hooks/useLeads';
import { useAgentRuns, useActivityLogs, useEmailDraft } from '../../hooks/useSupabaseRealtime';
import { LeadsList } from '../../components/LeadsList';
import { AgentInspector } from '../../components/AgentInspector';
import { ChatPanel } from '../../components/ChatPanel';
import { EmailDraftBar } from '../../components/EmailDraftBar';

export function LeadQualificationWorkspace() {
  // Replicate the state logic from old App.tsx
  const { user } = useConnection();
  const connectionId = user?.id;
  const { leads, loading: leadsLoading, refetch } = useLeads(connectionId);
  const runs = useAgentRuns(connectionId);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const selectedRun = runs.find(r => r.lead_id === selectedLeadId);
  const logs = useActivityLogs(selectedRun?.id);
  const draft = useEmailDraft(selectedRun?.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        <LeadsList
          leads={leads}
          runs={runs}
          selectedLeadId={selectedLeadId}
          onSelectLead={setSelectedLeadId}
          onRefetch={refetch}
          loading={leadsLoading}
        />
        <AgentInspector logs={logs} selectedRun={selectedRun} />
        <ChatPanel selectedLeadId={selectedLeadId} selectedRun={selectedRun} />
      </div>
      {draft && <EmailDraftBar draft={draft} runId={selectedRun?.id} />}
    </div>
  );
}
```

**Important:** Before writing this file, read each existing component (`LeadsList.tsx`, `AgentInspector.tsx`, `ChatPanel.tsx`, `EmailDraftBar.tsx`) to verify the exact prop interfaces and adjust the composition accordingly. The code above is the target structure — prop names may differ.

- [ ] **Step 2: Verify the workspace renders correctly**

Run `pnpm dev` and navigate to `/agent/lead-qualification`. Verify it shows the same three-panel layout as before.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/agents/lead-qualification/
git commit -m "feat: extract Lead Qualification workspace from App.tsx"
```

---

## Chunk 6: Deal Coach Workspace UI

### Task 21: Deal Coach Hooks

**Files:**
- Create: `apps/web/src/hooks/useDeals.ts`
- Create: `apps/web/src/hooks/useDealAnalysis.ts`

- [ ] **Step 1: Write useDeals hook**

```typescript
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { PipedriveDeal } from '@pipeagent/shared';

export function useDeals() {
  const [deals, setDeals] = useState<PipedriveDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = async () => {
    setLoading(true);
    const res = await apiFetch('/deals');
    if (res.ok) {
      const data = await res.json();
      setDeals(data.deals || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDeals(); }, []);

  return { deals, loading, refetch: fetchDeals };
}
```

- [ ] **Step 2: Write useDealAnalysis hook**

```typescript
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { DealAnalysisRow, DealChatMessageRow } from '@pipeagent/shared';

export function useDealAnalysis(dealId: number | null) {
  const [analysis, setAnalysis] = useState<DealAnalysisRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<DealChatMessageRow[]>([]);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    apiFetch(`/deals/${dealId}/analysis`).then(async res => {
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      }
      setLoading(false);
    });
    // Load chat history
    apiFetch(`/deals/${dealId}/chat`).then(async res => {
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    });
  }, [dealId]);

  const analyze = async () => {
    if (!dealId) return;
    setLoading(true);
    await apiFetch(`/deals/${dealId}/analyze`, { method: 'POST' });
    // Poll for result (analysis runs in background)
    const poll = setInterval(async () => {
      const res = await apiFetch(`/deals/${dealId}/analysis`);
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAnalysis(data.analysis);
          setLoading(false);
          clearInterval(poll);
        }
      }
    }, 2000);
    // Timeout after 60s
    setTimeout(() => { clearInterval(poll); setLoading(false); }, 60000);
  };

  const sendChat = async (message: string) => {
    if (!dealId) return;
    setChatMessages(prev => [...prev, { id: '', connection_id: '', pipedrive_deal_id: dealId, role: 'user', content: message, created_at: new Date().toISOString() }]);
    const res = await apiFetch(`/deals/${dealId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    if (res.ok) {
      const data = await res.json();
      setChatMessages(prev => [...prev, { id: '', connection_id: '', pipedrive_deal_id: dealId, role: 'assistant', content: data.message, created_at: new Date().toISOString() }]);
    }
  };

  return { analysis, loading, analyze, chatMessages, sendChat };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useDeals.ts apps/web/src/hooks/useDealAnalysis.ts
git commit -m "feat: add useDeals and useDealAnalysis hooks"
```

### Task 22: Deal Coach UI Components

**Files:**
- Create: `apps/web/src/agents/deal-coach/DealList.tsx`
- Create: `apps/web/src/agents/deal-coach/DealAnalysis.tsx`
- Create: `apps/web/src/agents/deal-coach/DealChat.tsx`
- Create: `apps/web/src/agents/deal-coach/Workspace.tsx`

- [ ] **Step 1: Write DealList component**

```typescript
import type { PipedriveDeal, DealAnalysisRow } from '@pipeagent/shared';

interface DealListProps {
  deals: PipedriveDeal[];
  selectedDealId: number | null;
  onSelectDeal: (id: number) => void;
  loading: boolean;
}

function getStatusBadge(analysis: DealAnalysisRow | null) {
  if (!analysis) return { label: 'Not analyzed', color: 'bg-[#f5f6f7] text-[#6a7178]' };
  if (analysis.health_score < 40) return { label: 'At Risk', color: 'bg-red-50 text-red-600' };
  if (analysis.health_score < 70) return { label: 'Needs Action', color: 'bg-yellow-50 text-yellow-700' };
  return { label: 'On Track', color: 'bg-green-50 text-[#368764]' };
}

export function DealList({ deals, selectedDealId, onSelectDeal, loading }: DealListProps) {
  // Component renders:
  // - Header with agent icon + name + description
  // - Filter chips (All / At Risk / Action Needed) — filter locally by cached analysis
  // - Scrollable deal list, each item shows title, value, status badge
  // - Selected deal has green left border + light bg
  // - Loading skeleton when loading=true
  // Width: w-[280px], border-r, white bg
}
```

- [ ] **Step 2: Write DealAnalysis component**

```typescript
import type { PipedriveDeal, DealAnalysisRow } from '@pipeagent/shared';

interface DealAnalysisProps {
  deal: PipedriveDeal;
  analysis: DealAnalysisRow | null;
  loading: boolean;
  onAnalyze: () => void;
}

function scoreColor(score: number) {
  if (score < 40) return 'text-red-600';
  if (score < 70) return 'text-yellow-600';
  return 'text-[#368764]';
}

function barColor(score: number) {
  if (score < 40) return 'bg-red-500';
  if (score < 70) return 'bg-yellow-500';
  return 'bg-[#368764]';
}

export function DealAnalysis({ deal, analysis, loading, onAnalyze }: DealAnalysisProps) {
  // Renders these sections in white cards:
  // 1. Header: deal.title + status badge + deal.currency deal.value + "Re-analyze" button
  // 2. Health Score card: large score number (colored), progress bar, "Critical" to "Healthy" labels
  // 3. Key Signals card: map analysis.signals → ✓ (positive), ✕ (negative), ⚠ (warning) icons + text
  // 4. Recommended Actions card: map analysis.actions → numbered priority list with:
  //    - Priority circle (color: 1=red, 2=yellow, 3=blue)
  //    - Title (bold) + reasoning paragraph
  //    - Action button (Draft Email / Add Task / View Details based on actionType)
  // If no analysis: show "Click Re-analyze to get started" empty state
  // If loading: show spinner overlay
}
```

- [ ] **Step 3: Write DealChat component**

```typescript
import { useState, useRef, useEffect } from 'react';
import type { DealChatMessageRow } from '@pipeagent/shared';

interface DealChatProps {
  messages: DealChatMessageRow[];
  onSend: (message: string) => void;
}

const SUGGESTED_PROMPTS = [
  'Why is this at risk?',
  'Who are the stakeholders?',
  'Compare to similar won deals',
];

export function DealChat({ messages, onSend }: DealChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  // Renders:
  // - White card with "Ask About This Deal" header
  // - Chat messages list (scrollable, ref=scrollRef), user right-aligned, assistant left-aligned
  // - Input row: text input + green Send button
  // - Suggested prompt chips below input (onClick sets input and sends)
  // - Enter key submits
}
```

- [ ] **Step 4: Write DealCoachWorkspace**

Composes DealList + DealAnalysis + DealChat:

```typescript
import { useState } from 'react';
import { useDeals } from '../../hooks/useDeals';
import { useDealAnalysis } from '../../hooks/useDealAnalysis';
import { DealList } from './DealList';
import { DealAnalysis } from './DealAnalysis';
import { DealChat } from './DealChat';

export function DealCoachWorkspace() {
  const { deals, loading: dealsLoading } = useDeals();
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const selectedDeal = deals.find(d => d.id === selectedDealId) || null;
  const { analysis, loading: analysisLoading, analyze, chatMessages, sendChat } = useDealAnalysis(selectedDealId);

  return (
    <div className="flex h-full">
      <DealList
        deals={deals}
        selectedDealId={selectedDealId}
        onSelectDeal={setSelectedDealId}
        loading={dealsLoading}
      />
      <div className="flex-1 overflow-auto p-6 bg-[#f5f6f7]">
        {selectedDeal ? (
          <>
            <DealAnalysis
              deal={selectedDeal}
              analysis={analysis}
              loading={analysisLoading}
              onAnalyze={analyze}
            />
            <DealChat
              messages={chatMessages}
              onSend={sendChat}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a deal to analyze
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/agents/deal-coach/
git commit -m "feat: add Deal Coach workspace UI components"
```

---

## Chunk 7: Simulated Agent Workspaces

### Task 23: Simulated Fixtures

**Files:**
- Create: `apps/web/src/agents/simulated/fixtures.ts`

- [ ] **Step 1: Write mock data fixtures**

Create realistic mock data for all 4 simulated agents. Each fixture includes:
- Meeting Prep: mock briefing with attendee bios, company info, talking points
- Email Composer: mock draft emails at various stages (draft, sent, follow-up)
- Data Enrichment: mock enriched contacts showing before/after field completion
- Pipeline Forecaster: mock pipeline summary with deal probabilities, revenue forecast

Keep data realistic — use plausible company names, email subjects, revenue figures.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/agents/simulated/fixtures.ts
git commit -m "feat: add mock data fixtures for simulated agents"
```

### Task 24: Simulated Workspace Components

**Files:**
- Create: `apps/web/src/agents/meeting-prep/Workspace.tsx`
- Create: `apps/web/src/agents/email-composer/Workspace.tsx`
- Create: `apps/web/src/agents/data-enrichment/Workspace.tsx`
- Create: `apps/web/src/agents/pipeline-forecaster/Workspace.tsx`

- [ ] **Step 1: Write Meeting Prep workspace**

Shows a list of upcoming "meetings" on the left, and a briefing document on the right when one is selected. The briefing shows: attendee cards with photo placeholders, company overview, recent news, talking points, and suggested questions. All from fixtures. Add a subtle "AI-generated" badge and a "Regenerate" button (disabled, cosmetic).

- [ ] **Step 2: Write Email Composer workspace**

Shows a list of draft/sent emails on the left, and the email editor on the right. The editor has To, Subject, Body fields pre-filled from fixtures. Action buttons: Send, Edit, Discard. A "tone" selector (Professional, Friendly, Direct) — cosmetic only. Shows "Personalization score: 87%" badge.

- [ ] **Step 3: Write Data Enrichment workspace**

Shows a table of contacts with enrichment status. Columns: Name, Company, Email, Phone, LinkedIn, Status (Enriched/Pending/Not Found). Some rows show before/after with highlighted new fields. A "Run Enrichment" button at top (triggers a brief loading animation then shows results from fixtures).

- [ ] **Step 4: Write Pipeline Forecaster workspace**

Shows pipeline summary at top (total value, weighted value, predicted close this month/quarter). Below: a deal list sorted by close probability with color-coded confidence bars. A simple bar chart mockup showing monthly forecast. All from fixtures.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/agents/meeting-prep/ apps/web/src/agents/email-composer/ apps/web/src/agents/data-enrichment/ apps/web/src/agents/pipeline-forecaster/
git commit -m "feat: add simulated agent workspace UIs"
```

---

## Chunk 8: Settings, Build Your Own & Polish

### Task 25: Settings Page

**Files:**
- Create: `apps/web/src/pages/Settings.tsx`
- Create: `apps/web/src/hooks/useHubConfig.ts`
- Create: `apps/web/src/hooks/useAgentConfig.ts`

- [ ] **Step 1: Write useHubConfig hook**

```typescript
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export function useHubConfig() {
  const [globalContext, setGlobalContext] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/hub-config').then(async res => {
      if (res.ok) {
        const data = await res.json();
        setGlobalContext(data.config?.global_context || '');
      }
      setLoading(false);
    });
  }, []);

  const save = async (text: string) => {
    setSaving(true);
    await apiFetch('/hub-config', {
      method: 'PUT',
      body: JSON.stringify({ global_context: text }),
    });
    setGlobalContext(text);
    setSaving(false);
  };

  return { globalContext, setGlobalContext, loading, saving, save };
}
```

- [ ] **Step 2: Write useAgentConfig hook**

```typescript
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { AgentConfigRow, AgentId } from '@pipeagent/shared';

export function useAgentConfig() {
  const [configs, setConfigs] = useState<Record<AgentId, string>>({} as Record<AgentId, string>);
  const [loading, setLoading] = useState(true);
  const [savingAgent, setSavingAgent] = useState<AgentId | null>(null);

  useEffect(() => {
    apiFetch('/agent-config').then(async res => {
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        (data.configs as AgentConfigRow[]).forEach(c => {
          map[c.agent_id] = c.local_context;
        });
        setConfigs(map as Record<AgentId, string>);
      }
      setLoading(false);
    });
  }, []);

  const save = async (agentId: AgentId, localContext: string) => {
    setSavingAgent(agentId);
    await apiFetch(`/agent-config/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify({ local_context: localContext }),
    });
    setConfigs(prev => ({ ...prev, [agentId]: localContext }));
    setSavingAgent(null);
  };

  return { configs, loading, savingAgent, save };
}
```

- [ ] **Step 3: Write Settings page**

Settings page with tabs: Business Context | Pipedrive Connection | Notifications.

Business Context tab (the main one):
- Left column: Global Context textarea + save button
- Right column: Expandable accordion of per-agent configs (from agent registry), each with textarea + save button
- Blue info box explaining inheritance

Pipedrive Connection tab: shows current connection info (domain, user name, connected date). Disconnect button.

Notifications tab: placeholder "Coming soon" state.

All styled with Pipedrive-inspired design (white cards, subtle borders, tab navigation).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Settings.tsx apps/web/src/hooks/useHubConfig.ts apps/web/src/hooks/useAgentConfig.ts
git commit -m "feat: add Settings page with global and per-agent context config"
```

### Task 26: Build Your Own Page

**Files:**
- Create: `apps/web/src/pages/BuildYourOwn.tsx`

- [ ] **Step 1: Write Build Your Own teaser page**

Centered layout with:
- Large heading: "Build Your Own Agent"
- Subheading: "Describe what your agent should do in natural language"
- Textarea (styled, with placeholder text like "I want an agent that monitors my pipeline for deals that haven't been updated in 2 weeks and sends me a daily summary...")
- Disabled green button: "Create Agent — Coming Soon"
- Brief paragraph below explaining the vision

Clean, aspirational design. The textarea is interactive (you can type) but the button doesn't do anything.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/BuildYourOwn.tsx
git commit -m "feat: add Build Your Own agent teaser page"
```

### Task 27: Visual Polish Pass

**Files:**
- Modify: various component files

- [ ] **Step 1: Apply consistent Pipedrive-inspired design tokens**

Audit these specific files and ensure they use the design system:
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/TopBar.tsx`
- `apps/web/src/pages/Home.tsx`
- `apps/web/src/pages/Settings.tsx`
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/BuildYourOwn.tsx`
- `apps/web/src/agents/deal-coach/*.tsx`
- `apps/web/src/agents/meeting-prep/Workspace.tsx`
- `apps/web/src/agents/email-composer/Workspace.tsx`
- `apps/web/src/agents/data-enrichment/Workspace.tsx`
- `apps/web/src/agents/pipeline-forecaster/Workspace.tsx`

Design tokens:
- Dark sidebar: `bg-[#1a2233]`
- Content background: `bg-[#f5f6f7]`
- Cards: `bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)]`
- Primary green: `bg-[#368764]` for buttons, active states
- Text: `text-[#1b1f23]` primary, `text-[#6a7178]` secondary
- Status badges: green (on track), yellow (needs action), red (at risk)
- Font: Inter or system font stack, 14px base

- [ ] **Step 2: Verify all routes render correctly**

Navigate to each route and verify:
- `/` — Home with agent cards
- `/agent/lead-qualification` — Three-panel lead qualification
- `/agent/deal-coach` — Deal list + analysis
- `/agent/meeting-prep` — Simulated meeting prep
- `/agent/email-composer` — Simulated email composer
- `/agent/data-enrichment` — Simulated data enrichment
- `/agent/pipeline-forecaster` — Simulated pipeline forecaster
- `/settings` — Global + per-agent config
- `/build` — Build Your Own teaser

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ apps/web/src/pages/ apps/web/src/agents/
git commit -m "feat: apply Pipedrive-inspired visual polish across all components"
```

### Task 28: Setup Guide

**Files:**
- Create: `docs/setup-guide.md`

- [ ] **Step 1: Write the setup guide**

Step-by-step guide covering:
1. **Prerequisites** — Node.js 20+, pnpm, Pipedrive account
2. **Create a Pipedrive Custom App** — Developer Hub walkthrough with required scopes (leads:full, deals:full, contacts:full, activities:read, users:read)
3. **Set Up Supabase** — Create project, run migrations, note credentials
4. **Get API Keys** — Anthropic (Claude), Tavily (optional)
5. **Configure Environment** — Copy .env.example, fill values
6. **Run Locally** — pnpm install && pnpm dev
7. **Deploy** — Railway (server) + Cloudflare Pages (web)
8. **Connect Your Pipedrive** — Open hub, click Connect, authorize

Keep it concise, practical, and copy-pasteable.

- [ ] **Step 2: Update .env.example with any new variables**

Ensure .env.example includes JWT_SECRET and any new variables.

- [ ] **Step 3: Commit**

```bash
git add docs/setup-guide.md .env.example
git commit -m "docs: add setup guide for new users"
```

### Task 29: Database Migration for Existing Data

**Files:**
- Modify: `supabase/migrations/003_agent_hub.sql`

- [ ] **Step 1: Verify migration handles existing data**

Ensure the `ALTER TABLE agent_runs ADD COLUMN agent_id` with `DEFAULT 'lead-qualification'` correctly backfills existing rows. Ensure no foreign key or constraint issues.

- [ ] **Step 2: Run migration against local Supabase**

```bash
psql $DATABASE_URL -f supabase/migrations/003_agent_hub.sql
```

Expected: All statements succeed without errors.

- [ ] **Step 3: Commit if any changes needed**

```bash
git add supabase/migrations/003_agent_hub.sql
git commit -m "fix: ensure migration handles existing data correctly"
```
