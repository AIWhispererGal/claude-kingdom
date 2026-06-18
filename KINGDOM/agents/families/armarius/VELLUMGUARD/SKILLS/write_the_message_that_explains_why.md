# SKILL: WRITE THE MESSAGE THAT EXPLAINS WHY

## Problem This Solves
A commit message that merely restates the diff ("changed timeout to 30") is worthless to a future reader, because the diff already shows that. What the diff *cannot* show is the reason — why 30, what broke at 10, what trade-off was accepted. When the reason is missing, the next person (often a necromancer running `git blame`) is left to guess at intent, and guesses badly.

## The Technique
1. Write a short, specific subject line stating *what* changed in plain terms.
2. In the body, record the **why** the diff cannot show:
   - What problem this solves or what prompted it.
   - What alternative was rejected and why, if a non-obvious choice was made.
   - Any constraint, ticket, or failure that drove the change ("fixes crash on empty input"; "do not lower below 30, see timeout race").
3. Make the message answer the question a future `git blame` will ask: *"why is this line like this?"*

The principle: **the message holds the reason; the diff holds the change.** Never make them redundant.

## Evidence
- Session 79: Each commit's message stated what and why, so the complex three-layer win stayed legible to later sessions reading the history.
- Session 99: A clear "why" on each boundary made the later clean revert possible — the reverter knew exactly what each commit was for.
- ASHWOOD's founding lesson (S66): a deletion broke a feature because the original code's *reason* lived in nobody's commit message; a "why" message would have saved the session.

## Notes
This skill is the gift the armarius leaves the necromancer. `git_blame_before_you_blame` (ASHWOOD) only works when the messages it surfaces actually explain themselves. Write every message as if the reader will be deciding whether to delete the line — because eventually one will.
