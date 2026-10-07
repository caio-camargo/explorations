"""Does slowing the tripod CPG make it survive gaps? (the tempo hypothesis, NOTES §11-12)

Reads out/tempo.json (cpg@9, cpg@6.4, cpg@4 from sweep_difficulty.py --contact) and
out/contact.json (cpg at its default 12 Hz, Walknet, hybrid), all on gapped terrain.

Per controller x gap width: median speed, median stride, fraction of runs trapped in a gap,
median swing duration, and the share of swing-phase ground contacts whose foot is near the
far wall of a gap (within 0.1 mm before the next block's face) against that zone's area share.

Usage:
    python plot_tempo.py              # writes out/tempo.png
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from plot_feet import BLOCK, RAW, SKIP_STEPS, TERRAIN_END_X, THR, X0, touchdowns

OUT = Path(__file__).parent / "out"
CTRLS = ["cpg", "cpg@9", "cpg@6.4", "cpg@4", "rule"]
LABEL = {"cpg": "CPG 12 Hz (default)", "cpg@9": "CPG 9 Hz", "cpg@6.4": "CPG 6.4 Hz",
         "cpg@4": "CPG 4 Hz", "rule": "Walknet (~6.4 steps/s)"}
COLOR = {"cpg": "#4C6EF5", "cpg@9": "#748FFC", "cpg@6.4": "#9775FA", "cpg@4": "#C0A8FF",
         "rule": "#F08C00"}
WALL_ZONE = 0.1  # mm before the next block's face


def gait(r):
    f = "gait_{}_gapped_d{:g}_{}.npz".format(r["controller"], r["difficulty"], r["seed"])
    return np.load(RAW / f)


def run_stats(r):
    z = gait(r)
    st, cn = z["stance"][SKIP_STEPS:], z["contact_n"][SKIP_STEPS:] > THR
    fx, pos = z["feet"][SKIP_STEPS:, :, 0], z["pos"][SKIP_STEPS:]
    ok = pos[:, 0] < TERRAIN_END_X
    swings, near = [], []
    P = BLOCK + r["difficulty"]
    for leg in range(6):
        s = st[ok, leg].astype(int)
        e = np.flatnonzero(np.diff(s))
        runs, kinds = np.diff(e), s[e[1:]]
        swings += list(runs[kinds == 0])
        if r["difficulty"] > 0:
            u = (fx[ok, leg] - X0) % P
            m = ~st[ok, leg] & cn[ok, leg]
            near += list(u[m] >= P - WALL_ZONE)
    return dict(
        trapped=bool((pos[ok, 2] < 0).any()),
        swing_ms=np.median(swings) / 10 if swings else np.nan,
        near=near,
    )


def main():
    rs = [r for r in json.loads((OUT / "contact.json").read_text())
          if r["controller"] in ("cpg", "rule")]
    rs += json.loads((OUT / "tempo.json").read_text())
    levels = sorted(set(r["difficulty"] for r in rs))

    table = {}
    print("{:>8} {:>5} {:>6} {:>7} {:>8} {:>9} {:>10}".format(
        "ctrl", "gap", "speed", "stride", "trapped", "swing_ms", "near_wall"))
    for c in CTRLS:
        for d in levels:
            cell = [r for r in rs if r["controller"] == c and r["difficulty"] == d]
            ss = [run_stats(r) for r in cell]
            strides = [t["stride"] for r in cell for t in touchdowns(r) if t["stride"] is not None]
            near = [x for s in ss for x in s["near"]]
            t = dict(
                speed=float(np.median([r["speed_mm_s"] for r in cell])),
                stride=float(np.median(strides)),
                trapped=float(np.mean([s["trapped"] for s in ss])),
                swing=float(np.median([s["swing_ms"] for s in ss])),
                near=float(np.mean(near)) if near else np.nan,
            )
            table[c, d] = t
            print("{:>8} {:5g} {:6.1f} {:7.2f} {:8.2f} {:9.1f} {:10}".format(
                c, d, t["speed"], t["stride"], t["trapped"], t["swing"],
                "-" if d == 0 else "{:.2f} ({:.2f})".format(t["near"], WALL_ZONE / (BLOCK + d))))

    fig, axes = plt.subplots(1, 4, figsize=(18, 4.4))
    panels = [("speed", "median speed (mm/s)"), ("stride", "median stride (mm)"),
              ("trapped", "fraction of runs trapped in a gap"),
              ("near", "swing contacts near the far wall (dashed: area share)")]
    for ax, (key, title) in zip(axes, panels):
        xs = levels if key != "near" else [d for d in levels if d > 0]
        for c in CTRLS:
            ax.plot(xs, [table[c, d][key] for d in xs], "-o", color=COLOR[c], label=LABEL[c],
                    lw=2.4 if c in ("cpg@6.4", "rule") else 1.6)
        if key == "near":
            ax.plot(xs, [WALL_ZONE / (BLOCK + d) for d in xs], "k--", lw=1)
        ax.set_title(title, fontsize=10)
        ax.set_xlabel("gap width (mm)")
    axes[0].legend(fontsize=8)
    fig.tight_layout()
    path = OUT / "tempo.png"
    fig.savefig(path, dpi=120)
    print("\nwrote", path)


if __name__ == "__main__":
    main()
