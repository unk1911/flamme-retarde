// -----------------------------------------------------------------------------
// What actually burns.
//
// The fire automaton has always read its fuel from the OSM land cover, so the
// hillside above Jadrija was pine and maquis in every sense except that you
// could not see it. This is the seeing part: instanced Aleppo pine, cypress,
// olive and maquis scrub, placed from the same cover map the fire reads, so a
// tree standing in a burning cell is a tree standing in a burning cell.
//
// Placement is deterministic per 512 m tile, so a tree is always in the same
// spot however you fly at it, and tiles are generated on demand and cached.
// Everything visible is repacked into four instance buffers — four draw calls
// for the whole landscape, whatever the density.
// -----------------------------------------------------------------------------

const VEG = {
  tile: 512,
  // 1500 m put the edge of the vegetation inside the frame on any level flight:
  // you could watch the hillside stop. 2200 pushes it into the haze instead.
  radius: 2200,
  maxTiles: 220,
  perTile: 2100,         // candidate samples per tile, before cover rejects them
  budget: 34000,         // hard ceiling on live instances
  // Where a tree stops being worth its polygons.
  //
  // The whole landscape has always been one model per species, and that model
  // had to be cheap enough to draw thirty-four thousand times — which meant it
  // had to be cheap at 2 km, which meant it was the same lofted lampshade at
  // two metres. A pine you walk past on the way to the fire is not the same
  // problem as a pine on a hillside in the haze, and it was being solved as if
  // it were.
  //
  // Two models, then, and a distance. 300 m is where a 10 m tree is about
  // fifteen pixels tall and there is nothing left to see: the swap is invisible
  // and everything in the ring is a fraction of a percent of a circle 2.2 km
  // across. Measured, on the hillside above Jadrija: about 500 of 20 000.
  near: 300,
  nearMax: 3000,         // and the ceiling on those, so the buffer is bounded
};

/**
 * How many of each species per candidate sample, by cover class. The numbers
 * are per-sample probabilities: a tile throws VEG.perTile darts and each one
 * either lands on something that grows or it does not.
 */
const GROWS = [
  /* SEA   */ null,
  /* ROCK  */ { bush: 0.05 },
  /* GRASS */ { bush: 0.10, olive: 0.02 },
  /* SCRUB */ { bush: 0.62, pine: 0.07, cypress: 0.01 },
  /* PINE  */ { pine: 0.55, bush: 0.22, cypress: 0.04 },
  /* OLIVE */ { olive: 0.40, bush: 0.10, cypress: 0.03 },
  /* URBAN */ { cypress: 0.05, olive: 0.03, bush: 0.03 },
  /* SAND  */ { bush: 0.02 },
  /* LAKE  */ null,
  /* VINE  */ { bush: 0.20, olive: 0.06 },
];

const SPECIES = ['pine', 'cypress', 'olive', 'bush'];

/** A ring of points, optionally made irregular so no two sides match. */
function vegRing(y, r, seg, jag = 0) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    const rr = r * (1 + jag * Math.sin(i * 2.37 + y * 6.1));
    pts.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  return pts;
}

/**
 * Build one species prototype, normalised to a height of 1 and a radius in the
 * same units, and paint the trunk and the canopy with vertex colours so a
 * single instanced draw can carry both.
 */
function vegGeo(rings, seg, split, barkCol, leafCol) {
  const g = loft(rings, { closed: true, caps: false });
  const n = g.attributes.position.count;
  const pos = g.attributes.position.array;
  const col = new Float32Array(n * 3);
  // The canopy takes the same shaded-under, sunlit-over gradient the close-up
  // models do. It is the one thing that carries at two kilometres: a hillside
  // of flat-green lampshades reads as painted card, and the same hillside with
  // the undersides dropped to half reads as depth.
  const [dk, lt] = vegShade(leafCol, 0.64, 1.22);
  let ylo = Infinity, yhi = -Infinity;
  for (let i = split * seg; i < n; i++) {
    const y = pos[i * 3 + 1];
    if (y < ylo) ylo = y;
    if (y > yhi) yhi = y;
  }
  for (let i = 0; i < n; i++) {
    const ring = Math.floor(i / seg);
    if (ring < split) {
      col[i * 3] = barkCol[0]; col[i * 3 + 1] = barkCol[1];
      col[i * 3 + 2] = barkCol[2];
      continue;
    }
    let t = (pos[i * 3 + 1] - ylo) / (yhi - ylo || 1);
    t = t * t * (3 - 2 * t);
    col[i * 3] = dk[0] + (lt[0] - dk[0]) * t;
    col[i * 3 + 1] = dk[1] + (lt[1] - dk[1]) * t;
    col[i * 3 + 2] = dk[2] + (lt[2] - dk[2]) * t;
  }
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  return g;
}

// ── the close-up models ──────────────────────────────────────────────────────
//
// Same silhouette, same height, same overall radius — everything below is built
// to the dimensions the far model already had, because a tree that changes size
// as you approach is worse than a tree with corners on it. What changes is what
// it is made of: a trunk that leans and bows, limbs that leave it and go
// somewhere, and a canopy that is three to five separate clumps rather than one
// surface of revolution. It is the gaps between the clumps that do the work,
// exactly as the gaps between the tongues do it on the ink.

/** Paint every vertex of a geometry one colour, ready to be merged. */
function vegPaint(g, col) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
  g.setAttribute('aVCol', new THREE.BufferAttribute(c, 3));
  return g;
}

/** Concatenate painted parts into one geometry, which is one prototype. */
function vegMerge(parts) {
  let nv = 0, ni = 0;
  for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const idx = new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nrm.set(g.attributes.normal.array, vo * 3);
    col.set(g.attributes.aVCol.array, vo * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += n; io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/**
 * A clump of foliage: a closed blob with its radius knocked about.
 *
 * The poles are left as very small rings rather than as points. A ring of
 * coincident vertices is a fan of zero-area triangles, and a zero-area triangle
 * has no normal — `computeVertexNormals` hands back a NaN and the top of every
 * tree comes out black. The material draws both sides, so the millimetre of
 * hole this leaves instead cannot be seen from anywhere.
 */
function vegClump(c, r, seg, rows, jag, rnd) {
  const ph = [];
  for (let i = 0; i < seg; i++) ph.push(rnd() * TAU);
  const rings = [];
  for (let k = 0; k <= rows; k++) {
    const v = k / rows;
    const th = (v - 0.5) * Math.PI * 0.97;
    const w = Math.cos(th), h = Math.sin(th);
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU;
      const n = 1 + jag * (0.62 * Math.sin(a * 3 + ph[i])
        + 0.38 * Math.sin(v * 5.3 + ph[(i + 3) % seg]));
      ring.push(new THREE.Vector3(
        c[0] + Math.cos(a) * r[0] * w * n,
        c[1] + r[1] * h,
        c[2] + Math.sin(a) * r[2] * w * n));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, caps: false });
}

/**
 * Foliage, lit as the soft mass it is meant to be rather than as the crumpled
 * tin it is actually made of.
 *
 * Two things, and both of them are about the normal rather than the shape.
 *
 * A clump is an ellipsoid with its radius knocked about by `jag`, and
 * `computeVertexNormals` faithfully reports every one of those dents. The
 * result is a canopy that sparkles: neighbouring facets catch the sun at
 * wildly different angles, the eye reads the high-frequency noise as *hard*,
 * and a tree ends up looking like screwed-up foil painted green. What a real
 * canopy does is the opposite — a hundred thousand leaves average out into one
 * broad soft gradient, dark underneath and bright on top, with the individual
 * detail far below the resolution of anything you can see from six metres.
 *
 * So the normal is thrown away and replaced by the one the *un-jagged*
 * ellipsoid would have had at that point, which is what makes each puff light
 * as a ball while its outline keeps every dent. That is the whole trick, and
 * it is the one from douges.dev — the shape stays noisy, the lighting does
 * not.
 *
 * The second half is the gradient. One flat green over a whole canopy has no
 * inside: paint the underside of the mass a good deal darker than the top and
 * the same geometry acquires depth, because now the clumps at the back of the
 * crown are darker than the ones in front of them and the crown has a volume
 * rather than a silhouette. It costs nothing — the vertex colours were already
 * there, they were simply all the same number.
 *
 * `span` is the height band the gradient runs over, in prototype units, and it
 * is the whole canopy's band and not the clump's: every clump has to be shaded
 * as part of one crown or they read as a bag of separate balls.
 */
function vegPuff(g, c, r, span, dark, lite, blend = 0.86) {
  const p = g.attributes.position.array;
  const nrm = g.attributes.normal.array;
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const ir = [1 / (r[0] * r[0]), 1 / (r[1] * r[1]), 1 / (r[2] * r[2])];
  const lo = span[0], hi = span[1];
  for (let i = 0; i < n; i++) {
    const dx = p[i * 3] - c[0], dy = p[i * 3 + 1] - c[1], dz = p[i * 3 + 2] - c[2];
    let ex = dx * ir[0], ey = dy * ir[1], ez = dz * ir[2];
    const el = Math.hypot(ex, ey, ez) || 1e-6;
    ex /= el; ey /= el; ez /= el;
    let nx = nrm[i * 3] * (1 - blend) + ex * blend;
    let ny = nrm[i * 3 + 1] * (1 - blend) + ey * blend;
    let nz = nrm[i * 3 + 2] * (1 - blend) + ez * blend;
    const nl = Math.hypot(nx, ny, nz) || 1e-6;
    nrm[i * 3] = nx / nl; nrm[i * 3 + 1] = ny / nl; nrm[i * 3 + 2] = nz / nl;
    let t = (p[i * 3 + 1] - lo) / (hi - lo || 1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    t = t * t * (3 - 2 * t);
    col[i * 3] = dark[0] + (lite[0] - dark[0]) * t;
    col[i * 3 + 1] = dark[1] + (lite[1] - dark[1]) * t;
    col[i * 3 + 2] = dark[2] + (lite[2] - dark[2]) * t;
  }
  g.attributes.normal.needsUpdate = true;
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  return g;
}

/** The two ends of a leaf colour's gradient: shaded underside, sunlit top. */
function vegShade(col, under = 0.60, over = 1.28) {
  return [col.map((v) => v * under), col.map((v) => Math.min(1, v * over))];
}


/** A limb: a tapered tube from one point to another, optionally bowed. */
function vegLimb(p0, p1, r0, r1, seg, rows = 2, bow = 0) {
  const dir = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const L = dir.length() || 1e-4;
  dir.multiplyScalar(1 / L);
  const ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(ref, dir).normalize();
  const w = new THREE.Vector3().crossVectors(dir, u);
  const rings = [];
  for (let k = 0; k <= rows; k++) {
    const t = k / rows;
    const r = r0 + (r1 - r0) * t;
    const c = new THREE.Vector3(p0[0], p0[1], p0[2]).addScaledVector(dir, L * t);
    c.addScaledVector(u, bow * Math.sin(Math.PI * t));
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      ring.push(new THREE.Vector3(
        c.x + u.x * ca + w.x * sa,
        c.y + u.y * ca + w.y * sa,
        c.z + u.z * ca + w.z * sa));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, caps: false });
}

/**
 * The four close-up species, in the same units and to the same dimensions as
 * the four far ones: a height of 1 and a radius that stays inside what
 * VEG_SIZE was written against.
 *
 * Seeded once and deterministically. These are four models, not four thousand
 * — the variation between individual trees is the instance's own scale, yaw
 * and tint, which is where it has always been.
 */
function vegNearPrototypes() {
  const rnd = mulberry32(0x7ee5);
  const bark = [0.30, 0.23, 0.17];
  const ring = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];

  // Aleppo pine. A bare trunk that leans, three limbs that leave it near the
  // top, and five flat clumps arranged into the umbrella the species is known
  // for — wide, thin, and with sky through it.
  //
  // The vertical radii look absurd next to the horizontal ones and they are
  // correct: an instance is scaled (w, h, w) and for a pine that is about
  // (1.9, 10, 1.9), so the prototype is squashed by five to one on the way into
  // the world. A clump built round comes out as a five-metre lozenge, which is
  // how the first version of this turned an umbrella pine into a lollipop.
  const pineParts = [
    vegPaint(vegLimb([0, 0, 0], [0.055, 0.62, 0.03], 0.058, 0.028, 8, 4, 0.030), bark),
  ];
  //
  // Eleven puffs and not five. Five is enough for the outline of an Aleppo
  // pine and nowhere near enough for its texture: what you are standing under
  // is a broken ceiling, and a hole needs an edge on both sides of it to read
  // as a hole. Same envelope, same height — 40 cm of radius on the prototype
  // either way — cut into more, smaller pieces.
  const pineC = [
    [0.000, 0.880, 0.000, 0.180, 0.080, 0.172],
    [0.215, 0.812, 0.060, 0.150, 0.068, 0.144],
    [-0.150, 0.828, 0.185, 0.146, 0.066, 0.140],
    [-0.196, 0.856, -0.140, 0.142, 0.064, 0.138],
    [0.088, 0.834, -0.215, 0.138, 0.062, 0.134],
    [0.130, 0.902, 0.150, 0.126, 0.058, 0.122],
    [-0.062, 0.914, -0.056, 0.118, 0.056, 0.114],
    [0.288, 0.784, -0.075, 0.112, 0.052, 0.108],
    [-0.276, 0.792, 0.048, 0.110, 0.050, 0.106],
    [0.040, 0.778, 0.276, 0.114, 0.052, 0.110],
    [-0.080, 0.770, -0.266, 0.108, 0.050, 0.104],
  ];
  const [pineDk, pineLt] = vegShade([0.14, 0.24, 0.13]);
  for (const [x, y, z, rx, ry, rz] of pineC) {
    // Every clump but the crown is hung off a limb, so the canopy is carried
    // rather than floating over a stick.
    if (Math.hypot(x, z) > 0.05) {
      pineParts.push(vegPaint(
        vegLimb([0.05, 0.58, 0.026], [x * 0.85, y - ry * 0.6, z * 0.85],
          0.020, 0.010, 5, 1), bark));
    }
    pineParts.push(vegPuff(vegClump([x, y, z], [rx, ry, rz], 8, 3, 0.32, rnd),
      [x, y, z], [rx, ry, rz], [0.70, 0.97], pineDk, pineLt));
  }
  const pine = vegMerge(pineParts);

  // Cypress. One spindle, but a wavering one — the axis drifts, the section is
  // twelve-sided and irregular, and four small clumps break the outline so it
  // is not a lathe standing on end.
  const cyPr = [[0.00, 0.045], [0.10, 0.072], [0.26, 0.098], [0.44, 0.106],
    [0.62, 0.101], [0.78, 0.086], [0.90, 0.060], [0.97, 0.030], [1.00, 0.008]];
  const cyRings = cyPr.map(([y, r]) => {
    const dx = 0.016 * Math.sin(y * 4.1), dz = 0.013 * Math.sin(y * 3.3 + 1.7);
    const out = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const rr = r * (1 + 0.13 * Math.sin(i * 2.11 + y * 7.7));
      const p = ring(a, rr, y);
      out.push(new THREE.Vector3(p[0] + dx, p[1], p[2] + dz));
    }
    return out;
  });
  const [cyDk, cyLt] = vegShade([0.09, 0.17, 0.11], 0.55, 1.40);
  // The spindle keeps its own normals — it is a cone and a cone's normal is
  // not radial — but it takes the gradient, which is what stops a cypress
  // reading as one flat black slot cut out of the sky.
  const cyParts = [vegPuff(loft(cyRings, { closed: true, caps: false }),
    [0, 0.5, 0], [0.106, 0.5, 0.106], [0.0, 1.0], cyDk, cyLt, 0.22)];
  for (let i = 0; i < 7; i++) {
    const y = 0.20 + i * 0.115;
    const a = rnd() * TAU;
    const c = ring(a, 0.058 + rnd() * 0.020, y);
    const r = [0.046, 0.062, 0.046];
    cyParts.push(vegPuff(vegClump(c, r, 7, 3, 0.34, rnd), c, r,
      [0.0, 1.0], cyDk, cyLt));
  }
  const cypress = vegMerge(cyParts);

  // Olive. The trunk is short and thick and splits, which is the whole reason
  // an olive reads as an olive from underneath, and the canopy is four lobes
  // with light between them.
  const olLimbs = [[0.26, 0.50, 0.30], [2.4, 0.56, -0.22], [4.4, 0.52, 0.10]];
  const olParts = [
    vegPaint(vegLimb([0, 0, 0], [0.012, 0.21, 0.008], 0.145, 0.105, 8, 2, 0.018), bark),
  ];
  for (const [a, y, lean] of olLimbs) {
    const tip = ring(a, 0.20 + lean * 0.10, y);
    olParts.push(vegPaint(
      vegLimb([0.012, 0.20, 0.008], tip, 0.060, 0.030, 6, 2, 0.030),
      [0.33, 0.29, 0.24]));
  }
  // An olive is squashed less on the way out — about 2.6 to 1 — so its lobes
  // are nearer to round than the pine's, and they overlap into one mass with
  // notches in it rather than into four separate balls.
  const olC = [
    [0.000, 0.680, 0.000, 0.235, 0.180, 0.225],
    [0.245, 0.560, 0.165, 0.190, 0.150, 0.182],
    [-0.225, 0.585, 0.180, 0.185, 0.146, 0.178],
    [-0.045, 0.605, -0.265, 0.180, 0.142, 0.172],
    [0.185, 0.700, -0.150, 0.165, 0.130, 0.158],
    [-0.180, 0.720, -0.030, 0.155, 0.124, 0.150],
    [0.055, 0.755, 0.185, 0.150, 0.120, 0.145],
  ];
  const [olDk, olLt] = vegShade([0.36, 0.41, 0.30], 0.64, 1.20);
  for (const [x, y, z, rx, ry, rz] of olC) {
    olParts.push(vegPuff(vegClump([x, y, z], [rx, ry, rz], 8, 3, 0.30, rnd),
      [x, y, z], [rx, ry, rz], [0.38, 0.90], olDk, olLt));
  }
  const olive = vegMerge(olParts);

  // Maquis. Four lobes and no trunk, which is what it is.
  //
  // Pushed apart and roughened harder than anything else here, because the
  // first version of it was three concentric blobs and what that reads as, on
  // open karst, at ten metres, is a boulder. Scrub is a tangle: the outline has
  // to be broken in several places or the eye files it as stone.
  const bushC = [
    [0.000, 0.420, 0.000, 0.300, 0.330, 0.285],
    [0.240, 0.280, 0.180, 0.235, 0.235, 0.225],
    [-0.215, 0.300, -0.165, 0.225, 0.250, 0.215],
    [0.055, 0.245, -0.260, 0.190, 0.210, 0.182],
    [-0.180, 0.260, 0.215, 0.185, 0.200, 0.178],
    [0.170, 0.500, -0.090, 0.175, 0.185, 0.168],
    [-0.095, 0.470, 0.155, 0.165, 0.175, 0.158],
  ];
  const [buDk, buLt] = vegShade([0.26, 0.30, 0.19], 0.62, 1.24);
  const bush = vegMerge(bushC.map(([x, y, z, rx, ry, rz]) =>
    vegPuff(vegClump([x, y, z], [rx, ry, rz], 8, 3, 0.44, rnd),
      [x, y, z], [rx, ry, rz], [0.02, 0.72], buDk, buLt)));

  return { pine, cypress, olive, bush };
}

function vegPrototypes() {
  const bark = [0.30, 0.23, 0.17];
  // A pentagonal cross-section is what made the hillside read as faceted from
  // low down. Eight sides is the point where a canopy stops having corners; a
  // pine goes from 60 triangles to 96, and since the whole landscape is four
  // instanced draws whatever the count, that is the entire cost.
  const S = 8, B = 6;

  // Aleppo pine: bare leaning trunk, flat irregular umbrella. The shape that
  // reads as Dalmatia from a thousand feet.
  const pine = vegGeo([
    vegRing(0.00, 0.055, S), vegRing(0.26, 0.040, S), vegRing(0.48, 0.034, S),
    vegRing(0.50, 0.34, S, 0.22), vegRing(0.62, 0.42, S, 0.21),
    vegRing(0.74, 0.45, S, 0.20), vegRing(0.86, 0.36, S, 0.19),
    vegRing(0.95, 0.22, S, 0.16), vegRing(1.00, 0.06, S),
  ], S, 3, bark, [0.14, 0.24, 0.13]);

  // Cypress: the dark exclamation mark in every churchyard and windbreak.
  const cypress = vegGeo([
    vegRing(0.00, 0.045, S), vegRing(0.10, 0.070, S),
    vegRing(0.32, 0.105, S, 0.10), vegRing(0.66, 0.095, S, 0.10),
    vegRing(0.90, 0.060, S), vegRing(1.00, 0.010, S),
  ], S, 1, bark, [0.09, 0.17, 0.11]);

  // Olive: short, thick, gnarled, silver-green and much harder to set alight.
  const olive = vegGeo([
    vegRing(0.00, 0.14, S), vegRing(0.20, 0.10, S),
    vegRing(0.30, 0.44, S, 0.24), vegRing(0.46, 0.53, S, 0.23),
    vegRing(0.62, 0.56, S, 0.22), vegRing(0.80, 0.47, S, 0.21),
    vegRing(0.92, 0.32, S, 0.19), vegRing(1.00, 0.10, S),
  ], S, 2, [0.33, 0.29, 0.24], [0.36, 0.41, 0.30]);

  // Maquis: no trunk worth modelling, and the reason the whole coast goes up.
  const bush = vegGeo([
    vegRing(0.00, 0.42, B), vegRing(0.38, 0.58, B, 0.28),
    vegRing(0.74, 0.46, B, 0.26), vegRing(1.00, 0.10, B),
  ], B, 0, bark, [0.26, 0.30, 0.19]);

  return { pine, cypress, olive, bush };
}

/** Height range and canopy width per species, in metres. */
const VEG_SIZE = {
  pine: [7, 13, 1.9],
  cypress: [7, 14, 1.0],
  olive: [3.4, 5.4, 1.7],
  bush: [0.9, 2.2, 1.5],
};

function buildTrees(scene, fire) {
  const protos = { far: vegPrototypes(), near: vegNearPrototypes() };
  const T = VEG.tile;

  const layers = {};
  for (const s of SPECIES) layers[s] = {};
  for (const lod of ['near', 'far']) for (const s of SPECIES) {
    const src = protos[lod][s];
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', src.attributes.position);
    geo.setAttribute('normal', src.attributes.normal);
    geo.setAttribute('aVCol', src.attributes.aVCol);
    geo.setIndex(src.index);
    // Placed entirely by instance attributes, so the prototype's bounds mean
    // nothing — culling is done per tile on the CPU.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    const cap = lod === 'near' ? VEG.nearMax : VEG.budget;
    const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aRot = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const aScale = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    for (const [n, a] of [['aInstPos', aPos], ['aInstRot', aRot],
      ['aInstScale', aScale], ['aInstColor', aColor]]) {
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(n, a);
    }

    const mat = solidMaterial(0xffffff, {
      instanced: true,
      spec: 0.03,
      specPower: 12,
      side: THREE.DoubleSide,
      // The prototype carries bark and leaf in its vertex colours; the per
      // instance colour is the individual's own tint and its charring.
      body: 'base *= vVCol;\n  n = gl_FrontFacing ? n : -n;',
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    layers[s][lod] = { geo, mesh, aPos, aRot, aScale, aColor, cap, count: 0 };
  }

  // ── tile generation ────────────────────────────────────────────────────────

  const tiles = new Map();
  const order = [];

  function makeTile(tx, tz) {
    // Deterministic from the tile coordinate: the same tree in the same place
    // every time you come back round.
    const rng = mulberry32((tx * 73856093 ^ tz * 19349663) >>> 0);
    const ox = tx * T, oz = tz * T;
    const out = { pine: [], cypress: [], olive: [], bush: [], n: 0 };

    // Nothing grows off the edge of the world. coverAt() and groundAt() both
    // clamp to the border texel, so a tile beyond the boundary inherits whatever
    // the last row of the map happened to say and plants a forest on the open
    // sea plane where no terrain is drawn at all. Raising the draw radius from
    // 1 500 m to 2 200 m is what made this visible from inside the world.
    const EDGE = CONFIG.world / 2 - 20;

    for (let i = 0; i < VEG.perTile; i++) {
      const x = ox + rng() * T, z = oz + rng() * T;
      if (Math.abs(x) > EDGE || Math.abs(z) > EDGE) continue;
      // Not on the airfield. The land-cover raster has never heard of Rokići —
      // it is a fictitious field dropped onto real scrub — so without this the
      // apron grows cypresses and there is a pine through the runway.
      if (typeof airfield !== 'undefined' && airfield && airfield.inField
        && airfield.inField(x, z, 25)) continue;
      // Nor on the Jadrija concrete, for the same reason and one more: that
      // strip is the one place a tree is at eye height rather than under you,
      // so a pine standing in the middle of a bathing terrace is not a detail
      // you fly over and forgive. The pines that belong there are placed by
      // hand, in their planters, with the rest of the resort.
      if (typeof jadrija !== 'undefined' && jadrija && jadrija.inField
        && jadrija.inField(x, z, 6)) continue;
      const c = coverAt(x, z);
      const table = GROWS[c];
      if (!table) continue;

      const r = rng();
      let acc = 0, pick = null;
      for (const s in table) { acc += table[s]; if (r < acc) { pick = s; break; } }
      if (!pick) continue;

      const y = groundAt(x, z);
      if (y < 0.4) continue;                       // the waterline, near enough

      // Nothing much stands on a cliff, and the karst is full of them.
      const nrm = normalAt(x, z, 12);
      if (nrm.y < 0.62 && pick !== 'bush') continue;
      if (nrm.y < 0.42) continue;

      const [lo, hi, wide] = VEG_SIZE[pick];
      const h = lo + rng() * (hi - lo);
      out[pick].push({
        x, y, z,
        h,
        w: h * wide * (0.78 + rng() * 0.44) / ((lo + hi) * 0.5),
        yaw: rng() * TAU,
        // Individual tint: some are drier, some greener, and a flat forest of
        // identical trees reads as a texture rather than as trees.
        tint: 0.80 + rng() * 0.34,
        warm: rng() * 0.16,
      });
      out.n++;
    }
    return out;
  }

  function tileAt(tx, tz) {
    const key = tx * 100000 + tz;
    let t = tiles.get(key);
    if (!t) {
      t = makeTile(tx, tz);
      tiles.set(key, t);
      order.push(key);
      while (order.length > VEG.maxTiles) tiles.delete(order.shift());
    }
    return t;
  }

  // ── repacking ──────────────────────────────────────────────────────────────

  let density = 1;
  let acc = 0, lastTx = 1e9, lastTz = 1e9, live = 0, closeUp = 0;
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);

  function repack(camPos) {
    // Two cursors a species now: which model an instance is written into is a
    // function of its distance, and the species' share of the budget is the sum
    // of the two — a tree close enough to be worth its polygons is still a tree.
    const cursor = {}, used = {};
    for (const s of SPECIES) { cursor[s] = { near: 0, far: 0 }; used[s] = 0; }
    const nearR2 = VEG.near * VEG.near;
    const cap = Math.floor(VEG.budget * clamp(density, 0, 2));
    const R = VEG.radius * clamp(0.4 + density * 0.6, 0.4, 1.3);
    const R2 = R * R;
    const t0 = Math.floor((camPos.x - R) / T), t1 = Math.floor((camPos.x + R) / T);
    const u0 = Math.floor((camPos.z - R) / T), u1 = Math.floor((camPos.z + R) / T);

    for (let tx = t0; tx <= t1; tx++) {
      for (let tz = u0; tz <= u1; tz++) {
        // Nearest point of the tile to the camera — a corner test would keep
        // whole tiles that only touch the circle at one vertex.
        const cx = clamp(camPos.x, tx * T, tx * T + T);
        const cz = clamp(camPos.z, tz * T, tz * T + T);
        if ((cx - camPos.x) ** 2 + (cz - camPos.z) ** 2 > R2) continue;

        const tile = tileAt(tx, tz);
        for (const s of SPECIES) {
          const list = tile[s];
          for (let i = 0; i < list.length; i++) {
            if (used[s] >= cap) break;
            const t = list[i];
            const dx = t.x - camPos.x, dz = t.z - camPos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 > R2) continue;
            // Close enough for the model with limbs on it, unless the ring is
            // already full — in which case it falls back to the far one rather
            // than being dropped, because a hole in the forest at 200 m is a
            // worse answer to a full buffer than a simpler tree is.
            const lod = d2 < nearR2 && cursor[s].near < layers[s].near.cap
              ? 'near' : 'far';
            const L = layers[s][lod];
            const c = cursor[s][lod];
            if (c >= L.cap) continue;
            // Shrink them into the ground over the last fifth of the radius.
            // A hard cutoff draws a visible ring of forest on the hillside and
            // the eye finds it immediately.
            const fade = 1 - sat((Math.sqrt(d2) - R * 0.80) / (R * 0.20));
            if (fade < 0.02) continue;

            // How far through burning this one is. The fire grid is the truth;
            // the trees just read it.
            const char = fire ? fire.charAt(t.x, t.z) : 0;
            const alight = fire ? fire.intensityAt(t.x, t.z) : 0;
            const shrink = (1 - 0.40 * char) * (0.35 + 0.65 * fade);

            L.aPos.array[c * 3] = t.x;
            L.aPos.array[c * 3 + 1] = t.y;
            L.aPos.array[c * 3 + 2] = t.z;

            _q.setFromAxisAngle(_up, t.yaw);
            L.aRot.array[c * 4] = _q.x; L.aRot.array[c * 4 + 1] = _q.y;
            L.aRot.array[c * 4 + 2] = _q.z; L.aRot.array[c * 4 + 3] = _q.w;

            L.aScale.array[c * 3] = t.w * shrink;
            L.aScale.array[c * 3 + 1] = t.h * shrink;
            L.aScale.array[c * 3 + 2] = t.w * shrink;

            // Green, through scorched, to a black stick. A tree that is
            // actually alight goes dark first — you see the flame, not the
            // leaves, and the flame is drawn by 38-flames.
            const burnt = Math.max(char, alight * 0.8);
            const g = t.tint * (1 - 0.88 * burnt);
            L.aColor.array[c * 3] = g * (1 + t.warm + 0.25 * burnt);
            L.aColor.array[c * 3 + 1] = g;
            L.aColor.array[c * 3 + 2] = g * (1 - t.warm * 0.5);

            cursor[s][lod] = c + 1;
            used[s]++;
          }
        }
      }
    }

    live = 0; closeUp = 0;
    for (const s of SPECIES) for (const lod of ['near', 'far']) {
      const L = layers[s][lod];
      L.count = cursor[s][lod];
      live += L.count;
      if (lod === 'near') closeUp += L.count;
      L.geo.instanceCount = L.count;
      L.aPos.needsUpdate = true;
      L.aRot.needsUpdate = true;
      L.aScale.needsUpdate = true;
      L.aColor.needsUpdate = true;
      L.mesh.visible = L.count > 0;
    }
  }

  function update(dt, camPos) {
    if (density <= 0.001) {
      for (const s of SPECIES) for (const lod of ['near', 'far']) {
        layers[s][lod].mesh.visible = false;
      }
      return;
    }
    acc += dt;
    const tx = Math.floor(camPos.x / T), tz = Math.floor(camPos.z / T);
    // Repack when the camera crosses a tile, and otherwise slowly — the only
    // thing that changes in between is how burnt everything is.
    if (tx !== lastTx || tz !== lastTz || acc > 0.4) {
      acc = 0; lastTx = tx; lastTz = tz;
      repack(camPos);
    }
  }

  return {
    update, layers,
    setDensity: (v) => { density = v; acc = 99; lastTx = 1e9; },
    getDensity: () => density,
    stats: () => ({ live, near: closeUp, tiles: tiles.size,
      tris: SPECIES.reduce((n, s) => n
        + layers[s].near.count * (protos.near[s].index.count / 3)
        + layers[s].far.count * (protos.far[s].index.count / 3), 0) | 0 }),
  };
}
