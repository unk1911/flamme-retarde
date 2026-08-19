// -----------------------------------------------------------------------------
// The volume.
//
// 25-sea.js draws the surface and 10-world.js draws the bottom, and between
// them there was nothing at all — which is exactly what was wrong. Everything
// anybody has ever noticed about being under water happens in the water and
// not on either of its faces: the shafts coming down through the swell, the
// dust hanging in them, the way the light gets colder and heavier as you go
// down. Without those it is a green room with a floor.
//
// Two objects here and they are the two halves of one thing, because a shaft
// of light under water and a caustic on the sand are the same phenomenon seen
// end-on and side-on. The surface focuses the sun into sheets; where a sheet
// lands on the bottom it is a caustic, and where it passes through the water it
// is a shaft, and it is a shaft only because there is something in the water to
// scatter off. So the motes and the shafts share their noise and their drift,
// and if you find yourself editing one to match the other, edit both.
//
// Neither is drawn unless the eye is under the surface. Above it, both meshes
// are invisible and cost nothing at all.
// -----------------------------------------------------------------------------

const UNDER = {
  motes: 3200,
  // The box the dust lives in, wrapped around the camera so it is always
  // around you and never has to be culled or respawned. 22 m: past that the
  // extinction has taken the grains anyway and they are wasted vertices.
  box: 17,
  drift: 0.13,          // m/s — the residual set, which is nearly nothing
  rise: 0.045,          // and the slow upward crawl of the lighter half of it
};

const MOTE_VERT = /* glsl */ `
precision highp float;

attribute vec3 aSeed;      // position in the unit box, plus a phase in .z

uniform vec3 uCamPos;
uniform float uBox;
uniform float uDrift;
uniform float uRise;
uniform float uPixel;      // half the drawing buffer height, for the point size

varying float vFade;
varying float vBright;

${GLSL_TERRAIN}

void main(){
  // Wrap the box on to the camera in x and z, so the dust is always around you
  // and never has to be culled or respawned.
  vec3 p = aSeed * uBox;
  p.x += uTime * uDrift * (0.6 + aSeed.z * 0.8);
  p.z -= uTime * uDrift * (0.4 + aSeed.x * 0.5);
  p.y += uTime * uRise * (0.3 + aSeed.y);
  vec2 origin = uCamPos.xz - uBox * 0.5;
  vec3 w = vec3(origin.x + mod(p.x - origin.x, uBox), 0.0,
                origin.y + mod(p.z - origin.y, uBox));

  // Vertically it is not a box, because the water is not one: it has a lid and
  // it has a floor, and a grain of dust is only ever between them. Wrapping y
  // the same way as x and z put half of them in the air and the other half
  // inside the seabed, which is why the first version of this was invisible.
  float top = min(-0.06, uCamPos.y + uBox * 0.5);
  w.y = top - mod(top - p.y, uBox);
  float bedY = heightAt(w.xz);
  // Anything below the bottom is folded back to just above it, which is not a
  // fudge: suspended matter is thickest in the first half metre over the sand,
  // because that is where the swell keeps putting it back.
  w.y = max(w.y, bedY + 0.08 + fract(aSeed.z * 37.1) * 0.55);
  w.y = min(w.y, top);

  float d = distance(w, uCamPos);
  // Out at the edge of the box they go, and they go before they reach it —
  // a grain that pops in at a hard boundary is more visible than the grain.
  vFade = (1.0 - smoothstep(uBox * 0.30, uBox * 0.48, d))
        * smoothstep(0.35, 1.4, d);
  // Some of it is mineral and catches the light, most of it is not.
  vBright = 0.35 + 0.9 * pow(fract(aSeed.x * 71.3 + aSeed.y * 13.7), 3.0);

  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPixel * (0.010 + 0.016 * aSeed.z) / max(d, 0.3), 1.0, 9.0);
}
`;

const MOTE_FRAG = /* glsl */ `
precision highp float;

uniform vec3 uTint;

varying float vFade;
varying float vBright;

void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  float a = (1.0 - r) * (1.0 - r) * vFade * vBright;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uTint * a, a);
}
`;

// ── the shafts ───────────────────────────────────────────────────────────────
//
// One full-screen triangle, additive, drawn last and depth-tested away by
// nothing, which is right: a shaft is in front of whatever it crosses because
// it is between that thing and your mask. What stops it glowing through a rock
// two hundred metres off is that it has no reach — it is faded out by the same
// water that everything else here is faded out by, and there is no light left
// in it past about fifteen metres.

const SHAFT_VERT = /* glsl */ `
precision highp float;
varying vec2 vNdc;
void main(){
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

const SHAFT_FRAG = /* glsl */ `
precision highp float;

uniform mat4 uInvVP;
uniform float uStrength;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunI;

varying vec2 vNdc;

${GLSL_NOISE}
${GLSL_WATER}

void main(){
  // The view ray, out of the inverse view-projection. One matrix and no
  // geometry: the alternative is a cone of quads that has to be re-aimed at
  // the sun every frame and is wrong at the edges of the field of view.
  vec4 far = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 rd = normalize(far.xyz / far.w - uCamPos);

  // How much water is in front of this ray. Capped, because there is no light
  // left past twenty-odd metres and marching further is marching for nothing;
  // and cut short where the ray leaves the water, because above the surface
  // there is no shaft, there is only sky.
  float span = 22.0;
  if (rd.y > 1.0e-3) span = min(span, -uCamPos.y / rd.y);
  if (span <= 0.05) discard;

  // The sheet, marched.
  //
  // The first version of this sampled the surface once, where the ray came out
  // of the water, and it was wrong in a way worth writing down: what you get
  // is the caustic pattern painted flat across the screen — blobs, not beams.
  // A shaft is not a thing on the surface, it is the *integral* along the line
  // of sight of a sheet of light that is coming down at the sun's angle, and a
  // beam appears exactly where the line of sight and the sheet stay together
  // for a while. So march it, and at every step follow the sun back up to the
  // surface to ask what the surface was doing where this light got in.
  vec2 sxz = uSunDir.xz / max(uSunDir.y, 0.30);
  float cw = uTime * 0.42;
  float acc = 0.0;
  const int N = 7;
  for (int i = 0; i < N; i++) {
    vec3 pos = uCamPos + rd * (span * (float(i) + 0.5) / float(N));
    if (pos.y > -0.02) continue;
    vec2 q = pos.xz + sxz * (-pos.y);
    float c1 = ridge2(q * 0.55 + vec2(cw, cw * 0.6), 2);
    float c2 = ridge2(q * 0.81 - vec2(cw * 0.7, cw * 1.1) + 19.0, 2);
    // The same sharpening the bed's caustics get, because it is the same
    // sheet: it is a caustic where it lands and a shaft where it does not.
    acc += pow(max(c1 * c2, 0.0), 3.0) * exp(0.07 * pos.y);
  }
  acc *= span / float(N);

  // Forward scattering: a shaft is only bright looking into it. Not zero
  // across the beam, though — there is always some — or they blink out
  // entirely the moment you turn your head, which nothing real does.
  float al = max(dot(rd, uSunDir), 0.0);
  acc *= 0.22 + 0.78 * pow(al, 2.6);

  vec3 lit = exp(-uWaterK * max(0.0, uCamDepth) * 0.7);
  vec3 col = uSunColor * uSunI * lit * acc * uStrength;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Everything that lives between the surface and the bottom.
 *
 * `update` is handed how deep the eye is and whether it is under at all, and
 * that is the whole interface: both meshes are hidden the instant it is not,
 * so a mission flown entirely in the air pays one visibility test a frame.
 */
function buildUnder(scene) {
  // ── the dust ──────────────────────────────────────────────────────────────
  const n = UNDER.motes;
  const seed = new Float32Array(n * 3);
  const rnd = mulberry32(0x5eab);
  for (let i = 0; i < n; i++) {
    seed[i * 3] = rnd();
    seed[i * 3 + 1] = rnd();
    seed[i * 3 + 2] = rnd();
  }
  const mg = new THREE.BufferGeometry();
  // `position` is never read by the shader — the grain is placed from aSeed —
  // but three.js wants one to compute a draw range from, so it is the same
  // buffer under a second name rather than 2400 wasted vec3s.
  mg.setAttribute('position', new THREE.BufferAttribute(seed, 3));
  mg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  mg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const mmat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareTerrain(),
      uCamPos: U.uCamPos,
      uBox: { value: UNDER.box },
      uDrift: { value: UNDER.drift },
      uRise: { value: UNDER.rise },
      uPixel: { value: 400 },
      uTint: { value: new THREE.Color(0.62, 0.86, 0.84) },
    },
    vertexShader: MOTE_VERT,
    fragmentShader: MOTE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(mg, mmat);
  motes.frustumCulled = false;
  motes.renderOrder = 8;
  motes.visible = false;
  scene.add(motes);

  // ── the shafts ────────────────────────────────────────────────────────────
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -1, -1, 0, 3, -1, 0, -1, 3, 0,
  ]), 3));
  sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const smat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareLight(), ...shareWater(),
      uCamPos: U.uCamPos,
      uInvVP: { value: new THREE.Matrix4() },
      uStrength: { value: 0.105 },
    },
    vertexShader: SHAFT_VERT,
    fragmentShader: SHAFT_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shafts = new THREE.Mesh(sg, smat);
  shafts.frustumCulled = false;
  shafts.renderOrder = 9;
  shafts.visible = false;
  scene.add(shafts);

  const fish = buildFish(scene);

  const _inv = new THREE.Matrix4();
  const _size = new THREE.Vector2();

  function update(camera, depth, on, renderer, dt) {
    motes.visible = on;
    shafts.visible = on;
    // The fish keep swimming for a moment after you surface, because the
    // handover back to walking is not instant and a shoal that vanishes the
    // frame your head comes out is a shoal you saw vanish.
    fish.update(dt || 0, camera.position, on, (x, z) => groundAt(x, z));
    if (!on) return;
    _inv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    smat.uniforms.uInvVP.value.copy(_inv).invert();
    // The dust thins out with depth as the light that shows it does, and it
    // thickens again in the first metre or two where the swell is stirring the
    // bottom up. Nobody has ever seen clean water immediately under a beach.
    mmat.uniforms.uTint.value.setRGB(
      0.62 * Math.exp(-0.38 * depth * 0.5),
      0.86 * Math.exp(-0.052 * depth * 0.5),
      0.84 * Math.exp(-0.072 * depth * 0.5),
    );
    if (renderer) {
      const h = renderer.getDrawingBufferSize(_size).y;
      mmat.uniforms.uPixel.value = h * 0.5;
    }
  }

  return { motes, shafts, fish, update, mmat, smat,
    stats: () => ({ motes: UNDER.motes, fish: fish.count(),
      shoals: fish.where() }) };
}

// ── what lives in it ─────────────────────────────────────────────────────────
//
// A sea with nothing in it is an aquarium nobody has stocked yet, and the
// Adriatic off this shore is not empty: over the meadow there are clouds of
// salpa and picarel a hand long, and out over the sand a few bigger fish
// working on their own. That is two behaviours and it is worth having both,
// because a shoal reads as weather and a single fish reads as an animal.
//
// The shoals are anchored in the world rather than to the camera. A shoal that
// followed you would be a swarm; one that stays where it is and gets left
// behind is a shoal. When one falls too far astern it is re-placed ahead of
// you at a random bearing, which is the only cheat here and is invisible
// because it happens beyond the range at which anything is visible at all.

const FISH = {
  shoals: 3,
  per: 34,
  loners: 6,
  reach: 26,           // where a shoal is re-placed from, and where it dies
  mill: 0.55,          // rad/s the shoal turns over within itself
  cruise: 0.62,        // m/s a shoal makes good over the ground
  beat: 5.4,           // tail beats a second, which is fast and is correct
};

/**
 * One fish, nose down the +x axis, one unit long, painted with the
 * countershading that every open-water fish in the world has: dark over,
 * silver on the flank, white under. It is the whole of why a fish is hard to
 * see from above and hard to see from below, and it is also the only reason a
 * two-hundred-triangle lozenge reads as a fish at all.
 */
function fishGeometry() {
  const rings = [];
  // x from nose to the wrist of the tail, as (station, half-height, half-width)
  const prof = [
    [-0.50, 0.010, 0.008], [-0.42, 0.055, 0.030], [-0.30, 0.098, 0.048],
    [-0.14, 0.118, 0.056], [0.02, 0.112, 0.052], [0.18, 0.092, 0.041],
    [0.32, 0.062, 0.026], [0.40, 0.034, 0.013], [0.44, 0.020, 0.007],
  ];
  const seg = 8;
  for (const [x, hy, hz] of prof) {
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU;
      ring.push(new THREE.Vector3(x, Math.sin(a) * hy, Math.cos(a) * hz));
    }
    rings.push(ring);
  }
  const body = loft(rings, { closed: true, caps: false });

  // The tail, which is a flat fork and not a tube: two triangles either side of
  // the wrist, and the fork is what the eye actually recognises at ten metres.
  const tail = new THREE.BufferGeometry();
  const tv = new Float32Array([
    0.44, 0.0, 0.0, 0.62, 0.150, 0.0, 0.56, 0.0, 0.0,
    0.44, 0.0, 0.0, 0.56, 0.0, 0.0, 0.62, -0.150, 0.0,
  ]);
  tail.setAttribute('position', new THREE.BufferAttribute(tv, 3));
  tail.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 3, 4, 5]), 1));
  tail.computeVertexNormals();

  // And a dorsal, for the same reason.
  const fin = new THREE.BufferGeometry();
  const fv = new Float32Array([
    -0.16, 0.112, 0.0, 0.10, 0.088, 0.0, -0.04, 0.190, 0.0,
  ]);
  fin.setAttribute('position', new THREE.BufferAttribute(fv, 3));
  fin.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  fin.computeVertexNormals();

  const parts = [body, tail, fin];
  let nv = 0, ni = 0;
  for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const idx = new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nrm.set(g.attributes.normal.array, vo * 3);
    for (let i = 0; i < n; i++) {
      // Countershading, keyed on how high up the flank the vertex is.
      const y = pos[(vo + i) * 3 + 1];
      const t = Math.min(1, Math.max(0, (y + 0.12) / 0.24));
      const dark = [0.115, 0.175, 0.185], silver = [0.72, 0.755, 0.735];
      const pale = [0.90, 0.90, 0.87];
      const lo = t < 0.5 ? pale : silver, hi = t < 0.5 ? silver : dark;
      const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      col[(vo + i) * 3] = lo[0] + (hi[0] - lo[0]) * f;
      col[(vo + i) * 3 + 1] = lo[1] + (hi[1] - lo[1]) * f;
      col[(vo + i) * 3 + 2] = lo[2] + (hi[2] - lo[2]) * f;
    }
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += n; io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/**
 * The fish, as one instanced draw.
 *
 * The tail beat is done in the vertex shader as a travelling wave down the
 * body — amplitude rising toward the tail, which is how a fish actually swims
 * and costs one sine. Doing it on the CPU would mean a mesh per fish.
 */
function buildFish(scene) {
  const src = fishGeometry();
  const cap = FISH.shoals * FISH.per + FISH.loners;

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', src.attributes.position);
  geo.setAttribute('normal', src.attributes.normal);
  geo.setAttribute('aVCol', src.attributes.aVCol);
  geo.setIndex(src.index);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const aDir = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const aBio = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  for (const [n, a] of [['aInstPos', aPos], ['aInstDir', aDir], ['aInstBio', aBio]]) {
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(n, a);
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shareLight(), ...shareHaze(), ...shareWater(),
      uCamPos: U.uCamPos,
      uBeat: { value: FISH.beat },
    },
    side: THREE.DoubleSide,
    // Its own shader rather than solidMaterial's, for one reason: a fish is
    // the only thing in this game whose *shape* depends on where it is in its
    // own cycle, and the shared vertex program has nowhere to put a per
    // instance phase — its four instance attributes are all spoken for.
    vertexShader: /* glsl */ `
precision highp float;

attribute vec3 aVCol;
attribute vec3 aInstPos;
attribute vec3 aInstDir;    // yaw, pitch, and how hard this one is working
attribute vec3 aInstBio;    // length, phase, spare

uniform float uTime;
uniform float uBeat;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vVCol;

void main(){
  vec3 p = position;
  vec3 n = normal;

  // The travelling wave. Amplitude goes as the cube of the station, so the
  // nose barely moves and the wrist of the tail moves a great deal, which is
  // the difference between swimming and waggling. The phase runs *backwards*
  // down the body — the wave travels tail-ward, which is what pushes water
  // astern and is why a fish goes forwards.
  float st = clamp(p.x + 0.5, 0.0, 1.2);
  float amp = st * st * st * 0.30 * aInstDir.z;
  p.z += sin(uTime * uBeat + aInstBio.y - st * 3.1) * amp;

  p *= aInstBio.x;
  float cp = cos(aInstDir.y), sp = sin(aInstDir.y);
  p = vec3(p.x * cp - p.y * sp, p.x * sp + p.y * cp, p.z);
  n = vec3(n.x * cp - n.y * sp, n.x * sp + n.y * cp, n.z);
  float cy = cos(aInstDir.x), sy = sin(aInstDir.x);
  p = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
  n = vec3(n.x * cy - n.z * sy, n.y, n.x * sy + n.z * cy);
  p += aInstPos;

  vWorld = p;
  vNormal = normalize(n);
  vVCol = aVCol;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`,
    fragmentShader: /* glsl */ `
precision highp float;

uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;
uniform float uNight;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vVCol;

${GLSL_NOISE}
${GLSL_SKY}
${GLSL_HAZE}
${GLSL_WATER}

void main(){
  vec3 n = normalize(vNormal);
  n = gl_FrontFacing ? n : -n;
  vec3 viewDir = normalize(vWorld - uCamPos);
  vec3 base = vVCol;

  vec3 col = base * uSunColor * uSunI * max(dot(n, uSunDir), 0.0) * INV_PI;
  col += base * ambientAt(n, uAmbSky, uAmbGround, uAmbI) * INV_PI * 2.2;
  // A flank is a mirror, and at the angle where it flashes it is the brightest
  // thing down there. It is the whole reason you notice a shoal at all.
  vec3 hv = normalize(uSunDir - viewDir);
  col += uSunColor * pow(max(dot(n, hv), 0.0), 30.0) * 0.55;

  float dist = length(vWorld - uCamPos);
  col = applyHaze(col, dist, vWorld, uSunDir, viewDir);
  col = applyWater(col, dist, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.visible = false;
  scene.add(mesh);

  const rnd = mulberry32(0x1c7a);
  const shoals = [];
  for (let i = 0; i < FISH.shoals; i++) {
    shoals.push({ x: 0, z: 0, y: -3, hdg: rnd() * TAU, live: false,
      spread: 1.6 + rnd() * 1.4, big: rnd() < 0.3 });
  }
  const fish = [];
  for (let i = 0; i < FISH.shoals * FISH.per; i++) {
    fish.push({
      shoal: Math.floor(i / FISH.per),
      // Where this one sits inside its shoal: a bearing, a radius and a lift,
      // all of which it keeps, so the shoal has a shape rather than a cloud.
      a: rnd() * TAU, r: Math.sqrt(rnd()), h: (rnd() - 0.5), sp: 0.7 + rnd() * 0.6,
      len: 0.16 + rnd() * 0.09, phase: rnd() * TAU,
    });
  }
  for (let i = 0; i < FISH.loners; i++) {
    fish.push({
      shoal: -1, a: rnd() * TAU, r: 0, h: 0, sp: 0.5 + rnd() * 0.5,
      len: 0.34 + rnd() * 0.26, phase: rnd() * TAU,
      x: 0, z: 0, y: -4, hdg: rnd() * TAU, live: false,
    });
  }

  /** Put a wanderer somewhere ahead of the swimmer, out at the edge of sight. */
  function place(o, cx, cz, bedFn) {
    const a = rnd() * TAU;
    const d = FISH.reach * (0.55 + rnd() * 0.4);
    o.x = cx + Math.cos(a) * d;
    o.z = cz + Math.sin(a) * d;
    const bed = bedFn(o.x, o.z);
    if (bed > -1.4) { o.live = false; return; }
    // Fish are not evenly spread through the column: they hold station a little
    // off the bottom, over the meadow, which is where the food is.
    o.y = Math.max(bed + 0.6, Math.min(-0.9, bed + 0.8 + rnd() * 3.2));
    o.hdg = rnd() * TAU;
    o.live = true;
  }

  function update(dt, cam, on, bedFn) {
    mesh.visible = on;
    if (!on) return 0;
    const cx = cam.x, cz = cam.z;
    for (const s of shoals) {
      if (!s.live || Math.hypot(s.x - cx, s.z - cz) > FISH.reach * 1.25) {
        place(s, cx, cz, bedFn);
        continue;
      }
      s.hdg += (Math.sin(U.uTime.value * 0.21 + s.spread * 3.7)) * dt * 0.5;
      s.x += Math.cos(s.hdg) * FISH.cruise * dt;
      s.z += Math.sin(s.hdg) * FISH.cruise * dt;
      const bed = bedFn(s.x, s.z);
      s.y = Math.max(bed + 0.7, Math.min(-0.8, s.y));
    }
    for (const o of fish) if (o.shoal < 0) {
      if (!o.live || Math.hypot(o.x - cx, o.z - cz) > FISH.reach * 1.25) {
        place(o, cx, cz, bedFn);
        continue;
      }
      o.hdg += Math.sin(U.uTime.value * 0.17 + o.phase) * dt * 0.35;
      o.x += Math.cos(o.hdg) * FISH.cruise * 0.8 * dt;
      o.z += Math.sin(o.hdg) * FISH.cruise * 0.8 * dt;
      o.y = Math.max(bedFn(o.x, o.z) + 0.6, Math.min(-0.9, o.y));
    }

    let c = 0;
    const t = U.uTime.value;
    for (const o of fish) {
      let x, y, z, yaw, pitch, work;
      if (o.shoal < 0) {
        if (!o.live) continue;
        x = o.x; y = o.y; z = o.z; yaw = o.hdg; pitch = 0; work = 0.75;
      } else {
        const s = shoals[o.shoal];
        if (!s.live) continue;
        // Milling: everybody goes round the shoal's own axis at their own rate,
        // so the cloud turns over without anybody leaving it.
        const a = o.a + t * FISH.mill * o.sp;
        const rr = o.r * s.spread * (o.shoal % 2 ? 1.15 : 0.9);
        x = s.x + Math.cos(a) * rr;
        z = s.z + Math.sin(a) * rr;
        y = s.y + o.h * s.spread * 0.55;
        // Facing along the orbit, plus the shoal's own course.
        yaw = a + Math.PI * 0.5;
        pitch = Math.sin(t * 0.9 + o.phase) * 0.10;
        work = 0.8 + 0.4 * Math.sin(t * 1.7 + o.phase);
      }
      if (y > -0.35) y = -0.35;
      aPos.array[c * 3] = x; aPos.array[c * 3 + 1] = y; aPos.array[c * 3 + 2] = z;
      aDir.array[c * 3] = -yaw; aDir.array[c * 3 + 1] = pitch;
      aDir.array[c * 3 + 2] = work;
      aBio.array[c * 3] = o.len * (o.shoal < 0 ? 3.4 : 2.6);
      aBio.array[c * 3 + 1] = o.phase;
      aBio.array[c * 3 + 2] = 1;
      c++;
    }
    geo.instanceCount = c;
    for (const a of [aPos, aDir, aBio]) { a.addUpdateRange(0, c * 3); a.needsUpdate = true; }
    return c;
  }

  return { mesh, update, count: () => geo.instanceCount,
    /** Debug: where the shoals are, so a camera can be pointed at one. */
    where: () => shoals.filter((s) => s.live).map((s) => ({
      at: [+s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1)],
      spread: +s.spread.toFixed(2) })) };
}
