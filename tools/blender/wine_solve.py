#!/usr/bin/env python3
"""Solve the wine pour: first the bottle in her hand, then her body round it.

Two halves, because Blender is only needed for one of them:

    # once per rebind — the rig, the skinned baye2 mesh and the shipped poses
    tools/blender/blender.sh -b build/baye2.blend -P tools/blender/wine_solve.py -- --dump

    python3 tools/blender/wine_solve.py --check        # FK + skinning vs Blender's own
    python3 tools/blender/wine_solve.py --grip         # the bottle in the fist
    python3 tools/blender/wine_solve.py --solve [KEY]  # the body keys (all, or the named)
    python3 tools/blender/wine_solve.py --clip         # bake it as human_mh.py does, measure every frame
    python3 tools/blender/wine_solve.py --emit         # the WINE_* block for human_mh.py
    python3 tools/blender/wine_solve.py --clip --shipped   # the same measurements on what SHIPS
    python3 tools/blender/wine_solve.py --render KEY...    # needs Blender: see --render below

The second half is numpy and scipy, in a plain python3, because a solve of
twenty-odd keys against a skinned mesh is a hundred thousand evaluations and
Blender's Python has no scipy. `--dump` writes everything the solve needs to
/tmp/wine_rig.npz and /tmp/wine_rig.json; nothing else in here opens a blend.

── WHY THIS FILE WAS REWRITTEN ─────────────────────────────────────────────

Misha, 24 Sep 2026: *"she should grab that bottle with right hand properly...
the way humans pick up objects like bottles, beer cans, not in the twisted way
she is doing it now"*.

The version this replaces solved WHERE HER WRIST WENT and took the bottle's
place in her hand as given: a palm point and an axis measured off `IDLE_A`,
the arm hanging, "the way a fist points a bottle". A hanging fist does not hold
anything, and that axis came out of the back of her hand at fifty degrees to
the palm. Every key then had to wring the wrist to aim it. Measured on the
shipped keys with `arm_measures` below: the hand TWISTED 16 to 31 degrees about
its own long axis relative to her forearm — which no wrist can do — on top of
45 to 50 degrees of extension and 25 of radial deviation through the pour.
That is the "twisted way". No amount of solving the arm fixes it, because the
arm was never what was wrong.

So the order is reversed. The grip is solved FIRST, on the skinned hand of the
figure that is actually drawn (baye2), and then every key is solved with that
grip held fixed:

  --grip   The bottle's own lathe profile is laid across the palm and scored
           against every vertex of the hand. Its axis is set 20 degrees off the
           knuckle line (`GRIP_G`) toward the heel of the hand; the palm is put
           on the glass (0.5 mm); the one `fingers` bone is closed until the
           first finger touches; the thumb is searched until its pad lies on
           the near side. There are no finger joints on this rig — one bone per
           hand for four fingers — so straight fingers can wrap a 77 mm bottle
           only so far before they would have to pass through it: about 85
           degrees round from the palm, and that is where they are.

  --solve  The body, key by key, chained, with the grip fixed. The wrist is
           parameterised as flexion and deviation about the hand's own
           anatomical axes, so it CANNOT twist; the forearm carries
           pronation; the legs dip on a fitted table that keeps the soles flat
           (see `dip`); and every key is scored for the things a render cannot
           show — wrist, pronation and elbow ranges, the forearm against her
           torso, the bottle against her body, the table and the glass, the
           tabletop against her thighs, and where she is looking.

  --clip   Bakes the clip EXACTLY as `_bake_clip` in human_mh.py does it —
           Euler angles lerped key to key on a smoothstep, the floor root
           lerped with them — and measures all of the above at 30 fps, plus
           the spout against the rim, the correction the game's aim would
           need, and the hand's speed. A key that is right and an in-between
           that is wrong is the commonest failure there is.

The rig's sign traps for the hand, learned the day this was written:
`handR` X is radial/ulnar DEVIATION and Z is flexion/extension; pronation is
the forearm's own Y; `fingersR` -X closes the RIGHT fingers (the left is the
other way — the finger bones do not mirror).

The frame is HERS throughout, which is Blender's: +x in front of her, +y her
LEFT, +z up, origin between her feet on the floor she stands on.
"""

import json
import math
import sys
from pathlib import Path

RIG_NPZ = Path("/tmp/wine_rig.npz")
RIG_JSON = Path("/tmp/wine_rig.json")
GRIP_JSON = Path("/tmp/wine_grip.json")
KEYS_JSON = Path("/tmp/wine_keys.json")
ROOT = Path(__file__).resolve().parents[2]

try:
    import bpy  # type: ignore
except ImportError:
    bpy = None


# =========================================================================== #
#  Blender half: dump what the solve needs                                     #
# =========================================================================== #

def blender_main(argv):
    import numpy as np
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import human_mh as H
    ob = bpy.data.objects["human"]
    rig = bpy.data.objects["rig"]
    bones = [b.name for b in rig.data.bones]
    bi = {n: i for i, n in enumerate(bones)}
    if "--render" in argv:
        return blender_render(argv, H)
    gn = {g.index: g.name for g in ob.vertex_groups}
    N = len(ob.data.vertices)
    W = np.zeros((N, len(bones)), dtype=np.float32)
    for v in ob.data.vertices:
        for g in v.groups:
            n = gn[g.group]
            if n in bi and g.weight > 0:
                W[v.index, bi[n]] = g.weight
    co = np.array([tuple(v.co) for v in ob.data.vertices])
    nrm = np.array([tuple(v.normal) for v in ob.data.vertices])
    rest = np.array([np.array(b.matrix_local) for b in rig.data.bones])
    parent = [bi[b.parent.name] if b.parent else -1 for b in rig.data.bones]
    poses = {}
    for k in dir(H):
        v = getattr(H, k)
        if (k.startswith("WINE_") or k == "IDLE_A") and isinstance(v, dict):
            poses[k] = {a: list(b) for a, b in v.items()}
    clip = next(c for c in H.CLIPS if c["name"] == "wine")
    names = {id(v): k for k, v in vars(H).items() if isinstance(v, dict)}
    shipped = [[t, names.get(id(p), "?")] for t, p in clip["keys"]]
    # Blender's own answer on one pose, for --check.
    spec = {k: v for k, v in H.WINE_POUR.items() if not k.startswith("@")}
    H.pose(rig, spec)
    pm = np.array([np.array(rig.matrix_world @ pb.matrix) for pb in rig.pose.bones])
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    eco = np.array([tuple(v.co) for v in me.vertices])
    ev.to_mesh_clear()
    np.savez(RIG_NPZ, co=co, nrm=nrm, W=W, rest=rest, parent=np.array(parent),
             check_pose=pm, check_mesh=eco)
    RIG_JSON.write_text(json.dumps({
        "bones": bones, "length": [b.length for b in rig.data.bones],
        "pnames": [pb.name for pb in rig.pose.bones], "poses": poses,
        "check_spec": spec, "tips": list(H.TIPS), "shipped_keys": shipped}))
    print("[wine] dumped %d verts, %d bones, %d poses -> %s" % (N, len(bones), len(poses), RIG_NPZ))


def blender_render(argv, H):
    """`-- --render job.json`: pose baye2 and draw it with the room's props.

    Workbench, flat skin, because the question is only ever where things are.
    The job file is written by `--render` in the python half.
    """
    from mathutils import Vector
    job = json.loads(Path(argv[argv.index("--render") + 1]).read_text())
    rig = bpy.data.objects["rig"]
    body = bpy.data.objects["human"]
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True

    def mat(name, rgb):
        m = bpy.data.materials.new(name)
        m.diffuse_color = tuple(rgb) + (1.0,)
        return m

    body.data.materials.clear()
    body.data.materials.append(mat("skin", (0.80, 0.60, 0.50)))
    for p in body.data.polygons:
        p.material_index = 0

    def lathe(name, prof, rgb, seg=32):
        verts, faces = [], []
        for h, r in prof:
            for i in range(seg):
                a = 2 * math.pi * i / seg
                verts.append((r * math.cos(a), r * math.sin(a), h))
        for j in range(len(prof) - 1):
            for i in range(seg):
                a0, a1 = j * seg + i, j * seg + (i + 1) % seg
                faces.append((a0, a1, a1 + seg, a0 + seg))
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        o = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(o)
        me.materials.append(mat(name + "m", rgb))
        return o

    made = []
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    for fr in job["frames"]:
        for o in made:
            bpy.data.objects.remove(o, do_unlink=True)
        made = []
        for b in rig.pose.bones:
            b.rotation_mode = "XYZ"
            b.rotation_euler = (0, 0, 0)
        for n, v in fr["spec"].items():
            if n in rig.pose.bones:
                rig.pose.bones[n].rotation_euler = tuple(math.radians(a) for a in v)
        rig.location = Vector(fr["root"])
        bt = fr["bottle"]
        for nm, prof, rgb in (("bottle", job["bottle"], (0.05, 0.25, 0.10)),
                              ("label", [[0.048, 0.0395], [0.128, 0.0395]], (0.85, 0.80, 0.65))):
            o = lathe(nm, prof, rgb)
            o.rotation_mode = "QUATERNION"
            o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(bt["axis"]))
            o.location = Vector(bt["foot"])
            made.append(o)
        g = lathe("glass", job["glass_prof"], (0.75, 0.80, 0.85))
        g.location = Vector(job["glass"])
        tr = job["table"][3]
        t = lathe("table", [[-0.02, 0.0], [-0.02, tr], [0.0, tr], [0.0, 0.0]], (0.45, 0.32, 0.2), 48)
        t.location = Vector(job["table"][:3])
        made += [g, t]
        bpy.context.view_layer.update()
        for s in fr["shots"]:
            cam.location = Vector(s["eye"])
            cam.rotation_mode = "QUATERNION"
            cam.rotation_quaternion = (Vector(s["at"]) - Vector(s["eye"])).to_track_quat("-Z", "Y")
            cam_data.lens = s.get("lens", 40)
            cam_data.clip_start = 0.01
            scene.render.resolution_x, scene.render.resolution_y = s.get("res", [360, 400])
            scene.render.filepath = s["out"]
            bpy.ops.render.render(write_still=True)
    print("[wine] rendered %d frames" % len(job["frames"]))


if bpy is not None:
    _argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    blender_main(_argv)
    raise SystemExit(0)


# =========================================================================== #
#  Python half                                                                 #
# =========================================================================== #

import numpy as np  # noqa: E402
from scipy.optimize import brentq, minimize  # noqa: E402
from scipy.spatial import cKDTree  # noqa: E402

D = np.load(RIG_NPZ)
J = json.loads(RIG_JSON.read_text())
BONES = J["bones"]
BI = {n: i for i, n in enumerate(BONES)}
REST, PARENT, CO, W, NRM = D["rest"], D["parent"], D["co"], D["W"], D["nrm"]
REST_INV = np.linalg.inv(REST)
LOCAL = np.array([REST[i] if PARENT[i] < 0 else REST_INV[PARENT[i]] @ REST[i]
                  for i in range(len(BONES))])
IDLE = {k: list(v) for k, v in J["poses"]["IDLE_A"].items() if not k.startswith("@")}


# ── forward kinematics and skinning, the recursion Blender runs ───────────── #

def euler(v):
    """Blender XYZ Euler, degrees -> 3x3 (Rz @ Ry @ Rx)."""
    x, y, z = (math.radians(a) for a in v)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def to_euler(R):
    """3x3 -> Blender XYZ Euler, degrees."""
    sy = max(-1.0, min(1.0, -R[2, 0]))
    y = math.asin(sy)
    if abs(sy) < 0.99999:
        return (math.degrees(math.atan2(R[2, 1], R[2, 2])), math.degrees(y),
                math.degrees(math.atan2(R[1, 0], R[0, 0])))
    return (math.degrees(math.atan2(-R[1, 2], R[1, 1])), math.degrees(y), 0.0)


def fk(spec):
    """{bone: euler degrees | 3x3} -> (bones, 4, 4) armature-space matrices."""
    out = np.zeros((len(BONES), 4, 4))
    for i, n in enumerate(BONES):
        b = np.eye(4)
        v = spec.get(n)
        if v is not None:
            b[:3, :3] = v if isinstance(v, np.ndarray) else euler(v)
        out[i] = (LOCAL[i] @ b) if PARENT[i] < 0 else (out[PARENT[i]] @ LOCAL[i] @ b)
    return out


def lowest(P):
    """The lowest tail of `TIPS` — what `floor_poses` puts 4 mm off the floor."""
    z = 1e9
    for n in J["tips"]:
        i = BI[n]
        z = min(z, (P[i][:3, 3] + P[i][:3, 1] * J["length"][i])[2])
    return z


def unit(v):
    return v / np.linalg.norm(v)


def band(v, lo, hi):
    return (lo - v) ** 2 if v < lo else ((v - hi) ** 2 if v > hi else 0.0)


# ── the hand's own axes ─────────────────────────────────────────────────── #
#
# r radial (toward the index), l along the hand (wrist to middle knuckle), n
# palmar. Built off the bind pose: l from the `handR` joint to the `fingersR`
# joint, r from the knuckle line (`fingersR` local X runs index to little
# finger), n = r x l — which agrees with the direction the right fingers
# close in to 1 degree.
HI, FI, TI, ALI, AUI = BI["handR"], BI["fingersR"], BI["thumbR"], BI["armLR"], BI["armUR"]
W0 = REST[HI][:3, 3]
_l = unit(REST[FI][:3, 3] - W0)
_k = REST[FI][:3, 0]
_r = unit(-(_k - _k.dot(_l) * _l))
A = np.stack([_r, _l, np.cross(_r, _l)], 1)
A_H = REST[HI][:3, :3].T @ A                   # the same, in handR's local frame
A_F = REST[ALI][:3, :3].T @ A                  # ... and carried by the forearm
HINGE_L = (REST_INV[AUI] @ REST[ALI])[:3, 0]  # the elbow's axis, in armUR's frame


def sang(a, b, ax):
    a = unit(a - a.dot(ax) * ax)
    b = unit(b - b.dot(ax) * ax)
    return math.degrees(math.atan2(np.cross(a, b).dot(ax), a.dot(b)))


def arm_measures(P):
    """The right arm in anatomical terms, all from joint positions and frames.

    flex   + palmar flexion, - extension; the hand's long axis against the
           forearm's, in the plane of the palm's normal
    dev    + ulnar deviation, - radial
    twist  the hand about its own long axis against the forearm. A wrist has
           none; the shipped pour had up to 31 degrees of it.
    pron   + pronation, measured as the palm's normal round the forearm from
           the elbow's hinge axis, which is where it sits with the thumb up
    elbow  interior angle, 180 straight
    off    how far the forearm leaves the elbow's hinge plane (carrying angle)
    """
    Rh = P[HI][:3, :3] @ A_H
    Rf = P[ALI][:3, :3] @ A_F
    sh, el, wr = P[AUI][:3, 3], P[ALI][:3, 3], P[HI][:3, 3]
    yf = unit(wr - el)
    nf = unit(Rf[:, 2] - Rf[:, 2].dot(yf) * yf)
    rf = np.cross(yf, nf)
    l = Rh[:, 1]
    h = P[AUI][:3, :3] @ HINGE_L
    return dict(
        flex=math.degrees(math.atan2(l.dot(nf), l.dot(yf))),
        dev=math.degrees(math.atan2(-l.dot(rf), l.dot(yf))),
        twist=sang(nf, Rh[:, 2], yf), pron=-sang(h, nf, yf),
        elbow=math.degrees(math.acos(max(-1, min(1, -unit(el - sh).dot(yf))))),
        off=math.degrees(math.asin(max(-1, min(1, yf.dot(unit(h)))))),
        Rh=Rh, sh=sh, el=el, wr=wr)


# ── the bottle and the room ─────────────────────────────────────────────── #

# The Dingac's lathe from `kabinaKit` in src/43-jadrija.js, label included.
PROF = np.array([[0.000, 0.0300], [0.005, 0.0368], [0.014, 0.0385], [0.048, 0.0390],
                 [0.128, 0.0390], [0.146, 0.0385], [0.158, 0.0380], [0.171, 0.0364],
                 [0.186, 0.0326], [0.201, 0.0266], [0.215, 0.0203], [0.229, 0.0162],
                 [0.243, 0.0146], [0.286, 0.0144], [0.294, 0.0158], [0.303, 0.0160],
                 [0.306, 0.0152]])
BOT_LEN = 0.306
GLASS_PROF = np.array([[0.0, 0.038], [0.005, 0.038], [0.013, 0.009], [0.074, 0.0053],
                       [0.082, 0.018], [0.093, 0.032], [0.109, 0.0398], [0.130, 0.0425],
                       [0.152, 0.0398], [0.168, 0.0350]])


def radius(h):
    return np.interp(h, PROF[:, 0], PROF[:, 1])


# Where the room is, in her frame, off her own floor. Measured out of the
# running game at the pour mark (`__fr.jad.raw().kabina.kit()` against
# `__fr.jad.bones(['@x', '@z'])`): the table top is 0.706 above the floor she
# stands on (the kabina floor is 16 mm under her mat), the glass stands where
# `kit.wine` is solved from, and the bottle's `kit.rest` falls 0.090 m nearer
# her and 0.075 m further right, because that is where `LAY` put it.
#
# `MARK_BACK` is how much further from the glass her mark is than it was: 0.08.
# Taking a standing bottle from the side, thumb up, forearm neutral, is a hand
# at bottle height with the forearm no more than about 40 degrees below
# horizontal — radial deviation gives 20 of that and the grip's own slant
# (`GRIP_G`) the other 20 — and at the old mark the bottle stood 0.22 m in
# front of her feet, beside her hip. Nothing reaches down beside its own hip
# with a forearm that flat except a squat, and that is what the solve found:
# 53 degrees of knee with the back bolt upright. At 0.30 m it is a lean and a
# knee, which is what a person does.
MARK_BACK = 0.08
TOP = 0.706
BOTTLE_FOOT = np.array([0.2245 + MARK_BACK, -0.3097, TOP])
GLASS = np.array([0.315 + MARK_BACK, -0.235, TOP])
RIM = TOP + 0.168
TABLE = (np.array([0.409 + MARK_BACK, -0.181]), 0.300)
# The lip's target: over the middle of the glass, four centimetres above the
# rim. `kit.pourAt` in 43-jadrija.js is the same point.
LIP_T = np.array([GLASS[0], GLASS[1], RIM + 0.040])
# Somebody standing in front of her at the distance you talk to someone.
PLAYER = np.array([1.9, 0.10, 1.62])

# The grip. `GRIP_G` is the slant of the bottle's axis in her palm, degrees off
# the knuckle line, negative toward the heel of the hand; `GRIP_H` is how far up
# the bottle her palm's middle is. See `solve_grip`.
GRIP_G = -20.0
GRIP_H = 0.120


# ── the hand alone ─────────────────────────────────────────────────────── #

HAND = np.where((W[:, HI] + W[:, FI] + W[:, TI]) > 0.05)[0]
_HCO = CO[HAND]
_HWF = W[HAND, FI][:, None]
_HWT = W[HAND, TI][:, None]


def _conj(bone, e):
    B = np.eye(4)
    B[:3, :3] = euler(e)
    return REST[bone] @ B @ REST_INV[bone]


def hand_local(curl, spread, thumb):
    """The hand's vertices, bind pose, fingers and thumb posed, in (r, l, n)
    from the wrist joint. Only two bones move, so their skin matrices are
    conjugations of their own rest frames and the rest are the identity."""
    Sf, St = _conj(FI, (curl, 0.0, spread)), _conj(TI, tuple(thumb))
    vf = _HCO @ Sf[:3, :3].T + Sf[:3, 3]
    vt = _HCO @ St[:3, :3].T + St[:3, 3]
    V = _HCO * (1 - _HWF - _HWT) + _HWF * vf + _HWT * vt
    return (V - W0) @ A


def sdist(V, foot, a):
    """Signed distance of points to the bottle's surface."""
    d = V - foot
    h = d @ a
    rad = np.linalg.norm(d - h[:, None] * a[None], axis=1)
    sd = rad - radius(np.clip(h, 0, BOT_LEN))
    sd = np.where(h < 0, np.maximum(sd, -h), sd)
    return np.where(h > BOT_LEN, np.maximum(sd, h - BOT_LEN), sd)


_V0 = hand_local(0, 0, (0, 0, 0))
PALM = ((_V0[:, 2] > 0.008) & (_V0[:, 1] > -0.005) & (_V0[:, 1] < 0.095)
        & (_V0[:, 0] > -0.04) & (_V0[:, 0] < 0.035))
THUMBV = (_V0[:, 0] > 0.035) & (_V0[:, 1] > 0.03)
TTIP = THUMBV & (_V0[:, 1] > 0.075)
FING = (W[HAND, FI] > 0.5) & (_V0[:, 1] > 0.10)
# The four fingers, told apart by where they sit across the hand at the tips.
_tips = FING & (_V0[:, 1] > 0.12)
_c = np.percentile(_V0[_tips, 0], [10, 35, 65, 90])
for _ in range(30):
    _lab = np.argmin(np.abs(_V0[_tips, 0][:, None] - _c[None]), 1)
    _c = np.sort([_V0[_tips, 0][_lab == j].mean() for j in range(4)])
FLAB = np.full(len(HAND), -1)
FLAB[FING] = np.argmin(np.abs(_V0[FING, 0][:, None] - _c[None]), 1)
FINGER_NAMES = ("little", "ring", "middle", "index")


def grip_axis(g):
    g = math.radians(g)
    return np.array([math.cos(g), math.sin(g), 0.0])


def place_on_palm(V, a, lc, rc=-0.005, gap=0.0005):
    """The axis through (rc, lc, ?) with ? chosen so the palm just touches."""
    return np.array([rc, lc, brentq(
        lambda nc: sdist(V[PALM], np.array([rc, lc, nc]) - a * GRIP_H, a).min() - gap, 0.0, 0.2)])


def first_touch(a, p, spread, thumb, gap=0.0005):
    """The curl at which the first finger reaches the glass, closing from open."""
    def f(curl):
        return sdist(hand_local(curl, spread, thumb)[FING], p - a * GRIP_H, a).min() - gap
    cs = np.arange(0, -171, -5.0)
    vals = [f(c) for c in cs]
    for i in range(1, len(cs)):
        if vals[i] <= 0 < vals[i - 1]:
            return brentq(f, cs[i], cs[i - 1])
    return None


def wrap_angle(V, a, p, mask, sd):
    """How far round the bottle from the palm the nearest vertex of `mask` is,
    degrees, positive toward the fingertips' side."""
    i = np.where(mask)[0][np.argmin(sd[mask])]
    d = V[i] - p
    d = d - (d @ a) * a
    e1 = unit(np.array([0, 0, -1.0]) - a * (-a[2]))
    e2 = np.cross(a, e1)
    if e2[1] < 0:
        e2 = -e2
    return math.degrees(math.atan2(d @ e2, d @ e1))


def grip_build(lc, spread, thumb):
    a = grip_axis(GRIP_G)
    p = place_on_palm(hand_local(-70, spread, thumb), a, lc)
    curl = first_touch(a, p, spread, thumb)
    if curl is None:
        return None
    p = place_on_palm(hand_local(curl, spread, thumb), a, lc)
    curl = first_touch(a, p, spread, thumb) or curl
    V = hand_local(curl, spread, thumb)
    sd = sdist(V, p - a * GRIP_H, a)
    fr = [float(sd[FING & (FLAB == j)].min()) for j in range(4)]
    fa = [wrap_angle(V, a, p, FING & (FLAB == j), sd) for j in range(4)]
    return dict(a=a, p=p, curl=curl, V=V, sd=sd, fingers=fr, wrap=fa,
                thumb_gap=float(sd[THUMBV].min()), ttip=float(sd[TTIP].min()),
                thumb_wrap=wrap_angle(V, a, p, THUMBV, sd), pen=float(sd.min()))


def grip_cost(lc, spread, thumb):
    m = grip_build(lc, spread, thumb)
    if m is None:
        return 1e3
    sd = m["sd"]
    return (1e5 * sum(band(f, 0, 0.006) for f in m["fingers"])
            + 1e5 * band(m["thumb_gap"], 0, 0.0015) + 3e4 * band(m["ttip"], 0, 0.004)
            + 1e5 * float(np.sum(np.minimum(sd + 0.0015, 0) ** 2))
            + 1e-3 * band(m["thumb_wrap"], -130, -60)
            + 1e-3 * sum(band(f, 70, 180) for f in m["wrap"])
            + 1e-4 * spread ** 2 + 1e-1 * band(spread, -12, 12)
            + 1e-5 * float(np.sum(np.square(thumb)))
            + 1e-1 * (band(thumb[0], -70, 60) + band(thumb[1], -35, 30) + band(thumb[2], -20, 85)))


def solve_grip():
    """Search the palm position and finger spread on a grid, the thumb for each
    by simplex, then polish all five together."""
    best = None
    t0 = np.array([16.8, -22.1, 78.9])
    for sp in (0, 4, 8, 12):
        for lc in (0.06, 0.065, 0.07, 0.075):
            r = minimize(lambda t: grip_cost(lc, sp, t), t0, method="Nelder-Mead",
                         options={"maxiter": 500, "xatol": 0.05, "fatol": 1e-8})
            if best is None or r.fun < best[0]:
                best = (r.fun, [lc, sp, *r.x])
    r = minimize(lambda v: grip_cost(v[0], v[1], v[2:]), best[1], method="Nelder-Mead",
                 options={"maxiter": 1500, "xatol": 1e-3, "fatol": 1e-9})
    lc, sp, *th = r.x
    m = grip_build(lc, sp, th)
    out = dict(curl=float(m["curl"]), spread=float(sp), thumb=[float(t) for t in th],
               a=m["a"].tolist(), p=m["p"].tolist(), g=GRIP_G, h=GRIP_H,
               fingers_mm=[f * 1e3 for f in m["fingers"]], wrap=m["wrap"],
               thumb_mm=m["thumb_gap"] * 1e3, thumb_wrap=m["thumb_wrap"], pen_mm=m["pen"] * 1e3)
    GRIP_JSON.write_text(json.dumps(out, indent=1))
    report_grip(out)
    return out


def report_grip(g):
    print("[grip] fingers closed %.1f deg, spread %.1f, thumb (%.1f %.1f %.1f)"
          % (g["curl"], g["spread"], *g["thumb"]))
    print("[grip] finger to glass, mm:   %s" % "  ".join(
        "%s %.1f" % (n, f) for n, f in zip(FINGER_NAMES, g["fingers_mm"])))
    print("[grip] wrapped round from the palm, deg: %s" % "  ".join(
        "%s %.0f" % (n, f) for n, f in zip(FINGER_NAMES, g["wrap"])))
    print("[grip] thumb %.1f mm, %.0f deg the other way; deepest vertex %.1f mm"
          % (g["thumb_mm"], g["thumb_wrap"], g["pen_mm"]))
    conv = lambda v: (v[0], v[2], -v[1])  # noqa: E731  Blender -> game figure space
    at, ax = conv(A @ np.array(g["p"])), conv(A @ np.array(g["a"]))
    print("[grip] BOT_AT (%.4f, %.4f, %.4f)  BOT_AX (%.4f, %.4f, %.4f)  BOT.grip %.3f"
          % (*at, *ax, g["h"]))


# ── the body ─────────────────────────────────────────────────────────────── #

G = json.loads(GRIP_JSON.read_text()) if GRIP_JSON.exists() else None


def _grip_consts():
    g = G or {"curl": -70, "spread": 0, "thumb": [0, 0, 0], "a": [1, 0, 0], "p": [0, 0.06, 0.06]}
    return g["curl"], g["spread"], g["thumb"], np.array(g["a"]), np.array(g["p"])


CURL, SPREAD, THUMB, A_GRIP, P_GRIP = _grip_consts()
# The hand coming at the bottle: fingers straight, thumb swung 40 degrees out
# of its wrap. Checked along the whole closing path — the thumb's other
# settings all put its tip through the glass on the way in.
OPEN_F = [-18.0, 0.0, SPREAD]
OPEN_T = [THUMB[0] + 40.0, THUMB[1], THUMB[2]]
RELAX_F, RELAX_T = [-26.0, 0.0, 0.0], [-12.0, 0.0, 0.0]

# Body parts for the clearance checks, by the bone each vertex mostly follows.
DOM = W.argmax(1)


def _verts(names, step=1):
    return np.where(np.isin(DOM, [BI[n] for n in names]))[0][::step]


_parts = dict(torso=_verts(["pelvis", "spine01", "spine02", "spine03", "chest", "clavicleL"]),
              legs=_verts(["legUL", "legUR", "legLL", "legLR"], 2),
              larm=_verts(["armUL", "armLL", "handL"], 2), rarm=_verts(["armUR", "armLR"]),
              hand=_verts(["handR", "fingersR", "thumbR"]), head=_verts(["head", "neck"], 6))
SUB = np.unique(np.concatenate(list(_parts.values())))
_pos = {v: i for i, v in enumerate(SUB)}
S_ = {k: np.array([_pos[v] for v in a]) for k, a in _parts.items()}
S_["bodyB"] = np.concatenate([S_[k] for k in ("torso", "legs", "larm", "rarm", "head")])
S_["solid"] = np.concatenate([S_["torso"], S_["legs"]])
_WS, _CS, _NS, _DS = W[SUB], CO[SUB], NRM[SUB], DOM[SUB]


def skin_sub(P):
    """Linear blend skinning of the parts above; normals ride the dominant bone."""
    S4 = P @ REST_INV
    M = (_WS @ S4[:, :3, :].reshape(len(BONES), 12)).reshape(-1, 3, 4)
    V = np.einsum('vij,vj->vi', M[:, :, :3], _CS) + M[:, :, 3]
    return V, np.einsum('vij,vj->vi', S4[_DS, :3, :3], _NS)


# The knee dip. Given a knee flexion and a forward tilt of the pelvis, the hip
# and ankle are fitted so each sole stays exactly as flat as IDLE_A's and each
# ankle stays over the same spot — two conditions, two unknowns, per side.
# Tabulated once and interpolated, because the body solve differentiates
# through it numerically and a cache keyed on rounded angles has a gradient of
# nought (which is how the first version of this came to use no knee at all).
_REF = fk(IDLE)
KS, PTS = np.arange(0, 57.5, 2.5), np.arange(-40, 7.5, 2.5)


def _dip_fit(k, pt):
    base = dict(IDLE, pelvis=[IDLE["pelvis"][0] + pt, IDLE["pelvis"][1], IDLE["pelvis"][2]])
    out = []
    for s in ("L", "R"):
        d0 = _REF[BI["foot" + s]][:3, 1]
        x0 = _REF[BI["foot" + s]][:3, 3]

        def spec(h, a):
            return {"legU" + s: [base["legU" + s][0] + h] + base["legU" + s][1:],
                    "legL" + s: [base["legL" + s][0] + k] + base["legL" + s][1:],
                    "foot" + s: [base["foot" + s][0] + a] + base["foot" + s][1:]}

        def cost(v):
            P = fk(dict(base, **spec(*v)))
            f = P[BI["foot" + s]]
            return 400 * (1 - f[:3, 1].dot(d0)) + 900 * ((f[0, 3] - x0[0]) ** 2 + (f[1, 3] - x0[1]) ** 2)

        r = minimize(cost, [-0.5 * k + pt, -0.45 * k], method="Nelder-Mead",
                     options={"xatol": 1e-4, "fatol": 1e-12, "maxiter": 4000})
        out += list(r.x)
    return out


_DIP_NPY = Path("/tmp/wine_dip.npy")
if _DIP_NPY.exists():
    DIP_T = np.load(_DIP_NPY)
else:
    DIP_T = np.array([[_dip_fit(float(k), float(pt)) for pt in PTS] for k in KS])
    np.save(_DIP_NPY, DIP_T)


def dip(k, pt):
    fi_ = np.clip(k / 2.5, 0, len(KS) - 1.0001)
    fj = np.clip((pt - PTS[0]) / 2.5, 0, len(PTS) - 1.0001)
    i, j = int(fi_), int(fj)
    u, v = fi_ - i, fj - j
    t = (DIP_T[i, j] * (1 - u) * (1 - v) + DIP_T[i + 1, j] * u * (1 - v)
         + DIP_T[i, j + 1] * (1 - u) * v + DIP_T[i + 1, j + 1] * u * v)
    b = IDLE
    return {"legUL": [b["legUL"][0] + t[0]] + b["legUL"][1:], "legLL": [b["legLL"][0] + k] + b["legLL"][1:],
            "footL": [b["footL"][0] + t[1]] + b["footL"][1:],
            "legUR": [b["legUR"][0] + t[2]] + b["legUR"][1:], "legLR": [b["legLR"][0] + k] + b["legLR"][1:],
            "footR": [b["footR"][0] + t[3]] + b["footR"][1:],
            "pelvis": [b["pelvis"][0] + pt, b["pelvis"][1], b["pelvis"][2]]}


def wrist_basis(flex, dev):
    """`handR`'s local rotation for a wrist flexed (+palmar) and deviated
    (+ulnar) about the hand's own axes, relative to the rest. It has no
    twist term, which is the point: the only way left to turn the hand over
    is the forearm."""
    c, s = math.cos(math.radians(flex)), math.sin(math.radians(flex))
    Rr = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    c, s = math.cos(math.radians(dev)), math.sin(math.radians(dev))
    Rn = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    return A_H @ (Rn @ Rr) @ A_H.T


# The free numbers of one key. The trunk's flexion is shared out down the
# spine (spine01 takes 40 per cent: a person bending to something at table
# height hinges low), side bend and twist evenly; the neck takes a third of
# the head; the left arm has two numbers so it can go on hanging while the
# body leans over it.
NAMES = ["sx", "sz", "sy", "hx", "hy", "hz", "cy", "cz", "ux", "uy", "uz",
         "lx", "ly", "lz", "wf", "wd", "k", "lux", "luz", "pt"]
IX = {n: i for i, n in enumerate(NAMES)}
BOUNDS = {"sx": (-40, 12), "sz": (-14, 14), "sy": (-25, 25), "hx": (-50, 20), "hy": (-40, 40),
          "hz": (-20, 20), "cy": (-10, 10), "cz": (-15, 20), "ux": (-110, 40), "uy": (-60, 60),
          "uz": (-80, 20), "lx": (-60, 120), "ly": (-100, 100), "lz": (-60, 40), "wf": (-60, 60),
          "wd": (-30, 30), "k": (0, 55), "lux": (-40, 30), "luz": (0, 50), "pt": (-35, 5)}
LB = np.array([BOUNDS[n][0] for n in NAMES], float)
UB = np.array([BOUNDS[n][1] for n in NAMES], float)


def spec_of(x, fingers=None, thumb=None):
    v = dict(zip(NAMES, x))
    s = dict(IDLE)
    for i, (b, share) in enumerate((("spine01", 0.40), ("spine02", 0.25), ("spine03", 0.20), ("chest", 0.15))):
        s[b] = [IDLE[b][0] + v["sx"] * share, IDLE[b][1] + v["sy"] * 0.25, IDLE[b][2] + v["sz"] * 0.25]
    s["neck"] = [IDLE["neck"][0] + v["hx"] * 0.35, v["hy"] * 0.35, v["hz"] * 0.35]
    s["head"] = [IDLE["head"][0] + v["hx"] * 0.65, IDLE["head"][1] + v["hy"] * 0.65,
                 IDLE["head"][2] + v["hz"] * 0.65]
    s["clavicleR"] = [0.0, v["cy"], v["cz"]]
    s["armUR"] = [v["ux"], v["uy"], v["uz"]]
    s["armLR"] = [v["lx"], v["ly"], v["lz"]]
    s["handR"] = wrist_basis(v["wf"], v["wd"])
    s["armUL"] = [v["lux"], IDLE["armUL"][1], v["luz"]]
    s.update(dip(v["k"], v["pt"]))
    s["fingersR"] = list(fingers) if fingers is not None else [CURL, 0.0, SPREAD]
    s["thumbR"] = list(thumb) if thumb is not None else list(THUMB)
    return s


def seed_idle():
    v = {n: 0.0 for n in NAMES}
    v.update(ux=IDLE["armUR"][0], uy=IDLE["armUR"][1], uz=IDLE["armUR"][2],
             lx=IDLE["armLR"][0], ly=IDLE["armLR"][1], lz=IDLE["armLR"][2],
             lux=IDLE["armUL"][0], luz=IDLE["armUL"][2])
    return np.array([v[n] for n in NAMES])


def bottle_of(P):
    """(foot, axis, grip point) of the bottle in her right hand."""
    Rh = P[HI][:3, :3] @ A_H
    g = P[HI][:3, 3] + Rh @ P_GRIP
    a = Rh @ A_GRIP
    return g - a * GRIP_H, a, g


def measure_P(P):
    m = arm_measures(P)
    m["P"] = P
    m["foot"], m["axis"], m["grip"] = bottle_of(P)
    m["lip"] = m["foot"] + m["axis"] * BOT_LEN
    m["tilt"] = math.degrees(math.acos(max(-1, min(1, m["axis"][2]))))
    Rd = P[BI["head"]][:3, :3] @ REST[BI["head"]][:3, :3].T
    m["gaze"], m["headp"] = Rd @ np.array([1.0, 0, 0]), P[BI["head"]][:3, 3]
    return m


def measure(x, goal):
    spec = spec_of(x, goal.get("fingers"), goal.get("thumb"))
    P = fk(spec)
    dz = 0.004 - lowest(P)
    P[:, 2, 3] += dz
    m = measure_P(P)
    m["dz"], m["spec"] = dz, spec
    return m


HS = np.linspace(0.0, BOT_LEN, 24)
HR = radius(HS)


def clearance(m, goal):
    """(penalty, report in metres) for everything that must not go through
    anything else. Negative in the report is inside."""
    V, N = skin_sub(m["P"])
    rep, pen = {}, 0.0
    # Her right forearm and hand against her torso and legs, signed by the
    # nearest surface vertex's normal. Not the upper arm within 15 cm of the
    # shoulder: the armpit is a fold, and a nearest-vertex sign in a fold is
    # noise (IDLE_A itself reads -37 mm there).
    solid = S_["solid"]
    tree = cKDTree(V[solid])
    q = V[np.concatenate([S_["rarm"], S_["hand"]])]
    q = q[np.linalg.norm(q - m["sh"], axis=1) > 0.15]
    d, j = tree.query(q)
    sd = np.where(np.einsum('ij,ij->i', q - V[solid][j], N[solid][j]) < 0, -d, d)
    rep["arm_body"] = float(sd.min())
    pen += 2e4 * float(np.sum(np.minimum(sd - 0.006, 0) ** 2))
    # Nothing of her inside the tabletop, a slab 64 mm deep under TOP.
    hd = np.linalg.norm(V[:, :2] - TABLE[0], axis=1)
    slab = (hd < TABLE[1]) & (V[:, 2] < TOP + 0.004) & (V[:, 2] > TOP - 0.064)
    depth = np.where(slab, np.minimum(np.minimum(V[:, 2] - (TOP - 0.064), TOP + 0.004 - V[:, 2]),
                                      TABLE[1] - hd), 0.0)
    rep["table_body"] = -float(depth.max())
    pen += 2e4 * float(np.sum(depth ** 2))
    if goal.get("static_bottle"):
        hv = V[S_["hand"]] - BOTTLE_FOOT
        h = hv[:, 2]
        gap = np.where((h > 0) & (h < BOT_LEN),
                       np.linalg.norm(hv[:, :2], axis=1) - radius(np.clip(h, 0, BOT_LEN)), 1.0)
        rep["hand_bottle"] = float(gap.min())
        pen += 2e4 * float(np.sum(np.minimum(gap - goal.get("static_gap", 0.004), 0) ** 2))
    if goal.get("held", True):
        foot, a = m["foot"], m["axis"]
        d = V[S_["bodyB"]] - foot
        h = d @ a
        gap = np.where((h > 0) & (h < BOT_LEN), np.linalg.norm(d - h[:, None] * a[None], axis=1)
                       - radius(np.clip(h, 0, BOT_LEN)), 1.0)
        rep["bottle_body"] = float(gap.min())
        pen += 2e4 * float(np.sum(np.minimum(gap - 0.010, 0) ** 2))
        axp = foot[None] + HS[:, None] * a[None]
        low = axp[:, 2] - HR * np.linalg.norm(np.array([0, 0, -1.0]) + a * a[2])
        on = np.linalg.norm(axp[:, :2] - TABLE[0], axis=1) < TABLE[1] + 0.02
        tgap = np.where(on, low - TOP, 1.0)
        rep["bottle_table"] = float(tgap.min())
        if not goal.get("on_table"):
            pen += 2e4 * float(np.sum(np.minimum(tgap - 0.008, 0) ** 2))
        gh = axp[:, 2] - TOP
        gr = np.interp(np.clip(gh, 0, 0.168), GLASS_PROF[:, 0], GLASS_PROF[:, 1])
        ggap = np.where((gh > -0.02) & (gh < 0.188),
                        np.linalg.norm(axp[:, :2] - GLASS[:2], axis=1) - gr - HR, 1.0)
        rep["bottle_glass"] = float(ggap.min())
        pen += 2e4 * float(np.sum(np.minimum(ggap - 0.006, 0) ** 2))
    return pen, rep


def cost(x, goal, verbose=False):
    m = measure(x, goal)
    v = dict(zip(NAMES, x))
    p = {}
    p["bounds"] = 1e-1 * sum(band(x[i], *BOUNDS[n]) for i, n in enumerate(NAMES))
    if "grip" in goal:
        p["grip"] = goal.get("gripW", 3e4) * float(np.sum((m["grip"] - goal["grip"]) ** 2))
    if "axis" in goal:
        p["axis"] = 30.0 * float(1 - m["axis"].dot(goal["axis"]))
    if "axAz" in goal:
        p["axAz"] = 1e-2 * band(math.degrees(math.atan2(m["axis"][1], m["axis"][0])), *goal["axAz"])
    if "lip" in goal:
        p["lip"] = 3e4 * float(np.sum((m["lip"] - goal["lip"]) ** 2))
    if "tilt" in goal:
        p["tilt"] = 2e-2 * band(m["tilt"], *goal["tilt"])
    # Human ranges. Radial deviation is the tight one, 18 or so; pronation is
    # kept near neutral except where the pour needs it.
    p["wrist"] = (2e-3 * (band(m["flex"], *goal.get("flexB", (-35, 40)))
                          + band(m["dev"], *goal.get("devB", (-18, 25))))
                  + 3e-5 * (m["flex"] ** 2 + m["dev"] ** 2))
    p["pron"] = 2e-3 * band(m["pron"], *goal.get("pronB", (-25, 25)))
    p["elbow"] = 2e-3 * band(m["elbow"], 70, 165)
    p["off"] = 2e-3 * band(m["off"], -5, 25)
    p["trunk"] = 1e-4 * (v["sz"] ** 2 + v["sy"] ** 2) + 2e-3 * band(v["sx"], *goal.get("leanB", (-30, 5)))
    # Knees cost more than a lean: bending to a table is a hinge first.
    p["knee"] = 1.2e-4 * v["k"] ** 2 + 4e-5 * v["pt"] ** 2
    p["uy"] = 1e-4 * band(v["uy"], -35, 35)
    lu = unit(m["P"][BI["armLL"]][:3, 3] - m["P"][BI["armUL"]][:3, 3])
    p["larm"] = 2.0 * (1 + lu[2])
    if "look" in goal:
        to = unit(np.array(goal["look"]) - m["headp"])
        p["gaze"] = 30.0 * max(0.0, goal.get("lookCos", 0.9) - m["gaze"].dot(to)) ** 2
    if "palmAz" in goal:
        n = m["Rh"][:, 2]
        p["palmAz"] = 1e-2 * band(math.degrees(math.atan2(n[1], n[0])), *goal["palmAz"])
    if goal.get("near") is not None:
        p["near"] = goal.get("nearW", 2e-5) * float(np.sum((np.array(x) - goal["near"]) ** 2))
    pen, rep = (0.0, {}) if goal.get("noclear") else clearance(m, goal)
    p["clear"] = pen
    c = sum(p.values())
    if verbose:
        m["parts"], m["rep"], m["cost"] = p, rep, c
        return m
    return c


def solve_key(goal, seed, iters=3, rs=0):
    """Bounded quasi-Newton from a few starts: first without the clearance
    terms (cheap and smooth), then with them."""
    rng = np.random.default_rng(rs)
    lb, ub = LB.copy(), UB.copy()
    for nm in goal.get("fix", ()):
        lb[IX[nm]] = ub[IX[nm]] = float(seed[IX[nm]])
    best, bf = None, None
    for k in range(iters):
        x0 = np.clip(np.array(seed, float) + (rng.normal(0, 1, len(seed)) * 8 if k else 0), lb, ub)
        r = minimize(cost, x0, args=(dict(goal, noclear=True),), method="L-BFGS-B",
                     bounds=list(zip(lb, ub)), options={"maxiter": 3000, "eps": 1e-4})
        r = minimize(cost, r.x, args=(goal,), method="L-BFGS-B",
                     bounds=list(zip(lb, ub)), options={"maxiter": 3000, "eps": 1e-4})
        f = cost(r.x, goal)
        if best is None or f < bf:
            best, bf = r.x, f
    return best


def show(nm, x, goal):
    m = cost(x, goal, True)
    print("== %-6s cost %.4f  %s" % (nm, m["cost"], "  ".join(
        "%s %.3f" % (k, v) for k, v in m["parts"].items() if v > 1e-3)))
    print("   wrist flex %+.1f dev %+.1f twist %+.1f  pron %+.1f  elbow %.1f  tilt %.1f  drop %.3f"
          % (m["flex"], m["dev"], m["twist"], m["pron"], m["elbow"], m["tilt"], m["dz"]))
    print("   grip (%+.3f %+.3f %.3f)  lip (%+.3f %+.3f %.3f)  clear mm %s" % (
        *m["grip"], *m["lip"], {k: round(v * 1e3, 1) for k, v in m["rep"].items()}))
    return m


def solve_keys(only=()):
    """Every key, chained: each is seeded from and held near the one it is a
    variation on, so the clip interpolates instead of lurching."""
    keys = json.loads(KEYS_JSON.read_text()) if KEYS_JSON.exists() else {}
    Z = np.array([0, 0, 1.0])
    grasp = BOTTLE_FOOT + Z * GRIP_H
    look_b, look_g = list(grasp), [GLASS[0], GLASS[1], RIM]

    def run(name, goal, seed, iters=3):
        if only and name not in only and name in keys:
            return np.array(keys[name]["x"])
        x = solve_key(goal, seed, iters=iters)
        show(name, x, goal)
        keys[name] = {"x": x.tolist(), "fingers": goal.get("fingers"), "thumb": goal.get("thumb")}
        KEYS_JSON.write_text(json.dumps(keys, indent=1))
        return x

    x = seed_idle()
    x[IX["sx"]], x[IX["k"]], x[IX["ux"]], x[IX["lx"]], x[IX["wd"]] = -30, 40, -20, -20, -18
    # Closed on the bottle where it stands: the grip point where the bottle's
    # is, the bottle's axis upright, the palm facing across it from her right.
    hold = run("HOLD", dict(grip=grasp, axis=Z, look=look_b, lookCos=0.86, palmAz=(35, 125),
                            on_table=True, leanB=(-40, 5)), x, iters=4)
    mh = measure(hold, {})
    away = -mh["Rh"][:, 2]
    away[2] = 0
    away = unit(away)
    # Coming in: the open hand 10 cm out along its own palm's normal, 5 up and
    # 4 back, and on the way there from her side a key that keeps her
    # fingers out of the bottle — lerped straight from IDLE_A to PRE the
    # swing of the lean carries them through it (38 mm, measured).
    pre = run("PRE", dict(grip=grasp + away * 0.10 + Z * 0.05 + np.array([-0.04, 0, 0]), gripW=1e4,
                          axis=mh["axis"], held=False, static_bottle=True, static_gap=0.008,
                          look=look_b, lookCos=0.86, fingers=OPEN_F, thumb=OPEN_T,
                          leanB=(-40, 5), near=hold, nearW=4e-5), hold)
    mid = 0.5 * (seed_idle() + pre)
    run("PRE0", dict(grip=np.array([0.17, -0.37, 0.93]), gripW=4e3, held=False, static_bottle=True,
                     static_gap=0.03, look=look_b, lookCos=0.80, fingers=[-22.0, 0.0, SPREAD * 0.5],
                     thumb=[(OPEN_T[0] - 12) * 0.5, OPEN_T[1] * 0.5, OPEN_T[2] * 0.5],
                     leanB=(-40, 5), near=mid, nearW=1e-4), mid)
    lift = run("LIFT", dict(grip=grasp + np.array([-0.01, -0.01, 0.10]), axis=Z, look=look_g,
                            lookCos=0.86, leanB=(-35, 5), near=hold, nearW=3e-5), hold)
    # The pour. The lip on its target, tipped 100 to 105, the neck pointing
    # across her toward her left so that you, in front of her, see the bottle
    # side-on. Pronation is let out to 85 and ulnar deviation to 28: this is
    # the key the turn happens in, and it is the forearm and the wrist's
    # sideways bend that do it, with the elbow coming out — not the wrist
    # bending back, which is what the shipped version did.
    pour = run("POUR", dict(lip=LIP_T, tilt=(100, 105), axAz=(60, 115), look=look_g, lookCos=0.88,
                            leanB=(-30, 5), flexB=(-35, 35), devB=(-15, 28), pronB=(-30, 85),
                            near=lift, nearW=1e-5), lift, iters=4)
    pourb = run("POUR_B", dict(lip=LIP_T + np.array([0, 0, 0.012]), tilt=(111, 116), axAz=(60, 115),
                               look=look_g, lookCos=0.88, leanB=(-30, 5), flexB=(-35, 35),
                               devB=(-15, 30), pronB=(-30, 88), near=pour, nearW=2e-4), pour)
    mp, mb = measure(pour, {}), measure(pourb, {})
    run("TIP", dict(grip=mp["grip"] + np.array([0, 0.01, 0.03]), gripW=1e4, tilt=(55, 65),
                    look=look_g, lookCos=0.88, leanB=(-30, 5), pronB=(-30, 85), devB=(-15, 28),
                    near=pour, nearW=3e-4), pour)
    run("CUT", dict(grip=mb["grip"] + np.array([0, 0.0, 0.05]), gripW=1e4, tilt=(40, 52),
                    look=look_g, lookCos=0.88, leanB=(-30, 5), pronB=(-30, 85), devB=(-15, 28),
                    near=pourb, nearW=2e-4), pourb)
    run("LIFT2", dict(grip=grasp + np.array([0.0, 0.0, 0.07]), axis=Z, look=look_b, lookCos=0.86,
                      leanB=(-38, 5), near=hold, nearW=6e-5), hold)
    meet = seed_idle()
    meet[IX["k"]] = 8
    # Up, and looking at you. The arms are IDLE_A's: this is the beat where the
    # hands have nothing to do.
    run("MEET", dict(held=False, look=list(PLAYER), lookCos=0.95, fingers=RELAX_F, thumb=RELAX_T,
                     leanB=(-10, 5), near=seed_idle(), nearW=4e-4,
                     fix=("cy", "cz", "ux", "uy", "uz", "lx", "ly", "lz", "wf", "wd", "lux", "luz")), meet)
    return keys


# ── the clip ────────────────────────────────────────────────────────────── #

# Seconds. `wineAt` in src/43-jadrija.js carries the four windows that ride on
# these: `held` across the two HOLD..HOLD pairs, `pour` across TIP..POUR and
# POUR_B..CUT. Move a key and move those with it.
TIMELINE = [
    (0.00, "IDLE"), (0.36, "PRE0"), (0.66, "PRE"), (0.92, "REACH"), (1.10, "HOLD"), (1.24, "HOLD"),
    (1.85, "LIFT"), (2.45, "TIP"), (2.95, "POUR"), (5.20, "POUR_B"), (5.60, "CUT"), (6.20, "LIFT2"),
    (6.60, "HOLD"), (6.75, "HOLD"), (6.95, "REACH"), (7.25, "PRE"), (7.55, "PRE0"), (7.95, "MEET"),
    (8.55, "IDLE"),
]


def wine_at(u):
    sat = lambda v: max(0.0, min(1.0, v))  # noqa: E731
    return (sat((u - 1.10) / 0.12) * (1 - sat((u - 6.60) / 0.12)),
            sat((u - 2.45) / 0.50) * (1 - sat((u - 5.20) / 0.35)))


def key_pose(keys, nm):
    """The pose as it SHIPS: Euler everywhere, the root off the floor pass."""
    if nm == "IDLE":
        d = {k: list(v) for k, v in J["poses"]["IDLE_A"].items()}
        d["@root"] = [0.0, 0.020, 0.004 - lowest(fk(IDLE))]
        return d
    src = keys["HOLD" if nm == "REACH" else nm]
    f = OPEN_F if nm == "REACH" else (src.get("fingers") or [CURL, 0.0, SPREAD])
    t = OPEN_T if nm == "REACH" else (src.get("thumb") or THUMB)
    d = {b: (list(to_euler(v)) if isinstance(v, np.ndarray) else list(v))
         for b, v in spec_of(np.array(src["x"]), f, t).items()}
    d["@root"] = [0.0, 0.0, 0.004 - lowest(fk(d))]
    return d


def lerp_pose(a, b, u):
    return {k: [x + (y - x) * u for x, y in zip(a.get(k, [0, 0, 0]), b.get(k, [0, 0, 0]))]
            for k in set(a) | set(b)}


def sample(seq, t):
    i = 0
    while i < len(seq) - 2 and seq[i + 1][0] <= t:
        i += 1
    (t0, p0), (t1, p1) = seq[i], seq[i + 1]
    u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
    return lerp_pose(p0, p1, u * u * (3 - 2 * u))


def clip_rows(seq):
    """Every frame at 30 fps, measured."""
    dur = seq[-1][0]
    nf = int(round(dur * 30)) + 1
    rows, prev = [], None
    for f in range(nf):
        t = f / (nf - 1) * dur
        d = sample(seq, t)
        P = fk({b: v for b, v in d.items() if not b.startswith("@")})
        P[:, 1, 3] += d["@root"][1]
        P[:, 2, 3] += d["@root"][2]
        m = measure_P(P)
        held, pour = wine_at(t)
        _pen, rep = clearance(m, {"held": held > 0.5})
        rot = sp = 0.0
        if prev is not None:
            dR = m["Rh"] @ prev[1].T
            rot = math.degrees(math.acos(max(-1, min(1, (np.trace(dR) - 1) / 2)))) * 30
            sp = float(np.linalg.norm(m["grip"] - prev[0])) * 30
        prev = (m["grip"].copy(), m["Rh"].copy())
        V, _ = skin_sub(P)
        bf, ba = (m["foot"], m["axis"]) if held > 0.5 else (BOTTLE_FOOT, np.array([0, 0, 1.0]))
        hv = V[S_["hand"]] - bf
        h = hv @ ba
        gap = np.where((h > 0) & (h < BOT_LEN), np.linalg.norm(hv - h[:, None] * ba[None], axis=1)
                       - radius(np.clip(h, 0, BOT_LEN)), 1.0)
        row = dict(t=t, held=held, pour=pour, flex=m["flex"], dev=m["dev"], twist=m["twist"],
                   pron=m["pron"], elbow=m["elbow"], tilt=m["tilt"],
                   lipdx=float(np.linalg.norm(m["lip"][:2] - GLASS[:2])), lipz=float(m["lip"][2] - RIM),
                   rot=rot, speed=sp, hand_bottle=float(gap.min()), **rep)
        if pour > 0:
            want = unit(LIP_T - m["grip"])
            row["aim"] = math.degrees(math.acos(max(-1, min(1, want.dot(m["axis"])))))
        rows.append(row)
    return rows


def report_clip(rows):
    def rng(k, sel=lambda r: True):
        v = [r[k] for r in rows if sel(r) and k in r]
        return "%+8.1f .. %+7.1f" % (min(v), max(v)) if v else "-"
    held = lambda r: r["held"] > 0.99  # noqa: E731
    free = lambda r: r["held"] < 0.01  # noqa: E731
    stream = lambda r: r["pour"] > 0.6  # noqa: E731

    def mm(k, sel=lambda r: True):
        v = [r[k] for r in rows if sel(r) and k in r]
        return "%+7.1f .. %+7.1f mm" % (min(v) * 1e3, max(v) * 1e3) if v else "-"
    print("[clip] %d frames, %.2f s" % (len(rows), rows[-1]["t"]))
    print("[clip] wrist flexion      %s deg  (+ palmar)" % rng("flex"))
    print("[clip] wrist deviation    %s deg  (+ ulnar)" % rng("dev"))
    print("[clip] wrist twist        %s deg  (a wrist has none)" % rng("twist"))
    print("[clip] pronation          %s deg" % rng("pron"))
    print("[clip] elbow              %s deg" % rng("elbow"))
    print("[clip] forearm to body    %s  (IDLE_A itself reads -37 at the hip)" % mm("arm_body"))
    print("[clip] body in tabletop   %s" % mm("table_body"))
    print("[clip] hand vs bottle standing, free frames   %s" % mm("hand_bottle", free))
    print("[clip] hand vs bottle in the hand             %s" % mm("hand_bottle", held))
    print("[clip] bottle vs her body  %s   vs table %s   vs glass %s" % (
        mm("bottle_body", held), mm("bottle_table", held), mm("bottle_glass", held)))
    print("[clip] while the stream shows: spout off the glass's axis %s, above the rim %s, tilt %s"
          % (mm("lipdx", stream), mm("lipz", stream), rng("tilt", stream)))
    print("[clip] aim the game would have to add while pouring: %s deg (capped at 4)" % rng("aim", stream))
    print("[clip] hand turning %s deg/s, grip point moving %s m/s" % (rng("rot"), rng("speed")))


# ── emitting the block human_mh.py ships ─────────────────────────────────── #

EMIT_ORDER = ("PRE0", "PRE", "REACH", "HOLD", "LIFT", "TIP", "POUR", "POUR_B", "CUT", "LIFT2", "MEET")
EMIT_BONES = ("pelvis", "spine01", "spine02", "spine03", "chest", "neck", "head",
              "clavicleR", "armUR", "armLR", "handR", "fingersR", "thumbR", "armUL",
              "legUL", "legLL", "footL", "legUR", "legLR", "footR")


def emit(keys):
    out = []
    for nm in EMIT_ORDER:
        d = key_pose(keys, nm)
        out.append("WINE_%s = dict(IDLE_A, **{" % nm)
        out.append('    "@root": (0.0, 0.0, -0.006),')
        for b in EMIT_BONES:
            v = d[b]
            out.append('    "%s": (%.1f, %.1f, %.1f),' % (b, v[0], v[1], v[2]))
        out.append("})")
        out.append("")
    return "\n".join(out)


def shipped_seq():
    P = J["poses"]
    seq = []
    for t, nm in J["shipped_keys"]:
        d = {k: list(v) for k, v in P[nm].items()}
        spec = {k: v for k, v in d.items() if not k.startswith("@")}
        d["@root"] = [0.0, d.get("@root", [0, 0, 0])[1], 0.004 - lowest(fk(spec))]
        seq.append((t, d))
    return seq


def main(argv):
    if "--check" in argv:
        P = fk(J["check_spec"])
        worst = max(np.abs(P[BI[n]] - D["check_pose"][i]).max() for i, n in enumerate(J["pnames"]))
        S4 = P @ REST_INV
        M = (W @ S4[:, :3, :].reshape(len(BONES), 12)).reshape(-1, 3, 4)
        V = np.einsum('vij,vj->vi', M[:, :, :3], CO) + M[:, :, 3]
        print("[check] FK vs Blender, worst matrix element %.2e" % worst)
        print("[check] skinning vs Blender, worst vertex %.2e m" % np.abs(V - D["check_mesh"]).max())
        for nm in ("IDLE_A",) + tuple("WINE_" + k for k in EMIT_ORDER if k != "REACH"):
            if nm in J["poses"]:
                m = arm_measures(fk({k: v for k, v in J["poses"][nm].items() if not k.startswith("@")}))
                print("[check] %-12s flex %+6.1f dev %+6.1f twist %+6.1f pron %+6.1f elbow %6.1f"
                      % (nm, m["flex"], m["dev"], m["twist"], m["pron"], m["elbow"]))
        return
    if "--grip" in argv:
        solve_grip()
        return
    if G is None:
        sys.exit("run --grip first")
    if "--solve" in argv:
        only = [a for a in argv[argv.index("--solve") + 1:] if not a.startswith("-")]
        solve_keys(only)
        return
    keys = json.loads(KEYS_JSON.read_text()) if KEYS_JSON.exists() else None
    if "--clip" in argv:
        if "--shipped" in argv:
            seq = shipped_seq()
        else:
            seq = [(t, key_pose(keys, nm)) for t, nm in TIMELINE]
        rows = clip_rows(seq)
        Path("/tmp/wine_clip.json").write_text(json.dumps(rows))
        report_clip(rows)
        return
    if "--emit" in argv:
        print(emit(keys))
        return
    if "--render" in argv:
        render(keys, [a for a in argv[argv.index("--render") + 1:] if not a.startswith("-")])
        return
    print(__doc__)


def render(keys, names):
    """Write a job for the Blender half and run it: each named key (or a time
    in seconds along the clip) from in front of her, from her right, and the
    hand close up, to /tmp/wine_<name>_<view>.png."""
    import subprocess
    seq = [(t, key_pose(keys, nm)) for t, nm in TIMELINE]
    frames = []
    for nm in names:
        try:
            t = float(nm)
            d = sample(seq, t)
            held = wine_at(t)[0] > 0.5
        except ValueError:
            d = key_pose(keys, nm)
            held = nm not in ("PRE0", "PRE", "REACH", "MEET")
        P = fk({b: v for b, v in d.items() if not b.startswith("@")})
        P[:, 1, 3] += d["@root"][1]
        P[:, 2, 3] += d["@root"][2]
        m = measure_P(P)
        g = m["grip"]
        views = {"front": ([1.45, 0.05, 1.45], [0.30, -0.25, 0.92], 38),
                 "side": ([0.35, -1.70, 1.15], [0.30, -0.25, 0.92], 38),
                 "hand": (list(g + np.array([0.55, -0.25, 0.20])), list(g), 30)}
        frames.append({
            "spec": {b: v for b, v in d.items() if not b.startswith("@")},
            "root": d["@root"],
            "bottle": {"foot": list(m["foot"]), "axis": list(m["axis"])} if held
            else {"foot": list(BOTTLE_FOOT), "axis": [0, 0, 1]},
            "shots": [{"out": "/tmp/wine_%s_%s.png" % (nm, v), "eye": e, "at": a, "lens": ln}
                      for v, (e, a, ln) in views.items()]})
    job = {"frames": frames, "bottle": PROF.tolist(), "glass": list(GLASS),
           "glass_prof": GLASS_PROF.tolist(), "table": [*TABLE[0], TOP, TABLE[1]]}
    jf = Path("/tmp/wine_render.json")
    jf.write_text(json.dumps(job))
    subprocess.run([str(ROOT / "tools/blender/blender.sh"), "-b", str(ROOT / "build/baye2.blend"),
                    "-P", str(Path(__file__).resolve()), "--", "--render", str(jf)], check=True)


if __name__ == "__main__":
    main(sys.argv[1:])
