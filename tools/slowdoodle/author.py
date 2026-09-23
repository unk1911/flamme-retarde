"""The two things he does that no animal pack has: the lazy sway, and the yawn.

"A lazy sway, a soulful gaze ... a heart open, yawning wide."

── how a pose is written here ────────────────────────────────────────────────

As turns about WORLD axes — his forward (+x), his side (+y), up (+z) — and
converted into each bone's own rest frame. The Quaternius bones are points,
head and tail a hair apart, so their local axes are an accident of whichever
way the tail happened to point, and "pitch the neck ten degrees" in bone space
means a different thing on every bone. Written about the world's axes, it
means one thing.

Signs, measured rather than assumed: a positive turn about +y takes +x
(his nose) toward -z, so the head goes UP on a negative pitch and the jaw
OPENS on a positive one. About +x, positive rolls his back toward +y.
"""
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 30
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def rest_rot(ar, name):
    Rw = ar.matrix_world.to_quaternion().to_matrix()
    return Rw @ ar.data.bones[name].matrix_local.to_3x3()


def local_q(ar, name, turns):
    """Compose [(world axis, degrees), ...] and express it in the bone's frame."""
    B = rest_rot(ar, name)
    R = Matrix.Identity(3)
    for ax, deg in turns:
        R = Matrix.Rotation(math.radians(deg), 3, ax) @ R
    return (B.inverted() @ R @ B).to_quaternion()


def local_loc(ar, name, v):
    """A world-metre offset, as the bone's pose location (bone-local units)."""
    B = rest_rot(ar, name)
    s = ar.matrix_world.to_scale().x
    return B.inverted() @ (v / s)


def keyed(ar, act_name, frames, pose_at, loop):
    """`pose_at(t)` returns {bone: [(axis, deg), ...]} plus optional
    {'_loc': {bone: Vector}}; sampled every frame, which is what the GLB
    exporter does to everything anyway."""
    act = bpy.data.actions.new(act_name)
    act.use_fake_user = True
    # A new action has no idea what it animates until it is assigned, and the
    # glTF exporter's "all actions" mode skips any whose root is not OBJECT —
    # silently. The first build shipped without the yawn and nobody was told.
    act.id_root = 'OBJECT'
    curves = {}

    def fc(path, i, group):
        k = (path, i)
        if k not in curves:
            curves[k] = act.fcurves.new(path, index=i, action_group=group)
        return curves[k]

    for f in range(frames + 1):
        t = f / FPS
        P = pose_at(t)
        locs = P.pop('_loc', {})
        for b, turns in P.items():
            q = local_q(ar, b, turns)
            for i in range(4):
                fc('pose.bones["%s"].rotation_quaternion' % b, i, b).keyframe_points.insert(f, q[i], options={'FAST'})
        for b, v in locs.items():
            lv = local_loc(ar, b, v)
            for i in range(3):
                fc('pose.bones["%s"].location' % b, i, b).keyframe_points.insert(f, lv[i], options={'FAST'})
    for c in curves.values():
        c.update()
    return act


def ease(a, b, t0, t1, t):
    """Smooth ramp from a to b between t0 and t1."""
    if t <= t0:
        return a
    if t >= t1:
        return b
    u = (t - t0) / (t1 - t0)
    u = u * u * (3 - 2 * u)
    return a + (b - a) * u


def curve(t, keys):
    """Piecewise smooth through [(t, v), ...]."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return ease(v0, v1, t0, t1, t)
    return keys[-1][1]


# ── the lazy sway ─────────────────────────────────────────────────────────── #
#
# Four seconds, looped. His weight rolls slowly from one side to the other,
# the head drifts a beat behind it and tilts, the tail sweeps a beat behind
# THAT with the lag growing down its length, and the ears flick. The legs
# counter-roll at the shoulders and hips so the paws stay planted: a sway
# that slides his feet across the rock is a dog on ice.

SWAY_T = 4.0


def sway(t):
    ph = 2 * math.pi * t / SWAY_T
    s = math.sin(ph)
    roll = 2.6 * s
    P = {
        'Body': [(X, roll)],
        'Torso2': [(X, -0.8 * s)],
        'Neck1': [(Z, 4.0 * math.sin(ph - 0.6)), (Y, -1.5 * math.sin(2 * ph))],
        'Neck2': [(Z, 3.0 * math.sin(ph - 0.9))],
        'Head': [(X, 6.0 * math.sin(ph - 1.1)), (Y, 2.0 * math.sin(2 * ph + 0.4))],
        'Ear2.L': [(X, 4.0 * math.sin(ph - 1.4))],
        'Ear2.R': [(X, 4.0 * math.sin(ph - 1.4))],
        '_loc': {'Body': Vector((0.0, 0.011 * s, -0.003 * abs(s)))},
    }
    # The legs hang from a body that has rolled and shifted; turn them back
    # so each paw stays where it was. About 1.4 degrees undoes a centimetre
    # at the end of a 0.45 m leg.
    for leg in ('FrontShoulder.L', 'FrontShoulder.R', 'BackShoulder.L', 'BackShoulder.R'):
        P[leg] = [(X, -roll - 1.4 * s)]
    for i in range(1, 9):
        P['Tail%d' % i] = [(Z, (3.0 + 1.4 * i) * math.sin(ph - 0.38 * i))]
    return P


# ── the yawn ──────────────────────────────────────────────────────────────── #
#
# Once, about four seconds, and the jaw is the reason there is a jaw at all
# (see `cut_jaw` in parts.py). The head goes up first, the mouth opens slowly
# and then all the way, the ears fold back while it is wide, it holds with a
# small shudder, closes, and he gives his head the little shake a dog gives
# after a good yawn.

YAWN_T = 4.2


def yawn(t):
    head = curve(t, [(0.0, 0.0), (0.6, -12.0), (1.5, -22.0), (2.5, -20.0), (3.0, -6.0), (3.5, -2.0), (4.2, 0.0)])
    neck = curve(t, [(0.0, 0.0), (0.7, -6.0), (1.5, -9.0), (2.6, -8.0), (3.2, -2.0), (4.2, 0.0)])
    jaw = curve(t, [(0.0, 0.0), (0.5, 2.0), (1.0, 12.0), (1.55, 36.0), (2.45, 38.0), (2.85, 6.0), (3.1, 0.0), (4.2, 0.0)])
    ears = curve(t, [(0.0, 0.0), (1.1, 0.0), (1.6, 22.0), (2.5, 22.0), (3.0, 0.0), (4.2, 0.0)])
    shiver = 1.4 * math.sin(t * 38.0) * ease(0, 1, 1.7, 1.9, t) * ease(1, 0, 2.3, 2.5, t)
    shake = 7.0 * math.sin((t - 3.1) * 26.0) * ease(0, 1, 3.1, 3.25, t) * ease(1, 0, 3.6, 3.9, t)
    lean = curve(t, [(0.0, 0.0), (1.4, -2.5), (2.6, -2.5), (3.4, 0.0)])
    P = {
        'Body': [(Y, lean)],
        'Neck1': [(Y, neck)],
        'Neck2': [(Y, neck * 0.6)],
        'Head': [(Y, head + shiver), (X, shake)],
        'Jaw': [(Y, jaw)],
        # An ear stands up, and a positive turn about +y leans +z toward +x:
        # forward. Folding back is negative.
        'Ear1.L': [(Y, -ears), (Z, -ears * 0.3)],
        'Ear1.R': [(Y, -ears), (Z, ears * 0.3)],
    }
    for leg in ('FrontShoulder.L', 'FrontShoulder.R', 'BackShoulder.L', 'BackShoulder.R'):
        P[leg] = [(Y, -lean)]
    for i in range(1, 9):
        P['Tail%d' % i] = [(Z, (2.0 + 0.8 * i) * math.sin(t * 2.6 - 0.35 * i))]
    return P


def author_all(ar):
    bpy.context.scene.render.fps = FPS
    a = keyed(ar, 'Sway', int(SWAY_T * FPS), sway, loop=True)
    b = keyed(ar, 'Yawn', int(YAWN_T * FPS), yawn, loop=False)
    print('[author] Sway %d keys a curve, Yawn %d' % (int(SWAY_T * FPS) + 1, int(YAWN_T * FPS) + 1))
    return a, b


def proud_walk(ar, keep=0.45):
    """Carry the head up on the walk.

    The wolf trots head-low, which is a wolf; a slow doodle strolls with his
    head up. Each neck and head key is taken most of the way back toward the
    rest — the swing of it stays, the droop goes.
    """
    act = bpy.data.actions.get('Walk')
    if not act:
        return
    for b in ('Neck1', 'Neck2', 'Neck3', 'Head'):
        fcs = [act.fcurves.find('pose.bones["%s"].rotation_quaternion' % b, index=i) for i in range(4)]
        if not all(fcs):
            continue
        n = len(fcs[0].keyframe_points)
        for k in range(n):
            q = Quaternion([fcs[i].keyframe_points[k].co[1] for i in range(4)])
            q = Quaternion().slerp(q, keep)
            for i in range(4):
                fcs[i].keyframe_points[k].co[1] = q[i]
                fcs[i].keyframe_points[k].handle_left[1] = q[i]
                fcs[i].keyframe_points[k].handle_right[1] = q[i]
        for c in fcs:
            c.update()
