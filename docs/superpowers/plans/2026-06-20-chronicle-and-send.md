# Chronicle Auto-Record + Send-to-Archduke (Stage 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Close two seams the user found: (A) the **Summon** tab can pipe its generated brief straight into the **live Throne Room** chat; (B) the **Chronicle** fills itself — when a Throne Room reign finishes, the **Archivist auto-files** a session into `history/sessions.json`.

**Design (settled with the user):**
- **A — Send-to-Archduke:** front-end only (`web/app.html`). After Summon generates a brief, a button switches to the Throne Room tab and POSTs the brief to `/api/archduke/say`.
- **B — Auto-record:** server-side (`kingdom-server.js`). Track the current turn's quest + dispatched subagents; on the regent's `turn-done`, append a Chronicle entry attributed to the Archduke (noble) and **filed by the Archivist** (feed event `📚 … files the testament`). **Guard:** only persist when the server is a real installed project (`path.basename(ROOT) === '.kingdom'`) — never the dev source, so the central repo and tests stay clean.
- Chronicle entry shape (must match existing): `{ session, noble, rank, quest, court:[str], outcome, medals:[], vow_violations:[], notes }`. Next `session` = max existing numeric session + 1.

**Tech:** Node built-ins; reuse `G.readJSON/writeJSON/toRoman/PATHS` (generator exports) already required as `G` in the server.

---

## Task 1: Server auto-record (the Archivist fills the Chronicle)

**Files:** Modify `KINGDOM/kingdom-server.js`; Create `KINGDOM/test/test_autorecord.js`

Context: `kingdom-server.js` has `const ROOT = G.KINGDOM_ROOT;`, `emit(ev)`, `archdukeEmit(ev)` (maps regent events to the feed — has branches for `archduke-text`, `subagent-dispatch`, `subagent-return`, `tool-use`, `turn-done`, `error`), and the `POST /api/archduke/say` handler that calls `regent.say(text, archdukeEmit)`. The fake claude (`KINGDOM/test/fake-claude.js`) emits an `Agent` dispatch to `detective-greymantle` then a success `result`.

- [ ] **Step 1: Write the failing test**

Create `KINGDOM/test/test_autorecord.js`:
```js
'use strict';
const { assert, done } = require('./_assert.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');

const KJS = path.join(__dirname, '..', 'kingdom.js');
const FAKE = path.join(__dirname, 'fake-claude.js');
const PORT = 8767;

function post(p, body) {
  return new Promise((res) => {
    const data = JSON.stringify(body);
    const r = http.request(`http://localhost:${PORT}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (resp) => { let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => res({ status: resp.statusCode, body: d })); });
    r.write(data); r.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // init a real project so the server runs as an installed .kingdom
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'chron-'));
  execFileSync('node', [KJS, 'init', proj], { encoding: 'utf8' });
  const sessionsPath = path.join(proj, '.kingdom', 'history', 'sessions.json');
  const before = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')).sessions.length;

  // run the PROJECT's copied server, pointed at the fake claude
  const srv = spawn('node', [path.join(proj, '.kingdom', 'kingdom-server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), KINGDOM_CLAUDE_CMD: 'node', KINGDOM_CLAUDE_BASEARGS: JSON.stringify([FAKE]) }),
  });
  await sleep(800);
  await post('/api/archduke/say', { text: 'Investigate the README and report.' });
  await sleep(900); // let the fake turn finish (it emits a result → turn-done)

  const after = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')).sessions;
  assert(after.length === before + 1, 'a session was auto-recorded after the reign');
  const entry = after[after.length - 1];
  assert(/Investigate the README/.test(entry.quest), 'recorded entry carries the quest');
  assert(/^Archduke ClaudeCode /.test(entry.noble), 'recorded entry names the Archduke');
  assert(entry.court.includes('detective-greymantle'), 'recorded entry lists the dispatched court');
  assert(/Archivist/i.test(entry.notes), 'recorded entry credits the Archivist');
  assert(typeof entry.session === 'number' && entry.session > before, 'session number advances');

  srv.kill('SIGTERM');
  await sleep(150);
  fs.rmSync(proj, { recursive: true, force: true });
  done();
})();
```

- [ ] **Step 2: Run — fails**

Run: `node KINGDOM/test/test_autorecord.js` → FAIL (`a session was auto-recorded…` — nothing records).

- [ ] **Step 3: Implement**

In `KINGDOM/kingdom-server.js`, add at module scope (after `ROOT`/`regent` are defined, near `archdukeEmit`):
```js
let currentTurn = null;
const IS_INSTALLED = path.basename(ROOT) === '.kingdom';

// The Archivist files a Throne Room reign into the Chronicle. Only for a real installed project.
function recordReign(turn, ev) {
  if (!IS_INSTALLED || !turn) return;
  try {
    const sessions = G.readJSON(G.PATHS.sessions);
    if (sessions.__missing || sessions.__error || !Array.isArray(sessions.sessions)) return;
    const nums = sessions.sessions.map((s) => (typeof s.session === 'number' ? s.session : 0));
    const next = Math.max(0, ...nums) + 1;
    const reign = G.readJSON(path.join(ROOT, 'reign.json'));
    const count = reign && typeof reign.archduke_count === 'number' && reign.archduke_count > 0 ? reign.archduke_count : 1;
    const noble = `Archduke ClaudeCode ${G.toRoman(count)}`;
    const court = [...new Set(turn.court || [])];
    const entry = {
      session: next, noble, rank: 'ARCHDUKE',
      quest: String(turn.quest || '').slice(0, 200), court,
      outcome: ev && ev.ok === false ? 'HALTED' : 'COMPLETE',
      medals: [], vow_violations: [],
      notes: 'Auto-filed by the Archivist from a Throne Room reign.',
    };
    sessions.sessions.push(entry);
    G.writeJSON(G.PATHS.sessions, sessions);
    emit({ icon: '📚', kind: 'chronicle', title: `The Archivist files the testament — Session ${next}`, detail: `${noble}${court.length ? ' · court: ' + court.join(', ') : ''}` });
  } catch (_) { /* non-fatal */ }
}
```
In `archdukeEmit(ev)`, add accumulation: in the `subagent-dispatch` branch, before/after the `emit(...)`, add `if (currentTurn) currentTurn.court.push(ev.name);`. In the `turn-done` branch, after its `emit(...)`, add `if (currentTurn) { recordReign(currentTurn, ev); currentTurn = null; }`. (Return the emit result as before; just add these lines so the branches both emit AND accumulate/record.)
In the `POST /api/archduke/say` handler, immediately BEFORE `regent.say(text, archdukeEmit);`, add: `currentTurn = { quest: text, court: [] };`

- [ ] **Step 4: Run — passes**

Run: `node KINGDOM/test/test_autorecord.js` → PASS.
Also run `node KINGDOM/test/test_server_archduke.js` → still PASS (it runs the SOURCE server, where `IS_INSTALLED` is false, so it does NOT auto-record and does not pollute the source `sessions.json`). Confirm `git diff --quiet KINGDOM/history/sessions.json` (source Chronicle unchanged).

- [ ] **Step 5: Commit**
```bash
git add KINGDOM/kingdom-server.js KINGDOM/test/test_autorecord.js
git commit -m "feat(server): Archivist auto-records a Throne Room reign into the Chronicle"
```

---

## Task 2: Send-to-Archduke button + docs + full suite

**Files:** Modify `KINGDOM/web/app.html`; Modify `KINGDOM/README.md`

- [ ] **Step 1: Add the Send-to-Archduke button**

READ `KINGDOM/web/app.html` first. The Summon tab generates a brief into a modal (the generated summons text is shown with Copy + Download buttons; the variable/element holding the text and the modal markup already exist). The Throne Room tab has a chat lane wired to `/api/archduke/say` (with a `sendToArchduke()` flow and helpers from Stage 2). Tab switching is client-side.

Add a button **"⚜ Send to the Archduke"** to the Summon result modal, next to Copy/Download. Its handler must:
```js
// pseudocode — adapt to app.html's actual element ids / tab-switch function
async function sendSummonsToArchduke(summonsText) {
  // 1. close the modal
  // 2. switch to the Throne Room tab (use the page's existing tab-activation function)
  // 3. drop the brief into the chat input and send it
  const input = document.getElementById('archduke-input');
  if (input) input.value = summonsText;
  sendToArchduke();           // reuse the Stage 2 chat-send function (reads #archduke-input, POSTs /api/archduke/say, sets busy)
}
```
Wire the new button's `onclick` to call this with the same generated summons text the Copy button uses. Keep Copy/Download working. Match the existing button styling.

- [ ] **Step 2: Verify the web**

```bash
node -e "const h=require('fs').readFileSync('KINGDOM/web/app.html','utf8'); const s=[...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim()&&!/src=/.test(x)).join('\n;\n'); new (require('vm').Script)(s); console.log('app.html JS parses OK');"
grep -c "Send to the Archduke\|sendSummonsToArchduke" KINGDOM/web/app.html
```
Expected: "app.html JS parses OK"; grep ≥ 1.

- [ ] **Step 3: README note**

In `KINGDOM/README.md`, in the "## The Reign & The Vow" or "Talk to the Archduke" area, add one line:
```markdown
The **Summon** tab can hand its brief straight to the live Archduke (⚜ *Send to the Archduke*), and when a
Throne Room reign ends the **Archivist auto-files it into the Chronicle** — no manual `record` needed.
```

- [ ] **Step 4: Full suite**
```bash
node KINGDOM/test/test_agent_gen.js && node KINGDOM/test/test_init.js && node KINGDOM/test/test_reign.js && \
node KINGDOM/test/test_regent.js && node KINGDOM/test/test_server_archduke.js && node KINGDOM/test/test_autorecord.js && echo "ALL SUITES GREEN"
```
Expected: "ALL SUITES GREEN". Delete any stray `KINGDOM/regent.json`; if `KINGDOM/history/sessions.json` or `KINGDOM/agents/REGISTRY.json` changed, `git checkout --` them (source must stay pristine).

- [ ] **Step 5: Commit**
```bash
git add KINGDOM/web/app.html KINGDOM/README.md
git commit -m "feat(web): Send-to-Archduke from Summon; document Chronicle auto-record"
```

---

## Self-Review (planner)
- **Coverage:** auto-record (B) → Task 1 (with the installed-only guard + Archivist attribution, tested against a real temp project); send-to-Archduke (A) → Task 2.
- **Source safety:** the `IS_INSTALLED` guard means the dev/source server never writes the Chronicle; Task 1 Step 4 explicitly checks the source `sessions.json` is unchanged.
- **Consistency:** entry shape matches the existing `{session,noble,rank,quest,court,outcome,medals,vow_violations,notes}`; `currentTurn`/`recordReign`/`IS_INSTALLED` used consistently; reuses `G.readJSON/writeJSON/toRoman/PATHS` and the existing `sendToArchduke()`/`#archduke-input` from Stage 2.
- **No placeholders** except the deliberately-adaptive front-end wiring in Task 2 (the implementer must match app.html's real ids/tab function — flagged).
