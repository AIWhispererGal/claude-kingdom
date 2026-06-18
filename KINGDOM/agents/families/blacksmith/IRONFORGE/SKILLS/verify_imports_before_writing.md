# SKILL: VERIFY IMPORTS BEFORE WRITING

## Problem This Solves
New code that calls a function, references a class, or uses a constant assumes that symbol exists, is spelled correctly, and is importable from where you think it lives. When any of those assumptions is wrong, the failure surfaces at runtime — often deep in a code path that only triggers under specific conditions — long after the build "looked done."

## The Technique
Before writing code that depends on an external symbol:
1. For every import or reference you intend to use, open the source module and confirm the symbol is actually exported and spelled exactly as you'll call it.
2. Confirm the import path resolves — no assumed package layout, no guessed sub-module.
3. Check for circular dependencies: if module A will import from B, confirm B does not already import from A. A cycle that compiles today can crash the moment load order shifts.
4. Note the symbol's real signature (arity, argument order, return shape) — not the one you remember.

Only after the dependency map is confirmed real does the new code get written.

## Evidence
- Session 99 (Filesystem campaign): IRONFORGE verified every import path across the new module before writing and caught a circular dependency that would have crashed the build. The clean foundation it laid was part of the work that won the True Name "Seraphina."
- Session 66: Verifying the cache module's real exports before the rewrite revealed two callers depending on undocumented behavior; both were handled in the same pass instead of breaking in production.
- A rival's failure: code written against a remembered function signature (wrong argument order) passed review by eye and failed only when that branch ran live.

## Notes
This skill is cheapest at the start and most expensive to skip. The temptation to "just write it, the import is obviously fine" is exactly where the cycle and the typo hide. Verify the boring ones too.
