'use strict';
const { assert, done } = require('./_assert.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const K = require('../kingdom.js'); // must export helpers without running the CLI

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

const { execFileSync } = require('child_process');
const KJS = path.join(__dirname, '..', 'kingdom.js');
function run(args, cwd) {
  // When cwd is a .kingdom dir, run that kingdom's own CLI so commands mutate its local data.
  const eff = cwd || process.cwd();
  const kjs = (path.basename(eff) === '.kingdom' && fs.existsSync(path.join(eff, 'kingdom.js')))
    ? path.join(eff, 'kingdom.js')
    : KJS;
  return execFileSync('node', [kjs, ...args], { cwd: eff, encoding: 'utf8' });
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

done();
