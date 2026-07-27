// -----------------------------------------------------------------------------
// The Adriatic.
//
// One camera-centred grid whose spacing is warped by a cubic, so the same 90k
// quads give sub-metre chop under the hull on a scooping run and still reach
// past the far islands. The seabed comes out of the same height texture as the
// land, which is what puts the turquoise shelf exactly where the shallows are.
// -----------------------------------------------------------------------------

const SEA = {
  n: 320,             // quads per side
  reach: 17000,       // metres from the camera to the outer ring
  near: 1.5,          // metres at the very centre; sets the exponential rate
  waveScale: 1.0,
};

const SEA_VERT = /* glsl */ `
precision highp float;

uniform vec2 uCenter;
uniform float uReach;
uniform float uNear;
uniform float uK;
uniform float uWaveScale;
uniform vec2 uWind;
uniform float uWindSpeed;

varying vec3 vWorld;
varying vec3 vWaveN;
varying float vFoamCrest;

${GLSL_TERRAIN}

/**
 * Three Gerstner waves along the wind plus one across it. Amplitudes are the
 * Adriatic in a fresh breeze — this is a shallow, fetch-limited sea, so the
 * chop is short and steep rather than long and rolling.
 */
void gerstner(vec2 p, float t, out float h, out vec3 n, out float crest){
  h = 0.0;
  vec3 acc = vec3(0.0, 1.0, 0.0);
  crest = 0.0;
  vec2 w = normalize(uWind + vec2(1e-4));
  float amp = 0.34 * uWaveScale * (0.45 + 0.055 * uWindSpeed);

  // dir, wavelength, amplitude scale, speed scale
  const int N = 4;
  vec2 dirs[N];
  dirs[0] = w;
  dirs[1] = normalize(w + vec2(-w.y, w.x) * 0.42);
  dirs[2] = normalize(w - vec2(-w.y, w.x) * 0.55);
  dirs[3] = normalize(vec2(-w.y, w.x) + w * 0.25);
  float lens[N]; lens[0] = 46.0; lens[1] = 23.0; lens[2] = 13.0; lens[3] = 7.5;
  float amps[N]; amps[0] = 1.0;  amps[1] = 0.55; amps[2] = 0.30; amps[3] = 0.16;

  for (int i = 0; i < N; i++){
    float k = 6.2831853 / lens[i];
    float c = sqrt(9.81 / k);
    float a = amp * amps[i];
    float ph = dot(dirs[i], p) * k + t * c * k * 0.42;
    float s = sin(ph), cs = cos(ph);
    h += a * s;
    acc.x -= dirs[i].x * k * a * cs;
    acc.z -= dirs[i].y * k * a * cs;
    if (i < 2) crest += a * k * s;
  }
  n = normalize(acc);
}

void main(){
  // position.xz is in [-1,1]. Map it exponentially: sub-metre quads under the
  // hull on a scooping run, ~10 m at 150 m out, ~150 m at 2.5 km, reaching the
  // horizon at the rim. A power curve cannot do all three at once.
  // Warp the *radius*, not each axis. Scaling x and y independently makes the
  // quads near the axes 17 km long and centimetres wide — slivers fanning out
  // from the camera — and interpolating anything across those is what drew the
  // stripes over the whole sea. Concentric square rings stay isotropic.
  vec2 u = position.xz;
  float m = max(abs(u.x), abs(u.y));
  vec2 dir = m > 1e-5 ? u / m : vec2(0.0);
  vec2 warped = dir * (uNear * (exp(uK * m) - 1.0));
  vec2 wxz = uCenter + warped;

  float h; vec3 n; float crest;
  // The shortest wave here is 7.5 m and the longest 46 m, and the lattice
  // spacing passes 6 m at about 100 m out. Carrying the Gerstner normal any
  // further than that samples the wave less than once a crest and the aliasing
  // shows up as fixed bands locked to the grid. Hand over to the per-pixel
  // detail normal instead.
  float near = 1.0 - smoothstep(70.0, 240.0, length(warped));
  gerstner(wxz, uTime, h, n, crest);
  h *= near;

  vWorld = vec3(wxz.x, h, wxz.y);
  vWaveN = normalize(mix(vec3(0.0, 1.0, 0.0), n, near));
  vFoamCrest = crest * near;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const SEA_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uCover;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;
uniform float uNight;
uniform vec2 uWind;

varying vec3 vWorld;
varying vec3 vWaveN;
varying float vFoamCrest;

${GLSL_NOISE}
${GLSL_TERRAIN}
${GLSL_SKY}
${GLSL_HAZE}

void main(){
  vec3 viewDir = normalize(vWorld - uCamPos);
  float dist = length(vWorld - uCamPos);

  // ── detail normal ───────────────────────────────────────────────────────
  // Two scrolling octaves, faded out with distance so the far sea does not
  // sparkle into aliasing.
  vec2 w = normalize(uWind + vec2(1e-4));
  // Procedural noise has no mip chain, and distance alone cannot stand in for
  // one: looking along the water at a shallow angle, a single pixel row covers
  // hundreds of metres of sea even though the distance is small. fwidth gives the
  // true footprint, so drive the ripple period straight off it and keep it at
  // roughly ten pixels whatever the angle. This is the whole fix for the
  // banding — everything else was treating the symptom.
  float fw = max(length(fwidth(vWorld.xz)), 0.0025);
  float f1 = 1.0 / max(3.2, fw * 10.0);
  float f2 = 1.0 / max(1.4, fw * 4.2);
  // Once a pixel genuinely covers many waves there is no detail left to show;
  // fade the perturbation out rather than letting it turn into noise.
  float det = 1.0 - smoothstep(3.0, 30.0, fw);
  vec2 p1 = vWorld.xz * f1 + w * uTime * 1.1;
  vec2 p2 = vWorld.xz * f2 - w * uTime * 0.7;
  float e = 0.55;
  vec2 grad = vec2(
    fbm2(p1 + vec2(e, 0.0), 3) - fbm2(p1 - vec2(e, 0.0), 3),
    fbm2(p1 + vec2(0.0, e), 3) - fbm2(p1 - vec2(0.0, e), 3)
  ) * 1.5;
  grad += vec2(
    fbm2(p2 + vec2(e, 0.0), 2) - fbm2(p2 - vec2(e, 0.0), 2),
    fbm2(p2 + vec2(0.0, e), 2) - fbm2(p2 - vec2(0.0, e), 2)
  ) * 0.7;
  vec3 n = normalize(vWaveN + vec3(-grad.x, 0.0, -grad.y) * det * 0.9);
  // Far water must be *rougher*, not sharper: flatten the normal and widen the
  // highlight as a pixel starts to cover many waves, or the glitter aliases
  // into banding all the way to the horizon.
  float far = smoothstep(1.2, 18.0, fw);
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), far * 0.88));

  // ── depth ───────────────────────────────────────────────────────────────
  float bed = heightAt(vWorld.xz);
  float depth = max(0.0, -bed);
  vec4 cv = texture2D(uCover, worldToUv(vWorld.xz));

  // Dalmatian water: almost colourless over white shingle, through turquoise,
  // to a very dark saturated blue once the bottom is out of sight.
  vec3 shallow = vec3(0.42, 0.78, 0.74);
  vec3 mid     = vec3(0.06, 0.42, 0.52);
  vec3 deep    = vec3(0.012, 0.055, 0.135);
  float t1 = smoothstep(0.0, 6.5, depth);
  float t2 = smoothstep(4.0, 26.0, depth);
  vec3 body = mix(mix(shallow, mid, t1), deep, t2);

  // The bottom shows through in the shallows, lit by caustics.
  float seeBed = 1.0 - smoothstep(0.0, 9.0, depth);
  float caust = fbm2(vWorld.xz * 0.42 + vec2(sin(uTime * 0.5), cos(uTime * 0.42)) * 0.8, 3);
  caust = pow(max(caust, 0.0), 2.2);
  body += vec3(0.55, 0.72, 0.62) * caust * seeBed * 0.34;

  // ── reflection ──────────────────────────────────────────────────────────
  vec3 r = reflect(viewDir, n);
  r.y = abs(r.y);
  vec3 sky = skyColor(r, false);

  float f0 = 0.021;
  float fres = f0 + (1.0 - f0) * pow(1.0 - max(dot(-viewDir, n), 0.0), 5.0);
  fres = clamp(fres, 0.0, 1.0);

  vec3 col = mix(body * (uAmbSky * uAmbI * 1.5 + uSunColor * uSunI * 0.16), sky, fres);

  // ── sun glitter ─────────────────────────────────────────────────────────
  // Wide and dirty rather than a clean highlight: at this scale each glint is
  // thousands of facets, so the lobe has to be broad or it strobes.
  vec3 hv = normalize(uSunDir - viewDir);
  float sharp = mix(220.0, 26.0, far);
  float spec = pow(max(dot(n, hv), 0.0), sharp);
  float broad = pow(max(dot(n, hv), 0.0), 18.0);
  col += uSunColor * uSunI * (spec * 2.4 * (1.0 - far * 0.55) + broad * 0.22);

  // ── foam ────────────────────────────────────────────────────────────────
  // Crest foam where the wave is steep, and a band along every shoreline.
  float shoreT = 1.0 - smoothstep(0.0, 0.030, cv.a);
  float surf = smoothstep(0.35, 0.9, shoreT)
             * (0.55 + 0.45 * sin(vWorld.x * 0.16 + vWorld.z * 0.13 - uTime * 1.7));
  float crest = smoothstep(0.55, 1.15, vFoamCrest) * (1.0 - far);
  float foamNoise = fbm2(vWorld.xz * 0.6 + uTime * 0.25, 3);
  float foam = clamp(surf * 0.9 + crest * 0.7, 0.0, 1.0) * smoothstep(0.25, 0.75, foamNoise + 0.28);
  col = mix(col, vec3(0.92, 0.96, 0.97), foam * 0.85);

  col = applyHaze(col, dist, vWorld, uSunDir, viewDir);
  gl_FragColor = vec4(col, 1.0);
}
`;

function buildSea(scene) {
  const n = SEA.n;
  const geo = new THREE.PlaneGeometry(2, 2, n, n);
  geo.rotateX(-Math.PI / 2);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareLight(), ...shareHaze(), ...shareTerrain(),
      uCover: U.uCover,
      uCamPos: U.uCamPos,
      uWind: U.uWind,
      uWindSpeed: U.uWindSpeed,
      uCenter: { value: new THREE.Vector2() },
      uReach: { value: SEA.reach },
      uNear: { value: SEA.near },
      uK: { value: Math.log(SEA.reach / SEA.near + 1) },
      uWaveScale: { value: SEA.waveScale },
    },
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);

  function update(camera) {
    // Snap the centre so the warped lattice does not shimmer as you move.
    const s = 8;
    mat.uniforms.uCenter.value.set(
      Math.round(camera.position.x / s) * s,
      Math.round(camera.position.z / s) * s,
    );
  }

  return { mesh, mat, update };
}
