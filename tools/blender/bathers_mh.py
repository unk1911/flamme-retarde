"""The eight Jadrija bathers, from the MakeHuman base mesh.

    tools/blender/blender.sh -b -P tools/blender/bathers_mh.py
    tools/blender/blender.sh -b -P tools/blender/bathers_mh.py -- --only girl_child
    tools/blender/blender.sh -b -P tools/blender/bathers_mh.py -- --preview

Writes build/payload/bather_<name>.fr3d.gz, one per figure.

── why this is thirty lines of glue and not a pipeline ────────────────────────

Because human_mh.py already is the pipeline, and every step of it takes the OBJ
by *path*:

    J, scale, drop = read_joints(path)   # skeleton, from joint-* marker cubes
    body           = load(path, ...)     # import, drop the proxies, transform
    smooth(body, 1, above=...)           # Catmull-Clark, and more on the head
    rig            = armature(J)
    skin(body, rig)                      # weights
    paint(body, cutters(J, k=...))       # eyes, brows, lashes, hair
    export_skin(body, rig, out, clips)

Hand it a *different* OBJ and every one of those adapts. That is the whole
trick, and it turns on one property of the base mesh: the joint markers are
themselves vertices of it. Morph the body and the skeleton moves with it, so a
1.24 m girl gets a 1.24 m girl's skeleton — the right clavicle spacing, the
right leg length, the right head — without anybody writing a second rig or
retargeting anything. tools/blender/mh_morph.py writes those OBJs.

── heights ───────────────────────────────────────────────────────────────────

`read_joints` normalises whatever it is given to `TARGET_H`, which is correct
for one canonical figure and wrong for a beach. So TARGET_H is set per figure
here. It is a module global rather than an argument; assigning to it is ugly
and is still better than forking the function.

── faces ─────────────────────────────────────────────────────────────────────

A skeleton adapts to a different body by itself. A *face* does not, and the
first eight of these shipped with black heads because of it: every cutter in
`cutters` is a number in metres measured on Baye's skull, and Baye's hair cap
sits four centimetres in front of a 1.24 m girl's — far enough forward that the
ellipsoid contains her whole head instead of the top of it. Her face came back
the colour of hair.

The fix is `human_mh.vault`, which measures the braincase of whatever figure it
is handed, and the head frame it feeds `cutters`. That is a scale and not a
retarget: nobody has to place eight sets of eyebrows. See SKULL in human_mh.py
for why the frame is anchored on the eye and why the scales are not stature.

── size ──────────────────────────────────────────────────────────────────────

Baye ships at 28 085 triangles because she is looked at from thirty
centimetres. These are looked at from three to forty metres and there are eight
of them, so they are decimated to a quarter of that. Eight of these cost less
than the twenty-four instanced box-people they replace, and each one is a
different person rather than a repaint of the same two meshes.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # type: ignore  # noqa: E402
from mathutils import Vector  # type: ignore  # noqa: E402
from mathutils.bvhtree import BVHTree  # type: ignore  # noqa: E402

import human_mh as MH  # noqa: E402
import mh_morph  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BODIES = ROOT / "build" / "mh_bodies"
OUT = ROOT / "build" / "payload"

# Roughly a quarter of Baye's budget. See the note on size above.
TRIS = 7000

# ── skin and swimwear ──────────────────────────────────────────────────────── #
#
# Both are per figure and both are baked in, because each of these is its own
# blob: there is no runtime palette to ask, and no need for one. Eight payloads
# is eight chances to be a different person.
#
# `kind` is what they have on. Women and the girl get briefs and a band, which
# reads as a two-piece from ten metres and does not need to be modelled to read
# as one; the men and the boy get trunks, which run further down the thigh. The
# suit is *painted*, not built, which is the convention tools/blender/bather.py
# set for the crowd it replaces — geometry that thin is a waste of triangles on
# a figure this size and a rigging problem on any figure at all.
SUITS = {
    "girl_child":       ("two", (0.86, 0.31, 0.42), (0.80, 0.64, 0.53)),
    "boy_child":        ("trunks", (0.16, 0.36, 0.62), (0.72, 0.56, 0.42)),
    # Red, and it started out near-white. A near-white suit on light skin is not
    # a pale suit at distance, it is no suit: rendered under the same sun the
    # two colours land within a few units of each other and she reads as bathing
    # with nothing on. Every other suit here is either dark or saturated, which
    # is why this was the only one it happened to.
    #
    # Black was the obvious replacement and is the wrong one, which is worth a
    # line because it is the same lesson the hip band already learned. Painted
    # colour arrives with a gradient several centimetres wide — the decimator
    # averages the vertices it merges — and how visible that gradient is scales
    # with the *contrast* across it. Pink on light skin hides it. Black on light
    # skin is 200 units of it, and what you get is not a black bikini, it is a
    # smudge shaped roughly like one.
    "woman_young_slim": ("two", (0.78, 0.16, 0.18), (0.83, 0.68, 0.58)),
    "woman_young_full": ("two", (0.88, 0.62, 0.14), (0.42, 0.29, 0.22)),
    "man_young_fit":    ("trunks", (0.11, 0.16, 0.28), (0.74, 0.56, 0.44)),
    "man_young_lean":   ("trunks", (0.18, 0.42, 0.36), (0.76, 0.62, 0.47)),
    "man_old_heavy":    ("trunks", (0.24, 0.26, 0.30), (0.72, 0.55, 0.44)),
    "woman_old":        ("two", (0.30, 0.34, 0.52), (0.78, 0.63, 0.53)),
}


def _coat(name, mark, prev, prio, c, r, rows=12, seg=20):
    """One paint volume, in the shape `cutters(J)` hands to `paint`.

    Same discipline as the cutters in human_mh.py and worth restating, because
    getting it wrong here looks like a bug in the morph rather than in the
    paint: a cutter is a *punch*, not a garment. It runs deep and crosses the
    surface steeply, and it is tight only in the directions that draw the
    shape. A hip band is therefore an ellipsoid half a metre across in x and y
    and four centimetres tall in z — nearly a cylinder where it meets the body,
    which is what makes its edges straight. Sized to look like a pair of trunks
    it would lie tangent to the hip and come back with a fuzzy halo.
    """
    vs, fs = MH.ball(c[0], c[1], c[2], r[0], r[1], r[2], rows, seg)
    lo = Vector((min(v[a] for v in vs) for a in range(3)))
    hi = Vector((max(v[a] for v in vs) for a in range(3)))
    return (BVHTree.FromPolygons([tuple(v) for v in vs], fs,
                                 all_triangles=False),
            mark, prev, prio, lo, hi, name)


def _band(name, suit, z, rz, halfY, deep, n=9):
    """A belt of constant height, as a row of overlapping punches.

    Not one ellipsoid. An ellipsoid tight in z and as wide as the torso in y is
    a *lens*: its vertical extent goes to zero at the ends, so the band it
    paints is full height down the middle of the chest and tapers to nothing at
    the flank. That is what the first two versions of this looked like, and it
    read as a yellow smudge rather than as a garment — which was blamed on the
    decimator, wrongly, and survived a doubling of the triangle budget without
    changing at all.

    Widening y instead does not work either, because the next thing out there
    is an arm. So the belt is built as a row of punches spaced across the
    torso, each narrow enough in y to keep its full height and overlapping its
    neighbours. Their union has straight edges. They are separate coats and may
    overlap freely: `_inside` is a parity test per volume, and `paint` only
    ever overwrites.

    How much they overlap is the whole of the tuning, and the first version had
    it wrong in both directions at once. Each punch was as wide as the gap to
    its neighbour, so halfway between two centres the union was down to 81 per
    cent of its height — a scalloped edge, seven times across a chest — and the
    outermost punch was centred *on* `halfY` and so reached a full radius past
    it, into the arm.

    Both come out of the same arithmetic. `ry` is 2.5 times the spacing, which
    puts the dip between neighbours at 96 per cent instead of 81; and the
    centres are inset by `ry`, so the row's outer edge lands exactly on `halfY`
    and the caller's measurement means what it says.
    """
    out = []
    ry = 2.5 * halfY / (n - 1)
    span = max(0.0, halfY - ry)
    step = (2.0 * span) / (n - 1)
    for i in range(n):
        y = -span + i * step
        out.append(_coat("%s-%d" % (name, i), MH.SUIT_M, suit, 6,
                         (0.0, y, z), (deep, ry, rz),
                         rows=12, seg=24))
    return out


def swimwear(J, kind, suit, h):
    """Briefs and a band, or trunks. Sized off the figure's own joints.

    Everything here is measured from `pelvis`, `l-upper-leg` and `spine-1`
    rather than written as a height, because the eight figures are 1.24 m to
    1.84 m and a waistband written in metres is a waistband on one of them.
    `k` only scales the thicknesses, which do not follow stature as steeply as
    the landmarks do.
    """
    k = h / 1.75
    hip = J["pelvis"].z
    leg = J["l-upper-leg"].z
    # Deep front-to-back, tight across.
    #
    # Only x has to be deep: that is the direction the punch crosses the chest
    # and the belly in, and depth there is what keeps the edge sharp. Making y
    # deep as well — 0.55 to a side, which was the first version — encloses the
    # arms, and a bikini band half a metre wide paints straight across both of
    # them. She came back with yellow shoulders.
    #
    # So y stops at the torso, and it is measured off the figure rather than
    # written down: the hip socket marker is about 55 per cent of the way out to
    # the skin at the widest, which holds across a 1.24 m girl and a heavy
    # 1.71 m man because it is the same anatomy scaled.
    deep = 0.5 * k
    hipY = J["l-upper-leg"].y * 1.85 + 0.02 * k
    out = []
    # ── and why a brief is 11 cm and not 7 ──────────────────────────────
    #
    # Because paint arrives with a gradient. The decimator averages the colours
    # of the vertices it collapses, which puts three or four centimetres of
    # fade on every edge — and a garment 7 cm tall with 4 cm of fade top and
    # bottom has no solid middle at all. It is gradient the whole way through,
    # which is precisely what it looked like: a red smear across the hips.
    #
    # Doubling the triangle budget does not fix it and was tried: 7 000 to
    # 14 000 changed nothing visible, because the fade is a fixed number of
    # *vertices* and the vertices got smaller along with it. What fixes it is
    # giving the garment a middle — so the brief runs from the natural waist to
    # the top of the thigh, which is 11 cm and is also what a brief is. The
    # trunks were never affected: they were 20 cm from the start.
    #
    # That reasoning was right about the gradient and wrong about where to fix
    # it, and it stayed wrong until 23 Aug: the fade is not a property of the
    # paint at all, it is the decimator averaging the colours of the vertices it
    # merges, and the answer is to paint the export copy after it has run rather
    # than to grow the garment until the fade is a smaller fraction of it. See
    # `repaint` at the bottom of `one`. 11 cm is kept because 11 cm is what a
    # brief is, which is the only reason it ever needed.
    if kind == "trunks":
        top, bot = hip + 0.02 * k, leg - 0.17 * k
    else:
        top, bot = hip + 0.055 * k, leg - 0.045 * k
    out += _band("suit-hip", suit, (top + bot) / 2, (top - bot) / 2,
                 hipY, deep)
    if kind == "two":
        # The band, at the bust. `spine-1` lands within a centimetre of nipple
        # height on all four of the women, which is the usual 72 to 75 per cent
        # of stature — so it is used directly rather than as a fraction. Kept
        # inboard of the shoulder joint, which is where the arm starts.
        out += _band("suit-band", suit, J["spine-1"].z + 0.005 * k, 0.062 * k,
                     J["l-shoulder"].y * 0.80, deep)
    return out

# ── standing about, re-tracked onto a different skeleton ───────────────────── #
#
# **This is no longer the correction. It is the difference between two of
# them.** When this was written, human_mh.py was off limits and `IDLE_A` still
# stood in the A-pose it was modelled in, so `_stand` was the whole fix and it
# was applied to a pose that carried none of it. That file is not off limits
# any more: `STAND_TRACK` and its five friends now live next to `IDLE_A` and
# every key that comes through `MH.CLIPS` arrives already corrected, for Baye's
# skeleton.
#
# Which is why this stayed rather than being deleted. Five of the six are
# absolute — a leg's Z, a foot's Y, an upper and a lower arm's Z — so setting
# them again is idempotent and simply re-solves them for a body that is not
# hers. The sixth is not: `STAND_ELBOW_UNDO` is ADDED to whatever X the pose
# authored, so applying it twice folds the elbow twice, and what goes on below
# is the *difference* between the two files' numbers. Delete that subtraction
# and every bather stands with 44° of undo on top of 40.
#
# The hip is the reason the rest of it is here at all. Baye's ankles cross at
# 14.8° of adduction; the 1.72 m woman's cross at 10.0 — measured again on both
# skeletons the same afternoon, and the note below guessed it was nearer 11.5.
# So Baye's eleven is a comfortable stance on Baye and 2.6 cm of ankles the
# wrong side of the crossing here. Five degrees of skeleton, and no amount of
# care in one file can know about it.
#
# ── what it was, and how the six were found ────────────────────────────────
#
# Reported from the promenade, 22 Aug: "at least some of the bathers still have
# that bear-pose, the A-pose, with spread legs and arms". It is the same fault
# the walk was fixed for that morning, in the clip the walk fix did not touch —
# and it is the same fault the walk's own note names, which is worth restating
# because it is the one thing about this pipeline that never stops being true:
# **the base mesh is an A-pose, and every clip is only ever the correction on
# top of it.** The rest thigh carries 6.5 degrees of abduction and the rest
# shin another 9.3, and `IDLE_A` corrects neither. Its arms it does correct —
# 29 degrees of adduction a side, put there for exactly this reason — and its
# legs it leaves entirely alone.
#
# Measured on the posed rig of the 1.72 m woman, before: **ankles 33.1 cm
# apart, knees 27.4, wrists 44.9, each hand 7 cm outboard of its own shoulder
# and 22 cm in front of it.** A person standing at ease has their ankles 10 to
# 15 cm apart and their hands hanging just outside their thighs. Thirty-three
# centimetres of ankle is not a stance, it is a shop dummy, and the hands out
# in front of the shoulders is the same "carrying a tray" the walk's elbow
# note describes.
#
# After: **ankles 10.9, knees 17.7, wrists 33.9, hands 1 cm outboard of the
# shoulder and 6 to 9 cm in front of it, elbows bent 14 to 16 degrees, soles
# within 3 degrees of flat.**
#
# Six numbers again, and they are not the walk's six copied over — the walk was
# solved for a limb in motion and these are for a limb that is still, and three
# of the six came out different when they were measured here.
#
# Why the leg pair is 6.5 and not the walk's 11: the walk's number was fitted to
# a *stride*, where the two legs are always half a cycle apart and the ankle
# separation is read at the footfall. Put 11 degrees on a figure standing with
# both feet down and the ankles cross: measured, 3.1 cm apart at 11 degrees and
# 8.7 at 13, because past the crossing the distance grows again. The curve has
# a minimum in it and reading a target off it without looking at both sides is
# how you land on the wrong side of it. (Re-measured on 22 Aug: that minimum is
# at 10.0 degrees on this skeleton, not the 11-and-a-bit implied here. 6.5
# stands; the guess about where the bottom of the curve sat did not.) 6.5 is on
# the near side and lands the ankles at 10.9 cm with the knees a comfortable
# 6 cm wider, which is the shape of a real stance: knees a little wider than
# ankles, both a little wider than nothing.
STAND_TRACK = 6.5
# The shin, doing the same job the walk's `WALK_SHANK` does and for the same
# reason: the base mesh's tibia flares outward and the knee's adduction is
# inherited, so this only has to take the last couple of degrees off.
STAND_SHANK = 2.0
# And the sole, which gives back the roll the two above cost. Eight and a half
# rather than the walk's thirteen, because the roll is what the hip and the
# knee added and this figure's hip and knee added less. Verified: 1.2 and 2.8
# degrees off flat, against 2.3 and 6.3 at five degrees and 4.7 at twelve.
STAND_SOLE = 8.5
# The shoulder. Twenty-nine was `IDLE_A`'s when this was written — the number
# that was put there when this exact complaint was made about the arms — and it
# left the wrists 6 cm outboard of where they want to be once the forearm was
# fixed. Thirty-three, and not the walk's thirty-four: a standing arm hangs a
# shade wider than a swinging one. `IDLE_A` now carries the same 33 for its own
# reasons, so this one is currently a no-op and is kept anyway: it is a
# different rig's answer that happens to agree, not the same answer.
STAND_ARM_IN = 33.0
# The forearm, and the one that reads worst when it is missing. `IDLE_A` has 4
# degrees of it, which is nothing: the rest forearm leaves the elbow pointing
# out as well as forward, so the hands bow out round the hips. Eighteen brings
# the wrists to 33.9 cm apart — just outside the thighs — and 1 cm outboard of
# the shoulders rather than 7.
STAND_FORE_IN = 18.0
# And the elbow, which is a straight loan from `_walk_elbow`'s hard-won note:
# on this bone a more negative X does not fold the elbow, it swings the hand
# further FORWARD, and the rest forearm is already 46 degrees bent
# forward-and-out. `IDLE_A` used to key -14 and -11 there, which added to the
# A-pose instead of undoing it and is why their hands sat 22 cm in front of
# their shoulders.
#
# It keys +30 and +33 now, because human_mh.py has already added its own
# `STAND_ELBOW_UNDO` of 44 — so what `_stand` applies is 40 minus 44, four
# degrees the other way, and the arithmetic lands on exactly the -14 + 40 it
# always did. Forty and not Baye's forty-four is measured and not stubborn:
# on these eight it comes out at 14 to 16 degrees of elbow with the wrist 6 to
# 9 cm forward of the shoulder, which is an arm hanging by a side, and
# forty-four takes another four degrees out of an elbow that has not got them.
STAND_ELBOW_UNDO = 40.0


def _stand(p):
    """One already-corrected standing pose, re-tracked onto this skeleton.

    Sagittal is left alone throughout — every X here is the pose's own, and the
    contrapposto, the breath and the head turn come through untouched. What is
    rewritten is only the six lateral numbers, so nothing in this can quietly
    change what the figure is *doing*, only how wide it does it.

    The five absolutes are set outright and are therefore idempotent. The
    elbow, which human_mh.py adds rather than sets, gets the difference between
    the two files' undo and nothing else — see the note above.
    """
    def leg(name, sign, track):
        a = p.get(name, (0, 0, 0))
        return (a[0], a[1], sign * track)

    q = dict(p)
    q["legUL"] = leg("legUL", 1, STAND_TRACK)
    q["legUR"] = leg("legUR", -1, STAND_TRACK)
    q["legLL"] = leg("legLL", 1, STAND_SHANK)
    q["legLR"] = leg("legLR", -1, STAND_SHANK)
    for nm, sign in (("footL", 1), ("footR", -1)):
        a = p.get(nm, (0, 0, 0))
        q[nm] = (a[0], sign * STAND_SOLE, a[2])
    for up, lo, sign in (("armUL", "armLL", 1), ("armUR", "armLR", -1)):
        a, b = p.get(up, (0, 0, 0)), p.get(lo, (0, 0, 0))
        q[up] = (a[0], a[1], sign * STAND_ARM_IN)
        q[lo] = (b[0] + STAND_ELBOW_UNDO - MH.STAND_ELBOW_UNDO,
                 b[1], sign * STAND_FORE_IN)
    return q


def _stand_clip(c, which=None):
    """The same, applied to the keys of a clip that are standing keys.

    `which` is a tuple of key indices, or None for all of them. The half-kneel
    clips need it: `kneel` starts on `IDLE_A` and `getup` ends on it, and the
    rest of both is a body on all fours whose leg angles are the pose and not
    the A-pose. Rewriting those the way a stance is rewritten puts six and a
    half degrees of adduction into a kneel, which is a different animal.
    """
    n = len(c["keys"])
    hit = set(range(n)) if which is None else {i % n for i in which}
    return dict(c, keys=[(t, _stand(p) if i in hit else p)
                         for i, (t, p) in enumerate(c["keys"])])


# ── sitting in a chair ─────────────────────────────────────────────────────── #
#
# Reported the same afternoon, of the café terraces: "why they look so weird,
# sitting backwards on those chairs in weird unnatural poses?" Three separate
# faults, and only the third one is this file's.
#
# They faced the wrong way — see `terraceSeats` in src/43-jadrija.js, which now
# hands the occupant the same heading it hands the chair. They sank into the
# paving, because they were drawn by the instanced tier whose one `sit` pose is
# authored for the edge of the quay: hips 14 cm above whatever they are placed
# on, legs hanging, which is right on a slab and half a metre wrong on a chair.
# And there was no seated clip in this bake at all, so the skinned tier could
# not have them: `BATHER_CLIPS` carried six and none of them was sitting down.
#
# So this is the seated clip, in three variants, because a café terrace with
# eight people all sitting identically is a waiting room.
#
# The chair. 0.46 is the top of the seat pad, read off `terraceSet` in
# src/43-jadrija.js rather than chosen here, and it is the whole reason any of
# the numbers below are solved rather than typed: a pose written as angles sits
# a 1.24 m girl and a 1.84 m man at two different heights, and only one of them
# can be on the seat.
SEAT = 0.46
# How far the hip joint rides above the seat it is on. Measured off the rig
# rather than guessed would be better; 7.5 cm is the flesh between the joint
# centre and the pad, and it holds close enough across all eight that the
# difference is below the pad's own thickness.
SEAT_HIP = 0.075
# What the solved legs are aimed at, in metres, on the posed rig.
#
# All three are separations between joint centres and all three are read back
# out after the solve and printed, so a figure the brackets could not satisfy
# says so in the log instead of shipping.
SIT_KNEES = 0.24          # knees a little apart: a person at a table, not a soldier
SIT_ANKLES = 0.26         # feet just outside the knees
SIT_FEET_FWD = 0.030      # and a touch in front of them, which is where feet rest
# How far the chair stands from the middle of its table. Must match `SEAT_R` in
# `seatRing`, src/43-jadrija.js — this is the only number in this file that is
# a fact about the furniture rather than about the body, and it is here because
# the elbows-on-the-table variant reaches for a table that is over there.
SEAT_R = 0.72
TABLE_TOP = 0.75          # `terraceSet` builds the top at y + 0.70 to y + 0.75
TABLE_HALF = 0.30         # and 0.60 m square
CHAIR_BACK = 0.86         # the top of the chair's back, same source


def _sit_base(hipx, hipy, kneex, kneey, extra=None):
    """The seated pose with its four solved leg numbers filled in.

    Everything above the pelvis is the caller's. The pelvis itself is NOT
    keyed by any of the three variants and that is deliberate: every leg hangs
    off it, so a torso lean written there would move the feet, and the solve
    below would have to run three times instead of once. A person leaning back
    in a café chair leans with their spine anyway.
    """
    p = {
        "@root": (0.0, 0.0, 0.0),
        "spine01": (0, 0, 0), "spine02": (0, 0, 0), "spine03": (-1, 0, 0),
        "chest": (-1.5, 0, 0), "neck": (2, 0, 0), "head": (-1, -3, 1),
        "legUL": (hipx, hipy, 0), "legLL": (kneex, kneey, 0),
        "footL": (0, STAND_SOLE * 0.4, 0),
        "legUR": (hipx, -hipy, 0), "legLR": (kneex, -kneey, 0),
        "footR": (0, -STAND_SOLE * 0.4, 0),
        "armUL": (-6, 0, STAND_ARM_IN), "armLL": (26, 0, STAND_FORE_IN),
        "armUR": (-4, 0, -STAND_ARM_IN), "armLR": (23, 0, -STAND_FORE_IN),
    }
    if extra:
        p.update(extra)
    return p


def _sit_solve(rig, ankle_rest, quiet=False):
    """Four leg angles and a hip drop, solved on this figure's own skeleton.

    Bisection and not arithmetic, four times over, because the chain these
    angles act on is not straight: the rest thigh is 6.5 degrees out and the
    rest shin another 9.3, the knee carries a bend before anything is keyed,
    and the pelvis is not level. Every closed form for this that was tried
    came out a centimetre or two wrong on one figure and five on another, and
    a centimetre is a foot through the paving.

    Two of the four interact — the thigh angle sets how high the ankle is and
    the knee angle sets how far forward it is, and each one moves the other's
    answer — so they are alternated rather than solved once. Four rounds is
    enough that the last one moves the ankle by under a millimetre.

    Returns (hipx, hipy, kneex, kneey, drop) with `drop` in metres: the amount
    `@root` has to come down to put the hip on the seat.
    """
    def at(hipx, hipy, kneex, kneey):
        MH.pose(rig, _sit_base(hipx, hipy, kneex, kneey))
        B = rig.pose.bones
        hip = B["legUL"].head
        return {
            "hipZ": hip.z,
            # Ankle relative to the hip, which is the frame the solve is in:
            # the hip is going on the seat whatever happens, so where the foot
            # lands is a difference and not a height.
            "dz": B["footL"].head.z - hip.z,
            "dx": B["footL"].head.x - B["legLL"].head.x,
            "knees": abs(B["legLL"].head.y - B["legLR"].head.y),
            "ankles": abs(B["footL"].head.y - B["footR"].head.y),
        }

    def solve(lo, hi, key, want, others):
        """Bisect one angle against one measurement.

        The direction is sampled rather than declared, and that is not
        fastidiousness: three of these four measurements FALL as their angle
        rises and one of them rises, the first cut of this had one of the four
        the wrong way round, and a bisection told the wrong sign does not fail
        — it walks quietly to the end of its bracket and reports a leg folded
        under the chair. Two extra poses buy the whole class of that mistake.

        A target outside the bracket saturates and says so, which is what the
        1.24 m girl does at every chair in this resort: her shins do not reach
        the paving and no thigh angle will make them.
        """
        a, bnd = at(*others(lo))[key], at(*others(hi))[key]
        for _ in range(18):
            mid = 0.5 * (lo + hi)
            v = at(*others(mid))[key]
            if (v < want) == (bnd > a):
                lo = mid
            else:
                hi = mid
        out = 0.5 * (lo + hi)
        if not (min(a, bnd) < want < max(a, bnd)) and not quiet:
            print("[bathers]   sit  %s wants %.3f, bracket holds %.3f..%.3f"
                  % (key, want, min(a, bnd), max(a, bnd)))
        return out

    # The soles want to land where they stand: `ankle_rest` is this figure's
    # own ankle height off the OBJ, so the pose is right for a 1.24 m girl and
    # a 1.84 m man without either of them being measured by hand.
    want_dz = ankle_rest - (SEAT + SEAT_HIP)
    hipx, hipy, kneex, kneey = -84.0, 0.0, 84.0, 0.0
    for _ in range(4):
        # The thigh, against how far below the hip the ankle hangs. The lower
        # bound is a thigh sloping fifteen degrees DOWN to the knee, which is
        # what a 1.58 m woman on a 46 cm chair actually does and what the first
        # bracket — stopping at 78 — would not let her: she came out with her
        # heels five centimetres off the paving.
        hipx = solve(-104.0, -68.0, "dz", want_dz,
                     lambda a: (a, hipy, kneex, kneey))
        # The shin, against how far in front of the knee the ankle is.
        kneex = solve(60.0, 105.0, "dx", SIT_FEET_FWD,
                      lambda a: (hipx, hipy, a, kneey))
        # And the two lateral ones, which do not interact with the first pair
        # at all — they swing the leg about axes the first pair does not use.
        hipy = solve(-14.0, 14.0, "knees", SIT_KNEES,
                     lambda a: (hipx, a, kneex, kneey))
        kneey = solve(-16.0, 16.0, "ankles", SIT_ANKLES,
                      lambda a: (hipx, hipy, kneex, a))
    v = at(hipx, hipy, kneex, kneey)
    # And the two children, whose shins do not reach and never will.
    #
    # The solve does the only thing it can with a target it cannot hit, which
    # is to run to the end of its bracket — and the end of the bracket is a
    # thigh raked steeply down, so the girl came out perched on the front lip
    # of the chair with her feet still 16 cm short of the ground. A child on an
    # adult chair does not perch. She sits back and lets her legs hang, which
    # is a LEVEL thigh and a shin straight down, so that is what she is given
    # the moment the floor is out of reach. Her feet dangle, which is the
    # truthful answer and is also the charming one.
    if v["dz"] > want_dz + 0.02:
        hipx = -88.0
        kneex = solve(60.0, 105.0, "dx", SIT_FEET_FWD,
                      lambda a: (hipx, hipy, a, kneey))
        v = at(hipx, hipy, kneex, kneey)
        if not quiet:
            print("[bathers]   sit  feet do not reach — hung level, %.0f mm up"
                  % ((v["dz"] - want_dz) * 1000))
    drop = v["hipZ"] - (SEAT + SEAT_HIP)
    if not quiet:
        print("[bathers]   sit  hip %.1f/%.1f knee %.1f/%.1f drop %.3f  "
              "-> knees %.3f ankles %.3f fwd %.3f sole %.3f (want %.3f)"
              % (hipx, hipy, kneex, kneey, drop, v["knees"], v["ankles"],
                 v["dx"], v["dz"] + SEAT + SEAT_HIP, ankle_rest))
    return hipx, hipy, kneex, kneey, drop


def _arm_solve(rig, base, side, want, drop, out=None, quiet=False):
    """The shoulder and elbow that put one wrist at `want` = (x, z), in metres.

    Solved and not typed, for the reason the legs are: the same pair of angles
    puts a 1.84 m man's hand on the table and a 1.24 m girl's hand in the air
    forty centimetres short of it, and two of the three hand positions here are
    facts about the FURNITURE — the top of the table, the edge of the seat —
    rather than about the body.

    Newton, and the first cut was two bisections alternated the way the legs
    are. That works on the legs because the four measurements there are very
    nearly independent — the thigh angle owns the height, the shin owns the
    reach — and it does not work here at all: swinging the shoulder moves the
    hand diagonally, so bisecting the height at a fixed elbow and then the reach
    at a fixed shoulder walks along two sides of a triangle and converges on a
    corner. Measured, it missed by 27 cm and put a hand through a rib.

    A two-by-two numeric Jacobian costs three poses an iteration and lands
    inside two millimetres in five. Out of reach it stops improving and the best
    pair seen is kept, which is the right failure: what comes out is an arm
    reaching, and the report prints how far short it fell.

    `out` is the shoulder's abduction, which is the third thing an arm has and
    is not solved — it is the difference between an arm hanging by a side and
    an arm slung out over the back of a chair, and it is a choice rather than a
    consequence. `drop` is the `@root` fall, added back because the target is in
    the room's metres and the rig is posed in its own.
    """
    up, lo = "armU" + side, "armL" + side
    sign = 1 if side == "L" else -1
    ab = STAND_ARM_IN if out is None else out
    wx, wz = want

    def at(a, b):
        p = dict(base)
        p[up] = (a, 0, sign * ab)
        p[lo] = (b, 0, sign * STAND_FORE_IN)
        MH.pose(rig, p)
        h = rig.pose.bones["hand" + side].head
        return h.x, h.z - drop

    def clamp(v, a, b):
        return max(a, min(b, v))

    # Two starts, because Newton finds a local answer and this surface has two
    # of them: the elbow can be folded to reach a near target or swung to reach
    # a far one, and which basin the iteration falls into is decided by where it
    # started. Measured, one start left four of the sixteen arms in this file
    # eight to twenty centimetres out and the other start fixed every one of
    # them, so both are run and the better is kept. Nine iterations apiece and
    # three poses an iteration is 54 poses for an arm, which is nothing next to
    # being wrong.
    h = 1.0
    best, berr = (-10.0, 20.0), 1e9
    for a0, b0 in ((-10.0, 20.0), (-45.0, 55.0)):
        a, b = a0, b0
        for _ in range(9):
            x, z = at(a, b)
            ex, ez = wx - x, wz - z
            err = math.hypot(ex, ez)
            if err < berr:
                best, berr = (a, b), err
            if err < 0.002:
                break
            xa, za = at(a + h, b)
            xb, zb = at(a, b + h)
            j = ((xa - x) / h, (xb - x) / h, (za - z) / h, (zb - z) / h)
            det = j[0] * j[3] - j[1] * j[2]
            if abs(det) < 1e-6:
                break
            a = clamp(a + clamp((ex * j[3] - j[1] * ez) / det, -30.0, 30.0),
                      -100.0, 75.0)
            b = clamp(b + clamp((j[0] * ez - ex * j[2]) / det, -30.0, 30.0),
                      -70.0, 90.0)
        if berr < 0.002:
            break
    a, b = best
    if not quiet and berr > 0.03:
        x, z = at(a, b)
        print("[bathers]   arm%s wanted %.3f/%.3f, reached %.3f/%.3f"
              % (side, wx, wz, x, z))
    return (a, 0, sign * ab), (b, 0, sign * STAND_FORE_IN)


def _hang(side, out, swing, elbow):
    """An arm that is not reaching for anything, in angles rather than a target.

    Not everything wants solving. A hand on a table is a fact about the table
    and has to be solved for on eight different bodies; an arm hanging beside a
    chair is a fact about the arm, and asking `_arm_solve` for it is asking a
    two-degree-of-freedom sagittal solve to hit a point 20 cm below where a
    short arm ends. What that produces is the solver's honest best — measured
    on the heavy 1.71 m man, 21 cm high and out in front of him — where the
    answer wanted was simply "let it hang".
    """
    sign = 1 if side == "L" else -1
    return {"armU" + side: (swing, 0, sign * out),
            "armL" + side: (elbow, 0, sign * STAND_FORE_IN)}


def sit_clips(rig, J):
    """The three seated clips, for this figure's own skeleton.

    Three and not one because the complaint was as much about sameness as about
    geometry, and three is what fits on a terrace: somebody sitting up with
    their hands on their knees, somebody sprawled back with an arm over the
    chair, and somebody with their elbows on the table talking to whoever is
    opposite. They share the solved legs — the same feet on the same paving —
    and differ from the ribs up.

    Each one breathes between two keys on a four-second loop. That is short
    enough that eight of them do not fall into step and long enough that
    nothing on the terrace looks like it is being wound.
    """
    hipx, hipy, kneex, kneey, drop = _sit_solve(rig, J["l-ankle"].z)

    def P(extra, dz=0.0):
        p = _sit_base(hipx, hipy, kneex, kneey, extra)
        p["@root"] = (0.0, 0.0, -(drop + dz))
        return p

    # Where the thigh runs, on this figure, with the legs already solved: the
    # hand-on-the-knee target is a fact about her own leg and not a height.
    MH.pose(rig, _sit_base(hipx, hipy, kneex, kneey))
    B = rig.pose.bones
    hipX, kneeX = B["legUL"].head.x, B["legLL"].head.x
    # A hand rests about four tenths of the way down the thigh, and not at the
    # knee: measured on the 1.58 m woman, the top of her own knee is 55 cm from
    # her shoulder and her whole arm is 55, so a hand on the knee is an arm at
    # full stretch. Which is a person bracing, not a person sitting.
    thighX = hipX + 0.42 * (kneeX - hipX)
    thighZ = SEAT + SEAT_HIP + 0.045               # on top of the thigh

    def arms(torso, targets):
        """One key's spine and head, with both arms solved on to `targets`."""
        p = _sit_base(hipx, hipy, kneex, kneey, torso)
        out = dict(torso)
        for side, want in targets.items():
            up, lo = _arm_solve(rig, p, side, want[:2], drop,
                                out=want[2] if len(want) > 2 else None)
            out["armU" + side], out["armL" + side] = up, lo
        return out

    # Upright: hands resting on the thighs, head come round a little. Note the
    # arms are solved against the torso of THIS key and not of the rest pose —
    # a shoulder that has leaned forward six degrees is six degrees of hand.
    up_t = {"spine01": (-1, 0, 1), "spine02": (-1, 0, 1), "chest": (-2, 0, 0),
            "head": (-2, -8, 1), "handL": (-8, 0, 0), "handR": (-8, 0, 0)}
    up_a = arms(up_t, {"L": (thighX, thighZ), "R": (thighX - 0.03, thighZ)})
    up_t2 = dict(up_t, **{"chest": (-4, 0, 0), "neck": (4, 0, 0),
                          "head": (-1, 6, -1), "spine03": (-3, 0, 0)})
    up_b = arms(up_t2, {"L": (thighX - 0.02, thighZ + 0.01),
                        "R": (thighX - 0.06, thighZ + 0.01)})

    # Sprawled back. The lean is in the spine and not in the pelvis, for the
    # reason `_sit_base` gives.
    #
    # The right arm hangs down outside the chair with the elbow out, which is
    # the second thing this variant was: it was an arm slung over the back of
    # the chair, and that is not a pose these two angles can make. An arm over a
    # chair back is mostly ABDUCTION and extension — the humerus goes out and
    # behind — and the solve only has the swing and the elbow, with the third
    # angle held at the 33 degrees of adduction a hanging arm wants. Asked for a
    # hand 24 cm behind the shoulder and 86 up, it did the only thing it could
    # and put the hand 15 cm in FRONT and 1.18 up, which is a woman signalling a
    # bus. Fourteen degrees of abduction and a hand down by the seat edge is a
    # sprawl the rig can actually make.
    back_t = {"spine01": (5, 0, 1), "spine02": (5, 0, 1), "spine03": (4, 0, 0),
              "chest": (3, 0, 0), "neck": (-4, 0, 0), "head": (-6, -14, 2),
              "clavicleR": (0, 0, -6), "handL": (-6, 0, 0), "handR": (-2, 0, 0)}
    back_a = arms(back_t, {"L": (thighX + 0.04, thighZ - 0.01)})
    back_a.update(_hang("R", 14.0, -2, 20))
    back_t2 = dict(back_t, **{"chest": (1, 0, 0), "neck": (-2, 0, 0),
                              "head": (-5, -6, 1)})
    back_b = arms(back_t2, {"L": (thighX + 0.01, thighZ)})
    back_b.update(_hang("R", 14.0, 1, 23))

    # Elbows on the table, and the head turned, because somebody with their
    # elbows on a café table is talking to somebody. The table's near edge is
    # `SEAT_R - TABLE_HALF` in front of the middle of the chair, so the hands go
    # a hand's breadth past that on to the top of it — not to the middle of the
    # table, which is 0.72 away and further than any of these eight can reach
    # sitting back. If a figure cannot make even this, `_arm_solve` says so and
    # what comes out is an arm reaching, which is the right failure.
    reach = SEAT_R - TABLE_HALF + 0.10
    tab_t = {"spine01": (-6, 0, 1), "spine02": (-6, -3, 1), "spine03": (-5, -3, 0),
             "chest": (-4, -4, 0), "neck": (3, 0, 0), "head": (-2, 22, 2),
             "clavicleL": (0, 0, 6), "clavicleR": (0, 0, -6),
             "handL": (-14, 0, 0), "handR": (-14, 0, 0)}
    tab_a = arms(tab_t, {"L": (reach, TABLE_TOP + 0.03, 24.0),
                         "R": (reach - 0.04, TABLE_TOP + 0.03, 24.0)})
    tab_t2 = dict(tab_t, **{"head": (-1, 14, 0), "chest": (-3, -3, 0)})
    tab_b = arms(tab_t2, {"L": (reach - 0.03, TABLE_TOP + 0.04, 24.0),
                          "R": (reach - 0.01, TABLE_TOP + 0.03, 24.0)})

    return [
        {"name": "sit", "loop": True,
         "keys": [(0.0, P(up_a)), (2.0, P(up_b, 0.004)), (4.0, P(up_a))]},
        {"name": "sitback", "loop": True,
         "keys": [(0.0, P(back_a)), (2.2, P(back_b, 0.005)), (4.4, P(back_a))]},
        {"name": "sittable", "loop": True,
         "keys": [(0.0, P(tab_a)), (1.9, P(tab_b, 0.003)), (3.8, P(tab_a))]},
    ]


# What a person on a beach does. Baye carries twenty-four clips because she is
# the one you follow; these carry nine, and the nine are shared by all eight
# because a clip is a list of *rotations* and rotations transfer across
# skeletons of different proportions. The girl's walk is the man's walk on the
# girl's legs, which is right — a gait is a gait.
#
# The three seated ones are the exception that proves it: they are the only
# clips in this file that are solved per figure rather than shared, because
# sitting is the one thing a person does against a piece of furniture whose
# height is fixed in metres. See `sit_clips`.
BATHER_CLIPS = [c for c in MH.CLIPS
                if c["name"] in ("idle", "walk", "wave", "notice",
                                 "kneel", "getup")]
# The walk was fixed on 22 Aug and its six numbers are `WALK_TRACK` and
# friends in human_mh.py. Everything else on this list is built on `IDLE_A`,
# which now carries `STAND_TRACK` and friends — Baye's numbers, on Baye's
# skeleton — so it gets `_stand` to re-track it onto this one.
#
# The value is which keys, because two of the five are not standing clips.
# `kneel` starts on `IDLE_A` and goes to all fours, `getup` comes back off them
# to it, and only those two keys are a stance; the ones in between are a body
# on the floor. Before the fix landed in human_mh.py those two keys carried the
# A-pose and were left alone here, which was wrong quietly. Left alone now they
# would carry Baye's eleven degrees, which on this skeleton is 2.6 cm of
# ankles the wrong side of the crossing — wrong loudly, and for a quarter of a
# second at the top of a clip you watch somebody start.
STAND_CLIPS = {"idle": None, "wave": None, "notice": None,
               "kneel": (0,), "getup": (-1,)}


def one(name, height, obj, check=False):
    """Bake one figure, start to finish, in a fresh scene.

    `check` stops after the skeleton and the leg solve and prints what came
    out, which is the whole of the seated geometry and costs three seconds
    instead of two minutes. Everything below the solve — the mesh, the smooth,
    the weights, the paint — has nothing to do with where the feet land.
    """
    kind, suit, skin_p = SUITS[name]
    # Both are module globals in human_mh, and both are read at the moment they
    # matter rather than captured: TARGET_H inside `read_joints`, SKIN_P inside
    # `load`, where it becomes the `baseP` attribute that `paint` later resets
    # to. Assigning to them is ugly and is still better than forking two
    # functions to take an argument each.
    MH.TARGET_H = height
    MH.SKIN_P = skin_p
    J, scale, drop = MH.read_joints(obj)
    # The head frame — see the note on faces above. Measured off this figure's
    # own braincase and divided by Baye's, so it is (1, 1, 1) for her and lands
    # between 0.72 and 1.12 on these eight. Heads are the part of a person that
    # varies least: the 1.24 m girl is 71 per cent of Baye's stature and 88 per
    # cent of her skull depth, which is exactly why scaling the face by height
    # would have been the wrong fix.
    if check:
        # `MH.load` is what normally empties the scene, and the check path does
        # not call it. Without this the second figure's armature is built next
        # to the first one's and `bpy.data.objects["rig"]` is still the first.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        rig = MH.armature(J)
        _sit_report(rig, sit_clips(rig, J))
        return None
    k = tuple(a / b for a, b in zip(MH.vault(obj, J["l-eye"].z), MH.SKULL))
    print("[bathers]   head frame  %.3f %.3f %.3f" % k)
    body = MH.load(obj, scale, drop)
    # `above` is the neck, not Baye's 1.46 — see `smooth`. The girl's whole head
    # is below 1.46 and got no extra density at all, which is a face painted at
    # the base mesh's 8 mm and the reason her eyes read as smudges.
    MH.smooth(body, 1, above=J["neck"].z)
    rig = MH.armature(J)
    MH.skin(body, rig)
    wear = swimwear(J, kind, suit, height)
    coats = MH.cutters(J, k=k, torso=False, tail=False) + wear
    MH.paint(body, coats)
    out = OUT / ("bather_%s.fr3d.gz" % name)
    # `post=False`, and that is the difference between eight bathers and eight
    # copies of Baye. The lay-on pass adds her nails, her bracelet and her hip
    # wrap — 1 232 triangles of striped sarong — and passing `J=None` does not
    # decline it, it makes the pass go and fetch *her* joints and hang the wrap
    # off those. The first bake put that on a 1.24 m girl and on a 1.71 m old
    # man, identically. Swimwear belongs in paint here, which is the convention
    # tools/blender/bather.py already set and the only one that lets a suit be a
    # different colour on every figure.
    clips = ([_stand_clip(c, STAND_CLIPS[c["name"]])
              if c["name"] in STAND_CLIPS else c
              for c in BATHER_CLIPS] + sit_clips(rig, J))
    _sit_report(rig, clips)
    # `repaint` and `dense`, which are the two halves of one answer.
    #
    # Baye is 28 085 triangles and these are 7 000, and that quarter is where
    # every paint complaint about them has come from. It cost the nape wedge,
    # which was a cutter for a ponytail nobody here has; it cost the brief two
    # rewrites; and it was still costing the suit, which arrived as red blotches
    # across the back and buttocks of the woman walking the promenade — 72 mm of
    # red inside 182 mm of pink and a streak of it 136 mm down her thigh, on a
    # brief drawn 110 mm tall.
    #
    # Neither the colour nor the volume was wrong. The mesh was: the decimator
    # averages the colours it merges and then interpolates what is left across
    # triangles half the height of the garment. So the export copy is painted
    # again after the decimator has run, and the decimator is told to leave the
    # hem alone before it runs — see the notes beside it and beside `hem_group`
    # in human_mh.py. It comes back 100 per cent solid, 107 mm tall, over 16 mm
    # triangles, and 1.8 KB *smaller*; the rig, the bone table and all nine
    # clips are bit-identical.
    MH.export_skin(body, rig, out, clips, tris=TRIS, post=False,
                   repaint=coats, dense=wear)
    return out


def _sit_report(rig, clips):
    """Every seated key, measured on the rig, in one block of numbers.

    The four solved angles are checked by the solve itself; this is the other
    half — the keys the solve does not touch. A hand that has gone through the
    table, a shoulder wound past its stop and a head turned into its own
    collarbone all look fine in the numbers above and wrong the moment anybody
    stands in front of them, and this is the cheap half of catching that: the
    hand's height and its reach in front of the shoulder, per key.

    Nothing here fails the bake. It prints, and the pass is done by looking.
    """
    for c in clips:
        if not c["name"].startswith("sit"):
            continue
        for i, (t, p) in enumerate(c["keys"][:-1]):
            MH.pose(rig, p)
            B = rig.pose.bones
            root = p.get("@root", (0, 0, 0))[2]
            print("[bathers]   %-9s k%d  hip %.3f  hand %.3f/%.3f  "
                  "reach %.3f  head %.3f"
                  % (c["name"], i, B["legUL"].head.z + root,
                     B["handL"].head.z + root, B["handR"].head.z + root,
                     B["handL"].head.x - B["armUL"].head.x,
                     B["head"].tail.z + root))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = argv[argv.index("--only") + 1] if "--only" in argv else None
    check = "--check" in argv
    OUT.mkdir(parents=True, exist_ok=True)
    for name, height, _recipe in mh_morph.BATHERS:
        if only and name != only:
            continue
        obj = BODIES / ("mh_%s.obj" % name)
        if not obj.exists():
            print("[bathers] no %s — run tools/blender/mh_morph.py first" % obj)
            continue
        print("[bathers] %s at %.2f m" % (name, height))
        p = one(name, height, obj, check=check)
        if p:
            print("[bathers]   %s  %.0f KB" % (p.name, p.stat().st_size / 1024))


if __name__ == "__main__":
    main()
