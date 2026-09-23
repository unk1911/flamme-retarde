#!/usr/bin/env python3
"""The eight Jadrija bathers, the way Baye v2.0 is built.

    blender -b -noaudio -P tools/blender/bathers_v2.py
    blender -b -noaudio -P tools/blender/bathers_v2.py -- --only girl_child
    python3 tools/bathers_v2_tex.py            # and their textures

Writes build/payload/bather2_<name>.fr3d.gz, one .fr3d v5 blob per figure.

── what changes, and what does not ──────────────────────────────────────────

`bathers_mh.py` builds these eight the way v1.0 Baye is built: the base mesh
subdivided, decimated to 7 000 triangles, and PAINTED — skin tone, eyes, brows,
lips and a hair cap all laid on as vertex colour by a few dozen ellipsoid
cutters, which on a body this coarse comes out as black-rimmed eyes, tufts for
eyebrows and a helmet where the hair should be. Seen from the promenade at a
couple of metres, that is the whole of what was wrong with them.

This keeps everything about them that is about MOVING — the same morphed
bodies from `mh_morph.py`, the same skeleton built off each body's own joint
markers, and the same clips `bathers_mh.py` solves for each of them against the
cafe chairs, the lip of the quay and a towel — and replaces everything that is
about LOOKING: the base mesh's own UV layout with a photographic skin on it,
a modelled hairstyle, and swimwear from the community packs, each fitted to
that body through its `.mhclo`. See tools/blender/baye2.py for the fit and
tools/wardrobe/assets.py for why the library beats generating any of this.

── three things this does differently from baye2.py, on purpose ─────────────

**The skeleton comes off THIS body.** `baye2.solve_weights` builds its rig from
`H.fetch()` — the neutral base — whatever body it is handed. That is harmless
for Chloe, whose morph is face targets only, and it would put an adult's
skeleton inside a 1.24 m girl. So the rig here is built from `read_joints` on
the bather's own OBJ, with `TARGET_H` set to their own height first, which is
exactly what `bathers_mh.one` does and why its clips land their feet.

**The body is decimated, with its UVs and weights carried through.** Baye is
looked at from thirty centimetres and ships the base mesh's 26 756 body
triangles. There are forty-eight of these on screen at once, so the body goes
down to `body_tris` — through Blender's collapse decimator on a mesh that
carries its UV layer and its bone weights as vertex groups, so both are
interpolated rather than guessed afterwards, and the seams are split only
AFTER the collapse so the decimator never sees a crack.

**Eyes and mouth are folded into the body's draw.** On Baye they are two parts
with two materials. Forty-eight figures times three is ninety-six draw calls
for shapes a few millimetres across, so here they ride in the body part and
say what they are through their UV: u in [2, 3) is an eyeball and u in [4, 5)
is teeth and tongue. The skin texture never samples there, and the body
shader in 43-jadrija.js branches on it.
"""

import json
import math
import os
import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Vector  # type: ignore
from mathutils.kdtree import KDTree  # type: ignore

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import human_mh as MH  # noqa: E402
import bathers_mh as BM  # noqa: E402
import mh_morph  # noqa: E402
import baye2 as B2  # noqa: E402

ROOT = HERE.parents[1]
PACKS = ROOT / 'build' / 'mh_assets'
BODIES = ROOT / 'build' / 'mh_bodies'
OUT = ROOT / 'build' / 'payload'
WEAR = json.loads((HERE / 'bathers_v2.json').read_text())
MAXI = 4

# Part names are the runtime's contract (41-skin.js hangs parts by name); the
# material ids are labels and nothing reads them.
MAT_BODY, MAT_HAIR, MAT_SUIT = 0, 3, 6
EYE_U, MOUTH_U = 2.5, 4.5


def find(name):
    """An asset's folder, following symlinks.

    `Path.rglob` does NOT follow symlinked directories, and a worktree that
    shares main's downloaded packs by symlink is exactly that — every asset
    in them simply is not found. `os.walk(followlinks=True)` is.
    """
    for root, dirs, _files in os.walk(PACKS, followlinks=True):
        if name in dirs:
            return Path(root) / name
    return None


def weights_of(v, gname, bindex):
    gs = sorted(((g.weight, bindex[gname[g.group]]) for g in v.groups
                 if g.group in gname and gname[g.group] in bindex and g.weight > 0),
                reverse=True)[:MAXI]
    if not gs:
        return (0, 0, 0, 0), (255, 0, 0, 0)
    tot = sum(w for w, _ in gs)
    q = [max(0, min(255, int(round(w / tot * 255)))) for w, _ in gs]
    # Exactly 255: the shader adds four bone matrices scaled by these and does
    # not renormalise.
    q[0] += 255 - sum(q)
    bi = [b for _, b in gs] + [0] * (MAXI - len(gs))
    q += [0] * (MAXI - len(q))
    return tuple(bi), tuple(q)


def mesh_from(label, pos, polys, uvs, wt=None, mats=None):
    """A Blender object: positions (Blender space), polygons, per-corner UVs,
    and optionally bone weights as vertex groups named b0..bN."""
    me = bpy.data.meshes.new(label)
    me.from_pydata([Vector(p) for p in pos], [], polys)
    me.update()
    uvl = me.uv_layers.new(name='UVMap')
    for poly, cuv in zip(me.polygons, uvs):
        for k, li in enumerate(poly.loop_indices):
            uvl.data[li].uv = cuv[k]
    ob = bpy.data.objects.new(label, me)
    bpy.context.collection.objects.link(ob)
    if mats:
        for i in range(max(mats) + 1):
            me.materials.append(bpy.data.materials.new('%s_m%d' % (label, i)))
        for poly, mi in zip(me.polygons, mats):
            poly.material_index = mi
    if wt:
        groups = {}
        for vi, (bi, bw) in wt.items():
            for b, w in zip(bi, bw):
                if w <= 0:
                    continue
                g = groups.get(b)
                if g is None:
                    g = groups[b] = ob.vertex_groups.new(name='b%d' % b)
                g.add([vi], w / 255.0, 'ADD')
    return ob


def collapse(ob, target):
    """Blender's collapse decimator, which interpolates UVs and vertex groups."""
    ob.data.calc_loop_triangles()
    have = len(ob.data.loop_triangles)
    if have <= target:
        return have, have
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    d = ob.modifiers.new('dec', 'DECIMATE')
    d.decimate_type = 'COLLAPSE'
    d.ratio = target / have
    d.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
    ob.data.calc_loop_triangles()
    return have, len(ob.data.loop_triangles)


def read_back(ob, bindex, keep_mats=None, uv_fix=None):
    """GPU vertices out of a Blender object: one per (vertex, uv) pairing,
    split only now, after anything that might have collapsed across a seam."""
    me = ob.data
    me.calc_loop_triangles()
    uvl = me.uv_layers.active
    gname = {g.index: int(g.name[1:]) for g in ob.vertex_groups}
    bidx = {b: b for b in range(len(bindex))}
    wcache, lookup, verts, tris = {}, {}, [], []
    for t in me.loop_triangles:
        if keep_mats is not None and me.polygons[t.polygon_index].material_index not in keep_mats:
            continue
        c = []
        for li in t.loops:
            vi = me.loops[li].vertex_index
            uv = tuple(uvl.data[li].uv)
            if uv_fix:
                uv = uv_fix(me.polygons[t.polygon_index].material_index, uv)
            key = (vi, round(uv[0], 5), round(uv[1], 5))
            j = lookup.get(key)
            if j is None:
                j = len(verts)
                lookup[key] = j
                if vi not in wcache:
                    wcache[vi] = weights_of(me.vertices[vi], gname, bidx)
                v = me.vertices[vi]
                verts.append((tuple(v.co), tuple(v.normal), uv, *wcache[vi]))
            c.append(j)
        tris.append(tuple(c))
    return verts, tris


def read_mhclo(path):
    """(scales, refs, weights, offsets) — `baye2.read_mhclo`, tolerant.

    The makehuman_system_assets pack writes its `material` and `z_depth`
    lines INSIDE the verts block, after `verts 0` and before the first row,
    and the stricter reader stops at the first line that is not a row — so
    every system hairstyle parsed to zero rows and failed the count check.
    Here a keyword line before the first row is skipped, and one after the
    rows have started still ends the block.
    """
    sc, refs, ws, offs, inv = {}, [], [], [], False
    for ln in path.read_text(errors='ignore').splitlines():
        w = ln.split()
        if not w or w[0].startswith('#'):
            continue
        if w[0] in ('x_scale', 'y_scale', 'z_scale'):
            sc[w[0][0]] = (int(w[1]), int(w[2]), float(w[3]))
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
                offs.append((float(w[6]), float(w[7]), float(w[8])))
            elif len(w) == 1:
                i = int(w[0])
                refs.append((i, i, i)); ws.append((1.0, 0.0, 0.0))
                offs.append((0.0, 0.0, 0.0))
            else:
                raise ValueError
        except ValueError:
            if refs:
                break
    return sc, refs, ws, offs


def asset(name):
    d = find(name)
    if d is None:
        sys.exit('[bathers2] no asset %s under %s — run tools/bathers_v2_tex.py' % (name, PACKS))
    objp = next(iter(sorted(d.glob('*.obj'))), None)
    mhclo = next(iter(sorted(d.glob('*.mhclo'))), None)
    if not (objp and mhclo):
        sys.exit('[bathers2] %s has no .obj/.mhclo' % name)
    return objp, mhclo


def garment(label, names, vs, wt, near, scale, drop, target, u_band=None):
    """Hair or swimwear: fitted to this body through each asset's .mhclo,
    weighted through the same rows, merged into one part, and decimated as a
    whole if it is over budget. `u_band` packs several assets into one
    texture atlas side by side: asset k gets u -> (u + k) / len(names)."""
    pos, polys, uvs, wmap = [], [], [], {}
    for k, name in enumerate(names):
        objp, mhclo = asset(name)
        avs, avts, afaces = B2.read_obj(objp)
        sc, refs, ws, offs = read_mhclo(mhclo)
        if len(refs) != len(avs):
            sys.exit('[bathers2] %s: %d mhclo rows vs %d obj verts'
                     % (name, len(refs), len(avs)))
        fitted = B2.fit_verts(sc, refs, ws, offs, vs)
        aw = B2.blend_weights(refs, ws, wt, near)
        base = len(pos)
        pos.extend(B2.game_space(p, scale, drop) for p in fitted)
        for i, w in enumerate(aw):
            wmap[base + i] = w
        n = len(names) if u_band else 1
        for grp in afaces.values():
            for f in grp:
                polys.append([base + vi for vi, _t in f])
                uvs.append([(((avts[t][0] if t >= 0 else 0.0) + (k if u_band else 0)) / n,
                             avts[t][1] if t >= 0 else 0.0) for _vi, t in f])
    ob = mesh_from(label, pos, polys, uvs, wmap)
    have, got = collapse(ob, target)
    return ob, have, got


def one(name, height, obj):
    spec = WEAR['bathers'][name]
    # Both are module globals and both are read at the moment they matter —
    # see `one` in bathers_mh.py, which sets them the same way.
    MH.TARGET_H = height
    bpy.ops.wm.read_factory_settings(use_empty=True)
    J, scale, drop = MH.read_joints(obj)
    vs, vts, faces = B2.read_obj(obj)
    print('[bathers2] %s  %.2f m  scale %.5f drop %.4f' % (name, height, scale, drop))

    # ── the body, eyes and mouth, as one object for the weight solve ───────
    PARTS = (('body', ('body',), 0),
             ('eyes', ('helper-l-eye', 'helper-r-eye'), 1),
             ('mouth', ('helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue'), 2))
    keep = sorted({vi for _n, groups, _m in PARTS for g in groups
                   for f in faces.get(g, []) for vi, _t in f})
    remap = {vi: i for i, vi in enumerate(keep)}
    polys, uvs, mats = [], [], []
    for _n, groups, mi in PARTS:
        for g in groups:
            for f in faces.get(g, []):
                polys.append([remap[vi] for vi, _t in f])
                if mi == 0:
                    uvs.append([vts[t] if t >= 0 else (0.0, 0.0) for _vi, t in f])
                else:
                    uvs.append([(EYE_U if mi == 1 else MOUTH_U, 0.5)] * len(f))
                mats.append(mi)
    body = mesh_from('human', [B2.game_space(vs[vi], scale, drop) for vi in keep],
                     polys, uvs, mats=mats)
    rig = MH.armature(J)
    MH.skin(body, rig)
    MH.pose(rig, {})
    rest = MH._rest_locals(rig)
    bindex = {n: i for i, (n, _p, _l, _g) in enumerate(rest)}
    gname = {g.index: g.name for g in body.vertex_groups}
    # Weights by FILE index, for the garments: an asset vertex rides a
    # triangle of base-mesh vertices numbered in the OBJ's own order.
    wt = {keep[v.index]: weights_of(v, gname, bindex) for v in body.data.vertices}
    # The fallback for a garment corner the solve never saw. It is not rare
    # here: the system hairstyles are fitted to `helper-hair`, the fitting
    # volume round the scalp that the figure does not carry, so every hair
    # vertex takes it. A KD-tree, because a list scan over fourteen thousand
    # vertices for each of ten thousand corners is minutes of Blender.
    ids = list(wt)
    kd = KDTree(len(ids))
    for k, i in enumerate(ids):
        kd.insert(Vector(B2.game_space(vs[i], scale, drop)), k)
    kd.balance()
    missed = [0]

    def near(vi):
        missed[0] += 1
        _co, k, _d = kd.find(Vector(B2.game_space(vs[vi], scale, drop)))
        return wt[ids[k]]

    # Bone weights as groups named by bone INDEX, so `read_back` can read them
    # off any object without knowing the rig.
    for g in list(body.vertex_groups):
        if g.name in bindex:
            g.name = 'b%d' % bindex[g.name]
        else:
            body.vertex_groups.remove(g)
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    body.parent = None

    # The shell alone gets decimated; the eyeballs and teeth are a few
    # hundred triangles of small closed shapes the collapse would eat.
    shell = body.copy()
    shell.data = body.data.copy()
    shell.name = 'shell'
    bpy.context.collection.objects.link(shell)
    bm = bmesh.new()
    bm.from_mesh(shell.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != 0],
                     context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(shell.data)
    bm.free()
    have, got = collapse(shell, WEAR['body_tris'])
    print('[bathers2]   body %d -> %d tris' % (have, got))
    bv, bt = read_back(shell, bindex)
    ev, et = read_back(body, bindex, keep_mats={1, 2})
    base = len(bv)
    buf = B2.Buf()
    buf.part('body', MAT_BODY, bv + ev, bt + [tuple(base + i for i in t) for t in et])

    # ── hair and swimwear, as ONE part ─────────────────────────────────────
    #
    # On Baye they would be two parts, and two parts is two draw calls. There
    # are forty-eight of these figures, so that was ninety-six extra calls on
    # the promenade — measured, 336 to 466 — for two materials that are the
    # same shader: double-sided, alpha-cut, dyed. So they share a part and an
    # atlas, hair in the first tile and the swimwear in the tiles after it,
    # and the shader picks the dye by which tile it is in. See `wear` in
    # src/42-bathers2.js.
    suit = [spec[k] for k in ('top', 'btm') if spec.get(k)]
    names = [spec['hair']] + suit
    wob, wh, wg = garment('wear', names, vs, wt, near, scale, drop,
                          WEAR['hair_tris'] + WEAR['suit_tris'], u_band=True)
    print('[bathers2]   wear %s %d -> %d tris' % ('+'.join(names), wh, wg))
    wv, wtr = read_back(wob, bindex)
    buf.part('wear', MAT_HAIR, wv, wtr)
    print('[bathers2]   %d garment corners fell back to the nearest weighted vertex'
          % missed[0])

    # ── the same clips bathers_mh.py bakes for this body ───────────────────
    clips = ([BM._stand_clip(c, BM.STAND_CLIPS[c['name']])
              if c['name'] in BM.STAND_CLIPS else c
              for c in BM.BATHER_CLIPS] + BM.sit_clips(rig, J)
             + BM.quay_clips(rig, J) + BM.lie_clips(rig, J))
    # The floor passes `export_skin` runs, in its order, for the reason it
    # gives: several clip lists are empty until they have, and the walk's hip
    # heights are solved on this skeleton by `walk_floor`.
    MH.pose(rig, {})
    MH.wheel_floor(rig)
    MH.dance_floor(rig)
    MH.skip_floor(rig)
    MH.walk_floor(rig)
    MH.fire_floor(rig)
    MH.ballet_floor(rig)
    MH.wine_floor(rig)
    MH.pose(rig, {})
    baked = [MH._bake_clip(rest, c) for c in clips]
    out = OUT / ('bather2_%s.fr3d.gz' % name)
    B2.write_blob(buf, rest, baked, out, 'bathers2')
    return out


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = argv[argv.index('--only') + 1] if '--only' in argv else None
    for name, height, _recipe in mh_morph.BATHERS:
        if only and name != only:
            continue
        obj = BODIES / ('mh_%s.obj' % name)
        if not obj.exists():
            print('[bathers2] no %s — run tools/blender/mh_morph.py first' % obj)
            continue
        one(name, height, obj)


if __name__ == '__main__':
    main()
