#!/usr/bin/env python3
"""Baye's OK-sign pinch, solved on her own mesh. No Blender, no browser.

    python3 tools/pinch_solve.py --solve          fit the pinch, print PINCH
    python3 tools/pinch_solve.py --sweep          straw clearance at each pivot
    python3 tools/pinch_solve.py --draw out.png   the hand, four views, straw in

WHAT IT IS. src/41-hands.js adds an index finger (three phalanges) and the
thumb's two outer joints to Baye's right hand at load, and 43-jadrija.js holds
the straw between the index pad and the thumb pad — an OK sign — instead of in
all four fingers at once, which is the only pinch the rig's single `fingersR`
bone could make (Misha, 24 Sep 2026: "her right hand wraps around in a
scooping way"). Every number in `HAND_R` and `PINCH` comes out of here.

HOW. The same reweighting 41-hands.js does, in numpy, on v2.0's blob
(build/payload/baye2.fr3d.gz — she is the one that is drawn), then forward
kinematics of the hand in its own bind frame (hand turn = identity, so every
result is a bind-space point that rides `handR` at runtime). Joints are
MakeHuman's `r-finger-*` markers off build/mh_base.obj, which is what
`armature()` in tools/blender/human_mh.py builds her from: `thumbR` sits on
r-finger-1-1 and `fingersR` on r-finger-3-1 to the tenth of a millimetre.

THE FIT. Index held near a real OK sign (40, 60, 32 degrees at its three
joints, weight 0.05 a degree squared); thumb free. Scored on: pad-to-pad gap
7.6 mm (a 6.8 mm straw and skin), each pad facing the other at 0.85 or better,
index and thumb at least 3 mm apart away from the pinch (an open O), and the
straw — square to the pads — at least 1.5 mm clear of every other vertex of
the hand along its whole length. Left free, with the pads made to face
squarely, it runs every joint to its limit and makes a fist: the prior is what
makes it an OK sign rather than a solution.

THE PIVOT. A straw between two pads turns freely about the line between them;
`--sweep` is the clearance at each angle, which is where `PINCH.psis` comes
from. On the palm side past -50 and on the back past +10 it runs into the
curled index or the fingers.
"""
import argparse
import os
import gzip
import json
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.spatial.transform import Rotation as R

ROOT = Path(__file__).resolve().parents[1]
BLOB = ROOT / 'build' / 'payload' / 'baye2.fr3d.gz'
# Fetched by tools/blender/human_mh.py (`fetch`), and not in the repo.
OBJ = Path(os.environ.get('MH_OBJ', ROOT / 'build' / 'mh_base.obj'))
TARGET_H = 1.75
STRAW_R, STRAW_LEN, GRIP_T = 0.0034, 0.070, 0.62
F_CURL = 15.0          # the three free fingers, degrees
GAP = 0.0076           # pad to pad, metres


# ── the blob ────────────────────────────────────────────────────────────────
def q_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx,
                     aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz])


def q_rot(q, v):
    x, y, z, w = q
    u = np.array([x, y, z])
    return v + 2*w*np.cross(u, v) + 2*np.cross(u, np.cross(u, v))


def load(path):
    """Mesh, weights and skeleton of a v4/v5 .fr3d skin (see readFR3DSkin)."""
    buf = gzip.open(path).read()
    ver, nv, ni = struct.unpack_from('<III', buf, 4)
    o = 44
    pos = np.frombuffer(buf, np.float32, nv*3, o).reshape(-1, 3); o += nv*12
    nrm = np.frombuffer(buf, np.float32, nv*3, o).reshape(-1, 3); o += nv*12
    o += nv*8 if ver == 5 else nv*3
    bi = np.frombuffer(buf, np.uint8, nv*4, o).reshape(-1, 4); o += nv*4
    bw = np.frombuffer(buf, np.uint8, nv*4, o).reshape(-1, 4); o += nv*4
    o = (o+3) & ~3
    idx = np.frombuffer(buf, np.uint32, ni, o).reshape(-1, 3); o += ni*4
    if ver == 5:
        n, = struct.unpack_from('<I', buf, o); o += 4
        for _ in range(n):
            l, = struct.unpack_from('<H', buf, o); o += 2 + l + 12
    nb, = struct.unpack_from('<I', buf, o); o += 4
    bones = []
    for _ in range(nb):
        l, = struct.unpack_from('<H', buf, o); o += 2
        name = buf[o:o+l].decode(); o += l
        par, = struct.unpack_from('<i', buf, o)
        t = np.array(struct.unpack_from('<3f', buf, o+4))
        q = np.array(struct.unpack_from('<4f', buf, o+16))
        o += 32
        b = dict(name=name, parent=par)
        if par < 0:
            b['bq'], b['bt'] = q, t
        else:
            p = bones[par]
            b['bq'], b['bt'] = q_mul(p['bq'], q), q_rot(p['bq'], t) + p['bt']
        bones.append(b)
    return dict(pos=pos, nrm=nrm, bi=bi, bw=bw, bones=bones, idx=idx)


def read_joints(path):
    """`read_joints` from human_mh.py, in figure axes (x fwd, y up, z right)."""
    verts, groups, cur = [], {}, None
    for ln in open(path):
        if ln.startswith('v '):
            a = ln.split()
            verts.append((float(a[1]), float(a[2]), float(a[3])))
        elif ln.startswith('g '):
            cur = ln[2:].strip()
        elif ln.startswith('f '):
            g = groups.setdefault(cur, set())
            for tok in ln.split()[1:]:
                g.add(int(tok.split('/')[0]) - 1)
    ys = [verts[i][1] for i in groups['body']]
    scale = TARGET_H / (max(ys) - min(ys))
    drop = -min(ys) * scale
    out = {}
    for g, ids in groups.items():
        if g.startswith('joint-'):
            m = np.array([verts[i] for i in ids]).mean(0)
            out[g[6:]] = np.array([m[2]*scale, m[1]*scale + drop, -m[0]*scale])
    return out


J = read_joints(OBJ)


def jr(k, j):
    return J['r-finger-%d-%d' % (k, j)]


I = [jr(2, j) for j in range(1, 5)]
T = [jr(1, j) for j in range(1, 5)]
uI = (I[3] - I[0]) / np.linalg.norm(I[3] - I[0])
uT = (T[3] - T[0]) / np.linalg.norm(T[3] - T[0])
sI = [float((p - I[0]) @ uI) for p in I]
sT = [float((p - T[0]) @ uT) for p in T]
NEW = ['idx1R', 'idx2R', 'idx3R', 'thb2R', 'thb3R']
PARENT = {'idx1R': 'handR', 'idx2R': 'idx1R', 'idx3R': 'idx2R', 'thb2R': 'thumbR',
          'thb3R': 'thb2R', 'fingersR': 'handR', 'thumbR': 'handR'}


def ss(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def poly_dist(p, poly):
    d = np.full(len(p), 1e9)
    for a, b in zip(poly[:-1], poly[1:]):
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        d = np.minimum(d, np.linalg.norm(p - (a + np.outer(t, ab)), axis=1))
    return d


def augment(d):
    """`fingerBones` in src/41-hands.js, on the weights."""
    names = [b['name'] for b in d['bones']]
    nb = len(names)
    iF, iT = names.index('fingersR'), names.index('thumbR')
    ix = {n: nb + k for k, n in enumerate(NEW)}
    pos = d['pos']
    bi = d['bi'].astype(int).copy()
    bw = d['bw'].astype(float) / 255
    cand = np.where(((bi == iF) & (bw > 0)).any(1) | ((bi == iT) & (bw > 0)).any(1))[0]
    D = np.stack([poly_dist(pos[cand], [jr(k, j) for j in range(1, 5)]) for k in range(1, 6)], 1)
    lab, dmin = D.argmin(1) + 1, D.min(1)
    for n, i in enumerate(cand):
        if dmin[n] >= 0.03 or lab[n] not in (1, 2):
            continue
        w = {}
        for s in range(4):
            if bw[i, s] > 0:
                w[bi[i, s]] = w.get(bi[i, s], 0) + bw[i, s]
        if lab[n] == 2:
            s = float((pos[i] - I[0]) @ uI)
            mv = w.get(iT, 0) * ss((s + 0.015) / 0.015)
            if mv > 0:
                w[iT] -= mv
                w[iF] = w.get(iF, 0) + mv
            F = w.get(iF, 0)
            g1 = ss((s - (sI[0] - 0.006)) / 0.012)
            g2 = ss((s - (sI[1] - 0.005)) / 0.010)
            g3 = ss((s - (sI[2] - 0.004)) / 0.008)
            w[iF] = F * (1 - g1)
            w[ix['idx1R']] = F * g1 * (1 - g2)
            w[ix['idx2R']] = F * g1 * g2 * (1 - g3)
            w[ix['idx3R']] = F * g1 * g2 * g3
        else:
            s = float((pos[i] - T[0]) @ uT)
            Tw = w.get(iT, 0)
            g2 = ss((s - (sT[1] - 0.006)) / 0.012)
            g3 = ss((s - (sT[2] - 0.005)) / 0.010)
            w[iT] = Tw * (1 - g2)
            w[ix['thb2R']] = Tw * g2 * (1 - g3)
            w[ix['thb3R']] = Tw * g2 * g3
        top = sorted([(v, k) for k, v in w.items() if v > 1e-4], reverse=True)[:4]
        tot = sum(v for v, _ in top)
        bi[i], bw[i] = 0, 0
        for s, (v, k) in enumerate(top):
            bi[i, s], bw[i, s] = k, v / tot
    heads = {n: b['bt'] for n, b in zip(names, d['bones'])}
    heads.update(idx1R=I[0], idx2R=I[1], idx3R=I[2], thb2R=T[1], thb3R=T[2])
    return dict(d, bi=bi, bw=bw, names=names + NEW, heads=heads)


# ── the hand ────────────────────────────────────────────────────────────────
def perp(v, u):
    v = v - (v @ u) * u
    return v / np.linalg.norm(v)


def rot(axis, deg):
    a = np.asarray(axis, float)
    return R.from_rotvec(a / np.linalg.norm(a) * np.radians(deg))


class Hand:
    def __init__(self, d):
        self.d = d
        self.nid = {n: i for i, n in enumerate(d['names'])}
        hid = [self.nid[n] for n in ['handR', 'fingersR', 'thumbR'] + NEW]
        self.v = np.where((np.isin(d['bi'], hid) & (d['bw'] > 0)).any(1))[0]
        # The palm's normal: the middle finger's rest curve bulges dorsally.
        m = [jr(3, j) for j in range(1, 5)]
        ch = m[3] - m[0]
        mid = (m[1] + m[2]) / 2
        bulge = mid - (m[0] + ((mid - m[0]) @ ch / (ch @ ch)) * ch)
        self.vol = -bulge / np.linalg.norm(bulge)
        self.aI = [np.cross(perp(I[k + 1] - I[k], self.vol), self.vol) for k in range(3)]
        self.aI = [a / np.linalg.norm(a) for a in self.aI]
        uM = jr(3, 4) - jr(3, 1)
        self.aF = np.cross(uM / np.linalg.norm(uM), self.vol)
        self.aF /= np.linalg.norm(self.aF)
        # The thumb's pad looks at the index side of the palm.
        self.volT = perp((I[0] + self.vol * 0.01) - T[2], uT)
        self.aT = [np.cross((T[k + 1] - T[k]) / np.linalg.norm(T[k + 1] - T[k]), self.volT)
                   for k in range(3)]
        self.aT = [a / np.linalg.norm(a) for a in self.aT]

    def turns(self, p):
        """Every finger bone's turn relative to the hand (`pinchRel` at g = 1)."""
        Qf = rot(self.aF, p.get('f', F_CURL))
        Q1 = rot(self.aF, F_CURL) * rot(self.aI[0], p['i1']) * rot(self.vol, p.get('iab', 0))
        Q2 = Q1 * rot(self.aI[1], p['i2'])
        Q3 = Q2 * rot(self.aI[2], p['i3'])
        Qt = R.from_rotvec(np.radians(p['t']))
        Qt2 = Qt * rot(self.aT[1], p['t4'])
        Qt3 = Qt2 * rot(self.aT[2], p['t5'])
        return {'handR': R.identity(), 'fingersR': Qf, 'idx1R': Q1, 'idx2R': Q2, 'idx3R': Q3,
                'thumbR': Qt, 'thb2R': Qt2, 'thb3R': Qt3}

    def pose(self, p, verts=None):
        d, H = self.d, self.d['heads']
        tq = self.turns(p)
        W = {'handR': H['handR']}
        for n in ['fingersR', 'thumbR', 'idx1R', 'idx2R', 'idx3R', 'thb2R', 'thb3R']:
            par = PARENT[n]
            W[n] = tq[par].apply(H[n] - H[par]) + W[par]
        v = self.v if verts is None else verts
        out = np.zeros((len(v), 3))
        for s in range(4):
            b, w = d['bi'][v, s], d['bw'][v, s]
            done = np.zeros(len(v), bool)
            for n, Q in tq.items():
                m = (b == self.nid[n]) & (w > 0)
                if m.any():
                    out[m] += w[m, None] * (Q.apply(d['pos'][v[m]] - H[n]) + W[n])
                    done |= m
            m = (w > 0) & ~done
            out[m] += w[m, None] * d['pos'][v[m]]
        return out, tq, W


# ── the pinch ───────────────────────────────────────────────────────────────
D = augment(load(BLOB))
Hd = Hand(D)
KEYS = ['i1', 'i2', 'i3', 'iab', 'tx', 'ty', 'tz', 't4', 't5']
X0 = [40, 60, 32, 0, 0, 0, 0, 15, 20]


def wt(v, n):
    return (D['bw'][v] * (D['bi'][v] == Hd.nid[n])).sum(1)


def pads():
    V, pos, nrm = Hd.v, D['pos'], D['nrm']
    i3 = V[wt(V, 'idx3R') > 0.95]
    t3 = V[wt(V, 'thb3R') > 0.95]
    si = (pos[i3] - I[0]) @ uI
    st = (pos[t3] - T[0]) @ uT
    vi = perp(Hd.vol, (I[3] - I[2]) / np.linalg.norm(I[3] - I[2]))
    vt = perp(Hd.volT, (T[3] - T[2]) / np.linalg.norm(T[3] - T[2]))
    pi = i3[(si > sI[2] + 0.008) & (nrm[i3] @ vi > 0.7)]
    pt = t3[(st > sT[2] + 0.006) & (nrm[t3] @ vt > 0.7)]
    n = lambda v: v / np.linalg.norm(v)
    return (pos[pi].mean(0), n(nrm[pi].mean(0)), pos[pt].mean(0), n(nrm[pt].mean(0)),
            pos[i3[np.argmax(si)]], pos[t3[np.argmax(st)]])


PI, NI, PT, NT_, TIPI, TIPT = pads()
V = Hd.v
KI = np.where((wt(V, 'idx1R') + wt(V, 'idx2R') + wt(V, 'idx3R')) > 0.5)[0]
KT = np.where((wt(V, 'thb2R') + wt(V, 'thb3R') + wt(V, 'thumbR')) > 0.5)[0]


def params(x):
    p = dict(zip(KEYS, x))
    p['t'] = [p.pop('tx'), p.pop('ty'), p.pop('tz')]
    return p


def pinch(x, psi=0.0):
    Pv, tq, W = Hd.pose(params(x))
    H = D['heads']
    pI = tq['idx3R'].apply(PI - H['idx3R']) + W['idx3R']
    pT = tq['thb3R'].apply(PT - H['thb3R']) + W['thb3R']
    nI, nT = tq['idx3R'].apply(NI), tq['thb3R'].apply(NT_)
    e = pT - pI
    gap = np.linalg.norm(e)
    e /= gap
    c = (pI + pT) / 2
    nr = np.cross(e, W['idx1R'] - c)
    nr /= np.linalg.norm(nr)
    ax = R.from_rotvec(e * np.radians(psi)).apply(nr)
    return dict(Pv=Pv, pI=pI, pT=pT, nI=nI, nT=nT, e=e, gap=gap, c=c, ax=ax, n0=nr)


def clearance(r, ax):
    """Straw to the rest of the hand, top side and bottom side, metres."""
    rel = r['Pv'] - r['c']
    t = rel @ ax
    dist = np.linalg.norm(rel - np.outer(t, ax), axis=1) - STRAW_R
    near = np.linalg.norm(rel, axis=1) < 0.009
    top = (t > 0) & (t < (1 - GRIP_T) * STRAW_LEN) & ~near
    bot = (t < 0) & (t > -GRIP_T * STRAW_LEN) & ~near
    return dist[top].min(), dist[bot].min()


def cost(x):
    r = pinch(x)
    i1, i2, i3, iab, tx, ty, tz, t4, t5 = x
    c = 4e6 * (r['gap'] - GAP) ** 2
    c += 3e4 * max(0, 0.85 - r['nI'] @ r['e']) ** 2 + 3e4 * max(0, 0.85 + r['nT'] @ r['e']) ** 2
    c += 0.02 * (i3 - 0.67 * i2) ** 2
    c += 0.05 * ((i1 - 40) ** 2 + (i2 - 60) ** 2 + (i3 - 32) ** 2)
    c += 0.004 * ((t4 - 15) ** 2 + (t5 - 20) ** 2 + iab ** 2)
    c += 0.0005 * (tx ** 2 + ty ** 2 + tz ** 2)
    for v, lo, hi in ((i1, -20, 85), (i2, 0, 100), (i3, 0, 70), (t4, -10, 50), (t5, -10, 70),
                      (iab, -20, 20)):
        c += 10 * (max(0, lo - v) ** 2 + max(0, v - hi) ** 2)
    A, B = r['Pv'][KI], r['Pv'][KT]
    A = A[np.linalg.norm(A - r['c'], axis=1) > 0.012]
    B = B[np.linalg.norm(B - r['c'], axis=1) > 0.012]
    c += 1e6 * max(0, 0.003 - np.linalg.norm(A[:, None] - B[None], axis=2).min()) ** 2
    c += 1e6 * max(0, 0.0015 - min(clearance(r, r['ax']))) ** 2
    return c


def solve():
    best = None
    for seed in range(4):
        x0 = np.array(X0, float) + (np.random.RandomState(seed).randn(len(X0)) * 6 if seed else 0)
        res = minimize(cost, x0, method='Powell', options=dict(maxiter=20000, xtol=0.02, ftol=1e-9))
        if best is None or res.fun < best.fun:
            best = res
    return best.x


def r4(v):
    return [round(float(a), 4) for a in v]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--solve', action='store_true')
    ap.add_argument('--sweep', action='store_true')
    ap.add_argument('--draw')
    ap.add_argument('--x', help='JSON of the fitted angles, instead of fitting')
    a = ap.parse_args()
    x = np.array([json.loads(a.x)[k] for k in KEYS]) if a.x else None
    if a.solve or x is None:
        x = solve()
    r = pinch(x)
    out = dict(
        HAND_R=dict(aF=r4(Hd.aF), aI=[r4(v) for v in Hd.aI], aT=[r4(v) for v in Hd.aT],
                    vol=r4(Hd.vol)),
        PINCH=dict(f=F_CURL, i=r4(x[:3]), iab=round(float(x[3]), 2), t=r4(x[4:7]),
                   t4=round(float(x[7]), 2), t5=round(float(x[8]), 2), grip=r4(r['c']),
                   e=r4(r['e']), n0=r4(r['n0']), padI=r4(PI), padT=r4(PT),
                   tipI=r4(TIPI), tipT=r4(TIPT)),
        gap_mm=round(r['gap'] * 1e3, 2), faceI=round(float(r['nI'] @ r['e']), 3),
        faceT=round(float(-r['nT'] @ r['e']), 3))
    print(json.dumps(out, indent=1))
    if a.sweep:
        hb = D['heads']['fingersR'] - D['heads']['handR']
        hb /= np.linalg.norm(hb)
        for psi in range(-60, 25, 5):
            rr = pinch(x, psi)
            top, bot = clearance(rr, rr['ax'])
            print('psi %4d  top.hand %5.2f  clear top %5.1f mm  bottom %5.1f mm'
                  % (psi, rr['ax'] @ hb, top * 1e3, bot * 1e3))
    if a.draw:
        draw(x, r, a.draw)


def draw(x, r, fn):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    keep = np.zeros(len(D['pos']), bool)
    keep[Hd.v] = True
    keep &= np.linalg.norm(D['pos'] - D['heads']['handR'], axis=1) < 0.16
    tri = D['idx'][keep[D['idx']].all(1)]
    vs = np.unique(tri)
    P, _, _ = Hd.pose(params(x), vs)
    lut = {v: k for k, v in enumerate(vs)}
    Tr = np.vectorize(lut.get)(tri)
    top = r['c'] + r['ax'] * (1 - GRIP_T) * STRAW_LEN
    bot = r['c'] - r['ax'] * GRIP_T * STRAW_LEN
    fig = plt.figure(figsize=(24, 6.4))
    for k, (el, az) in enumerate(((10, -60), (10, 30), (80, 0), (-30, 200))):
        ax = fig.add_subplot(1, 4, k + 1, projection='3d')
        Vp = P[:, [0, 2, 1]]
        polys = Vp[Tr]
        n = np.cross(polys[:, 1] - polys[:, 0], polys[:, 2] - polys[:, 0])
        n /= np.linalg.norm(n, axis=1)[:, None] + 1e-12
        L = np.array([0.3, -0.5, 0.8]) / np.linalg.norm([0.3, -0.5, 0.8])
        sh = 0.35 + 0.65 * np.abs(n @ L)
        ax.add_collection3d(Poly3DCollection(
            polys, facecolors=np.stack([sh * 0.85, sh * 0.65, sh * 0.55, np.ones_like(sh)], 1),
            edgecolor='none'))
        s = np.array([top, bot])[:, [0, 2, 1]]
        ax.plot(s[:, 0], s[:, 1], s[:, 2], 'y-', lw=4)
        cen = (Vp.mean(0) + r['c'][[0, 2, 1]]) / 2
        for f, c in zip((ax.set_xlim, ax.set_ylim, ax.set_zlim), cen):
            f(c - 0.05, c + 0.05)
        ax.set_box_aspect((1, 1, 1))
        ax.view_init(el, az)
        ax.set_axis_off()
    plt.tight_layout()
    plt.savefig(fn, dpi=70)


if __name__ == '__main__':
    sys.exit(main())
