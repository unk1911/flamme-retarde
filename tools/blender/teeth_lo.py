#!/usr/bin/env python3
"""The bathers' teeth, gums and tongue at a crowd's budget.

    blender -b -noaudio -P tools/blender/teeth_lo.py

Writes tools/face/mouth_lo.obj, which tools/face_parts.py fits into every
bather's mouth (1.551.1). Run once; the file is committed.

MakeHuman's `teeth_base` (32 teeth of 56 quads each, and 1 768 quads of gum)
and `tongue01` (224 quads), from makehuman_system_assets — CC0 (Data
Collection AB, Joel Palmius, Jonas Hauquier; see tools/bathers_v2_CREDITS.md)
— are 7 600 triangles, as much as the rest of a bather. Forty of them on a
promenade do not need the molars nobody sees or a gum modelled to the last
papilla, so:

  - the teeth in front of `Z_KEEP` only — incisors, canines and the first
    premolars, ten a jaw; everything behind is dark in any mouth;
  - each tooth collapsed to `TOOTH_TRIS`, which keeps a crown's taper and
    the gap to the next one;
  - the gum cut behind `GUM_Z` and collapsed to `GUM_TRIS`;
  - the tongue collapsed to `TONGUE_TRIS`.

Positions are written in each asset's OWN space (the .obj's, not fitted):
face_parts.py binds each vertex to the nearest triangle of the full asset,
which the asset's `.mhclo` fits to each body. Groups `tooth`, `gum`,
`tongue`, in that order, one `o` each; faces are triangles.
"""

import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "tools" / "face" / "mouth_lo.obj"


def assets():
    for r in (ROOT, ROOT.parents[2] if ROOT.parent.name == "worktrees" else None):
        if r and (r / "build" / "mh_assets").is_dir():
            return r / "build" / "mh_assets" / "makehuman_system_assets"
    sys.exit("[teeth] no build/mh_assets")


Z_KEEP = 1.12          # teeth whose centre is in front of this (the asset's z)
GUM_Z = 1.0            # gum quads with every corner behind this go
TOOTH_TRIS = 22
GUM_TRIS = 260
TONGUE_TRIS = 150


def read_obj(path):
    vs, fs = [], []
    for ln in open(path):
        if ln.startswith("v "):
            vs.append(tuple(float(x) for x in ln.split()[1:4]))
        elif ln.startswith("f "):
            fs.append([int(t.split("/")[0]) - 1 for t in ln.split()[1:]])
    return vs, fs


def components(fs):
    parent = {}

    def find(a):
        parent.setdefault(a, a)
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for f in fs:
        for v in f[1:]:
            ra, rb = find(f[0]), find(v)
            if ra != rb:
                parent[ra] = rb
    out = {}
    for f in fs:
        out.setdefault(find(f[0]), []).append(f)
    return list(out.values())


def lowered(label, vs, fs, tris):
    """A mesh of these faces, collapsed to about `tris` triangles and
    triangulated: (positions, triangles)."""
    used = sorted({v for f in fs for v in f})
    at = {v: i for i, v in enumerate(used)}
    me = bpy.data.meshes.new(label)
    me.from_pydata([vs[v] for v in used], [], [[at[v] for v in f] for f in fs])
    ob = bpy.data.objects.new(label, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    have = len(me.polygons)
    if have > tris:
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        d = ob.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = tris / have
        d.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="dec")
    me = ob.data
    return [tuple(v.co) for v in me.vertices], [tuple(p.vertices) for p in me.polygons]


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    A = assets()
    tv, tf = read_obj(A / "teeth" / "teeth_base" / "teeth_base.obj")
    groups = {"tooth": [], "gum": [], "tongue": []}
    for comp in components(tf):
        vi = sorted({v for f in comp for v in f})
        cz = sum(tv[v][2] for v in vi) / len(vi)
        if len(comp) > 500:                              # the gum, both jaws
            keep = [f for f in comp if max(tv[v][2] for v in f) >= GUM_Z]
            groups["gum"].append(lowered("gum", tv, keep, GUM_TRIS))
        elif cz > Z_KEEP:
            groups["tooth"].append(lowered("tooth", tv, comp, TOOTH_TRIS))
    gv, gf = read_obj(A / "tongue" / "tongue01" / "tongue01.obj")
    groups["tongue"].append(lowered("tongue", gv, gf, TONGUE_TRIS))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# The bathers' teeth, gums and tongue: MakeHuman's teeth_base and",
             "# tongue01 (CC0), cut and collapsed by tools/blender/teeth_lo.py.",
             "# Positions in each asset's own space; see tools/face_parts.py."]
    base = 0
    n = {}
    for g, parts in groups.items():
        lines.append("o %s" % g)
        for vs, fs in parts:
            lines += ["v %.6f %.6f %.6f" % v for v in vs]
            lines += ["f %d %d %d" % tuple(base + i + 1 for i in f) for f in fs]
            base += len(vs)
            n[g] = n.get(g, 0) + len(fs)
    OUT.write_text("\n".join(lines) + "\n")
    print("[teeth] %s: %s tris" % (OUT, n))


main()
