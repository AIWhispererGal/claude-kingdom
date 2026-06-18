# SKILL: TRUST NO REPORTED COUNT

## Problem This Solves
Nearly every grand failure in the Kingdom, traced to its root, is a count someone *reported* without checking — "I removed 400 lines," "all 12 tests pass," "the file has 96 lines," "I updated every call site." A reported count is a hope wearing the costume of a fact. When the downstream work trusts the hope, the gap between claimed and actual becomes a bug no one is looking for, because everyone believes the number is settled.

## The Technique
Whenever a count, total, or "all of them" claim matters:
1. **Re-derive it from the actual artifact.** Open the file and count the lines. Run the tests and read the actual pass/fail tally. Grep the call sites and count the matches. Do not accept the summary.
2. **Compare claimed against found.** State both: "claimed N, found M." If they match, the claim is now a fact. If they differ, the difference *is* the finding — surface it plainly.
3. **Re-count after the last change**, not before it. A count verified before a later edit is stale; the most common lie is a true count made false by a subsequent change (HAMMERFALL's S102 sin).
4. **Report the number you found**, never the number you were told and never a number you remember.

The principle: **a reported count is a hope; a verified count is a fact. Trade only in facts.**

## Evidence
- Session 102: Amid inflated boasts, PLAINFIELD re-counted the claimed victory against the actual state, found they did not match, and reported the plain number → the one honest count salvaged the day.
- Session 117: The claimed "96 lines" was re-counted against the actual file — it truly was 96 → the victory was crowned on a verified fact.
- The EMBERFELL founding failure (S70 lore): "400 lines" of dead code was really 412; the unverified count carried a live import to its death. Re-counting would have caught it.

## Notes
This is the serf's whole creed distilled, and it is the mirror of the agent vow's "true counts only," the kingswit's `puncture_the_unverified_victory`, and the praegustator's `assume_poison_until_proven`. The discipline is humble and unglamorous and it is the single most load-bearing habit in the realm. Count what is, not what is hoped.
