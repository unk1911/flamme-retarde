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

  float bias = 0.0016;
  float sum = 0.0;
  // 3x3 PCF on a rotated tap pattern.
  for (int j = -1; j <= 1; j++){
    for (int i = -1; i <= 1; i++){
      vec2 o = vec2(float(i), float(j)) * uShadowTexel * 1.35;
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
  const cam = new THREE.OrthographicCamera(-R, R, R, -R, 1, 4200);
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
      side: THREE.DoubleSide,
    });
  }

  return { target, cam, scene, update, render, casterMaterial };
}
