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
    TAU, _ring_pts, bevel, bm_ball, bm_box, bm_cylinder, bm_hip_roof, bm_loft,
    export, new_object, reset_scene,
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

TILE_FLOOR = (0.072, 0.132, 0.318)  # bathroom, deep cobalt
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
D_BATH = (-0.40, 0.60, 0.0, DOOR_H)          # in the bathroom's east wall

W_S4_N = (-1.64, -0.44, 1.00, 2.05)          # north wall of the west bedroom
W_S4_W = (1.60, 2.50, 1.00, 2.05)            # and its window on to the west
W_S3_E = (1.70, 2.90, 1.00, 2.05)            # east wall of the east bedroom
W_KIT_W = (-3.30, -2.10, 1.00, 2.05)         # the west wall of the big room
W_BATH_W = (-0.24, 0.36, 1.40, 2.05)         # the bathroom, high, over the WC
W_N = (1.60, 2.30, 1.00, 2.05)               # the one window on the north wall

# The terrace: the full width of the house, 220 deep, on the south.
TER_Y0, TER_Y1 = Y0 - 2.20, Y0
TER_Z = F2 - 0.02

# The stair up the outside, on the east face: 17 x 17 up, 16 x 25 along.
ST_X = X1 + 0.62           # centreline of the flight
ST_W = 1.10
ST_N = 17
ST_RISE = 0.17
# The top tread, which stops just short of the door — so the landing, which
# runs from here northward, is what is under the opening.
#
# It used to be the door's centreline plus 30 cm, which put the head of the
# flight *in* the doorway: the last thing between the promenade and the front
# door was a 17 cm step with no floor to stand on while you crossed it. It read
# fine in a render and it was a hole you fell 2.9 m through the moment anybody
# tried to walk in.
ST_TOP = D_ENTRY[0] - 0.06
# And the foot, which is the corner of the house.
#
# The going is derived and not chosen. Both ends of this flight are fixed by
# something else — the top by the door it serves, the foot by the south face,
# which is where the real one starts — so the run is 3.10 m and the only free
# number left is how it is divided. At 25 cm a going the flight was 4.25 m long
# and stood a metre and a bit past the corner of the building, out over ground
# that in the photograph is open.
#
# 18 cm of going under a 17 cm rise is 43°, and 2R+G is 0.52 against a
# comfortable 0.63. That is a steep stair. It is also what 2.90 m of storey
# height in 3.10 m of run has to be, and an external flight up the side of a
# Dalmatian vikendica is a steep stair — the alternative is not a gentler one,
# it is a longer one that is not where the drawings put it.
ST_GO = (ST_TOP - Y0) / ST_N
ST_BOT = ST_TOP - ST_GO * (ST_N - 1)

# The renovation.
LOFT_HEAD = HEAD + KNEE            # +6.15, and that is the whole permission
PITCH = math.radians(25.0)
RIDGE = LOFT_HEAD + (Y1 - Y0) / 2 * math.tan(PITCH)
DECK = F2 + 2.55                   # top of the mezzanine deck
DECK_T = 0.16
LOFT_Y = -1.20                     # its open edge, over the big room

# The fish clock, on the spine wall between the two bedroom doors.
#
# The doors are D_S4 (−1.02…−0.17) and D_S3 (0.51…1.36), so the wall between
# them is 68 cm of plaster centred on x = 0.17 and the fish has to sit in the
# middle of it. It is not symmetrical about its own spindle — 1.60 r of snout
# one way, 1.82 r of tail the other — so centring it means centring the *fish*
# and not the movement, which is 0.11 r west of where the body is drawn.
#
# At r = 0.178 the whole animal was 0.61 m against a 0.68 m gap: it filled the
# wall to within 3 cm a side and read as a mural. 0.150 makes it 0.51 m, with a
# hand's width of plaster each side, which is a clock hung on a wall.
CLOCK_R = 0.150
CLOCK_X = 0.17 - 0.11 * CLOCK_R
CLOCK_Z = F2 + 1.76


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


def _rects_minus(rects, holes):
    """Axis-aligned rectangle difference, in (a0, a1, z0, z1).

    Rectangles in, rectangles out — nothing clever, and it does not need to be:
    a wall has one door in it and maybe a window, and both are boxes."""
    out = list(rects)
    for h in holes:
        nxt = []
        for (a0, a1, z0, z1) in out:
            if h[1] <= a0 or h[0] >= a1 or h[3] <= z0 or h[2] >= z1:
                nxt.append((a0, a1, z0, z1))
                continue
            if h[0] > a0:
                nxt.append((a0, h[0], z0, z1))
            if h[1] < a1:
                nxt.append((h[1], a1, z0, z1))
            m0, m1 = max(a0, h[0]), min(a1, h[1])
            if h[2] > z0:
                nxt.append((m0, m1, z0, h[2]))
            if h[3] < z1:
                nxt.append((m0, m1, h[3], z1))
        out = nxt
    return [r for r in out if r[1] - r[0] > 0.004 and r[3] - r[2] > 0.004]


def tiled_face(kit, axis, at, a0, a1, z0, z1, face=1, size=0.20,
               colour=TILE_WALL, accent=TILE_DEEP, accent_p=0.05, depth=0.010,
               holes=()):
    """The one that actually works. `axis` names the axis the wall *runs* along.

    `holes` is the thing this went years without and needed from the first day
    it was used. A tiled face lays a solid grout slab and then tiles on top of
    it, and the slab took no account of the openings in the wall behind it — so
    the bathroom door was a flat 0.56-grey panel seen from the living room and a
    tiled wall seen from the bathroom, which is to say the bathroom had no door
    and nobody in it could get out. The window over the WC was bricked up the
    same way, in the one room in the flat with a single small window in it."""
    for (b0, b1, c0, c1) in _rects_minus([(a0, a1, z0, z1)], holes):
        kit.span(GROUT, *_face_span(axis, at, b0, b1, c0, c1,
                                    -face * 0.005, face * 0.004), bev=0)
    tones = _shades(colour, n=3, lo=0.97, hi=1.02)
    na = max(1, int(round((a1 - a0) / size)))
    nz = max(1, int(round((z1 - z0) / size)))
    sa, sz = (a1 - a0) / na, (z1 - z0) / nz
    g = 0.004
    for i in range(na):
        for j in range(nz):
            c = (accent if accent and RNG.random() < accent_p
                 else tones[RNG.randrange(len(tones))])
            cell = (a0 + i * sa + g, a0 + (i + 1) * sa - g,
                    z0 + j * sz + g, z0 + (j + 1) * sz - g)
            for (b0, b1, c0, c1) in _rects_minus([cell], holes):
                kit.span(c, *_face_span(axis, at, b0, b1, c0, c1,
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
        # Hooked back against the render, one leaf either side, which is what
        # `louvred` has always said it was drawing and never was: the two leaves
        # were placed at (a0, mid) and (mid, a1), which is the opening exactly —
        # so every shutter in the house was shut. In a flat whose whole argument
        # is the light and the water outside it, on an August afternoon, with
        # the fire already burning. The terrace window in particular was a grey
        # panel with a net curtain over it and nothing behind either.
        w = (a1 - a0) / 2
        for (p, q) in ((a0 - w, a0), (a1, a1 + w)):
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
        # Nothing on the east. There was a door here, under the outside stair,
        # and it is not on the building: the east face at ground level is blind
        # render from the corner to the terrace, and a door there would open
        # into the underside of a flight of steps.
        "east": [],
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
    # The structural slab, and its top is *not* at F2 — F2 is where the finish
    # is. It used to be, and the top face of this and the top face of every
    # tile and floorboard in the house were then the same plane, which is a
    # z-fight across the whole storey. It went unseen for as long as it did
    # because the living room and the kitchen are laid in a cream ceramic and
    # CONCRETE is very nearly that colour, so the fight was two shades of the
    # same thing. The bathroom is cobalt. There it read as a blue and white
    # chequer that changed as you walked, which is not a floor anybody has.
    # The terrace next door had always done this properly; now so does this.
    kit.span(CONCRETE, X0 - 0.05, X1 + 0.05, Y0 - 0.05, Y1 + 0.05,
             F2 - 0.22, F2 - 0.032, bev=0.02)

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
    # The accent is its own colour rather than TILE_DEEP, which is set into the
    # white walls and is now lighter than the floor rather than darker.
    floor_tiles(kit, bx0 - 0.03, bx1 + 0.03, by0 - 0.03, by1 + 0.03, F2,
                size=0.20, colour=TILE_FLOOR, accent=(0.042, 0.078, 0.198),
                accent_p=0.04)

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
    slider(kit, "y", BATH_E, D_BATH, thick=INT, slide=-1.0, open_frac=0.88)
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


def starlink(kit, px, py, top):
    """The dish on the roof, at the east verge above the top of the stairs.

    It was on the landing rail, which is where the arm and the panel were first
    drawn and is not where it is: on the house it is bracketed to the roof
    edge, a metre or so down the slope from the ridge, with the cable running
    back down the gable wall to the balcony. `top` is the tile surface at that
    point, so the same builder serves the roof as it stands and the roof over
    the mezzanine, and the dish goes up with the ridge when you build one.

    It leans toward -y, which is the water: at this latitude the birds it wants
    are low in the southern sky, and a dish pointed at the hillside behind is
    the one thing that would read as wrong to anybody who owns one.

    Built as loose objects rather than into the colour buckets, because the arm
    and the panel are both tilted and a bucket is shared — rotating one would
    take the whole house with it.
    """
    black = (0.09, 0.09, 0.10)
    pale = (0.87, 0.88, 0.88)
    tilt = math.radians(36.0)

    def lean(bm, verts, ox, oy, oz):
        c, s = math.cos(tilt), math.sin(tilt)
        for v in verts:
            x, y, z = v.co
            v.co = (ox + x, oy + y * c - z * s, oz + y * s + z * c)

    # The bracket, lapped over the verge the way a roof mount is, and the short
    # mast standing off it that everything else hangs on.
    kit.span(black, px - 0.15, px + 0.26, py - 0.085, py + 0.085,
             top - 0.19, top + 0.035, bev=0.006)
    bm_cylinder(kit.bm(black, 0.002), px, py, top + 0.02, top + 0.30,
                0.022, 0.022, seg=10)
    # And the cable, down the gable wall to the landing, which is the half of
    # the installation you actually walk past.
    bm_cylinder(kit.bm(black, 0.002), X1 - EXT / 2 - 0.05, py + 0.02,
                F2 + 0.30, top - 0.12, 0.007, 0.007, seg=8)

    for name, colour, box in (
            ("starlink_arm", black, (0, 0, 0.42, 0.048, 0.048, 0.28)),
            ("starlink_dish", pale, (0, 0, 0.815, 0.305, 0.026, 0.510))):
        bm = bmesh.new()
        vs = bm_box(bm, box[0], box[1], box[2], box[3], box[4], box[5])
        lean(bm, vs, px, py, top + 0.26)
        ob = new_object(bm, name)
        bevel(ob, 0.010 if name.endswith("dish") else 0.004)
        kit.adopt(ob, colour)

    # The back of the panel is the dark side, and it is the side you see from
    # the terrace, so it is worth the four triangles.
    bm = bmesh.new()
    vs = bm_box(bm, 0, 0.016, 0.815, 0.290, 0.008, 0.492)
    lean(bm, vs, px, py, top + 0.26)
    ob = new_object(bm, "starlink_back")
    bevel(ob, 0.004)
    kit.adopt(ob, black)


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
    # The worktop, with the sink cut out of it.
    #
    # It was one slab from end to end and the bowl was a box underneath it, so
    # the bowl was inside the counter and invisible — which nobody noticed while
    # the tap was over at the front edge pointing the wrong way, and which is
    # unmissable the moment the tap is where a tap goes: a mixer reaching out
    # over an unbroken white plane.
    bx0, bx1 = run0 + 0.08, run0 + 0.58
    by0, by1 = y1 - 0.54, y1 - 0.10
    for a0, a1, b0, b1 in ((run0 - 0.02, bx0, y1 - 0.63, y1),
                           (bx1, run1 + 0.02, y1 - 0.63, y1),
                           (bx0, bx1, y1 - 0.63, by0),
                           (bx0, bx1, by1, y1)):
        kit.span(WORKTOP, a0, a1, b0, b1, top - 0.04, top, bev=0.006)
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

    # And the bowl itself, open at the top: a floor and four sides rather than a
    # solid, because a sink is a hole.
    sx = run0 + 0.08
    STEEL_S = (0.72, 0.73, 0.74)
    kit.span(STEEL_S, bx0, bx1, by0, by1, top - 0.17, top - 0.152, bev=0.004)
    for a0, a1, b0, b1 in ((bx0, bx0 + 0.018, by0, by1),
                           (bx1 - 0.018, bx1, by0, by1),
                           (bx0, bx1, by0, by0 + 0.018),
                           (bx0, bx1, by1 - 0.018, by1)):
        kit.span(STEEL_S, a0, a1, b0, b1, top - 0.17, top - 0.004, bev=0.003)
    # The waste, dead centre of the bowl.
    bm_cylinder(kit.bm(CHROME, 0.002), (bx0 + bx1) / 2, (by0 + by1) / 2,
                top - 0.172, top - 0.160, 0.038, 0.038, seg=12)
    # The tap, at the back of the worktop against the tiles, reaching forward
    # over the basin. It was at y1 − 0.60, which is the *front* edge of a 63 cm
    # worktop — a mixer standing on the lip with its spout pointing back at the
    # wall. Nothing plumbs that way and nothing looks like it: a tap comes out
    # of the splashback, because that is where the wall the pipes are in is.
    kit.span(CHROME, sx + 0.22, sx + 0.28, y1 - 0.10, y1 - 0.06,
             top, top + 0.26, bev=0.004)
    kit.span(CHROME, sx + 0.22, sx + 0.28, y1 - 0.34, y1 - 0.08,
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


def _oval_band(bm, z0, z1, out, inn, seg=24, power=2.6):
    """A closed flat ring with superelliptical inner and outer edges.

    Four quad strips — outside, inside, top, bottom — which is a closed solid,
    so the exporter's normal pass sorts the winding out. `out` and `inn` are
    each `(rx, ry, ox, oy)`; they take separate centres because a lavatory seat
    is not concentric, the back of it being wider than the front.
    """
    rows = []
    for rx, ry, ox, oy in (out, inn):
        pts = _ring_pts(rx, ry, seg, power)
        rows.append([[bm.verts.new((ox + px, oy + py, z)) for px, py in pts]
                     for z in (z0, z1)])
    bm.verts.ensure_lookup_table()
    (ob, ot), (ib, it) = rows
    for i in range(seg):
        k = (i + 1) % seg
        bm.faces.new((ob[i], ob[k], ot[k], ot[i]))
        bm.faces.new((ib[i], ib[k], it[k], it[i]))
        bm.faces.new((ot[i], ot[k], it[k], it[i]))
        bm.faces.new((ob[i], ob[k], ib[k], ib[i]))
    return rows


def _wc(kit, bx, ty):
    """A close-coupled lavatory standing off the wall face at `bx`, centred on
    `ty`, projecting into +X.

    It used to be five boxes: a stub, a slab, a lid, a tank. From the doorway
    that is a WC, and from a metre away it is a filing cabinet — because the
    one thing a lavatory has that a box does not is that every surface on it is
    a curve, and the shape of the curve is the whole object.

    So the pan is a single loft of eleven superelliptical rings that climbs the
    outside, rolls over the rim and comes back *down* the inside to the water.
    One closed surface, an open bowl, and the section swells and drifts forward
    as it rises the way a moulded ceramic does. The seat is a separate oval
    band, not concentric with the pan, because it is wider at the hinge than at
    the front.
    """
    # The pan. Rings are (z, rx, ry, ox, oy), bottom of the foot upward: the
    # waist at 9 cm, the shoulder at 27, the rim at 41 — then two rings that
    # roll over the lip, and four that descend into the bowl. The last is the
    # water.
    rings = [(F2 + 0.020, 0.114, 0.102, bx + 0.150, ty),
             (F2 + 0.090, 0.100, 0.089, bx + 0.160, ty),
             (F2 + 0.180, 0.110, 0.096, bx + 0.176, ty),
             (F2 + 0.270, 0.136, 0.122, bx + 0.196, ty),
             (F2 + 0.345, 0.172, 0.152, bx + 0.212, ty),
             (F2 + 0.396, 0.192, 0.168, bx + 0.218, ty),
             (F2 + 0.412, 0.190, 0.166, bx + 0.218, ty),
             (F2 + 0.404, 0.170, 0.146, bx + 0.216, ty),
             (F2 + 0.340, 0.152, 0.130, bx + 0.212, ty),
             (F2 + 0.270, 0.112, 0.094, bx + 0.202, ty),
             (F2 + 0.215, 0.062, 0.052, bx + 0.192, ty)]
    bm_loft(kit.bm(WHITEGOODS, 0.004), rings, seg=20, power=2.5)

    # The spigot into the wall behind it. The pan's foot stands 5 cm clear of
    # the tiling, as a floor-standing pan does, and the soil pipe crosses that
    # gap — which is the detail that tells you the thing is plumbed in and not
    # just set down on the floor.
    kit.span(WHITEGOODS, bx - 0.01, bx + 0.16, ty - 0.062, ty + 0.062,
             F2 + 0.06, F2 + 0.28, bev=0.02)

    # The seat, down, and the two hinge lugs at the back of it.
    _oval_band(kit.bm((0.935, 0.932, 0.918), 0.004), F2 + 0.414, F2 + 0.446,
               (0.188, 0.164, bx + 0.216, ty),
               (0.126, 0.104, bx + 0.238, ty), seg=24, power=2.6)
    for dy in (-0.058, 0.058):
        kit.span(CHROME, bx + 0.030, bx + 0.070, ty + dy - 0.016,
                 ty + dy + 0.016, F2 + 0.412, F2 + 0.452, bev=0.006)

    # The cistern, close-coupled: it sits down on the shelf at the back of the
    # pan rather than hanging on the wall, and its lid overhangs it all round.
    kit.span(WHITEGOODS, bx, bx + 0.19, ty - 0.185, ty + 0.185,
             F2 + 0.400, F2 + 0.860, bev=0.022)
    kit.span(WHITEGOODS, bx - 0.008, bx + 0.204, ty - 0.196, ty + 0.196,
             F2 + 0.860, F2 + 0.896, bev=0.014)
    # Dual flush. Two buttons, and the big one is the far one.
    for dy, r in ((-0.048, 0.030), (0.046, 0.022)):
        bm_cylinder(kit.bm(CHROME, 0.003), bx + 0.098, ty + dy,
                    F2 + 0.888, F2 + 0.908, r, r * 0.94, seg=12)


def bathroom(kit):
    """Two forty-five by one sixty-five, a box in the north-west corner of the
    big room. Door in the east wall hard against the north side, window high in
    the west wall at the far end, and everything in it at that far end: shower
    in the south-west corner, WC against the west wall under the window, basin
    round the corner on the north wall beside it.

    That is what the photograph shows and it is not what this used to draw,
    which had the shower and the WC swapped and the basin and a washing machine
    strung along the south wall like a galley kitchen — so the room you walked
    into was a corridor with things down one side of it, and the far end, which
    is the whole room in life, was empty."""
    x0, x1, y0, y1 = ROOMS["bath"]
    d0, d1 = D_BATH[0] - 0.02, D_BATH[1] + 0.02
    w0, w1 = W_BATH_W[0] - 0.02, W_BATH_W[1] + 0.02
    for axis, at, a0, a1, face, holes in (
            ("x", y0 + 0.01, x0, x1, 1, ()),
            ("x", y1 - 0.01, x0, x1, -1, ()),
            # 5 cm proud of the room line and not 1, because the west wall is
            # the outside wall and it already carries a 4 cm skin of plaster on
            # the inside of it. A tiled face 1 cm in sat 3 cm *inside* that
            # skin, so the whole far end of the room drew as bare grey plaster
            # with the tiling buried in it — which is the other half of why
            # nobody noticed the window behind it had been bricked up.
            ("y", x0 + 0.055, y0, y1, 1,
             ((w0, w1, F2 + W_BATH_W[2] - 0.02, F2 + W_BATH_W[3] + 0.05),)),
            ("y", x1 - 0.01, y0, y1, -1,
             ((d0, d1, F2 - 0.05, F2 + D_BATH[3] + 0.02),))):
        tiled_face(kit, axis, at, a0, a1, F2 + 0.02, F2 + 2.05, face=face,
                   size=0.175, accent=TILE_DEEP, accent_p=0.045, holes=holes)

    # Shower in the south-west corner — the far left as you come in, which is
    # where the curtain rail and the mixer are in the picture.
    sx, sy = x0 + 0.07, y0 + 0.02
    sy1 = sy + 0.84
    kit.span(WHITEGOODS, sx, sx + 0.86, sy, sy1, F2 + 0.02, F2 + 0.14, bev=0.012)
    kit.span((0.86, 0.87, 0.88), sx + 0.04, sx + 0.82, sy + 0.06, sy1 - 0.06,
             F2 + 0.10, F2 + 0.125, bev=0.004)
    kit.span(CHROME, sx + 0.04, sx + 0.10, sy + 0.12, sy + 0.18,
             F2 + 1.05, F2 + 1.20, bev=0.004)
    bm_cylinder(kit.bm(CHROME, 0.003), sx + 0.07, sy + 0.15,
                F2 + 1.20, F2 + 1.92, 0.014, 0.014, seg=8)
    kit.span(CHROME, sx, sx + 0.88, sy1 - 0.02, sy1 + 0.02, F2 + 1.94, F2 + 1.97,
             bev=0.004)
    curtain(kit, "x", sy1 - 0.03, sx + 0.50, sx + 0.88, F2 + 0.16, F2 + 1.94,
            colour=(0.35, 0.70, 0.80), amp=0.03)

    # WC against the west wall, directly under the window, with the shower on
    # one side of it and the basin round the corner on the other.
    ty = y0 + 1.09
    _wc(kit, x0 + 0.07, ty)
    # The sill under the window is a shelf, and in the photograph it has four
    # bottles on it.
    kit.span(TILE_WALL, x0 + 0.07, x0 + 0.21, W_BATH_W[0], W_BATH_W[1],
             F2 + 1.36, F2 + 1.40, bev=0.006)
    for i, (c, h) in enumerate(((( 0.86, 0.30, 0.22), 0.17),
                                ((0.24, 0.52, 0.34), 0.20),
                                ((0.90, 0.86, 0.30), 0.13))):
        bm_cylinder(kit.bm(c, 0.004), x0 + 0.13,
                    W_BATH_W[0] + 0.12 + i * 0.17,
                    F2 + 1.40, F2 + 1.40 + h, 0.025, 0.022, seg=8)

    # Basin on the north wall in the far corner, mirror over it.
    vx = x0 + 0.58
    kit.span(WHITEGOODS, vx, vx + 0.56, y1 - 0.42, y1 - 0.02, F2 + 0.04,
             F2 + 0.78, bev=0.006)
    kit.span(WHITEGOODS, vx - 0.04, vx + 0.62, y1 - 0.48, y1, F2 + 0.78,
             F2 + 0.86, bev=0.03)
    kit.span((0.88, 0.89, 0.90), vx + 0.04, vx + 0.54, y1 - 0.42, y1 - 0.06,
             F2 + 0.80, F2 + 0.845, bev=0.02)
    kit.span(CHROME, vx + 0.26, vx + 0.32, y1 - 0.12, y1 - 0.06,
             F2 + 0.86, F2 + 1.06, bev=0.004)
    kit.span(CHROME, vx + 0.26, vx + 0.32, y1 - 0.26, y1 - 0.12,
             F2 + 1.02, F2 + 1.06, bev=0.004)
    kit.span((0.72, 0.78, 0.80), vx - 0.02, vx + 0.58, y1 - 0.03, y1 - 0.012,
             F2 + 1.20, F2 + 1.84, bev=0.004)
    kit.span(CHROME, vx - 0.06, vx + 0.62, y1 - 0.20, y1 - 0.02,
             F2 + 1.16, F2 + 1.19, bev=0.004)

    # The white unit that stands against the north wall halfway down the room,
    # and the towel rail in front of it.
    wx = x0 + 1.30
    kit.span(WHITEGOODS, wx, wx + 0.58, y1 - 0.44, y1 - 0.02, F2 + 0.02,
             F2 + 0.86, bev=0.008)
    kit.span((0.82, 0.82, 0.81), wx + 0.02, wx + 0.56, y1 - 0.46, y1 - 0.44,
             F2 + 0.74, F2 + 0.84, bev=0.004)
    kit.span((0.86, 0.87, 0.88), wx - 0.02, wx + 0.60, y1 - 0.47, y1,
             F2 + 0.86, F2 + 0.90, bev=0.008)
    for c in (wx + 0.10, wx + 0.48):
        bm_cylinder(kit.bm(CHROME, 0.002), c, y1 - 0.06, F2 + 1.10, F2 + 1.24,
                    0.012, 0.012, seg=8)
    kit.span(CHROME, wx + 0.08, wx + 0.50, y1 - 0.09, y1 - 0.03,
             F2 + 1.22, F2 + 1.25, bev=0.004)
    kit.span((0.42, 0.72, 0.46), wx + 0.12, wx + 0.30, y1 - 0.11, y1 - 0.04,
             F2 + 0.86, F2 + 1.23, bev=0.006)
    kit.span((0.90, 0.90, 0.88), wx + 0.32, wx + 0.48, y1 - 0.11, y1 - 0.04,
             F2 + 0.90, F2 + 1.23, bev=0.006)

    # There used to be two things on the floor, on the principle that nobody's
    # bathroom floor is clear. One was a bucket, and it was standing exactly
    # where the lavatory is, so it read as a teal drum sat in the pan. The
    # other was a pink bottle in the middle of the open floor with nothing
    # near it, which is not clutter, it is litter. The cobalt tiling is better
    # off bare.
    ceiling_light(kit, (x0 + x1) / 2, (y0 + y1) / 2, dome=True)


def _lay_disc(kit, colour, cx, cy, cz, r, t):
    """A disc facing -Y — a washing-machine door, a wheel, a clock."""
    vs = bm_cylinder(kit.bm(colour, 0.003), 0, 0, -t / 2, t / 2, r, r, seg=18)
    for v in vs:
        x, y, z = v.co
        v.co = (cx + x, cy + z, cz + y)


def _plate_bm(bm, poly, y0, y1):
    """`_plate`, into a bmesh you already have.

    Split out because the laptop lid is built flat and then *rotated* about its
    hinge, and `kit.bm()` hands back a shared per-colour mesh with the whole
    house already in it — there is no way to transform the last thing you put in
    it. Anything that has to move after it is built needs its own bmesh.
    """
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1]
               - poly[(i + 1) % len(poly)][0] * poly[i][1]
               for i in range(len(poly)))
    if area < 0:
        poly = list(reversed(poly))
    lo = [bm.verts.new((x, y0, z)) for x, z in poly]
    hi = [bm.verts.new((x, y1, z)) for x, z in poly]
    bm.verts.ensure_lookup_table()
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], hi[i], hi[j], lo[j]))
    bm.faces.new(tuple(lo))
    bm.faces.new(tuple(reversed(hi)))


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
    _plate_bm(kit.bm(colour, bev), poly, y0, y1)


FISH_BODY = (0.46, 0.75, 0.88)
FISH_FIN = (0.13, 0.47, 0.72)
FISH_NUM = (0.95, 0.53, 0.47)


def fish_clock(kit, cx, cz, wall, r=CLOCK_R):
    """The fish.

    A cut and painted ply fish with a quartz movement through the middle of it,
    pale blue with darker blue fins and stripes, coral numbers and one round eye
    with a white highlight in it. Its hands are hung at runtime — see the
    `clock` block in the sidecar. It hangs on the spine wall
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
    # The smile.
    #
    # This was a triangular notch at the tip of the snout, which is a mouth and
    # is not a smile, and on the one on the wall the smile is most of the point:
    # it is a cute clock rather than a fish-shaped clock because of one drawn
    # line. It starts at the tip, runs back and down under the eye and hooks up
    # at the far end, so the concave side faces the sky.
    #
    # Emitted as one convex quad per segment rather than as a single curved
    # ribbon, for the same reason the rest of the animal is five overlapping
    # plates: a curve is not convex and a concave ngon is a triangulation you
    # have to hope about. The joints overlap; at 1 cm of stroke the notch on the
    # outside of each bend is a fraction of a millimetre.
    smile = [(-1.52, -0.01), (-1.30, -0.18), (-1.05, -0.27),
             (-0.83, -0.26), (-0.66, -0.14)]
    for i in range(len(smile) - 1):
        (ax, az), (bx, bz) = smile[i], smile[i + 1]
        w0, w1 = 0.082 - 0.011 * i, 0.082 - 0.011 * (i + 1)
        dx, dz = bx - ax, bz - az
        L = math.hypot(dx, dz) or 1.0
        ux, uz = dx / L, dz / L
        nx, nz = -uz, ux
        # Run each segment a little past both ends. Butted exactly, the outside
        # of every bend opens a notch the width of the stroke and the smile
        # reads as four separate dashes.
        ax, az = ax - ux * w0, az - uz * w0
        bx, bz = bx + ux * w1, bz + uz * w1
        P([(ax + nx * w0, az + nz * w0), (bx + nx * w1, bz + nz * w1),
           (bx - nx * w1, bz - nz * w1), (ax - nx * w0, az - nz * w0)],
          FISH_FIN, face - 0.002, face + 0.004)

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
        w = (0.014 if h % 3 == 0 else 0.011) * (r / 0.178)
        px = mx + math.sin(a) * 0.62 * r
        pz = mz + math.cos(a) * 0.62 * r
        kit.span(FISH_NUM, px - w, px + w, face - 0.008, face - 0.001,
                 pz - w * 1.25, pz + w * 1.25, bev=0.002)

    # The hands are not baked. They used to be, at ten past ten, which is how
    # every clock in every photograph of a clock is set — and a clock stopped at
    # ten past ten in a room you are walking around is a clock that has stopped.
    # They are three meshes built at runtime off the wall clock, second hand
    # included, from the spindle written into the sidecar below. All that is
    # left here is the hub they turn on.
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
    # The armchair beside the sofa, facing the same way it does.
    #
    # It was at 1.62 turned to +y, which put it against the bookshelf looking at
    # the bookshelf — a chair whose whole view is a metre of paperbacks, in the
    # one room in the game with a channel outside it. Turned to −y and pulled in
    # beside the sofa's east end, so somebody sitting in it is looking out
    # through the terrace doors, which is the only reason to sit down in here.
    # The low table moves south with it: two seats side by side want the table
    # in front of them and not between them.
    low_chair(kit, 0.86, -1.05, yaw=-math.pi / 2)
    round_table(kit, 0.55, -2.00, F2, r=0.32, h=0.44)
    kit.span((0.85, 0.85, 0.84), 0.50, 0.60, -2.04, -1.96, F2 + 0.44,
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
    plastic_chair(kit, LAP_SEAT[0], LAP_SEAT[1], F2, yaw=-math.pi / 2 + 0.15)
    laptop(kit, LAP_X, LAP_Y, F2 + 0.74)

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


def _glyph(ch, t=0.20):
    """One capital, as convex polygons in a unit cell.

    Seven letters, because ALIENWARE needs seven. Stroke-built rather than
    stepped: A, N, W and R all live or die on their diagonals, and a diagonal
    approximated by three axis-aligned boxes at 8 mm tall is a smudge. `_plate`
    takes any convex polygon, so a diagonal is a quad and costs the same as a
    bar. `t` is the stroke width as a fraction of the cell.
    """
    h = t / 2
    return {
        "A": [[(0, 0), (t, 0), (0.5 + h, 1), (0.5 - h, 1)],
              [(1, 0), (1 - t, 0), (0.5 - h, 1), (0.5 + h, 1)],
              [(0.19, 0.30), (0.81, 0.30), (0.81, 0.30 + t * 0.85),
               (0.19, 0.30 + t * 0.85)]],
        "L": [[(0, 0), (t, 0), (t, 1), (0, 1)],
              [(0, 0), (0.86, 0), (0.86, t * 0.85), (0, t * 0.85)]],
        "I": [[(0.5 - h, 0), (0.5 + h, 0), (0.5 + h, 1), (0.5 - h, 1)]],
        "E": [[(0, 0), (t, 0), (t, 1), (0, 1)],
              [(0, 1 - t * 0.85), (0.84, 1 - t * 0.85), (0.84, 1), (0, 1)],
              [(0, 0.5 - t * 0.42), (0.74, 0.5 - t * 0.42),
               (0.74, 0.5 + t * 0.42), (0, 0.5 + t * 0.42)],
              [(0, 0), (0.84, 0), (0.84, t * 0.85), (0, t * 0.85)]],
        "N": [[(0, 0), (t, 0), (t, 1), (0, 1)],
              [(1 - t, 0), (1, 0), (1, 1), (1 - t, 1)],
              [(0, 1), (t * 1.25, 1), (1, 0), (1 - t * 1.25, 0)]],
        "W": [[(0, 1), (t, 1), (0.25 + h, 0), (0.25 - h, 0)],
              [(0.5, 1), (0.5 - t, 1), (0.25 - h, 0), (0.25 + h, 0)],
              [(0.5, 1), (0.5 + t, 1), (0.75 + h, 0), (0.75 - h, 0)],
              [(1, 1), (1 - t, 1), (0.75 - h, 0), (0.75 + h, 0)]],
        "R": [[(0, 0), (t, 0), (t, 1), (0, 1)],
              [(0, 1 - t * 0.85), (0.74, 1 - t * 0.85), (0.74, 1), (0, 1)],
              [(0.74 - t, 0.50), (0.74, 0.50), (0.74, 1), (0.74 - t, 1)],
              [(0, 0.50), (0.74, 0.50), (0.74, 0.50 + t * 0.85),
               (0, 0.50 + t * 0.85)],
              [(0.36, 0.55), (0.36 + t, 0.55), (1.0, 0), (1.0 - t, 0)]],
    }.get(ch, [])


def _word(bm, text, x0, z0, cw, ch, gap, y0, y1, t=0.20, flip=False):
    """Set a word into `bm`, left to right, in the (x, z) plane.

    `flip` mirrors it in x, which is not a nicety. A viewer standing at +y
    looking toward −y has +x on their *left* — so a word set the natural way
    along +x reads backwards to the only person who will ever look at it. The
    laptop's badge faces its user; the badge is therefore set in −x.
    """
    x = x0
    d = -1 if flip else 1
    for c in text:
        for poly in _glyph(c, t):
            _plate_bm(bm, [(d * (x + px * cw), z0 + pz * ch) for px, pz in poly],
                      y0, y1)
        x += cw + gap
    return x - gap - x0            # the width actually set


# The laptop, on the white plastic table by the terrace doors.
#
# Laptop-local: +x across, −y to the back (the hinge), +z up; the person sits at
# +y. Placed at LAP_YAW, which is the angle it was left at rather than square to
# anything, because nobody puts a laptop down square to the table.
LAP_X, LAP_Y = 1.35, -2.85
LAP_YAW = 0.20
LAP_W, LAP_D, LAP_H = 0.404, 0.322, 0.028   # an 18-inch machine, and it is one
LID_H, LID_T = 0.272, 0.013
LID_LEAN = math.radians(17.0)               # off vertical, leaning back
SCR_U0, SCR_U1 = 0.030, 0.262               # up the lid: chin, then screen
SCR_HW = 0.188                              # half the screen's width
# Where you sit to use it: the plastic chair, and a seated eye rather than a
# standing one.
LAP_SEAT = (1.35, -2.00, F2 + 1.18)

LAP_SHELL = (0.052, 0.055, 0.060)   # anodised near-black, very slightly blue
LAP_DECK = (0.086, 0.090, 0.098)
LAP_KEYWELL = (0.028, 0.030, 0.034)
LAP_SCREEN = (0.040, 0.046, 0.062)
LAP_MARK = (0.66, 0.69, 0.74)       # the wordmark: brushed, not white
LAP_VENT = (0.020, 0.021, 0.024)


def laptop(kit, cx, cy, z, yaw=LAP_YAW):
    """One Alienware 18, open, off.

    The old one was a 34 by 24 slab with a lighter slab leaning on it, which is
    what a laptop is from four metres away and nothing at all from the chair in
    front of it — and this one is about to be the thing the whole computer mode
    hangs off, so it is worth building: a real chassis with a rear thermal
    shelf, a hex vent, a lit keyboard, a trackpad, and the wordmark across the
    chin.

    The lid is built flat and rotated about its hinge rather than sheared, which
    is what it was. A shear keeps every point at its own height and slides it
    back, so a 27 cm lid leaning 17° came out 27 cm tall instead of 26 — and,
    much worse, the screen and the panel it sits in got *different* slides
    because they started at different depths, so the screen was not parallel to
    the lid it was in. Nobody sees that in a 34 cm laptop. Everybody sees it on
    a screen that fills the window.
    """
    c, s = math.cos(LID_LEAN), math.sin(LID_LEAN)
    y_hinge, z_hinge = -LAP_D / 2 + 0.016, LAP_H

    def lid_of(bm):
        """(v, w, u) → laptop-local, turning the flat lid up about its hinge."""
        for vv in bm.verts:
            v, w, u = vv.co.x, vv.co.y, vv.co.z
            vv.co = (v, y_hinge - u * s + w * c, z_hinge + u * c + w * s)

    def emit(bm, colour, name, bev=0.0, lid=False):
        if lid:
            lid_of(bm)
        ob = new_object(bm, name)
        if bev:
            bevel(ob, bev)
        _place(ob, cx, cy, z, yaw)
        kit.adopt(ob, colour)

    # ── the deck ──────────────────────────────────────────────────────────────
    bm = bmesh.new()
    bm_box(bm, 0, 0, LAP_H / 2, LAP_W, LAP_D, LAP_H)
    # The thermal shelf that sticks out behind the hinge — the thing that makes
    # one of these read as a gaming machine and not a ThinkPad.
    bm_box(bm, 0, -LAP_D / 2 - 0.021, LAP_H / 2 - 0.002, LAP_W * 0.86, 0.048,
           LAP_H - 0.006)
    emit(bm, LAP_SHELL, "laptop_base", bev=0.0035)

    # The keyboard well and the trackpad, milled into the deck.
    bm = bmesh.new()
    bm_box(bm, 0, -0.046, LAP_H - 0.002, 0.334, 0.120, 0.006)
    emit(bm, LAP_KEYWELL, "laptop_well")

    bm = bmesh.new()
    bm_box(bm, 0, 0.086, LAP_H + 0.0005, 0.126, 0.086, 0.003)
    emit(bm, LAP_DECK, "laptop_trackpad", bev=0.002)

    # ── the keys, lit ─────────────────────────────────────────────────────────
    # Per-key RGB, which on the real one is a blue-to-violet wash across the
    # deck with the function row picked out warm. Done as vertex colour on the
    # cap rather than as light, because there is no light in this shader — and
    # it is the right cheat anyway: what you see across a dark room is the caps
    # glowing, not the deck lit.
    #
    # The gap does the work. At 1.8 mm between 17 mm caps the rows fuse the
    # moment you look along the deck at any angle a person actually sits at, and
    # a six-row keyboard renders as eighteen tall coloured stripes. 2.6 mm of
    # dark well between 15.8 mm caps keeps the rows apart, and the colour has to
    # vary down the deck as well as across it or the stripes come back on their
    # own.
    #
    # Row 0 is the *back* row, which is where the function keys are, and the
    # front row gets a spacebar — a keyboard without one is a grid.
    rows, cols = 6, 18
    kw, gapk = 0.0158, 0.0026
    pitch = kw + gapk
    x00 = -(cols * pitch - gapk) / 2 + kw / 2
    y00 = -0.098 + kw / 2
    for r in range(rows):
        i = 0
        while i < cols:
            span = 1
            if r == rows - 1 and i == 4:
                span = 9                            # the spacebar
            kx = x00 + (i + (span - 1) / 2) * pitch
            ky = y00 + r * pitch
            f = (i + span / 2) / cols
            g = r / (rows - 1)
            if r == 0:                              # the function row, warm
                col = (0.30 + 0.34 * f, 0.62 - 0.12 * f, 0.14)
            else:
                col = (0.14 + 0.40 * f * (0.5 + 0.5 * g),
                       0.18 + 0.16 * g,
                       0.88 - 0.22 * f)
            bm = bmesh.new()
            bm_box(bm, kx, ky, LAP_H + 0.0020, kw + (span - 1) * pitch, kw,
                   0.0040)
            emit(bm, col, "key", bev=0.0007)
            i += span

    # ── the hex vent on the shelf ─────────────────────────────────────────────
    for r in range(2):
        for i in range(21):
            hx = -0.166 + i * 0.0166 + (0.0083 if r else 0)
            bm_cylinder(kit.bm(LAP_VENT, 0.0), cx + hx * math.cos(yaw)
                        - (-LAP_D / 2 - 0.012 - r * 0.016) * math.sin(yaw),
                        cy + hx * math.sin(yaw)
                        + (-LAP_D / 2 - 0.012 - r * 0.016) * math.cos(yaw),
                        z + LAP_H - 0.004, z + LAP_H - 0.001,
                        0.0062, 0.0062, seg=6)

    # ── the lid ───────────────────────────────────────────────────────────────
    bm = bmesh.new()
    bm_box(bm, 0, 0, LID_H / 2, LAP_W, LID_T, LID_H)
    emit(bm, LAP_SHELL, "laptop_lid", bev=0.0035, lid=True)

    bm = bmesh.new()
    _plate_bm(bm, [(-SCR_HW, SCR_U0), (SCR_HW, SCR_U0),
                   (SCR_HW, SCR_U1), (-SCR_HW, SCR_U1)],
              LID_T / 2 - 0.001, LID_T / 2 + 0.0015)
    emit(bm, LAP_SCREEN, "laptop_screen", lid=True)

    # ALIENWARE across the chin, in thin wide-tracked caps. The tracking is the
    # mark: set solid it is just a word, and at 6 mm a cell with 5 mm of air
    # after it is what makes it read as the badge rather than as a label.
    bm = bmesh.new()
    cw, gh, gap = 0.0062, 0.0086, 0.0050
    wide = 9 * cw + 8 * gap
    _word(bm, "ALIENWARE", -wide / 2, (SCR_U0 - 0.024) + 0.007, cw, gh, gap,
          LID_T / 2 + 0.0005, LID_T / 2 + 0.0016, t=0.18, flip=True)
    emit(bm, LAP_MARK, "laptop_mark", lid=True)

    # Four feet.
    bm = bmesh.new()
    for fx in (-0.156, 0.156):
        for fy in (-0.128, 0.128):
            bm_box(bm, fx, fy, 0.0015, 0.030, 0.016, 0.003)
    emit(bm, LAP_VENT, "laptop_feet")


def _laptop_screen_at():
    """The screen's centre in three.js house metres, and its size.

    Written out here so the sidecar and the geometry cannot disagree about where
    the thing the whole computer mode points at actually is.
    """
    c, s = math.cos(LID_LEAN), math.sin(LID_LEAN)
    u, w = (SCR_U0 + SCR_U1) / 2, LID_T / 2 + 0.001
    ly = -LAP_D / 2 + 0.016 - u * s + w * c
    lz = LAP_H + u * c + w * s
    cy_, sy = math.cos(LAP_YAW), math.sin(LAP_YAW)
    bx = LAP_X + 0.0 * cy_ - ly * sy
    by = LAP_Y + 0.0 * sy + ly * cy_
    bz = (F2 + 0.74) + lz
    return ([round(bx, 4), round(bz, 4), round(-by, 4)],
            round(SCR_HW * 2, 4), round(SCR_U1 - SCR_U0, 4))


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
    fish_clock(kit, CLOCK_X, CLOCK_Z, y)
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
    # The dish, on the verge above the top of the stairs.
    d = 0.85
    starlink(kit, X1 + ov - 0.16, -d,
             RIDGE_NOW + 0.14 - d * math.tan(PITCH_NOW))


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
    # And the dish, which goes up with the ridge.
    d = 0.85
    starlink(kit, X1 + ov - 0.16, -d, RIDGE + 0.16 - d * math.tan(PITCH))

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

    # The rail stops short of the stair. It used to run the whole open edge,
    # which put a length of balustrade straight across the head of the flight —
    # you climbed twelve treads into a fence. The gap is the stairwell and every
    # real gallery has one; the flight has its own guard up the open side.
    gallery_rail(kit, [(IX0, LOFT_Y), (IX1 - 1.16, LOFT_Y)])
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
    """Twelve treads on a folded steel stringer, up the east wall.

    2.55 m of rise in 1.98 m of run is 50°, which is a ladder-stair and not a
    staircase — and it is what both reference pictures show, because in a room
    this size a comfortable 32° flight is four metres long and eats the room it
    is trying to serve.

    It used to be fourteen treads over 2.60 m, and 2.60 m is the *entire*
    distance from the deck's open edge to the inner face of the south wall. So
    the bottom tread landed 1.5 cm off the glass: you came down the last step
    into the terrace door, with nowhere to stand and nowhere to turn, which is
    not a thing anybody would build. Two treads out and 2 cm off the going buys
    52 cm of floor at the foot — a place to arrive — at the price of six degrees
    of pitch, and six degrees is the cheaper thing to spend on a mezzanine
    ladder."""
    n = 12
    rise = (DECK - F2) / n
    go = 0.18
    # The head of the flight, 15 cm shy of the deck's open edge — so the bottom
    # of it lands at −3.03, clear of the south wall's inner face at −3.665. At
    # LOFT_Y − 0.10 it landed at −3.90: the bottom two treads were buried in the
    # wall and the foot of the stair was outside the building. You could not get
    # on to it, which is a hard thing to see in a render of a staircase that
    # otherwise looks perfectly normal.
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
        # The fish's movement, in three.js metres relative to the house origin,
        # so the runtime can hang three turning hands on it. `at` is the
        # spindle: 0.12 r east of the body's centre, because the tail is behind
        # it and the numbers go round the spindle rather than round the fish.
        # The z is 2.45 cm proud of the ply front — clear of the 8 mm hub disc,
        # which is the last thing baked into the mesh here.
        "clock": {
            "at": [round(CLOCK_X + 0.12 * CLOCK_R, 4), round(CLOCK_Z, 4),
                   round(-(BY0 - 0.005 - 0.016 - 0.0245), 4)],
            "r": CLOCK_R,
        },
        # The laptop, for the computer mode: what to spray at, where to sit, and
        # where the screen is. Three.js metres relative to the house origin.
        "laptop": (lambda scr: {
            "at": [round(LAP_X, 3), round(F2 + 0.74, 3), round(-LAP_Y, 3)],
            "yaw": round(LAP_YAW, 4),
            "screen": scr[0], "w": scr[1], "h": scr[2],
            "seat": [round(LAP_SEAT[0], 3), round(LAP_SEAT[2], 3),
                     round(-LAP_SEAT[1], 3)],
        })(_laptop_screen_at()),
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
        #
        # The sheers go out the same way and for the same reason. A net curtain
        # that stops light is not a net curtain, it is a board: the kitchen
        # window and the terrace opening both read as shuttered from inside,
        # with the brightest thing in the flat behind a flat grey sheet.
        for tag, col, why in (
            ("glass", GLASS, "the glazing, drawn transparent"),
            ("sheer", SHEER, "the net curtains, drawn through"),
        ):
            sub = [p for p in parts if p[1] == col]
            parts = [p for p in parts if p[1] != col]
            if sub:
                export(sub, OUT / ("vikendica_%s_%s.fr3d.gz" % (name, tag)), why)
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
