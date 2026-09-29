#!/usr/bin/env python3
"""The far tier of the Jadrija crowd, cut out of the near tier's own bodies.

    blender -b -noaudio -P tools/blender/crowd_far.py
    blender -b -noaudio -P tools/blender/crowd_far.py -- --only girl_child

Reads build/payload/bather2_<name>.fr3d.gz (the v2 bathers, as shipped), their
textures and bathers2.json; writes build/payload/crowd_<name>.fr3d.gz, one
.fr3d v6 blob per body.

── why this exists ──────────────────────────────────────────────────────────

Misha, 27 Sep 2026: *"lookin from very far away ... in the distance, one of
the bathers still appears as our 'prehistoric' wooden manequins. but as i
approached her closer, she transformed into modern v2.0 bather ... can we just
get rid of those prehistoric manequins completely"*.

The crowd has two tiers. The near one is the v2 bathers — skinned, textured,
twenty-four of them roving to whoever is nearest (src/42-crowd.js,
`makeSkinCrowd`). Everybody else was drawn by the instanced tier, and until
this file its bodies were tools/blender/bather.py's: eleven lofted tubes per
person, built in August as a stand-in for people nobody had modelled yet. They
were the mannequins. Everybody on the beach has since been modelled — eight
bodies, and the near tier draws them — so the far tier now draws the SAME
eight, and there is no second kind of person left on the shore.

── what is kept from the instanced tier, and what is not ────────────────────

Kept: everything about MOVING. The instanced tier poses a scratch skeleton of
eleven joints per person in JavaScript — walk, stand, sit on the quay, lie on
a towel, wade, serve — and none of that changes. Those eleven joints are now
placed at THIS body's own hip, knee, waist, shoulder, elbow and neck (read off
its MakeHuman skeleton), and the mesh is bound to them.

Not kept: rigid parts. The old rig hung one lump of geometry off each joint,
and at a joint that bends the lumps shear past each other — hidden, there, by
a ball at every elbow and knee. A real body cut into eleven rigid pieces has
no balls to hide behind. So the mesh is SKINNED to the eleven joints instead:
each vertex keeps the (up to four) MakeHuman bones it was already weighted to,
those bones are folded into the eleven joints they belong to, and the two that
carry most of it are kept. That is ordinary linear-blend skinning on an
eleven-bone palette, done per instance on the GPU off a texture the crowd
writes each frame (see `GLSL_CROWD` in src/30-material.js) — and it costs the
same eleven matrices per person the rigid parts did, in ONE draw per body
where the rigid parts were eleven.

── the bind pose ────────────────────────────────────────────────────────────

The v2 blobs are bound in MakeHuman's A-pose, arms forty-odd degrees out. The
instanced tier's rest is arms DOWN — every angle in `pose()` is measured from
a figure standing at attention — so the arms are brought down here, with the
blob's own weights: the upper arm about the shoulder, then the forearm about
the elbow into line with it. How far down is measured per body, not chosen:
the smallest angle off vertical at which the hand and forearm clear the hips
and thighs (and the shorts on them) by `CLEAR`. A heavy man's arms rest
further out than a slim girl's, which is also true of the people.

── what it is painted with ──────────────────────────────────────────────────

Not the photograph: a far figure is flat-shaded per vertex, and each vertex
says which of the instance's colours it wants — skin, swimwear or hair, which
are `fg.skin`, `fg.suit` and `fg.hair`, the same three the near tier dyes its
textures with (see `bather2Pick` in 42-bathers2.js). So a person is the same
colour at two hundred metres as at two.

The textures still earn their keep, as SHADING. A skin vertex carries the
ratio of the texel under it to that skin's mean tone, averaged over the pool
of skins that body can be dealt — lips, brows and nipples are darker than the
torso on every skin in every pool. A hair or swimwear vertex carries the
luminance shading the near tier's dye uses, `0.30 + 0.70 * l / lum`, so a
pattern on a bikini is still a pattern. And the hair cards and swimwear, which
the near tier cuts with an alpha test, are cut here by COVERAGE: a triangle is
kept if enough of the texture under it is opaque, because there is no texture
at this distance to cut it with. The scalp under a hairstyle is painted hair
colour, so what the thinning leaves shows hair behind it and not a bald head.

── the blob, .fr3d v6 ───────────────────────────────────────────────────────

    '<4sIIIfI'  magic, 6, nv, ni, height, nparts
    per part:   u16 len, name, i32 parent, 3 f32 pivot (from parent's)
    u16 len, JSON meta               (stature, sitHip, capHair, tris, ...)
    f32 pos[nv*3]  i8 nrm[nv*3]  u8 tint[nv*4]  u8 bone[nv*4]  u16 idx[ni]

`tint` is the shading (rgb, halved so 2.0 fits in a byte) and, for skin, how
much of it is painted over (a: 0-127 swimwear, 128-255 hair — see `under`;
only hair uses it today). `bone` is the two joints, the first one's
weight, and what the vertex is: 0 skin, 1 swimwear, 2 hair, 3 literal.
Positions are in the game's own frame, forward +X, up +Y, left −Z, and
already SCALED to the instanced tier's canonical stature — see `H0`.
"""

import gzip
import io
import json
import math
import struct
import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
import numpy as np
from mathutils import Vector  # type: ignore
from mathutils.bvhtree import BVHTree  # type: ignore
from mathutils.kdtree import KDTree  # type: ignore

ROOT = Path(__file__).resolve().parents[2]
PAY = ROOT / 'build' / 'payload'
sys.path.insert(0, str(ROOT / 'tools'))
from fr3d_q import pack_crowd, unpack_skin  # noqa: E402

# The eight, in the runtime's casting order — `BATHER_CAST` in 42-crowd.js.
CAST = ['woman_young_slim', 'man_old_heavy', 'girl_child', 'man_young_fit',
        'woman_young_full', 'boy_child', 'woman_old', 'man_young_lean']

# The instanced tier's canonical stature, and every body here is scaled to it.
#
# NOT because the bodies are all the same height — they are 1.25 m to 1.85 m —
# but because the crowd already has an answer to how tall each PERSON is, and
# it is `fg.scale` times this. The near tier is scaled to match that
# (`fg.hscale` in 43-jadrija.js, which divides by the blob's own height), so a
# far body normalised to the same number and scaled by the same `fg.scale` is
# exactly as tall as its near self. 1.696 is the old rig's measured top vertex
# (`rigHeight` on bather_m / bather_f), kept so that nobody on the beach
# changes height either.
H0 = 1.696

# The eleven joints, parents first — the instanced tier's contract. `pose()` in
# 42-crowd.js looks these up by name.
PARTS = [('pelvis', -1), ('torso', 0), ('head', 1),
         ('armLU', 1), ('armLL', 3), ('armRU', 1), ('armRL', 5),
         ('legLU', 0), ('legLL', 7), ('legRU', 0), ('legRL', 9)]
PIX = {n: i for i, (n, _p) in enumerate(PARTS)}

# Which of the eleven each MakeHuman bone folds into. The spine above the
# pelvis bends at the waist joint (`torso`, pivoted at spine01's head) and the
# collarbones go with the chest, because the rig has no shoulder girdle and a
# clavicle that stayed with the arm would drag the chest out sideways every
# time an arm swung.
FOLD = {
    'pelvis': 'pelvis',
    'spine01': 'torso', 'spine02': 'torso', 'spine03': 'torso', 'chest': 'torso',
    'clavicleL': 'torso', 'clavicleR': 'torso',
    'neck': 'head', 'head': 'head', 'jaw': 'head', 'eyeL': 'head', 'eyeR': 'head',
    'armUL': 'armLU', 'armLL': 'armLL', 'handL': 'armLL', 'thumbL': 'armLL',
    'fingersL': 'armLL',
    'armUR': 'armRU', 'armLR': 'armRL', 'handR': 'armRL', 'thumbR': 'armRL',
    'fingersR': 'armRL',
    'legUL': 'legLU', 'legLL': 'legLL', 'footL': 'legLL', 'toeL': 'legLL',
    'legUR': 'legRU', 'legLR': 'legRL', 'footR': 'legRL', 'toeR': 'legRL',
}

# Triangles per piece. The old rig was 3 036 (man) and 3 232 (woman); this is
# the same budget spent on a body instead of on tubes.
BUDGET = {'skin': 1900, 'eyes': 48, 'hair': 520, 'suit': 300}
# How much of a hair or swimwear triangle has to be opaque to be kept.
COVER = {'hair': 0.50, 'suit': 0.50}
# A thumb on the collapse's scale for the head. An even share leaves a face of
# ~370 triangles, which through a long lens is a squint and a pout next to the
# same woman up close; this puts ~460 there and takes them off the torso,
# which is a smooth surface and does not miss them.
#
# Blender's collapse reads a vertex-group weight of 0 as LOCKED and anything
# over the factor as free, with almost nothing in between: head weights of
# 0 or 0.3 at any factor put 1 300+ of the 1 750 on the head and left a body
# of sticks. 0.9 at 0.05 is the gentle end of that, measured — 0.9 at 0.1 is
# 576, 0.97 at 0.5 is 654.
FACE, HEADW = 0.05, 0.9
# How much darker hair is drawn than its dye shading says. The near tier draws
# hair cards double-sided WITHOUT turning the back faces' normals round, so
# half of every head of hair is lit from behind; this tier turns them (as the
# old one did) and came out a shade lighter than the same person up close.
HAIR_DIM = 0.72
# How far the hands must hang clear of the hips and thighs at rest, metres at
# the body's own size.
CLEAR = 0.022
# A far figure's eye, flat: sclera, iris and the lid's shadow over both,
# averaged — which reads darker than the white of an eye, as eyes do.
EYE = (0.30, 0.26, 0.23)

KIND = {'skin': 0, 'suit': 1, 'hair': 2, 'literal': 3}


# ── reading the v2 blob ─────────────────────────────────────────────────────

def read_v5(path):
    """build/payload/bather2_*.fr3d.gz — see `write_blob` in baye2.py."""
    # Shipped PACKED (v9) since 1.550.5; `unpack_skin` hands back the v5
    # layout below, with the values the game decodes.
    b = unpack_skin(gzip.open(path).read())
    _m, ver, nv, ni = struct.unpack_from('<4sIII', b, 0)
    if ver != 5:
        sys.exit('[crowd_far] %s is v%d, want v5' % (path.name, ver))
    o = 44
    pos = np.frombuffer(b, '<f4', nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    nrm = np.frombuffer(b, '<f4', nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    uv = np.frombuffer(b, '<f4', nv * 2, o).reshape(-1, 2).astype(np.float64); o += nv * 8
    bi = np.frombuffer(b, 'u1', nv * 4, o).reshape(-1, 4); o += nv * 4
    bw = np.frombuffer(b, 'u1', nv * 4, o).reshape(-1, 4).astype(np.float64) / 255.0; o += nv * 4
    o += (-o) % 4
    idx = np.frombuffer(b, '<u4', ni, o).reshape(-1, 3).astype(np.int64); o += ni * 4
    n, = struct.unpack_from('<I', b, o); o += 4
    groups = {}
    for _ in range(n):
        ln, = struct.unpack_from('<H', b, o); o += 2
        name = b[o:o + ln].decode(); o += ln
        _mat, st, cnt = struct.unpack_from('<III', b, o); o += 12
        groups[name] = (st // 3, cnt // 3)
    n, = struct.unpack_from('<I', b, o); o += 4
    bones = []
    for _ in range(n):
        ln, = struct.unpack_from('<H', b, o); o += 2
        name = b[o:o + ln].decode(); o += ln
        par, = struct.unpack_from('<i', b, o); o += 4
        t = np.array(struct.unpack_from('<3f', b, o)); o += 12
        q = np.array(struct.unpack_from('<4f', b, o)); o += 16
        bones.append((name, par, t, q))
    return dict(pos=pos, nrm=nrm, uv=uv, bi=bi, bw=bw, tri=idx, groups=groups,
                bones=bones)


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by,
                     aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw,
                     aw * bw - ax * bx - ay * by - az * bz])


def qrot(q, v):
    u, w = q[:3], q[3]
    return v + 2 * np.cross(u, np.cross(u, v) + w * v)


def bind_heads(bones):
    """Every bone's head in bind space: the rest locals chained root-down,
    exactly as `skinnedFigure` composes `bindT` in 41-skin.js."""
    wq, wt = [], []
    for _n, p, t, q in bones:
        if p < 0:
            wq.append(q); wt.append(t)
        else:
            wq.append(qmul(wq[p], q)); wt.append(qrot(wq[p], t) + wt[p])
    return {bones[i][0]: wt[i] for i in range(len(bones))}


# ── bringing the arms down ─────────────────────────────────────────────────

def rot_between(u, t):
    """The shortest rotation taking unit u to unit t, as a 3x3."""
    v = np.cross(u, t)
    c = float(np.dot(u, t))
    s = np.linalg.norm(v)
    if s < 1e-9:
        return np.eye(3)
    k = v / s
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    ang = math.atan2(s, c)
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * (K @ K)


def affine(R, about):
    """R about the point `about`, as a 4x4."""
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = about - R @ about
    return M


def arm_pose(d, J, ang):
    """Per-bone 4x4 skin matrices that hang both arms `ang` radians off
    vertical, and the elbows they end up at."""
    names = [b[0] for b in d['bones']]
    M = [np.eye(4) for _ in names]
    elbows = {}
    for side, s in (('L', -1.0), ('R', 1.0)):
        U, L, H = 'armU' + side, 'armL' + side, 'hand' + side
        sh, el, hd = J[U], J[L], J[H]
        down = np.array([0.0, -math.cos(ang), s * math.sin(ang)])
        R1 = rot_between((el - sh) / np.linalg.norm(el - sh), down)
        A1 = affine(R1, sh)
        el1 = sh + R1 @ (el - sh)
        hd1 = sh + R1 @ (hd - sh)
        R2 = rot_between((hd1 - el1) / np.linalg.norm(hd1 - el1), down)
        A2 = affine(R2, el1) @ A1
        M[names.index(U)] = A1
        for b in (L, H, 'thumb' + side, 'fingers' + side):
            M[names.index(b)] = A2
        elbows[side] = el1
    return M, elbows


def skin_verts(d, M):
    """Linear-blend the bind positions and normals through per-bone M."""
    P = np.zeros_like(d['pos'])
    N = np.zeros_like(d['nrm'])
    hp = np.c_[d['pos'], np.ones(len(d['pos']))]
    for k in range(4):
        w = d['bw'][:, k:k + 1]
        Mk = np.stack([M[b] for b in d['bi'][:, k]])
        P += w * np.einsum('nij,nj->ni', Mk[:, :3, :], hp)
        N += w * np.einsum('nij,nj->ni', Mk[:, :3, :3], d['nrm'])
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    return P, N


# ── textures ────────────────────────────────────────────────────────────────

def load_px(path, box):
    """An image as a float array, row 0 at the BOTTOM — Blender's order, which
    is also UV's, so v indexes rows directly — box-filtered down by `box`."""
    im = bpy.data.images.load(str(path))
    w, h = im.size
    a = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    a = a.reshape(h, w, 4).astype(np.float64)
    if box > 1:
        a = a.reshape(h // box, box, w // box, box, 4).mean(axis=(1, 3))
    return a


def bilinear(img, uv):
    """Sample `img` at uv (n, 2), clamped, bilinear."""
    h, w = img.shape[:2]
    x = np.clip(uv[:, 0] * w - 0.5, 0, w - 1.001)
    y = np.clip(uv[:, 1] * h - 0.5, 0, h - 1.001)
    x0, y0 = x.astype(int), y.astype(int)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    a = img[y0, x0] * (1 - fx) + img[y0, x0 + 1] * fx
    b = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


# ── decimation, with everything re-sampled off the original ────────────────

def decimate(label, P, F, target, keep=None, factor=0.0):
    """Weld, collapse to `target` triangles, triangulate; positions and faces.

    Welded first because the blob is split at every UV seam, and a collapse
    that sees a seam as a boundary keeps it — or worse, opens it.

    `keep` (a weight per vertex of P) steers where the triangles go: see
    `FACE` for why the head gets more than an even share."""
    me = bpy.data.meshes.new(label)
    me.from_pydata([tuple(p) for p in P], [], [tuple(int(i) for i in f) for f in F])
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # The piece's faces index the WHOLE figure's vertex array, so everything
    # that belongs to the other pieces came in as loose points. Out.
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(label, me)
    bpy.context.collection.objects.link(ob)
    have = len(me.polygons)
    if keep is not None:
        used = np.unique(F.ravel())
        kd = KDTree(len(used))
        for k, i in enumerate(used):
            kd.insert(Vector(P[i]), k)
        kd.balance()
        g = ob.vertex_groups.new(name='keep')
        for v in me.vertices:
            w = float(keep[used[kd.find(v.co)[1]]])
            if w > 0:
                g.add([v.index], w, 'REPLACE')
    if have > target:
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = target / have
        m.use_collapse_triangulate = True
        if keep is not None:
            m.vertex_group = 'keep'
            m.vertex_group_factor = factor
        bpy.ops.object.modifier_apply(modifier='dec')
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    V = np.array([tuple(v.co) for v in me.vertices])
    N = np.array([tuple(v.normal) for v in me.vertices])
    T = np.array([tuple(p.vertices) for p in me.polygons], dtype=np.int64)
    return V, N, T, have


def resample(P, F, attrs, Q):
    """Each of Q's points, as the barycentric blend of `attrs` on the nearest
    triangle of the ORIGINAL mesh (P, F) — so what a decimated vertex carries
    is what the surface it sits on carried, and not a collapse's guess."""
    bvh = BVHTree.FromPolygons([Vector(p) for p in P], [tuple(int(i) for i in f) for f in F])
    out = np.zeros((len(Q), attrs.shape[1]))
    for i, q in enumerate(Q):
        loc, _n, fi, _d = bvh.find_nearest(Vector(q))
        a, b, c = F[fi]
        A, B, C = P[a], P[b], P[c]
        v0, v1, v2 = B - A, C - A, np.array(loc) - A
        d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
        d20, d21 = v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-18:
            wb = wc = 1 / 3
        else:
            wb = (d11 * d20 - d01 * d21) / den
            wc = (d00 * d21 - d01 * d20) / den
        wb, wc = min(max(wb, 0), 1), min(max(wc, 0), 1)
        wa = max(0.0, 1 - wb - wc)
        out[i] = wa * attrs[a] + wb * attrs[b] + wc * attrs[c]
    return out


# ── one body ────────────────────────────────────────────────────────────────

def one(kind, T2):
    d = read_v5(PAY / ('bather2_%s.fr3d.gz' % kind))
    names = [b[0] for b in d['bones']]
    J = bind_heads(d['bones'])
    natH = float(d['pos'][:, 1].max())          # `skinHeight` in 42-crowd.js
    S = H0 / natH
    nv = len(d['pos'])

    # Which of the eleven each vertex belongs to, as eleven weights.
    fold = np.array([PIX[FOLD[n]] for n in names])
    G = np.zeros((nv, len(PARTS)))
    for k in range(4):
        np.add.at(G, (np.arange(nv), fold[d['bi'][:, k]]), d['bw'][:, k])
    dom = G.argmax(1)

    # The pieces, by triangle: body (skin / eyes / mouth) and wear (hair / suit).
    b0, bn = d['groups']['body']
    w0, wn = d['groups']['wear']
    tri = d['tri']
    uv = d['uv']
    body = tri[b0:b0 + bn]
    wear = tri[w0:w0 + wn]
    bu = uv[body].mean(1)[:, 0]
    pieces = {'skin': body[bu < 2.0], 'eyes': body[(bu >= 2.0) & (bu < 3.0)]}
    ntile = int(T2['lum'].get('n_' + kind, 2))
    wu = uv[wear].mean(1)[:, 0]
    hair_t, suit_t = wear[wu < 1.0 / ntile], wear[wu >= 1.0 / ntile]

    # ── coverage ────────────────────────────────────────────────────────
    atlas = load_px(PAY / ('bwear_%s.png' % kind), 2)
    alpha = atlas[..., 3:4]
    lumap = (atlas[..., 0:1] * 0.299 + atlas[..., 1:2] * 0.587
             + atlas[..., 2:3] * 0.114)
    BARY = np.array([[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2],
                     [0.2, 0.2, 0.6], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5],
                     [0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.1, 0.1, 0.8]])

    def cover(tris):
        tuv = uv[tris]                                   # (n, 3, 2)
        pts = np.einsum('kj,njc->nkc', BARY, tuv).reshape(-1, 2)
        return bilinear(alpha, pts).reshape(len(tris), len(BARY)).mean(1)

    hc, sc = cover(hair_t), cover(suit_t)
    pieces['hair'] = hair_t[hc >= COVER['hair']]
    pieces['suit'] = suit_t[sc >= COVER['suit']]

    # ── the arms, down ──────────────────────────────────────────────────
    #
    # The clearance test is on the skin and the swimwear only: a long
    # hairstyle hangs by the arms and is meant to.
    arm_parts = {PIX['armLL'], PIX['armRL']}
    hip_parts = {PIX['pelvis'], PIX['legLU'], PIX['legRU']}
    solid_v = np.unique(np.r_[pieces['skin'].ravel(), pieces['suit'].ravel()])
    hand_v = solid_v[np.isin(dom[solid_v], list(arm_parts))]
    hip_v = solid_v[np.isin(dom[solid_v], list(hip_parts))]
    ang = None
    for deg in range(3, 36):
        M, elbows = arm_pose(d, J, math.radians(deg))
        P, N = skin_verts(d, M)
        kd = KDTree(len(hip_v))
        for k, i in enumerate(hip_v):
            kd.insert(Vector(P[i]), k)
        kd.balance()
        near = min(kd.find(Vector(P[i]))[2] for i in hand_v)
        if near >= CLEAR:
            ang = deg
            break
    if ang is None:
        ang = 35
    print('[crowd_far] %-17s %.3f m  arms %d deg off vertical' % (kind, natH, ang))

    # ── per-vertex shading, on the original mesh ────────────────────────
    tint = np.ones((nv, 3))
    # Skin: the texel over the skin's own mean, over the pool.
    spec = T2['bathers'][kind]
    ratio = np.zeros((nv, 3))
    for sk in spec['skins']:
        img = load_px(PAY / ('bskin_%s.jpg' % sk), 4)[..., :3]
        tone = np.array(T2['tones'][sk])
        ratio += bilinear(img, np.clip(uv, 0, 1)) / tone
    ratio /= len(spec['skins'])
    sv = np.unique(pieces['skin'].ravel())
    tint[sv, :3] = np.clip(ratio[sv], 0.35, 1.6)
    # Hair and swimwear: the near tier's dye shading, alpha-weighted.
    prem = np.concatenate([lumap * alpha, alpha], axis=2)
    for piece, lk in (('hair', 'hair_'), ('suit', 'suit_')):
        vv = np.unique(pieces[piece].ravel())
        if not len(vv):
            continue
        s = bilinear(prem, uv[vv])
        lm = float(T2['lum'].get(lk + kind, 0.4))
        l = np.where(s[:, 1] > 0.05, s[:, 0] / np.maximum(s[:, 1], 1e-6), lm)
        dim = HAIR_DIM if piece == 'hair' else 1.0
        tint[vv, :3] = (np.clip(0.30 + 0.70 * l / lm, 0.2, 1.8) * dim)[:, None]
    # The mean shading of each, for the paint underneath it: skin painted
    # "hair" has no texel of its own, and plain dye would be the LIGHTEST the
    # hair ever gets — afro01's cards average a third of that.
    cap = {}
    for piece in ('hair', 'suit'):
        vv = np.unique(pieces[piece].ravel())
        cap[piece] = round(float(tint[vv, 0].mean()), 4) if len(vv) else 1.0
    ev = np.unique(pieces['eyes'].ravel())
    tint[ev, :3] = EYE
    # The scalp under the hair, painted hair.
    #
    # The cards are thinned by coverage above, and what the thinning takes
    # away has to show the right colour behind it: a scalp through a gap in
    # the hair reads as a bald patch. Each head vertex casts OUT along its own
    # normal on to the hairstyle's WHOLE surface, thinned or not, and takes
    # the texture's alpha where it hits — painted where the hair over it is
    # really there. Not the nearest point: skin just past an edge is nearest
    # to the edge, and that is a glow round the hairline. Only the head,
    # because a fall of long hair lies on the back and the back is not hair.
    #
    # NOT THE SWIMWEAR, and it was tried. The same paint under a bikini is a
    # red glow round it on a decimated body — a painted vertex colours every
    # triangle it touches, three or four centimetres of them — and side by
    # side with the near tier it was the first thing that differed. The gaps
    # it was meant to fill are mostly THERE on the near tier too: the jeans
    # shorts are ripped and the one-piece is cut out, and the alpha test up
    # close shows skin through both. So the swimwear is thinned at the same
    # 0.5 the near tier's alpha test cuts at, and left to be what it is.
    #
    # The blob's byte can carry both (0-127 swimwear, 128-255 hair), and the
    # shader reads both, so a garment that ever does need it costs one line.
    def under(tris, reach, parts=None):
        w = np.zeros(nv)
        if not len(tris):
            return w
        bvh = BVHTree.FromPolygons([Vector(p) for p in P],
                                   [tuple(int(i) for i in f) for f in tris])
        for i in sv:
            if parts is not None and dom[i] not in parts:
                continue
            # Straight out along the skin's own normal, from a couple of
            # millimetres inside it (a garment is allowed to graze the skin).
            # NOT the nearest point: skin just past a bikini's edge is nearest
            # to that edge, which is opaque, and that is how a red glow got
            # round every top.
            hit = bvh.ray_cast(Vector(P[i] - N[i] * 0.002 / S), Vector(N[i]), reach / S)
            if hit[0] is None:
                continue
            a0, a1, a2 = tris[hit[2]]
            A, B, C = P[a0], P[a1], P[a2]
            v0, v1, v2 = B - A, C - A, np.array(hit[0]) - A
            d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
            den = d00 * d11 - d01 * d01
            if abs(den) < 1e-18:
                continue
            wb = (d11 * (v2 @ v0) - d01 * (v2 @ v1)) / den
            wc = (d00 * (v2 @ v1) - d01 * (v2 @ v0)) / den
            t = (1 - wb - wc) * uv[a0] + wb * uv[a1] + wc * uv[a2]
            al = float(bilinear(alpha, t[None, :])[0, 0])
            w[i] = min(1.0, max(0.0, (al - 0.3) / 0.4))
        return w

    wh = under(hair_t, 0.035, {PIX['head']})
    ws = np.zeros(nv)

    # ── decimate each piece and re-sample onto it ───────────────────────
    # The two under-paint weights travel separately and are packed into their
    # byte only at the end: the resample blends across a triangle, and a
    # blend of a hair byte and a bare one is a swimwear byte.
    attrs = np.c_[G, tint[:, :3], wh, ws]
    Pn = P * S
    out = []
    for piece in ('skin', 'eyes', 'hair', 'suit'):
        F = pieces[piece]
        if not len(F):
            continue
        keep = np.where(dom == PIX['head'], HEADW, 1.0) if piece == 'skin' else None
        V, VN, TT, have = decimate('%s_%s' % (kind, piece), Pn, F, BUDGET[piece],
                                   keep, FACE)
        A = resample(Pn, F, attrs, V)
        hd = (A[:, :len(PARTS)].argmax(1) == PIX['head'])[TT].all(1).sum()
        print('[crowd_far]   %-5s %5d -> %4d tris  (%d on the head)'
              % (piece, have, len(TT), hd))
        out.append((piece, V, VN, TT, A))

    # ── the joints ──────────────────────────────────────────────────────
    hip = (J['legUL'] + J['legUR']) / 2
    world = {
        'pelvis': np.array([hip[0], hip[1], 0.0]),
        'torso': np.array([J['spine01'][0], J['spine01'][1], 0.0]),
        'head': np.array([J['neck'][0], J['neck'][1], 0.0]),
        'armLU': J['armUL'], 'armLL': elbows['L'],
        'armRU': J['armUR'], 'armRL': elbows['R'],
        'legLU': J['legUL'], 'legLL': J['legLL'],
        'legRU': J['legUR'], 'legRL': J['legLR'],
    }
    world = {k: v * S for k, v in world.items()}

    # ── how high the hip sits over a seat ───────────────────────────────
    #
    # `sit` in 42-crowd.js swings the thighs forward level (1.53 rad about the
    # hip) and drops the pelvis on to the slab. How far the hip joint then sits
    # above the slab is the thickness of the thigh under it, which is a
    # property of the body: 0.14 was right for the old rig's tube. Measured
    # here on the underside of this body's thighs, thighs level.
    lowest = 1e9
    for piece, V, VN, TT, A in out:
        if piece not in ('skin', 'suit'):
            continue
        dm = A[:, :len(PARTS)].argmax(1)
        for side in ('legLU', 'legRU'):
            sel = dm == PIX[side]
            if not sel.any():
                continue
            c, s = math.cos(1.53), math.sin(1.53)
            rel = V[sel] - world[side]
            y = rel[:, 0] * s + rel[:, 1] * c + world[side][1]
            lowest = min(lowest, float(y.min()))
    sit_hip = float(world['pelvis'][1] - lowest)

    # ── assemble and write ──────────────────────────────────────────────
    pos, nrm, tn, bone, idx = [], [], [], [], []
    base = 0
    for piece, V, VN, TT, A in out:
        g = A[:, :len(PARTS)]
        order = np.argsort(-g, axis=1)
        j0, j1 = order[:, 0], order[:, 1]
        g0 = g[np.arange(len(g)), j0]
        g1 = g[np.arange(len(g)), j1]
        wt = g0 / np.maximum(g0 + g1, 1e-9)
        j1 = np.where(g1 > 1e-4, j1, j0)
        t = A[:, len(PARTS):len(PARTS) + 3]
        uh, us = A[:, len(PARTS) + 3], A[:, len(PARTS) + 4]
        ua = np.where((uh >= us) & (uh > 0.02), 128 + uh * 127,
                      np.where(us > 0.02, us * 127, 0))
        k = KIND['literal' if piece == 'eyes' else piece]
        for i in range(len(V)):
            pos.extend(V[i])
            n = VN[i] / max(np.linalg.norm(VN[i]), 1e-9)
            nrm.extend(int(round(max(-1, min(1, c)) * 127)) for c in n)
            tn.extend([int(round(min(255, max(0, t[i, c] / 2 * 255)))) for c in range(3)]
                      + [int(round(min(255, max(0, ua[i]))))])
            bone.extend([int(j0[i]), int(j1[i]), int(round(wt[i] * 255)), k])
        idx.extend((TT + base).ravel().tolist())
        base += len(V)

    nvo, nio = len(pos) // 3, len(idx)
    top = max(pos[1::3])
    meta = json.dumps({'kind': kind, 'stature': H0, 'natH': round(natH, 4),
                       'scale': round(S, 5), 'armDeg': ang, 'sitHip': round(sit_hip, 4),
                       'capHair': cap['hair'], 'capSuit': cap['suit'],
                       'tris': nio // 3}, separators=(',', ':')).encode()
    head = struct.pack('<4sIIIfI', b'FR3D', 6, nvo, nio, top, len(PARTS))
    for name, parent in PARTS:
        p = world[name] - (world[PARTS[parent][0]] if parent >= 0 else 0)
        nb = name.encode()
        head += struct.pack('<H', len(nb)) + nb + struct.pack('<i3f', parent, *p)
    head += struct.pack('<H', len(meta)) + meta
    blob = (head + struct.pack('<%df' % len(pos), *pos)
            + struct.pack('<%db' % len(nrm), *nrm) + bytes(tn) + bytes(bone)
            + struct.pack('<%dH' % nio, *idx))
    path = PAY / ('crowd_%s.fr3d.gz' % kind)
    buf = io.BytesIO()
    # mtime 0, for the reason `_write` in frmesh.py gives: an unchanged bake
    # must be an unchanged payload, byte for byte.
    # And PACKED, as v10: `pack_crowd` in tools/fr3d_q.py, the function that
    # converted the shipped bodies.
    with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=9, mtime=0) as gz:
        gz.write(pack_crowd(blob))
    path.write_bytes(buf.getvalue())
    print('[crowd_far]   %s  %d verts  %d tris  top %.3f  sitHip %.3f  %.0f KB'
          % (path.name, nvo, nio // 3, top, sit_hip, len(buf.getvalue()) / 1024))


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = argv[argv.index('--only') + 1] if '--only' in argv else None
    T2 = json.loads((PAY / 'bathers2.json').read_text())
    for kind in CAST:
        if only and kind != only:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        one(kind, T2)


if __name__ == '__main__':
    main()
