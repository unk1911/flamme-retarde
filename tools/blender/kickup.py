#!/usr/bin/env python3
"""The kick-up into the handstand, solved frame by frame and never typed.

    tools/blender/blender.sh -b build/human_mh.blend -P tools/blender/kickup.py \
        -- --write            # solve, measure, write tools/blender/kickup_keys.py
    tools/blender/blender.sh -b build/human_mh.blend -P tools/blender/kickup.py \
        -- --verify           # re-solve and diff against what ships; measure it

WHAT WAS WRONG. `handstand` used to be four blended keys — IDLE_A, CROUCH,
LUNGE, HAND_STAND — and HAND_STAND's `pelvis` is +180. Positive pelvis X tips
her head BACKWARD on this rig (FOURS is −96 to put her face down), so blending
0 → +180 took her over backwards: a back walkover, arms and head first behind
her, which nobody does against a wall. Nothing held the hands or the feet
either — CROUCH and LUNGE put a foot 0.20 m through the floor between them.

WHAT A KICK-UP IS. She faces the wall; arms go up by her ears; she steps into
a lunge; hinges forward at the hips with the arms still by her ears until both
hands are flat on the floor, fingers to the wall; the straight back leg swings
up and over, the bent front leg pushes and follows; the hips come up over the
shoulders and everything turns FORWARD about the hands until her back is to
the wall. So `pelvis` runs 0 → −180, which is the same attitude as HAND_STAND's
+180 and arrives at it the right way round.

HOW IT IS SOLVED. Every one of the 76 frames (2.5 s at 30 fps) is a key, which
is what makes the bake exactly this: `_bake_clip` samples at the key times, so
there is no smoothstep between keys for anything to drift in. Per frame:

- The torso (pelvis, spine, neck, head) is a smooth track through a handful
  of attitudes — `TORSO` below.
- Before the hands are down, the root is a smooth track too. From the plant
  on, it is NOT: the shoulders ride on a sphere round the planted wrists
  (`ARC`, arm-line angle and radius), and the root is wherever the torso
  puts them. That is the "pivot forward over the hands", written as the
  constraint it is.
- Every limb that is on the floor is solved by IK (damped least squares on the
  Euler angles, FK in mathutils) to hold the exact world matrix of its foot
  or hand: the stance feet from IDLE_A, the lunge foot at its landing, the
  hands at HAND_STAND's own palms. Once planted they do not move.
- Limbs in the air follow tracks, blended in from wherever the IK let go.

The hands are solved BACKWARD from the last frame, which is HAND_STAND
verbatim, so the arms arrive at the 1.495.0 solve and not at some other
elbow swivel that also reaches the floor.

THE CLIP TRAVELS, and the game has to know by how much. A kick-up starts a
step and a torso's length behind where the hands land, and HAND_STAND is
authored with its hips on the figure's origin. So the clip starts standing on
the origin and ends in HAND_STAND moved `TRAVEL` metres forward; the game walks
her to a mark that far out from `kit.handSpot` and, on the frame the clip
ends, moves her `TRAVEL` forward and cuts to `handHeld` without a fade — same
pose, same place, nothing to blend. `KICK` in src/43-jadrija.js is this number
and `--verify` checks the two agree.
"""

import math
import re
import sys
from pathlib import Path

import bpy  # type: ignore
import numpy as np
from mathutils import Euler, Matrix, Vector  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
import human_mh as H  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "kickup_keys.py"
GAME = ROOT / "src" / "43-jadrija.js"

FPS = 30
DUR = 2.5
NF = int(round(DUR * FPS)) + 1

# Metres forward from where she stands to where HAND_STAND's origin lands.
TRAVEL = 1.45
# How far the wall is in front of HAND_STAND's origin: `kit.handSpot` is 0.38
# off the boards.
WALL = 0.38

# ── timing (s) ───────────────────────────────────────────────────────────────
T_ARMS = 0.45      # arms up by her ears, still standing
T_LIFT = 0.45      # left foot leaves the floor for the step
T_LAND = 0.85      # and lands, flat, a step ahead
T_PLANT = 1.30     # both palms flat on the floor
T_BACK = 0.96      # right (swing) foot leaves the floor
T_BACK_HEEL = 0.50  # ...its heel starts to rise
T_PUSH = 1.40      # left (push) foot leaves the floor
T_PUSH_HEEL = 1.22  # ...its heel starts to rise

rig = bpy.data.objects["rig"]
REST = {b.name: b.matrix_local.copy() for b in rig.data.bones}
PAR = {b.name: (b.parent.name if b.parent else None) for b in rig.data.bones}
LEN = {b.name: b.length for b in rig.data.bones}
NAMES = [b.name for b in rig.data.bones]
LOC = {n: (REST[PAR[n]].inverted() @ REST[n]) if PAR[n] else REST[n].copy()
       for n in NAMES}

ORDER = ("pelvis", "spine01", "spine02", "spine03", "chest", "neck", "head",
         "armUL", "armLL", "handL", "fingersL", "thumbL",
         "armUR", "armLR", "handR", "fingersR", "thumbR",
         "legUL", "legLL", "footL", "toeL",
         "legUR", "legLR", "footR", "toeR")


# ── forward kinematics ───────────────────────────────────────────────────────

def _basis(rot):
    return Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()


def fk(spec):
    """{bone: armature-space pose matrix}. `@root` is added to the root joint."""
    out = {}
    root = Vector(spec.get("@root", (0.0, 0.0, 0.0)))
    for n in NAMES:
        b = _basis(spec.get(n, (0.0, 0.0, 0.0)))
        p = PAR[n]
        out[n] = (Matrix.Translation(root) @ REST[n] @ b) if p is None \
            else out[p] @ LOC[n] @ b
    return out


def chain(parent_m, names, params):
    out, m = [], parent_m
    for n, rot in zip(names, params):
        m = m @ LOC[n] @ _basis(rot)
        out.append(m)
    return out


def rotvec(Ra, Rb):
    """Rotation vector (rad) taking Ra to Rb, both 3x3."""
    q = (Ra.transposed() @ Rb).to_quaternion()
    ax, ang = q.to_axis_angle()
    if ang > math.pi:
        ang -= 2 * math.pi
    return np.array(ax) * ang


# ── IK: damped least squares over Euler degrees ──────────────────────────────

def ik(parent_m, names, x0, target, ref, w_ref, prev=None, w_prev=0.0,
       w_pos=1000.0, w_rot=60.0, iters=60, lo=None):
    """Solve one limb so its last bone's matrix is `target` (4x4).

    `x0`, `ref`, `prev` are flat lists of 3*len(names) degrees; `w_ref` per
    parameter (a list) keeps the redundant freedoms where the anatomy wants
    them, `w_prev` keeps them where they were last frame.
    """
    x = np.array(x0, dtype=float)
    ref = np.array(ref, dtype=float)
    wr = np.array(w_ref, dtype=float)
    pv = np.array(prev if prev is not None else x0, dtype=float)
    tp = target.to_translation()
    tr = target.to_3x3()

    def res(v):
        ps = [tuple(v[i:i + 3]) for i in range(0, len(v), 3)]
        m = chain(parent_m, names, ps)[-1]
        e_p = np.array(m.to_translation() - tp) * w_pos
        e_r = rotvec(tr, m.to_3x3()) * w_rot
        lim = [max(0.0, m_ - v[j]) * 5.0 for j, m_ in (lo or {}).items()]
        return np.concatenate([e_p, e_r, (v - ref) * wr, (v - pv) * w_prev, lim])

    lam = 1e-2
    r = res(x)
    f = r @ r
    for _ in range(iters):
        J = np.empty((len(r), len(x)))
        for j in range(len(x)):
            d = np.zeros(len(x))
            d[j] = 0.02
            J[:, j] = (res(x + d) - r) / 0.02
        A = J.T @ J
        g = J.T @ r
        improved = False
        for _ in range(8):
            step = np.linalg.solve(A + lam * np.diag(np.diag(A) + 1e-9), -g)
            xn = x + step
            rn = res(xn)
            fn = rn @ rn
            if fn < f:
                x, r, f = xn, rn, fn
                lam = max(lam * 0.3, 1e-7)
                improved = True
                break
            lam *= 8
        if not improved or np.abs(step).max() < 1e-4:
            break
    ps = [tuple(x[i:i + 3]) for i in range(0, len(x), 3)]
    m = chain(parent_m, names, ps)[-1]
    return list(x), (m.to_translation() - tp).length, \
        math.degrees(np.linalg.norm(rotvec(tr, m.to_3x3())))


# ── smooth tracks ────────────────────────────────────────────────────────────

class Track:
    """Cubic Hermite through (t, tuple) keys; Catmull-Rom tangents, flat ends.

    `vel` pins a tangent: {key index: tuple}.
    """

    def __init__(self, keys, vel=None):
        self.t = [k[0] for k in keys]
        self.v = [np.array(k[1], dtype=float) for k in keys]
        n = len(keys)
        self.m = []
        for i in range(n):
            if vel and i in vel:
                self.m.append(np.array(vel[i], dtype=float))
            elif i == 0 or i == n - 1:
                self.m.append(np.zeros_like(self.v[i]))
            else:
                self.m.append((self.v[i + 1] - self.v[i - 1])
                              / (self.t[i + 1] - self.t[i - 1]))

    def __call__(self, t):
        if t <= self.t[0]:
            return self.v[0].copy()
        if t >= self.t[-1]:
            return self.v[-1].copy()
        i = 0
        while self.t[i + 1] < t:
            i += 1
        h = self.t[i + 1] - self.t[i]
        u = (t - self.t[i]) / h
        h00 = 2 * u ** 3 - 3 * u ** 2 + 1
        h10 = u ** 3 - 2 * u ** 2 + u
        h01 = -2 * u ** 3 + 3 * u ** 2
        h11 = u ** 3 - u ** 2
        return (h00 * self.v[i] + h10 * h * self.m[i]
                + h01 * self.v[i + 1] + h11 * h * self.m[i + 1])


def sstep(a, b, t):
    u = min(1.0, max(0.0, (t - a) / (b - a)))
    return u * u * (3 - 2 * u)


def V(p, k, d=(0.0, 0.0, 0.0)):
    return tuple(p.get(k, d))


# ── the two ends ─────────────────────────────────────────────────────────────

START = dict(H.IDLE_A)
# The landing target is HAND_STAND moved TRAVEL forward, with the pelvis
# written the forward way round: −180 is +180's attitude, reached through −90.
END = dict(H.HAND_STAND)
END["pelvis"] = (-180.0, 0.0, 0.0)
_r = H.HAND_STAND["@root"]
END["@root"] = (_r[0] + TRAVEL, _r[1], _r[2])

M_START = fk(START)
M_END = fk(END)

# Arms up by her ears while she is still standing: the handstand's own arm
# angles, which are overhead RELATIVE TO HER TORSO, with the wrist straight.
OVERHEAD = {
    "armUL": V(END, "armUL"), "armLL": V(END, "armLL"), "handL": (-6.0, 0.0, 0.0),
    "armUR": V(END, "armUR"), "armLR": V(END, "armLR"), "handR": (-6.0, 0.0, 0.0),
}

# ── the torso ────────────────────────────────────────────────────────────────
#
# Pelvis X is the whole body's pitch about the hip: 0 standing, −90 face-down
# and level, −180 upside down with her back where her front was.
PITCH = Track([
    (0.00, V(START, "pelvis")),
    (T_ARMS, (1.0, 0.0, -1.0)),
    (T_LAND, (-14.0, 0.0, 0.0)),
    (T_PLANT, (-135.0, 0.0, 0.0)),
    (1.72, (-171.0, 0.0, 0.0)),
    (2.02, (-181.5, 0.0, 0.0)),
    (DUR, V(END, "pelvis")),
])

_SPINE = ("spine01", "spine02", "spine03", "chest")
_TALL = {"spine01": (-1, 0, 0), "spine02": (-1, 0, 0), "spine03": (-2, 0, 0),
         "chest": (-3, 0, 0)}
TORSO = {}
for _b in _SPINE:
    TORSO[_b] = Track([(0.00, V(START, _b)), (T_ARMS, _TALL[_b]),
                       (T_PLANT, _TALL[_b]),
                       # a little hollow as the legs come over, then back
                       (1.95, (V(END, _b)[0] - 2, 0.0, 0.0)),
                       (DUR, V(END, _b))])
# Standing she looks at the spot on the floor a metre and a half ahead; from
# the plant on she looks at the floor between her hands, which upside down is
# neck extension.
TORSO["neck"] = Track([(0.00, V(START, "neck")), (T_ARMS, (-12, 0, 0)),
                       (T_LAND, (-6, 0, 0)), (T_PLANT, (28, 0, 0)),
                       (1.75, (42, 0, 0)), (DUR, V(END, "neck"))])
TORSO["head"] = Track([(0.00, V(START, "head")), (T_ARMS, (-16, 0, 0)),
                       (T_LAND, (-10, 0, 0)), (T_PLANT, (8, 0, 0)),
                       (1.75, (14, 0, 0)), (DUR, V(END, "head"))])

# Fingers and thumbs from relaxed to pressed flat, on the way down.
HANDSHAPE = {b: Track([(0.00, V(START, b)), (1.05, V(START, b)),
                       (T_PLANT - 0.06, V(END, b)), (DUR, V(END, b))])
             for b in ("fingersL", "thumbL", "fingersR", "thumbR")}

# ── the arc over the hands ───────────────────────────────────────────────────
#
# From the plant on, the mid-shoulder is at wrist_mid + r (sin A, 0, cos A):
# A is the arm line's lean from vertical, negative with the shoulders still
# behind the hands (towards her feet), and r is how straight the arms are.
_sh = (M_END["armUL"].to_translation() + M_END["armUR"].to_translation()) / 2
_wr = (M_END["handL"].to_translation() + M_END["handR"].to_translation()) / 2
_d = _sh - _wr
A_END = math.degrees(math.atan2(_d.x, _d.z))
R_END = math.hypot(_d.x, _d.z)
ARC = Track([(T_PLANT, (-15.0, R_END - 0.013)),
             (1.55, (-6.0, R_END - 0.005)),
             (1.80, (0.0, R_END - 0.001)),
             (2.05, (A_END + 2.0, R_END - 0.003)),
             (DUR, (A_END, R_END))])

# ── the feet ─────────────────────────────────────────────────────────────────
STEP = 0.50          # how far the left foot steps forward

HAND_T = {s: M_END["hand" + s].copy() for s in "LR"}   # the planted palms


def _about_ball(m_foot, m_toe, lift):
    """The foot matrix with the heel lifted `lift` degrees about the ball."""
    ball = m_toe.to_translation()
    R = Matrix.Rotation(math.radians(lift), 4, Vector((0.0, 1.0, 0.0)))
    return Matrix.Translation(ball) @ R @ Matrix.Translation(-ball) @ m_foot


FOOT0 = {s: (M_START["foot" + s].copy(), M_START["toe" + s].copy()) for s in "LR"}
_fwd = Matrix.Translation(Vector((STEP, 0.0, 0.0)))
FOOT_LAND = (_fwd @ FOOT0["L"][0], _fwd @ FOOT0["L"][1])


def foot_target(side, t):
    """(foot matrix, toe world rotation) while that foot is on the floor, or None."""
    if side == "R":
        if t >= T_BACK:
            return None
        lift = 38.0 * sstep(T_BACK_HEEL, T_BACK, t)
        m, mt = FOOT0["R"]
        return _about_ball(m, mt, lift), mt.to_3x3()
    # left: stands, steps, lands, pushes, goes
    if t <= T_LIFT:
        m, mt = FOOT0["L"]
        return m, mt.to_3x3()
    if t < T_LAND:
        u = sstep(T_LIFT, T_LAND, t)
        m0, mt0 = FOOT0["L"]
        pos = m0.to_translation().lerp(FOOT_LAND[0].to_translation(), u)
        pos.z += 0.075 * math.sin(math.pi * u)
        # toes a touch up through the swing, heel first on the way in
        pitch = -9.0 * math.sin(math.pi * u)
        R = Matrix.Rotation(math.radians(pitch), 4, Vector((0.0, 1.0, 0.0)))
        m = Matrix.Translation(pos) @ R @ m0.to_3x3().to_4x4()
        return m, (R.to_3x3() @ mt0.to_3x3())
    if t >= T_PUSH:
        return None
    lift = 42.0 * sstep(T_PUSH_HEEL, T_PUSH, t)
    m, mt = FOOT_LAND
    return _about_ball(m, mt, lift), mt.to_3x3()


# Legs once they are off the floor, relative to the pelvis. legU +X swings the
# knee BACK; legL +X bends the knee; the straddle is legU Z (left −, right +).
# Written from the moment the foot leaves the floor: the first key of each
# track is whatever the IK was holding then, at the speed it was moving, so the
# hand-over from planted to airborne is neither a jump nor a stop.
# The heels arrive at the wall: the legs come over past the vertical until
# they are a couple of centimetres off the plaster, and then settle back and
# open into the straddle. LEG_X is the hip extension that puts them there.
LEG_X_T, LEG_X = 1.97, 11.0
SWING = {   # the right leg, straight, up behind her and over
    "legUR": [(T_PLANT, (-20.0, 0.0, -4.0)), (1.55, (-10.0, 0.0, -4.0)),
              (1.80, (8.0, 0.0, -5.0)), (LEG_X_T, (LEG_X, 0.0, -3.0)),
              (2.17, (5.0, 0.0, 14.0)), (DUR, V(END, "legUR"))],
    "legLR": [(T_PLANT, (-2.0, 0.0, 0.0)), (DUR, V(END, "legLR"))],
    "footR": [(T_PLANT, (-32.0, 0.0, 0.0)), (DUR, V(END, "footR"))],
    "toeR": [(T_PLANT, (-20.0, 0.0, 0.0)), (DUR, V(END, "toeR"))],
}
PUSH = {    # the left leg, bent, follows
    "legUL": [(1.66, (-55.0, 0.0, 5.0)), (1.86, (-4.0, 0.0, 4.0)),
              (LEG_X_T + 0.03, (LEG_X - 1.0, 0.0, 3.0)), (2.20, (5.0, 0.0, -15.0)),
              (DUR, V(END, "legUL"))],
    "legLL": [(1.66, (40.0, 0.0, 0.0)), (1.86, (10.0, 0.0, 0.0)),
              (2.08, (0.0, 0.0, 0.0)), (DUR, V(END, "legLL"))],
    "footL": [(1.75, (-32.0, 0.0, 0.0)), (DUR, V(END, "footL"))],
    "toeL": [(1.75, (-20.0, 0.0, 0.0)), (DUR, V(END, "toeL"))],
}

LEG = {s: ("legU" + s, "legL" + s, "foot" + s) for s in "LR"}
ARM = {s: ("armU" + s, "armL" + s, "hand" + s) for s in "LR"}

# How hard each redundant freedom is held. Legs: the knee is a hinge (legL Y,
# Z pinned hard) and thigh twist is soft. Arms: the elbow's carrying angle and
# the wrist's twist pinned, the rest free for the IK.
W_LEG = [0.01, 0.05, 0.02, 0.01, 2.0, 2.0, 0.01, 0.3, 0.3]
W_ARM = [0.004, 0.004, 0.004, 0.01, 0.02, 0.6, 0.004, 0.004, 0.004]


def flat(spec, names):
    out = []
    for n in names:
        out += list(spec.get(n, (0.0, 0.0, 0.0)))
    return out


def unflat(spec, names, x):
    for i, n in enumerate(names):
        spec[n] = tuple(float(a) for a in x[3 * i:3 * i + 3])


def torso_spec(t):
    p = {"pelvis": tuple(PITCH(t))}
    for b, tr in TORSO.items():
        p[b] = tuple(tr(t))
    for b, tr in HANDSHAPE.items():
        p[b] = tuple(tr(t))
    return p


def root_from_arc(t, spec):
    """The root that puts the mid-shoulder on the arc at time t."""
    s = dict(spec)
    s["@root"] = (0.0, 0.0, 0.0)
    M = fk(s)
    sh = (M["armUL"].to_translation() + M["armUR"].to_translation()) / 2
    a, r = ARC(t)
    want = _wr + Vector((r * math.sin(math.radians(a)), 0.0,
                         r * math.cos(math.radians(a))))
    return tuple(want - sh)


OFF = {}     # when each foot actually left the floor, filled by build()
T_REACH = 0.90   # the hands leave the overhead line and head for the floor


def hand_path(s, root_t):
    """Where the hand goes between T_REACH and the plant: from where the
    overhead arm has it, moving the way it was moving, to the palm's spot,
    arriving from above. Monotone per axis, so it never reaches past the
    spot and comes back."""
    def free_hand(t):
        p = torso_spec(t)
        p["@root"] = tuple(root_t(t))
        for k in ARM[s]:
            p[k] = OVERHEAD[k]
        return fk(p)["hand" + s]
    m0 = free_hand(T_REACH)
    p0 = m0.to_translation()
    v0 = (p0 - free_hand(T_REACH - 1.0 / FPS).to_translation()) * FPS
    p1 = HAND_T[s].to_translation()
    dt = T_PLANT - T_REACH
    v1 = Vector((0.0, 0.0, -0.35))
    m = []
    for a in range(3):
        avg = (p1[a] - p0[a]) / dt
        lim = 2.0 * abs(avg)
        m.append(max(-lim, min(lim, v0[a])) if avg * v0[a] > 0 else 0.0)
    return Track([(T_REACH, tuple(p0)), (T_PLANT, tuple(p1))],
                 vel={0: tuple(m), 1: tuple(v1)}), m0.to_quaternion()


def build():
    """Solve every frame. Returns [(t, spec)] and a diagnostics list."""
    ts = [i / FPS for i in range(NF)]
    specs = [None] * NF
    diag = [dict() for _ in range(NF)]
    ip = [i for i, t in enumerate(ts) if t >= T_PLANT - 1e-9]
    i_plant = ip[0]

    # 1. From the plant to the end: the root off the arc, the arms held to the
    #    palms, solved BACKWARD from HAND_STAND itself.
    for i in reversed(ip):
        t = ts[i]
        if i == NF - 1:
            specs[i] = dict(END)
            continue
        p = torso_spec(t)
        p["@root"] = root_from_arc(t, p)
        nxt = specs[i + 1]
        for s in "LR":
            M = fk(dict(p, **{k: nxt[k] for k in ARM[s]}))
            par = M["clavicle" + s]
            x0 = flat(nxt, ARM[s])
            x, ep, er = ik(par, ARM[s], x0, HAND_T[s], flat(END, ARM[s]), W_ARM,
                           prev=x0, w_prev=0.05, w_pos=6000.0, w_rot=300.0)
            unflat(p, ARM[s], x)
            diag[i]["hand" + s] = (ep, er)
        specs[i] = p

    # 2. The root before the plant: a smooth track that arrives at the arc's
    #    own position AND velocity, so the hand-off is not a kink.
    rp = Vector(specs[i_plant]["@root"])
    rq = Vector(specs[i_plant + 1]["@root"])
    v_plant = (rq - rp) * FPS
    r0 = START["@root"]
    ROOT_T = Track([(0.00, r0),
                    (T_ARMS, (r0[0] + 0.012, r0[1], r0[2] - 0.004)),
                    (T_LAND, (0.34, 0.03, -0.05)),
                    (1.12, (0.56, 0.012, -0.13)),
                    (T_PLANT, tuple(rp))], vel={1: (0.06, 0.0, -0.01), 4: tuple(v_plant)})

    # 3. Forward through the whole clip: legs (planted → IK, airborne →
    #    tracks, blended in from wherever the IK let go), and the arms before
    #    the plant (overhead, then IK on to the palms).
    prev_leg = {s: flat(START, LEG[s]) for s in "LR"}
    released = {}
    tracks = {}
    gone = set()
    reach = {}
    arm_prev = {s: flat(START, ARM[s]) for s in "LR"}
    plant_arm = {s: flat(specs[i_plant], ARM[s]) for s in "LR"}
    for i, t in enumerate(ts):
        if i == NF - 1:
            break
        if i == 0:
            specs[0] = dict(START)
            continue
        if i < i_plant:
            p = torso_spec(t)
            p["@root"] = tuple(ROOT_T(t))
            # arms: IDLE → overhead (free), then IK on to the floor
            u = sstep(0.0, T_ARMS, t)
            for s in "LR":
                free = [a + (b - a) * u for a, b in
                        zip(flat(START, ARM[s]), flat(OVERHEAD, ARM[s]))]
                if t < T_REACH:
                    unflat(p, ARM[s], free)
                    arm_prev[s] = free
                    continue
                w = sstep(T_REACH, T_PLANT, t)
                M = fk(dict(p, **{k: v for k, v in zip(ARM[s], [tuple(free[j:j + 3]) for j in (0, 3, 6)])}))
                par = M["clavicle" + s]
                # Arms straight by her ears, swung down from the line of her
                # torso to the palm's spot about the shoulder: the direction
                # turns and the reach stays an arm's length, so the elbows do
                # not fold her hands in front of her face on the way down.
                sh = M["armU" + s].to_translation()
                hf = M["hand" + s].to_translation()
                if s not in reach:
                    reach[s] = (M["hand" + s].to_quaternion(), (hf - sh).length)
                q0, r0_ = reach[s]
                d0 = (hf - sh).normalized()
                d1 = HAND_T[s].to_translation() - sh
                r1 = d1.length
                d = d0.slerp(d1.normalized(), w) if w < 1 else d1.normalized()
                tgt_p = sh + d * min(r0_ + (r1 - r0_) * w, max(r0_, r1) if w >= 1 else 0.472)
                q = q0.slerp(HAND_T[s].to_quaternion(), sstep(T_REACH, T_PLANT - 0.06, t))
                tgt = Matrix.Translation(tgt_p) @ q.to_matrix().to_4x4()
                ref = [a + (b - a) * w for a, b in zip(free, plant_arm[s])]
                x, ep, er = ik(par, ARM[s], arm_prev[s], tgt, ref, [0.05] * 9,
                               prev=arm_prev[s], w_prev=0.05)
                unflat(p, ARM[s], x)
                arm_prev[s] = x
            specs[i] = p
        p = specs[i]
        M = fk(p)
        for s in "LR":
            ft = foot_target(s, t) if s not in gone else None
            if ft is not None:
                m_foot, toe_rot = ft
                # the knee does not bend backwards: legL X >= -4 is straight
                x, ep, er = ik(M["pelvis"], LEG[s], prev_leg[s], m_foot,
                               prev_leg[s], W_LEG, prev=prev_leg[s], w_prev=0.02,
                               lo={3: -4.0})
                if s == "L" and t > T_PUSH_HEEL and ep > 0.0015:
                    # the hips have risen past where the leg can hold the
                    # floor: that is the push-off, and it is now
                    ft = None
            if ft is not None:
                unflat(p, LEG[s], x)
                prev_leg[s] = x
                # the toe stays flat on the floor: undo the foot's pitch
                mf = chain(M["pelvis"], LEG[s], [tuple(x[j:j + 3]) for j in (0, 3, 6)])[-1]
                loc = (mf @ LOC["toe" + s]).to_3x3()
                basis = loc.inverted() @ toe_rot
                p["toe" + s] = tuple(math.degrees(a) for a in basis.to_euler("XYZ"))
                diag[i]["foot" + s] = (ep, er)
                xt = x + list(p["toe" + s])
                old_ = released.get(s)
                v = [(a - b) * FPS for a, b in zip(xt, old_[1])] if old_ else [0.0] * 12
                released[s] = (t, xt, v)
            else:
                gone.add(s)
                OFF[s] = min(OFF.get(s, 9.0), t)
                names = LEG[s] + ("toe" + s,)
                if s not in tracks:
                    keys_ = SWING if s == "R" else PUSH
                    t_rel, x_rel, v_rel = released[s]
                    tracks[s] = {n: Track([(t_rel, tuple(x_rel[3 * j:3 * j + 3]))] + keys_[n],
                                          vel={0: tuple(v_rel[3 * j:3 * j + 3])})
                                 for j, n in enumerate(names)}
                x = []
                for n in names:
                    x += [float(a) for a in tracks[s][n](t)]
                for j, n in enumerate(names):
                    p[n] = tuple(x[3 * j:3 * j + 3])
                prev_leg[s] = x[:9]
        specs[i] = p
    return list(zip(ts, specs)), diag


# ── measuring ────────────────────────────────────────────────────────────────

_body = bpy.data.objects["human"]
_me = _body.data
_nv = len(_me.vertices)
_co = np.empty(_nv * 3)
_me.vertices.foreach_get("co", _co)
_co = np.c_[_co.reshape(_nv, 3), np.ones(_nv)]
_gi = {g.index: g.name for g in _body.vertex_groups}
_bi = {n: i for i, n in enumerate(NAMES)}
_W = np.zeros((_nv, len(NAMES)), dtype=np.float32)
for _v in _me.vertices:
    for _g in _v.groups:
        _n = _gi[_g.group]
        if _n in _bi:
            _W[_v.index, _bi[_n]] = _g.weight
_s = _W.sum(1, keepdims=True)
_s[_s == 0] = 1
_W /= _s
_RINV = [np.array(REST[n].inverted()) for n in NAMES]
_DOM = _W.argmax(1)


def skin_mats(M):
    out = np.zeros((_nv, 3))
    for i, n in enumerate(NAMES):
        w = _W[:, i]
        k = w > 0
        if k.any():
            S = np.array(M[n]) @ _RINV[i]
            out[k] += w[k, None] * (_co[k] @ S.T)[:, :3]
    return out


def quat_fk(qs, root):
    """FK from bone-local quaternions, the way the runtime composes it."""
    out = {}
    for n in NAMES:
        b = qs[n].to_matrix().to_4x4()
        p = PAR[n]
        out[n] = (Matrix.Translation(root) @ REST[n] @ b) if p is None \
            else out[p] @ LOC[n] @ b
    return out


def local_quats(spec):
    return {n: Euler([math.radians(a) for a in spec.get(n, (0, 0, 0))],
                     "XYZ").to_quaternion() for n in NAMES}


def nlerp(a, b, u):
    if a.dot(b) < 0:
        b = -b
    q = a * (1 - u) + b * u
    q.normalize()
    return q


# Regions of the mesh, by the bone that owns each vertex most.
_HANDISH = {_bi[n] for n in ("handL", "handR", "fingersL", "fingersR", "thumbL", "thumbR")}
_FOOTISH = {_bi[n] for n in ("footL", "footR", "toeL", "toeR")}


def measure(keys, sub=4, verbose=True):
    """Everything that has to be true of the clip, sampled at `sub` x 30 fps
    through the runtime's own nlerp between baked frames."""
    frames = [(t, local_quats(s), Vector(s.get("@root", (0, 0, 0)))) for t, s in keys]
    rows = []
    planted = {s: None for s in "LR"}
    worst_slide = 0.0
    worst_palm = 0.0
    feet_slide = {"L": 0.0, "R": 0.0}
    foot_ref = {}
    ishand = np.isin(_DOM, list(_HANDISH))
    for i in range(len(frames) - 1):
        for k in range(sub):
            u = k / sub
            t = frames[i][0] + u / FPS
            qs = {n: nlerp(frames[i][1][n], frames[i + 1][1][n], u) for n in NAMES}
            root = frames[i][2].lerp(frames[i + 1][2], u)
            M = quat_fk(qs, root)
            V_ = skin_mats(M)
            low = V_[:, 2].min()
            nbad = int((V_[:, 2] < -0.005).sum())
            # the palms, once planted
            row = {"t": t, "low": low, "under5": nbad, "front": float(V_[:, 0].max()),
                   "who": NAMES[_DOM[V_[:, 2].argmin()]]}
            if t >= T_PLANT - 1e-6:
                for s in "LR":
                    w = M["hand" + s].to_translation()
                    if planted[s] is None:
                        # what is actually on the floor: this hand's vertices
                        # within 12 mm of it at the moment of the plant
                        side = np.isin(_DOM, [_bi[n + s] for n in ("hand", "fingers", "thumb")])
                        on = np.nonzero(side & (V_[:, 2] < 0.012))[0]
                        planted[s] = (w, on, V_[on, :2].copy())
                    d = (w - planted[s][0]).length
                    worst_slide = max(worst_slide, d)
                    pv = V_[planted[s][1], :2]
                    worst_palm = max(worst_palm, float(np.linalg.norm(pv - planted[s][2], axis=1).max()))
                    row["slide" + s] = d
            # the ball of each foot while it is on the floor
            for s, phase, a, b in (("R", "R", 0.0, OFF["R"]), ("L", "L0", 0.0, T_LIFT),
                                   ("L", "L1", T_LAND, OFF["L"])):
                if a - 1e-6 <= frames[i][0] and frames[i + 1][0] < b - 1e-6:
                    ball = M["toe" + s].to_translation()
                    if phase not in foot_ref:
                        foot_ref[phase] = ball
                    feet_slide[s] = max(feet_slide[s], (ball - foot_ref[phase]).length)
            rows.append(row)
    # last frame
    t, s = keys[-1]
    M = fk(s)
    V_ = skin_mats(M)
    rows.append({"t": t, "low": V_[:, 2].min(), "under5": int((V_[:, 2] < -0.005).sum()),
                 "who": NAMES[_DOM[V_[:, 2].argmin()]]})
    if verbose:
        for r in rows[::sub]:
            print("  t %.3f  lowest %+.4f (%-8s) under-5mm %5d  %s" % (
                r["t"], r["low"], r["who"], r["under5"],
                "  ".join("slide%s %.4f" % (s, r["slide" + s]) for s in "LR" if "slide" + s in r)))
    return rows, worst_slide, worst_palm, feet_slide


# ── through herself ──────────────────────────────────────────────────────────
#
# Her limbs are tubes and her trunk is not, so the test goes that way round:
# every trunk, neck and head vertex against every limb bone as a tube whose
# radius, along its length, is measured off that limb's own vertices at rest
# (the 35th percentile of their distance from the bone, so a flattened thigh is
# not credited with its widest side). A body vertex inside a tube by more than
# 5 mm is a limb through her. Vertices within 0.15 m of the joint a tube hangs
# from are left out: the groin and the armpit are creases skinning folds
# together by design.
_BODY = {_bi[n] for n in ("pelvis", "spine01", "spine02", "spine03", "chest",
                          "neck", "head", "jaw")}
_body_v = np.nonzero(np.isin(_DOM, list(_BODY)))[0][::2]
_TUBES = ("legUL", "legLL", "legUR", "legLR", "armUL", "armLL", "armUR", "armLR")
_PROF = {}
for _nm in _TUBES:
    _h = np.array(REST[_nm].to_translation())
    _t = np.array(REST[_nm] @ Vector((0.0, LEN[_nm], 0.0)))
    _ax = _t - _h
    _k = np.nonzero(_DOM == _bi[_nm])[0]
    _rel = _co[_k, :3] - _h
    _u = _rel @ _ax / (_ax @ _ax)
    _r = np.linalg.norm(_rel - np.outer(_u, _ax), axis=1)
    _bins = []
    for _j in range(10):
        _m = (_u >= _j / 10) & (_u < (_j + 1) / 10)
        _bins.append(float(np.percentile(_r[_m], 35)) if _m.sum() > 8 else 0.0)
    _PROF[_nm] = np.array(_bins)
_JOINT = {"legUL": "legUL", "legLL": "legUL", "legUR": "legUR", "legLR": "legUR",
          "armUL": "armUL", "armLL": "armUL", "armUR": "armUR", "armLR": "armUR"}


def _inside(M, Vb, nm):
    h = np.array(M[nm].to_translation())
    t = np.array(M[nm] @ Vector((0.0, LEN[nm], 0.0)))
    ax = t - h
    rel = Vb - h
    u = rel @ ax / (ax @ ax)
    d = np.linalg.norm(rel - np.outer(u, ax), axis=1)
    k = (u >= 0.0) & (u < 1.0)
    r = np.zeros(len(u))
    r[k] = _PROF[nm][np.minimum((u[k] * 10).astype(int), 9)]
    j = np.array(M[_JOINT[nm]].to_translation())
    far = np.linalg.norm(Vb - j, axis=1) > 0.15
    return np.where(k & far & (r > 0), r - d, -1.0)


def through(keys, every=1):
    """Per frame: how deep the deepest body vertex is inside any limb tube."""
    worst = []
    for t, s in keys[::every]:
        M = fk(s)
        Vb = skin_mats(M)[_body_v]
        deep, who, n = 0.0, "", 0
        for nm in _TUBES:
            pen = _inside(M, Vb, nm)
            k = pen > 0.005
            n += int(k.sum())
            if k.any() and pen.max() > deep:
                deep, who = float(pen.max()), nm
        worst.append((deep, t, who, n))
    return worst


def end_check(keys):
    """The last frame against HAND_STAND moved by TRAVEL: every joint."""
    M = fk(keys[-1][1])
    ref = dict(H.HAND_STAND)
    r = ref["@root"]
    ref["@root"] = (r[0] + TRAVEL, r[1], r[2])
    R = fk(ref)
    return max((M[n].to_translation() - R[n].to_translation()).length for n in NAMES), \
        max(math.degrees(np.linalg.norm(rotvec(M[n].to_3x3(), R[n].to_3x3()))) for n in NAMES)


# ── writing and checking ─────────────────────────────────────────────────────

def dump(keys, path):
    lines = ['"""Generated by tools/blender/kickup.py --write.  DO NOT EDIT.',
             "",
             "The kick-up into HAND_STAND: %d keys, one per baked frame, %.2f s."
             % (len(keys), DUR),
             "Ends in HAND_STAND moved TRAVEL = %.2f m forward (pelvis -180)." % TRAVEL,
             '"""',
             "TRAVEL = %.4f" % TRAVEL,
             "DUR = %.4f" % DUR,
             "",
             "KEYS = ["]
    for t, s in keys:
        lines.append("    (%.6f, {" % t)
        lines.append('        "@root": (%.4f, %.4f, %.4f),' % tuple(s["@root"]))
        for n in ORDER:
            if n in s:
                v = s[n]
                lines.append('        "%s": (%.2f, %.2f, %.2f),' % (n, v[0], v[1], v[2]))
        lines.append("    }),")
    lines.append("]")
    path.write_text("\n".join(lines) + "\n")


def rounded(keys):
    """What the file will hold: the numbers at the precision `dump` writes."""
    out = []
    for t, s in keys:
        r = {"@root": tuple(round(a, 4) for a in s["@root"])}
        for n in ORDER:
            if n in s:
                r[n] = tuple(round(a, 2) for a in s[n])
        out.append((round(t, 6), r))
    return out


def game_travel():
    m = re.search(r"const KICK = ([0-9.]+);", GAME.read_text())
    return float(m.group(1)) if m else None


def report(keys, diag):
    print("[kickup] %d frames, %.2f s, travel %.2f m; feet leave the floor R %.3f s, L %.3f s"
          % (len(keys), DUR, TRAVEL, OFF.get("R", -1), OFF.get("L", -1)))
    wh = max((d.get("hand" + s, (0, 0))[0] for d in diag for s in "LR"), default=0)
    whr = max((d.get("hand" + s, (0, 0))[1] for d in diag for s in "LR"), default=0)
    wf = max((d.get("foot" + s, (0, 0))[0] for d in diag for s in "LR"), default=0)
    wfr = max((d.get("foot" + s, (0, 0))[1] for d in diag for s in "LR"), default=0)
    print("[kickup] IK residuals: hands %.2f mm %.2f deg, feet %.2f mm %.2f deg"
          % (wh * 1000, whr, wf * 1000, wfr))
    for i, d in enumerate(diag):
        for k, (ep, er) in d.items():
            if ep > 0.002 or er > 1.0:
                print("   frame %2d %-6s %.1f mm %.1f deg" % (i, k, ep * 1000, er))
    rows, slide, palm, feet = measure(keys)
    print("[kickup] after the plant: wrist slide %.2f mm, floor-contact hand vertices slide at most %.2f mm"
          % (slide * 1000, palm * 1000))
    print("[kickup] planted feet, ball slide: L %.2f mm  R %.2f mm"
          % (feet["L"] * 1000, feet["R"] * 1000))
    print("[kickup] lowest vertex over the clip %+.4f; worst under -5 mm: %d vertices at t %.3f"
          % (min(r["low"] for r in rows), max(r["under5"] for r in rows),
             max(rows, key=lambda r: r["under5"])["t"]))
    front = max(r.get("front", -9) for r in rows)
    print("[kickup] furthest forward any vertex gets: %.3f m past the end root, "
          "%.3f m short of a wall %.2f m in front of the mark"
          % (front - TRAVEL, TRAVEL + WALL - front, WALL))
    hit = through(keys)
    print("[kickup] limb vertices inside her trunk (mesh, > 4 mm):")
    for deep, t, who, n in hit:
        if n:
            print("   t %.3f  %4d vertices, deepest %.1f mm (%s)" % (t, n, deep * 1000, who))
    print("[kickup] worst: %.1f mm" % (max(h[0] for h in hit) * 1000))
    dp, dr = end_check(keys)
    print("[kickup] last frame vs HAND_STAND + travel: %.2e m, %.2e deg" % (dp, dr))
    g = game_travel()
    print("[kickup] KICK in the game: %s (clip %.2f)" % (g, TRAVEL))
    return rows


def preview(keys, times, out="/tmp/ku-prev", view="side"):
    """EEVEE stills of the solved clip at `times`, one camera for all of them
    so the travel reads. Writes <out>_<view>_<t>.png."""
    H._lights()
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 16
    cam_d = bpy.data.cameras.new("kcam")
    cam_d.lens = 40
    cam = bpy.data.objects.new("kcam", cam_d)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    tgt = Vector((TRAVEL * 0.5, 0.0, 0.85))
    off = {"side": Vector((0.0, 5.2, 0.5)), "front": Vector((5.2, 0.4, 0.5)),
           "back": Vector((-5.2, -0.4, 0.5)), "three": Vector((3.2, 4.0, 0.9))}[view]
    cam.location = tgt + off
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 900, 640
    for t in times:
        i = min(range(len(keys)), key=lambda j: abs(keys[j][0] - t))
        s = keys[i][1]
        H.pose(rig, {k: v for k, v in s.items() if not k.startswith("@")})
        rig.location = Vector(s.get("@root", (0, 0, 0)))
        bpy.context.view_layer.update()
        sc.render.filepath = "%s_%s_%.2f.png" % (out, view, keys[i][0])
        bpy.ops.render.render(write_still=True)
    rig.location = (0, 0, 0)
    H.pose(rig, {})


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    keys, diag = build()
    if "--preview" in argv:
        ts = [float(a) for a in argv[argv.index("--preview") + 1:]
              if a.replace(".", "", 1).isdigit()]
        views = [v for v in ("side", "front", "back", "three") if "--" + v in argv] or ["side"]
        for v in views:
            preview(keys, ts or [i * 0.1 for i in range(26)], view=v)
        if "--quiet" in argv:
            return
    if "--write" in argv:
        keys = rounded(keys)
        report(keys, diag)
        dump(keys, OUT)
        print("[kickup] wrote %s" % OUT)
        return
    if "--verify" in argv:
        import importlib
        sys.path.insert(0, str(OUT.parent))
        ship = importlib.import_module("kickup_keys")
        mine = rounded(keys)
        bad = 0
        if len(ship.KEYS) != len(mine):
            print("[kickup] %d keys ship, %d solved" % (len(ship.KEYS), len(mine)))
            bad += 1
        for (ta, a), (tb, b) in zip(ship.KEYS, mine):
            for k in set(a) | set(b):
                va, vb = a.get(k, (0, 0, 0)), b.get(k, (0, 0, 0))
                if max(abs(x - y) for x, y in zip(va, vb)) > 0.011:
                    print("[kickup] t %.3f %s ships %s, solves %s" % (ta, k, va, vb))
                    bad += 1
        clip = next(c for c in H.CLIPS if c["name"] == "handstand")
        if clip["keys"] is not ship.KEYS:
            print("[kickup] the handstand clip is not KEYS")
            bad += 1
        if game_travel() is None or abs(game_travel() - ship.TRAVEL) > 1e-6:
            print("[kickup] KICK in %s is %s, the clip travels %.4f"
                  % (GAME.name, game_travel(), ship.TRAVEL))
            bad += 1
        report(list(ship.KEYS), diag)
        print("[kickup] verify: %s" % ("clean" if not bad else "%d differences" % bad))
        if bad:
            sys.exit(1)
        return
    report(keys, diag)


main()
