"""Build the humanoid from the MakeHuman base mesh instead of from primitives.

    blender --background --python tools/blender/human_mh.py
    blender --background --python tools/blender/human_mh.py -- --sub 2

Writes build/human_mh.blend and preview renders to /tmp/mh_*.png. The source
mesh is cached at build/mh_base.obj and fetched on first run.

── running it fast ────────────────────────────────────────────────────────────

Use tools/blender/blender.sh in place of `blender` and every preview frame is
six seconds instead of eighty-six, because it hands EEVEE the host GPU through
Direct3D 12 rather than letting Mesa render it on the CPU. Same picture; see
the note in that file.

    tools/blender/blender.sh -b build/human_mh.blend \
        -P tools/blender/human_mh.py -- --reskin KNEEL_BACK --views side

Two of the flags below are worth knowing before reaching for a render at all,
because between them they cover most of what a preview gets asked:

    --norender      bake the clips and export the blob, draw nothing.  8 s
    --probe POSE…   print where named joints land, in metres. Draw
                    nothing at all.                                    1 s

`--probe` exists because most arguments about a pose are arguments about which
way a rotation goes, and a coordinate settles those. The one it was written for
had already cost four renders and was still wrong.

── why this replaced the hand-built figure ─────────────────────────────────────

tools/blender/human.py builds a person out of lofted rings and ellipsoids, welds
them with a voxel remesh, and rigs the result. It works, and the body it makes
measures correctly against real anthropometry — but a face cannot be reached
that way in any reasonable number of iterations. An eyelid is not an ellipsoid
and a nostril is not a small sphere, and every round spent approximating them
bought less than the round before.

Nobody models faces this way. So this takes the geometry from somewhere that
already did the sculpting, and keeps only the parts of the old pipeline that
were genuinely hard-won: the containment repaint, the cutter discipline, the
named bone rolls, and the weight relaxation.

── licence ────────────────────────────────────────────────────────────────────

MakeHuman's asset files — including this base mesh — were explicitly released
under CC0 1.0 in September 2020, stated in LICENSE.ASSETS.md at the root of the
makehumancommunity/makehuman repository. CC0 is a full waiver: no attribution
obligation, commercial use fine, and safe to redistribute in a public repo.
The credit below is offered rather than owed, and should stay anyway.

── what comes out of the box ──────────────────────────────────────────────────

19 158 vertices in 172 named groups, of which:

    body          13 378 quads — the figure itself, and the only rendered skin
    helper-*       4 358 faces — a mixture, and the mixture matters:
                     eyes, eyelashes, teeth, tongue   real anatomy, kept
                     skirt, tights, hair, genital     fitting proxies, dropped
    joint-*          750 faces — 125 marker cubes, one per joint

The joint markers are the reason this is worth doing twice over. Every bone
below is placed by reading the centroid of the corresponding marker, so the
skeleton is derived from the mesh rather than typed in beside it and cannot
drift out of register with it. `joint-ground` lands at z = -0.001 once the mesh
is scaled and dropped onto the floor, which is a free check on both numbers.

── axes ───────────────────────────────────────────────────────────────────────

MakeHuman is Y-up with X across and Z forward, in decimetres. This project is
Z-up with X forward and Y to the figure's left, in metres. So

    game (x, y, z) = (mh_z, mh_x, mh_y) * 0.10505 + (0, 0, 0.8583)

which is a cyclic permutation and therefore preserves handedness — worth
stating, because getting it wrong mirrors the figure and the only symptom is
that its heart ends up on the wrong side.
"""

from __future__ import annotations

import math
import sys
import urllib.request
from pathlib import Path

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Euler, Matrix, Quaternion, Vector  # type: ignore
from mathutils.bvhtree import BVHTree  # type: ignore
from mathutils.kdtree import KDTree  # type: ignore

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "build" / "mh_base.obj"
BLEND = ROOT / "build" / "human_mh.blend"
PREVIEW = "/tmp/mh"
URL = ("https://raw.githubusercontent.com/makehumancommunity/makehuman/"
       "master/makehuman/data/3dobjs/base.obj")

TARGET_H = 1.750          # metres, the canonical figure
SUBSURF = 1               # smoothing passes over the base mesh
HEAD_CUTS = 2             # extra subdivision on the head, for paint resolution

# ── the head frame ────────────────────────────────────────────────────────── #
#
# Every face cutter in `cutters` is a number measured off *this* figure's skull,
# and there is now more than one skull: tools/blender/bathers_mh.py runs the same
# pipeline over eight morphed bodies from 1.24 m to 1.84 m. Written as absolute
# metres those numbers are a face on one of them, and what the other seven got
# was a hair cap four centimetres too far forward — an ellipsoid that swallowed
# the whole head. Eight bathers shipped with black faces, and the reason it read
# as a *shading* bug rather than a placement one is that a head uniformly the
# colour of hair does not look like a misplaced cap. It looks like a mask.
#
# So the face numbers are Baye's, and they are mapped onto whatever skull they
# are handed. The frame is three scales and one anchor:
#
#   anchor  `l-eye`, which every figure has and which is a point on the surface
#           rather than a pivot inside the skull. `J["head"]` is the obvious
#           choice and is the wrong one: it runs 0.017 on Baye and 0.091 on the
#           old woman, because MakeHuman's head pivot follows a forward head
#           posture. Anchoring on it moves the whole face 7 cm.
#   kx, ky, kz  the vault's half-depth, half-width and height above the eyes,
#           over Baye's own. Measured by `vault`, not derived from stature: a
#           1.24 m girl is 71 per cent of Baye's height and 88 per cent of her
#           skull depth, which is the whole reason a stature scale does not work
#           here. Heads vary far less than people do.
#
# Round features (iris, pupil) take sqrt(ky*kz) rather than one or the other, so
# they stay round on a skull that is short and wide.
#
# Measured, not rounded: with these exact values `vault(base) / SKULL` is
# (1, 1, 1) and `fx` is the identity, so Baye comes out of `cutters` byte for
# byte the figure she was before the frame existed. Round them to three places
# and she moves by a fifth of a millimetre for no reason at all.
SKULL_EYE_X = 0.130823            # Baye's eye, the frame's origin in x
SKULL = (0.101115, 0.091592, 0.126810)   # her vault: half-depth, half-width,
#                                          height above the eye line
EXPORT_TRIS = 26000       # triangles in the shipped blob
SOLVE_TRIS = 26000        # triangles the bone-heat solver is given (see skin)

# Helper groups that are anatomy and stay. Everything else prefixed `helper-`
# is a proxy for fitting clothes or hair and goes.
KEEP_HELPERS = ("helper-l-eye", "helper-r-eye",
                "helper-l-eyelashes", "helper-r-eyelashes",
                "helper-upper-teeth", "helper-lower-teeth", "helper-tongue")

# ── the palette ────────────────────────────────────────────────────────────── #
# Same convention as tools/blender/bather.py: three of these are markers the
# runtime replaces per figure, everything else is taken literally.
SKIN_M, SKIN_P = (1.0, 1.0, 1.0), (0.760, 0.588, 0.474)
SUIT_M, SUIT_P = (0.0, 0.0, 0.0), (0.114, 0.169, 0.290)
HAIR_M, HAIR_P = (1.0, 0.0, 0.0), (0.128, 0.094, 0.070)
EYE_M, EYE_P = (0.928, 0.922, 0.902), (0.928, 0.922, 0.902)
IRIS_M, IRIS_P = (0.105, 0.082, 0.068), (0.105, 0.082, 0.068)
PUPIL_M, PUPIL_P = (0.040, 0.035, 0.035), (0.040, 0.035, 0.035)
TOOTH_M, TOOTH_P = (0.880, 0.868, 0.836), (0.880, 0.868, 0.836)
TONGUE_M, TONGUE_P = (0.520, 0.280, 0.268), (0.520, 0.280, 0.268)
MOUTH_M, MOUTH_P = (0.300, 0.160, 0.145), (0.300, 0.160, 0.145)
# Lashes. Darker than the hair rather than the same as it, which is how real
# ones read — and it is the one place on this figure where a couple of shades
# is the whole difference between an eye and a hole.
LASH_M, LASH_P = (0.5, 0.0, 0.0), (0.052, 0.040, 0.036)
# Anklets. Literal on both channels — this is a colour, not one of the three
# markers the runtime swaps per figure, and a warm gold is the one metal that
# stays visible against every skin tone the crowd generator hands out. Silver
# against a pale leg at fifteen metres is a leg.
ANKLET_M, ANKLET_P = (0.860, 0.720, 0.400), (0.860, 0.720, 0.400)
# Areolae. Literal on both channels for the anklets' reason. Well short of
# MOUTH_P, which is the other rose on this figure and is a *line* — a mouth can
# afford to be four shades under the skin because it is 2 mm wide and needs to
# survive being 55 mm long at twenty metres. This is a 28 mm disc on a chest and
# the same contrast would read as a wound.
AREOLA_M, AREOLA_P = (0.455, 0.288, 0.268), (0.455, 0.288, 0.268)
# Pubic hair, and it takes the *hair* marker rather than a literal one, unlike
# the two above. That is not tidiness: red is the slot the crowd shader swaps
# for a per-instance hair colour, and a figure whose head hair is recoloured and
# whose pubic hair is not would be wrong in exactly the way that shows. Only she
# has this cutter today, so the marker channel does nothing yet; it will be
# right the first time anybody else gets one.
#
# The literal is three shades up from HAIR_P rather than equal to it, and that
# is a judgement rather than a measurement: her head hair is a mass with its own
# shading and self-shadow and can afford to be nearly black, while this is a flat
# patch a few centimetres across on lit skin, where AREOLA_P's note about
# contrast applies — four shades under the skin reads as a wound. It has not been
# tried at HAIR_P. If this ever looks washed out, that is the first thing to try
# and the reason not to is only a guess.
PUBIC_M, PUBIC_P = HAIR_M, (0.225, 0.163, 0.128)
# And the perianal skin, which is a literal on both channels like the areolae:
# it is pigment rather than hair, so it must not ride the crowd shader's hair
# slot. Two and a half shades under the skin, between AREOLA_P and PUBIC_P and
# for the reason both of those notes give — this is a patch on skin and not a
# line, and the mistake available here is a wound rather than a washout. It also
# sits at the bottom of a crevice that is already the darkest place on her, so
# whatever it is worth it is worth less than the number says.
ANUS_M, ANUS_P = (0.393, 0.262, 0.226), (0.393, 0.262, 0.226)


# --------------------------------------------------------------------------- #
#  getting the mesh                                                            #
# --------------------------------------------------------------------------- #

# Set by `--body` and read by `fetch`, which is the ONE place this file gets
# its mesh from — every joint read, every vault measurement and the load itself
# come through it. So a whole second figure costs one override and no fork.
# See CHLOE in mh_morph.py for what the second figure is and why she is not
# just a morph of the first.
BODY_OVERRIDE = None
SKIN_OUT = None
# Drop the hair knot and the tail from `extras`. Chloe's, and hers alone.
#
# Misha, 28 Aug: "Chloe Price doesn't have a pony tail... can u chop off the
# pony tail off our character". She does not, and never did — the reference is
# a chin-length choppy bob and nothing behind it. The knot and the tube were
# authored for Baye, who does, and Chloe wore them for as long as the two of
# them shared one mesh. She has her own now.
#
# A flag rather than a consequence of `--body`, because the two are different
# questions: a morphed body is not by itself a reason to lose a hairstyle, and
# the next figure through here may well want to keep it.
NO_TAIL = False
# And the septum ring, same story and the same door.
#
# Misha, 28 Aug: "Chloe price (me) doesn't have a nose ring". She does not.
# It was authored on the shared figure, which is Baye, who does — and it stays
# on her.
NO_SEPTUM = False


def fetch():
    if BODY_OVERRIDE is not None:
        return BODY_OVERRIDE
    if CACHE.exists() and CACHE.stat().st_size > 1_000_000:
        return CACHE
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    print("[mh] fetching %s" % URL)
    with urllib.request.urlopen(URL, timeout=120) as r:
        CACHE.write_bytes(r.read())
    print("[mh] cached %s (%d bytes)" % (CACHE, CACHE.stat().st_size))
    return CACHE


def read_joints(path):
    """Centroid of every `joint-*` marker cube, in game space.

    Read straight out of the OBJ rather than from the imported objects, because
    the importer merges and renames groups and these are only wanted as numbers.
    Scale and floor offset are derived here too: the mesh's own height sets the
    scale, and its lowest vertex sets the drop.
    """
    verts, groups, cur = [], {}, None
    for ln in path.read_text().splitlines():
        if ln.startswith("v "):
            a = ln.split()
            verts.append((float(a[1]), float(a[2]), float(a[3])))
        elif ln.startswith("g "):
            cur = ln[2:].strip()
        elif ln.startswith("f "):
            g = groups.setdefault(cur, set())
            for tok in ln.split()[1:]:
                g.add(int(tok.split("/")[0]) - 1)

    body = groups.get("body", set())
    ys = [verts[i][1] for i in body]
    scale = TARGET_H / (max(ys) - min(ys))
    drop = -min(ys) * scale

    out = {}
    for g, idx in groups.items():
        if not g.startswith("joint-"):
            continue
        n = len(idx)
        vs = [verts[i] for i in idx]
        out[g[6:]] = Vector((
            sum(v[2] for v in vs) / n * scale,
            sum(v[0] for v in vs) / n * scale,
            sum(v[1] for v in vs) / n * scale + drop,
        ))
    return out, scale, drop


def vault(path, eyez):
    """Half-depth, half-width and height of the skull above the eyes.

    The three numbers `cutters` scales its face by. Measured off the `body`
    group of the OBJ rather than off the imported mesh, for the same reason
    `read_joints` is: this is wanted as numbers, and the importer merges and
    renames groups on the way in. The eyeballs and the lash strips arrive as
    their own objects and would be inside the region — harmlessly, since neither
    reaches past the forehead, but there is no reason to include them.

    Above the eyes, and not the whole head, because that is the part that is a
    *box*: below the eye line a face runs out into a nose and a chin, and those
    are features rather than proportions. The vault is the braincase, and a hair
    cap is a thing that sits on a braincase.

    `TARGET_H` is baked in through `scale`, so this is in game metres and
    directly comparable with `SKULL`.
    """
    verts, groups, cur = [], {}, None
    for ln in path.read_text().splitlines():
        if ln.startswith("v "):
            a = ln.split()
            verts.append((float(a[1]), float(a[2]), float(a[3])))
        elif ln.startswith("g "):
            cur = ln[2:].strip()
        elif ln.startswith("f "):
            g = groups.setdefault(cur, set())
            for tok in ln.split()[1:]:
                g.add(int(tok.split("/")[0]) - 1)
    body = groups.get("body", set())
    ys = [verts[i][1] for i in body]
    scale = TARGET_H / (max(ys) - min(ys))
    drop = -min(ys) * scale
    v = [(verts[i][2] * scale, verts[i][0] * scale,
          verts[i][1] * scale + drop) for i in body]
    v = [p for p in v if p[2] > eyez]
    return ((max(p[0] for p in v) - min(p[0] for p in v)) / 2.0,
            max(abs(p[1]) for p in v),
            max(p[2] for p in v) - eyez)


def load(path, scale, drop):
    """Import, throw away the proxies, transform, and join what is left."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Default axis settings, and the matrix below only turns the figure to face
    # +X. Measured rather than assumed, because there is no passthrough here:
    #
    #   default                       raw (NEGATIVE_Y fwd, Z up)
    #     x = mh_x                      x = mh_x
    #     y = -mh_z                     y = -mh_y      <- height, negated
    #     z = mh_y                      z = mh_z
    #
    # So the importer always transforms. Its default already gives a correct
    # upright Blender figure facing -Y; asking for "raw" instead swaps height
    # and depth and flips the height, which stands the figure on its head.
    # Applying a full axis permutation on top of the default lays it flat.
    #
    # The joint markers are parsed from the file text and never touch the
    # importer, so they always come out upright and correctly placed — which
    # makes the symptom of getting this wrong a well-placed skeleton next to a
    # body somewhere else entirely, and every paint cutter silently missing.
    bpy.ops.wm.obj_import(filepath=str(path), use_split_objects=True,
                          use_split_groups=True)

    def base(ob):
        n = ob.name
        return n.rsplit(".", 1)[0] if n.rsplit(".", 1)[-1].isdigit() else n

    keep, drop_obs = [], []
    for ob in list(bpy.context.scene.objects):
        if ob.type != "MESH":
            continue
        n = base(ob)
        if n == "body":
            keep.append((ob, SKIN_M, SKIN_P))
        elif n.startswith(("helper-l-eye", "helper-r-eye")) \
                and "eyelash" not in n:
            keep.append((ob, EYE_M, EYE_P))
        elif "eyelash" in n:
            keep.append((ob, LASH_M, LASH_P))
        elif n.endswith("-teeth"):
            keep.append((ob, TOOTH_M, TOOTH_P))
        elif n == "helper-tongue":
            keep.append((ob, TONGUE_M, TONGUE_P))
        else:
            drop_obs.append(ob)

    for ob in drop_obs:
        bpy.data.objects.remove(ob, do_unlink=True)

    # A quarter turn about Z, then scale and drop onto the floor.
    #
    # The import leaves the figure upright facing -Y, which is Blender's forward
    # but not this project's: here +X is forward and +Y is the figure's left.
    # With up = +Z and forward = -Y, the figure's left is +X, so the whole
    # conversion is game = (-y, x, z) * scale + (0, 0, drop) — and composing
    # that with the import reproduces (mh_z, mh_x, mh_y), which is exactly the
    # mapping `read_joints` uses. The two agreeing is the point.
    M = Matrix(((0.0, -scale, 0.0, 0.0),
                (scale, 0.0, 0.0, 0.0),
                (0.0, 0.0, scale, drop),
                (0.0, 0.0, 0.0, 1.0)))

    # Colour every piece before joining. Join keeps a colour attribute only
    # where all operands have one under the same name, and anything missing it
    # comes through black — which on a set of teeth is memorable.
    # `baseM`/`baseP` are a third and fourth copy of these colours, and they are
    # what make `paint`
    # idempotent. See the note there: paint only ever overwrites, so a cutter
    # that is made *smaller* leaves its old colour behind on every vertex it no
    # longer claims, permanently and invisibly. This is the unpainted figure,
    # kept so paint has something to reset to — and it has to be per-vertex
    # rather than one skin constant, because the eyeballs, the lashes, the teeth
    # and the tongue arrive as their own objects with their own colours and no
    # cutter ever redraws them.
    for ob, mark, prev in keep:
        ob.matrix_world = M @ ob.matrix_world
        me = ob.data
        for n in ("mark", "prev", "baseM", "baseP"):
            me.color_attributes.new(n, "FLOAT_COLOR", "POINT")
        # Fetched by name *after* all four exist, never held across a `new`.
        # Creating a colour attribute reallocates the others, so a reference
        # taken before the last one is created is stale — and it does not raise
        # where you took it, it raises later as `index 0 out of range, size 0`.
        # Two attributes happened to survive this; four do not.
        a_m = me.color_attributes["mark"]
        a_p = me.color_attributes["prev"]
        a_bm = me.color_attributes["baseM"]
        a_bp = me.color_attributes["baseP"]
        for i in range(len(me.vertices)):
            a_m.data[i].color = (*mark, 1.0)
            a_p.data[i].color = (*prev, 1.0)
            a_bm.data[i].color = (*mark, 1.0)
            a_bp.data[i].color = (*prev, 1.0)

    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob, _m, _p in keep:
        ob.select_set(True)
    body = next(ob for ob, _m, _p in keep if base(ob) == "body")
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = "human"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return body


def smooth(body, levels, above=1.46):
    """Catmull-Clark over the base mesh, and extra density on the head.

    The base is 13 378 quads for a whole person, which is about 8 mm between
    vertices on the face — and vertex colour cannot paint a feature smaller than
    one vertex. One global level takes that to 4 mm and rounds off the faceting;
    the head then gets two more on its own, which buys about a millimetre where
    the eyes and mouth are without paying for it on the shins.

    `above` is where the head starts, and it is an argument because 1.46 is
    Baye's neck and nobody else's. On the 1.24 m girl it is nine centimetres
    over the top of her skull, so she got no head density at all and her face
    was painted at 8 mm resolution; on the 1.58 m woman it cuts through the
    middle of her face and subdivides the top half of it only. Callers with a
    skeleton in hand should pass `J["neck"].z`.
    """
    bpy.context.view_layer.objects.active = body
    if levels:
        m = body.modifiers.new("sub", "SUBSURF")
        m.levels = m.render_levels = levels
        bpy.ops.object.modifier_apply(modifier="sub")

    bm = bmesh.new()
    bm.from_mesh(body.data)
    edges = set()
    for f in bm.faces:
        if f.calc_center_median().z > above:
            edges.update(f.edges)
    if edges:
        bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=HEAD_CUTS,
                                  use_grid_fill=True)
    bm.to_mesh(body.data)
    bm.free()
    for p in body.data.polygons:
        p.use_smooth = True
    return body


# --------------------------------------------------------------------------- #
#  hair                                                                        #
# --------------------------------------------------------------------------- #
#
# Everything else on this figure is painted rather than modelled — eyes, brows,
# mouth, trunks are all vertex colour laid down through a cutter volume, which
# is the whole reason a MakeHuman base with no textures can carry a face. Hair
# is the one feature that cannot be done that way and be *long*, because paint
# has nothing to sit on: dark colour over the skull is a crew cut however far
# down the neck it is taken, and the silhouette is what reads at ten metres.
#
# So the scalp stays painted and the length is geometry — a knot at the back of
# the crown and a tail hanging off it. Both are separate closed shells, which
# means `skin()` picks them up in its loose-shell pass and hands each of them
# whole to the `head` bone. That is also the honest rig for them: there is no
# hair bone, so the tail is rigid to the skull and swings with it. Adding one
# would cost a bone out of the palette and a keyframe in every clip, for a
# figure who is 1.75 m of a 189 m promenade.
#
# All of it is in game space — +X forward, +Y her left, +Z up, metres — and the
# numbers are off the base mesh: the back of her skull runs to x = −0.041, the
# nape tucks in to −0.012, and the deepest part of her upper back is −0.055. The
# tail clears all three.
HAIR_KNOT = (-0.052, 0.0, 1.688, 0.043, 0.040, 0.038)
HAIR_TAIL = [
    (-0.062, 0.0, 1.690, 0.032),   # inside the knot, so the two read as one
    (-0.082, 0.0, 1.652, 0.036),
    (-0.094, 0.0, 1.596, 0.035),
    (-0.098, 0.0, 1.530, 0.033),
    (-0.096, 0.0, 1.464, 0.030),
    (-0.090, 0.0, 1.404, 0.025),
    (-0.084, 0.0, 1.352, 0.016),
    (-0.080, 0.0, 1.318, 0.005),
]

# Anklets, one a side. Height and radii measured off the mesh rather than
# authored: the ankle marker sits at z = 0.0756, and 35 mm above it the leg is a
# clean 82 × 60 mm ellipse — low enough to be at her ankle and high enough to be
# past the flare of the heel, which at the marker itself is still 114 mm across
# and would want a ring you could get a fist through.
#
# The band goes to `foot`, which is the nearest bone head to it by some way —
# the shin's bone starts at the knee, 36 cm up. That is also what a real anklet
# does: it rests on the ankle bone itself, on the joint rather than above it,
# and turns with the foot.
ANKLET_Z = 0.035          # above the ankle marker
ANKLET_R = (0.0455, 0.0345)   # fore-aft and lateral, ~4 mm proud of the skin
ANKLET_WIRE = 0.0026      # a 5 mm band: a chain reads as nothing at this range

# A septum ring, and it is the only piece of her above the neck that is a shape
# rather than a colour. That is not a change of mind about the argument in
# `cutters` — a nose ring is exactly the case that argument does not cover. It
# is not a marking on the skin, it is an object hanging off the front of a face
# in silhouette against whatever is behind her, and paint has nothing to sit on
# for the half of it that is in mid-air.
#
# Placed on the midline profile that `cutters` measures for the mouth:
#
#     z 1.586  x 0.1762   nose tip
#     z 1.570  x 0.1645   subnasale, the bottom of the philtrum
#     z 1.551  x 0.1632   the crease between the lips
#
# The hoop lies in the frontal plane, so every point on it is at the same x and
# that one number decides whether it is jewellery or a swallowed coin. The first
# attempt put it at x = 0.1585, reading "just behind the nose tip" off the table
# above — but those x values are the *surface*, and the philtrum between the
# subnasale and the lip runs at 0.164 to 0.168. The whole ring came out 6 mm
# inside her face and the payload carried thirty-seven gold vertices nobody
# could see. It goes in front of that surface and behind the tip: x = 0.170 is
# 4 mm clear of the philtrum at the bottom of the hoop and still inside the nose
# at the top of it, which is where a piercing goes through.
#
# The hair cap is the one cutter near enough to matter — it is a solid, and it
# would paint a gold ring brown — but it stops at x = 0.155 and this is past it.
SEPTUM = (0.1700, 1.5735)     # x and z of the centre, on the midline
SEPTUM_R = 0.0068             # a 14 mm hoop
SEPTUM_WIRE = 0.0013          # thick enough to survive the decimator


def extras(body, J):
    """Build every piece of joined geometry and put it on the body in one pass.

    The hair knot, the tail and the two anklets. They are one function and one
    join because of how the idempotence works: `join` appends, so the added
    geometry is always the *last* N vertices of the mesh, and re-running removes
    the previous N first. That trick only survives while a single function owns
    all of it. Two functions each deleting their own last N, joined in either
    order, is a loop that eats the other one's work — add the anklets after the
    hair and the next `--extras` deletes the anklets and calls them a ponytail.

    Coloured here rather than by a cutter. `paint` only overwrites vertices a
    cutter volume claims, and these sit outside every one of them — which is
    correct, since a cutter big enough to catch the tail would also catch the
    back of her neck and half a shoulder blade.
    """
    old = body.get("extraN", 0) or body.get("hairN", 0)
    if old:
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=bm.verts[-old:], context="VERTS")
        bm.to_mesh(body.data)
        bm.free()
        print("[mh] extras: dropped %d previous verts" % old)

    # Each piece is its own closed shell, which is what `skin()` needs: its
    # loose-shell pass hands a whole shell to one bone, and that is exactly the
    # rig these want — a tail rigid to the skull, a band rigid to the shin.
    vs, fs = ([], []) if NO_TAIL else ball(*HAIR_KNOT, rows=16, seg=20)
    tint = [(HAIR_M, HAIR_P)] * len(vs)

    def add_shell(sv, sf, mark, prev):
        off = len(vs)
        vs.extend(sv)
        fs.extend([[i + off for i in f] for f in sf])
        tint.extend([(mark, prev)] * len(sv))

    if not NO_TAIL:
        add_shell(*tube(HAIR_TAIL, seg=16), HAIR_M, HAIR_P)
    for s in (1, -1):
        ank = J["%s-ankle" % ("l" if s > 0 else "r")]
        add_shell(*ring((ank.x, ank.y, ank.z + ANKLET_Z),
                        ANKLET_R[0], ANKLET_R[1], ANKLET_WIRE),
                  ANKLET_M, ANKLET_P)

    # `ring` builds about the vertical axis, which is what an anklet wants. A
    # septum ring hangs in the frontal plane instead: the piercing runs from one
    # nostril to the other and the hoop loops round the free bottom edge of the
    # septum, so it is a circle you see whole from in front and edge-on from the
    # side. Cycling the coordinates x,y,z -> z,x,y turns one into the other; it
    # is a rotation and not a mirror, so the winding — and with it every face
    # normal — comes through unchanged.
    if not NO_SEPTUM:
        rv, rf = ring((0.0, 0.0, 0.0), SEPTUM_R, SEPTUM_R, SEPTUM_WIRE,
                      seg=16, ring_seg=5)
        add_shell([(SEPTUM[0] + v[2], v[0], SEPTUM[1] + v[1]) for v in rv], rf,
                  ANKLET_M, ANKLET_P)

    me = bpy.data.meshes.new("extras")
    me.from_pydata([tuple(v) for v in vs], [], fs)
    me.validate()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for n in ("mark", "prev", "baseM", "baseP"):
        me.color_attributes.new(n, "FLOAT_COLOR", "POINT")
    a_m = me.color_attributes["mark"]
    a_p = me.color_attributes["prev"]
    # The bases too, and for these it matters more than anywhere else: they are
    # outside every cutter, so if `paint`'s reset found no base on them it would
    # have nothing to put back and the hair would come out whatever the default
    # is. Join also drops any attribute the operands do not all share.
    a_bm = me.color_attributes["baseM"]
    a_bp = me.color_attributes["baseP"]
    for i in range(len(me.vertices)):
        mark, prev = tint[i]
        a_m.data[i].color = (*mark, 1.0)
        a_p.data[i].color = (*prev, 1.0)
        a_bm.data[i].color = (*mark, 1.0)
        a_bp.data[i].color = (*prev, 1.0)
    for p in me.polygons:
        p.use_smooth = True

    ob = bpy.data.objects.new("extras", me)
    bpy.context.collection.objects.link(ob)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body["extraN"] = len(vs)
    body["hairN"] = 0
    print("[mh] extras: %d verts, %d faces joined (%s2 anklets%s)"
          % (len(vs), len(fs), "" if NO_TAIL else "hair + ",
             "" if NO_SEPTUM else " + septum"))
    return body


# --------------------------------------------------------------------------- #
#  the skeleton                                                                #
# --------------------------------------------------------------------------- #
#
# (bone, parent, head marker, tail marker). Every position is a joint centroid
# from the mesh itself — nothing here is a typed coordinate.
#
# Note the spine markers are numbered from the top down: spine-4 is lumbar and
# spine-1 is the base of the neck, which is the reverse of what the names
# suggest and would put a bend in the wrong vertebra if taken at face value.
BONES = [
    ("pelvis", None, "pelvis", "spine-4"),
    ("spine01", "pelvis", "spine-4", "spine-3"),
    ("spine02", "spine01", "spine-3", "spine-2"),
    ("spine03", "spine02", "spine-2", "spine-1"),
    ("chest", "spine03", "spine-1", "neck"),
    ("neck", "chest", "neck", "head"),
    ("head", "neck", "head", "head-2"),
    ("jaw", "head", "head", "jaw"),
]
for _s, _t in (("l", "L"), ("r", "R")):
    BONES += [
        ("clavicle" + _t, "chest", "%s-clavicle" % _s, "%s-shoulder" % _s),
        ("armU" + _t, "clavicle" + _t, "%s-shoulder" % _s, "%s-elbow" % _s),
        ("armL" + _t, "armU" + _t, "%s-elbow" % _s, "%s-hand" % _s),
        ("hand" + _t, "armL" + _t, "%s-hand" % _s, "%s-hand-2" % _s),
        ("thumb" + _t, "hand" + _t, "%s-finger-1-1" % _s, "%s-finger-1-3" % _s),
        ("eye" + _t, "head", "%s-eye" % _s, "%s-eye-target" % _s),
        ("legU" + _t, "pelvis", "%s-upper-leg" % _s, "%s-knee" % _s),
        ("legL" + _t, "legU" + _t, "%s-knee" % _s, "%s-ankle" % _s),
        ("foot" + _t, "legL" + _t, "%s-ankle" % _s, "%s-foot-1" % _s),
        ("toe" + _t, "foot" + _t, "%s-foot-1" % _s, "%s-foot-2" % _s),
    ]

# Local Z for each bone, named rather than left to Blender.
#
# Blender derives a roll per bone from its rest direction if you do not say. For
# a limb a degree or two off vertical that gives arbitrarily tilted axes, so a
# pure hip flexion also adducts and the figure walks with its legs crossing over
# the midline. Naming Z as world -X for every up-or-down bone makes local X the
# figure's left on all of them, so +X is sagittal swing everywhere and the two
# sides mirror in sign. Bones running fore-aft or across take Z as world up.
ROLL_UP = Vector((-1.0, 0.0, 0.0))
ROLL_FLAT = Vector((0.0, 0.0, 1.0))
FLAT = ("footL", "footR", "toeL", "toeR", "clavicleL", "clavicleR",
        "thumbL", "thumbR", "jaw", "eyeL", "eyeR")


def armature(J):
    arm = bpy.data.armatures.new("rig")
    rig = bpy.data.objects.new("rig", arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    made = {}
    for name, parent, h, t in BONES:
        if h not in J or t not in J:
            print("[mh] missing marker for %s (%s -> %s)" % (name, h, t))
            continue
        b = arm.edit_bones.new(name)
        b.head, b.tail = J[h], J[t]
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + Vector((0.0, 0.0, 0.02))
        b.align_roll(ROLL_FLAT if name in FLAT else ROLL_UP)
        if parent and parent in made:
            b.parent = made[parent]
            b.use_connect = False
        made[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def islands(me):
    """(label per vertex, [size]) for the mesh's connected components."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    lab = [-1] * len(bm.verts)
    sizes = []
    for v in bm.verts:
        if lab[v.index] >= 0:
            continue
        k = len(sizes)
        stack, n = [v], 0
        lab[v.index] = k
        while stack:
            c = stack.pop()
            n += 1
            for e in c.link_edges:
                o = e.other_vert(c)
                if lab[o.index] < 0:
                    lab[o.index] = k
                    stack.append(o)
        sizes.append(n)
    bm.free()
    return lab, sizes


def _trim_jaw(bm, dl, body, rig, gi):
    """Cut the jaw bone back to a jaw.

    Bone heat gives it most of the skull, and by its own lights it is not wrong
    to: the bone runs from a pivot deep inside the head out to the point of the
    chin, so measured the only way the solver can measure — distance through the
    volume — the crown of the head really is nearer to the jaw than to anything
    else. What comes back is a bone that drops the chin 49 mm at eighteen
    degrees and takes 18 mm of skullcap down with it. That is not a mouth
    opening. It is a head deflating, and it is why nothing has ever keyed this
    bone: it has been in the palette since the rig was built and unusable since
    the rig was built.

    So it is cut by hand, on the two axes the mistake is actually on.

    *Height.* A mandible is everything from under the chin up to the mouth. Above
    the mouth it fades out over four centimetres rather than stopping, because a
    real cheek does follow a jaw a little, and a hard edge across a face at the
    density this mesh is at is a visible line.

    *Depth.* And nothing behind the pivot. The jaw hinges just in front of the
    ear; the nape, the neck and the back of the skull are on the other side of
    that hinge and have no business moving with it. Faded over four centimetres
    for the same reason.

    Both bands are taken off the bone rather than typed in, so they follow the
    figure if the base mesh is ever swapped. Nothing is redistributed: the
    weight is simply removed, and `vertex_group_normalize_all` at the end of
    `skin` hands what is left to whoever else was already there — which on this
    part of the figure is `head`, which is the right answer.
    """
    if "jaw" not in gi or "jaw" not in rig.data.bones:
        return
    jb = rig.data.bones["jaw"]
    piv, chin = jb.head_local, jb.tail_local
    span = max(piv.z - chin.z, 1e-6)
    z_full = chin.z + 0.55 * span          # the mouth line: the jaw owns this
    z_gone = chin.z + 1.30 * span          # and has nothing left up here
    x_gone = piv.x - 0.020                 # behind the hinge
    x_full = piv.x + 0.020
    k = gi["jaw"]
    cut = 0
    for i, v in enumerate(body.data.vertices):
        d = bm.verts[i][dl]
        w = d.get(k, 0.0)
        if w <= 0.0:
            continue
        fz = (z_gone - v.co.z) / (z_gone - z_full)
        fx = (v.co.x - x_gone) / (x_full - x_gone)
        f = min(max(fz, 0.0), 1.0) * min(max(fx, 0.0), 1.0)
        f = f * f * (3.0 - 2.0 * f)        # smoothstep, so the seam is not one
        if f < 0.999:
            d[k] = w * f
            cut += 1
    print("[mh] jaw trimmed on %d verts (z %.3f..%.3f, x behind %.3f)"
          % (cut, z_full, z_gone, x_full))


def skin(body, rig):
    """Weight the mesh to the skeleton.

    ── why this is not one call to ARMATURE_AUTO ──────────────────────────────

    It was, and it silently produced nothing. Blender's bone-heat solver wants a
    closed volume with a bone inside it, and this mesh is *sixty-six* separate
    shells: the body, two eyeballs, two lash strips, a tongue, and a full set of
    individually modelled teeth. Every one of those shells is a component of the
    same linear system with no bone anywhere inside it, the solve goes singular,
    and what comes back is the warning

        Bone Heat Weighting: failed to find solution for one or more bones

    and twenty-eight vertex groups containing zero weights. The figure then
    parents to the armature, poses without moving a vertex, renders identically
    in every pose, and exports as a statue — which is exactly what shipped, and
    was read as "we have no animation yet" rather than as a broken bind.

    So: solve on the body shell alone, and hand the loose shells to a bone each.
    """
    # Idempotent, so --rebind can be run on a blend that is already bound.
    for m in list(body.modifiers):
        if m.type == "ARMATURE":
            body.modifiers.remove(m)

    lab, sizes = islands(body.data)
    big = max(range(len(sizes)), key=lambda i: sizes[i])
    print("[mh] %d shells; body is %d verts, %d in %d loose shells"
          % (len(sizes), sizes[big], sum(sizes) - sizes[big], len(sizes) - 1))

    # The eye bones come out of the solve. They sit in a cavity — the eyeballs
    # are one of the shells that just got removed — so heat weighting hands them
    # a quarter of the face each, and a glance to the left takes both cheeks
    # with it. They get their eyeballs back by hand below.
    eyes = ("eyeL", "eyeR")
    for n in eyes:
        if n in rig.data.bones:
            rig.data.bones[n].use_deform = False

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    src = bpy.context.view_layer.objects.active
    src.name = "weight_src"
    for m in list(src.modifiers):
        src.modifiers.remove(m)
    for g in list(src.vertex_groups):
        src.vertex_groups.remove(g)
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if lab[v.index] != big],
                     context="VERTS")
    bm.to_mesh(src.data)
    bm.free()

    # And decimated to roughly what ships, because the solver will not take the
    # full mesh either: 192 424 vertices of body shell, one island, every bone
    # inside it, and it still comes back empty. At export density it solves in
    # a couple of seconds. So the weights are computed on the topology that
    # actually gets exported, and lifted back on to the dense mesh afterwards —
    # which is the right way round anyway, since the alternative is solving on
    # geometry nobody will ever draw and then throwing 93% of it away.
    have = sum(len(p.vertices) - 2 for p in src.data.polygons)
    if have > SOLVE_TRIS:
        bpy.context.view_layer.objects.active = src
        d = src.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = SOLVE_TRIS / have
        bpy.ops.object.modifier_apply(modifier="dec")
    print("[mh] solving weights on %d verts" % len(src.data.vertices))

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    src.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    solved = sum(1 for v in src.data.vertices if v.groups)
    print("[mh] heat solved %d/%d" % (solved, len(src.data.vertices)))
    if solved < len(src.data.vertices) * 0.99:
        sys.exit("error: bone heat weighting failed — %d of %d vertices unweighted"
                 % (len(src.data.vertices) - solved, len(src.data.vertices)))

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_NAME")

    gi = {g.name: g.index for g in body.vertex_groups}
    # `ARMATURE_NAME` makes a vertex group per bone that something is weighted
    # to, which is not the same set as "every bone": the eye bones move an
    # eyeball that the heat solver never reaches, so on a from-scratch build
    # `gi["eyeL"]` is missing and the loose-shell pass below — which hands each
    # eyeball to its own eye bone by name — dies with a KeyError. It survived
    # unnoticed for a long time because every run since the eyes were added went
    # through `--reface` or `--reskin`, and those open a blend that already has
    # the groups in it.
    for b in rig.data.bones:
        if b.name not in gi:
            gi[b.name] = body.vertex_groups.new(name=b.name).index
    sg = {g.index: g.name for g in src.vertex_groups}
    sw = [[(gi[sg[g.group]], g.weight) for g in v.groups if g.weight > 0.0]
          for v in src.data.vertices]
    kd = KDTree(len(src.data.vertices))
    for i, v in enumerate(src.data.vertices):
        kd.insert(v.co, i)
    kd.balance()

    # Straight into the deform layer. The obvious `vertex_group.add()` per
    # influence is three quarters of a million operator calls on this mesh.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    dl = bm.verts.layers.deform.verify()
    weighted = 0
    for i, lb in enumerate(lab):
        if lb != big:
            continue
        _co, j, _d = kd.find(body.data.vertices[i].co)
        d = bm.verts[i][dl]
        for g, w in sw[j]:
            d[g] = w
        weighted += bool(sw[j])

    # The loose shells, one bone each. An eyeball is the island whose points are
    # all the same distance from their own centroid — that is what tells it
    # apart from the lash strip wrapped around it, which sits in the same place
    # and would otherwise win on proximity alone.
    head = rig.data.bones
    byname = {b.name: b for b in head}
    assigned = {}
    for k in range(len(sizes)):
        if k == big:
            continue
        vs = [i for i, lb in enumerate(lab) if lb == k]
        c = Vector((0.0, 0.0, 0.0))
        for i in vs:
            c += body.data.vertices[i].co
        c /= len(vs)
        rs = [(body.data.vertices[i].co - c).length for i in vs]
        round_ = min(rs) / max(max(rs), 1e-9)
        pick = "head"
        # `head` is the right default for every loose shell the base mesh has —
        # teeth, tongue, eyeballs and lashes are all inside the skull, and so is
        # the ponytail, which is why this was a default and not a decision. It
        # became the wrong one the instant a loose shell existed below the neck:
        # the first pair of anklets came back rigidly attached to her jaw, and
        # the export was perfectly happy about it. Anything under the collarbone
        # goes to the nearest bone instead.
        if c.z < byname["neck"].head_local.z:
            pick = min(byname, key=lambda n: (c - byname[n].head_local).length)
        for n in eyes:
            if n in byname and (c - byname[n].head_local).length < 0.03 and round_ > 0.5:
                pick = n
        assigned[pick] = assigned.get(pick, 0) + 1
        for i in vs:
            bm.verts[i][dl][gi[pick]] = 1.0
        weighted += len(vs)

    _trim_jaw(bm, dl, body, rig, gi)
    bm.to_mesh(body.data)
    bm.free()
    print("[mh] weighted %d/%d verts; loose shells -> %s"
          % (weighted, len(body.data.vertices), assigned))
    if weighted < len(body.data.vertices):
        sys.exit("error: %d vertices left with no bone at all"
                 % (len(body.data.vertices) - weighted))

    bpy.data.objects.remove(src, do_unlink=True)
    for n in eyes:
        if n in rig.data.bones:
            rig.data.bones[n].use_deform = True

    # Relax the weights across every joint, then cap the influences.
    #
    # Bone heat returns a solution that is correct but sharp: the thigh-to-shin
    # transition happens over a couple of edge loops, so at forty degrees of
    # knee flex the inside creases and the outside pinches to a waist. And it
    # leaves a long tail of near-zero weights — a rib answering faintly to a
    # wrist — which is what puts a fan of fine wrinkles across a torso whenever
    # the spine twists. Four influences is also what the runtime will afford.
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.object.vertex_group_smooth(group_select_mode="ALL",
                                       factor=0.5, repeat=10, expand=0.0)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    return body


# --------------------------------------------------------------------------- #
#  paint                                                                       #
# --------------------------------------------------------------------------- #

_RAY = Vector((0.5771, 0.5774, 0.5777)).normalized()


def _inside(tree, p):
    """Ray parity. Valid on one closed shell only — see `cutters`."""
    o, n = p.copy(), 0
    while n < 64:
        loc, _nrm, _idx, _d = tree.ray_cast(o, _RAY)
        if loc is None:
            return n % 2 == 1
        n += 1
        o = loc + _RAY * 1e-5
    return False


def ball(cx, cy, cz, rx, ry, rz, rows=12, seg=20):
    """A closed ellipsoid as a bare (verts, faces) pair — no Blender object.

    These are never rendered. They exist only to be asked whether a point is
    inside them.
    """
    vs, fs, grid = [], [], []
    for j in range(1, rows):
        t = -math.pi * 0.5 + math.pi * j / rows
        rr, zz = math.cos(t), math.sin(t)
        row = []
        for i in range(seg):
            a = 2.0 * math.pi * i / seg
            row.append(len(vs))
            vs.append(Vector((cx + math.cos(a) * rr * rx,
                              cy + math.sin(a) * rr * ry,
                              cz + zz * rz)))
        grid.append(row)
    bot, top = len(vs), len(vs) + 1
    vs.append(Vector((cx, cy, cz - rz)))
    vs.append(Vector((cx, cy, cz + rz)))
    for j in range(len(grid) - 1):
        for i in range(seg):
            k = (i + 1) % seg
            fs.append([grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]])
    for i in range(seg):
        k = (i + 1) % seg
        fs.append([bot, grid[0][k], grid[0][i]])
        fs.append([top, grid[-1][i], grid[-1][k]])
    return vs, fs


def tube(path, seg=14):
    """A tapered closed tube through `path` = [(x, y, z, radius), ...].

    Unlike `ball` this one does get rendered, so the rings are laid in the plane
    normal to the local direction — a tube whose rings all sit in the same world
    plane pinches to a ribbon wherever the path turns.

    The frame is taken off world +Y, the figure's left. Every path here runs
    down her back in the x–z plane, where +Y is exactly perpendicular and the
    frame is stable; the degenerate case is checked for anyway because the cost
    of being wrong is a tube inside out along one section and nothing else.
    """
    up = Vector((0.0, 1.0, 0.0))
    pts = [Vector(p[:3]) for p in path]
    rad = [p[3] for p in path]
    vs, fs = [], []
    for i, c in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = d.cross(up)
        if u.length < 1e-6:
            u = d.cross(Vector((1.0, 0.0, 0.0)))
        u.normalize()
        v = d.cross(u).normalized()
        for k in range(seg):
            a = 2.0 * math.pi * k / seg
            vs.append(c + (u * math.cos(a) + v * math.sin(a)) * rad[i])
    for i in range(len(pts) - 1):
        for k in range(seg):
            j = (k + 1) % seg
            fs.append([i * seg + k, i * seg + j,
                       (i + 1) * seg + j, (i + 1) * seg + k])
    # Both ends closed, on a point pushed a radius past the last ring so the tip
    # is a cone rather than a flat disc seen edge-on.
    lo, hi = len(vs), len(vs) + 1
    vs.append(pts[0] - (pts[1] - pts[0]).normalized() * rad[0])
    vs.append(pts[-1] + (pts[-1] - pts[-2]).normalized() * rad[-1])
    n = (len(pts) - 1) * seg
    for k in range(seg):
        j = (k + 1) % seg
        fs.append([lo, j, k])
        fs.append([hi, n + k, n + j])
    return vs, fs


def ring(c, ra, rb, wire, seg=18, ring_seg=6):
    """A closed elliptical ring about the vertical axis, centred on `c`.

    `ra`/`rb` are the fore-aft and lateral radii of the ring itself and `wire`
    is the thickness of the band. Elliptical rather than round because a leg is:
    measured at the height this sits, the cross-section is 82 mm fore-and-aft
    and 60 mm across, and a circular ring big enough to clear the wider way
    stands a centimetre off the skin on the narrower one, which reads as a hoop
    somebody has thrown at her.

    Slightly generous on purpose, all the same. A ring that intersects the leg
    shows skin through the metal and stops being an object; a ring floating
    three or four millimetres off it is what an anklet does anyway.
    """
    vs, fs = [], []
    for i in range(seg):
        a = 2.0 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        for k in range(ring_seg):
            b = 2.0 * math.pi * k / ring_seg
            cb, sb = math.cos(b), math.sin(b)
            vs.append((c[0] + ca * (ra + wire * cb),
                       c[1] + sa * (rb + wire * cb),
                       c[2] + wire * sb))
    for i in range(seg):
        i2 = (i + 1) % seg
        for k in range(ring_seg):
            k2 = (k + 1) % ring_seg
            fs.append([i * ring_seg + k, i2 * ring_seg + k,
                       i2 * ring_seg + k2, i * ring_seg + k2])
    return vs, fs


def cutters(J, k=(1.0, 1.0, 1.0), torso=True, tail=True):
    """The paint volumes, each one closed, positioned off the joint markers.

    Two rules govern every entry, and both were learned the hard way.

    *One shell per volume.* `_inside` is a ray parity test and parity only holds
    on a single closed surface — a ray through the overlap of two shells crosses
    four walls, counts even, and reports outside. Two overlapping halves of a
    mouth painted as one volume gave a mouth in three disconnected pieces.

    *A cutter is a punch, not a blob.* It has to run deep, well past the surface
    it marks, and cross it steeply; it is tight only in the two directions that
    define the shape being drawn. Sized to resemble the feature instead — a brow
    12 mm deep sitting just under a forehead — it lies nearly tangent, so along
    its whole rim inside-or-outside turns on tenths of a millimetre and the
    feature comes back with a fuzzy halo. What gets painted is the cutter's
    cross section where the finished surface passes through it, so the shape
    wanted is its *silhouette* and the depth is only there to keep the edge
    sharp.

    `k` is the head frame — see SKULL above. It is (1, 1, 1) for Baye, whose
    skull every number below was measured on, and `vault(obj) / SKULL` for
    anybody else. `torso` draws the areolae and the pubic wedge; the bathers
    turn it off, because both are written as absolute heights off a 1.75 m
    figure and there is no honest way to map a chest the way a skull maps. On a
    1.24 m girl the wedge lands on her sternum.

    `tail` says this figure is wearing the modelled ponytail — see `extras`. It
    is what the nape is for, and only she has it; see that cutter for why
    nobody without a tail should be given one.
    """
    out = []

    def add(name, mark, prev, prio, c, r, rows=12, seg=20):
        vs, fs = ball(c[0], c[1], c[2], r[0], r[1], r[2], rows, seg)
        lo = Vector((min(v[a] for v in vs) for a in range(3)))
        hi = Vector((max(v[a] for v in vs) for a in range(3)))
        out.append((BVHTree.FromPolygons([tuple(v) for v in vs], fs,
                                         all_triangles=False),
                    mark, prev, prio, lo, hi, name))

    kx, ky, kz = k
    # One scale for the round features, so an iris on a short wide skull is
    # still a circle. Two would make it an ellipse of exactly the wrong
    # proportions — tall where the head is short.
    kf = math.sqrt(ky * kz)
    E = J["l-eye"]

    def fx(x):
        """One of Baye's face x's, on this figure.

        Anchored on the eye rather than on `head` or on the vault's centre: the
        eye is a point on the surface, it is the landmark the face is built
        around, and — checked on all eight bathers — it puts the hairline the
        same fraction of the way down the skull on every one of them. The vault
        centre does not: it is measured over the forehead as well, and the
        forehead is exactly what varies.
        """
        return E.x + (x - SKULL_EYE_X) * kx

    # ── how far forward a cutter has to reach ──────────────────────────────
    #
    # Every number below moved forward at once, and they were all wrong the same
    # way, so it is worth writing down what the mistake was.
    #
    # The rule in this docstring — a cutter is a punch, it runs deep and crosses
    # the surface steeply — is about the *back* of the cutter. It says nothing
    # about the front, and the front is where these were all failing: the shape
    # you get is the cutter's cross-section where the finished surface passes
    # through it, and a cutter that stops short of the surface has no cross
    # section there at all. It paints nothing, silently, and `paint` prints a
    # tally that does not include it — a line that is missing rather than a line
    # that is wrong, which is the hardest kind to notice.
    #
    # Measured off the mesh, the front of the figure at this height runs:
    #
    #     eyeball front pole   x = 0.1462     iris cutter reached  0.1458
    #     brow ridge           x = 0.1511     brow cutter reached  0.1388
    #     upper lip            x = 0.1681     mouth cutter reached 0.0824
    #
    # So the iris missed by four tenths of a millimetre, which is why she has a
    # pupil and no iris — the pupil's needle happens to be 2 mm longer. The brow
    # missed by 12 mm. And the mouth missed by 86 mm, because `J["mouth"]` is
    # not on the mouth: it is MakeHuman's internal pivot, sitting inside the
    # skull at the height of the *nose*. Twenty-nine vertices somewhere in the
    # middle of her head have been the entire mouth since the figure shipped.
    #
    # None of that is visible in a render unless you go looking. A face with no
    # mouth does not read as a face with something missing, it reads as a face
    # slightly out of focus, and it survived a dozen contact sheets on that.
    for s, tag in ((1, "l"), (-1, "r")):
        e = J["%s-eye" % tag]
        # ── waist, not tip ──────────────────────────────────────────────
        #
        # Reaching the surface is necessary and it is not sufficient, which is
        # the second half of the same lesson and cost a second render to learn.
        # Move the iris needle forward until its front tip cleared the eyeball
        # by 4.6 mm and she got an iris 3 mm across instead of 12 — because an
        # ellipsoid's tip is a taper. At 90% of the way along a 45 mm semi-axis
        # the cross-section is down to sqrt(1 - 0.9^2) = 44% of nominal, and
        # what gets painted is the cross-section where the surface passes
        # through, not the radius it was declared with.
        #
        # So these are centred so that their *waist* sits on the surface, not
        # so that their tip clears it. The ellipsoid then runs 5 cm out in front
        # of her face, through nothing at all, and the 5 cm behind it is the
        # punch the docstring asks for. The declared radius is the painted
        # radius, which is what makes these numbers mean anything.
        add("iris" + tag, IRIS_M, IRIS_P, 4,
            (fx(0.1455), e.y, e.z), (0.0500, 0.0058 * kf, 0.0058 * kf))
        add("pupil" + tag, PUPIL_M, PUPIL_P, 5,
            (fx(0.1455), e.y, e.z), (0.0500, 0.0026 * kf, 0.0026 * kf))
        # Brow, a little above and slightly outboard of the eye.
        add("brow" + tag, HAIR_M, HAIR_P, 3,
            (e.x - 0.020 * kx, e.y * 1.06, e.z + 0.026 * kz),
            (0.0480, 0.0250 * ky, 0.0055 * kz))
        # The lash lines, along the top and the bottom of the aperture.
        #
        # She already *has* eyelashes: MakeHuman's lash strips come through the
        # import as two of the kept helpers and are welded in with everything
        # else. They are also half a millimetre of geometry going through a
        # decimator that keeps one triangle in eight, which leaves a suggestion
        # of a smudge — and the whole lesson of this file is that at the range
        # she is actually looked at, a feature is a colour and not a shape. So
        # the lashes get drawn the way the brows and the mouth are drawn, and
        # the modelled strips are caught inside the same volume on the way past,
        # which is what stops the lower ones rendering as a pale scalloped fringe
        # under each eye.
        #
        # Both have to come *after* the iris and the pupil in this list. `paint`
        # walks the coats in order and every hit overwrites, so list order is the
        # priority whatever `prio` says — and a lash line's whole job is to sit
        # over the top of the eyeball rather than under it.
        # Waisted on the lid like the iris above, and the radii cut back to
        # suit: the lower strip was still coming out pale because its front tip
        # stopped a couple of millimetres short of the strip's own front, and
        # what a light scalloped fringe under an eye reads as is not eyelashes.
        add("lash" + tag, LASH_M, LASH_P, 6,
            (fx(0.1380), e.y, e.z + 0.0074 * kz),
            (0.0500, 0.0118 * ky, 0.0019 * kz))
        add("lashlo" + tag, LASH_M, LASH_P, 6,
            (fx(0.1380), e.y, e.z - 0.0078 * kz),
            (0.0500, 0.0106 * ky, 0.0016 * kz))
    # ── the mouth ──────────────────────────────────────────────────────────
    #
    # Placed off the chin, because `J["mouth"]` is unusable (see above) and the
    # chin marker is a real landmark on a real surface. Measured down the
    # midline, the profile from the nose to the chin goes
    #
    #     z 1.586  x 0.1762   nose tip
    #     z 1.570  x 0.1645   subnasale, the bottom of the philtrum
    #     z 1.559  x 0.1681   upper lip
    #     z 1.551  x 0.1632   the crease between the lips   <- the mouth line
    #     z 1.544  x 0.1638   lower lip
    #     z 1.508  x 0.1509   the point of the chin
    #
    # and the crease is 43 mm above the chin marker, which is where this goes.
    # A local minimum between two local maxima is what a closed mouth *is*, and
    # it is a far better anchor than any joint in the file, because it is the
    # feature rather than a pivot somebody chose for it.
    #
    # Three separate shells, so parity stays valid — see the docstring — with
    # the corners set *higher* and further back than the middle. A dead-straight
    # mouth is the one feature that makes a head read as a mannequin.
    #
    # The corners used to be 1.8 mm below the middle, which is a mouth at rest,
    # and that was right while she was a figure standing on a promenade looking
    # at the sea. She is not that any more — she notices you, goes down on all
    # fours, somersaults, cartwheels, and now stands in a jet of water with her
    # arms out — and a resting mouth over the top of all that reads as somebody
    # enduring it. 3.2 mm above the middle is five millimetres of lift across a
    # 55 mm mouth: a pleasant face, not a grin.
    #
    # The grin is the jaw bone's job and it only happens when she is being
    # hosed. This is what her face does the rest of the time.
    # ── and why three shells was the wrong number ──────────────────────────
    #
    # Three of them is what made the shape awkward, and the awkwardness was not
    # in any one of the numbers. A mouth is a curve, and three ellipsoids cannot
    # be a curve: the middle one sat flat across 27 mm, the two corner ones sat
    # flat across 22 mm each and 3.2 mm higher, and where they met there was a
    # step. What you get from that is a lip line in three straight runs with two
    # kinks in it, and since the corner shells overlap the middle one for half
    # their length, the mouth is also visibly *taller* in the two places the
    # kinks are. Nothing in the render says "the corner shell is 3.2 mm too
    # high"; it says her mouth is a shape you cannot name.
    #
    # Nine shells on a parabola instead, with three things varying together
    # along it, because all three are what a mouth actually does:
    #
    #   - it lifts towards the corners (`LIFT`), which is the pleasant face the
    #     old note argues for and is kept;
    #   - it runs *back* towards the corners (`BACK`), because a face is round
    #     and a lip line that keeps its depth wraps out past the cheek;
    #   - and it gets thinner towards the corners, which is the one the three
    #     lumps could not do at all and the one that reads most as a mouth.
    #
    # Overlapping is fine here and only here: parity is a property of a single
    # closed shell, and these are nine separate cutters tested independently,
    # not nine halves of one volume.
    lip = J["jaw"].z + 0.043 * kz
    HALF, LIFT, BACK = 0.0215 * ky, 0.0026 * kz, 0.0105 * kx
    for i in range(9):
        f = i / 4.0 - 1.0                 # -1 at her right corner, +1 at her left
        a = abs(f)
        add("mouth%d" % i, MOUTH_M, MOUTH_P, 4,
            (fx(0.128) - BACK * a * a, f * HALF, lip + LIFT * a * a),
            (0.0550, (0.0068 - 0.0034 * a ** 3) * ky,
             (0.0027 - 0.0014 * a ** 1.6) * kz))

    # Everything from here to the hair is written as an absolute height on
    # a 1.75 m figure, and unlike the face there is nothing to map it with:
    # a chest is not a box the way a braincase is, and `spine-1` lands on
    # the bust on the women and nowhere useful on the girl. So the bathers
    # switch it off rather than get it wrong — the areola cutter at
    # z 1.2531 is on the 1.38 m boy's jaw, and the pubic wedge at z 0.87 is
    # on the 1.24 m girl's sternum, both of them under a swimsuit that is
    # sized off her own joints and lands in the right place. Nobody at three
    # metres misses either one.
    if torso:
        # Areolae, and the only thing worth writing down is where they are.
        #
        # There is no joint marker for a breast, so the position was measured off
        # the mesh rather than typed: scan the band the breast occupies and take the
        # row where x peaks. That matters, because the naive search — the
        # forward-most vertex anywhere on the chest — lands at y = 0.023, which is
        # the *sternum*. At most heights on this figure the midline is further
        # forward than the breast is, so the apex is a local maximum and not a
        # global one. Measured: x 0.1677, y ±0.0770, z 1.2531.
        #
        # Punches, per the rule at the top: 5.5 cm deep against a 1.9 cm waist, so
        # the front tip clears the surface by 1.5 cm and the cross-section where the
        # skin actually passes through is about 28 mm across.
        for s in (1, -1):
            add("areola%d" % s, AREOLA_M, AREOLA_P, 3,
                (0.128, s * 0.0770, 1.2531), (0.0550, 0.0190, 0.0190))

        # ── pubic hair ─────────────────────────────────────────────────────────
        #
        # Three cutters in a column rather than one, for the mouth's reason: the
        # shape is the whole of what makes it read. One ellipse centred on the mons
        # is a symmetric blob, and a symmetric dark blob there is a bruise. The
        # thing is a wedge — broad across the top, tapering to nothing between the
        # legs — and three overlapping discs of 60, 46 and 26 mm do that with three
        # numbers. They overlap, which is allowed and only allowed here: parity is a
        # property of one closed shell, and these are three separate cutters tested
        # independently, exactly as the nine lumps of the mouth are.
        #
        # There is no joint marker for this, and `pelvis` (z 0.934) is a pivot
        # inside her rather than a point on her, so the heights come off the mesh:
        # the midline front surface runs x 0.1223 at z 0.86 to x 0.1441 at z 0.92,
        # and the hip joints sit at z 0.909. The wedge is hung across that.
        #
        # ── and why it runs down to 0.823 rather than stopping at the mons ───────
        #
        # Because otherwise nobody would ever see it. The wrap is rigid to her
        # pelvis — `hip_scarf` says so and is right to — and its front spans
        # z 0.828 (SCARF_HEM) to 0.940 (SCARF_TOP less the 2 cm front dip). The
        # whole mons sits inside that band, so no clip in the repertoire can expose
        # it: the cloth goes where the hips go, cartwheel included. The only skin
        # below her waist that is ever in view is what shows under the hem between
        # the tassels, so the bottom two rows are the ones that do any work, and
        # they are down there because that is where the gap is rather than because
        # an ellipsoid wanted to be. It is not a compromise anatomically — pubic
        # hair does run down — but the *reason* for those two rows is the hem.
        #
        # Each row's centre is put 40 mm behind the surface at its own height, which
        # holds the fraction along the punch — and therefore the cross-section
        # factor, 0.686 — the same for all three. That is what makes the declared
        # radii below mean something: multiply by 0.686 and you have the painted
        # size, per the waist-not-tip rule at the top of this function. Getting this
        # wrong is how the iris came out 3 mm across instead of 12.
        #
        # Softness is *right* here, which is worth saying because it is the opposite
        # of everything else this file has learned about the decimator. A garment
        # needs a crisp hem and the averaging destroys it — that is the whole story
        # of the painted wrap that had to be taken off her. Hair on skin has no hem.
        # The few centimetres of gradient the export adds is the one place where the
        # artefact is the feature.
        PUBIC_BACK = 0.040        # how far behind the surface each row is centred
        for i, (pz, surf, wide) in enumerate((
                (0.913, 0.1405, 0.0437),      # the top of the wedge, 60 mm across
                (0.891, 0.1364, 0.0335),      # 46 mm
                (0.869, 0.1268, 0.0248),      # 34 mm
                (0.846, 0.1150, 0.0190),      # 26 mm — the hem is at 0.828
                (0.823, 0.1000, 0.0146))):    # 20 mm, and out
            add("pubis%d" % i, PUBIC_M, PUBIC_P, 3,
                (surf - PUBIC_BACK, 0.0, pz), (0.0550, wide, 0.0233))

    # Hair: a cap over the skull, cut at the brow. Unlike the others this one is
    # a solid the scalp sits inside, not a punch through it.
    #
    # Pushed forward 4 cm from where it first sat. It used to stop at x = 0.099
    # and her forehead runs out to 0.145 at that height, so there were four and
    # a half centimetres of bare scalp in front of the hairline — which from the
    # promenade is not a high forehead, it is a bald woman.
    #
    # Off the eye in both axes now, not off `head` and `head-2`. Baye's crown
    # marker sits 9 mm under the top of her skull and the girl's sits 20 mm
    # under hers, so anchoring the cap's height on it drops the cap 13 mm on her
    # and takes the hairline down over the eyes. `E.z + 0.052` is the same point
    # on Baye — 1.675 either way — and holds on a skull that is not hers.
    add("hair", HAIR_M, HAIR_P, 2,
        (fx(0.040), 0.0, E.z + 0.052 * kz),
        (0.112 * kx, 0.092 * ky, 0.104 * kz), rows=16, seg=26)

    # And the nape, as a second shell rather than by stretching the first.
    # The cap has to stop at the brow and a single ellipsoid long enough to
    # reach the hairline at the back reaches the eyebrows at the front. This one
    # is behind the ears and below the crown, which is where the hair gathered
    # into the knot actually lies — without it the modelled tail hangs off a
    # shaved neck, which is a worse read than no tail at all.
    #
    # It only goes on the figure that has the tail, and that is the whole of
    # `tail`. The eight bathers shipped with one and it was the first thing
    # anybody said about them: a dark wedge running from the hairline to the
    # shoulder blades. Cutting it there is not a loss, because a cap ending in
    # the cap's own ellipse is a haircut, and what the nape was holding up was
    # never there.
    #
    # It reads worse on them than the same paint does on her for the reason
    # `perineum` sets out: paint is interpolated across whatever triangle it
    # lands on, these are decimated to a quarter of her density, and the wedge
    # that is three centimetres of gradient on Baye is ten on a child.
    #
    # ── and it was too long on her as well ───────────────────────────────────
    #
    # Cutting it from the bathers fixed the bathers and left the same paint on
    # the one figure that kept it, where it was reported again: black on the
    # neck, below the hairline, either side of the tail. Measured off the
    # exported blob rather than off the cutter, the old ellipsoid — centre
    # `neck.z + 0.058`, half-height 0.085 — painted 168 vertices of the body
    # shell below the head joint, reaching down to y = 1.4657. That is 125 mm
    # under the head joint at 1.5907 and 11 mm under the neck joint at 1.4768:
    # the whole back of the neck. The tail hangs clear of it at x −0.131 to
    # −0.034 and is only 36 mm across, while the paint runs out to |z| = 0.046,
    # so about 16 mm of painted neck stood proud either side of the tail. That
    # is the black in the report, and it is paint — not a shadow, not the tail's
    # root, and not a quantisation edge.
    #
    # The bottom is now put on a landmark instead of on a guess. Down the back
    # midline the surface tucks furthest forward at y = 1.535, x = −0.011, and
    # that is where its normal flips: above it the vertex normals point down and
    # back (n.y −0.13 at 1.54, −0.45 at 1.58) because that is the underside of
    # the occiput, and below it they point up and back (+0.08 at 1.53, +0.31 at
    # 1.50) because that is neck. Hair gathered into a knot lies on the half
    # that faces down and stops at the crease; it does not lie on the half that
    # faces up. So the ellipsoid is sized to land its lower boundary there —
    # where the neck's own surface sits, the boundary is at
    # `centre − 0.807 × half-height` — which puts the paint's last row at
    # y = 1.538, 3 mm above the crease and 53 mm under the head joint.
    #
    # Shorter, not just higher: the half-height comes down with the centre so
    # the top still clears the cap. The cap alone reaches y = 1.576 on the back
    # midline and this reaches 1.629, so the two overlap by five centimetres and
    # there is no bare ring between them — checked vertex by vertex down the
    # midline strip, and the painted band is continuous from the crown to 1.538
    # on both the old numbers and these.
    if tail:
        add("nape", HAIR_M, HAIR_P, 2,
            (fx(-0.073), 0.0, J["neck"].z + 0.100 * kz),
            (0.105 * kx, 0.070 * ky, 0.052 * kz), rows=14, seg=22)

    # There is no painted garment on this figure any more, and that is the whole
    # of the entry. She wears geometry (see `hip_scarf`) and nothing else.
    #
    # The last version of this was a "lining" — the same ellipsoid, shrunk to sit
    # inside the wrap and recoloured to the wrap's own near-black — whose job was
    # to stop skin showing between the hem and the tops of the tassels. It was
    # written with the note "if you can see this at all, something is wrong with
    # the scarf", and you could see it, and the note was wrong about why.
    #
    # A cutter has a sharp boundary. Painted colour does not: the export
    # decimator collapses edges and *averages* the colours of the vertices it
    # merges, so a boundary that is a clean line on the 218 000-vertex mesh
    # arrives in the game as a gradient several centimetres wide. Every painted
    # feature on her is soft at the edge for this reason, which is invisible on a
    # mouth (the softness is smaller than the lip) and invisible on an areola,
    # and is the entire appearance of a large flat patch: it reads as spray
    # paint. Tucking the cutter under the cloth does not help, because what
    # shows is not the cutter, it is the halo the decimator smears past it.
    #
    # So: nothing. Between the tassels you can see her, which is what a fringe
    # is.
    #
    # Deleting the entry is not on its own enough to get the colour off her, and
    # the release that did it shipped believing otherwise. `paint` resets from
    # `baseP`, and `baseP` had been seeded by snapshotting the figure while the
    # lining was still painted on — so the lining *was* the base, and the reset
    # restored it every run. See `--rebase`, which no longer snapshots.
    return out


def paint(body, coats):
    """Reset to the unpainted figure, then overwrite wherever a cutter claims.

    The reset is the whole of what this docstring is for, because leaving it out
    cost a release. Paint only ever *overwrites*: it walks the vertices, asks
    each cutter whether it owns this one, and writes if so. Nothing ever writes
    a vertex back. So a cutter that gets **smaller** — or is recoloured, or
    deleted outright — leaves its old colour on every vertex it has stopped
    claiming, and there is no pass anywhere that would ever take it off again.

    That is exactly what happened to the swimsuit. `SUIT_P` stopped being
    referenced by any cutter in this file, and 137 vertices of (0.114, 0.169,
    0.290) stayed baked into the blend and shipped in the blob, seven
    centimetres below the hem of the scarf that was supposed to have replaced
    it. Grepping the source for the colour finds nothing. The only way to see it
    is to decode the exported mesh and look at the numbers, which is how it was
    finally found — after it had been explained away twice as a shadow.

    Resetting from per-vertex `baseM`/`baseP` rather than from one skin constant,
    because the eyeballs, the lashes, the teeth and the tongue come in as their
    own objects with their own colours, and the hair and the anklets are
    coloured in `extras`; none of those is redrawn by any cutter, and a blanket
    reset to skin would give her skin-coloured eyes.
    """
    me = body.data
    a_m = me.color_attributes["mark"]
    a_p = me.color_attributes["prev"]
    a_bm = me.color_attributes.get("baseM")
    a_bp = me.color_attributes.get("baseP")
    if a_bm is None or a_bp is None:
        print("[mh]   WARNING no `base` colours — cannot reset, paint is "
              "additive only. Rebuild from scratch to fix.")
    else:
        # Two of them, because `mark` and `prev` are different palettes: `mark`
        # is the marker channel the crowd shader recolours per instance and
        # `prev` is the literal colour that ships. Resetting both from one base
        # would give her a white face on one channel or a skin-coloured eyeball
        # on the other, depending which was kept.
        for i in range(len(me.vertices)):
            a_m.data[i].color = a_bm.data[i].color
            a_p.data[i].color = a_bp.data[i].color
    dive = 0.0012
    hits = {}
    for i, v in enumerate(me.vertices):
        p = v.co - v.normal * dive
        for tree, mark, prev, _prio, lo, hi, name in coats:
            if not (lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y
                    and lo.z <= p.z <= hi.z):
                continue
            if _inside(tree, p):
                a_m.data[i].color = (*mark, 1.0)
                a_p.data[i].color = (*prev, 1.0)
                hits[name] = hits.get(name, 0) + 1
    for k in sorted(hits):
        print("[mh]   painted %-10s %6d verts" % (k, hits[k]))
    return body


def hem_group(body, coats, name="hem"):
    """A vertex group over the hems of `coats` — the edges the paint crosses.

    The decimator has exactly one lever over *where* it spends what it is
    allowed to keep, and it is this: a vertex whose weight is zero is never
    collapsed. So an inverted group is an absolute reprieve, and it has to be
    spent on very little or it eats the whole budget. Weighting the *garment*
    rather than its hem was tried and cost 2 134 of 3 573 vertices — sixty per
    cent of a whole person spent on the inside of a bikini, with the head down
    from 3 154 triangles to 939 to pay for it.

    So it is the hem alone: every vertex of every edge that has one end inside a
    coat and the other outside. That is a one-vertex-wide ring, it is the only
    place the mesh's coarseness shows, and it is about a tenth of the budget.
    Everything on either side of it is free to collapse as far as the ratio
    wants, because flat colour does not care how big its triangles are.

    The group is safe to leave on the object it is exported from, and that is
    not luck: `weights` below reads `gname`, which is taken before this runs, so
    a group added afterwards is not in it and is skipped along with every other
    group whose name is not a bone's.
    """
    me = body.data
    g = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
    dive = 0.0012
    inside = set()
    for i, v in enumerate(me.vertices):
        p = v.co - v.normal * dive
        for tree, _m, _p, _prio, lo, hi, _name in coats:
            if not (lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y
                    and lo.z <= p.z <= hi.z):
                continue
            if _inside(tree, p):
                inside.add(i)
                break
    ring = set()
    for e in me.edges:
        a, b = e.vertices
        if (a in inside) != (b in inside):
            ring.add(a)
            ring.add(b)
    g.add(sorted(ring), 1.0, "REPLACE")
    print("[mh]   hem: %d verts inside the coats, %d on the edge and held "
          "against the decimator" % (len(inside), len(ring)))
    return name


# --------------------------------------------------------------------------- #
#  export                                                                      #
# --------------------------------------------------------------------------- #

def export_static(body, path, tris=26000):
    """Write the *posed* figure as a plain .fr3d v1 blob.

    No skinning, no bones, no animation — the armature is evaluated and the
    result frozen. That is a deliberately small first step: the runtime already
    decodes v1 and already reads its colour bytes per vertex (see `readFR3D` in
    src/48-landmarks.js), so this puts her on the concrete in Šibenik without a
    single line of new runtime code. Scale, palette, lighting and placement all
    get proved before any of the skinning work begins.

    Colours come from the `prev` attribute rather than `mark`, because the
    landmark material multiplies by vVCol literally and knows nothing about the
    marker palette. A `mark` export is what the eventual skinned crowd path will
    want instead.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    ob = body.evaluated_get(dg)
    me = ob.to_mesh()

    # Decimate a throwaway copy. 430 000 triangles is a fine thing to look at in
    # Blender and an absurd thing to put in a browser next to a burning
    # coastline.
    tmp = bpy.data.meshes.new_from_object(ob)
    holder = bpy.data.objects.new("export_tmp", tmp)
    bpy.context.collection.objects.link(holder)
    have = sum(len(p.vertices) - 2 for p in tmp.polygons)
    if have > tris:
        bpy.context.view_layer.objects.active = holder
        d = holder.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = tris / have
        bpy.ops.object.modifier_apply(modifier="dec")
    src = holder.data
    src.calc_loop_triangles()
    try:
        src.calc_normals_split()
    except (AttributeError, RuntimeError):
        pass
    col = src.color_attributes.get("prev")

    pos, nrm, cols, idx, lookup = [], [], [], [], {}
    for tri in src.loop_triangles:
        for li in tri.loops:
            vi = src.loops[li].vertex_index
            v = src.vertices[vi]
            n = src.loops[li].normal if src.loops[li].normal.length else v.normal
            c = col.data[vi].color if col else (1.0, 1.0, 1.0, 1.0)
            c8 = tuple(min(255, max(0, int(x * 255 + 0.5))) for x in c[:3])
            # Blender Z-up -> three.js Y-up, exactly as frmesh.export() does it.
            # Leaving this out does not look like a bug in Blender and does not
            # look like a bug in the loader: the figure arrives in the world at
            # the right place, the right size and the right colour, lying flat
            # on her back with half of her under the pavement.
            co = (v.co.x, v.co.z, -v.co.y)
            nv3 = (n.x, n.z, -n.y)
            key = (round(co[0], 5), round(co[1], 5), round(co[2], 5),
                   round(nv3[0], 3), round(nv3[1], 3), round(nv3[2], 3), c8)
            j = lookup.get(key)
            if j is None:
                j = len(pos) // 3
                lookup[key] = j
                pos.extend(co)
                nrm.extend(nv3)
                cols.extend(c8)
            idx.append(j)

    import gzip
    import struct
    nv, ni = len(pos) // 3, len(idx)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    head = struct.pack("<4sIII6f", b"FR3D", 1, nv, ni,
                       min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))
    blob = (head
            + struct.pack("<%df" % (nv * 3), *pos)
            + struct.pack("<%df" % (nv * 3), *nrm)
            + bytes(cols)
            + struct.pack("<%dI" % ni, *idx))
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(blob)
    print("[mh] export %s  %d verts  %d tris  %d bytes gz"
          % (path.name, nv, ni // 3, path.stat().st_size))

    bpy.data.objects.remove(holder, do_unlink=True)
    ob.to_mesh_clear()


# --------------------------------------------------------------------------- #
#  export — skinned (.fr3d v3)                                                 #
# --------------------------------------------------------------------------- #
#
# Blender is Z-up with X forward; three.js is Y-up. Every position, every
# normal and every *matrix* has to cross that boundary, and the matrices are the
# part that is easy to get wrong: a point converts as `CONV @ p`, but a
# transform converts by *conjugation*, `CONV @ M @ CONV^-1`. Get that backwards
# and the rest pose still looks right — it is the animation that comes out
# mirrored, which is a much more expensive thing to discover.
CONV = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
CONV_I = CONV.inverted()

SAMPLE_FPS = 30           # clips are baked, not solved, so this is the quality
MAX_INFLUENCES = 4        # matches vertex_group_limit_total() in skin()


def _rest_locals(rig):
    """[(name, parent index, parent-relative rest matrix)] in game space.

    Ordered parents-before-children, because the runtime composes the hierarchy
    in a single forward pass over this list and never sorts anything.
    """
    order, seen = [], set()

    def visit(b):
        if b.name in seen:
            return
        if b.parent:
            visit(b.parent)
        seen.add(b.name)
        order.append(b)

    for b in rig.data.bones:
        visit(b)

    index = {b.name: i for i, b in enumerate(order)}
    out = []
    for b in order:
        local = (b.parent.matrix_local.inverted() @ b.matrix_local
                 if b.parent else b.matrix_local.copy())
        out.append((b.name, index[b.parent.name] if b.parent else -1,
                    local, CONV @ local @ CONV_I))
    return out


def _quant_q(q):
    """(x, y, z, w) as four int16. Blender hands them back w-first."""
    v = (q.x, q.y, q.z, q.w)
    return tuple(max(-32767, min(32767, int(round(a * 32767)))) for a in v)


def _lerp_pose(a, b, u):
    """Blend two keyframe pose dicts. Missing bones are the rest pose."""
    out = {}
    for k in set(a) | set(b):
        pa, pb = a.get(k, (0.0, 0.0, 0.0)), b.get(k, (0.0, 0.0, 0.0))
        out[k] = tuple(x + (y - x) * u for x, y in zip(pa, pb))
    return out


def _bake_clip(rest, spec):
    """Sample one authored clip to `SAMPLE_FPS` and quantise it.

    Keys are interpolated with a smoothstep rather than linearly. Hand-authored
    poses are sparse — three or four to a second at best — and linear blending
    between them gives every limb a hard change of direction on every key, which
    reads as a puppet being jerked rather than a person moving. The ease costs
    one line and does most of the work that an animator's Bezier handles would.
    """
    keys = spec["keys"]
    dur = keys[-1][0]
    nf = max(2, int(round(dur * SAMPLE_FPS)) + (0 if spec.get("loop", True) else 1))
    frames = []
    prev_q = {}
    for f in range(nf):
        t = (f / nf if spec.get("loop", True) else f / (nf - 1)) * dur
        i = 0
        while i < len(keys) - 2 and keys[i + 1][0] <= t:
            i += 1
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        u = u * u * (3.0 - 2.0 * u)
        blended = _lerp_pose(p0, p1, u)

        root = blended.get("@root", (0.0, 0.0, 0.0))
        # A whole-body rotation about the fore-and-aft axis, in armature space
        # rather than in any bone's space, applied to the root bone so that
        # everything below it comes along. The cartwheel needs it and nothing
        # else does.
        #
        # It cannot be authored on `pelvis` the way the somersault's pitch is.
        # That works because the pelvis bone's local X happens to come out as
        # world −Y exactly, so pelvis X is a clean pitch. Its local Z does not
        # come out as world −X: the bone runs from the hip up to spine-4, which
        # is twenty-seven degrees off vertical, and `align_roll` can only put
        # local Z perpendicular to that. Rolling on it corkscrews her — the
        # first cartwheel here did, and it read as a pinwheel with her hands a
        # third of a metre clear of the deck all the way round.
        #
        # Pre-multiplying in armature space sidesteps the bone's frame
        # entirely. The pivot lands on the hip for free: only the rotation of
        # this matrix survives — `rt` below carries the root bone's position
        # and is not touched by `W` — so the body turns about the root joint,
        # which is where a cartwheel turns.
        roll = blended.get("@roll", (0.0,))[0]
        W = (Matrix.Rotation(math.radians(roll), 4, Vector((-1.0, 0.0, 0.0)))
             if roll else None)
        quats = []
        for bi, (name, _parent, local_b, local_g) in enumerate(rest):
            rot = blended.get(name)
            if rot:
                basis = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
                m = CONV @ (local_b @ basis.to_4x4()) @ CONV_I
            else:
                m = local_g
            if W is not None and bi == 0:
                m = CONV @ W @ CONV_I @ m
            q = m.to_quaternion()
            # Keep the sign continuous along the track. The runtime nlerps
            # between adjacent frames, and a quaternion that flips sign between
            # two frames of a smooth motion takes the short way round the wrong
            # side of the sphere — one frame of the figure inside out.
            p = prev_q.get(bi)
            if p and (q.w * p.w + q.x * p.x + q.y * p.y + q.z * p.z) < 0.0:
                q = Quaternion((-q.w, -q.x, -q.y, -q.z))
            prev_q[bi] = q
            quats.append(_quant_q(q))

        # The root's translation is authored in Blender armature space, so it
        # converts as a point.
        rt = rest[0][3].translation + (CONV @ Vector(root))
        frames.append((tuple(rt), quats))
    return {"name": spec.get("name", "?"), "dur": dur, "loop": spec.get("loop", True),
            "frames": frames}


TIPS = ("handL", "handR", "toeL", "toeR", "footL", "footR", "head")


def _lowest(rig, blended):
    """The lowest hand, foot or head of one blended pose, and which it is.

    Reproduces exactly what the exporter composes: the bones take their authored
    Eulers, the root joint is displaced by `@root`, and the whole body turns
    about that joint by `@roll`.
    """
    root = Vector(blended.get("@root", (0.0, 0.0, 0.0)))
    roll = blended.get("@roll", (0.0,))[0]
    pose(rig, {k: v for k, v in blended.items() if not k.startswith("@")})
    piv = rig.pose.bones[BONES[0][0]].head.copy()
    R = Matrix.Rotation(math.radians(roll), 3, Vector((-1.0, 0.0, 0.0)))
    low = {}
    for b in TIPS:
        if b in rig.pose.bones:
            low[b] = (rig.matrix_world
                      @ (R @ (rig.pose.bones[b].tail - piv) + piv + root)).z
    who = min(low, key=low.get)
    return who, low[who]


def wheel_floor(rig, clear=0.004):
    """Sit every cartwheel key on the deck, and solve for the hip height there.

    The counter-rotations in `_wheel` cancel the roll on paper and do not cancel
    it in the rig, for a reason worth writing down: the roll turns about the
    midline, and her shoulder and hip joints are eleven to eighteen centimetres
    either side of it. Sixty degrees over and the supporting hip has swung nine
    centimetres *down*, taking the leg and the foot with it; two hundred and
    forty degrees over, the supporting shoulder has swung the same distance up,
    taking the planted hand off the floor. The two rotations have different
    pivots, so they cannot cancel, and no choice of limb angle or hip height
    derived from limb lengths can know about it. The first version of this
    buried a toe seventeen centimetres into the concrete and floated a hand a
    third of a metre over it, and looked, in stills, entirely correct.

    So do not author the hip height at all — solve it. Pose the rig at each key,
    find the lowest extremity, and move the key until it is exactly `clear` off
    the deck. Both ways: a cartwheel is a hand-over-hand walk and something is
    touching the ground for all of it, so a limb hanging in space is as wrong as
    a limb through the concrete, and the earlier lift-only rule left her
    hopping thirty-seven centimetres between the last hand and the first foot.

    The `hip` term in `_wheel` still earns its place as the starting guess: the
    closer it starts the less this has to move, and the less the interpolation
    between two keys sags in the middle.

    Recomputed from `_wheel` on every call rather than adjusted in place, so
    running it twice does the same thing as running it once.
    """
    poses = [_wheel(i * 360.0 / WHEEL_KEYS) for i in range(WHEEL_KEYS + 1)]
    worst = floor_poses(rig, poses, clear)
    for i, p in enumerate(poses):
        WHEEL[i] = (i * WHEEL_DUR / WHEEL_KEYS, p)
    print("[mh] cartwheel: floor pass settled, deepest key %+.3f m" % worst)


def floor_poses(rig, poses, clear=0.004, passes=3):
    """Solve `@root` z for a list of poses so each one sits on the deck.

    Lifted out of the cartwheel when the moonwalk turned out to need exactly the
    same thing for exactly the same reason — the anchor leg's knee straightens
    12° across the glide, which changes its length, and no hip height authored
    as a constant can be right at both ends of that. It went ten centimetres
    through the concrete in the middle and two and a half above it at the swap.

    Modifies the poses in place and returns the deepest point left.
    """
    solved = []
    for p in poses:
        _who, z = _lowest(rig, p)
        solved.append(p.get("@root", (0.0, 0.0, 0.0))[2] + clear - z)

    # Then smooth the answer. Solved key by key it is not a curve, it is a
    # staircase: the pass pins whichever limb is lowest, and on the frames where
    # that changes hands — literally, in the cartwheel — the hip height it asks
    # for jumps as much as thirty centimetres between adjacent keys. Held
    # exactly, her hips snap twice a wheel. Three passes of a
    # quarter-half-quarter filter turns it back into something a body could do,
    # at a cost of a centimetre or two of foot through concrete, which at five
    # metres is nothing and a snapping pelvis never is. The ends are held: on
    # both clips that uses this, those two are the same pose.
    #
    # `passes=0` turns it off, and the two one-shots in the firestarter want
    # that. The filter is there because a *sampled* clip's staircase is an
    # artefact of solving frame by frame; on five hand-placed keys two tenths of
    # a second apart the staircase is the animation — she crouches and her hips
    # go down — and smoothing it is smoothing away the pose.
    for _pass in range(passes):
        smoothed = list(solved)
        for i in range(1, len(solved) - 1):
            smoothed[i] = 0.25 * solved[i - 1] + 0.5 * solved[i] + 0.25 * solved[i + 1]
        solved = smoothed

    worst = 0.0
    for i, p in enumerate(poses):
        root = list(p.get("@root", (0.0, 0.0, 0.0)))
        root[2] = solved[i]
        p["@root"] = tuple(root)
        _who, z = _lowest(rig, p)
        worst = min(worst, z)
    return worst


def dance_floor(rig, clear=0.004):
    """The same pass for the two dances, which have no roll and no hands down.

    Both are sampled from a continuous function rather than hand-keyed, for the
    reason `_wheel_half` gives: `_bake_clip` eases *within* every key interval,
    so anything authored as four or five keys arrives as four or five lurches
    with the rate going to zero between them. It also means the floor solve has
    keys close enough together to be worth running — solved at five keys, the
    moonwalk's deepest point sits in the middle of an interval where nothing was
    measured.
    """
    poses = [_shimmy_at(i / SHIMMY_KEYS) for i in range(SHIMMY_KEYS + 1)]
    worst = floor_poses(rig, poses, clear)
    for i, p in enumerate(poses):
        SHIMMY[i] = (i * SHIMMY_DUR / SHIMMY_KEYS, p)
    print("[mh] shimmy: floor pass settled, deepest key %+.3f m" % worst)

    poses = [_moon_at(i / MOON_KEYS) for i in range(MOON_KEYS + 1)]
    worst = floor_poses(rig, poses, clear)
    for i, p in enumerate(poses):
        MOON[i] = (i * MOON_DUR / MOON_KEYS, p)
    print("[mh] moonwalk: floor pass settled, deepest key %+.3f m" % worst)

    # Built here as well as solved here, for the ordering reason written above
    # TWERK: `_twerk` needs `_flat`, which is declared with the firestarter.
    poses = [_twerk_at(i / TWERK_KEYS) for i in range(TWERK_KEYS + 1)]
    worst = floor_poses(rig, poses, clear)
    TWERK[:] = [(i * TWERK_DUR / TWERK_KEYS, p) for i, p in enumerate(poses)]
    # The ankle spread is the check that the counter-rotation is right, not
    # decoration: if the thigh and the shin are held still in the world while
    # the pelvis rocks, the sole cannot be moving, so `_flat` has to come out
    # very nearly constant across the cycle. A big number here means the hips
    # are fighting the pelvis instead of going with it, and what you will see is
    # her feet sawing through the deck.
    ank = [p["footL"][0] for p in poses]
    print("[mh] twerk: floor pass settled, deepest key %+.3f m, "
          "hips %+.3f..%+.3f, ankle %.1f..%.1f deg"
          % (worst, min(p["@root"][2] for p in poses),
             max(p["@root"][2] for p in poses), min(ank), max(ank)))


def fire_floor(rig, clear=0.004):
    """The floor pass for the turn: one sampled loop and two hand-keyed one-shots.

    None of the three is filtered, which is the opposite of what the two dances
    want and worth saying why. The filter is there for clips where the support
    hands between limbs — the cartwheel, where it changes four times a turn —
    because the solve jumps when it does and the jump is an artefact. This is a
    march: one foot is down at all times, both are down at the two footfalls,
    and at those two frames the legs are the same length, so there is no
    handover to smooth. What the filter *would* remove is the bounce, which is
    two keys wide and is the only reason the hips move at all. It took it from
    four centimetres to two the first time round.

    All three end (and `cast` also begins) on `_fire_at(0)`, which is a separate
    dict each time it is called and therefore solved separately three times. It
    lands on the same number three times because it is the same pose, and that
    is what lets the game cut between them without her hips stepping.
    """
    poses = [_fire_at(i / FIRE_KEYS) for i in range(FIRE_KEYS + 1)]
    worst = floor_poses(rig, poses, clear, passes=0)
    for i, p in enumerate(poses):
        FIRE[i] = (i * FIRE_DUR / FIRE_KEYS, p)
    lo = min(p["@root"][2] for p in poses)
    hi = max(p["@root"][2] for p in poses)
    print("[mh] firestarter: deepest %+.3f m, hips travel %.3f m" % (worst, hi - lo))

    for name, clip in (("flare", FLARE), ("cast", CAST)):
        worst = floor_poses(rig, [p for _t, p in clip], clear, passes=0)
        print("[mh] %s: deepest %+.3f m" % (name, worst))


def skip_floor(rig, clear=0.004):
    """Put the skip's two contacts on the deck and lift its two floats off it.

    Not `floor_poses`, and the difference is the whole point of the clip: that
    one wants every key on the ground, and half of these are meant to be in the
    air. Nor can it be smoothed the way that one is — the staircase in the hip
    height *is* the bounce here, and filtering it out leaves a walk.

    So: solve the contacts, run the baseline between them, and lift the floats
    their authored rise above that line. The rise is what it looks like — how
    far off the deck she takes her hips — and the daylight under the trailing
    foot comes out larger, because a folded leg holds its toe up on its own.
    Nothing is allowed below `clear`, and a float that would still scrape is
    lifted until it does not: the authored rise is a floor, not a ceiling.
    """
    # Where each key's lowest extremity sits with the hips at nominal. The
    # contacts are the keys with no rise on them.
    nat = [_lowest(rig, p)[1] for _h, p in SKIP_HALF]
    con = [i for i, k in enumerate(SKIP_KEYS) if k[1] == 0.0]
    if len(con) != 2:
        sys.exit("[mh] the skip wants exactly two contacts a half-cycle")
    a, b = con
    za, zb = clear - nat[a], clear - nat[b]

    def base(h):
        """The line the hips would run along if she never left the deck.

        Between the two contacts of this half-cycle, and then on from the second
        of them to the first contact of the next — which is this one's mirror,
        so it is back at `za` again.
        """
        ha, hb = SKIP_KEYS[a][0], SKIP_KEYS[b][0]
        if h <= hb:
            return za + (zb - za) * (h - ha) / (hb - ha)
        return zb + (za - zb) * (h - hb) / (1.0 + ha - hb)

    hips = []
    for i, (h, rise, *_rest) in enumerate(SKIP_KEYS):
        z = base(h) + rise
        # A float whose lowest foot would still scrape gets lifted until it
        # does not. The authored rise is a floor, not a ceiling.
        hips.append(max(z, clear - nat[i]))

    for i, z in enumerate(hips):
        for p in (SKIP_HALF[i][1],):
            p["@root"] = (p["@root"][0], p["@root"][1], z)
    # And rebuild the cycle around the corrected half, mirror and closing key
    # included, since all three are the same dictionaries seen from elsewhere.
    SKIP[:] = ([(h * SKIP_DUR / 2.0, p) for h, p in SKIP_HALF]
               + [((1.0 + h) * SKIP_DUR / 2.0, _mirror(p)) for h, p in SKIP_HALF]
               + [(SKIP_DUR, SKIP_HALF[0][1])])
    print("[mh] skip: hips %s, contacts at %+.3f/%+.3f"
          % (" ".join("%+.3f" % z for z in hips), za, zb))


def walk_floor(rig, clear=0.004):
    """Drop every walk key onto the deck, and measure what comes out.

    The whole clip is solved and nothing in it is authored, which is the
    opposite of the skip above and is the one structural difference between the
    two gaits. A skip has two floats a half-cycle, so its hip height has to be
    written down and the floats lifted off a baseline. A walk has no floats at
    all — a foot is on the deck at every instant of it — so every key can simply
    be set on the ground, and the hip height falls out of the leg geometry.

    That is not a shortcut, it is where a walk's bounce comes from. The hips
    ride highest at mid-stance, over a leg that is nearly straight, and lowest
    at the footfall, where both legs are splayed and neither is at full length.
    Authoring that number instead would be guessing at something the skeleton
    already knows exactly.

    `passes=0` for the same reason `fire_floor` uses it: the filter in
    `floor_poses` exists for clips where the support changes hands and the solve
    jumps when it does. Here it never changes hands mid-key — the stance foot is
    the lowest thing at every one of the four — so the staircase in the hip
    height is the animation, and smoothing it is smoothing away the bounce.

    The step length is measured rather than assumed, because it is the number
    the game needs and not one that can be read off the table. It is where the
    two feet actually finish with 22 degrees at each hip, a stance knee bent
    four, and a foot hanging off the end of the shin. src/43-jadrija.js scales
    this clip's clock by how fast she is travelling, so an authored speed that
    disagrees with the geometry is feet sliding along the concrete — which is
    the one failure this gait cannot hide, because unlike the skip it never
    leaves the ground for you to lose track over.
    """
    WALK_HALF[:] = [
        (h,
         _walk_pose(0.0,
                    (sup[0], sup[1], _flat(sup[0], sup[1], WALK_PELVIS)),
                    (fre[0], fre[1], _flat(fre[0], fre[1], WALK_PELVIS) - point),
                    arm, sway))
        for h, sup, fre, point, arm, sway in WALK_KEYS]

    poses = [p for _h, p in WALK_HALF]
    worst = floor_poses(rig, poses, clear, passes=0)
    WALK[:] = ([(h * WALK_DUR / 2.0, p) for h, p in WALK_HALF]
               + [((1.0 + h) * WALK_DUR / 2.0, _mirror(p)) for h, p in WALK_HALF]
               + [(WALK_DUR, WALK_HALF[0][1])])

    # Her actual hip height, not the root displacement the other floor passes
    # print. Those two are not the same number and the difference is the whole
    # bounce: `@root` is a *correction* applied after the pose, so a key whose
    # leg is already long needs less of it, and reading the corrections as the
    # bounce gets the sign backwards. Mid-stance has the smallest root
    # displacement of the four and the highest hips of the four.
    hips = []
    for p in poses:
        _who, _z = _lowest(rig, p)              # poses the rig at this key
        hips.append((rig.matrix_world @ rig.pose.bones["pelvis"].head).z
                    + p["@root"][2])
    who, _z = _lowest(rig, WALK_HALF[0][1])     # leaves the rig at the footfall
    tl = rig.matrix_world @ rig.pose.bones["footL"].tail
    tr = rig.matrix_world @ rig.pose.bones["footR"].tail
    step = abs(tl.x - tr.x)
    print("[mh] walk: hips %s, %.1f cm of bounce, deepest %+.3f m"
          % (" ".join("%.3f" % z for z in hips),
             (max(hips) - min(hips)) * 100.0, worst))
    print("[mh]   step %.3f m, so %.2f m/s at %.2f s a cycle; "
          "lowest at the footfall is %s"
          % (step, 2.0 * step / WALK_DUR, WALK_DUR, who))


def clipcheck(rig, name):
    """Per-frame ground clearance for one clip, printed.

    Every clip in this file is authored as joint angles plus a hip height, and
    nothing in that representation knows where the floor is. This walks the
    baked frames, poses the rig at each one and reports how far the lowest
    hand, foot or head sits above z = 0 — the deck she is standing on.

    It exists because a pose that floats ten centimetres and a pose that saws
    through the concrete render identically well as stills, from any angle, and
    both are obvious the instant she moves. For the sagittal clips you can get
    away with eyeballing it. For a cartwheel, where the support hands off
    between four limbs and the hips rise fifteen centimetres in the middle, you
    cannot.
    """
    spec = next(c for c in CLIPS if c["name"] == name)
    keys, loop = spec["keys"], spec.get("loop", True)
    dur = keys[-1][0]
    nf = max(2, int(round(dur * SAMPLE_FPS)) + (0 if loop else 1))
    print("[mh] %s: %d frames over %.2f s" % (name, nf, dur))
    worst = 0.0
    for f in range(nf):
        t = (f / nf if loop else f / (nf - 1)) * dur
        i = 0
        while i < len(keys) - 2 and keys[i + 1][0] <= t:
            i += 1
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        u = u * u * (3.0 - 2.0 * u)
        blended = _lerp_pose(p0, p1, u)
        who, z = _lowest(rig, blended)
        worst = min(worst, z)
        print("  t=%5.2f  roll%+7.1f  hip%+.3f   lowest %-5s %+.3f"
              % (t, blended.get("@roll", (0.0,))[0],
                 blended.get("@root", (0.0, 0.0, 0.0))[2], who, z))
    print("[mh] %s: deepest %+.3f m" % (name, worst))


# --------------------------------------------------------------------------- #
#  nails                                                                       #
# --------------------------------------------------------------------------- #
#
# Ten fingernails, and the only interesting thing about them is *when* they are
# built. Everything else on this figure is painted — a colour per vertex laid
# down through a cutter volume — and painting will not do here, for a reason
# worth writing down because it bounds what this mesh can ever carry.
#
# Measured, not guessed: the shipped body is 13 521 vertices, of which 475 are
# on one hand and 181 on that hand's distal phalanges. Four fingertips share
# those 181, over a surface of roughly 800 mm² each, which works out at 4.4 mm
# between one vertex and the next. A fingernail is about 9 mm long. So a painted
# nail is *four vertices*, and four vertices will carry a colour and will not
# carry a picture. Nothing about the cutter machinery is at fault; there simply
# is not enough mesh there, and there cannot be — the decimator's job is to
# spend triangles where the silhouette needs them, and a nail changes no
# silhouette at all.
#
# So the nails are not painted onto the body, they are geometry laid on top of
# it, and they are added *after* the decimator has run rather than before. That
# ordering is the whole trick. Added before, a 9 mm plate is exactly what a
# collapse decimator eats first: its edges are the shortest in the mesh and its
# error is therefore the lowest, so it is the cheapest thing in the model to
# delete. Added after, thirty vertices stay thirty vertices, and thirty
# vertices across 9 mm is 1.8 mm of resolution — twice what the face has, and
# enough to draw a flame on.
#
# They cost 300 vertices and 400 triangles on 13 521 and 26 000.

# The flame, as a ramp from the cuticle to the free edge. Deliberately hot at
# the top end: the material multiplies the lit surface by this, so a value that
# looks right as a swatch comes out about a third darker on a finger held in
# front of a body, and a flame that is not brighter than skin is a bruise.
FLAME = (
    (0.00, (0.22, 0.02, 0.05)),
    (0.30, (0.62, 0.06, 0.04)),
    (0.58, (0.94, 0.32, 0.03)),
    (0.80, (1.00, 0.68, 0.10)),
    (1.00, (1.00, 0.95, 0.72)),
)

# Nail geometry, in fractions of the distal phalanx it sits on rather than in
# millimetres, so the little finger gets a little nail without a table.
NAIL_ROWS, NAIL_COLS = 6, 5     # 7 x 6 = 42 verts, 60 triangles
NAIL_FROM, NAIL_TO = 0.18, 0.94  # along the phalanx: cuticle to free edge
NAIL_WIDE = 0.66                # half-width, as a fraction of the finger radius
NAIL_DOME = 0.0009              # how proud of the skin the middle of it stands


def _nail_outline(u, vn):
    """The nail's plan shape, as a nudge to where along the finger a point sits.

    The first cut of this was a plain grid and it rendered ten rectangles: two
    straight edges, four square corners, and the unmistakable look of a sticker.
    A nail has no straight edges at all — the cuticle is a shallow curve and the
    free edge is a deeper one — so both ends are bowed by pulling the outer
    columns back along the finger. Doing it here, rather than by moving vertices
    afterwards, keeps the grid a grid: the flame is still addressed in (u, v)
    and does not have to know the outline changed.
    """
    return (u
            - 0.20 * u * u * vn ** 4          # bow the free edge back
            + 0.13 * (1.0 - u) ** 2 * vn * vn)  # and the cuticle forward


def _nail_width(u):
    """Half-width along the nail: narrow at the cuticle, widest past halfway."""
    return 1.0 - 0.44 * (1.0 - u) ** 2 - 0.16 * u ** 3


def _flame(t):
    t = max(0.0, min(1.0, t))
    for i in range(len(FLAME) - 1):
        t0, c0 = FLAME[i]
        t1, c1 = FLAME[i + 1]
        if t <= t1:
            k = 0.0 if t1 <= t0 else (t - t0) / (t1 - t0)
            return tuple(c0[j] + (c1[j] - c0[j]) * k for j in range(3))
    return FLAME[-1][1]


def _tongue(u, v, style):
    """Where along the flame a point on the nail sits.

    `u` runs 0 at the cuticle to 1 at the free edge and `v` runs -1 to 1 across.
    Feeding `u` straight to the ramp gives ten identical nails with a flat
    horizontal gradient, which is a manicure and not a flame. Bending it by `v`
    is what makes a tongue: wherever this returns a bigger number the fire has
    climbed further, so a term that peaks in the middle of the nail draws one
    flame up the centre, and a term that peaks at both edges draws two.
    """
    a = abs(v)
    if style == 0:
        return u * (1.34 - 0.62 * a)            # one flame up the middle
    if style == 1:
        return u * (0.92 + 0.58 * a)            # two, one up each edge
    if style == 2:
        return u * (1.30 - 0.62 * (v * 0.5 + 0.5))   # a lick off one corner
    return u * (1.12 - 0.26 * a * a)            # a broad, low flame

# Which flame goes on which finger, thumb outwards. Mirrored on the right hand
# so the two are a pair rather than a copy — this is the "various designs" of
# the brief, and it is the whole of what varies: with thirty vertices a nail can
# hold one flame each, not a scene.
NAIL_STYLES = (0, 2, 0, 1, 3)


def _finger_radius(src, base, axis, length):
    """Half-thickness of a finger, measured off the mesh rather than assumed.

    The nail has to sit *on* the finger: too shallow and it sinks inside, too
    proud and it floats. Both failures are a millimetre wide, which is the whole
    feature, so this is measured. The 70th percentile rather than the maximum,
    because the maximum is whichever vertex belongs to the finger next door.
    """
    lat = []
    for v in src.vertices:
        d = v.co - base
        along = d.dot(axis)
        if 0.15 * length < along < 0.85 * length:
            r = (d - axis * along).length
            if r < 0.014:
                lat.append(r)
    if len(lat) < 6:
        return 0.0045
    lat.sort()
    return lat[int(len(lat) * 0.70)]


def nail_patches(J, src, bindex):
    """Ten nails as (positions, normals, colours, bone), in Blender space.

    Each is a curved grid wrapped onto the cylinder of its own fingertip, so it
    follows the finger instead of hovering flat over it, and each is a single
    outward-facing sheet: the material is `FrontSide` and the underside of a
    nail is against the finger, so a closed shell would double the cost to hide
    faces nothing can ever see.
    """
    pos, nrm, col, bone, tri = [], [], [], [], []
    for side, s in ((1, "l"), (-1, "r")):
        # The back of this hand: across the knuckles crossed with along the
        # middle finger. The sign is settled by the thumb — it sits at lower |y|
        # than the fingers do, the palm faces the thumb, so the dorsum is the
        # side with the larger |y|.
        across_hand = J["%s-finger-2-3" % s] - J["%s-finger-4-3" % s]
        along_hand = J["%s-finger-3-4" % s] - J["%s-finger-3-1" % s]
        dorsal = along_hand.cross(across_hand)
        if dorsal.y * side < 0:
            dorsal = -dorsal
        dorsal.normalize()

        for fi in (1, 2, 3, 4, 5):
            m3 = J["%s-finger-%d-3" % (s, fi)]
            m4 = J["%s-finger-%d-4" % (s, fi)]
            d = m4 - m3
            length = d.length
            if length < 1e-4:
                continue
            axis = d.normalized()
            # The nail normal is the hand's dorsum with any component along the
            # finger taken out. For the four fingers that is a formality; for
            # the thumb it is the whole calculation, since a thumb runs across
            # the hand and its nail is the dorsum rotated most of a right angle.
            n = dorsal - axis * dorsal.dot(axis)
            if n.length < 1e-5:
                continue
            n.normalize()
            # `n × axis` and not `axis × n`: the grid below runs +u then +v, so
            # this is the choice that makes (u × v) come out along +n and the
            # triangles face outwards. The other one builds ten nails that are
            # invisible in the browser and perfectly fine in Blender, which does
            # not cull backfaces.
            across = n.cross(axis)
            r = _finger_radius(src, m3, axis, length)
            hw = NAIL_WIDE * r
            style = NAIL_STYLES[fi - 1]
            b = bindex["thumb" + ("L" if side > 0 else "R")] if fi == 1 \
                else bindex["hand" + ("L" if side > 0 else "R")]

            base = len(pos)
            for i in range(NAIL_ROWS + 1):
                u = i / NAIL_ROWS
                w = hw * _nail_width(u)
                for k in range(NAIL_COLS + 1):
                    vn = -1.0 + 2.0 * k / NAIL_COLS
                    uu = _nail_outline(u, vn)
                    c = m3 + axis * (length
                                     * (NAIL_FROM + (NAIL_TO - NAIL_FROM) * uu))
                    off = w * vn
                    # Height of the finger's own surface at this offset, so the
                    # sheet is a section of the cylinder and not a flat card.
                    h = math.sqrt(max(0.0, r * r - off * off))
                    # Domed: proud in the middle, flush at the rim, so the edges
                    # disappear into the finger instead of showing a lip.
                    lift = NAIL_DOME * (1.0 - vn * vn)
                    pos.append(c + across * off + n * (h + lift))
                    nrm.append((across * off + n * h).normalized())
                    col.append(_flame(_tongue(u, vn * side, style)))
                    bone.append(b)
            for i in range(NAIL_ROWS):
                for k in range(NAIL_COLS):
                    a0 = base + i * (NAIL_COLS + 1) + k
                    b0 = a0 + 1
                    c0 = a0 + (NAIL_COLS + 1)
                    d0 = c0 + 1
                    tri.append((a0, c0, d0))
                    tri.append((a0, d0, b0))
    return pos, nrm, col, bone, tri


# --------------------------------------------------------------------------- #
#  the hip scarf, and a bracelet                                               #
# --------------------------------------------------------------------------- #
#
# Both here for the nails' reason — they are laid on after the decimator, so
# their resolution is chosen rather than survived. For the scarf that is not a
# nicety: the whole point of the thing is that it is a *net*, and a net is a
# pattern, and a pattern needs enough vertices to be a pattern. Run through the
# collapse decimator at 6% a 315-vertex wrap comes out as nineteen vertices and
# a smear.
#
# What it replaces is the `trunks` cutter — one ellipsoid painting one flat blue
# shape across her hips, which is what a swimsuit looks like when it is a colour
# rather than a garment. The cutter is still there but it is now a near-black
# lining that the wrap sits over, sized smaller than the wrap: it exists so that
# nothing shows through the gap between the hem and the top of the fringe, and
# it is never the thing you are looking at.

SCARF_TOP = 0.960         # z of the top edge, on the iliac crest
SCARF_HEM = 0.828         # and of the hem, which is level with the crotch
SCARF_SEG, SCARF_ROWS = 44, 6
SCARF_GAP = 0.004         # how far off the skin it sits
SCARF_DARK = (0.078, 0.073, 0.086)
SCARF_LITE = (0.345, 0.330, 0.365)
FRINGE_N = 2          # tassels per segment of the hem
FRINGE_R = 0.0024
SCARF_CX = 0.015          # the body's axis at hip height, off the pelvis marker


def _profile(mesh, z0, z1, rows, bins, cx, rlim=0.30):
    """The body's silhouette as max radius per (height, angle).

    Measured off the mesh, because a hip is not a cylinder and a wrap that is
    one stands 3 cm off her at the front and cuts into her at the sides. `rlim`
    throws away the arms, which at hip height are 50 cm out and would otherwise
    be the maximum at every angle they cover.
    """
    dz = (z1 - z0) / (rows - 1)
    tau = math.pi * 2.0
    tab = [[0.0] * bins for _ in range(rows)]
    for v in mesh.vertices:
        p = v.co
        if p.z < z0 - dz or p.z > z1 + dz:
            continue
        dx, dy = p.x - cx, p.y
        r = math.hypot(dx, dy)
        if r > rlim:
            continue
        i = max(0, min(rows - 1, int(round((p.z - z0) / dz))))
        b = int((math.atan2(dy, dx) % tau) / tau * bins) % bins
        if r > tab[i][b]:
            tab[i][b] = r
    for row in tab:
        seen = [x for x in row if x > 0]
        fill = sum(seen) / len(seen) if seen else 0.18
        for k in range(bins):
            if row[k] <= 0:
                row[k] = fill
    return tab, z0, dz


def _profile_at(prof, z, ang):
    """Bilinear lookup into `_profile`'s table, wrapping in angle."""
    tab, z0, dz = prof
    rows, bins = len(tab), len(tab[0])
    tau = math.pi * 2.0
    f = max(0.0, min(rows - 1.001, (z - z0) / dz))
    i0 = int(f)
    ti = f - i0
    g = (ang % tau) / tau * bins
    b0 = int(g) % bins
    tb = g - int(g)
    b1 = (b0 + 1) % bins
    lo = tab[i0][b0] * (1 - tb) + tab[i0][b1] * tb
    hi = tab[i0 + 1][b0] * (1 - tb) + tab[i0 + 1][b1] * tb
    return lo * (1 - ti) + hi * ti


def _scarf_hem(a):
    """Where the wrap stops, per angle. Low on her left hip, where it is tied."""
    return SCARF_HEM - 0.032 * max(0.0, math.cos(a - math.pi * 0.5)) ** 2


def _scarf_top(a):
    """And where it starts. Not a level ring — that is the one thing that made
    the first cut read as a stiff band clamped round her rather than as cloth.
    Highest over the two hip bones and 2 cm lower front and back, which is where
    a wrap sits when a person has actually tied one on."""
    return SCARF_TOP - 0.020 * abs(math.cos(a))


def _strand(top, along, length, r, colour, out):
    """One tassel: a three-sided prism, capped at both ends.

    Three sides rather than four because a strand is two millimetres across and
    the difference is invisible, and capped because the material is `FrontSide`
    and an open tube is a hole you can see up.
    """
    pos, nrm, col, tri = out
    up = Vector((0.0, 0.0, 1.0))
    u = along.cross(up)
    if u.length < 1e-5:
        u = Vector((1.0, 0.0, 0.0))
    u.normalize()
    w = along.cross(u).normalized()
    base = len(pos)
    for end in (0, 1):
        c = top + along * (length * end)
        for k in range(3):
            a = math.pi * 2.0 * k / 3.0
            d = u * math.cos(a) + w * math.sin(a)
            pos.append(c + d * r)
            nrm.append(d)
            # The tip of a tassel catches the light; the root is in shadow
            # against the wrap and is the same black as it.
            col.append(colour if end == 0 else
                       tuple(min(1.0, q * 1.9 + 0.06) for q in colour))
    # Same handedness trap as the wrap: (u, w, along) is right-handed, so going
    # round the ring the natural way and down the strand gives inward faces.
    for k in range(3):
        k2 = (k + 1) % 3
        tri.append((base + k, base + 3 + k2, base + 3 + k))
        tri.append((base + k, base + k2, base + 3 + k2))
    tri.append((base + 0, base + 1, base + 2))          # cap at the root
    tri.append((base + 5, base + 4, base + 3))          # and at the tip
    return 6


def hip_scarf(mesh, out):
    """The wrap and its fringe. Everything rigid to the pelvis, which is right:
    a hip scarf is tied to the hips and does not follow a knee."""
    pos, nrm, col, tri = out
    prof = _profile(mesh, 0.80, 0.98, 10, SCARF_SEG, SCARF_CX)
    tau = math.pi * 2.0
    made = 0

    base = len(pos)
    for i in range(SCARF_ROWS + 1):
        rv = i / SCARF_ROWS
        for k in range(SCARF_SEG + 1):
            a = tau * (k % SCARF_SEG) / SCARF_SEG
            top = _scarf_top(a)
            z = top + (_scarf_hem(a) - top) * rv
            # A shade more clearance at the hem than at the waist, so the free
            # edge stands off the thigh instead of sinking into it.
            r = _profile_at(prof, z, a) + SCARF_GAP + 0.004 * rv
            d = Vector((math.cos(a), math.sin(a), 0.0))
            pos.append(Vector((SCARF_CX, 0.0, z)) + d * r)
            nrm.append(d)
            # A checker laid on the *vertices* rather than the faces: every quad
            # then has two light corners and two dark ones on its diagonals, and
            # the interpolation across it turns that into a soft diamond weave.
            # A face checker at this cell size would be a chessboard.
            col.append(SCARF_LITE if (i + k) % 2 == 0 else SCARF_DARK)
    # Wound the other way round from the obvious one. `k` runs anticlockwise
    # seen from above and `i` runs *downwards*, so (along k) x (down) points at
    # the body's axis, not away from it — the natural order builds the wrap
    # inside out. It is not a subtle failure and it does not look like one: the
    # material is `FrontSide`, so every near face is culled and what you see is
    # the inside of the far half of the wrap, which reads as a smudge in roughly
    # the right place and had me looking at the paint underneath for it.
    for i in range(SCARF_ROWS):
        for k in range(SCARF_SEG):
            a0 = base + i * (SCARF_SEG + 1) + k
            tri.append((a0, a0 + SCARF_SEG + 1, a0 + SCARF_SEG + 2))
            tri.append((a0, a0 + SCARF_SEG + 2, a0 + 1))
    made += (SCARF_ROWS + 1) * (SCARF_SEG + 1)

    # The fringe, one strand per segment, longest where the wrap is tied — which
    # is what makes a knot read without modelling one: a knot is a lump you have
    # to get right, and a bundle of tassels twice as long as the rest says the
    # same thing and cannot be got wrong.
    for kk in range(SCARF_SEG * FRINGE_N):
        k = kk / FRINGE_N
        a = tau * k / SCARF_SEG
        z = _scarf_hem(a)
        r = _profile_at(prof, z, a) + SCARF_GAP + 0.004
        d = Vector((math.cos(a), math.sin(a), 0.0))
        top = Vector((SCARF_CX, 0.0, z)) + d * r
        tie = max(0.0, math.cos(a - math.pi * 0.5)) ** 3
        length = 0.046 + 0.070 * tie + 0.013 * math.sin(kk * 2.3)
        # Hanging very slightly outward, because a thigh narrows on the way down
        # and a strand dropped dead vertical from the widest part of a hip ends
        # up inside it.
        along = Vector((d.x * 0.10, d.y * 0.10, -1.0)).normalized()
        made += _strand(top, along, length, FRINGE_R, SCARF_DARK, out)
    return made


def wrist_band(J, mesh, out):
    """One bracelet, on her right wrist. Gold, like the anklets.

    Built about the *forearm* axis rather than the vertical one `ring()` uses.
    Her forearms in the rest pose run forward, outward and down all at once —
    (0.72, 0.52, -0.46) — so a band built about world Z would sit on her wrist
    at a 60° tilt, which is not a bracelet, it is a bracelet caught mid-fall.
    """
    pos, nrm, col, tri = out
    elbow, wrist = J["r-elbow"], J["r-hand"]
    axis = (wrist - elbow).normalized()
    centre = wrist - axis * 0.022          # up the forearm, clear of the joint
    lat = []
    for v in mesh.vertices:
        d = v.co - centre
        if abs(d.dot(axis)) < 0.007 and d.length < 0.070:
            lat.append((d - axis * d.dot(axis)).length)
    lat.sort()
    r = lat[int(len(lat) * 0.82)] if len(lat) > 8 else 0.026
    print("[mh]   wrist band r %.4f from %d verts" % (r, len(lat)))
    up = Vector((0.0, 0.0, 1.0))
    u = axis.cross(up).normalized()
    w = axis.cross(u).normalized()
    seg, ring_seg, wire = 20, 6, 0.0032
    tau = math.pi * 2.0
    base = len(pos)
    for i in range(seg):
        a = tau * i / seg
        d = u * math.cos(a) + w * math.sin(a)
        c = centre + d * r
        for k in range(ring_seg):
            b = tau * k / ring_seg
            n = (d * math.cos(b) + axis * math.sin(b)).normalized()
            pos.append(c + n * wire)
            nrm.append(n)
            col.append(ANKLET_P)
    for i in range(seg):
        i2 = (i + 1) % seg
        for k in range(ring_seg):
            k2 = (k + 1) % ring_seg
            a0 = base + i * ring_seg + k
            b0 = base + i * ring_seg + k2
            c0 = base + i2 * ring_seg + k
            d0 = base + i2 * ring_seg + k2
            tri.append((a0, c0, d0))
            tri.append((a0, d0, b0))
    return seg * ring_seg


# Height of the centre. 0.845 was the first try and it sat about four
# centimetres below where the cleft closes, which from behind reads as a mark on
# the perineum rather than as the bottom of the crevice — a speck floating on
# open skin. This is up in the valley, where the cheeks still have it between
# them, so most angles occlude it and the ones that do not show it recessed and
# in shadow. That is also the anatomy: on a standing figure seen square from
# behind this is mostly *not* visible, and a version of it that always is would
# be the wrong fix for the complaint.
ANUS_Z = 0.857
ANUS_R = 0.0094           # and its radius: a 19 mm disc
ANUS_SINK = 0.0036        # how far the middle is drawn in behind the rim
ANUS_LIFT = 0.0008        # and how far the rim stands off the skin
ANUS_SEG = 14


def perineum(mesh, out):
    """The one feature on this figure that paint could not have done.

    Everything else small and dark on her is a cutter — the areolae, the irises,
    the mouth, the pubic hair — because a colour per vertex costs nothing and
    the decimator's blurring is usually either harmless or, for hair, actually
    wanted. That argument runs out here, and it runs out on a measurement rather
    than on taste: a 19 mm disc at the bottom of the gluteal cleft contains
    **three to eight vertices of the full 218 000-vertex body**, and the export
    decimates by about eight. So the honest range is nought to one vertex, and
    one vertex of paint on this mesh is not a small dark spot, it is a faint
    brown cloud several centimetres across. The lower abdomen was already
    fifteen times coarser than the chest and this is the floor of a crevice
    inside it, which is the coarsest place on her.

    So it is geometry, laid on after the decimator with the nails and the wrap,
    and it is the mechanism the pubic hair's note named as the escalation.

    A shallow dished disc: a rim on the skin and a centre drawn in behind it, so
    the thing has a silhouette and shades itself rather than being a decal. It
    is nine millimetres of relief on a 1.75 m figure, which is nothing — but it
    is *nothing in the right shape*, and the crevice it sits in is the darkest
    place on her anyway, so it needs to be modelled far less than it needs to
    simply be there.

    Where and which way it faces are both measured, not typed. The cleft floor
    is the midline vertex least far back at a given height — the buttocks are
    further out, so the valley is the maximum x of a negative-x band — and the
    facing comes from how that floor moves over a centimetre and a half of
    height. It comes out about 50° below horizontal, backward and down, which is
    what the perineum does. Typing that number would have been typing a guess,
    and it would have gone stale the first time anybody touched the body.
    """
    pos, nrm, col, tri = out
    base = len(pos)

    def floor_at(z):
        band = [v.co for v in mesh.vertices
                if abs(v.co.z - z) < 0.006 and abs(v.co.y) < 0.010 and v.co.x < 0.0]
        return max(v.x for v in band) if band else None

    lo, mid, hi = floor_at(ANUS_Z - 0.008), floor_at(ANUS_Z), floor_at(ANUS_Z + 0.008)
    if mid is None or lo is None or hi is None:
        print("[mh]   perineum: no cleft floor at z %.3f — skipped" % ANUS_Z)
        return 0

    # The surface tangent in the midline plane, and the outward normal from it.
    # Outward is the one pointing away from her, which is the −x of the two.
    tx, tz = hi - lo, 0.016
    tl = math.hypot(tx, tz)
    n = Vector((-tz / tl, 0.0, tx / tl))
    if n.x > 0:
        n = -n
    # Two axes across the disc: one straight across her (y), one up the slope.
    u = Vector((0.0, 1.0, 0.0))
    w = n.cross(u).normalized()
    centre = Vector((mid, 0.0, ANUS_Z)) + n * ANUS_LIFT

    pos.append(centre - n * ANUS_SINK)
    nrm.append(n)
    col.append(ANUS_P)
    for k in range(ANUS_SEG):
        a = 2.0 * math.pi * k / ANUS_SEG
        d = u * math.cos(a) + w * math.sin(a)
        pos.append(centre + d * ANUS_R)
        # Splayed outward from the axis, so the rim catches light as an edge
        # rather than reading as a flat disc lying in a hole.
        nrm.append((n * 0.55 + d * 0.83).normalized())
        col.append(ANUS_P)
    for k in range(ANUS_SEG):
        tri.append((base, base + 1 + k, base + 1 + (k + 1) % ANUS_SEG))
    print("[mh]   perineum r %.4f at x %.4f z %.3f, facing %.0f deg below level"
          % (ANUS_R, mid, ANUS_Z, math.degrees(math.atan2(-n.z, -n.x))))
    return ANUS_SEG + 1


def post_geometry(J, src, mesh, bindex):
    """Everything laid on after the decimator: ten nails, a bracelet, a wrap.

    `src` is the decimated mesh — used only to measure a fingertip, where the
    two differ by nothing that matters — and `mesh` is the full one, used where
    a silhouette has to be traced properly.

    Returns one extra number: how many of the triangles at the **tail** are the
    wrap. The order here is therefore load-bearing rather than cosmetic — the
    wrap goes last so that the thing she can take off is one contiguous run at
    the end of the index buffer, and hiding it in the browser is a draw range
    ending early rather than a second draw call, a second material or a flag
    tested per fragment. She sheds it when she catches fire; see `export_skin`
    for how the number travels and src/43-jadrija.js for who asks.
    """
    pos, nrm, col, bone, tri = [], [], [], [], []
    npos, nnrm, ncol, nbone, ntri = nail_patches(J, src, bindex)
    pos += npos
    nrm += nnrm
    col += ncol
    bone += nbone
    tri += ntri

    out = (pos, nrm, col, tri)
    n = wrist_band(J, mesh, out)
    bone += [bindex["armLR"]] * n
    # On the pelvis, like the wrap, and for a better reason than the wrap has:
    # this sits between two masses that are driven by the *legs*, so binding it
    # to either thigh would swing it out from between them the first time she
    # took a step. The pelvis is the one bone it can belong to that keeps it in
    # the middle of the thing it is in the middle of.
    n = perineum(mesh, out)
    bone += [bindex["pelvis"]] * n
    kept = len(tri)
    n = hip_scarf(mesh, out)
    bone += [bindex["pelvis"]] * n
    return pos, nrm, col, bone, tri, len(tri) - kept


def post_preview(J, body):
    """The nails as a real object in the scene, so a render can show them.

    Nothing exports this. It exists because the shipped nails are built inside
    `export_skin`, straight into the output buffers, and are therefore invisible
    to every camera in this file — which would leave the only way to look at a
    flame being a full Blender run, a page build and a headless browser. It is
    the same `nail_patches` call the exporter makes, so what this renders is
    what ships, and it is rebuilt from scratch each time rather than updated.
    """
    old = bpy.data.objects.get("nails")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    zero = {n: 0 for n in ("handL", "handR", "thumbL", "thumbR",
                           "pelvis", "armLL", "armLR")}
    pos, nrm, col, _bone, tri, _shed = post_geometry(J, body.data, body.data, zero)
    me = bpy.data.meshes.new("nails")
    me.from_pydata([tuple(p) for p in pos], [], [list(t) for t in tri])
    me.validate()
    a_p = me.color_attributes.new("prev", "FLOAT_COLOR", "POINT")
    a_m = me.color_attributes.new("mark", "FLOAT_COLOR", "POINT")
    for i, c in enumerate(col):
        a_p.data[i].color = (*c, 1.0)
        a_m.data[i].color = (*c, 1.0)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("nails", me)
    bpy.context.collection.objects.link(ob)
    if body.data.materials:
        ob.data.materials.append(body.data.materials[0])
    return ob


def export_skin(body, rig, path, clips, tris=26000, J=None, post=True,
                repaint=None, dense=None):
    """Write the figure as a .fr3d **v4** blob: mesh, skeleton and clips.

    v1 froze the armature into the vertices, which is why the promenade got a
    statue. This carries the four bone influences per vertex that `skin()`
    already caps the weights to, the rest skeleton, and every clip baked to
    quaternions — and from there the browser can put her in any pose the rig can
    reach, for about the same number of bytes as the one pose cost.

    The cartwheel's floor pass runs here rather than at any of the four call
    sites above it, because this is the one gate everything that ships goes
    through, and a clip that has not had it is a clip with a foot in the
    concrete. It is idempotent, and cheap next to the decimator below.

    The mesh is exported in the **bind** pose, so the rig has to be at rest when
    this runs or every vertex is deformed twice.

    `repaint` is the same list of coats `paint` takes, applied again to the
    decimated copy on its way out, and `dense` is the subset of them whose hems
    the decimator has to be told to leave alone. Together they are what a figure
    whose paint is finer than its mesh needs; see the notes at the decimator and
    at `hem_group`, and for why neither is simply always on.
    """
    rest = _rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}

    wheel_floor(rig)
    dance_floor(rig)
    skip_floor(rig)
    walk_floor(rig)
    fire_floor(rig)

    # Duplicate the *object*, not the evaluated mesh.
    #
    # `new_from_object` is what export_static uses and it is right for a frozen
    # pose, but it returns bare mesh data and the bone weights do not survive the
    # trip — the first run of this exporter wrote thirteen thousand vertices with
    # no influence at all, which in the browser is a figure collapsed to a point
    # at the origin. An object duplicate carries `vertex_groups` with it, and
    # since smooth() already applied the subsurf the only modifier left on the
    # body is the armature, so the duplicate's mesh data *is* the bind shape.
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    holder = bpy.context.view_layer.objects.active
    holder.name = "export_tmp"
    for m in list(holder.modifiers):
        holder.modifiers.remove(m)
    gname = {i: g.name for i, g in enumerate(holder.vertex_groups)}
    have = sum(len(p.vertices) - 2 for p in holder.data.polygons)
    if have > tris:
        d = holder.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = tris / have
        # Spend the triangles where the paint is finer than the mesh. See
        # `hem_group`, and the note below for why a repainted figure needs this
        # as well as the repaint and not instead of it.
        if dense:
            d.vertex_group = hem_group(holder, dense)
            # Inverted, because a *zero* weight is what the collapse reads as
            # "leave this one alone" — a group of ones protects nothing and a
            # group of ones with everything else at zero, which was the first
            # try, protects the entire rest of the figure and decimates nothing
            # at all: 351 452 triangles came out of a 7 000 budget.
            d.invert_vertex_group = True
        bpy.ops.object.modifier_apply(modifier="dec")
    # And then, on the figures that ask for it, painted again — on *this* mesh.
    #
    # The decimator interpolates every attribute it carries, colour included: a
    # vertex that survives a collapse comes out holding the average of the ones
    # that went into it. So a boundary that was one vertex wide before the
    # decimator arrives two or three vertices deep after it, and what ships is
    # not an edge but a ramp. Measured on the eight bathers, that ramp is 25 to
    # 80 mm on every side of every painted edge and about 50 in the middle of
    # that, whatever the edge is — it is a property of the mesh and not of the
    # paint, and it does not shrink when the garment does.
    #
    # Which is survivable on something big and fatal on something small. The
    # men's trunks are 160 to 190 mm of solid colour and read as trunks; the
    # women's brief is 110 mm as authored and arrives as 72 mm of solid red
    # inside 182 mm of pink, so two thirds of the garment is ramp — and what
    # you see from behind is a red smear across the buttocks with a run of it
    # 136 mm down the thigh. There is no fix for that on the paint side,
    # because the only lever there is to make the garment bigger than its own
    # ramp, and a brief is not 200 mm tall.
    #
    # So paint it after the decimator instead of before. Every vertex then
    # comes out exactly the colour its cutter gave it, the ramp collapses to
    # the single triangle that straddles the hem — which is what a soft edge
    # actually is — and the garment is as tall as it was drawn. It costs one
    # more pass of the same ray-parity test over a quarter of the vertices, and
    # it is off by default: with `repaint=None` this is the function it was, and
    # Baye's blob comes out byte-for-byte what it was.
    #
    # That alone is not the whole fix, and it is worth saying why, because the
    # numbers say it plainly. Repainting takes the brief from 72 mm of solid
    # colour inside 182 mm of pink to 103 mm of solid colour and no pink at all
    # — but the triangles the hem now runs across are still 50 mm at the median
    # and 198 at the worst, so the *edge* is still a hand's breadth of ramp and
    # still hangs a red streak 179 mm down the back of the thigh. `dense` is the
    # other half: it stops the decimator collapsing the hem itself. With both,
    # the triangles under the hem are 16 mm and the streak is 33.
    if repaint:
        paint(holder, repaint)
    src = holder.data
    src.calc_loop_triangles()
    try:
        src.calc_normals_split()
    except (AttributeError, RuntimeError):
        pass
    col = src.color_attributes.get("prev")

    def weights(vi):
        """Four (bone, weight) pairs as bytes summing to exactly 255.

        Exactly, not approximately: the shader adds four bone matrices scaled by
        these and does not renormalise, so a vertex whose weights come to 0.99
        is a vertex that shrinks towards the origin of the world every frame.
        """
        gs = [(g.weight, bindex[gname[g.group]])
              for g in src.vertices[vi].groups
              if g.group in gname and gname[g.group] in bindex and g.weight > 0]
        if not gs:
            return (0, 0, 0, 0), (255, 0, 0, 0)
        gs.sort(reverse=True)
        gs = gs[:MAX_INFLUENCES]
        tot = sum(w for w, _ in gs)
        q = [max(0, min(255, int(round(w / tot * 255)))) for w, _ in gs]
        q[0] += 255 - sum(q)
        idx = [b for _, b in gs] + [0] * (MAX_INFLUENCES - len(gs))
        q += [0] * (MAX_INFLUENCES - len(q))
        return tuple(idx), tuple(q)

    pos, nrm, cols, bidx, bwgt, idx, lookup = [], [], [], [], [], [], {}
    wcache, orphans = {}, 0
    for tri in src.loop_triangles:
        for li in tri.loops:
            vi = src.loops[li].vertex_index
            v = src.vertices[vi]
            n = src.loops[li].normal if src.loops[li].normal.length else v.normal
            c = col.data[vi].color if col else (1.0, 1.0, 1.0, 1.0)
            c8 = tuple(min(255, max(0, int(x * 255 + 0.5))) for x in c[:3])
            if vi not in wcache:
                wcache[vi] = weights(vi)
                if not src.vertices[vi].groups:
                    orphans += 1
            wi, ww = wcache[vi]
            co = (v.co.x, v.co.z, -v.co.y)
            nv3 = (n.x, n.z, -n.y)
            # The weights go in the dedupe key as well as the geometry. Two
            # vertices that agree on position, normal and colour but not on
            # which bone owns them are two vertices, and merging them welds a
            # seam shut across a joint.
            key = (round(co[0], 5), round(co[1], 5), round(co[2], 5),
                   round(nv3[0], 3), round(nv3[1], 3), round(nv3[2], 3), c8, wi, ww)
            j = lookup.get(key)
            if j is None:
                j = len(pos) // 3
                lookup[key] = j
                pos.extend(co)
                nrm.extend(nv3)
                cols.extend(c8)
                bidx.extend(wi)
                bwgt.extend(ww)
            idx.append(j)

    # ── the nails ──────────────────────────────────────────────────────────
    # Appended straight to the buffers rather than joined to the mesh, because
    # the mesh above has already been through the decimator and joining into it
    # would mean either running the decimator again or teaching Blender's join
    # about colour attributes and vertex groups it does not need to know about.
    # These carry one bone at full weight, which is not an approximation: there
    # are no finger bones, so a fingertip is rigid to its hand in every clip
    # this figure has.
    #
    # `post=False` skips the lot, and exists because `J=None` is not the same
    # question. This used to fall back to *her* joints off the neutral base and
    # lay her nails, her bracelet and her wrap on whatever figure it was given,
    # positioned by a skeleton that was not that figure's — so the eight
    # bathers in tools/blender/bathers_mh.py came out wearing the same striped
    # sarong, children and old men included, hung off somebody else's hips.
    npos = nnrm = ncol = nbone = ntri = ()
    nshed = 0
    if post:
        if J is None:
            J, _js, _jd = read_joints(fetch())
        npos, nnrm, ncol, nbone, ntri, nshed = post_geometry(
            J, src, body.data, bindex)
    lay0 = len(pos) // 3
    for k in range(len(npos)):
        p, nv, c = npos[k], nnrm[k], ncol[k]
        pos.extend((p.x, p.z, -p.y))
        nrm.extend((nv.x, nv.z, -nv.y))
        cols.extend(min(255, max(0, int(x * 255 + 0.5))) for x in c)
        bidx.extend((nbone[k], 0, 0, 0))
        bwgt.extend((255, 0, 0, 0))
    for t in ntri:
        idx.extend(lay0 + q for q in t)
    print("[mh]   laid on %d verts %d tris (nails, band, perineum, wrap) — wrap is %d"
          % (len(npos), len(ntri), nshed))

    baked = [_bake_clip(rest, c) for c in clips]

    import gzip
    import struct
    nv, ni = len(pos) // 3, len(idx)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    # v4 adds one number to the header: how many indices at the end of the
    # buffer are the wrap. Everything else is byte-for-byte v3. It is a header
    # field rather than a table of named parts because there is exactly one
    # removable thing on this figure and a general mechanism for it would be
    # more format than the feature deserves — if a second garment ever wants
    # taking off, *that* is when this becomes a table, and the version number
    # is here so that day is a clean break rather than a guess.
    parts = [struct.pack("<4sIII6fI", b"FR3D", 4, nv, ni,
                         min(xs), min(ys), min(zs), max(xs), max(ys), max(zs),
                         nshed * 3),
             struct.pack("<%df" % (nv * 3), *pos),
             struct.pack("<%df" % (nv * 3), *nrm),
             bytes(cols), bytes(bidx), bytes(bwgt)]
    # Pad so the index array lands 4-byte aligned and the loader can take a
    # view on it rather than copying half a megabyte.
    pad = (-sum(len(p) for p in parts)) % 4
    parts.append(b"\0" * pad)
    parts.append(struct.pack("<%dI" % ni, *idx))

    parts.append(struct.pack("<I", len(rest)))
    for name, parent, _local_b, local_g in rest:
        nb = name.encode()
        t = local_g.translation
        q = local_g.to_quaternion()
        parts.append(struct.pack("<H%dsi7f" % len(nb), len(nb), nb, parent,
                                 t.x, t.y, t.z, q.x, q.y, q.z, q.w))

    parts.append(struct.pack("<I", len(baked)))
    for c in baked:
        nb = c["name"].encode()
        parts.append(struct.pack("<H%dsfIB3x" % len(nb), len(nb), nb,
                                 c["dur"], len(c["frames"]), 1 if c["loop"] else 0))
        for rt, quats in c["frames"]:
            parts.append(struct.pack("<3f", *rt))
            for q in quats:
                parts.append(struct.pack("<4h", *q))

    blob = b"".join(parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(blob)
    print("[mh] skin %s  %d verts  %d tris  %d bones  %d clips  %d bytes gz"
          % (path.name, nv, ni // 3, len(rest), len(baked), path.stat().st_size))
    for c in baked:
        print("[mh]   clip %-9s %5.2f s  %3d frames  %s"
              % (c["name"], c["dur"], len(c["frames"]),
                 "loop" if c["loop"] else "once"))
    if orphans:
        print("[mh]   WARNING %d vertices had no bone weight at all" % orphans)

    bpy.data.objects.remove(holder, do_unlink=True)


# --------------------------------------------------------------------------- #
#  posing and previews                                                         #
# --------------------------------------------------------------------------- #

def pose(rig, spec):
    """`spec` is {bone: (rx, ry, rz)} in degrees, bone-local XYZ Euler.

    With the rolls named, +X swings a limb's far end backward on every bone and
    the two sides mirror in sign.
    """
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for b in rig.pose.bones:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
    for name, rot in spec.items():
        if name in rig.pose.bones:
            rig.pose.bones[name].rotation_euler = \
                tuple(math.radians(a) for a in rot)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


STRIDE = {
    "spine01": (-3, -5, 0), "spine02": (-2, -4, 0), "spine03": (-1, -3, 0),
    "chest": (-1, -3, 0), "neck": (2, 7, 0), "head": (1, 10, 0),
    "armUL": (-30, 0, 20), "armLL": (-34, 0, 0), "handL": (-8, 0, 0),
    "armUR": (26, 0, -20), "armLR": (-18, 0, 0), "handR": (6, 0, 0),
    "legUR": (-26, 0, 0), "legLR": (6, 0, 0), "footR": (12, 0, 0),
    "legUL": (17, 0, 0), "legLL": (38, 0, 0), "footL": (-22, 0, 0),
    "toeL": (22, 0, 0),
}

# --------------------------------------------------------------------------- #
#  clips                                                                       #
# --------------------------------------------------------------------------- #
#
# A pose is `{bone: (rx, ry, rz)}` in degrees, plus an optional `@root` offset in
# metres. A clip is a list of (time, pose) keys, sampled at SAMPLE_FPS on export.
#
# Signs, once, so none of this has to be re-derived: with the rolls named in
# ROLL_UP, **+X swings a limb's far end backward** on every up-or-down bone, and
# the two sides mirror in sign on Y and Z. +Z on the pelvis lifts her right hip.
#
# Nothing here is a walk cycle yet. This is the pipeline's proof: if she stands
# on the promenade breathing, shifting her weight and looking around, then the
# rig, the weights, the quaternion bake and the shader all agree with each other,
# and every clip after this one is content rather than engineering.

# ── the six numbers a standing figure needs, which are not the walk's six ──── #
#
# Same fault, third time, and this is the file it has always been in. The base
# mesh is an A-pose, the A-pose is the widest attitude a body has, and every
# clip is only ever the correction on top of it. The walk was fixed for this on
# 22 Aug and the eight bathers' `idle` an hour later, in bathers_mh.py, because
# this file was off limits that afternoon. It is not any more, so the numbers
# live here, in the two poses, where every clip built on them picks them up.
#
# What was wrong, measured on the posed rig rather than eyeballed. `IDLE_A`
# corrected the ARMS — 29° of adduction a side, put there the last time
# somebody complained about arms — and corrected the LEGS by nothing at all, so
# the rest thigh's 6.5° of splay and the rest shin's 9.3° stood in every idle
# frame of the twenty-four clips. Before: **ankles 0.458 m apart, knees 0.333,
# wrists 0.488, elbows 0.441**, each hand 7 cm outboard of its own shoulder and
# 21 cm in front of it, elbows bent 60° and 57°. A person standing at ease has
# their ankles 10 to 15 cm apart and their hands hanging just outside their
# thighs. Forty-six centimetres of ankle is not a stance, it is a shop dummy.
#
# After: **ankles 0.109, knees 0.163, wrists 0.408, elbows 0.408**, hands 2.6
# and 3.0 cm outboard of their own shoulders and 8.5 and 5.8 in front, elbows
# bent 16° and 13°, soles 2.3° off flat.
#
# Axes, since the `--probe` docstring below has them backwards and cost an
# hour: in this armature **+Y is her left-right axis and +X is in front of
# her**. Every separation quoted above is |Δy| between two joint centres.

# The hip, and the number the bathers' pass explicitly warned would not
# transfer — so it was solved again here, and it came out at the walk's 11 and
# not at their 6.5.
#
# The curve of ankle separation against hip adduction has a minimum in it,
# because past the crossing the two ankles are on each other's side of the
# midline and the distance grows again. Read a target off it without looking at
# both sides and you land on the wrong side of the minimum. **Baye's crossing
# is at 14.8°** — 0.022 m at 14, 0.001 at 14.8, back up to 0.036 at 16 — where
# the 1.72 m bather's, measured on her own skeleton the same way, is at
# **10.0**: 0.003 m there, and 0.026 at eleven with her ankles crossed. Nearly
# five degrees of skeleton is the whole difference between the two files, and
# it is why this is measured per rig and never copied. Eleven is the answer
# here and it is the wrong answer there, and both are the same sentence about
# hip width over leg length.
#
# Eleven puts her ankles 0.109 m apart with her knees 0.163 — knees a little
# wider than ankles, which is the shape of a real stance — and it is 3.8° short
# of her own crossing, with the ankle curve running 0.0293 m per degree there,
# so a degree of drift either way is under 3 cm and nothing crosses. It is also
# `WALK_TRACK` to the decimal, which is worth having for free: `go` in
# 43-jadrija.js crossfades one clip into the next over 0.30 s by default, and
# two clips that agree about where a hip is have nothing lateral to move
# through it. She has walked out of a stand and stood out of a walk in front of
# you all afternoon; now the hips do not step sideways while she does.
STAND_TRACK = 11.0
# The shin, doing what `WALK_SHANK` does and for the same reason: the base
# mesh's tibia flares outward, the knee inherits the hip's adduction, and this
# only has to take the last couple of degrees off. Worth 1.4 cm of ankle a
# degree — 0.137 at nothing, 0.109 at two.
STAND_SHANK = 2.0
# And the sole, which gives back the roll the two above cost. Thirteen degrees
# of hip and knee rolls the foot thirteen degrees, and a foot rolled thirteen
# degrees is a woman standing on the insides of her feet.
#
# Twelve and not the walk's thirteen, and it is not a free choice: her idle is
# a contrapposto, so the two feet do not start level and the SUM of the two
# rolls is fixed at about -5° whatever this is set to. All this can do is share
# it out. Twelve is where the two are equal, 2.3° off flat each; the walk's 13
# gives 3.5 and 1.1, and the bathers' 8.5 gives 1.6 and 6.5.
STAND_SOLE = 12.0
# The shoulder. Twenty-nine was this pose's own and it is nearly right; at 33
# the humerus hangs 6.5° out from vertical, which is where a relaxed standing
# arm hangs, and a shade wider than the walk's 34 — a swinging arm is tucked
# in a little, a hanging one is not. Not 35: that is the humerus at 4.5° and
# the wrist inside the outline of the thigh, and the hands go into the wrap.
STAND_ARM_IN = 33.0
# The forearm. Four degrees of it was nothing — the rest forearm leaves the
# elbow pointing out as well as forward, so the hands bowed out round the hips
# and each wrist sat 7 cm outboard of its own shoulder. Eighteen brings the
# wrists to 0.408 m apart, which on her is 1.6 to 2.1 cm outboard of the
# surface of the thigh beside them: hands hanging just outside the thighs, with
# the hand's own width taking up the rest of it. Not 22 — that is the wrist
# joint 2 mm outside the thigh, and 2 mm is inside the hand.
STAND_FORE_IN = 18.0
# And the elbow, which is `_walk_elbow`'s hard-won note again: on this bone a
# more negative X does not fold the elbow, it swings the hand further FORWARD,
# and the rest forearm is already 46° bent forward-and-out. The two idle keys
# carry -14 and -11 there, which ADDS to the A-pose instead of undoing it, and
# is why her hands sat 21 cm in front of her shoulders with 60° in the elbow.
#
# Added to what each key authored rather than replacing it, so the three
# degrees of arm swing between the two keys survives. Forty-four, not the
# bathers' forty: forty on her leaves 20° and 17° in the elbows and the hands
# 10 and 7 cm forward, forty-four lands 16° and 13° with 8.5 and 5.8 — which is
# where the bathers' forty landed *them*. The right number is the result, not
# the constant.
STAND_ELBOW_UNDO = 44.0

# Relaxed stand, weight on the left leg. A figure with both knees locked and both
# arms straight down reads as a mannequin no matter how good the mesh is; the
# whole difference is a couple of degrees of contrapposto.
#
# The arms are the part that has to be *large*. The MakeHuman base stands in an
# A-pose with the upper arms 40° out from the body, so a couple of degrees of
# idle offset leaves a figure holding her arms out like a scarecrow — which is
# what the first pass shipped, and it read as a mannequin however much the ribs
# were breathing. Sign: on the right arm +Z abducts, and the two sides mirror.
#
# Every lateral term below is one of the six constants above. What is written
# out longhand is the sagittal half — the contrapposto, the breath, the head
# turn — and that is deliberate: those are the pose, and the six are only the
# A-pose being taken out from under it.
IDLE_A = {
    "@root": (0.000, 0.020, -0.006),
    "pelvis": (0, 0, -2.5),
    "spine01": (0, 0, 1.0), "spine02": (0, 0, 1.0), "spine03": (-1, 0, 0.5),
    "chest": (-1.5, 0, 0), "neck": (2, 0, 0), "head": (-1, -3, 1),
    "armUL": (-6, 0, STAND_ARM_IN),
    "armLL": (-14 + STAND_ELBOW_UNDO, 0, STAND_FORE_IN), "handL": (-4, 0, 0),
    "armUR": (-4, 0, -STAND_ARM_IN),
    "armLR": (-11 + STAND_ELBOW_UNDO, 0, -STAND_FORE_IN), "handR": (-4, 0, 0),
    "legUL": (0, 0, STAND_TRACK), "legLL": (1, 0, STAND_SHANK),
    "footL": (0, STAND_SOLE, 0),
    "legUR": (-4, 3, -STAND_TRACK), "legLR": (7, 0, -STAND_SHANK),
    "footR": (-3, -STAND_SOLE, 0),
}

# Same stance, breath in, head come round the other way.
#
# The two degrees the shoulders open on the breath are kept as two degrees off
# `STAND_ARM_IN` rather than flattened to it — that swing is 3 cm at the wrist
# over the 2.3 s between the keys, and it is most of what stops the loop
# reading as a held photograph. Correcting the pose rather than rewriting it at
# bake time is what makes keeping it possible.
IDLE_B = {
    "@root": (0.004, 0.014, 0.000),
    "pelvis": (0, 0, -1.5),
    "spine01": (0, 0, 0.5), "spine02": (0, 0, 0.5), "spine03": (-2, 0, 0),
    "chest": (-3.0, 0, 0), "neck": (3, 0, 0), "head": (-2, 4, -1),
    "armUL": (-3, 0, STAND_ARM_IN - 2),
    "armLL": (-11 + STAND_ELBOW_UNDO, 0, STAND_FORE_IN), "handL": (-3, 0, 0),
    "armUR": (-1, 0, -(STAND_ARM_IN - 2)),
    "armLR": (-8 + STAND_ELBOW_UNDO, 0, -STAND_FORE_IN), "handR": (-3, 0, 0),
    "legUL": (0, 0, STAND_TRACK), "legLL": (0, 0, STAND_SHANK),
    "footL": (0, STAND_SOLE, 0),
    "legUR": (-3, 3, -STAND_TRACK), "legLR": (6, 0, -STAND_SHANK),
    "footR": (-3, -STAND_SOLE, 0),
}

# Right arm up. Big angles, on purpose: this one exists so that a single
# screenshot from a kilometre away settles whether the bones reach the browser.
WAVE_UP = dict(IDLE_A, **{
    "clavicleR": (0, 0, -12),
    "armUR": (-16, 0, 96), "armLR": (-28, 34, 0), "handR": (0, 0, -14),
    "chest": (-2, -5, 0), "head": (-2, -8, 2),
})
WAVE_OUT = dict(WAVE_UP, **{"armLR": (-24, 34, 30), "handR": (0, 0, 12)})

# She notices you. Head up and round, a breath in, shoulders back — the whole
# thing is three quarters of a second and it is what turns a figure standing on
# the promenade into somebody who has seen you coming.
#
# The four arm keys are the idle's plus the offsets she takes as she notices
# you — four more degrees at the shoulder, twelve more at the elbow — and they
# are written that way rather than as absolutes because they were absolutes
# before and that is how this pose kept the A-pose after the idle had lost it.
NOTICE = dict(IDLE_A, **{
    "@root": (0.000, 0.026, 0.010),
    "spine03": (-4, 0, 0.5), "chest": (-6, 0, 0), "neck": (7, 0, 0),
    "head": (4, 16, 1),
    "clavicleL": (0, 0, 5), "clavicleR": (0, 0, -5),
    "armUL": (-14, 0, STAND_ARM_IN + 4),
    "armLL": (-26 + STAND_ELBOW_UNDO, 0, STAND_FORE_IN),
    "armUR": (-12, 0, -(STAND_ARM_IN + 4)),
    "armLR": (-23 + STAND_ELBOW_UNDO, 0, -STAND_FORE_IN),
})

# ── on all fours ────────────────────────────────────────────────────────────
#
# Every limb hangs off the pelvis, so tipping the torso down to put the
# shoulders over the hands takes the thighs and the upper arms with it, and the
# first thing that has to happen at every hip and every shoulder is to undo the
# pelvis before the real joint angle is applied. Pose this the obvious way — drop
# the torso, then bend the knees — and you get a diver, not a crawler.
#
# The cancellation takes the *same* sign as the pelvis, which looks wrong and is
# not, and cost a render to find out. ROLL_UP names local Z as world −X on every
# up-or-down bone, so local Y is the bone's own direction and local X falls out
# as Y × Z: the pelvis points up and gets local X = −Y_world, while a thigh or an
# upper arm points down and gets local X = **+Y_world**. The two are opposite
# axes. So a pelvis rotation of `a` and a hip rotation of `b` compose in the
# world as `b − a`, and the thigh's forward angle is `a − b` — zero when b = a,
# not when b = −a. Posed with the sign the intuition wants, she folds into a bow:
# torso face-down, and all four limbs sticking up off her back.
#
# With that fixed the geometry is arithmetic. Hip and shoulder both want to be
# about 0.51 m up with the torso horizontal between them, the thigh is 0.45 m and
# the arm 0.52 m, so the pelvis tips until the spine is level (96° less the 6°
# the back arches), the hips and shoulders take −96 to hang the limbs straight
# down, and the knees fold 90° to lay the shins along the floor.
DOWN = 96

FOURS = {
    "@root": (0.0, 0.0, -0.44),
    "pelvis": (-DOWN, 0, 0),
    "spine01": (2, 0, 0), "spine02": (2, 0, 0), "spine03": (1, 0, 0),
    "chest": (1, 0, 0), "neck": (24, 0, 0), "head": (24, 0, 0),
    "clavicleL": (0, 0, 8), "clavicleR": (0, 0, -8),
    "armUL": (-DOWN, 0, 22), "armLL": (-6, 0, 2), "handL": (-70, 0, 0),
    "armUR": (-DOWN, 0, -22), "armLR": (-6, 0, -2), "handR": (-70, 0, 0),
    "legUL": (-DOWN, 0, 5), "legLL": (90, 0, 0), "footL": (-14, 0, 0),
    "legUR": (-DOWN, 0, -5), "legLR": (90, 0, 0), "footR": (-14, 0, 0),
}


def _fours(**kw):
    p = dict(FOURS)
    p.update(kw)
    return p


# A diagonal gait — near-fore with off-hind, which is what every quadruped and
# every crawling child does, and the reason it does not fall over.
CRAWL_A = _fours(
    pelvis=(-DOWN, 0, -6), spine01=(2, 0, 4), chest=(1, 0, 5), head=(24, -12, 0),
    armUL=(-DOWN - 30, 0, 20), armLL=(-24, 0, 2), handL=(-42, 0, 0),
    armUR=(-DOWN + 12, 0, -24), armLR=(-4, 0, -2),
    legUR=(-DOWN - 22, 0, -8), legLR=(72, 0, 0),
    legUL=(-DOWN + 20, 0, 4), legLL=(102, 0, 0),
)
CRAWL_B = _fours(
    pelvis=(-DOWN, 0, 6), spine01=(2, 0, -4), chest=(1, 0, -5), head=(24, 12, 0),
    armUR=(-DOWN - 30, 0, -20), armLR=(-24, 0, -2), handR=(-42, 0, 0),
    armUL=(-DOWN + 12, 0, 24), armLL=(-4, 0, 2),
    legUL=(-DOWN - 22, 0, 8), legLL=(72, 0, 0),
    legUR=(-DOWN + 20, 0, -4), legLR=(102, 0, 0),
)

# Up on the knees, hands off the floor. Kneeling is thighs vertical and shins
# folded back along the ground, so the hips come back to *rest* — the thigh
# already points straight down — and the whole angle is at the knee.
KNEEL = {
    "@root": (0.0, -0.02, -0.45),
    "pelvis": (-8, 0, 0),
    "spine01": (2, 0, 0), "spine02": (2, 0, 0), "spine03": (0, 0, 0),
    "chest": (-3, 0, 0), "neck": (3, 0, 0), "head": (-2, 0, 0),
    "armUL": (-20, 0, 34), "armLL": (-46, 0, 6), "handL": (-6, 0, 0),
    "armUR": (-20, 0, -34), "armLR": (-46, 0, -6), "handR": (-6, 0, 0),
    "legUL": (-8, 0, 5), "legLL": (82, 0, 0), "footL": (-16, 0, 0),
    "legUR": (-8, 0, -5), "legLR": (82, 0, 0), "footR": (-16, 0, 0),
}

# One foot planted ahead, the other knee still down: the half-kneel everybody
# actually passes through on the way up off the floor.
LUNGE = {
    "@root": (0.0, -0.06, -0.33),
    "pelvis": (-16, 0, -3),
    "spine01": (3, 0, 0), "spine02": (3, 0, 0), "spine03": (2, 0, 0),
    "chest": (2, 0, 0), "neck": (6, 0, 0), "head": (2, 0, 0),
    "armUL": (-30, 0, 30), "armLL": (-56, 0, 6), "handL": (-6, 0, 0),
    "armUR": (-14, 0, -32), "armLR": (-34, 0, -6), "handR": (-6, 0, 0),
    "legUL": (-62, 0, 5), "legLL": (62, 0, 0), "footL": (-14, 0, 0),
    "legUR": (4, 0, -5), "legLR": (104, 0, 0), "footR": (-18, 0, 0),
}

# Up on her knees with her hands behind her back — what being hosed gets you
# indoors, where the promenade's answer to it is a cartwheel and a handful of
# fire. Same room, same water, different game: out there she is performing at a
# beach, in here there is one other person in a four-metre room and she has
# already poured you a glass.
#
# Built off KNEEL rather than off IDLE, so the legs, the shins folded back and
# the 0.45 m the root drops are the ones already solved for kneeling and not a
# second attempt at them.
#
# The arms are the pose, and every version of them that failed failed the same
# way: it was wrong about which way a rotation goes, and it took a five-minute
# render to find out. Positive X on the upper arm takes it behind her; the
# obvious build is 25° of that plus 90° of elbow, and what it renders is a woman
# holding her own hands in front of her chest, because flexing an elbow on an
# untwisted humerus swings the forearm forward and 25° of extension cannot
# out-run it. Adding humeral twist moved her hands from her chest to her chin.
# Straightening the elbows and taking the shoulders to 68° put the hands behind
# her at last and left the arms out either side like a pair of wings.
#
# What broke the loop was `--probe`, which prints where a wrist lands instead of
# drawing it: two dozen candidates in the time one render takes, and the answer
# fell out in three passes. See the note on the numbers below.
KNEEL_BACK = dict(KNEEL, **{
    "pelvis": (-4, 0, 0),
    "spine01": (0, 0, 0), "spine02": (0, 0, 0), "spine03": (-6, 0, 0),
    "chest": (-11, 0, 0), "neck": (13, 0, 0), "head": (12, 0, 1),
    # Shoulders rolled back, which is what the pose is doing to her chest and
    # is the whole difference between hands behind the back and hands hidden.
    "clavicleL": (0, 0, -8), "clavicleR": (0, 0, 8),
    # Settled with `--probe` rather than with renders, and that is the whole
    # story of these six numbers. Where a hand ends up is a question a
    # coordinate answers in a second and a picture answers in five minutes, and
    # every wrong version of this pose was wrong about which way a rotation
    # goes. What the probe says about the shipped version: the wrists sit
    # 0.19 m behind the pelvis, 0.04 m either side of the midline and level
    # with the small of her back. Hands behind the back, all but touching.
    #
    # x is extension, and 64° of it is what puts them behind rather than beside
    # her. z is the one that was backwards for three goes: on the left arm
    # *positive* z brings it in to the body, and without 34° of that the hands
    # end up 0.30 m apart with an arm out either side, which is a shrug. And
    # the forearm's own z is what finishes the job — 50° of it takes the wrists
    # the last hand's width to the midline.
    "armUL": (64, 0, 34), "armLL": (-30, 0, 50), "handL": (-6, 0, -8),
    "armUR": (64, 0, -34), "armLR": (-30, 0, -50), "handR": (-6, 0, 8),
})

# The same, a breath later. Everything here is small on purpose: she is holding
# a position, and a held position that moves is a person, where a held position
# that does not is a mannequin.
KNEEL_BACK_B = dict(KNEEL_BACK, **{
    "@root": (0.0, -0.018, -0.446),
    "spine01": (1, 0, 0), "spine02": (1, 0, 0), "spine03": (-8, 0, 0),
    "chest": (-13, 0, 0), "neck": (15, 0, 0), "head": (14, 5, 1),
    "armUL": (67, 0, 33), "armUR": (67, 0, -33),
})


# And the knee shuffle: the same pose, going somewhere.
#
# Everything above the hips is KNEEL_BACK and stays KNEEL_BACK — the arms do
# not come out to balance, because the whole point of the thing is that they
# stay where they are put. What moves is a knee at a time, with the pelvis
# turning into each one and the spine turning back against it, which is what
# stops a shuffle from reading as a statue sliding across a floor.
#
# The thigh that swings forward has to fold its shin further to keep the foot
# off the floor it is being dragged over, and the trailing one opens out. The
# root lifts four millimetres at each extreme because a body over one knee is
# a body over one knee.
def _knee(sg):
    return dict(KNEEL_BACK, **{
        "@root": (0.0, -0.02, -0.446),
        "pelvis": (-4, 0, -6 * sg),
        "spine01": (0, 0, 4 * sg), "spine02": (0, 0, 2 * sg),
        "spine03": (-6, 0, 2 * sg),
        "head": (12, -7 * sg, 1),
        "legUL": (-8 - 18 * sg, 0, 5), "legLL": (82 + 12 * sg, 0, 0),
        "legUR": (-8 + 18 * sg, 0, -5), "legLR": (82 - 12 * sg, 0, 0),
    })


KNEE_A = _knee(1)
KNEE_B = _knee(-1)


# ── the somersault ──────────────────────────────────────────────────────────
#
# One tucked front somersault, and the entire revolution is carried on `pelvis`
# alone: its X runs 0 → −360 across the middle of the clip. That works only
# because `_lerp_pose` blends the authored *degrees*. A quaternion track cannot
# hold more than half a turn between two keys — it always takes the short way
# round — so a full revolution has to exist as a number before it is ever baked,
# and the bake then samples it at 30 fps where no two adjacent frames are more
# than about fifteen degrees apart.
#
# The consequence is the one thing in this file that looks like a typo and is
# not: the clip's last key holds `pelvis` at −360, not at 0. They are the same
# attitude and the same quaternion, and a key at 0 makes the interpolator unwind
# the whole revolution backwards in a fifth of a second.
#
# The turn pivots on the root bone's head, which is the hip joint, and that is
# within a few centimetres of where a tucked gymnast's centre of mass actually
# is — so the arc in `@root` is a real ballistic arc rather than a fudge for
# rotating about the wrong point.

# Hip 0.71 m up, thigh 45° forward of vertical, and the shin taking the ankle
# back to the floor at 42° — which puts her feet under her centre rather than out
# in front of it, and is the difference between a squat and sitting down.
CROUCH = {
    "@root": (0.0, 0.02, -0.24),
    "pelvis": (-22, 0, 0),
    "spine01": (0, 0, 0), "spine02": (1, 0, 0), "spine03": (2, 0, 0),
    "chest": (3, 0, 0), "neck": (10, 0, 0), "head": (6, 0, 0),
    "armUL": (33, 0, 20), "armLL": (-22, 0, 4), "handL": (-8, 0, 0),
    "armUR": (33, 0, -20), "armLR": (-22, 0, -4), "handR": (-8, 0, 0),
    "legUL": (-67, 0, 5), "legLL": (87, 0, 0), "footL": (-30, 0, 0),
    "legUR": (-67, 0, -5), "legLR": (87, 0, 0), "footR": (-30, 0, 0),
}

# The throw: arms up and over, legs driving straight, and the hips already
# turning. Everything after this is ballistic.
LAUNCH = {
    "@root": (0.0, 0.02, 0.12),
    "pelvis": (-12, 0, 0),
    "spine01": (-3, 0, 0), "spine02": (-3, 0, 0), "spine03": (-2, 0, 0),
    "chest": (-5, 0, 0), "neck": (4, 0, 0), "head": (2, 0, 0),
    "armUL": (-150, 0, 14), "armLL": (-10, 0, 2), "handL": (0, 0, 0),
    "armUR": (-150, 0, -14), "armLR": (-10, 0, -2), "handR": (0, 0, 0),
    "legUL": (-12, 0, 3), "legLL": (4, 0, 0), "footL": (-26, 0, 0),
    "legUR": (-12, 0, -3), "legLR": (4, 0, 0), "footR": (-26, 0, 0),
}


def _tuck(deg, up):
    """Knees to chest at `deg` through the turn, hips `up` metres off rest."""
    return {
        "@root": (0.0, 0.02, up),
        "pelvis": (deg, 0, 0),
        "spine01": (-14, 0, 0), "spine02": (-14, 0, 0), "spine03": (-12, 0, 0),
        "chest": (-16, 0, 0), "neck": (-18, 0, 0), "head": (-12, 0, 0),
        "clavicleL": (0, 0, 10), "clavicleR": (0, 0, -10),
        "armUL": (-62, 0, 26), "armLL": (-108, 0, 8), "handL": (-22, 0, 0),
        "armUR": (-62, 0, -26), "armLR": (-108, 0, -8), "handR": (-22, 0, 0),
        "legUL": (-120, 0, 8), "legLL": (130, 0, 0), "footL": (-28, 0, 0),
        "legUR": (-120, 0, -8), "legLR": (130, 0, 0), "footR": (-28, 0, 0),
    }


TUCK = _tuck(-180, 0.46)      # the one that gets rendered, halfway over

# Feet under her again, absorbing. Note the pelvis: see above.
LAND = {
    "@root": (0.0, 0.02, -0.18),
    "pelvis": (-360 - 14, 0, 0),
    "spine01": (3, 0, 0), "spine02": (3, 0, 0), "spine03": (3, 0, 0),
    "chest": (4, 0, 0), "neck": (7, 0, 0), "head": (3, 0, 0),
    "armUL": (-46, 0, 8), "armLL": (-34, 0, 4), "handL": (-6, 0, 0),
    "armUR": (-46, 0, -8), "armLR": (-34, 0, -4), "handR": (-6, 0, 0),
    "legUL": (-49, 0, 6), "legLL": (70, 0, 0), "footL": (-26, 0, 0),
    "legUR": (-49, 0, -6), "legLR": (70, 0, 0), "footR": (-26, 0, 0),
}

SETTLE = dict(IDLE_A, pelvis=(-360, 0, -2.5))

# ── shared pose helpers ────────────────────────────────────────────────────
#
# Both of these are used by nearly every clip below — the skip, the
# cartwheel, the shimmy and the moonwalk all ease between keys, and all four
# write one side of the body and reflect the other — so they sit above the
# clips rather than inside whichever one happened to need them first.


def _ease(x):
    x = 0.0 if x < 0 else (1.0 if x > 1 else x)
    return x * x * (3.0 - 2.0 * x)


def _mirror(p):
    """One attitude, reflected through her sagittal plane.

    Which is exactly what the back half of a cartwheel is. Rolling from a
    hundred and eighty round to three-sixty is the front half over again with
    the right hand and the right foot doing what the left ones did, so it is
    written once and reflected rather than tuned twice. The exit is then as good
    as the entry by construction — and the exit is precisely where every earlier
    version of this fell apart, because nothing was forcing the two to agree.

    Signs: the sagittal channel X survives a left-right reflection untouched,
    while Y and Z both flip, which is the same mirroring rule the rest of this
    file uses when it writes a symmetric pose as `+n` on the left and `−n` on
    the right.
    """
    out = {}
    for k, v in p.items():
        if k == "@roll":
            out[k] = (-v[0] % 360.0,)
        elif k == "@root":
            out[k] = (v[0], -v[1], v[2])
        elif k[-1] in "LR":
            out[k[:-1] + ("R" if k[-1] == "L" else "L")] = (v[0], -v[1], -v[2])
        else:
            out[k] = (v[0], -v[1], -v[2])
    return out


# ── skipping ────────────────────────────────────────────────────────────────
#
# A step-hop, which is what a skip is and what this was not.
#
# The old clip had one contact per foot: land left, float, land right, float,
# evenly spaced. That is a bound — a deer clearing a fence, twice a second, for
# four hundred metres of promenade. A skip puts *two* contacts on the same foot
# before it changes over: you step onto the left, you hop on that same left
# foot, and only then do you stride onto the right. The doubled beat is the
# whole difference between the two gaits, and it is what "like a horse" means:
# the step and its hop fall close together and the stride that follows is long,
# so the footfalls come da-dum ... da-dum ... rather than da ... da ... da.
#
# Which is why the key times below are uneven, and why that is the load-bearing
# part rather than a detail. The two contacts of a half-cycle are at 0 and 0.34
# and the next one is at 1.0; every other number here hangs off those three.
# Spacing them evenly is precisely the mistake that made the old one a bound.
#
# The bounce lives in `@root`, as it did before — a skip that keeps its hips at
# a constant height is a walk with the knees raised — but there are now two
# floats to a half-cycle rather than one, and they are deliberately different
# sizes. The hop is a small one, 5 cm; the stride that follows it is 10.5 cm and
# is the part anybody watching is actually looking at.
#
# Those two are the only heights authored here, and they are heights *above the
# deck*, not hip displacements. The hip displacement that puts a reaching foot
# on the concrete is not a number anybody can guess: the first pass at this one
# guessed, and got a hop nine centimetres through the deck on one beat and a
# step hanging seven above it on the next. `skip_floor` solves it instead, the
# way `wheel_floor` and `dance_floor` already do for the cartwheel and the
# dances — the contacts are put on the deck and the floats are lifted off the
# line between them.
#
# Only the left-supporting half is written. The right-supporting half is that
# one reflected, which is what makes the two sides agree by construction and
# what fixes the seam: continuity across it requires the arm swing to arrive at
# minus its starting value, and it does, because the arms have exactly reversed
# by then. See `_mirror`.


def _skip_pose(up, sup, fre, arm, lift):
    """One key of the half-cycle that steps and hops on the left foot.

    `up` is the body's height off nominal, and is written by `skip_floor` rather
    than authored. `sup` and `fre` are (hip, knee, ankle) for the supporting leg
    and the free one. `arm` is the left arm's swing, negative behind her and
    positive in front. `lift` is how far both arms are carried out from the
    body, which rises on the float.
    """
    return {
        "@root": (0.0, 0.0, up),
        "pelvis": (-4, 0, -5),
        "spine01": (-2, 0, 2), "spine02": (-2, 0, 2), "spine03": (-3, 0, 1),
        "chest": (-5, 0, 0), "neck": (4, 0, 0), "head": (-3, -10, 2),
        "clavicleL": (0, 0, 4), "clavicleR": (0, 0, -4),
        # Opposition, as in any gait: the arm across from the leg that is
        # reaching forward goes forward with it, and the other one goes back.
        #
        # `back` is the word doing the work. The first pass swung the shoulders
        # ±40 with the elbows folded 46° and the arms carried 34° out from the
        # body, and the sum of those three was that neither hand ever got behind
        # her hip — both stayed out in front at chest height for the whole cycle,
        # palms down, like somebody carrying a tray of drinks through a crowd.
        # Wider swing, straighter elbows, arms held closer in.
        "armUL": (-arm, 0, 14 + lift), "armLL": (-34, 0, 4), "handL": (-8, 0, 0),
        "armUR": (arm, 0, -14 - lift), "armLR": (-34, 0, -4), "handR": (-8, 0, 0),
        "legUL": (sup[0], 0, 4), "legLL": (sup[1], 0, 0), "footL": (sup[2], 0, 0),
        "legUR": (fre[0], 0, -4), "legLR": (fre[1], 0, 0), "footR": (fre[2], 0, 0),
    }


SKIP_DUR = 0.80           # one cycle: step-hop on the left, step-hop on the right

# h is the fraction through the half-cycle. The three moments that matter are
# the step contact at 0.00, the hop contact at 0.34 and the next step contact at
# 1.00, which is the mirrored 0.00; the other two keys are the apexes of the two
# floats between them.
#
# `rise` is metres of daylight under her lowest foot, so a contact is a zero and
# nothing else in the table is. The legs at the contacts are near enough
# straight, because that is what a leg does when it is holding a body up; the
# folded ones are the airborne keys.
#
# The ankle at the two contacts is not free. Every bone in the leg turns about
# the same world axis, so flexing the hip forward carries the shin and the foot
# with it and pitches the sole toe-down by the same amount the thigh moved: a
# foot left at zero on a leg reaching 22° forward is a foot driven 22° into the
# concrete, toe first. Flat costs `ankle = hip + knee − 1.3`, measured across
# six poses and good to a quarter of a degree over the range used here.
#
# It matters more than it sounds. `skip_floor` will happily solve a buried toe
# by hoisting her entire body eight centimetres, silently, and what comes back
# is a pogo stick rather than a bounce — which is exactly what the first pass at
# this did. The airborne keys sit a little below flat, which is a pointed toe.
SKIP_KEYS = [
    #  h    rise    support leg     free leg      arm  lift
    (0.00, 0.000, (-22, 6, -17), (24, 46, 48), -55, 4),    # the step lands flat
    (0.19, 0.050, (-4, 22, 4), (-20, 78, 42), -30, 12),    # the hop, floating
    (0.34, 0.000, (0, 12, 11), (-42, 96, 40), -6, 10),     # and landing again
    (0.66, 0.105, (20, 44, 44), (-50, 82, 20), 34, 18),    # the long float
    (0.85, 0.040, (24, 46, 48), (-36, 32, -10), 50, 10),   # reaching to land
]

SKIP_HALF = [(h, _skip_pose(0.0, *rest)) for h, _, *rest in SKIP_KEYS]
SKIP = ([(h * SKIP_DUR / 2.0, p) for h, p in SKIP_HALF]
        + [((1.0 + h) * SKIP_DUR / 2.0, _mirror(p)) for h, p in SKIP_HALF]
        + [(SKIP_DUR, SKIP_HALF[0][1])])

SKIP_STEP = SKIP_HALF[0][1]       # the three of them worth looking at on their
SKIP_HOP = SKIP_HALF[1][1]        # own, for --reskin
SKIP_AIR = SKIP_HALF[3][1]

# ── walking ─────────────────────────────────────────────────────────────────
#
# What she does when she is only going somewhere, which is nearly all of the
# time she is moving at all.
#
# The skip above was her only gait for a dozen releases and it was reported as
# the thing that reads badly. It is a good clip and that was never the
# complaint. A step-hop is what a person does in a burst, on a good day, for
# ten metres; playing it for the whole twenty-four seconds of larking about,
# up and down four hundred metres of promenade, and again on the way home, and
# again on the way over to you, turns a flourish into a tic. The fault was
# never in the skip, it was in it being the only thing she knew.
#
# Written the same way — one half-cycle authored, the other its reflection, so
# the two sides agree by construction and the seam closes on its own — and
# solved a different way, for which see `walk_floor`.
#
# One thing about her feet decides most of the numbers below: there is no toe
# bone on this rig. The foot is a plank hinged at the ankle, so there is no
# heel-strike-and-roll to be had; a planted foot is flat or it is pivoting on a
# corner. So the stance foot is flat for every key it carries her through, and
# the ankle that does it is computed by `_flat` rather than typed, because a
# sole left at zero on a leg reaching 22° forward is a sole driven 22° into the
# concrete. The same trap the skip fell into, and the same way out of it.

WALK_PELVIS = -2.0        # a gentler forward carry than the skip's -4
WALK_DUR = 1.00           # one cycle: a step onto the left, a step onto the right

# ── the six numbers that make it a person walking and not a bear ────────────
#
# All six pull a limb *in* toward the midline, and every one of them is paying
# off the same debt: the base mesh is an A-pose and the A-pose is the widest
# attitude a body has. Nothing here touches the swing, which is `WALK_KEYS` and
# was never the problem — the report was that she walks "like some bear, with
# her legs too wide apart", and a gait can be timed perfectly and still read as
# an animal if the limbs are in the wrong plane while they do it.
#
# The old numbers were 2 at the hip and nothing anywhere else, and the comment
# that shipped with them claimed they put her "feet under the hips rather than
# out either side of them". Measured off the exported clip they did nothing of
# the sort: her ankles ran 36 to 40 cm apart through the whole cycle. A walking
# adult's step width — the sideways gap between where the two feet land — is
# about 10 cm, and 12 cm on a wide day. Forty is a bear.
#
# Every figure below is a joint-centre distance read off the posed rig by
# `tools/blender` probe, not an eyeballed angle, because the angle is never the
# thing that is wrong: the rest pose already has 6.5° of splay in the thigh and
# another 9.3° in the shin, and an angle typed into a clip is only ever the
# correction on top of that.

# The hip, and the biggest single number in the walk. The thigh comes off the
# A-pose's +6.5° of abduction and finishes 4° *inside* vertical, which is the
# real thing: a femur runs inward from the hip to the knee on everybody, and it
# runs inward further on a woman. Ankles 11-12 cm apart, knees 16-17.
WALK_TRACK = 11.0
# The shin, which needed almost nothing once the hip was right. The knee's
# adduction is inherited, so all this does is take the last 2° of the base
# mesh's outward-flaring tibia off and leave the shank a couple of degrees
# inside vertical, where a real one is.
WALK_SHANK = 2.0
# And the sole, which is the whole reason the two above are not enough on their
# own. Thirteen degrees of hip and knee adduction is thirteen degrees of roll
# carried down the chain to a foot that was flat before it, and a foot rolled
# 13° is a woman walking on the insides of her feet — which was the first thing
# the narrowed track actually produced. This is the ankle giving it all back:
# soles within 3° of flat at every key, measured off the posed bone's own up
# axis rather than assumed.
WALK_SOLE = 13.0
# The shoulder. Twenty-nine was the idle's number and it was borrowed for the
# walk, and it is right for a figure standing still and about five degrees shy
# for one moving: it left the elbows 4 cm outboard of the shoulders. At 34 the
# humerus hangs 5.6° out from vertical, which is where a relaxed arm hangs.
WALK_ARM_IN = 34.0
# The forearm, and the one that reads worst of the six when it is missing. Three
# degrees of it left every wrist 5 cm *outboard* of its own elbow through the
# whole cycle — arms bowed out around the body, which is exactly the shape that
# gets called a bear. Twenty brings the wrists to 33 cm apart, just outside the
# thighs, so the forearms converge on the way down the way real ones do. Not
# further: at 38 they are 25 cm apart and her hands swing through her hips.
WALK_FORE_IN = 20.0
# The elbow's resting bend, for which see `_walk_elbow` — the sixth number, and
# the only one of the six that is not lateral.
WALK_ELBOW = 18.0


def _walk_elbow(a):
    """How far the elbow is folded for a swing of `a`, in degrees.

    Straight-ish behind her and folded in front, which is what an arm does. `a`
    runs -22 (that arm is back) to +22 (it is forward); the bend runs +18 to -4.

    ── the constant, which used to be -8 and is now +18 ──────────────────

    Sign first, because the name lies about it and cost an afternoon: on this
    bone a *more negative* X does not fold the elbow, it swings the hand
    further forward. The base mesh's forearm already leaves the elbow 46° bent
    and pointing forward-and-out — that is what an A-pose is — so zero at this
    joint is not a straight arm, it is an arm held out in front. Starting the
    ramp at -8 added to that instead of undoing it.

    What it produced is measurable and was in every frame: over a whole cycle
    her wrist travelled from 2 cm in front of her shoulder to 30 cm in front of
    it and never once went behind, riding at navel height at the top of the
    swing. That is a woman carrying a tray, which is the failure the previous
    comment here warned about and then shipped anyway.

    At +18 the base bend is undone down to about 28° — a real walking elbow —
    and the hand swings -13 cm to +27 cm about the shoulder at hip height,
    which is an arm.
    """
    return WALK_ELBOW - 0.5 * (a + 22.0)


def _walk_pose(up, sup, fre, arm, sway):
    """One key of the half-cycle that stands on the left foot.

    `sup` and `fre` are (hip, knee, ankle) for the planted leg and the swinging
    one, `arm` is the left arm's swing — negative behind her, as in the skip —
    and `sway` is the pelvis leaning toward the foot she is standing on. `up` is
    written by `walk_floor` and never here.
    """
    return {
        "@root": (0.0, 0.0, up),
        # Nearly upright. The skip carries a lean because it is a gait with an
        # airborne phase and she is going somewhere with intent; a walk on a
        # promenade in August is not leaning at anything.
        "pelvis": (WALK_PELVIS, 0, sway),
        "spine01": (-1, 0, 0), "spine02": (-1, 0, 0), "spine03": (-1, 0, 0),
        "chest": (-2, 0, 0), "neck": (3, 0, 0), "head": (-2, 0, 0),
        "clavicleL": (0, 0, 3), "clavicleR": (0, 0, -3),
        # Opposition again, at well under the skip's amplitude. The skip swings
        # ±55 because it is throwing itself forward twice a second and the arms
        # are part of the throw; hers here just hang and keep time.
        #
        # The elbow is not a constant, and the first pass at this walk made it
        # one — 20° of flex on both arms at every key — which is the trap the
        # skip's own comment three hundred lines up warns about and which I
        # walked straight into anyway. A constant forward bend at the elbow is
        # added to the shoulder's swing, so with 20° of it and only ±16 of
        # swing neither hand ever got behind her hip: both stayed out in front
        # at waist height, palms down, which is a woman carrying a tray of
        # drinks rather than a woman walking.
        #
        # A real arm straightens as it goes back and folds as it comes forward,
        # so `_walk_elbow` hangs the bend off the swing. It is written per side
        # rather than shared because the two arms are half a cycle apart, and
        # the mirror keeps them that way on its own: the left arm's value at the
        # end of the half-cycle is the right arm's value at the start of it.
        #
        # Everything about where the arm *is*, as opposed to what it is doing,
        # is now one of the six constants above: `WALK_ARM_IN` at the shoulder,
        # `WALK_FORE_IN` at the elbow, and `WALK_ELBOW` as the base of the
        # ramp. That split is worth keeping — the swing is `arm` on X and
        # nothing here reads it, so pulling a limb in toward the midline can
        # never quietly change the gait, and the gait can never quietly widen
        # her out again.
        "armUL": (-arm, 0, WALK_ARM_IN),
        "armLL": (_walk_elbow(arm), 0, WALK_FORE_IN),
        "handL": (-4, 0, 0),
        "armUR": (arm, 0, -WALK_ARM_IN),
        "armLR": (_walk_elbow(-arm), 0, -WALK_FORE_IN),
        "handR": (-4, 0, 0),
        # The three lateral numbers on each leg, in the order the chain applies
        # them: adduct the thigh, take the base mesh's flare out of the shin,
        # then roll the sole back flat under the pair of them.
        "legUL": (sup[0], 0, WALK_TRACK), "legLL": (sup[1], 0, WALK_SHANK),
        "footL": (sup[2], WALK_SOLE, 0),
        "legUR": (fre[0], 0, -WALK_TRACK), "legLR": (fre[1], 0, -WALK_SHANK),
        "footR": (fre[2], -WALK_SOLE, 0),
    }


# h is the fraction through the half-cycle, which is one step: the left foot
# comes down at 0.00 and the right one at 1.00, and 1.00 is this table's 0.00
# mirrored. Evenly spaced, unlike the skip's, and for the same reason the skip's
# are not — a walk's footfalls *are* evenly spaced, and that regularity is the
# whole difference between the two gaits.
#
# The left hip runs -22 → +22 across the step and the right one runs back the
# other way, which is what makes 1.00 the mirror of 0.00 without anything having
# to enforce it. Everything else hangs off that pair.
#
# `point` is how far below flat the *swinging* foot hangs, in degrees. It is
# large at 0.00, which is the trailing foot pushing off with its heel already
# up, falls away through the swing, and is nearly nothing by 0.75 because a foot
# about to land is a foot coming back to flat. The planted foot has no entry
# here: it is flat, always, and `walk_floor` computes it.
WALK_KEYS = [
    #  h    planted leg   swinging leg  point  arm  sway
    (0.00, (-22, 4), (22, 10), 16, -22, 0),   # both down: she has just landed
    (0.25, (-13, 9), (10, 42), 14, -12, 2),   # the trailing foot is off, folding
    (0.50, (-1, 12), (-4, 60), 8, 0, 3),      # mid-stance, the knee at its top
    (0.75, (12, 7), (-18, 34), -6, 12, 2),    # the shin swings out ahead of her
]

# Both filled by `walk_floor`, which is where the ankles are computed and the
# hip heights solved. Empty until then, the way FIRE is — CLIPS below holds the
# list itself, so filling it in place is enough.
WALK_HALF = []
WALK = []

# ── the cartwheel ───────────────────────────────────────────────────────────
#
# A wheel over her left hand, and like the somersault the whole revolution rides
# on one channel of `pelvis` — Z this time rather than X. The bone table names
# local Z as world −X for every up-or-down bone, and the pelvis points up, so
# pelvis Z is the roll axis: the fore-and-aft line through her that a cartwheel
# actually turns about. It runs 0 → +360 across the clip, positive going over
# her left, and the somersault's rule about the last key applies here too — it
# holds 360 rather than 0, because they are the same attitude and only one of
# them keeps the interpolator turning the way she was already turning.
#
# Pelvis X and Y stay at zero the whole way through, deliberately. An XYZ Euler
# with two hundred degrees in Z and anything at all in X is not a lean on a
# roll, it is a third rotation nobody authored, and every bit of shaping this
# needs is available on the spine and the limbs instead.
#
# The clip is otherwise stationary: it wheels on the spot, and the travel comes
# from the game moving her along the line she is wheeling over. That line is
# ninety degrees off the way she is facing — src/43-jadrija.js takes the quarter
# turn at a walk before it plays this, and gives it back after.


# Measured off the rest pose rather than guessed at, which is the only place
# numbers like these can honestly come from. The surprise is the third one: her
# arms are shorter than her legs, so the hips sit five centimetres *lower* in
# the handstand than in the stance. Authored from intuition it went the other
# way — up fifteen — and that one wrong sign is most of what had her wheeling
# through the air with her hands half a metre clear of the deck.
HIP_0 = 0.934     # standing hip height
LEG_R = 0.919     # hip to the tip of the toe, leg straight
ARM_R = 0.880     # hip to the palm, arms in line with the trunk overhead
                  # (the hand bone's tail is the wrist; the palm is ~4 cm past)


WHEEL_DUR = 1.32          # seconds for one wheel
WHEEL_KEYS = 24           # segments; 15 degrees of roll each

# How the arms are carried, which is the part of this that got reported rather
# than measured — "her arms get criss-crossed over, and they almost arch too far
# back". Both were true and both were a number in the pose below.
#
# REACH is how far apart the hands are held, in degrees at the shoulder, plus
# how much that changes once her weight is on them. It used to be a flat ten,
# and ten was not a spread at all: with the arms swung overhead, ten put the
# wrists **twelve and a half centimetres the wrong side of each other**, on
# eleven of the twenty-five keys — the whole upright approach and the whole
# upright exit. Rendered from the front she is not holding her arms up, she is
# clamping both hands over her own ears with her forearms crossed above her
# skull. It is the first thing you see and it was in every wheel she has ever
# turned.
#
# Thirty-six holds them 0.28 m apart going in and coming out, which is her own
# shoulder width, which is where a cartwheel puts them. The −14 closes that to
# 0.06 m through the inverted middle, and closing rather than opening is
# deliberate: at the handstand the two hands are on the line one behind the
# other, so laterally they belong close together, and it also keeps the planted
# hand low — spreading the arms shortens their reach to the deck, and a hand
# that cannot reach is a hand the floor pass leaves hanging in the air.
#
# The sign is not obvious and is worth stating, because it is the opposite of
# what the idle pose implies. On an arm hanging at her side, +Z on the left
# adducts — that is what IDLE_A's +29 is doing. On an arm already swung 160°
# overhead, the Euler's X has carried the local frame round with it and the same
# +Z *abducts*. Reading the idle sign across to here and flipping it, which is
# the obvious move, gets you 33 cm of crossed wrists instead of 12.
#
# ARM and WRIST are the arch — "they almost arch too far back a bit", and they
# did. −166 at the shoulder, −4 at the elbow and −18 at the wrist sum to −188:
# eight degrees past straight overhead, which carried her hands 12 cm *behind*
# her shoulders and bowed her back to keep up. The same three summing to −180
# put the arms in line with the trunk. Worst-case arch across the wheel goes
# from −0.123 m to −0.076 m; on the upright keys, where you actually see it,
# from −0.12 to −0.03.
WHEEL_REACH = (36.0, -14.0)
WHEEL_ARM = -158.0        # shoulder, elbow and wrist sum to −180: straight up,
WHEEL_WRIST = -18.0       # in line with the body, neither arched nor reaching


def _wheel(deg):
    """The attitude at `deg` degrees round, front half authored, back mirrored."""
    if deg <= 180:
        return _wheel_half(deg)
    p = _mirror(_wheel_half(360.0 - deg))
    # The roll is put back by hand rather than taken from the reflection, and
    # this is the somersault's `−360` trap wearing the other hat: reflecting the
    # front half's 0 gives 0, so the closing key held nothing instead of a whole
    # turn, and the last twentieth of a second ran the entire wheel backwards.
    # They are the same attitude. Only one of them is the same number.
    p["@roll"] = (deg,)
    return p


def _wheel_half(deg):
    """The front half of the wheel, as one function of how far round it is.

    Written as a function rather than as six hand-authored keys for a reason
    that only shows up in motion: `_bake_clip` eases *within* each key interval,
    so the rate goes to zero at every key it passes through. That is what you
    want for a wave and exactly what you do not want for a revolution — six keys
    of it and she wheels over in six visible lurches. Sampling one continuous
    function every thirty degrees puts the keys close enough together that the
    per-segment ease disappears into a constant turn.

    Two things are tracked across the roll and everything else follows them.

    `hands` is how much of her weight is on her hands: nothing until she is two
    thirds of the way to horizontal, all of it through the inverted middle,
    back to nothing as the first foot arrives. It sets the hip height, because
    her arms are shorter than her legs and the hips genuinely do sit four
    centimetres lower in a handstand than in a stance.

    The counter-rotations are what make it a cartwheel and not a pinwheel. Every
    up-or-down bone in this rig shares its local Z with the world's fore-and-aft
    axis, and the roll is about that same axis, so a support limb given the
    negative of the roll on its own Z points exactly where it pointed before she
    started going over: at the floor, while everything above it turns past. The
    hands stay planted and the feet stay planted for free, with no IK anywhere.

    The arms want `180 − deg` rather than `−deg`, because held overhead they
    already point along the body's own up: at the handstand they want nothing at
    all, and it is either side of it that they have work to do.
    """
    # The two hands are staggered, and that is not a detail. Symmetric arms mean
    # neither hand is *the* support once she is past the handstand: both swing
    # back overhead together, the floor pass has to drop her hips forty
    # centimetres to keep one of them on the concrete, and she exits the wheel
    # in a collapse. Real hands go down one at a time and leave one at a time —
    # left plants at about eighty-five degrees and leaves at two hundred, right
    # plants at a hundred and thirty and leaves at two-forty — and with that the
    # weight is somewhere definite at every moment of the roll.
    wl = _ease((deg - 84) / 30.0)
    wr = _ease((deg - 126) / 30.0)
    hands = max(wl, wr)
    # The knee-bent transfer on the way down into the first hand, where she is
    # lowest. The matching one on the way up off the last foot is the mirror of
    # this and costs nothing to write.
    dip = 0.055 * _ease(deg / 30.0) * (1.0 - _ease((deg - 44) / 34.0))
    hip = LEG_R + (ARM_R - LEG_R) * hands - dip
    # Folded to ±180 so a counter is always the short way round. The fold lands
    # at 180, in the middle of the stretch where `1 - hands` is exactly zero, so
    # the jump is multiplied out before it can reach a bone.
    r = ((deg + 180) % 360) - 180
    leg = -r * (1.0 - hands)
    cl = (180 - deg) * wl
    cr = (180 - deg) * wr
    split = 12 + 36 * hands              # the straddle, widest inverted
    reach = WHEEL_REACH[0] + WHEEL_REACH[1] * hands   # and the same for the arms
    bend = 14 * math.sin(math.radians(deg))
    look = 4 + 10 * hands
    lead = 8 * math.sin(math.radians(deg))
    knee = 5 + 30 * (dip / 0.055)        # that bent knee, on whichever leg
    return {
        "@root": (0.0, 0.02, hip - HIP_0),
        "@roll": (deg,),
        "spine01": (0, 0, bend * 0.30), "spine02": (0, 0, bend * 0.34),
        "spine03": (0, 0, bend * 0.24), "chest": (-2, 0, bend * 0.12),
        "neck": (look * 0.45, 0, 0), "head": (look, 0, 0),
        "clavicleL": (0, 0, 7), "clavicleR": (0, 0, -7),
        "armUL": (WHEEL_ARM, 0, cl + reach), "armLL": (-4, 0, 0),
        "handL": (WHEEL_WRIST, 0, 0),
        "armUR": (WHEEL_ARM, 0, -cr - reach), "armLR": (-4, 0, 0),
        "handR": (WHEEL_WRIST, 0, 0),
        # The bend is on the left knee alone: it is the one under her on the way
        # down, and the right one gets it back from the mirror on the way up.
        "legUL": (-lead, 0, leg - split), "legLL": (knee, 0, 0), "footL": (-8, 0, 0),
        "legUR": (lead, 0, leg + split), "legLR": (5, 0, 0), "footR": (-8, 0, 0),
    }


WHEEL = [(i * WHEEL_DUR / WHEEL_KEYS, _wheel(i * 360.0 / WHEEL_KEYS))
         for i in range(WHEEL_KEYS + 1)]

# ── the shimmy ──────────────────────────────────────────────────────────────
#
# "A shimmy shimmy yay dance move." A shimmy is one specific thing and it is not
# a wiggle of the whole body: the shoulders alternate forward and back, fast,
# and everything below the ribs stays where it is. Get the hips involved and it
# stops being a shimmy and starts being a shake.
#
# So the entire move is a twist, spread up the spine and taken back out again at
# the neck. Local Y is the twist on every up-or-down bone — it is the bone's own
# axis — which makes this four numbers going up and two coming back down.
#
# The coming back down is the half that matters. Fourteen degrees of shoulder
# swing with the head welded on top of it is somebody looking left and right;
# the same fourteen degrees with the face held still is a shimmy, because the
# stillness of the face is what tells you the shoulders are moving on purpose.
# The neck and the head carry +7 each against the spine's −14 and net to zero.
#
# Arms up, elbows out, hands by the ribs. Arms hanging at her sides and the
# shoulders have nothing to swing — the move becomes invisible from any distance
# at which you would want to watch it.
SHIMMY_DUR = 0.44          # a full there-and-back: about four reversals a second
SHIMMY_KEYS = 8            # sampled, not keyed — see dance_floor()


def _shimmy(s):
    """Half the cycle. `s` +1 throws one shoulder forward, −1 the other."""
    return {
        "@root": (0.0, 0.020, -0.014),
        # Two degrees of hip the other way and not one more. This is the line
        # between a shimmy and a shake.
        "pelvis": (-3, 3 * s, 0),
        "spine01": (-2, -2 * s, 0), "spine02": (-2, -3 * s, 0),
        "spine03": (-1, -4 * s, 0), "chest": (-3, -5 * s, 0),
        "neck": (4, 7 * s, 0), "head": (-3, 7 * s, 1),
        "clavicleL": (0, 0, 8), "clavicleR": (0, 0, -8),
        "armUL": (-26, 0, -34), "armLL": (-84, 0, -12), "handL": (-10, 0, 0),
        "armUR": (-26, 0, 34), "armLR": (-84, 0, 12), "handR": (-10, 0, 0),
        # Knees soft and alternating a couple of degrees, so she is standing on
        # them rather than bolted to the deck.
        "legUL": (-5, 0, -4), "legLL": (9 + 4 * s, 0, 0), "footL": (-4, 0, 0),
        "legUR": (-5, 0, 4), "legLR": (9 - 4 * s, 0, 0), "footR": (-4, 0, 0),
    }


def _shimmy_at(u):
    """`u` 0..1 through one full there-and-back."""
    return _shimmy(math.cos(2.0 * math.pi * u))


SHIMMY_A = _shimmy(1)      # the two extremes, for --reskin previews
SHIMMY_B = _shimmy(-1)
SHIMMY = [(i * SHIMMY_DUR / SHIMMY_KEYS, _shimmy_at(i / SHIMMY_KEYS))
          for i in range(SHIMMY_KEYS + 1)]

# ── the twerk ───────────────────────────────────────────────────────────────
#
# The shimmy's opposite, and written next to it for that reason. A shimmy is a
# twist that stops at the ribs and never reaches the hips; this is a pitch that
# lives entirely in the hips and must not reach the shoulders. Both are sold by
# what is *not* moving.
#
# Everything here happens on one channel: pelvis X, which is the fore-and-aft
# pitch — the same channel the walk carries a constant −2 on. It rocks ±15° at
# about two beats a second from a braced squat, knees bent and apart, both soles
# down for all of it.
#
# ── the two counter-rotations, which are the whole clip ──────────────────────
#
# **The hips go with the pelvis, not against it.** That looks backwards written
# down and it is forced by the rig. The thigh hangs off the pelvis, so pitching
# the pelvis swings the whole leg with it, and a leg that swings is a foot that
# leaves the deck. Holding the thigh still in the world means the hip's *local*
# angle has to move by whatever the pelvis moved — and `_flat` says which way:
# it is `hip + knee − pel − 5.35`, so pelvis and hip enter a limb's world pitch
# with opposite signs, and keeping `hip − pel` constant is what keeps the thigh
# where it is. The ankle then comes out very nearly constant on its own, which
# is the check that this is right rather than a coincidence: if the thigh and
# the shin are still, the sole cannot be moving.
#
# **The spine gives back exactly what the pelvis took.** Sum the pitch up the
# chain — pelvis, three spine bones, chest — and that sum is where her shoulders
# point. If it is left alone the shoulders rock with the hips and the whole
# figure see-saws, which is not the move, it is a bow. So the spine carries
# −15·s spread over four bones against the pelvis's +15·s, and the shoulders sit
# still while everything below them works. That is the same trick the shimmy
# plays at the neck, and for the same reason: the stillness is what makes the
# motion read as deliberate.
#
# Sampled rather than keyed, like both other dances — `_bake_clip` eases within
# every key interval, so five hand-placed keys arrive as five lurches with the
# rate going to zero between them. Ten samples of a cosine is a rock.
# ── how deep the squat has to be, which is not what it looks like on paper ──
#
# The first cut used a 48° knee and expected a squat. It got 8 cm, and the
# render was a woman standing nearly straight with her hips twitching.
#
# The arithmetic is worth writing down because the intuition is badly wrong. A
# knee angle folds the leg into a shallow V, and the hip drops by roughly
# `2·L·(1 − cos(θ/2))` for segments of length L — so at 48° the two 0.46 m
# halves give 2 × 0.46 × (1 − cos 24°) = 7.9 cm, which is exactly what the floor
# pass reported. Half the knee angle does far less than half the work. To put
# her hips 18 cm down the knee has to go to about 70°, and to get a proper deep
# squat it is nearer 85° — at which point the ankle `_flat` asks for is 38° of
# dorsiflexion, past what an ankle does and well past what this mesh looks
# right at. 70° is the compromise and it is chosen from the ankle end, not the
# knee end.
TWERK_DUR = 0.52           # a full down-and-up: a shade under two a second
TWERK_KEYS = 10            # sampled, not keyed — see dance_floor()
TWERK_PEL = -6.0           # the pelvis's forward carry, before the rock
TWERK_AMP = 13.0           # and how far it rocks either side of that
TWERK_HIP = -40.0          # thigh flexion: the squat she does it from
TWERK_KNEE = 56.0          # and the knee that goes with it — see above
TWERK_TRACK = 13.0         # how far apart her feet are, in degrees at the hip


def _twerk(s):
    """One attitude of the rock. `s` +1 is tipped back, −1 is tucked under."""
    pel = TWERK_PEL + TWERK_AMP * s
    hip = TWERK_HIP + TWERK_AMP * s        # with the pelvis — see above
    knee = TWERK_KNEE - 8.0 * s
    ank = _flat(hip, knee, pel)
    give = -TWERK_AMP * s                  # what the spine hands back
    return {
        "@root": (0.0, 0.0, 0.0),
        "pelvis": (pel, 0, 0),
        # Weighted toward the lower back, which is where a person actually
        # hinges when they do this. All four together are the −36° of forward
        # carry that puts her chest over her knees, plus the give.
        "spine01": (-8 + give * 0.30, 0, 0), "spine02": (-9 + give * 0.30, 0, 0),
        "spine03": (-8 + give * 0.25, 0, 0), "chest": (-5 + give * 0.15, 0, 0),
        # And the head comes back up out of all of it. Thirty-eight degrees of
        # forward carry with the head welded on top is somebody looking at the
        # concrete; she is looking back over the deck, which is the difference
        # between doing this and inspecting a paving slab.
        "neck": (12, 0, 0), "head": (20, 0, -2),
        "clavicleL": (0, 0, 6), "clavicleR": (0, 0, -6),
        # Braced rather than posed. Hands on the knees is the picture everyone
        # has, and this rig has no IK, so a hand aimed at a knee either hangs in
        # the air beside it or goes through the thigh — and the thigh is moving.
        # Out and back, elbows bent, clear of everything.
        "armUL": (-20, 0, 34), "armLL": (-52, 0, 8), "handL": (-6, 0, 0),
        "armUR": (-20, 0, -34), "armLR": (-52, 0, -8), "handR": (-6, 0, 0),
        "legUL": (hip, 0, TWERK_TRACK), "legLL": (knee, 0, 0), "footL": (ank, 0, 0),
        "legUR": (hip, 0, -TWERK_TRACK), "legLR": (knee, 0, 0), "footR": (ank, 0, 0),
    }


def _twerk_at(u):
    """`u` 0..1 through one full down-and-up."""
    return _twerk(math.cos(2.0 * math.pi * u))


# Filled by `dance_floor`, which is where the hip height is solved. Empty until
# then, the way WALK and FIRE are — CLIPS below holds the list itself.
#
# Nothing here is evaluated at import, unlike SHIMMY two dozen lines up, and it
# cannot be: `_twerk` calls `_flat`, which is declared with the firestarter two
# hundred lines below this. A module-level `_twerk(1)` for the preview extremes
# would run before `_flat` exists and take the whole file down at import.
TWERK = []


# ── the moonwalk ────────────────────────────────────────────────────────────
#
# One foot flat on the deck and gliding, the other up on its toe and holding
# still, and the two swapping over every seven tenths of a second while the body
# travels backwards. That is the whole move, and getting it right turns entirely
# on which foot is doing which.
#
# The popped foot is the anchor. It is planted — it does not move relative to
# the *deck* — so relative to her body it has to travel forwards by exactly as
# far as the body travels back, which is why its hip angle sweeps 34° while it
# is nominally standing still. Author it as stationary in her own frame instead,
# which is the obvious way round, and the anchor slides backwards with her: both
# feet glide, nothing is planted, and the illusion the move is made of does not
# happen. There is no walking here at all — only one foot sliding and one foot
# waiting — and the eye reads walking anyway *because* something stays put.
#
# That same 34° is where the travel speed comes from, so the game and the clip
# cannot drift apart: 34° of hip on a 0.90 m hip-to-toe is 0.53 m of deck, over
# a half-cycle, and the half-cycle is MOON_DUR / 2. `moonPace` in
# src/43-jadrija.js is that division and nothing else.
#
# Which is also the only honest way to make the move slower, and it was asked
# for. Stretching the clip alone leaves the game pushing her along at the old
# rate and the anchor foot — the one thing in a moonwalk that must not move —
# starts sliding backwards out from under her, which is the failure this whole
# section is built to avoid. Both numbers move or neither does. At 2.0 s the
# glide is 0.53 m/s, down from the 0.76 that read as somebody in a hurry to get
# to the other end of the promenade backwards.
MOON_DUR = 2.00
MOON_POP = -34.0           # plantarflexion in the popped foot: heel up, toe down
MOON_SWEEP = 34.0          # hip degrees the anchor gives back over a half-cycle


def _mw_leg(tag, hip, knee, heel):
    """One leg, with the ankle solved rather than authored.

    Every bone in this chain turns about the same axis, so the pitch of the sole
    is just hip + knee + ankle. Ask for the sole and let the ankle work out what
    it has to be. Authored against the other two by hand it goes wrong the first
    time either is nudged, and a moonwalk with a sole four degrees off the deck
    is a moonwalk on ice — which is nearly the joke, but not quite.
    """
    sole = MOON_POP * heel
    return {
        "legU" + tag: (hip, 0, 0),
        "legL" + tag: (knee, 0, 0),
        "foot" + tag: (sole - hip - knee, 0, 0),
        # And the toes lie flat under a popped heel instead of going through the
        # concrete with it.
        "toe" + tag: (-sole, 0, 0),
    }


# Of the 0.70 s half-cycle, this much is glide and the rest is the swap. The
# glide is the long part because the glide is the part anybody is looking at.
MOON_GLIDE = 0.66
MOON_KEYS = 20             # sampled, not keyed — see dance_floor()


def _moon_half(h):
    """One half-cycle, `h` 0..1, with the left foot flat and gliding.

    Two continuous ramps carry everything. `g` is how far through the glide she
    is; `x` is how far through the swap that follows it. Nothing here is keyed
    at a moment — every number is a function of those two, which is what lets
    the whole clip be sampled finely enough for the floor pass to mean anything.
    """
    g = _ease(min(1.0, h / MOON_GLIDE))
    x = _ease(max(0.0, (h - MOON_GLIDE) / (1.0 - MOON_GLIDE)))
    # Which foot the weight is over, swapping across the transfer rather than
    # flipping at it — a sign flip mid-clip is a snap you can see from the sea.
    s = 1.0 - 2.0 * x
    p = {
        "@root": (0.0, 0.020, -0.026),
        # Loose and low. This is not a march.
        "pelvis": (-2, 0, 3 * s),
        "spine01": (-3, 0, -1 * s), "spine02": (-3, 0, -1 * s),
        "spine03": (-2, 0, 0), "chest": (-4, 0, 0),
        "neck": (5, 0, 0), "head": (-4, 0, 0),
        "clavicleL": (0, 0, 6), "clavicleR": (0, 0, -6),
        "armUL": (-16 * s, 0, 20), "armLL": (-34, 0, 4), "handL": (-12, 0, 0),
        "armUR": (16 * s, 0, -20), "armLR": (-34, 0, -4), "handR": (-12, 0, 0),
    }
    # The glider, from in front of her hips to behind them, sole flat the whole
    # way — and popping its own heel at the end, ready to become the anchor.
    p.update(_mw_leg("L", -20 + 38 * g - 4 * x, 3 + 9 * g + 14 * x, x))
    # The anchor, giving back exactly the ground she covers so that it does not
    # move, then dropping flat to take over the glide.
    p.update(_mw_leg("R", 14 - MOON_SWEEP * g - 2 * x,
                     26 - 12 * g - 11 * x, 1.0 - x))
    return p


def _moon_at(u):
    """`u` 0..1 through the full cycle. The back half is the front, reflected."""
    return _moon_half(u * 2.0) if u < 0.5 else _mirror(_moon_half(u * 2.0 - 1.0))


MOON = [(i * MOON_DUR / MOON_KEYS, _moon_at(i / MOON_KEYS))
        for i in range(MOON_KEYS + 1)]


# ── soaked ──────────────────────────────────────────────────────────────────
#
# What she does when you point the branch at her.
#
# The brief was "spreads her arms and leans forward because she loves getting
# soaked, and smiles", and the only part of that which needed thinking about is
# the lean — because a lean is also what somebody does when they *hate* it.
# Flinching from cold water is a lean away with a shoulder turned into it;
# enjoying it is a lean in with the chest given to it. The two postures are
# about fifty degrees apart and they are the whole difference between delight
# and endurance, so the lean is the load-bearing angle here and the rest of the
# pose is decoration on top of it.
#
# Twenty-six degrees forward, and taken at the hips and the waist together
# rather than at either on its own: all of it at the pelvis is a bow, all of it
# in the spine is a stoop. The head then comes *back* thirty-six degrees against
# the trunk, which nets to about ten degrees of chin up — so she is leaning into
# the jet and looking at you over the top of it at the same time. That is the
# part that makes it read as something being done at somebody rather than
# something being stood in.
#
# The arms go past horizontal. The MakeHuman base stands with the upper arms 40°
# out, so the -52 here is 92° from vertical, and the torso being 26° forward
# sweeps them forward by the same amount without a degree being spent on it —
# which is why they are authored flat in her own frame and still arrive as an
# embrace. Palms open, elbows barely bent, because a spread arm with a folded
# elbow is a shrug.
#
# And nine degrees of jaw, which is the first clip in this file to key that bone
# at all — see `_trim_jaw` for why it took until now.
SOAK_A = {
    "@root": (0.010, 0.020, 0.006),
    "pelvis": (-12, 0, 0),
    "spine01": (-5, 0, 0), "spine02": (-5, 0, 0), "spine03": (-4, 0, 0),
    "chest": (-3, 0, 0), "neck": (16, 0, 0), "head": (20, -3, 0),
    "jaw": (-9, 0, 0),
    "clavicleL": (0, 0, 9), "clavicleR": (0, 0, -9),
    "armUL": (0, 0, -52), "armLL": (-12, 0, -6), "handL": (-22, 0, 0),
    "armUR": (0, 0, 52), "armLR": (-12, 0, 6), "handR": (-22, 0, 0),
    "legUL": (-12, 0, -6), "legLL": (10, 0, 0), "footL": (-9, 0, 0),
    "legUR": (-12, 0, 6), "legLR": (10, 0, 0), "footR": (-9, 0, 0),
}

# The same thing, a breath further into it: chest opened, arms up and wider,
# mouth wider, and half a centimetre of rise. Slow — 1.4 s round the loop — so
# it swells rather than bounces. A fast oscillation here reads as shivering,
# which is the emotion this pose exists to not be.
SOAK_B = dict(SOAK_A, **{
    "@root": (0.012, 0.020, 0.012),
    "chest": (-6, 0, 0), "neck": (18, 0, 0), "head": (22, 3, 0),
    "jaw": (-13, 0, 0),
    "clavicleL": (0, 0, 12), "clavicleR": (0, 0, -12),
    "armUL": (-5, 0, -60), "armLL": (-16, 0, -6), "handL": (-26, 0, 0),
    "armUR": (-5, 0, 60), "armLR": (-16, 0, 6), "handR": (-26, 0, 0),
    "legLL": (7, 0, 0), "legLR": (7, 0, 0),
})

# ── the firestarter ─────────────────────────────────────────────────────────
#
# "If we spray her with water for too long, she at some point switches into a
# Prodigy Firestarter routine." Which makes this the one clip in the file that
# is not something a child on a Dalmatian promenade would actually do, and it
# had to be built by working backwards from what survives the trip.
#
# The reference is a man in a tunnel in 1996, and almost none of what makes that
# performance work gets through: no face at this range, no hair to speak of, no
# camera cuts, no tunnel. What survives is the silhouette, and the silhouette is
# three things and their timing.
#
#   the hunch    chest dropped and shoulders rolled forward, so the outline goes
#                from a person standing to a person coiled
#   the chin     thrust up and out *against* the hunch — this is the single
#                angle that separates a threat from a slouch, and it is why the
#                neck and head carry +50° between them against a −34° back
#   the elbows   high, wide, and never in the same place twice
#
# And 140 to the minute, one stamp a beat, which is where FIRE_DUR comes from.
# Slower is a haka. Faster and the legs stop being legs.
#
# Two things are deliberately not authored.
#
# The stamp is not a sine wave. A leg that rises and falls smoothly is a march;
# a stamp is planted for most of its cycle, snaps up, and comes down harder than
# it went up. `_stomp` is that asymmetry, and it is the whole difference between
# the two readings.
#
# And the bounce is not written down anywhere, because it cannot be: the floor
# pass overwrites `@root` from the lowest tip and would throw away any hip
# height authored here. It comes out of the *supporting* knee instead — sixteen
# extra degrees of flexion on the frame the other foot lands, bled off over the
# next quarter cycle. Her hips drop because her standing leg absorbs, which is
# where the drop comes from in a real one, and the floor pass then finds it on
# its own.

FIRE_DUR = 0.86            # two stamps, at about a hundred and forty a minute
FIRE_KEYS = 16             # sampled, not keyed — see dance_floor()

# The pelvis's share of the hunch, and it is nearly nothing on purpose.
#
# The first pass put twelve degrees here and twenty-two in the back, on the same
# reasoning the `soak` pose uses — all of it at the pelvis is a bow, all of it in
# the spine is a stoop, so split it. That is right for a lean and wrong for this,
# and the side view said so immediately: thirty-four degrees of forward *tilt*
# with a straight back is a sprinter in the blocks, which is an athlete, which is
# the opposite of coiled. A hunch is a rounded upper back over hips that are
# still under her. So the pelvis stays where it is and the whole forty degrees
# goes into the spine, weighted toward the top of it.
FIRE_PELVIS = 2.0


def _flat(hip, knee, pel=FIRE_PELVIS):
    """The ankle angle that puts the sole flat on the deck.

    Measured, not derived, and general in all three. The naive model — that the
    sole's pitch is the sum of the angles down the leg — is wrong for this rig,
    because the foot does not carry the same roll as the bones above it (see
    FLAT), so a degree at the ankle is not worth a degree at the hip. Bisected
    against the exported rig at eighteen stances over three pelvis angles, the
    answer is a straight line, good to half a degree across the range anything
    here uses.

    The skip's own constant of −1.3 is this same line at its pelvis of −4, which
    is worth knowing and not worth rewriting: those numbers are baked, verified,
    and sitting four millimetres off the deck.
    """
    return hip + knee - pel - 5.35


def _stomp(ph):
    """How far a leg is lifted: 0 planted, 1 knee at the top. `ph` 0 is landing.

    Planted for exactly half the cycle, which is what makes this a march and not
    a jump — with a stance any shorter than half there is a window twice a cycle
    with neither foot on the deck, and the floor pass answers that by putting
    the lower of the two airborne feet on the ground, which is not a fix.

    The other half is snap, hang, slam: up in sixteen hundredths, held at the
    top for twice that, and down in fourteen. The hang is the part that reads. A
    knee that rises and falls without stopping is a march; a knee that gets to
    the top and *waits* there is somebody making a point with it.
    """
    ph = ph % 1.0
    if ph < 0.50:
        return 0.0
    if ph < 0.66:
        return _ease((ph - 0.50) / 0.16)
    if ph < 0.86:
        return 1.0
    return 1.0 - _ease((ph - 0.86) / 0.14)


def _sink(ph):
    """How far the standing leg has folded under the landing. This is the bounce.

    Nothing at the moment the foot arrives, all of it a tenth of a second later,
    and gone again by mid-stance — so her weight arrives, drops through the leg
    and comes back up, twice a cycle, just behind each footfall.

    The first version of this peaked *on* the landing frame and produced nine
    millimetres of hip travel over the whole clip, which is a figure standing
    still while its legs move. Two things were wrong with it. At the instant of
    a footfall both feet are down and the floor pass pins whichever leg is
    longer, so bending only the one that just landed changes nothing; and a knee
    bent on its own barely shortens a leg at all, because the thigh and the shin
    swing away from vertical in opposite directions and the cosines very nearly
    cancel. The hip has to go with the knee. It does, below.
    """
    ph = ph % 1.0
    if ph < 0.12:
        return _ease(ph / 0.12)
    if ph < 0.40:
        return 1.0 - _ease((ph - 0.12) / 0.28)
    return 0.0


def _snap(ph, ramp=0.16):
    """A square wave on [0, 1) with its edges eased over `ramp`.

    Up for the first half and down for the second. The arms run off this rather
    than off a cosine for the same reason the legs run off `_stomp`: a cosine
    spends all its time in transit and none at either end, and an arm that is
    always moving and never *placed* is a wave, not a jab.
    """
    ph = ph % 1.0
    if ph < 0.5:
        return _ease(ph / ramp) if ph < ramp else 1.0
    q = ph - 0.5
    return 1.0 - (_ease(q / ramp) if q < ramp else 1.0)


FIRE_HIP, FIRE_KNEE = -24.0, 14.0        # the stance at its longest: thigh 22°
                                         # forward of vertical and shin 8°,
                                         # which is a body over the balls of its
                                         # feet rather than sat back on them
FIRE_SINK = (-12.0, 18.0)                # and what the bounce takes off it —
                                         # thigh to 34° and shin to 2°, worth
                                         # about three centimetres of hip
FIRE_HIP_UP, FIRE_KNEE_UP = -82.0, 95.0  # the drive, knee to about waist height
FIRE_TOE = 26.0           # how far the toe drops once the foot is off the deck


def _fire_leg(ph):
    """(hip, knee, ankle) for one leg, `ph` its own phase with 0 the landing."""
    k, s = _stomp(ph), _sink(ph)
    down = (FIRE_HIP + FIRE_SINK[0] * s, FIRE_KNEE + FIRE_SINK[1] * s)
    hip = down[0] + (FIRE_HIP_UP - down[0]) * k
    knee = down[1] + (FIRE_KNEE_UP - down[1]) * k
    # Flat while it is down; toe dropped once it is off, because a knee driven
    # to the waist with the foot left level is somebody testing bathwater.
    return hip, knee, _flat(hip, knee) - FIRE_TOE * k


def _fire_at(u):
    """One frame of the loop. `u` 0..1; the left foot lands at 0.

    The arms are contralateral, which is the one piece of ordinary human wiring
    left in the move: the elbow that flies is the one across from the knee that
    drives, because that is what a body does with its arms when its legs do
    that, and taking it out makes her look like a wind-up toy rather than
    somebody committing.
    """
    lo = _fire_leg(u)
    ro = _fire_leg(u + 0.5)
    # `qL` is 1 with the left elbow up and out, 0 with the left forearm folded
    # across her. The right is its complement, so the two arms are never in the
    # same place and the scissor is a scissor.
    qL = _snap(u + 0.5)
    qR = 1.0 - qL
    tw = qR - qL              # +1 with the right arm up: the trunk twists left

    def arm(q, s):
        """One arm. `q` is 0 with the fist cocked in at the chest and 1 with the
        whole arm thrown out wide at shoulder height. `s` is +1 on the left.

        This is not the shape the first pass went for. That one wanted the
        goalpost — elbow high and wide, forearm hanging down — which is the
        actual Flint arm and which this rig will not make without internally
        rotating the upper arm first: the elbow hinges in whatever plane the
        shoulder leaves it in, so a hundred degrees of fold on an arm abducted
        past horizontal puts her hand behind her own ear, and that is exactly
        where it went. Wide and low is the other half of the same performance,
        it needs no twist to get right, and it is still legible at thirty metres
        — which the goalpost, being mostly a silhouette detail, would not be.
        """
        return {
            "armU": (-18.0 + 6.0 * q, 0.0, s * (26.0 - 82.0 * q)),
            "armL": (-84.0 + 56.0 * q, 0.0, s * (-8.0 - 6.0 * q)),
            "hand": (-26.0 - 4.0 * q, 0.0, s * 10.0 * q),
        }

    L, R = arm(qL, 1.0), arm(qR, -1.0)
    p = {
        "@root": (0.0, 0.0, 0.0),
        "pelvis": (FIRE_PELVIS, 3.0 * tw, 0.0),
        # Forty degrees of flexion, but stacked at the top of the spine rather
        # than spread evenly down it. Spread evenly it is a lean, and a lean
        # with a straight back is a sprinter in the blocks; two degrees at the
        # waist and seventeen at the chest is the same forty as a *curve*, and
        # the curve is the whole read.
        "spine01": (-2.0, -2.0 * tw, 0.0), "spine02": (-7.0, -4.0 * tw, 0.0),
        "spine03": (-14.0, -6.0 * tw, 0.0), "chest": (-17.0, -9.0 * tw, 0.0),
        # The chin. Forty-four degrees between the two of them against a −40°
        # back, which nets to about four of face *up* out of a body folded well
        # forward — so she is looking at you from under it rather than at the
        # sky, which is where fifty-two degrees put her. The yaw is a quarter
        # cycle behind the shoulders, so the head arrives after the twist rather
        # than with it, and that lag is what makes it a snap.
        "neck": (26.0, 8.0 * tw, 0.0),
        "head": (18.0, 16.0 * (2.0 * _snap(u + 0.25) - 1.0), -7.0 * tw),
        "jaw": (-13.0, 0.0, 0.0),
        # Rolled forward and held there, which is the other half of a hunch: a
        # rounded back with the shoulders still square on top of it is a person
        # with backache.
        "clavicleL": (0.0, 0.0, 10.0 + 9.0 * qL),
        "clavicleR": (0.0, 0.0, -10.0 - 9.0 * qR),
        "legUL": (lo[0], 0.0, -4.0), "legLL": (lo[1], 0.0, 0.0),
        "footL": (lo[2], 0.0, 0.0),
        "legUR": (ro[0], 0.0, 4.0), "legLR": (ro[1], 0.0, 0.0),
        "footR": (ro[2], 0.0, 0.0),
    }
    for tag, side in (("L", L), ("R", R)):
        for b, v in side.items():
            p[b + tag] = v
    return p


FIRE = [(i * FIRE_DUR / FIRE_KEYS, _fire_at(i / FIRE_KEYS))
        for i in range(FIRE_KEYS + 1)]

FIRE_LAND = _fire_at(0.0)        # the three worth a still, for --reskin
FIRE_DRIVE = _fire_at(0.32)
FIRE_HALF = _fire_at(0.5)


# The throw.
#
# A separate one-shot rather than a beat inside the loop, and the reason is
# balance rather than animation: the game has to be able to choose how often she
# throws, because the whole point of the sequence is that you can get on top of
# it with the branch. A fireball welded to the dance fires at whatever tempo the
# dance happens to be, and the tempo of the dance is not a difficulty knob.
#
# Right-handed, over the top, and the wind-up is the half of it that matters. A
# throw with no load in it reads as a shove; the coil is what tells you
# something left her hand hard.
FIRE_CAST_AT = 0.46       # seconds in, where it leaves her — 43-jadrija.js
                          # spawns the ball off this and nothing else

FIRE_COCK = dict(_fire_at(0.0), **{
    # Twisted open to the right and stacked over the back foot, chest turned
    # away from where it is going. Both feet stay down: a step into it would
    # travel her, and she is throwing from a spot.
    "pelvis": (6.0, -16.0, 0.0),
    "spine01": (-4.0, -8.0, 0.0), "spine02": (-5.0, -10.0, 0.0),
    "spine03": (-4.0, -12.0, 0.0), "chest": (-2.0, -14.0, 0.0),
    "neck": (18.0, 10.0, 0.0), "head": (12.0, 22.0, -6.0), "jaw": (-16.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, 4.0), "clavicleR": (0.0, 0.0, -14.0),
    # The right hand back and above the shoulder, elbow leading. The left is out
    # in front, pointed where it is going, which is what a body uses the off arm
    # for and also what tells the player where to look.
    #
    # Abduction is +Z on the *right* and −Z on the left — the two sides mirror in
    # sign, which is the rule everywhere in this file and which the first version
    # of this pose broke. A right shoulder written −84 is not eighty-four degrees
    # of arm thrown out behind her, it is eighty-four degrees of arm folded
    # across her own back, and that is where it went: the throwing arm vanished
    # for the whole wind-up and the clip read as a girl pointing at something.
    "armUR": (40.0, 0.0, 74.0), "armLR": (-92.0, 0.0, 22.0), "handR": (-14.0, 0.0, 0.0),
    "armUL": (-58.0, 0.0, -18.0), "armLL": (-16.0, 0.0, -6.0), "handL": (-16.0, 0.0, 0.0),
    "legUL": (-14.0, 0.0, -4.0), "legLL": (14.0, 0.0, 0.0),
    "footL": (_flat(-14.0, 14.0, 6.0), 0.0, 0.0),
    "legUR": (-30.0, 0.0, 4.0), "legLR": (34.0, 0.0, 0.0),
    "footR": (_flat(-30.0, 34.0, 6.0), 0.0, 0.0),
})

FIRE_THROW = dict(_fire_at(0.0), **{
    # And through it. The trunk unwinds a full thirty degrees the other way, the
    # arm comes over the top, and the head goes with it — everything that was
    # cocked is now spent, which is the only way a throw ever reads.
    "pelvis": (0.0, 14.0, 0.0),
    "spine01": (-8.0, 7.0, 0.0), "spine02": (-13.0, 9.0, 0.0),
    "spine03": (-14.0, 11.0, 0.0), "chest": (-12.0, 13.0, 0.0),
    "neck": (24.0, -8.0, 0.0), "head": (16.0, -14.0, 5.0), "jaw": (-20.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, 14.0), "clavicleR": (0.0, 0.0, -6.0),
    "armUR": (-100.0, 0.0, 26.0), "armLR": (-18.0, 0.0, -6.0), "handR": (-34.0, 0.0, 0.0),
    "armUL": (30.0, 0.0, 18.0), "armLL": (-40.0, 0.0, -8.0), "handL": (-10.0, 0.0, 0.0),
    "legUL": (-34.0, 0.0, -4.0), "legLL": (30.0, 0.0, 0.0),
    "footL": (_flat(-34.0, 30.0, 0.0), 0.0, 0.0),
    "legUR": (-16.0, 0.0, 4.0), "legLR": (16.0, 0.0, 0.0),
    "footR": (_flat(-16.0, 16.0, 0.0), 0.0, 0.0),
})

FIRE_AFTER = dict(FIRE_THROW, **{
    # A tenth of a second later, with the arm carried on down across her body.
    "armUR": (-44.0, 0.0, -20.0), "armLR": (-56.0, 0.0, -18.0), "handR": (-24.0, 0.0, 0.0),
    "armUL": (16.0, 0.0, 24.0), "armLL": (-56.0, 0.0, -14.0),
    "chest": (-8.0, 6.0, 0.0), "head": (22.0, -6.0, 2.0),
})

CAST = [(0.00, _fire_at(0.0)), (0.20, FIRE_COCK), (0.34, FIRE_COCK),
        (FIRE_CAST_AT, FIRE_THROW), (0.58, FIRE_AFTER), (0.78, _fire_at(0.0))]


# And the turn itself: the moment she stops being a nine-year-old in a hose and
# starts being whatever this is.
#
# It is a gather and a fling, in that order, and the gather is what sells it —
# an arch with nothing before it is a stretch. She drops into a crouch with her
# arms pulled in over about a quarter of a second, holds for nothing at all, and
# then throws the whole thing open: head back past the vertical, arms flung down
# and behind her, mouth wide. Then down into the hunch, which is where the loop
# picks her up.
FIRE_GATHER = {
    "@root": (0.0, 0.0, 0.0),
    "pelvis": (-4.0, 0.0, 0.0),
    "spine01": (-12.0, 0.0, 0.0), "spine02": (-15.0, 0.0, 0.0),
    "spine03": (-14.0, 0.0, 0.0), "chest": (-12.0, 0.0, 0.0),
    "neck": (8.0, 0.0, 0.0), "head": (-16.0, 0.0, 0.0), "jaw": (-4.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, 14.0), "clavicleR": (0.0, 0.0, -14.0),
    "armUL": (-46.0, 0.0, 30.0), "armLL": (-118.0, 0.0, -6.0), "handL": (-30.0, 0.0, 0.0),
    "armUR": (-46.0, 0.0, -30.0), "armLR": (-118.0, 0.0, 6.0), "handR": (-30.0, 0.0, 0.0),
    "legUL": (-34.0, 0.0, -4.0), "legLL": (40.0, 0.0, 0.0),
    "footL": (_flat(-34.0, 40.0, -4.0), 0.0, 0.0),
    "legUR": (-34.0, 0.0, 4.0), "legLR": (40.0, 0.0, 0.0),
    "footR": (_flat(-34.0, 40.0, -4.0), 0.0, 0.0),
}

FIRE_OPEN = {
    "@root": (0.0, 0.0, 0.0),
    # Everything the gather folded, thrown open. Twelve degrees of *backward*
    # lean through the spine, which is the only pose in this file that goes that
    # way, and it is the one frame the whole sequence is remembered by.
    "pelvis": (8.0, 0.0, 0.0),
    "spine01": (5.0, 0.0, 0.0), "spine02": (6.0, 0.0, 0.0),
    "spine03": (6.0, 0.0, 0.0), "chest": (7.0, 0.0, 0.0),
    "neck": (22.0, 0.0, 0.0), "head": (26.0, 0.0, 0.0), "jaw": (-22.0, 0.0, 0.0),
    "clavicleL": (0.0, 0.0, -8.0), "clavicleR": (0.0, 0.0, 8.0),
    # Down and behind, palms back — the shape somebody makes when something
    # comes out of them rather than when they reach for something.
    "armUL": (46.0, 0.0, -34.0), "armLL": (-10.0, 0.0, -4.0), "handL": (-34.0, 0.0, 0.0),
    "armUR": (46.0, 0.0, 34.0), "armLR": (-10.0, 0.0, 4.0), "handR": (-34.0, 0.0, 0.0),
    "legUL": (-8.0, 0.0, -5.0), "legLL": (8.0, 0.0, 0.0),
    "footL": (_flat(-8.0, 8.0, 8.0), 0.0, 0.0),
    "legUR": (-8.0, 0.0, 5.0), "legLR": (8.0, 0.0, 0.0),
    "footR": (_flat(-8.0, 8.0, 8.0), 0.0, 0.0),
}

# A *copy* of SOAK_A, not SOAK_A. The floor pass writes `@root` into the poses
# it is given, in place, and handing it the same dict the `soak` clip is built
# from would solve one clip's ground clearance into another one's key.
FLARE = [(0.00, dict(SOAK_A)), (0.26, FIRE_GATHER), (0.52, FIRE_OPEN),
         (0.78, FIRE_OPEN), (1.10, _fire_at(0.0))]


# ── the heart, and the note ─────────────────────────────────────────────────
#
# Two poses she makes with her hands in front of her, and the reason they are
# poses rather than props is the same reason her smile is paint: what she has to
# work with is 28 bones, and the hand end of one arm is `hand` plus `thumb`.
# There is no index finger and no pinky, so the ASL sign and the one-handed
# finger heart are both out — there is nothing to lift.
#
# The two-handed heart does not need them. Its lobes are the *hands*, turned in
# and tipped toward each other, and its point is the two thumbs coming down to
# meet; every one of those is a bone she has. It also reads at a distance, which
# the finger heart would not: it is 25 cm of silhouette rather than 3 cm of
# knuckle, and this is a game played from further away than arm's length.
#
# Both are built on IDLE_A rather than from nothing, which is what keeps her feet
# out of the deck: the legs, the contrapposto and the solved `@root` all come
# along, and the pose is only the half of her above the ribs. No floor pass.
# At her sternum, where a person makes it.

# It went over her head first, on an argument about contrast that turned out to
# be an argument about the wrong thing. The reasoning was sound as far as it
# went: a heart made at the chest is skin-coloured hands round a skin-coloured
# hole in front of a skin-coloured ribcage, and the version held up against the
# sky had a silhouette that carried at fifty metres. What it missed is that a
# silhouette is not the only thing a body has. Both arms hauled up and folded
# back over the skull is not a shape anybody makes, and it read as a contortion
# — which is worse than an illegible gesture, because the thing it legibly says
# is that something has gone wrong with her shoulders.
#
# So: elbows down at the ribs, forearms angled up and in, hands meeting in front
# of the sternum. Fifteen centimetres of shape rather than sixty, which does not
# read from across the promenade — and that is the right trade now, because
# there is a long lens on Z and a card for the far distance. This one is for
# when you have walked up to her.
#
# The Y term on the upper arm is what brings the hands to the middle, and it is
# how an arm reaches its own sternum: the shoulder *rotates*, it does not swing.
# Swinging it puts the elbows in the next parasol.
HEART_A = dict(IDLE_A, **{
    "clavicleL": (0, 0, 4), "clavicleR": (0, 0, -4),
    "armUL": (-18, 16, 26), "armLL": (-86, 0, 8), "handL": (74, 0, 13),
    "armUR": (-18, -16, -26), "armLR": (-86, 0, -8), "handR": (74, 0, -13),
    # And the point of the heart, which is the only thing here the thumbs have
    # ever been asked to do.
    "thumbL": (0, 0, 30), "thumbR": (0, 0, -30),
    "chest": (-2, 0, 0), "neck": (4, 0, 0), "head": (-4, 0, 1),
})

# The breath, and a shade more of it than the idle takes: she is holding
# something up, so the sway is in her shoulders rather than her hips.
HEART_B = dict(HEART_A, **{
    "clavicleL": (0, 0, 6), "clavicleR": (0, 0, -6),
    "armUL": (-21, 16, 25), "armUR": (-21, -16, -25),
    "armLL": (-89, 0, 8), "armLR": (-89, 0, -8),
    "chest": (-6, 0, 0), "neck": (10, 0, 0), "head": (2, 4, 1),
})

# And holding a note up, which is a different shape entirely: hands apart rather
# than together, forearms level, at about the height of her own chin so the card
# does not cover her face. Nothing here has to be accurate — 43-jadrija.js hangs
# the card off wherever the two hand bones actually end up, so the pose decides
# how big the note is rather than the other way round.
NOTE_A = dict(IDLE_A, **{
    "clavicleL": (0, 0, 7), "clavicleR": (0, 0, -7),
    # The flexion lives in the shoulder rather than the elbow, which is what
    # puts the hands out in *front* of her instead of up beside her ears. The
    # first cut had it the other way round and she held the card against her own
    # collarbones, where it would have been drawn inside her chest.
    "armUL": (-46, 14, 24), "armLL": (-52, 0, -8), "handL": (-6, 0, 0),
    "armUR": (-46, -14, -24), "armLR": (-52, 0, 8), "handR": (-6, 0, 0),
    "chest": (-2, 0, 0), "neck": (4, 0, 0), "head": (2, 0, 0),
})

NOTE_B = dict(NOTE_A, **{
    "clavicleL": (0, 0, 8), "clavicleR": (0, 0, -8),
    "armUL": (-49, 14, 23), "armUR": (-49, -14, -23),
    "chest": (-4, 0, 0), "neck": (6, 0, 0), "head": (0, -4, 1),
})


# ── the bottle, and the wrap ─────────────────────────────────────────────────
# Two clips for the one room in this game with a door on it, and both of them
# are the same kind of thing: something a person does with their hands that is
# not a trick and is not for anybody. Everything else in this repertoire is
# performed. These are not, which is most of what makes the room feel like a
# different place from the promenade it is fifteen metres from.
#
# The bottle. She is standing beside the tabouret with it on her right, so this
# is a shoulder that goes forward and an elbow that opens, and the lean is in
# the spine rather than in the hip — she is picking a bottle up, not lifting a
# crate.
#
# These four are the one set of poses in this file that are not free. Since
# `boneTurn` went into 43-jadrija.js the bottle is *in* the hand rather than
# hanging off its position, so where `handR` ends up and which way it is turned
# decide where the bottle is and which way it points — and the bottle has to
# start on a tabouret that does not move, has to end up over a glass that does
# not move, and has to be upright in between. All three numbers are in
# `kabinaKit`; the wrist targets they come to, in metres off the floor she
# stands on and in her own frame (+x in front of her, +y her left, +z up):
#
#     the bottle standing on the stool   0.403  -0.020  0.728  (its foot)
#     so her palm, `BOT.grip` up it      0.403  -0.020  0.913
#     the lip's target over the glass    0.286  -0.062  0.958
#
# The first cut of these poses missed the first of those by 0.52 m — she swung
# her arm *backwards* (on this rig +X on the upper arm swings the far end back,
# and the reach carried +16) while arching her spine away (+9/+10/+8 likewise),
# and the bottle then slid half a metre through the air into a hand that had
# never gone to it. Every angle below was solved against the numbers above and
# then looked at; `--probe` prints where a pose actually puts the wrist, and
# that is the only thing worth arguing with.
#
# 0.40 m in front of her at hip height is past the end of a 0.47 m arm hanging
# off an upright spine, so the lean is real: about thirty degrees of it, spread
# down the spine rather than folded at one joint. She is bending to a stool.
WINE_REACH = dict(IDLE_A, **{
    "spine02": (-14.5, 0, 1.0), "spine03": (-12.5, 0, 0.5),
    "chest": (-7, 0, 0), "neck": (8, 0, 0), "head": (-6, -4, 1),
    "clavicleR": (0, 0, -3),
    "armUR": (-60, -16, -39),
    "armLR": (-14 + STAND_ELBOW_UNDO, -5, -13), "handR": (28, 1, 6),
})

# Closed on it. The elbow comes in a little as the hand takes the weight, which
# is the whole of what makes a grasp read as a grasp rather than as a touch —
# and the wrist does not move, because the wrist is now the bottle's attitude
# and a bottle still standing on a stool is not tipping.
WINE_HOLD = dict(WINE_REACH, **{
    "spine02": (-13, 0, 1.0), "spine03": (-11, 0, 0.5),
    "armUR": (-57, -16, -39),
    "armLR": (-18 + STAND_ELBOW_UNDO, -5, -13), "handR": (28, 1, 6),
})

# Lifted clear of the stool, upright, and — this is the part that changed —
# still over the stool rather than parked at her hip.
#
# The glass is 0.128 m from where the bottle stands, on the same stool. A hand
# that takes the bottle at 0.397 in front of her and pours at 0.394 has moved
# it three centimetres; the first cut of this pose sent it 0.245 m out to her
# right hip first and then 0.213 m back again, which is 0.37 m of travel spent
# arriving where it started. That is not a beat, it is a detour, and a detour
# is half of what "totally awkward" was pointing at.
#
# So it is now a lift: 0.12 m straight up off the stool and a hand's width in
# towards her, upright, and on the way to the glass rather than away from it.
# It still holds for half a second, because a bottle that comes off a stool and
# starts pouring in the same movement is a bottle nobody picked up.
WINE_LIFT = dict(IDLE_A, **{
    "spine02": (2, 0, 1.0), "spine03": (2, 0, 0.5), "chest": (2, 0, 0),
    "neck": (-2, 0, 0), "head": (-10, -6, 1),
    "clavicleR": (0, 0, -5.7),
    "armUR": (-37.9, -7.6, -25.5),
    "armLR": (-21.6 + STAND_ELBOW_UNDO, 4.5, -16.7), "handR": (43.1, 18.2, 2.3),
    # The left arm is the one doing nothing, so it is the idle's arm with the
    # two degrees of the lift's own lean on the shoulder. Absolutes here kept
    # the A-pose in the one clip where she is standing still for five seconds
    # with a bottle in the other hand and nothing else to look at.
    "armUL": (-8, 0, STAND_ARM_IN - 2),
    "armLL": (-16 + STAND_ELBOW_UNDO, 0, STAND_FORE_IN),
})

# And the pour, which used to be a swig.
#
# She drank out of the bottle for two versions and it never once looked like
# drinking. The reason is not in this file: 43-jadrija.js aims the bottle from
# wherever her hand ends up at a target, and when the target is her mouth every
# centimetre the aim is out lands 30 cm of glass somewhere on her face. A mouth
# is a moving 3 cm target on a bone that is really the atlas, and it moves most
# in exactly the frames a person tips their head back.
#
# The glass on the stool does not move, is not part of her, and is 0.34 m
# straight out in front of where she stands. So the aim has a fixed target and
# this pose only has to hold her hand somewhere above and behind it — a quarter
# of a metre up, roughly on her own midline, which is where a hand goes when
# the thing being poured into is on a stool by your knee.
#
# Which means the trunk does the work rather than the shoulder: she leans in
# over it, and the head goes with the lean because a person pouring looks at
# what they are pouring into.
#
# And then it needs one more thing that no amount of leaning gives you, which
# is where the second cut of these poses came from.
#
# 43-jadrija.js turns the bottle off the axis her wrist is holding it on by the
# smallest rotation that puts the lip over the glass. That correction is a
# *safety net*: when the pose is right it does nothing. The first cut of this
# pose left the bottle at 52° from vertical while the glass sat 110° away from
# the hand, so the net did 87° of work on every frame of the pour — the bottle
# swung a right angle out of her grip the instant `pour` started to ramp, held
# there for a second, and swung back. That is the whole of "the wine bottle
# gets lodged in her hand": it was not a bad frame, it was a hinge.
#
# The three below were solved against the glass rather than against a feeling,
# with the lip hung on the target, and with one term the first pass did not
# have: the closest approach between the bottle and her forearm. A bottle is
# 77 mm across, a forearm about 70, and the grip point sits 44 mm off the wrist
# joint — so an axis lying along the forearm, parallel or anti-parallel, buries
# half the bottle in her arm, and nothing else in the measurement can see it,
# because a bottle is a solid of revolution and spinning it changes no number.
# See plan/wine-pour-wip/solve.py, `seg_gap`.
#
# What comes out is a pour that is three keys and one movement: the hand parks
# over the glass once and then only the wrist turns.
#
#     WINE_TIP     tilt  46°   lip 0.147 above the glass, not yet pouring
#     WINE_POUR    tilt 116°   lip on the glass, aim correction 1.1 cm
#     WINE_POUR_B  tilt 123°   the same, 14 mm higher, as the glass fills
#
# The hand moves 15 mm across all three. Everything the eye reads as the pour
# is the wrist rolling over, which is what a wrist does and what a shoulder
# swinging a bottle across a room does not.

# The bottle arrives over the glass, tipped but not yet pouring. This is the
# key that separates the travel from the turn: the arm has finished moving here
# and has not started tipping, and splitting those two is most of why the clip
# now reads as deliberate rather than as one continuous lurch.
WINE_TIP = dict(WINE_LIFT, **{
    "spine02": (-2.0, 0, 1.0), "spine03": (-0.8, 0, 0.5), "chest": (-5.2, 0, 0),
    "neck": (-4, 0, 0), "head": (-17, -5, 1),
    "clavicleR": (0, 0, 0.5),
    "armUR": (-45.5, -23.5, -11.0),
    "armLR": (-34 + STAND_ELBOW_UNDO, -1.3, -18.0), "handR": (-11.1, 23.4, 4.1),
})

# Pouring. Her palm lands 0.394 in front of her, a thumb's width right of her
# own midline and 1.012 up; the bottle's own axis puts its lip within 11 mm of
# the target over the glass, so the runtime aim has 11 mm left to do and the
# hand slides 9 mm down the bottle. Both are inside the width of the label.
#
# `kabinaKit` puts the glass and her standing mark where they have to be for
# that to be a pour — the glass 0.30 ahead of her and a hand's width right, its
# rim 0.95 up — and those numbers travel together. Move one and the bottle
# pours past the glass.
WINE_POUR = dict(WINE_LIFT, **{
    "spine02": (-2.4, 0, 1.0), "spine03": (-6.6, 0, 0.5), "chest": (-12, 0, 0),
    "neck": (-6, 0, 0), "head": (-22, -4, 1),
    "clavicleR": (0, 0, 4),
    "armUR": (-46.0, -29.3, -6.7),
    "armLR": (-34 + STAND_ELBOW_UNDO, -27.7, -11.4), "handR": (-40, 23.6, 53.9),
})

# And a second one, seven degrees further over and fourteen millimetres higher.
#
# A pour is held for a second and a bit, which at 30 fps is forty frames of a
# pose that does not change — and a still frame held for forty frames is the
# one thing an eye is certain about. So the hold drifts: the bottle tips a
# little further as the glass fills and the hand comes up with it, which is
# what a hand does, and it is small enough that nobody will ever name it.
WINE_POUR_B = dict(WINE_POUR, **{
    "spine02": (-1.7, 0, 1.0), "spine03": (-7.3, 0, 0.5),
    "head": (-24, -4, 1),
    "armUR": (-47.9, -34, -1.8),
    "armLR": (-34 + STAND_ELBOW_UNDO, -40.6, -10.4), "handR": (-40, 35.0, 55),
})

# And the wrap. Both hands to the knot at her hip, a tug, and then away —
# the hands drop rather than being put anywhere, because what she is doing is
# letting go of it. The scarf itself is not skinned and never was: the game
# stops drawing the one she is wearing on the frame this reaches the tug, and
# starts drawing one on the floor. Which is the right way round for a thing
# that spends four seconds falling and the rest of the afternoon lying there.
UNTIE_A = dict(IDLE_A, **{
    "spine03": (2, 0, 0.5), "chest": (2, 0, 0), "neck": (-3, 0, 0),
    "head": (-13, -6, 1),
    "clavicleL": (0, 0, 3), "clavicleR": (0, 0, -3),
    "armUL": (-32, 10, 18), "armLL": (-64, 0, 6), "handL": (-16, 0, 10),
    "armUR": (-32, -10, -18), "armLR": (-64, 0, -6), "handR": (-16, 0, -10),
})

UNTIE_B = dict(UNTIE_A, **{
    "chest": (5, 0, 0), "head": (-17, -4, 1),
    "armLL": (-76, 0, 6), "armLR": (-76, 0, -6),
    "handL": (-26, 0, 16), "handR": (-26, 0, -16),
})

# Hands opening and coming away, and she straightens up as they go.
#
# This is the last key before the clip returns to `IDLE_A`, so its arms are
# written as offsets off the idle's for the same reason a landing approach is
# flown at the runway's heading: it has seven tenths of a second to get there.
# As absolutes it was 4.8 cm outboard of the shoulders with 72° in the elbow,
# which is a fine shape on its own and a lurch when the next key is not.
UNTIE_C = dict(IDLE_A, **{
    "clavicleL": (0, 0, 2), "clavicleR": (0, 0, -2),
    "armUL": (-14, 6, STAND_ARM_IN - 4),
    "armLL": (-26 + STAND_ELBOW_UNDO, 0, STAND_FORE_IN), "handL": (-2, 0, 8),
    "armUR": (-14, -6, -(STAND_ARM_IN - 4)),
    "armLR": (-26 + STAND_ELBOW_UNDO, 0, -STAND_FORE_IN), "handR": (-2, 0, -8),
    "chest": (-2, 0, 0), "neck": (3, 0, 0), "head": (1, 2, 1),
})


# ── the swim ────────────────────────────────────────────────────────────────
#
# The only clip on this rig that is not authored standing up.
#
# It exists because of the chase out to the skakaonica — src/61-chase.js — and
# the first attempt at that built a purpose-made swimmer out of scaled spheres
# rather than using her, on the argument that what you see of somebody ten
# metres ahead of you in the water is a back and two arms. That was true and it
# was still the wrong call: she is the same person who is standing on the
# terrace when you walk up to her, and a second, cruder version of her swimming
# past is exactly the seam this project spends its time not having.
#
# So: prone. `pelvis` at −90 lays the whole figure out flat, face down, which is
# the same trick `FOURS` uses to get her on to all fours; everything below is
# then written relative to a body that is already horizontal, and the game lays
# her on the water and leaves the clip alone.
#
# The arm angle is the whole clip. `armU` x runs from about −165 at the catch —
# stretched out past her head — through −100 under the chest to −28 at the hip,
# and then the recovery takes it back the way it came with `armU` z swung 60-odd
# degrees out so the elbow comes over the top rather than dragging through her
# own ribs. Not past −170: the Euler is nose-first and −180 is where it gimbals.
SWIM_BASE = {
    "@root": (0.000, 0.000, -0.86),
    "pelvis": (-90, 0, 0),
    "spine01": (2, 0, 0), "spine02": (2, 0, 0), "spine03": (1, 0, 0),
    "chest": (2, 0, 0), "neck": (8, 0, 0), "head": (4, 0, 0),
    "clavicleL": (0, 0, 5), "clavicleR": (0, 0, -5),
    "legUL": (0, 0, 3), "legLL": (8, 0, 0), "footL": (-24, 0, 0),
    "legUR": (0, 0, -3), "legLR": (8, 0, 0), "footR": (-24, 0, 0),
}


def _swim(roll, breath, L, R, kick):
    """One key of the crawl.

    `L` and `R` are (upper-arm pitch, upper-arm swing out, elbow, wrist), both
    written with a *positive* swing and mirrored here, the way every other
    two-sided pose in this file is. `kick` is the left leg's angle; the right
    gets the opposite, because that is what a flutter is.
    """
    p = dict(SWIM_BASE)
    p["pelvis"] = (-90, 0, roll)
    p["spine01"] = (2, 0, roll * 0.35)
    p["spine02"] = (2, 0, roll * 0.30)
    p["chest"] = (2, 0, roll * 0.28)
    p["neck"] = (8, breath * 0.35, 0)
    p["head"] = (4, breath, roll * 0.20)
    p["armUL"] = (L[0], 0, L[1]); p["armLL"] = (L[2], 0, 4)
    p["handL"] = (L[3], 0, 0)
    p["armUR"] = (R[0], 0, -R[1]); p["armLR"] = (R[2], 0, -4)
    p["handR"] = (R[3], 0, 0)
    # A knee is loose behind the hip on the down-beat and straight on the up,
    # which is the lag that makes a flutter read as a kick rather than as a
    # pair of scissors.
    p["legUL"] = (kick, 0, 3); p["legLL"] = (max(0.0, kick) * 1.6 + 6, 0, 0)
    p["legUR"] = (-kick, 0, -3); p["legLR"] = (max(0.0, -kick) * 1.6 + 6, 0, 0)
    return p


# Her right hand has just gone in and is stretched out ahead; her left is
# finishing at the hip. Rolled on to the right, which is the side the pulling
# arm is on.
SWIM_A = _swim(-17, 0, L=(-28, 18, -22, -8), R=(-163, 8, -8, 0), kick=15)
# Right hand under the chest with the elbow high; left coming over the top.
SWIM_B = _swim(9, 0, L=(-112, 66, -80, -12), R=(-100, 12, -74, -8), kick=-15)
# The mirror, and the breath: she takes it to the left, on the roll, which is
# the only way anybody has ever taken one.
SWIM_C = _swim(17, 54, L=(-163, 8, -8, 0), R=(-28, 18, -22, -8), kick=15)
SWIM_D = _swim(-9, 12, L=(-100, 12, -74, -8), R=(-112, 66, -80, -12), kick=-15)

# And treading water, for the ten seconds at the end of the race when she has
# stopped and turned round. Upright — the body comes up to about forty degrees
# off vertical — with the forearms sculling out in front and the legs doing the
# slow circle everybody does without being taught it.
TREAD_A = {
    "@root": (0.000, 0.000, -0.30),
    "pelvis": (-34, 0, 4),
    "spine01": (4, 0, 0), "spine02": (4, 0, 0), "spine03": (2, 0, 0),
    "chest": (3, 0, 0), "neck": (-14, 0, 0), "head": (-24, -6, 0),
    "clavicleL": (0, 0, 6), "clavicleR": (0, 0, -6),
    "armUL": (-64, 0, 30), "armLL": (-72, 0, 10), "handL": (-12, 0, 14),
    "armUR": (-64, 0, -30), "armLR": (-72, 0, -10), "handR": (-12, 0, -14),
    "legUL": (-58, 0, 16), "legLL": (66, 0, 0), "footL": (-14, 0, 0),
    "legUR": (-30, 0, -12), "legLR": (94, 0, 0), "footR": (-14, 0, 0),
}
TREAD_B = dict(TREAD_A, **{
    "pelvis": (-34, 0, -4),
    "head": (-24, 6, 0),
    "armUL": (-58, 0, 22), "armLL": (-58, 0, 6), "handL": (-6, 0, -10),
    "armUR": (-58, 0, -22), "armLR": (-58, 0, -6), "handR": (-6, 0, 10),
    "legUL": (-30, 0, 12), "legLL": (94, 0, 0),
    "legUR": (-58, 0, -16), "legLR": (66, 0, 0),
})

CLIPS = [
    {"name": "idle", "loop": True,
     "keys": [(0.0, IDLE_A), (2.3, IDLE_B), (4.6, IDLE_A)]},
    {"name": "wave", "loop": False,
     "keys": [(0.0, IDLE_A), (0.5, WAVE_UP), (0.85, WAVE_OUT), (1.2, WAVE_UP),
              (1.55, WAVE_OUT), (1.9, WAVE_UP), (2.5, IDLE_A)]},
    {"name": "notice", "loop": False,
     "keys": [(0.0, IDLE_A), (0.30, NOTICE), (1.05, NOTICE), (1.45, IDLE_A)]},
    # Down onto all fours. Through the half-kneel, because that is the way down
    # as well as the way up and reusing it costs nothing.
    {"name": "kneel", "loop": False,
     "keys": [(0.0, IDLE_A), (0.45, LUNGE), (0.80, KNEEL), (1.15, FOURS)]},
    {"name": "crawl", "loop": True,
     "keys": [(0.0, CRAWL_A), (0.55, CRAWL_B), (1.10, CRAWL_A)]},
    {"name": "getup", "loop": False,
     "keys": [(0.0, FOURS), (0.40, KNEEL), (0.85, LUNGE), (1.45, IDLE_A)]},
    {"name": "flip", "loop": False,
     "keys": [(0.00, IDLE_A), (0.24, CROUCH), (0.40, LAUNCH),
              (0.56, _tuck(-118, 0.40)), (0.72, _tuck(-232, 0.47)),
              (0.88, _tuck(-318, 0.28)), (1.04, LAND), (1.40, SETTLE)]},
    # Her gait. `skip` was here and is not any more, for the reason written out
    # above the walk: it was a burst being asked to be a default, and it read as
    # a tic because that is what a flourish becomes when it is the only one you
    # have. The clip is still authored, `skip_floor` still solves it, and every
    # number in it is still the verified one — what came out is the single line
    # that put it in the payload, which is also what puts it back.
    {"name": "walk", "loop": True,
     "keys": WALK},
    # The chase. 1.4 s a cycle is about 43 strokes a minute, which is a steady
    # distance crawl rather than a sprint — she is swimming 85 m and she knows
    # it. Looping, because it is the whole of what she does for a minute.
    {"name": "swim", "loop": True,
     "keys": [(0.00, SWIM_A), (0.35, SWIM_B), (0.70, SWIM_C),
              (1.05, SWIM_D), (1.40, SWIM_A)]},
    {"name": "tread", "loop": True,
     "keys": [(0.0, TREAD_A), (0.95, TREAD_B), (1.90, TREAD_A)]},
    # One-shot, like the somersault and for the same reason: the game chains
    # two or three of them by rewinding `curT`, which is cheaper than a loop
    # and lets it stop after any whole number of wheels.
    {"name": "cartwheel", "loop": False, "keys": WHEEL},
    # Looping, because it is a state and not an event: she holds it for as long
    # as the water is on her, which is however long you feel like keeping it
    # there.
    {"name": "soak", "loop": True,
     "keys": [(0.0, SOAK_A), (0.70, SOAK_B), (1.40, SOAK_A)]},
    # Both of these loop and both are held for as long as the game feels like
    # holding them, which is what makes them dances rather than tricks: the
    # somersault and the cartwheel are events that end, these are things she is
    # doing until she stops.
    {"name": "shimmy", "loop": True, "keys": SHIMMY},
    {"name": "twerk", "loop": True, "keys": TWERK},
    # `moonwalk` was here and is not any more. The move is still authored above,
    # MOON and all, and `dance_floor` still solves it — what was taken out is the
    # one line that put it in the payload. It was the only thing in the
    # repertoire that had to be sold by an illusion rather than by a pose, and a
    # glide is sold or it is not: the anchor foot has to be still to the degree,
    # and a rig with no toe roll running a clip resampled to sixteen keys cannot
    # hold that. Putting it back is this line.
    # And the two she makes with her hands, which are held for as long as the
    # game feels like holding them, so both loop for the shimmy's reason.
    {"name": "heart", "loop": True,
     "keys": [(0.0, HEART_A), (1.5, HEART_B), (3.0, HEART_A)]},
    {"name": "note", "loop": True,
     "keys": [(0.0, NOTE_A), (1.7, NOTE_B), (3.4, NOTE_A)]},
    # And the turn. Three clips rather than one because they are three different
    # kinds of thing: `flare` happens to her once, `firestarter` is what she is
    # until something stops it, and `cast` is an event the game fires off inside
    # that state whenever it decides she should throw.
    # The two indoor ones. Both one-shots and both slow — nothing in this room
    # happens at the speed anything on the promenade happens at, and that is
    # the point of the room.
    # The wine, in twelve keys rather than nine, and every one of the three new
    # ones is at a place where something changes direction.
    #
    # It used to go idle, reach, hold, lift, pour, pour, lift, hold, reach,
    # idle — which reads as a list and moved like one. Two keys of the same
    # pose 1.1 s apart is a freeze, and `WINE_LIFT` straight into `WINE_POUR`
    # is a hand crossing 0.21 m while the wrist turns 112°, so the arm and the
    # wrist were doing their work in the same half second and neither of them
    # was legible.
    #
    # Now the travel and the turn are separated — `WINE_TIP` is the hand
    # arriving with the bottle still up, and the two pour keys are the wrist
    # rolling over with the hand parked — and the hold in the middle drifts
    # instead of freezing. `wineAt` in src/43-jadrija.js carries the two
    # windows that ride on these times and they have to move together: `held`
    # ramps across 1.10-1.45 and back over 4.40-4.70, `pour` across 2.05-2.55
    # and back over 3.20-3.60, which is key to key in both directions.
    {"name": "wine", "loop": False,
     "keys": [(0.00, IDLE_A), (0.55, WINE_REACH), (1.05, WINE_HOLD),
              (1.50, WINE_LIFT), (2.05, WINE_TIP), (2.55, WINE_POUR),
              (3.20, WINE_POUR_B), (3.60, WINE_TIP), (4.00, WINE_LIFT),
              (4.40, WINE_HOLD), (4.60, WINE_REACH), (5.05, IDLE_A)]},
    {"name": "untie", "loop": False,
     "keys": [(0.00, IDLE_A), (0.60, UNTIE_A), (1.05, UNTIE_B),
              (1.35, UNTIE_B), (1.85, UNTIE_C), (2.55, IDLE_A)]},
    # And the third indoor one, which is the room's answer to the hose. Two
    # clips for the reason `flare` and `firestarter` are two: the way down
    # happens to her once and takes a second and a half, and what she is at the
    # bottom of it she stays until something else happens.
    {"name": "submit", "loop": False,
     "keys": [(0.00, IDLE_A), (0.55, LUNGE), (1.00, KNEEL),
              (1.55, KNEEL_BACK)]},
    {"name": "kept", "loop": True,
     "keys": [(0.0, KNEEL_BACK), (2.2, KNEEL_BACK_B), (4.4, KNEEL_BACK)]},
    # And going somewhere on them, at 0.40 m/s — 1.2 s a cycle, two half
    # strides, which is a knee and about 24 cm each. `SHOW.creep` in
    # 43-jadrija.js is that number and the two have to move together or she
    # skates.
    {"name": "knees", "loop": True,
     "keys": [(0.0, KNEE_A), (0.6, KNEE_B), (1.2, KNEE_A)]},
    {"name": "flare", "loop": False, "keys": FLARE},
    {"name": "firestarter", "loop": True, "keys": FIRE},
    {"name": "cast", "loop": False, "keys": CAST},
]


VIEWS = {
    "front": (0.0, 4.0, 0.95, 4.2, 760, 1120),
    "side": (90.0, 4.0, 0.95, 4.2, 760, 1120),
    "hero": (34.0, 8.0, 0.95, 3.9, 760, 1120),
    # Chest and hands, close. Everything she does with her hands in front of her
    # — the heart, the note — is 30 cm of pose on a 1.7 m figure, and "front" at
    # 4.2 m renders it about forty pixels across.
    "hands": (6.0, 8.0, 1.34, 1.35, 900, 900),
    # The back of her left hand, close enough to count the nails.
    #
    # Every other entry in this table looks at the midline, which is right for a
    # face and useless for a hand hanging half a metre out to the side, so this
    # one carries its own (x, y) target — the two extra numbers on the end. The
    # angle is not arbitrary either: it is 15° off the nail normal measured from
    # the finger markers, because a nail seen edge-on is four pixels.
    "nails": (58.0, 22.0, 1.005, 0.30, 900, 900, 0.283, 0.500),
    # The wrap, from the front and from the side she ties it on.
    "hips": (18.0, 6.0, 0.880, 1.55, 820, 900),
    "hipside": (96.0, 5.0, 0.880, 1.55, 820, 900),
    # There is deliberately no view here for the perineum, and it is worth
    # saying why rather than leaving the gap to look like an oversight. Every
    # camera in this table renders `post_preview`, which lays on the nails, the
    # wrap *and* the perineum — and the wrap spans z 0.828 to 0.960, so it
    # covers the thing completely. Blender cannot show this one at all. It is
    # checked two other ways instead: by decoding the shipped blob for the
    # fifteen vertices at full colour, and in the browser after the turn, which
    # is the only state the game ever draws it in anyway.
    "face": (2.0, 2.0, 1.612, 0.46, 900, 900),
    "head": (30.0, 5.0, 1.615, 0.52, 900, 900),
    "prof": (88.0, 2.0, 1.615, 0.50, 900, 900),
    # Azimuth 0 is in front of her, since her forward is +X — so these two are
    # the only views that show the back of the head, which is where all of the
    # hair is.
    "nape": (176.0, 6.0, 1.600, 0.60, 900, 900),
    # Both ankles at once, from a little above — which is roughly the angle you
    # look down at somebody's feet from, and the only view in this table where
    # anything below the knee is more than forty pixels tall.
    "feet": (38.0, 16.0, 0.170, 1.60, 900, 700),
    "rear": (156.0, 9.0, 1.150, 2.30, 760, 1120),
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
    for name, energy, rot in (("key", 4.0, (56, 0, 40)),
                              ("fill", 1.1, (72, 0, -110)),
                              ("rim", 2.4, (78, 0, 190))):
        d = bpy.data.lights.new(name, "SUN")
        d.energy = energy
        d.angle = math.radians(6.0)
        ob = bpy.data.objects.new(name, d)
        ob.rotation_euler = tuple(math.radians(a) for a in rot)
        bpy.context.collection.objects.link(ob)
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.20, 0.21, 0.23, 1)
    bpy.context.scene.world = w


NO_RENDER = False


def render(tag, names):
    # A full rebuild is the only way to repopulate the base colours, and a full
    # rebuild renders eight EEVEE frames on its way past. When the reason for
    # the rebuild is the *export* — as it is when a paint bug has to be flushed
    # out of the blend — those frames are five minutes of pictures nobody is
    # going to open.
    if NO_RENDER:
        print("[mh] render %s: skipped (--norender)" % tag)
        return
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_gtao = True
    sc.eevee.gtao_distance = 0.20
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 85
    cam = bpy.data.objects.new("cam", cam_d)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    for name in names:
        v = VIEWS[name]
        az, el, tz, rad, rx, ry = v[:6]
        # Six numbers means the midline; eight carries its own (x, y) target.
        tgt = Vector((v[6], v[7], tz)) if len(v) > 6 else Vector((0.0, 0.0, tz))
        a, e = math.radians(az), math.radians(el)
        cam.location = tgt + Vector((math.cos(a) * math.cos(e) * rad,
                                     math.sin(a) * math.cos(e) * rad,
                                     math.sin(e) * rad))
        d = tgt - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        sc.render.resolution_x, sc.render.resolution_y = rx, ry
        sc.render.filepath = "%s_%s_%s.png" % (PREVIEW, tag, name)
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


# --------------------------------------------------------------------------- #

def main():
    global NO_RENDER, BODY_OVERRIDE, SKIN_OUT, BLEND, NO_TAIL, NO_SEPTUM
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    NO_RENDER = "--norender" in argv
    # A different mesh, a different skin and a different .blend, so that baking
    # Chloe cannot quietly overwrite the figure eight bathers and Baye are
    # built from. All three move together or none of them do.
    if "--body" in argv:
        BODY_OVERRIDE = Path(argv[argv.index("--body") + 1])
        if not BODY_OVERRIDE.exists():
            sys.exit("[mh] no such body %s" % BODY_OVERRIDE)
    if "--out" in argv:
        SKIN_OUT = Path(argv[argv.index("--out") + 1])
    if "--blend" in argv:
        BLEND = Path(argv[argv.index("--blend") + 1])
    NO_TAIL = "--notail" in argv
    NO_SEPTUM = "--noseptum" in argv
    levels = SUBSURF
    if "--sub" in argv:
        levels = int(argv[argv.index("--sub") + 1])

    # Everything above the export is deterministic and slow — a download, a
    # subsurf, a paint pass over a hundred thousand vertices and eight EEVEE
    # renders — and none of it changes when the thing being fixed is the shape
    # of the blob at the end. `--reexport` opens the saved .blend and does the
    # last step only, which turns a five-minute round trip into a five-second
    # one for every question about the export itself.
    if "--reexport" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body = bpy.data.objects["human"]
        export_static(body, ROOT / "build" / "payload" / "human.fr3d.gz")
        return

    # The same fast path for the skinned blob, and — because the whole point of
    # clips is that they get iterated on — an optional render of any authored
    # pose so the angles can be *looked at* rather than reasoned about.
    # Re-run the bind on the saved blend and save it back. Weighting is the one
    # slow step that is not the mesh, so it gets its own door.
    if "--rebind" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        skin(body, rig)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] rebound %s" % BLEND)
        return

    # The joined geometry — hair and anklets — is added to a finished mesh, so
    # it has to be followed by a re-bind (the new vertices have no groups) and a
    # re-export. That is two of the three slow steps and none of the download,
    # the subsurf or the renders, which is the difference between iterating on
    # the shape of a ponytail and not iterating on it.
    #
    # `--hair` still works and means the same thing. It was the name when hair
    # was all there was, and it is in enough shell history to be worth keeping.
    if "--extras" in argv or "--hair" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        J, _scale, _drop = read_joints(fetch())
        extras(body, J)
        skin(body, rig)
        paint(body, cutters(J))
        _material(body)
        _lights()
        pose(rig, {})
        render("extras", ("nape", "prof", "rear", "feet"))
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] extras rebuilt in %s" % BLEND)
        return

    # The face, which is paint and weights and no geometry at all.
    #
    # Everything that makes a head read at twenty metres on this figure is a
    # vertex colour laid down through a cutter — eyes, brows, lashes, mouth —
    # and none of that survives a `--reskin`, because paint is baked into the
    # blend and `--reskin` only re-poses and re-exports. A full run to move a
    # mouth corner two millimetres is four minutes of download, subsurf and
    # renders to reach a pass that takes forty seconds.
    #
    # The bind goes with it rather than getting a door of its own, because the
    # two things that changed together here — a lash line and a jaw that can
    # open without taking the skull with it — are one paint change and one
    # weight change, and running half of that is how you end up looking at a
    # render and drawing a conclusion about the wrong half.
    # Paint and export, and not one pixel of render.
    #
    # `--reface` is ten EEVEE frames at thirty to sixty seconds each, which is
    # five to nine minutes of a run whose useful work — re-weight, re-paint,
    # re-export — is under a minute. That trade is right when the thing being
    # changed is a face, because a face is only knowable from a render. It is
    # exactly wrong when the change is a number that will be judged in the game
    # instead: every colour and every millimetre settled here in the last few
    # rounds was settled from a headless browser screenshot, and the Blender
    # previews were overexposed by two stops and actively misleading about all
    # of them.
    # Give the existing blend the base colours that `paint` resets from.
    #
    # ── the first version of this, and why it made things worse ──────────────
    #
    # It snapshotted `mark`/`prev` as they stood, correcting only vertices
    # wearing a hand-maintained tuple of *retired* palette colours. That works
    # exactly once, for the colours you remember to list. What it actually did
    # was promote the paint that was on her at that moment to the status of
    # ground truth: 406 vertices of the near-black scarf lining became the base,
    # deleting the lining's cutter the next release changed nothing at all, and
    # `paint` faithfully restored a dark patch across her hips on every run
    # afterwards. A stranded colour had been turned into a permanent one, by the
    # very pass whose docstring promises nothing can be stranded again.
    #
    # ── what the base actually is ────────────────────────────────────────────
    #
    # The figure with no cutters. Not "the figure as last painted, minus the
    # mistakes I can name".
    #
    # On the body shell that is skin, flat, with no exceptions: every non-skin
    # thing on her body — lips, areolae, brows, the lot — is drawn by a cutter
    # in `cutters(J)` and redrawn from scratch on every run, so resetting the
    # shell to skin loses nothing that is not immediately repainted. The loose
    # shells are the exceptions and the only ones: the eyeballs, lashes, teeth
    # and tongue arrive as their own objects, and the hair, anklets and septum
    # are coloured in `extras`; no cutter touches any of them, so they keep what
    # they have.
    #
    # That is the same split `skin` already makes — biggest island is the body,
    # everything else is loose — and it needs no palette bookkeeping, so it
    # cannot rot the way the retired-colour list rotted. Re-runnable by
    # construction: run it whenever the reset looks untrustworthy.
    if "--rebase" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        J, _scale, _drop = read_joints(fetch())
        me = body.data
        for n in ("baseM", "baseP"):
            if n in me.color_attributes:
                me.color_attributes.remove(me.color_attributes[n])
        for n in ("baseM", "baseP"):
            me.color_attributes.new(n, "FLOAT_COLOR", "POINT")
        a_m = me.color_attributes["mark"]
        a_p = me.color_attributes["prev"]
        a_bm = me.color_attributes["baseM"]
        a_bp = me.color_attributes["baseP"]
        lab, sizes = islands(me)
        shell = max(range(len(sizes)), key=lambda i: sizes[i])
        stripped = 0
        for i in range(len(me.vertices)):
            if lab[i] == shell:
                c = tuple(a_p.data[i].color)[:3]
                if any(abs(c[k] - SKIN_P[k]) > 0.004 for k in range(3)):
                    stripped += 1
                a_bm.data[i].color = (*SKIN_M, 1.0)
                a_bp.data[i].color = (*SKIN_P, 1.0)
            else:
                a_bm.data[i].color = a_m.data[i].color
                a_bp.data[i].color = a_p.data[i].color
        print("[mh] rebase: body shell %d verts (%d were not skin, now are), "
              "%d loose verts keep their colour"
              % (sizes[shell], stripped, len(me.vertices) - sizes[shell]))
        paint(body, cutters(J))
        _material(body)
        pose(rig, {})
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS, J=J)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] rebased %s" % BLEND)
        return

    if "--repaint" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        J, _scale, _drop = read_joints(fetch())
        skin(body, rig)
        paint(body, cutters(J))
        _material(body)
        pose(rig, {})
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS, J=J)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] repainted %s" % BLEND)
        return

    if "--reface" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        J, _scale, _drop = read_joints(fetch())
        skin(body, rig)
        paint(body, cutters(J))
        _material(body)
        _lights()
        pose(rig, {})
        post_preview(J, body)
        render("face", ("face", "head", "prof", "nails"))
        # The jaw on its own, so the head stays where the close cameras are
        # pointed. The soaked pose leans 26° forward and takes her face clean
        # out of a frame that is 130 mm across — the first attempt at this
        # rendered her shoulder three times.
        pose(rig, {"jaw": (-13, 0, 0)})
        render("gape", ("face", "head", "prof"))
        pose(rig, SOAK_B)
        render("soak", ("hero", "side", "front"))
        pose(rig, {})
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
        print("[mh] refaced %s" % BLEND)
        return

    # Just the laid-on geometry — nails, wrap, bracelet: rebuild the preview
    # object and take the three close renders that show them. No paint, no
    # export, under a minute. These are all small features on a 1.7 m figure and
    # getting one right is half a dozen looks, which through `--reface` would be
    # half an hour of re-rendering a face that did not change.
    if "--trinkets" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        J, _scale, _drop = read_joints(fetch())
        _lights()
        pose(rig, {})
        post_preview(J, body)
        render("trinket", ("nails", "hips", "hipside"))
        return

    # Where the hands actually end up, in metres, and nothing else.
    #
    # A render is five minutes, so an argument about a shoulder settled by
    # looking at renders is five minutes a guess — and the three that went into
    # getting the hands behind her back were all of them arguments about which
    # way a rotation goes, which is a question a number answers and a picture
    # does not.
    #
    # **+X is in front of her, +Y is her LEFT, +Z is up.** This said the
    # opposite for a month — −Y in front and ±X out to the sides — and it is
    # wrong twice over. Two independent checks, since a comment has now lied
    # about it once: the rest pose puts both feet at y = ±0.231 and both hands
    # at x = +0.185, and `kabinaKit` in src/43-jadrija.js quotes this probe's
    # own output for `WINE_POUR` as 0.32 in front and 0.09 to her right, which
    # is what comes out of this as x = +0.319, y = −0.093. `WINE_LIFT` is the
    # louder version of the same check — 0.35 in front and 0.20 to her right,
    # x = +0.353, y = −0.196 — because the pour reaches across her midline and
    # a check whose whole content is a sign wants a number that is not near
    # nought.
    if "--probe" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        rig = bpy.data.objects["rig"]
        for name in argv[argv.index("--probe") + 1:]:
            if name.startswith("-") or name not in globals():
                break
            pose(rig, globals()[name])
            out = []
            # Heads and not tails: a bone's head is the joint, and the joint is
            # what 43-jadrija.js reads when it hangs a bottle off `handR`.
            for bone in ("head", "chest", "pelvis", "footR", "handL", "handR"):
                if bone in rig.pose.bones:
                    v = rig.matrix_world @ rig.pose.bones[bone].head
                    out.append("%s(%+.3f %+.3f %+.3f)" % (bone, v.x, v.y, v.z))
            print("[mh] probe %-12s %s" % (name, "  ".join(out)))
        return

    # No render and no export: opens the blend, walks the frames and prints.
    # Seconds rather than minutes, which is what makes it usable as the inner
    # loop while the numbers in a clip are still being argued with.
    if "--clipcheck" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        rig = bpy.data.objects["rig"]
        wheel_floor(rig)          # so the numbers below are the shipped numbers
        dance_floor(rig)
        skip_floor(rig)
        walk_floor(rig)
        fire_floor(rig)
        for name in argv[argv.index("--clipcheck") + 1:]:
            if name.startswith("-"):
                break
            clipcheck(rig, name)
        return

    if "--reskin" in argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        body, rig = bpy.data.objects["human"], bpy.data.objects["rig"]
        _lights()
        # Which cameras. The default three answer a whole-body pose; a pair of
        # hands in front of a sternum wants "hands", and paying 25 s of EEVEE
        # for a hero shot to find out whether two thumbs are touching is 25 s
        # spent on a part of the frame nobody is going to look at.
        views = ("hero", "side", "front")
        if "--views" in argv:
            picked = []
            for n in argv[argv.index("--views") + 1:]:
                if n.startswith("-") or n not in VIEWS:
                    break
                picked.append(n)
            if picked:
                views = tuple(picked)
        for name in argv[argv.index("--reskin") + 1:]:
            if name.startswith("-") or name not in globals():
                break
            pose(rig, globals()[name])
            # Hero, side and front. Front used to be left out — it tells you
            # almost nothing about a pose whose whole content is sagittal, and
            # every view is 25 s of EEVEE — but the cartwheel's whole content is
            # frontal, and it is the only view that shows which way she is
            # going over.
            render(name.lower(), views)
        pose(rig, {})
        export_skin(body, rig, ROOT / "build" / "payload" / "human_skin.fr3d.gz",
                    CLIPS)
        return

    path = fetch()
    J, scale, drop = read_joints(path)
    print("[mh] scale %.5f  drop %.4f  joints %d" % (scale, drop, len(J)))
    print("[mh] ground marker lands at z = %+.4f (want 0)" % J["ground"].z)

    body = load(path, scale, drop)
    print("[mh] kept %d verts before smoothing" % len(body.data.vertices))
    smooth(body, levels)
    # After the subsurf, deliberately. The hair is authored at the density it
    # wants; run through smooth() it would be subdivided twice — once globally
    # and again by the head pass, which takes everything above z = 1.46 — and
    # arrive at a few thousand triangles for a ponytail, all of which the export
    # decimator would then have to take back off the face.
    extras(body, J)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print("[mh] mesh %d verts, %d faces, %d tris"
          % (len(body.data.vertices), len(body.data.polygons), tris))

    rig = armature(J)
    print("[mh] bones %d" % len(rig.data.bones))
    skin(body, rig)
    # The face frame. Every number in `cutters` — brow, lash, lip, iris — was
    # measured off the base mesh's skull, and a `--body` is a different skull:
    # Chloe's face targets take 7 mm off her jaw and put her cheekbones out,
    # and eyebrows placed in absolute metres land somewhere else on that. This
    # is the same retarget `bathers_mh.py` does for its eight, and it is
    # exactly (1, 1, 1) on the unmorphed base, so the shared figure is
    # bit-for-bit what it was.
    k = (1.0, 1.0, 1.0)
    if BODY_OVERRIDE is not None:
        k = tuple(a / b for a, b in zip(vault(path, J["l-eye"].z), SKULL))
        print("[mh] head frame  %.3f %.3f %.3f" % k)
    paint(body, cutters(J, k=k))
    _material(body)
    _lights()

    pose(rig, {})
    render("bind", ("front", "side", "hero", "face", "head", "prof"))
    pose(rig, STRIDE)
    render("stride", ("hero", "side"))

    # Skinned, from the *bind* pose — the armature modifier has to be evaluating
    # to identity here or every vertex gets deformed twice, once at bake and
    # once in the shader.
    #
    # `export_static` is still here and still works (`--reexport`), but nothing
    # ships it any more: it wrote 427 KB for one frozen attitude, and the same
    # body with its skeleton attached is 470 KB for all of them.
    pose(rig, {})
    export_skin(body, rig,
                SKIN_OUT or (ROOT / "build" / "payload" / "human_skin.fr3d.gz"),
                CLIPS)

    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("[mh] wrote %s" % BLEND)


if __name__ == "__main__":
    main()
