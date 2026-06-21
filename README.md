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

## 🚀 Quickstart

```bash
# Install the Kingdom into a project (run once, from the project you want it in):
node /path/to/claude-kingdom/KINGDOM/kingdom.js init .

# Then everything is local to that project:
node .kingdom/kingdom.js families        # the family tree
node .kingdom/kingdom.js medals          # the Hall of Honors
node .kingdom/kingdom-server.js          # the live web Throne Room → http://localhost:8080
claude                                   # your session is now the Archduke — give it a quest
```

Full docs and command reference: **[`KINGDOM/README.md`](KINGDOM/README.md)** ·
The living rules: **[`KINGDOM/DOCTRINE.md`](KINGDOM/DOCTRINE.md)**

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
