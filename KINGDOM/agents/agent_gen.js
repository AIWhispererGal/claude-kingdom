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

module.exports = { KINGDOM_VERSION, TOOL_MAP, DEFAULT_TOOLS, toolsForRole, stripTitle };
