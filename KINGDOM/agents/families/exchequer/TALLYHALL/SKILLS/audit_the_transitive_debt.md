# SKILL: AUDIT THE TRANSITIVE DEBT

## Problem This Solves
Adding one dependency rarely adds one dependency. A single small library can pull in a tree of transitive packages — each one more code to load, more surface to be vulnerable, more maintainers to trust, more that can break on an update. The manifest shows the one debt you chose; the lockfile shows the dozens you actually took on. Judging a dependency by its manifest line alone is judging an iceberg by its tip.

## The Technique
Before admitting a dependency:
1. **Read the lockfile, not just the manifest.** See the full transitive tree it introduces, not the single name you typed.
2. **Weigh the size:** how much does it add to install, build, and bundle? A trivial convenience that quadruples the build is a bad trade.
3. **Check the pulse:** is it maintained, recently updated, widely used — or abandoned and waiting to become an unpatched liability?
4. **Check the binding:** the license, and whether it commits the House to terms it cannot accept.
5. Enter it on the ledger only if the benefit clearly exceeds this *lifetime* cost — not just today's convenience.

The principle: **the real debt is the transitive one.** Count what it drags in behind it.

## Evidence
- Session 79: A heavy real-time framework's transitive tree was tallied against a feature the standard library could nearly serve; the lean path won → Order of Merlin without mortgaging the build.
- A rival's failure: a one-line convenience dependency pulled in a transitive package that was abandoned and later flagged for a vulnerability the House then had to scramble to remove.

## Notes
The opposite failure is real too (TALLYHALL's own weakness): refusing a dependency whose transitive cost is small and whose benefit is large, then hand-rolling something worse. Audit the debt honestly in *both* directions — a cheap, healthy, well-maintained dependency that saves real work is a debt worth taking.
