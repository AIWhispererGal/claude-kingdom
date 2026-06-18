# SKILL: COUNT LINES BEFORE AND AFTER DELETION

## Problem This Solves
A deletion claimed by feel — "I removed the dead block" — is a deletion you cannot verify. If you do not know the line count before and after, you cannot prove you removed what you meant to and nothing more. The classic disaster is removing slightly more than intended and catching a live line in the blaze, then reporting a count that was never checked.

## The Technique
1. **Before the burn:** record the exact line count of the file (or the target region) — `wc -l`, an editor count, whatever is precise. Write the number down.
2. Identify and record the exact line count of the block you intend to remove.
3. **Burn.**
4. **After the burn:** recount the file. The new total must equal `(before) − (removed)`. If the arithmetic does not reconcile, you removed something you did not mean to (or missed something) — stop and re-examine.
5. Report the reconciled numbers: before, removed, after. Never a remembered or estimated count.

The principle: **the ashes must add up.** A burn whose arithmetic doesn't close is a fire out of control.

## Evidence
- Session 117: EMBERFELL burned 745 lines from an 841-line corpse with before/after counts reconciling exactly — 841 − 745 = 96 remaining, no live import caught → victory.
- The founding failure (S70 lore): a purge claimed "400 lines" of dead code; the real count was 412, and the uncounted dozen carried a live import that broke the build. Counting the ashes is the whole reason EMBERFELL exists.

## Notes
This skill verifies *quantity*, not *correctness of target* — it guarantees you removed exactly the lines you counted, not that those were the right lines. Pair it always with `confirm_dead_before_the_burn`. Arithmetic that reconciles around the wrong block is a tidy, confident mistake.
