"""Breaking-point figure + table from sweep_difficulty.py output.

Breaking point (fixed before looking at the data): the lowest difficulty at which a
controller's median speed falls below 50% of its own median speed at difficulty 0.
On gaps a run is also "trapped" if the thorax drops below the block tops (z < 0) while still
over the terrain. The gapped world ends at x = 25 mm and a full-speed fly reaches it in 2 s, so
the run's own z_min is useless here: it also catches flies that walked off the far edge.

Usage:
    python plot_sweep.py            # reads out/sweep.json, writes out/sweep.png
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
TERRAIN_END_X = 24.0  # gapped blocks stop at x = 25 mm


def trapped(r):
    """Thorax below the block tops while still over the gapped terrain."""
    f = "pos_{}_{}_d{:g}_{}.npy".format(r["controller"], r["terrain"], r["difficulty"], r["seed"])
    pos = np.load(RAW / f)
    over = pos[:, 0] < TERRAIN_END_X
    return bool((pos[over, 2] < 0).any())
CTRLS = ["cpg", "rule", "hybrid"]
LABEL = {"cpg": "CPG (open loop)", "rule": "Walknet (open loop)", "hybrid": "Hybrid (closed loop)"}
COLOR = {"cpg": "#4C6EF5", "rule": "#F08C00", "hybrid": "#2F9E44"}  # same as plot_matrix.py
KNOB = {"gapped": "gap width (mm)", "blocks": "block step height h (mm)"}
BREAK = 0.5


def cells(rs, terrain, ctrl):
    sub = [r for r in rs if r["terrain"] == terrain and r["controller"] == ctrl]
    levels = sorted(set(r["difficulty"] for r in sub))
    return levels, [[r for r in sub if r["difficulty"] == d] for d in levels]


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "sweep"
    rs = json.loads((OUT / (tag + ".json")).read_text())
    terrains = [t for t in ["gapped", "blocks"] if any(r["terrain"] == t for r in rs)]

    fig, axes = plt.subplots(2, len(terrains), figsize=(6 * len(terrains), 7.5), squeeze=False)
    print("breaking point = first level where median speed < {:.0%} of own level-0 speed\n".format(BREAK))
    for j, terrain in enumerate(terrains):
        ax, ax2 = axes[0, j], axes[1, j]
        for ctrl in CTRLS:
            levels, groups = cells(rs, terrain, ctrl)
            if not levels:
                continue
            sp = [np.array([r["speed_mm_s"] for r in g]) for g in groups]
            med = np.array([np.median(s) for s in sp])
            ax.plot(levels, med, "-o", color=COLOR[ctrl], label=LABEL[ctrl], lw=2)
            for d, s in zip(levels, sp):
                ax.scatter([d] * len(s), s, color=COLOR[ctrl], alpha=0.35, s=14)
            base = med[0]
            broke = next((d for d, m in zip(levels, med) if m < BREAK * base), None)
            if broke is not None:
                ax.axvline(broke, color=COLOR[ctrl], ls=":", lw=1.2)
            duty = [np.mean([r["duty_factor"] for r in g]) for g in groups]
            trapped_frac = ([np.mean([trapped(r) for r in g]) for g in groups]
                       if terrain == "gapped" else [0] * len(groups))
            ax2.plot(levels, trapped_frac if terrain == "gapped" else
                     [np.median([r["straightness"] for r in g]) for g in groups],
                     "-o", color=COLOR[ctrl], lw=2)
            print("{:>7} {:>7}  level-0 {:5.1f} mm/s  breaks at {}  duty {:.2f}".format(
                terrain, ctrl, base, "none in range" if broke is None else "{:g}".format(broke),
                np.mean(duty)))
            print("          " + "  ".join(
                "{:g}:{:5.1f}{}".format(d, m, "T" * int(round(t * len(g))) if terrain == "gapped" else "")
                for d, m, t, g in zip(levels, med, trapped_frac, groups)))
        ax.axhline(0, color="k", lw=0.6)
        ax.set_title(terrain + ": median speed (dots = seeds; dotted = breaking point)")
        ax.set_xlabel(KNOB[terrain])
        ax.set_ylabel("forward speed (mm/s)")
        ax.legend(fontsize=8)
        ax2.set_xlabel(KNOB[terrain])
        if terrain == "gapped":
            ax2.set_ylabel("fraction of runs trapped in a gap")
            ax2.set_ylim(-0.05, 1.05)
        else:
            ax2.set_ylabel("median straightness")
        ax2.axhline(0, color="k", lw=0.6)
    fig.tight_layout()
    path = OUT / (tag + ".png")
    fig.savefig(path, dpi=120)
    print("\nwrote", path)


if __name__ == "__main__":
    main()
