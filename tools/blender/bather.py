"""Build the Jadrija bathers in Blender and bake them for the game.

    blender --background --python tools/blender/bather.py

Writes build/payload/bather_m.fr3d.gz, build/payload/bather_f.fr3d.gz and
build/bathers.blend.

Everybody else in this game who is made of people got modelled properly. The
aerodrome crew are eleven rigid parts on a joint tree — tools/blender/
firefighter.py — and they walk. The people on this beach were the last hold-out:
a hundred-odd figures written out by hand as stacked frustums in 43-jadrija.js
and *baked into the concrete*, so they could not so much as turn their heads.
From the promenade that is exactly what they looked like.

So: the same eleven joints, the same names, the same pivots, and above all the
same sign convention, because that is what lets `stride()` in src/47-ground.js
drive these without knowing they are not firefighters.

    forward is +X, up is +Y, the figure's own left is -Z   (in game space)

Two rigs come out of one script. A man and a woman differ in shoulder width,
hip width, waist, hair and whether there is a top — and in nothing else, so the
joint tree is identical between them and one animation feeds both. Height is
*not* baked in: the canonical figure is 1.70 m and the runtime varies it per
instance, which is also how children fall out of the same two meshes.

── the marker palette ──────────────────────────────────────────────────────────

Vertex colours here are not colours. Three of them are markers the runtime
recognises and replaces per figure, because a beach where everyone has the same
skin, the same swimsuit and the same hair is the single loudest tell that you
are looking at a crowd of clones:

    (1, 1, 1)  white  ->  skin, multiplied by the figure's skin tone
    (0, 0, 0)  black  ->  swimwear, replaced by the figure's suit colour
    (1, 0, 0)  red    ->  hair, replaced by the figure's hair colour

Anything else is taken literally. Keep it that way: a surface authored in a
near-white or near-black shade will be silently repainted.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import (  # noqa: E402
    bevel, bm_ball, bm_box, bm_loft, export_rig, new_object, reset_scene,
)

OUT = Path(__file__).resolve().parents[2] / "build" / "payload"
BLEND = Path(__file__).resolve().parents[2] / "build" / "bathers.blend"
PREVIEW = "/tmp/bathers"

# Markers, not colours. See the module docstring.
SKIN = (1.0, 1.0, 1.0)
SUIT = (0.0, 0.0, 0.0)
HAIR = (1.0, 0.0, 0.0)

SEG = 14          # body
SEGL = 12         # limbs
SEGH = 16         # head

# Joint heights for the canonical 1.70 m figure, barefoot. Every other dimension
# is measured off these rather than invented separately, so the proportions stay
# honest when one of them moves. These are shared by both sexes on purpose: the
# rig has to be interchangeable, and 4 cm of leg length is not what tells a man
# from a woman at fifteen metres — shoulders and hips are.
Z_HIP = 0.86
Z_KNEE = 0.45
Z_WAIST = 0.96
Z_SHOULDER = 1.38
Z_ELBOW = 1.07
Z_NECK = 1.44
Y_SHOULDER = 0.190
Y_HIP = 0.098


class Body:
    """The handful of numbers that differ between the two figures.

    Deliberately small. Every extra knob here is another way for the two rigs to
    drift apart until the shared animation stops fitting one of them.
    """

    def __init__(self, female: bool):
        self.female = female
        self.tag = "bf" if female else "bm"
        # Shoulders wide and hips narrow, or the other way about. This one pair
        # of ratios is most of the silhouette.
        self.sh = 0.176 if female else 0.204        # half-width at the shoulder
        self.hip = 0.156 if female else 0.140       # half-width at the hip
        self.waist = 0.118 if female else 0.132     # and at the narrowest point
        self.limb = 0.90 if female else 1.0         # limb girth
        self.chest = female                          # a top, or bare


# --------------------------------------------------------------------------- #
#  the parts                                                                   #
# --------------------------------------------------------------------------- #

def pelvis(B: Body):
    """Hips and swimwear. The trunks are a second skin a few millimetres proud
    of the first rather than a recolouring of it, so the leg openings read as
    an edge with a catch-light instead of as a painted line."""
    items = []

    bm = bmesh.new()
    bm_loft(bm, [
        (0.70, B.hip * 0.86, B.hip * 1.03),
        (0.78, B.hip * 0.97, B.hip * 1.17),
        (0.86, B.hip, B.hip * 1.20),
        (0.94, B.hip * 0.92, B.hip * 1.10),
    ], seg=SEG, power=2.6)
    items.append((new_object(bm, "%s_hips" % B.tag, smooth=True), SKIN))

    # Bottoms sit low and narrow; trunks come further down the thigh. Both stop
    # short of the pelvis pivot at Z_HIP so the leg can swing out from under
    # them without the cloth shearing through.
    z0, z1 = (0.755, 0.925) if B.female else (0.715, 0.905)
    bm = bmesh.new()
    bm_loft(bm, [
        (z0, B.hip * 0.94, B.hip * 1.13),
        ((z0 + z1) * 0.5, B.hip * 1.02, B.hip * 1.23),
        (z1, B.hip * 0.95, B.hip * 1.14),
    ], seg=SEG, power=2.6)
    items.append((new_object(bm, "%s_suit" % B.tag, smooth=True), SUIT))

    return items


def torso(B: Body):
    """Waist, ribcage, shoulders. Four stations and the whole thing is a taper
    in and back out again — which is the difference between a person and a
    bollard, and it is the reason the hand-built figures needed four frustums
    to say what one loft says here."""
    items = []

    bm = bmesh.new()
    bm_loft(bm, [
        (0.90, B.hip * 0.90, B.hip * 1.08),
        (1.02, B.waist, B.waist * 1.24),
        (1.14, B.waist * 1.12, B.waist * 1.44),
        (1.26, B.sh * 0.80, B.sh * 1.04),
        (1.34, B.sh * 0.82, B.sh * 1.06),
        (1.40, B.sh * 0.66, B.sh * 0.90),
    ], seg=SEG, power=2.4)
    items.append((new_object(bm, "%s_trunk" % B.tag, smooth=True), SKIN))

    if B.chest:
        # A band, not a garment. At any distance you actually see these people
        # from, one loft round the chest reads as a top.
        #
        # Every radius here is set against the torso profile above and has to
        # stay clear of it. The first cut derived them from B.waist and B.sh
        # independently and two of the three rings came out *smaller* than the
        # chest they were supposed to be on, so the band was buried inside the
        # body and the figure shipped topless. Proud by 5 mm at the edges and
        # 12 mm at the bust, which is also roughly what a garment does.
        bm = bmesh.new()
        bm_loft(bm, [
            (1.170, 0.140, 0.180),
            (1.225, 0.150, 0.195),
            (1.270, 0.148, 0.192),
        ], seg=SEG, power=2.4)
        items.append((new_object(bm, "%s_top" % B.tag, smooth=True), SUIT))

        # Straps over the shoulders. Thin, but they are what stops the band
        # reading as a tube slipping down her ribs.
        for s in (1, -1):
            bm = bmesh.new()
            bm_box(bm, -0.008, s * 0.088, 1.310, 0.052, 0.024, 0.108)
            items.append((new_object(bm, "%s_strap%d" % (B.tag, s)), SUIT))

    # No shoulder caps here. The ball that closes the joint belongs to the arm,
    # not the chest — put it on the torso and it stays put while the arm swings
    # out from underneath it, which opens the armpit into a hole on the
    # forward stride. It lives in arm_upper for the same reason the elbow ball
    # lives in arm_lower.
    return items


def head(B: Body):
    """Neck, skull, nose, hair. The head is the part everybody looks at, which
    is why it gets seven rings and a nose and the shins get three."""
    items = []

    bm = bmesh.new()
    bm_loft(bm, [(1.38, 0.048, 0.054), (1.51, 0.045, 0.050)], seg=SEGL)
    items.append((new_object(bm, "%s_neck" % B.tag, smooth=True), SKIN))

    # Narrow at the chin, widest at the cheekbones, tucked in at the crown, and
    # drifting backwards as it climbs — a skull and not a ball.
    bm = bmesh.new()
    bm_loft(bm, [
        (1.505, 0.056, 0.052, 0.011),
        (1.535, 0.073, 0.066, 0.007),
        (1.570, 0.084, 0.075, 0.004),
        (1.605, 0.087, 0.077, 0.000),
        (1.640, 0.084, 0.075, -0.005),
        (1.668, 0.069, 0.062, -0.009),
        (1.688, 0.040, 0.036, -0.012),
    ], seg=SEGH, power=2.2)
    items.append((new_object(bm, "%s_skull" % B.tag, smooth=True), SKIN))

    bm = bmesh.new()
    bm_ball(bm, 0.083, 0.0, 1.596, 0.023, 0.016, 0.026, rows=6, seg=10)
    items.append((new_object(bm, "%s_nose" % B.tag, smooth=True), SKIN))

    # Hair: a shell over the back and top of the skull, standing a few
    # millimetres off it. A fringe over a head reads far better than a
    # hair-coloured head does, which is the one thing the hand-built figures
    # got right.
    #
    # Centred well aft on purpose. A ball on the skull centre reaches as far
    # forward as the face does and buries it — which is what the first cut did,
    # producing a figure with a full-face balaclava. At x = -0.034 the front of
    # the shell stops ~3 cm short of the nose bridge and what is left is a
    # hairline.
    bm = bmesh.new()
    bm_ball(bm, -0.034, 0.0, 1.618, 0.083, 0.082, 0.078,
            rows=8, seg=SEGH, squash_bottom=0.48)
    items.append((new_object(bm, "%s_hair" % B.tag, smooth=True), HAIR))

    if B.female:
        # And a fall down the back of the neck to the shoulder blades. Tapered
        # and offset aft so it hangs behind the neck rather than through it.
        bm = bmesh.new()
        bm_loft(bm, [
            (1.640, 0.062, 0.086, -0.052),
            (1.560, 0.058, 0.090, -0.062),
            (1.470, 0.050, 0.086, -0.068),
            (1.410, 0.038, 0.066, -0.066),
        ], seg=SEGL, power=2.4)
        items.append((new_object(bm, "%s_fall" % B.tag, smooth=True), HAIR))

    return items


def arm_upper(B: Body, s: int):
    """Deltoid to elbow. `s` is +1 for the figure's left."""
    y = s * Y_SHOULDER
    g = B.limb
    items = []

    # The deltoid. Wider than the arm below it, which is what a bare shoulder
    # is, and it doubles as the cap over the joint.
    bm = bmesh.new()
    bm_ball(bm, 0.0, y * 0.96, Z_SHOULDER + 0.004,
            0.058 * g, 0.056 * g, 0.054 * g, rows=7, seg=SEGL)
    items.append((new_object(bm, "%s_delt%d" % (B.tag, s), smooth=True), SKIN))

    bm = bmesh.new()
    bm_loft(bm, [
        (Z_SHOULDER, 0.050 * g, 0.052 * g, 0.0, y),
        (1.300, 0.045 * g, 0.047 * g, 0.0, y),
        (1.180, 0.039 * g, 0.041 * g, 0.002, y * 0.98),
        (Z_ELBOW, 0.035 * g, 0.037 * g, 0.004, y * 0.96),
    ], seg=SEGL, power=2.2)
    items.append((new_object(bm, "%s_uparm%d" % (B.tag, s), smooth=True), SKIN))
    return items


def arm_lower(B: Body, s: int):
    """Elbow, forearm, hand. A forearm that stops dead at the wrist is a stump
    — the same lesson the hand-built figures learned — so there is a hand, and
    it is flattened, because a ball on a wrist is a boxing glove."""
    y = s * Y_SHOULDER * 0.95
    g = B.limb
    items = []

    bm = bmesh.new()
    bm_ball(bm, 0.002, y, Z_ELBOW, 0.036 * g, 0.034 * g, 0.034 * g,
            rows=6, seg=SEGL)
    items.append((new_object(bm, "%s_elbow%d" % (B.tag, s), smooth=True), SKIN))

    # Elbow to wrist. Thick just below the joint and thinning the whole way —
    # a forearm of constant section is a broom handle.
    bm = bmesh.new()
    bm_loft(bm, [
        (Z_ELBOW, 0.037 * g, 0.040 * g, 0.0, y),
        (0.975, 0.034 * g, 0.037 * g, 0.002, y),
        (0.880, 0.027 * g, 0.030 * g, 0.004, y),
        (0.820, 0.024 * g, 0.027 * g, 0.005, y),
    ], seg=SEGL, power=2.2)
    items.append((new_object(bm, "%s_farm%d" % (B.tag, s), smooth=True), SKIN))

    # And the hand, down to about mid-thigh — which is where fingertips land on
    # a standing person, and the check that says the arm is the right length.
    # Flattened: a ball on a wrist is a boxing glove.
    bm = bmesh.new()
    bm_loft(bm, [
        (0.818, 0.025 * g, 0.029 * g, 0.005, y),
        (0.760, 0.028 * g, 0.038 * g, 0.008, y),
        (0.700, 0.025 * g, 0.035 * g, 0.011, y),
        (0.665, 0.017 * g, 0.026 * g, 0.013, y),
    ], seg=SEGL, power=2.6)
    items.append((new_object(bm, "%s_hand%d" % (B.tag, s), smooth=True), SKIN))
    return items


def leg_upper(B: Body, s: int):
    """Hip to knee. Widest just under the buttock and tapering the whole way."""
    y = s * Y_HIP
    g = B.limb
    items = []

    bm = bmesh.new()
    bm_loft(bm, [
        (0.900, 0.086 * g, 0.092 * g, 0.0, y * 1.03),
        (0.780, 0.082 * g, 0.088 * g, 0.0, y * 1.02),
        (0.610, 0.071 * g, 0.076 * g, 0.002, y),
        (Z_KNEE, 0.061 * g, 0.065 * g, 0.004, y * 0.95),
    ], seg=SEGL, power=2.2)
    items.append((new_object(bm, "%s_thigh%d" % (B.tag, s), smooth=True), SKIN))
    return items


def leg_lower(B: Body, s: int):
    """Knee, shin, and a bare foot. The foot is the one place this figure and
    the firefighter genuinely part company: a rigger boot is a shaft and a
    bevelled sole, and a bare foot is a wedge that thins to the toes."""
    y = s * Y_HIP * 0.95
    g = B.limb
    items = []

    bm = bmesh.new()
    bm_ball(bm, 0.003, y, Z_KNEE, 0.063 * g, 0.061 * g, 0.058 * g,
            rows=6, seg=SEGL)
    items.append((new_object(bm, "%s_knee%d" % (B.tag, s), smooth=True), SKIN))

    # Calf high and full, ankle low and narrow. The bottom ring is at 0.10 and
    # not at the floor: the foot has to overlap it, or the leg ends in mid-air.
    # The first cut stopped the shin at 0.115 and started the foot at 0.063,
    # which left a five-centimetre gap — and from the promenade that reads as
    # somebody hovering.
    bm = bmesh.new()
    bm_loft(bm, [
        (Z_KNEE, 0.061 * g, 0.064 * g, 0.0, y),
        (0.360, 0.056 * g, 0.059 * g, 0.004, y),
        (0.230, 0.042 * g, 0.045 * g, 0.010, y),
        (0.100, 0.031 * g, 0.034 * g, 0.014, y),
    ], seg=SEGL, power=2.2)
    items.append((new_object(bm, "%s_shin%d" % (B.tag, s), smooth=True), SKIN))

    # The ankle, closing the shin into the foot.
    bm = bmesh.new()
    bm_ball(bm, 0.014, y, 0.082, 0.036 * g, 0.038 * g, 0.036 * g,
            rows=5, seg=SEGL)
    items.append((new_object(bm, "%s_ankle%d" % (B.tag, s), smooth=True), SKIN))

    # Heel to toe, 23 cm of it, sitting on the floor and reaching forward of the
    # ankle. Bevelled rather than smooth-shaded: a bare foot on concrete wants
    # an edge along the top of it, and a smooth wedge reads as a flipper.
    bm = bmesh.new()
    bm_box(bm, 0.052, y, 0.046, 0.228, 0.080 * g, 0.092)
    ob = new_object(bm, "%s_foot%d" % (B.tag, s))
    bevel(ob, 0.018, 2)
    items.append((ob, SKIN))
    return items


# --------------------------------------------------------------------------- #

def figure(B: Body):
    """The joint tree, parents first. Pivots are in Blender world space; the
    exporter rebases each one onto its parent.

    Eleven parts under eleven names, matching tools/blender/firefighter.py
    exactly. That is not tidiness — src/47-ground.js looks these up by name, and
    a rig that spells `legLU` differently animates nothing at all.
    """
    return [
        {"name": "pelvis", "parent": None, "pivot": (0.0, 0.0, Z_HIP),
         "items": pelvis(B)},
        {"name": "torso", "parent": "pelvis", "pivot": (0.0, 0.0, Z_WAIST),
         "items": torso(B)},
        {"name": "head", "parent": "torso", "pivot": (0.0, 0.0, Z_NECK),
         "items": head(B)},

        {"name": "armLU", "parent": "torso",
         "pivot": (0.0, Y_SHOULDER, Z_SHOULDER), "items": arm_upper(B, 1)},
        {"name": "armLL", "parent": "armLU",
         "pivot": (0.0, Y_SHOULDER * 0.95, Z_ELBOW), "items": arm_lower(B, 1)},
        {"name": "armRU", "parent": "torso",
         "pivot": (0.0, -Y_SHOULDER, Z_SHOULDER), "items": arm_upper(B, -1)},
        {"name": "armRL", "parent": "armRU",
         "pivot": (0.0, -Y_SHOULDER * 0.95, Z_ELBOW), "items": arm_lower(B, -1)},

        {"name": "legLU", "parent": "pelvis", "pivot": (0.0, Y_HIP, Z_HIP),
         "items": leg_upper(B, 1)},
        {"name": "legLL", "parent": "legLU",
         "pivot": (0.0, Y_HIP * 0.95, Z_KNEE), "items": leg_lower(B, 1)},
        {"name": "legRU", "parent": "pelvis", "pivot": (0.0, -Y_HIP, Z_HIP),
         "items": leg_upper(B, -1)},
        {"name": "legRL", "parent": "legRU",
         "pivot": (0.0, -Y_HIP * 0.95, Z_KNEE), "items": leg_lower(B, -1)},
    ]


def bake(B: Body, path: Path, note: str):
    parts = figure(B)
    for p in parts:
        coll = bpy.data.collections.new("%s_%s" % (B.tag, p["name"]))
        bpy.context.scene.collection.children.link(coll)
        for ob, _ in p["items"]:
            for c in ob.users_collection:
                c.objects.unlink(ob)
            coll.objects.link(ob)
    export_rig(parts, path, note)
    return parts


# What the markers stand in for when previewing. The renders are for judging
# form, and form is not judgeable on a figure with pure white skin and pure red
# hair — but the substitution has to happen *only* here, because what ships is
# the marker.
PREVIEW_TINT = {
    SKIN: (0.760, 0.585, 0.445),
    SUIT: (0.180, 0.290, 0.480),
    HAIR: (0.180, 0.130, 0.095),
}


def main():
    reset_scene()
    print("baking the bathers")
    # Both into one scene, under distinct names, so the saved .blend has the
    # pair side by side and they can be compared by eye — which is the only way
    # to tell whether the two silhouettes actually read as different people.
    men = bake(Body(False), OUT / "bather_m.fr3d.gz", "Jadrija bather, male")
    women = bake(Body(True), OUT / "bather_f.fr3d.gz", "Jadrija bather, female")

    obs = {"m": [ob for p in men for ob, _ in p["items"]],
           "f": [ob for p in women for ob, _ in p["items"]]}

    if "--preview" in sys.argv:
        from preview import turntable  # noqa: E402
        for tag, parts in (("m", men), ("f", women)):
            # turntable() renders the whole scene and hides nothing, and both
            # figures are built standing in the same spot — so the other one
            # has to be taken out of the render or it swallows this one. Left
            # out, every "female" preview came back as the male body with her
            # hair showing round the back of his head, which cost an hour of
            # hunting for a bikini top that had been in the export all along.
            for t, group in obs.items():
                for ob in group:
                    ob.hide_render = t != tag
            items = [(ob, PREVIEW_TINT.get(c, c))
                     for p in parts for ob, c in p["items"]]
            turntable(items, "%s/bather_%s" % (PREVIEW, tag), span=2.4)
        for group in obs.values():
            for ob in group:
                ob.hide_render = False

    # Stand them apart before saving, so opening the .blend shows the pair side
    # by side. This has to happen *after* both exports: gather() reads
    # matrix_world, so moving anybody first would bake the offset into the game.
    for ob in obs["f"]:
        ob.location.y += 0.90
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("  saved %s" % BLEND)


main()
