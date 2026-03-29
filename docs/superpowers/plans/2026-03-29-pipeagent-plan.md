# PipeAgent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lead qualification agent POC for Pipedrive using LangGraph.js, demonstrating sub-agents, checkpointing, HITL, and agent memory.

**Architecture:** Monorepo with a React dashboard (Cloudflare Pages), a Node.js agent server (Railway), and Supabase for persistence. LangGraph.js orchestrates three sub-agents (Research, Scoring, Outreach) triggered by Pipedrive webhooks or chat.

**Tech Stack:** TypeScript, pnpm workspaces, LangGraph.js, @langchain/anthropic, Hono, Supabase, React + Vite + Tailwind, Cloudflare Pages, Railway.

**Spec:** `docs/superpowers/specs/2026-03-29-pipeagent-design.md`

---

## Chunk 1: Foundation — Monorepo, Database, Pipedrive Client

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (workspace root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/server.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/index.css`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create root workspace files**

`package.json`:
```json
{
  "name": "pipeagent",
  "private": true,
  "scripts": {
    "dev:server": "pnpm --filter @pipeagent/server dev",
    "dev:web": "pnpm --filter @pipeagent/web dev",
    "dev": "pnpm run --parallel dev:server dev:web",
    "build": "pnpm run --filter @pipeagent/shared build && pnpm run --parallel --filter @pipeagent/server build --filter @pipeagent/web build",
    "seed": "pnpm --filter @pipeagent/server seed"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.env
.env.local
```

- [ ] **Step 2: Create shared package**

`packages/shared/package.json`:
```json
{
  "name": "@pipeagent/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/types.js",
  "types": "dist/types.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/shared/src/types.ts`:
```ts
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

// --- Database rows ---

export type AgentRunTrigger = 'webhook' | 'chat' | 'manual';
export type AgentRunStatus = 'running' | 'paused' | 'completed' | 'failed';
export type EmailDraftStatus = 'pending' | 'sent' | 'discarded' | 'edited';

export interface AgentRunRow {
  id: string;
  connection_id: string;
  lead_id: string;
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
```

- [ ] **Step 3: Create server package**

`apps/server/package.json`:
```json
{
  "name": "@pipeagent/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "seed": "tsx src/seed/cli.ts"
  },
  "dependencies": {
    "@langchain/anthropic": "^0.3.0",
    "@langchain/community": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/langgraph-checkpoint-postgres": "^0.0.10",
    "@supabase/supabase-js": "^2.47.0",
    "@pipeagent/shared": "workspace:*",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "pg": "^8.13.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "tsx": "^4.20.0",
    "typescript": "^5.7.0",
    "vitest": "^4.0.0"
  }
}
```

`apps/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

`apps/server/src/server.ts` (minimal placeholder):
```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3001;
console.log(`Server starting on port ${port}`);
serve({ fetch: app.fetch, port });

export default app;
```

- [ ] **Step 4: Create web package**

`apps/web/package.json`:
```json
{
  "name": "@pipeagent/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.47.0",
    "@pipeagent/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

`apps/web/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PipeAgent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/web/src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <h1 className="text-2xl font-bold">PipeAgent</h1>
    </div>
  );
}
```

`apps/web/src/index.css`:
```css
@import 'tailwindcss';
```

- [ ] **Step 5: Install dependencies and verify**

Run: `pnpm install`
Run: `pnpm dev:server` — expect "Server starting on port 3001"
Run: `pnpm dev:web` — expect Vite dev server on 5173

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with server, web, and shared packages"
```

---

### Task 2: Supabase Migration

**Files:**
- Create: `supabase/migrations/001_initial.sql`
- Create: `.env.example`

- [ ] **Step 1: Write the migration SQL**

`supabase/migrations/001_initial.sql`:
```sql
-- Enable required extensions
create extension if not exists "pgcrypto";

-- Connections (Pipedrive OAuth tokens)
create table connections (
  id uuid primary key default gen_random_uuid(),
  pipedrive_user_id integer not null,
  pipedrive_company_id integer not null,
  api_domain text not null,
  access_token text not null,
  refresh_token text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipedrive_user_id, pipedrive_company_id)
);

-- Agent runs
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  lead_id text not null,
  trigger text not null check (trigger in ('webhook', 'chat', 'manual')),
  status text not null default 'running' check (status in ('running', 'paused', 'completed', 'failed')),
  graph_state jsonb,
  score integer,
  label text check (label in ('hot', 'warm', 'cold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity logs (powers the Agent Inspector)
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  node_name text not null,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Org memory (agent research cache)
create table org_memory (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  pipedrive_org_id integer not null,
  org_name text not null,
  research_data jsonb not null default '{}',
  last_researched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, pipedrive_org_id)
);

-- Email drafts
create table email_drafts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'discarded', 'edited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_agent_runs_connection on agent_runs(connection_id);
create index idx_agent_runs_lead on agent_runs(lead_id);
create index idx_activity_logs_run on activity_logs(run_id);
create index idx_activity_logs_created on activity_logs(created_at);
create index idx_org_memory_lookup on org_memory(connection_id, pipedrive_org_id);

-- Enable realtime for activity_logs (powers live Inspector)
alter publication supabase_realtime add table activity_logs;
alter publication supabase_realtime add table agent_runs;
alter publication supabase_realtime add table email_drafts;

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger connections_updated_at before update on connections
  for each row execute function update_updated_at();
create trigger agent_runs_updated_at before update on agent_runs
  for each row execute function update_updated_at();
create trigger org_memory_updated_at before update on org_memory
  for each row execute function update_updated_at();
create trigger email_drafts_updated_at before update on email_drafts
  for each row execute function update_updated_at();
```

- [ ] **Step 2: Create .env.example**

`.env.example`:
```
# Server (Railway)
ANTHROPIC_API_KEY=
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=
PIPEDRIVE_REDIRECT_URI=http://localhost:3001/auth/callback
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
TAVILY_API_KEY=
PUBLIC_SERVER_URL=http://localhost:3001
WEB_URL=http://localhost:5173

# Web (set in apps/web/.env)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
```

- [ ] **Step 3: Run migration against Supabase**

Run: `psql $DATABASE_URL -f supabase/migrations/001_initial.sql`
Expected: Tables created successfully, no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/ .env.example
git commit -m "feat: add Supabase migration and env example"
```

---

### Task 3: Pipedrive API Client

**Files:**
- Create: `apps/server/src/pipedrive/types.ts`
- Create: `apps/server/src/pipedrive/client.ts`
- Create: `apps/server/src/pipedrive/oauth.ts`
- Test: `apps/server/src/pipedrive/__tests__/client.test.ts`

- [ ] **Step 1: Write Pipedrive-specific types**

`apps/server/src/pipedrive/types.ts`:
```ts
export interface PipedriveApiResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
}

export interface PipedriveWebhookPayload {
  v: number;
  matches_filters: { current: number[]; previous: number[] } | null;
  meta: {
    action: 'added' | 'updated' | 'deleted';
    object: string;
    id: number | string;
    company_id: number;
    user_id: number;
    timestamp: number;
  };
  current: Record<string, unknown>;
  previous: Record<string, unknown> | null;
  event: string;
}

export interface PipedriveTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  api_domain: string;
}

export interface PipedriveLeadLabel {
  id: string;
  name: string;
  color: string;
}
```

- [ ] **Step 2: Write failing test for PipedriveClient**

`apps/server/src/pipedrive/__tests__/client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipedriveClient } from '../client.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PipedriveClient', () => {
  let client: PipedriveClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new PipedriveClient('https://test.pipedrive.com', 'test-token');
  });

  it('fetches a lead by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'abc-123', title: 'Test Lead' },
      }),
    });

    const lead = await client.getLead('abc-123');
    expect(lead.id).toBe('abc-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.pipedrive.com/api/v1/leads/abc-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('fetches an organization by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 1, name: 'Acme Corp' },
      }),
    });

    const org = await client.getOrganization(1);
    expect(org.name).toBe('Acme Corp');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ success: false, error: 'Unauthorized' }),
    });

    await expect(client.getLead('bad')).rejects.toThrow('Pipedrive API error: 401');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/pipedrive/__tests__/client.test.ts`
Expected: FAIL — cannot find module `../client.js`

- [ ] **Step 4: Implement PipedriveClient**

`apps/server/src/pipedrive/client.ts`:
```ts
import type {
  PipedriveLead,
  PipedrivePerson,
  PipedriveOrganization,
} from '@pipeagent/shared';
import type { PipedriveApiResponse, PipedriveLeadLabel } from './types.js';

export class PipedriveClient {
  constructor(
    private apiDomain: string,
    private accessToken: string,
  ) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.apiDomain}/api/v1${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Pipedrive API error: ${res.status}`);
    }

    const json = (await res.json()) as PipedriveApiResponse<T>;
    if (!json.success) {
      throw new Error(`Pipedrive API returned success=false`);
    }
    return json.data;
  }

  async getLead(id: string): Promise<PipedriveLead> {
    return this.request<PipedriveLead>(`/leads/${id}`);
  }

  async getPerson(id: number): Promise<PipedrivePerson> {
    return this.request<PipedrivePerson>(`/persons/${id}`);
  }

  async getOrganization(id: number): Promise<PipedriveOrganization> {
    return this.request<PipedriveOrganization>(`/organizations/${id}`);
  }

  async updateLead(id: string, data: Partial<PipedriveLead>): Promise<PipedriveLead> {
    return this.request<PipedriveLead>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createLead(data: {
    title: string;
    person_id?: number;
    organization_id?: number;
    value?: { amount: number; currency: string };
    label_ids?: string[];
  }): Promise<PipedriveLead> {
    return this.request<PipedriveLead>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPerson(data: {
    name: string;
    email?: string[];
    org_id?: number;
  }): Promise<PipedrivePerson> {
    return this.request<PipedrivePerson>('/persons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createOrganization(data: {
    name: string;
    address?: string;
  }): Promise<PipedriveOrganization> {
    return this.request<PipedriveOrganization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLeadLabels(): Promise<PipedriveLeadLabel[]> {
    return this.request<PipedriveLeadLabel[]>('/leadLabels');
  }

  async addNote(data: {
    content: string;
    lead_id?: string;
    org_id?: number;
    person_id?: number;
  }): Promise<unknown> {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createWebhook(data: {
    subscription_url: string;
    event_action: string;
    event_object: string;
  }): Promise<unknown> {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLeads(params?: { limit?: number; start?: number }): Promise<PipedriveLead[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.start) query.set('start', String(params.start));
    const qs = query.toString();
    return this.request<PipedriveLead[]>(`/leads${qs ? `?${qs}` : ''}`);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/server && npx vitest run src/pipedrive/__tests__/client.test.ts`
Expected: 3 tests PASS

- [ ] **Step 6: Implement OAuth helpers**

`apps/server/src/pipedrive/oauth.ts`:
```ts
import type { PipedriveTokenResponse } from './types.js';

const PIPEDRIVE_AUTH_URL = 'https://oauth.pipedrive.com/oauth/authorize';
const PIPEDRIVE_TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token';

export function getAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${PIPEDRIVE_AUTH_URL}?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<PipedriveTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(PIPEDRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${error}`);
  }

  return res.json() as Promise<PipedriveTokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<PipedriveTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(PIPEDRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${error}`);
  }

  return res.json() as Promise<PipedriveTokenResponse>;
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/pipedrive/
git commit -m "feat: add Pipedrive API client and OAuth helpers"
```

---

### Task 4: Supabase Helper & Connection Management

**Files:**
- Create: `apps/server/src/lib/supabase.ts`
- Create: `apps/server/src/lib/connections.ts`

- [ ] **Step 1: Create Supabase client helper**

`apps/server/src/lib/supabase.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    supabase = createClient(url, key);
  }
  return supabase;
}
```

- [ ] **Step 2: Create connection management**

`apps/server/src/lib/connections.ts`:
```ts
import type { PipedriveConnection } from '@pipeagent/shared';
import { getSupabase } from './supabase.js';
import { refreshAccessToken } from '../pipedrive/oauth.js';
import { PipedriveClient } from '../pipedrive/client.js';

export async function getConnection(id: string): Promise<PipedriveConnection> {
  const { data, error } = await getSupabase()
    .from('connections')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new Error(`Connection not found: ${id}`);
  return data as PipedriveConnection;
}

export async function getConnectionByPipedriveUser(
  userId: number,
  companyId: number,
): Promise<PipedriveConnection | null> {
  const { data } = await getSupabase()
    .from('connections')
    .select('*')
    .eq('pipedrive_user_id', userId)
    .eq('pipedrive_company_id', companyId)
    .single();

  return (data as PipedriveConnection) ?? null;
}

export async function upsertConnection(conn: Omit<PipedriveConnection, 'id' | 'created_at' | 'updated_at'>): Promise<PipedriveConnection> {
  const { data, error } = await getSupabase()
    .from('connections')
    .upsert(conn, { onConflict: 'pipedrive_user_id,pipedrive_company_id' })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to upsert connection: ${error?.message}`);
  return data as PipedriveConnection;
}

export async function getClientForConnection(connectionId: string): Promise<PipedriveClient> {
  const conn = await getConnection(connectionId);

  // Try refreshing if token might be stale (we refresh proactively)
  try {
    const clientId = process.env.PIPEDRIVE_CLIENT_ID!;
    const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET!;
    const tokens = await refreshAccessToken(conn.refresh_token, clientId, clientSecret);

    await getSupabase()
      .from('connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      })
      .eq('id', conn.id);

    return new PipedriveClient(tokens.api_domain, tokens.access_token);
  } catch {
    // Use existing token if refresh fails (might still be valid)
    // api_domain is stored as full URL from token response (e.g., "https://company.pipedrive.com")
    return new PipedriveClient(conn.api_domain, conn.access_token);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/lib/
git commit -m "feat: add Supabase helper and connection management"
```

---

### Task 5: Auth Route

**Files:**
- Create: `apps/server/src/routes/auth.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Implement auth routes**

`apps/server/src/routes/auth.ts`:
```ts
import { Hono } from 'hono';
import { getAuthorizationUrl, exchangeCodeForToken } from '../pipedrive/oauth.js';
import { PipedriveClient } from '../pipedrive/client.js';
import { upsertConnection, getConnection } from '../lib/connections.js';
import crypto from 'node:crypto';

const auth = new Hono();

// Redirect to Pipedrive OAuth
auth.get('/login', (c) => {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID!;
  const redirectUri = process.env.PIPEDRIVE_REDIRECT_URI!;
  const state = crypto.randomBytes(16).toString('hex');
  // In a real app, store state in session for CSRF validation
  const url = getAuthorizationUrl(clientId, redirectUri, state);
  return c.redirect(url);
});

// OAuth callback
auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'Missing code' }, 400);

  const clientId = process.env.PIPEDRIVE_CLIENT_ID!;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET!;
  const redirectUri = process.env.PIPEDRIVE_REDIRECT_URI!;

  const tokens = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

  // Get user info from Pipedrive to identify the connection
  const userRes = await fetch(`${tokens.api_domain}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userData = (await userRes.json()) as { data: { id: number; company_id: number } };

  const connection = await upsertConnection({
    pipedrive_user_id: userData.data.id,
    pipedrive_company_id: userData.data.company_id,
    api_domain: tokens.api_domain,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scopes: tokens.scope.split(' '),
  });

  // Register webhook for lead.added events
  const client = new PipedriveClient(tokens.api_domain, tokens.access_token);
  const serverUrl = process.env.PUBLIC_SERVER_URL || 'http://localhost:3001';
  try {
    await client.createWebhook({
      subscription_url: `${serverUrl}/webhooks/pipedrive`,
      event_action: 'added',
      event_object: 'lead',
    });
  } catch (err) {
    console.warn('Webhook registration failed (may already exist):', err);
  }

  // Redirect to frontend with connection ID
  const webUrl = process.env.WEB_URL || 'http://localhost:5173';
  return c.redirect(`${webUrl}?connection_id=${connection.id}`);
});

// Get current connection info (no tokens exposed)
auth.get('/me', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id header' }, 401);

  const conn = await getConnection(connectionId);
  return c.json({
    id: conn.id,
    api_domain: conn.api_domain,
    pipedrive_user_id: conn.pipedrive_user_id,
  });
});

export default auth;
```

- [ ] **Step 2: Mount auth routes on server**

Update `apps/server/src/server.ts`:
```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth.js';

const app = new Hono();

app.use('*', cors());
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/auth', auth);

const port = Number(process.env.PORT) || 3001;
console.log(`Server starting on port ${port}`);
serve({ fetch: app.fetch, port });

export default app;
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/auth.ts apps/server/src/server.ts
git commit -m "feat: add Pipedrive OAuth login flow"
```

---

## Chunk 2: LangGraph Agent — State, Sub-Agents, Orchestrator

### Task 6: Agent State & Activity Logger

**Files:**
- Create: `apps/server/src/agent/state.ts`
- Create: `apps/server/src/agent/logger.ts`

- [ ] **Step 1: Define the LangGraph state schema**

`apps/server/src/agent/state.ts`:
```ts
import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type {
  ResearchData,
  ScoringResult,
  LeadLabel,
  EmailDraft,
  PipedriveLead,
  PipedrivePerson,
  PipedriveOrganization,
} from '@pipeagent/shared';

export const AgentState = Annotation.Root({
  // LangGraph messages channel (append-only via reducer)
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Input context
  connectionId: Annotation<string>,
  leadId: Annotation<string>,
  runId: Annotation<string>,
  trigger: Annotation<'webhook' | 'chat' | 'manual'>,
  userMessage: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Pipedrive data (fetched in fetchContext node)
  lead: Annotation<PipedriveLead | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  person: Annotation<PipedrivePerson | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  organization: Annotation<PipedriveOrganization | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Memory check result
  existingResearch: Annotation<ResearchData | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  memoryFresh: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // Sub-agent outputs
  research: Annotation<ResearchData | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  scoring: Annotation<ScoringResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  label: Annotation<LeadLabel | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  emailDraft: Annotation<EmailDraft | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // HITL response
  hitlAction: Annotation<'send' | 'discard' | 'edit' | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  editedEmail: Annotation<EmailDraft | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
```

- [ ] **Step 2: Create activity logger**

`apps/server/src/agent/logger.ts`:
```ts
import { getSupabase } from '../lib/supabase.js';

export async function logActivity(
  runId: string,
  nodeName: string,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await getSupabase().from('activity_logs').insert({
    run_id: runId,
    node_name: nodeName,
    event_type: eventType,
    payload,
  });
}

export async function updateRunStatus(
  runId: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await getSupabase()
    .from('agent_runs')
    .update({ status, ...extra })
    .eq('id', runId);
}

export async function createRun(data: {
  connection_id: string;
  lead_id: string;
  trigger: string;
}): Promise<string> {
  const { data: run, error } = await getSupabase()
    .from('agent_runs')
    .insert(data)
    .select('id')
    .single();

  if (error || !run) throw new Error(`Failed to create run: ${error?.message}`);
  return run.id;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/agent/state.ts apps/server/src/agent/logger.ts
git commit -m "feat: add LangGraph agent state schema and activity logger"
```

---

### Task 7: Graph Nodes (fetchContext, checkMemory, saveResearch, writeBack)

**Files:**
- Create: `apps/server/src/agent/nodes/fetchContext.ts`
- Create: `apps/server/src/agent/nodes/checkMemory.ts`
- Create: `apps/server/src/agent/nodes/saveResearch.ts`
- Create: `apps/server/src/agent/nodes/writeBack.ts`
- Create: `apps/server/src/agent/nodes/logActivity.ts`
- Create: `apps/server/src/memory/orgMemory.ts`

- [ ] **Step 1: Implement org memory helper**

`apps/server/src/memory/orgMemory.ts`:
```ts
import type { OrgMemoryRow, ResearchData } from '@pipeagent/shared';
import { getSupabase } from '../lib/supabase.js';

const FRESHNESS_DAYS = 7;

export async function getOrgMemory(
  connectionId: string,
  orgId: number,
): Promise<OrgMemoryRow | null> {
  const { data } = await getSupabase()
    .from('org_memory')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('pipedrive_org_id', orgId)
    .single();

  return (data as OrgMemoryRow) ?? null;
}

export function isMemoryFresh(memory: OrgMemoryRow | null): boolean {
  if (!memory) return false;
  const age = Date.now() - new Date(memory.last_researched_at).getTime();
  return age < FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

export async function saveOrgMemory(
  connectionId: string,
  orgId: number,
  orgName: string,
  researchData: ResearchData,
): Promise<void> {
  await getSupabase()
    .from('org_memory')
    .upsert(
      {
        connection_id: connectionId,
        pipedrive_org_id: orgId,
        org_name: orgName,
        research_data: researchData,
        last_researched_at: new Date().toISOString(),
      },
      { onConflict: 'connection_id,pipedrive_org_id' },
    );
}
```

- [ ] **Step 2: Implement fetchContext node**

`apps/server/src/agent/nodes/fetchContext.ts`:
```ts
import type { AgentStateType } from '../state.js';
import { logActivity } from '../logger.js';
import { getClientForConnection } from '../../lib/connections.js';

export async function fetchContext(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, leadId, runId } = state;
  await logActivity(runId, 'fetchContext', 'node_enter', { leadId });

  const client = await getClientForConnection(connectionId);
  const lead = await client.getLead(leadId);

  await logActivity(runId, 'fetchContext', 'tool_call', {
    tool: 'pipedrive.getLead',
    result: { title: lead.title, person_id: lead.person_id, org_id: lead.organization_id },
  });

  let person = null;
  let organization = null;

  if (lead.person_id) {
    person = await client.getPerson(lead.person_id);
    await logActivity(runId, 'fetchContext', 'tool_call', {
      tool: 'pipedrive.getPerson',
      result: { name: person.name },
    });
  }

  if (lead.organization_id) {
    organization = await client.getOrganization(lead.organization_id);
    await logActivity(runId, 'fetchContext', 'tool_call', {
      tool: 'pipedrive.getOrganization',
      result: { name: organization.name },
    });
  }

  await logActivity(runId, 'fetchContext', 'node_exit', {
    lead_title: lead.title,
    org_name: organization?.name ?? 'none',
  });

  return { lead, person, organization };
}
```

- [ ] **Step 3: Implement checkMemory node**

`apps/server/src/agent/nodes/checkMemory.ts`:
```ts
import type { AgentStateType } from '../state.js';
import { logActivity } from '../logger.js';
import { getOrgMemory, isMemoryFresh } from '../../memory/orgMemory.js';

export async function checkMemory(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, organization, runId } = state;
  await logActivity(runId, 'checkMemory', 'node_enter');

  if (!organization) {
    await logActivity(runId, 'checkMemory', 'node_exit', { result: 'no_org' });
    return { existingResearch: null, memoryFresh: false };
  }

  const memory = await getOrgMemory(connectionId, organization.id);
  const fresh = isMemoryFresh(memory);

  await logActivity(runId, 'checkMemory', 'node_exit', {
    org: organization.name,
    has_memory: !!memory,
    fresh,
    last_researched: memory?.last_researched_at ?? null,
  });

  return {
    existingResearch: memory?.research_data ?? null,
    memoryFresh: fresh,
    research: fresh ? memory!.research_data : null,
  };
}
```

- [ ] **Step 4: Implement saveResearch node**

`apps/server/src/agent/nodes/saveResearch.ts`:
```ts
import type { AgentStateType } from '../state.js';
import { logActivity } from '../logger.js';
import { saveOrgMemory } from '../../memory/orgMemory.js';

export async function saveResearch(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, organization, research, runId } = state;
  await logActivity(runId, 'saveResearch', 'node_enter');

  if (organization && research) {
    await saveOrgMemory(connectionId, organization.id, organization.name, research);
    await logActivity(runId, 'saveResearch', 'node_exit', {
      org: organization.name,
      saved: true,
    });
  }

  return {};
}
```

- [ ] **Step 5: Implement writeBack node**

`apps/server/src/agent/nodes/writeBack.ts`:
```ts
import type { AgentStateType } from '../state.js';
import { logActivity, updateRunStatus } from '../logger.js';
import { getClientForConnection } from '../../lib/connections.js';

export async function writeBack(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { connectionId, leadId, scoring, label, research, runId } = state;
  await logActivity(runId, 'writeBack', 'node_enter', { score: scoring?.overall_score, label });

  const client = await getClientForConnection(connectionId);

  // Update lead label
  if (label) {
    const labels = await client.getLeadLabels();
    const labelMap: Record<string, string> = {
      hot: 'Hot',
      warm: 'Warm',
      cold: 'Cold',
    };
    const targetLabel = labels.find((l) => l.name === labelMap[label]);
    if (targetLabel) {
      await client.updateLead(leadId, { label_ids: [targetLabel.id] });
      await logActivity(runId, 'writeBack', 'tool_call', {
        tool: 'pipedrive.updateLead',
        label: label,
      });
    }
  }

  // Add research note
  if (research) {
    const noteContent = [
      `## Agent Qualification Report`,
      `**Score:** ${scoring?.overall_score ?? 'N/A'}/100 (${label?.toUpperCase() ?? 'N/A'})`,
      `**Company:** ${research.company_description}`,
      `**Employees:** ${research.employee_count ?? 'Unknown'}`,
      `**Industry:** ${research.industry ?? 'Unknown'}`,
      `**Funding:** ${research.funding_stage ?? 'Unknown'}`,
      scoring ? `\n### Scoring Breakdown\n${scoring.criteria.map((c) => `- ${c.name}: ${c.score}/${c.max_score} — ${c.reasoning}`).join('\n')}` : '',
      scoring ? `\n**Recommendation:** ${scoring.recommendation}` : '',
    ].join('\n');

    await client.addNote({ content: noteContent, lead_id: leadId });
    await logActivity(runId, 'writeBack', 'tool_call', {
      tool: 'pipedrive.addNote',
      content_length: noteContent.length,
    });
  }

  // Update run record
  await updateRunStatus(runId, label === 'cold' ? 'completed' : 'running', {
    score: scoring?.overall_score ?? null,
    label,
  });

  await logActivity(runId, 'writeBack', 'node_exit', { label });
  return {};
}
```

- [ ] **Step 6: Implement logActivity node (final graph node)**

`apps/server/src/agent/nodes/logActivity.ts`:
```ts
import type { AgentStateType } from '../state.js';
import { logActivity as log, updateRunStatus } from '../logger.js';

export async function logActivityNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { runId, scoring, label, emailDraft, hitlAction } = state;

  await log(runId, 'complete', 'node_enter', {
    score: scoring?.overall_score,
    label,
    email_status: hitlAction ?? (label === 'cold' ? 'skipped' : 'pending'),
  });

  await updateRunStatus(runId, 'completed');
  await log(runId, 'complete', 'node_exit', { final: true });

  return {};
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/agent/nodes/ apps/server/src/memory/
git commit -m "feat: add graph nodes — fetchContext, checkMemory, saveResearch, writeBack"
```

---

### Task 8: Research Sub-Agent

**Files:**
- Create: `apps/server/src/agent/subagents/research.ts`

- [ ] **Step 1: Implement research sub-agent graph**

`apps/server/src/agent/subagents/research.ts`:
```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { StateGraph, Annotation, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import type { ResearchData } from '@pipeagent/shared';
import { logActivity } from '../logger.js';

const ResearchState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  orgName: Annotation<string>,
  orgAddress: Annotation<string | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  runId: Annotation<string>,
  result: Annotation<ResearchData | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

const tools = [
  new TavilySearchResults({
    apiKey: process.env.TAVILY_API_KEY,
    maxResults: 5,
  }),
];

const model = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
}).bindTools(tools);

async function researchAgent(state: typeof ResearchState.State) {
  const { orgName, orgAddress, runId, messages } = state;

  if (messages.length === 0) {
    // Initial prompt
    const prompt = `You are a company research analyst. Research the company "${orgName}"${orgAddress ? ` (address: ${orgAddress})` : ''}.

Find and report:
1. What the company does (brief description)
2. Approximate employee count
3. Industry/vertical
4. Funding stage and notable investors (if applicable)
5. Key technologies they use
6. Recent notable news

Use the search tool to find this information. Be thorough but concise. After gathering enough info, respond with a JSON block in this exact format:

\`\`\`json
{
  "company_description": "...",
  "employee_count": 150,
  "industry": "...",
  "funding_stage": "Series B",
  "tech_stack": ["React", "AWS"],
  "recent_news": ["Raised $50M in March 2025"],
  "website_url": "https://...",
  "raw_summary": "..."
}
\`\`\``;

    await logActivity(runId, 'research', 'llm_call', { prompt_preview: prompt.slice(0, 200) });
    const response = await model.invoke([new HumanMessage(prompt)]);
    return { messages: [new HumanMessage(prompt), response] };
  }

  // Continue conversation (tool results fed back)
  const lastMessage = messages[messages.length - 1];
  await logActivity(runId, 'research', 'llm_call', { continuation: true });
  const response = await model.invoke(messages);
  return { messages: [response] };
}

function parseResearchResult(state: typeof ResearchState.State) {
  const { messages, runId } = state;
  const lastMsg = messages[messages.length - 1];
  const content = typeof lastMsg.content === 'string' ? lastMsg.content : '';

  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as ResearchData;
      return { result: parsed };
    } catch {
      // Fall through to default
    }
  }

  // Default if parsing fails
  return {
    result: {
      company_description: content.slice(0, 500),
      employee_count: null,
      industry: null,
      funding_stage: null,
      tech_stack: [],
      recent_news: [],
      website_url: null,
      raw_summary: content,
    } satisfies ResearchData,
  };
}

function shouldContinue(state: typeof ResearchState.State): string {
  const lastMsg = state.messages[state.messages.length - 1];
  if (
    lastMsg &&
    'tool_calls' in lastMsg &&
    Array.isArray(lastMsg.tool_calls) &&
    lastMsg.tool_calls.length > 0
  ) {
    return 'tools';
  }
  return 'parse';
}

const toolNode = new ToolNode(tools);

const researchGraph = new StateGraph(ResearchState)
  .addNode('agent', researchAgent)
  .addNode('tools', toolNode)
  .addNode('parse', parseResearchResult)
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    parse: 'parse',
  })
  .addEdge('tools', 'agent')
  .addEdge('parse', '__end__');

export const researchSubgraph = researchGraph.compile();
export type ResearchInput = typeof ResearchState.State;
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/agent/subagents/research.ts
git commit -m "feat: add research sub-agent with Tavily search"
```

---

### Task 9: Scoring Sub-Agent

**Files:**
- Create: `apps/server/src/agent/subagents/scoring.ts`

- [ ] **Step 1: Implement scoring sub-agent graph**

`apps/server/src/agent/subagents/scoring.ts`:
```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { ResearchData, ScoringResult, LeadLabel } from '@pipeagent/shared';
import { logActivity } from '../logger.js';

const ScoringState = Annotation.Root({
  research: Annotation<ResearchData>,
  leadTitle: Annotation<string>,
  runId: Annotation<string>,
  result: Annotation<ScoringResult | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  label: Annotation<LeadLabel | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

const model = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

async function scoreLead(state: typeof ScoringState.State) {
  const { research, leadTitle, runId } = state;

  const prompt = `You are a lead qualification analyst for a B2B SaaS company. Score this lead based on the research data below.

**Lead:** ${leadTitle}
**Company:** ${research.company_description}
**Employees:** ${research.employee_count ?? 'Unknown'}
**Industry:** ${research.industry ?? 'Unknown'}
**Funding:** ${research.funding_stage ?? 'Unknown'}
**Tech Stack:** ${research.tech_stack.join(', ') || 'Unknown'}
**Recent News:** ${research.recent_news.join('; ') || 'None'}

Score each criterion from 0-10 and provide reasoning:
1. **Company Size Fit** (0-10): Mid-market (50-1000 employees) scores highest
2. **Industry Fit** (0-10): Tech, SaaS, and digital-first businesses score highest
3. **Budget Signals** (0-10): Recent funding, growth indicators suggest budget
4. **Timing Signals** (0-10): Recent hiring, news, or tech changes suggest active buying

Respond with ONLY a JSON block:
\`\`\`json
{
  "overall_score": 72,
  "confidence": 0.8,
  "criteria": [
    {"name": "Company Size Fit", "score": 8, "max_score": 10, "reasoning": "..."},
    {"name": "Industry Fit", "score": 9, "max_score": 10, "reasoning": "..."},
    {"name": "Budget Signals", "score": 6, "max_score": 10, "reasoning": "..."},
    {"name": "Timing Signals", "score": 7, "max_score": 10, "reasoning": "..."}
  ],
  "recommendation": "Strong fit. Recommend immediate outreach focused on..."
}
\`\`\`

The overall_score should be calculated as: sum of criteria scores * 2.5 (to normalize to 0-100).`;

  await logActivity(runId, 'scoring', 'llm_call', { lead: leadTitle });
  const response = await model.invoke([new HumanMessage(prompt)]);
  const content = typeof response.content === 'string' ? response.content : '';

  await logActivity(runId, 'scoring', 'node_exit', { response_preview: content.slice(0, 300) });

  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[1]) as ScoringResult;
      const label: LeadLabel =
        result.overall_score >= 70 ? 'hot' : result.overall_score >= 40 ? 'warm' : 'cold';
      return { result, label };
    } catch {
      // Fall through
    }
  }

  // Default scoring if parsing fails
  return {
    result: {
      overall_score: 50,
      confidence: 0.3,
      criteria: [],
      recommendation: 'Unable to parse scoring response. Manual review recommended.',
    },
    label: 'warm' as LeadLabel,
  };
}

const scoringGraph = new StateGraph(ScoringState)
  .addNode('score', scoreLead)
  .addEdge('__start__', 'score')
  .addEdge('score', '__end__');

export const scoringSubgraph = scoringGraph.compile();
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/agent/subagents/scoring.ts
git commit -m "feat: add scoring sub-agent with ICP criteria"
```

---

### Task 10: Outreach Sub-Agent with HITL Interrupt

**Files:**
- Create: `apps/server/src/agent/subagents/outreach.ts`

- [ ] **Step 1: Implement outreach sub-agent with interrupt**

`apps/server/src/agent/subagents/outreach.ts`:
```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { ResearchData, ScoringResult, LeadLabel, EmailDraft } from '@pipeagent/shared';
import { logActivity } from '../logger.js';
import { getSupabase } from '../../lib/supabase.js';

const OutreachState = Annotation.Root({
  research: Annotation<ResearchData>,
  scoring: Annotation<ScoringResult>,
  label: Annotation<LeadLabel>,
  leadTitle: Annotation<string>,
  personName: Annotation<string | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  runId: Annotation<string>,
  draft: Annotation<EmailDraft | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

const model = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0.7,
});

async function draftEmail(state: typeof OutreachState.State) {
  const { research, scoring, label, leadTitle, personName, runId } = state;

  const toneGuide =
    label === 'hot'
      ? 'Eager and specific. Reference concrete company details. Show clear value prop.'
      : 'Soft touch, exploratory. Ask discovery questions. Low pressure.';

  const prompt = `You are a sales development representative writing a personalized outreach email.

**Lead:** ${leadTitle}
**Contact:** ${personName ?? 'the team'}
**Company:** ${research.company_description}
**Industry:** ${research.industry ?? 'Unknown'}
**Employees:** ${research.employee_count ?? 'Unknown'}
**Score:** ${scoring.overall_score}/100 (${label.toUpperCase()})
**Key insight:** ${scoring.recommendation}

**Tone:** ${toneGuide}

Write a short, personalized email (3-5 sentences max). No generic templates. Reference specific details about their company. Be human.

Respond with ONLY a JSON block:
\`\`\`json
{
  "subject": "...",
  "body": "..."
}
\`\`\``;

  await logActivity(runId, 'outreach', 'llm_call', { label, person: personName });
  const response = await model.invoke([new HumanMessage(prompt)]);
  const content = typeof response.content === 'string' ? response.content : '';

  let draft: EmailDraft = { subject: 'Follow up', body: content };
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      draft = JSON.parse(jsonMatch[1]) as EmailDraft;
    } catch {
      // Use default
    }
  }

  // Save draft to DB
  await getSupabase().from('email_drafts').insert({
    run_id: runId,
    subject: draft.subject,
    body: draft.body,
    status: 'pending',
  });

  await logActivity(runId, 'outreach', 'node_exit', {
    subject: draft.subject,
    body_preview: draft.body.slice(0, 100),
  });

  return { draft };
}

// Outreach sub-graph only handles drafting. HITL interrupt lives in parent graph.
const outreachGraph = new StateGraph(OutreachState)
  .addNode('draft', draftEmail)
  .addEdge('__start__', 'draft')
  .addEdge('draft', '__end__');

export const outreachSubgraph = outreachGraph.compile();
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/agent/subagents/outreach.ts
git commit -m "feat: add outreach sub-agent with HITL interrupt"
```

---

### Task 11: Main Orchestrator Graph

**Files:**
- Create: `apps/server/src/agent/graph.ts`
- Create: `apps/server/src/agent/checkpointer.ts`

- [ ] **Step 1: Create Postgres checkpointer setup**

`apps/server/src/agent/checkpointer.ts`:
```ts
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const connString = process.env.DATABASE_URL;
    if (!connString) throw new Error('Missing DATABASE_URL');
    checkpointer = PostgresSaver.fromConnString(connString);
    await checkpointer.setup();
  }
  return checkpointer;
}
```

- [ ] **Step 2: Implement the main orchestrator graph**

`apps/server/src/agent/graph.ts`:
```ts
import { StateGraph } from '@langchain/langgraph';
import { AgentState, type AgentStateType } from './state.js';
import { getCheckpointer } from './checkpointer.js';
import { fetchContext } from './nodes/fetchContext.js';
import { checkMemory } from './nodes/checkMemory.js';
import { saveResearch } from './nodes/saveResearch.js';
import { writeBack } from './nodes/writeBack.js';
import { logActivityNode } from './nodes/logActivity.js';
import { researchSubgraph } from './subagents/research.js';
import { scoringSubgraph } from './subagents/scoring.js';
import { outreachSubgraph } from './subagents/outreach.js';
import { logActivity, updateRunStatus } from './logger.js';
import { getSupabase } from '../lib/supabase.js';

// Wrapper nodes that bridge parent state → sub-agent state

async function runResearch(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { organization, runId } = state;
  await logActivity(runId, 'research', 'node_enter', { org: organization?.name });

  const result = await researchSubgraph.invoke({
    messages: [],
    orgName: organization?.name ?? 'Unknown',
    orgAddress: organization?.address ?? null,
    runId,
    result: null,
  });

  await logActivity(runId, 'research', 'node_exit', {
    employee_count: result.result?.employee_count,
    industry: result.result?.industry,
  });

  return { research: result.result };
}

async function runScoring(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { research, lead, runId } = state;
  if (!research) return {};

  await logActivity(runId, 'scoring', 'node_enter');

  const result = await scoringSubgraph.invoke({
    research,
    leadTitle: lead?.title ?? 'Unknown Lead',
    runId,
    result: null,
    label: null,
  });

  await logActivity(runId, 'scoring', 'decision', {
    score: result.result?.overall_score,
    label: result.label,
    criteria: result.result?.criteria,
  });

  return { scoring: result.result, label: result.label };
}

async function runOutreach(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { research, scoring, label, lead, person, runId } = state;
  if (!research || !scoring || !label) return {};

  await logActivity(runId, 'outreach', 'node_enter', { label });

  // Only run the drafting part — HITL interrupt is a separate node in parent graph
  const result = await outreachSubgraph.invoke({
    research,
    scoring,
    label,
    leadTitle: lead?.title ?? 'Unknown Lead',
    personName: person?.name ?? null,
    runId,
    draft: null,
    hitlAction: null,
    editedEmail: null,
  });

  return { emailDraft: result.draft };
}

async function hitlReview(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { runId, emailDraft } = state;

  await logActivity(runId, 'outreach', 'decision', {
    type: 'hitl_interrupt',
    message: 'Waiting for human to review email draft',
    draft_subject: emailDraft?.subject,
  });

  // Update run status to paused
  await updateRunStatus(runId, 'paused');

  // interrupt() at the parent graph level — this properly checkpoints
  const { interrupt } = await import('@langchain/langgraph');
  const humanResponse = interrupt({
    type: 'email_review',
    draft: emailDraft,
    actions: ['send', 'edit', 'discard'],
  });

  const action = (humanResponse as { action: string; editedEmail?: { subject: string; body: string } }).action;
  const editedEmail = (humanResponse as { editedEmail?: { subject: string; body: string } }).editedEmail ?? null;

  // Update draft status in DB
  const statusMap: Record<string, string> = { send: 'sent', discard: 'discarded', edit: 'edited' };
  await getSupabase()
    .from('email_drafts')
    .update({ status: statusMap[action] ?? 'pending' })
    .eq('run_id', runId);

  await logActivity(runId, 'outreach', 'decision', { type: 'hitl_response', action });

  return {
    hitlAction: action as 'send' | 'discard' | 'edit',
    editedEmail: editedEmail as AgentStateType['editedEmail'],
  };
}

// Conditional edge functions

function shouldSkipResearch(state: AgentStateType): string {
  return state.memoryFresh ? 'scoring' : 'research';
}

function shouldSkipOutreach(state: AgentStateType): string {
  return state.label === 'cold' ? 'logActivity' : 'outreach';
}

// Build the graph

const workflow = new StateGraph(AgentState)
  .addNode('fetchContext', fetchContext)
  .addNode('checkMemory', checkMemory)
  .addNode('research', runResearch)
  .addNode('saveResearch', saveResearch)
  .addNode('scoring', runScoring)
  .addNode('writeBack', writeBack)
  .addNode('outreach', runOutreach)
  .addNode('hitlReview', hitlReview)
  .addNode('logActivity', logActivityNode)
  // Edges
  .addEdge('__start__', 'fetchContext')
  .addEdge('fetchContext', 'checkMemory')
  .addConditionalEdges('checkMemory', shouldSkipResearch, {
    research: 'research',
    scoring: 'scoring',
  })
  .addEdge('research', 'saveResearch')
  .addEdge('saveResearch', 'scoring')
  .addEdge('scoring', 'writeBack')
  .addConditionalEdges('writeBack', shouldSkipOutreach, {
    outreach: 'outreach',
    logActivity: 'logActivity',
  })
  .addEdge('outreach', 'hitlReview')
  .addEdge('hitlReview', 'logActivity')
  .addEdge('logActivity', '__end__');

export async function getCompiledGraph() {
  const checkpointer = await getCheckpointer();
  return workflow.compile({ checkpointer });
}

export async function runQualification(input: {
  connectionId: string;
  leadId: string;
  runId: string;
  trigger: 'webhook' | 'chat' | 'manual';
  userMessage?: string;
}): Promise<AgentStateType> {
  const graph = await getCompiledGraph();

  const result = await graph.invoke(
    {
      connectionId: input.connectionId,
      leadId: input.leadId,
      runId: input.runId,
      trigger: input.trigger,
      userMessage: input.userMessage ?? null,
    },
    {
      configurable: { thread_id: `${input.connectionId}-${input.leadId}-${input.runId}` },
    },
  );

  return result;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors (or only minor type issues to fix)

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/agent/
git commit -m "feat: add main LangGraph orchestrator with sub-agents and checkpointing"
```

---

## Chunk 3: API Routes & Lead Seeder

### Task 12: Webhook Route

**Files:**
- Create: `apps/server/src/routes/webhooks.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Implement webhook handler**

`apps/server/src/routes/webhooks.ts`:
```ts
import { Hono } from 'hono';
import type { PipedriveWebhookPayload } from '../pipedrive/types.js';
import { getConnectionByPipedriveUser } from '../lib/connections.js';
import { createRun } from '../agent/logger.js';
import { runQualification } from '../agent/graph.js';

const webhooks = new Hono();

webhooks.post('/pipedrive', async (c) => {
  const payload = (await c.req.json()) as PipedriveWebhookPayload;

  // Only handle lead.added events
  if (payload.meta.object !== 'lead' || payload.meta.action !== 'added') {
    return c.json({ status: 'ignored', reason: `${payload.meta.action}.${payload.meta.object}` });
  }

  const leadId = String(payload.meta.id);
  const { company_id, user_id } = payload.meta;

  // Find the connection for this user
  const connection = await getConnectionByPipedriveUser(user_id, company_id);
  if (!connection) {
    return c.json({ status: 'ignored', reason: 'no_connection' });
  }

  // Create a run and kick off qualification (non-blocking)
  const runId = await createRun({
    connection_id: connection.id,
    lead_id: leadId,
    trigger: 'webhook',
  });

  // Run qualification in background (don't await)
  runQualification({
    connectionId: connection.id,
    leadId,
    runId,
    trigger: 'webhook',
  }).catch((err) => {
    console.error(`Qualification failed for run ${runId}:`, err);
  });

  return c.json({ status: 'accepted', run_id: runId });
});

export default webhooks;
```

- [ ] **Step 2: Mount on server**

Add to `apps/server/src/server.ts` after auth import:
```ts
import webhooks from './routes/webhooks.js';
// ... after app.route('/auth', auth):
app.route('/webhooks', webhooks);
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/webhooks.ts apps/server/src/server.ts
git commit -m "feat: add Pipedrive webhook handler for lead.added events"
```

---

### Task 13: Chat Route

**Files:**
- Create: `apps/server/src/routes/chat.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Implement chat endpoint**

`apps/server/src/routes/chat.ts`:
```ts
import { Hono } from 'hono';
import { createRun } from '../agent/logger.js';
import { runQualification } from '../agent/graph.js';
import { getSupabase } from '../lib/supabase.js';

const chat = new Hono();

// Trigger a chat-based agent run
chat.post('/message', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const { leadId, message } = (await c.req.json()) as {
    leadId: string;
    message: string;
  };

  if (!leadId || !message) {
    return c.json({ error: 'Missing leadId or message' }, 400);
  }

  const runId = await createRun({
    connection_id: connectionId,
    lead_id: leadId,
    trigger: 'chat',
  });

  // Run in background
  runQualification({
    connectionId,
    leadId,
    runId,
    trigger: 'chat',
    userMessage: message,
  }).catch((err) => {
    console.error(`Chat qualification failed for run ${runId}:`, err);
  });

  return c.json({ run_id: runId });
});

// Resume a paused run (HITL response)
chat.post('/resume', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const { runId, action, editedEmail } = (await c.req.json()) as {
    runId: string;
    action: 'send' | 'discard' | 'edit';
    editedEmail?: { subject: string; body: string };
  };

  // Resume the graph with the HITL response
  const { getCompiledGraph } = await import('../agent/graph.js');
  const graph = await getCompiledGraph();

  // Get the run to find the thread_id
  const { data: run } = await getSupabase()
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (!run) return c.json({ error: 'Run not found' }, 404);

  const { Command } = await import('@langchain/langgraph');

  // Resume the graph from the interrupt
  graph
    .invoke(new Command({ resume: { action, editedEmail: editedEmail ?? null } }), {
      configurable: {
        thread_id: `${connectionId}-${run.lead_id}-${runId}`,
      },
    })
    .catch((err: Error) => {
      console.error(`Resume failed for run ${runId}:`, err);
    });

  return c.json({ status: 'resumed', run_id: runId });
});

// Get runs for a lead
chat.get('/runs/:leadId', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const leadId = c.req.param('leadId');
  const { data } = await getSupabase()
    .from('agent_runs')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(20);

  return c.json(data ?? []);
});

// Get activity logs for a run
chat.get('/logs/:runId', async (c) => {
  const runId = c.req.param('runId');
  const { data } = await getSupabase()
    .from('activity_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  return c.json(data ?? []);
});

export default chat;
```

- [ ] **Step 2: Mount on server**

Add to `apps/server/src/server.ts`:
```ts
import chat from './routes/chat.js';
// ... after webhooks route:
app.route('/chat', chat);
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/chat.ts apps/server/src/server.ts
git commit -m "feat: add chat route with HITL resume support"
```

---

### Task 14: Seed Route & CLI

**Files:**
- Create: `apps/server/src/seed/companies.ts`
- Create: `apps/server/src/seed/generator.ts`
- Create: `apps/server/src/seed/cli.ts`
- Create: `apps/server/src/routes/seed.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Create real company list**

`apps/server/src/seed/companies.ts`:
```ts
export interface SeedCompany {
  name: string;
  website: string;
  industry: string;
  size: 'tiny' | 'small' | 'mid' | 'large' | 'enterprise';
  expectedFit: 'good' | 'medium' | 'poor';
}

export const SEED_COMPANIES: SeedCompany[] = [
  // Good fit — mid-market tech/SaaS
  { name: 'Notion', website: 'notion.so', industry: 'Productivity Software', size: 'mid', expectedFit: 'good' },
  { name: 'Figma', website: 'figma.com', industry: 'Design Tools', size: 'mid', expectedFit: 'good' },
  { name: 'Datadog', website: 'datadoghq.com', industry: 'Monitoring', size: 'large', expectedFit: 'good' },
  { name: 'Linear', website: 'linear.app', industry: 'Project Management', size: 'small', expectedFit: 'good' },
  { name: 'Vercel', website: 'vercel.com', industry: 'Developer Tools', size: 'mid', expectedFit: 'good' },
  { name: 'Supabase', website: 'supabase.com', industry: 'Database/BaaS', size: 'mid', expectedFit: 'good' },
  { name: 'Retool', website: 'retool.com', industry: 'Internal Tools', size: 'mid', expectedFit: 'good' },
  { name: 'Airtable', website: 'airtable.com', industry: 'Productivity', size: 'mid', expectedFit: 'good' },
  { name: 'Loom', website: 'loom.com', industry: 'Video Communication', size: 'mid', expectedFit: 'good' },
  { name: 'PostHog', website: 'posthog.com', industry: 'Product Analytics', size: 'small', expectedFit: 'good' },
  { name: 'Clerk', website: 'clerk.com', industry: 'Auth/Identity', size: 'small', expectedFit: 'good' },
  { name: 'Resend', website: 'resend.com', industry: 'Email API', size: 'small', expectedFit: 'good' },
  { name: 'Cal.com', website: 'cal.com', industry: 'Scheduling', size: 'small', expectedFit: 'good' },
  { name: 'Dub', website: 'dub.co', industry: 'Link Management', size: 'tiny', expectedFit: 'good' },
  { name: 'Neon', website: 'neon.tech', industry: 'Serverless Postgres', size: 'small', expectedFit: 'good' },

  // Medium fit — bigger or different vertical
  { name: 'Stripe', website: 'stripe.com', industry: 'Payments', size: 'enterprise', expectedFit: 'medium' },
  { name: 'Shopify', website: 'shopify.com', industry: 'E-commerce', size: 'enterprise', expectedFit: 'medium' },
  { name: 'HubSpot', website: 'hubspot.com', industry: 'CRM/Marketing', size: 'enterprise', expectedFit: 'medium' },
  { name: 'Intercom', website: 'intercom.io', industry: 'Customer Support', size: 'large', expectedFit: 'medium' },
  { name: 'Twilio', website: 'twilio.com', industry: 'Communications API', size: 'enterprise', expectedFit: 'medium' },
  { name: 'Contentful', website: 'contentful.com', industry: 'CMS', size: 'mid', expectedFit: 'medium' },
  { name: 'Miro', website: 'miro.com', industry: 'Collaboration', size: 'large', expectedFit: 'medium' },
  { name: 'Deel', website: 'deel.com', industry: 'HR/Payroll', size: 'large', expectedFit: 'medium' },
  { name: 'Zapier', website: 'zapier.com', industry: 'Automation', size: 'mid', expectedFit: 'medium' },
  { name: 'Webflow', website: 'webflow.com', industry: 'Web Design', size: 'mid', expectedFit: 'medium' },

  // Poor fit — wrong vertical, too small, or too large
  { name: "McDonald's", website: 'mcdonalds.com', industry: 'Fast Food', size: 'enterprise', expectedFit: 'poor' },
  { name: 'Walmart', website: 'walmart.com', industry: 'Retail', size: 'enterprise', expectedFit: 'poor' },
  { name: 'Nike', website: 'nike.com', industry: 'Sportswear', size: 'enterprise', expectedFit: 'poor' },
  { name: 'John Deere', website: 'deere.com', industry: 'Agriculture Equipment', size: 'enterprise', expectedFit: 'poor' },
  { name: 'Marriott', website: 'marriott.com', industry: 'Hospitality', size: 'enterprise', expectedFit: 'poor' },
  { name: 'Bob\'s Auto Repair', website: '', industry: 'Automotive Services', size: 'tiny', expectedFit: 'poor' },
  { name: 'Sunrise Bakery', website: '', industry: 'Food & Beverage', size: 'tiny', expectedFit: 'poor' },
  { name: 'Green Thumb Landscaping', website: '', industry: 'Landscaping', size: 'tiny', expectedFit: 'poor' },
  { name: 'Peak Fitness Gym', website: '', industry: 'Fitness', size: 'tiny', expectedFit: 'poor' },
  { name: 'Coastal Dental', website: '', industry: 'Healthcare', size: 'tiny', expectedFit: 'poor' },
];
```

- [ ] **Step 2: Create lead generator**

`apps/server/src/seed/generator.ts`:
```ts
import { PipedriveClient } from '../pipedrive/client.js';
import { SEED_COMPANIES, type SeedCompany } from './companies.js';

const FIRST_NAMES = ['Alex', 'Jordan', 'Sarah', 'Marcus', 'Priya', 'Chen', 'Emma', 'Luca', 'Aisha', 'Kai'];
const LAST_NAMES = ['Smith', 'Park', 'Müller', 'Patel', 'Santos', 'Kim', 'Williams', 'Chen', 'Dubois', 'Nakamura'];
const SOURCES = ['Website', 'LinkedIn', 'Referral', 'Conference', 'Cold Outbound', 'Inbound'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fakePerson(company: SeedCompany) {
  const first = randomFrom(FIRST_NAMES);
  const last = randomFrom(LAST_NAMES);
  const domain = company.website || `${company.name.toLowerCase().replace(/[^a-z]/g, '')}.com`;
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
  };
}

function fakeValue(company: SeedCompany): { amount: number; currency: string } {
  const ranges: Record<string, [number, number]> = {
    tiny: [500, 2000],
    small: [2000, 10000],
    mid: [10000, 50000],
    large: [50000, 200000],
    enterprise: [100000, 500000],
  };
  const [min, max] = ranges[company.size];
  return {
    amount: Math.floor(Math.random() * (max - min) + min),
    currency: 'USD',
  };
}

export async function generateLeads(
  client: PipedriveClient,
  count: number,
): Promise<{ created: number; errors: string[] }> {
  const companies = [...SEED_COMPANIES].sort(() => Math.random() - 0.5).slice(0, count);
  let created = 0;
  const errors: string[] = [];

  for (const company of companies) {
    try {
      // Create organization
      const org = await client.createOrganization({
        name: company.name,
        address: company.website ? `https://${company.website}` : undefined,
      });

      // Create person
      const person = fakePerson(company);
      const pdPerson = await client.createPerson({
        name: person.name,
        email: [person.email],
        org_id: org.id,
      });

      // Create lead
      await client.createLead({
        title: `${company.name} — ${randomFrom(SOURCES)}`,
        person_id: pdPerson.id,
        organization_id: org.id,
        value: fakeValue(company),
      });

      created++;
      console.log(`Created lead: ${company.name}`);
    } catch (err) {
      errors.push(`${company.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { created, errors };
}
```

- [ ] **Step 3: Create CLI entry point**

`apps/server/src/seed/cli.ts`:
```ts
import 'dotenv/config';
import { PipedriveClient } from '../pipedrive/client.js';
import { generateLeads } from './generator.js';

const count = parseInt(process.argv[2] ?? '10', 10);
const apiDomain = process.env.PIPEDRIVE_API_DOMAIN;
const apiToken = process.env.PIPEDRIVE_API_TOKEN;

if (!apiDomain || !apiToken) {
  console.error('Set PIPEDRIVE_API_DOMAIN and PIPEDRIVE_API_TOKEN in .env');
  console.error('(Use your personal API token from Pipedrive settings for seeding)');
  process.exit(1);
}

const client = new PipedriveClient(apiDomain, apiToken);
console.log(`Seeding ${count} leads...`);
const result = await generateLeads(client, count);
console.log(`Done: ${result.created} created, ${result.errors.length} errors`);
if (result.errors.length) {
  console.log('Errors:', result.errors);
}
```

- [ ] **Step 4: Create seed API route**

`apps/server/src/routes/seed.ts`:
```ts
import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';
import { generateLeads } from '../seed/generator.js';

const seed = new Hono();

seed.post('/generate', async (c) => {
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) return c.json({ error: 'Missing X-Connection-Id' }, 401);

  const { count = 5 } = (await c.req.json()) as { count?: number };
  const clampedCount = Math.min(Math.max(count, 1), 10);

  const client = await getClientForConnection(connectionId);
  const result = await generateLeads(client, clampedCount);

  return c.json(result);
});

export default seed;
```

- [ ] **Step 5: Mount seed route and update server.ts to final form**

`apps/server/src/server.ts`:
```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth.js';
import webhooks from './routes/webhooks.js';
import chat from './routes/chat.js';
import seed from './routes/seed.js';

const app = new Hono();

app.use('*', cors());
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/auth', auth);
app.route('/webhooks', webhooks);
app.route('/chat', chat);
app.route('/seed', seed);

const port = Number(process.env.PORT) || 3001;
console.log(`Server starting on port ${port}`);
serve({ fetch: app.fetch, port });

export default app;
```

- [ ] **Step 6: Add dotenv to server dependencies**

Add `"dotenv": "^16.4.0"` to `apps/server/package.json` dependencies, then:
Run: `pnpm install`

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/seed/ apps/server/src/routes/ apps/server/src/server.ts apps/server/package.json
git commit -m "feat: add lead seeder (CLI + API) and all server routes"
```

---

## Chunk 4: Frontend — Dashboard, Inspector, Chat, Email Draft

### Task 15: Supabase Client & Auth Context for Web

**Files:**
- Create: `apps/web/src/lib/supabase.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/hooks/useConnection.ts`

- [ ] **Step 1: Create Supabase client for web**

`apps/web/src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Create API helper**

`apps/web/src/lib/api.ts`:
```ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function getConnectionId(): string | null {
  return localStorage.getItem('connectionId');
}

export function setConnectionId(id: string): void {
  localStorage.setItem('connectionId', id);
}

export async function apiFetch(path: string, options?: RequestInit) {
  const connectionId = getConnectionId();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(connectionId ? { 'X-Connection-Id': connectionId } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Create connection hook**

`apps/web/src/hooks/useConnection.ts`:
```ts
import { useState, useEffect } from 'react';
import { getConnectionId, setConnectionId, apiFetch } from '../lib/api';

export function useConnection() {
  const [connectionId, setConnId] = useState<string | null>(getConnectionId());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ api_domain: string; pipedrive_user_id: number } | null>(null);

  useEffect(() => {
    // Check URL params for connection_id (OAuth callback redirect)
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('connection_id');
    if (idFromUrl) {
      setConnectionId(idFromUrl);
      setConnId(idFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!connectionId) {
      setLoading(false);
      return;
    }
    apiFetch('/auth/me')
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem('connectionId');
        setConnId(null);
      })
      .finally(() => setLoading(false));
  }, [connectionId]);

  const login = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    window.location.href = `${apiUrl}/auth/login`;
  };

  const logout = () => {
    localStorage.removeItem('connectionId');
    setConnId(null);
    setUser(null);
  };

  return { connectionId, user, loading, login, logout };
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/ apps/web/src/hooks/
git commit -m "feat: add web Supabase client, API helper, and auth hook"
```

---

### Task 16: Realtime Hook

**Files:**
- Create: `apps/web/src/hooks/useSupabaseRealtime.ts`

- [ ] **Step 1: Implement Supabase Realtime subscription hook**

`apps/web/src/hooks/useSupabaseRealtime.ts`:
```ts
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLogRow, AgentRunRow, EmailDraftRow } from '@pipeagent/shared';

export function useActivityLogs(runId: string | null) {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    if (!runId) { setLogs([]); return; }

    // Fetch existing logs
    supabase
      .from('activity_logs')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setLogs((data as ActivityLogRow[]) ?? []));

    // Subscribe to new logs
    const channel = supabase
      .channel(`logs-${runId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `run_id=eq.${runId}` },
        (payload) => {
          setLogs((prev) => [...prev, payload.new as ActivityLogRow]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);

  return logs;
}

export function useAgentRuns(connectionId: string | null) {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);

  useEffect(() => {
    if (!connectionId) return;

    supabase
      .from('agent_runs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setRuns((data as AgentRunRow[]) ?? []));

    const channel = supabase
      .channel(`runs-${connectionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_runs', filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRuns((prev) => [payload.new as AgentRunRow, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRuns((prev) =>
              prev.map((r) => (r.id === (payload.new as AgentRunRow).id ? (payload.new as AgentRunRow) : r)),
            );
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [connectionId]);

  return runs;
}

export function useEmailDraft(runId: string | null) {
  const [draft, setDraft] = useState<EmailDraftRow | null>(null);

  useEffect(() => {
    if (!runId) { setDraft(null); return; }

    supabase
      .from('email_drafts')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setDraft((data as EmailDraftRow) ?? null));

    const channel = supabase
      .channel(`draft-${runId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_drafts', filter: `run_id=eq.${runId}` },
        (payload) => setDraft(payload.new as EmailDraftRow),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);

  return draft;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useSupabaseRealtime.ts
git commit -m "feat: add Supabase Realtime hooks for logs, runs, and drafts"
```

---

### Task 17: LeadsList Component

**Files:**
- Create: `apps/web/src/components/LeadsList.tsx`

- [ ] **Step 1: Implement LeadsList**

`apps/web/src/components/LeadsList.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { AgentRunRow } from '@pipeagent/shared';

interface LeadsListProps {
  runs: AgentRunRow[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
  onGenerateLeads: () => void;
  generating: boolean;
}

const labelColors: Record<string, string> = {
  hot: 'bg-red-500',
  warm: 'bg-amber-500',
  cold: 'bg-blue-500',
};

export function LeadsList({ runs, selectedLeadId, onSelectLead, onGenerateLeads, generating }: LeadsListProps) {
  // Group runs by lead, show latest run per lead
  const leadMap = new Map<string, AgentRunRow>();
  for (const run of runs) {
    const existing = leadMap.get(run.lead_id);
    if (!existing || run.created_at > existing.created_at) {
      leadMap.set(run.lead_id, run);
    }
  }
  const leads = Array.from(leadMap.values());

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Leads</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No leads yet. Generate some!</p>
        )}
        {leads.map((run) => (
          <button
            key={run.lead_id}
            onClick={() => onSelectLead(run.lead_id)}
            className={`w-full text-left p-3 border-b border-gray-800 hover:bg-gray-800/50 transition ${
              selectedLeadId === run.lead_id ? 'bg-gray-800' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-200 truncate">
                {run.lead_id.slice(0, 8)}...
              </span>
              <div className="flex items-center gap-2">
                {run.score != null && (
                  <span className="text-xs text-gray-400">{run.score}</span>
                )}
                {run.label && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${labelColors[run.label]} text-white`}>
                    {run.label.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${
                run.status === 'running' ? 'bg-green-400 animate-pulse' :
                run.status === 'paused' ? 'bg-amber-400' :
                run.status === 'completed' ? 'bg-gray-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-gray-500">{run.status}</span>
              <span className="text-xs text-gray-600">{run.trigger}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={onGenerateLeads}
          disabled={generating}
          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded text-sm font-medium transition"
        >
          {generating ? 'Generating...' : '+ Generate Leads'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/LeadsList.tsx
git commit -m "feat: add LeadsList component"
```

---

### Task 18: AgentInspector Component

**Files:**
- Create: `apps/web/src/components/AgentInspector.tsx`

- [ ] **Step 1: Implement AgentInspector**

`apps/web/src/components/AgentInspector.tsx`:
```tsx
import { useState } from 'react';
import type { ActivityLogRow } from '@pipeagent/shared';

interface AgentInspectorProps {
  logs: ActivityLogRow[];
  graphState: Record<string, unknown> | null;
}

const nodeIcons: Record<string, string> = {
  fetchContext: '📥',
  checkMemory: '🧠',
  research: '🔍',
  saveResearch: '💾',
  scoring: '📊',
  writeBack: '✏️',
  outreach: '📧',
  complete: '✅',
};

function LogEntry({ log }: { log: ActivityLogRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border-l-2 border-gray-700 pl-3 py-1 cursor-pointer hover:bg-gray-800/30"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs">{nodeIcons[log.node_name] ?? '⚙️'}</span>
        <span className="text-xs font-mono text-indigo-400">{log.node_name}</span>
        <span className="text-xs text-gray-500">{log.event_type}</span>
        <span className="text-xs text-gray-600 ml-auto">
          {new Date(log.created_at).toLocaleTimeString()}
        </span>
      </div>
      {expanded && (
        <pre className="mt-1 text-xs text-gray-400 overflow-x-auto max-h-60 bg-gray-900 p-2 rounded">
          {JSON.stringify(log.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AgentInspector({ logs, graphState }: AgentInspectorProps) {
  const [showState, setShowState] = useState(false);

  // Group logs by node
  const nodeGroups = new Map<string, ActivityLogRow[]>();
  for (const log of logs) {
    const group = nodeGroups.get(log.node_name) ?? [];
    group.push(log);
    nodeGroups.set(log.node_name, group);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Agent Inspector
        </h2>
        <button
          onClick={() => setShowState(!showState)}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          {showState ? 'Hide' : 'Show'} Graph State
        </button>
      </div>

      {showState && graphState && (
        <div className="p-3 border-b border-gray-800 bg-gray-900/50">
          <pre className="text-xs text-gray-400 overflow-x-auto max-h-40">
            {JSON.stringify(graphState, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {logs.length === 0 && (
          <p className="text-sm text-gray-500">Select a lead to see agent activity</p>
        )}
        {logs.map((log) => (
          <LogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/AgentInspector.tsx
git commit -m "feat: add AgentInspector component with expandable log entries"
```

---

### Task 19: ChatPanel Component

**Files:**
- Create: `apps/web/src/components/ChatPanel.tsx`

- [ ] **Step 1: Implement ChatPanel**

`apps/web/src/components/ChatPanel.tsx`:
```tsx
import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { ActivityLogRow } from '@pipeagent/shared';

interface ChatPanelProps {
  leadId: string | null;
  logs: ActivityLogRow[];
}

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export function ChatPanel({ leadId, logs }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Convert relevant logs to chat messages
  useEffect(() => {
    const agentMessages: ChatMessage[] = [];
    for (const log of logs) {
      if (log.event_type === 'llm_call' && log.payload.prompt_preview) {
        agentMessages.push({
          role: 'agent',
          content: `**${log.node_name}** reasoning: ${String(log.payload.prompt_preview).slice(0, 150)}...`,
          timestamp: log.created_at,
        });
      }
      if (log.event_type === 'decision' && log.payload.type !== 'hitl_interrupt') {
        agentMessages.push({
          role: 'agent',
          content: `**${log.node_name}**: ${JSON.stringify(log.payload, null, 0).slice(0, 200)}`,
          timestamp: log.created_at,
        });
      }
      if (log.event_type === 'node_exit' && log.node_name === 'scoring') {
        const p = log.payload as Record<string, unknown>;
        agentMessages.push({
          role: 'agent',
          content: `Scored lead: **${p.score ?? 'N/A'}**/100 → ${String(p.label ?? 'unknown').toUpperCase()}`,
          timestamp: log.created_at,
        });
      }
    }
    setMessages((prev) => {
      const userMsgs = prev.filter((m) => m.role === 'user');
      return [...userMsgs, ...agentMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    });
  }, [logs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !leadId || sending) return;

    const msg = input.trim();
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);

    try {
      await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ leadId, message: msg }),
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'agent', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Chat</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!leadId && <p className="text-sm text-gray-500">Select a lead to start chatting</p>}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={leadId ? 'Ask about this lead...' : 'Select a lead first'}
            disabled={!leadId || sending}
            className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!leadId || sending || !input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded text-sm font-medium transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ChatPanel.tsx
git commit -m "feat: add ChatPanel component"
```

---

### Task 20: EmailDraftBar Component

**Files:**
- Create: `apps/web/src/components/EmailDraftBar.tsx`

- [ ] **Step 1: Implement EmailDraftBar**

`apps/web/src/components/EmailDraftBar.tsx`:
```tsx
import { useState } from 'react';
import { apiFetch } from '../lib/api';
import type { EmailDraftRow } from '@pipeagent/shared';

interface EmailDraftBarProps {
  draft: EmailDraftRow | null;
  runId: string | null;
}

export function EmailDraftBar({ draft, runId }: EmailDraftBarProps) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  if (!draft || draft.status !== 'pending') return null;

  const startEdit = () => {
    setSubject(draft.subject);
    setBody(draft.body);
    setEditing(true);
  };

  const resume = async (action: 'send' | 'discard' | 'edit') => {
    if (!runId) return;
    setSending(true);
    try {
      await apiFetch('/chat/resume', {
        method: 'POST',
        body: JSON.stringify({
          runId,
          action,
          ...(action === 'edit' ? { editedEmail: { subject, body } } : {}),
        }),
      });
    } finally {
      setSending(false);
      setEditing(false);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-900/80 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">Draft Email</h3>
        <div className="flex gap-2">
          <button
            onClick={() => resume('discard')}
            disabled={sending}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
          >
            Discard
          </button>
          {!editing && (
            <button
              onClick={startEdit}
              disabled={sending}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => resume(editing ? 'edit' : 'send')}
            disabled={sending}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 rounded transition font-medium"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full bg-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-gray-200">{draft.subject}</p>
          <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{draft.body}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/EmailDraftBar.tsx
git commit -m "feat: add EmailDraftBar with edit/send/discard actions"
```

---

### Task 21: Main App Layout

**Files:**
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/components/LoginScreen.tsx`

- [ ] **Step 1: Create login screen**

`apps/web/src/components/LoginScreen.tsx`:
```tsx
interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">PipeAgent</h1>
        <p className="text-gray-400 max-w-md">
          An AI agent that qualifies your Pipedrive leads using company research,
          ICP scoring, and personalized outreach drafts.
        </p>
        <button
          onClick={onLogin}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-lg font-medium transition"
        >
          Connect Pipedrive
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire up App.tsx**

`apps/web/src/App.tsx`:
```tsx
import { useState } from 'react';
import { useConnection } from './hooks/useConnection';
import { useAgentRuns, useActivityLogs, useEmailDraft } from './hooks/useSupabaseRealtime';
import { apiFetch } from './lib/api';
import { LoginScreen } from './components/LoginScreen';
import { LeadsList } from './components/LeadsList';
import { AgentInspector } from './components/AgentInspector';
import { ChatPanel } from './components/ChatPanel';
import { EmailDraftBar } from './components/EmailDraftBar';

export default function App() {
  const { connectionId, user, loading, login, logout } = useConnection();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const runs = useAgentRuns(connectionId);

  // Find the latest run for selected lead
  const selectedRun = selectedLeadId
    ? runs.find((r) => r.lead_id === selectedLeadId) ?? null
    : null;

  const logs = useActivityLogs(selectedRun?.id ?? null);
  const draft = useEmailDraft(selectedRun?.id ?? null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!connectionId || !user) {
    return <LoginScreen onLogin={login} />;
  }

  const handleGenerateLeads = async () => {
    setGenerating(true);
    try {
      await apiFetch('/seed/generate', {
        method: 'POST',
        body: JSON.stringify({ count: 5 }),
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">PipeAgent</h1>
          <span className="text-xs text-gray-500">{user.api_domain}</span>
        </div>
        <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-300">
          Disconnect
        </button>
      </header>

      {/* Main three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Leads */}
        <div className="w-64 border-r border-gray-800 flex-shrink-0">
          <LeadsList
            runs={runs}
            selectedLeadId={selectedLeadId}
            onSelectLead={setSelectedLeadId}
            onGenerateLeads={handleGenerateLeads}
            generating={generating}
          />
        </div>

        {/* Center: Inspector */}
        <div className="flex-1 border-r border-gray-800 min-w-0">
          <AgentInspector
            logs={logs}
            graphState={selectedRun?.graph_state ?? null}
          />
        </div>

        {/* Right: Chat */}
        <div className="w-80 flex-shrink-0">
          <ChatPanel leadId={selectedLeadId} logs={logs} />
        </div>
      </div>

      {/* Bottom: Email draft bar */}
      <EmailDraftBar draft={draft} runId={selectedRun?.id ?? null} />
    </div>
  );
}
```

- [ ] **Step 3: Verify web app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Run: `pnpm dev:web` — expect the app to render on localhost:5173

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: add main dashboard layout with three-panel design"
```

---

## Chunk 5: Deployment & End-to-End Verification

### Task 22: Railway Deployment Config

**Files:**
- Create: `apps/server/Dockerfile`
- Create: `apps/server/.dockerignore`

- [ ] **Step 1: Create Dockerfile for server**

`apps/server/Dockerfile`:
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY apps/server/package.json apps/server/tsconfig.json apps/server/
RUN pnpm install --frozen-lockfile
COPY packages/shared/src packages/shared/src
COPY apps/server/src apps/server/src
RUN pnpm --filter @pipeagent/shared build
RUN pnpm --filter @pipeagent/server build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
RUN pnpm install --frozen-lockfile --prod
EXPOSE 3001
CMD ["node", "apps/server/dist/server.js"]
```

`apps/server/.dockerignore`:
```
node_modules
dist
.env
.env.local
```

- [ ] **Step 2: Verify Docker build works locally**

Run: `docker build -f apps/server/Dockerfile -t pipeagent-server .`
Expected: Successful build

- [ ] **Step 3: Commit**

```bash
git add apps/server/Dockerfile apps/server/.dockerignore
git commit -m "feat: add Dockerfile for Railway deployment"
```

---

### Task 23: Cloudflare Pages Config

**Files:**
- Create: `apps/web/wrangler.toml` (optional, CF Pages can auto-detect Vite)

- [ ] **Step 1: Verify Cloudflare Pages build**

Cloudflare Pages auto-detects Vite projects. Configuration:
- Build command: `cd apps/web && npm run build` (or set at CF dashboard)
- Build output directory: `apps/web/dist`
- Root directory: `/` (monorepo root)
- Environment variables: set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` in CF dashboard

Run: `cd apps/web && pnpm build`
Expected: Successful build, output in `apps/web/dist/`

- [ ] **Step 2: Commit**

No file changes needed — CF Pages config is done in dashboard.

---

### Task 24: End-to-End Verification Checklist

This is a manual verification task. Run through each step to confirm the full flow works.

- [ ] **Step 1: Verify Supabase**

Run: `psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"`
Expected: See `connections`, `agent_runs`, `activity_logs`, `org_memory`, `email_drafts`

- [ ] **Step 2: Verify server starts**

Run: `cd apps/server && pnpm dev`
Run: `curl http://localhost:3001/health`
Expected: `{"status":"ok"}`

- [ ] **Step 3: Verify OAuth flow**

Open: `http://localhost:3001/auth/login`
Expected: Redirects to Pipedrive authorization page

- [ ] **Step 4: Verify seed works**

Add `PIPEDRIVE_API_DOMAIN` and `PIPEDRIVE_API_TOKEN` to `.env`, then:
Run: `pnpm seed -- 3`
Expected: 3 leads created in Pipedrive

- [ ] **Step 5: Verify web app**

Run: `pnpm dev:web`
Open: `http://localhost:5173`
Expected: Login screen renders, clicking "Connect Pipedrive" redirects to OAuth

- [ ] **Step 6: Verify full agent flow**

After OAuth:
1. Click "Generate Leads" → leads appear in left panel
2. Webhook fires → agent runs → Inspector shows live steps
3. Research, Scoring, Outreach steps visible
4. Email draft bar appears for Hot/Warm leads
5. Click Send → run completes
6. Check Pipedrive: lead has label, score note

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete PipeAgent POC — ready for deployment"
```
