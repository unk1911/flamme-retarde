#!/usr/bin/env python3
"""Cut the people out of a restyled frame, onto white, as a VACE reference.

    python3 tools/lab/refcut.py FRAME.png OUT.png --box x0,y0,x1,y1 \
        --seeds x,y[;x,y...] [--w 1024 --h 640]

WHY. Every chunk of a restyle is generated on its own and knows nothing of the
one before, so the people in it are reinvented every 5.06 s: on 23 Sep 2026 the
dark-haired Baye was blonde in black mesh briefs by chunk 2. A reference image
handed to EVERY chunk (`burst.py fan --ref`) holds them — measured the same
day, chunk 0 and chunk 2 the same two women where the run without it was not.

HOW IT IS USED — two passes on one box:
  1. `fan --chunks 1` with the final prompts: chunk 0 alone.
  2. This script on a good frame of it (people front-on, whole bodies).
  3. `fan --chunks N --ref OUT.png`: the whole film, every chunk given it.
The reference is cut from the SAME look the film will have, so it does not
drag the colours of some other attempt into every chunk.

WHAT IT KEEPS, and why it is not a luminance mask on the game frame: that was
tried first and it cut off a black-haired woman's hair, because her hair is as
dark as the walls — and hair is most of identity. The background is found by
colour instead, from the crop's own border, and only what is CONNECTED to the
seed points (one per person, on the torso) is kept, so the stool beside them
and the tiles under them fall away. The output is exactly --w x --h, because
the loader resizes the reference to the job's size and anything else would
stretch them.
"""
import argparse
import collections

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('frame')
ap.add_argument('out')
ap.add_argument('--box', required=True, help='x0,y0,x1,y1 around the people')
ap.add_argument('--seeds', required=True,
                help='x,y;x,y — a point on each person, in the FRAME\'s pixels')
ap.add_argument('--w', type=int, default=1024)
ap.add_argument('--h', type=int, default=640)
ap.add_argument('--tol', type=float, default=28.0,
                help='hue distance (degrees) from the background that still counts as it')
A = ap.parse_args()

x0, y0, x1, y1 = (int(v) for v in A.box.split(','))
im = Image.open(A.frame).convert('RGB')
crop = im.crop((x0, y0, x1, y1))
a = np.asarray(crop).astype(float) / 255
mx, mn = a.max(-1), a.min(-1)
d = np.maximum(mx - mn, 1e-6)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
hue = np.where(mx == r, ((g - b) / d) % 6,
               np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)

# The background is every hue that carries real weight round the crop's
# border, weighted by saturation so grey noise does not vote. Not the one
# dominant hue: a mottled wall runs olive through teal, and a single peak
# plus a tolerance kept half of it (71% of the crop against 57%, measured on
# the first reference this was used for). So the box must leave a margin of
# background on every side — a person touching the border would vote for
# their own skin.
border = np.concatenate([hue[0], hue[-1], hue[:, 0], hue[:, -1]])
bsat = np.concatenate([sat[0], sat[-1], sat[:, 0], sat[:, -1]])
hist, edges = np.histogram(border, bins=36, range=(0, 360), weights=bsat)
hot = [(edges[i] + edges[i + 1]) / 2 for i in range(36) if hist[i] > 0.04 * hist.sum()]
background = np.zeros(hue.shape, bool)
for h0 in hot:
    background |= np.abs(((hue - h0) + 180) % 360 - 180) < A.tol / 2
background &= (sat > 0.10) & (mx > 0.15)
bg = hot[0] if hot else 0.0
# White grout and highlights in the bottom fifth — floors, not people.
floor = (mx > 0.62) & (sat < 0.18) & (np.arange(a.shape[0])[:, None] > a.shape[0] * 0.8)
keep = ~(background | floor)
keep = np.asarray(Image.fromarray((keep * 255).astype(np.uint8))
                  .filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 127

H, W = keep.shape
seen = np.zeros_like(keep)
for s in A.seeds.split(';'):
    sx, sy = (int(v) for v in s.split(','))
    sx, sy = sx - x0, sy - y0
    if not (0 <= sx < W and 0 <= sy < H) or not keep[sy, sx]:
        print('seed %s is not on a person — move it' % s)
        continue
    q = collections.deque([(sy, sx)])
    seen[sy, sx] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and keep[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                q.append((yy, xx))

mask = (Image.fromarray((seen * 255).astype(np.uint8))
        .filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
        .filter(ImageFilter.GaussianBlur(1.2)))
s = (A.h - 20) / crop.size[1]
if crop.size[0] * s > A.w - 20:
    s = (A.w - 20) / crop.size[0]
cw, ch = int(crop.size[0] * s), int(crop.size[1] * s)
canvas = Image.new('RGB', (A.w, A.h), (255, 255, 255))
canvas.paste(crop.resize((cw, ch), Image.LANCZOS), ((A.w - cw) // 2, (A.h - ch) // 2),
             mask.resize((cw, ch), Image.LANCZOS))
canvas.save(A.out)
print('background hues %s, kept %.0f%% of the crop -> %s'
      % (', '.join('%.0f' % h for h in hot), seen.mean() * 100, A.out))
