#!/usr/bin/env python3
"""The Slow Doodle's textures: strands for the mane, and the breastplate.

    python3 tools/slowdoodle/textures.py

── the strands ───────────────────────────────────────────────────────────────

`cortu_strawberry_cloud_hair` from the MakeHuman community's hair01 pack, CC0
per the pack's own registry (packs/hair01.json — authoritative; the
`# license` line inside a MakeHuman file is boilerplate and says AGPL3 on
things the registry lists as CC0). Long wavy strands curling at the tips,
pale strawberry-blond, which is a gift: the viewer dyes by LUMINANCE, keeping
the texture's light and dark as shading and supplying the orange itself.

── the breastplate ───────────────────────────────────────────────────────────

Drawn here rather than found, because there is no library of gold filigree
collars for dogs and it is exactly the kind of thing that IS specific to him.
Its alpha does two jobs: it is the outline of the collar — a band that sweeps
from shoulder to shoulder and dips to the breastbone, as in the picture — and
it is the openwork inside it, scrolls with the black coat showing between
them. The plate it goes on is a generous patch of the coat's own faces,
projected from the front, so the shape lives entirely in this file.

Orientation: row 0 is the TOP of the plate (the throat end). The GLB exporter
flips v, three.js loads a glTF texture with flipY off, and the two cancel.
"""
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'build' / 'slowdoodle'
HAIR = ROOT / 'build' / 'mh_assets' / 'hair01' / 'hair' / 'cortu_strawberry_cloud_hair'

S = 1024


def centre(x):
    """The collar's centreline, image y at image x: a U dipping to the gem."""
    u = (x - S / 2) / (S / 2)
    return 690 - 400 * u * u


def collar_mask():
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    half = 92
    top = [(x, centre(x) - half * (0.75 + 0.25 * (1 - abs(x - S / 2) / (S / 2)))) for x in range(0, S + 1, 8)]
    bot = [(x, centre(x) + half * (0.75 + 0.25 * (1 - abs(x - S / 2) / (S / 2)))) for x in range(S, -1, -8)]
    d.polygon(top + bot, fill=255)
    # the pendant under the stone: a drop hanging off the bottom of the U
    d.ellipse((S / 2 - 70, 690 + 20, S / 2 + 70, 690 + 200), fill=255)
    return m, top, bot


def spiral(d, cx, cy, r0, turns, width, sgn, rot):
    pts = []
    n = int(60 * turns)
    for i in range(n + 1):
        t = i / n
        a = rot + sgn * t * turns * math.tau
        r = r0 * (1 - 0.85 * t)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.line(pts, fill=255, width=width, joint='curve')


def filigree():
    mask, top, bot = collar_mask()
    art = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(art)
    # the rims: a solid edge all the way round the collar
    d.line(top, fill=255, width=16, joint='curve')
    d.line(bot, fill=255, width=16, joint='curve')
    d.line([top[0], bot[-1]], fill=255, width=16)
    d.line([top[-1], bot[0]], fill=255, width=16)
    # a second, thinner rim inside the first — the look of a raised border
    inner_t = [(x, y + 20) for x, y in top]
    inner_b = [(x, y - 20) for x, y in bot]
    d.line(inner_t, fill=255, width=6, joint='curve')
    d.line(inner_b, fill=255, width=6, joint='curve')
    # the scrollwork: pairs of opposed C-scrolls along the band, mirrored
    # about the middle so the collar is symmetric as a made thing is
    for k in range(7):
        x = S / 2 + (k + 0.6) * 64
        for sx in (x, S - x):
            cy = centre(sx)
            sgn = 1 if sx > S / 2 else -1
            spiral(d, sx - 14 * sgn, cy - 22, 44, 1.25, 9, sgn, math.pi * 0.2)
            spiral(d, sx + 14 * sgn, cy + 24, 40, 1.15, 9, -sgn, math.pi * 1.2)
            d.line([(sx - 30, cy), (sx + 30, cy)], fill=255, width=7)
    # the setting the stone sits in: solid, because the gem needs a bed
    d.ellipse((S / 2 - 70, 690 - 110, S / 2 + 70, 690 + 110), fill=255)
    # the pendant's openwork
    d.ellipse((S / 2 - 70, 710, S / 2 + 70, 890), outline=255, width=14)
    spiral(d, S / 2 - 22, 800, 34, 1.2, 8, 1, 0.0)
    spiral(d, S / 2 + 22, 800, 34, 1.2, 8, -1, math.pi)
    a = Image.composite(art, Image.new('L', (S, S), 0), mask)
    # a hair of softening so alphaTest cuts a clean edge rather than a stair
    a = a.filter(ImageFilter.GaussianBlur(1.2))
    # colour: near-white gold, so the metal's own colour decides the hue; a
    # little darker in the recesses between rims, which reads as depth
    rgb = Image.new('RGB', (S, S), (255, 236, 188))
    shade = art.filter(ImageFilter.GaussianBlur(6))
    rgb = Image.composite(rgb, Image.new('RGB', (S, S), (170, 130, 70)), shade)
    im = rgb.convert('RGBA')
    im.putalpha(a)
    im = im.resize((512, 512), Image.LANCZOS)
    im.save(OUT / 'filigree.png', optimize=True)
    print('[tex] filigree.png', (OUT / 'filigree.png').stat().st_size // 1024, 'KB')


def strands():
    src = HAIR / 'strawberry_cloud_diff.png'
    for n in ('mane.png', 'tuft.png'):
        shutil.copy(src, OUT / n)
    print('[tex] mane.png / tuft.png <-', src.name)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    strands()
    filigree()
