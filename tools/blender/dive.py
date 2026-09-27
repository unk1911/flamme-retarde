#!/usr/bin/env python3
"""The diver at the skakaonica: his poses, his physics, and the clips he ships.

    tools/blender/blender.sh -b -P tools/blender/dive.py -- --sim [--strip 3 --range 108:196]
    tools/blender/blender.sh -b -P tools/blender/dive.py -- --poses STAND,LOAD,PIKE
    tools/blender/blender.sh -b -P tools/blender/dive.py -- --ladder | --calib | --clips
    blender -b -noaudio -P tools/blender/bathers_v2.py -- --only man_young_fit   # ships it

Misha, 27 Sep 2026, of a first version built another way: "it wasn't anywhere
near a quality product ... can u see if u can make this diving person awesome".
That one bent a crowd bather's walk and idle clips with figure-space aims and
slid the figure along a hand-drawn arc. This one is SOLVED, end to end, on the
diver's own skeleton (man_young_fit, 1.84 m, 80 kg), and baked:

  walk     four steps of the shared WALK, the stance foot pinned so nothing
           slides (the planted foot is the one with heel AND ball down)
  hurdle   a push off the planted foot, a parabola for the centre of mass,
           mirrored to whichever foot the walk left down
  board    the diver and the plank as ONE sprung mass (K_LAND at the landing
           point, M_BOARD, ZETA); he leaves as it comes back up through flat.
           His legs follow it rather than drive it — a prescribed leg motion
           can push with any force at all, which launched a first version at
           8.9 m/s. Takeoff is the recoil plus his extension: 2.3 + 1.1 m/s.
  flight   ballistic centre of mass; ANGULAR MOMENTUM CONSERVED — the pelvis
           turns at (L - L_internal) / I with I and L_internal off the posed
           segments (de Leva masses), so the pike spins him faster and opening
           out slows him. The takeoff spin is bisected for 182 degrees at the
           moment his fingertips reach the water.
  under    quadratic drag to a stop, a Hermite arc forward and up, the tread.
  ladder   every hand and foot on a rung is two-bone IK'd onto the rung on the
           real rig (`solve_limbs`); a mantle onto the deck; standing.

`dive_clips` returns `dive`, `ladder`, his own gentler `swim`, and `tread`,
and writes build/payload/dive.json (the board's tip deflection per frame, the
tip's place in the clip, the entry, and where each clip hands over) for
src/43-jadrija.js, which only places and chains them.

THE RIG HAS TO BE BUILT RIGHT. This file found that `human_mh.FLAT` — the
bones given a flat roll — had been shadowed by a pose of the same name on 24
Sep, so a rig built fresh after that had the wrong roll on every bone and
played the shared walk as a moonwalk. Nothing shipped had it (the bathers were
baked on the 23rd). See ROLL_FLAT_BONES. The conventions below are off --calib
renders of a correctly-rolled rig.
"""

import math
import os
import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Matrix, Vector  # type: ignore

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import human_mh as MH  # noqa: E402
import bathers_mh as BM  # noqa: E402

ROOT = HERE.parent.parent
DIVER = "man_young_fit"
DIVER_H = 1.84
PREVIEW = Path("/tmp/dive")


def build():
    """The diver's body and rig, painted and skinned — the fast v1 path, which
    has the same skeleton and weights as the shipped v2 figure."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kind, suit, skin_p = BM.SUITS[DIVER]
    MH.TARGET_H = DIVER_H
    MH.SKIN_P = skin_p
    obj = BM.BODIES / ("mh_%s.obj" % DIVER)
    J, scale, drop = MH.read_joints(obj)
    body = MH.load(obj, scale, drop)
    MH.smooth(body, 1, above=J["neck"].z)
    rig = MH.armature(J)
    MH.skin(body, rig)
    MH._material(body)
    MH._lights()
    return rig, body, J


def render(rig, poses, tag, view=(90.0, 2.0), size=(560, 900)):
    """One side view per pose, then a contact strip. `poses` is [(name, dict)];
    a dict may carry `@pitch` (deg, nose-down positive) and `@lift` (m) which
    turn and raise the whole rig object, for seeing a body in flight."""
    PREVIEW.mkdir(parents=True, exist_ok=True)
    MH.NO_RENDER = False
    files = []
    for name, d in poses:
        MH.pose(rig, {k: v for k, v in d.items() if not k.startswith("@")})
        rig.rotation_euler = (0.0, math.radians(d.get("@pitch", 0.0)), 0.0)
        rig.location = (0.0, 0.0, d.get("@lift", 0.0))
        bpy.context.view_layer.update()
        MH.PREVIEW = str(PREVIEW / tag)
        MH.VIEWS["dv"] = (view[0], view[1], 0.6, 7.5, size[0], size[1])
        MH.render(name, ["dv"])
        files.append("%s_%s_dv.png" % (MH.PREVIEW, name))
    rig.rotation_euler = (0.0, 0.0, 0.0)
    rig.location = (0.0, 0.0, 0.0)
    print("[dive] rendered", len(files))
    return files


def calib(rig):
    I = {}
    tests = [
        ("rest", {}),
        ("armUL-60x", {"armUL": (-60, 0, 0)}),
        ("armUL+60x", {"armUL": (60, 0, 0)}),
        ("armLL+60x", {"armLL": (60, 0, 0)}),
        ("legUL-60x", {"legUL": (-60, 0, 0)}),
        ("legLL+60x", {"legLL": (60, 0, 0)}),
        ("footL-30x", {"footL": (-30, 0, 0)}),
        ("spine01+20x", {"spine01": (20, 0, 0)}),
        ("pelvis+30x", {"pelvis": (30, 0, 0)}),
        ("pitch+45", {"@pitch": 45.0}),
    ]
    render(rig, tests, "calib")


# ── the poses ─────────────────────────────────────────────────────────────
#
# Conventions, read off --calib renders of a correctly-rolled rig (see
# ROLL_FLAT_BONES in human_mh.py for how a rig came to be built wrong):
#   legU  -x swings the leg FORWARD (hip flexion)      legL +x bends the knee
#   armU  -x raises the arm forward and up             armL -x bends the elbow
#   foot  -x points the toes                           spine -x bends FORWARD
#   pelvis -x tips the whole body forward about the hip (-90 face down, -180
#   head down) — which is the dive's rotation, so the flight turns the pelvis.
# The figure faces +x in its armature.
BASE = dict(MH.IDLE_A)
BASE.pop("@root", None)


def both(d, **kw):
    """Symmetric shorthand: armU=(x, z) sets armUL (x,0,z) and armUR (x,0,-z)."""
    out = dict(d)
    for k, v in kw.items():
        x, z = (v, 0.0) if not isinstance(v, tuple) else v
        out[k + "L"] = (x, 0.0, z)
        out[k + "R"] = (x, 0.0, -z)
    return out


STRAIGHT = dict(both(BASE, legU=(0, 3), legL=0, foot=0, armL=(-5, 0), hand=0),
                spine01=(0, 0, 0), spine02=(0, 0, 0), spine03=(0, 0, 0),
                chest=(0, 0, 0), pelvis=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0))

POSES = {
    "STAND": BASE,
    # Last step: the right foot drives off the board, the left knee comes up
    # and both arms swing forward and up.
    "HURDLE_PUSH": dict(both(STRAIGHT, armU=(-110, 8), armL=(-15, 0)),
                        legUL=(-80, 0, 4), legLL=(95, 0, 0), footL=(-25, 0, 0),
                        legUR=(12, 0, -3), legLR=(6, 0, 0), footR=(-40, 0, 0),
                        pelvis=(-4, 0, 0)),
    # Top of the hurdle: left thigh level, right leg long, arms overhead.
    "HURDLE_TOP": dict(both(STRAIGHT, armU=(-150, 6), armL=(8, 0)),
                       legUL=(-88, 0, 4), legLL=(92, 0, 0), footL=(-35, 0, 0),
                       legUR=(0, 0, -3), legLR=(4, 0, 0), footR=(-45, 0, 0)),
    # Both feet arriving together on the tip, legs long, arms coming down.
    "LAND": dict(both(STRAIGHT, armU=(-70, 8), armL=(-10, 0), legU=(-12, 3),
                      legL=18, foot=(4, 0))),
    # The bottom of the board: ankles, knees and hips folded, arms low and back.
    "LOAD": dict(both(STRAIGHT, armU=(30, 10), armL=(-18, 0), legU=(-52, 4),
                      legL=88, foot=(26, 0)),
                 pelvis=(-12, 0, 0), spine01=(-5, 0, 0), spine02=(-3, 0, 0)),
    # Leaving the board: long from fingertips to toes, reaching forward-up.
    "TAKEOFF": dict(both(STRAIGHT, armU=(-145, 6), armL=(14, 0), legU=(0, 3),
                         legL=0, foot=(-48, 0), fingers=0)),
    # The pike: hips folded, legs straight, hands to the shins, head in.
    "PIKE": dict(both(STRAIGHT, armU=(-122, 10), armL=(-6, 0), legU=(-125, 3),
                      legL=0, foot=(-50, 0)),
                 spine01=(-8, 0, 0), spine02=(-8, 0, 0), spine03=(-6, 0, 0),
                 neck=(-10, 0, 0), head=(-6, 0, 0)),
    # Opened out for the entry: a line, arms over the head, toes pointed.
    # (-145 is straight up on this rig: -150 already has the hands behind the
    # head and -140 in front of the face; the 18 undoes the rest pose's elbow.)
    "ENTRY": dict(both(STRAIGHT, armU=(-145, 4), armL=(18, 0), hand=(-12, 0),
                       legU=(0, 2), legL=0, foot=(-55, 0), fingers=0, thumb=0)),
}


def poses_strip(rig, names):
    render(rig, [(n, POSES[n]) for n in names], "pose", size=(420, 760))


# ── mass properties off the posed skeleton ──────────────────────────────────
#
# de Leva (1996) male segment masses and centre-of-mass positions, hung on this
# rig's bones head-to-tail. The trunk's 43.5 % is spread down the five trunk
# bones; clavicles and fingers ride in their parents.
MASS = 80.0
SEG = [
    ("pelvis", 0.117, 0.50), ("spine01", 0.080, 0.50), ("spine02", 0.080, 0.50),
    ("spine03", 0.080, 0.50), ("chest", 0.078, 0.50),
    ("neck", 0.020, 0.50), ("head", 0.049, 0.45),
    ("armUL", 0.0271, 0.577), ("armLL", 0.0162, 0.457), ("handL", 0.0061, 0.79),
    ("armUR", 0.0271, 0.577), ("armLR", 0.0162, 0.457), ("handR", 0.0061, 0.79),
    ("legUL", 0.1416, 0.41), ("legLL", 0.0433, 0.44), ("footL", 0.0137, 0.44),
    ("legUR", 0.1416, 0.41), ("legLR", 0.0433, 0.44), ("footR", 0.0137, 0.44),
]
G = 9.81


def _fw(v):
    """Armature -> the physics frame, which is the same frame: the figure
    faces +x. (A copy, so the rig's own vectors are never held.)"""
    return Vector((v.x, v.y, v.z))


def state(rig, p):
    """Pose the rig (pelvis turn included) and read everything the physics
    needs, in the physics frame: x forward, z up. Returns a dict."""
    MH.pose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
    B = rig.pose.bones
    segs = []
    for name, f, a in SEG:
        h, t = _fw(B[name].head), _fw(B[name].tail)
        c = h + (t - h) * a
        d = t - h
        L = d.length
        segs.append((MASS * f, c.x, c.z, math.atan2(d.x, d.z),
                     MASS * f * L * L / 12.0 * (1.0 - (d.y / L) ** 2 if L else 0)))
    M = sum(s_[0] for s_ in segs)
    cx = sum(s_[0] * s_[1] for s_ in segs) / M
    cz = sum(s_[0] * s_[2] for s_ in segs) / M
    I = sum(s_[0] * ((s_[1] - cx) ** 2 + (s_[2] - cz) ** 2) + s_[4] for s_ in segs)
    pts = {}
    for side in "LR":
        pts["ball" + side] = _fw(B["foot" + side].tail)
        pts["ankle" + side] = _fw(B["foot" + side].head)
        pts["toe" + side] = _fw(B["toe" + side].tail)
        pts["tip" + side] = _fw(B["fingers" + side].tail)
    pts["pivot"] = _fw(B["pelvis"].head)
    pts["headtop"] = _fw(B["head"].tail)
    return {"com": Vector((cx, 0.0, cz)), "I": I, "segs": segs, "pts": pts}


def lowest(st):
    """The lowest foot point, and which foot it is on."""
    best = None
    for side in "LR":
        for k in ("ball", "ankle", "toe"):
            v = st["pts"][k + side]
            # The ankle joint stands ~7 cm above the sole; the heel is under it.
            z = v.z - (0.07 if k == "ankle" else 0.0) - (0.01 if k == "toe" else 0.0)
            if best is None or z < best[0]:
                best = (z, side, k, v)
    return best


def entry_try(rig):
    base = POSES["ENTRY"]
    tries = [("a", dict(both(base, armU=(-140, 6), armL=(10, 0)))),
             ("b", dict(both(base, armU=(-135, 8), armL=(18, 0)))),
             ("c", dict(both(base, armU=(-145, 4), armL=(18, 0)))),
             ("d", dict(both(base, armU=(-130, 8), armL=(25, 0))))]
    render(rig, tries, "entry", size=(420, 760))


def calib2(rig):
    render(rig, [("swimA", MH.SWIM_A), ("swimB", MH.SWIM_B), ("swimC", MH.SWIM_C),
                 ("swimD", MH.SWIM_D), ("treadA", MH.TREAD_A),
                 ("pelvis180", dict(MH.IDLE_A, pelvis=(180, 0, 0))),
                 ("pelvis90", dict(MH.IDLE_A, pelvis=(90, 0, 0)))], "calib2",
           view=(90.0, 2.0), size=(700, 700))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    rig, body, J = build()
    if "--calib" in argv:
        calib(rig)
    if "--clips" in argv:
        cl = dive_clips(rig)
        print("[dive] clips", [(c["name"], len(c["keys"])) for c in cl])
    if "--ladder" in argv:
        film, T = ladder_film(rig)
        PREVIEW.mkdir(parents=True, exist_ok=True)
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        w = bpy.context.active_object
        w.scale = (2.0, 1.2, DECK + 1.0)
        w.location = (1.0, 0.0, (DECK - 1.0) / 2)
        for i, (tt, p, root) in enumerate(film):
            if i % 3:
                continue
            MH.pose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
            rig.location = (root[0], 0.0, root[1])
            bpy.context.view_layer.update()
            MH.PREVIEW = str(PREVIEW / "lad")
            MH.VIEWS["ld"] = (90.0, 2.0, 1.6, 8.0, 360, 520, -0.2, 0.0)
            MH.render("%03d" % i, ["ld"])
    if "--entry" in argv:
        entry_try(rig)
    if "--calib2" in argv:
        calib2(rig)
    if "--sim" in argv:
        film, info = run_sim(rig)
        if "--strip" in argv:
            ev = int(argv[argv.index("--strip") + 1])
            fr = None
            if "--range" in argv:
                a_, b_ = argv[argv.index("--range") + 1].split(":")
                fr = (int(a_), int(b_))
            vw = None
            if "--view" in argv:
                vw = tuple(float(x) for x in argv[argv.index("--view") + 1].split(","))
                vw = vw[:4] + (int(vw[4]), int(vw[5])) + vw[6:]
            fs = strip(rig, film, ev, frames=fr, view=vw)
            import json
            json.dump([[f, l, i] for f, l, i in fs], open(str(PREVIEW / "strip.json"), "w"))
    if "--poses" in argv:
        poses_strip(rig, argv[argv.index("--poses") + 1].split(","))



# ── the dive, simulated ──────────────────────────────────────────────────────
#
# Clip frame: armature metres, x along the board toward the tip, z up, origin
# on the board's top surface under the diver's feet where he stands to start.
# Everything below is solved; nothing about where the body is is typed.

FPS = 30
Z_WATER = -2.745            # sea level under the board top (43-jadrija.js)
FREE = 3.04                 # the board's free length, fulcrum to tip
BALL_TO_TIP = 0.16          # where the balls of his feet land short of the end
K_LAND = 8000.0             # N/m, the board's stiffness at the landing point
M_BOARD = 15.0              # kg, its effective mass there
ZETA = 0.05                 # damping ratio
T_LOAD, T_PUSH = 0.26, 0.34 # the legs: land->load, load->takeoff
HURDLE_T, HURDLE_D = 0.58, 0.90
ENTRY_DEG = 182.0           # head-down plus a hair past vertical at the hands


def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3.0 - 2.0 * u)


def lerp(a, b, u):
    return MH._lerp_pose(a, b, u)


def rot(v, th):
    """Rotate (x, z) about +y by th radians: the pelvis's +x turn."""
    c, s_ = math.cos(th), math.sin(th)
    return (v[0] * c + v[1] * s_, -v[0] * s_ + v[1] * c)


def walk_at(t):
    W = MH.WALK
    t = t % W[-1][0]
    i = 0
    while i < len(W) - 2 and W[i + 1][0] <= t:
        i += 1
    (t0, p0), (t1, p1) = W[i], W[i + 1]
    p = lerp(p0, p1, ease((t - t0) / (t1 - t0)))
    p.pop("@root", None)
    return p


def board_shape(x, L=FREE):
    """Cantilever under a tip load, normalised to 1 at the tip."""
    x = max(0.0, min(L, x))
    return x * x * (3 * L - x) / (2 * L ** 3)


class Film:
    """Frames at FPS: the pose (pelvis turn folded in), the root displacement,
    and the tip deflection of the board for the game to bend it by."""

    def __init__(self):
        self.frames = []

    def add(self, pose, root, tip=0.0, tag=""):
        p = dict(pose)
        p["@root"] = (root[0], 0.0, root[1])
        self.frames.append((p, tip, tag))


def place(st, pin_rel, pin_world, th=0.0):
    """Root displacement that puts `pin_rel` (armature, pose without the turn)
    at `pin_world` once the body is turned `th` about the pelvis head."""
    pv = st["pts"]["pivot"]
    r = rot((pin_rel[0] - pv.x, pin_rel[1] - pv.z), th)
    return (pin_world[0] - pv.x - r[0], pin_world[1] - pv.z - r[1])


def world(st, rel, root, th=0.0):
    pv = st["pts"]["pivot"]
    r = rot((rel[0] - pv.x, rel[1] - pv.z), th)
    return (root[0] + pv.x + r[0], root[1] + pv.z + r[1])


def with_turn(p, th):
    q = dict(p)
    px, py, pz = q.get("pelvis", (0.0, 0.0, 0.0))
    # `th` is the FORWARD turn (head toward +x), which is pelvis -x.
    q["pelvis"] = (px - math.degrees(th), py, pz)
    return q


def simulate(rig, x_tip=None, verbose=True):
    """The whole dive. With `x_tip` None the board is taken as rigid under the
    walk (first pass, to find where he lands); with it, the walk bends it."""
    film = Film()
    dt = 1.0 / FPS
    kb = K_LAND
    wn = math.sqrt(kb / M_BOARD)
    cb = 2 * ZETA * math.sqrt(kb * M_BOARD)
    info = {}

    def surf(x):
        return 0.0

    def flex_at(x_load, x):
        """Static board deflection at x for his weight standing at x_load."""
        if x_tip is None:
            return 0.0
        xf = x_tip - FREE
        a_land = x_tip - BALL_TO_TIP - xf
        a = x_load - xf
        if a <= 0:
            return 0.0
        # Deflection under a point load P at a: at a it is P a^3 / 3EI; K_LAND
        # is the stiffness at the landing point, so 3EI = K_LAND a_land^3.
        EI3 = kb * a_land ** 3
        P = MASS * G
        xx = x - xf
        if xx <= 0:
            return 0.0
        if xx <= a:
            return -P * xx * xx * (3 * a - xx) / (2 * EI3)   # (P/6EI) x^2 (3a - x)
        return -P * a * a * (3 * xx - a) / (2 * EI3)

    def tip_of(x_load):
        return 0.0 if x_tip is None else flex_at(x_load, x_tip)

    # ── stand, then walk: feet on the board, the stance foot pinned ────────
    STAND_T, BLEND_T, WALK_T = 1.2, 0.35, 2.0 * 1.10   # two cycles, a touch slow
    t = 0.0
    root = [0.0, 0.0]
    prev = None
    pin_x = None
    walk_scale = 1.10
    while t < STAND_T + WALK_T - 1e-9:
        if t < STAND_T:
            p = POSES["STAND"]
        else:
            tw = (t - STAND_T) / walk_scale
            p = lerp(POSES["STAND"], walk_at(tw), ease((t - STAND_T) / BLEND_T))
        st = state(rig, p)
        z, _side, k, v = lowest(st)
        # The planted foot is the one whose heel AND ball are both down; a
        # swinging foot can dip its pointed toe lower than either.
        side = min("LR", key=lambda q: max(st["pts"]["ankle" + q].z - 0.07,
                                            st["pts"]["ball" + q].z))
        foot = st["pts"]["ankle" + side] * 0.5 + st["pts"]["ball" + side] * 0.5
        if prev is None:
            root[0] = 0.0
        elif side == prev[0]:
            root[0] = pin_x - foot.x
        else:
            pin_x = foot.x + root[0]
        if prev is None or side != prev[0]:
            pin_x = foot.x + root[0]
        xw = foot.x + root[0]
        root[1] = surf(xw) + flex_at(xw, xw) - z
        film.add(p, root, tip_of(xw), "walk")
        if verbose and int(round(t * FPS)) % 3 == 0:
            print("[dive] walk t=%.2f side=%s pt=%s z=%.3f foot.x=%.3f root=(%.3f,%.3f)"
                  % (t, side, k, z, foot.x, root[0], root[1]))
        prev = (side,)
        t += dt
    walk_end = (p, st, list(root), side)

    # ── the hurdle: push off the stance foot, fly, land two-footed ──────────
    p0, st0, r0, side = walk_end
    # The hurdle drives off whichever foot the walk left planted: authored off
    # the right, mirrored when it is the left.
    HP, HT = POSES["HURDLE_PUSH"], POSES["HURDLE_TOP"]
    if side == "L":
        HP, HT = MH._mirror(HP), MH._mirror(HT)
    ball_pin = (st0["pts"]["ball" + side].x + r0[0], st0["pts"]["ball" + side].z + r0[1])
    n_push = int(round(0.20 * FPS))
    for i in range(1, n_push + 1):
        u = ease(i / n_push)
        p = lerp(p0, HP, u)
        st = state(rig, p)
        b = st["pts"]["ball" + side]
        root = list(place(st, (b.x, b.z), ball_pin))
        film.add(p, root, tip_of(ball_pin[0]), "push")
    c_push = world(st, (st["com"].x, st["com"].z), root)
    # Where he lands: COM HURDLE_D further on, feet flat on the board.
    stL = state(rig, POSES["LAND"])
    zl, _s, _k, _v = lowest(stL)
    ballL = (stL["pts"]["ballL"] + stL["pts"]["ballR"]) * 0.5
    c_land_x = c_push[0] + HURDLE_D
    x_land = c_land_x - (stL["com"].x - ballL.x)
    c_land_z = 0.0 + (stL["com"].z - zl)
    T = HURDLE_T
    vx = HURDLE_D / T
    vz0 = (c_land_z - c_push[1] + 0.5 * G * T * T) / T
    n_h = int(round(T * FPS))
    for i in range(1, n_h + 1):
        tt = i * dt
        f = tt / T
        p = (lerp(HP, HT, ease(f / 0.5)) if f < 0.5
             else lerp(HT, POSES["LAND"], ease((f - 0.5) / 0.5)))
        st = state(rig, p)
        C = (c_push[0] + vx * tt, c_push[1] + vz0 * tt - 0.5 * G * tt * tt)
        root = list(place(st, (st["com"].x, st["com"].z), C))
        # In the air: the board he pushed off rings back up on its own.
        y_push = tip_of(ball_pin[0])
        film.add(p, root, y_push * math.exp(-tt / 0.09) * math.cos(wn * tt), "hurdle")
    v_land = vz0 - G * T
    if verbose:
        print("[dive] hurdle: c_push (%.3f,%.3f) c_land (%.3f,%.3f) zl %.3f comL %.3f side %s ball_pin %s"
              % (c_push[0], c_push[1], c_land_x, c_land_z, zl, stL["com"].z, side, ball_pin))
    info.update(x_land=x_land, v_land=v_land, hurdle_apex=vz0 * vz0 / (2 * G))

    # ── the board: diver and plank as one sprung system ─────────────────────
    #
    # The textbook springboard: the diver rides the tip as a mass on the plank's
    # spring, and leaves when the plank comes back up through flat and would
    # start decelerating faster than he falls. His legs do not drive the
    # plank — a prescribed leg motion can push with any force at all, which is
    # how a first version of this launched him at 8.9 m/s. They follow it: the
    # knees fold while it goes down and drive while it comes back, so what
    # leaves the board is its recoil PLUS his extension, which is where a real
    # takeoff's 4.5-5.5 m/s comes from.
    H = 1.0 / 480
    y = 0.0
    yd = MASS * v_land / (MASS + M_BOARD)       # the feet take its velocity
    ys, yds = [0.0], [yd]
    while True:
        ydd = (-kb * y - cb * yd - MASS * G) / (MASS + M_BOARD)
        yd += ydd * H
        y += yd * H
        ys.append(y); yds.append(yd)
        if yd > 0 and y >= 0.0:
            break
    i_bot = min(range(len(ys)), key=lambda i: ys[i])
    n_c = len(ys)
    ymin = ys[i_bot]

    def legs(i):
        """LAND -> LOAD as the plank goes down, LOAD -> TAKEOFF as it comes
        back — accelerating (x^2.2), so the extension is at its fastest as he
        leaves, which is when a real push is."""
        if i <= i_bot:
            return lerp(POSES["LAND"], POSES["LOAD"], ease(i / i_bot))
        x = (i - i_bot) / (n_c - 1 - i_bot)
        return lerp(POSES["LOAD"], POSES["TAKEOFF"], x ** 2.2)

    step = 4                                     # pose the legs at 120 Hz
    tab = []
    for i in range(0, n_c, step):
        p = legs(i)
        st = state(rig, p)
        b = (st["pts"]["ballL"] + st["pts"]["ballR"]) * 0.5
        tab.append((i * H, p, st, st["com"].z - b.z, st["com"].x - b.x, i))
    if tab[-1][5] != n_c - 1:
        p = legs(n_c - 1)
        st = state(rig, p)
        b = (st["pts"]["ballL"] + st["pts"]["ballR"]) * 0.5
        tab.append(((n_c - 1) * H, p, st, st["com"].z - b.z, st["com"].x - b.x, n_c - 1))
    hdot = (tab[-1][3] - tab[-2][3]) / (tab[-1][0] - tab[-2][0])
    i_rel = len(tab) - 1
    tau_r = tab[-1][0]
    vz_rel = yds[-1] + hdot
    info.update(board_min=ymin, t_contact=tau_r, vz_board=yds[-1], vz_legs=hdot,
                vz_takeoff=vz_rel)
    ys_at = lambda tt: ys[min(len(ys) - 1, int(round(tt / H)))]
    yds_at = lambda tt: yds[min(len(yds) - 1, int(round(tt / H)))]

    # The lean: the last part of the push tips him forward about his feet so
    # that he leaves already turning, at exactly the rate the flight needs.
    # Solved below; first pass with w0 guessed, then refined.
    def contact_frames(w0):
        fr = []
        n = int(math.floor(tau_r * FPS))
        for j in range(1, n + 1):
            tt = j * dt
            i = min(len(tab) - 1, int(round(tt / (step * H))))
            _tau, p, st, _h, _hx, _ii = tab[i]
            a0 = tab[0][0] + (tau_r - tab[0][0]) * 0.55
            th = 0.0 if tt < a0 else 0.5 * w0 * (tt - a0) ** 2 / (tau_r - a0)
            b = (st["pts"]["ballL"] + st["pts"]["ballR"]) * 0.5
            yb = ys_at(tt)
            root = place(st, (b.x, b.z), (x_land, yb), th)
            fr.append((with_turn(p, th), root, yb, th, st))
        return fr

    # Flight pose timeline, precomputed at 120 Hz over a generous span.
    stR = tab[i_rel][2]
    pR = tab[i_rel][1]
    FH = 1.0 / 120

    def flight_pose(f):
        if f < 0.10:
            return lerp(pR, POSES["TAKEOFF"], ease(f / 0.10))
        if f < 0.42:
            return lerp(POSES["TAKEOFF"], POSES["PIKE"], ease((f - 0.10) / 0.32))
        if f < 0.55:
            return POSES["PIKE"]
        if f < 0.82:
            return lerp(POSES["PIKE"], POSES["ENTRY"], ease((f - 0.55) / 0.27))
        return POSES["ENTRY"]

    _fs_cache = {}

    def flight_samples(F):
        """Poses along the flight and their internal angular momentum — which
        depend on the flight's length and not on the spin, so they are posed
        once per length rather than once per guess."""
        if F in _fs_cache:
            return _fs_cache[F]
        samples = []
        tt = 0.0
        while tt <= F * 1.25 + 0.6:
            p = flight_pose(tt / F)
            samples.append((tt, p, state(rig, p)))
            tt += FH

        def seg_rel(st):
            cx, cz = st["com"].x, st["com"].z
            return [(m, x - cx, z - cz, ang, Io) for m, x, z, ang, Io in st["segs"]]
        rel = [seg_rel(s_[2]) for s_ in samples]
        Lint = []
        for k in range(len(samples)):
            a = rel[max(0, k - 1)]; b = rel[min(len(rel) - 1, k + 1)]
            h2 = FH * (min(len(rel) - 1, k + 1) - max(0, k - 1))
            L = 0.0
            for s1, s2, s0 in zip(a, b, rel[k]):
                vx_ = (s2[1] - s1[1]) / h2; vz_ = (s2[2] - s1[2]) / h2
                L += s0[0] * (s0[2] * vx_ - s0[1] * vz_)
                dang = (s2[3] - s1[3] + math.pi) % (2 * math.pi) - math.pi
                L += s0[4] * dang / h2
            Lint.append(L)
        _fs_cache[F] = (samples, Lint)
        return _fs_cache[F]

    def flight(w0, F):
        # release state
        cf = contact_frames(w0)
        p_last, r_last, _yb, th0, st_last = cf[-1]
        C0 = world(st_last, (st_last["com"].x, st_last["com"].z), r_last, th0)
        p_prev, r_prev, _y2, th_prev, st_prev = cf[-2]
        Cp = world(st_prev, (st_prev["com"].x, st_prev["com"].z), r_prev, th_prev)
        V0 = ((C0[0] - Cp[0]) / dt, vz_rel)
        samples, Lint = flight_samples(round(F, 4))
        Ltot = samples[0][2]["I"] * w0 + Lint[0]
        th = th0
        out = []
        entry = None
        for k, (tt, p, st) in enumerate(samples):
            C = (C0[0] + V0[0] * tt, C0[1] + V0[1] * tt - 0.5 * G * tt * tt)
            if k:
                w = (Ltot - Lint[k]) / st["I"]
                th += w * FH
            root = place(st, (st["com"].x, st["com"].z), C, th)
            tipz = min(world(st, (st["pts"][q].x, st["pts"][q].z), root, th)[1]
                       for q in ("tipL", "tipR"))
            out.append((tt, p, st, root, th, C))
            if tipz <= Z_WATER:
                entry = (tt, th, C, k)
                break
        return cf, out, entry, V0, Ltot

    # Solve the takeoff spin so the hands meet the water at ENTRY_DEG.
    F = 1.35
    w_lo, w_hi = 0.5, 12.0
    for _ in range(3):
        for _it in range(26):
            w0 = 0.5 * (w_lo + w_hi)
            cf, out, entry, V0, Ltot = flight(w0, F)
            if entry is None:
                w_hi = w0 * 0.9 + w_lo * 0.1
                continue
            if math.degrees(entry[1]) > ENTRY_DEG:
                w_hi = w0
            else:
                w_lo = w0
        cf, out, entry, V0, Ltot = flight(w0, F)
        if verbose:
            print("[dive] spin solve: F=%.3f w0=%.3f entry=%s vz=%.2f" % (
                F, w0, None if entry is None else (round(entry[0], 3), round(math.degrees(entry[1]), 1)), vz_rel))
        F = entry[0] if entry else F
        w_lo, w_hi = 0.5, 12.0
    info.update(w0=w0, entry_deg=math.degrees(entry[1]), flight=entry[0],
                vx_takeoff=V0[0], L=Ltot)

    for p, root, yb, th, st in cf:
        film.add(p, root, yb, "board")
    # The board lets go and rings on its own.
    y_free, yd_free = ys[-1], yds[-1]

    def board_free(n):
        nonlocal y_free, yd_free
        res = []
        for _ in range(n):
            for _s in range(8):
                ydd = (-kb * y_free - cb * yd_free) / M_BOARD
                yd_free += ydd * dt / 8
                y_free += yd_free * dt / 8
            res.append(y_free)
        return res

    # Flight frames, resampled from 120 Hz to FPS.
    n_f = int(math.floor(entry[0] * FPS))
    ring = board_free(n_f + 400)
    ri = 0
    for j in range(1, n_f + 1):
        tt = j * dt
        k = min(len(out) - 1, int(round(tt / FH)))
        _tt, p, st, root, th, C = out[k]
        film.add(with_turn(p, th), root, ring[ri], "flight"); ri += 1
    info["entry_frame"] = len(film.frames)
    tt, thE, CE, kE = entry
    # ── under the water: the drag, the arc and the surfacing ───────────────
    # Velocity at the entry, and the spin he still has.
    VE = (V0[0], V0[1] - G * tt)
    wE = (thE - out[max(0, kE - 4)][4]) / (4 * FH)
    stE = out[kE][2]
    kw = 1.1
    sp = math.hypot(*VE)
    dirE = (VE[0] / sp, VE[1] / sp)
    U1 = 0.55
    n1 = int(round(U1 * FPS))
    P1 = CE
    for j in range(1, n1 + 1):
        t1 = j * dt
        d = math.log(1 + kw * sp * t1) / kw
        C = (CE[0] + dirE[0] * d, CE[1] + dirE[1] * d)
        th = thE + wE * 0.18 * (1 - math.exp(-t1 / 0.18))
        root = place(stE, (stE["com"].x, stE["com"].z), C, th)
        film.add(with_turn(POSES["ENTRY"], th), root, ring[ri], "under"); ri += 1
        P1, th1 = C, th
    v1 = sp / (1 + kw * sp * U1)
    V1 = (dirE[0] * v1, dirE[1] * v1)
    # The arc: Hermite from here to the surface, head coming up forward.
    stT = state(rig, MH.TREAD_A)
    head_over = stT["pts"]["headtop"].z - stT["com"].z
    P2 = (P1[0] + 2.3, Z_WATER + 0.26 - head_over)
    U2 = 2.0
    V2 = (0.5, 0.35)
    n2 = int(round(U2 * FPS))
    GLIDE = dict(POSES["ENTRY"], spine01=(8, 0, 0), spine02=(8, 0, 0),
                 spine03=(6, 0, 0), neck=(10, 0, 0), head=(12, 0, 0))
    tread = {k: v for k, v in MH.TREAD_A.items() if not k.startswith("@")}
    for j in range(1, n2 + 1):
        u = j / n2
        h00, h10 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u
        h01, h11 = -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        C = tuple(h00 * P1[i] + h10 * U2 * V1[i] + h01 * P2[i] + h11 * U2 * V2[i]
                  for i in range(2))
        th = th1 + (0.0 - th1) * ease(u ** 0.9)
        p = (lerp(POSES["ENTRY"], GLIDE, ease(u / 0.45)) if u < 0.45
             else lerp(GLIDE, tread, ease((u - 0.45) / 0.55)))
        st = state(rig, p)
        root = place(st, (st["com"].x, st["com"].z), C, th)
        film.add(with_turn(p, th), root, ring[ri], "arc"); ri += 1
    # A breath at the surface, bobbing, so the tread clip takes over from rest.
    n3 = int(round(0.6 * FPS))
    for j in range(1, n3 + 1):
        film.add(tread, root, ring[ri], "surface"); ri += 1
    info.update(end_root=root, entry_x=CE[0], frames=len(film.frames),
                dur=(len(film.frames) - 1) / FPS)
    if verbose:
        for k_, v_ in info.items():
            print("[dive]   %-12s %s" % (k_, v_))
    return film, info


def run_sim(rig):
    MH.pose(rig, {})
    MH.walk_floor(rig)
    MH.pose(rig, {})
    film, info = simulate(rig, None, verbose=False)
    x_tip = info["x_land"] + BALL_TO_TIP
    film, info = simulate(rig, x_tip)
    info["x_tip"] = x_tip
    film.info = info
    return film, info


def strip(rig, film, every=6, tag="film", frames=None, view=None):
    """Render every n-th frame of the film from the side, in place — the rig
    moved by the root so the path reads — for looking at the whole dive."""
    PREVIEW.mkdir(parents=True, exist_ok=True)
    files = []
    # Context: the board (armature x is backward, so the tip is at -x_tip)
    # and the sea.
    x_tip = film.info["x_tip"]
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    bd = bpy.context.active_object
    bd.scale = (5.5, 0.8, 0.09)
    bd.location = (x_tip - 5.5 / 2, 0.0, -0.045)
    bpy.ops.mesh.primitive_plane_add(size=40.0, location=(0.0, 0.0, Z_WATER))
    wat = bpy.context.active_object
    m = bpy.data.materials.new("sea")
    m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (0.1, 0.35, 0.6, 1.0)
    bs.inputs["Alpha"].default_value = 0.25
    m.blend_method = "BLEND"
    wat.data.materials.append(m)
    lo, hi = frames if frames else (0, len(film.frames))
    for i in range(lo, min(hi, len(film.frames)), every):
        p, tip, lab = film.frames[i]
        MH.pose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
        r = p["@root"]
        rig.location = (r[0], 0.0, r[2])
        bpy.context.view_layer.update()
        MH.PREVIEW = str(PREVIEW / tag)
        MH.VIEWS["st"] = view or (90.0, 4.0, -0.2, 16.0, 400, 520, 3.0, 0.0)
        MH.render("%03d" % i, ["st"])
        files.append(("%s_%03d_st.png" % (MH.PREVIEW, i), lab, i))
    rig.location = (0.0, 0.0, 0.0)
    return files



# ── limbs onto targets: two-bone sagittal IK, numerically on the real rig ──
#
# Every hand on a rung and every foot on a rung or the deck is SOLVED: the two
# sagittal angles of the limb (upper, lower) are Newton-iterated on the posed
# rig until its end point sits on the target. Two unknowns, two equations,
# finite-difference Jacobian — the rig is the model, so nothing about its rolls
# or bone lengths has to be known here.

LIMB = {
    "handL": ("armUL", "armLL", "tipL"), "handR": ("armUR", "armLR", "tipR"),
    "footL": ("legUL", "legLL", "ballL"), "footR": ("legUR", "legLR", "ballR"),
}


def solve_limbs(rig, pose, root, th, targets, iters=8):
    """`targets` {limb: (x, z)} in world (clip) metres. Returns a new pose.
    `root` and `th` place the body as in `place`/`world`."""
    p = dict(pose)

    def ends(q):
        st = state(rig, with_turn(q, th))
        # with_turn already turns the pelvis; world() must not turn it again,
        # but it must pivot correctly: points are read from the turned pose.
        return {k: (st["pts"][LIMB[k][2]].x + root[0],
                    st["pts"][LIMB[k][2]].z + root[1]) for k in targets}
    for _ in range(iters):
        e0 = ends(p)
        err = max(math.hypot(e0[k][0] - targets[k][0], e0[k][1] - targets[k][1])
                  for k in targets)
        if err < 0.004:
            break
        for k, tgt in targets.items():
            a, b, _pt = LIMB[k]
            ua, ub = p.get(a, (0, 0, 0)), p.get(b, (0, 0, 0))
            h = 1.5
            qa = dict(p); qa[a] = (ua[0] + h, ua[1], ua[2])
            qb = dict(p); qb[b] = (ub[0] + h, ub[1], ub[2])
            ea, eb = ends(qa)[k], ends(qb)[k]
            J = [[(ea[0] - e0[k][0]) / h, (eb[0] - e0[k][0]) / h],
                 [(ea[1] - e0[k][1]) / h, (eb[1] - e0[k][1]) / h]]
            det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
            if abs(det) < 1e-9:
                continue
            rx, rz = tgt[0] - e0[k][0], tgt[1] - e0[k][1]
            da = (J[1][1] * rx - J[0][1] * rz) / det
            db = (-J[1][0] * rx + J[0][0] * rz) / det
            m = max(abs(da), abs(db))
            if m > 25:
                da, db = da * 25 / m, db * 25 / m
            p[a] = (ua[0] + da, ua[1], ua[2])
            p[b] = (ub[0] + db, ub[1], ub[2])
    return p


# ── the ladder: out of the water and back onto the deck ─────────────────────
#
# Clip frame: x toward the platform (the wall face at x = 0), z up, z = 0 the
# sea. The rungs are 43-jadrija.js's: every 0.30 m from 0.34 below the deck
# down eight, so the lowest is 0.20 m over the water.
DECK = 2.64                      # DIVE.top over the sea
RUNGS = [DECK - 0.34 - 0.30 * k for k in range(8)][::-1]   # low -> high
RUNG_X = -0.03                   # the front of a rung, just proud of the wall
FOOT_X = -0.07                   # the ball of a foot on one
BODY_X = -0.34                   # the pelvis, hanging off the ladder

CLIMB_BASE = dict(both(STRAIGHT, armU=(-110, 10), armL=(-40, 0), legU=(-40, 3),
                       legL=60, foot=(10, 0)),
                  spine01=(-4, 0, 0), spine02=(-3, 0, 0), neck=(-6, 0, 0),
                  head=(-14, 0, 0), fingersL=(40, 0, 0), fingersR=(-40, 0, 0))


def ladder_film(rig, verbose=True):
    """The climb, as a list of (pose, root) at FPS."""
    dt = 1.0 / FPS
    MOVE = 0.42                   # a limb's reach from one hold to the next
    GAP = 0.14
    # The holds each limb goes to, in order, and the order the limbs go in:
    # a foot, then the opposite hand, which is how a ladder is climbed.
    rz = RUNGS
    seq = [("footR", (FOOT_X, rz[0])), ("footL", (FOOT_X, rz[1])),
           ("handL", (RUNG_X, rz[5])), ("footR", (FOOT_X, rz[2])),
           ("handR", (RUNG_X, rz[6])), ("footL", (FOOT_X, rz[3])),
           ("handL", (RUNG_X, rz[7])), ("footR", (FOOT_X, rz[4])),
           ("handR", (0.22, DECK + 0.02)), ("footL", (FOOT_X, rz[5])),
           ("handL", (0.22, DECK + 0.02)), ("footR", (FOOT_X, rz[6])),
           ("footL", (FOOT_X, rz[7])),
           # the mantle: a high step onto the deck, then the other foot
           ("footR", (0.30, DECK)), ("footL", (0.34, DECK))]
    hold = {"handL": (RUNG_X, rz[4]), "handR": (RUNG_X, rz[4]),
            "footL": None, "footR": None}
    events = []
    t = 0.9                                         # hang a moment first
    for limb, tgt in seq:
        events.append((t, t + MOVE, limb, tgt))
        t += MOVE + GAP
    T_END = t + 1.2
    # Where each limb is at time t: on its hold, or partway to the next,
    # lifted clear of the rungs on the way.
    def limb_at(limb, tt):
        cur = hold[limb]
        for a, b, lm, tgt in events:
            if lm != limb:
                continue
            if tt >= b:
                cur = tgt
            elif tt > a:
                u = ease((tt - a) / (b - a))
                src = cur
                if src is None:                     # from dangling in the water
                    return ("move", tgt, u)
                x = src[0] + (tgt[0] - src[0]) * u - 0.14 * math.sin(math.pi * u)
                z = src[1] + (tgt[1] - src[1]) * u
                return ("pt", (x, z))
            else:
                break
        return ("pt", cur) if cur is not None else ("free", None)

    def pelvis_at(tt):
        fz = []
        for f in ("footL", "footR"):
            k, v = limb_at(f, tt)[:2]
            if k == "pt":
                fz.append(v[1])
        base = (sum(fz) / len(fz) + 0.80) if fz else rz[4] - 0.95
        # onto the deck: the body comes in over the edge and up
        top = ease((tt - events[-3][0]) / (T_END - 1.0 - events[-3][0]))
        x = BODY_X + (0.45 - BODY_X) * top
        z = base if top <= 0 else base + (DECK + 0.98 - base) * top
        return x, z, -0.25 * math.sin(math.pi * min(1.0, max(0.0, top)))

    # Smooth the pelvis height: a step lands, the body follows.
    N = int(T_END * FPS) + 1
    raw = [pelvis_at(i * dt) for i in range(N)]
    zs = [r[1] for r in raw]
    sm = []
    k_ = 0.0
    for i, z in enumerate(zs):
        k_ = z if i == 0 else k_ + (z - k_) * 0.12
        sm.append(k_)
    film = []
    prev = CLIMB_BASE
    for i in range(0, N, 3):
        tt = i * dt
        px, _pz, th = raw[i]
        pz = sm[i]
        st = state(rig, with_turn(prev, th))
        pv = st["pts"]["pivot"]
        root = (px - pv.x, pz - pv.z)
        tg = {}
        for limb in LIMB:
            k, v = limb_at(limb, tt)[:2]
            if k == "pt":
                tg[limb] = v
        base = dict(prev)
        if tt > T_END - 1.0:
            base = lerp(base, POSES["STAND"], ease((tt - (T_END - 1.0)) / 0.8))
        p = solve_limbs(rig, base, root, th, tg) if tt <= T_END - 0.6 else base
        film.append((tt, with_turn(p, th), root))
        prev = p
    if verbose:
        print("[dive] ladder: %.2f s, %d solved keys" % (T_END, len(film)))
    return film, T_END



# ── the bake: clips for bathers_v2, and the numbers the game needs ──────────

def _dense(keys, dt):
    """Linear resample of (t, pose, root) keys to every `dt` — the bake eases
    between keys, and easing between keys a tenth of a second apart is a
    stutter ten times a second."""
    out = []
    T = keys[-1][0]
    n = int(round(T / dt))
    j = 0
    for i in range(n + 1):
        t = i * dt
        while j < len(keys) - 2 and keys[j + 1][0] <= t:
            j += 1
        (t0, p0, r0), (t1, p1, r1) = keys[j], keys[j + 1]
        u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        p = MH._lerp_pose(p0, p1, u)
        r = (r0[0] + (r1[0] - r0[0]) * u, r0[1] + (r1[1] - r0[1]) * u)
        p["@root"] = (r[0], 0.0, r[1])
        out.append((round(t, 6), p))
    return out


DIVE_JSON = ROOT / "build" / "payload" / "dive.json"


def dive_clips(rig, J=None, write=True):
    """Everything the diver adds to his figure's clip list, and build/dive.json
    for src/43-jadrija.js. Called from bathers_v2.one for DIVER."""
    import json
    film, info = run_sim(rig)
    dt = 1.0 / FPS
    dive_keys = [(round(i * dt, 6), p) for i, (p, _tip, _lab) in enumerate(film.frames)]
    # The board's tip deflection per frame. The walk phase already stores it at
    # the tip; the ride and the ring store it under his feet, BALL_TO_TIP short
    # of the end, and the tip-load shape converts one to the other.
    a = FREE - BALL_TO_TIP
    k_tip = 2 * FREE ** 3 / (a * a * (3 * FREE - a))
    flex = []
    for p, tip, lab in film.frames:
        flex.append(round(tip * (1.0 if lab in ("walk", "push", "hurdle") else k_tip), 4))
    lad, T_lad = ladder_film(rig, verbose=True)
    lad_keys = _dense(lad, dt)
    consts = {
        "fps": FPS,
        "dive": {"frames": len(dive_keys), "dur": dive_keys[-1][0],
                 "x_tip": info["x_tip"], "free": FREE,
                 "entry_t": info["entry_frame"] * dt, "entry_x": info["entry_x"],
                 "end_root": [info["end_root"][0], info["end_root"][1]],
                 "water": Z_WATER, "flex": flex,
                 "stats": {k: v for k, v in info.items()
                           if isinstance(v, (int, float))}},
        "ladder": {"dur": lad_keys[-1][0], "deck": DECK,
                   "start_root": list(lad[0][2]), "end_root": list(lad[-1][2])},
        "tread_root": list(MH.TREAD_A.get("@root", (0, 0, 0))),
        "swim_root": list(MH.SWIM_BASE.get("@root", (0, 0, 0))),
    }
    if write:
        DIVE_JSON.write_text(json.dumps(consts, indent=1))
        print("[dive] wrote %s" % DIVE_JSON)
    clips = [
        {"name": "dive", "loop": False, "keys": dive_keys},
        {"name": "ladder", "loop": False, "keys": lad_keys},
    ]
    clips.append(diver_swim())
    for c in MH.CLIPS:
        if c["name"] == "tread":
            clips.append(c)
    return clips


def diver_swim():
    """His own crawl. The shared one (human_mh SWIM_*) kicks +-15 degrees at
    the hip with up to 30 of knee on the up-beat; laid at the surface that lifts
    a whole shin out of the water, which in the game read as a leg standing
    up out of the sea. A relaxed swimmer's flutter is small and his legs trail
    a little under his shoulders: +-6 with the knee soft, and 6 degrees of hip
    so the legs ride low."""
    def key(roll, breath, L, R, kick):
        p = MH._swim(roll, breath, L, R, kick)
        for side, k in (("L", kick), ("R", -kick)):
            p["legU" + side] = (k - 6, 0, 3 if side == "L" else -3)
            p["legL" + side] = (max(0.0, k) * 1.0 + 8, 0, 0)
        return p
    A = key(-17, 0, (-28, 18, -22, -8), (-163, 8, -8, 0), 6)
    B = key(9, 0, (-112, 66, -80, -12), (-100, 12, -74, -8), -6)
    C = key(17, 54, (-163, 8, -8, 0), (-28, 18, -22, -8), 6)
    D = key(-9, 12, (-100, 12, -74, -8), (-112, 66, -80, -12), -6)
    return {"name": "swim", "loop": True,
            "keys": [(0.00, A), (0.35, B), (0.70, C), (1.05, D), (1.40, A)]}


if __name__ == "__main__":
    main()
