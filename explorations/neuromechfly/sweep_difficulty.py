"""Breaking-point sweep: raise terrain roughness until each controller fails.

Same three controllers as run_matrix.py, same run_one(). Two knobs:
  gapped -> gap_width (mm); block width stays 1.0 mm, gaps 2 mm deep
  blocks -> h, raised checkerboard tiles 0.1+h vs 0.1 mm (h=0 is flat ground)

Runs cells in parallel processes (MuJoCo is single-threaded per sim).

Usage:
    python sweep_difficulty.py --workers 12
    python sweep_difficulty.py --terrains blocks --levels 0 0.1 0.2 --seeds 1
"""

import argparse
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

from run_matrix import OUT, run_one

LEVELS = {
    "gapped": [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8],
    "blocks": [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5],
}


def task(args):
    ctrl, terrain, d, seed, run_time, contact = args
    return run_one(ctrl, terrain, seed, run_time, difficulty=d, measure_contact=contact)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-time", type=float, default=2.0)
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--controllers", nargs="*", default=["cpg", "rule", "hybrid"])
    ap.add_argument("--terrains", nargs="*", default=["gapped", "blocks"])
    ap.add_argument("--levels", nargs="*", type=float, default=None,
                    help="override difficulty levels (applies to every terrain given)")
    ap.add_argument("--tag", default="sweep")
    ap.add_argument("--contact", action="store_true",
                    help="also record measured leg contact forces (raw/gait_*.npz)")
    args = ap.parse_args()

    jobs = [
        (c, t, d, s, args.run_time, args.contact)
        for t in args.terrains
        for d in (args.levels if args.levels is not None else LEVELS[t])
        for c in args.controllers
        for s in range(args.seeds)
    ]
    print(len(jobs), "runs on", args.workers, "workers", flush=True)
    t0 = time.perf_counter()
    results = []
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(task, j) for j in jobs]
        for f in as_completed(futs):
            r = f.result()
            results.append(r)
            print("{:>3}/{} {:>6} {:<6} d={:<5g} s{}  fwd {:7.2f}  z_min {:+.2f}  duty {:.2f}".format(
                len(results), len(jobs), r["controller"], r["terrain"], r["difficulty"],
                r["seed"], r["forward_mm"], r["z_min"], r["duty_factor"]), flush=True)
    results.sort(key=lambda r: (r["terrain"], r["difficulty"], r["controller"], r["seed"]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / (args.tag + ".json")).write_text(json.dumps(results, indent=2))
    print("done in {:.0f} s -> out/{}.json".format(time.perf_counter() - t0, args.tag))


if __name__ == "__main__":
    main()
