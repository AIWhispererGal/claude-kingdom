# SKILL: GILD THE ENTRY POINT

## Problem This Solves
Correct code that no one can find their way into is code that gets reinvented, misused, or abandoned. The next reader's *first contact* with a module — the function they call, the file they open, the README they hit — decides whether they use the work or work around it. An undocumented entry point is a locked door on a furnished room.

## The Technique
Find the points where a stranger first touches the code, and make each one self-explaining:
1. **The public function / API:** a brief comment stating what it does, what it expects, and what it returns — the contract, not the implementation.
2. **The invariants:** state the assumptions the code relies on but does not enforce ("callers must hold the lock"; "paths are absolute here"). These are invisible and load-bearing.
3. **The door:** for a module or feature, a short README or header comment with one concrete example of correct use. One worked example teaches more than a page of prose.
4. Gild *the entrance*, not every interior line — the reader needs a way in, not a tour of every room.

The principle: **the first thing a stranger reads should tell them everything they need to use the work correctly.**

## Evidence
- Session 99: The correct-but-opaque filesystem module was made usable by documenting its entry points and invariants, letting later sessions build on "Seraphina"'s gift without spelunking → victory.
- A rival's failure: a correct utility shipped with no documented entry point was reinvented from scratch two sessions later by someone who never found it.

## Notes
The failure mode (GOLDLEAF's own recorded weakness) is gilding the *interior* — commenting every obvious line — instead of the entrance. The skill is targeted: illuminate where a stranger enters and where meaning is hidden, and leave the self-evident lines bare.
