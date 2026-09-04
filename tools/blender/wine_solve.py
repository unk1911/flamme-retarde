#!/usr/bin/env python3
"""Solve the wine-pour poses against the room, instead of guessing them.

    tools/blender/blender.sh -b build/human_mh.blend -P tools/blender/wine_solve.py \
        -- --solve POUR TIP LIFT HOLD REACH

Why this exists, and why it is a file rather than four numbers typed into
human_mh.py: the pour has to satisfy six things at once and every one of them
is invisible in a render until it is wrong.

    the bottle's LIP has to be over the glass          — a point, in metres
    the bottle has to be TILTED like a bottle          — 100 deg, not 119
    the ELBOW has to be bent like an arm               — not 168 deg
    the bottle must not be BURIED IN HER FOREARM       — both are ~75 mm across
    she has to LEAN, because the stool is 0.72 m high  — and not fold in half
    her HEAD has to be looking at what she is pouring into

Nudging an angle to fix any one of those moves the other five, which is how the
shipped pose ended up with a locked arm holding a bottle by its shoulder: each
individual number was argued into place against the last picture taken, and
nothing ever checked all six at once.

**No Blender evaluation in the inner loop.** `bpy.ops.object.mode_set` plus a
depsgraph update is about 8 ms, and 8 ms times a hundred thousand candidate
poses is fifteen minutes. Blender is opened once, for the rest matrices, and
after that the forward kinematics is forty lines of `mathutils` — the same
recursion Blender itself runs:

    pose(bone) = pose(parent) @ (rest(parent)^-1 @ rest(bone)) @ basis

`--check` proves that against Blender's own `pose_bone.matrix` on a real pose
before any solving happens, because a hand-rolled FK that is subtly wrong
produces beautifully converged nonsense.

The frame throughout is HERS, which is Blender's world here: **+x in front of
her, +y her LEFT, +z up**, origin between her feet. The room's numbers were
measured out of the running game (`__fr.jad.bones`, `__fr.scene`) rather than
read off `kabinaKit`, so they include the standing mark, the yaw and the shore
frame's own rotation — see ROOM below.
"""

import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

# --------------------------------------------------------------------------- #
#  the room                                                                    #
# --------------------------------------------------------------------------- #
#
# Everything the pour has to hit, in her frame, in metres off the floor she is
# standing on. These come from `kabinaKit` in src/43-jadrija.js through the new
# standing mark below; changing either end without the other is what "move one
# and the bottle pours past the glass" in that file is about.
#
# THE STANDING MARK MOVED. It used to put the glass 0.29 m in front of her and
# 0.04 m to her right and the bottle dead on her midline — so a right hand had
# to cross her own centre line to pour, which is a knot no amount of solving
# gets out of. `kit.wine` is now solved the other way round: from wanting the
# glass 0.33 in front and 0.14 out to her right, and the bottle 0.42 and 0.23,
# which is where a right-handed person stands to pour something.
# SHE STANDS A HAND'S WIDTH FURTHER ROUND THE STOOL THAN SHE DID. The glass
# used to be 0.33 in front of her and only 0.14 out to her right, and that one
# number is why the pour would not read from anywhere in the room: with the
# glass almost on her midline, a right hand pouring into it holds the bottle
# out at her hip and points it straight across her body. Its axis then runs
# left-right, so it is foreshortened to a disc from her right, foreshortened to
# a disc from her left, and only reads from dead in front — which in this room
# is a wall. Rendered from the door you saw a woman with a green ellipse
# stuck to her hand.
#
# 0.235 out instead of 0.140 puts the glass on the diagonal a person actually
# sets a glass down on, and swings the bottle round with it: 0.168 m of it now
# lies fore-and-aft against 0.242 across, where it used to be 0.058 against
# 0.290. It is the same stool in the same place — what moved is her, 0.095 m
# along the shore, which `kit.wine` in src/43-jadrija.js carries.
#
# AND THE BOTTLE MOVED ON THE SEAT. It used to stand dead in the middle of the
# tabouret, 0.405 m in front of her, and her whole reach — shoulder to the
# middle of a closed fist — is 0.547 m against a drop of 0.579: she could not
# touch it without folding. It now stands on the near half of the seat beside
# the glass, 0.330 in front and 0.360 out, which with the knees is a reach
# rather than a bow. `rest` in `kabinaKit` carries it.
ROOM = {
    "stool": 0.722,           # the seat, and what both objects stand on
    "glass": (0.315, -0.235),  # (x, y): the glass's axis, y negative = her right
    "rim": 0.890,             # the top of the glass
    "bottleFoot": (0.330, -0.360, 0.722),
}
# Where the lip goes when she is pouring. 0.14 m over the rim rather than the
# 0.06 it was: the stream is drawn from the lip down to the wine, so the old
# number left about six centimetres of 3 mm cylinder to see, and at three
# metres in a dim room that is nothing. A pour you can see is the point.
ROOM["lip"] = (ROOM["glass"][0], ROOM["glass"][1], ROOM["rim"] + 0.140)

# How far up the bottle her fist closes. THE ONE NUMBER THAT MADE IT LOOK
# BACKWARDS: at 0.185 the hand is on the bottle's shoulder, so 185 mm of bottle
# sticks out behind her fist and only 121 mm reaches past it — the long half
# points away into the room and the wine appears to come out from under her
# palm. A wine bottle is held around its label, which on a 306 mm Dingac is
# 48 to 128 mm up. 0.108 puts the middle of a closed fist there.
GRIP = 0.108
BOTTLE = 0.306            # foot to lip
BOTTLE_R = 0.0385         # widest radius
FOREARM_R = 0.038

# Figure space in the GAME is +x front, +y up, +z her right; Blender's is
# +x front, +y left, +z up. So (gx, gy, gz) -> (gx, -gz, gy).
def from_game(v):
    return Vector((v[0], -v[2], v[1]))


PALM = from_game((0.0443, -0.0748, 0.0096))
GRIP_UP = from_game((-0.5014, 0.6297, -0.5934))

# --------------------------------------------------------------------------- #
#  forward kinematics, without Blender in the loop                             #
# --------------------------------------------------------------------------- #

rig = bpy.data.objects["rig"]
ARM = rig.data
REST = {b.name: b.matrix_local.copy() for b in ARM.bones}
PARENT = {b.name: (b.parent.name if b.parent else None) for b in ARM.bones}
RW = rig.matrix_world.copy()
RW3 = RW.to_3x3()


def fk(spec, want):
    """World matrices for `want`, given {bone: (rx, ry, rz)} in degrees."""
    cache = {}

    def solve(name):
        m = cache.get(name)
        if m is not None:
            return m
        rot = spec.get(name, (0.0, 0.0, 0.0))
        basis = Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
        p = PARENT[name]
        if p is None:
            m = REST[name] @ basis
        else:
            m = solve(p) @ (REST[p].inverted() @ REST[name]) @ basis
        cache[name] = m
        return m

    return {n: RW @ solve(n) for n in want}


def head_of(m4):
    return m4.to_translation()


def bottle_of(mats):
    """(grip point, unit axis foot->lip) for the bottle in her right hand.

    The same two lines the game runs in `stepShow`: the palm is a fixed offset
    in the hand's frame and the bottle's axis is a fixed direction in it, both
    measured off IDLE_A, and everything the wrist does after that aims the
    bottle. If this and 43-jadrija.js ever disagree the bottle moves on the
    frame a clip is scrubbed, which is the tell.
    """
    m = mats["handR"]
    delta = (m.to_3x3() @ (RW3 @ REST["handR"].to_3x3()).inverted())
    palm = head_of(m) + delta @ PALM
    axis = (delta @ GRIP_UP).normalized()
    return palm, axis


def seg_gap(a0, a1, b0, b1):
    """Closest approach between two segments. Clamped, not the infinite-line
    answer — a bottle whose axis passes near her forearm behind her elbow is
    not touching her forearm."""
    d1, d2 = a1 - a0, b1 - b0
    r = a0 - b0
    a, e, f = d1.dot(d1), d2.dot(d2), d2.dot(r)
    c, b = d1.dot(r), d1.dot(d2)
    den = a * e - b * b
    s = 0.0 if den < 1e-9 else max(0.0, min(1.0, (b * f - c * e) / den))
    t = max(0.0, min(1.0, (b * s + f) / e)) if e > 1e-9 else 0.0
    s = 0.0 if a < 1e-9 else max(0.0, min(1.0, (b * t - c) / a))
    return ((a0 + d1 * s) - (b0 + d2 * t)).length


def band(v, lo, hi):
    """0 inside [lo, hi], and the square of how far outside, outside it."""
    if v < lo:
        return (lo - v) ** 2
    if v > hi:
        return (v - hi) ** 2
    return 0.0


# --------------------------------------------------------------------------- #
#  what a pose is scored on                                                    #
# --------------------------------------------------------------------------- #

WANT = ("pelvis", "spine01", "spine02", "spine03", "chest", "neck", "head",
        "clavicleR", "armUR", "armLR", "handR",
        "legUL", "legLL", "footL", "toeL",
        "legUR", "legLR", "footR", "toeR")

# --------------------------------------------------------------------------- #
#  the knees                                                                   #
# --------------------------------------------------------------------------- #
#
# WHY THERE ARE LEGS IN A POUR SOLVER. Her fist hangs at 0.865 m and the
# bottle's grip point stands at 0.830, so the height is nothing — but the
# bottle is 0.40 m in front of her and her whole reach, shoulder to the middle
# of a closed fist, is 0.547 m against a drop of 0.579. She cannot touch it
# standing up. The first solve was given one way to close that gap, the trunk,
# and it spent 28 degrees of it: she folded over the stool with her legs
# straight and her arm hanging, which is the single thing that made the clip
# read as a shop dummy taking a bow.
#
# A person reaching to something at stool height bends the knees and keeps the
# back long. So the legs get a dip, and it is FITTED rather than typed: given a
# knee flexion, the hip and ankle angles are searched for the pair that (a)
# leaves the foot pointing exactly where it points in IDLE_A — a foot that
# rolls is a heel coming off the floor — and (b) leaves her pelvis over her
# ankles rather than behind them. Two unknowns, two conditions, a few hundred
# evaluations, once per angle, cached.
_DIP_CACHE = {}


def _leg_spec(k, hip, ankle, out=11.0):
    d = {}
    for side, sg in (("L", 1.0), ("R", -1.0)):
        d["legU" + side] = (hip, -out * sg, 0.0)
        d["legL" + side] = (k, 0.0, 0.0)
        d["foot" + side] = (ankle, 0.0, 0.0)
        d["toe" + side] = (0.0, 0.0, 0.0)
    return d


def _foot_dir(mats):
    m = mats["footL"]
    return (m.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()


def dip_legs(k, idle):
    """A knee bend of `k` degrees, with the foot flat and the ankle under it.

    THE PELVIS IS THE ROOT, so nothing here can be checked against it: a hip
    angle rotates the leg, not the body, and a fit that asks the pelvis to hold
    still is a fit with no conditions in it at all. The first version did
    exactly that and came out at 68 deg of hip flexion with a straight knee,
    which is a woman lying on her back with her legs in the air — and because
    the ground correction then drops everything by however far the toes went
    up, it rendered as a full squat.

    What has to hold still is the FOOT: its direction, so the sole stays flat
    on the floor, and where the ankle is fore-and-aft, so her feet do not walk
    forward as she dips. Two conditions, two unknowns. The drop out of the
    floor correction is then whatever the knee angle is worth, which is what a
    knee bend is.
    """
    key = round(k, 2)
    got = _DIP_CACHE.get(key)
    if got is not None:
        return got
    base = {n: v for n, v in idle.items() if not n.startswith("@")}
    ref = fk(base, WANT)
    d0, x0 = _foot_dir(ref), head_of(ref["footL"]).x
    rnd = random.Random(11)
    hip, ank = -0.55 * k, -0.45 * k
    best = None
    sig = 5.0
    for n in range(2400):
        h = max(-42.0, min(12.0, hip + rnd.gauss(0, sig)))
        a = max(-38.0, min(22.0, ank + rnd.gauss(0, sig)))
        m = fk(dict(base, **_leg_spec(k, h, a)), WANT)
        e = (400.0 * (1.0 - _foot_dir(m).dot(d0))
             + 900.0 * (head_of(m["footL"]).x - x0) ** 2)
        if best is None or e < best:
            best, hip, ank = e, h, a
        if (n + 1) % 150 == 0:
            sig = max(0.03, sig * 0.80)
    out = _leg_spec(k, hip, ank)
    _DIP_CACHE[key] = out
    return out


def ground_of(mats):
    """How far the balls of her feet have come up off the floor.

    A pose with the knees bent is a pose whose feet are in the air until
    something drops the root, and at export `wine_floor` does exactly that. In
    here the same correction is arithmetic: every height the solver scores is
    measured off the lowest foot rather than off the rig's origin, so a target
    0.830 m up means 0.830 m above the floor she is standing on and not 0.830
    above where her feet would be if her knees were straight.
    """
    return min(head_of(mats["toeL"]).z, head_of(mats["toeR"]).z)


GROUND0 = None


def measure(spec):
    global GROUND0
    mats = fk(spec, WANT)
    if GROUND0 is None:
        GROUND0 = ground_of(fk({}, WANT))
    # Everything is measured off the floor she is standing on, so a bent knee
    # does not quietly move the room. See `ground_of`.
    gz = Vector((0.0, 0.0, ground_of(mats) - GROUND0))
    for k in mats:
        mats[k] = Matrix.Translation(-gz) @ mats[k]
    palm, axis = bottle_of(mats)
    foot = palm - axis * GRIP
    lip = palm + axis * (BOTTLE - GRIP)
    sh, el, wr = (head_of(mats["armUR"]), head_of(mats["armLR"]),
                  head_of(mats["handR"]))
    u, l = (el - sh).length, (wr - el).length
    d = (wr - sh).length
    cosph = max(-1.0, min(1.0, (u * u + l * l - d * d) / (2 * u * l)))
    hips, chest = head_of(mats["pelvis"]), head_of(mats["chest"])
    trunk = chest - hips
    return {
        "palm": palm, "axis": axis, "foot": foot, "lip": lip,
        "tilt": math.degrees(math.acos(max(-1.0, min(1.0, axis.z)))),
        "elbow": math.degrees(math.acos(cosph)),
        "lean": math.degrees(math.atan2(trunk.x, trunk.z)),
        # The forearm shortened at the wrist end: the bottle passes through
        # her palm, which is 87 mm off the wrist joint, so a gap measured to
        # the joint itself can never exceed that and the constraint is
        # unsatisfiable by construction. What "buried in her arm" means is the
        # bottle lying along the SHAFT of the forearm, so that is what is
        # measured.
        "gap": seg_gap(foot, lip, el, el + (wr - el) * 0.72),
        "head": head_of(mats["head"]),
        "gaze": (mats["head"].to_3x3()
                 @ (RW3 @ REST["head"].to_3x3()).inverted()
                 @ Vector((1.0, 0.0, 0.0))),
        "el": el, "wr": wr, "sh": sh,
        "hips": head_of(mats["pelvis"]).z,
    }


def cost(spec, goal):
    m = measure(spec)
    c = 0.0
    parts = {}

    def add(k, v):
        nonlocal c
        parts[k] = v
        c += v

    if goal.get("lip"):
        add("lip", 900.0 * (m["lip"] - Vector(goal["lip"])).length_squared)
    if goal.get("palm"):
        w = goal.get("palmW", 900.0)
        add("palm", w * (m["palm"] - Vector(goal["palm"])).length_squared)
    add("tilt", 0.020 * band(m["tilt"], *goal["tilt"]))
    add("elbow", 0.010 * band(m["elbow"], *goal["elbow"]))
    add("lean", 0.012 * band(m["lean"], *goal["lean"]))
    # The bottle must clear the forearm. Both are cylinders; touching is the sum
    # of the radii, and a bottle whose axis lies along the forearm scores
    # perfectly on every other term while being buried inside her arm.
    add("gap", 400.0 * band(m["gap"], BOTTLE_R + FOREARM_R + 0.012, 9.0))
    # Looking at it. A person pouring looks into the glass; a person pouring
    # while staring straight ahead is a person who has done this before and is
    # not the read we want.
    # LOOK AT IT. Without this she reaches down to a stool at knee height with
    # her face pointed at the far wall, which is the one thing in the first
    # renders that read as a mannequin rather than a person — a hand goes where
    # the eyes went a moment earlier, always.
    if goal.get("look"):
        to = (Vector(goal["look"]) - m["head"]).normalized()
        add("gaze", 90.0 * max(0.0, 0.72 - m["gaze"].dot(to)) ** 2)
    # And keep it near the pose it grows out of, so the clip interpolates
    # instead of lurching. Cheap L2 on the angles, not on the geometry.
    ref = goal.get("near")
    if ref:
        s = 0.0
        for b, r in ref.items():
            if b.startswith("@"):
                continue
            v = spec.get(b, (0, 0, 0))
            s += sum((a - c2) ** 2 for a, c2 in zip(v, r))
        add("near", goal.get("nearW", 0.00020) * s)
    return c, parts, m


# --------------------------------------------------------------------------- #
#  the search                                                                  #
# --------------------------------------------------------------------------- #
#
# (1+1) evolution strategy with a one-fifth success rule on the step size, from
# several restarts. Eighteen dimensions of smooth-ish reach: nothing here needs
# a real optimiser, and a real optimiser is a dependency Blender does not ship.

# spine01 IS ON THIS LIST AND THAT MATTERS. Without it the only forward bend
# available is spine02/spine03/chest, which is a bend from the middle of the
# back — and what came out was a hunch: she curled over the stool with her
# chin out, like somebody reading a label rather than picking a bottle up.
# A person bending to something at knee height hinges at the HIPS and keeps
# the back long. So the low joint gets the range and the upper three are
# capped at a third of what they had.
FREE = {
    "spine01": [(-38, 6), (-6, 6), (-4, 6)],
    "spine02": [(-13, 8), (-6, 6), (-4, 6)],
    "spine03": [(-11, 8), (-6, 6), (-4, 6)],
    "chest": [(-10, 2), (-8, 8), (-6, 6)],
    "neck": [(-16, 10), (-6, 6), (-4, 4)],
    "head": [(-40, 14), (-14, 10), (-6, 8)],
    "clavicleR": [(-8, 8), (-4, 4), (-14, 14)],
    "armUR": [(-95, 20), (-55, 30), (-70, 10)],
    "armLR": [(-40, 70), (-60, 40), (-45, 20)],
    "handR": [(-60, 60), (-45, 60), (-30, 70)],
}
KEYS = [(b, i) for b in FREE for i in range(3)]


def unpack(x, base):
    spec = dict(base)
    for k, (b, i) in enumerate(KEYS):
        v = list(spec.get(b, (0.0, 0.0, 0.0)))
        v[i] = x[k]
        spec[b] = tuple(v)
    return spec


def clampx(x):
    for k, (b, i) in enumerate(KEYS):
        lo, hi = FREE[b][i]
        x[k] = max(lo, min(hi, x[k]))
    return x


def solve(base, goal, seed=0, iters=9000, restarts=5):
    rnd = random.Random(seed)
    best, bx = None, None
    for r in range(restarts):
        x = []
        for b, i in KEYS:
            lo, hi = FREE[b][i]
            start = goal.get("seed", {}).get(b, base.get(b, (0, 0, 0)))[i]
            x.append(max(lo, min(hi, start + (0 if r == 0 else rnd.gauss(0, 9)))))
        f = cost(unpack(x, base), goal)[0]
        sig, good = 7.0, 0
        for n in range(iters):
            y = clampx([v + rnd.gauss(0, sig) for v in x])
            g = cost(unpack(y, base), goal)[0]
            if g < f:
                x, f, good = y, g, good + 1
            if (n + 1) % 60 == 0:
                sig *= 1.35 if good > 12 else 0.82
                sig = max(0.05, min(16.0, sig))
                good = 0
        if best is None or f < best:
            best, bx = f, x
    return unpack(bx, base), best


# --------------------------------------------------------------------------- #
#  goals                                                                       #
# --------------------------------------------------------------------------- #

GRIP_STAND = (ROOM["bottleFoot"][0], ROOM["bottleFoot"][1],
              ROOM["bottleFoot"][2] + GRIP)


# How far the knees go down at each key, in degrees of knee flexion, and it is
# the shape of the clip as much as any angle in it: she dips to the stool, comes
# most of the way back up with the bottle, and pours standing. `dip_legs` turns
# each of these into a hip, a knee and an ankle that leave her feet flat and
# her hips over them.
DIP = {"REACH": 42.0, "HOLD": 42.0, "LIFT": 16.0,
       "TIP": 5.0, "POUR": 5.0, "POURB": 5.0}


def goals(idle):
    lip = ROOM["lip"]
    # Lifted clear of the stool, upright, and already on the way to the glass:
    # a hand's width up and a hand's width in, and no detour out to her hip.
    lift = (0.318, -0.350, 1.000)
    # Where her fist goes to pour, worked backwards from the lip along the axis
    # the bottle is wanted on, which is SQUARE ACROSS HER: nothing fore-and-aft,
    # 0.97 lateral and a quarter of it down.
    #
    # That is the opposite of what the first attempt at this did, and the
    # reason is the doorway. A bottle 306 mm long seen down its own axis is a
    # green ellipse, so the only question worth asking is which way the person
    # watching is looking — and in this room there is exactly one place to
    # watch from. The first pass swung the bottle round to point forward-left
    # to get it off her hip; the door is forward-left of where she stood, so it
    # was still 95 per cent end-on and it still read as a disc.
    #
    # The fix is her yaw, not the bottle's. She turns 40 deg to face the
    # doorway — `kit.wine` in src/43-jadrija.js derives the mark and the angle
    # from the glass, so it moved with her — and the bottle then lies straight
    # across the line you are looking down: 17 per cent along the view instead
    # of 95, which is a bottle instead of a coin.
    g0, g1 = ROOM["glass"]
    hand = (0.315, -0.426, 1.081)
    # AND THIS IS WHAT SETS THE TILT, not the tilt band. The bottle is a rigid
    # rod: 0.198 m from the grip to the lip. Pin the lip over the glass and pin
    # the palm, and the angle between them is arithmetic — there is no freedom
    # left for a `band` to express an opinion about. Which is why asking POURB
    # for 110-118 moved it from 103.7 to 109.5 and no further, and why loosening
    # its chain to POUR did almost nothing: nothing was holding it back except
    # where its own hand was told to be.
    #
    #   tilt 105  grip (0.315 -0.426 1.081)   <- which is exactly `hand`
    #   tilt 110  grip (0.315 -0.421 1.098)
    #   tilt 117  grip (0.315 -0.411 1.120)
    #
    # So `handB` is the grip for 117 with the lip 14 mm higher than `hand`'s:
    # 53 mm up and 15 mm in toward the glass, against the 22 up and 2 in it
    # carried before. It is also, incidentally, an easier reach — raising a hand
    # toward shoulder height shortens it, 0.463 m from the shoulder against
    # 0.502 at the old value.
    handB = (0.315, -0.411, 1.134)
    return {
        # Bending to a stool. The hand has to get to 0.83 m off the floor with
        # a shoulder that starts at 1.40, which is a 0.57 m drop against a
        # 0.48 m arm — so the lean is not decoration, it is the only way the
        # hand arrives at all, and the elbow stays open because a reach is not
        # a curl.
        "REACH": dict(palm=GRIP_STAND, look=GRIP_STAND, tilt=(0, 9), elbow=(104, 152),
                      lean=(15, 27), near=idle, nearW=0.00008),
        # Closed on it. Same place, elbow in a little as the hand takes the
        # weight, which is the whole of what makes a grasp read as a grasp.
        "HOLD": dict(palm=GRIP_STAND, look=GRIP_STAND, tilt=(0, 7), elbow=(98, 142),
                     lean=(15, 27), near=idle, nearW=0.00008),
        "LIFT": dict(palm=lift, look=(g0, g1, ROOM["rim"]), tilt=(0, 12), elbow=(80, 118),
                     lean=(3, 14), near=idle, nearW=0.00008),
        # Arrived over the glass, tipped but not yet pouring. Splitting the
        # travel from the turn is most of why the clip reads as deliberate —
        # so this shares the pour's HAND and differs only in the wrist, and
        # therefore carries no lip target at all: at 65 deg the lip is still
        # up in the air and pinning it there would drag the arm back out.
        #
        # 58-72 rather than the 38-54 it asked for at first, and the number is
        # the wrist's, not a preference: with the arm parked where the pour
        # needs it, `handR` runs out of roll about 37 deg short of upright, so
        # a tighter band buys nothing but an arm that swings out of the pour
        # and back into it to satisfy it. Nothing pours at 65 deg either.
        "TIP": dict(palm=hand, palmW=90.0, look=(g0, g1, ROOM["rim"]),
                    tilt=(58, 72), elbow=(92, 130), lean=(6, 13),
                    near=idle, nearW=0.00008),
        # THE PALM IS A TARGET AS WELL AS THE LIP, and softly, which is the
        # difference between this and the first pass. With only the lip pinned
        # the solver is free to park her hand half a metre in front of her
        # navel and lean the bottle BACK over the glass — every number passes
        # and the bottle points at her, which is the thing being fixed. Her
        # hand belongs outboard of the glass, on her right, with the bottle
        # leaning in across it: that is what a right-handed pour looks like
        # from any seat in the room.
        "POUR": dict(lip=lip, palm=hand, palmW=260.0, look=(g0, g1, ROOM["rim"]),
                     tilt=(96, 103), elbow=(92, 122), lean=(4, 13),
                     near=idle, nearW=0.00008),
        # A pour is held for a second, and a still frame held for forty frames
        # is the one thing an eye is certain about. So it drifts: further over
        # as the glass fills, and the hand comes up with it.
        #
        # AND THE TWO BANDS MUST NOT OVERLAP, which is the whole of why they
        # did not drift. `band` is zero anywhere inside its range, so 99-108
        # against 106-114 leaves the solver free to satisfy both at 107 — and
        # `POURB` is chained to `POUR` with a `near` term that actively pulls
        # it there. It landed at 103.7 and 105.9. Measured across the retimed
        # clip, the whole body moved **0.9 degrees in 2.33 seconds** through
        # the pour: 0.4 deg/s, over nearly a third of the clip, in the one
        # stretch of it anybody is looking at. A held frame is a held frame
        # whether or not the note above it says it drifts.
        #
        # 96-103 and 110-118 cannot both be satisfied, so the drift is now a
        # condition rather than a hope: about fourteen degrees, which is what a
        # bottle has to give back as the fifth of it that fills a glass leaves,
        # and about 49 mm of travel at the punt where an eye can see it. The
        # hand rise stays at 14 mm and not the 35 the wine climbs, because the
        # stream shortening as the level comes up to meet it is the better cue
        # of the two and raising the lip in step would cancel exactly that.
        "POURB": dict(lip=(lip[0], lip[1], lip[2] + 0.014), palm=handB,
                      look=(g0, g1, ROOM["rim"]),
                      palmW=260.0, tilt=(114, 120),
                      elbow=(92, 122), lean=(2, 10),
                      near=idle, nearW=0.00008),
    }


def fmt(spec, name):
    out = ["%s = {" % name]
    for b in ("spine01", "spine02", "spine03", "chest", "neck", "head",
              "clavicleR",
              "armUR", "armLR", "handR",
              "legUL", "legLL", "footL", "legUR", "legLR", "footR"):
        v = spec[b]
        out.append('    "%s": (%.1f, %.1f, %.1f),' % (b, v[0], v[1], v[2]))
    out.append("}")
    return "\n".join(out)


def props(m):
    """A bottle, a glass and a stool top, put where the solve says they are.

    Rendering the figure on her own is how the shipped pose passed review: a
    naked woman with her arm out is a fine picture and says nothing at all
    about whether the thing in her hand is pointing the right way. These are
    four cylinders and they answer the only question being asked.
    """
    made = []

    def cyl(r, h, base, axis=Vector((0, 0, 1)), mat=None):
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h,
                                            location=(0, 0, 0), vertices=24)
        o = bpy.context.object
        q = Vector((0, 0, 1)).rotation_difference(axis.normalized())
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = q
        o.location = base + axis.normalized() * (h * 0.5)
        if mat:
            o.data.materials.append(mat)
        made.append(o)
        return o

    def flat(name, rgb):
        mt = bpy.data.materials.new(name)
        mt.use_nodes = True
        bsdf = mt.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = rgb + (1.0,)
        return mt

    dark = flat("wsGlass", (0.02, 0.09, 0.04))
    pale = flat("wsLabel", (0.86, 0.82, 0.70))
    wood = flat("wsWood", (0.42, 0.30, 0.19))
    red = flat("wsWine", (0.32, 0.03, 0.06))

    foot, axis = m["foot"], m["axis"]
    cyl(BOTTLE_R, 0.146, foot, axis, dark)                       # body
    cyl(BOTTLE_R + 0.001, 0.080, foot + axis * 0.048, axis, pale)  # label
    cyl(0.024, 0.100, foot + axis * 0.146, axis, dark)           # shoulder
    cyl(0.0152, 0.062, foot + axis * 0.244, axis, dark)          # neck
    st = ROOM["stool"]
    cyl(0.168, 0.022, Vector((ROOM["bottleFoot"][0] - 0.06,
                              ROOM["bottleFoot"][1] + 0.06, st - 0.022)),
        Vector((0, 0, 1)), wood)
    g = ROOM["glass"]
    cyl(0.006, 0.075, Vector((g[0], g[1], st)), Vector((0, 0, 1)), pale)
    cyl(0.040, 0.083, Vector((g[0], g[1], st + 0.085)), Vector((0, 0, 1)), pale)
    cyl(0.036, 0.040, Vector((g[0], g[1], st + 0.083)), Vector((0, 0, 1)), red)
    # The stream, from the lip down to the wine, which is the thing the whole
    # `pourAt` number is about.
    lip = m["lip"]
    drop = lip.z - (st + 0.123)
    if drop > 0.005 and m["tilt"] > 95:
        cyl(0.004, drop, Vector((lip.x, lip.y, lip.z - drop)),
            Vector((0, 0, 1)), red)
    return made


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    import human_mh as H

    idle = {k: v for k, v in H.IDLE_A.items() if not k.startswith("@")}

    if "--check" in argv:
        # The hand-rolled FK against Blender's own, on a pose with something in
        # every joint. A wrong recursion converges beautifully on nonsense.
        H.pose(rig, H.WINE_POUR)
        mats = fk(H.WINE_POUR, WANT)
        worst = 0.0
        for n in WANT:
            a = (rig.matrix_world @ rig.pose.bones[n].matrix).to_translation()
            worst = max(worst, (a - head_of(mats[n])).length)
        print("[wine] FK vs blender, worst joint: %.6f m" % worst)
        # And the bottle, against what the shipped pose actually does.
        p, ax = bottle_of(mats)
        print("[wine] shipped WINE_POUR: palm(%+.3f %+.3f %+.3f) tilt %.1f"
              % (p.x, p.y, p.z, math.degrees(math.acos(ax.z))))
        m = measure(H.WINE_POUR)
        print("[wine]   elbow %.0f  lean %.0f  gap %.3f  lip(%+.3f %+.3f %+.3f)"
              % (m["elbow"], m["lean"], m["gap"], m["lip"].x, m["lip"].y,
                 m["lip"].z))
        # And the whole clip, key by key, because what reads as wrong on screen
        # is never one key — it is the same fault held for five seconds.
        print("[wine] key        lean elbow tilt   palm(x y z)        "
              "shoulder(x z)  head(x z)")
        for nm in ("IDLE_A", "WINE_REACH", "WINE_HOLD", "WINE_LIFT",
                   "WINE_TIP", "WINE_POUR", "WINE_POUR_B"):
            mm = measure(getattr(H, nm))
            print("[wine] %-10s %5.1f %5.0f %5.1f  %+.3f %+.3f %+.3f  "
                  "%+.3f %+.3f  %+.3f %+.3f"
                  % (nm, mm["lean"], mm["elbow"], mm["tilt"],
                     mm["palm"].x, mm["palm"].y, mm["palm"].z,
                     mm["sh"].x, mm["sh"].z, mm["head"].x, mm["head"].z))
        if "--solve" not in argv:
            return

    if "--dip" in argv:
        for k in (0, 6, 10, 14, 20, 26, 32, 40, 50):
            spec = dict(idle, **dip_legs(float(k), idle))
            m = measure(spec)
            print("[wine] knee %2d  hips %.3f  drop %.3f  palm %.3f  "
                  "legU %+.1f foot %+.1f"
                  % (k, m["hips"], measure(idle)["hips"] - m["hips"],
                     m["palm"].z, spec["legUL"][0], spec["footL"][0]))
        return

    if "--verify" in argv:
        # THE SAME GUARD `ballet.py` GOT IN 1.208.0, and this file is the other
        # half of the same trap: the goals live here, the poses ship from
        # `human_mh.py`, and nothing has ever checked that the second still
        # answers the first.
        #
        # WHAT IT CANNOT DO is check the bands. A hill climb is stochastic, so
        # re-solving and comparing angle for angle proves nothing — and the
        # bands are not hard constraints anyway, they are terms with weights.
        # Tried that first and it reported six "failures" that are all the
        # solver doing its job: TIP is 90 mm off a palm target carrying a
        # weight of 90 against POUR's 260, and is chained to POUR at 0.0230,
        # the strongest chain in the file. It is SUPPOSED to be dragged. A
        # checker that calls that broken is a checker nobody will run twice.
        #
        # What it can do is measure DRIFT. `cost()` is the solver's own
        # objective, it is deterministic, and every pose below was written down
        # with the cost the solve that produced it reported. Recompute it. If a
        # pose has been edited by hand, or a goal has been changed without
        # re-solving, or a splice dropped a block, the number moves.
        # Measured off the shipped poses at 1.209.0, `near` excluded on both
        # sides. These are NOT the costs the solve printed — those carry the
        # chain, which is scored against whichever pose the run happened to
        # chain from and is therefore not reconstructible from the file. TIP is
        # the big one and stays the big one: it is 90 mm off a palm target
        # weighted 90 while being pulled by the strongest chain here, on
        # purpose.
        SOLVED = {"REACH": 0.0582, "HOLD": 0.0652, "LIFT": 0.0230,
                  "POUR": 0.0147, "POURB": 0.0356, "TIP": 1.4426}
        G = goals(idle)
        bad = 0
        print("[verify] %-7s %9s %9s   %s" % ("pose", "solved", "now", "drift"))
        for nm, key in (("REACH", "REACH"), ("HOLD", "HOLD"), ("LIFT", "LIFT"),
                        ("TIP", "TIP"), ("POUR", "POUR"), ("POUR_B", "POURB")):
            g = dict(G[key])
            # `near` is scored against whatever the solve chained it to, which
            # is not reconstructible here, so it comes out of the comparison on
            # both sides rather than being guessed at.
            g.pop("near", None)
            c = cost(getattr(H, "WINE_" + nm), g)[0]
            ref = SOLVED[key]
            d = abs(c - ref)
            flag = ""
            if d > max(0.05, ref * 0.15):
                flag = "  <<< DRIFTED"
                bad += 1
            print("[verify] %-7s %9.4f %9.4f   %+.4f%s" % (nm, ref, c, c - ref, flag))
        print("[verify] %s" % ("%d pose(s) drifted -- re-run --solve" % bad if bad
                               else "every shipped pose still answers its own goal"))
        return

    if "--shipped" in argv:
        # The poses as they stand in human_mh.py, drawn with the room's own
        # props, on a plain ground and from three fixed angles. Judging a pour
        # from inside the kabina is judging it through a bead curtain in the
        # dark; this is the same six poses with nothing in the way.
        # Her RIGHT side and her right three-quarter, because that is the
        # side the bottle is on and every view in human_mh.py's table is
        # either her front or her left.
        H.VIEWS["rside"] = (-90.0, 6.0, 1.00, 2.5, 760, 1000)
        H.VIEWS["r3q"] = (-42.0, 10.0, 1.00, 2.3, 760, 1000)
        for nm in ("REACH", "HOLD", "LIFT", "TIP", "POUR", "POUR_B"):
            spec = getattr(H, "WINE_" + nm)
            m = measure(spec)
            print("[wine] %-7s lean %5.1f elbow %5.0f tilt %5.1f gap %.3f hips %.3f"
                  % (nm, m["lean"], m["elbow"], m["tilt"], m["gap"], m["hips"]))
            H.pose(rig, spec)
            H._lights()
            made = props(m)
            H.render("ship_" + nm.lower(), ("rside", "r3q", "front"))
            for o in made:
                bpy.data.objects.remove(o, do_unlink=True)
        return

    if "--solve" in argv:
        names = [n for n in argv[argv.index("--solve") + 1:]
                 if not n.startswith("-")]
        G = goals(idle)
        names = names or ["REACH", "HOLD", "LIFT", "POUR", "POURB", "TIP"]
        # Each key is seeded from the one before it, so the clip comes out as
        # one movement rather than six poses that happen to share a room.
        base = dict(idle)
        blob = {}
        # Which key each one has to stay NEAR. Regularising everything toward
        # the idle gives six poses that each solve their own problem and then
        # argue with their neighbours across the clip: POUR and POUR_B came out
        # eleven degrees apart in spine01, which over the 0.65 s between them
        # is her whole torso rocking in the middle of a held pour. So the keys
        # that are meant to differ only in the wrist say so, and are pulled
        # hard toward the one they are a variation on.
        # SOLVE POUR BEFORE TIP. `TIP` is a variation on the pour — the arm has
        # arrived and only the wrist has yet to roll — so it is chained to it,
        # and a chain to a key that has not been solved yet is no chain at all.
        # Solved in clip order the first time round, TIP came out 20 deg away
        # from POUR in `spine01`: her whole back straightening and hinging again
        # inside half a second, twice, which is the lurch this file exists to
        # stop. The names default below are in solve order, not clip order.
        # POURB's chain to POUR is a quarter of what it was. The chain exists so
        # the clip interpolates instead of lurching between neighbours, and at
        # 0.0060 it was strong enough to hold POURB a degree short of its own
        # tilt band: the pour drifted 6 degrees where the band asked for 14.
        # POUR to POURB is 2.33 s of interpolation — the longest hold in the
        # clip by a factor of three — so it is exactly the pair that can afford
        # to differ, and the one that has to.
        CHAIN = {"HOLD": ("REACH", 0.0016), "POURB": ("POUR", 0.0015),
                 "TIP": ("POUR", 0.0230)}
        solved = {}
        for n in names:
            g = dict(G[n])
            g["seed"] = base
            if n in CHAIN and CHAIN[n][0] in solved:
                g["near"], g["nearW"] = solved[CHAIN[n][0]], CHAIN[n][1]
                g["seed"] = solved[CHAIN[n][0]]
            # The knees, fitted for this key and then left alone: they are not
            # on the free list, so the arm and the back solve around a dip
            # that is already anatomically consistent instead of the solver
            # discovering a squat that lifts one heel.
            base = dict(base, **dip_legs(DIP[n], idle))
            spec, f = solve(base, g, seed=abs(hash(n)) % 9999)
            c, parts, m = cost(spec, g)
            print("\n# %s  cost %.4f  %s" % (n, f, " ".join(
                "%s=%.3f" % (k, v) for k, v in sorted(parts.items()) if v > 1e-4)))
            print("#   palm(%+.3f %+.3f %+.3f) lip(%+.3f %+.3f %+.3f)"
                  % (m["palm"].x, m["palm"].y, m["palm"].z,
                     m["lip"].x, m["lip"].y, m["lip"].z))
            print("#   tilt %.1f  elbow %.0f  lean %.0f  gap %.3f  hips %.3f"
                  % (m["tilt"], m["elbow"], m["lean"], m["gap"], m["hips"]))
            print(fmt(spec, "WINE_" + n))
            blob[n] = {k: list(v) for k, v in spec.items()
                       if not k.startswith("@")}
            solved[n] = spec
            base = spec
            if "--preview" in argv:
                H.pose(rig, spec)
                H._lights()
                made = props(m)
                H.render("wine_" + n.lower(), ("side", "hero", "front"))
                for o in made:
                    bpy.data.objects.remove(o, do_unlink=True)
        Path("/tmp/wine_solved.json").write_text(json.dumps(blob, indent=1))


main()
