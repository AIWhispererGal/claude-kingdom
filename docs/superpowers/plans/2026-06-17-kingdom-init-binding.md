# Kingdom Init / Binding (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `kingdom init [project]` and `kingdom sync-agents` so a self-contained Kingdom can be installed into a real project, generating real tool-restricted Claude Code subagents, a managed `CLAUDE.md` block, a safe `settings.json`, and a `PROJECT.json` binding.

**Architecture:** A new pure, unit-testable module `KINGDOM/agents/agent_gen.js` assembles subagent files + managed config text from the registry/role/family files (reusing `summons/generator.js` helpers). `KINGDOM/kingdom.js` gains filesystem helpers and two commands (`cmdInit`, `cmdSyncAgents`) that perform the side effects. Generation for an installed project always reads **that project's** `.kingdom/` data by `require`-ing the copied module, so `--reinstall` and `sync-agents` reflect the project's evolved roster.

**Tech Stack:** Node 18+ built-ins only (`fs`, `path`). No new dependencies. Zero-dep test scripts run via `node`.

**Spec:** `docs/superpowers/specs/2026-06-17-kingdom-init-binding-design.md`

---

## File Structure

- **Create `KINGDOM/agents/agent_gen.js`** — pure generation: `TOOL_MAP`, `toolsForRole`, `stripTitle`, `buildSubagent`, `listActiveFamilies`, `generateAllSubagents`, `claudeBlock`, `settingsAllowEntries`, `KINGDOM_VERSION`.
- **Modify `KINGDOM/kingdom.js`** — add `copyTree`, `writeManagedBlock`, `mergeSettingsAllow`, `escapeRe`, `cmdInit`, `cmdSyncAgents`; wire into the command router + `help`.
- **Create `KINGDOM/test/_assert.js`** — tiny shared assert helper.
- **Create `KINGDOM/test/test_agent_gen.js`** — unit tests for the pure module.
- **Create `KINGDOM/test/test_init.js`** — integration tests for init/sync into temp dirs.
- **Modify `KINGDOM/README.md`** — document `init` / `sync-agents`.

---

## Task 0: Initialize version control (enables commits)

This folder is not yet a git repo; the plan commits after each task. Skip this task if you prefer no git (and then skip every "Commit" step).

**Files:** none (repo-level)

- [ ] **Step 1: Init + first commit**

```bash
cd /mnt/c/Users/mgall/OneDrive/Desktop/CLAUDE_KINGDOM
git init
printf 'node_modules/\n*.log\n' > .gitignore
git add -A
git commit -m "chore: snapshot Living Kingdom before init/binding feature"
```
Expected: a commit is created. If `git` is unavailable, skip this task and all later Commit steps.

---

## Task 1: Pure module skeleton — tool mapping

**Files:**
- Create: `KINGDOM/agents/agent_gen.js`
- Create: `KINGDOM/test/_assert.js`
- Create: `KINGDOM/test/test_agent_gen.js`

- [ ] **Step 1: Write the shared assert helper**

Create `KINGDOM/test/_assert.js`:
```js
'use strict';
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ok  ' + msg); }
  else { console.error('  FAIL ' + msg); failed++; process.exitCode = 1; }
}
function done() {
  if (failed) { console.error(`\n${failed} assertion(s) failed.`); process.exit(1); }
  console.log('\nAll assertions passed.');
}
module.exports = { assert, done };
```

- [ ] **Step 2: Write the failing test for `toolsForRole`**

Create `KINGDOM/test/test_agent_gen.js`:
```js
'use strict';
const { assert, done } = require('./_assert.js');
const AG = require('../agents/agent_gen.js');

// Tool mapping (spec §5.4)
assert(AG.toolsForRole('DETECTIVE') === 'Read, Grep, Glob', 'DETECTIVE is read-only');
assert(AG.toolsForRole('detective') === 'Read, Grep, Glob', 'role match is case-insensitive');
assert(AG.toolsForRole('ARMARIUS').includes('Bash') && !AG.toolsForRole('ARMARIUS').includes('Edit'), 'ARMARIUS has Bash, not Edit');
assert(AG.toolsForRole('BLACKSMITH').includes('Edit') && AG.toolsForRole('BLACKSMITH').includes('Write'), 'BLACKSMITH builds');
assert(AG.toolsForRole('SERF') === 'Read, Grep, Glob', 'SERF is read-only');
assert(AG.toolsForRole('UNKNOWNROLE') === 'Read, Grep, Glob', 'unknown role defaults to read-only');

done();
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node KINGDOM/test/test_agent_gen.js`
Expected: FAIL — `Cannot find module '../agents/agent_gen.js'`.

- [ ] **Step 4: Create `agent_gen.js` with the tool map**

Create `KINGDOM/agents/agent_gen.js`:
```js
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('../summons/generator.js');

const KINGDOM_VERSION = '1.0.0';

// role -> enforced Claude Code subagent tool allowlist (spec §5.4)
const TOOL_MAP = {
  DETECTIVE: 'Read, Grep, Glob',
  KINGSWIT: 'Read, Grep, Glob',
  SERF: 'Read, Grep, Glob',
  PRAEGUSTATOR: 'Read, Grep, Glob, Bash',
  NECROMANCER: 'Read, Grep, Glob, Bash',
  ARMARIUS: 'Read, Grep, Glob, Bash',
  ARCHIVIST: 'Read, Grep, Glob, Write',
  EXCHEQUER: 'Read, Grep, Glob, Bash, Edit',
  ILLUMINATOR: 'Read, Grep, Glob, Write, Edit',
  CHIRURGEON: 'Read, Grep, Glob, Edit, Bash',
  BURNINATOR: 'Read, Grep, Glob, Edit, Bash',
  BLACKSMITH: 'Read, Grep, Glob, Write, Edit, Bash',
};
const DEFAULT_TOOLS = 'Read, Grep, Glob';

function toolsForRole(roleName) {
  return TOOL_MAP[String(roleName).toUpperCase()] || DEFAULT_TOOLS;
}

// strip the leading markdown H1 ("# Title") from a doc body
function stripTitle(md) {
  if (!md) return '';
  return md.replace(/^\s*#\s+.*\n+/, '').trimEnd();
}

module.exports = { KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, toolsForRole, stripTitle };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node KINGDOM/test/test_agent_gen.js`
Expected: PASS — all `ok` lines, "All assertions passed."

- [ ] **Step 6: Commit**

```bash
git add KINGDOM/agents/agent_gen.js KINGDOM/test/_assert.js KINGDOM/test/test_agent_gen.js
git commit -m "feat(agent_gen): tool map + role->tools enforcement"
```

---

## Task 2: `buildSubagent` — assemble one subagent file

**Files:**
- Modify: `KINGDOM/agents/agent_gen.js`
- Modify: `KINGDOM/test/test_agent_gen.js`

- [ ] **Step 1: Add failing tests for `buildSubagent`**

Append to `KINGDOM/test/test_agent_gen.js` (before `done();`):
```js
// buildSubagent assembles a valid subagent file from real registry/role/family data
const det = AG.buildSubagent('DETECTIVE', 'GREYMANTLE');
assert(det && det.filename === 'detective-greymantle.md', 'detective filename');
assert(det.name === 'detective-greymantle', 'detective name');
assert(/^---\nname: detective-greymantle\n/.test(det.contents), 'frontmatter starts with name');
assert(/\ntools: Read, Grep, Glob\n/.test(det.contents), 'detective tools line is read-only');
assert(/\n---\n/.test(det.contents), 'frontmatter is closed');
assert(/Lineage: GREYMANTLE/.test(det.contents), 'includes its lineage section');
assert(/Skills I carry/.test(det.contents), 'includes a skills section');
assert(/My Vow/.test(det.contents), 'includes a vow');

const smith = AG.buildSubagent('BLACKSMITH', 'IRONFORGE');
assert(/\ntools: Read, Grep, Glob, Write, Edit, Bash\n/.test(smith.contents), 'blacksmith tools include build tools');

assert(AG.buildSubagent('NOPE', 'NONE') === null, 'unknown role returns null');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node KINGDOM/test/test_agent_gen.js`
Expected: FAIL — `AG.buildSubagent is not a function`.

- [ ] **Step 3: Implement `buildSubagent`**

In `KINGDOM/agents/agent_gen.js`, add before `module.exports` and extend the exports:
```js
// Build one subagent file. Returns { filename, name, contents } or null if role unknown.
function buildSubagent(roleName, familyName) {
  const role = String(roleName).toUpperCase();
  const family = String(familyName).toUpperCase();
  const registry = G.loadRegistry();
  if (registry.__missing || registry.__error) return null;
  const roleDef = (registry.roles || []).find((r) => r.name.toUpperCase() === role);
  if (!roleDef) return null;
  const famList = (registry.families && registry.families[role.toLowerCase()]) || [];
  const famDef = famList.find((f) => f.name.toUpperCase() === family) || { name: family, philosophy: '' };

  const name = `${role.toLowerCase()}-${family.toLowerCase()}`;
  const emoji = roleDef.emoji || '•';
  const tagline = roleDef.tagline || '';
  const philosophy = famDef.philosophy || '';

  const roleFileName = roleDef.file ? path.basename(roleDef.file) : `${role}.md`;
  const roleBody = stripTitle(G.readTextSafe(path.join(G.PATHS.roles, roleFileName)));
  const lineage = stripTitle(G.readLineage(role.toLowerCase(), family));
  const skills = G.listFamilySkills(role.toLowerCase(), family);
  const skillLines = skills.length
    ? skills.map((s) => `- ${s.name}${s.problem ? ` — ${s.problem}` : ''}`).join('\n')
    : '- (no recorded skills yet)';

  const description = `${tagline} The ${family} line: ${philosophy} Dispatch for ${role}-type work.`
    .replace(/\s+/g, ' ').trim();

  const contents = `---
name: ${name}
description: ${description}
tools: ${toolsForRole(role)}
---

# ${emoji} ${role} of the ${family} line

${roleBody || `You are a ${role}.`}

## Lineage: ${family}
${lineage || philosophy || '(lineage not recorded)'}

## Skills I carry
${skillLines}

## My Vow
I, ${name}, of the ${family} line, accept this task upon my honor.
MY CHARGE: the specific, bounded task my orchestrator assigns.
MY LIMITS: I will not exceed my role; my tools are restricted to enforce it.
MY VOW: I will report true findings, true counts only. ${emoji} SEAL: ⚜
`;

  return { filename: `${name}.md`, name, contents };
}
```
Update the exports line to:
```js
module.exports = { KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, toolsForRole, stripTitle, buildSubagent };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node KINGDOM/test/test_agent_gen.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add KINGDOM/agents/agent_gen.js KINGDOM/test/test_agent_gen.js
git commit -m "feat(agent_gen): buildSubagent assembles role+family+skills+vow"
```

---

## Task 3: Roster + bulk generation + managed config text

**Files:**
- Modify: `KINGDOM/agents/agent_gen.js`
- Modify: `KINGDOM/test/test_agent_gen.js`

- [ ] **Step 1: Add failing tests**

Append to `KINGDOM/test/test_agent_gen.js` (before `done();`):
```js
const os = require('os');
const fs2 = require('fs');
const path2 = require('path');

// listActiveFamilies skips EXTINCT
const reg = G2load();
function G2load() { return require('../summons/generator.js').loadRegistry(); }
const active = AG.listActiveFamilies(reg);
assert(active.length === 13, 'seed roster has 13 active families');
assert(active.some(a => a.role === 'BLACKSMITH' && a.family === 'IRONFORGE'), 'includes blacksmith/ironforge');
const fakeReg = { families: { blacksmith: [{ name: 'X', status: 'ACTIVE' }, { name: 'Y', status: 'EXTINCT' }] } };
assert(AG.listActiveFamilies(fakeReg).length === 1, 'EXTINCT families are excluded');

// generateAllSubagents writes one file per active family into a temp dir
const tmp = fs2.mkdtempSync(path2.join(os.tmpdir(), 'kgagents-'));
const res = AG.generateAllSubagents(tmp, { prune: true });
assert(res.written.length === 13, 'wrote 13 subagent files');
assert(fs2.existsSync(path2.join(tmp, 'detective-greymantle.md')), 'detective file on disk');
// prune removes a stale kingdom-managed agent
fs2.writeFileSync(path2.join(tmp, 'detective-ghost.md'), '---\nname: detective-ghost\n---\n');
const res2 = AG.generateAllSubagents(tmp, { prune: true });
assert(res2.removed.includes('detective-ghost.md'), 'prunes stale managed agent');
assert(!fs2.existsSync(path2.join(tmp, 'detective-ghost.md')), 'stale agent removed from disk');
fs2.rmSync(tmp, { recursive: true, force: true });

// managed config text helpers are pure
const block = AG.claudeBlock(['detective-greymantle', 'serf-plainfield']);
assert(/KINGDOM:START/.test(AG.MARKERS.start) && block.includes('detective-greymantle'), 'claudeBlock lists court');
const entries = AG.settingsAllowEntries(['detective-greymantle']);
assert(entries.includes('Agent(detective-greymantle)') && entries.includes('Read'), 'settings entries include court + base');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node KINGDOM/test/test_agent_gen.js`
Expected: FAIL — `AG.listActiveFamilies is not a function`.

- [ ] **Step 3: Implement the new functions**

In `KINGDOM/agents/agent_gen.js`, add before `module.exports`:
```js
const MARKERS = { start: '<!-- KINGDOM:START -->', end: '<!-- KINGDOM:END -->' };

// [{role, family}] for all non-EXTINCT families in a registry object
function listActiveFamilies(registry) {
  const out = [];
  const fams = (registry && registry.families) || {};
  for (const roleKey of Object.keys(fams)) {
    for (const f of fams[roleKey]) {
      if (String(f.status).toUpperCase() === 'EXTINCT') continue;
      out.push({ role: roleKey.toUpperCase(), family: f.name });
    }
  }
  return out;
}

// Generate all subagent files into agentsDir. Returns { written:[name], removed:[file] }.
function generateAllSubagents(agentsDir, opts = {}) {
  const registry = G.loadRegistry();
  fs.mkdirSync(agentsDir, { recursive: true });
  const wanted = new Set();
  const written = [];
  for (const { role, family } of listActiveFamilies(registry)) {
    const sub = buildSubagent(role, family);
    if (!sub) continue;
    wanted.add(sub.filename);
    fs.writeFileSync(path.join(agentsDir, sub.filename), sub.contents, 'utf8');
    written.push(sub.name);
  }
  const removed = [];
  if (opts.prune) {
    const roleNames = (registry.roles || []).map((r) => r.name.toLowerCase());
    for (const f of fs.readdirSync(agentsDir)) {
      if (!f.endsWith('.md') || wanted.has(f)) continue;
      const base = f.replace(/\.md$/, '');
      if (roleNames.some((rn) => base.startsWith(rn + '-'))) {
        fs.unlinkSync(path.join(agentsDir, f));
        removed.push(f);
      }
    }
  }
  return { written, removed };
}

// The managed CLAUDE.md block body (between MARKERS). courtNames = ['detective-greymantle', ...]
function claudeBlock(courtNames) {
  const list = courtNames.map((n) => `  - \`${n}\``).join('\n');
  return `## 🏰 THE LIVING KINGDOM
You are the orchestrator — a noble of House ClaudeCode — for this project's Kingdom (in \`.kingdom/\`).

**Summon a court:** run \`node .kingdom/kingdom.js summon\` to compose a vow-bearing brief, or compose one directly.

**Your court** — dispatch each as a real subagent via the Agent tool (\`subagent_type: <name>\`):
${list || '  - (no active families)'}

**The laws:** INVESTIGATE before you act · VERIFY every agent report (check their math) · REMEMBER.
- ARMARIUS runs ALL git — you never git directly.
- End of session: record it with \`node .kingdom/kingdom.js record\`, then grant or petition honors.
- Full doctrine: \`.kingdom/DOCTRINE.md\`. History & honors live under \`.kingdom/history/\` and \`.kingdom/honors/\`.
- The web Throne Room: \`node .kingdom/kingdom-server.js\` → http://localhost:8080`;
}

// settings.json permissions.allow entries for an init'd project
function settingsAllowEntries(courtNames) {
  const base = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash(git:*)', 'Bash(npm:*)', 'Bash(node:*)'];
  return base.concat(courtNames.map((n) => `Agent(${n})`));
}
```
Update exports to:
```js
module.exports = {
  KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, MARKERS,
  toolsForRole, stripTitle, buildSubagent,
  listActiveFamilies, generateAllSubagents, claudeBlock, settingsAllowEntries,
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `node KINGDOM/test/test_agent_gen.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add KINGDOM/agents/agent_gen.js KINGDOM/test/test_agent_gen.js
git commit -m "feat(agent_gen): roster, bulk generation+prune, managed CLAUDE.md/settings text"
```

---

## Task 4: Filesystem helpers in `kingdom.js`

**Files:**
- Modify: `KINGDOM/kingdom.js` (add helpers near the other top-level helpers)
- Create: `KINGDOM/test/test_init.js`

- [ ] **Step 1: Write failing tests for the helpers**

Create `KINGDOM/test/test_init.js`:
```js
'use strict';
const { assert, done } = require('./_assert.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const K = require('../kingdom.js'); // must export helpers (Step 3)

// copyTree copies a dir, honoring the exclude predicate
const src = fs.mkdtempSync(path.join(os.tmpdir(), 'ksrc-'));
fs.mkdirSync(path.join(src, 'sub'));
fs.writeFileSync(path.join(src, 'a.txt'), 'A');
fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'B');
fs.writeFileSync(path.join(src, 'skip.me'), 'X');
const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'kdst-'));
K.copyTree(src, dst, (p, entry) => entry.name === 'skip.me');
assert(fs.readFileSync(path.join(dst, 'a.txt'), 'utf8') === 'A', 'copyTree copies files');
assert(fs.readFileSync(path.join(dst, 'sub', 'b.txt'), 'utf8') === 'B', 'copyTree recurses');
assert(!fs.existsSync(path.join(dst, 'skip.me')), 'copyTree honors exclude');

// writeManagedBlock inserts then replaces idempotently
const cm = path.join(dst, 'CLAUDE.md');
fs.writeFileSync(cm, '# My project\n\nKeep me.\n');
K.writeManagedBlock(cm, '<!--S-->', '<!--E-->', 'BLOCK V1');
let txt = fs.readFileSync(cm, 'utf8');
assert(txt.includes('Keep me.') && txt.includes('<!--S-->\nBLOCK V1\n<!--E-->'), 'managed block appended, user content kept');
K.writeManagedBlock(cm, '<!--S-->', '<!--E-->', 'BLOCK V2');
txt = fs.readFileSync(cm, 'utf8');
assert(txt.includes('BLOCK V2') && !txt.includes('BLOCK V1'), 'managed block replaced, not duplicated');
assert((txt.match(/<!--S-->/g) || []).length === 1, 'exactly one managed block');

// mergeSettingsAllow merges + dedupes without clobbering
const sj = path.join(dst, 'settings.json');
fs.writeFileSync(sj, JSON.stringify({ permissions: { allow: ['Read'] }, other: true }));
K.mergeSettingsAllow(sj, ['Read', 'Agent(x)'], 'note');
const s = JSON.parse(fs.readFileSync(sj, 'utf8'));
assert(s.other === true, 'mergeSettingsAllow preserves existing keys');
assert(s.permissions.allow.filter((e) => e === 'Read').length === 1, 'no duplicate entries');
assert(s.permissions.allow.includes('Agent(x)'), 'new entry added');
assert(s.$kingdom === 'note', 'note written');

fs.rmSync(src, { recursive: true, force: true });
fs.rmSync(dst, { recursive: true, force: true });
done();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node KINGDOM/test/test_init.js`
Expected: FAIL — `K.copyTree is not a function`.

- [ ] **Step 3: Implement the helpers and export them**

In `KINGDOM/kingdom.js`, add these helpers near the top-level function definitions:
```js
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function copyTree(src, dst, exclude) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (exclude && exclude(s, entry)) continue;
    if (entry.isDirectory()) copyTree(s, d, exclude);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function writeManagedBlock(file, startMark, endMark, blockBody) {
  const block = `${startMark}\n${blockBody}\n${endMark}`;
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const re = new RegExp(escapeRe(startMark) + '[\\s\\S]*?' + escapeRe(endMark));
  if (re.test(content)) content = content.replace(re, block);
  else content = content ? content.replace(/\s*$/, '\n\n') + block + '\n' : block + '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function mergeSettingsAllow(file, entries, note) {
  let settings = {};
  if (fs.existsSync(file)) {
    try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { settings = {}; }
  }
  if (!settings.permissions) settings.permissions = {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
  const have = new Set(settings.permissions.allow);
  for (const e of entries) if (!have.has(e)) { settings.permissions.allow.push(e); have.add(e); }
  if (note && !settings.$kingdom) settings.$kingdom = note;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}
```
Ensure `kingdom.js` requires `fs` and `path` at the top (it already does for existing commands). At the **bottom** of `kingdom.js`, add a guarded export block so tests can import helpers without triggering the CLI:
```js
if (require.main !== module) {
  module.exports = { copyTree, writeManagedBlock, mergeSettingsAllow, escapeRe };
}
```
> Note: the existing CLI dispatch (the code that reads `process.argv` and runs a command) must run only when invoked directly. If it is not already guarded, wrap that dispatch in `if (require.main === module) { /* existing argv parsing + command switch */ }`.

- [ ] **Step 4: Run to verify it passes**

Run: `node KINGDOM/test/test_init.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add KINGDOM/kingdom.js KINGDOM/test/test_init.js
git commit -m "feat(kingdom): copyTree, writeManagedBlock, mergeSettingsAllow helpers"
```

---

## Task 5: `cmdInit` — install a Kingdom into a project

**Files:**
- Modify: `KINGDOM/kingdom.js`
- Modify: `KINGDOM/test/test_init.js`

- [ ] **Step 1: Add failing integration tests**

Append to `KINGDOM/test/test_init.js` (before `done();`):
```js
const { execFileSync } = require('child_process');
const KJS = path.join(__dirname, '..', 'kingdom.js');
function run(args, cwd) {
  return execFileSync('node', [KJS, ...args], { cwd: cwd || process.cwd(), encoding: 'utf8' });
}

// fresh init into a temp project
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'kproj-'));
run(['init', proj]);
const dotK = path.join(proj, '.kingdom');
assert(fs.existsSync(path.join(dotK, 'agents', 'REGISTRY.json')), 'init copied .kingdom data');
assert(fs.existsSync(path.join(dotK, 'kingdom.js')), 'init copied the CLI');
const agentFiles = fs.readdirSync(path.join(proj, '.claude', 'agents')).filter((f) => f.endsWith('.md'));
assert(agentFiles.length === 13, 'init generated 13 court subagents');
const detTxt = fs.readFileSync(path.join(proj, '.claude', 'agents', 'detective-greymantle.md'), 'utf8');
assert(/\ntools: Read, Grep, Glob\n/.test(detTxt), 'generated detective is read-only');
const claude = fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8');
assert((claude.match(/<!-- KINGDOM:START -->/g) || []).length === 1, 'one managed CLAUDE.md block');
const settings = JSON.parse(fs.readFileSync(path.join(proj, '.claude', 'settings.json'), 'utf8'));
assert(settings.permissions.allow.includes('Agent(detective-greymantle)'), 'settings allow the court');
const projJson = JSON.parse(fs.readFileSync(path.join(dotK, 'PROJECT.json'), 'utf8'));
assert(projJson.project_name === path.basename(proj), 'PROJECT.json records the project');

// re-init without --reinstall errors; with --reinstall preserves memory
let errored = false;
try { run(['init', proj]); } catch (e) { errored = true; }
assert(errored, 're-init without --reinstall is refused');
// place a sentinel in the project's evolved data, then --reinstall
const sess = path.join(dotK, 'history', 'sessions.json');
const sObj = JSON.parse(fs.readFileSync(sess, 'utf8'));
sObj.__sentinel = 'KEEP_ME';
fs.writeFileSync(sess, JSON.stringify(sObj, null, 2));
run(['init', proj, '--reinstall']);
const after = JSON.parse(fs.readFileSync(sess, 'utf8'));
assert(after.__sentinel === 'KEEP_ME', '--reinstall preserves evolved memory');

fs.rmSync(proj, { recursive: true, force: true });
```

- [ ] **Step 2: Run to verify it fails**

Run: `node KINGDOM/test/test_init.js`
Expected: FAIL — init is not a recognized command (or throws), so the first `run(['init', proj])` errors.

- [ ] **Step 3: Implement `cmdInit`**

In `KINGDOM/kingdom.js`, add:
```js
function cmdInit(args) {
  const SRC = G.KINGDOM_ROOT;
  const reinstall = args.includes('--reinstall');
  const pos = args.filter((a) => !a.startsWith('--'));
  const target = path.resolve(pos[0] || process.cwd());

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error('⚠ target is not a directory: ' + target); process.exitCode = 1; return;
  }
  if (target === SRC || SRC.startsWith(target + path.sep) || target.startsWith(SRC + path.sep)) {
    console.error('⚠ refusing to init a Kingdom into itself or a nested path.'); process.exitCode = 1; return;
  }
  const dotK = path.join(target, '.kingdom');
  const exists = fs.existsSync(dotK);
  if (exists && !reinstall) {
    console.error('⚠ Already initialized. Use `sync-agents` to refresh the court, or `init --reinstall` to upgrade code (memory preserved).');
    process.exitCode = 1; return;
  }

  const dataPrefixes = ['history', 'honors', path.join('agents', 'families')];
  const dataFiles = new Set([path.join('agents', 'REGISTRY.json'), 'PROJECT.json']);
  const exclude = (s, entry) => {
    const rel = path.relative(SRC, s);
    if (entry.name === '.git') return true;
    if (rel === path.join('summons', 'output') || rel.startsWith(path.join('summons', 'output') + path.sep)) return true;
    if (reinstall) {
      if (dataFiles.has(rel)) return true;
      for (const d of dataPrefixes) if (rel === d || rel.startsWith(d + path.sep)) return true;
    }
    return false;
  };

  copyTree(SRC, dotK, exclude);
  fs.mkdirSync(path.join(dotK, 'summons', 'output'), { recursive: true });
  if (!fs.existsSync(path.join(dotK, 'summons', 'output', '.gitkeep'))) {
    fs.writeFileSync(path.join(dotK, 'summons', 'output', '.gitkeep'), '');
  }

  // Generate from the PROJECT's copied module so the roster reflects the project (esp. on --reinstall).
  const AGt = require(path.join(dotK, 'agents', 'agent_gen.js'));
  const projFile = path.join(dotK, 'PROJECT.json');
  if (!fs.existsSync(projFile)) {
    fs.writeFileSync(projFile, JSON.stringify({
      project_name: path.basename(target),
      project_path: target,
      initialized_at: new Date().toISOString(),
      kingdom_version: AGt.KINGDOM_VERSION,
      source_kingdom: SRC,
    }, null, 2) + '\n');
  }

  const agentsDir = path.join(target, '.claude', 'agents');
  const gen = AGt.generateAllSubagents(agentsDir, { prune: true });
  const reg = JSON.parse(fs.readFileSync(path.join(dotK, 'agents', 'REGISTRY.json'), 'utf8'));
  const court = AGt.listActiveFamilies(reg).map((a) => `${a.role.toLowerCase()}-${a.family.toLowerCase()}`);

  writeManagedBlock(path.join(target, 'CLAUDE.md'), AGt.MARKERS.start, AGt.MARKERS.end, AGt.claudeBlock(court));
  mergeSettingsAllow(
    path.join(target, '.claude', 'settings.json'),
    AGt.settingsAllowEntries(court),
    'Managed by the Living Kingdom. Broaden permissions here as you trust the realm.'
  );

  console.log(`🏰 Kingdom ${reinstall ? 're-installed' : 'installed'} in ${target}`);
  console.log(`   ${gen.written.length} court subagents in .claude/agents/${gen.removed.length ? ` (${gen.removed.length} pruned)` : ''}`);
  console.log('   CLAUDE.md managed block + .claude/settings.json updated; .kingdom/PROJECT.json bound.');
  console.log('   Next: `node .kingdom/kingdom-server.js` for the web, or open Claude Code here and summon a court.');
}
```
> The `require` of the copied module is intentional: it resolves that project's `summons/generator.js` and reads the project's `.kingdom/` data.

- [ ] **Step 4: Wire `init` into the command dispatch**

In the CLI command switch (inside the `require.main === module` guard), add a case so `node kingdom.js init …` calls `cmdInit(restArgs)`. (Full router wiring + help is finalized in Task 7; add the case now so the tests pass.)

- [ ] **Step 5: Run to verify it passes**

Run: `node KINGDOM/test/test_init.js`
Expected: PASS — fresh init asserts, refusal, and `--reinstall` sentinel all green.

- [ ] **Step 6: Commit**

```bash
git add KINGDOM/kingdom.js KINGDOM/test/test_init.js
git commit -m "feat(kingdom): init installs .kingdom + court subagents + managed config"
```

---

## Task 6: `cmdSyncAgents` — refresh the court after roster changes

**Files:**
- Modify: `KINGDOM/kingdom.js`
- Modify: `KINGDOM/test/test_init.js`

- [ ] **Step 1: Add failing tests**

Append to `KINGDOM/test/test_init.js` (before `done();`):
```js
// sync-agents picks up new-family and extinct
const proj2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kproj2-'));
run(['init', proj2]);
// found a new family in the project's Kingdom, then sync
run(['new-family', 'burninator', 'EMBERWRIGHT'], path.join(proj2, '.kingdom'));
run(['sync-agents'], proj2);
assert(fs.existsSync(path.join(proj2, '.claude', 'agents', 'burninator-emberwright.md')), 'sync adds new family agent');
// declare it extinct, then sync removes the agent
run(['extinct', 'burninator', 'EMBERWRIGHT', '--reason', 'test'], path.join(proj2, '.kingdom'));
run(['sync-agents'], proj2);
assert(!fs.existsSync(path.join(proj2, '.claude', 'agents', 'burninator-emberwright.md')), 'sync removes extinct family agent');
fs.rmSync(proj2, { recursive: true, force: true });
```
> `new-family` / `extinct` are run with `cwd = <proj2>/.kingdom` so they mutate the project's copied registry. `sync-agents` is run with `cwd = <proj2>` (the project root) so it finds `.kingdom/` and regenerates `.claude/agents/` there.

- [ ] **Step 2: Run to verify it fails**

Run: `node KINGDOM/test/test_init.js`
Expected: FAIL — `sync-agents` is not a recognized command.

- [ ] **Step 3: Implement `cmdSyncAgents`**

In `KINGDOM/kingdom.js`, add:
```js
function cmdSyncAgents() {
  // Resolve the project root and its .kingdom. When run as `node .kingdom/kingdom.js`
  // from the project root, G.KINGDOM_ROOT is <project>/.kingdom.
  const root = G.KINGDOM_ROOT;
  let dotK, projectRoot;
  if (path.basename(root) === '.kingdom') {
    dotK = root; projectRoot = path.dirname(root);
  } else if (fs.existsSync(path.join(process.cwd(), '.kingdom'))) {
    projectRoot = process.cwd(); dotK = path.join(projectRoot, '.kingdom');
  } else {
    console.error('⚠ sync-agents must run inside an init\'d project (where a .kingdom/ exists). Try: node .kingdom/kingdom.js sync-agents');
    process.exitCode = 1; return;
  }

  const AGt = require(path.join(dotK, 'agents', 'agent_gen.js'));
  const agentsDir = path.join(projectRoot, '.claude', 'agents');
  const gen = AGt.generateAllSubagents(agentsDir, { prune: true });
  const reg = JSON.parse(fs.readFileSync(path.join(dotK, 'agents', 'REGISTRY.json'), 'utf8'));
  const court = AGt.listActiveFamilies(reg).map((a) => `${a.role.toLowerCase()}-${a.family.toLowerCase()}`);
  writeManagedBlock(path.join(projectRoot, 'CLAUDE.md'), AGt.MARKERS.start, AGt.MARKERS.end, AGt.claudeBlock(court));
  mergeSettingsAllow(
    path.join(projectRoot, '.claude', 'settings.json'),
    AGt.settingsAllowEntries(court),
    'Managed by the Living Kingdom. Broaden permissions here as you trust the realm.'
  );
  console.log(`🔄 Court synced: ${gen.written.length} active${gen.removed.length ? `, ${gen.removed.length} removed` : ''}.`);
}
```

- [ ] **Step 4: Wire `sync-agents` into the dispatch**

Add a command case so `node kingdom.js sync-agents` calls `cmdSyncAgents()`.

- [ ] **Step 5: Run to verify it passes**

Run: `node KINGDOM/test/test_init.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add KINGDOM/kingdom.js KINGDOM/test/test_init.js
git commit -m "feat(kingdom): sync-agents regenerates court + managed config"
```

---

## Task 7: Router + help + version polish

**Files:**
- Modify: `KINGDOM/kingdom.js`

- [ ] **Step 1: Confirm both commands are routed and help lists them**

Ensure the command switch (inside `if (require.main === module)`) has cases for `init` and `sync-agents`, and that the `help`/default output includes:
```
  init [dir] [--reinstall]   Install a self-contained Kingdom into a project
  sync-agents                Regenerate the project's court after roster changes
```
Also surface the version: import `KINGDOM_VERSION` from `./agents/agent_gen.js` and print `House ClaudeCode — Kingdom vX.Y.Z` in the help banner.

- [ ] **Step 2: Manual end-to-end check**

```bash
node KINGDOM/kingdom.js help        # shows init + sync-agents + version
TMP=$(mktemp -d); node KINGDOM/kingdom.js init "$TMP"
ls "$TMP/.claude/agents" | wc -l    # expect 13
node KINGDOM/kingdom.js families    # unaffected, still works
rm -rf "$TMP"
```
Expected: help lists the new commands; init produces 13 agents; existing commands unaffected.

- [ ] **Step 3: Run the full test suite**

Run: `node KINGDOM/test/test_agent_gen.js && node KINGDOM/test/test_init.js`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add KINGDOM/kingdom.js
git commit -m "feat(kingdom): route init/sync-agents, show version in help"
```

---

## Task 8: Document in README

**Files:**
- Modify: `KINGDOM/README.md`

- [ ] **Step 1: Add an "Install into a project" section**

Add under the Throne Room section:
```markdown
## Install into a project

```bash
node /path/to/KINGDOM/kingdom.js init ~/work/my-api
```
This copies a self-contained Kingdom into `~/work/my-api/.kingdom/` and generates real Claude Code
subagents in `~/work/my-api/.claude/agents/` (one per family, with enforced tool limits), a managed block
in `CLAUDE.md`, and a safe `.claude/settings.json`. In that project, your Claude Code session becomes the
orchestrator and dispatches the court via the Agent tool. After founding or retiring families, run
`node .kingdom/kingdom.js sync-agents` from the project root to refresh the court. `init --reinstall`
upgrades the code while preserving the project's accumulated history and honors.
```

- [ ] **Step 2: Commit**

```bash
git add KINGDOM/README.md
git commit -m "docs: document kingdom init / sync-agents"
```

---

## Self-Review (completed by planner)

- **Spec coverage:** init (§4.1) → Task 5; `--reinstall` preserve-memory (§4.1) → Task 5 sentinel test; sync-agents (§4.2) → Task 6; subagent generation + format + tool map (§5) → Tasks 1–3; `.kingdom/` copy, CLAUDE.md managed block, settings posture, PROJECT.json (§6) → Tasks 3, 5; module organization (§7) → Tasks 1–4; testing strategy (§8) → Tasks 1–6 test files. All spec sections map to a task.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output.
- **Type/name consistency:** `MARKERS`, `claudeBlock`, `settingsAllowEntries`, `generateAllSubagents`, `listActiveFamilies`, `toolsForRole`, `buildSubagent` used identically across tasks; `copyTree`/`writeManagedBlock`/`mergeSettingsAllow` signatures match between definition (Task 4) and use (Tasks 5–6).
- **Known constraint:** Tasks assume the CLI dispatch in `kingdom.js` is (or becomes) guarded by `require.main === module` so test imports don't run the CLI — called out explicitly in Task 4 Step 3.
