# SKILL: RESURRECT BEFORE YOU REWRITE

## Problem This Solves
A problem that seems newly discovered has often been solved before — and the solution reverted, abandoned on a branch, or replaced. Rewriting from scratch re-walks every dead end the previous smith already mapped, and may re-introduce exactly the bug their revert was escaping.

## The Technique
Before rebuilding a feature or re-solving a tricky problem:
1. Search history for prior attempts: `git log --all --oneline` filtered by the relevant file or keyword, and check for reverted commits (`git log --grep=revert`) and stale branches.
2. If a prior solution exists, read *why it was undone.* A revert with a reason ("caused regression in W") is a free map of the trap ahead.
3. Recover the parts that worked from the old attempt rather than re-deriving them. Avoid the part that caused the revert.
4. Build forward from what the dead already learned, not from zero.

The principle: **the cheapest research is the work someone already did and recorded.**

## Evidence
- Session 66: ASHWOOD's founding lesson — the past held the answer the present could not see. The line was built on the conviction that history is a resource, not noise.
- A rival's failure: a feature rebuilt from scratch re-introduced a bug that a six-commit-old revert had explicitly fixed; the revert message named the exact cause the rewrite re-created.

## Notes
If the repository history is squashed, shallow, or freshly initialized, this skill has nothing to raise — recognize that quickly and switch to forward investigation rather than excavating an empty grave. ASHWOOD's power is proportional to the depth of the history it is given.
