'use strict';
const { assert, done } = require('./_assert.js');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8744;
const FAKE = path.join(__dirname, 'fake-claude.js');
const env = Object.assign({}, process.env, {
  PORT: String(PORT),
  KINGDOM_CLAUDE_CMD: 'node',
  KINGDOM_CLAUDE_BASEARGS: JSON.stringify([FAKE]),
});
const srv = spawn('node', [path.join(__dirname, '..', 'kingdom-server.js')], { env });

function get(p) { return new Promise((res) => http.get(`http://localhost:${PORT}${p}`, (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res({ status:r.statusCode, body:d })); })); }
function post(p, body) {
  return new Promise((res) => {
    const data = JSON.stringify(body);
    const r = http.request(`http://localhost:${PORT}${p}`, { method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} }, (resp)=>{ let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>res({status:resp.statusCode, body:d})); });
    r.write(data); r.end();
  });
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async () => {
  await sleep(700); // server boot
  const frames = [];
  const sse = http.get(`http://localhost:${PORT}/api/events`, (r) => { r.on('data', (c) => frames.push(c.toString())); });
  await sleep(200);

  const status = await get('/api/archduke/status');
  assert(status.status === 200 && /"busy"/.test(status.body), 'status endpoint responds');

  const say = await post('/api/archduke/say', { text: 'hello' });
  assert(say.status === 200 && /"started":true/.test(say.body), 'say starts a turn');

  await sleep(900); // let the fake stream flow
  const all = frames.join('');
  assert(/archduke-text/.test(all), 'SSE carried archduke-text');
  assert(/subagent-dispatch/.test(all), 'SSE carried subagent-dispatch');

  sse.destroy();
  srv.kill('SIGTERM');
  await sleep(150);
  // cleanup the stray session file the server wrote into the source KINGDOM dir
  try { fs.unlinkSync(path.join(__dirname, '..', 'regent.json')); } catch {}
  done();
})();
