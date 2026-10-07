"""Measured ground contact vs commanded stance, from sweep_difficulty.py --contact.

A leg is "down" when the net ground force on its tibia + tarsus segments exceeds THR.
Commanded stance = adhesion on (see run_matrix.py). Per run, over the time the thorax is
still over the terrain (x < 24 mm) and after the first 0.1 s:

  measured duty      fraction of leg-time actually in contact
  missed foothold    P(no contact | commanded stance)  -- a foot that should be down isn't
  drag               P(contact | commanded swing)      -- a foot that should be up isn't
  < 3 down           fraction of time with fewer than three feet actually down

Usage:
    python plot_contact.py            # reads out/contact.json + raw/gait_*.npz
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
TERRAIN_END_X = 24.0
SKIP_STEPS = 1000  # 0.1 s at 0.1 ms
THRS = [0.0, 1.0, 5.0]
THR = 1.0  # headline threshold; the others are a sensitivity check


def metrics(r, thr):
    f = "gait_{}_{}_d{:g}_{}.npz".format(r["controller"], r["terrain"], r["difficulty"], r["seed"])
    z = np.load(RAW / f)
    keep = np.zeros(len(z["pos"]), dtype=bool)
    keep[SKIP_STEPS:] = True
    keep &= z["pos"][:, 0] < TERRAIN_END_X
    st = z["stance"][keep]
    down = z["contact_n"][keep] > thr
    return dict(
        cmd_duty=st.mean(),
        duty=down.mean(),
        missed=(~down)[st].mean(),
        drag=down[~st].mean(),
        under3=(down.sum(1) < 3).mean(),
        under3_cmd=(st.sum(1) < 3).mean(),
        trapped=bool((z["pos"][keep, 2] < 0).any()),
    )


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "contact"
    rs = json.loads((OUT / (tag + ".json")).read_text())
    levels = sorted(set(r["difficulty"] for r in rs))

    table = {}
    for thr in THRS:
        for c in CTRLS:
            for d in levels:
                ms = [metrics(r, thr) for r in rs if r["controller"] == c and r["difficulty"] == d]
                table[thr, c, d] = {k: float(np.mean([m[k] for m in ms])) for k in ms[0]}
                table[thr, c, d]["speed"] = float(np.median(
                    [r["speed_mm_s"] for r in rs if r["controller"] == c and r["difficulty"] == d]))

    for thr in THRS:
        print("\n=== contact threshold {:g} ===".format(thr))
        print("{:>7} {:>5} {:>6} {:>8} {:>6} {:>7} {:>6} {:>7} {:>9} {:>7}".format(
            "ctrl", "gap", "speed", "cmdduty", "duty", "missed", "drag", "<3down", "<3cmd", "trapped"))
        for c in CTRLS:
            for d in levels:
                t = table[thr, c, d]
                print("{:>7} {:5g} {:6.1f} {:8.2f} {:6.2f} {:7.3f} {:6.2f} {:7.3f} {:9.3f} {:7.2f}".format(
                    c, d, t["speed"], t["cmd_duty"], t["duty"], t["missed"], t["drag"],
                    t["under3"], t["under3_cmd"], t["trapped"]))

    fig, axes = plt.subplots(1, 3, figsize=(16, 4.6))
    panels = [
        ("duty", "measured duty factor (solid) vs commanded (dashed)"),
        ("missed", "missed footholds: P(no contact | commanded stance)"),
        ("under3", "time with < 3 feet actually down"),
    ]
    for ax, (key, title) in zip(axes, panels):
        for c in CTRLS:
            ax.plot(levels, [table[THR, c, d][key] for d in levels], "-o", color=COLOR[c],
                    label=LABEL[c], lw=2)
            if key == "duty":
                ax.plot(levels, [table[THR, c, d]["cmd_duty"] for d in levels], "--",
                        color=COLOR[c], lw=1.2)
        ax.set_title(title, fontsize=10)
        ax.set_xlabel("gap width (mm)")
        ax.set_ylim(bottom=0)
    axes[0].legend(fontsize=8)
    fig.suptitle("Gapped terrain, contact threshold {:g}, mean over 3 seeds, "
                 "over-terrain time only".format(THR), fontsize=10)
    fig.tight_layout()
    path = OUT / (tag + ".png")
    fig.savefig(path, dpi=120)
    print("\nwrote", path)


if __name__ == "__main__":
    main()
