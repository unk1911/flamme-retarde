"""Build the humanoid from the MakeHuman base mesh instead of from primitives.

    blender --background --python tools/blender/human_mh.py
    blender --background --python tools/blender/human_mh.py -- --sub 2

Writes build/human_mh.blend and preview renders to /tmp/mh_*.png. The source
mesh is cached at build/mh_base.obj and fetched on first run.

── why this replaced the hand-built figure ─────────────────────────────────────

tools/blender/human.py builds a person out of lofted rings and ellipsoids, welds
them with a voxel remesh, and rigs the result. It works, and the body it makes
measures correctly against real anthropometry — but a face cannot be reached
that way in any reasonable number of iterations. An eyelid is not an ellipsoid
and a nostril is not a small sphere, and every round spent approximating them
bought less than the round before.

Nobody models faces this way. So this takes the geometry from somewhere that
already did the sculpting, and keeps only the parts of the old pipeline that
were genuinely hard-won: the containment repaint, the cutter discipline, the
named bone rolls, and the weight relaxation.

── licence ────────────────────────────────────────────────────────────────────

MakeHuman's asset files — including this base mesh — were explicitly released
under CC0 1.0 in September 2020, stated in LICENSE.ASSETS.md at the root of the
makehumancommunity/makehuman repository. CC0 is a full waiver: no attribution
obligation, commercial use fine, and safe to redistribute in a public repo.
The credit below is offered rather than owed, and should stay anyway.

── what comes out of the box ──────────────────────────────────────────────────

19 158 vertices in 172 named groups, of which:

    body          13 378 quads — the figure itself, and the only rendered skin
    helper-*       4 358 faces — a mixture, and the mixture matters:
                     eyes, eyelashes, teeth, tongue   real anatomy, kept
                     skirt, tights, hair, genital     fitting proxies, dropped
    joint-*          750 faces — 125 marker cubes, one per joint

The joint markers are the reason this is worth doing twice over. Every bone
below is placed by reading the centroid of the corresponding marker, so the
skeleton is derived from the mesh rather than typed in beside it and cannot
drift out of register with it. `joint-ground` lands at z = -0.001 once the mesh
is scaled and dropped onto the floor, which is a free check on both numbers.

── axes ───────────────────────────────────────────────────────────────────────

MakeHuman is Y-up with X across and Z forward, in decimetres. This project is
Z-up with X forward and Y to the figure's left, in metres. So

    game (x, y, z) = (mh_z, mh_x, mh_y) * 0.10505 + (0, 0, 0.8583)

which is a cyclic permutation and therefore preserves handedness — worth
stating, because getting it wrong mirrors the figure and the only symptom is
that its heart ends up on the wrong side.
"""

from __future__ import annotations

import math
import sys
import urllib.request
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Euler, Matrix, Quaternion, Vector  # type: ignore
from mathutils.bvhtree import BVHTree  # type: ignore
from mathutils.kdtree import KDTree  # type: ignore

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "build" / "mh_base.obj"
BLEND = ROOT / "build" / "human_mh.blend"
PREVIEW = "/tmp/mh"
URL = ("https://raw.githubusercontent.com/makehumancommunity/makehuman/"
       "master/makehuman/data/3dobjs/base.obj")

TARGET_H = 1.750          # metres, the canonical figure
SUBSURF = 1               # smoothing passes over the base mesh
HEAD_CUTS = 2             # extra subdivision on the head, for paint resolution
EXPORT_TRIS = 26000       # triangles in the shipped blob
SOLVE_TRIS = 26000        # triangles the bone-heat solver is given (see skin)

# Helper groups that are anatomy and stay. Everything else prefixed `helper-`
# is a proxy for fitting clothes or hair and goes.
KEEP_HELPERS = ("helper-l-eye", "helper-r-eye",
                "helper-l-eyelashes", "helper-r-eyelashes",
                "helper-upper-teeth", "helper-lower-teeth", "helper-tongue")

# ── the palette ────────────────────────────────────────────────────────────── #
# Same convention as tools/blender/bather.py: three of these are markers the
# runtime replaces per figure, everything else is taken literally.
SKIN_M, SKIN_P = (1.0, 1.0, 1.0), (0.760, 0.588, 0.474)
SUIT_M, SUIT_P = (0.0, 0.0, 0.0), (0.114, 0.169, 0.290)
HAIR_M, HAIR_P = (1.0, 0.0, 0.0), (0.128, 0.094, 0.070)
EYE_M, EYE_P = (0.928, 0.922, 0.902), (0.928, 0.922, 0.902)
IRIS_M, IRIS_P = (0.105, 0.082, 0.068), (0.105, 0.082, 0.068)
PUPIL_M, PUPIL_P = (0.040, 0.035, 0.035), (0.040, 0.035, 0.035)
TOOTH_M, TOOTH_P = (0.880, 0.868, 0.836), (0.880, 0.868, 0.836)
TONGUE_M, TONGUE_P = (0.520, 0.280, 0.268), (0.520, 0.280, 0.268)
MOUTH_M, MOUTH_P = (0.300, 0.160, 0.145), (0.300, 0.160, 0.145)
# Lashes. Darker than the hair rather than the same as it, which is how real
# ones read — and it is the one place on this figure where a couple of shades
# is the whole difference between an eye and a hole.
LASH_M, LASH_P = (0.5, 0.0, 0.0), (0.052, 0.040, 0.036)
# Anklets. Literal on both channels — this is a colour, not one of the three
# markers the runtime swaps per figure, and a warm gold is the one metal that
# stays visible against every skin tone the crowd generator hands out. Silver
# against a pale leg at fifteen metres is a leg.
ANKLET_M, ANKLET_P = (0.860, 0.720, 0.400), (0.860, 0.720, 0.400)


# --------------------------------------------------------------------------- #
#  getting the mesh                                                            #
# --------------------------------------------------------------------------- #

def fetch():
    if CACHE.exists() and CACHE.stat().st_size > 1_000_000:
        return CACHE
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    print("[mh] fetching %s" % URL)
    with urllib.request.urlopen(URL, timeout=120) as r:
        CACHE.write_bytes(r.read())
    print("[mh] cached %s (%d bytes)" % (CACHE, CACHE.stat().st_size))
    return CACHE


def read_joints(path):
    """Centroid of every `joint-*` marker cube, in game space.

    Read straight out of the OBJ rather than from the imported objects, because
    the importer merges and renames groups and these are only wanted as numbers.
    Scale and floor offset are derived here too: the mesh's own height sets the
    scale, and its lowest vertex sets the drop.
    """
    verts, groups, cur = [], {}, None
    for ln in path.read_text().splitlines():
        if ln.startswith("v "):
            a = ln.split()
            verts.append((float(a[1]), float(a[2]), float(a[3])))
        elif ln.startswith("g "):
            cur = ln[2:].strip()
        elif ln.startswith("f "):
            g = groups.setdefault(cur, set())
            for tok in ln.split()[1:]:
                g.add(int(tok.split("/")[0]) - 1)

    body = groups.get("body", set())
    ys = [verts[i][1] for i in body]
    scale = TARGET_H / (max(ys) - min(ys))
    drop = -min(ys) * scale

    out = {}
    for g, idx in groups.items():
        if not g.startswith("joint-"):
            continue
        n = len(idx)
        vs = [verts[i] for i in idx]
        out[g[6:]] = Vector((
            sum(v[2] for v in vs) / n * scale,
            sum(v[0] for v in vs) / n * scale,
            sum(v[1] for v in vs) / n * scale + drop,
        ))
    return out, scale, drop


def load(path, scale, drop):
    """Import, throw away the proxies, transform, and join what is left."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Default axis settings, and the matrix below only turns the figure to face
    # +X. Measured rather than assumed, because there is no passthrough here:
    #
    #   default                       raw (NEGATIVE_Y fwd, Z up)
    #     x = mh_x                      x = mh_x
    #     y = -mh_z                     y = -mh_y      <- height, negated
    #     z = mh_y                      z = mh_z
    #
    # So the importer always transforms. Its default already gives a correct
    # upright Blender figure facing -Y; asking for "raw" instead swaps height
    # and depth and flips the height, which stands the figure on its head.
    # Applying a full axis permutation on top of the default lays it flat.
    #
    # The joint markers are parsed from the file text and never touch the
    # importer, so they always come out upright and correctly placed — which
    # makes the symptom of getting this wrong a well-placed skeleton next to a
    # body somewhere else entirely, and every paint cutter silently missing.
    bpy.ops.wm.obj_import(filepath=str(path), use_split_objects=True,
                          use_split_groups=True)

    def base(ob):
        n = ob.name
        return n.rsplit(".", 1)[0] if n.rsplit(".", 1)[-1].isdigit() else n

    keep, drop_obs = [], []
    for ob in list(bpy.context.scene.objects):
        if ob.type != "MESH":
            continue
        n = base(ob)
        if n == "body":
            keep.append((ob, SKIN_M, SKIN_P))
        elif n.startswith(("helper-l-eye", "helper-r-eye")) \
                and "eyelash" not in n:
            keep.append((ob, EYE_M, EYE_P))
        elif "eyelash" in n:
            keep.append((ob, LASH_M, LASH_P))
        elif n.endswith("-teeth"):
            keep.append((ob, TOOTH_M, TOOTH_P))
        elif n == "helper-tongue":
            keep.append((ob, TONGUE_M, TONGUE_P))
        else:
            drop_obs.append(ob)

    for ob in drop_obs:
        bpy.data.objects.remove(ob, do_unlink=True)

    # A quarter turn about Z, then scale and drop onto the floor.
    #
    # The import leaves the figure upright facing -Y, which is Blender's forward
    # but not this project's: here +X is forward and +Y is the figure's left.
    # With up = +Z and forward = -Y, the figure's left is +X, so the whole
    # conversion is game = (-y, x, z) * scale + (0, 0, drop) — and composing
    # that with the import reproduces (mh_z, mh_x, mh_y), which is exactly the
    # mapping `read_joints` uses. The two agreeing is the point.
    M = Matrix(((0.0, -scale, 0.0, 0.0),
                (scale, 0.0, 0.0, 0.0),
                (0.0, 0.0, scale, drop),
                (0.0, 0.0, 0.0, 1.0)))

    # Colour every piece before joining. Join keeps a colour attribute only
    # where all operands have one under the same name, and anything missing it
    # comes through black — which on a set of teeth is memorable.
    for ob, mark, prev in keep:
        ob.matrix_world = M @ ob.matrix_world
        me = ob.data
        a_m = me.color_attributes.new("mark", "FLOAT_COLOR", "POINT")
        a_p = me.color_attributes.new("prev", "FLOAT_COLOR", "POINT")
        for i in range(len(me.vertices)):
            a_m.data[i].color = (*mark, 1.0)
            a_p.data[i].color = (*prev, 1.0)

    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob, _m, _p in keep:
        ob.select_set(True)
    body = next(ob for ob, _m, _p in keep if base(ob) == "body")
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = "human"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return body


def smooth(body, levels):
    """Catmull-Clark over the base mesh, and extra density on the head.

    The base is 13 378 quads for a whole person, which is about 8 mm between
    vertices on the face — and vertex colour cannot paint a feature smaller than
    one vertex. One global level takes that to 4 mm and rounds off the faceting;
    the head then gets two more on its own, which buys about a millimetre where
    the eyes and mouth are without paying for it on the shins.
    """
    bpy.context.view_layer.objects.active = body
    if levels:
        m = body.modifiers.new("sub", "SUBSURF")
        m.levels = m.render_levels = levels
        bpy.ops.object.modifier_apply(modifier="sub")

    bm = bmesh.new()
    bm.from_mesh(body.data)
    edges = set()
    for f in bm.faces:
        if f.calc_center_median().z > 1.46:
            edges.update(f.edges)
    if edges:
        bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=HEAD_CUTS,
                                  use_grid_fill=True)
    bm.to_mesh(body.data)
    bm.free()
    for p in body.data.polygons:
        p.use_smooth = True
    return body


# --------------------------------------------------------------------------- #
#  hair                                                                        #
# --------------------------------------------------------------------------- #
#
# Everything else on this figure is painted rather than modelled — eyes, brows,
# mouth, trunks are all vertex colour laid down through a cutter volume, which
# is the whole reason a MakeHuman base with no textures can carry a face. Hair
# is the one feature that cannot be done that way and be *long*, because paint
# has nothing to sit on: dark colour over the skull is a crew cut however far
# down the neck it is taken, and the silhouette is what reads at ten metres.
#
# So the scalp stays painted and the length is geometry — a knot at the back of
# the crown and a tail hanging off it. Both are separate closed shells, which
# means `skin()` picks them up in its loose-shell pass and hands each of them
# whole to the `head` bone. That is also the honest rig for them: there is no
# hair bone, so the tail is rigid to the skull and swings with it. Adding one
# would cost a bone out of the palette and a keyframe in every clip, for a
# figure who is 1.75 m of a 189 m promenade.
#
# All of it is in game space — +X forward, +Y her left, +Z up, metres — and the
# numbers are off the base mesh: the back of her skull runs to x = −0.041, the
# nape tucks in to −0.012, and the deepest part of her upper back is −0.055. The
# tail clears all three.
HAIR_KNOT = (-0.052, 0.0, 1.688, 0.043, 0.040, 0.038)
HAIR_TAIL = [
    (-0.062, 0.0, 1.690, 0.032),   # inside the knot, so the two read as one
    (-0.082, 0.0, 1.652, 0.036),
    (-0.094, 0.0, 1.596, 0.035),
    (-0.098, 0.0, 1.530, 0.033),
    (-0.096, 0.0, 1.464, 0.030),
    (-0.090, 0.0, 1.404, 0.025),
    (-0.084, 0.0, 1.352, 0.016),
    (-0.080, 0.0, 1.318, 0.005),
]

# Anklets, one a side. Height and radii measured off the mesh rather than
# authored: the ankle marker sits at z = 0.0756, and 35 mm above it the leg is a
# clean 82 × 60 mm ellipse — low enough to be at her ankle and high enough to be
# past the flare of the heel, which at the marker itself is still 114 mm across
# and would want a ring you could get a fist through.
#
# The band goes to `foot`, which is the nearest bone head to it by some way —
# the shin's bone starts at the knee, 36 cm up. That is also what a real anklet
# does: it rests on the ankle bone itself, on the joint rather than above it,
# and turns with the foot.
ANKLET_Z = 0.035          # above the ankle marker
ANKLET_R = (0.0455, 0.0345)   # fore-aft and lateral, ~4 mm proud of the skin
ANKLET_WIRE = 0.0026      # a 5 mm band: a chain reads as nothing at this range


def extras(body, J):
    """Build every piece of joined geometry and put it on the body in one pass.

    The hair knot, the tail and the two anklets. They are one function and one
    join because of how the idempotence works: `join` appends, so the added
    geometry is always the *last* N vertices of the mesh, and re-running removes
    the previous N first. That trick only survives while a single function owns
    all of it. Two functions each deleting their own last N, joined in either
    order, is a loop that eats the other one's work — add the anklets after the
    hair and the next `--extras` deletes the anklets and calls them a ponytail.

    Coloured here rather than by a cutter. `paint` only overwrites vertices a
    cutter volume claims, and these sit outside every one of them — which is
    correct, since a cutter big enough to catch the tail would also catch the
    back of her neck and half a shoulder blade.
    """
    old = body.get("extraN", 0) or body.get("hairN", 0)
    if old:
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=bm.verts[-old:], context="VERTS")
        bm.to_mesh(body.data)
        bm.free()
        print("[mh] extras: dropped %d previous verts" % old)

    # Each piece is its own closed shell, which is what `skin()` needs: its
    # loose-shell pass hands a whole shell to one bone, and that is exactly the
    # rig these want — a tail rigid to the skull, a band rigid to the shin.
    vs, fs = ball(*HAIR_KNOT, rows=16, seg=20)
    tint = [(HAIR_M, HAIR_P)] * len(vs)

    def add_shell(sv, sf, mark, prev):
        off = len(vs)
        vs.extend(sv)
        fs.extend([[i + off for i in f] for f in sf])
        tint.extend([(mark, prev)] * len(sv))

    add_shell(*tube(HAIR_TAIL, seg=16), HAIR_M, HAIR_P)
    for s in (1, -1):
        ank = J["%s-ankle" % ("l" if s > 0 else "r")]
        add_shell(*ring((ank.x, ank.y, ank.z + ANKLET_Z),
                        ANKLET_R[0], ANKLET_R[1], ANKLET_WIRE),
                  ANKLET_M, ANKLET_P)

    me = bpy.data.meshes.new("extras")
    me.from_pydata([tuple(v) for v in vs], [], fs)
    me.validate()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    a_m = me.color_attributes.new("mark", "FLOAT_COLOR", "POINT")
    a_p = me.color_attributes.new("prev", "FLOAT_COLOR", "POINT")
    for i in range(len(me.vertices)):
        mark, prev = tint[i]
        a_m.data[i].color = (*mark, 1.0)
        a_p.data[i].color = (*prev, 1.0)
    for p in me.polygons:
        p.use_smooth = True

    ob = bpy.data.objects.new("extras", me)
    bpy.context.collection.objects.link(ob)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body["extraN"] = len(vs)
    body["hairN"] = 0
    print("[mh] extras: %d verts, %d faces joined (hair + 2 anklets)"
          % (len(vs), len(fs)))
    return body


# --------------------------------------------------------------------------- #
#  the skeleton                                                                #
# --------------------------------------------------------------------------- #
#
# (bone, parent, head marker, tail marker). Every position is a joint centroid
# from the mesh itself — nothing here is a typed coordinate.
#
# Note the spine markers are numbered from the top down: spine-4 is lumbar and
# spine-1 is the base of the neck, which is the reverse of what the names
# suggest and would put a bend in the wrong vertebra if taken at face value.
BONES = [
    ("pelvis", None, "pelvis", "spine-4"),
    ("spine01", "pelvis", "spine-4", "spine-3"),
    ("spine02", "spine01", "spine-3", "spine-2"),
    ("spine03", "spine02", "spine-2", "spine-1"),
    ("chest", "spine03", "spine-1", "neck"),
    ("neck", "chest", "neck", "head"),
    ("head", "neck", "head", "head-2"),
    ("jaw", "head", "head", "jaw"),
]
for _s, _t in (("l", "L"), ("r", "R")):
    BONES += [
        ("clavicle" + _t, "chest", "%s-clavicle" % _s, "%s-shoulder" % _s),
        ("armU" + _t, "clavicle" + _t, "%s-shoulder" % _s, "%s-elbow" % _s),
        ("armL" + _t, "armU" + _t, "%s-elbow" % _s, "%s-hand" % _s),
        ("hand" + _t, "armL" + _t, "%s-hand" % _s, "%s-hand-2" % _s),
        ("thumb" + _t, "hand" + _t, "%s-finger-1-1" % _s, "%s-finger-1-3" % _s),
        ("eye" + _t, "head", "%s-eye" % _s, "%s-eye-target" % _s),
        ("legU" + _t, "pelvis", "%s-upper-leg" % _s, "%s-knee" % _s),
        ("legL" + _t, "legU" + _t, "%s-knee" % _s, "%s-ankle" % _s),
        ("foot" + _t, "legL" + _t, "%s-ankle" % _s, "%s-foot-1" % _s),
        ("toe" + _t, "foot" + _t, "%s-foot-1" % _s, "%s-foot-2" % _s),
    ]

# Local Z for each bone, named rather than left to Blender.
#
# Blender derives a roll per bone from its rest direction if you do not say. For
# a limb a degree or two off vertical that gives arbitrarily tilted axes, so a
# pure hip flexion also adducts and the figure walks with its legs crossing over
# the midline. Naming Z as world -X for every up-or-down bone makes local X the
# figure's left on all of them, so +X is sagittal swing everywhere and the two
# sides mirror in sign. Bones running fore-aft or across take Z as world up.
ROLL_UP = Vector((-1.0, 0.0, 0.0))
ROLL_FLAT = Vector((0.0, 0.0, 1.0))
FLAT = ("footL", "footR", "toeL", "toeR", "clavicleL", "clavicleR",
        "thumbL", "thumbR", "jaw", "eyeL", "eyeR")


def armature(J):
    arm = bpy.data.armatures.new("rig")
    rig = bpy.data.objects.new("rig", arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    made = {}
    for name, parent, h, t in BONES:
        if h not in J or t not in J:
            print("[mh] missing marker for %s (%s -> %s)" % (name, h, t))
            continue
        b = arm.edit_bones.new(name)
        b.head, b.tail = J[h], J[t]
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + Vector((0.0, 0.0, 0.02))
        b.align_roll(ROLL_FLAT if name in FLAT else ROLL_UP)
        if parent and parent in made:
            b.parent = made[parent]
            b.use_connect = False
        made[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def islands(me):
    """(label per vertex, [size]) for the mesh's connected components."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    lab = [-1] * len(bm.verts)
    sizes = []
    for v in bm.verts:
        if lab[v.index] >= 0:
            continue
        k = len(sizes)
        stack, n = [v], 0
        lab[v.index] = k
        while stack:
            c = stack.pop()
            n += 1
            for e in c.link_edges:
                o = e.other_vert(c)
                if lab[o.index] < 0:
                    lab[o.index] = k
                    stack.append(o)
        sizes.append(n)
    bm.free()
    return lab, sizes


def _trim_jaw(bm, dl, body, rig, gi):
    """Cut the jaw bone back to a jaw.

    Bone heat gives it most of the skull, and by its own lights it is not wrong
    to: the bone runs from a pivot deep inside the head out to the point of the
    chin, so measured the only way the solver can measure — distance through the
    volume — the crown of the head really is nearer to the jaw than to anything
    else. What comes back is a bone that drops the chin 49 mm at eighteen
    degrees and takes 18 mm of skullcap down with it. That is not a mouth
    opening. It is a head deflating, and it is why nothing has ever keyed this
    bone: it has been in the palette since the rig was built and unusable since
    the rig was built.

    So it is cut by hand, on the two axes the mistake is actually on.

    *Height.* A mandible is everything from under the chin up to the mouth. Above
    the mouth it fades out over four centimetres rather than stopping, because a
    real cheek does follow a jaw a little, and a hard edge across a face at the
    density this mesh is at is a visible line.

    *Depth.* And nothing behind the pivot. The jaw hinges just in front of the
    ear; the nape, the neck and the back of the skull are on the other side of
    that hinge and have no business moving with it. Faded over four centimetres
    for the same reason.

    Both bands are taken off the bone rather than typed in, so they follow the
    figure if the base mesh is ever swapped. Nothing is redistributed: the
    weight is simply removed, and `vertex_group_normalize_all` at the end of
    `skin` hands what is left to whoever else was already there — which on this
    part of the figure is `head`, which is the right answer.
    """
    if "jaw" not in gi or "jaw" not in rig.data.bones:
        return
    jb = rig.data.bones["jaw"]
    piv, chin = jb.head_local, jb.tail_local
    span = max(piv.z - chin.z, 1e-6)
    z_full = chin.z + 0.55 * span          # the mouth line: the jaw owns this
    z_gone = chin.z + 1.30 * span          # and has nothing left up here
    x_gone = piv.x - 0.020                 # behind the hinge
    x_full = piv.x + 0.020
    k = gi["jaw"]
    cut = 0
    for i, v in enumerate(body.data.vertices):
        d = bm.verts[i][dl]
        w = d.get(k, 0.0)
        if w <= 0.0:
            continue
        fz = (z_gone - v.co.z) / (z_gone - z_full)
        fx = (v.co.x - x_gone) / (x_full - x_gone)
        f = min(max(fz, 0.0), 1.0) * min(max(fx, 0.0), 1.0)
        f = f * f * (3.0 - 2.0 * f)        # smoothstep, so the seam is not one
        if f < 0.999:
            d[k] = w * f
            cut += 1
    print("[mh] jaw trimmed on %d verts (z %.3f..%.3f, x behind %.3f)"
          % (cut, z_full, z_gone, x_full))


def skin(body, rig):
    """Weight the mesh to the skeleton.

    ── why this is not one call to ARMATURE_AUTO ──────────────────────────────

    It was, and it silently produced nothing. Blender's bone-heat solver wants a
    closed volume with a bone inside it, and this mesh is *sixty-six* separate
    shells: the body, two eyeballs, two lash strips, a tongue, and a full set of
    individually modelled teeth. Every one of those shells is a component of the
    same linear system with no bone anywhere inside it, the solve goes singular,
    and what comes back is the warning

        Bone Heat Weighting: failed to find solution for one or more bones

    and twenty-eight vertex groups containing zero weights. The figure then
    parents to the armature, poses without moving a vertex, renders identically
    in every pose, and exports as a statue — which is exactly what shipped, and
    was read as "we have no animation yet" rather than as a broken bind.

    So: solve on the body shell alone, and hand the loose shells to a bone each.
    """
    # Idempotent, so --rebind can be run on a blend that is already bound.
    for m in list(body.modifiers):
        if m.type == "ARMATURE":
            body.modifiers.remove(m)

    lab, sizes = islands(body.data)
    big = max(range(len(sizes)), key=lambda i: sizes[i])
    print("[mh] %d shells; body is %d verts, %d in %d loose shells"
          % (len(sizes), sizes[big], sum(sizes) - sizes[big], len(sizes) - 1))

    # The eye bones come out of the solve. They sit in a cavity — the eyeballs
    # are one of the shells that just got removed — so heat weighting hands them
    # a quarter of the face each, and a glance to the left takes both cheeks
    # with it. They get their eyeballs back by hand below.
    eyes = ("eyeL", "eyeR")
    for n in eyes:
        if n in rig.data.bones:
            rig.data.bones[n].use_deform = False

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    src = bpy.context.view_layer.objects.active
    src.name = "weight_src"
    for m in list(src.modifiers):
        src.modifiers.remove(m)
    for g in list(src.vertex_groups):
        src.vertex_groups.remove(g)
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if lab[v.index] != big],
                     context="VERTS")
    bm.to_mesh(src.data)
    bm.free()

    # And decimated to roughly what ships, because the solver will not take the
    # full mesh either: 192 424 vertices of body shell, one island, every bone
    # inside it, and it still comes back empty. At export density it solves in
    # a couple of seconds. So the weights are computed on the topology that
    # actually gets exported, and lifted back on to the dense mesh afterwards —
    # which is the right way round anyway, since the alternative is solving on
    # geometry nobody will ever draw and then throwing 93% of it away.
    have = sum(len(p.vertices) - 2 for p in src.data.polygons)
    if have > SOLVE_TRIS:
        bpy.context.view_layer.objects.active = src
        d = src.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = SOLVE_TRIS / have
        bpy.ops.object.modifier_apply(modifier="dec")
    print("[mh] solving weights on %d verts" % len(src.data.vertices))

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    src.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    solved = sum(1 for v in src.data.vertices if v.groups)
    print("[mh] heat solved %d/%d" % (solved, len(src.data.vertices)))
    if solved < len(src.data.vertices) * 0.99:
        sys.exit("error: bone heat weighting failed — %d of %d vertices unweighted"
                 % (len(src.data.vertices) - solved, len(src.data.vertices)))

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_NAME")

    gi = {g.name: g.index for g in body.vertex_groups}
    sg = {g.index: g.name for g in src.vertex_groups}
    sw = [[(gi[sg[g.group]], g.weight) for g in v.groups if g.weight > 0.0]
          for v in src.data.vertices]
    kd = KDTree(len(src.data.vertices))
    for i, v in enumerate(src.data.vertices):
        kd.insert(v.co, i)
    kd.balance()

    # Straight into the deform layer. The obvious `vertex_group.add()` per
    # influence is three quarters of a million operator calls on this mesh.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    dl = bm.verts.layers.deform.verify()
    weighted = 0
    for i, lb in enumerate(lab):
        if lb != big:
            continue
        _co, j, _d = kd.find(body.data.vertices[i].co)
        d = bm.verts[i][dl]
        for g, w in sw[j]:
            d[g] = w
        weighted += bool(sw[j])

    # The loose shells, one bone each. An eyeball is the island whose points are
    # all the same distance from their own centroid — that is what tells it
    # apart from the lash strip wrapped around it, which sits in the same place
    # and would otherwise win on proximity alone.
    head = rig.data.bones
    byname = {b.name: b for b in head}
    assigned = {}
    for k in range(len(sizes)):
        if k == big:
            continue
        vs = [i for i, lb in enumerate(lab) if lb == k]
        c = Vector((0.0, 0.0, 0.0))
        for i in vs:
            c += body.data.vertices[i].co
        c /= len(vs)
        rs = [(body.data.vertices[i].co - c).length for i in vs]
        round_ = min(rs) / max(max(rs), 1e-9)
        pick = "head"
        # `head` is the right default for every loose shell the base mesh has —
        # teeth, tongue, eyeballs and lashes are all inside the skull, and so is
        # the ponytail, which is why this was a default and not a decision. It
        # became the wrong one the instant a loose shell existed below the neck:
        # the first pair of anklets came back rigidly attached to her jaw, and
        # the export was perfectly happy about it. Anything under the collarbone
        # goes to the nearest bone instead.
        if c.z < byname["neck"].head_local.z:
            pick = min(byname, key=lambda n: (c - byname[n].head_local).length)
        for n in eyes:
            if n in byname and (c - byname[n].head_local).length < 0.03 and round_ > 0.5:
                pick = n
        assigned[pick] = assigned.get(pick, 0) + 1
        for i in vs:
            bm.verts[i][dl][gi[pick]] = 1.0
        weighted += len(vs)

    _trim_jaw(bm, dl, body, rig, gi)
    bm.to_mesh(body.data)
    bm.free()
    print("[mh] weighted %d/%d verts; loose shells -> %s"
          % (weighted, len(body.data.vertices), assigned))
    if weighted < len(body.data.vertices):
        sys.exit("error: %d vertices left with no bone at all"
                 % (len(body.data.vertices) - weighted))

    bpy.data.objects.remove(src, do_unlink=True)
    for n in eyes:
        if n in rig.data.bones:
            rig.data.bones[n].use_deform = True

    # Relax the weights across every joint, then cap the influences.
    #
    # Bone heat returns a solution that is correct but sharp: the thigh-to-shin
    # transition happens over a couple of edge loops, so at forty degrees of
    # knee flex the inside creases and the outside pinches to a waist. And it
    # leaves a long tail of near-zero weights — a rib answering faintly to a
    # wrist — which is what puts a fan of fine wrinkles across a torso whenever
    # the spine twists. Four influences is also what the runtime will afford.
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.object.vertex_group_smooth(group_select_mode="ALL",
                                       factor=0.5, repeat=10, expand=0.0)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    return body


# --------------------------------------------------------------------------- #
#  paint                                                                       #
# --------------------------------------------------------------------------- #

_RAY = Vector((0.5771, 0.5774, 0.5777)).normalized()


def _inside(tree, p):
    """Ray parity. Valid on one closed shell only — see `cutters`."""
    o, n = p.copy(), 0
    while n < 64:
        loc, _nrm, _idx, _d = tree.ray_cast(o, _RAY)
        if loc is None:
            return n % 2 == 1
        n += 1
        o = loc + _RAY * 1e-5
    return False


def ball(cx, cy, cz, rx, ry, rz, rows=12, seg=20):
    """A closed ellipsoid as a bare (verts, faces) pair — no Blender object.

    These are never rendered. They exist only to be asked whether a point is
    inside them.
    """
    vs, fs, grid = [], [], []
    for j in range(1, rows):
        t = -math.pi * 0.5 + math.pi * j / rows
        rr, zz = math.cos(t), math.sin(t)
        row = []
        for i in range(seg):
            a = 2.0 * math.pi * i / seg
            row.append(len(vs))
            vs.append(Vector((cx + math.cos(a) * rr * rx,
                              cy + math.sin(a) * rr * ry,
                              cz + zz * rz)))
        grid.append(row)
    bot, top = len(vs), len(vs) + 1
    vs.append(Vector((cx, cy, cz - rz)))
    vs.append(Vector((cx, cy, cz + rz)))
    for j in range(len(grid) - 1):
        for i in range(seg):
            k = (i + 1) % seg
            fs.append([grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]])
    for i in range(seg):
        k = (i + 1) % seg
        fs.append([bot, grid[0][k], grid[0][i]])
        fs.append([top, grid[-1][i], grid[-1][k]])
    return vs, fs


def tube(path, seg=14):
    """A tapered closed tube through `path` = [(x, y, z, radius), ...].

    Unlike `ball` this one does get rendered, so the rings are laid in the plane
    normal to the local direction — a tube whose rings all sit in the same world
    plane pinches to a ribbon wherever the path turns.

    The frame is taken off world +Y, the figure's left. Every path here runs
    down her back in the x–z plane, where +Y is exactly perpendicular and the
    frame is stable; the degenerate case is checked for anyway because the cost
    of being wrong is a tube inside out along one section and nothing else.
    """
    up = Vector((0.0, 1.0, 0.0))
    pts = [Vector(p[:3]) for p in path]
    rad = [p[3] for p in path]
    vs, fs = [], []
    for i, c in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = d.cross(up)
        if u.length < 1e-6:
            u = d.cross(Vector((1.0, 0.0, 0.0)))
        u.normalize()
        v = d.cross(u).normalized()
        for k in range(seg):
            a = 2.0 * math.pi * k / seg
            vs.append(c + (u * math.cos(a) + v * math.sin(a)) * rad[i])
    for i in range(len(pts) - 1):
        for k in range(seg):
            j = (k + 1) % seg
            fs.append([i * seg + k, i * seg + j,
                       (i + 1) * seg + j, (i + 1) * seg + k])
    # Both ends closed, on a point pushed a radius past the last ring so the tip
    # is a cone rather than a flat disc seen edge-on.
    lo, hi = len(vs), len(vs) + 1
    vs.append(pts[0] - (pts[1] - pts[0]).normalized() * rad[0])
    vs.append(pts[-1] + (pts[-1] - pts[-2]).normalized() * rad[-1])
    n = (len(pts) - 1) * seg
    for k in range(seg):
        j = (k + 1) % seg
        fs.append([lo, j, k])
        fs.append([hi, n + k, n + j])
    return vs, fs


def ring(c, ra, rb, wire, seg=18, ring_seg=6):
    """A closed elliptical ring about the vertical axis, centred on `c`.

    `ra`/`rb` are the fore-aft and lateral radii of the ring itself and `wire`
    is the thickness of the band. Elliptical rather than round because a leg is:
    measured at the height this sits, the cross-section is 82 mm fore-and-aft
    and 60 mm across, and a circular ring big enough to clear the wider way
    stands a centimetre off the skin on the narrower one, which reads as a hoop
    somebody has thrown at her.

    Slightly generous on purpose, all the same. A ring that intersects the leg
    shows skin through the metal and stops being an object; a ring floating
    three or four millimetres off it is what an anklet does anyway.
    """
    vs, fs = [], []
    for i in range(seg):
        a = 2.0 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        for k in range(ring_seg):
            b = 2.0 * math.pi * k / ring_seg
            cb, sb = math.cos(b), math.sin(b)
            vs.append((c[0] + ca * (ra + wire * cb),
                       c[1] + sa * (rb + wire * cb),
                       c[2] + wire * sb))
    for i in range(seg):
        i2 = (i + 1) % seg
        for k in range(ring_seg):
            k2 = (k + 1) % ring_seg
            fs.append([i * ring_seg + k, i2 * ring_seg + k,
                       i2 * ring_seg + k2, i * ring_seg + k2])
    return vs, fs


def cutters(J):
    """The paint volumes, each one closed, positioned off the joint markers.

    Two rules govern every entry, and both were learned the hard way.

    *One shell per volume.* `_inside` is a ray parity test and parity only holds
    on a single closed surface — a ray through the overlap of two shells crosses
    four walls, counts even, and reports outside. Two overlapping halves of a
    mouth painted as one volume gave a mouth in three disconnected pieces.

    *A cutter is a punch, not a blob.* It has to run deep, well past the surface
    it marks, and cross it steeply; it is tight only in the two directions that
    define the shape being drawn. Sized to resemble the feature instead — a brow
    12 mm deep sitting just under a forehead — it lies nearly tangent, so along
    its whole rim inside-or-outside turns on tenths of a millimetre and the
    feature comes back with a fuzzy halo. What gets painted is the cutter's
    cross section where the finished surface passes through it, so the shape
    wanted is its *silhouette* and the depth is only there to keep the edge
    sharp.
    """
    out = []

    def add(name, mark, prev, prio, c, r, rows=12, seg=20):
        vs, fs = ball(c[0], c[1], c[2], r[0], r[1], r[2], rows, seg)
        lo = Vector((min(v[a] for v in vs) for a in range(3)))
        hi = Vector((max(v[a] for v in vs) for a in range(3)))
        out.append((BVHTree.FromPolygons([tuple(v) for v in vs], fs,
                                         all_triangles=False),
                    mark, prev, prio, lo, hi, name))

    head = J["head-2"].z

    # ── how far forward a cutter has to reach ──────────────────────────────
    #
    # Every number below moved forward at once, and they were all wrong the same
    # way, so it is worth writing down what the mistake was.
    #
    # The rule in this docstring — a cutter is a punch, it runs deep and crosses
    # the surface steeply — is about the *back* of the cutter. It says nothing
    # about the front, and the front is where these were all failing: the shape
    # you get is the cutter's cross-section where the finished surface passes
    # through it, and a cutter that stops short of the surface has no cross
    # section there at all. It paints nothing, silently, and `paint` prints a
    # tally that does not include it — a line that is missing rather than a line
    # that is wrong, which is the hardest kind to notice.
    #
    # Measured off the mesh, the front of the figure at this height runs:
    #
    #     eyeball front pole   x = 0.1462     iris cutter reached  0.1458
    #     brow ridge           x = 0.1511     brow cutter reached  0.1388
    #     upper lip            x = 0.1681     mouth cutter reached 0.0824
    #
    # So the iris missed by four tenths of a millimetre, which is why she has a
    # pupil and no iris — the pupil's needle happens to be 2 mm longer. The brow
    # missed by 12 mm. And the mouth missed by 86 mm, because `J["mouth"]` is
    # not on the mouth: it is MakeHuman's internal pivot, sitting inside the
    # skull at the height of the *nose*. Twenty-nine vertices somewhere in the
    # middle of her head have been the entire mouth since the figure shipped.
    #
    # None of that is visible in a render unless you go looking. A face with no
    # mouth does not read as a face with something missing, it reads as a face
    # slightly out of focus, and it survived a dozen contact sheets on that.
    for s, tag in ((1, "l"), (-1, "r")):
        e = J["%s-eye" % tag]
        # ── waist, not tip ──────────────────────────────────────────────
        #
        # Reaching the surface is necessary and it is not sufficient, which is
        # the second half of the same lesson and cost a second render to learn.
        # Move the iris needle forward until its front tip cleared the eyeball
        # by 4.6 mm and she got an iris 3 mm across instead of 12 — because an
        # ellipsoid's tip is a taper. At 90% of the way along a 45 mm semi-axis
        # the cross-section is down to sqrt(1 - 0.9^2) = 44% of nominal, and
        # what gets painted is the cross-section where the surface passes
        # through, not the radius it was declared with.
        #
        # So these are centred so that their *waist* sits on the surface, not
        # so that their tip clears it. The ellipsoid then runs 5 cm out in front
        # of her face, through nothing at all, and the 5 cm behind it is the
        # punch the docstring asks for. The declared radius is the painted
        # radius, which is what makes these numbers mean anything.
        add("iris" + tag, IRIS_M, IRIS_P, 4,
            (0.1455, e.y, e.z), (0.0500, 0.0058, 0.0058))
        add("pupil" + tag, PUPIL_M, PUPIL_P, 5,
            (0.1455, e.y, e.z), (0.0500, 0.0026, 0.0026))
        # Brow, a little above and slightly outboard of the eye.
        add("brow" + tag, HAIR_M, HAIR_P, 3,
            (e.x - 0.020, e.y * 1.06, e.z + 0.026),
            (0.0480, 0.0250, 0.0055))
        # The lash lines, along the top and the bottom of the aperture.
        #
        # She already *has* eyelashes: MakeHuman's lash strips come through the
        # import as two of the kept helpers and are welded in with everything
        # else. They are also half a millimetre of geometry going through a
        # decimator that keeps one triangle in eight, which leaves a suggestion
        # of a smudge — and the whole lesson of this file is that at the range
        # she is actually looked at, a feature is a colour and not a shape. So
        # the lashes get drawn the way the brows and the mouth are drawn, and
        # the modelled strips are caught inside the same volume on the way past,
        # which is what stops the lower ones rendering as a pale scalloped fringe
        # under each eye.
        #
        # Both have to come *after* the iris and the pupil in this list. `paint`
        # walks the coats in order and every hit overwrites, so list order is the
        # priority whatever `prio` says — and a lash line's whole job is to sit
        # over the top of the eyeball rather than under it.
        # Waisted on the lid like the iris above, and the radii cut back to
        # suit: the lower strip was still coming out pale because its front tip
        # stopped a couple of millimetres short of the strip's own front, and
        # what a light scalloped fringe under an eye reads as is not eyelashes.
        add("lash" + tag, LASH_M, LASH_P, 6,
            (0.1380, e.y, e.z + 0.0074), (0.0500, 0.0118, 0.0019))
        add("lashlo" + tag, LASH_M, LASH_P, 6,
            (0.1380, e.y, e.z - 0.0078), (0.0500, 0.0106, 0.0016))
    # ── the mouth ──────────────────────────────────────────────────────────
    #
    # Placed off the chin, because `J["mouth"]` is unusable (see above) and the
    # chin marker is a real landmark on a real surface. Measured down the
    # midline, the profile from the nose to the chin goes
    #
    #     z 1.586  x 0.1762   nose tip
    #     z 1.570  x 0.1645   subnasale, the bottom of the philtrum
    #     z 1.559  x 0.1681   upper lip
    #     z 1.551  x 0.1632   the crease between the lips   <- the mouth line
    #     z 1.544  x 0.1638   lower lip
    #     z 1.508  x 0.1509   the point of the chin
    #
    # and the crease is 43 mm above the chin marker, which is where this goes.
    # A local minimum between two local maxima is what a closed mouth *is*, and
    # it is a far better anchor than any joint in the file, because it is the
    # feature rather than a pivot somebody chose for it.
    #
    # Three separate shells, so parity stays valid — see the docstring — with
    # the corners set *higher* and further back than the middle. A dead-straight
    # mouth is the one feature that makes a head read as a mannequin.
    #
    # The corners used to be 1.8 mm below the middle, which is a mouth at rest,
    # and that was right while she was a figure standing on a promenade looking
    # at the sea. She is not that any more — she notices you, goes down on all
    # fours, somersaults, cartwheels, and now stands in a jet of water with her
    # arms out — and a resting mouth over the top of all that reads as somebody
    # enduring it. 3.2 mm above the middle is five millimetres of lift across a
    # 55 mm mouth: a pleasant face, not a grin.
    #
    # The grin is the jaw bone's job and it only happens when she is being
    # hosed. This is what her face does the rest of the time.
    lip = J["jaw"].z + 0.043
    add("mouth0", MOUTH_M, MOUTH_P, 4,
        (0.128, 0.0, lip), (0.0550, 0.0135, 0.0024))
    for s in (1, -1):
        add("mouth%d" % s, MOUTH_M, MOUTH_P, 4,
            (0.124, s * 0.0165, lip + 0.0032), (0.0550, 0.0110, 0.0022))

    # Hair: a cap over the skull, cut at the brow. Unlike the others this one is
    # a solid the scalp sits inside, not a punch through it.
    #
    # Pushed forward 4 cm from where it first sat. It used to stop at x = 0.099
    # and her forehead runs out to 0.145 at that height, so there were four and
    # a half centimetres of bare scalp in front of the hairline — which from the
    # promenade is not a high forehead, it is a bald woman.
    add("hair", HAIR_M, HAIR_P, 2,
        (J["head"].x + 0.023, 0.0, head - 0.066),
        (0.112, 0.092, 0.104), rows=16, seg=26)

    # And the nape, as a second shell rather than by stretching the first.
    # The cap has to stop at the brow and a single ellipsoid long enough to
    # reach the hairline at the back reaches the eyebrows at the front. This one
    # is behind the ears and below the crown, which is where the hair gathered
    # into the knot actually lies — without it the modelled tail hangs off a
    # shaved neck, which is a worse read than no tail at all.
    add("nape", HAIR_M, HAIR_P, 2,
        (J["head"].x - 0.090, 0.0, J["neck"].z + 0.058),
        (0.105, 0.070, 0.085), rows=14, seg=22)

    # Swim shorts. Sized off the hip and knee markers so they follow the mesh
    # rather than being dialled in against it.
    hip, knee = J["l-upper-leg"], J["l-knee"]
    hem = knee.z + (hip.z - knee.z) * 0.50
    add("trunks", SUIT_M, SUIT_P, 2,
        (hip.x, 0.0, (hip.z + hem) * 0.5 + 0.020),
        (0.180, 0.230, (hip.z - hem) * 0.5 + 0.075), rows=18, seg=28)
    return out


def paint(body, coats):
    """Overwrite the joined colours wherever a cutter claims a vertex."""
    me = body.data
    a_m = me.color_attributes["mark"]
    a_p = me.color_attributes["prev"]
    dive = 0.0012
    hits = {}
    for i, v in enumerate(me.vertices):
        p = v.co - v.normal * dive
        for tree, mark, prev, _prio, lo, hi, name in coats:
            if not (lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y
                    and lo.z <= p.z <= hi.z):
                continue
            if _inside(tree, p):
                a_m.data[i].color = (*mark, 1.0)
                a_p.data[i].color = (*prev, 1.0)
                hits[name] = hits.get(name, 0) + 1
    for k in sorted(hits):
        print("[mh]   painted %-10s %6d verts" % (k, hits[k]))
    return body


# --------------------------------------------------------------------------- #
#  export                                                                      #
# --------------------------------------------------------------------------- #

def export_static(body, path, tris=26000):
    """Write the *posed* figure as a plain .fr3d v1 blob.

    No skinning, no bones, no animation — the armature is evaluated and the
    result frozen. That is a deliberately small first step: the runtime already
    decodes v1 and already reads its colour bytes per vertex (see `readFR3D` in
    src/48-landmarks.js), so this puts her on the concrete in Šibenik without a
    single line of new runtime code. Scale, palette, lighting and placement all
    get proved before any of the skinning work begins.

    Colours come from the `prev` attribute rather than `mark`, because the
    landmark material multiplies by vVCol literally and knows nothing about the
    marker palette. A `mark` export is what the eventual skinned crowd path will
    want instead.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    ob = body.evaluated_get(dg)
    me = ob.to_mesh()

    # Decimate a throwaway copy. 430 000 triangles is a fine thing to look at in
    # Blender and an absurd thing to put in a browser next to a burning
    # coastline.
    tmp = bpy.data.meshes.new_from_object(ob)
    holder = bpy.data.objects.new("export_tmp", tmp)
    bpy.context.collection.objects.link(holder)
    have = sum(len(p.vertices) - 2 for p in tmp.polygons)
    if have > tris:
        bpy.context.view_layer.objects.active = holder
        d = holder.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = tris / have
        bpy.ops.object.modifier_apply(modifier="dec")
    src = holder.data
    src.calc_loop_triangles()
    try:
        src.calc_normals_split()
    except (AttributeError, RuntimeError):
        pass
    col = src.color_attributes.get("prev")

    pos, nrm, cols, idx, lookup = [], [], [], [], {}
    for tri in src.loop_triangles:
        for li in tri.loops:
            vi = src.loops[li].vertex_index
            v = src.vertices[vi]
            n = src.loops[li].normal if src.loops[li].normal.length else v.normal
            c = col.data[vi].color if col else (1.0, 1.0, 1.0, 1.0)
            c8 = tuple(min(255, max(0, int(x * 255 + 0.5))) for x in c[:3])
            # Blender Z-up -> three.js Y-up, exactly as frmesh.export() does it.
            # Leaving this out does not look like a bug in Blender and does not
            # look like a bug in the loader: the figure arrives in the world at
            # the right place, the right size and the right colour, lying flat
            # on her back with half of her under the pavement.
            co = (v.co.x, v.co.z, -v.co.y)
            nv3 = (n.x, n.z, -n.y)
            key = (round(co[0], 5), round(co[1], 5), round(co[2], 5),
                   round(nv3[0], 3), round(nv3[1], 3), round(nv3[2], 3), c8)
            j = lookup.get(key)
            if j is None:
                j = len(pos) // 3
                lookup[key] = j
                pos.extend(co)
                nrm.extend(nv3)
                cols.extend(c8)
            idx.append(j)

    import gzip
    import struct
    nv, ni = len(pos) // 3, len(idx)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    head = struct.pack("<4sIII6f", b"FR3D", 1, nv, ni,
                       min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))
    blob = (head
            + struct.pack("<%df" % (nv * 3), *pos)
            + struct.pack("<%df" % (nv * 3), *nrm)
            + bytes(cols)
            + struct.pack("<%dI" % ni, *idx))
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(blob)
    print("[mh] export %s  %d verts  %d tris  %d bytes gz"
          % (path.name, nv, ni // 3, path.stat().st_size))

    bpy.data.objects.remove(holder, do_unlink=True)
    ob.to_mesh_clear()


# --------------------------------------------------------------------------- #
#  export — skinned (.fr3d v3)                                                 #
# --------------------------------------------------------------------------- #
#
# Blender is Z-up with X forward; three.js is Y-up. Every position, every
# normal and every *matrix* has to cross that boundary, and the matrices are the
# part that is easy to get wrong: a point converts as `CONV @ p`, but a
# transform converts by *conjugation*, `CONV @ M @ CONV^-1`. Get that backwards
# and the rest pose still looks right — it is the animation that comes out
# mirrored, which is a much more expensive thing to discover.
CONV = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
CONV_I = CONV.inverted()

SAMPLE_FPS = 30           # clips are baked, not solved, so this is the quality
MAX_INFLUENCES = 4        # matches vertex_group_limit_total() in skin()


def _rest_locals(rig):
    """[(name, parent index, parent-relative rest matrix)] in game space.

    Ordered parents-before-children, because the runtime composes the hierarchy
    in a single forward pass over this list and never sorts anything.
    """
    order, seen = [], set()

    def visit(b):
        if b.name in seen:
            return
        if b.parent:
            visit(b.parent)
        seen.add(b.name)
        order.append(b)

    for b in rig.data.bones:
        visit(b)

    index = {b.name: i for i, b in enumerate(order)}
    out = []
    for b in order:
        local = (b.parent.matrix_local.inverted() @ b.matrix_local
                 if b.parent else b.matrix_local.copy())
        out.append((b.name, index[b.parent.name] if b.parent else -1,
                    local, CONV @ local @ CONV_I))
    return out


def _quant_q(q):
    """(x, y, z, w) as four int16. Blender hands them back w-first."""
    v = (q.x, q.y, q.z, q.w)
    return tuple(max(-32767, min(32767, int(round(a * 32767)))) for a in v)


def _lerp_pose(a, b, u):
    """Blend two keyframe pose dicts. Missing bones are the rest pose."""
    out = {}
    for k in set(a) | set(b):
        pa, pb = a.get(k, (0.0, 0.0, 0.0)), b.get(k, (0.0, 0.0, 0.0))
        out[k] = tuple(x + (y - x) * u for x, y in zip(pa, pb))
    return out


def _bake_clip(rest, spec):
    """Sample one authored clip to `SAMPLE_FPS` and quantise it.

    Keys are interpolated with a smoothstep rather than linearly. Hand-authored
    poses are sparse — three or four to a second at best — and linear blending
    between them gives every limb a hard change of direction on every key, which
    reads as a puppet being jerked rather than a person moving. The ease costs
    one line and does most of the work that an animator's Bezier handles would.
    """
    keys = spec["keys"]
    dur = keys[-1][0]
    nf = max(2, int(round(dur * SAMPLE_FPS)) + (0 if spec.get("loop", True) else 1))
    frames = []
    prev_q = {}
    for f in range(nf):
        t = (f / nf if spec.get("loop", True) else f / (nf - 1)) * dur
        i = 0
        while i < len(keys) - 2 and keys[i + 1][0] <= t:
            i += 1
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        u = u * u * (3.0 - 2.0 * u)
        blended = _lerp_pose(p0, p1, u)

        root = blended.get("@root", (0.0, 0.0, 0.0))
        # A whole-body rotation about the fore-and-aft axis, in armature space
        # rather than in any bone's space, applied to the root bone so that
        # everything below it comes along. The cartwheel needs it and nothing
        # else does.
        #
        # It cannot be authored on `pelvis` the way the somersault's pitch is.
        # That works because the pelvis bone's local X happens to come out as
        # world −Y exactly, so pelvis X is a clean pitch. Its local Z does not
        # come out as world −X: the bone runs from the hip up to spine-4, which
        # is twenty-seven degrees off vertical, and `align_roll` can only put
        # local Z perpendicular to that. Rolling on it corkscrews her — the
        # first cartwheel here did, and it read as a pinwheel with her hands a
        # third of a metre clear of the deck all the way round.
        #
        # Pre-multiplying in armature space sidesteps the bone's frame
        # entirely. The pivot lands on the hip for free: only the rotation of
        # this matrix survives — `rt` below carries the root bone's position
        # and is not touched by `W` — so the body turns about the root joint,
        # which is where a cartwheel turns.
        roll = blended.get("@roll", (0.0,))[0]
        W = (Matrix.Rotation(math.radians(roll), 4, Vector((-1.0, 0.0, 0.0)))
             if roll else None)
        quats = []
        for bi, (name, _parent, local_b, local_g) in enumerate(rest):
            rot = blended.get(name)
            if rot:
                basis = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
                m = CONV @ (local_b @ basis.to_4x4()) @ CONV_I
            else:
                m = local_g
            if W is not None and bi == 0:
                m = CONV @ W @ CONV_I @ m
            q = m.to_quaternion()
            # Keep the sign continuous along the track. The runtime nlerps
            # between adjacent frames, and a quaternion that flips sign between
            # two frames of a smooth motion takes the short way round the wrong
            # side of the sphere — one frame of the figure inside out.
            p = prev_q.get(bi)
            if p and (q.w * p.w + q.x * p.x + q.y * p.y + q.z * p.z) < 0.0:
                q = Quaternion((-q.w, -q.x, -q.y, -q.z))
            prev_q[bi] = q
            quats.append(_quant_q(q))

        # The root's translation is authored in Blender armature space, so it
        # converts as a point.
        rt = rest[0][3].translation + (CONV @ Vector(root))
        frames.append((tuple(rt), quats))
    return {"name": spec.get("name", "?"), "dur": dur, "loop": spec.get("loop", True),
            "frames": frames}


TIPS = ("handL", "handR", "toeL", "toeR", "footL", "footR", "head")


def _lowest(rig, blended):
    """The lowest hand, foot or head of one blended pose, and which it is.

    Reproduces exactly what the exporter composes: the bones take their authored
    Eulers, the root joint is displaced by `@root`, and the whole body turns
    about that joint by `@roll`.
    """
    root = Vector(blended.get("@root", (0.0, 0.0, 0.0)))
    roll = blended.get("@roll", (0.0,))[0]
    pose(rig, {k: v for k, v in blended.items() if not k.startswith("@")})
    piv = rig.pose.bones[BONES[0][0]].head.copy()
    R = Matrix.Rotation(math.radians(roll), 3, Vector((-1.0, 0.0, 0.0)))
    low = {}
    for b in TIPS:
        if b in rig.pose.bones:
            low[b] = (rig.matrix_world
                      @ (R @ (rig.pose.bones[b].tail - piv) + piv + root)).z
    who = min(low, key=low.get)
    return who, low[who]


def wheel_floor(rig, clear=0.004):
    """Sit every cartwheel key on the deck, and solve for the hip height there.

    The counter-rotations in `_wheel` cancel the roll on paper and do not cancel
    it in the rig, for a reason worth writing down: the roll turns about the
    midline, and her shoulder and hip joints are eleven to eighteen centimetres
    either side of it. Sixty degrees over and the supporting hip has swung nine
    centimetres *down*, taking the leg and the foot with it; two hundred and
    forty degrees over, the supporting shoulder has swung the same distance up,
    taking the planted hand off the floor. The two rotations have different
    pivots, so they cannot cancel, and no choice of limb angle or hip height
    derived from limb lengths can know about it. The first version of this
    buried a toe seventeen centimetres into the concrete and floated a hand a
    third of a metre over it, and looked, in stills, entirely correct.

    So do not author the hip height at all — solve it. Pose the rig at each key,
    find the lowest extremity, and move the key until it is exactly `clear` off
    the deck. Both ways: a cartwheel is a hand-over-hand walk and something is
    touching the ground for all of it, so a limb hanging in space is as wrong as
    a limb through the concrete, and the earlier lift-only rule left her
    hopping thirty-seven centimetres between the last hand and the first foot.

    The `hip` term in `_wheel` still earns its place as the starting guess: the
    closer it starts the less this has to move, and the less the interpolation
    between two keys sags in the middle.

    Recomputed from `_wheel` on every call rather than adjusted in place, so
    running it twice does the same thing as running it once.
    """
    poses = [_wheel(i * 360.0 / WHEEL_KEYS) for i in range(WHEEL_KEYS + 1)]
    worst = floor_poses(rig, poses, clear)
    for i, p in enumerate(poses):
        WHEEL[i] = (i * WHEEL_DUR / WHEEL_KEYS, p)
    print("[mh] cartwheel: floor pass settled, deepest key %+.3f m" % worst)


def floor_poses(rig, poses, clear=0.004, passes=3):
    """Solve `@root` z for a list of poses so each one sits on the deck.

    Lifted out of the cartwheel when the moonwalk turned out to need exactly the
    same thing for exactly the same reason — the anchor leg's knee straightens
    12° across the glide, which changes its length, and no hip height authored
    as a constant can be right at both ends of that. It went ten centimetres
    through the concrete in the middle and two and a half above it at the swap.

    Modifies the poses in place and returns the deepest point left.
    """
    solved = []
    for p in poses:
        _who, z = _lowest(rig, p)
        solved.append(p.get("@root", (0.0, 0.0, 0.0))[2] + clear - z)

    # Then smooth the answer. Solved key by key it is not a curve, it is a
    # staircase: the pass pins whichever limb is lowest, and on the frames where
    # that changes hands — literally, in the cartwheel — the hip height it asks
    # for jumps as much as thirty centimetres between adjacent keys. Held
    # exactly, her hips snap twice a wheel. Three passes of a
    # quarter-half-quarter filter turns it back into something a body could do,
    # at a cost of a centimetre or two of foot through concrete, which at five
    # metres is nothing and a snapping pelvis never is. The ends are held: on
    # both clips that uses this, those two are the same pose.
    #
    # `passes=0` turns it off, and the two one-shots in the firestarter want
    # that. The filter is there because a *sampled* clip's staircase is an
    # artefact of solving frame by frame; on five hand-placed keys two tenths of
    # a second apart the staircase is the animation — she crouches and her hips
    # go down — and smoothing it is smoothing away the pose.
    for _pass in range(passes):
        smoothed = list(solved)
        for i in range(1, len(solved) - 1):
            smoothed[i] = 0.25 * solved[i - 1] + 0.5 * solved[i] + 0.25 * solved[i + 1]
        solved = smoothed

    worst = 0.0
    for i, p in enumerate(poses):
        root = list(p.get("@root", (0.0, 0.0, 0.0)))
        root[2] = solved[i]
        p["@root"] = tuple(root)
        _who, z = _lowest(rig, p)
        worst = min(worst, z)
    return worst


def dance_floor(rig, clear=0.004):
    """The same pass for the two dances, which have no roll and no hands down.

    Both are sampled from a continuous function rather than hand-keyed, for the
    reason `_wheel_half` gives: `_bake_clip` eases *within* every key interval,
    so anything authored as four or five keys arrives as four or five lurches
    with the rate going to zero between them. It also means the floor solve has
    keys close enough together to be worth running — solved at five keys, the
    moonwalk's deepest point sits in the middle of an interval where nothing was
    measured.
    """
    poses = [_shimmy_at(i / SHIMMY_KEYS) for i in range(SHIMMY_KEYS + 1)]
    worst = floor_poses(rig, poses, clear)
    for i, p in enumerate(poses):
        SHIMMY[i] = (i * SHIMMY_DUR / SHIMMY_KEYS, p)
    print("[mh] shimmy: floor pass settled, deepest key %+.3f m" % worst)

    poses = [_moon_at(i / MOON_KEYS) for i in range(MOON_KEYS + 1)]
    worst = floor_poses(rig, poses, clear)
    for i, p in enumerate(poses):
        MOON[i] = (i * MOON_DUR / MOON_KEYS, p)
    print("[mh] moonwalk: floor pass settled, deepest key %+.3f m" % worst)


def fire_floor(rig, clear=0.004):
    """The floor pass for the turn: one sampled loop and two hand-keyed one-shots.

    None of the three is filtered, which is the opposite of what the two dances
    want and worth saying why. The filter is there for clips where the support
    hands between limbs — the cartwheel, where it changes four times a turn —
    because the solve jumps when it does and the jump is an artefact. This is a
    march: one foot is down at all times, both are down at the two footfalls,
    and at those two frames the legs are the same length, so there is no
    handover to smooth. What the filter *would* remove is the bounce, which is
    two keys wide and is the only reason the hips move at all. It took it from
    four centimetres to two the first time round.

    All three end (and `cast` also begins) on `_fire_at(0)`, which is a separate
    dict each time it is called and therefore solved separately three times. It
    lands on the same number three times because it is the same pose, and that
    is what lets the game cut between them without her hips stepping.
    """
    poses = [_fire_at(i / FIRE_KEYS) for i in range(FIRE_KEYS + 1)]
    worst = floor_poses(rig, poses, clear, passes=0)
    for i, p in enumerate(poses):
        FIRE[i] = (i * FIRE_DUR / FIRE_KEYS, p)
    lo = min(p["@root"][2] for p in poses)
    hi = max(p["@root"][2] for p in poses)
    print("[mh] firestarter: deepest %+.3f m, hips travel %.3f m" % (worst, hi - lo))

    for name, clip in (("flare", FLARE), ("cast", CAST)):
        worst = floor_poses(rig, [p for _t, p in clip], clear, passes=0)
        print("[mh] %s: deepest %+.3f m" % (name, worst))


def skip_floor(rig, clear=0.004):
    """Put the skip's two contacts on the deck and lift its two floats off it.

    Not `floor_poses`, and the difference is the whole point of the clip: that
    one wants every key on the ground, and half of these are meant to be in the
    air. Nor can it be smoothed the way that one is — the staircase in the hip
    height *is* the bounce here, and filtering it out leaves a walk.

    So: solve the contacts, run the baseline between them, and lift the floats
    their authored rise above that line. The rise is what it looks like — how
    far off the deck she takes her hips — and the daylight under the trailing
    foot comes out larger, because a folded leg holds its toe up on its own.
    Nothing is allowed below `clear`, and a float that would still scrape is
    lifted until it does not: the authored rise is a floor, not a ceiling.
    """
    # Where each key's lowest extremity sits with the hips at nominal. The
    # contacts are the keys with no rise on them.
    nat = [_lowest(rig, p)[1] for _h, p in SKIP_HALF]
    con = [i for i, k in enumerate(SKIP_KEYS) if k[1] == 0.0]
    if len(con) != 2:
        sys.exit("[mh] the skip wants exactly two contacts a half-cycle")
    a, b = con
    za, zb = clear - nat[a], clear - nat[b]

    def base(h):
        """The line the hips would run along if she never left the deck.

        Between the two contacts of this half-cycle, and then on from the second
        of them to the first contact of the next — which is this one's mirror,
        so it is back at `za` again.
        """
        ha, hb = SKIP_KEYS[a][0], SKIP_KEYS[b][0]
        if h <= hb:
            return za + (zb - za) * (h - ha) / (hb - ha)
        return zb + (za - zb) * (h - hb) / (1.0 + ha - hb)

    hips = []
    for i, (h, rise, *_rest) in enumerate(SKIP_KEYS):
        z = base(h) + rise
        # A float whose lowest foot would still scrape gets lifted until it
        # does not. The authored rise is a floor, not a ceiling.
        hips.append(max(z, clear - nat[i]))

    for i, z in enumerate(hips):
        for p in (SKIP_HALF[i][1],):
            p["@root"] = (p["@root"][0], p["@root"][1], z)
    # And rebuild the cycle around the corrected half, mirror and closing key
    # included, since all three are the same dictionaries seen from elsewhere.
    SKIP[:] = ([(h * SKIP_DUR / 2.0, p) for h, p in SKIP_HALF]
               + [((1.0 + h) * SKIP_DUR / 2.0, _mirror(p)) for h, p in SKIP_HALF]
               + [(SKIP_DUR, SKIP_HALF[0][1])])
    print("[mh] skip: hips %s, contacts at %+.3f/%+.3f"
          % (" ".join("%+.3f" % z for z in hips), za, zb))


def clipcheck(rig, name):
    """Per-frame ground clearance for one clip, printed.

    Every clip in this file is authored as joint angles plus a hip height, and
    nothing in that representation knows where the floor is. This walks the
    baked frames, poses the rig at each one and reports how far the lowest
    hand, foot or head sits above z = 0 — the deck she is standing on.

    It exists because a pose that floats ten centimetres and a pose that saws
    through the concrete render identically well as stills, from any angle, and
    both are obvious the instant she moves. For the sagittal clips you can get
    away with eyeballing it. For a cartwheel, where the support hands off
    between four limbs and the hips rise fifteen centimetres in the middle, you
    cannot.
    """
    spec = next(c for c in CLIPS if c["name"] == name)
    keys, loop = spec["keys"], spec.get("loop", True)
    dur = keys[-1][0]
    nf = max(2, int(round(dur * SAMPLE_FPS)) + (0 if loop else 1))
    print("[mh] %s: %d frames over %.2f s" % (name, nf, dur))
    worst = 0.0
    for f in range(nf):
        t = (f / nf if loop else f / (nf - 1)) * dur
        i = 0
        while i < len(keys) - 2 and keys[i + 1][0] <= t:
            i += 1
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        u = u * u * (3.0 - 2.0 * u)
        blended = _lerp_pose(p0, p1, u)
        who, z = _lowest(rig, blended)
        worst = min(worst, z)
        print("  t=%5.2f  roll%+7.1f  hip%+.3f   lowest %-5s %+.3f"
              % (t, blended.get("@roll", (0.0,))[0],
                 blended.get("@root", (0.0, 0.0, 0.0))[2], who, z))
    print("[mh] %s: deepest %+.3f m" % (name, worst))


def export_skin(body, rig, path, clips, tris=26000):
    """Write the figure as a .fr3d **v3** blob: mesh, skeleton and clips.

    v1 froze the armature into the vertices, which is why the promenade got a
    statue. This carries the four bone influences per vertex that `skin()`
    already caps the weights to, the rest skeleton, and every clip baked to
    quaternions — and from there the browser can put her in any pose the rig can
    reach, for about the same number of bytes as the one pose cost.

    The cartwheel's floor pass runs here rather than at any of the four call
    sites above it, because this is the one gate everything that ships goes
    through, and a clip that has not had it is a clip with a foot in the
    concrete. It is idempotent, and cheap next to the decimator below.

    The mesh is exported in the **bind** pose, so the rig has to be at rest when
    this runs or every vertex is deformed twice.
    """
    rest = _rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}

    wheel_floor(rig)
    dance_floor(rig)
    skip_floor(rig)
    fire_floor(rig)

    # Duplicate the *object*, not the evaluated mesh.
    #
    # `new_from_object` is what export_static uses and it is right for a frozen
    # pose, but it returns bare mesh data and the bone weights do not survive the
    # trip — the first run of this exporter wrote thirteen thousand vertices with
    # no influence at all, which in the browser is a figure collapsed to a point
    # at the origin. An object duplicate carries `vertex_groups` with it, and
    # since smooth() already applied the subsurf the only modifier left on the
    # body is the armature, so the duplicate's mesh data *is* the bind shape.
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    holder = bpy.context.view_layer.objects.active
    holder.name = "export_tmp"
    for m in list(holder.modifiers):
        holder.modifiers.remove(m)
    gname = {i: g.name for i, g in enumerate(holder.vertex_groups)}
    have = sum(len(p.vertices) - 2 for p in holder.data.polygons)
    if have > tris:
        d = holder.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = tris / have
        bpy.ops.object.modifier_apply(modifier="dec")
    src = holder.data
    src.calc_loop_triangles()
    try:
        src.calc_normals_split()
    except (AttributeError, RuntimeError):
        pass
    col = src.color_attributes.get("prev")

    def weights(vi):
        """Four (bone, weight) pairs as bytes summing to exactly 255.

        Exactly, not approximately: the shader adds four bone matrices scaled by
        these and does not renormalise, so a vertex whose weights come to 0.99
        is a vertex that shrinks towards the origin of the world every frame.
        """
        gs = [(g.weight, bindex[gname[g.group]])
              for g in src.vertices[vi].groups
              if g.group in gname and gname[g.group] in bindex and g.weight > 0]
        if not gs:
            return (0, 0, 0, 0), (255, 0, 0, 0)
        gs.sort(reverse=True)
        gs = gs[:MAX_INFLUENCES]
        tot = sum(w for w, _ in gs)
        q = [max(0, min(255, int(round(w / tot * 255)))) for w, _ in gs]
        q[0] += 255 - sum(q)
        idx = [b for _, b in gs] + [0] * (MAX_INFLUENCES - len(gs))
        q += [0] * (MAX_INFLUENCES - len(q))
        return tuple(idx), tuple(q)

    pos, nrm, cols, bidx, bwgt, idx, lookup = [], [], [], [], [], [], {}
    wcache, orphans = {}, 0
    for tri in src.loop_triangles:
        for li in tri.loops:
            vi = src.loops[li].vertex_index
            v = src.vertices[vi]
            n = src.loops[li].normal if src.loops[li].normal.length else v.normal
            c = col.data[vi].color if col else (1.0, 1.0, 1.0, 1.0)
            c8 = tuple(min(255, max(0, int(x * 255 + 0.5))) for x in c[:3])
            if vi not in wcache:
                wcache[vi] = weights(vi)
                if not src.vertices[vi].groups:
                    orphans += 1
            wi, ww = wcache[vi]
            co = (v.co.x, v.co.z, -v.co.y)
            nv3 = (n.x, n.z, -n.y)
            # The weights go in the dedupe key as well as the geometry. Two
            # vertices that agree on position, normal and colour but not on
            # which bone owns them are two vertices, and merging them welds a
            # seam shut across a joint.
            key = (round(co[0], 5), round(co[1], 5), round(co[2], 5),
                   round(nv3[0], 3), round(nv3[1], 3), round(nv3[2], 3), c8, wi, ww)
            j = lookup.get(key)
            if j is None:
                j = len(pos) // 3
                lookup[key] = j
                pos.extend(co)
                nrm.extend(nv3)
                cols.extend(c8)
                bidx.extend(wi)
                bwgt.extend(ww)
            idx.append(j)

    baked = [_bake_clip(rest, c) for c in clips]

    import gzip
    import struct
    nv, ni = len(pos) // 3, len(idx)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    parts = [struct.pack("<4sIII6f", b"FR3D", 3, nv, ni,
                         min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)),
             struct.pack("<%df" % (nv * 3), *pos),
             struct.pack("<%df" % (nv * 3), *nrm),
             bytes(cols), bytes(bidx), bytes(bwgt)]
    # Pad so the index array lands 4-byte aligned and the loader can take a
    # view on it rather than copying half a megabyte.
    pad = (-sum(len(p) for p in parts)) % 4
    parts.append(b"\0" * pad)
    parts.append(struct.pack("<%dI" % ni, *idx))

    parts.append(struct.pack("<I", len(rest)))
    for name, parent, _local_b, local_g in rest:
        nb = name.encode()
        t = local_g.translation
        q = local_g.to_quaternion()
        parts.append(struct.pack("<H%dsi7f" % len(nb), len(nb), nb, parent,
                                 t.x, t.y, t.z, q.x, q.y, q.z, q.w))

    parts.append(struct.pack("<I", len(baked)))
    for c in baked:
        nb = c["name"].encode()
        parts.append(struct.pack("<H%dsfIB3x" % len(nb), len(nb), nb,
                                 c["dur"], len(c["frames"]), 1 if c["loop"] else 0))
        for rt, quats in c["frames"]:
            parts.append(struct.pack("<3f", *rt))
            for q in quats:
                parts.append(struct.pack("<4h", *q))

    blob = b"".join(parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(blob)
    print("[mh] skin %s  %d verts  %d tris  %d bones  %d clips  %d bytes gz"
          % (path.name, nv, ni // 3, len(rest), len(baked), path.stat().st_size))
    for c in baked:
        print("[mh]   clip %-9s %5.2f s  %3d frames  %s"
              % (c["name"], c["dur"], len(c["frames"]),
                 "loop" if c["loop"] else "once"))
    if orphans:
        print("[mh]   WARNING %d vertices had no bone weight at all" % orphans)

    bpy.data.objects.remove(holder, do_unlink=True)


# --------------------------------------------------------------------------- #
#  posing and previews                                                         #
# --------------------------------------------------------------------------- #

def pose(rig, spec):
    """`spec` is {bone: (rx, ry, rz)} in degrees, bone-local XYZ Euler.

    With the rolls named, +X swings a limb's far end backward on every bone and
    the two sides mirror in sign.
    """
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for b in rig.pose.bones:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
    for name, rot in spec.items():
        if name in rig.pose.bones:
            rig.pose.bones[name].rotation_euler = \
                tuple(math.radians(a) for a in rot)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


STRIDE = {
    "spine01": (-3, -5, 0), "spine02": (-2, -4, 0), "spine03": (-1, -3, 0),
    "chest": (-1, -3, 0), "neck": (2, 7, 0), "head": (1, 10, 0),
    "armUL": (-30, 0, 20), "armLL": (-34, 0, 0), "handL": (-8, 0, 0),
    "armUR": (26, 0, -20), "armLR": (-18, 0, 0), "handR": (6, 0, 0),
    "legUR": (-26, 0, 0), "legLR": (6, 0, 0), "footR": (12, 0, 0),
    "legUL": (17, 0, 0), "legLL": (38, 0, 0), "footL": (-22, 0, 0),
    "toeL": (22, 0, 0),
}

# --------------------------------------------------------------------------- #
#  clips                                                                       #
# --------------------------------------------------------------------------- #
#
# A pose is `{bone: (rx, ry, rz)}` in degrees, plus an optional `@root` offset in
# metres. A clip is a list of (time, pose) keys, sampled at SAMPLE_FPS on export.
#
# Signs, once, so none of this has to be re-derived: with the rolls named in
# ROLL_UP, **+X swings a limb's far end backward** on every up-or-down bone, and
# the two sides mirror in sign on Y and Z. +Z on the pelvis lifts her right hip.
#
# Nothing here is a walk cycle yet. This is the pipeline's proof: if she stands
# on the promenade breathing, shifting her weight and looking around, then the
# rig, the weights, the quaternion bake and the shader all agree with each other,
# and every clip after this one is content rather than engineering.

# Relaxed stand, weight on the left leg. A figure with both knees locked and both
# arms straight down reads as a mannequin no matter how good the mesh is; the
# whole difference is a couple of degrees of contrapposto.
#
# The arms are the part that has to be *large*. The MakeHuman base stands in an
# A-pose with the upper arms 40° out from the body, so a couple of degrees of
# idle offset leaves a figure holding her arms out like a scarecrow — which is
# what the first pass shipped, and it read as a mannequin however much the ribs
# were breathing. Twenty-nine degrees of adduction a side is what puts her hands
# where a standing person's hands are. Sign: on the right arm +Z abducts, and
# the two sides mirror.
IDLE_A = {
    "@root": (0.000, 0.020, -0.006),
    "pelvis": (0, 0, -2.5),
    "spine01": (0, 0, 1.0), "spine02": (0, 0, 1.0), "spine03": (-1, 0, 0.5),
    "chest": (-1.5, 0, 0), "neck": (2, 0, 0), "head": (-1, -3, 1),
    "armUL": (-6, 0, 29), "armLL": (-14, 0, 4), "handL": (-4, 0, 0),
    "armUR": (-4, 0, -29), "armLR": (-11, 0, -4), "handR": (-4, 0, 0),
    "legLL": (1, 0, 0),
    "legUR": (-4, 3, 0), "legLR": (7, 0, 0), "footR": (-3, 0, 0),
}

# Same stance, breath in, head come round the other way.
IDLE_B = {
    "@root": (0.004, 0.014, 0.000),
    "pelvis": (0, 0, -1.5),
    "spine01": (0, 0, 0.5), "spine02": (0, 0, 0.5), "spine03": (-2, 0, 0),
    "chest": (-3.0, 0, 0), "neck": (3, 0, 0), "head": (-2, 4, -1),
    "armUL": (-3, 0, 27), "armLL": (-11, 0, 4), "handL": (-3, 0, 0),
    "armUR": (-1, 0, -27), "armLR": (-8, 0, -4), "handR": (-3, 0, 0),
    "legUR": (-3, 3, 0), "legLR": (6, 0, 0), "footR": (-3, 0, 0),
}

# Right arm up. Big angles, on purpose: this one exists so that a single
# screenshot from a kilometre away settles whether the bones reach the browser.
WAVE_UP = dict(IDLE_A, **{
    "clavicleR": (0, 0, -12),
    "armUR": (-16, 0, 96), "armLR": (-28, 34, 0), "handR": (0, 0, -14),
    "chest": (-2, -5, 0), "head": (-2, -8, 2),
})
WAVE_OUT = dict(WAVE_UP, **{"armLR": (-24, 34, 30), "handR": (0, 0, 12)})

# She notices you. Head up and round, a breath in, shoulders back — the whole
# thing is three quarters of a second and it is what turns a figure standing on
# the promenade into somebody who has seen you coming.
NOTICE = dict(IDLE_A, **{
    "@root": (0.000, 0.026, 0.010),
    "spine03": (-4, 0, 0.5), "chest": (-6, 0, 0), "neck": (7, 0, 0),
    "head": (4, 16, 1),
    "clavicleL": (0, 0, 5), "clavicleR": (0, 0, -5),
    "armUL": (-14, 0, 33), "armLL": (-26, 0, 4),
    "armUR": (-12, 0, -33), "armLR": (-23, 0, -4),
})

# ── on all fours ────────────────────────────────────────────────────────────
#
# Every limb hangs off the pelvis, so tipping the torso down to put the
# shoulders over the hands takes the thighs and the upper arms with it, and the
# first thing that has to happen at every hip and every shoulder is to undo the
# pelvis before the real joint angle is applied. Pose this the obvious way — drop
# the torso, then bend the knees — and you get a diver, not a crawler.
#
# The cancellation takes the *same* sign as the pelvis, which looks wrong and is
# not, and cost a render to find out. ROLL_UP names local Z as world −X on every
# up-or-down bone, so local Y is the bone's own direction and local X falls out
# as Y × Z: the pelvis points up and gets local X = −Y_world, while a thigh or an
# upper arm points down and gets local X = **+Y_world**. The two are opposite
# axes. So a pelvis rotation of `a` and a hip rotation of `b` compose in the
# world as `b − a`, and the thigh's forward angle is `a − b` — zero when b = a,
# not when b = −a. Posed with the sign the intuition wants, she folds into a bow:
# torso face-down, and all four limbs sticking up off her back.
#
# With that fixed the geometry is arithmetic. Hip and shoulder both want to be
# about 0.51 m up with the torso horizontal between them, the thigh is 0.45 m and
# the arm 0.52 m, so the pelvis tips until the spine is level (96° less the 6°
# the back arches), the hips and shoulders take −96 to hang the limbs straight
# down, and the knees fold 90° to lay the shins along the floor.
DOWN = 96

FOURS = {
    "@root": (0.0, 0.0, -0.44),
    "pelvis": (-DOWN, 0, 0),
    "spine01": (2, 0, 0), "spine02": (2, 0, 0), "spine03": (1, 0, 0),
    "chest": (1, 0, 0), "neck": (24, 0, 0), "head": (24, 0, 0),
    "clavicleL": (0, 0, 8), "clavicleR": (0, 0, -8),
    "armUL": (-DOWN, 0, 22), "armLL": (-6, 0, 2), "handL": (-70, 0, 0),
    "armUR": (-DOWN, 0, -22), "armLR": (-6, 0, -2), "handR": (-70, 0, 0),
    "legUL": (-DOWN, 0, 5), "legLL": (90, 0, 0), "footL": (-14, 0, 0),
    "legUR": (-DOWN, 0, -5), "legLR": (90, 0, 0), "footR": (-14, 0, 0),
}


def _fours(**kw):
    p = dict(FOURS)
    p.update(kw)
    return p


# A diagonal gait — near-fore with off-hind, which is what every quadruped and
# every crawling child does, and the reason it does not fall over.
CRAWL_A = _fours(
    pelvis=(-DOWN, 0, -6), spine01=(2, 0, 4), chest=(1, 0, 5), head=(24, -12, 0),
    armUL=(-DOWN - 30, 0, 20), armLL=(-24, 0, 2), handL=(-42, 0, 0),
    armUR=(-DOWN + 12, 0, -24), armLR=(-4, 0, -2),
    legUR=(-DOWN - 22, 0, -8), legLR=(72, 0, 0),
    legUL=(-DOWN + 20, 0, 4), legLL=(102, 0, 0),
)
CRAWL_B = _fours(
    pelvis=(-DOWN, 0, 6), spine01=(2, 0, -4), chest=(1, 0, -5), head=(24, 12, 0),
    armUR=(-DOWN - 30, 0, -20), armLR=(-24, 0, -2), handR=(-42, 0, 0),
    armUL=(-DOWN + 12, 0, 24), armLL=(-4, 0, 2),
    legUL=(-DOWN - 22, 0, 8), legLL=(72, 0, 0),
    legUR=(-DOWN + 20, 0, -4), legLR=(102, 0, 0),
)

# Up on the knees, hands off the floor. Kneeling is thighs vertical and shins
# folded back along the ground, so the hips come back to *rest* — the thigh
# already points straight down — and the whole angle is at the knee.
KNEEL = {
    "@root": (0.0, -0.02, -0.45),
    "pelvis": (-8, 0, 0),
    "spine01": (2, 0, 0), "spine02": (2, 0, 0), "spine03": (0, 0, 0),
    "chest": (-3, 0, 0), "neck": (3, 0, 0), "head": (-2, 0, 0),
    "armUL": (-20, 0, 34), "armLL": (-46, 0, 6), "handL": (-6, 0, 0),
    "armUR": (-20, 0, -34), "armLR": (-46, 0, -6), "handR": (-6, 0, 0),
    "legUL": (-8, 0, 5), "legLL": (82, 0, 0), "footL": (-16, 0, 0),
    "legUR": (-8, 0, -5), "legLR": (82, 0, 0), "footR": (-16, 0, 0),
}

# One foot planted ahead, the other knee still down: the half-kneel everybody
# actually passes through on the way up off the floor.
LUNGE = {
    "@root": (0.0, -0.06, -0.33),
    "pelvis": (-16, 0, -3),
    "spine01": (3, 0, 0), "spine02": (3, 0, 0), "spine03": (2, 0, 0),
    "chest": (2, 0, 0), "neck": (6, 0, 0), "head": (2, 0, 0),
    "armUL": (-30, 0, 30), "armLL": (-56, 0, 6), "handL": (-6, 0, 0),
    "armUR": (-14, 0, -32), "armLR": (-34, 0, -6), "handR": (-6, 0, 0),
    "legUL": (-62, 0, 5), "legLL": (62, 0, 0), "footL": (-14, 0, 0),
    "legUR": (4, 0, -5), "legLR": (104, 0, 0), "footR": (-18, 0, 0),
}

# ── the somersault ──────────────────────────────────────────────────────────
#
# One tucked front somersault, and the entire revolution is carried on `pelvis`
# alone: its X runs 0 → −360 across the middle of the clip. That works only
# because `_lerp_pose` blends the authored *degrees*. A quaternion track cannot
# hold more than half a turn between two keys — it always takes the short way
# round — so a full revolution has to exist as a number before it is ever baked,
# and the bake then samples it at 30 fps where no two adjacent frames are more
# than about fifteen degrees apart.
#
# The consequence is the one thing in this file that looks like a typo and is
# not: the clip's last key holds `pelvis` at −360, not at 0. They are the same
# attitude and the same quaternion, and a key at 0 makes the interpolator unwind
# the whole revolution backwards in a fifth of a second.
#
# The turn pivots on the root bone's head, which is the hip joint, and that is
# within a few centimetres of where a tucked gymnast's centre of mass actually
# is — so the arc in `@root` is a real ballistic arc rather than a fudge for
# rotating about the wrong point.

# Hip 0.71 m up, thigh 45° forward of vertical, and the shin taking the ankle
# back to the floor at 42° — which puts her feet under her centre rather than out
# in front of it, and is the difference between a squat and sitting down.
CROUCH = {
    "@root": (0.0, 0.02, -0.24),
    "pelvis": (-22, 0, 0),
    "spine01": (0, 0, 0), "spine02": (1, 0, 0), "spine03": (2, 0, 0),
    "chest": (3, 0, 0), "neck": (10, 0, 0), "head": (6, 0, 0),
    "armUL": (33, 0, 20), "armLL": (-22, 0, 4), "handL": (-8, 0, 0),
    "armUR": (33, 0, -20), "armLR": (-22, 0, -4), "handR": (-8, 0, 0),
    "legUL": (-67, 0, 5), "legLL": (87, 0, 0), "footL": (-30, 0, 0),
    "legUR": (-67, 0, -5), "legLR": (87, 0, 0), "footR": (-30, 0, 0),
}

# The throw: arms up and over, legs driving straight, and the hips already
# turning. Everything after this is ballistic.
LAUNCH = {
    "@root": (0.0, 0.02, 0.12),
    "pelvis": (-12, 0, 0),
    "spine01": (-3, 0, 0), "spine02": (-3, 0, 0), "spine03": (-2, 0, 0),
    "chest": (-5, 0, 0), "neck": (4, 0, 0), "head": (2, 0, 0),
    "armUL": (-150, 0, 14), "armLL": (-10, 0, 2), "handL": (0, 0, 0),
    "armUR": (-150, 0, -14), "armLR": (-10, 0, -2), "handR": (0, 0, 0),
    "legUL": (-12, 0, 3), "legLL": (4, 0, 0), "footL": (-26, 0, 0),
    "legUR": (-12, 0, -3), "legLR": (4, 0, 0), "footR": (-26, 0, 0),
}


def _tuck(deg, up):
    """Knees to chest at `deg` through the turn, hips `up` metres off rest."""
    return {
        "@root": (0.0, 0.02, up),
        "pelvis": (deg, 0, 0),
        "spine01": (-14, 0, 0), "spine02": (-14, 0, 0), "spine03": (-12, 0, 0),
        "chest": (-16, 0, 0), "neck": (-18, 0, 0), "head": (-12, 0, 0),
        "clavicleL": (0, 0, 10), "clavicleR": (0, 0, -10),
        "armUL": (-62, 0, 26), "armLL": (-108, 0, 8), "handL": (-22, 0, 0),
        "armUR": (-62, 0, -26), "armLR": (-108, 0, -8), "handR": (-22, 0, 0),
        "legUL": (-120, 0, 8), "legLL": (130, 0, 0), "footL": (-28, 0, 0),
        "legUR": (-120, 0, -8), "legLR": (130, 0, 0), "footR": (-28, 0, 0),
    }


TUCK = _tuck(-180, 0.46)      # the one that gets rendered, halfway over

# Feet under her again, absorbing. Note the pelvis: see above.
LAND = {
    "@root": (0.0, 0.02, -0.18),
    "pelvis": (-360 - 14, 0, 0),
    "spine01": (3, 0, 0), "spine02": (3, 0, 0), "spine03": (3, 0, 0),
    "chest": (4, 0, 0), "neck": (7, 0, 0), "head": (3, 0, 0),
    "armUL": (-46, 0, 8), "armLL": (-34, 0, 4), "handL": (-6, 0, 0),
    "armUR": (-46, 0, -8), "armLR": (-34, 0, -4), "handR": (-6, 0, 0),
    "legUL": (-49, 0, 6), "legLL": (70, 0, 0), "footL": (-26, 0, 0),
    "legUR": (-49, 0, -6), "legLR": (70, 0, 0), "footR": (-26, 0, 0),
}

SETTLE = dict(IDLE_A, pelvis=(-360, 0, -2.5))

# ── shared pose helpers ────────────────────────────────────────────────────
#
# Both of these are used by nearly every clip below — the skip, the
# cartwheel, the shimmy and the moonwalk all ease between keys, and all four
# write one side of the body and reflect the other — so they sit above the
# clips rather than inside whichever one happened to need them first.


def _ease(x):
    x = 0.0 if x < 0 else (1.0 if x > 1 else x)
    return x * x * (3.0 - 2.0 * x)


def _mirror(p):
    """One attitude, reflected through her sagittal plane.

    Which is exactly what the back half of a cartwheel is. Rolling from a
    hundred and eighty round to three-sixty is the front half over again with
    the right hand and the right foot doing what the left ones did, so it is
    written once and reflected rather than tuned twice. The exit is then as good
    as the entry by construction — and the exit is precisely where every earlier
    version of this fell apart, because nothing was forcing the two to agree.

    Signs: the sagittal channel X survives a left-right reflection untouched,
    while Y and Z both flip, which is the same mirroring rule the rest of this
    file uses when it writes a symmetric pose as `+n` on the left and `−n` on
    the right.
    """
    out = {}
    for k, v in p.items():
        if k == "@roll":
            out[k] = (-v[0] % 360.0,)
        elif k == "@root":
            out[k] = (v[0], -v[1], v[2])
        elif k[-1] in "LR":
            out[k[:-1] + ("R" if k[-1] == "L" else "L")] = (v[0], -v[1], -v[2])
        else:
            out[k] = (v[0], -v[1], -v[2])
    return out


# ── skipping ────────────────────────────────────────────────────────────────
#
# A step-hop, which is what a skip is and what this was not.
#
# The old clip had one contact per foot: land left, float, land right, float,
# evenly spaced. That is a bound — a deer clearing a fence, twice a second, for
# four hundred metres of promenade. A skip puts *two* contacts on the same foot
# before it changes over: you step onto the left, you hop on that same left
# foot, and only then do you stride onto the right. The doubled beat is the
# whole difference between the two gaits, and it is what "like a horse" means:
# the step and its hop fall close together and the stride that follows is long,
# so the footfalls come da-dum ... da-dum ... rather than da ... da ... da.
#
# Which is why the key times below are uneven, and why that is the load-bearing
# part rather than a detail. The two contacts of a half-cycle are at 0 and 0.34
# and the next one is at 1.0; every other number here hangs off those three.
# Spacing them evenly is precisely the mistake that made the old one a bound.
#
# The bounce lives in `@root`, as it did before — a skip that keeps its hips at
# a constant height is a walk with the knees raised — but there are now two
# floats to a half-cycle rather than one, and they are deliberately different
# sizes. The hop is a small one, 5 cm; the stride that follows it is 10.5 cm and
# is the part anybody watching is actually looking at.
#
# Those two are the only heights authored here, and they are heights *above the
# deck*, not hip displacements. The hip displacement that puts a reaching foot
# on the concrete is not a number anybody can guess: the first pass at this one
# guessed, and got a hop nine centimetres through the deck on one beat and a
# step hanging seven above it on the next. `skip_floor` solves it instead, the
# way `wheel_floor` and `dance_floor` already do for the cartwheel and the
# dances — the contacts are put on the deck and the floats are lifted off the
# line between them.
#
# Only the left-supporting half is written. The right-supporting half is that
# one reflected, which is what makes the two sides agree by construction and
# what fixes the seam: continuity across it requires the arm swing to arrive at
# minus its starting value, and it does, because the arms have exactly reversed
# by then. See `_mirror`.


def _skip_pose(up, sup, fre, arm, lift):
    """One key of the half-cycle that steps and hops on the left foot.

    `up` is the body's height off nominal, and is written by `skip_floor` rather
    than authored. `sup` and `fre` are (hip, knee, ankle) for the supporting leg
    and the free one. `arm` is the left arm's swing, negative behind her and
    positive in front. `lift` is how far both arms are carried out from the
    body, which rises on the float.
    """
    return {
        "@root": (0.0, 0.0, up),
        "pelvis": (-4, 0, -5),
        "spine01": (-2, 0, 2), "spine02": (-2, 0, 2), "spine03": (-3, 0, 1),
        "chest": (-5, 0, 0), "neck": (4, 0, 0), "head": (-3, -10, 2),
        "clavicleL": (0, 0, 4), "clavicleR": (0, 0, -4),
        # Opposition, as in any gait: the arm across from the leg that is
        # reaching forward goes forward with it, and the other one goes back.
        #
        # `back` is the word doing the work. The first pass swung the shoulders
        # ±40 with the elbows folded 46° and the arms carried 34° out from the
        # body, and the sum of those three was that neither hand ever got behind
        # her hip — both stayed out in front at chest height for the whole cycle,
        # palms down, like somebody carrying a tray of drinks through a crowd.
        # Wider swing, straighter elbows, arms held closer in.
        "armUL": (-arm, 0, 14 + lift), "armLL": (-34, 0, 4), "handL": (-8, 0, 0),
        "armUR": (arm, 0, -14 - lift), "armLR": (-34, 0, -4), "handR": (-8, 0, 0),
        "legUL": (sup[0], 0, 4), "legLL": (sup[1], 0, 0), "footL": (sup[2], 0, 0),
        "legUR": (fre[0], 0, -4), "legLR": (fre[1], 0, 0), "footR": (fre[2], 0, 0),
    }


SKIP_DUR = 0.80           # one cycle: step-hop on the left, step-hop on the right

# h is the fraction through the half-cycle. The three moments that matter are
# the step contact at 0.00, the hop contact at 0.34 and the next step contact at
# 1.00, which is the mirrored 0.00; the other two keys are the apexes of the two
# floats between them.
#
# `rise` is metres of daylight under her lowest foot, so a contact is a zero and
# nothing else in the table is. The legs at the contacts are near enough
# straight, because that is what a leg does when it is holding a body up; the
# folded ones are the airborne keys.
#
# The ankle at the two contacts is not free. Every bone in the leg turns about
# the same world axis, so flexing the hip forward carries the shin and the foot
# with it and pitches the sole toe-down by the same amount the thigh moved: a
# foot left at zero on a leg reaching 22° forward is a foot driven 22° into the
# concrete, toe first. Flat costs `ankle = hip + knee − 1.3`, measured across
# six poses and good to a quarter of a degree over the range used here.
#
# It matters more than it sounds. `skip_floor` will happily solve a buried toe
# by hoisting her entire body eight centimetres, silently, and what comes back
# is a pogo stick rather than a bounce — which is exactly what the first pass at
# this did. The airborne keys sit a little below flat, which is a pointed toe.
SKIP_KEYS = [
    #  h    rise    support leg     free leg      arm  lift
    (0.00, 0.000, (-22, 6, -17), (24, 46, 48), -55, 4),    # the step lands flat
    (0.19, 0.050, (-4, 22, 4), (-20, 78, 42), -30, 12),    # the hop, floating
    (0.34, 0.000, (0, 12, 11), (-42, 96, 40), -6, 10),     # and landing again
    (0.66, 0.105, (20, 44, 44), (-50, 82, 20), 34, 18),    # the long float
    (0.85, 0.040, (24, 46, 48), (-36, 32, -10), 50, 10),   # reaching to land
]

SKIP_HALF = [(h, _skip_pose(0.0, *rest)) for h, _, *rest in SKIP_KEYS]
SKIP = ([(h * SKIP_DUR / 2.0, p) for h, p in SKIP_HALF]
        + [((1.0 + h) * SKIP_DUR / 2.0, _mirror(p)) for h, p in SKIP_HALF]
        + [(SKIP_DUR, SKIP_HALF[0][1])])

SKIP_STEP = SKIP_HALF[0][1]       # the three of them worth looking at on their
SKIP_HOP = SKIP_HALF[1][1]        # own, for --reskin
SKIP_AIR = SKIP_HALF[3][1]

# ── the cartwheel ───────────────────────────────────────────────────────────
#
# A wheel over her left hand, and like the somersault the whole revolution rides
# on one channel of `pelvis` — Z this time rather than X. The bone table names
# local Z as world −X for every up-or-down bone, and the pelvis points up, so
# pelvis Z is the roll axis: the fore-and-aft line through her that a cartwheel
# actually turns about. It runs 0 → +360 across the clip, positive going over
# her left, and the somersault's rule about the last key applies here too — it
# holds 360 rather than 0, because they are the same attitude and only one of
# them keeps the interpolator turning the way she was already turning.
#
# Pelvis X and Y stay at zero the whole way through, deliberately. An XYZ Euler
# with two hundred degrees in Z and anything at all in X is not a lean on a
# roll, it is a third rotation nobody authored, and every bit of shaping this
# needs is available on the spine and the limbs instead.
#
# The clip is otherwise stationary: it wheels on the spot, and the travel comes
# from the game moving her along the line she is wheeling over. That line is
# ninety degrees off the way she is facing — src/43-jadrija.js takes the quarter
# turn at a skip before it plays this, and gives it back after.


# Measured off the rest pose rather than guessed at, which is the only place
# numbers like these can honestly come from. The surprise is the third one: her
# arms are shorter than her legs, so the hips sit five centimetres *lower* in
# the handstand than in the stance. Authored from intuition it went the other
# way — up fifteen — and that one wrong sign is most of what had her wheeling
# through the air with her hands half a metre clear of the deck.
HIP_0 = 0.934     # standing hip height
LEG_R = 0.919     # hip to the tip of the toe, leg straight
ARM_R = 0.880     # hip to the palm, arms in line with the trunk overhead
                  # (the hand bone's tail is the wrist; the palm is ~4 cm past)


WHEEL_DUR = 1.32          # seconds for one wheel
WHEEL_KEYS = 24           # segments; 15 degrees of roll each

# How the arms are carried, which is the part of this that got reported rather
# than measured — "her arms get criss-crossed over, and they almost arch too far
# back". Both were true and both were a number in the pose below.
#
# REACH is how far apart the hands are held, in degrees at the shoulder, plus
# how much that changes once her weight is on them. It used to be a flat ten,
# and ten was not a spread at all: with the arms swung overhead, ten put the
# wrists **twelve and a half centimetres the wrong side of each other**, on
# eleven of the twenty-five keys — the whole upright approach and the whole
# upright exit. Rendered from the front she is not holding her arms up, she is
# clamping both hands over her own ears with her forearms crossed above her
# skull. It is the first thing you see and it was in every wheel she has ever
# turned.
#
# Thirty-six holds them 0.28 m apart going in and coming out, which is her own
# shoulder width, which is where a cartwheel puts them. The −14 closes that to
# 0.06 m through the inverted middle, and closing rather than opening is
# deliberate: at the handstand the two hands are on the line one behind the
# other, so laterally they belong close together, and it also keeps the planted
# hand low — spreading the arms shortens their reach to the deck, and a hand
# that cannot reach is a hand the floor pass leaves hanging in the air.
#
# The sign is not obvious and is worth stating, because it is the opposite of
# what the idle pose implies. On an arm hanging at her side, +Z on the left
# adducts — that is what IDLE_A's +29 is doing. On an arm already swung 160°
# overhead, the Euler's X has carried the local frame round with it and the same
# +Z *abducts*. Reading the idle sign across to here and flipping it, which is
# the obvious move, gets you 33 cm of crossed wrists instead of 12.
#
# ARM and WRIST are the arch — "they almost arch too far back a bit", and they
# did. −166 at the shoulder, −4 at the elbow and −18 at the wrist sum to −188:
# eight degrees past straight overhead, which carried her hands 12 cm *behind*
# her shoulders and bowed her back to keep up. The same three summing to −180
# put the arms in line with the trunk. Worst-case arch across the wheel goes
# from −0.123 m to −0.076 m; on the upright keys, where you actually see it,
# from −0.12 to −0.03.
WHEEL_REACH = (36.0, -14.0)
WHEEL_ARM = -158.0        # shoulder, elbow and wrist sum to −180: straight up,
WHEEL_WRIST = -18.0       # in line with the body, neither arched nor reaching


def _wheel(deg):
    """The attitude at `deg` degrees round, front half authored, back mirrored."""
    if deg <= 180:
        return _wheel_half(deg)
    p = _mirror(_wheel_half(360.0 - deg))
    # The roll is put back by hand rather than taken from the reflection, and
    # this is the somersault's `−360` trap wearing the other hat: reflecting the
    # front half's 0 gives 0, so the closing key held nothing instead of a whole
    # turn, and the last twentieth of a second ran the entire wheel backwards.
    # They are the same attitude. Only one of them is the same number.
    p["@roll"] = (deg,)
    return p


def _wheel_half(deg):
    """The front half of the wheel, as one function of how far round it is.

    Written as a function rather than as six hand-authored keys for a reason
    that only shows up in motion: `_bake_clip` eases *within* each key interval,
    so the rate goes to zero at every key it passes through. That is what you
    want for a wave and exactly what you do not want for a revolution — six keys
    of it and she wheels over in six visible lurches. Sampling one continuous
    function every thirty degrees puts the keys close enough together that the
    per-segment ease disappears into a constant turn.

    Two things are tracked across the roll and everything else follows them.

    `hands` is how much of her weight is on her hands: nothing until she is two
    thirds of the way to horizontal, all of it through the inverted middle,
    back to nothing as the first foot arrives. It sets the hip height, because
    her arms are shorter than her legs and the hips genuinely do sit four
    centimetres lower in a handstand than in a stance.

    The counter-rotations are what make it a cartwheel and not a pinwheel. Every
    up-or-down bone in this rig shares its local Z with the world's fore-and-aft
    axis, and the roll is about that same axis, so a support limb given the
    negative of the roll on its own Z points exactly where it pointed before she
    started going over: at the floor, while everything above it turns past. The
    hands stay planted and the feet stay planted for free, with no IK anywhere.

    The arms want `180 − deg` rather than `−deg`, because held overhead they
    already point along the body's own up: at the handstand they want nothing at
    all, and it is either side of it that they have work to do.
    """
    # The two hands are staggered, and that is not a detail. Symmetric arms mean
    # neither hand is *the* support once she is past the handstand: both swing
    # back overhead together, the floor pass has to drop her hips forty
    # centimetres to keep one of them on the concrete, and she exits the wheel
    # in a collapse. Real hands go down one at a time and leave one at a time —
    # left plants at about eighty-five degrees and leaves at two hundred, right
    # plants at a hundred and thirty and leaves at two-forty — and with that the
    # weight is somewhere definite at every moment of the roll.
    wl = _ease((deg - 84) / 30.0)
    wr = _ease((deg - 126) / 30.0)
    hands = max(wl, wr)
    # The knee-bent transfer on the way down into the first hand, where she is
    # lowest. The matching one on the way up off the last foot is the mirror of
    # this and costs nothing to write.
    dip = 0.055 * _ease(deg / 30.0) * (1.0 - _ease((deg - 44) / 34.0))
    hip = LEG_R + (ARM_R - LEG_R) * hands - dip
    # Folded to ±180 so a counter is always the short way round. The fold lands
    # at 180, in the middle of the stretch where `1 - hands` is exactly zero, so
    # the jump is multiplied out before it can reach a bone.
    r = ((deg + 180) % 360) - 180
    leg = -r * (1.0 - hands)
    cl = (180 - deg) * wl
    cr = (180 - deg) * wr
    split = 12 + 36 * hands              # the straddle, widest inverted
    reach = WHEEL_REACH[0] + WHEEL_REACH[1] * hands   # and the same for the arms
    bend = 14 * math.sin(math.radians(deg))
    look = 4 + 10 * hands
    lead = 8 * math.sin(math.radians(deg))
    knee = 5 + 30 * (dip / 0.055)        # that bent knee, on whichever leg
    return {
        "@root": (0.0, 0.02, hip - HIP_0),
        "@roll": (deg,),
        "spine01": (0, 0, bend * 0.30), "spine02": (0, 0, bend * 0.34),
        "spine03": (0, 0, bend * 0.24), "chest": (-2, 0, bend * 0.12),
        "neck": (look * 0.45, 0, 0), "head": (look, 0, 0),
        "clavicleL": (0, 0, 7), "clavicleR": (0, 0, -7),
        "armUL": (WHEEL_ARM, 0, cl + reach), "armLL": (-4, 0, 0),
        "handL": (WHEEL_WRIST, 0, 0),
        "armUR": (WHEEL_ARM, 0, -cr - reach), "armLR": (-4, 0, 0),
        "handR": (WHEEL_WRIST, 0, 0),
        # The bend is on the left knee alone: it is the one under her on the way
        # down, and the right one gets it back from the mirror on the way up.
        "legUL": (-lead, 0, leg - split), "legLL": (knee, 0, 0), "footL": (-8, 0, 0),
        "legUR": (lead, 0, leg + split), "legLR": (5, 0, 0), "footR": (-8, 0, 0),
    }


WHEEL = [(i * WHEEL_DUR / WHEEL_KEYS, _wheel(i * 360.0 / WHEEL_KEYS))
         for i in range(WHEEL_KEYS + 1)]

# ── the shimmy ──────────────────────────────────────────────────────────────
#
# "A shimmy shimmy yay dance move." A shimmy is one specific thing and it is not
# a wiggle of the whole body: the shoulders alternate forward and back, fast,
# and everything below the ribs stays where it is. Get the hips involved and it
# stops being a shimmy and starts being a shake.
#
# So the entire move is a twist, spread up the spine and taken back out again at
# the neck. Local Y is the twist on every up-or-down bone — it is the bone's own
# axis — which makes this four numbers going up and two coming back down.
#
# The coming back down is the half that matters. Fourteen degrees of shoulder
# swing with the head welded on top of it is somebody looking left and right;
# the same fourteen degrees with the face held still is a shimmy, because the
# stillness of the face is what tells you the shoulders are moving on purpose.
# The neck and the head carry +7 each against the spine's −14 and net to zero.
#
# Arms up, elbows out, hands by the ribs. Arms hanging at her sides and the
# shoulders have nothing to swing — the move becomes invisible from any distance
# at which you would want to watch it.
SHIMMY_DUR = 0.44          # a full there-and-back: about four reversals a second
SHIMMY_KEYS = 8            # sampled, not keyed — see dance_floor()


def _shimmy(s):
    """Half the cycle. `s` +1 throws one shoulder forward, −1 the other."""
    return {
        "@root": (0.0, 0.020, -0.014),
        # Two degrees of hip the other way and not one more. This is the line
        # between a shimmy and a shake.
        "pelvis": (-3, 3 * s, 0),
        "spine01": (-2, -2 * s, 0), "spine02": (-2, -3 * s, 0),
        "spine03": (-1, -4 * s, 0), "chest": (-3, -5 * s, 0),
        "neck": (4, 7 * s, 0), "head": (-3, 7 * s, 1),
        "clavicleL": (0, 0, 8), "clavicleR": (0, 0, -8),
        "armUL": (-26, 0, -34), "armLL": (-84, 0, -12), "handL": (-10, 0, 0),
        "armUR": (-26, 0, 34), "armLR": (-84, 0, 12), "handR": (-10, 0, 0),
        # Knees soft and alternating a couple of degrees, so she is standing on
        # them rather than bolted to the deck.
        "legUL": (-5, 0, -4), "legLL": (9 + 4 * s, 0, 0), "footL": (-4, 0, 0),
        "legUR": (-5, 0, 4), "legLR": (9 - 4 * s, 0, 0), "footR": (-4, 0, 0),
    }


def _shimmy_at(u):
    """`u` 0..1 through one full there-and-back."""
    return _shimmy(math.cos(2.0 * math.pi * u))


SHIMMY_A = _shimmy(1)      # the two extremes, for --reskin previews
SHIMMY_B = _shimmy(-1)
SHIMMY = [(i * SHIMMY_DUR / SHIMMY_KEYS, _shimmy_at(i / SHIMMY_KEYS))
          for i in range(SHIMMY_KEYS + 1)]


# ── the moonwalk ────────────────────────────────────────────────────────────
#
# One foot flat on the deck and gliding, the other up on its toe and holding
# still, and the two swapping over every seven tenths of a second while the body
# travels backwards. That is the whole move, and getting it right turns entirely
# on which foot is doing which.
#
# The popped foot is the anchor. It is planted — it does not move relative to
# the *deck* — so relative to her body it has to travel forwards by exactly as
# far as the body travels back, which is why its hip angle sweeps 34° while it
# is nominally standing still. Author it as stationary in her own frame instead,
# which is the obvious way round, and the anchor slides backwards with her: both
# feet glide, nothing is planted, and the illusion the move is made of does not
# happen. There is no walking here at all — only one foot sliding and one foot
# waiting — and the eye reads walking anyway *because* something stays put.
#
# That same 34° is where the travel speed comes from, so the game and the clip
# cannot drift apart: 34° of hip on a 0.90 m hip-to-toe is 0.53 m of deck, over
# a half-cycle, and the half-cycle is MOON_DUR / 2. `moonPace` in
# src/43-jadrija.js is that division and nothing else.
#
# Which is also the only honest way to make the move slower, and it was asked
# for. Stretching the clip alone leaves the game pushing her along at the old
# rate and the anchor foot — the one thing in a moonwalk that must not move —
# starts sliding backwards out from under her, which is the failure this whole
# section is built to avoid. Both numbers move or neither does. At 2.0 s the
# glide is 0.53 m/s, down from the 0.76 that read as somebody in a hurry to get
# to the other end of the promenade backwards.
MOON_DUR = 2.00
MOON_POP = -34.0           # plantarflexion in the popped foot: heel up, toe down
MOON_SWEEP = 34.0          # hip degrees the anchor gives back over a half-cycle


def _mw_leg(tag, hip, knee, heel):
    """One leg, with the ankle solved rather than authored.

    Every bone in this chain turns about the same axis, so the pitch of the sole
    is just hip + knee + ankle. Ask for the sole and let the ankle work out what
    it has to be. Authored against the other two by hand it goes wrong the first
    time either is nudged, and a moonwalk with a sole four degrees off the deck
    is a moonwalk on ice — which is nearly the joke, but not quite.
    """
    sole = MOON_POP * heel
    return {
        "legU" + tag: (hip, 0, 0),
        "legL" + tag: (knee, 0, 0),
        "foot" + tag: (sole - hip - knee, 0, 0),
        # And the toes lie flat under a popped heel instead of going through the
        # concrete with it.
        "toe" + tag: (-sole, 0, 0),
    }


# Of the 0.70 s half-cycle, this much is glide and the rest is the swap. The
# glide is the long part because the glide is the part anybody is looking at.
MOON_GLIDE = 0.66
MOON_KEYS = 20             # sampled, not keyed — see dance_floor()


def _moon_half(h):
    """One half-cycle, `h` 0..1, with the left foot flat and gliding.

    Two continuous ramps carry everything. `g` is how far through the glide she
    is; `x` is how far through the swap that follows it. Nothing here is keyed
    at a moment — every number is a function of those two, which is what lets
    the whole clip be sampled finely enough for the floor pass to mean anything.
    """
    g = _ease(min(1.0, h / MOON_GLIDE))
    x = _ease(max(0.0, (h - MOON_GLIDE) / (1.0 - MOON_GLIDE)))
    # Which foot the weight is over, swapping across the transfer rather than
    # flipping at it — a sign flip mid-clip is a snap you can see from the sea.
    s = 1.0 - 2.0 * x
    p = {
        "@root": (0.0, 0.020, -0.026),
        # Loose and low. This is not a march.
        "pelvis": (-2, 0, 3 * s),
        "spine01": (-3, 0, -1 * s), "spine02": (-3, 0, -1 * s),
        "spine03": (-2, 0, 0), "chest": (-4, 0, 0),
        "neck": (5, 0, 0), "head": (-4, 0, 0),
        "clavicleL": (0, 0, 6), "clavicleR": (0, 0, -6),
        "armUL": (-16 * s, 0, 20), "armLL": (-34, 0, 4), "handL": (-12, 0, 0),
        "armUR": (16 * s, 0, -20), "armLR": (-34, 0, -4), "handR": (-12, 0, 0),
    }
    # The glider, from in front of her hips to behind them, sole flat the whole
    # way — and popping its own heel at the end, ready to become the anchor.
    p.update(_mw_leg("L", -20 + 38 * g - 4 * x, 3 + 9 * g + 14 * x, x))
    # The anchor, giving back exactly the ground she covers so that it does not
    # move, then dropping flat to take over the glide.
    p.update(_mw_leg("R", 14 - MOON_SWEEP * g - 2 * x,
                     26 - 12 * g - 11 * x, 1.0 - x))
    return p


def _moon_at(u):
    """`u` 0..1 through the full cycle. The back half is the front, reflected."""
    return _moon_half(u * 2.0) if u < 0.5 else _mirror(_moon_half(u * 2.0 - 1.0))


MOON = [(i * MOON_DUR / MOON_KEYS, _moon_at(i / MOON_KEYS))
        for i in range(MOON_KEYS + 1)]


# ── soaked ──────────────────────────────────────────────────────────────────
#
# What she does when you point the branch at her.
#
# The brief was "spreads her arms and leans forward because she loves getting
# soaked, and smiles", and the only part of that which needed thinking about is
# the lean — because a lean is also what somebody does when they *hate* it.
# Flinching from cold water is a lean away with a shoulder turned into it;
# enjoying it is a lean in with the chest given to it. The two postures are
# about fifty degrees apart and they are the whole difference between delight
# and endurance, so the lean is the load-bearing angle here and the rest of the
# pose is decoration on top of it.
#
# Twenty-six degrees forward, and taken at the hips and the waist together
# rather than at either on its own: all of it at the pelvis is a bow, all of it
# in the spine is a stoop. The head then comes *back* thirty-six degrees against
# the trunk, which nets to about ten degrees of chin up — so she is leaning into
# the jet and looking at you over the top of it at the same time. That is the
# part that makes it read as something being done at somebody rather than
# something being stood in.
#
# The arms go past horizontal. The MakeHuman base stands with the upper arms 40°
# out, so the -52 here is 92° from vertical, and the torso being 26° forward
# sweeps them forward by the same amount without a degree being spent on it —
# which is why they are authored flat in her own frame and still arrive as an
# embrace. Palms open, elbows barely bent, because a spread arm with a folded
# elbow is a shrug.
#
# And nine degrees of jaw, which is the first clip in this file to key that bone
# at all — see `_trim_jaw` for why it took until now.
SOAK_A = {
    "@root": (0.010, 0.020, 0.006),
    "pelvis": (-12, 0, 0),
    "spine01": (-5, 0, 0), "spine02": (-5, 0, 0), "spine03": (-4, 0, 0),
    "chest": (-3, 0, 0), "neck": (16, 0, 0), "head": (20, -3, 0),
    "jaw": (-9, 0, 0),
    "clavicleL": (0, 0, 9), "clavicleR": (0, 0, -9),
    "armUL": (0, 0, -52), "armLL": (-12, 0, -6), "handL": (-22, 0, 0),
    "armUR": (0, 0, 52), "armLR": (-12, 0, 6), "handR": (-22, 0, 0),
    "legUL": (-12, 0, -6), "legLL": (10, 0, 0), "footL": (-9, 0, 0),
    "legUR": (-12, 0, 6), "legLR": (10, 0, 0), "footR": (-9, 0, 0),
}

# The same thing, a breath further into it: chest opened, arms up and wider,
# mouth wider, and half a centimetre of rise. Slow — 1.4 s round the loop — so
# it swells rather than bounces. A fast oscillation here reads as shivering,
# which is the emotion this pose exists to not be.
SOAK_B = dict(SOAK_A, **{
    "@root": (0.012, 0.020, 0.012),
    "chest": (-6, 0, 0), "neck": (18, 0, 0), "head": (22, 3, 0),
    "jaw": (-13, 0, 0),
    "clavicleL": (0, 0, 12), "clavicleR": (0, 0, -12),
    "armUL": (-5, 0, -60), "armLL": (-16, 0, -6), "handL": (-26, 0, 0),
    "armUR": (-5, 0, 60), "armLR": (-16, 0, 6), "handR": (-26, 0, 0),
    "legLL": (7, 0, 0), "legLR": (7, 0, 0),
})

# ── the firestarter ─────────────────────────────────────────────────────────
#
# "If we spray her with water for too long, she at some point switches into a
# Prodigy Firestarter routine." Which makes this the one clip in the file that
# is not something a child on a Dalmatian promenade would actually do, and it
# had to be built by working backwards from what survives the trip.
#
# The reference is a man in a tunnel in 1996, and almost none of what makes that
# performance work gets through: no face at this range, no hair to speak of, no
# camera cuts, no tunnel. What survives is the silhouette, and the silhouette is
# three things and their timing.
#
#   the hunch    chest dropped and shoulders rolled forward, so the outline goes
#                from a person standing to a person coiled
#   the chin     thrust up and out *against* the hunch — this is the single
#                angle that separates a threat from a slouch, and it is why the
#                neck and head carry +50° between them against a −34° back
#   the elbows   high, wide, and never in the same place twice
#
# And 140 to the minute, one stamp a beat, which is where FIRE_DUR comes from.
# Slower is a haka. Faster and the legs stop being legs.
#
# Two things are deliberately not authored.
#
# The stamp is not a sine wave. A leg that rises and falls smoothly is a march;
# a stamp is planted for most of its cycle, snaps up, and comes down harder than
# it went up. `_stomp` is that asymmetry, and it is the whole difference between
# the two readings.
#
# And the bounce is not written down anywhere, because it cannot be: the floor
# pass overwrites `@root` from the lowest tip and would throw away any hip
# height authored here. It comes out of the *supporting* knee instead — sixteen
# extra degrees of flexion on the frame the other foot lands, bled off over the
# next quarter cycle. Her hips drop because her standing leg absorbs, which is
# where the drop comes from in a real one, and the floor pass then finds it on
# its own.

FIRE_DUR = 0.86            # two stamps, at about a hundred and forty a minute
FIRE_KEYS = 16             # sampled, not keyed — see dance_floor()

# The pelvis's share of the hunch, and it is nearly nothing on purpose.
#
# The first pass put twelve degrees here and twenty-two in the back, on the same
# reasoning the `soak` pose uses — all of it at the pelvis is a bow, all of it in
# the spine is a stoop, so split it. That is right for a lean and wrong for this,
# and the side view said so immediately: thirty-four degrees of forward *tilt*
# with a straight back is a sprinter in the blocks, which is an athlete, which is
# the opposite of coiled. A hunch is a rounded upper back over hips that are
# still under her. So the pelvis stays where it is and the whole forty degrees
# goes into the spine, weighted toward the top of it.
FIRE_PELVIS = 2.0


def _flat(hip, knee, pel=FIRE_PELVIS):
    """The ankle angle that puts the sole flat on the deck.

    Measured, not derived, and general in all three. The naive model — that the
    sole's pitch is the sum of the angles down the leg — is wrong for this rig,
    because the foot does not carry the same roll as the bones above it (see
    FLAT), so a degree at the ankle is not worth a degree at the hip. Bisected
    against the exported rig at eighteen stances over three pelvis angles, the
    answer is a straight line, good to half a degree across the range anything
    here uses.

    The skip's own constant of −1.3 is this same line at its pelvis of −4, which
    is worth knowing and not worth rewriting: those numbers are baked, verified,
    and sitting four millimetres off the deck.
    """
    return hip + knee - pel - 5.35


def _stomp(ph):
    """How far a leg is lifted: 0 planted, 1 knee at the top. `ph` 0 is landing.

    Planted for exactly half the cycle, which is what makes this a march and not
    a jump — with a stance any shorter than half there is a window twice a cycle
    with neither foot on the deck, and the floor pass answers that by putting
    the lower of the two airborne feet on the ground, which is not a fix.

    The other half is snap, hang, slam: up in sixteen hundredths, held at the
    top for twice that, and down in fourteen. The hang is the part that reads. A
    knee that rises and falls without stopping is a march; a knee that gets to
    the top and *waits* there is somebody making a point with it.
    """
    ph = ph % 1.0
    if ph < 0.50:
        return 0.0
    if ph < 0.66:
        return _ease((ph - 0.50) / 0.16)
    if ph < 0.86:
        return 1.0
    return 1.0 - _ease((ph - 0.86) / 0.14)


def _sink(ph):
    """How far the standing leg has folded under the landing. This is the bounce.

    Nothing at the moment the foot arrives, all of it a tenth of a second later,
    and gone again by mid-stance — so her weight arrives, drops through the leg
    and comes back up, twice a cycle, just behind each footfall.

    The first version of this peaked *on* the landing frame and produced nine
    millimetres of hip travel over the whole clip, which is a figure standing
    still while its legs move. Two things were wrong with it. At the instant of
    a footfall both feet are down and the floor pass pins whichever leg is
    longer, so bending only the one that just landed changes nothing; and a knee
    bent on its own barely shortens a leg at all, because the thigh and the shin
    swing away from vertical in opposite directions and the cosines very nearly
    cancel. The hip has to go with the knee. It does, below.
    """
    ph = ph % 1.0
    if ph < 0.12:
        return _ease(ph / 0.12)
    if ph < 0.40:
        return 1.0 - _ease((ph - 0.12) / 0.28)
    return 0.0


def _snap(ph, ramp=0.16):
    """A square wave on [0, 1) with its edges eased over `ramp`.

    Up for the first half and down for the second. The arms run off this rather
    than off a cosine for the same reason the legs run off `_stomp`: a cosine
    spends all its time in transit and none at either end, and an arm that is
    always moving and never *placed* is a wave, not a jab.
    """
    ph = ph % 1.0
    if ph < 0.5:
        return _ease(ph / ramp) if ph < ramp else 1.0
    q = ph - 0.5
    return 1.0 - (_ease(q / ramp) if q < ramp else 1.0)


FIRE_HIP, FIRE_KNEE = -24.0, 14.0        # the stance at its longest: thigh 22°
                                         # forward of vertical and shin 8°,
                                         # which is a body over the balls of its
                                         # feet rather than sat back on them
FIRE_SINK = (-12.0, 18.0)                # and what the bounce takes off it —
                                         # thigh to 34° and shin to 2°, worth
                                         # about three centimetres of hip
FIRE_HIP_UP, FIRE_KNEE_UP = -82.0, 95.0  # the drive, knee to about waist height
FIRE_TOE = 26.0           # how far the toe drops once the foot is off the deck


def _fire_leg(ph):
    """(hip, knee, ankle) for one leg, `ph` its own phase with 0 the landing."""
    k, s = _stomp(ph), _sink(ph)
    down = (FIRE_HIP + FIRE_SINK[0] * s, FIRE_KNEE + FIRE_SINK[1] * s)
    hip = down[0] + (FIRE_HIP_UP - down[0]) * k
    knee = down[1] + (FIRE_KNEE_UP - down[1]) * k
    # Flat while it is down; toe dropped once it is off, because a knee driven
    # to the waist with the foot left level is somebody testing bathwater.
    return hip, knee, _flat(hip, knee) - FIRE_TOE * k


def _fire_at(u):
    """One frame of the loop. `u` 0..1; the left foot lands at 0.

    The arms are contralateral, which is the one piece of ordinary human wiring
    left in the move: the elbow that flies is the one across from the knee that
    drives, because that is what a body does with its arms when its legs do
    that, and taking it out makes her look like a wind-up toy rather than
    somebody committing.
    """
    lo = _fire_leg(u)
    ro = _fire_leg(u + 0.5)
    # `qL` is 1 with the left elbow up and out, 0 with the left forearm folded
    # across her. The right is its complement, so the two arms are never in the
    # same place and the scissor is a scissor.
    qL = _snap(u + 0.5)
    qR = 1.0 - qL
    tw = qR - qL              # +1 with the right arm up: the trunk twists left

    def arm(q, s):
        """One arm. `q` is 0 with the fist cocked in at the chest and 1 with the
        whole arm thrown out wide at shoulder height. `s` is +1 on the left.

        This is not the shape the first pass went for. That one wanted the
        goalpost — elbow high and wide, forearm hanging down — which is the
        actual Flint arm and which this rig will not make without internally
        rotating the upper arm first: the elbow hinges in whatever plane the
        shoulder leaves it in, so a hundred degrees of fold on an arm abducted
        past horizontal puts her hand behind her own ear, and that is exactly
        where it went. Wide and low is the other half of the same performance,
        it needs no twist to get right, and it is still legible at thirty metres
        — which the goalpost, being mostly a silhouette detail, would not be.
        """
        return {
            "armU": (-18.0 + 6.0 * q, 0.0, s * (26.0 - 82.0 * q)),
            "armL": (-84.0 + 56.0 * q, 0.0, s * (-8.0 - 6.0 * q)),
            "hand": (-26.0 - 4.0 * q, 0.0, s * 10.0 * q),
        }

    L, R = arm(qL, 1.0), arm(qR, -1.0)
    p = {
        "@root": (0.0, 0.0, 0.0),
        "pelvis": (FIRE_PELVIS, 3.0 * tw, 0.0),
        # Forty degrees of flexion, but stacked at the top of the spine rather
        # than spread evenly down it. Spread evenly it is a lean, and a lean
        # with a straight back is a sprinter in the blocks; two degrees at the
        # waist and seventeen at the chest is the same forty as a *curve*, and
        # the curve is the whole read.
        "spine01": (-2.0, -2.0 * tw, 0.0), "spine02": (-7.0, -4.0 * tw, 0.0),
        "spine03": (-14.0, -6.0 * tw, 0.0), "chest": (-17.0, -9.0 * tw, 0.0),
        # The chin. Forty-four degrees between the two of them against a −40°
        # back, which nets to about four of face *up* out of a body folded well
        # forward — so she is looking at you from under it rather than at the
        # sky, which is where fifty-two degrees put her. The yaw is a quarter
        # cycle behind the shoulders, so the head arrives after the twist rather
        # than with it, and that lag is what makes it a snap.
        "neck": (26.0, 8.0 * tw, 0.0),
        "head": (18.0, 16.0 * (2.0 * _snap(u + 0.25) - 1.0), -7.0 * tw),
        "jaw": (-13.0, 0.0, 0.0),
        # Rolled forward and held there, which is the other half of a hunch: a
        # rounded back with the shoulders still square on top of it is a person
        # with backache.
        "clavicleL": (0.0, 0.0, 10.0 + 9.0 * qL),
        "clavicleR": (0.0, 0.0, -10.0 - 9.0 * qR),
        "legUL": (lo[0], 0.0, -4.0), "legLL": (lo[1], 0.0, 0.0),
        "footL": (lo[2], 0.0, 0.0),
        "legUR": (ro[0], 0.0, 4.0), "legLR": (ro[1], 0.0, 0.0),
        "footR": (ro[2], 0.0, 0.0),
    }
    for tag, side in (("L", L), ("R", R)):
        for b, v in side.items():
            p[b + tag] = v
    return p


FIRE = [(i * FIRE_DUR / FIRE_KEYS, _fire_at(i / FIRE_KEYS))
        for i in range(FIRE_KEYS + 1)]

FIRE_LAND = _fire_at(0.0)        # the three worth a still, for --reskin
FIRE_DRIVE = _fire_at(0.32)
FIRE_HALF = _fire_at(0.5)


# The throw.
#
# A separate one-shot rather than a beat inside the loop, and the reason is
# balance rather than animation: the game has to be able to choose how often she
# throws, because the whole point of the sequence is that you can get on top of
# it with the branch. A fireball welded to the dance fires at whatever tempo the
# dance happens to be, and the tempo of the dance is not a difficulty knob.
#
# Right-handed, over the top, and the wind-up is the half of it that matters. A
# throw with no load in it reads as a shove; the coil is what tells you
# something left her hand hard.
FIRE_CAST_AT = 0.46       # seconds in, where it leaves her — 43-jadrija.js
                          # spawns the ball off this and nothing else

FIRE_COCK = dict(_fire_at(0.0), **{
    # Twisted open to the right and stacked over the back foot, chest turned
    # away from where it is going. Both feet stay down: a step into it would
    # travel her, and she is throwing from a spot.
    "pelvis": (6.0, -16.0, 0.0),
    "spine01": (-4.0, -8.0, 0.0), "spine02": (-5.0, -10.0, 0.0),
    "spine03": (-4.0, -12.0, 0.0), "chest": (-2.0, -14.0, 0.0),
    "neck": (18.0, 10.0, 0.0), "head": (12.0, 22.0, -6.0), "jaw": (-16.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, 4.0), "clavicleR": (0.0, 0.0, -14.0),
    # The right hand back and above the shoulder, elbow leading. The left is out
    # in front, pointed where it is going, which is what a body uses the off arm
    # for and also what tells the player where to look.
    #
    # Abduction is +Z on the *right* and −Z on the left — the two sides mirror in
    # sign, which is the rule everywhere in this file and which the first version
    # of this pose broke. A right shoulder written −84 is not eighty-four degrees
    # of arm thrown out behind her, it is eighty-four degrees of arm folded
    # across her own back, and that is where it went: the throwing arm vanished
    # for the whole wind-up and the clip read as a girl pointing at something.
    "armUR": (40.0, 0.0, 74.0), "armLR": (-92.0, 0.0, 22.0), "handR": (-14.0, 0.0, 0.0),
    "armUL": (-58.0, 0.0, -18.0), "armLL": (-16.0, 0.0, -6.0), "handL": (-16.0, 0.0, 0.0),
    "legUL": (-14.0, 0.0, -4.0), "legLL": (14.0, 0.0, 0.0),
    "footL": (_flat(-14.0, 14.0, 6.0), 0.0, 0.0),
    "legUR": (-30.0, 0.0, 4.0), "legLR": (34.0, 0.0, 0.0),
    "footR": (_flat(-30.0, 34.0, 6.0), 0.0, 0.0),
})

FIRE_THROW = dict(_fire_at(0.0), **{
    # And through it. The trunk unwinds a full thirty degrees the other way, the
    # arm comes over the top, and the head goes with it — everything that was
    # cocked is now spent, which is the only way a throw ever reads.
    "pelvis": (0.0, 14.0, 0.0),
    "spine01": (-8.0, 7.0, 0.0), "spine02": (-13.0, 9.0, 0.0),
    "spine03": (-14.0, 11.0, 0.0), "chest": (-12.0, 13.0, 0.0),
    "neck": (24.0, -8.0, 0.0), "head": (16.0, -14.0, 5.0), "jaw": (-20.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, 14.0), "clavicleR": (0.0, 0.0, -6.0),
    "armUR": (-100.0, 0.0, 26.0), "armLR": (-18.0, 0.0, -6.0), "handR": (-34.0, 0.0, 0.0),
    "armUL": (30.0, 0.0, 18.0), "armLL": (-40.0, 0.0, -8.0), "handL": (-10.0, 0.0, 0.0),
    "legUL": (-34.0, 0.0, -4.0), "legLL": (30.0, 0.0, 0.0),
    "footL": (_flat(-34.0, 30.0, 0.0), 0.0, 0.0),
    "legUR": (-16.0, 0.0, 4.0), "legLR": (16.0, 0.0, 0.0),
    "footR": (_flat(-16.0, 16.0, 0.0), 0.0, 0.0),
})

FIRE_AFTER = dict(FIRE_THROW, **{
    # A tenth of a second later, with the arm carried on down across her body.
    "armUR": (-44.0, 0.0, -20.0), "armLR": (-56.0, 0.0, -18.0), "handR": (-24.0, 0.0, 0.0),
    "armUL": (16.0, 0.0, 24.0), "armLL": (-56.0, 0.0, -14.0),
    "chest": (-8.0, 6.0, 0.0), "head": (22.0, -6.0, 2.0),
})

CAST = [(0.00, _fire_at(0.0)), (0.20, FIRE_COCK), (0.34, FIRE_COCK),
        (FIRE_CAST_AT, FIRE_THROW), (0.58, FIRE_AFTER), (0.78, _fire_at(0.0))]


# And the turn itself: the moment she stops being a nine-year-old in a hose and
# starts being whatever this is.
#
# It is a gather and a fling, in that order, and the gather is what sells it —
# an arch with nothing before it is a stretch. She drops into a crouch with her
# arms pulled in over about a quarter of a second, holds for nothing at all, and
# then throws the whole thing open: head back past the vertical, arms flung down
# and behind her, mouth wide. Then down into the hunch, which is where the loop
# picks her up.
FIRE_GATHER = {
    "@root": (0.0, 0.0, 0.0),
    "pelvis": (-4.0, 0.0, 0.0),
    "spine01": (-12.0, 0.0, 0.0), "spine02": (-15.0, 0.0, 0.0),
    "spine03": (-14.0, 0.0, 0.0), "chest": (-12.0, 0.0, 0.0),
    "neck": (8.0, 0.0, 0.0), "head": (-16.0, 0.0, 0.0), "jaw": (-4.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, 14.0), "clavicleR": (0.0, 0.0, -14.0),
    "armUL": (-46.0, 0.0, 30.0), "armLL": (-118.0, 0.0, -6.0), "handL": (-30.0, 0.0, 0.0),
    "armUR": (-46.0, 0.0, -30.0), "armLR": (-118.0, 0.0, 6.0), "handR": (-30.0, 0.0, 0.0),
    "legUL": (-34.0, 0.0, -4.0), "legLL": (40.0, 0.0, 0.0),
    "footL": (_flat(-34.0, 40.0, -4.0), 0.0, 0.0),
    "legUR": (-34.0, 0.0, 4.0), "legLR": (40.0, 0.0, 0.0),
    "footR": (_flat(-34.0, 40.0, -4.0), 0.0, 0.0),
}

FIRE_OPEN = {
    "@root": (0.0, 0.0, 0.0),
    # Everything the gather folded, thrown open. Twelve degrees of *backward*
    # lean through the spine, which is the only pose in this file that goes that
    # way, and it is the one frame the whole sequence is remembered by.
    "pelvis": (8.0, 0.0, 0.0),
    "spine01": (5.0, 0.0, 0.0), "spine02": (6.0, 0.0, 0.0),
    "spine03": (6.0, 0.0, 0.0), "chest": (7.0, 0.0, 0.0),
    "neck": (22.0, 0.0, 0.0), "head": (26.0, 0.0, 0.0), "jaw": (-22.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, -8.0), "clavicleR": (0.0, 0.0, 8.0),
    # Down and behind, palms back — the shape somebody makes when something
    # comes out of them rather than when they reach for something.
    "armUL": (46.0, 0.0, -34.0), "armLL": (-10.0, 0.0, -4.0), "handL": (-34.0, 0.0, 0.0),
    "armUR": (46.0, 0.0, 34.0), "armLR": (-10.0, 0.0, 4.0), "handR": (-34.0, 0.0, 0.0),
    "legUL": (-8.0, 0.0, -5.0), "legLL": (8.0, 0.0, 0.0),
    "footL": (_flat(-8.0, 8.0, 8.0), 0.0, 0.0),
    "legUR": (-8.0, 0.0, 5.0), "legLR": (8.0, 0.0, 0.0),
    "footR": (_flat(-8.0, 8.0, 8.0), 0.0, 0.0),
}

# A *copy* of SOAK_A, not SOAK_A. The floor pass writes `@root` into the poses
# it is given, in place, and handing it the same dict the `soak` clip is built
# from would solve one clip's ground clearance into another one's key.
FLARE = [(0.00, dict(SOAK_A)), (0.26, FIRE_GATHER), (0.52, FIRE_OPEN),
         (0.78, FIRE_OPEN), (1.10, _fire_at(0.0))]


CLIPS = [
    {"name": "idle", "loop": True,
     "keys": [(0.0, IDLE_A), (2.3, IDLE_B), (4.6, IDLE_A)]},
    {"name": "wave", "loop": False,
     "keys": [(0.0, IDLE_A), (0.5, WAVE_UP), (0.85, WAVE_OUT), (1.2, WAVE_UP),
              (1.55, WAVE_OUT), (1.9, WAVE_UP), (2.5, IDLE_A)]},
    {"name": "notice", "loop": False,
     "keys": [(0.0, IDLE_A), (0.30, NOTICE), (1.05, NOTICE), (1.45, IDLE_A)]},
    # Down onto all fours. Through the half-kneel, because that is the way down
    # as well as the way up and reusing it costs nothing.
    {"name": "kneel", "loop": False,
     "keys": [(0.0, IDLE_A), (0.45, LUNGE), (0.80, KNEEL), (1.15, FOURS)]},
    {"name": "crawl", "loop": True,
     "keys": [(0.0, CRAWL_A), (0.55, CRAWL_B), (1.10, CRAWL_A)]},
    {"name": "getup", "loop": False,
     "keys": [(0.0, FOURS), (0.40, KNEEL), (0.85, LUNGE), (1.45, IDLE_A)]},
    {"name": "flip", "loop": False,
     "keys": [(0.00, IDLE_A), (0.24, CROUCH), (0.40, LAUNCH),
              (0.56, _tuck(-118, 0.40)), (0.72, _tuck(-232, 0.47)),
              (0.88, _tuck(-318, 0.28)), (1.04, LAND), (1.40, SETTLE)]},
    {"name": "skip", "loop": True,
     "keys": SKIP},
    # One-shot, like the somersault and for the same reason: the game chains
    # two or three of them by rewinding `curT`, which is cheaper than a loop
    # and lets it stop after any whole number of wheels.
    {"name": "cartwheel", "loop": False, "keys": WHEEL},
    # Looping, because it is a state and not an event: she holds it for as long
    # as the water is on her, which is however long you feel like keeping it
    # there.
    {"name": "soak", "loop": True,
     "keys": [(0.0, SOAK_A), (0.70, SOAK_B), (1.40, SOAK_A)]},
    # Both of these loop and both are held for as long as the game feels like
    # holding them, which is what makes them dances rather than tricks: the
    # somersault and the cartwheel are events that end, these are things she is
    # doing until she stops.
    {"name": "shimmy", "loop": True, "keys": SHIMMY},
    {"name": "moonwalk", "loop": True, "keys": MOON},
    # And the turn. Three clips rather than one because they are three different
    # kinds of thing: `flare` happens to her once, `firestarter` is what she is
    # until something stops it, and `cast` is an event the game fires off inside
    # that state whenever it decides she should throw.
    {"name": "flare", "loop": False, "keys": FLARE},
    {"name": "firestarter", "loop": True, "keys": FIRE},
    {"name": "cast", "loop": False, "keys": CAST},
]


VIEWS = {
    "front": (0.0, 4.0, 0.95, 4.2, 760, 1120),
    "side": (90.0, 4.0, 0.95, 4.2, 760, 1120),
    "hero": (34.0, 8.0, 0.95, 3.9, 760, 1120),
    "face": (2.0, 2.0, 1.612, 0.46, 900, 900),
    "head": (30.0, 5.0, 1.615, 0.52, 900, 900),
    "prof": (88.0, 2.0, 1.615, 0.50, 900, 900),
    # Azimuth 0 is in front of her, since her forward is +X — so these two are
    # the only views that show the back of the head, which is where all of the
    # hair is.
    "nape": (176.0, 6.0, 1.600, 0.60, 900, 900),
    # Both ankles at once, from a little above — which is roughly the angle you
    # look down at somebody's feet from, and the only view in this table where
    # anything below the knee is more than forty pixels tall.
    "feet": (38.0, 16.0, 0.170, 1.60, 900, 700),
    "rear": (156.0, 9.0, 1.150, 2.30, 760, 1120),
}


def _material(body):
    m = bpy.data.materials.new("human")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.52
    col = nt.nodes.new("ShaderNodeVertexColor")
    col.layer_name = "prev"
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    body.data.materials.clear()
    body.data.materials.append(m)


def _lights():
    for name, energy, rot in (("key", 4.0, (56, 0, 40)),
                              ("fill", 1.1, (72, 0, -110)),
                              ("rim", 2.4, (78, 0, 190))):
        d = bpy.data.lights.new(name, "SUN")
        d.energy = energy
        d.angle = math.radians(6.0)
        ob = bpy.data.objects.new(name, d)
        ob.rotation_euler = tuple(math.radians(a) for a in rot)
        bpy.context.collection.objects.link(ob)
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.20, 0.21, 0.23, 1)
    bpy.context.scene.world = w


def render(tag, names):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_gtao = True
    sc.eevee.gtao_distance = 0.20
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 85
    cam = bpy.data.objects.new("cam", cam_d)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    for name in names:
        az, el, tz, rad, rx, ry = VIEWS[name]
        a, e = math.radians(az), math.radians(el)
        cam.location = (math.cos(a) * math.cos(e) * rad,
                        math.sin(a) * math.cos(e) * rad,
                        tz + math.sin(e) * rad)
        d = Vector((0, 0, tz)) - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        sc.render.resolution_x, sc.render.resolution_y = rx, ry
        sc.render.filepath = "%s_%s_%s.png" % (PREVIEW, tag, name)
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


# --------------------------------------------------------------------------- #

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    levels = SUBSURF
    if "--sub" in argv:
        levels = int(argv[argv.index("--sub") + 1])

    # Everything above the export is deterministic and slow — a download, a
    # subsurf, a paint pass over a hundred thousand vertices and eight EEVEE
    # renders — and none of it changes when the thing being fixed is the shape
    # of the blob at the end. `--reexport` opens the saved .blend and does the
    # last step only, which turns a five-minute round trip into a five-second
    # one for every question about the export itself.
    if "--reexport" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body = bpy.data.objects["human"]
        export_static(body, ROOT / "build" / "payload" / "human.fr3d.gz")
        return

    # The same fast path for the skinned blob, and — because the whole point of
    # clips is that they get iterated on — an optional render of any authored
    # pose so the angles can be *looked at* rather than reasoned about.
    # Re-run the bind on the saved blend and save it back. Weighting is the one
    # slow step that is not the mesh, so it gets its own door.
    if "--rebind" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        skin(body, rig)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] rebound %s" % BLEND)
        return

    # The joined geometry — hair and anklets — is added to a finished mesh, so
    # it has to be followed by a re-bind (the new vertices have no groups) and a
    # re-export. That is two of the three slow steps and none of the download,
    # the subsurf or the renders, which is the difference between iterating on
    # the shape of a ponytail and not iterating on it.
    #
    # `--hair` still works and means the same thing. It was the name when hair
    # was all there was, and it is in enough shell history to be worth keeping.
    if "--extras" in argv or "--hair" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        J, _scale, _drop = read_joints(fetch())
        extras(body, J)
        skin(body, rig)
        paint(body, cutters(J))
        _material(body)
        _lights()
        pose(rig, {})
        render("extras", ("nape", "prof", "rear", "feet"))
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] extras rebuilt in %s" % BLEND)
        return

    # The face, which is paint and weights and no geometry at all.
    #
    # Everything that makes a head read at twenty metres on this figure is a
    # vertex colour laid down through a cutter — eyes, brows, lashes, mouth —
    # and none of that survives a `--reskin`, because paint is baked into the
    # blend and `--reskin` only re-poses and re-exports. A full run to move a
    # mouth corner two millimetres is four minutes of download, subsurf and
    # renders to reach a pass that takes forty seconds.
    #
    # The bind goes with it rather than getting a door of its own, because the
    # two things that changed together here — a lash line and a jaw that can
    # open without taking the skull with it — are one paint change and one
    # weight change, and running half of that is how you end up looking at a
    # render and drawing a conclusion about the wrong half.
    if "--reface" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        J, _scale, _drop = read_joints(fetch())
        skin(body, rig)
        paint(body, cutters(J))
        _material(body)
        _lights()
        pose(rig, {})
        render("face", ("face", "head", "prof"))
        # The jaw on its own, so the head stays where the close cameras are
        # pointed. The soaked pose leans 26° forward and takes her face clean
        # out of a frame that is 130 mm across — the first attempt at this
        # rendered her shoulder three times.
        pose(rig, {"jaw": (-13, 0, 0)})
        render("gape", ("face", "head", "prof"))
        pose(rig, SOAK_B)
        render("soak", ("hero", "side", "front"))
        pose(rig, {})
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] refaced %s" % BLEND)
        return

    # No render and no export: opens the blend, walks the frames and prints.
    # Seconds rather than minutes, which is what makes it usable as the inner
    # loop while the numbers in a clip are still being argued with.
    if "--clipcheck" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        rig = bpy.data.objects["rig"]
        wheel_floor(rig)          # so the numbers below are the shipped numbers
        dance_floor(rig)
        skip_floor(rig)
        fire_floor(rig)
        for name in argv[argv.index("--clipcheck") + 1:]:
            if name.startswith("-"):
                break
            clipcheck(rig, name)
        return

    if "--reskin" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        _lights()
        for name in argv[argv.index("--reskin") + 1:]:
            if name.startswith("-") or name not in globals():
                break
            pose(rig, globals()[name])
            # Hero, side and front. Front used to be left out — it tells you
            # almost nothing about a pose whose whole content is sagittal, and
            # every view is 25 s of EEVEE — but the cartwheel's whole content is
            # frontal, and it is the only view that shows which way she is
            # going over.
            render(name.lower(), ("hero", "side", "front"))
        pose(rig, {})
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS)
        return

    path = fetch()
    J, scale, drop = read_joints(path)
    print("[mh] scale %.5f  drop %.4f  joints %d" % (scale, drop, len(J)))
    print("[mh] ground marker lands at z = %+.4f (want 0)" % J["ground"].z)

    body = load(path, scale, drop)
    print("[mh] kept %d verts before smoothing" % len(body.data.vertices))
    smooth(body, levels)
    # After the subsurf, deliberately. The hair is authored at the density it
    # wants; run through smooth() it would be subdivided twice — once globally
    # and again by the head pass, which takes everything above z = 1.46 — and
    # arrive at a few thousand triangles for a ponytail, all of which the export
    # decimator would then have to take back off the face.
    extras(body, J)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print("[mh] mesh %d verts, %d faces, %d tris"
          % (len(body.data.vertices), len(body.data.polygons), tris))

    rig = armature(J)
    print("[mh] bones %d" % len(rig.data.bones))
    skin(body, rig)
    paint(body, cutters(J))
    _material(body)
    _lights()

    pose(rig, {})
    render("bind", ("front", "side", "hero", "face", "head", "prof"))
    pose(rig, STRIDE)
    render("stride", ("hero", "side"))

    # Skinned, from the *bind* pose — the armature modifier has to be evaluating
    # to identity here or every vertex gets deformed twice, once at bake and
    # once in the shader.
    #
    # `export_static` is still here and still works (`--reexport`), but nothing
    # ships it any more: it wrote 427 KB for one frozen attitude, and the same
    # body with its skeleton attached is 470 KB for all of them.
    pose(rig, {})
    export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz", CLIPS)

    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("[mh] wrote %s" % BLEND)


if __name__ == "__main__":
    main()
