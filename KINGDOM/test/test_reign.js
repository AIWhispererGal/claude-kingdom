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
