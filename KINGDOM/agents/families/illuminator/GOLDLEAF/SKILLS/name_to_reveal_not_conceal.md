# SKILL: NAME TO REVEAL, NOT CONCEAL

## Problem This Solves
A bad name is a small lie the reader believes on every line. `data`, `tmp`, `handle`, `x2`, `doStuff` — each conceals what the thing is for and forces the reader to reconstruct the meaning from usage, every time. Cryptic names are the most pervasive form of unreadable code, and the cheapest to fix, because the meaning is usually already known to the author and simply unspoken.

## The Technique
1. For every name you write or touch, ask: **does this tell a stranger what the thing is for?** If they'd have to read the implementation to know, the name has failed.
2. Prefer names that state **purpose or content**, not type or mechanics: `unsentMessages` over `arr2`, `isExpired` over `flag`, `resolveAbsolutePath` over `doPath`.
3. Let a good name **replace a comment**: if you find yourself writing `// the list of users who haven't paid`, name the variable `unpaidUsers` and delete the comment.
4. When renaming for clarity, do it as its own change (hand to VELLUMGUARD's `one_change_one_commit`) so the rename's diff isn't tangled with logic.

The principle: **the best documentation is a name that makes the comment unnecessary.**

## Evidence
- Session 99: Naming the filesystem module's obscure paths was half of what made it usable — readers understood the code without decoding it → contributed to the "Seraphina" win being *built upon* rather than rediscovered.
- A rival's failure: a function named `process()` that actually validated-and-normalized input was repeatedly misused by callers who trusted the vague name and skipped their own validation.

## Notes
Renaming is not free — it touches every reference and can collide with the smallest-cut discipline. When the name is genuinely misleading, the rename earns its blast radius; when it is merely *terse but clear in context*, leave it. Reveal, don't redecorate.
