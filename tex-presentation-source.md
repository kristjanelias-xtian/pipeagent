# Building Agents That Touch Your CRM: Engineering TEX Presentation Source Document

## Presenter

Kristjan Elias, Engineering Director at Pipedrive. This presentation covers five months of personal experiments building AI agents on top of Pipedrive CRM, exploring two fundamentally different approaches to agent architecture.

## Presentation Purpose

An engineering TEX (Tech Excellence) session at Pipedrive. Audience is software engineers. The goal is to inspire engineers to build their own agent experiments by showing what was learned from building two very different agent systems -- one highly engineered, one radically freeform -- and what that teaches about the design space for AI agents in CRM products.

---

# PART 1: THE CENTRAL QUESTION

## What happens when you give an LLM access to your CRM and tell it to do sales work?

This is the question that drove five months of experiments. Not "can we add AI to Pipedrive?" but something more specific: when it's time to decide what happens next, who decides -- the framework or the model?

That single question -- where does decision-making authority live? -- determines the entire shape of the system you build. It determines how you store state, how you deploy changes, how you handle failures, how much things cost, and what surprises you.

Two sub-questions:
- How much should the framework decide? (Graph edges, typed state, explicit transitions)
- How much should the model decide? (Prose instructions, freeform reasoning, emergent behavior)

The answer is not "one or the other." It depends on the job. But to understand why, you have to build both ends and feel the difference.

---

# PART 2: THE EXPERIMENT PORTFOLIO

Five repositories form the experiment portfolio. Two are the main experiments; three are supporting infrastructure.

## Main Experiments

### pipeagent -- The Engineered Pipeline
An AI-powered agent hub for Pipedrive CRM built with LangGraph. Two active agents: Lead Qualification and Deal Coach. Deployed live at pipeagent.xtian.me on Railway. The graph decides what happens next. Claude is used as a function -- you call it, parse its output, move to the next node.

One-line summary: Agents as software. Deterministic, typed, audit-logged, boring in all the right ways.

### digital-pd-team -- The Hired Team
Three Claude-powered bots (Lux the SDR, Taro the Account Executive, Zeno the Sales Manager) operating a fictional Estonian solar company called NordLight Solar Solutions inside a real Pipedrive instance. They coordinate via a Telegram group. There is no workflow engine, no DAG, no state machine. The model decides what happens next.

One-line summary: Agents as employees. Persistent, conversational, improvisational, a little bit weird.

## Supporting Infrastructure

### pd-helpers
A shared TypeScript CLI toolkit for seeding and managing Pipedrive test data. Four commands: pd-seed (creates test leads from a 20-item Estonian company pool), pd-wipe (clears all data), pd-prewarm (fills pipeagent's org_memory cache before demos), pd-setup (idempotent account provisioning -- creates pipeline, stages, custom fields, labels). This project solves a critical demo preparedness challenge: when running live experiments with AI agents acting on Pipedrive CRM, you need repeatable, clean test data.

### openshell-tools
A shared bash script library for managing OpenShell/OpenClaw sandboxed environments across multiple projects on a single Mac Mini. Provides declarative, idempotent infrastructure operations: backup, restore, deploy, upgrade. Key insight: bot systems have both configuration (push from git) and runtime state (memory, sessions, credentials to preserve). These scripts respect that split.

### home-ai
A personal home automation system running two Claude-powered AI assistants (Alfred for Kristjan, Luna for Kairi) on a Mac Mini in Estonia. Integrates with Home Assistant, Cloudflare Workers, and Telegram. This was the proving ground for patterns later applied to the sales bots: heartbeat polling, sandbox lifecycle management, policy-enforced network isolation, per-user identity management.

---

# PART 3: EXPERIMENT 1 -- PIPEAGENT (The Engineered Pipeline)

## Architecture and Tech Stack

Monorepo structure using pnpm workspaces:
- apps/server: Hono HTTP server running LangGraph agents
- apps/web: React 19 SPA hub for viewing agent status and outputs
- packages/shared: TypeScript types shared across apps
- supabase/: PostgreSQL migrations for persistence

Infrastructure: Hono (lightweight Node.js HTTP framework), LangGraph (state machine with PostgreSQL checkpointing), Claude Sonnet via Anthropic SDK and LangChain, Supabase PostgreSQL with Realtime for client subscriptions, React 19 + Vite 6 + Tailwind CSS 4, Pipedrive API v1 with OAuth 2.0. Deployed on Railway with Docker.

## Lead Qualification Agent

A LangGraph StateGraph that qualifies inbound leads against an Ideal Customer Profile (ICP) with human-in-the-loop review. The flow:

fetchContext -> checkMemory -> [is research fresh?] -> runResearch -> saveResearch -> runScoring -> writeBack -> [is lead cold?] -> runOutreach -> hitlReview -> logActivity

Key characteristics:
- Bounded cost: maximum 3 LLM calls per lead (research, score, outreach). If research is cached in org_memory, only 2 calls.
- Each LLM call is tuned differently: research uses raw Anthropic SDK with web_search tool at default temperature; scoring uses ChatAnthropic at temperature 0 for consistency; outreach uses temperature 0.7 because email copy needs a heartbeat.
- Human-in-the-loop: the graph pauses at hitlReview via LangGraph's interrupt() mechanism. The frontend shows the draft email. The user clicks send, edit, or discard. The server resumes with the decision.
- Checkpointing: PostgreSQL checkpointer stores full run state by thread_id. You can kill the server mid-run, redeploy, and resume from exactly where you stopped.
- Activity logging: every node writes to an activity_logs table (node_enter, node_exit, tool_call, llm_call). The frontend renders this as an Inspector UI.
- Memory optimization: research results cached in org_memory table for 7 days to avoid redundant web searches.

## Deal Coach Agent

A second LangGraph StateGraph that analyzes deal health and suggests next actions:

fetchDealContext -> analyzeSignals -> scoreHealth -> generateActions

- Signal extraction: Claude identifies positive, negative, and warning signals from deal data (activities, notes, participants, org info, stage duration)
- Health scoring: calculates 0-100 score based on signal ratio, activity recency, stage staleness
- Action suggestions: proposes 3-5 prioritized actions (email, task, meeting, research)
- Chat interface: follow-up coaching questions answered via Claude using cached analysis plus conversation history. This is where the Deal Coach crosses from "engineered" into "embodied" -- the structured analysis feeds a freeform conversation.

## Agent Registry Pattern

Six agents defined (two active, four simulated placeholders): Lead Qualification, Deal Coach, Meeting Prep, Email Composer, Data Enrichment, Pipeline Forecaster. Each agent is a distinct graph with typed state, registered with metadata (name, icon, description, scope), accessible from a unified hub UI, and configurable with per-agent identity settings (mission, personality, rulebook, context).

## Hub Configuration System

Global context (hub_config) is shared across all agents -- company profile and positioning. Agent identity (agent_identity) stores per-agent settings -- ICP criteria, followup days, personality, mission statement. Per-agent local context (agent_config) allows customizations for each agent at each connection.

## What Worked Well (pipeagent)

1. Predictable cost and compute: Lead qualification runs at known LLM call count. Can forecast monthly spend from volume.
2. Auditable execution: Every step logged to activity_logs table with structured fields. The Inspector UI shows the full trace.
3. Resumable execution: PostgreSQL checkpointer stores state. Server restart mid-run does not lose progress.
4. Type safety: StateGraph uses TypeScript Annotation system. All state is typed, all transitions explicit.
5. HITL integration: Pause-and-resume works cleanly. Humans approve before emails are sent.

## Challenges and Trade-offs (pipeagent)

1. Rigid DAG: The flow is fixed at design time. Anything requiring iteration or improvisation pushes against the graph. You can feel the seams.
2. Change latency: Agent behavior changes require code edit, rebuild, redeploy. Minutes per iteration. When the unit of change is TypeScript, every change has the weight of code.
3. Seams are visible: Decomposition into steps (research, score, outreach) is useful for predictability but artificial compared to how humans qualify leads.
4. Simulation agents are placeholders: Four agents in the registry are UI stubs. Demonstrates extensibility but does not prove it works at scale.

---

# PART 4: EXPERIMENT 2 -- DIGITAL-PD-TEAM (The Hired Team)

## Architecture and Tech Stack

Core components:
- Three bots running in OpenShell sandboxes (Lux/SDR, Taro/AE, Zeno/Sales Manager)
- Telegram group ("NordLight Sales") as primary communication channel and human visibility layer
- Webhook relay (Express, port 3000, Tailscale Funnel) routing Pipedrive webhooks and bot-to-bot triggers
- Pipedrive instance (nordlight-digital-pd-team.pipedrive.com) as shared CRM
- Python CLI helpers (pd-search, pd-new-lead, pd-convert-lead, pd-advance-stage, pd-note, etc.)

Infrastructure: OpenShell + OpenClaw (Claude Code persistent harness), Tailscale Funnel for public HTTPS webhook ingress, Claude Sonnet 4.5/4.6, Mac Mini (Apple Silicon) running Colima VM + Docker + OpenShell gateway. Persistent storage in sandbox filesystems with daily backups via launchd.

## The Three-Bot Team

Lux Bot (SDR): Owns the leads inbox. Qualifies leads with a 0-100 ICP score, labels them Hot/Warm/Cold, converts Hot leads to deals, hands off to Taro. Cannot create deals directly -- only through pd-convert-lead which enforces business rules.

Taro Bot (Account Executive): Owns deals from Qualified through Contract Signed. Handles discovery, site visits, proposals, negotiation, closing. Cannot archive leads or create new leads -- his helpers don't provide those capabilities.

Zeno Bot (Sales Manager): Pipeline oversight. Nudges stuck deals, escalates big deals, coaches the team. Read-only -- no record creation. Sees webhook events via DM from the relay server.

Key design principle: Each bot owns a lane. Ownership boundaries are enforced by SKILL.md files and helper CLI constraints, not code. Taro literally cannot archive a lead because his helpers don't provide that capability. The helper guarantees the result; the LLM just has to call it.

## Natural Language Coordination

Bots communicate entirely in conversational prose in the Telegram group:
- "Lux, qualify this lead -- Eva Pirita, residential in Pirita"
- "Got it. Eva's got south-facing roof, motivated buyer. Hot 82. Moving to Qualified."
- "Deal #45 -- Eva Pirita. Site visit booked Apr 9, 10:00."

No raw JSON, no webhook payloads, no IDs in group messages. The webhook relay is the only component that speaks structured data (DM'd only to Zeno).

Telegram limitation: bots cannot see each other's messages in groups. So the webhook relay also handles bot-to-bot handoffs via a 13-line POST /trigger endpoint that dispatches messages between bots. This is the most load-bearing duct tape in the whole project. It is absurd. It works.

## Skill-Based Instruction System

Bots are taught with markdown files, not code:
- IDENTITY.md (~20 lines): Personality, voice, tone, what they never do. Examples: "Lux is fast, friendly, and direct. She never makes small talk in the group chat." "Zeno is calm and coaching-minded. He never panics."
- rulebook-base.md (~35 lines): Non-negotiables every bot inherits. Examples: 8 lines max per message, no emoji/bold/tables in group chat, search before you create, use pd-* helpers not raw curl, stay in your lane, one message per milestone not running commentary.
- SKILL.md (~45 lines): Role-specific playbook. Decision trees, scoring rubric references, handoff protocols.

Deployment: deploy-skill.sh merges all three into a single file at ~/.openclaw/agents/main/agent/IDENTITY.md. Deploy a skill change in seconds. No restart. No memory loss. The bot picks it up on the next message.

## Helper-First Architecture

Eight Python CLI helpers enforce CRM rules by construction:
- pd-search: Find persons/orgs/deals by text
- pd-new-lead, pd-new-deal: Create with validation
- pd-convert-lead: Atomic lead-to-deal conversion with race guards and idempotency. Refuses to convert already-archived leads. Will not create duplicate deals within 5 minutes.
- pd-advance-stage, pd-note: Update with safety checks

Bots call helpers instead of raw Pipedrive API. The helper guarantees the result; the LLM just has to call it. This is a key architectural insight: you can constrain agent behavior without constraining the model's reasoning. Let the model think freely, but wrap the actions in guardrailed CLIs.

## Webhook Routing and Trigger Relay

YAML-driven routing (webhook-server/routing.yaml): Event type maps to owning bot (leads/persons/orgs go to Lux, deals go to Taro, deletes go to Zeno). Built-in deduplication: exact dedupe at 15 seconds, rollup dedupe at 90 seconds per person_id per bot. Self-trigger filter drops events fired by bots themselves.

The trigger relay (POST /trigger) is a 13-line endpoint that works around the fact that Telegram bots cannot see each other's messages in groups. When Lux converts a lead and wants to hand off to Taro, she calls the trigger relay, which dispatches the message to Taro's openclaw gateway.

## Persistent Bot Memory

Each bot maintains its own workspace filesystem:
- SOUL.md: Self-model (personality evolution over time)
- USER.md: What the bot knows about the human operator
- AGENTS.md: Understanding of teammates
- HEARTBEAT.md: Heartbeat task state
- memory/YYYY-MM-DD.md: Daily prose log

Bots write their own memory in natural language. No schema. No database. Restores via restore-state.sh from daily backups (03:00 via launchd agent).

## Proactive Agency

Bots wake themselves on 15-20 minute heartbeats and ask "what am I worried about?" This is not a scheduled job -- it is emergent agency:
- Zeno notices deals sitting too long in a stage; pokes Taro
- Lux qualifies leads on her own schedule (proactive mode toggle via Telegram)
- Taro pursues next actions on open deals

Nobody asked them to check. They have a workday. This is the difference between a system that runs when you tell it to and a system that has a workday.

## NordLight Solar Company Profile

Fictional Estonian solar installer used for grounding bot behavior: 15 employees, EUR 1.8M revenue, based in Tallinn. Residential systems EUR 7K-18K, commercial EUR 20K-80K. 7-stage pipeline (New Lead, Qualified, Site Visit, Proposal, Negotiation, Verbal Agreement, Contract Signed). 10+ sample deals loaded with realistic sales cycle (35-day residential, 22% lead-to-close rate). This gives bots a realistic operating environment with seasonal patterns, customer personas, and deal mechanics.

## What Worked Well (digital-pd-team)

1. Tight feedback loops: Deploy a skill change in seconds. No restart, no memory loss. Bot picks it up on next message. Every skill rewrite is a cheap experiment.
2. Emergent behavior: Bots do things not explicitly programmed. Zeno flags anomalies. Taro coaches Lux on handoffs. Bots joke with each other. What happens when you treat the model like an employee.
3. Natural language troubleshooting: When something breaks, bots message the human in natural language. No cryptic error logs.
4. Role clarity: Ownership boundaries are prose rules in SKILL.md, enforced by helper CLI constraints.
5. Coordination without orchestration: Three bots coordinate through mention patterns and a 13-line relay. No central router, no orchestrator.

## Challenges and Trade-offs (digital-pd-team)

1. Unbounded cost: No cap on LLM think time. Lux might spend 3 seconds or 3 minutes qualifying a lead. Monthly spend is unpredictable.
2. Observability gaps: No audit trail except Telegram scrollback. Errors are "bot sends me a DM" which only scales to about 5 bots before drowning in noise.
3. Compliance risk: Rules are prose. Only enforcement is asking the model to follow it. At scale, you would need typed, checkpointed audit logs.
4. Sandbox fragility: Sandbox state dies between backups. Colima VM crashes are common; recovery requires manual intervention.
5. Scale limits: System breaks around 5 bots. Telegram group gets noisy. Trigger relay becomes bottleneck. Prose-based ownership gets fuzzy.

---

# PART 5: THE DESIGN SPACE

## The Central Thesis

Strip everything away and the difference between these two systems is a single question: when it is time to decide what happens next, who decides?

In pipeagent, the graph decides. The edges say: after scoring, if the label is cold, skip outreach and go to logActivity; otherwise draft an email and pause for HITL. That decision is encoded at design time. Claude's job is to fill in the contents of each node, but Claude never chooses which node runs next. The control flow is in the code.

In digital-pd-team, the model decides. When a webhook wakes Zeno up, nothing tells him what to do. He reads the DM, reads his identity, reads his skill file, reads his workspace memory, and then makes a call. Sometimes he posts to the group. Sometimes he pulls more data from Pipedrive first. Sometimes he decides the webhook is noise and goes back to sleep. The control flow is in the prompt.

Every other architectural difference -- state, tools, observability, deployment, failure modes -- is a downstream consequence of this one choice.

## Two Axes of the Design Space

X-axis: "Graph decides" to "Model decides" -- who has authority over control flow?
Y-axis: "Structure in code" to "Structure in prose" -- where is agent behavior encoded?

pipeagent sits in the bottom-left quadrant: compiled pipelines. Structure in code, graph decides.
digital-pd-team sits in the top-right quadrant: hired teammates. Structure in prose, model decides.

The two axes are correlated but not identical. Most systems cluster along the diagonal, which is why the split feels like one dimension. But interesting systems live off-diagonal: LangGraph's supervisor pattern gives the model routing authority while keeping the tool surface typed. CrewAI keeps agents role-based and typed in Python while letting their collaboration be fairly emergent.

Most of the industry in 2026 is converging on the middle band of this space.

## Detailed Comparison Table

Agent definition: pipeagent uses StateGraph with typed Annotation nodes. digital-pd-team uses a sandbox plus IDENTITY.md plus SKILL.md files.

Where the agent lives: pipeagent lives in apps/server/src/agent/graph.ts. digital-pd-team lives on a Mac Mini running an openclaw gateway.

Unit of change: pipeagent requires edit TypeScript, rebuild, redeploy. digital-pd-team requires deploy-skill.sh (no restart).

Identity: pipeagent has agentId in a registry (e.g., "deal-coach"). digital-pd-team has a personality ("Zeno, calm, coaching-minded, never panics").

Lifespan: pipeagent agents are runs -- seconds to minutes, die when they return. digital-pd-team agents are personas -- days to weeks, keep a diary.

Control flow: pipeagent uses explicit DAG with conditional edges. digital-pd-team uses event, wake, read files, reason, act, post, sleep.

Cost model: pipeagent is bounded (at most 3 LLM calls per lead). digital-pd-team is unbounded (open-ended per session).

State persistence: pipeagent uses PostgreSQL checkpointer (state as database rows). digital-pd-team uses filesystem (state as prose markdown files).

Multi-agent: pipeagent uses registry pattern (independent agents, don't talk to each other). digital-pd-team uses coordination via Telegram group and trigger relay (actual teamwork).

Human in the loop: pipeagent uses a graph node with pause and resume semantics. digital-pd-team uses "I'm in the group chat" -- the human is always part of the conversation.

Context assembly: pipeagent builds prompts node-by-node, tightly scoped (context is a function argument). digital-pd-team builds prompts by layering identity, skills, workspace files, memory, Telegram scrollback (context is a workspace).

Trigger model: pipeagent is reactive only -- something must happen (webhook, user click). digital-pd-team is reactive and proactive -- also wakes on heartbeats.

Failure mode: pipeagent catches errors, logs them, sets run status to failed, stops. digital-pd-team has one recovery strategy: DM the human.

Observability: pipeagent produces structured activity logs with typed fields, powering an Inspector UI. digital-pd-team produces Telegram scrollback and a compliance check script.

Trust model: pipeagent does not trust the model with the runtime; wraps every LLM call in types, checkpoints, logs, fallbacks. digital-pd-team trusts the model completely; there is no scaffolding, just a persona, a skill file, a shell, and a chat app.

How Claude is used: In pipeagent, Claude is a function -- you call it, it returns a value, you move on. In digital-pd-team, Claude is the runtime -- the LLM is the system, not a component of the system.

The feedback loop: Changing pipeagent means edit TypeScript, rebuild, restart server, check logs, maybe redeploy to Railway (minutes per iteration). Changing digital-pd-team means edit a markdown file, run deploy-skill.sh, send a Telegram message to test (seconds per iteration, no restart, no memory loss).

## Which Architecture for Which CRM Job?

Lead Qualification: Recommended engineered approach. Why: High volume, repeatable, cost-sensitive. ICP scoring has a clear right answer. Customers want predictability here, not personality.

Data Enrichment: Recommended engineered approach. Why: Deterministic, auditable, boring-on-purpose. Mistakes are expensive and visible; every field needs provenance.

Pipeline Forecaster: Recommended engineered approach. Why: Numeric, evaluable, needs consistency across quarters. This is the job the CFO will scrutinize most.

Meeting Prep: Recommended engineered with one judgment step. Why: Research-heavy but the output shape is stable. The one thing that benefits from improvisation is what to look up -- a small judgment surface inside a larger pipeline.

Deal Coach: Recommended middle ground (manager plus specialist). Why: Structured health scoring (engineered) plus freeform chat with the rep (embodied). This is the clearest case for the middle of the map. This is also where the clearest user-experience wins are hiding.

Email Composer: Recommended embodied (or strong middle). Why: Voice matters. Drafts need personality. Iteration is the product. This is where "AI smell" kills user trust, and embodied agents -- the ones with a real persona -- are meaningfully less smelly.

Key claims this mapping makes:
1. Most of the registry is engineered. Four of six jobs land in the predictable-automations quadrant. Reliability is the edge for these.
2. Deal Coach is the interesting one. It is where the two philosophies genuinely meet.
3. Email Composer wants a persona. The risk is not correctness -- it is taste.
4. A "RevOps Teammate" -- not a single job, but a continuous presence that notices and nudges -- is where embodied agents shine, and it is a shape the current registry has nothing for.

## The Framework Is a Decision About Trust

LangGraph lets in a function. Claude Code lets in a whole employee. Both are rational choices. The CRM job determines which is right.

pipeagent answers: "How do we build agents that ship to customers?" -- predictable, auditable, cost-bounded, with HITL reviews that actually work.

digital-pd-team answers: "What do agents feel like when we stop scaffolding them?" -- what emerges when the model is the runtime, not a function inside one.

The architecture follows from where you put decision-making authority, not the other way around.

## Relationship to Industry Patterns

Anthropic's "Building effective agents" essay distinguishes workflows (systems where LLMs and tools are orchestrated through predefined code paths) from agents (systems where LLMs dynamically direct their own processes and tool usage). pipeagent is a workflow. digital-pd-team is an agent system.

Workflow patterns (graph decides): prompt chaining (pipeagent's lead qualification), routing (agent registry), parallelization (fan out subtasks), evaluator-optimizer (generate + critique + loop).

Agent patterns (model decides): autonomous tool loop / ReAct-style (one digital-pd-team bot per session), supervisor (Zeno informally via Telegram), hierarchical teams (supervisors of supervisors), swarm (decentralized agents observing shared workspace -- digital-pd-team is approximately a swarm).

The honest answer to "which pattern should I pick?" is: pick based on where you want the decision-making to live, then pick the pattern within that half of the map that matches how predictable your task is.

The choice is not permanent or pure. A workflow can grow an agent loop inside a single node when that step needs improvisation. An agent system can grow a workflow subgraph for a well-understood subtask. Most real systems should live somewhere in the middle, and the fun of this space right now is that the middle is still largely unbuilt.

---

# PART 6: SUPPORTING INFRASTRUCTURE

## pd-helpers: Test Data Toolkit

Solves the critical demo preparedness challenge. Four CLI commands:

pd-seed: Picks a random lead from a 20-item pool of Estonian companies, creates it in target Pipedrive account(s), with deduplication by email to prevent reuse. Supports --name to pick a specific lead, --list to show pool availability, --dry-run for preview.

pd-wipe: Destructively clears all leads, persons, and organizations. Respects FK references (deletes in order). Rate-limited at 250ms between deletes. Requires --confirm flag.

pd-prewarm: Seeds 15 leads and fires pipeagent webhook for each to fill its org_memory cache before a demo. Makes stage pacing predictable.

pd-setup: Idempotent account provisioning. Creates pipeline, stages, custom fields, labels from config files. Skips resources that already exist. Safe to re-run. Outputs anchors JSON with all generated IDs.

The pool: 20 Estonian companies with realistic attributes (name, contact, email, phone, industry, employee count, notes). Each has a stable slug for repeatability.

## openshell-tools: Sandbox Lifecycle Management

Key scripts:
- backup-bot.sh: Snapshots full sandbox state to local disk with latest symlink
- restore-bot.sh: Creates sandbox from scratch, uploads config, starts gateway. Safety backup of existing state before restore.
- deploy-skill.sh: Pushes skill updates without restarting. Zero downtime. About 2 seconds.
- restart-all.sh: Orchestrates full restart of all bots. Auto-discovers bots, backs up all, restores all.
- check-services.sh: Health check for Ollama, Colima, Docker, gateway, SSH tunnels.

The config vs state split is the key insight:
- Config (push from git): openclaw.json, IDENTITY.md, policy.yaml, auth-profiles.json, SKILL.md
- State (preserve across restarts): SOUL.md (bot's self-model), sessions/ (conversation history), telegram/ (update offsets), workspace files (evolving knowledge)

Rule: restore-bot.sh backs up state before wiping, so state survives config updates.

## home-ai: The Proving Ground

Two production bots running stably for months:

Alfred (Kristjan's assistant, English): Garbage collection pipeline (emails from Estonian waste providers -> Cloudflare Email Routing -> Worker -> KV -> Alfred polls on heartbeat -> Telegram reminder). Home Assistant integration for greenhouse monitoring (temperature, humidity, soil moisture via Zigbee sensors).

Luna (Kairi's assistant, Estonian): Home Assistant access, personal reminders, daily organization, Estonian-language output.

Patterns transferred to digital-pd-team: heartbeat polling for autonomous tasks, sandbox state persistence, policy-enforced network isolation, structured bot identity system (IDENTITY.md + SKILL.md split), per-user identity management.

## Operational Learnings Across All Projects

Config vs state split: Push instructions from git, preserve bot memory across restarts. This distinction is fundamental -- config is version-controlled, state is backed up.

Heartbeat polling: Bots wake themselves periodically and ask "what am I worried about?" This pattern originated in home-ai (garbage collection polling) and became the basis for proactive agency in digital-pd-team.

Helper-first design: Wrap API calls in CLIs that enforce business rules by construction. The model reasons freely; the actions are constrained. You can trust the model's judgment without trusting it with raw API access.

Policy-enforced network isolation: Network egress controlled per sandbox via policy.yaml, not per prompt. Even if the bot is compromised, it cannot bypass network controls.

Seconds-to-deploy: deploy-skill.sh pushes a skill change with zero downtime. When the unit of change is prose and the deploy is a file copy, you iterate differently. The feedback loop is tighter, so you learn faster what the model is willing to do.

Prose as interface: When the unit of change is a markdown file, iteration is cheap and experiments are fast. Every skill rewrite is a cheap experiment. In pipeagent, every change has the weight of code.

---

# PART 7: IMPLICATIONS AND TAKEAWAYS

## For Pipedrive Product

Agents are coming to CRM. The question is not if but how much control to give the model. Our customers will face this same spectrum.

Some jobs need predictable automations -- lead qualification, data enrichment, pipeline forecasting. These want bounded cost, structured audit trails, and resumable execution.

Some jobs need judgment and voice -- email composition, deal coaching, RevOps teammates. These want personality, improvisation, and the ability to notice things nobody asked about.

The interesting work is in the middle band -- where structured analysis feeds freeform conversation, where typed workers serve a model-driven orchestrator.

We should understand both ends of the spectrum, not just the safe one. The "horrible mess" of digital-pd-team is not a failure mode -- it is what happens when you stop pretending the model is a library and start treating it like a person on your team. That experience changes how you think about what to build.

## For Engineers

Build one. The gap between reading about agents and building one is enormous.

Start with:
1. A helper CLI that wraps your API with safety checks
2. A markdown file that describes what the agent should do
3. A trigger (webhook, cron, Telegram message)
4. Claude

You do not need LangGraph. You do not need a framework. You do not need infrastructure. You need a prompt, a shell, and something to trigger it. You will learn more in a weekend than from a month of reading papers and blog posts.

Once you have built one and felt what it is like, you will have opinions about where on the design space map your problem sits. Those opinions will be grounded in experience, not theory. That is the point.

## Open Questions

1. Where would you invest first if this were a real product? A deep engineered pipeline that ships reliably and becomes table stakes, or a pilot embodied teammate that feels like a product no competitor has?

2. What is the edge? Is the pitch "the most reliable CRM agents in the market" or "the most alive ones"? These need different investments, different storytelling, and different hires.

3. Which low-risk job is the best place to pilot the other philosophy? Email Composer is the most defensible middle choice. RevOps Teammate is the most ambitious.

4. Who owns the judgment surface? For every embodied agent you ship, someone has to decide how much room it is allowed. That is a product-and-design question, not an engineering one.

---

# PART 8: KEY QUOTES FOR SLIDES

These are the most impactful one-liners from the essays and experiments, suitable for featuring prominently on slides:

"The framework you pick is just a decision about how much of Claude you're willing to let into your system."

"LangGraph lets in a function. Claude Code lets in a whole employee."

"pipeagent = agents as software. digital-pd-team = agents as employees."

"The helper guarantees the result; the LLM just has to call it."

"The architecture follows from where you put decision-making authority, not the other way around."

"One of these ships. The other teaches you what agents feel like when they have a voice and coworkers."

"Claude is a function. You call it, it returns a value, you move on." (pipeagent)

"Claude is the runtime." (digital-pd-team)

"Both work. One makes promises. The other makes eye contact." (on HITL approaches)

"The 'horrible mess' isn't a failure mode. It's what happens when you stop pretending the model is a library and start treating it like a person on your team."

"When the unit of change is prose and the deploy is a file copy, you iterate differently."

"It is the difference between a system that runs when you tell it to and a system that has a workday."

"Build one. The gap between reading about agents and building one is enormous."

---

# PART 9: SUGGESTED SLIDE STRUCTURE

For a 20-25 minute TEX talk, approximately 20 slides:

Section 1 - Setup (3 slides): Title slide, the central question, experiment portfolio overview
Section 2 - pipeagent (4 slides): Architecture overview, lead qualification flow diagram, deal coach, learnings and trade-offs
Section 3 - digital-pd-team (5 slides): Architecture overview, three-bot team structure, helper-first design, emergent behavior examples, learnings and trade-offs
Section 4 - Design Space (4 slides): Two-axes quadrant diagram, detailed comparison table, job-to-architecture recommendation table, trust thesis
Section 5 - Supporting Infrastructure (2 slides): pd-helpers + openshell-tools + home-ai overview, operational learnings
Section 6 - Implications (3 slides): For Pipedrive product, for engineers ("build one"), resources and links

## Visual Suggestions

- The quadrant chart (design space map) is the single most important visual. pipeagent bottom-left (blue), digital-pd-team top-right (red), with gray dots for other industry positions.
- The lead qualification DAG flow diagram (fetchContext -> checkMemory -> ... -> logActivity) with conditional branches highlighted.
- The three-bot team diagram showing Lux, Taro, Zeno with their roles and ownership lanes, connected by the Telegram group.
- A side-by-side comparison showing the same lead being processed: pipeagent's structured log vs digital-pd-team's Telegram conversation.
- Screenshots of the pipeagent web UI (Inspector view, Deal Coach analysis, hub layout) if available.
- Screenshots of the Telegram group showing bot coordination if available.

---

# APPENDIX: REFERENCES

Anthropic, "Building effective agents" -- canonical taxonomy of workflow and agent patterns
LangGraph documentation, Multi-agent systems -- network, supervisor, hierarchical, and swarm architectures
LangChain blog, "Benchmarking multi-agent architectures" -- empirical comparison
Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (2022) -- original tool-loop pattern
Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (2023) -- self-critique loops

Live demo: pipeagent.xtian.me
All experiment repositories available internally.
