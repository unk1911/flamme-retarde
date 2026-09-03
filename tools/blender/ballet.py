#!/usr/bin/env python3
"""The seven ballet positions, drafted and looked at before they go anywhere.

    tools/blender/blender.sh -b build/human_mh.blend -P tools/blender/ballet.py \
        -- --views side front [--only ARABESQUE PLIE]

Writes /tmp/mh_bal_<name>_<view>.png and prints, for every pose, where the feet
and hands ended up. The second half of that is the point: a ballet position is
mostly a claim about a foot — the working toe AT the supporting knee, the heels
OFF the floor by 60 mm and not 5, the supporting leg straight — and those are
numbers, not opinions. Renders alone let all three drift.

Once a pose is right it gets pasted into human_mh.py. This file stays as the
place to argue with them, the way `wine_solve.py` is for the pour.

Rig signs, since every one of these is a leg and the legs are where it is
easiest to get them backwards:

    legU  +x swings the KNEE backward   -> negative x lifts the knee in front
    legL  +x swings the ANKLE backward  -> positive x bends the knee
    legU  +y is the thigh's own twist   -> TURNOUT, and it mirrors in sign
    legU  +z is the track               -> mirrors in sign; wider stance
    foot/toe are FLAT bones: their local z is world up, so they do not follow
    the +x-is-backward rule the up-and-down bones do.
"""

import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import human_mh as H  # noqa: E402

# How much the hips rotate outward. A dancer's first position is 90 deg a side
# off the hip; nobody without fifteen years of it gets past about 45, and this
# figure's hip weights start to fold at 40. 34 reads as turnout and does not
# tear the crease at the top of the thigh.
OUT = 34.0
# Heels off the floor. Demi-pointe, not pointe: she is barefoot on wet concrete.
RISE = -34.0

BASE = dict(H.IDLE_A)


def leg(p, side, hip=0.0, knee=0.0, out=OUT, track=0.0, ankle=0.0, toe=0.0):
    """Write one leg into `p`. `side` is 'L' or 'R'; the mirror is in the sign
    of everything that is not sagittal, which is what the rig's rolls buy."""
    # TURNOUT MIRRORS THE OTHER WAY FROM THE TRACK. Written with both on the
    # same sign the first time, which came out knock-kneed: the thighs rotated
    # INWARD and the knees crossed in front of each other in a plie, which is
    # the one thing a plie is not allowed to do.
    # TURNOUT AND TRACK BOTH MIRROR THE OPPOSITE WAY FROM THE SAGITTAL ANGLES,
    # and both were written the other way round the first time. The turnout
    # rotated the thighs INWARD and the knees crossed in a plie; the track
    # ADDUCTED, so every leg meant to go out to the side went across her body
    # instead — a developpe a la seconde that crossed in front of the
    # supporting leg. `track` here is positive-is-apart, which `IDLE_A` writes
    # as its own negative because `STAND_TRACK` exists to take the last few
    # degrees off a base mesh whose tibiae already flare.
    sg = 1.0 if side == "L" else -1.0
    p["legU" + side] = (hip, -out * sg, -track * sg)
    p["legL" + side] = (knee, 0.0, 0.0)
    p["foot" + side] = (ankle, 0.0, 0.0)
    p["toe" + side] = (toe, 0.0, 0.0)
    return p


def arms(p, **kw):
    for k, v in kw.items():
        p[k] = v
    return p


# ── the arm positions ────────────────────────────────────────────────────────
#
# Five shapes, and every ballet pose in this file is two of them. Written as
# named positions rather than as angles per pose because that is what they are:
# a dancer does not choose a shoulder angle, she goes to fifth.
#
# On this rig `armU` z is ADDUCTION and it mirrors in sign — `STAND_ARM_IN` is
# 33 and hangs the humerus 6.5 deg off vertical, so smaller is more open and
# negative is out. Getting that backwards is what put every raised arm against
# her own ear in the first draft, and folded the low ones across her ribs.
ARM = {
    # Bras bas: rounded and low, hands just in front of the thighs, elbows
    # lifted off the body. Where every exercise starts and ends.
    "bas": ((6, 8, 26), (-32, -10, 30), (0, 8, 22)),
    # First: the same oval carried up to the navel.
    "first": ((-35, 9, 5), (-10, 14, 56), (-21, 16, 30)),
    # Second: open to the sides, a little forward of the shoulders and a little
    # below them, elbow soft, palm down.
    "second": ((2, -12, -19), (-2, 0, -7), (-19, -1, 21)),
    # Fifth: overhead. The elbow has to stay nearly open or the hands come down
    # to her ears, which is what thirty degrees of forearm did in the first
    # draft — and past about -160 on the shoulder the two arms cross.
    "fifth": ((-155, -12, 60), (-5, -12, 55), (-21, -10, 9)),
    # And the two only the arabesque uses: one arm long in front, on the line
    # of the raised leg, one long behind it.
    "front": ((-91, -12, 6), (-2, -14, 14), (-21, 12, 28)),
    "back": ((59, 12, 24), (-2, 13, 18), (-15, 16, -10)),
}


def arm(p, side, name):
    """Put one arm in a named position. The mirror is in the sign of z."""
    sg = 1.0 if side == "L" else -1.0
    u, l, h = ARM[name]
    p["armU" + side] = (u[0], u[1] * sg, u[2] * sg)
    p["armL" + side] = (l[0], l[1] * sg, l[2] * sg)
    p["hand" + side] = (h[0], h[1] * sg, h[2] * sg)
    return p


def pose(**kw):
    return dict(BASE, **kw)


# ── fitting, because the Euler order makes guessing hopeless ─────────────────
#
# Bone rotations here are XYZ Euler, which Blender applies as Rz@Ry@Rx — so the
# `track` term is applied LAST, about the leg's REST fore-aft axis. On a leg
# hanging down that is abduction and behaves; on a leg already swung ninety
# degrees behind her it is a roll, and it moves the foot up and down instead of
# sideways. That is the whole reason the attitude and the arabesque kept
# crossing the working leg over her own midline no matter which way the sign
# went, and it is not something you fix by thinking harder about it.
#
# So: say where the knee and the ankle have to BE, and fit the five numbers.
# Same forward kinematics as tools/blender/wine_solve.py — Blender's own
# recursion, in mathutils, with no depsgraph in the loop, which is what makes a
# few thousand candidates cost a second instead of two minutes.

_REST = {b.name: b.matrix_local.copy() for b in bpy.data.objects["rig"].data.bones}
_PARENT = {b.name: (b.parent.name if b.parent else None)
           for b in bpy.data.objects["rig"].data.bones}
_RW = bpy.data.objects["rig"].matrix_world.copy()


def fk(spec, want):
    cache = {}

    def go(name):
        m = cache.get(name)
        if m is not None:
            return m
        rot = spec.get(name, (0.0, 0.0, 0.0))
        basis = Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
        par = _PARENT[name]
        m = (basis if par is None else go(par)
             @ (_REST[par].inverted() @ _REST[name]) @ basis)
        if par is None:
            m = _REST[name] @ basis
        cache[name] = m
        return m

    return {n: (_RW @ go(n)).to_translation() for n in want}


def climb(seed, apply, score, lo, hi, iters=5000, sigma=9.0, seedn=1):
    """(1+1) hill climb on a short vector of degrees. Enough for a limb."""
    rnd = random.Random(seedn)
    x = list(seed)
    f = score(apply(x))
    sig, good = sigma, 0
    for n in range(iters):
        y = [max(lo[i], min(hi[i], v + rnd.gauss(0, sig))) for i, v in enumerate(x)]
        g = score(apply(y))
        if g < f:
            x, f, good = y, g, good + 1
        if (n + 1) % 50 == 0:
            sig = max(0.05, min(20.0, sig * (1.3 if good > 10 else 0.84)))
            good = 0
    return x, f


def fit_leg(base, side, knee_at, ankle_at, seed, iters=6000):
    """Fit (hip, knee, out, track, ankle) so the knee and ankle land where a
    ballet position says they do."""
    want = ("legL" + side, "foot" + side, "toe" + side)

    def apply(v):
        p = dict(base)
        leg(p, side, hip=v[0], knee=v[1], out=v[2], track=v[3], ankle=v[4],
            toe=v[5])
        return p

    def score(p):
        g = fk(p, want)
        return (400.0 * (g["legL" + side] - Vector(knee_at)).length_squared
                + 400.0 * (g["foot" + side] - Vector(ankle_at)).length_squared)

    # The ankle and the toe are FIXED, not fitted: the ankle joint's position
    # does not depend on them, so the fitter has no signal and wanders — and
    # left to wander it picked +35 for the arabesque, which is a raised leg
    # with the toes turned UP. A ballet foot is pointed, always, and turnout is
    # bounded because past about 46 deg the hip weights on this mesh fold.
    lo = [-140, 0, 22, -40, seed[4], seed[5]]
    hi = [140, 150, 46, 110, seed[4], seed[5]]
    x, f = climb(seed, apply, score, lo, hi, iters=iters)
    return x, f


def fit_arm(base, side, hand_at, elbow_at, seed, iters=6000, bend=False):
    """Fit one arm to a hand and an elbow.

    `bend` adds a tenth variable: a lateral bend of the spine toward that side.
    It exists for the barre and only for the barre. The ladder's handrail is
    0.90 m off the deck and her hand hanging dead straight reaches 0.92, so she
    can just rest it there standing — but a releve makes her 65 mm taller and
    there is no arm angle that gives that back, because the arm is already at
    full extension. What a person does at a barre that is too low for them is
    lean into it, so that is what she does, and eleven degrees of it is enough.
    """
    want = ("armL" + side, "hand" + side)
    sgb = 1.0 if side == "L" else -1.0

    def apply(v):
        p = dict(base)
        sg = 1.0 if side == "L" else -1.0
        p["armU" + side] = (v[0], v[1] * sg, v[2] * sg)
        p["armL" + side] = (v[3], v[4] * sg, v[5] * sg)
        p["hand" + side] = (v[6], v[7] * sg, v[8] * sg)
        if bend:
            b = v[9] * sgb
            for k, share in (("spine01", 0.30), ("spine02", 0.34),
                             ("spine03", 0.36)):
                r = p.get(k, (0.0, 0.0, 0.0))
                p[k] = (r[0], r[1], r[2] + b * share)
        return p

    def score(p):
        g = fk(p, want)
        return (400.0 * (g["hand" + side] - Vector(hand_at)).length_squared
                + 120.0 * (g["armL" + side] - Vector(elbow_at)).length_squared)

    # The elbow bends forward and the shoulder does not twist much: without
    # those two bounds the fit hits the target with a forearm hyperextended
    # backwards and a humerus rolled thirty degrees, which lands the hand in
    # the right place attached to an arm nobody has.
    lo = [-180, -12, -90, -105, -14, -50, -22, -20, -20]
    hi = [70, 12, 60, -2, 14, 60, 22, 20, 30]
    if bend:
        lo, hi, seed = lo + [0.0], hi + [11.0], list(seed) + [4.0]
    x, f = climb(seed, apply, score, lo, hi, iters=iters)
    return x, f


# ── the seven ────────────────────────────────────────────────────────────────
#
# Read off the sheet: arabesque, pirouette, attitude, developpe, pique, plie,
# releve. Every one of them is the same two decisions — what the working leg is
# doing and where the arms are — over a supporting leg that is straight and,
# in five of the seven, risen.

# PLIE. Second position: feet apart and turned out, knees bending straight out
# over the toes, heels DOWN, back long, arms open low in front. The whole test
# of a plie is whether the knees track over the toes or fall inward, which the
# side view cannot see and the front view is entirely about.
PLIE = pose()
leg(PLIE, "L", hip=-9, knee=29, out=46, track=15, ankle=-6, toe=4)
leg(PLIE, "R", hip=-9, knee=29, out=46, track=15, ankle=-6, toe=4)
arms(PLIE,
     spine01=(0, 0, 0), spine02=(0, 0, 0), spine03=(0, 0, 0), chest=(-2, 0, 0),
     neck=(0, 0, 0), head=(-2, -4, 0),
     clavicleL=(0, 0, 4), clavicleR=(0, 0, -4))
arm(PLIE, "L", "bas")
arm(PLIE, "R", "bas")

# RELEVE. Both heels up, weight over the balls of both feet, feet in first,
# arms in fifth — rounded over the head, elbows soft and OUT, hands not
# touching. The first draft put them at her temples: `armU` z is adduction on
# this rig, so a big positive number keeps a raised arm tucked against the head
# rather than opening the oval a fifth position is.
RELEVE = pose()
leg(RELEVE, "L", hip=0, knee=2, out=40, track=4, ankle=-34, toe=28)
leg(RELEVE, "R", hip=0, knee=2, out=40, track=4, ankle=-34, toe=28)
arms(RELEVE,
     spine01=(0, 0, 0), spine02=(0, 0, 0), spine03=(0, 0, 0), chest=(-3, 0, 0),
     neck=(0, 0, 0), head=(-2, 0, 0),
     clavicleL=(0, 0, 12), clavicleR=(0, 0, -12))
arm(RELEVE, "L", "fifth")
arm(RELEVE, "R", "fifth")

# PIROUETTE, which as a still is retire on releve: supporting leg straight and
# risen, working thigh turned OUT TO THE SIDE and the foot drawn up to the
# supporting knee, arms rounded in front in first. The first draft had the
# thigh forward instead of out, which is a flamingo.
#
# The turn itself is not in the pose — it is a full rotation written into
# `pelvis` z across the clip's keys, so the clip spins her and the game does
# not have to know anything about it.
PIROU = pose()
leg(PIROU, "L", hip=0, knee=2, out=40, track=2, ankle=-34, toe=28)
leg(PIROU, "R", hip=-36, knee=117, out=46, track=12, ankle=-32, toe=20)
arms(PIROU,
     spine01=(0, 0, 0), spine02=(0, 0, 0), spine03=(0, 0, 0), chest=(-3, 0, 0),
     neck=(0, 0, 0), head=(0, 0, 0),
     clavicleL=(0, 0, 8), clavicleR=(0, 0, -8))
arm(PIROU, "L", "first")
arm(PIROU, "R", "first")

# PIQUE. Stepping straight up onto one leg, the other in retire in front of the
# supporting knee, one arm up in fifth and one open to second. The difference
# from the pirouette above is the arms and a foot carried a little further
# forward; the difference the eye reads is that she has arrived somewhere.
PIQUE = pose()
leg(PIQUE, "L", hip=0, knee=1, out=40, track=2, ankle=-34, toe=28)
leg(PIQUE, "R", hip=-60, knee=111, out=46, track=-15, ankle=-32, toe=20)
arms(PIQUE,
     spine01=(0, 0, 0), spine02=(0, -3, 0), spine03=(0, -3, 0), chest=(-3, 0, 0),
     neck=(0, 0, 0), head=(-4, 8, 0),
     clavicleL=(0, 0, 12), clavicleR=(0, 0, -8))
arm(PIQUE, "L", "fifth")
arm(PIQUE, "R", "second")

# ATTITUDE. Supporting leg straight and risen; the working leg lifted BEHIND
# with the knee bent about ninety degrees and — the part that makes it an
# attitude and not a sloppy arabesque — the knee carried OUT and the foot
# higher than the knee. One arm up in fifth, the other open to second.
ATTITUDE = pose()
leg(ATTITUDE, "L", hip=2, knee=2, out=40, track=2, ankle=-34, toe=28)
leg(ATTITUDE, "R", hip=43, knee=132, out=22, track=66, ankle=-32, toe=20)
arms(ATTITUDE,
     spine01=(-8, 0, 0), spine02=(-6, 0, 0), spine03=(-5, 0, 0), chest=(-4, 0, 0),
     neck=(2, 0, 0), head=(-6, 10, 0),
     clavicleL=(0, 0, 12), clavicleR=(0, 0, -8))
arm(ATTITUDE, "L", "fifth")
arm(ATTITUDE, "R", "second")

# ARABESQUE. The one everybody can name: supporting leg straight, working leg
# STRAIGHT behind and lifted to about the horizontal, the whole body one long
# line from the raised fingertips to the raised toe, and the trunk tipped
# forward to pay for the height of the leg. First arabesque — the arm on the
# same side as the supporting leg goes forward.
#
# `legU` angles are measured from the leg hanging DOWN, which is the thing the
# first draft got wrong: 62 there is 28 degrees above the floor, not 28 below
# the horizontal, and what it rendered was a woman wading.
ARABESQUE = pose()
leg(ARABESQUE, "L", hip=-10, knee=1, out=40, track=2, ankle=-34, toe=28)
leg(ARABESQUE, "R", hip=85, knee=19, out=22, track=-40, ankle=-32, toe=20)
arms(ARABESQUE,
     spine01=(-22, 0, 0), spine02=(-10, 0, 0), spine03=(-6, 0, 0),
     chest=(6, 0, 0), neck=(10, 0, 0), head=(8, 0, 0),
     clavicleL=(0, 0, 10), clavicleR=(0, 0, -10))
arm(ARABESQUE, "L", "front")
arm(ARABESQUE, "R", "back")

# DEVELOPPE. The working leg unfolds from retire to straight and high, out to
# the side. It is the one pose here that is really a MOVEMENT — the shape at
# the end of it is only interesting because you watched it get there — so the
# clip plays retire, half-open, and this.
DEVELOPPE = pose()
leg(DEVELOPPE, "L", hip=0, knee=1, out=40, track=2, ankle=-34, toe=28)
leg(DEVELOPPE, "R", hip=-9, knee=6, out=46, track=95, ankle=-32, toe=20)
arms(DEVELOPPE,
     spine01=(0, 0, 0), spine02=(0, 5, 0), spine03=(0, 6, 0), chest=(-3, 0, 0),
     neck=(0, 0, 0), head=(-2, -10, 0),
     clavicleL=(0, 0, 12), clavicleR=(0, 0, -10))
arm(DEVELOPPE, "L", "fifth")
arm(DEVELOPPE, "R", "second")



# ── the connective poses, and the two that hold the rail ─────────────────────
#
# THE LADDER IS TOO LOW TO BE A BARRE, and the honest answer was to stop
# pretending otherwise. Its handrail is 0.90 m off the deck; her shoulder is
# 1.40 with a 0.48 m arm, so a hand hanging dead straight reaches 0.92 — she
# can rest a hand on it standing, and she can keep it there through a demi-plie
# with eleven degrees of lean toward it, which is what anybody does at a barre
# built for somebody shorter. She CANNOT keep it there on releve: that makes
# her 65 mm taller and there is no arm angle that gives the height back,
# because the arm is already straight. Fitted anyway it came out 80 mm through
# the air above the rail.
#
# So she holds it for the plie and lets go for everything after, which is both
# what the geometry allows and what a class actually looks like.
LEAN_HOLD = 11.0
LEAN_PLIE = 10.0


def lean(p, deg):
    for k, share in (("spine01", 0.30), ("spine02", 0.34), ("spine03", 0.36)):
        r = p.get(k, (0.0, 0.0, 0.0))
        p[k] = (r[0], r[1], r[2] + deg * share)
    return p


# First position, turned out, heels down, both arms low and rounded. The pose
# every exercise starts and ends on, and the one the clip passes through
# between positions so that nothing ever cuts from one shape to another.
STAND = pose()
leg(STAND, "L", hip=-4, knee=3, out=40, track=4, ankle=-4, toe=2)
leg(STAND, "R", hip=-4, knee=3, out=40, track=4, ankle=-4, toe=2)
arms(STAND, spine01=(0, 0, 0), spine02=(0, 0, 0), spine03=(0, 0, 0),
     chest=(-2, 0, 0), neck=(0, 0, 0), head=(-2, 0, 0),
     clavicleL=(0, 0, 4), clavicleR=(0, 0, -4))
arm(STAND, "L", "bas")
arm(STAND, "R", "bas")

# The same, with her left hand on the rail.
HOLD = pose()
leg(HOLD, "L", hip=-4, knee=3, out=40, track=4, ankle=-4, toe=2)
leg(HOLD, "R", hip=-4, knee=3, out=40, track=4, ankle=-4, toe=2)
arms(HOLD, spine01=(0, 0, 0), spine02=(0, 0, 0), spine03=(0, 0, 0),
     chest=(-2, 0, 0), neck=(0, 4, 0), head=(-2, 6, 0),
     clavicleL=(0, 0, 6), clavicleR=(0, 0, -4),
     armUL=(12, 12, 11), armLL=(-2, 1, 16), handL=(-2, 6, 28))
arm(HOLD, "R", "bas")
lean(HOLD, LEAN_HOLD)

# Demi-plie at the rail: the legs of PLIE, the left hand still on it, the right
# arm opening to second as she goes down.
PLIE_B = dict(PLIE)
arms(PLIE_B, neck=(0, 4, 0), head=(-2, 6, 0), clavicleL=(0, 0, 6),
     armUL=(8, 12, 6), armLL=(-2, -14, 25), handL=(-20, 12, 29))
arm(PLIE_B, "R", "second")
lean(PLIE_B, LEAN_PLIE)

# Retire, which is where the developpe unfolds from: the pirouette's legs with
# the arms already open, so the leg is the only thing that moves.
RETIRE = dict(PIROU)
arm(RETIRE, "L", "fifth")
arm(RETIRE, "R", "second")

POSES2 = [("stand", STAND), ("hold", HOLD), ("plie_b", PLIE_B),
          ("retire", RETIRE)]


POSES = [
    ("plie", PLIE), ("releve", RELEVE), ("pirou", PIROU), ("pique", PIQUE),
    ("attitude", ATTITUDE), ("arabesque", ARABESQUE), ("developpe", DEVELOPPE),
]


def report(rig, name, p):
    """Where the pose actually put things, which is the half a render hides."""
    H.pose(rig, p)
    g = {}
    for b in ("footL", "footR", "toeL", "toeR", "legLL", "legLR",
              "handL", "handR", "pelvis", "head"):
        if b in rig.pose.bones:
            g[b] = rig.matrix_world @ rig.pose.bones[b].head
    _who, low = H._lowest(rig, p)
    v = lambda b: "(%+.2f %+.2f %+.2f)" % (g[b].x, g[b].y, g[b].z)
    print("[bal] %-10s low %+.3f hips %+.3f  kneeR%s footR%s"
          % (name, low, g["pelvis"].z, v("legLR"), v("footR")))
    print("           handL%s handR%s" % (v("handL"), v("handR")))
    return g


# What each position CLAIMS, in metres in her own frame: +x in front of her,
# +y her left, +z up off the floor she stands on. Her hip joints are at 0.934,
# the supporting knee at about 0.47, her shoulders at 1.40 and the crown of her
# head at 1.72 — which is all the scale anyone needs to read the table.
#
# These are the poses. The angles are just what the rig needs to get here.
TARGET_ARM = {
    #          hand                    elbow
    "bas":    ((0.20, 0.11, 0.86), (0.10, 0.26, 1.13)),
    "first":  ((0.26, 0.10, 1.10), (0.16, 0.30, 1.20)),
    "second": ((0.14, 0.60, 1.25), (0.10, 0.36, 1.28)),
    "fifth":  ((0.12, 0.14, 1.82), (0.16, 0.36, 1.60)),
    "front":  ((0.52, 0.13, 1.60), (0.32, 0.20, 1.51)),
    "back":   ((-0.34, 0.28, 1.02), (-0.16, 0.28, 1.20)),
}
# And the working leg, for the four positions where the Euler order makes the
# angles unguessable. (knee joint, ankle joint) for the RIGHT leg, which is the
# working one throughout: retire puts the foot at the supporting knee, attitude
# carries it behind and above, arabesque takes it straight back to horizontal.
TARGET_LEG = {
    "retire":   ((0.06, -0.36, 0.72), (0.03, -0.06, 0.50)),
    "pique":    ((0.15, -0.34, 0.70), (0.11, -0.03, 0.49)),
    "attitude": ((-0.22, -0.33, 0.78), (-0.34, -0.12, 1.02)),
    "arabesque": ((-0.34, -0.09, 0.93), (-0.70, -0.05, 1.02)),
    "plie":     ((0.06, -0.34, 0.55), (-0.02, -0.30, 0.10)),
    "seconde":  ((0.06, -0.52, 1.02), (0.04, -0.90, 1.08)),
}


def fit(argv):
    """Print angles that land the named positions where TARGET_* says."""
    print("# --- arms ---")
    for name, (hand, elbow) in TARGET_ARM.items():
        seed = [ARM[name][0][0], ARM[name][0][1], ARM[name][0][2],
                ARM[name][1][0], ARM[name][1][1], ARM[name][1][2],
                ARM[name][2][0], ARM[name][2][1], ARM[name][2][2]]
        x, f = fit_arm(BASE, "L", hand, elbow, seed)
        g = fk(fit_arm_apply(BASE, "L", x), ("handL", "armLL"))
        print('    "%s": ((%.0f, %.0f, %.0f), (%.0f, %.0f, %.0f), '
              '(%.0f, %.0f, %.0f)),   # hand(%+.2f %+.2f %+.2f) err %.4f'
              % (name, x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], x[8],
                 g["handL"].x, g["handL"].y, g["handL"].z, f))
    print("# --- legs (hip, knee, out, track, ankle, toe) ---")
    for name, (knee_at, ankle_at) in TARGET_LEG.items():
        # Pointed foot for anything off the floor; a plie keeps its heels down.
        ank, toe = (-6, 4) if name == "plie" else (-32, 20)
        x, f = fit_leg(BASE, "R", knee_at, ankle_at,
                       [0, 40, OUT, 20, ank, toe])
        p = dict(BASE)
        leg(p, "R", hip=x[0], knee=x[1], out=x[2], track=x[3], ankle=x[4],
            toe=x[5])
        g = fk(p, ("legLR", "footR"))
        print("    %-10s hip=%.0f knee=%.0f out=%.0f track=%.0f ankle=%.0f "
              "toe=%.0f   knee(%+.2f %+.2f %+.2f) ankle(%+.2f %+.2f %+.2f) "
              "err %.4f"
              % (name, x[0], x[1], x[2], x[3], x[4], x[5],
                 g["legLR"].x, g["legLR"].y, g["legLR"].z,
                 g["footR"].x, g["footR"].y, g["footR"].z, f))


ORDER = ("spine01", "spine02", "spine03", "chest", "neck", "head",
         "clavicleL", "clavicleR",
         "armUL", "armLL", "handL", "armUR", "armLR", "handR",
         "legUL", "legLL", "footL", "toeL", "legUR", "legLR", "footR", "toeR")


def dump():
    """Print the finished poses as human_mh.py source.

    So that what ships is exactly what was rendered here, rather than a set of
    numbers retyped from a screenshot of a set of numbers.
    """
    for name, p in POSES + POSES2:
        print("BAL_%s = dict(IDLE_A, **{" % name.upper())
        for b in ORDER:
            v = p.get(b)
            if v is None:
                continue
            print('    "%s": (%.1f, %.1f, %.1f),' % (b, v[0], v[1], v[2]))
        print("})")
        print("")


# Where the ladder's handrail is, in her frame, once she has stood herself
# beside it. 0.93 m off the deck and 0.24 out to her left — which is CLOSE, and
# it has to be: the rail is 0.90 m and her shoulder is 1.40 with a 0.48 m arm,
# so a hand on this barre is an arm hanging nearly straight. A dance studio's
# barre is 1.05; a swim ladder is not a dance studio, and the pose has to admit
# that or the hand floats.
RAIL = (0.05, 0.32, 0.930)


def barre():
    """Fit the left arm, per key, so the hand stays ON the rail.

    Her hips drop about 30 mm in the plie and her whole body rises 65 mm on the
    releve, and `@root` carries both — so one arm pose held across the three
    keys puts her hand through the rail at the bottom and 65 mm over it at the
    top, which is the one error that would make the barre read as a prop she is
    ignoring. The rail does not move; the target in POSE space therefore moves
    by exactly minus the root, and that is all this does.
    """
    rig = bpy.data.objects["rig"]
    for name, p in [("BARRE", BASE)] + [(n.upper(), q) for n, q in POSES
                                        if n in ("plie", "releve", "pirou",
                                                 "developpe")]:
        base = dict(p)
        if name == "BARRE":
            base = dict(BASE)
            leg(base, "L", hip=-4, knee=3, out=40, track=4, ankle=-4, toe=2)
            leg(base, "R", hip=-4, knee=3, out=40, track=4, ankle=-4, toe=2)
            arm(base, "R", "bas")
        _who, low = H._lowest(rig, base)
        root = base.get("@root", (0, 0, 0))[2] + 0.004 - low
        tgt = (RAIL[0], RAIL[1], RAIL[2] - root)
        elb = (tgt[0] - 0.02, tgt[1] - 0.04, tgt[2] + 0.23)
        x, f = fit_arm(base, "L", tgt, elb,
                       [-6, 0, 26, -12, 0, 20, -4, 0, 8], bend=True)
        g = fk(fit_arm_apply(base, "L", x, bend=x[9]), ("handL",))
        print("    %-10s root %+.3f lean %.0f  armUL=(%.0f, %.0f, %.0f) "
              "armLL=(%.0f, %.0f, %.0f) handL=(%.0f, %.0f, %.0f)"
              "   -> hand(%+.3f %+.3f %+.3f) rail %+.3f err %.4f"
              % (name, root, x[9], x[0], x[1], x[2], x[3], x[4], x[5],
                 x[6], x[7], x[8], g["handL"].x, g["handL"].y,
                 g["handL"].z + root, RAIL[2], f))


def fit_arm_apply(base, side, v, bend=0.0):
    p = dict(base)
    sg = 1.0 if side == "L" else -1.0
    p["armU" + side] = (v[0], v[1] * sg, v[2] * sg)
    p["armL" + side] = (v[3], v[4] * sg, v[5] * sg)
    p["hand" + side] = (v[6], v[7] * sg, v[8] * sg)
    if bend:
        b = bend * sg
        for k, share in (("spine01", 0.30), ("spine02", 0.34),
                         ("spine03", 0.36)):
            r = p.get(k, (0.0, 0.0, 0.0))
            p[k] = (r[0], r[1], r[2] + b * share)
    return p


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--fit" in argv:
        fit(argv)
        return
    if "--dump" in argv:
        dump()
        return
    if "--barre" in argv:
        barre()
        return
    views = ("side", "front")
    if "--views" in argv:
        got = [n for n in argv[argv.index("--views") + 1:]
               if not n.startswith("-") and n in H.VIEWS]
        if got:
            views = tuple(got)
    only = None
    if "--only" in argv:
        only = [n.lower() for n in argv[argv.index("--only") + 1:]
                if not n.startswith("-")]

    rig = bpy.data.objects["rig"]
    H._lights()
    for name, p in POSES:
        if only and name not in only:
            continue
        report(rig, name, p)
        if "--norender" not in argv:
            H.render("bal_" + name, views)
    H.pose(rig, {})


main()
