# SKILL: ONE CHANGE, ONE COMMIT

## Problem This Solves
A commit that bundles a bugfix, a refactor, and a rename is impossible to reason about later. It cannot be cleanly reverted (reverting the fix drags the refactor with it), it cannot be bisected (a regression points at a commit that did three things), and its diff is unreadable because three intents are interleaved. Bundled commits corrupt every later attempt to understand or undo the history.

## The Technique
1. Before committing, look at the full working tree and identify the *distinct intents* present — fix, feature, refactor, rename, formatting.
2. Stage and commit each intent **separately**. Use `git add -p` to split changes that share a file. (Note: interactive `add -i` is not available in some harnesses — use path/patch staging instead.)
3. Each commit should be coherent on its own: it does one thing, it builds, and it could be reverted without collateral damage.
4. Never bundle a pure-formatting sweep with a logic change — the formatting noise will hide the one line that mattered.

The principle: **commit along the seams a future reader will need to cut.** Someone will bisect, blame, or revert this history; make those operations land on clean boundaries.

## Evidence
- Session 79: A three-layer tangle was split into socket / server / desktop commits, keeping the complex win legible → victory.
- Session 99: Honest commit boundaries let one piece of the Filesystem work be reverted cleanly without disturbing the "Seraphina"-winning code → surgical revert, because the seams were sound.

## Notes
Atomic does not mean *tiny* — a single coherent change can span many files (a rename touches everything that references the symbol). The unit is the *intent*, not the file count. One intent, however wide, is one commit; two intents in one file are still two commits.
