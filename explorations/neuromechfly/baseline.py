"""Baseline: one CPG-driven fly walking on flat ground, rendered to mp4.

Smoke test for the local flygym 2.1.0 install before the controller x terrain
matrix. Prints the numbers we care about (displacement, speed, throughput).

Run:  C:/Users/caioa/.venvs/flygym/Scripts/python.exe baseline.py
"""

import time
from pathlib import Path

import numpy as np

from flygym import Simulation
from flygym.anatomy import BodySegment
from flygym.compose import FlatGroundWorld
from flygym.utils.math import Rotation3D
from flygym_demo.complex_terrain import (
    CPGController,
    LocomotionAction,
    PreprogrammedSteps,
    apply_locomotion_action,
    make_locomotion_fly,
    make_tripod_cpg_network,
)

OUT = Path(__file__).parent / "out"
OUT.mkdir(parents=True, exist_ok=True)

RUN_TIME = 2.0

fly = make_locomotion_fly(name="baseline", add_adhesion=True, colorize=True)
body_cam = fly.add_tracking_camera(
    name="body_cam",
    pos_offset=(-0.5, -7.5, 0.0),
    rotation=Rotation3D("euler", (1.57, 0.0, 0.0)),
    fovy=30.0,
)

world = FlatGroundWorld()
world.add_fly(fly, [0, 0, 0.5], Rotation3D("quat", [1, 0, 0, 0]))

sim = Simulation(world)
renderer = sim.set_renderer([body_cam])

steps = PreprogrammedSteps()
dof_order = fly.get_actuated_jointdofs_order("position")
cpg = make_tripod_cpg_network(
    timestep=sim.timestep,
    intrinsic_amplitude=1.0,
    coupling_strength=10.0,
    convergence_coef=20.0,
    seed=0,
)
controller = CPGController(
    cpg_network=cpg, preprogrammed_steps=steps, output_dof_order=dof_order
)

print(f"actuated DoFs      : {len(dof_order)}")
print(f"timestep           : {sim.timestep}")
print(f"CPG intrinsic freq : {float(cpg.intrinsic_freqs[0])} Hz")

sim.reset()
apply_locomotion_action(
    sim,
    fly.name,
    LocomotionAction(
        joint_angles=steps.default_pose_by_dof_order(dof_order),
        adhesion_onoff=np.ones(6, dtype=bool),
    ),
)
sim.warmup()

n = int(RUN_TIME / sim.timestep)
thorax_idx = fly.get_bodysegs_order().index(BodySegment("c_thorax"))
pos = np.full((n, 3), np.nan, dtype=np.float32)

t0 = time.perf_counter()
for i in range(n):
    action = controller.step()
    apply_locomotion_action(sim, fly.name, action)
    sim.step_with_profile()
    pos[i] = sim.get_body_positions(fly.name)[thorax_idx]
    sim.render_as_needed_with_profile()
wall = time.perf_counter() - t0

dx = float(pos[-1, 0] - pos[0, 0])
dy = float(pos[-1, 1] - pos[0, 1])
print(f"\nforward displacement : {dx:.2f} mm over {RUN_TIME}s  ({dx / RUN_TIME:.1f} mm/s)")
print(f"lateral drift        : {dy:+.2f} mm")
print(f"thorax z (min/max)   : {pos[:, 2].min():.2f} / {pos[:, 2].max():.2f} mm")
print(f"wall clock           : {wall:.1f}s  ({RUN_TIME / wall:.2f}x realtime)")
print(f"frames rendered      : {len(renderer.frames[body_cam.name])}")

sim.renderer.save_video(OUT / "baseline_cpg_flat.mp4")
print(f"video                -> {OUT / 'baseline_cpg_flat.mp4'}")
