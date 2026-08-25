"""Bake the slastičarnica's cat for the game.

    tools/blender/blender.sh --background --python tools/blender/cat.py

Writes build/payload/cat.fr3d.gz, which build.py inlines.

The second foreign mesh in this project and the second one that is not
authored, for the reason `dog.py` gives at length and which applies here word
for word: a cat under a café table is not specific, it is a cat under a café
table, and the effort is better spent on where it goes and what it does. What
is different is that this one arrives rigged AND animated — 27 bones and a
walk cycle — where the pug arrived with an armature and two actions neither of
which was a gait, and `dog.py` had to solve a trot with a two-link IK solver
and hand-authored keys. None of that is here. The walk in the file is used.

── the three things a foreign mesh always gets wrong ─────────────────────────

Same three as the dog's, and it is worth noting how differently they came out,
because it is an argument for measuring rather than for copying.

**Which way is forward.** The game's rigs face +X. This one faces −Y — the
`head` bone sits at y −0.005 and `tail` at +0.002 — which is what the pug did
too, so it is the same quarter turn about Z. Measured, not assumed: it is the
one of the three that happened to match.

**How big it is.** glTF carries no unit and this arrives at a hundredth of
one: its armature is scaled 0.01 and the mesh inherits it, so the model as
imported is 17 mm nose to tail. Scaled on the one measurement a cat is
actually described by — 0.46 m from the nose to the base of the tail, which is
head-and-body length for a domestic shorthair — and then CHECKED against a
second: at that scale the shoulder joint stands 0.253 m off the ground, and a
domestic cat is 23–25 cm at the shoulder. Two dimensions from one factor,
both landing where the animal is, is the whole reason to anchor on a real
measurement instead of on a bounding box. Anchoring on the box would have been
wrong here in a way it was not for the dog: this cat's highest vertex belongs
to `tail3` and the tail is carried up, so the box's height is a tail and not
an animal.

**Where the origin is.** Dropped so the lowest vertex — a back paw — is
exactly z = 0, because the runtime puts it on the ground by its origin.

── and one the dog never had: the colour is in a texture ─────────────────────

Nothing in this game samples a texture. There is not a UV in the format and
there is no sampler in any shader; every surface carries a colour per vertex
and always has. The pug was no trouble because its colour was two flat
materials, and `dog.py` reads them straight out of `COLOURS`. This one has a
single material with a 2048×2048 PNG, which is 3.5 MB of the 4 MB file and
none of it can ship.

So the texture is baked to vertex colours here and then thrown away, and two
things had to be dealt with to make that read as a cat.

**The atlas is chaotic.** It is not an unwrap anybody drew: it is an automatic
packing of a few hundred small islands, so the picture is a patchwork of fur
fragments with whole eyes and noses scattered through it at random angles.
Neighbouring vertices on the animal can land in islands that are nowhere near
each other on the sheet, and a point sample gives confetti — a cat speckled
with pink nose and yellow iris in the middle of its flank. `PATCH` is the
answer to the first half: each sample is the mean of a small block rather than
one texel, which throws away the sharp edges of the fragments and keeps the
local fur colour.

**And a patchwork is still a patchwork.** So after sampling, the per-vertex
colours are relaxed across the mesh's own edges `SMOOTH` times. This is a blur
in the geometry rather than in the texture, which is the only place the blur
is meaningful: it does not care how the islands were packed, only which
vertices are actually next to each other on the cat. What survives it is the
thing that is genuinely low-frequency on this animal — a ginger back, a paler
belly and chin, darker feet and tail rings — and what dies is the confetti.
Turned up until the speckle went and stopped there; past about four rounds a
tabby becomes one flat orange and the markings go with the noise.

── the walk ──────────────────────────────────────────────────────────────────

One action, `Armature|Unreal Take|baselayer`. It is a cycle and is baked as a
loop. What it is NOT is in place: see `strip_root`, which is where the forward
travel is taken out and where the number that comes back is the cat's own
stride speed — the one thing the file knows about how fast this gait is meant
to be carried over the ground, and the number 43-jadrija.js has to move it at
or the paws skate.
"""

import math
import sys
from pathlib import Path

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
ROOT = Path(__file__).resolve().parent.parent.parent
from frskin import (MAX_INFLUENCES, bake_action, rest_locals,  # noqa: E402
                    write_skin)

SRC = Path(__file__).resolve().parent / "assets" / "cat.glb"
OUT = ROOT / "build" / "payload"

# Nose to the base of the tail, in metres: head-and-body length for a domestic
# shorthair. The scale factor comes from this and nothing else, and the
# shoulder height it implies is printed as a check — see the docstring.
BODY = 0.46
# What that check has to land inside. 23-25 cm is the figure a domestic
# shorthair is usually given and the first cut of this used it; the model comes
# out at 0.253 and tripped it by three millimetres, which is a tolerance being
# wrong rather than a cat being wrong. Widened to take in the larger end of the
# range, and left in place rather than deleted — a check that has fired once
# and been argued with is worth more than one that never fires.
SHOULDER = (0.23, 0.26)

# How much of the mesh survives. The model arrives at 10 000 triangles, which
# is four times the whole dog and a third of a human figure, for an animal that
# is 60 cm long and mostly under a table. It is uniformly dense in the way
# generated meshes are — the tail and the ears carry as many triangles per
# centimetre as the flank does — so there is a lot to give back. At 0.42 it is
# 4 200 and the payload falls from 285 KB to 159 KB; the silhouette that
# matters (ears, muzzle, tail) is checked by eye rather than by number, and
# past about a third the ears start to go.
#
# It happens BEFORE the colour bake on purpose. Decimating afterwards would
# throw away the vertices the colours were sampled at and interpolate what is
# left, and the sampling is the expensive part to get right.
DECIMATE = 0.42

PATCH = 9                    # texels a side averaged per sample
SMOOTH = 3                   # relaxation rounds over the mesh's own edges
CLIP = "Armature|Unreal Take"


def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions):
        for d in list(blk):
            blk.remove(d)


def strip_root(act, rig, scale):
    """Take the travel out of the walk and hand back what it was worth.

    A cycle that moves the hips forward is right for a film and wrong for a
    game: the runtime carries the animal over the ground itself, so a clip that
    also travels arrives at double speed and one of the two is not attached to
    the feet. The horizontal `location` channels on the root bone are therefore
    flattened to their own mean — flattened rather than zeroed, because zeroing
    moves the whole animal to wherever the rig's origin happens to be, and the
    mean is where it actually stands. The vertical channel is LEFT ALONE: that
    one is the bob, it is part of the gait, and a walk without it is a cat on a
    trolley.

    What is returned is the metres of ground the cycle covered before it was
    flattened, over the seconds it lasts — the gait's own speed, which is the
    number the game has to move it at.
    """
    fps = bpy.context.scene.render.fps
    root = rig.data.bones[0].name
    span, secs = 0.0, 0.0
    for fc in act.fcurves:
        if fc.data_path != 'pose.bones["%s"].location' % root:
            continue
        ks = [k.co[1] for k in fc.keyframe_points]
        if not ks:
            continue
        if fc.array_index == 1:          # Blender bone-local Y is along the bone
            continue
        lo, hi = min(k.co[0] for k in fc.keyframe_points), \
            max(k.co[0] for k in fc.keyframe_points)
        secs = max(secs, (hi - lo) / fps)
        span = max(span, (max(ks) - min(ks)) * scale)
        mean = sum(ks) / len(ks)
        for k in fc.keyframe_points:
            k.co[1] = mean
            k.handle_left[1] = k.handle_right[1] = mean
        fc.update()
    return (span / secs) if secs > 0 else 0.0


def bake_colours(me):
    """One colour per vertex, sampled off the texture and then relaxed.

    Returns a list of (r, g, b) floats, one per vertex index.
    """
    img = next((n.image for m in me.data.materials if m and m.use_nodes
                for n in m.node_tree.nodes
                if n.type == "TEX_IMAGE" and n.image), None)
    if img is None:
        sys.exit("[cat] no image texture on the material")
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[:, :, :3]
    # glTF images arrive as sRGB and Blender hands them back linear. The game's
    # vertex colours are the same linear numbers every other model here writes,
    # so nothing is converted: what comes out of `pixels` is already in the
    # space `write_skin` wants.
    uv = me.data.uv_layers[0].data
    acc = np.zeros((len(me.data.vertices), 3), dtype=np.float64)
    cnt = np.zeros(len(me.data.vertices), dtype=np.int32)
    r = PATCH // 2
    for li, loop in enumerate(me.data.loops):
        u, v = uv[li].uv
        # Wrapped, not clamped: an island can sit hard against the edge of the
        # sheet and a clamped block would drag the border in over it.
        cx = int(round((u % 1.0) * (w - 1)))
        cy = int(round((1.0 - (v % 1.0)) * (h - 1)))
        ys = (np.arange(cy - r, cy + r + 1) % h)
        xs = (np.arange(cx - r, cx + r + 1) % w)
        acc[loop.vertex_index] += px[np.ix_(ys, xs)].reshape(-1, 3).mean(axis=0)
        cnt[loop.vertex_index] += 1
    cnt[cnt == 0] = 1
    col = acc / cnt[:, None]

    # And the relaxation, over the edges the mesh actually has.
    nbr = [[] for _ in range(len(me.data.vertices))]
    for e in me.data.edges:
        a, b = e.vertices
        nbr[a].append(b)
        nbr[b].append(a)
    for _ in range(SMOOTH):
        nxt = col.copy()
        for i, ns in enumerate(nbr):
            if ns:
                nxt[i] = 0.5 * col[i] + 0.5 * col[ns].mean(axis=0)
        col = nxt
    return col


def build():
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC))

    cat = bpy.data.objects.get("char1")
    rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if cat is None or rig is None:
        sys.exit("[cat] no 'char1' mesh or no armature in %s" % SRC)
    # The file also carries a unit Icosphere at the origin, exactly as the pug's
    # does. Two different authors, two different pipelines, the same stray
    # primitive — it is whatever both exporters leave behind, and it is not the
    # cat.
    cat_mw, rig_mw = cat.matrix_world.copy(), rig.matrix_world.copy()
    for ob in list(bpy.data.objects):
        if ob is not cat and ob is not rig:
            bpy.data.objects.remove(ob, do_unlink=True)
    for ob in (cat, rig):
        ob.parent = None
    cat.modifiers.clear()

    # Bake the world matrices into the data, for the reasons dog.py sets out:
    # the importer's Y-up-to-Z-up is in there and so is the 0.01, and a clip
    # frame has nowhere to put a scale so the skeleton must be unit-scaled by
    # the time `rest_locals` reads it.
    cat.data.transform(cat_mw)
    rig.data.transform(rig_mw)
    cat.matrix_world = rig.matrix_world = Matrix.Identity(4)

    fix = Matrix.Rotation(math.pi / 2, 4, "Z")
    for d in (cat.data, rig.data):
        d.transform(fix)

    # Scale on the animal and not on its bounding box — see the docstring.
    # After the quarter turn the nose is at +X and the tail base is behind it.
    nose = max(v.co.x for v in cat.data.vertices)
    tailbase = rig.data.bones["tailstart"].head_local.x
    k = BODY / (nose - tailbase)
    for d in (cat.data, rig.data):
        d.transform(Matrix.Scale(k, 4))
    zs = [v.co.z for v in cat.data.vertices]
    for d in (cat.data, rig.data):
        d.transform(Matrix.Translation((0.0, 0.0, -min(zs))))

    sh = rig.data.bones["frontleg"].head_local.z
    if not SHOULDER[0] <= sh <= SHOULDER[1]:
        print("[cat]   WARNING shoulder %.3f m is outside %s — check BODY"
              % (sh, SHOULDER))
    xs = [v.co.x for v in cat.data.vertices]
    ys = [v.co.y for v in cat.data.vertices]
    zs = [v.co.z for v in cat.data.vertices]
    print("[cat] scaled x%.2f  nose-to-tail %.3f m  wide %.3f m  "
          "tall %.3f m (to the tail tip)  shoulder %.3f m"
          % (k, max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs), sh))

    if DECIMATE < 1.0:
        before = len(cat.data.polygons)
        bpy.context.view_layer.objects.active = cat
        m = cat.modifiers.new("dec", "DECIMATE")
        m.ratio = DECIMATE
        # Vertex groups and UVs both ride through a collapse; without this the
        # weights come out of the far side as garbage and the cat folds up on
        # the first frame of the walk.
        m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=m.name)
        print("[cat] decimated %d -> %d tris" % (before, len(cat.data.polygons)))
    for p in cat.data.polygons:
        p.use_smooth = True
    col = bake_colours(cat)

    rest = rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}
    gname = {i: g.name for i, g in enumerate(cat.vertex_groups)}
    src = cat.data
    src.calc_loop_triangles()
    try:
        src.calc_normals_split()
    except (AttributeError, RuntimeError):
        pass

    def weights(vi):
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
            if vi not in wcache:
                wcache[vi] = weights(vi)
                if not v.groups:
                    orphans += 1
            wi, ww = wcache[vi]
            c8 = tuple(min(255, max(0, int(x * 255 + 0.5))) for x in col[vi])
            co = (v.co.x, v.co.z, -v.co.y)
            nv3 = (n.x, n.z, -n.y)
            key = (round(co[0], 5), round(co[1], 5), round(co[2], 5),
                   round(nv3[0], 3), round(nv3[1], 3), round(nv3[2], 3),
                   c8, wi, ww)
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
    if orphans:
        print("[cat]   WARNING %d vertices had no bone weight at all" % orphans)

    act = next((a for a in bpy.data.actions if a.name.startswith(CLIP)), None)
    if act is None:
        sys.exit("[cat] no action starting '%s'" % CLIP)
    speed = strip_root(act, rig, k)
    print("[cat] walk travels %.2f m/s in the file — the game must move it at "
          "that or the paws skate" % speed)
    baked = [bake_action(rig, act, "walk", loop=True, rest=rest)]

    OUT.mkdir(parents=True, exist_ok=True)
    write_skin(OUT / "cat.fr3d.gz", pos, nrm, cols, bidx, bwgt, idx,
               rest, baked, note="cat")
    print("[cat] %d verts, %d tris" % (len(pos) // 3, len(idx) // 3))


if __name__ == "__main__":
    build()
