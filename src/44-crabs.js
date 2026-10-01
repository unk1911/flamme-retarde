// -----------------------------------------------------------------------------
// Crabs.
//
// Misha, 1 Oct 2026, after looking at gkjohnson's closed-chain-ik-js and its
// hexapods: *"sure bring in the crabs :)"*. So: the marbled rock crab,
// Pachygrapsus marmoratus — the dark, squarish, fast little crab of every
// rocky shore in Dalmatia, the one that runs sideways off a rock and into a
// crack the moment your shadow falls on it. Three to five centimetres of
// carapace, near-black olive or purple-brown, scribbled across with pale
// transverse lines (that is the "marmoratus"), legs flattened and mottled,
// two short equal claws with pale tips.
//
// WHERE. Only where there is rock at the water and nowhere else: the tipped
// limestone armouring at the end of the beach (t 189-219, see "the
// armouring" in 43-jadrija.js), the stone toe at the head of the bathing mole
// and the foot of its flanks under water, and the armour at the heads of the
// two moles off the kabine. Some live in the splash zone and some on the bed
// a metre or three down, where you meet them swimming.
//
// THE FEET ARE THE POINT. A crab is eight legs and the eye reads the legs, so
// every foot is planted on the surface that is actually drawn there and stays
// put while the body moves over it, and steps when it has to — the alternating
// tetrapod gait (L1 R2 L3 R4 against R1 L2 R3 L4) that every decapod uses. The
// leg is solved, not keyed: a coxa that swings in yaw toward the foot, then a
// two-bone solve (merus, and carpus-propodus-dactyl as one) in the vertical
// plane through it, knee up. Analytic, eight times a crab, a few hundred
// flops: there is no closed chain in a crab standing on a rock, so the
// closed-chain solver that started this conversation stayed in its repository
// (and its licence with it).
//
// "The surface that is actually drawn" is the hard half. The shore is a
// million triangles in three merged buffers and the bed under it is the
// terrain's own 5 m triangles, which do NOT agree with `groundAt` (that one
// samples the DEM a half-texel off the GPU's lattice, and bilinearly, where
// the mesh is two flat triangles a quad). So each habitat is a PATCH with its
// own small height field, baked the first time you come near it: the drawn
// terrain under it computed exactly as the vertex shader does, and every
// upward-facing triangle of the rocks, the concrete and the mole rasterised
// into it, highest wins. Four to five centimetres a cell, a megabyte or so a
// patch, a few milliseconds once.
//
// COST. Nothing exists until you are within `spawn` of a patch; nothing is
// simulated or drawn beyond `live` of the eye. A crab is 33 instances across
// five instanced meshes that share one program — the shell, the flat leg
// segment, the pointed leg tip, the palm and the moving finger — so the whole
// population is five draw calls, and none when there is nobody about.
//
// Nothing here draws from the resort's `rng` (rule 4): crabs are placed and
// driven by hashes of their own index.
// -----------------------------------------------------------------------------

const CRAB = {
  spawn: 48,          // a patch is baked and peopled when the eye is this close to it
  live: 24,           // a crab is simulated and drawn within this of the eye
  flee: 2.0,          // a person this close sends it off
  bold: 1.25,         // ...unless it is a bold one, which stands and shows its claws first
  alert: 3.0,         // and this close it stops what it is doing and watches you
  hose: 1.5,          // water landing this close sends it off whoever is holding the hose
  sprint: [0.42, 0.70],   // m/s, running away
  stroll: [0.035, 0.085], // m/s, going about its business
  clear: 0.30,        // body centre over the ground, in carapace widths
  // What a shell is: carapace width in metres, and how many of them per patch.
  cw: [0.030, 0.048],
  // The tide band each kind keeps to, in metres about the still water line.
  // A rock crab lives in the splash zone and will go under to get away; a bed
  // crab lives under and stays there.
  band: { rock: [-0.55, 1.45], bed: [-6.0, -0.30], flight: [-2.6, 1.45] },
};

/**
 * One walking leg of the right side, front to back; the left is its mirror in
 * x. In carapace widths about the body centre, crab axes: +x right, +y up, -z
 * the front. `a` is how far the rest foot is swung forward of straight out
 * (radians), `reach` how far out it lands, and the three lengths are the coxa,
 * the merus and the rest of the leg (carpus, propodus and dactyl as one).
 * The second and third pairs are the long ones, as they are in the animal.
 */
const CRAB_LEGS = [
  { r: [0.40, -0.03, -0.19], a: 0.72, reach: 0.78, c: 0.10, m: 0.40, t: 0.52 },
  { r: [0.45, -0.03, -0.05], a: 0.24, reach: 0.88, c: 0.10, m: 0.47, t: 0.60 },
  { r: [0.44, -0.03, 0.10], a: -0.26, reach: 0.86, c: 0.10, m: 0.46, t: 0.58 },
  { r: [0.37, -0.03, 0.23], a: -0.82, reach: 0.74, c: 0.10, m: 0.38, t: 0.48 },
];
/** The cheliped: root at the front corner under the orbit, and its three pieces. */
const CRAB_ARM = { r: [0.33, -0.05, -0.36], m: 0.30, c: 0.17, palm: 0.46 };

// ── the drawn ground ──────────────────────────────────────────────────────────

/**
 * The terrain height exactly as the vertex shader puts it there.
 *
 * Two things differ from `groundAt` and both matter at the size of a crab's
 * foot. The texture is sampled with its texel centres at (i + 0.5) / N, where
 * `groundAt` puts grid point i at i / (N - 1) — a metre of shift out here — and
 * the mesh between its 5.08 m vertices is two flat triangles split on the
 * b-d diagonal (see `tileGeometry`), not a bilinear patch.
 */
function crabTexH(x, z) {
  const N = world.grid, h = world.height;
  const u = clamp((x + HALF) / CONFIG.world, 0.0005, 0.9995) * N - 0.5;
  const v = clamp((z + HALF) / CONFIG.world, 0.0005, 0.9995) * N - 0.5;
  const i0 = clamp(Math.floor(u), 0, N - 1), j0 = clamp(Math.floor(v), 0, N - 1);
  const i1 = Math.min(i0 + 1, N - 1), j1 = Math.min(j0 + 1, N - 1);
  const fu = clamp(u - i0, 0, 1), fv = clamp(v - j0, 0, 1);
  const a = h[j0 * N + i0], b = h[j0 * N + i1], c = h[j1 * N + i0], d = h[j1 * N + i1];
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
}
function crabDrawnH(x, z) {
  const step = CONFIG.world / TERRAIN.tiles / TERRAIN.lods[0];
  const gx = (x + HALF) / step, gz = (z + HALF) / step;
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const x0 = -HALF + i * step, z0 = -HALF + j * step;
  const ha = crabTexH(x0, z0), hb = crabTexH(x0 + step, z0);
  const hd = crabTexH(x0, z0 + step);
  if (fx + fz <= 1) return ha + (hb - ha) * fx + (hd - ha) * fz;
  const hc = crabTexH(x0 + step, z0 + step);
  return hc + (hd - hc) * (1 - fx) + (hb - hc) * (1 - fz);
}

// ── the animal ────────────────────────────────────────────────────────────────

/**
 * A ring loft: `at(i, j)` gives ring i (0..rings) point j (0..sides-1, wrapped)
 * and `tone(i, j)` its aVCol. Radius 0 at either end closes it.
 */
function crabLoft(rings, sides, at, tone) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    for (let j = 0; j < sides; j++) {
      const p = at(i, j);
      pos.push(p[0], p[1], p[2]);
      const c = tone(i, j);
      col.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides;
      const c = (i + 1) * sides + (j + 1) % sides, d = (i + 1) * sides + j;
      idx.push(a, d, c, a, c, b);
    }
  }
  // Wound outward whichever way the rings run: a mirrored part (the left
  // eye) or one lofted along its axis rather than out from a pole comes out
  // inside-out otherwise, and a front-faced program then draws its inside.
  // The sign of the enclosed volume about the centroid says which it is.
  let mx = 0, my = 0, mz = 0;
  const nP = pos.length / 3;
  for (let k = 0; k < pos.length; k += 3) { mx += pos[k]; my += pos[k + 1]; mz += pos[k + 2]; }
  mx /= nP; my /= nP; mz /= nP;
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
    const ax = pos[a] - mx, ay = pos[a + 1] - my, az = pos[a + 2] - mz;
    const bx = pos[b] - mx, by = pos[b + 1] - my, bz = pos[b + 2] - mz;
    const cx = pos[c] - mx, cy = pos[c + 1] - my, cz = pos[c + 2] - mz;
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  if (vol < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Concatenate indexed geometries carrying position, normal and aVCol. */
function crabMerge(list) {
  const pos = [], nrm = [], col = [], idx = [];
  let base = 0;
  for (const g of list) {
    const P = g.attributes.position.array, Nn = g.attributes.normal.array;
    const C = g.attributes.aVCol.array, I = g.index.array;
    for (let k = 0; k < P.length; k++) { pos.push(P[k]); nrm.push(Nn[k]); col.push(C[k]); }
    for (let k = 0; k < I.length; k++) idx.push(I[k] + base);
    base += P.length / 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/**
 * The carapace, one carapace width across, eyes and all.
 *
 * aVCol carries what the paint needs to know and the instance colour cannot:
 * x is the part (0 shell, 0.5 leg, 1 claw), y how black (the corneas), z how
 * pale (the underside, the claw tips).
 *
 * The outline is a superellipse — Pachygrapsus is very nearly square, broad
 * across the front and straight down the sides — narrowed behind, with the
 * frontal margin dipped between the orbits and ONE tooth on each side behind
 * the eye, which is the field mark of the genus. The dorsal surface is low,
 * and turned down hard at the front.
 */
function crabShellGeo() {
  const A = 0.5, B = 0.43, P = 3.4;
  const outline = (th) => {
    const c = Math.cos(th), s = Math.sin(th);
    const r = 1 / Math.pow(Math.pow(Math.abs(c) / A, P) + Math.pow(Math.abs(s) / B, P), 1 / P);
    let x = r * c, z = -r * s;
    if (z > 0) x *= 1 - 0.20 * (z / B);                         // narrower behind
    if (z < 0) {
      const ax = Math.abs(x);
      z += 0.025 * Math.max(0, 1 - (ax / 0.20) ** 2);            // the front, dipped
      z += 0.028 * Math.exp(-(((ax - 0.29) / 0.035) ** 2));      // the orbit notch
      // The tooth behind the exorbital angle: a sharp outward point on the
      // lateral margin about a third of the way back.
      x += Math.sign(x) * 0.030 * Math.exp(-(((z + 0.25) / 0.030) ** 2)) * sat(ax / 0.35);
    }
    return [x, z];
  };
  // Profile from the crown, over the margin, to the middle of the sternum.
  const PROF = [[0, 0.135], [0.25, 0.132], [0.5, 0.118], [0.7, 0.096], [0.85, 0.068],
    [0.94, 0.040], [0.99, 0.014], [1.0, -0.012], [0.97, -0.040], [0.88, -0.062],
    [0.65, -0.080], [0.35, -0.090], [0.0, -0.094]];
  const SIDES = 48;
  const shell = crabLoft(PROF.length - 1, SIDES, (i, j) => {
    const [rho, y0] = PROF[i];
    const [ox, oz] = outline((j / SIDES) * TAU);
    const x = ox * rho, z = oz * rho;
    let y = y0;
    // Turned down at the front, and the margin with it.
    if (z < 0 && i <= 7) y -= 0.055 * Math.pow(Math.max(0, -z / B), 3);
    // Two shallow bosses behind the front (the gastric region either side of
    // the midline) — what keeps the back from being a plain dome.
    if (i <= 6) y += 0.010 * Math.exp(-(((Math.abs(x) - 0.13) / 0.09) ** 2) - (((z + 0.12) / 0.10) ** 2));
    return [x, y, z];
  }, (i) => [0, 0, i >= 8 ? 0.55 : 0]);
  // The eyes: a short stalk out of each orbit and a black cornea on the end,
  // sitting at the front corners where a grapsid carries them.
  const eyes = [];
  for (const sx of [-1, 1]) {
    const C = [sx * 0.335, 0.060, -0.425];
    eyes.push(crabLoft(6, 8, (i, j) => {
      const th = (i / 6) * Math.PI, ph = (j / 8) * TAU;
      return [C[0] + Math.cos(th) * 0.052 * sx, C[1] + Math.sin(th) * Math.cos(ph) * 0.042,
        C[2] + Math.sin(th) * Math.sin(ph) * 0.044];
    }, (i) => [0, i <= 3 ? 1 : 0.25, 0]));
    eyes.push(crabLoft(3, 7, (i, j) => {
      const k = i / 3, ph = (j / 7) * TAU, r = i === 3 ? 0 : 0.026;
      return [sx * (0.22 + 0.10 * k), 0.045 + 0.012 * k + Math.cos(ph) * r,
        -0.395 - 0.025 * k + Math.sin(ph) * r];
    }, () => [0, 0, 0]));
  }
  // The mouthparts, a dark squarish plate under the front edge.
  const mouth = crabLoft(4, 8, (i, j) => {
    const k = i / 4, ph = (j / 8) * TAU;
    const r = Math.sin(k * Math.PI);
    return [Math.cos(ph) * 0.13 * Math.min(1, r * 1.6), -0.045 + Math.sin(ph) * 0.028 * r,
      -0.33 - 0.07 * k];
  }, () => [0, 0.55, 0]);
  return crabMerge([shell, ...eyes, mouth]);
}

/**
 * A leg segment, one long along +x, one across in y and z, which the instance
 * scale turns into (length, thickness, width). Flat — wider in z than it is
 * thick — because crab legs are, and rounded at both ends into a knuckle.
 */
function crabSegGeo(tip) {
  const R = 9, S = 8;
  return crabLoft(R, S, (i, j) => {
    const k = i / R, ph = (j / S) * TAU;
    let x, r;
    if (tip) {
      x = -0.06 + 1.06 * k;
      r = i === R || i === 0 ? 0 : i === 1 ? 0.62
        : Math.pow(1 - k, 0.75) * (0.95 + 0.1 * Math.sin(k * 3)) + 0.04;
    } else {
      x = -0.06 + 1.12 * k;
      r = i === 0 || i === R ? 0 : (0.70 + 0.30 * Math.sin(Math.PI * clamp((k - 0.08) / 0.84, 0, 1)))
        * Math.sqrt(Math.sin(Math.PI * k));
    }
    // The dactyl curls down at the very end.
    const y = tip ? -0.6 * Math.pow(Math.max(0, k - 0.6), 2) : 0;
    return [x, y + Math.cos(ph) * r * 0.5, Math.sin(ph) * r * 0.5];
  }, () => [0.5, 0, 0]);
}

/**
 * The claw: the palm and the fixed finger in one piece, along +x, one palm
 * length long, with the opening plane in xy (the moving finger above, the
 * fixed one below). Laterally compressed, as a chela is. The tips go pale.
 */
function crabPalmGeo() {
  const R = 16, S = 10;
  return crabLoft(R, S, (i, j) => {
    const k = i / R, ph = (j / S) * TAU;
    const x = -0.04 + 1.04 * k;
    const f = smoothstep(0.46, 0.62, x);                 // palm into fixed finger
    const yc = -0.10 * f + 0.03 * f * sat((x - 0.62) / 0.38);
    let hy = (0.21 + 0.02 * Math.sin(Math.PI * sat(x / 0.55))) * (1 - f) + 0.085 * f * (1 - 0.8 * sat((x - 0.6) / 0.4));
    let hz = 0.135 * (1 - f) + 0.075 * f * (1 - 0.75 * sat((x - 0.6) / 0.4));
    if (i === 0 || i === R) { hy = 0; hz = 0; }
    if (i === 1) { hy *= 0.6; hz *= 0.6; }
    return [x, yc + Math.cos(ph) * hy, Math.sin(ph) * hz];
  }, (i) => [1, 0, smoothstep(0.62, 0.95, i / R) * 0.8]);
}
/** The moving finger (dactyl), from its hinge, closing down on to the fixed one. */
function crabFingerGeo() {
  const R = 10, S = 8;
  return crabLoft(R, S, (i, j) => {
    const k = i / R, ph = (j / S) * TAU;
    const x = -0.02 + 0.48 * k;
    const yc = -0.12 * k * k;
    const r = i === 0 || i === R ? 0 : 1 - 0.8 * k;
    return [x, yc + Math.cos(ph) * 0.075 * r, Math.sin(ph) * 0.062 * r];
  }, (i) => [1, 0, smoothstep(0.35, 0.9, i / R) * 0.8]);
}

/** The paint, shared by all five pieces: one program for the whole population. */
function crabMaterial() {
  return solidMaterial(new THREE.Color(1, 1, 1), {
    instanced: true, spec: 0.22, specPower: 46,
    // Wet chitin: a tight highlight and a little of the sky in it. The marble
    // is drawn in the shell's own coordinates, so it rides with the animal and
    // is the same at any size; the instance colour seeds it, so no two backs
    // carry the same scribble.
    // (NO BACKTICKS IN HERE: this is inside a template literal.)
    body: `
      float sd = dot(vColor, vec3(41.3, 17.7, 29.1));
      vec3 c = vColor;
      if (vVCol.x < 0.25) {
        // The shell: pale wavy lines running across the back, broken and
        // forked, over a mottled ground.
        float w = fbm2(vLocal.xz * 7.0 + vec2(sd, sd * 0.37), 3);
        float s = vLocal.z * 30.0 + (w - 0.5) * 9.0 + abs(vLocal.x) * 4.0;
        float line = 1.0 - smoothstep(0.12, 0.50, abs(sin(s)));
        line *= smoothstep(0.30, 0.55, fbm2(vLocal.xz * 11.0 + sd * 1.7, 2));
        float mott = fbm2(vLocal.xz * 18.0 + sd * 0.9, 2);
        c *= 0.70 + 0.60 * mott;
        c = mix(c, vColor * 2.6 + vec3(0.040, 0.036, 0.004), line * 0.62);
      } else if (vVCol.x < 0.75) {
        // The legs: dark with pale blotches, along the segment.
        float b = vnoise2(vec2(vLocal.x * 5.0 + sd, vLocal.z * 2.0 + sd * 0.3));
        c *= 0.78 + 0.70 * smoothstep(0.58, 0.80, b);
      } else {
        c *= 0.85 + 0.30 * vnoise2(vLocal.xy * 9.0 + sd);
      }
      c = mix(c, vec3(0.42, 0.38, 0.30) * (0.6 + 0.4 * vColor.r * 4.0), vVCol.z);
      c = mix(c, vec3(0.012, 0.010, 0.010), vVCol.y);
      base = c;
      spec = mix(spec, 0.55, vVCol.y);
    `,
  });
}

// ── the population ────────────────────────────────────────────────────────────

/**
 * Where they live, as patches: a rectangle in a frame of its own (`o` the
 * origin, `u` along, `v` across), `u0..u1` by `v0..v1` metres, with how many of
 * each kind. The frames are the structures' own so the rectangles hug them.
 */
function crabPatches(jad) {
  const out = [];
  const add = (name, o, ux, uz, u0, u1, v0, v1, cell, rock, bed) => {
    const L = Math.hypot(ux, uz) || 1;
    ux /= L; uz /= L;
    out.push({ name, ox: o[0], oz: o[1], ux, uz, vx: -uz, vz: ux, u0, u1, v0, v1, cell,
      rock, bed, H: null, nu: 0, nv: 0, crabs: [] });
  };
  // The armouring where the beach becomes the quay: tipped limestone, the
  // tops out of the water and the feet in it. In the shore's own frame, so
  // `v` here is `s` — inland positive.
  if (jad.toWorld) {
    const A = jad.toWorld(203, 0), C = jad.toWorld(205, 0), O = jad.toWorld(204, 0);
    const S = jad.toWorld(204, 1);
    // `v` must be the shore's inland normal: if the frame came out mirrored,
    // swap the along axis so u x v keeps the handedness the bake assumes.
    let ux = C[0] - A[0], uz = C[2] - A[2];
    if ((-uz) * (S[0] - O[0]) + ux * (S[2] - O[2]) < 0) { ux = -ux; uz = -uz; }
    add('armour', [O[0], O[2]], ux, uz, -17, 17, -4.0, 3.6, 0.04, 9, 3);
  }
  // The bathing mole: the stone toe at its head and the foot of both flanks
  // under water. Its own axis, root to head.
  if (jad.mole) {
    const R = jad.mole.root, Hd = jad.mole.head;
    add('mole', [R[0], R[2]], Hd[0] - R[0], Hd[2] - R[2], 8, jad.mole.out + 4.5,
      -(jad.mole.w + 4.5), jad.mole.w + 4.5, 0.05, 3, 9);
  }
  // The two moles off the kabine, which `jad` does not export: their numbers
  // are MOLE's in 43-jadrija.js (root, bearing, length), and only the armour
  // at the heads is wanted.
  for (const [root, face, len, rock, bed] of [[[-1932.3, 473.4], 224.0, 42.8, 4, 2],
    [[-1881.3, 481.9], 178.1, 12.8, 3, 2]]) {
    const br = face * Math.PI / 180;
    add('mole' + Math.round(len), root, Math.sin(br), -Math.cos(br), len - 4.5, len + 4.0,
      -5.0, 5.0, 0.04, rock, bed);
  }
  return out;
}

function buildCrabs(scene, jad) {
  if (!jad) return null;
  const patches = crabPatches(jad);
  if (!patches.length) return null;

  // ── the five pieces ─────────────────────────────────────────────────────
  const mat = crabMaterial();
  const PER = { shell: 1, seg: 20, tip: 8, palm: 2, finger: 2 };
  const CAP = 48;
  const layers = {};
  const geos = { shell: crabShellGeo(), seg: crabSegGeo(false), tip: crabSegGeo(true),
    palm: crabPalmGeo(), finger: crabFingerGeo() };
  for (const k of Object.keys(PER)) {
    const src = geos[k], cap = CAP * PER[k];
    const g = new THREE.InstancedBufferGeometry();
    for (const n of ['position', 'normal', 'aVCol']) g.setAttribute(n, src.attributes[n]);
    g.setIndex(src.index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const a = {
      pos: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      rot: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
      scl: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      col: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    };
    for (const [n, at] of [['aInstPos', a.pos], ['aInstRot', a.rot], ['aInstScale', a.scl], ['aInstColor', a.col]]) {
      at.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(n, at);
    }
    g.instanceCount = 0;
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    layers[k] = { g, a, mesh, n: 0, cap, tris: src.index.count / 3 };
  }

  // ── the surface: one height field per patch, baked on approach ──────────
  //
  // What a foot lands on. The candidate triangles are gathered once, the
  // first time any patch is wanted: every triangle of the shore's concrete,
  // its standing work and its loose stone that comes anywhere near a patch
  // and anywhere near the water. Then each patch rasterises from that list.
  let cand = null, candRock = null;
  function gather() {
    const M = jad.meshes || [];
    // deck, up, and the stones: the first two and the second last of the list
    // `buildJadrija` hands back (see `meshes:` there). Asserted by shape
    // rather than trusted — a stones buffer is non-indexed like the others.
    const floors = [M[0], M[1], M[M.length - 2]].filter((m) => m && m.geometry
      && m.geometry.attributes.position && !m.geometry.index);
    const stones = M[M.length - 2];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const P of patches) {
      for (const [u, v] of [[P.u0, P.v0], [P.u1, P.v0], [P.u0, P.v1], [P.u1, P.v1]]) {
        const x = P.ox + P.ux * u + P.vx * v, z = P.oz + P.uz * u + P.vz * v;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
    }
    const keep = [], rock = [];
    for (const m of floors) {
      const isRock = m === stones ? 1 : 0;
      m.updateMatrixWorld();
      const E = m.matrixWorld.elements;
      const ident = E[0] === 1 && E[5] === 1 && E[10] === 1 && E[12] === 0 && E[13] === 0 && E[14] === 0;
      const A = m.geometry.attributes.position.array;
      for (let i = 0; i < A.length; i += 9) {
        let ax = A[i], ay = A[i + 1], az = A[i + 2], bx = A[i + 3], by = A[i + 4], bz = A[i + 5];
        let cx = A[i + 6], cy = A[i + 7], cz = A[i + 8];
        if (!ident) {
          const tf = (x, y, z) => [E[0] * x + E[4] * y + E[8] * z + E[12],
            E[1] * x + E[5] * y + E[9] * z + E[13], E[2] * x + E[6] * y + E[10] * z + E[14]];
          [ax, ay, az] = tf(ax, ay, az); [bx, by, bz] = tf(bx, by, bz); [cx, cy, cz] = tf(cx, cy, cz);
        }
        if (Math.max(ax, bx, cx) < x0 || Math.min(ax, bx, cx) > x1) continue;
        if (Math.max(az, bz, cz) < z0 || Math.min(az, bz, cz) > z1) continue;
        // Nothing a crab could be under: no awnings, no tables, no parasols.
        if (Math.min(ay, by, cy) > 2.4 || Math.max(ay, by, cy) < -7) continue;
        // Whichever way it is wound — the builders on the shore do not agree
        // about that (a mole's slabs come out with their tops wound downward)
        // and a closed solid's top is the highest of its faces either way. Only
        // the faces with no plan area go: a wall is a line in a height field.
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        if (Math.abs(ny) <= 1e-7) continue;
        keep.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        rock.push(isRock);
      }
    }
    cand = new Float32Array(keep);
    candRock = Uint8Array.from(rock);
  }

  function bake(P) {
    const t0 = performance.now();
    if (!cand) gather();
    const nu = Math.ceil((P.u1 - P.u0) / P.cell) + 1, nv = Math.ceil((P.v1 - P.v0) / P.cell) + 1;
    const H = new Float32Array(nu * nv);
    // And which cells are loose stone rather than concrete or sand: a rock
    // crab is put down on a rock, and goes back to one.
    const RK = new Uint8Array(nu * nv);
    // The terrain first, which is the floor of everything.
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const u = P.u0 + i * P.cell, v = P.v0 + j * P.cell;
        H[j * nu + i] = crabDrawnH(P.ox + P.ux * u + P.vx * v, P.oz + P.uz * u + P.vz * v);
      }
    }
    // Then every candidate triangle that lands in it, highest wins.
    const T = cand, inv = 1 / P.cell;
    let used = 0;
    for (let k = 0; k < T.length; k += 9) {
      const loc = (q) => {
        const dx = T[q] - P.ox, dz = T[q + 2] - P.oz;
        return [(dx * P.ux + dz * P.uz - P.u0) * inv, (dx * P.vx + dz * P.vz - P.v0) * inv, T[q + 1]];
      };
      const a = loc(k), b = loc(k + 3), c = loc(k + 6);
      const i0 = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0])));
      const i1 = Math.min(nu - 1, Math.floor(Math.max(a[0], b[0], c[0])));
      if (i0 > i1) continue;
      const j0 = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1])));
      const j1 = Math.min(nv - 1, Math.floor(Math.max(a[1], b[1], c[1])));
      if (j0 > j1) continue;
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(det) < 1e-9) continue;
      used++;
      const rk = candRock[k / 9];
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const w0 = ((b[1] - c[1]) * (i - c[0]) + (c[0] - b[0]) * (j - c[1])) / det;
          const w1 = ((c[1] - a[1]) * (i - c[0]) + (a[0] - c[0]) * (j - c[1])) / det;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const y = w0 * a[2] + w1 * b[2] + w2 * c[2];
          const q = j * nu + i;
          if (y > H[q]) { H[q] = y; RK[q] = rk; }
        }
      }
    }
    P.H = H; P.RK = RK; P.nu = nu; P.nv = nv;
    let nr = 0;
    for (let q = 0; q < RK.length; q++) nr += RK[q];
    P.rockCells = nr;
    P.bakeMs = performance.now() - t0;
    P.tris = used;
  }

  /** Height of the patch's surface at a world point, or NaN outside it. */
  function hAt(P, x, z) {
    const dx = x - P.ox, dz = z - P.oz;
    const fu = (dx * P.ux + dz * P.uz - P.u0) / P.cell;
    const fv = (dx * P.vx + dz * P.vz - P.v0) / P.cell;
    if (fu < 0 || fv < 0 || fu > P.nu - 1.001 || fv > P.nv - 1.001) return NaN;
    const i = fu | 0, j = fv | 0, a = fu - i, b = fv - j, n = P.nu, H = P.H;
    const q = j * n + i;
    return (H[q] * (1 - a) + H[q + 1] * a) * (1 - b) + (H[q + n] * (1 - a) + H[q + n + 1] * a) * b;
  }
  /** Is the nearest cell to (x, z) loose stone? */
  function onRock(P, x, z) {
    const dx = x - P.ox, dz = z - P.oz;
    const i = Math.round((dx * P.ux + dz * P.uz - P.u0) / P.cell);
    const j = Math.round((dx * P.vx + dz * P.vz - P.v0) / P.cell);
    if (i < 0 || j < 0 || i >= P.nu || j >= P.nv) return false;
    return P.RK[j * P.nu + i] === 1;
  }
  /** Inside the patch by at least `m` metres. */
  function inside(P, x, z, m) {
    const dx = x - P.ox, dz = z - P.oz;
    const u = dx * P.ux + dz * P.uz, v = dx * P.vx + dz * P.vz;
    return u > P.u0 + m && u < P.u1 - m && v > P.v0 + m && v < P.v1 - m;
  }
  function centre(P) {
    const u = (P.u0 + P.u1) / 2, v = (P.v0 + P.v1) / 2;
    return [P.ox + P.ux * u + P.vx * v, P.oz + P.uz * u + P.vz * v,
      Math.hypot(P.u1 - P.u0, P.v1 - P.v0) / 2];
  }
  for (const P of patches) P.c = centre(P);

  // ── one crab ─────────────────────────────────────────────────────────────
  let serial = 0;
  const all = [];
  /** Is (x, z) somewhere this crab may stand, coming from (fx, fz)? */
  function ok(c, x, z, fleeing) {
    const P = c.P;
    if (!inside(P, x, z, 0.12)) return false;
    const h = hAt(P, x, z);
    if (!(h === h)) return false;
    const band = fleeing && c.kind === 'rock' ? CRAB.band.flight : CRAB.band[c.kind];
    if (h < band[0] || h > band[1]) return false;
    // Not up a wall: what a crab can get its legs over, measured a leg's
    // length either side. Over about fifty degrees the surface stops being
    // something a foot can be put down on in this model, so it is a wall.
    const e = c.cw * 0.7;
    const hx = hAt(P, x + e, z) - hAt(P, x - e, z), hz = hAt(P, x, z + e) - hAt(P, x, z - e);
    if (!(hx === hx) || !(hz === hz)) return false;
    return Math.hypot(hx, hz) / (2 * e) < 1.25;
  }
  function makeCrab(P, kind, k) {
    const id = serial++;
    const rnd = mulberry32(0x5c4ab ^ Math.imul(id + 1, 0x9e3779b1));
    let x = 0, z = 0, found = false;
    const c = { id, P, kind, cw: lerp(CRAB.cw[0], CRAB.cw[1], Math.pow(rnd(), 1.4)), rnd };
    for (let t = 0; t < 400 && !found; t++) {
      const u = lerp(P.u0, P.u1, rnd()), v = lerp(P.v0, P.v1, rnd());
      x = P.ox + P.ux * u + P.vx * v; z = P.oz + P.uz * u + P.vz * v;
      // Spawn a little inside the band, so a crab does not start on its edge.
      const h = hAt(P, x, z);
      const band = CRAB.band[kind];
      // A rock crab on a rock, where the patch has any — three tries in four.
      const rocky = kind !== 'rock' || P.rockCells < 50 || t > 300 || onRock(P, x, z);
      if (rocky && h > band[0] + 0.08 && h < band[1] - 0.10 && ok(c, x, z, false)) found = true;
    }
    if (!found) return null;
    // Two colourings, olive-brown and purple-brown, and everything between.
    const t = rnd(), dk = 0.75 + 0.5 * rnd();
    c.col = [lerp(0.125, 0.150, t) * dk, lerp(0.105, 0.072, t) * dk, lerp(0.050, 0.078, t) * dk];
    c.bold = rnd() < 0.3;
    c.picky = rnd() < 0.75;
    Object.assign(c, {
      x, z, y: hAt(P, x, z) + CRAB.clear * c.cw, yaw: rnd() * TAU, hx: x, hz: z,
      nx: 0, ny: 1, nz: 0, vx: 0, vz: 0, sp: 0,
      mode: 'idle', timer: 1 + rnd() * 6, tx: x, tz: z, dx: 0, dz: 0, side: 1,
      raise: 0, open: 0, pick: 0, pickPh: rnd() * TAU, crouch: 0,
      feet: new Float32Array(24), from: new Float32Array(24), swing: new Float32Array(8).fill(-1),
      sd: 0.15, live: false, clackAt: 0, scared: 0, tag: P.name + ':' + k,
    });
    plantAll(c);
    return c;
  }

  // ── the body frame ───────────────────────────────────────────────────────
  // R right, U up, F forward, all world; filled per crab per frame.
  const R = [0, 0, 0], U = [0, 1, 0], F = [0, 0, -1];
  function frame(c) {
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    U[0] = c.nx; U[1] = c.ny; U[2] = c.nz;
    const d = fx * U[0] + fz * U[2];
    F[0] = fx - U[0] * d; F[1] = -U[1] * d; F[2] = fz - U[2] * d;
    const l = Math.hypot(F[0], F[1], F[2]) || 1;
    F[0] /= l; F[1] /= l; F[2] /= l;
    R[0] = F[1] * U[2] - F[2] * U[1];
    R[1] = F[2] * U[0] - F[0] * U[2];
    R[2] = F[0] * U[1] - F[1] * U[0];
  }
  /** Crab-local (carapace widths) to world, into `o`. */
  function toW(c, lx, ly, lz, o) {
    const s = c.cw;
    o[0] = c.x + (R[0] * lx + U[0] * ly - F[0] * lz) * s;
    o[1] = c.y + (R[1] * lx + U[1] * ly - F[1] * lz) * s;
    o[2] = c.z + (R[2] * lx + U[2] * ly - F[2] * lz) * s;
    return o;
  }
  const _h = [0, 0, 0];
  /** Where leg i wants its foot now, plus `lead` seconds of travel. */
  function home(c, i, lead, o) {
    const L = CRAB_LEGS[i >> 1], sx = (i & 1) ? -1 : 1;
    const reach = L.reach * (1 - 0.18 * c.crouch);
    toW(c, sx * (L.r[0] + Math.cos(L.a) * reach), 0, L.r[2] - Math.sin(L.a) * reach, o);
    o[0] += c.vx * lead; o[2] += c.vz * lead;
    const h = hAt(c.P, o[0], o[2]);
    o[1] = (h === h ? h : o[1] - CRAB.clear * c.cw) + 0.0015;
    return o;
  }
  function plantAll(c) {
    frame(c);
    for (let i = 0; i < 8; i++) {
      home(c, i, 0, _h);
      c.feet[i * 3] = _h[0]; c.feet[i * 3 + 1] = _h[1]; c.feet[i * 3 + 2] = _h[2];
      c.swing[i] = -1;
    }
  }

  // ── behaviour ────────────────────────────────────────────────────────────
  /** Turn the leading side of the crab toward (dx, dz): crabs go sideways. */
  function sideOn(c, dx, dz, rate, dt) {
    // Right side leading: right = (cos y, -sin y) = (dx, dz).
    const yR = Math.atan2(-dz, dx), yL = Math.atan2(dz, -dx);
    const eR = Math.abs(angleDelta(c.yaw, yR)), eL = Math.abs(angleDelta(c.yaw, yL));
    // Keep the side it is already leading with unless the other is much nearer.
    const want = (c.side > 0 ? eR < eL + 0.6 : eR + 0.6 < eL) ? yR : yL;
    c.side = want === yR ? 1 : -1;
    c.yaw += clamp(angleDelta(c.yaw, want), -rate * dt, rate * dt);
  }
  function face(c, x, z, rate, dt) {
    const want = Math.atan2(-(x - c.x), -(z - c.z));
    c.yaw += clamp(angleDelta(c.yaw, want), -rate * dt, rate * dt);
  }
  /**
   * The best way out, away from (sx, sz): straight away if that is open, and
   * otherwise the nearest open bearing either side of it — down toward the
   * water preferred, because that is where a rock crab goes.
   */
  function escape(c, sx, sz) {
    let ax = c.x - sx, az = c.z - sz;
    const l = Math.hypot(ax, az) || 1;
    ax /= l; az /= l;
    const look = Math.max(0.07, c.cw * 2.2);
    let best = null, bs = -Infinity;
    const h0 = hAt(c.P, c.x, c.z);
    for (const a of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.75, -1.75]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const dx = ax * ca - az * sa, dz = ax * sa + az * ca;
      const x = c.x + dx * look, z = c.z + dz * look;
      // Both the stride the move will test and the look further on, or the
      // crab picks a way out it is then not allowed to take and stalls.
      if (!ok(c, x, z, true) || !ok(c, c.x + dx * c.cw * 1.2, c.z + dz * c.cw * 1.2, true)) continue;
      const down = h0 - hAt(c.P, x, z);
      const sc = Math.cos(a) + (c.kind === 'rock' ? 3.0 * down / look : 0);
      if (sc > bs) { bs = sc; best = [dx, dz]; }
    }
    return best;
  }

  function think(c, dt, threat, hose) {
    c.timer -= dt;
    // What is after it, if anything.
    let src = null, dT = Infinity;
    if (threat) {
      dT = Math.hypot(threat.x - c.x, threat.z - c.z, (threat.y - c.y) * 0.6);
    }
    if (hose) {
      const dH = Math.hypot(hose[0] - c.x, hose[2] - c.z);
      if (dH < CRAB.hose && Math.abs(hose[1] - c.y) < 1.5) src = [hose[0], hose[2], 'hose'];
    }
    const near = c.bold ? CRAB.bold : CRAB.flee;
    if (!src && dT < near) src = [threat.x, threat.z, 'you'];
    c.raiseT = 0; c.openT = 0; c.pickT = 0;
    let want = 0, dx = 0, dz = 0;

    if (src) {
      // Off. Re-aimed every frame, because whatever it is running from moves.
      const e = escape(c, src[0], src[1]);
      if (e) {
        if (c.mode !== 'flee') { c.timer = 1.0 + c.rnd() * 1.6; c.sprint = lerp(CRAB.sprint[0], CRAB.sprint[1], c.rnd()); }
        c.mode = 'flee'; c.scared = src[2];
        dx = e[0]; dz = e[1]; want = c.sprint;
        sideOn(c, dx, dz, 14, dt);
      } else {
        // Cornered: nowhere to go, so it turns on you with both claws up.
        c.mode = 'guard'; c.timer = 2.5;
        face(c, src[0], src[1], 10, dt);
        c.raiseT = 1; c.openT = 1;
      }
    } else if (c.mode === 'flee') {
      // Still running for a moment after it is out of reach, and then down.
      const e = escape(c, c.x - c.dx, c.z - c.dz);
      if (c.timer > 0 && e) { dx = e[0]; dz = e[1]; want = c.sprint * 0.8; sideOn(c, dx, dz, 10, dt); } else {
        c.mode = 'hide'; c.timer = 5 + c.rnd() * 10;
      }
    } else if (threat && dT < CRAB.alert && c.mode !== 'hide') {
      // Watching you: stopped, turned to face, claws coming up. A bold one in
      // its last metre before it bolts holds them right up and open.
      if (c.mode !== 'alert') c.mode = 'alert';
      face(c, threat.x, threat.z, 6, dt);
      c.raiseT = dT < CRAB.flee ? 1 : 0.55;
      c.openT = dT < CRAB.flee ? 1 : 0.3;
    } else if (c.mode === 'hide') {
      // Pressed down in its crack. It comes out when nothing has been near it
      // for the whole wait.
      if (threat && dT < CRAB.flee + 1.5) c.timer = Math.max(c.timer, 2.5);
      if (c.timer <= 0) { c.mode = 'walk'; c.tx = c.hx; c.tz = c.hz; c.stroll = lerp(CRAB.stroll[0], CRAB.stroll[1], c.rnd()); }
    } else if (c.mode === 'alert' || c.mode === 'guard') {
      // A cornered crab keeps its claws up for a while after the threat goes.
      if (c.mode === 'guard' && c.timer > 0) { c.raiseT = 1; c.openT = 1; } else {
        c.mode = 'idle'; c.timer = 1 + c.rnd() * 3;
      }
    } else if (c.mode === 'walk') {
      const ex = c.tx - c.x, ez = c.tz - c.z, d = Math.hypot(ex, ez);
      if (d < 0.015 || c.timer < -25) {
        c.mode = 'idle'; c.timer = 2 + c.rnd() * 8;
      } else {
        dx = ex / d; dz = ez / d; want = c.stroll * Math.min(1, d / 0.05 + 0.3);
        if (c.diag) sideOn(c, dx * Math.cos(c.diag) - dz * Math.sin(c.diag),
          dx * Math.sin(c.diag) + dz * Math.cos(c.diag), 3, dt);
        else sideOn(c, dx, dz, 3, dt);
      }
    } else {
      // Idle: picking at the rock, one claw and then the other, with pauses.
      if (c.picky) c.pickT = 1;
      if (c.timer <= 0) {
        const r = c.rnd();
        let tx = c.x, tz = c.z;
        // Mostly short wanders, sometimes a shuffle, sometimes home.
        const far = r < 0.25 ? 0.06 : r < 0.85 ? 0.25 + c.rnd() * 1.2 : -1;
        if (far < 0) { tx = c.hx; tz = c.hz; } else {
          const a = c.rnd() * TAU;
          tx = c.x + Math.cos(a) * far; tz = c.z + Math.sin(a) * far;
        }
        // And back toward stone, given the choice.
        if (far > 0.1 && c.kind === 'rock' && c.P.rockCells > 50 && !onRock(c.P, tx, tz) && c.rnd() < 0.7) {
          tx = c.x; tz = c.z;
        }
        if ((tx !== c.x || tz !== c.z) && ok(c, tx, tz, false)) {
          c.mode = 'walk'; c.tx = tx; c.tz = tz; c.timer = 0;
          c.stroll = lerp(CRAB.stroll[0], CRAB.stroll[1], c.rnd()) * (far > 0 && far < 0.1 ? 0.5 : 1);
          c.diag = (c.rnd() - 0.5) * 0.7;
        } else {
          c.timer = 0.5 + c.rnd();
        }
      }
    }
    // Move, unless the ground ahead will not have it.
    if (want > 0) {
      c.dx = dx; c.dz = dz;
      // Do not run up to full speed in one frame, and do not stop in one either.
      c.sp = damp(c.sp, want, c.mode === 'flee' ? 18 : 5, dt);
    } else {
      c.sp = damp(c.sp, 0, 12, dt);
    }
    if (c.sp > 1e-4) {
      const nx = c.x + c.dx * c.sp * dt, nz = c.z + c.dz * c.sp * dt;
      const ahead = Math.max(0.03, c.cw * 1.2);
      if (ok(c, nx, nz, c.mode === 'flee') && ok(c, c.x + c.dx * ahead, c.z + c.dz * ahead, c.mode === 'flee')) {
        c.vx = (nx - c.x) / dt; c.vz = (nz - c.z) / dt;
        c.x = nx; c.z = nz;
      } else {
        c.vx = 0; c.vz = 0; c.sp = 0;
        if (c.mode === 'walk') { c.mode = 'idle'; c.timer = 0.5 + c.rnd() * 2; }
        // Run into a crack with nowhere further to go: that is where it hides.
        if (c.mode === 'flee' && !src) { c.mode = 'hide'; c.timer = 5 + c.rnd() * 10; }
      }
    } else {
      c.vx = 0; c.vz = 0;
    }
    c.crouch = damp(c.crouch, c.mode === 'hide' ? 1 : 0, 6, dt);
  }

  // ── the body over its feet ───────────────────────────────────────────────
  function settle(c, dt) {
    const e = c.cw * 0.55, P = c.P;
    const h0 = hAt(P, c.x, c.z);
    const hx = hAt(P, c.x + e, c.z) - hAt(P, c.x - e, c.z);
    const hz = hAt(P, c.x, c.z + e) - hAt(P, c.x, c.z - e);
    // The ground's normal under it, eased toward upright so a crab on a knobbly
    // rock does not rock with every knob — and capped at 40 degrees.
    let nx = -hx / (2 * e) * 0.75, nz = -hz / (2 * e) * 0.75;
    const t = Math.hypot(nx, nz);
    if (t > 0.84) { nx *= 0.84 / t; nz *= 0.84 / t; }
    let ny = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const k = 1 - Math.exp(-10 * dt);
    c.nx += (nx - c.nx) * k; c.ny += (ny - c.ny) * k; c.nz += (nz - c.nz) * k;
    const m = Math.hypot(c.nx, c.ny, c.nz);
    c.nx /= m; c.ny /= m; c.nz /= m;
    // Height: between the ground under it and the mean of where its feet are.
    let fy = 0;
    for (let i = 0; i < 8; i++) fy += c.feet[i * 3 + 1];
    fy /= 8;
    const g = 0.45 * h0 + 0.55 * fy;
    const want = g + CRAB.clear * c.cw * (1 - 0.55 * c.crouch);
    c.y = c.live ? damp(c.y, want, 16, dt) : want;
  }

  // ── the legs ─────────────────────────────────────────────────────────────
  const _r = [0, 0, 0], _j = [0, 0, 0], _k = [0, 0, 0], _f = [0, 0, 0], _t = [0, 0, 0];
  let clacks = 0, clackT = 0;
  const _sw = [0, 0], _err = new Float32Array(8);
  function stepLegs(c, dt, onClack) {
    const sp = Math.hypot(c.vx, c.vz);
    c.sd = clamp(0.20 - sp * 0.26, 0.05, 0.20);
    const lead = c.sd * 1.4;
    const thr = c.cw * 0.22;
    const swinging = _sw;
    swinging[0] = 0; swinging[1] = 0;
    const err = _err;
    let worst0 = 0, worst1 = 0;
    for (let i = 0; i < 8; i++) {
      const g = ((i >> 1) + (i & 1) + 1) % 2;      // L1 R2 L3 R4 against the rest
      if (c.swing[i] >= 0) { swinging[g]++; continue; }
      home(c, i, lead, _h);
      const ex = c.feet[i * 3] - _h[0], ez = c.feet[i * 3 + 2] - _h[2];
      err[i] = Math.hypot(ex, ez);
      if (g === 0) worst0 = Math.max(worst0, err[i]); else worst1 = Math.max(worst1, err[i]);
    }
    // Start a group only when the other is down — that is the gait.
    const order = worst0 >= worst1 ? [0, 1] : [1, 0];
    for (const g of order) {
      if (swinging[0] || swinging[1]) break;
      if ((g === 0 ? worst0 : worst1) < thr) continue;
      for (let i = 0; i < 8; i++) {
        if (((i >> 1) + (i & 1) + 1) % 2 !== g || err[i] < thr * 0.3) continue;
        c.swing[i] = 0;
        c.from[i * 3] = c.feet[i * 3]; c.from[i * 3 + 1] = c.feet[i * 3 + 1]; c.from[i * 3 + 2] = c.feet[i * 3 + 2];
        swinging[g]++;
      }
    }
    // Swing: lift, carry and put down where the foot is wanted now, which is
    // re-asked every frame so a turning crab lands its foot where it ends up.
    const lift = c.cw * (0.20 + 0.16 * Math.min(1, sp / 0.4));
    for (let i = 0; i < 8; i++) {
      if (c.swing[i] < 0) continue;
      c.swing[i] = Math.min(1, c.swing[i] + dt / c.sd);
      const p = c.swing[i], e = p * p * (3 - 2 * p);
      home(c, i, lead * (1 - p), _h);
      const ar = Math.sin(Math.PI * p) * lift;
      c.feet[i * 3] = lerp(c.from[i * 3], _h[0], e) + U[0] * ar;
      c.feet[i * 3 + 1] = lerp(c.from[i * 3 + 1], _h[1], e) + U[1] * ar;
      c.feet[i * 3 + 2] = lerp(c.from[i * 3 + 2], _h[2], e) + U[2] * ar;
      if (p >= 1) {
        c.swing[i] = -1;
        c.feet[i * 3] = _h[0]; c.feet[i * 3 + 1] = _h[1]; c.feet[i * 3 + 2] = _h[2];
        // The tick of a dactyl on stone, above the water and near enough to hear.
        if (onClack && _h[1] > 0.03 && c.dist < 4.5 && clackT <= 0 && sp > 0.02) {
          onClack(c, sp);
          clackT = 0.035 + Math.random() * 0.05;
          clacks++;
        }
      }
    }
  }

  // ── posing into the instance buffers ─────────────────────────────────────
  /** Quaternion of the basis with columns X, Y, Z, into array `o` at `q`. */
  function quatBasis(o, q, xx, xy, xz, yx, yy, yz, zx, zy, zz) {
    const tr = xx + yy + zz;
    let x, y, z, w;
    if (tr > 0) {
      const s = 0.5 / Math.sqrt(tr + 1);
      w = 0.25 / s; x = (yz - zy) * s; y = (zx - xz) * s; z = (xy - yx) * s;
    } else if (xx > yy && xx > zz) {
      const s = 2 * Math.sqrt(1 + xx - yy - zz);
      w = (yz - zy) / s; x = 0.25 * s; y = (yx + xy) / s; z = (zx + xz) / s;
    } else if (yy > zz) {
      const s = 2 * Math.sqrt(1 + yy - xx - zz);
      w = (zx - xz) / s; x = (yx + xy) / s; y = 0.25 * s; z = (zy + yz) / s;
    } else {
      const s = 2 * Math.sqrt(1 + zz - xx - yy);
      w = (xy - yx) / s; x = (zx + xz) / s; y = (zy + yz) / s; z = 0.25 * s;
    }
    o[q] = x; o[q + 1] = y; o[q + 2] = z; o[q + 3] = w;
  }
  function put(L, px, py, pz, sx, sy, sz, col) {
    if (L.n >= L.cap) return -1;
    const i = L.n++;
    const A = L.a;
    A.pos.array[i * 3] = px; A.pos.array[i * 3 + 1] = py; A.pos.array[i * 3 + 2] = pz;
    A.scl.array[i * 3] = sx; A.scl.array[i * 3 + 1] = sy; A.scl.array[i * 3 + 2] = sz;
    A.col.array[i * 3] = col[0]; A.col.array[i * 3 + 1] = col[1]; A.col.array[i * 3 + 2] = col[2];
    return i;
  }
  /** A segment from A to B, flat face turned to `up`, `th` thick and `wd` wide. */
  function seg(L, A, B, up, th, wd, col) {
    let xx = B[0] - A[0], xy = B[1] - A[1], xz = B[2] - A[2];
    const len = Math.hypot(xx, xy, xz) || 1e-6;
    xx /= len; xy /= len; xz /= len;
    let zx = xy * up[2] - xz * up[1], zy = xz * up[0] - xx * up[2], zz = xx * up[1] - xy * up[0];
    let zl = Math.hypot(zx, zy, zz);
    if (zl < 1e-5) { zx = R[0]; zy = R[1]; zz = R[2]; zl = 1; }
    zx /= zl; zy /= zl; zz /= zl;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const i = put(L, A[0], A[1], A[2], len, th, wd, col);
    if (i >= 0) quatBasis(L.a.rot.array, i * 4, xx, xy, xz, yx, yy, yz, zx, zy, zz);
  }
  /**
   * Two-bone solve: root A, target T, lengths a and b, the knee toward `pole`.
   * Writes the knee into K. If T is out of reach the leg points at it.
   */
  function ik2(A, T, a, b, pole, K) {
    let dx = T[0] - A[0], dy = T[1] - A[1], dz = T[2] - A[2];
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    dx /= d; dy /= d; dz /= d;
    const dc = clamp(d, Math.abs(a - b) * 1.02 + 1e-6, (a + b) * 0.999);
    const ca = clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const pd = pole[0] * dx + pole[1] * dy + pole[2] * dz;
    let qx = pole[0] - dx * pd, qy = pole[1] - dy * pd, qz = pole[2] - dz * pd;
    const ql = Math.hypot(qx, qy, qz) || 1;
    qx /= ql; qy /= ql; qz /= ql;
    K[0] = A[0] + (dx * ca + qx * sa) * a;
    K[1] = A[1] + (dy * ca + qy * sa) * a;
    K[2] = A[2] + (dz * ca + qz * sa) * a;
  }
  const _pole = [0, 0, 0], _e = [0, 0, 0], _w = [0, 0, 0], _c = [0, 0, 0], _p = [0, 0, 0];
  const legCol = [0, 0, 0];
  function draw(c) {
    const s = c.cw, col = c.col;
    // Shell.
    const i = put(layers.shell, c.x, c.y, c.z, s, s, s, col);
    if (i >= 0) quatBasis(layers.shell.a.rot.array, i * 4, R[0], R[1], R[2], U[0], U[1], U[2], -F[0], -F[1], -F[2]);
    legCol[0] = col[0] * 1.15; legCol[1] = col[1] * 1.1; legCol[2] = col[2] * 1.05;
    // Walking legs.
    for (let k = 0; k < 8; k++) {
      const L = CRAB_LEGS[k >> 1], sx = (k & 1) ? -1 : 1;
      toW(c, sx * L.r[0], L.r[1], L.r[2], _r);
      _f[0] = c.feet[k * 3]; _f[1] = c.feet[k * 3 + 1]; _f[2] = c.feet[k * 3 + 2];
      // The coxa swings in yaw toward the foot, a little down.
      let hx = _f[0] - _r[0], hy = _f[1] - _r[1], hz = _f[2] - _r[2];
      const d = hx * U[0] + hy * U[1] + hz * U[2];
      hx -= U[0] * d; hy -= U[1] * d; hz -= U[2] * d;
      const hl = Math.hypot(hx, hy, hz) || 1;
      hx /= hl; hy /= hl; hz /= hl;
      const cl = L.c * s;
      _j[0] = _r[0] + (hx * 0.96 - U[0] * 0.28) * cl;
      _j[1] = _r[1] + (hy * 0.96 - U[1] * 0.28) * cl;
      _j[2] = _r[2] + (hz * 0.96 - U[2] * 0.28) * cl;
      // Knee up, and a touch outward.
      _pole[0] = U[0] + hx * 0.25; _pole[1] = U[1] + hy * 0.25; _pole[2] = U[2] + hz * 0.25;
      ik2(_j, _f, L.m * s, L.t * s, _pole, _k);
      seg(layers.seg, _r, _j, U, 0.10 * s, 0.13 * s, legCol);
      seg(layers.seg, _j, _k, U, 0.085 * s, 0.19 * s, legCol);
      // The rest of the leg ends at the foot or as near as it reaches.
      let tx = _f[0] - _k[0], ty = _f[1] - _k[1], tz = _f[2] - _k[2];
      const tl = Math.hypot(tx, ty, tz) || 1, tb = L.t * s;
      _t[0] = _k[0] + tx / tl * tb; _t[1] = _k[1] + ty / tl * tb; _t[2] = _k[2] + tz / tl * tb;
      seg(layers.tip, _k, _t, U, 0.075 * s, 0.13 * s, legCol);
    }
    // Claws.
    const A = CRAB_ARM;
    for (const sx of [1, -1]) {
      const pk = sx > 0 ? Math.max(0, Math.sin(c.pickPh)) : Math.max(0, Math.sin(c.pickPh + Math.PI));
      const pick = c.pick * pk * pk * (1 - c.raise);
      const r = c.raise, tuck = c.crouch;
      // Wrist: folded in front of the mouth, or up and out, or down at the rock.
      let wx = lerp(0.25, 0.60, r), wy = lerp(-0.07, 0.24, r), wz = lerp(-0.56, -0.46, r);
      wx = lerp(wx, 0.30, pick); wy = lerp(wy, -0.02, pick); wz = lerp(wz, -0.70, pick);
      wy -= 0.06 * tuck; wz += 0.06 * tuck;
      let px = lerp(-0.62, 0.30, r), py = lerp(-0.22, 0.78, r), pz = lerp(-0.62, -0.46, r);
      px = lerp(px, -0.05, pick); py = lerp(py, -0.85, pick); pz = lerp(pz, -0.45, pick);
      const pl = Math.hypot(px, py, pz) || 1;
      toW(c, sx * A.r[0], A.r[1], A.r[2], _r);
      toW(c, sx * wx, wy, wz, _w);
      // Elbow out and up, the way a chela folds.
      _pole[0] = R[0] * sx + U[0] * 0.7 + F[0] * 0.2;
      _pole[1] = R[1] * sx + U[1] * 0.7 + F[1] * 0.2;
      _pole[2] = R[2] * sx + U[2] * 0.7 + F[2] * 0.2;
      ik2(_r, _w, A.m * s, A.c * s, _pole, _e);
      seg(layers.seg, _r, _e, U, 0.11 * s, 0.15 * s, col);
      seg(layers.seg, _e, _w, U, 0.13 * s, 0.15 * s, col);
      // The palm, along its direction, its opening plane turned up and out.
      const X = [(R[0] * sx * px + U[0] * py - F[0] * pz) / pl, (R[1] * sx * px + U[1] * py - F[1] * pz) / pl,
        (R[2] * sx * px + U[2] * py - F[2] * pz) / pl];
      let yx = U[0] + R[0] * sx * 0.35 - F[0] * 0.2, yy = U[1] + R[1] * sx * 0.35 - F[1] * 0.2;
      let yz = U[2] + R[2] * sx * 0.35 - F[2] * 0.2;
      const yd = yx * X[0] + yy * X[1] + yz * X[2];
      yx -= X[0] * yd; yy -= X[1] * yd; yz -= X[2] * yd;
      const yl = Math.hypot(yx, yy, yz) || 1;
      yx /= yl; yy /= yl; yz /= yl;
      const zx = X[1] * yz - X[2] * yy, zy = X[2] * yx - X[0] * yz, zz = X[0] * yy - X[1] * yx;
      const Lp = A.palm * s;
      const ip = put(layers.palm, _w[0], _w[1], _w[2], Lp, Lp, Lp, col);
      if (ip >= 0) quatBasis(layers.palm.a.rot.array, ip * 4, X[0], X[1], X[2], yx, yy, yz, zx, zy, zz);
      // The finger, hinged at the top of the palm and opened in its plane.
      const th = (0.06 + 0.55 * c.open + 0.30 * pick * (1 - pk)) * 0.9;
      const ct = Math.cos(th), st = Math.sin(th);
      const fx = X[0] * ct + yx * st, fy = X[1] * ct + yy * st, fz = X[2] * ct + yz * st;
      const gx = -X[0] * st + yx * ct, gy = -X[1] * st + yy * ct, gz = -X[2] * st + yz * ct;
      _p[0] = _w[0] + (X[0] * 0.56 + yx * 0.10) * Lp;
      _p[1] = _w[1] + (X[1] * 0.56 + yy * 0.10) * Lp;
      _p[2] = _w[2] + (X[2] * 0.56 + yz * 0.10) * Lp;
      const iF = put(layers.finger, _p[0], _p[1], _p[2], Lp, Lp, Lp, col);
      if (iF >= 0) quatBasis(layers.finger.a.rot.array, iF * 4, fx, fy, fz, gx, gy, gz, zx, zy, zz);
    }
  }

  // ── the frame ────────────────────────────────────────────────────────────
  let frozen = false;
  const stats = { live: 0, made: 0, ms: 0, msMax: 0, baked: 0, bakeMs: 0 };
  const _cam = new THREE.Vector3();
  /**
   * @param threat  {x, y, z} of you — the walker or the swimmer, not the camera
   * @param hose    [x, y, z] where the jet is landing, or null
   * @param onClack (crab, speed) => void, for the sound
   */
  function update(dt, camera, threat, hose, onClack) {
    const t0 = performance.now();
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    // Bake and people a patch the first time the eye comes near it.
    for (const P of patches) {
      if (P.made) continue;
      if (Math.hypot(P.c[0] - cx, P.c[1] - cz) - P.c[2] > CRAB.spawn) continue;
      if (!P.H) { bake(P); stats.baked++; stats.bakeMs += P.bakeMs; }
      P.made = true;
      for (let k = 0; k < P.rock; k++) { const c = makeCrab(P, 'rock', k); if (c) { P.crabs.push(c); all.push(c); } }
      for (let k = 0; k < P.bed; k++) { const c = makeCrab(P, 'bed', P.rock + k); if (c) { P.crabs.push(c); all.push(c); } }
      stats.made = all.length;
    }
    for (const k in layers) layers[k].n = 0;
    const step = Math.min(dt, 1 / 20);
    clackT -= dt;
    let live = 0;
    for (const c of all) {
      c.dist = Math.hypot(c.x - cx, c.y - cy, c.z - cz);
      const was = c.live;
      c.live = c.dist < CRAB.live;
      if (!c.live) continue;
      live++;
      if (!frozen && step > 0) {
        // A crab coming back into range after you have been away has had all
        // that time to wander — start it where it was, feet under it.
        if (!was) plantAll(c);
        think(c, step, threat, hose);
        c.raise = damp(c.raise, c.raiseT, c.raiseT > c.raise ? 9 : 4, step);
        c.open = damp(c.open, c.openT, 8, step);
        c.pick = damp(c.pick, c.pickT, 3, step);
        c.pickPh += step * (c.pickT > 0.5 ? 4.2 + (c.id % 5) * 0.4 : 0);
        frame(c);
        settle(c, step);
        stepLegs(c, step, onClack);
      }
      frame(c);
      draw(c);
    }
    for (const k in layers) {
      const L = layers[k];
      L.g.instanceCount = L.n;
      L.mesh.visible = L.n > 0;
      if (L.n) {
        for (const n of ['pos', 'rot', 'scl', 'col']) {
          const at = L.a[n];
          at.clearUpdateRanges();
          at.addUpdateRange(0, L.n * at.itemSize);
          at.needsUpdate = true;
        }
      }
    }
    stats.live = live;
    stats.ms = performance.now() - t0;
    stats.msMax = Math.max(stats.msMax * 0.995, stats.ms);
    stats.msAvg = stats.msAvg == null ? stats.ms : stats.msAvg + (stats.ms - stats.msAvg) * 0.02;
  }

  /**
   * The nearest crab in front of the lens, for the near plane: a crab a metre
   * from your eye is inside the world's 1.2 m front plane and is simply not
   * drawn — see `dogNear` in 90-app.js, which is the same question asked of a
   * dog. Null when none is close, which is nearly always.
   */
  function lensNear(camera) {
    camera.getWorldDirection(_cam);
    let best = null;
    for (const c of all) {
      if (!c.live || c.dist > 1.6) continue;
      const dx = c.x - camera.position.x, dy = c.y - camera.position.y, dz = c.z - camera.position.z;
      if (dx * _cam.x + dy * _cam.y + dz * _cam.z < 0) continue;
      const d = c.dist - c.cw * 1.4;
      if (best == null || d < best) best = d;
    }
    return best;
  }

  // Baked now, while the world is loading, rather than the first time you
  // walk up to one: it is tens of milliseconds all told, which is nothing in
  // a loading screen and a visible hitch on the promenade.
  {
    const t0 = performance.now();
    for (const P of patches) { bake(P); stats.baked++; }
    stats.bakeMs = performance.now() - t0;
  }

  return {
    update, lensNear,
    stats: () => ({ ...stats, all: all.length, clacks,
      patches: patches.map((P) => ({ name: P.name, baked: !!P.H, ms: P.bakeMs ? +P.bakeMs.toFixed(1) : 0,
        tris: P.tris || 0, crabs: P.crabs.length, cells: P.H ? P.nu * P.nv : 0, rock: P.rockCells || 0 })),
      draws: Object.values(layers).filter((L) => L.n).length,
      tris: Object.values(layers).reduce((n, L) => n + L.n * L.tris, 0),
      ms: +stats.ms.toFixed(3), msAvg: +(stats.msAvg || 0).toFixed(3) }),
    list: () => all.map((c) => ({ i: all.indexOf(c), tag: c.tag, kind: c.kind, mode: c.mode,
      cw: +c.cw.toFixed(3), x: +c.x.toFixed(2), y: +c.y.toFixed(3), z: +c.z.toFixed(2),
      yaw: +c.yaw.toFixed(2), live: c.live, dist: c.dist != null ? +c.dist.toFixed(1) : null,
      raise: +c.raise.toFixed(2), sp: +c.sp.toFixed(3), bold: c.bold })),
    raw: () => ({ all, patches, layers }),
    /** Send crab `i` (or every live crab, for i < 0) running from (x, z). */
    flee: (i, x, z) => {
      for (const c of i < 0 ? all.filter((q) => q.live) : [all[i]]) {
        if (!c) continue;
        const e = escape(c, x, z);
        if (!e) continue;
        c.mode = 'flee'; c.timer = 1.5; c.sprint = CRAB.sprint[1]; c.dx = e[0]; c.dz = e[1];
      }
      return true;
    },
    /** Put crab `i` into a mode: 'idle', 'hide', 'guard' (claws up), 'walk'. */
    mode: (i, m, secs = 30) => {
      const c = all[i];
      if (!c) return null;
      c.mode = m; c.timer = secs;
      if (m === 'guard') { c.raiseT = 1; c.raise = 1; c.open = 1; }
      return c.mode;
    },
    freeze: (on) => { frozen = !!on; return frozen; },
    /** Height of the baked surface at (x, z), for checking feet against it. */
    surf: (x, z) => {
      for (const P of patches) if (P.H && inside(P, x, z, 0)) return hAt(P, x, z);
      return crabDrawnH(x, z);
    },
    /** Every foot of crab `i`, and the surface under it — they should agree. */
    feet: (i) => {
      const c = all[i];
      if (!c) return null;
      const out = [];
      for (let k = 0; k < 8; k++) {
        const x = c.feet[k * 3], y = c.feet[k * 3 + 1], z = c.feet[k * 3 + 2];
        out.push([+x.toFixed(3), +y.toFixed(4), +z.toFixed(3), +(y - hAt(c.P, x, z)).toFixed(4), c.swing[k] >= 0 ? 1 : 0]);
      }
      return out;
    },
    /** A camera for looking at crab `i`: from `d` metres, at bearing `az` and elevation `el`. */
    eye: (i, d = 0.3, az = 0.6, el = 0.5) => {
      const c = all[i];
      if (!c) return null;
      const fx = -Math.sin(c.yaw + az), fz = -Math.cos(c.yaw + az);
      return [c.x + fx * d * Math.cos(el), c.y + d * Math.sin(el), c.z + fz * d * Math.cos(el), c.x, c.y, c.z];
    },
  };
}
