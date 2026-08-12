# Data visualization & Sankey best practices
**Version**: 1.0.0
**Author**: Caio Camargo + Claude
**Date Created**: 2026-08-12
**Last Updated**: 2026-08-12
**Purpose**: Distilled best-practice research for chart work in this workspace, with a Sankey deep-dive; produced while iterating `explorations/journey-markov/sankey.html`
**Status**: Active

---

## Part 1 — General principles (any chart)

Condensed from the bundled `dataviz` skill (Claude Code), which is itself a
design-system-agnostic method; cross-checked against the external sources in Part 4.

1. **Form first, color last.** The data's job (magnitude, identity, polarity, flow,
   a single headline number) picks the chart type. Most bad charts picked colors first.
   Sometimes the right form is *not a chart* (a stat tile, a table).
2. **Color has exactly four jobs**: categorical (identity), sequential (magnitude, one hue
   light→dark), diverging (polarity, two opposing hues + neutral gray midpoint), status
   (reserved good/bad tokens). Never mix jobs; never rainbow; assign categorical hues in a
   fixed order and never cycle past ~8 — fold the tail into "Other" instead.
3. **Validate, don't eyeball**: colorblind-safety is computable (the skill ships a
   validator; adjacent-pair CVD ΔE ≥ 8 in OKLab×100).
4. **Thin marks, recessive chrome**: hairline solid grids, generous padding, saturated
   fills only for small marks. Separate touching fills with a 2px surface gap, not borders.
5. **Label selectively**: a legend for ≥2 series, direct labels on the few marks that
   matter, tooltips for the rest — but tooltips must *enhance*, never be the only way to a
   value (a table view is the accessibility floor).
6. **One axis**; never dual y-scales. **Emphasis** (one series in color, rest gray) is the
   most underused fix for "make this clearer."
7. **Render it and look at it.** Numeric checks don't catch label collisions, misleading
   geometry, or optical lies. (Local lesson: every layout bug in journey-markov was caught
   by screenshots, never by assertions.)

## Part 2 — Sankey-specific

### When a Sankey is right — and wrong

- **Right**: showing where quantities *go* — flows between stages, splits and merges,
  attribution, drop-off along a process. The reader's question is "how does volume move?"
- **Wrong**: precise value comparison or ranking (bar chart wins), cyclic/bidirectional
  flows (network diagram), data with a real time axis (line), or when flows are all
  similar widths (differentiation dies).
- **Scale limits**: legibility fades past roughly 30–40 nodes depending on link density;
  below ~10 nodes a stacked bar says the same thing faster. Cap visible flows to the ones
  that carry the story.
- **Alluvial variant**: when the same population re-sorts across ordered stages (our
  step-indexed journey chart is exactly this — nodes duplicated per stage), the alluvial
  conventions apply: consistent node identity per column, stage headers, left→right time.

### The five classic mistakes (datasketch) — all fixable mechanically

1. **Inaccurate proportions** — width must equal value everywhere; verify conservation
   programmatically (inflow = outflow per node/column).
2. **Spaghetti effect** — too many thin crossing flows; fold minors into "Other," push
   detail into hover.
3. **Illogical node order** — default/alphabetical ordering maximizes crossings; order
   nodes within a column by flow size (largest first) or to minimize crossings; node
   ordering is the main anti-crossing tool.
4. **Color without purpose** — color by category or by the one flow that matters; soft
   tones for the mass, bold reserved for the key path (the "emphasis" principle again).
5. **Invisible or overwhelming labels** — label nodes clearly, label only essential flows,
   hover carries the rest.

### Journey-funnel conventions (drop-off Sankeys specifically)

- **The Exit convention**: at every stage, a band leaves to "Exit/Drop-off"; its width *is*
  the drop-off at that step. These leave as **short local stubs** (typically downward, or
  to a thin terminal node), labeled with the count — they do **not** arc across the whole
  chart to a distant terminal, which would manufacture exactly the crossings node-ordering
  exists to prevent.
- Terminal outcomes (converted vs dropped) read best when each stage's outcome exits
  *near that stage*, with a small cumulative total somewhere fixed. A single full-width
  terminal band spanning all columns is not a convention found anywhere in the surveyed
  material.
- Transparency on links is standard; flows inherit the source node's color (or the
  category color), and the conversion path may use the bold/status color as the one
  emphasized flow.

## Part 3 — Critique of `journey-markov/sankey.html` v1 against this

| Check | Verdict |
|---|---|
| Proportions / conservation | ✅ verified programmatically (245 = 37+180+28, per-column balance) |
| Tail folding | ✅ "(other prop)" per property |
| Hover detail + counts | ✅; but no table-view twin yet (a11y floor) |
| Stage headers, left→right | ✅ |
| **BOOKED band** | ❌ the main violation — a full-width top band with green ribbons arcing over up to five columns; invents crossings, reads as chrome rather than a node, and its left edge is disconnected from any inflow |
| EXIT band | ⚠️ same pattern but bottom; less harmful (stubs are shorter) yet also non-standard |
| Node ordering in columns | ⚠️ grouped by property (www→docs→dashboard), not by size / crossing-minimization; contributes to mid-column spaghetti |
| Color purpose | ⚠️ property-categorical everywhere + green emphasis is right in spirit, but the orange dashboard mass is as loud as the story flows; soft-tone the mass, keep bold for the booking path |
| Flow opacity | ✅ after v1 fix (thin flows recede) |

### Prioritized recommendations for v1.5 — all applied 2026-08-12

1. ✅ **Kill the top band.** Booked exits leave the gate as a short upward stub per column,
   labeled with the count ("16 book"), plus fixed cumulative totals in the corners. EXIT
   likewise: short downward stubs per column, labeled at the majors.
2. ✅ **Re-order within columns** — with a finding worth keeping: pure size-sorting (the
   generic advice) was **tested and rejected**. With the gate pinned at the top, raw size
   put the orange dashboard mass on top and stretched the gate's feeder lane across the
   column — *more* crossings, not fewer. The generic rule assumes free node placement;
   with a fixed anchor, keeping the anchor's feeder group adjacent beats raw size. Final
   order: gate → www → docs → dashboard (each group's "other" folded behind it), size-sorted
   within groups.
3. ✅ **Soften the mass**: non-www flows run at roughly half the story lane's opacity;
   green stubs are the boldest element. (Also fixed while here: the vertical scale ignored
   inter-node gaps, silently overflowing the densest column — budget = usable height minus
   that column's gaps, take the tightest column.)
4. ✅ **Table-view twin**: collapsible per-step and per-page-per-step tables under the SVG;
   sums cross-checked against the diagram (245 = 37 + 180 + 28).

## Part 4 — Sources

- Bundled `dataviz` skill (Claude Code 2.1.222): `choosing-a-form.md`,
  `anti-patterns.md`, `palette.md` — the general method in Part 1.
- [Data-to-Viz — Sankey diagram](https://www.data-to-viz.com/graph/sankey.html) — definition, node-position/crossing caveats.
- [datasketch — The 5 most common mistakes in designing a Sankey](https://datasketch.blog/en/post/the-5-most-common-mistakes-in-designing-a-sankey-diagram-and-how-to-avoid-them/) — the mistake catalog in Part 2.
- [UNHCR dataviz guidelines — Flow charts/Sankey](https://dataviz.unhcr.org/chart-types/flow/) — crossing minimization, transparency, when-not-to-use.
- [Domo — Sankey Diagrams explained](https://www.domo.com/learn/charts/sankey-diagrams) · [ChartMekko — When to use Sankey charts](https://www.chartmekko.com/blog/when-to-use-sankey-charts) — use cases, scale limits, when-not.
- [Express Analytics — Customer journey Sankeys](https://www.expressanalytics.com/blog/visualizing-customer-journey-using-sankey-diagram) · [Metabase — User journey analysis with Sankey](https://www.metabase.com/community-posts/user-journey-analysis-with-metabase-sankey-charts-and-sql) — the per-stage Exit-node convention.
- [Plotly — Deep dive on Sankey diagrams](https://plotly.com/blog/sankey-diagrams/) · [Flourish — Sankey/alluvial data formats](https://helpcenter.flourish.studio/hc/en-us/articles/8761554327183-How-to-format-your-data-to-build-Sankeys-and-alluvial-diagrams) — alluvial variant, tooling conventions.
