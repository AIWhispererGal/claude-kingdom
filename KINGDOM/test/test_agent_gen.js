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
