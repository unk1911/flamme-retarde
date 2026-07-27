// -----------------------------------------------------------------------------
// Water in the air: the rooster tail off the probes on a scooping run, and the
// curtain of six tonnes leaving the hull over a fire.
//
// Same instanced-billboard machinery as the smoke, different physics and a
// different shader — droplets are bright, short-lived and lit from behind.
// -----------------------------------------------------------------------------

const SPRAY_FRAG = /* glsl */ `
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

  float age = vParam.w;
  float n = fbm2(d * 4.2 + vParam.y * 53.0, 3);
  float a = smoothstep(1.0, 0.05, r + (n - 0.5) * 0.55) * vParam.z;
  if (a <= 0.004) discard;

  // Water thrown into sunlight is nearly white where it is dense and blue-grey
  // where it has thinned into mist.
  vec3 col = mix(vec3(0.97, 0.99, 1.0), vec3(0.60, 0.74, 0.80), smoothstep(0.0, 0.6, age));
  // Backlight: the sun through a sheet of droplets is the whole look.
  float back = pow(max(dot(normalize(vWorld - uCamPos), uSunDir), 0.0), 6.0);
  col += uSunColor * back * 0.85;
  col *= 0.55 + 0.75 * uAmbI + uSunI * 0.12;

  vec3 viewDir = normalize(vWorld - uCamPos);
  col = applyHaze(col, length(vWorld - uCamPos), vWorld, uSunDir, viewDir);
  gl_FragColor = vec4(col, a * 0.9);
}
`;

function buildSprayPool(scene, max, gravity, drag) {
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
    fragmentShader: SPRAY_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 22;
  scene.add(mesh);

  const P = {
    x: new Float32Array(max), y: new Float32Array(max), z: new Float32Array(max),
    vx: new Float32Array(max), vy: new Float32Array(max), vz: new Float32Array(max),
    life: new Float32Array(max), maxLife: new Float32Array(max),
    size: new Float32Array(max), grow: new Float32Array(max), seed: new Float32Array(max),
  };
  const rng = mulberry32(0x7a7e5);
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, size, life, grow) {
    const k = cursor = (cursor + 1) % max;
    P.x[k] = x; P.y[k] = y; P.z[k] = z;
    P.vx[k] = vx; P.vy[k] = vy; P.vz[k] = vz;
    P.size[k] = size; P.grow[k] = grow;
    P.maxLife[k] = life; P.life[k] = life;
    P.seed[k] = rng();
  }

  function update(dt) {
    let c = 0;
    for (let i = 0; i < max; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      if (P.life[i] <= 0) continue;
      const age = 1 - P.life[i] / P.maxLife[i];
      P.vy[i] -= gravity * dt;
      const d = 1 - drag * dt;
      P.vx[i] *= d; P.vy[i] *= d; P.vz[i] *= d;
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
      // Kill anything that reaches the surface — it has landed.
      const surf = isSea(P.x[i], P.z[i]) ? 0 : groundAt(P.x[i], P.z[i]);
      if (P.y[i] < surf) { P.life[i] = 0; continue; }

      aPos.array[c * 3] = P.x[i];
      aPos.array[c * 3 + 1] = P.y[i];
      aPos.array[c * 3 + 2] = P.z[i];
      aParam.array[c * 4] = P.size[i] * (1 + age * P.grow[i]);
      aParam.array[c * 4 + 1] = P.seed[i];
      aParam.array[c * 4 + 2] = Math.min(1, (1 - age) * 2.2) * 0.85;
      aParam.array[c * 4 + 3] = age;
      c++;
      if (c >= max) break;
    }
    geo.instanceCount = c;
    aPos.addUpdateRange(0, c * 3); aPos.needsUpdate = true;
    aParam.addUpdateRange(0, c * 4); aParam.needsUpdate = true;
  }

  return { spawn, update, mesh, rng };
}

let dropSplashes = null;
let scoopSpray = null;

function buildWaterFX(scene) {
  const drops = buildSprayPool(scene, 1400, 9.0, 0.55);
  const spray = buildSprayPool(scene, 900, 11.0, 1.9);

  dropSplashes = {
    /** A tonne of water leaving the hull: a dense curtain that spreads as it falls. */
    emit(x, z, litres, fwd) {
      const n = Math.min(14, 2 + (litres / 90) | 0);
      for (let i = 0; i < n; i++) {
        const s = drops.rng();
        drops.spawn(
          x + (drops.rng() - 0.5) * 12, groundAt(x, z) + 2 + drops.rng() * 6, z + (drops.rng() - 0.5) * 12,
          fwd.x * 14 + (drops.rng() - 0.5) * 9, -6 - s * 9, fwd.z * 14 + (drops.rng() - 0.5) * 9,
          9 + s * 16, 1.6 + s * 1.6, 2.4,
        );
      }
    },
    update: drops.update,
  };

  scoopSpray = {
    /** The rooster tail: two sheets thrown up and out behind the probes. */
    emit(pos, fwd, right, speed, dt) {
      const n = Math.min(9, Math.ceil(speed * dt * 0.9));
      for (let i = 0; i < n; i++) {
        const s = spray.rng();
        const side = s > 0.5 ? 1 : -1;
        spray.spawn(
          pos.x + right.x * side * 0.9 - fwd.x * 2, 0.4, pos.z + right.z * side * 0.9 - fwd.z * 2,
          -fwd.x * speed * 0.16 + right.x * side * (5 + s * 7) + (s - 0.5) * 4,
          5 + s * 10,
          -fwd.z * speed * 0.16 + right.z * side * (5 + s * 7) + (s - 0.5) * 4,
          1.6 + s * 2.6, 0.9 + s * 0.9, 4.5,
        );
      }
    },
    update: spray.update,
  };

  return {
    update(dt) { drops.update(dt); spray.update(dt); },
  };
}
