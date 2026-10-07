"""Controller x terrain matrix for NeuroMechFly v2.

Question: on flat ground, does it matter which leg-coordination scheme you use?
And when the ground stops being flat, which schemes survive?

Three controllers, all sharing the same PreprogrammedSteps single-leg trajectories,
so the ONLY thing that varies is how the six legs decide when to step:

  cpg     - six coupled oscillators, phase-locked into a tripod. Open loop:
            nothing about the ground reaches the coordination layer.
  rule    - Walknet. Each leg decides locally from its neighbours' states.
            Also open loop with respect to the terrain.
  hybrid  - tripod CPG plus local retraction/stumbling corrections driven by
            leg proprioception and contact. The only closed-loop scheme.

Usage:
    python run_matrix.py --run-time 2.0 --seeds 3
    python run_matrix.py --video cpg:flat hybrid:mixed
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np

from flygym import Simulation
from flygym.anatomy import BodySegment, ContactBodiesPreset
from flygym.compose import (
    BlocksTerrainWorld,
    FlatGroundWorld,
    GappedTerrainWorld,
    MixedTerrainWorld,
)
from flygym.utils.math import Rotation3D
from flygym_demo.complex_terrain import (
    CPGController,
    HybridController,
    HybridControllerObservation,
    LocomotionAction,
    PreprogrammedSteps,
    RuleBasedController,
    apply_locomotion_action,
    construct_rules_graph,
    make_locomotion_fly,
    make_tripod_cpg_network,
)

OUT = Path(__file__).parent / "out"
RAW = OUT / "raw"

RULE_WEIGHTS = {
    "rule1": -10.0,
    "rule2_ipsi": 2.5,
    "rule2_contra": 1.0,
    "rule3_ipsi": 3.0,
    "rule3_contra": 2.0,
}


LEG_CONTACT_SEGS = ["tibia", "tarsus1", "tarsus2", "tarsus3", "tarsus4", "tarsus5"]

ROUGH_KWARGS = dict(
    bodysegs_with_ground_contact=ContactBodiesPreset.TIBIA_TARSUS_ONLY,
    add_ground_contact_sensors=False,
)


def make_world(terrain, difficulty=None, rand_seed=0):
    """Returns (world, spawn_pos, add_fly_kwargs).

    `difficulty` overrides the terrain's roughness knob:
      gapped -> gap_width (mm), blocks -> block height amplitude (mm).
    `rand_seed` picks the terrain realization for the randomized worlds.
    """
    if terrain == "flat":
        return FlatGroundWorld(), [0, 0, 0.5], {}
    if terrain == "gapped":
        kw = {} if difficulty is None else dict(gap_width=difficulty)
        return GappedTerrainWorld(**kw), [0, 0, 1.2], dict(ROUGH_KWARGS)
    if terrain == "blocks":
        kw = dict(rand_seed=rand_seed)
        if difficulty is not None:
            kw["height_range"] = (difficulty, difficulty)
        return BlocksTerrainWorld(**kw), [0, 0, 1.2], dict(ROUGH_KWARGS)
    if terrain == "mixed":
        return (
            MixedTerrainWorld(rand_seed=rand_seed),
            [0, 0, 1.2],
            dict(ROUGH_KWARGS),
        )
    raise ValueError("unknown terrain: " + repr(terrain))


def make_controller(kind, sim, dof_order, steps, seed):
    if kind == "cpg":
        cpg = make_tripod_cpg_network(
            timestep=sim.timestep,
            intrinsic_amplitude=1.0,
            coupling_strength=10.0,
            convergence_coef=20.0,
            seed=seed,
        )
        return CPGController(
            cpg_network=cpg, preprogrammed_steps=steps, output_dof_order=dof_order
        )
    if kind == "rule":
        return RuleBasedController(
            timestep=sim.timestep,
            rules_graph=construct_rules_graph(),
            weights=RULE_WEIGHTS,
            preprogrammed_steps=steps,
            output_dof_order=dof_order,
            seed=seed,
        )
    if kind == "hybrid":
        return HybridController(
            timestep=sim.timestep,
            preprogrammed_steps=steps,
            output_dof_order=dof_order,
        )
    raise ValueError("unknown controller: " + repr(kind))


def run_one(
    controller_kind,
    terrain,
    seed,
    run_time,
    record_video=False,
    difficulty=None,
    measure_contact=False,
):
    fly = make_locomotion_fly(
        name=controller_kind + "_" + terrain + "_" + str(seed),
        add_adhesion=True,
        colorize=True,
    )
    cams = []
    if record_video:
        cams.append(
            fly.add_tracking_camera(
                name="body_cam",
                pos_offset=(-0.5, -7.5, 0.0),
                rotation=Rotation3D("euler", (1.57, 0.0, 0.0)),
                fovy=35.0,
            )
        )

    # seed drives BOTH the controller's initial state and the terrain realization,
    # so a given seed presents every controller with the same world (paired comparison).
    world, spawn_pos, kwargs = make_world(terrain, difficulty, rand_seed=seed)
    world.add_fly(fly, spawn_pos, Rotation3D("quat", [1, 0, 0, 0]), **kwargs)

    sim = Simulation(world)
    if record_video:
        sim.set_renderer(cams, camera_res=(320, 440), playback_speed=0.1, output_fps=25)

    steps = PreprogrammedSteps()
    dof_order = fly.get_actuated_jointdofs_order("position")
    controller = make_controller(controller_kind, sim, dof_order, steps, seed)

    sim.reset()
    if hasattr(controller, "reset"):
        try:
            controller.reset(seed=seed)
        except TypeError:
            controller.reset()
    apply_locomotion_action(
        sim,
        fly.name,
        LocomotionAction(
            joint_angles=steps.default_pose_by_dof_order(dof_order),
            adhesion_onoff=np.ones(6, dtype=bool),
        ),
    )
    sim.warmup()

    n = int(run_time / sim.timestep)
    thorax_idx = fly.get_bodysegs_order().index(BodySegment("c_thorax"))
    pos = np.full((n, 3), np.nan, dtype=np.float32)
    # commanded stance per leg: every controller turns adhesion on exactly when a
    # leg's phase is outside its swing window, so this is the gait's intended duty factor
    stance = np.zeros((n, 6), dtype=bool)
    # measured contact: net ground force on each leg's tibia + tarsus segments, read from
    # MuJoCo's contact list (flygym's per-leg sensors don't exist on multi-geom terrain)
    if measure_contact:
        legs = fly.get_legs_order()
        leg_segs = [leg + "_" + s for leg in legs for s in LEG_CONTACT_SEGS]
        contact_n = np.zeros((n, 6), dtype=np.float32)

    needs_obs = controller_kind == "hybrid"
    t0 = time.perf_counter()
    for i in range(n):
        if needs_obs:
            obs = HybridControllerObservation.from_sim(sim, fly.name)
            action = controller.step(obs)
        else:
            action = controller.step()
        apply_locomotion_action(sim, fly.name, action)
        if action.adhesion_onoff is not None:
            stance[i] = action.adhesion_onoff
        sim.step_with_profile()
        pos[i] = sim.get_body_positions(fly.name)[thorax_idx]
        if measure_contact:
            f = sim.get_bodysegment_contact_forces(fly.name, leg_segs)
            contact_n[i] = np.linalg.norm(f, axis=1).reshape(6, -1).sum(1)
        if record_video:
            sim.render_as_needed_with_profile()
    wall = time.perf_counter() - t0

    dx = float(pos[-1, 0] - pos[0, 0])
    dy = float(pos[-1, 1] - pos[0, 1])
    # path straightness: net forward displacement / total planar path length
    seg = np.linalg.norm(np.diff(pos[:, :2], axis=0), axis=1)
    path_len = float(np.nansum(seg))

    result = dict(
        controller=controller_kind,
        terrain=terrain,
        difficulty=difficulty,
        seed=seed,
        run_time=run_time,
        forward_mm=dx,
        speed_mm_s=dx / run_time,
        lateral_mm=dy,
        path_len_mm=path_len,
        straightness=(dx / path_len) if path_len > 0 else float("nan"),
        z_mean=float(np.nanmean(pos[:, 2])),
        z_min=float(np.nanmin(pos[:, 2])),
        z_max=float(np.nanmax(pos[:, 2])),
        z_std=float(np.nanstd(pos[:, 2])),
        duty_factor=float(stance.mean()),
        legs_down_mean=float(stance.sum(1).mean()),
        frac_under3_down=float((stance.sum(1) < 3).mean()),
        wall_s=wall,
        x_realtime=run_time / wall,
    )
    if record_video:
        OUT.mkdir(parents=True, exist_ok=True)
        suffix = "" if difficulty is None else "_d{:g}".format(difficulty)
        path = OUT / (controller_kind + "_" + terrain + suffix + ".mp4")
        sim.renderer.save_video(path)
        result["video"] = path.name
    RAW.mkdir(parents=True, exist_ok=True)
    dtag = "" if difficulty is None else "_d{:g}".format(difficulty)
    if measure_contact:
        np.savez_compressed(
            RAW / ("gait_" + controller_kind + "_" + terrain + dtag + "_" + str(seed) + ".npz"),
            pos=pos,
            stance=stance,
            contact_n=contact_n,
        )
    np.save(
        RAW / ("pos_" + controller_kind + "_" + terrain + dtag + "_" + str(seed) + ".npy"),
        pos,
    )
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-time", type=float, default=2.0)
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--controllers", nargs="*", default=["cpg", "rule", "hybrid"])
    ap.add_argument(
        "--terrains", nargs="*", default=["flat", "gapped", "blocks", "mixed"]
    )
    ap.add_argument(
        "--difficulty",
        type=float,
        default=None,
        help="override terrain roughness knob (gapped: gap_width, blocks: height)",
    )
    ap.add_argument("--video", nargs="*", default=[], help="cells to record, e.g. cpg:flat")
    ap.add_argument("--tag", default="matrix", help="output json basename")
    ap.add_argument("--video-seed", type=int, default=0, help="which seed to record")
    args = ap.parse_args()

    video_cells = set(tuple(v.split(":")) for v in args.video)
    results = []
    for terrain in args.terrains:
        for ctrl in args.controllers:
            for seed in range(args.seeds):
                rec = (ctrl, terrain) in video_cells and seed == args.video_seed
                r = run_one(
                    ctrl,
                    terrain,
                    seed,
                    args.run_time,
                    record_video=rec,
                    difficulty=args.difficulty,
                )
                results.append(r)
                print(
                    "{:>6} / {:<5} seed{}  fwd {:7.2f} mm ({:6.1f} mm/s)  "
                    "lat {:+6.2f}  straight {:5.2f}  z {:.2f}+-{:.2f}  [{:.2f}x rt]{}".format(
                        ctrl,
                        terrain,
                        seed,
                        r["forward_mm"],
                        r["speed_mm_s"],
                        r["lateral_mm"],
                        r["straightness"],
                        r["z_mean"],
                        r["z_std"],
                        r["x_realtime"],
                        "  *video" if rec else "",
                    ),
                    flush=True,
                )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / (args.tag + ".json")).write_text(json.dumps(results, indent=2))

    print("\n=== summary (mean +- sd over seeds) ===")
    print("{:>10} {:>8} {:>16} {:>16}".format("controller", "terrain", "speed mm/s", "straightness"))
    for terrain in args.terrains:
        for ctrl in args.controllers:
            rs = [r for r in results if r["controller"] == ctrl and r["terrain"] == terrain]
            if not rs:
                continue
            sp = np.array([r["speed_mm_s"] for r in rs])
            st = np.array([r["straightness"] for r in rs])
            print(
                "{:>10} {:>8} {:9.1f} +-{:4.1f} {:10.2f} +-{:4.2f}".format(
                    ctrl, terrain, sp.mean(), sp.std(), st.mean(), st.std()
                )
            )


if __name__ == "__main__":
    main()
