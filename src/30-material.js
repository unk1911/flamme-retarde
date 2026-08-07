// -----------------------------------------------------------------------------
// One lit surface material, shared by the aircraft, the town and the trees.
//
// Everything in the scene is shaded by the same three terms — sun, hemispheric
// ambient, haze — so nothing looks pasted in. Anything that wants more than a
// flat colour supplies a snippet of GLSL that runs after the base colour is
// chosen and before it is lit.
// -----------------------------------------------------------------------------

/**
 * The shared vertex program.
 *
 * @param body  GLSL run on the *bind* pose, before anything is done to it —
 *              before the skinning, before the instance transform. It gets `p`,
 *              which starts as `position` and is what everything downstream
 *              reads. This is the only place a figure can be reshaped rather
 *              than posed: the skin matrix is built from bones and there is no
 *              bone for a cheek.
 * @param decl  extra uniform and varying declarations, as `solidFragment`'s.
 */
function solidVertex(body = '', decl = '') {
  return /* glsl */ `
attribute vec3 aInstPos;
attribute vec4 aInstRot;      // quaternion
attribute vec3 aInstScale;
attribute vec3 aInstColor;
// Two more per-instance colours, supplied only by the crowd (src/42-crowd.js)
// and left unset — and so read as black — by every other instanced layer. One
// tint is not enough for a person: skin, swimwear and hair have to vary
// independently or a beach reads as a rack of the same doll.
attribute vec3 aInstSuit;
attribute vec3 aInstHair;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vVCol;
varying vec3 vSuit;
varying vec3 vHair;

attribute vec3 aVCol;
uniform float uInstanced;
uniform float uHasVCol;

${decl}

vec3 qrot(vec4 q, vec3 v){
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

// Linear-blend skinning, compiled in only for the figures that carry a
// skeleton (src/41-skin.js). It is behind an #ifdef rather than behind a
// uniform because the bone palette is a uniform *array*: a branch would keep
// eighty-four vec4s live in the vertex program of every tree, house and wave in
// the game, and there are implementations where that alone will not link.
#ifdef FR_SKIN
attribute vec4 aBoneIdx;
attribute vec4 aBoneWt;
uniform vec4 uBones[FR_BONES * 3];

// Three rows of a 3x4, unpacked into GLSL's column-major mat4.
mat4 boneMat(int i){
  vec4 a = uBones[i * 3], b = uBones[i * 3 + 1], c = uBones[i * 3 + 2];
  return mat4(a.x, b.x, c.x, 0.0,
              a.y, b.y, c.y, 0.0,
              a.z, b.z, c.z, 0.0,
              a.w, b.w, c.w, 1.0);
}

mat4 skinMat(){
  return boneMat(int(aBoneIdx.x)) * aBoneWt.x
       + boneMat(int(aBoneIdx.y)) * aBoneWt.y
       + boneMat(int(aBoneIdx.z)) * aBoneWt.z
       + boneMat(int(aBoneIdx.w)) * aBoneWt.w;
}
#endif

void main(){
  vec3 p = position;
  vec3 n = normal;
  vLocal = position;

  ${body}

#ifdef FR_SKIN
  {
    mat4 sm = skinMat();
    // p, not position: the body above has already had its say, and on the one
    // figure that uses it that say is the shape of her face.
    p = (sm * vec4(p, 1.0)).xyz;
    n = mat3(sm) * normal;
  }
#endif
  if (uInstanced > 0.5) {
    p *= aInstScale;
    p = qrot(aInstRot, p);
    p += aInstPos;
    n = qrot(aInstRot, n / max(aInstScale, vec3(1e-4)));
    vColor = aInstColor;
    vSuit = aInstSuit;
    vHair = aInstHair;
  } else {
    // p and n rather than position and normal: they are the same thing for
    // everything in the game except a skinned figure, where they are the only
    // place the pose exists.
    vec4 wp = modelMatrix * vec4(p, 1.0);
    p = wp.xyz;
    n = normalize(mat3(modelMatrix) * n);
    vColor = vec3(1.0);
    vSuit = vec3(0.0);
    vHair = vec3(0.0);
  }
  vWorld = p;
  vNormal = normalize(n);
  vUv = uv;
  vVCol = uHasVCol > 0.5 ? aVCol : vec3(1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
}

/**
 * @param body  GLSL run after the base colour is chosen, before it is lit
 * @param decl  extra `uniform` declarations, for anything passed in
 *              `opts.uniforms`. These have to be declared as well as supplied:
 *              three.js will happily hand a ShaderMaterial a uniform the shader
 *              never mentions, and the only symptom is a link failure and a
 *              black object.
 */
function solidFragment(body = '', decl = '') {
  return /* glsl */ `
precision highp float;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vVCol;
varying vec3 vSuit;
varying vec3 vHair;

uniform vec3 uBase;
uniform float uSpecPower;
uniform float uSpecAmount;
uniform float uEmissive;
uniform float uOpacity;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;
uniform float uNight;

${decl}

${GLSL_NOISE}
${GLSL_TERRAIN}
${GLSL_SKY}
${GLSL_HAZE}
${GLSL_SHADOW}

void main(){
  vec3 n = normalize(vNormal);
  vec3 base = uBase * vColor;
  float spec = uSpecAmount;
  float alpha = uOpacity;

  ${body}

  vec3 viewDir = normalize(vWorld - uCamPos);
  float ndl = max(dot(n, uSunDir), 0.0);
  float sh = shadowAt(vWorld);

  vec3 col = base * uSunColor * uSunI * ndl * sh * INV_PI;
  col += base * ambientAt(n, uAmbSky, uAmbGround, uAmbI) * INV_PI * 2.2;

  vec3 hv = normalize(uSunDir - viewDir);
  col += uSunColor * pow(max(dot(n, hv), 0.0), uSpecPower) * spec * sh;

  // A little sky reflection on anything glossy keeps painted metal from
  // reading as plastic when it banks against the blue.
  vec3 r = reflect(viewDir, n);
  col += skyColor(normalize(r), false) * spec * 0.35;

  col += base * uEmissive;

  col = applyHaze(col, length(vWorld - uCamPos), vWorld, uSunDir, viewDir);
  gl_FragColor = vec4(col, alpha);
}
`;
}

/**
 * @param color   base colour
 * @param opts    spec / specPower / emissive / body (extra GLSL) / instanced
 *                / uniforms + decl (extra uniforms, supplied *and* declared)
 */
function solidMaterial(color, opts = {}) {
  // Spread rather than set: three.js warns about a `defines` of undefined on
  // every material in the game, and there are several hundred of them.
  const m = new THREE.ShaderMaterial({
    ...(opts.defines ? { defines: opts.defines } : {}),
    uniforms: {
      ...shareLight(), ...shareHaze(), ...shareTerrain(), ...shareShadow(),
      uCamPos: U.uCamPos,
      uBase: { value: new THREE.Color(color) },
      uSpecPower: { value: opts.specPower ?? 42 },
      uSpecAmount: { value: opts.spec ?? 0.12 },
      uEmissive: { value: opts.emissive ?? 0 },
      uOpacity: { value: opts.opacity ?? 1 },
      uInstanced: { value: opts.instanced ? 1 : 0 },
      uHasVCol: { value: opts.vcol === false ? 0 : 1 },
      ...(opts.uniforms || {}),
    },
    vertexShader: solidVertex(opts.vert || '', opts.decl || ''),
    fragmentShader: solidFragment(opts.body || '', opts.decl || ''),
    side: opts.side ?? THREE.FrontSide,
    transparent: !!opts.transparent,
    depthWrite: opts.depthWrite !== false,
  });
  return m;
}

// ------------------------------------------------------------------- lofting ---

/**
 * Skin a stack of rings. Every ring must have the same number of points, given
 * in consistent winding; `caps` closes the ends with a fan to the centroid.
 * This is how every curved surface on the aircraft is built.
 */
function loft(rings, { closed = true, caps = false } = {}) {
  const R = rings.length, P = rings[0].length;
  const pos = [], idx = [];
  for (const ring of rings) for (const p of ring) pos.push(p.x, p.y, p.z);

  const at = (r, p) => r * P + (p % P);
  for (let r = 0; r < R - 1; r++) {
    const lim = closed ? P : P - 1;
    for (let p = 0; p < lim; p++) {
      const a = at(r, p), b = at(r, p + 1), c = at(r + 1, p + 1), d = at(r + 1, p);
      idx.push(a, b, c, a, c, d);
    }
  }

  if (caps) {
    for (const [r, flip] of [[0, true], [R - 1, false]]) {
      const cx = new THREE.Vector3();
      for (let p = 0; p < P; p++) cx.add(rings[r][p]);
      cx.multiplyScalar(1 / P);
      const ci = pos.length / 3;
      pos.push(cx.x, cx.y, cx.z);
      for (let p = 0; p < P; p++) {
        const a = at(r, p), b = at(r, p + 1);
        if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** NACA-style symmetric-ish section, chord 1, returned as a closed ring. */
function airfoil(n, thickness = 0.13, camber = 0.02) {
  const pts = [];
  const yt = (x) => 5 * thickness * (0.2969 * Math.sqrt(x) - 0.126 * x
    - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const yc = (x) => camber * (x < 0.4 ? (2 * 0.4 * x - x * x) / 0.16
    : ((1 - 2 * 0.4) + 2 * 0.4 * x - x * x) / 0.36);
  for (let i = 0; i < n; i++) {              // upper, LE -> TE
    const x = i / (n - 1);
    pts.push(new THREE.Vector2(x, yc(x) + yt(x)));
  }
  for (let i = n - 2; i > 0; i--) {          // lower, TE -> LE
    const x = i / (n - 1);
    pts.push(new THREE.Vector2(x, yc(x) - yt(x)));
  }
  return pts;
}

/**
 * A lifting surface: wing, fin or stabiliser. Sections are placed along the
 * span with chord, sweep, dihedral and twist interpolated between them.
 */
function liftingSurface({
  span, rootChord, tipChord, sweep = 0, dihedral = 0, thickness = 0.14,
  camber = 0.02, sections = 10, mirror = false, taperPow = 1,
}) {
  const prof = airfoil(16, thickness, camber);
  const rings = [];
  const start = mirror ? -1 : 0;
  const list = mirror ? [-1, 1] : [1];
  const build = (sign) => {
    const out = [];
    for (let i = 0; i <= sections; i++) {
      const t = i / sections;
      const y = t * span * 0.5;
      const chord = lerp(rootChord, tipChord, Math.pow(t, taperPow));
      const xoff = t * sweep;
      const ring = prof.map((p) => new THREE.Vector3(
        sign * (y * Math.cos(dihedral)),
        p.y * chord + y * Math.sin(dihedral),
        -(p.x * chord + xoff),
      ));
      out.push(ring);
    }
    return out;
  };
  if (!mirror) return loft(build(1), { closed: true, caps: true });
  const left = build(-1).reverse();
  return loft(left.concat(build(1)), { closed: true, caps: true });
}
