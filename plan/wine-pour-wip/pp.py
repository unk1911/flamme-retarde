"""Scratch probe: load human_mh.py as a module (so main() does not run), pose the
rig with whatever dict I name, and print where a bottle welded to `handR` ends up.

    FR_ROOT=$PWD tools/blender/blender.sh -b build/human_mh.blend -P <this> \
        -- [--cand cand.py] POSE ...

Frame: Blender/game space, x forward, y her LEFT, z up from the ground.
Figure space (what the JS sees) is (x, z, -y) of that: x fwd, y up, z her right.
"""
import importlib.util, sys, os
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(os.environ.get('FR_ROOT', '.')).resolve()
spec = importlib.util.spec_from_file_location(
    'mh', ROOT / 'tools' / 'blender' / 'human_mh.py')
mh = importlib.util.module_from_spec(spec)
sys.modules['mh'] = mh
spec.loader.exec_module(mh)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
rig = bpy.data.objects['rig']

GRIP = 0.185
LIP = 0.300
BASE = Vector((0.403, -0.020, 0.728))          # the bottle's foot at rest
BGRIP = BASE + Vector((0, 0, GRIP))            # where her palm has to be to take it
POUR = Vector((0.286, -0.062, 0.958))          # where the lip has to end up

IDLE_PALM = Vector((0.0, 0.045, -0.075))
IDLE_AXIS = Vector((0.0, 0.0, 1.0))


def delta():
    pb = rig.pose.bones['handR']
    return (pb.matrix.to_quaternion()
            @ pb.bone.matrix_local.to_quaternion().inverted())


def tofig(v):
    return (v.x, v.z, -v.y)


mh.pose(rig, mh.IDLE_A)
d0 = delta().inverted()
PALM = d0 @ IDLE_PALM
AXIS = d0 @ IDLE_AXIS
print('[pp] PALM(fig) %+.4f %+.4f %+.4f   GRIP_UP(fig) %+.4f %+.4f %+.4f'
      % (tofig(PALM) + tofig(AXIS)))

ns = dict(mh.__dict__)
cand = {}
if '--cand' in argv:
    p = Path(argv[argv.index('--cand') + 1])
    exec(compile(p.read_text(), str(p), 'exec'), ns)
    cand = {k: v for k, v in ns.items()
            if k.startswith('W_') and isinstance(v, dict)}


def frame(name, d):
    mh.pose(rig, d)
    pb = rig.pose.bones['handR']
    wrist = rig.matrix_world @ pb.head
    dq = delta()
    axis = dq @ AXIS
    palm = wrist + dq @ PALM
    foot = palm - axis * GRIP
    lip = palm + axis * (LIP - GRIP)
    tilt = Vector((0, 0, 1)).angle(axis) * 180 / 3.14159265
    sh = rig.matrix_world @ rig.pose.bones['armUR'].head
    head = rig.matrix_world @ rig.pose.bones['head'].head
    elb = rig.matrix_world @ rig.pose.bones['armLR'].head
    print('[pp] %-13s palm(%+.3f %+.3f %+.3f) tilt %5.1f  arm %.3f  '
          'take %.3f  pourgap %.3f  lipmiss %.3f  head(%+.3f %+.3f %+.3f)'
          % (name, *palm, tilt, (wrist - sh).length,
             (palm - BGRIP).length, (palm - POUR).length, (lip - POUR).length,
             *head))
    # Second line: the things a pour is judged on that a palm alone does not
    # say — where the shoulder and elbow actually are (a straight arm is the
    # solver hitting its own reach cap, not a pose), where the bottle's foot
    # ends up (it must not be inside her or inside the stool), and how far the
    # pose's own axis is from the direction the runtime aim will demand. That
    # last number is the whole bug: the runtime always hits the glass, so what
    # you see is not the miss but the snap it takes to cover it.
    want = (POUR - palm)
    snap = want.angle(axis) * 180 / 3.14159265 if want.length > 1e-6 else 0.0
    print('[pp]   %-11s sh(%+.3f %+.3f %+.3f) elb(%+.3f %+.3f %+.3f) '
          'foot(%+.3f %+.3f %+.3f) fore %.3f  aimtilt %5.1f  snap %5.1f'
          % ('', *sh, *elb, *foot, (wrist - elb).length,
             Vector((0, 0, 1)).angle(want.normalized()) * 180 / 3.14159265
             if want.length > 1e-6 else 0.0, snap))


for name in argv:
    if name.startswith('-'):
        continue
    if name in cand:
        frame(name, cand[name])
    elif hasattr(mh, name):
        frame(name, getattr(mh, name))
for name in sorted(cand):
    if name not in argv:
        frame(name, cand[name])
