// -----------------------------------------------------------------------------
// A beach ball, for the Slow Doodle.
//
// Misha, 26 Sep 2026. Offered *"a ball. A real one that rolls and bounces off
// the frame and the fence. The Slow Doodle could chase it, which gives him a
// second 'superpower', with no one's face involved"*, he answered *"let's do
// ankle cuffs thing first and then after that, the ball for doodle"* — and,
// of the solver the cuff chain had just been built on, *"we wanna use AVBD for
// various stuff"*.
//
// So this is a real ball: one rigid sphere solved by AVBD (`avbdBall` in
// 43-avbd.js) against the ground the promenade stands you on, the boxes the
// person collider already keeps you out of, the playground's own frames and
// fences, and people — you, Baye's nineteen capsules, the creature's snout
// and legs, the bathers — as kinematic capsules that carry it along when they
// move into it. It floats. It blows about a little. The creature's half of
// the game, going for it and bringing it back, is `── the fetch ──` in
// 43-doodle.js; this file is the ball and nothing that decides anything.
//
// WHY A BEACH BALL and not a tennis ball: this is Jadrija. A 22 cm vinyl ball
// in six gores — red, white, yellow, white, blue, white, and white caps — is
// the thing every family on that concrete has, it reads from forty metres,
// and it is light, which is where the fun is: a beach ball is mostly air,
// so the air has a say in where it goes (and the sea, where it floats high
// and bobs). Smaller than the big ones on purpose, because a creature has to
// get his mouth round it: 22 cm is what a large dog can carry by the vinyl.
//
// NOT A SHOP ITEM. It is in your satchel from the start (`ball` in CARRY and
// SATCHEL.have), and it comes back into it when you pick it up — `[` next to
// it, the bracket beside the phone's.
//
// NO BACKTICKS IN THE GLSL BELOW.
// -----------------------------------------------------------------------------

const BALL = {
  // The ball. 22 cm across, 80 g: a child's vinyl beach ball, and a thin
  // shell's moment of inertia, ⅔ m r².
  r: 0.11,
  mass: 0.08,
  // Vinyl on concrete. A beach ball bounces to about half the height it fell
  // from, which is e ≈ 0.7; the rolling resistance is what a soft ball on
  // flags with joints in them loses, and it is also the breeze it stands up
  // to at rest — 0.08 of its weight is the push of a 2.3 m/s wind on it, and
  // the wind down on the deck between the rows is less than that.
  mu: 0.6, e: 0.70, eMin: 0.35, roll: 0.08, spin: 3.0,
  // People are softer than concrete, and a snout is softer still: a nudge
  // should roll the ball on, not fire it.
  eBody: 0.35, muBody: 0.5, eSnout: 0.30,
  // The solver. The chain's own constants (CHAIN in 43-jadrija.js) except for
  // the iterations: one body, six is plenty.
  iterations: 6, alpha: 0.9, beta: 1e5, gamma: 0.999,
  margin: 0.01, vMax: 16, deep: 0.08, sleep: 0.6,
  // People and the creature are springs this stiff to it — see (h) over
  // `avbdBall`. 2500 N/m on 80 g is a contact that rings at 28 Hz: hard to
  // the eye, and in a squeeze against a wall it is the snout that gives.
  capK: 2500,
  // A shape that moved further than this in a frame did not move, it was
  // put somewhere (a figure re-placed, a pose snapped): the ball is not
  // told it was hit at that speed. m/s, and never less than `jump` metres.
  teleport: 7, jump: 0.15,
  // At most this long a substep: at 60 frames a second, two of them.
  sub: 1 / 120,
  air: { rho: 1.2, cd: 0.47 },
  // Sea water. `zeta` is how much of critical the bobbing is damped by the
  // waves it makes, `ang` how fast the sea takes its spin off it.
  water: { rho: 1025, cd: 0.6, zeta: 0.25, ang: 8 },
  // The wind down here: 57-eject.js's `windAt` at no height at all (0.26 of
  // the wind the fire is spread by, which is the wind at altitude), and the
  // rows of kabine take some of that again on the concrete. Over the water
  // it has the whole of it.
  windLow: 0.26, shelter: 0.6,
  // What floating things do next to a shore: drift in, on the waves' own
  // mass transport (Stokes drift). A few centimetres a second, inland.
  drift: 0.06,
  // Your throw. 9 m/s along where you are looking, lifted a little: a
  // beach ball with this much drag on it goes six or seven metres before it
  // lands and rolls a few more.
  throwV: 9.0, loft: 0.22,
  // Where it leaves your hand, in the eye's frame: forward, right, up —
  // at the height of your chin, where a one-handed push-pass starts.
  hand: [0.40, 0.15, -0.20],
  // And the gesture: up to your hand, and let go at the top of it.
  windup: 0.16, follow: 0.35,
  // How near it has to be for you to pick it up — an arm and a bend.
  pick: 1.6,
  // Past this from the camera, and asleep, it is not even looked at.
  far: 160,
};

/** Its six gores, in the game's colour space (sRGB bytes read as linear). */
const BALL_GORES = [
  [0.80, 0.07, 0.06],      // red
  [0.93, 0.92, 0.88],      // white
  [0.95, 0.72, 0.04],      // yellow
  [0.93, 0.92, 0.88],
  [0.04, 0.24, 0.72],      // blue
  [0.93, 0.92, 0.88],
];

function ballBodyGLSL() {
  const v3 = (c) => 'vec3(' + c.map((v) => v.toFixed(3)).join(', ') + ')';
  // The gore off the longitude of the point on the ball — from the mesh's own
  // position, so the stripes turn with it and are as crisp as the pixel.
  let s = 'vec3 bq = normalize(vLocal);\n'
    + 'float ba = (atan(bq.z, bq.x) + 3.14159265) / 6.28318531 * 6.0;\n'
    + 'float bg = floor(ba);\n'
    + 'vec3 bc = ' + v3(BALL_GORES[5]) + ';\n';
  BALL_GORES.forEach((c, i) => {
    if (i === 5) return;
    s += (i ? 'else ' : '') + 'if (bg < ' + (i + 0.5).toFixed(1) + ') bc = ' + v3(c) + ';\n';
  });
  // The two caps, white, with a thin coloured ring round each — and the
  // welded seams between the gores, a hair darker.
  s += 'float bp = abs(bq.y);\n'
    + 'if (bp > 0.955) bc = ' + v3(BALL_GORES[1]) + ';\n'
    + 'else if (bp > 0.935) bc = ' + v3(BALL_GORES[4]) + ';\n'
    + 'float bf = fract(ba);\n'
    + 'float bs = smoothstep(0.0, 0.012, bf) * smoothstep(0.0, 0.012, 1.0 - bf);\n'
    + 'base = bc * mix(0.80, 1.0, max(bs, step(0.935, bp)));\n';
  return s;
}

/**
 * Build it. `J` is what the promenade lends it:
 *
 *   floor(x, z, y)          the ground, with the sea bed seaward of the quay
 *   water(x, z)             the sea's surface there, or NaN
 *   inland(x, z, out)       the way inland at (x, z), for the drift
 *   boxes(x, z, r, put)     the solid boxes near (x, z)
 *   caps(x, z, r, add)      the capsules near (x, z): people, the creature,
 *                           the playground's rods
 *   sheltered(x, z)         whether it is down among the rows
 *
 * Returns the handle 43-jadrija.js keeps, whose `api` is the one the creature
 * and the keys and the voice use.
 */
function buildBall(scene, J) {
  const geo = new THREE.SphereGeometry(BALL.r, 28, 18);
  const mat = solidMaterial(0xffffff, { spec: 0.42, specPower: 70, vcol: false, body: ballBodyGLSL() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'beach-ball';
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);

  const sim = avbdBall({ r: BALL.r, mass: BALL.mass, moment: (2 / 3) * BALL.mass * BALL.r * BALL.r,
    mu: BALL.mu, e: BALL.e, eMin: BALL.eMin, roll: BALL.roll, spin: BALL.spin,
    iterations: BALL.iterations, alpha: BALL.alpha, beta: BALL.beta, gamma: BALL.gamma,
    gravity: [0, -9.81, 0], margin: BALL.margin, vMax: BALL.vMax, deep: BALL.deep,
    sleep: BALL.sleep, capK: BALL.capK, air: BALL.air, water: BALL.water });
  const W = sim.world;
  W.floor = J.floor;
  W.water = J.water;

  // ── where it is ─────────────────────────────────────────────────────────
  //
  //   bag     in your satchel, not drawn
  //   out     in the world, simulated
  //   held    in somebody's mouth or hand — its place is written from outside
  let where = 'bag';
  let holder = null;          // (out) → where it is being held, world metres
  let heldFrom = null, heldT = 0;   // for the blend into a mouth
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  // Kinematic capsules this frame and last, by id: a shape's start-of-step
  // position is where it was a frame ago, and a shape seen for the first time
  // starts where it is.
  const was = new Map(), now = new Map();
  const capIds = [];
  function addCap(id, ax, ay, az, bx, by, bz, r0, r1, e, mu) {
    if (capIds.length >= W.capMax) return;
    let c = now.get(id);
    if (!c) { c = new Float64Array(10); now.set(id, c); }
    c[0] = ax; c[1] = ay; c[2] = az; c[3] = bx; c[4] = by; c[5] = bz;
    c[6] = r0; c[7] = r1; c[8] = e == null ? BALL.eBody : e; c[9] = mu == null ? BALL.muBody : mu;
    capIds.push(id);
  }
  function capsAt(u0, u1) {
    W.capN = capIds.length;
    for (let k = 0; k < capIds.length; k++) {
      const id = capIds[k], N = now.get(id), P = was.get(id) || N;
      for (let j = 0; j < 3; j++) {
        W.a0[3 * k + j] = P[j] + (N[j] - P[j]) * u0;
        W.b0[3 * k + j] = P[3 + j] + (N[3 + j] - P[3 + j]) * u0;
        W.a1[3 * k + j] = P[j] + (N[j] - P[j]) * u1;
        W.b1[3 * k + j] = P[3 + j] + (N[3 + j] - P[3 + j]) * u1;
      }
      W.cr[2 * k] = N[6]; W.cr[2 * k + 1] = N[7];
      W.ce[k] = N[8]; W.cmu[k] = N[9]; W.cid[k] = id;
    }
  }
  function putBox(cx, cy, cz, ux, uz, ha, hy, hc, e = BALL.e, mu = BALL.mu) {
    if (W.boxN >= W.boxMax) return;
    W.box.set([cx, cy, cz, ux, uz, ha, hy, hc, e, mu, 0], 11 * W.boxN);
    W.boxN++;
  }

  const inl = [0, 0];
  const stats = { ms: 0, msMax: 0, frames: 0, msSum: 0, throws: 0, picks: 0, caps: 0, boxes: 0, penMax: 0 };
  const trace = [];

  /** One frame. `who` is where you are standing (feet), or null. */
  function step(dt, cam) {
    if (where === 'bag') return;
    if (where === 'held') {
      const h = holder && holder();
      if (!h) { drop(sim.P[0], sim.P[1], sim.P[2], 0, 0, 0); return; }
      // Into the mouth over `heldT`, from wherever it was picked up.
      heldT = Math.min(1, heldT + dt / 0.25);
      const k = heldT * heldT * (3 - 2 * heldT);
      if (heldFrom) {
        sim.P[0] = heldFrom[0] + (h[0] - heldFrom[0]) * k;
        sim.P[1] = heldFrom[1] + (h[1] - heldFrom[1]) * k;
        sim.P[2] = heldFrom[2] + (h[2] - heldFrom[2]) * k;
      } else { sim.P[0] = h[0]; sim.P[1] = h[1]; sim.P[2] = h[2]; }
      if (h.length > 3) { sim.V[0] = h[3]; sim.V[1] = h[4]; sim.V[2] = h[5]; }
      mesh.position.set(sim.P[0], sim.P[1], sim.P[2]);
      return;
    }
    const dx = sim.P[0] - cam.x, dz = sim.P[2] - cam.z;
    if (sim.asleep && dx * dx + dz * dz > BALL.far * BALL.far) return;
    const c0 = performance.now();
    const x = sim.P[0], z = sim.P[2];
    const sp = Math.hypot(sim.V[0], sim.V[1], sim.V[2]);
    const reach = 1.2 + sp * dt * 2;
    // The world near it, once a frame.
    capIds.length = 0;
    J.caps(x, z, reach, addCap);
    W.boxN = 0;
    J.boxes(x, z, reach, putBox);
    stats.caps = capIds.length; stats.boxes = W.boxN;
    // The wind at its height, and the sea's drift.
    const sea = W.water ? W.water(x, z) : NaN;
    const wet = sea === sea && sim.P[1] - BALL.r < sea + 0.05;
    const f = state.windSpeed * BALL.windLow * (wet || !J.sheltered(x, z) ? 1 : BALL.shelter);
    W.windX = Math.cos(state.windDir) * f; W.windY = 0; W.windZ = Math.sin(state.windDir) * f;
    if (wet) { J.inland(x, z, inl); W.flowX = inl[0] * BALL.drift; W.flowZ = inl[1] * BALL.drift; } else { W.flowX = 0; W.flowZ = 0; }
    // Anybody who jumped rather than moved starts this frame where they are.
    const lim = Math.max(BALL.jump, BALL.teleport * dt);
    for (const id of capIds) {
      const N = now.get(id), P = was.get(id);
      if (P && (Math.hypot(N[0] - P[0], N[1] - P[1], N[2] - P[2]) > lim
        || Math.hypot(N[3] - P[3], N[4] - P[4], N[5] - P[5]) > lim)) was.delete(id);
    }
    const n = Math.max(1, Math.min(4, Math.ceil(dt / BALL.sub - 1e-6)));
    const h = Math.max(1e-4, dt / n);
    for (let i = 0; i < n; i++) {
      capsAt(i / n, (i + 1) / n);
      sim.step(h);
    }
    // This frame's shapes are next frame's starting points.
    was.clear();
    for (const id of capIds) was.set(id, now.get(id).slice());
    mesh.position.set(sim.P[0], sim.P[1], sim.P[2]);
    mesh.quaternion.set(sim.Q[0], sim.Q[1], sim.Q[2], sim.Q[3]);
    // How far into the ground it has ever been, which is the tunnelling test.
    if (sim.stats.depth <= 0) stats.penMax = Math.max(stats.penMax, sim.stats.floorPen);
    const ms = performance.now() - c0;
    stats.ms = ms; stats.msMax = Math.max(stats.msMax, ms); stats.frames++; stats.msSum += ms;
    if (trace.length < 4000) {
      trace.push([+performance.now().toFixed(0), +sim.P[0].toFixed(3), +sim.P[1].toFixed(3), +sim.P[2].toFixed(3),
        +sp.toFixed(2), sim.cN, sim.asleep ? 1 : 0, +sim.stats.depth.toFixed(3), +sim.stats.floorPen.toFixed(4),
        Array.from(sim.cId.slice(0, sim.cN)).join('.')]);
    }
  }

  /** Out of your hand at (x, y, z) with velocity (vx, vy, vz). */
  function throwFrom(x, y, z, vx, vy, vz) {
    where = 'out';
    holder = null;
    mesh.visible = true;
    sim.place(x, y, z);
    // A little backspin off the fingers: about the axis across the throw.
    const hl = Math.hypot(vx, vz) || 1;
    sim.launch(vx, vy, vz, (vz / hl) * 6, 0, (-vx / hl) * 6);
    was.clear();
    sim.touched.clear();
    stats.throws++;
    mesh.position.set(x, y, z);
    return true;
  }
  /** Let go of it — out of a mouth, or out of a hand — with this velocity. */
  function drop(x, y, z, vx, vy, vz) {
    where = 'out';
    holder = null; heldFrom = null;
    mesh.visible = true;
    sim.place(x, y, z);
    sim.launch(vx, vy, vz);
    was.clear();
    mesh.position.set(x, y, z);
  }
  /**
   * Somebody has it. `fn()` answers where its centre is to be this frame
   * (world metres, and optionally the velocity of that point after it), or
   * null when they have let go.
   */
  function hold(fn) {
    heldFrom = where === 'out' ? [sim.P[0], sim.P[1], sim.P[2]] : null;
    heldT = 0;
    where = 'held';
    holder = fn;
    mesh.visible = true;
  }
  /** Into the satchel. */
  function stow() {
    where = 'bag';
    holder = null;
    mesh.visible = false;
    stats.picks++;
  }

  const api = {
    get where() { return where; },
    /** Where it is and how it is moving, for the creature and the probes. */
    info() {
      const P = sim.P, V = sim.V;
      const [t, s] = J.local(P[0], P[2]);
      const fl = J.floor(P[0], P[2], P[1] - BALL.r);
      const sea = W.water ? W.water(P[0], P[2]) : NaN;
      return { where, x: P[0], y: P[1], z: P[2], t, s, vx: V[0], vy: V[1], vz: V[2],
        speed: Math.hypot(V[0], V[1], V[2]), floor: fl, up: P[1] - BALL.r - fl,
        wet: sea === sea && P[1] - BALL.r < sea + 0.05, sea,
        asleep: sim.asleep, contacts: sim.cN };
    },
    touched: (id) => sim.touched.has(id),
    clearTouched: () => sim.touched.clear(),
    throwFrom, drop, hold, stow,
    r: BALL.r,
    mesh, sim,
    /** Debug: the numbers, and the path it has taken. */
    stats: () => ({ where, at: Array.from(sim.P).map((v) => +v.toFixed(3)),
      v: Array.from(sim.V).map((v) => +v.toFixed(3)), w: Array.from(sim.W).map((v) => +v.toFixed(2)),
      asleep: sim.asleep, contacts: sim.cN, ids: Array.from(sim.cId.slice(0, sim.cN)),
      solver: { ...sim.stats }, caps: stats.caps, boxes: stats.boxes,
      ms: +stats.ms.toFixed(3), msMax: +stats.msMax.toFixed(3),
      msMean: stats.frames ? +(stats.msSum / stats.frames).toFixed(4) : 0, frames: stats.frames,
      penMax: +stats.penMax.toFixed(4),
      throws: stats.throws, picks: stats.picks }),
    trace: (clear) => { const t = trace.slice(); if (clear) trace.length = 0; return t; },
    resetStats: () => {
      stats.msMax = 0; stats.frames = 0; stats.msSum = 0; stats.penMax = 0; trace.length = 0;
      sim.stats.bounces = 0; sim.stats.rescues = 0; sim.stats.hits = 0;
    },
  };
  return { mesh, api, step };
}
