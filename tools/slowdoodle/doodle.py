#!/usr/bin/env python3
"""The Slow Doodle, as a rigged and animated GLB. Runs in Blender.

    blender -b -noaudio -P tools/slowdoodle/doodle.py -- <out.glb> [stage]

── what he is ────────────────────────────────────────────────────────────────

The reference is the picture on poetry.edeliverables.com: a sleek black dog of
doberman build, tall upright ears, a long tail carried up in a curve, a mane of
flame-orange hair streaming back off his head and neck, a smaller orange tuft
over the hips, a gold filigree breastplate with a red stone, and gold armoured
boots on all four paws. The poems call him "a smudge of gold, a cloud of
cream", which is not what the picture shows; the picture is what was pointed
at, and the viewer has the cream coat as a variant.

── what is authored and what is not ──────────────────────────────────────────

The lesson of the humanoids, which cost an evening to learn: before generating
anything, look for the thing somebody has already made well. A dog is not
specific. A dog with a rig, a walk and an idle is a solved problem, and
Quaternius solved it under CC0 — `tools/blender/assets/wolf.glb`, 51 bones with
an eight-bone tail, four-bone ears and a three-bone neck, and a dozen actions.

So the body is his, re-proportioned; what is written here is only what makes
this dog THIS dog. The mane and the tuft are alpha-cut hair cards textured from
the MakeHuman community's own CC0 hair, not ribbons — four procedural attempts
at hair on the humanoids read as straw and as a werewolf, and a card with a
real strand texture on it is what every hairstyle in that library is.

── the rig, and the one thing about it that has to change ────────────────────

The wolf's paws are weighted to foot bones parented to ROOT-level IK targets,
and the legs themselves carry the IK result baked as FK rotations. The two
agree on the proportions the artist animated and on no others: lengthen a leg
and the paw stays where the IK target is while the leg ends somewhere else.
`dog.py` hit the same thing on the pug and solved it the same way — the paws
are re-parented on to the lower legs and the IK bones go.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'tools' / 'blender' / 'assets' / 'wolf.glb'
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(argv[0]) if argv else ROOT / 'build' / 'slowdoodle' / 'slowdoodle.glb'
STAGE = argv[1] if len(argv) > 1 else 'all'

# Height at the withers, in metres. A doberman dog stands 0.66 to 0.72; he is
# drawn as a big, tall-standing animal and a doodle is not a small dog.
WITHERS = 0.68


def log(*a):
    print('[doodle]', *a)


# ── load, and take what is not his away ──────────────────────────────────── #

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
ar = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.vertex_groups)
body.name = 'coat'
for o in list(bpy.context.scene.objects):
    if o not in (ar, body):
        bpy.data.objects.remove(o, do_unlink=True)
ar.name = 'rig'
log('base: %d verts, %d bones, %d actions'
    % (len(body.data.vertices), len(ar.data.bones), len(bpy.data.actions)))

# The importer leaves two copies of every clip — one named for the armature and
# one not. Keep one per clip, the one that actually drives pose bones.
seen = {}
for act in list(bpy.data.actions):
    base = act.name.split('|')[-1].replace('_AnimalArmature', '')
    n = sum(1 for fc in act.fcurves if fc.data_path.startswith('pose.bones'))
    if n == 0 or base in seen:
        bpy.data.actions.remove(act)
        continue
    act.name = base
    seen[base] = act
if ar.animation_data:
    for t in list(ar.animation_data.nla_tracks):
        ar.animation_data.nla_tracks.remove(t)
    ar.animation_data.action = None
log('clips:', ', '.join(sorted(seen)))


def to_arm(v):
    """World to armature space. The rig sits under a x100 object scale."""
    return ar.matrix_world.inverted() @ v


def edit(fn):
    bpy.ops.object.select_all(action='DESELECT')
    ar.select_set(True)
    bpy.context.view_layer.objects.active = ar
    bpy.ops.object.mode_set(mode='EDIT')
    fn(ar.data.edit_bones)
    bpy.ops.object.mode_set(mode='OBJECT')


# ── the paws on to the legs, and the IK rig gone ─────────────────────────── #

IK = ('IKBackLeg.L', 'IKBackLeg.R', 'IKFrontLeg.L', 'IKFrontLeg.R',
      'PoleTargetBack.L', 'PoleTarget.L', 'PoleTargetBack.R', 'PoleTarget.R')
PAWS = {'FF.L': 'FrontLowerLeg.L', 'FF.R': 'FrontLowerLeg.R',
        'FFB.L': 'BackLowerLeg.L', 'FFB.R': 'BackLowerLeg.R'}


def unik(eb):
    for paw, leg in PAWS.items():
        eb[paw].parent = eb[leg]
        eb[paw].use_connect = False
    for n in IK:
        eb.remove(eb[n])


edit(unik)
for act in bpy.data.actions:
    for fc in list(act.fcurves):
        b = fc.data_path.split('"')[1] if fc.data_path.startswith('pose.bones') else ''
        if b in IK or b in PAWS:
            act.fcurves.remove(fc)


# ── the silhouette ───────────────────────────────────────────────────────── #
#
# Two tools, for two kinds of change.
#
# LENGTHS are a warp of space applied identically to every vertex and every
# joint, so the weights stay right by construction: the leg is stretched
# between the top of the paw and the elbow and nowhere else, so it gets longer
# without getting thicker and the paw keeps its own proportions.
#
# ANGLES are poses — the neck lifted, the head levelled, the tail carried up —
# baked into the mesh by the armature and then made the new rest. The baked
# clips are rotations relative to rest, so they carry over; a walk on a dog
# whose head is carried higher is the same walk with the head higher.

def warp_z(z):
    """Stretch the legs: identity to the top of the paw, x1.12 to the belly."""
    PAW, BELLY, K = 0.30, 1.30, 1.12
    if z <= PAW:
        return z
    if z <= BELLY:
        return PAW + (z - PAW) * K
    return PAW + (BELLY - PAW) * K + (z - BELLY)


def warp(p):
    """WORLD point to its new place. Forward is -y, up is z.

    World and not armature space: the rig sits under a x100 object scale, so
    armature space is the world divided by a hundred and every constant here
    would be a hundred times too big in it.
    """
    x, y, z = p
    # SHORTER IN THE BODY. A doberman is square — as long from chest to rump
    # as he is tall at the withers — and a wolf is not. The span between the
    # shoulder and the hip is taken in by 12 per cent and everything behind
    # it, hind legs and tail included, comes forward with it.
    S0, S1, KS = -0.90, 0.62, 0.88
    if y > S0:
        y = S0 + (min(y, S1) - S0) * KS + max(0.0, y - S1)
    # And deeper in the chest: the brisket let down between the forelegs.
    if -1.35 < y < -0.45 and 1.10 < z < 1.65:
        w = (1.0 - abs(y + 0.90) / 0.45) * (1.0 - abs(z - 1.38) / 0.28)
        z -= 0.07 * max(0.0, w)
    # The waist: a doberman is deep in the chest and tight in the loin. The
    # underline between the ribs and the stifle is lifted, which is the tuck.
    loin = max(0.0, 1.0 - abs(y - 0.25) / 0.55)          # peaks over the loin
    under = max(0.0, min(1.0, (1.75 - z) / 0.45))        # only the belly half
    z += 0.16 * loin * under * (1.0 if z > 1.1 else 0.0)
    # ...and the flanks drawn in a little, the same place.
    x *= 1.0 - 0.10 * loin * max(0.0, min(1.0, (z - 1.2) / 0.5))
    # The ruff: the wolf wears a thick collar of fur round the throat, which
    # is a wolf thing and not a doberman thing, and the mane covers the crest
    # anyway. Pulled in toward the neck's own axis.
    if -1.75 < y < -0.95 and z > 1.45:
        ax = Vector((0.0, y, 1.95 + (-(y + 0.95)) * 0.20))
        d = Vector((x, 0.0, z)) - Vector((0.0, 0.0, ax.z))
        w = max(0.0, 1.0 - abs(y + 1.35) / 0.45)
        x *= 1.0 - 0.18 * w
    return Vector((x, y, warp_z(z)))


def do_warp():
    mw = ar.matrix_world
    mwi = mw.inverted()
    bw = body.matrix_world
    bwi = bw.inverted()
    for v in body.data.vertices:
        v.co = bwi @ warp(bw @ v.co)

    def eb_fn(eb):
        for b in eb:
            b.head = mwi @ warp(mw @ Vector(b.head))
            b.tail = mwi @ warp(mw @ Vector(b.tail))
    edit(eb_fn)


do_warp()
log('warped: legs x1.12, loin tucked, ruff drawn in')


def rot_about(pb, axis, deg):
    """Rotate a pose bone about a WORLD-ish axis through its own head.

    Written in armature space, because these bones are points — head and tail
    a few thousandths apart — so each one's local axes are an accident of
    whichever way that tiny tail happened to point, and 'rotate X by ten
    degrees' in bone space means something different on every bone.
    """
    M = pb.matrix.copy()
    h = M.to_translation()
    R = Matrix.Rotation(math.radians(deg), 4, axis)
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()


def scale_about(pb, s):
    M = pb.matrix.copy()
    h = M.to_translation()
    S = Matrix.Diagonal((s, s, s, 1.0))
    pb.matrix = Matrix.Translation(h) @ S @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()


# A positive turn about +x takes (0, -1, 0) to (0, -cos, -sin): the FRONT
# end goes DOWN and the back end up. So the neck lifts on a negative angle and
# the tail on a positive one.
POSE = [
    ('Neck1', 'X', -20.0),    # the neck carried up off the withers
    ('Neck2', 'X', -14.0),
    ('Neck3', 'X', -6.0),
    ('Head', 'X', 26.0),      # and the head levelled back so the muzzle is not skyward
    # THE TAIL IS A SABRE, NOT A FLAG. In the picture it leaves the croup
    # nearly level, hangs a little, and then sweeps up into a high curl at the
    # tip. Lifting it at the root — the first attempt — stood it straight up.
    ('Tail1', 'X', -4.0),
    ('Tail3', 'X', 6.0),
    ('Tail4', 'X', 12.0),
    ('Tail5', 'X', 18.0),
    ('Tail6', 'X', 22.0),
    ('Tail7', 'X', 24.0),
    ('Tail8', 'X', 18.0),
]
EARS = [('Ear1.L', 1.28), ('Ear1.R', 1.28)]


def remodel_pose():
    bpy.ops.object.select_all(action='DESELECT')
    ar.select_set(True)
    bpy.context.view_layer.objects.active = ar
    bpy.ops.object.mode_set(mode='POSE')
    for pb in ar.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    for name, ax, deg in POSE:
        rot_about(ar.pose.bones[name], ax, deg)
    for name, s in EARS:
        scale_about(ar.pose.bones[name], s)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Bake the pose into the coat, then make it the rest.
    bpy.context.view_layer.objects.active = body
    mod = next(m for m in body.modifiers if m.type == 'ARMATURE')
    name = mod.name
    bpy.ops.object.modifier_apply(modifier=name)
    bpy.context.view_layer.objects.active = ar
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    m = body.modifiers.new('rig', 'ARMATURE')
    m.object = ar


remodel_pose()
log('posed and re-rested: neck up, head level, tail carried, ears x1.28')


# ── the parts that are not length or angle ────────────────────────────────── #

def weight_of(v, names):
    gi = {body.vertex_groups[n].index for n in names if n in body.vertex_groups}
    return sum(g.weight for g in v.groups if g.group in gi)


def bone_world(name):
    b = ar.data.bones[name]
    return ar.matrix_world @ b.head_local


def slim_tail(k=0.62):
    """Pull the tail's fur in toward its own spine.

    The wolf's is a brush; his is long and full but not a bottle-brush. Each
    vertex moves toward the nearest point on the polyline through the tail
    joints, by as much of the way as it belongs to the tail — so the root,
    which is shared with the croup, barely moves and the rest thins evenly.
    """
    names = ['Tail%d' % i for i in range(1, 9)]
    pts = [bone_world(n) for n in names] + [ar.matrix_world @ ar.data.bones['Tail8'].tail_local]
    bw, bwi = body.matrix_world, body.matrix_world.inverted()
    for v in body.data.vertices:
        w = weight_of(v, names)
        if w <= 0.0:
            continue
        p = bw @ v.co
        best, bd = None, 1e9
        for a, b in zip(pts, pts[1:]):
            ab = b - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            q = a + ab * t
            d = (p - q).length
            if d < bd:
                best, bd = q, d
        f = 1.0 - (1.0 - k) * min(1.0, w)
        v.co = bwi @ (best + (p - best) * f)


def longer_muzzle(d=0.16):
    """Draw the muzzle out. A wolf's is short and broad; a doberman's is long.

    Everything weighted to the head and in front of the eyes moves forward by
    an amount that grows toward the nose, so the stop stays where it is and
    the nose leather goes furthest.
    """
    h = bone_world('Head')
    bw, bwi = body.matrix_world, body.matrix_world.inverted()
    for v in body.data.vertices:
        w = weight_of(v, ['Head'])
        if w <= 0.0:
            continue
        p = bw @ v.co
        ahead = (h.y - 0.12) - p.y          # forward is -y
        if ahead <= 0.0:
            continue
        t = min(1.0, ahead / 0.40)
        p.y -= d * t * w
        v.co = bwi @ p


def tall_ears(along=1.30, across=0.86):
    """Taller, narrower ears — his stand up like a doberman's cropped ones.

    Not a pose: a scale along an arbitrary axis is a shear in a bone's own
    frame, and a pose cannot hold a shear. So it is a warp, like the legs:
    each ear vertex, and each ear joint above the root, is stretched along the
    line from the ear's root to its tip and drawn in across it.
    """
    mw, mwi = ar.matrix_world, ar.matrix_world.inverted()
    bw, bwi = body.matrix_world, body.matrix_world.inverted()
    for side in ('L', 'R'):
        names = ['Ear%d.%s' % (i, side) for i in range(1, 5)]
        root = bone_world(names[0])
        tip = mw @ ar.data.bones[names[-1]].tail_local
        ax = (tip - root).normalized()

        def f(p):
            d = p - root
            a = d.dot(ax)
            return root + ax * (a * along) + (d - ax * a) * across

        for v in body.data.vertices:
            w = min(1.0, weight_of(v, names))
            if w <= 0.0:
                continue
            p = bw @ v.co
            v.co = bwi @ (p + (f(p) - p) * w)

        def eb_fn(eb, names=names, f=f):
            for n in names[1:]:
                eb[n].head = mwi @ f(mw @ Vector(eb[n].head))
                eb[n].tail = mwi @ f(mw @ Vector(eb[n].tail))
        edit(eb_fn)


slim_tail(0.78)
longer_muzzle()
tall_ears()
log('tail slimmed, muzzle drawn out, ears stood up')


def subdivide(levels=1):
    """Catmull-Clark once, applied UNDER the rig so the weights come along.

    The base is 2 000 flat triangles, which is a style — Quaternius's — and not
    his. Subdividing before the armature in the stack interpolates every
    vertex group across the new vertices, so the result is still skinned.
    """
    # WELD FIRST. The base is flat-shaded the way Quaternius ships everything:
    # every face owns its own three vertices, 3 994 of them for 2 042
    # triangles. Catmull-Clark on that rounds each face on its own and the dog
    # comes out covered in pebbles. Welded, it is one surface and it smooths
    # as one. The threshold is in the mesh's own units, which are the world's
    # over a hundred.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-6)
    bm.to_mesh(body.data)
    bm.free()
    log('welded %d -> %d verts' % (n0, len(body.data.vertices)))
    bpy.context.view_layer.objects.active = body
    m = body.modifiers.new('sub', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    bpy.ops.object.modifier_move_to_index(modifier='sub', index=0)
    bpy.ops.object.modifier_apply(modifier='sub')
    for poly in body.data.polygons:
        poly.use_smooth = True


subdivide(1)
log('subdivided: %d verts, %d tris' % (
    len(body.data.vertices), sum(len(p.vertices) - 2 for p in body.data.polygons)))


# ── size, facing, floor ──────────────────────────────────────────────────── #

def world_pts():
    return [body.matrix_world @ v.co for v in body.data.vertices]


def extent():
    P = world_pts()
    return (Vector([min(p[i] for p in P) for i in range(3)]),
            Vector([max(p[i] for p in P) for i in range(3)]))


if STAGE == 'shape':
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT.with_suffix('.shape.blend')))
    log('saved', OUT.with_suffix('.shape.blend'))
    raise SystemExit


# ── metres, +x forward, feet on the floor ────────────────────────────────── #
#
# Done on the OBJECT, not baked into the bones. The clips carry a few
# translations (the body's bob, the back's heave) in bone-local units, and
# applying a scale to an armature rescales the rest and not the keys, so a
# baked scale is a dog whose walk no longer bobs. The GLB carries the node
# transform and three.js composes it; the fr3d conversion that puts him in the
# game will bake it the way dog.py does for the pug, on purpose and once.

def place():
    P = [body.matrix_world @ v.co for v in body.data.vertices]
    wy = bone_world('Torso2').y
    withers = max(p.z for p in P if abs(p.y - wy) < 0.18)
    s = WITHERS / withers
    R = Matrix.Rotation(math.radians(90.0), 4, 'Z')      # -y forward -> +x
    S = Matrix.Diagonal((s, s, s, 1.0))
    ar.matrix_world = R @ S @ ar.matrix_world
    bpy.context.view_layer.update()
    lo = min((body.matrix_world @ v.co).z for v in body.data.vertices)
    ar.matrix_world = Matrix.Translation((0.0, 0.0, -lo)) @ ar.matrix_world
    bpy.context.view_layer.update()
    P = [body.matrix_world @ v.co for v in body.data.vertices]
    mn = [min(p[i] for p in P) for i in range(3)]
    mx = [max(p[i] for p in P) for i in range(3)]
    log('placed: x%.4f, %.2f m nose to tail, %.2f m tall to the ear tips, '
        'feet at %.3f' % (s, mx[0] - mn[0], mx[2] - mn[2], mn[2]))
    return s


SCALE = place()

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parts  # noqa: E402

JAW = parts.build_all(ar, body)

import author  # noqa: E402

# Not him: he does not attack, he does not die, and he does not flinch. The
# slow doodle's repertoire is what the poems say he does.
for n in ('Attack', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right',
          'Jump_ToIdle', 'Gallop_Jump'):
    if n in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions[n])
author.proud_walk(ar)
author.author_all(ar)
log('clips now:', ', '.join(sorted(a.name for a in bpy.data.actions)))


def export():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=str(OUT), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=False, export_skins=True,
        export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_frame_step=1,
        export_morph=False, export_materials='EXPORT',
        export_image_format='AUTO')
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in bpy.context.scene.objects if o.type == 'MESH')
    log('exported %s  %.2f MB  %d tris  %d clips'
        % (OUT.name, OUT.stat().st_size / 1e6, tris, len(bpy.data.actions)))


export()
