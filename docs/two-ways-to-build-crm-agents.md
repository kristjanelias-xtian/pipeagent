# Two ways to build agents that touch your CRM

I have two projects that both automate Pipedrive with Claude. They share the CRM and basically nothing else. One is a clean LangGraph service. The other is three bots in a Telegram group. Working on them back-to-back has been the clearest lesson I've had in what "agent architecture" actually means — because the architecture isn't the framework, it's the answer to a much older question: *what is an agent supposed to be?*

## Project A: the engineered pipeline

**pipeagent** is a TypeScript monorepo. Hono server, React frontend, Postgres, LangGraph. Two active agents: Lead Qualification and Deal Coach.

A "run" of the lead qualification agent is a compiled `StateGraph`:

```
fetchContext → checkMemory →[fresh?]→ runResearch → saveResearch
  → runScoring → writeBack →[cold?]→ runOutreach → hitlReview → logActivity
```

Every node has typed inputs and outputs. Every transition is explicit. There are two conditional edges and one `interrupt()` — the human-in-the-loop breakpoint before an outreach email gets sent. The run's state is checkpointed to Postgres under `thread_id = ${connectionId}-${leadId}-${runId}`, so you can kill the server mid-run, redeploy, and resume from exactly where you stopped. Every node writes to an `activity_logs` table — `node_enter`, `node_exit`, `tool_call`, `llm_call` — which the frontend renders as an inspector.

Claude is used four different ways inside this thing, each matched to the job:

- **research** — raw Anthropic SDK, because it needs the `web_search` tool, default temperature
- **scoring** — `ChatAnthropic`, temperature 0, JSON output parsed out of a markdown fence
- **outreach** — `ChatAnthropic`, temperature 0.7, because email copy needs a heartbeat
- **deal coach** — `ChatAnthropic`, temp 0 for analysis, 0.3 for chat

Claude here is a *function*. A subroutine with a signature. You call it, you parse its output, you move to the next node. If it fails, you have a fallback. If it hangs, a checkpoint survives.

pipeagent is what I'd build for a customer. Everything is auditable. Everything is resumable. Everything has a type. Nothing surprising can happen because the graph doesn't have an edge for surprising.

## Project B: the sales team

**digital-pd-team** is not really a codebase. It's three sandboxes running openclaw (a persistent Claude Code harness), a Telegram group, and a 200-line Express server glueing them together.

The bots are **Zeno** (sales manager, read-only), **Lux** (SDR), and **Taro** (AE). They work for a fictional Estonian solar company called NordLight. They talk to each other and to me in a Telegram group called "NordLight Sales." There is no workflow engine. There is no DAG. There is no state machine. There is an `IDENTITY.md` that tells Zeno he's calm and coaching-minded, and a `SKILL.md` that tells Taro how to close deals.

The "runtime loop" is:

1. Pipedrive fires a webhook.
2. An Express server on my Mac Mini catches it and DMs Zeno on Telegram.
3. Zeno wakes up (Claude Code session starts fresh, reads its workspace files).
4. Zeno decides what to do and posts a message in the group: *"@lux_pd_bot, new lead came in — Eva Pirita, residential in Tallinn. Can you qualify?"*
5. Lux doesn't see the message. **Telegram doesn't let bots see each other's messages in groups.** So Zeno also sends a `POST /trigger` to a 13-line Express endpoint on the Mac Mini, which dispatches the same text to Lux's openclaw gateway over Tailscale.
6. Lux wakes up, reads its skill file, runs `pd-search` and `pd-new-lead` from the shell, posts "got it, on it" back to the group.
7. Hours later, when things get stuck or a deal advances, bots @mention each other again. Between events, 15-minute heartbeats.

State is markdown files. Each bot has a `SOUL.md` (self-model), a `USER.md` (what it knows about me), an `AGENTS.md` (what it knows about its teammates), a `HEARTBEAT.md`, and a `memory/YYYY-MM-DD.md` daily log. **The bots write their own memory in prose.** There's no schema. There's no database. There's no audit trail except scrolling up in the Telegram group.

Tools are shell helpers on `PATH`: `pd-search`, `pd-new-lead`, `pd-convert-lead`, `pd-advance-stage`, `pd-note`. The rulebook is prose: *"Search before you create. Use the pd-\* helpers, not raw curl. Stay in your lane. One message per milestone, not running commentary."* Rules are enforced by asking the model to follow them.

Deployments are `deploy-skill.sh taro pipedrive-ae`. No restart. Taro picks up the new skill on the next message.

digital-pd-team is what I'd build if I wanted to find out what an agent actually *feels* like when you stop scaffolding it and let it have persistence, a voice, and coworkers.

## Six ways these two disagree

### 1. What is an agent?

pipeagent: **a compiled pipeline with typed state**. A `StateGraph` in a registry. Instantiated per run.

digital-pd-team: **a persona with a job description**. A markdown identity file, a sandbox, a Telegram handle. Persistent. Named. It remembers you.

You can tell which is which by how you'd refer to them. I say "run the qualification agent on this lead." I say "Lux is handling it."

### 2. Control flow

pipeagent: explicit DAG with conditional edges. Two branch points in the whole graph. One HITL interrupt. Deterministic.

digital-pd-team: event → wake → read files → vibe → act → post → sleep. The only "control flow" is *whose name got mentioned in the group*. Mention patterns in each bot's config (`"@?lux_pd_bot"`, `"\\blux\\b"`) are the router.

pipeagent's shape is a flowchart. digital-pd-team's shape is a group chat that happens to contain Claudes.

### 3. State and time

pipeagent treats state as a first-class problem. Postgres checkpointer, thread IDs, `org_memory` caching research for 7 days, run statuses (`running` → `paused` → `completed`). You can kill it, restart it, inspect it.

digital-pd-team treats state as *the filesystem of a sandbox*. If the sandbox dies between backups, the bot forgets. That's fine, because the bot writes its memory as prose into files with names like `SOUL.md`, and restores are `restore-state.sh taro`. The diary persists. The schema doesn't exist.

One is a database row. The other is a diary. Both survive time; they do it completely differently.

### 4. How Claude is used

pipeagent calls Claude four different ways — raw SDK for web search, `ChatAnthropic` everywhere else, temperature dialed per task, JSON output parsed out of markdown fences, sensible fallbacks when parsing fails. **Claude is a function.** You call it, it returns a value, you move on.

digital-pd-team calls Claude exactly one way: **Claude Code, in a sandbox, with a skill file and a shell**. No temperature tuning. No JSON parsing. No retries. If things go sideways, the bot DMs me. **Claude is the runtime.**

This is maybe the deepest split. In pipeagent, the LLM is a component of the system. In digital-pd-team, the LLM *is* the system.

### 5. Multi-agent composition

pipeagent's "multi-agent" is a registry: each agent is its own pipeline, its own route file, its own workspace component. They don't talk to each other. They don't need to. *Multiple single-agents.*

digital-pd-team's agents actually coordinate. Zeno hands leads to Lux, Lux qualifies and hands to Taro, Taro drives to close. The handoff protocol (`bots/shared/handoffs.md`) is a three-step rule: **Trigger → Ack → Result**. Written in prose. Enforced by asking them to follow it.

And the coordination layer — the thing that makes multi-agent possible at all — is a **Telegram group plus a 13-line `POST /trigger` endpoint** that works around the fact that Telegram bots can't see each other. This is the most load-bearing duct tape in the whole project. It's absurd. It works.

### 6. Human in the loop

pipeagent: HITL is a graph node. `interrupt()` pauses the run, the frontend shows the draft, the user clicks send/edit/discard, the server calls `graph.invoke()` with the decision, LangGraph restores the checkpoint. Formal, resumable, auditable.

digital-pd-team: HITL is "I'm in the group chat." When something feels off, I type a message. The bots see it and adjust. There's no resume semantics. There's no "pause." There's just a conversation that I'm part of.

Both work. One makes promises. The other makes eye contact.

## When each breaks

pipeagent breaks when you need to change behavior: code, rebuild, redeploy. It breaks when the DAG shape is wrong for the task — anything that wants to iterate or improvise pushes against the graph. It breaks when reality doesn't fit the schema.

digital-pd-team breaks at ~5 bots: the Telegram group gets noisy, the trigger relay is a single process, the prose-based ownership rules get fuzzy. It breaks when you need SLAs, metrics, alerts — observability is "what did the bots say today?" and "what's in the backups?" It breaks when the sandbox dies before the next backup ran and the `SOUL.md` that existed this morning is gone.

## The honest frame

These are the two legitimate answers to the same question, and the difference between them is almost entirely **how much you trust the model to be the runtime**.

pipeagent doesn't trust the model with the runtime. It wraps every LLM call in types, checkpoints, logs, fallbacks. Claude is a function, and the system is the code around it. The upside is that it's boring in all the right ways. The downside is that everything interesting has to be in the graph you designed, and you can feel the seams.

digital-pd-team trusts the model completely. There is no scaffolding. There is a persona, a skill file, a shell, and a chat app. If the bot decides to do something clever, it does. If it decides to do something stupid, it does that too, and I type a correction into the group. The upside is that things emerge you didn't design — bots coaching each other, joking, flagging things nobody asked them to look at. The downside is that "stay in your lane" is a sentence in a markdown file, and the only enforcement mechanism is me reading Telegram.

One of these ships. The other *teaches you what agents feel like when they have a voice and coworkers*. I think you need both, honestly — pipeagent is how you build something you can sell, and digital-pd-team is how you find out what you should be trying to sell in the first place. The "horrible mess" isn't a failure mode. It's what happens when you stop pretending the model is a library and start treating it like a person on your team.

The deepest thing I've learned building these side by side is that **the framework you pick is just a decision about how much of Claude you're willing to let into your system**. LangGraph lets in a function. openclaw lets in a whole employee. The architecture follows from that, not the other way around.
