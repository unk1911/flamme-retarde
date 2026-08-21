#!/usr/bin/env python3
"""Lay several runs of the same shot side by side at the same frame.

    tools/contact.py out.png --frame 36 A1=~/fr-video/lab/A1 A2=~/fr-video/lab/A2

The only way to judge a restyle is against another restyle of the *same frame*,
because every one of them looks plausible alone. Labels are burned in, since a
grid of near-identical images with the legend somewhere else is worse than no
grid at all.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

AP = argparse.ArgumentParser()
AP.add_argument("out")
AP.add_argument("pairs", nargs="+", help="LABEL=dir")
AP.add_argument("--frame", type=int, default=0)
AP.add_argument("--cols", type=int, default=2)
AP.add_argument("--w", type=int, default=760)
AP.add_argument("--crop", default="", help="x,y,w,h in source pixels (a detail)")
A = AP.parse_args()

tiles = []
for p in A.pairs:
    label, _, d = p.partition("=")
    files = sorted(Path(d).expanduser().glob("*.png"))
    if not files:
        print(f"  skip {label}: no frames in {d}")
        continue
    im = Image.open(files[min(A.frame, len(files) - 1)]).convert("RGB")
    if A.crop:
        x, y, w, h = (int(v) for v in A.crop.split(","))
        im = im.crop((x, y, x + w, y + h))
    im = im.resize((A.w, int(A.w * im.height / im.width)), Image.LANCZOS)
    d2 = ImageDraw.Draw(im)
    # Drawn twice, offset — a caption has to survive being placed over both a
    # bright sky and a dark hillside, and one colour cannot do that.
    for dx, dy, col in ((1, 1, (0, 0, 0)), (0, 0, (255, 240, 90))):
        d2.text((8 + dx, 6 + dy), f"{label}  ({files[0].parent.name})", fill=col)
    tiles.append(im)

if not tiles:
    raise SystemExit("nothing to compare")
cols = min(A.cols, len(tiles))
rows = (len(tiles) + cols - 1) // cols
tw, th = tiles[0].size
sheet = Image.new("RGB", (cols * tw, rows * th), (20, 20, 20))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * tw, (i // cols) * th))
sheet.save(A.out)
print(f"{len(tiles)} tiles -> {A.out}  {sheet.size}")
