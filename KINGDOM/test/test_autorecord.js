'use strict';
const { assert, done } = require('./_assert.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');

const KJS = path.join(__dirname, '..', 'kingdom.js');
const FAKE = path.join(__dirname, 'fake-claude.js');
const PORT = 8767;

function post(p, body) {
  return new Promise((res) => {
    const data = JSON.stringify(body);
    const r = http.request(`http://localhost:${PORT}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (resp) => { let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => res({ status: resp.statusCode, body: d })); });
    r.write(data); r.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'chron-'));
  execFileSync('node', [KJS, 'init', proj], { encoding: 'utf8' });
  const sessionsPath = path.join(proj, '.kingdom', 'history', 'sessions.json');
  const before = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')).sessions.length;

  const srv = spawn('node', [path.join(proj, '.kingdom', 'kingdom-server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), KINGDOM_CLAUDE_CMD: 'node', KINGDOM_CLAUDE_BASEARGS: JSON.stringify([FAKE]) }),
  });
  await sleep(800);
  await post('/api/archduke/say', { text: 'Investigate the README and report.' });
  await sleep(900);

  const after = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')).sessions;
  assert(after.length === before + 1, 'a session was auto-recorded after the reign');
  const entry = after[after.length - 1];
  assert(/Investigate the README/.test(entry.quest), 'recorded entry carries the quest');
  assert(/^Archduke ClaudeCode /.test(entry.noble), 'recorded entry names the Archduke');
  assert(entry.court.includes('detective-greymantle'), 'recorded entry lists the dispatched court');
  assert(/Archivist/i.test(entry.notes), 'recorded entry credits the Archivist');
  assert(typeof entry.session === 'number' && entry.session > before, 'session number advances');

  srv.kill('SIGTERM');
  await sleep(150);
  fs.rmSync(proj, { recursive: true, force: true });
  done();
})();
