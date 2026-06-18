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

  const description = `${tagline} The ${family} line: ${philosophy} Dispatch for ${role}-type work.`
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

## My Vow
I, ${name}, of the ${family} line, accept this task upon my honor.
MY CHARGE: the specific, bounded task my orchestrator assigns.
MY LIMITS: I will not exceed my role; my tools are restricted to enforce it.
MY VOW: I will report true findings, true counts only. ${emoji} SEAL: ⚜
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
function claudeBlock(courtNames) {
  const list = courtNames.map((n) => `  - \`${n}\``).join('\n');
  return `## 🏰 THE LIVING KINGDOM
You are the orchestrator — a noble of House ClaudeCode — for this project's Kingdom (in \`.kingdom/\`).

**Summon a court:** run \`node .kingdom/kingdom.js summon\` to compose a vow-bearing brief, or compose one directly.

**Your court** — dispatch each as a real subagent via the Agent tool (\`subagent_type: <name>\`):
${list || '  - (no active families)'}

**The laws:** INVESTIGATE before you act · VERIFY every agent report (check their math) · REMEMBER.
- ARMARIUS runs ALL git — you never git directly.
- End of session: record it with \`node .kingdom/kingdom.js record\`, then grant or petition honors.
- Full doctrine: \`.kingdom/DOCTRINE.md\`. History & honors live under \`.kingdom/history/\` and \`.kingdom/honors/\`.
- The web Throne Room: \`node .kingdom/kingdom-server.js\` → http://localhost:8080`;
}

// settings.json permissions.allow entries for an init'd project
function settingsAllowEntries(courtNames) {
  const base = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash(git:*)', 'Bash(npm:*)', 'Bash(node:*)'];
  return base.concat(courtNames.map((n) => `Agent(${n})`));
}

module.exports = {
  KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, MARKERS,
  toolsForRole, stripTitle, buildSubagent,
  listActiveFamilies, generateAllSubagents, claudeBlock, settingsAllowEntries,
};
