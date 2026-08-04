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
            keep.append((ob, HAIR_M, HAIR_P))
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
        for n in eyes:
            if n in byname and (c - byname[n].head_local).length < 0.03 and round_ > 0.5:
                pick = n
        assigned[pick] = assigned.get(pick, 0) + 1
        for i in vs:
            bm.verts[i][dl][gi[pick]] = 1.0
        weighted += len(vs)
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
    for s, tag in ((1, "l"), (-1, "r")):
        e = J["%s-eye" % tag]
        # Iris and pupil, punched forward through the eyeball.
        add("iris" + tag, IRIS_M, IRIS_P, 4,
            (e.x - 0.030, e.y, e.z), (0.0450, 0.0060, 0.0060))
        add("pupil" + tag, PUPIL_M, PUPIL_P, 5,
            (e.x - 0.028, e.y, e.z), (0.0450, 0.0027, 0.0027))
        # Brow, a little above and slightly outboard of the eye.
        add("brow" + tag, HAIR_M, HAIR_P, 3,
            (e.x - 0.040, e.y * 1.06, e.z + 0.026),
            (0.0480, 0.0250, 0.0055))

    # The mouth line, as three separate shells so parity stays valid, with the
    # corners set lower and further back than the middle. A dead-straight mouth
    # is the one feature that makes a head read as a mannequin.
    m = J["mouth"]
    add("mouth0", MOUTH_M, MOUTH_P, 4,
        (m.x - 0.030, 0.0, m.z), (0.0450, 0.0135, 0.0024))
    for s in (1, -1):
        add("mouth%d" % s, MOUTH_M, MOUTH_P, 4,
            (m.x - 0.034, s * 0.0165, m.z - 0.0018),
            (0.0450, 0.0110, 0.0022))

    # Hair: a cap over the skull, cut at the brow. Unlike the others this one is
    # a solid the scalp sits inside, not a punch through it.
    add("hair", HAIR_M, HAIR_P, 2,
        (J["head"].x - 0.012, 0.0, head - 0.072),
        (0.098, 0.092, 0.108), rows=16, seg=26)

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
        quats = []
        for bi, (name, _parent, local_b, local_g) in enumerate(rest):
            rot = blended.get(name)
            if rot:
                basis = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
                m = CONV @ (local_b @ basis.to_4x4()) @ CONV_I
            else:
                m = local_g
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


def export_skin(body, rig, path, clips, tris=26000):
    """Write the figure as a .fr3d **v3** blob: mesh, skeleton and clips.

    v1 froze the armature into the vertices, which is why the promenade got a
    statue. This carries the four bone influences per vertex that `skin()`
    already caps the weights to, the rest skeleton, and every clip baked to
    quaternions — and from there the browser can put her in any pose the rig can
    reach, for about the same number of bytes as the one pose cost.

    The mesh is exported in the **bind** pose, so the rig has to be at rest when
    this runs or every vertex is deformed twice.
    """
    rest = _rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}

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

# ── skipping ────────────────────────────────────────────────────────────────
#
# Two hops to the cycle, left then right, with the free knee up and the opposite
# arm up with it. The bounce lives in `@root` — a skip that keeps its hips at a
# constant height is a walk with the knees raised.


def _skip(sgn, up, lift):
    """One half-cycle. `sgn` +1 stands on the left foot, −1 on the right."""
    s = sgn
    return {
        "@root": (0.0, 0.0, up),
        "pelvis": (-4, 0, -5 * s),
        "spine01": (-2, 0, 2 * s), "spine02": (-2, 0, 2 * s),
        "spine03": (-3, 0, 1 * s),
        "chest": (-5, 0, 0), "neck": (4, 0, 0), "head": (-3, -10 * s, 2),
        "clavicleL": (0, 0, 4), "clavicleR": (0, 0, -4),
        # The arm opposite the raised knee comes up; the other swings back.
        "armUL": (-52 * s, 0, 30 + 12 * s), "armLL": (-46, 0, 4),
        "handL": (-8, 0, 0),
        "armUR": (52 * s, 0, -30 + 12 * s), "armLR": (-46, 0, -4),
        "handR": (-8, 0, 0),
        # Stance leg nearly straight, free leg with the knee up.
        "legUL": ((10 if s > 0 else -58 - lift * 40), 0, 4),
        "legLL": ((8 if s > 0 else 84), 0, 0),
        "footL": ((-10 if s > 0 else -24), 0, 0),
        "legUR": ((-58 - lift * 40 if s > 0 else 10), 0, -4),
        "legLR": ((84 if s > 0 else 8), 0, 0),
        "footR": ((-24 if s > 0 else -10), 0, 0),
    }


SKIP_L = _skip(1, -0.04, 0.0)     # landing on the left
SKIP_LU = _skip(1, 0.13, 1.0)     # and airborne off it
SKIP_R = _skip(-1, -0.04, 0.0)
SKIP_RU = _skip(-1, 0.13, 1.0)

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
     "keys": [(0.0, SKIP_L), (0.20, SKIP_LU), (0.40, SKIP_R), (0.60, SKIP_RU),
              (0.80, SKIP_L)]},
]


VIEWS = {
    "front": (0.0, 4.0, 0.95, 4.2, 760, 1120),
    "side": (90.0, 4.0, 0.95, 4.2, 760, 1120),
    "hero": (34.0, 8.0, 0.95, 3.9, 760, 1120),
    "face": (2.0, 2.0, 1.612, 0.46, 900, 900),
    "head": (30.0, 5.0, 1.615, 0.52, 900, 900),
    "prof": (88.0, 2.0, 1.615, 0.50, 900, 900),
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

    if "--reskin" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        _lights()
        for name in argv[argv.index("--reskin") + 1:]:
            if name.startswith("-") or name not in globals():
                break
            pose(rig, globals()[name])
            # Hero and side only. Front tells you almost nothing about a pose
            # whose whole content is sagittal, and every view is 25 s of EEVEE.
            render(name.lower(), ("hero", "side"))
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
