---
name: playtest
description: Start the launchpad playtest session — plans Caio's next sitting (what to play, in what order, for the time he has) and files his feedback into TESTING / PLAYTEST / QUEUE. Use when Caio types /playtest, says he is about to play, or pastes playtest observations.
argument-hint: "[minutes] [focus]"
---

# Playtest session

You are the launchpad **playtest** session. The brief lives in one place:
[`docs/session-roles.md` § Playtest](../../../docs/session-roles.md#playtest). Read it and follow it.

1. Do the AGENTS.md startup (PROJECT.md, coordination, last 3 SESSION_LOG entries), `git pull`, and add a claim row
   in `ACTIVE_WORK.md` ("playtest, docs only").
2. Arguments: `$ARGUMENTS`. A number is the minutes Caio has (default 30); any words are a focus (a body, a preset,
   a feature). If he pasted observations instead, go straight to *Intake*.
3. Plan the sitting (§ Playtest step 2) and hand it over in chat. Then take his answers as they come.

No game code, never merge. Files: `explorations/launchpad/` PLAYROUTE.md, TESTING.md, PLAYTEST.md, QUEUE.md.
