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

done();
