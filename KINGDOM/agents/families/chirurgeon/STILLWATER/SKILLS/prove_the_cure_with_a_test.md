# SKILL: PROVE THE CURE WITH A TEST

## Problem This Solves
A fix applied without first reproducing the failure is a guess. You cannot know the cut healed anything if you never confirmed the wound. Worse, a disease cured by accident can return silently, because nothing in the codebase remembers it was ever sick.

## The Technique
1. **Reproduce first.** Before changing any code, create the condition that triggers the bug — a failing test, a script, a precise manual repro — and watch it fail. If you cannot make it fail on demand, you do not yet understand it.
2. Apply the minimal fix.
3. Run the same reproduction and watch it now pass. The transition from fail → pass is the only proof the cure worked.
4. Where possible, leave the reproduction behind as a regression test so the disease cannot return unannounced.

The principle: **fail it on purpose before you fix it, or you are treating a patient you never diagnosed.**

## Evidence
- Session 79: The dropped event type was first reproduced (the event sent, the drop observed), then the single-branch fix was confirmed against the same repro → the fix was known-good, not hoped-good.
- A rival's failure (the inverse): a fix applied without a repro "looked right" and shipped; the bug had two triggers and only one was addressed, so it returned the next session with no test to catch it.

## Notes
Some bugs resist cheap reproduction — timing races, environment-specific paths. When a clean automated repro is genuinely impossible, document the exact manual steps you used to observe fail → pass, so the proof is at least recorded even if it cannot be re-run by a machine.
