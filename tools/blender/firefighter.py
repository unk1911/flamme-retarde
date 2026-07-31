"""Build the aerodrome ground crew in Blender and bake them for the game.

    blender --background --python tools/blender/firefighter.py

Writes build/payload/firefighter.fr3d.gz and build/firefighter.blend.

The first version of these people was eight boxes on four pivots, and it looked
like eight boxes on four pivots. At two hundred metres that is fine; the ground
mode puts you four metres away from somebody whose clothing is alight and asks
you to care, and eight boxes cannot carry that.

What is here is eleven rigid parts on a joint tree — pelvis, torso, head, two
arms of two segments, two legs of two segments — each lofted out of stacked
superelliptical rings so a thigh tapers to a knee and a chest is a rounded
rectangle rather than a cylinder. There is no skinning: a figure in heavy kit
genuinely does move as rigid pieces, the joints are covered with balls so
nothing opens up when an elbow bends, and it costs a thirty-line reader instead
of a glTF importer.

They are aerodrome ground crew, not structural firefighters, so there is no
breathing set: hi-vis tunic with reflective banding, navy trousers, white
helmet with a brim and ear defenders, gloves, rigger boots, a radio on the belt.
Colours are the ones the old boxes used, so this is a change of resolution and
not a change of cast.
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
BLEND = Path(__file__).resolve().parents[2] / "build" / "firefighter.blend"

# The palette the eight boxes used, so nobody has to re-learn who these people
# are. Reflective silver and the banding are new, because a band you can see
# from behind at dusk is most of what hi-vis kit is for.
TUNIC = (0.847, 0.478, 0.110)
TUNIC_DK = (0.60, 0.32, 0.07)
TREWS = (0.169, 0.208, 0.314)
SKIN = (0.780, 0.604, 0.455)
HELMET = (0.910, 0.902, 0.875)
SILVER = (0.86, 0.87, 0.85)
BOOT = (0.10, 0.10, 0.12)
GLOVE = (0.34, 0.25, 0.19)
STRAP = (0.13, 0.14, 0.16)

SEG = 14          # body
SEGL = 12         # limbs
SEGH = 16         # head and helmet

# Joint heights. A 1.79 m person in boots; every other dimension is measured off
# these rather than invented separately, so the proportions stay honest when one
# of them moves.
Z_HIP = 0.90
Z_KNEE = 0.47
Z_WAIST = 1.00
Z_SHOULDER = 1.44
Z_ELBOW = 1.12
Z_NECK = 1.50
Y_SHOULDER = 0.205
Y_HIP = 0.105


def band(z0, z1, rx, ry, name, seg=SEG, power=2.5):
    """A reflective hoop standing a few millimetres proud of whatever it is
    around. Closed at both ends: an open tube is a coin flip on which way
    Blender decides its normals point."""
    bm = bmesh.new()
    bm_loft(bm, [(z0, rx, ry), (z1, rx, ry)], seg=seg, power=power)
    return new_object(bm, name)


# --------------------------------------------------------------------------- #
#  the parts                                                                   #
# --------------------------------------------------------------------------- #

def pelvis():
    items = []

    bm = bmesh.new()
    bm_loft(bm, [
        (0.80, 0.132, 0.158),
        (0.88, 0.148, 0.178),
        (0.96, 0.150, 0.180),
        (1.02, 0.144, 0.172),
    ], seg=SEG, power=2.6)
    items.append((new_object(bm, "ff_hips", smooth=True), TREWS))

    items.append((band(0.98, 1.045, 0.154, 0.185, "ff_belt", power=2.6), STRAP))

    # The radio, on the right hip — blender +Y is the figure's left, so the
    # right side is -Y. It is four centimetres of detail and it is the thing
    # that makes the belt read as a belt rather than a stripe.
    bm = bmesh.new()
    bm_box(bm, 0.02, -0.168, 0.955, 0.055, 0.085, 0.125)
    ob = new_object(bm, "ff_radio")
    bevel(ob, 0.010, 2)
    items.append((ob, STRAP))

    return items


def torso():
    items = []

    bm = bmesh.new()
    bm_loft(bm, [
        (0.98, 0.142, 0.170),
        (1.10, 0.150, 0.186),
        (1.22, 0.162, 0.204),
        (1.34, 0.168, 0.214),
        (1.42, 0.160, 0.212),
        (1.48, 0.128, 0.176),
    ], seg=SEG, power=2.5)
    items.append((new_object(bm, "ff_tunic", smooth=True), TUNIC))

    # Two hoops round the body and the collar. The lower one sits on the waist,
    # the upper across the chest, which is where they go on real kit because
    # that is the pair that still breaks up a silhouette when somebody is bent
    # over.
    items.append((band(1.06, 1.125, 0.155, 0.192, "ff_bandA"), SILVER))
    items.append((band(1.26, 1.325, 0.171, 0.216, "ff_bandB"), SILVER))

    bm = bmesh.new()
    bm_loft(bm, [(1.44, 0.108, 0.146), (1.52, 0.100, 0.134)], seg=SEG, power=2.4)
    items.append((new_object(bm, "ff_collar"), TUNIC_DK))

    # A line pack: a day's water, a drip torch, the things a crew carries on
    # foot. Squared off and bevelled, so it catches the light against the
    # smooth-shaded tunic and the back of the figure is not a blank curve.
    bm = bmesh.new()
    bm_box(bm, -0.212, 0.0, 1.255, 0.105, 0.255, 0.300)
    ob = new_object(bm, "ff_pack")
    bevel(ob, 0.022, 2)
    items.append((ob, STRAP))

    for s in (1, -1):
        bm = bmesh.new()
        # Over the shoulder and down the front, in two straight runs — a strap
        # that follows the chest exactly would cost forty faces to say the same
        # thing.
        bm_box(bm, -0.02, s * 0.088, 1.452, 0.290, 0.048, 0.030)
        bm_box(bm, 0.152, s * 0.086, 1.290, 0.038, 0.048, 0.330)
        ob = new_object(bm, "ff_strap%d" % s)
        bevel(ob, 0.008, 1)
        items.append((ob, STRAP))

    return items


def head():
    items = []

    bm = bmesh.new()
    bm_loft(bm, [(1.44, 0.054, 0.060), (1.56, 0.050, 0.055)], seg=SEGL)
    items.append((new_object(bm, "ff_neck", smooth=True), SKIN))

    # A skull rather than a ball: narrow at the chin, widest at the cheekbones,
    # tucked in at the crown, and drifting backwards as it goes up.
    bm = bmesh.new()
    bm_loft(bm, [
        (1.568, 0.058, 0.054, 0.012),
        (1.598, 0.076, 0.069, 0.008),
        (1.632, 0.087, 0.078, 0.004),
        (1.668, 0.090, 0.080, 0.000),
        (1.700, 0.087, 0.078, -0.005),
        (1.726, 0.072, 0.065, -0.010),
        (1.742, 0.042, 0.038, -0.013),
    ], seg=SEGH, power=2.2)
    items.append((new_object(bm, "ff_head", smooth=True), SKIN))

    bm = bmesh.new()
    bm_ball(bm, 0.086, 0.0, 1.658, 0.024, 0.017, 0.028, rows=6, seg=10)
    items.append((new_object(bm, "ff_nose", smooth=True), SKIN))

    # ── the helmet ─────────────────────────────────────────────────────────
    bm = bmesh.new()
    bm_ball(bm, -0.004, 0.0, 1.688, 0.108, 0.101, 0.080, rows=8, seg=SEGH,
            squash_bottom=0.55)
    items.append((new_object(bm, "ff_helmet", smooth=True), HELMET))

    bm = bmesh.new()
    bm_loft(bm, [
        (1.700, 0.107, 0.100),
        (1.672, 0.126, 0.118),
        (1.660, 0.152, 0.142),
    ], seg=SEGH, power=2.1)
    items.append((new_object(bm, "ff_brim", smooth=True), HELMET))

    # The peak, over the eyes. Flattened hard, because a helmet peak is a lip
    # and not a bulge.
    bm = bmesh.new()
    bm_ball(bm, 0.128, 0.0, 1.663, 0.062, 0.098, 0.011, rows=6, seg=SEGH)
    items.append((new_object(bm, "ff_peak", smooth=True), HELMET))

    # The nape flap. Hi-vis, because it is the only part of the head anybody
    # behind you can see.
    bm = bmesh.new()
    bm_ball(bm, -0.086, 0.0, 1.598, 0.048, 0.104, 0.056, rows=6, seg=SEGH)
    items.append((new_object(bm, "ff_nape", smooth=True), TUNIC))

    for s in (1, -1):
        bm = bmesh.new()
        bm_ball(bm, -0.004, s * 0.100, 1.646, 0.040, 0.032, 0.050, rows=6, seg=10)
        items.append((new_object(bm, "ff_ear%d" % s, smooth=True), STRAP))

    return items


def arm_upper(s):
    """Shoulder to elbow. `s` is +1 for the figure's left, which is Blender +Y."""
    y = s * Y_SHOULDER
    items = []

    bm = bmesh.new()
    bm_ball(bm, 0.0, y * 0.96, Z_SHOULDER + 0.005, 0.080, 0.076, 0.072,
            rows=7, seg=SEGL)
    items.append((new_object(bm, "ff_shoulder%d" % s, smooth=True), TUNIC))

    bm = bmesh.new()
    bm_loft(bm, [
        (Z_SHOULDER, 0.070, 0.070, 0.0, y),
        (1.34, 0.065, 0.065, 0.0, y),
        (1.22, 0.058, 0.058, 0.0, y * 0.97),
        (Z_ELBOW, 0.053, 0.053, 0.0, y * 0.95),
    ], seg=SEGL)
    items.append((new_object(bm, "ff_upperarm%d" % s, smooth=True), TUNIC))

    bm = bmesh.new()
    bm_loft(bm, [(1.235, 0.062, 0.062, 0.0, y * 0.975),
                 (1.290, 0.062, 0.062, 0.0, y * 0.98)], seg=SEGL)
    items.append((new_object(bm, "ff_armband%d" % s, smooth=True), SILVER))

    return items


def arm_lower(s):
    """Elbow to fingertips, with a ball on the joint so the elbow does not open
    up into a hole the moment it bends."""
    y = s * Y_SHOULDER * 0.95
    items = []

    bm = bmesh.new()
    bm_ball(bm, 0.0, y, Z_ELBOW, 0.055, 0.053, 0.052, rows=6, seg=SEGL)
    items.append((new_object(bm, "ff_elbow%d" % s, smooth=True), TUNIC))

    bm = bmesh.new()
    bm_loft(bm, [
        (Z_ELBOW, 0.053, 0.053, 0.0, y),
        (1.00, 0.048, 0.048, 0.0, y),
        (0.90, 0.043, 0.045, 0.0, y),
    ], seg=SEGL)
    items.append((new_object(bm, "ff_forearm%d" % s, smooth=True), TUNIC))

    bm = bmesh.new()
    bm_loft(bm, [(0.865, 0.048, 0.050, 0.0, y), (0.905, 0.048, 0.050, 0.0, y)],
            seg=SEGL)
    items.append((new_object(bm, "ff_cuff%d" % s), TUNIC_DK))

    bm = bmesh.new()
    bm_loft(bm, [
        (0.870, 0.046, 0.049, 0.004, y),
        (0.810, 0.050, 0.054, 0.010, y),
        (0.745, 0.046, 0.050, 0.014, y),
        (0.702, 0.030, 0.036, 0.016, y),
    ], seg=SEGL, power=2.6)
    items.append((new_object(bm, "ff_glove%d" % s, smooth=True), GLOVE))

    return items


def leg_upper(s):
    y = s * Y_HIP
    items = []
    bm = bmesh.new()
    bm_loft(bm, [
        (0.94, 0.100, 0.104, 0.0, y * 1.03),
        (0.82, 0.096, 0.100, 0.0, y * 1.02),
        (0.64, 0.084, 0.087, 0.0, y),
        (Z_KNEE, 0.072, 0.076, 0.0, y * 0.95),
    ], seg=SEGL, power=2.2)
    items.append((new_object(bm, "ff_thigh%d" % s, smooth=True), TREWS))
    return items


def leg_lower(s):
    y = s * Y_HIP * 0.95
    items = []

    bm = bmesh.new()
    bm_ball(bm, 0.004, y, Z_KNEE, 0.074, 0.072, 0.070, rows=6, seg=SEGL)
    items.append((new_object(bm, "ff_knee%d" % s, smooth=True), TREWS))

    bm = bmesh.new()
    bm_loft(bm, [
        (Z_KNEE, 0.072, 0.075, 0.0, y),
        (0.38, 0.066, 0.069, 0.004, y),
        (0.27, 0.058, 0.062, 0.008, y),
    ], seg=SEGL, power=2.2)
    items.append((new_object(bm, "ff_shin%d" % s, smooth=True), TREWS))

    items_band = band(0.300, 0.352, 0.066, 0.070, "ff_legband%d" % s,
                      seg=SEGL, power=2.2)
    items_band.location = (0.006, y, 0.0)
    items.append((items_band, SILVER))

    # The boot: a shaft down to the ankle, then a bevelled sole running forward,
    # because a foot has a length and a leg that ends in a cylinder skates.
    bm = bmesh.new()
    bm_loft(bm, [
        (0.285, 0.064, 0.068, 0.008, y),
        (0.150, 0.066, 0.070, 0.010, y),
        (0.070, 0.064, 0.070, 0.014, y),
    ], seg=SEGL, power=2.8)
    items.append((new_object(bm, "ff_boot%d" % s, smooth=True), BOOT))

    bm = bmesh.new()
    bm_box(bm, 0.042, y, 0.036, 0.245, 0.108, 0.072)
    ob = new_object(bm, "ff_sole%d" % s)
    bevel(ob, 0.020, 2)
    items.append((ob, BOOT))

    return items


# --------------------------------------------------------------------------- #

def figure():
    """The joint tree, parents first. Pivots are in Blender world space; the
    exporter rebases each one onto its parent."""
    return [
        {"name": "pelvis", "parent": None, "pivot": (0.0, 0.0, Z_HIP),
         "items": pelvis()},
        {"name": "torso", "parent": "pelvis", "pivot": (0.0, 0.0, Z_WAIST),
         "items": torso()},
        {"name": "head", "parent": "torso", "pivot": (0.0, 0.0, Z_NECK),
         "items": head()},

        {"name": "armLU", "parent": "torso",
         "pivot": (0.0, Y_SHOULDER, Z_SHOULDER), "items": arm_upper(1)},
        {"name": "armLL", "parent": "armLU",
         "pivot": (0.0, Y_SHOULDER * 0.95, Z_ELBOW), "items": arm_lower(1)},
        {"name": "armRU", "parent": "torso",
         "pivot": (0.0, -Y_SHOULDER, Z_SHOULDER), "items": arm_upper(-1)},
        {"name": "armRL", "parent": "armRU",
         "pivot": (0.0, -Y_SHOULDER * 0.95, Z_ELBOW), "items": arm_lower(-1)},

        {"name": "legLU", "parent": "pelvis", "pivot": (0.0, Y_HIP, Z_HIP),
         "items": leg_upper(1)},
        {"name": "legLL", "parent": "legLU",
         "pivot": (0.0, Y_HIP * 0.95, Z_KNEE), "items": leg_lower(1)},
        {"name": "legRU", "parent": "pelvis", "pivot": (0.0, -Y_HIP, Z_HIP),
         "items": leg_upper(-1)},
        {"name": "legRL", "parent": "legRU",
         "pivot": (0.0, -Y_HIP * 0.95, Z_KNEE), "items": leg_lower(-1)},
    ]


def main():
    reset_scene()
    print("baking the ground crew")
    parts = figure()
    for p in parts:
        coll = bpy.data.collections.new(p["name"])
        bpy.context.scene.collection.children.link(coll)
        for ob, _ in p["items"]:
            for c in ob.users_collection:
                c.objects.unlink(ob)
            coll.objects.link(ob)
    export_rig(parts, OUT / "firefighter.fr3d.gz", "aerodrome ground crew")
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("  saved %s" % BLEND)


main()
