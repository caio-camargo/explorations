"""Turn out/matrix.json into a figure: speed and straightness per controller x terrain.

Run:  python plot_matrix.py [--tag matrix]
"""

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).parent / "out"

CTRL_ORDER = ["cpg", "rule", "hybrid"]
CTRL_LABEL = {
    "cpg": "CPG\n(open loop)",
    "rule": "Walknet\n(open loop)",
    "hybrid": "Hybrid\n(closed loop)",
}
CTRL_COLOR = {"cpg": "#4C6EF5", "rule": "#F08C00", "hybrid": "#2F9E44"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="matrix")
    args = ap.parse_args()

    results = json.loads((OUT / (args.tag + ".json")).read_text())
    terrains = []
    for r in results:
        if r["terrain"] not in terrains:
            terrains.append(r["terrain"])
    controllers = [c for c in CTRL_ORDER if any(r["controller"] == c for r in results)]

    def agg(ctrl, terrain, key):
        vals = [
            r[key]
            for r in results
            if r["controller"] == ctrl and r["terrain"] == terrain
        ]
        a = np.array(vals, dtype=float)
        return a.mean(), a.std()

    fig, axes = plt.subplots(2, 1, figsize=(8, 6.5), tight_layout=True, sharex=True)
    x = np.arange(len(terrains))
    width = 0.8 / len(controllers)

    for panel, (key, ylabel, title) in enumerate(
        [
            ("speed_mm_s", "Forward speed (mm/s)", "How fast does it get anywhere?"),
            ("straightness", "Straightness (net fwd / path)", "Is the motion going anywhere?"),
        ]
    ):
        ax = axes[panel]
        for ci, ctrl in enumerate(controllers):
            means = [agg(ctrl, t, key)[0] for t in terrains]
            sds = [agg(ctrl, t, key)[1] for t in terrains]
            ax.bar(
                x + ci * width - 0.4 + width / 2,
                means,
                width,
                yerr=sds,
                capsize=3,
                color=CTRL_COLOR[ctrl],
                label=CTRL_LABEL[ctrl] if panel == 0 else None,
                edgecolor="white",
                linewidth=0.6,
            )
        ax.axhline(0, color="#444", linewidth=0.8)
        ax.set_ylabel(ylabel)
        ax.set_title(title, loc="left", fontsize=11)
        ax.grid(axis="y", alpha=0.25)
        ax.set_axisbelow(True)

    axes[-1].set_xticks(x, terrains)
    axes[-1].set_xlabel("Terrain")
    axes[0].legend(ncols=3, fontsize=9, frameon=False)
    fig.suptitle(
        "NeuroMechFly v2 - leg coordination x terrain"
        "\nsame single-leg step trajectories throughout; 2 s runs, 3 seeds",
        fontsize=11,
    )
    path = OUT / (args.tag + ".png")
    fig.savefig(path, dpi=150)
    print("->", path)


if __name__ == "__main__":
    main()
