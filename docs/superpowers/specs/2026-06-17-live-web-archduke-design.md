# Spec: The Live Web Archduke (Stage 2)

**Date:** 2026-06-17
**Author:** Archduke ClaudeCode I "The Architect" (with the user)
**Status:** Draft for review
**Depends on:** Stage 1 (`kingdom init`) — shipped. Builds on `.kingdom/`, `.claude/agents/`, `.claude/settings.json`, `PROJECT.json`, and the existing `kingdom-server.js` SSE hub + `web/app.html`.

---

## 1. Purpose

Make the browser the single surface: **chat with the Archduke (a real headless Claude Code running in the project) and watch its court of subagents work live.** You type a quest in the web Throne Room; the server relays it to `claude` headlessly; the Archduke's replies stream into a chat lane and every subagent dispatch streams into the live court feed.

Decisions already approved (do not relitigate):
- **Engine = Route A.** Drive the real `claude` CLI headlessly (`-p --output-format stream-json --verbose`). Reuses the user's existing Claude Code login — **no API key required**.
- **Full web surface.** Chat + dispatch + the existing Summon/Chronicle/Honors/Family-Tree tabs.
- **Verified facts (from the capability briefing):** headless auto-loads `.claude/agents/` + `CLAUDE.md`; subagent dispatches are detectable via the `Agent` tool-use in the stream + `parent_tool_use_id` correlation (no dedicated subagent event); multi-turn via captured `session_id` + `--resume`; safe posture `--permission-mode acceptEdits` + the project `settings.json` allowlist; `tools:` frontmatter is a hard allowlist.

## 2. Goals

1. A **Regent** module that runs a headless `claude` turn in the project, parses its `stream-json`, and emits **normalized events**.
2. Server endpoints `POST /api/archduke/say`, `POST /api/archduke/stop`, `GET /api/archduke/status`, streaming normalized events over the existing SSE hub.
3. A **chat lane + live subagent status** in `web/app.html`: send a message, watch the Archduke reply and its court light up (dispatched → working → returned), with a Stop button.
4. Multi-turn continuity via `session_id` persisted in `.kingdom/regent.json` + `--resume`.
5. **Testable without the real model:** the parser is pure; a fake `claude` is injected for automated tests.

**Success:** In an init'd project, `node .kingdom/kingdom-server.js` → open the page → type "Investigate X and dispatch a detective" → the chat lane streams the Archduke's text and the feed shows `🔍 detective-greymantle dispatched → returned`. Automated tests prove the parse+stream+endpoint pipeline using a fake `claude`, with zero live-model calls.

## 3. Non-Goals (Stage 2)

- Multi-user / concurrent sessions (one active turn at a time).
- An auth-management UI (rely on existing `claude` login; clear error if absent).
- Editing files directly from the browser (the Archduke does that through its tools).
- Mobile-polish; Agent-SDK engine (Route B).

## 4. Architecture & Components

### 4.1 `KINGDOM/regent.js` (new)
Two parts — a **pure parser** and a thin **process manager** — so the hard logic is unit-testable.

**Pure parser:** `normalizeStreamObj(obj, state) -> { events: [...], state }`
- Input: one parsed `stream-json` object + a small running `state` (`{ subagents: {<tool_use_id>: name}, sessionId }`).
- Output: zero or more normalized events and updated state. Defensive: unknown shapes yield `[]` (never throws).
- Detection rules (tolerant to schema variation across `claude` versions — match on the meaningful fields, not exact wrapper names):
  - object has a `session_id` (e.g. system/init) → `{kind:'session', sessionId}` and record it.
  - assistant text content → `{kind:'archduke-text', text}` (accumulate deltas or whole-message text).
  - a tool_use whose name is `Agent`/`Task` → `{kind:'subagent-dispatch', name:<subagent_type|description>, task:<prompt excerpt>, id:<tool_use_id>}`; record `state.subagents[id]=name`.
  - a tool_use with any other name → `{kind:'tool-use', tool:<name>, summary:<short>}`.
  - a tool_result whose `tool_use_id`/`parent_tool_use_id` matches a recorded Agent id → `{kind:'subagent-return', name, summary}`.
  - a final/result object (has `result` or `subtype:'success'|'error_*'` + `total_cost_usd`) → `{kind:'turn-done', cost, ok}`.

**Process manager:** `class Regent`
- Constructor: `new Regent({ projectRoot, sessionFile, command='claude', baseArgs=[] })`. `command`/`baseArgs` exist so tests inject a fake (`command:'node', baseArgs:['<fake-claude.js>']`).
- `say(text, onEvent) -> Promise<{ok, sessionId, code}>`: spawns `command` with args `[...baseArgs, '-p', text, '--output-format','stream-json','--verbose','--permission-mode','acceptEdits', ...(sessionId? ['--resume', sessionId]:[])]`, `cwd: projectRoot`. Reads stdout line-by-line, `JSON.parse` each (skip blank/unparseable lines), feeds through `normalizeStreamObj`, calls `onEvent(ev)` for each normalized event, and on a `session` event persists `sessionId` to `sessionFile` (`.kingdom/regent.json`). Resolves on child exit. Rejects/`onEvent({kind:'error'})` if the binary is missing (ENOENT) with a clear message.
- `stop()`: kills the active child (and emits a `turn-done` with `aborted:true`). `busy` getter. `sessionId` loaded from `sessionFile` on construction.
- One active turn at a time (`say` while busy → throws/`{ok:false, busy:true}`).

### 4.2 `KINGDOM/kingdom-server.js` (modify)
- On startup, resolve `projectRoot` (if `KINGDOM_ROOT` basename is `.kingdom`, it's `dirname(KINGDOM_ROOT)`; else the server's own root for the dev/source case) and construct one `Regent({projectRoot, sessionFile: <dotK>/regent.json})`.
- `POST /api/archduke/say {text}`: if `regent.busy` → 409 `{ok:false, busy:true}`. Else respond `{ok:true, started:true}` immediately and run `regent.say(text, ev => emit(mapToFeed(ev)))` in the background. Each normalized event becomes an SSE `kingdom` event: `archduke-text` (chat lane), `subagent-dispatch`/`subagent-return` (court feed, with the role emoji resolved from the name prefix), `tool-use` (feed, subtle), `turn-done`, `error`.
- `POST /api/archduke/stop`: `regent.stop()` → `{ok:true}`.
- `GET /api/archduke/status`: `{busy, sessionId}`.
- All existing endpoints unchanged.

### 4.3 `KINGDOM/web/app.html` (modify)
- The **Throne Room** tab gains a **chat lane**: a transcript area (Archduke turns + your messages), an input box ("Address the Archduke") + Send, a Stop button, and a busy indicator. Send → `POST /api/archduke/say`; Stop → `/api/archduke/stop`. On load, `GET /api/archduke/status` to reflect busy/session.
- The persistent **Live Feed** (already present) renders the new kinds with icons and per-subagent status (dispatched → returned), distinct from the existing manual-action events.
- `archduke-text` events append/stream into the current Archduke transcript bubble; `turn-done` closes it.
- A small "🆕 New session" control deletes `.kingdom/regent.json` via a new `POST /api/archduke/reset` (clears `sessionId`) so the next turn starts fresh.
- Graceful states: if a `say` returns `{busy}`, show "the Archduke is mid-deliberation"; if an `error` event reports the CLI is missing, show install guidance.

## 5. Safety & Auth

- The Regent spawns `claude` with `cwd = projectRoot` and `--permission-mode acceptEdits`; the project `.claude/settings.json` allowlist (written by Stage 1 init) governs the court Agents + project-scoped tools. Network/out-of-project actions are not auto-approved (and headless can't prompt, so they fail safe). **Not** `bypassPermissions`.
- Auth: reuses cached Claude Code login. No API key. If `claude` is not on PATH, the `error` event/endpoint tells the user.
- Each browser turn spends Claude usage; one turn at a time; Stop kills the turn.

## 6. Testing Strategy

- **Parser unit tests** (`test/test_regent.js`): feed `normalizeStreamObj` a sequence of representative objects (system/init with session_id; an assistant text; an `Agent` tool_use; a matching tool_result; a final result) and assert the emitted normalized events + state transitions (session captured, dispatch→return correlation by id, turn-done with cost). Pure, no spawning.
- **Regent integration with a fake claude** (`test/fake-claude.js` + `test/test_regent.js`): a tiny node script that prints canned `stream-json` lines (incl. an Agent dispatch + result) and exits. Construct `new Regent({projectRoot: tmp, command:'node', baseArgs:[fakePath]})`, call `say`, collect `onEvent` events, assert the full pipeline (incl. `session_id` persisted to `regent.json`). Also assert ENOENT handling by pointing `command` at a nonexistent binary → an `error` event, no crash.
- **Server endpoint test**: spin the server on a test port with a Regent wired to the fake claude (via an env override, e.g. `KINGDOM_CLAUDE_CMD`/`KINGDOM_CLAUDE_BASEARGS`), `POST /api/archduke/say`, and read the SSE stream to confirm `archduke-text` + `subagent-dispatch` frames arrive; a second concurrent `say` returns 409.
- **Manual smoke (documented):** real `claude` in an init'd project; `say "list the subagents available to you and dispatch detective-greymantle to summarize README"`; observe streaming + a real dispatch in the feed.

## 7. Open Questions / Risks

- **stream-json schema drift:** field/wrapper names vary by `claude` version. Mitigation: the parser matches on meaningful fields (session_id present, tool name == Agent, cost present) rather than exact event-type strings, and ignores anything it doesn't recognize. A `KINGDOM_REGENT_DEBUG` env dumps raw lines to help adapt to a given install.
- **Nested `claude`:** running headless `claude` from within an environment that is itself Claude Code may have sandbox/auth nuances; this is the user's own project shell, expected to work with their login. The fake-claude tests make CI independent of this.
- **Partial tool-input JSON in deltas:** the briefing notes tool input can stream as partial strings. v1 reads the consolidated assistant/tool_use objects `--verbose` emits per turn; if a given version only emits fine-grained deltas, the parser still captures the final tool_use object. Buffering of partial deltas is a follow-up only if needed.
