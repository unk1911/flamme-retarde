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
};

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

    const wallCol0 = WALLS[(rng() * WALLS.length) | 0];
    const roofCol0 = ROOFS[(rng() * ROOFS.length) | 0];
    // Vary each building a shade so the field of roofs has texture at altitude.
    const wv = 0.88 + rng() * 0.24, rv = 0.86 + rng() * 0.28;
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
    // A gable on the footprint's principal axis. A true straight skeleton
    // would be better and about fifty times the code; at the altitude this is
    // seen from, the ridge running the right way is the whole battle.
    const [ax, az] = principalAxis(pts, cx, cz);
    const bx = -az, bz = ax;
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const [x, z] of pts) {
      const dx = x - cx, dz = z - cz;
      const u = dx * ax + dz * az, v = dx * bx + dz * bz;
      if (u < uMin) uMin = u; if (u > uMax) uMax = u;
      if (v < vMin) vMin = v; if (v > vMax) vMax = v;
    }
    const o = CITY.overhang;
    uMin -= o; uMax += o; vMin -= o; vMax += o;
    const halfShort = (vMax - vMin) * 0.5;
    const rise = Math.min(CITY.maxRoofRise, halfShort * CITY.pitch * 2);
    const ridge = top + rise;

    const P = (u, v, y) => [cx + ax * u + bx * v, y, cz + az * u + bz * v];
    const a1 = P(uMin, vMin, top), a2 = P(uMax, vMin, top);
    const b1 = P(uMin, vMax, top), b2 = P(uMax, vMax, top);
    const r1 = P(uMin, (vMin + vMax) * 0.5, ridge);
    const r2 = P(uMax, (vMin + vMax) * 0.5, ridge);

    // two slopes
    pushTri(roofPos, roofNorm, roofCol, a1, a2, r2, rcol);
    pushTri(roofPos, roofNorm, roofCol, a1, r2, r1, rcol);
    pushTri(roofPos, roofNorm, roofCol, b2, b1, r1, rcol);
    pushTri(roofPos, roofNorm, roofCol, b2, r1, r2, rcol);
    // gable ends, in the wall colour — they are masonry, not tile
    pushTri(roofPos, roofNorm, roofCol, a1, r1, b1, wcol);
    pushTri(roofPos, roofNorm, roofCol, a2, b2, r2, wcol);

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
    walls, roofs, built,
    tris: (wallPos.length + roofPos.length) / 9,
  };
}
