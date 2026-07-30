// -----------------------------------------------------------------------------
// The Knin–Šibenik line, and something running on it.
//
// Šibenik has a railway: single track, unelectrified, down the valley from
// Perković and dead-ending at the station on the waterfront, with a freight
// branch out to Ražine and the harbour. 44 ways come out of Overpass — four of
// running line, four of branch, and the rest spurs, sidings and yard, which is
// what a terminus actually looks like from the air.
//
// The formation is draped exactly like a road. The rails are two thin ribbons
// at standard gauge on top of it, and the sleepers are a shader stripe rather
// than geometry: at 1 435 mm gauge a sleeper is 2.6 m long and 26 cm wide, and
// there are about fifteen hundred of them per kilometre.
// -----------------------------------------------------------------------------

const RAIL = {
  step: 7,
  ballast: 5.6,          // metres, shoulder to shoulder
  lift: 0.5,
  railLift: 0.34,        // top of rail above the formation
  gauge: 1.435,          // the real one
  railW: 0.16,
  // A locomotive and three carriages. The line is worked by diesel railcars
  // and short push-pull sets, not by anything long.
  cars: 4,
};

/** Draw a draped ribbon of constant half-width into a buffer. Shared shape. */
function railRibbon(B, run, halfW, y0, col) {
  let along = 0;
  const L = [], R = [], A = [];
  for (let i = 0; i < run.length; i++) {
    const p = run[i];
    const a = run[Math.max(0, i - 1)];
    const b = run[Math.min(run.length - 1, i + 1)];
    let dx = b.x - a.x, dz = b.z - a.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    if (i > 0) along += Math.hypot(p.x - run[i - 1].x, p.z - run[i - 1].z);
    L.push([p.x + dz * halfW, p.y + y0, p.z - dx * halfW]);
    R.push([p.x - dz * halfW, p.y + y0, p.z + dx * halfW]);
    A.push(along);
  }
  const vert = (p, u, v) => {
    B.pos.push(p[0], p[1], p[2]);
    B.norm.push(0, 1, 0);
    B.col.push(col[0], col[1], col[2]);
    B.uv.push(u, v);
  };
  for (let i = 0; i < run.length - 1; i++) {
    vert(L[i], 0, A[i]); vert(R[i], 1, A[i]); vert(R[i + 1], 1, A[i + 1]);
    vert(L[i], 0, A[i]); vert(R[i + 1], 1, A[i + 1]); vert(L[i + 1], 0, A[i + 1]);
  }
  return along;
}

/** One rolling-stock body: a box with a roof, a skirt and a window band. */
function railcarProto(loco) {
  const pos = [], norm = [], col = [];
  const tri = (a, b, c, k) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      norm.push(nx / l, ny / l, nz / l);
      col.push(k[0], k[1], k[2]);
    }
  };
  const box = (cx, cy, cz, sx, sy, sz, k) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
      [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
    for (const [a, b, c, d] of F) { tri(V[a], V[b], V[c], k); tri(V[a], V[c], V[d], k); }
  };

  // HŽ blue-and-white is the livery on this line; freight is rust and grey.
  const BODY = loco ? [0.16, 0.26, 0.44] : [0.72, 0.73, 0.75];
  const ROOF = [0.40, 0.42, 0.44];
  const GLASS = [0.06, 0.09, 0.12];
  const UNDER = [0.13, 0.13, 0.14];
  const len = loco ? 15.4 : 24.5;         // real-ish: a 2044 is 15.8 m
  const w = 3.0;
  const floor = 1.15;                     // above the rail head
  const bodyH = loco ? 2.55 : 2.85;

  box(0, floor + bodyH / 2, 0, len, bodyH, w, BODY);
  box(0, floor + bodyH + 0.16, 0, len - 0.5, 0.34, w - 0.15, ROOF);
  // The window band, standing a hair proud so it wins the depth test.
  box(0, floor + bodyH * 0.68, 0, len - (loco ? 4.2 : 2.2), 0.95, w + 0.03, GLASS);
  box(0, floor - 0.28, 0, len - 1.4, 0.55, w - 0.5, UNDER);
  // Bogies, two per vehicle, inboard of the ends.
  for (const s of [-1, 1]) {
    box(s * len * 0.31, 0.52, 0, 3.4, 0.85, w - 0.7, UNDER);
    for (const t of [-1, 1]) {
      for (const u of [-1, 1]) {
        box(s * len * 0.31 + t * 1.25, 0.46, u * (w / 2 - 0.42), 0.9, 0.92, 0.16, [0.09, 0.09, 0.1]);
      }
    }
  }
  if (loco) {
    // Cab ends and the exhaust stack — enough to tell which way it is facing.
    box(0, floor + bodyH + 0.42, 0, 1.1, 0.5, 1.0, UNDER);
    for (const s of [-1, 1]) box(s * (len / 2 - 0.1), floor + 0.9, 0, 0.24, 1.6, w - 0.4, UNDER);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return { geo: g, len };
}

function buildRail(scene) {
  const ballast = { pos: [], norm: [], col: [], uv: [] };
  const steel = { pos: [], norm: [], col: [], uv: [] };
  let metres = 0, ways = 0;
  // The longest single draped run of *running line* is the one worth putting a
  // train on. Yard and siding runs are short and end in buffer stops.
  let best = null;

  for (const way of world.rail) {
    if (way.t) continue;                        // tunnels: nothing to see
    const running = (way.r | 0) >= 2;
    for (const run of drapeRuns(way.p, RAIL.step)) {
      if (run.length < 2) continue;
      const bw = running ? RAIL.ballast : RAIL.ballast * 0.82;
      const len = railRibbon(ballast, run, bw * 0.5, RAIL.lift,
        running ? [0.30, 0.285, 0.265] : [0.27, 0.26, 0.245]);
      // Rails only on running line. A yard drawn with rails at this scale is a
      // grey smear either way and it doubles the triangle count.
      //
      // Each rail is its own laterally shifted copy of the run rather than a
      // uv offset on one ribbon: the offset has to be perpendicular to the
      // track at every sample, and through a curve that is not the same thing
      // as sliding a texture sideways.
      if (running) {
        for (const s of [-1, 1]) {
          const h = s * RAIL.gauge * 0.5;
          const shifted = run.map((p, i) => {
            const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)];
            let dx = b.x - a.x, dz = b.z - a.z;
            const dl = Math.hypot(dx, dz) || 1;
            dx /= dl; dz /= dl;
            return { x: p.x + dz * h, z: p.z - dx * h, y: p.y };
          });
          railRibbon(steel, shifted, RAIL.railW * 0.5, RAIL.lift + RAIL.railLift,
            [0.42, 0.43, 0.45]);
        }
      }
      metres += len;
      if (running && len > 300 && (!best || len > best.len)) best = { run, len };
      ways++;
    }
  }

  const mk = (B, body, spec, specPower) => {
    if (!B.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(B.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const m = new THREE.Mesh(g, solidMaterial(0xffffff, { spec, specPower, body }));
    m.frustumCulled = false;
    m.material.polygonOffset = true;
    m.material.polygonOffsetFactor = -5;
    m.material.polygonOffsetUnits = -10;
    m.renderOrder = -1;
    scene.add(m);
    return m;
  };

  // Ballast: crushed limestone, and the sleepers, which are the one thing that
  // makes a grey strip read as track rather than as a farm road.
  const bed = mk(ballast, /* glsl */ `
    base *= vVCol;
    float across = abs(vUv.x * 2.0 - 1.0);
    // Shoulders fall away, so the formation has a shape.
    base *= 1.0 - 0.28 * smoothstep(0.55, 1.0, across);
    base *= 0.82 + 0.36 * fbm2(vWorld.xz * 3.4, 2);
    // Sleepers: 0.26 m of timber on 0.60 m centres, under the gauge only.
    float sl = step(0.57, fract(vUv.y / 0.60));
    float mid = 1.0 - smoothstep(0.20, 0.34, across);
    base = mix(base, vec3(0.20, 0.155, 0.115) * (0.8 + 0.4 * fbm2(vWorld.xz * 9.0, 1)),
               sl * mid * 0.85);
  `, 0.02, 14);

  // Rail head: polished where the wheels run, rust on the web.
  const rails = mk(steel, /* glsl */ `
    base *= vVCol;
    float across = abs(vUv.x * 2.0 - 1.0);
    base = mix(vec3(0.62, 0.63, 0.66), vec3(0.30, 0.19, 0.13),
               smoothstep(0.45, 1.0, across));
  `, 0.55, 90);

  // ── the train ──────────────────────────────────────────────────────────────
  const group = new THREE.Group();
  scene.add(group);
  const mat = solidMaterial(0xffffff, { spec: 0.14, specPower: 40, body: 'base *= vVCol;' });
  const vehicles = [];
  if (best) {
    for (let i = 0; i < RAIL.cars; i++) {
      const proto = railcarProto(i === 0);
      const mesh = new THREE.Mesh(proto.geo, mat);
      mesh.frustumCulled = false;
      group.add(mesh);
      vehicles.push({ mesh, len: proto.len });
    }
  }

  // Cumulative arc length along the chosen run, so a vehicle can be placed at a
  // distance rather than at an index — which is what keeps a four-car set
  // articulated through the curves instead of skating sideways.
  const cum = [0];
  if (best) {
    for (let i = 1; i < best.run.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(
        best.run[i].x - best.run[i - 1].x, best.run[i].z - best.run[i - 1].z));
    }
  }
  const total = best ? cum[cum.length - 1] : 0;

  /** Position and heading at distance `d` along the run. */
  function at(d) {
    const run = best.run;
    d = clamp(d, 0, total);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(0.001, cum[i] - cum[i - 1]);
    const a = run[i - 1], b = run[i];
    return {
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
      yaw: Math.atan2(b.x - a.x, b.z - a.z),
    };
  }

  // Start it a train-length in, running toward the far end.
  const setLen = vehicles.reduce((s, v) => s + v.len + 1.2, 0);
  let head = setLen + 20;
  let dir = 1;
  let dwell = 0;
  let speed = 0;

  function update(dt) {
    if (!best || !vehicles.length) return;
    // Stop at each end, wait, and go back — a terminus branch has nowhere else
    // to be. 22 m/s is 80 km/h, which is optimistic for this line but reads
    // right from the air.
    const near = dir > 0 ? total - head : head - setLen;
    if (dwell > 0) {
      dwell -= dt;
      speed = 0;
      if (dwell <= 0) dir = -dir;
    } else {
      const want = 22 * sat(near / 260);
      speed = damp(speed, want, 0.5, dt);
      head += speed * dt * dir;
      if (near < 4) { dwell = 12; }
    }
    let d = head;
    for (const v of vehicles) {
      const c = at(d - v.len * 0.5 * dir);
      v.mesh.position.set(c.x, c.y + RAIL.lift + RAIL.railLift, c.z);
      // The bodies are modelled along local +X; the run's heading is a bearing.
      v.mesh.rotation.y = c.yaw - Math.PI / 2;
      d -= (v.len + 1.2) * dir;
    }
  }

  return {
    bed, rails, group, update,
    /** Where the locomotive is, for the camera and for the screenshot tool. */
    trainPos: () => (vehicles[0] ? vehicles[0].mesh.position.clone() : null),
    ways, km: metres / 1000,
    cars: vehicles.length,
    lineKm: total / 1000,
    tris: (ballast.pos.length + steel.pos.length) / 9
      + vehicles.reduce((s, v) => s + v.mesh.geometry.attributes.position.count / 3, 0),
  };
}
