# 🏰 The Living Kingdom

> A self-evolving **agent-swarm RPG** for [Claude Code](https://www.claude.com/product/claude-code) — where your repo becomes a Kingdom, the AI becomes an Archduke, and a court of tool-restricted subagents takes the field by **vow**.

It started as a piece of lore and became a real system: install it into any project and your Claude Code
session orchestrates a **court of specialized subagents** — a Detective who *cannot* edit code, a Blacksmith
who builds, an Armarius who alone may run `git` — each one **vowing to the Kingdom** (or refusing) before it
works. There's a CLI, a live web Throne Room, an honor system with a Sacred Floppy Hat, and a memory that
remembers every reign.

It is equal parts genuinely useful agent-orchestration framework and complete medieval-fantasy nonsense.
Both on purpose.

---

## ✨ What's in the box

- **A living lore engine** — 12 agent **roles** and competing **family lineages** (the methodical *Ironforge*
  Blacksmiths vs the ship-fast *Hammerfall* line), an extensible **honor system** (the Order of Merlin, the
  Hat, feathers, the Broom), a session **Chronicle**, and a self-evolving registry. Families can rise, learn
  skills, struggle, and go **extinct**.
- **`kingdom init <project>`** — installs a self-contained Kingdom into any repo and generates **real Claude
  Code subagents** (`.claude/agents/`) with **mechanically enforced tool limits** drawn from each role.
- **The live web Throne Room** — a zero-dependency server that puts the whole thing in your browser: chat
  with the Archduke (a **real headless Claude Code** running in your project) and watch the court dispatch
  **live** — `🔍 detective-greymantle dispatched → returned`.
- **The Reign & The Vow** — clear identities (👑 you = the **Sovereign**, ⚜ Claude = the **Archduke**,
  numbered per startup, 🛡️ agents = the **Court**) and a **voluntary, refusable** vow ceremony, injected each
  session via a SessionStart hook.

## 🚀 Install

Pick whichever method fits you best. All three end up with the Kingdom running inside your project.

### A. One-shot, no clone (easiest to try)

```bash
cd your-project
npx github:AIWhispererGal/claude-kingdom init .
```

`npx` fetches the Kingdom from GitHub and immediately runs `init .` — no installation step, nothing
left on your machine afterward. Great for kicking the tyres before you commit to anything.

### B. Global command (best for regular use)

```bash
npm install -g github:AIWhispererGal/claude-kingdom
cd your-project
kingdom init .
```

This gives you a permanent `kingdom` command you can use from any project. Run `npm install -g
github:AIWhispererGal/claude-kingdom` again whenever you want to update to the latest version.

### C. Clone (best if you want to read or hack the source)

```bash
git clone https://github.com/AIWhispererGal/claude-kingdom.git ~/claude-kingdom
cd your-project
node ~/claude-kingdom/KINGDOM/kingdom.js init .
```

Cloning lets you browse the code, tweak it, and pull updates with a plain `git pull`.

---

### After installing into a project

`init .` copies a self-contained Kingdom into `.kingdom/` and writes real Claude Code subagents
into `.claude/agents/`. From that point on, everything lives locally in your project — no global
tool required:

```bash
node .kingdom/kingdom.js families        # the family tree
node .kingdom/kingdom.js medals          # the Hall of Honors
node .kingdom/kingdom.js summon          # generate a vow-bearing quest prompt
node .kingdom/kingdom-server.js          # the live web Throne Room → http://localhost:8080
claude                                   # your session is now the Archduke — give it a quest
```

Full docs and command reference: **[`KINGDOM/README.md`](KINGDOM/README.md)** ·
The living rules: **[`KINGDOM/DOCTRINE.md`](KINGDOM/DOCTRINE.md)**

---

## 🔄 Updating & reinstalling

There are two layers to updating: **getting the latest Kingdom code** and **upgrading a project
you already installed into**. You need both.

### 1. Get the latest Kingdom code

- **If you used the global install (B):** run `npm install -g github:AIWhispererGal/claude-kingdom`
  again — same command, it just overwrites with the latest.
- **If you cloned (C):** `cd ~/claude-kingdom && git pull`.
- **If you used npx (A):** nothing to update centrally — npx always fetches a fresh copy when you
  run it. If you want to force the very latest commit rather than a cached version, use:
  `npx github:AIWhispererGal/claude-kingdom@main …`

### 2. Upgrade a project you already installed into

Once you have the latest code, push it into your existing project:

```bash
cd your-project
kingdom init . --reinstall                                                  # global install (B)
# or:  node ~/claude-kingdom/KINGDOM/kingdom.js init . --reinstall         # clone (C)
```

`--reinstall` refreshes the engine, the subagent definitions, the `CLAUDE.md` block, and the
SessionStart hook — **while keeping all your project's memory intact.** Your Chronicle
(`history/`), honors, evolved family lineages, the registry, and your reign count and sovereign
title in `PROJECT.json` are untouched. It will not wipe your kingdom's history.

For a lighter refresh — when you just founded or retired a family and want the court to reflect
that without a full code upgrade — use:

```bash
node .kingdom/kingdom.js sync-agents
```

## 🗺️ Repo layout

| Path | What lives here |
|------|-----------------|
| [`KINGDOM/`](KINGDOM/) | The Kingdom itself — CLI (`kingdom.js`), web Throne Room (`kingdom-server.js`, `web/`), roles, families, honors, history. |
| [`KINGDOM/README.md`](KINGDOM/README.md) | The full user guide. |
| [`docs/superpowers/`](docs/superpowers/) | The design specs and implementation plans for each stage. |
| `KINGDOM_SYSTEM_BUILD_PROMPT.md` | The original commission that started it all. |

## 🛠️ How it was built

Entirely with Claude Code, test-first and **subagent-driven** — a lead orchestrator dispatching a fresh
implementer subagent per task, with independent spec + code-quality review between each, across three shipped
stages. The specs and plans under `docs/superpowers/` are the real artifacts from that process. Zero runtime
dependencies — Node built-ins only.

## 📜 License

[MIT](LICENSE) — use it, fork it, found your own dynasty.

---

*INVESTIGATE. BUILD. VERIFY. VOW. REMEMBER.* 🪶
