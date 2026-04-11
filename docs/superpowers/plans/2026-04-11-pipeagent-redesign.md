# Plan B — pipeagent Agent Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor pipeagent's context schema from three overlapping tables into `company_profile` + `agent_identity`, then rebuild the Lead Qualification workspace, Home page, and visual language around the new identity-centric model with Pipedrive-style light theme and live research streaming.

**Architecture:** Phased execution — backend schema + routes + LangGraph refactor first (nothing visible changes), then frontend visual foundation (theme tokens, Lucide icons, sidebar/topbar restyle), then the Lead Qualification workspace rewrite with identity rail + activity stream + output rail + inbox strip, then Home page, then cleanup. Each phase is independently committable and verifiable.

**Tech Stack:** TypeScript 5.x, React 19, Vite, Tailwind CSS 4, Hono (server), LangGraph (`@langchain/langgraph`), `@anthropic-ai/sdk` (research streaming), `@langchain/anthropic` (scoring/outreach), Supabase PostgreSQL + Realtime, `lucide-react` (new).

**Corresponding spec:** `docs/superpowers/specs/2026-04-11-pd-helpers-and-agent-hub-redesign-design.md`.

**Testing philosophy:** pipeagent has no test framework today. Per the spec, this plan does not add one. Every task has a **"Verify"** step instead of a "test" step — either `pnpm typecheck`, `pnpm build`, a `curl` command, a `psql` query, or a browser inspection.

---

## File Structure

### New files

```
supabase/migrations/
└── 005_identity_refactor.sql                    # Migration

apps/server/src/routes/
├── company-profile.ts                            # replaces hub-config.ts
└── agent-identity.ts                             # replaces agent-config.ts

apps/web/src/components/
├── AgentIcon.tsx                                 # Lucide icon whitelist + resolver
├── AgentAvatar.tsx                               # Gradient avatar with palette
├── CompanyProfileEditor.tsx                      # Modal for company profile
└── DemoBanner.tsx                                # (optional, Phase 11)

apps/web/src/agents/lead-qualification/components/
├── IdentityRail.tsx                              # Read-only identity sidebar
├── IdentityEditor.tsx                            # In-place edit mode
├── IcpEditor.tsx                                 # ICP criteria modal
├── ActivityStream.tsx                            # Replaces AgentInspector
└── InboxStrip.tsx                                # Replaces LeadsList

apps/web/src/hooks/
├── useCompanyProfile.ts                          # Hook for /company-profile
└── useAgentIdentity.ts                           # Hook for /agent-identity/:id
```

### Modified files

```
packages/shared/src/types.ts                      # New types, remove BusinessProfile
apps/server/src/server.ts                         # Mount new routes, unmount old
apps/server/src/middleware/auth.ts                # JWT whitelist update
apps/server/src/routes/settings.ts                # Remove ICP/tone/followup endpoints
apps/server/src/agent/state.ts                    # companyProfile + identity annotations
apps/server/src/agent/nodes/fetchContext.ts       # Snapshot identity into state
apps/server/src/agent/subagents/scoring.ts        # Read ICP from state.identity
apps/server/src/agent/subagents/outreach.ts       # Read tone + value prop from state
apps/server/src/agent/subagents/research.ts       # Switch to .stream() with phase events
apps/server/src/agents/deal-coach/nodes/fetchDealContext.ts  # Same pattern
apps/server/src/lib/connections.ts                # (if it references BusinessProfile)
apps/web/src/agents/registry.ts                   # Add scopeIn, scopeOut, defaultIdentity
apps/web/src/components/HubShell.tsx              # Light theme
apps/web/src/components/Sidebar.tsx               # Light theme + Lucide icons
apps/web/src/components/TopBar.tsx                # Light theme + Lucide icons
apps/web/src/pages/Home.tsx                       # Full rewrite
apps/web/src/pages/Settings.tsx                   # Remove Business Context tab
apps/web/src/pages/LoginPage.tsx                  # Light theme
apps/web/src/agents/lead-qualification/Workspace.tsx   # Full rewrite
apps/web/src/agents/lead-qualification/components/EmailDraftBar.tsx  # Restyle
apps/web/src/hooks/useSupabaseRealtime.ts         # Phase + token event handlers
apps/web/src/lib/api.ts                           # New endpoint wrappers
apps/web/src/main.css                             # Theme tokens
apps/web/package.json                             # Add lucide-react
```

### Deleted files

```
apps/server/src/routes/hub-config.ts              # → company-profile.ts
apps/server/src/routes/agent-config.ts            # → agent-identity.ts
apps/server/src/routes/seed.ts                    # CLI-only seeding now
apps/server/src/seed/                              # Entire directory
apps/server/src/seed/cli.ts                        # (lived here)
apps/server/src/seed/generator.ts                  # (lived here)
apps/server/src/seed/companies.ts                  # (lived here — pool moved to pd-helpers)
apps/web/src/agents/lead-qualification/components/ChatPanel.tsx      # Folded into ActivityStream
apps/web/src/agents/lead-qualification/components/LeadsList.tsx      # Replaced by InboxStrip
apps/web/src/agents/lead-qualification/components/AgentInspector.tsx # Replaced by ActivityStream (or kept as hidden Dev view — see Task 18)
apps/web/src/hooks/useSettings.ts                  # Split into useCompanyProfile + useAgentIdentity
```

---

## Phases

- **Phase B1 · Schema migration** — Tasks 1-2
- **Phase B2 · Shared types + registry** — Tasks 3-4
- **Phase B3 · Backend routes** — Tasks 5-7
- **Phase B4 · LangGraph state refactor** — Tasks 8-9
- **Phase B5 · Research streaming** — Task 10
- **Phase B6 · Frontend visual foundation** — Tasks 11-14
- **Phase B7 · Shared frontend components** — Tasks 15-17
- **Phase B8 · Lead Qualification workspace** — Tasks 18-22
- **Phase B9 · Home page** — Task 23
- **Phase B10 · Settings + cleanup** — Tasks 24-26
- **Phase B11 · Optional TEX polish** — Task 27

Each phase is a natural checkpoint. After completing a phase, `pnpm dev` should still run the app without errors (though some UI may be visibly broken mid-phase — that's OK as long as the server/build doesn't crash).

---

## Working directory

All paths in Plan B are relative to `~/git/pipeagent/` unless otherwise noted. Unless stated otherwise, each task assumes `cd ~/git/pipeagent`.

---

## Phase B1 — Schema migration

### Task 1: Write the migration SQL file

**Files:**
- Create: `supabase/migrations/005_identity_refactor.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/005_identity_refactor.sql`:

```sql
-- Identity refactor: consolidate business_profiles + hub_config + agent_config
-- into company_profile + agent_identity. All work happens in a single
-- transaction so a mid-migration failure rolls back cleanly.

BEGIN;

-- New: company profile, one row per connection
CREATE TABLE IF NOT EXISTS company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  value_proposition TEXT NOT NULL DEFAULT '',
  service_area TEXT NOT NULL DEFAULT '',
  extra_context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- New: agent identity, one row per (connection, agent)
CREATE TABLE IF NOT EXISTS agent_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  rulebook TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_identity_connection ON agent_identity(connection_id);
CREATE INDEX IF NOT EXISTS idx_agent_identity_agent ON agent_identity(connection_id, agent_id);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company_profile" ON company_profile FOR ALL USING (true);
CREATE POLICY "own agent_identity" ON agent_identity FOR ALL USING (true);

CREATE TRIGGER company_profile_updated_at BEFORE UPDATE ON company_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_identity_updated_at BEFORE UPDATE ON agent_identity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Backfill company_profile from business_profiles + hub_config
INSERT INTO company_profile (connection_id, description, value_proposition, extra_context)
SELECT
  bp.connection_id,
  bp.business_description,
  bp.value_proposition,
  COALESCE(hc.global_context, '')
FROM business_profiles bp
LEFT JOIN hub_config hc ON hc.connection_id = bp.connection_id
ON CONFLICT (connection_id) DO NOTHING;

-- Backfill agent_identity for lead-qualification
INSERT INTO agent_identity (connection_id, agent_id, personality, rulebook, config)
SELECT
  bp.connection_id,
  'lead-qualification',
  bp.outreach_tone,
  COALESCE(ac.local_context, ''),
  jsonb_build_object(
    'icp_criteria', bp.icp_criteria,
    'followup_days', bp.followup_days
  )
FROM business_profiles bp
LEFT JOIN agent_config ac
  ON ac.connection_id = bp.connection_id AND ac.agent_id = 'lead-qualification'
ON CONFLICT (connection_id, agent_id) DO NOTHING;

-- Backfill agent_identity for deal-coach
INSERT INTO agent_identity (connection_id, agent_id, rulebook, config)
SELECT
  ac.connection_id,
  ac.agent_id,
  ac.local_context,
  '{}'::jsonb
FROM agent_config ac
WHERE ac.agent_id = 'deal-coach'
ON CONFLICT (connection_id, agent_id) DO NOTHING;

-- Drop the old tables
DROP TABLE IF EXISTS hub_config CASCADE;
DROP TABLE IF EXISTS agent_config CASCADE;
DROP TABLE IF EXISTS business_profiles CASCADE;

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
cd ~/git/pipeagent
git add supabase/migrations/005_identity_refactor.sql
git commit -m "feat(db): add migration 005 for identity refactor"
```

### Task 2: Apply the migration (dry-run then prod)

**Files:** none (operational task)

- [ ] **Step 1: Dry-run locally against Docker Postgres**

```bash
# Spin up a local Postgres
docker run -d --name pipeagent-dryrun \
  -p 5433:5432 \
  -e POSTGRES_PASSWORD=dryrun \
  postgres:15

# Wait a few seconds for it to start
sleep 3

# Apply migrations 001–004 to establish baseline
export DRYRUN_URL="postgres://postgres:dryrun@localhost:5433/postgres"
for f in supabase/migrations/001_initial.sql \
         supabase/migrations/002_business_profiles.sql \
         supabase/migrations/003_followup_days.sql \
         supabase/migrations/004_agent_hub.sql; do
  psql "$DRYRUN_URL" -f "$f"
done

# Seed a fake connection + business_profile + hub_config + agent_config
psql "$DRYRUN_URL" -c "
INSERT INTO connections (id, pipedrive_user_id, pipedrive_company_id, api_domain, access_token, refresh_token)
VALUES ('00000000-0000-0000-0000-000000000001', 1, 1, 'https://api.example', 'tok', 'refresh');

INSERT INTO business_profiles (connection_id, business_description, value_proposition, icp_criteria, outreach_tone, followup_days)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Solar installer',
  'Rooftop solar for residential and B2B',
  '[{\"name\":\"Size\",\"description\":\"x\",\"weight\":10}]'::jsonb,
  'Warm, professional',
  3
);

INSERT INTO hub_config (connection_id, global_context)
VALUES ('00000000-0000-0000-0000-000000000001', 'Global hub context here');

INSERT INTO agent_config (connection_id, agent_id, local_context)
VALUES ('00000000-0000-0000-0000-000000000001', 'lead-qualification', 'LQ local context');
"

# Apply 005
psql "$DRYRUN_URL" -f supabase/migrations/005_identity_refactor.sql

# Verify backfill
psql "$DRYRUN_URL" -c "SELECT * FROM company_profile;"
psql "$DRYRUN_URL" -c "SELECT * FROM agent_identity;"

# Verify old tables are gone
psql "$DRYRUN_URL" -c "\dt" | grep -E "business_profiles|hub_config|agent_config" && echo "FAIL: old tables still exist" || echo "OK: old tables dropped"

# Cleanup
docker stop pipeagent-dryrun && docker rm pipeagent-dryrun
```

Expected: `company_profile` has 1 row with `description='Solar installer'`, `value_proposition='Rooftop solar...'`, `extra_context='Global hub context here'`. `agent_identity` has 1 row for `lead-qualification` with `personality='Warm, professional'`, `rulebook='LQ local context'`, `config.icp_criteria[0].name='Size'`, `config.followup_days=3`. Old tables print "OK: old tables dropped".

- [ ] **Step 2: Backup production Supabase**

Open the Supabase dashboard → Project → Database → Backups → "Create backup now." Wait for it to complete (~30 seconds). Retained 7 days.

- [ ] **Step 3: Apply 005 to production**

Open Supabase SQL editor → New query → paste the full contents of `supabase/migrations/005_identity_refactor.sql` → Run.

Expected: "Success. No rows returned." (The migration has side effects but doesn't SELECT.)

- [ ] **Step 4: Verify production state**

Run in Supabase SQL editor:

```sql
SELECT 'company_profile' as table_name, count(*) FROM company_profile
UNION ALL
SELECT 'agent_identity', count(*) FROM agent_identity;

-- Old tables should 404
SELECT to_regclass('public.business_profiles') AS business_profiles,
       to_regclass('public.hub_config')        AS hub_config,
       to_regclass('public.agent_config')      AS agent_config;
```

Expected: `company_profile` has 1 row (for kristjanelias's connection). `agent_identity` has 1 or 2 rows (at least `lead-qualification`, possibly `deal-coach`). All three old tables return NULL.

- [ ] **Step 5: No commit needed**

This task modifies production DB only. No code changes.

---

## Phase B2 — Shared types + registry

### Task 3: Update `packages/shared/src/types.ts`

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Read the current file**

```bash
cat packages/shared/src/types.ts
```

Locate the following sections:
- `BusinessProfile` type (remove it)
- `AgentMeta` type (extend with `scopeIn`, `scopeOut`, `defaultIdentity`; ensure `role` field exists)
- End of file (add new types)

- [ ] **Step 2: Remove `BusinessProfile`**

Delete the entire `BusinessProfile` type declaration. Also delete any re-exports of it.

- [ ] **Step 3: Extend `AgentMeta`**

Find `export type AgentMeta = { ... }` and modify it to:

```ts
export type AgentMeta = {
  id: AgentId;
  name: string;              // display name of the agent type, e.g. "Lead Qualifier"
  role: string;              // structural role shown read-only in identity editor
  icon: LucideIconName;      // key into the AgentIcon whitelist map
  description: string;
  status: 'active' | 'simulated';
  dataScope: 'leads' | 'deals' | 'contacts' | 'pipeline';
  scopeIn: string;           // what this agent owns (read-only text)
  scopeOut: string;          // what it doesn't touch (read-only text)
  defaultIdentity: {
    name: string;
    mission: string;
    personality: string;
  };
  defaultConfig: Record<string, unknown>;
};

// LucideIconName is defined in the frontend (AgentIcon.tsx) as a union of
// whitelisted icon keys. The shared package uses a string to avoid pulling in
// React/Lucide as a dependency — the frontend casts at the boundary.
export type LucideIconName = string;
```

- [ ] **Step 4: Add new types at the end of the file**

Append:

```ts
// Company profile: one row per connection, shared across all agents
export type CompanyProfile = {
  id: string;
  connection_id: string;
  name: string;
  description: string;
  value_proposition: string;
  service_area: string;
  extra_context: string;
  created_at: string;
  updated_at: string;
};

// Structured config for lead-qualification agent_identity.config JSONB
export type LeadQualificationConfig = {
  icp_criteria: IcpCriterion[];
  followup_days: number;
};

// Structured config for deal-coach agent_identity.config JSONB
export type DealCoachConfig = {
  health_score_weights?: Record<string, number>;
};

// agent_identity table row
export type AgentIdentityRow = {
  id: string;
  connection_id: string;
  agent_id: AgentId;
  name: string;
  mission: string;
  personality: string;
  rulebook: string;
  config: LeadQualificationConfig | DealCoachConfig | Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
```

Note: `IcpCriterion` already exists in this file — keep it.

- [ ] **Step 5: Verify**

```bash
cd ~/git/pipeagent
pnpm --filter @pipeagent/shared build
# OR if no filter:
cd packages/shared && pnpm build && cd ../..
```

Expected: shared package builds without error. The project references downstream will now fail to compile until later tasks — that's expected.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add CompanyProfile, AgentIdentityRow, extend AgentMeta"
```

### Task 4: Update `apps/web/src/agents/registry.ts`

**Files:**
- Modify: `apps/web/src/agents/registry.ts`

- [ ] **Step 1: Read the current registry**

```bash
cat apps/web/src/agents/registry.ts
```

Locate each agent's metadata block.

- [ ] **Step 2: Update `lead-qualification` entry**

Find the `'lead-qualification'` entry and replace it with:

```ts
'lead-qualification': {
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
```

If `DEFAULT_ICP_CRITERIA` isn't already imported at the top, import it from wherever the existing registry gets it (check existing imports).

- [ ] **Step 3: Update `deal-coach` entry**

```ts
'deal-coach': {
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
```

- [ ] **Step 4: Update the 4 simulated agents**

For each of `meeting-prep`, `email-composer`, `data-enrichment`, `pipeline-forecaster`, add the new required fields:

```ts
// Example for meeting-prep; apply same pattern to the others
'meeting-prep': {
  // ... existing fields ...
  role: 'Meeting Prep',            // or whatever the display name is
  scopeIn: 'Upcoming meetings, participant research, agenda suggestions.',
  scopeOut: 'Everything else.',
  defaultIdentity: {
    name: '',                       // empty = placeholder, user hasn't hired this agent yet
    mission: '',
    personality: '',
  },
  icon: 'Calendar',                 // or whatever fits — pick from AgentIcon whitelist
},
```

Icons to assign per simulated agent: `meeting-prep → Calendar`, `email-composer → Mail`, `data-enrichment → Database`, `pipeline-forecaster → TrendingUp` (or `LineChart`).

- [ ] **Step 5: Verify**

```bash
cd ~/git/pipeagent
pnpm --filter @pipeagent/web typecheck
# or:
cd apps/web && pnpm typecheck && cd ../..
```

Expected: typecheck may fail if `DEFAULT_ICP_CRITERIA` isn't found — investigate and fix (it may need to be imported from `packages/shared` or inlined here). Otherwise clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/agents/registry.ts
git commit -m "feat(web): add scopeIn, scopeOut, defaultIdentity to agent registry"
```

---

## Phase B3 — Backend routes

### Task 5: Create `company-profile.ts` route

**Files:**
- Create: `apps/server/src/routes/company-profile.ts`
- Delete: `apps/server/src/routes/hub-config.ts`

- [ ] **Step 1: Write the new route**

Create `apps/server/src/routes/company-profile.ts`:

```ts
import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import type { AppEnv } from '../middleware/auth.js';

const companyProfile = new Hono<AppEnv>();

companyProfile.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data, error } = await getSupabase()
    .from('company_profile')
    .select('*')
    .eq('connection_id', connectionId)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);

  // Return an empty-but-valid profile if none exists yet
  if (!data) {
    return c.json({
      profile: {
        connection_id: connectionId,
        name: '',
        description: '',
        value_proposition: '',
        service_area: '',
        extra_context: '',
      },
    });
  }
  return c.json({ profile: data });
});

companyProfile.put('/', async (c) => {
  const connectionId = c.get('connectionId');
  const body = await c.req.json();
  const {
    name = '',
    description = '',
    value_proposition = '',
    service_area = '',
    extra_context = '',
  } = body;

  const { data, error } = await getSupabase()
    .from('company_profile')
    .upsert(
      {
        connection_id: connectionId,
        name,
        description,
        value_proposition,
        service_area,
        extra_context,
      },
      { onConflict: 'connection_id' },
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ profile: data });
});

export default companyProfile;
```

- [ ] **Step 2: Delete old `hub-config.ts`**

```bash
rm apps/server/src/routes/hub-config.ts
```

- [ ] **Step 3: Verify typecheck**

The server will fail to compile until `server.ts` is updated (Task 7) because it still imports `hubConfig`. Expected — proceed.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/company-profile.ts
git rm apps/server/src/routes/hub-config.ts
git commit -m "feat(server): replace hub-config route with company-profile"
```

### Task 6: Create `agent-identity.ts` route

**Files:**
- Create: `apps/server/src/routes/agent-identity.ts`
- Delete: `apps/server/src/routes/agent-config.ts`

- [ ] **Step 1: Write the new route**

Create `apps/server/src/routes/agent-identity.ts`:

```ts
import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import type { AppEnv } from '../middleware/auth.js';

const agentIdentity = new Hono<AppEnv>();

// List all identities for current connection
agentIdentity.get('/', async (c) => {
  const connectionId = c.get('connectionId');
  const { data, error } = await getSupabase()
    .from('agent_identity')
    .select('*')
    .eq('connection_id', connectionId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ identities: data ?? [] });
});

// Get a specific agent's identity (or return empty template)
agentIdentity.get('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');

  const { data, error } = await getSupabase()
    .from('agent_identity')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);

  // Return an empty-but-valid identity if none exists yet.
  // The frontend merges this with registry defaults.
  if (!data) {
    return c.json({
      identity: {
        connection_id: connectionId,
        agent_id: agentId,
        name: '',
        mission: '',
        personality: '',
        rulebook: '',
        config: {},
      },
    });
  }
  return c.json({ identity: data });
});

// Upsert identity for a specific agent
agentIdentity.put('/:agentId', async (c) => {
  const connectionId = c.get('connectionId');
  const agentId = c.req.param('agentId');
  const body = await c.req.json();
  const {
    name = '',
    mission = '',
    personality = '',
    rulebook = '',
    config = {},
  } = body;

  const { data, error } = await getSupabase()
    .from('agent_identity')
    .upsert(
      {
        connection_id: connectionId,
        agent_id: agentId,
        name,
        mission,
        personality,
        rulebook,
        config,
      },
      { onConflict: 'connection_id,agent_id' },
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ identity: data });
});

export default agentIdentity;
```

- [ ] **Step 2: Delete old `agent-config.ts`**

```bash
rm apps/server/src/routes/agent-config.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/agent-identity.ts
git rm apps/server/src/routes/agent-config.ts
git commit -m "feat(server): replace agent-config route with agent-identity"
```

### Task 7: Wire up routes + update settings + auth

**Files:**
- Modify: `apps/server/src/server.ts`
- Modify: `apps/server/src/middleware/auth.ts`
- Modify: `apps/server/src/routes/settings.ts`

- [ ] **Step 1: Update `server.ts` mounts**

Read the current `apps/server/src/server.ts`. Find the imports and route mounts. Replace:

```ts
import hubConfig from './routes/hub-config.js';
import agentConfig from './routes/agent-config.js';
```

with:

```ts
import companyProfile from './routes/company-profile.js';
import agentIdentity from './routes/agent-identity.js';
```

Replace:

```ts
app.route('/hub-config', hubConfig);
app.route('/agent-config', agentConfig);
```

with:

```ts
app.route('/company-profile', companyProfile);
app.route('/agent-identity', agentIdentity);
```

- [ ] **Step 2: Update `middleware/auth.ts` JWT whitelist**

Read `apps/server/src/middleware/auth.ts`. Find the whitelist array of authenticated paths. Remove `/hub-config` and `/agent-config`, add `/company-profile` and `/agent-identity`:

```ts
// Before:
const AUTHENTICATED_PATHS = ['/me', '/chat', '/seed', '/leads', '/deals', '/settings', '/hub-config', '/agent-config'];

// After:
const AUTHENTICATED_PATHS = ['/me', '/chat', '/leads', '/deals', '/settings', '/company-profile', '/agent-identity'];
```

Note: `/seed` is also removed — Task 25 deletes the route file. If removing it now causes a compile error, leave it until Task 25.

- [ ] **Step 3: Strip ICP/tone/followup from `settings.ts`**

Read `apps/server/src/routes/settings.ts`. Remove:
- `DEFAULT_ICP_CRITERIA` constant (moves to frontend registry in Task 4, already done)
- The GET `/` handler's reference to `icp_criteria`, `outreach_tone`, `followup_days`, `business_description`, `value_proposition` — these are no longer owned by this route
- The PUT `/` handler's same references
- Any `business_profiles` table references

The final `settings.ts` should only contain the `POST /register-webhook` endpoint (which registers a Pipedrive webhook). If the file ends up with only that endpoint, that's fine — it's a legitimate route that doesn't fit elsewhere.

If there are no remaining endpoints, delete the file and remove it from `server.ts` too.

Reference post-cleanup content (adapt to whatever else is in your current file):

```ts
import { Hono } from 'hono';
import { getClientForConnection } from '../lib/connections.js';
import type { AppEnv } from '../middleware/auth.js';

const settings = new Hono<AppEnv>();

settings.post('/register-webhook', async (c) => {
  const connectionId = c.get('connectionId');
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return c.json({ error: 'WEBHOOK_URL not configured' }, 500);

  try {
    const client = await getClientForConnection(connectionId);
    const result = await client.createWebhook({
      subscription_url: `${webhookUrl}/webhooks/pipedrive`,
      event_action: 'create',
      event_object: 'lead',
    });
    return c.json({ status: 'registered', result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default settings;
```

- [ ] **Step 4: Verify backend typechecks**

```bash
cd ~/git/pipeagent
pnpm --filter @pipeagent/server typecheck
```

This will still fail if the LangGraph nodes reference `settings` via `BusinessProfile` — that's fine, those nodes are updated in Phase B4 (Task 8). For now, isolate the errors to confirm they're only in the expected files (`fetchContext.ts`, `scoring.ts`, `outreach.ts`, `state.ts`).

If you see errors in files outside that list, investigate and fix before proceeding.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/server.ts apps/server/src/middleware/auth.ts apps/server/src/routes/settings.ts
git commit -m "feat(server): wire new routes, update JWT whitelist, strip ICP from settings"
```

---

## Phase B4 — LangGraph state refactor

### Task 8: Update `state.ts` and `fetchContext.ts` to snapshot identity

**Files:**
- Modify: `apps/server/src/agent/state.ts`
- Modify: `apps/server/src/agent/nodes/fetchContext.ts`

- [ ] **Step 1: Update `state.ts`**

Read `apps/server/src/agent/state.ts`. Find the annotation that stores `settings: BusinessProfile | null` (or similar). Replace it with two annotations:

```ts
import type { CompanyProfile, AgentIdentityRow } from '@pipeagent/shared';

// ... inside Annotation.Root({ ... }):

companyProfile: Annotation<CompanyProfile | null>({
  reducer: (_, n) => n,
  default: () => null,
}),
identity: Annotation<AgentIdentityRow | null>({
  reducer: (_, n) => n,
  default: () => null,
}),
```

Remove the old `settings` annotation entirely. Remove any `BusinessProfile` import.

- [ ] **Step 2: Update `fetchContext.ts`**

Read `apps/server/src/agent/nodes/fetchContext.ts`. It currently fetches `business_profiles` from Supabase. Replace the DB fetch with the new pair:

```ts
// Add near the top of the function, after Pipedrive entity fetches complete:

const [companyProfileResult, identityResult] = await Promise.all([
  getSupabase()
    .from('company_profile')
    .select('*')
    .eq('connection_id', connectionId)
    .maybeSingle(),
  getSupabase()
    .from('agent_identity')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('agent_id', 'lead-qualification')
    .maybeSingle(),
]);

const companyProfile = companyProfileResult.data ?? null;
const identity = identityResult.data ?? null;

await logActivity(runId, 'fetchContext', 'node_exit', {
  lead_title: lead?.title,
  org_name: organization?.name,
  has_company_profile: !!companyProfile,
  has_identity: !!identity,
});

return { lead, person, organization, companyProfile, identity };
```

Remove the old `settings` read and return value.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @pipeagent/server typecheck
```

Expected: errors remain in `scoring.ts` and `outreach.ts` (still reading `state.settings`). Those are fixed in Task 9.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/agent/state.ts apps/server/src/agent/nodes/fetchContext.ts
git commit -m "feat(agent): snapshot company_profile + agent_identity into state"
```

### Task 9: Update scoring/outreach/deal-coach to read from state

**Files:**
- Modify: `apps/server/src/agent/subagents/scoring.ts`
- Modify: `apps/server/src/agent/subagents/outreach.ts`
- Modify: `apps/server/src/agent/graph.ts`
- Modify: `apps/server/src/agents/deal-coach/nodes/fetchDealContext.ts`

- [ ] **Step 1: Update `graph.ts` to pass new state fields through**

Read `apps/server/src/agent/graph.ts`. Find `runScoring` and `runOutreach` wrapper functions. Update them:

```ts
async function runScoring(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { research, lead, runId, identity } = state;
  if (!research) return {};

  await logActivity(runId, 'scoring', 'node_enter');

  const icpCriteria = (identity?.config as { icp_criteria?: IcpCriterion[] } | undefined)?.icp_criteria ?? [];

  const result = await scoringSubgraph.invoke({
    research,
    leadTitle: lead?.title ?? 'Unknown Lead',
    runId,
    icpCriteria,
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
  const { research, scoring, label, lead, person, runId, companyProfile, identity } = state;
  if (!research || !scoring || !label) return {};

  await logActivity(runId, 'outreach', 'node_enter', { label });

  const result = await outreachSubgraph.invoke({
    research,
    scoring,
    label,
    leadTitle: lead?.title ?? 'Unknown Lead',
    personName: person?.name ?? null,
    businessDescription: companyProfile?.description ?? '',
    valueProposition: companyProfile?.value_proposition ?? '',
    outreachTone: identity?.personality ?? '',
    runId,
    draft: null,
  });

  return { emailDraft: result.draft };
}
```

- [ ] **Step 2: Update `logActivity.ts` to use `identity.config.followup_days`**

Read `apps/server/src/agent/nodes/logActivity.ts`. Find where it reads `followup_days` from state. Change:

```ts
// Before:
const followupDays = state.settings?.followup_days ?? 3;

// After:
const followupDays =
  (state.identity?.config as { followup_days?: number } | undefined)?.followup_days ?? 3;
```

- [ ] **Step 3: Update deal-coach `fetchDealContext.ts`**

Read `apps/server/src/agents/deal-coach/nodes/fetchDealContext.ts`. Find where it loads `business_profiles`, `hub_config`, or `agent_config`. Replace with:

```ts
const [companyProfileResult, identityResult] = await Promise.all([
  getSupabase()
    .from('company_profile')
    .select('*')
    .eq('connection_id', connectionId)
    .maybeSingle(),
  getSupabase()
    .from('agent_identity')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('agent_id', 'deal-coach')
    .maybeSingle(),
]);

const companyProfile = companyProfileResult.data ?? null;
const identity = identityResult.data ?? null;
```

And return them in the state update. If deal-coach has its own state type, extend it with `companyProfile` + `identity` annotations the same way Task 8 did for the lead-qualification state.

- [ ] **Step 4: Verify typecheck (server)**

```bash
pnpm --filter @pipeagent/server typecheck
```

Expected: clean now that all references to `settings` are gone.

- [ ] **Step 5: Verify dev boot**

```bash
pnpm --filter @pipeagent/server dev
```

Expected: server starts without errors. Hit `http://localhost:3001/company-profile` with an auth token (or watch logs for the startup message). Ctrl+C after confirming.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/agent/graph.ts apps/server/src/agent/nodes/logActivity.ts apps/server/src/agents/deal-coach/nodes/fetchDealContext.ts
git commit -m "feat(agent): read identity/company from state in scoring, outreach, logActivity, deal-coach"
```

---

## Phase B5 — Research streaming

### Task 10: Rewrite `research.ts` with `.stream()` and phase events

**Files:**
- Modify: `apps/server/src/agent/subagents/research.ts`

- [ ] **Step 1: Rewrite the research node to stream**

Replace the `researchAgent` function in `apps/server/src/agent/subagents/research.ts` with:

```ts
async function researchAgent(state: typeof ResearchState.State) {
  const { orgName, orgAddress, runId } = state;

  const prompt = `You are a company research analyst. Research the company "${orgName}"${orgAddress ? ` (address: ${orgAddress})` : ''}.

Find and report briefly (keep it tight — this is a demo):
1. What the company does (one sentence)
2. Approximate employee count
3. Industry/vertical

Use the web search tool sparingly. After gathering enough info, respond with a JSON block in this exact format:

\`\`\`json
{
  "company_description": "...",
  "employee_count": 150,
  "industry": "...",
  "funding_stage": null,
  "tech_stack": [],
  "recent_news": [],
  "website_url": null,
  "raw_summary": "..."
}
\`\`\``;

  await logActivity(runId, 'research', 'phase', { phase: 'opening' });

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
    messages: [{ role: 'user', content: prompt }],
  });

  let textBuffer = '';
  let lastEmit = Date.now();
  const EMIT_INTERVAL_MS = 200;

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        const query = (block.input as { query?: string } | undefined)?.query ?? '';
        await logActivity(runId, 'research', 'phase', { phase: 'searching', query });
      } else if (block.type === 'web_search_tool_result') {
        await logActivity(runId, 'research', 'phase', { phase: 'reading' });
      } else if (block.type === 'text') {
        await logActivity(runId, 'research', 'phase', { phase: 'writing' });
      }
    } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      textBuffer += event.delta.text;
      if (Date.now() - lastEmit > EMIT_INTERVAL_MS) {
        await logActivity(runId, 'research', 'token', { partial: textBuffer });
        lastEmit = Date.now();
      }
    }
  }

  // Final token flush
  if (textBuffer.length > 0) {
    await logActivity(runId, 'research', 'token', { partial: textBuffer });
  }

  // Wait for the stream to fully finish and get the final message
  const finalMessage = await stream.finalMessage();

  const textContent = finalMessage.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  await logActivity(runId, 'research', 'phase', { phase: 'done' });
  await logActivity(runId, 'research', 'node_exit', {
    response_preview: textContent.slice(0, 300),
    stop_reason: finalMessage.stop_reason,
  });

  // Extract the JSON block
  const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as ResearchData;
      return { result: parsed };
    } catch {
      // Fall through
    }
  }

  return {
    result: {
      company_description: textContent.slice(0, 500),
      employee_count: null,
      industry: null,
      funding_stage: null,
      tech_stack: [],
      recent_news: [],
      website_url: null,
      raw_summary: textContent,
    } satisfies ResearchData,
  };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @pipeagent/server typecheck
```

Expected: clean. If `stream.finalMessage()` has a type error, check the Anthropic SDK version — update to latest if needed (`pnpm --filter @pipeagent/server add @anthropic-ai/sdk@latest`).

- [ ] **Step 3: Verify at runtime (manual)**

Start the server. Fire a test webhook via `pd-helpers` (or the existing webhook test harness) that triggers the graph. Watch the server logs and Supabase's `activity_logs` table:

```sql
SELECT event_type, payload, created_at
FROM activity_logs
WHERE run_id = '<your-run-id>' AND node_name = 'research'
ORDER BY created_at;
```

Expected rows:
1. `phase {phase: "opening"}`
2. `phase {phase: "searching", query: "..."}` (one or two times)
3. `phase {phase: "reading"}`
4. `phase {phase: "writing"}`
5. Several `token {partial: "..."}` rows with increasing content
6. `phase {phase: "done"}`
7. `node_exit {response_preview, stop_reason}`

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/agent/subagents/research.ts
git commit -m "feat(agent): stream research with phase + token events"
```

---

## Phase B6 — Frontend visual foundation

### Task 11: Install `lucide-react` and create `AgentIcon` component

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/components/AgentIcon.tsx`

- [ ] **Step 1: Install**

```bash
cd ~/git/pipeagent
pnpm --filter @pipeagent/web add lucide-react
```

- [ ] **Step 2: Create `AgentIcon.tsx`**

Create `apps/web/src/components/AgentIcon.tsx`:

```tsx
import {
  UserSearch,
  TrendingUp,
  Calendar,
  Mail,
  Database,
  Sparkles,
  LineChart,
  type LucideIcon,
} from 'lucide-react';

// Whitelist of allowed icons. Referenced by string key from packages/shared AgentMeta.icon.
const ICON_MAP = {
  UserSearch,
  TrendingUp,
  Calendar,
  Mail,
  Database,
  Sparkles,
  LineChart,
} as const satisfies Record<string, LucideIcon>;

export type LucideIconName = keyof typeof ICON_MAP;

export function AgentIcon({
  name,
  size = 20,
  className,
  strokeWidth = 2,
}: {
  name: LucideIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter @pipeagent/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/components/AgentIcon.tsx pnpm-lock.yaml
git commit -m "feat(web): add lucide-react and AgentIcon whitelist component"
```

### Task 12: Update Tailwind theme tokens

**Files:**
- Modify: `apps/web/src/main.css` (or wherever `@theme` / Tailwind tokens live)

- [ ] **Step 1: Read current theme file**

```bash
# Most likely locations:
cat apps/web/src/main.css 2>/dev/null || \
cat apps/web/src/index.css 2>/dev/null || \
cat apps/web/src/styles/globals.css 2>/dev/null
```

- [ ] **Step 2: Add/replace theme tokens**

Tailwind 4 uses `@theme` block in CSS. Add or merge into the existing file:

```css
@theme {
  /* Pipedrive-style palette */
  --color-page: #f5f7fa;
  --color-card: #ffffff;
  --color-border-default: #e4e9ef;
  --color-border-subtle: #f0f3f7;
  --color-text-primary: #192435;
  --color-text-secondary: #5c6b7f;
  --color-text-tertiary: #8595a8;
  --color-primary-dark: #017737;
  --color-primary-bright: #26b67c;
  --color-accent-warm-start: #f9a825;
  --color-accent-warm-end: #ef6c00;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;

  --shadow-hover: 0 4px 12px rgba(25, 36, 53, 0.06);
}

/* Body/app-level defaults */
body {
  background-color: var(--color-page);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}
```

- [ ] **Step 3: Verify dev boot**

```bash
pnpm --filter @pipeagent/web dev
```

Expected: Vite dev server starts. Open `http://localhost:5173` — the page may look ugly right now (other components still target dark theme), but it should render without console errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/main.css  # adjust path if different
git commit -m "feat(web): add Pipedrive-style theme tokens"
```

### Task 13: Restyle `HubShell`, `Sidebar`, `TopBar`

**Files:**
- Modify: `apps/web/src/components/HubShell.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/TopBar.tsx`

- [ ] **Step 1: Update `HubShell.tsx`**

Read current `apps/web/src/components/HubShell.tsx`. Find the root container's classes. Replace dark-theme classes with light-theme equivalents:

```tsx
// Before (example):
<div className="min-h-screen bg-[#0f1420] text-[#a8b1b8]">

// After:
<div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text-primary)]">
```

Remove any dark-theme branching logic that swaps backgrounds based on route. Light theme everywhere.

- [ ] **Step 2: Update `TopBar.tsx`**

Find the header element. Replace dark backgrounds with white card background + border:

```tsx
<header className="flex items-center justify-between h-12 px-4 bg-[var(--color-card)] border-b border-[var(--color-border-default)] flex-shrink-0">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary-bright)] to-[var(--color-primary-dark)] flex items-center justify-center text-white font-bold text-sm">
      P
    </div>
    <span className="font-semibold text-[var(--color-text-primary)]">Agent Hub</span>
  </div>
  <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
    {/* Pipedrive domain + user avatar as before, restyled */}
  </div>
</header>
```

- [ ] **Step 3: Update `Sidebar.tsx`**

Find the sidebar container and nav links. Replace dark colors with light-theme ones:

```tsx
<aside className="bg-[var(--color-card)] border-r border-[var(--color-border-default)] ...">
  {navItems.map((item) => (
    <Link
      to={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded text-sm",
        "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]",
        isActive(item.href) && "bg-[#f0faf5] text-[var(--color-primary-dark)] border-l-2 border-[var(--color-primary-dark)]",
      )}
    >
      <AgentIcon name={item.icon as LucideIconName} size={18} />
      <span>{item.label}</span>
    </Link>
  ))}
</aside>
```

Where emoji icons currently appear, replace with `<AgentIcon name="..." size={18} />` — pick matching icons from the whitelist. "Home" can use `'LineChart'` as a placeholder or add `'Home'` to the whitelist in AgentIcon.tsx.

If you add `Home` to the whitelist, update `AgentIcon.tsx` as well to import and include it.

- [ ] **Step 4: Verify dev boot + visual check**

```bash
pnpm --filter @pipeagent/web dev
```

Open the browser. The TopBar, Sidebar, and HubShell should now be light-themed. Content inside may still be dark (individual pages not yet restyled).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/HubShell.tsx apps/web/src/components/Sidebar.tsx apps/web/src/components/TopBar.tsx apps/web/src/components/AgentIcon.tsx
git commit -m "feat(web): restyle HubShell, Sidebar, TopBar to Pipedrive light theme"
```

### Task 14: Restyle `LoginPage`

**Files:**
- Modify: `apps/web/src/pages/LoginPage.tsx`

- [ ] **Step 1: Read and restyle**

Read `apps/web/src/pages/LoginPage.tsx`. Replace dark classes with light ones:

```tsx
<div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-4">
  <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-xl p-8 max-w-md w-full shadow-sm">
    {/* Keep existing logo + heading + login CTA, restyled */}
    <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Agent Hub</h1>
    <p className="text-[var(--color-text-secondary)] mb-6">Sign in with Pipedrive to continue</p>
    <button
      onClick={handleLogin}
      className="w-full py-3 rounded-md bg-[var(--color-primary-dark)] text-white font-semibold hover:bg-[var(--color-primary-bright)]"
    >
      Connect Pipedrive
    </button>
  </div>
</div>
```

- [ ] **Step 2: Verify in browser**

Reload the login page. Should be light-themed with a green CTA button.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/LoginPage.tsx
git commit -m "feat(web): restyle LoginPage with light theme"
```

---

## Phase B7 — Shared frontend components

### Task 15: Create `AgentAvatar`

**Files:**
- Create: `apps/web/src/components/AgentAvatar.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/AgentAvatar.tsx`:

```tsx
export const AVATAR_PALETTE = [
  { start: '#26b67c', end: '#017737' }, // Pipedrive green — Nora default
  { start: '#f9a825', end: '#ef6c00' }, // warm amber — Dex default
  { start: '#6366f1', end: '#4338ca' }, // indigo
  { start: '#ec4899', end: '#be185d' }, // pink
  { start: '#06b6d4', end: '#0e7490' }, // cyan
  { start: '#8b5cf6', end: '#6d28d9' }, // violet
] as const;

export type AvatarPaletteIndex = 0 | 1 | 2 | 3 | 4 | 5;

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export function AgentAvatar({
  name,
  paletteIndex = 0,
  size = 48,
  onClick,
  className,
}: {
  name: string;
  paletteIndex?: number;
  size?: number;
  onClick?: () => void;
  className?: string;
}) {
  const palette = AVATAR_PALETTE[paletteIndex] ?? AVATAR_PALETTE[0];
  const style = {
    width: size,
    height: size,
    background: `linear-gradient(135deg, ${palette.start}, ${palette.end})`,
    boxShadow: '0 0 0 2px #e4e9ef, 0 0 0 4px #ffffff',
    fontSize: size * 0.36,
    cursor: onClick ? 'pointer' : 'default',
  };
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold ${className ?? ''}`}
      style={style}
      onClick={onClick}
    >
      {getInitial(name)}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @pipeagent/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AgentAvatar.tsx
git commit -m "feat(web): add AgentAvatar with 6-entry gradient palette"
```

### Task 16: Create `useCompanyProfile` and `useAgentIdentity` hooks

**Files:**
- Create: `apps/web/src/hooks/useCompanyProfile.ts`
- Create: `apps/web/src/hooks/useAgentIdentity.ts`
- Delete: `apps/web/src/hooks/useSettings.ts` (if it exists — confirm first)

- [ ] **Step 1: Inspect the API layer**

```bash
cat apps/web/src/lib/api.ts
```

Understand the existing fetch wrapper. It probably has a `apiRequest<T>()` helper that attaches the JWT from localStorage. Reuse it.

- [ ] **Step 2: Write `useCompanyProfile.ts`**

Create `apps/web/src/hooks/useCompanyProfile.ts`:

```ts
import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api.js';
import type { CompanyProfile } from '@pipeagent/shared';

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ profile: CompanyProfile }>('/company-profile');
      setProfile(res.profile);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (updates: Partial<CompanyProfile>) => {
      const res = await apiRequest<{ profile: CompanyProfile }>('/company-profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setProfile(res.profile);
      return res.profile;
    },
    [],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, loading, error, refetch, save };
}
```

- [ ] **Step 3: Write `useAgentIdentity.ts`**

Create `apps/web/src/hooks/useAgentIdentity.ts`:

```ts
import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api.js';
import type { AgentIdentityRow, AgentId } from '@pipeagent/shared';
import { AGENT_REGISTRY } from '../agents/registry.js';

// Merge DB row with registry defaults so UI always has something to show
function mergeWithDefaults(agentId: AgentId, row: AgentIdentityRow): AgentIdentityRow {
  const defaults = AGENT_REGISTRY[agentId]?.defaultIdentity;
  return {
    ...row,
    name: row.name || defaults?.name || '',
    mission: row.mission || defaults?.mission || '',
    personality: row.personality || defaults?.personality || '',
  };
}

export function useAgentIdentity(agentId: AgentId) {
  const [identity, setIdentity] = useState<AgentIdentityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ identity: AgentIdentityRow }>(
        `/agent-identity/${agentId}`,
      );
      setIdentity(mergeWithDefaults(agentId, res.identity));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load identity');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const save = useCallback(
    async (updates: Partial<AgentIdentityRow>) => {
      const res = await apiRequest<{ identity: AgentIdentityRow }>(
        `/agent-identity/${agentId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        },
      );
      const merged = mergeWithDefaults(agentId, res.identity);
      setIdentity(merged);
      return merged;
    },
    [agentId],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { identity, loading, error, refetch, save };
}
```

- [ ] **Step 4: Delete old `useSettings.ts` if present**

```bash
if [ -f apps/web/src/hooks/useSettings.ts ]; then rm apps/web/src/hooks/useSettings.ts; fi
```

- [ ] **Step 5: Find and replace old callsites**

```bash
grep -rn "useSettings" apps/web/src/
```

Each callsite currently using `useSettings` needs to be updated. Most likely locations:
- `apps/web/src/agents/lead-qualification/Workspace.tsx` — will be fully rewritten in Task 20
- `apps/web/src/pages/Settings.tsx` — will be updated in Task 24

For now, comment out any broken imports — later tasks will fix them.

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --filter @pipeagent/web typecheck
```

Expected: errors remain in `Workspace.tsx` and `Settings.tsx` and `Home.tsx` — all will be rewritten in later tasks. Note the error files so you know what to expect.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/hooks/useCompanyProfile.ts apps/web/src/hooks/useAgentIdentity.ts
git rm -f apps/web/src/hooks/useSettings.ts || true
git commit -m "feat(web): add useCompanyProfile and useAgentIdentity hooks"
```

### Task 17: Create `CompanyProfileEditor` and `IcpEditor` modals

**Files:**
- Create: `apps/web/src/components/CompanyProfileEditor.tsx`
- Create: `apps/web/src/agents/lead-qualification/components/IcpEditor.tsx`

- [ ] **Step 1: Write `CompanyProfileEditor.tsx`**

Create `apps/web/src/components/CompanyProfileEditor.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useCompanyProfile } from '../hooks/useCompanyProfile.js';

export function CompanyProfileEditor({ onClose }: { onClose: () => void }) {
  const { profile, loading, save } = useCompanyProfile();
  const [form, setForm] = useState({
    name: '',
    description: '',
    value_proposition: '',
    service_area: '',
    extra_context: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        description: profile.description,
        value_proposition: profile.value_proposition,
        service_area: profile.service_area,
        extra_context: profile.extra_context,
      });
    }
  }, [profile]);

  const onSave = async () => {
    setSaving(true);
    try {
      await save(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Company Profile</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
          Shared by every agent on the hub. Updates apply to the next run.
        </p>

        {loading ? (
          <div className="text-[var(--color-text-secondary)]">Loading…</div>
        ) : (
          <div className="space-y-4">
            <Field
              label="Company name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="NordLight Solar"
            />
            <Field
              label="Description (one line)"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              placeholder="Rooftop solar installations across Estonia"
              multiline
            />
            <Field
              label="Value proposition"
              value={form.value_proposition}
              onChange={(v) => setForm({ ...form, value_proposition: v })}
              placeholder="What you sell and why it matters"
              multiline
            />
            <Field
              label="Service area"
              value={form.service_area}
              onChange={(v) => setForm({ ...form, service_area: v })}
              placeholder="Tallinn, Tartu, Pärnu"
            />
            <Field
              label="Extra context (free-form)"
              value={form.extra_context}
              onChange={(v) => setForm({ ...form, extra_context: v })}
              placeholder="Anything else every agent should know"
              multiline
              large
            />
          </div>
        )}

        <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-2 rounded bg-[var(--color-primary-dark)] text-white font-semibold hover:bg-[var(--color-primary-bright)] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  large = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  large?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={large ? 5 : 2}
          className="w-full px-3 py-2 rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-dark)]/20"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-dark)]/20"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `IcpEditor.tsx`**

Create `apps/web/src/agents/lead-qualification/components/IcpEditor.tsx`:

```tsx
import { useState } from 'react';
import type { IcpCriterion } from '@pipeagent/shared';

export function IcpEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: IcpCriterion[];
  onSave: (criteria: IcpCriterion[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<IcpCriterion[]>(initial);

  const update = (i: number, patch: Partial<IcpCriterion>) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const remove = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  const add = () =>
    setRows([...rows, { name: '', description: '', weight: 10 }]);

  const total = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
          Manage ICP criteria
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
          Each criterion is scored 0–10 by the agent. Weights determine how much it contributes to
          the overall score.
        </p>

        <div className="grid grid-cols-[1.2fr_2fr_80px_32px] gap-3 text-xs uppercase tracking-wide font-semibold text-[var(--color-text-tertiary)] mb-2">
          <div>Name</div>
          <div>Description</div>
          <div className="text-center">Weight</div>
          <div />
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1.2fr_2fr_80px_32px] gap-3 items-center">
              <input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Criterion name"
                className="px-3 py-2 rounded border border-[var(--color-border-default)] focus:border-[var(--color-primary-dark)] focus:outline-none"
              />
              <input
                value={row.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="Description"
                className="px-3 py-2 rounded border border-[var(--color-border-default)] focus:border-[var(--color-primary-dark)] focus:outline-none"
              />
              <input
                type="number"
                value={row.weight}
                onChange={(e) => update(i, { weight: Number(e.target.value) })}
                className="px-3 py-2 rounded border border-[var(--color-border-default)] text-center focus:border-[var(--color-primary-dark)] focus:outline-none"
              />
              <button
                onClick={() => remove(i)}
                className="text-[var(--color-text-tertiary)] hover:text-red-500 text-xl"
                aria-label="Remove criterion"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={add}
          className="w-full mt-3 py-2 border border-dashed border-[var(--color-border-default)] rounded text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)]"
        >
          + Add criterion
        </button>

        <div className="text-right text-xs text-[var(--color-text-tertiary)] mt-2">
          Total weight · {total}
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(rows)}
            className="flex-1 py-2 rounded bg-[var(--color-primary-dark)] text-white font-semibold hover:bg-[var(--color-primary-bright)]"
          >
            Save criteria
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter @pipeagent/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/CompanyProfileEditor.tsx apps/web/src/agents/lead-qualification/components/IcpEditor.tsx
git commit -m "feat(web): add CompanyProfileEditor and IcpEditor modals"
```

---

## Phase B8 — Lead Qualification workspace

### Task 18: Create `IdentityRail` + `IdentityEditor`

**Files:**
- Create: `apps/web/src/agents/lead-qualification/components/IdentityRail.tsx`

- [ ] **Step 1: Write `IdentityRail.tsx`** — this file houses both the read-only rail and the in-place edit mode, switched by local state.

Create `apps/web/src/agents/lead-qualification/components/IdentityRail.tsx`:

```tsx
import { useState } from 'react';
import { useAgentIdentity } from '../../../hooks/useAgentIdentity.js';
import { useCompanyProfile } from '../../../hooks/useCompanyProfile.js';
import { AGENT_REGISTRY } from '../../registry.js';
import { AgentAvatar, AVATAR_PALETTE } from '../../../components/AgentAvatar.js';
import { IcpEditor } from './IcpEditor.js';
import { CompanyProfileEditor } from '../../../components/CompanyProfileEditor.js';
import type { IcpCriterion, LeadQualificationConfig } from '@pipeagent/shared';

const AGENT_ID = 'lead-qualification' as const;

export function IdentityRail() {
  const { identity, loading, save } = useAgentIdentity(AGENT_ID);
  const { profile } = useCompanyProfile();
  const [editMode, setEditMode] = useState(false);
  const [showIcp, setShowIcp] = useState(false);
  const [showCompany, setShowCompany] = useState(false);

  const meta = AGENT_REGISTRY[AGENT_ID];
  const config = (identity?.config ?? {}) as LeadQualificationConfig;
  const criteria: IcpCriterion[] = config.icp_criteria ?? [];

  if (loading || !identity) {
    return (
      <aside className="w-[300px] bg-[#f0faf5] border border-[var(--color-primary-dark)] rounded-lg p-4">
        <div className="text-[var(--color-text-secondary)]">Loading identity…</div>
      </aside>
    );
  }

  return (
    <>
      <aside className="w-[300px] bg-[#f0faf5] border border-[var(--color-primary-dark)] rounded-lg p-4 flex flex-col">
        <AgentAvatar name={identity.name || meta.defaultIdentity.name} size={56} />
        <div className="text-center font-bold text-[var(--color-text-primary)] mt-2">
          {identity.name || meta.defaultIdentity.name}
        </div>
        <div className="text-center text-xs text-[var(--color-text-tertiary)] mb-3">
          {meta.role} · {profile?.name || 'Your company'}
        </div>

        <button
          onClick={() => setShowCompany(true)}
          className="w-full flex items-center justify-between px-2 py-1.5 mb-3 bg-indigo-50 border border-indigo-200 rounded text-xs text-[var(--color-text-secondary)] hover:border-indigo-400"
        >
          <span>
            Company: <strong className="text-[var(--color-text-primary)]">{profile?.name || 'Set up'}</strong>
          </span>
          <span>→</span>
        </button>

        {editMode ? (
          <IdentityEditForm
            identity={identity}
            meta={meta}
            onManageIcp={() => setShowIcp(true)}
            onSave={async (updates) => {
              await save(updates);
              setEditMode(false);
            }}
            onCancel={() => setEditMode(false)}
          />
        ) : (
          <IdentityReadOnly
            identity={identity}
            meta={meta}
            criteriaCount={criteria.length}
            totalWeight={criteria.reduce((s, c) => s + (c.weight || 0), 0)}
            onEdit={() => setEditMode(true)}
          />
        )}
      </aside>

      {showIcp && (
        <IcpEditor
          initial={criteria}
          onClose={() => setShowIcp(false)}
          onSave={async (next) => {
            await save({
              config: { ...config, icp_criteria: next },
            });
            setShowIcp(false);
          }}
        />
      )}

      {showCompany && <CompanyProfileEditor onClose={() => setShowCompany(false)} />}
    </>
  );
}

function IdentityReadOnly({
  identity,
  meta,
  criteriaCount,
  totalWeight,
  onEdit,
}: {
  identity: ReturnType<typeof useAgentIdentity>['identity'];
  meta: (typeof AGENT_REGISTRY)[typeof AGENT_ID];
  criteriaCount: number;
  totalWeight: number;
  onEdit: () => void;
}) {
  if (!identity) return null;
  return (
    <div className="flex flex-col gap-3 text-xs">
      <Section title="The Job" badge="🔒 defined by agent type">
        <Field label="Role" value={meta.role} locked />
        <Field label="What I own" value={meta.scopeIn} locked />
        <Field label="What I don't touch" value={meta.scopeOut} locked />
      </Section>

      <Section title="Your Shape" badge="✎ yours to edit">
        <Field label="Mission" value={identity.mission || meta.defaultIdentity.mission} />
        <Field label="Personality" value={identity.personality || meta.defaultIdentity.personality} />
        <Field label="ICP criteria" value={`${criteriaCount} criteria, total weight ${totalWeight}`} />
        {identity.rulebook && <Field label="Rulebook" value={identity.rulebook} />}
      </Section>

      <button
        onClick={onEdit}
        className="mt-auto py-2 border border-dashed border-[var(--color-border-default)] rounded text-[var(--color-text-secondary)] text-xs hover:border-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)]"
      >
        ✎ Edit identity
      </button>
    </div>
  );
}

function IdentityEditForm({
  identity,
  meta,
  onManageIcp,
  onSave,
  onCancel,
}: {
  identity: ReturnType<typeof useAgentIdentity>['identity'];
  meta: (typeof AGENT_REGISTRY)[typeof AGENT_ID];
  onManageIcp: () => void;
  onSave: (updates: { name: string; mission: string; personality: string; rulebook: string }) => Promise<void>;
  onCancel: () => void;
}) {
  if (!identity) return null;
  const [form, setForm] = useState({
    name: identity.name || meta.defaultIdentity.name,
    mission: identity.mission || meta.defaultIdentity.mission,
    personality: identity.personality || meta.defaultIdentity.personality,
    rulebook: identity.rulebook,
  });

  return (
    <div className="flex flex-col gap-2 text-xs">
      <Section title="The Job" badge="🔒 defined by agent type">
        <Field label="Role" value={meta.role} locked />
        <Field label="What I own" value={meta.scopeIn} locked />
        <Field label="What I don't touch" value={meta.scopeOut} locked />
      </Section>

      <Section title="Your Shape" badge="✎ yours to edit">
        <EditField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <EditField label="Mission" value={form.mission} onChange={(v) => setForm({ ...form, mission: v })} multiline />
        <EditField label="Personality" value={form.personality} onChange={(v) => setForm({ ...form, personality: v })} multiline />

        <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mt-2">
          ICP criteria
        </label>
        <button
          onClick={onManageIcp}
          className="w-full flex items-center justify-between px-2 py-1.5 bg-white border border-[var(--color-border-default)] rounded text-xs hover:border-[var(--color-primary-dark)]"
        >
          <span className="text-[var(--color-text-primary)]">Manage →</span>
        </button>

        <EditField label="Rulebook" value={form.rulebook} onChange={(v) => setForm({ ...form, rulebook: v })} multiline large />
      </Section>

      <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--color-primary-dark)]/20">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-xs"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          className="flex-1 py-1.5 rounded bg-[var(--color-primary-dark)] text-white font-semibold text-xs"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="pb-3 border-b border-dashed border-[var(--color-primary-dark)]/25">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-primary)]">
          {title}
        </div>
        <div className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]">
          {badge}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, locked = false }: { label: string; value: string; locked?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{label}</div>
      <div
        className={`text-[11px] leading-snug px-2 py-1 rounded ${
          locked
            ? 'italic text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)]/50'
            : 'text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  multiline = false,
  large = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  large?: boolean;
}) {
  const common = 'w-full px-2 py-1 text-[11px] rounded border border-[var(--color-border-default)] focus:border-[var(--color-primary-dark)] focus:outline-none';
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {label}
      </label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={large ? 3 : 2} className={common} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={common} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @pipeagent/web typecheck
```

Errors remain in `Workspace.tsx` and `Home.tsx` — expected.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/agents/lead-qualification/components/IdentityRail.tsx
git commit -m "feat(web): add IdentityRail with structural/editable split and in-place edit"
```

### Task 19: Create `ActivityStream`

**Files:**
- Create: `apps/web/src/agents/lead-qualification/components/ActivityStream.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/src/agents/lead-qualification/components/ActivityStream.tsx`:

```tsx
import { useMemo } from 'react';
import type { ActivityLogRow } from '@pipeagent/shared';
import { AgentAvatar } from '../../../components/AgentAvatar.js';

const NODES_ORDER: Array<{ key: string; verb: string }> = [
  { key: 'fetchContext', verb: 'opened the lead' },
  { key: 'checkMemory', verb: 'checked memory' },
  { key: 'research', verb: 'researching the web' },
  { key: 'scoring', verb: 'scoring against ICP' },
  { key: 'writeBack', verb: 'writing back to Pipedrive' },
  { key: 'outreach', verb: 'drafting outreach' },
];

type StepState = 'future' | 'active' | 'done';

type Step = {
  key: string;
  verb: string;
  state: StepState;
  phase?: string;
  query?: string;
  partial?: string;
  summary?: string;
  time?: string;
};

function buildSteps(logs: ActivityLogRow[], agentName: string): Step[] {
  // Initialize all steps as future
  const steps: Step[] = NODES_ORDER.map((n) => ({ ...n, state: 'future' }));

  // Walk through logs and update each step's state
  for (const log of logs) {
    const i = steps.findIndex((s) => s.key === log.node_name);
    if (i === -1) continue;
    const step = steps[i];
    if (!step) continue;

    if (log.event_type === 'node_enter') {
      step.state = 'active';
      step.time = log.created_at;
    } else if (log.event_type === 'node_exit') {
      step.state = 'done';
      step.time = log.created_at;
      // Pull a short summary from the payload
      const payload = log.payload as Record<string, unknown>;
      if (step.key === 'fetchContext') {
        step.summary = [payload.lead_title, payload.org_name].filter(Boolean).join(' · ') as string;
      } else if (step.key === 'checkMemory') {
        step.summary = payload.fresh ? 'Using cached research' : 'No cached research';
      } else if (step.key === 'research') {
        step.summary = [payload.industry, payload.employee_count && `~${payload.employee_count} employees`]
          .filter(Boolean)
          .join(' · ') as string;
      } else if (step.key === 'outreach') {
        step.summary = `Subject: "${payload.subject ?? ''}"`;
      }
    } else if (log.event_type === 'phase' && log.node_name === 'research') {
      step.state = 'active';
      const payload = log.payload as Record<string, unknown>;
      step.phase = (payload.phase as string) ?? undefined;
      step.query = (payload.query as string) ?? undefined;
    } else if (log.event_type === 'token' && log.node_name === 'research') {
      step.state = 'active';
      const payload = log.payload as Record<string, unknown>;
      step.partial = payload.partial as string;
    } else if (log.event_type === 'decision' && log.node_name === 'scoring') {
      step.state = 'done';
      const payload = log.payload as Record<string, unknown>;
      step.summary = `Score: ${payload.score} → ${String(payload.label ?? '').toUpperCase()}`;
    }
  }

  return steps;
}

export function ActivityStream({
  agentName,
  leadTitle,
  logs,
}: {
  agentName: string;
  leadTitle: string;
  logs: ActivityLogRow[];
}) {
  const steps = useMemo(() => buildSteps(logs, agentName), [logs, agentName]);

  return (
    <div className="flex-1 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-4 overflow-y-auto">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-3">
        {agentName} is working on · <span className="text-[var(--color-text-primary)]">{leadTitle}</span>
      </div>

      {steps.map((step) => (
        <StepCard key={step.key} step={step} agentName={agentName} />
      ))}
    </div>
  );
}

function StepCard({ step, agentName }: { step: Step; agentName: string }) {
  const borderColor =
    step.state === 'done'
      ? 'border-l-green-500'
      : step.state === 'active'
      ? 'border-l-indigo-500'
      : 'border-l-[var(--color-border-default)] opacity-40';

  const bg = step.state === 'active' ? 'bg-indigo-50/50' : 'bg-[var(--color-border-subtle)]/40';

  return (
    <div className={`mb-2.5 p-2.5 rounded border-l-2 ${borderColor} ${bg}`}>
      <div className="flex items-center text-[var(--color-text-primary)] mb-1">
        <AgentAvatar name={agentName} size={20} className="mr-2" />
        <strong className="font-semibold mr-1.5 text-xs">{agentName}</strong>
        <span className="text-[var(--color-text-secondary)] text-xs">{step.verb}</span>
        {step.state === 'active' && <span className="ml-2 inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
      </div>

      {step.state === 'active' && step.phase && (
        <div className="pl-[26px] text-[11px] text-[var(--color-text-secondary)] italic">
          {step.phase === 'opening' && 'Opening research…'}
          {step.phase === 'searching' && `Searching: "${step.query ?? ''}"`}
          {step.phase === 'reading' && 'Reading results…'}
          {step.phase === 'writing' && 'Summarizing findings…'}
          {step.phase === 'done' && 'Finished research'}
        </div>
      )}

      {step.state === 'active' && step.partial && (
        <div className="pl-[26px] text-[11px] text-[var(--color-text-secondary)] mt-1 italic whitespace-pre-wrap line-clamp-6">
          {step.partial}
        </div>
      )}

      {step.state === 'done' && step.summary && (
        <div className="pl-[26px] text-[11px] text-[var(--color-text-secondary)]">{step.summary}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @pipeagent/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/agents/lead-qualification/components/ActivityStream.tsx
git commit -m "feat(web): add ActivityStream with phase + token rendering"
```

### Task 20: Create `InboxStrip`

**Files:**
- Create: `apps/web/src/agents/lead-qualification/components/InboxStrip.tsx`

- [ ] **Step 1: Read existing `LeadsList.tsx`**

```bash
cat apps/web/src/agents/lead-qualification/components/LeadsList.tsx
```

Understand what data it receives (probably a leads array + runs + selection handler).

- [ ] **Step 2: Write `InboxStrip.tsx`**

Create `apps/web/src/agents/lead-qualification/components/InboxStrip.tsx`:

```tsx
import type { PipedriveLead, AgentRunRow } from '@pipeagent/shared';

export function InboxStrip({
  leads,
  runs,
  selectedLeadId,
  onSelect,
}: {
  leads: PipedriveLead[];
  runs: AgentRunRow[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
}) {
  const runByLead = new Map(runs.map((r) => [r.lead_id, r]));

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg overflow-x-auto flex-shrink-0">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mr-2 flex-shrink-0">
        Inbox
      </span>

      {leads.length === 0 && (
        <span className="text-xs text-[var(--color-text-tertiary)] italic">
          No leads. Run <code className="font-mono">pd-seed</code> to drop one in.
        </span>
      )}

      {leads.map((lead) => {
        const run = runByLead.get(String(lead.id));
        const isSelected = String(lead.id) === selectedLeadId;
        const isRunning = run?.status === 'running';
        return (
          <button
            key={lead.id}
            onClick={() => onSelect(String(lead.id))}
            className={`min-w-[160px] flex-shrink-0 text-left px-2.5 py-1.5 rounded border text-xs transition ${
              isSelected
                ? 'border-[var(--color-primary-dark)] bg-[#f0faf5]'
                : 'border-[var(--color-border-default)] hover:border-[var(--color-primary-bright)]'
            }`}
          >
            <div className="text-[var(--color-text-primary)] font-medium truncate">{lead.title}</div>
            <div className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1 mt-0.5">
              {isRunning && <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
              {run?.status ?? 'idle'}
              {run?.score !== null && run?.score !== undefined && ` · ${run.score}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/agents/lead-qualification/components/InboxStrip.tsx
git commit -m "feat(web): add InboxStrip replacing vertical LeadsList"
```

### Task 21: Update `useSupabaseRealtime` for phase + token events

**Files:**
- Modify: `apps/web/src/hooks/useSupabaseRealtime.ts`

- [ ] **Step 1: Read the current hook**

```bash
cat apps/web/src/hooks/useSupabaseRealtime.ts
```

Find the `useActivityLogs` function. It currently subscribes to INSERT events on `activity_logs`.

- [ ] **Step 2: Confirm phase and token events pass through unchanged**

Good news: `activity_logs` has a loose `payload JSONB` column, so new event types (`phase`, `token`) don't require schema changes. The hook already forwards all INSERT rows to consumers. No changes needed in the hook itself.

However, if the hook currently **filters** events by `event_type` (e.g., only `node_enter` / `node_exit` / `decision`), remove that filter so all events flow through. The `ActivityStream` component decides how to render each type.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @pipeagent/web typecheck
```

- [ ] **Step 4: Commit (only if changes were made)**

```bash
git diff --stat apps/web/src/hooks/useSupabaseRealtime.ts
# If diff is non-empty:
git add apps/web/src/hooks/useSupabaseRealtime.ts
git commit -m "feat(web): forward phase + token events through useActivityLogs"
```

### Task 22: Rewrite Lead Qualification Workspace

**Files:**
- Rewrite: `apps/web/src/agents/lead-qualification/Workspace.tsx`

- [ ] **Step 1: Read existing workspace**

```bash
cat apps/web/src/agents/lead-qualification/Workspace.tsx
```

Note: the hooks it currently uses for leads, runs, logs, email draft. You'll keep these.

- [ ] **Step 2: Rewrite the file**

Replace the entire contents with:

```tsx
import { useState } from 'react';
import { useAgentRuns, useActivityLogs, useEmailDraft } from '../../hooks/useSupabaseRealtime.js';
import { useAgentIdentity } from '../../hooks/useAgentIdentity.js';
import { useLeads } from '../../hooks/useLeads.js'; // adapt to whatever hook name currently exists
import { IdentityRail } from './components/IdentityRail.js';
import { ActivityStream } from './components/ActivityStream.js';
import { InboxStrip } from './components/InboxStrip.js';
import { EmailDraftBar } from './components/EmailDraftBar.js';
import type { AgentRunRow } from '@pipeagent/shared';

const AGENT_ID = 'lead-qualification' as const;

export function LeadQualificationWorkspace({ connectionId }: { connectionId: string }) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { identity } = useAgentIdentity(AGENT_ID);
  const { runs } = useAgentRuns(connectionId);
  const { leads } = useLeads(connectionId); // adapt
  const selectedRun: AgentRunRow | undefined = runs.find((r) => r.lead_id === selectedLeadId);
  const { logs } = useActivityLogs(selectedRun?.id ?? null);
  const { draft } = useEmailDraft(selectedRun?.id ?? null);

  const agentName = identity?.name || 'Nora';
  const selectedLead = leads.find((l) => String(l.id) === selectedLeadId);
  const leadTitle = selectedLead?.title ?? 'No lead selected';

  return (
    <div className="flex flex-col h-full gap-2 p-3">
      <div className="flex gap-2 flex-1 min-h-0">
        <IdentityRail />

        <div className="flex flex-1 min-h-0">
          {selectedRun ? (
            <ActivityStream agentName={agentName} leadTitle={leadTitle} logs={logs} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)] text-sm">
              Select a lead from the inbox below
            </div>
          )}
        </div>

        <div className="w-[280px] bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-2">
            Verdict
          </div>
          {selectedRun?.score !== null && selectedRun?.score !== undefined ? (
            <ScoreCard score={selectedRun.score} label={selectedRun.label ?? 'warm'} />
          ) : (
            <div className="text-center text-[var(--color-text-tertiary)] text-xs italic py-10">
              {agentName} is still working…
            </div>
          )}
          {draft && selectedRun && (
            <EmailDraftBar runId={selectedRun.id} draft={draft} />
          )}
        </div>
      </div>

      <InboxStrip
        leads={leads}
        runs={runs}
        selectedLeadId={selectedLeadId}
        onSelect={setSelectedLeadId}
      />
    </div>
  );
}

function ScoreCard({ score, label }: { score: number; label: string }) {
  const color =
    label === 'hot' ? '#dc2626' : label === 'warm' ? '#f59e0b' : '#3b82f6';
  return (
    <div className="text-center">
      <div
        className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-2xl font-bold text-white mb-2"
        style={{ background: color }}
      >
        {score}
      </div>
      <div className="text-xs uppercase tracking-wide font-semibold" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
```

**Important:** The import of `useLeads` may not match the existing hook name. Inspect `apps/web/src/hooks/` and update the import to whatever actually provides the leads list. If there's no existing hook, use `useAgentRuns` directly and derive leads from runs. Don't stall on this.

- [ ] **Step 3: Restyle `EmailDraftBar`**

Read `apps/web/src/agents/lead-qualification/components/EmailDraftBar.tsx`. Swap dark classes for light:

```tsx
<div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded p-3 mt-3">
  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-2">
    Draft · {draft.status}
  </div>
  {/* keep existing subject/body/buttons, restyled with light classes */}
</div>
```

Keep the existing logic (Send / Edit / Discard callbacks to `/chat/resume`).

- [ ] **Step 4: Delete `ChatPanel.tsx`**

```bash
rm apps/web/src/agents/lead-qualification/components/ChatPanel.tsx
```

- [ ] **Step 5: Delete `AgentInspector.tsx`**

```bash
rm apps/web/src/agents/lead-qualification/components/AgentInspector.tsx
```

(Or keep it renamed as `DevInspector.tsx` if you want the "Dev view" toggle mentioned in the spec — optional.)

- [ ] **Step 6: Verify typecheck + browser**

```bash
pnpm --filter @pipeagent/web typecheck
pnpm dev
```

Open the workspace. It may show "Select a lead" until you pick one — that's fine. Identity rail should render on the left with placeholder/real identity. No console errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/agents/lead-qualification/
git rm -f apps/web/src/agents/lead-qualification/components/ChatPanel.tsx
git rm -f apps/web/src/agents/lead-qualification/components/AgentInspector.tsx
git commit -m "feat(web): rewrite Lead Qualification workspace around IdentityRail + ActivityStream"
```

---

## Phase B9 — Home page

### Task 23: Rewrite `Home.tsx`

**Files:**
- Rewrite: `apps/web/src/pages/Home.tsx`

- [ ] **Step 1: Read the existing Home**

```bash
cat apps/web/src/pages/Home.tsx
```

- [ ] **Step 2: Rewrite**

Replace the entire file:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AGENT_REGISTRY } from '../agents/registry.js';
import { AgentAvatar } from '../components/AgentAvatar.js';
import { AgentIcon, type LucideIconName } from '../components/AgentIcon.js';
import { CompanyProfileEditor } from '../components/CompanyProfileEditor.js';
import { useCompanyProfile } from '../hooks/useCompanyProfile.js';
import { useAgentRuns } from '../hooks/useSupabaseRealtime.js';

export function Home({ connectionId, userName }: { connectionId: string; userName: string }) {
  const { profile } = useCompanyProfile();
  const { runs } = useAgentRuns(connectionId);
  const [showCompanyEdit, setShowCompanyEdit] = useState(false);

  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
      ? 'Good afternoon'
      : 'Good evening';

  const activeAgents = Object.values(AGENT_REGISTRY).filter((a) => a.status === 'active');
  const simulatedAgents = Object.values(AGENT_REGISTRY).filter((a) => a.status === 'simulated');
  const runningRuns = runs.filter((r) => r.status === 'running').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Company header */}
      <div className="flex items-center gap-4 p-5 bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-xl mb-5">
        <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-[var(--color-primary-bright)] to-[var(--color-primary-dark)] flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ width: 52, height: 52 }}>
          {(profile?.name ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
            {profile?.name || 'Set your company name'}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {profile?.description || 'Edit your company profile to give every agent shared context.'}
          </div>
        </div>
        <button
          onClick={() => setShowCompanyEdit(true)}
          className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border-default)] rounded text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)]"
        >
          <Pencil size={14} strokeWidth={2} />
          Edit company profile
        </button>
      </div>

      {/* Greeting */}
      <div className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight mb-1">
        {greeting}, {userName}.
      </div>
      <div className="text-sm text-[var(--color-text-secondary)] mb-6 flex items-center gap-2">
        {runningRuns > 0 && <span className="inline-block w-2 h-2 bg-[var(--color-primary-bright)] rounded-full animate-pulse shadow-[0_0_0_3px_rgba(38,182,124,0.2)]" />}
        Your team is ready · {runningRuns === 0 ? 'nothing running right now' : `${runningRuns} agent${runningRuns === 1 ? '' : 's'} working`}
      </div>

      {/* Your team */}
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-2.5">
        Your team
      </div>
      <div className="grid grid-cols-2 gap-3.5 mb-7">
        {activeAgents.map((agent, i) => (
          <Link
            key={agent.id}
            to={`/agent/${agent.id}`}
            className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg p-4 hover:border-[var(--color-primary-bright)] hover:shadow-[var(--shadow-hover)] transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <AgentAvatar name={agent.defaultIdentity.name || '?'} paletteIndex={i % 6} size={46} />
              <div>
                <div className="text-base font-bold text-[var(--color-text-primary)] leading-tight">
                  {agent.defaultIdentity.name || agent.name}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{agent.role}</div>
              </div>
            </div>
            <div className="text-xs italic text-[var(--color-text-secondary)] py-2.5 border-y border-[var(--color-border-subtle)]">
              "{agent.defaultIdentity.mission}"
            </div>
            <div className="flex items-center justify-between mt-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]" />
                Idle
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Coming to the team */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Coming to the team
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">{simulatedAgents.length} more hires planned</div>
      </div>
      <div className="grid grid-cols-5 gap-2.5 mb-6">
        {simulatedAgents.map((agent) => (
          <div
            key={agent.id}
            className="bg-[var(--color-card)] border border-dashed border-[var(--color-border-default)] rounded-lg p-3 text-center"
          >
            <div className="w-8 h-8 mx-auto mb-2 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center text-[var(--color-text-secondary)]">
              <AgentIcon name={agent.icon as LucideIconName} size={18} />
            </div>
            <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{agent.name}</div>
            <div className="text-[9px] uppercase tracking-wide text-[var(--color-text-tertiary)] mt-0.5">
              Coming soon
            </div>
          </div>
        ))}
        <Link
          to="/build-your-own"
          className="bg-[#f0faf5] border border-[var(--color-primary-dark)] rounded-lg p-3 text-center hover:shadow-[0_4px_12px_rgba(38,182,124,0.2)]"
        >
          <div className="w-8 h-8 mx-auto mb-2 bg-[rgba(38,182,124,0.15)] rounded-lg flex items-center justify-center text-[var(--color-primary-dark)]">
            <AgentIcon name="Sparkles" size={18} />
          </div>
          <div className="text-xs font-semibold text-[var(--color-primary-dark)]">Build your own</div>
          <div className="text-[9px] uppercase tracking-wide text-[var(--color-primary-dark)] mt-0.5">Start here</div>
        </Link>
      </div>

      {showCompanyEdit && <CompanyProfileEditor onClose={() => setShowCompanyEdit(false)} />}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

```bash
pnpm dev
```

Home page should render with a company header (or "Set your company name" placeholder), two agent cards (Nora + Dex), and the 4 simulated + 1 "Build your own" strip.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Home.tsx
git commit -m "feat(web): rewrite Home page with 'meet your team' framing"
```

---

## Phase B10 — Settings + cleanup

### Task 24: Rewrite Settings page

**Files:**
- Modify: `apps/web/src/pages/Settings.tsx`

- [ ] **Step 1: Read current Settings**

```bash
cat apps/web/src/pages/Settings.tsx
```

- [ ] **Step 2: Remove Business Context tab**

Delete all JSX and state relating to:
- ICP criteria editor (moved to IdentityEditor)
- Outreach tone
- Followup days
- Business description / value proposition (moved to CompanyProfileEditor)

Replace the Business Context tab with a link that opens the `CompanyProfileEditor` modal. Keep other tabs (Pipedrive Connection, Notifications) as-is but restyle classes to use `var(--color-*)` tokens.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter @pipeagent/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Settings.tsx
git commit -m "feat(web): strip Business Context tab from Settings, link to CompanyProfileEditor"
```

### Task 25: Delete seed code + route + hub-config/agent-config remnants

**Files:**
- Delete: `apps/server/src/seed/` (entire directory)
- Delete: `apps/server/src/routes/seed.ts`
- Verify: `apps/server/src/server.ts` has no `/seed` mount
- Verify: `apps/server/src/middleware/auth.ts` has no `/seed` in whitelist

- [ ] **Step 1: Delete seed code**

```bash
cd ~/git/pipeagent
rm -rf apps/server/src/seed
rm -f apps/server/src/routes/seed.ts
```

- [ ] **Step 2: Strip seed references from `server.ts`**

```bash
grep -n "seed" apps/server/src/server.ts
```

Remove any remaining `import seed from './routes/seed.js'` and `app.route('/seed', seed)` lines.

- [ ] **Step 3: Strip seed references from middleware**

```bash
grep -n "seed" apps/server/src/middleware/auth.ts
```

Remove `/seed` from the whitelist array if present.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter @pipeagent/server typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/server/
git commit -m "chore(server): remove seed code and routes (superseded by pd-helpers)"
```

### Task 26: Final cleanup — old hooks, old components, stale imports

**Files:**
- Various

- [ ] **Step 1: Hunt for dead references**

```bash
cd ~/git/pipeagent

# Old types
grep -rn "BusinessProfile" apps/ packages/ --include="*.ts" --include="*.tsx"

# Old routes
grep -rn "hub-config\|agent-config" apps/ --include="*.ts" --include="*.tsx"

# Old hooks
grep -rn "useSettings" apps/web/src --include="*.ts" --include="*.tsx"

# Old component imports
grep -rn "ChatPanel\|AgentInspector\|LeadsList" apps/web/src --include="*.ts" --include="*.tsx"
```

For each match, either:
- Update the reference (if a new equivalent exists)
- Delete the file (if it's orphaned)
- Leave it (if it's a comment or in a migration file)

- [ ] **Step 2: Final typecheck + build**

```bash
pnpm --filter @pipeagent/server typecheck
pnpm --filter @pipeagent/web typecheck
pnpm build
```

All three must exit 0.

- [ ] **Step 3: Full dev smoke test**

```bash
pnpm dev
```

In the browser:
1. Log in via Pipedrive OAuth
2. Land on Home — see company header, Nora + Dex cards, "Coming soon" strip
3. Click Nora → workspace opens with identity rail, empty stream, empty output, empty inbox
4. Run `pd-seed --target pipeagent` in a separate terminal
5. Wait for the lead to appear in the inbox strip
6. Click it → watch the activity stream light up (fetchContext → checkMemory → research with streaming tokens → scoring → writeBack → outreach)
7. Approve the draft via EmailDraftBar
8. Confirm the run completes and output rail shows the score

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: clean up stale imports and dead code after identity refactor"
```

---

## Phase B11 — Optional TEX polish

### Task 27: Demo banner (OPTIONAL — decide at rehearsal)

**Files:**
- Create: `apps/web/src/components/DemoBanner.tsx`
- Modify: `apps/web/src/components/HubShell.tsx`

- [ ] **Step 1: Decide — is the banner worth it?**

The banner adds a thin green strip at the top of every page saying "TEX demo · {company name}." It's cosmetic and purely for the stage. Skip this task if rehearsal doesn't reveal a need.

- [ ] **Step 2: Write `DemoBanner.tsx`**

```tsx
import { useCompanyProfile } from '../hooks/useCompanyProfile.js';

export function DemoBanner() {
  const { profile } = useCompanyProfile();
  if (!profile?.name) return null;
  return (
    <div className="bg-[var(--color-primary-dark)] text-white text-center text-xs py-1.5 flex-shrink-0">
      TEX demo · {profile.name}
    </div>
  );
}
```

- [ ] **Step 3: Mount in `HubShell.tsx`**

Insert `<DemoBanner />` above `<TopBar />` in the shell.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/DemoBanner.tsx apps/web/src/components/HubShell.tsx
git commit -m "feat(web): add optional demo banner for TEX"
```

---

## Final sanity checklist

After Phase B10 (and optionally B11), confirm:

- [ ] `pnpm build` succeeds in the repo root
- [ ] `pnpm --filter @pipeagent/server typecheck` exits 0
- [ ] `pnpm --filter @pipeagent/web typecheck` exits 0
- [ ] `supabase/migrations/005_identity_refactor.sql` applied in production with a backup taken first
- [ ] `company_profile` + `agent_identity` tables populated via backfill
- [ ] `business_profiles`, `hub_config`, `agent_config` tables dropped
- [ ] Home page shows Nora + Dex + coming-soon strip + company header
- [ ] Lead Qualification workspace shows identity rail + activity stream + output rail + inbox strip
- [ ] Research stream emits phase + token events visible in the activity stream
- [ ] Identity rail edit mode flips in place and saves to `agent_identity`
- [ ] ICP editor modal opens, edits criteria, saves
- [ ] Company profile modal opens from Home and from the workspace identity rail
- [ ] End-to-end: `pd-seed --target pipeagent` → lead appears → click → watch thinking → approve draft → run completes
- [ ] No references to `BusinessProfile`, `hub-config`, `agent-config`, `ChatPanel`, `AgentInspector`, `LeadsList`, `useSettings` in the codebase

When all checked, Plan B is complete. Ready for TEX rehearsal.

---

## Known divergences from the spec

**The "Mari Tamm" / pool mismatch:** the spec describes Mari Tamm as the canonical demo lead, but pipeagent's 20-item `companies.ts` pool does not contain her (she's from digital-pd-team's `create-smoke-lead.sh`). Plan A ships with all 20 original entries and a hero lead of "Andrus Koppel · Smarten Logistics AS · Tallinn." Before TEX, either:

- Update Plan A's pool to add Mari Tamm as a 21st entry (so both repos share her), OR
- Update the demo choreography to use Andrus Koppel as the hero

This is a 5-minute fix and does not block execution of either plan.
