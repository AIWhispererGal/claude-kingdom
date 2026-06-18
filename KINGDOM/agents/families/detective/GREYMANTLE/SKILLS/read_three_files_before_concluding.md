# SKILL: READ THREE FILES BEFORE CONCLUDING

## Problem This Solves
The fastest wrong conclusion is the one drawn from a single file. A bug's symptom and its cause usually live in different places — the symptom in the file you were handed, the cause in a caller, a config, or the data passing between them. Concluding from the symptom file alone produces a "fix" that treats the symptom and leaves the cause to strike again.

## The Technique
Before naming any cause, read at minimum three vantage points:
1. **The scene** — the file where the symptom appears.
2. **The caller** — whatever invokes or feeds the scene, where the bad input may originate.
3. **The contract / data** — the config, schema, or data that flows across the seam between them.

Hold no theory until all three are read. Then state the cause as **one falsifiable sentence**: "X is wrong because Y, which I can see at [location]." If you cannot point to the location, you have not finished reading.

## Evidence
- Session 75: A rendering symptom whose cause lay two layers upstream in the state feed was solved only because GREYMANTLE read the scene, the feeder, and the state contract — three files — before concluding → victory.
- Session 102: A selector that "failed intermittently" was proven deterministic by reading three files; the bug was a load race, not flakiness → reclassified and fixed instead of retried.
- A rival's failure: a cause named from the symptom file alone led to a fix that passed once and regressed the next session, because the real source was an upstream caller never read.

## Notes
"Three" is a floor, not a ritual. A genuine one-file typo does not need a cross-module investigation — but the discipline is to *confirm* it is one-file by checking the caller, not to assume it. The cost of one extra read is small; the cost of a wrong verdict is the whole case.
