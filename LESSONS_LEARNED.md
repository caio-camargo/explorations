# Lessons Learned
**Version**: v1.0.0
**Last Updated**: [YYYY-MM-DD]
**Purpose**: Persistent record of what works, what doesn't, and patterns worth repeating.
**Rule**: Claude updates this file whenever a lesson is identified. Review periodically to promote stable patterns into playbooks.

---

## How to Use This File

**During work**: When something works well, fails, or surprises you — add it here.
**At session end**: Claude should check if any lessons emerged and log them.
**Periodically**: Review accumulated lessons. If a pattern is stable and reusable, extract it into a playbook in `playbooks/`.

**Format**: Each entry is a short, actionable insight. Not a narrative — a reference.

---

## Workflow & Process

<!-- Lessons about how you and Claude work together.
Examples:
- "Asking Claude to draft an outline before writing the full doc saves 50% of revision time"
- "Always provide 2-3 examples of the desired tone before asking for a draft"
-->

| # | Date | Lesson | Source |
|---|------|--------|--------|
| 1 | | | |

## Tools & Techniques

<!-- Lessons about specific tools, prompts, formats, or approaches.
Examples:
- "Markdown tables work better than bullet lists for comparison tasks"
- "When researching competitors, start with their careers page for culture signals"
-->

| # | Date | Lesson | Source |
|---|------|--------|--------|
| 1 | 2026-08-10 | Sweep simulation parameters programmatically instead of eyeballing the canvas — drive `step()` in a loop and report mean radius / max radius / % pinned at the boundary / px-of-motion-per-step. Caught a preset that silently pinned 62% of dots to the wall and another that froze to a point. | dots-friend-enemy |
| 2 | 2026-08-10 | Guard the zero-size canvas at boot. A hidden or collapsed pane gives `clientWidth === 0`, so every position clamps onto one point and the sim is dead even after the pane opens. Re-scatter on the first resize that yields a real floor. | dots-friend-enemy |
| 10 | 2026-08-11 | Verifying the canvas is not verifying the app. Three rounds of physics/render/perf tests all passed while the control panel was broken — a `[data-look]` selector added for one row also matched the look buttons (which set `dataset.look` in JS, so it never appears as `data-look=` in the source) and hid four of five. Assert on the DOM: which controls are actually visible in each mode. | dots-friend-enemy V2.3 |
| 9 | 2026-08-11 | If a visual property is keyed on an id, check the id is *stable*. Basin colours flipped wholesale because ids were assigned in graph-scan order and renumbered on every recompute — the visible symptom (abrupt colour change) looked like a smoothing problem, but smoothing alone would have papered over a re-identification bug. Derive identity from the thing itself (here, the smallest node on the cycle). | dots-friend-enemy V2.3 |
| 8 | 2026-08-11 | Benchmarks run back-to-back in one browser eval degrade progressively — the same config measured 0.94 ms, then 44 ms, then 128 ms as the call went on, versus 1.66 ms measured alone. Sustained synchronous work throttles rasterisation. Trust only the first bench in a call, or one config per call. | dots-friend-enemy V2.2 |
| 7 | 2026-08-11 | Sample per-simulation-step quantities in the step loop, not the draw loop. Measuring speed per frame broke the moment steps and frames stopped being 1:1, collapsing to zero on frames that ran no step and strobing the whole field. Anything derived from motion belongs where motion happens. | dots-friend-enemy V2.2 |
| 6 | 2026-08-10 | "Fade to background" on an 8-bit canvas never reaches the background. `V ← V − (V−bg)·a` freezes as soon as `(V−bg)·a < 0.5`, leaving a permanent floor ~`0.5/a` above bg. Long trails fossilise into a haze that looks like an artistic choice. Test it by applying the veil with nothing drawn and checking whether the canvas actually clears. | dots-friend-enemy V2.1 |
| 5 | 2026-08-10 | Don't pipe images through tool output as base64 to inspect them. Two attempts truncated silently (13.3 KB arrived of 19.9 KB; a partial JPEG decodes top-down and looks like a *rendering* bug, which cost a wrong diagnosis). Verify integrity by length+tail, or get the file out via a download / local server instead. | dots-friend-enemy V2 |
| 4 | 2026-08-10 | Give any "scan for secrets before publishing" grep a control test — a string you *know* is present. The first pre-publication scan returned zero hits from a broken shell expansion, which looks exactly like a clean result. A control line caught it; the real scan then found local Drive paths in two files. | repo publication |
| 3 | 2026-08-10 | Mixing absolute and relative terms makes a sim monitor-dependent. A px-per-step stride against a %-of-distance centre pull settles at radius ≈ stride/pull, so the same parameters fill a laptop screen and vanish on a 4K one. Scale absolute terms by the floor size. | dots-friend-enemy |

## Quality & Standards

<!-- Lessons about what makes good output vs. mediocre output.
Examples:
- "Cover letters that open with a specific company insight outperform generic openings"
- "Data claims without sources get challenged — always cite"
-->

| # | Date | Lesson | Source |
|---|------|--------|--------|
| 1 | | | |

## Anti-Patterns (What to Avoid)

<!-- Things that seemed like a good idea but weren't.
Examples:
- "Don't ask Claude to write 5 versions at once — quality drops. Do 1, refine, then vary"
- "Don't skip the question-driven phase for 'simple' tasks — they're never as simple as they seem"
-->

| # | Date | Lesson | Source |
|---|------|--------|--------|
| 1 | 2026-08-10 | Don't ship a mode that's always degenerate just to look complete. The proportional step model has no working regime — either keep it and *say so* (live regime readout + notes explaining why), or cut it. Shipping it silently as a peer option would have read as a bug. | dots-friend-enemy |
| 2 | 2026-08-10 | Don't average one run of a system whose randomness dominates. The friend graph is a random functional graph; cycle structure changes the result completely. Same preset ranged 6%–36% floor coverage across runs — a single measurement almost caused a bad preset choice. | dots-friend-enemy |
