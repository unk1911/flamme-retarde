#!/usr/bin/env python3
"""
Rewrite v1 and v3 .fr3d blobs in build/payload as packed v7, in place.

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

    python3 tools/fr3d_q.py [name.fr3d.gz ...]     (default: every v1/v3 blob)

`pack_v7` is also what `export_p` in tools/blender/frmesh.py writes with, so a
rebake lands on the same bytes.
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


def main(names):
    paths = [PAYLOAD / n for n in names] or sorted(PAYLOAD.glob("*.fr3d.gz"))
    before = after = 0
    for p in paths:
        if p.name.startswith("bather_"):
            continue                        # off the page, see build.py
        raw = gzip.decompress(p.read_bytes())
        if struct.unpack_from("<I", raw, 4)[0] not in (1, 3):
            continue
        new = gz(pack_v7(*read_any(raw)))
        b0, b1 = p.stat().st_size, len(new)
        p.write_bytes(new)
        before += b0; after += b1
        print(f"  {p.name:34s} {b0 / 1024:7.0f} KB -> {b1 / 1024:6.0f} KB")
    print(f"  total {before / 1024:.0f} KB -> {after / 1024:.0f} KB gz, "
          f"{(before - after) * 4 / 3 / 1048576:.2f} MB off the page")


if __name__ == "__main__":
    main(sys.argv[1:])
