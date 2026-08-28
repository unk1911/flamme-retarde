"""MakeHuman morph targets, applied to the cached base mesh.

    python3 tools/blender/mh_morph.py            # bake all eight OBJs
    python3 tools/blender/mh_morph.py --list     # just say what they are

No Blender here on purpose. A target is a list of per-vertex deltas and the
base is an OBJ, so the whole of this is arithmetic on two text files, and
keeping it out of Blender means a body can be tried, looked at and thrown away
in seconds rather than in a four-minute bake.

── what MakeHuman actually ships ───────────────────────────────────────────────

Not a library of people. One base mesh — the same 19 158-vertex base.obj that
this game's figure is already built from — and several hundred `.target` files,
each a list of `index dx dy dz` lines that deform it. Everything MakeHuman can
make is that one mesh plus a weighted sum of those.

Which is the good outcome rather than a limitation: a new body is a vector add
on topology we already rig, weight, paint and animate. The rig in particular
comes along for free, because `read_joints` in human_mh.py builds the skeleton
from `joint-*` marker cubes that are themselves vertices of the mesh — morph
the body and the joints move with it, so a child gets a child's skeleton and
nobody has to say so.

The three groups worth knowing:

    macrodetails/          24 files, {african,asian,caucasian}
                           x {female,male} x {baby,child,young,old}
    macrodetails/height/  144 files, {female,male} x {baby,child,young,old}
                           x muscle{min,average,max} x weight{min,average,max}
                           x height{min,max}
    bodyshapes/            23 named shapes — hourglass, apple, rectangle,
                           triangle, lean column, and so on

All CC0, per LICENSE.ASSETS.md at the root of the makehuman repository, which
is a full waiver: no attribution owed, commercial use fine, redistribution
fine. The credit is offered anyway.

── heights ─────────────────────────────────────────────────────────────────────

Stature is stated, not inherited. The first version held one scale across every
figure and let each morph keep the height it happened to come out at, which
gave a 2.33 m young man and a 1.46 m old one — because the `maxheight` and
`minheight` corner targets are corners, and most of the way to a corner is
absurd. They are still used, because the same file carries the muscle and
weight that make a build; the stature they also carry is then normalised away
and replaced with a number from the table.

Which is the right split anyway. Build and height are independent in people and
should be independent here: a heavy man is not a short man.
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "build" / "mh_base.obj"
TCACHE = ROOT / "build" / "mh_targets"
OUT = ROOT / "build" / "mh_bodies"
RAW = ("https://raw.githubusercontent.com/makehumancommunity/makehuman/"
       "master/makehuman/data/targets/")

# ── the eight ───────────────────────────────────────────────────────────────── #
#
# Chosen to span the axes a beach actually varies along, which is not the axes a
# character creator offers: sex, age, and above all *build*, because a promenade
# where everybody is the same weight is the same tell as one where everybody is
# the same height. Two children, two people over sixty, one heavy man, one heavy
# woman, one lean man, one slim woman — and three ethnicities, because Jadrija
# in August is not one.
#
# The weights are not MakeHuman's blending algebra. That solves for a continuous
# slider space; this picks eight points in it by hand, so a corner target at 0.8
# to 1.0 is simply "at or near that corner", which is what a person who is
# noticeably heavy or noticeably lean looks like.
#
# They started timid — 0.55 to 0.7 across the board — and the first render was
# eight variations on one build. The corners are corners of a *human* range, not
# of a caricature: at 1.0 the heavy old man is a heavy old man, not a balloon.
# Restraint here reads as sameness, which is the thing this exists to fix.
# ── Chloe ─────────────────────────────────────────────────────────────────── #
#
# FACE TARGETS ONLY, and that is a hard rule rather than a preference. She is
# the one figure in this game whose clothes, tattoo and hat are all PAINT, and
# every one of those is a threshold in her bind-space height: the vest hem at
# 0.995, the sleeve's lower bound at 0.900, the brief's leg opening between
# 0.815 and 0.962, the beanie's at 1.668. Put a macrodetail or a bodyshape in
# here and every one of those numbers is measuring a different woman — the
# garments slide, the sleeve comes back down her leg, the hat floats. The head
# moves and nothing else does, so the only numbers that have to be re-measured
# are the four the hat is built from.
#
# Misha, 28 Aug, with a cosplay photograph: "make the facial shape/features
# more like this pic somehow". What is in that frame is angular and
# androgynous — high cheekbones with hollows under them, a narrow chin, a
# straight narrow nose, a long face. The base mesh is none of those; it is the
# MakeHuman neutral, which is soft and round because it is the average of
# everybody.
#
# Baked as its own body and its own skin so BAYE IS UNTOUCHED. She and the
# race swimmer share `human_skin.fr3d.gz` with Chloe, and morphing that would
# have given a fire performer at a bathing station somebody else's face.
CHLOE = ("chloe", 1.750, [
    ("head/head-oval", 0.50),
    ("head/head-invertedtriangular", 0.35),
    ("cheek/l-cheek-bones-incr", 0.75),
    ("cheek/r-cheek-bones-incr", 0.75),
    # Hollow cheeks, a long chin and a narrowed mouth are, together, the recipe
    # for a skull. Misha, 28 Aug: "mouth looks weird... like a skeleton". Each
    # of the four was defensible on its own and the sum of them was gaunt, so
    # the three that make the lower face read as bone are halved or gone and
    # the cheekbones — which are the thing the reference actually has — keep
    # their full weight.
    ("cheek/l-cheek-inner-decr", 0.30),
    ("cheek/r-cheek-inner-decr", 0.30),
    ("chin/chin-width-decr", 0.55),
    ("chin/chin-height-incr", 0.10),
    ("chin/chin-prognathism-decr", 0.10),
    ("nose/nose-scale-horiz-decr", 0.45),
    ("nose/nose-hump-decr", 0.35),
    ("forehead/forehead-scale-vert-decr", 0.25),
])

BATHERS = [
    ("girl_child", 1.24, [
        ("macrodetails/caucasian-female-child", 1.0),
        ("macrodetails/height/female-child-averagemuscle-averageweight-minheight", 0.35),
    ]),
    ("boy_child", 1.38, [
        ("macrodetails/asian-male-child", 1.0),
        ("macrodetails/height/male-child-averagemuscle-minweight-maxheight", 0.45),
    ]),
    ("woman_young_slim", 1.72, [
        ("macrodetails/caucasian-female-young", 1.0),
        ("macrodetails/height/female-young-minmuscle-minweight-maxheight", 0.80),
        ("bodyshapes/bodyshapes-elvs-fem-lean-column", 0.45),
    ]),
    ("woman_young_full", 1.63, [
        ("macrodetails/african-female-young", 1.0),
        ("macrodetails/height/female-young-minmuscle-maxweight-minheight", 0.95),
        ("bodyshapes/bodyshapes-elvs-fem-full-hourglass", 0.75),
        ("stomach/stomach-tone-decr", 0.60),
        ("buttocks/buttocks-volume-incr", 0.55),
        ("torso/torso-scale-depth-incr", 0.35),
    ]),
    ("man_young_fit", 1.84, [
        ("macrodetails/caucasian-male-young", 1.0),
        ("macrodetails/height/male-young-maxmuscle-averageweight-maxheight", 1.00),
        ("torso/torso-muscle-dorsi-incr", 0.85),
        ("torso/torso-muscle-pectoral-incr", 0.70),
        ("torso/torso-scale-horiz-incr", 0.30),
        ("stomach/stomach-tone-incr", 0.80),
    ]),
    ("man_young_lean", 1.76, [
        ("macrodetails/asian-male-young", 1.0),
        ("macrodetails/height/male-young-minmuscle-minweight-maxheight", 0.85),
        ("torso/torso-scale-horiz-decr", 0.45),
        ("torso/torso-muscle-dorsi-decr", 0.50),
    ]),
    ("man_old_heavy", 1.71, [
        ("macrodetails/caucasian-male-old", 1.0),
        ("macrodetails/height/male-old-minmuscle-maxweight-minheight", 1.00),
        # The macro weight corner gives a solid man, not a heavy one. What
        # actually reads as a belly from twenty metres is the pregnancy target,
        # which is the only one in the set that pushes the abdomen forward
        # rather than scaling the whole torso — and a slack stomach under it.
        ("stomach/stomach-pregnant-incr", 0.55),
        ("stomach/stomach-tone-decr", 0.85),
        ("torso/torso-scale-depth-incr", 0.55),
    ]),
    ("woman_old", 1.58, [
        ("macrodetails/caucasian-female-old", 1.0),
        ("macrodetails/height/female-old-minmuscle-maxweight-minheight", 0.60),
        ("bodyshapes/bodyshapes-elvs-fem-rectangle", 0.40),
        ("stomach/stomach-tone-decr", 0.55),
        ("hip/hip-scale-horiz-incr", 0.30),
    ]),
]


def target(name):
    """One target's deltas as {index: (dx, dy, dz)}, fetched once and cached.

    `averageheight` is spelled out here rather than in the table because
    MakeHuman has no such file: the height cube is min and max only, and the
    average is the absence of both. Asking for it means asking for nothing,
    which is exactly what a figure of ordinary height wants.
    """
    if "averageheight" in name:
        return {}
    p = TCACHE / (name.replace("/", "__") + ".target")
    if not p.exists():
        TCACHE.mkdir(parents=True, exist_ok=True)
        url = RAW + name + ".target"
        with urllib.request.urlopen(url, timeout=120) as r:
            p.write_bytes(r.read())
        print("  fetched %s (%d KB)" % (name, p.stat().st_size / 1024))
    out = {}
    for ln in p.read_text().splitlines():
        if not ln or ln[0] == "#":
            continue
        a = ln.split()
        out[int(a[0])] = (float(a[1]), float(a[2]), float(a[3]))
    return out


def read_base():
    """The base OBJ as (lines, vertex list, index of each `v ` line)."""
    lines = BASE.read_text().splitlines()
    verts, where = [], []
    for i, ln in enumerate(lines):
        if ln.startswith("v "):
            a = ln.split()
            verts.append([float(a[1]), float(a[2]), float(a[3])])
            where.append(i)
    return lines, verts, where


def body_span(lines, verts):
    """Height of the `body` group only, in MakeHuman units.

    The whole mesh is not the body: it carries eyelashes, teeth, a skirt proxy
    and 125 joint marker cubes, and at least one of those sits outside the
    silhouette. `read_joints` in human_mh.py measures the same way.
    """
    body, cur = set(), None
    for ln in lines:
        if ln.startswith("g "):
            cur = ln[2:].strip()
        elif ln.startswith("f ") and cur == "body":
            for tok in ln.split()[1:]:
                body.add(int(tok.split("/")[0]) - 1)
    ys = [verts[i][1] for i in body]
    return min(ys), max(ys)


def girths(lines, v, lo, hi):
    """Body *depth* at a few heights, in metres, for judging a build by number.

    Depth and not width. The base mesh stands in an A-pose, so a horizontal
    band taken at the waist catches both forearms and reports a 110 cm waist on
    a lean man — the first version of this did exactly that, and the numbers
    were not slightly wrong, they were measuring arm span. Front-to-back extent
    has no such problem: the arms hang at about the torso's own depth and add
    nothing to it, and depth is the better obesity signal anyway, because what
    a heavy figure has that a thin one does not is a belly, and a belly grows
    forward.
    """
    body, cur = set(), None
    for ln in lines:
        if ln.startswith("g "):
            cur = ln[2:].strip()
        elif ln.startswith("f ") and cur == "body":
            for tok in ln.split()[1:]:
                body.add(int(tok.split("/")[0]) - 1)
    out = {}
    for label, frac in (("chest", 0.72), ("waist", 0.60), ("hip", 0.51)):
        y = lo + (hi - lo) * frac
        band = [v[i][2] for i in body if abs(v[i][1] - y) < (hi - lo) * 0.015]
        out[label] = (max(band) - min(band)) if band else 0.0
    return out


def build(name, height, recipe, lines, verts, where):
    v = [list(p) for p in verts]
    for tname, w in recipe:
        for i, (dx, dy, dz) in target(tname).items():
            v[i][0] += dx * w
            v[i][1] += dy * w
            v[i][2] += dz * w
    lo, hi = body_span(lines, v)
    k = height / (hi - lo)
    g = girths(lines, v, lo, hi)
    out = list(lines)
    for n, i in enumerate(where):
        out[i] = "v %.6f %.6f %.6f" % tuple(v[n])
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / ("mh_%s.obj" % name)
    p.write_text("\n".join(out) + "\n")
    print("  %-18s %4.2f m   depth chest %4.1f  waist %4.1f  hip %4.1f cm"
          % (name, height, g["chest"] * k * 100, g["waist"] * k * 100,
             g["hip"] * k * 100))
    return p


def main():
    lines, verts, where = read_base()
    lo, hi = body_span(lines, verts)
    print("base %d verts, neutral body %.4f units" % (len(verts), hi - lo))
    if "--list" in sys.argv:
        for n, h, r in BATHERS + [CHLOE]:
            print("  %-18s %4.2f m  %s" % (n, h, ", ".join(
                t.split("/")[-1] + "@" + str(w) for t, w in r)))
        return
    for name, height, recipe in BATHERS + [CHLOE]:
        build(name, height, recipe, lines, verts, where)


if __name__ == "__main__":
    main()
