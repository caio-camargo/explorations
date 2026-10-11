# Playbook: Project review (launchpad)
**Version**: v1.0.0
**Last Updated**: 2026-10-11
**Purpose**: A whole-project review: where the milestones stand and what blocks them, whether the build lives up to
the pillars, and design debt and doc health. Produces `explorations/launchpad/REVIEW-<date>.md` and a decisions round.
**Trigger**: the end of each milestone (ROADMAP § Documents rule 8), or when Caio asks for a general review.

## Research Basis
**Last researched**: 2026-10-11 (first run; no `/research-workflow` was available in that session, so the basis is
the run itself and its lessons).
**Research doc**: the first run, [`REVIEW-2026-10-11.md`](../explorations/launchpad/REVIEW-2026-10-11.md)
**Key findings incorporated**:
- Three independent read-only audits, each with evidence pointers, beat one long pass: they catch different things
  *(2026-10-11 run)*
- Most drift came from one decision written in several places *(2026-10-11 run → ROADMAP § Documents)*
**Review trigger**: after each run, fold its lessons in here.

## Inputs Required
- Nothing from Caio to start. A pull of `main` first.

## Process
1. **Pull**, read ROADMAP (pillars, milestones), the top of QUEUE, the last ~15 SESSION_LOG entries, ACTIVE_WORK.
2. **Run three read-only audits in parallel** (subagents, each told to give file and item evidence and a ranked top 5):
   - **A, milestones and blockers:** each finish-line criterion of the current and next milestone, met / not met /
     unknown and what blocks it; QUEUE counts by lane and state; lanes with no recent session; open P1/P2 in PLAYTEST;
     stuck items (blocked on something done, claimed with no session, duplicates).
   - **B, pillars against the build:** per pillar, what serves it and what works against it (NOTES, PLAYTEST, code);
     systems a new player never discovers; the top 5 gaps.
   - **C, design debt and doc health:** contradictions between docs and with DECISIONS; stale content and headers;
     decisions never played or measured; which later designs recent decisions touch; doc sizes and missing pointers.
     (Once `check_docs.mjs` exists, run it first and give C its output.)
3. **Merge into `REVIEW-<date>.md`:** the short version (4–5 bullets); milestones and blockers (a table per
   milestone, bottlenecks ranked); pillar gaps ranked; design debt and doc health; next steps ranked (build, then
   design); the calls for Caio with defaults.
4. **Open a D row** for the calls; add the build follow-ups under QUEUE *Proposed*; add the review to ROADMAP's
   catalog table and INDEX.
5. **Tell Caio** in chat: the short version, the ranked steps, the calls with defaults.
6. **When he answers:** one line per call in DECISIONS, ripple them through the docs (ROADMAP § Documents rule 3), take
   the D row out of QUEUE, and sweep the doc-health findings.

## Output Specification
- `REVIEW-<date>.md` under ~150 lines, standard header, evidence as file and item IDs, every finding actionable.
- The chat summary fits on one screen.

## Quality Checklist
- [ ] Every claim has a pointer (file:line, section, or item ID)
- [ ] Bottlenecks and gaps are ranked, not listed
- [ ] Each call has a recommended default
- [ ] Nothing in the review restates a decision; it links DECISIONS
- [ ] The answers were rippled and the D row removed

## Best Practices
- Read-only audits only; the design desk does the edits afterwards, in small commits (other sessions edit QUEUE often:
  pull right before each QUEUE edit and push right after).
- Distinguish "the code is wrong" from "the doc is stale": the second is cheaper and more common.
- Re-run the robot playtest numbers before trusting a "met" that predates big screen changes.

## Version History
- v1.0.0 — Initial version, from the 2026-10-11 review.
