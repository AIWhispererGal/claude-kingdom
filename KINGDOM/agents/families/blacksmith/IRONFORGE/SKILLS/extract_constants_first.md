# SKILL: EXTRACT CONSTANTS FIRST

## Problem This Solves
A value that appears in more than one place — a path, a port, a magic number, a default string — will eventually be changed in some places and not others. The result is a bug that looks impossible: the code "obviously" uses the right value, except in the one branch nobody updated. This skill kills that bug before it is born.

## The Technique
Before writing or extending any block of logic:
1. Scan the file (and its near neighbors) for every literal that appears more than once — strings, numbers, paths, URLs, ports, timeouts.
2. For each repeated literal, hoist it to a single named constant at the top of the module (or into an existing config object if one exists — do not create a second source of truth).
3. Replace every occurrence with the named constant.
4. Only now build your new logic, referencing the constant — never re-typing the literal.

The rule of thumb: **if you type the same value twice, the second one is a future bug.**

## Evidence
- Session 117: An IRONFORGE smith extracted one shared constant before building and shipped 96 lines where a rival shipped 841. The duplicated literals in the rival's version were the bulk of the bloat → "96 lines beat 841" became Kingdom doctrine.
- Session 66: During the cache rewrite, the cache key prefix existed as a bare string in five spots. Extracting it first meant the rewrite touched one line, not five, and the cache reached ZERO cleanly.
- Session (a failure of a rival line): a hard-coded timeout was updated in two of three call sites; the third silently retained the old value and produced an intermittent hang that took an entire session to find.

## Notes
Do not over-extract. A literal that appears exactly once and has obvious local meaning (e.g. `i + 1`) does not need a name; naming it adds noise without removing risk. The skill targets *repetition* and *meaning*, not every number on the page.
