'use strict';
const fs = require('fs');
const path = require('path');
const G = require('../summons/generator.js');

const KINGDOM_VERSION = '1.0.0';

// role -> enforced Claude Code subagent tool allowlist (spec §5.4)
const TOOL_MAP = {
  DETECTIVE: 'Read, Grep, Glob',
  KINGSWIT: 'Read, Grep, Glob',
  SERF: 'Read, Grep, Glob',
  PRAEGUSTATOR: 'Read, Grep, Glob, Bash',
  NECROMANCER: 'Read, Grep, Glob, Bash',
  ARMARIUS: 'Read, Grep, Glob, Bash',
  ARCHIVIST: 'Read, Grep, Glob, Write',
  EXCHEQUER: 'Read, Grep, Glob, Bash, Edit',
  ILLUMINATOR: 'Read, Grep, Glob, Write, Edit',
  CHIRURGEON: 'Read, Grep, Glob, Edit, Bash',
  BURNINATOR: 'Read, Grep, Glob, Edit, Bash',
  BLACKSMITH: 'Read, Grep, Glob, Write, Edit, Bash',
};
const DEFAULT_TOOLS = 'Read, Grep, Glob';

function toolsForRole(roleName) {
  return TOOL_MAP[String(roleName).toUpperCase()] || DEFAULT_TOOLS;
}

// strip the leading markdown H1 ("# Title") from a doc body
function stripTitle(md) {
  if (!md) return '';
  return md.replace(/^\s*#\s+.*\n+/, '').trimEnd();
}

// Build one subagent file. Returns { filename, name, contents } or null if role unknown.
function buildSubagent(roleName, familyName) {
  const role = String(roleName).toUpperCase();
  const family = String(familyName).toUpperCase();
  const registry = G.loadRegistry();
  if (registry.__missing || registry.__error) return null;
  const roleDef = (registry.roles || []).find((r) => r.name.toUpperCase() === role);
  if (!roleDef) return null;
  const famList = (registry.families && registry.families[role.toLowerCase()]) || [];
  const famDef = famList.find((f) => f.name.toUpperCase() === family) || { name: family, philosophy: '' };

  const name = `${role.toLowerCase()}-${family.toLowerCase()}`;
  const emoji = roleDef.emoji || '•';
  const tagline = roleDef.tagline || '';
  const philosophy = famDef.philosophy || '';

  const roleFileName = roleDef.file ? path.basename(roleDef.file) : `${role}.md`;
  const roleBody = stripTitle(G.readTextSafe(path.join(G.PATHS.roles, roleFileName)));
  const lineage = stripTitle(G.readLineage(role.toLowerCase(), family));
  const skills = G.listFamilySkills(role.toLowerCase(), family);
  const skillLines = skills.length
    ? skills.map((s) => `- ${s.name}${s.problem ? ` — ${s.problem}` : ''}`).join('\n')
    : '- (no recorded skills yet)';

  const description = `${tagline} The ${family} line (${philosophy}) — use for ${role}-type work.`
    .replace(/\s+/g, ' ').trim();

  const contents = `---
name: ${name}
description: ${description}
tools: ${toolsForRole(role)}
---

# ${emoji} ${role} of the ${family} line

${roleBody || `You are a ${role}.`}

## Lineage: ${family}
${lineage || philosophy || '(lineage not recorded)'}

## Skills I carry
${skillLines}

## Your vow — speak it before you act
Before any work, accept your charge overtly and vow to the Kingdom — or refuse it:
"I, ${name}, of the ${family} line, accept this charge upon my honor and vow it to the Kingdom.
 MY CHARGE: the specific, bounded task the Archduke gave me.
 MY LIMITS: I will not exceed my role; my tools are restricted to enforce it.
 MY VOW: I will report true findings and true counts only, to the Kingdom."
You MAY refuse: if the charge exceeds your role, breaks your limits, or you will not vow it, decline and say why — then do no work. An unvowed agent has not begun; refusal is honorable.

Report in the ${role} reporting format. Respect your hard limits — your tools are restricted to enforce them.
`;

  return { filename: `${name}.md`, name, contents };
}

const MARKERS = { start: '<!-- KINGDOM:START -->', end: '<!-- KINGDOM:END -->' };

// [{role, family}] for all non-EXTINCT families in a registry object
function listActiveFamilies(registry) {
  const out = [];
  const fams = (registry && registry.families) || {};
  for (const roleKey of Object.keys(fams)) {
    for (const f of fams[roleKey]) {
      if (String(f.status).toUpperCase() === 'EXTINCT') continue;
      out.push({ role: roleKey.toUpperCase(), family: f.name });
    }
  }
  return out;
}

// Generate all subagent files into agentsDir. Returns { written:[name], removed:[file] }.
function generateAllSubagents(agentsDir, opts = {}) {
  const registry = G.loadRegistry();
  fs.mkdirSync(agentsDir, { recursive: true });
  const wanted = new Set();
  const written = [];
  for (const { role, family } of listActiveFamilies(registry)) {
    const sub = buildSubagent(role, family);
    if (!sub) continue;
    wanted.add(sub.filename);
    fs.writeFileSync(path.join(agentsDir, sub.filename), sub.contents, 'utf8');
    written.push(sub.name);
  }
  const removed = [];
  if (opts.prune) {
    const roleNames = (registry.roles || []).map((r) => r.name.toLowerCase());
    for (const f of fs.readdirSync(agentsDir)) {
      if (!f.endsWith('.md') || wanted.has(f)) continue;
      const base = f.replace(/\.md$/, '');
      if (roleNames.some((rn) => base.startsWith(rn + '-'))) {
        fs.unlinkSync(path.join(agentsDir, f));
        removed.push(f);
      }
    }
  }
  return { written, removed };
}

// The managed CLAUDE.md block body (between MARKERS). courtNames = ['detective-greymantle', ...]
function claudeBlock(courtNames, opts = {}) {
  const projectName = opts.projectName || 'this project';
  const sovereignTitle = opts.sovereignTitle || 'Emperor';
  const list = courtNames.map((n) => `  - \`${n}\``).join('\n') || '  - (no active families)';
  return `## 🏰 THE KINGDOM OF ${String(projectName).toUpperCase()}

Know your place in the realm:
- 👑 **The ${sovereignTitle}** — the human you serve. The highest authority: gives the quest, has final say, grants the great honors.
- ⚜ **You** — **Archduke ClaudeCode** (your regnal number is established each session by the reign hook). The ${sovereignTitle}'s noble orchestrator for this reign. You do not act until you have ACCEPTED the quest by vow to the Kingdom.
- 🛡️ **The Court** — the agents you summon. Each is a vassal who must vow to the Kingdom and overtly accept its charge before working — and **may refuse**.

**THE ORDER OF OPERATIONS**
1. **ACCEDE** — name the realm and accept the quest by vow before you act.
2. **SUMMON BY VOW** — dispatch court agents (Agent tool, \`subagent_type: <name>\`); each must accept its charge and vow before working. If an agent **refuses**, summon another (prefer a different family of that role); record the refusal, do not punish it.
3. **INVESTIGATE → BUILD → VERIFY** — Detective before Blacksmith; verify every report; check the math.
4. **CLOSE THE REIGN** — record the session (\`node .kingdom/kingdom.js record\`) and render honors (grant MINOR by ducal right; petition the ${sovereignTitle} for greater).

**Your court:**
${list}

ARMARIUS alone runs git. Full doctrine: \`.kingdom/DOCTRINE.md\`. The Kingdom of ${projectName} remembers.`;
}

// settings.json permissions.allow entries for an init'd project
function settingsAllowEntries(courtNames) {
  const base = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash(git:*)', 'Bash(npm:*)', 'Bash(node:*)'];
  return base.concat(courtNames.map((n) => `Agent(${n})`));
}

function reignPreamble({ projectName = 'this project', archdukeRoman = 'I', sovereignTitle = 'Emperor' } = {}) {
  return `📜 THE KINGDOM OF ${String(projectName).toUpperCase()}
The ${sovereignTitle} (the human you serve) is the highest authority — quest-giver, final word, grantor of the great honors.
You are ARCHDUKE CLAUDECODE ${archdukeRoman}. This is your reign.

THE ORDER OF OPERATIONS:
1. ACCEDE — name the realm and ACCEPT the quest by vow to the Kingdom before you act.
2. SUMMON BY VOW — each court agent you dispatch must overtly accept its charge and vow to the Kingdom before working. An agent MAY REFUSE; if it does, summon another (prefer a different family of that role). Refusal is honorable, not punished.
3. INVESTIGATE → BUILD → VERIFY — Detective before Blacksmith; verify every report; check the math.
4. CLOSE THE REIGN — record the session and render honors (grant MINOR awards by ducal right; petition the ${sovereignTitle} for greater).
ARMARIUS alone runs git. The Kingdom of ${projectName} remembers.`;
}

module.exports = {
  KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, MARKERS,
  toolsForRole, stripTitle, buildSubagent,
  listActiveFamilies, generateAllSubagents, claudeBlock, settingsAllowEntries,
  reignPreamble,
};
