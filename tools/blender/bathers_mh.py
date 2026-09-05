"""The eight Jadrija bathers, from the MakeHuman base mesh.

    tools/blender/blender.sh -b -P tools/blender/bathers_mh.py
    tools/blender/blender.sh -b -P tools/blender/bathers_mh.py -- --only girl_child
    tools/blender/blender.sh -b -P tools/blender/bathers_mh.py -- \
        --only woman_young_slim --preview top hips whole --out /tmp/bathers

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

import bmesh  # type: ignore  # noqa: E402
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
# `kind` is what they have on. Women and the girl get a two-piece — a brief and
# a bikini top with straps; the men and the boy get square-cut trunks. Both are
# BUILT and not painted, which reverses what this file said for a year: that
# geometry that thin is a waste of triangles and a rigging problem. It is 900
# triangles of a 7 000 budget and the rigging is free, because a laid-on vertex
# can be skinned off the body under it. See the long note over `swimsuit`.
#
# The colours are also the ones `BATHER_PAINT` in src/42-crowd.js repaints the
# instanced stand-in with, so that nobody changes colour when you walk up to
# them. Change one here and change it there.
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


# ── the swimwear, which is geometry and it was paint ───────────────────────── #
#
# Reported 4 Sep 2026: *"the bathing suits on the bathers are kinda crappy
# looking... can u fix them to look like real bathing suits?"* — with a photo of
# the slim woman in what is unmistakably red tape rather than a bikini.
#
# It was two faults at once and only one of them was a shape.
#
# **A painted edge cannot be a hem.** The colour lives on the vertices, so the
# boundary of a garment is whatever polyline the mesh happens to offer, and on a
# 7 000-triangle figure that polyline is a sawtooth with 25 to 50 mm teeth —
# every triangle that straddles the hem is a red tongue reaching out on to the
# skin. Two releases were spent on this from the paint side. `repaint` took the
# ramp from 80 mm to one triangle and `dense` took that triangle from 50 mm to
# 16, and both are real improvements, and at 1.5 m it still reads as torn paper
# because a soft edge is not what a garment has. There is no third lever there:
# vertex colour cannot draw a line finer than the mesh under it.
#
# **And the shape was two tubes.** A row of ellipsoid punches at bust height and
# another at hip height paints a constant-height band all the way round, which
# is a bandeau over a boxer short and reads as neither. A brief has a rise and
# leg openings; a bikini top has cups, a gore between them, a narrow band round
# the back and straps over the shoulders. None of those is a ring.
#
# So the suit is now a surface, laid on after the decimator the way the nails
# and the hip wrap are, and skinned off the body vertices under it rather than
# pinned to a bone — which is what lets a strap cross a shoulder. About 900
# triangles a figure on a 7 000 budget, and the paint that used to stand in for
# it is gone along with the `dense` hem group that protected its edge, which
# hands that tenth of the budget back to the body.
#
# Everything below is measured off the figure rather than written in metres.
# There are 1.24 m and 1.84 m people here and a waistband written down is a
# waistband on one of them.

SWIM_GAP = 0.006          # how far the shell stands off the skin
SWIM_SEG = 40             # segments round the body
SWIM_ROWS = 5             # rows down a wrap, top edge to hem
SWIM_BINS = 48            # angular resolution of the body profile
STRAP_N = 16              # samples along a shoulder strap
TAU = math.pi * 2.0

# The arm, by bone. `_profile` takes the biggest radius it finds in each cell,
# and at bust height the biggest thing at 90 degrees is not the ribcage, it is
# the upper arm at 260 mm — which would put the back of the bikini out in mid
# air. human_mh's own `_profile` fends this off with an `rlim` that works at hip
# height and cannot work at bust height, where the arm is inboard of 300 mm on
# every one of the eight. The body is already skinned by the time this runs, so
# the honest test is which bone owns the vertex.
ARM_BONES = ("armUL", "armLL", "handL", "thumbL", "fingersL",
             "armUR", "armLR", "handR", "thumbR", "fingersR")


def _dang(a):
    """An angle wrapped to (-pi, pi]."""
    return (a + math.pi) % TAU - math.pi


def _skip(ob, names=ARM_BONES):
    """Vertex-group indices for the arm, so a measurement can leave it out."""
    return {g.index for g in ob.vertex_groups if g.name in names}


def _owned(v, gskip):
    """Is this vertex mostly owned by `gskip` — as a group, not one at a time?

    The SUM and not the dominant bone, which was the first version and let the
    whole hand through. The base mesh spends 9 400 of the 11 000 vertices at hip
    height on two hands, and every vertex near a knuckle splits its weight
    between `handL` and `fingersL` — neither of them over a half — so a test on
    the biggest single bone kept them all and put the wrap's axis 230 mm forward
    of a woman's spine.
    """
    if not gskip or not v.groups:
        return False
    return sum(e.weight for e in v.groups if e.group in gskip) > 0.5


def _axis(ob, z0, z1):
    """Where the body's own axis is, fore and aft, over a band of heights.

    SCARF_CX is 0.015 and is Baye's; on a heavy 1.71 m man the belly puts it
    somewhere else entirely, and a wrap built about the wrong axis stands off at
    the front and cuts in at the back.

    AND THE ARMS COME OUT FIRST. In the rest pose the hands hang beside the hips
    and the elbows are forward of the ribs, so the front-most vertex at waist
    height is a knuckle. Taken straight, this put the axis 120 mm in front of
    the slim woman instead of 33 — and a wrap about a point four inches out from
    the navel is the ballooned sheet the first render came back with.
    """
    gskip = _skip(ob)
    # And a belt round the midline on top of the bone test, because the two
    # answer different halves of the same question: the bones take out a hand
    # that is hanging in front of a hip, and `|y| < 0.05` takes out anything
    # else at all that is not the trunk. What is left between the two is a
    # sternum and a spine, or a pubis and a sacrum, which is the axis.
    xs = [v.co.x for v in ob.data.vertices
          if z0 <= v.co.z <= z1 and abs(v.co.y) < 0.05 and not _owned(v, gskip)]
    return 0.5 * (min(xs) + max(xs)) if xs else 0.0


def _bust(ob, cx, J):
    """The height of the bust apex, measured. Not `spine-1`.

    This file has said for a year that "`spine-1` lands within a centimetre of
    nipple height on all four of the women, which is the usual 72 to 75 per cent
    of stature". It does not. It is 77.5 per cent on the slim woman, 72.7 on the
    full-figured one and 73.5 on the old one, and the apex measured off the mesh
    is 74.7, 69.4 and 68.7 — so the band was drawn 48 to 68 mm too high on every
    one of them, which is why the thing in the photograph sits across a collar
    bone rather than on a bust.

    Measured as the height at which the chest reaches furthest FORWARD, in a
    window of `y` that is over the breast and inboard of the flank. The search
    starts a quarter of the way up from `spine-2` rather than at it, because on
    a flat-chested figure — the 1.24 m girl — there is no maximum to find and an
    unbounded search walks down to the bottom of the range and puts her top on
    her stomach.
    """
    s1, s2 = J["spine-1"].z, J["spine-2"].z
    z0, z1 = s2 + 0.25 * (s1 - s2), J["l-shoulder"].z
    rows = {}
    for v in ob.data.vertices:
        p = v.co
        if not (z0 - 0.012 <= p.z <= z1 + 0.012) or not (0.02 < abs(p.y) < 0.09):
            continue
        i = int((p.z - z0) / 0.012)
        rows[i] = max(rows.get(i, -9.9), p.x - cx)
    if not rows:
        return 0.5 * (s1 + s2)
    i = max(rows, key=lambda j: rows[j])
    return z0 + (i + 0.5) * 0.012


def _crotch(me, leg):
    """The lowest height at which the two legs are still one mass.

    Measured, because it is the anchor every hem below the waist is written
    against and it is not a fixed fraction of anything: it comes out 92 mm under
    the hip socket on the slim woman and 108 on the full-figured one. Scanning
    DOWN from the socket for the first four-millimetre slice with nothing on the
    midline in it — two empty slices in a row, so that a single missing row of
    vertices is not a crotch.
    """
    occ = {int(v.co.z / 0.004) for v in me.vertices
           if abs(v.co.y) < 0.015 and leg - 0.35 < v.co.z < leg + 0.02}
    b = int(leg / 0.004)
    while b > int((leg - 0.35) / 0.004):
        if b not in occ and (b - 1) not in occ:
            return (b + 1) * 0.004
        b -= 1
    return leg - 0.10


def _face_arm(ob, idx, gskip):
    """Is this polygon part of an arm? Used to shoot straight through one."""
    if not gskip or idx < 0 or idx >= len(ob.data.polygons):
        return False
    vs = ob.data.polygons[idx].vertices
    n = sum(1 for vi in vs if _owned(ob.data.vertices[vi], gskip))
    return n * 2 > len(vs)


def _profile(ob, tree, z0, z1, rows, bins, cx, skip=ARM_BONES):
    """The body's silhouette as a radius per (height, angle), by ray.

    THE HISTOGRAM THIS REPLACES IS WHY THE TRUNKS WERE A SKIRT, and it is worth
    the paragraph because the histogram is the obvious way to do it and is right
    almost everywhere. Binning every vertex by angle and keeping the biggest
    radius is exactly the surface, as long as the cross section is star-shaped
    about the axis — which a chest is, and a pair of hips is, and a pair of
    THIGHS is not. Below the crotch the section is two circles with a gap
    between them, and a ray at 45 degrees crosses the near thigh twice: the
    biggest radius in that bin is the far side of it. So the wrap was built
    around the outside of a leg it should have been lying on, standing a
    thigh's thickness off it, and that is the stiff little skirt every pair of
    trunks came back wearing.
    
    So: cast INWARD from half a metre out and take the first thing hit, which is
    the outermost surface along that direction and is exactly where cloth
    stretched round would touch. Where the ray finds nothing — straight up the
    midline between two legs — the cell is left empty for the fill below.

    The arms are shot through rather than binned out. A ray coming in at
    shoulder height meets an upper arm 80 mm before it meets a rib, and a
    bikini built on that would hang in mid air; walking the ray on past any face
    the arm owns lands it on the ribcage. Six hops is four more than a limb can
    cost and stops a grazing hit looping.
    """
    gskip = _skip(ob, skip)
    dz = (z1 - z0) / (rows - 1)
    tab = [[0.0] * bins for _ in range(rows)]
    far = 0.55
    for i in range(rows):
        z = z0 + i * dz
        for k in range(bins):
            a = TAU * k / bins
            d = Vector((-math.cos(a), -math.sin(a), 0.0))
            o = Vector((cx, 0.0, z)) - d * far
            left = far
            for _ in range(6):
                loc, _nv, idx, _dd = tree.ray_cast(o, d, left)
                if loc is None:
                    break
                if not _face_arm(ob, idx, gskip):
                    tab[i][k] = math.hypot(loc.x - cx, loc.y)
                    break
                step = (loc - o).length + 0.004
                o = o + d * step
                left -= step
                if left <= 0:
                    break
    # Empty cells filled round the ring, between the nearest neighbour each
    # way. There is only one place they happen and it is the one that matters:
    # straight up the midline below the crotch, where the ray goes between the
    # legs and out the far side. Interpolating round the ring bridges from the
    # cloth on one thigh to the cloth on the other, which is what a gusset is.
    for row in tab:
        have = [k for k in range(bins) if row[k] > 0]
        if not have:
            row[:] = [0.15] * bins
            continue
        for k in range(bins):
            if row[k] > 0:
                continue
            lo = max((j for j in have if j <= k), default=have[-1] - bins)
            hi = min((j for j in have if j >= k), default=have[0] + bins)
            span = hi - lo
            f = 0.0 if span == 0 else (k - lo) / span
            row[k] = row[lo % bins] * (1 - f) + row[hi % bins] * f
    # DILATE, THEN SMOOTH, and in that order. The table is sampled every 7.5
    # degrees and every 12 mm and `_at` reads it bilinearly, so the flat patch
    # between four samples cuts the corner of anything convex enough and ends up
    # inside it — both women with a full bust came back with the tip of each one
    # through the front of her cup. Taking each cell up to the largest of its
    # nine neighbours first is what a bilinear patch needs to stay outside a
    # curve its own samples sit on.
    #
    # And then smoothed, twice round the ring and twice down the rows, which are
    # not the same pass twice: a ray that grazes a fold — the underside of a
    # belly, the inside of a heavy thigh — lands a centimetre out from where its
    # neighbour a row up landed, and a surface built straight on that creases
    # and folds through itself. Smoothing round the ring cannot see that,
    # because the jump is between rows. The heavy man's trunks were a bag of
    # knots until the second pass went in.
    was = [row[:] for row in tab]
    for i in range(rows):
        for k in range(bins):
            tab[i][k] = max(was[r][(k + o) % bins]
                            for r in (max(i - 1, 0), i,
                                      min(i + 1, rows - 1))
                            for o in (-1, 0, 1))
    for row in tab:
        for _ in range(2):
            row[:] = [(row[(k - 1) % bins] + 2 * row[k] + row[(k + 1) % bins]) / 4
                      for k in range(bins)]
    for _ in range(2):
        was = [row[:] for row in tab]
        for i in range(rows):
            a, b, c = was[max(i - 1, 0)], was[i], was[min(i + 1, rows - 1)]
            tab[i][:] = [(a[k] + 2 * b[k] + c[k]) / 4 for k in range(bins)]
    return tab, z0, dz


def _at(prof, z, ang):
    """Bilinear lookup into `_profile`'s table, wrapping in angle."""
    tab, z0, dz = prof
    rows, bins = len(tab), len(tab[0])
    f = max(0.0, min(rows - 1.001, (z - z0) / dz))
    i0 = int(f)
    ti = f - i0
    g = (ang % TAU) / TAU * bins
    b0 = int(g) % bins
    tb = g - int(g)
    b1 = (b0 + 1) % bins
    lo = tab[i0][b0] * (1 - tb) + tab[i0][b1] * tb
    hi = tab[i0 + 1][b0] * (1 - tb) + tab[i0 + 1][b1] * tb
    return lo * (1 - ti) + hi * ti


def _wrap(prof, cx, top, bot, rows, seg, colour, out, gap=SWIM_GAP):
    """One garment surface: a ring round the body between two edge curves.

    `top(a)` and `bot(a)` are heights as functions of the angle round the body,
    and they are the whole of what makes a brief a brief and a pair of trunks a
    pair of trunks: the same eight lines of geometry draw both, and what differs
    is where the hem goes at the front and where it goes at the flank.

    Wound the way `hip_scarf` is wound and for the reason its note gives — `k`
    runs anticlockwise and `i` runs downwards, so the obvious order builds the
    surface inside out and a `FrontSide` material shows you the far half of it.

    Normals off the grid rather than radially. A hip wrap is near enough a
    cylinder for the radial shortcut; a bikini cup is not — its surface climbs
    130 mm of height over 40 mm of radius, and lit with a radial normal it reads
    as a decal rather than as cloth.
    """
    pos, nrm, col, tri = out
    base = len(pos)
    n = rows + 1
    grid = []
    for i in range(n):
        rv = i / rows
        row = []
        for kk in range(seg):
            a = TAU * kk / seg
            t, b = top(a), bot(a)
            z = t + (b - t) * rv
            # A shade more clearance at the hem than at the waist, the way the
            # hip wrap has it: a free edge that stands off reads as cloth, and
            # one that sinks in reads as a tear.
            r = _at(prof, z, a) + gap + 0.005 * rv
            row.append(Vector((cx + math.cos(a) * r, math.sin(a) * r, z)))
        grid.append(row)
    for i in range(n):
        for kk in range(seg):
            p = grid[i][kk]
            tk = grid[i][(kk + 1) % seg] - grid[i][(kk - 1) % seg]
            tv = grid[min(i + 1, n - 1)][kk] - grid[max(i - 1, 0)][kk]
            out_r = Vector((p.x - cx, p.y, 0.0))
            nv = tk.cross(tv)
            if nv.length < 1e-9:
                nv = out_r
            nv = nv.normalized()
            if nv.dot(out_r) < 0:
                nv = -nv
            pos.append(p)
            nrm.append(nv)
            col.append(colour)
    for i in range(rows):
        for kk in range(seg):
            k2 = (kk + 1) % seg
            a0 = base + i * seg + kk
            b0 = base + i * seg + k2
            c0 = base + (i + 1) * seg + kk
            d0 = base + (i + 1) * seg + k2
            tri.append((a0, c0, d0))
            tri.append((a0, d0, b0))
    return n * seg


def _spline(pts, t):
    """Catmull-Rom through `pts`, t in [0, 1]. Four control points or more."""
    n = len(pts) - 1
    f = max(0.0, min(n - 1e-9, t * n))
    i = int(f)
    u = f - i
    p0, p1 = pts[max(i - 1, 0)], pts[i]
    p2, p3 = pts[i + 1], pts[min(i + 2, n)]
    return 0.5 * (2 * p1 + (p2 - p0) * u
                  + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                  + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u)


def _strap(tree, origin, ctrl, width, colour, out, gap=SWIM_GAP,
           n=STRAP_N):
    """A ribbon over the shoulder, cast on to the skin from one interior point.

    Two versions of this went in the bin and the reason is worth keeping,
    because it is the same reason twice. A spline through five points measured
    on a shoulder lies UNDER it — a shoulder is convex — so the raw curve is
    inside the body. Snapping every sample to the nearest vertex fixes that and
    zigzags, because the vertices under a deltoid are 8 mm apart in no
    particular direction. Smoothing the zigzag out sinks it again, for the same
    convexity. Snap, smooth, snap still left the strap surfacing in pieces: a
    nearest-vertex query from a point inside a shoulder can answer with the arm,
    the neck or the trapezius, and which one it picks changes sample to sample.

    So the surface is found by a RAY and not by a search. `origin` is one point
    inside the chest, level with the armpit and a little over toward the strap's
    own side, and the whole path — up the front, over the shoulder, down the
    back — is star-shaped about it: every sample is a direction from that point,
    and where that direction leaves the body is where the strap goes. Rotating
    smoothly through the path gives a smoothly moving hit, and there is nothing
    left to snap or smooth.
    """
    pos, nrm, col, tri = out
    base = len(pos)
    line, norms = [], []
    for j in range(n):
        p = _spline(ctrl, j / (n - 1))
        d = p - origin
        far = d.length * 2.4
        loc, nv, _i, _dd = tree.ray_cast(origin, d.normalized(), far)
        if loc is not None:
            line.append(loc + nv * gap)
            norms.append(nv.copy())
        else:
            line.append(p)
            norms.append(d.normalized())
    # The two ends belong to the wrap and not to the ray: the wrap's own edge is
    # built on a max-radius profile and sits a millimetre or two proud of the
    # surface, and a strap that lands on the true skin instead leaves a step
    # exactly where it is supposed to be part of the same garment.
    line[0], line[-1] = ctrl[0], ctrl[-1]
    for j in range(n):
        along = line[min(j + 1, n - 1)] - line[max(j - 1, 0)]
        side = along.cross(norms[j])
        side = side.normalized() if side.length > 1e-9 else Vector((0, 1, 0))
        for sgn in (-1.0, 1.0):
            pos.append(line[j] + side * (sgn * width * 0.5))
            nrm.append(norms[j])
            col.append(colour)
    for j in range(n - 1):
        a0 = base + j * 2
        b0, c0, d0 = a0 + 1, a0 + 2, a0 + 3
        tri.append((a0, b0, d0))
        tri.append((a0, d0, c0))
    return n * 2


def swimsuit(J, ob, kind, suit, h, out):
    """The whole garment: a bottom half for everybody and a top for the women.

    Called by `export_skin` through its `wear` hook, with the undecimated mesh
    and the four laid-on buffers. Returns how many vertices it added.
    """
    me = ob.data
    # A tree off the MESH DATA, and not `ob.ray_cast`, which is the same
    # question asked of the *evaluated* object. By the time `export_skin` calls
    # this the rig has been through `wheel_floor` and eight clip bakes and is
    # standing in whatever pose the last of them left it in — so every ray would
    # have been cast at a woman doing a cartwheel, silently, and only in the
    # bake. The preview path never poses anything and would have gone on looking
    # correct. Mesh data is the bind shape whatever the armature is doing.
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    k = h / 1.75
    hip, leg = J["pelvis"].z, J["l-upper-leg"].z
    zc = _crotch(me, leg)
    # Its own axis for each garment. A chest and a pelvis are not on the same
    # fore-aft line on anybody and they are 40 mm apart on the heavy man.
    cx = _axis(ob, zc, hip + 0.08 * k)
    made = 0

    if kind == "trunks":
        # Square-cut trunks, and they are ONE surface rather than a waistband
        # with two legs hanging off it, which is a fact about where the hem goes
        # rather than a saving. Seen as a ring round the body, a pair of trunks
        # is scooped UP at the front and back centre — that is the crotch, and
        # there is no cloth between the legs below it — and hangs LOW at the two
        # flanks, which is the outer thigh. Nothing has to be split to say that.
        zw = hip + 0.020 * k
        mid, side = zc + 0.030, zc - 0.055 * k

        def btop(a):
            return zw - 0.008 * k * math.cos(a)

        def bbot(a):
            # 1.8 and not 1.3, and the scoop starts 30 mm ABOVE the crotch
            # rather than 12 below it. Both are about the same thing: a wrap
            # about the body's axis has to bridge the gap between the legs
            # wherever its hem is below the crotch, and that bridge is a web
            # with nothing under it. At 1.3 the hem was below the crotch from
            # 25 degrees out, so a third of the garment was web and it read as a
            # stiff little skirt. At 1.8 the drop is held back to the flanks,
            # where it is over a thigh and there is a leg inside it.
            return mid + (side - mid) * abs(math.sin(a)) ** 1.8
    else:
        # And a brief is the same ring with the scoop the other way up: deep at
        # the front and back, narrow over the hip bone, which is where the leg
        # opening cuts. 55 mm at the flank is what a bikini bottom actually is.
        zw = hip + 0.050 * k

        def btop(a):
            return zw - 0.012 * k * math.cos(a)

        def bbot(a):
            deep = zc + (0.020 if math.cos(a) >= 0 else 0.032)
            flank = btop(a) - 0.055 * k
            return flank + (deep - flank) * abs(math.cos(a)) ** 1.5

    lo = min(bbot(TAU * i / 64) for i in range(64)) - 0.02
    hi = max(btop(TAU * i / 64) for i in range(64)) + 0.02
    prof = _profile(ob, tree, lo, hi, 19, SWIM_BINS, cx)
    # Two millimetres more clearance below the waist than above it, and it is
    # not a taste: a belly overhangs a groin, so the profile's own axis is
    # dragged forward and the radius it reports at the fold is short of the
    # skin. On the heavy man that showed as a slit of him through the front of
    # his trunks. Eight millimetres of cloth off a hip is still a hip.
    made += _wrap(prof, cx, btop, bbot, SWIM_ROWS, SWIM_SEG, suit, out,
                  gap=0.008)
    print("[bathers]   bottom  waist %.3f  crotch %.3f  axis %.3f  z %.3f..%.3f"
          % (zw, zc, cx, lo + 0.02, hi - 0.02))

    if kind != "two":
        bm.free()
        return made

    # ── the top ────────────────────────────────────────────────────────────
    #
    # One ring again, and everything that makes it a bikini rather than a
    # bandeau is in the two edge curves: a cup either side of the front, a dip
    # between them for the gore, and a band that narrows and drops toward the
    # back. `spine-1` lands within a centimetre of the bust line on all four
    # women — the usual 72 to 75 per cent of stature — so it is used directly.
    tcx = _axis(ob, J["spine-2"].z, J["l-shoulder"].z)
    zb = _bust(ob, tcx, J)
    ac, wc, wg = math.radians(28.0), math.radians(19.0), math.radians(14.0)

    def cup(a):
        return min(1.0, math.exp(-(_dang(a - ac) / wc) ** 2)
                   + math.exp(-(_dang(a + ac) / wc) ** 2))

    def mid(a):
        # The ring's centre line, and it drops 30 mm on the way round to the
        # back — a bra band runs under the bust at the front and across the
        # ribs behind, and a level ring is the bandeau this replaces.
        return zb - 0.010 * k - 0.030 * k * (1.0 - math.cos(a)) * 0.5

    def ttop(a):
        return (mid(a) + 0.016 * k + 0.044 * k * cup(a)
                - 0.038 * k * math.exp(-(_dang(a) / wg) ** 2))

    def tbot(a):
        return mid(a) - 0.016 * k - 0.044 * k * cup(a)

    lo = min(tbot(TAU * i / 64) for i in range(64)) - 0.02
    hi = max(ttop(TAU * i / 64) for i in range(64)) + 0.02
    tprof = _profile(ob, tree, lo, hi, 15, SWIM_BINS, tcx)
    made += _wrap(tprof, tcx, ttop, tbot, SWIM_ROWS + 1, SWIM_SEG, suit, out)

    sy, sz = J["l-shoulder"].y, J["l-shoulder"].z
    cz = J["l-clavicle"].z
    rf, rb = _at(tprof, zb, 0.0), _at(tprof, zb, math.pi)
    ab = math.pi - math.radians(38.0)
    for sgn in (1.0, -1.0):
        a0, a4 = ac * sgn, ab * sgn
        r0 = _at(tprof, ttop(a0), a0) + SWIM_GAP
        r4 = _at(tprof, ttop(a4), a4) + SWIM_GAP
        # 0.58 of the way out to the shoulder joint and no further: a strap
        # further out than that snaps on to the deltoid, which belongs to the
        # arm, and a bikini strap that swings when she waves is worse than none.
        ctrl = [
            Vector((tcx + math.cos(a0) * r0, math.sin(a0) * r0, ttop(a0))),
            Vector((tcx + 0.60 * rf, 0.58 * sy * sgn, cz - 0.020 * k)),
            Vector((tcx, 0.58 * sy * sgn, sz + 0.045 * k)),
            Vector((tcx - 0.55 * rb, 0.54 * sy * sgn, cz - 0.055 * k)),
            Vector((tcx + math.cos(a4) * r4, math.sin(a4) * r4, ttop(a4))),
        ]
        made += _strap(tree, Vector((tcx, 0.34 * sy * sgn, zb + 0.030 * k)),
                       ctrl, 0.014 * k, suit, out)
    bm.free()
    print("[bathers]   top     bust %.3f (%.1f%%)  axis %.3f  cup %.3f..%.3f"
          "  band %.3f..%.3f"
          % (zb, 100 * zb / h, tcx, tbot(ac), ttop(ac),
             tbot(math.pi), ttop(math.pi)))
    return made


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
        # AN ARM THAT IS DOING SOMETHING IS LEFT DOING IT.
        #
        # This loop used to be unconditional, and it silently destroyed the
        # only clip on this beach that raises one. A lift is written in Z —
        # `WAVE_UP` is `armUR: (-16, 0, 96)` and the 96 IS the raise — and the
        # tuck this applies is `sign * STAND_ARM_IN`, so a ninety-six degree
        # lift came out of the bake as a thirty-three degree tuck, on every key
        # of the clip. The result loaded, reported itself as playing, ran its
        # clock from 0 to 2.5, and moved the wrist fifteen centimetres. The
        # same clip on the show figure, which does not come through here, lifts
        # it from 0.85 m to 1.54 m over the soles.
        #
        # The test is the SIGN and not the size. A standing arm is tucked
        # toward the body, which on this rig is `sign`; anything on the other
        # side of vertical is a pose that has decided to put the arm somewhere,
        # and there is no stance to re-track it to. `IDLE_A` and `NOTICE` are
        # +33 and +37 on the correct side and go through as before; `WAVE_UP`
        # and `WAVE_OUT` are +96 and +30 on the wrong one and are left alone.
        #
        # The gate is on the UPPER arm and it decides for the whole limb. A
        # forearm's own Z is 0 in `WAVE_UP` and would pass a test of its own,
        # and eighteen degrees of tuck on the forearm of a raised arm is a
        # second, quieter version of the same bug. Where the shoulder has been
        # placed deliberately, the elbow below it has been too.
        #
        # UNVERIFIED IN A BAKE. build/payload/bather_*.fr3d.gz is committed
        # rather than built and Blender was not run for this change, so the
        # eight blobs on disk still carry the flat wave. Nothing at runtime
        # waits for it: the greeting solves its own arm — see `greetArm` in
        # src/42-crowd.js, which says why. What this buys is that `wave` means
        # something again the next time these are baked.
        if a[2] * sign >= 0:
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
        _sit_report(rig, sit_clips(rig, J) + quay_clips(rig, J)
                    + lie_clips(rig, J))
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
    coats = MH.cutters(J, k=k, torso=False, tail=False)
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
              for c in BATHER_CLIPS] + sit_clips(rig, J)
             + quay_clips(rig, J) + lie_clips(rig, J))
    _sit_report(rig, clips)
    # `repaint`, which is now about the FACE and no longer about the suit.
    #
    # The decimator interpolates every attribute it carries, colour included, so
    # a boundary that was one vertex wide before it runs arrives two or three
    # deep after it. Measured on these eight, that ramp is 25 to 80 mm on every
    # side of every painted edge, whatever the edge is — a property of the mesh
    # and not of the paint. Repainting the decimated copy collapses it to the
    # single triangle that straddles the boundary, which is what a soft edge
    # actually is, and it costs one more pass of the same ray-parity test.
    #
    # It used to be half of the swimsuit's answer and the other half was
    # `dense`, a vertex group that stopped the decimator collapsing the hem —
    # 80 mm of ramp down to one 16 mm triangle, for about a tenth of the
    # triangle budget. Both are gone from the suit, because the suit is geometry
    # now and a mesh edge needs no help from either; that tenth is back in the
    # body. What is left is the face, where the same ramp is the difference
    # between an eyebrow and a smudge, and where there is no garment to build.
    MH.export_skin(body, rig, out, clips, tris=TRIS, post=False,
                   repaint=coats,
                   wear=lambda me, buf: swimsuit(J, body, kind, suit,
                                                 height, buf))
    return out



# --------------------------------------------------------------------------- #
#  the two poses that had no clip                                              #
# --------------------------------------------------------------------------- #
#
# Reported 3 Sep, from the deck west of the kabine: *"there are still three
# wooden manequen looking bathers left over from old batch... can u remove
# those"*. They are not left over from anything. They are the instanced tier —
# eleven boxes and cylinders per figure, `tools/blender/bather.py` — and they
# were still drawing thirty-nine of this shore's eighty-four people because of
# one line in src/43-jadrija.js:
#
#     const blobbable = b.chair || (b.pose !== 'sit' && b.pose !== 'lie');
#
# A blob could not sit on the lip of the quay and could not lie on a towel,
# because there was no clip for either — so twenty-six quay sitters and eleven
# sunbathers were permanently ineligible for one of the twenty-four skinned
# slots. Which is worse than it sounds: the slots go to the nearest eligible
# people, so with the sitters ruled out the cast was being spent on figures
# 24 to 42 m away while two lay figures sat 2.6 m and 5.5 m from your face.
#
# So here are the two clips. Both are solved on each figure's own skeleton for
# the reason `sit_clips` is: a quay is a fact about the promenade in metres and
# these eight are 1.24 m to 1.84 m tall.

# How high the hip JOINT rides above whatever you are sitting on. `SEAT_HIP` is
# 7.5 cm for a chair, where the pad takes some of it; sitting straight on a
# concrete slab it is a little more, because what is between the joint and the
# stone is all of you.
QUAY_HIP = 0.105
# And lying on your back on a towel over a concrete deck, which is the same
# measurement taken through the other side of the pelvis — less what the
# placement already adds. `B(t, s - 0.55, y + 0.06, ...)` in 43-jadrija.js puts
# a sunbather's origin 60 mm over the deck because the instanced tier tips
# about the SOLES and leaves the body's midline on the origin, so 0.075 here is
# a hip joint 135 mm up, which is a person on their back on a towel.
TOWEL_HIP = 0.075


def _quay_solve(rig, quiet=False):
    """Thigh and shin angles for somebody sitting on the edge of a quay.

    Two bisections and no interaction between them, which is why this is ten
    lines against `_sit_solve`'s eighty: nothing here is standing on the
    ground. The thigh is level — the knee at the height of the hip — and the
    shin hangs — the ankle under the knee. Those are one angle each and neither
    moves the other's answer, because a leg over a quay touches nothing.

    Returns (hipx, kneex, drop), with `drop` the metres `@root` comes down to
    put the hip joint `QUAY_HIP` above the slab.
    """
    def at(hipx, kneex):
        MH.pose(rig, _quay_base(hipx, kneex))
        B = rig.pose.bones
        return B["legUL"].head, B["legLL"].head, B["footL"].head

    def bisect(lo, hi, f):
        a = f(lo)
        for _ in range(20):
            mid = 0.5 * (lo + hi)
            v = f(mid)
            if (v < 0) == (a < 0):
                lo, a = mid, v
            else:
                hi = mid
        return 0.5 * (lo + hi)

    # Thigh level: the knee at the hip's height. Negative X is hip flexion —
    # +X swings a limb's far end backward on every bone in this rig — so the
    # bracket runs from the leg hanging to well past horizontal.
    hipx = bisect(-120.0, 0.0, lambda a: at(a, 80.0)[1].z - at(a, 80.0)[0].z)
    # Shin vertical: the ankle under the knee. The knee's own bend is positive,
    # the same direction a plie folds it.
    kneex = bisect(0.0, 130.0, lambda b: at(hipx, b)[2].x - at(hipx, b)[1].x)
    hip, knee, ankle = at(hipx, kneex)
    drop = hip.z - QUAY_HIP
    if not quiet:
        print("[bathers]   quay: hip %+.1f knee %+.1f  thigh %+.3f m  "
              "shin %+.3f m  drop %.3f" % (hipx, kneex, knee.z - hip.z,
                                           ankle.x - knee.x, drop))
    return hipx, kneex, drop


def _quay_base(hipx, kneex, extra=None):
    """The quay-sitting pose with its two solved leg numbers filled in.

    The knees come apart by a few degrees and the shins with them, which is the
    difference between two people sitting on a wall and a pair of dividers.
    """
    p = {
        "@root": (0.0, 0.0, 0.0),
        "spine01": (2, 0, 0), "spine02": (2, 0, 0), "spine03": (1, 0, 0),
        "chest": (1, 0, 0), "neck": (-2, 0, 0), "head": (-2, 6, 0),
        "legUL": (hipx, -4, 0), "legLL": (kneex, 0, 0),
        "footL": (10, 0, 0),
        "legUR": (hipx, 4, 0), "legLR": (kneex, 0, 0),
        "footR": (12, 0, 0),
        "armUL": (-6, 0, STAND_ARM_IN), "armLL": (26, 0, STAND_FORE_IN),
        "armUR": (-4, 0, -STAND_ARM_IN), "armLR": (23, 0, -STAND_FORE_IN),
    }
    if extra:
        p.update(extra)
    return p


def quay_clips(rig, J):
    """`sitquay`: on the lip of the promenade with the legs over the water.

    The one pose on this shore that a player walks right past at arm's length,
    forty-odd times, because the whole seaward edge of the deck is people
    sitting on it.

    HANDS ON THE THIGHS, and not on the slab, and that is measured rather than
    chosen. The first cut put both palms flat on the stone behind her hips,
    which is what everybody does — and `_arm_solve` came back nine centimetres
    short on every one of the eight. It is not the solver: sitting on a slab
    puts this rig's shoulder about 0.55 m above it and its whole arm, shoulder
    to wrist, is 0.55. Her hand cannot reach the ground beside her without a
    lean far enough back to read as sunbathing on a wall. So the weight goes
    where it can: half way down the thigh, which is where the other hand of
    every person sitting on that quay is anyway.

    The loop is the legs. Nothing else on a quay moves much — a shin swinging
    through six degrees and a head coming round is the whole of it — and the
    two legs are given different periods so that a row of them does not kick in
    time, which is the failure the instanced tier's `sit` case names as well.
    """
    hipx, kneex, drop = _quay_solve(rig)

    def P(extra, dz=0.0):
        p = _quay_base(hipx, kneex, extra)
        p["@root"] = (0.0, 0.0, -(drop + dz))
        return p

    def arms(torso, targets):
        p = _quay_base(hipx, kneex, torso)
        out = dict(torso)
        for side, want in targets.items():
            up, lo = _arm_solve(rig, p, side, want[:2], drop,
                                out=want[2] if len(want) > 2 else None)
            out["armU" + side], out["armL" + side] = up, lo
        return out

    # Where her own thigh runs, on this figure, with the legs already solved —
    # the same measurement `sit_clips` takes for the terrace, and the same
    # reason it is taken rather than typed: a hand resting on a leg is a fact
    # about that leg.
    MH.pose(rig, _quay_base(hipx, kneex))
    B = rig.pose.bones
    hipX, kneeX, thighZ = (B["legUL"].head.x, B["legLL"].head.x,
                           B["legUL"].head.z)
    HAND = (hipX + 0.46 * (kneeX - hipX), thighZ + 0.055 - drop, 26.0)
    HAND_B = (HAND[0] - 0.025, HAND[1] + 0.008, 24.0)

    a_t = {"spine01": (5, 0, 0), "spine02": (4, 0, 0), "spine03": (2, 0, 0),
           "chest": (2, 0, 0), "neck": (-3, 0, 0), "head": (-3, 14, 1),
           "legLL": (kneex - 5, 0, 0), "legLR": (kneex + 4, 0, 0),
           "handL": (-14, 0, 0), "handR": (-14, 0, 0)}
    a = arms(a_t, {"L": HAND, "R": (HAND[0] - 0.02,) + HAND[1:]})
    b_t = dict(a_t, **{"spine01": (7, 0, 0), "chest": (3, 0, 0),
                       "head": (-2, -6, -1),
                       "legLL": (kneex + 5, 0, 0), "legLR": (kneex - 4, 0, 0)})
    b = arms(b_t, {"L": HAND_B, "R": (HAND_B[0] - 0.02,) + HAND_B[1:]})
    c_t = dict(a_t, **{"head": (-4, 2, 0),
                       "legLL": (kneex + 2, 0, 0), "legLR": (kneex + 6, 0, 0)})
    c = arms(c_t, {"L": HAND, "R": (HAND[0] - 0.02,) + HAND[1:]})

    return [{"name": "sitquay", "loop": True,
             "keys": [(0.0, P(a)), (2.4, P(b, 0.004)), (4.6, P(c)),
                      (7.0, P(a))]}]


def lie_clips(rig, J):
    """`sunbathe`: flat on a towel, face up, propped a little on the elbows.

    ONE ROTATION AND NOT ELEVEN. `pelvis` is the root of this skeleton and its
    local X comes out as a clean pitch — the same property the somersault in
    human_mh.py leans on — so +90 there lays the whole figure over backwards in
    one number: the spine, which pointed up, ends up pointing along −x, and the
    legs, which pointed down, end up along +x. Everything below the pelvis
    comes with it because everything below the pelvis is below the pelvis.
    Authoring a recline joint by joint means re-deriving eleven of them for one
    pose, and it is also how you end up with a figure that is lying down in the
    hips and standing up in the ribs.

    Head at −x is deliberate and is not a choice made here: the instanced tier
    lays its sunbathers over the same way, and 43-jadrija.js aims them seaward
    so that the head comes out inland. A blob that lay the other way would spin
    end for end the moment it was promoted.

    After the roll, the body's own axes have moved and every angle below reads
    against the new ones. Her front (+x) is now the sky; her back (−x) is the
    towel. So a spine key that swings the chest 'backward' pushes it INTO the
    towel and the propped-up shoulders want the other sign — which is the one
    thing in this pose worth writing down, because it is the sign that is wrong
    if she looks like somebody who has passed out rather than somebody reading.
    """
    def base(extra=None):
        p = {
            "@root": (0.0, 0.0, 0.0),
            "pelvis": (90.0, 0.0, 0.0),
            # Propped. Negative lifts the chest off the towel: see the note.
            "spine01": (-7, 0, 0), "spine02": (-7, 0, 0), "spine03": (-6, 0, 0),
            "chest": (-4, 0, 0), "neck": (7, 0, 0), "head": (6, 0, 0),
            # Knees just off straight, and not the same on both sides.
            "legUL": (-5, -3, 0), "legLL": (7, 0, 0), "footL": (-14, 0, 0),
            "legUR": (-2, 3, 0), "legLR": (4, 0, 0), "footR": (-12, 0, 0),
            # Arms down beside her on the towel, elbows a little out so the
            # forearms lie on the stone rather than on her own hips.
            "armUL": (10, 0, 44), "armLL": (10, 0, 24), "handL": (0, 0, 8),
            "armUR": (9, 0, -42), "armLR": (9, 0, -22), "handR": (0, 0, -6),
        }
        if extra:
            p.update(extra)
        return p

    # Where the hip joint ends up once she is laid over, and how far she has to
    # come down to put it `TOWEL_HIP` above the deck. Measured rather than
    # assumed, because the roll happens about the hip and the hip does not move
    # — but `@root` is applied after the pose and the two have to agree.
    MH.pose(rig, {k: v for k, v in base().items() if not k.startswith("@")})
    hipz = rig.pose.bones["legUL"].head.z
    drop = hipz - TOWEL_HIP
    # AND ALONG, WHICH IS THE HALF THAT IS EASY TO MISS. The instanced tier
    # tips its sunbathers about the mesh ORIGIN, which is between their feet,
    # so the body runs from the anchor back along local −x and 43-jadrija.js
    # places them accordingly — "the anchor is the soles and `ang` points from
    # the head towards the feet", `B(t, s - 0.55, ...)`. This clip tips about
    # the pelvis instead, because the pelvis is the root of the skeleton and
    # one rotation there lays everything below it over. So the figure comes out
    # centred on the anchor rather than starting at it, 0.85 m adrift, and the
    # only person who would ever see it is somebody who walked up to a towel
    # and watched the sunbather on it slide half a body-length when she was
    # promoted. `@root` carries an x as well as a z; this is what it is for.
    ankle = rig.pose.bones["footL"].head.x
    def P(extra, dz=0.0):
        p = base(extra)
        p["@root"] = (-ankle, 0.0, -(drop + dz))
        return p

    # Breathing, a knee that falls out and comes back, and a head that turns
    # once in a while. Eight seconds, because a person on a towel is the
    # slowest thing on this beach and a four-second loop on one reads as a
    # twitch.
    a = {}
    b = {"chest": (-5, 0, 0), "spine03": (-7, 0, 0), "head": (6, -10, 0),
         "legUL": (-7, -6, 0), "legLL": (10, 0, 0)}
    c = {"head": (7, 8, 0), "legUR": (-4, 5, 0), "legLR": (7, 0, 0)}
    return [{"name": "sunbathe", "loop": True,
             "keys": [(0.0, P(a)), (2.7, P(b, 0.004)), (5.4, P(c, 0.002)),
                      (8.0, P(a))]}]


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
        if not (c["name"].startswith("sit") or c["name"] == "sunbathe"):
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


# Azimuth, elevation, the height to aim at as a FRACTION OF STATURE, and how
# far back to stand in metres on a 1.75 m figure. A fraction and not a height
# because there is a 1.24 m girl in this cast and a 1.84 m man, and one number
# aimed at a bust is aimed at a forehead on the other.
SWIM_VIEWS = {
    "top": (14.0, 6.0, 0.775, 0.85),
    "topside": (86.0, 4.0, 0.775, 0.85),
    "topback": (168.0, 6.0, 0.775, 0.85),
    "hips": (14.0, 6.0, 0.545, 0.85),
    "hipside": (86.0, 4.0, 0.545, 0.85),
    "hipback": (168.0, 6.0, 0.545, 0.85),
    "whole": (26.0, 6.0, 0.560, 2.55),
    "legs": (22.0, 8.0, 0.440, 1.25),
    "legside": (84.0, 6.0, 0.440, 1.25),
}


def preview(name, height, obj, views):
    """Build one figure and render the suit, without exporting anything.

    The suit ships from inside `export_skin` and is therefore invisible to every
    camera in this file, which is the same problem `post_preview` in human_mh.py
    exists to solve and this is the same answer: run the real `swimsuit` and
    hang what it returns on a real object. What renders is what ships.

    Worth the forty lines. Without it the loop on a garment shape is a Blender
    run, a ten-megabyte page build and a headless browser — four minutes a
    guess, which is how the bandeau survived as long as it did.
    """
    kind, suit, skin_p = SUITS[name]
    MH.TARGET_H = height
    MH.SKIN_P = skin_p
    J, scale, drop = MH.read_joints(obj)
    k = tuple(a / b for a, b in zip(MH.vault(obj, J["l-eye"].z), MH.SKULL))
    body = MH.load(obj, scale, drop)
    MH.smooth(body, 1, above=J["neck"].z)
    rig = MH.armature(J)
    MH.skin(body, rig)
    MH.paint(body, MH.cutters(J, k=k, torso=False, tail=False))

    out = ([], [], [], [])
    n = swimsuit(J, body, kind, suit, height, out)
    pos, nrm, col, tri = out
    print("[bathers]   suit %d verts %d tris" % (n, len(tri)))
    me = bpy.data.meshes.new("swim")
    me.from_pydata([tuple(p) for p in pos], [], [list(t) for t in tri])
    me.validate()
    a_p = me.color_attributes.new("prev", "FLOAT_COLOR", "POINT")
    for i, c in enumerate(col):
        a_p.data[i].color = (*c, 1.0)
    # Custom normals off the ones the builder computed, because the render is
    # the only place the lighting of a cup can be judged and Blender would
    # otherwise average the face normals of a strip two vertices wide.
    for pg in me.polygons:
        pg.use_smooth = True
    try:
        me.normals_split_custom_set_from_vertices([tuple(v) for v in nrm])
    except (AttributeError, RuntimeError) as e:
        print("[bathers]   (no custom normals: %s)" % e)
    ob = bpy.data.objects.new("swim", me)
    bpy.context.collection.objects.link(ob)
    MH._material(body)
    ob.data.materials.append(body.data.materials[0])
    MH._lights()
    MH.PREVIEW = str(PREVIEW_DIR / name)
    MH.NO_RENDER = False
    for v in views:
        az, el, tz, rad = SWIM_VIEWS[v]
        MH.VIEWS[v] = (az, el, tz * height, rad * height / 1.75, 760, 900)
    MH.render("swim", list(views))
    print("[bathers]   %s_swim_*.png" % MH.PREVIEW)


PREVIEW_DIR = Path("/tmp/bathers")


def main():
    global PREVIEW_DIR
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = argv[argv.index("--only") + 1] if "--only" in argv else None
    check = "--check" in argv
    shots = None
    if "--preview" in argv:
        rest = argv[argv.index("--preview") + 1:]
        shots = [a for a in rest if a in SWIM_VIEWS] or ["top", "hips", "whole"]
    if "--out" in argv:
        PREVIEW_DIR = Path(argv[argv.index("--out") + 1])
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, height, _recipe in mh_morph.BATHERS:
        if only and name != only:
            continue
        obj = BODIES / ("mh_%s.obj" % name)
        if not obj.exists():
            print("[bathers] no %s — run tools/blender/mh_morph.py first" % obj)
            continue
        print("[bathers] %s at %.2f m" % (name, height))
        if shots:
            preview(name, height, obj, shots)
            continue
        p = one(name, height, obj, check=check)
        if p:
            print("[bathers]   %s  %.0f KB" % (p.name, p.stat().st_size / 1024))


if __name__ == "__main__":
    main()
