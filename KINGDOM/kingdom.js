#!/usr/bin/env node
'use strict';

/*
 * kingdom.js — the command-line steward of THE LIVING KINGDOM.
 *
 * Usage: node KINGDOM/kingdom.js <command> [args]
 *
 * No external npm dependencies — Node built-ins only (fs, path, readline).
 * All data paths resolve relative to this file via the generator's PATHS,
 * so the CLI works from any working directory.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const gen = require('./summons/generator');
const {
  PATHS, C, gold, blue, dim, bold,
  toRoman, readJSON, readTextSafe, writeJSON,
  loadRegistry, listFamilySkills, countFamilySkills,
  readLineage, generateSummons,
} = gen;

// ---------------------------------------------------------------------------
// Small shared helpers.
// ---------------------------------------------------------------------------
function missingFileNote(file) {
  return `⚠ ${path.relative(PATHS.root, file)} not found — has the Kingdom been fully built?`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function red(s) { return `${C.red}${s}${C.reset}`; }
function green(s) { return `${C.green}${s}${C.reset}`; }

// Pad-end accounting for the fact ANSI codes have no display width. We only
// pad plain strings here, so a simple padEnd is fine.
function pad(s, n) {
  s = String(s == null ? '' : s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

// Parse "--flag value" / "--flag" out of an argv slice. Returns { flags, rest }.
function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      rest.push(a);
    }
  }
  return { flags, rest };
}

// readline question -> Promise.
function makeAsker() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a)));
  return { ask, close: () => rl.close() };
}

// ---------------------------------------------------------------------------
// HELP / BANNER
// ---------------------------------------------------------------------------
function banner() {
  const RULE = '═══════════════════════════════════════════';
  return [
    gold(RULE),
    gold('   🏰  THE LIVING KINGDOM — HOUSE CLAUDECODE'),
    gold(RULE),
  ].join('\n');
}

function cmdHelp() {
  console.log(banner());
  console.log('');
  console.log(bold('  Steward of the realm. Summon courts, read the chronicle, keep the honors.'));
  console.log('');
  const rows = [
    ['summon', 'Interactive quest setup → a full Claude Code summons (--demo for headless)'],
    ['history', 'The chronicle: every recorded session as a table'],
    ['medals', 'The honor wall: the Hat, the Broom, and all awards'],
    ['families [--role R]', 'The family tree, with live skill counts and records'],
    ['learn [--role R]', 'Patterns of the realm, plus family skill digests'],
    ['petition AGENT HONOR [--session N]', 'File an honor petition for Batman to review'],
    ['record', 'Interactively record a finished session into the chronicle'],
    ['new-role NAME', 'Scaffold a new agent ROLE'],
    ['new-family ROLE NAME', 'Found a new FAMILY lineage under a role'],
    ['extinct ROLE FAMILY [--reason T]', 'Declare a family extinct (skills archived)'],
    ['help', 'Show this banner'],
  ];
  for (const [cmd, desc] of rows) {
    console.log(`  ${blue(pad(cmd, 36))} ${desc}`);
  }
  console.log('');
  console.log(dim('  INVESTIGATE. BUILD. VERIFY. VOW. REMEMBER.'));
}

// ---------------------------------------------------------------------------
// summon
// ---------------------------------------------------------------------------
function nextSummonFilename(rank, house) {
  ensureDir(PATHS.output);
  let counter = 1;
  try {
    const existing = fs.readdirSync(PATHS.output).filter((f) => /^SUMMONS_.*\.md$/.test(f));
    counter = existing.length + 1;
  } catch { /* dir was just created */ }
  const tag = `${String(rank).toUpperCase()}_${toRoman(house)}`.replace(/[^A-Z0-9_]/g, '');
  const suffix = String(counter).padStart(3, '0');
  return path.join(PATHS.output, `SUMMONS_${tag}_${suffix}.md`);
}

function demoQuest() {
  return {
    rank: 'DUKE',
    house: 16,
    nickname: 'The Full Connector',
    title: 'The Filesystem Bug at the Gate',
    description:
      'A filesystem bug haunts the realm: paths resolve correctly in one branch and silently '
      + 'fall back to a stale default in another. Investigate the cause, forge the fix, taste it '
      + 'before it ships, and count the brackets true.',
    court: [
      { role: 'DETECTIVE', family: 'GREYMANTLE', task: 'Trace the filesystem path resolution; find where the stale default leaks in. Read before concluding.' },
      { role: 'BLACKSMITH', family: 'IRONFORGE', task: 'Once the cause is known, forge the fix. Extract the path constant; match the surrounding grain.' },
      { role: 'PRAEGUSTATOR', family: 'SILVERVEIN', task: 'Taste the fix on every branch. Confirm no stale default survives.' },
      { role: 'SERF', family: 'PLAINFIELD', task: 'Validate brackets and counts in the changed files. Count true.' },
    ],
    warnings: [
      'Do not let BLACKSMITH build before DETECTIVE has spoken (Pattern: HIGH).',
      'The stale-default path has bitten the realm before — verify every branch, not just the happy one.',
    ],
  };
}

async function collectQuestInteractive() {
  const registry = loadRegistry();
  const roles = (!registry.__missing && Array.isArray(registry.roles)) ? registry.roles : [];
  const families = (!registry.__missing && registry.families) ? registry.families : {};
  const { ask, close } = makeAsker();

  try {
    console.log(banner());
    console.log('');
    console.log(gold('Convene a quest. Answer the steward\'s questions.'));
    console.log('');

    const rank = (await ask('Noble rank (e.g. DUKE, COUNTESS, KNIGHT): ')).trim() || 'KNIGHT';
    let houseRaw = (await ask('House number (integer, e.g. 16): ')).trim();
    let house = parseInt(houseRaw, 10);
    if (!Number.isInteger(house) || house < 1 || house > 3999) {
      console.log(dim('  (not a valid 1..3999 number — defaulting to House 1)'));
      house = 1;
    }
    console.log(dim(`  → ${rank} ClaudeCode ${toRoman(house)}`));
    const nickname = (await ask('Nickname (optional — earned by deed; blank to skip): ')).trim();
    const title = (await ask('Quest title: ')).trim();
    const description = (await ask('Quest description: ')).trim();

    // Choose agents.
    console.log('');
    console.log(gold('Available roles:'));
    roles.forEach((r, i) => {
      console.log(`  ${pad(String(i + 1), 3)} ${r.emoji || '•'} ${r.name} — ${r.tagline || ''}`);
    });
    const pick = (await ask('Which roles to summon? (comma-separated numbers or names): ')).trim();
    const chosenRoles = [];
    for (const tok of pick.split(',').map((s) => s.trim()).filter(Boolean)) {
      let r = null;
      if (/^\d+$/.test(tok)) r = roles[parseInt(tok, 10) - 1];
      else r = roles.find((x) => x.name.toUpperCase() === tok.toUpperCase());
      if (r) chosenRoles.push(r);
    }

    const court = [];
    for (const r of chosenRoles) {
      const roleKey = r.name.toLowerCase();
      const fams = Array.isArray(families[roleKey]) ? families[roleKey] : [];
      let family = 'ClaudeCode';
      if (fams.length > 0) {
        console.log('');
        console.log(`Families for ${r.emoji || '•'} ${r.name}:`);
        fams.forEach((f, i) => {
          console.log(`  ${pad(String(i + 1), 3)} ${f.name} [${f.status}] — ${f.philosophy || ''}`);
        });
        const fpick = (await ask(`Pick a family for ${r.name} (number/name, blank = first): `)).trim();
        let chosen = fams[0];
        if (fpick) {
          if (/^\d+$/.test(fpick)) chosen = fams[parseInt(fpick, 10) - 1] || fams[0];
          else chosen = fams.find((x) => x.name.toUpperCase() === fpick.toUpperCase()) || fams[0];
        }
        family = chosen.name;
      } else {
        console.log(dim(`  (no families registered for ${r.name} — using generic line)`));
      }
      const task = (await ask(`Charge for ${r.name}/${family}: `)).trim();
      court.push({ role: r.name, family, task });
    }

    console.log('');
    const warnRaw = (await ask('Warnings (semicolon-separated, optional): ')).trim();
    const warnings = warnRaw ? warnRaw.split(';').map((s) => s.trim()).filter(Boolean) : [];

    return { rank, house, nickname, title, description, court, warnings };
  } finally {
    close();
  }
}

async function cmdSummon(argv) {
  const { flags } = parseArgs(argv);
  const headless = flags.demo || !process.stdin.isTTY;

  let quest;
  if (headless) {
    if (flags.demo) console.log(dim('(--demo) generating a representative summons headlessly.\n'));
    else console.log(dim('(stdin is not a TTY) generating a demo summons headlessly.\n'));
    quest = demoQuest();
  } else {
    quest = await collectQuestInteractive();
  }

  const text = generateSummons(quest);
  console.log('');
  console.log(text);

  const file = nextSummonFilename(quest.rank, quest.house);
  // Strip ANSI from the saved file so it is clean markdown.
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  fs.writeFileSync(file, clean + '\n', 'utf8');
  console.log('');
  console.log(green(`📜 Summons saved → ${path.relative(PATHS.root, file)}`));
}

// ---------------------------------------------------------------------------
// history
// ---------------------------------------------------------------------------
function cmdHistory() {
  const data = readJSON(PATHS.sessions);
  if (data.__missing) { console.log(missingFileNote(PATHS.sessions)); return; }
  if (data.__error) { console.log(red(`⚠ history/sessions.json is malformed: ${data.__error}`)); return; }

  console.log(banner());
  console.log('');
  console.log(gold('THE CHRONICLE — recorded sessions'));
  console.log('');
  const header =
    `${pad('SES', 5)}${pad('NOBLE', 34)}${pad('OUTCOME', 9)}${pad('CT', 4)}QUEST`;
  console.log(bold(header));
  console.log(dim('─'.repeat(header.length + 20)));
  for (const s of data.sessions || []) {
    const outcome = s.outcome === 'VICTORY' ? green(pad(s.outcome, 9))
      : s.outcome === 'DEFEAT' ? red(pad(s.outcome, 9))
        : pad(s.outcome || '?', 9);
    const ct = String((s.court || []).length);
    const quest = (s.quest || '').length > 50 ? s.quest.slice(0, 47) + '...' : (s.quest || '');
    console.log(`${pad('#' + s.session, 5)}${pad(s.noble, 34)}${outcome}${pad(ct, 4)}${quest}`);
    const medals = (s.medals || []);
    if (medals.length) console.log(dim(`     🏅 ${medals.join(', ')}`));
    if ((s.vow_violations || []).length) {
      console.log(red(`     ⚠ vow violations: ${s.vow_violations.length}`));
    }
  }
}

// ---------------------------------------------------------------------------
// medals
// ---------------------------------------------------------------------------
function cmdMedals() {
  console.log(banner());
  console.log('');
  console.log(gold('🏅 THE HONOR WALL'));
  console.log('');

  // The Hat
  const hat = readJSON(PATHS.theHat);
  if (hat.__missing) {
    console.log(missingFileNote(PATHS.theHat));
  } else {
    console.log(bold('🎩 THE SACRED FLOPPY HAT (Order of Merlin)'));
    console.log(`   Current bearer: ${gold(hat.current_bearer)}  (awarded session ${hat.session_awarded})`);
    console.log(`   Feathers: ${hat.feather_count}`);
    for (const f of hat.feathers || []) {
      console.log(`     🪶 ${f.type} — ${f.description} (session ${f.session}, by ${f.granted_by})`);
    }
    if ((hat.hat_history || []).length) {
      console.log('');
      console.log(dim('   Hat history:'));
      for (const h of hat.hat_history) {
        console.log(dim(`     • ${h.bearer} (inducted ${h.session_inducted}, ${h.feathers_accumulated} feathers) → ${h.passed_to || 'still bearing'} — ${h.reason || ''}`));
      }
    }
  }
  console.log('');

  // The Broom
  const broom = readJSON(PATHS.broom);
  if (broom.__missing) {
    console.log(missingFileNote(PATHS.broom));
  } else {
    console.log(bold('🧹 THE BROOM OF DISTINCTION'));
    console.log(`   Current bearer: ${gold(broom.current_bearer)}`);
    for (const r of broom.recipients || []) {
      console.log(`     • ${r.recipient} — ${r.reason} (session ${r.session}, by ${r.granted_by})`);
    }
  }
  console.log('');

  // Awards (grouped by tier)
  const awarded = readJSON(PATHS.awarded);
  if (awarded.__missing) {
    console.log(missingFileNote(PATHS.awarded));
    return;
  }
  if (awarded.__error) {
    console.log(red(`⚠ honors/awarded.json malformed: ${awarded.__error}`));
    return;
  }
  console.log(bold('⚜ THE AWARDS'));
  const awards = awarded.awards || [];
  if (awards.length === 0) {
    console.log(dim('   (no awards recorded yet)'));
    return;
  }
  const tierOrder = ['ORDER', 'EPIC', 'STANDARD', 'FAMILY', 'MINOR', 'INFORMAL'];
  const byTier = {};
  for (const a of awards) {
    const t = (a.tier || 'INFORMAL').toUpperCase();
    (byTier[t] = byTier[t] || []).push(a);
  }
  const tiers = [...tierOrder.filter((t) => byTier[t]), ...Object.keys(byTier).filter((t) => !tierOrder.includes(t))];
  for (const t of tiers) {
    console.log('');
    console.log(`  ${gold(t)}`);
    for (const a of byTier[t]) {
      const auth = a.granting_authority || 'unknown';
      let tag;
      if (a.self_claimed) tag = red('[SELF_CLAIMED]');
      else if (/^Duke/i.test(auth)) tag = blue(`[DUCAL: ${auth}${a.batman_ratified ? ', ratified' : ''}]`);
      else if (/batman/i.test(auth)) tag = green('[BATMAN]');
      else tag = `[${auth}]`;
      console.log(`     ${a.emoji || '•'} ${bold(a.honor)} → ${a.recipient} (s${a.session}) ${tag}`);
      if (a.reason) console.log(dim(`         ${a.reason}`));
    }
  }
}

// ---------------------------------------------------------------------------
// families
// ---------------------------------------------------------------------------
const STATUS_BADGE = {
  ACTIVE: green('● ACTIVE'),
  GROWING: blue('◔ GROWING'),
  STRUGGLING: gold('◑ STRUGGLING'),
  ENDANGERED: red('◕ ENDANGERED'),
  EXTINCT: dim('✝ EXTINCT'),
};

function cmdFamilies(argv) {
  const { flags } = parseArgs(argv);
  const registry = loadRegistry();
  if (registry.__missing) { console.log(missingFileNote(PATHS.registry)); return; }
  if (registry.__error) { console.log(red(`⚠ REGISTRY.json malformed: ${registry.__error}`)); return; }

  // Build extinct set from extinctions.json too.
  const extData = readJSON(PATHS.extinctions);
  const extinctSet = new Set();
  if (!extData.__missing && Array.isArray(extData.extinctions)) {
    for (const e of extData.extinctions) extinctSet.add(`${(e.role || '').toLowerCase()}/${e.family}`);
  }

  console.log(banner());
  console.log('');
  console.log(gold('🌳 THE FAMILY TREE'));

  const families = registry.families || {};
  const roleFilter = typeof flags.role === 'string' ? flags.role.toLowerCase() : null;
  const roleKeys = Object.keys(families).filter((r) => !roleFilter || r === roleFilter);

  if (roleFilter && roleKeys.length === 0) {
    console.log('');
    console.log(dim(`(no families registered for role '${roleFilter}')`));
    return;
  }

  for (const role of roleKeys) {
    console.log('');
    console.log(bold(`${role.toUpperCase()}`));
    for (const f of families[role]) {
      const key = `${role}/${f.name}`;
      const isExtinct = f.status === 'EXTINCT' || extinctSet.has(key);
      const status = isExtinct ? STATUS_BADGE.EXTINCT : (STATUS_BADGE[f.status] || f.status);
      const liveCount = countFamilySkills(role, f.name);
      const skillCount = liveCount != null ? liveCount : (f.skill_count != null ? f.skill_count : '?');
      const countNote = liveCount != null ? '' : dim(' (from registry; SKILLS dir absent)');
      const name = isExtinct ? dim(f.name) : gold(f.name);
      const founded = (typeof f.founded_session === 'number' || /^\d+$/.test(String(f.founded_session)))
        ? `s${f.founded_session}` : f.founded_session;
      console.log(`  ${name}  ${status}`);
      console.log(`     skills: ${skillCount}${countNote}   founded: ${founded}   record: ${green(f.victories + 'W')}/${red(f.failures + 'L')}   vow-breaks: ${f.vow_violations || 0}`);
      if (f.philosophy) console.log(dim(`     "${f.philosophy}"`));
      if ((f.notable_sessions || []).length) console.log(dim(`     notable: ${f.notable_sessions.join(', ')}`));
    }
  }

  // Any extinctions whose role wasn't covered above (e.g. role fully gone).
  if (!extData.__missing && Array.isArray(extData.extinctions) && extData.extinctions.length) {
    const orphans = extData.extinctions.filter((e) => {
      const r = (e.role || '').toLowerCase();
      if (roleFilter && r !== roleFilter) return false;
      const fams = families[r] || [];
      return !fams.some((f) => f.name === e.family);
    });
    if (orphans.length) {
      console.log('');
      console.log(dim('✝ ARCHIVED EXTINCT LINES (skills preserved):'));
      for (const e of orphans) {
        console.log(dim(`  ${(e.role || '').toUpperCase()}/${e.family} — ${e.reason || 'no reason recorded'}`));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// learn
// ---------------------------------------------------------------------------
const CONF_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function cmdLearn(argv) {
  const { flags } = parseArgs(argv);
  const roleFilter = typeof flags.role === 'string' ? flags.role.toLowerCase() : null;

  console.log(banner());
  console.log('');
  console.log(gold('📜 PATTERNS OF THE REALM'));
  console.log('');

  const pdata = readJSON(PATHS.patterns);
  if (pdata.__missing) {
    console.log(missingFileNote(PATHS.patterns));
  } else if (pdata.__error) {
    console.log(red(`⚠ patterns.json malformed: ${pdata.__error}`));
  } else {
    const patterns = [...(pdata.patterns || [])].sort(
      (a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0)
    );
    for (const p of patterns) {
      const conf = p.confidence === 'HIGH' ? green(p.confidence)
        : p.confidence === 'LOW' ? dim(p.confidence) : gold(p.confidence);
      console.log(`  [${conf}] ${p.text}`);
      console.log(dim(`        tags: ${(p.tags || []).join(', ')}${(p.sessions || []).length ? '  · sessions: ' + p.sessions.join(', ') : ''}`));
    }
  }

  const registry = loadRegistry();
  const families = (!registry.__missing && registry.families) ? registry.families : {};

  if (roleFilter) {
    const fams = families[roleFilter] || [];
    console.log('');
    console.log(gold(`🎓 SKILLS OF THE ${roleFilter.toUpperCase()} FAMILIES`));
    if (fams.length === 0) {
      console.log(dim(`  (no families registered for '${roleFilter}')`));
    }
    for (const f of fams) {
      console.log('');
      console.log(`  ${bold(f.name)} [${f.status}]`);
      const skills = listFamilySkills(roleFilter, f.name);
      if (skills.length === 0) {
        console.log(dim('     (no skills on disk)'));
      }
      for (const s of skills) {
        console.log(`     • ${bold(s.name)}`);
        if (s.problem) console.log(dim(`         ${s.problem}`));
      }
    }
  } else {
    console.log('');
    console.log(gold('🎓 SKILL INDEX (all families, one line each)'));
    for (const role of Object.keys(families)) {
      for (const f of families[role]) {
        const skills = listFamilySkills(role, f.name);
        const names = skills.length ? skills.map((s) => s.name).join('; ') : dim('(none on disk)');
        console.log(`  ${pad(role.toUpperCase() + '/' + f.name, 28)} ${names}`);
      }
    }
    console.log('');
    console.log(dim('  (run with --role <role> for the full "Problem This Solves" digest)'));
  }
}

// ---------------------------------------------------------------------------
// petition
// ---------------------------------------------------------------------------
function cmdPetition(argv) {
  const { flags, rest } = parseArgs(argv);
  const agent = rest[0];
  const honor = rest.slice(1).join(' ');
  if (!agent || !honor) {
    console.log('Usage: node kingdom.js petition <AGENT> <HONOR...> [--session N]');
    console.log('Example: node kingdom.js petition SERF "The Perfect Count" --session 117');
    return;
  }
  const session = flags.session !== undefined ? flags.session : 'current';

  ensureDir(PATHS.petitions);
  // Next counter for this agent.
  let counter = 1;
  try {
    const safeAgent = String(agent).replace(/[^A-Za-z0-9]/g, '');
    const existing = fs.readdirSync(PATHS.petitions)
      .filter((f) => new RegExp(`^PETITION_${safeAgent}_\\d+\\.json$`).test(f));
    counter = existing.length + 1;
  } catch { /* fresh dir */ }

  const safeAgent = String(agent).replace(/[^A-Za-z0-9]/g, '');
  const record = {
    agent,
    honor,
    session,
    filed_at: 'session-relative',
    status: 'PENDING_BATMAN_REVIEW',
  };
  const file = path.join(PATHS.petitions, `PETITION_${safeAgent}_${String(counter).padStart(3, '0')}.json`);
  writeJSON(file, record);

  console.log(banner());
  console.log('');
  console.log(green('🪶 PETITION FILED'));
  console.log(`   Agent:   ${bold(agent)}`);
  console.log(`   Honor:   ${bold(honor)}`);
  console.log(`   Session: ${session}`);
  console.log(`   Status:  PENDING_BATMAN_REVIEW`);
  console.log(`   File:    ${path.relative(PATHS.root, file)}`);
  console.log('');
  console.log(dim('   Batman decides. A petition is a request, not a grant.'));
}

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------
async function cmdRecord() {
  if (!process.stdin.isTTY) {
    console.log('node kingdom.js record — interactively appends a session to the chronicle.');
    console.log('Requires an interactive terminal (TTY). Nothing recorded.');
    return; // graceful exit 0
  }
  const data = readJSON(PATHS.sessions);
  if (data.__missing) { console.log(missingFileNote(PATHS.sessions)); return; }
  if (data.__error) { console.log(red(`⚠ sessions.json malformed: ${data.__error}`)); return; }

  const { ask, close } = makeAsker();
  try {
    console.log(banner());
    console.log('');
    console.log(gold('Record a session into the chronicle.'));
    console.log('');
    const session = parseInt((await ask('Session #: ')).trim(), 10);
    const noble = (await ask('Noble (e.g. Duke ClaudeCode XLV): ')).trim();
    const rank = (await ask('Rank: ')).trim().toUpperCase();
    const quest = (await ask('Quest: ')).trim();
    const courtRaw = (await ask('Court (comma-separated, e.g. DETECTIVE/GREYMANTLE): ')).trim();
    const outcome = (await ask('Outcome (VICTORY/DEFEAT/PARTIAL): ')).trim().toUpperCase();
    const medalsRaw = (await ask('Medals (comma-separated, optional): ')).trim();
    const vvRaw = (await ask('Vow violations (semicolon-separated, optional): ')).trim();
    const notes = (await ask('Notes: ')).trim();

    const entry = {
      session,
      noble,
      rank,
      quest,
      court: courtRaw ? courtRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      outcome,
      medals: medalsRaw ? medalsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      vow_violations: vvRaw ? vvRaw.split(';').map((s) => s.trim()).filter(Boolean) : [],
      notes,
    };
    data.sessions = data.sessions || [];
    data.sessions.push(entry);
    writeJSON(PATHS.sessions, data);
    console.log('');
    console.log(green(`📜 Session #${session} recorded into the chronicle.`));
  } finally {
    close();
  }
}

// ---------------------------------------------------------------------------
// new-role
// ---------------------------------------------------------------------------
const ROLE_STUB = (NAME) => `# 🆕 ${NAME} — *tagline to be earned.*

## Philosophy
[What this role believes. Why it exists. The grain it works with.]

## Core Duties
- [Primary duty]
- [Secondary duty]

## Hard Limits
- I **NEVER run git.** The ARMARIUS seals the work into history.
- [Other limits this role must not cross.]

## The Vow
\`\`\`
I, [AGENT NAME] of the [FAMILY] line,
do hereby accept this task upon my honor.
MY CHARGE: [the charge].
MY LIMITS: I will not exceed my role.
MY VOW: I will report true findings, true counts only.
So sworn. 🆕 [AGENT NAME], SEAL: ⚜
\`\`\`

## Voice
**DO say:**
- [exemplary true report]

**DON'T say:**
- [overreach or false claim]

## Reporting Format
\`\`\`
🆕 ${NAME} REPORT
DID: <what was done>
FILES: <file:line anchors>
FINDINGS: <true counts only>
\`\`\`

## Honors I Might Petition For
- [honor] — [for what]

> Roles are TYPES. Families inherit this role and evolve from it.
`;

function cmdNewRole(argv) {
  const { rest } = parseArgs(argv);
  const name = rest[0];
  if (!name) { console.log('Usage: node kingdom.js new-role <NAME>'); return; }
  const NAME = name.toUpperCase();
  const dest = path.join(PATHS.roles, `${NAME}.md`);
  if (fs.existsSync(dest)) {
    console.log(red(`⚠ agents/roles/${NAME}.md already exists — refusing to overwrite.`));
    return;
  }

  // Scaffold from template if present, else from the stub.
  let content;
  const tmpl = readTextSafe(PATHS.roleTemplate);
  if (tmpl != null) {
    // Substitute common placeholders for the role name.
    content = tmpl
      .replace(/\[ROLE_NAME\]/g, NAME)
      .replace(/\[ROLE NAME\]/g, NAME)
      .replace(/\{\{NAME\}\}/g, NAME)
      .replace(/\bROLE_TEMPLATE\b/g, NAME);
  } else {
    content = ROLE_STUB(NAME);
  }
  ensureDir(PATHS.roles);
  fs.writeFileSync(dest, content, 'utf8');

  // Append to REGISTRY.json roles[].
  const registry = loadRegistry();
  let registered = false;
  if (!registry.__missing && !registry.__error) {
    registry.roles = registry.roles || [];
    if (!registry.roles.some((r) => r.name.toUpperCase() === NAME)) {
      registry.roles.push({
        name: NAME,
        emoji: '🆕',
        tagline: 'A new role, tagline to be earned.',
        file: `roles/${NAME}.md`,
      });
      writeJSON(PATHS.registry, registry);
      registered = true;
    }
  }

  console.log(banner());
  console.log('');
  console.log(green(`🆕 Role scaffolded: agents/roles/${NAME}.md ${tmpl != null ? '(from template)' : '(from stub)'}`));
  console.log(registered ? green('   Appended to REGISTRY.json roles[].') : dim('   Registry not updated (missing/already present).'));
}

// ---------------------------------------------------------------------------
// new-family
// ---------------------------------------------------------------------------
const LINEAGE_STUB = (role, FAMILY) => `# THE ${FAMILY} ${role.toUpperCase()} LINE

## Founding
Founded this session. A new ${role.toUpperCase()} lineage takes up the role and swears to
diverge from its forebears not in duty but in method. [The founding deed goes here once done.]

## Philosophy
[How this family does the ${role.toUpperCase()} work differently. Its one sentence.]

## Learning Strategy
[How this family reads, decides, and accumulates skill.]

## Track Record
- Sessions served: 0
- Victories attributed: 0
- Failures attributed: 0
- Vow violations: 0
- Status: ACTIVE

## Notable Sessions
- (none yet — this line is newly founded)

## Skills Mastered
- \`first_skill.md\` — [the starter skill, to be proven]

## Known Weaknesses
[Unknown — this line has not yet been tested.]
`;

const SKILL_STUB = (FAMILY) => `# SKILL: FIRST SKILL OF ${FAMILY}

## Problem This Solves
[The recurring failure this skill prevents. State the bug it kills before it is born.]

## The Technique
1. [Step one.]
2. [Step two.]

## Evidence
- (none yet — this skill is newly minted and unproven)

## Notes
[When NOT to apply this skill.]
`;

function cmdNewFamily(argv) {
  const { rest } = parseArgs(argv);
  const role = rest[0];
  const family = rest[1];
  if (!role || !family) {
    console.log('Usage: node kingdom.js new-family <ROLE> <FAMILYNAME>');
    return;
  }
  const roleKey = role.toLowerCase();
  const FAMILY = family.toUpperCase();
  const famDir = gen.familyDir(roleKey, FAMILY);
  if (fs.existsSync(famDir)) {
    console.log(red(`⚠ agents/families/${roleKey}/${FAMILY} already exists — refusing to overwrite.`));
    return;
  }
  const skillsDir = path.join(famDir, 'SKILLS');
  ensureDir(skillsDir);
  fs.writeFileSync(path.join(famDir, 'LINEAGE.md'), LINEAGE_STUB(roleKey, FAMILY), 'utf8');
  fs.writeFileSync(path.join(skillsDir, 'first_skill.md'), SKILL_STUB(FAMILY), 'utf8');

  // Append to REGISTRY.families[roleKey].
  const registry = loadRegistry();
  let registered = false;
  if (!registry.__missing && !registry.__error) {
    registry.families = registry.families || {};
    if (!Array.isArray(registry.families[roleKey])) registry.families[roleKey] = [];
    if (!registry.families[roleKey].some((f) => f.name === FAMILY)) {
      registry.families[roleKey].push({
        name: FAMILY,
        status: 'ACTIVE',
        founded_session: 'this session',
        philosophy: 'Newly founded. Philosophy to be proven by deed.',
        skill_count: 1,
        sessions_served: 0,
        victories: 0,
        failures: 0,
        vow_violations: 0,
        bad_faith_flag: false,
        notable_sessions: [],
      });
      writeJSON(PATHS.registry, registry);
      registered = true;
    }
  }

  console.log(banner());
  console.log('');
  console.log(green(`🌱 Family founded: agents/families/${roleKey}/${FAMILY}/`));
  console.log(green('   LINEAGE.md + SKILLS/first_skill.md created.'));
  console.log(registered ? green(`   Appended to REGISTRY.families.${roleKey}[].`) : dim('   Registry not updated (missing/already present).'));
}

// ---------------------------------------------------------------------------
// extinct
// ---------------------------------------------------------------------------
function cmdExtinct(argv) {
  const { flags, rest } = parseArgs(argv);
  const role = rest[0];
  const family = rest[1];
  if (!role || !family) {
    console.log('Usage: node kingdom.js extinct <ROLE> <FAMILY> [--reason "text"]');
    return;
  }
  const roleKey = role.toLowerCase();
  const FAMILY = family.toUpperCase();
  const reason = typeof flags.reason === 'string' ? flags.reason : 'No reason recorded.';

  const registry = loadRegistry();
  if (registry.__missing) { console.log(missingFileNote(PATHS.registry)); return; }
  if (registry.__error) { console.log(red(`⚠ REGISTRY.json malformed: ${registry.__error}`)); return; }

  const fams = (registry.families && registry.families[roleKey]) || [];
  const famRec = fams.find((f) => f.name === FAMILY);
  if (!famRec) {
    console.log(red(`⚠ No family '${FAMILY}' registered under role '${roleKey}'.`));
    return;
  }

  // Archive lineage + skills.
  const lineageText = readLineage(roleKey, FAMILY) || '(no LINEAGE.md found)';
  const skills = listFamilySkills(roleKey, FAMILY).map((s) => s.file);

  const extData0 = readJSON(PATHS.extinctions);
  const extData = extData0.__missing
    ? { schema_version: 1, extinctions: [] }
    : extData0;
  extData.extinctions = extData.extinctions || [];
  extData.extinctions.push({
    role: roleKey,
    family: FAMILY,
    reason,
    declared_by: 'Orchestrator',
    session: 'current',
    archived_lineage: lineageText,
    archived_skills: skills,
    final_record: {
      founded_session: famRec.founded_session,
      sessions_served: famRec.sessions_served,
      victories: famRec.victories,
      failures: famRec.failures,
      vow_violations: famRec.vow_violations,
    },
  });
  writeJSON(PATHS.extinctions, extData);

  // Flip status in registry (do NOT delete the folder — skills preserved).
  famRec.status = 'EXTINCT';
  writeJSON(PATHS.registry, registry);

  console.log(banner());
  console.log('');
  console.log(red(`✝ ${roleKey.toUpperCase()}/${FAMILY} declared EXTINCT.`));
  console.log(`   Reason: ${reason}`);
  console.log(green(`   ${skills.length} skill(s) archived to history/extinctions.json (folder preserved for inheritance).`));
  console.log(dim('   Status set to EXTINCT in REGISTRY.json. The line\'s skills may be inherited by a new founding family.'));
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const cmd = (argv[0] || 'help').toLowerCase();
  const rest = argv.slice(1);

  try {
    switch (cmd) {
      case 'summon': await cmdSummon(rest); break;
      case 'history': cmdHistory(); break;
      case 'medals': cmdMedals(); break;
      case 'families': cmdFamilies(rest); break;
      case 'learn': cmdLearn(rest); break;
      case 'petition': cmdPetition(rest); break;
      case 'record': await cmdRecord(); break;
      case 'new-role': cmdNewRole(rest); break;
      case 'new-family': cmdNewFamily(rest); break;
      case 'extinct': cmdExtinct(rest); break;
      case 'help':
      case '--help':
      case '-h':
      default:
        if (cmd !== 'help' && cmd !== '--help' && cmd !== '-h' && cmd) {
          console.log(red(`Unknown command: ${cmd}\n`));
        }
        cmdHelp();
        break;
    }
  } catch (err) {
    console.error(red(`\n⚠ The steward stumbled while running '${cmd}':`));
    console.error(red(`   ${err.message}`));
    if (process.env.KINGDOM_DEBUG) console.error(err.stack);
    process.exitCode = 1;
  }
}

main();
