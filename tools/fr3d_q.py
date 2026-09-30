#!/usr/bin/env python3
"""
Rewrite the float .fr3d blobs in build/payload as packed ones, in place: v1
and v3 as v7, the skins v4 and v5 as v8 and v9, the crowd's v6 as v10 and the
rigs' v2 as v11.

Misha, 29 Sep 2026, at a 51.4 MB page: "is there anything in there that can be
trimmed?" The vikendica shell was the largest single model in the payload —
2.37 MB of gzip, 3.1 MB of html — and it was v1: three float32s a position and
three a normal, whose low mantissa bytes are noise gzip cannot touch. The cars'
far tier and the five landmarks were the same.

QUANTISING ALONE WAS NOT THE ANSWER, and that was measured, not assumed. v3
(`export_q` in tools/blender/frmesh.py) took the shell from 2 365 KB to 1 888:
the positions were 1 006 KB of it and the INDEX was 825 — 659 562 uint32s,
which gzip reads as four bytes of noise each. It is not noise. The exporter
writes vertices in the order the triangles use them, so the index is almost
always the last one plus one: stored as that difference it is 16 KB. And the
positions, stored as the step from the vertex before along each axis with the
low bytes and the high bytes in separate runs, are 356 KB instead of 1 006.
Neither costs a single bit of precision — they are the same uint16s and the
same indices, laid out so that gzip can see what they are.

v7 IS v3, REARRANGED. The same 40-byte header (lo and hi still bound the
uint16 positions), then, each in its own run:
  positions  per axis: nv zigzag uint16 deltas from the vertex before (mod
             65 536), as nv low bytes then nv high bytes;
  normals    per axis: nv int8s;
  colours    per channel: nv uint8s;
  index      ni zigzag uint32 deltas from the index before (mod 2^32), as four
             runs of ni bytes, lowest first.
`readFR3Dp` in src/48-landmarks.js undoes it into the floats every other
version ends as, so nothing downstream of the reader knows.

What quantising costs, measured on the widest of them: the Šibenik bridge is
390 m long, and 390 / 65 535 is a 6 mm step, seen from a Canadair. The
vikendica shell is 18.8 m, a 0.29 mm step. A normal moves by at most 0.45 deg.

    python3 tools/fr3d_q.py [name.fr3d.gz ...]     (default: every float blob)

`pack_v7` is also what `export_p` in tools/blender/frmesh.py writes with, so a
rebake lands on the same bytes.

── the skinned figures: v8 and v9 ─────────────────────────────────────────────

After v7 the people were most of the page: Baye, Chloe, the bucketeer, the
doodle, eight bathers, the painted pair and the two animals, 11.2 MB of gzip
and about 15 MB of html, every position, normal and UV of them float32. Misha,
on packing them: "ok go ahead ... with 16-bit normals" — the condition being
that nobody looks any worse, and int8's 0.45 deg is a step a smooth highlight
on skin could in principle show from close up.

v8 is v4 packed, v9 is v5 packed. The 44-byte header is v4/v5's word for word
(lo and hi still bound the positions; the last word is still `shed * 3` or the
number of parts) with only the version changed. Then, each in its own run:
  positions  per axis: nv zigzag uint16 deltas across [lo, hi], low bytes
             then high bytes — exactly v7's positions (0.03 mm on a 1.8 m
             figure);
  normals    OCTAHEDRAL, two int16s (x and y of the unit normal folded on to
             the octahedron, times 32 767), per component nv zigzag deltas,
             low bytes then high. Two numbers because a unit vector has two
             degrees of freedom and the third int16 of a per-axis layout is
             pure noise to gzip: a third off the normals' size for an angle
             error under 0.01 deg. Decoded to a UNIT normal — the vertex
             shader normalises after skinning, a linear map, so a length never
             reached the screen (138 of the doodle's normals were 0.95-0.999
             long and are 1 now);
  v8 colours nv*3 bytes, as v4;
  v9 UVs     per component, the UV as 16.16 FIXED POINT (round(u * 65 536) as
             an int32), nv zigzag int32 deltas as four byte runs. Not uint16
             across a range: the bathers flag eye and mouth corners at u = 2.5
             and 4.5 and pick tiles by floor(u * n), so a coordinate has to
             keep every dyadic boundary exact; 1 / 65 536 is 0.012 of a texel
             on the widest atlas (1 536). Every whole number and half
             survives;
  bones      nv*4 indices then nv*4 weights, as v4/v5 (interleaved compresses
             better than planes here, measured);
  index      ni zigzag uint32 deltas, four byte runs, as v7 (no alignment
             pad: the reader makes its own array);
then v4/v5's tail (v9's part table, the bones) byte for byte, and the clips
with each clip's header (name, duration, frame count, loop) as before, its nf
root translations as nf*3 float32 as before, and its quaternions — nb*4 int16
channels a frame, interleaved in v4/v5 — one CHANNEL at a time: nf zigzag
int16 deltas from the frame before, low bytes then high. Lossless: a clip is
the same int16s it was. `readFR3DSkin` in src/41-skin.js reads both;
`unpack_skin` below turns one back into the v4/v5 blob it came from (with the
quantised values) for the Python tools that parse those.

`pack_skin` takes the whole v4/v5 blob, so every skin exporter — `write_skin`
in frskin.py (cat, dog), `export_skin` in human_mh.py, `write_blob` in
baye2.py (Baye, Chloe, the bucketeer, the bathers) and slowdoodle/fr3d.py —
still builds exactly what it did and hands it here on the way out.

── v10 and v11: the crowd's far bodies and the rigid rigs ─────────────────────

The same two moves on the last two float formats. v10 is v6 (crowd_far.py:
the eight far bodies, `readFR3DCrowd` in src/42-crowd.js) with the header,
parts and meta untouched, then a position box (6 float32 — v6 has none), the
positions as v7's runs across it, the int8 normals, tints and bones verbatim,
and the uint16 index as zigzag deltas in two byte runs. v11 is v2 (`export_rig`
in frmesh.py: the Canadair and the ground crew, `readFR3DRig` in
src/48-landmarks.js) with the header and parts table untouched, then a
position box (v2's own box is the ASSEMBLED model's and every part is stored
about its pivot, so it does not bound them), positions as v7, normals
octahedral as v8/v9, colours verbatim, index as v7. `pack_crowd` / `pack_rig`
take the v6 / v2 blob whole, as `pack_skin` does, and are what those two
exporters write with.

── v12: a v9 with faces ────────────────────────────────────────────────────────

The eight bathers' expressions (1.551.0): a morph block — nine displacement
targets on the head, baked off MakeHuman's CC0 face rig — spliced into a v9
after its index runs, every other byte where it was. The layout is over
`MORPH_STEP` below and the why in tools/face_morphs.py. `save_skin(...,
morph=)` writes one; `strip_morphs` gives back the exact v9; `unpack_skin`
strips it on the way, so the tools that parse skins do not need to know.

1.551.1 changed no byte of the layout. The bathers' blobs carry eleven
targets now (the blink's in-betweens) and different geometry round the eyes
and in the mouth (tools/face_parts.py), written through the same
`pack_skin` / `add_morphs` path; the reader takes any number of targets.
"""

import gzip, io, struct, sys
from array import array
from pathlib import Path

PAYLOAD = Path(__file__).resolve().parent.parent / "build" / "payload"


def quantise(pos, lo, hi):
    """float positions -> uint16 across [lo, hi], exactly as `export_q`."""
    qp = array("H", [0]) * len(pos)
    for i, v in enumerate(pos):
        k = i % 3
        span = hi[k] - lo[k]
        qp[i] = 0 if span <= 0 else int(round((v - lo[k]) / span * 65535.0))
    return qp


def pack_v7(nv, ni, lo, hi, qp, qn, col, idx) -> bytes:
    """Arrays in v3's form (uint16 positions, int8 normals, uint8 colours, any
    index) -> a v7 blob."""
    out = [struct.pack("<4sIII6f", b"FR3D", 7, nv, ni, *lo, *hi)]
    for k in range(3):
        lo8, hi8 = bytearray(nv), bytearray(nv)
        prev = 0
        for i in range(nv):
            v = qp[i * 3 + k]
            d = (v - prev) & 0xFFFF
            d = d - 0x10000 if d & 0x8000 else d          # as int16
            z = ((d << 1) ^ (d >> 15)) & 0xFFFF
            lo8[i], hi8[i] = z & 0xFF, z >> 8
            prev = v
        out += [bytes(lo8), bytes(hi8)]
    qn = bytes(array("b", qn).tobytes()) if not isinstance(qn, (bytes, bytearray)) else qn
    col = bytes(col)
    for k in range(3):
        out.append(qn[k::3])
    for k in range(3):
        out.append(col[k::3])
    planes = [bytearray(ni) for _ in range(4)]
    prev = 0
    for i in range(ni):
        v = idx[i]
        d = (v - prev) & 0xFFFFFFFF
        d = d - 0x100000000 if d & 0x80000000 else d      # as int32
        z = ((d << 1) ^ (d >> 31)) & 0xFFFFFFFF
        planes[0][i], planes[1][i] = z & 0xFF, (z >> 8) & 0xFF
        planes[2][i], planes[3][i] = (z >> 16) & 0xFF, z >> 24
        prev = v
    out += [bytes(p) for p in planes]
    return b"".join(out)


def read_any(raw: bytes):
    """A v1 or v3 blob -> v3's arrays."""
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert magic == b"FR3D" and ver in (1, 3), ver
    lo = struct.unpack_from("<3f", raw, 16)
    hi = struct.unpack_from("<3f", raw, 28)
    o = 40
    if ver == 1:
        pos = array("f"); pos.frombytes(raw[o:o + nv * 12]); o += nv * 12
        nrm = array("f"); nrm.frombytes(raw[o:o + nv * 12]); o += nv * 12
        qp = quantise(pos, lo, hi)
        qn = array("b", [max(-127, min(127, int(round(v * 127.0)))) for v in nrm])
        iw = "I"
    else:
        qp = array("H"); qp.frombytes(raw[o:o + nv * 6]); o += nv * 6
        qn = array("b"); qn.frombytes(raw[o:o + nv * 3]); o += nv * 3
        iw = "I" if nv >= 65536 else "H"
    col = raw[o:o + nv * 3]; o += nv * 3
    idx = array(iw); idx.frombytes(raw[o:o + ni * idx.itemsize]); o += ni * idx.itemsize
    assert o == len(raw), "trailing bytes: not a plain v%d blob" % ver
    return nv, ni, lo, hi, qp, qn, col, idx


def gz(blob: bytes) -> bytes:
    # mtime=0 and level 9, as `_write` in frmesh.py: an unchanged model must
    # rebuild byte for byte.
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as g:
        g.write(blob)
    return buf.getvalue()


# ── v8 / v9: the skinned figures ─────────────────────────────────────────────

def _runs(vals, bits):
    """Integer values (taken mod 2^bits) -> their zigzag deltas from the one
    before, as bits/8 byte runs, lowest first."""
    import numpy as np
    m = (1 << bits) - 1
    a = np.asarray(vals, dtype=np.int64) & m
    d = np.diff(a, prepend=0) & m
    d = np.where(d >> (bits - 1), d - (1 << bits), d)      # signed
    z = ((d << 1) ^ (d >> (bits - 1))) & m
    b = z.astype("<u8").view(np.uint8).reshape(-1, 8)
    return b"".join(b[:, k].tobytes() for k in range(bits // 8))


def _unruns(buf, o, n, bits):
    """The inverse of `_runs`: n values (0 .. 2^bits - 1) and the new offset."""
    import numpy as np
    nb = bits // 8
    b = np.frombuffer(buf, np.uint8, n * nb, o).reshape(nb, n).astype(np.int64)
    z = np.zeros(n, np.int64)
    for k in range(nb):
        z |= b[k] << (8 * k)
    d = (z >> 1) ^ -(z & 1)
    return np.cumsum(d) & ((1 << bits) - 1), o + n * nb


def _signed(a, bits):
    return a - ((a >> (bits - 1)) << bits)


def oct_encode(nrm):
    """(n, 3) normals -> two int16 arrays, the octahedral fold of the unit
    normal times 32 767."""
    import numpy as np
    n = np.asarray(nrm, dtype=np.float64).reshape(-1, 3)
    s = np.abs(n).sum(1)
    s[s == 0] = 1.0
    x, y, z = n[:, 0] / s, n[:, 1] / s, n[:, 2] / s
    sx = np.where(x >= 0, 1.0, -1.0)
    sy = np.where(y >= 0, 1.0, -1.0)
    ox = np.where(z >= 0, x, (1.0 - np.abs(y)) * sx)
    oy = np.where(z >= 0, y, (1.0 - np.abs(x)) * sy)
    return (np.round(ox * 32767.0).astype(np.int64),
            np.round(oy * 32767.0).astype(np.int64))


def oct_decode(ox, oy):
    """Mirror of `readFR3DSkin`, operation for operation: float64 unit
    normals (the page then stores them as float32)."""
    import numpy as np
    x = np.asarray(ox, np.float64) / 32767.0
    y = np.asarray(oy, np.float64) / 32767.0
    z = 1.0 - np.abs(x) - np.abs(y)
    fold = z < 0
    tx = np.where(fold, (1.0 - np.abs(y)) * np.where(x >= 0, 1.0, -1.0), x)
    ty = np.where(fold, (1.0 - np.abs(x)) * np.where(y >= 0, 1.0, -1.0), y)
    ln = np.sqrt(tx * tx + ty * ty + z * z)
    return np.stack([tx / ln, ty / ln, z / ln], 1)


def _skin_split(raw):
    """A v4/v5 blob -> its pieces. The tail is walked, not trusted: anything
    left over is an error rather than something silently dropped."""
    import numpy as np
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert magic == b"FR3D" and ver in (4, 5), ver
    v5 = ver == 5
    o = 44
    pos = np.frombuffer(raw, "<f4", nv * 3, o); o += nv * 12
    nrm = np.frombuffer(raw, "<f4", nv * 3, o); o += nv * 12
    if v5:
        ex = np.frombuffer(raw, "<f4", nv * 2, o); o += nv * 8
    else:
        ex = raw[o:o + nv * 3]; o += nv * 3
    bones = raw[o:o + nv * 8]; o += nv * 8
    o = (o + 3) & ~3
    idx = np.frombuffer(raw, "<u4", ni, o); o += ni * 4
    t0 = o
    if v5:
        n, = struct.unpack_from("<I", raw, o); o += 4
        for _ in range(n):
            ln, = struct.unpack_from("<H", raw, o); o += 2 + ln + 12
    nb, = struct.unpack_from("<I", raw, o); o += 4
    for _ in range(nb):
        ln, = struct.unpack_from("<H", raw, o); o += 2 + ln + 32
    nc, = struct.unpack_from("<I", raw, o); o += 4
    table = raw[t0:o]
    clips = []
    for _ in range(nc):
        ln, = struct.unpack_from("<H", raw, o)
        h0 = o; o += 2 + ln
        nf, = struct.unpack_from("<I", raw, o + 4); o += 12
        stride = 12 + nb * 8
        blk = np.frombuffer(raw, np.uint8, nf * stride, o).reshape(nf, stride)
        o += nf * stride
        clips.append((raw[h0:o - nf * stride], nf, blk[:, :12].tobytes(),
                      blk[:, 12:].copy().view("<i2").reshape(nf, nb * 4)))
    assert o == len(raw), "trailing bytes in a v%d skin" % ver
    return ver, nv, ni, pos, nrm, ex, bones, idx, table, nb, clips


def pack_skin(raw: bytes) -> bytes:
    """A v4 or v5 blob, exactly as the exporters build it -> v8 or v9."""
    import numpy as np
    ver, nv, ni, pos, nrm, ex, bones, idx, table, nb, clips = _skin_split(raw)
    lo = np.array(struct.unpack_from("<3f", raw, 16), np.float64)
    hi = np.array(struct.unpack_from("<3f", raw, 28), np.float64)
    out = [raw[:4], struct.pack("<I", ver + 4), raw[8:44]]
    p = pos.astype(np.float64).reshape(-1, 3)
    for k in range(3):
        span = hi[k] - lo[k]
        q = (np.zeros(nv, np.int64) if span <= 0 else
             np.clip(np.round((p[:, k] - lo[k]) / span * 65535.0), 0, 65535).astype(np.int64))
        out.append(_runs(q, 16))
    for c in oct_encode(nrm):
        out.append(_runs(c, 16))
    if ver == 5:
        uv = ex.astype(np.float64).reshape(-1, 2)
        for k in range(2):
            out.append(_runs(np.round(uv[:, k] * 65536.0).astype(np.int64), 32))
    else:
        out.append(ex)
    out.append(bones)
    out.append(_runs(idx, 32))
    out.append(table)
    for head, nf, root, quat in clips:
        out += [head, root]
        out += [_runs(quat[:, c], 16) for c in range(nb * 4)]
    return b"".join(out)


# ── v10: the crowd's far bodies (v6), and v11: the rigid rigs (v2) ───────────

def _box(p):
    """float32 [lo, hi] of an (n, 3) array, and the uint16s across it."""
    import numpy as np
    p = np.asarray(p, np.float64).reshape(-1, 3)
    lo = p.min(0).astype(np.float32).astype(np.float64)
    hi = p.max(0).astype(np.float32).astype(np.float64)
    q = np.zeros(p.shape, np.int64)
    for k in range(3):
        span = hi[k] - lo[k]
        if span > 0:
            q[:, k] = np.clip(np.round((p[:, k] - lo[k]) / span * 65535.0), 0, 65535)
    return lo, hi, q


def _unbox(raw, o, nv):
    """`_box`'s runs back to float64 positions, as the page decodes them."""
    import numpy as np
    lo = struct.unpack_from("<3f", raw, o)
    hi = struct.unpack_from("<3f", raw, o + 12)
    o += 24
    pos = np.zeros((nv, 3), np.float64)
    for k in range(3):
        q, o = _unruns(raw, o, nv, 16)
        pos[:, k] = lo[k] + q * ((hi[k] - lo[k]) / 65535.0)
    return pos, o


def _crowd_head(raw):
    o = 24
    np_, = struct.unpack_from("<I", raw, 20)
    for _ in range(np_):
        ln, = struct.unpack_from("<H", raw, o); o += 2 + ln + 16
    ml, = struct.unpack_from("<H", raw, o); o += 2 + ml
    return o


def pack_crowd(raw: bytes) -> bytes:
    """A v6 far body (tools/blender/crowd_far.py) -> v10. The header, parts
    and meta as they were; then the position box (6 float32) and the
    positions as v7's runs across it; the int8 normals, tints and bones
    verbatim (already bytes, and already what they are in v6); the uint16
    index as zigzag deltas, two byte runs."""
    import numpy as np
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert magic == b"FR3D" and ver == 6, ver
    o = _crowd_head(raw)
    pos = np.frombuffer(raw, "<f4", nv * 3, o); o += nv * 12
    rest = raw[o:o + nv * 11]; o += nv * 11
    idx = np.frombuffer(raw, "<u2", ni, o); o += ni * 2
    assert o == len(raw), "trailing bytes in a v6 body"
    lo, hi, q = _box(pos)
    return b"".join([raw[:4], struct.pack("<I", 10), raw[8:_crowd_head(raw)],
                     struct.pack("<6f", *lo, *hi)]
                    + [_runs(q[:, k], 16) for k in range(3)]
                    + [rest, _runs(idx, 16)])


def unpack_crowd(raw: bytes) -> bytes:
    import numpy as np
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert magic == b"FR3D" and ver == 10, ver
    h = _crowd_head(raw)
    pos, o = _unbox(raw, h, nv)
    rest = raw[o:o + nv * 11]; o += nv * 11
    idx, o = _unruns(raw, o, ni, 16)
    assert o == len(raw)
    return b"".join([raw[:4], struct.pack("<I", 6), raw[8:h],
                     pos.astype("<f4").tobytes(), rest, idx.astype("<u2").tobytes()])


def _rig_head(raw):
    o = 40
    n, = struct.unpack_from("<I", raw, o); o += 4
    for _ in range(n):
        ln, = struct.unpack_from("<H", raw, o); o += 2 + ln + 32
    return o


def pack_rig(raw: bytes) -> bytes:
    """A v2 rig (`export_rig` in frmesh.py: the Canadair, the ground crew)
    -> v11. Header and parts table as they were (v2's own lo/hi are the
    ASSEMBLED model's box, and every part is stored about its own pivot, so
    they do not bound the stored positions); then that box, 6 float32; the
    positions as v7's runs across it; the normals octahedral, 2 x int16 runs,
    as v8/v9; the colours verbatim; the index as v7's."""
    import numpy as np
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert magic == b"FR3D" and ver == 2, ver
    h = _rig_head(raw)
    o = h
    pos = np.frombuffer(raw, "<f4", nv * 3, o); o += nv * 12
    nrm = np.frombuffer(raw, "<f4", nv * 3, o); o += nv * 12
    col = raw[o:o + nv * 3]; o += nv * 3
    idx = np.frombuffer(raw, "<u4", ni, o); o += ni * 4
    assert o == len(raw), "trailing bytes in a v2 rig"
    lo, hi, q = _box(pos)
    return b"".join([raw[:4], struct.pack("<I", 11), raw[8:h],
                     struct.pack("<6f", *lo, *hi)]
                    + [_runs(q[:, k], 16) for k in range(3)]
                    + [_runs(c, 16) for c in oct_encode(nrm)]
                    + [col, _runs(idx, 32)])


def unpack_rig(raw: bytes) -> bytes:
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert magic == b"FR3D" and ver == 11, ver
    h = _rig_head(raw)
    pos, o = _unbox(raw, h, nv)
    ox, o = _unruns(raw, o, nv, 16)
    oy, o = _unruns(raw, o, nv, 16)
    nrm = oct_decode(_signed(ox, 16), _signed(oy, 16))
    col = raw[o:o + nv * 3]; o += nv * 3
    idx, o = _unruns(raw, o, ni, 32)
    assert o == len(raw)
    return b"".join([raw[:4], struct.pack("<I", 2), raw[8:h],
                     pos.astype("<f4").tobytes(), nrm.astype("<f4").tobytes(),
                     col, idx.astype("<u4").tobytes()])


def save_skin(path, blob: bytes, morph=None):
    """What every skin exporter writes with: the v4/v5 blob it built, packed,
    gzipped deterministically — so a rebake that builds the same blob lands
    on the same bytes as `main` below converted.

    `morph`, if given, is called on the PACKED v9 and returns the v12 — the
    bathers' faces, `with_morphs` in tools/face_morphs.py. On the packed blob
    and not the float one so that a rebake measures the same quantised
    positions the conversion measured, and lands on the same bytes."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    packed = pack_skin(blob)
    if morph is not None:
        packed = morph(packed)
    path.write_bytes(gz(packed))


# ── v12: v9 and a morph block (the bathers' faces) ───────────────────────────
#
# tools/face_morphs.py has the why and the numbers. The block goes after v9's
# index runs and before its part table, so the clips are still the last
# section of the file and can still be spliced on to the end (dive.py, 1.530.1).
# Nothing before or after it moves by a byte:
#
#     u32 nt, u32 nm             targets, and how many vertices any of them move
#     nt x (u16 len, utf-8 name)
#     nm zigzag u32 deltas       the vertices, ascending, as four byte runs
#     nt x 3 axes x nm int16     zigzag deltas, low bytes then high, in units
#                                of MORPH_STEP metres
#
# `readFR3DSkin` in src/41-skin.js reads it.

MORPH_STEP = 1.0 / 65536.0


def index_end(packed: bytes) -> int:
    """The offset just past a v9 / v12's index runs: where a morph block goes."""
    magic, ver, nv, ni = struct.unpack_from("<4sIII", packed, 0)
    assert magic == b"FR3D" and ver in (9, 12), ver
    # positions 3 x 2 bytes, octahedral normals 2 x 2, UVs 2 x 4, bones 8, index 4
    return 44 + nv * (6 + 4 + 8 + 8) + ni * 4


def morph_end(packed: bytes, o: int) -> int:
    nt, nm = struct.unpack_from("<II", packed, o)
    e = o + 8
    for _ in range(nt):
        ln, = struct.unpack_from("<H", packed, e)
        e += 2 + ln
    return e + nm * 4 + nt * 3 * nm * 2


def add_morphs(packed: bytes, block: bytes) -> bytes:
    """A v9 blob -> v12: the version word, and the block spliced in after the
    index. Every other byte where it was."""
    assert struct.unpack_from("<I", packed, 4)[0] == 9
    o = index_end(packed)
    return packed[:4] + struct.pack("<I", 12) + packed[8:o] + block + packed[o:]


def strip_morphs(packed: bytes) -> bytes:
    """v12 -> exactly the v9 it was made from; anything else passes through."""
    if struct.unpack_from("<I", packed, 4)[0] != 12:
        return packed
    o = index_end(packed)
    return packed[:4] + struct.pack("<I", 9) + packed[8:o] + packed[morph_end(packed, o):]


def unpack_skin(raw: bytes) -> bytes:
    """A v8/v9 blob -> the v4/v5 blob it was packed from, with the positions,
    normals and UVs as `readFR3DSkin` decodes them. For the Python tools that
    parse skins (crowd_far.py, pinch_solve.py); a v4/v5 blob passes through,
    and a v12's morph block is dropped (`strip_morphs`)."""
    import numpy as np
    raw = strip_morphs(raw)
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    if ver in (4, 5):
        return raw
    assert magic == b"FR3D" and ver in (8, 9), ver
    lo = struct.unpack_from("<3f", raw, 16)
    hi = struct.unpack_from("<3f", raw, 28)
    o = 44
    pos = np.zeros((nv, 3), np.float64)
    for k in range(3):
        q, o = _unruns(raw, o, nv, 16)
        pos[:, k] = lo[k] + q * ((hi[k] - lo[k]) / 65535.0)
    ox, o = _unruns(raw, o, nv, 16)
    oy, o = _unruns(raw, o, nv, 16)
    nrm = oct_decode(_signed(ox, 16), _signed(oy, 16))
    parts = [raw[:4], struct.pack("<I", ver - 4), raw[8:44],
             pos.astype("<f4").tobytes(), nrm.astype("<f4").tobytes()]
    if ver == 9:
        uv = np.zeros((nv, 2), np.float64)
        for k in range(2):
            t, o = _unruns(raw, o, nv, 32)
            uv[:, k] = _signed(t, 32) / 65536.0
        parts.append(uv.astype("<f4").tobytes())
    else:
        parts.append(raw[o:o + nv * 3]); o += nv * 3
    parts.append(raw[o:o + nv * 8]); o += nv * 8
    parts.append(b"\0" * ((-sum(len(x) for x in parts)) % 4))
    idx, o = _unruns(raw, o, ni, 32)
    parts.append(idx.astype("<u4").tobytes())
    t0 = o
    if ver == 9:
        n, = struct.unpack_from("<I", raw, o); o += 4
        for _ in range(n):
            ln, = struct.unpack_from("<H", raw, o); o += 2 + ln + 12
    nb, = struct.unpack_from("<I", raw, o); o += 4
    for _ in range(nb):
        ln, = struct.unpack_from("<H", raw, o); o += 2 + ln + 32
    nc, = struct.unpack_from("<I", raw, o); o += 4
    parts.append(raw[t0:o])
    for _ in range(nc):
        ln, = struct.unpack_from("<H", raw, o)
        h0 = o; o += 2 + ln
        nf, = struct.unpack_from("<I", raw, o + 4); o += 12
        parts.append(raw[h0:o])
        root = np.frombuffer(raw, np.uint8, nf * 12, o).reshape(nf, 12); o += nf * 12
        quat = np.zeros((nf, nb * 4), np.int64)
        for c in range(nb * 4):
            quat[:, c], o = _unruns(raw, o, nf, 16)
        q = _signed(quat, 16).astype("<i2").view(np.uint8).reshape(nf, nb * 8)
        parts.append(np.concatenate([root, q], 1).tobytes())
    assert o == len(raw), "trailing bytes in a v%d skin" % ver
    return b"".join(parts)


def main(names):
    paths = [PAYLOAD / n for n in names] or sorted(PAYLOAD.glob("*.fr3d.gz"))
    before = after = 0
    for p in paths:
        if p.name.startswith("bather_"):
            continue                        # off the page, see build.py
        raw = gzip.decompress(p.read_bytes())
        ver = struct.unpack_from("<I", raw, 4)[0]
        if ver in (4, 5):
            new = gz(pack_skin(raw))
        elif ver == 6:
            new = gz(pack_crowd(raw))
        elif ver == 2:
            new = gz(pack_rig(raw))
        elif ver in (1, 3):
            new = gz(pack_v7(*read_any(raw)))
        else:
            continue
        b0, b1 = p.stat().st_size, len(new)
        p.write_bytes(new)
        before += b0; after += b1
        print(f"  {p.name:34s} {b0 / 1024:7.0f} KB -> {b1 / 1024:6.0f} KB")
    print(f"  total {before / 1024:.0f} KB -> {after / 1024:.0f} KB gz, "
          f"{(before - after) * 4 / 3 / 1048576:.2f} MB off the page")


if __name__ == "__main__":
    main(sys.argv[1:])
