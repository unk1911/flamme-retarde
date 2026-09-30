#!/usr/bin/env python3
"""
Facial expressions for the Jadrija bathers, as morph targets on the head.

    python3 tools/face_morphs.py                 # every bather2_*.fr3d.gz, v9 -> v12
    python3 tools/face_morphs.py --check         # measure, write nothing
    python3 tools/face_morphs.py boy_child ...   # just these

Misha, 30 Sep 2026, after a promo for a paid Blender add-on whose people
smile and squint: could ours be "even more human"? The eight bathers had no
face at all past their paint. They did not blink, they did not open their
mouths to talk, and a woman hosed off a cafe chair took it with the same
expression she had reading her phone.

── where the expressions come from ─────────────────────────────────────────────

Not typed, and not invented. MakeHuman's `default` skeleton carries a FACE
RIG: 163 bones, of which about sixty are in the face (`orbicularis03.L` is an
upper lid, `oris01` a lower lip, `levator05.L` the cheek over the nasolabial
fold), weighted over the base mesh by `default_weights.mhw`. And
`face-poseunits.bvh` is sixty frames on that rig, one per FACS-like unit,
named in `face-poseunits.json`: LeftUpperLidClosed, JawDrop,
MouthLeftPullUp, NoseWrinkler, LipsKiss... Every one of MakeHuman's own
expressions is a weighted sum of those units. All four files are CC0 (the
json says so, and LICENSE.ASSETS.md at the root of the makehuman repository
covers the rest), fetched on first run into build/mh_face/ the way
mh_morph.py fetches its targets.

The bathers do not carry that rig — their skeleton is this project's 30
bones, one of them a jaw — and do not need to. A face unit is a DISPLACEMENT
of the rest mesh, and a displacement can be baked: pose the face rig on the
body the bather was made from (build/mh_bodies/mh_<name>.obj, the very file
bathers_v2.py read), skin it with MakeHuman's own weights, and subtract the
rest. What is left is a handful of millimetres on a thousand vertices of the
head, per target, and the game blends those in the vertex shader in front of
its own skinning — so a blink rides every clip the body has, lying down,
sitting, or head-first off the board.

── the nine targets ────────────────────────────────────────────────────────────

`TARGETS` below. Eyes shut left and right (separate, so a blink can be a few
milliseconds uneven, which is what a real one is), the jaw, a smile, a scowl,
a squint, the mouth pulled wide, the lips pushed forward, and the brows up.
Everything the game asks for is a mix of those (`FACE2` in
src/42-bathers2.js): a grimace under the hose is shut + scowl + the cheeks
of a smile + wide + some jaw; speech is jaw with wide and kiss alternating;
laughing is smile + jaw + squint.

The page ADDS displacements where MakeHuman composes rotations, and for one
pair that is not close enough: BrowDown and the brows carry the upper lid
with them, and summed with a shut lid the lid goes behind the eyeball, which
shows through as a hole (the old man, eyes screwed shut and scowling). So
`scowl` and `brows` are baked OFF THE LIDS — they give way wherever a blink
moves a vertex (`LID_YIELD`). The squint, which is the lower lid, gives way
at runtime instead, as the upper one comes down.

── on to the decimated body ────────────────────────────────────────────────────

The bather's body shell went through Blender's collapse decimator, so its
vertices are not the base mesh's. The decimator carried the base mesh's UVs
through the collapse, though, so each shell vertex is found INSIDE a base
triangle in UV space (among those within 25 mm in 3D) and takes the
barycentric mix of that triangle's three displacements. UV space keeps apart
what 3D does not: at rest the upper lip's underside and the lower lip's top
are a millimetre from each other, and so are the inside and the outside of a
lip. 12 to 22 of each body's ~1 450 head vertices land outside every
triangle and take the least-outside one. Eyeballs, teeth and tongue are
copied undecimated, so they take their helper's nearest vertex outright.

The transform from MakeHuman's decimetres to the blob's metres is measured,
not assumed, off the eyeballs, which both sides carry vertex for vertex.

── the format: v12 ─────────────────────────────────────────────────────────────

v12 is v9 with a MORPH BLOCK inserted after the index runs, before the part
table — so the clips stay the last section of the file, which is what lets
dive.py's clips be spliced on to the end of a shipped blob (see the 1.530.1
commit). Nothing before or after the block changes by a byte:

    u32 nt, u32 nm            targets, and the vertices any of them move
    nt x (u16 len, name)
    nm zigzag u32 deltas      the moved vertex indices, ascending, 4 byte runs
    per target, per axis:     nm int16 as zigzag deltas, low bytes then high,
                              in units of 2^-16 m (0.015 mm; +-0.5 m)

`add_morphs` in fr3d_q.py splices a block into a v9; `save_skin(...,
morph=)` writes through it, so a rebake from bathers_v2.py lands on the
bytes this file converted. The page reads it in `readFR3DSkin`
(src/41-skin.js) and puts it on a float texture in `skinMorphs`.
"""

from __future__ import annotations

import gzip
import json
import struct
import sys
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from fr3d_q import (_runs, _unruns, _signed, gz, unpack_skin, add_morphs,  # noqa: E402
                    strip_morphs, index_end, MORPH_STEP)

PAYLOAD = ROOT / "build" / "payload"
FACE = ROOT / "build" / "mh_face"
RAW = ("https://raw.gi" "thubusercontent.com/makehumancommunity/makehuman/"
       "master/makehuman/data/")
FILES = ["rigs/default.mhskel", "rigs/default_weights.mhw",
         "poseunits/face-poseunits.bvh", "poseunits/face-poseunits.json"]


def bodies_dir():
    """build/mh_bodies, or main's: a worktree carries only what git tracks,
    and the bodies are a gitignored product of mh_morph.py."""
    for r in (ROOT, ROOT.parents[2] if ROOT.parent.name == "worktrees" else None):
        if r and (r / "build" / "mh_bodies").is_dir():
            return r / "build" / "mh_bodies"
    sys.exit("[face] no build/mh_bodies — run tools/blender/mh_morph.py first")


# Units in `face-poseunits.json` terms, and how much of each. Symmetric pairs
# are both named: the rig's two sides are separate bones.
TARGETS = [
    ("shutL",  {"LeftUpperLidClosed": 1.0, "LeftLowerLidUp": 0.25}),
    ("shutR",  {"RightUpperLidClosed": 1.0, "RightLowerLidUp": 0.25}),
    ("jaw",    {"JawDrop": 1.0}),
    ("smile",  {"MouthLeftPullUp": 1.0, "MouthRightPullUp": 1.0,
                "LeftCheekUp": 0.6, "RightCheekUp": 0.6}),
    ("scowl",  {"LeftBrowDown": 1.0, "RightBrowDown": 1.0, "NoseWrinkler": 0.6,
                "MouthLeftPullDown": 0.5, "MouthRightPullDown": 0.5}),
    ("squint", {"LeftLowerLidUp": 1.0, "RightLowerLidUp": 1.0,
                "LeftCheekUp": 0.5, "RightCheekUp": 0.5}),
    ("wide",   {"MouthLeftPullSide": 1.0, "MouthRightPullSide": 1.0,
                "UpperLipUp": 0.5}),
    ("kiss",   {"LipsKiss": 1.0}),
    ("brows",  {"LeftInnerBrowUp": 1.0, "RightInnerBrowUp": 1.0,
                "LeftOuterBrowUp": 0.7, "RightOuterBrowUp": 0.7}),
]
# A vertex a blink moves this far (m) belongs to the lid, and these targets
# leave it alone — see the note in `morphs_for`.
LID_OWN = 0.002
LID_YIELD = ("scowl", "brows")
STEP = MORPH_STEP             # metres per stored unit (2^-16)
FLOOR = 0.00005               # a displacement under 0.05 mm is stored as zero


def fetch():
    FACE.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        p = FACE / f.split("/")[-1]
        if not p.exists():
            print("[face] fetching", f)
            p.write_bytes(urllib.request.urlopen(RAW + f, timeout=120).read())


def read_obj(path, uvs=False):
    """Positions and faces by group; with `uvs`, also the UVs and, per group,
    each face's (vertex, uv) corners."""
    vs, vts, groups, corners, cur = [], [], {}, {}, None
    for line in open(path):
        if line.startswith("v "):
            vs.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            vts.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("g "):
            cur = line.split()[1]
        elif line.startswith("f "):
            toks = [t.split("/") for t in line.split()[1:]]
            groups.setdefault(cur, []).append([int(t[0]) - 1 for t in toks])
            if uvs:
                corners.setdefault(cur, []).append(
                    [(int(t[0]) - 1, int(t[1]) - 1 if len(t) > 1 and t[1] else -1) for t in toks])
    if uvs:
        return np.array(vs, np.float64), groups, np.array(vts, np.float64), corners
    return np.array(vs, np.float64), groups


def vertex_normals(vs, faces):
    n = np.zeros_like(vs)
    for f in faces:
        for k in range(1, len(f) - 1):
            a, b, c = vs[f[0]], vs[f[k]], vs[f[k + 1]]
            fn = np.cross(b - a, c - a)
            for i in (f[0], f[k], f[k + 1]):
                n[i] += fn
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return n / ln


def read_bvh(path):
    """names, parents, channel slices and the frames (degrees)."""
    names, parents, chans, stack = [], [], [], []
    lines = open(path).read().split("\n")
    i, nch = 0, 0
    while not lines[i].strip().startswith("MOTION"):
        t = lines[i].split()
        if t and t[0] in ("ROOT", "JOINT"):
            names.append(t[1])
            parents.append(stack[-1] if stack else -1)
        elif t and t[0] == "End":
            names.append(None)
            parents.append(stack[-1])
            chans.append(None)
        elif t and t[0] == "{":
            stack.append(len(names) - 1)
        elif t and t[0] == "}":
            stack.pop()
        elif t and t[0] == "CHANNELS":
            n = int(t[1])
            chans.append((nch, t[2:2 + n]))
            nch += n
        i += 1
    nf = int(lines[i + 1].split()[1])
    frames = np.array([[float(x) for x in lines[i + 3 + f].split()] for f in range(nf)])
    assert frames.shape[1] == nch
    return names, parents, chans, frames


def rot(axis, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    if axis == "X":
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == "Y":
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def log_so3(R):
    c = np.clip((np.trace(R) - 1) / 2, -1, 1)
    a = np.arccos(c)
    if a < 1e-9:
        return np.zeros(3)
    v = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]])
    return v * (a / (2 * np.sin(a)))


def exp_so3(w):
    a = np.linalg.norm(w)
    if a < 1e-12:
        return np.eye(3)
    k = w / a
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K


class FaceRig:
    def __init__(self):
        fetch()
        self.skel = json.load(open(FACE / "default.mhskel"))
        self.units = json.load(open(FACE / "face-poseunits.json"))["framemapping"]
        self.names, self.parents, self.chans, self.frames = read_bvh(FACE / "face-poseunits.bvh")
        w = json.load(open(FACE / "default_weights.mhw"))["weights"]
        self.weights = {b: (np.array([v for v, _ in l], np.int64), np.array([x for _, x in l]))
                        for b, l in w.items()}

    def local(self, frame):
        """{joint index: 3x3} for one BVH frame; identity rotations left out."""
        out = {}
        for j, name in enumerate(self.names):
            if name is None or self.chans[j] is None:
                continue
            o, ch = self.chans[j]
            R, ok = np.eye(3), False
            for k, c in enumerate(ch):
                if c.endswith("rotation"):
                    v = self.frames[frame, o + k]
                    if abs(v) > 1e-4:
                        ok = True
                    R = R @ rot(c[0], v)
            if ok:
                out[j] = R
        return out

    def pose(self, mix):
        """A weighted mix of units -> {joint: local 3x3}. Each unit scaled on
        the rotation's own axis (exp(w log R)), units on the same joint
        composed in the order given."""
        out = {}
        for unit, wgt in mix.items():
            for j, R in self.local(self.units.index(unit)).items():
                S = exp_so3(wgt * log_so3(R))
                out[j] = out[j] @ S if j in out else S
        return out

    def deform(self, vs, mix):
        """Rest positions (MakeHuman space, this body) -> posed. BVH rotations
        are in world-aligned joint frames (a BVH has no rest orientation), so
        each joint's global rotation is its parents' composed with its own,
        and its skinning transform is  v -> p_j + G_j (v - r_j)."""
        loc = self.pose(mix)
        bones = self.skel["bones"]
        joints = self.skel["joints"]
        rest = {}
        for j, name in enumerate(self.names):
            if name is not None and name in bones:
                rest[j] = vs[joints[bones[name]["head"]]].mean(0)
        G, P = {}, {}
        for j, name in enumerate(self.names):
            if name is None or j not in rest:
                continue
            p = self.parents[j]
            R = loc.get(j, np.eye(3))
            if p < 0 or p not in G:
                G[j], P[j] = R, rest[j]
            else:
                G[j] = G[p] @ R
                P[j] = P[p] + G[p] @ (rest[j] - rest[p])
        out = np.zeros_like(vs)
        tot = np.zeros(len(vs))
        for j, name in enumerate(self.names):
            if name not in self.weights or j not in G:
                continue
            vi, w = self.weights[name]
            moved = P[j] + (vs[vi] - rest[j]) @ G[j].T
            np.add.at(out, vi, w[:, None] * moved)
            np.add.at(tot, vi, w)
        has = tot > 0
        res = vs.copy()
        res[has] = out[has] / tot[has, None]
        return res


def blob_arrays(raw):
    """A v5 blob's positions, normals, UVs and index."""
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert ver == 5, ver
    o = 44
    pos = np.frombuffer(raw, "<f4", nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    nrm = np.frombuffer(raw, "<f4", nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    uv = np.frombuffer(raw, "<f4", nv * 2, o).reshape(-1, 2).astype(np.float64); o += nv * 8
    o += nv * 8
    o = (o + 3) & ~3
    idx = np.frombuffer(raw, "<u4", ni, o)
    return pos, nrm, uv, idx


def index_body(raw):
    """(start, count) of the `body` part in a v5 blob's index."""
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    o = (44 + nv * 12 * 2 + nv * 8 + nv * 8 + 3) & ~3
    o += ni * 4
    n, = struct.unpack_from("<I", raw, o); o += 4
    for _ in range(n):
        ln, = struct.unpack_from("<H", raw, o)
        nm = raw[o + 2:o + 2 + ln].decode(); o += 2 + ln
        _mat, st, cnt = struct.unpack_from("<III", raw, o); o += 12
        if nm == "body":
            return st, cnt
    raise ValueError("no body part")


def to_blob(v, s, drop):
    """MakeHuman (x, y, z) -> blob metres: game_space in baye2.py, then Buf's
    Z-up to Y-up. (s z, s y + drop, -s x)."""
    v = np.asarray(v)
    return np.stack([v[..., 2] * s, v[..., 1] * s + drop, -v[..., 0] * s], -1)


def dir_to_blob(d, s):
    d = np.asarray(d)
    return np.stack([d[..., 2] * s, d[..., 1] * s, -d[..., 0] * s], -1)


def _near(pts, q, k=1):
    """The k nearest of `pts` to each row of `q`: (dist, index), brute force.
    Numpy and nothing else, because this also runs inside Blender (a rebake
    through bathers_v2.py), whose Python has numpy and not scipy."""
    q = np.atleast_2d(q)
    d = np.sqrt(((q[:, None, :] - pts[None, :, :]) ** 2).sum(-1))
    i = np.argsort(d, axis=1)[:, :k]
    return np.take_along_axis(d, i, 1), i


def morphs_for(name, packed, rig, verbose=False):
    """(names, vertex indices, int16 deltas (nt, 3, nm)) for one bather, off
    its PACKED blob — the positions the page will decode, so a rebake and a
    conversion see the same numbers."""
    raw = unpack_skin(packed)
    pos, nrm, uv, idx = blob_arrays(raw)
    vs, groups, vts, corners = read_obj(bodies_dir() / ("mh_%s.obj" % name), uvs=True)
    gv = {g: np.array(sorted({v for f in fs for v in f})) for g, fs in groups.items()}

    # The transform, off the eyeballs: undecimated on both sides.
    eye = (uv[:, 0] >= 2) & (uv[:, 0] < 3)
    mouth = uv[:, 0] >= 4
    hel = np.concatenate([gv["helper-l-eye"], gv["helper-r-eye"]])
    mh = vs[hel]
    s = np.ptp(pos[eye][:, 2]) / np.ptp(mh[:, 0])
    drop = pos[eye][:, 1].mean() - mh[:, 1].mean() * s
    fit = to_blob(mh, s, drop)
    err = _near(fit, pos[eye])[0]
    assert err.max() < 0.0005, "eyeballs do not line up: %.4f m" % err.max()
    teeth_i = np.concatenate([gv["helper-upper-teeth"], gv["helper-lower-teeth"],
                              gv["helper-tongue"]])
    teeth_b = to_blob(vs[teeth_i], s, drop)

    # The body's triangles near the head, with their UVs: each shell vertex is
    # found INSIDE one of them in UV space, and takes the barycentric mix of
    # its three corners' displacements. Not the nearest vertex in 3D — that
    # was the first cut, and on a closed mouth the nearest vertex to a point
    # on the inside of the lower lip can be on the upper lip or out on the
    # cheek, which drove bits of the inner lip out through the corners of a
    # child's mouth on `wide`. The collapse decimator interpolated these UVs
    # along with the positions (bathers_v2.py), and the base's UV layout
    # keeps upper lip, lower lip, inside and outside apart where 3D does not.
    ey = pos[eye][:, 1].mean()
    tri_v, tri_t = [], []
    for f in corners["body"]:
        for k in range(1, len(f) - 1):
            c = (f[0], f[k], f[k + 1])
            tri_v.append([x[0] for x in c])
            tri_t.append([x[1] for x in c])
    tri_v, tri_t = np.array(tri_v), np.array(tri_t)
    cen = to_blob(vs[tri_v].mean(1), s, drop)
    keep = cen[:, 1] > ey - 0.20
    tri_v, tri_t, cen = tri_v[keep], tri_t[keep], cen[keep]
    T0, T1, T2 = vts[tri_t[:, 0]], vts[tri_t[:, 1]], vts[tri_t[:, 2]]
    e1, e2 = T1 - T0, T2 - T0
    den = e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]
    den[den == 0] = 1e-12

    nv = len(pos)
    W = np.zeros((nv, 3))                    # barycentric weights
    V = np.full((nv, 3), -1, np.int64)       # the three base vertices
    # The body part's own vertices: the hair and swimwear share the vertex
    # array and have UVs in an atlas of their own.
    ob = index_body(raw)
    inbody = np.zeros(nv, bool)
    inbody[idx[ob[0]:ob[0] + ob[1]]] = True
    head = np.nonzero((pos[:, 1] >= ey - 0.16) & inbody)[0]
    miss = 0
    for i in head:
        if eye[i]:
            V[i, 0] = hel[_near(fit, pos[i])[1][0, 0]]; W[i, 0] = 1
            continue
        if mouth[i]:
            V[i, 0] = teeth_i[_near(teeth_b, pos[i])[1][0, 0]]; W[i, 0] = 1
            continue
        # The blob's UVs are the OBJ's `vt`s as they were (`mesh_from` in
        # bathers_v2.py), no flip.
        near = np.nonzero(np.linalg.norm(cen - pos[i], axis=1) < 0.025)[0]
        if not len(near):
            miss += 1
            continue
        u = uv[i]
        d = u - T0[near]
        b1 = (d[:, 0] * e2[near, 1] - d[:, 1] * e2[near, 0]) / den[near]
        b2 = (e1[near, 0] * d[:, 1] - e1[near, 1] * d[:, 0]) / den[near]
        b0 = 1 - b1 - b2
        out = np.maximum(0, -np.stack([b0, b1, b2], 1)).sum(1)
        # The triangle it is in, or failing that the least outside of it; ties
        # (a UV island folded on another) broken by 3D distance.
        score = out * 50 + np.linalg.norm(cen[near] - pos[i], axis=1)
        k = np.argmin(score)
        w = np.clip(np.array([b0[k], b1[k], b2[k]]), 0, None)
        W[i] = w / max(w.sum(), 1e-9)
        V[i] = tri_v[near[k]]
        if out[k] > 0.02:
            miss += 1
    if verbose:
        print("  %d head vertices, %d not inside a UV triangle" % (len(head), miss))

    names, deltas = [], []
    for tname, mix in TARGETS:
        posed = rig.deform(vs, mix)
        dmh = posed - vs
        d = np.zeros((nv, 3))
        m = V[:, 0] >= 0
        mix3 = (W[m, :, None] * dmh[np.maximum(V[m], 0)]).sum(1)
        d[m] = dir_to_blob(mix3, s)
        names.append(tname)
        deltas.append(d)
    # OFF THE LIDS for everything that is not a blink. MakeHuman composes its
    # units as rotations; the page ADDS displacements. For most pairs that is
    # the same thing to within a millimetre, but not for a lid: BrowDown and
    # the brows both carry the upper lid with them, and summed with a shut
    # lid that is twice down and back — behind the eyeball, which then shows
    # through as a hole (the old man, eyes screwed shut and scowling). So
    # wherever a blink moves a vertex, the brow targets give way to it, in
    # proportion: a lid margin is the blink's alone, the brow above it is the
    # brow's.
    shut = np.maximum(np.linalg.norm(deltas[names.index("shutL")], axis=1),
                      np.linalg.norm(deltas[names.index("shutR")], axis=1))
    lid = np.clip(shut / LID_OWN, 0, 1)
    for k in LID_YIELD:
        deltas[names.index(k)] *= (1 - lid)[:, None]
    for d in deltas:
        d[np.linalg.norm(d, axis=1) < FLOOR] = 0
    for tname, d in zip(names, deltas):
        if verbose:
            mag = np.linalg.norm(d, axis=1)
            print("  %-7s max %5.1f mm  moved %4d" % (tname, mag.max() * 1000, (mag > 0).sum()))
    moved = np.nonzero(np.any([np.any(d != 0, 1) for d in deltas], 0))[0]
    q = np.stack([np.round(d[moved] / STEP).astype(np.int64).T for d in deltas])   # (nt, 3, nm)
    assert np.abs(q).max() < 32768
    return names, moved, q


def morph_block(names, moved, q) -> bytes:
    out = [struct.pack("<II", len(names), len(moved))]
    for n in names:
        b = n.encode()
        out.append(struct.pack("<H", len(b)) + b)
    out.append(_runs(moved, 32))
    for t in range(len(names)):
        for k in range(3):
            out.append(_runs(q[t, k], 16))
    return b"".join(out)


def read_morphs(packed: bytes):
    """v12 -> (names, moved, deltas in metres (nt, nm, 3)), as the page reads them."""
    o = index_end(packed)
    nt, nm = struct.unpack_from("<II", packed, o)
    o += 8
    names = []
    for _ in range(nt):
        ln, = struct.unpack_from("<H", packed, o)
        names.append(packed[o + 2:o + 2 + ln].decode())
        o += 2 + ln
    moved, o = _unruns(packed, o, nm, 32)
    d = np.zeros((nt, nm, 3))
    for t in range(nt):
        for k in range(3):
            v, o = _unruns(packed, o, nm, 16)
            d[t, :, k] = _signed(v, 16) * STEP
    return names, moved, d


def with_morphs(name, packed: bytes, rig=None, verbose=False) -> bytes:
    """What `save_skin` calls for a bather: its packed v9 -> v12."""
    rig = rig or FaceRig()
    return add_morphs(packed, morph_block(*morphs_for(name, packed, rig, verbose)))


def main(argv):
    check = "--check" in argv
    only = [a for a in argv if not a.startswith("--")]
    rig = FaceRig()
    for p in sorted(PAYLOAD.glob("bather2_*.fr3d.gz")):
        name = p.name[len("bather2_"):-len(".fr3d.gz")]
        if only and name not in only:
            continue
        packed = strip_morphs(gzip.decompress(p.read_bytes()))
        print("[face]", name)
        new = gz(with_morphs(name, packed, rig, verbose=True))
        print("  %d KB -> %d KB gz (+%.1f KB)" % (p.stat().st_size / 1024, len(new) / 1024,
                                                (len(new) - p.stat().st_size) / 1024))
        if not check:
            p.write_bytes(new)


if __name__ == "__main__":
    main(sys.argv[1:])
