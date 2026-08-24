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
    bm_prism, export, new_object, reset_scene,
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
TILE_HALL = (0.098, 0.116, 0.205)   # prizemlje: the 30 cm indigo, hall and kitchen
YELLOW_W = (0.935, 0.878, 0.620)    # prizemlje: the kitchen walls and the bath ceiling
TERRA_W = (0.720, 0.408, 0.290)     # and the polished plaster down the hall
ALMOND = (0.945, 0.925, 0.880)      # the basin and the cistern, cream rather than white
TILE_DEEP = (0.085, 0.150, 0.330)   # the darker ones set into the walls
# Wall tiling. It was 0.900, which is within a thousandth of the white of a
# lavatory, and the two are not the same colour in any bathroom on earth: glazed
# wall tile is a grey-white, sanitary ware is a blue-white, and the whole reason
# a WC is legible standing against a tiled wall is that gap. Bringing this down
# six per cent is what makes PORCELAIN read as an object rather than as a
# rectangle of missing wall.
TILE_WALL = (0.838, 0.841, 0.834)
GROUT = (0.560, 0.556, 0.548)
TERRAZZO = (0.800, 0.762, 0.685)    # the terrace, 33 cm non-slip

KITCH_UP = (0.470, 0.560, 0.650)    # wall cabinets, dusty blue
KITCH_LO = (0.285, 0.330, 0.400)    # base units, slate
WORKTOP = (0.780, 0.760, 0.720)
WHITEGOODS = (0.905, 0.900, 0.885)
# Sanitary ware, and not WHITEGOODS, which is the fridge and the washing
# machine and — to within a thousandth — TILE_WALL as well. That collision did
# not matter until something white stood *against* white tiling: the cistern is
# a half-metre flat vertical face, the wall behind it is a flat vertical face,
# both were the same grey once the light was off them, and the tank read as a
# patch of missing wall rather than as a tank. Porcelain is whiter and cooler
# than a glazed wall tile in life; here it also has to be whiter than one for
# the object to exist at all.
PORCELAIN = (0.968, 0.972, 0.978)
# The bojler's jacket, and it is a *third* white, not either of the two above.
#
# Stove-enamelled steel that has been on that wall for twenty years, hanging
# directly over the washing machine — so it is judged against WHITEGOODS from a
# metre away and against TILE_WALL over its whole silhouette, and it must not
# be either. Measured off the photograph against the tile beside it at the same
# height: the machine's lid comes back 20 per cent brighter than the tile it
# stands against, the tank only 7, and every sample down the tank is warmer than
# every sample off the machine. That is an appliance white that has gone off,
# which is exactly what it is. Given WHITEGOODS instead, a metre of tank and the
# machine under it weld into one white column — which is the single thing this
# corner cannot be allowed to read as, because the whole point of the corner is
# that there are two objects stacked in it.
ENAMEL_W = (0.880, 0.868, 0.840)
# And the lonac on top of the machine, which is enamel of the other kind:
# oxblood outside, speckled blue-grey inside, rolled black rim. Every sample of
# the pot in the photograph is in the machine's own shadow, so the hue is the
# photograph's (R twice G, B about G) and the value is set by what has to
# separate: the body from the cobalt floor beyond it, the inside from the body.
ENAMEL_POT = (0.245, 0.088, 0.070)
ENAMEL_POT_H = (0.340, 0.155, 0.105)   # the two D-handles, catching light
POT_IN = (0.415, 0.430, 0.460)
# The bucket. Also read out of shadow — that side of the room has no light on
# it at all — so this is a plain saturated blue plastic set where it separates
# from TILE_FLOOR, which is the one thing it has to do: a bucket standing on
# cobalt tiling at the same value is a hole in the floor.
BUCKET_B = (0.105, 0.235, 0.560)
BUCKET_IN = (0.072, 0.170, 0.420)
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
PW_KIT = 0.25            # the kitchen's south wall downstairs, the one thick one

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
# Both bedrooms open off the big room, so both doors have to stand in the part
# of the spine the big room can actually reach: from the bathroom's east face
# at -0.74 eastward. This one used to start at -1.02, which is 18 cm *past*
# that face — so its west jamb, its architrave and the west end of its head all
# stood inside the bathroom, in front of the tiling, and the opening behind
# them was a hole into a wall you cannot see through. Hard against -0.74 the
# architrave dies into the bathroom wall's own thickness, which is where an
# architrave beside a return goes.
D_S4 = (-0.74, 0.11, 0.0, DOOR_H)
D_S3 = (0.51, 1.36, 0.0, DOOR_H)
D_BATH = (-0.40, 0.60, 0.0, DOOR_H)          # in the bathroom's east wall

W_S4_N = (-1.64, -0.44, 1.00, 2.05)          # north wall of the west bedroom
W_S4_W = (1.60, 2.50, 1.00, 2.05)            # and its window on to the west
W_S3_E = (1.70, 2.90, 1.00, 2.05)            # east wall of the east bedroom
W_KIT_W = (-3.30, -2.10, 1.00, 2.05)         # the west wall of the big room
W_BATH_W = (-0.24, 0.36, 1.40, 2.05)         # the bathroom, high, over the WC
# There is no window on the north wall. There used to be a W_N here, 70 wide,
# over the head of the double bed in soba 3 — which gave that one room two
# windows on two walls when it has one, on the east, looking down the lane.
# Neither W_S4_N above nor W_N was ever there; both are drawings of a house
# with more openings in it than this one has.

# --------------------------------------------------------------------------- #
#  prizemlje — the storey below                                                #
# --------------------------------------------------------------------------- #
# Off TLOCRT PRIZEMLJA at 1:100. The paper has a fold running down the middle
# of the drawing which shifts content by twelve to fifteen centimetres at that
# scale, so nothing here was measured off pixels: the layout was solved from
# the four printed dimension chains, each of which sums exactly to 678 or 773,
# against the scheduled areas, and then corrected on 18 August against a print
# marked up on site — red for doors, yellow for water, orange for the WC,
# purple for the true window positions.
#
# Same origin and the same axes as the floor above. The two drawings share a
# footprint, so a number here is directly comparable with the number in the
# same place upstairs, and the west face steps 70 cm east at BY1 on both
# storeys — which is the one independent check that the whole east-west
# setting-out is right.

# The drawing gives terrace 8 at minus twenty and calls the flat zero, which is
# a level datum and not a height above anything. Outside, the runtime stands
# this house on made ground: `base` in src/44-vikendica.js is the promenade
# less VIK.sink, so the promenade surface sits at +0.10 in these coordinates. A
# ground floor at 0.00 is therefore ten centimetres *under* the concrete you
# walk in off, and every square metre of it renders as beach — which is exactly
# what it did the first time it was drawn.
#
# Putting the flat at +0.30 puts terrace 8 at +0.10, flush with the promenade,
# and the 20 cm the drawing asks for between the two becomes the step over the
# threshold. The clear height falls out of the same section and is no longer a
# guess: 2.68 to the slab soffit, less 0.30, is 2.38 — within two centimetres
# of the storey above, which is what you would expect of one pour.
P_FL = 0.30                  # finished floor of the flat
P_CEIL = F2 - 0.22           # the underside of the slab above: 2.38 clear
P_TER = P_FL - 0.20          # terrace 8, one step down, as the drawing says

# Wall centrelines. The faces are the surveyed numbers; these are the middles.
P_CROSS = -0.475             # the cross wall, full width, 20
P_SPINE = 0.32               # north-south, 10, below the kitchen
P_SPINE_N = 0.37             # ... and 20 where it divides the kitchen from 7
P_BATH_E = -0.90             # the bathroom's east wall, 10
P_KIT_S = 2.04               # the kitchen's south wall, 25 — the thick one
P_TER_S = 2.075              # the rear terrace's south wall, 20

P_ROOMS = {
    "boravak": (IX0, P_SPINE - INT / 2, IY0, P_CROSS - EXT / 2),
    # 2 is an L and is kept as two rectangles, for the same reason the big room
    # upstairs is: floors, skirtings and blockers all want rectangles.
    "kupS": (IX0, P_BATH_E - INT / 2, P_CROSS + EXT / 2, BY1),
    "kupN": (NIX0, P_BATH_E - INT / 2, BY1, P_KIT_S - PW_KIT / 2),
    "soba3d": (P_SPINE + INT / 2, IX1, IY0, P_CROSS - EXT / 2),
    "soba4d": (P_SPINE + INT / 2, IX1, P_CROSS + EXT / 2, P_TER_S - EXT / 2),
    "hodnik": (P_BATH_E + INT / 2, P_SPINE - INT / 2,
               P_CROSS + EXT / 2, P_KIT_S - PW_KIT / 2),
    "kuhinja": (NIX0, P_SPINE_N - EXT / 2, P_KIT_S + PW_KIT / 2, IY1),
    "straga": (P_SPINE_N + EXT / 2, IX1, P_TER_S + EXT / 2, IY1),
}

# Openings, as (a0, a1, z0, z1) above the ground floor.
PD_TERR = (-2.76, -0.56, 0.0, 2.10)      # south wall, 220 — and the front door
# 85 clear, like every internal opening upstairs. The drawing reads 70 to 75 at
# the scale it is printed at, which is a 70 leaf in an 85 structural opening —
# and 85 is also what the walking model needs: it holds you 26 cm off a wall
# face, so a 70 hole leaves 18 cm to thread and a doorway becomes a puzzle.
PD_S3 = (-2.30, -1.45, 0.0, DOOR_H)      # 3 opens off the living room
PD_S4 = (-0.375, 0.475, 0.0, DOOR_H)     # 4 off the hall
PD_BATH = (-0.40, 0.45, 0.0, DOOR_H)     # 2 off the hall, and it slides
PD_KIT = (-0.58, 0.27, 0.0, 2.10)        # 6 off the hall, 85 and open
PD_HALL = (-0.60, 0.20, 0.0, 2.10)       # 5 into 1, open: the drawn door is out
PD_TER7 = (2.20, 3.05, 0.0, DOOR_H)      # 6 out on to the rear terrace
# Terrace 7 is a terrace: hatched on the drawing exactly like 8, so its north
# side is open to the yard between two 30 cm piers, under a 12 cm downstand.
# Which is also the back way in — yard, loggia, kitchen — and the reason the
# opening is here rather than a window: you are meant to walk through it.
PT7_OPEN = (0.77, 2.99, 0.0, 2.26)
# And its east side, which was a blind painted wall standing between the table
# and the side passage. It is not there: terrace 7 is a corner loggia, open on
# the north to the yard and on the east to the path that runs down the side of
# the house, with a pier at each end of both openings and one downstand beam
# carrying soba 4 across the corner.
PT7_EAST = (2.36, 3.46, 0.0, 2.26)

PW_S3_S = (1.44, 2.64, 1.00, 2.05)       # soba 3, south
PW_S4_E = (0.23, 1.43, 1.00, 2.05)       # soba 4, east — purple, north of centre
PW_KIT_N = (-1.64, -0.39, 1.20, 2.05)    # the kitchen, north, over the sink run
PW_BATH_W = (-0.05, 0.45, 1.40, 2.05)    # the bathroom, west, over the WC

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
# The doors are D_S4 (−0.74…0.11) and D_S3 (0.51…1.36) and each carries a 65 mm
# architrave, so the bare plaster between them runs 0.175 to 0.445: 27 cm,
# centred on x = 0.31. It used to be 68 cm, and it was 68 cm because the soba 4
# door started 18 cm inside the bathroom — the pier is smaller now because the
# doorway is finally in the room it opens off.
#
# The fish is not symmetrical about its own spindle — 1.60 r of snout one way,
# 1.82 r of tail the other — so centring it means centring the *fish* and not
# the movement, which is 0.11 r west of where the body is drawn.
#
# The animal is 3.4 r across. At r = 0.150 that was 0.51 m and it no longer
# fits; 0.070 makes it 0.24 m, with 16 mm of plaster each side. Small for this
# house, and the right size for the wall it is on: a 24 cm clock in a kitchen
# is a clock, and a 51 cm one on a 27 cm pier is a mural.
CLOCK_R = 0.070
CLOCK_X = 0.31 - 0.11 * CLOCK_R
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


def door_case(kit, axis, at, hole, base=F2, thick=INT, colour=PINE,
              sides=(-1, 1)):
    """Pine architrave both sides of an opening — the detail that dates the
    flat, and the warmest thing in every photograph.

    Both sides is the default and is right for a door between two painted
    rooms. It is wrong for a door into a tiled one: tile is set out to die into
    the reveal, and nobody then screws a softwood strip over the tile they just
    cut. `sides` takes the outward normals to keep — (1,) for the +axis side
    only, which here means the hall."""
    a0, a1, z0, z1 = hole
    z0 += base
    z1 += base
    reveal(kit, axis, at, a0, a1, z0, z1, thick, colour=colour, bev=0.008)
    for out in sides:
        d0 = out * (thick / 2)
        d1 = out * (thick / 2 + 0.020)
        for p, q in ((a0 - 0.065, a0), (a1, a1 + 0.065)):
            kit.span(colour, *_face_span(axis, at, p, q, z0, z1 + 0.065, d0, d1),
                     bev=0.004)
        kit.span(colour, *_face_span(axis, at, a0 - 0.065, a1 + 0.065,
                                     z1, z1 + 0.065, d0, d1), bev=0.004)


def slider(kit, axis, at, hole, base=F2, thick=INT, slide=1.0,
           open_frac=1.0, sides=(-1, 1)):
    """A flush ply leaf on an exposed top track, parked to one side.

    Two of the three internal doors here are these. They are hung outside the
    wall on a rail screwed to the face above the opening, they never quite
    close, and the track is the thing you see first in the video."""
    a0, a1, z0, z1 = hole
    z0 += base
    z1 += base
    door_case(kit, axis, at, hole, base, thick, sides=sides)
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
    # ── the storey below ────────────────────────────────────────────────────
    # There is a whole flat down there — TLOCRT PRIZEMLJA, 41.94 m² — and it
    # was, for a long time, four rendered walls with the openings guessed off
    # the elevations. It is drawn now. See `prizemlje`.
    prizemlje(kit)

    # ── the upper storey ────────────────────────────────────────────────────
    # The north half is set back 70 cm on the west, so the west face is two
    # planes and the south, north and east are one each.
    ext = {
        "south": ("x", Y0 + EXT / 2, X0, X1, [D_TERR, W_TERR]),
        "north": ("x", Y1 - EXT / 2, NX0, X1, []),
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
        "north": ("x", IY1 - 0.02, NIX0 - 0.10, IX1 + 0.10, []),
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
    # Hall side only. The bathroom side of this opening is tile.
    slider(kit, "y", BATH_E, D_BATH, thick=INT, slide=-1.0, open_frac=0.88,
           sides=(1,))
    terrace_doors(kit)

    # ── windows ─────────────────────────────────────────────────────────────
    window(kit, "x", Y0 + EXT / 2, W_TERR, F2, curtain_c=SHEER)
    window(kit, "y", X0 + EXT / 2, W_KIT_W, F2, curtain_c=SHEER)
    window(kit, "y", X0 + EXT / 2, W_BATH_W, F2, curtain_c=None)
    # Sheer, like every other curtain in the flat. It was teal, which is the
    # colour of the one in the photograph — but teal bakes into the opaque
    # shell, and an opaque curtain across the only window in the room is a
    # painted board where the light comes from.
    window(kit, "y", NX0 + EXT / 2, W_S4_W, F2, curtain_c=SHEER)
    window(kit, "y", X1 - EXT / 2, W_S3_E, F2, curtain_c=SHEER)

    terrace(kit)
    outside_stair(kit)
    yard(kit)
    front_yard(kit)
    bathroom(kit)
    kitchen(kit)
    living(kit)
    bedroom_east(kit)
    bedroom_west(kit)


def _arc_run(kit, colour, cx, cy, r, a0, a1, z0, z1, t=0.024, seg=12,
             bev=0.004):
    """A run of box segments following an arc in plan, each turned to its own
    chord.

    Axis-aligned boxes stepped round a curve give a staircase, and a staircase
    is what a quadrant shower rail looked like the first time: twelve little
    blocks marching over the corner of the room. A chord that is turned to face
    the way it is going is one straight bar, and twelve of them are a curve."""
    for i in range(seg):
        b0 = a0 + (a1 - a0) * i / seg
        b1 = a0 + (a1 - a0) * (i + 1) / seg
        p0 = (cx + r * math.cos(b0), cy + r * math.sin(b0))
        p1 = (cx + r * math.cos(b1), cy + r * math.sin(b1))
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + t * 0.6
        ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        bm = bmesh.new()
        bm_box(bm, 0, 0, (z0 + z1) / 2, L, t, z1 - z0)
        ob = new_object(bm, "arc")
        bevel(ob, bev)
        _place(ob, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0.0, ang)
        kit.adopt(ob, colour)


def boravak(kit):
    """The big room downstairs, 10.7 m². You come in off the terrace straight
    into it and it runs on into the hall at the far end without a door, which
    is what the red cross on the marked-up print means.

    A pine dining table and four chairs, a white shelf recess in the east wall
    and a split unit high on the west.

    There was a blue patterned three-seater in here for one release. It came
    from a photograph and it went in because sofa() had been planting itself a
    storey up whatever it was told, so the fix that gave the function a `floor`
    put the thing where the plan said it went. It was not asked for either way
    and the room is a room you pass through on the way to the stair, so it is
    out — the table is what the space is for."""
    x0, x1, y0, y1 = P_ROOMS["boravak"]

    round_table(kit, x0 + 2.30, y0 + 1.90, P_FL, r=0.52, h=0.74)
    for i, (dx, dy, yaw) in enumerate(((-0.78, 0.0, 0.0), (0.78, 0.0, math.pi),
                                       (0.0, -0.78, math.pi / 2),
                                       (0.0, 0.78, -math.pi / 2))):
        wooden_chair(kit, x0 + 2.30 + dx, y0 + 1.90 + dy, P_FL, yaw)

    # The white shelving on the east wall. It reads as a recess in the
    # photographs and it cannot be one: the spine is a 10 cm partition and you
    # do not sink a 30 cm box into a 10 cm wall. So it is a shallow cased unit
    # hung on the face of it, which is what a 10 cm wall actually gets.
    #
    # And it sits between the soba 3 door and the cross wall, because the first
    # place it went was across the door: y -1.77 to -0.81 against an opening at
    # -2.30 to -1.45, which is a bookcase standing in a doorway.
    rx = x1 - 0.010
    ry0, ry1 = PD_S3[1] + 0.10, y1 - 0.24
    kit.span(WALL_W, rx - 0.22, rx, ry0, ry1, P_FL + 0.86, P_FL + 2.10,
             bev=0.006)
    for j in range(3):
        kit.span(WHITEGOODS, rx - 0.20, rx, ry0 + 0.02, ry1 - 0.02,
                 P_FL + 1.10 + j * 0.32, P_FL + 1.13 + j * 0.32, bev=0.004)
        for k in range(3):
            c = RNG.choice([(0.72, 0.24, 0.18), (0.22, 0.36, 0.62),
                            (0.86, 0.80, 0.60), (0.20, 0.44, 0.30)])
            b0 = ry0 + 0.08 + k * 0.22
            kit.span(c, rx - 0.17, rx - 0.05, b0, b0 + RNG.uniform(0.05, 0.13),
                     P_FL + 1.13 + j * 0.32,
                     P_FL + 1.13 + j * 0.32 + RNG.uniform(0.14, 0.24),
                     bev=0.004)

    # The split unit, high on the west wall where it is in the photographs.
    kit.span(WHITEGOODS, x0 + 0.04, x0 + 0.24, y0 + 1.30, y0 + 2.22,
             P_CEIL - 0.46, P_CEIL - 0.16, bev=0.03)
    kit.span((0.80, 0.81, 0.82), x0 + 0.20, x0 + 0.245, y0 + 1.34,
             y0 + 2.18, P_CEIL - 0.30, P_CEIL - 0.26, bev=0.006)

    kit.span(TEAL, x0 + 0.80, x0 + 2.00, y0 + 0.04, y0 + 0.86, P_FL + 0.004,
             P_FL + 0.016, bev=0.004)


def soba_dolje(kit):
    """The two bedrooms on this floor. Both take a double against the wall
    away from the door and a wardrobe on the spine, which is the only way
    either of them works: the doors are in the spine and the windows are not,
    so the bed goes where neither is."""
    # Soba 3. The head goes to the cross wall on the north side and not to the
    # south wall, where it went first — the south wall is the one with the
    # window in it, and a bed headed under a window puts the only opening in the
    # room over the pillows. That is the same mistake soba 4 upstairs had.
    x0, x1, y0, y1 = P_ROOMS["soba3d"]
    bed(kit, x1 - 0.82, y1 - 1.06, yaw=-math.pi / 2, w=1.44, l=2.00,
        floor=P_FL)
    kit.span(WALNUT, x1 - 1.99, x1 - 1.59, y1 - 0.46, y1 - 0.06, P_FL,
             P_FL + 0.54, bev=0.006)
    bm_cylinder(kit.bm((0.86, 0.84, 0.78), 0.006), x1 - 1.79, y1 - 0.26,
                P_FL + 0.54, P_FL + 0.76, 0.09, 0.12, seg=14)
    # The wardrobe stands on the spine *south* of the door, not across it.
    kit.span(WALNUT, x0 + 0.04, x0 + 0.62, y0 + 0.10, y0 + 1.24, P_FL,
             P_FL + 2.00, bev=0.008)
    for c in (y0 + 0.44, y0 + 0.86):
        kit.span(BEECH, x0 + 0.62, x0 + 0.66, c, c + 0.026, P_FL + 1.02,
                 P_FL + 1.16, bev=0.004)

    x0, x1, y0, y1 = P_ROOMS["soba4d"]
    bed(kit, x1 - 1.20, y1 - 1.05, yaw=-math.pi / 2, w=1.40, l=1.98,
        floor=P_FL)
    kit.span(WALNUT, x0 + 0.72, x0 + 1.12, y1 - 0.46, y1 - 0.06, P_FL,
             P_FL + 0.54, bev=0.006)
    # Clear of PD_S4, which takes the southern 85 cm of this wall.
    kit.span(WALNUT, x0 + 0.04, x0 + 0.60, y0 + 0.98, y1 - 0.08, P_FL,
             P_FL + 2.00, bev=0.008)
    for c in (y0 + 1.36, y0 + 1.76):
        kit.span(BEECH, x0 + 0.60, x0 + 0.64, c, c + 0.026, P_FL + 1.02,
                 P_FL + 1.16, bev=0.004)
    kit.span(LINEN, x1 - 0.90, x1 - 0.50, y0 + 0.24, y0 + 0.62, P_FL + 0.44,
             P_FL + 0.58, bev=0.02)


def kuhinja(kit):
    """The ground-floor kitchen. Sink on the west wall, which is the one thing
    the marked-up print settles outright: the drawing puts it under the north
    window and every photograph puts it on the return, and the yellow mark is
    on the return.

    Cream gloss doors, a grey-brown worktop, a 15 cm white splashback and a
    bare bulb on a flex. Nothing in here matches anything in the flat above,
    which is right — they were fitted twenty years apart."""
    x0, x1, y0, y1 = P_ROOMS["kuhinja"]
    CREAM = (0.900, 0.876, 0.820)
    TOP = (0.480, 0.442, 0.395)
    top = P_FL + 0.90

    # The west run, with the sink in it, and the north run under the window.
    wy0, wy1 = y0 + 0.06, y1 - 0.04
    kit.span(CREAM, x0 + 0.02, x0 + 0.62, wy0, wy1, P_FL + 0.10, top - 0.04,
             bev=0.004)
    kit.span(PLINTH, x0 + 0.06, x0 + 0.58, wy0 + 0.04, wy1 - 0.04, P_FL,
             P_FL + 0.10, bev=0.004)
    ny0, ny1 = y1 - 0.62, y1 - 0.02
    # 1.42 and not 2.06: the run gave up a unit so the fridge could have the
    # north-east corner — see below.
    nx0, nx1 = x0 + 0.64, x0 + 1.42
    kit.span(CREAM, nx0, nx1, ny0, ny1, P_FL + 0.10, top - 0.04, bev=0.004)
    kit.span(PLINTH, nx0 + 0.04, nx1 - 0.04, ny0 + 0.04, ny1 - 0.04, P_FL,
             P_FL + 0.10, bev=0.004)

    # The worktop, in two runs meeting at the corner, with the bowl cut out of
    # the west one.
    bx0, bx1 = x0 + 0.09, x0 + 0.55
    by0, by1 = (wy0 + wy1) / 2 - 0.24, (wy0 + wy1) / 2 + 0.24
    for a0, a1, b0, b1 in ((x0, bx0, wy0 - 0.02, wy1 + 0.02),
                           (bx1, x0 + 0.64, wy0 - 0.02, wy1 + 0.02),
                           (bx0, bx1, wy0 - 0.02, by0),
                           (bx0, bx1, by1, wy1 + 0.02)):
        kit.span(TOP, a0, a1, b0, b1, top - 0.04, top, bev=0.006)
    kit.span(TOP, x0 + 0.64, nx1 + 0.02, ny0 - 0.02, y1, top - 0.04, top,
             bev=0.006)

    STEEL_S = (0.72, 0.73, 0.74)
    kit.span(STEEL_S, bx0, bx1, by0, by1, top - 0.17, top - 0.152, bev=0.004)
    for a0, a1, b0, b1 in ((bx0, bx0 + 0.018, by0, by1),
                           (bx1 - 0.018, bx1, by0, by1),
                           (bx0, bx1, by0, by0 + 0.018),
                           (bx0, bx1, by1 - 0.018, by1)):
        kit.span(STEEL_S, a0, a1, b0, b1, top - 0.17, top - 0.004, bev=0.003)
    bm_cylinder(kit.bm(CHROME, 0.002), (bx0 + bx1) / 2, (by0 + by1) / 2,
                top - 0.172, top - 0.160, 0.036, 0.036, seg=12)
    # The mixer comes out of the wall the pipes are in, which is the west one.
    kit.span(CHROME, x0 + 0.06, x0 + 0.10, (by0 + by1) / 2 - 0.03,
             (by0 + by1) / 2 + 0.03, top, top + 0.26, bev=0.004)
    kit.span(CHROME, x0 + 0.06, x0 + 0.32, (by0 + by1) / 2 - 0.03,
             (by0 + by1) / 2 + 0.03, top + 0.22, top + 0.26, bev=0.004)

    # Doors and handles on both runs.
    for i in range(2):
        d = wy0 + 0.02 + i * ((wy1 - wy0) / 2)
        kit.span(tuple(v * 0.92 for v in CREAM), x0 + 0.03, x0 + 0.615,
                 d - 0.004, d + 0.004, P_FL + 0.12, top - 0.06, bev=0.001)
        kit.span(CHROME, x0 + 0.615, x0 + 0.628, d + 0.08, d + 0.30,
                 top - 0.16, top - 0.14, bev=0.002)
    for i in range(2):
        d = nx0 + 0.02 + i * ((nx1 - nx0) / 2)
        kit.span(tuple(v * 0.92 for v in CREAM), d - 0.004, d + 0.004,
                 ny0 + 0.03, ny1, P_FL + 0.12, top - 0.06, bev=0.001)
        kit.span(CHROME, d + 0.10, d + 0.32, ny0 + 0.018, ny0 + 0.032,
                 top - 0.16, top - 0.14, bev=0.002)

    # The splashback: 15 cm white tile, and only over the runs.
    tiled_face(kit, "y", x0 + 0.045, wy0 - 0.06, wy1 + 0.06, top, top + 0.58,
               face=1, size=0.15, colour=TILE_WALL, accent=None, accent_p=0)
    tiled_face(kit, "x", y1 - 0.045, x0 + 0.60, nx1 + 0.70, top, top + 0.58,
               face=-1, size=0.15, colour=TILE_WALL, accent=None, accent_p=0,
               holes=((PW_KIT_N[0] - 0.03, PW_KIT_N[1] + 0.03,
                       P_FL + PW_KIT_N[2] - 0.04, P_FL + PW_KIT_N[3]),))

    # The wall units over the sink. The room had base units, a worktop and a
    # 58 cm splashback and then bare plaster all the way to the ceiling, which
    # is not a fitted kitchen — it is the bottom half of one, and standing at
    # the sink you were looking at a tiled strip with nothing over it.
    #
    # West wall only, and that is not a shortcut: the north run is under the
    # window, whose head is at P_FL + 2.05 with 63 cm of wall left above it.
    # A cupboard there would hang over the glass. Thirty centimetres above a
    # window is where a curtain rail goes.
    ux1 = x0 + 0.36
    uz0, uz1 = top + 0.58, top + 1.22
    kit.span(CREAM, x0 + 0.02, ux1, wy0, wy1, uz0, uz1, bev=0.005)
    # Three doors across the 1.40 run, told apart the way the base units are:
    # by the shadow gap between them and by the handle each one carries. On a
    # wall unit the handle is along the bottom edge, because that is the edge
    # you can reach.
    for i in range(1, 3):
        d = wy0 + i * ((wy1 - wy0) / 3)
        kit.span(tuple(v * 0.92 for v in CREAM), x0 + 0.03, ux1 + 0.004,
                 d - 0.004, d + 0.004, uz0 + 0.02, uz1 - 0.02, bev=0.001)
    for i in range(3):
        c = wy0 + (i + 0.5) * ((wy1 - wy0) / 3)
        kit.span(CHROME, ux1, ux1 + 0.014, c - 0.13, c + 0.13,
                 uz0 + 0.045, uz1 - 0.575, bev=0.002)
    # A cornice proud of the doors, and under the carcass the strip light that
    # is the only thing that lights the worktop once the bulb is behind you.
    kit.span(CREAM, x0 + 0.02, ux1 + 0.024, wy0 - 0.012, wy1 + 0.012,
             uz1, uz1 + 0.05, bev=0.008)
    kit.span((0.94, 0.93, 0.90), ux1 - 0.11, ux1 - 0.02, wy0 + 0.06,
             wy1 - 0.06, uz0 - 0.026, uz0, bev=0.004)
    # And what lives on top of a wall unit in a house by the sea: two tins and
    # a jar, out of reach and never moved.
    for j, (b0, bw, bh, col) in enumerate((
            (wy0 + 0.14, 0.13, 0.11, (0.72, 0.30, 0.20)),
            (wy0 + 0.34, 0.10, 0.14, (0.86, 0.82, 0.70)),
            (wy1 - 0.30, 0.12, 0.09, (0.30, 0.42, 0.34)))):
        kit.span(col, x0 + 0.09, x0 + 0.09 + bw, b0, b0 + bw,
                 uz1 + 0.05, uz1 + 0.05 + bh, bev=0.006)

    # The cooker at the east end of the north run, free-standing and white.
    cx = nx1 + 0.04
    kit.span(WHITEGOODS, cx, cx + 0.60, ny0, ny1, P_FL, top, bev=0.006)
    kit.span((0.80, 0.80, 0.79), cx + 0.01, cx + 0.59, ny0 + 0.02, ny1 - 0.02,
             top, top + 0.012, bev=0.003)
    for i in range(2):
        for j in range(2):
            bm_cylinder(kit.bm(DARKMETAL, 0.003), cx + 0.17 + i * 0.26,
                        ny0 + 0.16 + j * 0.26, top + 0.010, top + 0.022,
                        0.082, 0.082, seg=14)
    kit.span(BLACK, cx + 0.05, cx + 0.55, ny0 + 0.005, ny0 + 0.02,
             P_FL + 0.30, P_FL + 0.62, bev=0.004)
    kit.span(CHROME, cx + 0.03, cx + 0.57, ny0 - 0.045, ny0,
             P_FL + 0.68, P_FL + 0.72, bev=0.004)

    # And the fridge: small, white, top-freezer, north-east corner. It stood
    # in the corner by the opening, which put it in your face the moment you
    # stepped in from the hall — the one place in the room a fridge cannot be.
    fx, fy1 = x1 - 0.62, y1 - 0.04
    kit.span(WHITEGOODS, fx, fx + 0.58, fy1 - 0.60, fy1, P_FL,
             P_FL + 1.44, bev=0.008)
    kit.span(tuple(v * 0.96 for v in WHITEGOODS), fx + 0.02, fx + 0.56,
             fy1 - 0.625, fy1 - 0.60, P_FL + 0.04, P_FL + 0.44, bev=0.004)
    kit.span(tuple(v * 0.96 for v in WHITEGOODS), fx + 0.02, fx + 0.56,
             fy1 - 0.625, fy1 - 0.60, P_FL + 0.48, P_FL + 1.40, bev=0.004)
    for za in (P_FL + 0.16, P_FL + 0.60):
        kit.span(WHITEGOODS, fx + 0.04, fx + 0.10, fy1 - 0.665, fy1 - 0.625,
                 za, za + 0.22, bev=0.004)

    # A bare bulb on a flex, which is the light in here and always has been.
    bm_cylinder(kit.bm(BLACK, 0.002), (x0 + x1) / 2, (y0 + y1) / 2,
                P_CEIL - 0.42, P_CEIL - 0.02, 0.004, 0.004, seg=6)
    bm_ball(kit.bm((0.96, 0.94, 0.86), 0.004), (x0 + x1) / 2, (y0 + y1) / 2,
            P_CEIL - 0.47, 0.048, 0.048, 0.058, rows=5, seg=14)


def kupaonica(kit):
    """The ground-floor bathroom, and it is an L.

    The drawing puts a bath in the narrow north arm. The photographs put a
    quadrant shower there instead, and the marked-up print agrees: yellow in
    the north-east corner for the shower, yellow low on the south side for the
    basin, orange on the west wall for the WC with the window straight over it.

    Everything about it is a decade older than the flat above: white gloss 20
    tile to the ceiling instead of a border, a pale yellow ceiling, a cream
    cistern hung off the wall with the flush pipe showing, and an almond basin
    on a pedestal rather than a vanity unit."""
    sx0, sx1, sy0, sy1 = P_ROOMS["kupS"]
    nx0, nx1, ny0, ny1 = P_ROOMS["kupN"]
    z0, z1 = P_FL + 0.02, P_CEIL

    d0, d1 = PD_BATH[0] - 0.02, PD_BATH[1] + 0.02
    w0, w1 = PW_BATH_W[0] - 0.02, PW_BATH_W[1] + 0.02
    for axis, at, a0, a1, face, holes in (
            ("x", sy0 + 0.01, sx0, sx1, 1, ()),
            ("y", sx0 + 0.055, sy0, sy1, 1,
             ((w0, w1, P_FL + PW_BATH_W[2] - 0.02,
               P_FL + PW_BATH_W[3] + 0.05),)),
            # The south face of the step in the west wall, which is the one
            # piece of this room that only exists because the storey above it
            # is set back 70 cm and the wall had to come with it.
            ("x", ny0 - 0.055, sx0, nx0, -1, ()),
            ("y", nx0 + 0.055, ny0, ny1, 1, ()),
            ("x", ny1 - 0.01, nx0, nx1, -1, ()),
            ("y", sx1 - 0.01, sy0, ny1, -1,
             ((d0, d1, P_FL - 0.05, P_FL + PD_BATH[3] + 0.02),))):
        tiled_face(kit, axis, at, a0, a1, z0, z1, face=face, size=0.20,
                   colour=TILE_WALL, accent=None, accent_p=0, holes=holes)
    kit.span(YELLOW_W, sx0, sx1, sy0, ny1, P_CEIL - 0.03, P_CEIL - 0.02,
             bev=0.002)

    # ── the WC, backed on the north step wall, facing down the room ─────────
    # It stood under the west window, which is where the orange mark is — but
    # the mark is the soil stack, not the pan, and a pan under a window is a
    # pan you cannot open the window over. The step wall's south face carries
    # it instead, high-level cistern and all.
    _wc(kit, sx0 + 0.45, ny0 - 0.055, floor=P_FL, cistern="high", face="-y")
    # The sill is a shelf and there is always something on it.
    kit.span(TILE_WALL, sx0 + 0.07, sx0 + 0.20, PW_BATH_W[0], PW_BATH_W[1],
             P_FL + 1.38, P_FL + 1.42, bev=0.006)
    for i, (c, h) in enumerate((((0.30, 0.55, 0.78), 0.19),
                                ((0.88, 0.84, 0.30), 0.14))):
        bm_cylinder(kit.bm(c, 0.004), sx0 + 0.135,
                    PW_BATH_W[0] + 0.14 + i * 0.20,
                    P_FL + 1.42, P_FL + 1.42 + h, 0.026, 0.023, seg=8)

    # ── the basin, south wall ───────────────────────────────────────────────
    bx = -2.34
    top = P_FL + 0.86
    kit.span(ALMOND, bx, bx + 0.62, sy0 + 0.02, sy0 + 0.46, top - 0.10, top,
             bev=0.035)
    kit.span((0.90, 0.88, 0.84), bx + 0.07, bx + 0.55, sy0 + 0.08,
             sy0 + 0.40, top - 0.06, top - 0.028, bev=0.02)
    # A pedestal, not a cabinet. It is the whole difference between this
    # bathroom and the one upstairs.
    bm_loft(kit.bm(ALMOND, 0.006), [
        (P_FL + 0.00, 0.115, 0.100, bx + 0.31, sy0 + 0.22),
        (P_FL + 0.06, 0.098, 0.086, bx + 0.31, sy0 + 0.22),
        (P_FL + 0.34, 0.082, 0.074, bx + 0.31, sy0 + 0.20),
        (P_FL + 0.62, 0.096, 0.086, bx + 0.31, sy0 + 0.18),
        (P_FL + 0.74, 0.130, 0.112, bx + 0.31, sy0 + 0.17),
    ], seg=18, power=2.4)
    kit.span(CHROME, bx + 0.28, bx + 0.34, sy0 + 0.06, sy0 + 0.10,
             top, top + 0.20, bev=0.004)
    kit.span(CHROME, bx + 0.28, bx + 0.34, sy0 + 0.08, sy0 + 0.22,
             top + 0.16, top + 0.20, bev=0.004)

    # The mirror over it: a plain sheet with a black bar top and bottom and a
    # fluorescent tube on the upper one. Four objects, and it is the single
    # most recognisable thing in the room.
    m0, m1 = bx + 0.02, bx + 0.58
    kit.span((0.72, 0.78, 0.80), m0, m1, sy0 + 0.012, sy0 + 0.03,
             P_FL + 1.06, P_FL + 1.70, bev=0.004)
    for za, zb in ((P_FL + 1.02, P_FL + 1.08), (P_FL + 1.68, P_FL + 1.74)):
        kit.span(DARKMETAL, m0 - 0.02, m1 + 0.02, sy0 + 0.01, sy0 + 0.05,
                 za, zb, bev=0.006)
    bm_cylinder(kit.bm((0.96, 0.95, 0.90), 0.003), m0 + 0.06, sy0 + 0.06,
                P_FL + 1.76, P_FL + 1.79, 0.018, 0.018, seg=8)
    kit.span((0.96, 0.95, 0.90), m0 + 0.06, m1 - 0.06, sy0 + 0.045,
             sy0 + 0.075, P_FL + 1.755, P_FL + 1.795, bev=0.008)

    # ── the shower, north-east corner of the north arm ──────────────────────
    tx1, ty1 = nx1 - 0.04, ny1 - 0.03
    tx0, ty0 = tx1 - 0.88, ty1 - 0.88
    kit.span(WHITEGOODS, tx0, tx1, ty0, ty1, P_FL + 0.02, P_FL + 0.13,
             bev=0.014)
    kit.span((0.86, 0.87, 0.88), tx0 + 0.05, tx1 - 0.05, ty0 + 0.05,
             ty1 - 0.05, P_FL + 0.09, P_FL + 0.115, bev=0.006)
    bm_cylinder(kit.bm(CHROME, 0.002), (tx0 + tx1) / 2 + 0.10, ty1 - 0.06,
                P_FL + 0.115, P_FL + 0.128, 0.036, 0.036, seg=12)
    kit.span(CHROME, tx1 - 0.10, tx1 - 0.04, ty0 + 0.10, ty0 + 0.16,
             P_FL + 1.05, P_FL + 1.22, bev=0.004)
    bm_cylinder(kit.bm(CHROME, 0.003), tx1 - 0.07, ty0 + 0.13,
                P_FL + 1.22, P_FL + 1.96, 0.014, 0.014, seg=8)
    # The screen. It is a quadrant shower and not a curtained corner: a curved
    # glass panel between two chrome posts, with a rail capping it. Glass is
    # split out of the bake and drawn transparent, so the corner of the room
    # stays visible through it instead of becoming a white board.
    cx, cy, r = tx1 - 0.88, ty1 - 0.88, 0.88
    _arc_run(kit, GLASS, cx, cy, r, 0.0, math.pi / 2,
             P_FL + 0.13, P_FL + 1.92, t=0.010, seg=14, bev=0.001)
    _arc_run(kit, CHROME, cx, cy, r, 0.0, math.pi / 2,
             P_FL + 1.92, P_FL + 1.96, t=0.026, seg=14)
    for a in (0.0, math.pi / 2):
        bm_cylinder(kit.bm(CHROME, 0.003), cx + r * math.cos(a),
                    cy + r * math.sin(a), P_FL + 0.13, P_FL + 1.96,
                    0.016, 0.016, seg=8)

    # The water heater, on the wall above the head of the shower — the round
    # white drum that is in the corner of half the photographs.
    bm_cylinder(kit.bm(WHITEGOODS, 0.006), nx0 + 0.30, ny1 - 0.30,
                P_FL + 1.72, P_FL + 2.20, 0.225, 0.225, seg=18)
    kit.span(DARKMETAL, nx0 + 0.24, nx0 + 0.36, ny1 - 0.36, ny1 - 0.24,
             P_FL + 1.62, P_FL + 1.72, bev=0.008)

    # The soil stack, boxed in and tiled like the walls, in the corner behind
    # the door. Every flat in this row has one and it is always in a corner.
    tiled_face(kit, "y", nx1 - 0.24, ny0 + 0.04, ny0 + 0.30, z0, z1, face=-1,
               size=0.20, colour=TILE_WALL, accent=None, accent_p=0)
    tiled_face(kit, "x", ny0 + 0.30, nx1 - 0.24, nx1, z0, z1, face=-1,
               size=0.20, colour=TILE_WALL, accent=None, accent_p=0)

    ceiling_light(kit, (nx0 + nx1) / 2, ny0 - 0.20, dome=True, z=P_CEIL - 0.03)


def prizemlje(kit):
    """The storey below: 41.94 m², six rooms, a rear terrace and the front
    door. Everything here is off TLOCRT PRIZEMLJA and the marked-up print.

    It used to be a closed box with four invented openings punched in it, put
    there so the elevations would not read as blind render. None of them was on
    the building. The real ones are: a 220 opening on the south, which is how
    you get in — there is no door to the lane at this level and never was —
    a window each to soba 3 and soba 4, one over the kitchen sink, and one high
    in the west wall over the WC.
    """
    # A base course round the foot of the walls, and a ring rather than the
    # solid block it used to be. A block is invisible while the storey it is
    # under is closed; the moment there is a floor in there it is a 25 cm kerb
    # standing proud of it across all forty-two square metres.
    for a0, a1, b0, b1 in ((X0 - 0.06, X1 + 0.06, Y0 - 0.06, Y0 + 0.20),
                           (X0 - 0.06, X1 + 0.06, Y1 - 0.20, Y1 + 0.06),
                           (X0 - 0.06, X0 + 0.20, Y0 + 0.20, Y1 - 0.20),
                           (X1 - 0.20, X1 + 0.06, Y0 + 0.20, Y1 - 0.20)):
        kit.span(PLINTH, a0, a1, b0, b1, GRADE - 0.35, P_FL - 0.04, bev=0.03)

    # ── the outside walls, and the paint on the inside of them ──────────────
    ext = {
        "south": ("x", Y0 + EXT / 2, X0, X1, [PD_TERR, PW_S3_S]),
        "north": ("x", Y1 - EXT / 2, NX0, X1, [PW_KIT_N, PT7_OPEN]),
        "westS": ("y", X0 + EXT / 2, Y0, BY1, [PW_BATH_W]),
        "westN": ("y", NX0 + EXT / 2, BY0, Y1, []),
        "east": ("y", X1 - EXT / 2, Y0, Y1, [PW_S4_E, PT7_EAST]),
    }
    for axis, at, a0, a1, holes in ext.values():
        hs = [(h[0], h[1], P_FL + h[2], P_FL + h[3]) for h in holes]
        wall(kit, RENDER, axis, at, a0, a1, EXT, P_FL - 0.02, P_CEIL, holes=hs)
    wall(kit, RENDER, "x", BY1 - EXT / 2, X0, NX0 + EXT, EXT, P_FL - 0.02,
         P_CEIL)

    inner = {
        "south": ("x", IY0 + 0.02, IX0 - 0.10, IX1 + 0.10, [PD_TERR, PW_S3_S]),
        "north": ("x", IY1 - 0.02, NIX0 - 0.10, IX1 + 0.10,
                  [PW_KIT_N, PT7_OPEN]),
        "westS": ("y", IX0 + 0.02, IY0 - 0.10, BY1, [PW_BATH_W]),
        "westN": ("y", NIX0 + 0.02, BY0, IY1 + 0.10, []),
        "east": ("y", IX1 - 0.02, IY0 - 0.10, IY1 + 0.10,
                 [PW_S4_E, PT7_EAST]),
    }
    for axis, at, a0, a1, holes in inner.values():
        hs = [(h[0] - 0.01, h[1] + 0.01, P_FL + h[2] - 0.01, P_FL + h[3] + 0.01)
              for h in holes]
        wall(kit, WALL, axis, at, a0, a1, 0.04, P_FL, P_CEIL, holes=hs,
             bev=0.004)
    wall(kit, WALL, "x", BY1 - 0.02, X0, NIX0, 0.04, P_FL, P_CEIL, bev=0.004)

    # ── the partitions ──────────────────────────────────────────────────────
    # The cross wall runs the full width with one opening in it, and the
    # opening has no door: the drawn one is struck out on the marked-up print,
    # so the hall runs straight into the living room.
    wall(kit, WALL, "x", P_CROSS, IX0, IX1, EXT, P_FL, P_CEIL,
         holes=[(PD_HALL[0], PD_HALL[1], P_FL + PD_HALL[2],
                 P_FL + PD_HALL[3])])
    # The spine, in two thicknesses. Ten below, where it only divides rooms;
    # twenty at the top, where it is the wall between a room and the weather.
    for a0, a1, holes in ((IY0, P_CROSS, [PD_S3]),
                          (P_CROSS, P_KIT_S, [PD_S4])):
        wall(kit, WALL, "y", P_SPINE, a0, a1, INT, P_FL, P_CEIL,
             holes=[(h[0], h[1], P_FL + h[2], P_FL + h[3]) for h in holes])
    wall(kit, RENDER, "y", P_SPINE_N, P_TER_S, IY1, EXT, P_FL, P_CEIL,
         holes=[(PD_TER7[0], PD_TER7[1], P_FL + PD_TER7[2],
                 P_FL + PD_TER7[3])])
    wall(kit, WALL, "y", P_BATH_E, P_CROSS, P_KIT_S, INT, P_FL, P_CEIL,
         holes=[(PD_BATH[0], PD_BATH[1], P_FL + PD_BATH[2],
                 P_FL + PD_BATH[3])])
    # The kitchen's south wall is the one thick partition in the flat, 25, and
    # the 85 opening is at its east end where it meets the hall.
    wall(kit, WALL, "x", P_KIT_S, NIX0, P_SPINE_N - EXT / 2, PW_KIT,
         P_FL, P_CEIL,
         holes=[(PD_KIT[0], PD_KIT[1], P_FL + PD_KIT[2], P_FL + PD_KIT[3])])
    wall(kit, RENDER, "x", P_TER_S, P_SPINE_N - EXT / 2, IX1, EXT,
         P_FL, P_CEIL)

    # ── floors, and the ceiling ─────────────────────────────────────────────
    # The slab, its top 2 cm below the finish for the same reason the one above
    # it is: a floor and its slab in the same plane is a z-fight the width of
    # the storey.
    kit.span(CONCRETE, X0 - 0.05, X1 + 0.05, Y0 - 0.05, Y1 + 0.05,
             P_FL - 0.30, P_FL - 0.02, bev=0.02)
    for name in ("boravak", "soba3d", "soba4d"):
        planks(kit, *P_ROOMS[name], P_FL)
    for name in ("hodnik", "kuhinja"):
        floor_tiles(kit, *P_ROOMS[name], P_FL, size=0.30, colour=TILE_HALL)
    for name in ("kupS", "kupN"):
        floor_tiles(kit, *P_ROOMS[name], P_FL, size=0.20, colour=TILE_FLOOR)
    # Terrace 7 is paved in the same broken stone as the yard it opens on to,
    # and the two run together: there is no threshold out there, only a step.
    flagstones(kit, *P_ROOMS["straga"], P_FL)
    loggia(kit)
    kit.span(CEIL, IX0, IX1, IY0, IY1, P_CEIL - 0.02, P_CEIL, bev=0.004)

    # ── the openings, filled ────────────────────────────────────────────────
    terrace_doors(kit, base=P_FL, hole=PD_TERR)
    door_case(kit, "y", P_SPINE, PD_S3, base=P_FL, thick=INT)
    door_case(kit, "y", P_SPINE, PD_S4, base=P_FL, thick=INT)
    # The terrace door is glazed, like every outside door on the house: an
    # opening with nothing standing in it reads as a hole in the wall, and a
    # door you can see the terrace through reads as a door.
    leaf_door(kit, "y", P_SPINE_N, PD_TER7, base=P_FL, thick=EXT, glazed=True)
    door_case(kit, "x", P_KIT_S, PD_KIT, base=P_FL, thick=PW_KIT)
    door_case(kit, "x", P_CROSS, PD_HALL, base=P_FL, thick=EXT)
    # Bathroom to hall slides, exactly as it does on the floor above, and for
    # the same reason: a 112 hall cannot take a leaf swinging into it.
    # slide=+1.0: parked south it overshot the end of the wall by 80 cm and
    # hung in the living-room air; north of the opening there is 1.6 m of wall.
    slider(kit, "y", P_BATH_E, PD_BATH, base=P_FL, thick=INT, slide=1.0,
           open_frac=0.86, sides=(1,))

    window(kit, "x", Y0 + EXT / 2, PW_S3_S, P_FL, curtain_c=SHEER)
    window(kit, "x", Y1 - EXT / 2, PW_KIT_N, P_FL, curtain_c=SHEER)
    window(kit, "y", X0 + EXT / 2, PW_BATH_W, P_FL, curtain_c=None)
    window(kit, "y", X1 - EXT / 2, PW_S4_E, P_FL, curtain_c=SHEER)
    # Terrace 7's north side: reveals round the opening, and a long stone
    # step outside it, because the loggia floor is thirty over the yard.
    reveal(kit, "x", Y1 - EXT / 2, PT7_OPEN[0], PT7_OPEN[1],
           P_FL + PT7_OPEN[2], P_FL + PT7_OPEN[3], EXT, colour=WALL,
           floor=P_FL)
    reveal(kit, "y", X1 - EXT / 2, PT7_EAST[0], PT7_EAST[1],
           P_FL + PT7_EAST[2], P_FL + PT7_EAST[3], EXT, colour=WALL,
           floor=P_FL)
    kit.span(PLINTH, PT7_OPEN[0] + 0.10, PT7_OPEN[1] - 0.10, Y1 + 0.06,
             Y1 + 0.42, GRADE - 0.15, P_FL - 0.16, bev=0.02)

    # ── terrasa 8, at minus twenty ──────────────────────────────────────────
    # The slab the upper terrace stands over. Its piers are already there and
    # the drawing puts its finish one step below the flat, which is why the
    # front door has a threshold and not a ramp.
    kit.span(CONCRETE, X0, X1, TER_Y0, TER_Y1, P_TER - 0.22, P_TER - 0.02,
             bev=0.02)
    floor_tiles(kit, X0 + 0.02, X1 - 0.02, TER_Y0 + 0.02, TER_Y1, P_TER,
                size=0.33, colour=TERRAZZO)

    for name in ("boravak", "soba3d", "soba4d", "hodnik", "kuhinja"):
        x0, x1, y0, y1 = P_ROOMS[name]
        ceiling_light(kit, (x0 + x1) / 2, (y0 + y1) / 2, z=P_CEIL - 0.02)

    # The kitchen is pale yellow and the hall has a terracotta polished plaster
    # down one side of it — the two rooms in this flat that are not the same
    # blue-grey as everything else, and the two that every photograph is of.
    # Painted 12 mm proud of the face you actually see, which on the two
    # outside walls is not the room rectangle: the inner skin is 4 cm thick and
    # centred 2 cm in, so the visible plaster stands 4 cm inside the nominal
    # line. A colour laid on the nominal line is a colour laid inside the wall.
    kx0, kx1, ky0, ky1 = P_ROOMS["kuhinja"]

    # Paint goes round openings, not across them. These faces used to be four
    # unbroken slabs, which filled the door from the hall, the door to terrace
    # 7 and the kitchen window with flat colour — the doorway to soba 4 grew a
    # terracotta door that would not open the same way.
    def paint(mk, a0, a1, z0, z1, hole=None):
        if hole is None:
            mk(a0, a1, z0, z1)
            return
        h0, h1, hz0, hz1 = hole
        if a0 < h0:
            mk(a0, h0, z0, z1)
        if h1 < a1:
            mk(h1, a1, z0, z1)
        if z0 < hz0 - 0.001:
            mk(max(a0, h0), min(a1, h1), z0, hz0)
        if hz1 < z1 - 0.001:
            mk(max(a0, h0), min(a1, h1), hz1, z1)

    def face_x(colour, x0_, x1_):
        return lambda a0, a1, z0, z1: kit.span(colour, x0_, x1_, a0, a1,
                                               z0, z1, bev=0.002)

    def face_y(colour, y0_, y1_):
        return lambda a0, a1, z0, z1: kit.span(colour, a0, a1, y0_, y1_,
                                               z0, z1, bev=0.002)

    zc = P_CEIL - 0.02
    # West, unbroken. 0.052 and not 0.032 on this and the north face: the
    # inner skin is centred 2 cm in and is 4 cm thick, so the plaster you see
    # is 4 cm inside the nominal room line.
    paint(face_x(YELLOW_W, kx0 + 0.040, kx0 + 0.052), ky0, ky1, P_FL, zc)
    # North, round the window over the run.
    paint(face_y(YELLOW_W, ky1 - 0.052, ky1 - 0.040), kx0, kx1, P_FL, zc,
          hole=(PW_KIT_N[0] - 0.03, PW_KIT_N[1] + 0.03,
                P_FL + PW_KIT_N[2] - 0.03, P_FL + PW_KIT_N[3] + 0.03))
    # South, round the way in from the hall.
    paint(face_y(YELLOW_W, ky0 + 0.002, ky0 + 0.014), kx0, kx1, P_FL, zc,
          hole=(PD_KIT[0] - 0.03, PD_KIT[1] + 0.03, P_FL,
                P_FL + PD_KIT[3] + 0.03))
    # East, round the door on to terrace 7.
    paint(face_x(YELLOW_W, kx1 - 0.014, kx1 - 0.002), ky0, ky1, P_FL, zc,
          hole=(PD_TER7[0] - 0.03, PD_TER7[1] + 0.03, P_FL,
                P_FL + PD_TER7[3] + 0.03))
    hx0, hx1, hy0, hy1 = P_ROOMS["hodnik"]
    # And the terracotta, round the door to soba 4.
    paint(face_x(TERRA_W, hx1 - 0.015, hx1 - 0.003), hy0, hy1, P_FL, zc,
          hole=(PD_S4[0] - 0.03, PD_S4[1] + 0.03, P_FL,
                P_FL + PD_S4[3] + 0.03))

    kuhinja(kit)
    kupaonica(kit)
    boravak(kit)
    soba_dolje(kit)


def terrace_doors(kit, base=F2, hole=None, shutters=True):
    """The 220 opening on to the terrace: two glazed leaves, and folded back
    outside them the louvred shutters that make the room stripey at four.

    The same pair, twice: this is the terrace opening upstairs and it is also
    the front door downstairs, which is the same detail 2.90 m lower and 3.30
    further west. `base` is the floor it stands on, `hole` its opening."""
    a0, a1, z0, z1 = hole if hole is not None else D_TERR
    at = Y0 + EXT / 2
    reveal(kit, "x", at, a0, a1, base + z0, base + z1, EXT, colour=WALL,
           floor=base)
    for p, q in ((a0, (a0 + a1) / 2), ((a0 + a1) / 2, a1)):
        f = 0.055
        kit.span(PINE, p, p + f, at - 0.035, at + 0.035, base, base + z1,
                 bev=0.004)
        kit.span(PINE, q - f, q, at - 0.035, at + 0.035, base, base + z1,
                 bev=0.004)
        kit.span(PINE, p, q, at - 0.035, at + 0.035, base + z1 - f, base + z1,
                 bev=0.004)
        kit.span(PINE, p, q, at - 0.030, at + 0.030, base + 0.02, base + 0.16,
                 bev=0.004)
        kit.span(GLASS, p + f, q - f, at - 0.007, at + 0.007,
                 base + 0.16, base + z1 - f, bev=0.001)
    kit.span(CHROME, (a0 + a1) / 2 - 0.06, (a0 + a1) / 2 + 0.06,
             at - 0.070, at - 0.030, base + 1.02, base + 1.10, bev=0.004)
    if shutters:
        for p, q in ((a0 - 0.72, a0 - 0.02), (a1 + 0.02, a1 + 0.72)):
            louvred(kit, "x", at - EXT / 2 - 0.10, p, q, base + 0.05,
                    base + z1, open_to=-1)


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

    # The arm used to start 28 cm up the lean, which is 28 cm above nothing:
    # the mast stops at top + 0.30 and the arm began at roughly top + 0.49, so
    # the dish hung in the air over a stub with a hand's width of sky between
    # them. It now starts at the lean origin, where the mast is.
    for name, colour, box in (
            ("starlink_arm", black, (0, 0, 0.28, 0.048, 0.048, 0.56)),
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
#  the yard behind, and terrace 7 in it                                        #
# --------------------------------------------------------------------------- #
# Terrace 7 is a loggia, and the loggia is where this house is actually used:
# the table is out there from June to September, the back door is the door
# everybody comes in by, and the floor is not the 33 cm terrazzo of terrace 8.
# It is kamene ploče — irregular flat limestone bedded in mortar — and it runs
# straight out of the loggia into the yard, over one step, without changing.
#
# North of the paving the ground is held up on both sides: board-marked
# concrete on the east, where the switch for the loggia light is, and laid
# rubble on the west. The yard ends at a rendered wall with a black steel gate
# in it, and the same gate again is the one down at the water.

# Paving and walling, and both are darker than they look in a photograph taken
# at noon in August. A limestone slab that has been walked on for forty years
# is a mid grey with a warm cast, not the white it photographs as — and the
# shader here puts the sun back on top of the albedo, so a sampled highlight
# comes out of it as chalk. Judged against the joints: what makes crazy paving
# read as crazy paving is the dark line between the stones, and that line has
# to survive full sun.
FLAG = (0.615, 0.588, 0.532)        # kamene ploče, warm grey limestone
FLAG_J = (0.395, 0.378, 0.345)      # the mortar between them
RUBBLE = (0.575, 0.545, 0.488)
GRAVEL = (0.648, 0.618, 0.560)      # the stony forecourt, tuca off the spit      # the laid stone of the retaining walls
EARTH = (0.470, 0.412, 0.330)       # what the retaining walls are retaining
GATE_BLACK = (0.130, 0.140, 0.150)  # both gates on the plot, satin black
WICKER = (0.505, 0.468, 0.412)      # the grey stacking rattan chairs
TUBE = (0.430, 0.442, 0.452)        # their frames, and the lounger's
STRIPE = ((0.930, 0.938, 0.945), (0.180, 0.430, 0.700),
          (0.430, 0.700, 0.870), (0.070, 0.240, 0.520))

# The yard behind: paving between two retaining walls, and the side passage
# down the east flank that joins it to the front. There is no gate back here.
# The gate is at the front, where you arrive — the back of this plot runs into
# the neighbour's ground and always has.
YD_X0, YD_X1 = -0.30, 4.45
YD_Y0 = Y1 + 0.06
YD_Y1 = 6.45
YD_WALL = 0.45                     # how high the two retaining walls stand
YD_SIDE = 1.80                     # how far south the side passage runs

# The front. The house is a first-row house: the promenade is three and a half
# metres off the lip of terrace 8, and between the two there is a walled
# forecourt with a five-bar gate in it, a flagged path on the front door's own
# axis, a raised bed either side of the path and gravel over the rest.
FY_X0, FY_X1 = -3.55, 3.55
FY_Y1 = TER_Y0 - 0.04              # the lip of terrace 8
FY_Y0 = -9.95                      # the gate line, out on the promenade
FY_Z = GRADE + 0.13                # three proud of the promenade it runs off
FY_PATH = (-2.52, -0.80)           # the flagged path, on the front door
FY_GATE = (-2.25, -1.07)           # and the opening in the end wall, on it too
FY_KERB = 0.14


def flagstones(kit, x0, x1, y0, y1, z, size=0.44, colour=FLAG, joint=FLAG_J,
               thick=0.032, wobble=0.52, inset=0.019):
    """Crazy paving: the corners of a grid are jittered, not the cells.

    Move the cells and you get a grid with gaps in it; move the corners they
    share and every stone stays a stone — four straight edges, no two of them
    the same, each one shared exactly with its neighbour. Which is what a mason
    laying broken slab actually produces, and the reason this reads as stone
    where a 33 cm square reads as tile.

    The boundary rows are pinned to the rectangle, so the paving still has a
    straight edge where it dies into a wall.
    """
    nx = max(1, int(round((x1 - x0) / size)))
    ny = max(1, int(round((y1 - y0) / size)))
    sx, sy = (x1 - x0) / nx, (y1 - y0) / ny
    corner = {}
    for i in range(nx + 1):
        for j in range(ny + 1):
            px, py = x0 + i * sx, y0 + j * sy
            if 0 < i < nx:
                px += (RNG.random() - 0.5) * sx * wobble
            if 0 < j < ny:
                py += (RNG.random() - 0.5) * sy * wobble
            corner[(i, j)] = (px, py)
    kit.span(joint, x0, x1, y0, y1, z - 0.07, z - thick * 0.4, bev=0)
    tones = _shades(colour, n=6, lo=0.82, hi=1.20)
    for i in range(nx):
        for j in range(ny):
            quad = [corner[(i, j)], corner[(i + 1, j)],
                    corner[(i + 1, j + 1)], corner[(i, j + 1)]]
            cx = sum(p[0] for p in quad) / 4.0
            cy = sum(p[1] for p in quad) / 4.0
            poly = []
            for px, py in quad:
                dx, dy = cx - px, cy - py
                d = math.hypot(dx, dy) or 1.0
                poly.append((px + dx / d * inset, py + dy / d * inset))
            bm_prism(kit.bm(tones[RNG.randrange(len(tones))], 0.004), poly,
                     z - thick, z + (RNG.random() - 0.5) * 0.006)


def gravel(kit, x0, x1, y0, y1, z, size=0.72, colour=GRAVEL):
    """Loose stone, which is a floor and not a paving: no joints, no edges you
    can see, only a sheet of it that changes tone every metre or so."""
    nx = max(1, int(round((x1 - x0) / size)))
    ny = max(1, int(round((y1 - y0) / size)))
    sx, sy = (x1 - x0) / nx, (y1 - y0) / ny
    tones = _shades(colour, n=5, lo=0.88, hi=1.12)
    for i in range(nx):
        for j in range(ny):
            kit.span(tones[RNG.randrange(len(tones))],
                     x0 + i * sx, x0 + (i + 1) * sx,
                     y0 + j * sy, y0 + (j + 1) * sy,
                     z - 0.06, z + (RNG.random() - 0.5) * 0.008, bev=0)


def rubble_wall(kit, axis, at, a0, a1, z0, z1, thick=0.30, course=0.17):
    """Limestone off the plot, laid flat and pointed with whatever was going.

    Every retaining wall in this village is this and nothing else. Courses of
    stones of different lengths, with a mortar core behind them so the joints
    do not read through to the sky.
    """
    if axis == "x":
        kit.span(FLAG_J, a0, a1, at - thick * 0.34, at + thick * 0.34,
                 z0, z1, bev=0.01)
    else:
        kit.span(FLAG_J, at - thick * 0.34, at + thick * 0.34, a0, a1,
                 z0, z1, bev=0.01)
    tones = _shades(RUBBLE, n=6, lo=0.78, hi=1.22)
    z = z0
    while z < z1 - 0.02:
        h = min(course * (0.78 + RNG.random() * 0.52), z1 - z)
        a = a0
        while a < a1 - 0.05:
            w = min(0.15 + RNG.random() * 0.30, a1 - a)
            d = thick * (0.88 + RNG.random() * 0.18)
            c = tones[RNG.randrange(len(tones))]
            # Each stone finds its own bed and its own top within the course.
            # Laid to one line top and bottom this is brickwork, and brickwork
            # is the one thing a rubble wall never looks like.
            lo = z + 0.006 + RNG.random() * 0.022
            hi = min(z1, z + h - 0.006 - RNG.random() * 0.030)
            if hi - lo < 0.045:
                a += w
                continue
            if axis == "x":
                kit.span(c, a + 0.012, a + w - 0.012, at - d / 2, at + d / 2,
                         lo, hi, bev=0.016)
            else:
                kit.span(c, at - d / 2, at + d / 2, a + 0.012, a + w - 0.012,
                         lo, hi, bev=0.016)
            a += w
        z += h


def steel_gate(kit, hx, hy, z, yaw, w=1.16, h=1.06, bars=5):
    """The gate: a flat frame with five horizontal bars in it, hung on one
    stile and drawn standing open, because it always is."""
    bm = bmesh.new()
    t = 0.038
    for sx in (t / 2, w - t / 2):
        bm_box(bm, sx, 0, h / 2, t, 0.046, h)
    for i in range(bars):
        bm_box(bm, w / 2, 0, h * (i + 0.42) / bars, w - t * 2, 0.032, 0.026)
    ob = new_object(bm, "gate")
    bevel(ob, 0.005)
    _place(ob, hx, hy, z, yaw)
    kit.adopt(ob, GATE_BLACK)


def patio_table(kit, cx, cy, z, yaw=0.0, w=1.12, d=0.70, h=0.72):
    """The white plastic rectangle with the moulded top. The round one is
    upstairs on terrace 8; this is the one the back of the house eats at."""
    bm = bmesh.new()
    bm_box(bm, 0, 0, h - 0.019, w, d, 0.038)
    # The apron under the lip, which is what makes a moulded top read as
    # moulded rather than as a 4 cm plank on four sticks.
    bm_box(bm, 0, 0, h - 0.068, w - 0.075, d - 0.075, 0.062)
    for sx in (-1, 1):
        for sy in (-1, 1):
            bm_box(bm, sx * (w / 2 - 0.115), sy * (d / 2 - 0.10),
                   (h - 0.11) / 2, 0.046, 0.046, h - 0.11)
        bm_box(bm, sx * (w / 2 - 0.115), 0, 0.115, 0.052, d - 0.20, 0.042)
    ob = new_object(bm, "patiotable")
    bevel(ob, 0.008)
    _place(ob, cx, cy, z, yaw)
    kit.adopt(ob, PLASTIC_W)


def wicker_chair(kit, cx, cy, z, yaw):
    """The grey stacking rattan armchair. Four came with the house.

    The weave is not modelled. At the distance you ever stand from one of these
    what reads is a round-backed shell of one dull grey-brown, higher behind
    than at the arms, on four thin steel legs — so that is what this is, and
    the twelve boxes the shell is made of are the twelve the silhouette needs.
    """
    bm = bmesh.new()
    S, R, T = 0.44, 0.255, 0.055
    bm_box(bm, -0.01, 0, S - 0.025, 0.44, 0.44, 0.050)         # the seat
    seg = 16

    def at(i):
        a = math.radians(44 + 272 * i / seg)                   # 0 is the front
        ca, sa = math.cos(a), math.sin(a)
        return ca, sa, (-0.015 + ca * R * 1.10, sa * R)

    for i in range(seg):
        ca0, sa0, p0 = at(i)
        ca1, sa1, p1 = at(i + 1)
        # A quad footprint per segment, sharing its edges with its neighbours,
        # so the shell is one continuous band. Built as separate boxes it was a
        # ring of loose lumps with daylight between them, which is what a
        # stacking chair looks like from behind if you have taken it apart.
        poly = [(p0[0] + ca0 * T, p0[1] + sa0 * T),
                (p1[0] + ca1 * T, p1[1] + sa1 * T),
                (p1[0] - ca1 * T, p1[1] - sa1 * T),
                (p0[0] - ca0 * T, p0[1] - sa0 * T)]
        # Low at the arms, full height behind: one cosine, not a step.
        cm = math.cos(math.radians(44 + 272 * (i + 0.5) / seg))
        hgt = 0.125 + 0.205 * max(0.0, -cm) ** 0.75
        bm_prism(bm, poly, S + 0.008, S + 0.008 + hgt)
    ob = new_object(bm, "wickershell")
    bevel(ob, 0.010)
    _place(ob, cx, cy, z, yaw)
    kit.adopt(ob, WICKER)

    frame = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            # Splayed, the way a stacking frame is: the feet stand wider than
            # the seat or the chairs would not nest.
            bm_box(frame, sx * 0.185, sy * 0.185, (S - 0.03) / 2,
                   0.026, 0.026, S - 0.03)
        bm_box(frame, sx * 0.185, 0, 0.055, 0.024, 0.37, 0.024)
    ob = new_object(frame, "wickerframe")
    bevel(ob, 0.004)
    _place(ob, cx, cy, z, yaw)
    kit.adopt(ob, TUBE)


def sun_lounger(kit, cx, cy, z, yaw, l=1.86, w=0.58):
    """The folding aluminium lounger with the blue striped sling, back up two
    notches, which is the only way anybody ever leaves one."""
    bed = bmesh.new()
    n = 11
    for i in range(n):
        t = (i + 0.5) / n
        # The last third is the backrest, hinged up about 32 degrees.
        u = max(0.0, (t - 0.62) / 0.38)
        x = -l / 2 + t * l
        lift = u * (l * 0.38) * math.sin(math.radians(32))
        bm_box(bed, x + u * 0.06, 0, 0.345 + lift,
               l / n * 1.20, w, 0.030 + u * 0.004)
    ob = new_object(bed, "lounger_sling")
    bevel(ob, 0.004)
    _place(ob, cx, cy, z, yaw)
    # One object per stripe would be four meshes for a deck chair. The sling is
    # one object in the palest of the four and the bands are drawn on it.
    kit.adopt(ob, STRIPE[0])

    band = bmesh.new()
    for i in range(n):
        t = (i + 0.5) / n
        if i % 3 == 0:
            continue
        u = max(0.0, (t - 0.62) / 0.38)
        x = -l / 2 + t * l
        lift = u * (l * 0.38) * math.sin(math.radians(32))
        bm_box(band, x + u * 0.06, 0, 0.354 + lift,
               l / n * 1.02, w - 0.05, 0.026)
    ob = new_object(band, "lounger_stripe")
    bevel(ob, 0.003)
    kit.adopt(ob, STRIPE[1])
    _place(ob, cx, cy, z, yaw)

    frame = bmesh.new()
    for sy in (-1, 1):
        bm_box(frame, 0.02, sy * (w / 2 + 0.012), 0.330, l * 0.66, 0.026, 0.026)
        for sx in (-1, 1):
            bm_box(frame, sx * l * 0.30, sy * (w / 2 + 0.012), 0.165,
                   0.024, 0.024, 0.330)
    ob = new_object(frame, "lounger_frame")
    bevel(ob, 0.004)
    _place(ob, cx, cy, z, yaw)
    kit.adopt(ob, TUBE)


def bulkhead(kit, cx, cy, z):
    """The oval opal bulkhead over the back door. Every house on this shore has
    one and they all have the same moth in them."""
    kit.span(WHITEGOODS, cx - 0.085, cx + 0.085, cy - 0.058, cy + 0.058,
             z - 0.022, z, bev=0.006)
    bm_ball(kit.bm((0.945, 0.930, 0.880), 0.004), cx, cy, z - 0.022,
            0.105, 0.072, 0.058, rows=4, seg=14, squash_bottom=0.22)


def loggia(kit):
    """Terrace 7 fitted out. Four square metres, and it is the room this house
    is photographed in.

    The table is against the east end rather than in the middle: the way in
    from the yard is the whole north side and the kitchen door is the whole
    west side, so the only place a 112 table can stand without standing in a
    doorway is against the far wall.
    """
    z = P_FL
    patio_table(kit, 2.06, 2.90, z, yaw=0.0)
    # Three chairs, because there are three out there. The fourth is upstairs.
    wicker_chair(kit, 1.72, 3.36, z, yaw=-math.pi / 2 - 0.12)
    wicker_chair(kit, 2.44, 3.36, z, yaw=-math.pi / 2 + 0.10)
    wicker_chair(kit, 2.86, 2.62, z, yaw=math.pi + 0.15)
    # The ashtray, which is on that table in both photographs.
    bm_cylinder(kit.bm(DARKMETAL, 0.004), 2.24, 2.98, z + 0.720, z + 0.744,
                0.058, 0.066, seg=12)
    bulkhead(kit, 0.86, 2.62, P_CEIL - 0.01)


def yard(kit):
    """The paving behind, its two retaining walls, and the side passage."""
    # A slab first and the paving on it. The slab reaches well below grade
    # because what is under it out here is not a floor, it is whatever the
    # terrain does — the same reason the house stands on a 35 cm plinth.
    kit.span(PLINTH, YD_X0 - 0.10, YD_X1 + 0.30, YD_Y0 - 0.10, YD_Y1 + 0.30,
             GRADE - 0.45, GRADE + 0.005, bev=0.02)
    flagstones(kit, YD_X0, YD_X1, YD_Y0, YD_Y1, GRADE + 0.02)
    # The step outside the loggia is already there in `prizemlje` — this is
    # its tread, so the one thing you actually put a foot on is stone and not
    # the render the step is cast in.
    flagstones(kit, PT7_OPEN[0] + 0.10, PT7_OPEN[1] - 0.10, Y1 + 0.06,
               Y1 + 0.42, P_FL - 0.155, size=0.32)

    # ── the side passage ────────────────────────────────────────────────────
    # Down the east flank of the house, between the wall and the neighbour's
    # ground, from the loggia's east opening round the corner into the yard.
    # It is the walk in the photograph: flagstones running past the corner of
    # the house with the concrete wall and the fig on your left.
    kit.span(PLINTH, X1 + 0.02, YD_X1 + 0.30, YD_SIDE - 0.30, YD_Y0 + 0.10,
             GRADE - 0.45, GRADE + 0.005, bev=0.02)
    flagstones(kit, X1 + 0.06, YD_X1, YD_SIDE, YD_Y0, GRADE + 0.02)
    # And its own step down out of the loggia, which stands 30 above it.
    flagstones(kit, X1 + 0.06, X1 + 0.42, PT7_EAST[0] + 0.10,
               PT7_EAST[1] - 0.10, P_FL - 0.155, size=0.32)
    kit.span(PLINTH, X1 + 0.06, X1 + 0.44, PT7_EAST[0] + 0.08,
             PT7_EAST[1] - 0.08, GRADE - 0.15, P_FL - 0.16, bev=0.02)

    # ── the two retaining walls ─────────────────────────────────────────────
    # East, board-marked concrete, holding up the neighbour's ground and the
    # fig that grows out of it. It runs the whole length of the passage now,
    # not just the yard. The switch for the loggia light is on the inside face
    # where you can reach it off the step.
    kit.span(CONCRETE, YD_X1, YD_X1 + 0.20, YD_SIDE - 0.30, YD_Y1,
             GRADE - 0.40, GRADE + YD_WALL, bev=0.015)
    kit.span(EARTH, YD_X1 + 0.20, YD_X1 + 1.70, YD_SIDE - 0.30, YD_Y1,
             GRADE - 0.40, GRADE + YD_WALL - 0.07, bev=0.02)
    kit.span(WHITEGOODS, YD_X1 - 0.014, YD_X1 + 0.002, 4.42, 4.60,
             GRADE + 0.19, GRADE + 0.37, bev=0.005)
    # West, laid rubble, which is what the older half of this plot is walled
    # with. It stands a course higher than the concrete does.
    rubble_wall(kit, "y", YD_X0 - 0.16, YD_Y0 - 0.10, YD_Y1,
                GRADE - 0.30, GRADE + YD_WALL + 0.12, thick=0.32)
    kit.span(EARTH, YD_X0 - 1.80, YD_X0 - 0.30, YD_Y0 - 0.10, YD_Y1,
             GRADE - 0.30, GRADE + YD_WALL + 0.04, bev=0.02)
    # The far end is the neighbour's ground and not a boundary you cross: one
    # low rubble kerb with the bank behind it, and no gate. The gate is at the
    # front of the house, which is where it is in the photographs.
    rubble_wall(kit, "x", YD_Y1 + 0.10, YD_X0 - 0.32, YD_X1 + 0.20,
                GRADE - 0.30, GRADE + 0.52, thick=0.34)
    kit.span(EARTH, YD_X0 - 0.32, YD_X1 + 0.20, YD_Y1 + 0.27, YD_Y1 + 2.10,
             GRADE - 0.30, GRADE + 0.44, bev=0.02)

    # The lounger, folded out on the paving east of the opening, which is the
    # only patch of this yard the sun reaches for any length of time.
    sun_lounger(kit, 3.62, 5.05, GRADE + 0.03, yaw=math.pi / 2 - 0.14)


def front_yard(kit):
    """The forecourt: the path, the two raised beds, the gravel and the gate.

    This is the side you arrive on. The promenade runs past the end of it, the
    gate stands in a rendered wall on that line, and the path goes straight
    from the gate to the front door because the front door is what it is for.
    """
    kit.span(PLINTH, FY_X0 - 0.36, FY_X1 + 0.30, FY_Y0 - 0.30, FY_Y1 + 0.10,
             GRADE - 0.55, FY_Z - 0.05, bev=0.02)
    # Gravel over the whole forecourt first, and the flagged path laid on it.
    # It is the stony ground of the photograph and not a lawn: nothing on this
    # spit has ever been a lawn.
    gravel(kit, FY_X0, FY_X1, FY_Y0, FY_Y1, FY_Z - 0.01)
    flagstones(kit, FY_PATH[0], FY_PATH[1], FY_Y0 + 0.20, FY_Y1, FY_Z,
               size=0.46)

    # ── the two raised beds, kerbed ─────────────────────────────────────────
    # West of the path it runs to the boundary wall; east of it the bed stops
    # short and the rest is gravel, which is where you leave the car.
    for bx0, bx1 in ((FY_X0, FY_PATH[0] - 0.22), (FY_PATH[1] + 0.22, 1.30)):
        for a0, a1, b0, b1 in (
                (bx0, bx1, FY_Y0 + 0.55, FY_Y0 + 0.55 + FY_KERB),
                (bx0, bx1, FY_Y1 - 0.30 - FY_KERB, FY_Y1 - 0.30),
                (bx0, bx0 + FY_KERB, FY_Y0 + 0.55, FY_Y1 - 0.30),
                (bx1 - FY_KERB, bx1, FY_Y0 + 0.55, FY_Y1 - 0.30)):
            kit.span(CONCRETE, a0, a1, b0, b1, FY_Z - 0.20, FY_Z + 0.34,
                     bev=0.012)
        kit.span(EARTH, bx0 + FY_KERB, bx1 - FY_KERB,
                 FY_Y0 + 0.55 + FY_KERB, FY_Y1 - 0.30 - FY_KERB,
                 FY_Z - 0.20, FY_Z + 0.27, bev=0.02)

    # ── the boundary, laid rubble, down the west side ───────────────────────
    rubble_wall(kit, "y", FY_X0 - 0.18, FY_Y0 - 0.10, FY_Y1 + 0.10,
                GRADE - 0.40, FY_Z + 0.62, thick=0.34)
    kit.span(EARTH, FY_X0 - 1.90, FY_X0 - 0.34, FY_Y0 - 0.10, FY_Y1 + 0.10,
             GRADE - 0.40, FY_Z + 0.52, bev=0.02)
    # And a low one down the east side, which is only a kerb against the lane.
    rubble_wall(kit, "y", FY_X1 + 0.18, FY_Y0 - 0.10, FY_Y1 + 0.10,
                GRADE - 0.40, FY_Z + 0.40, thick=0.32)

    # ── the wall at the end, and the gate in it ─────────────────────────────
    for a0, a1 in ((FY_X0 - 0.34, FY_GATE[0]), (FY_GATE[1], FY_X1 + 0.34)):
        kit.span(RENDER, a0, a1, FY_Y0 - 0.20, FY_Y0,
                 GRADE - 0.45, FY_Z + 1.12, bev=0.02)
        kit.span(CONCRETE, a0 - 0.02, a1 + 0.02, FY_Y0 - 0.22, FY_Y0 + 0.02,
                 FY_Z + 1.12, FY_Z + 1.17, bev=0.01)
    # Hung on the west jamb and standing open into the forecourt, at 100
    # degrees, which is where a gate ends up when nobody has shut it since May.
    steel_gate(kit, FY_GATE[0] + 0.03, FY_Y0 - 0.02, FY_Z + 0.08,
               math.pi / 2 + 0.17)


# --------------------------------------------------------------------------- #
#  fit-out                                                                     #
# --------------------------------------------------------------------------- #

def kitchen(kit):
    """Along the south face of the bathroom box: three cupboard doors with the
    sink centred over them, then the free-standing cooker at the east end.

    The sink used to sit hard against the west return, which read as an
    accident rather than a layout — the bowl was crammed into the corner with
    a metre and a half of empty worktop beside it. It is now centred on the
    cabinet run, meaning the part of the run you can actually see, which stops
    where the cooker starts and not at the notional end of the carcass."""
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
    # Centred on the visible cabinetry (run0 to the cooker at run1 - 0.66),
    # not on the carcass, whose last 66 cm is behind the cooker.
    sink_c = (run0 + (run1 - 0.66)) / 2
    bx0, bx1 = sink_c - 0.25, sink_c + 0.25
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
    sx = bx0
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
    _fridge(kit, -0.88, IY0 + 0.02, F2)

    ceiling_light(kit, (x0 + x1) / 2, y1 - 1.00)


# The two door heights, as fractions of the case: a top-freezer is roughly two
# thirds fridge and one third freezer, and this one is measured off the
# photographs at 1.11 and 0.64 in a case 1.86 tall.
FR_W, FR_D, FR_H = 0.62, 0.64, 1.86
FR_DOORS = ((0.045, 1.155), (1.205, 1.845))


def _round_rect(hw, hh, r, per=7):
    """A closed rounded rectangle as (x, y), anticlockwise from the right edge.

    A superellipse is the cheap way to get this and it is the wrong one here: a
    superellipse's corner is elliptical, so on a door 59 wide and 111 tall the
    corners come out taller than they are wide and it reads as a pillow. This
    is a true constant radius, which is what pressed steel actually has.
    """
    r = max(0.0005, min(r, hw - 0.001, hh - 0.001))
    pts = []
    for cx, cy, a0 in ((hw - r, hh - r, 0.0),
                       (-(hw - r), hh - r, math.pi / 2),
                       (-(hw - r), -(hh - r), math.pi),
                       (hw - r, -(hh - r), 3 * math.pi / 2)):
        for i in range(per + 1):
            a = a0 + (math.pi / 2) * i / per
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def _rr_loft(bm, rings, per=7):
    """Skin a stack of rounded rectangles along local Z.

    `rings` is `[(z, hw, hh, r, ox, oy), ...]`. Every ring has the same point
    count, so the strip between two of them is a plain quad grid.
    """
    grid = []
    for z, hw, hh, r, ox, oy in rings:
        grid.append([bm.verts.new((ox + px, oy + py, z))
                     for px, py in _round_rect(hw, hh, r, per)])
    bm.verts.ensure_lookup_table()
    n = len(grid[0])
    for j in range(len(grid) - 1):
        for i in range(n):
            k = (i + 1) % n
            bm.faces.new((grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]))
    bm.faces.new(tuple(reversed(grid[0])))
    bm.faces.new(tuple(grid[-1]))
    return grid


def _fridge(kit, fx, fy, floor):
    """The tall red top-freezer on the terrace wall — five boxes, until now.

    It is the one appliance in this flat that gets looked at from a metre away
    and the one nobody walks past without seeing, so it is worth the triangles.
    A fridge door is not a slab: it is a rounded rectangle in plan and in
    elevation, it is *crowned* — proud at the middle, rolling back to a radius
    all the way round — and the roll is the whole reason a white kitchen has a
    red thing in it that reads as an object rather than a poster. So both doors
    and the case are superelliptical lofts, and everything hung on them (bar
    handles on brackets with daylight behind them, hinge caps, the plinth and
    its grille) is modelled rather than drawn on.

    Both doors are hinged on the −x edge, which is why the handles are on +x:
    the handle is the one thing that tells you which way a door opens, and this
    one has to open into the room and not into the wall.
    """
    W, D, H = FR_W, FR_D, FR_H
    cx, cy = fx + W / 2, fy + D / 2
    front = fy + 0.706                       # the crown of the doors
    back = fy + 0.635                        # where they sit on the case

    # The plinth, set back and dark, so the case reads as standing on feet
    # rather than growing out of the floor — with the condenser grille in the
    # front of it, which is the only vent on a fridge you ever see.
    kit.span(DARKMETAL, fx + 0.035, fx + W - 0.035, fy + 0.08, fy + D - 0.02,
             floor, floor + 0.070, bev=0.004)
    for i in range(5):
        z = floor + 0.014 + i * 0.011
        kit.span((0.30, 0.31, 0.32), fx + 0.09, fx + W - 0.09,
                 fy + 0.075, fy + 0.090, z, z + 0.006, bev=0.001)

    # The case. Four rings: a chamfer off the bottom, the full section, and a
    # chamfer off the top, which is what stops a white box being a white box
    # where it meets the ceiling light.
    _rr_loft(kit.bm(WHITEGOODS, 0.004), [
        (floor + 0.062, W / 2 - 0.016, D / 2 - 0.016, 0.010, cx, cy),
        (floor + 0.084, W / 2, D / 2, 0.026, cx, cy),
        (floor + H - 0.022, W / 2, D / 2, 0.026, cx, cy),
        (floor + H, W / 2 - 0.020, D / 2 - 0.020, 0.008, cx, cy),
    ])

    # The shadow gap between the doors, and the sealed face behind them.
    kit.span(DARKMETAL, fx + 0.010, fx + W - 0.010, fy + D - 0.006, back + 0.004,
             floor + FR_DOORS[0][1], floor + FR_DOORS[1][0], bev=0.003)

    for k, (z0, z1) in enumerate(FR_DOORS):
        z0 += floor
        z1 += floor
        hw, hh, R = 0.295, (z1 - z0) / 2, 0.028
        # Along the depth: flat where it sits on the case, out to the full
        # section, then the roll-over in three steps to a front face 2 cm
        # inside the silhouette. That roll is the whole difference between a
        # door and a painted rectangle.
        grid = _rr_loft(kit.bm(FRIDGE_RED, 0.003), [
            (back, hw - 0.006, hh - 0.006, R - 0.004, 0, 0),
            (back + 0.008, hw, hh, R, 0, 0),
            (front - 0.020, hw, hh, R, 0, 0),
            (front - 0.009, hw - 0.004, hh - 0.004, R - 0.004, 0, 0),
            (front - 0.003, hw - 0.010, hh - 0.010, R - 0.010, 0, 0),
            (front, hw - 0.020, hh - 0.020, R - 0.018, 0, 0),
        ])
        # _rr_loft skins along its own +Z; _rot_x lays that down the world +Y,
        # which is the way this door faces, and turns the ring's second
        # half-width into height.
        _rot_x([v for row in grid for v in row], cx, 0.0, (z0 + z1) / 2)

        # Hinge caps on the −x edge, top and bottom of each leaf.
        for zz in (z0 + 0.035, z1 - 0.035):
            kit.span((0.80, 0.80, 0.79), fx + 0.012, fx + 0.052,
                     back - 0.004, back + 0.030, zz - 0.024, zz + 0.024,
                     bev=0.006)

        # The handle: two brackets and a round bar standing 4 cm off the door.
        # Both sit against the shadow gap — the fridge door's at the top of the
        # leaf, the freezer's at the bottom of it — because that is where the
        # hand goes on a top-freezer and because the pair then reads as a pair.
        hx = fx + 0.545
        h0, h1 = ((z1 - 0.36, z1 - 0.06) if k == 0 else (z0 + 0.06, z0 + 0.36))
        for zz in (h0, h1):
            kit.span(WHITEGOODS, hx - 0.024, hx + 0.024, front - 0.008,
                     front + 0.044, zz - 0.018, zz + 0.018, bev=0.006)
        bm_cylinder(kit.bm(CHROME, 0.003), hx, front + 0.040, h0, h1,
                    0.011, 0.011, seg=12)

    # The badge, high on the freezer door and away from the handle.
    kit.span((0.86, 0.86, 0.85), fx + 0.13, fx + 0.27, front, front + 0.004,
             floor + FR_DOORS[1][1] - 0.105, floor + FR_DOORS[1][1] - 0.079,
             bev=0.002)

    # And the magnets, on the crowned face rather than floating off the old
    # flat one. Kept inside the roll-over, because a magnet on a radius is a
    # magnet lying in mid-air.
    for _ in range(20):
        mx = fx + RNG.uniform(0.075, 0.46)
        mz = floor + RNG.uniform(0.58, 1.76)
        if floor + FR_DOORS[0][1] - 0.06 < mz < floor + FR_DOORS[1][0] + 0.02:
            mz += 0.10
        c = RNG.choice([(0.9, 0.85, 0.3), (0.2, 0.4, 0.8), (0.9, 0.9, 0.88),
                        (0.15, 0.55, 0.35), (0.85, 0.5, 0.2)])
        kit.span(c, mx, mx + RNG.uniform(0.035, 0.062), front, front + 0.009,
                 mz, mz + RNG.uniform(0.035, 0.058), bev=0.002)


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


def _wc(kit, bx, ty, floor=F2, cistern="close", face="+x"):
    """A lavatory backed on to the wall at `bx`, centred on `ty`.

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

    `face` is the way the pan projects off its wall: "+x" backs it on a west
    wall with `bx` the wall line and `ty` the centre, "-y" hangs it on a north
    wall with the roles swapped — `bx` the centre and `ty` the wall line. All
    of the geometry is authored forward-and-lateral and mapped."""
    if face == "+x":
        P = lambda f, l: (bx + f, ty + l)
        R = lambda rf, rl: (rf, rl)
    else:
        P = lambda f, l: (bx + l, ty - f)
        R = lambda rf, rl: (rl, rf)

    def SP(colour, f0, f1, l0, l1, z0, z1, bev=0.006):
        xa, ya = P(f0, l0)
        xb, yb = P(f1, l1)
        kit.span(colour, min(xa, xb), max(xa, xb), min(ya, yb), max(ya, yb),
                 z0, z1, bev=bev)

    # How far the pan stands off its wall. The rings below were authored at a
    # 41 cm projection against a 38 cm width, which is very nearly circular in
    # plan — and a real floor-standing pan is 65 to 70 deep against 36 wide.
    # At 41 the thing does not read as a short lavatory, it reads as a normal
    # one with its back half buried in the tiling, which is exactly what it was
    # reported as. Everything forward of the wall on the pan, the seat, the
    # hinges and the spigot is stretched by this. The cistern is not: a cistern
    # really is only 20 deep, and both of these sit on the wall line, so the
    # close-coupled one still lands on the shelf at the back of the pan.
    DEEP = 1.60

    # The pan. Rings are (z, r_fwd, r_lat, fwd), bottom of the foot upward: the
    # waist at 9 cm, the shoulder at 27, the rim at 41 — then two rings that
    # roll over the lip, and four that descend into the bowl. The last is the
    # water.
    rings = [(floor + z, *R(rf * DEEP, rl), *P(f * DEEP, 0))
             for z, rf, rl, f in
             ((0.020, 0.114, 0.102, 0.150),
              (0.090, 0.100, 0.089, 0.160),
              (0.180, 0.110, 0.096, 0.176),
              (0.270, 0.136, 0.122, 0.196),
              (0.345, 0.172, 0.152, 0.212),
              (0.396, 0.192, 0.168, 0.218),
              (0.412, 0.190, 0.166, 0.218),
              (0.404, 0.170, 0.146, 0.216),
              (0.340, 0.152, 0.130, 0.212),
              (0.270, 0.112, 0.094, 0.202),
              (0.215, 0.062, 0.052, 0.192))]
    bm_loft(kit.bm(PORCELAIN, 0.004), rings, seg=20, power=2.5)

    # The spigot into the wall behind it. The pan's foot stands 5 cm clear of
    # the tiling, as a floor-standing pan does, and the soil pipe crosses that
    # gap — which is the detail that tells you the thing is plumbed in and not
    # just set down on the floor.
    #
    # It stops at +0.08 forward and 22 cm up, and both numbers matter. The
    # bowl's cavity at that height starts at +0.13, and this box used to run to
    # +0.16 and 28 cm — so it came up through the bottom of the pan and sat
    # in the water as a grey slab, which is what you actually saw when you
    # looked into the lavatory.
    SP(PORCELAIN, -0.01, 0.08 * DEEP, -0.062, 0.062, floor + 0.06,
       floor + 0.22, bev=0.02)

    # The water. The bowl is a cavity facing up and inward, so every face in it
    # is turned away from the window and reads as one grey hole; the trap being
    # full is both true and the thing that tells your eye how deep it goes.
    bm_cylinder(kit.bm((0.760, 0.830, 0.870), 0.002), *P(0.192 * DEEP, 0),
                floor + 0.222, floor + 0.228, 0.056, 0.056, seg=18)

    # The seat, down, and the two hinge lugs at the back of it.
    _oval_band(kit.bm(PORCELAIN, 0.004), floor + 0.414, floor + 0.446,
               (*R(0.188 * DEEP, 0.164), *P(0.216 * DEEP, 0)),
               (*R(0.126 * DEEP, 0.104), *P(0.238 * DEEP, 0)),
               seg=24, power=2.6)
    for dl in (-0.058, 0.058):
        SP(CHROME, 0.030 * DEEP, 0.070 * DEEP, dl - 0.016, dl + 0.016,
           floor + 0.412, floor + 0.452, bev=0.006)

    # The cistern. Two of them, because the two floors of this house are two
    # different decades: the flat upstairs has a close-coupled suite, and the
    # one below it has a pan with a cream cistern hung high on the wall and a
    # chromed flush pipe dropping to it, which is what the photographs show and
    # what everybody who has ever rented a Dalmatian ground floor remembers.
    if cistern != "close":
        # 1.80 to the top of the tank — a proper high-level cistern. It was
        # capped at 1.30 when the pan stood under the west window, whose sill
        # is at 1.40; on the north wall there is nothing over it but tile.
        top = floor + 1.80
        SP((0.930, 0.910, 0.860), -0.01, 0.185, -0.185, 0.185,
           top - 0.36, top, bev=0.02)
        SP((0.960, 0.945, 0.905), -0.01, 0.195, -0.195, 0.195,
           top, top + 0.035, bev=0.012)
        # The pipe, and the lever and chain hanging off the near end.
        # Down to the back of the pan, not to the lever: the pipe used to stop
        # at 78, which is the height of the lever bracket and a third of a
        # metre of clear air above the seat.
        bm_cylinder(kit.bm(CHROME, 0.002), *P(0.085, 0),
                    floor + 0.44, top - 0.36, 0.017, 0.017, seg=10)
        SP(CHROME, 0.055, 0.115, -0.024, 0.024, floor + 0.74, floor + 0.80,
           bev=0.006)
        SP(DARKMETAL, 0.16, 0.20, 0.15, 0.17, top - 0.34, top - 0.30,
           bev=0.004)
        bm_cylinder(kit.bm(CHROME, 0.002), *P(0.18, 0.16),
                    top - 0.62, top - 0.30, 0.005, 0.005, seg=6)
        SP(PORCELAIN, 0.155, 0.205, 0.135, 0.185, top - 0.70, top - 0.62,
           bev=0.02)
        return

    # The cistern, close-coupled: it sits down on the shelf at the back of the
    # pan rather than hanging on the wall.
    #
    # This is the third shape it has had and the first one that works, so the
    # reasoning is worth keeping.
    #
    # It was a box. Then it was a box with the corners taken off, which was no
    # better, and the reason turns out to have nothing to do with its colour.
    # Measured off the render, the front rendered at (130,143,157) against an
    # albedo of (247,248,249) — 53 per cent, and *bluer* than the paint. That
    # is sky and no sun: a half-metre vertical plane facing east, in a room
    # whose one window is in the wall it stands against, next to counter tops
    # that face up and blow out to white. Nothing about the value was wrong.
    # The face was wrong. Any facet at that angle takes that grey, so adding
    # facets at that angle — which is all the rounding did — adds nothing.
    #
    # So the top rolls over instead. The last three rings pull in hard, and
    # across those five centimetres the surface sweeps from vertical to
    # horizontal and runs from that same grey up to white. One highlight, and
    # the thing reads as glazed ceramic rather than as a grey panel. The front
    # also leans back 3.5 cm over its height, which is both what a moulded
    # cistern does and a few more degrees of sky.
    #
    # And it is smaller: 40 cm on the shelf rather than 46, and 36 wide rather
    # than 37.6, which is a real close-coupled cistern and a third less of the
    # offending face.
    #
    # There is no separate lid. The rolled top ends in a flat 12 by 27 panel,
    # which is the lid, and the buttons go in it.
    rings = []
    for z, rf, rl in ((0.400, 0.100, 0.181), (0.445, 0.102, 0.183),
                      (0.570, 0.099, 0.181), (0.690, 0.094, 0.177),
                      (0.748, 0.088, 0.171), (0.782, 0.076, 0.158),
                      (0.800, 0.058, 0.136)):
        # The back stays on the wall line as the section narrows, so everything
        # the taper takes off comes off the front.
        rings.append((floor + z, *R(rf, rl), *P(rf, 0)))
    bm_loft(kit.bm(PORCELAIN, 0.005), rings, seg=28, power=2.6)
    # Dual flush, in the flat of the top. The big one is the far one.
    for dl, r in ((-0.046, 0.029), (0.044, 0.021)):
        bm_cylinder(kit.bm(CHROME, 0.003), *P(0.058, dl),
                    floor + 0.798, floor + 0.818, r, r * 0.94, seg=12)


def _bojler(kit, cx, cy, zb, d=0.450, h=1.000):
    """The electric water heater over the washing machine, and its fittings.

    Off the owner's own photograph of the corner, scaled against the tiling
    rather than against the eye: the wall behind it is set out in 17.5 cm tiles,
    the machine's front face is a known 60 cm, and the two together fix the
    camera at 3.0 m and the scale on the tank's own axis plane. That gives
    47 x 101 for the jacket. A domestic Croatian vertical bojler is 45 to 47
    across and 95 to 102 tall for the 80 to 100 litre sizes, so the photograph
    and the catalogue agree to within the measurement, and this takes the middle
    of the agreement: 45 x 100, which is the 80.

    It hangs with its crown 6 cm under the ceiling, which looks wrong written
    down and is what the photograph shows — the room it is really in is taller
    than this one's 2.40, and an installer hangs a tank as high as the pipework
    will go. The consequence is the thing that makes the corner: 11 cm between
    the bottom of the tank and the rim of the pot standing on the machine.

    Cheap on purpose. The jacket is one loft of ten rings, because a bojler is a
    cylinder with a dished bottom and a torispherical top and nothing else, and
    everything that makes it read as a bojler rather than as a white drum is in
    the last 3 per cent: the thermometer, the fittings hanging under the dish,
    and the flexi dropping into the corner.
    """
    r = d / 2
    # z is written as a height above the jacket's own underside, so the whole
    # tank moves by moving `zb` and nothing has to be re-added.
    rings = [(0.000, 0.086), (0.026, 0.148), (0.058, 0.202),
             # The rolled rim under the jacket is the widest point on the tank
             # and it is what the dish hangs off.
             (0.084, r + 0.005), (0.112, r),
             (0.886, r), (0.942, r - 0.007), (0.980, r - 0.035),
             (0.996, r - 0.113), (1.000, r - 0.170)]
    bm_loft(kit.bm(ENAMEL_W, 0.004),
            [(zb + h * z, rr, rr, cx, cy) for z, rr in rings], seg=20)

    # The rating plate low on the body, and the maker's badge beside it. Both
    # are white stickers with printing on them and the printing is four pixels
    # at any distance a player can stand: what goes in is the blue mark, which
    # is the only part of either that carries at this size, and no lettering —
    # inventing a legible brand is inventing a fact the footage cannot support.
    zp = zb + 0.150
    kit.span((0.935, 0.935, 0.925), cx - 0.040, cx + 0.040,
             cy + r - 0.020, cy + r + 0.0025, zp - 0.015, zp + 0.015, bev=0.002)
    kit.span((0.160, 0.380, 0.620), cx - 0.023, cx + 0.023,
             cy + r + 0.0025, cy + r + 0.0055, zp - 0.006, zp + 0.006, bev=0.002)

    # The thermometer, 20 cm under the crown, and it is the whole difference
    # between a bojler and a white drum. Ø 9.5, which is large for a gauge and
    # is what the photograph measures — these tanks carry a dial you are meant
    # to read from the doorway. The needle is radial and its angle is not a
    # reading: at this size it is three pixels of red, and a temperature is a
    # number the picture cannot be made to say.
    zd = zb + h - 0.200
    _lay_disc(kit, CHROME, cx, cy + r - 0.0035, zd, 0.048, 0.017, seg=16)
    _lay_disc(kit, (0.920, 0.920, 0.905), cx, cy + r - 0.0065, zd, 0.039, 0.014,
              seg=16)
    _lay_disc(kit, DARKMETAL, cx, cy + r + 0.0015, zd, 0.008, 0.012, seg=10)
    kit.span((0.640, 0.100, 0.090), cx + 0.004, cx + 0.032,
             cy + r + 0.001, cy + r + 0.005, zd - 0.003, zd + 0.003, bev=0.001)

    # Under the dish: the red label on the flange cover, the outlet tee, the
    # safety valve's discharge into the wall, and the flexi.
    kit.span((0.620, 0.090, 0.080), cx - 0.020, cx + 0.020,
             cy + 0.166, cy + 0.180, zb + 0.038, zb + 0.052, bev=0.002)
    bm_cylinder(kit.bm(CHROME, 0.003), cx + 0.070, cy + 0.005,
                zb - 0.080, zb + 0.010, 0.014, 0.014, seg=8)
    arm = bm_cylinder(kit.bm(CHROME, 0.003), 0, 0, -0.038, 0.038,
                      0.011, 0.011, seg=8)
    _rot_y(arm, cx + 0.108, cy + 0.005, zb - 0.045)
    # The valve pipe goes into the wall through a plastic collar, because a pipe
    # that stops in mid-air two centimetres off the tiling is worse than no pipe.
    bm_cylinder(kit.bm(STEEL, 0.003), cx + 0.090, cy - 0.040,
                zb - 0.220, zb + 0.020, 0.012, 0.012, seg=8)
    leg = bm_cylinder(kit.bm(STEEL, 0.003), 0, 0, -0.095, 0.095,
                      0.012, 0.012, seg=8)
    _rot_x(leg, cx + 0.090, cy - 0.135, zb - 0.215)
    _lay_disc(kit, (0.900, 0.900, 0.890), cx + 0.090, cy - 0.235, zb - 0.215,
              0.042, 0.030, seg=14)

    # And the flexi, which leaves the tee, swings clear of the pot on the
    # machine and drops down the 13 cm gap between the machine's end and the
    # tiling, into the wall near the floor. In the photograph it loops the other
    # way, across the front of the pot and down the far side; it cannot here,
    # because this machine is 42 deep against that one's 60 and the loop would
    # have to pass through the pot to do it. Same hose, same job, the side of
    # the machine the room actually leaves room for.
    _tube(kit.bm(STEEL, 0.003),
          [(cx + dx, cy + dy, zb + dz) for dx, dy, dz in (
              (0.070, -0.005, -0.060), (0.080, 0.015, -0.140),
              (0.100, 0.050, -0.220), (0.130, 0.070, -0.310),
              (0.160, 0.050, -0.380), (0.180, -0.010, -0.430),
              (0.190, -0.090, -0.500), (0.190, -0.150, -0.740),
              (0.185, -0.210, -1.040), (0.180, -0.270, -1.110))],
          0.013, seg=8)


def bathroom(kit):
    """Two forty-five by one sixty-five, a box in the north-west corner of the
    big room. Door in the east wall hard against the north side, window high in
    the west wall at the far end: shower in the south-west corner, WC against
    the west wall under the window, basin round the corner in the middle of the
    north wall, washing machine on the south wall by the door.

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

    # Basin on the north wall, mirror over it. It used to be jammed into the
    # far corner beside the WC with the washing machine sitting between it and
    # the door — so you came in, squeezed past a white box, and washed your
    # hands in the corner. The two have swapped: the basin takes the middle of
    # the north wall, which is where you can stand in front of it.
    vx = x0 + 1.30
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

    # The washing machine, against the south wall at the door end — the
    # opposite wall, and the one run in this room with nothing else on it. It
    # used to stand on the north wall between the basin and the door, which put
    # a white box in the only place you could have stood to use the basin.
    # Every `y1 - d` below now reads `y0 + d`: the same distance, measured off
    # the other face.
    wx = x1 - 0.72
    kit.span(WHITEGOODS, wx, wx + 0.58, y0 + 0.02, y0 + 0.44, F2 + 0.02,
             F2 + 0.86, bev=0.008)
    kit.span((0.82, 0.82, 0.81), wx + 0.02, wx + 0.56, y0 + 0.44, y0 + 0.46,
             F2 + 0.74, F2 + 0.84, bev=0.004)
    kit.span((0.86, 0.87, 0.88), wx - 0.02, wx + 0.60, y0, y0 + 0.47,
             F2 + 0.86, F2 + 0.90, bev=0.008)
    # The door, the dial and the display. This was a blank white box until now,
    # and a blank white box is a cupboard: everything else in this corner is
    # arranged around a washing machine, and the object the arrangement is
    # about had none of the three things that say what it is. It is a front
    # loader in the photograph — 39 cm door ring, black glass, a round program
    # dial to the right of the machine's centre and a display to the left of
    # it. No lettering on any of them.
    _lay_disc(kit, (0.86, 0.87, 0.88), wx + 0.29, y0 + 0.440, F2 + 0.44,
              0.195, 0.075, seg=20)
    _lay_disc(kit, BLACK, wx + 0.29, y0 + 0.448, F2 + 0.44, 0.148, 0.070,
              seg=20)
    _lay_disc(kit, DARKMETAL, wx + 0.40, y0 + 0.462, F2 + 0.79, 0.028, 0.030,
              seg=12)
    kit.span(BLACK, wx + 0.08, wx + 0.24, y0 + 0.452, y0 + 0.468,
             F2 + 0.775, F2 + 0.805, bev=0.003)

    # The towel rail has come off the top of the machine and gone on the wall
    # beside it, which is where a towel rail is. It stood on the machine's back
    # edge with both towels hanging down the tiling behind it — and the top of
    # this machine is not free space, it is where the lonac lives. Same rail,
    # same two towels, 42 cm of the south wall between the shower and the
    # machine, and now you can reach them without leaning over a hot lid.
    tx = x0 + 1.21
    for c in (tx - 0.19, tx + 0.19):
        leg = bm_cylinder(kit.bm(CHROME, 0.002), 0, 0, -0.045, 0.045,
                          0.010, 0.010, seg=8)
        _rot_x(leg, c, y0 + 0.050, F2 + 1.10)
    kit.span(CHROME, tx - 0.21, tx + 0.21, y0 + 0.085, y0 + 0.115,
             F2 + 1.085, F2 + 1.115, bev=0.004)
    kit.span((0.42, 0.72, 0.46), tx - 0.16, tx + 0.02, y0 + 0.070, y0 + 0.135,
             F2 + 0.70, F2 + 1.10, bev=0.006)
    kit.span((0.90, 0.90, 0.88), tx + 0.04, tx + 0.18, y0 + 0.070, y0 + 0.135,
             F2 + 0.74, F2 + 1.10, bev=0.006)

    # And what the room is actually for, which is the corner in the owner's
    # photograph: the bojler over the machine, the enamel lonac on it, and the
    # bucket on the floor beside it.
    #
    # The tank hangs on the south wall hard into the east corner, 3 cm off the
    # tiling behind it and 4 cm off the tiling beside it — a cylinder is tangent
    # to a wall rather than parallel with one, so rule 5 has nothing to bite on
    # here, and there are no brackets because there are none to see: the plate
    # it hangs on is behind the tank.
    _bojler(kit, x1 - 0.28, y0 + 0.27, F2 + 1.34)

    # The pot is the third object in the photograph and the most characterful
    # thing in the frame — a 35-litre enamel lonac parked on the washing
    # machine, which is the detail that makes the room somebody's rather than a
    # bathroom. Ø 34, 33 tall, measured off the machine beside it. Rolled black
    # rim, speckled blue-grey inside, two D-handles: no lid, and the grey-blue
    # disc across the top of it in the picture is the *inside*, which is why
    # this had to be built as a vessel and not as a drum.
    px, py = wx + 0.29, y0 + 0.22
    _vessel(kit, px, py, F2 + 0.90, F2 + 1.23, 0.170, 0.185, 0.010,
            ENAMEL_POT, POT_IN, rim_c=DARKMETAL, seg=18)
    for s in (1, -1):
        ox = px + s * 0.178
        for z0h, z1h in ((F2 + 1.150, F2 + 1.166), (F2 + 1.058, F2 + 1.074)):
            kit.span(ENAMEL_POT_H, ox, ox + s * 0.052,
                     py - 0.012, py + 0.012, z0h, z1h, bev=0.003)
        kit.span(ENAMEL_POT_H, ox + s * 0.040, ox + s * 0.052,
                 py - 0.012, py + 0.012, F2 + 1.058, F2 + 1.166, bev=0.003)

    # The bucket, which is the other thing he asked for. It went in once before
    # and came out again, and the reason was placement and not the bucket: it
    # stood exactly where the lavatory is and read as a teal drum sat in the
    # pan. Here it is where it is in the picture — on the floor at the end of
    # the machine, tucked to the wall, in the one stretch of cobalt you can see
    # from the door. Ten litres: 29 across the mouth, 24 across the base, 28
    # tall, which is the standard size and is not measured, because the one in
    # the photograph is tipped over a mop head and cannot be.
    _vessel(kit, x0 + 1.45, y0 + 0.19, F2 + 0.02, F2 + 0.30, 0.120, 0.145,
            0.012, BUCKET_B, BUCKET_IN, seg=16)
    for s in (1, -1):
        kit.span(BUCKET_B, x0 + 1.45 + s * 0.128, x0 + 1.45 + s * 0.156,
                 y0 + 0.165, y0 + 0.215, F2 + 0.235, F2 + 0.290, bev=0.003)

    ceiling_light(kit, (x0 + x1) / 2, (y0 + y1) / 2, dome=True)


def _lay_disc(kit, colour, cx, cy, cz, r, t, seg=18, bev=0.003):
    """A disc facing -Y — a washing-machine door, a wheel, a clock."""
    vs = bm_cylinder(kit.bm(colour, bev), 0, 0, -t / 2, t / 2, r, r, seg=seg)
    for v in vs:
        x, y, z = v.co
        v.co = (cx + x, cy + z, cz + y)


def _vessel(kit, cx, cy, z0, z1, r0, r1, wall, out_c, in_c,
            rim_c=None, floor=None, seg=16, bev=0.003):
    """An open vessel — a bucket, a cooking pot — with an inside you can see.

    Rule 8, and the reason this needs a builder of its own: a truncated cone
    with a cap on it is a drum, and the only view anybody will ever have of a
    bucket standing on a bathroom floor is from standing height, looking down
    into it. So the inner wall and the bottom are not detail, they are the
    object. The house's shader is `FrontSide`, so an inward-facing surface that
    is not *wound* inward is not there at all.

    Which is also why these three shells are adopted rather than dropped in the
    colour buckets: `Kit.parts()` runs `recalc_face_normals` over each bucket,
    and told to work out which way is out of an open cone it turns the inner
    wall inside out again. Same escape hatch the modifier objects use, and the
    bevel is put on by hand because that is what the bucket would have done.

    The inside is a shade darker than the outside on purpose. Ambient in this
    shader is hemispheric on the normal alone, with no bounce: the inner wall of
    a bucket is vertical and so is the outer, so identical albedo renders
    identically and the vessel comes back as a solid blue lump with a ring drawn
    on it. Three per cent of value is the whole difference between a bucket and
    a bollard.
    """
    fz = z0 + (wall * 1.6 if floor is None else floor)
    at = lambda z: r0 + (r1 - r0) * (z - z0) / (z1 - z0)

    def ring(bm, z, r):
        return [bm.verts.new((cx + math.cos(TAU * i / seg) * r,
                              cy + math.sin(TAU * i / seg) * r, z))
                for i in range(seg)]

    def adopt(bm, colour, name):
        ob = new_object(bm, "%s_%s" % (kit.name, name), recalc=False)
        if bev > 0:
            bevel(ob, bev, segments=1, angle=35.0)
        kit.adopt(ob, colour)

    # Outside, and the base it stands on. Rings run anticlockwise seen from
    # above, so `bm_prism`'s winding is the winding here: a side quad taken
    # bottom-i, bottom-j, top-j, top-i faces out, and a cap taken reversed
    # faces down.
    bo = bmesh.new()
    ob, ot = ring(bo, z0, r0), ring(bo, z1, r1)
    for i in range(seg):
        j = (i + 1) % seg
        bo.faces.new((ob[i], ob[j], ot[j], ot[i]))
    bo.faces.new(tuple(reversed(ob)))
    adopt(bo, out_c, "vessel_out")

    # The rim, which is its own colour on the pot: an enamel lonac has a rolled
    # black edge and it is the line that says the thing is open.
    br = bmesh.new()
    ro, ri = ring(br, z1, r1), ring(br, z1, r1 - wall)
    for i in range(seg):
        j = (i + 1) % seg
        br.faces.new((ro[i], ro[j], ri[j], ri[i]))
    adopt(br, rim_c or out_c, "vessel_rim")

    # And the inside: the same cone wound the other way, and a bottom.
    bi = bmesh.new()
    it, ib = ring(bi, z1, r1 - wall), ring(bi, fz, at(fz) - wall)
    for i in range(seg):
        j = (i + 1) % seg
        bi.faces.new((it[i], it[j], ib[j], ib[i]))
    bi.faces.new(tuple(ib))
    adopt(bi, in_c, "vessel_in")


def _tube(bm, pts, r, seg=8):
    """Sweep a round section along a polyline — a hose, a flex, a cable.

    `bm_cylinder` builds along Z and cannot be tilted, and the two rotations
    this file already has lay one down along X or along Y. The flexi off the
    bottom of a bojler is none of those: it leaves the fitting downwards, swings
    forward off the machine, and drops into the corner. Framing is a cross
    product against whichever axis the run is least parallel to, which would
    twist a textured tube along its length and cannot be seen on a round one.
    """
    rings = []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        d = [b[k] - a[k] for k in range(3)]
        n = math.sqrt(sum(v * v for v in d)) or 1.0
        d = [v / n for v in d]
        ref = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (1.0, 0.0, 0.0)
        u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2],
             d[0] * ref[1] - d[1] * ref[0]]
        n = math.sqrt(sum(v * v for v in u)) or 1.0
        u = [v / n for v in u]
        v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2],
             d[0] * u[1] - d[1] * u[0]]
        rings.append([bm.verts.new(tuple(
            p[k] + (math.cos(TAU * j / seg) * u[k]
                    + math.sin(TAU * j / seg) * v[k]) * r for k in range(3)))
            for j in range(seg)])
    bm.verts.ensure_lookup_table()
    for i in range(len(rings) - 1):
        for j in range(seg):
            k = (j + 1) % seg
            bm.faces.new((rings[i][j], rings[i][k],
                          rings[i + 1][k], rings[i + 1][j]))
    bm.faces.new(tuple(rings[0]))
    bm.faces.new(tuple(reversed(rings[-1])))


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
FISH_RAY = (0.09, 0.34, 0.56)
FISH_NUM = (0.95, 0.53, 0.47)
FISH_EYE = (0.97, 0.97, 0.95)
FISH_PUPIL = (0.06, 0.09, 0.14)


def _bez(p0, p1, p2, u):
    """One point on a quadratic Bézier. The fish is drawn in these."""
    v = 1.0 - u
    return (v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0],
            v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1])


def _curve(p0, p1, p2, n):
    return [_bez(p0, p1, p2, i / float(n)) for i in range(n + 1)]


def _strip(bm, left, right, yf, yb):
    """A ribbon solid: one welded surface, its back, and rails round the edge.

    The first version of the new fins emitted one extruded quad per rib, which
    is what `_plate` does and what the smile has always done — and at nine ribs
    a fin came out corrugated, every rib a separate box with its own bevelled
    edges, like a venetian blind. So the whole ribbon is one shell: the ribs
    share their vertices, the bevel modifier sees a 6° crease between them and
    leaves it alone, and only the outline of the fin gets a chamfer.

    `left` and `right` are matched point lists; where they meet — at the tip of
    every fin on this animal — the quad degenerates and is emitted as a
    triangle rather than refused. `yf` and `yb` are per-point depths, because
    the thing this is laid on is a dome and a constant depth sinks into it.

    Winding is not reasoned about: the shell is closed, so bmesh is asked to
    work the normals out afterwards.
    """
    n = len(left)
    faces = []
    fl, fr, bl, br = [], [], [], []
    for i in range(n):
        same = (abs(left[i][0] - right[i][0]) < 1e-6
                and abs(left[i][1] - right[i][1]) < 1e-6)
        fl.append(bm.verts.new((left[i][0], yf[i], left[i][1])))
        bl.append(bm.verts.new((left[i][0], yb[i], left[i][1])))
        fr.append(fl[-1] if same
                  else bm.verts.new((right[i][0], yf[i], right[i][1])))
        br.append(bl[-1] if same
                  else bm.verts.new((right[i][0], yb[i], right[i][1])))
    bm.verts.ensure_lookup_table()

    def face(*vs):
        out = []
        for v in vs:
            if v not in out:
                out.append(v)
        if len(out) >= 3:
            try:
                faces.append(bm.faces.new(out))
            except ValueError:
                pass

    for i in range(n - 1):
        face(fl[i], fr[i], fr[i + 1], fl[i + 1])
        face(bl[i], br[i], br[i + 1], bl[i + 1])
        face(fl[i], bl[i], bl[i + 1], fl[i + 1])
        face(fr[i], br[i], br[i + 1], fr[i + 1])
    face(fl[0], fr[0], br[0], bl[0])
    face(fl[-1], fr[-1], br[-1], bl[-1])
    if faces:
        bmesh.ops.recalc_face_normals(bm, faces=faces)


def _lens(bm, poly, y_back, y_face, dome, rings=5):
    """A silhouette carved rather than cut: a shallow dome on the front of it.

    The fish used to be five flat plates of ply and it read as five flat plates
    of ply — a sticker on a wall, with one bevelled rim to catch the light and
    nothing else on it at all. This is the same silhouette with a paraboloid
    over the front, so the body has a highlight that moves when you move and
    the paint on it has somewhere to sit.

    Paraboloid rather than a hemisphere on purpose: the slope has to go to zero
    at the rim, or the dome meets the side wall at a crease and the bevel
    modifier turns the crease into a ring of facets — which is the artefact the
    dome exists to get rid of.

    The rings are scaled toward the centroid, so this wants a convex `poly`.
    """
    cx = sum(p[0] for p in poly) / len(poly)
    cz = sum(p[1] for p in poly) / len(poly)
    n = len(poly)
    area = sum(poly[i][0] * poly[(i + 1) % n][1]
               - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    if area < 0:
        poly = list(reversed(poly))

    shells = []
    for k in range(rings):
        s = 1.0 - k / float(rings)
        y = y_face - dome * (1.0 - s * s)
        shells.append([bm.verts.new((cx + (x - cx) * s, y, cz + (z - cz) * s))
                       for x, z in poly])
    apex = bm.verts.new((cx, y_face - dome, cz))
    back = [bm.verts.new((x, y_back, z)) for x, z in poly]
    bm.verts.ensure_lookup_table()

    faces = []
    for k in range(rings - 1):
        lo, hi = shells[k], shells[k + 1]
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
    last = shells[-1]
    for i in range(n):
        faces.append(bm.faces.new((last[i], last[(i + 1) % n], apex)))
    rim = shells[0]
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((rim[i], back[i], back[j], rim[j])))
    faces.append(bm.faces.new(tuple(back)))
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def fish_clock(kit, cx, cz, wall, r=CLOCK_R):
    """The fish.

    A cut and painted ply fish with a quartz movement through the middle of it,
    pale blue with darker blue fins and stripes, coral numbers and one round eye
    with a white highlight in it. Its hands are hung at runtime — see the
    `clock` block in the sidecar. It hangs on the spine wall
    between the two bedroom doors and it is, by a distance, the most-photographed
    object in the flat.

    `r` is the body's semi-major axis, so the whole fish including its tail is
    about 3.3 r long — 0.24 m at the default, which is a wall clock and not a
    decoration.

    It was five flat convex plates, and at 24 cm on a wall you walk past that is
    a fish-shaped sticker: a thirty-sided body whose facets you can count, two
    triangles for fins and two for a tail. What is here now is the same drawing
    with the flatness taken out of it — a domed body and head in one piece, so
    there is no seam across the gill and there is a highlight that moves; fins
    and tail built as welded ribbons off a pair of Bézier edges, so they curve
    and sweep the way a fin does; and the paint — stripes, gill, smile — laid
    *on* the dome rather than into it, point by point, which is the only way a
    decal stays put on a curved surface. About 3,000 triangles for the animal,
    against 300, on the one object in this house anybody looks at twice.
    """
    face = wall - 0.016            # the front of the ply, into the room
    dome = 0.085 * r              # how far the middle of it stands proud

    # The outline of the body and head as one piece. Built first because every
    # decal on the fish has to ask it how far out the dome is underneath.
    #
    # An ellipse with the −x side drawn out into a snout. It used to be an
    # ellipse *and* a snout triangle, two plates butted at x = −0.80, and the
    # butt joint ran straight down the cheek — a seam across the face of the
    # one object in the house that has a face.
    #
    # The exponent is the whole argument. At 2.2 the stretch reaches halfway
    # back along the body and the animal comes out a paper dart; at 3.4 it is a
    # nose on a round head, which is what is drawn on the one on the wall.
    body = []
    for i in range(72):
        a = TAU * i / 72.0
        x, z = math.cos(a), 0.86 * math.sin(a)
        n = max(0.0, -x) ** 3.4
        body.append((x - 0.60 * n, z * (1.0 - 0.30 * n)))
    bcx = sum(p[0] for p in body) / len(body)
    bcz = sum(p[1] for p in body) / len(body)

    def lift(px, pz):
        """The dome's height above `face` at a point on the body, r units in.

        Asked of the outline rather than of an ellipse, because `_lens` builds
        its rings by scaling *that* toward its own centroid — and the two
        disagree by more than the paint is thick. The first version used the
        plain ellipse and the whole smile came out buried under the nose: at
        x = −1.2 the ellipse says there is no body there at all and the stroke
        was laid flat on `face`, a millimetre inside the snout it is drawn on.

        The boundary is found by shooting the ray centroid→point at the
        outline, so `s` is exactly the ring parameter `_lens` used.
        """
        dx, dz = px - bcx, pz - bcz
        if abs(dx) < 1e-9 and abs(dz) < 1e-9:
            return dome
        tb = None
        for i in range(len(body)):
            ax, az = body[i]
            ex, ez = body[(i + 1) % len(body)][0] - ax, \
                body[(i + 1) % len(body)][1] - az
            den = dx * ez - dz * ex
            if abs(den) < 1e-12:
                continue
            t = ((ax - bcx) * ez - (az - bcz) * ex) / den
            u = ((ax - bcx) * dz - (az - bcz) * dx) / den
            if t > 1e-9 and -1e-9 <= u <= 1.0 + 1e-9 and (tb is None or t < tb):
                tb = t
        if not tb:
            return 0.0
        sv = min(1.0, 1.0 / tb)
        return dome * (1.0 - sv * sv)

    def W(poly):
        return [(cx + px * r, cz + pz * r) for px, pz in poly]

    def rails(pts, w0, w1):
        """Two edges either side of a centreline, mitred at the joints.

        The offset uses the mean of the two segment directions at each point
        rather than one of them, which is what keeps a bend from opening a
        notch on its outside — the old smile ran every segment past both ends
        to hide exactly that.
        """
        n = len(pts)
        left, right = [], []
        for i, (px, pz) in enumerate(pts):
            ax, az = pts[max(0, i - 1)]
            bx, bz = pts[min(n - 1, i + 1)]
            dx, dz = bx - ax, bz - az
            L = math.hypot(dx, dz) or 1.0
            nx, nz = -dz / L, dx / L
            w = w0 + (w1 - w0) * (i / float(n - 1))
            left.append((px + nx * w, pz + nz * w))
            right.append((px - nx * w, pz - nz * w))
        return left, right

    def stroke(pts, w0, w1, col, bev=0.002, sink=0.0014, into=0.0035,
               flat=None):
        """A painted line: one welded ribbon, riding the surface under it."""
        left, right = rails(pts, w0, w1)
        yf, yb = [], []
        for px, pz in pts:
            y = flat if flat is not None else face - lift(px, pz)
            yf.append(y - sink)
            yb.append(y + into)
        _strip(kit.bm(col, bev), W(left), W(right), yf, yb)

    # ── fins and tail ─────────────────────────────────────────────────────────
    # A hair deeper than the body, so the body reads as sitting on top of them
    # the way the paint does.
    fin_face = face + 0.004
    RIB = 10

    def blade(a0, a1, a2, b0, b1, b2, rays=()):
        """One fin: a leading edge, a trailing edge, and optional ray lines."""
        A = _curve(a0, a1, a2, RIB)
        B = _curve(b0, b1, b2, RIB)
        _strip(kit.bm(FISH_FIN, 0.003), W(A), W(B),
               [fin_face] * len(A), [wall] * len(A))
        for t, top in rays:
            n = max(2, int(RIB * top))
            pts = [((1 - t) * A[i][0] + t * B[i][0],
                    (1 - t) * A[i][1] + t * B[i][1]) for i in range(n + 1)]
            stroke(pts, 0.030, 0.014, FISH_RAY, bev=0.0012,
                   sink=0.0012, into=0.002, flat=fin_face)

    # Dorsal, swept back off the shoulder.
    blade((-0.34, 0.70), (-0.30, 1.16), (0.04, 1.46),
          (0.44, 0.68), (0.54, 1.08), (0.04, 1.46),
          rays=((0.32, 0.72), (0.60, 0.80)))
    # Anal, the same fin smaller and upside down.
    blade((-0.34, -0.70), (-0.32, -1.04), (-0.06, -1.32),
          (0.30, -0.72), (0.36, -1.04), (-0.06, -1.32),
          rays=((0.34, 0.70),))

    # The tail in three: the peduncle that carries it off the body, then the
    # two lobes of the fan. Two lobes alone leave a wedge of bare wall between
    # the body and the fork, which reads as a fish that has come apart.
    _plate(kit, FISH_FIN, W([(0.55, 0.38), (1.06, 0.19), (1.30, 0.15),
                             (1.30, -0.15), (1.06, -0.19), (0.55, -0.38)]),
           fin_face, wall)
    blade((1.16, 0.13), (1.34, 0.62), (1.86, 0.98),
          (1.60, 0.02), (1.75, 0.44), (1.86, 0.98),
          rays=((0.44, 0.86),))
    blade((1.16, -0.13), (1.34, -0.62), (1.86, -0.98),
          (1.60, 0.02), (1.75, -0.44), (1.86, -0.98),
          rays=((0.44, 0.86),))

    # ── the body and the head, one piece ──────────────────────────────────────
    _lens(kit.bm(FISH_BODY, 0.005), W(body), wall, face, dome)

    # The smile.
    #
    # This was a triangular notch at the tip of the snout, which is a mouth and
    # is not a smile, and on the one on the wall the smile is most of the point:
    # it is a cute clock rather than a fish-shaped clock because of one drawn
    # line. It starts at the tip, runs back and down under the eye and hooks up
    # at the far end, so the concave side faces the sky.
    stroke([(-1.50, -0.02), (-1.34, -0.16), (-1.16, -0.26), (-0.97, -0.29),
            (-0.80, -0.26), (-0.68, -0.17)], 0.075, 0.026, FISH_FIN)
    # There were two more lines on the head for a while and both are gone. A
    # gill, which is what the old butt joint between the snout plate and the
    # body used to imply — drawn as a stroke it is a straight dark line from
    # under the eye to the belly, and at 24 cm that is not a gill, it is a
    # crack in the ply. And a pectoral fin on the flank, which is honest fish
    # anatomy and which put a pale outlined blob across the four o'clock
    # marker. The animal on the wall has neither, and the smile is the only
    # line the head needs.

    # Four stripes, each a tapered crescent leaning back the way they do on the
    # real one. Clipped to the belly rather than to a fixed |x|: every sample is
    # pulled inside the ellipse it is painted on, so a stripe ends where the
    # fish does instead of floating on the wall beside it.
    for k in range(4):
        x0 = -0.30 + k * 0.33
        pts = []
        for i in range(9):
            u = i / 8.0
            px = x0 + 0.28 * u + 0.09 * math.sin(math.pi * u)
            pz = 0.64 - 1.28 * u
            zm = 0.86 * math.sqrt(max(0.0, 1.0 - min(1.0, px * px))) * 0.92
            pts.append((px, max(-zm, min(zm, pz))))
        stroke(pts, 0.040, 0.016, FISH_FIN)

    # The eye. A white, a pupil and the catch-light in it, each a little proud
    # of the last and all three lifted on to the dome, so the eye sits on the
    # cheek instead of in it. There was a fourth, a dark ring round the white,
    # and it disappeared: 3 mm of ring under a 3 mm bevel is all chamfer, which
    # rendered as a bright wire hoop round the eye rather than as an outline.
    ex, ez = -0.60, 0.34
    ey = face - lift(ex, ez)
    for ox, oz, rad, col, up, thick, seg, bev in (
            (0.0, 0.0, 0.235, FISH_EYE, 0.005, 0.010, 30, 0.0015),
            (0.0, 0.0, 0.125, FISH_PUPIL, 0.009, 0.008, 24, 0.0010),
            (-0.055, 0.055, 0.045, FISH_EYE, 0.012, 0.006, 14, 0.0006)):
        _lay_disc(kit, col, cx + (ex + ox) * r, ey - up, cz + (ez + oz) * r,
                  rad * r, thick, seg=seg, bev=bev)

    # Twelve coral numbers on a 0.62 r circle, about the movement rather than
    # about the body: the spindle is forward of centre because the tail is
    # behind it, and the numbers go round the spindle. Each is pushed out to
    # its own point on the dome — a ring of markers set at one flat depth has
    # the ones at three and nine standing off the paint and the one at twelve
    # half swallowed.
    mx, mz = cx + 0.12 * r, cz
    for h in range(12):
        a = TAU * (h / 12.0)
        w = (0.014 if h % 3 == 0 else 0.011) * (r / 0.178)
        px = mx + math.sin(a) * 0.62 * r
        pz = mz + math.cos(a) * 0.62 * r
        y = face - lift((px - cx) / r, (pz - cz) / r)
        kit.span(FISH_NUM, px - w, px + w, y - 0.0075, y + 0.0005,
                 pz - w * 1.25, pz + w * 1.25, bev=0.002)

    # The hands are not baked. They used to be, at ten past ten, which is how
    # every clock in every photograph of a clock is set — and a clock stopped at
    # ten past ten in a room you are walking around is a clock that has stopped.
    # They are three meshes built at runtime off the wall clock, second hand
    # included, from the spindle written into the sidecar below. All that is
    # left here is the boss they turn on.
    #
    # And the boss is 0.115 r, not the 16 mm it was. That number was drawn when
    # the fish was 51 cm across; at 24 cm it was a 32 mm black disc on an 87 mm
    # dial, which swallowed the whole of the hour hand and most of the minute —
    # the hands were never short, they were buried. See src/44-vikendica.js.
    _lay_disc(kit, BLACK, mx, face - lift(0.12, 0) - 0.012, mz,
              0.115 * r, 0.010, seg=24)


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
    """Soba 4, 7.69 m², bed head to the north wall. No room in this flat has
    two windows.

    It used to run east-west with its head under the west window, which put the
    only opening in the room directly over the pillows: you lay with the
    shutter at your ear and the light across your face. Turned a quarter clock-
    wise it heads the north wall instead, the window falls beside the bed where
    a window belongs, and the walk from the door up the west side is clear."""
    x0, x1, y0, y1 = ROOMS["soba4"]
    bed(kit, x0 + 0.76, y1 - 1.05, yaw=-math.pi / 2, w=1.40, l=1.98)
    kit.span(WALNUT, x1 - 0.46, x1 - 0.06, y1 - 0.52, y1 - 0.12, F2, F2 + 0.52,
             bev=0.006)
    # The single wardrobe stands on the party wall to soba 3 and not on the
    # spine, which is where it was: the spine here is 95 cm long and the door
    # takes 85 of it, so anything against it is standing in the doorway. On the
    # east wall it is clear of the door, clear of the bed and clear of the
    # sliding leaf, which parks west along the spine face.
    kit.span(WALNUT, x1 - 0.58, x1 - 0.02, y0 + 0.22, y0 + 0.80, F2, F2 + 1.90,
             bev=0.008)
    for c in (y0 + 0.36, y0 + 0.66):
        kit.span(BEECH, x1 - 0.60, x1 - 0.56, c, c + 0.024, F2 + 1.00,
                 F2 + 1.14, bev=0.004)
    kit.span(LINEN, x0 + 0.30, x0 + 0.66, y0 + 0.30, y0 + 0.70, F2 + 0.44,
             F2 + 0.58, bev=0.02)
    ceiling_light(kit, (x0 + x1) / 2, (y0 + y1) / 2, dome=True)


# ------------------------------------------------------------------ furniture --

def sofa(kit, cx, cy, yaw, length, colour, throw=None, depth=0.86, floor=F2):
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
    _place(ob, cx, cy, floor, yaw)
    kit.adopt(ob, colour)
    if throw:
        bm = bmesh.new()
        bm_box(bm, 0, 0.03, h + 0.075, length - 0.05, d - 0.06, 0.08)
        bm_box(bm, 0, -d / 2 + 0.12, 0.62, length - 0.05, 0.13, 0.44)
        ob = new_object(bm, "throw")
        bevel(ob, 0.05, segments=2)
        _place(ob, cx, cy, floor, yaw)
        kit.adopt(ob, throw)
    # Cushions along the back — the tapestry ones with the tiger on them.
    for i in range(3):
        t = (i - 1) * (length / 3.2)
        bm = bmesh.new()
        bm_box(bm, t, -d / 2 + 0.26, 0.62, 0.38, 0.16, 0.36)
        ob = new_object(bm, "cushion")
        bevel(ob, 0.06, segments=2)
        _place(ob, cx, cy, floor, yaw + RNG.uniform(-0.1, 0.1))
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
    # There were two more rectangles along here, a blue landscape one and a
    # white portrait one, and they were exactly what the sunset was: coloured
    # rectangles on a wall standing in for pictures nobody could see. They are
    # the two floor plans now — the drawings this whole model was measured off
    # — and they are drawn at runtime from the plan sidecar rather than baked,
    # because a picture of a plan that cannot be read is another rectangle.
    # See `planSheet` in src/44-vikendica.js.
    # There was a beech shelf here with three sea-urchin shells on it. It sat
    # directly over the bathroom door, so from the big room you were looking
    # through a doorway at a plank with three grey balls on it and no reason
    # for either — the shells needed the sunset beside them to be a shelf of
    # holiday things, and the sunset came down. Both gone.
    #
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

    # Two lists, because the two storeys are two sets of walls at two heights
    # and a blocker that does not know which floor it is on fences off the
    # other one. The runtime bands them by height.
    blockers, blockersP = [], []

    def solid(out, x0, x1, y0, y1):
        if abs(x1 - x0) > 0.02 and abs(y1 - y0) > 0.02:
            out.append(T(x0, x1, y0, y1))

    def band(out, axis, at, thick, a0, a1, gaps):
        cuts = [a0]
        for g in sorted(gaps, key=lambda h: h[0]):
            cuts += [g[0], g[1]]
        cuts.append(a1)
        for i in range(0, len(cuts) - 1, 2):
            if axis == "x":
                solid(out, cuts[i], cuts[i + 1], at - thick / 2, at + thick / 2)
            else:
                solid(out, at - thick / 2, at + thick / 2, cuts[i], cuts[i + 1])

    band(blockers, "x", Y0 + EXT / 2, EXT, X0, X1, [D_TERR])
    band(blockers, "x", Y1 - EXT / 2, EXT, NX0, X1, [])
    band(blockers, "y", X0 + EXT / 2, EXT, Y0, BY1, [])
    band(blockers, "y", NX0 + EXT / 2, EXT, BY0, Y1, [])
    band(blockers, "y", X1 - EXT / 2, EXT, Y0, Y1, [D_ENTRY])
    band(blockers, "x", BY1 - EXT / 2, EXT, X0, NX0 + EXT, [])
    band(blockers, "x", SPINE, INT * 2, NIX0, IX1, [D_S4, D_S3])
    band(blockers, "x", SPINE, INT * 2, IX0, NIX0, [])
    band(blockers, "y", W_MID, INT * 2, BY1, IY1, [])
    band(blockers, "y", BATH_E, INT, BATH_S, BY0, [D_BATH])
    band(blockers, "x", BATH_S, INT, IX0, BATH_E, [])

    band(blockersP, "x", Y0 + EXT / 2, EXT, X0, X1, [PD_TERR])
    band(blockersP, "x", Y1 - EXT / 2, EXT, NX0, X1, [PT7_OPEN])
    band(blockersP, "y", X0 + EXT / 2, EXT, Y0, BY1, [])
    band(blockersP, "y", NX0 + EXT / 2, EXT, BY0, Y1, [])
    band(blockersP, "y", X1 - EXT / 2, EXT, Y0, Y1, [PT7_EAST])
    band(blockersP, "x", BY1 - EXT / 2, EXT, X0, NX0 + EXT, [])
    band(blockersP, "x", P_CROSS, EXT, IX0, IX1, [PD_HALL])
    band(blockersP, "y", P_SPINE, INT, IY0, P_CROSS, [PD_S3])
    band(blockersP, "y", P_SPINE, INT, P_CROSS, P_KIT_S, [PD_S4])
    band(blockersP, "y", P_SPINE_N, EXT, P_TER_S, IY1, [PD_TER7])
    band(blockersP, "y", P_BATH_E, INT, P_CROSS, P_KIT_S, [PD_BATH])
    band(blockersP, "x", P_KIT_S, PW_KIT, NIX0, P_SPINE_N - EXT / 2, [PD_KIT])
    band(blockersP, "x", P_TER_S, EXT, P_SPINE_N - EXT / 2, IX1, [])

    # And the yard behind, which is at grade and belongs to neither storey: the
    # two retaining walls and the wall the gate is in. A 45 cm wall you can
    # walk through is worse than no wall, and these are the only things out
    # there tall enough to stop anybody.
    blockersY = []
    solid(blockersY, YD_X1, YD_X1 + 0.20, YD_SIDE - 0.30, YD_Y1)
    solid(blockersY, YD_X0 - 0.32, YD_X0, YD_Y0 - 0.10, YD_Y1)
    solid(blockersY, YD_X0 - 0.32, YD_X1 + 0.20, YD_Y1 - 0.07, YD_Y1 + 0.27)
    solid(blockersY, FY_X0 - 0.35, FY_X0 - 0.01, FY_Y0 - 0.10, FY_Y1 + 0.10)
    solid(blockersY, FY_X1 + 0.01, FY_X1 + 0.35, FY_Y0 - 0.10, FY_Y1 + 0.10)
    solid(blockersY, FY_X0 - 0.34, FY_GATE[0], FY_Y0 - 0.20, FY_Y0)
    solid(blockersY, FY_GATE[1], FY_X1 + 0.34, FY_Y0 - 0.20, FY_Y0)

    rooms = {k: T(*v) for k, v in ROOMS.items()}
    rooms["terrace"] = T(X0, X1, TER_Y0, TER_Y1)
    roomsP = {k: T(*v) for k, v in P_ROOMS.items()}
    roomsP["terrace"] = T(X0, X1, TER_Y0, TER_Y1)

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
        # The storey below: its own floor level, its own rooms and its own
        # walls, in the same axes and off the same origin.
        "floorP": P_FL, "clearP": round(P_CEIL - P_FL, 3), "terP": P_TER,
        "roomsP": roomsP,
        "blockersP": blockersP,
        "blockersY": blockersY,
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
            # Downstairs. `prizemlje` is the middle of the living room, `ulaz`
            # is outside the front door on terrace 8.
            "prizemlje": [-1.4, P_FL, round(-(-2.0), 2)],
            "ulaz": [round((PD_TERR[0] + PD_TERR[1]) / 2, 2), P_TER,
                     round(-(Y0 - 0.90), 2)],
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
            # And the sanitary ware, for the same kind of reason: it is the one
            # white in the house that has to hold up as white on a vertical
            # face in a room the sun never reaches. Split out so the runtime
            # can give it the bounce this shader does not have. See the note on
            # `wareMat` in src/44-vikendica.js.
            ("ware", PORCELAIN, "the sanitary ware, drawn brighter"),
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
