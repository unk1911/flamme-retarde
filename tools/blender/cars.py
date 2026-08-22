"""Bake the five cars that stand in the wood behind Jadrija.

    tools/blender/blender.sh --background --python tools/blender/cars.py
    tools/blender/blender.sh --background --python tools/blender/cars.py -- --preview

Writes, for each of five body types, ``build/payload/car_<name>.fr3d.gz`` and
``build/payload/car_<name>_trim.fr3d.gz``, plus one sidecar
``build/payload/cars.json`` holding the extents. ``build.py`` inlines all three
kinds; the ``.json`` goes in verbatim, so ``PAYLOAD.cars`` is a plain object the
shore build can read **synchronously** — which it has to, because the walk
blockers are pushed hundreds of lines before any blob is inflated.

── why these are modelled rather than downloaded ─────────────────────────────

There is no glTF parser in the bundle and that is deliberate (see the header of
``src/48-landmarks.js``), so every shelf model would have to come through
Blender and out as .fr3d anyway — Blender is in the loop either way and the only
question is whether the vertices arrive from a shelf or from bmesh. The shelf
ones arrive wrong: the shading path here is one flat colour per object and
nothing else, while every downloadable car ships a texture atlas; the free
low-poly car packs are toy cars with cartoon proportions in a world where the
cathedral is 38.5 m because the cathedral is 38.5 m; and a bmesh car is 6–10 KB
gzipped where a GLB with textures is 300 KB–2 MB *each*. Nothing was
downloaded and there is no third-party asset in this tree.

── two blobs per car, and this is not optional ───────────────────────────────

The instanced prop shader does ``vColor = aInstColor`` and then ``base *=
vVCol``, so the per-instance colour multiplies **everything** in the mesh. One
blob per car means the paint colour also tints the headlamps, the glass and the
tyres — pick dark blue for a car and its lamps go dark blue with it.
``carNearProto`` in ``src/37-props.js`` has exactly this flaw and gets away with
it only because its lamps are three boxes seen at 300 m. These are seen from two
metres.

So each car comes out as two meshes. ``car_<name>`` is every painted surface
with its vertex colours set to **white**, drawn on a layer whose ``aInstColor``
carries the paint. ``car_<name>_trim`` is glass, tyres, rims, bumpers, lamps,
plates, the underside, the roof rails and the roofbox in their real colours,
drawn on a second layer whose ``aInstColor`` is all 1.0.

── what the five are, and why ────────────────────────────────────────────────

Body types, not marques, and they come off the user's own walk-throughs
(``1000149595.mp4``, ``1000149597.mp4``) rather than off a guess about what an
old Dalmatian car park holds. The footage shows the row under the olives is
white and silver modern superminis and small crossovers, one dark blue tall
small MPV, one small white panel van, and exactly one older squarer red hatch.
That is what is here: ``supermini``, ``crossover``, ``estate``, ``van``,
``oldhatch``, and the paint palettes in ``src/44-cars.js`` are weighted the same
way — heavily toward white.

── how a body is built ───────────────────────────────────────────────────────

Not as boxes. The body is a **loft along X**: a stack of superelliptical rings,
one per station, skinned. Every station carries its own sill height, waist
height, belt height and three half-widths, and every one of those is sampled off
a piecewise-linear table per model, so a car's profile is six short lists of
knots rather than sixteen hand-typed rows.

The single thing that makes it read as a car rather than as a shoebox with
wheels leaned against it is that **the sill rises at the axles**. Without that
the bottom edge runs dead straight from bumper to bumper, the tyres hang off the
outside of it, and the eye reads them as separate objects. The body has to come
down around the wheel and lift over it. ``carNearProto``'s ``BSTN`` table was
tuned against exactly this complaint and the arch shape here is taken from it.

The greenhouse is a second loft whose first and last stations are flat slivers
on the belt line, so the surface between them *is* the windscreen and the
backlight — a real raked pane, not a dark stripe painted on a box. Its lower
edge is the body's own belt line by construction, sampled from the same table,
which is what keeps the two from parting company. Its underside is dropped,
being buried inside the body.

The van is the one that does not fit that. Its roof *is* the body: the belt line
climbs the windscreen rake and stays up. So it has no greenhouse at all — its
screen is a region of the body's own loft handed to the glass bucket, which
costs nothing and is flush by construction, and its two cab windows are quads
standing 12 mm proud of a flank that genuinely is flat.

Nothing here is a box laid over a curve. That was the first cut, and a bumper
across a rounded nose shows its own square corners sticking out either side.

Blender +X is the nose, +Z is up, the origin is the wheelbase centre and z = 0
is the ground. ``gather()`` maps ``(bx, by, bz) -> (bx, bz, -by)``, so the model
arrives in the game with +X still the nose and +Y up, which is what the shore
build's ``atan2`` assumes when it turns the row to face the sea.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore

sys.path.append(str(Path(__file__).resolve().parent))

from frmesh import TAU, export, new_object, reset_scene  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "build" / "payload"


# --------------------------------------------------------------------- paint --
#
# One entry per bucket: the colour it bakes at, whether it is smooth-shaded, and
# which of the two blobs it belongs to. `paint` is white on purpose — see the
# header. Everything else is the same on every car in the row, which is true:
# tyres, glass and number plates do not come in the body colour.

WHITE = (1.000, 1.000, 1.000)
GLASS = (0.105, 0.130, 0.155)
TYRE = (0.068, 0.068, 0.076)
RIM = (0.615, 0.628, 0.645)
DARK = (0.170, 0.172, 0.182)      # bumpers, mirror shells, grille, sill trim
UNDER = (0.090, 0.090, 0.096)     # the floor pan, seen only from a low camera
LAMP = (0.800, 0.790, 0.720)      # headlamp, warm and slightly amber
TAILL = (0.480, 0.080, 0.070)
PLATE = (0.870, 0.875, 0.870)
BOXC = (0.235, 0.240, 0.250)      # the roofbox, matt charcoal
RAILC = (0.330, 0.335, 0.345)     # roof rails, anodised

BUCKETS = {
    "paint": (WHITE, True, "body"),
    "glass": (GLASS, True, "trim"),
    "tyre": (TYRE, True, "trim"),
    "rim": (RIM, False, "trim"),
    "dark": (DARK, False, "trim"),
    "under": (UNDER, False, "trim"),
    "lamp": (LAMP, False, "trim"),
    "tail": (TAILL, False, "trim"),
    "plate": (PLATE, False, "trim"),
    "box": (BOXC, True, "trim"),
    "rail": (RAILC, False, "trim"),
}


# ------------------------------------------------------------------- profile --

def pw(knots, x):
    """Sample a piecewise-linear table of ``(x, value)``, nose first.

    The tables run from the nose (largest x) back to the tail, because that is
    the order a car is described in and the order the stations come out in.
    Outside the ends it clamps: a station is never asked for past the bumper.
    """
    if x >= knots[0][0]:
        return knots[0][1]
    for i in range(len(knots) - 1):
        a, b = knots[i], knots[i + 1]
        if x >= b[0]:
            k = (a[0] - x) / ((a[0] - b[0]) or 1.0)
            return a[1] + (b[1] - a[1]) * k
    return knots[-1][1]


def sill_at(spec, x):
    """Where the bottom edge of the flank is at station ``x``.

    Three things happen to it. It sits at ``sill`` down the middle; it lifts to
    ``arch`` over each axle, on a squared falloff so the crown is round rather
    than pointed; and it lifts again over the last 0.34 m at each end, which is
    the approach and departure angle and the reason a bumper does not scrape.
    """
    lo, hi, span = spec["sill"], spec["arch"], spec["arch_span"]
    z = lo
    for ax in spec["axles"]:
        d = abs(x - ax)
        if d < span:
            u = 1.0 - (d / span) ** 2
            z = max(z, lo + (hi - lo) * u)
    for end, sign in ((spec["x1"], 1.0), (spec["x0"], -1.0)):
        d = (end - x) * sign
        if d < 0.34:
            u = (0.34 - d) / 0.34
            z = max(z, lo + (spec["end_sill"] - lo) * u * u)
    return z


def station(spec, x):
    """One cross-section: the six numbers a ring needs, plus its x."""
    zs = sill_at(spec, x)
    zb = pw(spec["belt"], x)
    hw = pw(spec["hw"], x)
    hwb = pw(spec["hwb"], x)
    zw = zs + (zb - zs) * spec["waist"]
    return (x, zs, zw, zb, hw * spec["sill_frac"], hw, hwb)


def ring(st, seg, power):
    """One closed superelliptical ring in the (y, z) plane, as ``(y, z, uz)``.

    A true ellipse (power 2) gives a section like a barrel, which no car has;
    at 3.0–4.5 the shoulder squares off and the flank goes nearly vertical,
    which is what a car actually is. The upper and lower halves get their own
    radius and their own half-width, so the section can be a tall tuck-under
    below the waist and a short flat shoulder above it.

    ``uz`` is the signed superellipse height, −1 at the sill and +1 at the belt.
    It is handed back because the face classifier reads it: it is the only thing
    that says which strip of the loft is roof, which is flank and which is the
    underside, without anyone counting segments by hand.
    """
    _x, zs, zw, zb, hw_s, hw_w, hw_b = st
    e = 2.0 / power
    out = []
    for i in range(seg):
        a = TAU * i / seg
        c, s = math.cos(a), math.sin(a)
        sc = math.copysign(abs(c) ** e, c)
        ss = math.copysign(abs(s) ** e, s)
        if ss >= 0.0:
            z = zw + ss * (zb - zw)
            w = hw_w + ss * (hw_b - hw_w)
        else:
            z = zw + ss * (zw - zs)
            w = hw_w + (-ss) * (hw_s - hw_w)
        out.append((sc * w, z, ss))
    return out


def flank_hw(st, z, power):
    """Half-width of a section at a given height — the inverse of ``ring``.

    Needed by the van's glass panels, which are rectangles laid on a flank and
    have to know how far out the flank is at the top and bottom of the window.
    Doing it by inverting the same superellipse rather than by guessing is what
    stops a window floating a centimetre off the door.
    """
    _x, zs, zw, zb, hw_s, hw_w, hw_b = st
    if z >= zw:
        u = min(1.0, (z - zw) / ((zb - zw) or 1e-6))
        w = hw_w + u * (hw_b - hw_w)
    else:
        u = min(1.0, (zw - z) / ((zw - zs) or 1e-6))
        w = hw_w + u * (hw_s - hw_w)
    return w * (max(0.0, 1.0 - u ** power)) ** (1.0 / power)


def station_xs(spec):
    """Where to cut the body, nose first.

    Five stations around each axle rather than one: the crown of the arch, the
    two shoulders of it and the two points where it meets the sill again. That
    cluster is the wheel arch, and it is the only part of the station list that
    is not free to move.
    """
    x0, x1 = spec["x0"], spec["x1"]
    span = spec["arch_span"]
    xs = {x0, x1, x0 + 0.20, x1 - 0.20, (x0 + x1) * 0.5}
    for ax in spec["axles"]:
        for d in (-1.0, -0.55, 0.0, 0.55, 1.0):
            xs.add(round(ax + d * span, 4))
    xs.update(spec.get("extra_x", ()))
    # Deduplicated with a tolerance: an `extra_x` asked for near the shoulder of
    # an arch would otherwise leave a 10 mm strip of loft, which is 32 wasted
    # triangles and a hairline the smoothing has to work around.
    out = []
    for x in sorted((x for x in xs if x0 - 1e-6 <= x <= x1 + 1e-6), reverse=True):
        if not out or out[-1] - x > 0.035:
            out.append(x)
    return out


def recoloured(spec, xm, uz):
    """Repaint a patch of the body loft without adding any geometry to it.

    A bumper is not a plank bolted to the front: it wraps the corners, and a box
    across a rounded nose shows its own square corners sticking out either side
    of the body. So the bumper — and the van's windscreen, which is a pane on
    the body's own rake and not a flap hovering over it — is a *region* of the
    loft that comes out of a different bucket. Zero extra triangles, no
    z-fighting, and it follows the section however the profile is retuned.

    ``(bucket, x_lo, x_hi, uz_lo, uz_hi)``, first match wins.
    """
    for bucket, xa, xb, ua, ub in spec.get("recolour", ()):
        if xa <= xm <= xb and ua <= uz <= ub:
            return bucket
    return None


# ---------------------------------------------------------------------- sink --

class Sink:
    """One bmesh per bucket, with vertices welded by position.

    Welding matters: a lofted surface whose faces do not share vertices cannot
    be smooth-shaded, because there is nothing for the normals to average over.
    Welding *within* a bucket and never across one is also what puts the hard
    crease exactly where it belongs — the sill, where paint meets the dark
    underside, is a bucket boundary and so is automatically a hard edge, while
    the shoulder inside the paint is smooth until EDGE_SPLIT decides otherwise.
    """

    def __init__(self):
        self.bm = {k: bmesh.new() for k in BUCKETS}
        self.cache = {k: {} for k in BUCKETS}

    def v(self, bucket, p):
        key = (round(p[0], 4), round(p[1], 4), round(p[2], 4))
        c = self.cache[bucket]
        hit = c.get(key)
        if hit is None:
            hit = c[key] = self.bm[bucket].verts.new(key)
        return hit

    def face(self, bucket, pts):
        """A polygon, with coincident corners collapsed out of it first.

        The flat end stations of a greenhouse are 12 mm slivers and the caps of
        a loft come to a point, so a quad arriving as a triangle is normal here
        and is not a bug worth raising over.
        """
        vs = []
        for p in pts:
            w = self.v(bucket, p)
            if not vs or (vs[-1] is not w and vs[0] is not w):
                vs.append(w)
        if len(vs) < 3:
            return
        try:
            self.bm[bucket].faces.new(vs)
        except ValueError:
            pass                                  # the same face twice; harmless

    def box(self, bucket, cx, cy, cz, sx, sy, sz):
        hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
        c = [(cx + i * hx, cy + j * hy, cz + k * hz)
             for i, j, k in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                             (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
        for q in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
                  (2, 6, 7, 3), (1, 5, 6, 2), (3, 7, 4, 0)):
            self.face(bucket, [c[i] for i in q])

    def objects(self):
        """``{bucket: (object, colour)}`` for the buckets that got any faces."""
        out = {}
        for k, bm in self.bm.items():
            if not bm.faces:
                bm.free()
                continue
            colour, smooth, _blob = BUCKETS[k]
            ob = new_object(bm, "car_" + k, smooth=smooth)
            if smooth:
                # 38°, so the shoulder of a superelliptical section stays smooth
                # and the crease where the arch turns under stays a crease. In
                # Blender 4.0 `use_auto_smooth` is gone; the modifier is not.
                m = ob.modifiers.new("split", "EDGE_SPLIT")
                m.split_angle = math.radians(38.0)
                m.use_edge_angle = True
                m.use_edge_sharp = False
            out[k] = (ob, colour)
        return out


# ---------------------------------------------------------------------- body --

def build_body(spec, sink):
    """The loft from the sill to the belt line, plus its two end caps."""
    seg, power = spec["seg"], spec["power"]
    sts = [station(spec, x) for x in station_xs(spec)]
    rings = [ring(st, seg, power) for st in sts]

    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        xa, xb = sts[j][0], sts[j + 1][0]
        xm = (xa + xb) * 0.5
        for i in range(seg):
            k = (i + 1) % seg
            uz = (A[i][2] + A[k][2]) * 0.5
            bucket = ("under" if uz <= -0.86
                      else recoloured(spec, xm, uz) or "paint")
            sink.face(bucket, [
                (xa, A[k][0], A[k][1]), (xb, B[k][0], B[k][1]),
                (xb, B[i][0], B[i][1]), (xa, A[i][0], A[i][1]),
            ])

    # The caps. A fan to the centre of the section rather than an n-gon, so the
    # bevel of the shoulder carries round the nose instead of stopping at it.
    for st, rg, front in ((sts[0], rings[0], True), (sts[-1], rings[-1], False)):
        x, zs, _zw, zb = st[0], st[1], st[2], st[3]
        hub = (x, 0.0, (zs + zb) * 0.5)
        for i in range(seg):
            k = (i + 1) % seg
            uz = (rg[i][2] + rg[k][2]) * 0.5
            bucket = ("under" if uz <= -0.86
                      else recoloured(spec, x, uz) or "paint")
            a = (x, rg[i][0], rg[i][1])
            b = (x, rg[k][0], rg[k][1])
            sink.face(bucket, [hub, a, b] if front else [hub, b, a])
    return sts


def build_greenhouse(spec, sink):
    """The glasshouse: windscreen, side glazing, roof, backlight.

    Its lower edge is the body's own belt line, sampled from the same table, so
    the two cannot part company however the profile is retuned. The first and
    last stations are 12 mm slivers on that line, which is what makes the strip
    between the sliver and the next station *be* the windscreen rather than a
    dark rectangle stuck on a box.
    """
    gh = spec.get("gh")
    if not gh:
        return
    seg = spec["seg"]
    power = spec["gh_power"]
    sts = []
    for x, ztop, hw, hwt in gh:
        zlo = pw(spec["belt"], x)
        if ztop is None:
            ztop = zlo + 0.012
            hwt = hw
        zw = zlo + (ztop - zlo) * 0.52
        sts.append((x, zlo, zw, ztop, hw * 0.985, hw, hwt))
    rings = [ring(st, seg, power) for st in sts]
    last = len(rings) - 2

    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        xa, xb = sts[j][0], sts[j + 1][0]
        interior = 0 < j < last or (j == last and not spec.get("gh_back", True))
        for i in range(seg):
            k = (i + 1) % seg
            uz = (A[i][2] + A[k][2]) * 0.5
            if uz <= -0.55:
                continue                     # the floor of it, buried in the body
            # 0.58, not 0.72. At 0.72 the roof came out as a white rectangle in
            # the middle of a dark one: the shoulder of the section is spread
            # over two strips, and leaving the outer one as glass puts a 21 cm
            # band of window along each side of the roof. A car has a drip rail
            # there and paint above it. With `gh_power` at 4.2 the corner is
            # tight enough that one strip is the whole transition, and what is
            # left as glass is the 9 cm the side window actually curves through.
            if uz >= 0.58 and interior:
                bucket = "paint"             # the roof
            else:
                bucket = "glass"
            sink.face(bucket, [
                (xa, A[k][0], A[k][1]), (xb, B[k][0], B[k][1]),
                (xb, B[i][0], B[i][1]), (xa, A[i][0], A[i][1]),
            ])


def build_panels(spec, sink):
    """Flat glazing laid on a flank — the van's two cab windows.

    A panel van's cab window is a rectangle in a flat side, and lofting a
    greenhouse round the shape of a van produces a triangular side window and a
    cab roof that fights the box behind it. A quad standing 12 mm proud of the
    flank is simpler and closer to the thing; the four corners come off
    ``flank_hw``, so the pane sits on the door however the profile is retuned
    rather than floating a centimetre off it.

    The windscreen is *not* one of these. It is a ``recolour`` of the body's own
    rake — see the note there.
    """
    for p in spec.get("glass_panels", ()):
        xa, xb = p["x"]
        z0, z1 = p["z"]
        out = p.get("out", 0.012)
        for sgn in (1, -1):
            pts = []
            for x, z in ((xa, z0), (xb, z0), (xb, z1), (xa, z1)):
                st = station(spec, x)
                y = flank_hw(st, z, spec["power"]) + out
                pts.append((x, sgn * y, z))
            if sgn < 0:
                pts.reverse()
            sink.face("glass", pts)


# -------------------------------------------------------------------- wheels --

def build_wheels(spec, sink):
    """Four wheels, twelve-sided, outer face only.

    Nothing ever sees the inside of a wheel arch and this is geometry that gets
    drawn seventy times, so the inner sidewall and the hidden half of the tread
    are simply not built. Track comes out of the profile rather than being typed
    in: the outer wall of the tyre sits 30 mm inboard of the sill, which is
    where a wheel actually lives — at the sill line it stands proud and the car
    reads as a tractor.
    """
    r, hw = spec["wheel"]
    n = 12
    rim_r = r * 0.60
    for ax in spec["axles"]:
        st = station(spec, ax)
        outer = st[4] - 0.030                        # hw_sill, minus the tuck
        inner = outer - hw * 2.0
        for sgn in (1, -1):
            yo, yi = sgn * outer, sgn * inner
            for i in range(n):
                a0, a1 = TAU * i / n, TAU * (i + 1) / n
                p0 = (ax + math.cos(a0) * r, r + math.sin(a0) * r)
                p1 = (ax + math.cos(a1) * r, r + math.sin(a1) * r)
                q0 = (ax + math.cos(a0) * rim_r, r + math.sin(a0) * rim_r)
                q1 = (ax + math.cos(a1) * rim_r, r + math.sin(a1) * rim_r)
                # Tread, sidewall annulus, and a dished rim 10 mm proud of it so
                # the two never share a plane and never z-fight.
                sink.face("tyre", [(p0[0], yi, p0[1]), (p1[0], yi, p1[1]),
                                   (p1[0], yo, p1[1]), (p0[0], yo, p0[1])])
                sink.face("tyre", [(p0[0], yo, p0[1]), (p1[0], yo, p1[1]),
                                   (q1[0], yo, q1[1]), (q0[0], yo, q0[1])])
                sink.face("rim", [(ax, yo + sgn * 0.010, r),
                                  (q0[0], yo + sgn * 0.010, q0[1]),
                                  (q1[0], yo + sgn * 0.010, q1[1])])


# ------------------------------------------------------------------- details --

def build_details(spec, sink):
    """Bumpers, lamps, plates, mirrors, rails, roofbox.

    Small, and they are what tells you which end of a parked car you are looking
    at — which is most of what a car park is read by. Everything here is sized
    and placed off the profile tables, so retuning a body does not leave its
    lamps hanging in the air.
    """
    x0, x1 = spec["x0"], spec["x1"]

    # The bumper is not built here at all — it is a `recolour` region of the
    # body's own loft, added in `build_car`. What is left is the small stuff
    # that has to stand proud of the end cap to be seen: the cap is a flat disc
    # at x0 / x1, so anything sitting entirely behind it is invisible, and the
    # first cut had the number plates buried 3 cm inside the bumper.
    for end, sgn, lampb in ((x1, 1.0, "lamp"), (x0, -1.0, "tail")):
        st = station(spec, end - sgn * 0.10)
        hw, zs, zb = st[5], st[1], st[3]
        zc = zs + (zb - zs) * 0.28
        # Lamps, inboard of the corner and sitting on top of the bumper band.
        zl = zs + (zb - zs) * 0.66
        for side in (1, -1):
            sink.box(lampb, end - sgn * 0.030, side * hw * 0.66, zl,
                     0.11, hw * 0.40, (zb - zs) * 0.21)
        # Number plate. Croatian plates are white with a blue strip; at this
        # range it is a pale rectangle, and a car park with no plates on it
        # reads as a showroom.
        sink.box("plate", end - sgn * 0.012, 0.0, zc,
                 0.05, 0.520, 0.112)

    # Mirrors, on the A-pillar base. Two boxes: the arm and the shell.
    mx = spec["mirror_x"]
    st = station(spec, mx)
    my = st[5] + 0.085
    mz = pw(spec["belt"], mx) + 0.045
    for side in (1, -1):
        sink.box("dark", mx, side * (st[5] + 0.030), mz, 0.060, 0.070, 0.060)
        sink.box("dark", mx - 0.015, side * my, mz + 0.014, 0.130, 0.085, 0.105)

    # A dark sill strip along the bottom of each door, which every car in the
    # footage has and which is what stops the flank being one flat sheet of
    # paint from the arch to the belt.
    sa, sb = spec["rocker"]
    for side in (1, -1):
        for i in range(6):
            xa = sa + (sb - sa) * (i / 6.0)
            xb = sa + (sb - sa) * ((i + 1) / 6.0)
            pts = []
            for x, dz in ((xa, 0.0), (xb, 0.0), (xb, 0.085), (xa, 0.085)):
                stx = station(spec, x)
                z = stx[1] + 0.030 + dz
                y = flank_hw(stx, z, spec["power"]) + 0.008
                pts.append((x, side * y, z))
            if side < 0:
                pts.reverse()
            sink.face("dark", pts)

    rails = spec.get("rails")
    if rails:
        rx0, rx1, ry, rz, rh = rails
        for side in (1, -1):
            sink.box("rail", (rx0 + rx1) * 0.5, side * ry, rz + rh * 0.5,
                     abs(rx1 - rx0), 0.055, rh)

    bx = spec.get("roofbox")
    if bx:
        # A roofbox is a lozenge, not a crate: five stations, tapered and
        # rounded at both ends. August, and half the cars that come down here
        # come with the whole flat wearing one.
        bx0, bx1, bhw, bz0, bz1 = bx
        n = 6
        seg = 10
        prev = None
        prevx = None
        for i in range(n + 1):
            u = i / n
            x = bx0 + (bx1 - bx0) * u
            # A soft taper toward both ends, and it acts on the width and on the
            # *top* only. Scaling the height about the centre as well — which
            # the first cut did — lifts the ends off the rails and the box comes
            # out as a lens hovering over the roof.
            f = math.sin(math.pi * min(1.0, max(0.0, u * 1.24 - 0.12))) ** 0.18
            hwb = bhw * max(0.30, f)
            hh = (bz1 - bz0) * 0.5 * max(0.34, f)
            zc = bz0 + hh
            rg = []
            for k in range(seg):
                a = TAU * k / seg
                c, s = math.cos(a), math.sin(a)
                e = 2.0 / 3.4
                rg.append((math.copysign(abs(c) ** e, c) * hwb,
                           zc + math.copysign(abs(s) ** e, s) * hh))
            if prev is not None:
                for k in range(seg):
                    m = (k + 1) % seg
                    sink.face("box", [(prevx, prev[m][0], prev[m][1]),
                                      (x, rg[m][0], rg[m][1]),
                                      (x, rg[k][0], rg[k][1]),
                                      (prevx, prev[k][0], prev[k][1])])
            prev, prevx = rg, x


# -------------------------------------------------------------------- models --
#
# Five body types. The dimensions are ordinary ones for the class — a supermini
# is 3.95 m because superminis are, not because any particular car in the
# footage was measured, which nothing in a handheld walk-through could support.

MODELS = [
    {
        "name": "supermini",
        # Five-door, the commonest thing in the row and the commonest thing on
        # a Croatian coast road in August.
        "x0": -1.915, "x1": 2.035, "axles": (-1.235, 1.235),
        "wheel": (0.295, 0.095), "arch_span": 0.42, "sill_frac": 0.945,
        "sill": 0.300, "arch": 0.615, "end_sill": 0.440,
        "waist": 0.58, "power": 3.2, "gh_power": 4.2, "seg": 16,
        "belt": [(2.035, 0.850), (1.680, 0.912), (1.050, 0.990),
                 (-0.800, 1.020), (-1.550, 1.000), (-1.915, 0.930)],
        # Blunt. Tapering the plan silhouette from the doors all the way to the
        # bumper — which the first cut did — gives a torpedo: a car holds its
        # width to within 20 cm of each end and then turns the corner.
        "hw": [(2.035, 0.700), (1.880, 0.792), (1.560, 0.836), (1.060, 0.848),
               (0.000, 0.850), (-1.300, 0.850), (-1.760, 0.822), (-1.915, 0.722)],
        "hwb": [(2.035, 0.628), (1.880, 0.724), (1.560, 0.782), (1.060, 0.808),
                (0.000, 0.820), (-1.300, 0.820), (-1.760, 0.772), (-1.915, 0.650)],
        "gh": [(0.950, None, 0.800, None), (0.280, 1.470, 0.805, 0.700),
               (-0.600, 1.470, 0.800, 0.710), (-1.140, 1.420, 0.782, 0.660),
               (-1.500, None, 0.745, None)],
        "mirror_x": 0.880, "rocker": (1.050, -1.060),
    },
    {
        "name": "crossover",
        # The small high-riding thing with roof rails: taller, bigger wheels,
        # more ground clearance, and the same footprint as the supermini plus
        # 30 cm. The footage has several, white and silver, and one dark blue.
        "x0": -2.090, "x1": 2.160, "axles": (-1.300, 1.300),
        "wheel": (0.325, 0.100), "arch_span": 0.46, "sill_frac": 0.940,
        "sill": 0.400, "arch": 0.720, "end_sill": 0.530,
        "waist": 0.56, "power": 3.1, "gh_power": 4.2, "seg": 16,
        "belt": [(2.160, 0.950), (1.780, 1.015), (1.120, 1.090),
                 (-0.800, 1.120), (-1.700, 1.100), (-2.090, 1.020)],
        "hw": [(2.160, 0.734), (2.000, 0.832), (1.640, 0.876), (1.120, 0.888),
               (0.000, 0.890), (-1.360, 0.890), (-1.900, 0.862), (-2.090, 0.756)],
        "hwb": [(2.160, 0.660), (2.000, 0.762), (1.640, 0.822), (1.120, 0.848),
                (0.000, 0.860), (-1.360, 0.860), (-1.900, 0.812), (-2.090, 0.682)],
        "gh": [(1.020, None, 0.840, None), (0.340, 1.620, 0.845, 0.740),
               (-0.660, 1.620, 0.840, 0.750), (-1.300, 1.570, 0.820, 0.700),
               (-1.680, None, 0.780, None)],
        "mirror_x": 0.960, "rocker": (1.120, -1.140),
        "rails": (0.300, -1.360, 0.545, 1.620, 0.060),
    },
    {
        "name": "estate",
        # Compact estate with the roof rails used, which in August they are.
        # The roof runs flat to a near-vertical tailgate, which is the one line
        # that separates an estate from a big hatchback at fifty metres.
        "x0": -2.320, "x1": 2.280, "axles": (-1.340, 1.340),
        "wheel": (0.315, 0.100), "arch_span": 0.44, "sill_frac": 0.945,
        "sill": 0.320, "arch": 0.660, "end_sill": 0.460,
        "waist": 0.58, "power": 3.3, "gh_power": 4.4, "seg": 16,
        "belt": [(2.280, 0.880), (1.900, 0.945), (1.180, 1.020),
                 (-0.800, 1.050), (-1.900, 1.040), (-2.320, 0.980)],
        "hw": [(2.280, 0.738), (2.120, 0.836), (1.720, 0.882), (1.180, 0.892),
               (0.000, 0.895), (-1.500, 0.895), (-2.140, 0.866), (-2.320, 0.762)],
        "hwb": [(2.280, 0.664), (2.120, 0.766), (1.720, 0.826), (1.180, 0.850),
                (0.000, 0.862), (-1.500, 0.865), (-2.140, 0.822), (-2.320, 0.700)],
        "gh": [(1.080, None, 0.840, None), (0.340, 1.500, 0.850, 0.760),
               (-0.700, 1.500, 0.850, 0.770), (-1.600, 1.492, 0.840, 0.760),
               (-2.020, 1.440, 0.820, 0.700), (-2.220, None, 0.760, None)],
        "mirror_x": 1.010, "rocker": (1.180, -1.180),
        "rails": (0.320, -1.700, 0.560, 1.500, 0.055),
        "roofbox": (0.560, -1.320, 0.335, 1.556, 1.906),
    },
    {
        "name": "van",
        # The small white panel van. Its roof is its body — the belt line runs
        # up the windscreen rake and stays at 1.84 to the back doors — so it
        # has no greenhouse at all. The screen is a `recolour` of the body's
        # own rake, which is the only way it can be flush with it: as a quad
        # laid over the rake it hung off the corners, because the top of a
        # section is a curve and only its centreline is at the belt height.
        # The two cab windows stay flat panes, on a flank that genuinely is
        # flat, positioned off `flank_hw` so they cannot float either.
        "x0": -2.140, "x1": 2.260, "axles": (-1.380, 1.380),
        "wheel": (0.315, 0.105), "arch_span": 0.44, "sill_frac": 0.945,
        "sill": 0.340, "arch": 0.690, "end_sill": 0.480,
        # Power 4.6 and a tail that keeps its width to the last 8 cm: at 3.6
        # the back of it came out as an egg, and the back of a panel van is a
        # pair of flat doors.
        "waist": 0.40, "power": 4.6, "gh_power": 3.6, "seg": 16,
        "belt": [(2.260, 0.930), (1.900, 1.000), (1.420, 1.050), (1.300, 1.062),
                 (1.120, 1.240), (0.950, 1.650), (0.820, 1.800), (0.600, 1.830),
                 (-1.900, 1.845), (-2.080, 1.820), (-2.140, 1.760)],
        "hw": [(2.260, 0.752), (2.080, 0.844), (1.700, 0.890), (1.180, 0.902),
               (0.000, 0.905), (-1.700, 0.905), (-2.060, 0.888), (-2.140, 0.834)],
        "hwb": [(2.260, 0.672), (2.080, 0.768), (1.700, 0.826), (1.180, 0.856),
                (0.600, 0.874), (0.000, 0.878), (-1.700, 0.878),
                (-2.060, 0.862), (-2.140, 0.808)],
        "extra_x": (1.300, 1.120, 0.950, 0.820, 0.600, 0.300),
        "gh": None,
        "recolour": (("glass", 0.800, 1.330, 0.400, 1.010),),
        "glass_panels": (
            {"kind": "side", "x": (0.720, 0.090), "z": (1.190, 1.610)},
        ),
        "mirror_x": 1.180, "rocker": (1.150, -1.400),
    },
    {
        "name": "oldhatch",
        # The one older, squarer, three-door car in the footage, and the only
        # one that is red. Shorter, narrower, lower, flatter-sided — a higher
        # superellipse power is most of what "square" means here — with an
        # upright screen and one long side window instead of two.
        "x0": -1.760, "x1": 1.900, "axles": (-1.180, 1.180),
        "wheel": (0.275, 0.085), "arch_span": 0.40, "sill_frac": 0.955,
        "sill": 0.300, "arch": 0.600, "end_sill": 0.420,
        "waist": 0.60, "power": 4.4, "gh_power": 4.8, "seg": 16,
        "belt": [(1.900, 0.840), (1.600, 0.890), (1.020, 0.950),
                 (-0.700, 0.968), (-1.500, 0.958), (-1.760, 0.900)],
        "hw": [(1.900, 0.688), (1.760, 0.756), (1.480, 0.788), (1.020, 0.798),
               (0.000, 0.800), (-1.200, 0.800), (-1.630, 0.774), (-1.760, 0.690)],
        "hwb": [(1.900, 0.622), (1.760, 0.700), (1.480, 0.748), (1.020, 0.764),
                (0.000, 0.772), (-1.200, 0.772), (-1.630, 0.734), (-1.760, 0.626)],
        "gh": [(0.900, None, 0.752, None), (0.360, 1.420, 0.755, 0.685),
               (-0.550, 1.420, 0.750, 0.685), (-1.100, 1.380, 0.732, 0.625),
               (-1.380, None, 0.688, None)],
        "mirror_x": 0.820, "rocker": (0.980, -0.980),
    },
]


# ---------------------------------------------------------------------- bake --

def build_car(spec):
    # The bumper bands, front and rear, as regions of the body rather than as
    # geometry. Written in here rather than into every model, because every car
    # has two of them in the same place relative to its own ends.
    spec = dict(spec)
    spec["recolour"] = (
        tuple(spec.get("recolour", ()))
        + (("dark", spec["x1"] - 0.30, spec["x1"] + 0.01, -0.90, -0.04),
           ("dark", spec["x0"] - 0.01, spec["x0"] + 0.30, -0.90, -0.04)))
    sink = Sink()
    build_body(spec, sink)
    build_greenhouse(spec, sink)
    build_panels(spec, sink)
    build_wheels(spec, sink)
    build_details(spec, sink)
    return sink.objects()


def extents(spec):
    """The four numbers the shore build needs before anything is inflated.

    ``x0``/``x1`` are the tail and nose in model space, so the caller can put
    the nose on a line and know where the tail lands; ``hw`` is the widest
    half-width, which is the car's extent along the shore because the row is
    parked nose-in; ``h`` is the overall height, for the walk blocker.
    """
    hw = max(v for _x, v in spec["hw"])
    h = max(pw(spec["belt"], x) for x, _v in spec["belt"])
    if spec.get("gh"):
        h = max(h, max(g[1] for g in spec["gh"] if g[1] is not None))
    if spec.get("roofbox"):
        h = max(h, spec["roofbox"][4])
    elif spec.get("rails"):
        h = max(h, spec["rails"][3] + spec["rails"][4])
    return {"x0": round(spec["x0"], 3), "x1": round(spec["x1"], 3),
            "hw": round(hw, 3), "h": round(h, 3)}


def build():
    preview = "--preview" in sys.argv
    meta = {}
    for spec in MODELS:
        reset_scene()
        parts = build_car(spec)
        body = [v for k, v in parts.items() if BUCKETS[k][2] == "body"]
        trim = [v for k, v in parts.items() if BUCKETS[k][2] == "trim"]
        export(body, OUT / ("car_%s.fr3d.gz" % spec["name"]), note=spec["name"])
        export(trim, OUT / ("car_%s_trim.fr3d.gz" % spec["name"]),
               note=spec["name"] + " trim")
        meta[spec["name"]] = extents(spec)
        e = meta[spec["name"]]
        print("[cars] %-10s %.2f m long, %.2f wide, %.2f tall"
              % (spec["name"], e["x1"] - e["x0"], e["hw"] * 2, e["h"]))
        if preview:
            from preview import turntable          # noqa: PLC0415
            turntable(body + trim,
                      "/tmp/claude-1000/cars_" + spec["name"], span=5.5)
    (OUT / "cars.json").write_text(json.dumps(meta, indent=1, sort_keys=True))
    print("[cars] wrote cars.json — %s" % ", ".join(sorted(meta)))


if __name__ == "__main__":
    build()
