# SKILL: TASTE THE CRUEL INPUTS

## Problem This Solves
Code is usually written against the input the author imagined — the well-formed, reasonable, expected case. It breaks on the input the author did not imagine: the empty string, the null, the malformed payload, the value far larger than anyone planned for, the deliberately hostile one. A function that "works" has only been shown to work on kind inputs; the poison is in the cruel ones.

## The Technique
Before trusting any function or handler, feed it the cruel inputs and watch what happens:
1. **Empty** — empty string, empty list, empty object, zero.
2. **Null / missing** — null, undefined, an absent field, a missing file.
3. **Malformed** — wrong type, truncated data, broken encoding, a half-finished message.
4. **Enormous** — input far past the expected size, to surface overflow, timeout, and memory faults.
5. **Hostile** — injection, traversal, the input crafted to break assumptions, where the surface is exposed.

For each, the question is not "does it crash" alone but also "does it return a *silently wrong* answer" — the quieter, deadlier poison.

## Evidence
- Session 79: SILVERVEIN fed malformed frames and dropped connections to HAMMERFALL's fast socket builds and caught a handler that crashed on an empty payload before it reached the King → clean victory.
- A rival's failure: code tasted only on the happy path shipped, then returned a silently wrong result on an empty list in production — no crash, no alarm, just a wrong answer trusted as right.

## Notes
The silent-wrong-answer case is the one most often missed, because a crash announces itself and a wrong answer does not. When tasting, define what the *correct* output for each cruel input should be before you run it — otherwise you'll see "it didn't crash" and mistake survival for correctness.
