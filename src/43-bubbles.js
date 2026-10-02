// -----------------------------------------------------------------------------
// Soap bubbles: a pool of them, one draw, one shader — blown by the girl at
// beach bar MINI (`stepBubbler` in 43-jadrija.js, who holds the wand).
//
// Misha, 2 Oct 2026: *"maybe one of the bather kids seated at one of the
// chairs near one of the businesses there can be blowing the bubbles"*.
//
// WHAT A BUBBLE LOOKS LIKE is the thin-film table (24-thinfilm.js, soap row),
// read with the film's thickness at this point of this bubble:
//
//   DRAINED. Gravity pulls the film down its own walls from the moment it is
//   blown, so a bubble is thick at the bottom (a micron and more: pastel
//   green and pink, the high orders washing out toward white), banded
//   magenta-blue-gold in the middle, and thinning toward the top until a cap
//   of BLACK film — tens of nanometres, too thin to reflect anything — opens
//   there and grows as it ages. That is where it is going to burst.
//
//   SWIRLED. The film is not still: thermal and Marangoni flows carry the
//   bands round in slow eddies. Value noise on the bubble's own surface,
//   domain-warped and turning at a per-bubble phase, draws them — on the
//   SPHERE'S own coordinates, which are always within a metre of nought.
//
//   FRESNEL. A film is a pair of mirrors, so face-on it shows the sky at a
//   few per cent in the film's colour and at the rim it is nearly a mirror.
//   Both faces draw: the near one and the far one inside it, which is why a
//   real bubble has two rings of colour and not one.
//
//   ADDITIVE. What a bubble does to the light behind it is pass ninety-odd
//   per cent of it straight on; what it adds is the reflection. So it is
//   added, which needs no sorting — forty bubbles in any order sum to the
//   same picture, and the near and far faces with them.
//
//   POPPING. A hole opens at one point and runs round the film in a few
//   hundredths of a second, the rim gathering the liquid as it goes. Drawn as
//   exactly that: everything inside a growing cap about a random point is
//   discarded over four or five frames.
//
// The motion is in JavaScript and costs nothing to speak of: dozens of
// points, drag toward the air, a little warm-breath lift that fades and then
// the slow sink a real bubble has (a soap film is heavier than the air it
// holds), a breeze of jitter, a pop when the time is up or when it touches the
// ground, a table or somebody. All on its own seeded generator — never `rng()`
// (Rule 4).
// -----------------------------------------------------------------------------

const BUBBLE = {
  max: 48,            // the pool; a wand blows five to nine a second for two
  life: [3, 12],      // seconds before it bursts on its own
  r: [0.008, 0.036],  // radius, metres — mostly small, the odd big one
  pop: 0.075,         // seconds the hole takes to run round
  // Drag toward the air, seconds — a bubble is all surface and no mass.
  tau: 0.30,
  // Warm breath: lift at birth and its e-folding time; then the sink.
  lift: 0.16, liftT: 1.4, sink: 0.045,
  // How hard the eddies push, m/s, and how fast they turn.
  jitter: 0.11,
  gain: 2.4,          // the reflection's brightness, against the film's own R
};

const SOAP_VERT = /* glsl */ `
uniform float uTime;
attribute vec4 aB;     // centre xyz, radius
attribute vec4 aC;     // seed, pop progress (-1 none), age, fresh wobble
attribute vec3 aP;     // where the hole opens, a unit direction
varying vec3 vW;
varying vec3 vL;
varying vec4 vC;
varying vec3 vPp;
void main(){
  vec3 p = position;
  // A fresh bubble rings for a moment after it leaves the wand.
  float wob = aC.w * 0.07 * sin(9.0 * uTime + aC.x * 40.0 + p.y * 2.0);
  p *= 1.0 + wob * (p.y * p.y - 0.33);
  vL = position;
  vC = aC;
  vPp = aP;
  vW = aB.xyz + p * aB.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}
`;

const SOAP_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uCamPos;
uniform float uBubK;
uniform vec3 uAmbGround;
uniform float uAmbI;
varying vec3 vW;
varying vec3 vL;
varying vec4 vC;
varying vec3 vPp;
${GLSL_NOISE}
${GLSL_SKY}
${GLSL_THINFILM}
void main(){
  vec3 L = normalize(vL);
  // The burst: a cap about vPp, growing over the pop from nothing to the
  // whole sphere.
  float cut = 1.0 - 2.05 * vC.y, edge = 0.0;
  if (vC.y >= 0.0) {
    float c = dot(L, vPp);
    if (c > cut) discard;
    // The rim the retreating film gathers as it goes: a bright thread
    // along the edge of the hole.
    edge = 1.0 - smoothstep(0.0, 0.10, cut - c);
  }
  vec3 V = normalize(vW - uCamPos);
  vec3 N = gl_FrontFacing ? L : -L;
  float cosI = clamp(abs(dot(V, N)), 0.0, 1.0);
  // Thickness, nm. Drained: about 1100 at the foot, 60 at the crown.
  float h = 0.5 - 0.5 * L.y;
  float d = mix(60.0, 1100.0, pow(h, 1.25));
  // Swirling bands, on the bubble's own surface and turning slowly.
  float ph = vC.x * 31.0, t = uTime * (0.22 + 0.10 * fract(vC.x * 7.0));
  float ca = cos(t + L.y * 1.7), sa = sin(t + L.y * 1.7);
  vec2 q = vec2(ca * L.x - sa * L.z, sa * L.x + ca * L.z) * 1.6 + vec2(L.y * 2.1, ph);
  vec2 wq = vec2(fbm2(q + vec2(1.7, 9.2), 3), fbm2(q + vec2(8.3, 2.8), 3)) - 0.5;
  float sw = fbm2(q * 1.4 + wq * 2.6, 3);
  d *= 0.62 + 0.76 * sw;
  // The black film: a cap at the crown that opens wider with age.
  float black = smoothstep(0.86 - min(vC.z, 10.0) * 0.022, 0.97, L.y);
  d = mix(d, 12.0, black);
  float opd = 2.0 * 1.33 * d * filmCosT(cosI, 1.33);
  vec3 R = filmRGB(opd, 0.25);
  // Toward grazing every surface is a mirror; the film's colour goes with it.
  float fr = pow(1.0 - cosI, 5.0);
  vec3 refl = mix(R, vec3(0.55), fr * (1.0 - black));
  vec3 r = reflect(V, N);
  vec3 env = skyColor(normalize(vec3(r.x, abs(r.y), r.z)), false);
  // Below the horizon it is the ground the bubble sees, not the sky again.
  env = mix(uAmbGround * uAmbI * 0.9 + uSunColor * uSunI * 0.10, env, smoothstep(-0.08, 0.06, r.y));
  float sun = pow(max(dot(r, uSunDir), 0.0), 900.0) * 60.0 + pow(max(dot(r, uSunDir), 0.0), 60.0) * 1.2;
  vec3 col = refl * (env + uSunColor * uSunI * sun) * uBubK;
  col += env * edge * 0.35;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** The pool. `step` runs it, `emit` blows one. */
function makeBubbles(scene) {
  const N = BUBBLE.max;
  const sphere = new THREE.SphereGeometry(1, 22, 16);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = sphere.index;
  geo.setAttribute('position', sphere.getAttribute('position'));
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
  const aC = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
  const aP = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  for (const a of [aB, aC, aP]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aC', aC);
  geo.setAttribute('aP', aP);
  geo.instanceCount = 0;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shareLight(), ...shareThinFilm(), uCamPos: U.uCamPos,
      uBubK: { value: BUBBLE.gain } },
    vertexShader: SOAP_VERT,
    fragmentShader: SOAP_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  // Both faces in ONE pass: additive does not care which comes first, and two
  // passes would be two draws for nothing.
  mat.forceSinglePass = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 6;
  mesh.name = 'bubbles';
  scene.add(mesh);

  // State, by slot. `pop` is -1 while whole, then counts up through the burst.
  const P = new Float32Array(N * 3), Vv = new Float32Array(N * 3);
  const R = new Float32Array(N), R0 = new Float32Array(N), age = new Float32Array(N);
  const life = new Float32Array(N), seed = new Float32Array(N), pop = new Float32Array(N).fill(-1);
  const PD = new Float32Array(N * 3), alive = new Uint8Array(N);
  let rs = 0x9e3779b9;
  const rnd = () => {
    rs = (rs + 0x6d2b79f5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stat = { blown: 0, popped: 0, timeUp: 0, ground: 0, hit: 0, live: 0, ms: 0, maxLive: 0 };

  function emit(x, y, z, vx, vy, vz) {
    let i = alive.indexOf(0);
    if (i < 0) return -1;
    alive[i] = 1;
    P[3 * i] = x; P[3 * i + 1] = y; P[3 * i + 2] = z;
    Vv[3 * i] = vx; Vv[3 * i + 1] = vy; Vv[3 * i + 2] = vz;
    // Mostly small: the square of a uniform leans the deal to the low end.
    const u = rnd();
    R0[i] = BUBBLE.r[0] + (BUBBLE.r[1] - BUBBLE.r[0]) * u * u;
    R[i] = R0[i] * 0.55;
    age[i] = 0;
    life[i] = BUBBLE.life[0] + (BUBBLE.life[1] - BUBBLE.life[0]) * rnd();
    seed[i] = rnd();
    pop[i] = -1;
    stat.blown++;
    return i;
  }

  function burst(i, why) {
    if (pop[i] >= 0) return;
    pop[i] = 0;
    // The hole opens wherever the film failed: on the side that touched, or
    // anywhere at all for one that simply ran out of time — usually up top,
    // where the black film is.
    let x = rnd() - 0.5, y = why === 'time' ? 0.9 : rnd() - 0.5, z = rnd() - 0.5;
    if (why === 'ground') { x *= 0.3; y = -1; z *= 0.3; }
    const l = Math.hypot(x, y, z) || 1;
    PD[3 * i] = x / l; PD[3 * i + 1] = y / l; PD[3 * i + 2] = z / l;
    stat.popped++;
    if (why === 'time') stat.timeUp++;
    else if (why === 'ground') stat.ground++;
    else stat.hit++;
  }

  /**
   * One step. `air` is the breeze where the bubbles are, m/s (x, z);
   * `ground(x, z)` the height of whatever is under a point; `hit(x, y, z, r)`
   * true if a point is inside a table or a person.
   */
  function step(dt, ax, az, ground, hit) {
    const t0 = performance.now();
    const tt = (typeof state !== 'undefined' ? state.t : 0);
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      age[i] += dt;
      if (pop[i] >= 0) {
        pop[i] += dt / BUBBLE.pop;
        if (pop[i] >= 1) { alive[i] = 0; continue; }
      } else {
        R[i] += (R0[i] - R[i]) * Math.min(1, dt / 0.18);
        // The eddies: two slow sines a bubble, out of phase on each axis.
        const s = seed[i] * 50;
        const jx = BUBBLE.jitter * Math.sin(tt * 0.9 + s) * Math.sin(tt * 0.37 + s * 1.7);
        const jy = BUBBLE.jitter * 0.6 * Math.sin(tt * 1.1 + s * 2.3);
        const jz = BUBBLE.jitter * Math.cos(tt * 0.8 + s * 0.6) * Math.sin(tt * 0.29 + s);
        const wy = BUBBLE.lift * Math.exp(-age[i] / BUBBLE.liftT) - BUBBLE.sink;
        const k = Math.min(1, dt / (BUBBLE.tau + R[i] * 6));
        Vv[3 * i] += (ax + jx - Vv[3 * i]) * k;
        Vv[3 * i + 1] += (wy + jy - Vv[3 * i + 1]) * k;
        Vv[3 * i + 2] += (az + jz - Vv[3 * i + 2]) * k;
        P[3 * i] += Vv[3 * i] * dt;
        P[3 * i + 1] += Vv[3 * i + 1] * dt;
        P[3 * i + 2] += Vv[3 * i + 2] * dt;
        const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
        if (age[i] >= life[i]) burst(i, 'time');
        else if (y - R[i] <= ground(x, z)) burst(i, 'ground');
        else if (age[i] > 0.25 && hit && hit(x, y, z, R[i])) burst(i, 'hit');
      }
      const o = n * 4, q = n * 3;
      aB.array[o] = P[3 * i]; aB.array[o + 1] = P[3 * i + 1]; aB.array[o + 2] = P[3 * i + 2];
      aB.array[o + 3] = R[i];
      aC.array[o] = seed[i]; aC.array[o + 1] = pop[i]; aC.array[o + 2] = age[i];
      aC.array[o + 3] = Math.max(0, 1 - age[i] / 0.8);
      aP.array[q] = PD[3 * i]; aP.array[q + 1] = PD[3 * i + 1]; aP.array[q + 2] = PD[3 * i + 2];
      n++;
    }
    geo.instanceCount = n;
    mesh.visible = n > 0;
    if (n) { aB.needsUpdate = true; aC.needsUpdate = true; aP.needsUpdate = true; }
    stat.live = n;
    stat.maxLive = Math.max(stat.maxLive, n);
    stat.ms += (performance.now() - t0 - stat.ms) * 0.05;
  }

  function clear() {
    alive.fill(0);
    geo.instanceCount = 0;
    mesh.visible = false;
    stat.live = 0;
  }

  /** Burst one now, for a probe: the biggest whole bubble. */
  function popOne() {
    let b = -1;
    for (let i = 0; i < N; i++) if (alive[i] && pop[i] < 0 && (b < 0 || R0[i] > R0[b])) b = i;
    if (b >= 0) burst(b, 'probe');
    return b >= 0 ? [P[3 * b], P[3 * b + 1], P[3 * b + 2], R[b]] : null;
  }

  return { mesh, mat, emit, step, clear, popOne, rnd,
    stats: () => ({ ...stat, ms: +stat.ms.toFixed(3) }),
    list: () => {
      const o = [];
      for (let i = 0; i < N; i++) {
        if (alive[i]) o.push([+P[3 * i].toFixed(2), +P[3 * i + 1].toFixed(2), +P[3 * i + 2].toFixed(2), +R[i].toFixed(3), +pop[i].toFixed(2)]);
      }
      return o;
    } };
}
