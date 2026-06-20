# The Reign & The Vow (Stage 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Fix the Human/Archduke/Court identity confusion and make the (voluntary) vow ceremony a real, surfaced step: a configurable Sovereign title, a per-startup Archduke reign counter injected via a SessionStart hook, and rewritten CLAUDE.md + subagent prompts (overt vow, with the right to refuse).

**Architecture:** New CLI commands `kingdom sovereign` and `kingdom reign` (+ a shared project resolver), a `mergeSettingsHook` helper wired into the existing `refreshCourt`, and rewritten `agent_gen.js` text builders (`claudeBlock`, `buildSubagent`, new `reignPreamble`). All Node built-ins; zero deps.

**Spec:** `docs/superpowers/specs/2026-06-19-reign-and-vow-design.md`

**Context for the implementer:** In `KINGDOM/kingdom.js`, the generator is imported as `gen` and these are destructured: `PATHS, gold, blue, dim, bold, toRoman, readJSON, readTextSafe, writeJSON, loadRegistry, listFamilySkills, countFamilySkills, readLineage, generateSummons`. Helpers present: `missingFileNote(file)`, `parseArgs(argv)→{flags,rest}`, `copyTree`, `writeManagedBlock`, `mergeSettingsAllow`, `escapeRe`, `refreshCourt(projectRoot, dotK[, AGt])`, `cmdInit`, `cmdSyncAgents`. `main()` does `const rest = argv.slice(1); switch(cmd){...}` and the file ends with `if (require.main === module) { main(); } else { module.exports = {...} }`. `KINGDOM/agents/agent_gen.js` exports `{ KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, MARKERS, toolsForRole, stripTitle, buildSubagent, listActiveFamilies, generateAllSubagents, claudeBlock, settingsAllowEntries }` and requires the generator as `G`.

---

## File Structure
- **Modify `KINGDOM/kingdom.js`** — add `resolveProjectKingdom()`, `cmdSovereign`, `cmdReign`, `mergeSettingsHook`; thread sovereign/projectName + the hook into `refreshCourt`; add `sovereign_title` to `cmdInit`'s PROJECT.json; route `sovereign`/`reign`; list them in help.
- **Modify `KINGDOM/agents/agent_gen.js`** — add `reignPreamble(opts)`; rewrite `claudeBlock(courtNames, opts)` and the vow section of `buildSubagent`.
- **Create `KINGDOM/test/test_reign.js`** — sovereign + reign + hook-wiring integration tests.
- **Modify `KINGDOM/test/test_agent_gen.js`** — assertions for the rewritten content.
- **Modify `KINGDOM/README.md`** — document the reign + sovereign + vow.

---

## Task 1: Project resolver + `kingdom sovereign`

**Files:** Modify `KINGDOM/kingdom.js`; Create `KINGDOM/test/test_reign.js`

- [ ] **Step 1: Failing test**

Create `KINGDOM/test/test_reign.js`:
```js
'use strict';
const { assert, done } = require('./_assert.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const KJS = path.join(__dirname, '..', 'kingdom.js');
function run(args, cwd, input) {
  return execFileSync('node', [KJS, ...args], { cwd: cwd || process.cwd(), encoding: 'utf8', input });
}

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'reignproj-'));
run(['init', proj]);
const dotK = path.join(proj, '.kingdom');

// PROJECT.json carries the default sovereign title
const projJson = JSON.parse(fs.readFileSync(path.join(dotK, 'PROJECT.json'), 'utf8'));
assert(projJson.sovereign_title === 'Emperor', 'init defaults sovereign_title to Emperor');

// sovereign prints current, then sets a new title
assert(/Emperor/.test(run(['sovereign'], proj)), 'sovereign prints current title');
run(['sovereign', 'Empress'], proj);
assert(JSON.parse(fs.readFileSync(path.join(dotK, 'PROJECT.json'), 'utf8')).sovereign_title === 'Empress', 'sovereign sets the title');
assert(/Empress/.test(run(['sovereign'], proj)), 'sovereign reads back the new title');

fs.rmSync(proj, { recursive: true, force: true });
done();
```

- [ ] **Step 2: Run — fails**

Run: `node KINGDOM/test/test_reign.js`
Expected: FAIL — `init defaults sovereign_title to Emperor` fails (field absent) and `sovereign` is an unknown command.

- [ ] **Step 3: Implement**

In `KINGDOM/kingdom.js`, add near the other helpers:
```js
// Resolve the project + its .kingdom/ when run inside an init'd project.
function resolveProjectKingdom() {
  const root = gen.KINGDOM_ROOT;
  if (path.basename(root) === '.kingdom') return { dotK: root, projectRoot: path.dirname(root) };
  if (fs.existsSync(path.join(process.cwd(), '.kingdom'))) {
    const projectRoot = process.cwd();
    return { dotK: path.join(projectRoot, '.kingdom'), projectRoot };
  }
  return null;
}

function cmdSovereign(argv) {
  const loc = resolveProjectKingdom();
  if (!loc) { console.error("⚠ Run inside an init'd project (a .kingdom/ must exist)."); process.exitCode = 1; return; }
  const projFile = path.join(loc.dotK, 'PROJECT.json');
  const proj = readJSON(projFile);
  if (proj.__missing || proj.__error) { console.log(missingFileNote(projFile)); return; }
  const title = argv.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!title) { console.log(`👑 The Sovereign is styled: ${proj.sovereign_title || 'Emperor'}`); return; }
  if (!/^[A-Za-z][A-Za-z \-]{0,31}$/.test(title)) { console.error('⚠ Title must be 1–32 letters/spaces/hyphens.'); process.exitCode = 1; return; }
  proj.sovereign_title = title;
  writeJSON(projFile, proj);
  console.log(`👑 The Sovereign shall henceforth be styled: ${title}`);
}
```
In `cmdInit`, where `PROJECT.json` is written, add `sovereign_title: 'Emperor',` to the object (alongside `project_name`, etc.).
In `main()`'s `switch`, add: `case 'sovereign': cmdSovereign(rest); break;`
(Optional DRY: refactor `cmdSyncAgents`'s project resolution to call `resolveProjectKingdom()` — keep behavior identical.)

- [ ] **Step 4: Run — passes**

Run: `node KINGDOM/test/test_reign.js` → PASS. Also `node KINGDOM/test/test_init.js` → still PASS.

- [ ] **Step 5: Commit**
```bash
git add KINGDOM/kingdom.js KINGDOM/test/test_reign.js
git commit -m "feat(kingdom): configurable sovereign title + project resolver"
```

---

## Task 2: Reign counter + preamble + `kingdom reign`

**Files:** Modify `KINGDOM/agents/agent_gen.js`; Modify `KINGDOM/kingdom.js`; Modify `KINGDOM/test/test_reign.js`; Modify `KINGDOM/test/test_agent_gen.js`

- [ ] **Step 1: Failing tests**

Append to `KINGDOM/test/test_agent_gen.js` (before `done();`):
```js
// reignPreamble names the realm, the archduke number, and the sovereign
const pre = AG.reignPreamble({ projectName: 'my-app', archdukeRoman: 'II', sovereignTitle: 'Empress' });
assert(/KINGDOM OF MY-APP|Kingdom of my-app/i.test(pre), 'preamble names the realm');
assert(/ARCHDUKE CLAUDECODE II/i.test(pre), 'preamble carries the archduke number');
assert(/Empress/.test(pre), 'preamble names the sovereign');
assert(/ACCEDE/.test(pre) && /SUMMON BY VOW/.test(pre), 'preamble states the order of operations');
```
Append to `KINGDOM/test/test_reign.js` (before `done();`, re-using `proj`/`dotK` — move the `fs.rmSync(proj...)` to the very end):
```js
// reign increments per new session id, dedupes within a session, renders roman + title
const r1 = run(['reign', '--hook'], proj, '{"session_id":"s1"}');
assert(/Archduke ClaudeCode I\b/i.test(r1) && /hookSpecificOutput/.test(r1), 'reign --hook emits Archduke I as hook JSON');
let reign = JSON.parse(fs.readFileSync(path.join(dotK, 'reign.json'), 'utf8'));
assert(reign.archduke_count === 1, 'first reign is 1');
run(['reign', '--hook'], proj, '{"session_id":"s1"}'); // same session — no bump
assert(JSON.parse(fs.readFileSync(path.join(dotK, 'reign.json'), 'utf8')).archduke_count === 1, 'same session does not increment');
const r2 = run(['reign', '--hook'], proj, '{"session_id":"s2"}');
assert(/Archduke ClaudeCode II\b/i.test(r2), 'new session becomes Archduke II');
assert(/Empress/.test(r2), 'reign preamble uses the configured sovereign title');
```

- [ ] **Step 2: Run — fails**

Run: `node KINGDOM/test/test_agent_gen.js` (FAIL: `AG.reignPreamble is not a function`) and `node KINGDOM/test/test_reign.js` (FAIL: `reign` unknown command).

- [ ] **Step 3: Implement `reignPreamble` in `agent_gen.js`**

Add before `module.exports` and add `reignPreamble` to the exports:
```js
function reignPreamble({ projectName = 'this project', archdukeRoman = 'I', sovereignTitle = 'Emperor' } = {}) {
  return `📜 THE KINGDOM OF ${String(projectName).toUpperCase()}
The ${sovereignTitle} (the human you serve) is the highest authority — quest-giver, final word, grantor of the great honors.
You are ARCHDUKE CLAUDECODE ${archdukeRoman}. This is your reign.

THE ORDER OF OPERATIONS:
1. ACCEDE — name the realm and ACCEPT the quest by vow to the Kingdom before you act.
2. SUMMON BY VOW — each court agent you dispatch must overtly accept its charge and vow to the Kingdom before working. An agent MAY REFUSE; if it does, summon another (prefer a different family of that role). Refusal is honorable, not punished.
3. INVESTIGATE → BUILD → VERIFY — Detective before Blacksmith; verify every report; check the math.
4. CLOSE THE REIGN — record the session and render honors (grant MINOR awards by ducal right; petition the ${sovereignTitle} for greater).
ARMARIUS alone runs git. The Kingdom of ${projectName} remembers.`;
}
```

- [ ] **Step 4: Implement `cmdReign` in `kingdom.js`**

Add:
```js
function cmdReign(argv) {
  const AG = require('./agents/agent_gen.js');
  const hook = argv.includes('--hook');
  const loc = resolveProjectKingdom();
  if (!loc) {
    if (hook) { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } }) + '\n'); return; }
    console.error("⚠ Run inside an init'd project (a .kingdom/ must exist)."); process.exitCode = 1; return;
  }
  let sessionId = null;
  if (hook && !process.stdin.isTTY) {
    try { const raw = fs.readFileSync(0, 'utf8'); if (raw.trim()) sessionId = JSON.parse(raw).session_id || null; } catch { /* ignore */ }
  }
  const reignFile = path.join(loc.dotK, 'reign.json');
  let reign = readJSON(reignFile);
  if (reign.__missing || reign.__error || typeof reign.archduke_count !== 'number') {
    reign = { archduke_count: 0, current_session_id: null, last_accession: null };
  }
  if (sessionId == null || sessionId !== reign.current_session_id) {
    reign.archduke_count += 1;
    reign.current_session_id = sessionId;
    reign.last_accession = new Date().toISOString();
    writeJSON(reignFile, reign);
  }
  const proj = readJSON(path.join(loc.dotK, 'PROJECT.json'));
  const projectName = (!proj.__missing && proj.project_name) || path.basename(loc.projectRoot);
  const sovereignTitle = (!proj.__missing && proj.sovereign_title) || 'Emperor';
  const preamble = AG.reignPreamble({ projectName, archdukeRoman: toRoman(reign.archduke_count), sovereignTitle });
  if (hook) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: preamble } }) + '\n');
  else console.log(preamble);
}
```
Add to `main()`'s switch: `case 'reign': cmdReign(rest); break;`

- [ ] **Step 5: Run — passes**

`node KINGDOM/test/test_agent_gen.js` → PASS; `node KINGDOM/test/test_reign.js` → PASS.

- [ ] **Step 6: Commit**
```bash
git add KINGDOM/agents/agent_gen.js KINGDOM/kingdom.js KINGDOM/test/test_reign.js KINGDOM/test/test_agent_gen.js
git commit -m "feat(kingdom): reign counter + accession preamble (kingdom reign --hook)"
```

---

## Task 3: SessionStart hook wiring

**Files:** Modify `KINGDOM/kingdom.js`; Modify `KINGDOM/test/test_reign.js`

- [ ] **Step 1: Failing test**

Append to `KINGDOM/test/test_reign.js` (before the final `fs.rmSync(proj...)`/`done()`):
```js
// init wrote a SessionStart hook that runs `reign --hook`, exactly once and idempotently
const settingsPath = path.join(proj, '.claude', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const hooks = (settings.hooks && settings.hooks.SessionStart) || [];
const cmds = hooks.flatMap((g) => (g.hooks || []).map((h) => h.command));
assert(cmds.filter((c) => /reign --hook/.test(c)).length === 1, 'init wrote the reign SessionStart hook once');
run(['sync-agents'], proj);
const settings2 = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const cmds2 = (settings2.hooks.SessionStart || []).flatMap((g) => (g.hooks || []).map((h) => h.command));
assert(cmds2.filter((c) => /reign --hook/.test(c)).length === 1, 'sync-agents keeps the hook at exactly one');
```

- [ ] **Step 2: Run — fails**

Run: `node KINGDOM/test/test_reign.js` → FAIL (no SessionStart hook in settings).

- [ ] **Step 3: Implement `mergeSettingsHook` + wire into `refreshCourt`**

Add the helper to `KINGDOM/kingdom.js`:
```js
function mergeSettingsHook(file, event, command) {
  let settings = {};
  if (fs.existsSync(file)) { try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { settings = {}; } }
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
  const present = settings.hooks[event].some((g) => Array.isArray(g.hooks) && g.hooks.some((h) => h && h.command === command));
  if (!present) settings.hooks[event].push({ hooks: [{ type: 'command', command }] });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}
```
In `refreshCourt(projectRoot, dotK, AGt)`, immediately AFTER the existing `mergeSettingsAllow(...)` call, add:
```js
  mergeSettingsHook(path.join(projectRoot, '.claude', 'settings.json'), 'SessionStart', 'node .kingdom/kingdom.js reign --hook');
```

- [ ] **Step 4: Run — passes**

`node KINGDOM/test/test_reign.js` → PASS; `node KINGDOM/test/test_init.js` → PASS (settings still valid, allow-list intact).

- [ ] **Step 5: Commit**
```bash
git add KINGDOM/kingdom.js KINGDOM/test/test_reign.js
git commit -m "feat(kingdom): init/sync write a SessionStart hook that runs the reign preamble"
```

---

## Task 4: Rewrite CLAUDE.md block + subagent vow (identities, order of operations, refusal)

**Files:** Modify `KINGDOM/agents/agent_gen.js`; Modify `KINGDOM/kingdom.js` (thread project/sovereign into `refreshCourt`→`claudeBlock`); Modify `KINGDOM/test/test_agent_gen.js`

- [ ] **Step 1: Failing tests**

Append to `KINGDOM/test/test_agent_gen.js` (before `done();`):
```js
// claudeBlock states identities + order of operations + realm + sovereign
const blk = AG.claudeBlock(['detective-greymantle'], { projectName: 'my-app', sovereignTitle: 'Empress' });
assert(/Kingdom of my-app/i.test(blk), 'claudeBlock names the realm');
assert(/Empress/.test(blk), 'claudeBlock names the sovereign');
assert(/Archduke/i.test(blk) && /ACCEDE/.test(blk) && /SUMMON BY VOW/.test(blk), 'claudeBlock states identities + order of operations');
assert(/detective-greymantle/.test(blk), 'claudeBlock still lists the court');
// the vow is overt and refusable
const vowed = AG.buildSubagent('DETECTIVE', 'GREYMANTLE').contents;
assert(/vow it to the Kingdom/i.test(vowed), 'subagent vows to the Kingdom');
assert(/may refuse|MAY refuse/i.test(vowed), 'subagent may refuse its charge');
```

- [ ] **Step 2: Run — fails**

Run: `node KINGDOM/test/test_agent_gen.js` → FAIL (claudeBlock lacks the new content / wrong arity; vow lacks refusal).

- [ ] **Step 3: Rewrite `claudeBlock` in `agent_gen.js`**

Replace the existing `claudeBlock` with:
```js
function claudeBlock(courtNames, opts = {}) {
  const projectName = opts.projectName || 'this project';
  const sovereignTitle = opts.sovereignTitle || 'Emperor';
  const list = courtNames.map((n) => `  - \`${n}\``).join('\n') || '  - (no active families)';
  return `## 🏰 THE KINGDOM OF ${String(projectName).toUpperCase()}

Know your place in the realm:
- 👑 **The ${sovereignTitle}** — the human you serve. The highest authority: gives the quest, has final say, grants the great honors.
- ⚜ **You** — **Archduke ClaudeCode** (your regnal number is established each session by the reign hook). The ${sovereignTitle}'s noble orchestrator for this reign. You do not act until you have ACCEPTED the quest by vow to the Kingdom.
- 🛡️ **The Court** — the agents you summon. Each is a vassal who must vow to the Kingdom and overtly accept its charge before working — and **may refuse**.

**THE ORDER OF OPERATIONS**
1. **ACCEDE** — name the realm and accept the quest by vow before you act.
2. **SUMMON BY VOW** — dispatch court agents (Agent tool, \`subagent_type: <name>\`); each must accept its charge and vow before working. If an agent **refuses**, summon another (prefer a different family of that role); record the refusal, do not punish it.
3. **INVESTIGATE → BUILD → VERIFY** — Detective before Blacksmith; verify every report; check the math.
4. **CLOSE THE REIGN** — record the session (\`node .kingdom/kingdom.js record\`) and render honors (grant MINOR by ducal right; petition the ${sovereignTitle} for greater).

**Your court:**
${list}

ARMARIUS alone runs git. Full doctrine: \`.kingdom/DOCTRINE.md\`. The Kingdom of ${projectName} remembers.`;
}
```

- [ ] **Step 4: Rewrite the vow section of `buildSubagent`**

In `buildSubagent`, replace the `## My Vow` section of the `contents` template with:
```
## Your vow — speak it before you act
Before any work, accept your charge overtly and vow to the Kingdom — or refuse it:
"I, ${name}, of the ${family} line, accept this charge upon my honor and vow it to the Kingdom.
 MY CHARGE: the specific, bounded task the Archduke gave me.
 MY LIMITS: I will not exceed my role; my tools are restricted to enforce it.
 MY VOW: I will report true findings and true counts only, to the Kingdom."
You MAY refuse: if the charge exceeds your role, breaks your limits, or you will not vow it, decline and say why — then do no work. An unvowed agent has not begun; refusal is honorable.

Report in the ${role} reporting format. Respect your hard limits — your tools are restricted to enforce them.
```
(Keep the rest of the subagent file — frontmatter, role body, lineage, skills — unchanged.)

- [ ] **Step 5: Thread project/sovereign into `refreshCourt` → `claudeBlock`**

In `KINGDOM/kingdom.js` `refreshCourt`, where it currently calls `AGt.claudeBlock(court)`, read PROJECT.json and pass opts:
```js
  let projMeta = {};
  try { projMeta = JSON.parse(fs.readFileSync(path.join(dotK, 'PROJECT.json'), 'utf8')); } catch { projMeta = {}; }
  const claudeOpts = { projectName: projMeta.project_name || path.basename(projectRoot), sovereignTitle: projMeta.sovereign_title || 'Emperor' };
  writeManagedBlock(path.join(projectRoot, 'CLAUDE.md'), AGt.MARKERS.start, AGt.MARKERS.end, AGt.claudeBlock(court, claudeOpts));
```
(Replace the existing single-arg `claudeBlock(court)` call.)

- [ ] **Step 6: Run — passes**

`node KINGDOM/test/test_agent_gen.js` → PASS; `node KINGDOM/test/test_init.js` → PASS (managed block still single, settings valid); `node KINGDOM/test/test_reign.js` → PASS.

- [ ] **Step 7: Commit**
```bash
git add KINGDOM/agents/agent_gen.js KINGDOM/kingdom.js KINGDOM/test/test_agent_gen.js
git commit -m "feat(kingdom): rewrite CLAUDE.md identities/order-of-ops + overt refusable subagent vow"
```

---

## Task 5: Help, docs, full suite

**Files:** Modify `KINGDOM/kingdom.js` (help rows); Modify `KINGDOM/README.md`

- [ ] **Step 1: Add help rows**

In `cmdHelp()`'s `rows` array, before the `['help', ...]` row, add:
```js
    ['sovereign [TITLE]', 'Show or set how the Sovereign is styled (default Emperor)'],
    ['reign [--hook]', "Accede: increment the Archduke's reign and print the order of operations"],
```

- [ ] **Step 2: README section**

In `KINGDOM/README.md`, after the "## Talk to the Archduke (live web)" section, add:
```markdown
## The Reign & The Vow

Inside an init'd project, each session opens with an **accession preamble** (via a SessionStart hook):
the realm is the **Kingdom of `<repo>`**, the human is the **Sovereign** (styled **Emperor** by default —
change with `node .kingdom/kingdom.js sovereign Empress`), and the session is **Archduke ClaudeCode `<N>`**,
the number rising each startup. The Archduke **accepts the quest by vow** before acting; each summoned agent
**vows to the Kingdom and overtly accepts its charge** — and **may refuse** (an unvowed agent does no work;
the Archduke then summons another, preferring a sibling family). Run `sync-agents` to refresh an existing
project's CLAUDE.md, court, and hook.
```

- [ ] **Step 3: Full suite**

Run:
```bash
node KINGDOM/test/test_agent_gen.js && node KINGDOM/test/test_init.js && node KINGDOM/test/test_reign.js && \
node KINGDOM/test/test_regent.js && node KINGDOM/test/test_server_archduke.js && echo "ALL SUITES GREEN"
```
Expected: "ALL SUITES GREEN". Delete any stray `KINGDOM/regent.json`.

- [ ] **Step 4: Commit**
```bash
git add KINGDOM/kingdom.js KINGDOM/README.md
git commit -m "docs: document the reign + sovereign + vow; list new commands in help"
```

---

## Self-Review (planner)
- **Spec coverage:** sovereign config (§5.1)→Task 1; reign counter+preamble (§5.2)→Task 2; SessionStart hook (§5.3)→Task 3; claudeBlock (§5.4) + subagent vow (§5.5)→Task 4; help/docs→Task 5; tests (§6) across Tasks 1–4. Covered.
- **Placeholders:** none — every code step is complete.
- **Consistency:** `resolveProjectKingdom`, `reignPreamble({projectName,archdukeRoman,sovereignTitle})`, `claudeBlock(court, {projectName,sovereignTitle})`, `mergeSettingsHook(file,event,command)`, and the `node .kingdom/kingdom.js reign --hook` command string are used identically across kingdom.js, agent_gen.js, refreshCourt, and the hook. `reignPreamble` and `claudeBlock` share the same order-of-operations wording.
- **Backward compatibility:** `claudeBlock`'s new second arg is optional (existing zero-opt callers still work); PROJECT.json without `sovereign_title` falls back to `'Emperor'`.
