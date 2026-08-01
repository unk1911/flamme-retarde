// -----------------------------------------------------------------------------
// Shadows. Three's built-in pass wants standard materials; every surface here is
// a custom shader and half of them move (the trees bend, the plane banks, the
// smoke drifts), so it is cheaper to own the pass than to fight it.
//
// One orthographic cascade that follows the aircraft, depth packed into RGBA8 so
// it works without float-render support, snapped to texel-sized steps so the
// shadow edges do not crawl while you fly.
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

${GLSL_PACK}

/** 1.0 in full sun, 0.0 in full shadow. */
float shadowAt(vec3 worldPos){
  vec4 sp = uShadowMat * vec4(worldPos, 1.0);
  vec3 uv = sp.xyz / sp.w * 0.5 + 0.5;
  // Outside the cascade there is nothing to occlude with — assume lit, and
  // fade the last few texels so the boundary never shows as a hard line.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || uv.z > 1.0) return 1.0;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float fade = smoothstep(0.0, 0.06, edge);

  // In metres, which is the only way to think about this. The slab is 1 km, so
  // 0.00035 is 35 cm — a little under one 0.44 m texel, which is the worst
  // depth error a sloped caster can put in the map.
  //
  // It was 0.0007 against a 2 km slab, i.e. a metre and a half, and the day the
  // aeroplane became a caster that showed up immediately: parked, its hull sits
  // about two metres over the apron, so most of its own shadow was inside the
  // bias and what landed was a handful of disconnected blocks where the wing
  // and the fin happened to clear it.
  float bias = 0.00035;
  float sum = 0.0;
  // 3x3 PCF on a rotated tap pattern.
  for (int j = -1; j <= 1; j++){
    for (int i = -1; i <= 1; i++){
      // Wide enough that a 28 m aeroplane resolved across 65 texels comes out
      // as a soft aeroplane-shaped patch rather than as the individual texels
      // its wing happens to cover.
      vec2 o = vec2(float(i), float(j)) * uShadowTexel * 2.6;
      float d = unpackDepth(texture2D(uShadowMap, uv.xy + o));
      sum += (uv.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return mix(1.0, sum / 9.0, fade);
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
  const target = new THREE.WebGLRenderTarget(res, res, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.generateMipmaps = false;

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
  const scene = new THREE.Scene();          // holds shadow-casting proxies
  scene.matrixAutoUpdate = false;

  U.uShadowMap.value = target.texture;
  U.uShadowTexel.value = 1 / res;

  const _c = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  function update(focus) {
    const sun = U.uSunDir.value;
    // Centre the cascade a little ahead of the aircraft: what matters is what
    // you are flying toward, not what is already behind the tail.
    _c.copy(focus);
    // Snap to whole texels in light space, otherwise the shadow edges shimmer.
    const texel = (R * 2) / res;
    _c.x = Math.round(_c.x / texel) * texel;
    _c.z = Math.round(_c.z / texel) * texel;

    cam.position.copy(_c).addScaledVector(sun, 2000);
    if (Math.abs(sun.y) > 0.999) _up.set(0, 0, 1); else _up.set(0, 1, 0);
    cam.up.copy(_up);
    cam.lookAt(_c);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();

    U.uShadowMat.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  }

  function render(renderer) {
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, cam);
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
  function cast(mesh, { dynamic = false, instanced = false } = {}) {
    const proxy = new THREE.Mesh(mesh.geometry, instanced ? depthInst : depthPlain);
    proxy.frustumCulled = false;
    proxy.matrixAutoUpdate = false;
    mesh.updateMatrixWorld(true);
    proxy.matrix.copy(mesh.matrixWorld);
    proxy.matrixWorldNeedsUpdate = true;
    scene.add(proxy);
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
    target, cam, scene, update, render, casterMaterial,
    cast, castTree, syncMoving,
    casters: () => scene.children.length,
  };
}
