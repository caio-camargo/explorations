# Wuthering Heights, Chapter I — notes
**Version**: 1.0.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-09-26 · **Status**: Active
**Purpose**: The opening of *Wuthering Heights* played as a LucasArts-era point-and-click scene: Lockwood's arrival, Heathcliff at the gate, the dogs, the frying pan, "Your health, sir!"

## The idea
Caio's pick: the novel's first chapter is quietly a comedy. A pompous narrator congratulates
himself on finding a fellow misanthrope, and is then savaged by a pack of dogs. That fits the
genre's deadpan well. This is a standalone fork of the `night-storm/` engine, so that
session's engine work stays untouched. It is one file with no assets.

## How it plays
1. **Title card** with the novel's first line.
2. **Outside the Heights.** Look at anything for Brontë's descriptions: the slanting firs,
   the thorns "craving alms of the sun", the carvings with "1500" and "Hareton Earnshaw".
   Talk to Heathcliff over the chained gate; the dialogue tree ends in "walk in!". The gate
   stays shut. The puzzle is lifted straight from the text: *Use the horse*, whose "breast
   fairly pushing the barrier" gets it unchained. Heathcliff goes up the causeway and calls
   Joseph ("The Lord help us!"), who leads the horse away.
3. **"The house."** Caress the pointer to get a growl, "You'd better let the dog alone", and
   Heathcliff down to the cellar. Make faces at the dogs (Talk to, or touch one again) and
   the hive erupts. Lockwood interposes the table and six dogs swarm him. Pick up the poker
   (there's a hint after 14 s), parry, and shout for help. Heathcliff and Joseph come up
   "with vexatious phlegm", and the housekeeper storms in with a frying pan.
4. **Finale.** A three-step dialogue tree ("What the devil, indeed!" / "set my signet on the
   biter"), Heathcliff's grin, "Your health, sir!", then the end card.

## Engine (grown from night-storm)
- **Indexed 320×200, painted ramps.** 31 anchor ramps are interpolated to 4–14 steps each:
  236 colours in total, under VGA's 256. Dithering happens only at the seam between shades.
- **Rooms** each have `bake()` (static art into `bg`/`bgId`/`bgZ`), `dyn()` (live art),
  `post()` (lighting), `walk(x,y)`, `scale(y)` and a light direction. `bgZ` holds the
  occluder depth: the wall, gate, table and chairs hide actors whose feet are behind them.
  That is how Heathcliff leans *over* the gate, and how Lockwood hides behind the table.
- **Actors** are ASCII sprites. Rim light and shadow are computed at draw time from the
  room's light direction: from the sky on the left outside, from the fire on the right
  inside. Humans have idle/stride/pass legs. Dogs have lie/stand/run1/run2 frames with a
  palette per dog, so one pointer sprite serves three different dogs.
- **Scripts** are `async` functions over game time T: `await say()`, `await walkTo()`,
  `await wait()`, `await choose([...])`, `await fade()`. `cut()` hides the verbs, as in the
  originals. A click or `.` skips the current line. Each actor has a speech colour.
- **Interaction:** walk to the object's spot (BFS pathfinding with reachable-nearest targets),
  face it, then run its handler. A handler is a string, a function, or a cutscene promise.
  A newer click cancels a pending walk-then-act.
- **Dogs:** lie → watch (track Lockwood) → attack (orbit him on individual phases, lunge
  with a hop, bark) → scatter home. The fire lifts nearby pixels up their own ramps, and the
  interior palette flickers slightly warm.

## Text
Lines in quotation marks are Emily Brontë's (1847, public domain), sometimes condensed with
ellipses. Unquoted lines are mine: Lockwood's asides, gate and horse jokes, "Get down! Get
away wi' ye", the alternative dialogue choices, and "His countenance relaxed into a grin"
(kept unquoted because I couldn't vouch for the exact wording).

## What it taught
- **A diagonal wall doesn't read at 320×144.** The first layout had the boundary wall
  receding into depth: it rendered correctly and nobody could see it. A wall straight across
  the scene, with pillars and a pale five-bar gate, reads at once. It also gives occlusion
  for free: anyone in the yard shows from the waist up.
- **Test stepping must yield to microtasks.** Script continuations run between tasks. A
  synchronous loop of `tick()`s resolves one `wait()` per batch, which looks like a hang. The
  test stepper awaits a few microtask turns per tick.
- **1-px props need fat hotspots.** The poker was unclickable at 1 px; its hotspot is now 3 px.
- **Dog scale matters more than dog detail.** At ×0.88 the lying pointer was an
  unidentifiable smudge. At ×1.35 (half Lockwood's height when standing) it reads as a dog.

## Ideas not done
Snow and the night walk home (chapter 2); sitting down and standing up; Heathcliff's grin as
an actual sprite frame; a proper Joseph dialect line; wine glasses; the housekeeper swinging
the pan (currently she just arrives); the fire flaring during the fight.
