#!/usr/bin/env python3
"""Baye v2.0 — the textured figure, built straight off the base mesh.

    blender -b -noaudio -P tools/blender/baye2.py    # the blob
    python3 tools/baye2_tex.py                        # and her textures

Writes build/payload/baye2.fr3d.gz; `tools/baye2_tex.py` writes the textures
beside it and `src/41-skin.js` reads both.

THE TEXTURES ARE NOT WRITTEN HERE, and they were, for one release. Blender's
Python has numpy and no PIL, and `baye2_tex.py` does not only copy the maps —
it paints pubic hair into the skin, which every community skin in the pack
lacks and v1.0 has. A copy step in this file would silently overwrite that
with the plain map on the next rebuild, which is a defect that only shows up
on a figure nobody is currently looking at. She does not replace Baye v1.0 and is not meant to yet; she
shadows the shore figure so that a year of clips can be watched on her before
anyone decides.

── what is different about her, and it is one thing ──────────────────────────

v1.0 is a magnificent piece of work that paints a person with GEOMETRY. The
base mesh is subdivided, decimated to 26 000 triangles, and coloured by a few
dozen hand-placed "cutters" — solids intersected with the body to lay down a
lip, an areola, a nail, a tan line. It carries no UVs at all; `uv` does not
appear once in the 8 400 lines of `human_mh.py`. Everything it knows about
how she looks is in `aVCol`, three bytes a vertex.

v2.0 keeps the base mesh's own topology and its own UV layout, and puts a
photographic skin on it. That is the whole of the change. The rig is the same
rig, solved by the same `skin()`; the clips are the same 49 clips, baked by
the same `_bake_clip`; she can do everything v1.0 can do, because it is
literally the same skeleton and the same animation data.

── why the base mesh is parsed here rather than imported ─────────────────────

Two reasons, and both of them are index-shaped.

The community assets are fitted through their `.mhclo`, which references base
mesh vertices BY FILE ORDER. Blender's OBJ importer reorders and splits, so an
index into what it hands back is silently a different vertex. `assets.py`
already parses the file for that reason and this file agrees with it.

And a `.obj` vertex is not a GPU vertex: UVs are per-FACE-CORNER, so one
position with two texture coordinates across a seam is two vertices
downstream. Doing that expansion here means the seam splits exactly where the
UV layout says, rather than wherever a round trip through Blender put it.

So Blender is used for the two things only it can do — build the armature from
the joint markers, and solve the bone weights — and everything else is
arithmetic on arrays.

── how a garment knows which bone owns it ────────────────────────────────────

The same `.mhclo`. A garment vertex rides a triangle of BASE vertices at known
barycentric weights, so its bone weights are the same blend of the same three
vertices' bone weights. Not a projection, not a nearest-neighbour guess: the
exact answer, by construction. A braid rides the scalp and therefore follows
the head, which a nearest-body-vertex transfer would have got wrong — the
nearest body vertex to the tip of a braid is a shoulder blade.

── the format ────────────────────────────────────────────────────────────────

v5 = v4 plus a UV array and a table of named parts. v4's own note said that
the day a second garment wanted taking off was the day its one `shed` counter
became a table, and that the version number was there so that day would be a
clean break. This is that day.
"""
import gzip
import struct
import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Matrix, Vector  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
import human_mh as H  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'build' / 'wardrobe'
OUT = ROOT / 'build' / 'payload'
BLEND = ROOT / 'build' / 'baye2.blend'

# What she wears, from the same rack tools/wardrobe builds. Picked by Misha in
# the viewer: caucasian skin, the unkempt french braid, eyebrows 09, eyelashes
# 04, black fishnet, and nothing else.
WEAR = {
    'skin': 'darthfurby_caucasian_female',
    'hair': 'elvs_unkempt_french_braid',
    'brow': 'mindfront_eyebrows_09',
    'lash': 'mindfront_eyelashes_04',
    'leg':  'v0rt3x_stockings_black_fishnet_medium',
}
# `tools/baye2_tex.py` carries the same three names it needs; if they ever
# disagree she is wearing one asset's geometry under another's texture, which
# on a hairstyle is obvious and on a skin is not.
# Which base-mesh groups become which part. Anything not named here is a
# fitting helper or a joint marker and is dropped: `helper-hair` is a VOLUME
# that hair is fitted inside rather than hair, and the base's own eyelashes are
# chunky wedges that read as eyeliner next to a modelled lash strip.
BASE_PARTS = {
    'body':  ('body',),
    'eyes':  ('helper-l-eye', 'helper-r-eye'),
    'mouth': ('helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue'),
}
# Material ids the runtime switches on. Kept as small integers in the blob so
# that a part's name is a label and not a contract.
MAT = {'body': 0, 'eyes': 1, 'mouth': 2, 'hair': 3, 'brow': 4, 'lash': 4, 'leg': 5}
MAX_INFLUENCES = 4
# Strand meshes, thinned. See `decimate`; the hair is left alone because its
# cards carry the alpha cut-out that makes it read as hair at all.
THIN = {'brow': 2400, 'lash': 2400}
# Parts with no texture, so no UV seam and nothing to split a vertex over.
# Eyebrows and eyelashes ship with no map at all — their `.mhmat` is
# `diffuseColor 0 0 0` and nothing else — and the eyeballs' UV layout is
# unknown to us, so the iris is drawn in world space instead. Keying their
# vertices on a UV they do not have split 20 143 brow vertices into 50 513.
NO_UV = {'eyes', 'mouth', 'brow', 'lash'}


# ── the base mesh, in file order ─────────────────────────────────────────── #

def read_obj(path):
    """Positions, texture coordinates, and faces per group — file order.

    Faces are kept as (vertex index, uv index) pairs because that pairing is
    what decides where a seam splits, and it is thrown away by every importer.
    """
    vs, vts, faces, cur = [], [], {}, None
    for ln in path.read_text(errors='ignore').splitlines():
        if ln.startswith('v '):
            a = ln.split()
            vs.append((float(a[1]), float(a[2]), float(a[3])))
        elif ln.startswith('vt '):
            a = ln.split()
            vts.append((float(a[1]), float(a[2])))
        elif ln.startswith('g '):
            cur = ln[2:].strip()
        elif ln.startswith('f '):
            corners = []
            for tok in ln.split()[1:]:
                p = tok.split('/')
                vi = int(p[0]) - 1
                ti = int(p[1]) - 1 if len(p) > 1 and p[1] else -1
                corners.append((vi, ti))
            faces.setdefault(cur, []).append(corners)
    return vs, vts, faces


def game_space(v, scale, drop):
    """MakeHuman coordinates to this project's Blender-space metres.

    `load()` gets here by composing Blender's default OBJ axis conversion with
    a quarter turn; `read_joints` gets here directly. They agree, and this is
    what they agree on:  (x, y, z) -> (z*s, x*s, y*s + drop).
    """
    return (v[2] * scale, v[0] * scale, v[1] * scale + drop)


# ── Blender: the armature, and the weights ───────────────────────────────── #

def solve_weights(vs, faces, scale, drop):
    """Four (bone, weight) pairs per BASE vertex index, plus the rig.

    The mesh handed to the solver carries only the groups that survive into
    the figure, so its vertices are a subset — the map back to file order is
    returned with it, because everything downstream indexes by file order.
    """
    J, _s, _d = H.read_joints(H.fetch())
    bpy.ops.wm.read_factory_settings(use_empty=True)

    keep = sorted({vi for names in BASE_PARTS.values()
                   for n in names for f in faces.get(n, []) for vi, _t in f})
    remap = {vi: i for i, vi in enumerate(keep)}
    tris = []
    for names in BASE_PARTS.values():
        for n in names:
            for f in faces.get(n, []):
                c = [remap[vi] for vi, _t in f]
                for k in range(1, len(c) - 1):
                    tris.append((c[0], c[k], c[k + 1]))
    me = bpy.data.meshes.new('baye2')
    me.from_pydata([Vector(game_space(vs[vi], scale, drop)) for vi in keep], [], tris)
    me.update()
    body = bpy.data.objects.new('human', me)
    bpy.context.collection.objects.link(body)
    print('[baye2] solve mesh %d verts %d tris' % (len(keep), len(tris)))

    rig = H.armature(J)
    H.skin(body, rig)
    H.pose(rig, {})

    rest = H._rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}
    gname = {g.index: g.name for g in body.vertex_groups}

    out = {}
    for v in me.vertices:
        gs = sorted(((g.weight, bindex[gname[g.group]]) for g in v.groups
                     if g.group in gname and gname[g.group] in bindex and g.weight > 0),
                    reverse=True)[:MAX_INFLUENCES]
        if not gs:
            out[keep[v.index]] = ((0, 0, 0, 0), (255, 0, 0, 0))
            continue
        tot = sum(w for w, _ in gs)
        q = [max(0, min(255, int(round(w / tot * 255)))) for w, _ in gs]
        # Exactly 255, not approximately: the shader adds four bone matrices
        # scaled by these and does not renormalise, so a vertex summing to 0.99
        # walks towards the origin of the world a little more every frame.
        q[0] += 255 - sum(q)
        bi = [b for _, b in gs] + [0] * (MAX_INFLUENCES - len(gs))
        q += [0] * (MAX_INFLUENCES - len(q))
        out[keep[v.index]] = (tuple(bi), tuple(q))
    return out, rig, rest, body


# ── assembling one vertex array out of several meshes ────────────────────── #

class Buf:
    def __init__(self):
        self.pos, self.nrm, self.uv = [], [], []
        self.bidx, self.bwgt, self.idx = [], [], []
        self.groups = []

    def part(self, name, mat, verts, tris):
        """verts: [(pos, nrm, uv, bidx, bwgt)]; tris: [(a, b, c)] into verts."""
        base = len(self.pos) // 3
        start = len(self.idx)
        for p, n, t, bi, bw in verts:
            # Blender Z-up -> three.js Y-up, the same conversion frmesh.export
            # names. Leaving it out does not look like a bug in the loader: she
            # arrives in the right place at the right size, lying on her back
            # with half of her under the pavement.
            self.pos.extend((p[0], p[2], -p[1]))
            self.nrm.extend((n[0], n[2], -n[1]))
            self.uv.extend(t)
            self.bidx.extend(bi)
            self.bwgt.extend(bw)
        for a, b, c in tris:
            self.idx.extend((base + a, base + b, base + c))
        self.groups.append((name, mat, start, len(self.idx) - start))
        print('[baye2] %-6s mat %d  %6d verts  %6d tris'
              % (name, mat, len(verts), len(tris)))


def expand(vs, vts, faces, names, wt, scale, drop, fallback=None, uv=True):
    """OBJ faces to GPU vertices: one per distinct (position, uv) pairing.

    `uv=False` for a part that carries no map: then the pairing is the vertex
    alone, and nothing is split.
    """
    lookup, verts, tris, nrmacc, src = {}, [], [], {}, []
    for n in names:
        for f in faces.get(n, []):
            c = []
            for vi, ti in f:
                key = (vi, ti) if uv else vi
                j = lookup.get(key)
                if j is None:
                    j = len(verts)
                    lookup[key] = j
                    src.append(vi)
                    bi, bw = wt.get(vi) or (fallback(vi) if fallback else ((0,) * 4, (255, 0, 0, 0)))
                    verts.append([game_space(vs[vi], scale, drop), [0.0, 0.0, 0.0],
                                  vts[ti] if uv and 0 <= ti < len(vts) else (0.0, 0.0),
                                  bi, bw])
                c.append(j)
            for k in range(1, len(c) - 1):
                tris.append((c[0], c[k], c[k + 1]))
    # Area-weighted vertex normals, accumulated over the BASE vertex and not
    # over the split one.
    #
    # This is the whole of what a UV seam is: one position with two texture
    # coordinates, which has to become two GPU vertices. Sum the face normals
    # separately into each of those two and the two halves of the seam get
    # different normals — so the lighting steps across it, and what you see is
    # a bright crease running the length of her spine and round her hip on a
    # mesh with no crease in it. Keyed on `src[j]`, the two halves get the same
    # normal and the seam is invisible, which is what a seam is for.
    #
    # The cross product is deliberately not normalised before it is
    # accumulated: its length IS twice the triangle's area, so a big triangle
    # pulls harder on a shared vertex than a sliver does.
    for a, b, c in tris:
        pa, pb, pc = (Vector(verts[i][0]) for i in (a, b, c))
        fn = (pb - pa).cross(pc - pa)
        for i in (a, b, c):
            k = src[i]
            nrmacc.setdefault(k, Vector((0, 0, 0)))
            nrmacc[k] += fn
    for i, v in enumerate(verts):
        n = nrmacc.get(src[i])
        v[1] = tuple(n.normalized()) if n and n.length > 1e-12 else (0.0, 0.0, 1.0)
    return [(v[0], v[1], v[2], v[3], v[4]) for v in verts], tris


def read_mhclo_refs(path):
    """(refs, weights) per asset vertex — see tools/wardrobe/assets.py.

    Re-read here rather than imported because Blender's Python does not have
    the repository on its path and the parse is fifteen lines.
    """
    refs, ws, inv = [], [], False
    for ln in path.read_text(errors='ignore').splitlines():
        w = ln.split()
        if not w:
            continue
        if w[0] == 'verts':
            inv = True
            continue
        if not inv:
            continue
        try:
            if len(w) >= 9:
                refs.append((int(w[0]), int(w[1]), int(w[2])))
                ws.append((float(w[3]), float(w[4]), float(w[5])))
            elif len(w) == 1:
                i = int(w[0])
                refs.append((i, i, i)); ws.append((1.0, 0.0, 0.0))
            else:
                break
        except ValueError:
            break
    return refs, ws


def blend_weights(refs, ws, wt, near):
    """Per asset vertex, the barycentric blend of its three base vertices.

    The blend happens in float over a histogram of bone -> weight, and only
    then are the top four taken and requantised. Taking the top four of each
    corner FIRST and blending those would drop a bone that is third on all
    three corners and therefore ought to win outright.
    """
    out = []
    for (a, b, c), (wa, wb, wc) in zip(refs, ws):
        acc = {}
        for vi, w in ((a, wa), (b, wb), (c, wc)):
            bi, bw = wt.get(vi) or near(vi)
            for k in range(MAX_INFLUENCES):
                if bw[k]:
                    acc[bi[k]] = acc.get(bi[k], 0.0) + w * bw[k]
        gs = sorted(((v, k) for k, v in acc.items() if v > 0), reverse=True)[:MAX_INFLUENCES]
        if not gs:
            out.append(((0, 0, 0, 0), (255, 0, 0, 0)))
            continue
        tot = sum(v for v, _ in gs)
        q = [max(0, min(255, int(round(v / tot * 255)))) for v, _ in gs]
        q[0] += 255 - sum(q)
        bi = [k for _, k in gs] + [0] * (MAX_INFLUENCES - len(gs))
        q += [0] * (MAX_INFLUENCES - len(q))
        out.append((tuple(bi), tuple(q)))
    return out


# ── thinning the strand meshes ───────────────────────────────────────────── #

def decimate(verts, tris, target, label):
    """Collapse a part down to roughly `target` triangles.

    Eyebrows and eyelashes are modelled as individual STRANDS, each one a
    little tube, and they arrive at 29 652 and 24 372 triangles — between them
    more than twice the whole of Baye v1.0. That density buys something on a
    face filling the frame and nothing at all on an apprentice three metres
    behind somebody, and a tube flattened into a ribbon is exactly what a hair
    looks like anyway.

    The weights are re-derived rather than interpolated, and they can be:
    every vertex of a brow or a lash rides the skull, so the whole part shares
    one bone and the collapse cannot move a vertex to a different one. That is
    asserted rather than assumed — if a part ever arrives spanning two bones,
    this is the wrong tool for it and says so.
    """
    have = len(tris)
    if have <= target:
        return verts, tris
    bones = {v[3][0] for v in verts}
    if len(bones) != 1:
        sys.exit('[baye2] %s spans %d bones; decimate() only handles rigid parts'
                 % (label, len(bones)))
    bi, bw = verts[0][3], verts[0][4]

    me = bpy.data.meshes.new('dec_' + label)
    me.from_pydata([Vector(v[0]) for v in verts], [], list(tris))
    me.update()
    ob = bpy.data.objects.new('dec_' + label, me)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    # PLANAR, not COLLAPSE. A brow is some hundreds of separate little tubes
    # and COLLAPSE cannot merge across a component boundary, so it stalls: at
    # a ratio of 0.08 it returned 64% of the triangles and called it done.
    # PLANAR dissolves faces that are nearly coplanar, which on a tube is the
    # length of it, and that is exactly the redundancy here — a strand is long
    # and straight and made of far more rings than its silhouette needs.
    d = ob.modifiers.new('dec', 'DECIMATE')
    d.decimate_type = 'DISSOLVE'
    d.angle_limit = 0.9
    bpy.ops.object.modifier_apply(modifier='dec')

    me.calc_loop_triangles()
    lookup, nverts, ntris = {}, [], []
    for t in me.loop_triangles:
        c = []
        for li in t.loops:
            vi = me.loops[li].vertex_index
            j = lookup.get(vi)
            if j is None:
                j = len(nverts)
                lookup[vi] = j
                v = me.vertices[vi]
                n = me.loops[li].normal if me.loops[li].normal.length else v.normal
                nverts.append((tuple(v.co), tuple(n), (0.0, 0.0), bi, bw))
            c.append(j)
        ntris.append(tuple(c))
    bpy.data.objects.remove(ob, do_unlink=True)
    print('[baye2] %-6s thinned %d -> %d tris, %d -> %d verts'
          % (label, have, len(ntris), len(verts), len(nverts)))
    return nverts, ntris


# ── the v5 blob ──────────────────────────────────────────────────────────── #

def write_blob(buf, rest, baked, path):
    nv, ni = len(buf.pos) // 3, len(buf.idx)
    xs, ys, zs = buf.pos[0::3], buf.pos[1::3], buf.pos[2::3]
    # v5 = v4 plus a UV array and a table of named parts. v4's single `shed`
    # counter said that the day a second removable thing arrived was the day it
    # became a table and the version number would make that a clean break.
    parts = [struct.pack('<4sIII6fI', b'FR3D', 5, nv, ni,
                         min(xs), min(ys), min(zs), max(xs), max(ys), max(zs),
                         len(buf.groups)),
             struct.pack('<%df' % (nv * 3), *buf.pos),
             struct.pack('<%df' % (nv * 3), *buf.nrm),
             struct.pack('<%df' % (nv * 2), *buf.uv),
             bytes(buf.bidx), bytes(buf.bwgt)]
    # Pad so the index array lands 4-byte aligned and the loader can take a
    # view on it rather than copying half a megabyte.
    parts.append(b'\0' * ((-sum(len(p) for p in parts)) % 4))
    parts.append(struct.pack('<%dI' % ni, *buf.idx))

    parts.append(struct.pack('<I', len(buf.groups)))
    for name, mat, start, count in buf.groups:
        nb = name.encode()
        parts.append(struct.pack('<H%dsIII' % len(nb), len(nb), nb, mat, start, count))

    parts.append(struct.pack('<I', len(rest)))
    for name, parent, _local_b, local_g in rest:
        nb = name.encode()
        t = local_g.translation
        q = local_g.to_quaternion()
        parts.append(struct.pack('<H%dsi7f' % len(nb), len(nb), nb, parent,
                                 t.x, t.y, t.z, q.x, q.y, q.z, q.w))

    parts.append(struct.pack('<I', len(baked)))
    for c in baked:
        nb = c['name'].encode()
        parts.append(struct.pack('<H%dsfIB3x' % len(nb), len(nb), nb,
                                 c['dur'], len(c['frames']), 1 if c['loop'] else 0))
        for rt, quats in c['frames']:
            parts.append(struct.pack('<3f', *rt))
            for q in quats:
                parts.append(struct.pack('<4h', *q))

    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, 'wb', compresslevel=9) as f:
        f.write(b''.join(parts))
    print('[baye2] %s  %d verts  %d tris  %d parts  %d bones  %d clips  %.0f KB gz'
          % (path.name, nv, ni // 3, len(buf.groups), len(rest), len(baked),
             path.stat().st_size / 1024))


def main():
    base = H.fetch()
    vs, vts, faces = read_obj(base)
    _J, scale, drop = H.read_joints(base)
    print('[baye2] base %d verts %d uvs %d groups' % (len(vs), len(vts), len(faces)))

    wt, rig, rest, solved = solve_weights(vs, faces, scale, drop)
    print('[baye2] weighted %d base verts over %d bones' % (len(wt), len(rest)))

    # A base vertex the solve never saw — a helper the figure does not carry —
    # still has to answer, because a garment may ride a triangle with one
    # corner on it. The nearest weighted vertex is the honest fallback and it
    # is reported, because a fallback nobody counts is a fallback that grows.
    kd = [(Vector(game_space(vs[i], scale, drop)), i) for i in wt]
    missed = [0]

    def near(vi):
        missed[0] += 1
        p = Vector(game_space(vs[vi], scale, drop))
        return wt[min(kd, key=lambda e: (e[0] - p).length_squared)[1]]

    buf = Buf()
    for name, groups in BASE_PARTS.items():
        verts, tris = expand(vs, vts, faces, groups, wt, scale, drop, near,
                             uv=name not in NO_UV)
        buf.part(name, MAT[name], verts, tris)

    # The garments, each already rewritten into the base mesh's own space by
    # tools/wardrobe/assets.py, and each weighted through its own .mhclo.
    packs = ROOT / 'build' / 'mh_assets'
    for kind in ('hair', 'brow', 'lash', 'leg'):
        aid = WEAR.get(kind)
        if not aid:
            continue
        objp = WORK / ('%s__%s.obj' % (kind, aid))
        d = next((x for x in packs.rglob(aid) if x.is_dir()), None)
        if d is None:
            for x in packs.rglob('*'):
                if x.is_dir() and (x / (aid + '.mhclo')).exists():
                    d = x
                    break
        mhclo = next(iter(sorted(d.glob('*.mhclo'))), None) if d else None
        if not (objp.exists() and mhclo):
            sys.exit('[baye2] %s: need %s and its .mhclo — run tools/wardrobe/make.py'
                     % (kind, objp.name))
        avs, avts, afaces = read_obj(objp)
        refs, ws = read_mhclo_refs(mhclo)
        if len(refs) != len(avs):
            sys.exit('[baye2] %s: %d mhclo rows vs %d obj verts'
                     % (aid, len(refs), len(avs)))
        aw = dict(enumerate(blend_weights(refs, ws, wt, near)))
        verts, tris = expand(avs, avts, afaces, list(afaces), aw, scale, drop,
                             lambda i: ((0, 0, 0, 0), (255, 0, 0, 0)),
                             uv=kind not in NO_UV)
        if kind in THIN:
            verts, tris = decimate(verts, tris, THIN[kind], kind)
        buf.part(kind, MAT[kind], verts, tris)

    print('[baye2] %d garment corners fell back to the nearest weighted vertex'
          % missed[0])

    # The floor passes solve the hip heights the clips below are authored
    # against, and several of the clip lists are EMPTY until they run. Baking
    # before them is baking nothing.
    H.wheel_floor(rig)
    H.dance_floor(rig)
    H.skip_floor(rig)
    H.walk_floor(rig)
    H.fire_floor(rig)
    H.ballet_floor(rig)
    H.wine_floor(rig)
    baked = [H._bake_clip(rest, c) for c in H.CLIPS]

    write_blob(buf, rest, baked, OUT / 'baye2.fr3d.gz')
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))


if __name__ == '__main__':
    main()
