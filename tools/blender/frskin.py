"""Skinned .fr3d **v4** export: a skeleton, bone weights, and baked clips.

Runs inside Blender. `frmesh.py` writes the rigid formats — v1 (one frozen
pose) and v2 (a tree of pivots with rigid pieces hanging off it) — and this
writes the third: one mesh, four bone influences a vertex, blended in the vertex
shader. `src/41-skin.js` reads what comes out.

── what the format can and cannot carry ──────────────────────────────────────

A clip frame is **one quaternion per bone, plus one translation for the root**.
That is the whole of it. There is no scale and no per-bone translation, because
the runtime composes the hierarchy with `qmul`/`qrotv` on flat Float32Arrays and
a full matrix per bone would be three times the uniform budget for something no
clip here has ever needed.

This is a real constraint and it fails *quietly* — a bone that translates in an
authored action simply arrives at its rest offset instead, and the result is a
limb that looks subtly disconnected rather than obviously broken. So
`bake_action` measures it and says so, rather than leaving it to be noticed.

── on the duplication with human_mh.py ───────────────────────────────────────

`human_mh.py` has its own copies of `rest_locals`, `quant_q` and the blob
writer, and its own `_bake_clip`, and they are not imported from here. That is
deliberate for now and should not last.

The reason is that the two bake *different things*. Hers samples authored pose
dictionaries — `{bone: (rx, ry, rz)}` in degrees, keyed and smoothstepped —
because every clip she has was written by hand in that file. `bake_action` here
samples a Blender action off the armature, because the dog arrives with his
already made. They share the quantisation and the blob layout and nothing else.

What should happen is that this module grows `bake_poses` as well, hers calls
it, and her copies go. The check that it worked is cheap and exact:
`human_skin.fr3d.gz` is byte-identical before and after, because the build is
deterministic. Doing it in the same change that first rigs the dog would mean
touching a working 4 700-line figure to prove out a feature that is not proven
yet, so it waits for the dog to stand up first.
"""

from __future__ import annotations

import gzip
import struct
from pathlib import Path

import bpy  # type: ignore
from mathutils import Matrix, Quaternion  # type: ignore

# Blender is Z-up, three.js is Y-up: (bx, by, bz) -> (bx, bz, -by). The same
# conversion frmesh.py's docstring names, as a matrix, because a skeleton has to
# convert whole transforms and not just points.
CONV = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
CONV_I = CONV.inverted()

MAX_INFLUENCES = 4        # four bones a vertex; the shader adds exactly four
SAMPLE_FPS = 30           # clips are baked, not solved, so this is the quality


def rest_locals(rig):
    """[(name, parent index, parent-relative rest matrix in Blender, in game)].

    Ordered parents-before-children, because the runtime composes the hierarchy
    in a single forward pass over this list and never sorts anything.

    The armature is read in its own object space, so it has to have unit scale
    and no rotation of its own by the time this runs — see `bake_object` in
    dog.py for why that is baked into the bone data rather than left on the
    object. A rig with a scale on the object writes a skeleton whose root wants
    to carry that scale, and the format has nowhere to put it.
    """
    order, seen = [], set()

    def visit(b):
        if b.name in seen:
            return
        if b.parent:
            visit(b.parent)
        seen.add(b.name)
        order.append(b)

    for b in rig.data.bones:
        visit(b)

    index = {b.name: i for i, b in enumerate(order)}
    out = []
    for b in order:
        local = (b.parent.matrix_local.inverted() @ b.matrix_local
                 if b.parent else b.matrix_local.copy())
        out.append((b.name, index[b.parent.name] if b.parent else -1,
                    local, CONV @ local @ CONV_I))
    return out


def quant_q(q):
    """(x, y, z, w) as four int16. Blender hands them back w-first."""
    return tuple(max(-32767, min(32767, int(round(a * 32767))))
                 for a in (q.x, q.y, q.z, q.w))


def bake_action(rig, action, name, loop=True, fps=SAMPLE_FPS, rest=None,
                frames=None, slack=1e-4):
    """Sample a Blender action into the clip format.

    `frames` is (first, last) in the action's own frame numbers; the action's
    range is used if it is None. A looping clip drops the last frame, because
    the first and last frame of a cycle are the same pose and keeping both puts
    a stutter of one frame's length at the seam.

    What is sampled is `pose.bones[].matrix`, which is the bone in **armature
    space with everything already applied** — constraints, drivers, inherited
    parent motion, the lot. Reading the f-curves instead would mean reproducing
    Blender's evaluation order, and getting it subtly wrong on a rig somebody
    else authored is the obvious way to spend a day.

    `slack` is how much per-bone translation is tolerated before it is reported.
    See the module docstring: the format cannot carry it, so the only honest
    thing is to measure how much is being dropped and print it.
    """
    scene = bpy.context.scene
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = action

    f0, f1 = frames if frames else (int(action.frame_range[0]),
                                    int(action.frame_range[1]))
    n = int(round((f1 - f0) * fps / scene.render.fps))
    nf = max(2, n if loop else n + 1)
    dur = (f1 - f0) / scene.render.fps

    order = [b[0] for b in (rest if rest else rest_locals(rig))]
    root = order[0]
    out, prev_q, drift = [], {}, {}

    for f in range(nf):
        # Sub-frame, because the sample rate and the action's own frame rate are
        # not the same number and rounding to whole frames would quantise a
        # 5 s clip on to whichever of its keys happened to land nearby.
        at = f0 + (f1 - f0) * (f / nf if loop else f / (nf - 1))
        scene.frame_set(int(at), subframe=at - int(at))
        quats = []
        for bi, bname in enumerate(order):
            pb = rig.pose.bones[bname]
            m = pb.matrix if pb.parent is None else \
                pb.parent.matrix.inverted() @ pb.matrix
            m = CONV @ m @ CONV_I
            q = m.to_quaternion()
            # Keep the sign continuous along the track. The runtime nlerps
            # between adjacent frames, and a quaternion that flips sign between
            # two frames of a smooth motion takes the short way round the wrong
            # side of the sphere — one frame of the animal inside out.
            p = prev_q.get(bi)
            if p and q.dot(p) < 0.0:
                q = Quaternion((-q.w, -q.x, -q.y, -q.z))
            prev_q[bi] = q
            quats.append(quant_q(q))
            if bname != root:
                d = (m.to_translation()
                     - (CONV @ rest_local_of(rig, bname) @ CONV_I).to_translation())
                drift[bname] = max(drift.get(bname, 0.0), d.length)
        rt = (CONV @ rig.pose.bones[root].matrix).to_translation()
        out.append(((rt.x, rt.y, rt.z), quats))

    lost = {k: v for k, v in drift.items() if v > slack}
    if lost:
        worst = sorted(lost.items(), key=lambda kv: -kv[1])[:4]
        print("[skin]   %s: DROPPED translation on %d bone(s), worst %s"
              % (name, len(lost),
                 ", ".join("%s %.1f mm" % (k, v * 1000) for k, v in worst)))
    return {"name": name, "dur": dur, "loop": loop, "frames": out}


def rest_local_of(rig, bname):
    """One bone's parent-relative rest matrix, in Blender space."""
    b = rig.data.bones[bname]
    return (b.parent.matrix_local.inverted() @ b.matrix_local
            if b.parent else b.matrix_local.copy())


def write_skin(path: Path, pos, nrm, cols, bidx, bwgt, idx, rest, baked,
               shed=0, note=""):
    """Write the v4 blob: mesh, skeleton, clips.

    Fixed-size arrays first and the variable-length tables last, so the loader
    can take views straight on to the decompressed buffer for everything large
    and only walk the last few kilobytes with a DataView.

    `shed` is how many triangles at the **tail** of the index buffer are
    removable — the figure's hip wrap, and nothing on the dog. It is a header
    field rather than a table of named parts because there is exactly one
    removable thing in this game and a general mechanism would be more format
    than the feature deserves.
    """
    nv, ni = len(pos) // 3, len(idx)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    parts = [struct.pack("<4sIII6fI", b"FR3D", 4, nv, ni,
                         min(xs), min(ys), min(zs), max(xs), max(ys), max(zs),
                         shed * 3),
             struct.pack("<%df" % (nv * 3), *pos),
             struct.pack("<%df" % (nv * 3), *nrm),
             bytes(cols), bytes(bidx), bytes(bwgt)]
    # Pad so the index array lands 4-byte aligned and the loader can take a
    # view on it rather than copying half a megabyte.
    parts.append(b"\0" * ((-sum(len(p) for p in parts)) % 4))
    parts.append(struct.pack("<%dI" % ni, *idx))

    parts.append(struct.pack("<I", len(rest)))
    for name, parent, _local_b, local_g in rest:
        nb = name.encode()
        t = local_g.translation
        q = local_g.to_quaternion()
        parts.append(struct.pack("<H%dsi7f" % len(nb), len(nb), nb, parent,
                                 t.x, t.y, t.z, q.x, q.y, q.z, q.w))

    parts.append(struct.pack("<I", len(baked)))
    for c in baked:
        nb = c["name"].encode()
        parts.append(struct.pack("<H%dsfIB3x" % len(nb), len(nb), nb,
                                 c["dur"], len(c["frames"]), 1 if c["loop"] else 0))
        for rt, quats in c["frames"]:
            parts.append(struct.pack("<3f", *rt))
            for q in quats:
                parts.append(struct.pack("<4h", *q))

    blob = b"".join(parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(blob)
    print("[skin] %s  %d verts  %d tris  %d bones  %d clips  %d bytes gz  %s"
          % (path.name, nv, ni // 3, len(rest), len(baked),
             path.stat().st_size, note))
    for c in baked:
        print("[skin]   clip %-9s %5.2f s  %3d frames  %s"
              % (c["name"], c["dur"], len(c["frames"]),
                 "loop" if c["loop"] else "once"))
