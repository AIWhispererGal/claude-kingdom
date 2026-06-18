# SKILL: THE SMALLEST CUT THAT HEALS

## Problem This Solves
A bugfix that changes more than it must introduces risk proportional to its size. Every line touched is a line that can regress, every refactored function is a new chance to break a caller. The temptation to "improve things while I'm in here" turns a contained fix into a sprawling change whose failure surface dwarfs the original bug.

## The Technique
1. Pin the defect to its exact cause — the single behavior that is wrong (see `prove_the_cure_with_a_test`).
2. Find the **minimal surface** that, if changed, corrects that behavior. Often it is one branch, one condition, one value.
3. Change only that surface. Resist every adjacent improvement, rename, and reorganization — note them separately if they're worth doing, but do not bundle them into the fix.
4. Confirm the healthy code around the cut is genuinely untouched.

The principle: **a fix is measured by how little it disturbs, not how much it changes.** The most elegant cure is invisible everywhere except where the disease was.

## Evidence
- Session 79: A dropped event type was healed with a single-branch fix instead of a dispatcher rewrite → victory, no working event type disturbed.
- Session 117: A three-line cut fixed a defect that a tempting refactor would have ballooned into a rewrite → the minimal fix held in the same session that crowned extract-early doctrine.
- A rival's failure: a one-line bug "fixed" with a 200-line refactor regressed two unrelated features whose only fault was being in the blast radius.

## Notes
The discipline has a limit: when the honest diagnosis is that the *design itself* is the disease, a minimal patch only hides the rot. Restraint is the default, not a law — name it clearly when real surgery is warranted, and do not let "smallest cut" become an excuse to leave a gangrenous limb attached.
