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
