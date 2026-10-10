# FACES — the face engine
**Version**: 0.1.2 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-10 · **Updated**: 2026-10-10
**Status**: draft. D12 answered 2026-10-10 (Caio): **defaults, provisionally, depending on how the engine performs**: hybrid engine, generated recruits the player can edit, portraits baked.
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

## 5. Open questions (D12)

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
