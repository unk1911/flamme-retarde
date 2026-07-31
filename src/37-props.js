// -----------------------------------------------------------------------------
// The things that say somebody lives here.
//
// Boats on the water, cars on the roads, parasols along the developed shore.
// None of it is in OpenStreetMap and none of it needs to be — it is all placed
// from the rasters that are already loaded: cover says where the water is, the
// shore channel says how far the waterline is, the urban channel says where
// people are, and the road polylines say where a car can be.
//
// The point is scale. A Canadair sits a hundred metres up and everything below
// is either the size of a house or the size of nothing; a five-metre boat and a
// four-metre car are the only objects in the scene that read as *small*, and
// without something small the town has no size at all.
//
// A person is about one pixel from up here, which is why there are none. A
// parasol is six and says the same thing.
// -----------------------------------------------------------------------------

const PROPS = {
  parasols: 900,
  boats: 260,
  underway: 22,          // of those boats, how many are actually going somewhere
  // 320 km of road: at 500 cars you get one every 600 m, which from the air is
  // no cars at all. Traffic has to be dense enough to read as traffic, and at
  // 50 triangles each in a single instanced draw this is nearly free.
  cars: 420,
  parked: 1700,
  darts: 160000,         // random samples thrown at the map looking for shore
};

/** Flat-shaded triangle soup with baked vertex colours — same idea as the town. */
function propBuilder() {
  const pos = [], norm = [], col = [];
  const tri = (a, b, c, cl) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      norm.push(nx / L, ny / L, nz / L);
      col.push(cl[0], cl[1], cl[2]);
    }
  };
  const quad = (a, b, c, d, cl) => { tri(a, b, c, cl); tri(a, c, d, cl); };
  const box = (cx, cy, cz, sx, sy, sz, cl, top) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const P = (x, y, z) => [x, y, z];
    quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), cl);
    quad(P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z1), P(x1, y1, z1), cl);
    quad(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), cl);
    quad(P(x0, y0, z1), P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), cl);
    quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), top || cl);
    quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x0, y0, z0), cl);
  };
  const geo = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
    return g;
  };
  return { tri, quad, box, geo, count: () => pos.length / 3 };
}

/** Local frame: +X forward, +Y up, +Z to starboard. About six metres long. */
function boatProto(cabin) {
  const b = propBuilder();
  const HULL = [0.92, 0.92, 0.89];
  const DECK = [0.74, 0.72, 0.68];
  const BOOT = [0.16, 0.24, 0.34];          // the antifouling stripe at the waterline
  const dy = 0.55, ky = -0.32;
  //   x       deck half-beam   keel half-beam
  const S = [
    [3.00, 0.06, 0.03],
    [1.40, 0.95, 0.40],
    [-0.60, 1.10, 0.48],
    [-3.00, 0.92, 0.42],
  ];
  for (let i = 0; i < S.length - 1; i++) {
    const [x0, d0, k0] = S[i], [x1, d1, k1] = S[i + 1];
    for (const s of [1, -1]) {
      b.quad([x0, dy, s * d0], [x1, dy, s * d1], [x1, ky, s * k1], [x0, ky, s * k0], HULL);
      b.quad([x0, ky, s * k0], [x1, ky, s * k1], [x1, ky, 0], [x0, ky, 0], BOOT);
      b.quad([x0, dy, s * d0], [x1, dy, s * d1], [x1, dy, 0], [x0, dy, 0], DECK);
    }
  }
  // transom
  b.quad([-3.0, dy, 0.92], [-3.0, dy, -0.92], [-3.0, ky, -0.42], [-3.0, ky, 0.42], HULL);
  if (cabin) {
    b.box(0.35, 1.02, 0, 2.1, 0.94, 1.5, [0.90, 0.89, 0.86], [0.86, 0.85, 0.83]);
    b.box(-0.75, 1.55, 0, 0.5, 0.14, 1.3, [0.30, 0.33, 0.36]);   // windscreen lip
  } else {
    b.box(-1.9, 0.78, 0, 0.5, 0.42, 0.9, [0.20, 0.21, 0.22]);    // outboard
  }
  return b.geo();
}

/** A small European hatchback, four metres of it. +X forward. */
function carProto() {
  const b = propBuilder();
  const BODY = [1, 1, 1];                    // tinted per instance
  const GLASS = [0.20, 0.24, 0.27];
  const TYRE = [0.10, 0.10, 0.11];
  b.box(0, 0.70, 0, 4.10, 0.72, 1.74, BODY);
  b.box(-0.15, 1.24, 0, 2.15, 0.52, 1.58, BODY, BODY);
  // A dark band where the glass is, which is most of what a car looks like.
  b.box(-0.15, 1.26, 0, 2.19, 0.30, 1.62, GLASS);
  for (const x of [1.35, -1.35]) {
    for (const s of [1, -1]) b.box(x, 0.33, s * 0.80, 0.62, 0.60, 0.20, TYRE);
  }
  return b.geo();
}

function parasolProto() {
  const b = propBuilder();
  const POLE = [0.55, 0.52, 0.48];
  const SEG = 8, R = 1.35, y0 = 1.92, y1 = 2.34;
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU;
    // Alternate panels, because a parasol is striped and the stripe is the
    // only thing that makes it read as a parasol rather than a bush.
    const cl = i % 2 ? [1, 1, 1] : [0.82, 0.82, 0.82];
    b.tri([0, y1, 0],
      [Math.cos(a0) * R, y0, Math.sin(a0) * R],
      [Math.cos(a1) * R, y0, Math.sin(a1) * R], cl);
  }
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * TAU, a1 = ((i + 1) / 4) * TAU;
    b.quad([Math.cos(a0) * 0.05, 0, Math.sin(a0) * 0.05],
      [Math.cos(a1) * 0.05, 0, Math.sin(a1) * 0.05],
      [Math.cos(a1) * 0.05, y0, Math.sin(a1) * 0.05],
      [Math.cos(a0) * 0.05, y0, Math.sin(a0) * 0.05], POLE);
  }
  return b.geo();
}

/**
 * One instanced layer per prototype. Capacity is fixed at build; `count` is
 * what actually draws.
 */
function propLayer(scene, proto, cap, opts = {}) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', proto.attributes.position);
  geo.setAttribute('normal', proto.attributes.normal);
  geo.setAttribute('aVCol', proto.attributes.aVCol);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const aRot = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  const aScale = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  for (const [n, a] of [['aInstPos', aPos], ['aInstRot', aRot],
    ['aInstScale', aScale], ['aInstColor', aColor]]) {
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(n, a);
  }

  const mesh = new THREE.Mesh(geo, solidMaterial(0xffffff, {
    instanced: true,
    spec: opts.spec ?? 0.16,
    specPower: opts.specPower ?? 40,
    side: THREE.DoubleSide,
    body: 'base *= vVCol;\n  n = gl_FrontFacing ? n : -n;',
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);
  geo.instanceCount = 0;
  return { geo, mesh, aPos, aRot, aScale, aColor };
}

function buildProps(scene, lanes) {
  const rng = mulberry32(CONFIG.seed ^ 0x00c2a5);
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  const layers = {
    boat: propLayer(scene, boatProto(false), PROPS.boats, { spec: 0.22 }),
    yacht: propLayer(scene, boatProto(true), PROPS.boats, { spec: 0.22 }),
    car: propLayer(scene, carProto(), PROPS.cars + PROPS.parked, { spec: 0.34, specPower: 60 }),
    parasol: propLayer(scene, parasolProto(), PROPS.parasols, { spec: 0.05, specPower: 12 }),
  };

  const put = (L, i, x, y, z, yaw, s, cl, pitch = 0, roll = 0) => {
    _e.set(pitch, yaw, roll, 'YXZ');
    _q.setFromEuler(_e);
    L.aPos.array[i * 3] = x; L.aPos.array[i * 3 + 1] = y; L.aPos.array[i * 3 + 2] = z;
    L.aRot.array[i * 4] = _q.x; L.aRot.array[i * 4 + 1] = _q.y;
    L.aRot.array[i * 4 + 2] = _q.z; L.aRot.array[i * 4 + 3] = _q.w;
    L.aScale.array[i * 3] = s; L.aScale.array[i * 3 + 1] = s; L.aScale.array[i * 3 + 2] = s;
    L.aColor.array[i * 3] = cl[0]; L.aColor.array[i * 3 + 1] = cl[1];
    L.aColor.array[i * 3 + 2] = cl[2];
  };

  // ── parasols ───────────────────────────────────────────────────────────────
  // Anywhere the developed shoreline meets flat ground near the waterline. They
  // come in knots of three to seven, because nobody puts up one umbrella.
  const parasols = [];
  const PARASOL_COL = [
    [1.00, 1.00, 0.98], [0.95, 0.55, 0.30], [0.35, 0.55, 0.78],
    [0.90, 0.86, 0.55], [0.85, 0.35, 0.35], [0.45, 0.68, 0.60],
  ];
  for (let d = 0; d < PROPS.darts && parasols.length < PROPS.parasols; d++) {
    const x = (rng() - 0.5) * CONFIG.world;
    const z = (rng() - 0.5) * CONFIG.world;
    if (isSea(x, z)) continue;
    const y = groundAt(x, z);
    if (y < 0.3 || y > 7) continue;
    if (shoreAt(x, z) > 32) continue;
    if (urbanAt(x, z) < 0.035) continue;            // a developed shore, not a wild cove
    if (normalAt(x, z, 10).y < 0.90) continue;      // you cannot sunbathe on a cliff
    const knot = 3 + ((rng() * 5) | 0);
    const cl = PARASOL_COL[(rng() * PARASOL_COL.length) | 0];
    for (let k = 0; k < knot && parasols.length < PROPS.parasols; k++) {
      const px = x + (rng() - 0.5) * 16, pz = z + (rng() - 0.5) * 16;
      if (isSea(px, pz)) continue;
      const py = groundAt(px, pz);
      if (py < 0.2 || py > 8) continue;
      parasols.push([px, py, pz, rng() * TAU, 0.85 + rng() * 0.35,
        k === 0 ? cl : PARASOL_COL[(rng() * PARASOL_COL.length) | 0]]);
    }
  }
  parasols.forEach((p, i) => put(layers.parasol, i, p[0], p[1], p[2], p[3], p[4], p[5]));
  layers.parasol.geo.instanceCount = parasols.length;
  for (const a of [layers.parasol.aPos, layers.parasol.aRot,
    layers.parasol.aScale, layers.parasol.aColor]) a.needsUpdate = true;

  // ── boats ──────────────────────────────────────────────────────────────────
  // Moored: shallow, sheltered, and within sight of somebody's house. Underway:
  // a validated open-water leg they shuttle along, so nothing ever sails into
  // the karst.
  const boats = [];
  const HULL_TINT = [
    [1.00, 1.00, 1.00], [0.96, 0.97, 1.00], [0.92, 0.94, 0.97],
    [0.78, 0.84, 0.92], [1.00, 0.96, 0.88],
  ];
  const nearTown = (x, z) => {
    for (let a = 0; a < TAU; a += TAU / 6) {
      if (urbanAt(x + Math.cos(a) * 110, z + Math.sin(a) * 110) > 0.05) return true;
    }
    return false;
  };
  for (let d = 0; d < PROPS.darts && boats.length < PROPS.boats - PROPS.underway; d++) {
    const x = (rng() - 0.5) * CONFIG.world;
    const z = (rng() - 0.5) * CONFIG.world;
    if (!isSea(x, z)) continue;
    const sh = shoreAt(x, z);
    if (sh < 12 || sh > 90) continue;               // off the rocks, still inshore
    if (!nearTown(x, z)) continue;
    boats.push({
      x, z, yaw: rng() * TAU, moving: false,
      scale: 0.62 + rng() * 0.5,
      big: rng() < 0.34,
      tint: HULL_TINT[(rng() * HULL_TINT.length) | 0],
      // Every mooring swings a little differently in the same wind.
      bob: rng() * TAU, bobRate: 0.5 + rng() * 0.5,
    });
  }
  for (let d = 0; d < 4000 && boats.length < PROPS.boats; d++) {
    const x = (rng() - 0.5) * CONFIG.world * 0.8;
    const z = (rng() - 0.5) * CONFIG.world * 0.8;
    if (!isSea(x, z) || shoreAt(x, z) < 220) continue;
    const yaw = rng() * TAU;
    const len = 900 + rng() * 1800;
    if (!waterRunClear(x, z, Math.cos(yaw), Math.sin(yaw), len, 60)) continue;
    boats.push({
      x, z, yaw, moving: true,
      x0: x, z0: z, len, s: rng() * len, dir: 1,
      speed: 4.5 + rng() * 5.5,
      scale: 0.75 + rng() * 0.55,
      big: rng() < 0.6,
      tint: HULL_TINT[(rng() * HULL_TINT.length) | 0],
      bob: rng() * TAU, bobRate: 0.6 + rng() * 0.5,
    });
  }

  // ── cars ───────────────────────────────────────────────────────────────────
  // Lanes are the road layer's own draped runs, with a cumulative arc length so
  // a car can be placed at a distance rather than at a vertex.
  //
  // Bias toward the bigger roads: that is where the traffic is, and a lone car
  // crawling down a dead-end lane in Jadrija is a stranger detail than none.
  const laneWeight = lanes.map((l) => l.len * (l.rank >= 2 ? 3.2 : 1));
  const laneTotal = laneWeight.reduce((a, b) => a + b, 0);
  // Parked cars go the other way: they belong where the houses are, so this
  // weight is how built-up the lane runs rather than how important it is.
  const laneUrban = lanes.map((l) => {
    const m = l.run[(l.run.length / 2) | 0];
    return l.len * (0.05 + urbanAt(m.x, m.z) * 2.4);
  });
  const urbanTotal = laneUrban.reduce((a, b) => a + b, 0);
  const pickBy = (w, total) => {
    let r = rng() * total;
    for (let i = 0; i < lanes.length; i++) { r -= w[i]; if (r <= 0) return lanes[i]; }
    return lanes[lanes.length - 1];
  };
  const pickLane = () => pickBy(laneWeight, laneTotal);
  const pickParking = () => pickBy(laneUrban, urbanTotal);

  /** Position and heading at arc length s along a lane. */
  function onLane(lane, s) {
    const { run, cum } = lane;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / Math.max(0.001, cum[i] - cum[i - 1]);
    const a = run[i - 1], b = run[i];
    const hx = b.x - a.x, hz = b.z - a.z;
    const hl = Math.hypot(hx, hz) || 1;
    return {
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
      hx: hx / hl, hz: hz / hl,
    };
  }

  // European small-car reality: mostly white, silver and grey, then everything
  // else. Getting this distribution wrong is what makes game traffic look like
  // a toy box.
  const CAR_COL = [
    [0.88, 0.88, 0.87], [0.88, 0.88, 0.87], [0.88, 0.88, 0.87],
    [0.66, 0.67, 0.69], [0.66, 0.67, 0.69],
    [0.34, 0.35, 0.37], [0.34, 0.35, 0.37],
    [0.14, 0.14, 0.15],
    [0.52, 0.16, 0.14], [0.16, 0.24, 0.42], [0.20, 0.31, 0.24],
  ];
  const cars = [];
  if (lanes.length) {
    for (let i = 0; i < PROPS.cars; i++) {
      const lane = pickLane();
      cars.push({
        lane, s: rng() * lane.len, dir: rng() < 0.5 ? 1 : -1,
        speed: (lane.rank >= 3 ? 15 : lane.rank === 2 ? 12 : 7.5) * (0.8 + rng() * 0.45),
        col: CAR_COL[(rng() * CAR_COL.length) | 0],
        moving: true,
      });
    }
    // Parked cars come in runs down one side of a street, not scattered one
    // per road — a single car alone on a lane looks abandoned.
    while (cars.length < PROPS.cars + PROPS.parked) {
      const lane = pickParking();
      const side = rng() < 0.5 ? 1 : -1;
      const run = 2 + ((rng() * 5) | 0);
      let s = rng() * lane.len;
      for (let k = 0; k < run && cars.length < PROPS.cars + PROPS.parked; k++) {
        cars.push({
          lane, s: s % lane.len, dir: rng() < 0.5 ? 1 : -1, speed: 0,
          col: CAR_COL[(rng() * CAR_COL.length) | 0],
          moving: false,
          // Off the carriageway, onto the verge.
          offset: (ROADS.width[lane.rank] * 0.5 + 1.1) * side,
        });
        s += 5.5 + rng() * 3.5;
      }
    }
  }

  // ── per-frame ──────────────────────────────────────────────────────────────
  let tAcc = 0;
  let density = 1;

  function update(dt) {
    tAcc += dt;
    if (density <= 0) return;
    const nBoat = Math.round(boats.length * density);
    const nCarMax = Math.round(cars.length * density);
    let nSmall = 0, nBig = 0;

    for (let bi = 0; bi < nBoat; bi++) {
      const b = boats[bi];
      if (b.moving) {
        b.s += b.speed * dt * b.dir;
        if (b.s > b.len) { b.s = b.len; b.dir = -1; }
        if (b.s < 0) { b.s = 0; b.dir = 1; }
        b.x = b.x0 + Math.cos(b.yaw) * b.s;
        b.z = b.z0 + Math.sin(b.yaw) * b.s;
      }
      // Sea level is zero here, so a hull sits on it and rocks.
      const ph = tAcc * b.bobRate + b.bob;
      const heave = Math.sin(ph) * 0.16;
      const roll = Math.sin(ph * 0.83) * 0.055;
      const pitch = Math.sin(ph * 1.31 + 1.1) * 0.035;
      const yaw = -(b.moving ? b.yaw + (b.dir < 0 ? Math.PI : 0) : b.yaw)
        + Math.sin(ph * 0.4) * (b.moving ? 0.02 : 0.09);
      const L = b.big ? layers.yacht : layers.boat;
      const i = b.big ? nBig++ : nSmall++;
      if (i >= PROPS.boats) continue;
      put(L, i, b.x, heave - 0.08, b.z, yaw, b.scale, b.tint, pitch, roll);
    }
    layers.boat.geo.instanceCount = nSmall;
    layers.yacht.geo.instanceCount = nBig;
    for (const L of [layers.boat, layers.yacht]) {
      L.aPos.needsUpdate = L.aRot.needsUpdate = true;
      L.aScale.needsUpdate = L.aColor.needsUpdate = true;
    }

    let nCar = 0;
    for (let ci = 0; ci < nCarMax; ci++) {
      const c = cars[ci];
      if (c.moving) {
        c.s += c.speed * dt * c.dir;
        if (c.s > c.lane.len) c.s -= c.lane.len;
        if (c.s < 0) c.s += c.lane.len;
      }
      const p = onLane(c.lane, c.s);
      // Croatia drives on the right, so a car sits half a lane to the right of
      // its direction of travel; a parked one sits out on the verge.
      const off = c.moving ? ROADS.width[c.lane.rank] * 0.24 : c.offset;
      const sx = c.dir < 0 ? -p.hx : p.hx;
      const sz = c.dir < 0 ? -p.hz : p.hz;
      const nx = -sz, nz = sx;
      put(layers.car, nCar++,
        p.x + nx * off, p.y + 0.05, p.z + nz * off,
        Math.atan2(sx, sz) - Math.PI / 2, 1, c.col);
    }
    layers.car.geo.instanceCount = nCar;
    for (const a of [layers.car.aPos, layers.car.aRot, layers.car.aScale, layers.car.aColor]) {
      a.needsUpdate = true;
    }
  }

  update(0);

  return {
    update, layers,
    counts: {
      parasols: parasols.length,
      boats: boats.length,
      underway: boats.filter((b) => b.moving).length,
      cars: cars.length,
      lanes: lanes.length,
    },
    getDensity: () => density,
    setDensity(v) {
      density = sat(v);
      layers.parasol.geo.instanceCount = Math.round(parasols.length * density);
      if (density <= 0) {
        for (const k in layers) layers[k].geo.instanceCount = 0;
      }
    },
  };
}
