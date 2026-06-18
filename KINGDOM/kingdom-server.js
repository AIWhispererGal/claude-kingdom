#!/usr/bin/env node
/**
 * 🏰 THE LIVING KINGDOM — Throne Room Server
 *
 * A zero-dependency Node server that puts the CLI on the web. It serves the
 * unified court app (web/app.html), exposes every Kingdom action as a real
 * backend call (the same generator + kingdom.js the terminal uses), and streams
 * those real actions to the browser live via Server-Sent Events.
 *
 *   node KINGDOM/kingdom-server.js          # then open http://localhost:8080
 *   PORT=9000 node KINGDOM/kingdom-server.js
 *
 * Node built-ins only. No npm install.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const G = require('./summons/generator.js'); // reuse the real engine + PATHS

const ROOT = G.KINGDOM_ROOT;                 // .../KINGDOM
const KINGDOM_JS = path.join(ROOT, 'kingdom.js');
const APP_HTML = path.join(ROOT, 'web', 'app.html');
const PORT = parseInt(process.env.PORT, 10) || 8080;
const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');

// ──────────────────────────────────────────────────────────────────────────
// Live event hub (Server-Sent Events)
// ──────────────────────────────────────────────────────────────────────────
const clients = new Set();      // active SSE response objects
const recent = [];              // ring buffer so new clients see recent history
let eventSeq = 0;

function emit(ev) {
  const event = {
    id: ++eventSeq,
    ts: new Date().toISOString(),
    icon: ev.icon || '•',
    kind: ev.kind || 'server',
    title: ev.title || '',
    detail: ev.detail || '',
    noble: ev.noble || null,
  };
  recent.push(event);
  if (recent.length > 60) recent.shift();
  const frame = `event: kingdom\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try { res.write(frame); } catch (_) { /* client gone; reaped on close */ }
  }
  return event;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

// CLI args must be safe identifiers — execFile (no shell) plus this guard.
const isIdent = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);

function runCLI(args) {
  return new Promise((resolve) => {
    execFile('node', [KINGDOM_JS, ...args], { cwd: ROOT, timeout: 20000 }, (err, stdout, stderr) => {
      resolve({
        code: err ? (err.code || 1) : 0,
        stdout: stripAnsi(stdout || ''),
        stderr: stripAnsi(stderr || ''),
      });
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.tmpl': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, urlPath) {
  // Map "/" to the unified app; everything else resolves under ROOT.
  let rel = urlPath === '/' ? 'web/app.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found: ' + rel);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// API actions — each is a REAL backend operation that also announces itself
// ──────────────────────────────────────────────────────────────────────────
const ROLE_EMOJI = (() => {
  const reg = G.loadRegistry();
  const m = {};
  if (reg && Array.isArray(reg.roles)) for (const r of reg.roles) m[r.name.toUpperCase()] = r.emoji || '•';
  return m;
})();

async function apiSummon(body) {
  const quest = {
    rank: body.rank || 'KNIGHT',
    house: parseInt(body.house, 10) || 1,
    nickname: body.nickname || '',
    title: body.title || '(untitled quest)',
    description: body.description || '',
    warnings: Array.isArray(body.warnings) ? body.warnings : [],
    court: Array.isArray(body.court)
      ? body.court.filter((c) => c && c.role).map((c) => ({
          role: String(c.role).toUpperCase(),
          family: String(c.family || 'PRIME'),
          task: c.task || '',
        }))
      : [],
  };
  const raw = G.generateSummons(quest);
  const text = stripAnsi(raw);

  // Persist to summons/output with a scanned integer suffix (mirrors the CLI).
  let file = null;
  try {
    const outDir = G.PATHS.output;
    fs.mkdirSync(outDir, { recursive: true });
    const roman = G.toRoman(quest.house);
    const base = `SUMMONS_${quest.rank.toUpperCase()}_${roman}`;
    let n = 0;
    for (const f of fs.readdirSync(outDir)) {
      const mm = f.match(new RegExp('^' + base + '_(\\d+)\\.md$'));
      if (mm) n = Math.max(n, parseInt(mm[1], 10));
    }
    file = `${base}_${String(n + 1).padStart(3, '0')}.md`;
    fs.writeFileSync(path.join(outDir, file), text + '\n');
  } catch (_) { /* non-fatal: still return the summons text */ }

  const roman = G.toRoman(quest.house);
  const nobleName = `${quest.rank} ClaudeCode ${roman}${quest.nickname ? ` "${quest.nickname}"` : ''}`;
  emit({
    icon: '👑', kind: 'summon', noble: nobleName,
    title: `${nobleName} summons a court of ${quest.court.length}`,
    detail: quest.title,
  });
  // Sub-summons announcements: each agent of the court is a real part of this summons.
  for (const c of quest.court) {
    emit({
      icon: ROLE_EMOJI[c.role] || '•', kind: 'court-agent', noble: nobleName,
      title: `${c.role}/${c.family} answers the call`,
      detail: c.task ? `Charge: ${c.task}` : 'Vow pending — declares upon first message',
    });
  }
  return { ok: true, noble: nobleName, summons: text, file };
}

async function apiNewFamily(body) {
  if (!isIdent(body.role) || !isIdent(body.family)) throw new Error('role and family must be simple identifiers');
  const r = await runCLI(['new-family', body.role.toLowerCase(), body.family.toUpperCase()]);
  emit({ icon: '🌱', kind: 'new-family',
    title: `New family founded: ${body.role.toUpperCase()}/${body.family.toUpperCase()}`,
    detail: 'A new lineage takes root. Status: ACTIVE.' });
  return { ok: r.code === 0, output: r.stdout || r.stderr };
}

async function apiNewRole(body) {
  if (!isIdent(body.name)) throw new Error('role name must be a simple identifier');
  const r = await runCLI(['new-role', body.name.toUpperCase()]);
  emit({ icon: '🆕', kind: 'new-role',
    title: `New role invented: ${body.name.toUpperCase()}`,
    detail: 'Scaffolded from the role template and added to the registry.' });
  return { ok: r.code === 0, output: r.stdout || r.stderr };
}

async function apiExtinct(body) {
  if (!isIdent(body.role) || !isIdent(body.family)) throw new Error('role and family must be simple identifiers');
  const reason = (body.reason || 'unspecified').slice(0, 200);
  const r = await runCLI(['extinct', body.role.toLowerCase(), body.family.toUpperCase(), '--reason', reason]);
  emit({ icon: '✝', kind: 'extinct',
    title: `${body.role.toUpperCase()}/${body.family.toUpperCase()} declared EXTINCT`,
    detail: `Reason: ${reason}. Skills archived for inheritance.` });
  return { ok: r.code === 0, output: r.stdout || r.stderr };
}

async function apiPetition(body) {
  const agent = String(body.agent || '').trim();
  const honor = String(body.honor || '').trim();
  if (!/^[A-Za-z0-9 _'".\-]{1,64}$/.test(agent) || !honor) throw new Error('invalid agent or honor');
  const args = ['petition', agent.replace(/\s+/g, '-'), honor];
  if (body.session != null && String(body.session).length) args.push('--session', String(body.session));
  const r = await runCLI(args);
  emit({ icon: '🙇', kind: 'petition',
    title: `Petition filed: ${agent} → ${honor}`,
    detail: 'Status: PENDING_BATMAN_REVIEW. Batman decides.' });
  return { ok: r.code === 0, output: r.stdout || r.stderr };
}

// Ducal MINOR grant — a real mutation of awarded.json (no CLI equivalent exists).
async function apiGrant(body) {
  const honor = String(body.honor || '').trim();
  const recipient = String(body.recipient || '').trim();
  if (!honor || !recipient) throw new Error('honor and recipient are required');
  const awarded = G.readJSON(G.PATHS.awarded);
  if (awarded.__missing || awarded.__error) throw new Error('awarded.json unavailable');
  if (!Array.isArray(awarded.awards)) awarded.awards = [];
  const authority = String(body.granting_authority || 'Duke ClaudeCode (web)').slice(0, 80);
  const entry = {
    honor, emoji: String(body.emoji || '🏅').slice(0, 4),
    tier: 'MINOR', recipient,
    session: body.session != null ? body.session : 'live',
    reason: String(body.reason || 'Field commendation granted from the Throne Room').slice(0, 300),
    granting_authority: authority, batman_ratified: false, self_claimed: false,
  };
  awarded.awards.push(entry);
  G.writeJSON(G.PATHS.awarded, awarded);
  emit({ icon: entry.emoji, kind: 'grant',
    title: `${entry.emoji} ${honor} → ${recipient}`,
    detail: `MINOR award by ducal right (${authority}). Batman may ratify or revoke.` });
  return { ok: true, award: entry };
}

function apiState() {
  return {
    registry: G.readJSON(G.PATHS.registry),
    hat: G.readJSON(G.PATHS.theHat),
    broom: G.readJSON(G.PATHS.broom),
    sessions: G.readJSON(G.PATHS.sessions),
    patterns: G.readJSON(G.PATHS.patterns),
    awarded: G.readJSON(G.PATHS.awarded),
    catalog: G.readJSON(G.PATHS.catalog),
    extinctions: G.readJSON(G.PATHS.extinctions),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────────────────────────────────
const POST_ACTIONS = {
  '/api/summon': apiSummon,
  '/api/new-family': apiNewFamily,
  '/api/new-role': apiNewRole,
  '/api/extinct': apiExtinct,
  '/api/petition': apiPetition,
  '/api/grant': apiGrant,
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // SSE live feed
  if (urlPath === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    res.write(`event: kingdom\ndata: ${JSON.stringify({ id: 0, ts: new Date().toISOString(), icon: '🏰', kind: 'server', title: 'Connected to the Throne Room', detail: '' })}\n\n`);
    for (const ev of recent) res.write(`event: kingdom\ndata: ${JSON.stringify(ev)}\n\n`);
    clients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 25000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  if (urlPath === '/api/state' && req.method === 'GET') return sendJSON(res, 200, apiState());

  if (req.method === 'POST' && POST_ACTIONS[urlPath]) {
    try {
      const body = await readBody(req);
      const result = await POST_ACTIONS[urlPath](body);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }

  if (req.method === 'GET') return serveStatic(req, res, urlPath);
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  const line = '═'.repeat(54);
  console.log('\x1b[38;5;179m' + line);
  console.log('   🏰  THE LIVING KINGDOM — Throne Room Server');
  console.log(line + '\x1b[0m');
  console.log(`   The court is open at  \x1b[1mhttp://localhost:${PORT}\x1b[0m`);
  console.log('   Live actions stream to every open browser. Long may it reign. 🪶');
  console.log(line);
});
