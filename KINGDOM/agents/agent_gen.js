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

module.exports = { KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, toolsForRole, stripTitle, buildSubagent };
