"""Solve wine poses: pattern-search the rig angles that put the welded bottle's
grip point on a target with its axis pointing where I want, staying near a
hand-authored prior so the answer is a pose and not a contortion.

    FR_ROOT=$PWD tools/blender/blender.sh -b build/human_mh.blend -P <this> -- jobs.json
"""
import importlib.util, sys, os, math, json
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(os.environ.get('FR_ROOT', '.')).resolve()
spec = importlib.util.spec_from_file_location(
    'mh', ROOT / 'tools' / 'blender' / 'human_mh.py')
mh = importlib.util.module_from_spec(spec)
sys.modules['mh'] = mh
spec.loader.exec_module(mh)

rig = bpy.data.objects['rig']
IDLE_PALM = Vector((0.0, 0.045, -0.075))
IDLE_AXIS = Vector((0.0, 0.0, 1.0))
UP = Vector((0, 0, 1))


def delta():
    pb = rig.pose.bones['handR']
    return (pb.matrix.to_quaternion()
            @ pb.bone.matrix_local.to_quaternion().inverted())


mh.pose(rig, mh.IDLE_A)
d0 = delta().inverted()
PALM = d0 @ IDLE_PALM
AXIS = d0 @ IDLE_AXIS

# bone, component, lo, hi.  armLR[0] is written raw and STAND_ELBOW_UNDO added.
KNOBS = [
    ('spine02', 0, -15, 2), ('spine03', 0, -15, 2), ('chest', 0, -12, 2),
    ('clavicleR', 2, -18, 4),
    ('armUR', 0, -72, 5), ('armUR', 1, -34, 24), ('armUR', 2, -56, 4),
    ('armLR', 0, -34, 6), ('armLR', 1, -62, 62), ('armLR', 2, -34, 8),
    ('handR', 0, -40, 55), ('handR', 1, -55, 55), ('handR', 2, -55, 55),
]
FIXED = {'spine02': (None, 0.0, 1.0), 'spine03': (None, 0.0, 0.5),
         'chest': (None, 0.0, 0.0), 'clavicleR': (0.0, 0.0, None),
         'armUR': (None, None, None), 'armLR': (None, None, None),
         'handR': (None, None, None)}


def build(x):
    d = dict(mh.IDLE_A)
    acc = {b: list(FIXED[b]) for b in FIXED}
    for (bone, i, _lo, _hi), v in zip(KNOBS, x):
        acc[bone][i] = v + (mh.STAND_ELBOW_UNDO if (bone == 'armLR' and i == 0) else 0)
    for b, v in acc.items():
        d[b] = tuple(round(q or 0.0, 2) for q in v)
    return d


def measure(d):
    mh.pose(rig, d)
    pb = rig.pose.bones['handR']
    wrist = rig.matrix_world @ pb.head
    sh = rig.matrix_world @ rig.pose.bones['armUR'].head
    dq = delta()
    return wrist + dq @ PALM, dq @ AXIS, (wrist - sh).length


def cost(x, job, prior, wa, lam):
    palm, axis, arm = measure(build(x))
    reg = sum(((a - b) / 30.0) ** 2 for a, b in zip(x, prior))
    over = max(0.0, arm - 0.470) * 4.0
    if job.get('kind') == 'pour':
        # The lip has to land on the glass, so what is fixed is the distance
        # from the palm to it and the direction of the bottle, not the palm.
        d = Vector(job['at']) - palm
        e = abs(d.length - job['gap'])
        want = d.normalized()
        da = (axis - want).length
        tl = math.degrees(UP.angle(want))
        c = e * e + wa * da * da + ((tl - job['tilt']) / 57.3) ** 2 * job.get('wt', 0.05)
        return c + lam * reg + over * over, e, math.degrees(UP.angle(axis))
    want = Vector(job['axis']).normalized()
    e = (palm - Vector(job['palm'])).length
    da = (axis - want).length
    return (e * e + wa * da * da + lam * reg + over * over, e,
            math.degrees(UP.angle(axis)))


def solve(prior, job, wa, lam, rounds=7):
    x = list(prior)
    c, e, t = cost(x, job, prior, wa, lam)
    step = 6.0
    for _r in range(rounds):
        moved = True
        while moved:
            moved = False
            for i, (_b, _i, lo, hi) in enumerate(KNOBS):
                for s in (step, -step):
                    v = min(hi, max(lo, x[i] + s))
                    if v == x[i]:
                        continue
                    y = list(x)
                    y[i] = v
                    c2, e2, t2 = cost(y, job, prior, wa, lam)
                    if c2 < c - 1e-8:
                        x, c, e, t = y, c2, e2, t2
                        moved = True
        step *= 0.55
    return x, e, t


JOBS = json.loads(Path(sys.argv[sys.argv.index('--') + 1]).read_text())
for job in JOBS:
    x, e, t = solve(job['prior'], job, job.get('wa', 0.06), job.get('lam', 0.004))
    d = build(x)
    palm, axis, arm = measure(d)
    print('[sv] %-8s err %.4f  tilt %5.1f  arm %.3f  axis(%+.3f %+.3f %+.3f) '
          'palm(%+.3f %+.3f %+.3f)'
          % (job['name'], e, t, arm, *axis, *palm))
    print('[sv]   x = %s' % json.dumps([round(v, 1) for v in x]))
    for k in ('spine02', 'spine03', 'chest', 'clavicleR', 'armUR', 'armLR', 'handR'):
        print('[sv]      "%s": %s,' % (k, tuple(d[k])))
