"""Build the Canadair CL-415 in Blender and bake it for the game (candidate B).

    blender --background --python tools/blender/aircraft_b.py

Writes the rigged .fr3d and four preview renders into the scratchpad; nothing
here touches build/payload, because the lead serialises integration.

The aeroplane is airframe 811 of the protupožarna eskadrila at Zemunik, read off
refs/sibenik-canadair-CL-415.png and refs/canadair-flying.jpg rather than out of
memory. It is drawn four times over — the player and three wingmen — but it is
also stood next to on foot on the apron and chased from thirty metres, so this
model is built to be looked at closely: control surfaces separated by real hinge
gaps, an undercarriage with oleos and scissor links and hubs, intake lips,
exhaust stubs, aerials, wipers, door outlines, panel breaks. Detail here is
objects and not texture, because the blob bakes one colour per object and the
runtime draws the whole model with a single material.

The one thing that must not come back is the old model's floating tail. Fin,
dorsal fillet, tailplane pedestal and root fairings are built here as one
continuous structure whose root follows the tailcone deck down as the hull falls
away aft, so from underneath on the apron the tail is visibly attached.

Axes are Blender's: +X starboard, +Y forward (the nose is +Y), +Z up. The
exporter maps (bx, by, bz) -> three(bx, bz, -by), which is why every hinge in
the plane.parts contract falls out of a rotation about a Blender axis.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Vector  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import (  # noqa: E402
    TAU, bevel, bm_ball, bm_box, export_rig, new_object, reset_scene,
)

SCRATCH = Path("/tmp/claude-1000/-home-unk1911-flamme-retarde"
               "/1567337a-ee20-40bd-a61c-ec2c7dcf6218/scratchpad")
OUT = SCRATCH / "canadair_b.fr3d.gz"
PREVIEW = str(SCRATCH / "cand_b")


def rgb(h):
    return ((h >> 16 & 255) / 255.0, (h >> 8 & 255) / 255.0, (h & 255) / 255.0)


# The livery, sampled off the photographs and corrected for haze. Everything
# yellow on a Canadair is the same yellow; the planing bottom is maroon and not
# white, and the spinners are grey and not red.
YELLOW = rgb(0xF2C013)
YELLOW_DK = rgb(0xD2A410)           # panel breaks and shaded recesses
MAROON = rgb(0x7E1A20)
RED = rgb(0xCE2027)
WHITE = rgb(0xE8E6DC)
BLUE = rgb(0x1E4F8C)
GREEN = rgb(0x2FA84A)
BLACK = rgb(0x121316)
SPINNER = rgb(0xC9CDD2)
GLASS = rgb(0x18242F)
DARK = rgb(0x24262A)                # door outlines, wheel bays, grilles
GREY = rgb(0x70757A)                # aerials, struts, small castings
STEEL = rgb(0xB6BBC1)               # oleo sliders and the polished bits
HUB = rgb(0x8D9298)
TYRE = rgb(0x17181A)
SOOT = rgb(0x4B443C)
LENS = rgb(0xD8DCE0)

SEG_HULL = 18                       # points over the topsides arc
SEG_BOT = 10                        # points across the planing bottom
SEG_FOIL = 9                        # chordwise samples per aerofoil surface


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else (hi if v > hi else v)


def lerp(a, b, t):
    return a + (b - a) * t


def ramp(table, y):
    """Piecewise-linear lookup over [(y, value), ...] given in ascending y."""
    if y <= table[0][0]:
        return table[0][1]
    for (ya, va), (yb, vb) in zip(table, table[1:]):
        if y <= yb:
            return lerp(va, vb, (y - ya) / (yb - ya))
    return table[-1][1]


# --------------------------------------------------------------------------- #
#  modelling helpers                                                           #
# --------------------------------------------------------------------------- #
# Everything is skinned from explicit rings of 3-D points rather than from
# frmesh's along-Z lofts, because an aeroplane is a stack of sections taken
# along three different axes and half of them are neither round nor centred.

def _face(bm, verts):
    """Make a face, quietly collapsing the degenerate ones. Lofting between a
    pointed stem and a full section produces slivers by construction, and
    dropping them here is cheaper than special-casing every caller."""
    out = []
    for v in verts:
        if not out or (v.co - out[-1].co).length > 1e-5:
            out.append(v)
    while len(out) > 2 and (out[0].co - out[-1].co).length <= 1e-5:
        out.pop()
    if len(out) >= 3:
        bm.faces.new(out)


def skin(bm, rings, closed=True, cap0=False, cap1=False):
    """Skin a stack of equal-length rings of (x, y, z)."""
    grid = [[bm.verts.new(p) for p in r] for r in rings]
    bm.verts.ensure_lookup_table()
    n = len(rings[0])
    for j in range(len(grid) - 1):
        for i in range(n if closed else n - 1):
            k = (i + 1) % n
            _face(bm, (grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]))
    if cap0:
        _face(bm, list(reversed(grid[0])))
    if cap1:
        _face(bm, list(grid[-1]))
    return grid


def tube(bm, p0, p1, r0, r1, seg=10, caps=True):
    """A round tube between two arbitrary points — struts, oleos, aerial masts."""
    n = (Vector(p1) - Vector(p0)).normalized()
    up = Vector((0.0, 0.0, 1.0)) if abs(n.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    u = n.cross(up).normalized()
    v = n.cross(u)
    rings = []
    for p, r in ((p0, r0), (p1, r1)):
        ring = []
        for i in range(seg):
            a = TAU * i / seg
            q = Vector(p) + u * (math.cos(a) * r) + v * (math.sin(a) * r)
            ring.append((q.x, q.y, q.z))
        rings.append(ring)
    return skin(bm, rings, cap0=caps, cap1=caps)


def naca(xi, t):
    """Half-thickness of a symmetric NACA 00tt section at chord fraction xi,
    with the trailing-edge coefficient closed so the section meets at a point."""
    xi = clamp(xi)
    return 5.0 * t * (0.2969 * math.sqrt(xi) - 0.1260 * xi - 0.3516 * xi * xi
                      + 0.2843 * xi ** 3 - 0.1036 * xi ** 4)


def cosine(i, n):
    """Cosine spacing: samples bunched at both ends, where a section curves."""
    return 0.5 * (1.0 - math.cos(math.pi * i / n))


def super_ring(cx, cz, y, rx, rz, seg, power=2.4):
    """A closed superelliptical ring in the XZ plane at a station y."""
    e = 2.0 / power
    out = []
    for i in range(seg):
        a = TAU * i / seg
        c, s = math.cos(a), math.sin(a)
        out.append((cx + math.copysign(abs(c) ** e, c) * rx, y,
                    cz + math.copysign(abs(s) ** e, s) * rz))
    return out


# --------------------------------------------------------------------------- #
#  the hull                                                                    #
# --------------------------------------------------------------------------- #
# Stations from the agreed specification. half_beam is measured at the chine,
# which is the maximum beam at every station; the step is a doubled station.
#            y      w     crown   chine    keel
STATIONS = [
    (9.90, 0.10, 1.30, 1.02, 0.98),        # stem head
    (9.60, 0.34, 1.52, 0.96, 0.62),
    (9.20, 0.58, 1.72, 0.90, 0.28),
    (8.60, 0.88, 1.98, 0.80, -0.06),
    (7.80, 1.12, 2.16, 0.62, -0.40),
    (6.80, 1.31, 2.30, 0.38, -0.68),
    (5.60, 1.43, 2.39, 0.12, -0.88),
    (4.20, 1.49, 2.43, -0.12, -1.02),
    (2.60, 1.52, 2.45, -0.30, -1.11),
    (1.00, 1.52, 2.45, -0.40, -1.15),
    (-0.60, 1.52, 2.45, -0.45, -1.16),     # deepest keel
    (-1.15, 1.51, 2.45, -0.46, -1.16),     # STEP, forebody face
    (-1.15, 1.48, 2.45, -0.46, -0.74),     # STEP, afterbody face
    (-2.20, 1.46, 2.44, -0.42, -0.62),
    (-3.20, 1.41, 2.41, -0.34, -0.46),
    (-4.20, 1.34, 2.37, -0.24, -0.28),
    (-5.20, 1.22, 2.32, -0.10, -0.10),     # sternpost: chine meets keel
    (-6.20, 1.06, 2.24, 0.16, 0.16),
    (-7.20, 0.86, 2.13, 0.50, 0.50),
    (-8.20, 0.58, 2.00, 0.92, 0.92),
    (-9.20, 0.14, 1.76, 1.42, 1.42),       # tailcone end
]
I_STEP_F, I_STEP_A, I_STERN = 11, 12, 16

STEP_Y = -1.15
STEP_VEE = 0.30                     # the step apex is this far aft on the keel
STEP_RAKE = 0.09                    # the riser leans aft 12 deg over 0.42 m


def _round(y):
    """How far a station has stopped being a boat: nought at the sternpost, one
    by y=-7.2. Aft of the planing bottom the section is a plain rounded oval,
    and the table's flat two-metre bottom carried to the tail reads as a slab."""
    return clamp((-5.20 - y) / 2.0)


def _split(w, chine, keel, rnd):
    """The z at which the topsides meet the bottom — the chine, until there is
    no chine left, after which it is the shoulder of the oval."""
    return max(chine, keel + rnd * 0.32 * w)


def upper_ring(y, w, crown, split, seg=SEG_HULL):
    """Superelliptical topsides, n=2.6: near-vertical sides with a touch of
    tumblehome and a well-rounded crown. At z=+1.20 amidships the half-beam is
    still 1.48 of 1.52 — it is a bus with wings, not a tube."""
    h = crown - split
    e = 2.0 / 2.6
    out = []
    for i in range(seg + 1):
        a = math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        out.append((math.copysign(abs(c) ** e, c) * w, y, split + abs(s) ** e * h))
    return out


def lower_ring(y, w, split, keel, power, seg=SEG_BOT):
    """Two flat panels from chine to keel forward — power 1.0 is a straight vee
    — relaxing into the rounded oval of the tailcone aft."""
    d = split - keel
    e = 2.0 / power
    out = []
    for i in range(seg + 1):
        a = math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        out.append((math.copysign(abs(c) ** e, c) * w, y, split - abs(s) ** e * d))
    return out


# A monotone copy of the table for looking a section up at an arbitrary y. The
# two step rows are separated by a centimetre so the lookup stays single-valued.
_LOOK = []
for _i, _s in enumerate(STATIONS):
    _dy = 0.005 if _i == I_STEP_F else (-0.005 if _i == I_STEP_A else 0.0)
    _LOOK.append((_s[0] + _dy,) + _s[1:])
_LOOK.reverse()


def station_at(y):
    """(w, crown, split, keel, power) interpolated between table rows."""
    y = clamp(y, _LOOK[0][0], _LOOK[-1][0])
    j = 0
    while j < len(_LOOK) - 2 and _LOOK[j + 1][0] < y:
        j += 1
    a, b = _LOOK[j], _LOOK[j + 1]
    t = 0.0 if b[0] == a[0] else (y - a[0]) / (b[0] - a[0])
    w, crown, chine, keel = (lerp(a[k], b[k], t) for k in range(1, 5))
    rnd = _round(y)
    return w, crown, _split(w, chine, keel, rnd), keel, 1.0 + 1.6 * rnd


def crown_at(y):
    return station_at(y)[1]


def chine_at(y):
    return station_at(y)[2]


def skin_x(y, z):
    """Half-beam of the hull skin at a point on it. Nought at the crown and at
    the keel, which is what makes max() the right way to hand a marking over
    from the hull to the fin as the tricolour sweeps up the tail."""
    w, crown, split, keel, power = station_at(y)
    if z >= split:
        h = crown - split
        if h <= 1e-4:
            return 0.0
        t = clamp((z - split) / h)
        return w * (1.0 - t ** 2.6) ** (1.0 / 2.6)
    d = split - keel
    if d <= 1e-4:
        return 0.0
    t = clamp((split - z) / d)
    return w * (1.0 - t ** power) ** (1.0 / power)


def bottom_z(y, x):
    """z of the planing bottom at a given beam — the inverse of skin_x below the
    chine, wanted by the water doors, the scoops and the ventral aerials."""
    w, _crown, split, keel, power = station_at(y)
    t = clamp(abs(x) / w)
    return split - (split - keel) * (1.0 - t ** power) ** (1.0 / power)


# The flight-deck roof. The station table crowns at 2.45 amidships and has
# fallen to 2.25 by the windscreen, but the windscreen top rail is at 2.40 and
# the roof lights lie above that — so there is a low fairing over the cockpit,
# and without it the glazing floats and the flight deck is 0.3 m wide.

def roof_rise(y):
    return 0.24 * math.sin(math.pi * clamp((y - 5.20) / 3.20)) ** 0.6


def roof_half(y):
    return 0.92 * math.sin(math.pi * clamp((y - 5.20) / 3.20)) ** 0.5


def roof_top(y):
    return crown_at(y) + roof_rise(y)


def roof_x(y, z):
    base = crown_at(y) - 0.12
    top = roof_top(y)
    if top - base <= 1e-3:
        return 0.0
    return roof_half(y) * (1.0 - clamp((z - base) / (top - base)) ** 3.0) ** 0.42


def body_x(y, z):
    """Half-width of whatever skin is outermost at a point: hull or cockpit
    roof. Markings are laid on this rather than on the bare hull."""
    return max(skin_x(y, z), roof_x(y, z))


def hull():
    """The three shells: yellow topsides, maroon planing bottom, yellow tailcone
    belly. They share vertex rings at the chine and at the sternpost, so the
    paint break is the geometric break and the chine stays a hard edge without a
    smoothing group having to be argued about."""
    ups, los = [], []
    for y, w, crown, chine, keel in STATIONS:
        rnd = _round(y)
        split = _split(w, chine, keel, rnd)
        ups.append(upper_ring(y, w, crown, split))
        los.append(lower_ring(y, w, split, keel, 1.0 + 1.6 * rnd))

    # The step is not a transverse cut: in plan it is a shallow vee whose apex
    # on the keel is 0.30 m aft of the step at the chine, and its face rakes aft
    # twelve degrees over the 0.42 m riser.
    for idx, extra in ((I_STEP_F, 0.0), (I_STEP_A, -STEP_RAKE)):
        w = STATIONS[idx][1]
        los[idx] = [(x, STEP_Y - STEP_VEE * (1.0 - abs(x) / w) + extra, z)
                    for x, _y, z in los[idx]]

    bm = bmesh.new()
    skin(bm, [r for i, r in enumerate(ups) if i != I_STEP_F],
         closed=False, cap0=True, cap1=True)
    topsides = new_object(bm, "hull_topsides", smooth=True)

    bm = bmesh.new()
    skin(bm, los[:I_STERN + 1], closed=False, cap0=True, cap1=True)
    planing = new_object(bm, "hull_planing")

    bm = bmesh.new()
    skin(bm, los[I_STERN:], closed=False, cap0=True, cap1=True)
    tailcone = new_object(bm, "hull_tailcone", smooth=True)

    bm = bmesh.new()
    rings = []
    for y in (5.20, 5.90, 6.60, 7.30, 7.90, 8.45):
        base = crown_at(y) - 0.12
        ring = []
        for i in range(13):
            a = math.pi * i / 12
            ring.append((math.cos(a) * roof_half(y), y,
                         base + (roof_top(y) - base) * math.sin(a) ** 0.62))
        rings.append(ring)
    skin(bm, rings, closed=False, cap0=True, cap1=True)
    roof = new_object(bm, "cockpit_roof", smooth=True)

    return topsides, planing, tailcone, roof


def spray_strakes():
    """The flange along the chine, stem to step. In every photograph this is the
    highlight running under the red bow band, and without it the chine has no
    line at all once the sun comes off it."""
    out = []
    for side in (-1, 1):
        bm = bmesh.new()
        rows = []
        for y, w, _crown, chine, _keel in STATIONS[1:I_STEP_F + 1]:
            x = side * w
            rows.append([(x, y, chine + 0.012), (x + side * 0.10, y, chine + 0.004),
                         (x + side * 0.10, y, chine - 0.026), (x, y, chine - 0.014)])
        skin(bm, rows, cap0=True, cap1=True)
        ob = new_object(bm, "strake%d" % side)
        bevel(ob, 0.010, 1)
        out.append((ob, MAROON))
    return out


# --------------------------------------------------------------------------- #
#  markings                                                                    #
# --------------------------------------------------------------------------- #
# A colour break is an object break, so every stripe, digit and shield below is
# a thin prism standing a centimetre or so proud of whatever it is painted on.

def patch(bm, poly, side, xf, out=0.016):
    """A closed (y, z) outline extruded outward from a surface."""
    inner = [(side * xf(y, z), y, z) for y, z in poly]
    outer = [(side * (xf(y, z) + out), y, z) for y, z in poly]
    skin(bm, [inner, outer], cap0=True, cap1=True)


def annulus(bm, outer_poly, inner_poly, side, xf, out=0.016):
    """The same for a marking with a hole in it — a porthole rim, the bowl of an
    8. Four loops skinned cyclically make a closed ribbon of section."""
    def loop(poly, d):
        return [(side * (xf(y, z) + d), y, z) for y, z in poly]
    skin(bm, [loop(outer_poly, 0.0), loop(outer_poly, out),
              loop(inner_poly, out), loop(inner_poly, 0.0),
              loop(outer_poly, 0.0)])


def ellipse(cy, cz, ry, rz, n=20):
    return [(cy + math.cos(TAU * i / n) * ry, cz + math.sin(TAU * i / n) * rz)
            for i in range(n)]


def rect(y0, y1, z0, z1):
    return [(y0, z0), (y1, z0), (y1, z1), (y0, z1)]


CHEAT_Z = [(-99.0, 1.25), (6.20, 1.25), (8.60, 1.10), (9.85, 0.98)]


def cheat_path():
    """The Croatian tricolour, and the single feature that makes the scheme.

    It runs level amidships, drops and converges to a point at the stem over the
    bow, and aft it turns up through a 1.6 m radius, crosses onto the fin and
    carries on at 48 per cent of the local chord to the fin tip. A band that
    stops at the tailcone is the wrong aeroplane.

    Returns [(y, z, taper), ...] from stem to fin tip.
    """
    pts = []
    for i in range(13):
        y = lerp(9.85, 6.20, i / 12.0)
        pts.append((y, ramp(CHEAT_Z, y), clamp((9.85 - y) / 1.85)))
    pts.append((-4.80, 1.25, 1.0))
    # The sweep up onto the fin: a 1.6 m radius leaving the level run
    # horizontally and cut where its tangent matches the fin's 48 per cent chord
    # line, which lands on the fin root within 80 mm of the specified
    # (-6.31, 2.32) without having to bend the arc to get there.
    for i in range(1, 11):
        a = math.radians(67.4) * i / 10.0
        pts.append((-4.80 - 1.6 * math.sin(a), 2.85 - 1.6 * math.cos(a), 1.0))
    for i in range(1, 9):
        t = i / 8.0
        pts.append((lerp(-6.28, -8.58, t), lerp(2.235, 7.77, t), 1.0))
    return pts


def cheatline():
    """Three ribbons a side: red 0.20, white 0.20, blue 0.18, stacked across the
    path rather than in z, so that where the ribbon stands up the fin the bands
    lie fore and aft — red forward — instead of one above another."""
    path = cheat_path()
    normals = []
    for i, (y, z, _t) in enumerate(path):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, len(path) - 1)]
        ty, tz = b[0] - a[0], b[1] - a[1]
        n = math.hypot(ty, tz) or 1.0
        normals.append((-tz / n, ty / n))

    out = []
    for side in (-1, 1):
        for tag, colour, d0, d1 in (("r", RED, 0.00, 0.20),
                                    ("w", WHITE, 0.20, 0.40),
                                    ("b", BLUE, 0.40, 0.58)):
            bm = bmesh.new()
            rows = []
            for (y, z, taper), (ny, nz) in zip(path, normals):
                ya, za = y + ny * d0 * taper, z + nz * d0 * taper
                yb, zb = y + ny * d1 * taper, z + nz * d1 * taper
                xa = max(body_x(ya, za), fin_half(ya, za))
                xb = max(body_x(yb, zb), fin_half(yb, zb))
                rows.append([(side * xa, ya, za), (side * (xa + 0.014), ya, za),
                             (side * (xb + 0.014), yb, zb), (side * xb, yb, zb)])
            skin(bm, rows, cap0=True, cap1=True)
            out.append((new_object(bm, "cheat_%s%d" % (tag, side)), colour))
    return out


# Height of the bow band above the chine. The specification's absolute top-edge
# line falls below the chine by amidships, so the band is drawn the way the
# photographs show it instead: a deep red flash at the bow, tapering aft.
BOW_H = [(4.15, 0.00), (5.20, 0.22), (6.40, 0.40), (7.60, 0.46),
         (8.80, 0.42), (9.55, 0.28), (9.90, 0.10)]


def bow_band():
    """The red band above the chine at the bow, with the scalloped upper edge —
    twenty-two semicircular tabs, which is the row of red arcs visible along the
    chine in every photograph of a Croatian Canadair."""
    out = []
    n, tabs = 132, 22
    for side in (-1, 1):
        bm = bmesh.new()
        rows = []
        for i in range(n + 1):
            t = i / n
            y = lerp(9.85, 4.16, t)
            split = chine_at(y)
            h = ramp(BOW_H, y)
            top = split + h + 0.13 * math.sin(math.pi * ((t * tabs) % 1.0)) \
                * clamp(h / 0.30)
            if top <= split + 0.02:
                continue
            x0, x1 = skin_x(y, split), skin_x(y, top)
            rows.append([(side * x0, y, split), (side * (x0 + 0.010), y, split),
                         (side * (x1 + 0.010), y, top), (side * x1, y, top)])
        skin(bm, rows, cap0=True, cap1=True)
        out.append((new_object(bm, "bowband%d" % side), RED))
    return out


# Lower edge of the anti-glare panel down the side of the nose.
GLARE_LOW = [(6.30, 2.12), (6.98, 1.85), (8.20, 1.52), (9.40, 1.20), (9.58, 1.16)]


def anti_glare():
    """Gloss black over the nose deck forward of the windscreen, wrapping down
    both sides and stopping short of the yellow nose cap at the stem."""
    rows = []
    for i in range(16):
        y = lerp(6.30, 9.58, i / 15.0)
        low = ramp(GLARE_LOW, y)
        top = roof_top(y)
        ring = []
        for k in range(19):
            a = math.pi * k / 18
            z = low + (top - low) * math.sin(a) ** 0.85
            x = body_x(y, z) + 0.020
            ring.append((math.copysign(x, math.cos(a) if k != 9 else 1e-9), y, z))
        rows.append(ring)
    bm = bmesh.new()
    skin(bm, rows, closed=False, cap0=True, cap1=True)
    return new_object(bm, "antiglare", smooth=True)


GLYPHS = {
    "0": [("ring", (0.50, 0.50, 0.42, 0.50), (0.50, 0.50, 0.25, 0.33))],
    "1": [("poly", [(0.40, 0.00), (0.62, 0.00), (0.62, 1.00), (0.40, 1.00)]),
          ("poly", [(0.40, 1.00), (0.40, 0.80), (0.20, 0.66),
                    (0.14, 0.76), (0.22, 0.86)])],
    "2": [("arc", (0.50, 0.72, 0.40, 0.28, 0.16, 200.0, -20.0)),
          ("poly", [(0.80, 0.60), (0.92, 0.52), (0.30, 0.16), (0.14, 0.18)]),
          ("poly", [(0.08, 0.00), (0.92, 0.00), (0.92, 0.18), (0.08, 0.18)])],
    "6": [("ring", (0.50, 0.28, 0.42, 0.28), (0.50, 0.28, 0.25, 0.14)),
          ("arc", (0.50, 0.62, 0.42, 0.38, 0.17, 100.0, 196.0))],
    "8": [("ring", (0.50, 0.74, 0.34, 0.26), (0.50, 0.74, 0.19, 0.14)),
          ("ring", (0.50, 0.28, 0.42, 0.28), (0.50, 0.28, 0.25, 0.15))],
}


def _arc(cy, cz, ry, rz, a0, a1, n=14):
    return [(cy + math.cos(math.radians(lerp(a0, a1, i / n))) * ry,
             cz + math.sin(math.radians(lerp(a0, a1, i / n))) * rz)
            for i in range(n + 1)]


def glyph(bm, ch, y0, z0, w, h, side, xf, out=0.022):
    """One digit as flat plates standing proud of the skin. The bow numbers run
    across a station where the half-beam changes by 0.3 m, so they have to be
    projected onto the hull rather than laid on a plane."""
    def P(pts):
        return [(y0 + w * a, z0 + h * b) for a, b in pts]

    for shape in GLYPHS[ch]:
        if shape[0] == "poly":
            patch(bm, P(shape[1]), side, xf, out)
        elif shape[0] == "ring":
            patch_o, patch_i = shape[1], shape[2]
            annulus(bm, P(ellipse(*patch_o)), P(ellipse(*patch_i)), side, xf, out)
        else:
            cy, cz, ry, rz, t, a0, a1 = shape[1]
            outer = _arc(cy, cz, ry, rz, a0, a1)
            inner = _arc(cy, cz, ry - t, rz - t, a0, a1)
            patch(bm, P(outer + list(reversed(inner))), side, xf, out)


def registration(number="811"):
    """Three black digits 0.85 m tall on the bow topsides, both sides, reading
    nose-first to port and tail-first to starboard so they read left to right
    from wherever you are standing. 811 is the player; the wingmen are 810, 812
    and 866."""
    out = []
    for side in (-1, 1):
        bm = bmesh.new()
        for k, ch in enumerate(number):
            if side < 0:
                glyph(bm, ch, 7.90 - 0.48 * k, -0.305, -0.42, 0.85, side, skin_x)
            else:
                glyph(bm, ch, 6.55 + 0.48 * k, -0.305, 0.42, 0.85, side, skin_x)
        out.append((new_object(bm, "reg%d" % side), BLACK))
    return out


def hull_furniture():
    """Doors, portholes, the grille, the wheel bay and the small placards. There
    is no row of cabin windows on a CL-415, and putting one there is the fastest
    way to make the thing read as an airliner."""
    out = []
    for side in (-1, 1):
        # Crew door to port, cabin door to starboard, drawn as outlines.
        doors = [(4.90, side < 0), (-1.78, side > 0)]

        bm = bmesh.new()
        for cy, here in doors:
            if not here:
                continue
            for z in (-0.30, 1.30):
                patch(bm, rect(cy - 0.425, cy + 0.425, z - 0.045, z + 0.045),
                      side, skin_x, 0.012)
            for e in (-0.425, 0.425):
                patch(bm, rect(cy + e - 0.045, cy + e + 0.045, -0.30, 1.30),
                      side, skin_x, 0.012)
        patch(bm, rect(2.15, 2.70, 0.75, 1.55), side, skin_x, 0.008)
        patch(bm, rect(0.50, 1.75, -0.30, 0.65), side, skin_x, 0.006)
        out.append((new_object(bm, "furniture%d" % side), DARK))

        bm = bmesh.new()
        for k in range(5):
            z = lerp(0.86, 1.44, k / 4.0)
            patch(bm, rect(2.18, 2.67, z - 0.030, z + 0.030), side, skin_x, 0.020)
        # Placards, as rows of ticks: BOMBARDIER on the bow, CL-415 aft. At the
        # size these are on the airframe, ticks read as small text and letter
        # geometry reads as noise.
        for cy, cz, n, w in ((5.55, 1.62, 10, 0.052), (-5.00, 1.55, 6, 0.046)):
            for k in range(n):
                y = cy + (k - n * 0.5) * w
                patch(bm, rect(y, y + w * 0.6, cz, cz + 0.13), side, skin_x, 0.010)
        for cy, here in doors:
            if here:
                patch(bm, rect(cy - 0.19, cy + 0.19, 0.80, 1.18), side, skin_x, 0.010)
        out.append((new_object(bm, "louvres%d" % side), GREY))

        bm = bmesh.new()
        for cy in (3.80, -0.16):
            annulus(bm, ellipse(cy, 1.05, 0.24, 0.24), ellipse(cy, 1.05, 0.19, 0.19),
                    side, skin_x, 0.018)
        out.append((new_object(bm, "portrims%d" % side), GREY))

        bm = bmesh.new()
        for cy in (3.80, -0.16):
            patch(bm, ellipse(cy, 1.05, 0.19, 0.19), side, skin_x, 0.014)
        for cy, here in doors:
            if here:
                patch(bm, rect(cy - 0.17, cy + 0.17, 0.82, 1.16), side, skin_x, 0.014)
        out.append((new_object(bm, "portglass%d" % side), GLASS))

        # The Croatian Air Force roundel: a blue disc with a chequy centre.
        bm = bmesh.new()
        patch(bm, ellipse(-3.95, 0.15, 0.30, 0.30), side, skin_x, 0.014)
        out.append((new_object(bm, "roundel%d" % side), BLUE))
        bm = bmesh.new()
        patch(bm, rect(-4.07, -3.83, 0.03, 0.27), side, skin_x, 0.020)
        out.append((new_object(bm, "roundelw%d" % side), WHITE))
        bm = bmesh.new()
        for dy, dz in ((-0.12, -0.12), (0.00, 0.00)):
            patch(bm, rect(-3.95 + dy, -3.83 + dy, 0.15 + dz, 0.27 + dz),
                  side, skin_x, 0.024)
        out.append((new_object(bm, "roundelr%d" % side), RED))
    return out


def panel_lines():
    """Frame and stringer breaks as hairline strips a few millimetres proud.
    From a hundred metres they are invisible; from four they are the difference
    between an aeroplane and a yellow shape."""
    out = []
    for side in (-1, 1):
        bm = bmesh.new()
        for y in (8.20, 6.30, 4.05, 2.05, 0.10, -2.60, -4.55, -6.60):
            rows = []
            for k in range(13):
                z = lerp(-0.70, crown_at(y) - 0.03, k / 12.0)
                x = skin_x(y, z)
                if x < 0.06:
                    continue
                rows.append([(side * x, y - 0.013, z),
                             (side * (x + 0.006), y - 0.013, z),
                             (side * (x + 0.006), y + 0.013, z),
                             (side * x, y + 0.013, z)])
            if len(rows) > 1:
                skin(bm, rows, cap0=True, cap1=True)
        for z in (1.72, 0.32):
            rows = []
            for k in range(21):
                y = lerp(8.60, -7.40, k / 20.0)
                x = skin_x(y, z)
                if x < 0.06:
                    continue
                rows.append([(side * x, y, z - 0.013),
                             (side * (x + 0.006), y, z - 0.013),
                             (side * (x + 0.006), y, z + 0.013),
                             (side * x, y, z + 0.013)])
            skin(bm, rows, cap0=True, cap1=True)
        out.append((new_object(bm, "panels%d" % side), YELLOW_DK))
    return out


# --------------------------------------------------------------------------- #
#  glazing                                                                     #
# --------------------------------------------------------------------------- #

def glazing():
    """Six panes a side plus two roof lights. The frames are body yellow, so the
    yellow between the panes is the frame and only the glass is modelled. The
    windscreen is laid on the actual skin rather than hung in front of it, which
    is the only way it stays outside the nose all the way round the corner."""
    out = []
    bm = bmesh.new()
    for side in (-1, 1):
        # Windscreen and the corner pane beside it, as two bands across the
        # nose separated by a strip of yellow: the post between them.
        rows = [(7.34, 2.36), (7.16, 2.10), (6.98, 1.84)]
        for f0, f1 in ((0.07, 0.60), (0.66, 0.97)):
            grid = []
            for d in (0.0, 0.022):
                ring = []
                for y, z in rows:
                    ring.append((side * (body_x(y, z) * f0 + d * side * side), y + d, z))
                for y, z in reversed(rows):
                    ring.append((side * (body_x(y, z) * f1 + d), y + d, z))
                grid.append(ring)
            skin(bm, grid, cap0=True, cap1=True)
        # Pilot's side window and the rear quarter light, on the hull side where
        # a marking projected from (y, z) lands where it should.
        patch(bm, [(6.90, 1.74), (6.05, 1.78), (6.05, 2.30), (6.88, 2.28)],
              side, skin_x, 0.014)
        patch(bm, [(6.00, 1.82), (5.45, 1.86), (5.45, 2.26), (6.00, 2.28)],
              side, skin_x, 0.014)
    out.append((new_object(bm, "glass"), GLASS))

    bm = bmesh.new()
    for side in (-1, 1):
        rows = []
        for k in range(6):
            y = lerp(7.10, 6.60, k / 5.0)
            top = roof_top(y)
            rows.append([(side * 0.20, y, top - 0.004), (side * 0.86, y, top - 0.055),
                         (side * 0.86, y, top - 0.048), (side * 0.20, y, top + 0.006)])
        skin(bm, rows, cap0=True, cap1=True)
    out.append((new_object(bm, "roofglass"), GLASS))

    bm = bmesh.new()
    for side in (-1, 1):
        tube(bm, (side * 0.20, 7.00, 1.84), (side * 0.74, 6.94, 1.94), 0.018, 0.012, 6)
        tube(bm, (side * 0.16, 7.03, 1.86), (side * 0.23, 6.98, 1.82), 0.032, 0.032, 8)
    out.append((new_object(bm, "wipers"), DARK))
    return out


# --------------------------------------------------------------------------- #
#  wing                                                                        #
# --------------------------------------------------------------------------- #
# Span 28.60, root chord 3.80 with the trailing edge directly over the planing
# step, tip chord 2.10, LE sweep 1.5 deg, dihedral 2 deg. Every hinge line in
# the parts contract falls out of those four numbers to within a centimetre,
# which is the check that they are the right four numbers.

SPAN = 14.30
WING_Z0 = 2.55


def wing_geom(x):
    f = abs(x) / SPAN
    return (3.80 - 1.70 * f,                        # chord
            2.30 - 0.02618 * abs(x),                # leading edge
            WING_Z0 + 0.034921 * abs(x),            # chord plane
            0.15 - 0.03 * f)                        # thickness ratio


def flap_hinge(x):
    return lerp(-0.374, 0.256, (abs(x) - 1.90) / 6.80)


def ail_hinge(x):
    return lerp(0.050, 0.517, (abs(x) - 9.00) / 5.00)


def flap_xi(x):
    c, le, _z, _t = wing_geom(x)
    return (le - flap_hinge(x)) / c


def ail_xi(x):
    c, le, _z, _t = wing_geom(x)
    return (le - ail_hinge(x)) / c


def wing_xi(x):
    """Chord fraction at which the fixed wing stops: the flap or aileron hinge
    where there is one, the trailing edge where there is not."""
    a = abs(x)
    if 1.90 <= a <= 8.70:
        return flap_xi(x)
    if 9.00 <= a <= 14.00:
        return ail_xi(x)
    return 1.0


def foil_ring(x, xi0, xi1, n=SEG_FOIL):
    c, le, zc, t = wing_geom(x)
    up, lo = [], []
    for i in range(n + 1):
        xi = lerp(xi0, xi1, cosine(i, n))
        y = le - xi * c
        h = naca(xi, t) * c
        up.append((x, y, zc + h))
        lo.append((x, y, zc - h))
    return up + list(reversed(lo))


def wing_low_z(x, y):
    c, le, zc, t = wing_geom(x)
    return zc - naca((le - y) / c, t) * c


def wing_panel(x0, x1, name, steps=3, colour=YELLOW, xi1=None):
    bm = bmesh.new()
    rings = []
    for i in range(steps + 1):
        x = lerp(x0, x1, i / steps)
        rings.append(foil_ring(x, 0.0, (xi1 or wing_xi)(x)))
    skin(bm, rings, cap0=True, cap1=True)
    return (new_object(bm, name, smooth=True), colour)


# Where the fixed wing is cut, doubled a few centimetres apart so the end of a
# flap or aileron run is a real step in the trailing edge and not a smeared ramp.
WING_X = [-9.60, -9.30, -9.02, -8.98, -8.72, -8.68, -6.60, -4.40, -2.60,
          -1.92, -1.88, -0.90, 0.0, 0.90, 1.88, 1.92, 2.60, 4.40, 6.60,
          8.68, 8.72, 8.98, 9.02, 9.30, 9.60]

HOOPS = [(9.60 + k * 0.36, 0.16, 0.20) for k in range(5)]


def wing():
    """Fixed wing in three paint blocks a side: yellow to 9.60, five navy hoops
    to 11.20, then solid red to the tip. The chevron run has to be geometry now
    — one colour per object and no texture to hide behind."""
    out = []
    bm = bmesh.new()
    skin(bm, [foil_ring(x, 0.0, wing_xi(x)) for x in WING_X], cap0=True, cap1=True)
    out.append((new_object(bm, "wing_yellow", smooth=True), YELLOW))

    for side in (-1, 1):
        for k, (a, wd, gp) in enumerate(HOOPS):
            out.append(wing_panel(side * a, side * (a + wd),
                                  "hoop%d_%d" % (side, k), 1, BLUE))
            out.append(wing_panel(side * (a + wd), side * (a + gp + wd * 0.0 + 0.20),
                                  "hgap%d_%d" % (side, k), 1, RED))
        out.append(wing_panel(side * 11.20, side * 14.00, "wtip%d" % side, 3, RED))
        out.append(wing_panel(side * 14.00, side * 14.30, "wcap%d" % side, 1, RED,
                              lambda _x: 1.0))

    bm = bmesh.new()
    for side in (-1, 1):
        _c, le, zc, _t = wing_geom(9.60)
        bm_box(bm, side * 9.60, le - 0.06, zc, 0.46, 0.16, 0.20)
    ob = new_object(bm, "landinglight")
    bevel(ob, 0.020, 1)
    out.append((ob, LENS))

    # The walkway on the wing root, where the crew get up to the cabin roof.
    bm = bmesh.new()
    for side in (-1, 1):
        rows = []
        for k in range(7):
            x = side * lerp(0.55, 2.85, k / 6.0)
            c, le, zc, t = wing_geom(x)
            row = []
            for j in range(5):
                xi = lerp(0.18, 0.62, j / 4.0)
                row.append((x, le - xi * c, zc + naca(xi, t) * c + 0.010))
            rows.append(row)
        skin(bm, rows, closed=False)
    out.append((new_object(bm, "walkway"), DARK))
    return out


def surface(x0, x1, xi0f, name, steps=4, colour=YELLOW):
    """A hinged surface: authored from its hinge line aft, with a blunt leading
    face so that the gap between it and the wing is a gap you can see."""
    bm = bmesh.new()
    rings = []
    for i in range(steps + 1):
        x = lerp(x0, x1, i / steps)
        rings.append(foil_ring(x, xi0f(x), 1.0, 6))
    skin(bm, rings, cap0=True, cap1=True)
    return (new_object(bm, name, smooth=True), colour)


def flaps(side):
    """The flap itself, then the four hinge horns that stay with the wing."""
    out = [surface(side * 1.95, side * 8.65, flap_xi, "flap%d" % side, 5)]
    bm = bmesh.new()
    for a in (2.30, 4.00, 6.30, 8.30):
        x = side * a
        y = flap_hinge(x)
        bm_box(bm, x, y - 0.11, wing_low_z(x, y) - 0.10, 0.10, 0.30, 0.16)
    ob = new_object(bm, "flaphorn%d" % side)
    bevel(ob, 0.012, 1)
    out.append((ob, GREY))
    return out


def ailerons(side):
    """The chevron run carries straight across onto the aileron, exactly as it
    does on 811, so the aileron is built in the same five paint blocks."""
    out = [surface(side * 9.05, side * 9.60, ail_xi, "ailin%d" % side, 2),
           surface(side * 11.20, side * 13.95, ail_xi, "ailout%d" % side, 3, RED)]
    for k, (a, wd, gp) in enumerate(HOOPS):
        out.append(surface(side * a, side * (a + wd),
                           ail_xi, "ailhoop%d_%d" % (side, k), 1, BLUE))
        out.append(surface(side * (a + wd), side * (a + wd + 0.20),
                           ail_xi, "ailgap%d_%d" % (side, k), 1, RED))
    return out


def flap_tracks():
    """Four blade fairings a side, hanging below and behind the trailing edge.
    They are prominent in every underside photograph and they are the reason a
    Canadair wing does not read as a slab."""
    bm = bmesh.new()
    for side in (-1, 1):
        for a in (2.30, 4.00, 6.30, 8.30):
            x = side * a
            low = wing_low_z(x, -0.60)
            rings = []
            for y, rx, rz, drop in ((-0.60, 0.13, 0.11, 0.09),
                                    (-1.05, 0.15, 0.21, 0.20),
                                    (-1.60, 0.14, 0.19, 0.22),
                                    (-2.10, 0.10, 0.13, 0.20),
                                    (-2.50, 0.02, 0.03, 0.16)):
                rings.append(super_ring(x, low - drop, y, rx, rz, 10))
            skin(bm, rings, cap0=True, cap1=True)
    return [(new_object(bm, "flaptracks", smooth=True), YELLOW)]


# --------------------------------------------------------------------------- #
#  floats, pylons and winglets                                                 #
# --------------------------------------------------------------------------- #
# There are no sponsons on a CL-415. What hangs off the outer wing is a little
# boat on a pylon, with its own pointed bow, its own hard chine and its own
# maroon planing bottom, and at the tip a maroon winglet.

FLOAT_X = 12.90
FLOAT = [                       # y, half beam, deck z, chine z, keel z
    (2.15, 0.05, 2.28, 2.12, 2.10),
    (1.85, 0.20, 2.32, 2.02, 1.92),
    (1.40, 0.36, 2.35, 1.94, 1.70),
    (0.80, 0.44, 2.36, 1.90, 1.57),
    (0.00, 0.45, 2.36, 1.90, 1.55),
    (-0.60, 0.44, 2.35, 1.92, 1.58),
    (-1.05, 0.42, 2.33, 1.98, 1.68),
]


def floats(side):
    """Returns the float's two shells first and its pylon last, so the caller
    can hang the boat off floatL/floatR and leave the pylon on the wing."""
    x = side * FLOAT_X
    ups, los = [], []
    for y, w, deck, chine, keel in FLOAT:
        e = 2.0 / 2.4
        up, lo = [], []
        for i in range(11):
            a = math.pi * i / 10
            c, s = math.cos(a), math.sin(a)
            px = x + math.copysign(abs(c) ** e, c) * w
            up.append((px, y, chine + abs(s) ** e * (deck - chine)))
            lo.append((px, y, chine - (1.0 - abs(c)) * (chine - keel)))
        ups.append(up)
        los.append(lo)

    bm = bmesh.new()
    skin(bm, ups, closed=False, cap0=True, cap1=True)
    top = (new_object(bm, "float%d_top" % side, smooth=True), YELLOW)

    bm = bmesh.new()
    skin(bm, los, closed=False, cap0=True, cap1=True)
    ob = new_object(bm, "float%d_bot" % side)
    bevel(ob, 0.012, 1)
    bot = (ob, MAROON)

    bm = bmesh.new()
    rings = []
    for y in (0.66, 0.24, -0.28, -0.72):
        rings.append([(x - 0.14, y, 2.34), (x + 0.14, y, 2.34),
                      (x + 0.16, y, wing_low_z(x, y) + 0.03),
                      (x - 0.16, y, wing_low_z(x, y) + 0.03)])
    skin(bm, rings, cap0=True, cap1=True)
    ob = new_object(bm, "pylon%d" % side)
    bevel(ob, 0.035, 1)
    return [top, bot, (ob, YELLOW)]


def winglet(side):
    """Root chord 1.90, tip 0.95, height 1.05, LE swept 42 deg and canted 8 deg
    outboard. Solid maroon on both faces."""
    bm = bmesh.new()
    _c, le, zc, _t = wing_geom(14.30)
    rings = []
    for i in range(5):
        f = i / 4.0
        h = 1.05 * f
        chord = lerp(1.90, 0.95, f)
        y0 = le - h * math.tan(math.radians(42.0))
        x = side * (14.30 + h * math.tan(math.radians(8.0)))
        t = 0.10 - 0.02 * f
        a, b = [], []
        for k in range(7):
            xi = cosine(k, 6)
            hh = naca(xi, t) * chord
            a.append((x + hh, y0 - xi * chord, zc + h))
            b.append((x - hh, y0 - xi * chord, zc + h))
        rings.append(a + list(reversed(b)))
    skin(bm, rings, cap0=True, cap1=True)
    return [(new_object(bm, "winglet%d" % side, smooth=True), MAROON)]


# --------------------------------------------------------------------------- #
#  nacelles and propellers                                                     #
# --------------------------------------------------------------------------- #
# Long, deep pods that the wing passes THROUGH. Cowl face at +5.35 and a
# horizontal knife edge at -2.10: seven and a half metres of nacelle for a three
# metre local wing chord, which is what a Canadair looks like and what a short
# pod never will.

NAC_X = 5.15
NAC_Z = 3.20
NACELLE = [                    # y, half width, half height, centre z
    (5.35, 0.40, 0.36, 3.22),
    (5.00, 0.56, 0.53, 3.16),
    (4.35, 0.70, 0.72, 3.08),
    (3.40, 0.77, 0.86, 3.02),
    (2.40, 0.775, 0.90, 3.00),
    (1.20, 0.76, 0.88, 3.02),
    (0.00, 0.70, 0.80, 3.06),
    (-0.90, 0.58, 0.66, 3.10),
    (-1.60, 0.40, 0.46, 3.14),
    (-2.10, 0.09, 0.24, 3.18),
]


def nacelle(side):
    x = side * NAC_X
    out = []

    bm = bmesh.new()
    skin(bm, [super_ring(x, cz, y, rw, rh, 16, 2.5) for y, rw, rh, cz in NACELLE],
         cap0=True, cap1=True)
    out.append((new_object(bm, "nacelle%d" % side, smooth=True), YELLOW))

    # The chin intake below the spinner. This one scoop is the single feature
    # that makes a CL-415 nacelle read correctly, and it is the first thing
    # missing from every model that gets the nacelle wrong.
    bm = bmesh.new()
    skin(bm, [super_ring(x, cz, y, rw, rh, 12, 2.2)
              for y, rw, rh, cz in ((5.05, 0.31, 0.17, 2.58),
                                    (4.60, 0.33, 0.19, 2.57),
                                    (3.90, 0.32, 0.20, 2.62),
                                    (3.30, 0.24, 0.16, 2.74))],
         cap0=True, cap1=True)
    out.append((new_object(bm, "intake%d" % side, smooth=True), YELLOW))

    bm = bmesh.new()
    skin(bm, [super_ring(x, 2.58, 5.055, 0.27, 0.14, 12, 2.2),
              super_ring(x, 2.575, 4.80, 0.24, 0.12, 12, 2.2)], cap1=True)
    out.append((new_object(bm, "intakemouth%d" % side), DARK))

    # Exhaust stub, outboard, angled aft and out, and the soot it leaves.
    bm = bmesh.new()
    tube(bm, (x + side * 0.58, 3.58, 3.12), (x + side * 0.86, 3.02, 3.05),
         0.10, 0.085, 10)
    out.append((new_object(bm, "exhaust%d" % side), GREY))
    bm = bmesh.new()
    tube(bm, (x + side * 0.83, 3.08, 3.06), (x + side * 0.87, 3.00, 3.05),
         0.068, 0.068, 10)
    out.append((new_object(bm, "exhaustmouth%d" % side), BLACK))
    bm = bmesh.new()
    rows = []
    for k in range(6):
        y = lerp(2.92, 0.40, k / 5.0)
        spread = lerp(0.05, 0.20, k / 5.0)
        r = 0.76 - 0.03 * k
        rows.append([(x + side * r, y, 3.05 - spread),
                     (x + side * (r + 0.014), y, 3.05 - spread),
                     (x + side * (r + 0.014), y, 3.05 + spread),
                     (x + side * r, y, 3.05 + spread)])
    skin(bm, rows, cap0=True, cap1=True)
    out.append((new_object(bm, "soot%d" % side), SOOT))

    # The cowl panel breaks, over the top of the pod where they catch the light.
    bm = bmesh.new()
    for y in (4.70, 3.60, 2.30, 1.00, -0.30):
        rows = []
        for k in range(9):
            a = math.pi * (0.16 + 0.68 * k / 8.0)
            c, s = math.cos(a), math.sin(a)
            e = 2.0 / 2.5
            px = math.copysign(abs(c) ** e, c) * 0.775
            pz = math.copysign(abs(s) ** e, s) * 0.90
            n = Vector((px, 0.0, pz)).normalized() * 0.010
            rows.append([(x + px, y - 0.012, 3.00 + pz),
                         (x + px + n.x, y - 0.012, 3.00 + pz + n.z),
                         (x + px + n.x, y + 0.012, 3.00 + pz + n.z),
                         (x + px, y + 0.012, 3.00 + pz)])
        skin(bm, rows, cap0=True, cap1=True)
    out.append((new_object(bm, "cowlpanels%d" % side), YELLOW_DK))
    return out


def spun(ob, cx, ang):
    """Turn a finished blade about the crankshaft, which is Blender -Y through
    the hub — the same axis the runtime spins the whole part about."""
    c, s = math.cos(ang), math.sin(ang)
    for v in ob.data.vertices:
        dx, dz = v.co.x - cx, v.co.z - NAC_Z
        v.co.x = cx + dx * c - dz * s
        v.co.z = NAC_Z + dx * s + dz * c


def blade_ring(x, r, chord, twist):
    """One radial section of a propeller blade: a lens, laid in the disc plane
    and rotated by the local twist."""
    c, s = math.cos(twist), math.sin(twist)
    upper, lower = [], []
    for k in range(8):
        f = cosine(k, 7)
        u = (f - 0.5) * chord
        h = naca(f, 0.13) * chord
        upper.append((x + u * c - h * s, 5.80 + u * s + h * c, NAC_Z + r))
        lower.append((x + u * c + h * s, 5.80 + u * s - h * c, NAC_Z + r))
    return upper + list(reversed(lower))


def propeller(side):
    """Four straight wide blades with big black cuffs and off-white tips, on an
    ogival grey spinner. Diameter 3.97 m; both engines turn the same way."""
    x = side * NAC_X
    out = []

    bm = bmesh.new()
    skin(bm, [super_ring(x, NAC_Z, y, r, r, 14, 2.0)
              for y, r in ((5.44, 0.13), (5.56, 0.235), (5.72, 0.26),
                           (5.94, 0.245), (6.10, 0.185), (6.25, 0.02))],
         cap0=True, cap1=True)
    out.append((new_object(bm, "spinner%d" % side, smooth=True), SPINNER))

    for b in range(4):
        ang = TAU * b / 4
        for tag, r0, r1, steps, colour in (("bl", 0.30, 1.685, 5, BLACK),
                                           ("tp", 1.685, 1.985, 1, WHITE)):
            bm = bmesh.new()
            rings = []
            for i in range(steps + 1):
                r = lerp(r0, r1, i / steps)
                f = clamp((r - 0.30) / 1.685)
                chord = min(0.32, 0.19 + 0.36 * math.sin(math.pi * clamp(0.10 + f * 0.86)))
                rings.append(blade_ring(x, r, chord,
                                        math.radians(lerp(34.0, 12.0, f))))
            skin(bm, rings, cap0=True, cap1=True)
            ob = new_object(bm, "blade%d_%d%s" % (side, b, tag), smooth=True)
            spun(ob, x, ang)
            out.append((ob, colour))

        bm = bmesh.new()
        tube(bm, (x, 5.80, NAC_Z + 0.19), (x, 5.80, NAC_Z + 0.44), 0.090, 0.078, 10)
        ob = new_object(bm, "cuff%d_%d" % (side, b), smooth=True)
        spun(ob, x, ang)
        out.append((ob, BLACK))
    return out


# --------------------------------------------------------------------------- #
#  the tail, as one assembly                                                   #
# --------------------------------------------------------------------------- #
# The defect being fixed here is four hand-placed slabs that never met. Fin,
# dorsal fillet, tailplane pedestal and root fairings are one continuous
# structure, and the fin root is not a straight line at a constant height: it
# follows the tailcone deck down as the hull falls away aft.

FIN_Z0, FIN_Z1 = 2.32, 7.77
RUD_Z0 = 3.20
STAB_Z = 2.85


def fin_geom(z):
    f = clamp((z - FIN_Z0) / (FIN_Z1 - FIN_Z0))
    le = -4.10 - 3.54 * f
    te = -8.70 - 0.89 * f
    return le, te, le - te, 0.12 - 0.02 * f


def rud_hinge(z):
    return lerp(-7.23, -8.97, clamp((z - RUD_Z0) / (FIN_Z1 - RUD_Z0)))


def fin_xi(z):
    le, _te, c, _t = fin_geom(z)
    return (le - rud_hinge(z)) / c


def fin_half(y, z):
    """Half-thickness of the fin at a point on it, and nought everywhere else.
    The cheatline crosses from the hull onto the fin without a seam because
    whichever of the two surfaces is wider wins."""
    if not FIN_Z0 <= z <= FIN_Z1:
        return 0.0
    le, te, c, t = fin_geom(z)
    if y > le or y < te:
        return 0.0
    return naca((le - y) / c, t) * c


def fin_ring(z, xi0, xi1, n=7, swell=0.0, droop=False):
    """A fin section. `swell` fattens it, for the paint that lies on top of it;
    `droop` pulls the section down onto the tailcone deck, which is what stops
    the fin root floating in the air aft of y=-8."""
    le, _te, c, t = fin_geom(z)
    a, b = [], []
    for i in range(n + 1):
        xi = lerp(xi0, xi1, cosine(i, n))
        y = le + swell * 0.8 - xi * c
        h = naca(xi, t) * c + swell
        zz = min(z, crown_at(y) - 0.03) if droop else z
        a.append((h, y, zz))
        b.append((-h, y, zz))
    return a + list(reversed(b))


def dorsal_rise(y):
    """Height of the dorsal spine above the deck: forward of the fin it grows
    out of the hull crown, aft of the fin trailing edge it dies into the
    tailcone. This is the fillet that ties the fin to the aeroplane."""
    if y > -1.60:
        return 0.0
    if y > -4.10:
        return 0.60 * clamp((-1.60 - y) / 2.50)
    if y > -8.40:
        return 0.60
    return 0.60 * clamp((y + 9.10) / 0.70)


def fin():
    out = []
    bm = bmesh.new()
    rings = [fin_ring(FIN_Z0, 0.0, 1.0, droop=True)]
    for z in (FIN_Z0 + 0.30, FIN_Z0 + 0.60, RUD_Z0):
        rings.append(fin_ring(z, 0.0, 1.0))
    skin(bm, rings, cap0=True, cap1=True)
    rings = []
    for i in range(9):
        z = lerp(RUD_Z0, FIN_Z1, i / 8.0)
        rings.append(fin_ring(z, 0.0, fin_xi(z)))
    skin(bm, rings, cap0=True, cap1=True)
    out.append((new_object(bm, "fin", smooth=True), YELLOW))

    bm = bmesh.new()
    rings = []
    for y in (-1.60, -2.60, -3.40, -4.10, -5.20, -6.30, -7.40, -8.40, -9.10):
        rise = dorsal_rise(y)
        half = 0.10 + 0.36 * (rise / 0.60)
        base = crown_at(y) - 0.14
        ring = []
        for i in range(11):
            a = math.pi * i / 10
            ring.append((math.cos(a) * half, y,
                         base + (rise + 0.14) * math.sin(a) ** 0.55))
        rings.append(ring)
    skin(bm, rings, closed=False, cap0=True, cap1=True)
    out.append((new_object(bm, "dorsal", smooth=True), YELLOW))

    # Six yellow gaps break the red leading-edge band into the ladder of blocks
    # the photographs show; below the lowest it runs on down the dorsal fillet.
    edges = [0.0]
    for h in (1.35, 2.05, 2.75, 3.40, 4.00, 4.55):
        edges += [h, h + 0.30]
    edges.append(5.45)
    bm = bmesh.new()
    for k in range(0, len(edges) - 1, 2):
        rings = []
        for i in range(4):
            z = FIN_Z0 + lerp(edges[k], edges[k + 1], i / 3.0)
            _le, _te, c, _t = fin_geom(z)
            rings.append(fin_ring(z, 0.0, 0.42 / c, 5, swell=0.012,
                                  droop=(k == 0 and i == 0)))
        skin(bm, rings, cap0=True, cap1=True)
    out.append((new_object(bm, "finband", smooth=True), RED))

    out += sahovnica()
    bm = bmesh.new()
    bm_ball(bm, 0.0, -9.30, 7.60, 0.07, 0.11, 0.07, rows=5, seg=10)
    out.append((new_object(bm, "taillight", smooth=True), LENS))
    return out


def sahovnica():
    """The Croatian coat of arms: a five-by-five chequy shield with the top-left
    square red, and the five-shield crown above it. Twenty-five quads a side,
    because a vertex-coloured blob cannot get this out of a shader."""
    out = []
    cz, bw, bh = 5.87, 0.70, 0.72
    le, _te, c, _t = fin_geom(cz)
    cy = le - 0.30 * c
    y0, z0 = cy - bw * 0.5, cz - bh * 0.5

    def xf(y, z):
        return max(fin_half(y, z), 0.02)

    bm = bmesh.new()
    for side in (-1, 1):
        patch(bm, rect(y0, y0 + bw, z0, z0 + bh), side, xf, 0.012)
        patch(bm, [(y0, z0), (y0 + bw, z0), (y0 + bw * 0.5, z0 - 0.17)],
              side, xf, 0.012)
    out.append((new_object(bm, "shield"), WHITE))

    bm = bmesh.new()
    for side in (-1, 1):
        for r in range(5):
            for col in range(5):
                if (r + col) % 2:
                    continue
                patch(bm, rect(y0 + bw * col / 5.0, y0 + bw * (col + 1) / 5.0,
                               z0 + bh * (4 - r) / 5.0, z0 + bh * (5 - r) / 5.0),
                      side, xf, 0.020)
        for k in range(5):
            patch(bm, rect(y0 + 0.05 + k * 0.128, y0 + 0.05 + k * 0.128 + 0.088,
                           z0 + bh + 0.04, z0 + bh + 0.19), side, xf, 0.018)
    out.append((new_object(bm, "chequy"), RED))
    return out


def rudder():
    """Yellow, with the red stripe along its trailing edge over the full height.
    Its leading face is blunt because it is a hinge line, not an aerofoil nose."""
    out = []
    for name, colour, band in (("rudder", YELLOW, False), ("rudstripe", RED, True)):
        bm = bmesh.new()
        rings = []
        for i in range(9):
            z = lerp(RUD_Z0, FIN_Z1, i / 8.0)
            _le, _te, c, _t = fin_geom(z)
            cut = 1.0 - 0.35 / c
            rings.append(fin_ring(z, cut, 1.0, 3) if band
                         else fin_ring(z, fin_xi(z), cut, 5))
        skin(bm, rings, cap0=True, cap1=True)
        out.append((new_object(bm, name, smooth=True), colour))
    return out


def stab_geom(x):
    f = abs(x) / 5.05
    return 2.85 - 1.15 * f, -5.45 - 1.073 * f, 0.12 - 0.02 * f


def elev_hinge(x):
    return -7.35 - 0.15 * abs(x) / 5.05


def stab_xi(x):
    c, le, _t = stab_geom(x)
    return (le - elev_hinge(x)) / c


def stab_ring(x, xi0, xi1, n=7):
    c, le, t = stab_geom(x)
    a, b = [], []
    for i in range(n + 1):
        xi = lerp(xi0, xi1, cosine(i, n))
        y = le - xi * c
        h = naca(xi, t) * c
        a.append((x, y, STAB_Z + h))
        b.append((x, y, STAB_Z - h))
    return a + list(reversed(b))


def stab_panel(x0, x1, name, steps, colour):
    bm = bmesh.new()
    rings = []
    for i in range(steps + 1):
        x = lerp(x0, x1, i / steps)
        rings.append(stab_ring(x, 0.0, stab_xi(x)))
    skin(bm, rings, cap0=True, cap1=True)
    return (new_object(bm, name, smooth=True), colour)


SHOOPS = [(3.10 + k * 0.285, 0.16, 0.125) for k in range(3)]


def stab():
    """Span 10.10, zero dihedral, chord plane at +2.85 — half a metre above the
    tailcone deck on a short pedestal, not five metres up on top of the fin.
    Yellow to 3.10, three navy hoops, red to the tip, and an endplate finlet at
    each tip standing 1.45 m above the tailplane and 0.35 below it."""
    out = [stab_panel(-3.10, 3.10, "stab_yellow", 6, YELLOW)]
    for side in (-1, 1):
        for k, (a, wd, gp) in enumerate(SHOOPS):
            out.append(stab_panel(side * a, side * (a + wd),
                                  "shoop%d_%d" % (side, k), 1, BLUE))
            out.append(stab_panel(side * (a + wd), side * (a + wd + gp),
                                  "sgap%d_%d" % (side, k), 1, RED))
        out.append(stab_panel(side * 3.95, side * 5.05, "stip%d" % side, 2, RED))

        bm = bmesh.new()
        rings = []
        for z, le, chord in ((2.50, -6.20, 2.30), (2.85, -6.273, 2.20),
                             (3.50, -6.68, 1.86), (4.30, -7.179, 1.35)):
            a, b = [], []
            for i in range(7):
                xi = cosine(i, 6)
                h = naca(xi, 0.11) * chord
                a.append((side * 5.05 + h, le - xi * chord, z))
                b.append((side * 5.05 - h, le - xi * chord, z))
            rings.append(a + list(reversed(b)))
        skin(bm, rings, cap0=True, cap1=True)
        out.append((new_object(bm, "finlet%d" % side, smooth=True), YELLOW))

    # The root fairings, which is where the tailplane actually joins the fin.
    bm = bmesh.new()
    rings = []
    for x in (-0.62, -0.40, -0.20, 0.0, 0.20, 0.40, 0.62):
        f = 1.0 - abs(x) / 0.62
        c, le, _t = stab_geom(x)
        up = 0.02 + 0.60 * f ** 1.4
        dn = 0.02 + 0.22 * f ** 1.4
        a, b = [], []
        for i in range(9):
            xi = cosine(i, 8)
            shape = math.sin(math.pi * xi) ** 0.7
            y = le + 0.30 - xi * (c + 0.62)
            a.append((x, y, STAB_Z + shape * up))
            b.append((x, y, STAB_Z - shape * dn))
        rings.append(a + list(reversed(b)))
    skin(bm, rings, cap0=True, cap1=True)
    out.append((new_object(bm, "stabfairing", smooth=True), YELLOW))
    return out


def elevator():
    """Two halves with a gap at the centreline for the fin to pass through, on
    one pivot — which is what a real one-piece elevator with its torque tube
    behind the fin actually looks like."""
    out = []
    bm = bmesh.new()
    for side in (-1, 1):
        rings = []
        for i in range(6):
            x = side * lerp(0.26, 4.98, i / 5.0)
            rings.append(stab_ring(x, stab_xi(x), 1.0, 5))
        skin(bm, rings, cap0=True, cap1=True)
    out.append((new_object(bm, "elevator", smooth=True), YELLOW))

    bm = bmesh.new()
    for side in (-1, 1):
        for a in (2.60, 4.40):
            x = side * a
            bm_box(bm, x, elev_hinge(x) - 0.10, STAB_Z - 0.10, 0.10, 0.28, 0.14)
    ob = new_object(bm, "elevhorn")
    bevel(ob, 0.010, 1)
    out.append((ob, GREY))
    return out


# --------------------------------------------------------------------------- #
#  water doors, scoops, undercarriage, aerials                                 #
# --------------------------------------------------------------------------- #

def water_door(side, cy):
    """One of four doors in the planing bottom forward of the step, hinged on
    its inboard edge so that rotation about Blender -Y swings the outboard edge
    down through sixty-six degrees. The plate lies in the vee, so it is not
    flat, and it is maroon because the planing bottom is."""
    bm = bmesh.new()
    y0, y1 = cy - 0.65, cy + 0.65
    rows = []
    for x in (0.16, 0.36, 0.58, 0.78):
        row = []
        for y in (y0, y1):
            row.append((side * x, y, bottom_z(y, x) - 0.004))
        for y in (y1, y0):
            row.append((side * x, y, bottom_z(y, x) - 0.055))
        rows.append(row)
    skin(bm, rows, cap0=True, cap1=True)
    ob = new_object(bm, "wdoor%d_%.0f" % (side, cy * 10))
    bevel(ob, 0.010, 1)
    return [(ob, MAROON)]


def probe(side):
    """A retractable scoop just aft of the step. The flight model sets the
    part's absolute height, so the geometry is authored upward from the pivot
    and sized to sit flush with the afterbody bottom when it is stowed and stand
    0.55 m proud when it is down."""
    x = side * 0.62
    flush = bottom_z(-1.65, 0.62)
    out = []
    bm = bmesh.new()
    rings = []
    for y, rx in ((-1.34, 0.05), (-1.42, 0.09), (-1.88, 0.09), (-1.96, 0.05)):
        rings.append([(x - rx, y, flush - 0.01), (x + rx, y, flush - 0.01),
                      (x + rx, y, flush + 0.66), (x - rx, y, flush + 0.66)])
    skin(bm, rings, cap0=True, cap1=True)
    ob = new_object(bm, "probe%d" % side)
    bevel(ob, 0.012, 1)
    out.append((ob, GREY))

    bm = bmesh.new()
    bm_box(bm, x, -1.72, flush + 0.03, 0.20, 0.44, 0.07)
    ob = new_object(bm, "probelip%d" % side)
    bevel(ob, 0.010, 1)
    out.append((ob, STEEL))
    return out


def wheel(bm, cx, cy, cz, half_w, r, seg=14):
    """A tyre with a shoulder radius, so that it is not a black cylinder."""
    rings = []
    for f, rr in ((-1.00, 0.86), (-0.82, 0.97), (-0.35, 1.00),
                  (0.35, 1.00), (0.82, 0.97), (1.00, 0.86)):
        rings.append([(cx + f * half_w, cy + math.cos(TAU * i / seg) * r * rr,
                       cz + math.sin(TAU * i / seg) * r * rr) for i in range(seg)])
    skin(bm, rings, cap0=True, cap1=True)


def scissor(bm, p0, p1, off, r=0.030):
    """A torque link: two bars meeting at a knee standing off the leg. It is the
    one piece of undercarriage detail everybody notices the absence of."""
    mid = tuple(lerp(p0[i], p1[i], 0.5) + off[i] for i in range(3))
    tube(bm, p0, mid, r, r * 0.85, 6)
    tube(bm, mid, p1, r * 0.85, r, 6)


def gear_main(side):
    """One wheel a side on a short single oleo with a side brace, retracting
    into the hull and not into the nacelles. The tyre hangs outboard of the hull
    with about ninety millimetres of clearance, which is why the leg is short."""
    out = []
    trun = (side * 1.62, 1.10, -0.20)
    axle = (side * 1.78, 1.10, -1.45)
    mid = tuple(lerp(trun[i], axle[i], 0.46) for i in range(3))

    bm = bmesh.new()
    bm_box(bm, side * 1.55, 1.10, -0.18, 0.24, 0.34, 0.26)
    tube(bm, trun, mid, 0.085, 0.078, 10)
    tube(bm, (side * 1.61, 1.10, -0.74), (side * 1.28, 1.12, 0.12), 0.045, 0.045, 8)
    tube(bm, (side * 1.69, 1.06, -0.92), (side * 1.60, 1.84, -0.24), 0.038, 0.038, 8)
    ob = new_object(bm, "mainleg%d" % side)
    bevel(ob, 0.012, 1)
    out.append((ob, GREY))

    bm = bmesh.new()
    tube(bm, mid, (axle[0], axle[1], axle[2] + 0.02), 0.062, 0.058, 10)
    out.append((new_object(bm, "mainoleo%d" % side, smooth=True), STEEL))

    bm = bmesh.new()
    scissor(bm, (side * 1.66, 0.99, -0.62), (side * 1.76, 0.99, -1.30),
            (side * 0.02, -0.17, 0.0))
    out.append((new_object(bm, "mainlink%d" % side), GREY))

    bm = bmesh.new()
    tube(bm, (axle[0] - side * 0.16, axle[1], axle[2]),
         (axle[0] + side * 0.18, axle[1], axle[2]), 0.29, 0.29, 14)
    for k in range(6):
        a = TAU * k / 6
        p = (axle[1] + math.cos(a) * 0.16, axle[2] + math.sin(a) * 0.16)
        tube(bm, (axle[0] + side * 0.15, p[0], p[1]),
             (axle[0] + side * 0.21, p[0], p[1]), 0.030, 0.030, 6)
    out.append((new_object(bm, "mainhub%d" % side, smooth=True), HUB))

    bm = bmesh.new()
    wheel(bm, axle[0], axle[1], axle[2], 0.17, 0.51)
    out.append((new_object(bm, "maintyre%d" % side, smooth=True), TYRE))
    return out


def gear_nose():
    """Twin wheels on a 1.60 m strut raked eight degrees aft, with a torque link
    and the spray deflector that keeps the water out of the propellers."""
    out = []
    trun = (0.0, 6.55, -0.10)
    axle = (0.0, 6.30, -1.66)
    mid = tuple(lerp(trun[i], axle[i], 0.50) for i in range(3))

    bm = bmesh.new()
    bm_box(bm, 0.0, 6.55, -0.06, 0.34, 0.42, 0.30)
    tube(bm, trun, mid, 0.075, 0.068, 10)
    tube(bm, (0.0, 6.43, -0.96), (0.0, 7.02, -0.26), 0.036, 0.036, 8)
    ob = new_object(bm, "noseleg")
    bevel(ob, 0.012, 1)
    out.append((ob, GREY))

    bm = bmesh.new()
    tube(bm, mid, (axle[0], axle[1], axle[2] + 0.02), 0.052, 0.048, 10)
    out.append((new_object(bm, "noseoleo", smooth=True), STEEL))

    bm = bmesh.new()
    scissor(bm, (0.0, 6.29, -0.92), (0.0, 6.24, -1.52), (0.0, -0.15, 0.0))
    tube(bm, (-0.26, axle[1], axle[2]), (0.26, axle[1], axle[2]), 0.038, 0.038, 8)
    out.append((new_object(bm, "noselink"), GREY))

    bm = bmesh.new()
    rows = []
    for k in range(7):
        a = math.radians(lerp(-45.0, 55.0, k / 6.0))
        y = axle[1] + math.sin(a) * 0.44
        z = axle[2] + 0.30 + math.cos(a) * 0.36
        rows.append([(-0.34, y, z), (0.34, y, z),
                     (0.34, y, z + 0.035), (-0.34, y, z + 0.035)])
    skin(bm, rows, cap0=True, cap1=True)
    out.append((new_object(bm, "nosedeflector", smooth=True), GREY))

    bm = bmesh.new()
    for s in (-1, 1):
        tube(bm, (s * 0.12, axle[1], axle[2]), (s * 0.23, axle[1], axle[2]),
             0.16, 0.16, 12)
    out.append((new_object(bm, "nosehub", smooth=True), HUB))

    bm = bmesh.new()
    for s in (-1, 1):
        wheel(bm, s * 0.22, axle[1], axle[2], 0.10, 0.30, 12)
    out.append((new_object(bm, "nosetyre", smooth=True), TYRE))
    return out


def gear_doors():
    """The nose bay doors, which belong to the gear so they fold away with it."""
    bm = bmesh.new()
    for s in (-1, 1):
        rows = []
        for y in (6.02, 7.08):
            rows.append([(s * 0.12, y, bottom_z(y, 0.12) - 0.01),
                         (s * 0.48, y, bottom_z(y, 0.48) - 0.01),
                         (s * 0.48, y, bottom_z(y, 0.48) - 0.06),
                         (s * 0.12, y, bottom_z(y, 0.12) - 0.06)])
        skin(bm, rows, cap0=True, cap1=True)
    ob = new_object(bm, "geardoors")
    bevel(ob, 0.010, 1)
    return [(ob, MAROON)]


def blade_aerial(bm, cy, base, h, ln, down=False):
    s = -1.0 if down else 1.0
    rings = []
    for f, back in ((0.0, 0.0), (0.55, 0.09), (1.0, 0.22)):
        t = 0.032 * (1.0 - f * 0.7)
        z = base + s * h * f
        rings.append([(t, cy - back + ln * 0.5 * (1.0 - f * 0.5), z),
                      (t, cy - back - ln * 0.5, z),
                      (-t, cy - back - ln * 0.5, z),
                      (-t, cy - back + ln * 0.5 * (1.0 - f * 0.5), z)])
    skin(bm, rings, cap0=True, cap1=True)


def aerials():
    """Blades, a teardrop, beacons, pitots and the nav lights. All small, all
    dark, and all of them things you only notice when they are not there."""
    out = []
    bm = bmesh.new()
    blade_aerial(bm, 6.10, roof_top(6.10) - 0.02, 0.42, 0.26)
    blade_aerial(bm, -4.60, crown_at(-4.60) + dorsal_rise(-4.60) - 0.02, 0.34, 0.22)
    blade_aerial(bm, 3.10, bottom_z(3.10, 0.0) + 0.02, 0.36, 0.24, down=True)
    out.append((new_object(bm, "blades"), DARK))

    bm = bmesh.new()
    bm_ball(bm, 0.0, -3.30, crown_at(-3.30) + dorsal_rise(-3.30) - 0.02,
            0.12, 0.275, 0.11, rows=6, seg=12, squash_bottom=0.3)
    out.append((new_object(bm, "adf", smooth=True), DARK))

    bm = bmesh.new()
    for side in (-1, 1):
        p = (side * 0.72, 8.55, 1.62)
        tube(bm, (side * skin_x(8.55, 1.62), 8.55, 1.62), p, 0.022, 0.018, 8)
        tube(bm, p, (p[0], p[1] + 0.32, p[2] + 0.05), 0.018, 0.014, 8)
    tube(bm, (0.55, 7.90, 2.08), (0.63, 7.90, 2.30), 0.020, 0.016, 8)
    tube(bm, (0.0, 9.62, 1.16), (0.0, 9.80, 1.16), 0.045, 0.038, 8)
    out.append((new_object(bm, "masts"), GREY))

    bm = bmesh.new()
    bm_ball(bm, 0.0, -3.90, crown_at(-3.90) + dorsal_rise(-3.90) + 0.04,
            0.08, 0.08, 0.09, rows=5, seg=10)
    bm_ball(bm, 0.0, 0.20, bottom_z(0.20, 0.0) - 0.03, 0.08, 0.08, 0.09,
            rows=5, seg=10)
    out.append((new_object(bm, "beacons", smooth=True), RED))

    _c, le, zc, _t = wing_geom(14.30)
    for side, colour, name in ((-1, RED, "navL"), (1, GREEN, "navR")):
        bm = bmesh.new()
        bm_ball(bm, side * 14.36, le - 0.24, zc + 0.30, 0.05, 0.10, 0.055,
                rows=5, seg=8)
        out.append((new_object(bm, name, smooth=True), colour))
    return out


# --------------------------------------------------------------------------- #
#  assembly                                                                    #
# --------------------------------------------------------------------------- #

def aircraft():
    topsides, planing, tailcone, roof = hull()
    fl = {s: floats(s) for s in (-1, 1)}
    fp = {s: flaps(s) for s in (-1, 1)}

    body = [(topsides, YELLOW), (tailcone, YELLOW), (roof, YELLOW)]
    body += spray_strakes() + cheatline() + bow_band()
    body += [(anti_glare(), BLACK)]
    body += registration("811") + hull_furniture() + panel_lines() + aerials()

    wing_items = wing() + flap_tracks()
    for s in (-1, 1):
        wing_items += fl[s][2:] + winglet(s) + fp[s][1:]

    return [
        {"name": "body", "parent": None, "pivot": (0.0, 0.0, 0.0),
         "items": body},
        {"name": "hullBottom", "parent": "body", "pivot": (0.0, 0.0, -0.60),
         "items": [(planing, MAROON)]},
        {"name": "wing", "parent": "body", "pivot": (0.0, 0.0, WING_Z0),
         "items": wing_items},
        {"name": "fin", "parent": "body", "pivot": (0.0, -4.10, FIN_Z0),
         "items": fin()},
        {"name": "stab", "parent": "body", "pivot": (0.0, -5.45, STAB_Z),
         "items": stab()},
        {"name": "windscreen", "parent": "body", "pivot": (0.0, 7.00, 2.10),
         "items": glazing()},
        {"name": "floatL", "parent": "body", "pivot": (-FLOAT_X, 0.0, 2.20),
         "items": fl[-1][:2]},
        {"name": "floatR", "parent": "body", "pivot": (FLOAT_X, 0.0, 2.20),
         "items": fl[1][:2]},

        {"name": "nacelleL", "parent": "body", "pivot": (-NAC_X, 2.00, NAC_Z),
         "items": nacelle(-1)},
        {"name": "nacelleR", "parent": "body", "pivot": (NAC_X, 2.00, NAC_Z),
         "items": nacelle(1)},
        {"name": "propL", "parent": "nacelleL", "pivot": (-NAC_X, 5.80, NAC_Z),
         "items": propeller(-1)},
        {"name": "propR", "parent": "nacelleR", "pivot": (NAC_X, 5.80, NAC_Z),
         "items": propeller(1)},

        {"name": "aileronL", "parent": "body", "pivot": (-9.00, 0.05, 2.86),
         "items": ailerons(-1)},
        {"name": "aileronR", "parent": "body", "pivot": (9.00, 0.05, 2.86),
         "items": ailerons(1)},
        {"name": "flapL", "parent": "body", "pivot": (-1.90, -0.37, 2.62),
         "items": fp[-1][:1]},
        {"name": "flapR", "parent": "body", "pivot": (1.90, -0.37, 2.62),
         "items": fp[1][:1]},
        {"name": "elevator", "parent": "body", "pivot": (0.0, -7.35, 2.85),
         "items": elevator()},
        {"name": "rudder", "parent": "body", "pivot": (0.0, -7.23, 3.20),
         "items": rudder()},

        {"name": "doorFL", "parent": "body", "pivot": (-0.16, 0.90, -1.08),
         "items": water_door(-1, 0.90)},
        {"name": "doorAL", "parent": "body", "pivot": (-0.16, -0.60, -1.08),
         "items": water_door(-1, -0.60)},
        {"name": "doorFR", "parent": "body", "pivot": (0.16, 0.90, -1.08),
         "items": water_door(1, 0.90)},
        {"name": "doorAR", "parent": "body", "pivot": (0.16, -0.60, -1.08),
         "items": water_door(1, -0.60)},

        {"name": "probeL", "parent": "body", "pivot": (-0.62, -1.65, -1.12),
         "items": probe(-1)},
        {"name": "probeR", "parent": "body", "pivot": (0.62, -1.65, -1.12),
         "items": probe(1)},

        {"name": "gear", "parent": "body", "pivot": (0.0, 0.0, 0.0),
         "items": gear_doors()},
        {"name": "gearNose", "parent": "gear", "pivot": (0.0, 6.55, -0.10),
         "items": gear_nose()},
        {"name": "gearMainL", "parent": "gear", "pivot": (-1.62, 1.10, -0.20),
         "items": gear_main(-1)},
        {"name": "gearMainR", "parent": "gear", "pivot": (1.62, 1.10, -0.20),
         "items": gear_main(1)},
    ]


def main():
    reset_scene()
    print("building the Canadair CL-415, candidate B")
    parts = aircraft()
    for p in parts:
        coll = bpy.data.collections.new(p["name"])
        bpy.context.scene.collection.children.link(coll)
        for ob, _ in p["items"]:
            for c in ob.users_collection:
                c.objects.unlink(ob)
            coll.objects.link(ob)
    export_rig(parts, OUT, "Canadair CL-415 811")

    from preview import turntable  # noqa: E402
    turntable([it for p in parts for it in p["items"]], PREVIEW, span=32.0)


main()
