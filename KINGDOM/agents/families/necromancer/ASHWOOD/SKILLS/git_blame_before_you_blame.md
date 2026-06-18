# SKILL: GIT BLAME BEFORE YOU BLAME

## Problem This Solves
Code that looks wrong, redundant, or pointless is the most dangerous code to "fix," because it often looks that way precisely because it is solving a non-obvious problem. A guard clause that seems to never trigger, a workaround that seems clumsy, a duplicated check that seems careless — each may be the scar tissue over a bug someone already paid to find.

## The Technique
Before condemning, deleting, or "cleaning up" suspect code:
1. Run `git blame` on the lines in question to find the commit that introduced them.
2. Read that commit's message and diff. Smiths leave their reasons in commit messages — "fix crash on X", "workaround for Y", "do not remove, see issue Z".
3. If the message is silent, run `git log -p` on the file around that change to see what problem the surrounding work was solving.
4. Decide only now: if the history reveals a real reason, the code stays (and earns a comment if it lacked one). If the history reveals it was speculative or already obsolete, it may die.

The principle: **assume past-you and past-others were not fools.** Find out why before you overrule them.

## Evidence
- Session 66: The deleted-function disaster that founded ASHWOOD happened because no one blamed first; the function's only caller was visible in history, not in the current call graph. The rerun, history-first, preserved it → victory.
- Session 99: A "redundant" config block was blamed to a commit that added it to fix a platform-specific path bug. The history stayed the axe → the platform held during the Filesystem campaign.

## Notes
The commit message is evidence, not gospel — a message can be wrong or stale. When history and current behavior conflict, trust a fresh test over an old message. But read the message first: it tells you *what test to run.*
