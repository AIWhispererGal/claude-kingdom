# Spec: `kingdom init` — Binding the Living Kingdom to a Real Project (Stage 1)

**Date:** 2026-06-17
**Author:** Archduke ClaudeCode I "The Architect" (brainstormed with the user)
**Status:** Draft for review
**Scope:** Stage 1 of 2. Stage 2 (the live web Archduke) is summarized at the end for seam-correctness but specced separately.

---

## 1. Purpose & Context

Today the Living Kingdom (`KINGDOM/`) is a self-contained, project-agnostic system: a CLI + web UI that
generates summons *prompts*, tracks an honor system, and records a self-evolving roster of agent families.
It does **not** know about any real codebase, and its "agents" are described in a generated prompt rather
than dispatched as real subagents.

This spec adds the ability to **install a self-contained Kingdom into a real project** so that the project's
own Claude Code sessions become Kingdom sessions that dispatch **real, tool-restricted subagents**.

Decisions already made with the user (do not relitigate):
- **Per-project Kingdoms.** `init` copies the whole Kingdom into `<project>/.kingdom/`. Each project's
  registry/history/honors evolve independently. No cross-project shared memory.
- **Enforced tool limits.** Each role's hard limits become a real Claude Code subagent `tools:` allowlist
  (verified: the frontmatter allowlist is a hard restriction, not advisory).
- **Engine = Route A** (Stage 2): drive the real `claude` CLI headlessly; reuses existing Claude Code login,
  no API key required. (Out of scope for Stage 1; listed under §9.)

## 2. Goals (Stage 1)

1. `kingdom init [project-dir]` installs a working `.kingdom/` into a target project.
2. Generate one **real Claude Code subagent** (`.claude/agents/<role>-<family>.md`) per ACTIVE family, with
   a system prompt assembled from role + family + skills, and a `tools:` allowlist matching the role's limits.
3. Write a project `CLAUDE.md` (or append a managed block) that makes the session the orchestrator and
   explains how to summon the court and close the loop.
4. Write a safe project `.claude/settings.json` permission posture and a `PROJECT.json` binding record.
5. `kingdom sync-agents` regenerates `.claude/agents/` + refreshes managed config after the roster changes.

**Success:** In an `init`-ed project, running Claude Code there shows the generated court subagents, a
DETECTIVE subagent cannot Edit, an ARMARIUS subagent is the only one that may run git, and the web Throne
Room runs from `.kingdom/`. After `new-family` / `extinct` + `sync-agents`, the `.claude/agents/` set matches.

## 3. Non-Goals (Stage 1)

- The Regent / headless `claude` bridge and the web chat lane (Stage 2).
- Automatic session recording via hooks (loop-closing stays instruction-driven via CLAUDE.md for now).
- Cross-project memory; SDK runtime; multi-noble concurrency.

## 4. Command Surface

All commands live in `KINGDOM/kingdom.js` (and therefore in every copied `.kingdom/kingdom.js`).

### 4.1 `kingdom init [project-dir] [--reinstall]`
- **Source root** = the directory containing the running `kingdom.js` (`KINGDOM_ROOT`).
- **Target** = `path.resolve(project-dir || process.cwd())`. Must be an existing directory (error otherwise).
- **Guards:** refuse if target is inside the source Kingdom or vice-versa (would recurse). If
  `<target>/.kingdom` already exists and `--reinstall` is not set → error: *"Already initialized. Use
  `sync-agents` to refresh the court, or `init --reinstall` to upgrade code while preserving memory."*
- **Steps (fresh init):**
  1. Recursively copy source Kingdom → `<target>/.kingdom/`. Exclude `.git`, and empty out
     `summons/output/` (keep a `.gitkeep`). Everything else (REGISTRY, roles, families, history, honors,
     orchestrators, summons code+templates, web, kingdom.js, kingdom-server.js, DOCTRINE.md, CLAUDE.md,
     generator) is copied.
  2. Write `<target>/.kingdom/PROJECT.json` (see §6.4).
  3. Generate `<target>/.claude/agents/*.md` from `<target>/.kingdom/agents/REGISTRY.json` (see §5).
  4. Write/merge `<target>/CLAUDE.md` managed block (see §6.2).
  5. Write/merge `<target>/.claude/settings.json` permission posture (see §6.3).
  6. Print a summary + next steps.
- **`--reinstall`:** re-copy **code** files (kingdom.js, kingdom-server.js, summons/*.js, web/*, generator,
  role *definitions* under agents/roles/) but **preserve evolved data** (`agents/REGISTRY.json`,
  `agents/families/**`, `history/**`, `honors/**`, `PROJECT.json`). Then re-run steps 3–5. This is the
  upgrade path and must never destroy a project's accumulated memory.

### 4.2 `kingdom sync-agents`
- Run from inside a project (resolves `.kingdom/` relative to cwd, falling back to `KINGDOM_ROOT` if run in
  the source). Regenerates the full `.claude/agents/` set from the current REGISTRY (adds new families,
  removes files for families now EXTINCT/absent), and refreshes the CLAUDE.md managed block + settings allow
  list (so newly founded families become dispatchable). Prints a diff summary (added/removed/kept counts).

## 5. Subagent Generation

### 5.1 Which agents
One file per `(role, family)` where the family's `status !== "EXTINCT"`. With the seed roster that is 13
files (BLACKSMITH has two: IRONFORGE + HAMMERFALL). Extinct families are skipped; `sync-agents` deletes any
stale file whose family no longer qualifies.

### 5.2 Filename & name
`<roleLower>-<familyLower>.md`, e.g. `detective-greymantle.md`. Frontmatter `name` matches the basename
(`detective-greymantle`) — this is the `subagent_type` the orchestrator passes to the Agent tool.

### 5.3 File format
```markdown
---
name: <role>-<family>
description: <ROLE tagline> — the <FAMILY> line (<one-line family philosophy>). Use when <role when-to-use cue>.
tools: <comma-separated enforced toolset>
---

# <emoji> <ROLE> of the <FAMILY> line

<Role philosophy + core duties + HARD LIMITS, pulled from agents/roles/<ROLE>.md>

## Lineage: <FAMILY>
<Family philosophy + learning strategy, from LINEAGE.md>

## Skills I carry
- <SKILL NAME> — <"Problem This Solves" one-liner>
- … (one per SKILLS/*.md)

## My Vow
I, <role>-<family>, of the <FAMILY> line, accept this task upon my honor.
MY CHARGE: <the bounded task the orchestrator assigns>.
MY LIMITS: I will not exceed my role; my tools are restricted to enforce it.
MY VOW: I will report true findings, true counts only.

Report in the <ROLE> reporting format. Respect your hard limits.
```
The generator reads: REGISTRY (emoji, tagline, family entry), `agents/roles/<ROLE>.md` (philosophy, duties,
hard limits, reporting format), `agents/families/<role>/<FAMILY>/LINEAGE.md`, and that family's `SKILLS/*.md`
(name + "Problem This Solves" line). Missing source files degrade gracefully (omit the section, never crash).

### 5.4 Tool mapping (role → enforced `tools:`)
| Role | `tools:` | Enforced limit |
|------|----------|----------------|
| DETECTIVE | `Read, Grep, Glob` | read-only; cannot alter code |
| KINGSWIT | `Read, Grep, Glob` | critique only |
| SERF | `Read, Grep, Glob` | count/validate only |
| PRAEGUSTATOR | `Read, Grep, Glob, Bash` | run/inspect (tests); no source edits |
| NECROMANCER | `Read, Grep, Glob, Bash` | git archaeology; no edits |
| ARMARIUS | `Read, Grep, Glob, Bash` | the only line that runs git |
| ARCHIVIST | `Read, Grep, Glob, Write` | writes testaments/docs only |
| EXCHEQUER | `Read, Grep, Glob, Bash, Edit` | manifests/lockfiles |
| ILLUMINATOR | `Read, Grep, Glob, Write, Edit` | docs + UI |
| CHIRURGEON | `Read, Grep, Glob, Edit, Bash` | surgical edits |
| BURNINATOR | `Read, Grep, Glob, Edit, Bash` | deletion |
| BLACKSMITH | `Read, Grep, Glob, Write, Edit, Bash` | full build |
| *(any future/unknown role)* | `Read, Grep, Glob` | safe default (read-only) until mapped |

`Agent` is intentionally **not** granted to court members (no court member spawns its own court).

## 6. Generated Project Artifacts

### 6.1 `<project>/.kingdom/`
A full copy of the Kingdom (see §4.1). The project's living memory; the web server and CLI run from here.

### 6.2 `<project>/CLAUDE.md` — managed block
Wrapped in `<!-- KINGDOM:START -->` … `<!-- KINGDOM:END -->` markers so re-runs replace (never duplicate)
and any user-authored content outside the markers is preserved. If `CLAUDE.md` is absent, create it with the
block as its content. The block states: you are the orchestrator (a noble of House ClaudeCode) of this
project's Kingdom; how to compose a summons (`node .kingdom/kingdom.js summon`); the list of available court
subagents and that you dispatch them via the **Agent tool** (`subagent_type: <role>-<family>`); the rules
(INVESTIGATE→BUILD→VERIFY; verify every report; ARMARIUS runs all git; record the session + grant/petition
honors at the end via `node .kingdom/kingdom.js …`); and a pointer to `.kingdom/DOCTRINE.md`.

### 6.3 `<project>/.claude/settings.json` — permission posture
Merge (never clobber) a `permissions.allow` list scoped to the project. Default entries:
`Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash(git:*)`, `Bash(npm:*)`, `Bash(node:*)`, plus one
`Agent(<role>-<family>)` per generated court subagent. Existing keys/arrays are preserved and de-duplicated.
The intent is auto-approval of project-scoped work under `--permission-mode acceptEdits` (Stage 2); network
and out-of-project actions remain unlisted and therefore not auto-approved. A `"$kingdom"` note key documents
that the user may broaden this.

### 6.4 `<project>/.kingdom/PROJECT.json`
```json
{
  "project_name": "<basename of target>",
  "project_path": "<absolute target path>",
  "initialized_at": "<ISO timestamp>",
  "kingdom_version": "<version string from kingdom.js>",
  "source_kingdom": "<absolute source KINGDOM_ROOT>"
}
```
Read by the CLI and web to display "the Kingdom of <project_name>".

## 7. Architecture & Code Organization

- New module **`KINGDOM/agents/agent_gen.js`** (or a section of `kingdom.js`): pure functions
  `buildSubagent(role, family) -> {filename, contents}` and `toolsForRole(role) -> string`. Reuses
  `summons/generator.js` helpers (`loadRegistry`, `readTextSafe`, `readLineage`, `listFamilySkills`,
  `skillTitle`, `extractProblem`, `PATHS`). Kept separate so it is unit-testable without the CLI.
- New functions in `kingdom.js`: `cmdInit(args)`, `cmdSyncAgents(args)`, plus helpers `copyTree(src,dst,opts)`,
  `writeManagedBlock(file, markerStart, markerEnd, content)`, `mergeSettingsAllow(file, entries)`.
- A `KINGDOM_VERSION` constant added to `kingdom.js` (e.g. `"1.0.0"`), surfaced in PROJECT.json and `help`.
- `copyTree` is dependency-free (fs recursion) with an exclude predicate.

Each unit has one purpose, a clear interface, and is testable in isolation (generation is pure; filesystem
effects are confined to `cmdInit`/`cmdSyncAgents`/helpers).

## 8. Testing Strategy (Stage 1)

A small zero-dependency test script (`KINGDOM/test/test_init.js`, run via `node`):
1. **Generation (pure):** `buildSubagent('DETECTIVE','GREYMANTLE')` → frontmatter parses; `tools` ===
   `Read, Grep, Glob`; body contains the GREYMANTLE philosophy and at least one skill line. Repeat for a
   builder (BLACKSMITH/IRONFORGE → includes `Edit`,`Write`,`Bash`) and ARMARIUS (includes `Bash`, excludes
   `Edit`).
2. **`init` integration:** init into a fresh temp dir (`fs.mkdtemp`). Assert: `.kingdom/REGISTRY.json` exists;
   `.claude/agents/` has exactly 13 files (one per active family) with valid frontmatter; `CLAUDE.md` contains
   the managed markers once; `.claude/settings.json` parses and includes the court `Agent(...)` allows;
   `PROJECT.json` fields correct. Re-init without `--reinstall` errors; with `--reinstall` preserves a
   sentinel edit made to the temp project's `.kingdom/history/sessions.json`.
3. **`sync-agents`:** in the temp project, run `new-family burninator EMBERWRIGHT` then `sync-agents` →
   `burninator-emberwright.md` appears; run `extinct burninator EMBERWRIGHT` + `sync-agents` → that file is
   removed; counts reported correctly.
4. Clean up all temp dirs. The script prints PASS/FAIL per assertion and exits non-zero on any failure.

Manual smoke (documented, not automated): in an init-ed project, `claude -p "what subagents can you use?"`
lists the court; a DETECTIVE dispatch cannot edit.

## 9. Forward Look — Stage 2 (separate spec)

Seams Stage 1 must leave clean:
- `PROJECT.json` is the binding the Regent reads to know the project root and Kingdom location.
- `.claude/agents/` + `.claude/settings.json` are exactly what headless `claude -p` consumes.
- The web app and SSE event hub already exist and are extensible with new event kinds.

Stage 2 will add: **`regent.js`** (spawns `claude -p --output-format stream-json --verbose [--resume <id>]
--permission-mode acceptEdits` in the project root; defensively parses the stream; detects subagent dispatch
via the `Agent` tool-use + `parent_tool_use_id` correlation; persists `session_id` in `.kingdom/regent.json`);
**server endpoints** `/api/archduke/say` and `/api/archduke/stop` plus new SSE event kinds (`archduke-text`,
`subagent-dispatch`, `subagent-return`, `tool-use`, `turn-done`); and a **web chat lane + live subagent
status cards** in `app.html`. A build-time probe will confirm the installed `claude` version's stream-json
schema before relying on field names.

## 10. Open Questions / Risks

- **Roman/Date in CLI:** `kingdom.js` is an ordinary CLI (not a workflow script), so `new Date().toISOString()`
  is fine for `initialized_at`.
- **settings.json Bash patterns** may need tuning per project ecosystem; the default list is conservative and
  user-broadenable (documented via the `"$kingdom"` note).
- **CLAUDE.md merge** must be robust to a missing/locked file and to repeated runs (idempotent managed block).
