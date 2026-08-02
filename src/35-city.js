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
  const wallPos = [], wallNorm = [], wallCol = [], wallUv = [];
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

  const pushTri = (P, N, C, a, b, c, col, UV, uvs) => {
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
    if (UV) for (const t of uvs) UV.push(t[0], t[1]);
  };

  /**
   * Facade coordinates, packed into the one spare vec2 the shared material
   * already carries.
   *
   * `u` is metres along the facade, run cumulatively around the footprint so a
   * long wall that OSM happens to have split into three nodes keeps one window
   * rhythm instead of restarting at every vertex.
   *
   * `v` has to answer two questions — how far above this building's own
   * doorstep a fragment is, and how tall the wall is — because a window must
   * only be drawn where the whole storey it belongs to exists, or the roofline
   * slices the top row of windows in half. Both fit in one float: the wall
   * height in whole metres above 1000, the height above the doorstep below it.
   * `up` is at most `h`, `h` is at most about 60, so the packed value stays
   * under 60 000 where a 24-bit mantissa still resolves 4 mm.
   *
   * The +2 bias is because walls are sunk 1.2 m so nothing floats on a slope,
   * so `up` starts *negative* and an unbiased pack would borrow from the
   * height field and put the ground floor underground.
   *
   * A flat -1 is the sentinel for masonry with no openings in it — gable ends,
   * parapets — and survives interpolation because all three corners carry it.
   */
  const fac = (h, up) => Math.floor(h) * 1000 + up + 2;
  const PLAIN = -1;

  let built = 0;
  let tagged = 0;
  const forms = [0, 0, 0, 0, 0, 0];
  const obbs = [];        // oriented footprints, for walking into
  for (const b of world.town) {
    const pts = b.p;
    if (pts.length < 3) continue;
    // Jadrija rebuilds the houses you can walk up to, with the eaves and sills
    // and shutters this builder has no budget for across thirteen thousand of
    // them. It claims them first, and they must not be drawn twice — two
    // buildings on one footprint z-fight along every wall.
    if (typeof jadrija !== 'undefined' && jadrija && jadrija.ownsBuilding
      && jadrija.ownsBuilding(b)) continue;

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
    let run = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[(i + 1) % pts.length];
      const u0 = run;
      const u1 = run + Math.hypot(x1 - x0, z1 - z0);
      run = u1;
      // Heights are measured from the ground line, not from the sunk footing.
      const wh = eave - 1.2;
      const t = fac(wh, wh), b0 = fac(wh, -1.2);
      pushTri(wallPos, wallNorm, wallCol,
        [x0, base, z0], [x1, base, z1], [x1, top, z1], wcol,
        wallUv, [[u0, b0], [u1, b0], [u1, t]]);
      pushTri(wallPos, wallNorm, wallCol,
        [x0, base, z0], [x1, top, z1], [x0, top, z0], wcol,
        wallUv, [[u0, b0], [u1, t], [u0, t]]);
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

    // The same oriented box, kept for collision. Every one of these is scenery
    // you could walk straight through the moment you touch down anywhere that
    // is not the aerodrome or Jadrija, because the locale synthesised for open
    // country has no blockers at all. Taken here rather than recomputed later
    // because the principal axis and the extents are already in hand, and taken
    // *before* the eave overhang is added below — you are stopped by the wall,
    // not by the gutter.
    obbs.push({
      x: cx + ax * (uMin + uMax) * 0.5 + bx * (vMin + vMax) * 0.5,
      z: cz + az * (uMin + uMax) * 0.5 + bz * (vMin + vMax) * 0.5,
      ax, az, hu: (uMax - uMin) * 0.5, hv: (vMax - vMin) * 0.5, h: eave,
    });
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
    const mTri = (a, c, d) => pushTri(wallPos, wallNorm, wallCol, a, c, d, wcol,
      wallUv, [[0, PLAIN], [0, PLAIN], [0, PLAIN]]);
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

  const mk = (pos, norm, col, mat, uv) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };

  // Per-vertex colour, plus a pantile corrugation on the roofs that only shows
  // up when you get low — from 300 m it just reads as tone.
  // Facades. Every opening here is a fragment-shader test against the packed
  // coordinates `fac()` wrote — no extra geometry at all, which is the only
  // reason thirteen thousand buildings can afford windows.
  const wallMat = solidMaterial(0xffffff, {
    spec: 0.05, specPower: 24,
    side: THREE.DoubleSide,
    body: `n = gl_FrontFacing ? n : -n;
      base *= vVCol;

      // Limestone bounce. This whole coast is white rock, the ground between
      // the houses is the same rock, and a wall standing in shade is lit from
      // below by a very bright floor. With only the sky term, every shaded
      // facade fell to near-black — which is not what a Dalmatian town does at
      // four in the afternoon in August, and it swallowed the windows whole.
      float shade = 1.0 - max(dot(n, uSunDir), 0.0) * shadowAt(vWorld);
      base *= 1.0 + 0.85 * shade * (1.0 - abs(n.y));

      float packed = vUv.y;
      // Gable ends and parapets are masonry: render, string course, no holes.
      if (packed > -0.5) {
        float wallH = floor(packed / 1000.0);
        float up    = packed - wallH * 1000.0 - 2.0;
        float along = vUv.x;

        // One number per building, from the colour it was already given — the
        // per-building jitter in that colour makes it effectively unique, so
        // no two neighbours share a window rhythm or a shutter.
        float seed = fract(vVCol.r * 91.7 + vVCol.g * 57.3 + vVCol.b * 27.1);
        float storey = 3.02 + 0.30 * seed;
        float bay    = 2.60 + 0.70 * fract(seed * 7.31);

        float fl      = floor(up / storey);          // which floor
        float inFloor = up - fl * storey;            // metres above its slab
        float fx    = fract(along / bay + 0.5 + seed * 0.7);
        float inBay = (fx - 0.5) * bay;

        // Only where the whole storey fits under the eave: a half window cut
        // off by the roofline is worse than a blank wall.
        float room = step(storey * (fl + 1.0), wallH + 0.05);
        float ground = step(fl, 0.5);

        // Ground floor is a door or a shopfront — wider, taller, sill on the
        // pavement. Everything above is a window with a sill and a lintel.
        float wHalf = mix(0.52, 0.62, ground);
        float sill  = mix(1.02, 0.06, ground);
        float head  = sill + mix(1.38, 2.12, ground);

        float inX = 1.0 - smoothstep(wHalf - 0.05, wHalf + 0.02, abs(inBay));
        float inY = smoothstep(sill - 0.03, sill + 0.03, inFloor)
                  * (1.0 - smoothstep(head - 0.03, head + 0.03, inFloor));
        float hole = inX * inY * room;

        // Glass: dark, and darker the more steeply you look into it, with the
        // sky caught on it at a glancing angle. Reads as depth from the air,
        // which is the whole point of putting holes in a wall you fly over.
        vec3 look = normalize(vWorld - uCamPos);
        float graze = 1.0 - abs(dot(look, n));
        vec3 glass = mix(vec3(0.055, 0.062, 0.075), uZenith * 0.65,
                         graze * graze * 0.75);
        // A few are lit or have washing on the line; a few are shuttered fast.
        float lit = step(0.965, fract(seed * 311.7 + fl * 17.3 + floor(along / bay) * 5.1));
        glass = mix(glass, vec3(0.85, 0.74, 0.52), lit * 0.55);
        base = mix(base, glass, hole * 0.94);

        // Reveal: the wall is 40 cm of stone, so an opening has a shadow on
        // its head and a bright sill under it.
        float frame = inX * room
          * (1.0 - smoothstep(0.0, 0.09, abs(inFloor - head)))
          * (1.0 - hole);
        base *= 1.0 - frame * 0.45;
        float sillLip = inX * room
          * (1.0 - smoothstep(0.0, 0.07, abs(inFloor - sill)));
        base = mix(base, base * 1.22 + 0.04, sillLip * 0.6);

        // Shutters, folded back against the render either side of the window.
        // Dalmatian green, faded, and only on the upper floors.
        float shutW = 1.0 - smoothstep(0.30, 0.40, abs(abs(inBay) - (wHalf + 0.20)));
        float shut = shutW * inY * room * (1.0 - ground)
                   * step(0.35, fract(seed * 53.1 + fl * 3.7));
        base = mix(base, vec3(0.20, 0.29, 0.22) * (0.8 + 0.4 * seed), shut * 0.8);

        // String course at every floor line, and the render itself is not flat.
        float course = 1.0 - smoothstep(0.0, 0.12, inFloor);
        base *= 1.0 + 0.07 * course;
      }
      base *= 0.95 + 0.10 * fbm2(vWorld.xz * 3.1 + vWorld.y * 0.7, 2);`,
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

  const walls = mk(wallPos, wallNorm, wallCol, wallMat, wallUv);
  const roofs = mk(roofPos, roofNorm, roofCol, roofMat);

  return {
    walls, roofs, built, tagged, forms, obbs,
    tris: (wallPos.length + roofPos.length) / 9,
  };
}
