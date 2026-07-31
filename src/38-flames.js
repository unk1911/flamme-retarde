// -----------------------------------------------------------------------------
// What the fire looks like: flame sheets, embers and the smoke column.
//
// All three are instanced camera-facing quads with the shape written in the
// fragment shader. A flame is not a sprite here — it is a domain-warped noise
// field clipped to a tapering silhouette, so no two are the same and none of
// them loop.
// -----------------------------------------------------------------------------

const FLAME_VERT = /* glsl */ `
attribute vec3 aPos;        // world position of the base
attribute vec4 aParam;      // x: scale, y: seed, z: intensity, w: phase

varying vec2 vUv;
varying vec4 vParam;
varying vec3 vWorld;

uniform vec3 uCamRight;
uniform vec3 uCamUp;

void main(){
  vUv = uv;
  vParam = aParam;
  // Billboard, but only around the vertical axis — a flame that tips toward
  // the camera when you fly over it looks like a decal, which it is.
  vec3 right = normalize(vec3(uCamRight.x, 0.0, uCamRight.z));
  vec3 up = vec3(0.0, 1.0, 0.0);
  float s = aParam.x;
  vec3 p = aPos + right * (position.x * s) + up * ((position.y + 0.5) * s * 2.1);
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FLAME_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec4 vParam;
varying vec3 vWorld;

uniform float uTime;
uniform vec2 uWind;

${GLSL_NOISE}

void main(){
  float seed = vParam.y;
  float inten = vParam.z;
  float t = uTime * (1.4 + fract(seed * 7.3) * 0.7) + vParam.w;

  vec2 uv = vUv;
  float y = uv.y;

  // Lean the whole flame downwind, harder toward the tip.
  uv.x -= uWind.x * y * y * 0.42;

  // Domain warp: two octaves of noise scrolling upward, the second driven by
  // the first. This is what gives the licking, curling silhouette.
  vec2 q = vec2(uv.x * 2.6, uv.y * 1.5 - t * 1.15) + seed * 31.7;
  float w1 = fbm2(q, 3) - 0.5;
  vec2 q2 = q * 2.3 + vec2(w1 * 1.6, -t * 0.6);
  float w2 = fbm2(q2, 3) - 0.5;

  float x = (uv.x - 0.5) + (w1 * 0.30 + w2 * 0.20) * (0.25 + y);

  // Silhouette: a column that pinches to nothing at the top.
  float width = (0.34 - 0.30 * y * y) * (0.55 + 0.65 * inten);
  float body = 1.0 - smoothstep(width * 0.55, width, abs(x));
  body *= smoothstep(1.0, 0.72, y);              // taper out at the tip
  body *= smoothstep(0.0, 0.10, y);              // and hide the hard base
  // Break the column into tongues.
  body *= smoothstep(0.18, 0.62, 1.0 - y * 0.75 + (w2 * 0.85));

  if (body <= 0.004) discard;

  // Colour by height and by how much flame is left at this pixel: white-hot in
  // the core near the base, through orange, to a thin red tip.
  float hot = body * (1.0 - y * 0.85);
  vec3 col = mix(vec3(0.85, 0.10, 0.02), vec3(1.0, 0.45, 0.07), smoothstep(0.0, 0.35, hot));
  col = mix(col, vec3(1.0, 0.82, 0.42), smoothstep(0.33, 0.72, hot));
  col = mix(col, vec3(1.0, 0.97, 0.86), smoothstep(0.70, 0.95, hot));
  // Soot at the very top, where the flame is turning into smoke.
  col = mix(col, vec3(0.20, 0.16, 0.15), smoothstep(0.62, 1.0, y) * 0.55);

  float a = body * clamp(inten * 1.5, 0.15, 1.0);
  gl_FragColor = vec4(col * (1.4 + inten), a);
}
`;

function buildFlames(scene, max) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.attributes.position = quad.attributes.position;
  geo.attributes.uv = quad.attributes.uv;
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const aParam = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  aPos.setUsage(THREE.DynamicDrawUsage);
  aParam.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aParam', aParam);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uWind: U.uWind,
      uCamRight: { value: new THREE.Vector3(1, 0, 0) },
      uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  scene.add(mesh);

  const rng = mulberry32(0xf1a3e);
  const seeds = new Float32Array(max);
  for (let i = 0; i < max; i++) seeds[i] = rng();

  function update(dt, burning, inten, cellToWorld, groundY, cell) {
    let c = 0;
    for (const i of burning) {
      if (c >= max) break;
      const v = inten[i];
      if (v < 0.06) continue;
      const [x, z] = cellToWorld(i);
      const s = seeds[c];
      // Scatter a few flames inside the cell so the front is not a grid.
      const jx = (((i * 2654435761) >>> 0) / 4294967296 - 0.5) * cell * 0.8;
      const jz = (((i * 40503) >>> 0) / 4294967296 - 0.5) * cell * 0.8;
      aPos.array[c * 3] = x + jx;
      aPos.array[c * 3 + 1] = groundY[i] - 1.0;
      aPos.array[c * 3 + 2] = z + jz;
      aParam.array[c * 4] = (7 + 20 * v) * (0.65 + s * 0.7);
      aParam.array[c * 4 + 1] = s * 100;
      aParam.array[c * 4 + 2] = v;
      aParam.array[c * 4 + 3] = s * 62.8;
      c++;
    }
    geo.instanceCount = c;
    aPos.addUpdateRange(0, c * 3); aPos.needsUpdate = true;
    aParam.addUpdateRange(0, c * 4); aParam.needsUpdate = true;
  }

  /**
   * Drive the same pool from an explicit list rather than from the automaton.
   * A burning drum is not a fifty-metre cell and has no business pretending to
   * be one: the ground mode needs flames a metre and a half tall standing on a
   * specific object, and this is the same shader at a different scale.
   * Each item is `{x, y, z, size, v}`.
   */
  function paint(list) {
    let c = 0;
    for (const it of list) {
      if (c >= max) break;
      const s = seeds[c];
      aPos.array[c * 3] = it.x;
      aPos.array[c * 3 + 1] = it.y;
      aPos.array[c * 3 + 2] = it.z;
      aParam.array[c * 4] = it.size * (0.78 + s * 0.5);
      aParam.array[c * 4 + 1] = s * 100;
      aParam.array[c * 4 + 2] = it.v;
      aParam.array[c * 4 + 3] = s * 62.8;
      c++;
    }
    geo.instanceCount = c;
    aPos.addUpdateRange(0, c * 3); aPos.needsUpdate = true;
    aParam.addUpdateRange(0, c * 4); aParam.needsUpdate = true;
  }

  return { mesh, mat, update, paint };
}

// ------------------------------------------------------------------- smoke ---

const SMOKE_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aParam;      // x: size, y: seed, z: opacity, w: age 0..1

varying vec2 vUv;
varying vec4 vParam;
varying vec3 vWorld;

uniform vec3 uCamRight;
uniform vec3 uCamUp;

void main(){
  vUv = uv;
  vParam = aParam;
  float s = aParam.x;
  // Full billboard here: smoke has no up.
  float a = aParam.y * 6.2831 + aParam.w * 0.6;
  float ca = cos(a), sa = sin(a);
  vec2 r = vec2(position.x * ca - position.y * sa, position.x * sa + position.y * ca);
  vec3 p = aPos + uCamRight * (r.x * s) + uCamUp * (r.y * s);
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const SMOKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec4 vParam;
varying vec3 vWorld;

uniform float uTime;
uniform vec3 uAmbSky;
uniform float uAmbI;

${GLSL_NOISE}
${GLSL_SKY}
${GLSL_HAZE}

void main(){
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;

  float seed = vParam.y;
  float age = vParam.w;

  // Soft puff eaten into by noise, so the edge is ragged rather than round.
  float n = fbm2(d * 3.4 + seed * 41.0 + vec2(0.0, -uTime * 0.05), 4);
  float a = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.75);
  a *= vParam.z;
  if (a <= 0.004) discard;

  // Fresh smoke off a fire this hot is brown-black; it greys and thins as it
  // rises and mixes, and the sunlit side of the column goes almost white.
  vec3 dark = vec3(0.085, 0.070, 0.062);
  vec3 pale = vec3(0.62, 0.60, 0.60);
  vec3 col = mix(dark, pale, smoothstep(0.0, 0.75, age));

  // Cheap directional shading: the side of the puff facing the sun is lit.
  float lit = dot(normalize(vec3(d.x, d.y, 0.55)), normalize(uSunDir)) * 0.5 + 0.5;
  col *= 0.62 + 0.85 * lit * (0.35 + 0.65 * age);
  col = mix(col, col * vec3(1.25, 0.72, 0.48), (1.0 - age) * 0.55);

  vec3 viewDir = normalize(vWorld - uCamPos);
  col = applyHaze(col, length(vWorld - uCamPos), vWorld, uSunDir, viewDir);

  gl_FragColor = vec4(col, a);
}
`;

function buildSmoke(scene, max) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.attributes.position = quad.attributes.position;
  geo.attributes.uv = quad.attributes.uv;
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const aParam = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  aPos.setUsage(THREE.DynamicDrawUsage);
  aParam.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aParam', aParam);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareLight(), ...shareHaze(),
      uCamPos: U.uCamPos,
      uCamRight: { value: new THREE.Vector3(1, 0, 0) },
      uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: SMOKE_VERT,
    fragmentShader: SMOKE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 25;
  scene.add(mesh);

  // A pool of puffs, recycled. Each is born at a burning cell and rides the
  // wind up and downwind until it fades.
  const P = { x: new Float32Array(max), y: new Float32Array(max), z: new Float32Array(max),
    vx: new Float32Array(max), vy: new Float32Array(max), vz: new Float32Array(max),
    life: new Float32Array(max), maxLife: new Float32Array(max),
    size: new Float32Array(max), seed: new Float32Array(max) };
  const rng = mulberry32(0x5017e);
  for (let i = 0; i < max; i++) { P.life[i] = 0; P.seed[i] = rng(); }
  let cursor = 0;
  let emitAcc = 0;

  function update(dt, burning, inten, cellToWorld, groundY) {
    const wx = Math.cos(state.windDir) * state.windSpeed;
    const wz = Math.sin(state.windDir) * state.windSpeed;

    // Emit in proportion to how much is alight, capped so a huge fire does not
    // starve the pool of long-lived puffs high in the column.
    emitAcc += dt * Math.min(120, 6 + burning.size * 0.55);
    const list = burning.size ? Array.from(burning) : null;
    while (emitAcc >= 1 && list) {
      emitAcc -= 1;
      const i = list[(rng() * list.length) | 0];
      const v = inten[i];
      if (v < 0.12) continue;
      const [x, z] = cellToWorld(i);
      const k = cursor = (cursor + 1) % max;
      P.x[k] = x + (rng() - 0.5) * 40;
      P.z[k] = z + (rng() - 0.5) * 40;
      P.y[k] = groundY[i] + 4 + rng() * 12;
      // Buoyancy scales with intensity — a running crown fire lofts smoke
      // several hundred metres before the wind takes it.
      P.vy[k] = 5 + v * 16 + rng() * 5;
      P.vx[k] = wx * 0.25 + (rng() - 0.5) * 3;
      P.vz[k] = wz * 0.25 + (rng() - 0.5) * 3;
      P.maxLife[k] = 26 + rng() * 30;
      P.life[k] = P.maxLife[k];
      P.size[k] = 22 + rng() * 26;
      P.seed[k] = rng();
    }

    let c = 0;
    for (let i = 0; i < max; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      if (P.life[i] <= 0) continue;
      const age = 1 - P.life[i] / P.maxLife[i];

      // Rising smoke loses buoyancy and picks up the ambient wind.
      P.vy[i] = damp(P.vy[i], 0.6, 0.28, dt);
      P.vx[i] = damp(P.vx[i], wx, 0.22, dt);
      P.vz[i] = damp(P.vz[i], wz, 0.22, dt);
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      P.z[i] += P.vz[i] * dt;

      if (c >= max) break;
      aPos.array[c * 3] = P.x[i];
      aPos.array[c * 3 + 1] = P.y[i];
      aPos.array[c * 3 + 2] = P.z[i];
      aParam.array[c * 4] = P.size[i] * (0.55 + age * 2.6);
      aParam.array[c * 4 + 1] = P.seed[i];
      aParam.array[c * 4 + 2] = Math.min(1, age * 6) * (1 - age) * 0.85;
      aParam.array[c * 4 + 3] = age;
      c++;
    }
    geo.instanceCount = c;
    aPos.addUpdateRange(0, c * 3); aPos.needsUpdate = true;
    aParam.addUpdateRange(0, c * 4); aParam.needsUpdate = true;
  }

  return { mesh, mat, update };
}
