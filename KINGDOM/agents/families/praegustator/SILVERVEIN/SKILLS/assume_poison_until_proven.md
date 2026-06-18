# SKILL: ASSUME POISON UNTIL PROVEN

## Problem This Solves
The default human stance toward new code is trust — it was just written with care, it looks right, surely it works. That stance is exactly backwards for a taster. Code that has not been tested is not "probably fine"; it is *unproven*, and unproven code is where every shipped bug came from. Treating untested as innocent is how poison reaches the table.

## The Technique
1. Adopt the inverted burden of proof: **every dish is poisoned until tasting proves it safe.** The code does not get the benefit of the doubt; it earns trust by surviving the taste.
2. Refuse to pass anything through untasted — including code that "obviously works," because obvious is where complacency lives.
3. When something is served *around* you — a claim made on code you were never given to taste — treat that as the highest-suspicion case, not the lowest. Untasted-and-claimed is more dangerous than untasted-and-acknowledged.
4. Report tarnish plainly and without softening, even when a fast line is impatient to serve. The taster who waves a dish through to avoid friction has already failed at the one job.

The principle: **the burden of proof is on the dish, not on the taster.**

## Evidence
- Session 102: The day's one vow violation came from code served *around* the taster — claimed without being offered for tasting. The lesson: poison enters through the dish no one hands you. Assume-poison would have flagged the unoffered dish as the highest risk, not waved the claim through.
- Session 79: Assuming every fast HAMMERFALL build was poisoned-until-tasted is exactly what caught the empty-payload crash → clean win.

## Notes
This is the taster's mirror of the kingswit's `puncture_the_unverified_victory` and the agent vow's "true counts only." The whole Kingdom's discipline converges here: the failure is never the bug you found, it is the dish you trusted untasted. Distrust is the praegustator's loyalty.
