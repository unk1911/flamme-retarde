"""Render a pour candidate with the bottle actually in the hand.

`pp.py` prints where the bottle lands; this draws it. The numbers cannot tell
you that a wrist has folded back on itself or that the bottle's shoulder is
inside her forearm, and those are exactly the two things the complaint was
about — "as if the wine bottle gets lodged in her hand" is not a measurement.

Everything the game does to place the bottle is repeated here in the same
order as 43-jadrija.js: palm and grip axis out of the hand's own frame, then
the pour aim as the smallest correction on top, then the grip sliding along
the bottle by whatever is left. So what comes out of this is what the browser
will draw, minus the room's lighting.

    FR_ROOT=$PWD tools/blender/blender.sh -b build/human_mh.blend -P <this> \
        -- --cand cand2.py --views q side front POSE ...

Pictures land in build/preview/ as pv_<pose>_<view>.png.
"""
import importlib.util, sys, os, math
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Quaternion, Matrix

ROOT = Path(os.environ.get('FR_ROOT', '.')).resolve()
spec = importlib.util.spec_from_file_location(
    'mh', ROOT / 'tools' / 'blender' / 'human_mh.py')
mh = importlib.util.module_from_spec(spec)
sys.modules['mh'] = mh
spec.loader.exec_module(mh)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
rig = bpy.data.objects['rig']

GRIP, LIP = 0.185, 0.300
BASE = Vector((0.403, -0.020, 0.728))     # the bottle's foot at rest
STOOL = Vector((0.403, -0.020, 0.000))    # the tabouret's axis
GLASS = Vector((0.286, -0.062, 0.728))    # the glass's foot
POUR = GLASS + Vector((0, 0, 0.230))      # where the lip has to end up
IDLE_PALM = Vector((0.0, 0.045, -0.075))
IDLE_AXIS = Vector((0.0, 0.0, 1.0))
UP = Vector((0, 0, 1))

# The Dingač, off the same profile 43-jadrija.js lathes: 306 mm, 77 across the
# body, the shoulder falling over 85 mm to a 29 mm neck.
BOTTLE = [(0.000, 0.0300), (0.005, 0.0368), (0.014, 0.0385), (0.146, 0.0385),
          (0.158, 0.0380), (0.171, 0.0364), (0.186, 0.0326), (0.201, 0.0266),
          (0.215, 0.0203), (0.229, 0.0162), (0.243, 0.0146), (0.286, 0.0144),
          (0.294, 0.0158), (0.303, 0.0160), (0.306, 0.0152)]
GLASSP = [(0.000, 0.0180), (0.004, 0.0300), (0.010, 0.0290), (0.020, 0.0058),
          (0.074, 0.0053), (0.082, 0.0180), (0.093, 0.0320), (0.109, 0.0398),
          (0.130, 0.0425), (0.152, 0.0398), (0.168, 0.0350)]


def lathe(name, prof, seg=24):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for h, r in prof:
        rings.append([bm.verts.new((math.cos(a) * r, math.sin(a) * r, h))
                      for a in (i * 2 * math.pi / seg for i in range(seg))])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.rotation_mode = 'QUATERNION'
    return ob


def flat(ob, rgb):
    m = bpy.data.materials.new(ob.name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.35
    ob.data.materials.append(m)


def delta():
    pb = rig.pose.bones['handR']
    return (pb.matrix.to_quaternion()
            @ pb.bone.matrix_local.to_quaternion().inverted())


def seg_gap(p0, p1, q0, q1):
    """Closest approach of two segments.

    This is the number the pour is really failing on, and neither the palm nor
    the tilt can see it. A bottle is 77 mm across and a forearm about 70, and
    the grip point sits only 44 mm off the wrist joint — so the moment the
    bottle's axis lies along her forearm, parallel *or* anti-parallel, half the
    bottle is inside her arm. That is what "lodged in her hand" looks like from
    the outside, and it is decided by the roll of the wrist, which is invisible
    in every other measurement because the bottle is a solid of revolution.
    """
    u, v, w = p1 - p0, q1 - q0, p0 - q0
    a, b, c = u.dot(u), u.dot(v), v.dot(v)
    d, e = u.dot(w), v.dot(w)
    den = a * c - b * b
    if den < 1e-9:
        sc, tc = 0.0, (e / c if c > 1e-9 else 0.0)
    else:
        sc = (b * e - c * d) / den
        tc = (a * e - b * d) / den
    sc = min(1.0, max(0.0, sc))
    tc = min(1.0, max(0.0, tc))
    # One Gauss-Seidel pass back over the clamps, which is enough for two
    # segments that are never far from crossing.
    tc = min(1.0, max(0.0, (b * sc + e) / c)) if c > 1e-9 else 0.0
    sc = min(1.0, max(0.0, (b * tc - d) / a)) if a > 1e-9 else 0.0
    return ((p0 + u * sc) - (q0 + v * tc)).length


mh.pose(rig, mh.IDLE_A)
d0 = delta().inverted()
PALM = d0 @ IDLE_PALM
AXIS = d0 @ IDLE_AXIS

bottle = lathe('bottle', BOTTLE)
flat(bottle, (0.045, 0.075, 0.038))
glass = lathe('glass', GLASSP)
glass.location = GLASS
flat(glass, (0.72, 0.78, 0.80))
seat = lathe('seat', [(0.658, 0.148), (0.664, 0.168), (0.716, 0.168),
                      (0.722, 0.150)])
seat.location = STOOL
flat(seat, (0.42, 0.30, 0.20))
stream = lathe('stream', [(0.0, 0.0032), (1.0, 0.0030)], 8)
flat(stream, (0.36, 0.06, 0.10))
mh._lights()


def place(name, d, pour=1.0, held=1.0):
    """Where the game would draw the bottle for this pose. Same order as
    `drawFigure` in 43-jadrija.js, including the aim correction and the grip
    sliding to absorb whatever the aim could not."""
    mh.pose(rig, d)
    dq = delta()
    wrist = rig.matrix_world @ rig.pose.bones['handR'].head
    palm = wrist + dq @ PALM
    axis = (dq @ AXIS).normalized()
    grip = GRIP
    if pour > 0:
        want = POUR - palm
        reach = want.length
        want /= reach
        fix = Quaternion().slerp(axis.rotation_difference(want), pour)
        axis = (fix @ axis).normalized()
        grip += (min(max(LIP - reach, GRIP - 0.055), GRIP + 0.035) - GRIP) * pour
    foot = palm - axis * grip
    # And the take and the set-down, which the game lerps between the stool and
    # the hand — so a preview that always draws the bottle in her hand cannot
    # see the two seconds of the clip where it is half the room's.
    rest_q = Quaternion()
    aim = UP.rotation_difference(axis)
    if held < 1.0:
        foot = BASE.lerp(foot, held)
        aim = rest_q.slerp(aim, held)
    bottle.location = foot
    bottle.rotation_quaternion = aim
    lip = foot + aim @ Vector((0, 0, LIP))
    cup = GLASS + Vector((0, 0, 0.122))
    stream.location = (lip.x, lip.y, cup.z)
    stream.scale = (1, 1, max(0.001, lip.z - cup.z))
    # Same two tests the game makes: a stream only while the pour is past 0.6
    # and the bottle is hers, and none at all if the lip is not over the glass.
    stream.hide_render = (pour < 0.6 or held < 0.9
                          or abs(lip.x - GLASS.x) > 0.09
                          or abs(lip.y - GLASS.y) > 0.09)
    elb = rig.matrix_world @ rig.pose.bones['armLR'].head
    sh = rig.matrix_world @ rig.pose.bones['armUR'].head
    fore = seg_gap(foot, foot + axis * LIP, elb, wrist)
    upper = seg_gap(foot, lip, sh, elb)
    print('[pv] %-12s palm(%+.3f %+.3f %+.3f) foot(%+.3f %+.3f %+.3f) '
          'tilt %5.1f grip %.3f lipmiss %.4f  fore %.3f upper %.3f  '
          'held %.2f pour %.2f'
          % (name, *palm, *foot, math.degrees((aim @ UP).angle(UP)), grip,
             (lip - POUR).length, fore, upper, held, pour))
    return palm


# Cameras, aimed at the pour rather than at her midline: azimuth 0 is in front
# of her, +90 is her left, so her right side is -60 and -90. `q` is the angle
# the complaint came from — her right and slightly forward, looking down at the
# stool the way you would if you were standing in the doorway.
CAMS = {
    'q':     (-58.0, 18.0, 1.02, 1.55),
    'side':  (-92.0, 10.0, 1.00, 1.40),
    'front': (-12.0, 14.0, 1.05, 1.55),
    'over':  (-70.0, 52.0, 0.95, 1.35),
}
OUT = ROOT / 'build' / 'preview'
OUT.mkdir(parents=True, exist_ok=True)


def shoot(tag, views):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 32
    sc.eevee.use_gtao = True
    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = 60
    cam = bpy.data.objects.new('cam', cam_d)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    for v in views:
        az, el, tz, rad = CAMS[v]
        tgt = Vector((0.30, -0.10, tz))
        a, e = math.radians(az), math.radians(el)
        cam.location = tgt + Vector((math.cos(a) * math.cos(e) * rad,
                                     math.sin(a) * math.cos(e) * rad,
                                     math.sin(e) * rad))
        cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x, sc.render.resolution_y = 760, 760
        sc.render.filepath = str(OUT / ('pv_%s_%s.png' % (tag, v)))
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


ns = dict(mh.__dict__)
cand = {}
eaten = set()
if '--cand' in argv:
    for a in argv[argv.index('--cand') + 1:]:
        if a.startswith('-') or not a.endswith('.py'):
            break
        eaten.add(a)
        f = Path(a)
        exec(compile(f.read_text(), str(f), 'exec'), ns)
    cand = {k: v for k, v in ns.items()
            if k.startswith('W_') and isinstance(v, dict)}

views = ('q', 'side')
if '--views' in argv:
    got = []
    for n in argv[argv.index('--views') + 1:]:
        if n.startswith('-') or n not in CAMS:
            break
        got.append(n)
        eaten.add(n)
    if got:
        views = tuple(got)

def sat(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)


def wine_at(u):
    """`wineAt` out of src/43-jadrija.js, kept here so a preview cannot
    disagree with the game about when the bottle is in her hand."""
    return (sat((u - 1.10) / 0.35) * (1 - sat((u - 4.40) / 0.30)),
            sat((u - 2.05) / 0.50) * (1 - sat((u - 3.20) / 0.40)))


def clip_pose(name, t):
    """The blend `_bake_clip` would hand the exporter at time `t`.

    Rendering only the keys answers the wrong question. A key is a pose
    somebody chose and looked at; what the complaint was about is the seven
    frames between two of them, and those are the smoothstep's business rather
    than anybody's."""
    keys = next(c for c in mh.CLIPS if c['name'] == name)['keys']
    i = 0
    while i < len(keys) - 2 and keys[i + 1][0] <= t:
        i += 1
    (t0, p0), (t1, p1) = keys[i], keys[i + 1]
    u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
    return mh._lerp_pose(p0, p1, u * u * (3.0 - 2.0 * u))


if '--clip' in argv:
    which = argv[argv.index('--clip') + 1]
    ats = []
    for a in argv[argv.index('--clip') + 2:]:
        try:
            ats.append(float(a))
        except ValueError:
            break
    for t in ats:
        held, pour = wine_at(t)
        place('%s@%.2f' % (which, t), clip_pose(which, t), pour, held)
        shoot('%s_%05.2f' % (which, t), views)
    print('[pv] %d clip frames -> %s' % (len(ats), OUT))
    raise SystemExit

names = [n for n in argv if not n.startswith('-') and n not in eaten
         and (n in cand or isinstance(getattr(mh, n, None), dict))]
for n in names:
    d = cand[n] if n in cand else getattr(mh, n)
    place(n, d, 0.0 if 'NOPOUR' in argv else 1.0)
    shoot(n.lower(), views)
print('[pv] %d poses -> %s' % (len(names), OUT))
