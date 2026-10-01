"""Baye's walk, with the planted foot nailed to the deck — the `stroll` clip.

    blender -b /path/to/build/human_mh.blend -P tools/blender/stroll.py -- --solve
    blender -b /path/to/build/human_mh.blend -P tools/blender/stroll.py -- --splice

(1.558.0, 1 Oct 2026.) Misha: *"less wooden and more 'springy', more
human-like and less robotic"*. MEASURED in the game first: the shipped
`walk`'s ball of the foot moves FORWARD 13-16 cm while it is on the deck
just after landing, and the rest of the stance goes back in surges, because
the clip is eight sparse keys smoothstepped — the foot stops dead at every
key and makes up the time between them. Nothing about the LOOK was wrong,
so the look is kept and the contact is solved:

KEPT from WALK (`WALK_KEYS`, `_walk_pose`, the six lateral constants): the
knee curve of both legs, the arms, the sway, the spine, the swing leg's hip
through mid-swing, the 1.00 s cycle with the left heel down at 0 and the
right at 0.5 — so it is phase-compatible with `walk` and `jog` — and the
bounce, which still comes out of the leg geometry and is not authored.

SOLVED per baked frame (30 a cycle, every one its own key), as in jog.py:

  - three rockers under the planted foot. The HEEL from contact until the
    sole comes down flat (it lands toe-up, `P0`), then the whole foot, then
    the BALL as the heel rises, the toe bone held flat on the deck so she
    rolls over it rather than skidding on its tip. The point in contact is
    fixed in the world: in her frame it goes back in a straight line at the
    clip's natural speed, so a figure moved at that speed slides nowhere;
  - the stance HIP that puts it there. While the heel or the flat foot is
    down, `@root` z is what that leg needs; from heel-rise to the next heel
    strike the root is one smooth curve onto that strike's own height
    (`R`), and the heel-up foot is solved TO it — hip and heel pitch for
    the ball's x and z, the walk's knee kept. The walk's knee folds 10 -> 37
    across the double support and a foot cannot stay down under that, so
    the pitch is capped at `PITCH_MAX` and past it the ball keeps its place
    along the deck and peels up: the toe-off. (`HR_SOLVE = "knee"` solves
    the knee instead; at her leg length it cannot reach at all.)
  - the swing hip's two ends, Hermite segments onto the solved toe-off and
    heel-strike hips WITH their angular speeds, and the knee straight by
    0.95, so the heel lands nearly at rest along the ground (swing-leg
    retraction: the thigh peaks forward and comes back to meet the deck);
  - and CLEARANCE: the least extra knee (mid-swing) or hip flexion (late
    swing) that keeps the swinging foot `SWING_CLEAR` off the deck, since
    the walk's swing was authored over different hips.

Stance is 0.56 of the cycle per foot, double support 0.06 each side — the
shipped clip has 0.50, i.e. none, which is part of why it reads as a glide.
"""

import json
import math
import struct
import sys
import gzip
from pathlib import Path

import bpy  # type: ignore
from mathutils import Vector  # type: ignore

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import human_mh as MH  # noqa: E402
import fr3d_q as FQ  # noqa: E402
import jog as J  # noqa: E402

BLOB = J.BLOB
OUT = J.OUT

DUR = 1.00            # s a cycle, as WALK_DUR
NF = 30               # baked frames — SAMPLE_FPS * DUR
V = 1.37              # m/s: SHOW.walk, which the game scales the clock by
CLEAR = 0.004
PEL = MH.WALK_PELVIS
T_FF = 0.08           # of the cycle: heel strike to foot flat
T_HR = 0.32           # the heel starts to rise
T_TO = 0.56           # toe-off (the other heel landed at 0.50)
P0 = 14.0             # deg toe-up at heel strike
PTO = 46.0            # (HR_SOLVE = "knee" only) deg heel-up at toe-off
HEEL_BACK = 0.050     # m the heel's contact is behind the ankle
HR_SOLVE = "pitch"    # late stance: solve the heel pitch (knee kept) — "knee" cannot reach
KNEE_MIN = 2.0
KNEE_AT = 0.95
R_SLOPE = 0.0
PITCH_MAX = 58.0
SWING_CLEAR = 0.015   # m the swinging foot keeps off the deck
KNEE_LAND = 3.0       # deg: the knee, straight, from 0.95 until the heel lands

STEP = 1.0 / NF

# The walk's own legs over a whole cycle, as one leg sees it: planted at 0..0.5
# (WALK_KEYS's planted column) and swinging at 0.5..1 (its swinging column).
_HIP = [k[1][0] for k in MH.WALK_KEYS] + [k[2][0] for k in MH.WALK_KEYS]
_KNEE = [k[1][1] for k in MH.WALK_KEYS] + [k[2][1] for k in MH.WALK_KEYS]
# Arms and sway along the half, extended to a cycle by the mirror's rule:
# both change sign half a cycle on (see `_walk_pose` and `_mirror`).
_ARM = [k[4] for k in MH.WALK_KEYS] + [-k[4] for k in MH.WALK_KEYS]
_SWAY = [k[5] for k in MH.WALK_KEYS] + [-k[5] for k in MH.WALK_KEYS]


def cr(vals, ph):
    """Periodic Catmull-Rom through evenly spaced values over one cycle."""
    n = len(vals)
    x = (ph % 1.0) * n
    i = int(math.floor(x)) % n
    u = x - math.floor(x)
    p0, p1, p2, p3 = vals[(i - 1) % n], vals[i], vals[(i + 1) % n], vals[(i + 2) % n]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)


def dcr(vals, ph, e=1e-4):
    return (cr(vals, ph + e) - cr(vals, ph - e)) / (2 * e)


def herm(t, t0, v0, d0, t1, v1, d1):
    """Cubic Hermite in t between (t0, v0, slope d0) and (t1, v1, d1)."""
    h = t1 - t0
    u = (t - t0) / h
    u2, u3 = u * u, u * u * u
    return ((2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * d0
            + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * d1)


def flat(h, k):
    return MH._flat(h, k, PEL)


def ss(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def pitch_stance(ph):
    """Degrees heel-up (negative: toe-up) of the planted sole."""
    if ph < T_FF:
        return -P0 * (1.0 - ss(ph / T_FF))
    if ph < T_HR:
        return 0.0
    w = (ph - T_HR) / (T_TO - T_HR)
    return PTO * w ** 1.5


SW_PITCH = [(T_TO, PTO), (0.70, 16.0), (0.80, 6.0), (0.90, -6.0), (1.0, -P0)]


def pitch_swing(ph):
    ks = SW_PITCH
    i = 0
    while i < len(ks) - 2 and ks[i + 1][0] <= ph:
        i += 1
    p0, p1, p2, p3 = ks[max(0, i - 1)], ks[i], ks[i + 1], ks[min(len(ks) - 1, i + 2)]
    m1 = (p2[1] - p0[1]) / (p2[0] - p0[0])
    m2 = (p3[1] - p1[1]) / (p3[0] - p1[0])
    return herm(ph, p1[0], p1[1], m1, p2[0], p2[1], m2)


class Gait:
    """One leg's cycle, solved; the frames are both legs off their phases.

    The root height is ONE curve over the half-period, R(t): where the left
    leg's heel or flat foot puts it (t < T_HR, the leg with a straight-ish
    knee decides), and a Hermite from there to the next heel strike's own
    answer — so it is continuous and periodic with no jump at the change of
    support. A planted foot whose heel is up (the trailing foot, and the last
    third of single support) does not set the root: it is SOLVED to it, hip
    and heel pitch for the ball's x and z, with the walk's knee kept.
    """

    def __init__(self, rig):
        self.rig = rig
        self.heel = {}
        up = self.upper(0.0)
        for side in "LR":
            p = dict(up)
            p.update(J.leg(side, 0.0, 0.0, flat(0.0, 0.0), 0.0))
            J._setpose(rig, p)
            pb = rig.pose.bones["foot" + side]
            a, b = pb.head.copy(), pb.tail.copy()
            fwd = Vector((b.x - a.x, b.y - a.y, 0.0)).normalized()
            hp = Vector((a.x, a.y, b.z)) - fwd * HEEL_BACK
            self.heel[side] = pb.matrix.inverted() @ hp
        self.toe_rest = 0.0
        self.memo = {}
        self.rmemo = {}

    def heelpt(self, side):
        pb = self.rig.pose.bones["foot" + side]
        return self.rig.matrix_world @ (pb.matrix @ self.heel[side])

    def upper(self, t):
        """`_walk_pose` at time t for everything but the legs."""
        p = MH._walk_pose(0.0, (0, 0, 0), (0, 0, 0), cr(_ARM, t), cr(_SWAY, t))
        return {k: v for k, v in p.items() if k[:3] not in ("leg", "foo")}

    def knee(self, ph):
        """The walk's knee, except that it finishes straightening BEFORE the
        heel lands (0.95) instead of on it, so the shin is not still swinging
        forward when it meets the deck."""
        A, B = 0.875, KNEE_AT
        if ph < A:
            return cr(_KNEE, ph)
        if ph < B:
            return herm(ph, A, cr(_KNEE, A), dcr(_KNEE, A), B, KNEE_LAND, 0.0)
        return herm(ph, B, KNEE_LAND, 0.0, 1.0, cr(_KNEE, 0.0), dcr(_KNEE, 0.0))

    def _pose(self, side, ph, h, pit, toe=None):
        k = self.knee(ph)
        p = self.upper(ph)
        p.update(J.leg(side, h, k, flat(h, k) - pit, self.toe_rest if toe is None else toe))
        return p

    def _rel(self, what, side):
        pv = J._pt(self.rig, "pelvis", tail=False)
        q = self.heelpt(side) if what == "heel" else J._pt(self.rig, "foot" + side)
        return q.x - pv.x, q.z

    def target_x(self, ph):
        if ph < T_FF:
            return "heel", self.x_heel - V * ph * DUR
        return "ball", self.x_heel + self.L_hb - V * ph * DUR

    def early(self, ph):
        """ph < T_HR: hip for the contact's x; the root this leg needs."""
        if ph in self.rmemo:
            return self.rmemo[ph]
        what, tx = self.target_x(ph)
        pit = pitch_stance(ph)
        lo, hi = -70.0, 70.0
        for _ in range(42):
            m = 0.5 * (lo + hi)
            J._setpose(self.rig, self._pose("L", ph, m, pit))
            if self._rel(what, "L")[0] > tx:
                lo = m
            else:
                hi = m
        h = 0.5 * (lo + hi)
        J._setpose(self.rig, self._pose("L", ph, h, pit))
        z = self.heelpt("L").z if ph < T_FF else min(J._pt(self.rig, "footL").z,
                                                      self.heelpt("L").z)
        out = (h, pit, CLEAR - z)
        self.rmemo[ph] = out
        return out

    def R(self, t):
        """The root's height at time t of the half-period."""
        t = t % 0.5
        if t < T_HR:
            return self.early(t)[2]
        e = 0.004
        r0 = self.early(T_HR - e)[2]
        rA = self.early(T_HR - 2 * e)[2]
        s0 = (r0 - rA) / e
        z1 = self.early(0.0)[2]
        s1 = (self.early(e)[2] - z1) / e
        # The slopes scaled by R_SLOPE: at 1 the curve dips below the heel
        # strike's height on its way there and the swinging leg cannot reach
        # forward straight without putting its heel through the deck.
        return herm(t, T_HR - e, r0, R_SLOPE * s0, 0.5, z1, R_SLOPE * s1)

    def stance(self, ph):
        """The planted LEFT leg at phase ph -> hip, knee, ankle, toe."""
        if ph in self.memo:
            return self.memo[ph]
        rig = self.rig
        k = self.knee(ph)
        if ph < T_HR:
            h, pit, _r = self.early(ph)
            out = (h, k, flat(h, k) - pit, self.toe_rest)
            self.memo[ph] = out
            return out
        _w, tx = self.target_x(ph)
        tz = CLEAR - self.R(ph)          # the ball's height with the root at 0
        # Unknowns: the hip and either the heel pitch (knee kept) or the knee
        # (pitch kept) — HR_SOLVE.
        solve_knee = HR_SOLVE == "knee"
        pit0 = pitch_stance(ph)

        def f(h, q):
            pit, kk = (pit0, q) if solve_knee else (q, k)
            p = self.upper(ph)
            p.update(J.leg("L", h, kk, flat(h, kk) - pit, self.toe_rest))
            J._setpose(rig, p)
            return self._rel("ball", "L")
        prev = self.memo.get("last_hr")
        h = prev[0] if prev else self.early(T_HR - 0.004)[0]
        q = (prev[1] if prev else k) if solve_knee else (prev[1] if prev else 0.0)
        for _ in range(60):
            f0 = f(h, q)
            ex, ez = f0[0] - tx, f0[1] - tz
            if abs(ex) < 2e-5 and abs(ez) < 2e-5:
                break
            fa, fb = f(h + 0.05, q), f(h, q + 0.05)
            a11, a12 = (fa[0] - f0[0]) / 0.05, (fb[0] - f0[0]) / 0.05
            a21, a22 = (fa[1] - f0[1]) / 0.05, (fb[1] - f0[1]) / 0.05
            det = a11 * a22 - a12 * a21
            if abs(det) < 1e-12:
                break
            dh = (a22 * ex - a12 * ez) / det
            dq = (-a21 * ex + a11 * ez) / det
            h -= max(-4.0, min(4.0, dh))
            q -= max(-4.0, min(4.0, dq))
            if solve_knee:
                q = max(KNEE_MIN, q)
            else:
                # A real toe-off peels the ball off the deck at about this; past
                # it the toe joint would be bent further than a foot bends.
                q = min(PITCH_MAX, q)
        if not solve_knee and q >= PITCH_MAX - 1e-6:
            # At the cap: the ball keeps its place along the deck and comes up
            # off it — the toe-off peel — rather than sliding to stay down.
            lo, hi = -70.0, 70.0
            for _ in range(42):
                m = 0.5 * (lo + hi)
                if f(m, q)[0] > tx:
                    lo = m
                else:
                    hi = m
            h = 0.5 * (lo + hi)
            tz = f(h, q)[1] if f(h, q)[1] > tz else tz
        f0 = f(h, q)
        err = math.hypot(f0[0] - tx, f0[1] - tz)
        if err > 5e-4:
            print("[stroll]   ph %.3f: residual %.1f mm" % (ph, err * 1000))
        self.memo["last_hr"] = (h, q)
        pit, k = (pit0, q) if solve_knee else (q, k)

        def lev(tv):
            pp = self.upper(ph)
            pp.update(J.leg("L", h, k, flat(h, k) - pit, tv))
            J._setpose(rig, pp)
            return J._pt(rig, "toeL").z - J._pt(rig, "footL").z
        a, b = -100.0, 100.0
        fa = lev(a)
        for _ in range(40):
            m = 0.5 * (a + b)
            fm = lev(m)
            if (fm > 0) == (fa > 0):
                a, fa = m, fm
            else:
                b = m
        toe = max(self.toe_rest, 0.5 * (a + b))
        out = (h, k, flat(h, k) - pit, toe)
        self.memo[ph] = out
        return out

    def prepare(self):
        rig = self.rig
        # The heel ahead of her at contact: the walk's landing hip and knee,
        # the sole toe-up.
        k0 = self.knee(0.0)
        J._setpose(rig, self._pose("L", 0.0, _HIP[0], -P0))
        self.x_heel = self.heelpt("L").x - J._pt(rig, "pelvis", tail=False).x
        # Heel to ball along the deck, off a flat foot.
        J._setpose(rig, self._pose("L", T_FF, -15.0, 0.0))
        self.L_hb = J._pt(rig, "footL").x - self.heelpt("L").x
        up = self.upper(T_FF)
        k = self.knee(T_FF)

        def lev(tv):
            J._setpose(rig, dict(up, **J.leg("L", -15.0, k, flat(-15.0, k), tv)))
            return J._pt(rig, "toeL").z - J._pt(rig, "footL").z
        a, b = -40.0, 40.0
        fa = lev(a)
        for _ in range(40):
            m = 0.5 * (a + b)
            fm = lev(m)
            if (fm > 0) == (fa > 0):
                a, fa = m, fm
            else:
                b = m
        self.toe_rest = 0.5 * (a + b)
        self.rmemo.clear()
        self.memo.clear()
        # Walk the stance once in order, so the heel-rise Newton is warm-started.
        for i in range(0, int(T_TO * 100) + 1):
            self.stance(min(i / 100.0, T_TO))
        self.stance(T_TO)
        e = 0.005
        self.h0 = self.stance(0.0)[0]
        self.d0 = (self.stance(e)[0] - self.h0) / e
        end = self.stance(T_TO)
        self.h1 = end[0]
        self.d1 = (self.h1 - self.stance(T_TO - e)[0]) / e
        self.toe_to = end[3]
        self.k_to = end[1]
        self.pto = flat(end[0], end[1]) - end[2]
        print("[stroll] heel %.3f ahead at contact (knee %.1f), heel->ball %.3f m, toe flat %+.1f"
              % (self.x_heel, k0, self.L_hb, self.toe_rest))
        print("[stroll] stance hip %+.1f (%+.0f deg/s) -> %+.1f (%+.0f deg/s); "
              "toe-off pitch %.1f, toe %+.1f"
              % (self.h0, self.d0, self.h1, self.d1, self.pto, self.toe_to))

    def swing(self, ph):
        A, B = 0.75, 0.875
        if ph < A:
            h = herm(ph, T_TO, self.h1, self.d1, A, cr(_HIP, A), dcr(_HIP, A))
        elif ph < B:
            h = cr(_HIP, ph)
        else:
            h = herm(ph, B, cr(_HIP, B), dcr(_HIP, B), 1.0, self.h0, self.d0)
        k = self.knee(ph) + (self.k_to - self.knee(T_TO)) * (1.0 - ss((ph - T_TO) / 0.10))
        ks = [(T_TO, self.pto)] + SW_PITCH[1:]
        i = 0
        while i < len(ks) - 2 and ks[i + 1][0] <= ph:
            i += 1
        p0, p1, p2, p3 = ks[max(0, i - 1)], ks[i], ks[i + 1], ks[min(len(ks) - 1, i + 2)]
        m1 = (p2[1] - p0[1]) / (p2[0] - p0[0])
        m2 = (p3[1] - p1[1]) / (p3[0] - p1[0])
        pit = herm(ph, p1[0], p1[1], m1, p2[0], p2[1], m2)
        w = ss((ph - T_TO) / 0.12)
        toe = self.toe_to + (self.toe_rest - self.toe_to) * w
        # CLEARANCE, solved: the walk's swing was authored for a figure whose
        # hips ride where the walk's own floor pass put them, and with this
        # clip's root the swinging foot brushes the deck late in the swing.
        # The least extra knee that keeps the foot's lowest point `margin`
        # off it — tapering to nothing at the heel strike.
        if T_TO + 0.03 < ph < 0.995:
            key = ("clr", round(ph, 6))
            if key not in self.memo:
                margin = CLEAR + SWING_CLEAR * min(1.0, (1.0 - ph) / 0.08)
                rz = self.R(ph)

                # Late in the swing by the HIP (the thigh reaches a little
                # further forward, which lifts a straight leg's heel); before
                # that by the knee.
                by_hip = ph > 0.84

                def low(dk):
                    hh, kk = (h - dk, k) if by_hip else (h, k + dk)
                    p = self.upper(ph)
                    p.update(J.leg("L", hh, kk, flat(hh, kk) - pit, toe))
                    J._setpose(self.rig, p)
                    return min(J._pt(self.rig, "footL").z, J._pt(self.rig, "toeL").z,
                               self.heelpt("L").z) + rz
                dk = 0.0
                if low(0.0) < margin:
                    lo, hi = 0.0, 45.0
                    for _ in range(30):
                        m = 0.5 * (lo + hi)
                        if low(m) < margin:
                            lo = m
                        else:
                            hi = m
                    dk = hi
                self.memo[key] = dk
            dk = self.memo[key]
            if ph > 0.84:
                h -= dk
            else:
                k += dk
        return h, k, flat(h, k) - pit, toe

    def leg(self, ph):
        return self.stance(ph) if ph < T_TO else self.swing(ph)

    def frame(self, k):
        t = k * STEP
        p = self.upper(t)
        phL, phR = t % 1.0, (t + 0.5) % 1.0
        p.update(J.leg("L", *self.leg(phL)))
        # The right leg is the left one half a cycle on, written on the right.
        p.update(J.leg("R", *self.leg(phR)))
        rz = self.R(t)
        p["@root"] = (0.0, 0.0, rz)
        # What each planted foot is off the deck, for the report.
        J._setpose(self.rig, {kk: v for kk, v in p.items() if not kk.startswith("@")})
        gap = 0.0
        for side, ph in (("L", phL), ("R", phR)):
            if ph < T_TO:
                z = J._pt(self.rig, "foot" + side).z
                if ph < T_HR:
                    z = min(z, self.heelpt(side).z)
                gap = max(gap, abs(z + rz - CLEAR))
        return p, gap

    def build(self):
        self.prepare()
        half, gaps = [], []
        for k in range(NF // 2):
            p, gap = self.frame(k)
            half.append(p)
            gaps.append(gap)
        return half, gaps


def spec_of(half, name):
    full = list(half) + [MH._mirror(p) for p in half]
    keys = [(i * STEP * DUR, p) for i, p in enumerate(full)] + [(DUR, full[0])]
    return {"name": name, "loop": True, "keys": keys}


def trace(rig, spec, heelfn=None, dense=False):
    """Every frame: the left foot's ball and heel in the WORLD (her body carried
    at V), its lowest tip, and the pelvis joint's height."""
    keys = spec["keys"]
    dur = keys[-1][0]
    n = NF if not dense else NF * 4
    out = []
    for f in range(n):
        t = f / n * dur
        i = 0
        while i < len(keys) - 2 and keys[i + 1][0] <= t:
            i += 1
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        u = u * u * (3.0 - 2.0 * u)
        p = MH._lerp_pose(p0, p1, u)
        J._setpose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
        r = p.get("@root", (0, 0, 0))
        ball = J._pt(rig, "footL")
        tip = J._pt(rig, "toeL")
        hl = heelfn("L") if heelfn else ball
        low, who = J._lowest_z(rig, p)
        out.append({"t": t, "ball": [ball.x + V * t, ball.z + r[2]],
                    "tip": [tip.x + V * t, tip.z + r[2]],
                    "heel": [hl.x + V * t, hl.z + r[2]],
                    "low": low, "who": who,
                    "hip": J._pt(rig, "pelvis", tail=False).z + r[2]})
    return out


def slide_of(tr, key, lo, hi, zmax=0.012):
    """Ground travel of one foot point over the frames where it is on the deck."""
    xs = [f[key][0] for f in tr if lo <= f["t"] < hi and f[key][1] < zmax]
    return (max(xs) - min(xs)) * 1000.0 if xs else float("nan"), len(xs)


def sticks(rig, spec, name):
    out = []
    for t, p in spec["keys"][:-1]:
        J._setpose(rig, {k: v for k, v in p.items() if not k.startswith("@")})
        r = Vector(p.get("@root", (0, 0, 0)))
        out.append({"t": t, "b": {b.name: [list(rig.matrix_world @ b.head + r),
                                          list(rig.matrix_world @ b.tail + r)]
                                  for b in rig.pose.bones}})
    (OUT / ("%s_sticks.json" % name)).write_text(json.dumps(out))


def splice(rig, spec):
    import numpy as np
    rest = MH._rest_locals(rig)
    c = MH._bake_clip(rest, spec)
    nb = len(rest)
    frames = [(rt, tuple(x for q4 in q for x in q4)) for rt, q in c["frames"]]
    nbn = c["name"].encode()
    head = struct.pack("<H%dsfIB3x" % len(nbn), len(nbn), nbn, c["dur"], len(frames),
                       1 if c["loop"] else 0)
    root = b"".join(struct.pack("<3f", *rt) for rt, _q in frames)
    quat = np.array([q for _rt, q in frames], np.int64).reshape(len(frames), nb * 4)
    blob = head + root + b"".join(FQ._runs(quat[:, k], 16) for k in range(nb * 4))
    packed = gzip.decompress(BLOB.read_bytes())
    o = J.nc_offset(packed)
    nc, = struct.unpack_from("<I", packed, o)
    _b, clips = J.shipped()
    if c["name"] in clips:
        sys.exit("[stroll] the blob already has a %s" % c["name"])
    new = packed[:o] + struct.pack("<I", nc + 1) + packed[o + 4:] + blob
    BLOB.write_bytes(FQ.gz(new))
    _b, clips = J.shipped()
    d, lp, fr = clips[c["name"]]
    dq = max(abs(a - b) for (rt, q), (rt2, q2) in zip(fr, frames) for a, b in zip(q, q2))
    print("[stroll] spliced %s: %d -> %d clips (+%d bytes raw), read back %.2f s %d frames, "
          "worst quat diff %d; order %s"
          % (c["name"], nc, nc + 1, len(blob), d, len(fr), dq, list(clips)[-3:]))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    rig = bpy.data.objects["rig"]
    if "--set" in argv:
        for kv in argv[argv.index("--set") + 1:]:
            if kv.startswith("-"):
                break
            k, v = kv.split("=")
            globals()[k] = v if k == "HR_SOLVE" else float(v)
    OUT.mkdir(parents=True, exist_ok=True)
    if not J.check(rig):
        sys.exit("[stroll] rig check failed")
    g = Gait(rig)
    if "--diag" in argv:
        g.prepare()
        for i in range(0, 61, 3):
            ph = i / 100.0
            # Root this leg would need with the walk's knee and the typed pitch.
            what, tx = g.target_x(ph)
            pit = pitch_stance(ph)
            lo, hi = -70.0, 70.0
            for _ in range(42):
                m = 0.5 * (lo + hi)
                J._setpose(rig, g._pose("L", ph, m, pit))
                if g._rel(what, "L")[0] > tx:
                    lo = m
                else:
                    hi = m
            J._setpose(rig, g._pose("L", ph, 0.5 * (lo + hi), pit))
            z = g.heelpt("L").z if ph < T_FF else J._pt(rig, "footL").z
            print("[stroll] diag ph %.2f need %+.3f hip %+.1f knee %.1f pitch %.1f" %
                  (ph, CLEAR - z, 0.5 * (lo + hi), g.knee(ph), pit))
        return
    half, gaps = g.build()
    spec = spec_of(half, "stroll")
    # The shipped walk, solved again here exactly as it ships (check() just did).
    walk = next(c for c in MH.CLIPS if c["name"] == "walk")
    trW = trace(rig, walk, g.heelpt, dense=True)
    trS = trace(rig, spec, g.heelpt, dense=True)
    # Slide, both clips, the left foot: the ball while it is on the deck, and
    # the heel while it is.
    rep = {}
    for nm, tr in (("walk", trW), ("stroll", trS)):
        rep[nm] = {"ball": slide_of(tr, "ball", 0.0, 0.75),
                   "heel": slide_of(tr, "heel", 0.0, 0.75),
                   "tip": slide_of(tr, "tip", 0.0, 0.75),
                   "low": min(f["low"] for f in tr),
                   "bounce": (max(f["hip"] for f in tr) - min(f["hip"] for f in tr)) * 100}
        print("[stroll] %-6s ball on the deck travels %.1f mm (%d samples), heel %.1f mm, "
              "toe tip %.1f mm; lowest point %+.4f; bounce %.1f cm"
              % (nm, rep[nm]["ball"][0], rep[nm]["ball"][1], rep[nm]["heel"][0],
                 rep[nm]["tip"][0], rep[nm]["low"], rep[nm]["bounce"]))
    print("[stroll] planted feet off the deck (any frame): max %.1f mm" % (max(gaps) * 1000))
    # Swing clearance: the left foot's lowest tip while it is swinging.
    sw = [(min(f["ball"][1], f["tip"][1], f["heel"][1]), f["t"]) for f in trS if T_TO + 0.03 < f["t"] < 0.97]
    print("[stroll] swing clearance (left foot, mid-swing): min %.1f mm at t %.3f" % (min(sw)[0] * 1000, min(sw)[1]))
    for f in trS:
        if f["t"] > 0.85:
            print("[stroll]   t %.3f ball %+.3f %+.3f tip %+.3f %+.3f heel %+.3f %+.3f"
                  % (f["t"], f["ball"][0], f["ball"][1], f["tip"][0], f["tip"][1], f["heel"][0], f["heel"][1]))
    # Heel-strike: the heel's ground speed in the last 1/30 s before it lands.
    pre = [f for f in trS if 0.975 <= f["t"] < 1.0]
    if len(pre) >= 2:
        vx = (pre[-1]["heel"][0] - pre[0]["heel"][0]) / (pre[-1]["t"] - pre[0]["t"])
        vz = (pre[-1]["heel"][1] - pre[0]["heel"][1]) / (pre[-1]["t"] - pre[0]["t"])
        print("[stroll] heel arriving: %.2f m/s along the ground, %.2f m/s down" % (vx, vz))
    for k, p in enumerate(half):
        print("[stroll]   f%02d hipL %+.1f kneeL %.1f footL %+.1f toeL %+.1f | hipR %+.1f kneeR %.1f "
              "| root %+.3f" % (k, p["legUL"][0], p["legLL"][0], p["footL"][0], p["toeL"][0],
                                p["legUR"][0], p["legLR"][0], p["@root"][2]))
    (OUT / "stroll_trace.json").write_text(json.dumps({"walk": trW, "stroll": trS, "rep": rep,
                                                       "v": V}))
    sticks(rig, spec, "stroll")
    sticks(rig, walk, "walk")
    if "--splice" in argv:
        splice(rig, spec)


if __name__ == "__main__":
    main()
