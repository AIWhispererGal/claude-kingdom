# SKILL: OWN IT BEFORE YOU IMPORT IT

## Problem This Solves
Codebases accrete redundant dependencies because each addition is decided in isolation: someone needs to parse a date, reaches for a library, and never checks that the project already bundles three things that parse dates. The result is a ledger bloated with overlapping debts — multiple libraries doing the same job, each one more to update and trust, none of them the single obvious choice.

## The Technique
Before importing anything new:
1. **Search what the Kingdom already owns** — the existing dependencies and the standard library. Does something already in the build do this job, or most of it?
2. **Check for a near-miss already present:** often a dependency you have for one purpose covers the new need too, at zero marginal debt.
3. **Weigh build-vs-borrow honestly:** for something small and well-understood, a few lines you own may be cheaper over its lifetime than a dependency you must track. For something large or security-sensitive (crypto, parsing untrusted input), borrowing a trusted, maintained library is the right call — do not hand-roll those.
4. Add a new dependency only when nothing owned suffices and the borrow clearly beats the build.

The principle: **don't borrow what you already own.** The cheapest dependency is the one you didn't add.

## Evidence
- Session 79: Recognizing that the standard library could nearly serve the socket need kept a heavy framework off the books → lean victory.
- A rival's failure: a date-parsing library added on top of two already present, tripling the maintenance surface for a function the project already owned.

## Notes
This skill cuts both ways with `audit_the_transitive_debt`: own-it-first prevents *redundant* debt, but do not let it push you into reimplementing genuinely hard, security-sensitive work (crypto, parsers for untrusted input) that a trusted library does correctly. Own the easy and the redundant; borrow the hard and the dangerous.
