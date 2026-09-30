// ---------------------------------------------------------------------------
// THE BELT — a metre of leather, out of her jeans and into her hand.
//
// Misha, 30 Sep 2026: *"would be cool if in kabine when spanking. I (chloe)
// take out my belt and spank baye with it, also could probably reuse the AVBD
// physics for it"*.
//
// This file is the strap: the physics, the drawing and the reading of where it
// lands. What your hand does with it — out of the loops, held, swung, fed back
// — and what she says about it are in 90-app.js (`BELT_HAND`, `beltTick`),
// and where on her it lands and what that does to her ragdoll is in
// 43-jadrija.js (`beltHit`).
//
// THE STRAP IS AN AVBD NET (43-avbd.js, (k)): twenty flat links jointed end to
// end, the buckle end held by a world joint that is your fist, and the tongue
// end free. Between each pair of links an angle ((h) there): a soft drive
// toward straight, which is the leather's stiffness, and two hard limits —
// it barely bends edgewise, and twists only so far a link — so it curls over
// her the way a strap does and never folds sideways like a chain. It meets her
// body as kinematic capsules (the nineteen the cuff chains lie on), the
// mattress and the pillow as world boxes, and the floor.
//
// A HIT IS WHERE A LINK MEETS HER, and nothing else. The press does not decide
// that the belt landed; the strap does, when one of its links makes a contact
// with one of her capsules closing faster than `hit.pat`. The first such
// contact opens a lash; everything else of the strap that lands on her within
// `hit.window` — which is the rest of it wrapping round her — is the same
// lash, and the line between its two furthest contacts is the mark it leaves.
// How hard is the fastest closing speed in it, which the solver measured.
//
// IT SIMULATES ONLY WHILE IT IS OUT. In your jeans it is paint (49-you.js);
// coming out or going back it is laid along a curve (`lay`) and not solved.
// ---------------------------------------------------------------------------

const BELT = {
  // A man's-width belt, a woman's length: 1.02 m of 34 mm leather, 4.2 mm
  // thick, 140 g with the buckle's share. Twenty links of 51 mm — the ragdoll
  // of a strap: enough to curl round a thigh 12 cm across, few enough that the
  // whole of it is 0.3 ms.
  len: 1.02, links: 20, width: 0.034, thick: 0.0042, mass: 0.14,
  // Its collision radius, m: a hair more than half its thickness, because a
  // capsule is round and the leather is flat — the drawn strap lies 2 mm off
  // whatever it is on, which is not something anybody can see.
  r: 0.006,
  // THE LEATHER. `bend` N·m/rad a joint, toward straight: EI for veg-tan
  // (E ~ 100 MPa, I = w·t³/12) over a link is 0.37, and this is a worn belt.
  // Hanging from the buckle it falls in a curve and not a plumb line, and at
  // the top of a swing it is still a line and not a heap. `bendD` its damping,
  // N·m·s/rad — the whip dies with it, so it is small. `edge` rad a joint
  // edgewise and `twist` about its own run, both hard.
  bend: 0.30, bendD: 0.0010, edge: 0.08, twist: 0.55,
  // The fist: the buckle end held to the hand's attitude at `grip` N·m/rad.
  grip: 3.0,
  // THE AIM, `guide` N/m: from the top of a swing until it lands, a spring
  // that only pulls, from the point aimed at to the tongue end. It is the
  // wrist, which a person who has swung a belt uses without thinking — a
  // strap unrolling at twenty metres a second off a hand that is guessing
  // lands anywhere in a circle a foot across (MEASURED, five in twelve of a
  // set of swings at her bottom from round the cot landed on it, the back or
  // a hip; the rest her arms lying at her sides, or nothing). Seven grams at
  // the tip: at 0.4 N/m and 30 cm off it is 17 m/s² — it steers, it does not
  // carry. Off the moment the lash opens: where it lands, it is the strap's.
  guide: 0.4,
  // 240 Hz, ten iterations, and as many steps a frame as a 20 fps frame
  // needs: the hand's path runs on the frame's clock, and a strap that fell
  // behind it (eight steps a frame, MEASURED headless at ~25 fps) was a strap
  // swung twice as fast as it was asked, and landed on her arm every time
  // instead of where it was aimed.
  h: 1 / 240, maxSub: 12, iterations: 10,
  // Air (1/s), leather on skin and on cotton, how near a contact is made and
  // how deep a new one may start (the tip moves 6 cm a step at 15 m/s).
  drag: 0.30, mu: 0.45, margin: 0.004, deep: 0.05,
  // And while it is wound up over your shoulder, 1/s: a person lets it
  // settle behind them before it comes forward. Without it a swing started
  // while the last one was still coming back began from wherever the strap
  // happened to be, and three quick ones in a row landed nowhere (MEASURED).
  windDrag: 5,
  // THE HIT, all speeds m/s closing on her skin. Under `pat` it is only
  // touching her; from there to `crack` a pat — a lazy swing lands like a
  // hand laid on her — and past it the crack, harder up to `top`. `J` N·s on
  // her ragdoll across that range (the hand's slap is 10-13: a belt is lighter
  // and sharper, and most of what it does is the sting and not the shove);
  // `mark` the strength of the line it leaves; `window` s a lash stays open
  // for the rest of the strap to land; `cool` s before the next one opens.
  // `land` s: how long after the first contact a harder one still says
  // where it landed — the strap arriving along its length; after that it is
  // the tongue wrapping on round her, which is how hard and not where.
  hit: { pat: 1.2, crack: 4.0, top: 10, J: [0.8, 7.0], mark: [0.08, 0.45], window: 0.07, cool: 0.22, land: 0.02 },
  // The guard: any link faster than this, or NaN, and it is hung again.
  guard: 45,
  // Colours: the leather, its edges (burnished darker), the buckle.
  leather: [0.235, 0.120, 0.058], edgeC: [0.120, 0.058, 0.030], metal: [0.62, 0.60, 0.55],
  // The holes, from the tongue end, m.
  holes: [0.105, 0.130, 0.155, 0.180, 0.205],
};

/**
 * The strap. `scene` is where it is drawn. See the note at the top of the
 * file for what it is; the controls are `hang`, `lay`, `release`, `step`,
 * `hide`, and `onHit` is set by whoever wants to know where it landed.
 */
function beltStrap(scene) {
  const B = BELT, n = B.links, pitch = B.len / n, half = pitch / 2, m = B.mass / n;
  const w = B.width, t = B.thick;
  const inert = [m * (w * w + t * t) / 12, m * (pitch * pitch + w * w) / 12, m * (pitch * pitch + t * t) / 12, 0, 0, 0];
  const net = avbdNet({
    maxBodies: n, maxJoints: n, maxStrings: 1, maxPoints: 0, maxBoxes: 0, maxCaps: n,
    maxContacts: 320, maxAngles: n, maxWorldBoxes: 2, maxCapPairs: 0, maxWorldCaps: 32,
    iterations: B.iterations, alpha: 0.95, alphaContact: 0.9, beta: 1e5, betaAng: 1e4, betaLim: 1e4,
    limK: 40, gamma: 0.999, gravity: [0, -9.81, 0], drag: B.drag, vMax: 40, wMax: 600,
    margin: B.margin, deep: B.deep, mu: B.mu, floorMu: 0.6, capK: 30000,
  });
  for (let i = 0; i < n; i++) net.addBody(m, inert, 0, -i * pitch, 0, null);
  // The fist: link 0's back end to the hand, position and attitude.
  const grip = net.addJoint(-1, [0, 0, 0], 0, [-half, 0, 0], Infinity, B.grip, 1);
  for (let i = 1; i < n; i++) net.addJoint(i - 1, [half, 0, 0], i, [-half, 0, 0]);
  const ID = [0, 0, 0, 1];
  for (let i = 1; i < n; i++) {
    const a = net.addAngle(i - 1, i, ID, ID);
    net.setAngleK(a, B.bend, B.bendD);
    // x its twist, y edgewise, z the flat bend — which is free but for `bend`.
    net.setAngleLimits(a, [-B.twist, -B.edge, -10], [B.twist, B.edge, 10]);
  }
  for (let i = 0; i < n; i++) {
    const c = net.addCap(i, i);
    net.setCap(c, -half, 0, 0, half, 0, 0, B.r, B.r);
  }
  const guide = net.addString(-1, [0, 0, 0], n - 1, [half, 0, 0], 0, B.guide, true);
  net.finish();
  net.setString(guide, null, null, false);
  let aiming = false;
  for (let i = 0; i < n; i++) net.setLive(i, false);

  // ── state ─────────────────────────────────────────────────────────────
  let mode = 'off';               // 'off' | 'lay' | 'sim'
  let outLen = 0;                 // how much of it is out of the loops, m
  let acc = 0;
  const handWas = new THREE.Vector3(), qWas = new THREE.Quaternion();
  const _hp = new THREE.Vector3(), _hq = new THREE.Quaternion();
  const qArr = [0, 0, 0, 1];
  const touchWas = new Uint8Array(n), touchNow = new Uint8Array(n);
  let lash = null, cool = 0;
  const stats = { ms: 0, msMax: 0, msSum: 0, frames: 0, steps: 0, contacts: 0, onHer: 0,
    lashes: 0, pats: 0, rescues: 0, vMax: 0, tip: 0, stretch: 0, last: null };

  // ── the drawing ───────────────────────────────────────────────────────
  // Sections at every joint and every link's middle: 2n + 1, eight vertices
  // each (four faces, two corners a face, so each face has its own normal).
  const NS = 2 * n + 1;
  const pos = new Float32Array(NS * 8 * 3 + 16 * 3), nrm = new Float32Array(pos.length);
  const col = new Float32Array(pos.length);
  const idx = [];
  for (let k = 0; k < NS - 1; k++) {
    for (let f = 0; f < 4; f++) {
      const a = k * 8 + 2 * f, b = a + 1, c = a + 9, d = a + 8;
      idx.push(a, b, c, a, c, d);
    }
  }
  const capAt = NS * 8;           // two end caps, four vertices each
  idx.push(capAt, capAt + 1, capAt + 2, capAt, capAt + 2, capAt + 3);
  idx.push(capAt + 4, capAt + 6, capAt + 5, capAt + 4, capAt + 7, capAt + 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  // (The vertex colour is the leather's; `solidMaterial` hands it over as
  // vVCol and leaves using it to the body.)
  const mat = solidMaterial(0xffffff, { spec: 0.22, specPower: 34, side: THREE.DoubleSide, body: 'base *= vVCol;' });
  const strap = new THREE.Mesh(geo, mat);
  strap.frustumCulled = false;
  strap.visible = false;
  scene.add(strap);
  // The buckle: a frame round the end of the strap and its prong, drawn in the
  // frame of link 0 — its x along the strap, z across it.
  const buckle = new THREE.Group();
  {
    const bm = solidMaterial(new THREE.Color(...B.metal), { spec: 0.9, specPower: 90, vcol: false });
    // Centred on the end of the strap, which is where the fist closes: a
    // buckle held is a buckle mostly in a hand, and the frame shows either
    // side of the grip rather than standing off above it.
    const bw = w * 0.5 + 0.005, bl = 0.046, bar = 0.0035, x0 = -half - bl * 0.5;
    const box = (sx, sy, sz, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), bm);
      b.position.set(x, y, z);
      buckle.add(b);
    };
    box(bar, bar, 2 * bw + bar, x0 - bl / 2, 0, 0);         // the far bar
    box(bar, bar, 2 * bw + bar, x0 + bl / 2, 0, 0);         // the near bar
    box(bl, bar, bar, x0, 0, bw);                           // the two sides
    box(bl, bar, bar, x0, 0, -bw);
    box(bl * 0.8, bar * 0.7, bar * 0.7, x0 + bl * 0.05, bar, 0);   // the prong
    buckle.visible = false;
    buckle.frustumCulled = false;
    scene.add(buckle);
  }
  // Colours are fixed: the leather, the edges darker, the holes near the tip.
  function paint() {
    let o = 0;
    for (let k = 0; k < NS; k++) {
      const s = (k / (NS - 1)) * B.len, fromTip = B.len - s;
      let hole = 0;
      for (const hs of B.holes) hole = Math.max(hole, 1 - Math.min(1, Math.abs(fromTip - hs) / 0.006));
      for (let f = 0; f < 4; f++) {
        const edge = f >= 2;
        const c = edge ? B.edgeC : B.leather;
        const d = !edge ? 1 - 0.75 * hole : 1;
        for (let v = 0; v < 2; v++) { col[o++] = c[0] * d; col[o++] = c[1] * d; col[o++] = c[2] * d; }
      }
    }
    for (let v = 0; v < 8; v++) { col[o++] = B.edgeC[0]; col[o++] = B.edgeC[1]; col[o++] = B.edgeC[2]; }
    geo.attributes.aVCol.needsUpdate = true;
  }
  paint();

  // Link i's axes, world: x along it, y through its thickness, z across it.
  const ax = new Float64Array(9);
  function axes(i) {
    const Q = net.Q, x = Q[4 * i], y = Q[4 * i + 1], z = Q[4 * i + 2], ww = Q[4 * i + 3];
    ax[0] = 1 - 2 * (y * y + z * z); ax[1] = 2 * (x * y + ww * z); ax[2] = 2 * (x * z - ww * y);
    ax[3] = 2 * (x * y - ww * z); ax[4] = 1 - 2 * (x * x + z * z); ax[5] = 2 * (y * z + ww * x);
    ax[6] = 2 * (x * z + ww * y); ax[7] = 2 * (y * z - ww * x); ax[8] = 1 - 2 * (x * x + y * y);
  }
  // The sections this frame: centre, y and z, and how wide.
  const secP = new Float64Array(NS * 3), secY = new Float64Array(NS * 3), secZ = new Float64Array(NS * 3);
  const secW = new Float64Array(NS);
  function sections() {
    const P = net.P;
    for (let i = 0; i < n; i++) {
      axes(i);
      const c = 2 * i + 1;
      for (let r = 0; r < 3; r++) {
        secP[3 * c + r] = P[3 * i + r];
        secY[3 * c + r] = ax[3 + r]; secZ[3 * c + r] = ax[6 + r];
        const a = P[3 * i + r] - ax[r] * half, e = P[3 * i + r] + ax[r] * half;
        // The joints: the two ends that meet there, and the two frames, averaged.
        if (i === 0) { secP[r] = a; secY[r] = ax[3 + r]; secZ[r] = ax[6 + r]; } else {
          secP[3 * (c - 1) + r] = 0.5 * (secP[3 * (c - 1) + r] + a);
          secY[3 * (c - 1) + r] += ax[3 + r]; secZ[3 * (c - 1) + r] += ax[6 + r];
        }
        secP[3 * (c + 1) + r] = e; secY[3 * (c + 1) + r] = ax[3 + r]; secZ[3 * (c + 1) + r] = ax[6 + r];
      }
    }
    for (let k = 0; k < NS; k++) {
      const s = (k / (NS - 1)) * B.len, fromTip = B.len - s;
      // The tongue end cut to a point, over its last 3 cm.
      secW[k] = w * (fromTip < 0.03 ? 0.45 + 0.55 * Math.sqrt(fromTip / 0.03) : 1);
    }
  }
  function draw() {
    if (mode === 'off') { strap.visible = false; buckle.visible = false; return; }
    sections();
    // Out of the loops only as far as `outLen`: the sections past it are
    // folded on to the last one, which is where it goes into her jeans.
    const last = Math.min(NS - 1, Math.max(1, Math.round(outLen / B.len * (NS - 1))));
    let o = 0;
    for (let k = 0; k < NS; k++) {
      const kk = Math.min(k, last);
      const px = secP[3 * kk], py = secP[3 * kk + 1], pz = secP[3 * kk + 2];
      let yx = secY[3 * kk], yy = secY[3 * kk + 1], yz = secY[3 * kk + 2];
      let zx = secZ[3 * kk], zy = secZ[3 * kk + 1], zz = secZ[3 * kk + 2];
      const yl = Math.hypot(yx, yy, yz) || 1, zl = Math.hypot(zx, zy, zz) || 1;
      yx /= yl; yy /= yl; yz /= yl; zx /= zl; zy /= zl; zz /= zl;
      const hw = secW[kk] * 0.5, ht = t * 0.5;
      // Top (+y), bottom (−y), and the two edges (+z, −z).
      const faces = [[1, 1, -1, 1, yx, yy, yz], [-1, -1, 1, -1, -yx, -yy, -yz],
        [1, 1, 1, -1, zx, zy, zz], [-1, -1, -1, 1, -zx, -zy, -zz]];
      for (const [z0, y0, z1, y1, nx, ny, nz] of faces) {
        for (const [zs, ys] of [[z0, y0], [z1, y1]]) {
          pos[3 * o] = px + zx * hw * zs + yx * ht * ys;
          pos[3 * o + 1] = py + zy * hw * zs + yy * ht * ys;
          pos[3 * o + 2] = pz + zz * hw * zs + yz * ht * ys;
          nrm[3 * o] = nx; nrm[3 * o + 1] = ny; nrm[3 * o + 2] = nz;
          o++;
        }
      }
    }
    // The two ends, closed.
    for (const [k, sg] of [[0, -1], [last, 1]]) {
      const px = secP[3 * k], py = secP[3 * k + 1], pz = secP[3 * k + 2];
      const yv = [secY[3 * k], secY[3 * k + 1], secY[3 * k + 2]], zv = [secZ[3 * k], secZ[3 * k + 1], secZ[3 * k + 2]];
      const hw = secW[k] * 0.5, ht = t * 0.5;
      const xv = [yv[1] * zv[2] - yv[2] * zv[1], yv[2] * zv[0] - yv[0] * zv[2], yv[0] * zv[1] - yv[1] * zv[0]];
      for (const [zs, ys] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        pos[3 * o] = px + zv[0] * hw * zs + yv[0] * ht * ys;
        pos[3 * o + 1] = py + zv[1] * hw * zs + yv[1] * ht * ys;
        pos[3 * o + 2] = pz + zv[2] * hw * zs + yv[2] * ht * ys;
        nrm[3 * o] = xv[0] * sg; nrm[3 * o + 1] = xv[1] * sg; nrm[3 * o + 2] = xv[2] * sg;
        o++;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    strap.visible = true;
    // The buckle rides link 0.
    const Q = net.Q, P = net.P;
    // At the fist: link 0's back end, shifted forward by the buckle's half.
    axes(0);
    buckle.position.set(P[0] + ax[0] * 0.023, P[1] + ax[1] * 0.023, P[2] + ax[2] * 0.023);
    buckle.quaternion.set(Q[0], Q[1], Q[2], Q[3]);
    buckle.visible = true;
  }

  // ── laying it along a curve (out of the loops, and back into them) ────
  const _t = new THREE.Vector3(), _z = new THREE.Vector3(), _y = new THREE.Vector3();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  const layP = new Float64Array(3 * n);
  /**
   * Every link along the polyline `pts` (arrays [x, y, z], from the buckle),
   * the strap's width across `side` (a world vector), `len` of it out; the
   * rest folded at the end of the line. `dt` gives them the velocity of the
   * move, so letting go of a laid strap throws it on as it was going. `blend`
   * 0..1 of the way from where each link is to where the curve puts it.
   */
  function lay(pts, len, side, dt = 0, blend = 1) {
    if (aiming) aim(null);
    mode = 'lay';
    outLen = Math.max(0, Math.min(B.len, len));
    const cum = [0];
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      cum.push(cum[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    const L = cum[cum.length - 1];
    const at = (s, out) => {
      s = Math.max(0, Math.min(L, s));
      let k = 1;
      while (k < pts.length - 1 && cum[k] < s) k++;
      const a = pts[k - 1], b = pts[k], u = (s - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]);
      out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + (b[2] - a[2]) * u;
      _t.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      return out;
    };
    const p = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const s = Math.min(outLen, (i + 0.5) * pitch);
      at(s * (L > 0 ? Math.min(1, L / Math.max(outLen, 1e-6)) : 0), p);
      if (L <= 1e-6) _t.set(0, -1, 0);
      _z.set(side[0], side[1], side[2]);
      _z.addScaledVector(_t, -_z.dot(_t));
      if (_z.lengthSq() < 1e-8) _z.set(0, 0, 1).addScaledVector(_t, -_t.z);
      _z.normalize();
      _y.crossVectors(_z, _t);
      _m.makeBasis(_t, _y, _z);
      _q.setFromRotationMatrix(_m);
      const P = net.P, Q = net.Q, V = net.V, W = net.W;
      for (let r = 0; r < 3; r++) {
        const now = P[3 * i + r] + (p[r] - P[3 * i + r]) * blend;
        V[3 * i + r] = dt > 0 ? (now - P[3 * i + r]) / dt : 0;
        layP[3 * i + r] = now;
        P[3 * i + r] = now;
        W[3 * i + r] = 0;
      }
      const qq = [_q.x, _q.y, _q.z, _q.w];
      if (blend < 1) {
        _hq.set(Q[4 * i], Q[4 * i + 1], Q[4 * i + 2], Q[4 * i + 3]).slerp(_q, blend);
        qq[0] = _hq.x; qq[1] = _hq.y; qq[2] = _hq.z; qq[3] = _hq.w;
      }
      Q[4 * i] = qq[0]; Q[4 * i + 1] = qq[1]; Q[4 * i + 2] = qq[2]; Q[4 * i + 3] = qq[3];
    }
    draw();
  }

  /** From laid to solved, as it lies and moving as it was: the buckle in the hand at `hand`/`q`. */
  function release(hand, q) {
    const V = net.V.slice();
    for (let i = 0; i < n; i++) net.setLive(i, true);     // setLive zeroes the velocity: give it back
    net.V.set(V);
    net.resetDuals();
    handWas.copy(hand); qWas.copy(q);
    qArr[0] = q.x; qArr[1] = q.y; qArr[2] = q.z; qArr[3] = q.w;
    net.setTarget(grip, hand.x, hand.y, hand.z, qArr, false);
    net.setTarget(grip, hand.x, hand.y, hand.z, qArr, true);
    touchWas.fill(0);
    lash = null; cool = 0; acc = 0;
    outLen = B.len;
    mode = 'sim';
  }

  /** Hung afresh from the hand, straight down its `dir`, at rest. */
  function hang(hand, q, dir = [0, -1, 0], side = [1, 0, 0]) {
    const d = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const pts = [[hand.x, hand.y, hand.z],
      [hand.x + dir[0] / d * B.len, hand.y + dir[1] / d * B.len, hand.z + dir[2] / d * B.len]];
    lay(pts, B.len, side, 0, 1);
    release(hand, q);
  }

  /** Steer the tongue toward world point `p` ([x, y, z]) — see BELT.guide — or, null, stop. */
  function aim(p) {
    aiming = !!p;
    if (p) net.setString(guide, p, 0, true); else net.setString(guide, null, null, false);
  }

  function hide() {
    aim(null);
    mode = 'off';
    outLen = 0;
    for (let i = 0; i < n; i++) net.setLive(i, false);
    lash = null;
    draw();
  }

  // ── the world, and a step ─────────────────────────────────────────────
  /**
   * Where she is, the cot and the floor, for the next step. `caps` eight
   * numbers a capsule (ends, radii) and `nc` of them; `boxes` seven a box
   * (centre, half extents, yaw) and `nb`; `floor` a height.
   */
  function world(caps, nc, boxes, nb, floor) {
    net.setWorldCaps(caps, nc);
    net.setWorldBoxes(boxes || [], nb || 0);
    net.setFloor(() => floor);
  }

  /** Hits, after each step — see the note at the top on what a lash is. */
  function scan(h) {
    touchNow.fill(0);
    let onHer = 0;
    net.worldCapHits((i, cap, x, y, z, nx, ny, nz, vIn) => {
      touchNow[i] = 1;
      onHer++;
      if (lash) {
        lash.pts.push([x, y, z, cap, nx, ny, nz, vIn, lash.t, i]);
        // Where it LANDED is the hardest contact of its first `land` s — the
        // strap arriving; how hard is the hardest of all of it, which is
        // often the tongue coming round after it (see `hit.land`).
        if (lash.t <= B.hit.land && vIn > lash.vLand) {
          lash.vLand = vIn; lash.at = [x, y, z]; lash.cap = cap; lash.n = [nx, ny, nz]; lash.link = i;
        }
        if (vIn > lash.v) lash.v = vIn;
      } else if (!touchWas[i] && cool <= 0 && vIn > B.hit.pat) {
        lash = { t: 0, v: vIn, vLand: vIn, at: [x, y, z], cap, n: [nx, ny, nz], link: i,
          pts: [[x, y, z, cap, nx, ny, nz, vIn, 0, i]] };
        aim(null);
      }
    });
    stats.onHer = onHer;
    touchWas.set(touchNow);
    if (cool > 0) cool -= h;
    if (lash && (lash.t += h) >= B.hit.window) {
      const L = lash;
      lash = null;
      cool = B.hit.cool;
      // The line: its two furthest contacts.
      let best = 0, a = L.pts[0], b = L.pts[0];
      for (let p = 0; p < L.pts.length; p++) {
        for (let q = p + 1; q < L.pts.length; q++) {
          const P1 = L.pts[p], P2 = L.pts[q];
          const d = (P1[0] - P2[0]) ** 2 + (P1[1] - P2[1]) ** 2 + (P1[2] - P2[2]) ** 2;
          if (d > best) { best = d; a = P1; b = P2; }
        }
      }
      if (L.v >= B.hit.crack) stats.lashes++; else stats.pats++;
      stats.vMax = Math.max(stats.vMax, L.v);
      axes(L.link);
      // Every contact of it goes with it — [x, y, z, capsule, nx, ny, nz, vIn,
      // t, link] — so what it landed ON can be chosen by what her skin there is
      // (see `beltHit` in 43-jadrija.js), and not only by speed.
      const out = { v: L.v, at: L.at, cap: L.cap, n: L.n, link: L.link, a, b, len: Math.sqrt(best),
        contacts: L.pts.length, dir: [ax[0], ax[1], ax[2]], pts: L.pts, land: B.hit.land };
      stats.last = { v: +L.v.toFixed(2), cap: L.cap, link: L.link, len: +Math.sqrt(best).toFixed(3), contacts: L.pts.length };
      if (api.onHit) api.onHit(out);
    }
  }

  function sane() {
    const P = net.P, V = net.V;
    for (let i = 0; i < n; i++) {
      const o = 3 * i;
      if (!(P[o] === P[o] && P[o + 1] === P[o + 1] && P[o + 2] === P[o + 2])) return false;
      if (V[o] * V[o] + V[o + 1] * V[o + 1] + V[o + 2] * V[o + 2] > B.guard * B.guard) return false;
    }
    return true;
  }

  /**
   * A frame of it: the hand carried from where it was to `hand`/`q` over the
   * frame's steps, the strap solved at each, and its hits read.
   */
  function step(dt, hand, q) {
    if (mode !== 'sim') return;
    const t0 = performance.now();
    acc += Math.min(dt, 0.1);
    let steps = Math.floor(acc / B.h);
    if (steps > B.maxSub) { steps = B.maxSub; acc = 0; } else acc -= steps * B.h;
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      _hp.lerpVectors(handWas, hand, u);
      _hq.slerpQuaternions(qWas, q, u);
      qArr[0] = _hq.x; qArr[1] = _hq.y; qArr[2] = _hq.z; qArr[3] = _hq.w;
      net.setTarget(grip, _hp.x, _hp.y, _hp.z, qArr, true);
      net.step(B.h);
      scan(B.h);
      stats.steps++;
    }
    if (steps) { handWas.copy(hand); qWas.copy(q); }
    if (!sane()) {
      stats.rescues++;
      hang(hand, q);
    }
    stats.contacts = net.stats.contacts;
    const T = 3 * (n - 1);
    stats.tip = Math.hypot(net.V[T], net.V[T + 1], net.V[T + 2]);
    draw();
    const ms = performance.now() - t0;
    stats.ms = ms; stats.msMax = Math.max(stats.msMax, ms); stats.msSum += ms; stats.frames++;
  }

  /** Where the tongue end is, and the buckle — world. */
  function ends() {
    const P = net.P;
    axes(0);
    const b = [P[0] - ax[0] * half, P[1] - ax[1] * half, P[2] - ax[2] * half];
    axes(n - 1);
    const T = 3 * (n - 1);
    return { buckle: b, tip: [P[T] + ax[0] * half, P[T + 1] + ax[1] * half, P[T + 2] + ax[2] * half] };
  }

  const api = {
    net, strap, buckle, stats,
    get mode() { return mode; },
    get out() { return outLen; },
    hang, lay, release, hide, world, step, ends, draw, aim,
    /** Air on every link, 1/s — BELT.drag, or `windDrag` while it is wound up. */
    setDrag: (d) => { for (let i = 0; i < n; i++) net.drag[i] = d; },
    get aiming() { return aiming; },
    /** The worst joint gap now, m — how much it stretches. */
    stretch: () => { net.measure(); return net.stats.maxStretch; },
    /** Where each link is, world — for a probe. */
    links: () => Array.from({ length: n }, (_, i) => [net.P[3 * i], net.P[3 * i + 1], net.P[3 * i + 2]]),
    onHit: null,
  };
  return api;
}
