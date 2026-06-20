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

fs.rmSync(proj, { recursive: true, force: true });
done();
