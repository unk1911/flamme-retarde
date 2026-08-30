// -----------------------------------------------------------------------------
// The capillary tile: one seamless sheet of wind-ruffle, baked on the GPU at
// load and handed to the sea as a mipped, anisotropically filtered texture.
//
// Why bake a thing the sea could compute. The sea's detail normal was six
// octaves of value noise evaluated per pixel, and procedural noise has no mip
// chain — there is no cheaper, blurrier version of it to reach for when a pixel
// stops covering one ripple and starts covering forty. The old shader worked
// around that by pinning the ripple period to the *screen* (about ten pixels,
// whatever the distance) and then fading the whole layer out once the footprint
// passed 1.6 m, because past that it was not surface any more, it was grain.
// From the cockpit that fade lands about a third of the way up the frame, and
// everything beyond it is flat plastic.
//
// A texture has the mip chain built in. Bake once at 512 and the hardware
// supplies every coarser version for free, correctly filtered, so the ripples
// can be a real world-scale wavelength and survive all the way to the horizon
// on their own terms rather than being switched off to hide their aliasing.
//
// Nothing is loaded: this is generated on the GPU in about a millisecond and it
// is still one self-contained file with no requests.
// -----------------------------------------------------------------------------

const RIPPLE_RES = 512;

let rippleRT = null;

// How hard the baked slopes lean.
//
// Small, and it has to be. The gradient below is normalised by the sample step,
// which is 1.5/512 of a tile, so the raw numbers coming out of the difference
// are of order ten — a slope of 0.85 put every normal on its side, and a tile
// of saturated normals pointing in random directions averages, under the very
// mipmapping this was all built for, to a flat mid-grey. The texture came out
// looking correct in isolation and rendered a sea of glass. 0.030 is the same
// number ABYSSAL uses, arrived at from the opposite direction.
const RIPPLE_SLOPE = 0.030;

const RIPPLE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uRes;
uniform float uSlope;

${GLSL_NOISE}

// Value noise whose *lattice* wraps at period, which is the only way it tiles.
// Wrapping the sample coordinate is not enough and is the trap: mod() on the
// coordinate makes the last cell interpolate from h21(period - 1) toward
// h21(period), while the first one starts at h21(0), so the field is periodic
// everywhere except across the one edge that matters. The four corners have to
// be fetched through the wrap individually. The octave offset is added after
// the mod, so it shifts the field without unwrapping it.
float vnoiseT(vec2 p, float period, vec2 off){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec2 a0 = mod(i, period) + off;
  vec2 a1 = mod(i + 1.0, period) + off;
  float a = h21(a0);
  float b = h21(vec2(a1.x, a0.y));
  float c = h21(vec2(a0.x, a1.y));
  float d = h21(a1);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Tiling fbm. Octaves double rather than rotate: the rotation is what gives
// fbm2 its character, and it is also exactly what would break the seam, so the
// octaves are offset across the hash instead.
float fbmT(vec2 uv, float freq, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  vec2 off = vec2(0.0);
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    s += a * vnoiseT(uv * freq, freq, off);
    n += a;
    off += vec2(37.0, 19.0);
    freq *= 2.0;
    a *= 0.5;
  }
  return s / n;
}

// Tiling Worley, for the dimple. A wind-ruffled surface is not fractal all the
// way down — close in it is a field of little rounded cells, and fbm alone
// reads as smoke rather than as water.
float worleyT(vec2 uv, float freq){
  vec2 p = uv * freq;
  vec2 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 c = mod(i + g, freq);
      vec2 o = vec2(h21(c), h21(c + vec2(7.31, 3.17)));
      d = min(d, length(g + o - f));
    }
  }
  return clamp(d, 0.0, 1.0);
}

float relief(vec2 uv){
  float a = fbmT(uv, 11.0, 5);
  float b = fbmT(uv + vec2(0.317, 0.129), 26.0, 4);
  // Rounded off hard so the cells contribute shape and not creases: an
  // un-smoothed Worley ridge network amplified into a normal map reads as
  // etched metal the moment the filtering stops blurring it.
  float c = smoothstep(0.10, 0.95, 1.0 - worleyT(uv, 30.0));
  return a * 0.56 + b * 0.30 + c * 0.14;
}

void main(){
  vec2 uv = vUv;
  float e = 1.5 / uRes;
  float gx = (relief(uv + vec2(e, 0.0)) - relief(uv - vec2(e, 0.0))) / (2.0 * e);
  float gy = (relief(uv + vec2(0.0, e)) - relief(uv - vec2(0.0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-gx * uSlope, 1.0, -gy * uSlope));
  // rgb: the normal, biased into 0..1. a: the height, which the foam pass uses
  // as a windrow mask so it does not need a second tile.
  gl_FragColor = vec4(n * 0.5 + 0.5, relief(uv));
}
`;

const RIPPLE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Bake it. Returns the texture and leaves it on U.uRipple for the sea.
 *
 * The target is deliberately RGBA8 with no colour space: three.js writes a
 * render target through whatever colorSpace its texture carries, and the
 * default for a render target is none, so what the shader writes is what comes
 * back — no sRGB transfer on the way in and none on the way out. A
 * normal map that went through an sRGB transfer would be wrong in a way that
 * looks merely "a bit flat", which is the worst kind of wrong to debug.
 */
function bakeRipple(renderer) {
  const rt = new THREE.WebGLRenderTarget(RIPPLE_RES, RIPPLE_RES, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: true,
  });
  rt.texture.generateMipmaps = true;
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;
  // The whole point of the exercise is the grazing angle, where a pixel is a
  // long thin sliver of sea. Trilinear alone picks the mip for the *longer*
  // axis and blurs the ripples away across the short one; anisotropy is what
  // keeps them.
  rt.texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());

  const stage = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uRes: { value: RIPPLE_RES },
      uSlope: { value: RIPPLE_SLOPE },
    },
    vertexShader: RIPPLE_VERT,
    fragmentShader: RIPPLE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  stage.add(quad);

  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(stage, cam);
  renderer.setRenderTarget(prev);

  quad.geometry.dispose();
  mat.dispose();

  U.uRipple.value = rt.texture;
  rippleRT = rt;
  return rt.texture;
}


/**
 * Debug: what actually landed in the tile.
 *
 * A baked texture is the one asset in this build nobody can look at — it is
 * never drawn on its own, and a wrong one does not fail, it just quietly makes
 * the sea flat. Reading four numbers back off it is the whole diagnosis: the
 * red and blue channels are the normal's xz biased to 0.5, so their spread is
 * the slope, and a spread near zero means flat while one near 0.5 means
 * saturated and about to average to flat anyway.
 */
function rippleStats(renderer) {
  if (!rippleRT) return null;
  const n = 64;
  const buf = new Uint8Array(n * n * 4);
  renderer.readRenderTargetPixels(rippleRT, 0, 0, n, n, buf);
  const out = [];
  for (let c = 0; c < 4; c++) {
    let lo = 255, hi = 0, sum = 0;
    for (let i = c; i < buf.length; i += 4) {
      const v = buf[i];
      if (v < lo) lo = v; if (v > hi) hi = v; sum += v;
    }
    out.push({ lo, hi, mean: +(sum / (n * n)).toFixed(1) });
  }
  return { res: RIPPLE_RES, slope: RIPPLE_SLOPE, nx: out[0], ny: out[1], nz: out[2], h: out[3] };
}
