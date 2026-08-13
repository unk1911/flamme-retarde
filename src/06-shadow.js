// -----------------------------------------------------------------------------
// Shadows. Three's built-in pass wants standard materials; every surface here is
// a custom shader and half of them move (the trees bend, the plane banks, the
// smoke drifts), so it is cheaper to own the pass than to fight it.
//
// Two orthographic cascades, depth packed into RGBA8 so it works without
// float-render support, each snapped to its own texel grid so the shadow edges
// do not crawl while you fly.
//
// The far one, 900 m across, follows the aircraft. It draws the aeroplane's own
// shadow, the hangars and the hillsides, and at 44 cm a texel — with a PCF
// spread that puts the softest thing it can draw at about two and a half metres
// — it is incapable of anything smaller. That is the correct trade for a
// Canadair at a hundred and eighty knots and the wrong one for a bench.
//
// The near one, 110 m across, follows the *camera*: 5.4 cm a texel, and the
// reason a person standing on the promenade is attached to the ground rather
// than pasted over it. Everything small — cars, boats, parasols, the bathers,
// the ground crew — is registered into it alone, because whatever a four-metre
// car writes into the far map is a speckle and there are three thousand of them.
// -----------------------------------------------------------------------------

const GLSL_PACK = /* glsl */ `
vec4 packDepth(float d){
  vec4 e = vec4(1.0, 255.0, 65025.0, 16581375.0) * d;
  e = fract(e);
  e -= e.yzwx * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  return e;
}
float unpackDepth(vec4 c){
  return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}
`;

const GLSL_SHADOW = /* glsl */ `
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowTexel;
uniform sampler2D uShadowMapN;
uniform mat4 uShadowMatN;
uniform float uShadowTexelN;

${GLSL_PACK}

/** 3x3 PCF at one point in one cascade. The spread is in texels. */
float pcf3(sampler2D map, vec3 uv, float texel, float bias, float spread){
  float sum = 0.0;
  for (int j = -1; j <= 1; j++){
    for (int i = -1; i <= 1; i++){
      vec2 o = vec2(float(i), float(j)) * texel * spread;
      float d = unpackDepth(texture2D(map, uv.xy + o));
      sum += (uv.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return sum / 9.0;
}

/**
 * 1.0 in full sun, 0.0 in full shadow.
 *
 * Two cascades. The far one is 900 m across and follows the aircraft: it is
 * what draws the aeroplane's own shadow on the water and the hangars across
 * the apron, and at 44 cm a texel it is incapable of anything smaller. The
 * near one is 110 m across and follows the camera, at 5.4 cm a texel, and it
 * is the reason a person standing on the promenade is attached to it.
 *
 * They are blended rather than switched. A hard handover at the near cascade's
 * edge is a visible seam sweeping across the ground as you walk, which is
 * worse than either map on its own.
 */
float shadowAt(vec3 worldPos){
  // ── far ──
  vec4 sp = uShadowMat * vec4(worldPos, 1.0);
  vec3 uv = sp.xyz / sp.w * 0.5 + 0.5;
  float lit = 1.0;
  // Outside the cascade there is nothing to occlude with — assume lit, and
  // fade the last few texels so the boundary never shows as a hard line.
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0 && uv.z <= 1.0) {
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    // In metres, which is the only way to think about this. The slab is 1 km,
    // so 0.00035 is 35 cm — a little under one 0.44 m texel, which is the
    // worst depth error a sloped caster can put in the map.
    //
    // It was 0.0007 against a 2 km slab, i.e. a metre and a half, and the day
    // the aeroplane became a caster that showed up immediately: parked, its
    // hull sits about two metres over the apron, so most of its own shadow was
    // inside the bias and what landed was a handful of disconnected blocks
    // where the wing and the fin happened to clear it.
    //
    // Wide enough that a 28 m aeroplane resolved across 65 texels comes out as
    // a soft aeroplane-shaped patch rather than as the individual texels its
    // wing happens to cover.
    lit = mix(1.0, pcf3(uShadowMap, uv, uShadowTexel, 0.00035, 2.6),
      smoothstep(0.0, 0.06, edge));
  }

  // ── near ──
  vec4 spN = uShadowMatN * vec4(worldPos, 1.0);
  vec3 uvN = spN.xyz / spN.w * 0.5 + 0.5;
  if (uvN.x < 0.0 || uvN.x > 1.0 || uvN.y < 0.0 || uvN.y > 1.0 || uvN.z > 1.0) return lit;
  float edgeN = min(min(uvN.x, 1.0 - uvN.x), min(uvN.y, 1.0 - uvN.y));
  // A wide skirt — a fifth of the map — because this is a crossfade between two
  // cascades and not a clip, and the far one is still drawing underneath it.
  float w = smoothstep(0.0, 0.10, edgeN);
  // 8 cm over the 520 m slab. It can be this small because nothing here
  // self-shadows: the terrain is not a caster, and everything that is gets
  // written back-face-first, so the whole depth of a body sits between its lit
  // skin and the nearest occluder. A bias sized like the far cascade's would
  // push every contact shadow 35 cm out from under its object, which is the
  // whole game.
  // Deliberately not named "near": that word and its partner are reserved on
  // enough GLSL ES implementations that it is not worth finding out which ones
  // on somebody else's phone.
  float nearLit = pcf3(uShadowMapN, uvN, uShadowTexelN, 0.00016, 2.0);
  // Where the near cascade reaches, it is the answer and not a second opinion.
  //
  // This was min() of the two, which sounds conservative and is the bug behind
  // the checkerboard on the promenade. The far map is 0.44 m a texel with the
  // PCF spread 2.6 texels wide, so its account of a kabina wall standing three
  // metres away is a staircase of metre squares laid over ground the near map
  // has at 5.4 cm and gets right — and min() hands the argument to whichever
  // cascade is darker, which along every edge is the coarse one. The two
  // disagreeing by a texel is also what put the dither on the white walls: a
  // surface that is its own caster reads as lit in one map and shadowed in the
  // other, and min() takes the shadow every time.
  //
  // Switching rather than combining is only safe because every caster in the
  // far map is also in the near one — see the registrations in src/90-app.js,
  // where the resort, the aerodrome, the trees and the aeroplane all go into
  // the shared scene and only the small stuff is near-only. What it gives up is
  // an occluder outside the near slab entirely: 55 m to the side of you, or
  // 260 m up-sun. In a world whose terrain does not cast at all, that is a
  // hangar or a pine and never a hillside.
  return mix(lit, nearLit, w);
}
`;

const SHADOW_DEPTH_FRAG = /* glsl */ `
precision highp float;
varying float vDepth;
${GLSL_PACK}
void main(){ gl_FragColor = packDepth(clamp(vDepth, 0.0, 1.0)); }
`;

/**
 * The vertex half of the depth pass, for anything drawn by solidMaterial().
 *
 * It has to reproduce SOLID_VERT's transform exactly — instancing included —
 * or a caster's shadow lands somewhere its geometry is not. What it does
 * differently is write the light-space depth, which the cascade is orthographic
 * so w is 1 and this is the same 0..1 mapping `shadowAt` reconstructs at the
 * receiving end.
 */
const SHADOW_CASTER_VERT = /* glsl */ `
attribute vec3 aInstPos;
attribute vec4 aInstRot;
attribute vec3 aInstScale;

uniform float uInstanced;
varying float vDepth;

vec3 qrot(vec4 q, vec3 v){
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

void main(){
  vec3 p = position;
  if (uInstanced > 0.5) {
    p *= aInstScale;
    p = qrot(aInstRot, p);
    p += aInstPos;
  } else {
    p = (modelMatrix * vec4(position, 1.0)).xyz;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vDepth = gl_Position.z / gl_Position.w * 0.5 + 0.5;
}
`;

function buildShadow(renderer) {
  const res = CONFIG.shadowRes;
  const newTarget = (n) => {
    const t = new THREE.WebGLRenderTarget(n, n, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    t.texture.generateMipmaps = false;
    return t;
  };
  const target = newTarget(res);
  // Half the map on a phone. The near cascade is a whole second depth pass over
  // three thousand instanced casters, and 1024 over 110 m is still 10.7 cm a
  // texel — coarser than the desktop's 5.4, and still two orders of magnitude
  // finer than the far cascade it is there to make up for.
  const resN = IS_SMALL ? CONFIG.shadowNearRes / 2 : CONFIG.shadowNearRes;
  const targetN = newTarget(resN);

  const R = CONFIG.shadowRadius;
  // The light sits 2 km back along the sun, and the slab of world worth writing
  // is only the relief within the cascade — say a kilometre either side of the
  // centre. The old range was 1 to 4200, which spread the whole depth buffer
  // over four kilometres to describe a hangar twelve metres tall: twelve metres
  // came to 0.0029 of the range and the depth bias alone was 0.0016 of it, so
  // more than half of every shadow was biased away before it was ever sampled.
  // Half the slab, in metres. Everything that casts — the aerodrome and the
  // aeroplane — is within a few hundred metres of the focus, and the focus is
  // the aeroplane, so this only has to be deep enough to hold the field when
  // you are on it. Cruising at two thousand feet it puts the ground outside the
  // far plane and the aeroplane's shadow stops being drawn, which is the right
  // answer: at that height nobody can see it, and the metre of bias it cost to
  // keep it was visible every time you parked.
  const DEPTH = 500;
  const cam = new THREE.OrthographicCamera(-R, R, R, -R, 2000 - DEPTH, 2000 + DEPTH);

  // The near cascade. Its slab is much shallower than the far one's, and that
  // is the point rather than a saving: depth precision is spread over the
  // range, so 520 m instead of 1000 m is twice the resolution per metre — and
  // the bias that buys is what lets a shadow start at somebody's feet instead
  // of a third of a metre away from them. 260 m still catches a caster well
  // up-sun of you with the sun low enough to be worth drawing.
  const RN = CONFIG.shadowNearRadius;
  const DEPTH_N = 260;
  const camN = new THREE.OrthographicCamera(
    -RN, RN, RN, -RN, 2000 - DEPTH_N, 2000 + DEPTH_N);

  const scene = new THREE.Scene();          // holds shadow-casting proxies
  scene.matrixAutoUpdate = false;

  // Proxies that are only worth drawing into the near cascade. A car is nine
  // texels across in the far map and a person is under four — whatever they
  // write there is a speckle, not a shadow, and there are three thousand of
  // them. So they go in a group that is switched off for the far pass, which
  // costs one flag a frame and saves drawing the entire population of Šibenik
  // into a map that cannot represent any of it.
  const nearOnly = new THREE.Group();
  nearOnly.matrixAutoUpdate = false;
  scene.add(nearOnly);

  U.uShadowMap.value = target.texture;
  U.uShadowTexel.value = 1 / res;
  U.uShadowMapN.value = targetN.texture;
  U.uShadowTexelN.value = 1 / resN;

  const _c = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  /** Aim one cascade at a point, snapped to its own texel grid. */
  function aim(c, focus, radius, resolution, out) {
    const sun = U.uSunDir.value;
    _c.copy(focus);
    // Snap to whole texels in light space, otherwise the shadow edges shimmer.
    const texel = (radius * 2) / resolution;
    _c.x = Math.round(_c.x / texel) * texel;
    _c.z = Math.round(_c.z / texel) * texel;

    c.position.copy(_c).addScaledVector(sun, 2000);
    if (Math.abs(sun.y) > 0.999) _up.set(0, 0, 1); else _up.set(0, 1, 0);
    c.up.copy(_up);
    c.lookAt(_c);
    c.updateMatrixWorld(true);
    c.updateProjectionMatrix();

    out.value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
  }

  /**
   * @param focus  centre of the far cascade — the aircraft, mostly
   * @param nearAt centre of the near one. Always the eye: the near cascade
   *               exists for what you are close enough to see touching the
   *               ground, and that is defined from where you are looking, not
   *               from where the aeroplane is.
   */
  function update(focus, nearAt) {
    aim(cam, focus, R, res, U.uShadowMat);
    aim(camN, nearAt || focus, RN, resN, U.uShadowMatN);
  }

  function render(renderer) {
    const prevTarget = renderer.getRenderTarget();
    renderer.setClearColor(0xffffff, 1);
    for (const [t, c, small] of [[target, cam, false], [targetN, camN, true]]) {
      nearOnly.visible = small;
      renderer.setRenderTarget(t);
      renderer.clear(true, true, false);
      renderer.render(scene, c);
    }
    renderer.setRenderTarget(prevTarget);
  }

  /** Depth-only material for a caster, sharing the caster's vertex program. */
  function casterMaterial(vertexShader, uniforms = {}) {
    return new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uShadowPass: { value: 1 } },
      vertexShader,
      fragmentShader: SHADOW_DEPTH_FRAG,
      // Back faces only, which is the fix for shadow acne on a closed body.
      // Writing the *far* side of the hull into the map puts the whole depth of
      // the aeroplane between the lit skin and the nearest occluder, so the skin
      // cannot shadow itself however coarse the texel is. Drawing both sides put
      // a hatched mess of self-shadow down the whole fuselage.
      side: THREE.BackSide,
    });
  }

  // The two depth materials every caster shares: one for ordinary meshes, one
  // for the instanced ones. Two ShaderMaterials is one shader program each and
  // no per-caster state, which is what makes registering a hundred of them free.
  const depthPlain = casterMaterial(SHADOW_CASTER_VERT, { uInstanced: { value: 0 } });
  const depthInst = casterMaterial(SHADOW_CASTER_VERT, { uInstanced: { value: 1 } });

  const moving = [];

  /**
   * Register a mesh as a shadow caster.
   *
   * Casting is a *proxy* rather than a second draw of the real material: the
   * shadow scene gets a mesh sharing the caster's geometry and one of the two
   * depth materials, so a caster costs a draw call and no memory. Anything that
   * moves has to say so, and then its proxy is re-synced from the original's
   * world matrix once a frame; the rest are baked at registration, which is
   * right for a hangar and wrong for an aeroplane.
   *
   * This is the piece that was missing. The cascade, the depth packing and the
   * PCF lookup have all been here since the beginning, and three separate
   * shaders sample `shadowAt()` every frame — but nothing was ever put in the
   * scene to occlude with, so the map cleared to white and every surface in the
   * game decided it was in full sun.
   */
  function cast(mesh, { dynamic = false, instanced = false, near = false,
    material = null } = {}) {
    // `material` is for casters whose vertex program the two shared depth
    // materials cannot express — so far, the skinned figure in src/41-skin.js,
    // whose shape exists only in a bone palette the depth pass has to be handed
    // as well. Everything else shares one of the two and costs no memory.
    const proxy = new THREE.Mesh(mesh.geometry,
      material || (instanced ? depthInst : depthPlain));
    proxy.frustumCulled = false;
    proxy.matrixAutoUpdate = false;
    mesh.updateMatrixWorld(true);
    proxy.matrix.copy(mesh.matrixWorld);
    proxy.matrixWorldNeedsUpdate = true;
    (near ? nearOnly : scene).add(proxy);
    if (dynamic) moving.push({ src: mesh, proxy });
    return proxy;
  }

  /** Register every solid mesh under a group — an aeroplane is thirty of them. */
  function castTree(root, opts = {}) {
    const out = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => { if (o.isMesh && o.geometry) out.push(cast(o, opts)); });
    return out;
  }

  function syncMoving() {
    for (const m of moving) {
      // Visibility as well as position: the undercarriage is hidden the moment
      // it is up, and a wheel that went on casting a shadow from inside the
      // sponson would be the sort of thing you notice and cannot explain.
      m.proxy.visible = m.src.visible;
      if (!m.proxy.visible) continue;
      m.proxy.matrix.copy(m.src.matrixWorld);
      m.proxy.matrixWorldNeedsUpdate = true;
    }
  }

  return {
    target, cam, targetN, camN, scene, update, render, casterMaterial,
    cast, castTree, syncMoving,
    casters: () => scene.children.length,
  };
}
