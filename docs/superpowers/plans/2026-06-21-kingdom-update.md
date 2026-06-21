# `kingdom update` — Self-Update from GitHub (Stage 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** A one-command in-project updater: `node .kingdom/kingdom.js update` fetches the latest Kingdom from GitHub and reinstalls it over the project (`--reinstall` semantics — new code, preserved memory).

**Design:** `cmdUpdate` resolves the project, obtains a fresh source (default: `git clone --depth 1 --branch <ref> <repo>` to a temp dir; or `--from <localdir>` to skip the clone; `--repo`/`--ref` override, defaulting to `PROJECT.json.repo_url/.repo_ref` then the canonical repo), then **shells out to the freshly-obtained `kingdom.js`** with `init <projectRoot> --reinstall` — so the newest install logic does the upgrade. Cleans up the temp clone. No refactor of `cmdInit`.

**Tech:** Node built-ins (`child_process.spawnSync`, `os`, `fs`, `path`). Default repo: `https://github.com/AIWhispererGal/claude-kingdom.git`, ref `main`.

---

## Task 1: `cmdUpdate` + route + PROJECT.json repo fields + test + docs

**Files:** Modify `KINGDOM/kingdom.js`; Create `KINGDOM/test/test_update.js`; Modify `KINGDOM/README.md`, `README.md`

- [ ] **Step 1: Failing test** — `KINGDOM/test/test_update.js`:
```js
'use strict';
const { assert, done } = require('./_assert.js');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { execFileSync } = require('child_process');
const KJS = path.join(__dirname, '..', 'kingdom.js');
const SRC_KINGDOM = path.join(__dirname, '..'); // the source KINGDOM dir (has kingdom.js)
function run(args, cwd) { return execFileSync('node', [KJS, ...args], { cwd: cwd || process.cwd(), encoding: 'utf8' }); }

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'kupd-'));
run(['init', proj]);
const dotK = path.join(proj, '.kingdom');
// PROJECT.json gained repo fields at init
const pj = JSON.parse(fs.readFileSync(path.join(dotK, 'PROJECT.json'), 'utf8'));
assert(/github\.com\/AIWhispererGal\/claude-kingdom/.test(pj.repo_url), 'init records repo_url');
assert(pj.repo_ref === 'main', 'init records repo_ref');
// evolve memory, then update from the local source (no network)
const sess = path.join(dotK, 'history', 'sessions.json');
const s = JSON.parse(fs.readFileSync(sess, 'utf8')); s.__sentinel = 'KEEP_ME'; fs.writeFileSync(sess, JSON.stringify(s, null, 2));
run(['update', '--from', SRC_KINGDOM], proj);
assert(JSON.parse(fs.readFileSync(sess, 'utf8')).__sentinel === 'KEEP_ME', 'update preserves the Chronicle (memory)');
assert(fs.existsSync(path.join(dotK, 'kingdom.js')), 'update kept the engine in place');
assert(fs.readdirSync(path.join(proj, '.claude', 'agents')).filter((f) => f.endsWith('.md')).length >= 13, 'update refreshed the court');
fs.rmSync(proj, { recursive: true, force: true });
done();
```

- [ ] **Step 2: Run — fails** (`update` unknown; `repo_url` absent).

- [ ] **Step 3: Implement in `kingdom.js`.** Add requires at top (if missing): `const os = require('os');` and `const { spawnSync } = require('child_process');`. Add constants near the top:
```js
const KINGDOM_REPO = 'https://github.com/AIWhispererGal/claude-kingdom.git';
const KINGDOM_REF = 'main';
```
In `cmdInit`'s `PROJECT.json` object, add two fields: `repo_url: KINGDOM_REPO,` and `repo_ref: KINGDOM_REF,`.
Add the command:
```js
function cmdUpdate(argv) {
  const { flags } = parseArgs(argv);
  const loc = resolveProjectKingdom();
  if (!loc) { console.error("⚠ Run `update` inside an installed project (a .kingdom/ must exist)."); process.exitCode = 1; return; }
  const proj = readJSON(path.join(loc.dotK, 'PROJECT.json'));
  const repo = flags.repo || (!proj.__missing && proj.repo_url) || KINGDOM_REPO;
  const ref = flags.ref || (!proj.__missing && proj.repo_ref) || KINGDOM_REF;

  let srcRoot, tmp = null;
  if (flags.from) {
    const f = path.resolve(String(flags.from));
    srcRoot = fs.existsSync(path.join(f, 'kingdom.js')) ? f : path.join(f, 'KINGDOM');
    if (!fs.existsSync(path.join(srcRoot, 'kingdom.js'))) { console.error(`⚠ --from ${f} has no kingdom.js`); process.exitCode = 1; return; }
    console.log(`🔁 Updating from local source: ${srcRoot}`);
  } else {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-update-'));
    console.log(`⏳ Fetching the latest Kingdom from ${repo} (${ref})…`);
    const clone = spawnSync('git', ['clone', '--depth', '1', '--branch', ref, repo, tmp], { encoding: 'utf8' });
    if (clone.status !== 0) {
      console.error('⚠ Could not fetch from GitHub. Is `git` installed and the repo/ref reachable?');
      console.error(`  Manual fallback:  npx -y github:AIWhispererGal/claude-kingdom@${ref} init . --reinstall`);
      if (clone.stderr) console.error('  ' + String(clone.stderr).trim().split('\n').slice(-1)[0]);
      fs.rmSync(tmp, { recursive: true, force: true }); process.exitCode = 1; return;
    }
    srcRoot = path.join(tmp, 'KINGDOM');
    if (!fs.existsSync(path.join(srcRoot, 'kingdom.js'))) { console.error('⚠ Cloned repo has an unexpected layout (no KINGDOM/kingdom.js).'); fs.rmSync(tmp, { recursive: true, force: true }); process.exitCode = 1; return; }
  }

  console.log('🔁 Reinstalling the latest code over your project (memory preserved)…');
  const res = spawnSync('node', [path.join(srcRoot, 'kingdom.js'), 'init', loc.projectRoot, '--reinstall'], { stdio: 'inherit' });
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  if (res.status !== 0) { console.error('⚠ Update failed during reinstall.'); process.exitCode = 1; return; }
  console.log('✅ The Kingdom is updated. Your Chronicle, honors, families, registry, and reign are intact.');
}
```
Route it: in `main()`'s switch add `case 'update': cmdUpdate(rest); break;`. In `cmdHelp()` rows (before the `['help', …]` row) add `['update [--ref B] [--from DIR]', 'Fetch the latest Kingdom from GitHub and reinstall (memory kept)'],`.

- [ ] **Step 4: Run — passes.** `node KINGDOM/test/test_update.js` → PASS. Also `node KINGDOM/test/test_init.js` and `node KINGDOM/test/test_reign.js` → PASS (PROJECT.json gained two fields; existing assertions check other fields, still valid).

- [ ] **Step 5: Docs.** In root `README.md` "## 🔄 Updating & reinstalling", add at the top a "**Easiest: one command from inside your project**" block:
```bash
node .kingdom/kingdom.js update      # fetches the latest from GitHub and reinstalls (keeps all your memory)
```
Explain it needs `git` on PATH (else use the npx fallback already documented), and mention `--ref <branch>` and `--from <dir>` briefly. Add the same one-liner to `KINGDOM/README.md`'s install/update note.

- [ ] **Step 6: Commit.**
```bash
git add KINGDOM/kingdom.js KINGDOM/test/test_update.js README.md KINGDOM/README.md
git commit -m "feat(kingdom): self-update command (update fetches latest from GitHub + reinstall)"
```

## Self-Review (planner)
- Reuses `--reinstall` via the fresh clone's own `kingdom.js` — no `cmdInit` refactor, always-newest install logic.
- `--from` gives a network-free test path and a real local-update feature; `--repo`/`--ref` + `PROJECT.json.repo_url/ref` make forks first-class.
- Memory preservation is inherited from `init --reinstall` (already tested); the new test confirms it end-to-end through `update`.
