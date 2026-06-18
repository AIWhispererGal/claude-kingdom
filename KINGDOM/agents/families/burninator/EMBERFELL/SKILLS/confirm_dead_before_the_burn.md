# SKILL: CONFIRM DEAD BEFORE THE BURN

## Problem This Solves
"Dead code" that is merely *quiet* code will take a live feature down with it when burned. A function with no obvious callers may be reached by a dynamic dispatch, a string-keyed lookup, a reflection call, a test, or an external consumer the grep didn't see. Burning on the assumption of death, rather than the proof of it, is how a cleanup becomes an outage.

## The Technique
Before the torch touches anything:
1. **Grep for every name** of the target — function, class, constant, file — across the entire codebase, including tests, configs, and templates.
2. **Hunt the indirect callers:** string-based dispatch, reflection, dynamic imports, route tables, registries keyed by name. These do not show up in a naive symbol search.
3. **Check external surface:** is this exported, public API, or consumed by something outside the repo? Dead-internally is not dead-externally.
4. **Consult the history** (hand off to ASHWOOD's `git_blame_before_you_blame` when in doubt) — a recent commit may have added the only caller.
5. Only when every avenue comes back empty is the target confirmed dead and cleared for the burn.

The principle: **prove the silence, don't assume it.**

## Evidence
- Session 117: Each of the 841-line corpse's blocks was confirmed dead — no callers, no dynamic references — before EMBERFELL burned, so 745 lines fell with nothing live caught → victory.
- The founding failure (S70 lore): a block "obviously" dead by eye held a live import reached indirectly; burning it without the confirm step broke the build and founded the family's caution.

## Notes
Dynamic and string-keyed references are the silent killers — a plain symbol search will swear the code is dead when a route table three directories away still names it. When the language allows reflection or string dispatch, raise your suspicion accordingly and search by the *string*, not just the symbol.
