"""Build the four Šibenik landmarks in Blender and bake them for the game.

    blender --background --python tools/blender/landmarks.py

Writes build/payload/<name>.fr3d.gz, which build.py inlines, and
build/landmarks.blend so the models can be opened and reworked by hand.

Dimensions are from the buildings, not invented: the cathedral is 38.5 m long
and 32 m to the top of the dome, the fortress of St Nicholas is a triangular
bastion about 60 m across on its own islet in the channel. What is *not* here
is the carving — the 71 heads on the apse frieze are a band of blobs, and the
portals are recesses. At the altitude this game is played from, silhouette and
proportion do all the work.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Matrix, Vector  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import (  # noqa: E402
    ASPHALT, CONCRETE, DARKMETAL, GLASS, GOLD, LEAD, STONE, STONE_DARK, TAU,
    TILE, TRIM, WHITE,
    bevel, bm_arc_wall, bm_barrel, bm_box, bm_cylinder, bm_dome, bm_hip_roof,
    bm_prism, bm_ring, export, new_object, reset_scene,
)

OUT = Path(__file__).resolve().parents[2] / "build" / "payload"
BLEND = Path(__file__).resolve().parents[2] / "build" / "landmarks.blend"


# --------------------------------------------------------------------------- #
#  katedrala svetog Jakova                                                     #
# --------------------------------------------------------------------------- #
# Juraj Dalmatinac's church, 1431–1536. Stone throughout — walls, vaults and
# dome are interlocking slabs with no binder and no timber, which is why it is
# on the World Heritage list and why it is the one building in this game that
# absolutely must not burn.
#
# Local frame: +X east (the apses), -X west (the trefoil front), +Z up.

def cathedral():
    parts = []
    NAVE_W, AISLE_W = 5.6, 4.4          # half-widths
    X0, X1 = -19.0, 15.0                # west front .. face of the apses
    H_NAVE, H_AISLE = 15.0, 9.2

    # ── the walls ──────────────────────────────────────────────────────────
    bm = bmesh.new()
    bm_box(bm, (X0 + X1) / 2, 0, H_NAVE / 2, X1 - X0, NAVE_W * 2, H_NAVE)
    for s in (-1, 1):
        bm_box(bm, (X0 + X1) / 2, s * (NAVE_W + AISLE_W / 2), H_AISLE / 2,
               X1 - X0, AISLE_W, H_AISLE)
    # The transept, which is what gives the building its cross and its two
    # extra semicircular gables.
    bm_box(bm, 8.0, 0, H_NAVE / 2, 8.6, (NAVE_W + AISLE_W) * 2, H_NAVE)
    walls = new_object(bm, "cathedral_walls")
    bevel(walls, 0.10)
    parts.append((walls, STONE))

    # ── cornices ───────────────────────────────────────────────────────────
    # Two horizontal bands: the aisle string course with its arcade of little
    # blind arches, and the nave cornice under the vault.
    bm = bmesh.new()
    for s in (-1, 1):
        bm_box(bm, (X0 + X1) / 2, s * (NAVE_W + AISLE_W), H_AISLE - 0.45,
               X1 - X0 + 0.5, 0.75, 0.9)
    bm_box(bm, (X0 + X1) / 2, 0, H_NAVE - 0.5, X1 - X0 + 0.4, NAVE_W * 2 + 0.7, 1.0)
    bm_box(bm, 8.0, 0, H_NAVE - 0.5, 9.2, (NAVE_W + AISLE_W) * 2 + 0.7, 1.0)
    corn = new_object(bm, "cathedral_cornice")
    bevel(corn, 0.07)
    parts.append((corn, STONE_DARK))

    # ── the vaults ─────────────────────────────────────────────────────────
    # Lead-grey slabs, laid as a barrel over the nave and a lower one over each
    # aisle. Seen from the air this ribbed grey roof is the building.
    bm = bmesh.new()
    bm_barrel(bm, X0, X1, 0, H_NAVE, NAVE_W, seg=13)
    for s in (-1, 1):
        bm_barrel(bm, X0, X1, s * (NAVE_W + AISLE_W / 2), H_AISLE, AISLE_W / 2, seg=9)
    bm_barrel(bm, 3.7, 12.3, 0, H_NAVE, NAVE_W + AISLE_W, seg=15)
    vault = new_object(bm, "cathedral_vault", smooth=True)
    parts.append((vault, LEAD))

    # The slab courses, as thin ribs across the barrel — the texture you can
    # see in every photograph of the roof.
    bm = bmesh.new()
    n = 22
    for i in range(1, n):
        x = X0 + (X1 - X0) * i / n
        bm_barrel(bm, x - 0.09, x + 0.09, 0, H_NAVE, NAVE_W + 0.10, seg=13,
                  closed_ends=False)
    ribs = new_object(bm, "cathedral_ribs", smooth=True)
    parts.append((ribs, STONE_DARK))

    # ── the trefoil front ──────────────────────────────────────────────────
    bm = bmesh.new()
    bm_arc_wall(bm, X0 + 0.35, 0, H_NAVE, NAVE_W + 0.45, NAVE_W * 2 + 0.9, seg=16)
    for s in (-1, 1):
        bm_arc_wall(bm, X0 + 0.35, s * (NAVE_W + AISLE_W / 2), H_AISLE,
                    AISLE_W / 2 + 0.35, AISLE_W + 0.7, seg=12)
    # Both transept ends carry the same semicircular gable, turned through a
    # right angle so the arc spans the transept rather than the nave.
    for s in (-1, 1):
        bm_arc_wall(bm, 8.0, s * (NAVE_W + AISLE_W + 0.15), H_NAVE,
                    NAVE_W + AISLE_W + 0.4, 8.9, seg=16, swap=True)
    gables = new_object(bm, "cathedral_gables")
    bevel(gables, 0.09)
    parts.append((gables, STONE))

    # ── rose window and portal ─────────────────────────────────────────────
    bm = bmesh.new()
    bm_ring(bm, X0 + 0.15, 0, 11.4, 1.55, 2.30, 0.55, seg=24, plane="xz")
    # Spokes — the rose is a wheel of little colonnettes.
    for i in range(12):
        a = TAU * i / 12
        v = bm_box(bm, X0 + 0.15, math.cos(a) * 0.9, 11.4 + math.sin(a) * 0.9,
                   0.35, 1.75, 0.18)
        bmesh.ops.rotate(
            bm, verts=v, cent=(X0 + 0.15, 0, 11.4),
            matrix=__import__("mathutils").Matrix.Rotation(a, 3, "X"))
    bm_ring(bm, X0 + 0.15, 0, 11.4, 0.0, 0.55, 0.62, seg=14, plane="xz")
    # The two lesser roses over the aisles.
    for s in (-1, 1):
        bm_ring(bm, X0 + 0.15, s * (NAVE_W + AISLE_W / 2), 6.4, 0.45, 0.85,
                0.5, seg=16, plane="xz")
    rose = new_object(bm, "cathedral_rose")
    parts.append((rose, STONE_DARK))

    bm = bmesh.new()
    # West portal: a dark recess under a round arch. From the air it only has
    # to read as an opening.
    bm_box(bm, X0 + 0.2, 0, 2.4, 1.1, 3.4, 4.8)
    bm_barrel(bm, X0 - 0.35, X0 + 0.75, 0, 4.8, 1.7, seg=12)
    door = new_object(bm, "cathedral_portal")
    parts.append((door, DARKMETAL))

    # ── the apses ──────────────────────────────────────────────────────────
    # Three of them, the central one taller, ringed by the famous frieze of
    # seventy-one heads of ordinary fifteenth-century Šibenčani.
    bm = bmesh.new()
    bm_cylinder(bm, X1 - 0.5, 0, 0, 12.4, 3.6, 3.6, seg=14)
    for s in (-1, 1):
        bm_cylinder(bm, X1 - 1.6, s * (NAVE_W + AISLE_W / 2), 0, 8.4, 2.3, 2.3, seg=12)
    apse = new_object(bm, "cathedral_apses")
    bevel(apse, 0.08)
    parts.append((apse, STONE))

    bm = bmesh.new()
    bm_dome(bm, X1 - 0.5, 0, 12.4, 3.6, rows=4, seg=14, squash=0.55)
    for s in (-1, 1):
        bm_dome(bm, X1 - 1.6, s * (NAVE_W + AISLE_W / 2), 8.4, 2.3,
                rows=3, seg=12, squash=0.55)
    caps = new_object(bm, "cathedral_apse_caps", smooth=True)
    parts.append((caps, LEAD))

    bm = bmesh.new()
    for i in range(26):                       # the frieze, abbreviated
        a = -math.pi / 2 + math.pi * i / 25
        bm_box(bm, X1 - 0.5 + math.cos(a) * 3.75, math.sin(a) * 3.75, 6.6,
               0.36, 0.36, 0.42)
    heads = new_object(bm, "cathedral_heads")
    bevel(heads, 0.05)
    parts.append((heads, STONE_DARK))

    # ── drum, dome, lantern ────────────────────────────────────────────────
    bm = bmesh.new()
    bm_cylinder(bm, 8.0, 0, H_NAVE + NAVE_W - 1.2, H_NAVE + NAVE_W + 4.6,
                4.5, 4.3, seg=8)
    drum = new_object(bm, "cathedral_drum")
    bevel(drum, 0.08)
    parts.append((drum, STONE))

    z_dome = H_NAVE + NAVE_W + 4.6
    bm = bmesh.new()
    bm_dome(bm, 8.0, 0, z_dome, 4.3, rows=6, seg=16, squash=0.92)
    dome = new_object(bm, "cathedral_dome", smooth=True)
    parts.append((dome, LEAD))

    bm = bmesh.new()
    for i in range(16):                       # the dome's ribs
        a = TAU * i / 16
        for j in range(5):
            t = (j + 0.5) / 5 * (math.pi * 0.5)
            r, zz = math.cos(t) * 4.34, math.sin(t) * 4.34 * 0.92
            bm_box(bm, 8.0 + math.cos(a) * r, math.sin(a) * r, z_dome + zz,
                   0.9 * math.cos(t) + 0.12, 0.9 * math.cos(t) + 0.12, 0.14)
    for i in range(8):                        # drum pilasters
        a = TAU * i / 8 + math.pi / 8
        bm_box(bm, 8.0 + math.cos(a) * 4.5, math.sin(a) * 4.5,
               H_NAVE + NAVE_W + 1.7, 0.5, 0.5, 5.8)
    detail = new_object(bm, "cathedral_dome_ribs")
    parts.append((detail, STONE_DARK))

    bm = bmesh.new()
    bm_cylinder(bm, 8.0, 0, z_dome + 3.95, z_dome + 5.1, 0.72, 0.55, seg=10)
    bm_dome(bm, 8.0, 0, z_dome + 5.1, 0.55, rows=3, seg=10, squash=0.8)
    lantern = new_object(bm, "cathedral_lantern", smooth=True)
    parts.append((lantern, STONE))

    bm = bmesh.new()
    bm_cylinder(bm, 8.0, 0, z_dome + 5.5, z_dome + 7.0, 0.08, 0.08, seg=6)
    bm_dome(bm, 8.0, 0, z_dome + 6.5, 0.42, rows=3, seg=10, squash=1.0)
    finial = new_object(bm, "cathedral_finial", smooth=True)
    parts.append((finial, GOLD))

    # ── windows ────────────────────────────────────────────────────────────
    bm = bmesh.new()
    for i in range(6):
        x = -14.5 + i * 4.3
        for s in (-1, 1):
            bm_box(bm, x, s * (NAVE_W + 0.05), 12.0, 0.9, 0.6, 3.6)
            bm_cylinder(bm, x, s * (NAVE_W + 0.05), -0.3, 0.3, 0.45, 0.45, seg=10)
    for i in range(6):
        x = -15.5 + i * 4.3
        for s in (-1, 1):
            bm_box(bm, x, s * (NAVE_W + AISLE_W + 0.05), 5.6, 0.8, 0.6, 2.4)
    win = new_object(bm, "cathedral_windows")
    parts.append((win, GLASS))

    return parts


# --------------------------------------------------------------------------- #
#  Svjetionik Rt Jadrija                                                       #
# --------------------------------------------------------------------------- #
# Not a tower: a two-storey keeper's house in white ashlar with green shutters
# and a red pantile roof, with a small white lantern standing on the ridge.
# 1871, and still the first thing you pass coming in from the sea.

def lighthouse():
    parts = []

    bm = bmesh.new()
    bm_box(bm, 0, 0, 4.0, 12.0, 9.0, 8.0)
    bm_box(bm, -8.5, 0.6, 3.0, 5.5, 7.0, 6.0)          # the older wing
    bm_box(bm, 7.4, -1.0, 2.6, 3.2, 5.0, 5.2)          # the flat-roofed annexe
    house = new_object(bm, "lighthouse_house")
    bevel(house, 0.09)
    parts.append((house, WHITE))

    bm = bmesh.new()
    bm_box(bm, 0, 0, 8.15, 12.4, 9.4, 0.45)            # eaves course
    plinth = new_object(bm, "lighthouse_eaves")
    bevel(plinth, 0.06)
    parts.append((plinth, STONE))

    bm = bmesh.new()
    bm_hip_roof(bm, 0, 0, 8.3, 12.0, 9.0, 2.3, overhang=0.45, ridge=0.5)
    bm_hip_roof(bm, -8.5, 0.6, 6.2, 5.5, 7.0, 1.5, overhang=0.4, ridge=0.4)
    roof = new_object(bm, "lighthouse_roof")
    bevel(roof, 0.05)
    parts.append((roof, TILE))

    # The lantern, standing on the ridge just aft of centre.
    LX, LZ = -0.6, 10.6
    bm = bmesh.new()
    bm_cylinder(bm, LX, 0, 8.4, LZ, 1.5, 1.35, seg=14)
    tower = new_object(bm, "lighthouse_tower", smooth=True)
    parts.append((tower, WHITE))

    bm = bmesh.new()
    bm_ring(bm, LX, 0, LZ + 0.1, 1.30, 1.95, 0.22, seg=18, plane="xy")
    for i in range(14):                                 # gallery railing
        a = TAU * i / 14
        bm_box(bm, LX + math.cos(a) * 1.80, math.sin(a) * 1.80, LZ + 0.55,
               0.10, 0.10, 0.85)
    bm_ring(bm, LX, 0, LZ + 0.95, 1.72, 1.88, 0.10, seg=18, plane="xy")
    gallery = new_object(bm, "lighthouse_gallery")
    parts.append((gallery, DARKMETAL))

    bm = bmesh.new()
    bm_cylinder(bm, LX, 0, LZ + 0.2, LZ + 2.3, 1.15, 1.10, seg=12, caps=False)
    room = new_object(bm, "lighthouse_lamproom", smooth=True)
    parts.append((room, GLASS))

    bm = bmesh.new()
    for i in range(8):                                  # the glazing bars
        a = TAU * i / 8
        bm_box(bm, LX + math.cos(a) * 1.12, math.sin(a) * 1.12, LZ + 1.25,
               0.12, 0.12, 2.1)
    bm_dome(bm, LX, 0, LZ + 2.3, 1.20, rows=4, seg=12, squash=0.75)
    bm_cylinder(bm, LX, 0, LZ + 3.2, LZ + 4.0, 0.06, 0.06, seg=6)
    cap = new_object(bm, "lighthouse_cap", smooth=True)
    parts.append((cap, DARKMETAL))

    # Shutters. Nothing says Dalmatia like the green ones.
    bm = bmesh.new()
    for s in (-1, 1):
        for i, x in enumerate((-3.6, -1.2, 1.2, 3.6)):
            for z in (2.4, 5.8):
                bm_box(bm, x, s * 4.55, z, 1.05, 0.14, 1.75)
    for x in (-6.05, 6.05):
        for z in (2.4, 5.8):
            for y in (-2.4, 0.6):
                bm_box(bm, x, y, z, 0.14, 1.05, 1.75)
    sh = new_object(bm, "lighthouse_shutters")
    parts.append((sh, TRIM))

    # The mast: radar, aerials, and the actual modern light, which is the ugly
    # steel thing next to the pretty old one.
    bm = bmesh.new()
    bm_cylinder(bm, 9.6, -1.2, 0, 22.0, 0.34, 0.20, seg=6)
    for z in (6.0, 11.0, 16.0):
        bm_box(bm, 9.6, -1.2, z, 1.5, 1.5, 0.16)
    bm_box(bm, 9.6, -1.2, 21.6, 3.4, 0.30, 0.18)
    mast = new_object(bm, "lighthouse_mast")
    parts.append((mast, DARKMETAL))

    return parts


# --------------------------------------------------------------------------- #
#  Tvrđava svetog Nikole                                                       #
# --------------------------------------------------------------------------- #
# Sanmicheli, 1540s. A triangular artillery fort built on its own islet in the
# St Anthony channel to keep the Ottoman fleet out — brick over a stone scarp,
# with the point aimed straight down the channel at anything coming in.

def fort_nicholas():
    parts = []
    # Arrowhead in plan, point to the west (down the channel).
    #
    # `PLAN_X` / `PLAN_Y` are how this got to the size it actually is, and they
    # are not a taste decision. The hull below was written by hand and came out
    # a little over half the fortress: measured 23 August 2026, the OSM way at
    # world (-1237.2, 718.5) has an oriented plan of 129.9 x 113.3 m, and the
    # scarp here — the widest course, the one at sea level, and therefore the
    # one OSM is tracing — was 74.2 x 58.0.
    #
    # The pair is fitted rather than read off those two numbers, and the
    # difference matters. Matching the bounding box exactly (1.751, 1.953) is
    # matching the *widest* bearing, and a landmark you sail past is seen from
    # every bearing — so instead both factors are the least-squares fit of the
    # model's silhouette width against the way's, sampled every degree through
    # a half turn with the yaw of 1.256 applied. That is 1.690 and 2.040 for
    # 10.7 % rms, and the two are far apart because the hand-drawn arrowhead
    # was not only small, it was much too narrow for its length.
    #
    # It was caught from the sea, which is the only place it shows. A
    # photograph from the Brod on 23 August (1000150377, 23 mm equivalent)
    # puts 123 m of fortress across the frame at 662 m, and the model put 51 m
    # there. The note at the head of this file already carried the number that
    # would have caught it — "a 30 deg wedge whose tip is 76 m from the
    # centroid" — measured off the same polygon and then not applied: the hull
    # written under it has its tip 44 m out. Fitted, this presents 10.71 deg
    # of fortress from the Brod against the way's own 10.04 and the
    # photograph's 10.7; the old hull presented 6.0.
    #
    # Heights are left alone. The same photograph gives about 16.6 m of wall
    # above the water against the 13.0 m built here, but the waterline at that
    # range is a hazy edge and ten pixels of doubt on it is three metres of
    # fortress, so that is inside the measurement and this is not.
    PLAN_X, PLAN_Y = 1.690, 2.040
    hull = [(-34, 0), (-16, -21), (18, -25), (30, -12), (30, 12), (18, 25), (-16, 21)]
    hull = [(x * PLAN_X, y * PLAN_Y) for x, y in hull]
    scarp = [(x * 1.16, y * 1.16) for x, y in hull]

    bm = bmesh.new()
    bm_prism(bm, scarp, -1.5, 3.0)          # the battered base, wider at sea level
    bm_prism(bm, hull, 3.0, 10.5)
    body = new_object(bm, "nikola_body")
    bevel(body, 0.16)
    parts.append((body, STONE_DARK))

    bm = bmesh.new()
    parapet = [(x * 1.02, y * 1.02) for x, y in hull]
    bm_prism(bm, parapet, 10.5, 12.6)
    inner = [(x * 0.86, y * 0.86) for x, y in hull]
    bm_prism(bm, inner, 10.4, 13.0)         # the raised terreplein inside
    top = new_object(bm, "nikola_parapet")
    bevel(top, 0.12)
    parts.append((top, STONE))

    # Embrasures: the gun ports along the two seaward faces.
    bm = bmesh.new()
    for i in range(9):
        t = i / 8
        for s in (-1, 1):
            # Same plan scale as the hull, or the gun ports march off the wall
            # they are cut into.
            x = (-34 + t * 50) * PLAN_X
            y = s * (2 + t * 22) * PLAN_Y
            bm_box(bm, x, y, 7.4, 2.2, 2.2, 1.6)
    ports = new_object(bm, "nikola_ports")
    parts.append((ports, DARKMETAL))

    return parts


# --------------------------------------------------------------------------- #
#  Tvrđava svetog Mihovila                                                     #
# --------------------------------------------------------------------------- #
# The castle on the crag directly above the old town: an irregular curtain
# following the rock, with square towers on the corners. It is the thing you
# aim at when you are trying to work out where the cathedral is.

def fort_michael():
    parts = []
    ring = [(-32, -14), (-10, -24), (20, -20), (34, -2),
            (28, 18), (4, 26), (-22, 18), (-36, 4)]

    bm = bmesh.new()
    bm_prism(bm, [(x * 1.05, y * 1.05) for x, y in ring], -6.0, 2.0)
    bm_prism(bm, ring, 2.0, 11.0)
    inner = [(x * 0.72, y * 0.72) for x, y in ring]
    bm_prism(bm, inner, -6.0, 6.5)          # the courtyard floor
    walls = new_object(bm, "mihovil_walls")
    bevel(walls, 0.14)
    parts.append((walls, STONE_DARK))

    bm = bmesh.new()
    for cx, cy, s in ((-32, -12, 9.0), (32, -2, 8.5), (2, 24, 8.0), (-34, 6, 7.5)):
        bm_box(bm, cx, cy, 7.5, s, s, 21.0)
    towers = new_object(bm, "mihovil_towers")
    bevel(towers, 0.14)
    parts.append((towers, STONE))

    # Merlons all the way round the curtain — the fortress reads as a fortress
    # or it reads as a wall, and this is the difference.
    bm = bmesh.new()
    n = len(ring)
    for i in range(n):
        ax, ay = ring[i]
        bx, by = ring[(i + 1) % n]
        seglen = math.hypot(bx - ax, by - ay)
        steps = max(2, int(seglen / 3.2))
        for k in range(steps):
            t = (k + 0.5) / steps
            bm_box(bm, ax + (bx - ax) * t, ay + (by - ay) * t, 12.0, 1.5, 1.5, 2.0)
    merlons = new_object(bm, "mihovil_merlons")
    bevel(merlons, 0.08)
    parts.append((merlons, STONE))

    return parts


# --------------------------------------------------------------------------- #
#  Šibenski most                                                               #
# --------------------------------------------------------------------------- #
# The 1966 road bridge over the Kanal svetog Ante, carrying the D8 north out of
# the city. 390 m overall on a single reinforced-concrete arch of 246 m — one of
# the longest concrete arches in the world when it opened — with the deck 33 m
# above the water, which is the clearance the channel needs for anything going
# up the Krka.
#
# The 390 m is not a guess: OSM way 70310004 is tagged bridge=yes and measures
# 389 m in the game's frame, which is where this gets placed.
#
# Local frame: +X along the deck, +Z up, origin at *sea level* mid-span — not on
# the ground, because the ground here is 40 m of seabed.

def sibenik_bridge():
    parts = []

    HALF_L = 195.0          # 390 m overall
    ARCH_HALF = 123.0       # 246 m clear span
    SPRING = 1.5            # arch springs just above the waterline
    DECK_Z = 33.0           # deck surface above the sea
    DECK_T = 1.55           # structural depth
    SOFFIT = DECK_Z - DECK_T
    RISE = SOFFIT - SPRING - 1.2
    RIB_Y = 4.6             # twin ribs, centres either side of the centreline
    RIB_W = 3.4
    DECK_W = 11.6

    def arch_z(x):
        """Parabola. A real arch of this era is a catenary-ish curve, and over
        246 m at this rise the two are within a few centimetres of each other."""
        t = min(1.0, abs(x) / ARCH_HALF)
        return SPRING + RISE * (1.0 - t * t)

    # ── the arch: two ribs, chorded into segments that follow the curve ──────
    SEG = 22
    bm = bmesh.new()
    for side in (-1, 1):
        for i in range(SEG):
            x0 = -ARCH_HALF + (2 * ARCH_HALF) * i / SEG
            x1 = -ARCH_HALF + (2 * ARCH_HALF) * (i + 1) / SEG
            z0, z1 = arch_z(x0), arch_z(x1)
            cx, cz = (x0 + x1) * 0.5, (z0 + z1) * 0.5
            seg_len = math.hypot(x1 - x0, z1 - z0)
            # The rib deepens toward the springings, the way an arch of this
            # kind actually does — thinnest at the crown where it carries least.
            depth = 2.0 + 1.9 * (abs(cx) / ARCH_HALF) ** 2
            ret = bmesh.ops.create_cube(bm, size=1.0)
            vs = ret["verts"]
            bmesh.ops.scale(bm, vec=Vector((seg_len * 1.02, RIB_W, depth)), verts=vs)
            bmesh.ops.rotate(
                bm, verts=vs, cent=(0, 0, 0),
                matrix=Matrix.Rotation(math.atan2(z1 - z0, x1 - x0), 3, "Y").inverted())
            bmesh.ops.translate(bm, verts=vs, vec=(cx, side * RIB_Y, cz))
    arch = new_object(bm, "bridge_arch")
    bevel(arch, 0.10)
    parts.append((arch, CONCRETE))

    # ── cross-bracing between the ribs, in the lower half where it is needed ─
    bm = bmesh.new()
    for i in range(1, 7):
        x = -ARCH_HALF + (2 * ARCH_HALF) * i / 7
        if abs(x) < 26:
            continue
        bm_box(bm, x, 0, arch_z(x) + 0.4, 2.2, RIB_Y * 2 - RIB_W, 1.5)
    brace = new_object(bm, "bridge_bracing")
    parts.append((brace, CONCRETE))

    # ── spandrel columns, arch up to the deck soffit ─────────────────────────
    bm = bmesh.new()
    for i in range(-5, 6):
        x = i * 20.5
        if abs(x) > ARCH_HALF - 6:
            continue
        z0 = arch_z(x)
        if SOFFIT - z0 < 1.0:
            continue
        for side in (-1, 1):
            bm_box(bm, x, side * RIB_Y, (z0 + SOFFIT) * 0.5,
                   1.5, 1.5, SOFFIT - z0)
    # ── approach piers, off the abutments out to the ends, down to the rock ──
    for x in (-165.0, -142.0, 142.0, 165.0):
        for side in (-1, 1):
            bm_box(bm, x, side * 3.4, SOFFIT * 0.5, 2.4, 2.4, SOFFIT)
    cols = new_object(bm, "bridge_columns")
    bevel(cols, 0.06)
    parts.append((cols, CONCRETE))

    # ── abutments: the arch has to land on something ─────────────────────────
    bm = bmesh.new()
    for side_x in (-1, 1):
        bm_box(bm, side_x * (ARCH_HALF + 4.0), 0, SPRING - 1.0, 14.0, 15.0, 7.0)
    abut = new_object(bm, "bridge_abutments")
    parts.append((abut, STONE_DARK))

    # ── the deck ─────────────────────────────────────────────────────────────
    bm = bmesh.new()
    bm_box(bm, 0, 0, DECK_Z - DECK_T * 0.5, HALF_L * 2, DECK_W, DECK_T)
    # Edge cantilever, so the deck reads as a slab on beams and not as a plank.
    for side in (-1, 1):
        bm_box(bm, 0, side * (DECK_W * 0.5 + 0.5), DECK_Z - 0.45,
               HALF_L * 2, 1.0, 0.55)
    deck = new_object(bm, "bridge_deck")
    parts.append((deck, ASPHALT))

    # ── parapet and railing ──────────────────────────────────────────────────
    bm = bmesh.new()
    for side in (-1, 1):
        y = side * (DECK_W * 0.5 + 0.85)
        bm_box(bm, 0, y, DECK_Z + 0.35, HALF_L * 2, 0.34, 0.9)
        # Handrail on stanchions. At the altitude this is seen from the rail is
        # a line, but a bridge with no line along its edge reads as a ramp.
        bm_box(bm, 0, y, DECK_Z + 1.35, HALF_L * 2, 0.14, 0.12)
        n = 44
        for i in range(n + 1):
            bm_box(bm, -HALF_L + (2 * HALF_L) * i / n, y, DECK_Z + 0.95,
                   0.12, 0.12, 1.0)
    rail = new_object(bm, "bridge_rail")
    parts.append((rail, DARKMETAL))

    return parts


# --------------------------------------------------------------------------- #

BUILDS = [
    ("cathedral", cathedral, "katedrala svetog Jakova"),
    ("lighthouse", lighthouse, "Svjetionik Rt Jadrija"),
    ("fort_nikola", fort_nicholas, "Tvrđava svetog Nikole"),
    ("fort_mihovil", fort_michael, "Tvrđava svetog Mihovila"),
    ("sibenski_most", sibenik_bridge, "Šibenski most"),
]


def main():
    reset_scene()
    print("baking landmarks")
    for name, fn, note in BUILDS:
        parts = fn()
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
        for ob, _ in parts:
            for c in ob.users_collection:
                c.objects.unlink(ob)
            coll.objects.link(ob)
        export(parts, OUT / ("%s.fr3d.gz" % name), note)
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("  saved %s" % BLEND)


main()
