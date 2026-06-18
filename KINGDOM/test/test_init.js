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
done();
