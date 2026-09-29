// -----------------------------------------------------------------------------
// Cigarette smoke: a wisp off a resting cigarette and a puff off an exhale.
//
// Misha, 29 Sep 2026, looking at dgreenheck's threejs-particle-fluids — its
// "Vortex Plume" preset, buoyant smoke curling up through a lit volume: *"maybe
// the smoke spreading could be one of the bathers smoking a cigarette"*. That
// repository is WebGPU from end to end (a compute-shader fluid solver writing a
// density grid), so none of it can be lifted into a WebGL game, and a fluid
// solver for a column of smoke three millimetres across at its source would be
// a sledgehammer for a thumbtack anyway. What makes the plume read is three
// things, and all three are cheap without a grid:
//
//   BUOYANCY THAT DIES. Hot smoke leaves a cigarette at a few centimetres a
//   second and accelerates, and then it cools, stops rising and spreads. So
//   the lift here is a rate that decays with age (`buoy`, `cool`) rather than a
//   constant velocity, and a particle's size grows as its lift runs out.
//
//   LAMINAR, THEN CURLING. A real wisp is a straight thread for its first ten
//   or fifteen centimetres and then breaks into swirls, and that transition is
//   what the eye reads as "smoke" rather than "steam off a kettle". The
//   particles are advected by the curl of a small analytic vector potential —
//   divergence-free, so it swirls and never sinks or bunches — and the curl's
//   weight ramps in with age (`curl.on`). Young smoke goes straight up; old
//   smoke wanders.
//
//   LIGHT THROUGH IT. Thin smoke is almost all scattering: it glows against
//   the sun and goes grey-blue in the shade. The sprite is lit by the sun with a
//   Henyey–Greenstein phase (`phase`), shadowed through the scene's own
//   shadow map at its centre, and filled from the sky — so it is brightest when
//   you look toward the sun through it, which is where smoke looks best.
//
// ONE DRAW. Every particle of every smoker is an instance in one buffer, sorted
// back to front on the CPU every frame (there are never more than `max`, and
// sorting two hundred numbers is a few microseconds), and drawn with plain
// alpha blending. Sorted rather than order-independent because the colours
// differ — a sunlit puff over a shaded wisp — and additive would make the dense
// middle of an exhale white-hot.
//
// SOFT WHERE IT TOUCHES SOMETHING, WITHOUT A DEPTH BUFFER. A camera-facing quad
// that passes through a head draws a hard line where it goes behind the skin,
// and an exhale is born at a mouth. The usual fix is a soft-particle fade
// against the scene's depth, and this renderer has no depth to read mid-pass:
// the world is drawn in one pass straight into the target the AO reads
// afterwards (89-ao.js), and with the AO slider at nothing it has no depth
// texture at all. So the fade is taken against what the smoke can actually
// touch, analytically: up to four spheres (a smoker's face and skull), whose
// entry point along each pixel's ray is the depth the fade is measured
// against, and a ceiling height per particle for an awning overhead. A quad
// that meets a face now goes to nothing over `fade` metres before it gets
// there.
// -----------------------------------------------------------------------------

const CIG_SMOKE = {
  // The pool. Two smokers resting is about 2 × 60 wisp particles and an exhale
  // adds sixty more for three seconds; this is the ceiling, not the mean.
  max: 224,
  // The resting wisp: particles a second, their life, the lift they leave the
  // ember with, their size at birth and when spent, and how dense they start.
  //
  // A wisp is a thread, and a thread drawn in round sprites is a string of
  // pearls. The first cut was exactly that, photographed at 2.4 m: six beads
  // over the coal, because the lift takes the smoke to 0.4 m/s within a
  // tenth of a second and at 22 a second that is 18 mm between 13 mm sprites.
  // Doubling the rate would double the pool. Instead a young particle is laid
  // along its own motion on the screen and stretched over the gap to the
  // next (the vertex shader, `aV`), so the first fifteen centimetres are one
  // unbroken line, and it turns back into a round puff as the swirl takes it.
  wisp: { rate: 22, life: [2.3, 3.3], v0: 0.10, size: [0.013, 0.20], alpha: 0.40 },
  // The exhale: particles a second at its peak, how long it lasts, their life,
  // how fast they leave the lips — a relaxed exhale is about a metre a second
  // and gone within half a metre — and their sizes.
  puff: { rate: 48, life: [2.6, 4.0], v0: 0.75, spread: 0.18,
    size: [0.040, 0.40], alpha: 0.26 },
  // Buoyancy, m/s², at birth; its e-folding time as the smoke cools, s; and the
  // slow rise that is left once it has, m/s.
  buoy: 0.42, cool: 1.1, drift: 0.035,
  // How fast a particle comes to the air's velocity, 1/s — the exhale's jet
  // is spent against it in about a third of a second, which is the distance a
  // puff actually travels before it stops and hangs.
  drag: 3.0,
  // The swirl: two octaves of a sine-built vector potential, wavenumbers in
  // rad/m (9 is a 0.7 m eddy and 23 a 0.27 m one), its speed m/s, how fast it
  // evolves, and the age over which it takes over from the laminar thread.
  curl: { k: [9.0, 23.0], amp: [0.13, 0.06], w: [0.6, 1.3], on: [0.25, 1.4] },
  // Size growth's time constant, s: most of the spread happens in the first
  // two seconds, as the lift runs out.
  grow: 1.5,
  // The soft fade against the analytic occluders, metres.
  fade: 0.045,
};

/**
 * The shared noise sprite: R and G are two different soft puffs, each a
 * Gaussian whose edge is eaten into by fBm and which is exactly zero before the
 * quad's edge — so no amount of rotation or scaling can show a square.
 * Mipmapped, because at ten metres a 0.2 m puff is a dozen pixels and an
 * unfiltered noise texture at that size sparkles.
 */
function cigSmokeTexture() {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  const hash = (x, y, s) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  // Value noise on a lattice that wraps at `per`, so the sprite has no seam
  // when it is rotated through the lattice.
  const vn = (x, y, s, per) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const w = (i, j) => hash(((xi + i) % per + per) % per, ((yi + j) % per + per) % per, s);
    return (w(0, 0) * (1 - ux) + w(1, 0) * ux) * (1 - uy) + (w(0, 1) * (1 - ux) + w(1, 1) * ux) * uy;
  };
  const fbm = (x, y, s) => {
    let a = 0, amp = 0.5, f = 1, n = 0;
    for (let o = 0; o < 4; o++) {
      a += amp * vn(x * f, y * f, s + o * 13, 5 * f);
      n += amp; amp *= 0.5; f *= 2;
    }
    return a / n;
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N - 0.5, v = (j + 0.5) / N - 0.5;
      const r = Math.hypot(u, v) * 2;
      const out = [0, 0];
      for (let c = 0; c < 2; c++) {
        const n = fbm((u + 0.5) * 5, (v + 0.5) * 5, 3 + c * 29);
        // A Gaussian core, its edge pushed in and out by the noise, forced to
        // nothing at 0.92 of the radius whatever the noise says.
        const rr = r + (n - 0.5) * 0.55;
        const g = Math.exp(-rr * rr * 3.2) * (0.55 + 0.9 * n);
        const edge = 1 - Math.min(1, Math.max(0, (r - 0.62) / 0.30));
        out[c] = Math.max(0, Math.min(1, g * edge * edge));
      }
      const k = (j * N + i) * 4;
      data[k] = Math.round(out[0] * 255);
      data[k + 1] = Math.round(out[1] * 255);
      data[k + 2] = 0;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

const CIG_SMOKE_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aA;          // size, alpha, seed, age 0..1
attribute vec4 aB;          // spin, ceiling y, tint (0 wisp, 1 exhale), aligned 0..1
attribute vec4 aV;          // the way it is moving (unit, world), and its stretch

varying vec2 vUv;
varying vec2 vUv2;
varying vec3 vWorld;
varying float vAlpha;
varying float vSeed;
varying float vCeil;
varying vec3 vSun;
varying vec3 vAmb;
varying vec3 vSunV;
varying float vTint;

uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;

const float INV_PI = 0.31830989;

${GLSL_SKY}
${GLSL_SHADOW}

void main(){
  float s = aA.x;
  // Camera right and up, straight out of the view matrix's rows.
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // THE THREAD. A young wisp particle is laid along the way it is moving, on
  // the screen, and stretched to reach the next one — so the first fifteen
  // centimetres off the coal is one continuous thread and not a string of
  // beads. As the curl takes over (aB.w falls to 0) it turns back to its own
  // spin and its stretch runs out, and it is a puff like any other.
  vec2 sv = vec2(dot(aV.xyz, right), dot(aV.xyz, up));
  float ls = length(sv);
  sv = ls > 1e-5 ? sv / ls : vec2(0.0, 1.0);
  vec2 sp = vec2(-sin(aB.x), cos(aB.x));
  vec2 ay = mix(sp, sv, aB.w);
  float la = length(ay);
  ay = la > 1e-4 ? ay / la : sp;
  vec2 ax = vec2(ay.y, -ay.x);
  vec2 r = (ax * position.x + ay * position.y * aV.w) * s;
  vec3 p = aPos + right * r.x + up * r.y;
  vWorld = p;
  vUv = uv;
  // The second sample of the sprite: the same texture turned the other way
  // and turning with age, so the inside of a puff churns as it drifts.
  float b = aA.z * 6.2831 - aA.w * 2.2;
  float cb = cos(b), sb = sin(b);
  vec2 q = (uv - 0.5) * 0.8;
  vUv2 = vec2(q.x * cb - q.y * sb, q.x * sb + q.y * cb) + 0.5;
  vAlpha = aA.y;
  vSeed = aA.z;
  vCeil = aB.y;
  vTint = aB.z;

  // THE LIGHT, once a particle and not once a pixel: a sprite is a few
  // centimetres of smoke, and the sun and the shadow do not change across it.
  //
  // Henyey–Greenstein at g 0.6, normalised so that isotropic scattering is 1:
  // 4pi times the phase. Looking into the sun through it (cos 1) that is 9.8,
  // side-on 0.6 and with the sun at your back 0.25; taken 55 per cent of the
  // way from isotropic and held to 2.6 at the top. The first cut used 75 per
  // cent and a cap of 5, and photographed at 18.6 h against a low sun the
  // exhale was an opaque white ball over the smoker's face and the resting
  // thread a white-hot bar: a glow, but a glow with nothing to see through.
  vec3 vd = normalize(aPos - cameraPosition);
  float ct = dot(vd, uSunDir);
  float g = 0.6;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * ct, 1.5);
  float ph = min(2.6, mix(1.0, hg, 0.55));
  float sh = shadowAt(aPos);
  vSun = uSunColor * uSunI * sh * ph * INV_PI;
  // The sky from above and the ground from below, averaged: smoke is lit from
  // all round and has no normal to choose between them.
  vAmb = (ambientAt(vec3(0.0, 1.0, 0.0), uAmbSky, uAmbGround, uAmbI)
    + ambientAt(vec3(0.0, -1.0, 0.0), uAmbSky, uAmbGround, uAmbI)) * 0.5 * INV_PI * 2.2;
  // And the sun in the sprite's own frame, for the lit side of the puff.
  vSunV = normalize(vec3(dot(uSunDir, right), dot(uSunDir, up), -dot(uSunDir, vd)));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const CIG_SMOKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vUv2;
varying vec3 vWorld;
varying float vAlpha;
varying float vSeed;
varying float vCeil;
varying vec3 vSun;
varying vec3 vAmb;
varying vec3 vSunV;
varying float vTint;

uniform sampler2D uTex;
uniform vec4 uOcc[4];
uniform float uFade;

void main(){
  vec4 t1 = texture2D(uTex, vUv);
  vec4 t2 = texture2D(uTex, vUv2);
  float m = mix(t1.r, t1.g, step(0.5, fract(vSeed * 7.13)));
  float d = m * (0.45 + 0.9 * mix(t2.g, t2.r, step(0.5, fract(vSeed * 3.71))));
  float a = d * vAlpha;

  // THE SOFT EDGE, against the four spheres: where along this pixel's ray
  // each one's front surface is, and how far in front of it this fragment
  // sits. Zero at the surface, one a fade's width in front — the fade a depth
  // buffer would have given, against the only things the smoke can touch.
  vec3 ro = cameraPosition;
  vec3 rv = vWorld - ro;
  float tf = length(rv);
  vec3 rd = rv / tf;
  for (int i = 0; i < 4; i++) {
    vec4 o = uOcc[i];
    if (o.w <= 0.0) continue;
    vec3 oc = ro - o.xyz;
    float b = dot(oc, rd);
    float h = b * b - (dot(oc, oc) - o.w * o.w);
    if (h <= 0.0) continue;
    float t0 = -b - sqrt(h);
    a *= smoothstep(0.0, uFade, t0 - tf);
  }
  // And an awning, as a height.
  a *= smoothstep(0.0, 0.12, vCeil - vWorld.y);
  if (a < 0.003) discard;

  // The lit side: a pseudo-normal off the sprite, bulged toward the viewer,
  // against the sun in the sprite's frame. Brighter on the sun side of each
  // puff and a little darker in its own lee, which is what makes a column of
  // flat cards read as something round.
  vec2 q = vUv - 0.5;
  vec3 n = normalize(vec3(q * 1.6, 0.55));
  float side = 0.55 + 0.9 * max(dot(n, vSunV), 0.0);
  // Denser smoke shades itself: the middle of a young exhale is a little
  // darker than its fringe, which is most of what gives it volume.
  float self = 1.0 - 0.35 * smoothstep(0.25, 0.9, d) * vTint;
  // Side-stream smoke off the ember is blue — its particles are small enough
  // to scatter the short end — and exhaled smoke has been through a pair of
  // lungs, is wetter and coarser, and comes out white-grey.
  vec3 alb = mix(vec3(0.70, 0.78, 0.92), vec3(0.86, 0.86, 0.86), vTint);
  vec3 col = alb * (vAmb + vSun * side) * self;
  gl_FragColor = vec4(col, a);
}
`;

/**
 * The pool and its one draw. `emit` puts a particle in, `step` moves them and
 * writes the buffers, `clear` empties it; `occ` is the four soft spheres,
 * (x, y, z, r), r 0 for none.
 */
function makeCigSmoke(scene) {
  const C = CIG_SMOKE, max = C.max;
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.attributes.position = quad.attributes.position;
  geo.attributes.uv = quad.attributes.uv;
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const aA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const aV = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  for (const at of [aPos, aA, aB, aV]) at.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aA', aA);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aV', aV);
  geo.instanceCount = 0;
  const occ = [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareLight(), ...shareShadow(),
      uTex: { value: cigSmokeTexture() },
      uOcc: { value: occ },
      uFade: { value: C.fade },
    },
    vertexShader: CIG_SMOKE_VERT,
    fragmentShader: CIG_SMOKE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'cigsmoke';
  mesh.frustumCulled = false;
  // After the scene's other see-through things, which it is small enough to
  // sit in front of; the fire's own smoke is 25.
  mesh.renderOrder = 26;
  mesh.visible = false;
  scene.add(mesh);

  // Struct of arrays. `life` 0 is a free slot.
  const P = {
    x: new Float64Array(max), y: new Float64Array(max), z: new Float64Array(max),
    vx: new Float32Array(max), vy: new Float32Array(max), vz: new Float32Array(max),
    age: new Float32Array(max), life: new Float32Array(max),
    s0: new Float32Array(max), s1: new Float32Array(max), a0: new Float32Array(max),
    seed: new Float32Array(max), spin: new Float32Array(max), ceil: new Float32Array(max),
    kind: new Uint8Array(max),
  };
  const order = new Int32Array(max);
  const dist = new Float32Array(max);
  let cursor = 0, live = 0, born = 0, clock = 0, ms = 0;
  // Its own little generator. RULE 4 is about the world's layout stream and
  // this is not on it, but a smoke pool that drew from `Math.random` would be
  // the one thing on the shore a seeded test could not repeat.
  let rs = 0x5eed5;
  const rnd = () => {
    rs = (rs + 0x6d2b79f5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const lo = (r, u) => r[0] + (r[1] - r[0]) * u;
  /** How far the swirl has taken over from the thread, 0 to 1, at `age`. */
  const swirl = (age) => {
    const on = Math.min(1, Math.max(0, (age - C.curl.on[0]) / (C.curl.on[1] - C.curl.on[0])));
    return on * on * (3 - 2 * on);
  };

  /** One particle: `kind` 0 the wisp, 1 an exhale. */
  function emit(kind, x, y, z, vx, vy, vz, ceil) {
    // The oldest goes if the pool is full: the ring cursor lands on it.
    let k = -1;
    for (let n = 0; n < max; n++) {
      const i = (cursor + n) % max;
      if (P.life[i] <= 0) { k = i; break; }
    }
    if (k < 0) k = cursor;
    cursor = (k + 1) % max;
    const S = kind ? C.puff : C.wisp;
    P.x[k] = x; P.y[k] = y; P.z[k] = z;
    P.vx[k] = vx; P.vy[k] = vy; P.vz[k] = vz;
    P.age[k] = 0;
    P.life[k] = lo(S.life, rnd());
    P.s0[k] = S.size[0] * (0.8 + 0.4 * rnd());
    P.s1[k] = S.size[1] * (0.7 + 0.6 * rnd());
    P.a0[k] = S.alpha * (0.75 + 0.5 * rnd());
    P.seed[k] = rnd();
    P.spin[k] = rnd() * 6.2832;
    P.ceil[k] = ceil;
    P.kind[k] = kind;
    born++;
  }

  // The swirl: the curl of Ψ = Σ (sin(k y + wt) cos(k z), sin(k z + wt) cos(k x),
  // sin(k x + wt) cos(k y)), differentiated by hand. Divergence-free by
  // construction, which is the whole reason for taking a curl: a plain noise
  // velocity would pile smoke into sinks and tear it out of sources, and
  // smoke does neither.
  const cv = [0, 0, 0];
  function curl(x, y, z, t) {
    cv[0] = 0; cv[1] = 0; cv[2] = 0;
    for (let o = 0; o < 2; o++) {
      const k = C.curl.k[o], A = C.curl.amp[o], wt = t * C.curl.w[o] + o * 1.7;
      const sy = Math.sin(k * y + wt), cyy = Math.cos(k * y + wt);
      const sz = Math.sin(k * z + wt), czz = Math.cos(k * z + wt);
      const sx = Math.sin(k * x + wt), cxx = Math.cos(k * x + wt);
      const cz = Math.cos(k * z), szp = Math.sin(k * z);
      const cx = Math.cos(k * x), sxp = Math.sin(k * x);
      const cy = Math.cos(k * y), syp = Math.sin(k * y);
      // Ψx = sy·cz, Ψy = sz·cx, Ψz = sx·cy
      // ∂Ψz/∂y = −k sx·syp, ∂Ψy/∂z = k czz·cx
      // ∂Ψx/∂z = −k sy·szp, ∂Ψz/∂x = k cxx·cy
      // ∂Ψy/∂x = −k sz·sxp, ∂Ψx/∂y = k cyy·cz
      // Divided by k, so A is a speed and not a speed per wavenumber.
      cv[0] += A * (-sx * syp - czz * cx);
      cv[1] += A * (-sy * szp - cxx * cy);
      cv[2] += A * (-sz * sxp - cyy * cz);
    }
    return cv;
  }

  /**
   * Move everything, and write the draw. `wx`, `wz` the air at smoking
   * height, m/s; `cam` the eye, for the sort.
   */
  function step(dt, wx, wz, cam) {
    const t0 = performance.now();
    clock += dt;
    const kd = 1 - Math.exp(-C.drag * dt);
    live = 0;
    for (let i = 0; i < max; i++) {
      if (P.life[i] <= 0) continue;
      const age = (P.age[i] += dt);
      if (age >= P.life[i]) { P.life[i] = 0; continue; }
      // The air this particle is in: the breeze, and the swirl weighted in
      // as the thread breaks up.
      const w = swirl(age);
      const c = curl(P.x[i], P.y[i], P.z[i], clock + P.seed[i] * 3);
      // The rise it has left: buoyancy decaying as it cools, integrated, so
      // this is the velocity the lift alone would give it by now.
      const rise = C.buoy * C.cool * Math.exp(-age / C.cool) + C.drift;
      const ax = wx * (0.35 + 0.65 * w) + c[0] * w;
      const ay = rise + c[1] * w;
      const az = wz * (0.35 + 0.65 * w) + c[2] * w;
      P.vx[i] += (ax - P.vx[i]) * kd;
      P.vy[i] += (ay - P.vy[i]) * kd;
      P.vz[i] += (az - P.vz[i]) * kd;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      P.z[i] += P.vz[i] * dt;
      const dx = P.x[i] - cam.x, dy = P.y[i] - cam.y, dz = P.z[i] - cam.z;
      dist[i] = dx * dx + dy * dy + dz * dz;
      order[live++] = i;
    }
    // Back to front. An insertion sort, because the order barely changes from
    // one frame to the next and on a nearly sorted list that is linear.
    for (let a = 1; a < live; a++) {
      const v = order[a], dv = dist[v];
      let b = a - 1;
      while (b >= 0 && dist[order[b]] < dv) { order[b + 1] = order[b]; b--; }
      order[b + 1] = v;
    }
    const pa = aPos.array, A = aA.array, B = aB.array, V = aV.array;
    for (let n = 0; n < live; n++) {
      const i = order[n];
      const u = P.age[i] / P.life[i];
      const g = 1 - Math.exp(-P.age[i] / C.grow);
      const s = P.s0[i] + (P.s1[i] - P.s0[i]) * g;
      // In over a tenth of a second, so a particle is not born as a disc at
      // full strength, and out along the rest of its life. And thinned as it
      // spreads: the same smoke over four times the area is a quarter as
      // dense, and a puff that kept its opacity as it grew would be a cloud.
      const fin = Math.min(1, P.age[i] / (P.kind[i] ? 0.03 : 0.10));
      const fout = Math.pow(1 - u, 1.4);
      const thin = Math.sqrt(P.s0[i] / s) * 0.75 + 0.25;
      pa[n * 3] = P.x[i]; pa[n * 3 + 1] = P.y[i]; pa[n * 3 + 2] = P.z[i];
      A[n * 4] = s;
      A[n * 4 + 1] = P.a0[i] * fin * fout * thin;
      A[n * 4 + 2] = P.seed[i];
      A[n * 4 + 3] = u;
      B[n * 4] = P.spin[i] + P.age[i] * (P.seed[i] - 0.5) * 0.8;
      B[n * 4 + 1] = P.ceil[i];
      B[n * 4 + 2] = P.kind[i];
      // The thread: a wisp particle is stretched over the gap to the next one
      // (its speed over the emission rate), and let go as the swirl takes it.
      const sp = Math.hypot(P.vx[i], P.vy[i], P.vz[i]) || 1;
      const al = P.kind[i] ? 0 : 1 - swirl(P.age[i]);
      const st = 1 + Math.min(4, 1.6 * (sp / C.wisp.rate) / s) * al;
      B[n * 4 + 3] = al;
      V[n * 4] = P.vx[i] / sp; V[n * 4 + 1] = P.vy[i] / sp; V[n * 4 + 2] = P.vz[i] / sp;
      V[n * 4 + 3] = st;
    }
    geo.instanceCount = live;
    if (live) {
      aPos.clearUpdateRanges(); aA.clearUpdateRanges(); aB.clearUpdateRanges();
      aPos.addUpdateRange(0, live * 3); aPos.needsUpdate = true;
      aA.addUpdateRange(0, live * 4); aA.needsUpdate = true;
      aB.addUpdateRange(0, live * 4); aB.needsUpdate = true;
      aV.clearUpdateRanges();
      aV.addUpdateRange(0, live * 4); aV.needsUpdate = true;
    }
    mesh.visible = live > 0;
    ms += (performance.now() - t0 - ms) * 0.05;
  }

  function clear() {
    P.life.fill(0);
    live = 0;
    geo.instanceCount = 0;
    mesh.visible = false;
  }

  return {
    mesh, emit, step, clear, occ, rnd,
    get live() { return live; },
    stats: () => ({ live, born, ms: +ms.toFixed(3), max }),
  };
}
