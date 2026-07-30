// -----------------------------------------------------------------------------
// Aerodrom Rokići — a fictitious airfield, on real ground.
//
// There is no airport at Šibenik. The nearest hard runway is Zadar or Split, and
// a CL-415 working this coast operates off one of those. So this one is invented
// — but it is not invented *anywhere*: the site is searched for at load time,
// because a runway is the one structure that cannot be dropped onto karst and
// hoped for. 1 100 m of asphalt has to be flat, and the game already knows to
// twelve metres exactly how flat every part of this landscape is.
//
// The search fits a plane through candidate strips and takes the flattest one
// that is on land, off the town, and not sitting in the fire's way. Everything
// else — the apron, the hangars, the tower, the fuel farm — hangs off wherever
// that turns out to be.
//
// The apron props are the reason this exists. Each one is a thing that can catch
// fire, and the fire that catches them is the same cellular automaton that has
// been chasing you all game.
// -----------------------------------------------------------------------------

const FIELD = {
  runway: 1100,          // metres
  width: 30,
  taxiway: 14,
  apronW: 150,
  apronD: 95,
  lift: 0.5,             // asphalt above the ground, same reason as the roads
  // Search grid. 250 m over a 13 km box is 2 700 candidates, and at six
  // headings and twenty-one samples each that is a third of a million height
  // lookups — about eighty milliseconds, once, at load.
  probeStep: 250,
  headings: 6,
  samples: 21,
};

/**
 * Find somewhere to put 1 100 m of runway.
 *
 * For each candidate centre and heading, sample the height along the centreline
 * and down both edges, fit a line to the centreline profile, and score by how
 * far the worst sample sits off it. A runway may be *sloped* — plenty of real
 * ones are, up to about 2% — but it may not be bumpy, and those are two
 * different measurements.
 */
function findAirfieldSite() {
  const H = CONFIG.world / 2 - 900;
  const halfL = FIELD.runway / 2;
  const halfW = FIELD.width / 2 + 40;      // plus the strip either side
  const [igx, igz] = CONFIG.ignitionPoint;
  let best = null;

  for (let cx = -H; cx <= H; cx += FIELD.probeStep) {
    for (let cz = -H; cz <= H; cz += FIELD.probeStep) {
      // Cheap rejections first, before any of the expensive sampling.
      if (isSea(cx, cz)) continue;
      const g0 = groundAt(cx, cz);
      if (g0 < 3 || g0 > 190) continue;
      // Not in the town, and not on the hillside the fire is going to run up:
      // an airfield that burns in the first four minutes is not a destination.
      if (urbanAt(cx, cz) > 0.18) continue;
      if (Math.hypot(cx - igx, cz - igz) < 1600) continue;
      if (shoreAt(cx, cz) < 90) continue;

      for (let h = 0; h < FIELD.headings; h++) {
        const a = (h / FIELD.headings) * Math.PI;   // 0..180; a runway is two-way
        const dx = Math.cos(a), dz = Math.sin(a);
        const px = -dz, pz = dx;

        // Centreline profile, and a least-squares line through it.
        let n = 0, st = 0, sy = 0, stt = 0, sty = 0;
        const prof = [];
        let bad = false;
        for (let i = 0; i < FIELD.samples; i++) {
          const t = -halfL + (2 * halfL) * i / (FIELD.samples - 1);
          const x = cx + dx * t, z = cz + dz * t;
          if (isSea(x, z)) { bad = true; break; }
          const y = groundAt(x, z);
          if (y < 1.5) { bad = true; break; }
          prof.push([t, y]);
          n++; st += t; sy += y; stt += t * t; sty += t * y;
        }
        if (bad || n < FIELD.samples) continue;
        const den = n * stt - st * st;
        const slope = Math.abs(den) < 1e-6 ? 0 : (n * sty - st * sy) / den;
        const icept = (sy - slope * st) / n;
        // 2% is about the steepest gradient anybody builds; past that reject
        // outright rather than letting a smooth hillside win on flatness.
        if (Math.abs(slope) > 0.02) continue;

        let worst = 0;
        for (const [t, y] of prof) worst = Math.max(worst, Math.abs(y - (slope * t + icept)));
        if (worst > 9) continue;

        // Now the width. A ridge running along the strip is flat down the
        // middle and useless: check the shoulders too.
        let shoulder = 0;
        for (let i = 0; i < FIELD.samples; i += 2) {
          const t = -halfL + (2 * halfL) * i / (FIELD.samples - 1);
          for (const s of [-1, 1]) {
            const x = cx + dx * t + px * s * halfW;
            const z = cz + dz * t + pz * s * halfW;
            if (isSea(x, z)) { shoulder = 1e9; break; }
            shoulder = Math.max(shoulder,
              Math.abs(groundAt(x, z) - (slope * t + icept)));
          }
          if (shoulder > 1e8) break;
        }
        if (shoulder > 1e8) continue;

        const score = worst + shoulder * 0.7;
        if (!best || score < best.score) {
          best = { x: cx, z: cz, yaw: a, slope, icept, score, worst, shoulder };
        }
      }
    }
  }
  return best;
}

/**
 * The parked light aircraft, the bowser, the drums, the crates — everything on
 * the apron that has something in it worth catching fire. These are what the
 * ground mode is about, so each one carries its own fuel and its own heat, and
 * the fire that lights them is read out of the same automaton the aeroplane has
 * been fighting from the air.
 */
const BURNABLE = [
  { kind: 'drum', w: 0.62, h: 0.9, fuel: 1.0, col: [0.62, 0.24, 0.14] },
  { kind: 'crate', w: 1.3, h: 1.1, fuel: 0.8, col: [0.52, 0.40, 0.26] },
  { kind: 'bowser', w: 2.4, h: 2.9, fuel: 1.0, col: [0.72, 0.70, 0.30] },
  { kind: 'tug', w: 1.7, h: 1.5, fuel: 0.55, col: [0.28, 0.42, 0.30] },
  { kind: 'cub', w: 9.0, h: 2.2, fuel: 0.7, col: [0.86, 0.84, 0.78] },
];

function buildAirfield(scene) {
  const site = findAirfieldSite();
  if (!site) {
    console.warn('no airfield site found — the ground mission is unreachable');
    return { site: null, onRunway: () => null, objects: [], update: () => {}, tris: 0 };
  }

  const { x: cx, z: cz, yaw, slope, icept } = site;
  const dx = Math.cos(yaw), dz = Math.sin(yaw);      // along the runway
  const px = -dz, pz = dx;                           // across it
  const halfL = FIELD.runway / 2;

  /** Runway-local (along, across) -> world, on the fitted plane. */
  const P = (t, s, up = 0) => [
    cx + dx * t + px * s,
    icept + slope * t + FIELD.lift + up,
    cz + dz * t + pz * s,
  ];
  /** The fitted surface height at a runway-local along-distance. */
  const planeY = (t) => icept + slope * t + FIELD.lift;

  // ── the paved surfaces ─────────────────────────────────────────────────────
  // One ribbon buffer, uv carrying (across 0..1, along in metres) so the
  // markings can be a shader and not two hundred little quads.
  const pav = { pos: [], norm: [], col: [], uv: [] };
  const strip = (t0, t1, s0, s1, col, marked) => {
    const put = (t, s) => {
      const p = P(t, s);
      pav.pos.push(p[0], p[1], p[2]);
      pav.norm.push(0, 1, 0);
      pav.col.push(col[0], col[1], col[2]);
      // uv.x is 0..1 across the *runway*, so the centreline lands at 0.5 for
      // the runway itself and off the end of the range for a taxiway.
      pav.uv.push((s - s0) / (s1 - s0), marked ? t : -1e4);
    };
    // Wound so the face points *up*. The runway-local axes are a fixed 90°
    // rotation (px = -dz, pz = dx), so (+t) x (+s) comes out as -Y: taking the
    // corners in the obvious order gave the whole airfield downward-facing
    // triangles, which front-face culling then threw away. The runway was there
    // the entire time and you could land on it — you just could not see it.
    put(t0, s0); put(t1, s1); put(t1, s0);
    put(t0, s0); put(t0, s1); put(t1, s1);
  };

  const ASPHALT = [0.105, 0.105, 0.112];
  const CONC = [0.42, 0.41, 0.39];
  // The runway, in segments so it follows the fitted plane and not a chord.
  const SEG = 22;
  for (let i = 0; i < SEG; i++) {
    const t0 = -halfL + (2 * halfL) * i / SEG;
    const t1 = -halfL + (2 * halfL) * (i + 1) / SEG;
    strip(t0, t1, -FIELD.width / 2, FIELD.width / 2, ASPHALT, true);
  }
  // Taxiway from the midpoint out to the apron, and the apron itself.
  const APRON_S = FIELD.width / 2 + 60;
  strip(-FIELD.taxiway / 2, FIELD.taxiway / 2, FIELD.width / 2, APRON_S, ASPHALT, false);
  strip(-FIELD.apronW / 2, FIELD.apronW / 2, APRON_S, APRON_S + FIELD.apronD, CONC, false);

  const pavMesh = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pav.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pav.norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(pav.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(pav.uv, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const m = new THREE.Mesh(g, solidMaterial(0xffffff, {
      spec: 0.04, specPower: 18,
      // halfL is interpolated rather than passed as a uniform: the shared solid
      // fragment shader declares a fixed set, and a constant that is known when
      // the material is built does not need to be one of them.
      body: /* glsl */ `
        base *= vVCol;
        base *= 0.90 + 0.20 * fbm2(vWorld.xz * 2.6, 2);
        // vUv.y is metres along the runway, or a huge negative for anything
        // that is not runway — taxiway and apron carry no markings.
        if (vUv.y > -9000.0) {
          float across = vUv.x * 2.0 - 1.0;
          float ax = abs(across);
          float t = vUv.y;
          float endD = ${halfL.toFixed(1)} - abs(t);   // metres to the nearer threshold
          vec3 paint = vec3(0.80, 0.79, 0.74);
          // Centreline: 30 m of stripe, 20 m of gap, stopping short of both ends.
          float cl = (1.0 - smoothstep(0.020, 0.045, ax))
                   * step(0.40, fract(t / 50.0)) * step(60.0, endD);
          // Threshold bars: eight longitudinal stripes over the first 45 m.
          float thr = step(endD, 45.0) * step(12.0, endD)
                    * step(0.55, fract(across * 8.0)) * step(ax, 0.86);
          // Touchdown zone markers, two pairs, at 150 m and 300 m in.
          float tzBand = step(140.0, endD) * step(endD, 162.0)
                       + step(292.0, endD) * step(endD, 314.0);
          float tz = tzBand * step(0.22, ax) * step(ax, 0.44);
          // Edge lines down both sides.
          float edge = smoothstep(0.86, 0.92, ax) * (1.0 - smoothstep(0.955, 0.99, ax));
          float mark = clamp(cl + thr + tz + edge, 0.0, 1.0);
          base = mix(base, paint, mark * 0.86);
          // Rubber, laid down where every wheel lands.
          float rub = (1.0 - smoothstep(60.0, 200.0, endD)) * step(30.0, endD)
                    * (1.0 - smoothstep(0.5, 0.8, ax));
          base *= 1.0 - rub * 0.42;
        }
      `,
    }));
    m.frustumCulled = false;
    m.material.polygonOffset = true;
    m.material.polygonOffsetFactor = -6;
    m.material.polygonOffsetUnits = -12;
    m.renderOrder = -1;
    scene.add(m);
    return m;
  })();

  // ── the buildings ──────────────────────────────────────────────────────────
  const b = propBuilder();
  const WALL = [0.80, 0.78, 0.73];
  const ROOF = [0.44, 0.45, 0.47];
  const RED = [0.58, 0.25, 0.18];
  const DARK = [0.17, 0.17, 0.18];
  const GLASSC = [0.09, 0.14, 0.17];

  /** A box in runway-local coordinates, standing on the pavement. */
  const lbox = (t, s, h, along, across, col, top) => {
    // Runway-local axes are not world axes, so build the box from its eight
    // corners rather than from an axis-aligned centre and size.
    const y0 = planeY(t), y1 = y0 + h;
    const c = (dt, ds, y) => P(t + dt, s + ds, y - planeY(t));
    const A = along / 2, C = across / 2;
    const v = [
      c(-A, -C, y0), c(A, -C, y0), c(A, C, y0), c(-A, C, y0),
      c(-A, -C, y1), c(A, -C, y1), c(A, C, y1), c(-A, C, y1),
    ];
    b.quad(v[0], v[3], v[2], v[1], col);              // floor
    b.quad(v[4], v[5], v[6], v[7], top || col);       // roof
    b.quad(v[0], v[1], v[5], v[4], col);
    b.quad(v[1], v[2], v[6], v[5], col);
    b.quad(v[2], v[3], v[7], v[6], col);
    b.quad(v[3], v[0], v[4], v[7], col);
  };

  const AS = APRON_S + 12;                            // apron front edge
  // Terminal: one storey, a glazed band, and a red pantile roof, because a
  // Dalmatian shed is a Dalmatian shed even when it is airside.
  lbox(-46, AS + 34, 5.4, 40, 15, WALL, WALL);
  lbox(-46, AS + 34, 0.9, 42, 17, RED, RED);          // eaves course
  lbox(-46, AS + 26.6, 2.0, 36, 0.4, GLASSC);         // the glazing
  lbox(-46, AS + 34, 1.2, 41, 16, RED, RED);
  // Two hangars, open-fronted, with curved-looking roofs faked by three facets.
  for (const t of [22, 64]) {
    lbox(t, AS + 30, 8.2, 34, 26, WALL, ROOF);
    lbox(t, AS + 16.6, 7.0, 30, 0.5, DARK);           // the door opening
  }
  // Control tower: a stalk and a cab with a visible lean on the glass.
  lbox(-6, AS + 52, 13.0, 7, 7, WALL, WALL);
  lbox(-6, AS + 52, 3.1, 10, 10, GLASSC, ROOF);
  // Fuel farm, set well away from everything, which is the one thing about an
  // airfield layout that is not aesthetic.
  for (let i = 0; i < 3; i++) lbox(102 + i * 11, AS + 58, 5.0, 8, 8, [0.76, 0.77, 0.78], ROOF);
  // Windsock mast, and a segmented cone that will not move because nothing here
  // has an update loop — the wind direction it shows is the mission's.
  lbox(-halfL + 120, FIELD.width / 2 + 26, 7.0, 0.5, 0.5, DARK);
  // Perimeter fence, dashed so it is posts and wire rather than a wall.
  for (let i = 0; i <= 78; i++) {
    const t = -halfL - 40 + (FIELD.runway + 80) * i / 78;
    lbox(t, -FIELD.width / 2 - 55, 2.0, 0.22, 0.22, DARK);
    lbox(t, APRON_S + FIELD.apronD + 24, 2.0, 0.22, 0.22, DARK);
  }

  const buildings = new THREE.Mesh(b.geo(), solidMaterial(0xffffff, {
    spec: 0.07, specPower: 26, side: THREE.DoubleSide,
    body: 'n = gl_FrontFacing ? n : -n; base *= vVCol;',
  }));
  buildings.frustumCulled = false;
  scene.add(buildings);

  // ── the things that burn ───────────────────────────────────────────────────
  const rng = mulberry32(CONFIG.seed ^ 0x00a12f);
  const objects = [];
  const place = (spec, t, s, yawOff = 0) => {
    const p = P(t, s);
    objects.push({
      ...spec, x: p[0], y: p[1], z: p[2], yaw: yaw + yawOff,
      // Every one of these starts intact and dry. `heat` climbs when the fire
      // reaches it, `wet` climbs when you point a hose at it, and the two fight.
      burning: 0, heat: 0, wet: 0, out: false, spent: 0,
    });
  };
  // Drums in two rows by the fuel farm, crates on the apron, vehicles parked
  // nose-in to the hangars, and three light aircraft on the line.
  for (let i = 0; i < 14; i++) {
    place(BURNABLE[0], 96 + (i % 7) * 1.5, AS + 40 + Math.floor(i / 7) * 1.6);
  }
  for (let i = 0; i < 9; i++) {
    place(BURNABLE[1], -20 + (i % 3) * 2.0 + rng() * 0.6, AS + 8 + Math.floor(i / 3) * 2.2);
  }
  place(BURNABLE[2], 4, AS + 10);
  place(BURNABLE[2], 88, AS + 44);
  place(BURNABLE[3], 30, AS + 12);
  place(BURNABLE[3], 58, AS + 12);
  for (let i = 0; i < 3; i++) place(BURNABLE[4], -60 + i * 16, AS + 9, 0.06 * (i - 1));

  /**
   * Where on the runway, if anywhere. Returns runway-local coordinates plus how
   * far off the centreline you are as a fraction — which is what the flight
   * model needs to decide whether this is a landing or an accident.
   */
  function onRunway(x, z) {
    const ex = x - cx, ez = z - cz;
    const t = ex * dx + ez * dz;
    const s = ex * px + ez * pz;
    if (Math.abs(t) > halfL + 20) return null;
    if (Math.abs(s) > FIELD.width / 2 + 8) return null;
    return { t, s, y: planeY(t), off: Math.abs(s) / (FIELD.width / 2) };
  }

  /** Anywhere paved — runway, taxiway or apron. The ground mode walks on this. */
  function onPaved(x, z) {
    const ex = x - cx, ez = z - cz;
    const t = ex * dx + ez * dz;
    const s = ex * px + ez * pz;
    const rw = Math.abs(t) <= halfL + 20 && Math.abs(s) <= FIELD.width / 2 + 8;
    const tw = Math.abs(t) <= FIELD.taxiway / 2 + 4
      && s > FIELD.width / 2 && s < APRON_S + 2;
    const ap = Math.abs(t) <= FIELD.apronW / 2 && s >= APRON_S - 2
      && s <= APRON_S + FIELD.apronD;
    return (rw || tw || ap) ? planeY(t) : null;
  }

  // Both ends, so the approach can be flown from whichever way the wind is.
  //
  // `yaw` is in the aeroplane's convention, not a compass bearing: the flight
  // model's forward vector is (-sin yaw, -cos yaw), which is what headingToYaw()
  // encodes. Landing off the low-t threshold means rolling toward +t, so the
  // yaw that points that way is atan2(-dx, -dz) — get this backwards and the
  // aeroplane is placed facing down the runway it is meant to be rolling up.
  const thresholds = [
    { x: P(-halfL, 0)[0], z: P(-halfL, 0)[2], y: planeY(-halfL),
      yaw: Math.atan2(-dx, -dz), rollTo: 1 },
    { x: P(halfL, 0)[0], z: P(halfL, 0)[2], y: planeY(halfL),
      yaw: Math.atan2(dx, dz), rollTo: -1 },
  ];
  const apronCentre = P(0, APRON_S + FIELD.apronD * 0.45);

  return {
    site, onRunway, onPaved, objects, thresholds,
    centre: [cx, planeY(0), cz],
    apron: apronCentre,
    axis: { dx, dz, px, pz, yaw, halfL },
    pavMesh, buildings,
    tris: pav.pos.length / 9
      + buildings.geometry.attributes.position.count / 3,
  };
}
