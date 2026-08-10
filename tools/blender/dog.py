"""Bake the promenade dog for the game.

    blender --background --python tools/blender/dog.py

Writes build/payload/dog.fr3d.gz, which build.py inlines.

Unlike every other model in this project, the geometry here was not authored.
`landmarks.py` builds four buildings out of boxes and domes, `human_mh.py` grows
a woman out of MakeHuman and a thousand lines of joint angles, and both of those
are worth the trouble because they are *specific*: that cathedral, that
promenade, that figure. A dog on a beach is not specific. It is a dog on a
beach, and the honest cheapest way to get one is to take a public-domain mesh
somebody has already made well and spend the effort on where it stands and what
it does instead. See assets/README.md for what it is and where it came from.

So this file is mostly a conversion, and the conversion is where all the
decisions are.

── the three things a foreign mesh always gets wrong ─────────────────────────

**Which way is forward.** The game's rigs face +X — `human_mh.py` says so at
length, and getting it wrong is what once had her crawling backwards. This mesh
faces −Y: its Head bone sits at y −1.389 and its Hips at +0.641, measured rather
than eyeballed, and a quarter turn about Z is what reconciles them.

**How big it is.** glTF carries no unit, and this one arrives with its armature
scaled 39.55 and a body 2.66 units tall, which is a number about nothing. A pug
stands about 30 cm at the shoulder and about 36 cm to the top of its head, so
that is what it is scaled to — and then dropped so the lowest vertex is exactly
z = 0, because the runtime puts it on the ground by its origin and a model with
its feet somewhere near the middle of itself hovers or sinks.

**Where the colour lives.** Nothing in this world is textured; every surface is
a colour per vertex, sampled by one shared material. This mesh keeps its two
colours in two Blender materials, so it is split along that seam into two
objects and handed to `export` as two parts. That is not a workaround, it is
what `export` is for — `landmarks.py` hands it eleven parts for the cathedral
for exactly the same reason.

── the armature ──────────────────────────────────────────────────────────────

The first pass dropped it: a rig that nothing plays is dead weight in a payload
inlined into every download. It is kept now, and the dog ships skinned — v4,
the same format the figure uses, read by the same hundred lines in
`src/41-skin.js`. `skinnedFigure` turns out to be entirely general once
`opts.face` is left off, so the runtime cost of this was close to nothing and
all of the work is here.

Two things about this particular rig are worth knowing before touching it.

**The feet were not on the legs, and now they are.** `FrontFoot.R`, `BackFoot.L`
and their pair arrive as children of `root` — siblings of `Body`, not the ends
of the leg chains — so posing a leg did not move its paw. In the rig as authored
that is a reasonable choice: it puts foot placement in root space, which is
where an IK walk cycle wants it, and the Jump action uses exactly that by
keyframing translation on all four.

It is not a reasonable choice *here*, because this format cannot translate any
bone but the root. A paw parented to the root can therefore only spin on the
spot, and the eighty-one vertices of each paw — they are weighted to the foot
bones, not to the shins — would have stayed on the deck while the legs walked
off. So `reparent_feet` hangs each paw off its own shin, where the rotations
that do exist carry it. The rest pose does not move: each foot's head already
sits directly under its shin's, so re-parenting changes the tree and not the
animal.

**The clip format carries rotation, and translation for the root only.** That is
`frskin.py`'s constraint, not this file's, and it decides which of the two
shipped actions can be used. `Idle` animates translation on one bone, so it
bakes losslessly. `Jump` animates it on nine, so most of what makes it a jump
would arrive as a rest offset — a dog subtly coming apart rather than one
obviously broken. `bake_action` measures the drop and prints it rather than
leaving it to be noticed, and Jump is not shipped.

── the gait ──────────────────────────────────────────────────────────────────

`trot` and `shake` are authored here rather than imported, because no pack has
them for this animal and because a walk that is not solved against the ground is
a walk that slides.

The trot is built backwards from that. Rather than posing the legs and hoping,
each paw is given a **path in metres** — straight back at the travel speed while
it is down, a Hermite arc forward while it is up — and a two-link solver reads
off the shoulder, elbow and paw angles that put it there. Nothing about it is
eyeballed, so `SPEED` below is not a tuning knob for how it looks: it is the
speed the deck actually moves under him, and `src/43-jadrija.js` divides by it
to pick a playback rate. Drive him at any other speed and he moonwalks.

The one thing this costs is a crouch. The forelimb arrives 99.7% extended —
shoulder to paw is 162.8 mm against a 164.4 mm reach — so at rest there is
almost no stride available before the solver runs out of leg. `CROUCH` lowers
him two and a half centimetres, which buys the reach back and is what a walking
dog looks like anyway next to a standing one.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Matrix  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frmesh import reset_scene  # noqa: E402
from frskin import (MAX_INFLUENCES, bake_action, bake_poses,  # noqa: E402
                    rest_locals, write_skin)

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / "assets" / "pug.glb"
OUT = ROOT / "build" / "payload"

# To the top of the head, in metres. A pug is 25–30 cm at the shoulder; this
# mesh is stylised and carries a lot of its height in the skull, so it is set by
# the whole animal rather than by the shoulder and comes out about right beside
# a 1.75 m woman.
HEIGHT = 0.36

# Its own two materials, kept. They are a warm fawn and a near-black mask, which
# is what a pug is, and both sit inside the range the rest of the resort uses —
# the deck is 0.70 grey, her skin is 0.76/0.59/0.47. The temptation to "fix"
# them is worth resisting until it has been seen on the deck at the hour the
# game is actually played at.
COLOURS = {
    "Beige": (0.639, 0.483, 0.270),
    "Brown": (0.032, 0.011, 0.007),
}

# Levels of Catmull-Clark before the split. The asset is 644 faces, which is a
# sensible budget for something the size of a footstool seen from across a
# promenade and not a sensible one for something you can crouch down next to —
# and you can, because the balloon only comes up inside 21 m and the whole point
# of it is to be read. One level takes it to 1 932 faces — 3 536 vertices across
# the two colour parts — for a few KB in a 12 MB download.
#
# One and not two. Catmull-Clark does not add detail, it removes corners: the
# limit surface is smoother than the cage everywhere, and on a stylised low-poly
# animal the second level starts eating the very things that make it read as a
# pug — the flat muzzle, the square jaw, the creases. Anything past this wants a
# better cage, not more subdivision of this one.
SUBDIV = 1

# (action-name prefix, loops). The importer suffixes actions with the object
# they came off, so these are prefixes rather than names.
#
# Idle only. `Jump` is in the file and is not here: it animates translation on
# nine bones and the clip format carries translation for the root alone, so most
# of what makes it a jump would arrive as a rest offset. `bake_action` prints
# exactly how much would be lost, which is the number to look at before deciding
# whether to author the jump instead of importing it.
CLIPS = [("Armature|Idle", True)]

# Each paw, onto the shin above it. See the docstring: the format cannot
# translate anything but the root, so a paw parented to the root is a paw that
# stays on the deck.
FEET = {
    "FrontFoot.R": "FrontLowLeg.R",
    "FrontFoot.L": "FrontLowLeg.L",
    "BackFoot.R": "BackLowLeg.R",
    "BackFoot.L": "BackLowLeg.L",
}

# (upper bone, shin, paw, phase). A trot: diagonal pairs together, half a cycle
# apart. Chosen over a four-beat walk because it is the gait a small dog spends
# most of its moving life in, and because two beats is a shape you can read at
# ten metres where four is a shuffle.
LEGS = [
    ("FrontUpLeg.L", "FrontLowLeg.L", "FrontFoot.L", 0.00),
    ("BackUpLeg.R", "BackLowLeg.R", "BackFoot.R", 0.00),
    ("FrontUpLeg.R", "FrontLowLeg.R", "FrontFoot.R", 0.50),
    ("BackUpLeg.L", "BackLowLeg.L", "BackFoot.L", 0.50),
]

CYCLE = 0.30      # seconds for one full cycle: two footfalls a leg per second
REACH = 0.070     # half the distance a planted paw travels, metres
CROUCH = 0.025    # how much lower he carries himself moving than standing
BOB = 0.006       # vertical, twice a cycle, highest at mid-stance
LIFT = 0.032      # how far a paw clears the deck on the swing

# Distance covered in one cycle, and so his speed over the ground. A planted paw
# goes back by 2·REACH while it is down, which is half the cycle, so a full
# cycle is 4·REACH of deck. 0.93 m/s — a purposeful small dog.
SPEED = 4 * REACH / CYCLE

# Fast clips are sampled at sixty rather than thirty. A 0.30 s cycle is nine
# frames at the module default, and the runtime blends between frames linearly:
# nine samples of a leg swinging through ninety degrees is a leg with visible
# corners in it. Eighteen is not, and costs 1.7 KB before compression.
FAST_FPS = 60


def fix_actions(scale):
    """Scale every `location` channel in every action by `scale`.

    This is the part of baking the armature's 39.55 into its bone data that is
    not free. A pose bone's `location` is in armature-object space, so it does
    not follow a transform applied to the bone data underneath it: leave it and
    the rest skeleton is five metres of dog while the animation that moves it
    is still authored in fortieths. The visible symptom is not a broken dog but
    a still one, because every translation in every clip has been divided by
    five and change.

    Rotations need nothing — they are scale-free — and there is no non-uniform
    case to worry about because the armature arrives at 39.55 on all three.
    """
    n = 0
    for act in bpy.data.actions:
        for fc in act.fcurves:
            if not fc.data_path.endswith("location"):
                continue
            n += 1
            for kp in fc.keyframe_points:
                kp.co.y *= scale
                kp.handle_left.y *= scale
                kp.handle_right.y *= scale
    print("[dog] scaled %d location channels by %.3f" % (n, scale))


def reparent_feet(rig):
    """Hang each paw off the shin above it instead of off the root."""
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for foot, shin in FEET.items():
        eb = rig.data.edit_bones[foot]
        eb.parent = rig.data.edit_bones[shin]
        # Not connected: connecting snaps the paw's head onto the shin's tail,
        # and these are zero-length bones whose tails are a millimetre from
        # their heads. It would move every paw up to the ankle.
        eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)


# ── the two-link solver ───────────────────────────────────────────────────────
#
# Everything below works in the sagittal plane — x forward, z up — and in one
# angle convention: a rotation about +Y that takes straight-down onto the vector
# given. That is the same +Y the poses are authored in, and it comes out of
# `frskin.py`'s armature-space rule, so a positive angle swings a leg *back* for
# all four legs regardless of what glTF did to their bone rolls.


def _ang(dx, dz):
    """The +Y rotation taking (0, 0, −1) onto (dx, dz)."""
    return math.atan2(-dx, -dz)


def leg_rest(rig, up, low, foot):
    """One leg's rest geometry, as the solver wants it.

    The knee sign is measured rather than assumed. A dog's elbow points forward
    of the shoulder line and its hock points behind the hip, so the two ends of
    the animal fold opposite ways, and hard-coding either one gives two legs
    that bend backwards.
    """
    j = rig.data.bones[up].head_local
    k = rig.data.bones[low].head_local
    p = rig.data.bones[foot].head_local
    a1 = _ang(k.x - j.x, k.z - j.z)
    a2 = _ang(p.x - k.x, p.z - k.z)
    base = _ang(p.x - j.x, p.z - j.z)
    return {
        "j": (j.x, j.z), "p": (p.x, p.z),
        "l1": math.hypot(k.x - j.x, k.z - j.z),
        "l2": math.hypot(p.x - k.x, p.z - k.z),
        "a1": a1, "a2": a2,
        "knee": 1.0 if a1 - base > 0 else -1.0,
    }


def solve(g, tx, tz):
    """Degrees for (upper, shin, paw) putting the paw at (tx, tz).

    The paw angle is the one that leaves it flat on the deck: the shin's world
    pitch is `a2` and the paw simply undoes it. A paw that inherits the fold of
    the leg above points at the sky at the top of the swing.
    """
    jx, jz = g["j"]
    l1, l2 = g["l1"], g["l2"]
    dx, dz = tx - jx, tz - jz
    d = min(max(math.hypot(dx, dz), abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999)
    c = (d * d + l1 * l1 - l2 * l2) / (2.0 * d * l1)
    a1 = _ang(dx, dz) + g["knee"] * math.acos(max(-1.0, min(1.0, c)))
    kx, kz = jx - l1 * math.sin(a1), jz - l1 * math.cos(a1)
    a2 = _ang(tx - kx, tz - kz)
    deg = math.degrees
    return (deg(a1 - g["a1"]),
            deg((a2 - a1) - (g["a2"] - g["a1"])),
            deg(g["a2"] - a2))


def _hermite(u, p0, p1, m0, m1):
    """Cubic through p0→p1 with the tangents given, u in [0, 1]."""
    u2, u3 = u * u, u * u * u
    return ((2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0
            + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1)


def paw_path(u, g, dz):
    """Where one paw should be at phase `u` of its own cycle.

    `u` = 0 is footfall. The first half is stance: the paw is nailed to the deck
    and travels straight back at `SPEED`, which is the whole point of solving
    this instead of posing it. The second half is the swing, and it is a Hermite
    rather than an ease because both ends of it have to *match the ground speed*
    — a swing that arrives with zero velocity is a paw that stops dead the
    instant it lands and drags for the rest of the step.

    `dz` is the root's vertical offset this frame. It is subtracted rather than
    ignored because the solver works in the rig's own space and the root moves
    the whole rig: the target has to be lowered by however much the body rose,
    or the crouch and the bob both leak into the contact.
    """
    px, pz = g["p"]
    if u < 0.5:
        s = u / 0.5
        return px + REACH - 2 * REACH * s, pz - dz
    s = (u - 0.5) / 0.5
    v = -2 * REACH          # metres per half-cycle, the speed of the deck
    x = _hermite(s, px - REACH, px + REACH, v, v)
    return x, pz - dz + LIFT * math.sin(math.pi * s)


def trot_keys(geo, fps=FAST_FPS):
    """The cycle, one key a frame, so nothing is left to the interpolator."""
    n = int(round(CYCLE * fps))
    keys = []
    for f in range(n + 1):
        ph = f / n
        dz = -CROUCH - BOB * math.cos(4 * math.pi * ph)
        p = {"@root": (0.0, 0.0, dz)}
        for up, low, foot, off in LEGS:
            d1, d2, d3 = solve(geo[up], *paw_path((ph + off) % 1.0, geo[up], dz))
            p[up] = (0.0, d1, 0.0)
            p[low] = (0.0, d2, 0.0)
            p[foot] = (0.0, d3, 0.0)
        # What the rest of him does about it. Small on purpose: the legs are
        # solved and everything here is decoration, so anything big enough to
        # notice on its own is big enough to fight them.
        w, w2 = 2 * math.pi * ph, 4 * math.pi * ph
        p["Shoulders"] = (2.6 * math.sin(w), 0.0, 0.0)
        p["Hips"] = (-3.2 * math.sin(w), 0.0, 2.6 * math.sin(w))
        p["Back"] = (0.0, 0.0, 2.2 * math.sin(w))
        p["Neck"] = (0.0, -2.0 * math.cos(w2), 0.0)
        p["Head"] = (0.0, 3.4 * math.cos(w2), 0.0)
        keys.append((ph * CYCLE, p))
    return keys


# ── the shake ─────────────────────────────────────────────────────────────────
#
# A dog coming out of the water twists its trunk about the fore-and-aft axis
# fast enough that the front and back halves are never in phase, and that
# counter-rotation is the entire read. So the wave is authored explicitly: the
# head starts it, the neck and shoulders follow a beat behind, and the hips
# arrive most of a half-cycle late, which puts the two ends of the animal
# turning opposite ways for most of every cycle.
#
# `Body` is deliberately not in it. The four legs hang off `Body`, so rolling it
# rolls them, and a dog that shakes its feet off the deck is a dog levitating.
# Leaving the trunk to pivot about a fixed middle is also just what happens: the
# feet stay planted and the animal blurs above them.

SHAKE = 1.55      # seconds, once
SHAKE_HZ = 4.2

# (bone, amplitude in degrees, phase lag in radians).
SHAKE_WAVE = [
    ("Head", 22.0, 1.05),
    ("Neck", 15.0, 0.55),
    ("Shoulders", 15.0, 0.0),
    ("Back", 13.0, 1.70),
    ("Hips", 19.0, 2.15),
    ("Torso", 7.0, 2.40),
]


def _ramp(t, a, b):
    u = min(1.0, max(0.0, (t - a) / (b - a)))
    return u * u * (3.0 - 2.0 * u)


def shake_keys(geo, fps=FAST_FPS):
    """Brace, shake, settle. Sampled per frame like the trot, and for the same
    reason: at 4.2 Hz a key every tenth of a second is a key every half turn."""
    n = int(round(SHAKE * fps))
    keys = []
    for f in range(n + 1):
        t = f * SHAKE / n
        # Up at the front first, then the whole wave, then down. The brace and
        # the recovery overlap the shake at both ends rather than butting on to
        # it, so it starts as a flinch instead of as a switch being thrown.
        env = _ramp(t, 0.14, 0.34) * (1.0 - _ramp(t, 1.12, 1.42))
        crouch = CROUCH * 0.45 * (_ramp(t, 0.04, 0.22)
                                  * (1.0 - _ramp(t, 1.20, 1.52)))
        p = {"@root": (0.0, 0.0, -crouch)}

        w = 2 * math.pi * SHAKE_HZ * t
        for bone, amp, lag in SHAKE_WAVE:
            p[bone] = (amp * env * math.sin(w - lag), 0.0, 0.0)
        # The head also drops as he braces and comes back up at the end, and
        # gets the one thing the roll cannot give it: a yaw, so the muzzle
        # travels rather than just turning over.
        p["Head"] = (p["Head"][0],
                     -9.0 * _ramp(t, 0.02, 0.20) * (1.0 - _ramp(t, 1.15, 1.45)),
                     7.0 * env * math.sin(w - 1.05 + 1.4))
        # Braced: the legs go a little wider and a little straighter, which is
        # what stops the whole animal falling over sideways doing this.
        for up, low, foot, _off in LEGS:
            side = 1.0 if up.endswith(".L") else -1.0
            d1, d2, d3 = solve(geo[up], *paw_path(0.25, geo[up], -crouch))
            p[up] = (side * 5.5 * env, d1, 0.0)
            p[low] = (0.0, d2, 0.0)
            p[foot] = (0.0, d3, 0.0)
        keys.append((t, p))
    return keys


def build():
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC))

    dog = bpy.data.objects.get("Pug")
    if dog is None:
        sys.exit("[dog] no 'Pug' mesh in %s" % SRC)
    rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if rig is None:
        sys.exit("[dog] no armature in %s" % SRC)

    # World matrices before anything is unparented, because unparenting is what
    # loses them. The file also contains a unit Icosphere at the origin with no
    # materials and no parent, a `RootNode` empty that both of these hang off,
    # and a tree of `_end` empties the glTF importer makes for every bone tail.
    # None of it is the dog.
    dog_mw, rig_mw = dog.matrix_world.copy(), rig.matrix_world.copy()
    for ob in list(bpy.data.objects):
        if ob is not dog and ob is not rig:
            bpy.data.objects.remove(ob, do_unlink=True)
    for ob in (dog, rig):
        ob.parent = None
    # The deform modifier goes: nothing here evaluates it, `bpy.ops` on the mesh
    # below would have to reason about modifier order around it, and the only
    # thing the export needs from the binding is `vertex_groups`, which lives on
    # the object and stays.
    dog.modifiers.clear()

    # Bake the world matrices into the data before touching anything else, and
    # do not simply clear them. They are not the identity and not decoration:
    # the glTF importer's Y-up-to-Z-up conversion is in there, and so is the
    # armature's scale of 39.55, which the mesh inherited by being parented to
    # it. Clearing it — which the first version of this did — leaves the raw
    # mesh data lying on its side at a fortieth of its size, and every
    # measurement taken afterwards is of the wrong animal. It came out 0.27 m
    # nose to tail and 0.36 m tall, which is a dog standing on its hind legs.
    #
    # The armature gets the same treatment for a second reason on top of that
    # one. A clip frame stores a quaternion and, for the root, a translation —
    # there is nowhere to put a scale. So the skeleton has to be unit-scaled by
    # the time `rest_locals` reads it, which means the 39.55 has to live in the
    # bone data rather than on the object. See `fix_actions` for the part of
    # that which is not free.
    dog.data.transform(dog_mw)
    rig.data.transform(rig_mw)
    dog.matrix_world = rig.matrix_world = Matrix.Identity(4)

    # Measured on the mesh as it arrives, so this stays right if the asset is
    # ever replaced: turn the head onto +X, scale to HEIGHT, sit on z = 0. The
    # armature takes the identical transform, because the runtime derives the
    # inverse bind from the rest skeleton and a skeleton in a different space
    # from its mesh turns the dog inside out.
    fix = Matrix.Rotation(1.5707963267948966, 4, "Z")
    for d in (dog.data, rig.data):
        d.transform(fix)
    zs = [v.co.z for v in dog.data.vertices]
    k = HEIGHT / (max(zs) - min(zs))
    for d in (dog.data, rig.data):
        d.transform(Matrix.Scale(k, 4))
    zs = [v.co.z for v in dog.data.vertices]
    drop = Matrix.Translation((0.0, 0.0, -min(zs)))
    for d in (dog.data, rig.data):
        d.transform(drop)

    fix_actions(rig_mw.to_scale().x * k)
    reparent_feet(rig)

    xs = [v.co.x for v in dog.data.vertices]
    ys = [v.co.y for v in dog.data.vertices]
    zs = [v.co.z for v in dog.data.vertices]
    print("[dog] scaled x%.4f  nose-to-tail %.3f m  wide %.3f m  tall %.3f m"
          % (k, max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))

    # Smooth, and subdivided. Applied here rather than left as a modifier
    # because `bpy.ops.mesh.separate` below works on the cage and the exporter
    # reads `data.vertices`, so an unapplied modifier is a modifier that ships
    # as nothing at all. It goes *before* the split for the same reason it goes
    # after the scaling: Catmull-Clark on two objects that used to share an edge
    # pulls them apart along it, and the seam here runs right across the muzzle.
    bpy.context.view_layer.objects.active = dog
    dog.select_set(True)
    if SUBDIV:
        # Weld first, and this is not optional — it is the whole difference
        # between a dog and a heap of pebbles.
        #
        # The asset is authored flat-shaded, which means every face carries its
        # own copy of its corners and no two faces share an edge: 1 284 vertices
        # for what is topologically about 320. Catmull-Clark works on edges, so
        # on a mesh with no shared edges it does not smooth a surface, it rounds
        # off each face separately and pulls the results apart — the first run
        # of this came out as a Dalmatian made of loose brown lozenges with the
        # sea visible between them. Merging by distance restores the topology
        # the modelling had, and then the subdivision has something to hold on
        # to. 1e-4 m is a tenth of a millimetre on a half-metre animal, well
        # below any real feature and well above float noise from the scaling.
        before_v = len(dog.data.vertices)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=1e-4)
        bpy.ops.object.mode_set(mode="OBJECT")
        print("[dog] welded %d -> %d verts" % (before_v, len(dog.data.vertices)))

        before = len(dog.data.polygons)
        m = dog.modifiers.new("sub", "SUBSURF")
        m.levels = m.render_levels = SUBDIV
        bpy.ops.object.modifier_apply(modifier=m.name)
        print("[dog] subdivided %d -> %d faces at level %d"
              % (before, len(dog.data.polygons), SUBDIV))
    for p in dog.data.polygons:
        p.use_smooth = True

    # The colours were a material *split* while this was a v1 export, because
    # v1 takes a list of (object, colour) and has nowhere else to put them. The
    # skinned blob carries a colour per vertex, so the split is gone: the seam
    # is drawn by putting the colour in the dedupe key below, which gives a hard
    # edge across the muzzle in one line instead of two objects. It also quietly
    # retires the reason the subdivision had to happen before the split.
    names = [m.name if m else None for m in dog.data.materials]
    unknown = [n for n in names if n not in COLOURS]
    if unknown:
        sys.exit("[dog] material with no colour: %s" % unknown)
    palette = [COLOURS[n] for n in names]

    rest = rest_locals(rig)
    bindex = {name: i for i, (name, _p, _l, _g) in enumerate(rest)}
    gname = {i: g.name for i, g in enumerate(dog.vertex_groups)}

    src = dog.data
    src.calc_loop_triangles()
    try:
        src.calc_normals_split()
    except (AttributeError, RuntimeError):
        pass

    def weights(vi):
        """Four (bone, weight) pairs as bytes summing to exactly 255.

        Exactly, not approximately: the shader adds four bone matrices scaled
        by these and does not renormalise, so a vertex whose weights come to
        0.99 is a vertex that shrinks towards the origin every frame.
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
        c8 = tuple(min(255, max(0, int(x * 255 + 0.5)))
                   for x in palette[tri.material_index])
        for li in tri.loops:
            vi = src.loops[li].vertex_index
            v = src.vertices[vi]
            n = src.loops[li].normal if src.loops[li].normal.length else v.normal
            if vi not in wcache:
                wcache[vi] = weights(vi)
                if not v.groups:
                    orphans += 1
            wi, ww = wcache[vi]
            co = (v.co.x, v.co.z, -v.co.y)
            nv3 = (n.x, n.z, -n.y)
            # Weights and colour both go in the key. Two vertices that agree on
            # position and normal but not on which bone owns them are two
            # vertices, and merging them welds a seam shut across a joint.
            key = (round(co[0], 5), round(co[1], 5), round(co[2], 5),
                   round(nv3[0], 3), round(nv3[1], 3), round(nv3[2], 3),
                   c8, wi, ww)
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
    if orphans:
        print("[dog]   WARNING %d vertices had no bone weight at all" % orphans)

    baked = []
    for want, loop in CLIPS:
        act = next((a for a in bpy.data.actions if a.name.startswith(want)), None)
        if act is None:
            print("[dog]   no action starting '%s' — skipped" % want)
            continue
        baked.append(bake_action(rig, act, want.split("|")[-1].lower(),
                                 loop=loop, rest=rest))

    geo = {up: leg_rest(rig, up, low, foot) for up, low, foot, _o in LEGS}
    # How close the solver comes to running out of leg. This is the number that
    # decides `REACH` and `CROUCH`, and it is printed because the failure is
    # silent: past 100% the target is clamped, the paw stops where the leg ends
    # and slides the rest of the way, and what you see is a dog on ice.
    for name, g in sorted(geo.items()):
        worst = max(math.hypot(x - g["j"][0], z - g["j"][1])
                    for x, z in (paw_path(i / 120.0, g,
                                          -CROUCH - BOB * math.cos(
                                              4 * math.pi * i / 120.0))
                                 for i in range(120)))
        print("[dog]   %-13s upper %.1f  shin %.1f  reach %.1f mm  "
              "worst %.1f mm (%.0f%%)"
              % (name, g["l1"] * 1000, g["l2"] * 1000,
                 (g["l1"] + g["l2"]) * 1000, worst * 1000,
                 100 * worst / (g["l1"] + g["l2"])))
    print("[dog] trot %.2f m/s over the ground, %.0f ms a cycle"
          % (SPEED, CYCLE * 1000))
    baked.append(bake_poses(rest, trot_keys(geo), "trot",
                            loop=True, fps=FAST_FPS))
    baked.append(bake_poses(rest, shake_keys(geo), "shake",
                            loop=False, fps=FAST_FPS))

    OUT.mkdir(parents=True, exist_ok=True)
    write_skin(OUT / "dog.fr3d.gz", pos, nrm, cols, bidx, bwgt, idx,
               rest, baked, note="dog")


if __name__ == "__main__":
    build()
