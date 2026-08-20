// -----------------------------------------------------------------------------
// The mask, and the bubbles.
//
// This replaces the first-person crawl in 60-arms.js, and the reason is worth
// keeping because it is not the usual one. The arms were not broken. They were
// a real stroke on a real two-joint chain with a high elbow and a hand that
// turned over on the recovery, and every one of those details was right. The
// problem was the whole of it: a front crawl seen from inside your own head is
// two limbs crossing most of the frame twice a second, and at a 58-degree lens
// there is no version of that which does not read as flailing. The closer it
// got to a real crawl the busier it looked — which is the opposite of the way
// animation usually rewards you, and is why no amount of further work on it
// was going to help.
//
// So: what do you actually notice, in the sea, with your face in it?
//
// You notice the mask. It is the frame around everything you see and it never
// goes away — a dark silicone edge with a nose pocket biting into the bottom
// of the picture, and a hard bright line where the glass is bevelled. Nobody
// who has worn one has to be told what it is; it is the single strongest "I am
// under water" signal there is, and it costs one quad and no animation at all.
//
// And you notice the bubbles. Not a fountain — a swimmer is not on a
// regulator — but a trickle off the top edge of the mask and a burst every
// time you breathe out, going up past your face and getting bigger as they go.
// They are the only thing in the water that tells you which way is up, which
// matters here more than anywhere: this is the one mode in the game where you
// can be pointing at the sea bed with no horizon in the frame.
//
// Three notes on how it is built.
//
// The mask is a shader and not a texture, because it has to be right at every
// aspect ratio. A painted overlay stretched to a phone in portrait puts the
// nose pocket somewhere near your chin. Everything in here is computed in
// aspect-corrected frame coordinates, so the window is the same *shape* on a
// laptop, an ultrawide and a phone held either way up, and only how much of
// the world it lets past changes.
//
// The bubbles live in the world and not in the view. A bubble parented to the
// camera turns when you turn, which makes it a smudge on the lens; a bubble
// left in the sea gets swept past you as you swim through it, which is what a
// bubble does. They cost one draw call for all of them.
//
// And both of them come off the same two numbers the rest of the swim runs on
// — your depth and your breath — so nothing here has any state of its own to
// get out of step with the model that owns it.
// -----------------------------------------------------------------------------

const MASK = {
  // The window, in half-frame units: 1.0 is the top and bottom of the picture,
  // and the same distance sideways whatever the aspect. Wide and shallow,
  // which is what a low-volume mask is and is also what keeps the skirt out of
  // the way of the thing you are trying to look at.
  win: [1.62, 0.84],
  power: 3.4,             // how square the window's corners are
  // The nose pocket: how far up into the bottom of the window the mould comes,
  // and how wide it is. This is the detail that stops the frame reading as a
  // vignette — a vignette is symmetric and a mask is not.
  nose: [0.19, 0.23],
  // And the brow, which is the same idea at the top and much smaller: the
  // moulding over the bridge is shallower than the pocket under it.
  brow: 0.055,
  // How soft the silicone edge is, and how wide the bright bevel just inside
  // the glass. Both of these were three to four times bigger on the first
  // pass and the result was a hundred-pixel white halo all round the picture —
  // a pair of lit ski goggles rather than a mask. The edge of a mask is *hard*:
  // there is a moulding, and then there is not.
  feather: 0.016,
  rim: 0.011,
  skirt: [0.021, 0.024, 0.028],   // the silicone itself: not black, nearly
  // How opaque the skirt is at the surface and under it. It never goes fully
  // away, because the mask never comes off — but out of the water the light
  // gets in round the edges of it and the frame is softer than it is below.
  // Opaque, and it has to be. At 0.86 you could read the sea bed through the
  // silicone, which is the one thing a skirt is for.
  alpha: [0.97, 1.0],
  // How far the skirt's own shadow falls across the inside of the glass. This
  // is the detail that seats the frame in the picture rather than pasting it
  // on top: light coming past your head has to get round a moulding, so the
  // last centimetre of what you can see is always darker than the middle.
  shade: [0.34, 0.30],

  drops: 11,              // beads on the glass, which only appear once you surface
  wetIn: 0.55,            // s for them to bead up after you come out
  wetOut: 5.0,            // and how long they take to run off again

  // ── the bubbles ──────────────────────────────────────────────────────────
  max: 220,
  // Where they come from: forward of the eye and below it, which is the top
  // edge of the mask and the corner of your mouth. Not at the eye — a bubble
  // born at the near plane is a white disc filling the screen for one frame.
  from: [0.0, -0.11, 0.30],
  spread: 0.055,
  rise: [0.42, 0.86],     // m/s, small ones and big ones
  size: [0.009, 0.034],   // m across at birth
  grow: 0.45,             // and how much bigger by the time they reach the top
  life: [1.7, 3.4],       // s, before they are simply gone
  wobble: [1.6, 3.4],     // rad/s of the side-to-side, which is what makes them read
  wobbleR: 0.035,         // m of it
  trickle: 7.5,           // a second, just from being under
  swimBoost: 7.0,         // and more of it the harder you are working
  puff: [9, 16],          // how many in one breath out
  puffEvery: [2.6, 4.2],  // s between them, which is a person breathing out slowly
  plunge: 46,             // and the lot, the moment your head goes under
};

const _msz = new THREE.Vector2();

const MASK_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// The frame, in one pass.
//
// `p` is the picture in half-frame units with the aspect taken out of it, so
// `p.y` runs -1..1 top to bottom whatever the window is doing and `p.x` runs
// wider than that on a wide screen. Every number in MASK is in those units.
const MASK_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uWin;
uniform vec2 uNose;
uniform float uBrow;
uniform float uPower;
uniform float uFeather;
uniform float uRim;
uniform vec3 uSkirt;
uniform vec2 uShade;
uniform float uAlpha;
uniform float uAspect;
uniform float uWet;
uniform float uTime;

// A hash good enough for eleven droplets that must not move between frames.
vec2 hash2(float n) {
  return fract(vec2(sin(n * 12.9898) * 43758.5453,
                    sin(n * 78.2330) * 12345.6789));
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uAspect;

  // How wide the window is allowed to be, which has to know about the shape of
  // the screen and not only about the shape of a mask.
  //
  // A dive mask gives you most of the peripheral vision you had — call it a
  // hundred degrees of the hundred and twenty — and this camera is on a
  // fifty-eight degree lens, which is already narrower than that. So a window
  // sized like a real one *by angle* would be off the edges of the picture
  // entirely, and the first pass, which sized it as a fraction of the frame
  // instead, ate a third of the screen on each side and read as a letterbox.
  // The honest answer is both: as wide as a mask, and never wider than the
  // screen has room for.
  float wx = min(uWin.x, uAspect * 0.88);

  // The window, as a superellipse whose bottom half is pushed up in the middle
  // by the nose pocket and whose top is pushed down a little by the moulding
  // over the bridge. Both are Gaussians in x, which is the shape a mould that
  // has to clear a face actually is — there is no corner on it anywhere.
  float bump = exp(-(p.x * p.x) / (uNose.y * uNose.y));
  float ry = uWin.y - (p.y < 0.0 ? uNose.x * bump : uBrow * bump);
  vec2 q = vec2(p.x / wx, p.y / max(ry, 0.05));
  float d = pow(pow(abs(q.x), uPower) + pow(abs(q.y), uPower), 1.0 / uPower);

  // Silicone outside, glass inside, and a hard few pixels between them.
  float skirt = smoothstep(1.0 - uFeather, 1.0 + uFeather, d);

  // The bevel: a thin bright line right at the glass edge where it catches
  // whatever light is getting past your head. Thin is the whole of it — this
  // is the detail that makes the frame read as a lens in a mount, and the same
  // detail four times too wide is what makes it read as a glow.
  float rim = smoothstep(1.0 - uRim * 2.4, 1.0 - uRim, d)
            * (1.0 - smoothstep(1.0 - uRim, 1.0, d));

  // And the shadow the moulding throws across the inside of the glass, which
  // is the opposite thing and matters more: the last centimetre you can see
  // through is always darker than the middle, because the light had to come
  // round a face and a lump of silicone to get there.
  float shade = smoothstep(1.0 - uShade[1] * 4.0, 1.0, d) * uShade[0]
              * (1.0 - skirt);

  // The light that gets *through* the silicone at the very edge of it, which
  // is why a skirt is never quite black in daylight. Kept close to the edge:
  // a bleed with a long tail is a halo.
  float bleed = exp(-(d - 1.0) * 17.0) * skirt;

  vec3 col = uSkirt + vec3(0.055, 0.080, 0.090) * bleed;
  float a = skirt * uAlpha + shade;

  // Beads on the inside of the glass, once you have been out of the water.
  // Static — they are stuck to it — and each one is a tiny lens: dark in the
  // middle, bright at the edge.
  if (uWet > 0.001) {
    for (int i = 0; i < ${MASK.drops}; i++) {
      vec2 h = hash2(float(i) * 3.13 + 1.7);
      vec2 c = vec2((h.x - 0.5) * 1.7 * wx,
                    (h.y - 0.5) * 1.75 * uWin.y);
      // They run, slowly, and the big ones run faster.
      float sz = 0.012 + h.x * 0.026;
      c.y += (1.0 - uWet) * (0.05 + sz * 3.0);
      float r = length(c - p) / sz;
      if (r < 1.4) {
        float edge = 1.0 - smoothstep(0.72, 1.05, r);
        float lens = smoothstep(0.30, 0.80, r) - smoothstep(0.86, 1.02, r);
        float da = edge * 0.30 * uWet * (1.0 - skirt);
        col = mix(col, vec3(0.72, 0.83, 0.88), da / max(a + da, 0.001));
        a += da + lens * 0.20 * uWet * (1.0 - skirt);
      }
    }
  }

  a += rim * 0.30;
  col = mix(col, vec3(0.40, 0.52, 0.56), rim * 0.30 / max(a, 0.001));
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

const BUBBLE_VERT = `
attribute float aSize;
attribute float aFade;
varying float vFade;
uniform float uScale;
void main() {
  vFade = aFade;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Real metres, projected: a bubble is a physical object and has to get
  // bigger as it comes at you, which a fixed pixel size does not do.
  gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), 1.0, 220.0);
}
`;

const BUBBLE_FRAG = `
precision highp float;
varying float vFade;
void main() {
  // A bubble is not a blob. What you see of one is the ring — total internal
  // reflection round the rim — plus one hard specular pin where the light is,
  // and almost nothing in the middle, which is why you can see straight
  // through the centre of a bubble to whatever is behind it.
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float ring = smoothstep(0.55, 0.94, r) * (1.0 - smoothstep(0.93, 1.0, r));
  float body = (1.0 - r * r) * 0.08;
  float hi = exp(-38.0 * dot(c - vec2(-0.15, -0.15), c - vec2(-0.15, -0.15)));
  float a = (ring * 1.05 + body + hi * 0.95) * vFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.84, 0.93, 0.97), a);
}
`;

/**
 * The frame on your face and the air coming out of you.
 *
 * `scene` is the world, because the bubbles belong in it. The mask does not —
 * it is drawn last, over the finished picture, on its own orthographic pass,
 * for the same reason the arms were: nothing in the world is allowed to be in
 * front of the inside of your own mask.
 */
function buildMask(scene) {
  // ── the frame ────────────────────────────────────────────────────────────
  const stage = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uni = {
    uWin: { value: new THREE.Vector2(MASK.win[0], MASK.win[1]) },
    uNose: { value: new THREE.Vector2(MASK.nose[0], MASK.nose[1]) },
    uBrow: { value: MASK.brow },
    uPower: { value: MASK.power },
    uFeather: { value: MASK.feather },
    uRim: { value: MASK.rim },
    uSkirt: { value: new THREE.Color(...MASK.skirt) },
    uShade: { value: new THREE.Vector2(MASK.shade[0], MASK.shade[1]) },
    uAlpha: { value: 0 },
    uAspect: { value: 1.6 },
    uWet: { value: 0 },
    uTime: { value: 0 },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: MASK_VERT,
      fragmentShader: MASK_FRAG,
      uniforms: uni,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }));
  quad.frustumCulled = false;
  stage.add(quad);
  let on = false;
  let wet = 0;

  // ── the bubbles ──────────────────────────────────────────────────────────
  const N = MASK.max;
  const pos = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const fade = new Float32Array(N);
  // Everything a bubble is, in flat arrays, because there are two hundred of
  // them and they are re-used forever: born, risen, popped, born again.
  const vy = new Float32Array(N);
  const life = new Float32Array(N);
  const age = new Float32Array(N);
  const ph = new Float32Array(N);
  const wob = new Float32Array(N);
  const bx = new Float32Array(N);       // where it was born, which the wobble is about
  const bz = new Float32Array(N);
  const drx = new Float32Array(N);      // and the drift it inherited from you
  const drz = new Float32Array(N);
  let next = 0;
  let live = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
  geo.setDrawRange(0, N);
  const bubUni = { uScale: { value: 600 } };
  const bubbles = new THREE.Points(geo, new THREE.ShaderMaterial({
    vertexShader: BUBBLE_VERT,
    fragmentShader: BUBBLE_FRAG,
    uniforms: bubUni,
    transparent: true,
    depthWrite: false,
  }));
  bubbles.frustumCulled = false;
  bubbles.visible = false;
  // Their own scene and their own camera, and this is not tidiness — it is the
  // only place they can be drawn at all.
  //
  // The world's front clip underwater sits at about 0.9 m: it comes in from
  // 1.2 so that you can put your face against the sea bed, and no further,
  // because the rest of the view still wants its depth precision. A bubble
  // leaving your mouth is thirty centimetres from your eye. Put them in the
  // world and every one of them is thrown away by the near plane before it is
  // ever rasterised, which is exactly what happened: two hundred live bubbles,
  // a correct simulation, and nothing on the screen.
  //
  // So they get the arms' old trick — a second pass over the finished picture
  // with the depth cleared and a camera that clips at four centimetres. The
  // far end is eight metres, which is the honest limit of the dodge: inside
  // eight metres a bubble draws over whatever is behind it whether or not
  // there is something in between, and under water at that range there never
  // is.
  const bubStage = new THREE.Scene();
  bubStage.add(bubbles);
  const bubCam = new THREE.PerspectiveCamera(58, 1.6, 0.035, 8.0);
  let lastCam = null;

  // Dead, and out of the way. A point with zero size still costs a vertex, so
  // the fade is what actually stops it being drawn.
  for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -999; fade[i] = 0; }

  let puffT = 2.0;
  let wasUnder = false;

  /** One bubble, from a point, with some of your own motion in it. */
  function emit(x, y, z, vx0, vz0, big) {
    const i = next; next = (next + 1) % N;
    const s = MASK.spread;
    bx[i] = x + (Math.random() - 0.5) * s;
    bz[i] = z + (Math.random() - 0.5) * s;
    pos[i * 3] = bx[i];
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * s;
    pos[i * 3 + 2] = bz[i];
    const u = Math.random() * (big ? 1 : 0.62);
    size[i] = lerp(MASK.size[0], MASK.size[1], u);
    vy[i] = lerp(MASK.rise[0], MASK.rise[1], u * 0.7 + Math.random() * 0.3);
    life[i] = lerp(MASK.life[0], MASK.life[1], Math.random());
    age[i] = 0;
    ph[i] = Math.random() * Math.PI * 2;
    wob[i] = lerp(MASK.wobble[0], MASK.wobble[1], Math.random());
    drx[i] = vx0 * 0.55; drz[i] = vz0 * 0.55;
    fade[i] = 0;
    if (live < N) live++;
  }

  /**
   * One frame.
   *
   * `swim` is the swim model or null, and null is the whole of "not in the
   * water" — the mode owns the answer and there is nothing here for a phase to
   * disagree with it about. `camera` is where the eye is, which is where the
   * air comes out of.
   */
  function update(dt, swim, camera) {
    const active = !!(swim && swim.active);
    on = active;
    lastCam = camera;
    bubbles.visible = live > 0;
    uni.uTime.value += dt;

    if (active) {
      const under = swim.submerged;
      const you = swim.you;
      // No easing. You do not put a mask on over half a second — it is on
      // your face before the mode starts, and a skirt fading up from nothing
      // is the one thing that would give away that it is drawn rather than
      // worn.
      uni.uAlpha.value = under ? MASK.alpha[1] : MASK.alpha[0];
      // Beading up is fast and running off is slow, which is what water on
      // glass does and is also the right way round for the eye: you want to
      // see it arrive.
      wet = under
        ? Math.max(0, wet - dt / MASK.wetOut * 3.0)
        : Math.min(1, wet + dt / MASK.wetIn);
      if (!under) wet = Math.max(wet - dt / MASK.wetOut, 0.0);
      uni.uWet.value = wet;

      // Where the air comes out. Forward and down off the eye, in the frame
      // the camera is actually in, so it follows your head round.
      const cy = Math.cos(you.yaw), sy = Math.sin(you.yaw);
      // Forward of the eye, off the yaw and not off the camera's own matrix:
      // the camera rolls with the stroke and the air does not come out of you
      // sideways because your head is tipped.
      const ex = camera.position.x - sy * MASK.from[2];
      const ez = camera.position.z - cy * MASK.from[2];
      const ey = camera.position.y + MASK.from[1];

      if (under) {
        // The plunge: your head goes under and it takes a lungful of air down
        // with it, all round the mask and out of your hair.
        if (!wasUnder) {
          for (let k = 0; k < MASK.plunge; k++) {
            emit(ex + (Math.random() - 0.5) * 0.34,
              ey + (Math.random() - 0.5) * 0.26,
              ez + (Math.random() - 0.5) * 0.34,
              you.vx, you.vz, Math.random() < 0.4);
          }
          puffT = lerp(MASK.puffEvery[0], MASK.puffEvery[1], Math.random());
        }
        // The trickle, and more of it the harder you are working.
        const work = Math.min(1, Math.hypot(you.vx, you.vz) / SWIM.sprint);
        let rate = MASK.trickle + MASK.swimBoost * work;
        // And out of air is not a quiet way to be: the last of it goes.
        if (you.spent) rate += 26;
        let n = rate * dt;
        while (n > 0) {
          if (n >= 1 || Math.random() < n) emit(ex, ey, ez, you.vx, you.vz, false);
          n -= 1;
        }
        // The breath out. A person under water does not hold everything in —
        // they let it go in slow bursts, and the burst is the thing that reads
        // as a person rather than as a leak.
        puffT -= dt;
        if (puffT <= 0) {
          const c = Math.round(lerp(MASK.puff[0], MASK.puff[1], Math.random()));
          for (let k = 0; k < c; k++) {
            emit(ex, ey, ez, you.vx, you.vz, Math.random() < 0.55);
          }
          puffT = lerp(MASK.puffEvery[0], MASK.puffEvery[1], Math.random());
        }
      }
      wasUnder = under;
    } else {
      uni.uAlpha.value = 0;
      wasUnder = false;
      wet = Math.max(0, wet - dt / MASK.wetOut);
      uni.uWet.value = wet;
    }

    // ── and up they go ───────────────────────────────────────────────────────
    if (!live) return;
    const surf = swim && swim.active ? swim.surfaceAt : null;
    let any = 0;
    for (let i = 0; i < N; i++) {
      if (fade[i] <= 0 && age[i] >= life[i]) continue;
      age[i] += dt;
      const u = age[i] / life[i];
      if (u >= 1) { fade[i] = 0; pos[i * 3 + 1] = -999; continue; }
      // A bubble gets bigger as it rises, because the water above it weighs
      // less. Over three metres that is a few per cent in truth and rather
      // more than that here, because what it is really doing is telling you
      // which ones are close.
      const g = 1 + MASK.grow * u;
      bx[i] += drx[i] * dt;
      bz[i] += drz[i] * dt;
      drx[i] -= drx[i] * Math.min(1, dt * 1.6);
      drz[i] -= drz[i] * Math.min(1, dt * 1.6);
      pos[i * 3 + 1] += vy[i] * g * dt;
      const w = ph[i] + age[i] * wob[i];
      pos[i * 3] = bx[i] + Math.sin(w) * MASK.wobbleR * g;
      pos[i * 3 + 2] = bz[i] + Math.cos(w * 0.83) * MASK.wobbleR * g;
      // In and out: a quarter of a second to appear, the last third to go, and
      // gone the moment it reaches the underside of the sea.
      let a = Math.min(1, age[i] / 0.18) * Math.min(1, (1 - u) / 0.34);
      if (surf) {
        const s = surf(pos[i * 3], pos[i * 3 + 2]);
        if (pos[i * 3 + 1] > s - 0.02) { fade[i] = 0; age[i] = life[i]; continue; }
        a *= Math.min(1, (s - pos[i * 3 + 1]) / 0.10);
      }
      fade[i] = a * (0.55 + 0.45 * g);
      any++;
    }
    live = any;
    bubbles.visible = any > 0;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aFade.needsUpdate = true;
  }

  /**
   * Draw the frame, over everything.
   *
   * Same contract as the arms' pass — keep the colour, throw away the depth,
   * and put `autoClear` back where it was found.
   */
  function render(renderer) {
    if (uni.uAlpha.value < 0.004) return;
    const res = renderer.getSize(_msz);
    uni.uAspect.value = res.x / Math.max(1, res.y);
    // gl_PointSize is in pixels and the projection is not, so the bubbles need
    // to know how tall the picture is. Read here because this is the one place
    // that has the renderer.
    bubUni.uScale.value = res.y * 0.62;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    if (bubbles.visible && lastCam) {
      // The real camera, minus its reach. Copied rather than shared for the
      // same reason the arms copy theirs: the field of view is a control here
      // — Z is a lens — and bubbles that did not zoom with the picture would
      // be the one thing in it that was not moving.
      bubCam.fov = lastCam.fov;
      bubCam.aspect = lastCam.aspect;
      bubCam.position.copy(lastCam.position);
      bubCam.quaternion.copy(lastCam.quaternion);
      bubCam.updateProjectionMatrix();
      renderer.clearDepth();
      renderer.render(bubStage, bubCam);
    }
    renderer.clearDepth();
    renderer.render(stage, cam);
    renderer.autoClear = auto;
  }

  return {
    stage, cam, bubbles, bubStage, bubCam, update, render,
    get on() { return on; },
    stats: () => ({
      on: on ? 1 : 0,
      a: +uni.uAlpha.value.toFixed(2),
      wet: +uni.uWet.value.toFixed(2),
      bub: live,
      asp: +uni.uAspect.value.toFixed(2),
    }),
  };
}
