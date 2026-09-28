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
//                  grass in cells, instanced, gone by thirty metres.
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
