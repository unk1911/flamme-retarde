/**
 * The cars parked in the wood behind Jadrija.
 *
 * The geometry is baked by `tools/blender/cars.py` — five body types, three
 * blobs each — and everything in this file is about getting them onto the
 * ground facing the right way. The shore build in `src/43-jadrija.js` decides
 * *where* each one stands, because that is a question about the shore: which
 * bands of `t` are clear of the shops, how far inland a car can be before it is
 * standing in somebody's front room, and where the playground railing is. This
 * file decides what model turns up, what colour it is painted, and how the
 * whole row gets drawn: three calls a model, and one more for the dark under
 * every car.
 *
 * ── three layers per model ────────────────────────────────────────────────
 *
 * `SOLID_VERT` does `vColor = aInstColor` for an instanced draw and the
 * fragment stage does `base = uBase * vColor` and then `base *= vVCol`. So the
 * per-instance colour multiplies every vertex colour in the mesh, and one blob
 * per car would mean picking dark blue for a car and getting dark blue
 * headlamps, dark blue glass and dark blue tyres with it. `carNearProto` in
 * `src/37-props.js` has exactly that flaw and gets away with it because its
 * lamps are three boxes seen at 300 m; these are seen from two.
 *
 * So each model gets instanced layers over the same instance list. The `body`
 * layer carries a mesh whose vertex colours are white (and 0.3 in the shut
 * lines, which the paint then darkens) and an `aInstColor` holding the paint.
 * The `gloss` layer carries the glass, the lamp lenses, the alloys and the
 * gloss-black trim; the `trim` layer the tyres, plastics, plates and the
 * underside — both in their own colours, with `aInstColor` left at 1.0 so
 * nothing tints them. Body and gloss are three materials' worth of difference
 * from the trim (see `carMaterials`), which is why they are layers and not
 * vertex colours in one mesh.
 *
 * ── why it does not borrow the town's layer ───────────────────────────────
 *
 * `propLayer` itself is reused as-is: it takes a `BufferGeometry` carrying
 * position / normal / aVCol, which is exactly what `readFR3D` hands back. What
 * is not reused is the town's *car layer*, whose capacity is budgeted in
 * `PROPS` against the traffic on the coast road and has nothing spare for a
 * resort. Reusing the function is not the thing the comment in the shore build
 * warns about; reusing the layer is.
 *
 * ── the palettes ──────────────────────────────────────────────────────────
 *
 * Weighted off the footage rather than off a guess about what an old Dalmatian
 * car park holds. The nose-in row under the olives is overwhelmingly white,
 * with silver next and one or two dark cars in it; the van is white because
 * small panel vans are; and red belongs almost entirely to `oldhatch`, which is
 * the one older squarer car in either walk-through and the only red thing in
 * them. Rule 12: these are body types and colour weights, not marques.
 */

const CAR_PAINT = {
  white: [0.962, 0.958, 0.948],
  pearl: [0.918, 0.926, 0.930],
  silver: [0.748, 0.762, 0.780],
  grey: [0.548, 0.558, 0.572],
  slate: [0.262, 0.272, 0.288],
  blue: [0.148, 0.202, 0.328],
  red: [0.520, 0.128, 0.108],
  sand: [0.638, 0.608, 0.545],
  // The two the row did not have, and a car park in 2026 does. Black is not
  // zero: 0.03 of diffuse under a clearcoat is what a black car is, and the
  // reflection on top of it (see `CAR_PAINT_GLSL`) is most of what you see.
  black: [0.030, 0.031, 0.034],
  navy: [0.050, 0.070, 0.135],
  scarlet: [0.560, 0.045, 0.040],
  // Not a paint: the fitted cover on the car that is left for the season.
  //
  // The blue in it is measured OFF and not on, which is the same trap the
  // lavender bank fell into. Sampled across `a_087`, the cover's blue lean
  // runs 0.078 in full sun and 0.115 in the sky-lit midtones — but 0.030 in
  // the deep shade under the pine, where no sky reaches it. That last one is
  // the fabric; the other two are the sky, and the game puts the sky back by
  // itself. Mixed at 0.10 this would be a blue car cover.
  cover: [0.652, 0.668, 0.692],
};

/**
 * The five, with how often each turns up and what it is painted.
 *
 * `w` are shares of the row and they sum to one; the picker walks them in
 * order. `oldhatch` is deliberately the rarest of the cars — the footage has
 * exactly one of them against a dozen moderns, and a wood full of squarer old
 * hatchbacks would be a period piece rather than this August.
 */
const CAR_MODELS = [
  // Two of the fifty-two are put away under covers, and two is the number the
  // footage has: `a_048`-`a_050` and `a_086`-`a_089` in v595, both among the
  // pines. (There is a third behind a gate on the lane at `b_047`, which the
  // survey catalogued as a glass-recycling igloo and is not — see the note in
  // tools/blender/cars.py.)
  //
  // 0.05 is fitted to that count and not derived from it. `carModelFor` walks
  // these weights against `jit`, which is a sine hash over the station index
  // and not a uniform draw, so fifty-two of them do not land in proportion:
  // 0.04 gave one covered car, 0.06 gave four, 0.05 gives two. The weight is
  // the dial and the count on the built page is the reading, which is the same
  // way every other number on this shore was arrived at.
  //
  // The 0.05 comes off `supermini`, the commonest, so the rest of the mix
  // keeps its shape. Every car in the row changes model when this table
  // changes, and that is fine and is why the note on `carModelFor` exists: the
  // car loop takes no `rng()` calls, so nothing else on the beach moves with
  // it. Rule 4 is about the `rng` stream and this is not in it.
  { key: 'covered', w: 0.05, paint: ['cover'], matte: true },
  // Still white-heavy, because the footage is — but with a black, a navy and
  // a red in the mix, since "per-car colours from a realistic palette" was
  // the ask (28 Sep) and a row of nothing but white and silver is the other
  // way the wood read as one car pasted forty times.
  { key: 'supermini', w: 0.29,
    paint: ['white', 'white', 'white', 'white', 'pearl', 'silver', 'silver',
      'grey', 'slate', 'blue', 'black', 'scarlet'] },
  { key: 'crossover', w: 0.25,
    paint: ['white', 'white', 'white', 'pearl', 'silver', 'silver', 'grey',
      'slate', 'blue', 'black', 'navy'] },
  { key: 'estate', w: 0.17,
    paint: ['white', 'white', 'silver', 'silver', 'pearl', 'grey', 'slate',
      'sand', 'black', 'navy'] },
  { key: 'van', w: 0.11,
    paint: ['white', 'white', 'white', 'white', 'white', 'pearl', 'silver'] },
  { key: 'oldhatch', w: 0.13,
    paint: ['red', 'red', 'red', 'white', 'blue', 'slate'] },
];

/**
 * What is parked at this station, from a hash the caller already has.
 *
 * `j` is `jit(t|0, 25)`, which is a sine hash and not a draw off `rng` — see
 * the note over `jit` in the shore build. That is the whole reason the number
 * of models here is free to change: the car loop takes no `rng()` calls at all,
 * so nothing downstream of it on the beach moves when this table does.
 */
function carModelFor(j) {
  let a = 0;
  for (const m of CAR_MODELS) {
    a += m.w;
    if (j < a) return m;
  }
  return CAR_MODELS[0];
}

/** Fallback extents, for a build whose payload was not baked. */
const CAR_FALLBACK = { x0: -1.95, x1: 2.05, hw: 0.86, h: 1.50 };

/**
 * The model's dimensions, in metres, read straight out of the sidecar.
 *
 * `build.py` inlines a `.json` payload verbatim, so `PAYLOAD.cars` is a plain
 * object and this is synchronous — which is what the shore build needs, since
 * it pushes the walk blockers for the row hundreds of lines before anything is
 * inflated. One source of truth: the numbers come off the same Blender specs
 * that produced the meshes, so a car and its blocker cannot drift apart.
 *
 * `x0`/`x1` are the tail and the nose in model space, with the origin at the
 * wheelbase centre; `hw` is the widest half-width, which is the car's extent
 * *along the shore* because the row is parked nose-in; `h` is the overall
 * height, roof box included.
 */
function carSize(key) {
  const table = (typeof PAYLOAD !== 'undefined' && PAYLOAD.cars) || null;
  return (table && table[key]) || CAR_FALLBACK;
}

/**
 * The two finishes that are not matt, as `lit` hooks for `solidMaterial`.
 *
 * "The cars still look like shit" (28 Sep) was partly geometry and partly
 * this: every car was lit by the prop shader's one blinn lobe at 0.34 with a
 * mirror of the sky scaled by the same 0.34 — which is a plastic toy, the
 * same sheen on the paint, the glass, the tyres and the number plates.
 *
 * Paint is a CLEARCOAT: a coloured diffuse base under a clear dielectric
 * layer, so the reflection is Fresnel — 4 % looking straight at a panel, all
 * of it at a grazing angle — and whatever it reflects is added over the
 * colour, not multiplied by it. That is why a black car is black with the
 * sky on it and a white car is white: the coat is the same on both.
 *
 * What it reflects is not the sky on its own. These are parked in a pine
 * wood, so the reflection is dimmed toward the horizon, where the trunks and
 * the canopy are, and below it is the ground; and it is dimmed again in the
 * shade (`sh`), which is the cheapest occlusion there is and is right under
 * a tree. A sky-mirror under a pine canopy is what made the last version's
 * roofs glow.
 *
 * Gloss is glass, lamp lenses, alloys and the gloss-black trim, told apart by
 * the vertex colour: anything bright is metal (reflection tinted by the base,
 * F0 0.6), anything dark is a dielectric (F0 0.05) whose reflection REPLACES
 * what is behind it as the angle closes, which is what a windscreen does.
 *
 * (NO BACKTICKS in the GLSL below — it is a template literal.)
 */
const CAR_ENV_GLSL = `
  // The canopy's shadow, softened. One tap of the near cascade lays the pine
  // shade on a car as square blocks a hand across, which the needle floor
  // hides and a smooth white door does not. Five taps 18 cm apart, pushed 5 cm
  // off the panel so a car does not shade itself, and the sun term already
  // in col is corrected by the difference.
  vec3 cP = vWorld + n * 0.05;
  float cSh = (shadowAt(cP) + shadowAt(cP + vec3(0.18, 0.0, 0.0))
    + shadowAt(cP - vec3(0.18, 0.0, 0.0)) + shadowAt(cP + vec3(0.0, 0.0, 0.18))
    + shadowAt(cP - vec3(0.0, 0.0, 0.18))) * 0.2;
  col += base * uSunColor * uSunI * ndl * INV_PI * (cSh - sh);
  sh = cSh;
  vec3 cV = -viewDir;
  float cNV = clamp(dot(n, cV), 0.0, 1.0);
  vec3 cR = reflect(viewDir, n);
  vec3 cE = skyColor(normalize(cR), false);
  cE *= mix(0.28, 1.0, smoothstep(0.02, 0.55, cR.y));
  cE = mix(uAmbGround * uAmbI * 0.30, cE, smoothstep(-0.12, 0.04, cR.y));
  float cOcc = mix(0.40, 1.0, sh);
  float cSun = pow(max(dot(n, normalize(uSunDir - viewDir)), 0.0), 1200.0) * sh;
`;
const CAR_PAINT_GLSL = CAR_ENV_GLSL + `
  float cF = 0.04 + 0.96 * pow(1.0 - cNV, 5.0);
  col = col * (1.0 - cF * 0.85) + cE * cF * uCoat * cOcc;
  col += uSunColor * cSun * 2.5;
`;
const CAR_GLOSS_GLSL = CAR_ENV_GLSL + `
  float cM = smoothstep(0.30, 0.55, max(max(vVCol.r, vVCol.g), vVCol.b));
  float cF0 = mix(0.09, 0.60, cM);
  float cF = cF0 + (1.0 - cF0) * pow(1.0 - cNV, 5.0);
  vec3 cTint = mix(vec3(1.0), base / max(max(base.r, base.g), max(base.b, 1e-3)), cM);
  col = col * (1.0 - cF * (1.0 - cM) * 0.9) + cE * cF * cTint * uCoat * cOcc;
  col += uSunColor * cSun * 3.0;
`;

/**
 * Draw only the cars within `CAR_DRAW_M` of the camera.
 *
 * One layer holds every car of a model from one end of the shore to the
 * other, so its bounding sphere is 360 m across and is in frame from nearly
 * anywhere on the promenade — and the better cars are 8 000 triangles each
 * where the old ones were 1 000. Measured at the promenade (t 460 looking
 * west) that was +0.8 ms of GPU for cars standing behind two rows of kabine
 * and a wood. So each layer keeps its full instance list aside and, when the
 * set within range changes, packs just those to the front and draws that
 * many. The camera is `U.uCamPos`, which is the eye in every pass — the
 * shadow pass included, so a car does not lose its shadow before itself.
 */
const CAR_DRAW_M = 130;
function nearOnly(L, n) {
  const full = [L.aPos, L.aRot, L.aScale, L.aColor].map((a) => a.array.slice(0, n * a.itemSize));
  let key = -1, pending = -1;
  L.mesh.onBeforeRender = () => {
    // A rewrite reaches the GPU at the start of the NEXT render call, so the
    // new count waits for it; until then this draws a prefix of the old list.
    if (pending >= 0) { L.geo.instanceCount = pending; pending = -1; }
    const cp = U.uCamPos.value;
    let k = 0, bits = 0;
    const idx = [];
    for (let i = 0; i < n; i++) {
      const dx = full[0][i * 3] - cp.x, dz = full[0][i * 3 + 2] - cp.z;
      if (dx * dx + dz * dz < CAR_DRAW_M * CAR_DRAW_M) { idx.push(i); bits = (bits * 31 + i + 1) % 1000000007; }
    }
    bits = bits * 64 + idx.length;
    if (bits === key) return;
    key = bits;
    [L.aPos, L.aRot, L.aScale, L.aColor].forEach((a, m) => {
      const w = a.itemSize;
      k = 0;
      for (const i of idx) {
        for (let c = 0; c < w; c++) a.array[k * w + c] = full[m][i * w + c];
        k++;
      }
      a.needsUpdate = true;
    });
    pending = idx.length;
    L.geo.instanceCount = Math.min(L.geo.instanceCount, idx.length);
  };
}

let carMats = null;
/** One material per finish, shared by every model and both car parks. */
function carMaterials() {
  if (carMats) return carMats;
  const mk = (lit, spec, specPower, coat) => solidMaterial(0xffffff, {
    instanced: true, spec, specPower, side: THREE.DoubleSide,
    // env 0: the default sky mirror is off, and the one in `lit` replaces it.
    body: 'base *= vVCol;\n  n = gl_FrontFacing ? n : -n;\n  env = 0.0;',
    uniforms: { uCoat: { value: coat } },
    decl: 'uniform float uCoat;',
    lit,
  });
  carMats = {
    paint: mk(CAR_PAINT_GLSL, 0.10, 60, 0.95),
    gloss: mk(CAR_GLOSS_GLSL, 0.10, 90, 1.0),
  };
  return carMats;
}

/**
 * Draw the row.
 *
 * `sites` is what the shore build collected: `{ x, y, z, yaw, pitch, roll,
 * model, tint }` per car, already in world space, turned to face the water and
 * tilted to sit on the slope it stands on. Three
 * instanced layers per model come out of it — the paint, the gloss and the
 * matt trim, one per material (`carMaterials`) — and each is given a real
 * bounding sphere over the instances
 * that ended up in it, rather than `propLayer`'s 1e9 one, so the whole car park
 * culls as a unit the moment you are looking the other way.
 */
async function buildJadrijaCars(scene, sites) {
  const layers = [];
  let tris = 0;
  const counts = {};
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  for (const model of CAR_MODELS) {
    const mine = sites.filter((s) => s.model === model.key);
    counts[model.key] = mine.length;
    if (!mine.length) continue;

    // All three or none: a body with no trim is a car with no wheels, and one
    // with no gloss is a car with no glass — worse than the boxes before.
    const blobs = { body: null, gloss: null, trim: null };
    let bad = false;
    for (const [half, suffix] of [['body', ''], ['gloss', '_gloss'], ['trim', '_trim']]) {
      const key = 'car_' + model.key + suffix + '_fr3d';
      const b64 = typeof PAYLOAD !== 'undefined' ? PAYLOAD[key] : null;
      if (!b64) { console.warn('no car payload:', key); bad = true; continue; }
      try {
        blobs[half] = readFR3D(await inflateBinary(b64));
      } catch (e) {
        console.warn('car failed:', key, e.message);
        bad = true;
      }
    }
    if (bad) continue;

    for (const half of ['body', 'gloss', 'trim']) {
      const geo = blobs[half];
      tris += (geo.index.count / 3) * mine.length;
      // The trim is matt — tyres, black plastic, plates — and keeps the prop
      // shader's own lobe, turned down from the 0.34 everything used to share.
      const L = propLayer(scene, geo, mine.length, { spec: 0.08, specPower: 18 });
      const fin = half === 'body' ? (model.matte ? null : 'paint')
        : half === 'gloss' ? 'gloss' : null;
      if (fin) {
        L.mesh.material.dispose();
        L.mesh.material = carMaterials()[fin];
      }
      // The index used to be set here, because `propLayer` copied position,
      // normal and aVCol and stopped — every prototype it was written for comes
      // out of `propBuilder.geo()`, a raw triangle soup with no index at all,
      // whereas `readFR3D` deduplicates its vertices and keeps the triangles
      // entirely in the index buffer. Handing that over without the index draws
      // the vertex array in storage order, three at a time, which is not a car
      // with a fault in it but a heap of flat shards lying on the ground.
      //
      // `propLayer` carries the index itself now, on 23 Aug, so this is gone
      // rather than duplicated. The note stays because the failure is silent
      // and the next indexed prototype would have found it the same way.
      let lo = [1e9, 1e9, 1e9];
      let hi = [-1e9, -1e9, -1e9];
      mine.forEach((s, i) => {
        // Roll about the model's X, pitch about its Z — see the shore build.
        _e.set(s.roll || 0, s.yaw, s.pitch || 0, 'YXZ');
        _q.setFromEuler(_e);
        L.aPos.array[i * 3] = s.x;
        L.aPos.array[i * 3 + 1] = s.y;
        L.aPos.array[i * 3 + 2] = s.z;
        L.aRot.array[i * 4] = _q.x; L.aRot.array[i * 4 + 1] = _q.y;
        L.aRot.array[i * 4 + 2] = _q.z; L.aRot.array[i * 4 + 3] = _q.w;
        L.aScale.array[i * 3] = 1; L.aScale.array[i * 3 + 1] = 1;
        L.aScale.array[i * 3 + 2] = 1;
        // Only the paint is tinted. That is the whole point of the other two
        // being layers of their own: 1.0 through the multiply leaves the baked
        // colours exactly as Blender wrote them.
        const c = half === 'body' ? s.tint : [1, 1, 1];
        L.aColor.array[i * 3] = c[0]; L.aColor.array[i * 3 + 1] = c[1];
        L.aColor.array[i * 3 + 2] = c[2];
        for (let k = 0; k < 3; k++) {
          const v = [s.x, s.y, s.z][k];
          if (v < lo[k]) lo[k] = v;
          if (v > hi[k]) hi[k] = v;
        }
      });
      for (const a of [L.aPos, L.aRot, L.aScale, L.aColor]) a.needsUpdate = true;
      L.geo.instanceCount = mine.length;

      // A real bounding sphere, and frustum culling switched back on. The
      // instance positions are world positions and the layer's mesh carries no
      // transform, so the sphere is simply the box round them grown by the
      // model's own radius. Left at `propLayer`'s 1e9 default the row is drawn
      // on every frame of the game, including the ones spent over the channel
      // with the resort three kilometres behind the aeroplane.
      const c = new THREE.Vector3((lo[0] + hi[0]) * 0.5, (lo[1] + hi[1]) * 0.5,
        (lo[2] + hi[2]) * 0.5);
      const span = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.5;
      L.geo.boundingSphere = new THREE.Sphere(c,
        span + (geo.boundingSphere ? geo.boundingSphere.radius : 3));
      L.mesh.frustumCulled = true;
      nearOnly(L, mine.length);
      L.half = half;
      layers.push(L);
    }
  }

  // ── the dark under every car ────────────────────────────────────────────
  // What made the last row look parked on glass was not the wheels, which
  // touch the ground within 3 cm on every car (measured by raycast, 28 Sep),
  // but the ground UNDER the car, lit exactly as brightly as the ground beside
  // it. Under a real car it is nearly black — no sky reaches it — and that
  // dark footprint is how the eye reads contact. One soft ellipse per car,
  // one instanced draw for the whole row, blended over the ground and never
  // written to depth. It follows the car's pitch and roll, so it follows the
  // slope the car stands on.
  if (sites.length) {
    const q = new THREE.PlaneGeometry(1, 1, 1, 1);
    q.rotateX(-Math.PI / 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', q.attributes.position);
    g.setAttribute('normal', q.attributes.normal);
    g.setAttribute('aVCol', new THREE.BufferAttribute(new Float32Array(12).fill(1), 3));
    g.setIndex(q.index);
    const L = propLayer(scene, g, sites.length);
    L.mesh.material.dispose();
    L.mesh.material = solidMaterial(0x000000, {
      instanced: true, transparent: true, depthWrite: false,
      // Radial in the car's own frame (`vLocal` is the unit quad), so one
      // quad scaled per car is the right ellipse for every body.
      body: 'float cd = length(vLocal.xz * 2.0);\n'
        + '  alpha = 0.62 * (1.0 - smoothstep(0.35, 1.0, cd));\n'
        + '  base = vec3(0.0); spec = 0.0; env = 0.0;',
    });
    L.mesh.renderOrder = 2;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    sites.forEach((s, i) => {
      const sz = carSize(s.model);
      _e.set(s.roll || 0, s.yaw, s.pitch || 0, 'YXZ');
      _q.setFromEuler(_e);
      // The footprint's middle, which is not the wheelbase centre.
      const off = new THREE.Vector3((sz.x0 + sz.x1) * 0.5, 0.045, 0).applyQuaternion(_q);
      const p = [s.x + off.x, s.y + off.y, s.z + off.z];
      L.aPos.array.set(p, i * 3);
      L.aRot.array.set([_q.x, _q.y, _q.z, _q.w], i * 4);
      L.aScale.array.set([(sz.x1 - sz.x0) * 1.12, 1, sz.hw * 2.3], i * 3);
      L.aColor.array.set([1, 1, 1], i * 3);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], p[k]);
        hi[k] = Math.max(hi[k], p[k]);
      }
    });
    for (const a of [L.aPos, L.aRot, L.aScale, L.aColor]) a.needsUpdate = true;
    L.geo.instanceCount = sites.length;
    L.geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3((lo[0] + hi[0]) * 0.5, (lo[1] + hi[1]) * 0.5, (lo[2] + hi[2]) * 0.5),
      Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.5 + 3);
    L.mesh.frustumCulled = true;
  }

  return {
    layers,
    /**
     * For the shadow pass in src/90-app.js — instanced, near cascade only. Not
     * the gloss layer: glass lets the sun through, so the cabin of a real
     * car throws a lighter shadow than its body, and a rim is inside its tyre.
     * Six draws in the near shadow pass that bought nothing.
     */
    meshes: () => layers.filter((L) => L.half !== 'gloss').map((L) => L.mesh),
    count: sites.length,
    counts,
    tris,
  };
}
