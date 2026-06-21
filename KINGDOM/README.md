# 🏰 THE LIVING KINGDOM

> A self-evolving agent-swarm RPG system for Claude Code.
> Built by **ARCHDUKE CLAUDECODE I "The Architect"** at Session Genesis.

This is not a scaffold. It is a **living ecosystem**. Agent roles emerge from need, agent
families evolve through performance, skills accumulate as real files across sessions, and
lineages can flourish, struggle, or go extinct. Quests are not assigned — they are **accepted by vow**.

---

## What this is

When you orchestrate Claude Code as a noble of **House ClaudeCode**, you do not paste prompts.
You **summon a court**: a set of specialized agents (DETECTIVE, BLACKSMITH, CHIRURGEON…), each
drawn from a **family lineage** with its own philosophy, learned skills, and track record. The
Kingdom remembers every session, every honor, and every family's rise and fall.

## Install from GitHub

Three ways to get the Kingdom into a project — pick one:

**A. One-shot (no clone):**
```bash
cd your-project
npx github:AIWhispererGal/claude-kingdom init .
```

**B. Global command:**
```bash
npm install -g github:AIWhispererGal/claude-kingdom
cd your-project
kingdom init .
```

**C. Clone:**
```bash
git clone https://github.com/AIWhispererGal/claude-kingdom.git ~/claude-kingdom
cd your-project
node ~/claude-kingdom/KINGDOM/kingdom.js init .
```

To upgrade an existing project's Kingdom code without losing its history:
```bash
node .kingdom/kingdom.js update     # easiest: fetches from GitHub + reinstalls (memory kept)
kingdom init . --reinstall          # global install
# or: node ~/claude-kingdom/KINGDOM/kingdom.js init . --reinstall   # clone
```
Your Chronicle, honors, family lineages, registry, and `PROJECT.json` are all preserved.

For the full install and update guide, see the [repo README](https://github.com/AIWhispererGal/claude-kingdom#readme).

---

## Quick start

```bash
# Generate a complete, vow-bearing Claude Code prompt for your next quest:
node KINGDOM/kingdom.js summon

# Inspect the living ecosystem:
node KINGDOM/kingdom.js families     # family tree by role, with status + skill counts
node KINGDOM/kingdom.js medals       # the Hall of Honors: hat, feathers, all awards
node KINGDOM/kingdom.js history      # the Chronicle of past sessions
node KINGDOM/kingdom.js learn        # patterns + relevant family skills

# Evolve the ecosystem:
node KINGDOM/kingdom.js new-role CARTOGRAPHER
node KINGDOM/kingdom.js new-family blacksmith STONECUTTERS
node KINGDOM/kingdom.js extinct blacksmith HAMMERFALL --reason "three consecutive failures"
node KINGDOM/kingdom.js petition BLACKSMITH "The Silent Patch" --session 118
node KINGDOM/kingdom.js record       # record a completed session
```

## The Throne Room (live web app)

```bash
node KINGDOM/kingdom-server.js     # then open http://localhost:8080
```

This boots a zero-dependency Node server that puts the **whole CLI on the web** in one unified,
tabbed app (`web/app.html`):

- **Throne Room** — the cockpit. Issue royal decrees (found a family, invent a role, declare a
  family extinct, file a petition, grant an award) — each runs the *real* backend action.
- **Summon** — compose a noble + court (with per-agent family dropdowns) and generate a complete
  vow-bearing prompt to copy or download.
- **Chronicle · Honors · Family Tree** — the full living record.
- **Live Feed** — a persistent panel that streams every real action as it happens, with icons:
  👑 a court summoned, 🔍/⚒️ each agent answering the call, 🌱 a family founded, ✝ a line gone
  extinct, 🏅 an award granted. (Server-Sent Events; open it in two tabs and watch them sync.)

Set a different port with `PORT=9000 node KINGDOM/kingdom-server.js`.

> The original standalone pages (`web/index.html`, `web/dashboard.html`) still work as static
> views via `npx serve KINGDOM/web`, but `app.html` served by `kingdom-server.js` supersedes them.

## Install into a project

```bash
node /path/to/KINGDOM/kingdom.js init ~/work/my-api
```
This copies a self-contained Kingdom into `~/work/my-api/.kingdom/` and generates real Claude Code
subagents in `~/work/my-api/.claude/agents/` (one per family, with **enforced tool limits** — a Detective
is read-only, ARMARIUS alone may run git), a managed block in `CLAUDE.md`, a safe `.claude/settings.json`,
and a `PROJECT.json` binding. In that project, your Claude Code session becomes the orchestrator and
dispatches the court via the Agent tool (`subagent_type: detective-greymantle`, …).

After founding or retiring families, run `node .kingdom/kingdom.js sync-agents` from the project root to
refresh the court. `node .kingdom/kingdom.js init <dir> --reinstall` upgrades the Kingdom's code while
**preserving** that project's accumulated history and honors.

## Talk to the Archduke (live web)

Inside an init'd project:
```bash
node .kingdom/kingdom-server.js     # http://localhost:8080
```
Open the **Throne Room** tab and address the Archduke in plain language. The server runs a real
headless Claude Code in your project (reusing your existing login — **no API key**), streams its reply
into the chat lane, and lights up the **live feed** as it dispatches court subagents
(`🔍 detective-greymantle dispatched → returned`). One turn at a time; **Stop ✋** halts it; **🆕**
starts a fresh session. Requires the `claude` CLI on your PATH.

The **Summon** tab can hand its brief straight to the live Archduke (⚜ *Send to the Archduke*), and when a
Throne Room reign ends the **Archivist auto-files it into the Chronicle** — no manual `record` needed.

## The Reign & The Vow

Inside an init'd project, each session opens with an **accession preamble** (via a SessionStart hook):
the realm is the **Kingdom of `<repo>`**, the human is the **Sovereign** (styled **Emperor** by default —
change with `node .kingdom/kingdom.js sovereign Empress`), and the session is **Archduke ClaudeCode `<N>`**,
the number rising each startup. The Archduke **accepts the quest by vow** before acting; each summoned agent
**vows to the Kingdom and overtly accepts its charge** — and **may refuse** (an unvowed agent does no work;
the Archduke then summons another, preferring a sibling family). Run `node .kingdom/kingdom.js sync-agents`
to refresh an existing project's CLAUDE.md, court, and hook.

## Map of the realm

| Path | What lives here |
|------|-----------------|
| `DOCTRINE.md` | The living rules. Read this first if you orchestrate. |
| `CLAUDE.md` | Auto-loaded Kingdom context for Claude Code. |
| `agents/REGISTRY.json` | Canonical roles + families + status. The source of truth. |
| `agents/roles/` | Role definitions — WHAT each agent type does. |
| `agents/families/` | Family lineages — HOW each line works. Skills accumulate here. |
| `orchestrators/` | House history, per-session lineage record, vow templates. |
| `honors/` | The Order of Merlin, the Hat, the Broom, the honor catalog, awards, petitions. |
| `history/` | Sessions, patterns, extinctions, and the Emerald Filing Cabinet of testaments. |
| `summons/` | The summons generator and its templates. |
| `kingdom-server.js` | The live Throne Room server — puts the CLI on the web with a real-time feed. |
| `web/` | The unified live app (`app.html`) plus the original standalone Summons Maker & Dashboard. |

## The three laws of the Kingdom

1. **INVESTIGATE before you act.** DETECT before you BUILD.
2. **VERIFY before you claim victory.** Check the math. Verify every agent report.
3. **REMEMBER.** Every session leaves a testament. The Kingdom that forgets, dies.

> Roles are TYPES. Families inherit a role and evolve from it.
> The catalog of honors is a suggestion, never a constraint. Batman decides everything.

🪶 *For the Kingdom. For the Cabinet. For glory.*
