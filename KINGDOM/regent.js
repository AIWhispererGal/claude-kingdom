'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function initialState() {
  return { sessionId: null, subagents: {}, doneEmitted: false };
}

// Pull readable text out of a string or an array of content blocks.
function extractText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === 'string' ? c : (c && c.text) || '')).join(' ').trim();
  }
  if (typeof content === 'object' && content.text) return content.text;
  return '';
}

function summarizeInput(name, input) {
  if (!input || typeof input !== 'object') return '';
  const k = input.file_path || input.path || input.command || input.pattern || input.url;
  return k ? String(k).slice(0, 120) : '';
}

// Normalize one parsed stream-json object. Returns { events, state }. Never throws.
function normalizeStreamObj(obj, state) {
  const events = [];
  if (!obj || typeof obj !== 'object') return { events, state };

  if (obj.session_id && state.sessionId !== obj.session_id) {
    state.sessionId = obj.session_id;
    events.push({ kind: 'session', sessionId: obj.session_id });
  }

  const content =
    (obj.message && Array.isArray(obj.message.content) && obj.message.content) ||
    (Array.isArray(obj.content) && obj.content) ||
    null;
  if (content) {
    for (const item of content) {
      if (!item || typeof item !== 'object') continue;
      if (item.type === 'text' && typeof item.text === 'string') {
        if (item.text) events.push({ kind: 'archduke-text', text: item.text });
      } else if (item.type === 'tool_use') {
        const name = item.name;
        if (name === 'Agent' || name === 'Task') {
          const input = item.input || {};
          const sub = input.subagent_type || input.subagentType || input.agent_type || input.description || 'subagent';
          const task = String(input.prompt || input.description || '').replace(/\s+/g, ' ').slice(0, 160);
          if (item.id) state.subagents[item.id] = sub;
          events.push({ kind: 'subagent-dispatch', id: item.id, name: sub, task });
        } else if (name) {
          events.push({ kind: 'tool-use', tool: name, summary: summarizeInput(name, item.input) });
        }
      } else if (item.type === 'tool_result') {
        const id = item.tool_use_id || item.parent_tool_use_id;
        if (id && state.subagents[id]) {
          const name = state.subagents[id];
          delete state.subagents[id];
          events.push({ kind: 'subagent-return', name, summary: extractText(item.content).slice(0, 200) });
        }
      }
    }
  }

  const isResult = obj.type === 'result' || typeof obj.total_cost_usd === 'number' ||
    (typeof obj.subtype === 'string' && /^(success|error)/.test(obj.subtype) && ('result' in obj || 'total_cost_usd' in obj));
  if (isResult && !state.doneEmitted) {
    state.doneEmitted = true;
    events.push({ kind: 'turn-done', ok: !obj.is_error, cost: typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : null });
  }

  return { events, state };
}

module.exports = { initialState, normalizeStreamObj, extractText, summarizeInput };
