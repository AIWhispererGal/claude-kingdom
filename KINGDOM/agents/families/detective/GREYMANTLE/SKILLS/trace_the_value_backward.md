# SKILL: TRACE THE VALUE BACKWARD

## Problem This Solves
When an output is wrong, the instinct is to fix it where it appears. But the wrong value rarely originates where it is displayed — it was already wrong by the time it arrived. Patching at the point of display masks the corruption upstream and creates a second place where the value can diverge.

## The Technique
Start at the symptom and walk *against* the flow of data:
1. Identify the exact wrong value at the point you observe it.
2. Find where that value was assigned or passed in just before. Is it already wrong here?
3. If yes, step back again — to whatever produced it. Keep walking upstream.
4. Stop at the first point where the value was *correct on the way in and wrong on the way out.* That transition is the bug. Fix it there.

You are looking for the single edge in the data's journey where right becomes wrong. Everything downstream of that edge is a symptom, not a cause.

## Evidence
- Session 99: A path correct in tests and wrong in the field was traced backward through caller and resolver to an assumed working directory — the one transition where the value went wrong → one-line fix, contributed to the "Seraphina" win.
- Session 75: The rendering bug's wrong value was traced two layers upstream to the state feed, where the corruption actually occurred → fix held permanently instead of needing repeated patching.

## Notes
If tracing backward leads you out of the codebase (to an environment variable, a remote response, a user input), the bug may be a missing validation at the boundary rather than a logic error inside. That is still a valid stopping point — the edge is simply the moment untrusted data was admitted without a check.
