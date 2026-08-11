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
