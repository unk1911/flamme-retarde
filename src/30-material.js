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
uniform sampler2D uBones;
uniform float uBoneRows;

/** One row of one bone's 3x4, out of the palette texture. */
vec4 boneRow(float i){
  return texture2D(uBones, vec2((i + 0.5) / uBoneRows, 0.5));
}

/**
 * One bone's share of a vertex, accumulated as six dot products.
 *
 * The obvious way to write this — and the way it *was* written — is to unpack
 * each bone's three rows into a mat4, weight the four matrices, add them, and
 * multiply once. It is the same arithmetic and it reads better, and it wanted
 * four mat4 temporaries plus three mat4 adds, which is sixteen live floats a
 * bone against a mobile register file. A row of a 3x4 dotted with a homogeneous
 * vertex is the same number for three floats of scratch: position goes in with
 * w = 1 so the translation column applies, the normal with w = 0 so only the
 * rotation does, which is what mat3(sm) was doing the long way round.
 *
 * There are no integers left in here on purpose. The index arrives normalised
 * — 27 as 27/255 — and is scaled back out and floored to a float row number
 * that goes straight into a texture coordinate. min() against the last row
 * because a sampler will happily clamp but a limb thrown to the edge of the
 * palette is still a limb in the wrong place, and it costs one instruction to
 * make that impossible rather than merely unlikely.
 */
void addBone(float bi, float w, vec4 hp, vec4 hn, inout vec3 sp, inout vec3 sn){
  float i = min(floor(bi * 255.0 + 0.5), float(FR_BONES) - 1.0) * 3.0;
  vec4 a = boneRow(i), b = boneRow(i + 1.0), c = boneRow(i + 2.0);
  sp += w * vec3(dot(a, hp), dot(b, hp), dot(c, hp));
  sn += w * vec3(dot(a, hn), dot(b, hn), dot(c, hn));
}
#endif

void main(){
  vec3 p = position;
  vec3 n = normal;
  vLocal = position;

  ${body}

#ifdef FR_SKIN
  {
    // p, not position: the body above has already had its say, and on the one
    // figure that uses it that say is the shape of her face.
    vec4 hp = vec4(p, 1.0);
    // n, not normal, for the same reason as p: a vertex the body above has
    // bent — v2.0's hair falling under gravity — has to be lit as bent. No
    // other figure touches n, so for all of them this is normal exactly.
    vec4 hn = vec4(n, 0.0);
    vec3 sp = vec3(0.0), sn = vec3(0.0);
    addBone(aBoneIdx.x, aBoneWt.x, hp, hn, sp, sn);
    addBone(aBoneIdx.y, aBoneWt.y, hp, hn, sp, sn);
    addBone(aBoneIdx.z, aBoneWt.z, hp, hn, sp, sn);
    addBone(aBoneIdx.w, aBoneWt.w, hp, hn, sp, sn);
    p = sp;
    n = sn;
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
/**
 * ── A HIGHLIGHT THAT IS NOT A LOBE ON A NORMAL ───────────────────────────────
 *
 * Every other surface in this game gets Blinn-Phong: a dot of light where the
 * half vector lines up with the normal. That is right for a wall and wrong for
 * hair, and it is most of why hair in a render reads as moulded plastic. A
 * strand is a CYLINDER — its normal is not a direction, it is a whole disc of
 * them — so what a light leaves on it is a BAND running across the strands,
 * not a dot, and where that band sits depends on the strand direction and not
 * on the surface at all.
 *
 * Kajiya-Kay, which is the cheap version of that and the one every game ships:
 * the band is `sin` of the angle between the strand and the half vector, taken
 * to a power. No extra geometry, no texture, one dot product.
 *
 * TWO BANDS, because hair has two and leaving one out is what makes the cheap
 * version look cheap. The sharp one is light off the OUTSIDE of the strand and
 * is the colour of the sun; the broad one has been through the hair, comes
 * back the colour of the hair, and sits further down towards the tips. They
 * are separated by shifting the strand direction along the normal, which is
 * what `shift` does in every published version of this.
 */
const GLSL_HAIR = /* glsl */ `
float hairBand(vec3 t, vec3 h, float e){
  float d = dot(t, h);
  float s = sqrt(max(0.0, 1.0 - d * d));
  // A strand pointing away from the light carries no band at all, and without
  // this it carries a bright one: sin is symmetric and dot is not.
  return smoothstep(-1.0, 0.0, d) * pow(s, e);
}
vec3 hairLobes(vec3 tan, vec3 n, vec3 v, vec3 l, vec3 tint, float amt){
  vec3 h = normalize(l + v);
  vec3 t1 = normalize(tan + n * 0.08);
  vec3 t2 = normalize(tan - n * 0.12);
  // 0.7 and not 0.9: photographed in full August sun off the sea, the sharp
  // band clipped to white along the top of the tail, and a highlight that has
  // clipped is a highlight with no shape left in it.
  return (vec3(hairBand(t1, h, 110.0)) * 0.7
    + tint * hairBand(t2, h, 16.0) * 1.1) * amt;
}
`;

function solidFragment(body = '', decl = '', lit = '') {
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
${GLSL_WATER}
${GLSL_SHADOW}
${GLSL_HAIR}

void main(){
  vec3 n = normalize(vNormal);
  vec3 base = uBase * vColor;
  float spec = uSpecAmount;
  // How much of that gloss is allowed to be a *mirror*, held apart from how
  // much of it is a highlight. Negative means "whatever spec is", which is
  // what every surface in the game got before there were two numbers here and
  // what every one of them that does not write to this still gets.
  //
  // They are not the same quantity, and one surface proved it. The sun lobe
  // below is a lobe: it is a smooth function of the normal and a noisy normal
  // only makes it wobble. The sky term is a perfect mirror — no roughness, no
  // Fresnel — so reflect() doubles every error in the normal and then maps it
  // onto a gradient that runs from zenith blue to horizon white. On a mesh
  // that has been decimated eightfold that is a patchwork rather than a sheen,
  // and it is invisible only because nearly everything here is matt: at
  // spec 0.09 the patches are a couple of levels wide. At the 0.45 that being
  // hosed puts on the skinned figure's face they were reported, fairly, as
  // splotches under her eyes.
  float env = -1.0;
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
  col += skyColor(normalize(r), false) * (env < 0.0 ? spec : env) * 0.35;

  col += base * uEmissive;

  // ── AND ANYTHING WHOSE LIGHT IS NOT THIS LIGHT ───────────────────────────
  //
  // The body hook runs before the lighting and can change what is lit — the
  // normal, the colour, how glossy it is. This one runs AFTER it and can add a
  // term the model above does not have. There is exactly one caller so far and
  // it is hair, whose highlight is a band across the strands rather than a
  // lobe on the surface — see hairLobes. In scope: col, base, n, spec,
  // viewDir, sh.
  //
  // (NO BACKTICKS IN HERE: this is inside a template literal and one in a
  // comment ends it. Fifth time, and the first outside 43-jadrija.js.)
  ${lit}

  float dist = length(vWorld - uCamPos);
  col = applyHaze(col, dist, vWorld, uSunDir, viewDir);
  // And the water, for whatever part of that distance was under it. Every
  // solid thing in the game goes through here, so this is one line for the
  // fish, a ditched aircraft, a swimmer's own hands and anything else that
  // ever ends up below the surface — and it is free above it, where
  // waterPath() returns zero on the first comparison it makes.
  col = applyWater(col, dist, vWorld);
  gl_FragColor = vec4(col, alpha);
}
`;
}

/**
 * @param color   base colour
 * @param opts    spec / specPower / emissive / body (extra GLSL) / instanced
 *                / uniforms + decl (extra uniforms, supplied *and* declared)
 *                / lit (extra GLSL, after the lighting rather than before it)
 */
function solidMaterial(color, opts = {}) {
  // Spread rather than set: three.js warns about a `defines` of undefined on
  // every material in the game, and there are several hundred of them.
  const m = new THREE.ShaderMaterial({
    ...(opts.defines ? { defines: opts.defines } : {}),
    uniforms: {
      ...shareLight(), ...shareHaze(), ...shareTerrain(), ...shareShadow(),
      ...shareWater(),
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
    fragmentShader: solidFragment(opts.body || '', opts.decl || '',
      opts.lit || ''),
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
