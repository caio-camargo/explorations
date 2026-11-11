# FACES — the face engine
**Version**: 0.1.15 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-10 · **Updated**: 2026-11-10
**Status**: **a second construction (§ 7) and a borrowed shape library (§ 8) are on trial (2026-11-10)**; the first lab was **parked 2026-11-06 (D26)**: Caio found the face creator too thorny; the crew get the ligne-claire head
(CREW Part 1). Kept as it was left, for a later return to the face question. Before that: draft. D12 answered 2026-10-10 (Caio): **defaults, provisionally, depending on how the engine performs**: hybrid engine, generated recruits the player can edit, portraits baked.
**Purpose**: Build crew faces from parameters instead of one whole face per prompt: a small engine that makes any
number of distinct heads in the carved-puppet style (D11), for mock-ups now and for recruits generated in play later.
Parent: [`CREW.md`](CREW.md) § Part 1 (the look). The style itself is decided in the head mock-ups
(`mockups/heads/`, Q220, puppet rounds 1–5); this file is the machinery underneath it.

---

## 1. Why an engine (Caio, 2026-10-10)

Sculpting a whole face per prompt is too much at once, and the game will need many faces: every recruit, every
school, every tourist, generated while playing. A face engine separates the two jobs: **the style** is one carefully
tuned base head (made once, from the mock-up rounds); **identity** is a short list of numbers that move parts of it.
Each feature can then be tuned in its own session, and a new face costs a seed.

## 2. How existing face creators work

Five families. Most real creators mix two or three of them.

| Family | Examples | How it works | Good at | Bad at |
|---|---|---|---|---|
| **Parts and placement** | Mii (Nintendo), Animal Crossing, RimWorld, Cyberpunk 2077's eyes/nose/mouth pickers | per feature, pick a **type** from a hand-drawn library, then 2–4 transforms (size, height, spacing, tilt, stretch) | stylised looks: every type is hand-made, so every combination stays on-style; tiny to store | the face can only be what the library holds; can feel like a kit |
| **Continuous sliders** (morph targets / bones) | Skyrim, Dragon's Dogma, Black Desert, Crusader Kings III | dozens of named sliders, each blending one shape change (chin forward, nose tip up) | huge range, fine control | independent sliders at random make monsters; extremes break the style (Oblivion's "potato faces") |
| **Statistical model** | FaceGen (Oblivion, Fallout 3) | sliders are principal components learned from scanned faces; "random" samples the learned spread, so random faces are plausible; named sliders like age and gender are directions in that space | plausible random faces | needs a database of real faces; for a stylised look there is none |
| **Blending presets** | MetaHuman (up to three presets on an "influence circle", blended globally or per region), Starfield, The Sims' genetics | hand-made archetype heads; a new face is a weighted mix of them, region by region | always on-style, because only hand-made heads are mixed | the range is bounded by the archetypes |
| **Direct sculpt** | The Sims 4 (push/pull on the face), Fallout 4 | the player drags a region; under the hood this moves sliders or blend weights | intuitive UI | it's a UI over one of the above, not a model of its own |

**Crusader Kings III** is the closest model for *generating faces in play*: every character has **DNA**, a fixed list
of genes (head width, jaw, eye depth, nose profile, lip fullness, ears …), each a pair of values with a template.
Children inherit from parents with a little mutation, a whole face is one pasteable string, and portraits are
re-rendered from the DNA on demand. Ethnic groups are **distributions** over the genes (Paradox, GDC: "Creating a
Portrait System Based on DNA").

**Thunderbirds itself** worked like a parts-and-blending system: a few master sculpts, and guest characters were
re-dressed and re-sculpted from the pool (Thunderbird 6 recycled most of *Thunderbirds Are Go*'s guests). Main
characters had **swapped heads for expressions** instead of moving faces (CREW 0.2.5).

### Principles that carry over

1. **Identity and expression are separate layers.** Identity (bone structure) is fixed per person. Expression (brows,
   lids, mouth corners, jaw) goes on top. Facial-animation systems (FACS action units; ARKit's ~50 blendshapes)
   are built this way. For us, the five portrait expressions are an expression layer that works on every face.
2. **The style lives in the base and the ranges, not in the sliders.** A stylised creator keeps every slider in a
   narrow, hand-set **safe range**. Every Supermarionation puppet shares a house face; people differ inside it.
3. **Random means sampling near archetypes, not uniform sliders.** Uniform random sliders give monsters. Sampling
   near hand-made faces gives on-style faces (FaceGen with a learned spread; MetaHuman blending; CK3 templates).
4. **Correlated features move together.** A broad jaw usually has a broad chin; heavy brows have deep sockets.
   Macro sliders (age, heroic, delicate) move several genes at once, as FaceGen's age/gender sliders do.
5. **Hair, beards and glasses are parts, not sliders.** No creator parameterises a hairstyle continuously. They are
   a library of authored meshes with colour.
6. **Colour comes from curated ramps, not free RGB.** Skin is a ramp of tones (with matching cheek warmth and lip
   tint, so the paint stays harmonious); hair and eyes are short palettes.
7. **What reads small matters most.** At the 48 px thumbnail only the silhouette and big values survive: head shape,
   jaw width, hair mass and colour, skin tone, brow depth, nose length. Eye shape and lips only show in portraits.
   Spend the variety where the player sees it.
8. **Symmetric by default.** One small asymmetry gene (a crooked smile, one brow higher) adds life cheaply.
9. **A face is a seed plus a gene vector.** Storable, shareable and deterministic, like CK3's DNA string.

## 3. The proposal: a carved face engine

Five layers, built in this order. All in our existing tech: the SDF raymarcher the head mock-ups already use.

1. **The house head** (the base). Round 5's carved head (Q220) when Caio approves it: skull mass, side plane, ears,
   sockets, nose, mouth barrel, jaw. Every number in it becomes a named gene at its tuned value. This is where the
   style lives. No identity yet.
2. **Identity genes** (~30 continuous numbers, each 0–1 inside a hand-set safe range). In a carved head these are
   **cutting-plane offsets and angles**, so each gene has one clear visual meaning. Grouped by region, ★ for those
   that read at 48 px:
   - **Head**: width ★, length (front to back), crown height, skull back in profile.
   - **Brow and forehead**: forehead slope, brow ridge depth ★, brow height, brow tilt.
   - **Eyes**: spacing, size, tilt (canthus), upper-lid weight, depth in the socket.
   - **Nose**: length ★, bridge projection ★, base width, tip up/down, profile (straight, convex, concave).
   - **Cheeks**: cheekbone height, cheekbone width, hollow under the cheekbone.
   - **Mouth**: width, upper lip, lower lip, philtrum height, projection.
   - **Jaw and chin**: jaw width ★, jaw angle (soft to square), chin width, chin projection, chin height.
   - **Ears and neck**: ear size, ear angle, neck thickness.
   - **Asymmetry**: one gene.
   - **Macros** move several genes at once: *age* (hollows, brow, jowl, grey hair; crew can be young or veteran,
     though faces don't change across eras), *heroic ↔ delicate* (jaw, chin, brow, cheekbone), *lean ↔ broad*.
3. **Parts**: hair masses (a library: crew cut, side part, wave, bob, bun, afro, buzz, bald, …, each carved as one
   mass like round 4's), facial hair (a few), brows as carved ledges in 3–4 shapes. Period-appropriate hair per era
   is a set of weights, not separate faces.
4. **Paint**: skin from a ramp of ~10 tones, each with its own cheek warmth, lip tint and shadow colour; hair from a
   short palette (and grey with age); eyes from 5–6 colours. Satin sheen fixed (the house finish).
5. **Expression**: the five portrait expressions (neutral, grin, grit, alarm, wonder) as offsets on a small set of
   expression controls (inner brow, outer brow, upper lid, lower lid, mouth corners, lip press, jaw open, gaze),
   working on any identity. The puppet register: few moving parts, as the real swapped heads.

**Extremes, pushed on purpose** (Caio, 2026-10-10: the reach tests paid off; Mr. Incredible's appeal is in his
extremes: a tiny nose tip, a huge forehead, a huge chin). Stylised faces are compelling *because* a few features go
far past normal. The rule from character design: **push one to three features hard, keep the rest quiet, and make
the pushed ones agree** (one shape language: square and heroic, round and kind, long and dry). Random extremes on
every gene make monsters; coherent extremes make characters. So ranges stay wide, and the generator, per face:
1. picks a shape language and **one to three signature features** that fit it (a jaw, a forehead, a nose);
2. pushes those toward their extremes, and keeps every other gene near the house face or its archetype;
3. keeps the reach-test faces (Mr. Incredible, the deco woman, more to come) as **landmarks**: archetypes at the
   edge of the space, so blends between them inherit their extremes instead of averaging them away.
The distinctness check then has big differences to find.

**The generator** (CK3-style). Hand-make **~12 archetype faces** in the lab, covering all skin tones, sexes and a range
of ages and builds, with people from every school's region (CREW 0.2.5's varied-roster check). A recruit is:
pick 2–3 archetypes, mix them with random weights, add small noise per gene (about a tenth of its range), clamp to
the safe ranges, pick parts and paint by the school's and era's weights. Then a **distinctness check**: redraw if the
new face is too close to anyone on the current roster in the ★ genes and hair. Stored as a seed plus the gene vector;
the game regenerates the face on demand.

**The lab** (one standalone page, `mockups/faces/`): sliders grouped by region; an archetype blender (MetaHuman's
circle with three slots); randomise; a **roster sheet** of 12 generated faces at portrait size and at 48 px, in front,
¾ and profile; copy and paste of the DNA string. This is where Caio judges the engine, and where archetypes are made.

### Breeding mode (Caio, 2026-10-10: "evolve towards some good presets")

A genetic algorithm needs a fitness score, and the score here is taste, so the fitness function is **Caio's eye**:
*interactive evolution* (Dawkins' biomorphs, Karl Sims' evolved images, Picbreeder). In the lab:

1. A grid of 12 faces. Caio clicks the ones he likes (or ranks them by eye: 1–3 stars).
2. The next 12 are children of the picks: genes crossed over by region (eyes from one parent, jaw from another,
   as in CK3), plus mutation; the best one or two carry over unchanged (elitism). A mutation-strength slider:
   wide to explore, narrow to refine.
3. Machine checks run **before** Caio sees anything, so his clicks go on taste only: features that pierce through
   each other, eyes hidden by the brow, a broken silhouette, a face too close to one already on the sheet.
   (A vision model could pre-rank the rest against the reference images; at most as a sort, never as the judge.)
4. Every pick is saved. Picks become **archetypes**, and the spread of everything Caio picked sets each gene's
   **safe range**: the picks play the part of FaceGen's scanned faces. The engine's generator then samples near
   what he liked.

What it can't fix: evolution only moves the genes the engine has. If every face in a generation looks wrong in the
same way (no ears, flat mask), the base head or a gene is missing, and that goes back to a build session.
Fatigue is the limit: aim for ~10 generations of 12 in a sitting, with a "start from my saved picks" button.

## 4. How it gets built (one region per session)

Each stage is one prompt-sized job, judged on the lab's roster sheet before the next starts. This is what replaces
"the whole face in one prompt".

| Stage | What | Done when |
|---|---|---|
| F0 | The lab shell: round 5's head moved in, every tuned number named as a gene, sliders, ¾/front/profile views, DNA copy/paste | the default genes reproduce round 5 exactly |
| F1 | Head and jaw genes; a first **breeding grid** (picks, crossover, mutation) so every later stage can be judged and tuned by breeding (the silhouette ★) | 12 random heads tell apart at 48 px with the same hair |
| F2 | Brow and eyes | the ¾ view reads open, awake eyes on every random face |
| F3 | Nose and cheeks | profiles differ visibly; no broken noses at the range limits |
| F4 | Mouth and chin | the same, in ¾ |
| F5 | Hair library (8+ masses) and facial hair | silhouette row by hair alone |
| F6 | Paint ramps | the varied-roster check passes (all tones look good, same finish) |
| F7 | Expression layer | five expressions on any random face, without breaking it |
| F8 | Archetypes and the generator, distinctness check; **breeding mode** (§ 3) | a generated roster of 12 passes Caio's look |
| F9 | Into the game (needs D12 3) | crew portraits and figures drawn from DNA |

**Rule for every stage:** test the extremes. Push each new gene to 0 and 1 on three different faces; if a corner
breaks the style, narrow the range rather than adding a fix.

## 5. Decided (D12: the defaults, provisionally, 2026-10-10)

1. **Engine shape.** (a) **Blend archetypes + bounded genes + part libraries** (the hybrid above; recommended); (b)
   Mii-style parts only (fastest, most toy-like); (c) free sliders only (most range, least on-style).
2. **Who makes faces in play.** (a) **Generated recruits, with an edit screen for the player** (the lab's sliders,
   reduced to the macros, parts and paint; recommended); (b) generated only; (c) the player designs every crew.
3. **How the game draws them.** The game's crew figures are meshes (`app/crew-look.js`, `crewFigure`); the lab is a
   raymarcher. (a) **Bake**: render each crew member's portrait (and the expression set) once, to a texture, when
   they are recruited, and keep the 3D figure simple (recommended for now: cheap and exact); (b) turn the SDF head
   into a mesh (marching cubes) for the 3D figure too; (c) raymarch heads live (costly with many crew on screen).
   Decide by F9; the engine is the same either way.

Defaults if silent: **1(a), 2(a), 3(a).**

## 6. Progress

- **F0 done, F1 built** (2026-10-10, look & sound): [`mockups/faces/index.html`](mockups/faces/index.html), round 5 as the
  house head with 35 genes (the list in § 3 layer 2, plus the forehead slope and the lip groove's coupling), the default
  genome matching round 5 pixel for pixel; Edit, Breed (picks, region crossover, mutation, elitism, a distinctness check
  on the ★ genes) and Ranges tabs; macros heroic, lean–broad, age (sculpt only). Couplings so far: nostril wings ride on
  the bridge, the lip groove shrinks with the lips. **F1's test is not yet met:** with the same hair, 12 random heads
  differ at portrait size but look alike at 48 px; the hair mass dominates the thumbnail, so hair parts (F5) and paint
  (F6) will carry most of it. Seen in the grid, for F3: a tip-up nose shows a dark underside.
- **Nose in parts** (2026-10-10, Caio's notes; F3 started early): bridge, tip lobule, wings on the face, alar rim; six
  new genes (tip roundness, size, width, projection; wing flare, size), 41 in all; a nose floor above the lip;
  close-up views. The house head now differs from round 5 at the nose (tip roundness .4).
- **Profiles and cheekbones** (Caio's notes): a real forehead slope (a shear above the brow; the old gene renamed nose
  root), lower face projection, cheekbone prominence (a swelling of the surface along the zygomatic line and arch, not an added mass; house .35), a deeper cheek
  hollow (house .2). 44 genes. Ranges stay wide on purpose (Caio: more options now, narrow later).
- **Lips, jaw and the reach test** (Caio: deco lips are a line; Mr. Incredible as a reachable face): lip edge and lip
  colour, thin lips, narrow noses, jaw mass, chin size, planes crisp–soft; three structural bugs fixed (nose-root
  plane, neck cut, cheek-plane keel). A Mr. Incredible-like preset reaches his silhouette (jaw, chin, nose, line
  mouth). 49 genes.
- **Eyes** (Caio's notes): spherical eyeballs, 3D lids (upper arched, lower gentler), a socket hard at the brow and
  against the nose, soft below and outward. Lower lid height, lid thickness, socket softness. 52 genes. Gaze (moving
  irises) belongs to the expression layer (F7).
- **Lid shapes** (Caio's notes and eye-shape references): curved margins between corners; round–almond, lid peak,
  lid fold (hooded to deep-set); a thinner lower lid. Mr. Incredible preset retuned to his profile. 55 genes.
  Open: a sloped, forward neck (his reads as a column).
- **The mouth as an edge** (Caio, after Lawrie's Atlas): lips are ridges, the red only on the faces that tilt back from
  the edge to the slit; tilt, height, bow, corners, lower lip forward. Deeper eyes, broad heavy chins. 60 genes.
- **Lips in profile** (Caio's line drawing): a straight upper slope, a rolled lower lip with a tucked bottom edge.
  61 genes. Open: on extreme long noses the nostrils show as rings at the nose floor.
- **Integration** (Caio): a flush nose root, softness through jaw and chin without shrinking the face. 62 genes.
- **Variation** (Caio: sex and ethnic variation): not as labelled sliders but as the generator's distributions over
  the genes (§ 3), overlapping, tuned by picks. Done first: an epicanthic fold, early paint (skin ramp, hair and iris
  palettes), a masculine–feminine macro, a Roster tab of 12 archetypes across sexes and regions. Next: distributions
  per population, after Caio reviews the roster; hair textures need F5.
- **The bell head** (Caio's front reference of Mr. Incredible): crown width, a long skull-to-jaw blend on soft faces,
  forehead forward.
- **The second reach test** (Caio's deco woman): a Deco woman preset, brow arch; macro labels fixed; lip tint on deep
  skin, the nose-root step and the soft face's eyes fixed. 69 genes. A flat nose front (one plane, root to tip). 70.
- **F5 begun**: 7 hair masses (1950s–60s: quiff, crew cut, receding, flipped bob, bouffant, curls, the house sweep);
  a nose root shaped like the bridge, blended into the brow. 71 genes. Next for hair: more eras, partings, facial hair.
- **Thunderbirds quiff done properly** (profile-first: vertical front, curve back); the other six styles still rough.
  **Age**: wrinkles and under-eye bags as genes the Age macro drives. Nose length limited above the lip. 73 genes.

## 7. The second construction (2026-11-10, Caio: "diagnose or rebuild it")

**What was wrong with the first lab** (`mockups/faces/`), measured and read from its code:

- **Not speed.** On the RTX 3050 its shader compiles in 2.4 s and a 12-face grid draws in 0.7 s.
- **The head was assembled, not one surface.** About twenty signed-distance solids (ellipsoids for skull, jaw, chin and
  brow; a wedge, a ball and two more balls for the nose; blocks for lips; a sphere in a bored hole for each eye) joined
  by smooth unions and cut by planes. Nothing made the forehead run into the brow and the bridge as one plane, which
  is what the deco references are. The nose read as a plank with a ball on it, the hair as a cap.
- **Genes were offsets on those solids, so they collided.** Fourteen comments in the shader are repairs for one gene
  breaking another ("so no keel", "never reaches the mouth", "never in a hole"). Each new gene needed couplings with
  the old ones; that is the thorniness.
- **The stretches broke the distance field**, patched with one hand-tuned step factor per face (`uL`).
- **Saved faces drifted.** DNA stored each gene as a fraction of its range, so retuning a range changed every preset.
- **The spread was wrong.** The twelve roster archetypes look like one man in twelve paint jobs; the pushed
  signatures look like monsters. Little lies between.

**The second lab** ([`mockups/faces2/index.html`](mockups/faces2/index.html)) keeps § 2–3's ideas (house head, genes,
signatures, DNA) and replaces the construction:

1. **One control cage.** A lattice of 22 rings × 20 columns. Rows are the face's lines (brow edge, lid margins, nose
   tip, lip borders, jaw line); columns are its landmarks (midline, nose edge, inner eye corner, pupil, outer corner,
   face corner, side, ear, back). The house head is a typed table of the face's points (`FACE`); the skull and neck
   come from a section formula.
2. **Catmull–Clark subdivision with semi-sharp creases** makes the skin (three levels, 75k triangles, 20–60 ms per
   change). The *Planes* gene puts a floor under every edge's sharpness: 0 is a soft modelled head, 3 the cage's bare
   planes. Brow, nose ridge, lip borders and jaw line carry their own creases (*Feature edges*).
3. **A gene moves named cage points.** Rows keep their order, so a long nose cannot reach the lip and nothing needs a
   repair. Proportions (forehead, nose length, nose to mouth, chin) remap heights between landmarks. 55 genes.
4. **Eyes** are balls behind an opening in the cage; **hair** is a shell grown from the cage with a carved edge;
   **ears** are a small cage of their own. A rasterised mesh with a shadow map, so the head turns under the mouse.
5. **DNA by name** (`F2:jw=1.2,np=.03`): only genes that differ from the house head, in real units.
6. It is a mesh, so D12.3's option (b) (the 3D figure wears the same head) comes without marching cubes.

**State:** a first pass, one sitting. Checked by eye on the GPU: the house head in ¾, front, profile and close-up, at
*Planes* 0.45 and 1.6, and one sheet of twelve generated faces (stills in `output/launchpad/mockups/faces2/`).
**Not checked:** each gene at both ends of its range; the 48 px thumbnails; any face against a reference picture.
**Known rough:** the eyes stare (no lid thickness, no lash line); a pinch at the inner eye corner; ears are plain
slabs; the hairline waves where the shell steps down the cage; nostrils are not modelled; no expressions, no
breeding tab, no archetypes yet (the first lab's are in its file, in the old gene space).

## 8. A borrowed shape library: MakeHuman (2026-11-10, Caio: "start with something already validated")

**How faces2 compares with other creators.** One surface with a fixed layout, deformed by parameters, is what every
3D creator in § 2 does; faces2 is that. What differs is the source of the shapes: theirs come from artists or scans,
ours were typed by hand. And faces2's cage is a plain grid, where made heads run rings of edges round the eyes and mouth.

**MakeHuman** (github.com/makehumancommunity/makehuman) supplies exactly those two things. Its base mesh, targets and
expressions are **CC0 1.0** (public domain; its `LICENSE.md` § C, read 2026-11-10; the program's code is AGPL and is
not used). [`mockups/faces3/bake_mh.py`](mockups/faces3/bake_mh.py) cuts the head out of it: 4,516 points, 114
feature sliders (left and right merged), macros for sex, age, three populations and weight, and 34 expression units,
in `mh-head.js` (0.72 MB). [`mockups/faces3/index.html`](mockups/faces3/index.html) draws it with faces2's light and
paint, a hair shell, a generator, and *Exaggerate* (a face's difference from the average face, multiplied).

**Seen** (GPU, by eye; stills in `output/launchpad/mockups/faces3/`):
- The average head is a sound human head at once: ears, lids, nostrils, lips. One slider change takes 8–30 ms.
- Expressions work on any face (an old man's smile, with its folds: `old-man-smile.png`). That is stage F7, for free.
- Sex, age, population and weight give plainly different people (`sheet.png`).
- **It is realistic, not carved.** None of the deco or puppet style is in it.
- **Exaggerating everything fails.** At ×2 the sheet is monsters (`sheet-exaggerate-2.png`): § 3's rule (push one to
  three features, keep the rest quiet) holds here too.
- Rough: the generator moves all 107 feature sliders at once and leaves dents; the hair shell's edge is jagged (it
  follows the mesh's quads); the painted eyebrows land in the wrong place; the neck's cut edge is ragged.

**Not checked:** the sliders one by one; the 48 px thumbnails; the other two expression sets (African, Asian; the
bake takes the European one).

**Open: where the style comes from.** Three ways, not yet tried: (a) faces2's cage riding on this head (each cage
point bound to a place on MakeHuman's surface, so the library moves the cage and the cage keeps the planes);
(b) a few stylising shapes of our own on MakeHuman's mesh (a bigger eye, a simpler nose, a squarer jaw) with the
signature generator; (c) leave the shape alone and stylise by light and paint only.

**Tried and failed: style by an automatic filter** (2026-11-10). faces3 gained *Simplify* (Taubin smoothing of the
skin) and *Carve* (the faces' normals gathered into a few directions, then the points moved to fit them; Sun et al.
2007), with *Plane size*. Seen on the GPU (`carve-filter.png`, `carve-filter-sheet.png`): Simplify does remove detail,
but it removes the features with it. The lids flatten and the eyes sink, the lips part, and every face drifts toward
one smooth mannequin. Carve adds almost no visible planes on top, and Plane size changes nothing that shows: after
smoothing there are no strong edges left for it to keep, and the subdivision that follows rounds what it makes.
**Why it fails:** a filter cannot know which edges are the style. In the references the planes sit on chosen lines
(brow into nose, lip borders, jaw, cheekbone); a filter keeps whichever edges happen to be sharpest. The sliders stay
in the lab at 0. This leaves way (a): planes placed by design, in the cage.

## 9. The cage on MakeHuman's head (2026-11-10, way (a) of § 8)

[`mockups/faces4/index.html`](mockups/faces4/index.html): MakeHuman decides who the person is; faces2's cage decides
how they are drawn. The binding is made once, on the average head, when the page loads (about a second):

1. **Landmarks on MakeHuman's profile**, found by casting rays at the midline: nose tip, nose base, lip borders (from
   a lip mask the bake takes from the lip-volume shapes), the slit, the chin's crease and point, nose root, brow.
   The cage's rows are moved to those heights.
2. **The eye's opening**, found by looking from the front for where the eyeball is nearer than the skin; the cage's
   four lid points go to its corners, top and bottom. **The mouth's corner** and **the nose's wing** are MakeHuman
   vertices (the outermost lip point; the point the nose-flaring shape moves most). **The jaw's edge** under each
   column is where the surface falls away to the neck.
3. Every cage point is then dropped onto the surface (from the front for the face, toward the head's axis elsewhere)
   and stored as a place on one MakeHuman triangle. Any MakeHuman shape or expression then moves the cage.
4. The cage's points are control points and the skin falls inside them, so each change runs four fitting passes that
   move the points until the skin passes through its targets.

MakeHuman's ears are drawn as they are; the eyes are balls where MakeHuman puts them; hair is faces2's shell.

**Seen** (GPU, by eye; stills in `output/launchpad/mockups/faces4/`): the mechanism works. Sex, age, population and
weight give different carved heads (`sheet.png`, `sheet-carved.png`); *Planes* works on all of them; the lips and the
chin come through well; a change takes 20–90 ms. Two bugs found by measuring each cage point's distance from its
target: rays down the exact midline slipped between triangles (41 points off, then none), and rays from below entered
through the neck's open end.
**Not good yet:**
- **Ripples across the mid-face**: bands under the eyes and over the cheeks, where the eye's rows (placed by the
  opening) and the same rows further out (placed by the profile) do not line up.
- **The nose is weak from the front**: MakeHuman's nose is a real, small nose, and five cage rows do not hold its
  ridge. The brow has no strong edge either, so the deco "brow into nose" line is not there.
- **Expressions mostly fade**: a smile shows faintly; raised brows barely. The cage is too coarse to carry them.
- The eyes are small and the eyebrow paint sits high.
**Not checked:** sliders one by one; 48 px; the fit's accuracy beyond "no point further than 0.06 from its target".

**What this makes possible, not yet done:** the style can now be added in the cage's own terms, on top of any
person: faces2's genes (brow forward, nose root filled for a straight profile, a squarer jaw, bigger eyes) as a
fixed "house style" offset, since the cage's points have names.

## 10. The face simplified into planes (2026-11-10)

Caio on faces4 (§ 9): "not the right direction. it's more a question of simplifying the face into planes."
So the cage is set aside, and MakeHuman's face is kept as it is and reduced.

[`mockups/faces5/index.html`](mockups/faces5/index.html): the skin's 9,000 small triangles are merged into a few
hundred big ones, each shaded flat. The merging is edge collapse by quadric error (Garland & Heckbert 1997), run once
on the average head when the page loads (0.3 s, 4,372 points down to 36), left and right together. A collapse always
moves a point onto its neighbour, so every remaining corner is one of MakeHuman's own points and still follows every
slider and every expression. *Planes* picks how far down the recorded sequence to go (about 120 to 9,000 planes;
the house setting is about 540). *Edge lines* darkens each plane toward its border. Eyes stay round; the hair is
the scalp's own planes stood off the skull.

Why this works where § 8's Carve filter did not: that one smoothed first, moved points toward flatness, and was then
subdivided and shaded smooth, so nothing flat was left to see. Here nothing is smoothed and every plane is drawn flat.

**Seen** (GPU, by eye; stills in `output/launchpad/mockups/faces5/`): it reads as a head cut into planes, and the
planes fall on the face's structure (brow, nose ridge and wings, cheekbone, jaw) without being told to. Twelve
generated people stay different people (`sheet.png`). An expression carries: a smile on an older man (`man-smile.png`).
A change takes 1–5 ms.
**Rough:** where the lids' points were merged away an eyeball can stand proud of its socket; the lip colour follows
whole planes, so its outline is jagged; the hair is thin and its edge steps; the neck's cut is ragged; no eyebrows
(the paint from faces3 lands in the wrong place, so it is off).
**Not checked:** sliders one by one; 48 px; very low plane counts on faces other than the average.

**House style, step 1: the flat nose bridge** (2026-11-10; Caio: "in the art-deco / Mr. Incredible style the bridge
is flat: a stylization which isn't captured in a naive rendering into planes"). Cutting planes only keeps what the
mesh already has, so the style needs a second kind of step: **a shape imposed on MakeHuman's points before the planes
are cut.** `noseStyle` in faces5: from between the brows to the tip, every point within the strip's half-width is put
at the ridge's own depth (a plateau, not an arch), and the points near the strip's border are moved out onto it, so
the strip ends in an edge. The planes are then cut on the average head *already in the house style*, so the collapse
keeps that edge. Sliders: *Nose bridge: round–flat* (house 1), *Bridge width* (1.2), *Nose profile: natural–straight*
(.5; pulls the ridge toward the line from brow to tip, the nose's sides following).
Seen (GPU; `nose-flat-closeup.png` against `nose-round-closeup.png`, `sheet-flat-nose.png`): from the front the bridge
is one strip from brow to tip on every generated face; without it several triangles meet along the ridge.
Rough: *straight* at 1 makes a wedge that juts from the forehead (too much past about .7); the strip's top, between
the brows, gives some faces a frown; the tip's flat front is small. Not checked: the strip on extreme noses (the
hump, flare and tip sliders at their ends).

**Step 1 redone: the bridge as one built plane** (2026-11-10; Caio: "the nose definitely did not work, the bridge
needs to be one plane, or at least start as one"). The plateau above was still a patch of triangles that only
roughly agreed. Now the plane is *built, not found*: MakeHuman's mesh is a regular grid along the nose, so the strip
is the middle column of points and two columns each side, from the brow line (the first row at or under eye height
+ .062) to the tip, 16 rows, 80 points. Each point has a fixed place on the plane (how far down, how far across); on
every face the plane runs straight from that face's own brow-line point to its own nose tip, so the profile is one
line and the natural dip between the eyes is filled. The outer columns are the plane's two straight edges; the
points beside them follow, so the nose's sides run up to the edges. **Two rules keep it one plane when the planes
are cut:** a point of the strip merges only into another point of the strip, and a point on one of the strip's four
edges never leaves that edge (so the four corners never move). And **edges between planes that face the same way are
no longer drawn** (anywhere on the skin), so triangles lying in one plane read as one plane.
Sliders: *Nose bridge: natural–one plane* (house 1; in between it is a blend and not flat), *Bridge width* (1.2),
*Bridge: even–wider at the tip* (.3). *Nose profile: natural–straight* is gone: one plane is always straight.
Seen (GPU; `nose-plane-closeup.png`, `nose-plane-front.png`, `nose-plane-many-planes.png`, `sheet-nose-plane.png`):
at the house setting the strip is down to its four corners and two middle points, drawn as one four-cornered plane
from brow to tip, with one large plane down each side of the nose; it holds at more planes (.6) and fewer (.15), and
on the sheet of twelve. Rough: under the tip the nose drops away with almost no wings or nostrils at the house plane
count; the brow line above the plane is still whatever the cutting left. Not checked: extreme nose sliders; the
width slider at its ends; expressions that move the nose.

**Step 2: the nose's underside as a second built plane** (2026-11-10; Caio on the bridge: "yes, much better, this is
the idea"). `underInit` in faces5: a four-cornered plane from the bridge's bottom edge (the tip) back to the base of
the nose, as wide there as the wings. The mesh is not a grid under the nose, so the patch is found once on the
average head: the skin near that plane, grown outward from the tip (142 points). MakeHuman's nostrils are deep
tubes; what the patch encloses is cut out and closed over (12 points, 2 holes). The patch's rim (36 points) is put
on the plane's four edges, corner to corner, and the same two rules keep it one plane. On each face the back edge
sits at that face's own nose base (the deepest midline point under the tip), its depth halfway between that point
and the wing, its half-width .95 of the wing's widest point (the point MakeHuman's nostril-width slider moves most).
It shares the bridge's slider (*Nose bridge: natural–one plane*).
Seen (GPU; `nose-under-closeup.png`, `nose-under-front.png`, `nose-under-many-planes.png`, `sheet-nose-under.png`):
the nose is a prism of four planes (bridge, two sides, underside), the underside one dark trapezoid from the front;
it holds at .15, .36 and .6 on the planes slider and on the sheet of twelve. Rough: no nostrils and no bulge of the
wings (the sides run straight from the bridge's edge to the underside's edge). Not checked: nose sliders at their
ends, the nose expressions, how the upper lip meets the back edge on faces with a short lip.
**Parked the same day** (Caio: "i think the earlier nose was better, simpler. we can stick with that for now"): the
underside plane is off; the nose is the bridge plane alone, and the cutting shapes the rest. The code stays in
faces5; `?under=1` brings it back.

**Step 3: the brow as one straight ridge** (2026-11-10; Caio: "brow ok"). `browStyle` in faces5: from each top corner
of the bridge, one row of the grid up and then outward along that row to past the eye (5 points a side). Seen from
the front they are put on one straight line from the bridge's corner to the brow's outer end (the end's height is
halfway between its own and the corner's, so the line rises a little outward), and pushed forward so the ridge
overhangs the eye; each keeps its face's own depth, so a heavy brow stays heavy. When the planes are cut, a point of
the line merges only along the line and its two ends stay. Sliders: *Brow: natural–one straight ridge* (house 1),
*Brow overhang* (.4, up to .03 head heights), *Brow: outer end down–up* (0).
Seen (GPU; `brow-ridge-closeup.png`, `brow-ridge-front.png` against `brow-natural-front.png`, `sheet-brow.png`): the
brow is one straight edge running out of the bridge's top corner, the socket under it one dark plane; without it
the edge dips in a V over the eye. On the sheet of twelve every face has it. Rough: the difference from the
natural brow is modest at the house setting; the line ends just past the eye and the temple beyond is whatever the
cutting left; the forehead above is a fan of triangles. Not checked: the overhang and tilt sliders at their ends,
the brow sliders and expressions of MakeHuman (raise, frown) with the ridge on.

**Step 3 corrected: the brow as a level band** (2026-11-11; Caio: "they all look pretty angry because of the triangle
pointing down at the eye, so i don't think that's the right point for a vertex"). The dark plane under the brow ran
to a point at the bridge's top corner, its lower edge climbing to it from the eye: a scowl on every face. **A plane
that should read as a band must end in an edge, not a point.** Now there are two lines a side, both starting on the
bridge's side edge: the brow's ridge from the top corner (as before), and the crease over the upper lid from the
next point down that edge (the grid row there runs outward over the eye; 2 points a side past the bridge). Both are
level from their point on the bridge (the tilt slider turns them together), and both are kept when the planes are
cut, their ends fixed. The brow's outer end no longer takes half its own height: level is the house setting.
Seen (GPU; `brow-band-closeup.png`, `brow-band-front.png`, `sheet-brow-band.png`): the plane under the brow is a
level dark band from the bridge's edge outward; the faces on the sheet read calm, not angry. Rough: the eyeballs
stand prouder of the lids than before; the crease line is short (it stops over the eye's middle); the forehead
above the bridge is still a fan of triangles meeting at its top. Not checked: as above.

