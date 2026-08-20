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
    smooth(body, 1)                      # Catmull-Clark, and more on the head
    rig            = armature(J)
    skin(body, rig)                      # weights
    paint(body, cutters(J))              # eyes, brows, lashes, hair
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

── size ──────────────────────────────────────────────────────────────────────

Baye ships at 28 085 triangles because she is looked at from thirty
centimetres. These are looked at from three to forty metres and there are eight
of them, so they are decimated to a quarter of that. Eight of these cost less
than the twenty-four instanced box-people they replace, and each one is a
different person rather than a repaint of the same two meshes.
"""

from __future__ import annotations

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
    "woman_young_slim": ("two", (0.92, 0.90, 0.86), (0.83, 0.68, 0.58)),
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


def _band(name, suit, z, rz, halfY, deep, n=7):
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
    """
    out = []
    step = (2.0 * halfY) / (n - 1)
    for i in range(n):
        y = -halfY + i * step
        out.append(_coat("%s-%d" % (name, i), MH.SUIT_M, suit, 6,
                         (0.0, y, z), (deep, step * 0.85, rz),
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
    if kind == "trunks":
        top, bot = hip + 0.02 * k, leg - 0.17 * k
    else:
        top, bot = hip + 0.035 * k, leg - 0.025 * k
    out += _band("suit-hip", suit, (top + bot) / 2, (top - bot) / 2,
                 hipY, deep)
    if kind == "two":
        # The band, at the bust. `spine-1` lands within a centimetre of nipple
        # height on all four of the women, which is the usual 72 to 75 per cent
        # of stature — so it is used directly rather than as a fraction. Kept
        # inboard of the shoulder joint, which is where the arm starts.
        out += _band("suit-band", suit, J["spine-1"].z + 0.005 * k, 0.048 * k,
                     J["l-shoulder"].y * 0.80, deep)
    return out

# What a person on a beach does. Baye carries twenty-four clips because she is
# the one you follow; these carry six, and the six are shared by all eight
# because a clip is a list of *rotations* and rotations transfer across
# skeletons of different proportions. The girl's walk is the man's walk on the
# girl's legs, which is right — a gait is a gait.
BATHER_CLIPS = [c for c in MH.CLIPS
                if c["name"] in ("idle", "walk", "wave", "notice",
                                 "kneel", "getup")]


def one(name, height, obj):
    """Bake one figure, start to finish, in a fresh scene."""
    kind, suit, skin_p = SUITS[name]
    # Both are module globals in human_mh, and both are read at the moment they
    # matter rather than captured: TARGET_H inside `read_joints`, SKIN_P inside
    # `load`, where it becomes the `baseP` attribute that `paint` later resets
    # to. Assigning to them is ugly and is still better than forking two
    # functions to take an argument each.
    MH.TARGET_H = height
    MH.SKIN_P = skin_p
    J, scale, drop = MH.read_joints(obj)
    body = MH.load(obj, scale, drop)
    MH.smooth(body, 1)
    rig = MH.armature(J)
    MH.skin(body, rig)
    MH.paint(body, MH.cutters(J) + swimwear(J, kind, suit, height))
    out = OUT / ("bather_%s.fr3d.gz" % name)
    # `post=False`, and that is the difference between eight bathers and eight
    # copies of Baye. The lay-on pass adds her nails, her bracelet and her hip
    # wrap — 1 232 triangles of striped sarong — and passing `J=None` does not
    # decline it, it makes the pass go and fetch *her* joints and hang the wrap
    # off those. The first bake put that on a 1.24 m girl and on a 1.71 m old
    # man, identically. Swimwear belongs in paint here, which is the convention
    # tools/blender/bather.py already set and the only one that lets a suit be a
    # different colour on every figure.
    MH.export_skin(body, rig, out, BATHER_CLIPS, tris=TRIS, post=False)
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = argv[argv.index("--only") + 1] if "--only" in argv else None
    OUT.mkdir(parents=True, exist_ok=True)
    for name, height, _recipe in mh_morph.BATHERS:
        if only and name != only:
            continue
        obj = BODIES / ("mh_%s.obj" % name)
        if not obj.exists():
            print("[bathers] no %s — run tools/blender/mh_morph.py first" % obj)
            continue
        print("[bathers] %s at %.2f m" % (name, height))
        p = one(name, height, obj)
        print("[bathers]   %s  %.0f KB" % (p.name, p.stat().st_size / 1024))


if __name__ == "__main__":
    main()
