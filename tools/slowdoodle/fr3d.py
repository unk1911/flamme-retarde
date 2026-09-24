#!/usr/bin/env python3
"""The Slow Doodle, as a skinned .fr3d v5 blob for the game. Runs in Blender.

    blender -b -noaudio -P tools/slowdoodle/fr3d.py -- <in.glb> <out.fr3d.gz>

`tools/slowdoodle/game.py` is the driver and the thing to run; this is the
half of it that needs Blender.

── why not the GLB ───────────────────────────────────────────────────────────

The viewer draws him with three's own GLTFLoader, AnimationMixer and
MeshPhysicalMaterial. The game has none of the three, and wanting them would
be wanting a second renderer inside the first: every solid thing in Šibenik
is lit, hazed, shadowed and drowned by `solidMaterial`, and a dog drawn by a
PBR material under a different sun would be the one thing on the promenade
that was not standing in the same afternoon as everything else. So he goes the
way the pug and the cat went — through `readFR3DSkin` and `skinnedFigure` —
and this file is the conversion.

── one draw call for everything opaque ───────────────────────────────────────

He is nine flat materials (coat, the coat's lighter patches, eyes, nose, gold,
the stone, mouth, teeth, tongue) and one textured one, the mane. v5 carries a
UV and no vertex colour, and a part per material would be nine draw calls AND
nine meshes that do not cast — `skinnedFigure` registers the body alone with
the shadow pass. So every opaque vertex is written into the one `body` part
with its material's NUMBER in `u`, and the fragment picks the colour off that.
The boots and the breastplate cast with the coat, the only thing that does not
is the mane, and it is one extra draw.

── what the format drops, measured ───────────────────────────────────────────

The clips move `Body` (the root, carried) and a little of `Back` (dropped —
the format has a translation for the root only; `bake_action` prints how
much). Scale is folded into the bones the way `cat.py` folds it, location
channels included, because a pose bone's `location` does not follow a
transform applied to the armature data.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools' / 'blender'))
from frskin import MAX_INFLUENCES, bake_action, rest_locals  # noqa: E402
import gzip  # noqa: E402
import struct  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = Path(argv[0])
OUT = Path(argv[1])

# The GLB's clip names, to the game's. Lower case and short, the way the pug's
# and the cat's are, and named for what the viewer calls them.
CLIPS = {
    'Idle': ('idle', True),
    'Sway': ('sway', True),
    'Yawn': ('yawn', False),
    'Walk': ('walk', True),
    'Idle_2_HeadLow': ('gaze', True),
    'Eating': ('clover', True),
    'Idle_2': ('breeze', True),
    'Gallop': ('gallop', True),
}

# Material -> the number the body fragment switches on. Order is the shader's.
PALETTE = ['Main', 'Main_Light', 'Eyes_Black', 'Nose', 'gold', 'gem',
           'mouth', 'teeth', 'tongue']
HAIR = ('mane', 'tuft')

# How much of each part survives. The breastplate is 13 568 triangles of swept
# tube on a patch of chest that is forty pixels across at ten metres, and it
# is more than the whole coat; the boots are four thousand. Rigid parts, so a
# collapse cannot move anything to the wrong bone.
DECIMATE = {'plate': 0.28, 'paws': 0.45, 'cuffs': 0.5, 'girth': 0.6}


def log(*a):
    print('[doodle-fr3d]', *a)


def fix_actions(scale):
    """Location channels into metres. See `fix_actions` in tools/blender/cat.py."""
    for act in bpy.data.actions:
        for fc in act.fcurves:
            if not fc.data_path.endswith('location'):
                continue
            for kp in fc.keyframe_points:
                kp.co.y *= scale
                kp.handle_left.y *= scale
                kp.handle_right.y *= scale


def gait(rig, act):
    """Metres a second the walk's paws cover. See `gait` in tools/blender/cat.py."""
    scn = bpy.context.scene
    rig.animation_data.action = act
    f0, f1 = (int(round(v)) for v in act.frame_range)
    paws = ['FF.L', 'FF.R', 'FFB.L', 'FFB.R']
    lo = {b: 1e9 for b in paws}
    hi = {b: -1e9 for b in paws}
    for f in range(f0, f1 + 1):
        scn.frame_set(f)
        for b in paws:
            x = (rig.matrix_world @ rig.pose.bones[b].head).x
            lo[b] = min(lo[b], x)
            hi[b] = max(hi[b], x)
    secs = (f1 - f0) / scn.render.fps
    strides = [hi[b] - lo[b] for b in paws]
    log('walk: stride per paw %s m over %.2f s'
        % (' '.join('%.3f' % s for s in strides), secs))
    return sum(strides) / len(strides) / secs


def lowest(meshes, rig, act):
    """The lowest any vertex gets over a clip, with the rig deforming."""
    scn = bpy.context.scene
    rig.animation_data.action = act
    f0, f1 = (int(round(v)) for v in act.frame_range)
    low = 1e9
    for f in range(f0, f1 + 1, 2):
        scn.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for ob in meshes:
            ev = ob.evaluated_get(dg)
            me = ev.to_mesh()
            low = min(low, min(v.co.z for v in me.vertices))
            ev.to_mesh_clear()
    return low


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SRC))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    meshes = [o for o in bpy.context.scene.objects
              if o.type == 'MESH' and o.vertex_groups]
    for o in list(bpy.context.scene.objects):
        if o is not rig and o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)

    # The importer's Y-up turn and the x29.5 the rig was exported under, baked
    # into the data so the skeleton is unit-scaled when `rest_locals` reads it.
    rig_mw = rig.matrix_world.copy()
    scale = rig_mw.to_scale().x
    for ob in meshes:
        mw = ob.matrix_world.copy()
        ob.parent = None
        ob.data.transform(mw)
        ob.matrix_world = Matrix.Identity(4)
        for m in ob.modifiers:
            if m.type == 'ARMATURE':
                m.object = rig
    rig.data.transform(rig_mw)
    rig.matrix_world = Matrix.Identity(4)
    fix_actions(scale)
    bpy.context.view_layer.update()

    acts = {}
    for a in bpy.data.actions:
        base = a.name
        for suf in ('_rig', '_Armature'):
            if base.endswith(suf):
                base = base[:-len(suf)]
        if base in CLIPS:
            acts[base] = a
    missing = [k for k in CLIPS if k not in acts]
    if missing:
        sys.exit('[doodle-fr3d] clips missing: %s' % missing)
    if rig.animation_data is None:
        rig.animation_data_create()

    speed = gait(rig, acts['Walk'])
    log('walk: paws cover %.3f m/s at a clip rate of 1' % speed)
    for k in ('Idle', 'Walk', 'Eating', 'Yawn', 'Sway'):
        log('lowest vertex over %-7s %+.4f m' % (k, lowest(meshes, rig, acts[k])))
    rig.animation_data.action = None
    bpy.context.scene.frame_set(0)
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()

    for ob in meshes:
        r = DECIMATE.get(ob.name)
        if not r:
            continue
        before = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        bpy.context.view_layer.objects.active = ob
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.ratio = r
        m.use_collapse_triangulate = True
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0)
        bpy.ops.object.modifier_apply(modifier='dec')
        log('decimated %-6s %d -> %d tris' % (ob.name, before,
            sum(len(p.vertices) - 2 for p in ob.data.polygons)))

    rest = rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}

    # Two index lists, body first and hair after, sharing one vertex array.
    pos, nrm, uvs, bidx, bwgt = [], [], [], [], []
    tri = {'body': [], 'hair': []}
    lookup = {}
    for ob in meshes:
        me = ob.data
        try:
            me.calc_normals_split()
        except (AttributeError, RuntimeError):
            pass
        me.calc_loop_triangles()
        gname = {g.index: g.name for g in ob.vertex_groups}
        uvl = me.uv_layers[0].data if me.uv_layers else None
        wcache = {}

        def weights(vi):
            gs = [(g.weight, bindex[gname[g.group]]) for g in me.vertices[vi].groups
                  if g.group in gname and gname[g.group] in bindex and g.weight > 1e-4]
            if not gs:
                return (0, 0, 0, 0), (255, 0, 0, 0)
            gs.sort(reverse=True)
            gs = gs[:MAX_INFLUENCES]
            tot = sum(w for w, _ in gs)
            q = [max(0, min(255, int(round(w / tot * 255)))) for w, _ in gs]
            q[0] += 255 - sum(q)
            ix = [b for _, b in gs] + [0] * (MAX_INFLUENCES - len(gs))
            q += [0] * (MAX_INFLUENCES - len(q))
            return tuple(ix), tuple(q)

        for lt in me.loop_triangles:
            mname = me.materials[lt.material_index].name.split('.')[0] \
                if me.materials else 'Main'
            hair = mname in HAIR
            if not hair and mname not in PALETTE:
                sys.exit('[doodle-fr3d] unknown material %r on %s' % (mname, ob.name))
            corner = []
            for li in lt.loops:
                vi = me.loops[li].vertex_index
                v = me.vertices[vi]
                n = me.loops[li].normal
                if vi not in wcache:
                    wcache[vi] = weights(vi)
                wi, ww = wcache[vi]
                if hair:
                    u, w = uvl[li].uv
                    uv = (round(u, 5), round(w, 5))
                else:
                    uv = (float(PALETTE.index(mname)), 0.0)
                co = (v.co.x, v.co.z, -v.co.y)
                nn = (n.x, n.z, -n.y)
                key = (round(co[0], 5), round(co[1], 5), round(co[2], 5),
                       round(nn[0], 3), round(nn[1], 3), round(nn[2], 3),
                       uv, wi, ww)
                j = lookup.get(key)
                if j is None:
                    j = len(pos) // 3
                    lookup[key] = j
                    pos.extend(co)
                    nrm.extend(nn)
                    uvs.extend(uv)
                    bidx.extend(wi)
                    bwgt.extend(ww)
                corner.append(j)
            tri['hair' if hair else 'body'].extend(corner)

    idx = tri['body'] + tri['hair']
    groups = [('body', 0, 0, len(tri['body'])),
              ('mane', 1, len(tri['body']), len(tri['hair']))]

    baked = []
    for src, (name, loop) in CLIPS.items():
        baked.append(bake_action(rig, acts[src], name, loop=loop, rest=rest))

    nv, ni = len(pos) // 3, len(idx)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    parts = [struct.pack('<4sIII6fI', b'FR3D', 5, nv, ni,
                         min(xs), min(ys), min(zs), max(xs), max(ys), max(zs),
                         len(groups)),
             struct.pack('<%df' % (nv * 3), *pos),
             struct.pack('<%df' % (nv * 3), *nrm),
             struct.pack('<%df' % (nv * 2), *uvs),
             bytes(bidx), bytes(bwgt)]
    parts.append(b'\0' * ((-sum(len(p) for p in parts)) % 4))
    parts.append(struct.pack('<%dI' % ni, *idx))
    parts.append(struct.pack('<I', len(groups)))
    for name, mat, start, count in groups:
        nb = name.encode()
        parts.append(struct.pack('<H%dsIII' % len(nb), len(nb), nb, mat, start, count))
    parts.append(struct.pack('<I', len(rest)))
    for name, parent, _lb, lg in rest:
        nb = name.encode()
        t, q = lg.translation, lg.to_quaternion()
        parts.append(struct.pack('<H%dsi7f' % len(nb), len(nb), nb, parent,
                                 t.x, t.y, t.z, q.x, q.y, q.z, q.w))
    parts.append(struct.pack('<I', len(baked)))
    for c in baked:
        nb = c['name'].encode()
        parts.append(struct.pack('<H%dsfIB3x' % len(nb), len(nb), nb,
                                 c['dur'], len(c['frames']), 1 if c['loop'] else 0))
        for rt, quats in c['frames']:
            parts.append(struct.pack('<3f', *rt))
            for q in quats:
                parts.append(struct.pack('<4h', *q))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, 'wb', compresslevel=9) as f:
        f.write(b''.join(parts))
    log('%s  %d verts  %d tris (body %d, mane %d)  %d bones  %.0f KB gz'
        % (OUT.name, nv, ni // 3, len(tri['body']) // 3, len(tri['hair']) // 3,
           len(rest), OUT.stat().st_size / 1024))
    log('bounds x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f'
        % (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
    for c in baked:
        log('clip %-7s %5.2f s  %3d frames  %s' % (c['name'], c['dur'],
            len(c['frames']), 'loop' if c['loop'] else 'once'))


main()
