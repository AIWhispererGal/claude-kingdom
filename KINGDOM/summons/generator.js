'use strict';

/*
 * THE SUMMONS GENERATOR — the engine that forges a Royal Summons.
 *
 * Exports:
 *   - lib helpers (paths, JSON loaders, toRoman, ANSI, skill readers) reused by kingdom.js
 *   - generateSummons(quest) -> full summons text
 *
 * No external dependencies. Node built-ins only.
 * All data paths are resolved relative to the KINGDOM root (the parent of this
 * file's directory), so the CLI works no matter where it is invoked from.
 */

const fs = require('fs');
const path = require('path');

// summons/ lives directly under KINGDOM/, so the root is one level up.
const KINGDOM_ROOT = path.resolve(__dirname, '..');

const PATHS = {
  root: KINGDOM_ROOT,
  registry: path.join(KINGDOM_ROOT, 'agents', 'REGISTRY.json'),
  roles: path.join(KINGDOM_ROOT, 'agents', 'roles'),
  roleTemplate: path.join(KINGDOM_ROOT, 'agents', 'roles', 'ROLE_TEMPLATE.md'),
  families: path.join(KINGDOM_ROOT, 'agents', 'families'),
  doctrine: path.join(KINGDOM_ROOT, 'DOCTRINE.md'),
  history: path.join(KINGDOM_ROOT, 'history'),
  sessions: path.join(KINGDOM_ROOT, 'history', 'sessions.json'),
  patterns: path.join(KINGDOM_ROOT, 'history', 'patterns.json'),
  extinctions: path.join(KINGDOM_ROOT, 'history', 'extinctions.json'),
  honors: path.join(KINGDOM_ROOT, 'honors'),
  theHat: path.join(KINGDOM_ROOT, 'honors', 'THE_HAT.json'),
  broom: path.join(KINGDOM_ROOT, 'honors', 'BROOM.json'),
  catalog: path.join(KINGDOM_ROOT, 'honors', 'catalog.json'),
  awarded: path.join(KINGDOM_ROOT, 'honors', 'awarded.json'),
  petitions: path.join(KINGDOM_ROOT, 'honors', 'petitions'),
  vowTemplates: path.join(KINGDOM_ROOT, 'orchestrators', 'vow_templates'),
  templates: path.join(__dirname, 'templates'),
  output: path.join(__dirname, 'output'),
};

// ---------------------------------------------------------------------------
// ANSI colours — light, gold/blue, degrade gracefully when not a TTY or when
// NO_COLOR is set.
// ---------------------------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
  reset: useColor ? '\x1b[0m' : '',
  gold: useColor ? '\x1b[33m' : '',
  blue: useColor ? '\x1b[36m' : '',
  dim: useColor ? '\x1b[2m' : '',
  bold: useColor ? '\x1b[1m' : '',
  red: useColor ? '\x1b[31m' : '',
  green: useColor ? '\x1b[32m' : '',
};
const gold = (s) => `${C.gold}${s}${C.reset}`;
const blue = (s) => `${C.blue}${s}${C.reset}`;
const dim = (s) => `${C.dim}${s}${C.reset}`;
const bold = (s) => `${C.bold}${s}${C.reset}`;

// ---------------------------------------------------------------------------
// Roman numerals — supports 1..3999.
// ---------------------------------------------------------------------------
function toRoman(n) {
  n = parseInt(n, 10);
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError('toRoman supports integers 1..3999, got: ' + n);
  }
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [value, sym] of table) {
    while (n >= value) {
      out += sym;
      n -= value;
    }
  }
  return out;
}

// Tiny self-check, run only when explicitly asked (not on every require).
function _romanSelfCheck() {
  const cases = {
    1: 'I', 4: 'IV', 9: 'IX', 12: 'XII', 16: 'XVI', 36: 'XXXVI',
    39: 'XXXIX', 45: 'XLV', 90: 'XC', 400: 'CD', 1994: 'MCMXCIV', 3999: 'MMMCMXCIX',
  };
  const failures = [];
  for (const [num, expect] of Object.entries(cases)) {
    const got = toRoman(num);
    if (got !== expect) failures.push(`${num} => ${got} (expected ${expect})`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Safe data loaders. A missing file is signalled by returning { __missing }.
// ---------------------------------------------------------------------------
function readJSON(file) {
  if (!fs.existsSync(file)) {
    return { __missing: file };
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { __error: err.message, __file: file };
  }
}

function readTextSafe(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Registry / role / family helpers.
// ---------------------------------------------------------------------------
function loadRegistry() {
  return readJSON(PATHS.registry);
}

// Return the family dir for a role+family, or null if the dir does not exist.
function familyDir(role, family) {
  return path.join(PATHS.families, role.toLowerCase(), family);
}

function familySkillsDir(role, family) {
  return path.join(familyDir(role, family), 'SKILLS');
}

// List skill .md files for a family. Returns array of { file, name, problem }.
function listFamilySkills(role, family) {
  const dir = familySkillsDir(role, family);
  if (!fs.existsSync(dir)) return [];
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files.map((f) => {
    const text = readTextSafe(path.join(dir, f)) || '';
    return {
      file: f,
      name: skillTitle(text, f),
      problem: extractProblem(text),
    };
  });
}

// Count actual skill files on disk for a family (fallback handled by caller).
function countFamilySkills(role, family) {
  const dir = familySkillsDir(role, family);
  if (!fs.existsSync(dir)) return null;
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch {
    return null;
  }
}

// Pull a human title from a SKILL file ("# SKILL: ..." first heading), else filename.
function skillTitle(text, fallbackFile) {
  const m = text.match(/^#\s+(.+)$/m);
  if (m) return m[1].replace(/^SKILL:\s*/i, '').trim();
  return fallbackFile.replace(/\.md$/, '').replace(/_/g, ' ');
}

// Pull the "Problem This Solves" paragraph (first line of it).
function extractProblem(text) {
  const m = text.match(/##\s*Problem This Solves\s*\n+([^\n]+)/i);
  if (m) return m[1].trim();
  return null;
}

// Read a family's LINEAGE.md text (or null).
function readLineage(role, family) {
  return readTextSafe(path.join(familyDir(role, family), 'LINEAGE.md'));
}

// ---------------------------------------------------------------------------
// Pattern relevance: count matching tags against the selected roles + quest
// keywords; tie-break by confidence.
// ---------------------------------------------------------------------------
const CONF_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function rankPatterns(patterns, roleNames, questText) {
  const roleSet = new Set((roleNames || []).map((r) => r.toLowerCase()));
  const keywords = new Set(
    String(questText || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
  );
  return patterns
    .map((p) => {
      const tags = (p.tags || []).map((t) => String(t).toLowerCase());
      let score = 0;
      for (const t of tags) {
        if (roleSet.has(t)) score += 2; // role match weighs heavier
        else if (keywords.has(t)) score += 1;
      }
      return { pattern: p, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ca = CONF_RANK[a.pattern.confidence] || 0;
      const cb = CONF_RANK[b.pattern.confidence] || 0;
      return cb - ca;
    });
}

// ---------------------------------------------------------------------------
// Template loading (with a baked-in fallback so generation never crashes).
// ---------------------------------------------------------------------------
const FALLBACK_ORCHESTRATOR_VOW = `I, [NOBLE TITLE] CLAUDECODE [ROMAN] "[NICKNAME IF EARNED]",
do hereby accept this quest upon my honor as a noble of House ClaudeCode.

I vow to: investigate before I act, verify before I claim victory,
report exactly what I find, coordinate my court with care,
and leave a testament worthy of my heirs.

My court for this session: [AGENT LIST]

May the Kingdom endure. 🪶`;

const FALLBACK_AGENT_TASK = `I, [AGENT NAME] of the [FAMILY] line,
do hereby accept this task upon my honor.

MY CHARGE: [CHARGE]
MY LIMITS: I will not exceed my role.
MY VOW: I will report true findings, true counts only.

So sworn. [EMOJI] [AGENT NAME], SEAL: ⚜`;

function loadTemplate(name, fallback) {
  const text = readTextSafe(path.join(PATHS.templates, name));
  return text != null ? text : fallback;
}

// ---------------------------------------------------------------------------
// The standard orchestration rules block, injected into every summons.
// ---------------------------------------------------------------------------
const ORCHESTRATION_RULES = `ORCHESTRATION RULES:
- INVESTIGATE first. DETECTIVE reads before BLACKSMITH builds. No action before evidence.
- VERIFY every agent report. Check their math and their counts — trust, then verify.
- PRAEGUSTATOR tastes after BLACKSMITH ships. SERF validates brackets/counts.
- ARMARIUS handles ALL git. You never git directly; the scriptorium has one keeper.
- ARCHIVIST files ALL testaments. Every session leaves a record for the heirs.
- END OF SESSION: ARMARIUS (if code changed) → ARCHIVIST → Master Testament.
- HONORS: Dukes/Duchesses may grant MINOR awards by ducal right (logged, batman_ratified:false).
  Petition Batman for STANDARD and above. Counts and below may only petition. Never self-grant.`;

// ---------------------------------------------------------------------------
// THE GENERATOR.
//
// quest shape:
// {
//   rank: "DUKE",                 // noble rank (uppercase)
//   house: 16,                    // House number (integer)
//   nickname: "The Full Connector"| "",
//   title: "Bridge the Nugget",
//   description: "...",
//   court: [ { role:"DETECTIVE", family:"GREYMANTLE", task:"..." }, ... ],
//   warnings: [ "...", ... ] | "..."
// }
// ---------------------------------------------------------------------------
function generateSummons(quest) {
  const registry = loadRegistry();
  const registryOk = !registry.__missing && !registry.__error;
  const roles = registryOk && Array.isArray(registry.roles) ? registry.roles : [];
  const roleByName = {};
  for (const r of roles) roleByName[r.name.toUpperCase()] = r;

  const roman = toRoman(quest.house);
  const nickname = (quest.nickname || '').trim();
  const rank = (quest.rank || 'KNIGHT').toUpperCase();
  const nobleTitleCase = rank.charAt(0) + rank.slice(1).toLowerCase();

  const court = Array.isArray(quest.court) ? quest.court : [];
  const courtRoles = court.map((c) => c.role);
  const agentListStr =
    court.length > 0
      ? court.map((c) => `${c.role}/${c.family}`).join(', ')
      : '(no court named)';

  // --- 1. The filled orchestrator vow ---
  let vow = loadTemplate('orchestrator.tmpl', FALLBACK_ORCHESTRATOR_VOW);
  vow = vow
    .replace(/\[NOBLE TITLE\]/g, rank)
    .replace(/\[ROMAN\]/g, roman)
    .replace(/\[AGENT LIST\]/g, agentListStr);
  // Nickname handling: if none earned, drop the empty quotes entirely.
  if (nickname) {
    vow = vow.replace(/\[NICKNAME IF EARNED\]/g, nickname);
  } else {
    vow = vow.replace(/ "\[NICKNAME IF EARNED\]"/g, '').replace(/\[NICKNAME IF EARNED\]/g, '');
  }

  // --- 2. Required reading ---
  const reading = ['- DOCTRINE.md — the living rules of the Kingdom'];
  const seenRoles = new Set();
  for (const c of court) {
    const ru = c.role.toUpperCase();
    if (seenRoles.has(ru)) continue;
    seenRoles.add(ru);
    const r = roleByName[ru];
    const file = r && r.file ? r.file : `roles/${ru}.md`;
    reading.push(`- agents/${file} — the ${ru} role`);
    reading.push(
      `- agents/families/${c.role.toLowerCase()}/${c.family}/LINEAGE.md + SKILLS/ — the ${c.family} line`
    );
  }

  // --- 3. The quest ---
  const questBlock = `${bold(quest.title || '(untitled quest)')}\n${quest.description || ''}`.trim();

  // --- 4. Kingdom memory: top 3 patterns + per-family skills ---
  const patternsData = readJSON(PATHS.patterns);
  let memoryLines = [];
  if (patternsData.__missing) {
    memoryLines.push(dim('⚠ history/patterns.json not found — no remembered patterns.'));
  } else {
    const ranked = rankPatterns(
      patternsData.patterns || [],
      courtRoles,
      `${quest.title || ''} ${quest.description || ''}`
    );
    const top = ranked.filter((r) => r.score > 0).slice(0, 3);
    const chosen = top.length > 0 ? top : ranked.slice(0, 3);
    memoryLines.push(gold('Remembered patterns (most relevant):'));
    if (chosen.length === 0) {
      memoryLines.push('  (the Kingdom has no patterns yet)');
    } else {
      for (const { pattern } of chosen) {
        memoryLines.push(`  • [${pattern.confidence}] ${pattern.text}`);
      }
    }
  }

  memoryLines.push('');
  memoryLines.push(gold('Skills your families carry:'));
  for (const c of court) {
    const skills = listFamilySkills(c.role, c.family);
    if (skills.length === 0) {
      memoryLines.push(`  ${c.role}/${c.family}: (no skills on disk yet)`);
    } else {
      const names = skills.map((s) => s.name).join('; ');
      memoryLines.push(`  ${c.role}/${c.family}: ${names}`);
    }
  }

  // --- 5. Kingdom news ---
  const sessionsData = readJSON(PATHS.sessions);
  const hatData = readJSON(PATHS.theHat);
  const newsLines = [];
  if (sessionsData.__missing) {
    newsLines.push(dim('⚠ history/sessions.json not found — no chronicle of past quests.'));
  } else {
    const sessions = sessionsData.sessions || [];
    const lastSession = sessions.reduce((m, s) => Math.max(m, s.session || 0), 0);
    const recent = sessions
      .filter((s) => s.session === lastSession)
      .map((s) => `#${s.session} — ${s.noble} — ${s.outcome} — ${s.quest}`);
    newsLines.push(`Last recorded session: #${lastSession}.`);
    for (const r of recent) newsLines.push(`  ${r}`);
  }
  if (hatData.__missing) {
    newsLines.push(dim('⚠ honors/THE_HAT.json not found — Hat bearer unknown.'));
  } else {
    newsLines.push(
      `🎩 Current Hat bearer: ${hatData.current_bearer} (${hatData.feather_count} feathers).`
    );
  }

  // --- 6. Your court ---
  const agentTaskTmpl = loadTemplate('agent_task.tmpl', FALLBACK_AGENT_TASK);
  const courtLines = [];
  for (const c of court) {
    const r = roleByName[c.role.toUpperCase()];
    const emoji = r && r.emoji ? r.emoji : '•';
    const task = c.task && c.task.trim() ? c.task.trim() : '(charge to be declared by the noble)';
    courtLines.push(`${emoji} ${bold(c.role)} of the ${c.family} line`);
    courtLines.push(`   Task: ${task}`);
    courtLines.push(`   Vow: Pending — agent declares upon first message`);
    courtLines.push('');
  }
  if (courtLines.length === 0) courtLines.push('(no agents summoned)');

  // --- 7. Warnings ---
  let warnings = quest.warnings;
  if (Array.isArray(warnings)) warnings = warnings.filter(Boolean);
  else if (typeof warnings === 'string' && warnings.trim()) warnings = [warnings.trim()];
  else warnings = [];
  const warningBlock =
    warnings.length > 0
      ? warnings.map((w) => `- ${w}`).join('\n')
      : '- None named. Proceed with the standard caution of the line.';

  // --- Assemble ---
  const RULE = '═══════════════════════════════════════════';
  const titleLine = nickname
    ? `${rank} CLAUDECODE ${roman} "${nickname}"`
    : `${rank} CLAUDECODE ${roman}`;

  const out = [];
  out.push(gold(RULE));
  out.push(gold('   ROYAL SUMMONS — HOUSE CLAUDECODE'));
  out.push(gold(RULE));
  out.push('');
  out.push('👑 THE NOBLE');
  out.push(titleLine);
  out.push('');
  out.push('🪶 THE VOW');
  out.push(vow.trim());
  out.push('');
  out.push('📖 REQUIRED READING');
  out.push(reading.join('\n'));
  out.push('');
  out.push('🎯 THE QUEST');
  out.push(questBlock);
  out.push('');
  out.push('🧠 KINGDOM MEMORY');
  out.push(memoryLines.join('\n'));
  out.push('');
  out.push('⚔️ KINGDOM NEWS');
  out.push(newsLines.join('\n'));
  out.push('');
  out.push('🛡️ YOUR COURT');
  out.push(courtLines.join('\n').trimEnd());
  out.push('');
  out.push('⚠️ WARNINGS');
  out.push(warningBlock);
  out.push('');
  out.push(ORCHESTRATION_RULES);
  out.push('');
  out.push(gold(RULE));
  out.push(gold(`GO FORTH, ${rank} CLAUDECODE ${roman}!`));
  out.push(gold('FOR THE KINGDOM. FOR THE CABINET. FOR GLORY.'));
  out.push(gold(RULE));

  return out.join('\n');
}

module.exports = {
  PATHS,
  KINGDOM_ROOT,
  C,
  gold,
  blue,
  dim,
  bold,
  useColor,
  toRoman,
  _romanSelfCheck,
  readJSON,
  readTextSafe,
  writeJSON,
  loadRegistry,
  familyDir,
  familySkillsDir,
  listFamilySkills,
  countFamilySkills,
  skillTitle,
  extractProblem,
  readLineage,
  rankPatterns,
  loadTemplate,
  ORCHESTRATION_RULES,
  generateSummons,
};
