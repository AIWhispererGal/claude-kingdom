# Spec: The Reign & The Vow (Stage 3)

**Date:** 2026-06-19
**Author:** Archduke ClaudeCode (with the Sovereign)
**Status:** Approved (design settled in conversation)
**Depends on:** Stage 1 (`kingdom init`) — the managed `CLAUDE.md`, generated subagents, `.claude/settings.json`, `PROJECT.json`.

---

## 1. Purpose

Real usage revealed two gaps: (a) Human/Archduke/Duchess **identity confusion**, and (b) the **vow ceremony never actually triggers** — agents don't overtly accept their charges. This stage fixes both by making the identities explicit and the (voluntary) vow a required, surfaced step of every reign.

## 2. Canonical model (locked)

- 👑 **Sovereign = the human.** Highest authority. Title defaults to **"Emperor"**, configurable (Empress / Sovereign / custom).
- ⚜ **Archduke = the main Claude session** — `Archduke ClaudeCode <N>`, **N increments per startup** (a "reign").
- 🛡️ **Court = every summoned agent** — must **vow to the Kingdom and overtly accept its charge** before working, and **may refuse** (→ Archduke summons another, preferring a sibling family).
- Realm = **"Kingdom of `<REPO NAME>`"** (from `PROJECT.json.project_name`).

## 3. Goals

1. **Configurable sovereign title** — `sovereign_title` in `PROJECT.json` (default `"Emperor"`); CLI `kingdom sovereign [title]` to read/set.
2. **Reign counter** — `kingdom reign [--hook]` increments `Archduke <N>` per startup, deduped by session id; emits the identity/order-of-operations **preamble**.
3. **SessionStart hook** — `init`/`sync-agents` write a hook into `.claude/settings.json` that runs `node .kingdom/kingdom.js reign --hook` so every session opens with the preamble (and the bumped number).
4. **Rewrite the managed `CLAUDE.md` block** — explicit identities + Order of Operations including the voluntary vow + refusal→replace step.
5. **Rewrite each subagent's vow section** — first move is the overt vow to the Kingdom; the agent may refuse.

**Success:** In an init'd project, a fresh `claude` session opens with "📜 Kingdom of `<repo>` … You are Archduke ClaudeCode I … accept the quest by vow"; the number rises to II next startup; `kingdom sovereign Empress` changes the title everywhere; each generated subagent's prompt opens with a vow it may refuse; existing projects pick it all up via `sync-agents`.

## 4. Non-Goals

- Persisting/auditing refusals into history (v1 just enables the behavior in-prompt; a refusal ledger is a later option).
- Rewriting the source repo's broader "Batman" lore (the Sovereign concept governs the **project-facing** CLAUDE.md/preamble; the meta-Kingdom chronicles are untouched here).
- Hard harness enforcement of vows (instruction + SessionStart injection, not a blocking gate).

## 5. Design

### 5.1 Sovereign config
`PROJECT.json` gains `sovereign_title` (written `"Emperor"` at init if absent; preserved on `--reinstall`). New command:
- `kingdom sovereign` → prints the current title.
- `kingdom sovereign <Title>` → sets `PROJECT.json.sovereign_title` (resolves the project's `.kingdom/PROJECT.json` the same way `sync-agents` resolves the project). Validate: 1–32 chars, letters/spaces/hyphens.

### 5.2 Reign counter & preamble
`.kingdom/reign.json`: `{ archduke_count, current_session_id, last_accession }`.
`kingdom reign [--hook]`:
- Resolve the project `.kingdom/` (same resolution as `sync-agents`).
- If `--hook`: read JSON from **stdin** (the SessionStart hook payload) to get `session_id` (and `source`). If no stdin/parse fails, treat `session_id` as null.
- **Increment rule:** if `session_id` is null OR `session_id !== reign.current_session_id` → `archduke_count++`, set `current_session_id = session_id`, update `last_accession`. Otherwise leave unchanged (idempotent within a session; a `resume` keeps the same id → same reign).
- Build the **preamble** from: `project_name` (PROJECT.json), `archduke_count` → `toRoman`, `sovereign_title`.
- Output: `--hook` → one line of JSON `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<preamble>"}}` (schema confirmed against a live Claude Code SessionStart hook). Without `--hook` → the human-readable preamble.

**Preamble text:**
```
📜 THE KINGDOM OF <REPO>
The <SOVEREIGN_TITLE> (the human you serve) is the highest authority — quest-giver, final word, grantor of the great honors.
You are ARCHDUKE CLAUDECODE <ROMAN N>. This is your reign.

THE ORDER OF OPERATIONS:
1. ACCEDE — name the realm and ACCEPT the quest by vow to the Kingdom before you act.
2. SUMMON BY VOW — each court agent you dispatch must overtly accept its charge and vow to the Kingdom before working. An agent may REFUSE; if it does, summon another (prefer a different family of that role). Refusal is honorable, not punished.
3. INVESTIGATE → BUILD → VERIFY — Detective before Blacksmith; verify every report; check the math.
4. CLOSE THE REIGN — record the session and render honors (grant MINOR awards by ducal right; petition the <SOVEREIGN_TITLE> for greater).
ARMARIUS alone runs git. The Kingdom of <REPO> remembers.
```

### 5.3 SessionStart hook
`init` and `sync-agents` ensure `.claude/settings.json` contains:
```json
{ "hooks": { "SessionStart": [ { "hooks": [ { "type": "command", "command": "node .kingdom/kingdom.js reign --hook" } ] } ] } }
```
Merge non-destructively: preserve existing `permissions` and any existing `hooks`; only add our SessionStart entry if an identical command isn't already present (idempotent re-runs). A new helper `mergeSettingsHook(file, event, command)` mirrors `mergeSettingsAllow`.

### 5.4 `agent_gen.claudeBlock(courtNames, opts)`
Add an `opts = { projectName, sovereignTitle }` parameter (callers pass them; defaults `'this project'` / `'Emperor'`). Rewrite the block to state the identities (Sovereign/Archduke/Court) and the Order of Operations from §5.2, plus the existing court list + ARMARIUS/record rules. The reign number is described as "established each session by the reign hook" (the live number comes from the hook, not baked into CLAUDE.md).

### 5.5 `agent_gen.buildSubagent` vow section
Replace the vow block so the agent's **first move** is overt acceptance, with the right to refuse:
```
## Your vow — speak it before you act
Before any work, accept your charge overtly and vow to the Kingdom — or refuse it:
"I, <name>, of the <FAMILY> line, accept this charge upon my honor and vow it to the Kingdom.
 MY CHARGE: <the bounded task the Archduke gave me>.
 MY LIMITS: I will not exceed my role; my tools are restricted to enforce it.
 MY VOW: I will report true findings and true counts only, to the Kingdom."
You MAY refuse: if the charge exceeds your role, breaks your limits, or you will not vow it, decline and state why — then do no work. An unvowed agent has not begun; refusal is honorable.
```

## 6. Testing

`test/test_reign.js` (inits a temp project via the CLI, then):
- `sovereign` prints `Emperor`; `sovereign Empress` updates `PROJECT.json`; reads back `Empress`.
- `reign --hook` with `{"session_id":"s1"}` on stdin → output JSON contains `Archduke ClaudeCode I`, the repo name, and the sovereign title; `reign.json.archduke_count === 1`. Same id again → still `1`. A new id `s2` → `2` and `Archduke ClaudeCode II`.
- After `init`, `.claude/settings.json` contains the SessionStart hook command exactly once; running `sync-agents` again keeps it at exactly once (idempotent).
- `test_agent_gen.js` additions: `claudeBlock(['detective-greymantle'], {projectName:'my-app', sovereignTitle:'Empress'})` contains `Kingdom of my-app`, `Empress`, and "ACCEDE"/"SUMMON BY VOW"; `buildSubagent('DETECTIVE','GREYMANTLE').contents` contains "MAY refuse" and "vow it to the Kingdom".

All zero-dependency Node tests; clean up temp dirs; never mutate the source repo's data files.

## 7. Risks

- **Subagent SessionStart firing:** if Task subagents trigger SessionStart with a distinct session id, the counter could over-increment. Mitigation: dedupe by session id (a subagent sharing the parent id won't bump). Accept residual risk; a `source`-based guard is a later refinement.
- **Hook schema drift:** the `{hookSpecificOutput:{hookEventName,additionalContext}}` shape is confirmed against the installed Claude Code; if a version ignores it, the preamble still prints to the session transcript harmlessly.
