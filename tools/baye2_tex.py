#!/usr/bin/env python3
"""Baye v2.0's textures: pick them off the rack, and paint what the rack has no
way to carry.

    python3 tools/baye2_tex.py --figure baye2

── why this is a separate step from tools/blender/baye2.py ───────────────────

Blender's Python has numpy and no PIL, and the alternative — loading a colour
JPEG through Blender's own image API — means routing an sRGB texture through
its colour management and hoping the round trip is the identity. It is not,
reliably, and a gamma applied twice to a skin is not a bug you see until you
put her next to somebody. PIL is here, so the pixels are handled here.

── what has to be painted ────────────────────────────────────────────────────

Pubic hair. Every community skin in the pack is hairless there, and v1.0 is
not, so v2.0 standing next to her is a difference that reads immediately.

v1.0 does it with GEOMETRY: five overlapping ellipsoid cutters in a column,
punched through the mesh and painted `PUBIC_P`, with the decimator's own
averaging doing the softening — see the long note at `pubic hair` in
`human_mh.py`. That mechanism does not exist on a textured figure, and it
should not: the whole of what makes v2.0 different is that her surface detail
lives in a map.

So the same wedge is evaluated here and rasterised into UV space. The five
rows, their heights and their widths are v1.0's numbers verbatim — 60, 46, 34,
26 and 20 mm across, hung on the mesh's own front surface — because the
argument for the SHAPE is the same one and it is a good argument: one ellipse
centred on the mons is a symmetric blob, and a symmetric dark blob there is a
bruise. The thing is a wedge.

Two of v1.0's numbers are deliberately not reused. Its radii are declared at
the cutter's waist and the comment says to multiply by 0.686 to get the
painted size; that factor is applied here, so the widths below are the ones
that end up on her. And its bottom two rows exist because of the hip wrap's
hem — the whole mons sits behind cloth that is rigid to her pelvis, so without
them nobody would ever see any of it. v2.0 wears no wrap, so those rows are
just anatomy here, which is what the note said they were anyway.
"""
import math
import random
import re
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'build' / 'wardrobe'
OUT = ROOT / 'build' / 'payload'
TARGET_H = 1.75

# The textures each figure needs, and whether it gets the wedge. The same
# table `tools/blender/baye2.py` carries; they are checked against each other
# below rather than shared, because one of them runs in Blender and importing
# across that line to save ten lines of dict is how a build ends up needing
# Blender to answer a question about a JPEG.
#
# Chloe does not get the wedge. She is in jeans from the hip down — painted,
# in `src/49-you.js`, on thresholds measured off this same body — so it would
# be under denim in every frame she is ever in.
FIGURES = {
    'baye2': {'body': 'build/mh_base.obj', 'pubic': True,
              'tex': {'skin': 'darthfurby_caucasian_female',
                      'hair': 'elvs_unkempt_french_braid',
                      'hair2': 'o4saken_long01',
                      'leg':  'v0rt3x_stockings_black_fishnet_medium'}},
    'chloe2': {'body': 'build/mh_bodies/mh_chloe.obj', 'pubic': False,
               'tex': {'skin': 'toigo_light_skin_female_freckles',
                       'hair': 'cortu_short_messy_hair'}},
}

# (height, half-width) per row, in game metres, already through v1.0's 0.686
# waist-to-painted factor. 22 mm apart against a 16 mm vertical radius, so
# they overlap into one continuous wedge rather than five discs.
#
# DO NOT JUDGE THESE ON THE MAP. The first pass rasterised to 44 texels across
# and 118 tall, which looks like a dark vertical spike, and the reflex is to
# widen it until the map looks right. That reflex is wrong: the body island is
# about 1.75x anisotropic here, so a patch that IS wider than it is tall on
# her is taller than it is wide in the texture. What the map looks like is not
# information. Render it.
#
# THE HEIGHTS ARE HERS AND NOT v1.0's, and this is the one thing transcribing
# v1.0 got wrong. Its wedge runs z 0.823 to 0.913, and its own note says why:
# the hip wrap is rigid to her pelvis and spans 0.828 to 0.940, so the whole
# mons sits behind cloth and the only rows that ever do any work are the
# bottom two, down where the gap under the hem is. Copied on to a figure
# wearing no wrap, that puts the mass of it between her legs, where it reads
# as a shadow rather than as hair.
#
# So the wedge is hung on the mesh instead. Its midline front surface runs
# x 0.1076 at z 0.832, 0.1276 at 0.865, 0.1366 at 0.891 and 0.1449 at 0.922,
# and flattens into belly above that — the mound is z 0.845 to 0.920, and the
# triangle goes there: 76 mm across the top, tapering to 24 mm, 67 mm tall.
PUBIC_ROWS = (
    (0.921, 0.0380, 0.1449),      # 76 mm across, at the top of the mons
    (0.905, 0.0340, 0.1410),      # 68 mm
    (0.888, 0.0270, 0.1364),      # 54 mm
    (0.871, 0.0190, 0.1280),      # 38 mm
    (0.854, 0.0120, 0.1195),      # 24 mm, and out
)
PUBIC_RZ = 0.0140                 # vertical radius, the same for every row
# `PUBIC_P` from human_mh.py, as bytes. The texture is handed to the shader
# with `NoColorSpace` — the whole game's palette is authored in that stretched
# space, `aVCol` included — so v1.0's literal and this one mean the same thing.
PUBIC_RGB = np.array([57.0, 42.0, 33.0])
PUBIC_MAX = 0.92                  # never quite opaque; skin shows through hair


def read_obj(path):
    vs, vts, faces, cur = [], [], [], None
    for ln in path.read_text(errors='ignore').splitlines():
        if ln.startswith('v '):
            a = ln.split()
            vs.append((float(a[1]), float(a[2]), float(a[3])))
        elif ln.startswith('vt '):
            a = ln.split()
            vts.append((float(a[1]), float(a[2])))
        elif ln.startswith('g '):
            cur = ln[2:].strip()
        elif ln.startswith('f ') and cur == 'body':
            c = []
            for tok in ln.split()[1:]:
                q = tok.split('/')
                c.append((int(q[0]) - 1, int(q[1]) - 1 if len(q) > 1 and q[1] else -1))
            if len(c) >= 3:
                faces.append(c)
    return vs, vts, faces


def coverage(p):
    """How much of the wedge is at this point on the skin, 0..1.

    The x term is a GATE rather than a third axis of the ellipsoid. v1.0 sinks
    each cutter 40 mm behind the surface and lets a boolean intersection decide
    the footprint; doing the same arithmetic as a distance here would make the
    middle of the patch its faintest part, because the skin sits most of a
    radius off the centre. What is wanted is "on the front of her, at this
    height, this far off the midline", and that is what this is.
    """
    x, y, z = p
    best = 0.0
    for pz, ry, surf in PUBIC_ROWS:
        if x < surf - 0.060:
            continue
        gate = min(1.0, max(0.0, (x - (surf - 0.060)) / 0.030))
        d = math.hypot(y / ry, (z - pz) / PUBIC_RZ)
        best = max(best, gate * max(0.0, min(1.0, (1.0 - d) / 0.26)))
    return best


def hair_noise(size, seed=20260922):
    """Fine, slightly vertical speckle, so it reads as hair and not as paint.

    Value noise at two scales rather than one: the coarse one breaks the patch
    up into clumps and the fine one is the strands. Stretched 1:2.2 across
    versus down, because hair there grows downward and a patch of isotropic
    speckle reads as stubble.
    """
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    out = np.zeros((size, size), np.float32)
    for cell, amp in ((6, 0.55), (3, 0.45)):
        h, w = max(2, size // (cell * 2)), max(2, size // cell)
        g = np_rng.random((h, w)).astype(np.float32)
        out += amp * np.asarray(
            Image.fromarray((g * 255).astype(np.uint8)).resize(
                (size, size), Image.BILINEAR), np.float32) / 255.0
    rng.random()
    out -= out.min()
    return out / max(out.max(), 1e-6)


def raster(size, vs, vts, faces, scale, drop):
    """The wedge, rasterised into texture space off the mesh's own UVs.

    Per-vertex coverage interpolated barycentrically across each triangle, so
    the edge of the patch follows the geometry rather than a circle drawn in
    the map. Only the faces that have any coverage are touched, which is a few
    hundred out of thirteen thousand.
    """
    def game(v):
        return (v[2] * scale, v[0] * scale, v[1] * scale + drop)

    cov = {}
    mask = np.zeros((size, size), np.float32)
    hit = 0
    for f in faces:
        c = []
        for vi, ti in f:
            if vi not in cov:
                cov[vi] = coverage(game(vs[vi]))
            c.append((vi, ti))
        if max(cov[vi] for vi, _ in c) <= 0.0:
            continue
        hit += 1
        for k in range(1, len(c) - 1):
            tri = (c[0], c[k], c[k + 1])
            if min(t for _v, t in tri) < 0:
                continue
            # v is up in a .obj and down in an image: the same flip `flipY` is
            # about, and getting it wrong here paints her shoulder blade.
            uv = np.array([[vts[t][0] * size, (1.0 - vts[t][1]) * size]
                           for _v, t in tri])
            w = np.array([cov[v] for v, _t in tri])
            x0, y0 = np.floor(uv.min(0)).astype(int) - 1
            x1, y1 = np.ceil(uv.max(0)).astype(int) + 1
            x0, y0 = max(x0, 0), max(y0, 0)
            x1, y1 = min(x1, size), min(y1, size)
            if x1 <= x0 or y1 <= y0:
                continue
            ys, xs = np.mgrid[y0:y1, x0:x1]
            px = xs + 0.5
            py = ys + 0.5
            (ax, ay), (bx, by), (cx, cy) = uv
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            l0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
            l1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
            l2 = 1.0 - l0 - l1
            inside = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
            val = l0 * w[0] + l1 * w[1] + l2 * w[2]
            blk = mask[y0:y1, x0:x1]
            np.maximum(blk, np.where(inside, val, 0.0), out=blk)
    print('[baye2tex] wedge touches %d body faces, %d texels'
          % (hit, int((mask > 0.01).sum())))
    return mask


# THE CLEFT. Misha, 24 Sep 2026, of the lotus: *"at the moment there's
# literally nothing there which looks awkward... from the front it's like a
# barbie doll or something, can u add at least something there to kinda make
# it appear normal"* — and, first, *"ok not explicit"*. So this is what a
# figure drawing does and no more: one soft crease down the midline where
# the mons turns under between her legs, and a faint shadow either side of
# it to give the form, in her own skin darkened. Painted, because the mesh is
# smooth there and its vertices are 15-20 mm apart — a 4 mm line interpolated
# per vertex would not survive — so it is evaluated per TEXEL, at each
# texel's own point on her, which `raster_fn` works out barycentrically.
#
# The midline surface, measured off the base mesh in game metres (x forward,
# z up): 0.1076 at z 0.832, 0.0905 at 0.8195, 0.0666 at 0.8143, 0.0448 at
# 0.8139 — the underside of her, curving back between her legs. The crease
# starts under the pubic wedge and fades out before the back.
CLEFT_X = (0.117, 0.106, 0.056, 0.040)   # fade in, full, full, fade out (x)
CLEFT_W = 0.0028                         # m, the line's half-width
CLEFT_SOFT = 0.0075                      # and the shadow either side of it
CLEFT_RGB = np.array([0.76, 0.62, 0.61]) # skin multiplied by this at the line
CLEFT_SOFT_K = 0.16                      # and darkened this much in the shadow


def cleft(p):
    """(line, shadow) at this point on her, each 0..1."""
    x, y, z = p
    if z > 0.846 or z < 0.800 or x < CLEFT_X[3] or x > CLEFT_X[0] or abs(y) > 0.03:
        return 0.0, 0.0
    def sm(a, b, t):
        u = min(1.0, max(0.0, (t - a) / (b - a)))
        return u * u * (3 - 2 * u)
    along = sm(CLEFT_X[0], CLEFT_X[1], x) * sm(CLEFT_X[3], CLEFT_X[2], x)
    line = along * math.exp(-(y / CLEFT_W) ** 2)
    soft = along * math.exp(-(y / CLEFT_SOFT) ** 2)
    return line, soft


def raster_fn(size, vs, vts, faces, scale, drop, fn, box):
    """`fn` evaluated per texel at the texel's own 3D point on her.

    Only the faces with a vertex inside `box` (game metres, (lo, hi) per axis)
    are touched. Returns one map per value `fn` returns.
    """
    def game(v):
        return (v[2] * scale, v[0] * scale, v[1] * scale + drop)

    lo, hi = box
    outs = None
    for f in faces:
        P = [game(vs[vi]) for vi, _t in f]
        if not any(all(lo[k] <= q[k] <= hi[k] for k in range(3)) for q in P):
            continue
        for k in range(1, len(f) - 1):
            idx = (0, k, k + 1)
            if min(f[i][1] for i in idx) < 0:
                continue
            uv = np.array([[vts[f[i][1]][0] * size, (1.0 - vts[f[i][1]][1]) * size] for i in idx])
            G = np.array([P[i] for i in idx])
            x0, y0 = np.floor(uv.min(0)).astype(int) - 1
            x1, y1 = np.ceil(uv.max(0)).astype(int) + 1
            x0, y0 = max(x0, 0), max(y0, 0)
            x1, y1 = min(x1, size), min(y1, size)
            if x1 <= x0 or y1 <= y0:
                continue
            (ax, ay), (bx, by), (cx, cy) = uv
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            for ty in range(y0, y1):
                for tx in range(x0, x1):
                    px, py = tx + 0.5, ty + 0.5
                    l0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
                    l1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
                    l2 = 1.0 - l0 - l1
                    # A texel's worth of slack outside the triangle, so the
                    # seam between two faces is covered from both sides.
                    if min(l0, l1, l2) < -0.08:
                        continue
                    q = l0 * G[0] + l1 * G[1] + l2 * G[2]
                    vals = fn(tuple(q))
                    if outs is None:
                        outs = [np.zeros((size, size), np.float32) for _ in vals]
                    for o, v in zip(outs, vals):
                        if v > o[ty, tx]:
                            o[ty, tx] = v
    return outs or [np.zeros((size, size), np.float32)] * 2


def check_wear(name):
    """The Blender half carries its own copy; they have to agree.

    Two tables rather than an import, because one of them runs inside Blender.
    Two tables that can drift silently are worse than one, though, so they are
    compared: a mismatch is the figure wearing one asset's geometry under
    another's texture, which on a hairstyle is obvious and on a skin is not.
    """
    src = (ROOT / 'tools' / 'blender' / 'baye2.py').read_text()
    blk = re.search(r"'%s':\s*\{(.*?)\n    \}," % name, src, re.S)
    if not blk:
        sys.exit('[baye2tex] cannot find figure %r in tools/blender/baye2.py' % name)
    theirs = dict(re.findall(r"'(\w+)':\s*'([^']+)'", blk.group(1)))
    if theirs.get('body') != FIGURES[name]['body']:
        sys.exit('[baye2tex] %s body disagrees: %r here, %r in baye2.py'
                 % (name, FIGURES[name]['body'], theirs.get('body')))
    for k, v in FIGURES[name]['tex'].items():
        if theirs.get(k) != v:
            sys.exit('[baye2tex] %s %r disagrees: %r here, %r in baye2.py'
                     % (name, k, v, theirs.get(k)))


def main():
    argv = sys.argv[1:]
    name = argv[argv.index('--figure') + 1] if '--figure' in argv else 'baye2'
    if name not in FIGURES:
        sys.exit('[baye2tex] no figure %r; have %s' % (name, ', '.join(FIGURES)))
    check_wear(name)
    spec = FIGURES[name]
    base = ROOT / spec['body']
    if not base.exists():
        sys.exit('[baye2tex] no body %s — run tools/blender/mh_morph.py' % base)
    vs, vts, faces = read_obj(base)
    ys = [v[1] for f in faces for vi, _t in f for v in (vs[vi],)]
    scale = TARGET_H / (max(ys) - min(ys))
    drop = -min(ys) * scale

    OUT.mkdir(parents=True, exist_ok=True)
    for kind, want in spec['tex'].items():
        # `hair2` is a second hairstyle, and the rack files hairstyles as `hair`.
        rack = 'hair' if kind == 'hair2' else kind
        src = next((p for p in sorted(WORK.glob('%s__%s.*' % (rack, want)))
                    if p.suffix in ('.png', '.jpg')), None)
        if src is None:
            sys.exit('[baye2tex] no texture for %s — run tools/wardrobe/make.py' % want)
        for stale in OUT.glob('%s_%s.*' % (name, kind)):
            stale.unlink()
        if kind != 'skin' or not spec['pubic']:
            dst = OUT / ('%s_%s%s' % (name, kind, src.suffix))
            shutil.copy(src, dst)
        else:
            im = Image.open(src).convert('RGB')
            size = im.size[0]
            a = np.asarray(im).astype(np.float32)
            m = raster(size, vs, vts, faces, scale, drop)
            n = hair_noise(size)
            # The noise multiplies the coverage rather than the colour: what
            # varies across a patch of hair is how much of the skin behind it
            # you can see, not what shade the hair is.
            # The cleft first, under the hair: skin darkened, then hair over.
            line, soft = raster_fn(size, vs, vts, faces, scale, drop, cleft,
                                   ((0.035, -0.035, 0.795), (0.120, 0.035, 0.850)))
            print('[baye2tex] cleft touches %d texels' % int((line > 0.05).sum()))
            a = a * (1.0 - CLEFT_SOFT_K * soft[..., None])
            a = a * (1.0 - line[..., None] * (1.0 - CLEFT_RGB))
            alpha = (m * PUBIC_MAX * (0.45 + 0.75 * n)).clip(0.0, PUBIC_MAX)
            a = a * (1.0 - alpha[..., None]) + PUBIC_RGB * alpha[..., None]
            dst = OUT / ('%s_skin.jpg' % name)
            Image.fromarray(a.round().clip(0, 255).astype(np.uint8)).save(
                dst, quality=86, optimize=True)
        print('[baye2tex] %-4s %-24s -> %-18s %.0f KB'
              % (kind, want[:24], dst.name, dst.stat().st_size / 1024))


if __name__ == '__main__':
    main()
