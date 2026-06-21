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
const pj = JSON.parse(fs.readFileSync(path.join(dotK, 'PROJECT.json'), 'utf8'));
assert(/github\.com\/AIWhispererGal\/claude-kingdom/.test(pj.repo_url), 'init records repo_url');
assert(pj.repo_ref === 'main', 'init records repo_ref');
const sess = path.join(dotK, 'history', 'sessions.json');
const s = JSON.parse(fs.readFileSync(sess, 'utf8')); s.__sentinel = 'KEEP_ME'; fs.writeFileSync(sess, JSON.stringify(s, null, 2));
run(['update', '--from', SRC_KINGDOM], proj);
assert(JSON.parse(fs.readFileSync(sess, 'utf8')).__sentinel === 'KEEP_ME', 'update preserves the Chronicle (memory)');
assert(fs.existsSync(path.join(dotK, 'kingdom.js')), 'update kept the engine in place');
assert(fs.readdirSync(path.join(proj, '.claude', 'agents')).filter((f) => f.endsWith('.md')).length >= 13, 'update refreshed the court');
fs.rmSync(proj, { recursive: true, force: true });
done();
