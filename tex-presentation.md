---
marp: true
theme: uncover
paginate: true
style: |
  section {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    color: #e2e8f0;
    background: #0f172a;
  }
  h1 {
    color: #38bdf8;
    font-size: 2.2em;
  }
  h2 {
    color: #7dd3fc;
    font-size: 1.6em;
  }
  h3 {
    color: #94a3b8;
    font-size: 1.1em;
    font-weight: 400;
  }
  strong {
    color: #f1f5f9;
  }
  code {
    background: #1e293b;
    color: #7dd3fc;
    padding: 2px 6px;
    border-radius: 4px;
  }
  pre {
    background: #1e293b;
    border-radius: 8px;
    padding: 16px;
  }
  blockquote {
    border-left: 4px solid #38bdf8;
    padding-left: 16px;
    font-style: italic;
    color: #94a3b8;
  }
  table {
    font-size: 0.7em;
    margin: 0 auto;
  }
  th {
    background: #1e293b;
    color: #7dd3fc;
  }
  td {
    background: #1e293b;
    color: #cbd5e1;
  }
  a {
    color: #38bdf8;
  }
  section.lead h1 {
    font-size: 2.8em;
    color: #f1f5f9;
  }
  section.lead h3 {
    color: #64748b;
  }
  section.invert {
    background: #1e293b;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
---

<!-- _class: lead -->

# Building Agents That Touch Your CRM

### Kristjan Elias -- Engineering TEX
### What I learned building two very different agent systems on Pipedrive

---

# The question

**What happens when you give an LLM access to your CRM and tell it to do sales work?**

Two sub-questions drove five months of experiments:

1. How much should **the framework** decide?
2. How much should **the model** decide?

> The framework you pick is just a decision about how much of Claude you're willing to let into your system.

---

# The experiment portfolio

**Two main experiments:**
- **pipeagent** -- an engineered LangGraph pipeline. Agents as software.
- **digital-pd-team** -- three autonomous bots in a Telegram group. Agents as employees.

**Three supporting projects:**
- **pd-helpers** -- test data seeding, idempotent Pipedrive account setup
- **openshell-tools** -- sandbox lifecycle, backup/restore, health checks
- **home-ai** -- personal home bots (proving ground for the patterns)

---

<!-- _class: invert -->

# Experiment 1: pipeagent

### The Engineered Pipeline

---

# pipeagent: the graph decides

LangGraph StateGraph with typed state, PostgreSQL checkpoints, and structured activity logging.

**Stack:** Hono + LangGraph + React 19 + Supabase + Railway

**Two active agents:**
- **Lead Qualification** -- research, score, draft outreach, human approval
- **Deal Coach** -- signal extraction, health scoring, action suggestions, chat

> Claude is a function. You call it, it returns a value, you move on.

---

# Lead Qualification flow

```
fetchContext -> checkMemory -> [fresh?] -> runResearch -> saveResearch
  -> runScoring -> writeBack -> [cold?] -> runOutreach -> hitlReview -> logActivity
```

**Bounded:** max 3 LLM calls per lead (research, score, outreach).
**Cached:** org_memory table stores research for 7 days.
**HITL:** graph pauses at hitlReview. Human sees draft, clicks send/edit/discard.
**Resumable:** PostgreSQL checkpointer survives server restarts mid-run.

Each call tunes Claude differently -- temp 0 for scoring, 0.7 for email copy.

---

# What we learned (pipeagent)

**Works well:**
- Predictable cost per run -- forecastable monthly spend
- Auditable execution -- structured `activity_logs` table powers Inspector UI
- Resumable runs -- kill the server mid-run, redeploy, resume from checkpoint
- Type safety -- every state transition explicit, every output typed

**Trade-offs:**
- Rigid DAG -- anything requiring iteration pushes against the graph
- Slow feedback loop -- code edit -> rebuild -> redeploy (minutes per iteration)
- Seams are visible -- decomposition into steps is useful but artificial

---

<!-- _class: invert -->

# Experiment 2: digital-pd-team

### The Hired Team

---

# digital-pd-team: the model decides

Three Claude bots operating a fictional Estonian solar company (NordLight Solar) in a real Pipedrive instance.

| Bot | Role | Owns |
|-----|------|------|
| **Lux** | SDR | Leads inbox -- qualify, score, convert hot leads |
| **Taro** | AE | Deals from Qualified to Contract Signed |
| **Zeno** | Sales Manager | Pipeline oversight -- nudge, escalate, coach |

They coordinate in a Telegram group called "NordLight Sales."
There is no workflow engine. There is no DAG. There is no state machine.

---

# How the bots are built

**No framework, no code for behavior -- just documents:**
- `IDENTITY.md` (~20 lines) -- personality, voice, tone
- `SKILL.md` (~45 lines) -- role-specific playbook, decision trees
- `rulebook-base.md` (~35 lines) -- non-negotiables every bot inherits

**Runtime:** OpenShell sandbox + Claude Code persistent harness
**Deployment:** `deploy-skill.sh taro` -- seconds, no restart, no memory loss

> The "code" is the job description each bot reads when it wakes up.

---

# Helper-first design

Bots call CLI helpers instead of raw Pipedrive API:

- `pd-search` -- find persons/orgs/deals
- `pd-convert-lead` -- atomic conversion with race guards + idempotency
- `pd-advance-stage` -- validates transitions
- `pd-note` -- update with safety checks

`pd-convert-lead` refuses duplicate deals within 5 minutes.
`pd-advance-stage` rejects invalid transitions.

> The helper guarantees the result; the LLM just has to call it.

---

# Emergent behavior

Bots wake themselves on 15-20 minute heartbeats.
Nobody asked them to check -- they have a workday.

**What emerged that wasn't designed:**
- Zeno notices deals sitting too long in a stage and pokes Taro
- Bots coach each other through handoffs
- Bots flag anomalies nobody asked them to look at

**Coordination:** Telegram group + a 13-line `POST /trigger` endpoint.
No central router. No orchestrator. Just mentions and relay.

---

# What we learned (digital-pd-team)

**Works well:**
- Deploy a skill change in seconds -- no restart, no memory loss
- Natural language coordination -- bots talk to each other in prose
- Emergent agency -- proactive behavior you didn't explicitly design
- Natural failure mode -- bot DMs you instead of a cryptic error log

**Trade-offs:**
- Unbounded cost -- no cap on LLM think time per session
- Observability gaps -- audit trail is Telegram scrollback
- Compliance risk -- rules are prose, enforcement is "ask the model"
- Breaks at ~5 bots -- group gets noisy, ownership gets fuzzy

---

<!-- _class: invert -->

# The Design Space

### Where do these two sit?

---

# Two axes

**X-axis:** "Graph decides" <-----> "Model decides"
**Y-axis:** "Structure in code" <-----> "Structure in prose"

```
                   Structure in prose
                        |
          Prose         |       Hired
          workflows     |       teammates
                        |
                        |       * digital-pd-team
  Graph  ---------------+--------------- Model
  decides               |                decides
          * pipeagent   |
                        |
          Compiled      |       Bounded
          pipelines     |       autonomy
                        |
                   Structure in code
```

Most of the industry is converging on the middle band.

---

# Side-by-side comparison

| Dimension | pipeagent | digital-pd-team |
|-----------|-----------|-----------------|
| Agent defined as | StateGraph + typed state | Sandbox + IDENTITY.md + SKILL.md |
| Control flow | Explicit DAG | Event -> wake -> vibe -> act -> sleep |
| Deploy speed | Minutes (code -> rebuild -> redeploy) | Seconds (`deploy-skill.sh`) |
| Cost model | Bounded (<=3 LLM calls/lead) | Unbounded (open-ended) |
| Persistence | Postgres checkpointer | Filesystem (prose markdown) |
| HITL | Graph node with pause/resume | "I'm in the group chat" |
| Failure mode | Log error, stop | DM the human |
| Trust model | Model is a function | Model is an employee |

---

# Which architecture for which CRM job?

| CRM Job | Recommended | Why |
|---------|-------------|-----|
| **Lead Qualification** | Engineered | High volume, repeatable, cost-sensitive |
| **Data Enrichment** | Engineered | Deterministic, auditable, every field needs provenance |
| **Pipeline Forecaster** | Engineered | Numeric, evaluable, CFO will scrutinize |
| **Meeting Prep** | Engineered + 1 judgment step | Research-heavy, stable output shape |
| **Deal Coach** | Middle ground | Structured scoring + freeform chat |
| **Email Composer** | Embodied | Voice matters. "AI smell" kills trust. |

Most CRM jobs want the engineered approach.
The interesting one is Deal Coach -- where the two philosophies genuinely meet.

---

# The framework is a decision about trust

> LangGraph lets in a function. Claude Code lets in a whole employee.

Both are rational. The CRM job determines which is right.

- **pipeagent answers:** "How do we build agents that ship to customers?"
  Predictable, auditable, cost-bounded, with HITL that actually works.

- **digital-pd-team answers:** "What do agents feel like when we stop scaffolding them?"
  What emerges when the model is the runtime, not a function inside one.

> The architecture follows from where you put decision-making authority, not the other way around.

---

<!-- _class: invert -->

# The Stack Underneath

---

# Supporting infrastructure

**pd-helpers** -- Pipedrive seeding toolkit
- 20-item Estonian company pool with dedup by email
- `pd-seed`, `pd-wipe`, `pd-prewarm`, `pd-setup`
- Idempotent account provisioning -- repeatable demos

**openshell-tools** -- Sandbox lifecycle scripts
- `backup-bot.sh`, `restore-bot.sh`, `deploy-skill.sh`
- Config vs state split -- push config from git, preserve runtime state
- Daily automated backups via launchd

**home-ai** -- Personal home bots (Alfred + Luna)
- Proving ground: heartbeat polling, Telegram channels, policy-enforced isolation
- Real integrations: Home Assistant, Cloudflare Workers, garbage email pipeline

---

# Operational learnings

**Config vs state split** -- push instructions from git, preserve bot memory across restarts

**Heartbeat polling** -- bots wake themselves periodically and ask "what am I worried about?"

**Helper-first** -- wrap API calls in CLIs that enforce business rules by construction

**Policy-enforced isolation** -- network egress controlled per sandbox, not per prompt

**Seconds-to-deploy** -- `deploy-skill.sh` pushes a skill change with zero downtime

**Prose as interface** -- when the unit of change is a markdown file, iteration is cheap and you learn faster what the model is willing to do

---

<!-- _class: invert -->

# Implications

---

# For Pipedrive product

Agents are coming to CRM. The question is not *if* but **how much control to give the model.**

Our customers will face this same spectrum:
- Some jobs need predictable automations (lead qualification, enrichment)
- Some jobs need judgment and voice (email composition, coaching)
- The interesting work is in the middle band

We should understand both ends -- not just the safe one.

> The choice isn't permanent or pure. A workflow can grow an agent loop inside a single node. An agent system can grow a workflow subgraph for a well-understood subtask.

---

# For engineers

**Build one.**

The gap between reading about agents and building one is enormous.

Start with:
1. A helper CLI that wraps your API with safety checks
2. A markdown file that describes what the agent should do
3. A trigger (webhook, cron, message)
4. Claude

You will learn more in a weekend than from a month of reading papers.

> The "horrible mess" isn't a failure mode. It's what happens when you stop pretending the model is a library and start treating it like a person on your team.

---

# Resources

**The experiments:**
- pipeagent -- `pipeagent.xtian.me` (live demo)
- digital-pd-team -- three bots, one Telegram group, one Mac Mini

**The essays:**
- "Agents in the CRM" -- product framing, job-to-architecture mapping
- "Two Ways to Build Agents That Touch Your CRM" -- engineering deep-dive

**References:**
- Anthropic, "Building effective agents" -- canonical taxonomy
- LangGraph docs -- multi-agent systems
- LangChain blog -- benchmarking multi-agent architectures

All repos available internally. Questions welcome.
