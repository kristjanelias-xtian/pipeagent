# Resume State — PD Helpers + pipeagent Redesign

**Last updated:** 2026-04-11

This is a handoff document for a restarted Claude session. Read this first — it tells you where the work stands, what's done, what remains, and exactly how to continue.

---

## Mental model (read this)

You (Claude, in a fresh session) are resuming a multi-part project for the user **Kristjan** (solo dev, building pipeagent). The project has three pieces, brainstormed end-to-end in a previous session:

1. **Spec** — already written, committed, and reviewed.
2. **Plan A** (`pd-helpers` CLI) — already written, partially executed (Tasks 1–2 done, Tasks 3–15 pending).
3. **Plan B** (pipeagent redesign) — already written, not yet started.

The user is driving toward a **TEX session demo** where they'll show pipeagent (LangGraph hub) and `../digital-pd-team` (sandboxed bot team) side-by-side as "two ends of the agent spectrum." A shared CLI (`pd-helpers`) seeds identical leads into both Pipedrive accounts for the demo.

---

## Key file locations

| Thing | Path |
|---|---|
| Spec | `docs/superpowers/specs/2026-04-11-pd-helpers-and-agent-hub-redesign-design.md` |
| Plan A (pd-helpers CLI) | `docs/superpowers/plans/2026-04-11-pd-helpers-cli.md` |
| Plan B (pipeagent redesign) | `docs/superpowers/plans/2026-04-11-pipeagent-redesign.md` |
| This resume doc | `docs/superpowers/plans/RESUME.md` |
| pd-helpers repo | `~/git/pd-helpers/` (sibling to pipeagent, independent git repo) |
| pipeagent repo | `~/git/pipeagent/` (this repo) |
| digital-pd-team | `~/git/digital-pd-team/` (sibling) |

---

## Current state

### pd-helpers repo — Tasks 1–2 complete

`~/git/pd-helpers/` is initialized with two clean commits on `main`:

```
5130e51 feat: define shared types for pool, targets, and PD responses
494914d chore: init pd-helpers repo with TypeScript + Vitest
```

Files present:
- `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `vitest.config.ts`, `pnpm-lock.yaml`
- `src/types.ts` with all shared types (`SeedLead`, `TargetConfig`, `PDPerson`, `PDLead`, `PDDeal`, `InUseCheck`, `CreateResult`, etc.)
- `tests/` directory exists but empty (first test file lands in Task 3)

`pnpm install` has been run. `pnpm typecheck` exits 0.

**Tasks 3–15 of Plan A are not started.** They build the rest of the CLI: pool data, args parser, targets loader, pd-client (TDD with mocked fetch), dedupe, seed-core, pd-seed entrypoint, wipe-core, pd-wipe entrypoint, prewarm-core, pd-prewarm entrypoint, README, and a manual end-to-end verification.

### pipeagent repo — nothing started for Plan B

`~/git/pipeagent/` is on `main` with the following recent commits (all from the brainstorming session):

```
(latest) chore: clean up stale imports and dead code after identity refactor    ← NOT YET
        ...
        docs: add Plan A — pd-helpers CLI implementation plan
        docs: brainstorming spec for pd-helpers + pipeagent redesign
        ...
```

**No code changes from Plan B have been made yet.** The spec, Plan A, Plan B, and this resume document are committed. That's it.

### Task tracking

Any in-session task tracking (TodoWrite entries) from the previous session will be gone. If you want to track Plan B execution, create fresh TodoWrite entries from Plan B's task headings.

---

## How to continue — three modes

### Mode 1: Finish Plan A first (recommended — unblocks Plan B testing)

Plan A has 13 tasks left (3–15). Each is TDD-style and self-contained. Plan A is 100% mechanical — the exact code for every file is already in the plan document. No architectural decisions remain.

**Suggested execution:**

1. Load the plan:
   ```
   Read docs/superpowers/plans/2026-04-11-pd-helpers-cli.md
   ```
2. Use the `superpowers:subagent-driven-development` skill to dispatch a subagent per task. Or use `superpowers:executing-plans` for inline execution.
3. **Critical:** the plan is checked into pipeagent's git, but Plan A's *code* lives in `~/git/pd-helpers/`. All commits from Tasks 3–15 happen in the `pd-helpers` repo, not pipeagent. Don't confuse the two.
4. Each task in Plan A has explicit test counts. After Task 15, `pnpm test` in `~/git/pd-helpers/` should show ~59 tests passing.

**Known issue flagged during Plan A writing:** the spec's demo choreography names "Mari Tamm · Pirita residential" as the hero lead, but Mari Tamm is NOT in pipeagent's original 20-item pool (she's from `digital-pd-team/scripts/create-smoke-lead.sh`). Plan A ships with the 20 original entries and uses "Andrus Koppel · Smarten Logistics AS" as the pool test anchor. Decide before TEX:
- Add Mari Tamm as a 21st pool entry in `pd-helpers/src/pool.ts`, OR
- Update the demo choreography to use Andrus Koppel instead

Not a blocker — noted at the end of Plan B.

### Mode 2: Start Plan B (pipeagent redesign)

Plan B is much larger — 27 tasks across 11 phases. It refactors pipeagent's schema (3 tables → 2), backend routes, LangGraph state, research streaming, frontend visual tokens, sidebar/topbar/home restyle, and completely rewrites the Lead Qualification workspace around an identity-centric UI.

**Phases:**

- **B1 — Schema migration** (Tasks 1–2) — write migration SQL, dry-run on local Postgres, apply to production with a Supabase backup first
- **B2 — Shared types + registry** (Tasks 3–4) — update `packages/shared` and `apps/web/src/agents/registry.ts`
- **B3 — Backend routes** (Tasks 5–7) — replace `hub-config`/`agent-config` routes with `company-profile`/`agent-identity`; strip ICP from settings
- **B4 — LangGraph state refactor** (Tasks 8–9) — snapshot `company_profile` + `agent_identity` into `AgentState` via `fetchContext`, read from state in scoring/outreach/deal-coach
- **B5 — Research streaming** (Task 10) — switch `research.ts` to `.stream()` with phase + token events
- **B6 — Frontend visual foundation** (Tasks 11–14) — install `lucide-react`, create `AgentIcon` whitelist, update Tailwind theme tokens (Pipedrive light), restyle `HubShell`/`Sidebar`/`TopBar`/`LoginPage`
- **B7 — Shared frontend components** (Tasks 15–17) — `AgentAvatar`, `useCompanyProfile`, `useAgentIdentity`, `CompanyProfileEditor`, `IcpEditor`
- **B8 — Lead Qualification workspace** (Tasks 18–22) — `IdentityRail` (with in-place edit mode), `ActivityStream`, `InboxStrip`, rewrite `Workspace.tsx`
- **B9 — Home page** (Task 23) — rewrite `Home.tsx` with "meet your team" framing
- **B10 — Settings + cleanup** (Tasks 24–26) — strip Business Context tab, delete seed code, hunt stale imports
- **B11 — Optional TEX polish** (Task 27) — demo banner

**Plan B does NOT use TDD** because pipeagent has no test framework. Each task has a "Verify" step (typecheck, build, curl, psql, or browser inspection) instead of tests.

Plan B is much more complex than Plan A and harder to execute automatically — several tasks require reading existing files first to find the current reference patterns (because the full file contents aren't in the plan). A subagent may need to ask questions. **Consider executing in interactive mode rather than pure yolo mode**, so you can answer those questions as they come up.

### Mode 3: Interleave Plan A and Plan B

If the TEX deadline is close and you want to parallelize, Plan A and Plan B touch different repos and are fully independent. You could dispatch Plan A to one subagent session and Plan B to another.

This works cleanly only if both sessions are yours to coordinate. A single Claude session should pick one mode to avoid context pollution.

---

## Key design decisions (so you don't re-litigate them)

These were settled during brainstorming. Don't re-ask Kristjan.

1. **Shared helpers repo is TypeScript, not Python.** Both repos can consume TS; digital-pd-team's Python helpers are sandbox-internal and don't count as unification candidates.
2. **Seeder is a CLI, not an HTTP service.** No UI button. Invocation is terminal-only (`pd-seed`, `pd-wipe`, `pd-prewarm`).
3. **Email-based dedupe.** A pool item is "in use" if its email matches a person with any open lead OR open deal in the target account. No custom fields, no seeder-side state tracking.
4. **New repo `pd-helpers` at `~/git/pd-helpers/`.** Not monorepo, not absorbed into pipeagent or digital-pd-team.
5. **Schema refactor is full migration, not UI-only reconciliation.** Three tables (`business_profiles`, `hub_config`, `agent_config`) become two (`company_profile`, `agent_identity`). ICP criteria, outreach tone, and followup_days all move into `agent_identity.config` JSONB because they're per-agent concerns, not company-wide.
6. **Agent identity has structural (read-only, from registry) and editable (from DB) fields.** Structural: role, scope_in, scope_out. Editable: name, mission, personality, ICP criteria, rulebook. "Build Your Own" is the escape hatch for wanting a different job.
7. **Identity is always visible in the Lead Qualification workspace (left rail) — never hidden behind a Settings tab.** The current "Business Context" Settings tab goes away entirely.
8. **Workspace layout is Option B:** identity left rail + activity stream center + output right rail + inbox bottom strip.
9. **Pipedrive-style light theme everywhere.** Dark theme is deleted. Primary green: `#017737` dark / `#26b67c` bright (approximations — sample the exact hex from pipedrive.com at rehearsal time).
10. **Icons: `lucide-react` through a whitelist map** (`AgentIcon.tsx`) so registry references icons by string name without pulling React/Lucide into `packages/shared`.
11. **Default agent names:** Nora (Lead Qualifier) and Dex (Deal Coach). Stored as `defaultIdentity.name` in the registry. User can override via the identity editor.
12. **Research streams token-by-token in the UI.** This is the "live moment" of the demo. Other LangGraph nodes flip fast from future → done.
13. **In-flight identity edits don't corrupt runs.** `fetchContext` snapshots `company_profile` + `agent_identity` into `AgentState` at run start; all subsequent nodes read from state, not fresh DB.
14. **TEX latency plan:** prewarm 15/20 pool items into `org_memory` before the stage demo so research hits cache on most items. For the "watch research stream" moment, pick one of the 5 unwarmed items. Plus: shorter research prompt, lower `max_tokens` (4096 → 1500), lower `web_search max_uses` (5 → 2).
15. **`pd-helpers/.env` holds both Pipedrive tokens locally.** Not production secrets. `chmod 600`, gitignored, not published. Acceptable for the demo deadline.

---

## What NOT to do

- **Don't add a test framework to pipeagent.** Kristjan explicitly decided against it in the spec. Plan B uses "verify by running" checkpoints.
- **Don't publish `pd-helpers` to npm.** Local repo only, used via `pnpm dev:*` scripts.
- **Don't rebuild the 4 simulated agents.** They stay as "coming soon" placeholders.
- **Don't make "Build Your Own" functional.** It stays as a placeholder teaser.
- **Don't restyle Deal Coach's output UI** (health score cards, chat). It gets only the visual-token flip and an identity rail — nothing else.
- **Don't touch OAuth or JWT middleware** beyond the whitelist update in Plan B Task 7.
- **Don't split Plan B into sub-plans mid-execution.** It's one document; execute it phase-by-phase.
- **Don't skip the Supabase backup** before applying migration 005 to production. Dashboard → Database → Backups → "Create backup now."

---

## Recommended next command for a fresh session

When Kristjan restarts Claude in yolo mode, a clean starting point is:

```
Read docs/superpowers/plans/RESUME.md, then continue executing Plan A from Task 3 using superpowers:subagent-driven-development.
```

That gives the session:
- This status doc for context
- Plan A to execute
- A starting task (Task 3)
- The skill to use for execution

For Plan B, substitute the filename and start at Task 1 of Plan B. **Strongly recommend finishing Plan A first** because Plan B's verification steps assume `pd-helpers` is working — you'll use it to fire test leads at the webhook throughout Plan B.

---

## Open questions Kristjan hasn't answered yet

None blocking. Two soft TBDs flagged in the spec:

1. **Exact Pipedrive brand green hex** — sample from `pipedrive.com` before TEX, update the theme tokens in `apps/web/src/main.css`.
2. **Mari Tamm in the pool** — see the "Known issue" note under Mode 1 above.

Neither blocks execution.
