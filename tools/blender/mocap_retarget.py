#!/usr/bin/env python3
"""
Drive her rig from a CMU capture, and print the result as a pose ladder.

    tools/blender/blender.sh -b build/human_mh.blend \
        -P tools/blender/mocap_retarget.py -- \
        --asf /tmp/cmu/02.asf --amc /tmp/cmu/02_06.amc \
        --from 377 --to 575 --rest 300 --keys 14

WHAT RETARGETING ACTUALLY IS, in one paragraph. Two skeletons, different
proportions, different bone axes, and a rotation that means one thing on one
of them and something else on the other. What transfers is not the numbers —
it is where each bone is POINTING in the world. So for every bone: take the
capture's global orientation, take away the capture's own rest orientation to
leave the change, and apply that change to her bone's rest orientation. The
result is a global orientation for her bone, and Blender turns that back into
the local Euler her pose dicts are written in.

The two rests are what make it work. CMU's man and her figure do not stand
the same way, and subtracting each skeleton's own rest is what stops that
difference from being read as part of the movement.

THE MAPPING IS BY HAND and it has to be. CMU splits the spine into
lowerback/upperback/thorax and she has spine01/02/03 plus a chest; CMU has a
wrist AND a hand where she has one. Every one of those is a judgement.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'mocap'))
from asfamc import read_asf, read_amc, globals_at, pose_at  # noqa: E402

# CMU bone -> her bone. Left blank where the two rigs simply disagree.
MAP = {
    'lowerback': 'spine01', 'upperback': 'spine02', 'thorax': 'spine03',
    'lowerneck': 'neck', 'head': 'head',
    'lclavicle': 'clavicleL', 'rclavicle': 'clavicleR',
    'lhumerus': 'armUL', 'rhumerus': 'armUR',
    'lradius': 'armLL', 'rradius': 'armLR',
    'lwrist': 'handL', 'rwrist': 'handR',
    'lfemur': 'legUL', 'rfemur': 'legUR',
    'ltibia': 'legLL', 'rtibia': 'legLR',
    'lfoot': 'footL', 'rfoot': 'footR',
}


def _frame(right, up):
    """An orthonormal [right | up | forward] from two rough anatomical axes."""
    r = np.array(right, float)
    r /= np.linalg.norm(r)
    u = np.array(up, float)
    u -= r * float(u @ r)
    u /= np.linalg.norm(u)
    return np.column_stack([r, u, np.cross(r, u)])


def _yaw(axis, a, b):
    """The rotation about `axis` that takes a's heading on to b's."""
    n = np.array(axis, float)
    n /= np.linalg.norm(n)
    p = [v - n * float(v @ n) for v in (np.array(a, float), np.array(b, float))]
    p = [v / max(np.linalg.norm(v), 1e-9) for v in p]
    c = float(np.clip(p[0] @ p[1], -1, 1))
    s = float(np.cross(p[0], p[1]) @ n)
    K = np.array([[0, -n[2], n[1]], [n[2], 0, -n[0]], [-n[1], n[0], 0]])
    ang = math.atan2(s, c)
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * (K @ K)


# The capture drives the BODY and nothing else. Her arms in this beat are
# holding a 42 mm straw to her nose — a thing no CMU subject has ever done —
# and the neck was measured against a plate on a tabouret. Those stay hand
# written; what was never any good by hand is the fold, and that is exactly
# what a capture has.
BODY = ('spine01', 'spine02', 'spine03',
        'legUL', 'legLL', 'footL', 'legUR', 'legLR', 'footR')


def arg(name, dflt=None):
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return a[a.index(name) + 1] if name in a else dflt



def _hmh():
    """human_mh.py, imported without letting its CLI run."""
    import importlib.util as _iu
    sp = _iu.spec_from_file_location(
        'hmh', os.path.join(os.path.dirname(__file__), 'human_mh.py'))
    m = _iu.module_from_spec(sp)
    keep = sys.argv
    sys.argv = [keep[0], '--', '--norender']
    try:
        sp.loader.exec_module(m)
    except SystemExit:
        pass
    sys.argv = keep
    return m


def _bake(rig, out, path, src, f0, f1, rest_i):
    """Write the ladder as a module, indexed by where it puts her head.

    WHY THE HEAD AND NOT THE HIPS. Hip drop was the first index and it is the
    one every stoop in `human_mh.py` was typed with, so it looked like the
    obvious key. It is not: over the first third of this capture the man's
    torso folds forty degrees and his hips come down four centimetres, so
    everything shallow — the lean to pick the straw up, the near-upright
    beat where he puts it to his face — collapses on to the same rung.

    What the beat is actually about is where her face ends up: over the
    plate, or clear of it. So each key is labelled with the world position
    of her skull base, solved with its feet on the deck and with a NEUTRAL
    neck and head, so the number measures the body and not the gaze that
    gets laid on top of it afterwards.
    """
    hmh = _hmh()
    arms = {k: v for k, v in hmh.STOOP.items()
            if k.startswith(('armU', 'armL', 'hand', 'clavicle'))}
    flat = {'neck': (0, 0, 0), 'head': (0, 0, 0)}
    poses = []
    for _i, spec in out:
        body = {k: v for k, v in spec.items() if k in BODY}
        poses.append(dict(hmh.IDLE_A, **dict(arms, **dict(flat, **body))))
    hmh.floor_poses(rig, poses, passes=1)

    at = []
    for p in poses:
        hmh.pose(rig, p)
        bpy.context.view_layer.update()
        # `pose` never applies `@root` — that is `_bake_clip`'s job — so the
        # displacement has to be added back by hand or every key reads the
        # same height however deep the crouch.
        h = rig.matrix_world @ rig.pose.bones['head'].head
        at.append((h.x, h.z + p['@root'][2]))

    with open(path, 'w') as fh:
        fh.write('"""Generated by tools/blender/mocap_retarget.py --bake.'
                 '  DO NOT EDIT.\n\nSource: CMU %s, frames %d..%d, rest %d.'
                 '  HEAD is her skull base in metres,\n(forward, height), '
                 'with the feet on the deck and the neck neutral.\n"""\n'
                 % (src, f0, f1, rest_i))
        fh.write('HEAD = [\n')
        for x, z in at:
            fh.write('    (%.4f, %.4f),\n' % (x, z))
        fh.write(']\n\nLADDER = [\n')
        for k, p in enumerate(poses):
            fh.write('    {  # head %.3f m up, %.3f m out\n' % (at[k][1], at[k][0]))
            fh.write('        "@root": (0.0, 0.020, %.4f),\n' % p['@root'][2])
            for n in BODY:
                if n in p:
                    fh.write('        "%s": (%.1f, %.1f, %.1f),\n'
                             % ((n,) + tuple(p[n])))
            fh.write('    },\n')
        fh.write(']\n')
    print('[mocap] %s: %d keys, head %.3f .. %.3f m up, %.3f .. %.3f out'
          % (path, len(poses), at[0][1], at[-1][1],
             min(a[0] for a in at), max(a[0] for a in at)))


def main():
    asf, amc = arg('--asf'), arg('--amc')
    f0, f1 = int(arg('--from', 0)), int(arg('--to', 100))
    rest_i, keys = int(arg('--rest', 0)), int(arg('--keys', 12))

    bones = read_asf(asf)
    frames = read_amc(amc)
    rest = globals_at(bones, frames[rest_i])
    _, restP = pose_at(bones, frames[rest_i])

    # ── THE TWO SKELETONS, SQUARED UP ──────────────────────────────────
    # CMU is Y-up and its man faces wherever he was pointed when the tape
    # rolled; she is Z-up and faces whichever way her armature was built.
    # Nothing in either file says so, so it is read off the bodies: hip to
    # hip is right, root to thorax is up, and forward is the cross of the
    # two. `F_cmu` and `F_her` are those frames, and `B` is the one honest
    # map between the two worlds.
    F_cmu = _frame(restP['rhipjoint'] - restP['lhipjoint'],
                   restP['thorax'] - restP['root'])
    UP_CMU = F_cmu[:, 1].copy()

    rig = bpy.data.objects['rig']
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for b in rig.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    # Her own rest orientation per bone, in armature space.
    her_rest = {pb.name: rig.data.bones[pb.name].matrix_local.to_3x3().copy()
                for pb in rig.pose.bones}
    hb = rig.data.bones
    F_her = _frame(np.array(hb['legUR'].head_local - hb['legUL'].head_local),
                   np.array(hb['spine03'].head_local - hb['pelvis'].head_local))
    B = F_her @ F_cmu.T

    out = []
    for k in range(keys):
        i = f0 + round((f1 - f0) * k / (keys - 1))
        g = globals_at(bones, frames[i])
        # HEADING ONLY. The first fix took the whole root orientation out,
        # which sounds like the same thing and is not: a man bending over
        # pitches his pelvis forward twenty degrees, that pitch lives in the
        # root, and subtracting it subtracted most of the bend — which is
        # why she came up ARCHED BACKWARDS with her chin in the air. What
        # has to go is the yaw, and only the yaw.
        yaw = _yaw(UP_CMU, np.array(g['root']) @ F_cmu[:, 2],
                   np.array(rest['root']) @ F_cmu[:, 2])
        for b in rig.pose.bones:
            b.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        # Parents before children, so a parent's pose is in place when the
        # child's local Euler is read off it.
        for pb in rig.pose.bones:
            pass
        order = [pb for pb in rig.pose.bones]
        order.sort(key=lambda p: len(p.parent_recursive))
        for pb in order:
            cmu = next((c for c, h in MAP.items() if h == pb.name), None)
            if cmu is None or cmu not in g:
                continue
            # ── IN THE ROOT'S FRAME, NOT THE WORLD'S ───────────────────
            #
            # The first cut took the change in world space, and on 02_06 it
            # looked perfect: that man bends on the spot six times and never
            # turns. 26_09 turns, and the turn leaked into every limb — the
            # render was a woman in a wide lunge with her arms out while the
            # capture was plainly a deep squat.
            #
            # A body's pose is what its limbs do relative to ITSELF. Which
            # way it happens to be facing is the root's business and the
            # engine's, not the retarget's. So both orientations are taken
            # into the root's frame before the change is measured, and what
            # comes out cannot contain a yaw.
            # AND THEN PUT BACK INTO A SPACE HER ARMATURE AGREES WITH.
            #
            # Measuring in the root's frame removes the turn, and it also
            # leaves the answer expressed in a frame that is whichever way
            # the subject happened to be standing. Subject 02's rest root is
            # within a few degrees of identity, so composing it straight on
            # to her armature worked by luck; subject 26 stands facing 87
            # degrees away, and the same code folded her over BACKWARDS.
            #
            # So: de-yaw the world change, then carry it across with B.
            #
            #     D = yaw·Gf[b]·Gr[b]ᵀ      (the change, facing removed)
            #     M = B·D·Bᵀ · H[b]
            #
            # At frame == rest both yaw and D are identity and M is her rest.
            # That check passes for every wrong version of these lines too,
            # so it proves nothing on its own — the render is the check.
            dw = yaw @ np.array(g[cmu]) @ np.array(rest[cmu]).T
            d = B @ dw @ B.T
            M = Matrix([list(r) for r in d]) @ her_rest[pb.name]
            pb.matrix = Matrix.Translation(pb.matrix.to_translation()) \
                @ M.to_4x4()
            bpy.context.view_layer.update()
        spec = {}
        for pb in rig.pose.bones:
            e = pb.rotation_euler
            v = tuple(round(math.degrees(a), 1) for a in e)
            if any(abs(a) > 0.05 for a in v):
                spec[pb.name] = v
        out.append((i, spec))

    # AND A PICTURE OF EACH, because a retarget that is wrong produces
    # numbers that look entirely reasonable. The axes are the trap: her knee
    # is authored in X and this comes out in Z, which is not a mistake — it
    # is Blender solving for HER roll — but it means the numbers cannot be
    # read for correctness and the render is the only check there is.
    if '--render' in sys.argv:
        import importlib.util as _iu
        spec_h = _iu.spec_from_file_location(
            'hmh', os.path.join(os.path.dirname(__file__), 'human_mh.py'))
        # Reuse its lights and cameras rather than inventing a second set.
        hmh = _iu.module_from_spec(spec_h)
        sys.argv = [sys.argv[0], '--', '--norender']
        try:
            spec_h.loader.exec_module(hmh)
        except SystemExit:
            pass
        hmh._lights()
        for i, spec in out:
            hmh.pose(rig, spec)
            hmh.render('mc%04d' % i, ('side',))

    if arg('--bake'):
        _bake(rig, out, arg('--bake'), os.path.basename(amc), f0, f1, rest_i)
        return

    print('# --- retargeted from %s frames %d..%d ---'
          % (os.path.basename(amc), f0, f1))
    for i, spec in out:
        print('# frame %d  (%.2f s)' % (i, i / 120.0))
        print('MC_%03d = {' % i)
        for n, v in spec.items():
            print('    "%s": (%s, %s, %s),' % (n, v[0], v[1], v[2]))
        print('}')


main()
