#!/usr/bin/env python3
"""Take the game's HUD out of control frames before a VACE restyle.

Text is the one thing a restyle reliably destroys — 6 px console type comes
back as noise — so the overlay has to leave before the frames do.

TWO THINGS THAT DID NOT WORK, BOTH PAID FOR ON A RENTED A100.

1. Interpolating the console away from its own borders, which is what
   `delogo` does. It leaves a smooth rectangle with HARD EDGES, and VACE
   reads an edge as geometry: the restyle came back with a framed grid panel
   bolted to the floor, in the same place, in every frame of the chunk. A
   patch that is invisible to a person looking at the control frame is loud
   to the model.

2. Filling it with its own surroundings reflected in, feathered to nothing at
   the rim. No edges at all this time, and it came back WORSE — a blue
   lattice. The floor is a tiled plane in perspective and a mirror reverses
   the convergence, so the reflected grout lines cross the real ones. The
   model drew what it was shown.

AND WHAT WORKED WAS NOT PAINTING AT ALL. The console is anchored to the
right edge, so cropping the frame from 1280 to 1024 takes the whole of it
and takes the bottom-right price ticker with it. It costs 20 % of the width
and it costs nothing in the picture: she centres up, the television and the
cot are both still in frame, and there is no region left for the model to
invent something in. A third of an hour of rented A100 went into the two
fills above before the cheap answer got its turn.

The subtitle line stays, because it is not at an edge — but it is thin
bright glyphs over a floor worth keeping, and a median wider than a letter
stroke and narrower than a grout line takes the text and leaves the tiles.
"""
import sys
from pathlib import Path

from PIL import Image, ImageFilter

# In 1024x640 control-frame coordinates.
SUBS = (208, 494, 1024, 536)


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    fs = sorted(src.glob('*.png'))
    for i, f in enumerate(fs):
        im = Image.open(f).convert('RGB')
        im.paste(im.crop(SUBS).filter(ImageFilter.MedianFilter(5)), SUBS[:2])
        im.save(dst / f.name)
        if i % 300 == 0:
            print('%d/%d' % (i, len(fs)), flush=True)
    print('%d frames' % len(fs))


main()
