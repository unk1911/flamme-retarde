#!/usr/bin/env python3
"""Your own arm, cut off Chloe v2.0.

    python3 tools/hand_fp.py [--src /path/to/checkout/with/build/mh_bodies]

Writes build/payload/chloe2_arm.frhd.gz and build/payload/chloe2_arm.jpg, which
`buildArms` in src/60-arms.js reads.

Misha, 24 Sep 2026: *"is there anything that can be done to make my extended
hand look more natural/realistic? don't we have baye's hand available that we
could model my (Chloe's extended hand) hand from? with beautiful fingers"*.

The first-person arm was a stack of lathes: a superellipse swept down a table
of anatomist's widths, a palm, a thumb pad and fourteen little beaded tubes for
bones. At two metres it was fine. At forty centimetres, with your thumb on
somebody's lip, it was a mannequin's hand, because every one of those pieces is
somebody guessing what a hand is shaped like. MakeHuman's is not a guess: it is
the base mesh this project's people are all built on, modelled by people who
model hands, under a photographed skin with nails in it. Chloe v2.0 already
wears it. This cuts her right arm off her and hands it to you.

── what is taken, and what is not ────────────────────────────────────────────

The mesh and its UVs come straight out of `mh_chloe.obj`, in file order, the
same way tools/blender/baye2.py reads it — so the arm is the arm the mirror
shows. Cut across the humerus a little under half way down, which is below the
armpit (so nothing of her chest comes with it) and well above anything a
first-person camera ever sees. The cut is capped so the tube is closed.

Her SKELETON is not taken. The figure's rig has one bone for four fingers and
one for the thumb — enough to close a hand round a wine bottle, and nowhere
near enough for a thumb that goes out while the fingers curl. So the bones are
built here, off MakeHuman's own joint markers (`joint-r-finger-N-K`): an upper
arm, a forearm in three twist segments, a hand, and three bones for every digit.
Twenty in all.

The weights are GEOMETRIC, not bone heat. Each vertex belongs to the nearest
bone segment (less that bone's own radius, so a forearm is not out-voted by a
thumb), and then blends with its parent and child across each joint over a
width set per joint. A finger's weights can therefore only ever be that
finger's, which is the whole problem bone heat has with a hand: fingers lying
side by side are closer to each other THROUGH THE AIR than a knuckle is to its
own fingertip, and heat diffuses through the air.

── once round Catmull-Clark ──────────────────────────────────────────────────

The base mesh is built to be seen at a few metres and a finger is eight quads
round. A camera forty centimetres off a hand sees the facets, so it is
subdivided once here — positions by Catmull-Clark, UVs linearly and per face
corner so the texture seams stay where they are.

── the texture ───────────────────────────────────────────────────────────────

Her skin is the CC0 `toigo_light_skin_female_freckles` (MargaretToigo, see
tools/wardrobe/CREDITS.md), and the copy in the payload is 1024 square — which
gives a hand about one texel a millimetre. That is right for the mirror and
blurred at arm's length. So the islands this arm actually uses are cut out of
the 2048 original at full resolution and packed into a small atlas of their
own, and the UVs are rewritten to point into it.

AND THE NAILS ARE PAINTED IN, because the pack has only a pale smudge on each
fingertip. Rasterised into the atlas off the mesh's own geometry: every texel
of a distal phalanx is asked where it is on the finger, and a nail plate is
drawn where a nail is — an arch at the cuticle, the lunula, the pink of the
bed, a paler free edge. A per-vertex mask for the same region goes into the
blob so the shader can make it shine.
"""
import argparse
import gzip
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BODY = 'build/mh_bodies/mh_chloe.obj'
SKIN = ('build/mh_assets/skins01/skins/toigo_light_skin_female_freckles/'
        'young_lightskinned_female_diffuse_freckles.png')
OUT = ROOT / 'build' / 'payload'
TARGET_H = 1.750          # the same canonical height baye2.py scales her to
# Where the arm is cut, as a fraction of the humerus from the shoulder joint.
T_CUT = 0.42

# The bones, in palette order. (name, parent, head joint, tail joint).
# fore0..2 share the forearm's rest frame and differ only in how much of the
# pronation each one carries — see `twist` in 60-arms.js.
BONES = [('upper', -1, 'r-shoulder', 'r-elbow'),
         ('fore0', 0, 'r-elbow', 'r-hand'),
         ('fore1', 0, 'r-elbow', 'r-hand'),
         ('fore2', 0, 'r-elbow', 'r-hand'),
         ('hand', 3, 'r-hand', 'r-finger-3-1')]
for _n in range(1, 6):
    for _k in range(1, 4):
        BONES.append(('d%d%d' % (_n, _k), 4 if _k == 1 else len(BONES) - 1,
                      'r-finger-%d-%d' % (_n, _k), 'r-finger-%d-%d' % (_n, _k + 1)))
BI = {b[0]: i for i, b in enumerate(BONES)}
# The joints the runtime needs, in the order the blob carries them.
JOINTS = ['r-shoulder', 'r-elbow', 'r-hand'] + [
    'r-finger-%d-%d' % (n, k) for n in range(1, 6) for k in range(1, 5)]

# How wide each joint's blend is, metres either side of the joint plane.
BLEND = {'fore0': 0.030, 'hand': 0.016, 'd11': 0.016, 'd12': 0.008, 'd13': 0.006}
for _n in range(2, 6):
    BLEND.update({'d%d1' % _n: 0.009, 'd%d2' % _n: 0.0065, 'd%d3' % _n: 0.0055})
# Nominal radius of each segment, subtracted from the distance so that a fat
# limb is not out-voted by a thin one lying nearer its surface.
RADIUS = {'hand': 0.012, 'd11': 0.012, 'd12': 0.0095, 'd13': 0.0085}
for _n in range(2, 6):
    RADIUS.update({'d%d1' % _n: 0.0085, 'd%d2' % _n: 0.0078, 'd%d3' % _n: 0.0072})


def read_obj(path):
    vs, vts, faces, cur = [], [], {}, None
    for ln in path.read_text(errors='ignore').splitlines():
        if ln.startswith('v '):
            vs.append([float(x) for x in ln.split()[1:4]])
        elif ln.startswith('vt '):
            vts.append([float(x) for x in ln.split()[1:3]])
        elif ln.startswith('g '):
            cur = ln[2:].strip()
        elif ln.startswith('f '):
            faces.setdefault(cur, []).append(
                [tuple(int(t) - 1 for t in tok.split('/')[:2]) for tok in ln.split()[1:]])
    return np.array(vs), np.array(vts), faces


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ── cutting the arm off ──────────────────────────────────────────────────── #

def cut_arm(G, faces, J):
    """The body quads of her right arm below T_CUT of the humerus.

    A flood from the fingertip across faces whose every corner is past the
    cut, so nothing that is not joined to the hand by skin can come along —
    the plane alone would also take the side of her ribcage below the armpit.
    """
    S, E = J['r-shoulder'], J['r-elbow']
    ud = (E - S) / np.linalg.norm(E - S)
    t = (G - S) @ ud / np.linalg.norm(E - S)
    ok = t > T_CUT
    body = faces['body']
    by_v = {}
    for fi, f in enumerate(body):
        for vi, _ in f:
            by_v.setdefault(vi, []).append(fi)
    tip = J['r-finger-3-4']
    cand = [vi for vi in by_v if ok[vi]]
    seed_v = min(cand, key=lambda vi: np.sum((G[vi] - tip) ** 2))
    seen, stack = set(), list(by_v[seed_v])
    while stack:
        fi = stack.pop()
        if fi in seen or not all(ok[vi] for vi, _ in body[fi]):
            continue
        seen.add(fi)
        for vi, _ in body[fi]:
            stack.extend(by_v[vi])
    return [body[fi] for fi in sorted(seen)]


# ── one round of Catmull-Clark ───────────────────────────────────────────── #

def subdivide(P, T, quads):
    """P positions, T uvs, quads [(v, t) x4]. Returns P', T', quads'.

    Positions by Catmull-Clark with the boundary rules (the cut is a
    boundary); UVs linearly, per face corner, so a seam stays a seam.
    """
    Fv = np.array([[c[0] for c in q] for q in quads])
    Ft = np.array([[c[1] for c in q] for q in quads])
    nF, nP = len(quads), len(P)
    edges, efaces = {}, []
    fedge = np.zeros((nF, 4), int)
    for f in range(nF):
        for i in range(4):
            a, b = Fv[f, i], Fv[f, (i + 1) % 4]
            k = (min(a, b), max(a, b))
            e = edges.get(k)
            if e is None:
                e = edges[k] = len(efaces)
                efaces.append([])
            efaces[e].append(f)
            fedge[f, i] = e
    E = np.array(list(edges.keys()))
    FP = P[Fv].mean(1)
    EP = np.zeros((len(E), 3))
    bnd = np.zeros(len(E), bool)
    for e, (a, b) in enumerate(E):
        fs = efaces[e]
        if len(fs) == 2:
            EP[e] = (P[a] + P[b] + FP[fs[0]] + FP[fs[1]]) / 4
        else:
            EP[e] = (P[a] + P[b]) / 2
            bnd[e] = True
    # Vertex points.
    vf = [[] for _ in range(nP)]
    for f in range(nF):
        for v in Fv[f]:
            vf[v].append(f)
    ve = [[] for _ in range(nP)]
    for e, (a, b) in enumerate(E):
        ve[a].append(e)
        ve[b].append(e)
    VP = P.copy()
    for v in range(nP):
        if not ve[v]:
            continue
        be = [e for e in ve[v] if bnd[e]]
        if be:
            nb = [E[e][0] if E[e][1] == v else E[e][1] for e in be]
            if len(nb) == 2:
                VP[v] = 0.75 * P[v] + 0.125 * (P[nb[0]] + P[nb[1]])
            continue
        n = len(ve[v])
        Fa = FP[vf[v]].mean(0)
        R = np.mean([(P[E[e][0]] + P[E[e][1]]) / 2 for e in ve[v]], 0)
        VP[v] = (Fa + 2 * R + (n - 3) * P[v]) / n
    # New arrays: [vertex points | edge points | face points].
    P2 = np.concatenate([VP, EP, FP])
    # UVs: originals, then one per (uv, uv) edge, then one per face.
    T2 = list(map(tuple, T))
    tedge = {}

    def tmid(a, b):
        k = (min(a, b), max(a, b))
        j = tedge.get(k)
        if j is None:
            j = tedge[k] = len(T2)
            T2.append(tuple((T[a] + T[b]) / 2))
        return j
    out = []
    for f in range(nF):
        tf = len(T2)
        T2.append(tuple(T[Ft[f]].mean(0)))
        pf = nP + len(E) + f
        for i in range(4):
            j = (i - 1) % 4
            v, t = Fv[f, i], Ft[f, i]
            e1, e0 = fedge[f, i], fedge[f, j]
            t1 = tmid(Ft[f, i], Ft[f, (i + 1) % 4])
            t0 = tmid(Ft[f, j], Ft[f, i])
            out.append([(v, t), (nP + e1, t1), (pf, tf), (nP + e0, t0)])
    return P2, np.array(T2), out


def compact(P, T, quads):
    """Drop unreferenced positions and uvs, and renumber."""
    vs = sorted({c[0] for q in quads for c in q})
    ts = sorted({c[1] for q in quads for c in q})
    mv = {v: i for i, v in enumerate(vs)}
    mt = {t: i for i, t in enumerate(ts)}
    return P[vs], T[ts], [[(mv[v], mt[t]) for v, t in q] for q in quads]


# ── the skeleton and the weights ─────────────────────────────────────────── #

def seg_dist(X, a, b):
    d = b - a
    L2 = max(d @ d, 1e-12)
    s = np.clip((X - a) @ d / L2, 0.0, 1.0)
    return np.linalg.norm(X - (a + np.outer(s, d)), axis=1)


def weights(X, J):
    """Four (bone, weight) pairs per vertex — see the note at the top."""
    n = len(X)
    head = {b: J[h] for b, _p, h, _t in BONES}
    tail = {b: J[t] for b, _p, _h, t in BONES}
    # The fingertip joint sits inside the pad; carry the distal segments a few
    # millimetres on so the very tip is nearest its own bone.
    for d in range(1, 6):
        b = 'd%d3' % d
        v = tail[b] - head[b]
        tail[b] = tail[b] + v / np.linalg.norm(v) * 0.006
    dirv = {b: (tail[b] - head[b]) / np.linalg.norm(tail[b] - head[b]) for b in head}
    parent = {b: (BONES[p][0] if p >= 0 else None) for b, p, _h, _t in BONES}
    # fore0..2 all hang off `upper` for blending; `hand` hangs off `fore`.
    parent['hand'] = 'fore'
    parent['fore'] = 'upper'
    head['fore'], tail['fore'], dirv['fore'] = head['fore0'], tail['fore0'], dirv['fore0']
    BL = dict(BLEND)
    BL['fore'] = BL.pop('fore0')

    W = J['r-hand']
    sw = (X - W) @ dirv['fore']
    # Candidate segments inside the hand: the four metacarpals are `hand`.
    cand = [('hand', W, J['r-finger-%d-1' % k]) for k in range(2, 6)]
    for d in range(1, 6):
        for k in range(1, 4):
            b = 'd%d%d' % (d, k)
            cand.append((b, head[b], tail[b]))
    D = np.stack([seg_dist(X, a, b) - RADIUS[name] for name, a, b in cand], 1)
    near = np.array([cand[i][0] for i in np.argmin(D, 1)])
    # Which digit a palm vertex is nearest, for its blend into that digit.
    first = ['d%d1' % d for d in range(1, 6)]
    Dfirst = np.stack([seg_dist(X, head[b], tail[b]) for b in first], 1)
    nearfirst = np.array([first[i] for i in np.argmin(Dfirst, 1)])

    def plane(b, x):
        return (x - head[b]) @ dirv[b]

    def chain(x, b):
        """t-blend of b with its ancestors, as a dict."""
        p = parent.get(b)
        if p is None:
            return {b: 1.0}
        t = float(smooth(-BL[b], BL[b], plane(b, x)))
        out = {b: t} if t > 0 else {}
        if t < 1:
            for k, v in chain(x, p).items():
                out[k] = out.get(k, 0.0) + (1 - t) * v
        return out

    child = {'upper': 'fore', 'fore': 'hand'}
    for d in range(1, 6):
        child['d%d1' % d] = 'd%d2' % d
        child['d%d2' % d] = 'd%d3' % d

    res_i = np.zeros((n, 4), np.uint8)
    res_w = np.zeros((n, 4), np.uint8)
    for i in range(n):
        x = X[i]
        if sw[i] < 0:
            b = 'fore' if plane('fore', x) > 0 else 'upper'
        else:
            b = near[i]
        c = nearfirst[i] if b == 'hand' else child.get(b)
        if c is not None and plane(c, x) > -BL[c]:
            b = c
        w = chain(x, b)
        # The forearm's weight, shared out over its three twist segments by
        # how far down the forearm the vertex is.
        if 'fore' in w:
            wf = w.pop('fore')
            u = float(np.clip(plane('fore', x) / np.linalg.norm(tail['fore'] - head['fore']),
                              0.0, 1.0))
            for name, share in (('fore0', max(0.0, 1 - 2 * u)),
                                ('fore1', 1 - abs(2 * u - 1)),
                                ('fore2', max(0.0, 2 * u - 1))):
                if share > 0:
                    w[name] = w.get(name, 0.0) + wf * share
        gs = sorted(((v, BI[k]) for k, v in w.items() if v > 1e-4), reverse=True)[:4]
        tot = sum(v for v, _ in gs)
        q = [int(round(v / tot * 255)) for v, _ in gs]
        q[0] += 255 - sum(q)
        for j, ((_v, bi), qq) in enumerate(zip(gs, q)):
            res_i[i, j] = bi
            res_w[i, j] = qq
    return res_i, res_w, dirv, head, tail


# ── the nails ────────────────────────────────────────────────────────────── #

def nail_field(X, N, J, head, tail, palm):
    """0..1 nail plate, and 0..1 along it from cuticle to free edge.

    In each distal phalanx's own frame: `s` down the bone, `h` up out of the
    back of the finger, `x` across it. A nail is on the back, starts a third of
    the way down the bone with its cuticle curved back at the sides, and runs
    to just past the tip.
    """
    cov = np.zeros(len(X))
    along = np.zeros(len(X))
    for d in range(1, 6):
        b = 'd%d3' % d
        a = head[b]
        L = np.linalg.norm(J['r-finger-%d-4' % d] - a)
        y = (tail[b] - a) / np.linalg.norm(tail[b] - a)
        # The back of the finger: away from the palm. The thumb's nail faces
        # the other way round its own axis — it is turned most of a right
        # angle from the fingers — so it is found from the thumb itself: the
        # side of the thumb facing away from the index finger's root, and
        # away from the palm.
        if d == 1:
            k = J['r-finger-2-1'] - a
            up = -(k - y * (k @ y)) / np.linalg.norm(k - y * (k @ y))
            up = up * 0.75 - palm * 0.55
        else:
            up = -palm
        up = up - y * (up @ y)
        up /= np.linalg.norm(up)
        xa = np.cross(y, up)
        r = X - a
        s = (r @ y) / L
        h = r @ up
        x = r @ xa
        # Half-width of the plate, as a fraction of the finger's own radius.
        rad = RADIUS[b] * (1.18 if d == 1 else 1.0)
        xn = x / (rad * 0.80)
        facing = N @ up
        cut = 0.40 + 0.16 * xn * xn          # the cuticle arch
        c = (smooth(cut - 0.03, cut + 0.03, s) * (1 - smooth(1.02, 1.12, s))
             * (1 - smooth(0.82, 1.0, np.abs(xn))) * smooth(0.25, 0.55, facing)
             * (h > 0))
        m = c > cov
        cov[m] = c[m]
        along[m] = np.clip((s[m] - cut[m]) / np.maximum(1.06 - cut[m], 1e-3), 0, 1)
    return cov, along


# ── the atlas ────────────────────────────────────────────────────────────── #

def uv_islands(T, tris_t):
    parent = list(range(len(T)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for a, b, c in tris_t:
        for u, v in ((a, b), (b, c)):
            ru, rv = find(u), find(v)
            if ru != rv:
                parent[ru] = rv
    groups = {}
    for i in {t for tri in tris_t for t in tri}:
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def pack(boxes, width):
    """Shelf-pack (w, h) boxes, tallest first. Returns positions and height."""
    order = sorted(range(len(boxes)), key=lambda i: -boxes[i][1])
    pos = [None] * len(boxes)
    x = y = shelf = 0
    for i in order:
        w, h = boxes[i]
        if x + w > width:
            x, y, shelf = 0, y + shelf, 0
        pos[i] = (x, y)
        x += w
        shelf = max(shelf, h)
    return pos, y + shelf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=str(ROOT),
                    help='checkout whose build/ holds mh_bodies and mh_assets')
    ap.add_argument('--width', type=int, default=1024)
    ap.add_argument('--quality', type=int, default=88)
    args = ap.parse_args()
    src = Path(args.src)
    body_p, skin_p = src / BODY, src / SKIN
    for p in (body_p, skin_p):
        if not p.exists():
            sys.exit('[hand] missing %s (run tools/blender/mh_morph.py and '
                     'tools/wardrobe/assets.py, or pass --src)' % p)

    vs, vts, faces = read_obj(body_p)
    bodyv = sorted({vi for f in faces['body'] for vi, _ in f})
    ys = vs[bodyv, 1]
    s = TARGET_H / (ys.max() - ys.min())
    drop = -ys.min() * s

    def g(v):
        return np.stack([v[..., 2] * s, v[..., 1] * s + drop, -v[..., 0] * s], -1)
    G = g(vs)
    J = {}
    for name, fl in faces.items():
        if name.startswith('joint-'):
            idx = sorted({vi for f in fl for vi, _ in f})
            J[name[6:]] = g(vs[idx].mean(0))

    quads = cut_arm(G, faces, J)
    P, T, quads = compact(G, vts, quads)
    print('[hand] cut %d quads, %d positions' % (len(quads), len(P)))
    P, T, quads = subdivide(P, T, quads)
    P, T, quads = compact(P, T, quads)
    print('[hand] subdivided: %d quads, %d positions, %d uvs' % (len(quads), len(P), len(T)))

    # Normals, per POSITION so a UV seam is not a lighting seam.
    tris = []
    for q in quads:
        tris.append((q[0], q[1], q[2]))
        tris.append((q[0], q[2], q[3]))
    acc = np.zeros_like(P)
    for a, b, c in tris:
        fn = np.cross(P[b[0]] - P[a[0]], P[c[0]] - P[a[0]])
        acc[a[0]] += fn
        acc[b[0]] += fn
        acc[c[0]] += fn

    # The cap across the cut: boundary edges, walked into a loop, fanned to
    # their centroid with the winding turned round.
    ecount = {}
    for q in quads:
        for i in range(4):
            a, b = q[i][0], q[(i + 1) % 4][0]
            ecount[(a, b)] = ecount.get((a, b), 0) + 1
    bedges = [(a, b) for (a, b) in ecount if (b, a) not in ecount]
    nxt = {a: b for a, b in bedges}
    loops, seen = [], set()
    for a, _b in bedges:
        if a in seen:
            continue
        loop, v = [], a
        while v not in seen:
            seen.add(v)
            loop.append(v)
            v = nxt[v]
        loops.append(loop)
    print('[hand] boundary loops', [len(lp) for lp in loops])
    loop = max(loops, key=len)
    ptex = {}
    for q in quads:
        for v, t in q:
            ptex.setdefault(v, t)
    cen = P[loop].mean(0)
    ci = len(P)
    P = np.vstack([P, cen])
    acc = np.vstack([acc, np.zeros(3)])
    capn = np.zeros(3)
    ct = ptex[loop[0]]
    for i in range(len(loop)):
        a, b = loop[i], loop[(i + 1) % len(loop)]
        # Boundary edge a->b belongs to a face; the cap runs b->a.
        tris.append(((b, ct), (a, ct), (ci, ct)))
        capn += np.cross(P[a] - P[b], P[ci] - P[b])
    Nrm = acc / np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-12)
    capn /= np.linalg.norm(capn)
    # The cap's own vertices take the cap's normal rather than the rim's.
    Nrm[ci] = capn

    # GPU vertices, one per (position, uv) — with the cap split off so it can
    # carry its own flat normal without bending the rim.
    key, gv = {}, []
    gtris = []
    capset = set()
    for ti, tri in enumerate(tris):
        is_cap = ti >= 2 * len(quads)
        out = []
        for v, t in tri:
            k = (v, t, is_cap)
            j = key.get(k)
            if j is None:
                j = key[k] = len(gv)
                gv.append(k)
                if is_cap:
                    capset.add(j)
            out.append(j)
        gtris.append(out)
    X = np.array([P[v] for v, _t, _c in gv])
    NN = np.array([capn if c else Nrm[v] for v, _t, c in gv])
    UV = np.array([T[t] for _v, t, _c in gv])
    print('[hand] %d GPU vertices, %d triangles' % (len(gv), len(gtris)))

    bidx, bwgt, dirv, head, tail = weights(X, J)

    Wr = J['r-hand']
    a = J['r-finger-3-1'] - Wr
    a /= np.linalg.norm(a)
    k = J['r-finger-5-1'] - J['r-finger-2-1']
    k -= a * (k @ a)
    k /= np.linalg.norm(k)
    palm = np.cross(a, k)
    ncov, nalong = nail_field(X, NN, J, head, tail, palm)
    print('[hand] nail vertices', int((ncov > 0.5).sum()))

    # ── atlas ──
    skin = Image.open(skin_p).convert('RGB')
    S = skin.size[0]
    tri_t = [tuple(gv[j][1] for j in tri) for tri in gtris]
    isl = uv_islands(T, tri_t)
    PAD = 10
    boxes, spans = [], []
    for grp in isl:
        uv = T[grp]
        x0 = int(np.floor(uv[:, 0].min() * S)) - PAD
        x1 = int(np.ceil(uv[:, 0].max() * S)) + PAD
        y0 = int(np.floor((1 - uv[:, 1].max()) * S)) - PAD
        y1 = int(np.ceil((1 - uv[:, 1].min()) * S)) + PAD
        x0, y0 = max(x0, 0), max(y0, 0)
        x1, y1 = min(x1, S), min(y1, S)
        boxes.append((x1 - x0, y1 - y0))
        spans.append((x0, y0, x1, y1))
    Wd = args.width
    pos, H = pack(boxes, Wd)
    H = (H + 7) // 8 * 8
    atlas = Image.new('RGB', (Wd, H), (200, 160, 140))
    # Bleed the whole atlas background from a blur of the source so a mip level
    # that reaches past an island's edge finds skin, not a flat colour.
    remap = {}
    for grp, (x0, y0, x1, y1), (px, py) in zip(isl, spans, pos):
        atlas.paste(skin.crop((x0, y0, x1, y1)), (px, py))
        for t in grp:
            u, v = T[t]
            remap[t] = ((u * S - x0 + px) / Wd, 1 - ((1 - v) * S - y0 + py) / H)
    print('[hand] %d uv islands -> atlas %dx%d' % (len(isl), Wd, H))
    UV = np.array([remap[gv[j][1]] for j in range(len(gv))])

    # Paint the nails.
    A = np.asarray(atlas).astype(np.float32)
    lum = A.mean(2, keepdims=True)
    paint = np.zeros(A.shape[:2], np.float32)
    along_px = np.zeros(A.shape[:2], np.float32)
    for tri in gtris:
        c = np.array([ncov[j] for j in tri])
        if c.max() <= 0.0:
            continue
        uv = np.array([[UV[j][0] * Wd, (1 - UV[j][1]) * H] for j in tri])
        pts = np.array([X[j] for j in tri])
        nrm = np.array([NN[j] for j in tri])
        x0, y0 = np.maximum(np.floor(uv.min(0)).astype(int) - 1, 0)
        x1, y1 = np.ceil(uv.max(0)).astype(int) + 2
        x1, y1 = min(x1, Wd), min(y1, H)
        if x1 <= x0 or y1 <= y0:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1]
        px_, py_ = xx + 0.5, yy + 0.5
        (ax, ay), (bx, by), (cx, cy) = uv
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9:
            continue
        l0 = ((by - cy) * (px_ - cx) + (cx - bx) * (py_ - cy)) / den
        l1 = ((cy - ay) * (px_ - cx) + (ax - cx) * (py_ - cy)) / den
        l2 = 1 - l0 - l1
        # A texel or so outside the triangle as well, so the edge of the
        # painted plate does not stop a half texel short of the seam.
        inside = (l0 >= -0.08) & (l1 >= -0.08) & (l2 >= -0.08)
        if not inside.any():
            continue
        L = np.stack([l0, l1, l2], -1)[inside]
        Xp = L @ pts
        Np = L @ nrm
        Np /= np.maximum(np.linalg.norm(Np, axis=1, keepdims=True), 1e-9)
        cv, al = nail_field(Xp, Np, J, head, tail, palm)
        blk = paint[y0:y1, x0:x1]
        abk = along_px[y0:y1, x0:x1]
        cur = blk[inside]
        m = cv > cur
        cur[m] = cv[m]
        blk[inside] = cur
        ab = abk[inside]
        ab[m] = al[m]
        abk[inside] = ab
    paint = np.asarray(Image.fromarray((paint * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(0.8))).astype(np.float32)[..., None] / 255.0
    al = along_px[..., None]
    # The plate. Pink over the bed, a paler half-moon at the root, a clean
    # free edge at the tip, and a hair of darker cuticle round the arch.
    bed = A * np.array([1.00, 0.84, 0.84]) * 0.95 + np.array([22.0, 10.0, 14.0])
    lunula = A * 0.55 + np.array([236.0, 214.0, 208.0]) * 0.45
    edge = np.array([238.0, 226.0, 214.0])
    col = bed
    col = col * (1 - smooth(0.16, 0.05, al)) + lunula * smooth(0.16, 0.05, al) * 0.6 \
        + col * smooth(0.16, 0.05, al) * 0.4
    col = col * (1 - smooth(0.80, 0.88, al)) + edge * smooth(0.80, 0.88, al)
    # Cuticle: the rim of the mask, darker, on the proximal side only.
    rim = (paint > 0.05) & (paint < 0.55) & (al < 0.2)
    A = A * (1 - paint) + col * paint
    A = np.where(rim, A * 0.86, A)
    atlas = Image.fromarray(A.round().clip(0, 255).astype(np.uint8))

    OUT.mkdir(parents=True, exist_ok=True)
    jp = OUT / 'chloe2_arm.jpg'
    atlas.save(jp, quality=args.quality, optimize=True)

    # ── the blob ──
    nv, ni = len(X), len(gtris) * 3
    lo = X.min(0)
    ext = X.max(0) - lo
    qp = np.round((X - lo) / ext * 65535).astype('<u2')
    qn = np.round(np.clip(NN, -1, 1) * 127).astype('i1')
    qt = np.round(np.clip(UV, 0, 1) * 65535).astype('<u2')
    qm = np.round(ncov * 255).astype('u1')
    idx = np.array(gtris, '<u2' if nv < 65536 else '<u4').ravel()
    parts = [struct.pack('<4sIIII', b'FRHD', 1, nv, ni, len(JOINTS)),
             struct.pack('<6f', *lo, *ext)]
    for j in JOINTS:
        parts.append(struct.pack('<3f', *J[j]))
    parts += [qp.tobytes(), qt.tobytes(), qn.tobytes(), bidx.tobytes(), bwgt.tobytes(),
              qm.tobytes()]
    parts.append(b'\0' * ((-sum(len(p) for p in parts)) % 4))
    parts.append(idx.tobytes())
    raw = b''.join(parts)
    bp = OUT / 'chloe2_arm.frhd.gz'
    with gzip.open(bp, 'wb', compresslevel=9) as f:
        f.write(raw)
    print('[hand] %s %d verts %d tris, %.0f KB raw, %.0f KB gz; %s %.0f KB'
          % (bp.name, nv, ni // 3, len(raw) / 1024, bp.stat().st_size / 1024,
             jp.name, jp.stat().st_size / 1024))
    print('[hand] upper %.4f fore %.4f' % (np.linalg.norm(J['r-elbow'] - J['r-shoulder']),
                                            np.linalg.norm(J['r-hand'] - J['r-elbow'])))


if __name__ == '__main__':
    main()
