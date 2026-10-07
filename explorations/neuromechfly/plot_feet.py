"""Where feet land relative to the gaps, from sweep_difficulty.py --contact (raw/gait_*.npz).

Gapped world geometry (flygym GappedTerrainWorld defaults): 1 mm blocks, the first starting at
x = -10 mm, repeating with period P = 1 + gap. A foot at x is over a gap when
u = (x + 10) mod P >= 1.

Touchdown = onset of commanded stance (adhesion switched on) for one leg. At that step we take
the foot (tarsus5 origin) x, and whether ANY tibia/tarsus contact appears within the next
10 ms ("caught"). Null for a terrain-blind gait: a fraction gap / P of touchdowns over gaps.

Usage:
    python plot_feet.py               # reads out/contact.json, writes out/feet.png
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).parent / "out"
RAW = OUT / "raw"
CTRLS = ["cpg", "rule", "hybrid"]
LABEL = {"cpg": "CPG (open loop)", "rule": "Walknet (open loop)", "hybrid": "Hybrid (closed loop)"}
COLOR = {"cpg": "#4C6EF5", "rule": "#F08C00", "hybrid": "#2F9E44"}  # same as plot_matrix.py
X0, BLOCK = -10.0, 1.0
TERRAIN_END_X = 24.0
SKIP_STEPS = 1000  # 0.1 s
CATCH_STEPS = 100  # 10 ms
THR = 1.0


def touchdowns(r):
    f = "gait_{}_{}_d{:g}_{}.npz".format(r["controller"], r["terrain"], r["difficulty"], r["seed"])
    z = np.load(RAW / f)
    st, cn, feet, pos = z["stance"], z["contact_n"] > THR, z["feet"], z["pos"]
    P = BLOCK + r["difficulty"]
    rows = []
    for leg in range(6):
        on = np.flatnonzero(~st[:-1, leg] & st[1:, leg]) + 1
        on = on[(on >= SKIP_STEPS) & (on < len(st) - CATCH_STEPS)]
        prev_x = None
        for i in on:
            x = float(feet[i, leg, 0])
            if pos[i, 0] >= TERRAIN_END_X or x >= TERRAIN_END_X:
                break
            u = (x - X0) % P
            rows.append(dict(
                leg=leg,
                u=u / P,
                over_gap=u >= BLOCK,
                # distance into the gap from the nearer edge (0 when on a block)
                depth=min(u - BLOCK, P - u) if u >= BLOCK else 0.0,
                caught=bool(cn[i:i + CATCH_STEPS, leg].any()),
                stride=None if prev_x is None else x - prev_x,
            ))
            prev_x = x
    return rows


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "contact"
    rs = json.loads((OUT / (tag + ".json")).read_text())
    levels = sorted(d for d in set(r["difficulty"] for r in rs) if d > 0)

    stats, hist = {}, {}
    print("{:>7} {:>5} {:>6} {:>8} {:>6} {:>10} {:>10} {:>8} {:>7}".format(
        "ctrl", "gap", "n_td", "in_gap", "null", "miss|gap", "miss|blk", "stride", "cv"))
    for c in CTRLS:
        for d in levels:
            td = [t for r in rs if r["controller"] == c and r["difficulty"] == d
                  for t in touchdowns(r)]
            g = np.array([t["over_gap"] for t in td])
            caught = np.array([t["caught"] for t in td])
            strides = np.array([t["stride"] for t in td if t["stride"] is not None])
            s = dict(
                n=len(td),
                in_gap=g.mean(),
                null=d / (BLOCK + d),
                miss_gap=(~caught[g]).mean() if g.any() else np.nan,
                miss_block=(~caught[~g]).mean(),
                stride=np.median(strides),
                cv=strides.std() / abs(strides.mean()),
            )
            stats[c, d] = s
            hist[c, d] = np.array([t["u"] for t in td])
            print("{:>7} {:5g} {:6d} {:8.3f} {:6.3f} {:10.3f} {:10.3f} {:8.3f} {:7.2f}".format(
                c, d, s["n"], s["in_gap"], s["null"], s["miss_gap"], s["miss_block"],
                s["stride"], s["cv"]))

    fig = plt.figure(figsize=(16, 8))
    ax = fig.add_subplot(2, 3, 1)
    ax.plot(levels, [d / (BLOCK + d) for d in levels], "k--", lw=1, label="terrain-blind null")
    for c in CTRLS:
        ax.plot(levels, [stats[c, d]["in_gap"] for d in levels], "-o", color=COLOR[c],
                label=LABEL[c], lw=2)
    ax.set_title("touchdowns over a gap", fontsize=10)
    ax.set_xlabel("gap width (mm)")
    ax.legend(fontsize=8)
    ax = fig.add_subplot(2, 3, 2)
    for c in CTRLS:
        ax.plot(levels, [stats[c, d]["miss_gap"] for d in levels], "-o", color=COLOR[c], lw=2)
        ax.plot(levels, [stats[c, d]["miss_block"] for d in levels], ":", color=COLOR[c], lw=1.5)
    ax.set_title("no contact within 10 ms: landed over gap (solid) / on block (dotted)",
                 fontsize=10)
    ax.set_xlabel("gap width (mm)")
    ax = fig.add_subplot(2, 3, 3)
    for c in CTRLS:
        ax.plot(levels, [stats[c, d]["stride"] for d in levels], "-o", color=COLOR[c], lw=2)
    ax.set_title("median stride (same leg, touchdown to touchdown, mm)", fontsize=10)
    ax.set_xlabel("gap width (mm)")
    show = 0.3 if 0.3 in levels else levels[len(levels) // 2]
    for k, c in enumerate(CTRLS):
        ax = fig.add_subplot(2, 3, 4 + k)
        P = BLOCK + show
        ax.axvspan(BLOCK / P, 1, color="0.85", label="gap")
        ax.hist(hist[c, show], bins=24, range=(0, 1), color=COLOR[c], alpha=0.85)
        ax.set_title("{}: touchdown position within one block+gap period, gap {:g} mm".format(
            LABEL[c], show), fontsize=9)
        ax.set_xlabel("position in period (0 = block start, grey = gap)")
    fig.tight_layout()
    path = OUT / "feet.png"
    fig.savefig(path, dpi=120)
    print("\nwrote", path)


if __name__ == "__main__":
    main()
