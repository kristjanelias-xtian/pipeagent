# PD Helpers + pipeagent Agent Hub Redesign — Design

**Date:** 2026-04-11
**Status:** Draft, awaiting user review
**Author:** Brainstorming session with Claude

---

## Context

Two repos currently build Claude-powered agents against Pipedrive from opposite ends of the spectrum:

- **`pipeagent`** — LangGraph pipeline hub. Claude is a function inside a state machine. TypeScript, React, Node/Hono server. Live at `pipeagent.xtian.me`.
- **`../digital-pd-team`** — sandboxed "employee" bots (Lux, Taro, Zeno) with `IDENTITY.md` + `SKILL.md`. Claude is the runtime, not a component. Python helpers, Node webhook relay.

Both will be demoed side-by-side at **TEX** as "two ends of one spectrum." Today, three things block that demo:

1. Each repo has its own lead-creation seeder; they share nothing. No way to fire "the same input" at both sides.
2. `pipeagent`'s agent hub UI feels developer-y — the current `AgentInspector` shows JSON log dumps, not an agent "thinking." The employee metaphor that makes digital-pd-team compelling is absent.
3. `pipeagent`'s data model for "context" is fragmented across three tables that grew at different times (`business_profiles`, `hub_config`, `agent_config`), with overlapping fields. The UI can't have a clean "company profile vs agent identity" story because the data doesn't embody that split.

This design addresses all three.

---

## Goals

1. Unify lead creation across both repos through a small shared CLI (`pd-helpers`) that picks from a pool, skips collisions, and targets either or both Pipedrive accounts.
2. Redesign the `pipeagent` Lead Qualification workspace so a TEX audience sees an "employee" with an identity, a mission, and visible thinking — not a JSON log stream.
3. Consolidate `pipeagent`'s context schema into two honest tables: `company_profile` (shared, hub-level) and `agent_identity` (per-agent). Move ICP/tone/followup into `agent_identity.config` where they belong.
4. Adopt Pipedrive-style visual language everywhere (light theme, green accents, Lucide icons) so the demo rhymes with the product it extends.
5. Produce a TEX demo script that shows the same pool item creating wildly different reactions in each repo.

## Non-goals

- Publishing `pd-helpers` as an npm package.
- Redesigning Deal Coach's output UI (health score cards, signal chips, chat panel) beyond applying the new visual tokens.
- Making the 4 simulated agents real.
- Making "Build Your Own" functional.
- Test coverage. `pipeagent` has no test framework today; this design does not add one.
- Publishing the pipeagent Web UI to mobile or auditing for accessibility.
- Any changes to OAuth / JWT auth middleware beyond mounting new routes.

---

## Overall shape — three phases

**Phase 1 — `pd-helpers` repo.** Small standalone TypeScript CLI. Lifts the existing 20-item lead pool from `pipeagent/apps/server/src/seed/companies.ts`, checks collisions by email across both Pipedrive accounts, writes leads. No HTTP server, no UI.

**Phase 2 — `pipeagent` redesign.** Schema migration, identity-centric UI, Pipedrive-style light theme, streaming research. The bulk of the work.

**Phase 3 — TEX demo choreography.** Pre-stage prep, on-stage script, small code for a reset command and optional demo banner.

Phases 1 and 2 are independent. Phase 3 depends on both.

---

# Phase 1 — `pd-helpers` repo

## Repo layout

```
pd-helpers/
├── README.md
├── package.json              # "type": "module", bin: { "pd-seed": "./dist/seed.js" }
├── tsconfig.json
├── .env.example              # both PD tokens + both domains
├── .gitignore                # .env, node_modules, dist
├── src/
│   ├── seed.ts               # CLI entrypoint, arg parsing, orchestration
│   ├── pool.ts               # the 20 seed leads, typed as SeedLead[]
│   ├── pd-client.ts          # minimal Pipedrive v1 REST wrapper
│   ├── dedupe.ts             # email-based collision check
│   └── types.ts              # SeedLead, TargetAccount, PDPerson, PDLead, PDDeal
└── dist/                     # tsc output (gitignored)
```

~300 LOC total. No framework dependencies — bare `fetch`, `process.env`, `process.argv`. One dev dependency: `typescript`. Distributed via `pnpm link` locally.

## Pool data

Lifted verbatim from `pipeagent/apps/server/src/seed/companies.ts`. All 20 NordLight Solar–themed leads (B2B + residential, Tallinn / Tartu / Pärnu). Each entry conforms to:

```ts
type SeedLead = {
  slug: string;                     // "mari-tamm-pirita" — stable ID for --name flag
  company: string;
  type: 'B2B' | 'Residential';
  location: string;
  industry: string;
  employees: number | null;
  contactName: string;
  email: string;
  phone: string;
  source: string;                   // becomes part of lead title
  notes: string;
};
```

The `slug` field is new. It's the only pool-level field not in the current `companies.ts` — add it there during the lift so each entry has a stable reference.

After Phase 1 lands, `pipeagent/apps/server/src/seed/` is **deleted entirely**: `cli.ts`, `generator.ts`, `companies.ts`, and the `POST /seed/generate` route. The "+ Generate Leads" button in `apps/web/src/agents/lead-qualification/components/LeadsList.tsx` is also removed. Seeding becomes a terminal-only operation via `pd-helpers`.

## CLI surface

```bash
pd-seed                             # random pool item, errors if neither target set
pd-seed --target pipeagent          # pipeagent PD only
pd-seed --target digital-pd-team    # digital-pd-team PD only
pd-seed --target both               # both at once
pd-seed --name mari-tamm-pirita     # specific pool item by slug
pd-seed --dry-run                   # show what would be picked, no writes
pd-seed --list                      # list pool with per-account availability
pd-wipe --target both               # archive all leads, delete persons & orgs (demo reset)
```

Exit codes: `0` on full success, `1` if any target fails, `2` on bad args, `3` on auth failure.

## Auth

`.env` in the `pd-helpers` repo root:

```bash
PD_PIPEAGENT_API_TOKEN=xxx
PD_PIPEAGENT_API_DOMAIN=https://api-proxy.pipedrive.com
PD_DIGITAL_API_TOKEN=yyy
PD_DIGITAL_API_DOMAIN=https://api-proxy.pipedrive.com
```

Tokens are personal API tokens from each Pipedrive account's settings page. File permissions: `chmod 600 .env`. `.env` is gitignored; `.env.example` is committed.

## Dedupe algorithm (email-based)

For each `--target` account:

1. `GET /persons/search?term=<pool.email>&fields=email&exact_match=1` — find any person matching the email exactly.
2. For each matched person:
   - `GET /persons/:id/leads?status=open` — any open leads?
   - `GET /persons/:id/deals?status=open` — any open deals?
3. If either returns any row → **in use**. Skip this pool item.
4. Pool item is **available** when every target account reports "not in use."

Random selection loops up to N=20 retries. If the full pool is exhausted for the requested targets, error out with `"pool exhausted — all 20 items are in use in [target]. Run pd-wipe to reset."`

## Creation sequence

Mirrors `pipeagent/apps/server/src/seed/generator.ts:20-50`, one sequence per target:

1. `POST /organizations` with `{ name, address }` (address derived from `pool.location`)
2. `POST /persons` with `{ name, email: [{ primary: true, value }], phone: [{ primary: true, value }], org_id }`
3. `POST /leads` with `{ title: "${company} — ${source}", person_id, organization_id }`

Output (one line per target):

```
[pipeagent]        ✓ lead #324 "Mari Tamm — Pirita residential" (person #1103, org #422)
[digital-pd-team]  ✓ lead #87 "Mari Tamm — Pirita residential" (person #203, org #58)
```

Errors are loud. On `--target both`, if one account succeeds and the other fails, both results print and exit code is `1`. No silent partial success.

## Out of scope for Phase 1

- Retry/backoff on rate limits.
- Pagination beyond default 500.
- Custom field writing.
- Any "undo" for a single lead (use `pd-wipe` for bulk reset).

---

# Phase 2 — `pipeagent` redesign

## Schema migration

New migration file: `supabase/migrations/005_identity_refactor.sql`.

### New tables

```sql
-- Company profile: one row per connection, shared by every agent
CREATE TABLE company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',                 -- "NordLight Solar"
  description TEXT NOT NULL DEFAULT '',          -- who the company is
  value_proposition TEXT NOT NULL DEFAULT '',    -- what it sells / why
  service_area TEXT NOT NULL DEFAULT '',         -- where it operates
  extra_context TEXT NOT NULL DEFAULT '',        -- free-form everything-else
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- Agent identity: one row per connection + agent
CREATE TABLE agent_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,                         -- 'lead-qualification', 'deal-coach'
  name TEXT NOT NULL DEFAULT '',                  -- "Nora" (user-editable)
  mission TEXT NOT NULL DEFAULT '',               -- one-liner (editable)
  personality TEXT NOT NULL DEFAULT '',           -- voice/tone (editable)
  rulebook TEXT NOT NULL DEFAULT '',              -- free-form guidance (editable)
  config JSONB NOT NULL DEFAULT '{}',             -- agent-specific structured config
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, agent_id)
);

CREATE INDEX idx_agent_identity_connection ON agent_identity(connection_id);
CREATE INDEX idx_agent_identity_agent ON agent_identity(connection_id, agent_id);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company_profile" ON company_profile FOR ALL USING (true);
CREATE POLICY "own agent_identity" ON agent_identity FOR ALL USING (true);

CREATE TRIGGER company_profile_updated_at BEFORE UPDATE ON company_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_identity_updated_at BEFORE UPDATE ON agent_identity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Note:** `role`, `scope_in`, `scope_out` are NOT in `agent_identity`. These are structural properties of the agent's job (defined by the LangGraph pipeline shape) and live in the registry as part of `AgentMeta` — read-only from the user's perspective. See "Registry extensions" below.

### Agent-specific `config` shape

Typed in `packages/shared/src/types.ts`:

```ts
export type LeadQualificationConfig = {
  icp_criteria: IcpCriterion[];      // [{ name, description, weight }]
  followup_days: number;              // default 3
};

export type DealCoachConfig = {
  health_score_weights?: Record<string, number>;  // TBD, stays loose
};

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

### Data migration

All SQL below runs inside a single `BEGIN; ... COMMIT;` block for atomicity:

```sql
BEGIN;

-- [CREATE TABLE statements from above]

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

### Migration safety plan

1. **Supabase on-demand backup** immediately before running: Dashboard → Database → Backups → "Create backup now." Retained 7 days.
2. **Local dry-run first.** `docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=x postgres:15`, apply migrations 001–004 to establish baseline, seed with representative fake rows, apply 005, verify backfill looks right. ~15 min.
3. **Atomic transaction.** The `BEGIN ... COMMIT` wrapping ensures that any failure rolls back the entire migration.
4. **Defensive idempotency.** `CREATE TABLE IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`, `DROP TABLE IF EXISTS`. Re-running the migration is a no-op.
5. **Apply to prod via `psql` or Supabase SQL editor.** Single-tenant (`kristjanelias@`), so only one `company_profile` and two `agent_identity` rows are created.

## Registry extensions

`packages/shared/src/types.ts` — extend `AgentMeta`:

```ts
export type AgentMeta = {
  id: AgentId;
  name: string;                 // display name of the agent type, e.g. "Lead Qualifier"
  role: string;                 // structural role shown read-only in identity editor
  icon: LucideIconName;         // string literal keyed to a small whitelist map; see below
  description: string;
  status: 'active' | 'simulated';
  dataScope: 'leads' | 'deals' | 'contacts' | 'pipeline';
  scopeIn: string;              // NEW — what this agent owns (read-only text)
  scopeOut: string;             // NEW — what it doesn't touch (read-only text)
  defaultIdentity: {            // NEW — shown when no row exists yet
    name: string;               // default display name, e.g. "Nora"
    mission: string;
    personality: string;
  };
  defaultConfig: Record<string, unknown>;
};
```

`apps/web/src/agents/registry.ts` — update the two active agents:

```ts
'lead-qualification': {
  id: 'lead-qualification',
  name: 'Lead Qualifier',
  role: 'Lead Qualifier',
  icon: 'UserSearch',            // lucide-react icon name
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

The 4 simulated agents keep their current registry entries but get `defaultIdentity.name = ''` (no default name; they're placeholders).

**Icon resolution:** create `apps/web/src/components/AgentIcon.tsx` with a small whitelist map from string names (`'UserSearch' | 'TrendingUp' | 'Calendar' | 'Mail' | 'Database' | 'Sparkles'`) to the corresponding `lucide-react` component imports. The registry only references the string; the component resolves it. This keeps `packages/shared` free of React/Lucide imports and makes the set of allowed icons explicit. `LucideIconName` is the union type of the whitelist keys, exported from that file.

## Backend route changes

`apps/server/src/routes/`:

- **`hub-config.ts` → `company-profile.ts`** — renamed. Endpoints become `GET /company-profile` (returns the single row, creates empty one if missing) and `PUT /company-profile` (upsert).
- **`agent-config.ts` → `agent-identity.ts`** — renamed. Endpoints become `GET /agent-identity/:agentId`, `PUT /agent-identity/:agentId`, `GET /agent-identity` (list all for current connection). On GET for a missing row, return an empty row backfilled with `defaultIdentity` from the registry (server reads `AgentMeta` from shared).
- **`settings.ts`** — loses the ICP/tone/followup fields (moved to agent-identity). Keeps `POST /register-webhook`.
- **`server.ts`** — mount `/company-profile` and `/agent-identity`; unmount `/hub-config` and `/agent-config`.
- **`middleware/auth.ts`** — JWT whitelist: add `/company-profile` and `/agent-identity`; remove `/hub-config` and `/agent-config`.

## In-flight identity snapshot (LangGraph)

**Problem:** if the user edits identity mid-run, later nodes that re-read from the DB would see the new value, corrupting state.

**Fix:** snapshot `company_profile` + `agent_identity` into `AgentState` inside `fetchContext`. All subsequent nodes read from state, never from the DB.

`apps/server/src/agent/state.ts`:

```ts
// Replace `settings: BusinessProfile` with:
companyProfile: Annotation<CompanyProfile | null>({
  reducer: (_, n) => n,
  default: () => null,
}),
identity: Annotation<AgentIdentityRow | null>({
  reducer: (_, n) => n,
  default: () => null,
}),
```

`apps/server/src/agent/nodes/fetchContext.ts` — after fetching Pipedrive entities:

```ts
const [{ data: companyProfile }, { data: identity }] = await Promise.all([
  getSupabase()
    .from('company_profile')
    .select('*')
    .eq('connection_id', connectionId)
    .single(),
  getSupabase()
    .from('agent_identity')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('agent_id', 'lead-qualification')
    .single(),
]);

return {
  lead, person, organization,
  companyProfile,
  identity,
};
```

`apps/server/src/agent/graph.ts:runScoring` reads ICP from `state.identity.config.icp_criteria`. `runOutreach` reads tone from `state.identity.personality`, value prop from `state.companyProfile.value_proposition`, business description from `state.companyProfile.description`. `apps/server/src/agents/deal-coach/nodes/fetchDealContext.ts` follows the same pattern.

LangGraph's checkpointer already persists parent `AgentState` between nodes, so resume-after-HITL uses the snapshotted identity. No extra persistence work.

**Effort estimate:** ~30 min.

## Research streaming

**Problem:** `apps/server/src/agent/subagents/research.ts:49-55` uses `client.messages.create()` — a non-streaming call. The full response arrives at once after all `web_search` tool calls complete. The UI currently shows nothing until it's done.

**Fix:** switch to `client.messages.stream()`. Emit event-typed activity_logs as the stream progresses:

```ts
const stream = client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1500,                                       // lowered from 4096
  tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],  // lowered from 5
  messages: [{ role: 'user', content: prompt }],
});

await logActivity(runId, 'research', 'phase', { phase: 'opening' });

let textBuffer = '';
let lastEmit = Date.now();

for await (const event of stream) {
  if (event.type === 'content_block_start') {
    const block = event.content_block;
    if (block.type === 'server_tool_use' && block.name === 'web_search') {
      await logActivity(runId, 'research', 'phase', {
        phase: 'searching',
        query: (block.input as { query?: string }).query ?? '',
      });
    } else if (block.type === 'web_search_tool_result') {
      await logActivity(runId, 'research', 'phase', { phase: 'reading' });
    }
  } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    textBuffer += event.delta.text;
    // Batch token emissions to avoid channel spam
    if (Date.now() - lastEmit > 200) {
      await logActivity(runId, 'research', 'token', { partial: textBuffer });
      lastEmit = Date.now();
    }
  }
}

// Final flush
await logActivity(runId, 'research', 'token', { partial: textBuffer });
await logActivity(runId, 'research', 'phase', { phase: 'done' });

const finalMessage = await stream.finalMessage();
// Existing JSON parse path from the old implementation
```

**Frontend:** `apps/web/src/hooks/useSupabaseRealtime.ts` already subscribes to INSERTs on `activity_logs`. The new workspace component adds handlers:

- `event_type: 'phase'` → update `activeMessage.phaseLabel` ("Searching the web for 'NordLight Solar Pirita'")
- `event_type: 'token'` → set `activeMessage.partialText = payload.partial`
- On `node_exit` for research → freeze the message, clear partial

The active message in the stream renders both `phaseLabel` and `partialText` live.

**Effort estimate:** ~2 hours. One file (`research.ts`), one hook update, one component state addition.

## Workspace layout (Option B refined)

Three-region layout, light theme, Pipedrive-style:

```
┌─ Top (identity rail)              ┬─ Center (activity stream)         ┬─ Right (output) ─┐
│ [Avatar]                          │ [Nora] opened the lead ✓          │                  │
│ Nora                              │ [Nora] checked memory ✓           │                  │
│ Lead Qualifier · NordLight Solar  │ [Nora] researching... ⬤ (active)  │ (empty during    │
│                                   │   "Searching the web for..."      │  thinking)       │
│ Mission: "Qualify solar..."       │   <streaming tokens>              │                  │
│ Personality: Warm, professional   │ [Nora] will score · future        │                  │
│ I own: [scope text]               │ [Nora] will write · future        │                  │
│ I don't touch: [scope text]       │ [Nora] will draft · future        │                  │
│ ICP: 6 criteria                   │                                   │                  │
│                                   │                                   │                  │
│ [✎ Edit identity]                 │                                   │                  │
│ [→ Company profile]               │                                   │                  │
├───────────────────────────────────┴───────────────────────────────────┴──────────────────┤
│ Inbox: [Mari Tamm ⬤] [Aleksei Volkov] [Smarten Logistics] [Helena Laine] [Nordic Farm]  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Identity rail** (left, ~300px wide, sticky):
- Avatar circle (gradient, click-to-cycle-colors in edit mode) with initials
- Name + role (name editable, role read-only from registry)
- Company profile link (shows company name, click to open company profile editor)
- Dashed divider
- **The Job** (🔒 read-only, from registry): role, scope_in, scope_out
- **Your Shape** (✎ editable, from agent_identity): name, mission, personality, ICP criteria (opens modal), rulebook
- `[✎ Edit identity]` button at the bottom — clicking flips the rail to edit mode in place

**Activity stream** (center, flexible width):
- Header: "Nora is working on · {lead title}"
- Vertical list of step "messages" from the agent, one per LangGraph node
- Completed steps: muted green left border, avatar + "Nora" + dim action ("opened the lead"), timestamp, result summary body
- Active step: indigo left border, highlighted background, streaming dot animation, phase label, partial text body
- Future steps: gray left border, opacity 40%, "will {do x}"
- All steps use third-person narration ("Nora opened the lead") to rhyme with digital-pd-team's Telegram one-liners
- Dev view toggle in the top-right corner → shows raw JSON inspector (the current `AgentInspector`). Hidden by default.

**Output rail** (right, ~280px wide):
- Empty state during thinking: "Nora is still working..."
- On scoring complete: score ring (conic gradient, % fill), label badge (hot/warm/cold)
- On outreach complete: email draft card with subject, preview body, "Edit" / "Discard" / "Send" buttons (the existing `EmailDraftBar`, reskinned)

**Inbox bottom strip** (horizontal, ~60px tall):
- One card per lead, horizontally scrollable
- Selected card has indigo border; currently-running card has a pulsing dot
- No "+ Generate" button — seeding happens via CLI only

## Identity editor

In-place edit mode on the left rail — no modal, no navigation. The center stream dims to ~55% opacity but stays visible.

**Structural section (🔒 defined by agent type)** — read-only, pulled from `AgentMeta`:
- `Role` → `registry[agentId].role`
- `What I own` → `registry[agentId].scopeIn`
- `What I don't touch` → `registry[agentId].scopeOut`
- Hint text: "To change the job, build a new agent in Build Your Own."

**Editable section (✎ yours to edit)** — written to `agent_identity`:
- `Name` (text input)
- `Mission (one line)` (textarea, ~40px)
- `Personality / voice` (textarea, ~40px)
- `ICP criteria` (summary row: "6 criteria, total weight 100 · Manage →") — clicking opens a full-screen modal with a structured editor (name / description / weight per row, add/remove rows)
- `Rulebook (free-form guidance)` (textarea, ~64px)
- Save / Cancel at the bottom

**ICP modal** — centered overlay with:
- Grid: `name | description | weight | remove`
- `+ Add criterion` row
- Total weight display (doesn't have to sum to 100)
- Save / Cancel

**Avatar interaction** — in edit mode, clicking the avatar cycles through a fixed 6-entry palette of gradient presets, stored as a constant in `AgentAvatar.tsx`. Selection is an integer index persisted into `agent_identity.config.avatar_palette_index` (extends the `LeadQualificationConfig` type with an optional `avatar_palette_index?: number`). No file upload, no generated portraits.

Preset palette (all 135° gradients):

1. `#26b67c → #017737` (Pipedrive green — Nora default)
2. `#f9a825 → #ef6c00` (warm amber — Dex default)
3. `#6366f1 → #4338ca` (indigo)
4. `#ec4899 → #be185d` (pink)
5. `#06b6d4 → #0e7490` (cyan)
6. `#8b5cf6 → #6d28d9` (violet)

**Save semantics** — PUT `/agent-identity/:agentId` → optimistic update of the cached identity in React state → rail flips back to read-only. Changes take effect on the *next* run started after save; in-flight runs use the snapshotted identity from `fetchContext`.

## Home page redesign

Light-theme, "meet your team" framing:

- **Company header card** at the top: logo (gradient square with company initial), company name, tagline (one-line description from `company_profile.description`), `[✎ Edit company profile]` button (right-aligned).
- **Greeting:** `Good {morning/afternoon/evening}, {user name}.` Subtitle: `{pulsing dot} Your team is ready · {N} agent{s} working right now`.
- **"Your team" section:** 2-column grid of active agent cards (`registry[id].status === 'active'`). Each card:
  - Avatar (gradient circle with initial, colored distinctly per agent)
  - Name (from `agent_identity.name`, falls back to registry `name` if empty)
  - Role (from registry)
  - Mission quote (italic, from `agent_identity.mission`)
  - Status pill: "Working on {lead title}" (green pulsing) or "Idle · {N} {runs} analyzed" (gray)
  - Step counter / last-active time
- **"Coming to the team" section:** 5-card strip of simulated agents + "Build your own":
  - 4 simulated agents shown as dashed-border cards with icon + name + "Coming soon" label
  - "Build your own" has solid green border, `Sparkles` icon, highlighted as the only clickable of the strip
- **"Team activity · today"** feed at the bottom:
  - Reframed from raw node-level logs to named-sentence rows
  - Example row format: `[avatar N] Nora started qualifying Mari Tamm · Pirita residential · researching the web now. [time]`
  - Generated server-side or mapped client-side from `activity_logs` + `agent_identity.name` + recent lead titles
  - Shows 4-6 most recent rows

## Sidebar + TopBar updates

Flip from dark (`#161d2b`) to Pipedrive-light:

- Sidebar: `bg-white border-r border-[#e4e9ef]`. Active link: `bg-[#f0faf5] text-[#017737] border-l-2 border-[#017737]`. Icons: Lucide, 18px, stroke-2.
- TopBar: `bg-white border-b border-[#e4e9ef]`. Logo becomes green-gradient square. User avatar uses the same initial-circle pattern as agent avatars.
- The "Build Your Own" sidebar entry remains a placeholder link.

## Settings page updates

- Business Context tab is **deleted**. Its former contents (ICP, tone, followup, business description, value prop) now live in the Company Profile editor and the per-agent Identity editors.
- Pipedrive Connection and Notifications tabs remain unchanged functionally; restyled with the new visual tokens.
- Add a new Company Profile entry to the sidebar (or put a link in Settings) that opens the Company Profile editor.

## Visual tokens

Applied globally via Tailwind 4 theme config (`apps/web/tailwind.config.ts` or the `@theme` block in the main CSS file):

| Token | Value |
|---|---|
| `bg-page` | `#f5f7fa` |
| `bg-card` | `#ffffff` |
| `border-default` | `#e4e9ef` |
| `border-subtle` | `#f0f3f7` |
| `text-primary` | `#192435` |
| `text-secondary` | `#5c6b7f` |
| `text-tertiary` | `#8595a8` |
| `primary-dark` | `#017737` |
| `primary-bright` | `#26b67c` |
| `accent-warm-start` | `#f9a825` |
| `accent-warm-end` | `#ef6c00` |
| `radius-sm` | `6px` |
| `radius-md` | `10px` |
| `radius-lg` | `12px` |

**Typography:** system-ui stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui`). Headings `font-weight: 700`, body `500`. Base size `13px`, dense tables `12px`, greeting `26px`.

**Icons:** `lucide-react` (`pnpm add lucide-react` — ~30kb tree-shaken per icon). Standard sizes: 14 (inline), 16 (buttons), 18 (sidebar), 20 (card headers), 24 (hero).

**Shadows:** only on hover. `shadow-hover: 0 4px 12px rgba(25,36,53,0.06)`. No drop-shadows on static elements.

**Note on Pipedrive green:** `#017737` and `#26b67c` are approximations of Pipedrive's brand green from their marketing site. Before TEX, sample the exact hex from `pipedrive.com` using a color picker and update the tokens. ±5% hue is acceptable.

## Touch-point inventory (full list of files to change in Phase 2)

Backend:
- `apps/server/src/routes/hub-config.ts` → rename to `company-profile.ts`, rewrite
- `apps/server/src/routes/agent-config.ts` → rename to `agent-identity.ts`, rewrite
- `apps/server/src/routes/settings.ts` → remove ICP/tone/followup endpoints
- `apps/server/src/server.ts` → mount new routes, unmount old
- `apps/server/src/middleware/auth.ts` → JWT whitelist update
- `apps/server/src/agent/state.ts` → replace `settings` with `companyProfile` + `identity`
- `apps/server/src/agent/nodes/fetchContext.ts` → fetch new tables into state
- `apps/server/src/agent/subagents/scoring.ts` → read ICP from `state.identity.config.icp_criteria`
- `apps/server/src/agent/subagents/outreach.ts` → read tone from `state.identity.personality`, value prop from `state.companyProfile.value_proposition`
- `apps/server/src/agent/subagents/research.ts` → switch to `.stream()`, emit phase + token events, lower max_tokens + max_uses
- `apps/server/src/agents/deal-coach/nodes/fetchDealContext.ts` → same fetch-into-state pattern
- `apps/server/src/seed/` → delete entire directory
- `apps/server/src/routes/seed.ts` → delete

Shared:
- `packages/shared/src/types.ts` → add `CompanyProfile`, `AgentIdentityRow`, `LeadQualificationConfig`, `DealCoachConfig`; extend `AgentMeta` with `scopeIn`, `scopeOut`, `defaultIdentity`; remove `BusinessProfile`

Frontend:
- `apps/web/src/agents/registry.ts` → add `scopeIn`, `scopeOut`, `defaultIdentity` to each entry
- `apps/web/src/components/HubShell.tsx` → light theme
- `apps/web/src/components/Sidebar.tsx` → light theme, Lucide icons
- `apps/web/src/components/TopBar.tsx` → light theme, new logo
- `apps/web/src/pages/Home.tsx` → complete rewrite (company header + team grid + coming soon strip + activity feed)
- `apps/web/src/pages/Settings.tsx` → remove Business Context tab, restyle
- `apps/web/src/pages/LoginPage.tsx` → light theme
- `apps/web/src/agents/lead-qualification/Workspace.tsx` → complete rewrite (three-region layout + bottom inbox strip)
- `apps/web/src/agents/lead-qualification/components/LeadsList.tsx` → becomes `InboxStrip.tsx`, horizontal scroll, no generate button
- `apps/web/src/agents/lead-qualification/components/AgentInspector.tsx` → becomes `ActivityStream.tsx`, new render logic; keep old file as `DevInspector.tsx` toggle
- `apps/web/src/agents/lead-qualification/components/ChatPanel.tsx` → delete (replaced by ActivityStream)
- `apps/web/src/agents/lead-qualification/components/EmailDraftBar.tsx` → restyled, moves into Output rail
- `apps/web/src/agents/lead-qualification/components/IdentityRail.tsx` → NEW
- `apps/web/src/agents/lead-qualification/components/IdentityEditor.tsx` → NEW (inline rail edit mode)
- `apps/web/src/agents/lead-qualification/components/IcpEditor.tsx` → NEW (modal)
- `apps/web/src/components/CompanyProfileEditor.tsx` → NEW (shared between Home and workspace link)
- `apps/web/src/hooks/useSupabaseRealtime.ts` → add phase + token handlers
- `apps/web/src/hooks/useSettings.ts` → split into `useCompanyProfile.ts` + `useAgentIdentity.ts`
- `apps/web/src/lib/api.ts` → new endpoint wrappers
- `apps/web/src/main.css` → new theme tokens
- `apps/web/package.json` → add `lucide-react`

Database:
- `supabase/migrations/005_identity_refactor.sql` → NEW

---

# Phase 3 — TEX demo

## Pre-stage setup

1. **Pre-warm `org_memory` for 15 of 20 pool items.** Write `pd-helpers/scripts/prewarm.ts` that fires each chosen pool item through pipeagent's webhook, waits for the run to reach `saveResearch`, then kills it before scoring. After prewarm, 15 `org_memory` rows exist. Demo's default lead pick will hit cache → fast run. For the one "watch research stream" moment, pick from the 5 unwarmed.
2. **Pipedrive accounts cleaned** via `pd-seed --wipe --target both`.
3. **Two browser windows** arranged on the projector:
   - Left half: `pipeagent.xtian.me`, Home page, "Your team" visible with Nora and Dex both idle.
   - Right half: digital-pd-team's Telegram group ("NordLight Sales"), quiet.
4. **Terminal** on the Mac mini with `pd-helpers` cwd, large font, visible to audience if possible.
5. **Rehearsal pass:** `pd-seed --target pipeagent` and `pd-seed --target digital-pd-team` once each, confirm both sides react, stopwatch the end-to-end times.

## Stage arc (~8–10 min)

1. **Frame (1 min).** "Two ways to build CRM agents. Same fictional company — NordLight Solar. Left screen: an agent hub with a LangGraph pipeline. Right screen: a team of sandboxed Claude employees reacting to webhooks. One predictable, one autonomous. Same input, two reactions."
2. **Meet the left team (1 min).** Click Nora's card on pipeagent Home. Workspace opens. Left rail: identity visible. "This is my Lead Qualifier. Her name is Nora. She has a mission I gave her, and a scoring rubric I gave her. Right now her queue is empty."
3. **Meet the right team (1 min).** Switch to Telegram. "Over here, same company, three different employees. Lux the SDR, Taro the AE, Zeno the manager. They coordinate through this group and through Pipedrive. Nothing happening here either."
4. **Fire the left side (2 min).** Terminal: `pd-seed --target pipeagent`. Back to left screen. Lead appears in Nora's inbox strip → webhook fires → stream lights up. Narrate: "She opened the file. Checked memory. Now she's researching — you can see the tokens arriving live." Research completes → scoring → writeBack → draft. Output rail populates. Approve the draft. "Done — email logged, followup scheduled, run complete."
5. **Fire the right side (2 min).** Terminal: `pd-seed --target digital-pd-team`. Switch to Telegram. Silence. "This side has no UI, no dashboard. They work the way remote humans work — silence, then a message." ~30–60s later, Lux posts a one-liner. Switch briefly to Pipedrive to show the created deal. Switch back. ~30–60s later, Taro posts. "Different shape of team, same Pipedrive."
6. **The closer (2 min).** Terminal: `pd-seed --target both`. Both screens at once. Audience watches the same pool item create dramatically different reactions. Money shot.
7. **Close (1 min).** "Two ends of one spectrum. One says 'watch me think.' One says 'I'll tell you when I'm done.' Both are Claude under the hood. Both use the same `pd-helpers` against the same pool. Pick the shape that fits your team."

## Latency mitigations for stage pacing

Applied to `research.ts` during Phase 2:

1. **Prewarm 15/20 pool items.** Target lead is one of the prewarmed → cache hit → research skips → full run ~10s.
2. **Shorter research prompt.** Drop `funding_stage`, `tech_stack`, `recent_news` from the output schema. Keep `company_description`, `industry`, `employee_count`. Prompt half as long.
3. **Lower `max_tokens` from 4096 → 1500** on the research call.
4. **Lower `web_search` `max_uses` from 5 → 2.**
5. **Streaming output** (from Risk 1 fix) — the biggest perceptual win. A 12s research call with visible tokens feels fast.
6. **Narration cover.** Talk while Nora works. Latency becomes content, not a gap.

Targets:
- Prewarmed full run: ~8s
- Unwarmed full run: ~15s with visible streaming

## Small Phase 3 code

- `pd-helpers/src/wipe.ts` — NEW. `pd-wipe --target both` archives all leads, cancels all deals, deletes all persons/orgs. Loose port of digital-pd-team's `scripts/wipe-pipedrive.sh`.
- `pd-helpers/scripts/prewarm.ts` — NEW. Iterates 15 pool items, fires each through pipeagent, waits for `saveResearch` event, moves to next.
- `apps/web/src/components/DemoBanner.tsx` — NEW (optional). Thin green strip at the top of every page showing "TEX demo · NordLight Solar" when the user has the company set. Pure cosmetic.

---

# Risks (with concrete mitigations, all baked into phases above)

| # | Risk | Mitigation | Where |
|---|---|---|---|
| 1 | Research streaming not "alive" | Switch `research.ts` to `.stream()`, emit phase + batched token events | Phase 2 → Research streaming |
| 2 | In-flight identity edits corrupting runs | Snapshot `company_profile` + `agent_identity` into state at `fetchContext`; all nodes read from state | Phase 2 → In-flight identity snapshot |
| 3 | Migration atomicity | `BEGIN ... COMMIT` transaction, Supabase backup, local Postgres dry-run, defensive idempotency | Phase 2 → Migration safety plan |
| 4 | TEX latency | Prewarm 15/20, shorter prompt, lower `max_tokens`, lower `max_uses`, streaming UX, narration | Phase 3 → Latency mitigations |
| 5 | `.env` secrets hygiene | `chmod 600 .env`, gitignore, committed `.env.example` | Phase 1 → Auth |

---

# Open questions

None blocking. These are nice-to-haves or ± 5% calibration:

- **Exact Pipedrive green hex.** I used `#017737` / `#26b67c` as approximations. Sample the real brand green from their site before TEX.
- **Whether the demo banner is worth it.** Decide at rehearsal time.
- **Inbox strip order.** Newest-first, oldest-first, or alphabetical? I'd go newest-first so the freshly-seeded lead appears on the left; decide in implementation.

---

# Checklist for implementation plan

When this design is approved and we move to writing the implementation plan, the plan should cover:

1. Phase 1 (`pd-helpers` repo): init, pool, CLI, dedupe, creation, wipe, prewarm.
2. Phase 2 backend: migration file, dry-run, backup, apply; new routes; LangGraph state refactor; research streaming.
3. Phase 2 frontend: visual tokens / Tailwind theme; Lucide install; Sidebar/TopBar/HubShell restyle; Home rewrite; Workspace rewrite; IdentityRail + IdentityEditor + IcpEditor + CompanyProfileEditor; Settings restyle.
4. Phase 2 cleanup: delete old seed code, delete ChatPanel, delete Business Context tab, update hooks.
5. Phase 3: demo banner (optional), prewarm script, wipe command, rehearsal pass.

Phase 1 and Phase 2 are parallelizable. Phase 2 backend and frontend are parallelizable once the migration lands.
