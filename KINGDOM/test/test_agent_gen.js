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

const os = require('os');
const fs2 = require('fs');
const path2 = require('path');

// listActiveFamilies skips EXTINCT
const reg = require('../summons/generator.js').loadRegistry();
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

done();
