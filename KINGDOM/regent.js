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

class Regent {
  constructor({ projectRoot, sessionFile, command = 'claude', baseArgs = [] }) {
    this.projectRoot = projectRoot;
    this.sessionFile = sessionFile;
    this.command = command;
    this.baseArgs = baseArgs;
    this.child = null;
    this.sessionId = this._loadSession();
  }
  get busy() { return this.child != null; }
  _loadSession() {
    try { return JSON.parse(fs.readFileSync(this.sessionFile, 'utf8')).session_id || null; } catch { return null; }
  }
  _saveSession(id) {
    try {
      fs.mkdirSync(path.dirname(this.sessionFile), { recursive: true });
      fs.writeFileSync(this.sessionFile, JSON.stringify({ session_id: id, updated_at: new Date().toISOString() }, null, 2) + '\n');
    } catch { /* non-fatal */ }
  }
  say(text, onEvent) {
    if (this.busy) return Promise.resolve({ ok: false, busy: true });
    const args = [...this.baseArgs, '-p', text, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits'];
    if (this.sessionId) args.push('--resume', this.sessionId);
    let state = initialState();
    return new Promise((resolve) => {
      let resolved = false;
      const settle = (val) => { if (!resolved) { resolved = true; resolve(val); } };
      let child;
      try {
        child = spawn(this.command, args, { cwd: this.projectRoot });
      } catch (e) {
        onEvent({ kind: 'error', message: `Failed to start Claude Code: ${e.message}` });
        return settle({ ok: false, error: e.message });
      }
      this.child = child;
      let buf = '';
      const handleLine = (line) => {
        const t = line.trim();
        if (!t) return;
        let obj;
        try { obj = JSON.parse(t); } catch { if (process.env.KINGDOM_REGENT_DEBUG) console.error('REGENT raw:', t); return; }
        const r = normalizeStreamObj(obj, state);
        state = r.state;
        for (const ev of r.events) {
          if (ev.kind === 'session') this._saveSession((this.sessionId = ev.sessionId));
          onEvent(ev);
        }
      };
      child.stdout.on('data', (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      });
      child.stderr.on('data', (d) => { if (process.env.KINGDOM_REGENT_DEBUG) console.error('REGENT stderr:', d.toString()); });
      child.on('error', (e) => {
        onEvent({ kind: 'error', message: `Claude Code could not be launched: ${e.message}. Is the \`claude\` CLI installed and on PATH?` });
        settle({ ok: false, error: e.message });
      });
      child.on('close', (code) => {
        if (buf.trim()) handleLine(buf);
        this.child = null;
        settle({ ok: code === 0, code, sessionId: this.sessionId });
      });
    });
  }
  stop() {
    if (this.child) { try { this.child.kill('SIGTERM'); } catch {} this.child = null; return true; }
    return false;
  }
}

module.exports = { initialState, normalizeStreamObj, extractText, summarizeInput, Regent };
