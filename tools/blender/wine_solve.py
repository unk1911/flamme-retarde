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
ROOM = {
    "stool": 0.722,           # the seat, and what both objects stand on
    "glass": (0.330, -0.140),  # (x, y): the glass's axis, y negative = her right
    "rim": 0.890,             # the top of the glass
    "bottleFoot": (0.420, -0.230, 0.722),
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
        "clavicleR", "armUR", "armLR", "handR")


def measure(spec):
    mats = fk(spec, WANT)
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
    add("gap", 30.0 * band(m["gap"], BOTTLE_R + FOREARM_R, 9.0))
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


def goals(idle):
    lip = ROOM["lip"]
    # Lifted clear of the stool, upright, and already on the way to the glass:
    # a hand's width up and a hand's width in, and no detour out to her hip.
    lift = (0.340, -0.246, 1.000)
    # Where her fist goes to pour, worked backwards from the lip: 0.198 m of
    # bottle past the grip, leaning in at about 105 deg, means the hand sits
    # roughly 0.19 m outboard of the glass and 0.05 m above the lip.
    g0, g1 = ROOM["glass"]
    hand = (0.292, -0.328, 1.080)
    handB = (0.292, -0.328, 1.112)
    return {
        # Bending to a stool. The hand has to get to 0.83 m off the floor with
        # a shoulder that starts at 1.40, which is a 0.57 m drop against a
        # 0.48 m arm — so the lean is not decoration, it is the only way the
        # hand arrives at all, and the elbow stays open because a reach is not
        # a curl.
        "REACH": dict(palm=GRIP_STAND, look=GRIP_STAND, tilt=(0, 9), elbow=(104, 152),
                      lean=(28, 46), near=idle, nearW=0.00008),
        # Closed on it. Same place, elbow in a little as the hand takes the
        # weight, which is the whole of what makes a grasp read as a grasp.
        "HOLD": dict(palm=GRIP_STAND, look=GRIP_STAND, tilt=(0, 7), elbow=(98, 142),
                     lean=(26, 44), near=idle, nearW=0.00008),
        "LIFT": dict(palm=lift, look=(g0, g1, ROOM["rim"]), tilt=(0, 10), elbow=(80, 118),
                     lean=(6, 18), near=idle, nearW=0.00008),
        # Arrived over the glass, tipped but not yet pouring. Splitting the
        # travel from the turn is most of why the clip reads as deliberate —
        # so this shares the pour's HAND and differs only in the wrist, and
        # therefore carries no lip target at all: at 45 deg the lip is still
        # up in the air and pinning it there would drag the arm back out.
        "TIP": dict(palm=hand, look=(g0, g1, ROOM["rim"]), tilt=(38, 54), elbow=(92, 130), lean=(8, 22),
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
                     tilt=(99, 108), elbow=(92, 122), lean=(12, 26),
                     near=idle, nearW=0.00008),
        # A pour is held for a second, and a still frame held for forty frames
        # is the one thing an eye is certain about. So it drifts: further over
        # as the glass fills, and the hand comes up with it.
        "POURB": dict(lip=(lip[0], lip[1], lip[2] + 0.014), palm=handB,
                      look=(g0, g1, ROOM["rim"]),
                      palmW=260.0, tilt=(106, 114),
                      elbow=(92, 122), lean=(12, 26),
                      near=idle, nearW=0.00008),
    }


def fmt(spec, name):
    out = ["%s = {" % name]
    for b in ("spine01", "spine02", "spine03", "chest", "neck", "head",
              "clavicleR",
              "armUR", "armLR", "handR"):
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
        if "--solve" not in argv:
            return

    if "--solve" in argv:
        names = [n for n in argv[argv.index("--solve") + 1:]
                 if not n.startswith("-")]
        G = goals(idle)
        names = names or list(G)
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
        CHAIN = {"HOLD": ("REACH", 0.0016), "POURB": ("POUR", 0.0060),
                 "TIP": ("POUR", 0.0016)}
        solved = {}
        for n in names:
            g = dict(G[n])
            g["seed"] = base
            if n in CHAIN and CHAIN[n][0] in solved:
                g["near"], g["nearW"] = solved[CHAIN[n][0]], CHAIN[n][1]
                g["seed"] = solved[CHAIN[n][0]]
            spec, f = solve(base, g, seed=abs(hash(n)) % 9999)
            c, parts, m = cost(spec, g)
            print("\n# %s  cost %.4f  %s" % (n, f, " ".join(
                "%s=%.3f" % (k, v) for k, v in sorted(parts.items()) if v > 1e-4)))
            print("#   palm(%+.3f %+.3f %+.3f) lip(%+.3f %+.3f %+.3f)"
                  % (m["palm"].x, m["palm"].y, m["palm"].z,
                     m["lip"].x, m["lip"].y, m["lip"].z))
            print("#   tilt %.1f  elbow %.0f  lean %.0f  gap %.3f"
                  % (m["tilt"], m["elbow"], m["lean"], m["gap"]))
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
