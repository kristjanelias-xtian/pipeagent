# Agent Hub for Pipedrive — Design Spec

## Overview

A Pipedrive-inspired dashboard that hosts multiple AI sales agents in a unified interface. Users browse agents via a sidebar, view cross-agent activity on a home screen, and drill into individual agent workspaces. The hub demonstrates what "agentic AI" could look like as a native Pipedrive feature.

**Audience:** Pipedrive management, engineering, and product teams (demo/POC).

**Relationship to existing work:** Evolves the current PipeAgent repo. The existing lead qualification agent becomes one agent inside the hub. Same tech stack (React + Vite + Tailwind + Hono + Supabase + LangGraph).

## Agent Lineup

Six agents spanning the full sales cycle: Lead → Enrich → Outreach → Prepare → Coach → Forecast.

| Agent | Purpose | Status |
|-------|---------|--------|
| Lead Qualification | Researches & scores incoming leads against ICP | **Real** (existing) |
| Deal Coach | Analyzes deal health, identifies signals, suggests next actions | **Real** (new build) |
| Meeting Prep | Generates briefing docs before calls | Simulated |
| Email Composer | Drafts personalized outreach & follow-ups | Simulated |
| Data Enrichment | Auto-fills missing contact/company fields | Simulated |
| Pipeline Forecaster | Scores deal health, predicts close probability | Simulated |

A "Build Your Own" teaser card appears at the bottom of the sidebar with a coming-soon state.

## Layout & Navigation

**Approach:** Unified dashboard with agent sidebar (like Slack channels or Pipedrive pipeline views).

**Shell structure:**
- **Top bar** — Agent Hub branding, Pipedrive connection indicator, user avatar
- **Left sidebar** — Agent list with icons, names, and activity hints (e.g., "3 leads today"). Active agent highlighted with green left border. Settings gear at bottom. "Build Your Own +" teaser after divider.
- **Main content area** — Swaps between home screen and agent workspaces

**Sidebar behavior:**
- **Home screen:** Sidebar is expanded (220px) showing icon + name + subtitle
- **Agent workspace:** Sidebar collapses to icon-only (56px) to maximize workspace area

**Home screen** shows:
- Greeting with daily summary ("Your agents processed 23 items today")
- 2x2 grid of agent activity cards — each shows the agent's key metric or most recent action
- Recent Activity feed — unified timeline of actions across all agents, color-coded by agent

## Deal Coach (Real Agent)

### Workspace Layout

Three-panel layout within the main content area:

1. **Deal list panel** (280px, left) — Scrollable list of deals pulled from Pipedrive. Each shows name, plan/value, stage, and status badge (At Risk / Needs Action / On Track). Filter chips at top (All, At Risk, Action Needed). Selected deal highlighted with green left border.

2. **Analysis panel** (flex, center) — For the selected deal:
   - **Header:** Deal name, status badge, value, stage, days in stage. "View in Pipedrive" and "Re-analyze" buttons.
   - **Deal Health Score:** 0-100 visual gauge with trend indicator (↓ 20 pts this week). Color-coded (red < 40, yellow 40-70, green > 70).
   - **Key Signals:** List of positive (✓) and negative (✕) signals identified by the agent. E.g., "No contact in 14 days", "Budget confirmed ($48k)".
   - **Recommended Actions:** Prioritized numbered list. Each action has a title, reasoning paragraph, and an action button (Draft Email, Add Task, View Details). Priority indicated by color (red = urgent, yellow = important, blue = suggested).
   - **Ask About This Deal:** Chat input at the bottom with suggested prompt chips. User can ask follow-up questions with full deal context.

### LangGraph Graph

```
fetchDealContext → analyzeSignals → scoreHealth → generateActions → [chat loop]
```

- **fetchDealContext:** Pulls deal, associated contacts, activities, notes from Pipedrive API
- **analyzeSignals:** Claude identifies positive/negative signals from raw deal data
- **scoreHealth:** Computes 0-100 weighted score from signal categories (engagement recency, stakeholder coverage, competitive pressure, budget confirmation, timeline clarity)
- **generateActions:** Claude produces ranked next-best-actions with reasoning, each tied to a concrete action (email, task, meeting)
- **Chat loop:** User can ask follow-up questions; agent responds with full deal context available

### Data Model

New tables for Deal Coach:

- `deal_analyses` — Cached analysis per deal (health score, signals, actions, timestamp)
- `deal_chat_messages` — Conversation history per deal

Shared tables (existing):
- `agent_runs` — Tracks run status, now includes `agent_id` column
- `activity_logs` — Unified activity feed, now includes `agent_id` column

## Agent Plugin Architecture

Each agent follows a common interface so the hub can host them uniformly:

```typescript
interface AgentDefinition {
  id: string                    // "lead-qualification", "deal-coach", etc.
  name: string
  icon: string
  description: string
  status: "active" | "simulated" | "coming-soon"
  dataScope: "leads" | "deals" | "contacts" | "pipeline"
  handler: CompiledStateGraph | MockHandler
  workspace: React.ComponentType
  defaultConfig: string         // Default agent-local context
}
```

The hub maintains an agent registry. Sidebar, home cards, routing, and settings are all driven from this registry. Adding a new agent means adding one definition file — no hub code changes needed.

### Real Agents

Use LangGraph compiled graphs. The handler is invoked with deal/lead context + merged global/local config. Results are persisted to Supabase and streamed to the UI via Supabase Realtime.

### Simulated Agents

Return pre-built realistic responses from JSON fixtures after a brief delay (1-2 seconds). Each has a full workspace UI that's visually indistinguishable from real agents. Simulated agents also write mock entries to `activity_logs` on startup so the home screen feed shows realistic cross-agent activity. Swapping to real: change `status` to `"active"` and provide a LangGraph handler.

## Context Configuration (CLAUDE.md-style Inheritance)

Two-level context system where agent-local config inherits from and can override global context.

### Global Context (Hub-level)

Free-text field in Settings → Business Context. Describes:
- Company description, industry, size
- Target market / ICP summary
- Key competitors
- Selling style / methodology
- Anything true across all agents

Stored in `hub_config` table. Injected into every agent's system prompt.

### Agent-Local Context (Per-agent)

Free-text field in each agent's expandable section in Settings, or via a Configure tab in the agent workspace. Adds agent-specific instructions:
- Lead Qualification: ICP scoring criteria, priority signals
- Deal Coach: What "at risk" means, action preferences, stage definitions
- Meeting Prep: Briefing format preferences, research depth
- etc.

Stored in `agent_config` table (one row per agent).

### Resolution Order

When an agent runs, it receives: `global context + "\n\n" + agent-local context`. Local overrides global if there's a conflict. Extracted from the existing lead qualification context feature and generalized.

### Settings UI

Settings page with tabs: Business Context | Pipedrive Connection | Notifications.

Business Context tab shows:
- Left column: Global context textarea with save button
- Right column: Expandable accordion of per-agent configs, each with its own textarea and save button
- Info hint explaining inheritance model

## Build Your Own Agent (Teaser)

Clicking the "+" sidebar item opens a page with:
- Headline: "Build Your Own Agent"
- Text field: "Describe what your agent should do..."
- Disabled submit button labeled "Coming Soon"
- Brief copy explaining the vision: "Soon you'll be able to create custom agents using natural language."

No functionality — purely a vision teaser for the demo.

## Routing

React Router with these routes:

- `/` — Home screen (overview dashboard)
- `/agent/:agentId` — Agent workspace (deal-coach, lead-qualification, etc.)
- `/settings` — Hub settings (context config, Pipedrive connection)
- `/build` — Build Your Own teaser page

Sidebar active state driven by current route.

## Migration from Current PipeAgent

The existing lead qualification code needs to be restructured:

1. **Extract global context** from the lead qualification agent into the hub-level config system
2. **Wrap existing agent** in the AgentDefinition interface (add id, icon, status, workspace component)
3. **Add agent_id column** to `agent_runs` and `activity_logs` tables
4. **Restructure the web app** from a single-purpose dashboard to the hub shell with sidebar routing
5. **Move lead qualification workspace** into its own component that mounts inside the hub layout

The existing LangGraph graph, sub-agents, Pipedrive integration, and Supabase setup remain unchanged.

## Visual Design

Pipedrive-inspired but with its own identity as "Agent Hub":

- **Dark sidebar** (#1A2233) with light content area (#F5F6F7)
- **Green accent** (#368764) for CTAs, active states, positive indicators
- **Flat with subtle borders** — cards use 1px borders and minimal shadows
- **Compact, information-dense** — 14px body text, 4px spacing grid
- **System font stack** or Inter — clean, professional, no-nonsense
- **Status colors:** Green (on track), Yellow/orange (needs action), Red (at risk), Blue (informational)
- **Border radius:** 8px cards, 6px buttons/inputs
- **Icons:** Emoji for agent icons in the POC (can be swapped for custom SVGs later)

## Success Criteria

1. Hub loads with all 6 agents visible in the sidebar
2. Home screen shows realistic activity from all agents
3. Lead Qualification works end-to-end (existing functionality preserved)
4. Deal Coach works end-to-end with real Pipedrive deal data
5. Simulated agents show convincing workspace UIs with realistic mock data
6. Context configuration works — changing global context affects agent behavior
7. Build Your Own teaser is visible and communicates the vision
8. The whole thing looks polished enough to demo to Pipedrive leadership
