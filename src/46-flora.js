// -----------------------------------------------------------------------------
// Stone and small plants, at the distance you stand from them.
//
// Misha, 27 Sep 2026, after the trees in 1.534.0: *"look at how ugly the
// current rocks and the grass, etc, it would be nice to raise the number of
// polygons or whatever, to somehow make it look prettier to the eye"*. His
// frame was the verge behind the kabine where the anchor stands, and
// everything natural in it was the same failure: a limestone lump was seven
// flat facets and a fan (21 triangles, flat-shaded, one colour a face), so a
// row of them read as a string of igloos; the agave was eight flat triangles;
// the tussocks were domes of seven sides lying on the dust like hexagonal
// felt pads. Each of those was the right call when it was made — a silhouette
// at thirty metres — and each was never meant to be looked down at from 1.6 m,
// which is what the game is now played from.
//
// This file is the kit they are rebuilt from. It knows nothing about the
// shore frame: it takes world points and writes into whatever `propBuilder`
// (or scene) it is handed, so 43-jadrija.js keeps every placement exactly
// where it was and only the drawing changes. And it never draws from the
// resort's `rng` — rule 4 in 43-jadrija.js, the stream IS the layout — so all
// its variation is `floraHash` off a seed the caller already had.
//
// What is here:
//
//   floraRock      a limestone lump as a displaced icosphere with smooth
//                  normals, cut flats and karst hollows, AO baked per vertex
//                  and its foot sunk and dusted into the ground;
//   floraRockMat   the surface for them: pitting, grain and a bump, all
//                  faded by pixel footprint, and the dust's bounce;
//   floraTuft      a tuft of grass, blades that taper, arch and sway;
//   floraAgave     a rosette of thick channelled succulent blades;
//   floraFan       a fan palm's frond, pleated;
//   floraLeafy     a potted plant as a crown of real leaves;
//   floraMat       the surface the last four share, with the wind in it;
//   floraLitter    the wood floor round the eye: stones, cones and dry
//                  grass in cells, instanced, gone by thirty metres;
//   floraVerge     the August verge round the eye: seed-head grasses,
//                  bleached tussocks, wild fennel, thistles and immortelle,
//                  where the made ground stops, in two tiers.
// -----------------------------------------------------------------------------

/** A hash in [0, 1) off two numbers. Never the resort's `rng`. */
function floraHash(a, b) {
  const v = Math.sin(a * 12.9898 + b * 78.233 + a * b * 0.0137) * 43758.5453;
  return v - Math.floor(v);
}

/** Value noise in 3D, in [0, 1). For shapes, so it only has to be smooth. */
function floraNoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(ix, iy, iz), h(ix + 1, iy, iz), ux), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux), uy),
    l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux),
      l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux), uy), uz);
}

const _floraIco = [];
/**
 * A unit icosphere, `sub` times subdivided, with each vertex's neighbours.
 * 0 is 20 faces, 1 is 80, 2 is 320, 3 is 1 280. Cached, because a verge is
 * a hundred of these and they all start from the same ball.
 */
function floraIco(sub) {
  if (_floraIco[sub]) return _floraIco[sub];
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map((p) => { const L = Math.hypot(...p); return [p[0] / L, p[1] / L, p[2] / L]; });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
    [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const mid = new Map();
    const m = (a, b) => {
      const k = a < b ? a * 65536 + b : b * 65536 + a;
      let i = mid.get(k);
      if (i == null) {
        const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2];
        const L = Math.hypot(...p);
        i = v.length;
        v.push([p[0] / L, p[1] / L, p[2] / L]);
        mid.set(k, i);
      }
      return i;
    };
    const nf = [];
    for (const [a, b, c] of f) {
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = nf;
  }
  const nb = v.map(() => new Set());
  for (const [a, b, c] of f) {
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  _floraIco[sub] = { v, f, nb: nb.map((s) => [...s]) };
  return _floraIco[sub];
}

/**
 * One lump of limestone, into builder `b`, standing on the ground at
 * (x, gy, z) in world metres.
 *
 * What is lying about at Jadrija is broken karst: `1000150386` at arm's
 * length is a lump the size of a suitcase, white-grey, ROUNDED by weather
 * rather than angular, with a couple of flat broken faces on it, and
 * hollowed — dissolution pits the size of a fist and one right through. The
 * border stones in `_366` to `_369` are the same thing smaller and more
 * rounded still. The old lump had one of those properties, the flat faces,
 * and nothing else; drawn flat-shaded, seven of them were seven crystals.
 *
 * So, in order:
 *
 *   a sphere, knocked about by two octaves of noise at a third and a sixth
 *   of its size — a lump, not a ball;
 *   stretched a little along one horizontal axis, because nothing broken is
 *   round in plan;
 *   CUT by two to four planes, pushed back 92 % of the way to each, which
 *   leaves the broken faces flat and their arrises rounded over by the
 *   normals being shared across them;
 *   HOLLOWED at a few points on its surface, a smooth dimple each;
 *   and SQUASHED below its equator to a third, so the widest part of it is
 *   at the ground and not half way up. A buried sphere is a ball in sand; a
 *   rock is wider at the foot than anywhere else because that is where it
 *   stopped rolling. The equator is sunk 6 % of the height into the ground
 *   so it comes out of the dust rather than resting on it.
 *
 * Lit with its own vertex normals (smooth), and darkened three ways, all
 * baked into the vertex colour: in its hollows (the cavity, off each vertex
 * against the mean of its neighbours), at its foot (ground occlusion), and
 * under it (normals pointing down). The foot also takes the colour of the
 * dust it has been standing in, and the top a few lichen blotches.
 *
 * `o`: r (radius in plan), h (height out of the ground), yaw, seed, col,
 * sub (detail, by size if absent), flat (0 to 1, how broken), pits (0 to 1),
 * dust (the ground colour; `FLORA_DUST` if absent), ground (x, z) => y to
 * follow a slope, and tilt (radians, a little lean off plumb).
 */
const FLORA_DUST = [0.520, 0.405, 0.300];
const FLORA_LICHEN = [0.395, 0.392, 0.345];
function floraRock(b, x, gy, z, o) {
  const seed = o.seed || 0;
  const r = o.r, h = o.h;
  const size = Math.max(r, h);
  const sub = o.sub != null ? o.sub : size > 0.55 ? 3 : size > 0.13 ? 2 : 1;
  const ico = floraIco(sub);
  const H = (k) => floraHash(seed * 1.618 + 3.1, k);
  const yaw = o.yaw != null ? o.yaw : H(1) * TAU;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ax = 0.84 + 0.34 * H(2), az = 0.80 + 0.30 * H(3);
  const flat = o.flat != null ? o.flat : 0.6;
  const tilt = o.tilt != null ? o.tilt : (H(40) - 0.5) * 0.22;
  const tc = Math.cos(tilt), ts = Math.sin(tilt);
  // The cut planes: mostly across the shoulders and the top, where a lump
  // breaks, and never underneath, which is in the ground.
  const planes = [];
  const nPl = Math.round(1 + flat * (2.5 + 3 * H(4)));
  for (let k = 0; k < nPl; k++) {
    const el = -0.10 + 1.25 * H(10 + k), az2 = H(20 + k) * TAU;
    planes.push([Math.cos(el) * Math.cos(az2), Math.sin(el), Math.cos(el) * Math.sin(az2),
      0.52 + 0.28 * H(30 + k)]);
  }
  // The hollows: a centre on the sphere, an angular radius and a depth.
  const pits = [];
  const nPit = Math.round((o.pits != null ? o.pits : 0.5) * (1 + 4 * H(5)));
  for (let k = 0; k < nPit; k++) {
    const el = -0.05 + 1.1 * H(50 + k), az2 = H(60 + k) * TAU;
    pits.push([Math.cos(el) * Math.cos(az2), Math.sin(el), Math.cos(el) * Math.sin(az2),
      0.22 + 0.26 * H(70 + k), 0.07 + 0.12 * H(80 + k)]);
  }
  const no = seed * 7.31 + 11.7;
  // Local shape, then the world. `lp` is in metres about the foot's centre,
  // `hg` is height over the ground as a share of `h`.
  const N = ico.v.length;
  const lp = new Array(N), hgt = new Float32Array(N), wp = new Array(N);
  for (let i = 0; i < N; i++) {
    const d = ico.v[i];
    const q = 1 + 0.46 * (floraNoise3(d[0] * 1.3 + no, d[1] * 1.3, d[2] * 1.3) - 0.5)
      + 0.18 * (floraNoise3(d[0] * 2.9 + no, d[1] * 2.9 + 5.1, d[2] * 2.9) - 0.5)
      + 0.07 * (floraNoise3(d[0] * 6.1 + no, d[1] * 6.1 - 3.3, d[2] * 6.1) - 0.5);
    let p = [d[0] * q * ax, d[1] * q, d[2] * q * az];
    for (const [nx, ny, nz, off] of planes) {
      const s = p[0] * nx + p[1] * ny + p[2] * nz - off;
      if (s > 0) { p[0] -= nx * s * 0.96; p[1] -= ny * s * 0.96; p[2] -= nz * s * 0.96; }
    }
    for (const [px, py, pz, pr, pd] of pits) {
      const c = d[0] * px + d[1] * py + d[2] * pz;
      const ang = Math.acos(Math.max(-1, Math.min(1, c)));
      if (ang < pr) {
        const k = 1 - (ang / pr) * (ang / pr);
        const f = 1 - pd * k * k;
        p = [p[0] * f, p[1] * f, p[2] * f];
      }
    }
    let yl = p[1];
    if (yl < 0) yl *= 0.34;
    const ly = h * (yl * 1.06 - 0.06);
    // The lean, about the along axis of the stone.
    const lx = p[0] * r, lz = p[2] * r;
    const ly2 = ly * tc - lz * ts, lz2 = ly * ts + lz * tc;
    lp[i] = [lx, ly2, lz2];
    hgt[i] = ly2 / h;
  }
  // Smooth normals off the final shape, area weighted.
  const nrm = lp.map(() => [0, 0, 0]);
  for (const [a, bb, c] of ico.f) {
    const A = lp[a], B = lp[bb], C = lp[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, bb, c]) { nrm[k][0] += nx; nrm[k][1] += ny; nrm[k][2] += nz; }
  }
  // World positions and normals, and the colour.
  const tint = 0.93 + 0.13 * H(6), warm = (H(7) - 0.5) * 0.05;
  const base = o.col || [0.684, 0.676, 0.664];
  const dust = o.dust || FLORA_DUST;
  const cols = new Array(N), wn = new Array(N);
  let edge = 0;
  for (const [a, bb] of ico.f) edge += Math.hypot(lp[a][0] - lp[bb][0], lp[a][1] - lp[bb][1], lp[a][2] - lp[bb][2]);
  edge /= ico.f.length;
  for (let i = 0; i < N; i++) {
    const L = Math.hypot(...nrm[i]) || 1;
    const n = [nrm[i][0] / L, nrm[i][1] / L, nrm[i][2] / L];
    const P = lp[i];
    const wx = x + P[0] * cy - P[2] * sy, wz = z + P[0] * sy + P[2] * cy;
    const g = o.ground ? o.ground(wx, wz) : gy;
    wp[i] = [wx, g + P[1], wz];
    wn[i] = [n[0] * cy - n[2] * sy, n[1], n[0] * sy + n[2] * cy];
    // Cavity: how far the neighbours stand out past this vertex, along its
    // own normal, in edges. A hollow is positive.
    let mx = 0, my = 0, mz = 0;
    const nbs = ico.nb[i];
    for (const j of nbs) { mx += lp[j][0]; my += lp[j][1]; mz += lp[j][2]; }
    mx = mx / nbs.length - P[0]; my = my / nbs.length - P[1]; mz = mz / nbs.length - P[2];
    const cav = (mx * n[0] + my * n[1] + mz * n[2]) / (edge || 1);
    const ao = clamp(1 - cav * 2.6, 0.42, 1.08);
    const hg = hgt[i];
    const aoG = 0.42 + 0.58 * sat((hg + 0.02) / 0.30);
    const under = 0.78 + 0.22 * sat(n[1] * 0.5 + 0.7);
    const mot = 0.90 + 0.20 * floraNoise3(P[0] * 3.3 + no, P[1] * 3.3, P[2] * 3.3);
    // 0.88 and warmed: the colours handed in were matched against flat
    // facets with a strong bounce on them, and at those values a smooth lit
    // lump in the sun comes out as snow — which it did, the first time.
    let c = [base[0] * tint * (1.05 + warm) * mot * 0.88, base[1] * tint * mot * 0.88,
      base[2] * tint * (0.90 - warm) * mot * 0.88];
    // Weathered grey over a third of it, in broad patches: bare limestone
    // goes grey where the rain runs and stays white where it breaks.
    const wg = sat((floraNoise3(P[0] * 1.9 + 41 + no, P[1] * 2.4, P[2] * 1.9) - 0.48) / 0.18) * 0.45;
    c = [c[0] * (1 - wg * 0.30), c[1] * (1 - wg * 0.29), c[2] * (1 - wg * 0.25)];
    // Lichen: grey-green blotches where rain sits, on the top and shoulders.
    const li = sat((floraNoise3(P[0] * 4.2 + 17 + no, P[1] * 4.2, P[2] * 4.2) - 0.63) / 0.08)
      * sat((n[1] + 0.15) / 0.6) * (o.lichen != null ? o.lichen : 1);
    c = [c[0] + (FLORA_LICHEN[0] - c[0]) * li * 0.55, c[1] + (FLORA_LICHEN[1] - c[1]) * li * 0.55,
      c[2] + (FLORA_LICHEN[2] - c[2]) * li * 0.55];
    // And the dust it stands in, up to a quarter of its height.
    const du = (1 - sat(hg / 0.32)) * 0.70;
    c = [c[0] + (dust[0] - c[0]) * du, c[1] + (dust[1] - c[1]) * du, c[2] + (dust[2] - c[2]) * du];
    const k = ao * aoG * under;
    cols[i] = [c[0] * k, c[1] * k, c[2] * k];
  }
  let tris = 0;
  for (const [a, bb, c] of ico.f) {
    // Wholly under the ground: nobody will ever see it.
    if (hgt[a] < -0.03 && hgt[bb] < -0.03 && hgt[c] < -0.03) continue;
    b.smooth(wp[a], wp[bb], wp[c], wn[a], wn[bb], wn[c], cols[a], cols[bb], cols[c]);
    tris++;
  }
  return tris;
}

/**
 * The surface every `floraRock` is drawn with.
 *
 * The geometry gives a lump its shape and its hollows down to a hand's
 * breadth; this gives it the surface below that, which is what makes stone
 * read as stone at a metre and not as painted plaster. Three things, all in
 * world space so no two stones share a pattern, and all faded out by the
 * pixel footprint so none of them turns to glitter at thirty metres:
 *
 *   a BUMP off a small height field (two octaves of value noise at 5 and 14
 *   per metre), put into the normal from the field's own analytic gradient,
 *   so it needs no tangents and is continuous across every triangle;
 *   PITTING, the dissolution holes: a third octave at 11 per metre,
 *   thresholded to blobs a couple of centimetres across, a little dark in
 *   the middle and cut into the height field so they shade as holes;
 *   and GRAIN, a fleck of darker and lighter at the finest scale.
 *
 * Measured against the first cut, which took the bump off the screen
 * derivatives: that draws a dashed seam down every edge of the mesh (a
 * pixel quad straddling two faces sees the height jump), and on a smooth
 * lump the edges are exactly what must not show. The pits at 26 per metre
 * and 45 % dark read as black stitching; 11 and 22 % read as pits.
 */
function floraRockMat({ instanced = false, fade = 0 } = {}) {
  return solidMaterial(0xffffff, {
    spec: 0.05, specPower: 18, emissive: 0.10,
    // The bounce off the ground they stand in, which is orange dust: the
    // flanks and the underside of a white stone in the wood are lit by it
    // and not by the sky. Without it every shaded face took the sky's blue
    // and a row of lumps along the verge read as ice.
    lit: 'col += base * vec3(1.0, 0.80, 0.58) * (0.62 - 0.38 * n.y) * 0.20;',
    instanced,
    // Instanced (the loose stones of `floraLitter`): shrunk away by `fade`
    // metres from the eye, whole, about the instance's own origin.
    ...(instanced ? {
      uniforms: { uFloraFade: { value: fade } },
      vdecl: 'uniform vec3 uCamPos;\nuniform float uFloraFade;',
      vert: `
        if (uFloraFade > 0.0) {
          float dc = distance(aInstPos.xz, uCamPos.xz);
          p *= 1.0 - smoothstep(uFloraFade * 0.65, uFloraFade, dc);
        }`,
    } : {}),
    decl: /* glsl */ `
float frH(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
// Value noise and its gradient, as (value, d/dx, d/dy, d/dz).
vec4 frND(vec3 x){
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = frH(i), b = frH(i + vec3(1.0, 0.0, 0.0));
  float c = frH(i + vec3(0.0, 1.0, 0.0)), d = frH(i + vec3(1.0, 1.0, 0.0));
  float e = frH(i + vec3(0.0, 0.0, 1.0)), g = frH(i + vec3(1.0, 0.0, 1.0));
  float h = frH(i + vec3(0.0, 1.0, 1.0)), k = frH(i + vec3(1.0, 1.0, 1.0));
  float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d;
  float k5 = a - c - e + h, k6 = a - b - e + g, k7 = -a + b + c - d + e - g - h + k;
  return vec4(a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z
      + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
      k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
      k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}
float frN(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(frH(i), frH(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(frH(i + vec3(0.0, 1.0, 0.0)), frH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(frH(i + vec3(0.0, 0.0, 1.0)), frH(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(frH(i + vec3(0.0, 1.0, 1.0)), frH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`,
    body: /* glsl */ `
  base *= vVCol;
  {
    // Wrapped, because the resort is two kilometres from the origin and noise
    // at 26 per metre there has run out of mantissa (see h21 in 00-core.js).
    vec3 w = mod(vWorld, 256.0);
    float fp = length(fwidth(vWorld));
    float k1 = 1.0 - smoothstep(0.030, 0.110, fp);
    float k2 = 1.0 - smoothstep(0.008, 0.030, fp);
    vec4 nA = frND(w * 5.0);
    vec4 nB = frND(w * 14.0 + 7.1);
    vec4 nP = frND(w * 11.0 + 3.3);
    float pt = clamp((nP.x - 0.80) / 0.13, 0.0, 1.0);
    float pit = pt * pt * (3.0 - 2.0 * pt) * k2;
    // The bump, from the height field's own gradient: value noise with its
    // derivative (frND), so the normal is continuous across every triangle.
    // The first cut took it off the screen derivatives instead, which needs
    // nothing but draws a thin dashed seam along every edge of the mesh
    // where a pixel quad straddles two faces — and on a smooth lump the
    // edges are exactly what must not show.
    vec3 G = nA.yzw * (5.0 * 0.030 * k1) + nB.yzw * (14.0 * 0.012 * k1)
      - nP.yzw * (11.0 * 0.010 * 6.0 * pt * (1.0 - pt) / 0.13 * k2);
    n = normalize(n - (G - n * dot(G, n)));
    // Weathered broad patches, the pits, and the grain.
    base *= 0.93 + 0.14 * nA.x * k1;
    base *= 1.0 - 0.22 * pit;
    base *= 1.0 + (frN(w * 61.0) - 0.5) * 0.16 * k2;
  }`,
  });
}

/**
 * A `propBuilder` with one more channel: how far a vertex is free to move in
 * the wind, in metres of lever arm. Nought at a root, a stone or a pot; the
 * height up the blade at a grass tip. The vertex program reads it and nothing
 * else about the plant, so a whole verge of grass sways as one draw and a pot
 * standing in it does not.
 */
function floraBuilder() {
  const pos = [], norm = [], col = [], sway = [];
  const smooth = (a, b, c, na, nb, nc, ca, cb, cc, sa = 0, sb = 0, sc = 0) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    norm.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    sway.push(sa, sb, sc);
  };
  const tri = (a, b, c, cl) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    const n = [nx / L, ny / L, nz / L];
    smooth(a, b, c, n, n, n, cl, cl, cl);
  };
  const quad = (a, b, c, d, cl) => { tri(a, b, c, cl); tri(a, c, d, cl); };
  const geo = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
    return g;
  };
  return { smooth, tri, quad, geo, count: () => pos.length / 3 };
}

/**
 * The wind, as a displacement, shared by everything that bends in it: grass
 * here and the crowns in 45-trees.js. World space in, world metres out.
 *
 * Two motions, because that is what a verge in a breeze actually does. A
 * slow LEAN downwind that comes and goes with the gusts — the gust is a wave
 * of pressure travelling downwind across the ground, so its phase is
 * position along the wind minus time — and on top of it a quick FLUTTER,
 * each plant at its own rate, so no two tufts beat together. The lean is
 * most of the amplitude; the flutter is what keeps it alive between gusts.
 *
 * `lever` is metres of free length (aSway). The displacement goes as its
 * square, so a tip moves and a root does not, and a tall blade bends more
 * than a short one. Scaled by the wind: at 9 m/s, the default lebić, a
 * 0.3 m blade's tip travels about a centimetre and a half either way.
 */
const GLSL_FLORA_WIND = /* glsl */ `
vec3 floraWind(vec3 wp, float lever, float stiff){
  if (lever <= 0.0) return vec3(0.0);
  float ws = clamp(uWindSpeed, 0.0, 22.0);
  vec2 wd = normalize(uWind + vec2(1e-5));
  vec2 q = mod(wp.xz, 512.0);
  float along = dot(q, wd);
  float gust = 0.55 + 0.45 * sin(along * 0.11 - uTime * 0.9 * (0.5 + ws * 0.06))
    * sin(along * 0.037 + q.x * 0.013 - uTime * 0.31);
  float ph = fract(sin(dot(floor(q * 1.7), vec2(12.99, 78.23))) * 43758.5);
  float fl = sin(uTime * (3.1 + ph * 1.9) + ph * 6.28) * 0.35
    + sin(uTime * (5.3 + ph * 2.3) + ph * 17.0) * 0.15;
  float amp = (0.04 + 0.011 * ws) * lever * lever / stiff;
  vec2 d = wd * amp * (gust * 1.4 + fl);
  // Keep the blade its own length: what bends over comes down.
  return vec3(d.x, -0.5 * dot(d, d) / max(lever, 0.05), d.y);
}
`;

/**
 * The material for `floraBuilder` buffers: grass, agaves, potted plants.
 *
 * Not `FACE`: nothing drawn with this flips its normal on the back face. A
 * grass blade is given a normal leaned most of the way to straight up (see
 * `floraTuft`), which is what a tuft of a hundred blades averages to and is
 * right from either side; flipping it would put every blade seen from behind
 * in the dark. The agave's blades are closed solids and never show a back
 * face at all.
 *
 * `fade` is the distance the grass is gone by, shrunk into the ground rather
 * than cut, so it never pops. That is the whole of its LOD: a tuft at fifty
 * metres is three pixels, and the needle floor under it says the same thing
 * for nothing.
 */
function floraMat({ fade = 0, instanced = false } = {}) {
  return solidMaterial(0xffffff, {
    spec: 0.06, specPower: 16, emissive: 0.10,
    side: THREE.DoubleSide,
    instanced,
    uniforms: { uWind: U.uWind, uWindSpeed: U.uWindSpeed, uFloraFade: { value: fade } },
    vdecl: `attribute float aSway;
uniform vec2 uWind;
uniform float uWindSpeed;
uniform float uTime;
uniform vec3 uCamPos;
uniform float uFloraFade;
${GLSL_FLORA_WIND}`,
    // Built in world metres with the model matrix the identity, so p is
    // world space already.
    //
    // Instanced, p is the prototype's own frame, so the wind is worked out in
    // the world at the instance's place and turned back into that frame; and
    // the fade shrinks the whole tuft into its root.
    vert: instanced ? `
      {
        vec3 wp = aInstPos + p * aInstScale;
        vec3 d = floraWind(wp, aSway * aInstScale.y, 1.0);
        p += qrot(vec4(-aInstRot.xyz, aInstRot.w), d) / max(aInstScale, vec3(1e-3));
        if (uFloraFade > 0.0) {
          float dc = distance(aInstPos.xz, uCamPos.xz);
          p *= 1.0 - smoothstep(uFloraFade * 0.62, uFloraFade, dc);
        }
      }
    ` : `
      if (aSway > 0.0) {
        p += floraWind(p, aSway, 1.0);
        if (uFloraFade > 0.0) {
          float dc = distance(p.xz, uCamPos.xz);
          float k = 1.0 - smoothstep(uFloraFade * 0.62, uFloraFade, dc);
          p.y -= aSway * (1.0 - k) * 1.2;
        }
      }
    `,
    body: 'base *= vVCol;',
    // Light through a blade or a leaf, looking into the sun: the same term the
    // crowns have (FOLIAGE_LIT in 45-trees.js), a little weaker. Green things
    // only, which the vertex colour says: the pots and the spines are not.
    lit: `
    {
      float into = pow(max(dot(viewDir, uSunDir), 0.0), 4.0);
      col += base * uSunColor * uSunI * INV_PI * into * (0.3 + 0.7 * sh) * 0.55
        * step(0.01, vVCol.g - vVCol.r);
    }`,
  });
}

/**
 * A tuft of grass, into a `floraBuilder`, rooted at (x, gy, z).
 *
 * Blades and not a dome. The grove floor's tussocks were six-sided domes
 * lying on the dust and at standing height they are exactly what Misha
 * called them: felt pads. What `1000150344` and `_349` show is a clump of
 * narrow blades out of one crown, the inner ones near upright and the outer
 * ones arching out and over, green at the root going to straw at the tips
 * by late August, with dead ones among them.
 *
 * Each blade is a strip of three segments, tapering to a point and bending
 * further from the vertical the higher it goes: five triangles. The normal
 * given to it is its own face normal leaned 70 % of the way to straight up.
 * A blade is too thin to have a lit side and a dark side you could see, and
 * what a tuft does to light is what a rough horizontal surface does.
 *
 * `o`: r (spread of the crown), h (blade length), n (blades), seed, col (the
 * live green), dry (0 to 1, the share of straw), wide (blade half-width).
 */
const FLORA_STRAW = [0.600, 0.530, 0.360];
function floraTuft(fb, x, gy, z, o) {
  const seed = o.seed || 0;
  const H = (k) => floraHash(seed * 2.17 + 0.3, k);
  const n = o.n || 14;
  const col = o.col || [0.318, 0.352, 0.238];
  const dry = o.dry != null ? o.dry : 0.35;
  const wide = o.wide || 0.011;
  const r0 = gy - 0.03;
  for (let j = 0; j < n; j++) {
    const h1 = H(100 + j * 7), h2 = H(101 + j * 7), h3 = H(102 + j * 7), h4 = H(103 + j * 7);
    const h5 = H(104 + j * 7), h6 = H(105 + j * 7);
    const a0 = j * 2.3999632 + H(1) * TAU;
    const rb = o.r * 0.40 * Math.sqrt(h1);
    const bx = x + Math.cos(a0) * rb, bz = z + Math.sin(a0) * rb;
    const phi = a0 + (h2 - 0.5) * 1.1;
    const cph = Math.cos(phi), sph = Math.sin(phi);
    const outer = Math.sqrt(h1);
    const lean = 0.10 + 0.55 * outer + 0.35 * h3;
    const curl = 0.25 + 0.85 * h4;
    const L = o.h * (0.55 + 0.55 * h5) * (1.05 - 0.30 * outer);
    const w0 = wide * (0.7 + 0.6 * h6);
    const isDry = H(106 + j * 7) < dry;
    const tip = isDry ? FLORA_STRAW : [col[0] * 1.25 + 0.05, col[1] * 1.18 + 0.03, col[2] * 1.05];
    const root = isDry ? [0.330, 0.292, 0.205] : [col[0] * 0.55, col[1] * 0.62, col[2] * 0.52];
    const K = 3;
    const pts = [[bx, r0, bz]];
    let px = bx, py = r0, pz = bz;
    for (let k = 1; k <= K; k++) {
      const th = lean + curl * Math.pow(k / K, 1.6);
      const st = L / K;
      px += Math.sin(th) * cph * st; py += Math.cos(th) * st; pz += Math.sin(th) * sph * st;
      pts.push([px, py, pz]);
    }
    // Across the blade: horizontal and square to its heading, with a little
    // twist so the tuft is not all edge-on from one side.
    const tw = (h3 - 0.5) * 0.9;
    const sx = -sph * Math.cos(tw), sz = cph * Math.cos(tw), sy = Math.sin(tw) * 0.3;
    const V = [];
    for (let k = 0; k <= K; k++) {
      const u = k / K;
      const w = w0 * Math.pow(1 - u, 0.8);
      const P = pts[k];
      const A = pts[Math.min(k + 1, K)], B = pts[Math.max(k - 1, 0)];
      const tx = A[0] - B[0], ty = A[1] - B[1], tz = A[2] - B[2];
      // Face normal = tangent x across, then leaned up.
      let nx = ty * sz - tz * sy, ny = tz * sx - tx * sz, nz = tx * sy - ty * sx;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx = nx / nl * 0.3; ny = ny / nl * 0.3 + 0.7; nz = nz / nl * 0.3;
      const nl2 = Math.hypot(nx, ny, nz);
      const c = [root[0] + (tip[0] - root[0]) * u, root[1] + (tip[1] - root[1]) * u,
        root[2] + (tip[2] - root[2]) * u];
      const sw = Math.max(0, P[1] - r0) + 0.3 * Math.hypot(P[0] - bx, P[2] - bz);
      V.push({ l: [P[0] - sx * w, P[1] - sy * w, P[2] - sz * w],
        r: [P[0] + sx * w, P[1] + sy * w, P[2] + sz * w],
        n: [nx / nl2, ny / nl2, nz / nl2], c, sw });
    }
    for (let k = 0; k < K; k++) {
      const A = V[k], B = V[k + 1];
      if (k === K - 1) {
        fb.smooth(A.l, A.r, B.l, A.n, A.n, B.n, A.c, A.c, B.c, A.sw, A.sw, B.sw);
      } else {
        fb.smooth(A.l, A.r, B.r, A.n, A.n, B.n, A.c, A.c, B.c, A.sw, A.sw, B.sw);
        fb.smooth(A.l, B.r, B.l, A.n, B.n, B.n, A.c, B.c, B.c, A.sw, B.sw, B.sw);
      }
    }
  }
}

/**
 * An agave rosette, into a `floraBuilder`.
 *
 * `leaves` is a list of { a, reach, rise, mid, w }: the blade's heading
 * (world yaw), how far out its tip lands, how high it stands, the height of
 * the curve's control point and its widest half-width. That is what the two
 * old agaves already computed for themselves, so each caller keeps its own
 * numbers (and `agave` its seventeen draws of `rng`) and only the blade
 * changes.
 *
 * The blade was a flat triangle, or at best two flat quads in a shallow V.
 * `1000150363` is square on to one: every blade is a THICK, fleshy thing,
 * channelled on top — the upper face is a trough — and keeled underneath,
 * widest a fifth of the way up and running to a hard dark spine. The light
 * reads that as a pale rim along both edges and a darker trough between. So
 * it is lofted: six points round the section (the two edges, the bottom of
 * the trough, and three round the keel), six stations along a quadratic
 * from the crown to the tip, and the section is closed, so there is no back
 * face and no card. Sixty triangles a blade; eight points and seven
 * stations was ninety-nine and nobody could tell them apart at a metre.
 */
function floraAgave(fb, x, y, z, leaves, col, seed = 0) {
  const top = col;
  const bloom = [col[0] * 1.10 + 0.04, col[1] * 1.08 + 0.04, col[2] * 1.12 + 0.05];
  const under = [col[0] * 1.08 + 0.02, col[1] * 1.08 + 0.02, col[2] * 1.04 + 0.02];
  const SPINE = [0.180, 0.150, 0.105];
  // The section: [across, up] in half-widths and thicknesses, clockwise seen
  // down the blade from the crown.
  const SEC = [[-1.00, 0.30], [0.0, -0.10], [1.00, 0.30],
    [0.58, -0.58], [0.0, -0.95], [-0.58, -0.58]];
  // And each point's outward normal in the section's own plane, off its two
  // neighbours — flipped if it came out pointing into the section.
  const SN = SEC.map((p, i) => {
    const a = SEC[(i + SEC.length - 1) % SEC.length], c = SEC[(i + 1) % SEC.length];
    let nx = c[1] - a[1], ny = -(c[0] - a[0]);
    const L = Math.hypot(nx, ny) || 1;
    nx /= L; ny /= L;
    if (nx * p[0] + ny * (p[1] + 0.3) < 0) { nx = -nx; ny = -ny; }
    return [nx, ny];
  });
  const STN = 5;
  leaves.forEach((lf, li) => {
    const ca = Math.cos(lf.a), sa = Math.sin(lf.a);
    const P = (u) => {
      const q = 1 - u;
      const d = 2 * q * u * (lf.reach * 0.40) + u * u * lf.reach;
      const yy = 2 * q * u * lf.mid + u * u * lf.rise;
      return [x + ca * d, y + yy, z + sa * d];
    };
    const g = 0.90 + 0.20 * floraHash(seed * 3.3 + li, 5);
    const sx = -sa, sz = ca;
    const rings = [];
    for (let k = 0; k <= STN; k++) {
      const u = k / STN;
      const p = P(u), p2 = P(Math.min(1, u + 0.02)), p1 = P(Math.max(0, u - 0.02));
      let tx = p2[0] - p1[0], ty = p2[1] - p1[1], tz = p2[2] - p1[2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      // Across is horizontal and square to the heading; up is tangent x across.
      let nx = ty * sz, ny = tz * sx - tx * sz, nz = -ty * sx;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const w = lf.w * Math.pow(1 - u, 0.60) * (0.42 + 0.58 * Math.min(1, u * 4.5));
      const th = w * 0.42 + lf.w * 0.10 * (1 - u);
      // Darker in the crown, where the rosette shades itself.
      const ao = 0.62 + 0.38 * Math.min(1, u * 2.4);
      rings.push(SEC.map(([ax, ay], i) => {
        const pt = [p[0] + sx * ax * w + nx * ay * th, p[1] + ny * ay * th,
          p[2] + sz * ax * w + nz * ay * th];
        const [ex, ey] = SN[i];
        const mx = sx * ex + nx * ey, my = ny * ey, mz = sz * ex + nz * ey;
        const ml = Math.hypot(mx, my, mz) || 1;
        const cb = ay < -0.2 ? under : Math.abs(ax) > 0.9 ? bloom : top;
        const k2 = g * ao * (ax === 0 && ay > -0.5 ? 0.84 : 1);
        return { p: pt, n: [mx / ml, my / ml, mz / ml], c: [cb[0] * k2, cb[1] * k2, cb[2] * k2] };
      }));
    }
    for (let k = 0; k < STN; k++) {
      for (let i = 0; i < SEC.length; i++) {
        const j = (i + 1) % SEC.length;
        const A = rings[k][i], B = rings[k][j], C = rings[k + 1][j], D = rings[k + 1][i];
        fb.smooth(A.p, B.p, C.p, A.n, B.n, C.n, A.c, B.c, C.c);
        fb.smooth(A.p, C.p, D.p, A.n, C.n, D.n, A.c, C.c, D.c);
      }
    }
    // The spine: a dark point a twentieth of the blade long, on from the tip.
    const t0 = P(1), t1 = P(0.97);
    const dx = t0[0] - t1[0], dy = t0[1] - t1[1], dz = t0[2] - t1[2];
    const dl = Math.hypot(dx, dy, dz) || 1;
    const sl = Math.max(0.012, Math.hypot(lf.reach, lf.rise) * 0.05);
    const tip = [t0[0] + dx / dl * sl, t0[1] + dy / dl * sl, t0[2] + dz / dl * sl];
    const e = lf.w * 0.05;
    const b1 = [t0[0] - sa * e, t0[1], t0[2] + ca * e], b2 = [t0[0] + sa * e, t0[1], t0[2] - ca * e];
    const b3 = [t0[0], t0[1] - e, t0[2]];
    fb.tri(b1, b2, tip, SPINE); fb.tri(b2, b3, tip, SPINE); fb.tri(b3, b1, tip, SPINE);
  });
}

/**
 * A short rough stem, lofted with smooth normals: a palm's fibrous stump, a
 * potted plant's woody base. Ten sides, knocked about so it is not a pipe.
 */
function floraStump(fb, x, y0, z, r0, r1, h, col, seed = 0) {
  const SIDES = 10, RINGS = 3;
  const ring = (k) => {
    const u = k / RINGS, y = y0 + h * u, r = r0 + (r1 - r0) * u;
    const out = [];
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * TAU;
      const j = 1 + 0.16 * (floraHash(seed + k * 7.1, i) - 0.5);
      out.push({ p: [x + Math.cos(a) * r * j, y, z + Math.sin(a) * r * j],
        n: [Math.cos(a), (r0 - r1) / Math.max(h, 1e-3), Math.sin(a)],
        c: [col[0] * (0.80 + 0.35 * u) * j, col[1] * (0.80 + 0.35 * u) * j, col[2] * (0.80 + 0.35 * u) * j] });
    }
    return out;
  };
  const R = [];
  for (let k = 0; k <= RINGS; k++) R.push(ring(k));
  for (let k = 0; k < RINGS; k++) {
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      const A = R[k][i], B = R[k][j], C = R[k + 1][j], D = R[k + 1][i];
      fb.smooth(A.p, B.p, C.p, A.n, B.n, C.n, A.c, B.c, C.c);
      fb.smooth(A.p, C.p, D.p, A.n, C.n, D.n, A.c, C.c, D.c);
    }
  }
  // A cap, so it is not a hollow tube from above.
  const top = R[RINGS], cy = y0 + h;
  for (let i = 0; i < SIDES; i++) {
    const j = (i + 1) % SIDES;
    fb.tri(top[i].p, top[j].p, [x, cy + r1 * 0.3, z], [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8]);
  }
}

/**
 * One frond of a fan palm, into a `floraBuilder`: a petiole from `base` to
 * `hub` (world points) and a pleated fan on the end of it.
 *
 * The old frond was four flat triangles from the hub — a paper disc on a
 * stick, and Misha's "potted plants whose leaves are big flat green
 * polygons" are these, the two Chamaerops in the anchor's bed seen over the
 * wall. What makes a fan palm is the PLEAT. `1000150353`: the blade is
 * folded like a paper fan into a couple of dozen stiff segments, each one a
 * narrow V, radiating from the hub over about two hundred degrees; they are
 * joined for the inner half and split apart for the outer, and the tips of
 * the split parts droop. At ten metres the pleat is what makes it read as a
 * palm rather than as a plate — the segments light alternately, one face to
 * the sun and the next away from it.
 *
 * So: nineteen segments, each a folded strip of three stations, alternate
 * folds up and down, spread over 200 degrees in the plane square to the
 * stalk, bending down under their own weight past half way. About 300
 * triangles a frond. They sway a little: the lever is the distance out from
 * the hub, so the tips flutter and the hub does not.
 */
function floraFan(fb, base, hub, R, col, stalkCol, seed = 0) {
  const H = (k) => floraHash(seed * 1.31 + 0.7, k);
  let dx = hub[0] - base[0], dy = hub[1] - base[1], dz = hub[2] - base[2];
  const dl = Math.hypot(dx, dy, dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  // Across: horizontal and square to the stalk.
  let sx = -dz, sz = dx;
  const sl = Math.hypot(sx, sz) || 1;
  sx /= sl; sz /= sl;
  // The fan's forward direction: on from the stalk, levelled towards the
  // horizontal (a frond holds its fan flatter than its stalk), and its face
  // normal, up.
  let fx = dx, fy = dy * 0.45, fz = dz;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  let nx = fy * sz, ny = fz * sx - fx * sz, nz = -fy * sx;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  // The petiole: a thin four-sided stalk, flattened.
  const pw = 0.016;
  const stalk = (u) => [base[0] + (hub[0] - base[0]) * u, base[1] + (hub[1] - base[1]) * u,
    base[2] + (hub[2] - base[2]) * u];
  for (let k = 0; k < 3; k++) {
    const a = stalk(k / 3), b2 = stalk((k + 1) / 3);
    const w0 = pw * (1.3 - 0.4 * k / 3), w1 = pw * (1.3 - 0.4 * (k + 1) / 3);
    for (const sd of [1, -1]) {
      const A = [a[0] + sx * w0 * sd, a[1], a[2] + sz * w0 * sd];
      const B = [b2[0] + sx * w1 * sd, b2[1], b2[2] + sz * w1 * sd];
      const C = [b2[0] + nx * w1 * 0.6, b2[1] + ny * w1 * 0.6, b2[2] + nz * w1 * 0.6];
      const D = [a[0] + nx * w0 * 0.6, a[1] + ny * w0 * 0.6, a[2] + nz * w0 * 0.6];
      const n2 = [sx * sd * 0.7 + nx * 0.7, ny * 0.7, sz * sd * 0.7 + nz * 0.7];
      fb.smooth(A, B, C, n2, n2, n2, stalkCol, stalkCol, stalkCol);
      fb.smooth(A, C, D, n2, n2, n2, stalkCol, stalkCol, stalkCol);
    }
  }
  const SEG = 19, SPREAD = 3.5;
  const dark = [col[0] * 0.70, col[1] * 0.74, col[2] * 0.70];
  for (let i = 0; i < SEG; i++) {
    const b0 = ((i + 0.5) / SEG - 0.5) * SPREAD;
    const cb = Math.cos(b0), sb = Math.sin(b0);
    // Radial direction in the fan's plane, and its side in the same plane.
    const rx = fx * cb + sx * sb, ry = fy * cb, rz = fz * cb + sz * sb;
    const qx = -fx * sb + sx * cb, qy = -fy * sb, qz = -fz * sb + sz * cb;
    const L = R * (0.82 + 0.18 * Math.cos(b0 * 0.8)) * (0.92 + 0.12 * H(i));
    // Half the angular pitch at the hub, as a width at radius r.
    const half = (SPREAD / SEG) * 0.5;
    const fold = i % 2 ? 1 : -1;
    const g = 0.92 + 0.16 * H(40 + i);
    const cU = fold > 0 ? [col[0] * g, col[1] * g, col[2] * g] : [dark[0] * g, dark[1] * g, dark[2] * g];
    const ST = [0.08, 0.50, 0.78, 1.0];
    const P = ST.map((u) => {
      const r = L * u;
      // Droop past half way, more at the sides of the fan than the middle.
      const dr = L * 0.30 * Math.max(0, u - 0.45) ** 2 * (1 + 1.2 * Math.abs(sb));
      // Split segments narrow to a point; joined ones touch their neighbours.
      const w = u < 0.55 ? r * half * 0.98 : r * half * 0.98 * (1 - (u - 0.55) / 0.45) + 0.004;
      const h = w * 0.55 * fold;
      const cx = hub[0] + rx * r, cy2 = hub[1] + ry * r - dr, cz = hub[2] + rz * r;
      return {
        m: [cx + nx * h, cy2 + ny * h, cz + nz * h],
        l: [cx - qx * w, cy2 - qy * w, cz - qz * w],
        r: [cx + qx * w, cy2 + qy * w, cz + qz * w],
        sw: r * 0.5,
      };
    });
    // The two faces of the fold: their normals lean to either side of the
    // fan normal, so adjacent faces take the light differently.
    const tilt = 0.55;
    const nL = [nx - qx * tilt * fold, ny - qy * tilt * fold, nz - qz * tilt * fold];
    const nR = [nx + qx * tilt * fold, ny + qy * tilt * fold, nz + qz * tilt * fold];
    const hubP = [hub[0] + rx * L * 0.02, hub[1] + ry * L * 0.02, hub[2] + rz * L * 0.02];
    fb.smooth(hubP, P[0].l, P[0].m, nL, nL, nL, dark, dark, cU, 0, 0, 0);
    fb.smooth(hubP, P[0].m, P[0].r, nR, nR, nR, dark, cU, dark, 0, 0, 0);
    for (let k = 0; k < ST.length - 1; k++) {
      const A = P[k], B = P[k + 1];
      const cA = k === 0 ? dark : cU;
      fb.smooth(A.l, B.l, B.m, nL, nL, nL, cA, cU, cU, A.sw, B.sw, B.sw);
      fb.smooth(A.l, B.m, A.m, nL, nL, nL, cA, cU, cU, A.sw, B.sw, A.sw);
      fb.smooth(A.m, B.m, B.r, nR, nR, nR, cU, cU, cU, A.sw, B.sw, B.sw);
      fb.smooth(A.m, B.r, A.r, nR, nR, nR, cU, cU, cA, A.sw, B.sw, A.sw);
    }
  }
}

/**
 * A leafy plant in a pot or a planter, into a `floraBuilder`: a crown of
 * real leaves round a dark core, standing on (x, y, z).
 *
 * Every potted plant at Jadrija was a `dome` of one green, or fifteen
 * stubby triangles — "a bowling ball on a stick", in the words of the note
 * over the terrace tubs, and a bowling ball is what it stayed. What a
 * clipped evergreen in a tub actually is, at the distance you pass one, is
 * a mass with an outline made of LEAVES: each one a small tilted plate with
 * a midrib fold in it, the sun catching some and not others, the inside of
 * the crown dark between them.
 *
 * So: a dark core (a smooth ellipsoid a third smaller, so the crown is
 * never see-through), and on the surface of the crown `n` leaves spiralled
 * by the golden angle over the upper five sixths of it, each lying along the
 * surface at its own bearing, folded along its midrib, eight
 * triangles. The shading normal is the leaf's own blended half way to the
 * crown's (the `puff` trick again), so the whole reads as one lit mass and
 * each leaf still has an edge. They flutter a little: a leaf's lever is its
 * own length, not the plant's.
 *
 * `o`: r (crown radius), h (crown height), n (leaves), leaf (leaf length),
 * col, seed.
 */
function floraLeafy(fb, x, y, z, o) {
  const seed = o.seed || 0;
  const H = (k) => floraHash(seed * 1.73 + 0.9, k);
  const r = o.r, hh = o.h;
  const n = o.n || 60;
  const len = o.leaf || r * 0.45;
  const col = o.col || [0.180, 0.330, 0.165];
  const cy = y + hh * 0.52, ry = hh * 0.50;
  // The core.
  {
    const SIDES = 8, ROWS = 4, kr = 0.72;
    const g = [];
    for (let k = 0; k <= ROWS; k++) {
      const th = (k / ROWS - 0.5) * Math.PI;
      const row = [];
      for (let i = 0; i < SIDES; i++) {
        const a = (i / SIDES) * TAU;
        const nx = Math.cos(th) * Math.cos(a), ny = Math.sin(th), nz = Math.cos(th) * Math.sin(a);
        const d = 0.36 + 0.30 * (ny * 0.5 + 0.5);
        row.push({ p: [x + nx * r * kr, cy + ny * ry * kr, z + nz * r * kr], n: [nx, ny, nz],
          c: [col[0] * d, col[1] * d, col[2] * d] });
      }
      g.push(row);
    }
    for (let k = 0; k < ROWS; k++) {
      for (let i = 0; i < SIDES; i++) {
        const j = (i + 1) % SIDES;
        const A = g[k][i], B = g[k][j], C = g[k + 1][j], D = g[k + 1][i];
        fb.smooth(A.p, B.p, C.p, A.n, B.n, C.n, A.c, B.c, C.c);
        fb.smooth(A.p, C.p, D.p, A.n, C.n, D.n, A.c, C.c, D.c);
      }
    }
  }
  for (let j = 0; j < n; j++) {
    const v = 1 - ((j + 0.5) / n) * 1.72;
    const ph = j * 2.3999632 + H(1) * TAU;
    const sv = Math.sqrt(Math.max(0, 1 - v * v));
    const d = [sv * Math.cos(ph), v, sv * Math.sin(ph)];
    const rr = 0.80 + 0.28 * H(10 + j);
    const A = [x + d[0] * r * rr, cy + d[1] * ry * rr, z + d[2] * r * rr];
    // The leaf's axis: ALONG the crown's surface, at a random bearing round
    // the point it grows from, and lifted only a little off it — so the
    // leaves lie over one another like scales and the crown is a mass. The
    // first cut pointed them out from the stem, and a tub of those from the
    // side was a hedgehog.
    let t1 = [d[2], 0, -d[0]];
    let ll = Math.hypot(...t1);
    t1 = ll > 1e-4 ? [t1[0] / ll, 0, t1[2] / ll] : [1, 0, 0];
    const t2 = [d[1] * t1[2], d[2] * t1[0] - d[0] * t1[2], -d[1] * t1[0]];
    const th = H(20 + j) * TAU;
    let L = [t1[0] * Math.cos(th) + t2[0] * Math.sin(th) + d[0] * 0.45,
      t2[1] * Math.sin(th) + d[1] * 0.45 - 0.12,
      t1[2] * Math.cos(th) + t2[2] * Math.sin(th) + d[2] * 0.45];
    ll = Math.hypot(...L) || 1;
    L = [L[0] / ll, L[1] / ll, L[2] / ll];
    // Face normal: the outward direction, squared off against the axis.
    const dd = d[0] * L[0] + d[1] * L[1] + d[2] * L[2];
    let N = [d[0] - L[0] * dd, d[1] - L[1] * dd + 0.25, d[2] - L[2] * dd];
    ll = Math.hypot(...N) || 1;
    N = [N[0] / ll, N[1] / ll, N[2] / ll];
    const S = [L[1] * N[2] - L[2] * N[1], L[2] * N[0] - L[0] * N[2], L[0] * N[1] - L[1] * N[0]];
    const Ll = len * (0.75 + 0.45 * H(30 + j)), Wl = Ll * (0.42 + 0.14 * H(40 + j));
    // Lower in the crown, and further in, is darker.
    const depth = 0.74 + 0.36 * sat(v * 0.6 + 0.5) * (0.8 + 0.2 * rr);
    const g = (0.88 + 0.24 * H(50 + j)) * depth;
    const c0 = [col[0] * g * 0.85, col[1] * g * 0.85, col[2] * g * 0.85];
    const c1 = [col[0] * g * 1.08 + 0.02, col[1] * g * 1.06 + 0.02, col[2] * g];
    const ST = [0, 0.38, 0.72, 1];
    const WD = [0, 1, 0.78, 0];
    const P = ST.map((u, k) => {
      const droop = Ll * 0.16 * u * u;
      const c = [A[0] + L[0] * Ll * u - N[0] * droop, A[1] + L[1] * Ll * u - N[1] * droop,
        A[2] + L[2] * Ll * u - N[2] * droop];
      const w = Wl * 0.5 * WD[k];
      const f = w * 0.30;
      return { l: [c[0] - S[0] * w, c[1] - S[1] * w, c[2] - S[2] * w],
        m: [c[0] + N[0] * f, c[1] + N[1] * f, c[2] + N[2] * f],
        r: [c[0] + S[0] * w, c[1] + S[1] * w, c[2] + S[2] * w],
        c: u < 0.5 ? c0 : c1, sw: 0.05 + Ll * u };
    });
    const nm = (sgn) => {
      const q = [N[0] * 0.5 + d[0] * 0.5 + S[0] * 0.18 * sgn, N[1] * 0.5 + d[1] * 0.5 + 0.1,
        N[2] * 0.5 + d[2] * 0.5 + S[2] * 0.18 * sgn];
      const ql = Math.hypot(...q) || 1;
      return [q[0] / ql, q[1] / ql, q[2] / ql];
    };
    const nL = nm(-1), nR = nm(1);
    for (let k = 0; k < 3; k++) {
      const a = P[k], b = P[k + 1];
      // The first station and the last are points, so the first span is
      // two triangles out of it, the last two triangles into the tip, and
      // only the middle one is a pair of quads.
      if (k < 2) {
        fb.smooth(a.l, b.l, b.m, nL, nL, nL, a.c, b.c, b.c, a.sw, b.sw, b.sw);
        fb.smooth(a.m, b.m, b.r, nR, nR, nR, a.c, b.c, b.c, a.sw, b.sw, b.sw);
      }
      if (k > 0) {
        fb.smooth(a.l, b.m, a.m, nL, nL, nL, a.c, b.c, a.c, a.sw, b.sw, a.sw);
        fb.smooth(a.m, b.r, a.r, nR, nR, nR, a.c, b.c, a.c, a.sw, b.sw, a.sw);
      }
    }
  }
}

/**
 * The floor of the wood, round wherever you are standing.
 *
 * The pine wood behind the kabine is fifty thousand square metres of needle
 * floor, and from standing height it was a flat orange plane with trunks in
 * it: the terrain shader lays the right colour on it and nothing can stand
 * on a colour. `1000150344` and `_345` are that floor at your feet — dust
 * and fallen needles, and ON it: pale stones from pea-size to a fist, dead
 * cones, and grass in tufts, dry and bleached by August, thicker in some
 * patches than others and none at all in the next.
 *
 * Placing that over the whole wood is millions of things, so it is only
 * ever placed round the eye. The ground is cut into cells of `cell` metres;
 * each cell's contents are a pure function of the cell (a hash, and
 * `accept` asking the resort whether that point is open ground and how high
 * it is), cached, and the ones within `radius` are written into three
 * instanced draws — tufts, stones, cones — whenever you cross a cell. The
 * outer third of the radius shrinks everything away, so walking never
 * shows a ring of things appearing, and past it the needle floor alone
 * carries the ground as it always did.
 *
 * Patchy on purpose: a second noise at about eleven metres decides how
 * much grass a cell is allowed, so it comes in drifts with bare floor
 * between (see "Nothing beats a wrong pattern" — an even scatter of tufts
 * reads as a lawn that was planted).
 *
 * `accept(x, z)` returns the ground height there, or null where nothing
 * may go: the concrete, a road, a lane, a building, a car, the sea.
 */
function floraLitter(scene, { accept, cell = 1.25, radius = 30, maxTufts = 2400,
  maxStones = 1400, maxCones = 700 } = {}) {
  // The prototypes, all built about their own origin.
  const tp = floraBuilder();
  floraTuft(tp, 0, 0.03, 0, { r: 0.24, h: 0.32, n: 30, seed: 7.3, col: [0.46, 0.43, 0.30],
    dry: 0.72, wide: 0.0075 });
  const sp = propBuilder();
  floraRock(sp, 0, 0, 0, { r: 0.075, h: 0.045, seed: 3.1, sub: 1, pits: 0, flat: 0.8,
    col: [0.66, 0.64, 0.60] });
  floraRock(sp, 0.11, 0, 0.05, { r: 0.040, h: 0.028, seed: 5.7, sub: 1, pits: 0, flat: 1,
    col: [0.70, 0.68, 0.64] });
  floraRock(sp, -0.05, 0, 0.10, { r: 0.028, h: 0.020, seed: 8.9, sub: 0, pits: 0, flat: 1,
    col: [0.62, 0.60, 0.57] });
  const cp = propBuilder();
  // A fallen Aleppo cone: an ovoid 8 cm long lying on its side, scaled in
  // the rock surface's pits, which on something this brown read as scales.
  floraRock(cp, 0, 0, 0, { r: 0.028, h: 0.034, seed: 1.9, sub: 1, pits: 0, flat: 0,
    col: [0.40, 0.29, 0.19], dust: [0.40, 0.29, 0.19], lichen: 0, tilt: 1.35 });

  const mk = (geoSrc, mat, cap) => {
    const src = geoSrc.geo();
    const geo = new THREE.InstancedBufferGeometry();
    for (const k of Object.keys(src.attributes)) geo.setAttribute(k, src.attributes[k]);
    const A = {
      pos: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      rot: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
      scale: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      col: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    };
    for (const [n, a] of [['aInstPos', A.pos], ['aInstRot', A.rot], ['aInstScale', A.scale],
      ['aInstColor', A.col]]) {
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(n, a);
    }
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.name = 'flora:litter';
    scene.add(mesh);
    return { mesh, geo, A, cap, n: 0 };
  };
  const L = {
    tuft: mk(tp, floraMat({ fade: radius, instanced: true }), maxTufts),
    stone: mk(sp, floraRockMat({ instanced: true, fade: radius }), maxStones),
    cone: mk(cp, floraRockMat({ instanced: true, fade: radius * 0.7 }), maxCones),
  };

  const cache = new Map();
  const itemsOf = (i, k) => {
    const key = (i + 40000) * 80000 + (k + 40000);
    let it = cache.get(key);
    if (it !== undefined) return it;
    it = [];
    const cx = (i + 0.5) * cell, cz = (k + 0.5) * cell;
    const seed = i * 7.13 + k * 3.71;
    // How much grass this patch of floor carries: none over about half of
    // it, a drift over the rest.
    const drift = sat((floraNoise3(cx * 0.09, 0.5, cz * 0.09) - 0.42) / 0.30);
    const fine = floraNoise3(cx * 0.45, 3.5, cz * 0.45);
    const tries = [
      ['tuft', drift * (0.6 + fine)],
      ['tuft', 0.8 * drift * fine],
      ['tuft', 0.6 * drift * drift],
      ['tuft', 0.05],
      ['stone', 0.16],
      ['stone', 0.07 * (1 - drift)],
      ['cone', 0.10],
    ];
    tries.forEach(([kind, pr], j) => {
      if (floraHash(seed, j * 11 + 1) >= pr) return;
      const x = cx + (floraHash(seed, j * 11 + 2) - 0.5) * cell;
      const z = cz + (floraHash(seed, j * 11 + 3) - 0.5) * cell;
      const y = accept(x, z);
      if (y == null) return;
      const h = floraHash(seed, j * 11 + 4), g = floraHash(seed, j * 11 + 5);
      it.push({ kind, x, y, z, yaw: floraHash(seed, j * 11 + 6) * TAU,
        sc: kind === 'tuft' ? (0.55 + 0.75 * h) * (0.8 + 0.5 * drift)
          : kind === 'stone' ? 0.6 + 1.3 * h * h : 0.8 + 0.4 * h,
        g, drift });
    });
    if (cache.size > 90000) cache.clear();
    cache.set(key, it);
    return it;
  };

  let ci = null, ck = null, lastMs = 0, worstMs = 0, builds = 0;
  const R = Math.ceil(radius / cell);
  function rebuild() {
    const t0 = performance.now();
    for (const l of Object.values(L)) l.n = 0;
    for (let di = -R; di <= R; di++) {
      for (let dk = -R; dk <= R; dk++) {
        if (di * di + dk * dk > R * R) continue;
        for (const o of itemsOf(ci + di, ck + dk)) {
          const l = L[o.kind];
          if (l.n >= l.cap) continue;
          const n = l.n++;
          l.A.pos.array.set([o.x, o.y, o.z], n * 3);
          const hy = o.yaw * 0.5;
          l.A.rot.array.set([0, Math.sin(hy), 0, Math.cos(hy)], n * 4);
          if (o.kind === 'tuft') {
            // Wider than tall in a dry drift, taller in the green.
            l.A.scale.array.set([o.sc * (1.1 - 0.2 * o.drift), o.sc * (0.8 + 0.5 * o.g),
              o.sc * (1.1 - 0.2 * o.drift)], n * 3);
            // From straw to a grey green, more of the green in a thick drift.
            const gr = sat(o.g * 0.8 + o.drift * 0.5 - 0.35);
            l.A.col.array.set([1.02 - 0.22 * gr, 1.0 - 0.02 * gr, 0.96 - 0.10 * gr], n * 3);
          } else {
            l.A.scale.array.set([o.sc, o.sc * (0.8 + 0.4 * o.g), o.sc * (0.9 + 0.2 * o.g)], n * 3);
            const v = 0.86 + 0.26 * o.g;
            l.A.col.array.set([v, v, v * (0.98 + 0.04 * o.drift)], n * 3);
          }
        }
      }
    }
    for (const l of Object.values(L)) {
      l.geo.instanceCount = l.n;
      for (const a of Object.values(l.A)) {
        a.needsUpdate = true;
        a.clearUpdateRanges();
        a.addUpdateRange(0, l.n * a.itemSize);
      }
    }
    lastMs = performance.now() - t0;
    worstMs = Math.max(worstMs, lastMs);
    builds++;
  }

  return {
    meshes: () => Object.values(L).map((l) => l.mesh),
    /** Call once a frame with the eye. `ground` is the height under it. */
    update(cam, ground) {
      // From the air there is nothing here to see, and nothing to spend on.
      const on = cam.y - ground < 40;
      for (const l of Object.values(L)) l.mesh.visible = on;
      if (!on) return;
      const i = Math.floor(cam.x / cell), k = Math.floor(cam.z / cell);
      if (i === ci && k === ck) return;
      ci = i; ck = k;
      rebuild();
    },
    stats: () => ({ tufts: L.tuft.n, stones: L.stone.n, cones: L.cone.n, cells: cache.size,
      builds, lastMs: +lastMs.toFixed(2), worstMs: +worstMs.toFixed(2) }),
  };
}

// -----------------------------------------------------------------------------
// The August verge.
//
// Misha, 29 Sep 2026, after looking at FABOTANIC's "Wild Field" mix: *"sure
// let's try that to see if it would spruce things up"*. What was borrowed is
// the IDEA of a mix — a handful of species that belong together, scattered
// together — and nothing else: every blade below is this file's own code.
//
// The mix is the one a Dalmatian roadside and the edge of a pine wood actually
// have at the end of August, and it is not a lawn. It is:
//
//   SEED-HEAD GRASSES, gone gold: wild oats (Avena) with their panicles of
//   hanging spikelets, false brome (Brachypodium) with a few narrow spikelets
//   held along the top of the stem, and hare's-tail (Lagurus), a cream puff
//   on a short stem;
//   BLEACHED TUSSOCKS, the colour of straw and some of them half flattened,
//   because a verge is where people step off the lane;
//   WILD FENNEL, a metre and a half of glaucous stems, the leaves a haze of
//   threads, flat yellow umbels going brown;
//   THISTLES: a flat grey-green rosette of spiny leaves and a few stiff stems
//   branching into small round heads — Eryngium, silvery-blue or grey, and
//   the odd golden Carlina or purple thistle;
//   IMMORTELLE — smilje, Helichrysum italicum — low silver mounds with flat
//   mustard-yellow clusters on them, which is the smell of the place.
//
// Sage and rosemary were on the list as "if cheap", and they were cheap —
// the smilje mound with its accent put to the leaf colour — and they were
// dropped on sight: a sage does not flower in August, and the cushion's
// flowering stems with leaf-coloured discs on them read as a plant with
// grey lollipops on it, not as sage.
//
// The palette is straw, silver-grey and dusty olive with small yellow and
// violet accents. The one thing it must never be is green.
//
// WHERE, which is 43-jadrija.js's business and not this file's: `field` says
// how far a point is from made ground and from anything standing, and the
// mix follows that. A verge is the strip where the made ground stops — the
// sprays and the mowers stop there too, and it is the only open, sunny,
// undisturbed ground in a swept pine wood — so almost everything here is in
// the first three metres off an edge, a kerb, a wall foot or a rock, and
// very little is out in the needle floor, which `floraLitter` has already.
//
// HOW, which is this file's. The same cells round the eye as `floraLitter`,
// each a pure function of the cell. Five prototypes, one per species, each a
// `floraBuilder` buffer built in three parts in this order:
//
//   [ far only ][ shared ][ near only ]
//
// and each drawn twice from the same buffer, by draw range: the NEAR mesh
// draws shared + near-only (every blade, spikelet, ray and umbellet as real
// geometry), the FAR mesh draws far-only + shared (the stems, and a single
// disc where the near tier has an umbel of thirteen rays). Each plant is in
// one or the other by its distance from the eye, handed over at `swap`
// metres with a per-plant jitter of a metre and a half either way so the
// hand-over is not a ring, and the far tier shrinks away by `far`. So what
// is drawn is bounded by two discs round the eye wherever you stand, and a
// plant costs its full geometry only inside the first.
//
// The wind is `floraWind`, taken at the plant's root rather than at each
// vertex: a fennel stem is a metre and a half tall and a per-vertex gust
// phase would put a kink in it wherever it crosses a cell of the phase hash.
// A small per-vertex flutter on top, continuous in position, keeps the heads
// alive. The lever (aSway) is written per species: a fennel's is a little
// over half its height, a tussock's is its blade length, so the fennel
// leans and the tussock shivers.
//
// The accent — umbels, thistle heads, immortelle clusters — is flagged in the
// vertex colour as a negative shade and takes its colour from the instance
// (`aInstSuit`, which the crowd uses for swimwear and nothing here does), so
// one thistle prototype is blue Eryngium, grey Eryngium, golden Carlina and a
// purple thistle, and one fennel is in flower, going over or gone to seed.
// -----------------------------------------------------------------------------

const _fv = {
  n: (a) => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; },
  x: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  add: (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
  mix: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
};
/** The accent flag: a vertex colour of minus this shade takes the instance's accent. */
const FV_ACC = (k) => [-k, -k, -k];

/**
 * A flat strip along a polyline: a culm, a blade, a rachis. `W` is the half
 * width at each point (nought at a tip, which makes the last span one
 * triangle), `A` the across direction, one for the strip or one per point.
 * The normal is the face's own leaned `up` of the way to straight up, as the
 * tufts do, and for the same reason.
 */
function fvStrip(fb, P, W, C, S, A, up = 0.65) {
  const V = P.map((p, k) => {
    const a = P[Math.min(k + 1, P.length - 1)], b = P[Math.max(k - 1, 0)];
    const t = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const ac = Array.isArray(A[0]) ? A[k] : A;
    let n = _fv.x(t, ac);
    if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
    n = _fv.n(n);
    n = _fv.n([n[0] * (1 - up), n[1] * (1 - up) + up, n[2] * (1 - up)]);
    const w = W[k];
    return { l: _fv.add(p, ac, -w), r: _fv.add(p, ac, w), p, n, c: C[k], s: S[k], w };
  });
  for (let k = 0; k < V.length - 1; k++) {
    const A0 = V[k], B = V[k + 1];
    if (B.w <= 0) {
      fb.smooth(A0.l, A0.r, B.p, A0.n, A0.n, B.n, A0.c, A0.c, B.c, A0.s, A0.s, B.s);
    } else {
      fb.smooth(A0.l, A0.r, B.r, A0.n, A0.n, B.n, A0.c, A0.c, B.c, A0.s, A0.s, B.s);
      fb.smooth(A0.l, B.r, B.l, A0.n, B.n, B.n, A0.c, B.c, B.c, A0.s, B.s, B.s);
    }
  }
}

/** A needle: one triangle from `a` out along `dir`. Fennel threads, immortelle leaves, spines. */
function fvNeedle(fb, a, dir, len, w, across, c0, c1, s0, s1) {
  const tip = _fv.add(a, dir, len);
  let n = _fv.x(dir, across);
  if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
  n = _fv.n([n[0] * 0.4, n[1] * 0.4 + 0.6, n[2] * 0.4]);
  fb.smooth(_fv.add(a, across, -w), _fv.add(a, across, w), tip, n, n, n, c0, c0, c1, s0, s0, s1);
}

/**
 * A stem: a polyline lofted as a prism of `sides` faces, radius `R` at each
 * point, smooth radial normals. Three sides is a round stem at anything past
 * arm's length and a third of the cost of eight.
 */
function fvStem(fb, P, R, C, S, sides = 3) {
  const e = P[P.length - 1];
  const d = _fv.n([e[0] - P[0][0], e[1] - P[0][1], e[2] - P[0][2]]);
  const ref = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const rings = P.map((p, k) => {
    const a = P[Math.min(k + 1, P.length - 1)], b = P[Math.max(k - 1, 0)];
    const t = _fv.n([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
    const u = _fv.n(_fv.x(t, ref)), v = _fv.x(t, u);
    const ring = [];
    for (let i = 0; i < sides; i++) {
      const an = (i / sides) * TAU;
      const nn = [u[0] * Math.cos(an) + v[0] * Math.sin(an), u[1] * Math.cos(an) + v[1] * Math.sin(an),
        u[2] * Math.cos(an) + v[2] * Math.sin(an)];
      ring.push({ p: _fv.add(p, nn, R[k]), n: nn });
    }
    return ring;
  });
  for (let k = 0; k < P.length - 1; k++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const A = rings[k][i], B = rings[k][j], Cc = rings[k + 1][j], D = rings[k + 1][i];
      fb.smooth(A.p, B.p, Cc.p, A.n, B.n, Cc.n, C[k], C[k], C[k + 1], S[k], S[k], S[k + 1]);
      fb.smooth(A.p, Cc.p, D.p, A.n, Cc.n, D.n, C[k], C[k + 1], C[k + 1], S[k], S[k + 1], S[k + 1]);
    }
  }
}

/** A flat disc facing `up`, its centre raised `h`: an umbellet, a flower cluster. */
function fvDisc(fb, c, up, r, sides, h, col, sw, rot = 0) {
  const u = _fv.n(_fv.x(up, Math.abs(up[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = _fv.x(up, u);
  const top = _fv.add(c, up, h);
  const n = _fv.n(_fv.add(up, [0, 1, 0], 0.5));
  const rim = (a) => [c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r,
    c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r,
    c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r];
  for (let i = 0; i < sides; i++) {
    const p0 = rim(rot + (i / sides) * TAU), p1 = rim(rot + ((i + 1) / sides) * TAU);
    fb.smooth(top, p0, p1, n, n, n, col, col, col, sw, sw, sw);
  }
}

/** A small ovoid along `ax`: a spikelet, a hare's-tail, a thistle head. Eight faces. */
function fvOvoid(fb, c, ax, rx, ry, col, sw, colTip = col) {
  const a = _fv.n(ax);
  const u = _fv.n(_fv.x(a, Math.abs(a[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = _fv.x(a, u);
  const T = _fv.add(c, a, ry), B = _fv.add(c, a, -ry);
  const R = [_fv.add(c, u, rx), _fv.add(c, v, rx), _fv.add(c, u, -rx), _fv.add(c, v, -rx)];
  const RN = [u, v, _fv.mul(u, -1), _fv.mul(v, -1)];
  const na = _fv.mul(a, -1);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    fb.smooth(T, R[i], R[j], a, RN[i], RN[j], colTip, col, col, sw, sw, sw);
    fb.smooth(B, R[j], R[i], na, RN[j], RN[i], col, col, col, sw, sw, sw);
  }
}

/** A point `u` of the way along a polyline, and the way it is heading there. */
function fvAlong(P, u) {
  const f = clamp(u, 0, 1) * (P.length - 1);
  const k = Math.min(P.length - 2, Math.floor(f));
  const p = _fv.mix(P[k], P[k + 1], f - k);
  return { p, d: _fv.n([P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1], P[k + 1][2] - P[k][2]]) };
}

/** Three builders, far-only / shared / near-only, and the one buffer they make. */
function fvProto() { return { F: floraBuilder(), S: floraBuilder(), N: floraBuilder() }; }
function fvGeo(pr) {
  const parts = [pr.F.geo(), pr.S.geo(), pr.N.geo()];
  const g = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['aVCol', 3], ['aSway', 1]]) {
    const n = parts.reduce((a, p) => a + p.attributes[name].array.length, 0);
    const out = new Float32Array(n);
    let o = 0;
    for (const p of parts) { out.set(p.attributes[name].array, o); o += p.attributes[name].array.length; }
    g.setAttribute(name, new THREE.BufferAttribute(out, size));
  }
  const f0 = pr.F.count(), f1 = f0 + pr.S.count(), all = f1 + pr.N.count();
  for (const p of parts) p.dispose();
  return { g, f0, f1, all };
}

/**
 * Wild oats, false brome and hare's-tail: one clump of culms out of a crown,
 * `o.h` tall, with a few dry leaves at its foot.
 *
 * Far, every other culm is drawn again two and a half times as wide, and
 * carries a single ovoid where the near one has a panicle of hanging
 * spikelets: past twenty metres the panicle is two pixels and its
 * silhouette is all that is left of it.
 */
function vergeOats(pr, o = {}) {
  const H = (k) => floraHash((o.seed || 1) * 3.07 + 0.4, k);
  const n = o.n || 16, h = o.h || 0.80;
  const BASE = [0.380, 0.330, 0.228], STRAW = [0.700, 0.600, 0.382], PALE = [0.800, 0.720, 0.520];
  const UNRIPE = [0.560, 0.560, 0.365], CREAM = [0.860, 0.820, 0.690];
  for (let j = 0; j < n; j++) {
    const q = (k) => H(100 + j * 13 + k);
    const shared = j % 2 === 0;           // drawn far as well, see below
    const az = j * 2.3999632 + H(1) * TAU;
    const outer = Math.sqrt(q(1));
    const bx = Math.cos(az) * 0.045 * outer, bz = Math.sin(az) * 0.045 * outer;
    const phi = az + (q(2) - 0.5) * 0.8;
    const cph = Math.cos(phi), sph = Math.sin(phi);
    const lean = 0.04 + 0.22 * outer + 0.08 * q(3);
    const curl = 0.10 + 0.45 * q(4);
    const kind = q(6) < 0.58 ? 0 : q(6) < 0.84 ? 1 : 2;       // avena, brachypodium, lagurus
    const L = h * (0.72 + 0.40 * q(5)) * (1.06 - 0.20 * outer) * (kind === 2 ? 0.50 : 1);
    const ripe = q(7) < 0.8;
    const mid = ripe ? STRAW : UNRIPE, top = ripe ? PALE : _fv.mix(UNRIPE, PALE, 0.4);
    const K = 5;
    const P = [[bx, -0.02, bz]];
    let x = bx, y = -0.02, z = bz;
    for (let k = 1; k <= K; k++) {
      const th = lean + curl * Math.pow(k / K, 1.8), st = L / K;
      x += Math.sin(th) * cph * st; y += Math.cos(th) * st; z += Math.sin(th) * sph * st;
      P.push([x, y, z]);
    }
    const sw = P.map((p) => Math.max(0, p[1]) + 0.3 * Math.hypot(p[0] - bx, p[2] - bz));
    // Across the culm: horizontal, turning a little up its length so no culm
    // is edge-on to you from end to end.
    const A = P.map((_, k) => { const a = phi + (k / K) * 1.2; return [-Math.sin(a), 0, Math.cos(a)]; });
    const CC = P.map((_, k) => (k / K < 0.4 ? _fv.mix(BASE, mid, k / K / 0.4) : _fv.mix(mid, top, (k / K - 0.4) / 0.6)));
    fvStrip(pr.N, P, P.map((_, k) => 0.0019 - 0.0008 * (k / K)), CC, sw, A, 0.55);
    // Far, every other culm again at two and a half times the width: half
    // the culms and the same coverage, which is what is left of a clump of
    // hairlines at twenty metres. Sharing the near culms instead halved it,
    // and the far verge came out as half a verge.
    if (shared) fvStrip(pr.F, P, P.map((_, k) => (0.0019 - 0.0008 * (k / K)) * 2.5), CC, sw, A, 0.55);
    const tip = P[K], swT = sw[K] * 1.1;
    const dir = _fv.n([P[K][0] - P[K - 1][0], P[K][1] - P[K - 1][1], P[K][2] - P[K - 1][2]]);
    const out = [cph, 0, sph];
    if (kind === 2) {
      // Hare's-tail: a soft ovoid on the end, cream. Cheap enough to share.
      fvOvoid(pr.N, _fv.add(tip, dir, 0.014), dir, 0.0085, 0.020, CREAM, swT, [0.93, 0.90, 0.80]);
      if (shared) fvOvoid(pr.F, _fv.add(tip, dir, 0.016), dir, 0.012, 0.024, CREAM, swT);
      continue;
    }
    if (kind === 0) {
      // Wild oat: three whorls of pedicels and a tip, each hanging a spikelet.
      for (let w = 0; w < 4; w++) {
        const at = fvAlong(P, 0.80 + w * 0.066);
        const np = w === 3 ? 1 : 2;
        for (let pp = 0; pp < np; pp++) {
          const a = phi + w * 2.1 + pp * Math.PI + (q(20 + w * 2 + pp) - 0.5);
          const od = _fv.n([Math.cos(a) * 0.8 + at.d[0] * 0.3, -0.35 + at.d[1] * 0.3, Math.sin(a) * 0.8 + at.d[2] * 0.3]);
          const pl = 0.035 + 0.035 * q(30 + w * 2 + pp) * (1 - w * 0.2);
          const across = [-Math.sin(a), 0, Math.cos(a)];
          fvNeedle(pr.N, at.p, od, pl, 0.0007, across, mid, top, swT, swT);
          const hb = _fv.add(at.p, od, pl);
          const hx = _fv.n([od[0] * 0.3, -0.95, od[2] * 0.3]);
          fvOvoid(pr.N, _fv.add(hb, hx, 0.011), hx, 0.0036, 0.012, top, swT * 1.1, PALE);
        }
      }
      if (shared) {
        const at = fvAlong(P, 0.84);
        const hx = _fv.n([out[0] * 0.35, -0.9, out[2] * 0.35]);
        fvOvoid(pr.F, _fv.add(_fv.add(at.p, out, 0.03), hx, 0.02), hx, 0.009, 0.034, top, swT);
      }
    } else {
      // False brome: five narrow spikelets held along the top, nodding.
      for (let k = 0; k < 5; k++) {
        const at = fvAlong(P, 0.80 + k * 0.045);
        const side = k % 2 ? 1 : -1;
        const ax = _fv.n(_fv.add(at.d, A[K], side * 0.35));
        fvOvoid(pr.N, _fv.add(at.p, ax, 0.015), ax, 0.003, 0.016, top, swT, PALE);
      }
      if (shared) {
        const at = fvAlong(P, 0.9);
        fvOvoid(pr.F, at.p, at.d, 0.006, 0.07, top, swT);
      }
    }
  }
  // The dry leaves at the foot of the clump, half of them far as well.
  for (let j = 0; j < 10; j++) {
    const q = (k) => H(400 + j * 7 + k);
    const a = j * 2.3999632 + q(1);
    const L = 0.12 + 0.12 * q(2), lean = 0.5 + 0.5 * q(3);
    const P = [[0, -0.02, 0]];
    let x = 0, y = -0.02, z = 0;
    for (let k = 1; k <= 3; k++) {
      const th = lean + 0.7 * Math.pow(k / 3, 1.5), st = L / 3;
      x += Math.sin(th) * Math.cos(a) * st; y += Math.cos(th) * st; z += Math.sin(th) * Math.sin(a) * st;
      P.push([x, Math.max(y, 0.004), z]);
    }
    const W = j % 2 ? [0.0035, 0.003, 0.002, 0] : [0.007, 0.006, 0.004, 0];
    fvStrip(j % 2 ? pr.N : pr.S, P, W, [BASE, STRAW, STRAW, PALE],
      P.map((p) => p[1] + 0.2 * Math.hypot(p[0], p[2])), [-Math.sin(a), 0, Math.cos(a)], 0.6);
  }
}

/**
 * A bleached tussock, `o.flat` of its blades lying over one way: trodden, or
 * blown flat by the bura and never stood up again. A few live grey-green
 * blades in the heart of it; the rest is straw and the grey of last year's.
 * The far tier is fourteen wide blades, the same mass at twenty metres.
 */
function vergeTussock(pr, o = {}) {
  const H = (k) => floraHash((o.seed || 1) * 1.93 + 0.8, k);
  const n = o.n || 46, h = o.h || 0.34, r = o.r || 0.14, flat = o.flat != null ? o.flat : 0.45;
  const ROOT = [0.360, 0.316, 0.226], BLEACH = [0.745, 0.685, 0.525], STRAW = [0.650, 0.575, 0.400];
  const OLD = [0.540, 0.500, 0.415], LIVE = [0.430, 0.455, 0.325];
  const phiF = H(9) * TAU;
  const blade = (B, j, wide, K, far) => {
    const q = (k) => H(100 + j * 11 + k + (far ? 3000 : 0));
    const a0 = j * 2.3999632 + H(1) * TAU;
    const rb = r * 0.40 * Math.sqrt(q(1));
    const bx = Math.cos(a0) * rb, bz = Math.sin(a0) * rb;
    const lying = q(8) < flat;
    const live = !lying && q(9) < 0.14;
    const phi = lying ? phiF + (q(2) - 0.5) * 1.5 : a0 + (q(2) - 0.5) * 1.1;
    const outer = Math.sqrt(q(1));
    const lean = lying ? 0.65 + 0.45 * q(3) : 0.08 + 0.50 * outer + 0.30 * q(3);
    const curl = lying ? 0.55 + 0.55 * q(4) : 0.25 + 0.80 * q(4);
    const L = h * (0.55 + 0.55 * q(5)) * (live ? 0.7 : lying ? 1.15 : 1.0);
    const tipC = live ? LIVE : q(6) < 0.55 ? BLEACH : q(6) < 0.8 ? STRAW : OLD;
    const P = [[bx, -0.03, bz]];
    let x = bx, y = -0.03, z = bz;
    for (let k = 1; k <= K; k++) {
      const th = lean + curl * Math.pow(k / K, 1.5), st = L / K;
      x += Math.sin(th) * Math.cos(phi) * st; y += Math.cos(th) * st; z += Math.sin(th) * Math.sin(phi) * st;
      P.push([x, Math.max(y, 0.006 + 0.004 * k), z]);
    }
    const tw = (q(7) - 0.5) * 0.9;
    const A = [-Math.sin(phi) * Math.cos(tw), Math.sin(tw) * 0.3, Math.cos(phi) * Math.cos(tw)];
    const w0 = wide * (0.7 + 0.6 * q(10));
    fvStrip(B, P, P.map((_, k) => (k === K ? 0 : w0 * Math.pow(1 - k / K, 0.8))),
      P.map((_, k) => _fv.mix(ROOT, tipC, Math.pow(k / K, 0.7))),
      P.map((p) => Math.max(0, p[1]) + 0.3 * Math.hypot(p[0] - bx, p[2] - bz)), A, 0.7);
  };
  for (let j = 0; j < n; j++) blade(pr.N, j, 0.0075, 3, false);
  for (let j = 0; j < 14; j++) blade(pr.F, j, 0.024, 2, true);
}

/**
 * Wild fennel, `o.h` tall: three to five stems out of one crown, each with a
 * terminal umbel and two or three side branches ending in smaller ones, and
 * the leaves — thread-fine, three and four times divided — low down, where
 * August has left any. A stem in three or four is last year's, grey-brown
 * and leafless, standing among the new ones, which is how a clump looks.
 *
 * An umbel near is thirteen rays up and out to a flat top, each carrying an
 * umbellet; far, it is one disc. A leaf near is a rachis with threads off it
 * in pairs; far, a narrow feather of the same colour. The stems are shared.
 */
function vergeFennel(pr, o = {}) {
  const H = (k) => floraHash((o.seed || 1) * 2.41 + 0.2, k);
  const h = o.h || 1.45;
  const STEM = [0.455, 0.490, 0.335], DRY = [0.520, 0.445, 0.310], FOOT = [0.330, 0.310, 0.220];
  const FOL = [0.405, 0.465, 0.285], FOLD = [0.525, 0.460, 0.305], RAY = [0.560, 0.560, 0.330];
  const lev = (p) => Math.max(0, p[1]) * 0.55;
  const umbel = (c, dir, R, dead, sw, k0) => {
    const up = _fv.n(_fv.add(dir, [0, 1, 0], 1.2));
    const u = _fv.n(_fv.x(up, [1, 0, 0])), v = _fv.x(up, u);
    const shade = dead ? 0.62 : 0.92 + 0.12 * H(k0);
    for (let r = 0; r < 16; r++) {
      const inner = r >= 11;
      const a = inner ? ((r - 11) / 5) * TAU + 0.4 : (r / 11) * TAU + (H(k0 + r) - 0.5) * 0.3;
      const rr = inner ? 0.45 : 0.92 + 0.12 * H(k0 + 20 + r);
      const lift = R * (inner ? 0.42 : 0.30);
      const e = [c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * R * rr + up[0] * lift,
        c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * R * rr + up[1] * lift,
        c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * R * rr + up[2] * lift];
      const d = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
      const len = Math.hypot(d[0], d[1], d[2]);
      fvNeedle(pr.N, c, _fv.n(d), len, 0.0011, _fv.n(_fv.x(d, up)), dead ? DRY : RAY, dead ? DRY : RAY, sw, sw * 1.05);
      fvDisc(pr.N, e, up, R * (inner ? 0.14 : 0.17), 5, R * 0.05, FV_ACC(shade * (0.9 + 0.2 * H(k0 + 40 + r))),
        sw * 1.05, a);
    }
    // Smaller and darker than the umbel it stands for: thirteen umbellets
    // with dark gaps between them, set side by side with this at fifteen
    // metres, read a third less yellow than one full disc of the same size.
    fvDisc(pr.F, _fv.add(c, up, R * 0.32), up, R * 0.78, 7, R * 0.18, FV_ACC(shade * 0.88), sw * 1.05);
  };
  const leaf = (base, az, len, el, dry, sw0, k0) => {
    const P = [base];
    let p = base;
    for (let k = 1; k <= 4; k++) {
      const th = el + 0.35 * Math.pow(k / 4, 1.6);
      const st = len / 4;
      p = [p[0] + Math.sin(th) * Math.cos(az) * st, Math.max(0.01, p[1] + Math.cos(th) * st), p[2] + Math.sin(th) * Math.sin(az) * st];
      P.push(p);
    }
    const side = [-Math.sin(az), 0, Math.cos(az)];
    const col = dry ? FOLD : FOL;
    const sw = P.map((pp) => Math.max(sw0, lev(pp)) * 1.1);
    fvStrip(pr.N, P, [0.0012, 0.0010, 0.0008, 0.0006, 0], P.map(() => col), sw, side, 0.5);
    for (let k = 0; k < 4; k++) {
      const at = fvAlong(P, (k + 0.5) / 4);
      for (const sd of [-1, 1]) {
        for (let t = 0; t < 4; t++) {
          const q = H(k0 + k * 17 + t * 5 + (sd > 0 ? 3 : 0));
          const d = _fv.n([side[0] * sd * 0.8 + at.d[0] * (0.1 + 0.3 * t), (q - 0.5) * 1.1 + 0.1,
            side[2] * sd * 0.8 + at.d[2] * (0.1 + 0.3 * t)]);
          const ln = (0.105 - 0.016 * k) * (0.7 + 0.5 * q);
          const cc = _fv.mul(col, 0.9 + 0.2 * q);
          fvNeedle(pr.N, at.p, d, ln, 0.0010, _fv.n(_fv.x(d, [0, 1, 0])), cc, cc, sw[k], sw[k] * 1.1);
        }
      }
    }
    // Far: the same leaf as a narrow feather.
    fvStrip(pr.F, P, [0.012, 0.030, 0.034, 0.022, 0], P.map((_, k) => _fv.mul(col, 0.88 + 0.03 * k)), sw, side, 0.6);
  };
  const m = 3 + Math.floor(H(1) * 2.99);
  for (let i = 0; i < m; i++) {
    const q = (k) => H(100 + i * 31 + k);
    const dead = i > 0 && q(1) < 0.3;
    const az = i * 2.3999632 + H(2) * TAU;
    const lean = 0.03 + 0.16 * q(2), bend = (q(3) - 0.5) * 0.16;
    const L = h * (dead ? 0.85 + 0.25 * q(4) : 0.72 + 0.32 * q(4));
    const K = 6;
    const P = [[Math.cos(az) * 0.03, -0.03, Math.sin(az) * 0.03]];
    let x = P[0][0], y = -0.03, z = P[0][2];
    for (let k = 1; k <= K; k++) {
      const th = lean + bend * (k / K) * (k / K), st = L / K;
      x += Math.sin(th) * Math.cos(az) * st; y += Math.cos(th) * st; z += Math.sin(th) * Math.sin(az) * st;
      P.push([x, y, z]);
    }
    const col = dead ? DRY : STEM;
    fvStem(pr.S, P, P.map((_, k) => 0.0085 * (h / 1.45) * (1 - 0.6 * k / K)),
      P.map((_, k) => _fv.mix(FOOT, col, Math.min(1, k / 2))), P.map(lev), 3);
    const tip = P[K];
    const td = _fv.n([P[K][0] - P[K - 1][0], P[K][1] - P[K - 1][1], P[K][2] - P[K - 1][2]]);
    umbel(tip, td, 0.105 * (0.8 + 0.4 * q(5)) * (h / 1.45), dead, lev(tip), 500 + i * 60);
    const nb = 3 + Math.floor(q(6) * 2.99);
    for (let b = 0; b < nb; b++) {
      const u0 = 0.42 + 0.44 * (b / nb) + 0.05 * q(40 + b * 8);
      const at = fvAlong(P, u0);
      const ba = az + (b % 2 ? Math.PI : 0) + (q(41 + b * 8) - 0.5) * 1.3;
      const el = 0.55 + 0.25 * q(42 + b * 8);
      const Lb = h * (0.14 + 0.12 * q(43 + b * 8)) * (1.15 - 0.5 * u0);
      const PB = [at.p];
      let pb = at.p;
      for (let k = 1; k <= 3; k++) {
        const th = el * (1 - 0.25 * k / 3), st = Lb / 3;
        pb = [pb[0] + Math.sin(th) * Math.cos(ba) * st, pb[1] + Math.cos(th) * st, pb[2] + Math.sin(th) * Math.sin(ba) * st];
        PB.push(pb);
      }
      fvStem(pr.S, PB, PB.map((_, k) => 0.0040 * (h / 1.45) * (1 - 0.4 * k / 3)), PB.map(() => col), PB.map(lev), 3);
      const bd = _fv.n([PB[3][0] - PB[2][0], PB[3][1] - PB[2][1], PB[3][2] - PB[2][2]]);
      umbel(PB[3], bd, 0.078 * (0.8 + 0.4 * q(44 + b * 8)) * (h / 1.45), dead || q(45 + b * 8) < 0.2, lev(PB[3]),
        900 + i * 90 + b * 30);
    }
    if (!dead) {
      for (let l = 0; l < 4; l++) {
        const u0 = 0.08 + 0.13 * l + 0.05 * q(90 + l * 6);
        const at = fvAlong(P, u0);
        leaf(at.p, az + l * 2.2 + q(91 + l * 6), h * (0.20 + 0.08 * q(92 + l * 6)) * (1 - 0.5 * u0), 0.75 + 0.2 * q(93 + l * 6),
          q(94 + l * 6) < 0.35, lev(at.p), 1500 + i * 200 + l * 60);
      }
    }
  }
  // The basal leaves, low and mostly dried.
  for (let l = 0; l < 4; l++) {
    leaf([0, 0.02, 0], l * 1.57 + H(3), h * 0.26 * (0.8 + 0.4 * H(4 + l)), 1.05 + 0.2 * H(8 + l), H(12 + l) < 0.7,
      0, 3000 + l * 60);
  }
}

/**
 * A thistle: a flat rosette of spiny grey-green leaves, and — on most — two
 * or three stiff stems branching at the top into a rounded candelabra of
 * small heads, each with a star of spiny bracts under it. That is Eryngium,
 * the field eryngo and the Dalmatian amethyst one, told apart by the accent
 * colour; Carlina and a purple thistle the same way, which at a metre and a
 * half is a liberty and past five is not.
 *
 * The first cut was one stem with four heads over a pale star, and at eye
 * height it read as a blue bead on a stick. What makes an eryngo is that it
 * is a BUSH of heads — a stem forks into four, each of those into three —
 * so there are twenty to forty of them, and the whole plant is a grey-blue
 * cloud half a metre across standing over the dry grass.
 */
function vergeThistle(pr, o = {}) {
  const H = (k) => floraHash((o.seed || 1) * 1.71 + 0.6, k);
  const h = o.h || 0.55;
  const LEAF = [0.395, 0.415, 0.325], VEIN = [0.580, 0.585, 0.490], SPINE = [0.690, 0.650, 0.490];
  const STEM = [0.540, 0.555, 0.470], FOOT = [0.360, 0.340, 0.260];
  const lev = (p) => Math.max(0, p[1]) * 0.8;
  // The rosette: nine lobed leaves lying on the ground.
  for (let i = 0; i < 9; i++) {
    const q = (k) => H(100 + i * 13 + k);
    const az = i * 2.3999632 + H(1) * TAU;
    const len = 0.12 + 0.10 * q(1), lift = 0.02 + 0.04 * q(2);
    const ca = Math.cos(az), sa = Math.sin(az);
    const side = [-sa, 0, ca];
    const P = [0, 0.25, 0.5, 0.75, 1].map((u) => [ca * len * u, 0.006 + lift * Math.sin(u * Math.PI) * 0.9, sa * len * u]);
    const W = [0.006, 0.026, 0.030, 0.018, 0];
    fvStrip(pr.N, P, W, [FOOT, LEAF, _fv.mix(LEAF, VEIN, 0.35), LEAF, SPINE], P.map(() => 0.02), side, 0.45);
    for (let k = 1; k <= 3; k++) {
      for (const sd of [-1, 1]) {
        const e = _fv.add(P[k], side, sd * W[k]), e2 = _fv.add(P[k + 1], side, sd * W[k + 1] * 0.6);
        const sp = [e[0] + side[0] * sd * 0.026 + ca * 0.014, e[1] + 0.010, e[2] + side[2] * sd * 0.026 + sa * 0.014];
        fvNeedle(pr.N, _fv.mix(e, e2, 0.5), _fv.n([sp[0] - e[0], sp[1] - e[1], sp[2] - e[2]]), 0.030, 0.010,
          [ca, 0, sa], LEAF, SPINE, 0.02, 0.02);
      }
    }
    // Far: a diamond per leaf, for six of the nine.
    if (i < 6) fvStrip(pr.F, [P[0], P[2], P[4]], [0.004, 0.036, 0], [FOOT, LEAF, LEAF], [0.02, 0.02, 0.02], side, 0.45);
  }
  const ns = H(2) < 0.12 ? 0 : 2 + Math.floor(H(3) * 1.99);
  const head = (c, ax, sw, k0, s = 1) => {
    const sh = 0.86 + 0.24 * H(k0);
    fvOvoid(pr.S, c, ax, 0.010 * s, 0.013 * s, FV_ACC(sh), sw, FV_ACC(sh * 1.12));
    const up = _fv.n(ax);
    const u = _fv.n(_fv.x(up, Math.abs(up[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = _fv.x(up, u);
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * TAU + H(k0 + b);
      const d = _fv.n([u[0] * Math.cos(a) + v[0] * Math.sin(a) - up[0] * 0.45, u[1] * Math.cos(a) + v[1] * Math.sin(a) - up[1] * 0.45,
        u[2] * Math.cos(a) + v[2] * Math.sin(a) - up[2] * 0.45]);
      fvNeedle(pr.N, _fv.add(c, up, -0.006 * s), d, (0.022 + 0.010 * H(k0 + 10 + b)) * s, 0.0035 * s, _fv.n(_fv.x(d, up)),
        FV_ACC(sh * 0.80), FV_ACC(sh * 1.02), sw, sw);
    }
  };
  // A branch from `a` heading `az` at `el` off the vertical, `L` long; it
  // bends back up towards its tip and carries a head there.
  const branch = (a, az, el, L, r0, B, k0) => {
    const P = [a];
    for (let k = 1; k <= 2; k++) {
      const th = el * (1 - 0.35 * k / 2), st = L / 2;
      const p = P[k - 1];
      P.push([p[0] + Math.sin(th) * Math.cos(az) * st, p[1] + Math.cos(th) * st, p[2] + Math.sin(th) * Math.sin(az) * st]);
    }
    fvStem(B, P, [r0, r0 * 0.85, r0 * 0.7], [STEM, STEM, STEM], P.map(lev), 3);
    const d = _fv.n([P[2][0] - P[1][0], P[2][1] - P[1][1], P[2][2] - P[1][2]]);
    return { tip: P[2], mid: P[1], d };
  };
  for (let i = 0; i < ns; i++) {
    const q = (k) => H(300 + i * 41 + k);
    const az = i * 2.3999632 + H(4) * TAU;
    const lean = 0.06 + 0.18 * q(1);
    const L = h * (0.45 + 0.20 * q(2));
    const P = [0, 1, 2, 3].map((k) => [Math.sin(lean) * Math.cos(az) * L * k / 3 + Math.cos(az) * 0.025,
      -0.02 + Math.cos(lean) * L * k / 3, Math.sin(lean) * Math.sin(az) * L * k / 3 + Math.sin(az) * 0.025]);
    fvStem(pr.S, P, [0.0055, 0.0046, 0.0038, 0.0032], [FOOT, STEM, STEM, STEM], P.map(lev), 3);
    // Spiny leaves clasping the stem, near only.
    for (let k = 0; k < 2; k++) {
      const at = fvAlong(P, 0.30 + 0.35 * k);
      for (const sd of [-1, 1]) {
        const a = az + Math.PI * 0.5 * sd + k;
        const d = _fv.n([Math.cos(a), 0.55, Math.sin(a)]);
        fvNeedle(pr.N, at.p, d, 0.050, 0.011, _fv.n(_fv.x(d, [0, 1, 0])), LEAF, SPINE, lev(at.p), lev(at.p) * 1.1);
      }
    }
    const top = P[3];
    head(top, [0, 1, 0], lev(top), 600 + i * 90, 1.15);
    // Four branches, and each forks again into two short twigs.
    for (let b = 0; b < 4; b++) {
      const ba = az + (b / 4) * TAU + (q(5 + b) - 0.5) * 0.7;
      const br = branch(top, ba, 0.55 + 0.35 * q(9 + b), h * 0.26 * (0.75 + 0.5 * q(13 + b)), 0.0028, pr.S, 0);
      head(br.tip, _fv.n(_fv.add(br.d, [0, 1, 0], 1.5)), lev(br.tip), 700 + i * 90 + b * 17);
      for (let t = 0; t < 2; t++) {
        const ta = ba + (t ? 0.9 : -0.9) + (q(17 + b * 2 + t) - 0.5) * 0.5;
        const tw = branch(br.mid, ta, 0.5 + 0.3 * q(25 + b * 2 + t), h * 0.13 * (0.7 + 0.6 * q(33 + b * 2 + t)), 0.0018,
          t ? pr.N : pr.S, 0);
        head(tw.tip, _fv.n(_fv.add(tw.d, [0, 1, 0], 1.5)), lev(tw.tip), 800 + i * 90 + b * 17 + t * 7, 0.85);
      }
    }
  }
}

/**
 * Immortelle — smilje — as a low cushion: a lumpy dark core so it is never
 * see-through, a coat of a couple of hundred silver needle leaves standing
 * out of it so the outline is fine and broken rather than a ball, and two
 * dozen flowering stems above it, each with a flat cluster of small mustard
 * heads. Far, the core, half the leaves and one disc a cluster. A third of
 * them are going over, the clusters gone to rust.
 *
 * The first cut was the core and forty shoots, and the shoots were too fine
 * to break its silhouette: at a metre it was a pale teal egg on the dust.
 * Smilje is not smooth anywhere; it is a mass of needles.
 */
function vergeMound(pr, o = {}) {
  const H = (k) => floraHash((o.seed || 1) * 2.93 + 0.1, k);
  const R = o.r || 0.26, Hh = o.h || 0.34;
  const SILV = [0.680, 0.665, 0.545], DEEP = [0.290, 0.282, 0.215], WOOD = [0.400, 0.350, 0.270];
  const lev = (p) => Math.max(0, p[1]) * 0.9;
  const no = (o.seed || 1) * 3.7;
  // The core: a lumpy squat ellipsoid, flattened underneath, mottled.
  const ico = floraIco(1);
  const cy = Hh * 0.28;
  const lump = (d) => 0.80 + 0.30 * floraNoise3(d[0] * 1.8 + no, d[1] * 1.8, d[2] * 1.8);
  const P = ico.v.map((d) => {
    const k = lump(d);
    return [d[0] * R * 0.60 * k, cy + (d[1] < 0 ? d[1] * 0.45 : d[1]) * Hh * 0.52 * k, d[2] * R * 0.60 * k];
  });
  const N = ico.v.map((d) => _fv.n([d[0], d[1] * 1.2 + 0.3, d[2]]));
  const C = ico.v.map((d, i) => _fv.mul(_fv.mix(DEEP, SILV, 0.15 + 0.35 * sat(d[1] + 0.2)), 0.80 + 0.35 * floraHash(i + no, 7)));
  for (const [a, b, c] of ico.f) {
    if (P[a][1] < -0.01 && P[b][1] < -0.01 && P[c][1] < -0.01) continue;
    pr.S.smooth(P[a], P[b], P[c], N[a], N[b], N[c], C[a], C[b], C[c], lev(P[a]) * 0.3, lev(P[b]) * 0.3, lev(P[c]) * 0.3);
  }
  const dome = (el, az, k) => {
    const d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const kk = k * lump(d);
    return [d[0] * R * 0.60 * kk, cy + d[1] * Hh * 0.52 * kk, d[2] * R * 0.60 * kk];
  };
  // The coat of needles, on a golden spiral over the upper part of the dome.
  const NL = 300;
  for (let i = 0; i < NL; i++) {
    const q = (k) => H(100 + i * 7 + k);
    const u = (i + 0.5) / NL;
    const el = -0.25 + Math.asin(u) * 1.15;
    const az = i * 2.3999632 + q(1) * 0.4;
    const b = dome(el, az, 0.85);
    const out = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const d = _fv.n([out[0] * 0.8 + (q(2) - 0.5) * 0.7, out[1] * 0.8 + 0.45, out[2] * 0.8 + (q(3) - 0.5) * 0.7]);
    const cc = _fv.mul(SILV, 0.78 + 0.34 * q(4));
    fvNeedle(i % 2 ? pr.N : pr.S, b, d, (0.070 + 0.045 * q(5)) * (R / 0.26), 0.0060, _fv.n(_fv.x(d, [0, 1, 0])),
      _fv.mul(cc, 0.75), cc, lev(b), lev(b) * 1.15);
  }
  // The flowering stems and their clusters.
  for (let i = 0; i < 24; i++) {
    const q = (k) => H(900 + i * 19 + k);
    const az = i * 2.3999632 + H(2) * TAU;
    const el = 0.80 + 0.65 * q(1);
    const b0 = dome(el, az, 0.6);
    const e = dome(el, az, 1.25);
    e[1] += 0.05 + 0.09 * q(3);
    const P2 = [b0, _fv.mix(b0, e, 0.55), e];
    fvStrip(pr.N, P2, [0.0020, 0.0016, 0.0012], [WOOD, SILV, SILV], P2.map(lev), [-Math.sin(az), 0, Math.cos(az)], 0.5);
    const sh = 0.86 + 0.24 * q(4);
    for (let k = 0; k < 5; k++) {
      const a = az + k * 1.3 + q(5 + k);
      const rr = k === 0 ? 0 : 0.014 + 0.006 * q(10 + k);
      const c = [e[0] + Math.cos(a) * rr, e[1] + (q(15 + k) - 0.6) * 0.010, e[2] + Math.sin(a) * rr];
      fvDisc(pr.N, c, [0, 1, 0], 0.009 + 0.005 * q(20 + k), 5, 0.005, FV_ACC(sh * (0.90 + 0.18 * q(25 + k))), lev(c) * 1.1, a);
    }
    fvDisc(pr.F, e, [0, 1, 0], 0.030, 6, 0.008, FV_ACC(sh), lev(e));
  }
}

/**
 * The material for the verge: `floraMat`'s surface, the accent, and the
 * tier. `tier` 0 is near, drawn inside each plant's hand-over distance; 1
 * is far, drawn outside it and shrunk away between 0.72 and 1 of `far`. The
 * hand-over is `swap` metres, jittered per plant by `aInstHair.x`.
 */
function floraVergeMat({ tier = 0, swap = 17, far = 44 } = {}) {
  return solidMaterial(0xffffff, {
    spec: 0.05, specPower: 14, emissive: 0.10,
    side: THREE.DoubleSide,
    instanced: true,
    uniforms: { uWind: U.uWind, uWindSpeed: U.uWindSpeed, uVergeSwap: { value: swap },
      uVergeFar: { value: far } },
    vdecl: `attribute float aSway;
uniform vec2 uWind;
uniform float uWindSpeed;
uniform float uTime;
uniform vec3 uCamPos;
uniform float uVergeSwap;
uniform float uVergeFar;
${GLSL_FLORA_WIND}`,
    vert: `
      {
        float lever = aSway * aInstScale.y;
        vec3 d = floraWind(aInstPos, lever, 1.0);
        // The flutter: a few millimetres a metre of lever, continuous in
        // position, so a spikelet and its neighbour do not move as one.
        float fl = sin(uTime * (5.0 + aInstHair.x * 3.0) + dot(p, vec3(23.0, 11.0, 17.0)))
          * (0.004 + 0.0012 * clamp(uWindSpeed, 0.0, 22.0)) * lever;
        d.x += fl; d.z += fl * 0.6;
        p += qrot(vec4(-aInstRot.xyz, aInstRot.w), d) / max(aInstScale, vec3(1e-3));
        float dc = distance(aInstPos.xz, uCamPos.xz);
        float sw = uVergeSwap + (aInstHair.x - 0.5) * 3.0;
        ${tier === 0 ? 'if (dc > sw) p = vec3(0.0);'
    : 'if (dc <= sw) p = vec3(0.0); else p *= 1.0 - smoothstep(uVergeFar * 0.72, uVergeFar, dc);'}
      }
    `,
    body: 'if (vVCol.r < 0.0) base = vSuit * -vVCol.r; else base *= vVCol;',
    lit: `
    {
      float into = pow(max(dot(viewDir, uSunDir), 0.0), 4.0);
      col += base * uSunColor * uSunI * INV_PI * into * (0.3 + 0.7 * sh) * 0.40;
    }`,
  });
}

/** The five species, in the order the layers are drawn. */
const VERGE_KINDS = ['oats', 'tussock', 'fennel', 'thistle', 'mound'];

/**
 * The verge round the eye. `field(x, z)` is 43-jadrija.js's answer to "what
 * is this ground": null where nothing may grow (made ground, a wall, a
 * doorway, the sea), or { edge, wall, trod } — metres to the nearest made
 * ground or standing thing, to the nearest standing thing alone, and
 * whether this is a walk between two walls. `height(x, z)` is the ground
 * there, or null after all. The mix is decided here, off those and a patch
 * noise a species; the places are decided there.
 */
function floraVerge(scene, { field, height, hole = null, cell = 2, swap = 17, far = 44, caps = {} } = {}) {
  const t0 = performance.now();
  const B = {
    oats: fvProto(), tussock: fvProto(), fennel: fvProto(), thistle: fvProto(), mound: fvProto(),
  };
  vergeOats(B.oats, { seed: 3.3, n: 16, h: 0.80 });
  vergeTussock(B.tussock, { seed: 5.1, n: 46, h: 0.34, r: 0.15, flat: 0.45 });
  vergeFennel(B.fennel, { seed: 2.2, h: 1.45 });
  vergeThistle(B.thistle, { seed: 4.4, h: 0.55 });
  vergeMound(B.mound, { seed: 6.6, r: 0.26, h: 0.34 });
  const CAP = { oats: 1600, tussock: 1400, fennel: 160, thistle: 500, mound: 600, ...caps };
  const matN = floraVergeMat({ tier: 0, swap, far }), matF = floraVergeMat({ tier: 1, swap, far });
  const L = {};
  const tris = {};
  for (const kind of VERGE_KINDS) {
    const { g, f0, f1, all } = fvGeo(B[kind]);
    tris[kind] = [(all - f0) / 3, f1 / 3];
    const mk = (range0, range1, cap, mat, name) => {
      const geo = new THREE.InstancedBufferGeometry();
      for (const k of Object.keys(g.attributes)) geo.setAttribute(k, g.attributes[k]);
      const A = {
        pos: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
        rot: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
        scale: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
        col: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
        acc: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
        hash: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      };
      for (const [n, a] of [['aInstPos', A.pos], ['aInstRot', A.rot], ['aInstScale', A.scale],
        ['aInstColor', A.col], ['aInstSuit', A.acc], ['aInstHair', A.hash]]) {
        a.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute(n, a);
      }
      geo.setDrawRange(range0, range1 - range0);
      geo.instanceCount = 0;
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.name = name;
      scene.add(mesh);
      return { mesh, geo, A, cap, n: 0 };
    };
    L[kind] = {
      near: mk(f0, all, CAP[kind], matN, 'flora:verge:' + kind),
      far: mk(0, f1, CAP[kind] * 3, matF, 'flora:verge:' + kind + ':far'),
    };
  }
  const buildMs = performance.now() - t0;

  // ── the mix ────────────────────────────────────────────────────────────────
  // Plants a square metre at the heart of a patch on the best of the verge.
  // A patch is a drift of one species about eight metres across, each on its
  // own noise, which is what a verge is: oats here, a run of fennel there,
  // immortelle where the rock comes through — never the five of them evenly
  // stirred together, which reads as a seed packet.
  const PEAK = { oats: 2.0, tussock: 1.3, fennel: 0.16, thistle: 0.22, mound: 0.30 };
  const patch = (ki, x, z) => {
    const o = ki * 37.1;
    return sat((floraNoise3(x * 0.13 + o, 1.5 + o, z * 0.13) - 0.36) / 0.30);
  };
  const density = (ki, f, x, z) => {
    // The verge proper: nothing on the made edge itself, the most from a
    // few hands to a metre out, gone by three. It was gone by four, and a
    // twelve-metre band of dust with an edge down each side came out as one
    // meadow; a verge is a strip, and the ground past it stays bare.
    const e = f.edge;
    const vg = sat((e - 0.10) / 0.30) * (1 - smoothstep(0.9, 3.0, e));
    const open = smoothstep(2.5, 6.0, e);
    const wall = (1 - smoothstep(0.7, 2.4, f.wall)) * sat((f.wall - 0.25) / 0.3);
    const pt = patch(ki, x, z);
    // A walk between two walls keeps only what hugs the foot of one.
    const tk = f.trod ? 1 - smoothstep(0.35, 0.9, f.wall) : 1;
    switch (VERGE_KINDS[ki]) {
      case 'oats': return tk * PEAK.oats * (vg * pt + 0.03 * open * pt);
      case 'tussock': return tk * PEAK.tussock * (vg * (0.25 + 0.75 * pt) + 0.05 * open * pt);
      case 'fennel': return f.trod ? 0 : PEAK.fennel * (Math.max(vg * 0.6, wall) * pt + 0.02 * open);
      case 'thistle': return tk * PEAK.thistle * (vg * (0.3 + 0.7 * pt) + 0.06 * open * pt);
      default: return tk * PEAK.mound * (Math.max(vg, wall * 0.8) * pt + 0.03 * open * pt);
    }
  };
  // How far off the made edge a plant's root has to be, so a fennel's crown
  // is not in the kerb and a tussock may just lip over it.
  const MIN_EDGE = { oats: 0.12, tussock: 0.10, fennel: 0.40, thistle: 0.22, mound: 0.30 };

  const cache = new Map();
  let cellsMade = 0;
  const itemsOf = (i, k) => {
    const key = (i + 40000) * 80000 + (k + 40000);
    let it = cache.get(key);
    if (it !== undefined) return it;
    it = [];
    const cx = (i + 0.5) * cell, cz = (k + 0.5) * cell;
    const seed = i * 5.17 + k * 9.31 + 0.7;
    // A cell whose centre is on made ground can still have an edge in it,
    // so its four quarters are asked before it is given up on.
    let fc = field(cx, cz);
    if (!fc) {
      for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        fc = field(cx + ox * cell, cz + oz * cell);
        if (fc) break;
      }
    }
    if (fc) {
      VERGE_KINDS.forEach((kind, ki) => {
        const d = density(ki, fc, cx, cz) * cell * cell;
        if (d <= 0.001) return;
        const n = Math.floor(d) + (floraHash(seed, ki * 97 + 1) < d - Math.floor(d) ? 1 : 0);
        for (let j = 0; j < n; j++) {
          const hk = (m) => floraHash(seed + j * 1.37, ki * 97 + m);
          const x = cx + (hk(2) - 0.5) * cell, z = cz + (hk(3) - 0.5) * cell;
          const fp = field(x, z);
          if (!fp || fp.edge < MIN_EDGE[kind]) continue;
          // Thinned again at the point itself, so a drift's edge is soft and
          // not the cell's square.
          if (hk(4) * PEAK[kind] > density(ki, fp, x, z) * 1.6 + 0.02) continue;
          const y = height(x, z);
          if (y == null) continue;
          it.push({ kind, x, y, z, yaw: hk(5) * TAU, a: hk(6), b: hk(7), c: hk(8), sw: hk(9), e: fp.edge });
        }
      });
    }
    cellsMade++;
    if (cache.size > 60000) cache.clear();
    cache.set(key, it);
    return it;
  };

  // What each species looks like as an instance: size, tint, and accent.
  const THISTLE_ACC = [[0.420, 0.490, 0.700], [0.620, 0.640, 0.540], [0.740, 0.620, 0.360], [0.520, 0.300, 0.500]];
  const FENNEL_ACC = [[0.820, 0.680, 0.150], [0.640, 0.590, 0.230], [0.470, 0.370, 0.210]];
  const dress = (o) => {
    const { a, b, c } = o;
    switch (o.kind) {
      case 'oats': {
        const s = 0.70 + 0.55 * a, g = 0.92 + 0.16 * b;
        return { s: [s * (0.9 + 0.2 * c), s * (0.85 + 0.3 * b), s * (0.9 + 0.2 * c)],
          col: [g * 1.02, g, g * (0.94 + 0.08 * c)], acc: [0, 0, 0] };
      }
      case 'tussock': {
        // Trodden flatter the nearer it is to the made edge.
        const fl = sat(1.2 - o.e * 0.5) * 0.5 + 0.3 * c;
        const s = 0.65 + 0.65 * a, g = 0.90 + 0.18 * b;
        return { s: [s * (1 + 0.3 * fl), s * (1 - 0.45 * fl), s * (1 + 0.3 * fl)],
          col: [g, g * 0.99, g * (0.95 + 0.08 * c)], acc: [0, 0, 0] };
      }
      case 'fennel': {
        const s = 0.70 + 0.45 * a, g = 0.94 + 0.10 * c;
        return { s: [s, s, s], col: [g, g, g], acc: FENNEL_ACC[b < 0.5 ? 0 : b < 0.78 ? 1 : 2] };
      }
      case 'thistle': {
        const s = 0.70 + 0.55 * a, g = 0.92 + 0.14 * c;
        return { s: [s, s * (0.85 + 0.3 * c), s], col: [g, g, g],
          acc: THISTLE_ACC[b < 0.45 ? 0 : b < 0.75 ? 1 : b < 0.9 ? 2 : 3] };
      }
      default: {
        // Smilje in flower, and a third of them going over to rust.
        const s = 0.60 + 0.65 * a;
        const over = b > 0.66 ? 1 : 0;
        return { s: [s * (1.0 + 0.2 * c), s * (0.8 + 0.3 * c), s * (1.0 + 0.2 * c)], col: [1.0, 1.0, 0.98],
          acc: over ? [0.600, 0.440, 0.200] : [0.760 - 0.1 * c, 0.590 - 0.06 * c, 0.150 + 0.04 * c] };
      }
    }
  };

  let ci = null, ck = null, lastMs = 0, worstMs = 0, builds = 0, enabled = true;
  const R = Math.ceil((far + cell) / cell);
  const nearR = swap + 1.5 + cell * 1.5, farR0 = swap - 1.5 - cell * 1.5;
  const cp = { x: 0, z: 0 };
  function put(l, o, dr) {
    if (l.n >= l.cap) return;
    const n = l.n++;
    const P = l.A.pos.array, Q = l.A.rot.array;
    P[n * 3] = o.x; P[n * 3 + 1] = o.y; P[n * 3 + 2] = o.z;
    const hy = o.yaw * 0.5;
    Q[n * 4] = 0; Q[n * 4 + 1] = Math.sin(hy); Q[n * 4 + 2] = 0; Q[n * 4 + 3] = Math.cos(hy);
    l.A.scale.array.set(dr.s, n * 3);
    l.A.col.array.set(dr.col, n * 3);
    l.A.acc.array.set(dr.acc, n * 3);
    l.A.hash.array[n * 3] = o.sw;
  }
  const layers = () => VERGE_KINDS.flatMap((k) => [L[k].near, L[k].far]);
  function rebuild() {
    const ts = performance.now();
    for (const l of layers()) l.n = 0;
    for (let di = -R; di <= R; di++) {
      for (let dk = -R; dk <= R; dk++) {
        if (di * di + dk * dk > R * R) continue;
        for (const o of itemsOf(ci + di, ck + dk)) {
          const d = Math.hypot(o.x - cp.x, o.z - cp.z);
          if (d > far + cell) continue;
          // A room you are standing in that is not where the ground says
          // it is (1.552.1): the kabina's big room is swapped in over the
          // alley behind the row, and the verge under it came up through
          // its tiles. Asked here, at the draw, and not in `itemsOf`: the
          // plants are the same plants either way, and only whether they
          // are drawn changes when the room does.
          if (hole && hole(o.x, o.z)) continue;
          const dr = dress(o);
          if (d < nearR) put(L[o.kind].near, o, dr);
          if (d > farR0) put(L[o.kind].far, o, dr);
        }
      }
    }
    for (const l of layers()) {
      l.geo.instanceCount = l.n;
      l.mesh.visible = enabled && l.n > 0;
      for (const a of Object.values(l.A)) {
        a.needsUpdate = true;
        a.clearUpdateRanges();
        a.addUpdateRange(0, l.n * a.itemSize);
      }
    }
    lastMs = performance.now() - ts;
    worstMs = Math.max(worstMs, lastMs);
    builds++;
  }

  return {
    meshes: () => layers().map((l) => l.mesh),
    /** Call once a frame with the eye. `ground` is the height under it. */
    update(cam, ground) {
      // From the air there is nothing here to see, and nothing to spend on.
      const on = enabled && cam.y - ground < 40;
      for (const l of layers()) l.mesh.visible = on && l.n > 0;
      if (!on) return;
      const i = Math.floor(cam.x / cell), k = Math.floor(cam.z / cell);
      if (i === ci && k === ck) return;
      ci = i; ck = k;
      cp.x = (i + 0.5) * cell; cp.z = (k + 0.5) * cell;
      rebuild();
    },
    /** Forget every cell: the ground under them has changed. */
    reset() { cache.clear(); ci = ck = null; },
    /** Lay the layers again from the cells already made: `hole` has changed. */
    refresh() { ci = ck = null; },
    /** Off and on, for an A/B in the same page. */
    enable(v) {
      enabled = !!v;
      for (const l of layers()) l.mesh.visible = enabled && l.n > 0;
    },
    /** Every plant in the cells made so far, for a probe to map. */
    items: () => [...cache.values()].flat(),
    /** The nearest plant of a kind to (x, z) among the cells made so far: for a probe. */
    find(kind, x, z) {
      let best = null, bd = Infinity;
      for (const it of cache.values()) {
        for (const o of it) {
          const d = Math.hypot(o.x - x, o.z - z);
          if (o.kind === kind && d < bd) { bd = d; best = o; }
        }
      }
      return best && { x: best.x, y: best.y, z: best.z, d: bd, e: best.e };
    },
    stats: () => {
      const n = {};
      for (const kind of VERGE_KINDS) n[kind] = [L[kind].near.n, L[kind].far.n];
      return { n, tris, cells: cache.size, cellsMade, builds, buildMs: +buildMs.toFixed(1),
        lastMs: +lastMs.toFixed(2), worstMs: +worstMs.toFixed(2) };
    },
  };
}
