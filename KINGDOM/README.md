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
