#!/usr/bin/env python3
"""Her hands to her cheeks, solved on v2.0's own mesh: SPREAD_A and SPREAD_B.

Two halves, because Blender is only needed for one of them:

    tools/blender/blender.sh -b build/baye2.blend -P tools/blender/spread_solve.py -- --dump
    python3 tools/blender/spread_solve.py --check     FK and skinning against Blender
    python3 tools/blender/spread_solve.py --solve     fit A and B, print the dicts
    python3 tools/blender/spread_solve.py --verify    what ships against a fresh fit

WHAT IT IS. Misha, 25 Sep 2026: "when she is lying on the cot with legs hanging
off on her tummy after the butt slap can she sometimes spread her butt cheeks
with her hands". The `spread` clip in human_mh.py is laid over her arms while
she holds PRONE_EDGE; this finds its two arm poses. A is her hands arriving on
her cheeks; B is the pull, the same grip on the surface `apprenticeSpread`
moves (46-apprentice.js, APPR.spread), which is `displaced()` below and MUST
stay the same function.

HOW. The FK and the linear-blend skinning are numpy, from the rest matrices,
weights and bind positions of build/baye2.blend (she is the one that is drawn),
and `--check` proves both against Blender's own `pose_bone.matrix` and
evaluated mesh before anything is believed — matched to 1e-7. The torso is a
height field (she lies face down, so "into her" is down), built by sampling
every triangle of the parts no arm bone moves.

THE FIT, left arm only; the right is its mirror (see MIRROR). Scored on the
palm centroid on the upper cheek and the finger PADS — the distal 30% of the
finger vertices on the palm side, not the whole finger, which put the "pads"
2.4 cm from the palm centre and made two targets 8 cm apart unsatisfiable —
at the inside of the cheek by the cleft, the palm's normal against the skin's,
and nothing of the hand or forearm more than 3 mm below the surface. The
targets are reachable: the first two sets were not (shoulder to palm 0.545 m
against 0.537 of arm), and every seed stopped 2.4 cm short with the wrist
at 94 and 114 degrees, which is the solver telling you so.
"""
import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RIG_NPZ = Path("/tmp/spread_rig.npz")
RIG_JSON = Path("/tmp/spread_rig.json")

# Palm and pads, as (height, distance off the midline) on her rear surface,
# bind metres. The palm on the top of the cheek, the pads reaching down it to
# the cleft.
TGT = dict(palm=(0.985, 0.075), tip=(0.905, 0.030))
# The cheeks, parted: MUST match APPR.spread in src/46-apprentice.js. Blender
# bind axes here — x forward, y her left, z up — where the shader has x
# forward, y up, z lateral.
SP = dict(d=0.022, u=0.89, ru=0.075, l=0.06, rl=0.075, f=(-0.05, 0.0), strip=0.012)
# The chain being fitted, and how far each number may go from PRONE_EDGE's.
VARS = [("clavicleL", 0), ("clavicleL", 1), ("clavicleL", 2), ("armUL", 0), ("armUL", 1),
        ("armUL", 2), ("armLL", 0), ("armLL", 1), ("armLL", 2), ("handL", 0), ("handL", 1),
        ("handL", 2), ("fingersL", 0)]
SPAN = [25, 25, 25, 120, 100, 100, 150, 80, 25, 60, 45, 45, 40]
SPAN_LO = [25, 25, 25, 120, 100, 100, 20, 80, 25, 60, 45, 45, 40]
# THE MIRROR, and it is not quite `_mirror_pose`'s. Arm bones share the first
# number and negate the other two; the finger bones are not rolled as mirror
# images, so `fingersR` is the NEGATED first number of `fingersL` (checked on
# the skinned finger vertices, to 1e-12). With the shared rule one hand lay on
# her and the other stood 10 cm off her as a claw.
MIRROR = {"clavicle": (1, -1, -1), "armU": (1, -1, -1), "armL": (1, -1, -1),
          "hand": (1, -1, -1), "fingers": (-1, 1, 1)}


# =========================================================================== #
#  Blender half                                                               #
# =========================================================================== #

def blender_main():
    import bpy
    import numpy as np
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import human_mh as H
    rig, body = bpy.data.objects["rig"], bpy.data.objects["human"]
    names = [b.name for b in rig.data.bones]
    parent = [names.index(b.parent.name) if b.parent else -1 for b in rig.data.bones]
    me = body.data
    gi = {g.index: g.name for g in body.vertex_groups}
    W = np.zeros((len(me.vertices), len(names)), np.float32)
    for i, v in enumerate(me.vertices):
        for g in v.groups:
            if gi[g.group] in names:
                W[i, names.index(gi[g.group])] = g.weight
    tri = []
    for p in me.polygons:
        vs = list(p.vertices)
        tri += [(vs[0], vs[k], vs[k + 1]) for k in range(1, len(vs) - 1)]
    spec = {k: v for k, v in H.PRONE_EDGE.items() if not k.startswith("@")}
    H.pose(rig, spec)
    PE = np.array([np.array(rig.pose.bones[n].matrix) for n in names])
    ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    posed = np.array([v.co[:] for v in ev.to_mesh().vertices])
    np.savez(RIG_NPZ, parent=np.array(parent),
             rest=np.array([np.array(b.matrix_local) for b in rig.data.bones]),
             bind=np.array([v.co[:] for v in me.vertices]),
             nrm=np.array([v.normal[:] for v in me.vertices]), W=W, tri=np.array(tri),
             PE=PE, posed=posed)
    RIG_JSON.write_text(json.dumps({"names": names,
                                    "prone_edge": {k: list(v) for k, v in spec.items()}}))
    print("[spread] dumped %d verts, %d bones -> %s" % (len(me.vertices), len(names), RIG_NPZ))


# =========================================================================== #
#  numpy half                                                                 #
# =========================================================================== #

def load():
    import numpy as np
    D = dict(np.load(RIG_NPZ))
    J = json.loads(RIG_JSON.read_text())
    R = type("Rig", (), {})()
    R.np = np
    R.names = J["names"]
    R.idx = {n: i for i, n in enumerate(R.names)}
    R.PE_SPEC = {k: tuple(v) for k, v in J["prone_edge"].items()}
    R.__dict__.update(D)
    R.restInv = np.linalg.inv(D["rest"])
    W = D["W"].astype(float)
    s = W.sum(1, keepdims=True)
    s[s == 0] = 1
    R.Wn = W / s
    return R


def eul(np, a):
    x, y, z = np.radians(a)
    cx, sx, cy, sy, cz, sz = np.cos(x), np.sin(x), np.cos(y), np.sin(y), np.cos(z), np.sin(z)
    M = np.eye(4)
    M[:3, :3] = (np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
                 @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
                 @ np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]))
    return M


def fk(R, spec):
    """pose(bone) = pose(parent) @ (rest(parent)^-1 @ rest(bone)) @ basis."""
    P = R.np.zeros_like(R.rest)
    for i, n in enumerate(R.names):
        B = eul(R.np, spec.get(n, (0, 0, 0)))
        p = R.parent[i]
        P[i] = R.rest[i] @ B if p < 0 else P[p] @ (R.restInv[p] @ R.rest[i]) @ B
    return P


def skin(R, P, verts=None, bind=None):
    np = R.np
    b = R.bind if bind is None else bind
    Wv = R.Wn
    if verts is not None:
        b, Wv = b[verts], Wv[verts]
    bh = np.c_[b, np.ones(len(b))]
    return np.einsum('vb,bij,vj->vi', Wv, P @ R.restInv, bh)[:, :3]


def skin_n(R, P, verts):
    np = R.np
    n = np.einsum('vb,bij,vj->vi', R.Wn[verts], (P @ R.restInv)[:, :3, :3], R.nrm[verts])
    return n / np.linalg.norm(n, axis=1, keepdims=True)


def ss(np, a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def displaced(R, k):
    """SPREAD_VERT in 46-apprentice.js, on the bind positions."""
    np = R.np
    B = R.bind
    f, l, u = B[:, 0], B[:, 1], B[:, 2]
    w = (np.exp(-((u - SP["u"]) / SP["ru"]) ** 2 - ((np.abs(l) - SP["l"]) / SP["rl"]) ** 2)
         * (1 - ss(np, SP["f"][0], SP["f"][1], f)) * ss(np, 0.0, SP["strip"], np.abs(l)))
    out = B.copy()
    out[:, 1] += np.sign(l) * SP["d"] * k * w
    return out


def sets(R):
    """The vertex sets: torso, the left hand, its palm, its pads, its forearm."""
    np, Wn, idx, B = R.np, R.Wn, R.idx, R.bind
    arm = [idx[n] for n in R.names if n.startswith(("clavicle", "arm", "hand", "thumb", "fingers"))]
    R.torso = Wn[:, arm].sum(1) < 0.3
    R.handv = np.where(Wn[:, [idx["handL"], idx["fingersL"], idx["thumbL"]]].sum(1) > 0.5)[0]
    R.armv = np.where(Wn[:, [idx["armUL"], idx["armLL"]]].sum(1) > 0.5)[0]
    fing = np.where(Wn[:, idx["fingersL"]] > 0.5)[0]
    # The palm's normal: the way the finger tips go when the fingers curl.
    d0 = skin(R, fk(R, {}), fing)
    d1 = skin(R, fk(R, {"fingersL": (30, 0, 0)}), fing)
    curl = (d1 - d0).mean(0)
    hc = B[R.handv].mean(0)
    fa = B[fing].mean(0) - hc
    fa /= np.linalg.norm(fa)
    npalm = curl - fa * np.dot(curl, fa)
    R.npalm = npalm / np.linalg.norm(npalm)
    along = (B[fing] - R.rest[idx["handL"]][:3, 3]) @ fa
    R.pad = fing[(along > np.percentile(along, 70)) & (R.nrm[fing] @ R.npalm > 0.2)]
    hdom = np.where(Wn[:, idx["handL"]] > 0.5)[0]
    R.palm = hdom[((B[hdom] - B[hdom].mean(0)) @ R.npalm > 0.0) & (R.nrm[hdom] @ R.npalm > 0.35)]
    R.x_pe = np.array([R.PE_SPEC.get(b, (0, 0, 0))[c] for b, c in VARS])
    R.LO = R.x_pe - np.array(SPAN_LO)
    R.HI = R.x_pe + np.array(SPAN)


def heightfield(R, Vp, cell=0.005):
    np = R.np
    T = Vp[R.tri[R.torso[R.tri].all(1)]]
    g = np.linspace(0, 1, 9)
    a, b = np.meshgrid(g, g)
    k = (a + b) <= 1
    a, b = a[k], b[k]
    pts = (T[:, 0, None] * (1 - a - b)[None, :, None] + T[:, 1, None] * a[None, :, None]
           + T[:, 2, None] * b[None, :, None]).reshape(-1, 3)
    hf = dict(x0=-0.6, y0=-0.4, cell=cell, nx=int(1.4 / cell), ny=int(0.8 / cell))
    H = np.full((hf["nx"], hf["ny"]), -np.inf)
    ix = ((pts[:, 0] - hf["x0"]) / cell).astype(int)
    iy = ((pts[:, 1] - hf["y0"]) / cell).astype(int)
    ok = (ix >= 0) & (ix < hf["nx"]) & (iy >= 0) & (iy < hf["ny"])
    np.maximum.at(H, (ix[ok], iy[ok]), pts[ok, 2])
    hf["H"] = H
    return hf


def above(R, hf, P):
    """Height over her surface; -inf-free: NaN where there is no surface under."""
    np = R.np
    ix = ((P[:, 0] - hf["x0"]) / hf["cell"]).astype(int)
    iy = ((P[:, 1] - hf["y0"]) / hf["cell"]).astype(int)
    ok = (ix >= 0) & (ix < hf["nx"]) & (iy >= 0) & (iy < hf["ny"])
    h = np.full(len(P), np.nan)
    h[ok] = P[ok, 2] - hf["H"][ix[ok], iy[ok]]
    h[~np.isfinite(h)] = np.nan
    return h


def spec_of(R, x):
    s = dict(R.PE_SPEC)
    for (b, c), v in zip(VARS, x):
        a = list(s.get(b, (0, 0, 0)))
        a[c] = float(v)
        s[b] = tuple(a)
    return s


def full(R, x):
    s = spec_of(R, x)
    for b, m in MIRROR.items():
        v = s.get(b + "L", (0, 0, 0))
        s[b + "R"] = tuple(a * k for a, k in zip(v, m))
    return s


def world(R, k):
    """The posed, parted surface and the two targets on it, with their normals."""
    np = R.np
    Bd = displaced(R, k)
    Vp = skin(R, R.PE, None, Bd)
    hf = heightfield(R, Vp)

    def surf(u, l):
        m = R.torso & (np.abs(R.bind[:, 2] - u) < 0.012) & (np.abs(R.bind[:, 1] - l) < 0.012) & (R.bind[:, 0] < 0)
        ii = np.where(m)[0]
        return ii[R.bind[ii, 0].argmin()]
    ip, it = surf(*TGT["palm"]), surf(*TGT["tip"])
    ns = skin_n(R, R.PE, np.array([ip, it]))
    return hf, Vp[ip], Vp[it], ns


def terms(R, x, W):
    np = R.np
    hf, tp, tt, ns = W
    P = fk(R, spec_of(R, x))
    pv, fv = skin(R, P, R.palm), skin(R, P, R.pad)
    npw = (P @ R.restInv)[R.idx["handL"], :3, :3] @ R.npalm
    V = np.concatenate([skin(R, P, R.handv), skin(R, P, R.armv)])
    h = above(R, hf, V)
    h = h[np.isfinite(h)]
    return dict(palm=np.linalg.norm(pv.mean(0) - (tp + ns[0] * 0.006)),
                pads=np.linalg.norm(fv.mean(0) - (tt + ns[1] * 0.006)),
                face=float(np.dot(npw, ns[0])),
                pen=float(np.sum(np.clip(-h - 0.003, 0, None) ** 2)),
                deepest=float(-h.min()) if len(h) else 0.0,
                elbow=float(P[R.idx["armLL"]][2, 3]))


def fit(R, W, seeds, pen_w=0.0, anchor=None):
    from scipy.optimize import minimize
    np = R.np

    def cost(x):
        x = np.clip(x, R.LO, R.HI)
        t = terms(R, x, W)
        c = 1000 * (t["palm"] ** 2 + t["pads"] ** 2) + 0.5 * (1 + t["face"])
        c += 10 * max(0.0, 1.0 - t["elbow"]) ** 2 + pen_w * t["pen"]
        ref = R.x_pe if anchor is None else anchor
        return c + np.sum((x - ref) ** 2) * (1e-5 if anchor is not None else 2e-6)
    best = None
    for s in seeds:
        if pen_w:
            sim = np.array([s] + [s + np.eye(len(s))[i] * 2.0 for i in range(len(s))])
            r = minimize(cost, s, method="Nelder-Mead",
                         options=dict(initial_simplex=sim, maxiter=6000, xatol=0.01, fatol=1e-10))
        else:
            r = minimize(cost, np.clip(s, R.LO, R.HI), method="Powell", bounds=list(zip(R.LO, R.HI)),
                         options=dict(maxiter=3000, xtol=0.05, ftol=1e-8))
        if best is None or r.fun < best.fun:
            best = r
    return np.clip(best.x, R.LO, R.HI)


def solve(R):
    np = R.np
    rng = np.random.default_rng(1)
    seeds = [R.x_pe.copy()] + [R.x_pe + rng.normal(0, 1, len(R.x_pe)) * np.array(
        [10, 10, 10, 40, 40, 40, 30, 20, 20, 40, 40, 40, 10]) for _ in range(3)]
    W0, W1 = world(R, 0.0), world(R, 1.0)
    a = fit(R, W0, seeds)
    a = fit(R, W0, [a], pen_w=3000, anchor=a)
    b = fit(R, W1, [a])
    b = fit(R, W1, [b], pen_w=3000, anchor=b)
    for nm, x, W in (("SPREAD_A", a, W0), ("SPREAD_B", b, W1)):
        t = terms(R, x, W)
        print("[spread] %s palm %.1f mm, pads %.1f mm, palm to skin %.3f, deepest %.1f mm"
              % (nm, t["palm"] * 1e3, t["pads"] * 1e3, t["face"], t["deepest"] * 1e3))
    return a, b


def emit(R, nm, x):
    s = full(R, x)
    keys = ["clavicle", "armU", "armL", "hand", "fingers"]
    f = lambda v: "(%s)" % ", ".join("%.1f" % a if a else "0" for a in v)
    print("%s = dict(PRONE_EDGE, **{" % nm)
    for side in "LR":
        print("    " + ", ".join('"%s%s": %s' % (k, side, f(s[k + side])) for k in keys) + ",")
    print("})")


def shipped():
    """SPREAD_A and SPREAD_B as they stand in human_mh.py, without importing it."""
    src = (Path(__file__).resolve().parent / "human_mh.py").read_text()
    out = {}
    for node in ast.parse(src).body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") in ("SPREAD_A", "SPREAD_B"):
            kw = node.value.keywords[0].value
            out[node.targets[0].id] = {ast.literal_eval(k): ast.literal_eval(v)
                                       for k, v in zip(kw.keys, kw.values)}
    return out


def main(argv):
    R = load()
    np = R.np
    if "--check" in argv:
        e1 = np.abs(fk(R, R.PE_SPEC) - R.PE).max()
        e2 = np.abs(skin(R, fk(R, R.PE_SPEC)) - R.posed).max()
        print("[spread] FK against Blender %.2e, skinning %.2e" % (e1, e2))
        return
    sets(R)
    if "--solve" in argv:
        a, b = solve(R)
        emit(R, "SPREAD_A", a)
        emit(R, "SPREAD_B", b)
    if "--verify" in argv:
        S = shipped()
        for nm, k in (("SPREAD_A", 0.0), ("SPREAD_B", 1.0)):
            x = np.array([S[nm].get(b, R.PE_SPEC.get(b, (0, 0, 0)))[c] for b, c in VARS])
            t = terms(R, x, world(R, k))
            mir = max(abs(S[nm][b + "R"][i] - S[nm][b + "L"][i] * MIRROR[b][i])
                      for b in MIRROR for i in range(3))
            print("[spread] %s as shipped: palm %.1f mm, pads %.1f mm, palm to skin %.3f, "
                  "deepest %.1f mm, mirror off by %.2f deg"
                  % (nm, t["palm"] * 1e3, t["pads"] * 1e3, t["face"], t["deepest"] * 1e3, mir))


if __name__ == "__main__":
    try:
        import bpy  # noqa: F401
        blender_main()
    except ImportError:
        main(sys.argv[1:])
