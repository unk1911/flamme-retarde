// -----------------------------------------------------------------------------
// Kitesurfers, in the channel.
//
// The wind in this game is a lebić — south-west, nine and a half metres a
// second — and it was chosen for the fire: it is the wind that pushes a burn
// off Jadrija and up the peninsula toward the town, which is why today is a bad
// day. Nine and a half metres a second is also nineteen knots, and nineteen
// knots across the flat water inside a headland is the best afternoon of
// somebody else's summer. The same wind. That is the whole idea here.
//
// Šibenik's channel is a real kite spot for exactly the reason the game already
// models: Sveti Ante narrows the sea to three hundred metres between two hills,
// so the afternoon wind funnels and the fetch is short, which gives you strong
// wind over water with no swell in it. There are kites out there most summer
// afternoons. Putting them in costs almost nothing and buys the one thing this
// bay was missing from the air — something moving fast at sea level that is
// nothing to do with you and is having a much better day.
//
// Three notes on what is here and what is not.
//
// It is scenery, and it is scenery you can fly at. Nobody rides one of these
// yet. What they are is a proper little simulation rather than a sprite on a
// path: a rider who is actually holding a bar, on lines that actually reach a
// canopy, sitting in the part of the sky a kite can be in — and when the tack
// changes, the kite crosses over, the board edges the other way, and the rider
// leans the other side of vertical. Every one of those is what your eye checks
// without being asked, and the reason a kitesurfer drawn as a coloured arc
// gliding sideways looks wrong from two hundred metres.
//
// The canopy is a leading-edge inflatable, which is the kite you actually see
// here: a fat tube bent into an arc with a skin behind it. Not a foil, which is
// a different and much harder object, and not a flat wing, which is what it
// stops looking like the moment the light comes across it.
//
// And nothing jumps yet. A jump is a send, an edge, four metres of air and a
// landing, and every part of that wants the kite to move relative to the rider
// on its own clock; the tack is the same machinery and is the half worth
// having first. See `KITE.jump` for where it goes.
// -----------------------------------------------------------------------------

const KITE = {
  n: 7,                  // how many are out. On a good afternoon, about right.

  // Where they are. The channel and the water off Jadrija, not the open sea:
  // a kite spot is a stretch of flat water with a shore on the windward side,
  // and out in the middle of the bay there is nothing to flatten it.
  reach: 1500,           // m from the Jadrija site to look for water
  minShore: 90,          // far enough out not to be in the swimmers
  maxShore: 900,         // close enough in that the water is still flat

  // The run. A kiter does not go anywhere: they go back and forth across the
  // wind, which is what a tack is and what makes them readable at a distance.
  leg: [260, 620],       // m, one way
  speed: [8.5, 14.5],    // m/s — 17 to 28 knots, which is a beam reach in this
  carve: 2.6,            // s to come round at the end of a leg

  // The kite, in the window. Elevation off the water and how far round toward
  // the wind — a kite parked for a beam reach sits high and slightly forward,
  // and this is the pair of angles that says so.
  line: 24,              // m of line, which is what everybody flies
  elev: [0.62, 0.95],    // rad above the horizon, wandering between the two
  span: 8.4,             // m tip to tip — a 12 m kite, flattened
  chord: 2.35,
  arc: 1.35,             // rad of bend from tip to tip: an LEI is a deep arc

  // The rider. Leaning back against the pull, which is the pose, and the reason
  // a kitesurfer is recognisable in silhouette at a kilometre.
  lean: 0.44,            // rad off vertical, away from the kite
  tall: 1.74,

  jump: 0,               // not yet — see the note at the top of the file

  // Canopy colours. Kites are the loudest object on any sea and it is not an
  // accident: you are 24 m under it and everybody else on the water has to see
  // which way it is going.
  cloth: [
    [0.86, 0.16, 0.13], [0.95, 0.55, 0.06], [0.12, 0.42, 0.78],
    [0.92, 0.83, 0.10], [0.10, 0.62, 0.44], [0.80, 0.20, 0.52],
    [0.94, 0.94, 0.92],
  ],
};

/**
 * Concatenate a few geometries into one.
 *
 * Local, and eight lines, because there is nothing to reach for: three.js keeps
 * `mergeGeometries` in an addon this build does not carry, and everything else
 * in this project that wanted many pieces in one buffer was built as one buffer
 * to begin with. A rider is six lathes and a sphere and wants to be one draw.
 */
function kiteMerge(list) {
  const pos = [], idx = [];
  for (const g of list) {
    const base = pos.length / 3;
    const p = g.getAttribute('position').array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    const ix = g.getIndex();
    if (ix) for (const v of ix.array) idx.push(base + v);
    else for (let i = 0; i < p.length / 3; i++) idx.push(base + i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

/**
 * The canopy: a fat tube bent into an arc, with a skin hanging behind it.
 *
 * Built in the kite's own frame — span along X, the arc bending in Y, and the
 * chord running back along +Z, so the whole thing hangs below the origin and
 * the origin is where the lines meet. One `loft` of rings around the leading
 * edge tube, then a second surface for the canopy behind it.
 */
function kiteCanopy() {
  const S = 13;                       // stations across the span
  const T = 7;                        // sides of the leading-edge tube
  const le = [], sail = [];
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const a = (t - 0.5) * KITE.arc;   // where round the arc this station is
    const x = Math.sin(a) * (KITE.span * 0.5) / Math.sin(KITE.arc * 0.5);
    const y = (Math.cos(a) - Math.cos(KITE.arc * 0.5))
      * (KITE.span * 0.5) / Math.sin(KITE.arc * 0.5);
    // Tips are thinner and shorter, which is the taper every kite has.
    const taper = 0.42 + 0.58 * Math.sin(Math.PI * (0.12 + t * 0.76));
    const r = 0.145 * taper;
    const ring = [];
    for (let k = 0; k < T; k++) {
      const p = (k / T) * TAU;
      ring.push(new THREE.Vector3(x, y + Math.sin(p) * r, Math.cos(p) * r));
    }
    le.push(ring);
    // The trailing edge, swept back and tucked up: a kite in the air is not a
    // flat plate, it has a section, and the tuck is what catches the light
    // along the middle of it.
    sail.push([
      new THREE.Vector3(x, y, 0),
      new THREE.Vector3(x, y + 0.10 * taper,
        KITE.chord * taper * (0.55 + 0.45 * Math.sin(Math.PI * t))),
    ]);
  }
  const tube = loft(le, { closed: true, caps: true });
  const skin = loft(sail, { closed: false });
  return kiteMerge([tube, skin]);
}

/**
 * The rider: shoulders, trunk, legs, arms out to a bar.
 *
 * Six lofted pieces and no more. At the distance anybody sees one of these
 * from — the nearest you can get is a swim across the channel — the whole of
 * what reads is the lean, the bar, and the fact that the legs are bent. Detail
 * below that is detail nobody can see, which is the same rule the far trees
 * are built on.
 */
function kiteRider() {
  const parts = [];
  const limb = (r0, r1, len, at, rot) => {
    const g = new THREE.CylinderGeometry(r0, r1, len, 7, 1, false);
    g.translate(0, -len * 0.5, 0);
    if (rot) g.rotateZ(rot);
    g.translate(at[0], at[1], at[2]);
    parts.push(g);
  };
  const H = KITE.tall;
  // Trunk, from the shoulders down to the harness.
  limb(0.155, 0.125, H * 0.34, [0, H * 0.94, 0]);
  // Head.
  const head = new THREE.SphereGeometry(0.107, 8, 6);
  head.translate(0, H * 1.01, 0);
  parts.push(head);
  // Legs, bent: the knees are always up, because the board is on edge and the
  // rider is sitting back into the harness against the pull.
  for (const s of [-1, 1]) {
    limb(0.085, 0.070, H * 0.31, [s * 0.10, H * 0.60, 0.05], s * 0.30);
    limb(0.070, 0.058, H * 0.29, [s * 0.20, H * 0.30, 0.16], s * 0.10);
  }
  // Arms, forward and down to the bar.
  for (const s of [-1, 1]) {
    limb(0.058, 0.046, H * 0.36, [s * 0.17, H * 0.92, -0.02], s * 0.95);
  }
  return kiteMerge(parts);
}

/** The board. A twin tip: flat, rockered, and about as wide as a plank. */
function kiteBoard() {
  const rings = [];
  const L = 1.38, W = 0.42;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const z = (t - 0.5) * L;
    const w = W * 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.5) * 2, 4)));
    const rock = Math.pow((t - 0.5) * 2, 2) * 0.055;
    rings.push([
      new THREE.Vector3(-w, rock, z), new THREE.Vector3(-w, rock + 0.022, z),
      new THREE.Vector3(w, rock + 0.022, z), new THREE.Vector3(w, rock, z),
    ]);
  }
  return loft(rings, { closed: true, caps: true });
}

/**
 * The kitesurfers, and the water they are on.
 *
 * `jadrija` is only used for where to look: the spot is defined relative to the
 * bathing station because that is where the wind and the shelter are, and a
 * kite parked in the middle of the bay would be a kite nobody put there.
 */
function buildKites(scene, jadrija) {
  const group = new THREE.Group();
  scene.add(group);

  const canopyGeo = kiteCanopy();
  const riderGeo = kiteRider();
  const boardGeo = kiteBoard();
  // The wake: a tapered ribbon lying on the water behind the board. Flat, and
  // it does not need to be anything else — the reason you can see a kitesurfer
  // from a Canadair is not the rider, it is the white line behind them.
  const wakeGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 8);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  const riderMat = solidMaterial(new THREE.Color(0.085, 0.095, 0.115),
    { spec: 0.30, specPower: 40, vcol: false });
  const boardMat = solidMaterial(new THREE.Color(0.90, 0.90, 0.88),
    { spec: 0.42, specPower: 60, vcol: false });
  const lineMat = solidMaterial(new THREE.Color(0.82, 0.84, 0.86),
    { spec: 0.10, vcol: false });
  const wakeMat = solidMaterial(new THREE.Color(0.94, 0.97, 0.98),
    { spec: 0, emissive: 0.35, vcol: false, transparent: true,
      opacity: 0.55, depthWrite: false });

  const rng = mulberry32(CONFIG.seed ^ 0x6b17e5);
  const w = U.uWind.value;
  const wl = Math.hypot(w.x, w.y) || 1;
  const wx = w.x / wl, wz = w.y / wl;          // the way the wind is going
  const ax = -wz, az = wx;                     // and across it, which is the run

  const site = jadrija && jadrija.site ? jadrija.site : { x: 0, z: 0 };
  const riders = [];

  // Find each one a leg of open water across the wind. Same test the boats
  // use — nothing may ever sail into the karst — but a much shorter run,
  // because a tack is short and a kite spot is not the open sea.
  for (let d = 0; d < 6000 && riders.length < KITE.n; d++) {
    const r = Math.sqrt(rng()) * KITE.reach;
    const a = rng() * TAU;
    const x = site.x + Math.cos(a) * r;
    const z = site.z + Math.sin(a) * r;
    if (!isSea(x, z)) continue;
    const sh = shoreAt(x, z);
    if (sh < KITE.minShore || sh > KITE.maxShore) continue;
    const leg = KITE.leg[0] + rng() * (KITE.leg[1] - KITE.leg[0]);
    if (!waterRunClear(x - ax * leg * 0.5, z - az * leg * 0.5, ax, az, leg, 55)) continue;
    riders.push({
      x0: x - ax * leg * 0.5, z0: z - az * leg * 0.5,
      leg, s: rng() * leg, dir: rng() < 0.5 ? 1 : -1,
      speed: KITE.speed[0] + rng() * (KITE.speed[1] - KITE.speed[0]),
      turn: 0,                                  // seconds left in a carve
      side: rng() < 0.5 ? 1 : -1,               // which side the kite is parked
      phase: rng() * TAU,                       // its own slow wander in the window
      cloth: KITE.cloth[(rng() * KITE.cloth.length) | 0],
      x, z, yaw: 0,
    });
  }

  for (const k of riders) {
    const root = new THREE.Group();
    const canopy = new THREE.Mesh(canopyGeo,
      solidMaterial(new THREE.Color(...k.cloth),
        { spec: 0.20, specPower: 22, vcol: false, side: THREE.DoubleSide }));
    const lines = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(
        // 3 cm, which is thicker than a kite line and is the only way a kite
      // line exists at all: the real thing is 2 mm of Dyneema at twenty-four
      // metres, which is well under a pixel from anywhere you can stand. Drawn
      // honestly it is invisible, and a canopy with nothing holding it on is a
      // balloon. Every game that draws a wire draws it too fat.
      new THREE.CylinderGeometry(0.030, 0.030, 1, 3, 1, true), lineMat);
      m.geometry.translate(0, -0.5, 0);         // hangs from its own origin
      lines.push(m);
      root.add(m);
    }
    const rider = new THREE.Mesh(riderGeo, riderMat);
    const board = new THREE.Mesh(boardGeo, boardMat);
    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    wake.renderOrder = 2;
    root.add(canopy, rider, board, wake);
    for (const m of [root, canopy, rider, board, wake, ...lines]) m.frustumCulled = false;
    group.add(root);
    Object.assign(k, { root, canopy, rider, board, wake, lines });
  }

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);

  /** Stretch a line mesh from `from` to `to`. */
  function span(mesh, from, to) {
    _a.copy(to).sub(from);
    const len = _a.length() || 1;
    mesh.position.copy(from);
    mesh.scale.set(1, len, 1);
    _a.divideScalar(len);
    // The cylinder hangs down −Y from its origin, so point −Y along the line.
    mesh.quaternion.setFromUnitVectors(_b.set(0, -1, 0), _a);
  }

  function update(dt, camera) {
    if (!riders.length) return;
    // Far enough away and there is nothing to see: a kite is eight metres
    // across at two kilometres, and the arithmetic that carves a tack is not
    // worth doing for four pixels.
    const near = Math.hypot(camera.position.x - site.x,
      camera.position.z - site.z) < KITE.reach + 4200;
    group.visible = near;
    if (!near) return;

    for (const k of riders) {
      // ── along the leg, and round at the end of it ────────────────────────
      if (k.turn > 0) {
        k.turn -= dt;
        if (k.turn <= 0) { k.dir = -k.dir; k.side = -k.side; }
      } else {
        k.s += k.speed * dt * k.dir;
        if (k.s < 0 || k.s > k.leg) {
          k.s = clamp(k.s, 0, k.leg);
          k.turn = KITE.carve;
        }
      }
      k.x = k.x0 + ax * k.s;
      k.z = k.z0 + az * k.s;
      // Coming round, the heading swings through the eye of the wind rather
      // than snapping: a carve is a second and a half of being pointed the
      // wrong way, and it is the most legible thing a kitesurfer does.
      const swing = k.turn > 0 ? (1 - k.turn / KITE.carve) : 0;
      const head = k.dir * (1 - 2 * swing);
      k.yaw = Math.atan2(ax * head, az * head);

      const surf = seaHeightAt(k.x, k.z);
      k.root.position.set(k.x, surf, k.z);
      k.root.rotation.set(0, k.yaw, 0);

      // ── the kite, in the window ─────────────────────────────────────────
      // Up and slightly forward of the rider, on the windward side, wandering
      // a little because nobody parks a kite perfectly still. `side` swaps
      // with the tack, which is why the kite crosses over when they come round.
      const el = KITE.elev[0] + (KITE.elev[1] - KITE.elev[0])
        * (0.5 + 0.5 * Math.sin(U.uTime.value * 0.28 + k.phase));
      const across = k.side * (1 - 2 * swing);
      // In the root's own frame: +Z is the way they are going, +X is to the
      // rider's left, and the wind comes across it.
      const flat = Math.cos(el) * KITE.line;
      _a.set(across * flat * 0.86, Math.sin(el) * KITE.line + 1.15, flat * 0.30);
      k.canopy.position.copy(_a);
      // The canopy hangs nose-down toward its own lines: build a frame whose
      // −Y points back down them, then roll it so the arc opens downwind.
      _b.copy(_a).setY(_a.y - 1.15).normalize();
      _m.lookAt(_b, _up.set(0, 0, 0), _up.set(0, 1, 0));
      k.canopy.quaternion.setFromRotationMatrix(_m);
      k.canopy.rotateX(-Math.PI / 2);
      k.canopy.rotateY(across * 0.35);

      // ── lines, from the bar to the tips ─────────────────────────────────
      const barY = 1.15;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        _b.set(s * KITE.span * 0.42, 0, 0).applyQuaternion(k.canopy.quaternion)
          .add(k.canopy.position);
        span(k.lines[i], _a.set(s * 0.32, barY, 0.34), _b);
      }

      // ── rider and board ─────────────────────────────────────────────────
      // Leaning away from the kite, and the board edged the same way. Both of
      // them flip with the tack, which is the whole tell.
      k.rider.position.set(0, 0.16, 0);
      k.rider.rotation.set(0, 0, -across * KITE.lean);
      k.board.position.set(-across * 0.26, -0.05, 0.10);
      k.board.rotation.set(0.04, 0, -across * 0.62);

      // The wake: behind them, as long as they are fast, and gone while they
      // are round the corner doing nothing.
      const wk = (1 - swing) * (k.turn > 0 ? 0.35 : 1);
      k.wake.position.set(0, 0.06, -7.5 * k.dir * (k.turn > 0 ? 0 : 1));
      k.wake.scale.set(1.5 + 1.2 * wk, 1, 15 * wk + 0.5);
      k.wake.visible = wk > 0.15;
    }
  }

  return {
    group, riders,
    update,
    stats: () => ({
      out: riders.length,
      shown: group.visible ? 1 : 0,
      at: riders.map((k) => [Math.round(k.x), Math.round(k.z)]),
    }),
  };
}
