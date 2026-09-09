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
      // Where the body is, for the tile's own contact shadow — see the floor
      // case below.
      uBlob: opts.blob || { value: [new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3()] },
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
uniform vec3 uRadii;
uniform vec2 uSpan;
uniform float uFacets;
uniform mat3 uRot;
uniform vec3 uBlob[6];

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
  } else if (uPat > 4.5) {
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
    for (int i = 0; i < 6; i++) {
      float r = uBlob[i].z;
      if (r <= 0.0) continue;
      float d = length(vP.xz - uBlob[i].xy) / r;
      sh = max(sh, 1.0 - smoothstep(0.35, 1.0, d));
    }
    base *= 1.0 - 0.62 * sh;
  }

  vec3 col = base * lightAt(n, v, spec, power) + glossAt(n, v, spec, power);
  // Depth, by the only means a 3 cm scene has: everything past the animal goes
  // down. A real macro lens would do this with a millimetre of depth of field
  // and this shot has none, so the tile is darkened with distance instead —
  // which is what the eye reads off a shallow frame anyway.
  float far = length(vP - cameraPosition);
  col *= 1.0 - 0.45 * smoothstep(0.050, 0.200, far);
  // And the frame: a soft vignette, and the fade the cut ends on.
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));
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
    new THREE.Vector3()] };

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
    body.add(hip);

    const coxa = new THREE.Mesh(
      corpseSeg(mm(CORPSE.leg.coxa * k), mm(0.155), mm(0.135), 10), M.leg);
    hip.add(coxa);

    const knee = new THREE.Group();
    knee.position.set(mm(CORPSE.leg.coxa * k), 0, 0);
    knee.rotation.set(0, 0, P[3]);
    hip.add(knee);
    // The femur is the thick one — it is the muscle that jumps — and it tapers
    // hard into the joint.
    knee.add(new THREE.Mesh(
      corpseSeg(mm(CORPSE.leg.femur * k), mm(0.135), mm(0.088), 10, 0.22), M.leg));

    const shin = new THREE.Group();
    shin.position.set(mm(CORPSE.leg.femur * k), 0, 0);
    shin.rotation.set(0, 0, P[4]);
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
  }

  // ── the tile, and how the animal is lying on it ─────────────────────────────
  // Laid flat in the GEOMETRY and not by rotating the mesh, because the tile's
  // grain and its dust are written in the mesh's own local coordinates: a plane
  // left standing in XY has nothing in its local z to vary along, and the whole
  // floor comes out as one flat colour. Which is exactly what it did.
  const tile = new THREE.PlaneGeometry(0.30, 0.30);
  tile.rotateX(-Math.PI / 2);
  stage.add(new THREE.Mesh(tile, M.floor));

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
  const shade = [[1.7, 0, 0, 0.85], [0.2, 0, 0, 1.05], [-1.5, 0, 0, 0.90],
    [-3.2, 0, 0, 0.60],
    // And two under the wings. A wing over a white tile is very nearly
    // invisible — it is a membrane a fifth of a micron thick and the tile is
    // the brightest thing in the shot — so what actually says WING in a
    // photograph of a dead fly is not the wing, it is the shadow of it.
    [-1.5, 0.5, 2.4, 1.50], [-1.5, 0.5, -2.4, 1.50]];
  for (let i = 0; i < shade.length; i++) {
    const p = body.localToWorld(new THREE.Vector3(
      mm(shade[i][0]), mm(shade[i][1]), mm(shade[i][2])));
    blob.value[i].set(p.x, p.z, mm(shade[i][3]));
  }

  // And each eye's own rotation into the stage, now that it has one. See the
  // note on `uRot`: this is the substitute for the `modelMatrix` a fragment
  // shader does not get, and it is read once because nothing here moves again.
  for (let i = 0; i < eyes.length; i++) {
    M.eye[i].uniforms.uRot.value.setFromMatrix4(eyes[i].matrixWorld);
  }

  // What the lens is pointed at, and it is not the middle of the body: the
  // legs stand two millimetres over the belly and the belly is the subject, so
  // aiming at the centre of mass puts the curl out of the top of the frame.
  const _aim = new THREE.Vector3(0, mm(1.30), 0);
  const _size = new THREE.Vector2(1280, 720);

  /**
   * Point the camera at it.
   *
   * `d` metres out, `el` radians above the tile, `az` radians round from the
   * fly's own nose. Everything the shot does is these three numbers on a curve.
   */
  function look(d, el, az) {
    cam.position.set(
      Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d,
      Math.cos(el) * Math.sin(az) * d);
    cam.up.set(0, 1, 0);
    cam.lookAt(_aim);
  }

  return {
    stage, cam, rig, body,
    look,
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
     */
    render(renderer) {
      renderer.getSize(_size);
      res.value.copy(_size);
      cam.aspect = _size.x / Math.max(1, _size.y);
      cam.updateProjectionMatrix();
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clear(true, true, false);
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
