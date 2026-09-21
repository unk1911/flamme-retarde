#!/usr/bin/env python3
"""
CMU ASF/AMC -> global bone rotations, and from those a pose ladder for her rig.

WHY THIS EXISTS. Every clip on this figure has been hand-authored: a dict of
bone -> (rx, ry, rz) in degrees, a few of those as keys, and `_bake_clip`
between them. That is a fine way to write a wave and a bad way to write a
body doing something with its weight in it — the counter-lean before a bend,
the settle at the bottom, the shift on to one foot. A night was spent typing
angles at a stoop and it still read wrong, which is the argument for this
file.

CMU's database is 2500 captures of real people, free to copy, modify and
redistribute. 02_06 is "bend over, scoop up, rise, lift arm".

THE FORMAT, because it is not obvious. An ASF is the skeleton: each bone has
a `direction` and `length` (where it points in the rest pose), an `axis`
(the bone's OWN coordinate frame, as XYZ Euler degrees) and a `dof` list
saying which rotation channels the AMC will carry for it. An AMC is frames,
each frame a list of `bonename a b c` in degrees — and those angles are
expressed IN THE BONE'S OWN AXIS FRAME, not in its parent's.

So the local rotation of a bone in its parent's frame is

    L = C * R * C^-1

where C is the bone's axis rotation and R is the motion Euler. That
conjugation is the whole trick and it is what everything downstream depends
on; skip it and the numbers look plausible and the skeleton is wrong.
"""
import math
import re

import numpy as np


def _rot(order, deg):
    """Euler degrees to a matrix, applied in `order` (e.g. 'xyz'), X first."""
    m = np.eye(3)
    for ax, a in zip(order, deg):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        if ax == 'x':
            r = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
        elif ax == 'y':
            r = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
        else:
            r = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
        # ASF composes X then Y then Z, each about the FIXED frame.
        m = r @ m
    return m


def read_asf(path):
    """Bones: name -> {dir, length, axis(matrix), dof, parent, children}."""
    txt = open(path, encoding='latin-1').read()
    # ONLY the bone table. `:hierarchy` has its own begin/end and no names in
    # it, and a regex that takes every begin/end in the file walks straight
    # into it and dies on the first `name` lookup.
    bones = {'root': {'dir': np.zeros(3), 'len': 0.0, 'C': np.eye(3),
                      'dof': ['rx', 'ry', 'rz'], 'parent': None, 'kids': []}}
    bd = txt[txt.find(':bonedata'):txt.find(':hierarchy')]
    for blk in re.findall(r'begin(.*?)end', bd, re.S):
        name = re.search(r'name\s+(\S+)', blk).group(1)
        d = [float(x) for x in re.search(
            r'direction\s+([-\d.eE\s]+)', blk).group(1).split()]
        ln = float(re.search(r'length\s+([-\d.eE]+)', blk).group(1))
        ax = re.search(r'axis\s+([-\d.eE\s]+)\s*([XYZ]{3})', blk)
        av = [float(x) for x in ax.group(1).split()]
        bones[name] = {'dir': np.array(d), 'len': ln,
                       'C': _rot(ax.group(2).lower(), av),
                       'dof': re.findall(r'r[xyz]', blk[blk.find('dof'):])
                              if 'dof' in blk else [],
                       'parent': None, 'kids': []}
    hier = txt[txt.find(':hierarchy'):]
    for line in hier.splitlines():
        p = line.split()
        if len(p) < 2 or p[0] in ('begin', 'end', ':hierarchy'):
            continue
        for k in p[1:]:
            if k in bones:
                bones[k]['parent'] = p[0]
                bones[p[0]]['kids'].append(k)
    return bones


def read_amc(path):
    """Frames: list of {bonename: [angles]}."""
    frames, cur = [], None
    for line in open(path, encoding='latin-1'):
        line = line.strip()
        if not line or line.startswith('#') or line.startswith(':'):
            continue
        if line.isdigit():
            if cur is not None:
                frames.append(cur)
            cur = {}
            continue
        p = line.split()
        if cur is not None:
            cur[p[0]] = [float(x) for x in p[1:]]
    if cur:
        frames.append(cur)
    return frames


def globals_at(bones, frame):
    """Every bone's global rotation for one frame. See the note on C R C^-1."""
    out = {}

    def walk(name, parent_R):
        b = bones[name]
        vals = frame.get(name, [])
        if name == 'root':
            # The first three are translation; the rest is the orientation.
            deg = vals[3:6] if len(vals) >= 6 else [0, 0, 0]
            R = _rot('xyz', deg)
        else:
            deg = [0.0, 0.0, 0.0]
            for ax, v in zip(b['dof'], vals):
                deg['rx ry rz'.split().index(ax)] = v
            R = b['C'] @ _rot('xyz', deg) @ b['C'].T
        g = parent_R @ R
        out[name] = g
        for k in b['kids']:
            walk(k, g)

    walk('root', np.eye(3))
    return out


def pose_at(bones, frame, scale=1.0):
    """Every bone's global rotation AND its tip position, for one frame.

    Positions are wanted for one reason: to find out where in a capture the
    thing you care about happens. 02_06 is eighteen seconds and most of it is
    a man standing still.
    """
    R, P = {}, {}
    root = frame.get('root', [0] * 6)

    def walk(name, parent_R, parent_p):
        b = bones[name]
        vals = frame.get(name, [])
        if name == 'root':
            r = _rot('xyz', vals[3:6] if len(vals) >= 6 else [0, 0, 0])
        else:
            deg = [0.0, 0.0, 0.0]
            for ax, v in zip(b['dof'], vals):
                deg['rx ry rz'.split().index(ax)] = v
            r = b['C'] @ _rot('xyz', deg) @ b['C'].T
        g = parent_R @ r
        tip = parent_p + g @ (b['dir'] * b['len'] * scale)
        R[name], P[name] = g, tip
        for k in b['kids']:
            walk(k, g, tip)

    walk('root', np.eye(3), np.array(root[0:3]) * scale)
    return R, P
