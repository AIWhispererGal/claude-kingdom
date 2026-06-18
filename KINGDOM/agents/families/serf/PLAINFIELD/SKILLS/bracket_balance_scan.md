# SKILL: BRACKET BALANCE SCAN

## Problem This Solves
A staggering share of "unexpected token" and "syntax error" failures are a single unbalanced bracket, brace, parenthesis, or quote — usually introduced by an edit to a multi-line structure where one closer was dropped, doubled, or misplaced. The error message points at where the parser *gave up*, which is often far from where the bracket actually went wrong, sending the unwary on a hunt in the wrong place.

## The Technique
When syntax breaks, or after any multi-line structural edit, count mechanically rather than reasoning about meaning:
1. **Scan for each pair independently:** `()`, `[]`, `{}`, and quotes (`'`, `"`, backticks). For each kind, count opens and closes — they must be equal.
2. **Walk the nesting depth:** track depth from the top; it must return to exactly zero at the end and never go negative anywhere. A point where it goes negative is a closer with no opener; a nonzero end is an unclosed opener.
3. **Suspect the edited region first:** the imbalance is almost always inside the block you just changed, even if the parser complains elsewhere.
4. **Mind the false closers:** brackets and quotes *inside strings or comments* are not structural — don't count them. This is where naive counts go wrong.
5. Report the exact location of the imbalance, not a guess at the cause.

The principle: **don't reason about the syntax error — count the brackets.**

## Evidence
- Session 117: Before "96 lines beat 841" could be declared, the structure was bracket-scanned and confirmed balanced → the victory rested on a verified structure, not a hopeful one.
- Common Kingdom failure: an "unexpected token" hunted for an hour at the parser's reported line turned out to be a single missing `}` three functions earlier — found in seconds by a depth scan.

## Notes
The string-and-comment exception (step 4) is the one that catches careful counters off guard: a `)` inside a string literal or a `//` comment is not a real closer. When counting by eye is unreliable on a large block, prefer a tool or editor that does matched-bracket highlighting — the serf uses whatever counts *mechanically*, because the whole point is to remove human hope from the tally.
