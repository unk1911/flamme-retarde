// -----------------------------------------------------------------------------
// The plunge: up the skakaonica's ladder yourself, out along the board, and off.
//
// Misha, 27 Sep 2026: *"i would like to be able to swim up to the trampouline,
// and go up the ladder just like that diver, and also dive from the board...
// is this something that we can use that awesome AVBD effects.. like i might
// bounce off the board a few times to increase the trajectory of my jump or do
// some cool acrobatics for my dive/jump.. would be cool to use 'B' or whatever
// to see myself (Chloe) from different angles as i execute this dive"*.
//
// The man who lives on that board (the diver in 43-jadrija.js) is a baked
// clip: his board bends by a table dive.py wrote. Hers cannot be a table,
// because nobody knows in advance when she will press the key. So her board is
// the real thing — four planks of the cantilever from the fulcrum to the tip,
// each an AVBD rigid body, jointed end to end by hard ball sockets with a
// torsional spring in each (the reference's finite `stiffnessAng`), and her on
// top of it as a fifth body hung off the plank under her foot by a stiff
// spring whose rest length is her LEG. See `plungeBoard` for the numbers.
//
// What that buys is the springboard's one trick, for free and not scripted:
// the board stores what she drops into it and gives it back on the way up, and
// if she straightens her legs while it is at the bottom she puts work into it
// on top. Time the push with the landing and every bounce is higher than the
// last; push late, at the top of the recoil, and there is nothing under the
// foot to push against and the bounce dies. Nothing below knows about
// "pumping" — it is ∫F·dL, and F is largest at the bottom.
//
// Three things are NOT physics, and are said so where they are: the climb (a
// scripted gait with every hand and foot IK'd on to a rung), the in-air body
// (angular momentum conserved by hand — L fixed at takeoff, ω = L / I(shape)),
// and the water (at the surface it hands over to 59-swim.js, which is the
// whole of what happens to a person in this sea).
//
// Two modules: the simulation alone (`plungeBoard`, `plungeRider` — no THREE,
// so a probe can build one in Node and bounce on it), and the game half
// (`buildPlunge`) which places it on the tower, poses her and holds the camera.
// -----------------------------------------------------------------------------

const PLUNGE = {
  // ── the board ─────────────────────────────────────────────────────────────
  // The cantilever only, fulcrum (the newer block's bearer, DIVE_FULCRUM) to
  // tip (DIVE_TIP): 3.04 m. The plank behind the fulcrum lies on concrete and
  // does not move, so it is not simulated.
  board: {
    segs: 4,
    // kg, the four planks together. A 3 m aluminium springboard is ~90 kg over
    // its 4.9 m; the part past the fulcrum is about half of it.
    mass: 44,
    // N·m², the bending stiffness. Chosen for the stiffness at the tip, which
    // is the number anybody who has stood on one can feel: 3EI/L³ = 6.8 kN/m,
    // against dive.py's K_LAND of 8 kN/m under an 80 kg man a little back
    // from the tip. Her 55 kg standing still at the tip sags it 8 cm;
    // pumped, the tip goes 0.55 m down and 0.2 m up, and the hard joints
    // open 6 mm at the worst of it (the guard trips at 15).
    // MEASURED in Node on this solve.
    EI: 65000,
    thick: 0.09, width: 0.80,
    // The solve. 240 Hz and not the hammock's 120, because the implicit Euler
    // the whole solver is takes ω²h/2 of the swing out every second: at 120 Hz
    // that is a third of a board-and-diver bounce gone per second, which is a
    // board made of wet cardboard. At 240 it is under a fifth — about what a
    // real one loses.
    sub: 1 / 240, iterations: 10, alpha: 0.95, gamma: 0.999,
    // The angle springs are finite, and a finite penalty ramps to its
    // stiffness by `betaAng`·|C| an iteration (see (4) over `avbdNet`); at the
    // hammock's 100 it would take thousands of steps to become the spring it
    // says it is. At 1e9 it is the spring by the first iteration.
    betaAng: 1e9, beta: 1e5,
  },
  // ── her ───────────────────────────────────────────────────────────────────
  her: {
    mass: 55,
    // N/m, the leg as a spring from her centre to the board. Stiff, so that
    // it is a leg and not a pogo stick: 1 cm under her own weight, and the
    // mode between her and the plank (42 rad/s) is gone in a tenth of a
    // second. What is left is the board and her riding it together.
    legK: 1e5,
    // Pelvis over the soles, m — Chloe's own numbers off the rig: 0.928
    // standing straight in `idle`. Soft knees, the deep crouch a diver loads
    // from, and up on the toes with the arms thrown at the sky.
    stand: 0.90, crouch: 0.72, reach: 1.00,
    // The push: down into the crouch, then straightened on a curve that is
    // still accelerating when it stops — so the leg leaves at its fastest,
    // 2·ΔL/T = 3.5 m/s off a floor that does not move.
    crouchT: 0.14, pushT: 0.16,
    // And off a landing: down into the same crouch as the board takes her
    // down, and straightened on its way up. MEASURED in Node on the solve
    // itself, pressing a tenth of a second before each landing, standing
    // 0.14 m from the tip: takeoffs of 3.0, 4.6, 5.1, 5.5, 6.1 m/s and then
    // a plateau at 5.8 — at 30 fps and at 60 to within 0.1. A shallower
    // give (0.84 over 0.12 s, the "stiff legs" a diving coach asks for)
    // stalled at 3.3: this board is softer than a competition one and it
    // is the stroke that pumps it. Pressed late, a quarter second after
    // landing, the same board gives 0.7 to 2.4 and never builds.
    absorb: 0.72, absorbT: 0.14, driveT: 0.16,
    // A press this long before she lands counts from the landing. The press a
    // person makes for "bounce as I land" is always a little early.
    buffer: 0.22,
    walk: 1.1,           // m/s along the plank
    // What a dive takes off with besides the board. Leaning into it carries
    // her out over the water — a forward dive travels a metre and a half from
    // the tip — and it is where the somersault comes from: the board pushes
    // on feet that are behind her centre. rad/s, laid out straight; tucked it
    // is 3.3 times that. Scaled by how hard she left the board (see `spinAt`).
    lean: 0.95, leanRev: 0.75,
    spin: 2.3, spinRev: -2.1, spinAt: 5.0,
    // Her moment about the somersault axis, as a fraction of laid-out: a pike
    // folds her in half (0.5), a tuck makes her a ball (0.3). So the same
    // angular momentum is 2x and 3.3x the spin. And how fast she changes
    // shape — the ω follows it, that is the whole point.
    iPike: 0.5, iTuck: 0.3, shapeT: 0.18,
    twist: 5.5,          // rad/s about her long axis while A/D is held
  },
};

/**
 * The springboard, as an AVBD net. Its own frame: x along the board from the
 * fulcrum, y up, z across; the origin is the fulcrum at the plank's middle
 * depth. No THREE in it.
 *
 * Four planks, ball-jointed hard at their ends, each joint a torsional spring
 * of EI/l (the root, which carries half a plank's worth of beam, 2EI/l): the
 * discrete beam, whose tip stiffness comes out at 3EI/L³ to within a few per
 * cent. The root joint hangs off a world point with the angle lock held to
 * level. Her, a fifth body, is held to the plank under her foot by one
 * spring — `leg` — whose rest length is how straight her legs are.
 */
function plungeBoard() {
  const B = PLUNGE.board, H = PLUNGE.her;
  const n = B.segs, L = 3.04, l = L / n, t = B.thick, w = B.width;
  const net = avbdNet({
    maxBodies: n + 1, maxJoints: n, maxStrings: n, maxPoints: 1, maxBoxes: 0,
    maxCaps: 1, maxContacts: 4, pointsHitCaps: false,
    iterations: B.iterations, alpha: B.alpha, alphaContact: 0.9, beta: B.beta,
    betaAng: B.betaAng, gamma: B.gamma, gravity: [0, -9.81, 0], drag: 0,
    vMax: 25, wMax: 80, margin: 0.01, deep: 0.05, mu: 0.5, floorMu: 0.5, capK: 1e4,
  });
  const mS = B.mass / n;
  const seg = [];
  for (let i = 0; i < n; i++) {
    seg.push(net.addBody(mS, [mS * (t * t + w * w) / 12, mS * (l * l + w * w) / 12,
      mS * (l * l + t * t) / 12, 0, 0, 0], (i + 0.5) * l, 0, 0));
  }
  net.addJoint(-1, [0, 0, 0], seg[0], [-l / 2, 0, 0], Infinity, 2 * B.EI / l, 1);
  for (let i = 1; i < n; i++) {
    net.addJoint(seg[i - 1], [l / 2, 0, 0], seg[i], [-l / 2, 0, 0], Infinity, B.EI / l, 1);
  }
  const her = net.addBody(H.mass, [4, 4, 4, 0, 0, 0], 0, 1, 0);
  const leg = seg.map((s) => net.addString(s, [0, t / 2, 0], her, [0, 0, 0], H.stand, H.legK));
  net.finish();
  for (const s of leg) net.setString(s, null, null, false);
  net.setLive(her, false);
  const P = net.P, Q = net.Q, V = net.V, W = net.W;

  // Rotate v by body i's attitude.
  const rot = (i, x, y, z, out) => {
    const qx = Q[4 * i], qy = Q[4 * i + 1], qz = Q[4 * i + 2], qw = Q[4 * i + 3];
    const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
    out[0] = x + qw * tx + (qy * tz - qz * ty);
    out[1] = y + qw * ty + (qz * tx - qx * tz);
    out[2] = z + qw * tz + (qx * ty - qy * tx);
    return out;
  };
  const _r = [0, 0, 0];
  const segOf = (x) => Math.max(0, Math.min(n - 1, Math.floor(x / l)));
  /** The top of the board at x along it, and how fast it is going up: [y, vy]. */
  function surface(x, out = [0, 0]) {
    if (x < 0) { out[0] = t / 2; out[1] = 0; return out; }
    const i = segOf(x), b = seg[i];
    rot(b, x - (i + 0.5) * l, t / 2, 0, _r);
    out[0] = P[3 * b + 1] + _r[1];
    // v + ω × r, the y of it.
    out[1] = V[3 * b + 1] + (W[3 * b + 2] * _r[0] - W[3 * b] * _r[2]);
    return out;
  }
  // The leg: which plank it stands on, where on it, and how long it is.
  let footX = 0, legLen = H.stand, on = false, cur = -1;
  function hang(x, len) {
    footX = x; legLen = len;
    const i = segOf(x);
    if (i !== cur && cur >= 0) net.setString(leg[cur], null, null, false);
    cur = i;
    net.setString(leg[i], [x - (i + 0.5) * l, t / 2, 0], len, true);
  }
  /** Her on to it, centre at height y moving at vy, foot at x. */
  function mount(x, y, vy) {
    const s = surface(x);
    net.setLive(her, true);
    net.place(her, x, y, 0, [0, 0, 0, 1]);
    net.kick(her, 0, vy, 0);
    on = true;
    hang(x, Math.max(0.3, y - s[0]));
  }
  function unmount() {
    if (cur >= 0) net.setString(leg[cur], null, null, false);
    cur = -1; on = false;
    net.setLive(her, false);
  }

  // ── the guard, the hammock's (see `wrong` in 43-hammock.js) ──────────────
  // A hard joint open past 15 mm, anything faster than 20 m/s, a plank more
  // than a metre off where it hangs, or her further from her foot than a leg:
  // back to the snapshot of a quarter to half a second ago, at rest, with the
  // multipliers cold. And if it goes wrong three times in four seconds, the
  // board goes back to how it was built and she is put on it standing still.
  const snaps = [0, 1].map(() => ({ P: new Float64Array(P.length), Q: new Float64Array(Q.length), ok: false }));
  const restP = new Float64Array(P.length), restQ = new Float64Array(Q.length);
  let snapT = 0, simT = 0, trips = [];
  const stats = { steps: 0, rescues: 0, bails: 0, why: '', ms: 0 };
  function sane() {
    for (let i = 0; i < n; i++) {
      const b = seg[i];
      if (!Number.isFinite(P[3 * b + 1]) || Math.abs(P[3 * b + 1]) > 1.0
        || Math.abs(P[3 * b] - (i + 0.5) * l) > 0.5) { stats.why = 'far ' + i; return false; }
      if (Math.hypot(V[3 * b], V[3 * b + 1], V[3 * b + 2]) > 20) { stats.why = 'fast ' + i; return false; }
    }
    if (on) {
      const s = surface(footX);
      const d = P[3 * her + 1] - s[0];
      if (!Number.isFinite(d) || d < 0.2 || d > legLen + 0.3) { stats.why = 'leg ' + d; return false; }
    }
    net.measure();
    if (net.stats.maxStretch >= 0.015) { stats.why = 'open ' + net.stats.maxStretch.toFixed(4); return false; }
    return true;
  }
  function putBack(sp, sq) {
    for (let i = 0; i < n; i++) {
      const b = seg[i];
      net.place(b, sp[3 * b], sp[3 * b + 1], sp[3 * b + 2],
        [sq[4 * b], sq[4 * b + 1], sq[4 * b + 2], sq[4 * b + 3]]);
    }
    net.resetDuals();
    if (on) {
      const s = surface(footX);
      net.place(her, footX, s[0] + legLen, 0, [0, 0, 0, 1]);
    }
  }
  function wrong() {
    stats.rescues++;
    trips = trips.filter((x) => simT - x < 4);
    trips.push(simT);
    const old = snaps.find((sn) => sn.ok);
    if (trips.length < 3 && old) { putBack(old.P, old.Q); for (const sn of snaps) sn.ok = false; return; }
    stats.bails++;
    putBack(restP, restQ);
    for (const sn of snaps) sn.ok = false;
    trips = [];
  }

  /**
   * One step of h seconds. Returns true if she came off it this step — the
   * leg went into tension with her going up faster than the board under her,
   * which is the moment a real foot leaves a real board.
   */
  function step(h) {
    const t0 = performance.now();
    if (on) hang(footX, legLen);
    net.step(h);
    stats.steps++;
    simT += h;
    let left = false;
    if (on) {
      // Her along the board and across it are the walk's, not the solve's:
      // the leg is one spring standing up out of the plank, which on its own
      // is an inverted pendulum. The solve owns her height.
      const s = surface(footX);
      P[3 * her] = footX; P[3 * her + 2] = 0; V[3 * her] = 0; V[3 * her + 2] = 0;
      Q[4 * her] = 0; Q[4 * her + 1] = 0; Q[4 * her + 2] = 0; Q[4 * her + 3] = 1;
      W[3 * her] = 0; W[3 * her + 1] = 0; W[3 * her + 2] = 0;
      const stretch = P[3 * her + 1] - s[0] - legLen;
      // And going UP. A board that drops away faster than she falls leaves
      // her foot too, for a few hundredths of a second, and a hop of 3 mm
      // with her falling is not a takeoff anybody wants drawn.
      if (stretch > 0.002 && V[3 * her + 1] > s[1] + 0.05 && V[3 * her + 1] > 0.4) left = true;
    }
    if (!sane()) wrong();
    else {
      snapT += h;
      if (snapT >= 0.25) {
        snapT = 0;
        const sn = snaps.shift();
        sn.P.set(P); sn.Q.set(Q); sn.ok = true;
        snaps.push(sn);
      }
    }
    stats.ms += performance.now() - t0;
    return left;
  }

  /**
   * How far the empty board already hangs below level at x, m, positive —
   * its own weight, 2.5 cm at the tip. Drawn, the plank is the mesh as built,
   * straight; so her place on it is the solve's plus this.
   */
  function sag(x) {
    if (x <= 0) return 0;
    const xx = Math.min(x, L), i = segOf(xx), u = Math.min(1, (xx - i * l) / l);
    const y0 = restNode[i], y1 = restNode[i + 1];
    const m0 = (i === 0 ? restSlope[0] : 0.5 * (restSlope[i - 1] + restSlope[i])) * l;
    const m1 = (i === n - 1 ? restSlope[n - 1] : 0.5 * (restSlope[i] + restSlope[i + 1])) * l;
    const u2 = u * u, u3 = u2 * u;
    return -((2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0
      + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1);
  }
  /** The tip: [deflection from the empty board's hang, m; its vertical speed]. */
  function tip(out = [0, 0]) {
    surface(L - 1e-6, out);
    out[0] -= restTip;
    return out;
  }
  // The shape, for drawing: the joint heights and the plank slopes, as they
  // stand and minus the empty board's own sag — so an empty board draws flat,
  // which is how the mesh was built and how the diver's table bends it.
  const nodeY = new Float64Array(n + 1), slope = new Float64Array(n);
  const restNode = new Float64Array(n + 1), restSlope = new Float64Array(n);
  function readShape(ny, sl) {
    ny[0] = 0;
    for (let i = 0; i < n; i++) {
      const b = seg[i];
      rot(b, l / 2, 0, 0, _r);
      ny[i + 1] = P[3 * b + 1] + _r[1];
      sl[i] = Math.atan2(_r[1], _r[0]);
    }
  }
  /**
   * The deflection at x along the board, m, down negative. Hermite through
   * the joints with each joint's slope the mean of the planks either side, so
   * the drawn plank is a smooth curve and not four sticks — and level at the
   * fulcrum, where the plank lies on the bearer and on the concrete behind
   * it. The solve has its root spring there, and drawn honestly that is a
   * kink in the plank over the bearer, which on a loaded board read as a step
   * (seen at 25 cm down). What that costs: 0.148 of the root's turn times
   * a plank, a third of the way along the first plank — MEASURED 8 mm at
   * the worst of a pump to 6 m/s (the root turns 0.073 rad), and nowhere
   * she stands to bounce.
   */
  function deflect(x) {
    if (x <= 0) return 0;
    const i = segOf(x), u = Math.min(1, (x - i * l) / l);
    const y0 = nodeY[i] - restNode[i], y1 = nodeY[i + 1] - restNode[i + 1];
    const sI = (k) => slope[k] - restSlope[k];
    const m0 = (i === 0 ? 0 : 0.5 * (sI(i - 1) + sI(i))) * l;
    const m1 = (i === n - 1 ? sI(n - 1) : 0.5 * (sI(i) + sI(i + 1))) * l;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0
      + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1;
  }

  // Settle the empty board for two seconds, and call that its rest.
  for (let k = 0; k < 480; k++) net.step(B.sub);
  for (let i = 0; i < n; i++) net.place(seg[i], P[3 * seg[i]], P[3 * seg[i] + 1], P[3 * seg[i] + 2],
    [Q[4 * seg[i]], Q[4 * seg[i] + 1], Q[4 * seg[i] + 2], Q[4 * seg[i] + 3]]);
  restP.set(P); restQ.set(Q);
  readShape(restNode, restSlope);
  const restTip = surface(L - 1e-6)[0];
  stats.steps = 0;

  return {
    net, L, l, n, thick: t, stats,
    surface, mount, unmount, step, tip, deflect, sag,
    /** Move the foot, and set the leg. */
    foot: (x, len) => { footX = x; legLen = len; },
    get on() { return on; },
    get footX() { return footX; },
    get legLen() { return legLen; },
    /** Her centre's height and speed while she is on it. */
    her: () => [P[3 * her + 1], V[3 * her + 1]],
    /** Refresh the drawn shape; returns the biggest deflection, m. */
    shape: () => {
      readShape(nodeY, slope);
      let m = 0;
      for (let k = 1; k <= n; k++) m = Math.max(m, Math.abs(nodeY[k] - restNode[k]));
      return m;
    },
    /** How much it is still moving: the fastest plank, m/s. */
    moving: () => {
      let v = 0;
      for (const b of seg) v = Math.max(v, Math.abs(V[3 * b + 1]));
      return v;
    },
    /** Back to hanging empty, as built. */
    reset: () => { unmount(); putBack(restP, restQ); for (const sn of snaps) sn.ok = false; },
    /** Debug: throw the planks, to watch the guard catch it. */
    blowUp: (v = 30) => { for (const b of seg) net.kick(b, 0, v, 0); },
  };
}

/**
 * Her, on the board and off it: the state machine that owns her centre of
 * mass along the plank and up, and the leg. Also no THREE — driven by `ctl`
 * each frame ({ fwd, side, jump (a press this frame), lean: 1 | -1 | 0 }).
 *
 * `u` is along the plank in the board's frame, fulcrum at 0 (negative is the
 * part lying on the concrete, which does not move); `y` is her centre above
 * the plank's middle depth.
 *
 *   stand   on the plank. On the concrete her height is the leg's; on the
 *           cantilever she is in the net and the net's.
 *   air     ballistic.
 */
function plungeRider(board, o = {}) {
  const H = PLUNGE.her;
  const back = o.back != null ? o.back : -2.2;      // the end of the plank on the deck
  const tipX = board.L;
  const r = {
    mode: 'stand', u: o.u != null ? o.u : back + 0.3, y: 0, vy: 0, vu: 0,
    leg: H.stand, push: -1, pressT: -9, t: 0,
    // What the last takeoff was, and the one before it: for the pump's
    // measurement and the HUD.
    takeoffs: [], lastTakeoff: null, landV: 0,
  };
  r.y = board.thick / 2 + r.leg;
  const s2 = [0, 0];
  // The push profile: the leg's rest length `k` seconds into it — down into
  // the crouch on a smoothstep, then straightened on a curve that is still
  // accelerating when it stops. From standing and off a landing it is the
  // same stroke today (see `absorb`); they are two sets of numbers because
  // the landing is the one worth tuning.
  function pushLeg(k, from) {
    const low = r.pushLand ? H.absorb : H.crouch;
    const T0 = r.pushLand ? H.absorbT : H.crouchT, T1 = r.pushLand ? H.driveT : H.pushT;
    if (k < T0) {
      const a = k / T0, e = a * a * (3 - 2 * a);
      return from + (low - from) * e;
    }
    const a = Math.min(1, (k - T0) / T1);
    return low + (H.reach - low) * a * a;
  }
  const pushEnd = () => (r.pushLand ? H.absorbT + H.driveT : H.crouchT + H.pushT);
  let pushFrom = H.stand;
  function startPush(land = false) { r.push = 0; pushFrom = r.leg; r.pushLand = land; }

  function takeoff(vy, lean) {
    r.mode = 'air';
    r.vy = vy;
    const L = lean > 0 ? H.lean : lean < 0 ? H.leanRev : 0;
    r.vu = r.vu + L;
    const k = Math.max(0.5, Math.min(1.4, vy / H.spinAt));
    r.spin0 = lean > 0 ? H.spin * k : lean < 0 ? H.spinRev * k : 0;
    r.lean = lean;
    r.push = -1;
    r.leg = H.reach;
    r.lastTakeoff = { vy: +vy.toFixed(3), u: +r.u.toFixed(2), t: +r.t.toFixed(2),
      tip: +board.tip()[0].toFixed(3), lean };
    r.takeoffs.push(r.lastTakeoff);
    if (r.takeoffs.length > 24) r.takeoffs.shift();
    return 'takeoff';
  }

  /** One frame. Returns an event string or null: 'takeoff', 'land', 'off' (past the tip). */
  function update(dt, ctl) {
    const B = PLUNGE.board;
    r.t += dt;
    let ev = null;
    if (ctl.jump) r.pressT = r.t;
    if (r.mode === 'stand') {
      // Walk, unless she is in the middle of a push.
      if (r.push < 0) {
        r.vu = (ctl.fwd || 0) * H.walk;
        // `gate` is how far along she may go: the man who dives from here is
        // on the plank, or about to be — see `diveHeld` in 43-jadrija.js.
        const hi = Math.min(tipX - 0.10, r.gate != null ? r.gate : 1e9);
        const nu = Math.max(back, Math.min(Math.max(hi, Math.min(r.u, tipX - 0.10)), r.u + r.vu * dt));
        if (nu === hi || nu === back) r.vu = 0;
        r.u = nu;
      }
      if (ctl.jump && r.push < 0) startPush();
      // The leg: the push, or back to soft knees. On the cantilever this is
      // done a substep at a time inside the loop below, because the leg is
      // stiff and the board is quick: stepped once a frame it came out a
      // different board at 30 fps than at 60 (MEASURED — the same pump from
      // the same spot took off at 3.0, 4.6, 5.1, 5.5, 6.2 m/s at 60 and at
      // 1.5, 2.7, 4.4, 4.3, 2.8 at 30). Substepped the two agree to 0.1.
      const legStep = (h) => {
        if (r.push >= 0) {
          r.push += h;
          r.leg = pushLeg(r.push, pushFrom);
        } else {
          r.leg += (H.stand - r.leg) * (1 - Math.exp(-h / 0.12));
        }
      };
      const onBoard = r.u >= 0;
      if (!onBoard) legStep(dt);
      if (onBoard && !board.on) {
        board.surface(r.u, s2);
        board.mount(r.u, s2[0] + r.leg, 0);
      } else if (!onBoard && board.on) board.unmount();
      if (onBoard) {
        // The substeps. Her leaving is the net's call, not a timer's.
        let acc = dt, left = false;
        while (acc > 1e-9 && !left) {
          const h = Math.min(B.sub, acc);
          legStep(h);
          board.foot(r.u, r.leg);
          left = board.step(h);
          acc -= h;
        }
        const hv = board.her();
        r.y = hv[0]; r.vy = hv[1];
        if (left) {
          board.unmount();
          ev = takeoff(r.vy, ctl.lean || 0);
        } else if (r.push >= pushEnd() + 0.25) {
          // Straightened and still on it: the board was going down under her
          // the whole time, so there was nothing to leave from. Soft knees.
          r.push = -1;
        }
      } else {
        // On concrete the leg is the whole story: her centre is where it
        // puts her, and at the end of the push she leaves at its speed.
        const prev = r.y;
        r.y = board.thick / 2 + r.leg;
        r.vy = (r.y - prev) / Math.max(dt, 1e-4);
        if (r.push >= pushEnd()) {
          const low = r.pushLand ? H.absorb : H.crouch, T1 = r.pushLand ? H.driveT : H.pushT;
          ev = takeoff(2 * (H.reach - low) / T1, ctl.lean || 0);
        }
        stepFree(dt);
      }
    } else {
      // In the air. The board carries on ringing on its own.
      stepFree(dt);
      r.u += r.vu * dt;
      r.vy -= 9.81 * dt;
      r.y += r.vy * dt;
      // Down on to the plank?
      if (r.vy < 0 && r.u >= back && r.u <= tipX && r.canLand !== false) {
        board.surface(r.u, s2);
        if (r.y - H.reach <= s2[0]) {
          r.mode = 'stand';
          r.landV = r.vy;
          r.vu = 0;
          r.leg = H.reach;
          if (r.u >= 0) board.mount(r.u, s2[0] + r.leg, r.vy);
          else { r.y = s2[0] + r.leg; r.vy = 0; }
          ev = 'land';
          // A press just before the landing is a press for it.
          if (r.t - r.pressT < H.buffer) startPush(true);
          else r.push = -1;
        }
      } else if (r.u > tipX && r.y - H.reach < board.thick / 2) ev = ev || 'off';
    }
    return ev;
  }
  // The board without her on it, for as long as she is off it.
  function stepFree(dt) {
    let acc = dt;
    while (acc > 1e-9) { const h = Math.min(PLUNGE.board.sub, acc); board.step(h); acc -= h; }
  }
  r.update = update;
  r.stepFree = stepFree;
  r.startPush = startPush;
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// The game half: the tower, her body on it, and the cameras.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The climb, as a gait and not as a clip.
 *
 * The diver's `ladder` clip is his: baked on his skeleton by dive.py with
 * every hand and foot IK'd on to a rung, and a woman 20 cm shorter played
 * through it would hold the rungs in the air. So hers is the same idea solved
 * here, every frame, on her own bones: where each hand and foot is is a rung,
 * and the arm and the leg are a two-bone IK in her sagittal plane on to it
 * (`ik`, below). Poses are solved, not typed — what is typed is the gait:
 * diagonal pairs (right hand with left foot), each limb up two rungs while the
 * other pair holds, the body rising between them.
 */
const PLUNGE_CLIMB = {
  grab: 1.0,       // s, from treading at the foot to hands and feet on it
  level: 0.55,     // s a rung
  levels: 7,       // bottom rung to top rung, for the feet
  mantle: 1.4,     // s, over the lip on to the deck
  cross: 1.1,      // s, the step across on to the plank
  turn: 0.7,       // s, and round to face the tip
  // m her pelvis stands off the rungs, and how far she leans back from
  // them, rad. 0.30 upright put her eyes ten centimetres from the rungs,
  // and her own eyes saw a grey blur and no hands; at 0.46, leaning back
  // eight degrees about her pelvis, her arms are nearly straight to the
  // rung above — which is how anybody not in a hurry climbs out of the sea —
  // and her eyes are 35 cm off it.
  off: 0.46, lean: 0.14,
  pelvis: 0.66,    // m her pelvis over the rung her standing level is on
  hands: 4,        // rungs her hands are over her feet
  reach: 2.2,      // m from the foot of the ladder that E starts it from
};
/** The bones this file poses, and nothing else. */
const PLUNGE_BONES = ['spine01', 'spine02', 'neck', 'legUL', 'legUR', 'legLL', 'legLR',
  'footL', 'footR', 'armUL', 'armUR', 'armLL', 'armLR'];
/**
 * Her centre of mass, off her own posed bones: de Leva's (1996) female
 * segment fractions on segment midpoints — the head at the head bone, the
 * trunk halfway from pelvis to neck. It is what the flight is ballistic about,
 * so a tuck moves her body round the parabola and not the parabola.
 */
const PLUNGE_MASS = [
  ['head', 'head', 0.067], ['pelvis', 'neck', 0.426],
  ['armUL', 'armLL', 0.0255], ['armUR', 'armLR', 0.0255],
  ['armLL', 'handL', 0.0138], ['armLR', 'handR', 0.0138],
  ['handL', 'fingersL', 0.0056], ['handR', 'fingersR', 0.0056],
  ['legUL', 'legLL', 0.1478], ['legUR', 'legLR', 0.1478],
  ['legLL', 'footL', 0.0481], ['legLR', 'footR', 0.0481],
  ['footL', 'toeL', 0.0129], ['footR', 'toeR', 0.0129],
];
/** The views B steps through while she is on the tower. See `camFor` below. */
const PLUNGE_CAMS = ['eyes', 'follow', 'judge', 'water', 'deck'];

/**
 * `jad` — the resort (its `dive` has the tower, see `frame` in 43-jadrija.js);
 * `you` — her body (49-you.js); `hooks` — what the app does for it: splash,
 * sound, toast.
 */
function buildPlunge(jad, you, hooks = {}) {
  const D = jad && jad.dive;
  if (!D || !D.frame || !you || !you.fig) return null;
  const F = D.frame, fig = you.fig, H = PLUNGE.her, C = PLUNGE_CLIMB;
  const board = plungeBoard();
  const UF = F.fulcrum;
  const rider = plungeRider(board, { back: F.back + 0.15 - UF, u: F.ladder.u - UF });
  // Headings, as `you.drive` wants them: the rig faces +X, and a yaw of θ
  // points it at (cos θ, −sin θ).
  const HEAD = Math.atan2(-F.axis.uz, F.axis.ux);       // along the plank, at the tip
  const INTO = Math.atan2(-F.axis.nz, F.axis.nx);       // at the ladder, from the sea
  const W = (u, v, y) => F.P(u, v, y);
  const sea = (x, z) => (typeof seaHeightAt === 'function' ? seaHeightAt(x, z) : 0);

  // ── her skeleton, as the planar FK the aims make of it ────────────────────
  //
  // `fig.aim` is a rotation in FIGURE space about the bone's own head, laid
  // on after the clip, and the children go with it. Every aim here is about
  // z, her lateral axis — the sagittal plane — so the aims down a chain simply
  // add, and where every bone ends up is a few lines of arithmetic on the
  // rest positions. That is `fk`; `ik` runs it backwards for one limb.
  const NB = fig.bones.length;
  const par = fig.bones.map((b) => b.parent);
  const bi = {};
  fig.bones.forEach((b, i) => { bi[b.name] = i; });
  const base = new Float64Array(3 * NB), fp = new Float64Array(3 * NB);
  const ang = new Float64Array(NB), Th = new Float64Array(NB);
  let based = false;
  const _v = new THREE.Vector3();
  /**
   * The rest pose everything is solved against: `idle`, frozen at its first
   * frame, no aims. Read once, off the figure, the first time it is wanted.
   */
  function capture() {
    for (const n of PLUNGE_BONES) fig.aim(n, 0, 0, 1, 0);
    fig.play('idle', { fade: 0 });
    fig.state.curT = 0;
    fig.state.speed = 0;
    fig.update(0);
    for (let i = 0; i < NB; i++) {
      fig.boneAt(i, _v);
      base[3 * i] = _v.x; base[3 * i + 1] = _v.y; base[3 * i + 2] = _v.z;
    }
    based = true;
  }
  function fk() {
    for (let i = 0; i < NB; i++) {
      const p = par[i];
      if (p < 0) {
        fp[3 * i] = base[3 * i]; fp[3 * i + 1] = base[3 * i + 1]; fp[3 * i + 2] = base[3 * i + 2];
        Th[i] = ang[i];
        continue;
      }
      const c = Math.cos(Th[p]), s = Math.sin(Th[p]);
      const dx = base[3 * i] - base[3 * p], dy = base[3 * i + 1] - base[3 * p + 1];
      fp[3 * i] = fp[3 * p] + c * dx - s * dy;
      fp[3 * i + 1] = fp[3 * p + 1] + s * dx + c * dy;
      fp[3 * i + 2] = fp[3 * p + 2] + base[3 * i + 2] - base[3 * p + 2];
      Th[i] = Th[p] + ang[i];
    }
  }
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /**
   * Two bones a → b → c, their end c on to (tx, ty) in figure space. `bend`
   * is which side of the line the middle joint goes: +1 is the knee forward
   * with the foot below, and the elbow back and down with the hand above.
   * Wants `fk` to have run for everything above `a`. Returns how far short
   * the limb fell, m.
   */
  function ik(a, b, c, tx, ty, bend) {
    a = bi[a]; b = bi[b]; c = bi[c];
    const pa = par[a];
    const ax = fp[3 * a], ay = fp[3 * a + 1];
    const b1x = base[3 * b] - base[3 * a], b1y = base[3 * b + 1] - base[3 * a + 1];
    const b2x = base[3 * c] - base[3 * b], b2y = base[3 * c + 1] - base[3 * b + 1];
    const l1 = Math.hypot(b1x, b1y), l2 = Math.hypot(b2x, b2y);
    const dx = tx - ax, dy = ty - ay, d0 = Math.hypot(dx, dy);
    const d = clamp(d0, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    const phi = Math.atan2(dy, dx);
    const A1 = phi + bend * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const kx = l1 * Math.cos(A1), ky = l1 * Math.sin(A1);
    const A2 = Math.atan2(d * Math.sin(phi) - ky, d * Math.cos(phi) - kx);
    const th0 = pa >= 0 ? Th[pa] : 0;
    ang[a] = wrapA(A1 - Math.atan2(b1y, b1x) - th0);
    ang[b] = wrapA(A2 - Math.atan2(b2y, b2x) - th0 - ang[a]);
    return Math.max(0, d0 - d);
  }
  function clearAng() { ang.fill(0); }
  function applyAims(w = 1) {
    for (const n of PLUNGE_BONES) {
      const a = ang[bi[n]] * w;
      fig.aim(n, 0, 0, 1, Math.abs(a) < 1e-3 ? 0 : a);
    }
  }
  function releaseAims() { for (const n of PLUNGE_BONES) fig.aim(n, 0, 0, 1, 0); }
  /** Her centre of mass in figure space, off `fp`. */
  function comFig(out) {
    let x = 0, y = 0, z = 0;
    for (const [a, b, m] of PLUNGE_MASS) {
      const i = bi[a], j = bi[b];
      x += m * 0.5 * (fp[3 * i] + fp[3 * j]);
      y += m * 0.5 * (fp[3 * i + 1] + fp[3 * j + 1]);
      z += m * 0.5 * (fp[3 * i + 2] + fp[3 * j + 2]);
    }
    out[0] = x; out[1] = y; out[2] = z;
    return out;
  }

  // ── the attitude ──────────────────────────────────────────────────────────
  const Q = new THREE.Quaternion(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  /** Heading, then the somersault about her lateral axis, then the twist about her long one. */
  function attitude(yaw, phi, psi) {
    Q.setFromAxisAngle(AY, yaw);
    // Forward is head over toes toward +x: about +z that is a negative turn.
    Q.multiply(_q.setFromAxisAngle(AZ, -phi));
    Q.multiply(_q.setFromAxisAngle(AY, psi));
    return Q;
  }
  const _p = new THREE.Vector3(), _c = [0, 0, 0];
  /** The figure's root, so that figure point f is at world w under attitude Q. */
  function rootFor(fx, fy, fz, wx, wy, wz) {
    _p.set(fx, fy, fz).applyQuaternion(Q);
    return [wx - _p.x, wy - _p.y, wz - _p.z];
  }
  /** World of a figure point, for a root `at` under Q. */
  function worldOf(at, fx, fy, fz, out) {
    _p.set(fx, fy, fz).applyQuaternion(Q);
    out[0] = at[0] + _p.x; out[1] = at[1] + _p.y; out[2] = at[2] + _p.z;
    return out;
  }
  /** A world point into figure space, for a root `at` under Q. */
  const _qi = new THREE.Quaternion();
  function toFig(at, w, out) {
    _qi.copy(Q).invert();
    _p.set(w[0] - at[0], w[1] - at[1], w[2] - at[2]).applyQuaternion(_qi);
    out[0] = _p.x; out[1] = _p.y; out[2] = _p.z;
    return out;
  }

  // ── state ─────────────────────────────────────────────────────────────────
  const st = {
    mode: 'off',            // off | climb | deck | under
    tau: 0,                 // s into the climb
    from: null,             // where the swimmer was, pelvis, world
    cam: 0,                 // index into PLUNGE_CAMS
    yawOff: 0, pitch: -0.15, // the mouse, in her own eyes
    orbYaw: 0, orbPitch: 0.22, orbD: 4.6,
    camAt: null,            // the smoothed third-person target
    phi: 0, psi: 0, L: 0, dir: 0, tuck: 0, pike: 0, tuckArmed: false,
    spinMax: 0, spinShape: null,
    B: [0, 0, 0], B0: [0, 0, 0], R0: [0, 0],
    at: [0, 0, 0], eye: [0, 0, 0], armWas: 0,
    under: 0, uv: [0, 0, 0],
    entry: null, entries: 0,
    gateSaid: false, ringing: false,
    script: null, scriptT: 0, scriptHeld: null, scriptEnd: 0, auto: null,
  };
  const pressed = { jump: false };
  const rung = (lvl) => F.ladder.rungs[7] + 0.30 * lvl;   // a rung's middle, by level from the bottom

  // ── the climb, as a function of time ──────────────────────────────────────
  // The body's standing level `f` (in rungs, 0 = the bottom one) rises
  // steadily; each limb's own level is a staircase on it — planted for the
  // first half of every two rungs, then up two over the second half.
  const stair = (f, ph) => {
    const g = (f + ph) / 2, k = Math.floor(g), fr = g - k;
    const a = clamp((fr - 0.5) / 0.5, 0, 1);
    return 2 * k - ph + 2 * a * a * (3 - 2 * a);
  };
  const lift = (f, ph) => {                  // how far off its rung a moving limb is, 0..1
    const g = (f + ph) / 2, fr = g - Math.floor(g);
    return fr > 0.5 ? Math.sin((fr - 0.5) / 0.5 * Math.PI) : 0;
  };
  const T_CLIMB = C.grab + C.level * C.levels;
  const T_MANTLE = T_CLIMB + C.mantle, T_CROSS = T_MANTLE + C.cross, T_TURN = T_CROSS + C.turn;
  const FOOT_V = F.ladder.face - 0.11;      // the ankle, with the ball of the foot on the rung
  const HAND_V = F.ladder.face - 0.05;
  const PELV_V = F.ladder.face - C.off;
  const DECK_V = F.ladder.deckIn - 0.08;    // where she stands up on the deck
  const U_L = F.ladder.u;
  // Her left, in u. She faces +v on the ladder; her left is her −z.
  _p.set(0, 0, -1).applyAxisAngle(AY, INTO);
  const LEFT_U = Math.sign(_p.x * F.axis.ux + _p.z * F.axis.uz) || 1;
  /** A hand on a level, [u, y, v]; above the top rung that is flat on the deck. */
  function handAt(lvl, side, out) {
    if (lvl <= C.levels) {
      out[0] = U_L + side * 0.17; out[1] = rung(lvl) + 0.02; out[2] = HAND_V;
    } else {
      out[0] = U_L + side * 0.20; out[1] = F.top + 0.04;
      out[2] = F.ladder.face + 0.12 + 0.10 * Math.min(1, lvl - C.levels);
    }
    return out;
  }
  function footAt(lvl, side, out) {
    out[0] = U_L + side * 0.10; out[1] = rung(lvl) + 0.018 + 0.075; out[2] = FOOT_V;
    return out;
  }
  const _h = [0, 0, 0], _f = [0, 0, 0], _t = [0, 0, 0], _w = [0, 0, 0];
  const pelvisBase = () => [base[3 * bi.pelvis], base[3 * bi.pelvis + 1], base[3 * bi.pelvis + 2]];
  /**
   * The whole of the climb at `tau`: sets `st.at` (her root), Q and the aims.
   * Returns the clip to play.
   */
  function climbPose(tau) {
    clearAng();
    let pel, yaw = INTO, clip = 'idle', ikW = 1, mant = -1;
    let hands = null, feet = null;
    if (tau < T_CLIMB) {
      const f = Math.max(0, (tau - C.grab) / C.level);
      const k = smoothstep(0, C.grab, tau);
      const p0 = st.from || W(U_L, PELV_V - 0.4, -0.45);
      const to = W(U_L, PELV_V, rung(f) + C.pelvis);
      pel = [lerp(p0[0], to[0], k), lerp(p0[1], to[1], k), lerp(p0[2], to[2], k)];
      ikW = k;
      // Diagonal pairs: her right hand with her left foot (phase 0).
      hands = [[stair(f, 1) + C.hands, -1, lift(f, 1)], [stair(f, 0) + C.hands, 1, lift(f, 0)]];
      feet = [[stair(f, 0), -1, lift(f, 0)], [stair(f, 1), 1, lift(f, 1)]];
    } else if (tau < T_MANTLE) {
      mant = (tau - T_CLIMB) / C.mantle;
      const e1 = smoothstep(0, 0.65, mant), e2 = smoothstep(0.25, 1, mant);
      pel = W(U_L, lerp(PELV_V, DECK_V, e2), lerp(rung(C.levels) + C.pelvis, F.top + 0.90, e1));
      hands = [[stair(C.levels, 1) + C.hands, -1, 0], [stair(C.levels, 0) + C.hands, 1, 0]];
    } else if (tau < T_CROSS) {
      const m = smoothstep(T_MANTLE, T_CROSS, tau);
      pel = W(U_L, lerp(DECK_V, 0, m), lerp(F.top + 0.90, F.plank + 0.90, m));
      clip = 'walk';
      ikW = 0;
    } else {
      const m = smoothstep(T_CROSS, T_TURN, tau);
      pel = W(U_L, 0, F.plank + 0.90);
      yaw = INTO + wrapA(HEAD - INTO) * m;
      ikW = 0;
    }
    // Leaning back off the rungs while she is on them; upright again as she
    // stands up on the deck.
    const lean = tau < T_CLIMB ? C.lean * smoothstep(0, C.grab, tau)
      : tau < T_MANTLE ? C.lean * (1 - smoothstep(0.2, 0.8, (tau - T_CLIMB) / C.mantle)) : 0;
    attitude(yaw, -lean, 0);
    const pb = pelvisBase();
    st.at = rootFor(pb[0], pb[1], pb[2], pel[0], pel[1], pel[2]);
    fk();
    if (ikW > 0) {
      const put = (lvl, side, up, isHand) => {
        const w = isHand ? handAt(lvl, side * LEFT_U, _h) : footAt(lvl, side * LEFT_U, _f);
        // Off the rung while it moves: back from the ladder and up.
        return toFig(st.at, W(w[0], w[2] - up * 0.10, w[1] + up * 0.06), _t);
      };
      if (hands) {
        let t = put(hands[0][0], hands[0][1], hands[0][2], true);
        ik('armUL', 'armLL', 'handL', t[0], t[1], 1);
        t = put(hands[1][0], hands[1][1], hands[1][2], true);
        ik('armUR', 'armLR', 'handR', t[0], t[1], 1);
      }
      if (feet) {
        let t = put(feet[0][0], feet[0][1], feet[0][2], false);
        ik('legUL', 'legLL', 'footL', t[0], t[1], 1);
        t = put(feet[1][0], feet[1][1], feet[1][2], false);
        ik('legUR', 'legLR', 'footR', t[0], t[1], 1);
      } else if (mant >= 0) {
        // Over the lip: each foot from its rung to the deck on an arc, the
        // left first; the hands let go in the second half.
        for (const [side, bu, bl, bf, a0, a1, ph] of [[-1, 'legUL', 'legLL', 'footL', 0.05, 0.50, 0],
          [1, 'legUR', 'legLR', 'footR', 0.40, 0.95, 1]]) {
          const k = smoothstep(a0, a1, mant);
          const r0 = footAt(stair(C.levels, ph), side * LEFT_U, [0, 0, 0]);
          const v1 = DECK_V + (side < 0 ? -0.12 : 0.02);
          const P = W(lerp(r0[0], U_L + side * LEFT_U * 0.10, k), lerp(r0[2], v1, k),
            lerp(r0[1], F.top + 0.067, k) + Math.sin(k * Math.PI) * 0.22);
          const t = toFig(st.at, P, _t);
          ik(bu, bl, bf, t[0], t[1], 1);
        }
        const go = 1 - smoothstep(0.45, 0.85, mant);
        for (const n of ['armUL', 'armLL', 'armUR', 'armLR']) ang[bi[n]] *= go;
      }
      fk();
    }
    applyAims(ikW);
    return clip;
  }

  // ── on the plank ──────────────────────────────────────────────────────────
  /** Her pelvis in the world while she is on the plank or over it. */
  function pelvisWorld(out) {
    const x = rider.u;
    const w = W(UF + x, 0, F.mid + rider.y + board.sag(clamp(x, 0, board.L)));
    out[0] = w[0]; out[1] = w[1]; out[2] = w[2];
    return out;
  }
  /** The plank's top under her, as drawn, world y. */
  const plankY = (x) => (x < 0 ? F.plank : F.plank + board.deflect(Math.min(x, board.L)));
  const _pel = [0, 0, 0], _s = [0, 0];
  function standPose(dt) {
    clearAng();
    const walking = Math.abs(rider.vu) > 0.05 && rider.push < 0;
    attitude(HEAD, 0, 0);
    pelvisWorld(_pel);
    // Her leg, as drawn: from the drawn plank up to her pelvis.
    const legNow = _pel[1] - plankY(rider.u);
    const pb = pelvisBase();
    st.at = rootFor(pb[0], pb[1], pb[2], _pel[0], _pel[1], _pel[2]);
    if (walking) {
      st.at[1] = plankY(rider.u);
      fk();
      applyAims(0);
      return 'walk';
    }
    fk();
    // The floor in figure space, and the feet on it; up on her toes when the
    // leg is longer than it is standing.
    const floor = pb[1] - legNow;
    const toes = clamp((legNow - (pb[1] - 0.005)) / 0.11, 0, 1);
    for (const [u, l, ft] of [['legUL', 'legLL', 'footL'], ['legUR', 'legLR', 'footR']]) {
      const j = bi[ft];
      ik(u, l, ft, base[3 * j], floor + base[3 * j + 1] + toes * 0.10, 1);
      // The foot flat on the plank whatever the shin does, or pointed.
      ang[j] = -toes * 0.95 - ang[bi[u]] - ang[bi[l]];
    }
    // The arms go with the push: back and down into the crouch, and up over
    // her head with the legs.
    let arm = 0;
    if (rider.push >= 0) {
      const k = rider.push;
      arm = k < H.crouchT ? -0.75 * smoothstep(0, H.crouchT, k)
        : lerp(-0.75, 2.9, smoothstep(H.crouchT, H.crouchT + H.pushT, k));
    } else if (Math.abs(st.armWas) > 0.02) arm = st.armWas * Math.exp(-dt / 0.2);
    st.armWas = arm;
    ang[bi.armUL] = arm; ang[bi.armUR] = arm;
    fk();
    applyAims(1);
    return 'idle';
  }
  /** Shapes, as aims: laid out straight, piked, tucked; blended by st.tuck and st.pike. */
  function airPose() {
    clearAng();
    const tk = st.tuck, pk = st.pike, open = 1 - Math.max(tk, pk);
    const diving = st.dir !== 0 || st.mode === 'under';
    // Laid out: arms over her head going in, toes pointed. A plain bounce
    // brings them down to her sides as she drops back on to the board.
    const up = diving ? 2.95 : (rider.vy > 0 ? 2.8 : lerp(2.8, 0.35, clamp(-rider.vy / 4, 0, 1)));
    const hip = 2.45 * tk + 2.35 * pk, knee = -2.55 * tk;
    const curl = -0.30 * tk - 0.15 * pk;
    ang[bi.spine01] = curl; ang[bi.spine02] = curl;
    ang[bi.neck] = -0.25 * tk - 0.2 * pk;
    ang[bi.legUL] = hip; ang[bi.legUR] = hip;
    ang[bi.legLL] = knee; ang[bi.legLR] = knee;
    ang[bi.footL] = -0.9; ang[bi.footR] = -0.9;
    fk();
    // Hands: overhead when open; on the shins tucked, behind the calves piked.
    ang[bi.armUL] = up; ang[bi.armUR] = up;
    if (open < 0.999) {
      for (const [au, al, h, ll, ft] of [['armUL', 'armLL', 'handL', 'legLL', 'footL'],
        ['armUR', 'armLR', 'handR', 'legLR', 'footR']]) {
        const K = bi[ll], A = bi[ft];
        const at = tk >= pk ? 0.30 : 0.75;       // how far down the shin
        const tx = lerp(fp[3 * K], fp[3 * A], at), ty = lerp(fp[3 * K + 1], fp[3 * A + 1], at);
        ik(au, al, h, tx, ty, 1);
        ang[bi[au]] = lerp(up, ang[bi[au]], 1 - open);
        ang[bi[al]] = lerp(0, ang[bi[al]], 1 - open);
      }
    }
    fk();
    applyAims(1);
  }

  // ── the cameras ───────────────────────────────────────────────────────────
  const _look = new THREE.Vector3(), _up = new THREE.Vector3();
  const _cq = new THREE.Quaternion();
  /** Where each of B's views stands, looking at `c` (her centre, world). */
  function camFor(name, c, camera) {
    if (name === 'follow') {
      // Round her on the mouse. On the tower it starts side on, which is the
      // view that shows a somersault for what it is; on the ladder it starts
      // behind her shoulder, out over the water — side on there is inside
      // the concrete.
      const climbing = st.mode === 'climb' && st.tau < T_MANTLE;
      const a = (climbing ? INTO + Math.PI + 0.75 : HEAD + 1.9) + st.orbYaw;
      const p = st.orbPitch, d = st.orbD;
      _p.set(Math.cos(a) * Math.cos(p) * d, Math.sin(p) * d, -Math.sin(a) * Math.cos(p) * d);
      const x = c[0] + _p.x, z = c[2] + _p.z;
      camera.position.set(x, Math.max(c[1] + _p.y, sea(x, z) + 0.35), z);
    } else if (name === 'judge') {
      // Side on, level with the board, from out over the water on the
      // seaward side — the judges' chair.
      const w = W(F.tip + 0.6, -9.5, F.plank + 0.6);
      camera.position.set(w[0], w[1], w[2]);
    } else if (name === 'water') {
      // A float off the tip, riding the swell, looking up.
      const w = W(F.tip + 4.2, -2.4, 0);
      camera.position.set(w[0], sea(w[0], w[2]) + 0.30, w[2]);
    } else {
      // Behind her on the deck, over her shoulder, the length of the plank.
      const w = W(F.back + 0.6, 0.55, F.plank + 1.75);
      camera.position.set(w[0], w[1], w[2]);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(c[0], c[1], c[2]);
  }

  // ── the entry ─────────────────────────────────────────────────────────────
  const HALF = (x) => Math.round(x * 2) / 2;
  const turnsTxt = (n) => (Math.floor(n) ? String(Math.floor(n)) : '') + (n % 1 ? '½' : '');
  /**
   * How she went in. Off vertical is the whole of the score here, the way
   * it is most of a real judge's: 10 at 0°, 5 at 30°, nothing past 60 — and
   * a tuck or a pike still closed at the water costs what it costs a diver
   * who did not come out of it.
   */
  function rate() {
    _up.set(0, 1, 0).applyQuaternion(Q);
    _look.set(1, 0, 0).applyQuaternion(Q);
    const dev = Math.acos(Math.min(1, Math.abs(_up.y))) * 180 / Math.PI;
    const headFirst = _up.y < 0;
    const shape = st.tuck > 0.5 ? 'tuck' : st.pike > 0.5 ? 'pike' : 'straight';
    const score = clamp(HALF(10 - dev / 6 - (shape === 'tuck' ? 2.5 : shape === 'pike' ? 1.0 : 0)), 0, 10);
    const turns = HALF(Math.abs(st.phi) / TAU);
    let word;
    if (dev > 60) word = _look.y < 0 ? 'flop' : 'backflop';
    else if (!headFirst && dev < 25) word = 'feet';
    else if (dev <= 8 && shape === 'straight') word = 'rip';
    else if (score >= 6) word = 'clean';
    else word = 'splashy';
    const dir = st.phi > 0.3 ? 'fwd' : st.phi < -0.3 ? 'rev' : '';
    const what = turns > 0 && dir
      ? turnsTxt(turns) + ' ' + T(turns > 1 ? 'plunge.saults' : 'plunge.sault') + ' ' + T('plunge.' + dir)
        + ', ' + T('plunge.' + (st.spinShape || 'straight'))
        + (Math.abs(st.psi) > 2.5 ? ' ' + T('plunge.twist') : '')
      : T('plunge.jump');
    return { dev: +dev.toFixed(1), headFirst, shape, score, turns, word, what,
      twist: +(st.psi / TAU).toFixed(2), vy: +rider.vy.toFixed(2) };
  }

  // ── the frame ─────────────────────────────────────────────────────────────
  const holdNpc = (on) => { if (D.hold) D.hold(on); };
  function npcOnPlank() {
    const m = D.mode ? D.mode() : 'off';
    if (m === 'walk' || m === 'turn' || m === 'wait') return true;
    return m === 'dive' && D.clipT() < D.free() + 0.3;
  }
  function drawBoard() {
    if (D.mode && D.mode() === 'dive') return;     // his table has it while he is on it
    // THE SHAPE READ FIRST. Misha, 27 Sep 2026: *"when i (chloe) go on the
    // diving board, and jump, the board seems to not bend... so it doesn't
    // look realistic"*. It did bend — the solve had the tip 0.46 m down under
    // her landings, and she rode that surface — but `deflect` draws from the
    // joint heights `shape()` copies out of the solve, and nothing ever called
    // `shape()`: the drawn plank measured 0.000 m of bend through a whole
    // pumping sequence, a straight board with her sinking into and rising off
    // it. Read every time it is drawn.
    board.shape();
    D.bend((u) => board.deflect(u - UF));
  }

  /**
   * One frame. `ctl` is what is held — { fwd, lean (+1 W, −1 S), tuck, pike,
   * twist } — and a Space press comes in through `press`. Returns an event
   * or null: { type: 'top' | 'takeoff' | 'land' | 'entry' | 'done' }.
   */
  function update(dt, ctl = {}) {
    if (st.mode === 'off') return null;
    dt = Math.min(dt, 0.05);
    // A probe's hands on the keys instead of the keyboard's.
    if (st.script) ctl = scriptCtl(dt, ctl);
    if (st.auto) ctl = autoCtl(ctl);
    const jump = pressed.jump; pressed.jump = false;
    let ev = null;
    if (st.mode === 'climb') {
      st.tau += dt;
      rider.stepFree(dt);
      if (st.tau >= T_TURN) {
        st.mode = 'deck';
        rider.mode = 'stand'; rider.u = U_L - UF; rider.push = -1; rider.leg = H.stand;
        rider.y = board.thick / 2 + rider.leg; rider.vu = 0; rider.vy = 0;
        // Eyes down the plank to the end of it, not at the islands.
        st.yawOff = 0; st.pitch = -0.32;
        ev = { type: 'top' };
      }
    } else if (st.mode === 'deck') {
      const was = rider.mode;
      rider.gate = npcOnPlank() ? -0.25 - UF : null;
      if (rider.gate != null && rider.u >= rider.gate - 0.05 && (ctl.fwd || 0) > 0 && !st.gateSaid) {
        st.gateSaid = true;
        if (hooks.toast) hooks.toast(T('plunge.wait'));
      }
      if (rider.gate == null) st.gateSaid = false;
      // Space in the air is the tuck, and only a press made up there: the
      // press that launched her is still held for a moment after she leaves.
      if (was === 'air' && jump) st.tuckArmed = true;
      const e = rider.update(dt, { fwd: ctl.fwd || 0, jump, lean: ctl.lean || 0 });
      if (e === 'takeoff') {
        st.dir = rider.lean || 0;
        st.L = rider.spin0 || 0;
        st.phi = 0; st.psi = 0; st.spinShape = null;
        st.tuckArmed = false;
        // The ballistic point is her centre as she leaves, and it rides the
        // rider's (u, y) from there: B = B0 + (rider now − rider then).
        attitude(HEAD, 0, 0);
        comFig(_c);
        worldOf(st.at, _c[0], _c[1], _c[2], st.B0);
        st.B = st.B0.slice();
        st.R0 = [rider.u, rider.y];
        if (hooks.sound) hooks.sound('board', clamp(Math.abs(board.tip()[1]) / 3, 0.2, 1));
        ev = { type: 'takeoff', vy: rider.lastTakeoff.vy };
      } else if (e === 'land') {
        // Crooked on to the board: a stumble, not a landing. Whatever she
        // was turning goes into her knees.
        if (Math.abs(wrapA(st.phi)) > 0.8 && hooks.toast) hooks.toast(T('plunge.ouch'));
        st.phi = 0; st.psi = 0; st.L = 0; st.dir = 0;
        st.tuck = 0; st.pike = 0; st.tuckArmed = false;
        if (hooks.sound) hooks.sound('land', clamp(-rider.landV / 6, 0.2, 1));
        ev = { type: 'land' };
      }
      if (rider.mode === 'air') {
        // The shape, and the spin it makes of the same angular momentum:
        // ω = L / I, with I what the shape makes it.
        const wantT = st.tuckArmed && ctl.tuck ? 1 : 0;
        const wantP = ctl.pike && !wantT ? 1 : 0;
        st.tuck = damp(st.tuck, wantT, 1 / H.shapeT, dt);
        st.pike = damp(st.pike, wantP, 1 / H.shapeT, dt);
        if (!ctl.tuck) st.tuckArmed = false;
        if (st.tuck > 0.5) st.spinShape = 'tuck';
        else if (st.pike > 0.5 && st.spinShape !== 'tuck') st.spinShape = 'pike';
        const I = 1 - (1 - H.iTuck) * st.tuck - (1 - H.iPike) * st.pike;
        const w = st.L / Math.max(0.25, I);
        st.spinMax = Math.max(st.spinMax, Math.abs(w));
        st.phi += w * dt;
        st.psi += (ctl.twist || 0) * H.twist * dt;
        const du = rider.u - st.R0[0];
        st.B = [st.B0[0] + du * F.axis.ux, st.B0[1] + rider.y - st.R0[1], st.B0[2] + du * F.axis.uz];
        // The water.
        const sy = sea(st.B[0], st.B[2]);
        if (st.B[1] <= sy + 0.12 && rider.vy < 0) {
          attitude(HEAD, st.phi, st.psi);
          st.entry = rate();
          st.entry.at = st.B.map((v) => +v.toFixed(2));
          st.entries++;
          const dev = st.entry.dev * Math.PI / 180;
          const hard = 0.55 + 1.9 * Math.sin(dev) + (st.entry.shape === 'tuck' ? 0.5 : 0)
            + Math.max(0, -rider.vy - 6) * 0.08;
          if (hooks.splash) hooks.splash(st.B[0], sy, st.B[2], hard, rider.vu * 0.6, F.axis.ux, F.axis.uz);
          if (hooks.sound) hooks.sound('plunge', clamp(0.6 + 0.6 * Math.sin(dev), 0, 1.2));
          st.uv = [rider.vu * F.axis.ux, rider.vy, rider.vu * F.axis.uz];
          st.under = 0;
          st.mode = 'under';
          holdNpc(false);
          ev = { type: 'entry', rate: st.entry };
        }
      }
    } else if (st.mode === 'under') {
      // A second and a bit under, for the third person to see the water close
      // over her: the dive's speed bled off, and her opening out.
      st.under += dt;
      rider.stepFree(dt);
      const k = Math.exp(-3.5 * dt);
      st.uv = st.uv.map((v) => v * k);
      st.uv[1] += 0.9 * dt;
      st.B = [st.B[0] + st.uv[0] * dt, st.B[1] + st.uv[1] * dt, st.B[2] + st.uv[2] * dt];
      st.tuck = damp(st.tuck, 0, 6, dt); st.pike = damp(st.pike, 0, 6, dt);
      if (st.under > 1.3) ev = { type: 'done' };
    }
    if (st.mode !== 'off') { drawBoard(); st.ringing = true; }
    return ev;
  }

  /** Every frame, whatever the phase: the board rings on after she has left it. */
  function tick(dt) {
    if (st.mode !== 'off' || !st.ringing) return;
    rider.stepFree(Math.min(dt, 0.05));
    drawBoard();
    // Still for a second, and it is let go of: drawn straight again and not
    // stepped. Not "back at rest", which it never quite is — the empty board
    // settles 4 mm under where the build measured it, and a test on the
    // position kept a board nobody was on stepping for the rest of the game.
    st.still = board.moving() < 0.003 ? (st.still || 0) + dt : 0;
    if (st.still > 1.0) {
      st.ringing = false;
      st.still = 0;
      D.bend(null);
    }
  }

  /** Put her body where she is, and the camera where it should be. */
  function pose(camera, third, dt) {
    if (st.mode === 'off') return;
    let clip = 'idle';
    if (st.mode === 'climb') clip = climbPose(st.tau);
    else if (st.mode === 'deck' && rider.mode === 'stand') clip = standPose(dt);
    else {
      airPose();
      // Heading, somersault, twist — about her centre of mass.
      attitude(HEAD, st.phi, st.psi);
      comFig(_c);
      st.at = rootFor(_c[0], _c[1], _c[2], st.B[0], st.B[1], st.B[2]);
    }
    const walking = clip === 'walk';
    // Frozen on idle's first frame, which is what everything above was solved
    // against — but not while a crossfade into it is running: the fade runs
    // on the clip's clock, and a clock at zero holds her halfway out of the
    // walk for ever (MEASURED: an arm left up at her chest on the plank).
    const S = fig.state;
    const fading = !!S.prev && S.fade < S.fadeLen;
    if (!walking && !fading && fig.playing() === 'idle') S.curT = 0;
    you.drive({
      at: st.at, yaw: HEAD, quat: Q, clip,
      speed: walking ? clamp(Math.max(Math.abs(rider.vu), 0.8) / 0.92, 0.6, 2.0) : (fading ? 1 : 0),
      wet: true, mask: false,
      // In her own eyes she is drawn too: the camera is in front of her
      // face, and looking down is her hands on the rungs, her feet on the
      // board, her knees in a tuck.
      seen: true,
    });
    // The eye: in front of her face, turned with her head — in front and not
    // inside, because from inside her skull the first thing in the frame is
    // her own hair from underneath (tried: a blue curtain over half the
    // picture).
    const h = bi.head;
    const c = Math.cos(Th[h]), s = Math.sin(Th[h]);
    const fwd = 0.17, upE = 0.05;
    const ex = fp[3 * h] + c * fwd - s * upE, ey = fp[3 * h + 1] + s * fwd + c * upE;
    worldOf(st.at, ex, ey, fp[3 * h + 2] + 0.01, st.eye);
    const name = third ? PLUNGE_CAMS[st.cam || 1] : 'eyes';
    if (name === 'eyes') {
      camera.position.set(st.eye[0], st.eye[1], st.eye[2]);
      if ((st.mode === 'deck' && rider.mode === 'air') || st.mode === 'under') {
        // Her eyes, all the way round: the attitude, her head's own nod, and
        // the mouse on top. The camera looks down its −z; her face is +x.
        _cq.copy(Q).multiply(_q.setFromAxisAngle(AZ, Th[h]))
          .multiply(_q.setFromAxisAngle(AY, -Math.PI / 2))
          .multiply(_q.setFromAxisAngle(AY, st.yawOff))
          .multiply(_q2.setFromAxisAngle(AX, st.pitch));
        camera.quaternion.copy(_cq);
      } else {
        const yaw = (st.mode === 'climb' && st.tau < T_CROSS ? INTO : HEAD) + st.yawOff;
        const cp = Math.cos(st.pitch);
        camera.up.set(0, 1, 0);
        camera.lookAt(st.eye[0] + Math.cos(yaw) * cp, st.eye[1] + Math.sin(st.pitch),
          st.eye[2] - Math.sin(yaw) * cp);
      }
    } else {
      // Where she is: her centre, smoothed a little so a bounce is a bounce
      // and not the whole picture shaking.
      comFig(_c);
      const w = worldOf(st.at, _c[0], _c[1], _c[2], _w);
      if (!st.camAt) st.camAt = w.slice();
      const k = 1 - Math.exp(-12 * dt);
      for (let i = 0; i < 3; i++) st.camAt[i] += (w[i] - st.camAt[i]) * k;
      camFor(name, st.camAt, camera);
    }
  }

  // ── a probe's hands ───────────────────────────────────────────────────────
  // `script([{ t, jump, fwd, lean, tuck, pike, twist }, …])`: from now, at
  // each t (s) set those keys — held ones stay held until set again; `jump`
  // is a press.
  function scriptCtl(dt, ctl) {
    st.scriptT += dt;
    const s = st.script, held = st.scriptHeld;
    while (s.length && s[0].t <= st.scriptT) {
      const e = s.shift();
      for (const k of ['fwd', 'lean', 'tuck', 'pike', 'twist']) if (e[k] != null) held[k] = e[k];
      if (e.jump) pressed.jump = true;
    }
    if (!s.length && st.scriptT > st.scriptEnd) st.script = null;
    return Object.assign({}, ctl, held);
  }
  // `autoPump(n, lean, shape, turns)`: n bounces, each pressed a tenth of a
  // second before she lands; on the last she leaves leaning, and tucks or
  // pikes until the spin she has left laid out would put her in head first
  // after `turns` somersaults and a half — which is what a diver is judging
  // when she "kicks out".
  function autoCtl(ctl) {
    const a = st.auto;
    const out = Object.assign({}, ctl);
    // Out to the end first: the pump is a thing the last half metre does.
    if (rider.mode === 'stand' && !a.started) {
      if (rider.u < board.L - 0.16) { out.fwd = 1; return out; }
      if (Math.abs(rider.vu) > 0.01 || (a.wait = (a.wait || 0) + 1) < 20) return out;
      a.started = true; pressed.jump = true;
    }
    // `late`: the same presses a quarter second after each landing instead —
    // the mistimed pump, for measuring that it does not build.
    if (a.late) {
      if (rider.mode === 'stand' && a.was === 'air') a.landT = rider.t;
      a.was = rider.mode;
      if (a.landT != null && rider.mode === 'stand' && rider.t - a.landT > 0.25) {
        a.landT = null; a.n++;
        if (a.n <= a.bounces) pressed.jump = true;
      }
      return out;
    }
    if (rider.mode === 'air' && rider.vy < 0 && st.dir === 0 && !a.armed) {
      board.surface(Math.max(0, rider.u), _s);
      if (rider.y - H.reach - _s[0] < 0.28) {
        a.armed = true;
        a.n++;
        if (a.n <= a.bounces) pressed.jump = true;
      }
    }
    if (rider.mode === 'stand') a.armed = false;
    if (a.n >= a.bounces && rider.mode === 'stand') out.lean = a.lean;
    if (rider.mode === 'air' && st.dir !== 0) {
      if (a.shape) {
        const sy = sea(st.B[0], st.B[2]);
        const tLeft = (rider.vy + Math.sqrt(Math.max(0, rider.vy * rider.vy + 2 * 9.81 * (st.B[1] - sy)))) / 9.81;
        const target = (2 * a.turns + 1) * Math.PI;
        // What she will still turn if she opens now: laid out for the time
        // left, plus the extra the shape change itself is worth while she
        // is still coming out of it.
        const I = 1 - (1 - H.iTuck) * st.tuck - (1 - H.iPike) * st.pike;
        const willBe = Math.abs(st.phi) + Math.abs(st.L) * (tLeft + (1 / Math.max(0.25, I) - 1) * H.shapeT);
        const on = willBe < target - 0.15 && tLeft > 0.3;
        if (a.shape === 'tuck') { if (on && !st.tuckArmed) pressed.jump = true; out.tuck = on; }
        if (a.shape === 'pike') out.pike = on;
      }
      if (a.twist) out.twist = a.twist;
    }
    return out;
  }

  // ── the doors ─────────────────────────────────────────────────────────────
  const FOOT = W(U_L, F.ladder.face - 0.55, 0);
  /** How far a swimmer at (x, z) is from the foot of the ladder, m. */
  const toLadder = (x, z) => Math.hypot(x - FOOT[0], z - FOOT[2]);
  /** Why the ladder cannot be climbed now, as a string key, or ''. */
  function blocked() {
    return D.mode && D.mode() === 'ladder' ? 'plunge.busy' : '';
  }
  /**
   * Up the ladder, from the swimmer where she is: `from` is her eye in the
   * world. False if something already has her.
   */
  function climb(from) {
    if (st.mode !== 'off') return false;
    if (!based) capture();
    board.reset();
    st.ringing = false;
    st.mode = 'climb'; st.tau = 0;
    st.from = from ? [from[0], from[1] - 0.62, from[2]] : null;
    // Eyes a little down, at her own hands on the rungs: level, the frame is
    // one rung and forty centimetres of concrete (MEASURED: her eye is 0.38 m
    // off the rungs, both hands 0.1-0.4 m under it).
    st.yawOff = 0; st.pitch = -0.32;
    st.phi = 0; st.psi = 0; st.L = 0; st.dir = 0; st.tuck = 0; st.pike = 0;
    st.entry = null; st.camAt = null; st.armWas = 0;
    rider.mode = 'stand'; rider.u = U_L - UF; rider.push = -1; rider.vu = 0;
    rider.takeoffs.length = 0;
    holdNpc(true);
    return true;
  }
  /** Skip the climb: standing on the plank at the ladder, facing the tip. */
  function top() {
    if (st.mode === 'off') climb(null);
    st.tau = Math.max(st.tau, T_TURN - 1e-3);
    return true;
  }
  /** Her body back to the app, and the tower back to the man who lives on it. */
  function end() {
    releaseAims();
    st.mode = 'off';
    st.script = null; st.auto = null;
    holdNpc(false);
  }
  function abort() {
    if (st.mode === 'off') return false;
    end();
    you.drive(null);
    board.reset();
    D.bend(null);
    st.ringing = false;
    return true;
  }

  return {
    get active() { return st.mode !== 'off'; },
    get mode() { return st.mode; },
    get air() { return st.mode === 'deck' && rider.mode === 'air'; },
    get cam() { return PLUNGE_CAMS[st.cam]; },
    get camIndex() { return st.cam; },
    /** Which hint line the HUD wants. */
    get hint() {
      if (st.mode === 'climb') return 'climb';
      if (st.mode === 'deck' && rider.mode === 'air') return st.dir ? 'air' : 'bounce';
      return st.mode === 'deck' ? 'deck' : '';
    },
    toLadder, blocked, climb, top, update, tick, pose, end, abort,
    reach: C.reach,
    /** The foot of the ladder, in the water, world. */
    foot: () => FOOT.slice(),
    /** A press of Space. */
    press: () => { pressed.jump = true; },
    /** The mouse: her head in her own eyes, the orbit in `follow`. */
    look: (dx, dy, third) => {
      if (third && PLUNGE_CAMS[st.cam] === 'follow') {
        st.orbYaw -= dx; st.orbPitch = clamp(st.orbPitch + dy, -0.25, 1.2);
      } else if (!third) {
        st.yawOff = clamp(st.yawOff - dx, -2.6, 2.6);
        st.pitch = clamp(st.pitch - dy, -1.4, 1.4);
      }
    },
    /** B: the next view; 0 is her own eyes. */
    cycleCam: () => { st.cam = (st.cam + 1) % PLUNGE_CAMS.length; st.camAt = null; return st.cam; },
    setCam: (i) => { st.cam = clamp(i | 0, 0, PLUNGE_CAMS.length - 1); st.camAt = null; return st.cam; },
    /** Where she went in, for the hand-over to the swim. */
    handover: () => ({ x: st.B[0], y: st.B[1], z: st.B[2], yaw: HEAD, entry: st.entry }),
    readout: () => ({ tip: board.tip()[0], v: rider.lastTakeoff ? rider.lastTakeoff.vy : 0 }),
    script: (list, end = 0) => {
      st.script = list.slice().sort((a, b) => a.t - b.t);
      st.scriptT = 0; st.scriptHeld = {}; st.scriptEnd = end;
      return true;
    },
    autoPump: (bounces = 3, lean = 1, shape = 'tuck', turns = 1, twist = 0, late = false) => {
      st.auto = { bounces, lean, shape, turns, twist, late, n: 0, armed: false, started: false };
      return true;
    },
    blowUp: (v) => { board.blowUp(v); return true; },
    stats: () => ({
      mode: st.mode, tau: +st.tau.toFixed(2), cam: PLUNGE_CAMS[st.cam],
      rider: { mode: rider.mode, u: +(rider.u + UF).toFixed(2), y: +rider.y.toFixed(3),
        vy: +rider.vy.toFixed(2), leg: +rider.leg.toFixed(3), push: +rider.push.toFixed(2) },
      tip: board.tip().map((v) => +v.toFixed(3)),
      takeoffs: rider.takeoffs.map((t) => t.vy),
      phi: +st.phi.toFixed(2), psi: +st.psi.toFixed(2), L: +st.L.toFixed(2),
      spinMax: +st.spinMax.toFixed(2),
      tuck: +st.tuck.toFixed(2), pike: +st.pike.toFixed(2),
      B: st.B.map((v) => +v.toFixed(2)), at: st.at.map((v) => +v.toFixed(2)),
      eye: st.eye.map((v) => +v.toFixed(2)),
      entry: st.entry, entries: st.entries, npc: D.mode ? D.mode() : null,
      board: { steps: board.stats.steps, rescues: board.stats.rescues, bails: board.stats.bails,
        why: board.stats.why, msStep: +(board.stats.ms / Math.max(1, board.stats.steps)).toFixed(4) },
      ringing: st.ringing,
    }),
    /** Figure-space joint positions off the planar FK, for checking the solve. */
    bones: (names) => {
      const o = {};
      for (const n of names) { const i = bi[n]; o[n] = [+fp[3 * i].toFixed(3), +fp[3 * i + 1].toFixed(3)]; }
      return o;
    },
  };
}
