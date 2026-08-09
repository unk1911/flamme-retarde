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

── what is not here yet ──────────────────────────────────────────────────────

The armature, which is 24 bones and comes with Idle and Jump. It is deliberately
dropped: the first pass is a dog that stands on the promenade holding up the
DOGE price, and a rig that nothing plays is dead weight in a payload that is
inlined into every download. Exporting it means `export_rig` (v2) or the skinned
v3 path in `human_mh.py`, and either is a day's work with a floor pass for a
gait with four contacts a cycle rather than two. It is waiting, and this file is
where it will go.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Matrix  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import export, reset_scene  # noqa: E402

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


def build():
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC))

    dog = bpy.data.objects.get("Pug")
    if dog is None:
        sys.exit("[dog] no 'Pug' mesh in %s" % SRC)

    # The file also contains a unit Icosphere at the origin with no materials
    # and no parent, and a tree of `_end` empties that the glTF importer makes
    # for every bone tail. None of it is the dog.
    for ob in list(bpy.data.objects):
        if ob is not dog:
            bpy.data.objects.remove(ob, do_unlink=True)
    dog.modifiers.clear()          # the armature deform, whose armature is gone
    dog.parent = None

    # Bake the world matrix into the mesh data before touching anything else,
    # and do not simply clear it. It is not the identity and it is not
    # decoration: the glTF importer's Y-up-to-Z-up conversion is in there, and
    # so is the armature's scale of 39.55, which the mesh inherited by being
    # parented to it. Clearing it — which the first version of this did — leaves
    # the raw mesh data lying on its side at a fortieth of its size, and every
    # measurement taken afterwards is of the wrong animal. It came out 0.27 m
    # nose to tail and 0.36 m tall, which is a dog standing on its hind legs.
    dog.data.transform(dog.matrix_world)
    dog.matrix_world = Matrix.Identity(4)

    # Measured on the mesh as it arrives, so this stays right if the asset is
    # ever replaced: turn the head onto +X, scale to HEIGHT, sit on z = 0.
    dog.data.transform(Matrix.Rotation(1.5707963267948966, 4, "Z"))
    zs = [v.co.z for v in dog.data.vertices]
    k = HEIGHT / (max(zs) - min(zs))
    dog.data.transform(Matrix.Scale(k, 4))
    zs = [v.co.z for v in dog.data.vertices]
    dog.data.transform(Matrix.Translation((0.0, 0.0, -min(zs))))

    xs = [v.co.x for v in dog.data.vertices]
    ys = [v.co.y for v in dog.data.vertices]
    zs = [v.co.z for v in dog.data.vertices]
    print("[dog] scaled x%.4f  nose-to-tail %.3f m  wide %.3f m  tall %.3f m"
          % (k, max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))

    # Split along the material seam, which is where the colour boundary is, and
    # hand `export` one part per colour.
    names = [m.name if m else None for m in dog.data.materials]
    unknown = [n for n in names if n not in COLOURS]
    if unknown:
        sys.exit("[dog] material with no colour: %s" % unknown)

    bpy.context.view_layer.objects.active = dog
    dog.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")

    parts = []
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        mat = ob.data.materials[0].name if ob.data.materials else None
        parts.append((ob, COLOURS[mat]))
        print("[dog]   %-10s %-6s %5d verts" % (ob.name, mat, len(ob.data.vertices)))

    OUT.mkdir(parents=True, exist_ok=True)
    export(parts, OUT / "dog.fr3d.gz", note="dog")


if __name__ == "__main__":
    build()
