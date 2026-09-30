#!/usr/bin/env python3
"""
Eyelids and teeth for the Jadrija bathers, at the resolution a close-up needs.

    python3 tools/face_morphs.py            # runs this first, then the morphs

Misha, 30 Sep 2026, on the polish pass after the faces (1.551.0): *"sure do
eyelids and teeth"*.

Three things were rough at the magnification of a close-up:

  - a SHUT EYE had a torn lid line. The body shell is Blender's collapse
    decimator's 7 000 triangles, and it left about a dozen vertices on an
    upper lid that MakeHuman models with seventy. The blink is baked right
    (face_morphs.py); there was just not enough lid to carry it, so the lid
    came down as a zigzag and the eyeball showed through the gaps;
  - the EYEBALL was MakeHuman's `helper-*-eye`, a fitting volume of 35
    quads a shade larger than the eye, whose facets came through the skin
    at the corners of a shut lid;
  - the TEETH were MakeHuman's `helper-upper-teeth` / `helper-lower-teeth`:
    fitting volumes, a smooth band each, which an open mouth showed as one
    flat beige slab.

All three are fixed here, on the PACKED blob, before face_morphs.py bakes the
expressions — so the morphs are measured on the geometry that ships, and a
rebake through bathers_v2.py (`save_skin(..., morph=)`) lands on the same
bytes a conversion writes.

── the lids: MakeHuman's own, stitched in ─────────────────────────────────────

The bather was decimated from a body the project still has
(build/mh_bodies/mh_<name>.obj, the file bathers_v2.py read), in the same
space to within a measured scale and drop (`fit`, off the eyeballs, as
face_morphs.py does). So round each eye, within `EYE_K` eyeball radii of its
centre, the decimated triangles are cut out and MakeHuman's own faces put
back — the lids, the canthi and the fold of the socket behind them, at full
resolution — and the ring between the two edges is zipped shut by angle
round the eye. The fold behind `EYE_BACK` is left out (the eyeball hides it
whatever the lid does, and it is a third of the vertices), so what goes in is
an annulus, about 550 triangles an eye for the 160 it replaces. Everything
MakeHuman's face rig does to a lid then has the vertices to do it with; the
morph transfer (UV barycentric) lands every one of them on the rig's own
displacement to 0.06 mm, since each IS a MakeHuman vertex. How far the lid
comes down, and the in-between that keeps it off the eyeball half way, are
face_morphs.py's (`lid_closure`, `LID_MID`, `LID_PUSH`).

The eyeball becomes a smooth ball (`eyeballs`): MakeHuman's own eye's size,
0.96 of the helper's fitted radius, about the same centre.

── the teeth: MakeHuman's own, fitted ─────────────────────────────────────────

`teeth_base` and `tongue01` from makehuman_system_assets (CC0, Data
Collection AB / Joel Palmius / Jonas Hauquier; see bathers_v2_CREDITS.md),
fitted to each body through their `.mhclo` exactly as the hair and swimwear
are: a vertex rides a triangle of base-mesh vertices (here, the helper
teeth and tongue this blob already carries, by file index) plus an offset
in the body's own proportions. The teeth mesh is 3 560 faces of 32 teeth and
gums — too many to carry forty times — so the molars nobody sees are left
out and the rest collapsed, once, in Blender: tools/face/mouth_lo.obj (made
by tools/blender/teeth_lo.py, committed), 430 triangles of twenty teeth,
259 of gum and 150 of tongue, against the helpers' 640. Each of its
vertices binds to the triangle of the full asset it came from (piece to
piece: an upper incisor stands in front of the lower one, and binding by
nearest triangle alone drew the upper teeth down into fangs as the jaw
opened), and so, through the .mhclo, to nine base vertices — whose
displacement face_morphs.py gives it exactly (`mouth_binding`).

What each vertex is rides in its UV, as the eyes and mouth already do:
u in [4, 5) is the mouth, and v says which part — v = 0.25 a tooth, 0.5 the
gum, 0.75 the tongue — for the body shader in src/42-bathers2.js.
"""

from __future__ import annotations

import json
import struct
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
EYE_U, MOUTH_U = 2.5, 4.5
# Round each eye, within this many eyeball radii of its centre, the decimated
# shell is replaced by MakeHuman's own faces. 1.6 takes in both lids to the
# crease and the fold behind them, and stops short of the brow and the nose.
EYE_K = 1.35
# ...and in front of this many eyeball radii ahead of its centre.
EYE_BACK = 0.3
# The eyeball: MakeHuman's own eye (eyes/high-poly, fitted) is 0.96 of the
# helper's radius about the same centre; drawn as a ball of this many rings
# pole to pole, and segments round.
EYE_R = 0.96
EYE_RINGS, EYE_SEGS = 10, 20


class Skin:
    """A v5 blob's arrays, to edit and write back."""

    def __init__(self, raw: bytes):
        magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
        assert magic == b"FR3D" and ver == 5, ver
        self.head = bytearray(raw[:44])
        o = 44
        self.pos = np.frombuffer(raw, "<f4", nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
        self.nrm = np.frombuffer(raw, "<f4", nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
        self.uv = np.frombuffer(raw, "<f4", nv * 2, o).reshape(-1, 2).astype(np.float64); o += nv * 8
        self.bi = np.frombuffer(raw, np.uint8, nv * 4, o).reshape(-1, 4).copy(); o += nv * 4
        self.bw = np.frombuffer(raw, np.uint8, nv * 4, o).reshape(-1, 4).copy(); o += nv * 4
        o = (o + 3) & ~3
        self.idx = np.frombuffer(raw, "<u4", ni, o).astype(np.int64); o += ni * 4
        n, = struct.unpack_from("<I", raw, o); o += 4
        self.parts = []
        for _ in range(n):
            ln, = struct.unpack_from("<H", raw, o)
            nm = raw[o + 2:o + 2 + ln].decode(); o += 2 + ln
            mat, st, cnt = struct.unpack_from("<III", raw, o); o += 12
            self.parts.append([nm, mat, st, cnt])
        self.rest = raw[o:]
        self.lo = np.array(struct.unpack_from("<3f", raw, 16))
        self.hi = np.array(struct.unpack_from("<3f", raw, 28))

    def tris(self, part):
        _n, _m, st, cnt = next(p for p in self.parts if p[0] == part)
        return self.idx[st:st + cnt].reshape(-1, 3)

    def rebuild(self, keep_v, parts_tris, new_v):
        """keep_v: old vertex indices kept, in order; parts_tris: {part: tris
        in the NEW numbering}; new_v: dict of arrays appended after them."""
        remap = np.full(len(self.pos), -1, np.int64)
        remap[keep_v] = np.arange(len(keep_v))
        self.pos = np.concatenate([self.pos[keep_v], new_v["pos"]])
        self.nrm = np.concatenate([self.nrm[keep_v], new_v["nrm"]])
        self.uv = np.concatenate([self.uv[keep_v], new_v["uv"]])
        self.bi = np.concatenate([self.bi[keep_v], new_v["bi"]])
        self.bw = np.concatenate([self.bw[keep_v], new_v["bw"]])
        idx = []
        for p in self.parts:
            t = parts_tris[p[0]]
            p[2], p[3] = sum(len(x) for x in idx), t.size
            idx.append(t.reshape(-1))
        self.idx = np.concatenate(idx)
        return remap

    def raw(self) -> bytes:
        nv, ni = len(self.pos), len(self.idx)
        lo, hi = self.pos.min(0), self.pos.max(0)
        assert np.all(lo >= self.lo - 1e-6) and np.all(hi <= self.hi + 1e-6), \
            "new vertices outside the blob's box"
        head = bytearray(self.head)
        struct.pack_into("<II", head, 8, nv, ni)
        out = [bytes(head), self.pos.astype("<f4").tobytes(), self.nrm.astype("<f4").tobytes(),
               self.uv.astype("<f4").tobytes(), self.bi.tobytes(), self.bw.tobytes()]
        out.append(b"\0" * ((-sum(len(x) for x in out)) % 4))
        out.append(self.idx.astype("<u4").tobytes())
        out.append(struct.pack("<I", len(self.parts)))
        for nm, mat, st, cnt in self.parts:
            b = nm.encode()
            out.append(struct.pack("<H", len(b)) + b + struct.pack("<III", mat, st, cnt))
        out.append(self.rest)
        return b"".join(out)


def fit(sk, name):
    """The MakeHuman body this bather was made from, and the scale and drop
    that put it in the blob — off the eyeballs, which both sides carry vertex
    for vertex (face_morphs.py measures it the same way)."""
    import face_morphs as FM
    vs, groups, vts, corners = FM.read_obj(FM.bodies_dir() / ("mh_%s.obj" % name), uvs=True)
    gv = {g: np.array(sorted({v for f in fs for v in f})) for g, fs in groups.items()}
    s, drop = FM.eye_transform(sk.pos, sk.uv, vs, gv)
    return dict(vs=vs, groups=groups, gv=gv, vts=vts, corners=corners, s=s, drop=drop,
                P=FM.to_blob(vs, s, drop))


def _loop(edges):
    """One closed loop out of undirected edges, or an error."""
    adj = defaultdict(list)
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    assert all(len(v) == 2 for v in adj.values()), "boundary is not a simple loop"
    start = min(adj)
    loop, prev, cur = [start], None, start
    while True:
        nx = adj[cur][0] if adj[cur][0] != prev else adj[cur][1]
        if nx == start:
            break
        loop.append(nx)
        prev, cur = cur, nx
    assert len(loop) == len(adj), "boundary is %d loops" % (1 + len(adj) - len(loop))
    return loop


def _loops(edges):
    """Every closed loop out of undirected edges, each vertex on one loop."""
    adj = defaultdict(list)
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    assert all(len(v) == 2 for v in adj.values()), "boundary is not simple loops"
    seen, out = set(), []
    for s0 in sorted(adj):
        if s0 in seen:
            continue
        loop, prev, cur = [s0], None, s0
        seen.add(s0)
        while True:
            nx = adj[cur][0] if adj[cur][0] != prev else adj[cur][1]
            if nx == s0:
                break
            loop.append(nx); seen.add(nx)
            prev, cur = cur, nx
        out.append(loop)
    return out


def _boundary(tris):
    ec = Counter()
    for t in tris:
        for k in range(3):
            a, b = int(t[k]), int(t[(k + 1) % 3])
            ec[(min(a, b), max(a, b))] += 1
    return [e for e, c in ec.items() if c == 1]


def _components(W, sel):
    """Edge-connected patches of the selected triangles: {tri: patch}, sizes."""
    live = np.nonzero(sel)[0]
    by_edge = defaultdict(list)
    for t in live:
        for k in range(3):
            a, b = int(W[t, k]), int(W[t, (k + 1) % 3])
            by_edge[(min(a, b), max(a, b))].append(t)
    comp, sizes = {}, []
    for t0 in live:
        if t0 in comp:
            continue
        n = len(sizes)
        comp[t0] = n
        st, cnt = [t0], 0
        while st:
            t = st.pop()
            cnt += 1
            for k in range(3):
                a, b = int(W[t, k]), int(W[t, (k + 1) % 3])
                for u in by_edge[(min(a, b), max(a, b))]:
                    if u not in comp:
                        comp[u] = n
                        st.append(u)
        sizes.append(cnt)
    return comp, sizes


def _main_patch(W, cut):
    """Only the largest connected patch of `cut`: on a child the ball also
    reaches the far end of the nostril, which is not an eye."""
    comp, sizes = _components(W, cut)
    main = int(np.argmax(sizes))
    out = np.zeros_like(cut)
    for t, n in comp.items():
        out[t] = n == main
    return out


def _fill_islands(W, skin_t, cut):
    """Add to `cut` every patch of skin it encloses — a triangle or two the
    ball missed deep in the fold of the socket leaves the cut an annulus,
    and the zip wants a disk."""
    comp, sizes = _components(W, skin_t & ~cut)
    main = int(np.argmax(sizes))
    out = cut.copy()
    for t, n in comp.items():
        if n != main:
            out[t] = True
    return out


def _angles(P, c, ax1, ax2):
    q = P - c
    return np.arctan2(q @ ax2, q @ ax1)


def _orient(loop, ang):
    """Counter-clockwise by angle, starting nearest angle -pi."""
    a = np.unwrap(ang[loop])
    if a[-1] < a[0]:
        loop = loop[::-1]
    k = int(np.argmin(np.mod(ang[loop], 2 * np.pi)))
    return loop[k:] + loop[:k]


def eyelids(sk, M, verbose=False):
    """Cut the decimated shell out round each eye and put MakeHuman's own
    faces back, zipped to the cut by angle round the eye. In place."""
    import face_morphs as FM
    body = sk.tris("body")
    uv = sk.uv
    eyef = (uv[:, 0] >= 2) & (uv[:, 0] < 3)
    mouthf = uv[:, 0] >= 4
    skin_t = ~(eyef[body].any(1) | mouthf[body].any(1))
    P = M["P"]
    # MakeHuman's body triangles, with their (vertex, uv) corners.
    mt_v, mt_t = [], []
    for f in M["corners"]["body"]:
        for k in range(1, len(f) - 1):
            c = (f[0], f[k], f[k + 1])
            mt_v.append([x[0] for x in c])
            mt_t.append([x[1] for x in c])
    mt_v, mt_t = np.array(mt_v), np.array(mt_t)
    mn = FM.vertex_normals(M["vs"], [list(t) for t in mt_v])
    mn = FM.dir_to_blob(mn, 1.0)
    mn /= np.maximum(np.linalg.norm(mn, axis=1, keepdims=True), 1e-12)
    # The blob's vertices welded by position: its split copies along a UV
    # seam decode to the same quantised point.
    _u, weld = np.unique(sk.pos.round(7), axis=0, return_inverse=True)
    first = np.full(len(_u), -1)
    for i in range(len(weld) - 1, -1, -1):
        first[weld[i]] = i
    weld = first[weld.reshape(-1)]

    drop_t = np.zeros(len(body), bool)
    new_pos, new_nrm, new_uv = [], [], []
    new_tris = []          # in a numbering where new vertex k is -1 - k
    key = {}

    def nv_of(vi, ti):
        k = (vi, ti)
        if k not in key:
            key[k] = len(new_pos)
            new_pos.append(P[vi]); new_nrm.append(mn[vi])
            new_uv.append(M["vts"][ti])
        return -1 - key[k]

    for side in (1, -1):
        e = eyef & (np.sign(sk.pos[:, 2]) == side)
        c = sk.pos[e].mean(0)
        r = np.linalg.norm(sk.pos[e] - c, axis=1).mean()
        R = EYE_K * r
        # MakeHuman's side: every face wholly inside the ball and in front of
        # EYE_BACK — the fold of the socket behind that is hidden by the
        # eyeball whatever the lid does, and is a third of the vertices. The
        # patch is an annulus, then: the zip is on its outer edge.
        q = P - c
        inm = (np.linalg.norm(q, axis=1) < R) & (q[:, 0] > EYE_BACK * r)
        mk = inm[mt_v].all(1)
        comp, sizes = _components(mt_v, mk)
        main = int(np.argmax(sizes))
        mk = np.zeros_like(mk)
        for t, n in comp.items():
            mk[t] = n == main
        mv, mtt = mt_v[mk], mt_t[mk]
        loops = _loops(_boundary(mv))
        C = max(loops, key=lambda L: np.linalg.norm(q[L][:, 1:], axis=1).mean())
        # The blob's side: every skin triangle with any corner inside, as one
        # disk. Its vertices are split along UV seams (one per vertex and uv,
        # as read_back in bathers_v2.py makes them), so the edge of the cut is
        # found on vertices welded by position.
        inb = np.linalg.norm(sk.pos - c, axis=1) < R
        cut = skin_t & inb[body].any(1)
        W = weld[body]
        cut = _main_patch(W, cut)
        cut = _fill_islands(W, skin_t, cut)
        drop_t |= cut
        B = _loop(_boundary(W[cut]))
        # Each edge of the cut, as the triangle outside it runs it: the GPU
        # corners a band triangle on that edge uses, and which way round.
        bcopy = {}
        on = set(B)
        for t, tw in zip(body[skin_t & ~cut], W[skin_t & ~cut]):
            for k in range(3):
                a, b = int(tw[k]), int(tw[(k + 1) % 3])
                if a in on and b in on:
                    bcopy[(a, b)] = (int(t[k]), int(t[(k + 1) % 3]), True)
                    bcopy[(b, a)] = (int(t[(k + 1) % 3]), int(t[k]), False)
        # MakeHuman's winding against the blob's: vote over the patch's faces
        # by the nearest blob normal (the two meshes lie on one surface).
        fa, fb, fc = P[mv[:, 0]], P[mv[:, 1]], P[mv[:, 2]]
        fn = np.cross(fb - fa, fc - fa)
        cen = (fa + fb + fc) / 3
        skin_v = np.unique(body[skin_t & ~cut])
        nb_ = skin_v[FM._near(sk.pos[skin_v], cen)[1][:, 0]]
        vote = np.sign((fn * sk.nrm[nb_]).sum(1))
        wn = np.linalg.norm(cen - sk.pos[nb_], axis=1) < 0.004
        if (vote[wn]).sum() < 0:
            mv, mtt = mv[:, [0, 2, 1]], mtt[:, [0, 2, 1]]
        ccopy = {}
        for tv, tt in zip(mv, mtt):
            for k in range(3):
                a, b = int(tv[k]), int(tv[(k + 1) % 3])
                ccopy[(a, b)] = (int(tt[k]), int(tt[(k + 1) % 3]), True)
                ccopy[(b, a)] = (int(tt[(k + 1) % 3]), int(tt[k]), False)
        for tv, tt in zip(mv, mtt):
            new_tris.append([nv_of(int(a), int(b)) for a, b in zip(tv, tt)])
        # The ring between the two edges, zipped by angle round the eye (the
        # face looks down +x; z across, y up): advance whichever loop's next
        # point comes first, both counted from the same zero. Each band
        # triangle runs its loop edge the other way from the face beside it.
        ax1, ax2 = np.array([0.0, 0.0, 1.0]), np.array([0.0, 1.0, 0.0])
        aB = np.zeros(len(sk.pos)); aB[B] = _angles(sk.pos[B], c, ax1, ax2)
        aC = np.zeros(len(P)); aC[C] = _angles(P[C], c, ax1, ax2)
        B, C = _orient(B, aB), _orient(C, aC)
        ub = np.unwrap(aB[B + [B[0]]]); ub += aB[B[0]] - ub[0]
        uc = np.unwrap(aC[C + [C[0]]]); uc += aC[C[0]] - uc[0]
        nb, nc = len(B), len(C)
        ub[-1], uc[-1] = ub[0] + 2 * np.pi, uc[0] + 2 * np.pi
        i = j = 0
        while i < nb or j < nc:
            b0, b1 = B[i % nb], B[(i + 1) % nb]
            c0, c1 = C[j % nc], C[(j + 1) % nc]
            if j >= nc or (i < nb and ub[i + 1] <= uc[j + 1]):
                g0, g1, fwd = bcopy[(b0, b1)]
                t0 = ccopy[(c0, c1)][0] if (c0, c1) in ccopy else ccopy[(C[j - 1], c0)][1]
                cc = nv_of(c0, t0)
                new_tris.append([g1, g0, cc] if fwd else [g0, g1, cc])
                i += 1
            else:
                t0, t1, fwd = ccopy[(c0, c1)]
                g0 = bcopy[(b0, b1)][0] if (b0, b1) in bcopy else bcopy[(B[i - 1], b0)][1]
                x0, x1 = nv_of(c0, t0), nv_of(c1, t1)
                new_tris.append([g0, x1, x0] if fwd else [g0, x0, x1])
                j += 1
        if verbose:
            print("  eye %+d: r %.1f mm, cut %d tris (edge %d), put back %d MakeHuman tris (edge %d, %d loops)"
                  % (side, r * 1000, cut.sum(), len(B), len(mv), len(C), len(loops)))
    pos = np.array(new_pos)
    # Bone weights of a new vertex: the nearest surviving skin vertex's.
    bi, bw = _bones_near(sk, pos, np.unique(body[skin_t & ~drop_t]))
    return dict(drop_t=drop_t, pos=pos, nrm=np.array(new_nrm), uv=np.array(new_uv),
                bi=bi, bw=bw, tris=new_tris)


def _bones_near(sk, pts, pool):
    """Bone indices and weights of the nearest vertex of `pool` to each point."""
    from face_morphs import _near
    pool = np.asarray(pool)
    k = pool[_near(sk.pos[pool], pts)[1][:, 0]]
    return sk.bi[k], sk.bw[k]


def _sphere_fit(p):
    A = np.c_[2 * p, np.ones(len(p))]
    x = np.linalg.lstsq(A, (p ** 2).sum(1), rcond=None)[0]
    return x[:3], float(np.sqrt(x[3] + (x[:3] ** 2).sum()))


def eyeballs(sk, verbose=False):
    """MakeHuman's `helper-*-eye` is a fitting volume of 35 quads, a shade
    larger than the eye it stands for: at the corners of a shut lid its
    facets came through the skin. In its place a smooth ball, the size of
    MakeHuman's own eye (`EYE_R` of the helper's fitted radius), pole
    forward, rings symmetric about the centre — so the mean of its vertices,
    which is how the page finds an eye (`bather2Eyes`), is still the centre."""
    body = sk.tris("body")
    eyef = (sk.uv[:, 0] >= 2) & (sk.uv[:, 0] < 3)
    drop_t = eyef[body].any(1)
    pos, nrm, tris = [], [], []
    bi, bw = [], []
    for side in (1, -1):
        e = np.nonzero(eyef & (np.sign(sk.pos[:, 2]) == side))[0]
        c, r = _sphere_fit(sk.pos[e])
        r *= EYE_R
        base = len(pos)
        th = np.linspace(0, np.pi, EYE_RINGS + 1)
        ph = np.linspace(0, 2 * np.pi, EYE_SEGS, endpoint=False)
        ring = []
        for i, t in enumerate(th):
            row = []
            for f in ([0.0] if i in (0, EYE_RINGS) else ph):
                d = np.array([np.cos(t), np.sin(t) * np.cos(f), np.sin(t) * np.sin(f)])
                row.append(len(pos))
                pos.append(c + r * d)
                nrm.append(d)
            ring.append(row)
        n = EYE_SEGS
        for i in range(EYE_RINGS):
            a, b = ring[i], ring[i + 1]
            for j in range(n):
                if len(a) == 1:
                    tris.append([a[0], b[j], b[(j + 1) % n]])
                elif len(b) == 1:
                    tris.append([a[j], b[0], a[(j + 1) % n]])
                else:
                    tris.append([a[j], b[j], b[(j + 1) % n]])
                    tris.append([a[j], b[(j + 1) % n], a[(j + 1) % n]])
        q = np.array(pos[base:])
        i, w = _bones_near(sk, q, e)
        bi.append(i); bw.append(w)
        if verbose:
            print("  eyeball %+d: r %.1f mm, %d tris (was %d)" % (side, r * 1000, 2 * n * (EYE_RINGS - 1),
                                                               (eyef[body].all(1) & (np.sign(sk.pos[body[:, 0], 2]) == side)).sum()))
    pos, nrm = np.array(pos), np.array(nrm)
    tris = np.array(tris)
    # Outward: the winding against the radial normal, fixed once for all.
    a_, b_, c_ = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    if (np.cross(b_ - a_, c_ - a_) * nrm[tris[:, 0]]).sum() < 0:
        tris = tris[:, [0, 2, 1]]
    uv = np.tile([EYE_U, 0.5], (len(pos), 1))
    return dict(drop_t=drop_t, pos=pos, nrm=nrm, uv=uv, bi=np.concatenate(bi), bw=np.concatenate(bw),
                tris=[[-1 - v for v in t] for t in tris])


MOUTH_LO = HERE / "face" / "mouth_lo.obj"
# What a mouth vertex is, in v (u is MOUTH_U): the body shader reads it.
MOUTH_V = {"tooth": 0.25, "gum": 0.5, "tongue": 0.75}
GUM_BACK = 0.0015


def _assets():
    for r in (HERE.parent, HERE.parents[3] if HERE.parents[1].name == "worktrees" else None):
        if r and (r / "build" / "mh_assets").is_dir():
            return r / "build" / "mh_assets" / "makehuman_system_assets"
    raise SystemExit("[face] no build/mh_assets — fetch the MakeHuman system assets first")


def read_mhclo(path):
    """(scales, refs (n, 3), weights (n, 3), offsets (n, 3)) — baye2.read_mhclo."""
    sc, refs, ws, offs, inv = {}, [], [], [], False
    for ln in Path(path).read_text(errors="ignore").splitlines():
        w = ln.split()
        if not w:
            continue
        if w[0] in ("x_scale", "y_scale", "z_scale"):
            sc[w[0][0]] = (int(w[1]), int(w[2]), float(w[3]))
            continue
        if w[0] == "verts":
            inv = True
            continue
        if not inv:
            continue
        try:
            if len(w) >= 9:
                refs.append((int(w[0]), int(w[1]), int(w[2])))
                ws.append((float(w[3]), float(w[4]), float(w[5])))
                offs.append((float(w[6]), float(w[7]), float(w[8])))
            elif len(w) == 1:
                refs.append((int(w[0]),) * 3)
                ws.append((1.0, 0.0, 0.0))
                offs.append((0.0, 0.0, 0.0))
            else:
                break
        except ValueError:
            break
    return sc, np.array(refs), np.array(ws), np.array(offs)


def _mhclo_fit(sc, refs, ws, offs, B):
    """baye2.fit_verts: the barycentric blend of three base vertices plus an
    offset in the body's own proportions."""
    s = np.ones(3)
    for k, ax in (("x", 0), ("y", 1), ("z", 2)):
        if k in sc:
            a, b, d = sc[k]
            s[ax] = abs(B[a][ax] - B[b][ax]) / d if d else 1.0
    return (B[refs] * ws[:, :, None]).sum(1) + offs * s


def _closest_on_tris(p, A, B, C):
    """Barycentrics of the closest point to p on each triangle (Ericson)."""
    ab, ac, ap = B - A, C - A, p - A
    d1, d2 = (ab * ap).sum(1), (ac * ap).sum(1)
    bp = p - B
    d3, d4 = (ab * bp).sum(1), (ac * bp).sum(1)
    cp = p - C
    d5, d6 = (ab * cp).sum(1), (ac * cp).sum(1)
    va = d3 * d6 - d5 * d4
    vb = d5 * d2 - d1 * d6
    vc = d1 * d4 - d3 * d2
    den = np.where(np.abs(va + vb + vc) < 1e-20, 1e-20, va + vb + vc)
    v, w = vb / den, vc / den
    bary = np.stack([1 - v - w, v, w], 1)
    # outside: clamp to the nearest edge by projecting and renormalising
    bary = np.clip(bary, 0, None)
    bary /= bary.sum(1, keepdims=True)
    q = bary[:, :1] * A + bary[:, 1:2] * B + bary[:, 2:] * C
    return bary, np.linalg.norm(q - p, axis=1)


def _pieces(tris):
    """Vertex-connected pieces of a triangle list: a list of triangle-index
    arrays."""
    parent = {}

    def find(a):
        parent.setdefault(a, a)
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for t in tris:
        for v in t[1:]:
            ra, rb = find(int(t[0])), find(int(v))
            if ra != rb:
                parent[ra] = rb
    out = defaultdict(list)
    for i, t in enumerate(tris):
        out[find(int(t[0]))].append(i)
    return [np.array(v) for _k, v in sorted(out.items())]


def mouth_binding(M):
    """Every vertex of tools/face/mouth_lo.obj on THIS body: its position in
    MakeHuman space, what it is, and the base-mesh vertices (nine, weighted)
    it rides — so its expression displacement is theirs, exactly (a lower
    tooth goes with the jaw, an upper one stays: the nearest-vertex transfer
    the helper teeth had would have torn a tooth at the bite)."""
    A = _assets()
    lo_v, lo_f, lo_g = [], [], []
    g = None
    for ln in open(MOUTH_LO):
        if ln.startswith("o "):
            g = ln.split()[1]
        elif ln.startswith("v "):
            lo_v.append([float(x) for x in ln.split()[1:4]])
            lo_g.append(g)
        elif ln.startswith("f "):
            lo_f.append([int(x) - 1 for x in ln.split()[1:4]])
    lo_v, lo_f, lo_g = np.array(lo_v), np.array(lo_f), np.array(lo_g)
    import face_morphs as FM
    pos = np.zeros((len(lo_v), 3))
    refs = np.zeros((len(lo_v), 9), np.int64)
    wts = np.zeros((len(lo_v), 9))
    for asset, groups in ((A / "teeth" / "teeth_base" / "teeth_base", ("tooth", "gum")),
                          (A / "tongue" / "tongue01" / "tongue01", ("tongue",))):
        hv, hg = FM.read_obj(str(asset) + ".obj")
        hv = np.array(hv)
        hq = [f for fs in hg.values() for f in fs]
        ht = np.array([(f[0], f[k], f[k + 1]) for f in hq for k in range(1, len(f) - 1)])
        sc, r, w, o = read_mhclo(str(asset) + ".mhclo")
        assert len(r) == len(hv), "%s: %d fits for %d vertices" % (asset.name, len(r), len(hv))
        fitted = _mhclo_fit(sc, r, w, o, M["vs"])
        cen = hv[ht].mean(1)
        # Each piece of the low mesh binds to the piece of the full one it was
        # made from — found by centre — and only to it: an upper incisor
        # stands in front of the lower one, and the nearest triangle to its
        # edge can be the lower tooth's, which would open with the jaw and
        # draw the upper tooth down into a fang.
        hc = _pieces(ht)
        hcen = np.array([hv[np.unique(ht[t])].mean(0) for t in hc])
        sel = np.nonzero(np.isin(lo_g, groups))[0]
        lf = lo_f[np.isin(lo_f[:, 0], sel)]
        piece_of = {}
        for t in _pieces(lf):
            vi = np.unique(lf[t])
            k = int(np.argmin(np.linalg.norm(hcen - lo_v[vi].mean(0), axis=1)))
            for v in vi:
                piece_of[int(v)] = hc[k]
        for i in sel:
            tri_ok = piece_of[int(i)]
            cand = tri_ok[np.argsort(np.linalg.norm(cen[tri_ok] - lo_v[i], axis=1))[:16]]
            bary, dist = _closest_on_tris(lo_v[i], hv[ht[cand, 0]], hv[ht[cand, 1]], hv[ht[cand, 2]])
            k = int(np.argmin(dist))
            t, b = ht[cand[k]], bary[k]
            pos[i] = (b[:, None] * fitted[t]).sum(0)
            refs[i] = r[t].reshape(-1)
            wts[i] = (b[:, None] * w[t]).reshape(-1)
    return dict(pos=pos, tris=lo_f, group=lo_g, refs=refs, wts=wts)


def teeth(sk, M, verbose=False):
    """MakeHuman's helper teeth and tongue out; its teeth, gums and tongue
    in (`mouth_lo.obj`, fitted by `mouth_binding`)."""
    import face_morphs as FM
    body = sk.tris("body")
    mouthf = sk.uv[:, 0] >= 4
    drop_t = mouthf[body].any(1)
    Bd = mouth_binding(M)
    pos = FM.to_blob(Bd["pos"], M["s"], M["drop"])
    # The gum a shade further in (the face looks down +x): MakeHuman fits
    # its front face a millimetre behind the lips, and with the jaw open and
    # the mouth pulled wide the lower lip rolls back over it and it showed
    # through as a pink spot on the chin.
    pos[Bd["group"] == "gum", 0] -= GUM_BACK
    tris = Bd["tris"]
    # Normals off the mesh itself, area-weighted.
    nrm = np.zeros_like(pos)
    fn = np.cross(pos[tris[:, 1]] - pos[tris[:, 0]], pos[tris[:, 2]] - pos[tris[:, 0]])
    for k in range(3):
        np.add.at(nrm, tris[:, k], fn)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
    # Bones: the helper vertex of the same jaw (by the base vertices the new
    # one rides) nearest to it. The blob's helper corners are found by where
    # MakeHuman's helper vertices land in it.
    gv = M["gv"]
    old = np.nonzero(mouthf)[0]
    grp_of_base = {}
    for gname in ("helper-upper-teeth", "helper-lower-teeth", "helper-tongue"):
        for v in gv[gname]:
            grp_of_base[int(v)] = gname
    hel_pos = {g: FM.to_blob(M["vs"][gv[g]], M["s"], M["drop"]) for g in grp_of_base.values()}
    old_grp = np.array([min(hel_pos, key=lambda g: np.linalg.norm(hel_pos[g] - sk.pos[i], axis=1).min())
                        for i in old])
    bi, bw = np.zeros((len(pos), 4), np.uint8), np.zeros((len(pos), 4), np.uint8)
    for i in range(len(pos)):
        votes = defaultdict(float)
        for rf, w in zip(Bd["refs"][i], Bd["wts"][i]):
            if int(rf) in grp_of_base:
                votes[grp_of_base[int(rf)]] += w
        g = max(votes, key=votes.get) if votes else "helper-upper-teeth"
        pool = old[old_grp == g]
        b_i, b_w = _bones_near(sk, pos[i:i + 1], pool)
        bi[i], bw[i] = b_i[0], b_w[0]
    uv = np.stack([np.full(len(pos), MOUTH_U), [MOUTH_V[g] for g in Bd["group"]]], 1)
    if verbose:
        print("  mouth: %d helper tris out, %d in (%s)" % (
            drop_t.sum(), len(tris), ", ".join("%s %d" % (g, (Bd["group"][tris[:, 0]] == g).sum())
                                              for g in MOUTH_V)))
    return dict(drop_t=drop_t, pos=pos, nrm=nrm, uv=uv, bi=bi, bw=bw,
                tris=[[-1 - v for v in t] for t in tris])


def done(sk):
    """Whether this blob has been through `refine` already: its eyeballs are
    the smooth ones, which no bake from Blender ever has — so a conversion
    re-run on the payload changes nothing (the morphs, re-measured on the
    same geometry, come out the same bytes)."""
    eye = (sk.uv[:, 0] >= 2) & (sk.uv[:, 0] < 3)
    return int(eye.sum()) == 2 * (EYE_SEGS * (EYE_RINGS - 1) + 2)


def refine(name, packed: bytes, verbose=False) -> bytes:
    """A bather's packed v9 -> the same with MakeHuman's lids, a smooth
    eyeball and MakeHuman's teeth. Each edit drops some of the body part's
    triangles and adds vertices and triangles of its own (numbered -1 - k in
    its own new vertices); they are merged here, the old vertices nothing
    uses any more are dropped, and the blob is packed as it was."""
    from fr3d_q import unpack_skin, pack_skin
    sk = Skin(unpack_skin(packed))
    if done(sk):
        if verbose:
            print("  lids, eyeballs and teeth already done")
        return packed
    M = fit(sk, name)
    edits = [eyelids(sk, M, verbose), eyeballs(sk, verbose), teeth(sk, M, verbose)]
    body = sk.tris("body")
    drop = np.zeros(len(body), bool)
    for E in edits:
        drop |= E["drop_t"]
    kept = body[~drop]
    used = np.zeros(len(sk.pos), bool)
    used[kept.reshape(-1)] = True
    for p in sk.parts:
        if p[0] != "body":
            used[sk.tris(p[0]).reshape(-1)] = True
    keep_v = np.nonzero(used)[0]
    remap = np.full(len(sk.pos), -1, np.int64)
    remap[keep_v] = np.arange(len(keep_v))
    base = len(keep_v)
    new_v = {k: [] for k in ("pos", "nrm", "uv", "bi", "bw")}
    tris_new = []
    for E in edits:
        for t in E["tris"]:
            tris_new.append([remap[v] if v >= 0 else base + (-1 - v) for v in t])
        base += len(E["pos"])
        for k in new_v:
            new_v[k].append(np.asarray(E[k]))
    new_v = {k: np.concatenate(v) for k, v in new_v.items()}
    tris_new = np.array(tris_new, np.int64)
    if verbose:
        print("  %d vertices -> %d, %d body tris -> %d"
              % (len(sk.pos), len(keep_v) + len(new_v["pos"]), len(body), len(kept) + len(tris_new)))
    parts = {"body": np.concatenate([remap[kept], tris_new])}
    for p in sk.parts:
        if p[0] != "body":
            parts[p[0]] = remap[sk.tris(p[0])]
    sk.rebuild(keep_v, parts, new_v)
    return pack_skin(sk.raw())


# ── the lash line and the socket, for the shader ────────────────────────────
#
# Where the lid margin is, in the skin's UV, so the body shader can draw the
# lash line along it (and darken the inside of the socket, which no light in
# this renderer ever fails to reach). The UV layout is MakeHuman's and the
# same on every body, so this is written once, to build/payload/
# bather2_face.json, as PAYLOAD.bather2_face:
#
#   lash:   per eye, the margin as a closed loop of [u, v, w] in order round
#           the eye — w is 1 on the upper lid (the lashes) and LASH_LOW on the
#           lower;
#   socket: per eye, [u0, v0, u1, v1], the UV box of the fold behind the lids
#           (its own island in MakeHuman's layout, at the far left of the map).
#
# The margin is where the skin turns in: a vertex round the eye whose normal
# faces away from the eyeball's centre, beside one whose normal faces it.
LASH_LOW = 0.4


def _marks_one(name, rig):
    """Per eye, for one body: the margin vertices (by MakeHuman index), the
    blink's travel at each vertex, and the socket's vertices."""
    import face_morphs as FM
    vs, groups, vts, corners = FM.read_obj(FM.bodies_dir() / ("mh_%s.obj" % name), uvs=True)
    tris = np.array([(f[0], f[k], f[k + 1]) for f in groups["body"] for k in range(1, len(f) - 1)])
    n = FM.vertex_normals(vs, [list(t) for t in tris])
    uvs_of = defaultdict(set)
    for f in corners["body"]:
        for vi, ti in f:
            uvs_of[vi].add(ti)
    nb = defaultdict(set)
    for t in tris:
        for a in t:
            nb[int(a)].update(int(x) for x in t)
    out = []
    for helper, unit in (("helper-l-eye", "LeftUpperLidClosed"), ("helper-r-eye", "RightUpperLidClosed")):
        ev = vs[np.array(sorted({v for f in groups[helper] for v in f}))]
        c = ev.mean(0)
        r = np.linalg.norm(ev - c, axis=1).mean()
        q = vs - c
        d = np.linalg.norm(q, axis=1)
        sgn = (n * q / np.maximum(d[:, None], 1e-12)).sum(1)
        D = np.linalg.norm(rig.deform(vs, {unit: 1.0}) - vs, axis=1)
        near = [v for v in sorted(uvs_of) if d[v] < EYE_K * r and q[v, 2] > EYE_BACK * r]
        ns = set(near)
        marg = {v for v in near if sgn[v] > 0 and any(sgn[u] <= 0 for u in nb[v] if u in ns)}
        inner = {v for v in near if sgn[v] <= 0}
        out.append((marg, D, inner))
    return out, vts, uvs_of


# Off ONE body, because the test is a sign change and on a rounder lid it
# also catches the next vertex in; man_young_fit's is a clean single ring of
# thirty a side, and the ring is the same MakeHuman edge loop on every body.
LASH_REF = "man_young_fit"


def face_marks(names=(LASH_REF,)):
    """The lash loops and socket boxes, off the bodies named (the vertices
    all of them agree are margin)."""
    import face_morphs as FM
    rig = FM.FaceRig()
    per = [_marks_one(n, rig) for n in names]
    _o, vts, uvs_of = per[0]
    out = {"lash": [], "socket": []}
    for side in range(2):
        marg = set.intersection(*[p[0][side][0] for p in per])
        inner = set.intersection(*[p[0][side][2] for p in per])
        D = np.mean([p[0][side][1] for p in per], 0)
        Dm = max(D[v] for v in marg)
        pts = []
        for v in sorted(marg):
            for t in sorted(uvs_of[v]):
                if vts[t][0] > 0.5:         # the face's island, not the socket's
                    pts.append((vts[t][0], vts[t][1], 1.0 if D[v] > 0.3 * Dm else LASH_LOW))
        pts = np.array(pts)
        cen = pts[:, :2].mean(0)
        pts = pts[np.argsort(np.arctan2(pts[:, 1] - cen[1], pts[:, 0] - cen[0]))]
        out["lash"].append([[round(float(a), 5) for a in p] for p in pts])
        U = vts[np.array([t for v in sorted(inner) for t in sorted(uvs_of[v]) if vts[t][0] < 0.5])]
        out["socket"].append([round(float(x), 4) for x in (*U.min(0), *U.max(0))])
    return out


def write_marks(marks, path):
    Path(path).write_text(json.dumps(marks, separators=(",", ":")) + "\n")
