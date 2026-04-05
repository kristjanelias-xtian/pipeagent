# Two ways to build agents that touch your CRM

I have two projects that both automate Pipedrive with Claude. They share the CRM and basically nothing else. One is a clean [LangGraph](https://www.langchain.com/langgraph) service. The other is three bots in a Telegram group. Working on them back-to-back has been the clearest lesson I've had in what "agent architecture" actually means — because the architecture isn't the framework, it's the answer to a much older question: *what is an agent supposed to be?*

The two repos, if you want to follow along:

- **[pipeagent](https://github.com/kristjanelias-xtian/pipeagent)** — the LangGraph one
- **[digital-pd-team](https://github.com/kristjanelias-xtian/digital-pd-team)** — the Telegram bots

## Project A: the engineered pipeline

**[pipeagent](https://github.com/kristjanelias-xtian/pipeagent)** is a TypeScript monorepo. Hono server, React frontend, Postgres, [LangGraph](https://www.langchain.com/langgraph). Two active agents: Lead Qualification and Deal Coach.

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

**[digital-pd-team](https://github.com/kristjanelias-xtian/digital-pd-team)** is not really a codebase. It's three sandboxes running openclaw (a persistent [Claude Code](https://www.anthropic.com/claude-code) harness), a Telegram group, and a 200-line Express server glueing them together.

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

## The architectural thesis: where does the next step live?

Strip everything else away and the difference between these two systems is a single question: **when it's time to decide what happens next, who decides?**

In pipeagent, **the graph decides**. I wrote the edges. The edges say: after scoring, if the label is cold, skip outreach and go to `logActivity`; otherwise draft an email and pause for HITL. That decision is mine, encoded at design time. Claude's job is to fill in the *contents* of each node — parse this lead, score it, draft this email — but Claude never chooses *which node runs next*. The control flow is in my code.

In digital-pd-team, **the model decides**. When a webhook wakes Zeno up, nothing tells him what to do. He reads the DM, reads his identity, reads his skill file, reads his workspace memory, and then makes a call. Sometimes he posts to the group. Sometimes he pulls more data from Pipedrive first. Sometimes he decides the webhook is noise and goes back to sleep. The control flow is in the prompt.

Every other architectural difference in this essay — state, tools, observability, deployment, failure modes — is a downstream consequence of this one choice. Once you've decided where the decision lives, most of the rest follows.

**If the graph decides**, you need typed state (because the graph is code and code wants types). You need checkpointing (because the graph is a long-running computation and computations need to survive crashes). You need an activity log (because you can't see into the graph without one). You need a framework like LangGraph to express the graph. You need schemas for LLM output (because the graph consumes them). You need a registry of graphs (because you have more than one). All of it follows.

**If the model decides**, you need a persistent identity (because the model is the thing that persists, not the run). You need prose instructions (because the model reads them, not a compiler). You need a memory the model writes itself (because you have no schema to impose). You need a communication channel the model can use natively (a Telegram group beats a message broker, because the model already knows how to chat). You need almost no code, because the model *is* the code. All of *that* follows.

These aren't two styles. They're two architectures, and the split is where authority over control flow lives. Once you see it that way, you stop asking "which framework?" and start asking "how much of the decision-making am I willing to hand to the model?"

## The ways they disagree

### 1. What even is an agent, concretely?

Before anything else, the word "agent" means two completely different things in these two codebases. If you pointed at each project and asked *"show me the agent"*, you'd get wildly different answers:

|                    | pipeagent                                          | digital-pd-team                                              |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------ |
| **Definition**     | A `StateGraph` with typed `Annotation` nodes       | A sandbox + `IDENTITY.md` + `skills/*/SKILL.md`              |
| **Where it lives** | `apps/server/src/agent/graph.ts`                   | A Mac Mini running an openclaw gateway on port 18789         |
| **Unit of change** | Edit TS, rebuild, redeploy                         | `deploy-skill.sh taro pipedrive-ae` — no restart             |
| **Identity**       | `agentId: 'deal-coach'` in a registry              | A *personality*: "Zeno, calm, coaching-minded, never panics" |
| **Lifespan**       | A run. Seconds to minutes. Dies when it returns.   | A persona. Days to weeks. Keeps a diary.                     |
| **Shorthand**      | *"run the qualification agent on this lead"*       | *"Lux is handling it"*                                       |

pipeagent treats an agent as **a compiled pipeline with state** — a `StateGraph` in a registry, instantiated per run. digital-pd-team treats an agent as **a persona with a job description** — the runtime is just "Claude Code, but persistent, with a Telegram handle."

Which leads to the shortest possible summary of this essay:

- **pipeagent = *engineered* agents.** Deterministic graphs, typed state, checkpointed runs, HITL breakpoints. *Agents as software.*
- **digital-pd-team = *embodied* agents.** Freeform Claude Code loops in sandboxes, talking in a Telegram group, reading markdown skills off disk. *Agents as employees.*

Both work. They're answers to different questions — and the rest of this section is ten more ways that difference shows up in the details.

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

### 7. Context assembly

pipeagent builds prompts **node-by-node**, tightly scoped. The scoring node gets the lead, the enriched org data, and the ICP criteria — nothing else. The outreach node gets the research summary, the score, and the business tone — nothing else. Each LLM call has a minimal, hand-curated input that matches what that step needs to do. Context is a **function argument**.

digital-pd-team builds prompts **by layering**: the base rulebook, the shared Pipedrive mental model, the handoff protocol, the bot's identity, its skill files, its workspace files (`SOUL.md`, `USER.md`, `AGENTS.md`, `HEARTBEAT.md`, recent memory entries), plus whatever the bot decided to read from Pipedrive this session, plus the Telegram scrollback. Each wake-up loads a big, layered environment and the bot navigates it itself. Context is a **workspace**.

pipeagent knows exactly what's in the prompt because it assembled it. digital-pd-team doesn't — that's the point. The bot decides what's relevant.

### 8. Trigger model

pipeagent is **reactive only**. Something must happen: a webhook fires, a user clicks requalify, a cron hits an endpoint. No run starts on its own. The system is asleep between triggers.

digital-pd-team is **reactive and proactive**. It reacts to webhooks and Telegram mentions, but it also wakes itself up on a 15–20 minute heartbeat and asks *"what am I worried about?"* Zeno might notice a deal has been sitting in a stage too long and poke Taro about it. Nobody told him to check. Proactive agency is a native feature, not a scheduled job bolted on.

This is a bigger deal than it sounds. It's the difference between a system that runs when you tell it to and a system that has a *workday*.

### 9. Cost and determinism

A pipeagent run has a **bounded, knowable cost**. Lead qualification is at most one research call, one scoring call, one outreach call. If research is cached from `org_memory`, it's two. You can price a run before it starts. You can forecast monthly spend from run volume.

A digital-pd-team session is **unbounded**. When Lux wakes up, it might think for three seconds or three minutes. It might call `pd-search` once or twenty times. It might re-read its skill halfway through and change its mind. There is no cap, because the cap is *"whenever the model decides it's done."* You learn to love the Anthropic billing dashboard.

Determinism follows the same split: pipeagent's graph means the *shape* of a run is predictable even when the contents aren't. digital-pd-team has no shape at all — every session is bespoke.

### 10. Failure and recovery

pipeagent catches errors in nodes, logs them to `activity_logs`, sets run status to `failed`, and stops. For LLM output parsing it has typed fallbacks — defaults if JSON doesn't parse, so the graph can still progress. HITL-paused runs survive restarts via the Postgres checkpointer. Failures are **first-class state**.

digital-pd-team has exactly one recovery strategy: **DM the human**. If something is weird, the bot tells me. There is no retry logic, no fallback, no failed-state table. The honesty of this is also the risk of it — it only works because there's one human watching three bots. At scale you'd drown in pings. At this scale, it's the most graceful failure mode I've ever built, because the human is already in the loop by design.

### 11. The feedback loop

This one's about *you*, the builder, not the agents.

Changing pipeagent: edit a TypeScript file, rebuild `packages/shared`, restart the server, check the logs, maybe redeploy to Railway. Minutes per iteration. Every change is a code change.

Changing digital-pd-team: edit a markdown file, run `deploy-skill.sh taro pipedrive-ae`, send Taro a Telegram message to test. Seconds per iteration. No restart. No memory loss. The bot picks up the new skill on its next message and keeps going, with its workspace memory intact.

When the unit of change is prose and the deploy is a file copy, you iterate differently than when it's a compile step. This might be the most underrated reason the messy system is worth having: **the feedback loop is tighter, so you learn faster about what the model is willing to do**. Every skill rewrite is a cheap experiment. In pipeagent, every change has the weight of code.

## When each breaks

pipeagent breaks when you need to change behavior: code, rebuild, redeploy. It breaks when the DAG shape is wrong for the task — anything that wants to iterate or improvise pushes against the graph. It breaks when reality doesn't fit the schema.

digital-pd-team breaks at ~5 bots: the Telegram group gets noisy, the trigger relay is a single process, the prose-based ownership rules get fuzzy. It breaks when you need SLAs, metrics, alerts — observability is "what did the bots say today?" and "what's in the backups?" It breaks when the sandbox dies before the next backup ran and the `SOUL.md` that existed this morning is gone.

## The honest frame

These are the two legitimate answers to the same question, and the difference between them is almost entirely **how much you trust the model to be the runtime**.

pipeagent doesn't trust the model with the runtime. It wraps every LLM call in types, checkpoints, logs, fallbacks. Claude is a function, and the system is the code around it. The upside is that it's boring in all the right ways. The downside is that everything interesting has to be in the graph you designed, and you can feel the seams.

digital-pd-team trusts the model completely. There is no scaffolding. There is a persona, a skill file, a shell, and a chat app. If the bot decides to do something clever, it does. If it decides to do something stupid, it does that too, and I type a correction into the group. The upside is that things emerge you didn't design — bots coaching each other, joking, flagging things nobody asked them to look at. The downside is that "stay in your lane" is a sentence in a markdown file, and the only enforcement mechanism is me reading Telegram.

One of these ships. The other *teaches you what agents feel like when they have a voice and coworkers*. I think you need both, honestly — pipeagent is how you build something you can sell, and digital-pd-team is how you find out what you should be trying to sell in the first place. The "horrible mess" isn't a failure mode. It's what happens when you stop pretending the model is a library and start treating it like a person on your team.

The deepest thing I've learned building these side by side is that **the framework you pick is just a decision about how much of Claude you're willing to let into your system**. LangGraph lets in a function. openclaw lets in a whole employee. The architecture follows from that, not the other way around.

## Zooming out: the rest of the map

These two projects are two specific answers to the "who decides?" question. They aren't the only answers — they're poles on a spectrum, and the middle of that spectrum is where most of the interesting work is actually happening.

Anthropic articulates the same split in ["Building effective agents"](https://www.anthropic.com/engineering/building-effective-agents): they distinguish **workflows** ("systems where LLMs and tools are orchestrated through predefined code paths") from **agents** ("systems where LLMs dynamically direct their own processes and tool usage, maintaining control over how they accomplish tasks"). pipeagent is a workflow. digital-pd-team is an agent system. The patterns below are what live between.

### Workflow patterns (the graph decides)

**Prompt chaining.** A sequence of LLM calls where each step processes the output of the previous, optionally with programmatic checks between stages. pipeagent's lead qualification is exactly this: fetch → research → score → outreach. Use when the steps are knowable and you want accuracy through decomposition.

**Routing.** Classify an input, then dispatch to a specialized downstream pipeline. pipeagent's agent registry is a primitive version — the router is currently the user picking an agent in the UI, but you could make the router itself an LLM call. Useful when inputs naturally split into categories that want different prompts or different models.

**Parallelization.** Run the same task many times for voting (confidence through redundancy), or fan out independent subtasks in parallel (speed). Neither of my projects uses this, but pipeagent's research step is a candidate: kick off company research, tech-stack research, and funding research in parallel, then merge. Parallel guardrails (run a safety check alongside the main call) is another common shape.

**Evaluator-optimizer.** One LLM generates, another critiques, loop until good enough. This is the pattern pipeagent's outreach step is *missing* — right now it drafts once and hands to HITL. An evaluator-optimizer would have a critic LLM score tone/length/relevance and loop back for revisions before the human ever sees the draft. Use when you have clear criteria and iteration measurably improves the output.

**Orchestrator-workers.** A central LLM decomposes a task at runtime and delegates to worker LLMs, then synthesizes the results. Unlike prompt chaining, the decomposition *isn't* fixed — the orchestrator decides what work to do for each input. This is the interesting middle ground between my two projects: typed workers, dynamic dispatch, model-chosen control flow bounded by a code-chosen task surface. Claude Code's own subagent dispatch is essentially this shape.

### Agent patterns (the model decides)

**Autonomous tool loop (ReAct-style).** A single LLM with a tool belt, reasoning and acting in a loop until it decides it's done. This is what one digital-pd-team bot does during a single session. Claude Code itself is this pattern, scaled up with a full shell. Use when the required steps genuinely can't be predicted ahead of time.

**Supervisor.** One agent coordinates a team of specialists by deciding who runs next and what they see. [LangGraph's supervisor pattern](https://github.com/langchain-ai/langgraph-supervisor-py) formalizes this — the supervisor is a node, the workers are other agents, all communication flows through the center. CrewAI's "manager agent" mode is similar. This is what digital-pd-team's Zeno *informally* does via natural language in Telegram. Formalizing it would mean the supervisor is the only thing that can route work, with typed handoffs instead of @mentions.

**Hierarchical teams.** [Supervisors of supervisors](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/hierarchical_agent_teams/). Used when flat teams get unwieldy — split a team into subteams (research team, writing team, review team) that each have internal coordination and a lead that reports up. The pattern to reach for when a single supervisor becomes the bottleneck.

**Swarm.** Decentralized. Agents observe a shared workspace and contribute when their expertise is relevant, with no central coordinator. [LangGraph Swarm](https://github.com/langchain-ai/langgraph-swarm-py) implements this, and — surprise — digital-pd-team is approximately one. The Telegram group is the shared workspace. The mention patterns are the "when to contribute" logic. The trigger relay is the delivery mechanism. I didn't set out to build a swarm; I built a chat group and it became one.

**Conversational / debate.** Multiple agents have a structured dialogue to reach consensus or explore a problem adversarially. AutoGen popularized this pattern, though Microsoft has since shifted it to maintenance mode in favor of a broader agent framework. The shape is still useful when you want the disagreement itself to produce insight — code review between adversarial reviewer + defender, for example.

### Frameworks, briefly

- **[LangGraph](https://www.langchain.com/langgraph)** — graph-decides by default, but each node can contain an agent loop. The current go-to for production workflows with durable state, checkpointing, and HITL. pipeagent runs on this.
- **[CrewAI](https://www.crewai.com/)** — role-based crews with tasks. Lowest barrier to entry for team-based workflows. "Zeno the manager, Lux the SDR, Taro the AE" maps very cleanly onto CrewAI primitives; if I were to formalize digital-pd-team without giving up its role-based spirit, this would be the move.
- **AutoGen** — conversational multi-agent. Now in [maintenance mode](https://devblogs.microsoft.com/autogen/microsofts-agentic-frameworks-autogen-and-semantic-kernel/); the ideas live on in Microsoft's newer Agent Framework.
- **[Claude Code](https://www.anthropic.com/claude-code) / openclaw** — the model is the runtime. No framework, just a persistent sandboxed Claude with a shell and a harness. digital-pd-team runs on this.
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)** — not a framework but a protocol for how agents talk to tools and resources. Orthogonal to all the above: you can speak MCP from inside any of these patterns.

### So where do these two projects actually sit on the map?

- **pipeagent** is prompt chaining + primitive routing + a single HITL interrupt. A textbook Anthropic-style *workflow*. It would benefit from adding an evaluator-optimizer loop around outreach drafting (let a critic LLM revise the email before the human sees it) and from parallelizing the research step (company + people + funding in parallel rather than one large prompt).
- **digital-pd-team** is autonomous tool-loop agents coordinated as an informal swarm. A textbook Anthropic-style *agent system*, with the coordination layer left implicit in prose and enforced by a Telegram group. It would benefit from either formalizing the supervisor pattern (Zeno as the actual router, with typed handoffs via the trigger relay) or from adopting a framework like CrewAI that encodes the role structure without giving up the natural-language feel.

The honest answer to *"which pattern should I pick?"* is the one this essay has been circling from the start: **pick based on where you want the decision-making to live**, and then pick the pattern within that half of the map that matches how predictable your task is. Predictable and repeated → workflow patterns (chaining, routing, parallelization, evaluator-optimizer). Open-ended and judgment-heavy → agent patterns (tool loop, supervisor, swarm). Both at once → orchestrator-workers, or a supervised team with typed handoffs.

And — this is the part I only fully saw after building both — the choice isn't permanent or pure. A workflow can grow an agent loop inside a single node when that step needs improvisation. An agent system can grow a workflow subgraph for a well-understood subtask that shouldn't be reinvented every run. The two projects in this essay are extremes because I wanted to feel the edges. Most real systems should live somewhere in the middle, and the fun of this space right now is that the middle is still largely unbuilt.

## Further reading

- Anthropic, ["Building effective agents"](https://www.anthropic.com/engineering/building-effective-agents) — the canonical taxonomy of workflow and agent patterns. If you read one thing after this essay, read this.
- LangGraph docs, [Multi-agent systems](https://langchain-ai.github.io/langgraph/concepts/multi_agent/) — network, supervisor, hierarchical, and swarm architectures with code.
- LangChain blog, [Benchmarking multi-agent architectures](https://blog.langchain.com/benchmarking-multi-agent-architectures/) — empirical comparison of supervisor vs swarm vs single-agent on the same tasks.
- Yao et al., ["ReAct: Synergizing Reasoning and Acting in Language Models"](https://arxiv.org/abs/2210.03629) — the original paper for the tool-loop pattern every autonomous agent descends from.
- Shinn et al., ["Reflexion: Language Agents with Verbal Reinforcement Learning"](https://arxiv.org/abs/2303.11366) — the formalization of self-critique loops (the family evaluator-optimizer belongs to).
- The [pipeagent](https://github.com/kristjanelias-xtian/pipeagent) and [digital-pd-team](https://github.com/kristjanelias-xtian/digital-pd-team) repos themselves, if you want to see what the map looks like when you actually build on two different points of it.
