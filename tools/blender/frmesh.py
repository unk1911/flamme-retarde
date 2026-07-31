"""Shared modelling helpers and the .fr3d writer.

Runs inside Blender (``blender --background --python ...``). Everything is
built with bmesh rather than bpy.ops so it behaves the same headless as it does
in the UI, and every landmark is left in the .blend afterwards so it can be
opened and pushed around by hand.

Blender is Z-up, three.js is Y-up. The conversion happens once, on export:
    (bx, by, bz)  ->  (bx, bz, -by)
"""

from __future__ import annotations

import gzip
import math
import struct
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Vector  # type: ignore

TAU = math.pi * 2

# The palette. Landmarks are stone, and Šibenik stone is a very particular
# warm white — the whole town is quarried out of the same island.
STONE = (0.78, 0.74, 0.66)
STONE_DARK = (0.62, 0.58, 0.51)
LEAD = (0.44, 0.46, 0.47)          # the barrel roof slabs, weathered grey
TILE = (0.66, 0.31, 0.19)          # kupa kanalica, the red pantile
WHITE = (0.90, 0.89, 0.86)
TRIM = (0.13, 0.30, 0.20)          # the green shutters of every keeper's house
DARKMETAL = (0.11, 0.12, 0.13)
GOLD = (0.78, 0.62, 0.24)
GLASS = (0.34, 0.44, 0.48)
CONCRETE = (0.70, 0.69, 0.66)     # 1960s in-situ concrete, weathered pale
ASPHALT = (0.16, 0.16, 0.17)


# --------------------------------------------------------------------- scene --

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_object(bm: "bmesh.types.BMesh", name: str, smooth=False, recalc=True):
    if recalc:
        # Winding by hand across a dozen primitives is a losing game; let
        # Blender work out which way is out. Without this the domes render
        # inside-out and read as solid black.
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def bevel(ob, width=0.06, segments=1, angle=40.0):
    """The single most valuable thing Blender gives us here: a catch-light on
    every stone edge, which is what stops a box reading as a box."""
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return m


# ------------------------------------------------------------------ primitives --

def bm_box(bm, cx, cy, cz, sx, sy, sz):
    """Axis-aligned box by centre and full size."""
    ret = bmesh.ops.create_cube(bm, size=1.0)
    verts = ret["verts"]
    bmesh.ops.scale(bm, vec=Vector((sx, sy, sz)), verts=verts)
    bmesh.ops.translate(bm, vec=Vector((cx, cy, cz)), verts=verts)
    return verts


def bm_prism(bm, poly, z0, z1):
    """Extrude a closed 2-D polygon (list of (x, y)) between two heights."""
    n = len(poly)
    bottom = [bm.verts.new((x, y, z0)) for x, y in poly]
    top = [bm.verts.new((x, y, z1)) for x, y in poly]
    bm.verts.ensure_lookup_table()
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    bm.faces.new(tuple(reversed(bottom)))
    bm.faces.new(tuple(top))
    return bottom + top


def bm_cylinder(bm, cx, cy, z0, z1, r_bot, r_top, seg=16, caps=True):
    ret = bmesh.ops.create_cone(
        bm, cap_ends=caps, cap_tris=False, segments=seg,
        radius1=r_bot, radius2=r_top, depth=(z1 - z0))
    verts = ret["verts"]
    bmesh.ops.translate(bm, vec=Vector((cx, cy, (z0 + z1) * 0.5)), verts=verts)
    return verts


def bm_barrel(bm, x0, x1, cy, cz, r, seg=12, half=True, closed_ends=True):
    """A barrel vault: a half-cylinder lying along X. The roof of St James is
    literally this, in interlocking stone slabs, and it is the reason the
    building has no timber in it at all."""
    span = math.pi if half else TAU
    rows = []
    for x in (x0, x1):
        ring = []
        for i in range(seg + 1):
            a = -span * 0.5 + span * i / seg
            ring.append(bm.verts.new((x, cy + math.sin(a) * r, cz + math.cos(a) * r)))
        rows.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
    if closed_ends:
        for row, flip in ((rows[0], True), (rows[1], False)):
            base_a = bm.verts.new((row[0].co.x, cy - r, cz))
            base_b = bm.verts.new((row[0].co.x, cy + r, cz))
            fan = [base_a] + list(row) + [base_b]
            f = bm.faces.new(tuple(reversed(fan)) if flip else tuple(fan))
            f.normal_update()
    return rows


def bm_dome(bm, cx, cy, cz, r, rows=6, seg=12, squash=1.0):
    """Hemisphere, rows of quads, capped with a fan."""
    grid = []
    for j in range(rows):
        t = j / rows * (math.pi * 0.5)
        rr, zz = math.cos(t) * r, math.sin(t) * r * squash
        ring = [bm.verts.new((cx + math.cos(TAU * i / seg) * rr,
                              cy + math.sin(TAU * i / seg) * rr, cz + zz))
                for i in range(seg)]
        grid.append(ring)
    apex = bm.verts.new((cx, cy, cz + r * squash))
    bm.verts.ensure_lookup_table()
    for j in range(rows - 1):
        for i in range(seg):
            k = (i + 1) % seg
            bm.faces.new((grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]))
    for i in range(seg):
        bm.faces.new((grid[-1][i], grid[-1][(i + 1) % seg], apex))
    return grid


def bm_hip_roof(bm, cx, cy, cz, sx, sy, h, overhang=0.4, ridge=0.45):
    """A hipped pantile roof: the shape on top of every house in Dalmatia."""
    ax, ay = sx * 0.5 + overhang, sy * 0.5 + overhang
    rx = sx * 0.5 * ridge
    v = [bm.verts.new(p) for p in (
        (cx - ax, cy - ay, cz), (cx + ax, cy - ay, cz),
        (cx + ax, cy + ay, cz), (cx - ax, cy + ay, cz),
        (cx - rx, cy, cz + h), (cx + rx, cy, cz + h))]
    bm.verts.ensure_lookup_table()
    bm.faces.new((v[0], v[1], v[5], v[4]))
    bm.faces.new((v[2], v[3], v[4], v[5]))
    bm.faces.new((v[1], v[2], v[5]))
    bm.faces.new((v[3], v[0], v[4]))
    bm.faces.new((v[3], v[2], v[1], v[0]))
    return v


def bm_arc_wall(bm, cx, cy, cz, r, thick, seg=14, span=math.pi, swap=False):
    """A semicircular gable slab standing in the XZ plane. Three of these, one
    big and two small, are the trefoil front of St James — the silhouette the
    whole building is known by."""
    # swap=False: the arc spans X and the slab is thick in Y (a west front).
    # swap=True:  the arc spans Y and the slab is thick in X (a transept end).
    def V(along, across, z):
        return ((cx + across, cy + along, z) if swap else (cx + along, cy + across, z))

    outer, inner = [], []
    for i in range(seg + 1):
        a = -span * 0.5 + span * i / seg
        px, pz = math.sin(a) * r, math.cos(a) * r
        outer.append(bm.verts.new(V(px, -thick * 0.5, cz + pz)))
        inner.append(bm.verts.new(V(px, thick * 0.5, cz + pz)))
    b0 = bm.verts.new(V(-r, -thick * 0.5, cz))
    b1 = bm.verts.new(V(r, -thick * 0.5, cz))
    b2 = bm.verts.new(V(r, thick * 0.5, cz))
    b3 = bm.verts.new(V(-r, thick * 0.5, cz))
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        bm.faces.new((outer[i], outer[i + 1], inner[i + 1], inner[i]))
    bm.faces.new(tuple(reversed([b0] + outer + [b1])))
    bm.faces.new(tuple([b3] + inner + [b2]))
    bm.faces.new((b0, b1, b2, b3))
    return outer


def _ring_pts(rx, ry, seg, power=2.0):
    """One closed ring of a superellipse. power=2 is a true ellipse; 4 is a
    rounded rectangle, which is what a shoulder, a boot or a chest actually is
    and what a plain cylinder can never look like."""
    pts = []
    e = 2.0 / power
    for i in range(seg):
        a = TAU * i / seg
        c, s = math.cos(a), math.sin(a)
        if power == 2.0:
            pts.append((c * rx, s * ry))
        else:
            pts.append((math.copysign(abs(c) ** e, c) * rx,
                        math.copysign(abs(s) ** e, s) * ry))
    return pts


def bm_loft(bm, rings, seg=14, caps=True, power=2.0):
    """Skin a stack of superelliptical rings along Z.

    ``rings`` is ``[(z, rx, ry[, ox, oy]), ...]`` bottom to top: half-widths in
    X and Y and an optional centre offset, so a limb can drift and swell along
    its length instead of being a tube of constant section. This is the whole
    modelling vocabulary of the figure — an arm is five rings, a boot is four.
    """
    grid = []
    for r in rings:
        z, rx, ry = r[0], r[1], r[2]
        ox = r[3] if len(r) > 3 else 0.0
        oy = r[4] if len(r) > 4 else 0.0
        grid.append([bm.verts.new((ox + px, oy + py, z))
                     for px, py in _ring_pts(rx, ry, seg, power)])
    bm.verts.ensure_lookup_table()
    for j in range(len(grid) - 1):
        for i in range(seg):
            k = (i + 1) % seg
            bm.faces.new((grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]))
    if caps:
        bm.faces.new(tuple(reversed(grid[0])))
        bm.faces.new(tuple(grid[-1]))
    return grid


def bm_ball(bm, cx, cy, cz, rx, ry, rz, rows=7, seg=14, squash_bottom=1.0):
    """An ellipsoid. `squash_bottom` flattens the lower half — a skull is not a
    sphere, and neither is a shoulder."""
    grid = []
    for j in range(1, rows):
        t = -math.pi * 0.5 + math.pi * j / rows
        rr, zz = math.cos(t), math.sin(t)
        z = cz + zz * rz * (squash_bottom if zz < 0 else 1.0)
        grid.append([bm.verts.new((cx + math.cos(TAU * i / seg) * rr * rx,
                                   cy + math.sin(TAU * i / seg) * rr * ry, z))
                     for i in range(seg)])
    bot = bm.verts.new((cx, cy, cz - rz * squash_bottom))
    top = bm.verts.new((cx, cy, cz + rz))
    bm.verts.ensure_lookup_table()
    for j in range(len(grid) - 1):
        for i in range(seg):
            k = (i + 1) % seg
            bm.faces.new((grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]))
    for i in range(seg):
        k = (i + 1) % seg
        bm.faces.new((bot, grid[0][k], grid[0][i]))
        bm.faces.new((top, grid[-1][i], grid[-1][k]))
    return grid


def bm_ring(bm, cx, cy, cz, r_in, r_out, thick, seg=20, plane="xz"):
    """A flat annulus — a rose window surround, or a lantern gallery."""
    inner_f, outer_f, inner_b, outer_b = [], [], [], []
    for i in range(seg):
        a = TAU * i / seg
        c, s = math.cos(a), math.sin(a)
        for r, fl, bl in ((r_in, inner_f, inner_b), (r_out, outer_f, outer_b)):
            if plane == "xz":
                fl.append(bm.verts.new((cx + c * r, cy - thick * 0.5, cz + s * r)))
                bl.append(bm.verts.new((cx + c * r, cy + thick * 0.5, cz + s * r)))
            else:
                fl.append(bm.verts.new((cx + c * r, cy + s * r, cz - thick * 0.5)))
                bl.append(bm.verts.new((cx + c * r, cy + s * r, cz + thick * 0.5)))
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        k = (i + 1) % seg
        bm.faces.new((inner_f[i], outer_f[i], outer_f[k], inner_f[k]))
        bm.faces.new((inner_b[k], outer_b[k], outer_b[i], inner_b[i]))
        bm.faces.new((outer_f[i], outer_b[i], outer_b[k], outer_f[k]))
        bm.faces.new((inner_f[k], inner_b[k], inner_b[i], inner_f[i]))


# ------------------------------------------------------------------- exporting --

MAGIC = b"FR3D"


def gather(items, origin=(0.0, 0.0, 0.0), base=0):
    """[(object, colour), ...] -> (pos, nrm, col, idx) in three.js axes.

    Modifiers are evaluated first, so the bevels are baked in. Vertices are
    emitted per triangle corner and then deduplicated on (position, normal,
    colour), which keeps hard stone edges hard without exporting a seam
    attribute nobody would read.

    `origin` is a Blender-space point moved to (0,0,0) on the way out — for a
    rigged part that is its pivot, so the runtime can rotate the piece about a
    joint by setting a rotation on the Group holding it. `base` is added to
    every emitted index, for callers concatenating several parts into one array.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    pos, nrm, col, idx = [], [], [], []
    lookup = {}
    ox, oy, oz = origin

    for ob, colour in items:
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        try:
            me.calc_normals_split()
            split = True
        except (AttributeError, RuntimeError):
            split = False
        mw = ob.matrix_world
        nm = mw.to_3x3().inverted_safe().transposed()
        c8 = tuple(min(255, max(0, int(v * 255 + 0.5))) for v in colour)

        for tri in me.loop_triangles:
            for k in range(3):
                li = tri.loops[k]
                vi = tri.vertices[k]
                co = mw @ me.vertices[vi].co
                cx, cy, cz = co.x - ox, co.y - oy, co.z - oz
                n = (nm @ (me.loops[li].normal if split
                           else me.vertices[vi].normal)).normalized()
                # Blender Z-up -> three.js Y-up.
                key = (round(cx, 4), round(cz, 4), round(-cy, 4),
                       round(n.x, 3), round(n.z, 3), round(-n.y, 3), c8)
                j = lookup.get(key)
                if j is None:
                    j = len(pos) // 3
                    lookup[key] = j
                    pos.extend((cx, cz, -cy))
                    nrm.extend((n.x, n.z, -n.y))
                    col.extend(c8)
                idx.append(j + base)
        ob.evaluated_get(dg).to_mesh_clear()

    return pos, nrm, col, idx


def _write(path: Path, blob: bytes, ni: int, nv: int, note: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(blob, 9))
    print("  %-18s %6d tris  %6d verts  %5.0f KB  %s"
          % (path.name, ni // 3, nv, len(path.read_bytes()) / 1024, note))


def export(parts, path: Path, note=""):
    """Write [(object, colour), ...] as one gzipped .fr3d v1 blob."""
    pos, nrm, col, idx = gather(parts)
    nv, ni = len(pos) // 3, len(idx)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    head = struct.pack(
        "<4sIII6f", MAGIC, 1, nv, ni,
        min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))
    blob = (head
            + struct.pack("<%df" % (nv * 3), *pos)
            + struct.pack("<%df" % (nv * 3), *nrm)
            + bytes(col)
            + struct.pack("<%dI" % ni, *idx))
    _write(path, blob, ni, nv, note)


def export_rig(parts, path: Path, note=""):
    """Write an articulated model as one gzipped .fr3d **v2** blob.

    `parts` is a list of dicts, parents before children::

        {"name": "armLU", "parent": "torso", "pivot": (0, 0.20, 1.42),
         "items": [(object, colour), ...]}

    Each part's geometry is baked relative to its own pivot and the pivot is
    stored relative to its parent's, so the runtime hangs the whole figure off a
    tree of Groups and animates it by setting eleven rotations. That is a
    skeleton without a skinning solver, which is the right trade here: somebody
    in heavy kit *does* read as rigid pieces, and it costs a thirty-line reader
    instead of a glTF parser and a skinned-mesh path.

    Vertices and indices for a part are contiguous, and indices are rebased to
    the part's own block, so the reader can hand each piece a BufferAttribute
    that is a view on the shared arrays rather than a copy.
    """
    names = [p["name"] for p in parts]
    pos, nrm, col, idx, table = [], [], [], [], []

    for p in parts:
        parent = names.index(p["parent"]) if p.get("parent") else -1
        if parent >= len(table):
            raise ValueError("%s: parent %s must be declared first"
                             % (p["name"], p["parent"]))
        v0, i0 = len(pos) // 3, len(idx)
        ppos, pnrm, pcol, pidx = gather(p["items"], origin=p["pivot"])
        pos += ppos
        nrm += pnrm
        col += pcol
        idx += pidx
        # Pivot relative to the parent, converted the same way the vertices are.
        px, py, pz = p["pivot"]
        if parent >= 0:
            qx, qy, qz = parts[parent]["pivot"]
            px, py, pz = px - qx, py - qy, pz - qz
        table.append((p["name"], parent, (px, pz, -py),
                      v0, len(pos) // 3 - v0, i0, len(idx) - i0))

    nv, ni = len(pos) // 3, len(idx)
    # The bind-pose bounding box, in model space: every part's block is relative
    # to its own pivot, so this has to be reassembled rather than read off pos.
    lo = [1e9] * 3
    hi = [-1e9] * 3
    world = []
    for k, (name, parent, piv, v0, vn, _i0, _ic) in enumerate(table):
        base = world[parent] if parent >= 0 else (0.0, 0.0, 0.0)
        here = (base[0] + piv[0], base[1] + piv[1], base[2] + piv[2])
        world.append(here)
        for v in range(v0, v0 + vn):
            for a in range(3):
                w = pos[v * 3 + a] + here[a]
                lo[a] = min(lo[a], w)
                hi[a] = max(hi[a], w)

    head = struct.pack("<4sIII6f", MAGIC, 2, nv, ni, *lo, *hi)
    head += struct.pack("<I", len(table))
    for name, parent, piv, v0, vn, i0, ic in table:
        nb = name.encode()
        head += struct.pack("<H", len(nb)) + nb
        head += struct.pack("<i3f4I", parent, piv[0], piv[1], piv[2], v0, vn, i0, ic)

    blob = (head
            + struct.pack("<%df" % (nv * 3), *pos)
            + struct.pack("<%df" % (nv * 3), *nrm)
            + bytes(col)
            + struct.pack("<%dI" % ni, *idx))
    _write(path, blob, ni, nv, "%s, %d parts" % (note, len(table)))
