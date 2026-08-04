"""Build one high-detail humanoid: a continuous skin on a 25-bone armature.

    blender --background --python tools/blender/human.py
    blender --background --python tools/blender/human.py -- --voxel 0.004 --tris 40000

Writes build/human.blend and preview renders to /tmp/human_*.png.

── why this exists ─────────────────────────────────────────────────────────────

The people already in this game — tools/blender/firefighter.py and
tools/blender/bather.py — are eleven *rigid* parts hung on a tree of joints.
frmesh.export_rig's own docstring calls it what it is: "a skeleton without a
skinning solver". That is a marionette, in the exact and literal sense: separate
solid pieces pinned at pivots. Bend the elbow and two closed surfaces
interpenetrate while a hard seam swings round. No amount of extra geometry on
either piece touches that, because the fault is *between* the pieces.

So this figure is built the other way round:

    primitives  ->  join  ->  voxel remesh  ->  smooth  ->  decimate  ->  skin

The remesh is the whole trick. It takes twenty-odd overlapping lumps and
returns one watertight surface with no seam anywhere, which is a thing the
rigid-part pipeline cannot express at any polygon count. From there an armature
with automatic weights makes the shoulder, elbow, hip and knee *deform* rather
than rotate as a unit.

── the bind pose is a wide A-pose, deliberately ────────────────────────────────

The old rigs bind with the arms straight down and splay them at runtime. That is
fine for rigid parts and wrong here, for two separate reasons.

The obvious one: the voxel remesh welds anything closer together than one voxel,
so arms hanging against the ribs would fuse the armpit shut and the figure would
come out in a straitjacket.

The one that cost an afternoon: the angle has to be *wide*, not merely nonzero.
At twelve degrees the armpit is a narrow slot, and bone heat weights a vertex by
how far it is from each bone across the surface. Across a slot that distance is
tiny, so the weight gradient from chest to upper arm is compressed into a
centimetre — and the moment the arm swings, the skin over the ribs buckles into
a fan of creases. Widening the bind to thirty-eight degrees lengthens that path
and spreads the same gradient over a hand's width. This is most of why every
skinned character you have ever seen is authored in a T-pose or a wide A.

── the colour question ─────────────────────────────────────────────────────────

Remeshing throws vertex data away — the new surface shares no vertices with the
old one. Colour is therefore re-applied afterwards by nearest-neighbour lookup
against a KD-tree of the pre-remesh geometry, which is exact enough because the
new surface is never more than a voxel from the old one.

Two colours are carried per primitive. `PREV` is what a human being should look
like and is what the previews render. `MARK` is the marker palette from
bather.py — white/black/red standing for skin/swimwear/hair, replaced per figure
at runtime so a beach is not a crowd of clones. The export path will want MARK;
a preview rendered in MARK would be a black-and-white mannequin and would tell
you nothing about whether the model is any good.

── what this does NOT do yet ───────────────────────────────────────────────────

It does not export. fr3d v2 stores one flat colour per part and no weights, so
shipping this needs a v3 with per-vertex bone indices and weights plus a GPU
skinning path in the runtime. That is deliberately a separate step: there is no
point writing a skinning shader for a model nobody has looked at yet.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Vector  # type: ignore
from mathutils.bvhtree import BVHTree  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import bm_ball, bm_loft, new_object, reset_scene  # noqa: E402

BLEND = Path(__file__).resolve().parents[2] / "build" / "human.blend"
PREVIEW = "/tmp/human"

# Voxel size for the remesh, in metres. This is the single most consequential
# number in the file. Too coarse and the fingers weld into a mitten and the
# armpit closes; too fine and the decimator is handed two million triangles to
# throw away. 5 mm keeps a 22 mm finger about four voxels across.
VOXEL = 0.0030
# Triangles after decimation. Generous on purpose: the collapse decimator is
# curvature-driven, so it strips edges hardest exactly where a limb is straight
# and smooth — which is precisely where a joint needs loops to bend on. At
# 42 000 the knees had about four rings each to fold across and collapsed into a
# pinch. Spending the triangles is far cheaper than being clever about it.
TRIS = 170000

# Bind with the knee and elbow slightly flexed rather than locked straight.
# Two reasons, and both matter. Bone-heat weighting has no way to know which way
# a straight joint is meant to fold, so it produces a symmetric solution that
# collapses inward from both sides. And nobody stands with their knees locked
# anyway, so the rest pose is more honest for it.
KNEE_FWD = 0.014
ELBOW_FWD = 0.011

# ── the marker palette, and what it should actually look like ──────────────── #
SKIN_M, SKIN_P = (1.0, 1.0, 1.0), (0.760, 0.588, 0.474)
SUIT_M, SUIT_P = (0.0, 0.0, 0.0), (0.114, 0.169, 0.290)
HAIR_M, HAIR_P = (1.0, 0.0, 0.0), (0.128, 0.094, 0.070)
# Eyes are taken literally by the runtime shader, which is what we want: a
# sclera that tracked the figure's skin tone would be an albino, and one that
# tracked the swimwear would be worse. Note the sclera is 0.94 and not 1.0 —
# pure white is the *skin* marker, and this is exactly the "near-white shade
# will be silently repainted" trap that bather.py's docstring warns about.
EYE_M, EYE_P = (0.928, 0.922, 0.902), (0.928, 0.922, 0.902)
IRIS_M, IRIS_P = (0.105, 0.082, 0.068), (0.105, 0.082, 0.068)
# A pupil wants to be black and must not be. Pure black is the *swimwear*
# marker, so a truly black pupil would come out of the runtime shader painted
# whatever colour that figure's trunks are. The shader's test is a channel sum
# below 0.06; this sums to 0.11, which is as dark as it is safe to go and is
# indistinguishable from black on a 5 mm disc.
PUPIL_M, PUPIL_P = (0.040, 0.035, 0.035), (0.040, 0.035, 0.035)
# The mouth line and the nostrils are shadow rather than pigment — both are
# openings, and what you see in them is the absence of light.
MOUTH_M, MOUTH_P = (0.300, 0.160, 0.145), (0.300, 0.160, 0.145)
NOSE_M, NOSE_P = (0.220, 0.140, 0.125), (0.220, 0.140, 0.125)

# ── proportions, for a 1.75 m adult male, barefoot ─────────────────────────── #
#
# Every one of these is a real anthropometric station rather than a number that
# looked right, because the whole point of a continuous skin is that it shows up
# proportion errors the rigid version hid inside its own seams.
Z_ANKLE = 0.078
Z_KNEE = 0.490
Z_CROTCH = 0.820
Z_HIP = 0.900          # the joint, not the widest point
Z_WAIST = 1.045
Z_CHEST = 1.255
Z_SHOULDER = 1.420
Z_NECK = 1.475
Z_CHIN = 1.552
Z_TOP = 1.750

Y_HIP = 0.092          # half the distance between the hip joints
Y_SHOULDER = 0.185     # and between the shoulder joints

A_POSE = math.radians(38.0)     # arms out from vertical, see the docstring
L_UPPER = 0.300                 # shoulder to elbow
L_FORE = 0.262                  # elbow to wrist

SEG = 30               # rings round the body
SEGL = 22              # and round a limb
SEGF = 10              # and round a finger


def _elbow_z():
    return Z_SHOULDER - L_UPPER * math.cos(A_POSE)


def _elbow_y():
    return Y_SHOULDER + L_UPPER * math.sin(A_POSE)


def _wrist_z():
    return _elbow_z() - L_FORE * math.cos(A_POSE)


def _wrist_y():
    return _elbow_y() + L_FORE * math.sin(A_POSE)


# --------------------------------------------------------------------------- #
#  the body                                                                    #
# --------------------------------------------------------------------------- #

def torso():
    """Hips to collarbones in one unbroken stack.

    `power` is the superellipse exponent from bm_loft and it does more work here
    than any radius: a torso at 2.0 is a column of ellipses and reads as a shop
    dummy, because a real ribcage is a rounded *rectangle* — flat across the
    front, flat across the back, and turning the corner at the sides.
    """
    bm = bmesh.new()
    bm_loft(bm, [
        # z      depth   width   fwd-offset
        (0.760, 0.116, 0.148, 0.004),
        (0.820, 0.124, 0.160, 0.004),   # the seat
        (0.880, 0.126, 0.166, 0.002),   # widest across the hips
        (0.940, 0.120, 0.156, 0.000),
        (1.000, 0.113, 0.142, -0.002),
        (1.045, 0.110, 0.136, -0.002),  # waist, the narrowest station
        (1.100, 0.115, 0.144, 0.000),
        (1.160, 0.124, 0.158, 0.002),   # the arch of the lower ribs
        (1.215, 0.133, 0.174, 0.004),
        (1.255, 0.137, 0.186, 0.004),   # chest
        (1.310, 0.132, 0.192, 0.002),
        (1.370, 0.122, 0.191, 0.000),   # across the shoulders
        (1.420, 0.108, 0.176, -0.004),
        (1.462, 0.083, 0.132, -0.008),  # the shelf the neck stands on
    ], seg=SEG, power=2.55)
    return new_object(bm, "torso", smooth=True)


def shaping():
    """The lumps that turn a lofted column into a body.

    None of these is a separate part in the finished model — they are unioned
    into the skin by the remesh and exist only to push it around. That is why
    they can overlap each other and the torso freely and why none of them needs
    a cap or a sensible normal.
    """
    bm = bmesh.new()
    # Pectorals. Wide, flat, high, and joined across the sternum. The first cut
    # had them round, deep and set apart, and the figure read unmistakably as a
    # woman — a male chest is a *sheet* of muscle lying on the ribs, and the
    # moment it protrudes more than about 3 cm it is a breast instead.
    for s in (1, -1):
        bm_ball(bm, 0.082, s * 0.080, 1.292, 0.030, 0.092, 0.044, rows=9, seg=18)
    # Latissimus: the taper from the armpit down to the waist. This is what a
    # torso is missing when it reads as a barrel with arms on it.
    #
    # Set inboard of the torso's own half-width and made broad rather than
    # proud. Sitting it outboard put a hard longitudinal crease down each flank
    # where it surfaced, and raising the arm stretched the skin over that crease
    # into a fan of wrinkles across the ribs.
    for s in (1, -1):
        bm_ball(bm, -0.026, s * 0.112, 1.238, 0.084, 0.068, 0.112, rows=12, seg=20)
    # Deltoids: the cap of the shoulder, which is the single most important
    # volume on the whole figure. Without it the arm leaves the torso as a tube
    # out of a slab and every viewer reads it as a doll.
    # Flattened and pulled inboard from the first cut's near-sphere, which read
    # as a ball bearing dropped into the shoulder. A deltoid is a cap over the
    # joint, wider than it is deep and longer than it is tall.
    for s in (1, -1):
        bm_ball(bm, -0.004, s * 0.170, 1.392, 0.064, 0.070, 0.068,
                rows=12, seg=22)
    # Trapezius: the slope from neck to shoulder, and the wedge of it that fills
    # the hollow behind the collarbone. Carried higher and further in than the
    # first cut, which left the neck standing out of the shoulders like a post.
    for s in (1, -1):
        bm_ball(bm, -0.016, s * 0.085, 1.428, 0.080, 0.100, 0.062, rows=8, seg=16)
    # Glutes. Flatter than the first cut, which had them sticking out far enough
    # that the figure looked like it was leaning forward.
    for s in (1, -1):
        bm_ball(bm, -0.078, s * 0.072, 0.842, 0.046, 0.078, 0.086, rows=10, seg=18)
    # Belly. Slightly proud, slightly low — nobody you meet on a beach is flat —
    # but *slightly*: at 44 mm this was a paunch stuck on the front of the ribs.
    bm_ball(bm, 0.082, 0.0, 1.062, 0.024, 0.108, 0.092, rows=10, seg=20)
    # Quadriceps and hamstring, so a thigh is not a cone. The front mass sits
    # high and outboard, the back one low and inboard.
    # Resized against the thicker thigh: these are meant to shape the loft from
    # inside, not to stand proud of it. The hamstring in particular sat 14 mm
    # out of the back of the old thin thigh and read as a lump.
    for s in (1, -1):
        bm_ball(bm, 0.040, s * 0.100, 0.706, 0.052, 0.058, 0.118, rows=11, seg=18)
        bm_ball(bm, -0.040, s * 0.086, 0.668, 0.046, 0.060, 0.110, rows=11, seg=18)
    return new_object(bm, "shaping", smooth=True)


def neck_head():
    """Neck, skull, jaw, nose and ears.

    The jaw and the brow are what make a head read as a head at fifteen metres —
    an ellipsoid with hair on it reads as an egg. The nose is four millimetres of
    silhouette and is worth more than any of the rest of it.
    """
    bm = bmesh.new()
    # Neck. Thick, and it leans forward — a vertical cylinder puts the head on a
    # spike. It runs up *into* the jaw rather than stopping under it, so the
    # remesh has something to weld the two together through.
    # The neck does not stop at the jaw. It runs up *behind* it to the base of
    # the skull, which is level with the ear and a good three centimetres back
    # of the chin — so the column leans backward as it rises. A neck modelled as
    # a vertical cylinder ending at the jawline gives you a head sitting on a
    # post, which is exactly what the first cut looked like.
    bm_loft(bm, [
        (1.386, 0.072, 0.078, -0.008),
        (1.430, 0.062, 0.067, -0.006),
        (1.478, 0.055, 0.058, -0.002),
        (1.530, 0.052, 0.055, 0.000),
        (1.580, 0.052, 0.054, -0.010),   # already tucking in behind the jaw
        (1.625, 0.050, 0.052, -0.026),   # and into the skull base
    ], seg=SEGL, power=2.3)
    # The underside of the jaw, as a cone opening upward from the neck into the
    # jawline. This is the piece that was simply absent. bm_loft caps its ends,
    # so the face stack below had a flat disc across its bottom and the neck a
    # flat disc across its top; the two met as a horizontal shelf under the chin
    # with a visible step, and no amount of adjusting either one helps, because
    # what is wrong is that there was nothing in between them.
    # It has to *undercut*. The jaw stands about 26 mm forward of the throat
    # below it, and that overhang is the jawline — the single line that says
    # where a head stops and a neck starts. Built as a plain cone rising
    # straight from neck to jaw it fills the hollow instead of leaving it, and
    # the two merge into one long tapering mass with no chin at all, which is
    # what the first attempt at this did.
    bm_loft(bm, [
        (1.462, 0.052, 0.056, -0.004),
        (1.502, 0.052, 0.056, -0.002),   # throat, held well back
        (1.538, 0.059, 0.060, 0.002),
        (1.574, 0.068, 0.065, 0.009),    # and out under the jaw
    ], seg=SEGL, power=2.4)
    # Sternocleidomastoid: the pair of cords from the notch between the
    # collarbones, up and back to behind the ear. They are most of why a neck
    # reads as a neck rather than as a length of pipe, and they carry the
    # turn — when the head rotates, these are what shows.
    for s in (1, -1):
        bm_loft(bm, [
            (1.398, 0.026, 0.018, 0.034, s * 0.038),
            (1.462, 0.024, 0.017, 0.024, s * 0.047),
            (1.528, 0.021, 0.015, 0.004, s * 0.054),
            (1.582, 0.019, 0.013, -0.016, s * 0.056),
        ], seg=14, power=2.0)
    # The face, as a stack of rings from chin to brow. This replaces the two
    # balls the first cut used for jaw and chin, which between them built a
    # muzzle: a ball is round in plan and a human jaw is a flat-fronted arch, so
    # any sphere big enough to be a jaw is also a snout. `power` well above 2 is
    # what makes the front of the face a plane.
    # It starts at 1.548, *below* the top of the neck, on purpose. Voxel remesh
    # only unions what overlaps: leave a 27 mm gap between the neck and the jaw
    # at a 5 mm voxel and you get a hole through the throat.
    #
    # The step from the neck's 52 mm half-width to the jaw's 66 mm over 18 mm of
    # height is the jawline. Without it the chin flows straight into the neck
    # and the whole head reads as a long mask — which is what the first cut did.
    bm_loft(bm, [
        # A small ring tucked under the chin, so the bottom of this stack is a
        # rounded underside rather than a 100 mm disc lying flat on the neck.
        (1.528, 0.032, 0.026, 0.014),
        # The chin projects. At 0.016 it sat 11 mm *behind* the mouth station,
        # which is a receding jaw and reads as weak from every angle.
        #
        # Raised 10 mm from the first pass as well: chin to brow was 148 mm
        # against a real 120, and a lower face that long reads as a muzzle no
        # matter how good the jawline above it is.
        (1.558, 0.054, 0.048, 0.024),   # chin
        (1.584, 0.067, 0.062, 0.016),   # jaw
        (1.604, 0.075, 0.071, 0.006),   # mouth
        (1.632, 0.081, 0.076, 0.000),   # cheekbones, the widest station
        (1.662, 0.083, 0.077, -0.003),  # brow
        (1.690, 0.078, 0.072, -0.008),
    ], seg=24, power=2.7)
    # The cranium sits *behind* and *above* the face, and is deeper than it is
    # wide. A head that is as wide as it is deep reads as a ball with a face
    # painted on the front.
    bm_ball(bm, -0.012, 0.0, 1.678, 0.086, 0.076, 0.076,
            rows=14, seg=24, squash_bottom=0.72)
    # The nose: 12 mm of silhouette and worth more than the rest of the face put
    # together, because it is the only part of a head visible in profile at
    # fifteen metres.
    # Brow ridge, tying the bridge of the nose into the forehead.
    bm_ball(bm, 0.062, 0.0, 1.668, 0.024, 0.066, 0.016, rows=7, seg=16)
    # Ears. Flat, set back and level with the nose; they cost almost nothing and
    # their absence is loud.
    for s in (1, -1):
        bm_ball(bm, -0.034, s * 0.072, 1.634, 0.023, 0.008, 0.029, rows=8, seg=14)
    return new_object(bm, "head", smooth=True)


def nose():
    """Bridge, dorsum, tip, wings, columella and two nostrils.

    The stations are anthropometric. The root sits at eye level, the base 54 mm
    below it, and the tip stands about 17 mm proud of the plane of the cheeks —
    a nose is one of the few features where being 5 mm out is visible from
    across a room, because it is the only part of a face you see in profile.

    Note what is *not* a ring stack here. The first version of this was a
    three-ring loft and nothing else, which gives a wedge: no tip, no wings, and
    a flat underside where the nostrils should be. The lower nose is three
    rounded masses — a lobule with a wing either side — and no amount of ring
    tuning imitates that, because a ring is convex all the way round and the
    thing being modelled is a cloverleaf.
    """
    bm = bmesh.new()
    # The dorsum: narrow at the root between the eyes, widening downward.
    bm_loft(bm, [
        (1.5960, 0.0170, 0.0115, 0.0720),
        (1.6120, 0.0210, 0.0120, 0.0780),   # supratip break
        (1.6300, 0.0190, 0.0105, 0.0760),
        (1.6480, 0.0160, 0.0090, 0.0700),   # the root, at eye level
    ], seg=20, power=2.2)
    # The lobule — the ball of the tip.
    bm_ball(bm, 0.0855, 0.0, 1.6065, 0.0115, 0.0125, 0.0105, rows=14, seg=22)
    # The wings, flaring out and back from it.
    for s in (1, -1):
        bm_ball(bm, 0.0762, s * 0.0148, 1.5972, 0.0105, 0.0086, 0.0096,
                rows=12, seg=18)
    # The columella, the strip of it that divides the nostrils.
    bm_loft(bm, [
        (1.5905, 0.0090, 0.0042, 0.0800),
        (1.6015, 0.0102, 0.0048, 0.0835),
    ], seg=14, power=2.0)
    out = [(new_object(bm, "nose", smooth=True), SKIN_M, SKIN_P, 0)]

    # The nostrils themselves, as colour rather than as holes. At 12 mm by 9 mm
    # they are four voxels across, which the remesh would render as two dimples
    # — and a dimple lit from above reads as a highlight, not an opening. Paint
    # is unambiguous and costs nothing.
    # They belong on the *underside*. Set at the height of the wings they read
    # as two dark spots painted on the front of the nose; a nostril is a hole
    # facing the ground, and from straight on you should see little more than
    # its rim.
    #
    # And the cutter runs vertically, not forward like every other one on this
    # figure. The rule is that a cutter has to cross the surface steeply, and
    # the surface here points at the floor — an X-deep needle lies flat along
    # it and paints nothing at all, which is what happened the first time.
    for s in (1, -1):
        n = bmesh.new()
        # Bounded tightly at the bottom. Run long — the first vertical needle
        # was 60 mm and reached down past the lips to the chin, where the
        # surface curves back inside its X range, and painted two dark spikes
        # hanging off the jaw. A cutter is unbounded in the direction it cuts
        # and must be *tight* in the other two, including along its own axis.
        bm_ball(n, 0.0740, s * 0.0084, 1.6000, 0.0055, 0.0046, 0.0150,
                rows=10, seg=16)
        out.append((new_object(n, "nostril%s" % ("L" if s > 0 else "R"),
                               smooth=True), NOSE_M, NOSE_P, 4))
    return out


def eyes():
    """Lids, eyeball, and the sclera/iris/pupil/lash line as paint.

    The division of labour here is the whole trick, and the first version got it
    wrong by having no lids at all — just a white ball and a dark ball set proud
    of the face, which is a pair of buttons sewn onto a head.

    *Geometry* supplies the parts big enough to survive a 3 mm voxel: the swell
    of the eyeball, the fold of the upper lid above it, the ridge of the lower
    lid beneath. Those three masses are what make an eye sit in a face rather
    than on it.

    *Paint* supplies the parts that do not survive: the palpebral fissure —
    the almond of white actually showing between the lids — and the iris, pupil
    and lash line within it. Built as geometry, an 8 mm gap between two lids at
    a 3 mm voxel closes up; built as colour it is exact, because `repaint` asks
    which volume the finished surface passes through and gets a crisp answer at
    any size. It is also how a real eye reads at four metres: an almond of tone,
    not a sphere.

    Sizes are life-size. The fissure is 33 by 12 mm, the iris 11.6 mm, the pupil
    5 mm — and the iris is deliberately larger relative to the opening than
    feels right on paper, because an iris that does not touch both lids reads as
    a stare.
    """
    out = []
    for s in (1, -1):
        tag = "L" if s > 0 else "R"
        y = s * 0.0335

        # ── the masses ──────────────────────────────────────────────────────
        g = bmesh.new()
        # The globe. Proud of the cheek rather than recessed: a socket needs a
        # boolean subtraction and voxel remeshing only ever unions.
        bm_ball(g, 0.0660, y, 1.6465, 0.0140, 0.0160, 0.0130, rows=14, seg=22)
        # Upper lid, and the fold of skin above it. Carried further forward than
        # the globe so the lash line sits under an overhang and the eye gets a
        # shadow across its top, which is most of what makes one look wet.
        bm_ball(g, 0.0706, y, 1.6580, 0.0152, 0.0198, 0.0082, rows=12, seg=20)
        # Lower lid.
        bm_ball(g, 0.0692, s * 0.0325, 1.6358, 0.0140, 0.0182, 0.0062,
                rows=12, seg=20)
        # The orbital rim, outboard — the cheekbone climbing to the temple. It
        # is what stops the eye reading as stuck on the front of a smooth ball.
        bm_ball(g, 0.0560, s * 0.0560, 1.6470, 0.0180, 0.0130, 0.0230,
                rows=12, seg=18)
        out.append((new_object(g, "orbit" + tag, smooth=True),
                    SKIN_M, SKIN_P, 0))

        # ── the paint ───────────────────────────────────────────────────────
        # All four run deep into the skull along X and are tight in Y and Z.
        # Each is a punch, and what gets painted is the shape of its cross
        # section where the finished surface passes through it.
        for name, mark, prev, prio, c, r in (
            ("sclera", EYE_M, EYE_P, 3,
             (0.0550, y, 1.6465), (0.0450, 0.0165, 0.0062)),
            ("iris", IRIS_M, IRIS_P, 4,
             (0.0580, y, 1.6462), (0.0450, 0.0058, 0.0058)),
            ("pupil", PUPIL_M, PUPIL_P, 5,
             (0.0600, y, 1.6462), (0.0450, 0.0026, 0.0026)),
            # The upper lash line. In the hair's colour group so it follows the
            # figure's hair, and it does more for an eye than the iris does —
            # it is the dark edge that says there is an opening here.
            ("lash", HAIR_M, HAIR_P, 4,
             (0.0550, y, 1.6528), (0.0450, 0.0168, 0.0024)),
        ):
            b = bmesh.new()
            bm_ball(b, c[0], c[1], c[2], r[0], r[1], r[2], rows=10, seg=18)
            out.append((new_object(b, name + tag, smooth=True),
                        mark, prev, prio))
    return out


def mouth():
    """Lips, philtrum, and the line between them.

    Simply absent from every earlier version, which is a strange thing to leave
    off a face and not notice — but a blank lower face reads as *smooth* rather
    than as *missing*, so nothing draws the eye to it until somebody says so.

    The stations follow the classical thirds: brow to nose base to chin in equal
    parts, with the mouth line one third of the way down from the nose base to
    the chin. That last one is the ratio that matters. Put the mouth halfway and
    the face turns simian; put it too high and it reads as a child.

    The lips are skin — they are skin — and take the skin marker, so they follow
    the figure's own tone rather than being painted a colour that would only
    suit one complexion. What is painted is the *opening*, which is shadow.
    """
    bm = bmesh.new()
    # Upper lip: thinner than the lower, and carrying the two lobes of the
    # cupid's bow. Set 5 mm proud of the face beneath it.
    bm_ball(bm, 0.0740, 0.0, 1.5810, 0.0130, 0.0240, 0.0072, rows=12, seg=22)
    for s in (1, -1):
        bm_ball(bm, 0.0752, s * 0.0082, 1.5828, 0.0118, 0.0098, 0.0060,
                rows=10, seg=16)
    # Lower lip: fuller, and it sits back a little under the upper one.
    bm_ball(bm, 0.0738, 0.0, 1.5655, 0.0142, 0.0222, 0.0086, rows=12, seg=22)
    # The philtrum columns, running from the base of the nose to the bow. Two
    # ridges with a channel between them, not a groove — the channel is what is
    # left over.
    for s in (1, -1):
        bm_ball(bm, 0.0788, s * 0.0056, 1.5872, 0.0072, 0.0036, 0.0082,
                rows=8, seg=14)
    out = [(new_object(bm, "lips", smooth=True), SKIN_M, SKIN_P, 0)]

    # The mouth line. 44 mm across and 4 mm tall, which is under two voxels and
    # therefore has to be paint: as geometry the remesh closes it and the two
    # lips merge into one bar.
    #
    # Three overlapping masses rather than one, with the outer pair set lower
    # and further back. A single ellipsoid draws a dead-straight slot across the
    # face — and a straight mouth is the one feature that makes a head read as a
    # mannequin however good the rest of it is. Real mouth corners sit a couple
    # of millimetres below the centre and turn away from the viewer.
    # One object per mass, not three shells in one. `_inside` is a ray parity
    # test and parity is only valid on a single closed surface: a ray through
    # the region where two of these overlap crosses four walls, counts even, and
    # reports *outside*. That is the same trap the hair cap and nape fell into,
    # and it showed here as a mouth in three separate pieces with bare skin
    # between them.
    for i, (cx, cy, cz, rx, ry, rz) in enumerate((
        (0.0600, 0.0, 1.5744, 0.0450, 0.0140, 0.0023),
        (0.0560, 0.0168, 1.5726, 0.0450, 0.0112, 0.0021),
        (0.0560, -0.0168, 1.5726, 0.0450, 0.0112, 0.0021),
    )):
        line = bmesh.new()
        bm_ball(line, cx, cy, cz, rx, ry, rz, rows=8, seg=18)
        out.append((new_object(line, "mouthline%d" % i, smooth=True),
                    MOUTH_M, MOUTH_P, 4))
    return out


def brows():
    """Two bars above the eyes, in the hair's colour group so they follow it.

    Like the irises these are below the voxel size and survive as paint rather
    than as shape. Eyebrows are most of what a face has at conversational
    distance — take them off a photograph and the face stops reading as one.
    """
    out = []
    for s in (1, -1):
        bm = bmesh.new()
        # Deep in X, so it punches clean through the forehead rather than
        # grazing it. See the note on cutters in `repaint`.
        bm_ball(bm, 0.0560, s * 0.0345, 1.6680, 0.0380, 0.0260, 0.0060,
                rows=8, seg=18)
        tag = "L" if s > 0 else "R"
        out.append((new_object(bm, "brow" + tag, smooth=True),
                    HAIR_M, HAIR_P, 3))
    return out


def hair():
    """A cap, not strands.

    Geometry hair is the honest ceiling here: there is no texture pipeline for
    characters and no alpha-tested card path, so this is a shell a few
    millimetres proud of the skull with a hairline cut across the brow.
    """
    # Two separate closed shells rather than one bmesh, because `repaint` tests
    # containment per shell and ray parity is only meaningful on one at a time.
    cap = bmesh.new()
    bm_ball(cap, -0.018, 0.0, 1.692, 0.098, 0.087, 0.080,
            rows=14, seg=24, squash_bottom=0.45)
    # The back of it, down onto the nape — a cap that stops at the skull's
    # equator leaves a bald ring above the neck.
    nape = bmesh.new()
    bm_ball(nape, -0.048, 0.0, 1.644, 0.062, 0.076, 0.066, rows=10, seg=18)
    return [(new_object(cap, "hair_cap", smooth=True), HAIR_M, HAIR_P, 2),
            (new_object(nape, "hair_nape", smooth=True), HAIR_M, HAIR_P, 2)]


def arm(side: int):
    """Shoulder to fingertips, built along -Z and rotated into the A-pose.

    Building it straight and then placing it means the radii are readable as a
    list of stations down the arm instead of being tangled up with where the arm
    happens to point. `side` is +1 for the figure's left, which is +Y.
    """
    bm = bmesh.new()
    e, w = -L_UPPER, -(L_UPPER + L_FORE)
    b = ELBOW_FWD

    # Upper arm: thickest just below the deltoid, tapering into the elbow.
    bm_loft(bm, [
        (e + 0.005, 0.043, 0.041, b),
        (e + 0.075, 0.048, 0.046, b * 0.70),
        (e + 0.150, 0.054, 0.052, b * 0.44),
        (e + 0.225, 0.059, 0.057, b * 0.22),      # biceps
        (e + 0.290, 0.062, 0.062, 0.0),
    ], seg=SEGL, power=2.1)
    # The elbow itself, as a ball, so that when the joint bends there is a
    # volume there to bend around instead of two tube ends meeting.
    bm_ball(bm, b, 0.0, e, 0.044, 0.042, 0.042, rows=9, seg=SEGL)
    # Forearm. The bulk is at the top and on the thumb side, and it turns oval
    # into a wrist that is markedly flatter than it is wide.
    bm_loft(bm, [
        (w + 0.006, 0.026, 0.034, 0.004, side * 0.002),
        (w + 0.070, 0.031, 0.038, 0.004, side * 0.003),
        (w + 0.140, 0.039, 0.044, b * 0.35, side * 0.004),
        (w + 0.205, 0.045, 0.048, b * 0.72, side * 0.003),
        (w + 0.256, 0.046, 0.047, b, side * 0.000),
    ], seg=SEGL, power=2.2)

    # ── the hand ────────────────────────────────────────────────────────────
    # Worth building properly: at ten figures on a beach instead of ninety you
    # get close enough to count them, and a mitten at two metres is as bad as a
    # seam at the elbow.
    palm_top, palm_bot = w, w - 0.088
    bm_loft(bm, [
        (palm_bot, 0.014, 0.043, 0.006, 0.0),
        (palm_bot + 0.030, 0.016, 0.045, 0.005, 0.0),
        (palm_top - 0.020, 0.019, 0.040, 0.003, 0.0),
        (palm_top, 0.022, 0.035, 0.000, 0.0),
    ], seg=18, power=2.6)

    # Four fingers, splayed a couple of degrees so the remesh keeps the gaps.
    # Index is longest, little is shortest and set lowest on the palm.
    for k, (dy, ln, rad, drop) in enumerate([
        (0.031, 0.078, 0.0105, 0.000),
        (0.011, 0.084, 0.0110, 0.000),
        (-0.010, 0.079, 0.0105, 0.002),
        (-0.030, 0.062, 0.0092, 0.008),
    ]):
        y0 = side * dy
        spread = side * dy * 0.28          # they fan out, they do not stay parallel
        tip = palm_bot - drop - ln
        bm_loft(bm, [
            (tip, rad * 0.72, rad * 0.72, 0.006, y0 + spread),
            (tip + ln * 0.36, rad * 0.90, rad * 0.92, 0.005, y0 + spread * 0.6),
            (tip + ln * 0.72, rad, rad, 0.004, y0 + spread * 0.3),
            (palm_bot - drop, rad * 1.05, rad * 1.05, 0.003, y0),
        ], seg=SEGF, power=2.0)

    # The thumb: off the side of the palm, forward and down, and opposed. It is
    # the one that decides whether a hand reads as a hand.
    bm_ball(bm, 0.010, side * 0.040, palm_top - 0.030, 0.020, 0.020, 0.026,
            rows=8, seg=14)
    bm_loft(bm, [
        (palm_top - 0.108, 0.013, 0.013, 0.030, side * 0.062),
        (palm_top - 0.078, 0.015, 0.015, 0.024, side * 0.058),
        (palm_top - 0.046, 0.018, 0.018, 0.014, side * 0.048),
        (palm_top - 0.024, 0.020, 0.021, 0.006, side * 0.040),
    ], seg=SEGF, power=2.0)

    ob = new_object(bm, "arm%s" % ("L" if side > 0 else "R"), smooth=True)
    ob.rotation_euler = (side * A_POSE, 0.0, 0.0)
    ob.location = (0.0, side * Y_SHOULDER, Z_SHOULDER)
    return ob


def leg(side: int):
    """Hip to toe, in world space — a standing leg is near enough vertical that
    rotating it in would only obscure the numbers."""
    y = side * Y_HIP
    bm = bmesh.new()
    # Thigh. Widest high and to the outside; the sweep inward toward the knee is
    # most of what makes a standing figure look like it has weight on it.
    k = KNEE_FWD
    # Thigh. These are set from circumference rather than by eye, because by eye
    # is how the first cut ended up 13% under everywhere and reading as a limb
    # that had wasted: 540 mm around the middle of the thigh and 600 mm at the
    # top, which for a section slightly deeper than it is wide gives the half-
    # widths below. The taper into the knee is steep — a thigh loses a third of
    # its girth in the last hand's breadth — and getting *that* wrong is what
    # makes a leg read as a tube with a bump on it.
    bm_loft(bm, [
        (Z_KNEE - 0.005, 0.060, 0.058, k, y * 1.02),
        (0.560, 0.072, 0.070, k * 0.78, y * 1.04),
        (0.640, 0.083, 0.079, k * 0.52, y * 1.05),
        (0.720, 0.091, 0.086, k * 0.30, y * 1.04),
        (0.800, 0.097, 0.091, k * 0.12, y * 1.00),
        (0.880, 0.100, 0.096, 0.000, y * 0.94),
    ], seg=SEGL, power=2.2)
    # The knee. Flattened front to back rather than spherical: a ball here
    # bulges fore and aft where the limb is tapering and reads as a joint pinned
    # on rather than a knee.
    bm_ball(bm, k, y * 1.02, Z_KNEE, 0.052, 0.057, 0.052, rows=10, seg=SEGL)
    bm_ball(bm, k + 0.038, y * 1.02, Z_KNEE + 0.012, 0.022, 0.036, 0.036,
            rows=8, seg=14)
    # Shin and calf. The belly of the calf sits *behind* and *high* — forward is
    # +X, so it is a negative offset, and it is at a third of the shin, not half.
    bm_loft(bm, [
        (Z_ANKLE, 0.037, 0.035, 0.006, y * 1.00),
        (0.140, 0.045, 0.043, 0.002, y * 1.00),
        (0.215, 0.054, 0.054, -0.005, y * 1.00),
        (0.285, 0.060, 0.061, -0.008, y * 1.01),   # the belly of the calf
        (0.360, 0.057, 0.057, -0.002, y * 1.02),
        (0.435, 0.055, 0.054, k * 0.55, y * 1.02),
        (Z_KNEE + 0.005, 0.056, 0.055, k, y * 1.02),
    ], seg=SEGL, power=2.15)
    # Ankle bone, heel, and the foot as a wedge that thins toward the toes.
    bm_ball(bm, 0.004, y, Z_ANKLE, 0.038, 0.036, 0.036, rows=8, seg=16)
    bm_ball(bm, -0.038, y, 0.046, 0.036, 0.034, 0.044, rows=8, seg=16)
    bm_loft(bm, [
        (0.004, 0.102, 0.040, 0.056, y),      # the sole, heel -0.046 to ball 0.158
        (0.030, 0.114, 0.045, 0.046, y),
        (0.060, 0.101, 0.043, 0.026, y),
        (0.088, 0.070, 0.037, 0.004, y),
    ], seg=18, power=3.0)
    # The instep. Without it the top of the foot is a flat lid and the whole
    # thing reads as a paddle bolted to the shin.
    bm_ball(bm, 0.030, y, 0.062, 0.046, 0.036, 0.030, rows=8, seg=14)
    # The toes, as one mass. Five separate ones at this scale is detail nobody
    # will ever resolve and five more chances for the remesh to weld something.
    bm_ball(bm, 0.156, y * 1.03, 0.021, 0.032, 0.039, 0.021, rows=7, seg=14)
    return new_object(bm, "leg%s" % ("L" if side > 0 else "R"), smooth=True)


def trunks():
    """Swim shorts: a second skin a few millimetres proud of the first.

    Proud rather than painted on, exactly as bather.py has it, so the hem and
    the waistband read as an edge with a catch-light instead of as a stripe. The
    remesh unions them into the body, so what survives is the *step*, which is
    all that was ever wanted.
    """
    seat = bmesh.new()
    # The seat and waistband: one mass, correctly, because above the crotch a
    # pair of shorts *is* one tube. It stops at 0.805 — a hair above Z_CROTCH —
    # and that is the whole difference between shorts and the skirt the first
    # cut produced, which spanned both thighs all the way down to the hem.
    bm_loft(seat, [
        # A narrow ring down in the crotch, tapered so it hugs rather than
        # spanning both thighs. Without it there is a patch between the legs
        # that lies inside neither the seat nor either leg tube, and `repaint`
        # quite correctly calls it skin — a bare rectangle in the worst
        # imaginable place.
        # The widest station is 0.850, and it has to clear 187 mm — not the
        # torso's 163 mm at that height but the *thigh tops*, which stand
        # proud of the hip. Sized to the torso instead, the seat came out
        # narrower than what was inside it and the leg tubes had to swell
        # sideways to cover, which put a lobe on each hip.
        (0.756, 0.118, 0.112, 0.008),
        (0.805, 0.132, 0.180, 0.004),
        (0.850, 0.135, 0.187, 0.004),
        (0.900, 0.133, 0.184, 0.002),
        (0.945, 0.126, 0.166, 0.000),
        (0.972, 0.122, 0.156, 0.000),            # waistband
    ], seg=SEG, power=2.5)
    # The fullness at the front of the crotch.
    #
    # Without it the shorts close across the front as a flat blank panel, and a
    # flat front below a narrow waist reads unambiguously as a woman — which is
    # what the figure was doing, whatever the shoulders were saying. It is one
    # of the small number of places where a couple of centimetres decides the
    # sex of a silhouette, so it is worth getting in rather than leaving to the
    # viewer's charity.
    #
    # Kept as a single soft mass sitting low and forward, and set to protrude
    # about a centimetre past the front of the seat: enough to catch light and
    # break the panel, not so much that it becomes the thing you look at.
    bulge = bmesh.new()
    bm_ball(bulge, 0.100, 0.0, 0.778, 0.044, 0.046, 0.058, rows=12, seg=20)
    out = [(new_object(seat, "trunks_seat", smooth=True), SUIT_M, SUIT_P, 2),
           (new_object(bulge, "trunks_front", smooth=True), SUIT_M, SUIT_P, 2)]
    # Then one leg each, below the crotch, so there is a gap between them you
    # can see daylight through.
    for s in (1, -1):
        y = s * 0.094
        bm = bmesh.new()
        # The hem sits at 0.672 — a little longer than the first cut — and the
        # openings are sized off the *new* thigh. Eighteen millimetres of drape
        # all round was what made these read as a nappy: a garment that stands
        # away from the limb inside it says the limb has shrunk.
        bm_loft(bm, [
            (0.672, 0.098, 0.094, 0.006, y * 1.05),   # the hem
            (0.700, 0.101, 0.097, 0.006, y * 1.05),
            (0.760, 0.105, 0.101, 0.005, y * 1.02),
            # Runs well up inside the seat rather than just meeting it. Seven
            # millimetres of overlap at a 5 mm voxel left points on the front of
            # the crotch inside neither volume, and `repaint` correctly called
            # them skin — a bare stripe across the front of the shorts.
            #
            # Tapered in at the top so it finishes *inside* the seat rather than
            # bursting out of its side, which is the other half of the lobe.
            (0.868, 0.120, 0.092, 0.004, y * 0.96),
        ], seg=SEGL, power=2.4)
        out.append((new_object(bm, "trunks_%s" % ("L" if s > 0 else "R"),
                               smooth=True), SUIT_M, SUIT_P, 2))
    return out


# --------------------------------------------------------------------------- #
#  primitives -> one skin                                                      #
# --------------------------------------------------------------------------- #

def weld(parts, voxel: float, tris: int):
    """Join, remesh to one continuous surface, smooth, decimate.

    Returns the single skinned-to-be object. This is the step the rigid pipeline
    cannot do: after it there is exactly one surface and no seam at any joint,
    which is the whole reason for the file.
    """
    # Round the primitives off before the mesher ever sees them.
    #
    # A ring table is a coarse thing: the torso is fourteen rings of thirty
    # segments, so its quads are roughly 50 mm by 33 mm. At a 5 mm voxel the
    # remesh could not resolve them and they vanished; at 4.2 mm it resolves
    # them perfectly and the finished chest came out visibly quilted — dropping
    # the voxel size made the model *worse*, which is not the direction that
    # knob is supposed to work in.
    #
    # Two levels of Catmull-Clark puts the facets an order of magnitude below
    # the voxel and the problem disappears at the source. It costs nothing that
    # matters: the remesh throws all of this geometry away regardless.
    for rec in parts:
        ob = rec[0]
        bpy.context.view_layer.objects.active = ob
        sub = ob.modifiers.new("sub", "SUBSURF")
        # Three levels, not two. The voxel came down to 3 mm to hold a lip and
        # an eyelid, and a facet the mesher can resolve is a facet it will
        # faithfully reproduce — two levels leaves them at about 3.5 mm on the
        # face, which is exactly the size that would quilt again.
        sub.levels = sub.render_levels = 3
        bpy.ops.object.modifier_apply(modifier="sub")

    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for rec in parts:
        rec[0].select_set(True)
    body = parts[0][0]
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = "human"

    m = body.modifiers.new("remesh", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = voxel
    m.use_smooth_shade = True
    # Smooth before decimating, not after: the decimator will happily collapse a
    # voxel staircase into a jagged one and then there is nothing left to relax.
    # Lighter than it used to be: with the primitives subdivided there are no
    # facets left to relax, and heavy smoothing at this density starts eating
    # the nose and the fingers.
    s = body.modifiers.new("relax", "SMOOTH")
    s.factor = 0.25
    s.iterations = 1
    bpy.ops.object.modifier_apply(modifier="remesh")
    bpy.ops.object.modifier_apply(modifier="relax")

    # Count triangles, not faces. The remesh returns quads and the collapse
    # decimator triangulates on the way through, so a ratio computed off
    # `len(polygons)` overshoots by almost exactly two.
    have = sum(len(p.vertices) - 2 for p in body.data.polygons)
    if have > tris:
        d = body.modifiers.new("decimate", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = tris / have
        bpy.ops.object.modifier_apply(modifier="decimate")
    refine_head(body)

    # The decimator leaves broad flat triangles wherever curvature is low, and
    # smooth-shading those across a real crease smears it. Auto-smooth keeps the
    # hem of the trunks and the edge of the jaw hard and everything else soft.
    body.data.use_auto_smooth = True
    body.data.auto_smooth_angle = math.radians(58.0)
    return body


def refine_head(body, above=1.50, cuts=2):
    """Subdivide the head, and only the head.

    Colour on this model is a per-vertex attribute, so the smallest feature that
    can be painted is one vertex across — and after decimation the face carries
    triangles about 5 mm on a side. A pupil is 5 mm. An eyelash line is 4 mm
    tall. Every one of them came out as a single blocky triangle or two, and no
    amount of care in the sculpt survives being sampled that coarsely.

    Raising the resolution everywhere to fix a face is the wrong trade: the
    shins and the back do not need it and would carry most of the cost. So the
    head — about five per cent of the surface — is subdivided twice on its own,
    which puts roughly a millimetre between vertices there and leaves the rest
    of the body alone.

    Done after decimation, deliberately, or the decimator would simply undo it.
    """
    bm = bmesh.new()
    bm.from_mesh(body.data)
    edges = set()
    for f in bm.faces:
        if f.calc_center_median().z > above:
            edges.update(f.edges)
    if edges:
        bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=cuts,
                                  use_grid_fill=True)
    bm.to_mesh(body.data)
    bm.free()
    return body


_RAY = Vector((0.5771, 0.5774, 0.5777)).normalized()   # nothing axis-aligned


def _inside(tree, p):
    """Is `p` within this closed volume? Ray parity.

    Cast one ray and count how many times it leaves. Odd means it started
    inside. The direction is deliberately not axis-aligned: a ray along +Z
    through this figure would graze a great many rings edge-on and each graze is
    a coin toss between one crossing and two.
    """
    o, n = p.copy(), 0
    while n < 64:
        loc, _nrm, _idx, _d = tree.ray_cast(o, _RAY)
        if loc is None:
            return n % 2 == 1
        n += 1
        o = loc + _RAY * 1e-5
    return False


def coatings(parts, voxel):
    """A BVH per *closed primitive* that sits on top of the skin.

    Per primitive and not per colour, because ray parity is only valid on a
    single closed shell — hair is a cap plus a nape, and a ray through the
    region where those two overlap crosses four surfaces, which parity reads as
    outside. Testing them separately and OR-ing the answers is the union.

    Also returns each one's bounding box, so `repaint` can skip the twenty
    thousand vertices that are obviously nowhere near the hairline.
    """
    # Setting ob.location/rotation_euler does not refresh matrix_world — that
    # happens on the next depsgraph evaluation. Without this the arms are
    # snapshotted at the origin in their unrotated build frame and the figure
    # comes out with swimwear splashed up its forearms.
    bpy.context.view_layer.update()
    out = []
    for ob, mark, prev, prio in parts:
        if not prio:
            continue
        mw = ob.matrix_world
        vs = [mw @ v.co for v in ob.data.vertices]
        fs = [[i for i in p.vertices] for p in ob.data.polygons]
        pad = voxel * 1.5
        lo = Vector((min(v[a] for v in vs) - pad for a in range(3)))
        hi = Vector((max(v[a] for v in vs) + pad for a in range(3)))
        out.append((BVHTree.FromPolygons(vs, fs, all_triangles=False),
                    mark, prev, prio, lo, hi, (lo + hi) * 0.5))
    out.sort(key=lambda r: r[3])
    return out


def repaint(body, coats, voxel):
    """Put the colours back after the remesh threw them away.

    Each vertex is pushed a little way *under* the finished surface along its
    own normal and then asked which coating volume it is inside. Highest
    priority wins, and anything inside nothing is skin.

    Two earlier versions of this were wrong in instructive ways. Nearest source
    *vertex* fails because vertex density varies by an order of magnitude
    between a 24-segment skull and a 6-ring pair of trunks. Nearest source
    *surface* fails more subtly: the trunks sit millimetres proud of the hips
    and the hair millimetres proud of the skull, so along those boundaries both
    candidates are nearer to each other than the remesh's own wander, and the
    answer alternates vertex to vertex. Both produced a hairline and a hem that
    looked gnawed.

    Containment has no such ambiguity. A point is inside the hair or it is not,
    and the boundary is wherever the hair shell actually ends — which is a
    modelling decision, where it belongs, rather than an artefact of sampling.

    ── paint volumes must be cutters, not blobs ────────────────────────────────

    One rule governs every volume in the list, and breaking it costs a day.
    A painted feature has to run *deep* — well inside the body, crossing the
    finished surface at a steep angle — so that the surface slices through its
    middle and comes out with a clean edge. What gets painted is the cross
    section.

    The failure is a volume that merely grazes the skin. Sized to look like the
    feature it represents — a brow 12 mm deep sitting just under a forehead
    80 mm out — it is very nearly tangent, so along its whole rim the surface
    and the volume run parallel and "inside or outside" turns on tenths of a
    millimetre of remesh wander. Every one of those features came back with a
    fuzzy halo round it: the eyebrows, the lash line, the mouth, the nostrils.

    So the eye, brow, mouth and nostril volumes below are all 60-odd millimetres
    deep along X and only millimetres in Y and Z. They look nothing like the
    features they paint, and that is correct: their *silhouette* is the feature,
    and their depth is what makes the edge sharp.
    """
    me = body.data
    for name in ("mark", "prev"):
        if name in me.color_attributes:
            me.color_attributes.remove(me.color_attributes[name])
    a_mark = me.color_attributes.new("mark", "FLOAT_COLOR", "POINT")
    a_prev = me.color_attributes.new("prev", "FLOAT_COLOR", "POINT")
    # How far under the surface to ask the question, and it wants to be *small*.
    # Only enough to get clear of the boundary itself — after the relax pass the
    # surface is smooth to well under a millimetre, so 1.2 mm is ample.
    #
    # Both larger values tried here fringed the waistband, for opposite reasons.
    # Diving 4 mm along the inward normal walks a vertex on the hem sideways out
    # of the shorts and into the thigh. Diving 4 mm toward the garment's centre
    # instead — which fixes the hem — walks a vertex on the *belly*, just above
    # the waistband, down inside it, and paints a stripe of swimwear onto the
    # stomach. A short normal-dive has neither failure.
    dive = 0.0012
    for i, v in enumerate(me.vertices):
        p = v.co - v.normal * dive
        mark, prev = SKIN_M, SKIN_P
        for tree, m, pr, _prio, lo, hi, _mid in coats:
            if not (lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y
                    and lo.z <= p.z <= hi.z):
                continue
            if _inside(tree, p):
                mark, prev = m, pr
        a_mark.data[i].color = (*mark, 1.0)
        a_prev.data[i].color = (*prev, 1.0)
    return body


# --------------------------------------------------------------------------- #
#  the skeleton                                                                #
# --------------------------------------------------------------------------- #

def bones():
    """Twenty-five joints, against the old eleven.

    What the extra fourteen buy, in order of how much they matter:

      spine01/02/chest  a back that bends and twists. One rigid torso is why
                        the old figures walk like they are carrying a plank.
      footL/R, toeL/R   an ankle. Without one the foot is a board welded to the
                        shin, the heel never strikes and the toe never rolls,
                        and that alone reads as stilts at any distance.
      clavicleL/R       the shoulder girdle rides up and forward when the arm
                        does. Fix the clavicle and the deltoid tears.
      handL/R, thumbL/R a wrist that is not the end of the arm.
      neck, jaw         a head that turns on a neck rather than on a spike, and
                        a mouth that can open.

    Returned as (name, parent, head, tail) with parents before children, in
    Blender space: +X forward, +Y the figure's left, +Z up.
    """
    ey, ez = _elbow_y(), _elbow_z()
    wy, wz = _wrist_y(), _wrist_z()
    B = [
        ("pelvis", None, (0, 0, Z_HIP), (0, 0, 0.985)),
        ("spine01", "pelvis", (0, 0, 0.985), (0, 0, 1.090)),
        ("spine02", "spine01", (0, 0, 1.090), (0, 0, 1.195)),
        ("chest", "spine02", (0, 0, 1.195), (0, 0, Z_SHOULDER)),
        ("neck", "chest", (0, 0, Z_SHOULDER), (0, 0, Z_NECK + 0.055)),
        ("head", "neck", (0, 0, Z_NECK + 0.055), (0, 0, Z_TOP - 0.035)),
        # A jaw hinges at the ear, not at the chin. Getting this wrong makes a
        # mouth that opens by sliding the chin forward.
        ("jaw", "head", (-0.030, 0, 1.605), (0.060, 0, 1.556)),
    ]
    for s, tag in ((1, "L"), (-1, "R")):
        B += [
            ("clavicle" + tag, "chest", (0, s * 0.028, 1.395),
             (0, s * (Y_SHOULDER - 0.020), Z_SHOULDER)),
            # The elbow is set forward by ELBOW_FWD to match the geometry's
            # pre-bend. A bone chain that runs dead straight through a limb the
            # mesh has bent is worse than either on its own.
            ("armU" + tag, "clavicle" + tag, (0, s * Y_SHOULDER, Z_SHOULDER),
             (ELBOW_FWD, s * ey, ez)),
            ("armL" + tag, "armU" + tag, (ELBOW_FWD, s * ey, ez),
             (0, s * wy, wz)),
            ("hand" + tag, "armL" + tag, (0, s * wy, wz),
             (0.010, s * (wy + 0.020), wz - 0.090)),
            ("thumb" + tag, "hand" + tag,
             (0.012, s * (wy + 0.038), wz - 0.030),
             (0.030, s * (wy + 0.062), wz - 0.096)),
        ]
    for s, tag in ((1, "L"), (-1, "R")):
        y = s * Y_HIP
        B += [
            ("legU" + tag, "pelvis", (0, y, Z_HIP),
             (KNEE_FWD, y * 1.02, Z_KNEE)),
            ("legL" + tag, "legU" + tag, (KNEE_FWD, y * 1.02, Z_KNEE),
             (0, y, Z_ANKLE)),
            ("foot" + tag, "legL" + tag, (0, y, Z_ANKLE), (0.105, y, 0.026)),
            ("toe" + tag, "foot" + tag, (0.105, y, 0.026), (0.175, y, 0.020)),
        ]
    return B


# Which way each bone's local Z should point. Everything else follows from it,
# and getting it stated explicitly is the difference between a rig you can pose
# and one you have to negotiate with.
#
# Left unset, Blender computes a roll per bone from its own rest direction. For
# a limb that is a degree or two off vertical that produces axes tilted by an
# arbitrary amount, so a pure hip flexion also adducts — and the figure walks
# with its legs crossing over the midline. Nothing in the pose caused that and
# no amount of tuning the pose fixes it.
#
# Naming Z as world -X for every up-or-down bone makes local X the figure's
# left for all of them, so rotation about X is pure sagittal swing everywhere
# and the two sides finally mirror. Bones that run fore-and-aft or sideways
# instead take Z as world up, which does the same job for them.
ROLL_UP = Vector((-1.0, 0.0, 0.0))       # for bones that run up or down
ROLL_FLAT = Vector((0.0, 0.0, 1.0))      # for bones that run fore-aft or across
FLAT = ("footL", "footR", "toeL", "toeR", "clavicleL", "clavicleR",
        "thumbL", "thumbR", "jaw")


def armature():
    arm_data = bpy.data.armatures.new("rig")
    rig = bpy.data.objects.new("rig", arm_data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    made = {}
    for name, parent, head, tail in bones():
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        b.align_roll(ROLL_FLAT if name in FLAT else ROLL_UP)
        if parent:
            b.parent = made[parent]
            b.use_connect = False
        made[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def skin(body, rig):
    """Bind with automatic weights.

    Blender's bone-heat solver is genuinely good on a watertight single-surface
    mesh, which is precisely what `weld` handed it — and it is precisely why the
    remesh had to come first. Run it against the old eleven separate solids and
    it fails outright, because heat cannot diffuse across a surface that is not
    connected.
    """
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    # Relax the weights across every joint.
    #
    # Bone heat hands back a solution that is correct but *sharp*: the
    # transition from thigh to shin happens over a couple of edge loops, so at
    # forty degrees of knee flex the inside of the joint folds into a crease and
    # the outside pinches to a waist. The classic candy wrapper. Spreading each
    # weight into its neighbours widens that transition, and the joint bends
    # around a volume instead of hinging on a line.
    #
    # Eight passes at half strength is enough to fix the knees and elbows and
    # not enough to start dragging the fingers into the palm.
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.object.vertex_group_smooth(group_select_mode="ALL",
                                       factor=0.5, repeat=12, expand=0.0)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Four influences per vertex, renormalised.
    #
    # Needed twice over. Bone heat leaves a long tail of near-zero weights — a
    # rib vertex answering faintly to the wrist — and those tails are what put a
    # fan of fine wrinkles across the ribs whenever the spine twisted: not
    # geometry, since the bind pose was clean, but a hundred vertices each
    # pulled a fraction of a millimetre in an uncorrelated direction.
    #
    # And four is what the runtime will be able to afford per vertex anyway, so
    # doing it here means the previews show what will ship rather than something
    # better than what will ship.
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)


# --------------------------------------------------------------------------- #
#  posing and previews                                                         #
# --------------------------------------------------------------------------- #

def pose(rig, spec):
    """`spec` is {bone: (rx, ry, rz)} in degrees, applied as XYZ Euler.

    A pose bone's Euler is in *bone* space, where +Y runs head to tail. So:

        X   swings the bone — this is flexion, and it is the one you want
        Y   rolls it about its own length
        Z   swings it sideways

    The first version of the poses below was written with the swing on Y, which
    made every value a twist: the figure stood at attention and slowly screwed
    its own forearms round. Worth knowing before writing any more of these.

    The sign is not consistent between a bone and its child, and cannot be made
    so by inspection — Blender derives each bone's roll from its rest direction,
    and legU (hip to knee) and legL (knee to ankle) lean opposite ways in Y, so
    their X axes come out opposed. Positive X flexes the hip forward and
    *extends* the knee. Check a render rather than reasoning about it; that is
    how the first stride ended up with both knees bent backwards.
    """
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for b in rig.pose.bones:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
    for name, rot in spec.items():
        b = rig.pose.bones[name]
        b.rotation_euler = tuple(math.radians(a) for a in rot)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


# A mid-stride pose, plus the head turned and the near arm folded up. Chosen to
# put every joint the old rig could not do under the camera at once: the spine
# is twisting, the clavicle is riding, the elbow is folded past 90 degrees, the
# knee is loaded and the trailing foot is up on its toe.
STRIDE = {
    "spine01": (-3, -7, 0), "spine02": (-2, -5, 0), "chest": (-2, -4, 0),
    "neck": (2, 8, 0), "head": (1, 12, 0),
    # Arms opposite the leg on the same side, which is what stops a walk
    # looking like a march. The Z terms are adduction, bringing them in from the
    # 38-degree bind to where a walking man actually carries them — and they
    # mirror in sign, which they only do now the rolls are named.
    "armUL": (-30, 0, 26), "armLL": (-36, 0, 0), "handL": (-10, 0, 0),
    "armUR": (26, 0, -26), "armLR": (-20, 0, 0), "handR": (6, 0, 0),
    # Right leg forward and nearly straight, about to strike on the heel.
    "legUR": (-27, 0, 0), "legLR": (6, 0, 0), "footR": (14, 0, 0),
    # Left leg trailing, knee folded, heel up, pushing off the toe. This is the
    # half of a gait the old eleven-joint rig could not do at all: no ankle.
    "legUL": (18, 0, 0), "legLL": (40, 0, 0), "footL": (-24, 0, 0),
    "toeL": (24, 0, 0),
}

# The joint test: the arm raised and folded hard, so a seam would have nowhere
# to hide. This is the frame that answers the marionette question.
FOLD = {
    "clavicleL": (0, 0, -8), "armUL": (-56, 0, 10), "armLL": (-112, 0, 0),
    "handL": (-16, 0, 0), "thumbL": (0, 0, -20),
    "armUR": (6, 0, 22), "armLR": (-12, 0, 0),
    "neck": (2, 10, 0), "head": (1, 8, 0),
}

VIEWS = {
    # (azimuth about Z in degrees, elevation in degrees, target z, radius)
    "front": (0.0, 4.0, 0.95, 4.2),
    "side": (90.0, 4.0, 0.95, 4.2),
    "hero": (34.0, 8.0, 0.95, 3.9),
    "head": (28.0, 5.0, 1.618, 0.56),
    "face": (2.0, 2.0, 1.615, 0.50),
    "prof": (88.0, 2.0, 1.618, 0.54),
    "hand": (52.0, 2.0, 1.10, 0.62),
    "joint": (58.0, 8.0, 1.28, 0.95),
}


def _material(body):
    m = bpy.data.materials.new("human")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.52
    col = nt.nodes.new("ShaderNodeVertexColor")
    col.layer_name = "prev"
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    body.data.materials.clear()
    body.data.materials.append(m)


def _lights():
    # One key sun at the sort of angle the game's own sun sits at, a soft fill
    # so the shadow side is not a silhouette, and a low back light purely so the
    # outline separates from the background. The game has only the key; the
    # other two are here because this is a modelling review and an unlit edge
    # hides exactly the errors a review is looking for.
    for name, energy, rot, kind, size in [
        ("key", 4.0, (56, 0, 40), "SUN", 0.0),
        ("fill", 1.1, (72, 0, -110), "SUN", 0.0),
        ("rim", 2.4, (78, 0, 190), "SUN", 0.0),
    ]:
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        if kind == "SUN":
            d.angle = math.radians(6.0)
        ob = bpy.data.objects.new(name, d)
        ob.rotation_euler = tuple(math.radians(a) for a in rot)
        bpy.context.collection.objects.link(ob)
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.20, 0.21, 0.23, 1)
    bpy.context.scene.world = w


def render(prefix, tag, views):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_gtao = True                 # the creases, which is half the point
    sc.eevee.gtao_distance = 0.20
    sc.render.resolution_x, sc.render.resolution_y = 760, 1120
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 85                          # a portrait lens; 35 mm would barrel the figure
    cam = bpy.data.objects.new("cam", cam_d)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    out = []
    for name, (az, el, tz, rad) in views.items():
        a, e = math.radians(az), math.radians(el)
        cam.location = (math.cos(a) * math.cos(e) * rad,
                        math.sin(a) * math.cos(e) * rad,
                        tz + math.sin(e) * rad)
        d = Vector((0, 0, tz)) - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        if name in ("head", "hand", "joint", "face", "prof"):
            sc.render.resolution_x, sc.render.resolution_y = 900, 900
        else:
            sc.render.resolution_x, sc.render.resolution_y = 760, 1120
        sc.render.filepath = "%s_%s_%s.png" % (prefix, tag, name)
        bpy.ops.render.render(write_still=True)
        out.append(sc.render.filepath)
    bpy.data.objects.remove(cam)
    return out


# --------------------------------------------------------------------------- #

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    voxel, tris = VOXEL, TRIS
    if "--voxel" in argv:
        voxel = float(argv[argv.index("--voxel") + 1])
    if "--tris" in argv:
        tris = int(argv[argv.index("--tris") + 1])

    reset_scene()
    # (object, marker colour, preview colour, coating priority). Priority 0 is
    # the skin itself; anything above it is a layer lying on top, and the
    # highest one containing a given point wins.
    parts = [
        (torso(), SKIN_M, SKIN_P, 0),
        (shaping(), SKIN_M, SKIN_P, 0),
        (neck_head(), SKIN_M, SKIN_P, 0),
        (arm(1), SKIN_M, SKIN_P, 0),
        (arm(-1), SKIN_M, SKIN_P, 0),
        (leg(1), SKIN_M, SKIN_P, 0),
        (leg(-1), SKIN_M, SKIN_P, 0),
    ] + nose() + hair() + brows() + trunks() + eyes() + mouth()
    raw = sum(len(rec[0].data.polygons) for rec in parts)

    coats = coatings(parts, voxel)     # before `weld`, which joins them away
    body = weld(parts, voxel, tris)
    repaint(body, coats, voxel)
    me = body.data

    rig = armature()
    skin(body, rig)
    _material(body)
    _lights()

    n_tri = sum(len(p.vertices) - 2 for p in me.polygons)
    print("[human] primitives %d faces -> skin %d verts, %d faces, %d tris"
          % (raw, len(me.vertices), len(me.polygons), n_tri))
    print("[human] bones %d, voxel %.4f m" % (len(rig.data.bones), voxel))

    pose(rig, {})
    render(PREVIEW, "bind", {k: VIEWS[k] for k in
            ("front", "side", "hero", "head", "face", "prof")})
    pose(rig, STRIDE)
    render(PREVIEW, "stride", {k: VIEWS[k] for k in ("hero", "side")})
    pose(rig, FOLD)
    render(PREVIEW, "fold", {k: VIEWS[k] for k in ("hero", "joint", "hand")})

    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("[human] wrote %s" % BLEND)


if __name__ == "__main__":
    main()
