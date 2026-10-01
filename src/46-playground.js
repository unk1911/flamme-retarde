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
// Everything that moves is its own mesh on its own pivot, so the AVBD pass
// (src/43-avbd.js) can take each one over without touching the frames: every
// swing seat and the nest and the rope hang from a hinge on the beam's axis;
// the seesaw beam turns on its fulcrum; each trampoline bed is a dent profile
// scaled in y; the spring rider rocks on its spring's foot. Until then each is
// a damped pendulum or spring of its own here (`tick`), which settles, sways a
// little in the breeze, and is pushed by the hose and by walking into it.
// `__fr.play` reads and drives them.
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
  fence: { t0: 517.4, t1: 532.6, s0: 40.2, s1: 52.0, gate: [518.05, 519.15] },
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
  /** A chain: a round line with a link pattern in its colour, `n` sides. */
  function chain(B, a, c, col) {
    const L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const N = Math.max(2, Math.round(L / 0.05));
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(lerp3(a, c, i / N));
    // The links read as a beading of the line: alternate rings fatter.
    pipe(B, pts, (i) => (i % 2 ? 0.0085 : 0.0055), col, 5, false);
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
  // Each is an outer group at the hinge, turned so its local x is the hinge
  // axis and y is up, and an inner pivot that turns about x. Their geometry is
  // built in the pivot's own frame, so `pivot.rotation.x` is the whole of
  // their motion and a solver can drive it from one number.
  const parts = [];
  const eqMat = solidMaterial(0xffffff, {
    spec: 0.10, specPower: 26, side: THREE.DoubleSide, emissive: 0.06,
    body: 'n = gl_FrontFacing ? n : -n; base *= vVCol;',
  });
  function mover(kind, hinge, axis, build, extra = {}) {
    const B = propBuilder();
    build(B);
    const X = nrm(axis), Y = [0, 1, 0];
    const Z = crs(X, Y);
    const outer = new THREE.Group();
    outer.matrixAutoUpdate = false;
    outer.matrix.makeBasis(new THREE.Vector3(...X), new THREE.Vector3(...Y),
      new THREE.Vector3(...Z));
    outer.matrix.setPosition(hinge[0], hinge[1], hinge[2]);
    const mesh = new THREE.Mesh(B.geo(), eqMat);
    mesh.name = 'play:' + kind;
    mesh.geometry.computeBoundingSphere();
    outer.add(mesh);
    scene.add(outer);
    outer.updateMatrixWorld(true);
    const p = { kind, mesh, outer, hinge, axis: X, side: Z, th: 0, om: 0,
      tris: B.count() / 3, ...extra };
    parts.push(p);
    return p;
  }
  /**
   * A flat seat on two chains, in the pivot frame: the hinge axis is x, the
   * chains hang to y = −L, the seat is `w` along x. Black rubber, sagging a
   * little in the middle, with its steel hanger plates at the ends.
   */
  function seatGeo(B, L, w = 0.44, chainCol = PG.GALV) {
    const hw = w / 2 - 0.02;
    for (const x of [-hw, hw]) {
      chain(B, [x, -0.02, 0], [x, -L + 0.05, 0], chainCol);
      // The shackle at the beam.
      pipe(B, [[x, 0.04, -0.03], [x, 0.06, 0], [x, 0.04, 0.03]], 0.008, PG.GALV, 5);
    }
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
  const TRAMPS = [[519.6, 43.0], [527.0, 43.0]];
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
    for (let t = D.t0; t < D.t1 - 1e-6; t += STEP) {
      for (let s = D.s0; s < D.s1 - 1e-6; s += STEP) {
        const t1 = Math.min(t + STEP, D.t1), s1 = Math.min(s + STEP, D.s1);
        const poly = clip([[t, s], [t1, s], [t1, s1], [t, s1]]);
        if (poly.length < 3) continue;
        for (let k = 1; k < poly.length - 1; k++) {
          const a = poly[0], c = poly[k], d = poly[k + 1];
          // Colour per vertex, so the wear and the mottle are washes and
          // not a chequerboard of cells.
          ground3(rub, V(a[0], a[1]), V(d[0], d[1]), V(c[0], c[1]),
            rubCol(a[0], a[1]), rubCol(d[0], d[1]), rubCol(c[0], c[1]));
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
    // The gate: a frame of 40 mm tube with the same mesh in it, hung on the
    // east jamb and standing open into the playground.
    {
      const ht = Fc.gate[1], hs = S0;
      const y = bY(ht, hs);
      const W = Fc.gate[1] - Fc.gate[0] - 0.08;
      const open = 1.25;
      const dir = [-Math.cos(open), Math.sin(open)];        // in (t, s)
      const at = (u, h) => P(ht + dir[0] * (u + 0.05), hs + dir[1] * (u + 0.05), y + h);
      pipe(up, [at(0, 0.06), at(0, 1.00), at(W, 1.00), at(W, 0.06), at(0, 0.06)], 0.02,
        PG.GREEN, 6, false);
      for (let u = 0.1; u < W - 0.05; u += 0.2) bar(up, at(u, 0.07), at(u, 0.99), 0.0055, 0.0055, PG.GREEN);
      for (const h of [0.40, 0.72]) bar(up, at(0, h), at(W, h), 0.0065, 0.0065, PG.GREEN);
      // Hinges and the latch.
      for (const h of [0.2, 0.85]) ball(up, at(-0.03, h), 0.025, PG.GREEN, 6, 3);
      bar(up, at(W - 0.02, 0.72), at(W + 0.06, 0.72), 0.02, 0.05, PG.GALV);
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
    // The nest, in the west bay.
    {
      const t = (T[0] + T[1]) / 2;
      const hinge = P(t, s, yb(t) + H - 0.03);
      const L = H - 0.03 - 0.58;
      mover('nest', hinge, axis, (B) => {
        const RR = 0.50;
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
        // Four chains to two swivels 0.9 m apart on the beam.
        for (const x of [-0.45, 0.45]) {
          for (const z of [-1, 1]) {
            const a = [x * 0.98, -0.12, 0];
            const c = [x * 0.62, -L + 0.02, z * RR * 0.80];
            chain(B, a, c, PG.GALV);
          }
          pipe(B, [[x, 0.03, 0], [x, -0.12, 0]], 0.014, PG.GALV, 6);
        }
      }, { L, mass: 6, r: 0.5 });
      WEAR.push([t, s - 1.6, 1.2, 0.7, 0.6]);
      WEAR.push([t, s + 1.6, 1.2, 0.7, 0.6]);
    }
    // Two flat seats, in the east bay.
    for (const t of [T[1] + 1.0, T[2] - 1.0]) {
      const hinge = P(t, s, yb(t) + H - 0.03);
      const L = H - 0.03 - 0.46;
      mover('seat', hinge, axis, (B) => seatGeo(B, L), { L, mass: 2.5 });
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
    const hinge = fr.F(0, 0, y + HP);
    const rest = Math.asin((HP - 0.13) / HL);
    const p = mover('seesaw', hinge, fr.V, (B) => {
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
    }, { HL, rest, mass: 25 });
    // Which way is down: the beam's +z end is the −u end. Put the −u end down.
    p.th = -rest;
    p.thRest = -rest;
    p.lim = rest;
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
    // The bed's rest is 1.2 cm under the rubber's top, on the tucked rubber.
    const hinge = add(c, [0, -0.012, 0]);
    const axis = nrm(sub(P(t + 1, s, y), P(t, s, y)));
    const p = mover('tramp', hinge, axis, (B) => {
      // The bed: rings from rim to centre, y = −(1 − (r/R)²), a unit dent.
      const R = 10, A = 32;
      const pt = (r, a) => [Math.cos(a) * r, -(1 - (r / RB) * (r / RB)), Math.sin(a) * r];
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
    }, { R: RB, mass: 40 });
    p.mesh.scale.y = 0.003;
    p.z = 0;
    p.vz = 0;
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
    {
      const pts = [];
      const turns = 6, rr = 0.10, h = 0.38;
      for (let i = 0; i <= turns * 16; i++) {
        const a = (i / 16) * TAU;
        pts.push(fr.F(Math.cos(a) * rr, Math.sin(a) * rr, y + 0.02 + (h * i) / (turns * 16)));
      }
      pipe(up, pts, 0.016, [0.10, 0.36, 0.18], 6, false);
    }
    const hinge = fr.F(0, 0, y + 0.02);
    const p = mover('rider', hinge, fr.V, (B) => {
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
    }, { mass: 12 });
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
        const L = H - 0.03 - 0.45;
        mover('seatA', hinge, axis, (B) => seatGeo(B, L, 0.42, [0.50, 0.46, 0.38]), { L, mass: 2.5 });
      }
      block(t - len / 2 - 0.7, t + len / 2 + 0.6, s - 0.12, s + 0.12, y, H);
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
        const L = H - 0.05 - 0.42;
        mover('seatA', hinge, fr.U, (B) => seatGeo(B, L, 0.44), { L, mass: 2.5 });
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
      mover('rope', tip, fr.V, (B) => {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const f = i / 40;
          pts.push([0.006 * Math.sin(f * 37), -L * f, 0.006 * Math.cos(f * 29)]);
        }
        const ROPE = [0.62, 0.56, 0.44];
        pipe(B, pts, (i) => 0.014 + 0.002 * Math.sin(i * 2.1), ROPE, 7, true);
        for (let k = 1; k <= 5; k++) {
          ball(B, [0, -L * (k / 5.6) - 0.15, 0], 0.035, shade(ROPE, 0.9), 8, 5, 0.75);
        }
        // The frayed end.
        pipe(B, [[0, -L, 0], [0.01, -L - 0.06, 0.005]], (i) => (i ? 0.004 : 0.02), ROPE, 7);
      }, { L, mass: 2 });
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
  function buildTable(t, s) {
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

  // ── the motion ─────────────────────────────────────────────────────────────
  //
  // Until the AVBD pass: a damped pendulum per hanging thing, a hinged beam
  // with a resting end for the seesaw, a spring per bed and for the rider.
  // Pushed by the hose (`jet`, where the water lands, and `who`, where it
  // comes from) and by walking into a seat. A breeze is a slow sum of two
  // sines per part at its own phase — a few degrees at most on a seat and
  // nearly nothing on the nest — so the place is not frozen and not busy.
  const _v = new THREE.Vector3();
  const centre = P(G.t0 + 8, G.s0 + 7, 0), centreA = P(383, 24, 0), centreP = P(552, pongS, 0);
  let clock = 0, awake = 0;
  // A part's working point in the world: where the hose would hit it.
  const tipOf = (p) => {
    if (p.kind === 'seesaw') return null;
    if (p.kind === 'tramp' || p.kind === 'rider') return p.hinge;
    const L = p.L * 0.95;
    const c = Math.cos(p.th), sn = Math.sin(p.th);
    // y' = −L cos θ, z' = −L sin θ in the hinge frame.
    return [p.hinge[0] - p.side[0] * L * sn, p.hinge[1] - L * c, p.hinge[2] - p.side[2] * L * sn];
  };
  function tick(dt, cam, who, jet) {
    // Asleep unless somebody is within 90 m of one of the three sites.
    const near = (c) => Math.hypot(cam.x - c[0], cam.z - c[2]) < 90;
    if (!near(centre) && !near(centreA) && !near(centreP)) { awake = 0; return; }
    awake = 1;
    dt = Math.min(dt, 0.05);
    clock += dt;
    const g = 9.81;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      let push = 0;
      // The hose: where it lands, and which way it is going.
      if (jet) {
        const tp = p.kind === 'seesaw'
          ? null : tipOf(p);
        if (p.kind === 'seesaw') {
          // Either end: the end nearer the jet goes down.
          for (const sg of [-1, 1]) {
            const e = [p.hinge[0] + p.side[0] * sg * p.HL * 0.85, p.hinge[1],
              p.hinge[2] + p.side[2] * sg * p.HL * 0.85];
            if (Math.hypot(jet.x - e[0], jet.z - e[2]) < 0.6) push += -sg * 4.0;
          }
        } else if (tp && Math.hypot(jet.x - tp[0], jet.z - tp[2]) < (p.r || 0.45) + 0.25
          && jet.y > tp[1] - 0.6 && jet.y < tp[1] + 1.2) {
          if (p.kind === 'tramp' || p.kind === 'rider') push = 1;
          else if (who) {
            const dx = jet.x - who.x, dz = jet.z - who.z, L = Math.hypot(dx, dz) || 1;
            // Along the swing's own direction (−side for +θ).
            push = -(dx * p.side[0] + dz * p.side[2]) / L;
          }
        }
      }
      // And a walker who steps into a hanging seat shoves it.
      if (who && (p.kind === 'seat' || p.kind === 'seatA' || p.kind === 'nest' || p.kind === 'rope')) {
        const tp = tipOf(p);
        const dx = tp[0] - who.x, dz = tp[2] - who.z;
        const d = Math.hypot(dx, dz);
        const R = (p.r || 0.2) + 0.25;
        if (d < R && who.y < tp[1] + 0.3 && who.y + 1.7 > tp[1]) {
          const k = (R - d) / R;
          const along = (dx * p.side[0] + dz * p.side[2]) / (d || 1);
          p.om += -along * k * 6 * dt;
        }
      }
      if (p.kind === 'tramp') {
        // A stiff bed: about 3 Hz, a few bounces.
        const k = 360, c = 3.2;
        const a = -k * p.z - c * p.vz - push * 8.0;
        p.vz += a * dt; p.z += p.vz * dt;
        // 3.5 cm down at most: under that is the resort's gravel pad, which
        // would cover a deeper dent. The AVBD pass wants a hole cut in it.
        p.z = clamp(p.z, -0.035, 0.01);
        p.mesh.scale.y = Math.max(0.003, -p.z + 0.003);
        continue;
      }
      if (p.kind === 'rider') {
        const k = 40, c = 2.0;
        const a = -k * p.th - c * p.om + push * 6 * Math.sin(clock * 9) ;
        p.om += a * dt; p.th += p.om * dt;
        p.th = clamp(p.th, -0.35, 0.35);
        p.mesh.rotation.x = p.th;
        continue;
      }
      if (p.kind === 'seesaw') {
        // It lies on its resting end; push lifts that end over and it falls
        // the other way, and the stops bounce it a little.
        const bias = p.thRest < 0 ? -1.2 : 1.2;
        const a = bias + push - 1.5 * p.om;
        p.om += a * dt; p.th += p.om * dt;
        if (p.th < -p.lim) { p.th = -p.lim; p.om = -p.om * 0.25; }
        if (p.th > p.lim) { p.th = p.lim; p.om = -p.om * 0.25; }
        p.mesh.rotation.x = p.th;
        continue;
      }
      // A pendulum.
      const ph = i * 1.7;
      const breeze = (p.kind === 'nest' ? 0.05 : 0.22)
        * (Math.sin(clock * 0.37 + ph) * 0.6 + Math.sin(clock * 0.91 + ph * 2.3) * 0.4);
      const a = -(g / p.L) * Math.sin(p.th) - 0.25 * p.om + breeze + push * 5.0;
      p.om += a * dt; p.th += p.om * dt;
      p.th = clamp(p.th, -1.25, 1.25);
      p.mesh.rotation.x = p.th;
    }
  }

  const stats = () => ({
    tris: Math.round((up.count() + rub.count() + floor.count()) / 3),
    sapTris: Math.round((sapMesh.geometry.index ? sapMesh.geometry.index.count : 0) / 3),
    moverTris: Math.round(parts.reduce((a, p) => a + p.tris, 0)),
    movers: parts.length, blockers: runs.length, awake,
  });

  return {
    meshes: [upMesh, rubMesh, floorMesh, sapMesh, ...parts.map((p) => p.mesh)],
    casters: [upMesh],
    trees: [sapMesh],
    movers: parts.map((p) => p.mesh),
    parts,
    blockers: runs.length,
    tick,
    stats,
    /** Kick part `i` (all if i < 0): ω += v for a hinge, vz += v for a bed. */
    push(i, v) {
      for (let k = 0; k < parts.length; k++) {
        if (i >= 0 && k !== i) continue;
        const p = parts[k];
        if (p.kind === 'tramp') p.vz += v; else p.om += v;
      }
      return parts.length;
    },
    list: () => parts.map((p, k) => ({ i: k, kind: p.kind,
      hinge: p.hinge.map((x) => +x.toFixed(2)), th: +p.th.toFixed(3),
      z: p.z != null ? +p.z.toFixed(3) : undefined })),
    /** For tests: the (t, s) of the three sites. */
    sites: { B: [(G.t0 + G.t1) / 2, (G.s0 + G.s1) / 2], A: [383, 24], pong: [552.5, pongS] },
  };
}
