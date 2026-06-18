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

done();
