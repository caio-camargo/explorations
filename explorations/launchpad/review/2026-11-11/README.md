# Review 2 scripts (2026-11-11)
**Version**: 1.0.0 · **Author**: Caio Camargo + Claude (Fable 5.2, review 2 session) · **Created**: 2026-11-11 · **Updated**: 2026-11-11
**Status**: evidence for [`../../REVIEW-2026-11-11.md`](../../REVIEW-2026-11-11.md); not part of the test suite.
**Purpose**: The repro and prototype scripts that review cites, so a session taking a task can run its evidence first.
Each reads the game from `../../` and writes nothing there. Run from this folder with `node <file>`.

| File | Shows |
|---|---|
| `h.mjs`, `sim.mjs` | harnesses: the SIM built as `test.mjs` builds it (`sim.mjs` adds `ev(code)`, an eval in the SIM's scope) |
| `r14.mjs`, `r1b.mjs`, `r21.mjs` | the audit of fixes R14, R1b and R21 |
| `iso.mjs <files>` | R2's prototype: the same sections with a shared SIM and with a fresh one each (e.g. `node iso.mjs economy,vehicle`; minutes) |
| `swallow.mjs` | R3(a)'s prototype: code swallowed by a `//` comment, before R4 and now |
| `r23a.mjs` … `r23e.mjs` | R23's items (`FIX=1 node r23e.mjs` for the comparison) |
| `r13.mjs [b-h]`, `r13a.mjs` | R13's items |
| `app/harness.cjs` | the page headless: all 47 scripts in one `vm` context with DOM, storage and GL stubs (`A_harness.cjs`, `B_loadall.cjs` are two forks' variants) |
| `app/A_rollout_click.cjs`, `app/A_builder_state.cjs` | R28, R30, parts of R32 |
| `app/t2_flyrevert.cjs`, `app/t4_newprog_reload.cjs`, `app/t6_more.cjs` | R29, R31, R32 |
| `app/t3_misc.cjs`, `app/t5_lifecycle.cjs [revert\|end]` | R30, R31 |
| `app/B_sound.cjs`, `app/B_reach.cjs`, `app/B_glsl.cjs`, `app/B_glrun.cjs` | R32 (sound), R33 and the shader checks |
| `app/scan.cjs` (`node --expose-internals`), `app/scan2.cjs`, `scan2b.cjs`, `scan3.cjs`, `scan4.cjs`, `app/A_deps.cjs` | R3(b) and the other mechanical passes |
| `app/monkey.cjs` | the random walk over player-reachable actions |

When R34 adopts the harness into `tests/`, move this folder to `archive/`.
