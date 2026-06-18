'use strict';
const { assert, done } = require('./_assert.js');
const R = require('../regent.js');

function feed(objs) {
  let state = R.initialState();
  const events = [];
  for (const o of objs) {
    const r = R.normalizeStreamObj(o, state);
    state = r.state;
    events.push(...r.events);
  }
  return { events, state };
}

// session id captured once
let { events, state } = feed([{ type: 'system', subtype: 'init', session_id: 'sess-1' }]);
assert(events.some(e => e.kind === 'session' && e.sessionId === 'sess-1'), 'session event emitted');
assert(state.sessionId === 'sess-1', 'sessionId stored in state');

// assistant text
({ events } = feed([{ type: 'assistant', message: { content: [{ type: 'text', text: 'Hark!' }] } }]));
assert(events.some(e => e.kind === 'archduke-text' && e.text === 'Hark!'), 'archduke-text emitted');

// Agent dispatch then matching result -> dispatch + return correlated by id
({ events } = feed([
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-1', name: 'Agent', input: { subagent_type: 'detective-greymantle', prompt: 'Find the bug' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: [{ type: 'text', text: 'Root cause at x.js:10' }] }] } },
]));
assert(events.some(e => e.kind === 'subagent-dispatch' && e.name === 'detective-greymantle' && /Find the bug/.test(e.task)), 'subagent-dispatch with name+task');
assert(events.some(e => e.kind === 'subagent-return' && e.name === 'detective-greymantle' && /Root cause/.test(e.summary)), 'subagent-return correlated by id');

// non-Agent tool use
({ events } = feed([{ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: 'a.js' } }] } }]));
assert(events.some(e => e.kind === 'tool-use' && e.tool === 'Edit'), 'generic tool-use emitted');

// final result -> turn-done with cost
({ events } = feed([{ type: 'result', subtype: 'success', total_cost_usd: 0.012, is_error: false }]));
assert(events.some(e => e.kind === 'turn-done' && e.ok === true && e.cost === 0.012), 'turn-done with cost');

// garbage object -> no throw, no events
({ events } = feed([{ random: 'noise' }]));
assert(events.length === 0, 'unknown object yields no events');

const fs = require('fs');
const os = require('os');
const path = require('path');
const FAKE = path.join(__dirname, 'fake-claude.js');

// Regent runs the fake claude end-to-end, emits normalized events, persists session id
(async () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'regent-'));
  const sessionFile = path.join(proj, 'regent.json');
  const reg = new R.Regent({ projectRoot: proj, sessionFile, command: 'node', baseArgs: [FAKE] });
  const got = [];
  const res = await reg.say('hello', (ev) => got.push(ev));
  assert(res.ok === true, 'say resolves ok');
  assert(got.some(e => e.kind === 'archduke-text' && /detective/.test(e.text)), 'streamed archduke text');
  assert(got.some(e => e.kind === 'subagent-dispatch' && e.name === 'detective-greymantle'), 'streamed dispatch');
  assert(got.some(e => e.kind === 'subagent-return' && e.name === 'detective-greymantle'), 'streamed return');
  assert(got.some(e => e.kind === 'turn-done'), 'streamed turn-done');
  assert(JSON.parse(fs.readFileSync(sessionFile, 'utf8')).session_id === 'fake-sess-42', 'session id persisted');
  assert(reg.sessionId === 'fake-sess-42', 'regent remembers session id');

  // missing binary -> error event, no throw
  const reg2 = new R.Regent({ projectRoot: proj, sessionFile, command: 'definitely-not-a-real-binary-xyz', baseArgs: [] });
  const got2 = [];
  await reg2.say('x', (ev) => got2.push(ev));
  assert(got2.some(e => e.kind === 'error'), 'missing binary yields an error event');

  fs.rmSync(proj, { recursive: true, force: true });
  done();
})();
