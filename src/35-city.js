// -----------------------------------------------------------------------------
// Šibenik, from its real footprints.
//
// 13 343 OpenStreetMap building outlines, extruded to their tagged heights and
// capped with pitched pantile roofs. From a Canadair the roofs *are* the town —
// that unbroken terracotta field climbing from the waterfront to St Michael's is
// the thing you are trying to save — so the roof gets the geometry budget and
// the walls get whatever is left.
//
// Everything merges into two buffers, walls and roofs, so the whole city is two
// draw calls.
// -----------------------------------------------------------------------------

const CITY = {
  eaveMin: 2.6,
  pitch: 0.34,          // roof rise as a fraction of the short OBB axis
  overhang: 0.5,        // metres of eave past the wall
  maxRoofRise: 4.2,
  parapet: 0.4,         // how far a flat roof's parapet stands proud
};

/** Roof forms, as OSM codes them. `b.s` is absent when OSM does not say. */
const ROOF = { GABLE: 0, HIP: 1, FLAT: 2, PYRAMID: 3, SKILLION: 4, ROUND: 5 };

/**
 * What to draw when OSM does not say — which is 11 234 of the 13 343.
 *
 * Of the roofs that *are* tagged here, 82% are hipped, 14% gabled and 4% flat,
 * so guessing "gable" for everything (which is what this used to do) got the
 * town backwards. But the ratio is not uniform across Šibenik: the old town is
 * continuous terraces on narrow plots, and a terrace is gabled because it
 * shares its side walls with the next house along, while the detached villas
 * up the hill and out at Jadrija are hipped on all four sides. So the guess is
 * conditioned on how narrow and how hemmed-in the footprint is, which is
 * exactly the thing that decides it in reality.
 */
function guessRoof(shortAxis, urban, r) {
  const terrace = sat((9.5 - shortAxis) / 5) * 0.55 + sat(urban * 1.4 - 0.35) * 0.45;
  if (r < 0.045) return ROOF.FLAT;
  return r < 0.045 + 0.90 * terrace ? ROOF.GABLE : ROOF.HIP;
}

/** bake.py packs a tagged colour into 24 bits; unpack to linear-ish floats. */
function unpackCol(v) {
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/**
 * Principal axis of a footprint, by second moment. Šibenik's old town is a
 * dense grid of long narrow blocks and the ridge always runs the long way, so
 * getting this axis right is most of what makes the roofscape read correctly.
 */
function principalAxis(pts, cx, cz) {
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of pts) {
    const dx = x - cx, dz = z - cz;
    sxx += dx * dx; szz += dz * dz; sxz += dx * dz;
  }
  const theta = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  return [Math.cos(theta), Math.sin(theta)];
}

function buildCity(scene) {
  const wallPos = [], wallNorm = [], wallCol = [];
  const roofPos = [], roofNorm = [], roofCol = [];
  const rng = mulberry32(CONFIG.seed ^ 0x00c179);

  // Wall palette: Dalmatian limestone and lime render — bone, sand, and the
  // grey of unrendered stone. Roofs: pantile, which weathers from orange
  // through brick to a lichen-grey.
  const WALLS = [
    [0.86, 0.83, 0.76], [0.80, 0.76, 0.68], [0.88, 0.86, 0.81],
    [0.74, 0.71, 0.65], [0.83, 0.78, 0.69], [0.90, 0.87, 0.80],
  ];
  const ROOFS = [
    [0.62, 0.29, 0.17], [0.70, 0.34, 0.19], [0.55, 0.26, 0.16],
    [0.66, 0.36, 0.24], [0.58, 0.31, 0.22], [0.72, 0.40, 0.26],
    [0.48, 0.28, 0.22],
  ];

  const pushTri = (P, N, C, a, b, c, col) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    for (const p of [a, b, c]) {
      P.push(p[0], p[1], p[2]);
      N.push(nx, ny, nz);
      C.push(col[0], col[1], col[2]);
    }
  };

  let built = 0;
  let tagged = 0;
  const forms = [0, 0, 0, 0, 0, 0];
  for (const b of world.town) {
    const pts = b.p;
    if (pts.length < 3) continue;

    let cx = 0, cz = 0;
    for (const [x, z] of pts) { cx += x; cz += z; }
    cx /= pts.length; cz /= pts.length;

    // Leave a hole where a hand-built landmark stands. OSM has a footprint for
    // the cathedral like it has one for every house, and an extruded box in
    // the middle of St James would be worse than nothing.
    let shadowed = false;
    for (const L of landmarkSites) {
      if ((cx - L.x) ** 2 + (cz - L.z) ** 2 < L.clear * L.clear) { shadowed = true; break; }
    }
    if (shadowed) continue;

    // Sit the building on the ground, and use the *lowest* corner so nothing
    // floats on a slope — the old town is built up a hill.
    let gy = Infinity;
    for (const [x, z] of pts) gy = Math.min(gy, groundAt(x, z));
    if (!isFinite(gy)) continue;
    const base = gy - 1.2;

    // OSM's colour wins where it exists — 45 walls and 91 roofs in this box
    // are tagged, and a building somebody bothered to record as white should
    // be white. Everything else comes from the palette.
    const wallCol0 = b.wc != null ? unpackCol(b.wc) : WALLS[(rng() * WALLS.length) | 0];
    const roofCol0 = b.rc != null ? unpackCol(b.rc) : ROOFS[(rng() * ROOFS.length) | 0];
    // Vary each building a shade so the field of roofs has texture at altitude.
    // A tagged colour gets less of this — it is a fact, not a guess.
    const spread = (b.wc != null || b.rc != null) ? 0.4 : 1;
    const wv = 1 + (rng() - 0.5) * 0.24 * spread;
    const rv = 1 + (rng() - 0.5) * 0.28 * spread;
    const wcol = wallCol0.map((c) => c * wv);
    const rcol = roofCol0.map((c) => c * rv);

    const eave = Math.max(CITY.eaveMin, b.h);
    const top = base + eave;

    // ── walls ──────────────────────────────────────────────────────────────
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[(i + 1) % pts.length];
      pushTri(wallPos, wallNorm, wallCol,
        [x0, base, z0], [x1, base, z1], [x1, top, z1], wcol);
      pushTri(wallPos, wallNorm, wallCol,
        [x0, base, z0], [x1, top, z1], [x0, top, z0], wcol);
    }

    // ── roof ───────────────────────────────────────────────────────────────
    // Built on the footprint's oriented bounding box, along its principal
    // axis. A true straight skeleton would be better and about fifty times the
    // code; at the altitude this is seen from, the ridge running the right way
    // and the *form* being right are the whole battle.
    const [ax, az] = principalAxis(pts, cx, cz);
    const bx = -az, bz = ax;
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const [x, z] of pts) {
      const dx = x - cx, dz = z - cz;
      const u = dx * ax + dz * az, v = dx * bx + dz * bz;
      if (u < uMin) uMin = u; if (u > uMax) uMax = u;
      if (v < vMin) vMin = v; if (v > vMax) vMax = v;
    }
    const shortAxis = vMax - vMin;
    const shape = b.s != null ? b.s
      : guessRoof(shortAxis, urbanAt(cx, cz), rng());
    forms[shape]++;
    if (b.s != null) tagged++;

    // A flat roof has no eave to overhang with; every other form does.
    const o = shape === ROOF.FLAT ? 0 : CITY.overhang;
    uMin -= o; uMax += o; vMin -= o; vMax += o;
    const halfShort = (vMax - vMin) * 0.5;
    // roof:levels means a habitable roof storey, which is a deeper roof.
    const rise = Math.min(CITY.maxRoofRise * (b.rl ? 1.9 : 1),
      halfShort * CITY.pitch * 2 * (b.rl ? 1.7 : 1));
    const ridge = top + rise;
    const vMid = (vMin + vMax) * 0.5;

    const P = (u, v, y) => [cx + ax * u + bx * v, y, cz + az * u + bz * v];
    // Tile goes in the roof buffer and masonry in the wall buffer, so a gable
    // end gets rendered, not corrugated — the roof shader draws pantile ribs
    // over everything it is handed.
    const tri = (a, c, d, col) => pushTri(roofPos, roofNorm, roofCol, a, c, d, col);
    const quad = (a, c, d, e, col) => { tri(a, c, d, col); tri(a, d, e, col); };
    const mTri = (a, c, d) => pushTri(wallPos, wallNorm, wallCol, a, c, d, wcol);
    const mQuad = (a, c, d, e) => { mTri(a, c, d); mTri(a, d, e); };

    const a1 = P(uMin, vMin, top), a2 = P(uMax, vMin, top);
    const b1 = P(uMin, vMax, top), b2 = P(uMax, vMax, top);

    if (shape === ROOF.FLAT) {
      // Deck, plus a parapet standing proud of it — from above the parapet is
      // the only thing that says "flat roof" rather than "hole in the town".
      const d = top + CITY.parapet * 0.5;
      quad(P(uMin, vMin, d), P(uMax, vMin, d), P(uMax, vMax, d), P(uMin, vMax, d), rcol);
      const pTop = top + CITY.parapet;
      const ring = [[uMin, vMin], [uMax, vMin], [uMax, vMax], [uMin, vMax]];
      for (let i = 0; i < 4; i++) {
        const [u0, v0] = ring[i], [u1, v1] = ring[(i + 1) % 4];
        mQuad(P(u0, v0, top), P(u1, v1, top), P(u1, v1, pTop), P(u0, v0, pTop));
      }
    } else if (shape === ROOF.PYRAMID) {
      const apex = P((uMin + uMax) * 0.5, vMid, ridge);
      tri(a1, a2, apex, rcol);
      tri(a2, b2, apex, rcol);
      tri(b2, b1, apex, rcol);
      tri(b1, a1, apex, rcol);
    } else if (shape === ROOF.SKILLION) {
      // Mono-pitch: high along vMin, draining to vMax.
      const h1 = P(uMin, vMin, ridge), h2 = P(uMax, vMin, ridge);
      quad(h1, h2, b2, b1, rcol);
      // The masonry that holds the high side up, and the two raking ends.
      mQuad(a1, a2, h2, h1);
      mTri(h1, b1, a1);
      mTri(h2, a2, b2);
    } else if (shape === ROOF.ROUND) {
      const SEG = 6;
      for (let i = 0; i < SEG; i++) {
        const t0 = i / SEG, t1 = (i + 1) / SEG;
        const v0 = lerp(vMin, vMax, t0), v1 = lerp(vMin, vMax, t1);
        const y0 = top + rise * Math.sin(Math.PI * t0);
        const y1 = top + rise * Math.sin(Math.PI * t1);
        quad(P(uMin, v0, y0), P(uMax, v0, y0), P(uMax, v1, y1), P(uMin, v1, y1), rcol);
        // the arched end walls, as a fan from the springing line
        mTri(P(uMin, vMid, top), P(uMin, v0, y0), P(uMin, v1, y1));
        mTri(P(uMax, vMid, top), P(uMax, v1, y1), P(uMax, v0, y0));
      }
    } else {
      // Gable and hip are the same four slopes; the hip pulls the ridge in
      // from both ends and closes them with tile instead of masonry.
      const hip = shape === ROOF.HIP;
      const inset = hip ? Math.min(halfShort, (uMax - uMin) * 0.42) : 0;
      const r1 = P(uMin + inset, vMid, ridge);
      const r2 = P(uMax - inset, vMid, ridge);
      quad(a1, a2, r2, r1, rcol);
      quad(b2, b1, r1, r2, rcol);
      // The ends: tile on a hip, masonry on a gable.
      if (hip) {
        tri(a1, r1, b1, rcol);
        tri(b2, r2, a2, rcol);
      } else {
        mTri(a1, r1, b1);
        mTri(b2, r2, a2);
      }
    }

    built++;
  }

  const mk = (pos, norm, col, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };

  // Per-vertex colour, plus a pantile corrugation on the roofs that only shows
  // up when you get low — from 300 m it just reads as tone.
  const wallMat = solidMaterial(0xffffff, {
    spec: 0.05, specPower: 24,
    side: THREE.DoubleSide,
    body: `n = gl_FrontFacing ? n : -n;
           base *= vVCol;
           // string courses and shutters, suggested rather than drawn
           float band = smoothstep(0.42, 0.5, fract(vWorld.y * 0.34));
           base *= 0.94 + 0.10 * band;`,
  });
  const roofMat = solidMaterial(0xffffff, {
    spec: 0.10, specPower: 30,
    side: THREE.DoubleSide,
    body: `n = gl_FrontFacing ? n : -n;
           base *= vVCol;
           // pantile ribs, running down the slope
           float rib = sin(dot(vWorld.xz, vec2(6.1, 4.3))) * 0.5 + 0.5;
           base *= 0.90 + 0.20 * rib;
           base *= 0.92 + 0.16 * fbm2(vWorld.xz * 0.7, 2);`,
  });

  const walls = mk(wallPos, wallNorm, wallCol, wallMat);
  const roofs = mk(roofPos, roofNorm, roofCol, roofMat);

  return {
    walls, roofs, built, tagged, forms,
    tris: (wallPos.length + roofPos.length) / 9,
  };
}
