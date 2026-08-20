// -----------------------------------------------------------------------------
// Screen-space ambient occlusion.
//
// The one thing this renderer never had, and the one thing it was most obvious
// about not having. Everything in here is lit by a sun and a flat ambient
// term, so a corner is exactly as bright as a wall and the underside of a
// balcony is exactly as bright as its top. You can see it everywhere once you
// have seen it anywhere: the loungers float, the kabine have no shadow where
// they meet the concrete, the fridge does not sit in the corner of the
// kitchen, and every one of the eighty houses looks pasted on to the hill
// rather than standing on it. None of that is a modelling problem. It is that
// contact darkening is not a light, it is a *geometry* effect, and no amount of
// ambient term can fake it.
//
// What this costs, plainly, because the report asked: a full-resolution colour
// target, a half-resolution occlusion pass at sixteen taps, and a composite.
// On a desktop that is a few per cent; on a phone it is more like fifteen, and
// on a phone it is off by default. It is a slider, and the slider goes to
// nothing.
//
// Three things about how it is built.
//
// **The colour comes back out untouched.** Intercepting a frame usually means
// taking on its tone mapping, because three.js does that on the way to the
// canvas and not on the way to a render target. It does not here, and the
// composite is a plain multiply — see the note above `AO_COMP`, which is where
// the measurement that settled it is written down.
//
// **The normals come out of the depth buffer.** A normal buffer would be more
// accurate and would cost a second full pass over three and a half million
// triangles, which is not a trade worth making for an effect that is a
// darkening. Two screen-space derivatives of the reconstructed view position
// give a normal that is right everywhere except across a depth discontinuity,
// and across a depth discontinuity the range check has already thrown the
// sample away.
//
// **It is half resolution and it is blurred.** Sixteen taps per pixel is a
// noisy estimate however you dress it up; at half resolution it is a quarter
// of the cost, and the four-tap blur on the way back up is what turns the
// noise into the soft dirt in a corner that the eye reads as contact. A sharp
// SSAO is a wrong SSAO.
// -----------------------------------------------------------------------------

const AO = {
  radius: 0.85,          // m — how far out a sample looks for something in the way
  // Metres of slack: how far a sample has to be in front of the surface before
  // it counts as being in the way. This is the number that decides whether a
  // flat plane shades itself, and 0.035 was far too small for a beach seen
  // almost edge-on at eighty metres — where one screen pixel is several metres
  // of sand, the reconstructed normal is a guess, and half the kernel lands
  // below the surface it came from. The whole promenade came out in bands.
  bias: 0.055,
  // And it has to grow with distance, because the *pixel* does: the same slack
  // that is generous at four metres is a fraction of one texel's worth of
  // ground at a hundred.
  biasFar: 0.010,        // per metre
  // How dark it is allowed to get, before the slider. 0.62 is a corner at
  // about a third of its open-sky brightness, which is roughly what a corner
  // does and is a good deal less than most implementations of this reach for.
  strength: 0.62,
  taps: 16,
  // Beyond this there is no point: the sun has taken over, the geometry is
  // small on the screen, and the taps land inside a single triangle. It also
  // keeps the whole effect off the far shore, where it would read as haze.
  // How far out it works at all, and it is deliberately short.
  //
  // Ambient occlusion is a *contact* effect: what it is for is the line where
  // a lounger meets the concrete and the dark under an eave, and every one of
  // those is within a few metres of you. Run it out to a hundred and forty and
  // what you get instead is the promenade seen almost edge-on at ninety
  // metres, where one screen pixel is several metres of ground, the
  // reconstructed normal is a guess and the terraces come out as a staircase
  // of hard-edged rectangles — which is the picture the first pass produced
  // and is a good deal worse than no occlusion at all. Forty-two metres is
  // about as far as a contact shadow is legible anyway.
  far: 26,
  fade: 10,              // m of it fading out
  scale: 0.5,            // the occlusion pass, as a fraction of the picture
};

const AO_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const AO_FRAG = `
precision highp float;
// three.js declares an output and points the old built-in name at it for GLSL1
// shaders and *not* for GLSL3 ones — see the glslVersion branch in its program
// builder. A GLSL3 material has to bring its own, and one that does not simply
// fails to link, which shows up as a white screen and no error worth reading.
layout(location = 0) out highp vec4 fragColor;
varying vec2 vUv;
uniform sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform vec2 uRes;
uniform vec3 uKernel[${AO.taps}];
uniform float uNear;
uniform float uFar;
uniform float uRadius;
uniform float uBias;
uniform float uBiasFar;
uniform float uCut;
uniform float uFade;
uniform int uDbg;
uniform float uDepthK;

float viewZ(float d) {
  // The standard perspective un-projection of a [0,1] depth sample. Comes out
  // negative, because view space looks down -Z and everything below depends on
  // that being true.
  return (uNear * uFar) / ((uFar - uNear) * d - uFar);
}

vec3 viewPos(vec2 uv, float d) {
  float vz = viewZ(d);
  float w = uProj[2][3] * vz + uProj[3][3];
  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0) * w;
  return (uProjInv * clip).xyz;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float d = texture2D(tDepth, vUv).x;

  // ── the depth AOV ─────────────────────────────────────────────────────────
  //
  // Not one of the debug ramps below, and it has to sit above both of the culls
  // that follow rather than beside them, because it fails all three of their
  // assumptions. This is a conditioning image for a diffusion pass that runs
  // outside the game, and such an image has to be monotonic — uDbg == 2 is a
  // fract() sawtooth, which a depth model reads as a striped wall — it has to
  // survive past uCut, which is 26 m because that is as far as a contact
  // shadow is legible and is nowhere near as far as a landscape, and its sky
  // has to be black. The occlusion returns white for "nothing in the way";
  // a depth ControlNet reads white as *near*, so shipping the sky white puts
  // the horizon in the viewer's lap.
  //
  // Inverse depth, because that is what the models were trained on. MiDaS and
  // everything after it emit disparity rather than metres, so a linear ramp
  // over a kilometre of view distance would flatten every building on the
  // promenade into the same black. uDepthK is the range at which the curve
  // has fallen half way — 50 m by default, which is the depth of a street and
  // therefore where the detail worth conditioning on actually is.
  if (uDbg == 4) {
    float far = d >= 0.9999 ? 1e9 : -viewPos(vUv, d).z;
    fragColor = vec4(vec3(1.0 / (1.0 + far / uDepthK)), 1.0);
    return;
  }

  // The sky. Nothing occludes it and nothing it occludes is on this screen.
  if (d >= 0.9999) { fragColor = vec4(1.0); return; }

  vec3 p = viewPos(vUv, d);
  float dist = -p.z;
  if (dist > uCut) { fragColor = vec4(1.0); return; }

  // The normal, from two derivatives of the reconstructed position. Wrong
  // across a silhouette and correct everywhere else, which is the right way
  // round: the range check below throws away exactly the samples the wrong
  // ones would have poisoned.
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (n.z < 0.0) n = -n;

  // How much to trust that normal, which is the whole of the artefact this
  // effect had and is worth being exact about.
  //
  // The normal comes out of the cross product of two screen-space
  // derivatives. On a surface facing you those two vectors are close to
  // perpendicular and the cross product is well conditioned. On a surface seen
  // almost edge-on — the beach running away to the horizon, which is a third
  // of every frame in this game — they are close to *parallel*, both pointing
  // along the ground away from the camera, and the cross product of two nearly
  // parallel vectors is numerically whatever the last bit of the depth buffer
  // felt like. The hemisphere then gets built around a normal lying in the
  // ground rather than out of it, half the kernel is buried, and the promenade
  // comes out as a staircase of hard-edged rectangles that follows the terrain
  // LOD instead of following anything real.
  //
  // So: weight by how far from edge-on the surface is. Nothing is lost — a
  // surface at eighty-five degrees to the eye has no legible contact shading
  // on it anyway — and the one place the effect was wrong is the one place it
  // now does not run.
  float trust = smoothstep(0.26, 0.58, abs(dot(normalize(p), n)));
  if (trust <= 0.001) { fragColor = vec4(1.0); return; }

  // A per-pixel rotation of the kernel, so sixteen taps behave like rather
  // more than sixteen once the blur has had them.
  float a = hash(gl_FragCoord.xy) * 6.2831853;
  vec3 rv = vec3(cos(a), sin(a), 0.0);
  vec3 t = normalize(rv - n * dot(rv, n));
  vec3 b = cross(n, t);
  mat3 tbn = mat3(t, b, n);

  // The radius shrinks with distance in *world* terms only as far as keeping
  // the sample footprint sane on screen — a fixed world radius at eighty
  // metres is a sub-pixel disc and every tap lands on the same texel.
  float rad = uRadius * (1.0 + dist * 0.010);
  float bias = uBias + uBiasFar * dist;

  // And the whole kernel starts a little off the surface rather than on it.
  // A sample that begins inside the very polygon it is testing is a sample
  // that has already decided the answer.
  p += n * bias * 0.5;

  float occ = 0.0;
  for (int i = 0; i < ${AO.taps}; i++) {
    vec3 sp = p + (tbn * uKernel[i]) * rad;
    vec4 off = uProj * vec4(sp, 1.0);
    vec2 suv = off.xy / off.w * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
    float sd = texture2D(tDepth, suv).x;
    if (sd >= 0.9999) continue;
    float sz = viewZ(sd);
    // In the way, and near enough to be in the way *of this pixel* rather than
    // being a wall four metres behind it.
    float range = smoothstep(0.0, 1.0, rad / max(0.0001, abs(p.z - sz)));
    occ += (sz >= sp.z + bias ? 1.0 : 0.0) * range;
  }
  occ /= float(${AO.taps});
  // And out of it in the distance, where the sun has taken over anyway.
  occ *= trust * (1.0 - smoothstep(uCut - uFade, uCut, dist));
  if (uDbg == 1) { fragColor = vec4(n * 0.5 + 0.5, 1.0); return; }
  if (uDbg == 2) { fragColor = vec4(vec3(fract(dist * 0.25)), 1.0); return; }
  if (uDbg == 3) { fragColor = vec4(vec3(trust), 1.0); return; }
  fragColor = vec4(1.0 - occ, 0.0, 0.0, 1.0);
}
`;

// The composite: the scene, times the blurred occlusion. And nothing else,
// which took a measurement to establish and is worth writing down.
//
// The first version of this moved the tone mapping in here — ACES and the sRGB
// transfer, written out by hand — on the reasoning that three.js applies both
// on the way to the canvas and applies neither on the way to a render target,
// so a pass that intercepts the picture has to put them back. Every word of
// that is true about three.js and none of it is true about this game: nothing
// in `solidMaterial` includes `tonemapping_fragment` or `colorspace_fragment`,
// so every solid surface in the world has always written its colour straight
// to the framebuffer in display space. `renderer.toneMapping` reaches the
// handful of built-in materials — the wake ribbons, the mirror, the figure —
// and nothing else.
//
// Which was settled by rendering the same frame five ways and differencing
// them against the untouched one: a plain pass-through came out at a mean
// absolute error of 7 on 0..255 and a mean brightness within a third of a
// level, and every version that applied a transfer function was out by forty.
// So the occlusion multiplies the colour where it stands, in the same space
// the rest of this renderer has always shaded in.
const AO_COMP = `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tAO;
uniform vec2 uAOTexel;
uniform float uStrength;
uniform float uShow;

void main() {
  vec4 col = texture2D(tColor, vUv);
  // Four taps on the diagonals of one occlusion texel. Cheaper than a
  // separable blur, and against a half-resolution buffer that bilinear
  // filtering has already smoothed once, it is enough.
  float ao = (
    texture2D(tAO, vUv + uAOTexel * vec2(-0.5, -0.5)).r +
    texture2D(tAO, vUv + uAOTexel * vec2(0.5, -0.5)).r +
    texture2D(tAO, vUv + uAOTexel * vec2(-0.5, 0.5)).r +
    texture2D(tAO, vUv + uAOTexel * vec2(0.5, 0.5)).r) * 0.25;
  if (uShow > 0.5) { fragColor = vec4(vec3(ao), 1.0); return; }
  fragColor = vec4(col.rgb * (1.0 - (1.0 - ao) * uStrength), 1.0);
}
`;

/**
 * The pass. Owns two targets and hands the app one call.
 *
 * `strength` of zero is not merely a dark AO — it is the whole thing switched
 * off, scene straight to the canvas, three.js doing its own tone mapping
 * again, and not one texel allocated. Somebody who turns this off should get
 * back exactly the renderer they had before it existed, and that means the
 * off switch has to be a branch and not a multiply.
 */
function buildAO(renderer) {
  let strength = 0;
  let ok = true;
  let W = 0, H = 0;

  const quad = new THREE.PlaneGeometry(2, 2);
  const stage = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // The kernel: sixteen points in a hemisphere about +Z, bunched toward the
  // origin. The bunching is the point — occlusion is a near-field effect and a
  // uniform hemisphere spends most of its taps at a radius where nothing is
  // ever in the way.
  const kernel = [];
  for (let i = 0; i < AO.taps; i++) {
    const v = new THREE.Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 0.92 + 0.08);
    v.normalize();
    const t = i / AO.taps;
    v.multiplyScalar(0.25 + 0.75 * t * t);
    kernel.push(v);
  }

  const aoUni = {
    tDepth: { value: null },
    uProj: { value: new THREE.Matrix4() },
    uProjInv: { value: new THREE.Matrix4() },
    uRes: { value: new THREE.Vector2(1, 1) },
    uKernel: { value: kernel },
    uNear: { value: 1 },
    uFar: { value: 1000 },
    uRadius: { value: AO.radius },
    uBias: { value: AO.bias },
    uBiasFar: { value: AO.biasFar },
    uCut: { value: AO.far },
    uFade: { value: AO.fade },
    uDbg: { value: 0 },
    uDepthK: { value: 50 },
  };
  const compUni = {
    tColor: { value: null },
    tAO: { value: null },
    uAOTexel: { value: new THREE.Vector2() },
    uStrength: { value: AO.strength },
    uShow: { value: 0 },
  };
  // GLSL3, for one reason: `dFdx`. Derivatives are core in GLSL ES 3.00 and an
  // extension in 1.00, and an extension that is merely usually present is not
  // something to hang the whole picture on. three.js supplies the
  // compatibility defines, so the source below is still written the old way.
  const mk = (frag, uniforms) => new THREE.ShaderMaterial({
    vertexShader: AO_VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false,
    glslVersion: THREE.GLSL3,
  });
  const aoMesh = new THREE.Mesh(quad, mk(AO_FRAG, aoUni));
  const compMesh = new THREE.Mesh(quad, mk(AO_COMP, compUni));
  aoMesh.frustumCulled = false;
  compMesh.frustumCulled = false;

  let sceneRT = null, aoRT = null;

  function alloc(w, h) {
    if (sceneRT && W === w && H === h) return;
    W = w; H = h;
    if (sceneRT) { sceneRT.dispose(); sceneRT.depthTexture.dispose(); }
    if (aoRT) aoRT.dispose();
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthTexture: depth,
      // Multisampled, because the alternative is shipping an anti-aliasing
      // regression as the price of a shading improvement, and nobody would
      // take that trade. The depth is resolved along with the colour.
      samples: 4,
    });
    const aw = Math.max(2, Math.round(w * AO.scale));
    const ah = Math.max(2, Math.round(h * AO.scale));
    aoRT = new THREE.WebGLRenderTarget(aw, ah, {
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    compUni.uAOTexel.value.set(1 / aw, 1 / ah);
    aoUni.uRes.value.set(w, h);
  }

  /**
   * Draw the world.
   *
   * Called instead of `renderer.render(scene, camera)`, and it returns false
   * when it has not done that — off, or broken — so the caller can fall back
   * without having to know why.
   */
  function render(scene, camera) {
    if (!ok || strength <= 0.001) return false;
    const sz = renderer.getDrawingBufferSize(_aoSz);
    try {
      alloc(sz.x, sz.y);
      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);

      aoUni.tDepth.value = sceneRT.depthTexture;
      aoUni.uProj.value.copy(camera.projectionMatrix);
      aoUni.uProjInv.value.copy(camera.projectionMatrixInverse);
      aoUni.uNear.value = camera.near;
      aoUni.uFar.value = camera.far;
      // Indoors the front clip comes in to six centimetres and the world you
      // are looking at is a room three metres across, so a 85 cm sample radius
      // is most of the far wall. Tied to the near plane, which is the one
      // number in this renderer that already knows whether you are in a room.
      const tight = Math.min(1, Math.max(0, (1.2 - camera.near) / 1.14));
      aoUni.uRadius.value = AO.radius * (1 - 0.62 * tight);
      renderer.setRenderTarget(aoRT);
      stage.clear();
      stage.add(aoMesh);
      renderer.render(stage, cam);

      compUni.tColor.value = sceneRT.texture;
      compUni.tAO.value = aoRT.texture;
      compUni.uStrength.value = strength;
      renderer.setRenderTarget(null);
      stage.clear();
      stage.add(compMesh);
      renderer.render(stage, cam);
      stage.clear();
      return true;
    } catch (e) {
      // One failure and it is off for good. A pass that half works is worse
      // than no pass: the alternative is a frame loop that throws every frame
      // and a black screen nobody can get out of.
      ok = false;
      renderer.setRenderTarget(null);
      if (typeof console !== 'undefined') console.warn('ao off:', e);
      return false;
    }
  }

  return {
    render,
    get on() { return ok && strength > 0.001; },
    get strength() { return strength; },
    /**
     * The slider. Zero puts the renderer back exactly as it was, including
     * three.js's own tone mapping, which is why the caller has to be told.
     */
    set: (v) => { strength = Math.max(0, Math.min(1, v)); },
    dbg: (n, show, k) => {
      aoUni.uDbg.value = n | 0;
      compUni.uShow.value = show ? 1 : 0;
      if (k) aoUni.uDepthK.value = k;
    },
    stats: () => ({
      on: ok && strength > 0.001 ? 1 : 0,
      k: +strength.toFixed(2),
      at: W ? W + 'x' + H : 'none',
      taps: AO.taps,
    }),
  };
}

const _aoSz = new THREE.Vector2();
