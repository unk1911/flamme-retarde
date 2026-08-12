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
  // How many of those get the near model, and out to what range. Almost all of
  // the two thousand are over the horizon or a pixel across; the handful you
  // could actually walk up to is what this is for. Sized for a village lane
  // with cars down both sides — overflow falls back to the far model, which is
  // the right failure and is invisible at that range anyway.
  carsNear: 56,
  carNearM: 130,
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

/**
 * The same car, for when you are standing next to it.
 *
 * `carProto` is a brick with a smaller brick on it and four square wheels, and
 * that is the correct answer two thousand times over at three hundred metres —
 * it is 84 triangles and there are 2 120 of them. It is the wrong answer at two
 * metres, which is a distance the game now has, so this is the near version and
 * `update` hands out whichever one the range calls for.
 *
 * Built as two lofts rather than as boxes. A car is a section that changes
 * along its length — it narrows at the sill, it is widest at the door handles,
 * it tucks back in at the roof — and no arrangement of axis-aligned boxes has
 * any of that. Each station is a hexagon in (y, z): sill, waist, shoulder.
 */
function carNearProto() {
  const b = propBuilder();
  const BODY = [1, 1, 1];                    // tinted per instance
  const GLASS = [0.16, 0.19, 0.22];
  const TYRE = [0.085, 0.085, 0.095];
  const RIM = [0.60, 0.61, 0.63];
  const LAMP = [0.88, 0.86, 0.78];
  const TAIL = [0.52, 0.10, 0.09];
  const TRIM = [0.22, 0.22, 0.23];

  // [x, sill y, waist y, shoulder y, waist half-width, shoulder half-width]
  // The sill is 0.90 of the waist, not 0.74. A car is very nearly as wide at
  // the bottom of the door as at the handles — the tumblehome is almost all
  // above the waist — and pulling the sill in makes the body a boat hull with
  // the wheels hanging outside it.
  const ring = ([x, yb, yw, yt, w, wt]) => [
    [x, yb, w * 0.94], [x, yw, w], [x, yt, wt],
    [x, yt, -wt], [x, yw, -w], [x, yb, -w * 0.94],
  ];
  /**
   * Vertex order is the one `propBuilder.box` uses, so the winding — and so the
   * normals — come out the same way round as every other prop in the scene.
   * `col(edge, strip)` picks the colour; returning null drops the face, which
   * is how the greenhouse loses the underside it would otherwise bury inside
   * the body and z-fight against.
   */
  const loft = (st, col) => {
    for (let i = 0; i < st.length - 1; i++) {
      const A = ring(st[i]), B = ring(st[i + 1]);
      for (let e = 0; e < 6; e++) {
        const c = col(e, i);
        if (!c) continue;
        const f = (e + 1) % 6;
        b.quad(A[f], B[f], B[e], A[e], c);
      }
    }
  };
  const cap = (st, front, col) => {
    const A = ring(st);
    const c = [st[0], (st[1] + st[3]) / 2, 0];
    for (let e = 0; e < 6; e++) {
      const f = (e + 1) % 6;
      if (front) b.tri(c, A[e], A[f], col); else b.tri(c, A[f], A[e], col);
    }
  };

  // The body, up to the belt line. Nose down, tail up, sills tucked under.
  // The five stations either side of each axle are the wheel arches, and they
  // are the difference between a car and a shoebox with wheels leaned against
  // it. Without them the sill runs dead straight from bumper to bumper and the
  // tyres hang off the outside of it — the body has to come *down around* the
  // wheel and lift over it, or the eye reads them as separate objects.
  const BSTN = [
    [2.02, 0.46, 0.66, 0.80, 0.76, 0.66],
    [1.78, 0.32, 0.64, 0.86, 0.85, 0.79],
    [1.72, 0.30, 0.66, 0.90, 0.86, 0.81],
    [1.52, 0.44, 0.68, 0.92, 0.87, 0.82],
    [1.32, 0.57, 0.70, 0.94, 0.87, 0.83],   // crown of the front arch
    [1.12, 0.44, 0.71, 0.96, 0.87, 0.84],
    [0.92, 0.30, 0.72, 0.98, 0.87, 0.84],
    [0.10, 0.29, 0.73, 1.02, 0.87, 0.84],
    [-0.62, 0.29, 0.73, 1.02, 0.87, 0.84],
    [-0.88, 0.30, 0.72, 1.01, 0.87, 0.84],
    [-1.08, 0.44, 0.72, 1.01, 0.87, 0.83],
    [-1.28, 0.57, 0.71, 1.00, 0.87, 0.83],  // and of the rear
    [-1.48, 0.44, 0.71, 1.00, 0.87, 0.82],
    [-1.68, 0.31, 0.70, 0.99, 0.86, 0.80],
    [-1.94, 0.40, 0.66, 0.94, 0.82, 0.72],
    [-2.06, 0.50, 0.64, 0.86, 0.74, 0.64],
  ];
  // Only the underside is unpainted. Colouring the lower flanks as well — which
  // is what the first cut did — makes the bottom half of every car dark, and a
  // small hatchback is painted right down to the sill.
  loft(BSTN, (e) => (e === 5 ? TRIM : BODY));
  cap(BSTN[0], true, BODY);
  cap(BSTN[BSTN.length - 1], false, BODY);

  // The greenhouse. First and last stations are flat on the belt line, so the
  // loft between them *is* the windscreen and the backlight — no separate
  // panel, and the rake is real rather than a dark stripe painted on a box.
  const GSTN = [
    [0.88, 0.99, 1.00, 1.01, 0.84, 0.80],
    [0.20, 1.02, 1.25, 1.45, 0.83, 0.71],
    [-0.58, 1.02, 1.28, 1.49, 0.83, 0.73],
    [-1.08, 1.01, 1.24, 1.44, 0.82, 0.71],
    [-1.68, 0.98, 0.99, 1.00, 0.79, 0.72],
  ];
  loft(GSTN, (e, i) => {
    if (e === 5) return null;                        // buried in the body
    if (e === 2) return (i === 0 || i === 3) ? GLASS : BODY;   // screen, roof, backlight
    return GLASS;
  });

  // Wheels, ten-sided and sitting flush with the waist rather than 0.62 × 0.60
  // boxes. Only the outer face is built: nothing ever sees the inside of an
  // arch, and this is geometry that gets drawn a few dozen times a frame.
  // Track 1.47, so the outer wall of the tyre sits at 0.83 — just inside the
  // 0.87 waist and just inside the 0.78 sill, which is where a wheel actually
  // lives. At ±0.78 they stood proud of the body and read as a tractor's.
  const N = 10, R = 0.30, HW = 0.09, CY = 0.31, TRACK = 0.70;
  for (const x of [1.32, -1.28]) {
    for (const s of [1, -1]) {
      const zo = s * (TRACK + HW), zi = s * (TRACK - HW);
      const P = (a, z) => [x + Math.cos(a) * R, CY + Math.sin(a) * R, z];
      const hub = [x, CY, zo];
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU;
        b.quad(P(a1, zi), P(a0, zi), P(a0, zo), P(a1, zo), TYRE);
        if (s > 0) b.tri(hub, P(a1, zo), P(a0, zo), RIM);
        else b.tri(hub, P(a0, zo), P(a1, zo), RIM);
      }
    }
  }

  // Lamps and mirrors — small, but they are what tells you which end is which
  // from behind, which is most of what you read a parked car by.
  for (const s of [1, -1]) {
    b.box(1.98, 0.76, s * 0.52, 0.10, 0.16, 0.34, LAMP);
    b.box(-2.02, 0.82, s * 0.54, 0.10, 0.22, 0.30, TAIL);
    b.box(0.58, 1.08, s * 0.92, 0.10, 0.10, 0.14, BODY);
  }
  return b.geo();
}

/**
 * A parasol, built like one.
 *
 * The old one was eight flat triangles from a point down to an octagon — a
 * cone, and it read as a cone: the silhouette was a straight line from tip to
 * rim, the rim was a hard polygon, and nothing about it moved as you walked
 * past. There are nine hundred of these along this shore and they are the
 * skyline of the whole resort, so they are worth the triangles.
 *
 * What a real one is, and what this now has:
 *
 *   - **Ribs and fabric.** The canopy is sampled twice per gore — once on the
 *     rib and once between two of them — and the between-rib samples hang
 *     lower. That single fact is most of it: the fabric bags between the ribs,
 *     so the surface is faceted the way stretched cloth is, and the rim comes
 *     out scalloped instead of straight.
 *   - **Droop.** Two rings rather than one, with the outer half falling away
 *     faster than the inner. A parasol is not a cone, it is a curve that starts
 *     shallow at the hub and turns down at the edge.
 *   - **A valance.** The strip of cloth that hangs off the rim, swagged deeper
 *     between the ribs than on them. It is the detail that reads as *parasol*
 *     at fifty metres, and it is what the silhouette against the sea is made
 *     of.
 *   - **A hub, a finial and a six-sided pole**, because a four-sided pole seen
 *     from the wrong 45° is two faces wide and looks like a plank.
 *
 * 110 triangles against the old twelve, instanced nine hundred times off one
 * draw. The stripe stays: gores alternate light and less light, which under the
 * per-instance colour is what makes a row of these read as a row rather than as
 * one long awning.
 */
function parasolProto() {
  const b = propBuilder();
  const POLE = [0.55, 0.52, 0.48];
  const HUB = [0.42, 0.40, 0.38];
  const RIBS = 8, N = RIBS * 2, R = 1.35;
  // Rib line: hub, mid-span, rim. And how far the cloth bags below it between
  // two ribs at each of those — nothing at the hub, where it is clamped.
  const RING = [[0.00, 2.34, 0.000], [0.55, 2.13, 0.030], [1.00, 1.86, 0.090]];
  const VAL = [0.105, 0.215];            // valance drop on a rib, and between two
  const ang = (j) => (j / N) * TAU;
  // `j` even is a rib, `j` odd is the slack between two of them.
  const P = (j, ring) => {
    const [f, y, sag] = RING[ring];
    return [Math.cos(ang(j)) * R * f, y - (j % 2 ? sag : 0), Math.sin(ang(j)) * R * f];
  };
  const gore = (j) => ((j >> 1) % 2 ? [1, 1, 1] : [0.845, 0.845, 0.845]);
  for (let j = 0; j < N; j++) {
    const k = (j + 1) % N, cl = gore(j);
    b.tri([0, RING[0][1], 0], P(j, 1), P(k, 1), cl);
    b.quad(P(j, 1), P(k, 1), P(k, 2), P(j, 2), cl);
    // The valance, hung off the rim it follows. Deeper between the ribs, so the
    // bottom edge swags where the rim already dips and the scallop doubles.
    const d0 = VAL[j % 2], d1 = VAL[k % 2];
    const r0 = P(j, 2), r1 = P(k, 2);
    b.quad(r0, r1, [r1[0], r1[1] - d1, r1[2]], [r0[0], r0[1] - d0, r0[2]],
      [cl[0] * 0.90, cl[1] * 0.90, cl[2] * 0.90]);
  }
  // Hub, finial, pole. The hub is what the ribs would be pinned to and the
  // reason the apex is not a puncture in the cloth.
  const ring = (j, r, y) => [Math.cos((j / 6) * TAU) * r, y, Math.sin((j / 6) * TAU) * r];
  for (let j = 0; j < 6; j++) {
    const k = (j + 1) % 6;
    b.quad(ring(j, 0.072, 2.16), ring(k, 0.072, 2.16),
      ring(k, 0.038, 2.31), ring(j, 0.038, 2.31), HUB);
    b.tri([0, 2.42, 0], ring(j, 0.038, 2.31), ring(k, 0.038, 2.31), HUB);
    b.quad(ring(j, 0.046, 0), ring(k, 0.046, 0),
      ring(k, 0.046, 2.20), ring(j, 0.046, 2.20), POLE);
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

/** Is this point on the Jadrija concrete? Guarded, because it is built later. */
const jadOn = (x, z) => typeof jadrija !== 'undefined' && jadrija
  && jadrija.inField && jadrija.inField(x, z);

function buildProps(scene, lanes) {
  const rng = mulberry32(CONFIG.seed ^ 0x00c2a5);
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  const layers = {
    boat: propLayer(scene, boatProto(false), PROPS.boats, { spec: 0.22 }),
    yacht: propLayer(scene, boatProto(true), PROPS.boats, { spec: 0.22 }),
    car: propLayer(scene, carProto(), PROPS.cars + PROPS.parked, { spec: 0.34, specPower: 60 }),
    carNear: propLayer(scene, carNearProto(), PROPS.carsNear, { spec: 0.34, specPower: 60 }),
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
  // How many of them stand on the Jadrija deck, which is the only place any of
  // this is at eye level. Reported because it is the number that decides both
  // "too many umbrellas" and how many blockers the resort's `confine` carries.
  let onDeck = 0;
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
      let py = groundAt(px, pz);
      if (py < 0.2 || py > 8) continue;
      // Jadrija is the one shore that is not the shore any more: it is two
      // metres of concrete standing on it. A parasol sited off the terrain there
      // is a parasol buried to the canopy, so on the resort it stands on the
      // deck — and only on the open terraces, because the strip behind them is
      // solid huts and a beach umbrella through a roof is worse than none.
      if (jadOn(px, pz)) {
        const [pt, s] = jadrija.local(px, pz);
        if (s > JAD.deck) continue;
        // Half of them, and only here. Nine hundred parasols over sixty square
        // kilometres is a coastline in August; the same density on the one
        // twelve-metre strip you actually walk down is a forest you cannot see
        // the kabine through. Thinned off the dart and knot indices rather than
        // out of `rng`, because a draw taken here shifts every boat and every
        // car placed after it.
        if ((d + k) % 2) continue;
        py = jadrija.walkY(px, pz);
        // And a parasol you can walk through is a poster of a parasol. The pole
        // only — the canopy is at 2.2 m and being stopped by shade over your
        // head is worse than walking through it, which is the same call the
        // resort's own parasols make in src/43-jadrija.js.
        jadrija.blockers.push({ t: pt, s, a: 0.09, c: 0.09, h: 2.3, y: 0 });
        onDeck++;
      }
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
  let carsNear = 0;         // how many got the near model this frame

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

    // Cars, sorted into the two models by range as they are placed. The near
    // one is 424 triangles against the far one's 84 — five times over, which is
    // 24 000 at fifty-six instances and would be 900 000 across all 2 120. So
    // the split is not a nicety; it is the only reason the near model can exist.
    const cam = U.uCamPos.value;
    const nearSq = PROPS.carNearM * PROPS.carNearM;
    let nCar = 0, nNear = 0;
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
      const x = p.x + nx * off, z = p.z + nz * off;
      const dx = x - cam.x, dz = z - cam.z;
      const close = nNear < PROPS.carsNear && dx * dx + dz * dz < nearSq;
      const L = close ? layers.carNear : layers.car;
      put(L, close ? nNear++ : nCar++,
        x, p.y + 0.05, z, Math.atan2(sx, sz) - Math.PI / 2, 1, c.col);
    }
    layers.car.geo.instanceCount = nCar;
    layers.carNear.geo.instanceCount = nNear;
    for (const L of [layers.car, layers.carNear]) {
      L.aPos.needsUpdate = L.aRot.needsUpdate = true;
      L.aScale.needsUpdate = L.aColor.needsUpdate = true;
    }
    carsNear = nNear;
  }

  update(0);

  return {
    update, layers,
    counts: {
      parasols: parasols.length,
      parasolsOnDeck: onDeck,
      boats: boats.length,
      underway: boats.filter((b) => b.moving).length,
      cars: cars.length,
      lanes: lanes.length,
      get carsNear() { return carsNear; },
    },
    /** For a test that wants to go and stand next to one. */
    nearCarList() {
      const a = layers.carNear.aPos.array, out = [];
      for (let i = 0; i < carsNear; i++) {
        out.push([+a[i * 3].toFixed(1), +a[i * 3 + 1].toFixed(1), +a[i * 3 + 2].toFixed(1)]);
      }
      return out;
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
