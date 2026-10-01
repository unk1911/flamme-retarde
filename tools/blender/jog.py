"""Baye's jog — solved on her own rig and spliced onto the shipped blob.

    blender -b /path/to/build/human_mh.blend -P tools/blender/jog.py -- --check
    blender -b /path/to/build/human_mh.blend -P tools/blender/jog.py -- --solve
    blender -b /path/to/build/human_mh.blend -P tools/blender/jog.py -- --splice
    tools/blender/blender.sh -b ... -P tools/blender/jog.py -- --render

(1.558.0, 1 Oct 2026.) Misha: *"can we make her less wooden and more
'springy' ... sometimes 'sprint' around"*. Her walk is a walk; played at twice
its rate it is a film running fast (the note over SHOW.pace in
src/43-jadrija.js says so), so a real run is its own clip.

── what is typed and what is solved ───────────────────────────────────────

TYPED, because they are the look and a solver cannot see them: the cadence
and the duty factor, the stance knee's curve (15° at contact, about 40 at
mid-stance, 14 at toe-off), the swing leg's arc (heel to the seat at about
100°, the thigh reaching to -36 and coming back to meet the ground — swing
leg retraction), how far the heel is up at toe-off, the arms and the lean.

SOLVED, per baked frame, on the rig itself (no Blender ops in the loop —
`_setpose` writes Eulers and asks the depsgraph):

  - the STANCE HIP, so the ball of the planted foot (`footL`'s tail) moves
    back relative to the pelvis in a straight line at a constant rate. That
    rate IS the clip's natural speed, and a figure moved at it along the
    ground has a planted foot that does not slide at all — the walk's own
    trap (its keys are smoothstepped, so its foot speeds up and slows down
    four times a step) does not get the chance;
  - the TOE, so that once the heel is up the toe bone stays on the deck and
    she rolls over the ball rather than standing on her toe tip;
  - `@root` z, so the lowest of ball and toe tip is `CLEAR` off the deck on
    every stance frame — which is where the bounce comes from: lowest at
    mid-stance over a bent knee;
  - and the FLIGHT, ballistic between the toe-off and the next contact.

Every baked frame is a key (one key per 1/SAMPLE_FPS-of-the-clip frame), so
`_bake_clip`'s smoothstep between keys samples exactly on them and puts
nothing back. One half-cycle is computed, the other is its `_mirror`, as the
walk does.

── the splice ─────────────────────────────────────────────────────────────

`--splice` appends the clip to build/payload/human_skin.fr3d.gz (packed v8)
the way dive.py's four went onto man_young_fit in 1.530.1: the clip count
bumped, the clip's bytes appended in `pack_skin`'s own layout, every other
byte where it was. The blend is opened and never saved. `--check` first
proves the blend's rig is the shipped rig (names, parents, rest matrices)
and that re-baking `walk` from it reproduces the shipped walk.
"""

import gzip
import json
import math
import struct
import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Vector  # type: ignore

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import human_mh as MH  # noqa: E402
import fr3d_q as FQ  # noqa: E402

ROOT = HERE.parent.parent
BLOB = ROOT / "build" / "payload" / "human_skin.fr3d.gz"
OUT = Path("/tmp/claude-1000/-home-unk1911-flamme-retarde/"
           "05cb3017-6bc5-4caa-911a-33ea177b8a8c/scratchpad/bw/jog")

# ── the numbers that make it a jog ─────────────────────────────────────────
DUR = 0.72            # s a cycle: two steps, 166.7 a minute
NF = 22               # baked frames a cycle — SAMPLE_FPS * DUR, rounded, even
DUTY = 0.33           # of a cycle each foot is down: 0.66 of a step
CLEAR = 0.004         # m off the deck, as every floor pass in human_mh.py
PELVIS = -6.0         # forward carry (walk -2)
HIP_CONTACT = -25.0   # where the stance hip lands: the ball's start point
STANCE_TRAVEL = 0.68  # m the ball travels back under her, contact to toe-off
HEEL_UP = 0.40        # of stance, when the heel leaves the deck
HEEL_PITCH = 52.0     # deg the sole is pitched at toe-off, past flat
# The stance knee, typed — 18 landing, 40 at mid-stance, 10 leaving — and the
# hip solved against it. KNEE_TYPED = 0 solves the knee as well, against
# `height`: tried first, and at her leg length it cannot reach a toe-off with
# the hip extended, so it finds a bent-knee, thigh-vertical toe-off instead,
# which is not a run. With the knee typed the bounce is what the leg gives.
KNEE_TYPED = 1.0
K_CONTACT, K_MID, K_TOEOFF = 18.0, 40.0, 10.0
DIP = 0.040           # (KNEE_TYPED = 0 only) m the hips sink into the stance
RISE = 0.004          # (KNEE_TYPED = 0 only) m higher leaving than landing
ARM = 27.0            # shoulder swing, each way
ELBOW = -39.0         # armLL x: the base mesh's 46° plus this ≈ 85° of bend
ARM_IN = 40.0         # elbows in by the ribs (the walk's 34 bows a bent arm out)
FORE_IN = 16.0        # and the forearm, converging a little less than the walk's
FINGERS = -40.0       # hands loosely closed (IDLE_A's relaxed curl is -26)
SWAY = 2.5           # pelvis roll toward the stance foot
YAW = 4.0             # pelvis turning with the forward leg; chest counters
G = 9.81

STEP = DUR / 2.0
T_TO = DUTY * DUR                      # toe-off, from the step's contact
SWING = DUR - T_TO                     # each foot's time in the air
FRAME = DUR / NF
HALF = NF // 2

# The swing, as (s, hip, knee, ankle-relative-to-flat), s 0 at toe-off and 1
# at contact. The end points are replaced by the solved stance's own.
SWING_KEYS = [
    (0.00, None, None, None),
    (0.18, 20.0, 62.0, -24.0),
    (0.38, 0.0, 100.0, -22.0),       # heel to the seat
    (0.60, -26.0, 88.0, -14.0),
    (0.78, -36.0, 45.0, -6.0),       # the thigh at its highest
    (0.92, -28.0, 22.0, -1.0),       # and coming back to meet the ground
    (1.00, None, None, None),
]


def _setpose(rig, spec):
    """MH.pose without the mode switches: Eulers in, depsgraph updated."""
    for b in rig.pose.bones:
        b.rotation_mode = "XYZ"
        r = spec.get(b.name)
        b.rotation_euler = (0.0, 0.0, 0.0) if r is None else tuple(math.radians(a) for a in r)
    bpy.context.view_layer.update()


def _pt(rig, bone, tail=True):
    pb = rig.pose.bones[bone]
    return rig.matrix_world @ (pb.tail if tail else pb.head)


def _lowest_z(rig, pose):
    """Lowest of every TIP with the pose's `@root` applied (as MH._lowest)."""
    _setpose(rig, {k: v for k, v in pose.items() if not k.startswith("@")})
    r = pose.get("@root", (0.0, 0.0, 0.0))
    return min((_pt(rig, b).z + r[2], b) for b in MH.TIPS if b in rig.pose.bones)


# ── the rig, proved ────────────────────────────────────────────────────────
def shipped():
    raw = FQ.unpack_skin(gzip.decompress(BLOB.read_bytes()))
    _m, _v, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    o = ((44 + nv * 12 * 2 + nv * 3 + nv * 8) + 3) & ~3
    o += ni * 4
    nb, = struct.unpack_from("<I", raw, o); o += 4
    bones = []
    for _ in range(nb):
        ln, = struct.unpack_from("<H", raw, o); o += 2
        n = raw[o:o + ln].decode(); o += ln
        p, *v = struct.unpack_from("<i7f", raw, o); o += 32
        bones.append((n, p, v))
    nc, = struct.unpack_from("<I", raw, o); o += 4
    clips = {}
    for _ in range(nc):
        ln, = struct.unpack_from("<H", raw, o); o += 2
        n = raw[o:o + ln].decode(); o += ln
        d, nf, lp = struct.unpack_from("<fIB", raw, o); o += 12
        fr = []
        for _f in range(nf):
            rt = struct.unpack_from("<3f", raw, o); o += 12
            q = struct.unpack_from("<%dh" % (nb * 4), raw, o); o += nb * 8
            fr.append((rt, q))
        clips[n] = (d, lp, fr)
    assert o == len(raw)
    return bones, clips


def check(rig):
    bones, clips = shipped()
    rest = MH._rest_locals(rig)
    bad = 0
    if [b[0] for b in bones] != [r[0] for r in rest]:
        print("[jog] BONE ORDER DIFFERS", [b[0] for b in bones], [r[0] for r in rest])
        return False
    worst = 0.0
    for (n, p, v), (rn, rp, _lb, lg) in zip(bones, rest):
        t, q = lg.translation, lg.to_quaternion()
        mine = (t.x, t.y, t.z, q.x, q.y, q.z, q.w)
        d = max(abs(a - b) for a, b in zip(mine, v))
        # q and -q are the same turn
        d2 = max(abs(a - b) for a, b in zip(mine[:3] + tuple(-x for x in mine[3:]), v))
        d = min(d, d2)
        worst = max(worst, d)
        if p != rp or d > 1e-4:
            bad += 1
            print("[jog] bone %s differs: parent %d/%d, %.6f" % (n, p, rp, d))
    print("[jog] rig: %d bones, worst rest difference %.2e" % (len(rest), worst))
    # And the walk, re-solved and re-baked here, against the shipped one.
    MH.walk_floor(rig)
    spec = next(c for c in MH.CLIPS if c["name"] == "walk")
    mine = MH._bake_clip(rest, spec)
    mine["frames"] = [(rt, tuple(x for q4 in q for x in q4)) for rt, q in mine["frames"]]
    d, _lp, fr = clips["walk"]
    dq = max(abs(a - b) for (rt, q), (rt2, q2) in zip(fr, mine["frames"]) for a, b in zip(q, q2))
    dr = max(abs(a - b) for (rt, q), (rt2, q2) in zip(fr, mine["frames"]) for a, b in zip(rt, rt2))
    print("[jog] walk re-baked: %d/%d frames, worst quat int16 %d, worst root %.5f m"
          % (len(mine["frames"]), len(fr), dq, dr))
    return bad == 0 and dq <= 2 and dr < 1e-4


# ── the gait ───────────────────────────────────────────────────────────────
def height(u):
    """The pelvis joint's height over stance, as a fraction u of it: down into
    the bent knee and back up, a touch higher leaving than landing. Its slope
    at both ends is close to the flight's own launch and landing speeds, so
    the bounce has no kink in it where the foot meets the deck."""
    return H_CONTACT + RISE * u - DIP * math.sin(math.pi * u)


def heel(u):
    """Degrees past flat the stance ankle is pointed: the heel coming up."""
    if u <= HEEL_UP:
        return 0.0
    w = (u - HEEL_UP) / (1.0 - HEEL_UP)
    return HEEL_PITCH * w ** 1.6


def upper(t):
    """Everything that is not a leg, at time t into the cycle (left stance at 0)."""
    c = math.cos(2.0 * math.pi * t / DUR)
    s = math.sin(2.0 * math.pi * t / DUR)
    # Opposition: the left arm is back as the left foot lands, and a touch
    # late on the leg, which is what an arm hanging off a shoulder does.
    lag = 0.03 * DUR
    arm = -ARM * math.cos(2.0 * math.pi * (t - lag) / DUR)
    el = lambda a: ELBOW - 0.12 * a                      # noqa: E731
    return {
        # Roll toward the stance foot mid-stance (+Z lifts her right hip) and
        # the pelvis turned with the forward leg; the chest takes the turn back.
        "pelvis": (PELVIS, YAW * c, SWAY * s),
        "spine01": (-1, -0.3 * YAW * c, -0.3 * SWAY * s),
        "spine02": (-1, -0.4 * YAW * c, -0.3 * SWAY * s),
        "spine03": (-1, -0.5 * YAW * c, 0),
        "chest": (-2, -0.6 * YAW * c, 0),
        "neck": (5, 0, 0), "head": (3, 0.4 * YAW * c, 0),
        "clavicleL": (-0.12 * arm, 0, 3), "clavicleR": (0.12 * arm, 0, -3),
        "armUL": (-arm, 0, ARM_IN), "armLL": (el(arm), 0, FORE_IN), "handL": (-6, 0, 0),
        "armUR": (arm, 0, -ARM_IN), "armLR": (el(-arm), 0, -FORE_IN), "handR": (-6, 0, 0),
        # Loose hands, curled a little past IDLE_A's relaxed ones and written
        # the way IDLE_A writes them (the same number on both sides).
        "fingersL": (FINGERS, 0, 0), "thumbL": (MH.RELAX_T, 0, 0),
        "fingersR": (FINGERS, 0, 0), "thumbR": (MH.RELAX_T, 0, 0),
    }


def leg(side, hip, knee, ankle, toe):
    sg = 1.0 if side == "L" else -1.0
    return {
        "legU" + side: (hip, 0, sg * MH.WALK_TRACK),
        "legL" + side: (knee, 0, sg * MH.WALK_SHANK),
        "foot" + side: (ankle, sg * MH.WALK_SOLE, 0),
        "toe" + side: (toe, 0, 0),
    }


def flat(hip, knee):
    return MH._flat(hip, knee, PELVIS)


def solve_stance(rig, t):
    """The planted LEFT leg at time t of stance: hip, knee, ankle, toe.

    Two unknowns, two conditions: the ball where the straight line back under
    her says it is (that is the zero slide), and at the deck with the pelvis
    at `height(u)` (that is the bounce). The knee is what comes out.
    """
    u = t / T_TO
    base = upper(t)

    def pose_with(h, k, toe=0.0):
        p = dict(base)
        p.update(leg("L", h, k, flat(h, k) - heel(u), toe))
        return p

    def f(h, k):
        _setpose(rig, pose_with(h, k))
        b, pv = _pt(rig, "footL"), _pt(rig, "pelvis", tail=False)
        return (b.x - pv.x, b.z - pv.z)

    tx = X_CONTACT - STANCE_TRAVEL * u
    tz = CLEAR - height(u)            # the ball, from the pelvis joint
    h, k = HIP_CONTACT + 50.0 * u, K_CONTACT + 20.0 * math.sin(math.pi * u)
    if KNEE_TYPED:
        # The knee typed, the hip solved for the ball alone; the height is
        # whatever the leg gives.
        k = K_CONTACT + (K_TOEOFF - K_CONTACT) * u + (K_MID - 0.5 * (K_CONTACT + K_TOEOFF)) * math.sin(math.pi * u)
        lo, hi = -70.0, 70.0
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            if f(mid, k)[0] > tx:
                lo = mid
            else:
                hi = mid
        h = 0.5 * (lo + hi)
        tz = f(h, k)[1]
    for _ in range(0 if KNEE_TYPED else 30):
        f0 = f(h, k)
        e = (f0[0] - tx, f0[1] - tz)
        if abs(e[0]) < 1e-5 and abs(e[1]) < 1e-5:
            break
        fh, fk = f(h + 0.05, k), f(h, k + 0.05)
        J = ((fh[0] - f0[0]) / 0.05, (fk[0] - f0[0]) / 0.05,
             (fh[1] - f0[1]) / 0.05, (fk[1] - f0[1]) / 0.05)
        det = J[0] * J[3] - J[1] * J[2]
        dh = (J[3] * e[0] - J[1] * e[1]) / det
        dk = (-J[2] * e[0] + J[0] * e[1]) / det
        h -= max(-5.0, min(5.0, dh))
        k -= max(-5.0, min(5.0, dk))
        k = max(3.0, k)               # no hyperextended knee
    res = f(h, k)
    err = math.hypot(res[0] - tx, res[1] - tz)

    def tip_minus_ball(toe):
        _setpose(rig, pose_with(h, k, toe))
        return _pt(rig, "toeL").z - _pt(rig, "footL").z
    a, b = -60.0, 60.0
    fa = tip_minus_ball(a)
    for _ in range(40):
        m = 0.5 * (a + b)
        fm = tip_minus_ball(m)
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
    toe = 0.5 * (a + b)
    if err > 1e-3:
        print("[jog]   stance u %.2f: residual %.1f mm" % (u, err * 1000))
    return h, k, flat(h, k) - heel(u), toe


def build(rig):
    """Every frame of the cycle, solved."""
    global X_CONTACT, TOE_REST, H_CONTACT
    # Where the ball is at contact: the hip at HIP_CONTACT, the knee at its
    # contact bend, the foot flat.
    _setpose(rig, dict(upper(0.0), **leg("L", HIP_CONTACT, K_CONTACT, flat(HIP_CONTACT, K_CONTACT), 0.0)))
    X_CONTACT = _pt(rig, "footL").x - _pt(rig, "pelvis", tail=False).x
    H_CONTACT = _pt(rig, "pelvis", tail=False).z - _pt(rig, "footL").z + CLEAR
    # The toe angle that lies flat with a flat foot.
    TOE_REST = 0.0

    stance = {}
    for kf in range(HALF + 1):
        t = kf * FRAME
        if t <= T_TO + 1e-9:
            stance[kf] = solve_stance(rig, t)
    end = solve_stance(rig, T_TO)
    print("[jog] toe-off: hip %+.1f knee %.1f ankle %+.1f toe %+.1f" % end)
    beg = solve_stance(rig, 0.0)
    TOE_REST = beg[3]

    keys = [(s, h, k, a) for s, h, k, a in SWING_KEYS]
    keys[0] = (0.0, end[0], end[1], end[2] - flat(end[0], end[1]))
    keys[-1] = (1.0, beg[0], beg[1], beg[2] - flat(beg[0], beg[1]))

    def swing(s):
        """Catmull-Rom through the swing keys, s in [0, 1]."""
        s = max(0.0, min(1.0, s))
        i = 0
        while i < len(keys) - 2 and keys[i + 1][0] <= s:
            i += 1
        p0 = keys[max(0, i - 1)]; p1 = keys[i]; p2 = keys[i + 1]; p3 = keys[min(len(keys) - 1, i + 2)]
        u = (s - p1[0]) / (p2[0] - p1[0])
        out = []
        for c in (1, 2, 3):
            # Non-uniform Catmull-Rom tangents (finite differences in s).
            m1 = (p2[c] - p0[c]) / (p2[0] - p0[0]) * (p2[0] - p1[0])
            m2 = (p3[c] - p1[c]) / (p3[0] - p1[0]) * (p2[0] - p1[0])
            u2, u3 = u * u, u * u * u
            out.append((2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1
                       + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2)
        h, k, rel = out
        # The toe: on the deck's angle as it leaves, relaxed to the rest one.
        w = min(1.0, s / 0.25)
        toe = end[3] + (TOE_REST - end[3]) * (w * w * (3 - 2 * w))
        return h, k, flat(h, k) + rel, toe

    poses, zs = [], []
    for kf in range(HALF + 1):          # the last is the next contact, for the flight
        t = kf * FRAME
        p = upper(t)
        if kf in stance:
            p.update(leg("L", *stance[kf]))
        else:
            p.update(leg("L", *swing((t - T_TO) / SWING)))
        # The right foot left the deck at T_TO - STEP, and lands at STEP.
        sR = (t - (T_TO - STEP)) / SWING
        if kf == HALF:
            hR = beg
        else:
            hR = swing(sR)
        p.update(leg("R", *hR))
        p["@root"] = (0.0, 0.0, 0.0)
        poses.append(p)
    # The root on the stance frames: lowest of the planted ball/toe at CLEAR.
    def planted_z(p, side):
        _setpose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
        return min(_pt(rig, "foot" + side).z, _pt(rig, "toe" + side).z)
    rz = {}
    for kf, p in enumerate(poses):
        if kf in stance:
            rz[kf] = CLEAR - planted_z(p, "L")
    # The next contact (frame HALF) stands on the right.
    rz[HALF] = CLEAR - planted_z(poses[HALF], "R")
    # Toe-off itself, between frames, for the flight's start.
    pto = upper(T_TO); pto.update(leg("L", *end)); pto.update(leg("R", *swing((T_TO - (T_TO - STEP)) / SWING)))
    z_to = CLEAR - planted_z(pto, "L")
    # Launch velocity: the stance root's own rate at toe-off (one-sided).
    pre = upper(T_TO - 0.01); stp = solve_stance(rig, T_TO - 0.01)
    pre.update(leg("L", *stp)); pre.update(leg("R", *swing((T_TO - 0.01 - (T_TO - STEP)) / SWING)))
    vz_stance = (z_to - (CLEAR - planted_z(pre, "L"))) / 0.01
    tf = STEP - T_TO
    vz = (rz[HALF] - z_to) / tf + 0.5 * G * tf
    print("[jog] contact: ball %.3f m ahead, pelvis joint %.3f m up" % (X_CONTACT, H_CONTACT))
    print("[jog] flight %.3f s: launch %.2f m/s needed, the stance arrives at %.2f"
          % (tf, vz, vz_stance))
    for kf in range(HALF + 1):
        if kf not in rz:
            dt = kf * FRAME - T_TO
            rz[kf] = z_to + vz * dt - 0.5 * G * dt * dt
    for kf, p in enumerate(poses):
        p["@root"] = (0.0, 0.0, rz[kf])
    return poses[:HALF], poses[HALF], stance


def measure(rig, half, nxt, stance):
    """Slide, bounce, step length, clearance — the four numbers."""
    v = STANCE_TRAVEL / T_TO
    # Slide: the planted ball's world x, the body carried at v.
    xs = []
    for kf in sorted(stance):
        p = half[kf]
        _setpose(rig, {k: vv for k, vv in p.items() if not k.startswith("@")})
        xs.append(_pt(rig, "footL").x + v * kf * FRAME)
    slide = (max(xs) - min(xs)) * 1000.0
    # Pelvis height (the joint) through the half.
    hips = []
    low = []
    for kf, p in enumerate(half):
        _setpose(rig, {k: vv for k, vv in p.items() if not k.startswith("@")})
        hips.append(_pt(rig, "pelvis", tail=False).z + p["@root"][2])
        z, who = _lowest_z(rig, p)
        low.append((z, who, kf))
    deep = min(low)
    flight = [l for l in low if l[2] not in stance]
    print("[jog] cycle %.3f s (%d frames), %.1f steps/min, duty %.2f (stance %.3f s, flight %.3f s)"
          % (DUR, NF, 120.0 / DUR, DUTY, T_TO, STEP - T_TO))
    print("[jog] natural speed %.3f m/s; step %.3f m; stance travel %.3f m"
          % (v, v * STEP, STANCE_TRAVEL))
    print("[jog] hips %s; bounce %.1f cm (low frame %d, high frame %d)"
          % (" ".join("%.3f" % h for h in hips), (max(hips) - min(hips)) * 100,
             hips.index(min(hips)), hips.index(max(hips))))
    print("[jog] planted ball slide over stance at natural speed: %.2f mm" % slide)
    print("[jog] lowest point: %+.4f m (%s, frame %d); flight frames lowest %s"
          % (deep[0], deep[1], deep[2], ["%+.3f %s" % (z, w) for z, w, _k in flight]))
    for kf in sorted(stance):
        print("[jog]   stance f%d hip %+.1f knee %.1f ankle %+.1f toe %+.1f"
              % ((kf,) + tuple(stance[kf])))
    return {"speed": v, "dur": DUR, "slide_mm": slide, "bounce_cm": (max(hips) - min(hips)) * 100,
            "deep": deep[0], "step": v * STEP}


def clip_spec(half):
    full = list(half) + [MH._mirror(p) for p in half]
    keys = [(i * FRAME, p) for i, p in enumerate(full)] + [(DUR, full[0])]
    return {"name": "jog", "loop": True, "keys": keys}


def clip_bytes_v4(c, nb):
    nbn = c["name"].encode()
    head = struct.pack("<H%dsfIB3x" % len(nbn), len(nbn), nbn, c["dur"], len(c["frames"]),
                       1 if c["loop"] else 0)
    return head, c["frames"]


def splice(rig, spec):
    import numpy as np
    rest = MH._rest_locals(rig)
    c = MH._bake_clip(rest, spec)
    nb = len(rest)
    c["frames"] = [(rt, tuple(x for q4 in q for x in q4)) for rt, q in c["frames"]]
    head, frames = clip_bytes_v4(c, nb)
    root = b"".join(struct.pack("<3f", *rt) for rt, _q in frames)
    quat = np.array([q for _rt, q in frames], np.int64).reshape(len(frames), nb * 4)
    packed_clip = head + root + b"".join(FQ._runs(quat[:, k], 16) for k in range(nb * 4))
    packed = gzip.decompress(BLOB.read_bytes())
    o = nc_offset(packed)
    nc, = struct.unpack_from("<I", packed, o)
    # Never twice.
    if b"\x03\x00jog" in packed[o:]:
        sys.exit("[jog] the blob already has a jog")
    new = packed[:o] + struct.pack("<I", nc + 1) + packed[o + 4:] + packed_clip
    BLOB.write_bytes(FQ.gz(new))
    print("[jog] spliced: %d -> %d clips, +%d bytes raw, blob %d bytes gz"
          % (nc, nc + 1, len(packed_clip), BLOB.stat().st_size))
    # And read straight back through the Python reader, to the frame.
    _b, clips = shipped()
    d, lp, fr = clips["jog"]
    dq = max(abs(a - b) for (rt, q), (rt2, q2) in zip(fr, frames) for a, b in zip(q, q2))
    print("[jog] read back: %.3f s, %d frames, loop %d, worst quat diff %d"
          % (d, len(fr), lp, dq))


def nc_offset(raw):
    """Offset of the clip count in a packed v8 skin (walked as unpack_skin does)."""
    magic, ver, nv, ni = struct.unpack_from("<4sIII", raw, 0)
    assert magic == b"FR3D" and ver == 8, ver
    o = 44
    for _k in range(3):
        _q, o = FQ._unruns(raw, o, nv, 16)
    _a, o = FQ._unruns(raw, o, nv, 16)
    _b, o = FQ._unruns(raw, o, nv, 16)
    o += nv * 3 + nv * 8
    _i, o = FQ._unruns(raw, o, ni, 32)
    nb, = struct.unpack_from("<I", raw, o); o += 4
    for _ in range(nb):
        ln, = struct.unpack_from("<H", raw, o); o += 2 + ln + 32
    return o


def sticks(rig, half):
    """Every bone's head and tail on every frame of the cycle, root applied —
    for a stick-figure contact sheet drawn outside Blender."""
    spec = clip_spec(half)
    out = []
    for t, p in spec["keys"][:-1]:
        _setpose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
        r = Vector(p["@root"])
        out.append({"t": t, "b": {b.name: [list(rig.matrix_world @ b.head + r),
                                          list(rig.matrix_world @ b.tail + r)]
                                  for b in rig.pose.bones}})
    (OUT / "jog_sticks.json").write_text(json.dumps(out))
    print("[jog] sticks: %d frames" % len(out))


def render(rig, half):
    """A contact sheet's worth of frames, side on — EEVEE through MH.render."""
    MH._lights()
    names = []
    for kf in (0, 3, 6, 9):
        p = half[kf]
        MH.pose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
        rig.location.z = p["@root"][2]
        MH.render("jog%02d" % kf, ("side", "front") if kf == 3 else ("side",))
        names.append(kf)
    rig.location.z = 0.0
    print("[jog] rendered", names)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    rig = bpy.data.objects["rig"]
    # `--set NAME=value ...`, for sweeping the typed numbers without editing.
    if "--set" in argv:
        g = globals()
        for kv in argv[argv.index("--set") + 1:]:
            if kv.startswith("-"):
                break
            k, v = kv.split("=")
            g[k] = float(v)
        g["T_TO"] = DUTY * DUR
        g["SWING"] = DUR - g["T_TO"]
    OUT.mkdir(parents=True, exist_ok=True)
    if "--check" in argv:
        ok = check(rig)
        print("[jog] CHECK", "OK" if ok else "FAILED")
        if not ok:
            sys.exit(1)
    if "--solve" in argv or "--splice" in argv or "--render" in argv:
        half, nxt, stance = build(rig)
        m = measure(rig, half, nxt, stance)
        (OUT / "jog_measure.json").write_text(json.dumps(m, indent=1))
        (OUT / "jog_keys.json").write_text(json.dumps([{k: list(v) for k, v in p.items()} for p in half]))
        sticks(rig, half)
        if "--render" in argv:
            render(rig, half)
        if "--splice" in argv:
            if not check(rig):
                sys.exit("[jog] rig check failed; not splicing")
            splice(rig, clip_spec(half))


X_CONTACT = 0.0
TOE_REST = 0.0
H_CONTACT = 0.0

if __name__ == "__main__":
    main()
