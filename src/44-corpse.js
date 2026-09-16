// -----------------------------------------------------------------------------
// The dead fly, close up.
//
// The last beat of the swat is a cut to the animal itself, and the one thing
// that cannot deliver it is the fly in the room. That fly is 7 mm long and is
// built to be exactly that: four scaled spheres, two blades and six boxes,
// about 3.7 px across at the 1.35 m the camera can get to it. There is nothing
// in it to zoom into, and the camera cannot come closer anyway — the world's
// near plane is 1.2 m and it is load-bearing (pull it in and the exposure
// pumps and the whole scene shimmers; that has been paid for once already).
//
// So the close-up is not a camera move over the existing asset. It is a shot,
// and it is built like one: a SECOND SCENE with a second camera, drawn over the
// finished frame with the colour and depth buffers cleared under it — which is
// exactly what src/60-arms.js does for the swimmer's arms and for the same
// reason. Its camera has its own near plane (2 mm) and its own lens (a 12°
// long lens, which is what a macro actually is), so nothing about the world's
// projection is touched or has to be put back.
//
// The alternative was to keep the world camera and stand a hugely scaled corpse
// in front of it — a 70 cm fly at 1.4 m. It loses on two counts and neither is
// aesthetic: a 100x fly is lit by a sun and a haze function that are computing
// for something the size of a dog, and every distance in this game's shading is
// in world metres, so the specular lobe, the ambient and the fog term would all
// be answering a question about an animal that does not exist. And the fly
// would have to stand somewhere with 1.4 m of clear air in front of it inside a
// 4 m room. A private scene answers both: the corpse is modelled at ITS OWN
// SIZE, 6.5 mm, and photographed from 3 cm with a lighting rig that belongs to
// the shot.
//
// WHAT IS IN THE SHOT, and every line of it is Musca domestica off a plate:
//
//   6.5 mm, of which the thorax is 2.3 and the abdomen 2.85.
//   A grey thorax with FOUR dark longitudinal stripes down the scutum. They are
//      the field mark of the species and they are on its back, which is against
//      the floor here — so the corpse is rolled 36° off square, and that is not
//      a dodge: a dead fly does not balance on a domed back, it settles on to
//      one wing. See CORPSE_ROLL, which is why the shot arcs.
//   Dark red-brown compound eyes, and they are most of the head. Some 4000
//      ommatidia each, which at this magnification is a facet every few pixels,
//      so they are drawn as facets and not as a shiny blob. Wider apart on a
//      female than a male; this one is female, and the pale frons between the
//      eyes is the reason to prefer her — a male's eyes nearly meet and the head
//      loses the one piece of structure it has.
//   ONE pair of wings, and behind them the two halteres: the second pair, evolved
//      into a club on a stalk that beats out of phase as a gyroscope. A fly with
//      four wings is a bee, and a fly with no halteres has had them pulled off.
//   A buff-and-dark chequered abdomen, five segments of it.
//   Bristled legs, and THE LEGS ARE THE WHOLE SHOT. A dead insect on its back
//      has its legs curled inward over its own body, and it is the single
//      silhouette everybody on earth recognises. It happens because the leg is
//      extended hydraulically and flexed by muscle: when the animal dies the
//      pressure goes and the flexors, relaxing last, pull everything in. Get the
//      curl right and this reads instantly; get it wrong and it is a plastic bee
//      on its back.
//
// Built on the first swat and never before it, because most sessions will never
// contain one and this is twenty thousand triangles and eleven materials that
// would otherwise sit in memory for the whole game.
// -----------------------------------------------------------------------------

/**
 * Everything about the corpse, in millimetres, because that is the unit the
 * animal is described in everywhere it has ever been measured. Divided by a
 * thousand exactly once, in `mm()`, and never written as a metre anywhere else
 * in this file — a table of numbers like 0.00135 cannot be checked against a
 * reference and this one can.
 */
const CORPSE = {
  // The body, nose to tail. A housefly is 6–7 mm; the thorax and abdomen are
  // near enough the same length with the head a third of either.
  thorax: { len: 2.30, wide: 2.00, high: 1.80 },
  abdomen: { len: 2.85, wide: 1.70, high: 1.45, segs: 5 },
  // The head capsule, which is NOT the head: it is the narrow core of it and
  // the two eyes stuck on its sides are the rest of it. 0.36 of half-width
  // against the eyes' 0.36 of bulge, with the eyes' centres 0.50 out, makes a
  // head 1.72 mm across of which the middle 0.28 is face — which is a female's
  // frons, and is why she was chosen.
  //
  // Both numbers here are corrections, and both were made by looking at the
  // frame. Built the other way round, with a wide capsule and the lenses sunk
  // into it, the eyes are INSIDE the head and cannot be seen at all. And a
  // capsule that reaches further forward than the lenses do hides them from
  // the front: a fly seen head-on is two enormous eyes with a strip of face
  // between them and no visible skull, so the capsule is short.
  head: { r: [0.42, 0.52, 0.36], at: 1.42 },
  // Each eye. It bulges out from the capsule rather than being sunk in it, and
  // it is most of the animal's head by area.
  eye: { r: [0.56, 0.72, 0.36], at: [1.46, -0.02, 0.50],
    // Facets across the eye. A housefly has around 4000 ommatidia in each eye,
    // which over a hemisphere is roughly 60 by 60 — and at the magnification
    // this shot runs at that is a facet every four or five pixels, which is
    // precisely the detail the cut exists to show.
    facets: 34 },
  wing: { len: 5.60, wide: 2.10, root: [0.60, 0.50, 0.52] },
  // The second pair of wings, and they are why a fly can do what it does: two
  // clubs on stalks beating in antiphase with the wings, sensing the body's
  // rotation the way a rate gyro does.
  haltere: { at: [-1.00, -0.12, 0.80], len: 0.50, knob: 0.19 },
  // Where the six legs leave the underside of the thorax, and how long each
  // pair is. A housefly's hind legs are half again the front pair.
  leg: {
    at: [[0.74, -0.70, 0.40], [-0.06, -0.78, 0.46], [-0.86, -0.70, 0.42]],
    scale: [0.86, 0.96, 1.10],
    coxa: 0.42, femur: 1.32, tibia: 1.26, tarsus: 0.26, tarsi: 5,
  },
};

/** The one place millimetres become metres. */
const mm = (v) => v / 1000;

/**
 * How far off square it is lying, in radians.
 *
 * A quarter of a right angle, and it is the one number in this file that is a
 * decision about the SHOT rather than about the animal. A fly's back is a dome
 * with a wing folded under each side of it and there is no chance of one coming
 * to rest square on its spine — so some roll is honest whatever the number is.
 * 36° is the value at which BOTH of the things worth seeing are reachable by
 * one camera move: the four striped grey scutum, which is on its back and would
 * otherwise be flat against the tile and never once photographed, and the belly
 * with the six curled legs over it, which is the shot everybody recognises. The
 * close-up starts on the first and arcs round to the second, and that is why it
 * arcs at all.
 *
 * src/44-vikendica.js lies the 3.7-pixel corpse in the room at the same angle,
 * so the two are describing one animal.
 */
const CORPSE_ROLL = 0.62;

/**
 * The corpse's colours, as they should come out of the frame.
 *
 * Written as display values and not as anything linear, because every shader in
 * this game writes straight to the drawing buffer — a raw ShaderMaterial does
 * not get three.js's tone mapping or its colour-space conversion, so what is
 * written here is what is seen. That is the house convention (see
 * src/30-material.js) and this file keeps it.
 */
const CORPSE_COL = {
  thorax: [0.285, 0.282, 0.272],   // mouse grey, dusted
  stripe: [0.085, 0.080, 0.078],   // and the four of them
  abdoLo: [0.395, 0.330, 0.190],   // the buff of the sides, and it is dull
  abdoHi: [0.115, 0.098, 0.080],   // and the dark of the chequer
  head: [0.430, 0.412, 0.360],     // silvery-grey frons and genae, warm
  rostrum: [0.205, 0.180, 0.150],  // the trunk, hard and brown
  labellum: [0.365, 0.315, 0.250], // and the two soft pads it eats with
  eye: [0.360, 0.105, 0.070],      // dark red-brown
  eyeRim: [0.180, 0.050, 0.038],
  leg: [0.115, 0.100, 0.086],
  bristle: [0.055, 0.050, 0.048],
  // A shade under the tile it is lying on, which is the whole trick with a
  // wing: it is transparent, so what makes it visible is that it takes a
  // little of the light out of whatever is behind it. Brighter than the tile
  // and it disappears against it, which is what the first pass did.
  wing: [0.520, 0.550, 0.605],
  haltere: [0.760, 0.700, 0.470],  // pale yellow, and they are always paler
  floor: [0.620, 0.625, 0.630],    // glazed white tile, which is what is there
};

/**
 * The shot's own lighting rig, in the shader, in the stage's own frame.
 *
 * Three lights and a bounce, and the bounce is the one that matters. The animal
 * is lying on its back on a white glazed tile in a room with a wall of glass in
 * it, so the side facing the camera — the underside — is lit almost entirely by
 * what comes back UP off the tile. Take the bounce out and the shot is a black
 * fly with a bright rim, which is a photograph of a mistake.
 *
 * No shadow map. There is one shadow in this shot, the fly's own on the tile,
 * and it is worth more as four analytic blobs that can be shaped than as a
 * 2048² depth pass over an object 6 mm across.
 */
const CORPSE_LIGHT = /* glsl */ `
const vec3 KEY_DIR = normalize(vec3(-0.42, 0.86, 0.32));
const vec3 KEY_COL = vec3(1.00, 0.965, 0.905) * 1.05;
const vec3 FILL_DIR = normalize(vec3(0.78, 0.30, -0.52));
const vec3 FILL_COL = vec3(0.52, 0.585, 0.680) * 0.42;
const vec3 RIM_DIR = normalize(vec3(0.18, 0.22, -0.96));
const vec3 RIM_COL = vec3(0.86, 0.90, 1.00) * 0.55;
const vec3 SKY_AMB = vec3(0.235, 0.260, 0.300);
const vec3 BOUNCE = vec3(0.430, 0.415, 0.375);

vec3 lightAt(vec3 n, vec3 v, float spec, float power){
  // Hemispheric ambient, upside down on purpose: the ground term is the tile
  // and it is the brightest thing in the room.
  float up = n.y * 0.5 + 0.5;
  vec3 amb = mix(BOUNCE, SKY_AMB, up);
  vec3 col = amb;
  col += KEY_COL * max(dot(n, KEY_DIR), 0.0);
  col += FILL_COL * max(dot(n, FILL_DIR), 0.0);
  col += RIM_COL * max(dot(n, RIM_DIR), 0.0);
  return col;
}

vec3 glossAt(vec3 n, vec3 v, float spec, float power){
  vec3 s = vec3(0.0);
  s += KEY_COL * pow(max(dot(n, normalize(KEY_DIR - v)), 0.0), power);
  s += FILL_COL * pow(max(dot(n, normalize(FILL_DIR - v)), 0.0), power) * 0.6;
  s += RIM_COL * pow(max(dot(n, normalize(RIM_DIR - v)), 0.0), power) * 0.8;
  return s * spec;
}
`;

/**
 * Hexagons on a sphere, which is the eye.
 *
 * The facets are laid out in the eye's own spherical angles rather than on its
 * surface, so they run in orderly rows round the curve the way ommatidia do
 * instead of shearing across it. Each facet gets its own normal — domed, tilted
 * outward from its centre — and that is what makes the eye photograph as an eye:
 * four thousand tiny lenses, each catching the key light at a slightly different
 * angle, so the highlight is a field of sparks rather than one wet blob.
 */
const CORPSE_HEX = /* glsl */ `
// Offset from the nearest hex centre, on a unit-pitch hex lattice.
vec2 hexOff(vec2 p){
  vec2 s = vec2(1.0, 1.7320508);
  vec2 a = p - s * (floor(p / s) + 0.5);
  vec2 b = p - s * (floor((p - s * 0.5) / s) + 1.0);
  return dot(a, a) < dot(b, b) ? a : b;
}
`;

/**
 * The one shader every part of the corpse is drawn with.
 *
 * `uPat` picks what happens to the base colour before it is lit, and the list
 * is short because the animal is: plain chitin, the eye, the thorax's four
 * stripes, the abdomen's chequer, the wing, and the tile it is lying on. Every
 * one of them is procedural — there is no texture in this shot and there is no
 * room for one, because the whole frame is 3 cm across and any bitmap that
 * covered it would be resolving a fly at four hundred pixels a millimetre.
 */
function corpseMaterial(color, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Vector3(...color) },
      uAlt: { value: new THREE.Vector3(...(opts.alt || color)) },
      uPat: { value: opts.pat || 0 },
      uSpec: { value: opts.spec ?? 0.35 },
      uPow: { value: opts.power ?? 48 },
      uAlpha: { value: opts.alpha ?? 1 },
      uRadii: { value: new THREE.Vector3(...(opts.radii || [1, 1, 1])) },
      uSpan: { value: new THREE.Vector2(...(opts.span || [1, 1])) },
      uFacets: { value: opts.facets || 30 },
      // The mesh's own rotation into the stage's frame, and it is here because
      // three.js does not give a fragment shader `modelMatrix` — it prepends
      // `viewMatrix` and `cameraPosition` and nothing else. Only the eye needs
      // it, and it needs it because the facets are laid out in the eye's own
      // spherical coordinates and the normal they perturb has to come back out
      // in the stage's. Set once, after the corpse is posed; nothing here moves
      // afterwards.
      uRot: { value: new THREE.Matrix3() },
      // Shared, so one write fades the whole shot to black at the end of it.
      uFade: opts.fade,
      uRes: opts.res,
      // Where the frame starts, in the drawing buffer's pixels. Zero for every
      // shot but the fly cam, which is a viewport in the corner — and
      // `gl_FragCoord` is measured from the window, not from the viewport, so
      // without this the vignette put the whole corner at the edge of a
      // full-screen frame and drew it black.
      uVp: CORPSE_VP,
      // Where the body is, for the tile's own contact shadow — see the floor
      // case below. Four down the animal, two for its buckets, and the seventh
      // is whatever else is standing on the tile: the cake, on a birthday.
      uBlob: opts.blob || { value: [new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3()] },
    },
    transparent: !!opts.transparent,
    depthWrite: opts.depthWrite !== false,
    side: opts.side ?? THREE.FrontSide,
    vertexShader: /* glsl */ `
varying vec3 vP;
varying vec3 vN;
varying vec3 vL;
varying vec2 vUv;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vL = position;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
    fragmentShader: /* glsl */ `
precision highp float;
varying vec3 vP;
varying vec3 vN;
varying vec3 vL;
varying vec2 vUv;
uniform vec3 uBase;
uniform vec3 uAlt;
uniform float uPat;
uniform float uSpec;
uniform float uPow;
uniform float uAlpha;
uniform float uFade;
uniform vec2 uRes;
uniform vec2 uVp;
uniform vec3 uRadii;
uniform vec2 uSpan;
uniform float uFacets;
uniform mat3 uRot;
uniform vec3 uBlob[7];

${CORPSE_LIGHT}
${CORPSE_HEX}

float hash21(vec2 p){
  return fract(sin(dot(p, vec2(41.13, 289.7))) * 43758.5453);
}

// Fine grain, for the tile and for the dust on it. Two octaves is plenty at a
// magnification where one octave is already a stone wall.
float grain(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main(){
  vec3 n = normalize(vN);
  // The wing is one sheet drawn from both sides and the right-hand one is a
  // mirror of the left, so half the triangles in this shot are seen from
  // behind. A built-in material flips the normal for those; a raw shader has
  // to say so. Every other mesh here is closed and never sees a back face.
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vP - cameraPosition);
  vec3 base = uBase;
  float spec = uSpec;
  float power = uPow;
  float alpha = uAlpha;
  // 1 for a surface that makes its own light and is not to be lit by the rig —
  // the candle flame, and nothing else in this scene.
  float emis = 0.0;

  if (uPat > 0.5 && uPat < 1.5) {
    // ── the compound eye ────────────────────────────────────────────────────
    vec3 d = normalize(vL / uRadii);
    float a = atan(d.z, d.x);
    float b = asin(clamp(d.y, -1.0, 1.0));
    vec2 off = hexOff(vec2(a, b) * uFacets);
    float r = length(off);
    // The lens itself: the normal domes away from each facet's centre. The
    // tangent frame is the sphere's own, so the doming follows the eye round.
    vec3 ta = normalize(vec3(-sin(a), 0.0, cos(a)));
    vec3 tb = normalize(cross(d, ta));
    vec3 nl = normalize(normalize(d / uRadii) + (ta * off.x + tb * off.y) * 1.15);
    n = normalize(uRot * nl);
    // And the hairline of dark chitin between the lenses.
    float seam = smoothstep(0.36, 0.50, r);
    base = mix(uBase, uAlt, seam * 0.85);
    // Dead a minute: an eye goes dull from the edge in, and the pale ring where
    // the head's own cuticle meets it is always there.
    base *= 0.82 + 0.30 * smoothstep(0.30, 0.95, abs(d.y));
    spec = mix(1.30, 0.25, seam);
    power = 90.0;
  } else if (uPat > 1.5 && uPat < 2.5) {
    // ── the four stripes ────────────────────────────────────────────────────
    // Across the scutum, which is the dorsal half only: they stop dead at the
    // shoulder and the flanks below are plain grey. uSpan is the thorax's
    // half-width and half-length, so the pattern is written in fractions of the
    // animal and does not have to be re-tuned if it is.
    float across = vL.z / uSpan.x;
    float along = vL.x / uSpan.y;
    float dorsal = smoothstep(-0.55, 0.25, vL.y / (uSpan.x * 0.9));
    // The inner pair sit close either side of the midline, the outer pair
    // about half way out to the shoulder. Fine and dark, and there are four.
    // 0.2 mm wide apiece and 0.2 mm apart, which is what four stripes across a
    // 1.9 mm scutum has to be. The first pass made them 85 microns wide — the
    // arithmetic was right and the reference was not read — and at that width
    // they are a hairline that never once showed up in a frame.
    float s = 0.0;
    s += 1.0 - smoothstep(0.10, 0.20, abs(abs(across) - 0.22));
    s += 1.0 - smoothstep(0.10, 0.21, abs(abs(across) - 0.62));
    // They fade out over the front of the scutum and stop at the scutellum.
    s *= smoothstep(-0.95, -0.55, along) * (1.0 - smoothstep(0.55, 0.95, along));
    base = mix(uBase, uAlt, clamp(s, 0.0, 1.0) * dorsal * 0.92);
    // The dusting. A housefly's thorax is not painted grey, it is black chitin
    // under a bloom of pale pruinosity, and the bloom sits in the low places.
    base *= 0.93 + 0.14 * grain(vL.zx * 2600.0);
  } else if (uPat > 2.5 && uPat < 3.5) {
    // ── the chequered abdomen ───────────────────────────────────────────────
    // Buff sides, a dark midline down the back, and a dark band across the
    // rear of every segment — which read together as the chequer the books
    // describe. uSpan.y is the abdomen's length, uSpan.x its half-width.
    float along = clamp(-vL.x / uSpan.y, 0.0, 1.0);
    float seg = fract(along * 5.0);
    float band = smoothstep(0.62, 0.86, seg);
    float mid = 1.0 - smoothstep(0.10, 0.42, abs(vL.z) / uSpan.x);
    // Down on to the flanks, not just across the back: the chequer is what you
    // see of a housefly's abdomen from anywhere except directly underneath,
    // and a mask that stopped at the midline left this shot — which is a
    // three-quarter from below — with a plain grey pill in the middle of it.
    float dorsal = smoothstep(-0.80, 0.10, vL.y / (uSpan.x * 0.9));
    // And darker toward the tail, which is the other half of the chequer: a
    // housefly's abdomen is buff at the waist and nearly black at the tip, and
    // an even pattern down the whole of it photographs as a wasp.
    float rear = smoothstep(0.05, 0.95, along);
    float dark = clamp(band * 0.52 + mid * 0.78 + rear * 0.62, 0.0, 1.0) * dorsal;
    base = mix(uBase, uAlt, dark);
    // The ventral sternites are the plates this shot is actually looking at,
    // and they are neither the buff of the flanks nor the near-black of the
    // back: a dull grey-drab, banded the same way but far more faintly.
    base = mix(base, mix(vec3(0.300, 0.278, 0.225), vec3(0.175, 0.160, 0.140),
      band * 0.7), 1.0 - dorsal);
    base *= 0.95 + 0.10 * grain(vL.xz * 2100.0);
  } else if (uPat > 3.5 && uPat < 4.5) {
    // ── the wing ────────────────────────────────────────────────────────────
    // A membrane two cells thick with veins in it, and at this size both are
    // visible. uSpan is (length, half-width); u runs root to tip and w runs
    // trailing edge to leading edge.
    float u = clamp(vL.x / uSpan.x, 0.0, 1.0);
    float w = vL.z / uSpan.y;
    float vein = 0.0;
    // The costa, along the leading edge, and the thickest thing on the wing.
    vein = max(vein, 1.0 - smoothstep(0.020, 0.055, abs(w - (0.86 - 0.30 * u * u))));
    // Sc and R1, which run out to the costa in the first half.
    vein = max(vein, (1.0 - smoothstep(0.012, 0.032, abs(w - (0.60 - 0.16 * u))))
      * (1.0 - smoothstep(0.30, 0.46, u)));
    vein = max(vein, (1.0 - smoothstep(0.012, 0.034, abs(w - (0.44 + 0.12 * u))))
      * (1.0 - smoothstep(0.52, 0.66, u)));
    // R2+3 and R4+5, out to the tip.
    vein = max(vein, 1.0 - smoothstep(0.012, 0.034, abs(w - (0.30 + 0.26 * u))));
    vein = max(vein, 1.0 - smoothstep(0.012, 0.034, abs(w - (0.04 + 0.30 * u))));
    // M1+2, and its bend is the field mark of the family: it runs back level
    // and then turns hard forward before the margin, nearly closing the cell
    // against R4+5.
    float bend = u < 0.58 ? -0.26 + 0.06 * u
      : -0.226 + 1.05 * (u - 0.58) * (u - 0.58) * 3.2;
    vein = max(vein, (1.0 - smoothstep(0.012, 0.034, abs(w - bend)))
      * (1.0 - smoothstep(0.88, 0.97, u)));
    // CuA1 and the anal vein, short and low.
    vein = max(vein, (1.0 - smoothstep(0.012, 0.032, abs(w + 0.56 + 0.05 * u)))
      * (1.0 - smoothstep(0.60, 0.74, u)));
    vein = max(vein, (1.0 - smoothstep(0.012, 0.030, abs(w + 0.76 + 0.10 * u)))
      * (1.0 - smoothstep(0.26, 0.40, u)));
    // The two crossveins: r-m at the middle of the wing and dm-cu at the bend.
    vein = max(vein, (1.0 - smoothstep(0.010, 0.030, abs(u - 0.44)))
      * (1.0 - smoothstep(0.02, 0.16, abs(w + 0.06))));
    vein = max(vein, (1.0 - smoothstep(0.010, 0.030, abs(u - 0.615)))
      * (1.0 - smoothstep(0.06, 0.22, abs(w + 0.40))));
    // Membrane: nearly nothing, plus the interference colours a wing two
    // hundred nanometres thick actually shows when the light rakes across it.
    float fres = pow(1.0 - abs(dot(n, v)), 3.0);
    vec3 iris = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + (u * 5.0 + w * 3.0 + fres * 7.0));
    base = mix(uBase, mix(uBase, iris, 0.55), 0.30 + 0.45 * fres);
    base = mix(base, uAlt, vein);
    alpha = mix(uAlpha * (0.42 + 0.55 * fres), 0.94, vein);
    spec = mix(0.35, 0.85, vein);
    // The tiny hairs along the trailing edge, which a wing has and which are
    // the difference between a membrane and a piece of cellophane.
    float fringe = smoothstep(0.86, 1.0, -w) * step(0.05, u);
    alpha = mix(alpha, alpha * (0.35 + 0.65 * step(0.5, grain(vec2(u * 260.0, 0.5)))), fringe);
  } else if (uPat > 4.5 && uPat < 5.5) {
    // ── the tile it is lying on ─────────────────────────────────────────────
    // A glazed ceramic floor tile at four hundred pixels a millimetre, which is
    // a slightly cloudy white with a fine sparkle in the glaze and whatever has
    // landed on it since it was last washed. The grout is metres away and there
    // is none of it in this frame.
    vec2 q = vL.xz * 900.0;
    float g = grain(q) * 0.55 + grain(q * 3.1) * 0.30 + grain(q * 9.3) * 0.15;
    base = uBase * (0.90 + 0.16 * g);
    // Dust: the specks that are on every floor and that give a 6 mm animal
    // something to be big against.
    float sp = grain(q * 24.0);
    base *= 1.0 - 0.45 * smoothstep(0.90, 0.99, sp);
    spec = 0.10 + 0.35 * smoothstep(0.45, 0.85, g);
    power = 26.0;
    // The contact shadow, and it is the only shadow in the shot. Four blobs,
    // each a world-space centre and a radius, laid under the body — a soft
    // ellipse under an animal that is touching the floor along its back and its
    // wing. Without it the fly hovers, which is the one thing a corpse must not
    // do.
    float sh = 0.0;
    for (int i = 0; i < 7; i++) {
      float r = uBlob[i].z;
      if (r <= 0.0) continue;
      float d = length(vP.xz - uBlob[i].xy) / r;
      sh = max(sh, 1.0 - smoothstep(0.35, 1.0, d));
    }
    base *= 1.0 - 0.62 * sh;
  } else if (uPat > 5.5) {
    // ── the candle flame ────────────────────────────────────────────────────
    // A flame is not a lit surface, it is the light: no shading rig touches it
    // (uEmis below), and everything that makes it read as fire is written
    // here. uSpan.x is its height in metres, so the gradient is in fractions
    // of whatever size the flame has been scaled to this frame.
    float u = clamp(vL.y / uSpan.x, 0.0, 1.0);
    // Up the flame: a near-white yellow at the wick going orange, then deep
    // orange at the tip. uBase is the hot end and uAlt the cold one.
    base = mix(uBase, uAlt, smoothstep(0.08, 0.92, u));
    // A flame is brightest at its middle and thins to nothing at its edge, so
    // it goes both darker and more transparent toward the silhouette — which
    // is where the normal turns away from the lens.
    float f = abs(dot(n, v));
    base *= (1.30 - 0.50 * u) * (0.55 + 0.45 * f);
    // And out at the top, where a candle flame is smoke more than fire.
    alpha = uAlpha * (0.26 + 0.74 * f) * (1.0 - smoothstep(0.62, 1.0, u));
    emis = 1.0;
  }

  vec3 col = mix(base * lightAt(n, v, spec, power) + glossAt(n, v, spec, power),
    base, emis);
  // Depth, by the only means a 3 cm scene has: everything past the animal goes
  // down. A real macro lens would do this with a millimetre of depth of field
  // and this shot has none, so the tile is darkened with distance instead —
  // which is what the eye reads off a shallow frame anyway.
  float far = length(vP - cameraPosition);
  col *= 1.0 - 0.45 * (1.0 - emis) * smoothstep(0.050, 0.200, far);
  // And the frame: a soft vignette, and the fade the cut ends on.
  vec2 uv = (gl_FragCoord.xy - uVp) / max(uRes, vec2(1.0));
  float vig = 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.15, 1.0)) * 1.42, 2.4);
  col *= max(vig, 0.0) * uFade;
  gl_FragColor = vec4(col, alpha);
}
`,
  });
}

/**
 * A tapered round segment along +X, from the origin, built at true size.
 *
 * Every piece of this animal is baked at its final size and only ever
 * translated and rotated afterwards — no scale on any transform. That is not
 * tidiness: the eye's facets and the wing's veins are written in the mesh's own
 * local coordinates, and a scaled transform would put the pattern in one space
 * and the normal in another.
 */
function corpseSeg(len, r0, r1, seg = 12, bulge = 0) {
  const rings = [];
  const R = 7;
  for (let i = 0; i < R; i++) {
    const t = i / (R - 1);
    const r = lerp(r0, r1, t) * (1 + bulge * Math.sin(Math.PI * t));
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * TAU;
      ring.push(new THREE.Vector3(t * len, Math.sin(a) * r, Math.cos(a) * r));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, caps: true });
}

/**
 * Where the corpse's contact shadow goes: four blobs down the body's own axis
 * and two under the wings, each [x, y, z, radius] in the body's millimetres.
 *
 * The wing pair is worth a sentence. A wing over a white tile is very nearly
 * invisible — it is a membrane a fifth of a micron thick and the tile is the
 * brightest thing in the shot — so what actually says WING in a photograph of a
 * dead fly is not the wing, it is the shadow of it. Once the animal is up, those
 * two slots go to the buckets.
 */
const CORPSE_SHADE = [[1.7, 0, 0, 0.85], [0.2, 0, 0, 1.05], [-1.5, 0, 0, 0.90],
  [-3.2, 0, 0, 0.60], [-1.5, 0.5, 2.4, 1.50], [-1.5, 0.5, -2.4, 1.50]];

// ── the resurrection ─────────────────────────────────────────────────────────
//
// The swat used to end on the corpse. It ends on the corpse getting up now, and
// then on the corpse flying off with two buckets, because Misha asked for it in
// terms that do not leave much room for interpretation: the fly has joined the
// Bucketeers of America. See src/45-zombie.js for what it does afterwards.
//
// THE BEATS, in seconds into the resurrection, which starts where the corpse's
// two-second still used to fade out:
//
//   0.00  dead, and for long enough that you believe it
//   0.90  a hind leg kicks — one tibia snapping straight and falling back
//   1.45  two more, a front and a middle, on the other side
//   2.00  the spasm: every leg at once, and the wings, dying away
//   2.85  dead again. The pause is the joke, and it is most of a second
//   3.45  it kicks itself over and comes down on its feet
//   4.10  shakes itself off, and rubs its front feet together
//   5.05  the wings come out and start
//   5.40  up, and over to the two buckets it has apparently had all along
//   6.45  down on to the bails
//   7.25  and away with them, up and out of the top of the frame
//   9.30  black
//
// The camera holds the swat's last framing until the kick and then pulls back
// to a frame 26 mm wide, which is what a fly and a pair of buckets need. The
// buckets were never in the tight frame — they are 9 mm to its right — so they
// are there from the first frame the wide one could show them.
const RISE = {
  // [start, length, which legs, how hard]
  twitch: [[0.90, 0.16, [4], 0.9], [1.45, 0.14, [1, 2], 0.8], [1.62, 0.15, [5], 0.7]],
  spasm: [2.00, 0.85],
  flip: [3.45, 0.60],
  hop: 2.6,                  // mm the kick throws it up
  shake: [4.10, 0.85],
  rub: [4.30, 0.70],
  wings: [5.05, 0.35],
  lift: [5.40, 1.05],
  drop: [6.45, 0.45],
  grab: [6.90, 0.25],
  climb: [7.25, 1.65],
  follow: [7.35, 1.55],
  pull: [3.45, 1.15],
  cam: [0.078, 0.34, -0.72], // where the pull-back ends: [d, el, az]
  // Where the pair stands on the tile, [x, z] mm off the corpse, and the yaw
  // the fly picks them up at — which is the one that has it facing the lens
  // with a bucket either side of it rather than one behind the other.
  pair: [-4.1, -8.6],
  yaw: 0.67,
  away: [-2.5, 15.0, 5.5],   // mm it climbs out of the frame by, from the grab
  len: 9.30,
  fade: 0.40,
};

// The pour insert: where on the screen each member of the movement hovers while
// she pours (NDC x, NDC y, metres off the lens), and how they leave in shot B.
// Placed against the frame `__fr.pour.frame(0.75)` makes — up and to the left
// of her pail, over the paving and the pines, where nothing she does happens.
const INSERT = {
  // Five centimetres off the glass: 6.5 mm of fly is a fifth of the frame's
  // height there, and its buckets hang to the height of hers. At 7.5 cm, the
  // first try, it was a dark speck against the pines that read as dirt.
  a: [[-0.30, 0.30, 0.050], [-0.62, 0.46, 0.062], [-0.02, 0.54, 0.070]],
  yawA: -1.10,
  yawB: 2.20,
  jit: { every: 0.23, amp: 0.035 },
  stagger: 0.09,
  tilt: 1.95,
  // Over at 0.42 s for 0.38 — her water reaches the lip at 0.52 — and back at
  // 1.40 for 0.45, a little after hers is dry at 1.23.
  pour: [0.42, 0.38, 1.40, 0.45],
  b: { delay: 0.25, dur: 1.5, from: [0.85, -0.75, 0.085], to: [-0.35, 1.35, 0.11] },
};

/**
 * The fly cam — see `dropShot`. `rect` is where it sits on the screen, in CSS
 * pixels with the origin bottom left the way WebGL wants it; `#flycam` in
 * styles.css is the same box measured from the other corner, and the two
 * formulas have to stay one formula.
 */
const DROPCAM = {
  len: 3.4,
  release: 0.55,
  lift: 2.2,                 // mm the feet hold the bails over the tile
  jolt: 3.0,                 // mm it jumps with the weight gone
  spin: 0.85,                // s of turning round to see where they went
  g: 0.055,                  // m/s² — a fly's own gravity, for watching
  yaw: 0.35,
  // Framed on the whole drop: 21 mm of picture from 4 mm under the tile to
  // the fly's jump at 12 over it. At 7.5 cm and 4.2 mm, the first try, the
  // body was off the top of the frame and only its legs were in it.
  aimY: 6.0,
  cam: [0.105, 0.26, -0.35],
  rect: (W, H) => {
    const w = Math.round(Math.min(W * 0.30, 460));
    const h = Math.round(w * 9 / 16);
    return { x: Math.round(W - w - 24), y: 96, w, h };
  },
};

/**
 * The movement's bucket, at a fly's scale: the same cobalt ten-litre pail she
 * carries — `PAIL` in src/45-bucketeer.js, whose colours these are — made 2.6
 * mm tall. Too big for the animal by a factor nobody will argue with.
 */
const MINIB = {
  h: 2.6, rBase: 0.95, rRim: 1.25, wall: 0.09,
  ear: 2.25,                 // the lugs, above the base
  bail: 1.45,                // and the bail's apex above the lugs
  wire: 0.075,
};

/** The viewport offset every corpse material reads — see `uVp`. Shared. */
const CORPSE_VP = { value: new THREE.Vector2(0, 0) };

/**
 * The zombie fly dance. Misha, 15 Sep 2026: *"i wanna be able to tell the fly
 * to u know, "do your zombie fly dance thing", and for the fly to execute it's
 * funky zombie fly dance, twirling them buckets and shit"*.
 *
 * Six moves in 6.6 s at 120 bpm, each [start, length]:
 *
 *   shimmy     rolling on the beat, legs kicking in turn, buckets swinging
 *   pirouette  three turns, the buckets flying out on the spin
 *   loop       head over heels round a 2.2 mm circle
 *   twirl      both buckets swung right over the top, twice
 *   shuffle    front legs out like a zombie's arms, stepping side to side
 *   finale     one fast turn and a freeze with the buckets overhead
 */
const DANCE = {
  len: 6.9,
  bpm: 120,
  shimmy: [0.00, 1.00],
  pirouette: [1.00, 1.40],
  loop: [2.40, 1.20],
  twirl: [3.60, 1.30],
  shuffle: [4.90, 0.90],
  finale: [5.80, 1.10],
  hover: 2.4,                // mm the bails ride over the tile
  loopR: 2.2,
  overhead: 2.75,            // rad round the foot: nearly straight up
  yaw: 0.35,
  // Framed on the top of the loop, which is the highest the fly gets: 13 mm
  // over the tile. At 13 cm and 8 mm, the first cut, the loop left the top of
  // the frame and the fly was a speck for the rest of it.
  // And 0.30 rad over the tile and not 0.22: from lower down the top of the
  // frame looked a metre across the floor, past the edge of the tile.
  aimY: 10.0,
  cam: [0.10, 0.30, -0.35],
};

/**
 * The birthday number. Misha, 16 Sep 2026: *"today is my Liege's birthday. i
 * wanna be able to ask the zombie fly to do a special dance/performance in
 * honour of My Liege"*.
 *
 * It is a PERFORMANCE and not a dance: the fly flies in carrying a cake with a
 * lit candle on it, sets it down, dances round it for the length of the tune
 * the movement hums (`zombieSong` in src/80-audio.js — the birthday one, and
 * the only time any of them sings anything but hers), blows the candle out on
 * the last phrase, and bows to camera in the smoke.
 *
 * Twelve and a half seconds, and every beat of it is a pure function of `t`
 * like every other shot in this file, so it can be scrubbed a frame at a time
 * by `__fr.ears.flyCam(t, 'birthday')`.
 *
 *   carry    in from stage left with the cake in its front legs
 *   set      down on the tile, and it backs off and presents it
 *   lap      once round the cake, banking, buckets flung out
 *   line     facing camera behind the cake, legs kicking on the beat
 *   twirl    both buckets right over the top, twice
 *   rise     spiralling up over the flame, turning
 *   blow     nose down, wings hard, and the flame leans, gutters and goes
 *   bow      down in front of the cake, arms out, a bow held in the smoke
 */
const BDAY = {
  len: 12.9,
  carry: [0.00, 1.55],
  set: [1.55, 0.85],
  lap: [2.40, 2.40],
  line: [4.80, 1.50],
  twirl: [6.30, 1.50],
  rise: [7.80, 2.15],
  blow: [9.95, 1.15],
  smoke: [11.05, 1.85],
  bow: [11.10, 1.80],
  // The tune starts on `lap` and the last note lands on the bow — see
  // ZSONG.beat in src/80-audio.js, which is the same 0.36 s.
  bpm: 167,
  orbit: 3.6,                // mm — how wide it goes round the cake
  close: 2.9,                // mm — and how close it gets, over the candle
  // HEIGHTS, millimetres over the tile, and the whole shape of this routine
  // comes out of two MEASURED numbers rather than a guess — `metrics` on this
  // shot prints them. The middle pair reaches carryDrop = 4.52 mm down for
  // the bails, and a pail hangs 3.70 mm under the bail it hangs from. So a
  // bucket swung `a` radians off straight down has its base at
  //
  //     body − 4.52 − 3.70 cos a
  //
  // and a fly with them simply hanging cannot come below 8.2 mm. The cake is
  // 2.7 mm tall. The first cut of this danced a body's length over the cake
  // and made no sense; the fix is the swing — every height below is paired
  // with an `…Out` angle that keeps the pair off the tile at it, and the fly
  // works right down beside the thing with its hands visibly full.
  into: 9.5,                 // it comes in at the hanging height
  down: 3.0,                 // and gets this low to put the cake down
  ring: 4.4,                 // the dance, round the cake
  leap: 9.8,                 // the twirl, which needs the hanging height
  top: 11.0,                 // the top of the spiral
  puff: 3.6,                 // where it blows from, just over the flame
  bowY: 3.2,                 // and the bow, down on the tile
  hold: 3.6,                 // how far off its nose the cake rides
  // Where the pair is swung, per beat: hands full, dancing, up at the top of
  // the spiral where it can afford to let them hang, blowing, and the bow.
  // And which way it comes at the candle: a shade over a radian round from
  // upstage, because blowing it out from directly behind put the fly's own
  // head between the lens and the flame for the whole of the wish.
  blowAt: -1.15,
  swingOut: 2.10,
  danceOut: 1.95,
  highOut: 1.30,
  blowOut: 2.20,
  salute: 2.75,
  // THE CAMERA, as keys: [t, metres out, radians up, radians round, what it
  // is aimed at in mm]. Every other shot in this file is one move on a curve,
  // and this one cannot be: it has to be tight on a 2 mm cake for the dance
  // and wide enough for an 11 mm spiral four seconds later, and a single lerp
  // between those two is loose for the first half and short for the second.
  // It also arcs half a radian round over the whole number, which is the one
  // thing in this file that moves for no reason but showmanship.
  key: [
    [0.00, 0.086, 0.30, 0.62, 4.4],
    [2.40, 0.076, 0.26, 0.52, 3.6],
    [6.30, 0.082, 0.28, 0.42, 4.2],
    [8.60, 0.102, 0.34, 0.28, 6.6],
    [11.10, 0.090, 0.26, 0.16, 4.6],
    [12.90, 0.082, 0.24, 0.10, 3.4],
  ],
};

/**
 * And the cake, which is 1.8 mm across. A fly is 6.5 mm long, so this is the
 * cake a fly would need two of its legs to carry — which is what it does.
 */
const CAKE = {
  r: 1.15, h: 0.80,
  icing: 0.14,               // mm proud of the sponge, all round
  wax: [0.085, 1.20],        // the candle: radius, height
  flame: [0.160, 0.54],
  smoke: 0.24,               // and the puffs it leaves
};

const smooth01 = (x) => { const u = sat(x); return u * u * (3 - 2 * u); };
const hash1 = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
/** Between two bearings the short way round, which a lerp of two angles is not. */
const mixAng = (a, b, k) => {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * k;
};

/**
 * Every joint on one animal, found by name — so it works on the corpse and on
 * any clone of it — plus the pose it was built in, which is the dead one.
 *
 * A leg's pose is ten numbers: the hip's three Euler angles, the knee, the
 * shin, and the five tarsal joints.
 */
function animalRefs(body, eyeM, like) {
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const hip = body.getObjectByName('hip' + i);
    const tars = [];
    for (let j = 0; j < CORPSE.leg.tarsi; j++) tars.push(body.getObjectByName('tar' + i + '_' + j));
    const L = {
      i, hip, tars, s: i & 1 ? 1 : -1, row: i >> 1, foot: hip.userData.foot,
      knee: body.getObjectByName('knee' + i), shin: body.getObjectByName('shin' + i),
      v: new Array(10).fill(0),
    };
    L.dead = like ? like.legs[i].dead
      : [hip.rotation.x, hip.rotation.y, hip.rotation.z, L.knee.rotation.z,
        L.shin.rotation.z, ...tars.map((t) => t.rotation.z)];
    legs.push(L);
  }
  const wings = [0, 1].map((k) => {
    const g = body.getObjectByName('wing' + k);
    const W = { g, s: k ? 1 : -1 };
    W.dead = like ? like.wings[k].dead : [g.rotation.y, g.rotation.z];
    return W;
  });
  const eyes = [0, 1].map((k) => body.getObjectByName('eye' + k));
  return { body, legs, wings, eyes, eyeM };
}

/**
 * A living leg, per pair: [azimuth, droop, femur, tibia, first tarsus, curl].
 *
 * The same joint conventions as LEG_DEAD in `buildFlyCorpse`, and the droop is
 * negative for the same reason — ventral is −Y — which on a fly the right way up
 * is simply down. `stand` has the femur up and the tibia down to the tile, which
 * is the knees-out crouch a fly stands in; `tuck` is the legs drawn up in the
 * air; `carry` is the middle pair hanging straight down, reaching for a bail;
 * `rub` is the front pair up under the head.
 */
const LEG_LIVE = {
  stand: [[0.70, -0.30, 0.55, -1.75, 0.95, 0.10], [1.60, -0.36, 0.62, -1.82, 1.00, 0.10],
    [2.40, -0.30, 0.55, -1.75, 0.95, 0.10]],
  tuck: [[0.60, -1.05, 0.40, -1.45, 0.40, 0.22], [1.60, -1.10, 0.30, -1.40, 0.40, 0.22],
    [2.50, -1.00, 0.35, -1.30, 0.40, 0.22]],
  carry: [[1.60, -1.22, 0.05, -0.18, 0.10, 0.04]],
  rub: [[0.30, -0.60, 0.95, -2.25, 0.60, 0.15]],
  // The zombie's arms: the front pair straight out ahead and a little up.
  arms: [[0.12, 0.18, 0.05, -0.15, 0.05, 0.02]],
};
const _live = new Array(10).fill(0);
function liveRaw(L, kind) {
  const T = LEG_LIVE[kind];
  const P = T[Math.min(T.length - 1, L.row)];
  _live[0] = 0; _live[1] = -L.s * P[0]; _live[2] = P[1];
  _live[3] = P[2]; _live[4] = P[3]; _live[5] = P[4];
  for (let j = 1; j < 5; j++) _live[5 + j] = P[5] * (1 + j * 0.4);
  return _live.slice();
}
const copyRaw = (out, a) => { for (let k = 0; k < 10; k++) out[k] = a[k]; return out; };
const mixRaw = (out, a, b, t) => {
  for (let k = 0; k < 10; k++) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};
/** Pose every leg: `fn(leg, scratch)` hands back the ten numbers. */
function setLegs(A, fn) {
  for (const L of A.legs) {
    const v = fn(L, L.v);
    L.hip.rotation.set(v[0], v[1], v[2]);
    L.knee.rotation.z = v[3];
    L.shin.rotation.z = v[4];
    for (let j = 0; j < L.tars.length; j++) L.tars[j].rotation.z = v[5 + j];
  }
}

function miniBucketMats(fade, res) {
  // PAIL.out, PAIL.in and PAIL.wire, and a water lighter than PAIL.water,
  // because a 2 mm pool of dark water photographed from above is a black dot.
  return {
    out: corpseMaterial([0.140, 0.300, 0.650], { spec: 0.55, power: 60, fade, res }),
    in: corpseMaterial([0.095, 0.215, 0.500], { spec: 0.30, power: 40, fade, res,
      side: THREE.BackSide }),
    base: corpseMaterial([0.095, 0.215, 0.500], { spec: 0.30, power: 40, fade, res,
      side: THREE.DoubleSide }),
    wire: corpseMaterial([0.560, 0.575, 0.590], { spec: 0.9, power: 90, fade, res }),
    water: corpseMaterial([0.300, 0.470, 0.580], { spec: 1.0, power: 120, fade, res }),
    stream: corpseMaterial([0.620, 0.760, 0.860], { spec: 0.8, power: 60, fade, res,
      alpha: 0.62, transparent: true, depthWrite: false }),
  };
}

/**
 * One tiny bucket, hung from the apex of its bail.
 *
 * `hang` is the apex — what a foot holds — and `pin` is the ear line below it,
 * which the body turns about when it pours, exactly as the real one does (see
 * `PAIL` in src/45-bucketeer.js: "a bucket rolls over about the bail it is
 * hanging from"). The stream is a separate object in the stage, because water
 * falls straight down whatever the bucket is doing.
 */
function miniBucket(stage, MB) {
  const B = MINIB;
  const hang = new THREE.Group();
  // Yaw, then a swing about the animal's own nose, then fore and aft — so a
  // twirl is one number, the angle round the foot, whatever way it is facing.
  hang.rotation.order = 'YXZ';
  const r = B.rRim + 0.05;
  const bailG = new THREE.TorusGeometry(mm(r), mm(B.wire), 5, 18, Math.PI);
  bailG.scale(1, B.bail / r, 1);
  bailG.translate(0, -mm(B.bail), 0);
  hang.add(new THREE.Mesh(bailG, MB.wire));
  const pin = new THREE.Group();
  pin.position.y = -mm(B.bail);
  hang.add(pin);
  const yb = -B.ear, yr = B.h - B.ear;
  const lathe = (r0, r1, y0, y1, mat) => {
    const g = new THREE.LatheGeometry([new THREE.Vector2(mm(r0), mm(y0)),
      new THREE.Vector2(mm(r1), mm(y1))], 22);
    pin.add(new THREE.Mesh(g, mat));
  };
  lathe(B.rBase, B.rRim, yb, yr, MB.out);
  lathe(B.rBase - B.wall, B.rRim - B.wall, yb + B.wall, yr, MB.in);
  const baseG = new THREE.CircleGeometry(mm(B.rBase), 22);
  baseG.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(baseG, MB.base);
  base.position.y = mm(yb);
  pin.add(base);
  const rimG = new THREE.TorusGeometry(mm(B.rRim - B.wall / 2), mm(0.07), 5, 22);
  rimG.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimG, MB.out);
  rim.position.y = mm(yr);
  pin.add(rim);
  for (const s of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.SphereGeometry(mm(0.14), 8, 6), MB.out);
    lug.position.set(s * mm(B.rRim), 0, 0);
    pin.add(lug);
  }
  const waterG = new THREE.CircleGeometry(1, 22);
  waterG.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterG, MB.water);
  pin.add(water);
  const streamG = new THREE.CylinderGeometry(mm(0.15), mm(0.09), 1, 7, 1, true);
  streamG.translate(0, -0.5, 0);
  const stream = new THREE.Mesh(streamG, MB.stream);
  stream.renderOrder = 4;
  stream.visible = false;
  stage.add(stream);
  stage.add(hang);
  return {
    hang, pin, water, stream,
    setFill(f) {
      water.visible = f > 0.02;
      const k = sat(f);
      const y = yb + B.wall + 0.05 + k * (B.h - B.wall - 0.45);
      const rr = lerp(B.rBase, B.rRim, (y - yb) / B.h) - B.wall;
      water.position.y = mm(y);
      water.scale.set(mm(rr), 1, mm(rr));
    },
  };
}

/**
 * The cake, the candle on it and the smoke off the candle — everything the
 * birthday number needs that is not the animal or its buckets. Built once with
 * the stage and hidden until somebody has a birthday.
 *
 * The flame is the only thing in this scene that is not lit by the scene: see
 * `uPat > 5.5` in `corpseMaterial`. Its flicker is here rather than in the
 * shader because it has to be a pure function of the shot's own `t` — a
 * shader that flickered on wall time would flicker while the shot was held
 * still for a frame grab.
 */
function birthdayCake(stage, fade, res) {
  const C = CAKE;
  const M = {
    sponge: corpseMaterial([0.420, 0.268, 0.148], { spec: 0.16, power: 18, fade, res }),
    icing: corpseMaterial([0.935, 0.880, 0.855], { spec: 0.55, power: 55, fade, res }),
    wax: corpseMaterial([0.950, 0.925, 0.870], { spec: 0.35, power: 34, fade, res }),
    wick: corpseMaterial([0.115, 0.100, 0.090], { spec: 0.15, power: 14, fade, res }),
    flame: corpseMaterial([1.000, 0.870, 0.440], { pat: 6, alt: [1.000, 0.330, 0.060],
      span: [mm(C.flame[1]), 1], transparent: true, depthWrite: false,
      side: THREE.DoubleSide, fade, res }),
    smoke: corpseMaterial([0.560, 0.545, 0.530], { spec: 0.04, power: 8, alpha: 0,
      transparent: true, depthWrite: false, fade, res }),
  };
  const g = new THREE.Group();
  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = mm(y);
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(mm(C.r), mm(C.r * 0.94), mm(C.h), 22), M.sponge, C.h / 2);
  const icingH = 0.20;
  const top = C.h + icingH / 2;
  add(new THREE.CylinderGeometry(mm(C.r + C.icing), mm(C.r + C.icing), mm(icingH), 22),
    M.icing, C.h);
  const waxY = top + C.wax[1] / 2;
  add(new THREE.CylinderGeometry(mm(C.wax[0]), mm(C.wax[0]), mm(C.wax[1]), 12),
    M.wax, waxY);
  const wickY = top + C.wax[1] + 0.06;
  add(new THREE.CylinderGeometry(mm(0.022), mm(0.016), mm(0.16), 5), M.wick, wickY);
  // The flame, in its own group so the shot can lean it, shrink it and put it
  // out without touching where the candle is.
  const flameG = new THREE.Group();
  flameG.position.y = mm(wickY + 0.02);
  const cone = new THREE.ConeGeometry(mm(C.flame[0]), mm(C.flame[1]), 12, 1, true);
  cone.translate(0, mm(C.flame[1] / 2), 0);
  flameG.add(new THREE.Mesh(cone, M.flame));
  g.add(flameG);
  // And the wisp it leaves. Three puffs, rising and spreading.
  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(mm(C.smoke), 8, 6), M.smoke);
    p.visible = false;
    g.add(p);
    puffs.push(p);
  }
  g.visible = false;
  stage.add(g);
  return {
    group: g,
    /** mm from the cake's foot to the top of the wick — where the flame sits. */
    wick: wickY,
    /**
     * The flame: `k` is how much of it is left, 1 to 0, `lean` radians it is
     * pushed over by whatever is beating its wings at it, and `t` the shot's
     * clock, which is all the flicker is a function of.
     */
    setFlame(k, lean, t, dir = 0) {
      const on = k > 0.01;
      flameG.visible = on;
      if (!on) return;
      // WHICH WAY IT LEANS, and it has to be said rather than left to the z
      // axis: a flame pushed straight at the lens or straight away from it is
      // a flame that does not visibly move, and the first cut of this blew
      // one over by fifty degrees without a frame of it reading. `dir` is the
      // bearing it leans toward, and the yaw under the lean puts it there —
      // see the rotation order, which makes this Ry(φ)·Rz(lean).
      flameG.rotation.order = 'YXZ';
      // A candle flame is never still: it breathes at a few hertz and stutters
      // faster than that, and both are bigger the harder it is being blown.
      const gust = 1 + 3.2 * Math.abs(lean);
      const f = 1 + gust * (0.055 * Math.sin(t * 8.3) + 0.035 * Math.sin(t * 21.7 + 1.3));
      // Blown, a flame does not just tip over: it stretches out along the
      // way it is going and thins across it.
      flameG.scale.set(k * (1 - 0.14 * Math.abs(lean)) * f,
        k * (1 + 0.38 * Math.abs(lean)) * f, k * f);
      flameG.rotation.set(0, Math.PI - dir, lean + 0.06 * Math.sin(t * 6.1) * gust);
      M.flame.uniforms.uAlpha.value = Math.min(1, 0.55 + 0.45 * k);
    },
    /** The smoke: `u` is 0 at the moment it goes out and 1 when it is gone. */
    setSmoke(u) {
      const on = u > 0 && u < 1;
      M.smoke.uniforms.uAlpha.value = on ? 0.42 * Math.min(1, u * 6) * (1 - u) : 0;
      for (let i = 0; i < puffs.length; i++) {
        const e = sat((u - i * 0.13) / 0.87);
        puffs[i].visible = on && e > 0;
        puffs[i].position.set(mm(0.10 * Math.sin(e * 5.4 + i)),
          mm(wickY + 0.30 + e * (2.6 + i * 0.7)), mm(0.07 * Math.sin(e * 3.9 + i * 2)));
        const s = 0.45 + 1.7 * e;
        puffs[i].scale.set(s, s * 1.15, s);
      }
    },
    hide(off) { g.visible = !off; },
  };
}

function makePair(stage, MB) {
  const b = [miniBucket(stage, MB), miniBucket(stage, MB)];
  return {
    b,
    hide(off) {
      for (const B of b) { B.hang.visible = !off; if (off) B.stream.visible = false; }
    },
    /** Their two contact shadows, into slots `at` and `at + 1` of the tile's six. */
    shadow(blob, at) {
      for (let k = 0; k < 2; k++) {
        const h = b[k].hang;
        const lift = Math.max(0, h.position.y - mm(MINIB.ear + MINIB.bail));
        const kk = h.visible ? sat(1 - lift / mm(8)) : 0;
        blob.value[at + k].set(h.position.x, h.position.z, mm(MINIB.rRim + 0.2) * kk);
      }
    },
  };
}

/**
 * The corpse, its stage, its camera and its lights.
 *
 * Returns the handful of things the app needs: `render` draws the shot over
 * whatever is already in the frame, and `look` puts the camera somewhere on the
 * move. Everything else is private.
 */
function buildFlyCorpse() {
  const stage = new THREE.Scene();
  // 12 degrees, which is a 200 mm lens on full frame — the shot is a macro and
  // a macro is a LONG lens close up, not a wide one jammed against the subject.
  // At the 3 cm this ends at, the frame is 6.3 mm across and the animal fills
  // most of it. The near plane is 2 mm and it is this camera's own: the world's
  // 1.2 m is never touched, which is the entire argument for the second scene.
  const cam = new THREE.PerspectiveCamera(12, 1.78, 0.002, 0.6);

  const fade = { value: 1 };
  const res = { value: new THREE.Vector2(1280, 720) };
  const blob = { value: [new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3()] };

  const M = {
    chitin: corpseMaterial(CORPSE_COL.thorax, { pat: 2, spec: 0.42, power: 40,
      alt: CORPSE_COL.stripe, fade, res,
      span: [mm(CORPSE.thorax.wide / 2), mm(CORPSE.thorax.len / 2)] }),
    abdomen: corpseMaterial(CORPSE_COL.abdoLo, { pat: 3, spec: 0.34, power: 34,
      alt: CORPSE_COL.abdoHi, fade, res,
      span: [mm(CORPSE.abdomen.wide / 2), mm(CORPSE.abdomen.len)] }),
    head: corpseMaterial(CORPSE_COL.head, { spec: 0.30, power: 36, fade, res }),
    rostrum: corpseMaterial(CORPSE_COL.rostrum, { spec: 0.38, power: 44, fade, res }),
    labellum: corpseMaterial(CORPSE_COL.labellum, { spec: 0.26, power: 22, fade, res }),
    // One material per eye, and it is `uRot` that makes it two: each eye sits
    // on the head at its own tilt, and the facet normals are worked out in the
    // eye's own frame and have to be brought back into the stage's.
    eye: [0, 1].map(() => corpseMaterial(CORPSE_COL.eye, { pat: 1, spec: 1.1,
      power: 90, alt: CORPSE_COL.eyeRim, fade, res, facets: CORPSE.eye.facets,
      radii: [mm(CORPSE.eye.r[0]), mm(CORPSE.eye.r[1]), mm(CORPSE.eye.r[2])] })),
    leg: corpseMaterial(CORPSE_COL.leg, { spec: 0.46, power: 52, fade, res }),
    bristle: corpseMaterial(CORPSE_COL.bristle, { spec: 0.55, power: 60, fade, res }),
    haltere: corpseMaterial(CORPSE_COL.haltere, { spec: 0.40, power: 44, fade, res }),
    wing: corpseMaterial(CORPSE_COL.wing, { pat: 4, spec: 0.5, power: 70,
      alt: [0.30, 0.255, 0.215], alpha: 0.46, fade, res,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      span: [mm(CORPSE.wing.len), mm(CORPSE.wing.wide / 2)] }),
    floor: corpseMaterial(CORPSE_COL.floor, { pat: 5, spec: 0.2, power: 26,
      fade, res, blob }),
  };

  // ── the body ────────────────────────────────────────────────────────────────
  // The whole animal hangs off one group, and that group is what gets rolled on
  // to its back. Inside it, +X is the way the fly is pointing and +Y is its
  // BACK — the same convention the live fly in src/44-vikendica.js uses, so the
  // two are describing the same animal in the same frame.
  const body = new THREE.Group();
  const eyes = [];
  const add = (geo, mat, at, rot) => {
    const m = new THREE.Mesh(geo, mat);
    if (at) m.position.set(at[0], at[1], at[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    body.add(m);
    return m;
  };

  {
    const T = CORPSE.thorax;
    // The thorax, and it is not a ball: it is a barrel that is widest a third
    // of the way back, cut off square at the front where the head sits on it
    // and drawn out at the back into the scutellum, the little shield over the
    // waist that every fly has and that is the last thing you see going away.
    const rings = [];
    const R = 18;
    for (let i = 0; i < R; i++) {
      const t = i / (R - 1);
      // Half-width and half-height down the length, as fractions of the box,
      // with t running from the neck to the scutellum.
      //
      // BROAD AT THE FRONT. The first pass tapered both ends to a point, and
      // the result was a head sitting a fifth of a millimetre off the front of
      // a thorax with clear tile visible between them — a fly in three pieces.
      // A fly's thorax is a barrel that is nearly full width where the head
      // joins it and does all its tapering at the back, into the scutellum.
      const f = t < 0.20 ? 0.66 + 0.34 * (t / 0.20)
        : t < 0.70 ? 1
          : 1 - 0.84 * Math.pow((t - 0.70) / 0.30, 1.4);
      const w = mm(T.wide / 2) * f;
      const h = mm(T.high / 2) * f;
      const ring = [];
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * TAU;
        // Flatter underneath than over: a thorax is a dome on a floor, not an
        // egg. sin(a) is the dorsal axis.
        const s = Math.sin(a), c = Math.cos(a);
        ring.push(new THREE.Vector3(
          mm(T.len) * (0.5 - t), s * h * (s < 0 ? 0.78 : 1.0), c * w));
      }
      rings.push(ring);
    }
    add(loft(rings, { closed: true, caps: true }), M.chitin);

    // And the macrochaetae: the big black bristles that stand off a fly's
    // thorax in rows and are half of why a fly looks like a fly rather than
    // like a bean with legs. Their positions on a muscid are a described
    // pattern — acrostichal and dorsocentral rows down the scutum, a row along
    // each shoulder, and two pairs on the scutellum — and at this
    // magnification you would notice their absence long before you noticed
    // that they were in the wrong place.
    const bristleAt = (x, ang, up, len) => {
      const g = new THREE.Group();
      const w = mm(T.wide / 2) * 0.94, h = mm(T.high / 2) * 0.94;
      g.position.set(mm(T.len) * x, Math.sin(ang) * h, Math.cos(ang) * w);
      // Standing off the surface it grows out of, swept back, which is the way
      // every bristle on the animal lies. Rz takes the segment's own +X round
      // to the body's +Y and Rx then swings it to the angle on the barrel;
      // anything past a right angle in the first of those is the sweep.
      g.rotation.set(Math.PI / 2 - ang, 0, Math.PI / 2 + up);
      g.add(new THREE.Mesh(corpseSeg(mm(len), mm(0.026), mm(0.006), 5),
        M.bristle));
      body.add(g);
    };
    for (const x of [0.24, 0.06, -0.12, -0.30]) {
      for (const a of [1.15, 1.72, 2.30, 2.85]) {
        bristleAt(x, a, 0.55, 0.34);
        bristleAt(x, -a, 0.55, 0.34);
      }
    }
    // The scutellum's pair, which are the longest on the animal.
    bristleAt(-0.44, 1.35, 0.95, 0.46);
    bristleAt(-0.44, -1.35, 0.95, 0.46);
  }

  {
    const A = CORPSE.abdomen;
    // Five segments, and they are stepped rather than smooth: each tergite
    // overlaps the one behind it, so the outline down the side of a fly's
    // abdomen is a row of shallow scallops and not a cone.
    const rings = [];
    const R = 42;
    for (let i = 0; i < R; i++) {
      const t = i / (R - 1);
      // Ovoid and not conical: a housefly's abdomen is widest at the second
      // segment and comes to a blunt point, and the first pass — a straight
      // square taper — photographed as a pine cone.
      const taper = (0.86 + 0.14 * Math.sin(Math.min(1, t * 3.4) * Math.PI * 0.5))
        * (1 - 0.72 * Math.pow(t, 2.4));
      const seg = (t * A.segs) % 1;
      // The overlap: each segment swells to its rear edge and the next one
      // starts a hair inside it. Small — 2%, not 6%: at 6% the profile is a
      // screw thread, and a tergite overlaps its neighbour by a hair.
      const step = 1 + 0.022 * Math.sin(seg * Math.PI) - 0.018 * smoothstep(0.86, 1, seg);
      const w = mm(A.wide / 2) * taper * step;
      const h = mm(A.high / 2) * taper * step;
      const ring = [];
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * TAU;
        const s = Math.sin(a), c = Math.cos(a);
        // Built about its OWN origin — x from 0 at the waist to −len at the
        // tip — and then stood on the back of the thorax by the mesh. The
        // first pass baked the offset into the geometry, so the pattern
        // shader's idea of how far down the abdomen a fragment was came out
        // between 0.84 and 1.83 instead of 0 and 1: every band clamped, and
        // the whole abdomen rendered as one flat colour.
        ring.push(new THREE.Vector3(
          -mm(A.len) * t, s * h * (s < 0 ? 0.86 : 1.0), c * w));
      }
      rings.push(ring);
    }
    add(loft(rings, { closed: true, caps: true }), M.abdomen,
      [-mm(CORPSE.thorax.len) * 0.42, 0, 0]);
  }

  {
    const H = CORPSE.head;
    const g = new THREE.SphereGeometry(1, 30, 22);
    g.scale(mm(H.r[0]), mm(H.r[1]), mm(H.r[2]));
    g.computeVertexNormals();
    add(g, M.head, [mm(H.at), 0, 0]);

    // The eyes, and they are most of the head. Tilted out and back so they wrap
    // the sides the way they do on the animal, which is why a fly can see you
    // coming from behind it.
    const E = CORPSE.eye;
    for (const s of [-1, 1]) {
      const eg = new THREE.SphereGeometry(1, 40, 30);
      eg.scale(mm(E.r[0]), mm(E.r[1]), mm(E.r[2]));
      eg.computeVertexNormals();
      const m = add(eg, M.eye[s > 0 ? 1 : 0],
        [mm(E.at[0]), mm(E.at[1]), s * mm(E.at[2])]);
      m.rotation.set(s * 0.30, 0, 0.12);
      m.name = 'eye' + (s > 0 ? 1 : 0);
      eyes.push(m);
    }

    // The antennae: two of them, short, three jointed, with the feathered arista
    // off the third joint. They point down and forward off the front of the
    // face, which on a fly lying on its back is straight at the camera.
    for (const s of [-1, 1]) {
      const root = new THREE.Group();
      root.position.set(mm(1.86), mm(-0.10), s * mm(0.22));
      root.rotation.set(0, s * 0.30, -0.95);
      const post = new THREE.Mesh(corpseSeg(mm(0.52), mm(0.11), mm(0.13), 8), M.leg);
      root.add(post);
      const ar = new THREE.Group();
      ar.position.set(mm(0.42), 0, 0);
      ar.rotation.set(0, 0, 0.75);
      ar.add(new THREE.Mesh(corpseSeg(mm(0.62), mm(0.035), mm(0.012), 6), M.bristle));
      // Plumose: the arista of a housefly carries hairs the whole way down both
      // sides, and at this magnification their absence is conspicuous.
      for (let i = 1; i < 7; i++) {
        for (const side of [-1, 1]) {
          const h = new THREE.Mesh(corpseSeg(mm(0.16), mm(0.012), mm(0.004), 4), M.bristle);
          h.position.set(mm(0.62) * (i / 7), 0, 0);
          h.rotation.set(0, 0, side * 1.1);
          ar.add(h);
        }
      }
      root.add(ar);
      body.add(root);
    }

    // The proboscis, out. A fly's mouth folds up under its head in life and
    // hangs out of it in death — the muscle that retracts it is the muscle that
    // has stopped — and the two soft pads on the end of it, the labellum, are
    // the thing it eats with and the thing that makes it a health hazard.
    const pr = new THREE.Group();
    pr.position.set(mm(1.50), mm(-0.40), 0);
    pr.rotation.set(0, 0, -0.92);
    // Darker than the face, which is what stops the head reading as a heap of
    // pale lumps: the rostrum is hard brown chitin and the two pads on the end
    // of it are soft and paler, and drawn in one colour the whole assembly —
    // capsule, trunk and pads — came out as four overlapping white balls.
    pr.add(new THREE.Mesh(corpseSeg(mm(0.66), mm(0.145), mm(0.125), 10),
      M.rostrum));
    for (const s of [-1, 1]) {
      const lg = new THREE.SphereGeometry(1, 18, 14);
      lg.scale(mm(0.26), mm(0.185), mm(0.150));
      lg.computeVertexNormals();
      const lb = new THREE.Mesh(lg, M.labellum);
      lb.position.set(mm(0.74), mm(-0.05), s * mm(0.135));
      lb.rotation.set(s * 0.25, 0, 0.30);
      pr.add(lb);
    }
    body.add(pr);
  }

  // ── the wings, and the two that became halteres ─────────────────────────────
  {
    const W = CORPSE.wing;
    // The outline. A fly's wing is a rounded blade widest about six tenths out,
    // with the leading edge nearly straight and the trailing edge doing all the
    // curving — and it matters here, because at this size the silhouette is
    // half of what says wing.
    const L = mm(W.len), H = mm(W.wide / 2);
    // Built twice, mirrored, rather than drawn once and hung on a group with a
    // negative scale in it. A mirrored transform turns every triangle in the
    // mesh inside out and puts the vein pattern's own local z the wrong way
    // round; two geometries of ninety triangles each are cheaper than either
    // of those arguments.
    const makeVane = (sg) => {
      const sh = new THREE.Shape();
      // The leading edge — the costa — is the nearly straight one, and it is at
      // +y here; the trailing edge does all the curving and carries the wing's
      // width six tenths of the way out.
      sh.moveTo(0, sg * H * 0.30);
      sh.quadraticCurveTo(L * 0.45, sg * H * 0.86, L * 0.86, sg * H * 0.72);
      sh.quadraticCurveTo(L * 1.01, sg * H * 0.30, L * 0.985, sg * -H * 0.10);
      sh.quadraticCurveTo(L * 0.80, sg * -H * 0.86, L * 0.44, sg * -H * 1.00);
      sh.quadraticCurveTo(L * 0.16, sg * -H * 0.86, 0, sg * -H * 0.34);
      const g = new THREE.ShapeGeometry(sh, 30);
      // Drawn in XY; the wing lies in XZ. +y goes to +z, so the local
      // coordinates the veins are written in survive the turn.
      g.rotateX(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    };

    // Where they go, and this is the one thing on the animal that has to be
    // thought about in the WORLD's frame rather than the body's.
    //
    // A wing leaves the thorax dorsally, and this fly is on its back — so a
    // wing left in its living attitude points straight down through the tile,
    // which is exactly where the first pass put both of them: invisible, under
    // the floor, and reported as "no wings". A dead fly's wings are splayed out
    // FLAT, and flat here means the body's own (0, +0.41, ∓0.91) — the
    // direction that the 24° roll maps on to the horizontal. So each one is
    // aimed by an azimuth that sweeps it back and out and an elevation that
    // brings it round to the floor, and the raised side gets less of the
    // second because it is the side that is off the tile.
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(mm(W.root[0]), mm(W.root[1]), s * mm(W.root[2]));
      // Rz first, then Ry, which is what the default XYZ order does with an
      // x of zero: an elevation and then an azimuth, which is how a wing is
      // described. 2.05 rad of azimuth is 63° back from square.
      // And the elevation is NEGATIVE on the low side, which is the whole of
      // what was wrong the first time: the body is upside down, so its dorsal
      // +Y is world DOWN, and lifting a wing off the tile means going ventral.
      // And ten to twenty degrees clear of the tile rather than lying on it.
      // Flat is (0, ∓0.40) here, and flat is invisible: a membrane seen
      // edge-on from a camera that is itself a centimetre off the floor is a
      // line. Lifted, it takes the key light across its whole surface, which
      // is how a wing is photographed.
      g.rotation.set(0, -s * 2.09, s > 0 ? -0.58 : 0.72);
      const m = new THREE.Mesh(makeVane(s), M.wing);
      m.renderOrder = 3;
      g.add(m);
      g.name = 'wing' + (s > 0 ? 1 : 0);
      body.add(g);
    }

    // And the halteres. Club on a stalk, pale, and they sit in a hollow behind
    // the wing root where you can see them from underneath — which is the view
    // this shot has.
    const HA = CORPSE.haltere;
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(mm(HA.at[0]), mm(HA.at[1]), s * mm(HA.at[2]));
      g.rotation.set(s * -0.45, 0, -0.30);
      g.add(new THREE.Mesh(corpseSeg(mm(HA.len), mm(0.055), mm(0.075), 8), M.haltere));
      const kg = new THREE.SphereGeometry(1, 16, 12);
      kg.scale(mm(HA.knob * 1.25), mm(HA.knob), mm(HA.knob));
      kg.computeVertexNormals();
      const k = new THREE.Mesh(kg, M.haltere);
      k.position.set(mm(HA.len + HA.knob * 0.7), 0, 0);
      g.add(k);
      body.add(g);
    }
  }

  // ── six legs, curled ────────────────────────────────────────────────────────
  /**
   * The pose, per pair, and it is the whole shot.
   *
   * Each row is [az, droop, roll, femur, tibia, tarsus] in radians.
   *
   *   az      the azimuth the leg leaves the body on, measured from the nose
   *           round toward that side: the front pair forward and out, the hind
   *           pair back and out. That fan is what stops six curled legs reading
   *           as one lump under the thorax.
   *   droop   how far ventrally it comes off the thorax, and it is negative
   *           because ventral is −Y. A live fly stands with this near a right
   *           angle; a dead one has it further round, because nothing is
   *           holding the leg out any more.
   *   roll    about the leg's own axis, which chooses the plane it folds in.
   *   femur   the first fold, gentle.
   *   tibia   THE FOLD. A dead insect's tibia lies back against its own femur
   *           at about 140 degrees, and that acute Z is the shape everybody
   *           knows without ever having named it.
   *   tarsus  and the foot curls further still, each of the five joints adding
   *           a little more, so the tip comes round almost to touch the femur.
   *
   * The joint order is YZX and that is load-bearing: it makes the first two
   * numbers an azimuth and an elevation off the body, which is how a leg is
   * actually described, instead of three Euler angles that only mean anything
   * together.
   */
  const LEG_DEAD = [
    [0.95, -0.92, 0.35, -0.28, 2.05, 1.00],
    [1.62, -1.02, 0.48, -0.24, 2.12, 1.08],
    [2.28, -0.96, 0.40, -0.30, 1.98, 0.94],
  ];

  for (let i = 0; i < 6; i++) {
    const s = i & 1 ? 1 : -1;
    const row = i >> 1;
    const P = LEG_DEAD[row];
    const k = CORPSE.leg.scale[row];
    const at = CORPSE.leg.at[row];

    // The chain: every joint is a group whose local +X is the segment, so the
    // pose above is read straight off it and there is no arithmetic between the
    // table and the animal.
    const hip = new THREE.Group();
    hip.position.set(mm(at[0]), mm(at[1]), s * mm(at[2]));
    // −s on the azimuth because a rotation about +Y takes +X toward −Z: the
    // right-hand legs are the ones that need the negative.
    hip.rotation.order = 'YZX';
    hip.rotation.set(s * P[2], -s * P[0], P[1]);
    // Named, so the resurrection can find every joint on this animal and on
    // any clone of it — see `animalRefs`.
    hip.name = 'hip' + i;
    body.add(hip);

    const coxa = new THREE.Mesh(
      corpseSeg(mm(CORPSE.leg.coxa * k), mm(0.155), mm(0.135), 10), M.leg);
    hip.add(coxa);

    const knee = new THREE.Group();
    knee.position.set(mm(CORPSE.leg.coxa * k), 0, 0);
    knee.rotation.set(0, 0, P[3]);
    knee.name = 'knee' + i;
    hip.add(knee);
    // The femur is the thick one — it is the muscle that jumps — and it tapers
    // hard into the joint.
    knee.add(new THREE.Mesh(
      corpseSeg(mm(CORPSE.leg.femur * k), mm(0.135), mm(0.088), 10, 0.22), M.leg));

    const shin = new THREE.Group();
    shin.position.set(mm(CORPSE.leg.femur * k), 0, 0);
    shin.rotation.set(0, 0, P[4]);
    shin.name = 'shin' + i;
    knee.add(shin);
    shin.add(new THREE.Mesh(
      corpseSeg(mm(CORPSE.leg.tibia * k), mm(0.080), mm(0.058), 8), M.leg));

    // The bristles, and a fly's leg is covered in them: two rows down the
    // tibia, a few longer ones on the femur, and they are pointing the wrong
    // way for comfort in every macro photograph ever taken of one.
    const spine = (parent, along, len, ang, roll) => {
      const b = new THREE.Mesh(corpseSeg(mm(len), mm(0.020), mm(0.005), 4), M.bristle);
      b.position.set(mm(along), 0, 0);
      b.rotation.set(roll, 0, ang);
      parent.add(b);
    };
    for (let j = 1; j <= 5; j++) {
      const a = j / 6;
      spine(shin, CORPSE.leg.tibia * k * a, 0.26, 1.25, 0.6);
      spine(shin, CORPSE.leg.tibia * k * (a + 0.06), 0.22, 1.35, -1.9);
      if (j <= 3) spine(knee, CORPSE.leg.femur * k * (0.35 + a * 0.5), 0.30, 1.30, 2.6);
    }

    // The tarsus: five joints, each one turning a little further than the last,
    // which is what makes the foot a curl and not a hook.
    let node = shin;
    let at2 = CORPSE.leg.tibia * k;
    for (let j = 0; j < CORPSE.leg.tarsi; j++) {
      const t = new THREE.Group();
      t.position.set(mm(at2), 0, 0);
      t.rotation.set(0, 0, j === 0 ? P[5] : 0.30 + j * 0.10);
      t.name = 'tar' + i + '_' + j;
      node.add(t);
      const len = CORPSE.leg.tarsus * k * (j === 0 ? 1.5 : 1 - j * 0.10);
      t.add(new THREE.Mesh(
        corpseSeg(mm(len), mm(0.052 - j * 0.005), mm(0.046 - j * 0.005), 7), M.leg));
      if (j < 3) spine(t, len * 0.6, 0.14, 1.35, 1.2);
      node = t;
      at2 = len;
    }
    // The pretarsus: two claws and, between them, the sticky pads that let a
    // fly walk on glass. Curled right under, and the last thing on the animal.
    for (const c of [-1, 1]) {
      const claw = new THREE.Mesh(corpseSeg(mm(0.14), mm(0.030), mm(0.006), 5), M.bristle);
      claw.position.set(mm(at2), 0, 0);
      claw.rotation.set(c * 0.5, 0, 0.9);
      node.add(claw);
    }
    // How far past the last joint the claws are, which is where the foot is.
    hip.userData.foot = mm(at2);
  }

  // ── the tile, and how the animal is lying on it ─────────────────────────────
  // Laid flat in the GEOMETRY and not by rotating the mesh, because the tile's
  // grain and its dust are written in the mesh's own local coordinates: a plane
  // left standing in XY has nothing in its local z to vary along, and the whole
  // floor comes out as one flat colour. Which is exactly what it did.
  // 0.8 m and not 0.3: the fly cam stands back far enough to see the edge of
  // a 30 cm tile. The grain is in metres, so a bigger plane is the same floor.
  const tile = new THREE.PlaneGeometry(0.80, 0.80);
  tile.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(tile, M.floor);
  stage.add(floorMesh);

  const rig = new THREE.Group();
  rig.add(body);
  stage.add(rig);

  /**
   * On its back — and 24 degrees off it, which is the whole of the realism.
   *
   * A fly's back is a dome and its wings are out to one side; there is no
   * chance of one coming to rest square on its spine, and one that did would
   * hide the four stripes that name the species. Rolled a quarter of the way
   * over, the near flank and one wing come up into the light, the underside
   * still faces the camera, and the curled legs stand off the tile instead of
   * being buried in it.
   */
  rig.rotation.set(Math.PI - CORPSE_ROLL, 0.0, 0.0);
  // And the height: rolled, what is touching the tile is a point on the ellipse
  // the thorax cuts across itself, which for semi-axes a across and b deep is
  // sqrt(a² sin²θ + b² cos²θ) — 0.94 mm at 36°, and the wing under it holds it
  // a hair off that.
  rig.position.y = mm(Math.hypot(
    (CORPSE.thorax.wide / 2) * Math.sin(CORPSE_ROLL),
    (CORPSE.thorax.high / 2) * Math.cos(CORPSE_ROLL))) * 0.97;

  stage.updateMatrixWorld(true);

  // Where the shadow goes. Four blobs down the body's own axis, in the stage's
  // world metres, which is where the tile's shader wants them.
  // Each is [x, y, z, radius] in the body's own millimetres.
  const shade = CORPSE_SHADE;
  for (let i = 0; i < shade.length; i++) {
    const p = body.localToWorld(new THREE.Vector3(
      mm(shade[i][0]), mm(shade[i][1]), mm(shade[i][2])));
    blob.value[i].set(p.x, p.z, mm(shade[i][3]));
  }

  // And each eye's own rotation into the stage, now that it has one. See the
  // note on `uRot`: this is the substitute for the `modelMatrix` a fragment
  // shader does not get. It was read once, when nothing here moved again; the
  // fly gets up now, so `poseFrame` reads it again on every frame it moves.
  for (let i = 0; i < eyes.length; i++) {
    M.eye[i].uniforms.uRot.value.setFromMatrix4(eyes[i].matrixWorld);
  }
  // The dead blobs, kept, because the wing pair of them is a decision about a
  // corpse and has no meaning for anything standing up.
  const blobDead = blob.value.map((v) => v.clone());

  // What the lens is pointed at, and it is not the middle of the body: the
  // legs stand two millimetres over the belly and the belly is the subject, so
  // aiming at the centre of mass puts the curl out of the top of the frame.
  const _aim = new THREE.Vector3(0, mm(1.30), 0);
  const _size = new THREE.Vector2(1280, 720);

  /**
   * Point the camera at it.
   *
   * `d` metres out, `el` radians above the tile, `az` radians round from the
   * fly's own nose. Everything the shot does is these three numbers on a curve
   * — plus, since the fly got up, where on the stage it is pointed, which is
   * `_aim` unless something says otherwise.
   */
  function look(d, el, az, aim) {
    cam.position.set(
      Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d,
      Math.cos(el) * Math.sin(az) * d);
    cam.up.set(0, 1, 0);
    cam.lookAt(aim || _aim);
  }

  // ── and then it gets up ─────────────────────────────────────────────────────
  //
  // Misha, 14 Sep 2026: *"it would be hilarious if after a few seconds the fly
  // started twitching a bit, then came back to life ... started flying around
  // again, this time carrying two tiny blue buckets of water. the zombie fly
  // has essentially joined the "Bucketeers of America" movement"*.
  //
  // Everything below drives the SAME animal the corpse is built out of — the
  // named joints on it are the whole interface — and every pose is a pure
  // function of the time into the beat, for the reason `stepDie` gives in
  // src/44-vikendica.js: the swat's cut is scrubbed by `__fr.fly.cutAt`, and a
  // shot that has to arrive somewhere exact cannot be an integrator.
  const A0 = animalRefs(body, M.eye);
  const MB = miniBucketMats(fade, res);
  // The pair of buckets on the tile, and a second pair for every extra member
  // of the movement the pour insert has to show. Built here, once, because the
  // stage is.
  const pairs = [makePair(stage, MB)];
  const extras = [];
  // The cake and its candle, for `birthdayShot` and nothing else.
  const cake = birthdayCake(stage, fade, res);
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const _q = new THREE.Vector3();

  /** Where each foot is, in the stage, for the pose the animal is in now. */
  function footAt(A, i, out) {
    const L = A.legs[i];
    return L.tars[L.tars.length - 1].localToWorld(out.set(L.foot, 0, 0));
  }

  // How high the body rides when it is standing, and where the middle pair of
  // feet end up when they are reaching down for a bail — MEASURED off the pose
  // rather than worked out from the table, because six joints of arithmetic
  // written twice is two answers. Taken once, on the first frame that needs
  // them, with the rig parked at the origin and put back afterwards.
  let standLift = null;
  let carryDrop = null;
  let carrySpan = null;
  function measure() {
    if (standLift != null) return;
    const px = rig.position.clone(), rx = rig.rotation.clone();
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    setLegs(A0, (L) => liveRaw(L, 'stand'));
    rig.updateMatrixWorld(true);
    let lo = Infinity;
    for (let i = 0; i < 6; i++) lo = Math.min(lo, footAt(A0, i, _v).y);
    standLift = -lo;
    setLegs(A0, (L) => (L.row === 1 ? liveRaw(L, 'carry') : liveRaw(L, 'tuck')));
    rig.updateMatrixWorld(true);
    const a = footAt(A0, 2, new THREE.Vector3());
    const b = footAt(A0, 3, new THREE.Vector3());
    carryDrop = -(a.y + b.y) / 2;
    carrySpan = Math.abs(a.z - b.z);
    rig.position.copy(px);
    rig.rotation.copy(rx);
    setLegs(A0, (L) => L.dead);
    rig.updateMatrixWorld(true);
  }

  /**
   * The resurrection, `r` seconds in. See RISE for the beats.
   *
   * `from` is where the swat's own arc left the camera — [d, el, az] — so the
   * first frame of this is the last frame of that and nothing jumps.
   * Returns how hard the wings are going, 0 to 1, which is what the app turns
   * into a buzz.
   */
  function revive(r, from) {
    measure();
    floorMesh.visible = true;
    cake.hide(true);
    for (const x of extras) x.A.body.visible = false;
    for (let k = 1; k < pairs.length; k++) pairs[k].hide(true);
    const P = pairs[0];
    P.hide(false);
    const R = RISE;
    const dead = r < R.flip[0];
    const flipU = sat((r - R.flip[0]) / R.flip[1]);
    const flipE = flipU * flipU * (3 - 2 * flipU);

    // ── the legs ──────────────────────────────────────────────────────────
    const liftU = sat((r - R.lift[0]) / R.lift[1]);
    const grabU = sat((r - R.grab[0]) / R.grab[1]);
    setLegs(A0, (L, v) => {
      if (dead) {
        // Dead, with the twitches on top of it. Each kick is one joint on one
        // leg snapping straight and falling back — the tibia, because that is
        // the fold that is holding the whole curl — and the spasm is all six
        // at once, a nerve firing into a body that has not caught up yet.
        copyRaw(v, L.dead);
        for (const k of R.twitch) {
          const u = (r - k[0]) / k[1];
          if (u <= 0 || u >= 1 || k[2].indexOf(L.i) < 0) continue;
          const kick = Math.sin(u * Math.PI) * k[3];
          v[4] -= kick * 1.4;
          v[5] -= kick * 0.6;
          v[2] += kick * 0.25;
        }
        const sp = (r - R.spasm[0]) / R.spasm[1];
        if (sp > 0 && sp < 1) {
          const amp = (1 - sp) * (1 - sp);
          const w = r * 41 + L.i * 1.9;
          v[4] += amp * 0.55 * Math.sin(w);
          v[3] += amp * 0.30 * Math.sin(w * 1.37 + 1.1);
          v[2] += amp * 0.20 * Math.sin(w * 0.83 + 2.3);
        }
        return v;
      }
      // Over, and on to its feet. The legs go from the curl to the stance
      // across the roll, so the feet are out and reaching by the time the
      // floor comes round to meet them.
      const stand = liveRaw(L, 'stand');
      if (flipU < 1) return mixRaw(v, L.dead, stand, Math.min(1, flipE * 1.3));
      // The rub. Front pair, up under the head, going like a pair of hands
      // that have just had a thought — which is what a fly grooming looks like
      // to everybody who has ever watched one, and this one has earned it.
      const rubU = (r - R.rub[0]) / R.rub[1];
      if (L.row === 0 && rubU > 0 && rubU < 1) {
        const rub = liveRaw(L, 'rub');
        const inU = Math.min(1, Math.min(rubU, 1 - rubU) * 5);
        mixRaw(v, stand, rub, inU);
        v[1] += L.s * 0.22 * Math.sin(r * 38) * inU;
        v[3] += 0.18 * Math.sin(r * 38 + 1.2) * inU;
        return v;
      }
      if (r < R.lift[0]) return copyRaw(v, stand);
      // Up: every leg tucks, except the middle pair, which reach down for the
      // bails and stay reaching.
      const air = L.row === 1 ? liveRaw(L, 'carry') : liveRaw(L, 'tuck');
      return mixRaw(v, stand, air, Math.min(1, liftU * 3));
    });

    // ── the wings ─────────────────────────────────────────────────────────
    const wingOn = sat((r - R.wings[0]) / R.wings[1]);
    const beat = (Math.floor(r * 60) & 1) ? 1 : -1;
    for (const W of A0.wings) {
      if (dead) {
        let y = W.dead[0], z = W.dead[1];
        const sp = (r - R.spasm[0]) / R.spasm[1];
        if (sp > 0 && sp < 1) z += (1 - sp) * 0.25 * Math.sin(r * 53 + W.s);
        W.g.rotation.set(0, y, z);
        continue;
      }
      // Folded down the abdomen once it is over, and out and beating once it
      // means to go. The beat is one frame up, one frame down: 190 strokes a
      // second against 60 frames is a strobe, and a strobe is what a camera
      // actually records of a fly's wings.
      const fold = [-W.s * 2.80, 0.16];
      const fly = [-W.s * 1.70, 0.55 * beat];
      const y0 = lerp(W.dead[0], fold[0], flipE), z0 = lerp(W.dead[1], fold[1], flipE);
      W.g.rotation.set(0, lerp(y0, fly[0], wingOn), lerp(z0, fly[1], wingOn));
    }

    // ── where the body is ─────────────────────────────────────────────────
    const hop = Math.sin(flipU * Math.PI) * mm(RISE.hop);
    const yDead = deadY;
    const C = RISE.pair;
    const yaw = RISE.yaw;
    const latX = Math.sin(yaw), latZ = Math.cos(yaw);
    const cx = mm(C[0]), cz = mm(C[1]);
    const apex = mm(MINIB.ear + MINIB.bail);
    const yGrab = apex + carryDrop;
    let x = 0, y, z = 0, rot = Math.PI - CORPSE_ROLL, yw = 0, jig = 0;
    if (dead) {
      y = yDead;
      const sp = (r - R.spasm[0]) / R.spasm[1];
      if (sp > 0 && sp < 1) jig = (1 - sp) * 0.06 * Math.sin(r * 47);
      for (const k of R.twitch) {
        const u = (r - k[0]) / k[1];
        if (u > 0 && u < 1) jig += Math.sin(u * Math.PI) * 0.035 * k[3];
      }
    } else if (flipU < 1) {
      // Over the long axis, the way it rolled on to its back, with a hop in
      // it: a fly righting itself does not roll, it kicks, and comes down.
      rot = lerp(Math.PI - CORPSE_ROLL, 0, flipE);
      y = lerp(yDead, standLift, flipE) + hop;
    } else if (r < R.lift[0]) {
      rot = 0;
      y = standLift;
      // The shake: a dog out of the sea, which is a joke and is also what a
      // fly that has just got its wings back does before it trusts them.
      const sh = (r - R.shake[0]) / R.shake[1];
      if (sh > 0 && sh < 1) yw = 0.28 * Math.sin(sh * Math.PI * 7) * (1 - sh);
    } else {
      rot = 0;
      const lu = liftU * liftU * (3 - 2 * liftU);
      const du = sat((r - R.drop[0]) / R.drop[1]);
      const de = du * du * (3 - 2 * du);
      const cu = sat((r - R.climb[0]) / R.climb[1]);
      const ce = cu * cu;
      // Up, over, down on to the bails, and up and away with them.
      const hx = cx - latX * 0, hz = cz;
      const bob = mm(0.35) * Math.sin(r * 13);
      if (r < R.drop[0]) {
        x = lerp(0, hx, lu); z = lerp(0, hz, lu);
        y = lerp(standLift, yGrab + mm(1.8), lu) + mm(1.0) * Math.sin(lu * Math.PI) + bob * lu;
      } else if (r < R.climb[0]) {
        x = hx; z = hz;
        y = lerp(yGrab + mm(1.8), yGrab, de) + bob * (1 - grabU);
      } else {
        x = hx + mm(RISE.away[0]) * ce;
        z = hz + mm(RISE.away[2]) * ce;
        y = yGrab + mm(RISE.away[1]) * ce + bob;
      }
      yw = lerp(0, yaw, lu);
    }
    rig.position.set(x, y, z);
    rig.rotation.order = 'XYZ';
    rig.rotation.set(rot + jig, yw, jig * 0.5);
    rig.updateMatrixWorld(true);

    // ── the buckets ───────────────────────────────────────────────────────
    // On the tile until the feet reach them, then off the feet. Placed so the
    // two bails are exactly under the two feet at the grab — `carrySpan` is
    // measured — so the hand-over is a position that does not change rather
    // than a blend that hides a jump.
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1;
      const B = P.b[k];
      const rest = _q.set(cx + latX * s * carrySpan / 2, apex, cz + latZ * s * carrySpan / 2);
      if (r < R.grab[0]) {
        B.hang.position.copy(rest);
        B.hang.rotation.set(0, yaw, 0);
      } else {
        footAt(A0, k ? 3 : 2, _w);
        B.hang.position.lerpVectors(rest, _w, grabU);
        // The swing starts when they leave the tile and not when they are
        // picked up: a bucket still standing on the floor does not sway.
        const g0 = r - R.climb[0];
        const sw = g0 > 0
          ? 0.30 * sat(g0 / 0.25) * Math.exp(-g0 * 1.1) * Math.sin(g0 * 7.5 + s * 0.6) : 0;
        B.hang.rotation.set(sw * 0.6, yaw, sw);
      }
      B.pin.rotation.set(0, 0, 0);
      B.setFill(0);
      B.stream.visible = false;
    }
    // The wings' two shadow slots while it is a corpse, the buckets' after.
    if (dead) { blob.value[4].copy(blobDead[4]); blob.value[5].copy(blobDead[5]); }
    else P.shadow(blob, 4);

    // ── the rest of the frame ────────────────────────────────────────────
    bodyShadow(A0, y);
    eyeRot(A0);

    // The camera. Held on the arc's last frame while it is dead, then out to a
    // frame wide enough for a fly and two buckets, and up after it at the end.
    const pu = sat((r - R.pull[0]) / R.pull[1]);
    const pe = pu * pu * (3 - 2 * pu);
    const up = sat((r - R.follow[0]) / R.follow[1]);
    // And up by 2.4 mm across the lift, because a fly holding a pair of
    // buckets is 7 mm of subject standing on the tile rather than 2.
    const hi = smooth01((r - R.lift[0]) / R.lift[1]);
    _v.set(lerp(0, cx / 2, pe), lerp(_aim.y, mm(2.6), pe) + mm(2.4) * hi + mm(8.0) * up * up,
      lerp(0, cz / 2, pe));
    look(lerp(from[0], R.cam[0], pe), lerp(from[1], R.cam[1], pe),
      lerp(from[2], R.cam[2], pe), _v);
    fade.value = 1 - sat((r - (R.len - R.fade)) / R.fade);
    return dead ? 0 : wingOn;
  }

  /**
   * The body's own shadow on the tile: four blobs down its axis, fading and
   * spreading as it leaves the floor. The last two of the six are the dead
   * wings' on a corpse and are handed to the buckets by `pair.shadow`.
   */
  function bodyShadow(A, y) {
    const lift = Math.max(0, y - (standLift || 0));
    const k = sat(1 - lift / mm(9));
    for (let i = 0; i < 4; i++) {
      const sh = CORPSE_SHADE[i];
      const p = A.body.localToWorld(_v.set(mm(sh[0]), mm(sh[1]), mm(sh[2])));
      blob.value[i].set(p.x, p.z, mm(sh[3]) * k);
    }
  }

  function eyeRot(A) {
    for (let i = 0; i < A.eyes.length; i++) {
      A.eyeM[i].uniforms.uRot.value.setFromMatrix4(A.eyes[i].matrixWorld);
    }
  }

  /** Back to the corpse exactly as it was built, for the next swat. */
  function reset() {
    rig.position.set(0, deadY, 0);
    rig.rotation.order = 'XYZ';
    rig.rotation.set(Math.PI - CORPSE_ROLL, 0, 0);
    setLegs(A0, (L) => L.dead);
    for (const W of A0.wings) W.g.rotation.set(0, W.dead[0], W.dead[1]);
    for (let i = 0; i < blob.value.length; i++) blob.value[i].copy(blobDead[i]);
    for (const P of pairs) P.hide(true);
    cake.hide(true);
    for (const x of extras) x.A.body.visible = false;
    floorMesh.visible = true;
    rig.updateMatrixWorld(true);
    eyeRot(A0);
  }

  /**
   * The pour insert: the movement's members, in front of the lens, pouring
   * their buckets with her. `t` is HER clock — the pour cut's own — `cut` the
   * frame the cut goes to shot B, `fov` the world lens and `n` how many of
   * them there are. Returns nothing; `render(renderer, true)` draws it.
   *
   * Everything is placed in the camera's own frame, which is the stage's
   * origin looking down −Z: the insert is not IN the porch, it is between
   * the porch and the lens, which is where a fly that fills a fifth of the
   * frame at a 34 degree lens actually is — seven centimetres off the glass.
   */
  function insert(t, cut, fov, n) {
    measure();
    floorMesh.visible = false;
    cake.hide(true);
    fade.value = 1;
    cam.fov = fov;
    cam.position.set(0, 0, 0);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, -1);
    const aspect = res.value.x / Math.max(1, res.value.y);
    const th = Math.tan((fov * Math.PI / 180) / 2);
    for (let k = 0; k < 3; k++) {
      if (k >= n) {
        if (k > 0 && extras[k - 1]) extras[k - 1].A.body.visible = false;
        if (pairs[k]) pairs[k].hide(true);
        continue;
      }
      const A = k === 0 ? A0 : extraAnimal(k);
      A.body.visible = true;
      const P = pairOf(k);
      P.hide(false);
      const tk = t - k * INSERT.stagger;
      const holder = k === 0 ? rig : A.body;
      // Where on the screen, and how far off the glass.
      let nx, ny, D, yaw, vis = true;
      const j = INSERT.jit;
      const seg = Math.floor((tk + 7) / j.every);
      const jx = (hash1(seg * 1.7 + k) - 0.5) * j.amp;
      const jy = (hash1(seg * 3.1 + k * 2.3) - 0.5) * j.amp;
      if (t < cut) {
        const at = INSERT.a[k];
        nx = at[0] + jx; ny = at[1] + jy + 0.018 * Math.sin(tk * 8.2);
        D = at[2];
        yaw = INSERT.yawA + 0.12 * Math.sin(tk * 1.7 + k);
      } else {
        const u = (t - cut - INSERT.b.delay - k * INSERT.stagger) / INSERT.b.dur;
        vis = u > 0 && u < 1;
        const e = sat(u);
        const p0 = INSERT.b.from, p1 = INSERT.b.to;
        nx = lerp(p0[0], p1[0], e) + k * 0.10;
        ny = lerp(p0[1], p1[1], e * e) - k * 0.08;
        D = lerp(p0[2], p1[2], e) + k * 0.012;
        yaw = INSERT.yawB;
      }
      if (!vis) { A.body.visible = false; P.hide(true); continue; }
      const px = nx * th * aspect * D, py = ny * th * D, pz = -D;
      holder.position.set(px, py, pz);
      holder.rotation.set(0.10 * Math.sin(tk * 5.1), yaw, 0.08 * Math.sin(tk * 4.3 + 1));
      // Hovering: every leg tucked but the carrying pair.
      setLegs(A, (L) => (L.row === 1 ? liveRaw(L, 'carry') : liveRaw(L, 'tuck')));
      const beat = (Math.floor(t * 60 + k) & 1) ? 1 : -1;
      for (const W of A.wings) W.g.rotation.set(0, -W.s * 1.70, 0.55 * beat);
      holder.updateMatrixWorld(true);
      eyeRot(A);
      // The pour, on her beat: over, held while it runs out, and back.
      const tilt = t < cut
        ? INSERT.tilt * (smooth01((tk - INSERT.pour[0]) / INSERT.pour[1])
          - smooth01((tk - INSERT.pour[2]) / INSERT.pour[3]))
        : 0;
      const fill = t < cut ? 1 - smooth01((tk - INSERT.pour[0] - 0.15) / 0.75) : 0;
      for (let q = 0; q < 2; q++) {
        const s = q ? 1 : -1;
        const B = P.b[q];
        footAt(A, q ? 3 : 2, _w);
        B.hang.position.copy(_w);
        const sw = 0.16 * Math.sin(tk * 6.3 + s + k);
        B.hang.rotation.set(sw * 0.5, yaw, sw);
        B.pin.rotation.set(s * tilt, 0, 0);
        B.setFill(fill);
        B.hang.updateMatrixWorld(true);
        // The water, while there is any to fall and the lip is under it: a
        // thread from the lip straight down and out of the bottom of frame.
        const running = tilt > 1.05 && fill > 0.02 && fill < 0.995;
        B.stream.visible = running;
        if (running) {
          const lip = B.pin.localToWorld(_v.set(0, mm(MINIB.h - MINIB.ear), mm(MINIB.rRim) * s));
          B.stream.position.copy(lip);
          B.stream.scale.set(1, D * 1.1, 1);
        }
      }
    }
  }

  /**
   * The fly cam: "drop your buckets!", `t` seconds after it was said.
   *
   * A corner picture and not a cut — see `render(renderer, 'pip')` — because
   * it is an answer to something the player said while playing, and taking
   * the camera off them for it would be the game answering a question by
   * pausing. The fly is hovering over the tile with a full pair; at 0.55 s it
   * lets go, jolts up with the weight gone and turns right round in surprise,
   * and the two buckets fall, land and go over on their sides.
   */
  function dropShot(t) {
    measure();
    floorMesh.visible = true;
    cake.hide(true);
    for (const x of extras) x.A.body.visible = false;
    for (let k = 1; k < pairs.length; k++) pairs[k].hide(true);
    const P = pairs[0];
    P.hide(false);
    const D = DROPCAM;
    const apex = mm(MINIB.ear + MINIB.bail);
    const rel = t - D.release;
    // Where the feet were at the instant it let go: pose the animal AT the
    // release, read the two feet, then pose it at `t`. Worked out every frame
    // rather than remembered, so a scrub straight to 2 s is the same picture
    // as getting there frame by frame.
    const from = [new THREE.Vector3(), new THREE.Vector3()];
    if (rel > 0) {
      poseDrop(D.release);
      footAt(A0, 2, from[0]);
      footAt(A0, 3, from[1]);
    }
    const y = poseDrop(t);
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1;
      const B = P.b[k];
      if (rel <= 0) {
        footAt(A0, k ? 3 : 2, _w);
        B.hang.position.copy(_w);
        B.hang.rotation.set(0, D.yaw, 0.12 * Math.sin(t * 6 + s));
        B.pin.rotation.set(0, 0, 0);
        B.setFill(1);
      } else {
        // Falling at a fly's own gravity — which is to say slowly enough to
        // watch: 9.81 would be on the tile in 38 ms, one and a bit frames.
        const f = from[k];
        const h = Math.max(0, f.y - apex);
        const fall = Math.min(h, 0.5 * D.g * rel * rel);
        const tLand = Math.sqrt(2 * h / D.g);
        const over = rel > tLand ? smooth01((rel - tLand) / 0.22) : 0;
        B.hang.position.set(f.x, f.y - fall
          - over * mm(MINIB.ear + MINIB.bail - MINIB.rRim), f.z);
        B.hang.rotation.set(0, D.yaw, 0);
        B.pin.rotation.set(s * 1.45 * over, 0, 0);
        B.setFill(over > 0.2 ? 0 : 1);
      }
      B.stream.visible = false;
    }
    P.shadow(blob, 4);
    bodyShadow(A0, y);
    _v.set(0, mm(D.aimY), 0);
    look(D.cam[0], D.cam[1], D.cam[2], _v);
    fade.value = 1;
  }

  /** The animal alone, at `t` into the fly cam. Returns its height. */
  function poseDrop(t) {
    const D = DROPCAM;
    const apex = mm(MINIB.ear + MINIB.bail);
    const yHold = apex + carryDrop + mm(D.lift);
    const rel = t - D.release;
    const jolt = rel > 0 ? mm(D.jolt) * (1 - Math.exp(-rel * 6)) : 0;
    const spin = rel > 0 ? TAU * smooth01(rel / D.spin) : 0;
    const y = yHold + jolt + mm(0.35) * Math.sin(t * 13);
    rig.position.set(0, y, 0);
    rig.rotation.order = 'XYZ';
    rig.rotation.set(0.08 * Math.sin(t * 7.3), D.yaw + spin, 0.06 * Math.sin(t * 5.1));
    setLegs(A0, (L) => (L.row === 1 ? liveRaw(L, 'carry') : liveRaw(L, 'tuck')));
    const beat = (Math.floor(t * 60) & 1) ? 1 : -1;
    for (const W of A0.wings) W.g.rotation.set(0, -W.s * 1.70, 0.55 * beat);
    rig.updateMatrixWorld(true);
    eyeRot(A0);
    return y;
  }

  /**
   * "Do your zombie fly dance thing." The fly cam again, and this time it
   * dances — see DANCE for the routine, beat by beat.
   *
   * The whole routine is a pure function of `t` like every other shot here,
   * and the buckets are part of the choreography rather than dragged along by
   * it: every bucket's angle round its foot is written for each move, so a
   * twirl is a twirl and not a physics accident.
   */
  function danceShot(t) {
    measure();
    floorMesh.visible = true;
    cake.hide(true);
    for (const x of extras) x.A.body.visible = false;
    for (let k = 1; k < pairs.length; k++) pairs[k].hide(true);
    const P = pairs[0];
    P.hide(false);
    const D = DANCE;
    const apex = mm(MINIB.ear + MINIB.bail);
    const base = apex + carryDrop + mm(D.hover);
    const at = (w) => (t - w[0]) / w[1];
    const inW = (w) => t >= w[0] && t < w[0] + w[1];
    const latX = Math.sin(D.yaw), latZ = Math.cos(D.yaw);
    const noseX = Math.cos(D.yaw), noseZ = -Math.sin(D.yaw);
    let side = 0, fore = 0, up = 0, yaw = D.yaw, roll = 0, pitch = 0;
    const tw = [0, 0];     // each bucket's swing round the nose axis, outward +
    const fw = [0, 0];     // and fore and aft
    let kick = 0, arms = 0;
    const beat = Math.sin(TAU * D.bpm / 60 * t);

    if (inW(D.shimmy)) {
      // The shimmy: rolling side to side on the beat, legs kicking in turn,
      // and the buckets swinging the other way like a pair of hips.
      const u = at(D.shimmy);
      const env = Math.min(1, u * 6, (1 - u) * 6);
      roll = 0.45 * Math.sin(TAU * 3 * t) * env;
      up = mm(0.6) * Math.abs(beat);
      kick = env;
      tw[0] = tw[1] = -roll * 1.3;
    } else if (inW(D.pirouette)) {
      // Three turns, and the buckets fly out on the spin.
      const u = smooth01(at(D.pirouette));
      yaw += TAU * 3 * u;
      const out = 1.30 * Math.sqrt(Math.sin(Math.PI * at(D.pirouette)));
      tw[0] = out; tw[1] = out;
      up = mm(2.0) * Math.sin(Math.PI * at(D.pirouette));
    } else if (inW(D.loop)) {
      // The loop-the-loop: once round a vertical circle in the plane of its
      // nose, head over heels, and the buckets trailing through it.
      const u = smooth01(at(D.loop));
      const a = TAU * u;
      pitch = a;
      fore = mm(D.loopR) * Math.sin(a);
      up = mm(D.loopR) * (1 - Math.cos(a));
      fw[0] = fw[1] = -0.9 * Math.sin(a);
    } else if (inW(D.twirl)) {
      // The twirl: bobbing on the beat and swinging BOTH buckets right over
      // the top, twice each, outward — which is the move the whole routine is
      // named for.
      const u = smooth01(at(D.twirl));
      up = mm(0.8) * beat;
      yaw += 0.22 * Math.sin(TAU * 2 * t);
      tw[0] = tw[1] = TAU * 2 * u;
    } else if (inW(D.shuffle)) {
      // The zombie shuffle: front legs straight out in front, leaning in,
      // stepping side to side on the beat.
      const u = at(D.shuffle);
      arms = Math.min(1, u * 5, (1 - u) * 5);
      pitch = -0.28 * arms;
      const step = Math.tanh(4 * Math.sin(TAU * (D.bpm / 120) * (t - D.shuffle[0])));
      side = mm(2.4) * step * arms;
      tw[0] = tw[1] = -0.5 * Math.cos(TAU * (D.bpm / 120) * (t - D.shuffle[0])) * arms;
    } else if (t >= D.finale[0]) {
      // And the finale: one fast turn, then a freeze with the pair swung up
      // over its head.
      const u = at(D.finale);
      yaw += TAU * smooth01(u / 0.45);
      const e = smooth01((u - 0.35) / 0.3);
      tw[0] = tw[1] = D.overhead * e;
      up = mm(1.5) * e;
    }

    rig.position.set(side * latX + fore * noseX, base + up, side * latZ + fore * noseZ);
    rig.rotation.order = 'YXZ';
    rig.rotation.set(roll, yaw, pitch);
    setLegs(A0, (L) => {
      if (L.row === 1) return liveRaw(L, 'carry');
      if (L.row === 0 && arms > 0) return mixRaw(L.v, liveRaw(L, 'tuck'), liveRaw(L, 'arms'), arms);
      if (kick > 0) {
        // Can-can: each leg on its own half of the beat.
        const k = Math.max(0, Math.sin(TAU * 3 * t + (L.row * 2 + (L.s > 0 ? 1 : 0)) * 1.6));
        return mixRaw(L.v, liveRaw(L, 'tuck'), liveRaw(L, 'stand'), k * kick);
      }
      return liveRaw(L, 'tuck');
    });
    const wb = (Math.floor(t * 60) & 1) ? 1 : -1;
    for (const W of A0.wings) W.g.rotation.set(0, -W.s * 1.70, 0.55 * wb);
    rig.updateMatrixWorld(true);
    eyeRot(A0);

    const yawNow = yaw;
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1;
      const B = P.b[k];
      footAt(A0, k ? 3 : 2, _w);
      B.hang.position.copy(_w);
      // Outward is away from the body: for the +Z bucket a negative turn
      // about the nose. See `hang.rotation.order`.
      B.hang.rotation.set(-s * tw[k], yawNow, fw[k]);
      B.pin.rotation.set(0, 0, 0);
      B.setFill(1);
      B.stream.visible = false;
    }
    P.shadow(blob, 4);
    bodyShadow(A0, base + up);
    _v.set(0, mm(D.aimY), 0);
    look(D.cam[0], D.cam[1], D.cam[2], _v);
    fade.value = 1;
  }

  /**
   * The birthday number, `t` seconds in. See BDAY for the beats.
   *
   * Everything is staged about the CAKE, which stands at the stage's origin
   * from the moment it is set down, and about where the lens is — the fly
   * dances on the far side of it and faces the audience, and the flame leans
   * away from whatever is beating its wings at it.
   */
  function birthdayShot(t) {
    measure();
    floorMesh.visible = true;
    cake.hide(false);
    for (const x of extras) x.A.body.visible = false;
    for (let k = 1; k < pairs.length; k++) pairs[k].hide(true);
    const P = pairs[0];
    P.hide(false);
    const D = BDAY;
    const at = (w) => (t - w[0]) / w[1];
    const inW = (w) => t >= w[0] && t < w[0] + w[1];
    const beat = Math.sin(TAU * D.bpm / 60 * t);
    // Millimetres, everywhere below, because that is the unit this animal and
    // its cake are written in; `mm` puts them back into the stage at the end.
    // The lens. It arcs a third of a radian over the whole number, and every
    // bearing below is taken off where it has got to — so the fly is always
    // the right way round to the audience and the cake is never behind it.
    let k0 = D.key[0], k1 = D.key[D.key.length - 1];
    for (let i = 0; i < D.key.length - 1; i++) {
      if (t >= D.key[i][0] && t < D.key[i + 1][0]) { k0 = D.key[i]; k1 = D.key[i + 1]; }
    }
    if (t >= k1[0]) k0 = k1;
    const ce = k1[0] > k0[0] ? smooth01((t - k0[0]) / (k1[0] - k0[0])) : 0;
    const cd = lerp(k0[1], k1[1], ce);
    const cel = lerp(k0[2], k1[2], ce);
    const caz = lerp(k0[3], k1[3], ce);
    const aimY = lerp(k0[4], k1[4], ce);
    const back = caz + Math.PI;             // upstage: the far side of the cake
    const faceCam = -caz;
    // Facing the cake from a bearing `a` round it — which upstage IS facing
    // the audience, and that is what makes the joins work.
    const faceIn = (a) => Math.atan2(Math.sin(a), -Math.cos(a));

    let bx = 0, bz = 0, by = D.ring, yaw = faceCam, roll = 0, pitch = 0;
    const tw = [0, 0], fw = [0, 0];
    let kick = 0, arms = 0, held = false, shake = 0;
    let flame = 1, lean = 0, blowDir = back;
    const rad = (r, a) => { bx = r * Math.cos(a); bz = r * Math.sin(a); };

    if (t < D.carry[0] + D.carry[1]) {
      // IN FROM STAGE LEFT with the cake, losing height all the way and
      // turning to face the audience as it arrives. The cake rides a fixed
      // offset off its nose, so where the cake has to end up says where the
      // fly has to end up: the offset, backwards, from the origin.
      const u = sat(at(D.carry));
      const e = smooth01(u);
      held = true;
      arms = 1;
      bx = lerp(-13.0, -Math.cos(faceCam) * D.hold, e);
      bz = lerp(7.5, Math.sin(faceCam) * D.hold, e);
      by = lerp(D.into, D.down, smooth01(Math.min(1, u * 1.12)))
        + 0.25 * Math.sin(t * 9.1) * (1 - e);
      yaw = mixAng(0.30, faceCam, e);
      roll = 0.20 * Math.sin(t * 5.3) * (1 - e);
      // Hands full. The pair is swung up and out of the way, which is also
      // the only thing that lets it come down far enough to put the cake on
      // the floor: a bucket hanging straight off its feet is on the tile a
      // full three millimetres before the cake is.
      // The swing LEADS the descent: it is fully out of the way by the time
      // the body is half way down, because a pail still hanging at the height
      // this ends at is a pail three tenths of a millimetre into the tile.
      tw[0] = tw[1] = lerp(0.40, D.swingOut, smooth01(Math.min(1, u * 2.2)));
    } else if (inW(D.set)) {
      // CAKE DOWN. It backs off the cake, presenting it, and folds its arms.
      const u = at(D.set);
      const e = smooth01(u);
      arms = 1 - smooth01((u - 0.45) / 0.55);
      rad(lerp(D.hold, D.orbit, e), back);
      by = lerp(D.down, D.ring, e);
      yaw = faceCam;
      tw[0] = tw[1] = lerp(D.swingOut, D.danceOut, e);
    } else if (inW(D.lap)) {
      // THE LAP: once round the cake, looking at it the whole way — which
      // upstage is looking at the audience — and banked over into the turn.
      const u = at(D.lap);
      const e = smooth01(u);
      const a = back + TAU * e;
      rad(D.orbit, a);
      by = D.ring + 0.9 * Math.sin(TAU * e);
      yaw = faceIn(a);
      roll = -0.42 * Math.min(1, u * 5, (1 - u) * 5);
      tw[0] = tw[1] = D.danceOut + 0.30 * Math.sin(Math.PI * u);
    } else if (inW(D.line)) {
      // THE KICK LINE: upstage of the cake, square to the audience, legs
      // going on the beat.
      const u = at(D.line);
      const env = Math.min(1, u * 5, (1 - u) * 5);
      rad(D.orbit, back);
      by = D.ring + 0.7 * Math.abs(beat);
      yaw = faceCam;
      roll = 0.42 * Math.sin(TAU * 3 * t) * env;
      kick = env;
      tw[0] = tw[1] = D.danceOut - 0.30 * roll;
    } else if (inW(D.twirl)) {
      // THE TWIRL: both buckets right over the top, twice — the move the
      // ordinary dance is named for, and it is in this one too. It goes UP for
      // it, because twice over the top is twice through hanging straight down,
      // and a hanging bucket needs the whole 9.5 mm under it. It drops back on
      // the last tenth, by which time they are out of the way again.
      const u = at(D.twirl);
      rad(D.orbit, back);
      by = lerp(D.ring, D.leap, smooth01(Math.min(1, u * 3)))
        - (D.leap - D.ring) * smooth01((u - 0.88) / 0.12) + 0.5 * beat;
      yaw = faceCam + 0.20 * Math.sin(TAU * 2 * t);
      tw[0] = tw[1] = D.danceOut + TAU * 2 * smooth01(u);
    } else if (inW(D.rise)) {
      // THE SPIRAL: twice round and up, closing on the flame, and it ends
      // upstage again with its nose coming down toward the candle.
      const u = at(D.rise);
      const e = smooth01(u);
      const a = back + TAU * 2 * e;
      rad(lerp(D.orbit, D.close, e), a);
      by = lerp(D.ring, D.top, e);
      yaw = faceIn(a);
      pitch = -0.45 * smooth01((u - 0.45) / 0.55);
      roll = 0.22 * Math.sin(TAU * e);
      tw[0] = tw[1] = lerp(D.danceOut, D.highOut, e);
    } else if (inW(D.blow)) {
      // THE WISH: nose down over the candle, wings hammering, and the flame
      // leans away, gutters, and goes.
      const u = at(D.blow);
      const a = back + D.blowAt * smooth01(Math.min(1, u * 2.8));
      rad(D.close + 0.2, a);
      blowDir = a + Math.PI;
      by = lerp(D.top, D.puff, smooth01(Math.min(1, u * 2.2)));
      yaw = faceIn(a);
      pitch = lerp(-0.45, -0.66, smooth01(Math.min(1, u * 3)));
      shake = Math.sin(Math.PI * sat(u * 1.12));
      roll = 0.09 * Math.sin(t * 31) * shake;
      tw[0] = tw[1] = lerp(D.highOut, D.blowOut, smooth01(Math.min(1, u * 2.2)));
      // It fights: the flame is beaten down in stutters and twice looks like
      // coming back, which is what blowing a candle out actually looks like.
      // It holds, fighting, and then goes in the last third — a candle that
      // shrinks steadily from the first breath is a candle turned down with a
      // dial. The stutter is the fight.
      flame = (1 - smooth01(sat((u - 0.58) / 0.42)))
        * (0.80 + 0.20 * Math.sin(t * 17.3));
      lean = 1.20 * Math.sin(Math.PI * sat(u));
    } else {
      // THE BOW, held in the smoke to the end of the shot.
      const u = sat(at(D.bow));
      const e = smooth01(u);
      // Round and out as it comes down, so the bow is taken BESIDE the cake
      // and not in front of it: bowing from upstage put its head straight
      // into the candle it had just blown out.
      const a = back + D.blowAt + 1.85 * e;
      rad(lerp(D.close + 0.2, D.orbit + 0.7, e), a);
      by = lerp(D.puff, D.bowY, e);
      yaw = mixAng(faceIn(back + D.blowAt), faceCam, smooth01((u - 0.25) / 0.5));
      arms = smooth01((u - 0.20) / 0.35);
      pitch = lerp(-0.66, 0, smooth01(Math.min(1, u * 2.4)))
        - 0.58 * smooth01((u - 0.42) / 0.38);
      tw[0] = tw[1] = lerp(D.blowOut, D.salute, smooth01((u - 0.30) / 0.45));
      flame = 0;
    }

    rig.position.set(mm(bx), mm(by), mm(bz));
    rig.rotation.order = 'YXZ';
    rig.rotation.set(roll, yaw, pitch);
    setLegs(A0, (L) => {
      if (L.row === 1) return liveRaw(L, 'carry');
      if (L.row === 0 && arms > 0) return mixRaw(L.v, liveRaw(L, 'tuck'), liveRaw(L, 'arms'), arms);
      if (kick > 0) {
        const k = Math.max(0, Math.sin(TAU * 3 * t + (L.row * 2 + (L.s > 0 ? 1 : 0)) * 1.6));
        return mixRaw(L.v, liveRaw(L, 'tuck'), liveRaw(L, 'stand'), k * kick);
      }
      return liveRaw(L, 'tuck');
    });
    const wb = (Math.floor(t * 60) & 1) ? 1 : -1;
    for (const W of A0.wings) {
      W.g.rotation.set(0, -W.s * (1.70 - 0.22 * shake), 0.55 * wb * (1 + 0.30 * shake));
    }
    rig.updateMatrixWorld(true);
    eyeRot(A0);

    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1;
      const B = P.b[k];
      footAt(A0, k ? 3 : 2, _w);
      B.hang.position.copy(_w);
      B.hang.rotation.set(-s * tw[k], yaw, fw[k]);
      B.pin.rotation.set(0, 0, 0);
      B.setFill(1);
      B.stream.visible = false;
    }

    // And the cake: off its nose while it is carrying it, and standing at the
    // origin from the moment it lets go.
    let cx = 0, cy = 0, cz = 0;
    if (held) {
      cx = bx + Math.cos(yaw) * D.hold;
      cz = bz - Math.sin(yaw) * D.hold;
      cy = by - D.down;
      cake.group.rotation.set(0, yaw, 0);
    } else {
      cake.group.rotation.set(0, 0, 0);
    }
    cake.group.position.set(mm(cx), mm(cy), mm(cz));
    // Away from whoever is blowing at it, which is `blowDir` — and because
    // the fly comes at it from the side (see `blowAt`) that is across the
    // frame, where a lean can be seen.
    cake.setFlame(flame, lean, t, blowDir);
    cake.setSmoke((t - D.smoke[0]) / D.smoke[1]);
    blob.value[6].set(mm(cx), mm(cz),
      mm(CAKE.r + CAKE.icing + 0.30) * sat(1 - cy / 6));
    P.shadow(blob, 4);
    bodyShadow(A0, mm(by));
    _v.set(0, mm(aimY), 0);
    look(cd, cel, caz, _v);
    fade.value = 1;
  }

  // A second and a third animal for the insert, built only if the movement
  // has grown that big. Clones share every geometry and every material except
  // the two eyes, whose `uRot` is per animal.
  function extraAnimal(k) {
    if (extras[k - 1]) return extras[k - 1].A;
    const b = body.clone(true);
    const eyeM = [0, 1].map((e) => {
      const m = M.eye[e].clone();
      m.uniforms.uFade = fade;
      m.uniforms.uRes = res;
      m.uniforms.uVp = CORPSE_VP;
      return m;
    });
    for (let e = 0; e < 2; e++) b.getObjectByName('eye' + e).material = eyeM[e];
    stage.add(b);
    const A = animalRefs(b, eyeM, A0);
    extras[k - 1] = { A };
    return A;
  }
  function pairOf(k) {
    while (pairs.length <= k) pairs.push(makePair(stage, MB));
    return pairs[k];
  }

  // The corpse's own resting height, which `reset` puts back.
  const deadY = rig.position.y;
  reset();

  return {
    stage, cam, rig, body,
    look,
    revive, reset, insert, dropShot, danceShot, birthdayShot,
    /** How long the dance runs, seconds. */
    danceLen: () => DANCE.len,
    /** How long the birthday number runs, seconds. */
    birthdayLen: () => BDAY.len,
    /**
     * What `measure` measured, in millimetres — the three numbers every shot
     * in here is staged against, and the ones a routine gets wrong by
     * guessing. Debug.
     */
    metrics: () => {
      measure();
      return { standLift: standLift / mm(1), carryDrop: carryDrop / mm(1),
        carrySpan: carrySpan / mm(1), pail: MINIB.ear + MINIB.bail };
    },
    /**
     * Where the bottom of each pail is right now, in mm, for the pose the
     * last shot left. A negative y is a bucket through the floor,
     * which is the one thing a routine with two of them swinging can do
     * wrong and the one thing a single frame will not always show you.
     */
    pailAt: () => pairs[0].b.map((B) => {
      B.hang.updateMatrixWorld(true);
      B.pin.localToWorld(_q.set(0, -mm(MINIB.ear), 0));
      return [_q.x / mm(1), _q.y / mm(1), _q.z / mm(1)];
    }),
    /** How long the fly cam stays up, seconds. */
    dropLen: () => DROPCAM.len,
    /** How long the resurrection runs, seconds. */
    riseLen: () => RISE.len,
    /** 1 is the shot, 0 is black. The last third of a second of the cut. */
    setFade: (v) => { fade.value = v; },
    /**
     * Draw it over the frame that is already there.
     *
     * Colour AND depth, because this is a cut and not an overlay: what was
     * rendered before it is gone. `autoClear` goes back on afterwards for the
     * reason src/60-arms.js gives — a renderer left with it off would fail to
     * clear the NEXT frame as well, and the symptom of that is a smear that
     * outlives the shot by a whole session.
     *
     * `overlay` is the one exception, and it is the pour insert: depth only,
     * so the porch stays in the frame and the flies are drawn in front of it.
     */
    render(renderer, overlay = false) {
      renderer.getSize(_size);
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      if (overlay === 'pip') {
        // The fly cam, in the corner `DROPCAM.box` describes — the same box
        // the `#flycam` frame in styles.css draws round it, in CSS pixels,
        // which is also what `setViewport` takes.
        const r = DROPCAM.rect(_size.x, _size.y);
        const pr = renderer.getPixelRatio();
        res.value.set(r.w * pr, r.h * pr);
        CORPSE_VP.value.set(r.x * pr, r.y * pr);
        cam.aspect = r.w / Math.max(1, r.h);
        cam.updateProjectionMatrix();
        renderer.setScissorTest(true);
        renderer.setViewport(r.x, r.y, r.w, r.h);
        renderer.setScissor(r.x, r.y, r.w, r.h);
        renderer.clear(true, true, false);
        renderer.render(stage, cam);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, _size.x, _size.y);
        CORPSE_VP.value.set(0, 0);
        renderer.autoClear = auto;
        return;
      }
      CORPSE_VP.value.set(0, 0);
      res.value.copy(_size);
      cam.aspect = _size.x / Math.max(1, _size.y);
      cam.updateProjectionMatrix();
      renderer.clear(!overlay, true, false);
      renderer.render(stage, cam);
      renderer.autoClear = auto;
    },
    tris: () => {
      let n = 0;
      stage.traverse((o) => {
        if (o.geometry && o.geometry.index) n += o.geometry.index.count / 3;
        else if (o.geometry) n += o.geometry.attributes.position.count / 3;
      });
      return Math.round(n);
    },
  };
}
