"""Bake the five cars that stand in the wood behind Jadrija.

    tools/blender/blender.sh --background --python tools/blender/cars.py
    tools/blender/blender.sh --background --python tools/blender/cars.py -- --preview

Writes, for each of five body types, ``build/payload/car_<name>.fr3d.gz``,
``car_<name>_gloss.fr3d.gz`` and ``car_<name>_trim.fr3d.gz``, plus one sidecar
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

── three blobs per car, and this is not optional ─────────────────────────────

The instanced prop shader does ``vColor = aInstColor`` and then ``base *=
vVCol``, so the per-instance colour multiplies **everything** in the mesh. One
blob per car means the paint colour also tints the headlamps, the glass and the
tyres — pick dark blue for a car and its lamps go dark blue with it.
``carNearProto`` in ``src/37-props.js`` has exactly this flaw and gets away with
it only because its lamps are three boxes seen at 300 m. These are seen from two
metres.

So each car comes out as separate meshes. ``car_<name>`` is every painted
surface with its vertex colours set to **white** (the shut lines at 0.3),
drawn on a layer whose ``aInstColor`` carries the paint. ``car_<name>_gloss``
is what reflects — glass, lamp lenses, alloys, gloss-black trim, the roofbox —
and ``car_<name>_trim`` the matt rest: tyres, plastics, plates, the underside,
the arch liners, the rails. Both in their real colours, on layers whose
``aInstColor`` is all 1.0; gloss and paint each have a material of their own
in ``src/44-cars.js``, which is why they are separate at all.

── what the five are, and why ────────────────────────────────────────────────

Body types, not marques, and they come off the user's own walk-throughs
(``1000149595.mp4``, ``1000149597.mp4``) rather than off a guess about what an
old Dalmatian car park holds. The footage shows the row under the olives is
white and silver modern superminis and small crossovers, one dark blue tall
small MPV, one small white panel van, and exactly one older squarer red hatch.
That is what is here: ``supermini``, ``crossover``, ``estate``, ``van``,
``oldhatch``, and the paint palettes in ``src/44-cars.js`` are weighted the same
way — heavily toward white.

── 28 Sep 2026: "the cars still look like shit" ──────────────────────────────

Misha, from the car park behind the kabine. What he was looking at: a
greenhouse that was a second superelliptical bubble sat on the body (the roof
read as a lid on a tub); lamps and plates as boxes stood off the ends; a flat
cap on each end of the loft; a twelve-sided drum with a grey disc for a wheel;
one blinn lobe for paint, glass and tyres alike. Now (``build_shell``): ONE
section from sill to roof — flank, shoulder, a ledge the glass stands back
from, tumblehome, cant rail, roof — lofted as one and folding down onto a
crowned deck where there is no glasshouse; ends rounded on a quarter-circle and
closed with a ladder cap; lamps, grille, shut lines and pillars as regions of
the loft, shaped in plan as well as height; tyres with a shoulder and a
sidewall round five-, seven- or split-spoke alloys, arch liners behind them;
mirrors, handles, plates and spoilers as rounded boxes (``Sink.rbox``). The
superellipse loft below survives for the one car under a cover.

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

The glasshouse is the ``gh`` table: how far above the belt the roof stands at
each station and how wide it is, softened by 50 mm (``roof_table``). Where it
is zero the section is the bonnet or the boot; the windscreen and backlight are
the stations where it climbs. The van uses the same table with its roof
carried flat to the back doors and no backlight.

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
# Tinted glass is DARK. It was 0.105-0.155 and read as grey plastic, because a
# pane is not a coloured surface at all: what you see in a parked car's window
# is the black cabin behind a reflection of the sky, and the reflection is the
# material's job now (the `gloss` layer in src/44-cars.js), not the colour's.
GLASS = (0.028, 0.034, 0.042)
TYRE = (0.052, 0.052, 0.056)
SIDEWALL = (0.085, 0.085, 0.090)  # the lettered wall is a shade off the tread
RIM = (0.640, 0.652, 0.668)       # machined alloy
RIMDK = (0.200, 0.205, 0.215)     # the gunmetal alloys a crossover comes on
DISC = (0.180, 0.170, 0.160)      # the brake disc behind the spokes, rusty-ish
DARK = (0.105, 0.107, 0.114)      # textured black plastic: lips, mirror bases
PIANO = (0.020, 0.021, 0.024)     # gloss black: grille, B-pillar, window line
UNDER = (0.050, 0.050, 0.054)     # the floor pan and the arch liners
LAMP = (0.560, 0.585, 0.610)      # the chrome reflector under a clear lens
TAILL = (0.380, 0.030, 0.026)
PLATE = (0.870, 0.875, 0.870)
EUBLUE = (0.040, 0.080, 0.300)    # the EU strip at the plate's left end
BOXC = (0.160, 0.165, 0.175)      # the roofbox, gloss charcoal
RAILC = (0.240, 0.245, 0.255)     # roof rails, anodised
SEAM = (0.300, 0.300, 0.300)      # a shut line: the paint, three times darker

# Three blobs, not two. `body` is tinted per car; `gloss` is everything that
# reflects like glass or polished metal — panes, lamp lenses, alloys, the gloss
# black trim; `trim` is the matt remainder. They are three layers because they
# are three materials, and one layer per material is the only way the shader
# can know which is which without guessing from the colour.
BUCKETS = {
    "paint": (WHITE, True, "body"),
    "seam": (SEAM, False, "body"),
    "glass": (GLASS, True, "gloss"),
    "piano": (PIANO, True, "gloss"),
    "rim": (RIM, True, "gloss"),
    "rimdk": (RIMDK, True, "gloss"),
    "lamp": (LAMP, True, "gloss"),
    "tail": (TAILL, True, "gloss"),
    "box": (BOXC, True, "gloss"),
    "tyre": (TYRE, True, "trim"),
    "wall": (SIDEWALL, True, "trim"),
    "disc": (DISC, False, "trim"),
    "dark": (DARK, True, "trim"),
    "under": (UNDER, False, "trim"),
    "plate": (PLATE, False, "trim"),
    "eu": (EUBLUE, False, "trim"),
    "rail": (RAILC, True, "trim"),
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
    """One cross-section: the six numbers a ring needs, plus its x.

    The last ``end_r`` metres at either end are ROUNDED in both directions: the
    section narrows to 80 % of its width and gives up a fifth of its height on
    a quarter-circle, so a bumper is a pillow and not the flat cap of a loft.
    Without it every car ended in a vertical plane with its lamps drawn on it,
    which is the single strongest "box" cue there was — the eye reads a car's
    corners before it reads anything else about it.
    """
    zs = sill_at(spec, x)
    zb = pw(spec["belt"], x)
    hw = pw(spec["hw"], x)
    hwb = pw(spec["hwb"], x)
    r = spec.get("end_r", 0.14)
    d = min(spec["x1"] - x, x - spec["x0"])
    if d < r:
        f = math.sqrt(max(0.0, 1.0 - (1.0 - d / r) ** 2))
        k = 1.0 - f
        h = zb - zs
        zs += k * h * 0.11
        zb -= k * h * 0.09
        hw *= 1.0 - 0.20 * k
        hwb *= 1.0 - 0.20 * k
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
        out.append((sc * w, z, ss, sc))
    return out


def station_xs(spec):
    """Where to cut the body, nose first.

    Seven stations round each axle, which is the wheel arch; a station every
    120 mm everywhere else, which is what lets smooth normals be smooth — at the
    old spacing of 0.2-0.6 m the bonnet was three flat planes with a highlight
    jumping between them (70 mm was tried: +1.5 ms of GPU at the promenade, and
    the close-ups hold up at 120); the rounding at each end, sampled on its own curve;
    and a pair 12 mm apart either side of every shut line (`doors`), so a door
    gap is a real strip of loft that `region` can paint and not a smear across
    a 0.3 m face.
    """
    x0, x1 = spec["x0"], spec["x1"]
    span = spec["arch_span"]
    xs = {x0, x1, (x0 + x1) * 0.5}
    n = int((x1 - x0) / 0.12)
    xs.update(x0 + (x1 - x0) * i / n for i in range(n + 1))
    r = spec.get("end_r", 0.14)
    for dd in (0.004, 0.015, 0.035, 0.06, 0.09, 0.12):
        xs.add(x1 - dd * r / 0.14)
        xs.add(x0 + dd * r / 0.14)
    for ax in spec["axles"]:
        for d in (-1.0, -0.7, -0.4, 0.0, 0.4, 0.7, 1.0):
            xs.add(round(ax + d * span, 4))
    for dx in spec.get("doors", ()):
        xs.add(dx - 0.006)
        xs.add(dx + 0.006)
    xs.update(spec.get("extra_x", ()))
    # Deduplicated with a tolerance: a sliver under 4 mm is triangles the
    # smoothing has to work round for nothing. The shut-line pairs are 12 mm.
    out = []
    for x in sorted((x for x in xs if x0 - 1e-6 <= x <= x1 + 1e-6), reverse=True):
        if not out or out[-1] - x > 0.004:
            out.append(x)
    return out


def recoloured(spec, xm, uz, yf=0.0):
    """Repaint a patch of the body loft without adding any geometry to it.

    A bumper is not a plank bolted to the front: it wraps the corners, and a box
    across a rounded nose shows its own square corners sticking out either side
    of the body. So the bumper — and the van's windscreen, which is a pane on
    the body's own rake and not a flap hovering over it — is a *region* of the
    loft that comes out of a different bucket. Zero extra triangles, no
    z-fighting, and it follows the section however the profile is retuned.

    ``(bucket, x_lo, x_hi, uz_lo, uz_hi)``, first match wins. Then `region`.
    """
    for bucket, xa, xb, ua, ub in spec.get("recolour", ()):
        if xa <= xm <= xb and ua <= uz <= ub:
            return bucket
    return region(spec, xm, uz, yf)


def region(spec, x, uz, yf):
    """The lamps, the grille and the shut lines, as regions of the loft.

    ``yf`` is the section's own lateral coordinate, −1 to +1 across the car, so
    a region can be shaped in plan as well as in height — which is the whole
    difference between the box lamps this replaces and a lamp that is *in* the
    body. A modern headlamp is a swept wedge: tall at the corner of the nose,
    tapering back along the wing to a point. That is ``u`` below, the distance
    back from the nose as a fraction of the lamp's length, lifting the lower
    edge as it goes. The tail lamp is the same thing at the other end, wrapped
    round the corner onto the flank.

    Stood-off boxes were the first cut and every one of them read as a sticker.
    """
    x0, x1 = spec["x0"], spec["x1"]
    ay = abs(yf)
    if spec.get("plain"):
        return None
    # Headlamp. (length, lower edge at the nose, upper edge, inner edge)
    hl, hlo, hhi, hin = spec.get("head", (0.34, 0.20, 0.64, 0.42))
    d = x1 - x
    if d < hl:
        u = d / hl
        side = ay > 0.93
        if (hlo + 0.34 * u <= uz <= hhi - 0.04 * u and ay >= hin + 0.25 * u
                and (not side or u < 0.62)):
            return "lamp"
    # Tail lamp: (length, lower edge, upper edge, inner edge)
    tl, tlo, thi, tin = spec.get("tail", (0.24, 0.30, 0.74, 0.46))
    d = x - x0
    if d < tl:
        u = d / tl
        if tlo + 0.22 * u <= uz <= thi - 0.02 * u and ay >= tin:
            return "tail"
    # The grille and the intake under it: gloss black, the middle of the nose.
    g = spec.get("grille", (0.11, -0.66, 0.16, 0.66))
    if x1 - x < g[0] and g[1] <= uz <= g[2] and ay <= g[3]:
        return "piano"
    # The lip under each bumper, in the textured black a bumper's lower edge is.
    if (x1 - x < 0.36 or x - x0 < 0.30) and uz <= -0.66:
        return "dark"
    # Shut lines: the doors, from the rocker to the belt.
    for dx in spec.get("doors", ()):
        if abs(x - dx) < 0.0075 and ay >= 0.50 and -0.66 <= uz <= 0.985:
            return "seam"
    # The bonnet's rear edge, across the deck in front of the windscreen, and
    # the tailgate's lower one across the back.
    hx = spec.get("hood_x")
    if hx is not None and abs(x - hx) < 0.0075 and uz >= 0.90:
        return "seam"
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

    def rbox(self, bucket, cx, cy, cz, sx, sy, sz, p=4.0, seg=8, rows=6):
        """A superellipsoid: a box with its edges rounded, by exponent ``p``.

        What every stood-off part of a car actually is — a mirror shell, a
        handle, a plate, a rail. At ``p`` 2 it is an ellipsoid; at 6 it is a
        box with a 5 mm radius on it, which is still enough to catch a light.
        """
        e = 2.0 / p
        f = lambda v: math.copysign(abs(v) ** e, v)       # noqa: E731
        grid = []
        for j in range(rows + 1):
            v = -math.pi * 0.5 + math.pi * j / rows
            cv, sv = f(math.cos(v)), f(math.sin(v))
            ring = []
            for i in range(seg):
                u = TAU * i / seg
                ring.append((cx + sx * 0.5 * cv * f(math.cos(u)),
                             cy + sy * 0.5 * cv * f(math.sin(u)),
                             cz + sz * 0.5 * sv))
            grid.append(ring)
        for j in range(rows):
            for i in range(seg):
                k = (i + 1) % seg
                self.face(bucket, [grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]])

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
            yf = (A[i][3] + A[k][3]) * 0.5
            bucket = ("under" if uz <= -0.86
                      else recoloured(spec, xm, uz, yf) or "paint")
            sink.face(bucket, [
                (xa, A[k][0], A[k][1]), (xb, B[k][0], B[k][1]),
                (xb, B[i][0], B[i][1]), (xa, A[i][0], A[i][1]),
            ])

    # The caps. Not a fan any more: three rings inset toward the middle of the
    # section and bulged 12 mm outward, so the last of the rounding carries on
    # across the face of the bumper and the grille and plate have quads to be
    # painted on rather than long slivers radiating from one point.
    for st, rg, front in ((sts[0], rings[0], True), (sts[-1], rings[-1], False)):
        x, zs, _zw, zb = st[0], st[1], st[2], st[3]
        hz = (zs + zb) * 0.5
        sg = 1.0 if front else -1.0
        steps = (1.0, 0.72, 0.42, 0.0)
        layers = []
        for f in steps:
            bx = x + sg * 0.012 * (1.0 - f * f)
            layers.append([(bx, q[0] * f, hz + (q[1] - hz) * f, q[2] * f, q[3] * f)
                           for q in rg])
        for L in range(len(steps) - 1):
            A, B = layers[L], layers[L + 1]
            for i in range(seg):
                k = (i + 1) % seg
                uz = (A[i][3] + A[k][3] + B[i][3] + B[k][3]) * 0.25
                yf = (A[i][4] + A[k][4] + B[i][4] + B[k][4]) * 0.25
                bucket = ("under" if uz <= -0.86
                          else recoloured(spec, x, uz, yf) or "paint")
                quad = [(A[i][0], A[i][1], A[i][2]), (A[k][0], A[k][1], A[k][2]),
                        (B[k][0], B[k][1], B[k][2]), (B[i][0], B[i][1], B[i][2])]
                sink.face(bucket, quad if front else quad[::-1])
    return sts


def roof_table(spec):
    """How far the glasshouse stands above the belt, and how wide its roof is.

    Sampled every 10 mm from nose to tail off the `gh` knots and then blurred
    by 50 mm, which is what rounds the windscreen header and the top of the
    tailgate — a piecewise-linear roof has a crease at every knot, and a crease
    across a roof is the "separate slab" the last version was called out for.
    The windscreen is given 18 mm of convexity on top of the rake, because a
    flat pane from cowl to header is what a van has and nothing else does.
    """
    gh = spec.get("gh")
    x0, x1 = spec["x0"], spec["x1"]
    n = int(round((x1 - x0) / 0.01)) + 1
    xs = [x1 - (x1 - x0) * i / (n - 1) for i in range(n)]
    if not gh:
        return xs, [0.0] * n, [0.0] * n
    top = [(g[0], g[1] if g[1] is not None else pw(spec["belt"], g[0])) for g in gh]
    tws = [(g[0], g[3] if g[3] is not None else g[2]) for g in gh]
    hi_x, lo_x = gh[0][0], gh[-1][0]
    ws = spec.get("ws") or (gh[1][0], gh[0][0])
    hs, ts = [], []
    for x in xs:
        if x > hi_x + 1e-6 or x < lo_x - 1e-6:
            hs.append(0.0)
        else:
            h = max(0.0, pw(top, x) - pw(spec["belt"], x))
            if ws[0] <= x <= ws[1]:
                t = (x - ws[0]) / ((ws[1] - ws[0]) or 1.0)
                h += 0.018 * math.sin(math.pi * t)
            hs.append(h)
        ts.append(pw(tws, min(hi_x, max(lo_x, x))))
    hs = _blur(xs, hs, 0.05)
    return xs, hs, ts


def roof_at(tab, x):
    """``(h, tw)`` off the table, by linear interpolation."""
    xs, hs, ts = tab
    step = (xs[0] - xs[-1]) / (len(xs) - 1)
    f = (xs[0] - x) / step
    i = max(0, min(len(xs) - 2, int(f)))
    u = max(0.0, min(1.0, f - i))
    return (hs[i] + (hs[i + 1] - hs[i]) * u, ts[i] + (ts[i + 1] - ts[i]) * u)


# One section of the shell, bottom centre to top centre, as key points and the
# name of the strip that starts at each. `SUB` is how many pieces each strip is
# cut into along a centripetal Catmull-Rom through the keys: two or three on a
# long curve, one where a crease belongs (the shoulder, the window line).
KEY_TAGS = ("under", "under", "sill", "flank", "flank", "flank", "shoulder",
            "ledge", "trim", "side", "cant", "roof", "roof")
SUB = (1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 2, 1)


def section_keys(spec, x, tab):
    """The fourteen key points of the section at ``x``, as ``(y, z)``.

    This replaces a superellipse body with a second superellipse sat on top of
    it for a greenhouse. That was two bubbles, and the join between them was
    the thing everyone saw: the body curled in to meet itself at the belt and
    the glass curled out again above it, so the roof read as a lid resting on
    a tub. A car is ONE section — sill, flank, a shoulder, a ledge the glass
    stands back from, the glass leaning in (tumblehome), a cant rail, a roof —
    and it is lofted as one. Where there is no glasshouse over it (the bonnet,
    the boot) the upper keys fold down onto a crowned deck, blended in over
    the first 10 cm of glasshouse height, so the windscreen rises out of the
    bonnet instead of standing on it.
    """
    st = station(spec, x)
    _x, zs, zw, zb, hs, hw, hwb = st
    h, tw = roof_at(tab, x)
    ledge = spec.get("ledge", 0.045)
    crown = spec.get("crown", 0.040)
    deck = spec.get("deck_crown", 0.050)
    gb = hwb - ledge
    tw = min(tw, gb - 0.02)
    g = min(1.0, h / 0.10)
    g = g * g * (3.0 - 2.0 * g)
    gt = gb + (tw + 0.030 - gb) * min(1.0, h / 0.40)
    # The greenhouse keys, then the deck they fold onto.
    gk = [(gb, zb + 0.006), (gb - 0.006, zb + min(0.026, h * 0.3)),
          (gt, zb + max(h - 0.045, h * 0.6)), (tw, zb + h),
          (tw * 0.55, zb + h + crown * 0.72), (0.0, zb + h + crown)]
    dw = gb
    dk = [(dw, zb + 0.004), (dw - 0.010, zb + deck * 0.10),
          (dw * 0.74, zb + deck * 0.52), (dw * 0.50, zb + deck * 0.78),
          (dw * 0.25, zb + deck * 0.94), (0.0, zb + deck)]
    top = [(d[0] + (q[0] - d[0]) * g, d[1] + (q[1] - d[1]) * g)
           for d, q in zip(dk, gk)]
    keys = [(0.0, zs + 0.015), (hs * 0.82, zs), (hs * 0.985, zs + 0.028),
            (hs, zs + 0.095), (hw, zw),
            (hw * 0.4 + hwb * 0.6, zw + (zb - zw) * 0.60),
            (hwb, zb - 0.030), (hwb - 0.020, zb - 0.002)] + top
    return keys, st, h


def _cr(p0, p1, p2, p3, t):
    """Centripetal Catmull-Rom between p1 and p2 — no loops, no overshoot."""
    def tj(ti, a, b):
        return ti + max(1e-6, math.hypot(b[0] - a[0], b[1] - a[1])) ** 0.5
    t0 = 0.0
    t1 = tj(t0, p0, p1)
    t2 = tj(t1, p1, p2)
    t3 = tj(t2, p2, p3)
    tt = t1 + (t2 - t1) * t

    def lerp(a, b, ta, tb):
        k = (tt - ta) / ((tb - ta) or 1e-9)
        return (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)
    a1 = lerp(p0, p1, t0, t1)
    a2 = lerp(p1, p2, t1, t2)
    a3 = lerp(p2, p3, t2, t3)
    b1 = lerp(a1, a2, t0, t2)
    b2 = lerp(a2, a3, t1, t3)
    return lerp(b1, b2, t1, t2)


def section(spec, x, tab):
    """The half-section at ``x``: ``[(y, z, uz, yf, tag)]``, and its height.

    ``uz`` is the same signed height the regions have always read — −1 at the
    sill, 0 at the waist, 1 at the belt — carried on up above the belt as
    ``1 + height / glasshouse``; ``yf`` is the lateral fraction of the widest
    half-width. The tag is the strip that STARTS at the point.
    """
    keys, st, h = section_keys(spec, x, tab)
    _x, zs, zw, zb, _hs, hw, _hwb = st
    ext = [(-keys[1][0], keys[1][1])] + keys + [(-keys[-2][0], keys[-2][1])]
    pts = []
    for i in range(len(keys) - 1):
        n = SUB[i]
        for k in range(n):
            t = k / n
            p = keys[i] if k == 0 else _cr(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], t)
            pts.append((max(0.0, p[0]), p[1], KEY_TAGS[i]))
    pts.append((0.0, keys[-1][1], "end"))
    out = []
    for y, z, tag in pts:
        if z <= zw:
            uz = max(-1.0, (z - zw) / max(zw - zs, 1e-3))
        elif z <= zb:
            uz = (z - zw) / max(zb - zw, 1e-3)
        else:
            uz = 1.0 + (z - zb) / max(h, 0.05)
        out.append((y, z, uz, y / hw, tag))
    return out, st, h


def side_y(spec, x, z, tab):
    """How far out the flank is at height ``z`` — for things fixed to it."""
    keys, _st, _h = section_keys(spec, x, tab)
    best = 0.0
    for a, b in zip(keys[2:9], keys[3:10]):
        lo, hi = min(a[1], b[1]), max(a[1], b[1])
        if lo - 1e-6 <= z <= hi + 1e-6 and hi > lo:
            u = (z - a[1]) / (b[1] - a[1])
            best = max(best, a[0] + (b[0] - a[0]) * u)
    return best


def in_ranges(x, ranges):
    return any(a <= x <= b for a, b in ranges)


def classify(spec, tag, xm, uz, yf, hm, zm, tab_ws, tab_bl):
    """Which bucket a strip of the shell comes out of."""
    if tag == "under" or uz <= -0.86:
        return "under"
    if tag == "sill":
        return "dark" if spec.get("cladding") else (recoloured(spec, xm, uz, yf) or "paint")
    if tag in ("flank", "shoulder", "ledge"):
        return recoloured(spec, xm, uz, yf) or "paint"
    # Above the belt. Where the glasshouse has not started this is the deck.
    if hm < 0.02:
        return recoloured(spec, xm, 1.0, yf) or "paint"
    glass = spec.get("glass", ())
    if tag == "trim":
        return "piano" if hm > 0.10 and in_ranges(xm, glass) else "paint"
    if tag == "side":
        if hm < 0.07:
            return "paint"
        for a, b, bucket in spec.get("pillars", ()):
            if a <= xm <= b:
                return bucket
        return "glass" if in_ranges(xm, glass) else "paint"
    if tag == "cant":
        return "paint"
    # The roof strips: glass over the windscreen and the backlight.
    if tab_ws[0] <= xm <= tab_ws[1] or (tab_bl and tab_bl[0] <= xm <= tab_bl[1]):
        return "glass"
    return spec.get("roof_col", "paint")


def build_shell(spec, sink):
    """Sill to roof in one loft, with the regions painted on and both ends capped."""
    tab = roof_table(spec)
    gh = spec.get("gh") or ()
    ws = spec.get("ws") or ((gh[1][0], gh[0][0]) if gh else (9, 9))
    bl = spec.get("bl")
    if bl is None and gh and spec.get("gh_back", True):
        bl = (gh[-1][0], gh[-2][0])
    xs = station_xs(spec)
    secs = [section(spec, x, tab) for x in xs]

    def emit(bucket, quad):
        sink.face(bucket, quad)

    for j in range(len(secs) - 1):
        A, sa, ha = secs[j]
        B, sb, hb = secs[j + 1]
        xa, xb = sa[0], sb[0]
        xm = (xa + xb) * 0.5
        hm = (ha + hb) * 0.5
        for s in range(len(A) - 1):
            uz = (A[s][2] + A[s + 1][2] + B[s][2] + B[s + 1][2]) * 0.25
            yf = (A[s][3] + A[s + 1][3] + B[s][3] + B[s + 1][3]) * 0.25
            zm = (A[s][1] + A[s + 1][1]) * 0.5
            bucket = classify(spec, A[s][4], xm, uz, yf, hm, zm, ws, bl)
            for sg in (1.0, -1.0):
                q = [(xa, sg * A[s][0], A[s][1]), (xa, sg * A[s + 1][0], A[s + 1][1]),
                     (xb, sg * B[s + 1][0], B[s + 1][1]), (xb, sg * B[s][0], B[s][1])]
                emit(bucket, q if sg > 0 else q[::-1])

    # The caps, as a LADDER: one horizontal rung across the end section at the
    # height of every point of its outline, cut into ten across, and bulged
    # 12 mm outward in the middle. Rings inset toward the centre were the first
    # cut, and a horizontal edge — the top of a grille, the line of a bumper —
    # drawn across radial faces comes out as a staircase: the grille had
    # teeth. On rungs every such edge is a rung, and the grille's sides are
    # columns. NO LAMPS on a cap either: they live on the rounded corners,
    # where the stations are 5-30 mm apart and an edge is an edge.
    K = 10
    for (S, st, h), front in ((secs[0], True), (secs[-1], False)):
        x, zs, zw, zb, hw = st[0], st[1], st[2], st[3], st[5]
        sgx = 1.0 if front else -1.0
        rows = []
        for p in S:
            row = []
            for j in range(K + 1):
                y = p[0] * (2.0 * j / K - 1.0)
                u = y / max(hw, 1e-3)
                row.append((x + sgx * 0.012 * max(0.0, 1.0 - u * u), y, p[1]))
            rows.append(row)
        for r in range(len(rows) - 1):
            A, B = rows[r], rows[r + 1]
            zc = (A[0][2] + B[0][2]) * 0.5
            if zc <= zb:
                uz = ((zc - zw) / max(zw - zs, 1e-3) if zc <= zw
                      else (zc - zw) / max(zb - zw, 1e-3))
            else:
                uz = 1.0 + (zc - zb) / max(h, 0.05)
            for j in range(K):
                yc = (A[j][1] + A[j + 1][1] + B[j][1] + B[j + 1][1]) * 0.25 / max(hw, 1e-3)
                if S[r][4] == "under":
                    bucket = "under"
                else:
                    bucket = recoloured(spec, x, max(-0.99, uz), yc) or "paint"
                    if bucket in ("lamp", "tail"):
                        bucket = "paint"
                q = [A[j], A[j + 1], B[j + 1], B[j]]
                emit(bucket, q if front else q[::-1])
    return tab


# -------------------------------------------------------------------- wheels --

def _lathe(sink, ax, r0, sgn, prof, n):
    """Spin a profile of ``(radius, y, bucket)`` round the axle."""
    for i in range(n):
        a0, a1 = TAU * i / n, TAU * (i + 1) / n
        c0, s0, c1, s1 = math.cos(a0), math.sin(a0), math.cos(a1), math.sin(a1)
        for (ra, ya, bk), (rb, yb, _b) in zip(prof, prof[1:]):
            sink.face(bk, [(ax + c0 * ra, sgn * ya, r0 + s0 * ra),
                           (ax + c1 * ra, sgn * ya, r0 + s1 * ra),
                           (ax + c1 * rb, sgn * yb, r0 + s1 * rb),
                           (ax + c0 * rb, sgn * yb, r0 + s0 * rb)])


def build_wheels(spec, sink):
    """Four wheels: a tyre with a shoulder and a sidewall, an alloy in it.

    The last ones were a twelve-sided black drum with a flat grey disc on the
    end, which is what "chunky wheels with flat grey hubcaps" was about. A
    wheel reads by three things: the tyre's rounded shoulder, the step from
    rubber down into the rim, and the spokes standing in front of a dark hole.
    All three are here, at 24 sides. The tread and the hidden inner wall are
    still left out — nothing sees them.

    Track is as before: the outer wall 30 mm inboard of the sill. Behind each
    wheel an arch liner, so the gap over the tyre is black and not a view up
    into the underside of a hollow body.
    """
    r, hwid = spec["wheel"]
    n = 24
    rim_r = r * spec.get("rim_frac", 0.66)
    style = spec.get("rim", "five")
    rb = spec.get("rim_col", "rim")
    for ax in spec["axles"]:
        st = station(spec, ax)
        outer = st[4] - 0.030
        inner = outer - hwid * 2.0
        sw = r - rim_r                                   # sidewall height
        for sgn in (1, -1):
            _lathe(sink, ax, r, sgn, [
                (r * 0.97, inner, "tyre"), (r, inner + 0.03, "tyre"),
                (r, outer - 0.030, "tyre"), (r - 0.010, outer - 0.008, "wall"),
                (r - sw * 0.35, outer + 0.004, "wall"),
                (r - sw * 0.75, outer + 0.002, "wall"),
                (rim_r + 0.006, outer - 0.004, rb),         # the bead, into the lip
                (rim_r - 0.004, outer + 0.002, rb),
                (rim_r - 0.016, outer - 0.004, "disc"),     # the barrel, dark
                (rim_r - 0.020, outer - 0.070, "disc"),
                (0.0, outer - 0.074, "disc"),
            ], n)
            # The spokes: flat-faced, tapered, with sides so they stand proud.
            face = outer - 0.010
            back = outer - 0.058
            rh, ro = r * 0.17, rim_r - 0.012
            if style == "steel":
                # The old car: a pressed hubcap with a ring of slots — a dish.
                _lathe(sink, ax, r, sgn, [
                    (ro, face - 0.004, rb), (ro * 0.80, face + 0.008, rb),
                    (ro * 0.42, face + 0.014, rb), (0.0, face + 0.018, rb)], n)
                continue
            count, wo, wh = {"five": (5, 0.050, 0.070), "split": (10, 0.022, 0.034),
                             "multi": (7, 0.040, 0.060)}[style]
            for k in range(count):
                a = TAU * (k + 0.25) / count
                if style == "split":
                    a = TAU * ((k // 2) + 0.25) / (count // 2) + (0.075 if k % 2 else -0.075)
                d = (math.cos(a), math.sin(a))
                p = (-d[1], d[0])
                pts = [(rh * d[0] + p[0] * wh * 0.5, rh * d[1] + p[1] * wh * 0.5),
                       (ro * d[0] + p[0] * wo * 0.5, ro * d[1] + p[1] * wo * 0.5),
                       (ro * d[0] - p[0] * wo * 0.5, ro * d[1] - p[1] * wo * 0.5),
                       (rh * d[0] - p[0] * wh * 0.5, rh * d[1] - p[1] * wh * 0.5)]
                # A spoke leans back toward the rim — concave, like a real one.
                P = [(ax + u, sgn * (face - (0.018 if m in (1, 2) else 0.0)), r + v)
                     for m, (u, v) in enumerate(pts)]
                Bk = [(ax + u, sgn * back, r + v) for (u, v) in pts]
                sink.face(rb, P)
                sink.face(rb, [P[0], P[1], Bk[1], Bk[0]])
                sink.face(rb, [P[2], P[3], Bk[3], Bk[2]])
            # The hub, and a cap on it.
            _lathe(sink, ax, r, sgn, [
                (rh + 0.004, face - 0.004, rb), (rh * 0.72, face + 0.004, rb),
                (rh * 0.45, face + 0.006, "piano"), (0.0, face + 0.007, "piano")], 16)
        # The arch liners, one each side, and they are only the upper half.
        rl = r + 0.045
        for sgn in (1, -1):
            ya, yb = outer + 0.020, inner - 0.030
            m = 10
            for i in range(m):
                a0 = math.radians(-12 + 204 * i / m)
                a1 = math.radians(-12 + 204 * (i + 1) / m)
                p0 = (ax + math.cos(a0) * rl, r + math.sin(a0) * rl)
                p1 = (ax + math.cos(a1) * rl, r + math.sin(a1) * rl)
                sink.face("under", [(p0[0], sgn * ya, p0[1]), (p1[0], sgn * ya, p1[1]),
                                    (p1[0], sgn * yb, p1[1]), (p0[0], sgn * yb, p0[1])])


# ------------------------------------------------------------------- details --

def build_details(spec, sink, tab):
    """Plates, mirrors, handles, rails, roofbox.

    The lamps are not here any more: they are regions of the shell (`region`).
    What is left is what really does stand off a car: the plates, a pair of
    body-coloured mirrors on black feet, a handle on each door, the rails.
    """
    x0, x1 = spec["x0"], spec["x1"]
    for end, sgn, frac in ((x1, 1.0, 0.27), (x0, -1.0, 0.44)):
        st = station(spec, end)
        zs, zb = st[1], st[3]
        zc = zs + (zb - zs) * frac
        xp = end + sgn * 0.017
        sink.rbox("plate", xp, 0.0, zc, 0.010, 0.520, 0.112, p=6, rows=4)
        sink.rbox("eu", xp + sgn * 0.001, -0.232, zc, 0.010, 0.050, 0.108, p=6, rows=4)

    # Mirrors: a body-coloured shell on a black foot, at the front of the glass.
    mx = spec["mirror_x"]
    st = station(spec, mx)
    zb, hwb = st[3], st[6]
    for side in (1, -1):
        sink.rbox("dark", mx - 0.02, side * (hwb - 0.010), zb + 0.040,
                  0.080, 0.070, 0.050, p=4)
        sink.rbox("paint", mx - 0.035, side * (hwb + 0.085), zb + 0.080,
                  0.105, 0.180, 0.110, p=3.2)
        sink.rbox("piano", mx - 0.035, side * (hwb + 0.130), zb + 0.055,
                  0.080, 0.070, 0.012, p=4)                  # the repeater

    # A handle on the back half of every door.
    doors = spec.get("doors", ())
    for a, b in zip(doors, doors[1:]):
        hx = b + 0.13
        st = station(spec, hx)
        hz = st[3] - 0.105
        y = side_y(spec, hx, hz, tab)
        for side in (1, -1):
            sink.rbox("paint", hx, side * (y + 0.006), hz, 0.135, 0.026, 0.030, p=3.4)

    rails = spec.get("rails")
    if rails:
        rx0, rx1, ry, rz, rh = rails
        for side in (1, -1):
            sink.rbox("rail", (rx0 + rx1) * 0.5, side * ry, rz + rh * 0.5,
                      abs(rx1 - rx0), 0.040, rh, p=5, seg=10, rows=6)

    bx = spec.get("roofbox")
    if bx:
        bx0, bx1, bhw, bz0, bz1 = bx
        sink.rbox("box", (bx0 + bx1) * 0.5, 0.0, (bz0 + bz1) * 0.5,
                  abs(bx1 - bx0), bhw * 2.0, bz1 - bz0, p=2.8, seg=20, rows=12)

    # The van's two back-door windows and the shut line between them: panes
    # standing 6 mm off the rear cap. As a region of the cap they came out as
    # a black moustache — the cap's rings are far too coarse to cut a window.
    rg = spec.get("rear_glass")
    if rg:
        h, _tw = roof_at(tab, x0 + 0.02)
        zb = pw(spec["belt"], x0)
        z0, z1 = zb + rg[0], zb + h - rg[1]
        xg = x0 - 0.012
        for side in (1, -1):
            sink.rbox("glass", xg, side * (0.035 + rg[2] * 0.5), (z0 + z1) * 0.5,
                      0.012, rg[2], z1 - z0, p=10, seg=16, rows=6)
        zs = station(spec, x0)[1]
        sink.rbox("seam", xg, 0.0, (zs + zb + h) * 0.5, 0.010, 0.010,
                  (zb + h - zs) * 0.84, p=8)

    sp = spec.get("spoiler")
    if sp:
        sx, sw, sz = sp
        sink.rbox("paint", sx, 0.0, sz, 0.20, sw * 2.0, 0.035, p=4)


# --------------------------------------------------------------------- cover --
#
# A car under a fitted cover, left for the season.
#
# `a_087` is the frame this is built from — a crossover under a silver-grey
# fitted cover among the pines, with a white uncovered car parked beside it and
# a sawn kerb block in front. There are two of them in v595 (`a_048`-`a_050`
# and `a_086`-`a_089`) and a third behind a gate on the lane at `b_047`. The
# survey catalogued that third one as a glass-recycling igloo; it is not, it is
# this, and the plan has been corrected.
#
# The single thing that makes a covered car read as a covered car is that **all
# its creases are gone**. The bonnet, the windscreen rake and the roof become
# one smooth slope; the shoulder that a car holds nearly vertical goes round;
# the tail turns a corner instead of stopping at a tailgate. So this is not the
# body with a skin over it — it is a *separate, rounder loft* thrown over the
# same plan, and the three numbers that do the work are the standoff, the
# smoothing, and a much lower superellipse power.
#
# The second thing, and the one that was easy to get wrong: **a cover does not
# follow the wheel arches.** It hangs. `sill_at` lifts the body's bottom edge
# over each axle by 0.32 m because that is what a wing does, and a cover thrown
# over the same car has a bottom edge that is very nearly a straight line with
# the wheels showing under it. So `arch` comes down to within 50 mm of `sill`,
# and the skirt hangs 70 mm lower than the body's did.

COVER_STAND = 0.050       # how far the fabric stands off the panel
COVER_POWER = 2.30        # the shoulder, rounded off — the body's is 3.1
COVER_SILL_FRAC = 0.90    # the hem, drawn in a little under the sills
COVER_BLUR = 0.20         # metres of Gaussian along the length


def _gh_top(spec, x):
    """Roof height at station ``x``, or None where the greenhouse has ended.

    The `gh` knots carry `None` for z at each end, which means "meets the belt
    line here" — so those entries are dropped and `pw` is left to clamp.
    """
    knots = [(g[0], g[1]) for g in spec.get("gh", ()) if g[1] is not None]
    if not knots:
        return None
    if x > knots[0][0] or x < knots[-1][0]:
        return None
    return pw(knots, x)


def _blur(xs, vs, sigma):
    """Gaussian along the length, with the ends held rather than darkened.

    A 1-2-1 kernel was the first cut and it is the wrong tool: six passes over
    a 25 mm sampling is an effective radius of about 60 mm, and the corner this
    has to lose — where the windscreen meets the roof — is half a metre wide.
    It came out with every crease still in it. This is a real kernel with a
    real width, and 0.20 m is where a car stops having a windscreen and has not
    yet started being a tent.
    """
    out = []
    for i, x in enumerate(xs):
        num = den = 0.0
        for j, xj in enumerate(xs):
            d = (x - xj) / sigma
            if abs(d) > 3.0:
                continue
            w = math.exp(-0.5 * d * d)
            num += w * vs[j]
            den += w
        out.append(num / den)
    return out


def cover_spec(spec):
    """Derive the cover's own loft from the car it is thrown over."""
    x0, x1 = spec["x0"], spec["x1"]
    n = int((x1 - x0) / 0.025) + 1
    xs = [x1 - (x1 - x0) * i / (n - 1) for i in range(n)]

    # The envelope: whichever is higher at each station, the body's belt line
    # or the roof. Sampled at 25 mm rather than at the body's own stations,
    # because the corner this has to round off falls *between* two of those.
    top = []
    for x in xs:
        gh = _gh_top(spec, x)
        top.append(max(pw(spec["belt"], x), gh if gh is not None else 0.0))
    top = _blur(xs, top, COVER_BLUR)
    hws = _blur(xs, [pw(spec["hw"], x) for x in xs], COVER_BLUR * 0.6)
    hwbs = _blur(xs, [pw(spec["hwb"], x) for x in xs], COVER_BLUR * 0.6)

    # Round both ends off. The loft caps each end with a fan across the whole
    # section, which on a body is a bumper and looks like one; on a cover it is
    # a cliff, and the tail came back looking sawn off. So the last 0.26 m
    # draws in to 0.62 of its width and 40 mm of its height on a cosine, which
    # is a hem gathered round a bumper rather than a flat lid over it.
    def _round(x):
        d = min(x1 - x, x - x0)
        if d >= 0.26:
            return 0.0
        return 0.5 * (1.0 + math.cos(math.pi * d / 0.26))
    for i, x in enumerate(xs):
        u = _round(x)
        hws[i] *= 1.0 - 0.38 * u
        hwbs[i] *= 1.0 - 0.44 * u
        top[i] -= 0.040 * u

    # The bottom edge, and this is the half of it that took three tries.
    #
    # A cover does not cut a wheel arch. Keeping the body's lift — 0.40 m of
    # sill rising to 0.72 over each axle — gives a hem with two deep scallops
    # in it, and a deep scallop over a wheel does not read as fabric, it reads
    # as a wing: the render came back looking like an unpainted car.
    #
    # So the hem runs very nearly straight, and the wheels go *inside* it. At
    # the crossover's 0.325 m the tyre stands 0.65 m tall and its outer wall is
    # 0.77 from the centreline, while the cover's flank at the hem is 0.845 —
    # 75 mm of clearance — so everything above 0.32 is simply enclosed and what
    # shows below the fabric is the bottom half of each tyre and the dark under
    # the car. Which is the photograph.
    sill = 0.320
    out = dict(spec)
    # Stations every 160 mm along the whole length.
    #
    # Without this the blur above does nothing you can see. `station_xs` cuts
    # the loft at about fifteen places — the two ends, the middle and a cluster
    # of five round each axle — and everything between them is a straight line,
    # so a belt table smoothed at 25 mm was being resampled back into the same
    # polyline it started as and the creases came out exactly where they had
    # been. A body gets away with fifteen because a body genuinely is flat
    # between its creases. A cover is curved everywhere.
    step = 0.160
    nk = int((x1 - x0) / step)
    stations = tuple(round(x0 + (x1 - x0) * i / nk, 4) for i in range(1, nk))
    out["belt"] = [(x, z + COVER_STAND) for x, z in zip(xs, top)]
    out["hw"] = [(x, w + COVER_STAND) for x, w in zip(xs, hws)]
    out["hwb"] = [(x, w + COVER_STAND) for x, w in zip(xs, hwbs)]
    out["power"] = COVER_POWER
    out["sill_frac"] = COVER_SILL_FRAC
    out["sill"] = sill
    out["arch"] = sill + 0.030          # a suggestion of the arch, not an arch
    out["arch_span"] = spec["arch_span"] * 1.6
    out["end_sill"] = sill + 0.130      # it does ride up over the bumpers
    out["waist"] = 0.52
    # Everything a cover hides.
    for k in ("gh", "rails", "roofbox", "mirror_x", "rocker", "recolour",
              "glass_panels"):
        out.pop(k, None)
    out["extra_x"] = stations
    out["plain"] = True                 # no lamps, grille or shut lines on a cover
    out["seg"] = 32
    return out


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
        # The shell (`build_shell`): five doors, the glass from the A-pillar
        # to a C-pillar in the paint, a gloss-black B-pillar, a lip spoiler
        # over the hatch, five-spoke alloys.
        "doors": (0.820, -0.075, -0.850), "hood_x": 1.000,
        "glass": ((-0.990, 0.960),), "pillars": ((-0.125, -0.025, "piano"),),
        "spoiler": (-1.200, 0.560, 1.438),
        "rim": "five",
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
        # Black cladding along the sills, darker alloys, split spokes: the
        # three things that make a small crossover not a tall hatchback.
        "doors": (0.860, -0.105, -0.900), "hood_x": 1.060,
        "glass": ((-1.140, 1.030),), "pillars": ((-0.160, -0.050, "piano"),),
        "cladding": True, "rim": "split", "rim_col": "rimdk",
        "spoiler": (-1.360, 0.600, 1.588),
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
        # Five doors and a rear quarter light between a thin C-pillar and the
        # D-pillar, which is the estate's whole silhouette from the side.
        "doors": (0.900, -0.060, -0.940), "hood_x": 1.100,
        "glass": ((-1.975, 1.090),),
        "pillars": ((-0.110, -0.010, "piano"), (-1.060, -0.960, "piano")),
        "rim": "multi",
    },
    {
        "name": "van",
        # The small white panel van. Its roof is not a glasshouse on a body
        # but the body carried up: the belt stays at the cab's window line and
        # the `gh` table stands the whole box on it, a steep screen at the front
        # and a flat roof to the back doors, with no backlight (`gh_back`) —
        # the rear cap closes it, and `rear_glass` puts the two windows in the
        # back doors with a shut line between them. The only side glass is the
        # cab's; the rest of the flank above the belt is panel.
        "x0": -2.140, "x1": 2.260, "axles": (-1.380, 1.380),
        "wheel": (0.315, 0.105), "arch_span": 0.44, "sill_frac": 0.945,
        "sill": 0.340, "arch": 0.690, "end_sill": 0.480,
        "waist": 0.40, "power": 4.6, "gh_power": 3.6, "seg": 16,
        "belt": [(2.260, 0.930), (1.900, 1.000), (1.420, 1.050), (1.300, 1.062),
                 (-2.140, 1.075)],
        "hw": [(2.260, 0.752), (2.080, 0.844), (1.700, 0.890), (1.180, 0.902),
               (0.000, 0.905), (-1.700, 0.905), (-2.060, 0.888), (-2.140, 0.834)],
        "hwb": [(2.260, 0.672), (2.080, 0.768), (1.700, 0.826), (1.180, 0.856),
                (0.600, 0.874), (0.000, 0.878), (-1.700, 0.878),
                (-2.060, 0.862), (-2.140, 0.808)],
        "extra_x": (1.300, 1.120, 0.950, 0.820, 0.600, 0.300),
        "gh": [(1.340, None, 0.850, None), (1.120, 1.300, 0.850, 0.790),
               (0.950, 1.650, 0.850, 0.800), (0.820, 1.790, 0.850, 0.805),
               (0.600, 1.830, 0.850, 0.810), (-1.900, 1.845, 0.850, 0.810),
               (-2.140, 1.800, 0.850, 0.790)],
        "gh_back": False, "ws": (0.800, 1.340), "ledge": 0.018, "crown": 0.030,
        "rear_glass": (0.170, 0.190, 0.60),
        "tail": (0.07, -0.30, 0.95, 0.86),
        "doors": (0.930, 0.080, -0.860), "hood_x": 1.380,
        "glass": ((0.110, 1.340),),
        "mirror_x": 1.180, "rocker": (1.150, -1.400),
        "rim": "steel", "rim_col": "rimdk",
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
        # Square: tight corners, a flat bonnet, a thin roof crown, rectangular
        # lamps either side of a grille at lamp height, pressed hubcaps.
        "end_r": 0.070, "ledge": 0.030, "crown": 0.020, "deck_crown": 0.028,
        "head": (0.10, 0.18, 0.62, 0.44), "tail": (0.09, 0.26, 0.72, 0.50),
        "grille": (0.08, -0.26, 0.60, 0.46),
        "doors": (0.780, -0.420), "hood_x": 0.930,
        "glass": ((-1.000, 0.910),), "rim": "steel",
    },
]

# And the sixth, which is the second model in this list wearing a cover. It is
# built by name rather than by copying numbers, so a change to the crossover
# changes what is under the cover too — which is the point, since it *is* a
# crossover: the frame shows the wheel, the arch and enough of the flank below
# the hem to say what class of car it is.
MODELS.append(dict(
    next(m for m in MODELS if m["name"] == "crossover"),
    name="covered", cover=True,
))


# ---------------------------------------------------------------------- bake --

def build_car(spec):
    spec = dict(spec)
    sink = Sink()
    if spec.get("cover"):
        # The cover, and then the car's own wheels standing under its hem.
        # Nothing else: a fitted cover hides the glass, the bumpers, the lamps,
        # the plates and the mirrors, and every one of those showing through it
        # would say "car with a sheet on" rather than "car put away".
        build_body(cover_spec(spec), sink)
        build_wheels(spec, sink)
        return sink.objects()
    tab = build_shell(spec, sink)
    build_wheels(spec, sink)
    build_details(spec, sink, tab)
    return sink.objects()


def extents(spec):
    """The four numbers the shore build needs before anything is inflated.

    ``x0``/``x1`` are the tail and nose in model space, so the caller can put
    the nose on a line and know where the tail lands; ``hw`` is the widest
    half-width, which is the car's extent along the shore because the row is
    parked nose-in; ``h`` is the overall height, for the walk blocker.
    """
    if spec.get("cover"):
        spec = cover_spec(spec)          # the cover is what occupies the space
    hw = max(v for _x, v in spec["hw"])
    h = max(pw(spec["belt"], x) for x, _v in spec["belt"])
    if spec.get("gh"):
        tab = roof_table(spec)
        h = max(h, max(pw(spec["belt"], x) + hh for x, hh in zip(tab[0], tab[1]))
                + spec.get("crown", 0.040))
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
        gloss = [v for k, v in parts.items() if BUCKETS[k][2] == "gloss"]
        trim = [v for k, v in parts.items() if BUCKETS[k][2] == "trim"]
        export(body, OUT / ("car_%s.fr3d.gz" % spec["name"]), note=spec["name"])
        export(trim, OUT / ("car_%s_trim.fr3d.gz" % spec["name"]),
               note=spec["name"] + " trim")
        # The covered car has nothing that shines; it still gets a blob, so
        # every model is the same three and the loader has no special case.
        if not gloss:
            sink = Sink()
            sink.rbox("piano", 0.0, 0.0, -1.0, 0.01, 0.01, 0.01, seg=4, rows=2)
            gloss = list(sink.objects().values())
        export(gloss, OUT / ("car_%s_gloss.fr3d.gz" % spec["name"]),
               note=spec["name"] + " gloss")
        meta[spec["name"]] = extents(spec)
        e = meta[spec["name"]]
        print("[cars] %-10s %.2f m long, %.2f wide, %.2f tall"
              % (spec["name"], e["x1"] - e["x0"], e["hw"] * 2, e["h"]))
        if preview:
            from preview import turntable          # noqa: PLC0415
            turntable(body + gloss + trim,
                      "/tmp/claude-1000/cars_" + spec["name"], span=5.5)
    (OUT / "cars.json").write_text(json.dumps(meta, indent=1, sort_keys=True))
    print("[cars] wrote cars.json — %s" % ", ".join(sorted(meta)))


if __name__ == "__main__":
    build()
