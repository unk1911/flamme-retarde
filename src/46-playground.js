// -----------------------------------------------------------------------------
// The two playgrounds and the ping pong (1.556.0).
//
// Misha, 1 Oct 2026, after the ground was found and cleared (1.555.1): *"there
// are sort of 2 playgrounds, the option A (the older one) and option B (newer
// fenced one): can u do both? the mini-golf maybe hold onto it. ... the ping
// pong is sort of next to the playground somewhere, maybe can build that out
// too."* The survey of all three is docs/playground-reference.md, and the
// ground each one stands on is `GROUNDS` in src/43-jadrija.js. This file is
// what stands on it.
//
// ── B, the fenced one, on `GROUNDS.play` ──────────────────────────────────────
//
// Off the aerial at 0:46/0:48/0:49 (third-party, reference only). A pad of
// blue poured rubber with rounded corners inside a green welded-mesh fence on
// round posts, the gate at the west end of the seaward side and the green
// information board beside it. On the pad: a red tower with an eight-panel
// roof, a ladder up the west face and a red slide off the east one; the long
// teeter-totter off the tower toward the west fence; two round in-ground
// trampolines with red rims; a two-bay swing frame on three A-frames, the west
// bay a nest swing and the east bay two flat seats, the east frame red; a red
// spring rider by the inland fence; a black climbing frame at the east end;
// five staked saplings along the fence. The four benches facing in and the
// olive are the resort's own and are drawn in 43-jadrija.js — see the note
// over `GROUNDS.play` there.
//
// The pad stands where `GROUNDS.play` is, 16.5 m east and 14 m inland of the
// real one, because our back row, lane wall and car row hold the real spot.
// Accepted by Misha with "can u do both".
//
// ── A, the old open one, on `GROUNDS.shore` ───────────────────────────────────
//
// `1000150349`, `_350` and the pan at 0:43. Welded pipe on bare gravel, no
// fence, no surfacing: an orange frame with two seats on chains, a vertical
// ladder between them and a gooseneck with a ring off one end; a navy A-frame
// swing with a grey beam and a red rocket crest at each end; a yellow frame of
// the same welder's pattern as the orange, with the ladder as one leg and a
// knotted rope off its gooseneck. `_350` has the yellow frame just past the end
// of the boat-mural wall with the sea beyond it, and that wall in this model is
// the back of the first front-row run — so the set is at the alley's west
// mouth.
//
// ── the ping pong, on `GROUNDS.pong` ──────────────────────────────────────────
//
// No frame shows it. OSM draws a 15.6 x 3.4 m strip. Two tables, end to end
// along it, in the pattern every Croatian municipal park has: a cast concrete
// top on two concrete slabs with a perforated steel net. That is an
// assumption and it is written down as one in the reference.
//
// ── physics-ready ─────────────────────────────────────────────────────────────
//
// Everything that moves is an AVBD net of its own since 1.558.0 (`avbdNet`,
// src/43-avbd.js, unchanged): the seats and the nest on chains of rigid
// links, the rope as free links, the seesaw on its axle landing on soft
// tyres, the rider on its coil, each trampoline bed sprung from its rim with
// you on it as a second body. Pushed by the hose, by walking into them, and
// by hand (the hose's button with one in reach). Stepped only near you, and
// asleep when still. `__fr.play` reads and drives them. See "the motion".
//
// ── rule 4 ────────────────────────────────────────────────────────────────────
//
// Not one `rng()` draw. Everything jittered is `pgJit`, slots 400-499, and the
// saplings grow off their own `mulberry32`.
// -----------------------------------------------------------------------------

/** This file's own sine hash — see `laneJit`, whose reason it shares. */
function pgJit(i, k) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const PG = {
  // B's fence, a little inside `GROUNDS.play` so the posts are clear of the
  // edge the trees were cleared to. The gate is in the seaward run, at its
  // west end, which is the side anybody arrives from.
  //
  // A DOUBLE GATE, 2.1 m between the posts (1.558.0). Misha: *"there's that
  // open gate but it's too small and doesn't let me thru, i have to
  // literally jump over the fence"*. It was 1.1 m, and `confine` grows every
  // collider by `GROUND.girth`, 0.55 m: two jambs took 1.10 m of it, and the
  // way through was minus four centimetres wide. At 2.1 m it is 0.96 m clear
  // for the walker's middle, which is a gate you walk through without
  // aiming. Both leaves stand open, swung out on to the gravel strip.
  fence: { t0: 517.4, t1: 532.6, s0: 40.2, s1: 52.0, gate: [517.95, 520.05] },
  // The rubber, a rounded rectangle 0.3 m inside the fence.
  pad: { t0: 517.7, t1: 532.3, s0: 40.5, s1: 51.7, r: 2.6 },
  RUB: 0.03,                 // its thickness over the gravel pad
  // Colours. Linear, like every vertex colour in the game.
  BLUE: [0.190, 0.290, 0.470],
  RED: [0.600, 0.090, 0.055],
  ORANGE: [0.860, 0.300, 0.045],
  YELLOW: [0.820, 0.640, 0.060],
  NAVY: [0.060, 0.085, 0.230],
  GREEN: [0.045, 0.170, 0.095],
  GREYBLUE: [0.270, 0.330, 0.400],
  GALV: [0.560, 0.575, 0.585],
  BLACK: [0.040, 0.042, 0.046],
  RUBBER: [0.035, 0.035, 0.038],
  CONC: [0.540, 0.530, 0.505],
};

// ── THE PHYSICS (1.558.0) — pure, no THREE, so Node can run it ──────────────
const PGP = {
  // The swings', the rope's, the seesaw's and the rider's solve. 120 Hz and
  // six iterations hold a 3-link chain's hard joints to about a millimetre
  // (eight: 0.8 mm, for a fifth more time — measured in Node on this solve).
  sub: 1 / 120, iterations: 6, alpha: 0.95, gamma: 0.999, beta: 1e5, betaAng: 1e9,
  // Galvanised 6 mm swing chain is about 0.55 kg a metre.
  chainKgM: 0.55, links: 3,
  // Asleep after this long under `still` m/s everywhere, nobody near.
  sleepAfter: 1.5, still: 0.06,
  // The walker as a kinematic capsule (feet up to the chest), and how hard it
  // is: a person walking into a seat gives a little — they are not a wall.
  youR: 0.22, youK: 1500,
};

// ── HER ON IT (1.562.0) ─────────────────────────────────────────────────────
//
// Baye on the swings, the nest, the seesaw, the beds and the rider: her mass
// in each net while she is on it, the drives she makes (a pump on a swing, a
// kick off the ground on the seesaw, a rock on the rider, her legs on a bed),
// and the push you give her. Her pose and where she is drawn are hers — see
// `── THE PLAYGROUND KIT, RIDDEN ──` in 43-jadrija.js — and are read off the
// body each frame (`her.frame`), so she is wherever the solve has the seat.
const PGH = {
  kg: 55,              // her, as the hammock and the ragdoll have her (HAMMOCK.herMass)
  caps: 4,             // her capsules on a seat's body, off until she sits
  // Her centre of mass over the seat, m, sitting up — for the inertia she
  // adds about the body's own origin, and the rider's lever.
  comUp: 0.26,
  // Her own inertia about that centre, sitting (pitch/roll, yaw), kg·m².
  Isit: 1.6, Iyaw: 0.7,
  // THE SWING. The pump: a force along the swing, with the seat's motion,
  // up to `pumpTop` rad of swing — what leaning back with her legs out on the
  // way forward and tucking them on the way back is worth, as a drive. Each
  // half swing she adds about a hundredth of her weight's work to it, which
  // builds a still seat to 0.6 rad in about eight swings.
  pumpN: 34, pumpTop: 0.78,
  // Your push with her on it: a shove (N·s) and a held push (N). Empty, a
  // seat takes 5 N·s; with 58 kg on it that is a nudge nobody would see.
  shoveSeat: 34, holdSeat: 210, shoveNest: 40, holdNest: 240,
  // THE SEESAW. Her end comes down under her (her weight at her seat, as a
  // torque about the axle); and at the bottom she kicks off the ground with
  // her legs, once a landing, `kickNs` N·s up at her seat. On her own that
  // lifts her end about a third of the way; with you on the other end it goes.
  kickNs: 175, kickEvery: 0.9,
  // You pushing the far end down with her on it — your weight leant on it —
  // and lifting it.
  shoveSaw: 130, holdSaw: 900,
  // THE RIDER. An adult on a child's coil: at 400 N·m/rad her weight, a metre
  // over the foot, tips it straight over (her 566 N·m/rad against its 400).
  // So the coil stands stiffer while she rides it, and her weight is laid on
  // at her own height rather than the horse's (`comRider`).
  riderK: 1500, comRider: 1.02, rockNm: 70, rockTop: 0.17,
  // A BED: how high she bounces (m over the bed), and the tricks at the top.
  bedTop: [1.0, 1.45],
  // THE SLIDE: plastic and a swimsuit, sliding friction; and where she leaves it.
  slideMu: 0.24, slideV0: 0.6, slideEnd: 0.985,
};

/** A quaternion turning +x on to unit d (shortest arc), [x, y, z, w]. */
function pgQuatX(d) {
  const c = d[0];
  if (c < -0.999999) return [0, 0, 1, 0];
  // axis = x × d = (0, -d2, d1)
  const ax = 0, ay = -d[2], az = d[1];
  const w = 1 + c, l = Math.hypot(ax, ay, az, w);
  return [ax / l, ay / l, az / l, w / l];
}
/** Rotate v by q. */
function pgRot(q, v, out = [0, 0, 0]) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3], x = v[0], y = v[1], z = v[2];
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  out[0] = x + qw * tx + (qy * tz - qz * ty);
  out[1] = y + qw * ty + (qz * tx - qx * tz);
  out[2] = z + qw * tz + (qx * ty - qy * tx);
  return out;
}

/**
 * The common part of every playground net: fixed substeps, a sleep, a wake,
 * an impulse at a point, the walker as a capsule, and the hammock's guard.
 * `o.net` is the avbdNet, `o.bodies` the ones that move, `o.reach` the radius
 * round `o.c` inside which the walker can touch it.
 */
function pgSim(o) {
  const net = o.net, P = net.P, Q = net.Q, V = net.V, W = net.W;
  const sub = o.sub || PGP.sub;
  const restP = new Float64Array(P), restQ = new Float64Array(Q);
  let acc = 0, asleep = true, still = 0;
  const stats = { steps: 0, ms: 0, msLast: 0, rescues: 0, wakes: 0 };
  const caps = new Float64Array(8);
  let youOn = false;
  // Kept awake while this answers true — somebody on it (1.562.0).
  let busy = o.busy || null;
  function wake() { if (asleep) stats.wakes++; asleep = false; still = 0; }
  /** Velocity added at world point p by impulse J (N·s), on body i. */
  function impulse(i, p, J) {
    const m = net.mass[i];
    net.kick(i, J[0] / m, J[1] / m, J[2] / m);
    // Angular: I⁻¹ (r × J), the inertia taken in the body's frame (diagonal).
    const q = [Q[4 * i], Q[4 * i + 1], Q[4 * i + 2], Q[4 * i + 3]];
    const qi = [-q[0], -q[1], -q[2], q[3]];
    const r = [p[0] - P[3 * i], p[1] - P[3 * i + 1], p[2] - P[3 * i + 2]];
    const t = [r[1] * J[2] - r[2] * J[1], r[2] * J[0] - r[0] * J[2], r[0] * J[1] - r[1] * J[0]];
    const tl = pgRot(qi, t);
    const I = net.inert;
    const wl = [tl[0] / Math.max(1e-4, I[6 * i]), tl[1] / Math.max(1e-4, I[6 * i + 1]),
      tl[2] / Math.max(1e-4, I[6 * i + 2])];
    const ww = pgRot(q, wl);
    W[3 * i] += ww[0]; W[3 * i + 1] += ww[1]; W[3 * i + 2] += ww[2];
    wake();
  }
  /** The walker: feet (x, y, z), or null when not near. */
  function you(p) {
    if (!o.caps) return;
    if (!p) { if (youOn) { net.setWorldCaps(caps, 0); youOn = false; } return; }
    const dx = p[0] - o.c[0], dz = p[2] - o.c[2];
    const near = dx * dx + dz * dz < (o.reach + PGP.youR) ** 2 && p[1] < o.c[1] + 1.5;
    if (!near) { if (youOn) { net.setWorldCaps(caps, 0); youOn = false; } return; }
    caps[0] = p[0]; caps[1] = p[1] + 0.25; caps[2] = p[2];
    caps[3] = p[0]; caps[4] = p[1] + 1.45; caps[5] = p[2];
    caps[6] = PGP.youR; caps[7] = PGP.youR;
    net.setWorldCaps(caps, 1);
    youOn = true;
    // Anything inside its reach wakes it; a walker standing beside a seat at
    // rest costs a solve, which is the price of being able to bump it.
    wake();
  }
  function sane() {
    for (const i of o.bodies) {
      for (let k = 0; k < 3; k++) {
        const v = P[3 * i + k];
        if (!Number.isFinite(v) || Math.abs(v - restP[3 * i + k]) > (o.far || 4)) return false;
      }
      if (Math.hypot(V[3 * i], V[3 * i + 1], V[3 * i + 2]) > 25) return false;
    }
    return true;
  }
  function reset() {
    for (const i of o.bodies) {
      net.place(i, restP[3 * i], restP[3 * i + 1], restP[3 * i + 2],
        [restQ[4 * i], restQ[4 * i + 1], restQ[4 * i + 2], restQ[4 * i + 3]]);
    }
    net.resetDuals();
  }
  /** Advance by dt; returns the substeps taken. */
  function step(dt, before, after) {
    if (asleep) { acc = 0; return 0; }
    // Up to the frame's own 0.05 s ceiling, so a slow frame is not slow motion.
    acc = Math.min(acc + dt, 0.05 + sub * 0.5);
    let n = 0;
    const t0 = performance.now();
    while (acc >= sub) {
      acc -= sub;
      if (before) before(sub);
      net.step(sub);
      if (after) after(sub);
      n++;
      stats.steps++;
    }
    if (n && !sane()) { stats.rescues++; reset(); }
    // Asleep when nothing has moved for a while and nothing is pushing.
    let vmax = 0;
    for (const i of o.bodies) {
      const v = Math.hypot(V[3 * i], V[3 * i + 1], V[3 * i + 2])
        + Math.hypot(W[3 * i], W[3 * i + 1], W[3 * i + 2]) * (o.arm || 0.3);
      if (v > vmax) vmax = v;
    }
    still = vmax < (o.still || PGP.still) && !youOn && !(busy && busy()) ? still + dt : 0;
    if (still > (o.sleepAfter || PGP.sleepAfter)) {
      asleep = true;
      for (const i of o.bodies) {
        net.place(i, P[3 * i], P[3 * i + 1], P[3 * i + 2], [Q[4 * i], Q[4 * i + 1], Q[4 * i + 2], Q[4 * i + 3]]);
      }
    }
    stats.msLast = performance.now() - t0;
    stats.ms += stats.msLast;
    return n;
  }
  /**
   * A turn and nothing else: torque `F` (N) applied at world point p for h s,
   * on body i — its angular velocity only. For a load on a body that is
   * pinned (the seesaw's axle, the rider's foot): a linear kick there is
   * only taken straight back out by the joint (1.562.0).
   */
  function torque(i, p, F, h) {
    const q = [Q[4 * i], Q[4 * i + 1], Q[4 * i + 2], Q[4 * i + 3]];
    const qi = [-q[0], -q[1], -q[2], q[3]];
    const r = [p[0] - P[3 * i], p[1] - P[3 * i + 1], p[2] - P[3 * i + 2]];
    const t = [(r[1] * F[2] - r[2] * F[1]) * h, (r[2] * F[0] - r[0] * F[2]) * h, (r[0] * F[1] - r[1] * F[0]) * h];
    const tl = pgRot(qi, t);
    const I = net.inert;
    const wl = [tl[0] / Math.max(1e-4, I[6 * i]), tl[1] / Math.max(1e-4, I[6 * i + 1]),
      tl[2] / Math.max(1e-4, I[6 * i + 2])];
    const ww = pgRot(q, wl);
    W[3 * i] += ww[0]; W[3 * i + 1] += ww[1]; W[3 * i + 2] += ww[2];
  }
  return { net, step, wake, impulse, torque, you, reset, stats,
    setBusy: (fn) => { busy = fn || null; },
    get asleep() { return asleep; }, set asleep(v) { asleep = v; } };
}

/**
 * Something hung on chains: a seat on two, the nest on four, or (`body`
 * null) a rope hanging free. Each chain is `PGP.links` rigid links on hard
 * ball joints, from a world point on the beam to a point on the body — so it
 * swings as a pendulum, twists on its two chains, goes slack when the seat is
 * thrown up, and folds when it does.
 *
 * `o` — anchors [[x, y, z]...] (world); body { m, I: [xx, yy, zz], p, q } or
 * null; chains [{ a: anchor index, at: body-local point (or null, free),
 * len }]; caps [[ax, ay, az, bx, by, bz, r]] on the body (or on the links of a
 * free rope); drag; kgM, rLink.
 */
function pgHang(o) {
  const NL = o.links || PGP.links;
  const nChains = o.chains.length;
  const NB = (o.body ? 1 : 0) + nChains * NL;
  const net = avbdNet({
    maxBodies: NB, maxJoints: nChains * (NL + 2), maxStrings: 0, maxPoints: 0, maxBoxes: 0,
    maxCaps: NB + 4 + PGH.caps, maxContacts: 64, maxWorldCaps: 1, worldCapK: PGP.youK,
    iterations: PGP.iterations, alpha: PGP.alpha, alphaContact: 0.9, beta: PGP.beta,
    betaAng: PGP.betaAng, gamma: PGP.gamma, gravity: [0, -9.81, 0], drag: o.drag || 0.1,
    vMax: 20, wMax: 60, margin: 0.02, deep: 0.12, mu: 0.4, floorMu: 0.6, capK: 1e4,
  });
  let body = -1;
  const toW = (lp) => {
    const r = pgRot(o.body.q, lp);
    return [o.body.p[0] + r[0], o.body.p[1] + r[1], o.body.p[2] + r[2]];
  };
  if (o.body) {
    const B = o.body;
    body = net.addBody(B.m, [B.I[0], B.I[1], B.I[2], 0, 0, 0], B.p[0], B.p[1], B.p[2], B.q);
  }
  // The links, laid straight from the anchor to where they hang.
  const links = [];
  for (const ch of o.chains) {
    const A = o.anchors[ch.a];
    const E = ch.at ? toW(ch.at) : [A[0], A[1] - ch.len, A[2]];
    const d = [E[0] - A[0], E[1] - A[1], E[2] - A[2]];
    const L = Math.hypot(d[0], d[1], d[2]);
    const u = [d[0] / L, d[1] / L, d[2] / L];
    const l = L / NL, m = (o.kgM || PGP.chainKgM) * l, r = o.rLink || 0.012;
    const q = pgQuatX(u);
    const ids = [];
    for (let k = 0; k < NL; k++) {
      const c = [A[0] + u[0] * l * (k + 0.5), A[1] + u[1] * l * (k + 0.5), A[2] + u[2] * l * (k + 0.5)];
      ids.push(net.addBody(m, [m * r * r / 2, m * l * l / 12, m * l * l / 12, 0, 0, 0], c[0], c[1], c[2], q));
    }
    net.addJoint(-1, A, ids[0], [-l / 2, 0, 0]);
    for (let k = 1; k < NL; k++) net.addJoint(ids[k - 1], [l / 2, 0, 0], ids[k], [-l / 2, 0, 0]);
    if (ch.at && body >= 0) net.addJoint(ids[NL - 1], [l / 2, 0, 0], body, ch.at);
    links.push({ ids, l });
  }
  // HER HANDS ON THE CHAINS (1.562.0): a joint from each chain's last link
  // to the seat, off until she takes hold (`grip` below). Without them a seat
  // with a woman on it hangs from two points on one line and rocks about
  // that line like a hinge; her arms are what make seat, chains and her one
  // frame, which is what a person on a swing is.
  const grips = [];
  if (body >= 0) {
    for (let k = 0; k < nChains; k++) {
      if (o.chains[k].at) grips.push(net.addJoint(links[k].ids[NL - 1], [0, 0, 0], body, [0, 0, 0], 0, 0));
      else grips.push(-1);
    }
  }
  let nc = 0;
  for (const c of (o.caps || [])) {
    const b = c[7] != null ? c[7] : body;
    const k = net.addCap(b, nc++);
    net.setCap(k, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[6]);
  }
  // Her, sitting on it (1.562.0): capsules on the body, off until she is —
  // so the walker meets her legs and back, and not a seat swinging through
  // a woman. Laid by `herCapsSet` when she sits.
  const herCaps = [];
  if (body >= 0) {
    for (let k = 0; k < PGH.caps; k++) {
      const c = net.addCap(body, nc++);
      net.setCap(c, 0, 0, 0, 0, 0.01, 0, 0.01, 0.01);
      net.cpOn[c] = 0;
      herCaps.push(c);
    }
  }
  net.finish();
  const bodies = [];
  for (let i = 0; i < NB; i++) bodies.push(i);
  const sim = pgSim({ net, bodies, c: o.c || (o.body ? o.body.p : o.anchors[0]),
    reach: o.reach || 1.2, caps: nc > 0, arm: 0.3, far: 4 });
  // Settle it where it hangs, so it is built at rest.
  sim.asleep = false;
  for (let k = 0; k < 120; k++) net.step(PGP.sub);
  for (const i of bodies) { net.V.fill(0, 3 * i, 3 * i + 3); net.W.fill(0, 3 * i, 3 * i + 3); }
  sim.asleep = true;
  /** Chain k's points, anchor first, `NL + 1` of them, into out (flat). */
  const _r = [0, 0, 0];
  function chainPts(k, out, oo = 0) {
    const ch = o.chains[k], A = o.anchors[ch.a], L = links[k];
    out[oo] = A[0]; out[oo + 1] = A[1]; out[oo + 2] = A[2];
    for (let j = 0; j < NL; j++) {
      const i = L.ids[j];
      const q = [net.Q[4 * i], net.Q[4 * i + 1], net.Q[4 * i + 2], net.Q[4 * i + 3]];
      pgRot(q, [L.l / 2, 0, 0], _r);
      out[oo + 3 * (j + 1)] = net.P[3 * i] + _r[0];
      out[oo + 3 * (j + 1) + 1] = net.P[3 * i + 1] + _r[1];
      out[oo + 3 * (j + 1) + 2] = net.P[3 * i + 2] + _r[2];
    }
    return out;
  }
  /**
   * Chain k held `up` m above where it meets the seat (along its last link),
   * with arms of `kN` N/m — or let go (`kN` 0). Laid where the chain and the
   * seat are now, so taking hold moves nothing. Answers the grip in the
   * seat's frame, which is where her hand goes.
   */
  function grip(k, up, kN) {
    const j = grips[k];
    if (j == null || j < 0) return null;
    if (!kN) { net.setJointK(j, 0, 0); return null; }
    const L = links[k], i = L.ids[NL - 1];
    const xl = Math.max(-L.l / 2, L.l / 2 - up);
    const qi = [net.Q[4 * i], net.Q[4 * i + 1], net.Q[4 * i + 2], net.Q[4 * i + 3]];
    const w = pgRot(qi, [xl, 0, 0]);
    w[0] += net.P[3 * i]; w[1] += net.P[3 * i + 1]; w[2] += net.P[3 * i + 2];
    const qb = [net.Q[4 * body], net.Q[4 * body + 1], net.Q[4 * body + 2], net.Q[4 * body + 3]];
    const rb = pgRot([-qb[0], -qb[1], -qb[2], qb[3]],
      [w[0] - net.P[3 * body], w[1] - net.P[3 * body + 1], w[2] - net.P[3 * body + 2]]);
    net.setJointArms(j, [xl, 0, 0], rb);
    net.setJointK(j, kN, 0);
    return rb;
  }
  return Object.assign(sim, { body, links, NL, chainPts, nChains, herCaps, grip });
}

/**
 * The seesaw: a rigid beam on two hard ball joints at the ends of its axle,
 * so it turns about the axle and nothing else, with its centre of mass above
 * the axle (the beam sits on top of it, the seats and handles higher still)
 * so it always comes to rest on one end. Each end has a rubber bumper — a
 * capsule across the beam — and under each is the tyre, a world box that
 * gives (`setWorldBoxSoft`): the rubber bump.
 *
 * `o` — hinge [x,y,z], X (axle, unit), Z (along the beam, unit), HL, mass,
 * com (m above the axle), I [xx, yy, zz] about the CoM, rest (rad), stopK,
 * stopD.
 */
function pgSeesaw(o) {
  const net = avbdNet({
    maxBodies: 1, maxJoints: 2, maxStrings: 0, maxPoints: 0, maxBoxes: 0, maxCaps: 3 + PGH.caps,
    maxContacts: 16, maxWorldBoxes: 2, maxWorldCaps: 1, worldCapK: PGP.youK,
    iterations: PGP.iterations, alpha: PGP.alpha, alphaContact: 0.9, beta: PGP.beta,
    betaAng: PGP.betaAng, gamma: PGP.gamma, gravity: [0, -9.81, 0], drag: o.drag || 0.3,
    vMax: 20, wMax: 30, margin: 0.02, deep: 0.10, mu: 0.6, floorMu: 0.6, capK: 1e4,
  });
  const X = o.X, Y = [0, 1, 0], Z = o.Z;
  const q = [0, 0, 0, 1];
  avbdQuatFromBasis(X[0], X[1], X[2], Y[0], Y[1], Y[2], Z[0], Z[1], Z[2], q, 0);
  const H = o.hinge;
  const com = [H[0], H[1] + o.com, H[2]];
  const b = net.addBody(o.mass, [o.I[0], o.I[1], o.I[2], 0, 0, 0], com[0], com[1], com[2], q);
  for (const sg of [-1, 1]) {
    net.addJoint(-1, [H[0] + X[0] * sg * 0.17, H[1], H[2] + X[2] * sg * 0.17], b,
      [sg * 0.17, -o.com, 0]);
  }
  // The bumpers: across the beam under each end.
  const zb = o.HL - 0.22, yb = -0.02 - o.com, rb = 0.03;
  for (const sg of [-1, 1]) {
    const c = net.addCap(b, sg > 0 ? 1 : 0);
    net.setCap(c, -0.05, yb, sg * zb, 0.05, yb, sg * zb, rb, rb);
  }
  // And the beam itself, for the walker to bump.
  const cb = net.addCap(b, 2);
  net.setCap(cb, 0, 0.06 - o.com, -o.HL, 0, 0.06 - o.com, o.HL, 0.07, 0.07);
  const herCaps = [];
  for (let k = 0; k < PGH.caps; k++) {
    const c = net.addCap(b, 3 + k);
    net.setCap(c, 0, 0, 0, 0, 0.01, 0, 0.01, 0.01);
    net.cpOn[c] = 0;
    herCaps.push(c);
  }
  net.finish();
  // The tyres: a box under each bumper, its top where the bumper is when the
  // beam rests on that end at `rest` — so it lies at the angle drawn.
  const boxes = new Float64Array(14);
  const yaw = Math.atan2(-Z[2], Z[0]);   // box local x along the beam
  for (const [k, sg] of [[0, -1], [1, 1]]) {
    // The bumper's centre with the beam at rest on this end: the −z end down
    // is a turn of −rest about X... worked out by turning the local point.
    const th = sg * o.rest;     // +z end down for sg +1
    const c = Math.cos(th), s = Math.sin(th);
    // Turn about local x by th: y' = y c − z s, z' = y s + z c (z down for th>0 means z end y').
    const ly = yb + o.com, lz = sg * zb;
    const y2 = ly * c - lz * s, z2 = ly * s + lz * c;
    const wx = H[0] + Z[0] * z2, wz = H[2] + Z[2] * z2, wy = H[1] + y2;
    const top = wy - rb;
    boxes.set([wx, top - 0.15, wz, 0.20, 0.15, 0.20, yaw], 7 * k);
  }
  net.setWorldBoxes(boxes, 2);
  net.setWorldBoxSoft(0, o.stopK || 2.5e4, o.stopD || 450);
  net.setWorldBoxSoft(1, o.stopK || 2.5e4, o.stopD || 450);
  const sim = pgSim({ net, bodies: [b], c: com, reach: o.HL + 0.4, caps: true, arm: o.HL, far: 1.5,
    still: 0.03 });
  /** The angle about X: positive is the +z end down. */
  const _z = [0, 0, 0];
  function angle() {
    pgRot([net.Q[4 * b], net.Q[4 * b + 1], net.Q[4 * b + 2], net.Q[4 * b + 3]], [0, 0, 1], _z);
    return -Math.asin(Math.max(-1, Math.min(1, _z[1])));
  }
  // Built on its −z end... it settles to whichever end it starts toward.
  function rotateTo(th) {
    // q = base · rot_x(th)  — body-local turn
    const h = th / 2, rx = [Math.sin(h), 0, 0, Math.cos(h)];
    const qb = q;
    const out = [
      qb[3] * rx[0] + qb[0] * rx[3] + qb[1] * rx[2] - qb[2] * rx[1],
      qb[3] * rx[1] - qb[0] * rx[2] + qb[1] * rx[3] + qb[2] * rx[0],
      qb[3] * rx[2] + qb[0] * rx[1] - qb[1] * rx[0] + qb[2] * rx[3],
      qb[3] * rx[3] - qb[0] * rx[0] - qb[1] * rx[1] - qb[2] * rx[2],
    ];
    const r = pgRot(out, [0, o.com, 0]);
    net.place(b, H[0] + r[0], H[1] + r[1], H[2] + r[2], out);
  }
  rotateTo(o.start != null ? o.start : -o.rest * 0.98);
  sim.asleep = false;
  for (let k = 0; k < 240; k++) net.step(PGP.sub);
  net.V.fill(0, 0, 3); net.W.fill(0, 0, 3);
  sim.asleep = true;
  /** The world point at the end of the beam, `sg` ±1 (the +z end is +1). */
  function end(sg, out = [0, 0, 0]) {
    pgRot([net.Q[4 * b], net.Q[4 * b + 1], net.Q[4 * b + 2], net.Q[4 * b + 3]],
      [0, 0.14 - o.com, sg * (o.HL - 0.22)], out);
    out[0] += net.P[3 * b]; out[1] += net.P[3 * b + 1]; out[2] += net.P[3 * b + 2];
    return out;
  }
  return Object.assign(sim, { body: b, angle, end, q0: q, herCaps, rest: o.rest, HL: o.HL, com: o.com });
}

/**
 * A spring rider: one body on a ball joint at the spring's foot, held to
 * upright by the joint's angle lock as a finite spring — the coil's bending
 * stiffness — with its centre of mass above the foot, so it rocks.
 */
function pgRider(o) {
  const net = avbdNet({
    maxBodies: 1, maxJoints: 1, maxStrings: 0, maxPoints: 0, maxBoxes: 0, maxCaps: 1 + PGH.caps,
    maxContacts: 8, maxWorldCaps: 1, worldCapK: PGP.youK,
    iterations: PGP.iterations, alpha: PGP.alpha, alphaContact: 0.9, beta: PGP.beta,
    betaAng: PGP.betaAng, gamma: PGP.gamma, gravity: [0, -9.81, 0], drag: o.drag || 1.2,
    vMax: 20, wMax: 30, margin: 0.02, deep: 0.10, mu: 0.6, floorMu: 0.6, capK: 1e4,
  });
  const X = o.X, Y = [0, 1, 0], Z = o.Z;
  const q = [0, 0, 0, 1];
  avbdQuatFromBasis(X[0], X[1], X[2], Y[0], Y[1], Y[2], Z[0], Z[1], Z[2], q, 0);
  const F = o.foot;
  const b = net.addBody(o.mass, [o.I[0], o.I[1], o.I[2], 0, 0, 0], F[0], F[1] + o.com, F[2], q);
  const j = net.addJoint(-1, F, b, [0, -o.com, 0], Infinity, o.k, 1);
  net.setTarget(j, F[0], F[1], F[2], q);
  const c = net.addCap(b, 0);
  net.setCap(c, 0, 0.62 - o.com, 0.42, 0, 0.66 - o.com, -0.45, 0.15, 0.15);
  const herCaps = [];
  for (let k = 0; k < PGH.caps; k++) {
    const hc = net.addCap(b, 1 + k);
    net.setCap(hc, 0, 0, 0, 0, 0.01, 0, 0.01, 0.01);
    net.cpOn[hc] = 0;
    herCaps.push(hc);
  }
  net.finish();
  const sim = pgSim({ net, bodies: [b], c: [F[0], F[1] + o.com, F[2]], reach: 0.9, caps: true, arm: 0.6,
    far: 1.0, still: 0.02 });
  sim.asleep = false;
  for (let k = 0; k < 60; k++) net.step(PGP.sub);
  net.V.fill(0, 0, 3); net.W.fill(0, 0, 3);
  sim.asleep = true;
  return Object.assign(sim, { body: b, joint: j, k: o.k, com: o.com, herCaps });
}

/**
 * An in-ground trampoline: the bed is one body hung on `n` radial springs
 * from the rim, pre-tensioned — which is what a sprung bed is, and what
 * makes it stiffen as it goes down (the springs lengthen AND turn toward the
 * pull). Under it, the pit's floor. The walker, when on it, is a second body
 * held to the bed by one stiff spring, the leg, whose rest length is how
 * straight the legs are — the springboard's (`plungeBoard`, 61-plunge.js)
 * — so the leg is what pumps it: bent as you land, driven straight as the bed
 * comes back up.
 *
 * Its own gravity is the walker's (`GROUND.hopG`), not the world's: the
 * flight between bounces is the walker's own hop, and a bed that threw at
 * 9.81 what the hop catches at 12 would gain height by itself.
 */
const PGT = {
  RB: 0.60,             // m, the bed's radius
  n: 8,                 // springs round the rim
  // N/m a spring, and how much shorter than the radius it is unstretched.
  // Vertical stiffness for a small dip is n·k·pre: 8 · 7500 · 0.20 = 12 kN/m,
  // so a 60 kg walker on it at 12 m/s² sits 6 cm down; and it stiffens with
  // depth: at 0.3 m it pushes 5.1 kN, not 3.6.
  k: 12000, pre: 0.25,
  bed: 5,               // kg, the moving part of the bed and its springs
  drag: 2.0,            // 1/s, on the bed
  pit: 0.42,            // m under the bed's rest, the pit's floor
  sub: 1 / 240,         // the springboard's rate, for the springboard's reason
  you: 60, legK: 1e5,   // kg, N/m
  stand: 0.90, absorb: 0.64, reach: 1.04,
  absorbT: 0.08, driveT: 0.12, buffer: 0.30,
  // The highest a bounce goes, m over the bed: the takeoff is capped at the
  // speed that reaches it. Without it a well-timed pump climbs to 5 m.
  top: 3.5,
};
function pgBed(o) {
  const T = PGT, g = o.g || 12;
  const net = avbdNet({
    maxBodies: 2, maxJoints: 0, maxStrings: T.n + 1, maxPoints: 1, maxBoxes: 0, maxCaps: 0,
    maxContacts: 4, iterations: 10, alpha: 0.95, alphaContact: 0.9, beta: 1e5, betaAng: 1e9,
    gamma: 0.999, gravity: [0, -g, 0], drag: 0, vMax: 25, wMax: 40, margin: 0.01, deep: 0.3,
    mu: 0.5, floorMu: 0.5, capK: 1e4, pointsHitCaps: false,
  });
  const C = o.c;      // the bed's centre at rest, on its surface
  const bed = net.addBody(T.bed, [0.4, 0.8, 0.4, 0, 0, 0], C[0], C[1], C[2], null);
  net.drag[bed] = T.drag;
  for (let i = 0; i < T.n; i++) {
    const a = (i / T.n) * Math.PI * 2;
    net.addString(-1, [C[0] + Math.cos(a) * T.RB, C[1], C[2] + Math.sin(a) * T.RB], bed, [0, 0, 0],
      T.RB * (1 - T.pre), T.k);
  }
  const you = net.addBody(T.you, [5, 5, 5, 0, 0, 0], C[0], C[1] + T.stand, C[2], null);
  const leg = net.addString(bed, [0, 0, 0], you, [0, 0, 0], T.stand, T.legK);
  net.addPoint(bed, 0, 0, 0, 0);
  net.finish();
  net.setFloor(() => C[1] - T.pit);
  net.setString(leg, null, null, false);
  net.setLive(you, false);
  const sim = pgSim({ net, bodies: [bed], c: C, reach: 0, caps: false, arm: 0, far: 1.2, sub: T.sub,
    still: 0.01, sleepAfter: 0.6, busy: () => on });
  // Settle the bed under its own weight; `rest` is where it hangs.
  sim.asleep = false;
  for (let k = 0; k < 480; k++) net.step(T.sub);
  net.V.fill(0, 0, 3);
  const rest = net.P[3 * bed + 1];
  sim.asleep = true;

  let on = false, legLen = T.stand, phase = 'stand', pT = 0, buffered = -1, flew = 0;
  // How hard this pump drives, 0..1 of the leg's full straightening — 1 for
  // the walker; Baye picks hers to the height she wants (1.562.0).
  let driveK = 1, bufK = 1;
  const st = { bounces: 0, pumps: 0, maxDip: 0 };
  /** How far down the bed is from where it rests, m (positive down). */
  const dip = () => rest - net.P[3 * bed + 1];
  /** Walker on, feet at y going at vy (m/s, up positive). */
  function mount(y, vy) {
    on = true;
    net.setLive(you, true);
    const top = net.P[3 * bed + 1];
    legLen = Math.max(T.absorb, Math.min(T.reach, y + T.stand - top > 0 ? T.stand : T.stand));
    net.place(you, C[0], top + legLen, C[2], [0, 0, 0, 1]);
    net.kick(you, 0, vy, 0);
    net.setString(leg, null, legLen, true);
    sim.wake();
    if (buffered >= 0 && flew - buffered < T.buffer) { phase = 'absorb'; pT = 0; st.pumps++; driveK = bufK; }
    else phase = 'stand';
    buffered = -1;
  }
  function unmount() {
    on = false;
    net.setString(leg, null, null, false);
    net.setLive(you, false);
    phase = 'stand';
  }
  /** Enter: pump now, or as you land if you are in the air over it. */
  function press(k = 1) {
    if (on) {
      if (phase === 'stand') { phase = 'absorb'; pT = 0; st.pumps++; driveK = k; }
      return true;
    }
    buffered = flew;
    bufK = k;
    return true;
  }
  /**
   * One frame. Returns null with nobody on it, or { y: feet, vy, off } —
   * `off` true the step the leg let go going up (the takeoff).
   */
  function step(dt, airborne) {
    flew += dt;
    let off = false, offV = 0, offLeg = T.stand;
    const wasOn = on;
    sim.step(dt, (h) => {
      if (!on) return;
      // The leg's length: absorb, then drive, then stand.
      if (phase !== 'stand') {
        pT += h;
        if (phase === 'absorb') {
          const u = Math.min(1, pT / T.absorbT);
          legLen = T.stand + (T.absorb - T.stand) * (u * u * (3 - 2 * u));
          if (u >= 1) { phase = 'drive'; pT = 0; }
        } else if (phase === 'drive') {
          const u = Math.min(1, pT / T.driveT);
          legLen = T.absorb + (T.reach - T.absorb) * driveK * (u * u);
          if (u >= 1) { phase = 'settle'; pT = 0; }
        } else if (phase === 'settle') {
          const u = Math.min(1, pT / 0.25);
          const top = T.absorb + (T.reach - T.absorb) * driveK;
          legLen = top + (T.stand - top) * u;
          if (u >= 1) phase = 'stand';
        }
        net.setString(leg, null, legLen, true);
      }
      const P = net.P, V = net.V;
      P[3 * you] = C[0]; P[3 * you + 2] = C[2]; V[3 * you] = 0; V[3 * you + 2] = 0;
      net.W.fill(0, 3 * you, 3 * you + 3);
      net.Q[4 * you] = 0; net.Q[4 * you + 1] = 0; net.Q[4 * you + 2] = 0; net.Q[4 * you + 3] = 1;
    }, () => {
      // The takeoff, looked for after every substep: the leg is a two-way
      // spring, and a step late it pulls you back down on to the bed.
      if (!on) return;
      const P = net.P, V = net.V;
      const stretch = P[3 * you + 1] - P[3 * bed + 1] - legLen;
      if (stretch > 0.002 && V[3 * you + 1] > V[3 * bed + 1] + 0.05 && V[3 * you + 1] > 0.4) {
        off = true; offV = V[3 * you + 1]; offLeg = legLen;
        st.bounces++;
        unmount();
      }
    });
    if (!wasOn && !off) return null;
    const P = net.P, V = net.V;
    // Where your soles are: on the bed's middle. And how far your knees are
    // bent, which the eye takes (`knees`, positive down).
    const feet = off ? P[3 * you + 1] - offLeg : P[3 * bed + 1];
    st.maxDip = Math.max(st.maxDip, dip());
    const cap = Math.sqrt(2 * g * T.top);
    return { y: feet, vy: off ? Math.min(offV, cap) : V[3 * you + 1], off, legLen,
      knees: T.stand - (off ? offLeg : legLen), dip: dip() };
  }
  /** A push on the bed: dv m/s down. */
  function poke(dv) { net.kick(bed, 0, -dv, 0); sim.wake(); }
  Object.assign(sim, { bed, you, rest, dip, mount, unmount, press, step2: step, poke, st, C });
  // Getters by definition: Object.assign would copy their values once.
  Object.defineProperty(sim, 'on', { get: () => on });
  Object.defineProperty(sim, 'phase', { get: () => phase });
  return sim;
}

function buildPlayground(scene, jad) {
  if (!jad || !jad.toWorld || !jad.blockers || !jad.grounds) return null;
  const GR = jad.grounds;
  if (!GR.play || !GR.shore || !GR.pong) return null;
  const jit = pgJit;
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const mix = (a, c, k) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k,
    a[2] + (c[2] - a[2]) * k];

  // ── vectors ────────────────────────────────────────────────────────────────
  const add = (a, c, k = 1) => [a[0] + c[0] * k, a[1] + c[1] * k, a[2] + c[2] * k];
  const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
  const crs = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2],
    a[0] * c[1] - a[1] * c[0]];
  const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const nrm = (a) => {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / L, a[1] / L, a[2] / L];
  };
  const lerp3 = (a, c, k) => mix(a, c, k);

  // ── the shore frame ────────────────────────────────────────────────────────
  const P = (t, s, y) => {
    const w = jad.toWorld(t, s);
    return [w[0], y, w[2]];
  };
  const hillY = (t, s) => {
    const w = jad.toWorld(t, s);
    return Math.max(w[1], groundAt(w[0], w[2]));
  };
  const walkAt = (t, s) => {
    const w = jad.toWorld(t, s);
    return jad.walkY ? jad.walkY(w[0], w[2]) : w[1];
  };

  // `play`'s gravel pad is laid by 43-jadrija.js in 2 m cells at the higher
  // of the deck and the hill plus 5 cm, each cell two triangles split corner
  // to corner. The rubber lies on THAT, not on the function it samples: a
  // pad sampled finer than the gravel would dip through it wherever the hill
  // is convex between two of its corners.
  const G = GR.play;
  const nT = Math.max(1, Math.round((G.t1 - G.t0) / 2));
  const nS = Math.max(1, Math.round((G.s1 - G.s0) / 2));
  const cy = [];
  for (let i = 0; i <= nT; i++) {
    cy.push([]);
    for (let j = 0; j <= nS; j++) {
      cy[i].push(hillY(G.t0 + (G.t1 - G.t0) * (i / nT), G.s0 + (G.s1 - G.s0) * (j / nS)) + 0.05);
    }
  }
  const padY = (t, s) => {
    let u = clamp((t - G.t0) / (G.t1 - G.t0), 0, 1) * nT;
    let v = clamp((s - G.s0) / (G.s1 - G.s0), 0, 1) * nS;
    const i = Math.min(nT - 1, u | 0), j = Math.min(nS - 1, v | 0);
    u -= i; v -= j;
    const ya = cy[i][j], yb = cy[i + 1][j], yc = cy[i + 1][j + 1], yd = cy[i][j + 1];
    return u >= v ? ya + u * (yb - ya) + v * (yc - yb) : ya + v * (yd - ya) + u * (yc - yd);
  };
  // What a foot on B stands on: the rubber where there is rubber.
  const onPad = (t, s) => {
    const D = PG.pad;
    const dt = Math.max(D.t0 + D.r - t, 0, t - (D.t1 - D.r));
    const ds = Math.max(D.s0 + D.r - s, 0, s - (D.s1 - D.r));
    return dt * dt + ds * ds <= D.r * D.r;
  };
  const bY = (t, s) => padY(t, s) + (onPad(t, s) ? PG.RUB : 0);

  /**
   * An object's own frame in the shore frame: `u` along it at angle `a` to
   * `t`, `v` across, `y` absolute. And the world unit vectors of those axes,
   * which is what a tube or a hinge wants.
   */
  function frame(t0, s0, a = 0) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const TS = (u, v) => [t0 + u * ca - v * sa, s0 + u * sa + v * ca];
    const F = (u, v, y) => {
      const [t, s] = TS(u, v);
      return P(t, s, y);
    };
    const o = F(0, 0, 0);
    const U = nrm(sub(F(1, 0, 0), o)), V = nrm(sub(F(0, 1, 0), o));
    // The face normal of anything built on U and up: V is not quite square
    // to U where the shore bends, and a disc laid square to V on a panel
    // built on U went half into it.
    let N = nrm(crs(U, [0, 1, 0]));
    if (dot(N, V) < 0) N = N.map((x) => -x);
    return { F, TS, U, V, N, t0, s0, a };
  }

  // ── builders ───────────────────────────────────────────────────────────────
  const up = propBuilder();      // everything that stands still
  const rub = propBuilder();     // the rubber
  const floor = propBuilder();   // the tables' gravel
  const runs = [];               // colliders, for `confine`
  const block = (t0, t1, s0, s1, y, h) => runs.push({
    t: (t0 + t1) * 0.5, s: (s0 + s1) * 0.5, a: Math.abs(t1 - t0) * 0.5,
    c: Math.abs(s1 - s0) * 0.5, h, y,
  });

  /** An orthonormal pair square to unit `d`. */
  const perp = (d) => {
    const ref = Math.abs(d[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
    const e1 = nrm(crs(d, ref));
    return [e1, crs(d, e1)];
  };

  /**
   * A face of ground: lit as level whatever its slope, and wound so it faces
   * up — the material flips a back face's normal, and a ground triangle wound
   * the other way came out black.
   */
  const UPN = [0, 1, 0];
  function ground3(B, a, c, d, ca, cc, cd) {
    const n = crs(sub(c, a), sub(d, a));
    if (n[1] >= 0) B.smooth(a, c, d, UPN, UPN, UPN, ca, cc, cd);
    else B.smooth(a, d, c, UPN, UPN, UPN, ca, cd, cc);
  }

  /**
   * A round pipe along a polyline, smooth-shaded, with the section carried
   * along it by parallel transport so a bend does not pinch. `r` a number or
   * `(i) => r`. Caps on both ends unless `caps` is false.
   */
  function pipe(B, pts, r, col, n = 10, caps = true) {
    const R = typeof r === 'function' ? r : () => r;
    const m = pts.length;
    if (m < 2) return;
    const T = [];
    for (let i = 0; i < m; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(m - 1, i + 1)];
      T.push(nrm(sub(c, a)));
    }
    let [e1, e2] = perp(T[0]);
    const rings = [];
    for (let i = 0; i < m; i++) {
      if (i > 0) {
        // Transport e1 onto the new tangent.
        e1 = nrm(sub(e1, T[i].map((x) => x * dot(e1, T[i]))));
        e2 = crs(T[i], e1);
      }
      const ring = [], nr = [];
      for (let k = 0; k < n; k++) {
        const an = (k / n) * TAU;
        const d = add(e1.map((x) => x * Math.cos(an)), e2, Math.sin(an));
        ring.push(add(pts[i], d, R(i)));
        nr.push(d);
      }
      rings.push([ring, nr]);
    }
    for (let i = 0; i < m - 1; i++) {
      const [A, NA] = rings[i], [C, NC] = rings[i + 1];
      for (let k = 0; k < n; k++) {
        const k2 = (k + 1) % n;
        B.smooth(A[k], C[k], C[k2], NA[k], NC[k], NC[k2], col, col, col);
        B.smooth(A[k], C[k2], A[k2], NA[k], NC[k2], NA[k2], col, col, col);
      }
    }
    if (caps) {
      for (const [i, sg] of [[0, -1], [m - 1, 1]]) {
        const [A] = rings[i];
        const N = T[i].map((x) => x * sg);
        for (let k = 1; k < n - 1; k++) {
          if (sg > 0) B.smooth(A[0], A[k], A[k + 1], N, N, N, col, col, col);
          else B.smooth(A[0], A[k + 1], A[k], N, N, N, col, col, col);
        }
      }
    }
  }
  const tube = (B, a, c, r, col, n = 10, caps = true) => pipe(B, [a, c], r, col, n, caps);

  /** A box on three unit axes about a centre, half-sizes `h`. */
  function boxO(B, c, ax, ay, az, hx, hy, hz, col, top) {
    const p = (i, j, k) => add(add(add(c, ax, i * hx), ay, j * hy), az, k * hz);
    const q = (a, b, cc, d, cl) => B.quad(a, b, cc, d, cl);
    q(p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1), col);
    q(p(1, -1, 1), p(-1, -1, 1), p(-1, 1, 1), p(1, 1, 1), col);
    q(p(1, -1, -1), p(1, -1, 1), p(1, 1, 1), p(1, 1, -1), col);
    q(p(-1, -1, 1), p(-1, -1, -1), p(-1, 1, -1), p(-1, 1, 1), col);
    q(p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1), top || col);
    q(p(-1, -1, 1), p(1, -1, 1), p(1, -1, -1), p(-1, -1, -1), col);
  }
  /** A box between two points, square section `w` by `h` (h along `upv`). */
  function bar(B, a, c, w, h, col, upv = [0, 1, 0]) {
    const d = sub(c, a), L = Math.hypot(d[0], d[1], d[2]);
    const ax = d.map((x) => x / L);
    let az = crs(ax, upv);
    if (Math.hypot(az[0], az[1], az[2]) < 1e-4) az = crs(ax, [1, 0, 0]);
    az = nrm(az);
    const ay = crs(az, ax);
    boxO(B, lerp3(a, c, 0.5), ax, ay, az, L / 2, h / 2, w / 2, col);
  }
  /** A flat disc, facing `n`, `seg` sides. */
  function disc(B, c, n, r, col, seg = 20) {
    const [e1, e2] = perp(n);
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * TAU, a1 = ((k + 1) / seg) * TAU;
      const p0 = add(add(c, e1, Math.cos(a0) * r), e2, Math.sin(a0) * r);
      const p1 = add(add(c, e1, Math.cos(a1) * r), e2, Math.sin(a1) * r);
      B.smooth(c, p0, p1, n, n, n, col, col, col);
    }
  }
  /** A knot: a squashed ball on a rope. */
  function ball(B, c, r, col, seg = 8, rows = 5, squash = 1) {
    let prev = null;
    for (let j = 0; j <= rows; j++) {
      const ph = -Math.PI / 2 + (j / rows) * Math.PI;
      const ring = [];
      for (let k = 0; k <= seg; k++) {
        const th = (k / seg) * TAU;
        const n = [Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)];
        ring.push([add(c, [n[0] * r, n[1] * r * squash, n[2] * r]), n]);
      }
      if (prev) {
        for (let k = 0; k < seg; k++) {
          const a = prev[k], b2 = prev[k + 1], c2 = ring[k + 1], d = ring[k];
          B.smooth(a[0], d[0], c2[0], a[1], d[1], c2[1], col, col, col);
          B.smooth(a[0], c2[0], b2[0], a[1], c2[1], b2[1], col, col, col);
        }
      }
      prev = ring;
    }
  }
  /**
   * A rounded quadratic curve, `n` points, from `a` through the control `c`
   * to `d` — the gooseneck and the slide's plan.
   */
  const quadBez = (a, c, d, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
      out.push([a[0] * w0 + c[0] * w1 + d[0] * w2, a[1] * w0 + c[1] * w1 + d[1] * w2,
        a[2] * w0 + c[2] * w1 + d[2] * w2]);
    }
    return out;
  };

  // ── the moving parts ───────────────────────────────────────────────────────
  //
  // Since 1.558.0 each is an AVBD body (PGP and the four builders above
  // `buildPlayground`), drawn as a rigid mesh in that body's own frame — x
  // along the hinge or the axle, y up, z = x × y — whose matrix is the
  // body's position and turn, written every frame it is near. The chains and
  // the rope are not rigid: they are one shared tube mesh laid through each
  // chain's joints every frame (`chainTick`).
  const parts = [];
  const eqMat = solidMaterial(0xffffff, {
    spec: 0.10, specPower: 26, side: THREE.DoubleSide, emissive: 0.06,
    body: 'n = gl_FrontFacing ? n : -n; base *= vVCol;',
  });
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  /**
   * A rigid moving part: `build(B)` in its own frame, `origin` and `X` where
   * that frame is at rest in the world.
   */
  function rigid(kind, origin, X, build, extra = {}) {
    const B = propBuilder();
    build(B);
    const Y = [0, 1, 0], Z = crs(X, Y);
    const mesh = new THREE.Mesh(B.geo(), eqMat);
    mesh.name = 'play:' + kind;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.makeBasis(v3(X), v3(Y), v3(Z));
    mesh.matrix.setPosition(origin[0], origin[1], origin[2]);
    mesh.geometry.computeBoundingSphere();
    scene.add(mesh);
    mesh.updateMatrixWorld(true);
    const p = { kind, mesh, origin, X, Z, tris: B.count() / 3, ...extra };
    parts.push(p);
    return p;
  }
  /** A builder that draws into B moved `dy` up — made in a hinge frame, kept in a body's. */
  const lift = (B, dy) => {
    const sh = (q) => [q[0], q[1] + dy, q[2]];
    return {
      quad: (a, c, d, e, cl) => B.quad(sh(a), sh(c), sh(d), sh(e), cl),
      tri: (a, c, d, cl) => B.tri(sh(a), sh(c), sh(d), cl),
      smooth: (a, c, d, na, nc, nd, ca, cc, cd) => B.smooth(sh(a), sh(c), sh(d), na, nc, nd, ca, cc, cd),
    };
  };
  /** A world point in a hinge frame: origin H, axes X, up, X × up. */
  const inFrame = (H, X) => {
    const Z = crs(X, [0, 1, 0]);
    return (x, y, z) => [H[0] + X[0] * x + Z[0] * z, H[1] + y, H[2] + X[2] * x + Z[2] * z];
  };
  /** The quaternion of the frame X, up, X × up. */
  const quatOf = (X) => {
    const Z = crs(X, [0, 1, 0]), q = [0, 0, 0, 1];
    avbdQuatFromBasis(X[0], X[1], X[2], 0, 1, 0, Z[0], Z[1], Z[2], q, 0);
    return q;
  };
  // The chains and the rope: { sim, k (which chain), col, r(f) radius along
  // it, knots }. The tube is laid out once they have all hung — `chainBuild`.
  const chainList = [];
  /**
   * A flat seat, in the pivot frame: the hinge axis is x, the seat hangs at
   * y = −L, `w` along x. Black rubber, sagging a little in the middle, with
   * its steel hanger plates at the ends. Its chains are the shared tube and
   * its shackles are on the beam (`shackles`).
   */
  function seatGeo(B, L, w = 0.44) {
    // The seat: a strip of rubber, 17 cm deep, 3.5 cm thick, sagging 3 cm.
    const N = 10, D = 0.085, TH = 0.035;
    for (let i = 0; i < N; i++) {
      const x0 = -w / 2 + (w * i) / N, x1 = -w / 2 + (w * (i + 1)) / N;
      const y0 = -L - 0.03 * (1 - Math.pow((2 * x0) / w, 2));
      const y1 = -L - 0.03 * (1 - Math.pow((2 * x1) / w, 2));
      const c = PG.RUBBER;
      B.quad([x0, y0, -D], [x1, y1, -D], [x1, y1, D], [x0, y0, D], shade(c, 1.15));
      B.quad([x0, y0 - TH, D], [x1, y1 - TH, D], [x1, y1 - TH, -D], [x0, y0 - TH, -D], c);
      B.quad([x0, y0, D], [x1, y1, D], [x1, y1 - TH, D], [x0, y0 - TH, D], c);
      B.quad([x1, y1, -D], [x0, y0, -D], [x0, y0 - TH, -D], [x1, y1 - TH, -D], c);
    }
    for (const x of [-w / 2, w / 2]) {
      const y = -L;
      B.quad([x, y, D], [x, y, -D], [x, y - TH, -D], [x, y - TH, D], PG.RUBBER);
      // Hanger plate.
      boxO(B, [x * 0.92, y + 0.02, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.006, 0.04, 0.03,
        PG.GALV);
    }
  }
  /** The shackles on a beam, at the hinge frame's x in `xs`. */
  function shackles(H, X, xs) {
    const F = inFrame(H, X);
    for (const x of xs) pipe(up, [F(x, 0.04, -0.03), F(x, 0.06, 0), F(x, 0.04, 0.03)], 0.008, PG.GALV, 5);
  }
  /**
   * A seat on two chains, as a part: drawn, hung, and its chains listed.
   * `H` the hinge on the beam, `X` along the beam, `L` hinge to seat.
   */
  function swingSeat(kind, H, X, L, w, chainCol) {
    const hw = w / 2 - 0.02;
    const body = [H[0], H[1] - L, H[2]];
    const p = rigid(kind, body, X, (B) => seatGeo(lift(B, L), L, w), { L, r: 0.45 });
    const F = inFrame(H, X);
    p.sim = pgHang({
      anchors: [F(-hw, 0, 0), F(hw, 0, 0)],
      body: { m: 3, I: [0.01, 0.06, 0.05], p: body, q: quatOf(X) },
      chains: [{ a: 0, at: [-hw, 0.05, 0] }, { a: 1, at: [hw, 0.05, 0] }],
      caps: [[-w / 2, -0.02, 0, w / 2, -0.02, 0, 0.06]], c: body, reach: 0.7,
    });
    p.c = body; p.H = H;
    // For her (1.562.0): where the chains meet the seat, and its top.
    p.hw = hw; p.w = w; p.seatY = -0.03;
    for (let k = 0; k < 2; k++) chainList.push({ sim: p.sim, k, col: chainCol });
    shackles(H, X, [-hw, hw]);
    return p;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // B — THE FENCED PLAYGROUND
  // ═══════════════════════════════════════════════════════════════════════════

  // ── the rubber ─────────────────────────────────────────────────────────────
  //
  // The rounded rectangle cut out of a 0.3 m grid, cell by cell (the shape is
  // convex, so each cell clipped against it is a convex polygon and fans), at
  // `padY` + RUB. Mottled in two octaves of value noise at 1.2 m and 0.4 m,
  // and worn greyer and lighter where feet land: under the swings, at the
  // slide's foot, round the trampolines and the rider. The granule speckle is
  // in the material, not here — see `rubMat`.
  const D = PG.pad;
  const outline = [];
  {
    const C = [[D.t1 - D.r, D.s0 + D.r, -Math.PI / 2], [D.t1 - D.r, D.s1 - D.r, 0],
      [D.t0 + D.r, D.s1 - D.r, Math.PI / 2], [D.t0 + D.r, D.s0 + D.r, Math.PI]];
    for (const [ct, cs, a0] of C) {
      for (let k = 0; k <= 10; k++) {
        const a = a0 + (k / 10) * (Math.PI / 2);
        outline.push([ct + Math.cos(a) * D.r, cs + Math.sin(a) * D.r]);
      }
    }
  }
  const noise2 = (x, y, k) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const h = (i, j) => jit(i * 157 + j * 911, k);
    return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy)
      + (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy;
  };
  // Where feet land, (t, s, radius t, radius s, how much).
  const WEAR = [];
  // The two trampolines, from the holes 43-jadrija.js cut in the gravel pad
  // for their pits (1.558.0).
  const TRAMPS = (G.holes || [[519.6, 43.0], [527.0, 43.0]]).map((h) => [h[0], h[1]]);
  const wear = (t, s) => {
    let w = 0;
    for (const [wt, ws, rt, rs, k] of WEAR) {
      const d = ((t - wt) / rt) ** 2 + ((s - ws) / rs) ** 2;
      if (d < 1) w = Math.max(w, k * (1 - d) * (1 - d));
    }
    return w;
  };
  const rubCol = (t, s) => {
    const n = 0.62 * noise2(t / 1.2, s / 1.2, 410) + 0.38 * noise2(t / 0.4, s / 0.4, 411);
    const g = 0.92 + 0.16 * n;
    const base = shade(PG.BLUE, g);
    // Worn: the colour goes out of it toward a pale grey-blue.
    return mix(base, [0.300, 0.355, 0.440], wear(t, s));
  };
  function buildRubber() {
    const STEP = 0.25;
    // Inside the outline: every edge's left side, the outline running
    // anticlockwise in (t, s).
    const clip = (poly) => {
      let out = poly;
      for (let i = 0; i < outline.length && out.length; i++) {
        const a = outline[i], c = outline[(i + 1) % outline.length];
        const ex = c[0] - a[0], ey = c[1] - a[1];
        const side = (p) => ex * (p[1] - a[1]) - ey * (p[0] - a[0]);
        const res = [];
        for (let k = 0; k < out.length; k++) {
          const p = out[k], q = out[(k + 1) % out.length];
          const sp = side(p), sq = side(q);
          if (sp >= 0) res.push(p);
          if ((sp >= 0) !== (sq >= 0)) {
            const f = sp / (sp - sq);
            res.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
          }
        }
        out = res;
      }
      return out;
    };
    // Tucked 4 cm down under each trampoline's rim and bed, so the bed and
    // the rim lie on it rather than in it; the rim covers the step.
    const tuck = (t, s) => {
      for (const [tt, ts] of TRAMPS) {
        if ((t - tt) ** 2 + (s - ts) ** 2 < 0.78 * 0.78) return 0.04;
      }
      return 0;
    };
    const V = (t, s) => P(t, s, padY(t, s) + PG.RUB - tuck(t, s));
    // AND A HOLE UNDER EACH BED (1.558.0), the pit the bed goes down into:
    // cells near one are cut to 6 cm squares and those whose middle is
    // within 0.70 m of it left out, so the ragged edge is 0.66-0.74 m out,
    // all of it under the rim (0.64-0.80).
    const HOLE = 0.70;
    const nearHole = (t, s, m) => TRAMPS.some(([tt, ts]) => (t - tt) ** 2 + (s - ts) ** 2 < (HOLE + m) ** 2);
    const lay = (t, s, t1, s1) => {
      const poly = clip([[t, s], [t1, s], [t1, s1], [t, s1]]);
      if (poly.length < 3) return;
      for (let k = 1; k < poly.length - 1; k++) {
        const a = poly[0], c = poly[k], d = poly[k + 1];
        // Colour per vertex, so the wear and the mottle are washes and
        // not a chequerboard of cells.
        ground3(rub, V(a[0], a[1]), V(d[0], d[1]), V(c[0], c[1]),
          rubCol(a[0], a[1]), rubCol(d[0], d[1]), rubCol(c[0], c[1]));
      }
    };
    for (let t = D.t0; t < D.t1 - 1e-6; t += STEP) {
      for (let s = D.s0; s < D.s1 - 1e-6; s += STEP) {
        const t1 = Math.min(t + STEP, D.t1), s1 = Math.min(s + STEP, D.s1);
        if (!nearHole((t + t1) / 2, (s + s1) / 2, 0.25)) { lay(t, s, t1, s1); continue; }
        const n = 4, dt = (t1 - t) / n, ds = (s1 - s) / n;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const ta = t + i * dt, sa = s + j * ds;
            if (nearHole(ta + dt / 2, sa + ds / 2, 0)) continue;
            lay(ta, sa, ta + dt, sa + ds);
          }
        }
      }
    }
    // The poured edge: rolled over in a quarter round and down onto the
    // gravel, a shade darker where the trowel left it.
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], c = outline[(i + 1) % outline.length];
      if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 1e-4) continue;
      // Outward normal in (t, s): the outline runs anticlockwise.
      const ex = c[0] - a[0], ey = c[1] - a[1], L = Math.hypot(ex, ey);
      const ot = ey / L, os = -ex / L;
      const steps = Math.max(1, Math.ceil(L / 0.3));
      for (let j = 0; j < steps; j++) {
        const p0 = [a[0] + ex * (j / steps), a[1] + ey * (j / steps)];
        const p1 = [a[0] + ex * ((j + 1) / steps), a[1] + ey * ((j + 1) / steps)];
        const col = shade(rubCol(p0[0], p0[1]), 0.86);
        let prev = null;
        for (let k = 0; k <= 3; k++) {
          const ang = (k / 3) * (Math.PI / 2);
          const o = 0.035 * Math.sin(ang), dy = PG.RUB * Math.cos(ang) - PG.RUB;
          const q0 = P(p0[0] + ot * o, p0[1] + os * o, padY(p0[0], p0[1]) + PG.RUB + dy - (k === 3 ? 0.01 : 0));
          const q1 = P(p1[0] + ot * o, p1[1] + os * o, padY(p1[0], p1[1]) + PG.RUB + dy - (k === 3 ? 0.01 : 0));
          if (prev) rub.quad(prev[0], prev[1], q1, q0, col);
          prev = [q0, q1];
        }
      }
    }
  }

  // ── the fence ──────────────────────────────────────────────────────────────
  //
  // Round posts, and 2D welded-mesh panels between them: a frame of
  // horizontal double wires and a vertical wire every 0.2 m — which is what
  // the panel is, and also as fine as it can be drawn before it shimmers. The
  // shore build's own panels went to four bars a panel for that reason; these
  // stand next to you, so they get more.
  function buildFence() {
    const Fc = PG.fence;
    const H = 1.03;
    const post = (t, s, r = 0.03, h = H + 0.05) => {
      const y = bY(t, s);
      pipe(up, [P(t, s, y - 0.15), P(t, s, y + h)], r, PG.GREEN, 8);
      disc(up, P(t, s, y + h + 0.001), [0, 1, 0], r * 1.15, shade(PG.GREEN, 0.8), 8);
    };
    // One run of panels from (t0, s0) to (t1, s1), skipping [g0, g1] along it.
    const run = (a, c, gap) => {
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const n = Math.ceil(L / 2.52);
      for (let i = 0; i < n; i++) {
        const u0 = (L * i) / n, u1 = (L * (i + 1)) / n;
        const at = (u) => [a[0] + ((c[0] - a[0]) * u) / L, a[1] + ((c[1] - a[1]) * u) / L];
        post(...at(u0));
        if (gap && u1 > gap[0] && u0 < gap[1]) {
          post(...at(gap[0]), 0.04, H + 0.12);
          post(...at(gap[1]), 0.04, H + 0.12);
          if (u0 < gap[0] - 0.1) panel(at(u0 + 0.04), at(gap[0] - 0.05));
          if (u1 > gap[1] + 0.1) panel(at(gap[1] + 0.05), at(u1 - 0.04));
          continue;
        }
        panel(at(u0 + 0.04), at(u1 - 0.04));
      }
    };
    const panel = (a, c) => {
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const y = (u) => bY(a[0] + ((c[0] - a[0]) * u) / L, a[1] + ((c[1] - a[1]) * u) / L);
      const Q = (u, h) => P(a[0] + ((c[0] - a[0]) * u) / L, a[1] + ((c[1] - a[1]) * u) / L,
        y(u) + h);
      // Horizontal wires, doubled the way a 6/5/6 panel's are.
      for (const h of [0.06, 0.40, 0.72, 1.00]) {
        for (const dz of [-0.008, 0.008]) {
          bar(up, add(Q(0, h), [0, dz, 0]), add(Q(L, h), [0, dz, 0]), 0.0065, 0.0065,
            PG.GREEN);
        }
      }
      const nv = Math.max(1, Math.round(L / 0.2));
      for (let k = 0; k <= nv; k++) {
        const u = (L * k) / nv;
        bar(up, Q(u, 0.04), Q(u, H), 0.0055, 0.0055, shade(PG.GREEN, 1.08));
      }
    };
    const T0 = Fc.t0, T1 = Fc.t1, S0 = Fc.s0, S1 = Fc.s1;
    const gap = [Fc.gate[0] - T0, Fc.gate[1] - T0];
    run([T0, S0], [T1, S0], gap);
    run([T1, S0], [T1, S1]);
    run([T1, S1], [T0, S1]);
    run([T0, S1], [T0, S0]);
    // The gate: two leaves of 40 mm tube with the same mesh in them, one on
    // each jamb, both standing open — swung out past square on to the gravel
    // strip, so neither narrows the way in. Each is a thin collider of its
    // own: walk into a leaf and it stops you, as the fence does.
    for (const side of [0, 1]) {
      const ht = Fc.gate[side], hs = S0;
      const y = bY(ht, hs);
      const W = (Fc.gate[1] - Fc.gate[0] - 0.08) / 2;
      const open = 1.75;                                    // 100 degrees
      // In (t, s): along the fence toward the middle when shut, then out.
      const sg = side ? -1 : 1;
      const dir = [sg * Math.cos(open), -Math.sin(open)];
      const at = (u, h) => P(ht + dir[0] * (u + 0.05), hs + dir[1] * (u + 0.05), y + h);
      pipe(up, [at(0, 0.06), at(0, 1.00), at(W, 1.00), at(W, 0.06), at(0, 0.06)], 0.02,
        PG.GREEN, 6, false);
      for (let u = 0.1; u < W - 0.05; u += 0.2) bar(up, at(u, 0.07), at(u, 0.99), 0.0055, 0.0055, PG.GREEN);
      for (const h of [0.40, 0.72]) bar(up, at(0, h), at(W, h), 0.0065, 0.0065, PG.GREEN);
      // Hinges, and the latch on the west leaf and its keeper on the east.
      for (const h of [0.2, 0.85]) ball(up, at(-0.03, h), 0.025, PG.GREEN, 6, 3);
      if (!side) bar(up, at(W - 0.02, 0.72), at(W + 0.06, 0.72), 0.02, 0.05, PG.GALV);
      else bar(up, at(W - 0.01, 0.30), at(W + 0.02, 0.30), 0.03, 0.03, PG.GALV);
      // Its collider, turned to lie along it.
      const mt = ht + dir[0] * (W / 2 + 0.05), ms = hs + dir[1] * (W / 2 + 0.05);
      runs.push({ t: mt, s: ms, a: W / 2, c: 0.02, h: 1.0, y, rot: Math.atan2(dir[1], dir[0]) });
    }
    // Colliders: the four runs, the gateway left open.
    const y = bY(T0, S0), h = H;
    block(T0 - 0.04, Fc.gate[0] + 0.02, S0 - 0.04, S0 + 0.04, y, h);
    block(Fc.gate[1] - 0.02, T1 + 0.04, S0 - 0.04, S0 + 0.04, y, h);
    block(T0 - 0.04, T1 + 0.04, S1 - 0.04, S1 + 0.04, y, h);
    block(T0 - 0.04, T0 + 0.04, S0, S1, y, h);
    block(T1 - 0.04, T1 + 0.04, S0, S1, y, h);
  }

  // ── the information board ──────────────────────────────────────────────────
  //
  // Green, on two posts, beside the gate and outside it, facing the way you
  // arrive. What is on it is not legible in any frame, so it is a heading
  // band, a pictogram row and lines of text as blocks of tone — the board's
  // rhythm and not a claim about its words.
  function buildBoard() {
    const t = PG.fence.gate[1] + 1.15, s = PG.fence.s0 - 0.28;
    const fr = frame(t, s, 0);
    const y = padY(t, s);
    for (const u of [-0.52, 0.52]) {
      pipe(up, [fr.F(u, 0, y - 0.2), fr.F(u, 0, y + 1.78)], 0.032, PG.GREEN, 8);
      disc(up, fr.F(u, 0, y + 1.781), [0, 1, 0], 0.036, PG.GREEN, 8);
    }
    const Y0 = y + 0.92, Y1 = y + 1.66;
    const n = fr.N.map((x) => -x);   // faces seaward, −s
    const v0 = -0.035;
    const face = (u0, u1, h0, h1, col, dv = 0) => {
      up.quad(fr.F(u0, v0 - dv, h0), fr.F(u1, v0 - dv, h0), fr.F(u1, v0 - dv, h1),
        fr.F(u0, v0 - dv, h1), col);
    };
    // The panel and its frame.
    boxO(up, fr.F(0, 0, (Y0 + Y1) / 2), fr.U, [0, 1, 0], fr.V, 0.56, (Y1 - Y0) / 2 + 0.03,
      0.03, PG.GREEN);
    face(-0.50, 0.50, Y0 + 0.03, Y1 - 0.03, [0.80, 0.82, 0.78], 0.002);
    face(-0.50, 0.50, Y1 - 0.13, Y1 - 0.03, [0.06, 0.30, 0.15], 0.003);
    // Pictograms: five discs of colour in a row.
    const pic = [[0.62, 0.12, 0.08], [0.08, 0.22, 0.55], [0.10, 0.40, 0.18],
      [0.75, 0.55, 0.08], [0.62, 0.12, 0.08]];
    pic.forEach((c, i) => {
      const u = -0.40 + i * 0.2;
      disc(up, fr.F(u, v0 - 0.004, Y1 - 0.22), n, 0.05, c, 14);
    });
    // Text, as lines of tone.
    for (let k = 0; k < 8; k++) {
      const h = Y1 - 0.33 - k * 0.05;
      const len = 0.62 + 0.3 * jit(k, 420);
      face(-0.46, -0.46 + len, h - 0.012, h + 0.012, [0.30, 0.32, 0.30], 0.003);
    }
    block(t - 0.6, t + 0.6, s - 0.06, s + 0.06, y, 1.8);
  }

  // ── the tower and the slide ────────────────────────────────────────────────
  //
  // Four red square posts, a deck at 1.25 m, a yellow panel either side with
  // a porthole in it, an eight-panel roof in red and yellow — the round top
  // the aerial has at 0:46 — the ladder up the west face and the slide off
  // the east one, curving down toward the sea side and the trampoline.
  let tower = null;
  function buildTower() {
    const t = 521.6, s = 45.6;
    const fr = frame(t, s, 0);
    const y = bY(t, s);
    const R = 0.6, DECK = 1.25, TOP = 2.42;
    for (const [u, v] of [[-R, -R], [R, -R], [R, R], [-R, R]]) {
      boxO(up, fr.F(u, v, y + (TOP - 0.15) / 2), fr.U, [0, 1, 0], fr.V, 0.045,
        (TOP + 0.15) / 2, 0.045, PG.RED, shade(PG.RED, 1.1));
      disc(up, fr.F(u, v, y + TOP + 0.001), [0, 1, 0], 0.05, shade(PG.RED, 0.7), 4);
    }
    // The deck: a perforated grey plate in a red frame.
    boxO(up, fr.F(0, 0, y + DECK), fr.U, [0, 1, 0], fr.V, R + 0.04, 0.03, R + 0.04,
      PG.RED, [0.30, 0.32, 0.33]);
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        disc(up, fr.F(i * 0.12, j * 0.12, y + DECK + 0.031), [0, 1, 0], 0.018,
          [0.12, 0.13, 0.14], 6);
      }
    }
    // The two side panels, s− and s+, from the deck to 2.0, with a porthole.
    for (const v of [-R, R]) {
      const sg = Math.sign(v);
      const c = fr.F(0, v, y + DECK + 0.42);
      boxO(up, c, fr.U, [0, 1, 0], fr.V, R - 0.05, 0.36, 0.012, PG.YELLOW);
      disc(up, add(c, fr.N, 0.0135), fr.N, 0.17, [0.08, 0.20, 0.45], 18);
      disc(up, add(c, fr.N, -0.0135), fr.N.map((x) => -x), 0.17, [0.08, 0.20, 0.45], 18);
      // And a top rail over it.
      bar(up, fr.F(-R, v, y + DECK + 0.80), fr.F(R, v, y + DECK + 0.80), 0.05, 0.05, PG.RED);
    }
    // The roof: eight panels to a point, alternating red and yellow, and a
    // ball on top.
    {
      const ry = y + TOP, rh = 0.62, rr = 0.98;
      const apex = fr.F(0, 0, ry + rh);
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * TAU + Math.PI / 8, a1 = ((k + 1) / 8) * TAU + Math.PI / 8;
        const p0 = fr.F(Math.cos(a0) * rr, Math.sin(a0) * rr, ry);
        const p1 = fr.F(Math.cos(a1) * rr, Math.sin(a1) * rr, ry);
        const col = k % 2 ? PG.YELLOW : PG.RED;
        up.tri(p0, apex, p1, col);
        // A rolled edge under each panel, so it has a thickness.
        up.quad(p0, p1, add(p1, [0, -0.04, 0]), add(p0, [0, -0.04, 0]), shade(col, 0.8));
        up.tri(add(p0, [0, -0.04, 0]), add(p1, [0, -0.04, 0]), fr.F(0, 0, ry + 0.08), shade(col, 0.55));
      }
      ball(up, add(apex, [0, 0.05, 0]), 0.07, PG.RED, 10, 6);
    }
    // The ladder: two red rails leaning on the west face, five grey rungs.
    {
      const foot = -R - 0.78;
      const rails = [-0.26, 0.26];
      for (const v of rails) {
        pipe(up, [fr.F(foot, v, y - 0.1), fr.F(-R, v, y + DECK + 0.02),
          fr.F(-R + 0.02, v, y + DECK + 0.78)], 0.03, PG.RED, 10);
      }
      for (let k = 1; k <= 4; k++) {
        const f = k / 5;
        const u = foot + (-R - foot) * f, h = (DECK + 0.1) * f;
        boxO(up, fr.F(u, 0, y + h), fr.U, [0, 1, 0], fr.V, 0.06, 0.018, 0.26,
          [0.30, 0.31, 0.32]);
      }
    }
    // The slide. A U-channel lofted along a curve that leaves the deck going
    // east, bends toward the sea and runs out flat: inner trough radius 0.22,
    // walls to 0.30, a rolled lip, 2 cm of plastic.
    {
      const path = [
        fr.F(R + 0.02, -0.15, y + DECK + 0.02),
        fr.F(R + 0.55, -0.20, y + DECK - 0.20),
        fr.F(R + 1.35, -0.55, y + 0.82),
        fr.F(R + 2.00, -1.20, y + 0.45),
        fr.F(R + 2.35, -1.75, y + 0.30),
        fr.F(R + 2.55, -2.15, y + 0.28),
      ];
      const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)),
        false, 'centripetal');
      // For her (1.562.0): the slide's line, the trough's bottom 5 cm under
      // it (the section's `h - 0.05`), the deck and the ladder.
      tower = { t, s, y, R, DECK, curve, fr, trough: 0.05,
        ladder: { foot: -R - 0.78, top: -R, rails: [-0.26, 0.26], rungs: [1, 2, 3, 4].map((k) => k / 5),
          rise: DECK + 0.1 } };
      const NS = 40;
      // The section, (across, up) from the trough's bottom: inner surface
      // left lip to right lip, then the outer back.
      const sec = [];
      const RI = 0.20, WALL = 0.23, TH = 0.018;
      sec.push([-RI - 0.04, WALL + 0.02]);
      sec.push([-RI, WALL]);
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI + (k / 10) * Math.PI;
        sec.push([Math.cos(a) * RI, RI + Math.sin(a) * RI]);
      }
      sec.push([RI, WALL]);
      sec.push([RI + 0.04, WALL + 0.02]);
      sec.push([RI + TH + 0.02, WALL - 0.02]);
      for (let k = 10; k >= 0; k--) {
        const a = Math.PI + (k / 10) * Math.PI;
        sec.push([Math.cos(a) * (RI + TH), RI + Math.sin(a) * (RI + TH)]);
      }
      sec.push([-RI - TH - 0.02, WALL - 0.02]);
      const rings = [];
      for (let i = 0; i <= NS; i++) {
        const u = i / NS;
        const c = curve.getPointAt(u), T = curve.getTangentAt(u);
        const Tv = [T.x, T.y, T.z];
        const side = nrm(crs(Tv, [0, 1, 0]));
        const upv = crs(side, Tv);
        rings.push(sec.map(([a, h]) => add(add([c.x, c.y, c.z], side, a), upv, h - 0.05)));
      }
      const m = sec.length;
      for (let i = 0; i < NS; i++) {
        for (let k = 0; k < m; k++) {
          const k2 = (k + 1) % m;
          const inner = k >= 1 && k < 14;
          const col = inner ? shade(PG.RED, 1.12) : PG.RED;
          up.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2], col);
        }
      }
      // The run-out is left open, as a moulded slide's is: the material is
      // double-sided and the 2 cm of wall reads as its edge.
      // Its leg at the run-out, and the two hoops over the start.
      const e = path[4];
      pipe(up, [add(e, [0, -0.08, 0]), [e[0], bY(t + R + 2.35, s - 1.75) - 0.1, e[2]]],
        0.03, PG.RED, 8);
      for (const v of [-0.45, 0.15]) {
        pipe(up, quadBez(fr.F(R - 0.02, v, y + DECK + 0.02), fr.F(R - 0.02, v, y + DECK + 0.62),
          fr.F(R + 0.28, v, y + DECK + 0.70), 10), 0.022, PG.YELLOW, 8);
      }
      WEAR.push([t + R + 2.7, s - 2.35, 0.8, 0.6, 0.55]);
      block(t + R, t + R + 1.6, s - 0.6, s + 0.1, y, 0.9);
    }
    WEAR.push([t - R - 1.0, s, 0.7, 0.6, 0.4]);
    block(t - R - 0.05, t + R + 0.05, s - R - 0.05, s + R + 0.05, y, TOP + 0.6);
  }

  // ── the swing frame ────────────────────────────────────────────────────────
  //
  // Three A-frames in 89 mm tube on one beam, two bays: the west bay a nest
  // swing (a 1 m ring on four chains to two swivels), the east two flat
  // seats. The west two frames grey-blue, the east one red, as at 0:46.
  function buildSwings() {
    const s = 48.0, H = 2.45, SPLAY = 1.15;
    const T = [524.4, 527.6, 530.8];
    const yb = (t) => bY(t, s);
    T.forEach((t, i) => {
      const col = i === 2 ? PG.RED : PG.GREYBLUE;
      const top = P(t, s, yb(t) + H - 0.02);
      for (const sg of [-1, 1]) {
        const foot = P(t, s + sg * SPLAY, bY(t, s + sg * SPLAY) - 0.15);
        pipe(up, [foot, top], 0.0445, col, 12);
        // A foot plate where it goes into the rubber.
        disc(up, P(t, s + sg * SPLAY * 0.97, bY(t, s + sg * SPLAY * 0.97) + 0.004),
          [0, 1, 0], 0.08, shade(col, 0.6), 10);
      }
      // The apex bracket.
      ball(up, P(t, s, yb(t) + H), 0.075, col, 10, 6, 0.8);
      block(t - 0.12, t + 0.12, s - SPLAY - 0.1, s + SPLAY + 0.1, yb(t), H);
    });
    pipe(up, [P(T[0] - 0.15, s, yb(T[0]) + H + 0.02), P(T[2] + 0.15, s, yb(T[2]) + H + 0.02)],
      0.05, PG.GREYBLUE, 12);
    // Hinge axis: along t, at the beam's underside.
    const axis = nrm(sub(P(T[2], s, 0), P(T[0], s, 0)));
    // The nest, in the west bay: a ring on four chains from two swivels
    // 0.9 m apart on the beam. It swings, and with the chains splayed fore
    // and aft it turns a little on them and comes back.
    {
      const t = (T[0] + T[1]) / 2;
      const hinge = P(t, s, yb(t) + H - 0.03);
      const L = H - 0.03 - 0.58;
      const RR = 0.50;
      const body = [hinge[0], hinge[1] - L, hinge[2]];
      const p = rigid('nest', body, axis, (B0) => {
        const B = lift(B0, L);
        // The ring: a padded rope torus.
        const ring = [];
        for (let k = 0; k <= 32; k++) {
          const a = (k / 32) * TAU;
          ring.push([Math.cos(a) * RR, -L, Math.sin(a) * RR]);
        }
        pipe(B, ring, 0.04, [0.12, 0.12, 0.13], 10, false);
        // The web: rope rings and spokes.
        for (const r of [0.16, 0.33]) {
          const rr = [];
          for (let k = 0; k <= 24; k++) {
            const a = (k / 24) * TAU;
            rr.push([Math.cos(a) * r, -L - 0.03 * (1 - r / RR), Math.sin(a) * r]);
          }
          pipe(B, rr, 0.011, [0.20, 0.20, 0.22], 6, false);
        }
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU;
          pipe(B, [[0, -L - 0.035, 0], [Math.cos(a) * RR, -L, Math.sin(a) * RR]], 0.011,
            [0.20, 0.20, 0.22], 6, false);
        }
      }, { L, r: 0.7 });
      const F = inFrame(hinge, axis);
      // The swivels stay on the beam.
      for (const x of [-0.45, 0.45]) pipe(up, [F(x, 0.03, 0), F(x, -0.12, 0)], 0.014, PG.GALV, 6);
      const ch = [];
      for (const x of [-0.45, 0.45]) {
        for (const z of [-1, 1]) ch.push({ a: x < 0 ? 0 : 1, at: [x * 0.62, 0.02, z * RR * 0.80] });
      }
      // 12 kg: the ring, its padding and the web. A disc's moments.
      p.sim = pgHang({
        anchors: [F(-0.45, -0.12, 0), F(0.45, -0.12, 0)], links: 2,
        body: { m: 12, I: [0.75, 1.5, 0.75], p: body, q: quatOf(axis) },
        chains: ch,
        caps: [[-RR, 0, 0, RR, 0, 0, 0.06], [0, 0, -RR, 0, 0, RR, 0.06]], c: body, reach: 1.0,
      });
      p.c = body; p.H = hinge;
      // For her (1.562.0): the web's middle, the ring, and the four chains'
      // feet on it and heads on the swivels, in the body's frame.
      p.RR = RR; p.seatY = -0.035;
      p.chainFeet = ch.map((c) => c.at.slice());
      p.chainHeads = ch.map((c) => [c.a ? 0.45 : -0.45, L - 0.12, 0]);
      for (let k = 0; k < 4; k++) chainList.push({ sim: p.sim, k, col: PG.GALV });
      WEAR.push([t, s - 1.6, 1.2, 0.7, 0.6]);
      WEAR.push([t, s + 1.6, 1.2, 0.7, 0.6]);
    }
    // Two flat seats, in the east bay.
    for (const t of [T[1] + 1.0, T[2] - 1.0]) {
      const hinge = P(t, s, yb(t) + H - 0.03);
      swingSeat('seat', hinge, axis, H - 0.03 - 0.46, 0.44, PG.GALV);
      WEAR.push([t, s - 1.0, 0.45, 0.55, 0.75]);
      WEAR.push([t, s + 1.0, 0.45, 0.55, 0.75]);
    }
  }

  // ── the teeter-totter ──────────────────────────────────────────────────────
  //
  // A 3.6 m beam on a fulcrum 0.55 high, a seat and a T-handle at each end,
  // and a half-buried tyre under each seat for it to land on. At rest one
  // end is down, which is how a seesaw is always found.
  function buildSeesaw() {
    const t = 520.0, s = 49.9, HP = 0.58, HL = 2.0;
    const y = bY(t, s);
    const fr = frame(t, s, 0);
    // The fulcrum: two plates shaped like an A, and the axle.
    for (const v of [-0.13, 0.13]) {
      const a = fr.F(-0.32, v, y - 0.05), c = fr.F(0.32, v, y - 0.05), d = fr.F(0, v, y + HP + 0.03);
      const off = fr.V.map((x) => x * 0.006);
      up.tri(add(a, off), add(c, off), add(d, off), PG.GREYBLUE);
      up.tri(sub(a, off), sub(d, off), sub(c, off), PG.GREYBLUE);
      bar(up, a, d, 0.012, 0.06, PG.GREYBLUE, fr.V);
      bar(up, c, d, 0.012, 0.06, PG.GREYBLUE, fr.V);
    }
    tube(up, fr.F(0, -0.17, y + HP), fr.F(0, 0.17, y + HP), 0.03, PG.GALV, 10);
    // The tyres.
    for (const u of [-HL + 0.15, HL - 0.15]) {
      const c = fr.F(u, 0, bY(fr.TS(u, 0)[0], fr.TS(u, 0)[1]) - 0.05);
      const tor = [];
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * TAU;
        tor.push(add(add(c, fr.U, Math.cos(a) * 0.22), [0, 1, 0], Math.sin(a) * 0.22));
      }
      pipe(up, tor, 0.075, [0.05, 0.05, 0.055], 10, false);
    }
    // The beam, which moves: hinge axis across it (v), so it tilts along u.
    // An AVBD body on the axle (`pgSeesaw`), its centre of mass 16 cm over
    // it — the beam sits on top of the axle and the seats and handles stand
    // higher still — so it always comes to rest on one end, on that end's
    // tyre, which gives like rubber and bumps it back up a hand's breadth.
    const hinge = fr.F(0, 0, y + HP);
    // Resting with the bumper on the tyre's crown: 0.22 m over the rubber.
    const rest = Math.asin((HP - 0.05 - 0.22) / (HL - 0.22));
    const COM = 0.16;
    const X = fr.V, Z = crs(X, [0, 1, 0]);
    const body = [hinge[0], hinge[1] + COM, hinge[2]];
    const p = rigid('seesaw', body, X, (B0) => {
      const B = lift(B0, -COM);
      // Local: x = V (axis), y up, z = V × up = −U. The beam runs along z.
      boxO(B, [0, 0.06, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.07, 0.06, HL, PG.YELLOW,
        shade(PG.YELLOW, 1.1));
      boxO(B, [0, 0.0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.09, 0.05, 0.12, PG.GREYBLUE);
      for (const sg of [-1, 1]) {
        const z = sg * (HL - 0.22);
        // The seat: a moulded red saddle.
        boxO(B, [0, 0.14, z], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.17, 0.035, 0.16, PG.RED,
          shade(PG.RED, 1.12));
        boxO(B, [0, 0.20, z + sg * 0.15], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.17, 0.07, 0.025,
          PG.RED);
        // The handle in front of it.
        const zh = z - sg * 0.32;
        pipe(B, [[0, 0.10, zh], [0, 0.42, zh]], 0.02, PG.NAVY, 8);
        pipe(B, [[-0.17, 0.42, zh], [0.17, 0.42, zh]], 0.018, PG.NAVY, 8);
        for (const x of [-0.17, 0.17]) ball(B, [x, 0.42, zh], 0.026, [0.10, 0.10, 0.11], 8, 4);
        // A rubber bumper under the end.
        boxO(B, [0, -0.02, z], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.05, 0.03, 0.06, PG.RUBBER);
      }
    }, { HL, rest, r: 0.6 });
    // 25 kg of steel beam, seats and handles; its moments about the CoM, the
    // seats a metre and three quarters out each side.
    p.sim = pgSeesaw({ hinge, X, Z, HL, mass: 25, com: COM, I: [52, 52, 0.4], rest,
      start: -rest * 0.98 });
    p.c = body; p.H = hinge; p.COM = COM;
    WEAR.push([t - HL + 0.15, s, 0.5, 0.45, 0.6]);
    WEAR.push([t + HL - 0.15, s, 0.5, 0.45, 0.6]);
    block(t - HL - 0.05, t + HL + 0.05, s - 0.24, s + 0.24, y, 0.9);
  }

  // ── the trampolines ────────────────────────────────────────────────────────
  //
  // In-ground and round, the bed flush with the rubber and a red padded rim
  // round it a few centimetres proud. The bed is a dent profile with its
  // depth in `scale.y` — see `tick`.
  function buildTramp(t, s) {
    const y = bY(t, s);
    const c = P(t, s, y);
    const RO = 0.80, RI = 0.64, RB = 0.60, N = 36;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * TAU, a1 = ((k + 1) / N) * TAU;
      const pt = (a, r, h) => add(P(t + Math.cos(a) * r, s + Math.sin(a) * r, 0), [0, y + h, 0]);
      // The rim: rolled over in a half round.
      let prev = null;
      for (let j = 0; j <= 6; j++) {
        const ph = (j / 6) * Math.PI;
        const r = (RO + RI) / 2 + Math.cos(ph) * (RO - RI) / 2, h = 0.035 * Math.sin(ph) + 0.002;
        const q = [pt(a0, r, h), pt(a1, r, h)];
        const col = shade(PG.RED, 0.92 + 0.12 * Math.sin(ph));
        if (prev) up.quad(prev[0], prev[1], q[1], q[0], col);
        prev = q;
      }
      // The gap between rim and bed: dark, going down to the bed.
      up.quad(pt(a0, RI, 0.003), pt(a1, RI, 0.003), pt(a1, RB, -0.012), pt(a0, RB, -0.012),
        [0.02, 0.02, 0.025]);
    }
    // The bed's rest is 1.2 cm under the rubber's top. Under it is a pit
    // (1.558.0): the gravel pad has a hole in it (`GROUNDS.play.holes` in
    // 43-jadrija.js), the rubber has one (`buildRubber`), and so does the
    // hillside's own mesh (`terrainHole`, 10-world.js) — the bed goes 0.3 m
    // down under somebody landing on it, and the hill is 7 cm under the
    // rubber here.
    const hinge = add(c, [0, -0.012, 0]);
    // Laid through the shore frame like its rim and not as a circle in the
    // world: this far inland a metre of `t` is 1.15 m of ground, so a round
    // bed sat in an oval rim with the pit showing past both its sides.
    const p = rigid('tramp', hinge, [1, 0, 0], (B) => {
      // The bed: rings from rim to centre, y = −(1 − (r/R)²), a unit dent.
      const R = 10, A = N;     // the rim's own segments, so the edges meet
      const pt = (r, a) => {
        const w = P(t + Math.cos(a) * r, s + Math.sin(a) * r, 0);
        return [w[0] - hinge[0], -(1 - (r / RB) * (r / RB)), w[2] - hinge[2]];
      };
      for (let i = 0; i < R; i++) {
        const r0 = RB * (1 - i / R), r1 = RB * (1 - (i + 1) / R);
        for (let k = 0; k < A; k++) {
          const a0 = (k / A) * TAU, a1 = ((k + 1) / A) * TAU;
          const col = (k + i) % 2 ? [0.035, 0.035, 0.040] : [0.045, 0.045, 0.050];
          // Lit level: the dent lives in scale.y, and the material turns a
          // normal by the model matrix without the inverse transpose, so a
          // sloped normal squashed by 0.003 lay down and caught the sun.
          ground3(B, pt(r0, a0), pt(r1, a0), pt(r1, a1), col, col, col);
          ground3(B, pt(r0, a0), pt(r1, a1), pt(r0, a1), col, col, col);
        }
      }
    }, { r: 0.65, top: hinge[1], rim: y + 0.035 });
    // The hillside's hole: round, so as wide as the bed is long, and still
    // under the rim across it.
    const ut = Math.hypot(...sub(P(t + 1, s, 0), P(t, s, 0)));
    const us = Math.hypot(...sub(P(t, s + 1, 0), P(t, s, 0)));
    terrainHole(c[0], c[2], Math.min(0.66 * Math.max(ut, us), 0.78 * Math.min(ut, us)));
    // The bed itself: `pgBed`, centred on its rest surface.
    p.sim = pgBed({ c: hinge, g: GROUND.hopG });
    p.c = hinge; p.H = hinge;
    WEAR.push([t, s, 1.15, 1.15, 0.35]);
  }

  // ── the spring rider ───────────────────────────────────────────────────────
  //
  // A red horse on a coil: the body lofted round a curve with its radius
  // written against arc length, a head and neck, two grey handles and two
  // footrests. It rocks on the spring's foot.
  function buildRider() {
    const t = 523.0, s = 50.6;
    const y = bY(t, s);
    const fr = frame(t, s, 0);
    // The base plate, flush, and the spring.
    disc(up, fr.F(0, 0, y + 0.004), [0, 1, 0], 0.22, PG.GALV, 18);
    // The rider and its spring are an AVBD body on a ball joint at the
    // spring's foot (`pgRider`), held upright by the coil's bending
    // stiffness and rocking about it: the coil turns with the horse, which
    // from any distance is what a bending spring looks like.
    const hinge = fr.F(0, 0, y + 0.02);
    const COM = 0.62;
    const X = fr.V, Z = crs(X, [0, 1, 0]);
    const body = [hinge[0], hinge[1] + COM, hinge[2]];
    const p = rigid('rider', body, X, (B0) => {
      const B = lift(B0, -COM);
      {
        const pts = [];
        const turns = 6, rr = 0.10, h = 0.38;
        for (let i = 0; i <= turns * 16; i++) {
          const a = (i / 16) * TAU;
          pts.push([Math.cos(a) * rr, (h * i) / (turns * 16), Math.sin(a) * rr]);
        }
        pipe(B, pts, 0.016, [0.10, 0.36, 0.18], 6, false);
      }
      // Local: x across, y up, z along the body (z = V × up = −U).
      const body = new THREE.CatmullRomCurve3([[0, 0.60, 0.42], [0, 0.66, 0.15],
        [0, 0.64, -0.15], [0, 0.60, -0.40]].map((q) => new THREE.Vector3(...q)));
      const prof = [[0, 0.0], [0.08, 0.11], [0.25, 0.15], [0.55, 0.15], [0.82, 0.12],
        [0.95, 0.07], [1.0, 0.0]];
      const rad = (u) => {
        for (let i = 0; i < prof.length - 1; i++) {
          const [u0, r0] = prof[i], [u1, r1] = prof[i + 1];
          if (u <= u1) {
            const f = (u - u0) / (u1 - u0);
            return r0 + (r1 - r0) * (f * f * (3 - 2 * f));
          }
        }
        return 0;
      };
      loft(B, body, rad, 16, 24, PG.RED);
      // Neck and head, rising forward.
      const neck = new THREE.CatmullRomCurve3([[0, 0.66, -0.25], [0, 0.78, -0.40],
        [0, 0.88, -0.50], [0, 0.90, -0.64]].map((q) => new THREE.Vector3(...q)));
      loft(B, neck, (u) => (u < 0.85 ? 0.085 - 0.02 * u : 0.068 * Math.sqrt(Math.max(0, (1 - u) / 0.15))),
        12, 14, PG.RED);
      // Ears, eyes, a yellow mane.
      for (const x of [-0.035, 0.035]) {
        pipe(B, [[x, 0.95, -0.55], [x * 1.4, 1.03, -0.53]], (i) => (i ? 0.004 : 0.016), PG.RED, 6);
        ball(B, [x * 1.9, 0.92, -0.60], 0.014, [0.02, 0.02, 0.02], 6, 4);
      }
      for (let k = 0; k < 5; k++) {
        const f = k / 4;
        ball(B, [0, 0.77 + f * 0.13, -0.30 - f * 0.24], 0.035, PG.YELLOW, 6, 4);
      }
      // Handles through the neck, footrests through the body.
      pipe(B, [[-0.14, 0.80, -0.36], [0.14, 0.80, -0.36]], 0.016, [0.30, 0.31, 0.32], 8);
      pipe(B, [[-0.20, 0.42, -0.02], [0.20, 0.42, -0.02]], 0.016, [0.30, 0.31, 0.32], 8);
      // The seat, a darker saddle.
      boxO(B, [0, 0.79, 0.06], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.11, 0.02, 0.15,
        shade(PG.RED, 0.6));
      // And the plate the spring bolts to.
      disc(B, [0, 0.40, 0], [0, -1, 0], 0.09, PG.GALV, 12);
      pipe(B, [[0, 0.40, 0], [0, 0.50, 0]], 0.05, PG.GALV, 10);
    }, { r: 0.5 });
    // 12 kg of moulded horse; 400 N·m/rad of coil, which rocks it at a
    // little over a hertz and puts it back upright in four seconds.
    p.sim = pgRider({ foot: hinge, X, Z, mass: 12, com: COM, I: [0.81, 0.75, 0.18], k: 400 });
    p.c = body; p.H = hinge; p.COM = COM;
    WEAR.push([t, s, 0.8, 0.7, 0.4]);
    block(t - 0.45, t + 0.45, s - 0.25, s + 0.25, y, 1.0);
    return p;
  }

  /**
   * A body with a varying radius along a curve: rings at arc-length steps,
   * normals leaning by dr/ds, the radius 0 at both ends so they close. See
   * the memory note on lofting.
   */
  function loft(B, curve, rad, sides, rings, col) {
    const Lc = curve.getLength();
    const R = [], N = [];
    let e1 = null;
    for (let i = 0; i <= rings; i++) {
      const u = i / rings;
      const c = curve.getPointAt(u), Tg = curve.getTangentAt(u);
      const T = [Tg.x, Tg.y, Tg.z];
      if (!e1) e1 = perp(T)[0];
      e1 = nrm(sub(e1, T.map((x) => x * dot(e1, T))));
      const e2 = crs(T, e1);
      const r = rad(u);
      const du = 0.5 / rings;
      const dr = (rad(Math.min(1, u + du)) - rad(Math.max(0, u - du))) / (Lc * 2 * du);
      const ring = [], nr = [];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * TAU;
        const d = add(e1.map((x) => x * Math.cos(a)), e2, Math.sin(a));
        ring.push(add([c.x, c.y, c.z], d, r));
        nr.push(nrm(sub(d, T.map((x) => x * dr))));
      }
      R.push(ring); N.push(nr);
    }
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < sides; k++) {
        B.smooth(R[i][k], R[i + 1][k], R[i + 1][k + 1], N[i][k], N[i + 1][k], N[i + 1][k + 1],
          col, col, col);
        B.smooth(R[i][k], R[i + 1][k + 1], R[i][k + 1], N[i][k], N[i + 1][k + 1], N[i][k + 1],
          col, col, col);
      }
    }
  }

  // ── the climbing frame ─────────────────────────────────────────────────────
  //
  // Black powder-coated tube, a 1.4 m cube a little over 2 m tall with rungs
  // on all four faces and three bars across the top. 0:46 shows it at the
  // east end against the inland fence, darker than anything else on the pad.
  function buildClimber() {
    const t = 531.25, s = 50.6, HW = 0.70, H = 2.1;
    const y = bY(t, s);
    const fr = frame(t, s, 0);
    const C = [[-HW, -HW], [HW, -HW], [HW, HW], [-HW, HW]];
    for (const [u, v] of C) {
      pipe(up, [fr.F(u, v, y - 0.15), fr.F(u, v, y + H)], 0.038, PG.BLACK, 10);
      ball(up, fr.F(u, v, y + H), 0.042, PG.BLACK, 8, 4);
    }
    for (let k = 0; k < 4; k++) {
      const [u0, v0] = C[k], [u1, v1] = C[(k + 1) % 4];
      for (let h = 0.32; h < H + 0.01; h += 0.30) {
        pipe(up, [fr.F(u0, v0, y + h), fr.F(u1, v1, y + h)], h > H - 0.1 ? 0.03 : 0.019,
          PG.BLACK, 8);
      }
    }
    for (const v of [-0.35, 0, 0.35]) {
      pipe(up, [fr.F(-HW, v, y + H - 0.12), fr.F(HW, v, y + H - 0.12)], 0.019, PG.BLACK, 8);
    }
    WEAR.push([t, s - 1.1, 0.9, 0.5, 0.4]);
    block(t - HW - 0.05, t + HW + 0.05, s - HW - 0.05, s + HW + 0.05, y, H);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A — THE OLD OPEN ONE, ON THE ALLEY'S GRAVEL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * The welder's frame: a top bar on a splayed Λ at each end (or the ladder
   * as one end), a vertical ladder, and a gooseneck rising out of one end and
   * curling over with a ring at its tip, braced back to the bar. `1000150349`
   * (orange) and the pan at 0:43 (yellow) are the same pattern from the same
   * shop. `u` runs along the bar; the gooseneck is at the −u end.
   */
  function welderFrame(fr, y, o) {
    const { len, H, col, ladderAt, ladderEnd, gooseOut, gooseUp } = o;
    const r = 0.030;
    const uA = -len / 2, uB = len / 2;
    const top = (u) => fr.F(u, 0, y + H);
    // The bar.
    pipe(up, [fr.F(uA - 0.04, 0, y + H), fr.F(uB + 0.04, 0, y + H)], r, col, 10);
    // The gooseneck end: a vertical post and a leg splayed out along the bar,
    // with a stay between them at 0.9 m.
    const legOut = 0.62;
    pipe(up, [fr.F(uA, 0, y - 0.15), top(uA)], r, col, 10);
    pipe(up, [fr.F(uA - legOut, 0, y - 0.15), fr.F(uA - 0.06, 0, y + H - 0.12)], r, col, 10);
    pipe(up, [fr.F(uA - legOut * 0.62, 0, y + 0.88), fr.F(uA, 0, y + 0.88)], r * 0.85, col, 8);
    // The far end: a ladder, or a Λ.
    if (ladderEnd) {
      for (const v of [-0.20, 0.20]) pipe(up, [fr.F(uB, v, y - 0.15), fr.F(uB, v, y + H)], r * 0.9, col, 10);
      pipe(up, [fr.F(uB, -0.20, y + H), fr.F(uB, 0.20, y + H)], r * 0.9, col, 8);
      for (let h = 0.28; h < H - 0.1; h += 0.28) {
        pipe(up, [fr.F(uB, -0.20, y + h), fr.F(uB, 0.20, y + h)], 0.016, col, 8);
      }
    } else {
      for (const sg of [-1, 1]) {
        pipe(up, [fr.F(uB + sg * 0.48, 0, y - 0.15), fr.F(uB + sg * 0.03, 0, y + H - 0.04)],
          r, col, 10);
      }
      pipe(up, [fr.F(uB - 0.30, 0, y + 0.88), fr.F(uB + 0.30, 0, y + 0.88)], r * 0.85, col, 8);
    }
    // The ladder in the middle, rungs across the bar.
    if (ladderAt != null) {
      for (const du of [-0.21, 0.21]) {
        pipe(up, [fr.F(ladderAt + du, 0, y - 0.15), fr.F(ladderAt + du, 0, y + H)], r * 0.9, col, 10);
      }
      for (let h = 0.30; h < H - 0.1; h += 0.30) {
        pipe(up, [fr.F(ladderAt - 0.21, 0, y + h), fr.F(ladderAt + 0.21, 0, y + h)], 0.016, col, 8);
      }
    }
    // The gooseneck: up out of the post, over in one bend, a ring at the tip.
    // A cubic: leaves the post vertical, turns over in one long bend and
    // comes in level at the tip, which is the shape in `_349`.
    const g0 = top(uA), g1 = fr.F(uA, 0, y + H + gooseUp * 0.45);
    const c1 = fr.F(uA, 0, y + H + gooseUp + 0.22);
    const c2 = fr.F(uA - gooseOut * 0.50, 0, y + H + gooseUp + 0.22);
    const tip = fr.F(uA - gooseOut, 0, y + H + gooseUp - 0.02);
    const neck = [g0];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18, w0 = (1 - u) ** 3, w1 = 3 * u * (1 - u) ** 2, w2 = 3 * u * u * (1 - u), w3 = u ** 3;
      neck.push([0, 1, 2].map((k) => g1[k] * w0 + c1[k] * w1 + c2[k] * w2 + tip[k] * w3));
    }
    pipe(up, neck, r, col, 10);
    // The stay from the bar up to it.
    pipe(up, [fr.F(uA + 0.95, 0, y + H), fr.F(uA - 0.10, 0, y + H + gooseUp + 0.12)], 0.017, col, 8);
    // The ring.
    const ring = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * TAU;
      ring.push(add(add(tip, fr.U, -0.05 - Math.cos(a) * 0.05), [0, 1, 0], Math.sin(a) * 0.05 - 0.04));
    }
    pipe(up, ring, 0.008, PG.GALV, 6, false);
    return { tip: add(tip, [0, -0.09, 0]) };
  }

  function buildShore() {
    const SH = GR.shore;
    const wy = (t, s) => walkAt(t, s);

    // The orange one: a 4.2 m bar along t, Λ at the east end, the gooseneck
    // west, the ladder between the two seats.
    {
      const t = 378.9, s = 25.6, len = 4.2, H = 2.40;
      const fr = frame(t, s, Math.PI);           // u runs −t, so −u (goose) is +t... see below
      const y = wy(t, s);
      // In `_349` the gooseneck is on the far end from the ladder's short
      // bay. Here it points east, toward the navy swing and the mural.
      welderFrame(fr, y, { len, H, col: PG.ORANGE, ladderAt: 0.45, ladderEnd: false,
        gooseOut: 1.25, gooseUp: 1.10 });
      const axis = fr.U;
      for (const u of [-0.93, 1.38]) {
        const [tt, ss] = fr.TS(u, 0);
        const hinge = P(tt, ss, y + H - 0.03);
        swingSeat('seatA', hinge, axis, H - 0.03 - 0.45, 0.42, [0.50, 0.46, 0.38]);
      }
      // Colliders on what stands on the ground — the gooseneck's post and
      // leg, the ladder, the Λ — and not one box the length of the bar
      // (1.558.0): under the bar is where the seats hang, and walking up to
      // one to push it, or into it, is what a swing is for.
      const tb = (u0, u1) => {
        const [ta] = fr.TS(u0, 0), [tc] = fr.TS(u1, 0);
        block(Math.min(ta, tc), Math.max(ta, tc), s - 0.12, s + 0.12, y, H);
      };
      tb(-len / 2 - 0.66, -len / 2 + 0.05);       // the gooseneck's post and its leg
      tb(0.45 - 0.25, 0.45 + 0.25);               // the ladder
      tb(len / 2 - 0.53, len / 2 + 0.53);         // the Λ
    }

    // The navy A-frame: a grey box beam across the alley mouth (along s),
    // navy legs splayed along t, a red rocket crest at each apex, two seats.
    {
      const t = 387.5, s = 24.0, HB = 1.75, H = 2.32, SPL = 1.0;
      const fr = frame(t, s, Math.PI / 2);     // u along s
      const y = wy(t, s);
      for (const u of [-HB, HB]) {
        for (const sg of [-1, 1]) {
          const foot = fr.F(u, sg * SPL, y - 0.15);
          bar(up, foot, fr.F(u, sg * 0.04, y + H - 0.04), 0.06, 0.06, PG.NAVY, fr.U);
        }
        // The crest: a red plate in the frame's plane with a rocket on it.
        const c = fr.F(u + Math.sign(u) * 0.05, 0, y + H + 0.02);
        const n = fr.U.map((x) => x * Math.sign(u));
        const Vv = fr.V;
        const pl = (a, h) => add(add(c, Vv, a), [0, 1, 0], h);
        const poly = [[-0.26, -0.20], [0.26, -0.20], [0.30, 0.08], [0.0, 0.30], [-0.30, 0.08]];
        for (const sgn of [1, -1]) {
          const off = n.map((x) => x * 0.012 * sgn);
          for (let k = 1; k < poly.length - 1; k++) {
            const A = add(pl(...poly[0]), off), Bp = add(pl(...poly[k]), off), C = add(pl(...poly[k + 1]), off);
            if (sgn > 0) up.tri(A, Bp, C, PG.RED); else up.tri(A, C, Bp, PG.RED);
          }
          // The rocket: a white body and a nose, and three yellow dots.
          const R = add(off, n, 0.002 * sgn);
          const W = [0.92, 0.92, 0.90];
          const q = (pts, col) => {
            for (let k = 1; k < pts.length - 1; k++) {
              const A = add(pl(...pts[0]), R), Bp = add(pl(...pts[k]), R), C = add(pl(...pts[k + 1]), R);
              if (sgn > 0) up.tri(A, Bp, C, col); else up.tri(A, C, Bp, col);
            }
          };
          q([[-0.05, -0.12], [0.05, -0.12], [0.05, 0.10], [0.0, 0.19], [-0.05, 0.10]], W);
          q([[-0.10, -0.15], [-0.05, -0.10], [-0.05, -0.02]], W);
          q([[0.10, -0.15], [0.05, -0.02], [0.05, -0.10]], W);
          for (const [a, h] of [[-0.19, 0.0], [0.19, 0.0], [0.14, 0.16]]) {
            disc(up, add(pl(a, h), R), n.map((x) => x * sgn), 0.022, PG.YELLOW, 10);
          }
        }
      }
      // The beam: a grey rectangular section.
      boxO(up, fr.F(0, 0, y + H + 0.02), fr.U, [0, 1, 0], fr.V, HB + 0.12, 0.06, 0.045,
        [0.60, 0.61, 0.60], [0.70, 0.71, 0.70]);
      for (const u of [-0.55, 0.55]) {
        const [tt, ss] = fr.TS(u, 0);
        const hinge = P(tt, ss, y + H - 0.05);
        swingSeat('seatA', hinge, fr.U, H - 0.05 - 0.42, 0.44, PG.GALV);
      }
      for (const u of [-HB, HB]) {
        const [tt, ss] = fr.TS(u, 0);
        block(tt - SPL - 0.08, tt + SPL + 0.08, ss - 0.08, ss + 0.08, y, H);
      }
    }

    // The yellow rope frame, just past the end of the mural wall: the ladder
    // is its inland leg, the gooseneck reaches seaward toward the wall's
    // corner, and the knotted rope hangs from it to a hand's height off the
    // gravel.
    {
      const t = 393.2, s = 23.0, len = 2.1, H = 2.35;
      const fr = frame(t, s, Math.PI / 2);     // u along s; −u is seaward
      const y = wy(t, s);
      const { tip } = welderFrame(fr, y, { len, H, col: PG.YELLOW, ladderAt: null,
        ladderEnd: true, gooseOut: 1.15, gooseUp: 0.90 });
      const L = tip[1] - (y + 0.25);
      // The rope: five links of an AVBD chain hanging free from the ring,
      // drawn as a rope with its five knots in the shared tube (`chainList`).
      // 0.6 kg a metre with the knots; a capsule on every link, so it swings
      // aside when you walk through it.
      const NL = 5, l = L / NL;
      const caps = [];
      for (let k = 0; k < NL; k++) caps.push([-l / 2, 0, 0, l / 2, 0, 0, 0.03, k]);
      const sim = pgHang({ anchors: [tip], body: null, links: NL, chains: [{ a: 0, at: null, len: L }],
        kgM: 0.6, rLink: 0.02, caps, c: [tip[0], tip[1] - L / 2, tip[2]], reach: 0.6 });
      const knots = [];
      for (let k = 1; k <= 5; k++) knots.push((L * (k / 5.6) + 0.15) / L);
      const ROPE = [0.62, 0.56, 0.44];
      parts.push({ kind: 'rope', mesh: null, sim, L, r: 0.3, c: [tip[0], tip[1] - L * 0.6, tip[2]], H: tip,
        Z: crs(fr.V, [0, 1, 0]), tris: 0 });
      chainList.push({ sim, k: 0, col: ROPE, rope: true, knots, sides: 7, rings: 64 });
      const [ta, sa] = fr.TS(-len / 2, 0), [tb, sb] = fr.TS(len / 2, 0);
      block(ta - 0.15, ta + 0.15, Math.min(sa, sb) - 0.7, sa + 0.1, y, H);
      block(tb - 0.25, tb + 0.25, sb - 0.08, sb + 0.08, y, H);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PING PONG
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * One concrete table, long axis along t: a 2.74 x 1.525 top, 8 cm thick
   * with a chamfered arris, at 0.76; two cast slabs under it; white lines;
   * a perforated steel net on two posts; and a pale compacted pad round it,
   * because a table that has been played at for twenty years has worn its
   * own floor.
   */
  const tables = [];
  function buildTable(t, s) {
    tables.push({ t, s });
    const y = walkAt(t, s);
    const fr = frame(t, s, 0);
    const HL = 1.37, HW = 0.7625, TOP = 0.76, TH = 0.08;
    // The bed it stands on: compacted limestone grit in a precast kerb,
    // following the floor in 0.6 m cells.
    {
      const PT = 3.0, PS = 1.9, K = 0.09;
      const Y = (uu, vv) => {
        const [tt, ss] = fr.TS(uu, vv);
        return walkAt(tt, ss) + 0.035;
      };
      const grit = (uu, vv) => shade([0.43, 0.395, 0.335],
        0.93 + 0.12 * noise2((uu + t) / 0.9, vv / 0.9, 434));
      for (let u = -PT; u < PT - 1e-6; u += 0.6) {
        for (let v = -PS; v < PS - 1e-6; v += 0.6) {
          const u1 = Math.min(u + 0.6, PT), v1 = Math.min(v + 0.6, PS);
          ground3(floor, fr.F(u, v, Y(u, v)), fr.F(u1, v1, Y(u1, v1)), fr.F(u1, v, Y(u1, v)),
            grit(u, v), grit(u1, v1), grit(u1, v));
          ground3(floor, fr.F(u, v, Y(u, v)), fr.F(u, v1, Y(u, v1)), fr.F(u1, v1, Y(u1, v1)),
            grit(u, v), grit(u, v1), grit(u1, v1));
        }
      }
      // The kerb: four runs of 1 m units, 9 cm wide, 5 cm proud.
      const KC = [0.50, 0.49, 0.46];
      const kerb = (u0, v0, u1, v1) => {
        const L = Math.hypot(u1 - u0, v1 - v0), n = Math.ceil(L / 1.0);
        for (let i = 0; i < n; i++) {
          const a = i / n + 0.004, c = (i + 1) / n - 0.004;
          const pa = [u0 + (u1 - u0) * a, v0 + (v1 - v0) * a], pc = [u0 + (u1 - u0) * c, v0 + (v1 - v0) * c];
          const [ta, sa] = fr.TS(...pa), [tc, sc] = fr.TS(...pc);
          const yy = (walkAt(ta, sa) + walkAt(tc, sc)) / 2;
          bar(up, fr.F(pa[0], pa[1], yy + 0.0), fr.F(pc[0], pc[1], yy + 0.0), K, 0.16,
            shade(KC, 0.95 + 0.08 * jit(i + u0 * 7 + v0 * 3, 435)));
        }
      };
      kerb(-PT - K / 2, -PS - K / 2, PT + K / 2, -PS - K / 2);
      kerb(-PT - K / 2, PS + K / 2, PT + K / 2, PS + K / 2);
      kerb(-PT - K / 2, -PS, -PT - K / 2, PS);
      kerb(PT + K / 2, -PS, PT + K / 2, PS);
    }
    const yt = y + TOP;
    // The top, with a 1 cm chamfer all round.
    boxO(up, fr.F(0, 0, yt - TH / 2 - 0.005), fr.U, [0, 1, 0], fr.V, HL, TH / 2 - 0.005, HW,
      PG.CONC);
    boxO(up, fr.F(0, 0, yt - 0.005), fr.U, [0, 1, 0], fr.V, HL - 0.01, 0.005, HW - 0.01,
      shade(PG.CONC, 1.04), shade(PG.CONC, 0.94));
    // Weathering on the top: a few darker blotches, `jit`-placed.
    for (let k = 0; k < 7; k++) {
      const u = (jit(k + t, 430) - 0.5) * 2.2, v = (jit(k + t, 431) - 0.5) * 1.2;
      disc(up, fr.F(u, v, yt + 0.0008), [0, 1, 0], 0.08 + 0.12 * jit(k + t, 432),
        shade(PG.CONC, 0.86 + 0.06 * jit(k, 433)), 10);
    }
    // White lines: the edges and the centre line.
    const line = (u0, u1, v0, v1) => up.quad(fr.F(u0, v0, yt + 0.0015), fr.F(u1, v0, yt + 0.0015),
      fr.F(u1, v1, yt + 0.0015), fr.F(u0, v1, yt + 0.0015), [0.86, 0.86, 0.84]);
    line(-HL + 0.01, HL - 0.01, -HW + 0.01, -HW + 0.03);
    line(-HL + 0.01, HL - 0.01, HW - 0.03, HW - 0.01);
    line(-HL + 0.01, -HL + 0.03, -HW + 0.01, HW - 0.01);
    line(HL - 0.03, HL - 0.01, -HW + 0.01, HW - 0.01);
    line(-HL + 0.03, HL - 0.03, -0.0015, 0.0015);
    // The legs: two cast slabs, a hand narrower than the top, tapering.
    for (const u of [-0.80, 0.80]) {
      boxO(up, fr.F(u, 0, y + (TOP - TH) / 2 - 0.05), fr.U, [0, 1, 0], fr.V, 0.08,
        (TOP - TH) / 2 + 0.05, 0.55, shade(PG.CONC, 0.92));
      boxO(up, fr.F(u, 0, y + 0.04), fr.U, [0, 1, 0], fr.V, 0.13, 0.05, 0.60, shade(PG.CONC, 0.85));
    }
    // The net: a perforated steel plate 15 cm high across the middle, on two
    // posts 15 cm out from the sides, painted grey-green and rusting at the
    // foot.
    {
      const NW = HW + 0.15, NH = 0.1525;
      const STEEL = [0.30, 0.36, 0.33];
      for (const v of [-NW, NW]) {
        boxO(up, fr.F(0, v, yt + NH / 2 - 0.02), fr.U, [0, 1, 0], fr.V, 0.025, NH / 2 + 0.03,
          0.025, STEEL);
        // The bracket bolted under the top.
        boxO(up, fr.F(0, v * 0.97, yt - 0.10), fr.U, [0, 1, 0], fr.V, 0.02, 0.03, 0.14,
          shade(STEEL, 0.8));
      }
      bar(up, fr.F(0, -NW, yt + NH), fr.F(0, NW, yt + NH), 0.012, 0.02, STEEL, fr.U);
      bar(up, fr.F(0, -NW, yt + 0.006), fr.F(0, NW, yt + 0.006), 0.010, 0.012, STEEL, fr.U);
      // The plate's web: slats with the holes between them.
      const n = 38;
      for (let k = 0; k <= n; k++) {
        const v = -NW + (2 * NW * k) / n;
        bar(up, fr.F(0, v, yt + 0.008), fr.F(0, v, yt + NH - 0.008), 0.004, 0.012, STEEL, fr.U);
      }
      for (const h of [0.05, 0.10]) {
        bar(up, fr.F(0, -NW, yt + h), fr.F(0, NW, yt + h), 0.004, 0.006, STEEL, fr.U);
      }
    }
    block(t - HL, t + HL, s - HW, s + HW, y, TOP + 0.15);
  }

  // ── saplings ───────────────────────────────────────────────────────────────
  //
  // Young trees along B's fence, each tied to a stake: off the landscape's
  // own grower (`vegGrown`, 45-trees.js) on its own `mulberry32`, scaled to
  // 2.3-2.7 m, in the tree material so they light and cast like everything
  // else that grows.
  const sapGeos = [];
  function sapling(t, s, k) {
    const y = bY(t, s);
    const rnd = mulberry32(0x5a91 + k * 7919);
    const g = vegGrown({
      levels: 2, evergreen: false, spire: 0.15,
      height: 0.70, radius: 0.012, reach: 0.30, bole: 0.010,
      children: [5, 3], start: [0.52, 0.30],
      angle: [0.72, 0.62], length: [0.36, 0.26], thin: [0.62, 0.55],
      taper: [0.70, 0.60, 0.70], gnarl: [0.02, 0.06, 0.10],
      strength: [0.003, 0.010, 0.020], force: [0, 1, 0],
      sections: [6, 4, 3], segments: [6, 5, 3],
      tuft: [0.09, 3], tuftJit: 1.15, leaf: 0.22,
      squash: 0.85, puffSeg: 6, puffRow: 4, puffJag: 0.40,
    }, rnd, DRYBARK, [0.28, 0.40, 0.12], [0.62, 1.28]);
    const h = 2.3 + 0.4 * jit(k, 440);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...P(t, s, y - 0.02)),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), jit(k, 441) * TAU),
      new THREE.Vector3(h, h, h));
    g.applyMatrix4(m);
    sapGeos.push(g);
    // The stake and its two ties.
    const st = P(t + 0.09, s + 0.05, y);
    pipe(up, [add(st, [0, -0.2, 0]), add(st, [0, 1.55, 0])], 0.022, [0.48, 0.40, 0.30], 6);
    for (const hh of [0.6, 1.3]) {
      pipe(up, [add(st, [0, hh, 0]), P(t, s, y + hh)], 0.008, [0.12, 0.30, 0.12], 4);
    }
    block(t - 0.12, t + 0.15, s - 0.1, s + 0.1, y, 2.0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════
  buildFence();
  buildBoard();
  buildTower();
  buildSwings();
  buildSeesaw();
  for (const [t, s] of TRAMPS) buildTramp(t, s);
  buildRider();
  buildClimber();
  [[518.5, 51.5], [525.9, 51.55], [528.7, 51.55], [523.5, 40.8], [532.0, 41.1]]
    .forEach(([t, s], k) => sapling(t, s, k));
  // The olive's trunk (the tree is 43-jadrija.js's — see `GROUNDS.play` there).
  block(529.35, 529.85, 42.25, 42.75, bY(529.6, 42.5), 2.0);
  buildRubber();     // after everything, so WEAR is complete
  buildShore();
  const PONG = GR.pong;
  const pongS = (PONG.s0 + PONG.s1) / 2;
  buildTable(548.5, pongS);
  buildTable(556.5, pongS);

  // ── on to the scene ────────────────────────────────────────────────────────
  const FACE = 'n = gl_FrontFacing ? n : -n; base *= vVCol;';
  const upMesh = new THREE.Mesh(up.geo(), solidMaterial(0xffffff, {
    spec: 0.10, specPower: 26, side: THREE.DoubleSide, emissive: 0.06, body: FACE,
  }));
  upMesh.name = 'play:kit';
  // The granules. EPDM is a few millimetres of coloured rubber crumb, mostly
  // the one blue and a scatter of lighter and darker grains — at 6 mm cells
  // off a hash in the pad's own frame (the world's x is two kilometres from
  // the origin and would not survive the multiply), faded out by six metres,
  // past which a grain is a fraction of a pixel and would only shimmer.
  const padC = P((D.t0 + D.t1) / 2, (D.s0 + D.s1) / 2, 0);
  const rubMat = solidMaterial(0xffffff, {
    spec: 0.04, specPower: 10, side: THREE.DoubleSide,
    uniforms: { uPadO: { value: new THREE.Vector2(padC[0], padC[2]) } },
    decl: 'uniform vec2 uPadO;',
    body: FACE + `
      {
        vec2 q = floor((vWorld.xz - uPadO) * 160.0);
        float h = fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453);
        float k = h > 0.88 ? 0.30 : (h < 0.10 ? -0.22 : (h - 0.5) * 0.08);
        float fd = 1.0 - smoothstep(2.5, 6.0, length(vWorld - uCamPos));
        base *= 1.0 + k * fd;
      }`,
  });
  const rubMesh = new THREE.Mesh(rub.geo(), rubMat);
  rubMesh.name = 'play:rubber';
  rubMat.polygonOffset = true;
  rubMat.polygonOffsetFactor = -2;
  rubMat.polygonOffsetUnits = -4;
  const floorMat = solidMaterial(0xffffff, { spec: 0.03, specPower: 10, side: THREE.DoubleSide,
    body: FACE });
  floorMat.polygonOffset = true;
  floorMat.polygonOffsetFactor = -2;
  floorMat.polygonOffsetUnits = -4;
  const floorMesh = new THREE.Mesh(floor.geo(), floorMat);
  floorMesh.name = 'play:pongpad';
  const sapMesh = new THREE.Mesh(vegMerge(sapGeos),
    treeMaterial({ instanced: false, cut: true, emissive: 0.10, needles: false, grain: 2.6 }));
  sapMesh.userData.tree = true;
  sapMesh.name = 'play:saplings';
  for (const m of [upMesh, rubMesh, floorMesh, sapMesh]) {
    m.geometry.computeBoundingSphere();
    scene.add(m);
  }
  // Into the locale's blockers, by reference — see 46-backlane.js.
  for (const r of runs) jad.blockers.push(r);

  // ── the motion (1.558.0) ───────────────────────────────────────────────────
  //
  // Every moving part is an AVBD net of its own (the builders over
  // `buildPlayground`): the seats, the nest and the rope hang on chains of
  // rigid links; the seesaw turns on its axle and lands on its tyres; the
  // rider rocks on its coil; each bed is sprung from its rim. Stepped only
  // within NEAR of you (or of the camera, off foot), and each one sleeps once
  // it has been still a moment and nobody is touching it — so a playground
  // at rest costs nothing. Pushed by:
  //
  //   the hose — a force where the water lands, along its way from you;
  //   you — the walker is a capsule each net meets (`pgSim.you`), so walking
  //     into a seat or the rope shoves it, and the push (the hose's button
  //     with one of them in reach and in front of you, `aim`/`press`/`hold`
  //     below; held, it keeps pushing) is a shove with the hand;
  //   the beds — you stand on them: the bed has your height while you are
  //     on it, and the jump key pumps it (`bouncer`, and 47-ground.js).
  const NEAR = 30;
  const _q = new THREE.Quaternion(), _pv = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
  const tramps = parts.filter((p) => p.kind === 'tramp');
  for (const p of tramps) {
    p.base = p.mesh.matrix.clone();
    const [tt, ts] = jad.local(p.c[0], p.c[2]);
    p.t = tt; p.s = ts;
  }
  /** The world point the hose or a hand finds on part p. */
  const _hp = [0, 0, 0];
  function hitPoint(p, out = _hp) {
    const n = p.sim.net;
    if (p.kind === 'tramp') { out[0] = p.c[0]; out[1] = p.c[1]; out[2] = p.c[2]; return out; }
    if (p.kind === 'rope') {
      const i = p.sim.links[0].ids[2];
      out[0] = n.P[3 * i]; out[1] = n.P[3 * i + 1]; out[2] = n.P[3 * i + 2];
      return out;
    }
    const b = p.sim.body;
    out[0] = n.P[3 * b]; out[1] = n.P[3 * b + 1]; out[2] = n.P[3 * b + 2];
    return out;
  }
  // How hard the hose pushes, N, and a hand: a shove (N·s) and a held push (N).
  const HOSE = { seat: 30, seatA: 30, nest: 70, rope: 12, rider: 70, seesaw: 160, tramp: 250 };
  const SHOVE = { seat: 5, seatA: 5, nest: 14, rope: 1.2, rider: 14, seesaw: 22, tramp: 5 };
  const HOLD = { seat: 30, seatA: 30, nest: 80, rope: 8, rider: 60, seesaw: 180, tramp: 300 };
  /**
   * Push part p at world point `at`, horizontally along (fx, fz), with `J`
   * N·s — or, for the seesaw, down on the end at `at` if it is up and up if
   * it is down; for a bed, down.
   */
  function shove(p, at, fx, fz, J) {
    const sim = p.sim;
    if (p.kind === 'tramp') { sim.poke(J / PGT.bed); return J / PGT.bed; }
    if (p.kind === 'seesaw') {
      const e0 = sim.end(-1, [0, 0, 0]), e1 = sim.end(1, [0, 0, 0]);
      const sg = (at[0] - e1[0]) ** 2 + (at[2] - e1[2]) ** 2 < (at[0] - e0[0]) ** 2 + (at[2] - e0[2]) ** 2 ? 1 : -1;
      const e = sg > 0 ? e1 : e0;
      // angle > 0 is the +z end down.
      const down = sim.angle() * sg > 0;
      sim.impulse(sim.body, e, [0, down ? J : -J, 0]);
      return J / 25;
    }
    const b = p.kind === 'rope' ? p.sim.links[0].ids[3] : sim.body;
    // The nest is pushed by its rim, on your side of it and a little off the
    // line through its middle — which is why a pushed nest also turns.
    if (p.kind === 'nest') at = [at[0] - fx * 0.40 + fz * 0.30, at[1], at[2] - fz * 0.40 - fx * 0.30];
    sim.impulse(b, at, [fx * J, 0, fz * J]);
    return J / sim.net.mass[b];
  }
  /** The hose landing at `jet`, coming from `who`, on part p for dt. */
  function hose(p, jet, who, dt) {
    const F = HOSE[p.kind] || 40;
    let hx = who ? jet.x - who.x : 0, hz = who ? jet.z - who.z : 0;
    const hl = Math.hypot(hx, hz) || 1;
    hx /= hl; hz /= hl;
    if (p.kind === 'seesaw') {
      for (const sg of [-1, 1]) {
        const e = p.sim.end(sg, [0, 0, 0]);
        if ((jet.x - e[0]) ** 2 + (jet.z - e[2]) ** 2 < 0.36 && jet.y < e[1] + 1.0) {
          p.sim.impulse(p.sim.body, e, [0, -F * dt, 0]);
          return true;
        }
      }
      return false;
    }
    const at = hitPoint(p);
    const R = (p.r || 0.45) + 0.25;
    if ((jet.x - at[0]) ** 2 + (jet.z - at[2]) ** 2 > R * R) return false;
    if (jet.y < at[1] - 0.8 || jet.y > at[1] + 1.2) return false;
    if (p.kind === 'tramp') { p.sim.poke(F * dt / PGT.bed); return true; }
    shove(p, [jet.x, Math.min(jet.y, at[1] + 0.1), jet.z], hx, hz, F * dt);
    return true;
  }

  // ── the chains, one tube ───────────────────────────────────────────────────
  // Through each chain's joints, a Catmull-Rom so a slack chain bends round
  // its links rather than kinking at them; beaded like the links of a chain
  // (alternate rings fatter, 5 cm apart), or for the rope a twisted line with
  // its five knots.
  let chainMesh = null;
  const chainState = { verts: 0, tris: 0 };
  {
    let nv = 0, ni = 0;
    for (const c of chainList) {
      c.sides = c.sides || 5;
      c.rings = c.rings || 40;
      c.v0 = nv;
      nv += c.sides * c.rings;
      ni += (c.rings - 1) * c.sides * 6;
      c.pts = new Float64Array(3 * (c.sim.NL + 1));
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = new Uint32Array(ni);
    let o = 0;
    for (const c of chainList) {
      for (let v = c.v0; v < c.v0 + c.sides * c.rings; v++) col.set(c.col, 3 * v);
      for (let i = 0; i < c.rings - 1; i++) {
        for (let k = 0; k < c.sides; k++) {
          const a = c.v0 + i * c.sides + k, b = c.v0 + i * c.sides + ((k + 1) % c.sides);
          idx[o++] = a; idx[o++] = a + c.sides; idx[o++] = b + c.sides;
          idx[o++] = a; idx[o++] = b + c.sides; idx[o++] = b;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    chainMesh = new THREE.Mesh(g, eqMat);
    chainMesh.name = 'play:chains';
    scene.add(chainMesh);
    chainState.verts = nv; chainState.tris = ni / 3;
  }
  const _cr = [0, 0, 0];
  /** A point along chain c at u in [0, 1]: Catmull-Rom through its joints. */
  function chainAt(c, u, out) {
    const P0 = c.pts, n = c.sim.NL;
    const x = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(x), f = x - i;
    const at = (k, a) => P0[3 * Math.max(0, Math.min(n, k)) + a];
    for (let a = 0; a < 3; a++) {
      const p0 = at(i - 1, a), p1 = at(i, a), p2 = at(i + 1, a), p3 = at(i + 2, a);
      // The ends' outer neighbours are mirrored, so the tangent there is
      // along the link and not toward nothing.
      const q0 = i - 1 < 0 ? 2 * p1 - p2 : p0, q3 = i + 2 > n ? 2 * p2 - p1 : p3;
      const f2 = f * f, f3 = f2 * f;
      out[a] = 0.5 * ((2 * p1) + (-q0 + p2) * f + (2 * q0 - 5 * p1 + 4 * p2 - q3) * f2
        + (-q0 + 3 * p1 - 3 * p2 + q3) * f3);
    }
    return out;
  }
  function chainLay(c) {
    c.sim.chainPts(c.k, c.pts);
    const pos = chainMesh.geometry.attributes.position.array, nor = chainMesh.geometry.attributes.normal.array;
    const R = c.rings, S = c.sides;
    const pts = c.ringPts || (c.ringPts = new Float64Array(3 * R));
    for (let i = 0; i < R; i++) {
      chainAt(c, i / (R - 1), _cr);
      pts[3 * i] = _cr[0]; pts[3 * i + 1] = _cr[1]; pts[3 * i + 2] = _cr[2];
    }
    let e1 = null;
    for (let i = 0; i < R; i++) {
      const a = Math.max(0, i - 1), b = Math.min(R - 1, i + 1);
      const T = nrm([pts[3 * b] - pts[3 * a], pts[3 * b + 1] - pts[3 * a + 1], pts[3 * b + 2] - pts[3 * a + 2]]);
      if (!e1) e1 = perp(T)[0];
      e1 = nrm(sub(e1, T.map((x) => x * dot(e1, T))));
      const e2 = crs(T, e1);
      const f = i / (R - 1);
      let r;
      if (c.rope) {
        r = 0.014 + 0.002 * Math.sin(i * 2.1);
        for (const kf of c.knots) {
          const d = Math.abs(f - kf) * c.sim.links[0].l * c.sim.NL;
          if (d < 0.035) r = Math.max(r, 0.035 * Math.sqrt(1 - (d / 0.035) ** 2) * 0.9 + 0.006);
        }
        if (i === R - 1) r = 0.006;
      } else r = i % 2 ? 0.0085 : 0.0055;
      for (let k = 0; k < S; k++) {
        const an = (k / S) * TAU, ca = Math.cos(an), sa = Math.sin(an);
        const nx = e1[0] * ca + e2[0] * sa, ny = e1[1] * ca + e2[1] * sa, nz = e1[2] * ca + e2[2] * sa;
        const v = 3 * (c.v0 + i * S + k);
        pos[v] = pts[3 * i] + nx * r; pos[v + 1] = pts[3 * i + 1] + ny * r; pos[v + 2] = pts[3 * i + 2] + nz * r;
        nor[v] = nx; nor[v + 1] = ny; nor[v + 2] = nz;
      }
    }
  }
  for (const c of chainList) chainLay(c);
  chainMesh.geometry.computeBoundingSphere();

  /** Part p's mesh where its body is. */
  function draw(p) {
    if (!p.mesh) return;
    const n = p.sim.net;
    if (p.kind === 'tramp') {
      p.mesh.matrix.copy(p.base).scale(_pv.set(1, Math.max(0.003, p.sim.dip() + 0.003), 1));
    } else {
      const b = p.sim.body;
      _pv.set(n.P[3 * b], n.P[3 * b + 1], n.P[3 * b + 2]);
      _q.set(n.Q[4 * b], n.Q[4 * b + 1], n.Q[4 * b + 2], n.Q[4 * b + 3]);
      p.mesh.matrix.compose(_pv, _q, _one);
    }
    p.mesh.matrixWorldNeedsUpdate = true;
  }

  // ── the walker on a bed ────────────────────────────────────────────────────
  let onBed = null, bedFeet = 0;
  // In the shore frame, which is what the beds are laid in.
  const bedD = (p, x, z) => {
    const ts = jad.local(x, z);
    return Math.hypot(ts[0] - p.t, ts[1] - p.s);
  };
  const bedUnder = (x, z) => {
    for (const p of tramps) {
      if ((x - p.c[0]) ** 2 + (z - p.c[2]) ** 2 > 1) continue;
      // Hers while she is on it (1.562.0): one body a bed, and it is her.
      if (p.her) continue;
      const d = bedD(p, x, z);
      if (d < PGT.RB - 0.05) return [p, d];
    }
    return null;
  };
  /** Feet over the bed at d from its middle: the dent is shallower out there. */
  function ride(you, p, d, r) {
    bedFeet = r.y + r.dip * Math.min(1, (d / PGT.RB) ** 2);
    if (r.off) {
      onBed = null;
      you.gy = p.top;
      you.hop = Math.max(0.001, bedFeet - p.top);
      you.hopV = r.vy;
      you.y = you.gy + you.hop;
      return { land: 0, knees: r.knees };
    }
    you.gy = bedFeet; you.hop = 0; you.hopV = 0; you.y = bedFeet;
    return { land: 0, knees: r.knees };
  }
  const bouncer = {
    step(you, dt, air) {
      if (onBed) {
        const p = onBed;
        const d = bedD(p, you.x, you.z);
        if (d > PGT.RB - 0.02) {
          // Walked off it: down on to the rim from where the bed had you,
          // and the walk's own step easing takes you up the 4 cm.
          p.sim.unmount();
          onBed = null;
          you.gy = bedFeet; you.hop = 0; you.hopV = 0; you.y = bedFeet;
          return { land: 0 };
        }
        // The dent's slope runs you to its middle, as a real bed does.
        const dip = p.sim.dip();
        const dw = Math.hypot(you.x - p.c[0], you.z - p.c[2]);
        if (dw > 0.02 && dip > 0.01) {
          const a = 0.5 * GROUND.hopG * 2 * dip * d / (PGT.RB * PGT.RB);
          you.vx -= ((you.x - p.c[0]) / dw) * a * dt;
          you.vz -= ((you.z - p.c[2]) / dw) * a * dt;
        }
        const r = p.sim.step2(dt, false);
        p.stepped = true;
        return ride(you, p, d, r);
      }
      const u = bedUnder(you.x, you.z);
      if (!u) return null;
      const [p, d] = u;
      let land = 0;
      if (air) {
        // Still on the way down to it: the walk's own arc.
        if (!(you.hopV < 0) || you.gy + you.hop + you.hopV * dt > p.top) return null;
        land = -you.hopV * 0.4;
        p.sim.mount(p.top, you.hopV);
      } else p.sim.mount(p.top, 0);
      onBed = p;
      const r = p.sim.step2(dt, false);
      p.stepped = true;
      const res = ride(you, p, d, r);
      res.land = land;
      return res;
    },
    press(you) {
      if (onBed) return onBed.sim.press();
      if (you.hopV < 0 && you.hop > 0) {
        const u = bedUnder(you.x, you.z);
        if (u) return u[0].sim.press();
      }
      return false;
    },
  };

  // ── HER ON IT (1.562.0) ────────────────────────────────────────────────────
  //
  // See PGH. `on(i, o)` puts her in part i's net: her mass on the body she
  // sits on, about where she sits; her hands on a swing's chains (`grip`);
  // her capsules on it for the walker to meet; and on the rider a coil that
  // will carry an adult. `off(i)` takes it all out again. `drive(i, o)` is
  // what she is doing with it — a pump, a kick, a rock, her feet down to stop
  // — laid on every substep by `herDrive`. On a bed she is the bed's second
  // body, `pgBed`'s `you`, exactly as the walker is (`bouncer`), and her
  // flight between bounces is stepped here (`herBedStep`).
  const RIDE_KINDS = { swing: ['seat', 'seatA'], nest: ['nest'], seesaw: ['seesaw'], tramp: ['tramp'],
    rider: ['rider'] };
  const G_W = 9.81;
  const qOf = (p) => {
    const n = p.sim.net, b = p.sim.body;
    return [n.Q[4 * b], n.Q[4 * b + 1], n.Q[4 * b + 2], n.Q[4 * b + 3]];
  };
  const pOf = (p) => {
    const n = p.sim.net, b = p.sim.body;
    return [n.P[3 * b], n.P[3 * b + 1], n.P[3 * b + 2]];
  };
  /** Body-local point l of part p in the world, now. */
  const toW = (p, l) => {
    const r = pgRot(qOf(p), l), o = pOf(p);
    return [o[0] + r[0], o[1] + r[1], o[2] + r[2]];
  };
  /** A pure turn on part p's body about world axis `ax`: tau N·m for h s. */
  function spin(p, ax, tau, h) {
    const n = p.sim.net, b = p.sim.body, q = qOf(p);
    const al = pgRot([-q[0], -q[1], -q[2], q[3]], ax);
    const I = n.inert;
    const wl = [al[0] * tau * h / Math.max(1e-4, I[6 * b]), al[1] * tau * h / Math.max(1e-4, I[6 * b + 1]),
      al[2] * tau * h / Math.max(1e-4, I[6 * b + 2])];
    const ww = pgRot(q, wl);
    n.W[3 * b] += ww[0]; n.W[3 * b + 1] += ww[1]; n.W[3 * b + 2] += ww[2];
  }
  /** A swing's angle off hanging, rad, along its own swing (+ toward +Z). */
  const swingTh = (p) => {
    const at = hitPoint(p, [0, 0, 0]), H = p.H;
    const dx = at[0] - H[0], dy = at[1] - H[1], dz = at[2] - H[2];
    return Math.atan2(dx * p.Z[0] + dz * p.Z[2], -dy);
  };
  let herClock = 0;
  /** Every substep she is on part p: her weight where it really is, and her drive. */
  function herDrive(p, h) {
    const H = p.her;
    if (!H) return;
    const n = p.sim.net, b = p.sim.body, D = H.drive;
    if (p.kind === 'seat' || p.kind === 'seatA' || p.kind === 'nest') {
      // The swing's way, flat, and how fast the seat is going along it.
      const Zw = pgRot(qOf(p), [0, 0, 1]);
      const zl = Math.hypot(Zw[0], Zw[2]) || 1;
      const zx = Zw[0] / zl, zz = Zw[2] / zl;
      const v = n.V[3 * b] * zx + n.V[3 * b + 2] * zz;
      if (D.pump > 0 && Math.abs(v) > 0.02) {
        // With the seat's motion, and only a breath of it past the height
        // she means to reach — she pumps up to it and then rides it.
        const k = H.peak > (D.top || PGH.pumpTop) ? 0.12 : 1;
        const a = D.pump * PGH.pumpN * k * Math.sign(v) / n.mass[b];
        n.kick(b, zx * a * h, 0, zz * a * h);
      } else if (D.pump > 0 && H.peak < 0.03) {
        // From dead still a lean starts it: she rocks once to get going.
        n.kick(b, zx * 0.6 * h, 0, zz * 0.6 * h);
      }
      // Her feet down to stop it, scuffed along the rubber at the bottom.
      if (D.brake > 0) {
        const f = Math.max(0, 1 - D.brake * 2.2 * h);
        n.V[3 * b] *= f; n.V[3 * b + 2] *= f;
        n.W[3 * b] *= f; n.W[3 * b + 1] *= f; n.W[3 * b + 2] *= f;
      }
      return;
    }
    if (p.kind === 'seesaw') {
      const S = p.sim, sg = H.sg;
      // Her weight at her seat, a hand's breadth over it. The solve already
      // carries her mass at the beam's own centre, so this is the lever.
      const at = toW(p, [0, 0.015 + PGH.comUp, sg * (S.HL - 0.22)]);
      S.torque(b, at, [0, -PGH.kg * G_W, 0], h);
      // And at the bottom she kicks off the ground, once a landing.
      const down = S.angle() * sg > S.rest * 0.80;
      // Once it has landed and stopped: a kick into a beam still coming down
      // only cancels the fall.
      const Xw = pgRot(qOf(p), [1, 0, 0]);
      const w = n.W[3 * b] * Xw[0] + n.W[3 * b + 1] * Xw[1] + n.W[3 * b + 2] * Xw[2];
      if (down && Math.abs(w) < 0.25) H.downFor = (H.downFor || 0) + h; else H.downFor = 0;
      if (D.kick > 0 && down && H.landed && H.downFor > 0.15 && herClock - H.kicked > PGH.kickEvery) {
        H.kicked = herClock;
        H.landed = false;
        H.kicks = (H.kicks || 0) + 1;
        const e = toW(p, [0, 0.015, sg * (S.HL - 0.22)]);
        S.torque(b, e, [0, PGH.kickNs * D.kick, 0], 1);
      }
      if (S.angle() * sg < S.rest * 0.62) H.landed = true;
      return;
    }
    if (p.kind === 'rider') {
      // Her weight at her own height and not the horse's (PGH.comRider).
      const at = toW(p, [0, PGH.comRider - p.COM, 0.06]);
      p.sim.torque(b, at, [0, -PGH.kg * G_W, 0], h);
      if (D.rock > 0) {
        // Fore and aft, with the way it is already going, up to a height.
        const Xw = pgRot(qOf(p), [1, 0, 0]);
        const w = n.W[3 * b] * Xw[0] + n.W[3 * b + 1] * Xw[1] + n.W[3 * b + 2] * Xw[2];
        const up = pgRot(qOf(p), [0, 1, 0]);
        const tilt = Math.acos(Math.min(1, up[1]));
        const k = tilt > PGH.rockTop ? 0 : 1;
        const sgn = Math.abs(w) > 0.03 ? Math.sign(w) : 1;
        spin(p, Xw, D.rock * PGH.rockNm * k * sgn, h);
      }
      if (D.brake > 0) {
        const f = Math.max(0, 1 - D.brake * 3 * h);
        n.W[3 * b] *= f; n.W[3 * b + 1] *= f; n.W[3 * b + 2] *= f;
      }
    }
  }
  /** Her on a bed: on it (the bed's second body), or in the air over it. */
  function herBedStep(p, dt) {
    const H = p.her, B = H.bed, g = GROUND.hopG;
    const sim = p.sim;
    B.t += dt;
    if (B.on) {
      if (B.pumpNow && sim.phase === 'stand') { sim.press(0.32); B.pumpNow = false; B.pumps++; }
      const r = sim.step2(dt, false);
      if (r) {
        B.y = r.y; B.vy = r.vy; B.knees = r.knees;
        if (r.off) {
          B.on = false; B.air = true; B.apex = r.y; B.offAt = B.t; B.bounces++;
          B.knees = 0;
          // Her legs soak up what would take her past her height, and with
          // no height wanted, half of it: she is letting it die.
          if (B.want > 0) B.vy = Math.min(B.vy, Math.sqrt(2 * g * (B.want * 1.06 + 0.04)));
          else B.vy *= 0.5;
        }
      }
    } else if (B.air) {
      B.vy -= g * dt;
      B.y += B.vy * dt;
      if (B.y > B.apex) B.apex = B.y;
      if (B.vy < 0 && B.y <= p.top) {
        B.lastApex = B.apex - p.top;
        // A pump as she lands, as hard as the last bounce came in short.
        if (B.want > 0 && B.lastApex < B.want) {
          const k = Math.min(1, 0.25 + 1.5 * (B.want - B.lastApex) / B.want);
          sim.press(k); B.pumps++;
        }
        sim.mount(p.top, B.vy);
        B.on = true; B.air = false; B.y = p.top;
        const r = sim.step2(dt, false);
        if (r) { B.y = r.y; B.knees = r.knees; }
      }
    } else {
      sim.mount(p.top, 0);
      B.on = true;
      const r = sim.step2(dt, false);
      if (r) { B.y = r.y; B.knees = r.knees; }
    }
    p.stepped = true;
    // Standing on it and still: no bounce left in it.
    B.still = B.on && sim.phase === 'stand' && Math.abs(B.vy) < 0.15 && sim.dip() < 0.09;
  }
  function herFind(kind, x, z) {
    const ks = RIDE_KINDS[kind];
    if (!ks) return -1;
    let best = -1, bd = Infinity;
    parts.forEach((p, i) => {
      if (!ks.includes(p.kind) || p.her) return;
      // A bed you are bouncing on is yours.
      if (p.kind === 'tramp' && (onBed === p || p.sim.on)) return;
      const d = Math.hypot(p.c[0] - x, p.c[2] - z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function herCapsSet(p, caps) {
    const n = p.sim.net, hc = p.sim.herCaps || [];
    hc.forEach((c, k) => {
      const q = caps && caps[k];
      if (!q) { n.cpOn[c] = 0; return; }
      n.setCap(c, q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[6]);
      n.cpOn[c] = 1;
    });
  }
  function herOn(i, o = {}) {
    const p = parts[i];
    if (!p || p.her) return false;
    const sim = p.sim, net = sim.net;
    p.her = { t: 0, sg: o.sg || 1, drive: {}, kicked: -9, landed: true, peak: 0, lastTh: 0, dth: 0,
      laughs: 0, grips: [] };
    if (p.kind === 'tramp') {
      p.her.bed = { on: false, air: false, y: p.top, vy: 0, knees: 0, apex: p.top, lastApex: 0, want: 0,
        pumpNow: false, pumps: 0, bounces: 0, t: 0, still: false };
      sim.setBusy(() => !!p.her);
      sim.wake();
      return true;
    }
    const b = sim.body;
    p.her.mass0 = net.mass[b];
    p.her.I0 = Array.from(net.inert.subarray(6 * b, 6 * b + 6));
    const a = o.at || [0, 0, 0];
    const M = PGH.kg, cx = a[0], cz = a[2];
    const cy = p.kind === 'rider' ? PGH.comRider - p.COM : a[1] + PGH.comUp;
    net.mass[b] += M;
    // Parallel axes about the body's own origin, and her own about her centre.
    net.inert[6 * b] += M * (cy * cy + cz * cz) + PGH.Isit;
    net.inert[6 * b + 1] += M * (cx * cx + cz * cz) + PGH.Iyaw;
    net.inert[6 * b + 2] += M * (cx * cx + cy * cy) + PGH.Isit;
    if (p.kind === 'rider') net.setJointK(sim.joint, Infinity, PGH.riderK);
    if (p.kind === 'seat' || p.kind === 'seatA' || p.kind === 'nest') {
      // On a swing she is carried at the seat: her hands on the chains hold
      // her up there, and a centre of mass laid above where the chains meet
      // the seat would tip it over backwards about that line. She has hold
      // of it as she sits, so it is still.
      for (const L of sim.links) for (const k of L.ids) { net.V.fill(0, 3 * k, 3 * k + 3); net.W.fill(0, 3 * k, 3 * k + 3); }
      net.V.fill(0, 3 * b, 3 * b + 3); net.W.fill(0, 3 * b, 3 * b + 3);
      if (sim.grip) {
        const up = o.gripUp || 0.42;
        for (const k of (o.grips || [0, 1])) p.her.grips.push([k, sim.grip(k, up, 2.0e4)]);
      }
    }
    herCapsSet(p, o.caps);
    sim.setBusy(() => !!p.her);
    sim.wake();
    return true;
  }
  function herOff(i) {
    const p = parts[i];
    if (!p || !p.her) return false;
    const sim = p.sim, net = sim.net;
    if (p.kind === 'tramp') {
      if (sim.on) sim.unmount();
    } else {
      const b = sim.body;
      if (p.her.mass0 != null) {
        net.mass[b] = p.her.mass0;
        for (let k = 0; k < 6; k++) net.inert[6 * b + k] = p.her.I0[k];
      }
      if (p.kind === 'rider') net.setJointK(sim.joint, Infinity, sim.k);
      for (const [k] of p.her.grips) sim.grip(k, 0, 0);
      herCapsSet(p, null);
    }
    p.her = null;
    // A bed goes back to being kept awake by the walker on it (`pgBed`).
    sim.setBusy(p.kind === 'tramp' ? () => sim.on : null);
    sim.wake();
    return true;
  }
  /** Where she is on part i now — the body she sits on, or the bed under her feet. */
  function herFrame(i) {
    const p = parts[i];
    if (!p) return null;
    if (p.kind === 'tramp') {
      const B = p.her && p.her.bed;
      return { P: [p.c[0], B ? B.y : p.top, p.c[2]], Q: [0, 0, 0, 1], bed: B || null,
        dip: p.sim.dip(), phase: p.sim.phase, top: p.top };
    }
    return { P: pOf(p), Q: qOf(p) };
  }
  // Each frame, after the step: her swing's height, for the pump and the laugh.
  function herWatch(p, dt) {
    const H = p.her;
    H.t += dt;
    if (p.kind === 'seat' || p.kind === 'seatA' || p.kind === 'nest') {
      const th = swingTh(p);
      // The height of the swing: the biggest angle lately, let go slowly.
      // Let go faster while her feet are down: it is dying, and she is
      // watching it die to get off.
      H.peak = Math.max(H.peak * Math.exp(-dt * (H.drive.brake ? 2.0 : 0.25)), Math.abs(th));
      H.dth = th - H.lastTh;
      H.lastTh = th;
      H.th = th;
    } else if (p.kind === 'seesaw') {
      H.th = p.sim.angle();
    } else if (p.kind === 'rider') {
      const up = pgRot(qOf(p), [0, 1, 0]);
      H.th = Math.acos(Math.min(1, up[1])) * Math.sign(up[0] * p.Z[0] + up[2] * p.Z[2] || 1);
      H.peak = Math.max(H.peak * Math.exp(-dt * 0.4), Math.abs(H.th));
    }
  }
  // What your hand is worth on part p with her on it — see PGH.
  const herShove = (p) => (p.kind === 'seesaw' ? PGH.shoveSaw : p.kind === 'nest' ? PGH.shoveNest
    : p.kind === 'tramp' ? SHOVE.tramp : p.kind === 'rider' ? SHOVE.rider * 3 : PGH.shoveSeat);
  const herHold = (p) => (p.kind === 'seesaw' ? PGH.holdSaw : p.kind === 'nest' ? PGH.holdNest
    : p.kind === 'tramp' ? HOLD.tramp : p.kind === 'rider' ? HOLD.rider * 3 : PGH.holdSeat);
  const her = {
    kinds: RIDE_KINDS,
    find: herFind,
    on: herOn,
    off: herOff,
    frame: herFrame,
    /** What she is doing on part i: { pump, top, brake, kick, rock } (0..1 each; top rad). */
    drive: (i, o) => {
      const p = parts[i];
      if (p && p.her) Object.assign(p.her.drive, o || {});
      return !!(p && p.her);
    },
    /** Her on part i: the swing (`th`, `peak`), the seesaw, the bed. */
    state: (i) => {
      const p = parts[i];
      if (!p || !p.her) return null;
      const H = p.her;
      const o = { i, kind: p.kind, t: +H.t.toFixed(2), th: +(H.th || 0).toFixed(3), peak: +H.peak.toFixed(3),
        drive: { ...H.drive }, kicks: H.kicks || 0,
        pushedAgo: H.pushedAt != null ? +(herClock - H.pushedAt).toFixed(2) : 99 };
      if (p.kind === 'tramp') {
        const B = H.bed;
        Object.assign(o, { on: B.on, air: B.air, y: +B.y.toFixed(3), vy: +B.vy.toFixed(2), knees: +B.knees.toFixed(3),
          apex: +(B.apex - p.top).toFixed(3), lastApex: +B.lastApex.toFixed(3), bounces: B.bounces,
          pumps: B.pumps, still: B.still, phase: p.sim.phase, dip: +p.sim.dip().toFixed(3) });
      }
      if (p.kind === 'seesaw') o.sg = H.sg;
      return o;
    },
    /** The bed: how high she wants to go (0 lets it die away), and a pump now. */
    bed: (i, want, pumpNow = false) => {
      const p = parts[i];
      if (!p || !p.her || !p.her.bed) return null;
      p.her.bed.want = want;
      if (pumpNow) p.her.bed.pumpNow = true;
      return p.her.bed;
    },
    /** Part i, for posing her on it: its kind and geometry, body frame. */
    info: (i) => {
      const p = parts[i];
      if (!p) return null;
      const o = { kind: p.kind, c: p.c.slice(), H: p.H ? p.H.slice() : null, X: p.X ? p.X.slice() : null,
        Z: p.Z ? p.Z.slice() : null };
      if (p.kind === 'seat' || p.kind === 'seatA') Object.assign(o, { hw: p.hw, w: p.w, seatY: p.seatY });
      if (p.kind === 'nest') Object.assign(o, { RR: p.RR, seatY: p.seatY, feet: p.chainFeet, heads: p.chainHeads });
      if (p.kind === 'seesaw') Object.assign(o, { HL: p.sim.HL, COM: p.COM, rest: p.sim.rest });
      if (p.kind === 'rider') Object.assign(o, { COM: p.COM });
      if (p.kind === 'tramp') Object.assign(o, { top: p.top, rim: p.rim, RB: PGT.RB });
      return o;
    },
    /** Body-local point l of part i, in the world. */
    toWorld: (i, l) => toW(parts[i], l),
    /** The slide and its tower: the line, the trough, the deck, the ladder. */
    slide: () => tower,
    /** Which part she is on, or -1. */
    which: () => parts.findIndex((p) => p.her),
  };

  // ── what you stand on ──────────────────────────────────────────────────────
  // The rubber is 8 cm over the hill `walkY` knows (5 of gravel, 3 of
  // rubber), the beds are on their springs, the rims stand 3.5 cm proud,
  // and the tables stand in grit beds; this is the floor that knows them
  // (`ground.addFloor`, 47-ground.js).
  const box = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  const grow = (t, s) => {
    const w = jad.toWorld(t, s);
    box.x0 = Math.min(box.x0, w[0] - 1); box.x1 = Math.max(box.x1, w[0] + 1);
    box.z0 = Math.min(box.z0, w[2] - 1); box.z1 = Math.max(box.z1, w[2] + 1);
  };
  for (const [t, s] of [[G.t0, G.s0], [G.t1, G.s0], [G.t1, G.s1], [G.t0, G.s1]]) grow(t, s);
  for (const tb of tables) for (const [du, dv] of [[-3, -2], [3, -2], [3, 2], [-3, 2]]) grow(tb.t + du, tb.s + dv);
  function floorY(x, z) {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) return null;
    const [t, s] = jad.local(x, z);
    if (t > G.t0 && t < G.t1 && s > G.s0 && s < G.s1) {
      for (const p of tramps) {
        const d = Math.hypot(t - p.t, s - p.s);
        if (d < 0.64) return p.top;
        if (d < 0.80) return p.rim;
      }
      return bY(t, s);
    }
    for (const tb of tables) {
      if (Math.abs(t - tb.t) < 3.0 && Math.abs(s - tb.s) < 1.9) return walkAt(t, s) + 0.035;
    }
    return null;
  }

  // ── the frame ──────────────────────────────────────────────────────────────
  const cost = { ms: 0, msMax: 0, frames: 0, awake: 0, steps: 0 };
  let awake = 0;
  function tick(dt, cam, who, jet) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.05);
    const fx = who ? who.x : cam.x, fz = who ? who.z : cam.z;
    const feet = who ? [who.x, who.y, who.z] : null;
    awake = 0;
    herClock += dt;
    let laid = false;
    for (const p of parts) {
      // With her on it, it goes on wherever you are (1.562.0).
      const near = !!p.her || (p.c[0] - fx) ** 2 + (p.c[2] - fz) ** 2 < NEAR * NEAR;
      if (!near) { if (p.kind !== 'tramp') p.sim.you(null); continue; }
      if (p.kind !== 'tramp') p.sim.you(feet);
      if (jet) hose(p, jet, who, dt);
      let n;
      if (p.kind === 'tramp') {
        // A bed with you on it is stepped by the walk (`bouncer`); with her
        // on it, by `herBedStep`.
        if (p.her) { herBedStep(p, dt); p.stepped = false; n = 1; }
        else if (p.stepped || onBed === p) { p.stepped = false; n = 1; } else n = p.sim.step2(dt, true) ? 1 : (p.sim.asleep ? 0 : 1);
      } else n = p.sim.step(dt, p.her ? p.herBefore || (p.herBefore = (h) => herDrive(p, h)) : null);
      if (p.her) herWatch(p, dt);
      if (!p.sim.asleep) awake++;
      if (n || p.drawn !== false) draw(p);
      p.drawn = n > 0;
      cost.steps += n;
      if (n && p.kind !== 'tramp') laid = true;
    }
    if (laid) {
      for (const c of chainList) if (!c.sim.asleep || c.wasAwake) chainLay(c);
      for (const c of chainList) c.wasAwake = !c.sim.asleep;
      chainMesh.geometry.attributes.position.needsUpdate = true;
      chainMesh.geometry.attributes.normal.needsUpdate = true;
    }
    const ms = performance.now() - t0;
    cost.ms += ms; cost.frames++; cost.msMax = Math.max(cost.msMax, ms); cost.awake = awake;
    cost.last = ms;
  }

  const stats = () => ({
    tris: Math.round((up.count() + rub.count() + floor.count()) / 3),
    sapTris: Math.round((sapMesh.geometry.index ? sapMesh.geometry.index.count : 0) / 3),
    moverTris: Math.round(parts.reduce((a, p) => a + p.tris, 0) + chainState.tris),
    movers: parts.length, chains: chainList.length, blockers: runs.length, awake,
    ms: cost.frames ? +(cost.ms / cost.frames).toFixed(4) : 0, msMax: +cost.msMax.toFixed(3),
    msLast: cost.last != null ? +cost.last.toFixed(4) : 0,
  });
  /** Which part is in reach in front of you: { i, at, d }, or null. */
  function aim(x, z, fx, fz, any = false, reach = 1.6) {
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    let best = null;
    parts.forEach((p, i) => {
      const cands = p.kind === 'seesaw' ? [p.sim.end(-1, [0, 0, 0]), p.sim.end(1, [0, 0, 0])]
        : [hitPoint(p, [0, 0, 0])];
      for (const at of cands) {
        const dx = at[0] - x, dz = at[2] - z, d = Math.hypot(dx, dz);
        if (d > reach + (p.kind === 'nest' ? 0.4 : 0)) continue;
        if (!any && d > 0.05 && (dx * fx + dz * fz) / d < 0.3) continue;
        if (!best || d < best.d) best = { i, at, d, kind: p.kind };
      }
    });
    return best;
  }
  const swingAngle = (p) => {
    const at = hitPoint(p, [0, 0, 0]), H = p.H;
    const dx = at[0] - H[0], dy = at[1] - H[1], dz = at[2] - H[2];
    return Math.atan2(dx * p.Z[0] + dz * p.Z[2], -dy);
  };

  return {
    meshes: [upMesh, rubMesh, floorMesh, sapMesh, chainMesh, ...parts.filter((p) => p.mesh).map((p) => p.mesh)],
    casters: [upMesh],
    trees: [sapMesh],
    movers: [chainMesh, ...parts.filter((p) => p.mesh).map((p) => p.mesh)],
    parts,
    blockers: runs.length,
    tick,
    stats,
    floor: floorY,
    bouncer,
    /** Which part a press from (x, z) facing (fx, fz) would push, or null. */
    aim,
    /** The press: shove part `a.i` (from `aim`) along (fx, fz). */
    press: (a, fx, fz) => {
      const p = parts[a.i];
      const fl = Math.hypot(fx, fz) || 1;
      // With her on it, a push worth her weight (1.562.0, PGH).
      if (p.her) p.her.pushedAt = herClock;
      return shove(p, a.at, fx / fl, fz / fl, p.her ? herShove(p) : SHOVE[p.kind] || 4);
    },
    /** And held: a steady push for dt. */
    hold: (a, fx, fz, dt) => {
      const p = parts[a.i];
      const fl = Math.hypot(fx, fz) || 1;
      const at = p.kind === 'seesaw' ? a.at : hitPoint(p, [0, 0, 0]);
      if (p.her) p.her.pushedAt = herClock;
      return shove(p, at, fx / fl, fz / fl, (p.her ? herHold(p) : HOLD[p.kind] || 30) * dt);
    },
    /** Baye on the kit (1.562.0) — see `HER ON IT`. */
    her,
    /**
     * Debug: kick part i (all if i < 0) — v m/s along its swing (z of its
     * hinge frame) for a seat, the nest, the rope and the rider; the +z end
     * down for the seesaw; down for a bed.
     */
    push(i, v) {
      parts.forEach((p, k) => {
        if (i >= 0 && k !== i) return;
        if (p.kind === 'tramp') { p.sim.poke(v); return; }
        if (p.kind === 'seesaw') { const e = p.sim.end(1, [0, 0, 0]); p.sim.impulse(p.sim.body, e, [0, -25 * v, 0]); return; }
        const b = p.kind === 'rope' ? p.sim.links[0].ids[3] : p.sim.body;
        const m = p.kind === 'rope' ? 1 : p.sim.net.mass[b] + 1;
        p.sim.impulse(b, hitPoint(p, [0, 0, 0]), [p.Z ? p.Z[0] * v * m : v * m, 0, p.Z ? p.Z[2] * v * m : 0]);
      });
      return parts.length;
    },
    list: () => parts.map((p, k) => {
      const at = p.kind === 'seesaw' ? p.c : hitPoint(p, [0, 0, 0]);
      const ts = jad.local(at[0], at[2]);
      const o = { i: k, kind: p.kind, t: +ts[0].toFixed(2), s: +ts[1].toFixed(2), y: +at[1].toFixed(3),
        awake: !p.sim.asleep };
      if (p.kind === 'tramp') { o.dip = +p.sim.dip().toFixed(3); o.on = p.sim.on; o.phase = p.sim.phase; }
      else if (p.kind === 'seesaw') o.th = +p.sim.angle().toFixed(3);
      else if (p.kind !== 'rider') o.th = +swingAngle(p).toFixed(3);
      if (p.mesh && p.kind !== 'tramp' && p.kind !== 'seesaw') {
        // How far it has turned about the vertical off how it was hung.
        const n = p.sim.net, b = p.sim.body;
        const xv = pgRot([n.Q[4 * b], n.Q[4 * b + 1], n.Q[4 * b + 2], n.Q[4 * b + 3]], [1, 0, 0]);
        o.yaw = +(Math.atan2(xv[0] * p.Z[0] + xv[2] * p.Z[2], xv[0] * p.X[0] + xv[2] * p.X[2])).toFixed(3);
      }
      o.msLast = +p.sim.stats.msLast.toFixed(4);
      if (p.her) o.her = true;
      if (p.kind === 'rider') {
        const n = p.sim.net, b = p.sim.body;
        const yv = pgRot([n.Q[4 * b], n.Q[4 * b + 1], n.Q[4 * b + 2], n.Q[4 * b + 3]], [0, 1, 0]);
        o.tilt = +Math.acos(Math.min(1, yv[1])).toFixed(3);
      }
      if (p.sim.net.measure) o.stretch = +p.sim.net.measure().maxStretch.toFixed(5);
      return o;
    }),
    /** The beds: who is on which, how far down, the last bounces. */
    beds: () => tramps.map((p) => ({ on: p.sim.on, phase: p.sim.phase, dip: +p.sim.dip().toFixed(3),
      top: +p.top.toFixed(3), ...p.sim.st, feet: onBed === p ? +bedFeet.toFixed(3) : null })),
    /** For tests: the (t, s) of the three sites, and B's gate. */
    sites: { B: [(G.t0 + G.t1) / 2, (G.s0 + G.s1) / 2], A: [383, 24], pong: [552.5, pongS],
      gate: [(PG.fence.gate[0] + PG.fence.gate[1]) / 2, PG.fence.s0] },
  };
}
