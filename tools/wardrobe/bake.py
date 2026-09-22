#!/usr/bin/env python3
"""Body plus every fitted asset, as one GLB of named parts. Runs in Blender.

`assets.py` has already done the hard part — each asset `.obj` in build/
wardrobe has been rewritten through its `.mhclo` into the base mesh's own
space. So everything here takes EXACTLY the transform the body takes: stand
the body up and the bikini is already on it.

Textures stay out of the GLB deliberately. The viewer swaps skin, hair and
swimwear at runtime, and a material whose map is a separate file can be
re-pointed in one line. The GLB carries geometry and UVs only.
"""
import json
import math
import sys
from pathlib import Path

import bpy  # type: ignore

ROOT = Path(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else Path.cwd()
WORK = ROOT / 'build' / 'wardrobe'
MAN = json.loads((WORK / 'manifest.json').read_text())

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(ROOT / 'build' / 'mh_base.obj'),
                      use_split_groups=True)
groups = {o.name.lower(): o for o in bpy.context.selected_objects}


def take(prefixes):
    # `helper-l-eye` is a PREFIX OF `helper-l-eyelashes-1`, so a plain
    # startswith puts all four lash groups into the eyeballs. Match on the
    # next character being a separator or nothing.
    got = []
    for n, o in groups.items():
        for p in prefixes:
            if n == p or n.startswith(p + '-') or n.startswith(p + '.'):
                got.append(o)
                break
    return got


def join(objs, name):
    if not objs:
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


# Every `take` is resolved BEFORE any `join`: join removes the objects it
# merged and `groups` is then holding dead pointers, which Blender reports as
# "StructRNA of type Object has been removed" on the next lookup.
picks = {'body': take(('body',)),
         'eyes': take(('helper-l-eye', 'helper-r-eye')),
         'mouth': take(('helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue'))}
keep = {k: join(v, k) for k, v in picks.items()}
body = keep['body']
bpy.ops.object.select_all(action='DESELECT')
for o in list(bpy.context.scene.objects):
    if o not in set(keep.values()):
        o.select_set(True)
bpy.ops.object.delete()

# ── the transform, derived once from the body and reused verbatim ─────────── #
sel = [o for o in keep.values() if o]
bpy.ops.object.select_all(action='DESELECT')
for o in sel:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
co = [v.co for v in body.data.vertices]
dz = max(c.z for c in co) - min(c.z for c in co)
dy = max(c.y for c in co) - min(c.y for c in co)
UP, h = ('z', dz) if dz > dy else ('y', dy)
S = 1.70 / h


def place(o):
    o.scale = (S, S, S)
    if UP == 'y':
        o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


for o in sel:
    place(o)
LO = min(v.co.z for v in body.data.vertices)


def drop(o):
    o.location.z = -LO
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True)


for o in sel:
    drop(o)
HI = max(v.co.z for v in body.data.vertices)
print('[bake] %.3f m tall' % HI)

for kind in ('hair', 'lash', 'brow', 'top', 'btm', 'leg'):
    for rec in MAN.get(kind, []):
        if 'obj' not in rec:
            continue
        before = set(bpy.context.scene.objects)
        bpy.ops.wm.obj_import(filepath=str(WORK / rec['obj']))
        o = join([x for x in bpy.context.scene.objects if x not in before],
                 '%s__%s' % (kind, rec['id']))
        place(o); drop(o)
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth()
        z = [v.co.z for v in o.data.vertices]
        print('[bake] %-5s %-40s %5d v  z %.2f..%.2f'
              % (kind, rec['id'], len(o.data.vertices), min(z), max(z)))

for o in sel:
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()

bpy.ops.object.select_all(action='SELECT')
p = WORK / 'wardrobe.glb'
bpy.ops.export_scene.gltf(filepath=str(p), export_format='GLB',
                          use_selection=True, export_apply=True,
                          export_yup=True, export_normals=True,
                          export_materials='NONE')
tri = lambda o: sum(len(f.vertices) - 2 for f in o.data.polygons)
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print('[bake] wardrobe.glb  %.2f MB  %d objects  %d tris'
      % (p.stat().st_size / 1e6, len(mesh), sum(tri(o) for o in mesh)))
