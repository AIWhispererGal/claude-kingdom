#!/usr/bin/env node
'use strict';
// Pretends to be `claude -p ... --output-format stream-json`. Emits canned lines and exits 0.
const lines = [
  { type: 'system', subtype: 'init', session_id: 'fake-sess-42' },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'I shall summon a detective.' }] } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-1', name: 'Agent', input: { subagent_type: 'detective-greymantle', prompt: 'Investigate the README' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: [{ type: 'text', text: 'The README documents init.' }] }] } },
  { type: 'result', subtype: 'success', total_cost_usd: 0.0009, is_error: false },
];
for (const l of lines) process.stdout.write(JSON.stringify(l) + '\n');
process.exit(0);
