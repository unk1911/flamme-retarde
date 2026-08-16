"""The vikendica at Jadrija — the upper floor, and what sixty centimetres buys.

    tools/blender/blender.sh --background --python tools/blender/vikendica.py

Writes three blobs into build/payload/ and a plan sidecar:

    vikendica_shell.fr3d.gz  the building and everything in it, to the wall head
    vikendica_roof.fr3d.gz   the flat ceiling and the pantile hip that are there
    vikendica_loft.fr3d.gz   the raised knee wall, the new roof, the mezzanine
    vikendica_plan.json      room rectangles, wall blockers and door anchors

The split is not tidiness. The two roofs are alternatives — the point of the
model is to stand in the same room under each of them — and everything below
the wall head is common to both, so it is built once and drawn under either.

Dimensions come from the house. Fifty square metres is the registered figure,
the clear height is 2.40 m, and the renovation is allowed sixty centimetres of
new wall and nothing else. Everything else in here is measured off eleven
photographs and a fifty-second walk-through: which room has which window, what
the kitchen is made of, which way the doors slide, and the fact that the
bathroom floor is cobalt and the walls above it are white with two blue tiles
set into them at random.

Frames
------
Blender is Z-up. The house sits centred on the origin in plan:

    X   -3.39 .. +3.39   across the house, and the direction the ridge runs
    Y   -3.865 .. +3.865  -Y is the terrace and the sea, +Y the bedrooms
    Z    0 = grade, 2.90 = the upper floor, 5.30 its ceiling, 5.55 the head

The exporter turns that into three.js axes on the way out, once, in frmesh.
"""

from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import (  # noqa: E402
    TAU, bevel, bm_ball, bm_box, bm_cylinder, bm_hip_roof, export, new_object,
    reset_scene,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "build" / "payload"
BLEND = ROOT / "build" / "vikendica.blend"

RNG = random.Random(20260815)


# --------------------------------------------------------------------------- #
#  the palette                                                                 #
# --------------------------------------------------------------------------- #
# Sampled off the photographs and then opened up, because a sample off a
# photograph is a colour *after* the room's one blue window has been through it
# and the game's shader is going to do that part itself. These are albedos.

WALL = (0.815, 0.836, 0.855)        # the pale blue-grey of every room
WALL_W = (0.900, 0.898, 0.888)      # the bathroom and the ceilings, white
CEIL = (0.930, 0.928, 0.920)
RENDER = (0.870, 0.845, 0.790)      # outside: fine sand render, sun-bleached
PLINTH = (0.660, 0.630, 0.580)
CONCRETE = (0.700, 0.690, 0.665)

OAK = (0.720, 0.652, 0.560)         # the laminate. Grey-beige, wide plank
OAK_2 = (0.690, 0.618, 0.522)
OAK_3 = (0.748, 0.684, 0.596)
OAK_4 = (0.660, 0.596, 0.512)
OAK_GAP = (0.360, 0.318, 0.272)

PINE = (0.760, 0.560, 0.320)        # architraves, the terrace doors, skirting
PLY = (0.800, 0.618, 0.372)         # the sliding doors, birch-faced
WALNUT = (0.300, 0.170, 0.082)      # the wardrobe, the bed, the daybed frames
BEECH = (0.660, 0.470, 0.280)

TILE_FLOOR = (0.150, 0.270, 0.520)  # bathroom, cobalt
TILE_DEEP = (0.085, 0.150, 0.330)   # the darker ones set into the walls
TILE_WALL = (0.900, 0.898, 0.885)
GROUT = (0.560, 0.556, 0.548)
TERRAZZO = (0.800, 0.762, 0.685)    # the terrace, 33 cm non-slip

KITCH_UP = (0.470, 0.560, 0.650)    # wall cabinets, dusty blue
KITCH_LO = (0.285, 0.330, 0.400)    # base units, slate
WORKTOP = (0.780, 0.760, 0.720)
WHITEGOODS = (0.905, 0.900, 0.885)
FRIDGE_RED = (0.720, 0.105, 0.095)  # the tall one. Half the photographs.
STEEL = (0.640, 0.650, 0.660)
CHROME = (0.780, 0.790, 0.800)
DARKMETAL = (0.110, 0.115, 0.125)
BLACK = (0.055, 0.058, 0.062)

RED_THROW = (0.780, 0.115, 0.105)   # the covers over everything soft
SOFA_TAP = (0.560, 0.360, 0.260)    # the tapestry three-seater
DAYBED = (0.660, 0.585, 0.490)      # the woven mattress ticking
LINEN = (0.880, 0.868, 0.835)
TEAL = (0.400, 0.640, 0.620)        # the rug by the terrace door, the curtains
SHEER = (0.880, 0.910, 0.900)
PLASTIC_W = (0.900, 0.895, 0.875)   # garden furniture, indoors
AWNING = (0.880, 0.830, 0.610)

ROOFTILE = (0.660, 0.310, 0.190)
SHUTTER = (0.880, 0.876, 0.855)     # white louvred, not the green of the town
GLASS = (0.520, 0.600, 0.635)


# --------------------------------------------------------------------------- #
#  the plan                                                                    #
# --------------------------------------------------------------------------- #
# Off the drawings, not off the photographs. TLOCRT KATA at 1:100 plus the four
# elevations settle everything the fisheye walk-through could only suggest:
#
#   678 x 773 cm external, 20 cm walls, and a terrace 220 deep across the whole
#   south face. The bedroom half is set back 70 cm on the west, which is the
#   vertical joint running down the middle of the west elevation.
#
#   +0.00 grade, +2.90 upper floor, +5.30 its ceiling, +5.55 the wall head,
#   +7.20 the ridge, +7.82 the chimney. The floor level is not a guess: the
#   outside stair is 17 risers of 17 cm, which is 289.
#
#   The ridge runs east-west, so the gables face east and west and the long
#   slopes face the terrace and the lane. 1.65 m of rise over a 3.865 m half
#   span is 23 degrees.
#
# Areas as scheduled, and they are what the room sizes below are fitted to:
#   1 dnevni boravak + kuhinja + blagovaonica  23.76    2 kupaonica   3.89
#   3 soba (east)  8.01     4 soba (west)  7.69     5 vanjsko stubište  4.08
#
# Local frame: +X east (the stair, the front door), +Y north (the bedrooms),
# origin at the centre of the 678 x 773 footprint.

GRADE = 0.0
F2 = 2.90                  # 17 x 17 cm up the outside stair
CLEAR = 2.40
CEILZ = F2 + CLEAR         # 5.30
HEAD = 5.55                # wall head, off all four elevations
RIDGE_NOW = 7.20
CHIMNEY = 7.82
KNEE = 0.60                # what the renovation is allowed to add. All of it.

EXT = 0.20
INT = 0.10

X0, X1 = -3.39, 3.39       # 678 across, the ridge direction
Y0, Y1 = -3.865, 3.865     # 773 deep
IX0, IX1 = X0 + EXT, X1 - EXT
IY0, IY1 = Y0 + EXT, Y1 - EXT

STEP = 0.70                # the bedroom half, set back from the west face
NX0 = X0 + STEP            # its west face
NIX0 = NX0 + EXT

BED_S = 0.835              # south face of the bedrooms, inside
SPINE = 0.735              # centreline of the wall under it
BY0, BY1 = SPINE - INT, SPINE + INT     # 20 cm, as drawn

W_MID = 0.31               # centreline between the two bedrooms
BATH_E = -0.79             # the bathroom's east wall, centreline
BATH_S = -1.07             # and its south wall

ROOMS = {
    # The big room is an L and is kept as two rectangles, because every floor,
    # every skirting and every blocker downstream wants rectangles.
    "living":  (BATH_E + INT / 2, IX1, IY0, BY0),
    "kitchen": (IX0, BATH_E - INT / 2, IY0, BATH_S - INT / 2),
    "bath":    (IX0, BATH_E - INT / 2, BATH_S + INT / 2, BY0),
    "soba4":   (NIX0, W_MID - INT, BY1, IY1),
    "soba3":   (W_MID + INT, IX1, BY1, IY1),
}

# Openings, as (a0, a1, z0, z1) above the upper floor.
DOOR_H = 2.05
D_ENTRY = (-0.70, 0.30, 0.0, DOOR_H)         # east wall, at the head of the stair
D_TERR = (0.54, 2.74, 0.0, 2.10)             # south wall, the 220 opening
W_TERR = (-2.34, -0.94, 1.00, 2.05)          # south wall, the 140 opening
D_S4 = (-1.02, -0.17, 0.0, DOOR_H)           # both bedrooms open off the big room
D_S3 = (0.51, 1.36, 0.0, DOOR_H)
D_BATH = (-0.20, 0.58, 0.0, DOOR_H)          # in the bathroom's east wall

W_S4_N = (-1.64, -0.44, 1.00, 2.05)          # north wall of the west bedroom
W_S4_W = (1.60, 2.50, 1.00, 2.05)            # and its window on to the west
W_S3_E = (1.70, 2.90, 1.00, 2.05)            # east wall of the east bedroom
W_KIT_W = (-3.30, -2.10, 1.00, 2.05)         # the west wall of the big room
W_BATH_W = (-0.60, 0.00, 1.40, 2.05)         # the bathroom, high and small
W_N = (1.60, 2.30, 1.00, 2.05)               # the one window on the north wall

# The terrace: the full width of the house, 220 deep, on the south.
TER_Y0, TER_Y1 = Y0 - 2.20, Y0
TER_Z = F2 - 0.02

# The stair up the outside, on the east face: 17 x 17 up, 16 x 25 along.
ST_X = X1 + 0.62           # centreline of the flight
ST_W = 1.10
ST_N = 17
ST_RISE = 0.17
ST_GO = 0.25
# The top tread, which stops just short of the door — so the landing, which
# runs from here northward, is what is under the opening.
#
# It used to be the door's centreline plus 30 cm, which put the head of the
# flight *in* the doorway: the last thing between the promenade and the front
# door was a 17 cm step with no floor to stand on while you crossed it. It read
# fine in a render and it was a hole you fell 2.9 m through the moment anybody
# tried to walk in.
ST_TOP = D_ENTRY[0] - 0.06
ST_BOT = ST_TOP - ST_GO * (ST_N - 1)

# The renovation.
LOFT_HEAD = HEAD + KNEE            # +6.15, and that is the whole permission
PITCH = math.radians(25.0)
RIDGE = LOFT_HEAD + (Y1 - Y0) / 2 * math.tan(PITCH)
DECK = F2 + 2.55                   # top of the mezzanine deck
DECK_T = 0.16
LOFT_Y = -1.20                     # its open edge, over the big room


# --------------------------------------------------------------------------- #
#  the kit                                                                     #
# --------------------------------------------------------------------------- #

class Kit:
    """One bmesh per (colour, bevel). Objects are made at the end.

    Every surface in this house is a box and the only thing that stops a room
    of boxes reading as a room of boxes is a catch-light on each edge, so the
    bevel width is part of the material rather than an afterthought: 2 mm on a
    tile, 6 mm on furniture, 20 mm on a wall reveal.
    """

    def __init__(self, name):
        self.name = name
        self._bm = {}          # (colour, bevel) -> bmesh
        self._loose = []       # (object, colour), for anything with a modifier

    def bm(self, colour, bev=0.006):
        key = (colour, round(bev, 4))
        if key not in self._bm:
            self._bm[key] = bmesh.new()
        return self._bm[key]

    def box(self, colour, cx, cy, cz, sx, sy, sz, bev=0.006):
        bm_box(self.bm(colour, bev), cx, cy, cz, sx, sy, sz)

    def span(self, colour, x0, x1, y0, y1, z0, z1, bev=0.006):
        """A box by its two opposite corners, which is how a plan is written."""
        self.box(colour, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
                 abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), bev)

    def adopt(self, ob, colour):
        """An object built outside the buckets — anything with a modifier."""
        self._loose.append((ob, colour))
        return ob

    def parts(self):
        out = list(self._loose)
        for i, (key, bm) in enumerate(self._bm.items()):
            colour, bev = key
            ob = new_object(bm, "%s_%02d" % (self.name, i))
            if bev > 0:
                bevel(ob, bev, segments=1, angle=35.0)
            out.append((ob, colour))
        return out


def solidify(ob, thickness, offset=0.0):
    m = ob.modifiers.new("solid", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    return m


# ------------------------------------------------------------------ surfaces --

def wall(kit, colour, axis, at, a0, a1, thick, z0, z1, holes=(), bev=0.018):
    """A wall panel with rectangular holes in it, decomposed into boxes.

    No booleans anywhere in this file. A wall with three windows is a strip
    between each pair of them plus a lintel and an apron over each — nine
    boxes, all quads, welded by nothing and needing to be welded by nothing
    because the exporter deduplicates on position and normal anyway.
    """
    hs = sorted(holes, key=lambda h: h[0])
    cuts = [a0]
    for h in hs:
        cuts += [h[0], h[1]]
    cuts.append(a1)
    for i in range(0, len(cuts) - 1, 2):
        p, q = cuts[i], cuts[i + 1]
        if q - p > 1e-4:
            _panel(kit, colour, axis, at, p, q, thick, z0, z1, bev)
    for (ha0, ha1, hz0, hz1) in hs:
        if hz0 - z0 > 1e-4:
            _panel(kit, colour, axis, at, ha0, ha1, thick, z0, hz0, bev)
        if z1 - hz1 > 1e-4:
            _panel(kit, colour, axis, at, ha0, ha1, thick, hz1, z1, bev)


def _panel(kit, colour, axis, at, a0, a1, thick, z0, z1, bev):
    if axis == "x":
        kit.box(colour, (a0 + a1) / 2, at, (z0 + z1) / 2,
                a1 - a0, thick, z1 - z0, bev)
    else:
        kit.box(colour, at, (a0 + a1) / 2, (z0 + z1) / 2,
                thick, a1 - a0, z1 - z0, bev)


def planks(kit, x0, x1, y0, y1, z, width=0.192, along="x", tones=None):
    """Laminate. Wide plank, four tones shuffled, butt joints staggered.

    The gap between boards is 3 mm of the dark backing showing through, and it
    is the only reason a floor reads as a floor and not as a sheet of card —
    at eye height in a 2.4 m room the plank lines are the strongest horizontal
    in the picture after the ceiling.
    """
    tones = tones or (OAK, OAK_2, OAK_3, OAK_4)
    kit.span(OAK_GAP, x0, x1, y0, y1, z - 0.026, z - 0.004, bev=0)
    gap = 0.003
    if along == "x":
        n = max(1, int(round((y1 - y0) / width)))
        w = (y1 - y0) / n
        for j in range(n):
            a, b = y0 + j * w + gap, y0 + (j + 1) * w
            t = x0
            while t < x1:
                e = min(x1, t + (RNG.uniform(0.25, 1.1) if t == x0
                                else RNG.uniform(0.75, 1.65)))
                kit.span(tones[RNG.randrange(len(tones))], t + gap, e, a, b,
                         z - 0.012, z, bev=0.0015)
                t = e
    else:
        n = max(1, int(round((x1 - x0) / width)))
        w = (x1 - x0) / n
        for j in range(n):
            a, b = x0 + j * w + gap, x0 + (j + 1) * w
            t = y0
            while t < y1:
                e = min(y1, t + (RNG.uniform(0.25, 1.1) if t == y0
                                else RNG.uniform(0.75, 1.65)))
                kit.span(tones[RNG.randrange(len(tones))], a, b, t + gap, e,
                         z - 0.012, z, bev=0.0015)
                t = e


def _shades(colour, n=5, lo=0.93, hi=1.06):
    """A handful of tones around one colour, not a continuum.

    Every distinct colour is a separate object at export time, so a tile floor
    that jitters freely is six hundred draw calls' worth of mesh. Five is
    plenty: what the eye reads off a tiled floor is that no two neighbours
    match, not how many tones there are."""
    return [tuple(min(1.0, v * (lo + (hi - lo) * i / (n - 1))) for v in colour)
            for i in range(n)]


def floor_tiles(kit, x0, x1, y0, y1, z, size=0.30, colour=TILE_FLOOR,
                accent=None, accent_p=0.0, grout=GROUT, thick=0.011):
    kit.span(grout, x0, x1, y0, y1, z - 0.03, z - thick * 0.4, bev=0)
    tones = _shades(colour)
    nx = max(1, int(round((x1 - x0) / size)))
    ny = max(1, int(round((y1 - y0) / size)))
    sx, sy = (x1 - x0) / nx, (y1 - y0) / ny
    g = 0.005
    for i in range(nx):
        for j in range(ny):
            c = (accent if accent and RNG.random() < accent_p
                 else tones[RNG.randrange(len(tones))])
            kit.span(c, x0 + i * sx + g, x0 + (i + 1) * sx - g,
                     y0 + j * sy + g, y0 + (j + 1) * sy - g,
                     z - thick, z, bev=0.0015)


def _face_span(axis, at, a0, a1, z0, z1, d0, d1):
    if axis == "x":
        return (a0, a1, at + d0, at + d1, z0, z1)
    return (at + d0, at + d1, a0, a1, z0, z1)


def tiled_face(kit, axis, at, a0, a1, z0, z1, face=1, size=0.20,
               colour=TILE_WALL, accent=TILE_DEEP, accent_p=0.05, depth=0.010):
    """The one that actually works. `axis` names the axis the wall *runs* along."""
    s = _face_span(axis, at, a0, a1, z0, z1, -face * 0.005, face * 0.004)
    kit.span(GROUT, *s, bev=0)
    tones = _shades(colour, n=3, lo=0.97, hi=1.02)
    na = max(1, int(round((a1 - a0) / size)))
    nz = max(1, int(round((z1 - z0) / size)))
    sa, sz = (a1 - a0) / na, (z1 - z0) / nz
    g = 0.004
    for i in range(na):
        for j in range(nz):
            c = (accent if accent and RNG.random() < accent_p
                 else tones[RNG.randrange(len(tones))])
            kit.span(c, *_face_span(axis, at,
                                    a0 + i * sa + g, a0 + (i + 1) * sa - g,
                                    z0 + j * sz + g, z0 + (j + 1) * sz - g,
                                    0.0, face * depth), bev=0.0015)


# ------------------------------------------------------------------ openings --

def reveal(kit, axis, at, a0, a1, z0, z1, thick, colour=WALL, bev=0.012,
           floor=None):
    """The four inside faces of a hole in a wall. Cheap, and the difference
    between a window and a sticker.

    `floor` is the level the room's floor is at: an opening that starts on it
    is a door and gets three faces, and one that starts above it is a window
    and gets an inside sill as well."""
    t = thick / 2 - 0.002
    kit.span(colour, *_face_span(axis, at, a0 - 0.02, a0 + 0.02, z0, z1,
                                 -t, t), bev=bev)
    kit.span(colour, *_face_span(axis, at, a1 - 0.02, a1 + 0.02, z0, z1,
                                 -t, t), bev=bev)
    kit.span(colour, *_face_span(axis, at, a0, a1, z1 - 0.02, z1 + 0.02,
                                 -t, t), bev=bev)
    if floor is not None and z0 - floor > 0.10:
        kit.span(colour, *_face_span(axis, at, a0, a1, z0 - 0.03, z0 + 0.01,
                                     -t - 0.02, t + 0.02), bev=bev)


def window(kit, axis, at, hole, base, thick=EXT, shutters=True, curtain_c=SHEER):
    """A casement, its frame, its sill and its outward-folding shutters.

    Every window in this house is white uPVC with a single big pane and a
    louvred shutter that swings out and gets hooked back, and in the video the
    shutters are what the light does — the room is striped."""
    a0, a1, z0, z1 = hole
    z0 += base
    z1 += base
    reveal(kit, axis, at, a0, a1, z0, z1, thick, floor=base)
    f = 0.045
    for (p, q) in ((a0, a0 + f), (a1 - f, a1)):
        kit.span(WHITEGOODS, *_face_span(axis, at, p, q, z0, z1, -0.03, 0.03),
                 bev=0.004)
    kit.span(WHITEGOODS, *_face_span(axis, at, a0, a1, z1 - f, z1, -0.03, 0.03),
             bev=0.004)
    kit.span(WHITEGOODS, *_face_span(axis, at, a0, a1, z0, z0 + f, -0.03, 0.03),
             bev=0.004)
    # A mullion, because a 1.4 m opening is two casements and not one sheet.
    if a1 - a0 > 1.0:
        m = (a0 + a1) / 2
        kit.span(WHITEGOODS, *_face_span(axis, at, m - 0.028, m + 0.028,
                                         z0, z1, -0.03, 0.03), bev=0.004)
    kit.span(GLASS, *_face_span(axis, at, a0 + f, a1 - f, z0 + f, z1 - f,
                                -0.006, 0.006), bev=0.001)
    # Outside sill, throated, sloping away.
    out = 1 if at > 0 else -1
    if axis == "x":
        kit.span(CONCRETE, a0 - 0.06, a1 + 0.06, at + out * (thick / 2 - 0.02),
                 at + out * (thick / 2 + 0.07), z0 - 0.05, z0 + 0.01, bev=0.008)
    else:
        kit.span(CONCRETE, at + out * (thick / 2 - 0.02),
                 at + out * (thick / 2 + 0.07), a0 - 0.06, a1 + 0.06,
                 z0 - 0.05, z0 + 0.01, bev=0.008)
    if shutters:
        for side, (p, q) in enumerate(((a0, (a0 + a1) / 2), ((a0 + a1) / 2, a1))):
            louvred(kit, axis, at + out * (thick / 2 + 0.10),
                    p, q, z0, z1, open_to=out)
    if curtain_c:
        inn = -out
        curtain(kit, axis, at + inn * (thick / 2 + 0.09),
                a0 - 0.16, a1 + 0.16, z0 - 0.04, z1 + 0.22, colour=curtain_c)


def louvred(kit, axis, at, a0, a1, z0, z1, open_to=1, slats=None):
    """A shutter leaf, hooked flat back against the render."""
    kit.span(SHUTTER, *_face_span(axis, at, a0, a1, z0, z1, -0.016, 0.016),
             bev=0.004)
    n = slats or max(6, int((z1 - z0) / 0.075))
    for j in range(n):
        zz = z0 + 0.05 + (z1 - z0 - 0.10) * j / max(1, n - 1)
        kit.span(tuple(v * 0.93 for v in SHUTTER),
                 *_face_span(axis, at, a0 + 0.035, a1 - 0.035, zz, zz + 0.022,
                             -0.030, 0.004), bev=0.002)


def curtain(kit, axis, at, a0, a1, z0, z1, colour=SHEER, folds=None, amp=0.045):
    """A sheer, gathered on a rod with rings. Built as a corrugated sheet and
    thickened, so it catches light on the near face of every fold."""
    n = folds or max(8, int((a1 - a0) / 0.14))
    bm = bmesh.new()
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        a = a0 + (a1 - a0) * t
        d = math.sin(t * math.pi * n * 0.5) * amp
        db = d * 1.5 + math.sin(t * math.pi * n * 0.5 + 1.1) * amp * 0.5
        if axis == "x":
            top.append(bm.verts.new((a, at + d, z1)))
            bot.append(bm.verts.new((a, at + db, z0)))
        else:
            top.append(bm.verts.new((at + d, a, z1)))
            bot.append(bm.verts.new((at + db, a, z0)))
    bm.verts.ensure_lookup_table()
    for i in range(n):
        bm.faces.new((top[i], top[i + 1], bot[i + 1], bot[i]))
    ob = new_object(bm, "curtain", recalc=False)
    solidify(ob, 0.006)
    kit.adopt(ob, colour)
    # The rod and its two finials, visible above the head of every opening in
    # this flat because none of the curtains reach the ceiling.
    _rod(kit, axis, at, a0 - 0.10, a1 + 0.10, z1 + 0.06)


def _rod(kit, axis, at, a0, a1, z):
    bm = kit.bm(BEECH, 0.002)
    r = 0.016
    if axis == "x":
        vs = bm_cylinder(bm, 0, 0, -(a1 - a0) / 2, (a1 - a0) / 2, r, r, seg=10)
        _rot_y(vs, (a0 + a1) / 2, at, z)
    else:
        vs = bm_cylinder(bm, 0, 0, -(a1 - a0) / 2, (a1 - a0) / 2, r, r, seg=10)
        _rot_x(vs, at, (a0 + a1) / 2, z)
    for e in (a0 + 0.02, a1 - 0.02):
        if axis == "x":
            bm_ball(bm, e, at, z, 0.030, 0.030, 0.030, rows=5, seg=8)
        else:
            bm_ball(bm, at, e, z, 0.030, 0.030, 0.030, rows=5, seg=8)


def _rot_y(verts, cx, cy, cz):
    """Lay a Z-aligned cylinder down along X and move it into place."""
    for v in verts:
        x, y, z = v.co
        v.co = (cx + z, cy + y, cz - x)


def _rot_x(verts, cx, cy, cz):
    for v in verts:
        x, y, z = v.co
        v.co = (cx + x, cy + z, cz - y)


def door_case(kit, axis, at, hole, base=F2, thick=INT, colour=PINE):
    """Pine architrave both sides of an opening — the detail that dates the
    flat, and the warmest thing in every photograph."""
    a0, a1, z0, z1 = hole
    z0 += base
    z1 += base
    reveal(kit, axis, at, a0, a1, z0, z1, thick, colour=colour, bev=0.008)
    for out in (-1, 1):
        d0 = out * (thick / 2)
        d1 = out * (thick / 2 + 0.020)
        for p, q in ((a0 - 0.065, a0), (a1, a1 + 0.065)):
            kit.span(colour, *_face_span(axis, at, p, q, z0, z1 + 0.065, d0, d1),
                     bev=0.004)
        kit.span(colour, *_face_span(axis, at, a0 - 0.065, a1 + 0.065,
                                     z1, z1 + 0.065, d0, d1), bev=0.004)


def slider(kit, axis, at, hole, base=F2, thick=INT, slide=1.0, open_frac=1.0):
    """A flush ply leaf on an exposed top track, parked to one side.

    Two of the three internal doors here are these. They are hung outside the
    wall on a rail screwed to the face above the opening, they never quite
    close, and the track is the thing you see first in the video."""
    a0, a1, z0, z1 = hole
    z0 += base
    z1 += base
    door_case(kit, axis, at, hole, base, thick)
    w = a1 - a0 + 0.09
    off = slide * (w * open_frac + 0.03)
    p0 = a0 - 0.045 + off
    face = thick / 2 + 0.028
    kit.span(PLY, *_face_span(axis, at, p0, p0 + w, z0, z1 + 0.05,
                              face, face + 0.035), bev=0.004)
    # Track and its two carriers.
    kit.span(STEEL, *_face_span(axis, at, a0 - w - 0.10, a1 + w + 0.10,
                                z1 + 0.10, z1 + 0.15, face - 0.01, face + 0.05),
             bev=0.003)
    for c in (p0 + 0.14, p0 + w - 0.14):
        kit.span(DARKMETAL, *_face_span(axis, at, c - 0.02, c + 0.02,
                                        z1 + 0.05, z1 + 0.11,
                                        face + 0.010, face + 0.024), bev=0.002)
    # A flush finger pull, milled into the leaf.
    c = p0 + w - 0.16 if slide > 0 else p0 + 0.16
    kit.span(tuple(v * 0.7 for v in PLY),
             *_face_span(axis, at, c - 0.055, c + 0.055,
                         z0 + 0.95, z0 + 1.10, face + 0.030, face + 0.036),
             bev=0.002)


def leaf_door(kit, axis, at, hole, base=F2, thick=EXT, colour=WHITEGOODS,
              glazed=True, swing=0.0):
    """A hinged leaf standing in its opening — the front door, and the two
    that go out on to the terrace."""
    a0, a1, z0, z1 = hole
    z0 += base
    z1 += base
    reveal(kit, axis, at, a0, a1, z0, z1, thick, colour=WALL, bev=0.010)
    f = 0.055
    for p, q in ((a0, a0 + f), (a1 - f, a1)):
        kit.span(colour, *_face_span(axis, at, p, q, z0, z1, -0.035, 0.035),
                 bev=0.004)
    kit.span(colour, *_face_span(axis, at, a0, a1, z1 - f, z1, -0.035, 0.035),
             bev=0.004)
    if glazed:
        kit.span(colour, *_face_span(axis, at, a0 + f, a1 - f,
                                     z0 + 0.10, z0 + 0.16, -0.035, 0.035),
                 bev=0.004)
        kit.span(GLASS, *_face_span(axis, at, a0 + f, a1 - f,
                                    z0 + 0.16, z1 - f, -0.007, 0.007), bev=0.001)
        kit.span(colour, *_face_span(axis, at, a0 + f, a1 - f, z0, z0 + 0.10,
                                     -0.030, 0.030), bev=0.004)
    else:
        kit.span(colour, *_face_span(axis, at, a0 + f, a1 - f, z0, z1 - f,
                                     -0.026, 0.026), bev=0.004)
    h = a1 - 0.10 if swing >= 0 else a0 + 0.10
    kit.span(CHROME, *_face_span(axis, at, h - 0.055, h + 0.055,
                                 z0 + 1.02, z0 + 1.08, 0.035, 0.075), bev=0.004)


# --------------------------------------------------------------------------- #
#  the shell                                                                   #
# --------------------------------------------------------------------------- #

def shell(kit):
    # ── the storey below, closed ────────────────────────────────────────────
    # There is a whole flat down there — TLOCRT PRIZEMLJA, 41.94 m², two more
    # bedrooms and a second bathroom — and none of it is modelled yet. What is
    # here is its outside: four rendered walls, the openings off the elevations
    # and the terrace slab the upper terrace stands on.
    kit.span(PLINTH, X0 - 0.06, X1 + 0.06, Y0 - 0.06, Y1 + 0.06,
             GRADE - 0.35, GRADE + 0.25, bev=0.03)
    ground = {
        "south": [(-2.60, -0.40, 0.30, 2.35), (0.60, 1.60, 1.10, 2.05)],
        "north": [(-0.40, 0.40, 1.10, 2.05)],
        "west": [(-2.40, -1.50, 1.10, 2.05), (0.60, 1.50, 1.10, 2.05)],
        "east": [(-3.00, -1.60, 0.30, 2.35)],
    }
    for key, axis, at, a0, a1 in (
        ("south", "x", Y0 + EXT / 2, X0, X1),
        ("north", "x", Y1 - EXT / 2, X0, X1),
        ("west", "y", X0 + EXT / 2, Y0, Y1),
        ("east", "y", X1 - EXT / 2, Y0, Y1),
    ):
        hs = [(h[0], h[1], GRADE + h[2], GRADE + h[3]) for h in ground[key]]
        wall(kit, RENDER, axis, at, a0, a1, EXT, GRADE + 0.20, F2 - 0.22,
             holes=hs)
        for h in ground[key]:
            if h[3] - h[2] > 1.9:
                leaf_door(kit, axis, at, h, base=GRADE, glazed=False,
                          colour=PINE)
            else:
                window(kit, axis, at, h, GRADE, curtain_c=None)
    kit.span(CONCRETE, X0 - 0.05, X1 + 0.05, Y0 - 0.05, Y1 + 0.05,
             F2 - 0.22, F2, bev=0.02)

    # ── the upper storey ────────────────────────────────────────────────────
    # The north half is set back 70 cm on the west, so the west face is two
    # planes and the south, north and east are one each.
    ext = {
        "south": ("x", Y0 + EXT / 2, X0, X1, [D_TERR, W_TERR]),
        "north": ("x", Y1 - EXT / 2, NX0, X1, [W_N]),
        "westS": ("y", X0 + EXT / 2, Y0, BY1, [W_KIT_W, W_BATH_W]),
        "westN": ("y", NX0 + EXT / 2, BY0, Y1, [W_S4_W]),
        "east": ("y", X1 - EXT / 2, Y0, Y1, [D_ENTRY, W_S3_E]),
    }
    for key, (axis, at, a0, a1, holes) in ext.items():
        hs = [(h[0], h[1], F2 + h[2], F2 + h[3]) for h in holes]
        wall(kit, RENDER, axis, at, a0, a1, EXT, F2, HEAD, holes=hs)
    # The return face of the set-back, and the little roof over the notch.
    wall(kit, RENDER, "x", BY1 - EXT / 2, X0, NX0 + EXT, EXT, F2, HEAD)

    # Inside face of the same walls, so a room is painted where the outside is
    # rendered. Two skins 4 cm apart rather than one wall in one colour: every
    # reveal then has render on one side and paint on the other, which is what
    # you see standing in the opening.
    inner = {
        "south": ("x", IY0 + 0.02, IX0 - 0.10, IX1 + 0.10, [D_TERR, W_TERR]),
        "north": ("x", IY1 - 0.02, NIX0 - 0.10, IX1 + 0.10, [W_N]),
        "westS": ("y", IX0 + 0.02, IY0 - 0.10, BY1, [W_KIT_W, W_BATH_W]),
        "westN": ("y", NIX0 + 0.02, BY0, IY1 + 0.10, [W_S4_W]),
        "east": ("y", IX1 - 0.02, IY0 - 0.10, IY1 + 0.10, [D_ENTRY, W_S3_E]),
    }
    for key, (axis, at, a0, a1, holes) in inner.items():
        hs = [(h[0] - 0.01, h[1] + 0.01, F2 + h[2] - 0.01, F2 + h[3] + 0.01)
              for h in holes]
        wall(kit, WALL, axis, at, a0, a1, 0.04, F2, CEILZ, holes=hs, bev=0.004)
    wall(kit, WALL, "x", BY1 - 0.02, X0, NIX0, 0.04, F2, CEILZ, bev=0.004)

    # ── partitions ──────────────────────────────────────────────────────────
    # The spine under the bedrooms, with a door into each.
    wall(kit, WALL, "x", SPINE, NIX0, IX1, INT * 2, F2, CEILZ,
         holes=[(h[0], h[1], F2 + h[2], F2 + h[3]) for h in (D_S4, D_S3)])
    wall(kit, WALL, "x", SPINE, IX0, NIX0, INT * 2, F2, CEILZ)
    # Between the two bedrooms.
    wall(kit, WALL, "y", W_MID, BY1, IY1, INT * 2, F2, CEILZ)
    # And the two sides of the bathroom, which is a box in the north-west
    # corner of the big room.
    wall(kit, WALL, "y", BATH_E, BATH_S, BY0, INT, F2, CEILZ,
         holes=[(D_BATH[0], D_BATH[1], F2 + D_BATH[2], F2 + D_BATH[3])])
    wall(kit, WALL, "x", BATH_S, IX0, BATH_E, INT, F2, CEILZ)

    # ── floors ──────────────────────────────────────────────────────────────
    # Ceramic through the big room and the kitchen — the schedule says
    # keramičke ploče — and laminate in the two bedrooms.
    for name in ("living", "kitchen"):
        x0, x1, y0, y1 = ROOMS[name]
        floor_tiles(kit, x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, F2,
                    size=0.333, colour=(0.760, 0.720, 0.655), accent=None,
                    grout=(0.640, 0.610, 0.560))
    for name in ("soba3", "soba4"):
        x0, x1, y0, y1 = ROOMS[name]
        planks(kit, x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, F2)
    bx0, bx1, by0, by1 = ROOMS["bath"]
    floor_tiles(kit, bx0 - 0.03, bx1 + 0.03, by0 - 0.03, by1 + 0.03, F2,
                size=0.20, colour=TILE_FLOOR, accent=TILE_DEEP, accent_p=0.04)

    sk = 0.075
    for name in ("living", "kitchen", "soba3", "soba4"):
        x0, x1, y0, y1 = ROOMS[name]
        kit.span(WALL_W, x0, x1, y0 - 0.012, y0 + 0.012, F2, F2 + sk, bev=0.003)
        kit.span(WALL_W, x0, x1, y1 - 0.012, y1 + 0.012, F2, F2 + sk, bev=0.003)
        kit.span(WALL_W, x0 - 0.012, x0 + 0.012, y0, y1, F2, F2 + sk, bev=0.003)
        kit.span(WALL_W, x1 - 0.012, x1 + 0.012, y0, y1, F2, F2 + sk, bev=0.003)

    # ── doors ───────────────────────────────────────────────────────────────
    leaf_door(kit, "y", X1 - EXT / 2, D_ENTRY, glazed=True)
    slider(kit, "x", SPINE, D_S4, thick=INT * 2, slide=-1.0, open_frac=0.80)
    door_case(kit, "x", SPINE, D_S3, thick=INT * 2)
    slider(kit, "y", BATH_E, D_BATH, thick=INT, slide=-1.0, open_frac=0.75)
    terrace_doors(kit)

    # ── windows ─────────────────────────────────────────────────────────────
    window(kit, "x", Y0 + EXT / 2, W_TERR, F2, curtain_c=SHEER)
    window(kit, "x", Y1 - EXT / 2, W_N, F2, curtain_c=SHEER)
    window(kit, "y", X0 + EXT / 2, W_KIT_W, F2, curtain_c=SHEER)
    window(kit, "y", X0 + EXT / 2, W_BATH_W, F2, curtain_c=None)
    window(kit, "y", NX0 + EXT / 2, W_S4_W, F2, curtain_c=TEAL)
    window(kit, "y", X1 - EXT / 2, W_S3_E, F2, curtain_c=SHEER)

    terrace(kit)
    outside_stair(kit)
    bathroom(kit)
    kitchen(kit)
    living(kit)
    bedroom_east(kit)
    bedroom_west(kit)


def terrace_doors(kit):
    """The 220 opening on to the terrace: two glazed leaves, and folded back
    outside them the louvred shutters that make the room stripey at four."""
    a0, a1, z0, z1 = D_TERR
    at = Y0 + EXT / 2
    reveal(kit, "x", at, a0, a1, F2 + z0, F2 + z1, EXT, colour=WALL, floor=F2)
    for p, q in ((a0, (a0 + a1) / 2), ((a0 + a1) / 2, a1)):
        f = 0.055
        kit.span(PINE, p, p + f, at - 0.035, at + 0.035, F2, F2 + z1, bev=0.004)
        kit.span(PINE, q - f, q, at - 0.035, at + 0.035, F2, F2 + z1, bev=0.004)
        kit.span(PINE, p, q, at - 0.035, at + 0.035, F2 + z1 - f, F2 + z1,
                 bev=0.004)
        kit.span(PINE, p, q, at - 0.030, at + 0.030, F2 + 0.02, F2 + 0.16,
                 bev=0.004)
        kit.span(GLASS, p + f, q - f, at - 0.007, at + 0.007,
                 F2 + 0.16, F2 + z1 - f, bev=0.001)
    kit.span(CHROME, (a0 + a1) / 2 - 0.06, (a0 + a1) / 2 + 0.06,
             at - 0.070, at - 0.030, F2 + 1.02, F2 + 1.10, bev=0.004)
    for p, q in ((a0 - 0.72, a0 - 0.02), (a1 + 0.02, a1 + 0.72)):
        louvred(kit, "x", at - EXT / 2 - 0.10, p, q, F2 + 0.05, F2 + z1,
                open_to=-1)


def chimney(kit, top=CHIMNEY):
    """It is on all four elevations and it goes to +7.82, which is the highest
    thing on the house — worth the twelve boxes it costs."""
    cx, cy = IX0 + 0.32, -0.62
    kit.span(RENDER, cx - 0.24, cx + 0.24, cy - 0.24, cy + 0.24,
             CEILZ - 0.20, top - 0.18, bev=0.02)
    kit.span(RENDER, cx - 0.30, cx + 0.30, cy - 0.30, cy + 0.30,
             top - 0.18, top - 0.08, bev=0.02)
    kit.span(DARKMETAL, cx - 0.13, cx + 0.13, cy - 0.13, cy + 0.13,
             top - 0.08, top, bev=0.01)


# --------------------------------------------------------------------------- #
#  the terrace and the way up to it                                            #
# --------------------------------------------------------------------------- #

def terrace(kit):
    """Six metres eighty by two twenty, the whole south face, over the one
    below it. It is the room this house is actually lived in."""
    kit.span(CONCRETE, X0, X1, TER_Y0, TER_Y1 + 0.10,
             TER_Z - 0.22, TER_Z - 0.03, bev=0.02)
    floor_tiles(kit, X0 + 0.02, X1 - 0.02, TER_Y0 + 0.02, TER_Y1,
                TER_Z, size=0.33, colour=TERRAZZO, accent=None,
                grout=tuple(v * 0.85 for v in TERRAZZO))
    railing(kit, [(X0 + 0.06, TER_Y0 + 0.06), (X1 - 0.06, TER_Y0 + 0.06)],
            TER_Z, 1.06, bars=4)
    railing(kit, [(X0 + 0.06, TER_Y0 + 0.06), (X0 + 0.06, TER_Y1)],
            TER_Z, 1.06, bars=4)
    railing(kit, [(X1 - 0.06, TER_Y0 + 0.06), (X1 - 0.06, TER_Y1)],
            TER_Z, 1.06, bars=4)
    awning(kit)
    # The round table and its four chairs, drawn on the plan and in the video.
    plastic_table(kit, -1.55, TER_Y0 + 1.05, TER_Z, r=0.46)
    for i, yaw in enumerate((0.2, 1.75, 3.3, 4.85)):
        plastic_chair(kit, -1.55 + math.cos(yaw) * 0.78,
                      TER_Y0 + 1.05 + math.sin(yaw) * 0.78, TER_Z,
                      yaw=yaw + math.pi / 2)
    plastic_chair(kit, 1.65, TER_Y0 + 1.35, TER_Z, yaw=-0.5)


def railing(kit, pts, z, h, bars=4):
    """Stainless: 42 mm posts, a top rail and horizontal bars between them.

    Nothing about this is Dalmatian and it is on every balcony built here after
    about 1998, which is why it is worth drawing rather than substituting the
    stone balustrade the town would suggest. Runs are axis-aligned, which every
    run on this house is, so a bar is a box and not a swept section."""
    r = 0.021
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(2, int(round(L / 1.35)) + 1)
        for i in range(n):
            t = i / (n - 1)
            px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            bm_cylinder(kit.bm(STEEL, 0.002), px, py, z, z + h, r, r, seg=10)
        for j in range(bars + 1):
            zz = z + 0.16 + (h - 0.16) * j / bars
            rr = 0.028 if j == bars else 0.016
            kit.span(STEEL, min(x0, x1) - (rr if x0 == x1 else 0.0),
                     max(x0, x1) + (rr if x0 == x1 else 0.0),
                     min(y0, y1) - (rr if y0 == y1 else 0.0),
                     max(y0, y1) + (rr if y0 == y1 else 0.0),
                     zz - rr, zz + rr, bev=0.004)


def awning(kit):
    """The folding-arm awning over the terrace doors, out and slightly dropped."""
    z = F2 + 2.30
    kit.span(WHITEGOODS, D_TERR[0] - 0.40, D_TERR[1] + 0.40, Y0 - 0.02, Y0 + 0.10,
             z, z + 0.16, bev=0.01)
    drop = 0.34
    x0, x1 = D_TERR[0] - 0.38, D_TERR[1] + 0.38
    y0, y1 = Y0 - 0.06, Y0 - 2.05
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in (
        (x0, y0, z), (x1, y0, z), (x1, y1, z - drop), (x0, y1, z - drop))]
    bm.faces.new(tuple(v))
    for i in range(9):
        a = x0 + (x1 - x0) * i / 9
        b = x0 + (x1 - x0) * (i + 1) / 9
        s = 0.10 + 0.06 * math.sin(i * 1.1)
        w = [bm.verts.new(p) for p in (
            (a, y1, z - drop), (b, y1, z - drop),
            (b, y1 - 0.02, z - drop - s), (a, y1 - 0.02, z - drop - s))]
        bm.faces.new(tuple(w))
    ob = new_object(bm, "awning", recalc=False)
    solidify(ob, 0.012)
    kit.adopt(ob, AWNING)
    for x in (x0 + 0.25, x1 - 0.25):
        kit.span(WHITEGOODS, x - 0.028, x + 0.028, y1 - 0.05, y0,
                 z - drop - 0.03, z - drop + 0.03, bev=0.004)
    kit.span(WHITEGOODS, x0, x1, y1 - 0.05, y1 + 0.03,
             z - drop - 0.045, z - drop + 0.045, bev=0.006)


def outside_stair(kit):
    """Seventeen risers of 17 and sixteen goings of 25, up the east face.

    It is dimensioned on the plan and drawn on the east elevation, and it is
    the reason the upper floor is at +2.90 rather than at a round number."""
    for i in range(ST_N):
        y1 = ST_BOT + ST_GO * i
        y0 = y1 - ST_GO
        z = GRADE + ST_RISE * (i + 1)
        kit.span(CONCRETE, ST_X - ST_W / 2, ST_X + ST_W / 2, y0, y1 + 0.02,
                 z - 0.16, z, bev=0.010)
        kit.span(PLINTH, ST_X - ST_W / 2, ST_X + ST_W / 2, y0 - 0.005, y0 + 0.02,
                 z - ST_RISE, z - 0.16, bev=0.006)
    # The landing at the top, in front of the door.
    kit.span(CONCRETE, X1 - 0.02, ST_X + ST_W / 2, ST_TOP - 0.02, ST_TOP + 1.10,
             F2 - 0.18, F2 - 0.02, bev=0.015)
    kit.span(CONCRETE, X1, ST_X + ST_W / 2 + 0.04, ST_TOP - 0.06, ST_TOP + 1.14,
             F2 - 0.44, F2 - 0.18, bev=0.02)
    # A stainless rail down the open side, following the pitch.
    r = 0.021
    rx = ST_X + ST_W / 2 - 0.06
    for i in range(0, ST_N + 1, 3):
        y = ST_BOT - ST_GO + ST_GO * i
        z = GRADE + ST_RISE * i
        bm_cylinder(kit.bm(STEEL, 0.002), rx, y, z, z + 1.02, r, r, seg=10)
    bm = bmesh.new()
    for d in (0.0, -0.34, -0.68):
        n = 10
        pts = []
        for i in range(n + 1):
            t = i / n
            y = (ST_BOT - ST_GO) + (ST_GO * ST_N) * t
            z = GRADE + (ST_RISE * ST_N) * t + 1.02 + d
            pts.append((y, z))
        for i in range(n):
            (ya, za), (yb, zb) = pts[i], pts[i + 1]
            ang = math.atan2(zb - za, yb - ya)
            L = math.hypot(yb - ya, zb - za)
            vs = bm_box(bm, 0, 0, 0, 0.026, L, 0.026)
            c, s = math.cos(ang), math.sin(ang)
            for v in vs:
                px, py, pz = v.co
                v.co = (rx + px, (ya + yb) / 2 + py * c - pz * s,
                        (za + zb) / 2 + py * s + pz * c)
    ob = new_object(bm, "stair_rail")
    bevel(ob, 0.004)
    kit.adopt(ob, STEEL)
    railing(kit, [(rx, ST_TOP), (rx, ST_TOP + 1.10)], F2 - 0.02, 1.04, bars=3)
    railing(kit, [(rx, ST_TOP + 1.10), (X1, ST_TOP + 1.10)], F2 - 0.02, 1.04,
            bars=3)


# --------------------------------------------------------------------------- #
#  fit-out                                                                     #
# --------------------------------------------------------------------------- #

def kitchen(kit):
    """Along the south face of the bathroom box, exactly as drawn: sink at the
    west end under the window, then the worktop, then the hob."""
    x0, x1, y0, y1 = ROOMS["kitchen"]
    top = F2 + 0.90
    run0, run1 = x0 + 0.02, x0 + 2.30

    kit.span(KITCH_LO, run0, run1, y1 - 0.60, y1 - 0.02, F2 + 0.10, top - 0.04,
             bev=0.004)
    kit.span(PLINTH, run0, run1, y1 - 0.56, y1 - 0.06, F2, F2 + 0.10, bev=0.004)
    kit.span(WORKTOP, run0 - 0.02, run1 + 0.02, y1 - 0.63, y1, top - 0.04, top,
             bev=0.006)
    for i in range(4):
        d = run0 + 0.10 + i * ((run1 - run0 - 0.20) / 4)
        kit.span(tuple(v * 0.92 for v in KITCH_LO), d, d + 0.006,
                 y1 - 0.605, y1 - 0.03, F2 + 0.12, top - 0.06, bev=0.001)
        kit.span(CHROME, d + 0.14, d + 0.30, y1 - 0.615, y1 - 0.60,
                 top - 0.16, top - 0.14, bev=0.002)
    tiled_face(kit, "x", y1 - 0.005, run0 - 0.06, run1 + 0.30, top, top + 0.62,
               face=-1, size=0.155, colour=TILE_WALL, accent=None, accent_p=0)
    cab0, cab1 = run0 + 0.62, run1 + 0.02
    kit.span(KITCH_UP, cab0, cab1, y1 - 0.34, y1 - 0.02,
             F2 + 1.52, F2 + 2.24, bev=0.005)
    for i in range(1, 3):
        d = cab0 + i * ((cab1 - cab0) / 3)
        kit.span(tuple(v * 0.9 for v in KITCH_UP), d, d + 0.006,
                 y1 - 0.345, y1 - 0.03, F2 + 1.54, F2 + 2.22, bev=0.001)
    for i in range(3):
        c = cab0 + 0.10 + i * ((cab1 - cab0) / 3)
        kit.span(CHROME, c, c + 0.012, y1 - 0.36, y1 - 0.345,
                 F2 + 1.62, F2 + 1.86, bev=0.002)
    kit.span(WHITEGOODS, cab0, cab1, y1 - 0.36, y1 - 0.02,
             F2 + 2.24, F2 + 2.36, bev=0.006)
    for i in range(3):
        c = cab0 + 0.06 + i * 0.32
        kit.span((0.86, 0.80, 0.72), c, c + 0.26, y1 - 0.32, y1 - 0.06,
                 F2 + 2.36, F2 + 2.36 + RNG.uniform(0.10, 0.22), bev=0.004)

    sx = run0 + 0.08
    kit.span((0.72, 0.73, 0.74), sx, sx + 0.50, y1 - 0.54, y1 - 0.10,
             top - 0.14, top - 0.005, bev=0.006)
    kit.span(CHROME, sx + 0.22, sx + 0.28, y1 - 0.60, y1 - 0.56,
             top, top + 0.26, bev=0.004)
    kit.span(CHROME, sx + 0.22, sx + 0.28, y1 - 0.56, y1 - 0.38,
             top + 0.22, top + 0.26, bev=0.004)

    cx = run1 - 0.66
    kit.span(WHITEGOODS, cx, cx + 0.60, y1 - 0.62, y1 - 0.02, F2, top, bev=0.006)
    kit.span((0.80, 0.80, 0.79), cx + 0.01, cx + 0.59, y1 - 0.60, y1 - 0.04,
             top, top + 0.012, bev=0.003)
    for i in range(2):
        for j in range(2):
            bm_cylinder(kit.bm(DARKMETAL, 0.003),
                        cx + 0.17 + i * 0.26, y1 - 0.46 + j * 0.26,
                        top + 0.010, top + 0.022, 0.085, 0.085, seg=14)
    kit.span(BLACK, cx + 0.05, cx + 0.55, y1 - 0.64, y1 - 0.625,
             F2 + 0.30, F2 + 0.62, bev=0.004)
    kit.span(CHROME, cx + 0.03, cx + 0.57, y1 - 0.70, y1 - 0.655,
             F2 + 0.68, F2 + 0.72, bev=0.004)
    kit.span(WHITEGOODS, cx, cx + 0.60, y1 - 0.70, y1 - 0.62,
             F2 + 0.74, top, bev=0.006)
    for i in range(4):
        bm_cylinder(kit.bm((0.85, 0.85, 0.84), 0.002),
                    cx + 0.10 + i * 0.13, y1 - 0.71, F2 + 0.80, F2 + 0.86,
                    0.022, 0.022, seg=10)

    # The fridge goes on the south wall on the far side of the terrace window
    # from the kitchen, with the television stand between it and the terrace
    # doors: reading along that wall toward the door it is window, fridge,
    # television, which is the order in the photograph. Absolute coordinates,
    # because it has ended up just outside the kitchen rectangle and the room
    # it is really in is the one big room anyway.
    fx, fy = -0.88, IY0 + 0.02
    kit.span(WHITEGOODS, fx, fx + 0.62, fy, fy + 0.64, F2, F2 + 1.86, bev=0.008)
    kit.span(FRIDGE_RED, fx + 0.02, fx + 0.60, fy + 0.64, fy + 0.68,
             F2 + 0.04, F2 + 1.16, bev=0.006)
    kit.span(FRIDGE_RED, fx + 0.02, fx + 0.60, fy + 0.64, fy + 0.68,
             F2 + 1.20, F2 + 1.84, bev=0.006)
    kit.span(WHITEGOODS, fx + 0.04, fx + 0.10, fy + 0.68, fy + 0.72,
             F2 + 0.80, F2 + 1.10, bev=0.004)
    kit.span(WHITEGOODS, fx + 0.04, fx + 0.10, fy + 0.68, fy + 0.72,
             F2 + 1.26, F2 + 1.56, bev=0.004)
    for _ in range(20):
        mx = fx + RNG.uniform(0.05, 0.55)
        mz = F2 + RNG.uniform(0.55, 1.80)
        c = RNG.choice([(0.9, 0.85, 0.3), (0.2, 0.4, 0.8), (0.9, 0.9, 0.88),
                        (0.15, 0.55, 0.35), (0.85, 0.5, 0.2)])
        kit.span(c, mx, mx + RNG.uniform(0.035, 0.065), fy + 0.68, fy + 0.688,
                 mz, mz + RNG.uniform(0.035, 0.06), bev=0.002)

    ceiling_light(kit, (x0 + x1) / 2, y1 - 1.00)


def bathroom(kit):
    """Two thirty-five by one sixty-five, a box in the north-west corner of the
    big room, with the WC and the shower against the west wall."""
    x0, x1, y0, y1 = ROOMS["bath"]
    for axis, at, a0, a1, face in (("x", y0 + 0.01, x0, x1, 1),
                                   ("x", y1 - 0.01, x0, x1, -1),
                                   ("y", x0 + 0.01, y0, y1, 1),
                                   ("y", x1 - 0.01, y0, y1, -1)):
        tiled_face(kit, axis, at, a0, a1, F2 + 0.02, F2 + 2.05, face=face,
                   size=0.175, accent=TILE_DEEP, accent_p=0.045)

    # Shower in the north-west corner, under the high window.
    sx, sy = x0 + 0.02, y1 - 0.88
    kit.span(WHITEGOODS, sx, sx + 0.84, sy, y1 - 0.02, F2 + 0.02, F2 + 0.14,
             bev=0.012)
    kit.span((0.86, 0.87, 0.88), sx + 0.04, sx + 0.80, sy + 0.06, y1 - 0.06,
             F2 + 0.10, F2 + 0.125, bev=0.004)
    kit.span(CHROME, sx + 0.04, sx + 0.10, y1 - 0.18, y1 - 0.12,
             F2 + 1.05, F2 + 1.20, bev=0.004)
    bm_cylinder(kit.bm(CHROME, 0.003), sx + 0.07, y1 - 0.15,
                F2 + 1.20, F2 + 1.92, 0.014, 0.014, seg=8)
    kit.span(CHROME, sx, sx + 0.86, sy - 0.02, sy + 0.02, F2 + 1.94, F2 + 1.97,
             bev=0.004)
    curtain(kit, "x", sy + 0.03, sx + 0.54, sx + 0.86, F2 + 0.16, F2 + 1.94,
            colour=(0.35, 0.70, 0.80), amp=0.03)

    # WC against the west wall, basin beside it, all on the same drain run.
    ty = y0 + 0.42
    kit.span(WHITEGOODS, x0 + 0.02, x0 + 0.30, ty - 0.19, ty + 0.19,
             F2 + 0.02, F2 + 0.42, bev=0.03)
    kit.span(WHITEGOODS, x0 + 0.06, x0 + 0.44, ty - 0.20, ty + 0.20,
             F2 + 0.36, F2 + 0.44, bev=0.05)
    kit.span((0.84, 0.84, 0.83), x0 + 0.07, x0 + 0.43, ty - 0.19, ty + 0.19,
             F2 + 0.44, F2 + 0.465, bev=0.02)
    kit.span(WHITEGOODS, x0 + 0.02, x0 + 0.20, ty - 0.20, ty + 0.20,
             F2 + 0.42, F2 + 0.86, bev=0.02)

    vx = x0 + 1.12
    kit.span(WHITEGOODS, vx, vx + 0.56, y0 + 0.02, y0 + 0.42, F2 + 0.04,
             F2 + 0.78, bev=0.006)
    kit.span(WHITEGOODS, vx - 0.04, vx + 0.62, y0, y0 + 0.48, F2 + 0.78,
             F2 + 0.86, bev=0.03)
    kit.span((0.88, 0.89, 0.90), vx + 0.04, vx + 0.54, y0 + 0.06, y0 + 0.42,
             F2 + 0.80, F2 + 0.845, bev=0.02)
    kit.span(CHROME, vx + 0.26, vx + 0.32, y0 + 0.06, y0 + 0.12,
             F2 + 0.86, F2 + 1.06, bev=0.004)
    kit.span(CHROME, vx + 0.26, vx + 0.32, y0 + 0.12, y0 + 0.26,
             F2 + 1.02, F2 + 1.06, bev=0.004)
    kit.span((0.72, 0.78, 0.80), vx - 0.02, vx + 0.58, y0 + 0.012, y0 + 0.03,
             F2 + 1.20, F2 + 1.84, bev=0.004)
    kit.span(CHROME, vx - 0.06, vx + 0.62, y0 + 0.02, y0 + 0.20,
             F2 + 1.16, F2 + 1.19, bev=0.004)

    wx = x1 - 0.64
    kit.span(WHITEGOODS, wx, wx + 0.58, y0 + 0.02, y0 + 0.60, F2 + 0.02,
             F2 + 0.87, bev=0.008)
    _lay_disc(kit, DARKMETAL, wx + 0.29, y0 + 0.015, F2 + 0.46, 0.19, 0.03)
    _lay_disc(kit, (0.55, 0.60, 0.62), wx + 0.29, y0 + 0.00, F2 + 0.46,
              0.150, 0.02)
    kit.span((0.82, 0.82, 0.81), wx + 0.02, wx + 0.56, y0 + 0.00, y0 + 0.02,
             F2 + 0.74, F2 + 0.84, bev=0.004)
    kit.span(WHITEGOODS, x1 - 0.50, x1 - 0.04, y1 - 0.28, y1 - 0.04,
             F2 + 1.42, F2 + 2.02, bev=0.010)
    for c in (x1 - 0.42, x1 - 0.28, x1 - 0.14):
        bm_cylinder(kit.bm(CHROME, 0.002), c, y1 - 0.16, F2 + 1.30, F2 + 1.42,
                    0.014, 0.014, seg=8)
    bm_cylinder(kit.bm((0.80, 0.15, 0.14), 0.006), x1 - 0.28, y0 + 0.80,
                F2 + 0.02, F2 + 0.30, 0.16, 0.19, seg=14)
    ceiling_light(kit, (x0 + x1) / 2, (y0 + y1) / 2, dome=True)


def _lay_disc(kit, colour, cx, cy, cz, r, t):
    """A disc facing -Y — a washing-machine door, a wheel, a clock."""
    vs = bm_cylinder(kit.bm(colour, 0.003), 0, 0, -t / 2, t / 2, r, r, seg=18)
    for v in vs:
        x, y, z = v.co
        v.co = (cx + x, cy + z, cz + y)


def _plate(kit, colour, poly, y0, y1, bev=0.003):
    """A flat shape on a wall: a closed (x, z) polygon extruded along y.

    Everything else in this house is a box because everything else in this house
    *is* a box. A fish is not, and the one thing on these walls that anybody has
    ever remarked on is a fish, so there is one general-purpose silhouette
    primitive and this is it.

    The winding is forced rather than trusted. A face's normal is the cross
    product of its first two edges, and getting it backwards on a plate this
    thin does not look like a reversed normal — it looks like the object is
    simply not there, because you are seeing its inside from outside. So the
    polygon is turned anticlockwise here whatever order it arrives in, and the
    side quads are wound `front, back, back, front`, which is the order that
    puts their normals outward and is the opposite of the one that reads right.
    """
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1]
               - poly[(i + 1) % len(poly)][0] * poly[i][1]
               for i in range(len(poly)))
    if area < 0:
        poly = list(reversed(poly))
    bm = kit.bm(colour, bev)
    lo = [bm.verts.new((x, y0, z)) for x, z in poly]
    hi = [bm.verts.new((x, y1, z)) for x, z in poly]
    bm.verts.ensure_lookup_table()
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], hi[i], hi[j], lo[j]))
    bm.faces.new(tuple(lo))
    bm.faces.new(tuple(reversed(hi)))


FISH_BODY = (0.46, 0.75, 0.88)
FISH_FIN = (0.13, 0.47, 0.72)
FISH_NUM = (0.95, 0.53, 0.47)


def fish_clock(kit, cx, cz, wall, r=0.178):
    """The fish.

    A cut and painted ply fish with a quartz movement through the middle of it,
    pale blue with darker blue fins and stripes, coral numbers and black hands,
    and one round eye with a white highlight in it. It hangs on the spine wall
    between the two bedroom doors and it is, by a distance, the most-photographed
    object in the flat.

    `r` is the body's semi-major axis, so the whole fish including its tail is
    about 3.3 r long — 0.50 m at the default, which is a wall clock and not a
    decoration. Built out of convex pieces that overlap rather than as one
    concave outline: a fish is a body, a snout, two fins and a forked tail, and
    five convex plates that intersect are five plates that triangulate, where
    one twenty-eight-point concave ngon is a coin toss.
    """
    face = wall - 0.016            # the front of the ply, into the room
    P = lambda poly, col, y0, y1, bev=0.003: _plate(  # noqa: E731
        kit, col, [(cx + px * r, cz + pz * r) for px, pz in poly], y0, y1, bev)

    # Fins and tail first and a hair deeper, so the body reads as sitting on
    # top of them the way the paint does.
    fin_face = face + 0.004
    P([(-0.02, 1.44), (-0.32, 0.74), (0.38, 0.70)], FISH_FIN, fin_face, wall)
    P([(-0.10, -1.38), (-0.36, -0.72), (0.28, -0.76)], FISH_FIN, fin_face, wall)
    # The tail in three: the peduncle that carries it off the body, then the two
    # lobes of the fan. Two lobes alone leave a wedge of bare wall between the
    # body and the fork, which reads as a fish that has come apart.
    P([(0.55, 0.38), (1.30, 0.15), (1.30, -0.15), (0.55, -0.38)],
      FISH_FIN, fin_face, wall)
    P([(1.18, 0.12), (1.82, 0.94), (1.62, 0.02)], FISH_FIN, fin_face, wall)
    P([(1.18, -0.12), (1.82, -0.94), (1.62, 0.02)], FISH_FIN, fin_face, wall)

    body = [(math.cos(TAU * i / 30), 0.86 * math.sin(TAU * i / 30))
            for i in range(30)]
    P(body, FISH_BODY, face, wall, bev=0.005)
    P([(-0.80, 0.42), (-0.80, -0.40), (-1.60, -0.04)], FISH_BODY, face, wall,
      bev=0.005)
    # The mouth: a notch of the darker blue at the tip of the snout.
    P([(-1.58, -0.05), (-1.16, 0.10), (-1.14, -0.20)], FISH_FIN,
      face - 0.002, face + 0.004)

    # Four stripes, each a tapered crescent leaning back the way they do on the
    # real one. Kept inside |x| < 0.77 at the top and bottom, which is where the
    # ellipse is at z = ±0.55 — a stripe that runs off the fish is a stripe that
    # floats on the wall beside it.
    for k in range(4):
        x0 = -0.46 + k * 0.36
        P([(x0 - 0.05, 0.54), (x0 + 0.07, 0.56), (x0 + 0.30, -0.52),
           (x0 + 0.18, -0.56)], FISH_FIN, face - 0.002, face + 0.004)

    # The eye, and the highlight in it that makes it an eye rather than a hole.
    _lay_disc(kit, FISH_FIN, cx - 0.60 * r, face - 0.004, cz + 0.36 * r,
              0.23 * r, 0.010)
    _lay_disc(kit, (0.97, 0.97, 0.95), cx - 0.54 * r, face - 0.008,
              cz + 0.42 * r, 0.11 * r, 0.010)

    # Twelve coral numbers on a 0.62 r circle, about the movement rather than
    # about the body: the spindle is forward of centre because the tail is
    # behind it, and the numbers go round the spindle.
    mx, mz = cx + 0.12 * r, cz
    for h in range(12):
        a = TAU * (h / 12.0)
        w = 0.014 if h % 3 == 0 else 0.011
        px = mx + math.sin(a) * 0.62 * r
        pz = mz + math.cos(a) * 0.62 * r
        kit.span(FISH_NUM, px - w, px + w, face - 0.008, face - 0.001,
                 pz - w * 1.25, pz + w * 1.25, bev=0.002)

    # Hands at ten past ten, which is how every clock in every photograph of a
    # clock is set, for the good reason that it is the one position where
    # neither hand is behind the other and neither is over a number. Rectangles
    # turned about the spindle, because a hand is a plate and not a box.
    #
    # Zero points at twelve and the angle runs anticlockwise, so ten o'clock is
    # +60° and ten past is −60°.
    def hand(ang, length, half, col=BLACK):
        c, s = math.cos(ang), math.sin(ang)
        pts = [(-half, -half * 1.6), (half, -half * 1.6), (half, length),
               (-half, length)]
        P([((mx - cx) / r + (px * c - pz * s) / r,
            (mz - cz) / r + (px * s + pz * c) / r) for px, pz in pts],
          col, face - 0.014, face - 0.008, bev=0.002)

    hand(math.radians(60.0), 0.062, 0.010)       # hours, at ten
    hand(math.radians(-60.0), 0.088, 0.007)      # minutes, at ten past
    _lay_disc(kit, BLACK, mx, face - 0.016, mz, 0.016, 0.008)


def living(kit):
    """Dnevni boravak, blagovaonica and the way in, all one room of 23.76 m².

    The plan puts a 390 sofa across the middle of it and two armchairs on the
    east by the front door, the dining table in the south-west by the terrace
    window, and that is what is here."""
    x0, x1, y0, y1 = ROOMS["living"]

    # The sofa's back is on the bathroom, not on the bedroom wall: it sits
    # beside the opening into the bathroom looking back down the room, which
    # is what the photograph shows and what leaves the middle of the floor
    # clear between the front door and the terrace.
    sofa(kit, -0.30, -1.05, yaw=-math.pi / 2, length=1.28, depth=0.66,
         colour=SOFA_TAP, throw=RED_THROW)
    # One armchair, pulled round to face the sofa across the low table.
    low_chair(kit, 1.62, -1.05, yaw=math.pi / 2)
    round_table(kit, 0.76, -1.05, F2, r=0.32, h=0.44)
    kit.span((0.85, 0.85, 0.84), 0.71, 0.81, -1.09, -1.01, F2 + 0.44,
             F2 + 0.52, bev=0.006)

    # The dining table in the south-west corner, under the terrace window.
    tx, ty = -2.70, -2.90
    kit.span(BEECH, tx - 0.55, tx + 0.55, ty - 0.40, ty + 0.40,
             F2 + 0.72, F2 + 0.76, bev=0.006)
    for dx, dy in ((-0.48, -0.33), (-0.48, 0.28), (0.43, -0.33), (0.43, 0.28)):
        kit.span(BEECH, tx + dx, tx + dx + 0.05, ty + dy, ty + dy + 0.05,
                 F2, F2 + 0.72, bev=0.004)
    # On the room side of the table looking back at it, not tucked into
    # the kitchen aisle with the cooker at its elbow.
    wooden_chair(kit, tx + 0.98, ty, F2, yaw=math.pi)
    kit.span((0.86, 0.84, 0.80), tx - 0.20, tx + 0.06, ty - 0.14, ty + 0.14,
             F2 + 0.76, F2 + 0.79, bev=0.004)

    # The white plastic garden table that lives indoors and is the desk.
    kit.span(PLASTIC_W, 0.90, 1.80, -3.30, -2.40, F2 + 0.70, F2 + 0.74,
             bev=0.008)
    for dx, dy in ((0.95, -3.25), (0.95, -2.51), (1.69, -3.25), (1.69, -2.51)):
        kit.span(PLASTIC_W, dx, dx + 0.055, dy, dy + 0.055, F2, F2 + 0.70,
                 bev=0.005)
    plastic_chair(kit, 1.35, -2.00, F2, yaw=-math.pi / 2 + 0.15)
    laptop(kit, 1.35, -2.85, F2 + 0.74)

    # TV on a low cabinet against the south wall, in the gap between the
    # terrace window and the terrace doors. On the east wall — where it was —
    # it stood squarely across the front door.
    kit.span(WHITEGOODS, -0.16, 0.50, y0 + 0.02, y0 + 0.44, F2, F2 + 0.66,
             bev=0.006)
    kit.span(BLACK, 0.10, 0.24, y0 + 0.16, y0 + 0.22, F2 + 0.66, F2 + 0.72,
             bev=0.004)
    kit.span(BLACK, -0.12, 0.46, y0 + 0.17, y0 + 0.21, F2 + 0.72, F2 + 1.19,
             bev=0.004)
    kit.span((0.10, 0.11, 0.13), -0.10, 0.44, y0 + 0.212, y0 + 0.218,
             F2 + 0.74, F2 + 1.17, bev=0.002)

    bookshelf(kit, 2.10, BY0 - 0.16, F2)
    kit.span(WHITEGOODS, -0.80, -0.12, y0 + 0.02, y0 + 0.44, F2, F2 + 0.84,
             bev=0.006)
    for j in range(3):
        kit.span((0.86, 0.86, 0.85), -0.77, -0.15, y0 + 0.44, y0 + 0.455,
                 F2 + 0.06 + j * 0.25, F2 + 0.26 + j * 0.25, bev=0.006)
    vacuum(kit, x1 - 0.42, -2.95, F2)
    kit.span(TEAL, 1.60, 2.60, -0.30, 0.50, F2 + 0.010, F2 + 0.022, bev=0.004)
    pictures(kit)
    ceiling_light(kit, 1.35, -0.55)
    ceiling_light(kit, -1.70, -2.50)


def bedroom_east(kit):
    """Soba 3, 8.01 m², the bigger one — the double bed against the north wall
    and the wardrobe along the spine, exactly as drawn."""
    x0, x1, y0, y1 = ROOMS["soba3"]
    bed(kit, (x0 + x1) / 2 - 0.16, y1 - 1.16, yaw=math.pi / 2, w=1.42, l=2.00)
    kit.span(WALNUT, x0 + 0.06, x0 + 0.46, y1 - 0.52, y1 - 0.12, F2, F2 + 0.52,
             bev=0.006)
    bm_cylinder(kit.bm((0.86, 0.84, 0.78), 0.006), x0 + 0.26, y1 - 0.32,
                F2 + 0.52, F2 + 0.74, 0.09, 0.12, seg=14)
    # The 182 wardrobe on the spine wall, dark and enormous, as it is.
    kit.span(WALNUT, x1 - 1.86, x1 - 0.04, y0 + 0.04, y0 + 0.60, F2, F2 + 2.02,
             bev=0.008)
    for d in (x1 - 1.25, x1 - 0.64):
        kit.span(tuple(v * 0.7 for v in WALNUT), d - 0.006, d + 0.006,
                 y0 + 0.60, y0 + 0.62, F2 + 0.06, F2 + 1.98, bev=0.002)
    for c in (x1 - 1.35, x1 - 1.16, x1 - 0.74, x1 - 0.55):
        kit.span(BEECH, c, c + 0.026, y0 + 0.62, y0 + 0.66, F2 + 1.02,
                 F2 + 1.16, bev=0.004)
    fan(kit, x1 - 0.36, y1 - 0.42, F2)
    ceiling_light(kit, (x0 + x1) / 2, (y0 + y1) / 2, sun=True)


def bedroom_west(kit):
    """Soba 4, 7.69 m², with the bed against the west wall under its window and
    a window on the north as well — the only room in the flat with two."""
    x0, x1, y0, y1 = ROOMS["soba4"]
    bed(kit, x0 + 1.10, y1 - 1.20, yaw=0.0, w=1.40, l=1.98)
    kit.span(WALNUT, x1 - 0.46, x1 - 0.06, y1 - 0.52, y1 - 0.12, F2, F2 + 0.52,
             bev=0.006)
    kit.span(WALNUT, x1 - 0.62, x1 - 0.04, y0 + 0.04, y0 + 0.62, F2, F2 + 1.90,
             bev=0.008)
    for c in (x1 - 0.30, x1 - 0.16):
        kit.span(BEECH, c, c + 0.024, y0 + 0.62, y0 + 0.66, F2 + 1.00,
                 F2 + 1.14, bev=0.004)
    kit.span(LINEN, x0 + 0.30, x0 + 0.66, y0 + 0.30, y0 + 0.70, F2 + 0.44,
             F2 + 0.58, bev=0.02)
    ceiling_light(kit, (x0 + x1) / 2, (y0 + y1) / 2, dome=True)


# ------------------------------------------------------------------ furniture --

def sofa(kit, cx, cy, yaw, length, colour, throw=None, depth=0.86):
    """A two- or three-seater with a throw over it. Built along +X and rotated,
    because every soft thing in this flat is at a different angle to the walls."""
    bm = bmesh.new()
    d, h = depth, 0.42
    bm_box(bm, 0, 0, h / 2 + 0.06, length, d, h)                    # seat
    bm_box(bm, 0, -d / 2 + 0.10, 0.52, length, 0.20, 0.62)          # back
    for s in (-1, 1):
        bm_box(bm, s * (length / 2 - 0.09), 0.03, 0.44, 0.18, d - 0.10, 0.46)
    ob = new_object(bm, "sofa")
    bevel(ob, 0.045, segments=2)
    _place(ob, cx, cy, F2, yaw)
    kit.adopt(ob, colour)
    if throw:
        bm = bmesh.new()
        bm_box(bm, 0, 0.03, h + 0.075, length - 0.05, d - 0.06, 0.08)
        bm_box(bm, 0, -d / 2 + 0.12, 0.62, length - 0.05, 0.13, 0.44)
        ob = new_object(bm, "throw")
        bevel(ob, 0.05, segments=2)
        _place(ob, cx, cy, F2, yaw)
        kit.adopt(ob, throw)
    # Cushions along the back — the tapestry ones with the tiger on them.
    for i in range(3):
        t = (i - 1) * (length / 3.2)
        bm = bmesh.new()
        bm_box(bm, t, -d / 2 + 0.26, 0.62, 0.38, 0.16, 0.36)
        ob = new_object(bm, "cushion")
        bevel(ob, 0.06, segments=2)
        _place(ob, cx, cy, F2, yaw + RNG.uniform(-0.1, 0.1))
        kit.adopt(ob, RNG.choice([(0.62, 0.42, 0.24), (0.80, 0.74, 0.60),
                                  (0.42, 0.22, 0.18)]))


def low_chair(kit, cx, cy, yaw):
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.20, 0.78, 0.80, 0.34)
    bm_box(bm, -0.30, 0, 0.50, 0.16, 0.76, 0.58)
    ob = new_object(bm, "chair")
    bevel(ob, 0.05, segments=2)
    _place(ob, cx, cy, F2, yaw)
    kit.adopt(ob, DAYBED)
    bm = bmesh.new()
    bm_box(bm, 0.02, 0, 0.395, 0.74, 0.76, 0.09)
    bm_box(bm, -0.26, 0, 0.56, 0.10, 0.72, 0.50)
    ob = new_object(bm, "chair_throw")
    bevel(ob, 0.055, segments=2)
    _place(ob, cx, cy, F2, yaw)
    kit.adopt(ob, RED_THROW)
    bm = bmesh.new()
    for sx in (-0.32, 0.32):
        for sy in (-0.34, 0.34):
            bm_box(bm, sx, sy, 0.02, 0.05, 0.05, 0.06)
    ob = new_object(bm, "chair_feet")
    _place(ob, cx, cy, F2, yaw)
    kit.adopt(ob, DARKMETAL)


def daybed(kit, cx, cy, yaw, l=1.92):
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.20, l, 0.82, 0.30)
    for s in (-1, 1):
        bm_box(bm, s * (l / 2 - 0.05), 0, 0.36, 0.10, 0.84, 0.62)
    bm_box(bm, 0, -0.44, 0.46, l, 0.09, 0.82)
    ob = new_object(bm, "daybed")
    bevel(ob, 0.012, segments=2)
    _place(ob, cx, cy, F2, yaw)
    kit.adopt(ob, WALNUT)
    bm = bmesh.new()
    bm_box(bm, 0, 0.02, 0.40, l - 0.14, 0.76, 0.16)
    ob = new_object(bm, "daybed_mattress")
    bevel(ob, 0.05, segments=2)
    _place(ob, cx, cy, F2, yaw)
    kit.adopt(ob, DAYBED)
    # The folded striped blanket that is on it in three of the photographs.
    for i, c in enumerate([(0.16, 0.22, 0.42), (0.20, 0.55, 0.32),
                           (0.85, 0.72, 0.20)]):
        bm = bmesh.new()
        bm_box(bm, 0.18, 0.04, 0.50 + i * 0.034, 0.46, 0.40, 0.032)
        ob = new_object(bm, "blanket")
        bevel(ob, 0.012, segments=2)
        _place(ob, cx, cy, F2, yaw)
        kit.adopt(ob, c)
    bm = bmesh.new()
    bm_box(bm, -l / 2 + 0.36, 0.06, 0.56, 0.44, 0.30, 0.18)
    ob = new_object(bm, "pillow")
    bevel(ob, 0.07, segments=2)
    _place(ob, cx, cy, F2, yaw)
    kit.adopt(ob, LINEN)


def bed(kit, cx, cy, yaw, w=1.42, l=2.00, floor=F2):
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.16, l, w, 0.24)
    bm_box(bm, -l / 2 + 0.04, 0, 0.44, 0.08, w + 0.06, 0.80)     # headboard
    bm_box(bm, l / 2 - 0.04, 0, 0.30, 0.08, w + 0.06, 0.52)      # footboard
    ob = new_object(bm, "bedframe")
    bevel(ob, 0.014, segments=2)
    _place(ob, cx, cy, floor, yaw)
    kit.adopt(ob, WALNUT)
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.40, l - 0.12, w - 0.06, 0.22)
    ob = new_object(bm, "mattress")
    bevel(ob, 0.05, segments=2)
    _place(ob, cx, cy, floor, yaw)
    kit.adopt(ob, LINEN)
    for s in (-1, 1):
        bm = bmesh.new()
        bm_box(bm, -l / 2 + 0.34, s * 0.30, 0.56, 0.44, 0.52, 0.14)
        ob = new_object(bm, "pillow")
        bevel(ob, 0.06, segments=2)
        _place(ob, cx, cy, floor, yaw + RNG.uniform(-0.12, 0.12))
        kit.adopt(ob, LINEN)
    # A duvet thrown back, and the purple cushion that is always on it.
    bm = bmesh.new()
    bm_box(bm, 0.22, -0.06, 0.53, l - 0.70, w - 0.14, 0.10)
    ob = new_object(bm, "duvet")
    bevel(ob, 0.05, segments=2)
    _place(ob, cx, cy, floor, yaw)
    kit.adopt(ob, (0.86, 0.85, 0.80))
    bm = bmesh.new()
    bm_box(bm, -0.30, 0.18, 0.60, 0.34, 0.34, 0.13)
    ob = new_object(bm, "cushion")
    bevel(ob, 0.055, segments=2)
    _place(ob, cx, cy, floor, yaw + 0.4)
    kit.adopt(ob, (0.45, 0.32, 0.62))


def wooden_chair(kit, cx, cy, z, yaw):
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.44, 0.40, 0.40, 0.035)
    for sx in (-0.16, 0.16):
        for sy in (-0.16, 0.16):
            bm_box(bm, sx, sy, 0.21, 0.036, 0.036, 0.42)
    bm_box(bm, -0.18, 0, 0.66, 0.036, 0.38, 0.46)
    for zz in (0.62, 0.78):
        bm_box(bm, -0.18, 0, zz, 0.040, 0.36, 0.07)
    ob = new_object(bm, "chair")
    bevel(ob, 0.006)
    _place(ob, cx, cy, z, yaw)
    kit.adopt(ob, BEECH)


def plastic_chair(kit, cx, cy, z, yaw):
    """The white monobloc. There are four of them in this flat and they are on
    the terrace, at the table and in front of the laptop."""
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.45, 0.44, 0.44, 0.035)
    for sx in (-0.17, 0.17):
        for sy in (-0.17, 0.17):
            bm_box(bm, sx, sy, 0.22, 0.032, 0.032, 0.44)
    bm_box(bm, -0.20, 0, 0.70, 0.030, 0.42, 0.50)
    for s in (-1, 1):
        bm_box(bm, -0.02, s * 0.21, 0.60, 0.34, 0.030, 0.030)
    ob = new_object(bm, "monobloc")
    bevel(ob, 0.010, segments=2)
    _place(ob, cx, cy, z, yaw)
    kit.adopt(ob, PLASTIC_W)


def plastic_table(kit, cx, cy, z, r=0.40):
    bm = bmesh.new()
    bm_cylinder(bm, 0, 0, 0.68, 0.72, r, r, seg=22)
    for a in range(4):
        ang = TAU * a / 4 + 0.78
        bm_box(bm, math.cos(ang) * (r - 0.09), math.sin(ang) * (r - 0.09),
               0.34, 0.05, 0.05, 0.68)
    ob = new_object(bm, "gardentable")
    bevel(ob, 0.008)
    _place(ob, cx, cy, z, 0.0)
    kit.adopt(ob, PLASTIC_W)


def round_table(kit, cx, cy, z, r=0.30, h=0.44):
    bm = bmesh.new()
    bm_cylinder(bm, 0, 0, h - 0.03, h, r, r, seg=22)
    for a in range(3):
        ang = TAU * a / 3
        bm_box(bm, math.cos(ang) * (r - 0.07), math.sin(ang) * (r - 0.07),
               (h - 0.03) / 2, 0.035, 0.035, h - 0.03)
    ob = new_object(bm, "coffeetable")
    bevel(ob, 0.006)
    _place(ob, cx, cy, z, 0.0)
    kit.adopt(ob, BEECH)


def bookshelf(kit, cx, cy, z):
    bm = bmesh.new()
    w, d, h = 0.74, 0.28, 0.86
    bm_box(bm, 0, 0, h / 2, w, d, 0.020)
    for s in (-1, 1):
        bm_box(bm, s * (w / 2 - 0.01), 0, h / 2, 0.020, d, h)
    for zz in (0.02, h / 2, h - 0.02):
        bm_box(bm, 0, 0, zz, w, d, 0.020)
    ob = new_object(bm, "shelf")
    bevel(ob, 0.004)
    _place(ob, cx, cy, z, 0.0)
    kit.adopt(ob, BEECH)
    for row, zz in ((0, 0.03), (1, h / 2 + 0.01)):
        x = -w / 2 + 0.04
        while x < w / 2 - 0.06:
            t = RNG.uniform(0.016, 0.042)
            hh = RNG.uniform(0.16, 0.26)
            bm = bmesh.new()
            bm_box(bm, x + t / 2, 0, zz + hh / 2, t, d - 0.06, hh)
            ob = new_object(bm, "book")
            bevel(ob, 0.002)
            _place(ob, cx, cy, z, 0.0)
            kit.adopt(ob, RNG.choice([(0.62, 0.18, 0.16), (0.18, 0.28, 0.48),
                                      (0.80, 0.74, 0.58), (0.22, 0.42, 0.28),
                                      (0.52, 0.44, 0.36), (0.78, 0.56, 0.20)]))
            x += t + 0.004


def vacuum(kit, cx, cy, z):
    """It is in the middle of the floor in five of the twelve photographs, so
    it is furniture."""
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.16, 0.44, 0.28, 0.26)
    bm_box(bm, -0.16, 0, 0.30, 0.12, 0.22, 0.10)
    ob = new_object(bm, "vac")
    bevel(ob, 0.035, segments=2)
    _place(ob, cx, cy, z, 0.6)
    kit.adopt(ob, (0.24, 0.24, 0.26))
    # The hose, a quarter-circle standing on end. Unmistakable in silhouette.
    bm = bmesh.new()
    n = 14
    for i in range(n):
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        r = 0.34
        p0 = (math.cos(a0) * r, 0, 0.34 + math.sin(a0) * r)
        p1 = (math.cos(a1) * r, 0, 0.34 + math.sin(a1) * r)
        L = math.hypot(p1[0] - p0[0], p1[2] - p0[2])
        vs = bm_box(bm, 0, 0, 0, L, 0.035, 0.035)
        ang = math.atan2(p1[2] - p0[2], p1[0] - p0[0])
        c, s = math.cos(ang), math.sin(ang)
        for v in vs:
            x, y, zz = v.co
            v.co = ((p0[0] + p1[0]) / 2 + x * c - zz * s, y,
                    (p0[2] + p1[2]) / 2 + x * s + zz * c)
    ob = new_object(bm, "hose")
    bevel(ob, 0.004)
    _place(ob, cx, cy, z, 0.6)
    kit.adopt(ob, (0.30, 0.30, 0.32))


def fan(kit, cx, cy, z):
    bm_cylinder(kit.bm(WHITEGOODS, 0.006), cx, cy, z, z + 0.03, 0.17, 0.17,
                seg=16)
    bm_cylinder(kit.bm(WHITEGOODS, 0.004), cx, cy, z + 0.03, z + 0.72,
                0.022, 0.022, seg=10)
    _lay_disc(kit, (0.86, 0.86, 0.85), cx, cy - 0.05, z + 0.88, 0.19, 0.03)
    _lay_disc(kit, (0.75, 0.75, 0.74), cx, cy - 0.10, z + 0.88, 0.19, 0.02)
    _lay_disc(kit, WHITEGOODS, cx, cy + 0.02, z + 0.88, 0.06, 0.10)


def kettle(kit, cx, cy, z):
    bm_cylinder(kit.bm(BLACK, 0.006), cx, cy, z, z + 0.24, 0.075, 0.070,
                seg=14)
    kit.span(BLACK, cx - 0.02, cx + 0.02, cy - 0.13, cy - 0.07, z + 0.04,
             z + 0.22, bev=0.006)


def laptop(kit, cx, cy, z):
    bm = bmesh.new()
    bm_box(bm, 0, 0, 0.010, 0.34, 0.24, 0.020)
    ob = new_object(bm, "laptop_base")
    bevel(ob, 0.004)
    _place(ob, cx, cy, z, 0.2)
    kit.adopt(ob, (0.14, 0.15, 0.17))
    bm = bmesh.new()
    vs = bm_box(bm, 0, -0.12, 0.11, 0.34, 0.012, 0.22)
    for v in vs:
        y, zz = v.co.y, v.co.z
        v.co.y = y - (zz - 0.02) * 0.38
    ob = new_object(bm, "laptop_lid")
    bevel(ob, 0.004)
    _place(ob, cx, cy, z, 0.2)
    kit.adopt(ob, (0.12, 0.13, 0.15))
    bm = bmesh.new()
    vs = bm_box(bm, 0, -0.118, 0.11, 0.30, 0.006, 0.19)
    for v in vs:
        y, zz = v.co.y, v.co.z
        v.co.y = y - (zz - 0.02) * 0.38
    ob = new_object(bm, "laptop_screen")
    kit.adopt(ob, (0.30, 0.34, 0.44))
    _place(ob, cx, cy, z, 0.2)


def pictures(kit):
    """The fish clock, the little blue underwater photograph and the framed
    certificate. They go on the spine under the bedrooms, which is the one long
    stretch of wall in the big room that has nothing standing against it.

    There used to be a framed sunset over the channel here as well — 80 by 42,
    dark brown, hung between the two bedroom doors. In a photograph of a real
    wall that is a picture. In this shader, which has no texture in it, it is an
    80 by 42 dark rectangle mounted on a wall at eye height between two rooms,
    and there is exactly one thing that is, so it read as a television. It is
    gone and the fish has the wall.
    """
    y = BY0 - 0.005
    fish_clock(kit, 0.05, F2 + 1.76, y)
    kit.span((0.20, 0.45, 0.62), 1.62, 2.06, y - 0.025, y,
             F2 + 1.58, F2 + 1.86, bev=0.004)
    kit.span(WHITEGOODS, 2.35, 2.62, y - 0.010, y, F2 + 1.55, F2 + 1.90,
             bev=0.003)
    # The shelf with the sea-urchin shells on it, beside the sunset.
    kit.span(BEECH, 0.62, 1.07, y - 0.17, y, F2 + 1.62, F2 + 1.65, bev=0.004)
    for i in range(3):
        bm_ball(kit.bm((0.70, 0.66, 0.58), 0.004), 0.69 + i * 0.14,
                y - 0.085, F2 + 1.69, 0.038, 0.038, 0.030, rows=5, seg=10)
    # The flat blue plaque that used to be up over the east bedroom door came
    # off with the picture. It was a stand-in for the fish, and the fish is on
    # the wall now.


def ceiling_light(kit, cx, cy, dome=False, sun=False, z=None):
    z = z if z is not None else CEILZ
    bm_cylinder(kit.bm(WHITEGOODS, 0.004), cx, cy, z - 0.03, z, 0.05, 0.05,
                seg=10)
    if dome:
        bm_ball(kit.bm((0.94, 0.93, 0.90), 0.004), cx, cy, z - 0.04,
                0.115, 0.115, 0.075, rows=5, seg=16, squash_bottom=0.2)
        return
    bm_ball(kit.bm((0.94, 0.93, 0.90), 0.004), cx, cy, z - 0.05,
            0.19, 0.19, 0.085, rows=5, seg=20, squash_bottom=0.25)
    if sun:
        # The one in the double bedroom is a dark blue sun with points.
        for i in range(14):
            a = TAU * i / 14
            kit.span((0.10, 0.14, 0.30),
                     cx + math.cos(a) * 0.19 - 0.028,
                     cx + math.cos(a) * 0.19 + 0.028,
                     cy + math.sin(a) * 0.19 - 0.028,
                     cy + math.sin(a) * 0.19 + 0.028,
                     z - 0.055, z - 0.02, bev=0.006)


def _place(ob, x, y, z, yaw):
    ob.rotation_euler = (0.0, 0.0, yaw)
    ob.location = (x, y, z)


# --------------------------------------------------------------------------- #
#  the roof that is there                                                      #
# --------------------------------------------------------------------------- #
# A gable, ridge east-west, eaves at +5.55 and ridge at +7.20. That is 1.65 m
# over a 3.865 m half span, which is 23 degrees — shallow, and Dalmatian.

PITCH_NOW = math.atan2(RIDGE_NOW - HEAD, (Y1 - Y0) / 2)


def roof_now(kit):
    chimney(kit)
    kit.span(CEIL, IX0 - 0.05, IX1 + 0.05, IY0 - 0.05, IY1 + 0.05,
             CEILZ, CEILZ + 0.14, bev=0.01)
    kit.span(RENDER, X0, X1, Y0, Y1, CEILZ + 0.14, HEAD, bev=0.02)
    ov = 0.40
    for sgn in (-1, 1):
        _slope(kit, PLY, sgn, RIDGE_NOW, PITCH_NOW, 0.0, (Y1 - Y0) / 2 + ov,
               0.030, X0 - ov, X1 + ov)
        _slope(kit, ROOFTILE, sgn, RIDGE_NOW, PITCH_NOW, 0.0,
               (Y1 - Y0) / 2 + ov, 0.075, X0 - ov, X1 + ov, lift=0.14)
    kit.span(ROOFTILE, X0 - ov - 0.02, X1 + ov + 0.02, -0.14, 0.14,
             RIDGE_NOW + 0.08, RIDGE_NOW + 0.20, bev=0.03)
    for at in (X0 + EXT / 2, X1 - EXT / 2):
        _gable(kit, RENDER, at, EXT, HEAD, RIDGE_NOW, (Y1 - Y0) / 2)
    for y in (Y0 - ov, Y1 + ov):
        kit.span(WHITEGOODS, X0 - ov, X1 + ov, y - 0.03, y + 0.03,
                 HEAD - 0.10, HEAD + 0.02, bev=0.01)


def _slope(kit, colour, sgn, ridge, pitch, d0, d1, thick, x0, x1, lift=0.0):
    """One layer of one plane of a roof, between two distances from the ridge."""
    za = ridge - d0 * math.tan(pitch) + lift
    zb = ridge - d1 * math.tan(pitch) + lift
    poly = [(d0, za), (d1, zb), (d1, zb - thick), (d0, za - thick)]
    bm = bmesh.new()
    vs = [bm.verts.new((x0, sgn * yy, zz)) for yy, zz in poly]
    vs += [bm.verts.new((x1, sgn * yy, zz)) for yy, zz in poly]
    bm.verts.ensure_lookup_table()
    bm.faces.new(tuple(vs[:4]))
    bm.faces.new(tuple(reversed(vs[4:])))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((vs[i], vs[j], vs[4 + j], vs[4 + i]))
    ob = new_object(bm, "roofplane")
    bevel(ob, 0.008)
    kit.adopt(ob, colour)


def _gable(kit, colour, at, thick, z_eave, z_ridge, span):
    bm = bmesh.new()
    poly = [(-span, z_eave), (span, z_eave), (0.0, z_ridge)]
    vs0 = [bm.verts.new((at - thick / 2, y, z)) for y, z in poly]
    vs1 = [bm.verts.new((at + thick / 2, y, z)) for y, z in poly]
    bm.verts.ensure_lookup_table()
    bm.faces.new(tuple(vs0))
    bm.faces.new(tuple(reversed(vs1)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((vs0[i], vs0[j], vs1[j], vs1[i]))
    ob = new_object(bm, "gable")
    bevel(ob, 0.012)
    kit.adopt(ob, colour)


# --------------------------------------------------------------------------- #
#  and the roof that could be                                                  #
# --------------------------------------------------------------------------- #
# Sixty centimetres of new wall is the whole permission. Everything else here
# follows from it, and from the one piece of luck in the survey: the ridge runs
# the *short* way, so the span it has to cross is 7.73 m and not 6.78. At 25°
# over that span the ridge lands 1.80 m above the new wall head, a deck at 2.55
# above the floor has 2.50 m under the ridge, and it still has 1.5 m two metres
# either side of it. That is a room, not a crawl space — which is not what the
# same sixty centimetres would have bought on a narrower house.

def roof_loft(kit):
    chimney(kit, top=CHIMNEY + KNEE + 0.60)
    # The new course of wall, drawn as its own band so the elevation shows what
    # was added and where.
    # A ring, not a slab. `span` takes two opposite corners and fills between
    # them, so one call across X0..X1 by Y0..Y1 is a 6.8 x 7.7 m lid of
    # blockwork sitting seventy centimetres above the mezzanine — which is what
    # this was, and what made the deck render as a blank plane with the tops of
    # two beds poking through it.
    for a0, a1, b0, b1 in ((X0, X1, Y1 - EXT, Y1), (X0, X1, Y0, Y0 + EXT),
                           (X0, X0 + EXT, Y0, Y1), (X1 - EXT, X1, Y0, Y1)):
        kit.span(RENDER, a0, a1, b0, b1, HEAD, LOFT_HEAD, bev=0.02)
    for a0, a1, b0, b1 in ((IX0, IX1, IY1 - 0.04, IY1),
                           (IX0, IX1, IY0, IY0 + 0.04),
                           (IX0, IX0 + 0.04, IY0, IY1),
                           (IX1 - 0.04, IX1, IY0, IY1)):
        kit.span(WALL, a0, a1, b0, b1, HEAD - 0.01, LOFT_HEAD, bev=0.004)

    span = (Y1 - Y0) / 2
    ov = 0.42
    for sgn in (-1, 1):
        _slope(kit, PLY, sgn, RIDGE, PITCH, 0.0, span + ov, 0.028,
               X0 - ov, X1 + ov)
        _slope(kit, ROOFTILE, sgn, RIDGE, PITCH, 0.0, span + ov, 0.075,
               X0 - ov, X1 + ov, lift=0.16)
        n = int((X1 - X0 + 2 * ov) / 0.62)
        for i in range(n + 1):
            x = X0 - ov + i * ((X1 - X0 + 2 * ov) / n)
            _slope(kit, BEECH, sgn, RIDGE, PITCH, 0.06, span + ov - 0.04, 0.14,
                   x - 0.035, x + 0.035, lift=-0.028)
    kit.span(BEECH, X0 - ov, X1 + ov, -0.09, 0.09, RIDGE - 0.30, RIDGE - 0.02,
             bev=0.008)
    kit.span(ROOFTILE, X0 - ov - 0.02, X1 + ov + 0.02, -0.14, 0.14,
             RIDGE + 0.10, RIDGE + 0.22, bev=0.03)
    for at in (X0 + EXT / 2, X1 - EXT / 2):
        _gable(kit, RENDER, at, EXT, LOFT_HEAD, RIDGE, span)
        sgn = -1 if at < 0 else 1
        _gable(kit, WALL, at - sgn * (EXT / 2 + 0.02), 0.04, LOFT_HEAD, RIDGE,
               span - 0.02)
    # Two roof lights: one over the gallery, one over the double height.
    rooflight(kit, -1.60, 1.70)
    rooflight(kit, 1.40, -2.30)

    # ── the deck ────────────────────────────────────────────────────────────
    # Everything north of the living room's south third, so the ridge runs down
    # the middle of it and the headroom is where the beds are.
    kit.span(CEIL, IX0, IX1, LOFT_Y, IY1, DECK - DECK_T, DECK - DECK_T + 0.02,
             bev=0.004)
    n = int((IX1 - IX0) / 0.55)
    for i in range(n + 1):
        x = IX0 + i * ((IX1 - IX0) / n)
        kit.span(DARKMETAL, x - 0.035, x + 0.035, LOFT_Y, IY1,
                 DECK - DECK_T + 0.02, DECK - 0.035, bev=0.006)
    planks(kit, IX0, IX1, LOFT_Y, IY1, DECK, along="x",
           tones=((0.480, 0.352, 0.212), (0.520, 0.386, 0.232),
                  (0.442, 0.318, 0.190), (0.500, 0.368, 0.222)))

    gallery_rail(kit, [(IX0, LOFT_Y), (IX1, LOFT_Y)])
    loft_stair(kit)

    # A bed each side of the ridge, where the headroom actually is, because the
    # question this model exists to answer is whether they fit.
    bed(kit, -1.72, 0.10, yaw=0.0, w=1.40, l=1.98, floor=DECK)
    bed(kit, 1.90, 0.10, yaw=0.0, w=1.40, l=1.98, floor=DECK)


def rooflight(kit, cx, cy):
    """A Velux in the pitch. Two of them are what makes the loft a room rather
    than a cupboard, and they cost nothing against the sixty centimetres."""
    sgn = 1 if cy > 0 else -1
    d = abs(cy)
    z = RIDGE - d * math.tan(PITCH)
    w, l = 0.78, 1.18
    for (colour, hw, hl, dz, thick) in ((WHITEGOODS, w / 2, l / 2, 0.02, 0.10),
                                        (GLASS, w / 2 - 0.06, l / 2 - 0.06,
                                         0.07, 0.02)):
        bm = bmesh.new()
        za = z + hl * math.sin(PITCH) + dz
        zb = z - hl * math.sin(PITCH) + dz
        ya = sgn * (d - hl * math.cos(PITCH))
        yb = sgn * (d + hl * math.cos(PITCH))
        poly = [(cx - hw, ya, za), (cx + hw, ya, za),
                (cx + hw, yb, zb), (cx - hw, yb, zb)]
        vs = [bm.verts.new(p) for p in poly]
        vs += [bm.verts.new((p[0], p[1], p[2] - thick)) for p in poly]
        bm.verts.ensure_lookup_table()
        bm.faces.new(tuple(vs[:4]))
        bm.faces.new(tuple(reversed(vs[4:])))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((vs[i], vs[j], vs[4 + j], vs[4 + i]))
        ob = new_object(bm, "rooflight")
        bevel(ob, 0.006)
        kit.adopt(ob, colour)


def gallery_rail(kit, pts):
    r = 0.018
    (x0, y0), (x1, y1) = pts
    L = math.hypot(x1 - x0, y1 - y0)
    n = max(2, int(round(L / 0.72)) + 1)
    for i in range(n):
        t = i / (n - 1)
        px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        bm_cylinder(kit.bm(DARKMETAL, 0.002), px, py, DECK, DECK + 0.94,
                    r, r, seg=10)
    kit.span(BEECH, min(x0, x1) - 0.03, max(x0, x1) + 0.03,
             min(y0, y1) - 0.04, max(y0, y1) + 0.04,
             DECK + 0.94, DECK + 1.02, bev=0.008)
    for j in range(3):
        z = DECK + 0.22 + j * 0.24
        kit.span(DARKMETAL, min(x0, x1) - 0.012, max(x0, x1) + 0.012,
                 min(y0, y1) - 0.012, max(y0, y1) + 0.012,
                 z - 0.008, z + 0.008, bev=0.003)


def loft_stair(kit):
    """Fourteen treads on a folded steel stringer, up the east wall.

    2.55 m of rise in 2.60 m of run is 44°, which is a ladder-stair and not a
    staircase — and it is what both reference pictures show, because in a room
    this size a comfortable 32° flight is four metres long and eats the room it
    is trying to serve."""
    n = 14
    rise = (DECK - F2) / n
    go = 0.20
    # The head of the flight, 15 cm shy of the deck's open edge — so the bottom
    # of it lands at −3.65, which is 1.5 cm inside the room. At LOFT_Y − 0.10 it
    # landed at −3.90, and the inner face of the south wall is at −3.665: the
    # bottom two treads were buried in the wall and the foot of the stair was
    # outside the building. You could not get on to it, which is a hard thing to
    # see in a render of a staircase that otherwise looks perfectly normal.
    y_top = LOFT_Y + 0.15
    x = IX1 - 0.52
    for i in range(1, n + 1):
        y = y_top - (n - i) * go
        kit.span(BEECH, x - 0.44, x + 0.44, y - go / 2 - 0.02, y + go / 2 + 0.06,
                 F2 + rise * i - 0.045, F2 + rise * i, bev=0.008)
    for s in (-1, 1):
        bm = bmesh.new()
        pts = [(y_top - (n - i) * go, F2 + rise * i) for i in range(n + 1)]
        for i in range(n):
            (ya, za), (yb, zb) = pts[i], pts[i + 1]
            ang = math.atan2(zb - za, yb - ya)
            L = math.hypot(yb - ya, zb - za)
            vs = bm_box(bm, 0, 0, 0, 0.020, L + 0.06, 0.16)
            c, sn = math.cos(ang), math.sin(ang)
            for v in vs:
                px, py, pz = v.co
                v.co = (x + s * 0.44 + px,
                        (ya + yb) / 2 + py * c - pz * sn,
                        (za + zb) / 2 - 0.14 + py * sn + pz * c)
        ob = new_object(bm, "stringer")
        bevel(ob, 0.004)
        kit.adopt(ob, DARKMETAL)
    bm = bmesh.new()
    for i in range(n):
        ya, za = y_top - (n - i) * go, F2 + rise * i + 0.94
        yb, zb = y_top - (n - i - 1) * go, F2 + rise * (i + 1) + 0.94
        ang = math.atan2(zb - za, yb - ya)
        L = math.hypot(yb - ya, zb - za)
        vs = bm_box(bm, 0, 0, 0, 0.040, L + 0.02, 0.040)
        c, sn = math.cos(ang), math.sin(ang)
        for v in vs:
            px, py, pz = v.co
            v.co = (x - 0.46 + px, (ya + yb) / 2 + py * c - pz * sn,
                    (za + zb) / 2 + py * sn + pz * c)
    ob = new_object(bm, "loft_handrail")
    bevel(ob, 0.006)
    kit.adopt(ob, BEECH)
    for i in (2, 7, 12):
        y = y_top - (n - i) * go
        bm_cylinder(kit.bm(DARKMETAL, 0.002), x - 0.46, y,
                    F2 + rise * i, F2 + rise * i + 0.94, 0.016, 0.016, seg=8)


# --------------------------------------------------------------------------- #
#  the plan sidecar                                                            #
# --------------------------------------------------------------------------- #
# Everything the runtime needs to let somebody walk around in here, in three.js
# axes, written by the same file that built the geometry so there is one source
# of truth for where the walls are.

def plan_json():
    def T(x0, x1, y0, y1):
        """Blender rect -> three.js rect. Y becomes -Z, so the sides swap."""
        return {"x0": round(min(x0, x1), 3), "x1": round(max(x0, x1), 3),
                "z0": round(-max(y0, y1), 3), "z1": round(-min(y0, y1), 3)}

    blockers = []

    def solid(x0, x1, y0, y1):
        if abs(x1 - x0) > 0.02 and abs(y1 - y0) > 0.02:
            blockers.append(T(x0, x1, y0, y1))

    def band(axis, at, thick, a0, a1, gaps):
        cuts = [a0]
        for g in sorted(gaps, key=lambda h: h[0]):
            cuts += [g[0], g[1]]
        cuts.append(a1)
        for i in range(0, len(cuts) - 1, 2):
            if axis == "x":
                solid(cuts[i], cuts[i + 1], at - thick / 2, at + thick / 2)
            else:
                solid(at - thick / 2, at + thick / 2, cuts[i], cuts[i + 1])

    band("x", Y0 + EXT / 2, EXT, X0, X1, [D_TERR])
    band("x", Y1 - EXT / 2, EXT, NX0, X1, [])
    band("y", X0 + EXT / 2, EXT, Y0, BY1, [])
    band("y", NX0 + EXT / 2, EXT, BY0, Y1, [])
    band("y", X1 - EXT / 2, EXT, Y0, Y1, [D_ENTRY])
    band("x", BY1 - EXT / 2, EXT, X0, NX0 + EXT, [])
    band("x", SPINE, INT * 2, NIX0, IX1, [D_S4, D_S3])
    band("x", SPINE, INT * 2, IX0, NIX0, [])
    band("y", W_MID, INT * 2, BY1, IY1, [])
    band("y", BATH_E, INT, BATH_S, BY0, [D_BATH])
    band("x", BATH_S, INT, IX0, BATH_E, [])

    rooms = {k: T(*v) for k, v in ROOMS.items()}
    rooms["terrace"] = T(X0, X1, TER_Y0, TER_Y1)

    return {
        "note": "Vikendica, Jadrija — gornji kat. Metres, three.js axes. "
                "Off the 1:100 drawings.",
        "area": round((X1 - X0) * (Y1 - Y0), 1),
        "grade": GRADE, "floor": F2, "clear": CLEAR,
        "head": round(HEAD - F2, 3), "ridge": RIDGE_NOW,
        "knee": KNEE, "deck": DECK, "loftHead": LOFT_HEAD, "loftRidge": RIDGE,
        "pitch": round(math.degrees(PITCH_NOW), 1),
        "loftPitch": round(math.degrees(PITCH), 1),
        "outer": T(X0, X1, Y0, Y1),
        "rooms": rooms,
        "blockers": blockers,
        "anchors": {
            "stairFoot": [round(ST_X, 2), GRADE, round(-(ST_BOT - 0.9), 2)],
            "stairHead": [round(ST_X, 2), F2, round(-(ST_TOP + 0.55), 2)],
            "doorOut": [round(X1 + 0.75, 2), F2,
                        round(-(D_ENTRY[0] + D_ENTRY[1]) / 2, 2)],
            "doorIn": [round(X1 - 0.95, 2), F2,
                       round(-(D_ENTRY[0] + D_ENTRY[1]) / 2, 2)],
            "living": [0.4, F2, 1.2],
            "terrace": [0.0, F2, round(-(TER_Y0 + TER_Y1) / 2, 2)],
            "loftTop": [round(IX1 - 0.55, 2), DECK, round(-(LOFT_Y + 0.5), 2)],
        },
    }


# --------------------------------------------------------------------------- #
#  looking at it                                                               #
# --------------------------------------------------------------------------- #
# Interiors, not turntables. A room is judged from standing height inside it,
# which is the one view preview.py cannot give you, and the whole reason this
# model exists is to be stood inside.

EYE = 1.66

SHOTS = {
    # name:            (from,                to,                 lens, kits)
    "plan":            ("plan", None, None, ("shell",)),
    "cutaway":         ((-8.6, -9.4, 12.0), (0.0, 0.2, F2 + 0.9), 45,
                        ("shell",)),
    "south":           ((-5.0, -12.5, 4.6), (0.0, -1.0, F2 + 0.4), 34,
                        ("shell", "roof")),
    "east":            ((11.5, -6.5, 4.4), (1.0, 0.4, F2 + 0.5), 34,
                        ("shell", "roof")),
    "west":            ((-12.0, 3.0, 4.6), (0.5, 0.6, F2 + 0.5), 34,
                        ("shell", "roof")),
    # Standing just inside the front door, which is how you arrive.
    "arrive":          ((2.35, -0.20, F2 + EYE), (-3.2, -1.9, F2 + 1.15), 19,
                        ("shell", "roof")),
    "living":          ((-2.15, -3.30, F2 + EYE), (3.1, -0.7, F2 + 1.20), 19,
                        ("shell", "roof")),
    "toTerrace":       ((1.90, 0.30, F2 + EYE), (-0.6, -4.4, F2 + 1.05), 19,
                        ("shell", "roof")),
    "kitchen":         ((0.25, -3.20, F2 + EYE), (-2.9, -2.15, F2 + 1.05), 19,
                        ("shell", "roof")),
    # The south-west corner as one picture: laptop table, dining table and
    # its chair, the kitchen run behind them.
    "nook":            ((2.45, -1.45, F2 + EYE), (-3.0, -2.75, F2 + 1.00), 19,
                        ("shell", "roof")),
    "nookHigh":        ((1.55, 0.30, F2 + 2.15), (-2.5, -2.95, F2 + 0.50), 21,
                        ("shell", "roof")),
    "doorwall":        ((0.20, -3.10, F2 + EYE), (0.6, 1.4, F2 + 1.20), 19,
                        ("shell", "roof")),
    "soba3":           ((0.75, 1.30, F2 + EYE), (2.5, 3.3, F2 + 0.85), 19,
                        ("shell", "roof")),
    "soba4":           ((-0.55, 1.25, F2 + EYE), (-2.1, 3.3, F2 + 0.85), 19,
                        ("shell", "roof")),
    "bath":            ((-1.72, -0.88, F2 + EYE), (-2.6, 0.35, F2 + 1.00), 19,
                        ("shell", "roof")),
    "terrace":         ((2.60, -4.35, F2 + EYE), (-3.0, -5.4, F2 + 0.9), 19,
                        ("shell", "roof")),
    "sectionNow":      ("section", 2.20, 11.4, ("shell", "roof")),
    # And the same rooms under sixty centimetres more wall.
    "loft_living":     ((-2.55, -3.20, F2 + EYE), (2.8, 0.9, F2 + 2.20), 19,
                        ("shell", "loft")),
    "loft_up":         ((-1.20, -3.30, F2 + EYE), (2.6, 0.4, F2 + 3.1), 19,
                        ("shell", "loft")),
    "loft_stair":      ((-0.60, -1.60, F2 + EYE), (2.7, -2.6, F2 + 2.5), 19,
                        ("shell", "loft")),
    "loft_deck":       ((0.10, -1.05, DECK + 1.30), (0.2, 3.3, DECK + 0.40),
                        19, ("shell", "loft")),
    "loft_bed":        ((-2.90, 2.20, DECK + 0.95), (2.4, -0.5, DECK + 0.50),
                        19, ("shell", "loft")),
    "loft_south":      ((-5.0, -12.5, 5.4), (0.0, -1.0, F2 + 1.4), 34,
                        ("shell", "loft")),
    "loft_cutaway":    ((-8.6, -9.4, 13.0), (0.0, 0.2, F2 + 1.3), 45,
                        ("shell", "loft")),
    "sectionLoft":     ("section", 2.20, 11.4, ("shell", "loft")),
}


def _aim(frm, to):
    """Euler that points a Blender camera from one point at another.

    A camera looks down its own -Z. With an XYZ euler of (rx, 0, rz) that axis
    ends up at (-sin rz sin rx, cos rz sin rx, -cos rx), so the two angles fall
    straight out of the direction vector — no matrices, and it agrees with the
    convention preview.py already uses for its turntable."""
    dx, dy, dz = (to[0] - frm[0], to[1] - frm[1], to[2] - frm[2])
    return (math.atan2(math.hypot(dx, dy), -dz), 0.0, math.atan2(-dx, dy))


def _prev_material(colour):
    key = "vh_%.3f_%.3f_%.3f" % colour
    m = bpy.data.materials.get(key)
    if m:
        return m
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1.0)
    b.inputs["Roughness"].default_value = 0.55
    return m


def render_shots(kits, prefix, only=None, res=(1400, 900), samples=64):
    """Render the named shots. `kits` is {name: [(object, colour), ...]}.

    `only` is a comma-separated list of shot names, because rendering all
    twenty-odd takes four minutes and checking one change does not."""
    for parts in kits.values():
        for ob, colour in parts:
            ob.data.materials.clear()
            ob.data.materials.append(_prev_material(tuple(colour)))

    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = samples
    sc.eevee.use_gtao = True
    sc.eevee.gtao_distance = 1.6
    sc.eevee.use_soft_shadows = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    # Blender 4 defaults to AgX, which desaturates hard and turns a pale flat
    # into a grey one. The game applies no tone curve at all, so a preview that
    # is meant to predict it must not either.
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.world = sc.world or bpy.data.worlds.new("vh")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = \
        (0.33, 0.38, 0.45, 1)

    if "vh_ground" not in bpy.data.objects:
        bm = bmesh.new()
        bm_box(bm, 0, 0, GRADE - 0.10, 52.0, 52.0, 0.20)
        g = new_object(bm, "vh_ground")
        g.data.materials.append(_prev_material((0.60, 0.56, 0.46)))

    # One low afternoon sun out of the south-west, which is where the sea is,
    # and a weak fill so the north rooms are not silhouettes. EEVEE does not
    # bounce, so the world above does the job the white ceiling does in life.
    for name, (elev, azim, energy) in {
        "sun": (36.0, -145.0, 3.4),
        "fill": (58.0, 40.0, 0.7),
    }.items():
        if name in bpy.data.objects:
            continue
        d = bpy.data.lights.new(name, "SUN")
        d.energy = energy
        d.angle = math.radians(2.0)
        o = bpy.data.objects.new(name, d)
        o.rotation_euler = (math.radians(90 - elev), 0.0, math.radians(azim))
        sc.collection.objects.link(o)

    cam_d = bpy.data.cameras.new("vhcam")
    cam = bpy.data.objects.new("vhcam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam

    want = set(only.split(",")) if only else None
    for name, (frm, to, lens, use) in SHOTS.items():
        if want and name not in want:
            continue
        for k, parts in kits.items():
            for ob, _ in parts:
                ob.hide_render = k not in use
        cam_d.clip_start = 0.05
        if frm == "plan":
            cam_d.type = "ORTHO"
            # Turned a quarter, because the house with its terrace is 9.9 m
            # the short way and 6.8 m the long way, and the frame is landscape.
            cam_d.ortho_scale = 12.8
            cam.location = (0.0, -1.10, 40.0)
            cam.rotation_euler = (0.0, 0.0, math.radians(-90))
        elif frm == "section":
            # A real cross-section, cut by the near clipping plane rather than
            # by deleting anything: stand the camera 30 m off along +Y, look
            # back down it, and start clipping exactly at the cut. This is the
            # drawing the renovation lives or dies on.
            cut, scale = to, lens
            cam_d.type = "ORTHO"
            cam_d.ortho_scale = scale
            cam.location = (cut + 30.0, 0.0, F2 + 2.2)
            cam.rotation_euler = _aim((0.0, 0.0, 0.0), (-1.0, 0.0, 0.0))
            cam_d.clip_start = 30.0
        else:
            cam_d.type = "PERSP"
            cam_d.lens = lens
            cam.location = frm
            cam.rotation_euler = _aim(frm, to)
        sc.render.filepath = "%s_%s.png" % (prefix, name)
        bpy.ops.render.render(write_still=True)
        print("  shot %-14s -> %s" % (name, sc.render.filepath))


# --------------------------------------------------------------------------- #

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    reset_scene()
    print("baking the vikendica at Jadrija")

    kits = {}
    for name, fn, note in (
        ("shell", shell, "upper floor, as drawn"),
        ("roof", roof_now, "the flat ceiling and the 23 degree gable"),
        ("loft", roof_loft, "+60 cm, 25 degrees and a mezzanine"),
    ):
        kit = Kit("vikendica_" + name)
        fn(kit)
        parts = kit.parts()
        kits[name] = parts
        # Glazing goes out as its own blob so the runtime can draw it with a
        # transparent material.
        #
        # This house has thirteen square metres of glass in it and the point of
        # standing in it is the water on the other side. Baked in with the rest
        # it is a mid-grey panel and the terrace doors read as a boarded-up
        # opening — which turns the one room the whole model exists to judge
        # into a box with a picture of a wall where the view is.
        glass = [p for p in parts if p[1] == GLASS]
        parts = [p for p in parts if p[1] != GLASS]
        if glass:
            export(glass, OUT / ("vikendica_%s_glass.fr3d.gz" % name),
                   "the glazing, drawn transparent")
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
        for ob, _ in parts:
            for c in ob.users_collection:
                c.objects.unlink(ob)
            coll.objects.link(ob)
        export(parts, OUT / ("vikendica_%s.fr3d.gz" % name), note)

    p = OUT / "vikendica_plan.json"
    p.write_text(json.dumps(plan_json(), separators=(",", ":")))
    print("  %-18s %5.1f KB  plan, blockers and anchors"
          % (p.name, len(p.read_bytes()) / 1024))

    if "--shots" in argv:
        where = argv[argv.index("--shots") + 1]
        only = argv[argv.index("--only") + 1] if "--only" in argv else None
        print("rendering shots to %s_*.png" % where)
        render_shots(kits, where, only)

    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("  saved %s" % BLEND)


main()
