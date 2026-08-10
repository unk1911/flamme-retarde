"""Bake the promenade dog for the game.

    blender --background --python tools/blender/dog.py

Writes build/payload/dog.fr3d.gz, which build.py inlines.

Unlike every other model in this project, the geometry here was not authored.
`landmarks.py` builds four buildings out of boxes and domes, `human_mh.py` grows
a woman out of MakeHuman and a thousand lines of joint angles, and both of those
are worth the trouble because they are *specific*: that cathedral, that
promenade, that figure. A dog on a beach is not specific. It is a dog on a
beach, and the honest cheapest way to get one is to take a public-domain mesh
somebody has already made well and spend the effort on where it stands and what
it does instead. See assets/README.md for what it is and where it came from.

So this file is mostly a conversion, and the conversion is where all the
decisions are.

── the three things a foreign mesh always gets wrong ─────────────────────────

**Which way is forward.** The game's rigs face +X — `human_mh.py` says so at
length, and getting it wrong is what once had her crawling backwards. This mesh
faces −Y: its Head bone sits at y −1.389 and its Hips at +0.641, measured rather
than eyeballed, and a quarter turn about Z is what reconciles them.

**How big it is.** glTF carries no unit, and this one arrives with its armature
scaled 39.55 and a body 2.66 units tall, which is a number about nothing. A pug
stands about 30 cm at the shoulder and about 36 cm to the top of its head, so
that is what it is scaled to — and then dropped so the lowest vertex is exactly
z = 0, because the runtime puts it on the ground by its origin and a model with
its feet somewhere near the middle of itself hovers or sinks.

**Where the colour lives.** Nothing in this world is textured; every surface is
a colour per vertex, sampled by one shared material. This mesh keeps its two
colours in two Blender materials, so it is split along that seam into two
objects and handed to `export` as two parts. That is not a workaround, it is
what `export` is for — `landmarks.py` hands it eleven parts for the cathedral
for exactly the same reason.

── the armature ──────────────────────────────────────────────────────────────

The first pass dropped it: a rig that nothing plays is dead weight in a payload
inlined into every download. It is kept now, and the dog ships skinned — v4,
the same format the figure uses, read by the same hundred lines in
`src/41-skin.js`. `skinnedFigure` turns out to be entirely general once
`opts.face` is left off, so the runtime cost of this was close to nothing and
all of the work is here.

Two things about this particular rig are worth knowing before touching it.

**The feet are not on the legs.** `FrontFoot.R`, `BackFoot.L` and their pair are
children of `root` — siblings of `Body`, not the ends of the leg chains. Posing
a leg does not move its foot. It reads as a mistake and is not one: it puts foot
placement in root space, where a walk cycle wants it, instead of at the end of
an accumulating chain. The price is that nothing keeps the two in agreement, so
a gait has to drive the legs and the feet and be right about both.

**The clip format carries rotation, and translation for the root only.** That is
`frskin.py`'s constraint, not this file's, and it decides which of the two
shipped actions can be used. `Idle` animates translation on one bone, so it
bakes losslessly. `Jump` animates it on nine, so most of what makes it a jump
would arrive as a rest offset — a dog subtly coming apart rather than one
obviously broken. `bake_action` measures the drop and prints it rather than
leaving it to be noticed, and Jump is not shipped until it has been looked at.

Chasing the jet, shaking off, and looking up at her are in no pack anyway, so
they will be authored. That is the next pass and it goes here.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Matrix  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import reset_scene  # noqa: E402
from frskin import (MAX_INFLUENCES, bake_action, rest_locals,  # noqa: E402
                    write_skin)

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / "assets" / "pug.glb"
OUT = ROOT / "build" / "payload"

# To the top of the head, in metres. A pug is 25–30 cm at the shoulder; this
# mesh is stylised and carries a lot of its height in the skull, so it is set by
# the whole animal rather than by the shoulder and comes out about right beside
# a 1.75 m woman.
HEIGHT = 0.36

# Its own two materials, kept. They are a warm fawn and a near-black mask, which
# is what a pug is, and both sit inside the range the rest of the resort uses —
# the deck is 0.70 grey, her skin is 0.76/0.59/0.47. The temptation to "fix"
# them is worth resisting until it has been seen on the deck at the hour the
# game is actually played at.
COLOURS = {
    "Beige": (0.639, 0.483, 0.270),
    "Brown": (0.032, 0.011, 0.007),
}

# Levels of Catmull-Clark before the split. The asset is 644 faces, which is a
# sensible budget for something the size of a footstool seen from across a
# promenade and not a sensible one for something you can crouch down next to —
# and you can, because the balloon only comes up inside 21 m and the whole point
# of it is to be read. One level takes it to 1 932 faces — 3 536 vertices across
# the two colour parts — for a few KB in a 12 MB download.
#
# One and not two. Catmull-Clark does not add detail, it removes corners: the
# limit surface is smoother than the cage everywhere, and on a stylised low-poly
# animal the second level starts eating the very things that make it read as a
# pug — the flat muzzle, the square jaw, the creases. Anything past this wants a
# better cage, not more subdivision of this one.
SUBDIV = 1

# (action-name prefix, loops). The importer suffixes actions with the object
# they came off, so these are prefixes rather than names.
#
# Idle only, for now. `Jump` is in the file and is not here: it animates
# translation on nine bones and the clip format carries translation for the
# root alone, so most of what makes it a jump would arrive as a rest offset.
# `bake_action` prints exactly how much would be lost, which is the number to
# look at before deciding whether to author the jump instead of importing it.
CLIPS = [("Armature|Idle", True)]


def fix_actions(scale):
    """Scale every `location` channel in every action by `scale`.

    This is the part of baking the armature's 39.55 into its bone data that is
    not free. A pose bone's `location` is in armature-object space, so it does
    not follow a transform applied to the bone data underneath it: leave it and
    the rest skeleton is five metres of dog while the animation that moves it
    is still authored in fortieths. The visible symptom is not a broken dog but
    a still one, because every translation in every clip has been divided by
    five and change.

    Rotations need nothing — they are scale-free — and there is no non-uniform
    case to worry about because the armature arrives at 39.55 on all three.
    """
    n = 0
    for act in bpy.data.actions:
        for fc in act.fcurves:
            if not fc.data_path.endswith("location"):
                continue
            n += 1
            for kp in fc.keyframe_points:
                kp.co.y *= scale
                kp.handle_left.y *= scale
                kp.handle_right.y *= scale
    print("[dog] scaled %d location channels by %.3f" % (n, scale))


def build():
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC))

    dog = bpy.data.objects.get("Pug")
    if dog is None:
        sys.exit("[dog] no 'Pug' mesh in %s" % SRC)
    rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if rig is None:
        sys.exit("[dog] no armature in %s" % SRC)

    # World matrices before anything is unparented, because unparenting is what
    # loses them. The file also contains a unit Icosphere at the origin with no
    # materials and no parent, a `RootNode` empty that both of these hang off,
    # and a tree of `_end` empties the glTF importer makes for every bone tail.
    # None of it is the dog.
    dog_mw, rig_mw = dog.matrix_world.copy(), rig.matrix_world.copy()
    for ob in list(bpy.data.objects):
        if ob is not dog and ob is not rig:
            bpy.data.objects.remove(ob, do_unlink=True)
    for ob in (dog, rig):
        ob.parent = None
    # The deform modifier goes: nothing here evaluates it, `bpy.ops` on the mesh
    # below would have to reason about modifier order around it, and the only
    # thing the export needs from the binding is `vertex_groups`, which lives on
    # the object and stays.
    dog.modifiers.clear()

    # Bake the world matrices into the data before touching anything else, and
    # do not simply clear them. They are not the identity and not decoration:
    # the glTF importer's Y-up-to-Z-up conversion is in there, and so is the
    # armature's scale of 39.55, which the mesh inherited by being parented to
    # it. Clearing it — which the first version of this did — leaves the raw
    # mesh data lying on its side at a fortieth of its size, and every
    # measurement taken afterwards is of the wrong animal. It came out 0.27 m
    # nose to tail and 0.36 m tall, which is a dog standing on its hind legs.
    #
    # The armature gets the same treatment for a second reason on top of that
    # one. A clip frame stores a quaternion and, for the root, a translation —
    # there is nowhere to put a scale. So the skeleton has to be unit-scaled by
    # the time `rest_locals` reads it, which means the 39.55 has to live in the
    # bone data rather than on the object. See `fix_actions` for the part of
    # that which is not free.
    dog.data.transform(dog_mw)
    rig.data.transform(rig_mw)
    dog.matrix_world = rig.matrix_world = Matrix.Identity(4)

    # Measured on the mesh as it arrives, so this stays right if the asset is
    # ever replaced: turn the head onto +X, scale to HEIGHT, sit on z = 0. The
    # armature takes the identical transform, because the runtime derives the
    # inverse bind from the rest skeleton and a skeleton in a different space
    # from its mesh turns the dog inside out.
    fix = Matrix.Rotation(1.5707963267948966, 4, "Z")
    for d in (dog.data, rig.data):
        d.transform(fix)
    zs = [v.co.z for v in dog.data.vertices]
    k = HEIGHT / (max(zs) - min(zs))
    for d in (dog.data, rig.data):
        d.transform(Matrix.Scale(k, 4))
    zs = [v.co.z for v in dog.data.vertices]
    drop = Matrix.Translation((0.0, 0.0, -min(zs)))
    for d in (dog.data, rig.data):
        d.transform(drop)

    fix_actions(rig_mw.to_scale().x * k)

    xs = [v.co.x for v in dog.data.vertices]
    ys = [v.co.y for v in dog.data.vertices]
    zs = [v.co.z for v in dog.data.vertices]
    print("[dog] scaled x%.4f  nose-to-tail %.3f m  wide %.3f m  tall %.3f m"
          % (k, max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))

    # Smooth, and subdivided. Applied here rather than left as a modifier
    # because `bpy.ops.mesh.separate` below works on the cage and the exporter
    # reads `data.vertices`, so an unapplied modifier is a modifier that ships
    # as nothing at all. It goes *before* the split for the same reason it goes
    # after the scaling: Catmull-Clark on two objects that used to share an edge
    # pulls them apart along it, and the seam here runs right across the muzzle.
    bpy.context.view_layer.objects.active = dog
    dog.select_set(True)
    if SUBDIV:
        # Weld first, and this is not optional — it is the whole difference
        # between a dog and a heap of pebbles.
        #
        # The asset is authored flat-shaded, which means every face carries its
        # own copy of its corners and no two faces share an edge: 1 284 vertices
        # for what is topologically about 320. Catmull-Clark works on edges, so
        # on a mesh with no shared edges it does not smooth a surface, it rounds
        # off each face separately and pulls the results apart — the first run
        # of this came out as a Dalmatian made of loose brown lozenges with the
        # sea visible between them. Merging by distance restores the topology
        # the modelling had, and then the subdivision has something to hold on
        # to. 1e-4 m is a tenth of a millimetre on a half-metre animal, well
        # below any real feature and well above float noise from the scaling.
        before_v = len(dog.data.vertices)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=1e-4)
        bpy.ops.object.mode_set(mode="OBJECT")
        print("[dog] welded %d -> %d verts" % (before_v, len(dog.data.vertices)))

        before = len(dog.data.polygons)
        m = dog.modifiers.new("sub", "SUBSURF")
        m.levels = m.render_levels = SUBDIV
        bpy.ops.object.modifier_apply(modifier=m.name)
        print("[dog] subdivided %d -> %d faces at level %d"
              % (before, len(dog.data.polygons), SUBDIV))
    for p in dog.data.polygons:
        p.use_smooth = True

    # The colours were a material *split* while this was a v1 export, because
    # v1 takes a list of (object, colour) and has nowhere else to put them. The
    # skinned blob carries a colour per vertex, so the split is gone: the seam
    # is drawn by putting the colour in the dedupe key below, which gives a hard
    # edge across the muzzle in one line instead of two objects. It also quietly
    # retires the reason the subdivision had to happen before the split.
    names = [m.name if m else None for m in dog.data.materials]
    unknown = [n for n in names if n not in COLOURS]
    if unknown:
        sys.exit("[dog] material with no colour: %s" % unknown)
    palette = [COLOURS[n] for n in names]

    rest = rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}
    gname = {i: g.name for i, g in enumerate(dog.vertex_groups)}

    src = dog.data
    src.calc_loop_triangles()
    try:
        src.calc_normals_split()
    except (AttributeError, RuntimeError):
        pass

    def weights(vi):
        """Four (bone, weight) pairs as bytes summing to exactly 255.

        Exactly, not approximately: the shader adds four bone matrices scaled
        by these and does not renormalise, so a vertex whose weights come to
        0.99 is a vertex that shrinks towards the origin every frame.
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
        c8 = tuple(min(255, max(0, int(x * 255 + 0.5)))
                   for x in palette[tri.material_index])
        for li in tri.loops:
            vi = src.loops[li].vertex_index
            v = src.vertices[vi]
            n = src.loops[li].normal if src.loops[li].normal.length else v.normal
            if vi not in wcache:
                wcache[vi] = weights(vi)
                if not v.groups:
                    orphans += 1
            wi, ww = wcache[vi]
            co = (v.co.x, v.co.z, -v.co.y)
            nv3 = (n.x, n.z, -n.y)
            # Weights and colour both go in the key. Two vertices that agree on
            # position and normal but not on which bone owns them are two
            # vertices, and merging them welds a seam shut across a joint.
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
        print("[dog]   WARNING %d vertices had no bone weight at all" % orphans)

    baked = []
    for want, loop in CLIPS:
        act = next((a for a in bpy.data.actions if a.name.startswith(want)), None)
        if act is None:
            print("[dog]   no action starting '%s' — skipped" % want)
            continue
        baked.append(bake_action(rig, act, want.split("|")[-1].lower(),
                                 loop=loop, rest=rest))

    OUT.mkdir(parents=True, exist_ok=True)
    write_skin(OUT / "dog.fr3d.gz", pos, nrm, cols, bidx, bwgt, idx,
               rest, baked, note="dog")


if __name__ == "__main__":
    build()
