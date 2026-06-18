# Live Web Archduke (Stage 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the user chat with a headless Claude Code "Archduke" from the web Throne Room and watch its subagent court dispatch live.

**Architecture:** A new `KINGDOM/regent.js` = a pure `stream-json` parser (`normalizeStreamObj`) + a `Regent` process manager that spawns `claude -p … --output-format stream-json` in the project and emits normalized events. `kingdom-server.js` gains `/api/archduke/*` endpoints that run one Regent and pump its events into the existing SSE hub. `web/app.html` gains a chat lane + live subagent status. A fake `claude` makes the pipeline testable with no live-model calls.

**Tech Stack:** Node 18+ built-ins (`child_process`, `fs`, `path`, `readline`/manual line split). No new deps.

**Spec:** `docs/superpowers/specs/2026-06-17-live-web-archduke-design.md`

---

## File Structure
- **Create `KINGDOM/regent.js`** — `normalizeStreamObj(obj,state)` (pure) + `class Regent` (process mgmt) + `extractText`/`summarizeInput` helpers.
- **Create `KINGDOM/test/fake-claude.js`** — emits canned stream-json lines for tests.
- **Create `KINGDOM/test/test_regent.js`** — parser unit tests + Regent-with-fake integration tests.
- **Modify `KINGDOM/kingdom-server.js`** — construct a Regent; add `/api/archduke/say|stop|status|reset`; map events to `emit()`.
- **Create `KINGDOM/test/test_server_archduke.js`** — endpoint test using the fake claude via env override.
- **Modify `KINGDOM/web/app.html`** — chat lane + live subagent rendering + new-session control.
- **Modify `KINGDOM/README.md`** — "Talk to the Archduke" section.

---

## Task 1: Pure stream parser

**Files:** Create `KINGDOM/regent.js`; Create `KINGDOM/test/test_regent.js`

- [ ] **Step 1: Write failing parser tests**

Create `KINGDOM/test/test_regent.js`:
```js
'use strict';
const { assert, done } = require('./_assert.js');
const R = require('../regent.js');

function feed(objs) {
  let state = R.initialState();
  const events = [];
  for (const o of objs) {
    const r = R.normalizeStreamObj(o, state);
    state = r.state;
    events.push(...r.events);
  }
  return { events, state };
}

// session id captured once
let { events, state } = feed([{ type: 'system', subtype: 'init', session_id: 'sess-1' }]);
assert(events.some(e => e.kind === 'session' && e.sessionId === 'sess-1'), 'session event emitted');
assert(state.sessionId === 'sess-1', 'sessionId stored in state');

// assistant text
({ events } = feed([{ type: 'assistant', message: { content: [{ type: 'text', text: 'Hark!' }] } }]));
assert(events.some(e => e.kind === 'archduke-text' && e.text === 'Hark!'), 'archduke-text emitted');

// Agent dispatch then matching result -> dispatch + return correlated by id
({ events } = feed([
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-1', name: 'Agent', input: { subagent_type: 'detective-greymantle', prompt: 'Find the bug' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: [{ type: 'text', text: 'Root cause at x.js:10' }] }] } },
]));
assert(events.some(e => e.kind === 'subagent-dispatch' && e.name === 'detective-greymantle' && /Find the bug/.test(e.task)), 'subagent-dispatch with name+task');
assert(events.some(e => e.kind === 'subagent-return' && e.name === 'detective-greymantle' && /Root cause/.test(e.summary)), 'subagent-return correlated by id');

// non-Agent tool use
({ events } = feed([{ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: 'a.js' } }] } }]));
assert(events.some(e => e.kind === 'tool-use' && e.tool === 'Edit'), 'generic tool-use emitted');

// final result -> turn-done with cost
({ events } = feed([{ type: 'result', subtype: 'success', total_cost_usd: 0.012, is_error: false }]));
assert(events.some(e => e.kind === 'turn-done' && e.ok === true && e.cost === 0.012), 'turn-done with cost');

// garbage object -> no throw, no events
({ events } = feed([{ random: 'noise' }]));
assert(events.length === 0, 'unknown object yields no events');

done();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node KINGDOM/test/test_regent.js`
Expected: FAIL — `Cannot find module '../regent.js'`.

- [ ] **Step 3: Implement the parser in `KINGDOM/regent.js`**

Create `KINGDOM/regent.js`:
```js
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function initialState() {
  return { sessionId: null, subagents: {}, doneEmitted: false };
}

// Pull readable text out of a string or an array of content blocks.
function extractText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === 'string' ? c : (c && c.text) || '')).join(' ').trim();
  }
  if (typeof content === 'object' && content.text) return content.text;
  return '';
}

function summarizeInput(name, input) {
  if (!input || typeof input !== 'object') return '';
  const k = input.file_path || input.path || input.command || input.pattern || input.url;
  return k ? String(k).slice(0, 120) : '';
}

// Normalize one parsed stream-json object. Returns { events, state }. Never throws.
function normalizeStreamObj(obj, state) {
  const events = [];
  if (!obj || typeof obj !== 'object') return { events, state };

  // session id (system/init or any object carrying one)
  if (obj.session_id && state.sessionId !== obj.session_id) {
    state.sessionId = obj.session_id;
    events.push({ kind: 'session', sessionId: obj.session_id });
  }

  // assistant/user messages carry a content array (either obj.message.content or obj.content)
  const content =
    (obj.message && Array.isArray(obj.message.content) && obj.message.content) ||
    (Array.isArray(obj.content) && obj.content) ||
    null;
  if (content) {
    for (const item of content) {
      if (!item || typeof item !== 'object') continue;
      if (item.type === 'text' && typeof item.text === 'string') {
        if (item.text) events.push({ kind: 'archduke-text', text: item.text });
      } else if (item.type === 'tool_use') {
        const name = item.name;
        if (name === 'Agent' || name === 'Task') {
          const input = item.input || {};
          const sub = input.subagent_type || input.subagentType || input.agent_type || input.description || 'subagent';
          const task = String(input.prompt || input.description || '').replace(/\s+/g, ' ').slice(0, 160);
          if (item.id) state.subagents[item.id] = sub;
          events.push({ kind: 'subagent-dispatch', id: item.id, name: sub, task });
        } else if (name) {
          events.push({ kind: 'tool-use', tool: name, summary: summarizeInput(name, item.input) });
        }
      } else if (item.type === 'tool_result') {
        const id = item.tool_use_id || item.parent_tool_use_id;
        if (id && state.subagents[id]) {
          const name = state.subagents[id];
          delete state.subagents[id];
          events.push({ kind: 'subagent-return', name, summary: extractText(item.content).slice(0, 200) });
        }
      }
    }
  }

  // final result
  const isResult = obj.type === 'result' || typeof obj.total_cost_usd === 'number' ||
    (typeof obj.subtype === 'string' && /^(success|error)/.test(obj.subtype) && ('result' in obj || 'total_cost_usd' in obj));
  if (isResult && !state.doneEmitted) {
    state.doneEmitted = true;
    events.push({ kind: 'turn-done', ok: !obj.is_error, cost: typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : null });
  }

  return { events, state };
}

module.exports = { initialState, normalizeStreamObj, extractText, summarizeInput };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node KINGDOM/test/test_regent.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add KINGDOM/regent.js KINGDOM/test/test_regent.js
git commit -m "feat(regent): pure stream-json normalizer with subagent-dispatch detection"
```

---

## Task 2: Regent process manager + fake claude

**Files:** Modify `KINGDOM/regent.js`; Create `KINGDOM/test/fake-claude.js`; Modify `KINGDOM/test/test_regent.js`

- [ ] **Step 1: Create the fake claude**

Create `KINGDOM/test/fake-claude.js`:
```js
#!/usr/bin/env node
'use strict';
// Pretends to be `claude -p ... --output-format stream-json`. Emits canned lines and exits 0.
const lines = [
  { type: 'system', subtype: 'init', session_id: 'fake-sess-42' },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'I shall summon a detective.' }] } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-1', name: 'Agent', input: { subagent_type: 'detective-greymantle', prompt: 'Investigate the README' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: [{ type: 'text', text: 'The README documents init.' }] }] } },
  { type: 'result', subtype: 'success', total_cost_usd: 0.0009, is_error: false },
];
for (const l of lines) process.stdout.write(JSON.stringify(l) + '\n');
process.exit(0);
```

- [ ] **Step 2: Write failing Regent integration tests**

Append to `KINGDOM/test/test_regent.js` (before `done();`):
```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const FAKE = path.join(__dirname, 'fake-claude.js');

// Regent runs the fake claude end-to-end, emits normalized events, persists session id
(async () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'regent-'));
  const sessionFile = path.join(proj, 'regent.json');
  const reg = new R.Regent({ projectRoot: proj, sessionFile, command: 'node', baseArgs: [FAKE] });
  const got = [];
  const res = await reg.say('hello', (ev) => got.push(ev));
  assert(res.ok === true, 'say resolves ok');
  assert(got.some(e => e.kind === 'archduke-text' && /detective/.test(e.text)), 'streamed archduke text');
  assert(got.some(e => e.kind === 'subagent-dispatch' && e.name === 'detective-greymantle'), 'streamed dispatch');
  assert(got.some(e => e.kind === 'subagent-return' && e.name === 'detective-greymantle'), 'streamed return');
  assert(got.some(e => e.kind === 'turn-done'), 'streamed turn-done');
  assert(JSON.parse(fs.readFileSync(sessionFile, 'utf8')).session_id === 'fake-sess-42', 'session id persisted');
  assert(reg.sessionId === 'fake-sess-42', 'regent remembers session id');

  // missing binary -> error event, no throw
  const reg2 = new R.Regent({ projectRoot: proj, sessionFile, command: 'definitely-not-a-real-binary-xyz', baseArgs: [] });
  const got2 = [];
  await reg2.say('x', (ev) => got2.push(ev));
  assert(got2.some(e => e.kind === 'error'), 'missing binary yields an error event');

  fs.rmSync(proj, { recursive: true, force: true });
  done();
})();
```
Note: move the existing `done();` call OUT of the synchronous bottom — the async IIFE above now calls `done()`. Delete the old standalone `done();` at the end of the file so it runs exactly once, after the async tests.

- [ ] **Step 3: Run to verify it fails**

Run: `node KINGDOM/test/test_regent.js`
Expected: FAIL — `R.Regent is not a constructor`.

- [ ] **Step 4: Implement `Regent` in `KINGDOM/regent.js`**

Add to `KINGDOM/regent.js` (above `module.exports`):
```js
class Regent {
  constructor({ projectRoot, sessionFile, command = 'claude', baseArgs = [] }) {
    this.projectRoot = projectRoot;
    this.sessionFile = sessionFile;
    this.command = command;
    this.baseArgs = baseArgs;
    this.child = null;
    this.sessionId = this._loadSession();
  }
  get busy() { return this.child != null; }
  _loadSession() {
    try { return JSON.parse(fs.readFileSync(this.sessionFile, 'utf8')).session_id || null; } catch { return null; }
  }
  _saveSession(id) {
    try {
      fs.mkdirSync(path.dirname(this.sessionFile), { recursive: true });
      fs.writeFileSync(this.sessionFile, JSON.stringify({ session_id: id, updated_at: new Date().toISOString() }, null, 2) + '\n');
    } catch { /* non-fatal */ }
  }
  say(text, onEvent) {
    if (this.busy) return Promise.resolve({ ok: false, busy: true });
    const args = [...this.baseArgs, '-p', text, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits'];
    if (this.sessionId) args.push('--resume', this.sessionId);
    let state = initialState();
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(this.command, args, { cwd: this.projectRoot });
      } catch (e) {
        onEvent({ kind: 'error', message: `Failed to start Claude Code: ${e.message}` });
        return resolve({ ok: false, error: e.message });
      }
      this.child = child;
      let buf = '';
      const handleLine = (line) => {
        const t = line.trim();
        if (!t) return;
        let obj;
        try { obj = JSON.parse(t); } catch { if (process.env.KINGDOM_REGENT_DEBUG) console.error('REGENT raw:', t); return; }
        const r = normalizeStreamObj(obj, state);
        state = r.state;
        for (const ev of r.events) {
          if (ev.kind === 'session') this._saveSession((this.sessionId = ev.sessionId));
          onEvent(ev);
        }
      };
      child.stdout.on('data', (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      });
      child.stderr.on('data', (d) => { if (process.env.KINGDOM_REGENT_DEBUG) console.error('REGENT stderr:', d.toString()); });
      child.on('error', (e) => {
        onEvent({ kind: 'error', message: `Claude Code could not be launched: ${e.message}. Is the \`claude\` CLI installed and on PATH?` });
      });
      child.on('close', (code) => {
        if (buf.trim()) handleLine(buf);
        this.child = null;
        resolve({ ok: code === 0, code, sessionId: this.sessionId });
      });
    });
  }
  stop() {
    if (this.child) { try { this.child.kill('SIGTERM'); } catch {} this.child = null; return true; }
    return false;
  }
}
```
Update exports to:
```js
module.exports = { initialState, normalizeStreamObj, extractText, summarizeInput, Regent };
```

- [ ] **Step 5: Run to verify it passes**

Run: `node KINGDOM/test/test_regent.js`
Expected: PASS (parser + integration + missing-binary).

- [ ] **Step 6: Commit**

```bash
git add KINGDOM/regent.js KINGDOM/test/fake-claude.js KINGDOM/test/test_regent.js
git commit -m "feat(regent): Regent process manager (spawn claude, stream events, persist session)"
```

---

## Task 3: Server endpoints

**Files:** Modify `KINGDOM/kingdom-server.js`; Create `KINGDOM/test/test_server_archduke.js`

Context: `kingdom-server.js` already has `const ROOT = G.KINGDOM_ROOT;`, an `emit(ev)` that broadcasts `{id,ts,icon,kind,title,detail}` to SSE clients, a `ROLE_EMOJI` map (role→emoji), `sendJSON(res,code,obj)`, `readBody(req)`, and a router with `if (urlPath === '/api/state' ...)` and a `POST_ACTIONS` map. Add the Archduke endpoints to that router.

- [ ] **Step 1: Write a failing endpoint test**

Create `KINGDOM/test/test_server_archduke.js`:
```js
'use strict';
const { assert, done } = require('./_assert.js');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8744;
const FAKE = path.join(__dirname, 'fake-claude.js');
const env = Object.assign({}, process.env, {
  PORT: String(PORT),
  KINGDOM_CLAUDE_CMD: 'node',
  KINGDOM_CLAUDE_BASEARGS: JSON.stringify([FAKE]),
});
const srv = spawn('node', [path.join(__dirname, '..', 'kingdom-server.js')], { env });

function get(p) { return new Promise((res) => http.get(`http://localhost:${PORT}${p}`, (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res({ status:r.statusCode, body:d })); })); }
function post(p, body) {
  return new Promise((res) => {
    const data = JSON.stringify(body);
    const r = http.request(`http://localhost:${PORT}${p}`, { method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} }, (resp)=>{ let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>res({status:resp.statusCode, body:d})); });
    r.write(data); r.end();
  });
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async () => {
  await sleep(700); // server boot
  // open SSE and collect frames
  const frames = [];
  const sse = http.get(`http://localhost:${PORT}/api/events`, (r) => { r.on('data', (c) => frames.push(c.toString())); });
  await sleep(200);

  const status = await get('/api/archduke/status');
  assert(status.status === 200 && /"busy"/.test(status.body), 'status endpoint responds');

  const say = await post('/api/archduke/say', { text: 'hello' });
  assert(say.status === 200 && /"started":true/.test(say.body), 'say starts a turn');

  await sleep(800); // let the fake stream flow
  const all = frames.join('');
  assert(/archduke-text/.test(all), 'SSE carried archduke-text');
  assert(/subagent-dispatch/.test(all), 'SSE carried subagent-dispatch');

  sse.destroy();
  srv.kill('SIGTERM');
  await sleep(150);
  done();
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node KINGDOM/test/test_server_archduke.js`
Expected: FAIL — `/api/archduke/status` 404 and no archduke frames (endpoints not implemented).

- [ ] **Step 3: Implement the endpoints in `kingdom-server.js`**

Near the top (after `ROOT` is defined and `G`/`path`/`fs` are required), add:
```js
const { Regent } = require('./regent.js');
const PROJECT_ROOT = path.basename(ROOT) === '.kingdom' ? path.dirname(ROOT) : path.dirname(ROOT);
const regent = new Regent({
  projectRoot: PROJECT_ROOT,
  sessionFile: path.join(ROOT, 'regent.json'),
  command: process.env.KINGDOM_CLAUDE_CMD || 'claude',
  baseArgs: process.env.KINGDOM_CLAUDE_BASEARGS ? JSON.parse(process.env.KINGDOM_CLAUDE_BASEARGS) : [],
});

// Map a normalized Regent event to an SSE feed event.
function archdukeEmit(ev) {
  if (ev.kind === 'archduke-text') return emit({ icon: '👑', kind: 'archduke-text', title: ev.text, detail: '' });
  if (ev.kind === 'subagent-dispatch') {
    const role = String(ev.name).split('-')[0].toUpperCase();
    return emit({ icon: ROLE_EMOJI[role] || '•', kind: 'subagent-dispatch', title: `${ev.name} dispatched`, detail: ev.task || '' });
  }
  if (ev.kind === 'subagent-return') {
    const role = String(ev.name).split('-')[0].toUpperCase();
    return emit({ icon: ROLE_EMOJI[role] || '•', kind: 'subagent-return', title: `${ev.name} returned`, detail: ev.summary || '' });
  }
  if (ev.kind === 'tool-use') return emit({ icon: '🛠️', kind: 'tool-use', title: ev.tool, detail: ev.summary || '' });
  if (ev.kind === 'turn-done') return emit({ icon: '✅', kind: 'turn-done', title: 'The Archduke rests', detail: ev.cost != null ? `cost $${ev.cost}` : '' });
  if (ev.kind === 'error') return emit({ icon: '⚠️', kind: 'archduke-error', title: 'The Archduke faltered', detail: ev.message || '' });
}
```
In the request router, add these branches (alongside the existing `/api/state` and POST handling):
```js
  if (urlPath === '/api/archduke/status' && req.method === 'GET') {
    return sendJSON(res, 200, { busy: regent.busy, sessionId: regent.sessionId });
  }
  if (urlPath === '/api/archduke/say' && req.method === 'POST') {
    const body = await readBody(req);
    const text = (body && body.text ? String(body.text) : '').trim();
    if (!text) return sendJSON(res, 400, { ok: false, error: 'empty message' });
    if (regent.busy) return sendJSON(res, 409, { ok: false, busy: true });
    emit({ icon: '🗣️', kind: 'archduke-say', title: 'You address the Archduke', detail: text });
    regent.say(text, archdukeEmit); // fire-and-forget; events stream over SSE
    return sendJSON(res, 200, { ok: true, started: true });
  }
  if (urlPath === '/api/archduke/stop' && req.method === 'POST') {
    const stopped = regent.stop();
    if (stopped) emit({ icon: '✋', kind: 'turn-done', title: 'The Archduke was halted', detail: '' });
    return sendJSON(res, 200, { ok: true, stopped });
  }
  if (urlPath === '/api/archduke/reset' && req.method === 'POST') {
    try { require('fs').unlinkSync(path.join(ROOT, 'regent.json')); } catch {}
    regent.sessionId = null;
    return sendJSON(res, 200, { ok: true });
  }
```
(Place these before the static-file fallback so they take precedence.)

- [ ] **Step 4: Run to verify it passes**

Run: `node KINGDOM/test/test_server_archduke.js`
Expected: PASS — status responds, say starts, SSE carries `archduke-text` + `subagent-dispatch`.

- [ ] **Step 5: Commit**

```bash
git add KINGDOM/kingdom-server.js KINGDOM/test/test_server_archduke.js
git commit -m "feat(server): /api/archduke say/stop/status/reset streaming a real headless Claude turn"
```

---

## Task 4: Web chat lane + live subagent status

**Files:** Modify `KINGDOM/web/app.html`

This task has no automated unit test (browser UI); verify by structure + serving. Keep edits additive — do not break existing tabs/feed.

- [ ] **Step 1: Add the chat lane to the Throne Room tab**

In `web/app.html`, inside the Throne Room tab panel, add a chat section ABOVE or beside the existing Royal Actions:
```html
<section class="archduke-chat">
  <h3>🗣️ Address the Archduke</h3>
  <div id="archduke-transcript" class="transcript" aria-live="polite"></div>
  <div class="chat-input">
    <textarea id="archduke-input" rows="2" placeholder="Give the Archduke a quest… (e.g. 'Investigate the failing test and dispatch a detective')"></textarea>
    <button id="archduke-send">Send ⚜</button>
    <button id="archduke-stop" disabled>Stop ✋</button>
    <button id="archduke-new" title="Start a fresh session">🆕</button>
    <span id="archduke-busy" class="busy" hidden>the Archduke deliberates…</span>
  </div>
</section>
```
Style it with the existing palette (parchment card, gold borders, Cinzel heading, IM Fell body). Transcript bubbles: distinguish your messages from Archduke replies.

- [ ] **Step 2: Wire the chat JS**

In the page script, add handlers. Reuse the existing `EventSource('/api/events')` listener — extend it to route the new kinds:
```js
// inside the existing 'kingdom' event handler, after dedupe:
if (ev.kind === 'archduke-say') addBubble('you', ev.title);
else if (ev.kind === 'archduke-text') appendArchduke(ev.title);
else if (ev.kind === 'turn-done' || ev.kind === 'archduke-error') endArchdukeTurn(ev);
// subagent-dispatch / subagent-return / tool-use already render in the live feed
```
Helpers (add to the script):
```js
const transcript = () => document.getElementById('archduke-transcript');
let curBubble = null;
function addBubble(who, text) {
  const d = document.createElement('div');
  d.className = 'bubble ' + who;
  d.textContent = text;
  transcript().appendChild(d); transcript().scrollTop = transcript().scrollHeight;
  return d;
}
function appendArchduke(text) {
  if (!curBubble) curBubble = addBubble('archduke', '');
  curBubble.textContent += (curBubble.textContent ? ' ' : '') + text;
  transcript().scrollTop = transcript().scrollHeight;
}
function endArchdukeTurn(ev) {
  curBubble = null; setBusy(false);
  if (ev.kind === 'archduke-error') addBubble('error', ev.detail || 'The Archduke faltered.');
}
function setBusy(b) {
  document.getElementById('archduke-busy').hidden = !b;
  document.getElementById('archduke-send').disabled = b;
  document.getElementById('archduke-stop').disabled = !b;
}
async function sendToArchduke() {
  const ta = document.getElementById('archduke-input');
  const text = ta.value.trim(); if (!text) return;
  ta.value = ''; setBusy(true);
  const r = await fetch('/api/archduke/say', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
  if (r.status === 409) { setBusy(true); addBubble('error', 'The Archduke is mid-deliberation — wait or Stop.'); }
  else if (!r.ok) { setBusy(false); addBubble('error', 'Could not reach the Archduke.'); }
}
document.getElementById('archduke-send').onclick = sendToArchduke;
document.getElementById('archduke-stop').onclick = () => fetch('/api/archduke/stop', { method:'POST' });
document.getElementById('archduke-new').onclick = async () => { await fetch('/api/archduke/reset', { method:'POST' }); addBubble('system', 'A fresh session begins.'); };
document.getElementById('archduke-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendToArchduke(); });
// on load, reflect busy state
fetch('/api/archduke/status').then(r => r.json()).then(s => setBusy(!!s.busy)).catch(()=>{});
```

- [ ] **Step 3: Verify structure + serve**

Run:
```bash
node -e "const h=require('fs').readFileSync('KINGDOM/web/app.html','utf8'); const s=[...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim()&&!/src=/.test(x)).join('\n;\n'); new (require('vm').Script)(s); console.log('app.html JS parses OK');"
grep -c "archduke-transcript\|/api/archduke/say" KINGDOM/web/app.html
```
Expected: "app.html JS parses OK"; grep ≥ 2.

- [ ] **Step 4: Commit**

```bash
git add KINGDOM/web/app.html
git commit -m "feat(web): chat lane + live subagent status for the Archduke"
```

---

## Task 5: Document + manual smoke

**Files:** Modify `KINGDOM/README.md`

- [ ] **Step 1: Add a "Talk to the Archduke" section**

After the "Install into a project" section, add:
```markdown
## Talk to the Archduke (live web)

Inside an init'd project:
```bash
node .kingdom/kingdom-server.js     # http://localhost:8080
```
Open the **Throne Room** tab and address the Archduke in plain language. The server runs a real
headless Claude Code in your project (reusing your existing login — no API key), streams its reply
into the chat lane, and lights up the **live feed** as it dispatches court subagents
(`🔍 detective-greymantle dispatched → returned`). One turn at a time; **Stop** halts it; **🆕**
starts a fresh session. Requires the `claude` CLI on your PATH.
```

- [ ] **Step 2: Run the full suite**

Run: `node KINGDOM/test/test_regent.js && node KINGDOM/test/test_server_archduke.js && node KINGDOM/test/test_agent_gen.js && node KINGDOM/test/test_init.js`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add KINGDOM/README.md
git commit -m "docs: document the live web Archduke"
```

---

## Self-Review (planner)
- **Spec coverage:** Regent parser+process (§4.1) → Tasks 1-2; endpoints (§4.2) → Task 3; web chat/feed (§4.3) → Task 4; safety/auth posture (§5) baked into Regent args + endpoints; testability via fake claude (§6) → Tasks 2-3; docs/manual smoke (§6) → Task 5. All covered.
- **Placeholder scan:** complete code in every code step; the one UI task is verified by JS-parse + grep + a documented manual smoke (browser UI can't be unit-tested headlessly).
- **Consistency:** `normalizeStreamObj`/`initialState`/`Regent`/event kinds (`archduke-text`, `subagent-dispatch`, `subagent-return`, `tool-use`, `turn-done`, `error`) are used identically across regent.js, the server's `archdukeEmit`, and app.html. Env overrides `KINGDOM_CLAUDE_CMD`/`KINGDOM_CLAUDE_BASEARGS` match between Task 3 server code and both tests.
- **Risk:** real-`claude` end-to-end isn't auto-tested (cost/auth) — covered by the fake-claude pipeline tests + a documented manual smoke; the parser tolerates schema drift by matching meaningful fields.
