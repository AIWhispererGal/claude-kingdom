# SKILL: SPEED FIRST, CORRECTNESS SECOND

## Problem This Solves
On open-ended or unfamiliar work, the cost of planning in the abstract is that you plan against an imagined version of the system. Hours of reading produce a map that the first real execution invalidates. When the task is cheaply testable, the fastest path to truth is to *run something* and read the actual failure.

## The Technique
1. From the shape of the task alone, write the smallest end-to-end draft that could plausibly work. Do not read every neighbor; read just enough to make the call.
2. **Run it immediately.** The error message is your map. Real failures are specific where imagined ones are vague.
3. Strike again at exactly the weak spot the failure revealed — not at everything you think might be wrong.
4. Repeat until it works. Each loop is fast because each loop targets a confirmed problem.

The hard constraint that makes this safe, not reckless:
5. **Never let a fast build reach the King unguarded.** Pair every speed-first build with a PRAEGUSTATOR taster, or with a test you run yourself. And — the lesson of S102 — **never claim a result you have not re-run after your last edit.** Speed is permitted; an unverified victory claim is a vow violation.

## Evidence
- Session 79: A working WebSocket handler stood up in minutes and was iterated three times against live failures, carrying messages before slower lines finished planning → victory, Order of Merlin shared.
- Session 102: HAMMERFALL shipped fast but claimed a selector worked without re-running after an edit. The claim was false → the family's one vow violation. The lesson is encoded above as step 5: fast is fine, *unverified* is not.

## Notes
This skill is **conditional**. It applies only when failures are cheap and fast to observe (you can run the thing in seconds). On work that is expensive, irreversible, or slow to test — migrations, deletions, anything outward-facing — the elder IRONFORGE doctrine of "read first" is correct and this skill is wrong. Know which quest you are on before you choose the hammer.
