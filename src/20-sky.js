// -----------------------------------------------------------------------------
// Sky dome and clouds.
//
// The dome is the sky function on the inside of a box drawn at the far plane.
// Clouds are analytic: the view ray is intersected with two slabs and the noise
// is sampled there, which costs nothing and — because it is the same fbm the
// terrain uses — reads as the same afternoon.
// -----------------------------------------------------------------------------

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  // Strip translation from the view matrix: the dome is infinitely far away.
  vDir = position;
  mat4 rotOnly = viewMatrix;
  rotOnly[3] = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 p = projectionMatrix * rotOnly * vec4(position, 1.0);
  gl_Position = p.xyww;      // force z = w, i.e. the far plane
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;

uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;
uniform float uNight;
uniform vec2 uWind;
uniform float uWindSpeed;
uniform float uCloud;
uniform float uTime;
uniform vec3 uSmokeTint;
uniform float uSmokeAmt;

${GLSL_NOISE}
${GLSL_SKY}

/**
 * Two slabs of fair-weather cumulus. Where the ray crosses each slab we sample
 * fbm and shade the result by how much brighter the sample is on the sunward
 * side — a one-tap fake of self-shadowing that is enough at this distance.
 */
vec4 cloudLayer(vec3 dir, float height, float scale, float cover, float t,
                float shear){
  if (dir.y < 0.012) return vec4(0.0);
  float dist = height / dir.y;
  if (dist > 90000.0) return vec4(0.0);
  // ── HOW FAST THE SKY MOVES, AND IT WAS MACH 8 ────────────────────────────
  //
  // Reported as "I would slow down the clouds", and the number is worth
  // writing down because it is not a matter of taste.
  //
  // The drift used to be added in NOISE SPACE, as dir.xz * dist * scale plus
  // uWind * t * 0.9, which sails straight past the fact that one noise unit is
  // 1/scale metres of sky. At the low slab's 0.00034 that is 2 941 m, so 0.9
  // units a second is 2 647 m/s — and the high slab, being coarser, was doing
  // 3 375. Fair-weather cumulus over this channel move at the wind: uWindSpeed
  // is 9 m/s and has been sitting in the shared uniforms the whole time,
  // unread by this file.
  //
  // So the wind goes INSIDE the scale with the ray, which is the only place it
  // can be expressed in metres, and the two slabs stop having to be tuned
  // against each other by hand: whatever scale a layer picks, its drift is
  // uWindSpeed * shear metres a second and stays that when the scale moves.
  //
  // (No backticks in here. This is inside a template literal and one of them
  // ends it — the build then fails on the shader's own prose, which has cost
  // this project four separate evenings.)
  //
  // A cumulus is about one noise unit across, so at 9 m/s the low sky takes
  // five and a half minutes to move a cloud's own width. That is what a summer
  // sky does, and it is still motion you can see across a session.
  vec2 p = (dir.xz * dist + uWind * uWindSpeed * shear * t) * scale;

  float n = fbm2(p, 5);
  float d = smoothstep(cover, cover + 0.22, n);
  if (d <= 0.001) return vec4(0.0);

  // Sunward sample, for the bright edge that makes cumulus read as volume.
  vec2 sp = p + uSunDir.xz * 0.13;
  float ns = fbm2(sp, 4);
  float lit = smoothstep(-0.06, 0.20, ns - n);

  vec3 lightSide = uSunColor * (1.35 + 0.9 * lit);
  vec3 shade = mix(uAmbSky * 1.9, vec3(0.60, 0.62, 0.68), 0.45);
  vec3 col = mix(shade, lightSide, 0.30 + 0.62 * lit);

  // Fade into the haze at the horizon rather than stopping dead.
  float fade = smoothstep(0.012, 0.10, dir.y) * (1.0 - smoothstep(30000.0, 88000.0, dist));
  return vec4(col, d * fade);
}

void main(){
  vec3 dir = normalize(vDir);
  vec3 col = skyColor(dir, true);

  float t = uTime;
  // Shear, and it is the reason the two slabs are worth having. The gradient
  // wind at 3 400 m runs about half again the 1 750 m wind, so the high sheet
  // visibly overtakes the low one — which is a thing a real sky does and a
  // thing you cannot get from one layer at any speed. The old 0.6 on the high
  // slab said the opposite, and only because the number was being used to
  // fight a drift that was three orders of magnitude too fast to begin with.
  vec4 hi = cloudLayer(dir, 3400.0, 0.00016, 0.56, t, 1.45);
  vec4 lo = cloudLayer(dir, 1750.0, 0.00034, 0.60, t, 1.0);
  col = mix(col, hi.rgb, hi.a * 0.55 * uCloud);
  col = mix(col, lo.rgb, lo.a * 0.80 * uCloud);

  // The pall. Everything the smoke column has thrown up sits in the western
  // half of the sky and turns it the colour of a struck match.
  float low = 1.0 - smoothstep(0.0, 0.36, dir.y);
  col = mix(col, uSmokeTint * 1.5, uSmokeAmt * low * 0.5);

  gl_FragColor = vec4(col, 1.0);
}
`;

function buildSky(scene) {
  const geo = new THREE.BoxGeometry(2, 2, 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareLight(),
      uTime: U.uTime,
      uWind: U.uWind,
      uWindSpeed: U.uWindSpeed,
      uSmokeTint: U.uSmokeTint,
      uSmokeAmt: U.uSmokeAmt,
      uCloud: { value: 1 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  scene.add(mesh);
  return { mesh, mat };
}
