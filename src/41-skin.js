// -----------------------------------------------------------------------------
// Skinned figures: a skeleton, a bank of clips, and a shader that puts the two
// together.
//
// Everything else with joints in this game is *rigid* — the ground crew and the
// bathers are eleven separate boxes on a tree of pivots (readFR3DRig in
// src/48-landmarks.js), which is the right answer for a person in heavy kit
// seen from a Canadair and the wrong one for somebody you can walk up to. This
// is the other path: one mesh, four bone influences a vertex, blended in the
// vertex shader.
//
// The cost is one blob and about a hundred lines. What it buys is that a pose
// stops being an asset. The frozen figure that used to stand on the Jadrija
// promenade was 427 KB for *one* attitude of one body — more than the entire
// Canadair — and a second pose would have cost another 427 KB. Skinned, the
// same body costs 470 KB once and every pose after that is a few kilobytes of
// quaternions.
//
// ── the palette ───────────────────────────────────────────────────────────────
//
// Bone matrices go up as a float texture, one texel a row, 3 rows a bone — so
// 28 bones is an 84 by 1 image resampled every frame. Which is what three.js
// does and is not what this did: it used to be a plain `uniform vec4[84]`, on
// the reasoning that one figure does not need a texture unit and 84 vec4s fit
// inside the 128 that even the oldest conforming implementation offers.
//
// The reasoning was sound and the code was wrong, and it took a phone to say
// so. A Snapdragon reported 256 vertex uniform vectors, linked the program
// without a word of complaint, and then skinned her with a palette that was
// right for the bones near the root and wrong for everything out at the limbs:
// head, chest and hips in place, arms gone, legs a smear. Desktop GL had run it
// correctly for months. The failing ingredient is *dynamic indexing of a
// uniform array in a vertex program* — legal GLSL, rare in the wild, and
// therefore the least exercised line in a mobile driver's compiler.
//
// A texture fetch is the opposite of rare: it is the path every skinned model
// on the web takes, because it is the path three.js takes, so it is the one
// path that is certainly tested on every GPU that ships. The cost is a texture
// unit and 1.3 KB of upload a figure a frame. That is the whole price, and it
// buys a figure that is the same shape on every machine.
// -----------------------------------------------------------------------------

/**
 * Decode a .fr3d **v3** blob: mesh, skeleton, clips.
 *
 * Layout is fixed-size-first so that everything large can be a view straight
 * on to the decompressed buffer; only the variable-length tables at the end,
 * which are a few kilobytes, are walked with a DataView.
 */
function readFR3DSkin(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
    dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'FR3D') throw new Error('not an fr3d blob: ' + magic);
  const version = dv.getUint32(4, true);
  if (version !== 4) throw new Error('fr3d skin needs version 4, got ' + version);
  const nv = dv.getUint32(8, true);
  const ni = dv.getUint32(12, true);
  // How many indices at the *end* of the buffer are the hip wrap — the one
  // thing on this figure that comes off. The exporter puts it last precisely so
  // that this is a number and not a list; see `post_geometry`.
  const shed = dv.getUint32(40, true);

  let o = 44;
  const pos = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const nrm = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const col = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const bidx = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  const bwgt = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  o = (o + 3) & ~3;                          // the exporter pads to match
  const idx = new Uint32Array(buf, o, ni); o += ni * 4;

  const dec = new TextDecoder();
  const nb = dv.getUint32(o, true); o += 4;
  const bones = [];
  for (let i = 0; i < nb; i++) {
    const len = dv.getUint16(o, true); o += 2;
    const name = dec.decode(new Uint8Array(buf, o, len)); o += len;
    // Offsets are measured from `parent`, not past it — 4 for the parent, 12
    // for the translation, 16 for the quaternion, 32 in all.
    const parent = dv.getInt32(o, true);
    bones.push({
      name, parent,
      t: [dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true),
        dv.getFloat32(o + 12, true)],
      q: [dv.getFloat32(o + 16, true), dv.getFloat32(o + 20, true),
        dv.getFloat32(o + 24, true), dv.getFloat32(o + 28, true)],
    });
    o += 32;
  }

  const nc = dv.getUint32(o, true); o += 4;
  const clips = {};
  for (let c = 0; c < nc; c++) {
    const len = dv.getUint16(o, true); o += 2;
    const name = dec.decode(new Uint8Array(buf, o, len)); o += len;
    const dur = dv.getFloat32(o, true);
    const nf = dv.getUint32(o + 4, true);
    const loop = dv.getUint8(o + 8) !== 0;
    o += 12;
    // Frame blocks land on whatever offset the clip's name happened to leave,
    // so this one is a copy: an Int16Array view has to be 2-byte aligned and a
    // name of odd length guarantees it will not be.
    const stride = 12 + nb * 8;
    const blk = new DataView(buf.slice(o, o + nf * stride)); o += nf * stride;
    const root = new Float32Array(nf * 3);
    const quat = new Int16Array(nf * nb * 4);
    for (let f = 0; f < nf; f++) {
      let p = f * stride;
      root[f * 3] = blk.getFloat32(p, true);
      root[f * 3 + 1] = blk.getFloat32(p + 4, true);
      root[f * 3 + 2] = blk.getFloat32(p + 8, true);
      p += 12;
      const q0 = f * nb * 4;
      for (let k = 0; k < nb * 4; k++) quat[q0 + k] = blk.getInt16(p + k * 2, true);
    }
    clips[name] = { name, dur, nf, loop, root, quat };
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3, true));
  // Bone numbers, and they go up *normalised* even though they are integers —
  // the shader multiplies the 27/255 back out to 27. Which looks like a
  // pointless round trip and is not. An unnormalised UNSIGNED_BYTE attribute is
  // a rare enough thing on the web that it is the least exercised path in any
  // mobile driver's vertex fetch, and a normalised one is the path every vertex
  // colour in every scene on the internet takes. If a byte is going to survive
  // the trip anywhere, it is here. See `addBone` in src/30-material.js.
  g.setAttribute('aBoneIdx', new THREE.BufferAttribute(bidx, 4, true));
  g.setAttribute('aBoneWt', new THREE.BufferAttribute(bwgt, 4, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  // The bind pose's bounding sphere is not the animated one — a raised arm or
  // a somersault leaves it — and a figure that pops out of existence when she
  // reaches up is worse than one that is occasionally drawn off screen.
  g.boundingSphere.radius *= 1.9;
  return { geo: g, bones, clips, nv, tris: ni / 3, ni, shed };
}

/**
 * Depth-only vertex program for a skinned caster. Position, and nothing else.
 *
 * The skinning is written the same way as the surface material's and for the
 * same reason — see addBone in src/30-material.js. A shadow map drawn with a
 * different arithmetic to the thing casting it is a figure whose shadow does
 * not fit her, and this pass is the *more* likely of the two to be run on a
 * driver that is short of registers, because it is the one that runs twice.
 */
function skinCasterVert(nb) {
  return /* glsl */ `
attribute vec4 aBoneIdx;
attribute vec4 aBoneWt;
uniform sampler2D uBones;
uniform float uBoneRows;
varying float vDepth;

vec4 boneRow(float i){
  return texture2D(uBones, vec2((i + 0.5) / uBoneRows, 0.5));
}

void addBone(float bi, float w, vec4 hp, inout vec3 sp){
  float i = min(floor(bi * 255.0 + 0.5), ${nb - 1}.0) * 3.0;
  sp += w * vec3(dot(boneRow(i), hp), dot(boneRow(i + 1.0), hp),
                 dot(boneRow(i + 2.0), hp));
}

void main(){
  vec4 hp = vec4(position, 1.0);
  vec3 sp = vec3(0.0);
  addBone(aBoneIdx.x, aBoneWt.x, hp, sp);
  addBone(aBoneIdx.y, aBoneWt.y, hp, sp);
  addBone(aBoneIdx.z, aBoneWt.z, hp, sp);
  addBone(aBoneIdx.w, aBoneWt.w, hp, sp);
  vec3 p = (modelMatrix * vec4(sp, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vDepth = gl_Position.z / gl_Position.w * 0.5 + 0.5;
}
`;
}

// ── quaternion helpers ───────────────────────────────────────────────────────
//
// Written out on flat arrays rather than done with THREE.Quaternion, because
// this runs 28 times a bone-hierarchy pass, twice a frame while a crossfade is
// in flight, and the object churn is the whole cost of the feature.

/** out[o] = a[i] * b[j], all (x, y, z, w). Aliasing-safe. */
function qmul(out, o, a, i, b, j) {
  const ax = a[i], ay = a[i + 1], az = a[i + 2], aw = a[i + 3];
  const bx = b[j], by = b[j + 1], bz = b[j + 2], bw = b[j + 3];
  out[o] = aw * bx + ax * bw + ay * bz - az * by;
  out[o + 1] = aw * by - ax * bz + ay * bw + az * bx;
  out[o + 2] = aw * bz + ax * by - ay * bx + az * bw;
  out[o + 3] = aw * bw - ax * bx - ay * by - az * bz;
}

/** Rotate the vector at v[j] by the quaternion at q[i], into out[o]. */
function qrotv(out, o, q, i, v, j) {
  const x = q[i], y = q[i + 1], z = q[i + 2], w = q[i + 3];
  const vx = v[j], vy = v[j + 1], vz = v[j + 2];
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  out[o] = vx + w * tx + y * tz - z * ty;
  out[o + 1] = vy + w * ty + z * tx - x * tz;
  out[o + 2] = vz + w * tz + x * ty - y * tx;
}

/**
 * Normalised linear blend, shortest way round.
 *
 * Not slerp. At 30 samples a second adjacent frames are a couple of degrees
 * apart and nlerp is indistinguishable from slerp for a fraction of the cost;
 * the one place it would show — a crossfade between two clips whose poses are
 * far apart — is handled by keeping the fades short rather than by paying for a
 * trigonometric blend on every bone of every frame.
 */
function qnlerp(out, o, a, i, b, j, u) {
  let bx = b[j], by = b[j + 1], bz = b[j + 2], bw = b[j + 3];
  const ax = a[i], ay = a[i + 1], az = a[i + 2], aw = a[i + 3];
  if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
  let z = az + (bz - az) * u, w = aw + (bw - aw) * u;
  const l = Math.hypot(x, y, z, w) || 1;
  out[o] = x / l; out[o + 1] = y / l; out[o + 2] = z / l; out[o + 3] = w / l;
}

// ── the face ─────────────────────────────────────────────────────────────────
//
// A blink and a smile, and neither of them is a bone.
//
// The obvious way to do both is in Blender: four eyelid bones and two at the
// corners of the mouth, a re-bind, a re-export. It was the plan for a while and
// it is the wrong plan. An eyelid is not a joint — there is no lid geometry on
// this figure at all, only the continuous skin that runs from the brow to the
// cheek — so a lid bone means hand-painting weights onto a strip of face two
// vertices wide and hoping the bone-heat solve does not take the eyebrow with
// it. And a mouth corner bone moves the corner, which is the *smaller* half of
// a smile; the rest of it is that the eye closes a little and the cheek comes
// up, which is skin again.
//
// The thing that actually makes this figure's head read at the distance she is
// looked at is not shape, it is paint (see the cutters in human_mh.py). So:
//
//   the blink is drawn      — the lid is a colour that runs down the eyeball,
//                             with the lash line carried on its leading edge
//   the smile is displaced  — the corner of the mouth is pushed up and back in
//                             the bind pose, before the skin matrix, which
//                             takes the painted lip line and the cheek with it
//
// Nothing here costs a bone, a byte of payload or a keyframe, and both work in
// every clip she has, including the ones that put her upside down.
//
// Every number below is measured off the mesh at load rather than typed. The
// anchors move if the face is ever re-modelled, and a face whose eye is 3 mm
// from where the shader thinks it is looks like a stroke.

/** How the blink runs. Seconds, and a human's are quicker than people guess. */
const BLINK = {
  shut: 0.075,        // s to close
  open: 0.145,        // and about twice that to open again
  gap: 2.2,           // the shortest wait between them
  spread: 5.0,        // plus this much of a dice roll
  again: 0.22,        // and this often it comes straight back for a second one
};

/**
 * Find the eyes, the mouth and the upper arms in a decoded blob.
 *
 * The eyeballs are the only thing on her that is rigidly weighted to a bone of
 * its own — `skin()` hands each loose shell to one bone and the eyes are the
 * two round ones — so they can be found without knowing a single colour. The
 * mouth cannot: it is paint on the same skin as everything around it, and the
 * only thing that separates it is the palette entry `MOUTH_P` in human_mh.py.
 * That is a constant shared across a language boundary and it is checked below
 * rather than trusted; too few vertices and the smile turns itself off.
 */
function faceAnchors(data) {
  const g = data.geo;
  const pos = g.attributes.position.array;
  const col = g.attributes.aVCol.array;
  const bi = g.attributes.aBoneIdx.array;
  const bw = g.attributes.aBoneWt.array;
  const nv = data.nv;
  const P = (i, k) => pos[i * 3 + k];

  // The two sides are folded onto one another throughout — the mesh is
  // symmetric and the paint pass depends on that being true, so the face is one
  // anchor and a sign rather than two of everything.
  const fold = (i) => [P(i, 0), P(i, 1), Math.abs(P(i, 2))];
  const mean = (list) => {
    const c = [0, 0, 0];
    for (const p of list) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    return c.map((x) => x / list.length);
  };

  // The lid takes the colour of the skin around it, which is the colour most of
  // her is: 70% of the vertices carry it.
  const tally = new Map();
  for (let i = 0; i < nv; i++) {
    const k = (col[i * 3] << 16) | (col[i * 3 + 1] << 8) | col[i * 3 + 2];
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  let skin = 0, best = 0;
  for (const [k, n] of tally) if (n > best) { best = n; skin = k; }
  const rgb = (k) => [(k >> 16) / 255, ((k >> 8) & 255) / 255, (k & 255) / 255];

  const eyeBones = [];
  data.bones.forEach((b, i) => { if (/^eye/.test(b.name)) eyeBones.push(i); });
  const ball = [];
  let darkest = 0xffffff, dl = 1e9;
  for (let i = 0; i < nv; i++) {
    if (bw[i * 4] !== 255 || !eyeBones.includes(bi[i * 4])) continue;
    ball.push(fold(i));
    const r = col[i * 3], gr = col[i * 3 + 1], b = col[i * 3 + 2];
    const l = 0.299 * r + 0.587 * gr + 0.114 * b;
    if (l < dl) { dl = l; darkest = (r << 16) | (gr << 8) | b; }
  }
  if (ball.length < 24) return null;
  const eye = mean(ball);
  let rad = 0;
  for (const p of ball) {
    rad += Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
  }
  rad /= ball.length;

  // The mouth. `lip` throws away everything more than 20 mm behind the front of
  // the painted band, because the cutter that laid it down punches five
  // centimetres into her head and the inside of a mouth is not a landmark.
  const MOUTH = 77 << 16 | 41 << 8 | 37;      // MOUTH_P, quantised
  const mouth = [];
  for (let i = 0; i < nv; i++) {
    const k = (col[i * 3] << 16) | (col[i * 3 + 1] << 8) | col[i * 3 + 2];
    if (k === MOUTH) mouth.push(fold(i));
  }
  let corner = null, lipC = null, lipW = 0.025;
  if (mouth.length >= 24) {
    const xm = Math.max(...mouth.map((p) => p[0]));
    const lip = mouth.filter((p) => p[0] > xm - 0.020);
    const zm = Math.max(...lip.map((p) => p[2]));
    const out = lip.filter((p) => p[2] > zm * 0.72);
    if (out.length >= 4) corner = mean(out);
    // And the middle of it, on the midline rather than at the mean of a band
    // that has been folded onto one side — the corner lift wants a corner, the
    // jaw wants the centre of the hinge it opens around.
    const c = mean(lip);
    lipC = [c[0], c[1], 0];
    lipW = Math.max(zm, 0.012);
  }

  // The upper arms, for the ink. Only which bones they are: where they are comes
  // off the rest skeleton in `skinnedFigure`, because an arm's axis is its bone
  // and nothing else on this mesh is.
  const armB = [];
  data.bones.forEach((b, i) => { if (/^armU/.test(b.name)) armB.push(i); });

  return {
    eye, rad, corner, lipC, lipW, armB,
    lid: rgb(skin),
    lash: rgb(darkest),
    balls: ball.length, mouth: mouth.length,
  };
}

/**
 * Where the lid is drawn, and how far the corner of the mouth travels.
 *
 * The ellipsoid is the aperture and a little more: tall enough to take in both
 * painted lash lines (the upper one tops out 9.3 mm above the eye's centre) and
 * short of the brow, which starts 20.5 mm above it and must not be wiped by a
 * blink. Its depth is generous because everything behind the front of the
 * eyeball is inside her head and cannot be seen anyway.
 */
const FACE = {
  eyeR: [0.022, 0.0125, 0.0155],   // m, in the folded bind frame
  shut: 0.60,                      // where the lids meet, as a fraction of eyeR.y
  line: 0.0016,                    // half-width of the lash line on the lid
  lipR: [0.020, 0.016, 0.020],     // how far a corner's lift reaches
  lift: [-0.0016, 0.0080, 0.0016], // and where it takes it: back, up, out
  squint: 0.18,                    // how far a full smile closes the eyes
  // An open mouth, by the same two halves as the smile: the jaw is displaced
  // and the inside of it is painted. Everything below the lip line falls, over
  // a region the size of a jaw, and the paint is a dark oval sitting across the
  // lip line in the *bind* pose — so the skin the drop stretches over the
  // opening carries the dark with it and the gap reads as a gap rather than as
  // a chin that has come loose.
  jawR: [0.050, 0.055, 0.045],     // m — the region the jaw drop reaches
  drop: [-0.0060, 0.0185, 0],      // and where it takes it: back and down
  // What is inside a mouth, and it is not one colour. It was — a single very
  // dark oval, 0.030/0.014/0.012, which is 3% grey — and in a shuttered kabina
  // that is not a mouth, it is a hole punched through her head. The dark is
  // right for the *throat*, and the throat is the one part of an open mouth you
  // mostly cannot see: the near half of it is teeth and tongue, both of which
  // are lighter than her skin is in that room. So three colours, laid inside
  // one ellipsoid and keyed off where in it a fragment is.
  //
  // Warm, too. A mouth lit through a doorway is red before it is black, and a
  // neutral dark oval reads as damage where a warm one reads as a shadow.
  maw: [0.072, 0.024, 0.022],      // the throat, at the back of it
  tooth: [0.780, 0.760, 0.720],    // TOOTH_P out of human_mh.py, a shade down
  tongue: [0.360, 0.132, 0.128],   // and TONGUE_P, likewise
  // The lips, which are paint and not shape. The mesh carries a 2 mm rose line
  // along the crease and nothing else, which is exactly right for a face seen
  // from twenty metres across a promenade and nothing like enough for one that
  // fills the frame with its mouth open.
  //
  // Lips and opening now share one ellipsoid, and that is not tidiness — it is
  // the only way the red survives. The maw is painted on the *bind* pose, and
  // the skin it is painted over is her lower lip and her chin: opening her mouth
  // does not reveal an interior, it stretches the chin down and the paint goes
  // with it. So a lip band drawn at a fixed size is simply overrun, and she gets
  // red above the hole and nothing below it. Drawn as a ring outside the hole in
  // the same frame, both lips travel outwards as the hole grows, which is also
  // what lips do.
  //
  // `lipsLift` is the one thing the ellipsoid cannot do for itself. The mouth
  // line is a parabola, 3.2 mm higher at the corners than in the middle, which
  // is what human_mh.py builds it as and what keeps her from reading as a
  // mannequin; a band centred on a flat line sits low at the corners and high
  // in the middle, which is a mouth drawn by somebody who has not looked at one.
  lipsR: [0.026, 0.0098, 1.00],    // z is a fraction of the measured lip width
  lipsLift: 0.0032,                // m the line rises, corner over centre
  lipstick: [0.400, 0.052, 0.070],
  // How far open a full gape is, as a multiple of that band: 1.05 puts a full
  // gape at 21 mm by 45 mm, which is a mouth held open under a branch. It was
  // 0.88 and the opening came out 12 by 27 — a mouth with a red ring round it
  // twice the width of the hole, which reads as lipstick applied by somebody
  // with their eyes shut rather than as an open mouth.
  gapeR: 1.05,
  // The lip band's inner edge is tied to the hole rather than set: `lipIn` is
  // where it starts as a fraction of the opening, floored at the resting mouth,
  // and `lipOut` is its width, which grows a little because a lip that is being
  // stretched shows more of itself.
  lipIn: 0.97,
  lipOut: [0.47, 0.30],
  // And the foam, once enough of the branch has gone in. Not white: foam is
  // white the way snow is, which is to say it is whatever is lighting it, and
  // the inside of a mouth is lit by nothing. `fill` stops short of the top on
  // purpose — a mouth filled to the lip is a mouth with a white disc in it, and
  // the tell that it is full of water rather than painted is the teeth still
  // showing above the line.
  //
  // The level is *negative* at full, and that is not a mistake: n.y = 0 is the
  // lip line, and everything you can see of the inside of her mouth is below it
  // — the jaw drop stretches the 9 mm of skin under the crease over 27 mm of
  // opening and leaves the millimetre above it where it was. So the top third
  // of the ellipsoid is a sliver against the upper lip, and a level set anywhere
  // positive is a mouth filled to the brim.
  foam: [0.820, 0.790, 0.745],
  fill: -0.45,
  // The tongues run nearly the length of the upper arm — 21 cm from her elbow
  // to her shoulder — because anything shorter is a black sleeve with a ragged
  // top rather than fire. It is the *gaps* between the tongues that read as
  // flames, and a gap has to be long enough to be a gap.
  lick: 0.20,                      // m — how long the tongues of the ink are
  hot: [0.55, 0.12, 0.02],         // the leading edge of a flame
  ash: [0.10, 0.042, 0.034],       // and what it is behind the edge
  dolphin: [0.015, 0.105, 0.165],  // blue ink, dark enough to read on sunlit skin
};

const FACE_DECL = /* glsl */ `
uniform float uBlink;
uniform float uSmile;
uniform vec3 uEye;
uniform vec3 uEyeR;
uniform vec3 uLidCol;
uniform vec3 uLashCol;
uniform vec3 uLip;
uniform vec3 uLipR;
uniform vec3 uLift;
uniform float uGape;
uniform float uFoam;
uniform vec3 uLipC;
uniform vec3 uJawR;
uniform vec3 uLipsR;
uniform float uInk;
uniform vec2 uArmB;
uniform vec4 uArmC;
uniform vec2 uArmY;
uniform float uDolphin;
uniform vec3 uAnkle;
varying float vArm;

float inkStroke(vec2 p, vec2 a, vec2 b, float r){
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  return 1.0 - smoothstep(r, r + 0.055, length(p - a - ab * h));
}

// How much of a vertex belongs to an upper arm. Declared out here because the
// vertex body is spliced into main() and cannot carry a function of its own,
// and it costs the fragment program nothing to have it and not call it.
//
// The attribute arrives normalised — a bone number over 255 — while uArmB
// holds bone numbers, so the scale has to happen here. Miss
// it and nothing matches, nothing is an arm, and the flames simply never light.
float armWt(float i, float w){
  float b = floor(i * 255.0 + 0.5);
  return (abs(b - uArmB.x) < 0.5 || abs(b - uArmB.y) < 0.5) ? w : 0.0;
}
`;

// Runs on the bind pose, before the skin matrix. A smile is the only thing on
// this figure that changes her shape rather than her attitude.
const FACE_VERT = /* glsl */ `
  {
    vec3 f = vec3(p.x, p.y, abs(p.z));
    float w = 1.0 - smoothstep(0.25, 1.0, length((f - uLip) / uLipR));
    p += uSmile * w * vec3(uLift.x, uLift.y, uLift.z * sign(p.z));

    // The jaw. Gated below the lip line rather than faded through it: an
    // ellipsoid centred on the mouth takes the upper lip down with the lower
    // one by half as much again, and a mouth that opens by moving both lips the
    // same way does not open at all.
    if (uGape > 0.0) {
      float jw = 1.0 - smoothstep(0.20, 1.0, length((f - uLipC) / uJawR));
      jw *= smoothstep(0.0015, -0.0090, p.y - uLipC.y);
      p += uGape * jw * vec3(${FACE.drop[0]}, -${FACE.drop[1]}, 0.0);
    }
    vArm = armWt(aBoneIdx.x, aBoneWt.x) + armWt(aBoneIdx.y, aBoneWt.y)
         + armWt(aBoneIdx.z, aBoneWt.z) + armWt(aBoneIdx.w, aBoneWt.w);
  }
`;

// And this runs on every fragment of her, which is why it is one ellipsoid test
// and gets out again. `vLocal` is the *undisplaced* bind position, so the eye
// the shader is looking for stays where it was put whatever the smile is doing
// forty millimetres below it.
const FACE_FRAG = /* glsl */ `
  {
    vec3 f = vec3(vLocal.x, vLocal.y, abs(vLocal.z));
    float k = 1.0 - smoothstep(0.80, 1.0, length((f - uEye) / uEyeR));
    if (k > 0.0) {
      float lid = mix(uEye.y + uEyeR.y, uEye.y - uEyeR.y * ${FACE.shut}, uBlink);
      base = mix(base, uLidCol, k * smoothstep(lid - 0.0008, lid + 0.0008, f.y));
      float line = 1.0 - smoothstep(0.0, ${FACE.line}, abs(f.y - lid));
      base = mix(base, uLashCol, k * line * uBlink);
    }

    // Her mouth: a ring of colour and a hole in the middle of it, both measured
    // in the same ellipsoid. vLocal is the undisplaced bind position, so all of
    // this is painted onto the skin *before* the jaw takes it down — which is
    // the whole trick: the band of skin that gets stretched across the opening
    // is exactly the band that was carrying the dark, so it arrives dark.
    {
      // The lip line runs uphill toward the corners, so the frame it is measured
      // in runs uphill with it. Squared, because a parabola is what the nine
      // shells of the mouth cutter in human_mh.py are laid along.
      float span = f.z / max(uLipsR.z, 1e-4);
      vec3 lc = vec3(uLipC.x, uLipC.y + ${FACE.lipsLift} * span * span, uLipC.z);
      vec3 q = (f - lc) / uLipsR;
      float r = length(q);

      // The lipstick. A filled ellipse at rest, and the hole is punched through
      // the middle of it afterwards — which is why the inner edge is measured
      // off the hole rather than set: a lip band whose edges are fixed is a lip
      // band the opening eats from the inside, and it only has to be 2 mm out
      // for her to have red above her mouth and none below it.
      float k = ${FACE.gapeR} * uGape;
      float li = max(0.55, k * ${FACE.lipIn});
      base = mix(base, vec3(${FACE.lipstick.join(', ')}), 1.0 - smoothstep(
        li, li + ${FACE.lipOut[0]} + ${FACE.lipOut[1]} * uGape, r));

      if (k > 0.0) {
        float mw = 1.0 - smoothstep(k * 0.62, k, r);
        if (mw > 0.0) {
          // Inside the hole, on its own scale: the unit ball is the opening,
          // +y is toward her nose and −y is toward her chin.
          vec3 n = q / k;
          vec3 mouth = vec3(${FACE.maw.join(', ')});
          // The tongue, lying in the floor of it and never quite reaching the
          // corners — a tongue is narrow and a mouth is wide.
          mouth = mix(mouth, vec3(${FACE.tongue.join(', ')}), 1.0 - smoothstep(
            0.40, 1.05, length(vec3(n.x * 0.55, (n.y + 0.42) * 1.30, n.z * 1.20))));
          // And the upper teeth, in a band under the lip — which is a band
          // around n.y = 0 rather than at the top of the ellipsoid, for the same
          // reason the foam level is negative. Cut off short of the corners:
          // the back teeth are round the curve of the arch and are not lit by
          // anything.
          mouth = mix(mouth, vec3(${FACE.tooth.join(', ')}),
            smoothstep(-0.20, 0.14, n.y) * (1.0 - smoothstep(0.42, 0.86, n.y))
            * (1.0 - smoothstep(0.58, 0.98, abs(n.z))));

          // The foam, which arrives late and fills from the bottom. The level is
          // a plain line in n.y with the noise added to it rather than the other
          // way round: froth is a *surface* that is lumpy, and multiplying the
          // whole mask by noise gives you a mouthful of white spots instead.
          //
          // Sampled in n rather than in the bind position, and that is the
          // difference between froth and combing. The jaw stretches 9 mm of skin
          // over 27 mm of opening, so noise measured on the mesh arrives three
          // times taller than it is wide — which on screen is a mouth full of
          // vertical stripes. n is the opening's own frame and the 1.7 is its
          // aspect, so a lump in it is a lump.
          if (uFoam > 0.0) {
            vec2 fn = vec2(n.z * 1.7, n.y);
            float froth = 0.56 * vnoise2(fn * 7.0) + 0.44 * vnoise2(fn * 16.5);
            float lvl = mix(-1.35, ${FACE.fill}, uFoam);
            mouth = mix(mouth, vec3(${FACE.foam.join(', ')}) * (0.84 + 0.26 * froth),
              smoothstep(lvl + 0.17 * froth, lvl - 0.10, n.y));
          }
          base = mix(base, mouth, mw);
        }
      }
    }

    // ── the ink ──────────────────────────────────────────────────────────
    //
    // Flames up both upper arms, and they arrive with the turn rather than
    // being on her: uInk is what carries the flame front from her elbow to her
    // shoulder, so the tattoo climbs her over the second the riser takes.
    //
    // Wrapped round the arm by the angle about its own axis, and sampled across
    // it *only* — the height a tongue reaches is a function of the angle and of
    // nothing else. Both of those took a while to arrive at.
    //
    // The axis has to be the bone. The obvious thing is the centroid of the
    // arm's vertices, and that puts the pole on the skin somewhere in the
    // middle, because an arm is not a cylinder standing on end: it hangs out at
    // the shoulder and comes back in at the elbow, and the mean of the whole
    // limb is not inside it at every height. Every tongue of flame then
    // converges into that one point like water down a plughole. Shoulder joint
    // to elbow joint is inside the meat by construction.
    //
    // And letting the noise drift even slightly with height turns the tongues
    // into a leopard, because y < edge(a, y) has closed islands in it and
    // y < edge(a) cannot.
    float armK = smoothstep(0.25, 0.60, vArm);
    if (uInk > 0.0 && armK > 0.0) {
      vec2 axis = mix(uArmC.xy, uArmC.zw,
                      clamp((f.y - uArmY.x) / max(uArmY.y - uArmY.x, 1e-4), 0.0, 1.0));
      float ang = atan(f.z - axis.y, f.x - axis.x);
      float lick = 0.64 * fbm2(vec2(ang * 3.2, 0.0), 3)
                 + 0.36 * vnoise2(vec2(ang * 8.0, 11.0));
      // Both octaves come back bunched around a half — that is what noise does
      // — and a boundary that only ever moves through the middle third of its
      // range is a wavy line. The contrast curve is what turns it into tongues
      // with sky between them.
      lick = smoothstep(0.28, 0.80, lick);
      float front = mix(uArmY.x - 0.03, uArmY.y + 0.01, uInk);
      float edge = front - ${FACE.lick} * (1.0 - lick);
      float ink = smoothstep(edge + 0.005, edge - 0.005, f.y) * armK;
      vec3 inkCol = mix(vec3(${FACE.hot.join(', ')}), vec3(${FACE.ash.join(', ')}),
                     smoothstep(0.0, 0.070, edge - f.y));
      base = mix(base, inkCol, ink);
    }

    // The dolphins are linework on the outside of both ankles. They are drawn
    // in bind space so they stay with the skin through every pose, and only
    // arrive once the hip wrap has been dropped in the kabina.
    if (uDolphin > 0.0) {
      // Lifted 4 cm above the anklet so its silhouette is never mistaken for
      // jewellery, and scaled for a mark that remains legible from a crouch.
      vec2 q = (f.xy - (uAnkle.xy + vec2(0.0, 0.052))) / vec2(0.058, 0.064);
      float dolphin = 0.0;
      dolphin = max(dolphin, inkStroke(q, vec2(-0.68, -0.03), vec2(-0.18, 0.16), 0.075));
      dolphin = max(dolphin, inkStroke(q, vec2(-0.18, 0.16), vec2(0.43, 0.03), 0.075));
      dolphin = max(dolphin, inkStroke(q, vec2(0.38, 0.03), vec2(0.86, -0.06), 0.045));
      dolphin = max(dolphin, inkStroke(q, vec2(-0.08, 0.14), vec2(0.12, 0.56), 0.042));
      dolphin = max(dolphin, inkStroke(q, vec2(0.03, 0.10), vec2(0.30, -0.30), 0.040));
      dolphin = max(dolphin, inkStroke(q, vec2(-0.66, -0.03), vec2(-1.03, 0.31), 0.047));
      dolphin = max(dolphin, inkStroke(q, vec2(-0.66, -0.03), vec2(-1.03, -0.31), 0.047));
      float frame = 1.0 - smoothstep(1.28, 1.48, length(q / vec2(1.0, 0.70)));
      // Restrict it to the outside faces of the ankles. Without this it projects
      // through the whole leg and reads as a bracelet from the front or back.
      float outer = smoothstep(0.016, 0.026, f.z);
      base = mix(base, vec3(${FACE.dolphin.join(', ')}), dolphin * frame * outer * uDolphin);
    }
  }
`;

/**
 * Wrap a decoded v3 blob into something that can be posed.
 *
 * Returns the mesh, a `play(name, opts)` and an `update(dt)`. The bone palette
 * lives in a uniform shared by the surface material and the shadow caster, so
 * a figure is skinned exactly once a frame no matter how many times she is
 * drawn.
 */
function skinnedFigure(data, opts = {}) {
  const nb = data.bones.length;
  // Three RGBA texels a bone, in one row. Nearest on both filters and no
  // mipmaps: this is a buffer that happens to be shaped like an image, and any
  // filtering at all would blend one bone into the next.
  const palette = new Float32Array(nb * 12);
  const boneTex = new THREE.DataTexture(palette, nb * 3, 1,
    THREE.RGBAFormat, THREE.FloatType);
  boneTex.minFilter = THREE.NearestFilter;
  boneTex.magFilter = THREE.NearestFilter;
  boneTex.generateMipmaps = false;
  boneTex.needsUpdate = true;
  const uBones = { value: boneTex };
  const uBoneRows = { value: nb * 3 };

  // `opts.face` asks for a face and does not promise one: `faceAnchors` returns
  // null if it cannot find the eyeballs, and drops the smile on its own if the
  // mouth is not where the palette says. A figure with no face is the figure
  // that shipped yesterday, which is a perfectly good failure.
  const anchors = opts.face ? faceAnchors(data) : null;
  const V = (a) => ({ value: new THREE.Vector3(a[0], a[1], a[2]) });
  const uFace = anchors ? {
    uBlink: { value: 0 },
    uSmile: { value: 0 },
    uEye: V(anchors.eye),
    uEyeR: V(FACE.eyeR),
    uLidCol: V(anchors.lid),
    uLashCol: V(anchors.lash),
    uLip: V(anchors.corner || [0, -99, 0]),
    uLipR: V(FACE.lipR),
    uLift: V(anchors.corner ? FACE.lift : [0, 0, 0]),
    uGape: { value: 0 },
    uFoam: { value: 0 },
    uLipC: V(anchors.lipC || [0, -99, 0]),
    uJawR: V(FACE.jawR),
    uLipsR: V([FACE.lipsR[0], FACE.lipsR[1], FACE.lipsR[2] * anchors.lipW]),
    uInk: { value: 0 },
    // Two bone numbers, an axis and a span. If the arms could not be found the
    // bone numbers are −1, which nothing matches, and the ink never draws.
    // Filled from the rest skeleton below, once there is one.
    uArmB: { value: new THREE.Vector2(-1, -1) },
    uArmC: { value: new THREE.Vector4(0, 0, 0, 0) },
    uArmY: { value: new THREE.Vector2(0, 1) },
    uDolphin: { value: 0 },
    uAnkle: V([0, -99, 0]),
  } : {};

  const mat = solidMaterial(0xffffff, {
    ...opts,
    defines: { FR_SKIN: '', FR_BONES: nb },
    uniforms: { uBones, uBoneRows, ...uFace, ...(opts.uniforms || {}) },
    decl: (opts.decl || '') + (anchors ? FACE_DECL : ''),
    vert: anchors ? FACE_VERT : (opts.vert || ''),
    body: (opts.body || '') + (anchors ? FACE_FRAG : ''),
  });
  const mesh = new THREE.Mesh(data.geo, mat);

  // Rest hierarchy, and the inverse bind that undoes it. Both are derived here
  // rather than shipped: the blob carries the parent-relative rest transform
  // and nothing else, so there is no way for the two to disagree.
  const restQ = new Float32Array(nb * 4), restT = new Float32Array(nb * 3);
  const bindQ = new Float32Array(nb * 4), bindT = new Float32Array(nb * 3);
  const invQ = new Float32Array(nb * 4), invT = new Float32Array(nb * 3);
  for (let i = 0; i < nb; i++) {
    const b = data.bones[i];
    restQ.set(b.q, i * 4);
    restT.set(b.t, i * 3);
    if (b.parent < 0) {
      bindQ.set(b.q, i * 4);
      bindT.set(b.t, i * 3);
    } else {
      qmul(bindQ, i * 4, bindQ, b.parent * 4, restQ, i * 4);
      qrotv(bindT, i * 3, bindQ, b.parent * 4, restT, i * 3);
      bindT[i * 3] += bindT[b.parent * 3];
      bindT[i * 3 + 1] += bindT[b.parent * 3 + 1];
      bindT[i * 3 + 2] += bindT[b.parent * 3 + 2];
    }
    invQ[i * 4] = -bindQ[i * 4];
    invQ[i * 4 + 1] = -bindQ[i * 4 + 1];
    invQ[i * 4 + 2] = -bindQ[i * 4 + 2];
    invQ[i * 4 + 3] = bindQ[i * 4 + 3];
    qrotv(invT, i * 3, invQ, i * 4, bindT, i * 3);
    invT[i * 3] *= -1; invT[i * 3 + 1] *= -1; invT[i * 3 + 2] *= -1;
  }

  // Where the ink is wrapped: the upper arm's own bone, shoulder joint to
  // elbow joint, with her two sides folded on to one. `bindT` is the rest
  // skeleton in figure space, which is the same space the shader's `vLocal` is
  // in, so these go straight into a uniform with nothing to convert.
  if (anchors && anchors.armB.length === 2) {
    const up = anchors.armB[0];
    const low = data.bones.findIndex((b) => b.parent === up);
    if (low >= 0) {
      const at = (i) => [bindT[i * 3], bindT[i * 3 + 1], Math.abs(bindT[i * 3 + 2])];
      const S = at(up), E = at(low);
      uFace.uArmB.value.set(anchors.armB[0], anchors.armB[1]);
      uFace.uArmC.value.set(E[0], E[2], S[0], S[2]);
      uFace.uArmY.value.set(E[1], S[1]);
      anchors.armY = [E[1], S[1]];
    }
  }

  // Both ankles are symmetric, so the shader folds their lateral coordinate on
  // to one anchor. The foot bone starts at the ankle in this rig.
  if (anchors) {
    const foot = data.bones.findIndex((b) => /^foot[LR]$/.test(b.name));
    if (foot >= 0) {
      uFace.uAnkle.value.set(bindT[foot * 3], bindT[foot * 3 + 1],
        Math.abs(bindT[foot * 3 + 2]));
    }
  }

  // Scratch, allocated once.
  const localQ = new Float32Array(nb * 4), localT = new Float32Array(nb * 3);
  const mixQ = new Float32Array(nb * 4), mixT = new Float32Array(nb * 3);
  const worldQ = new Float32Array(nb * 4), worldT = new Float32Array(nb * 3);
  const tmp = new Float32Array(4);

  function sample(clip, t, outQ, outT) {
    const nf = clip.nf;
    let u = clip.loop ? ((t % clip.dur) + clip.dur) % clip.dur
      : Math.min(Math.max(t, 0), clip.dur);
    const fp = clip.loop ? (u / clip.dur) * nf : (u / clip.dur) * (nf - 1);
    let f0 = Math.floor(fp);
    const a = fp - f0;
    let f1 = f0 + 1;
    if (clip.loop) { f0 = ((f0 % nf) + nf) % nf; f1 = f1 % nf; }
    else { f0 = Math.min(Math.max(f0, 0), nf - 1); f1 = Math.min(f1, nf - 1); }
    const r = clip.root, q = clip.quat;
    for (let k = 0; k < 3; k++) {
      outT[k] = r[f0 * 3 + k] + (r[f1 * 3 + k] - r[f0 * 3 + k]) * a;
    }
    const o0 = f0 * nb * 4, o1 = f1 * nb * 4;
    for (let i = 0; i < nb; i++) {
      const p = i * 4;
      let bx = q[o1 + p] / 32767, by = q[o1 + p + 1] / 32767;
      let bz = q[o1 + p + 2] / 32767, bw = q[o1 + p + 3] / 32767;
      const ax = q[o0 + p] / 32767, ay = q[o0 + p + 1] / 32767;
      const az = q[o0 + p + 2] / 32767, aw = q[o0 + p + 3] / 32767;
      if (ax * bx + ay * by + az * bz + aw * bw < 0) {
        bx = -bx; by = -by; bz = -bz; bw = -bw;
      }
      let x = ax + (bx - ax) * a, y = ay + (by - ay) * a;
      let z = az + (bz - az) * a, w = aw + (bw - aw) * a;
      const l = Math.hypot(x, y, z, w) || 1;
      outQ[p] = x / l; outQ[p + 1] = y / l; outQ[p + 2] = z / l; outQ[p + 3] = w / l;
    }
  }

  const st = {
    cur: null, curT: 0, prev: null, prevT: 0, fade: 0, fadeLen: 0,
    next: null, speed: 1,
  };

  /**
   * One extra rotation on one bone, laid over whatever the clip is doing.
   *
   * In *figure* space, not in the bone's own frame, and that is the whole point
   * of it. A bone-local rotation needs to know which way the bone's axes happen
   * to point, which is a fact about how the rig was built in Blender and is not
   * recoverable from anything shipped in the blob — the paper trail on the
   * kneeling arms is what asking that question three times looks like. Figure
   * space is known: +x is the way she faces, +y is up. So "chin up" is a turn
   * about z and there is nothing to measure.
   *
   * Applied after the clip and before the children, so the head takes her eyes
   * with it, and about the bone's own head, so nothing moves that should not.
   */
  const aims = new Map();          // bone index -> [x,y,z,w], figure space
  function aim(name, ax, ay, az, ang) {
    const i = data.bones.findIndex((b) => b.name === name);
    if (i < 0) return false;
    if (!ang) { aims.delete(i); return true; }
    const l = Math.hypot(ax, ay, az) || 1;
    const h = ang * 0.5, k = Math.sin(h) / l;
    aims.set(i, [ax * k, ay * k, az * k, Math.cos(h)]);
    return true;
  }

  /**
   * @param name   clip to play
   * @param fade   seconds to cross into it
   * @param next   clip to fall back to when a one-shot finishes
   */
  function play(name, { fade = 0.30, next = null, from = 0 } = {}) {
    const clip = data.clips[name];
    if (!clip || clip === st.cur) return false;
    if (st.cur && fade > 0) {
      st.prev = st.cur; st.prevT = st.curT; st.fade = 0; st.fadeLen = fade;
    } else {
      st.prev = null; st.fadeLen = 0;
    }
    st.cur = clip; st.curT = from; st.next = next;
    return true;
  }

  function update(dt) {
    if (!st.cur) return;
    const step = dt * st.speed;
    st.curT += step;
    if (!st.cur.loop && st.curT >= st.cur.dur && st.next) {
      const back = st.next;
      st.next = null;
      play(back, { fade: 0.34 });
      st.curT += step;
    }

    sample(st.cur, st.curT, localQ, localT);
    if (st.prev) {
      st.fade += step;
      const u = Math.min(1, st.fade / st.fadeLen);
      st.prevT += step;
      sample(st.prev, st.prevT, mixQ, mixT);
      for (let i = 0; i < nb; i++) qnlerp(localQ, i * 4, mixQ, i * 4, localQ, i * 4, u);
      for (let k = 0; k < 3; k++) localT[k] = mixT[k] + (localT[k] - mixT[k]) * u;
      if (u >= 1) st.prev = null;
    }

    const P = palette;
    for (let i = 0; i < nb; i++) {
      const p = data.bones[i].parent;
      // The root's translation is the clip's; everything below it hangs off the
      // rest skeleton, because bone lengths do not animate.
      const tx = p < 0 ? localT[0] : restT[i * 3];
      const ty = p < 0 ? localT[1] : restT[i * 3 + 1];
      const tz = p < 0 ? localT[2] : restT[i * 3 + 2];
      if (p < 0) {
        worldQ[0] = localQ[0]; worldQ[1] = localQ[1];
        worldQ[2] = localQ[2]; worldQ[3] = localQ[3];
        worldT[0] = tx; worldT[1] = ty; worldT[2] = tz;
      } else {
        qmul(worldQ, i * 4, worldQ, p * 4, localQ, i * 4);
        tmp[0] = tx; tmp[1] = ty; tmp[2] = tz;
        qrotv(worldT, i * 3, worldQ, p * 4, tmp, 0);
        worldT[i * 3] += worldT[p * 3];
        worldT[i * 3 + 1] += worldT[p * 3 + 1];
        worldT[i * 3 + 2] += worldT[p * 3 + 2];
      }

      if (aims.size) {
        const aq = aims.get(i);
        if (aq) qmul(worldQ, i * 4, aq, 0, worldQ, i * 4);
      }

      // skin = world * bind^-1, written straight out as three rows of a 3x4.
      const sq = i * 4;
      qmul(mixQ, sq, worldQ, sq, invQ, sq);
      qrotv(mixT, i * 3, worldQ, sq, invT, i * 3);
      const x = mixQ[sq], y = mixQ[sq + 1], z = mixQ[sq + 2], w = mixQ[sq + 3];
      const x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2;
      const yy = y * y2, yz = y * z2, zz = z * z2;
      const wx = w * x2, wy = w * y2, wz = w * z2;
      const o = i * 12;
      P[o] = 1 - (yy + zz); P[o + 1] = xy - wz; P[o + 2] = xz + wy;
      P[o + 3] = worldT[i * 3] + mixT[i * 3];
      P[o + 4] = xy + wz; P[o + 5] = 1 - (xx + zz); P[o + 6] = yz - wx;
      P[o + 7] = worldT[i * 3 + 1] + mixT[i * 3 + 1];
      P[o + 8] = xz - wy; P[o + 9] = yz + wx; P[o + 10] = 1 - (xx + yy);
      P[o + 11] = worldT[i * 3 + 2] + mixT[i * 3 + 2];
    }
    // The palette is the texture's own backing array, so this is the whole of
    // getting it to the GPU: 1.3 KB a frame, on a figure that is only stepped
    // at all when somebody is inside 250 m of her.
    boneTex.needsUpdate = true;
  }

  // ── the face, over time ────────────────────────────────────────────────
  //
  // The blink belongs here rather than wherever she happens to be standing:
  // it is not a decision anybody makes and nothing on the promenade should have
  // to remember to ask for it. The smile is the opposite — that is a mood, so
  // it is a number the caller sets and this only eases towards it.
  const bl = { wait: 1.2 + Math.random() * BLINK.spread, at: -1, again: false };
  const face = anchors ? {
    smile: 0,          // what the caller wants, 0..1
    gape: 0,           // and how far her mouth is open
    foam: 0,           // and how much of what went in it is still there
    ink: 0,            // and how far the flames have climbed her arms
    dolphin: 0,        // the ankle ink is revealed with the dropped wrap
    rate: 1,           // blinks a second, scaled. Staring is `rate = 0`.
    anchors,
  } : null;

  // A smile narrows the eyes, and that is most of why one reads from across a
  // promenade. The mouth is 55 mm of dark line on a head that is a hundred
  // pixels tall from where she is actually looked at; the eyes are the highest
  // contrast thing on her, so a fifth of a lid is worth more than the whole
  // corner lift below it. They share the uniform, and the blink wins.
  const setBlink = (v) => {
    uFace.uBlink.value = Math.max(v, uFace.uSmile.value * FACE.squint);
  };

  function faceTick(dt) {
    if (!face) return;
    uFace.uSmile.value = damp(uFace.uSmile.value, sat(face.smile), 7, dt);
    // Quicker than the smile. A mouth opens in about a tenth of a second and a
    // jaw easing down over half of one is a yawn, which is the opposite of what
    // anybody asks for it.
    uFace.uGape.value = damp(uFace.uGape.value, sat(face.gape), 13, dt);
    // And slower again than the ink. Foam does not arrive, it collects, and the
    // caller's own meter is already the slow part — this only takes the step out
    // of the frame the jet first lands on.
    uFace.uFoam.value = damp(uFace.uFoam.value, sat(face.foam), 3.4, dt);
    // Slower than the smile on purpose. A smile is a face changing its mind; the
    // ink is a flame front going up an arm, and it wants the second and a bit
    // that the riser under the turn takes.
    uFace.uInk.value = damp(uFace.uInk.value, sat(face.ink), 2.6, dt);
    uFace.uDolphin.value = damp(uFace.uDolphin.value, sat(face.dolphin), 7, dt);

    if (bl.at < 0) {
      // A rate of nothing is not a very long wait, it is no blinking at all —
      // and it leaves the uniform alone, which is what lets the screenshot door
      // hold a half-closed eye still for a second and a half.
      if (face.rate <= 0) return;
      bl.wait -= dt * face.rate;
      if (bl.wait > 0) { setBlink(0); return; }
      bl.at = 0;
    }
    bl.at += dt;
    let v;
    if (bl.at < BLINK.shut) v = bl.at / BLINK.shut;
    else if (bl.at < BLINK.shut + BLINK.open) v = 1 - (bl.at - BLINK.shut) / BLINK.open;
    else {
      v = 0;
      bl.at = -1;
      // A second blink follows the first by less than a wait, which is what
      // makes a double read as one gesture rather than as two events. The dice
      // are only rolled on the way into a full wait, so a double never turns
      // into a triple.
      if (bl.again) { bl.wait = 0.09; bl.again = false; } else {
        bl.wait = BLINK.gap + Math.random() * BLINK.spread;
        bl.again = Math.random() < BLINK.again;
      }
    }
    setBlink(v * v * (3 - 2 * v));
  }

  /** Register with the shadow pass, sharing this figure's bone palette. */
  function cast(shadow, o = {}) {
    return shadow.cast(mesh, {
      near: o.near !== false, dynamic: true,
      material: shadow.casterMaterial(skinCasterVert(nb), { uBones, uBoneRows }),
    });
  }

  /**
   * Put the wrap on, or take it off.
   *
   * The whole mechanism is one draw range, because the exporter went to the
   * trouble of putting the wrap last. Off is "stop drawing before the tail";
   * on is the default range back. No second mesh, no second material, no
   * per-fragment test, and — the part that matters — the shadow pass gets it
   * for free, since `cast` registers this same geometry under a depth-only
   * material and a draw range belongs to the geometry rather than to either.
   *
   * She is a complete body underneath. The wrap has been laid-on geometry
   * sitting four millimetres off the skin ever since the painted garment came
   * off her in 1.43, so there is nothing behind it to be missing — which is the
   * one thing that would have made this hard and was already paid for.
   */
  function wear(on) {
    data.geo.setDrawRange(0, on ? Infinity : data.ni - data.shed);
  }

  function tattoo(on) {
    if (face) face.dolphin = on ? 1 : 0;
  }

  update(0);
  return {
    mesh, material: mat, bones: data.bones, uBones, cast, wear, tattoo,
    clips: Object.keys(data.clips), tris: data.tris, nv: data.nv,
    play, update, state: st, face, faceTick, uFace, aim,
    playing: () => (st.cur ? st.cur.name : null),
    /**
     * Where a bone's head has got to this frame, in figure space.
     *
     * Not the skinning matrix, which is what the uniform holds: that is
     * `world * bind⁻¹` and it is only good for moving vertices that were
     * authored in the bind pose. Something that was never in the bind pose —
     * a card in her hands — wants the plain world transform, and the pass
     * above has already computed it on the way to the other one.
     *
     * Figure space, so a caller that parents to `mesh` needs no conversion.
     */
    boneAt: (i, out) => {
      out.set(worldT[i * 3], worldT[i * 3 + 1], worldT[i * 3 + 2]);
      return out;
    },
    boneIndex: (name) => data.bones.findIndex((b) => b.name === name),
  };
}

/** Pull one skinned model out of the inlined payload. Null if it is not there. */
async function loadSkin(key, opts) {
  const b64 = PAYLOAD[key];
  if (!b64) { console.warn('no payload for skin', key); return null; }
  try {
    return skinnedFigure(readFR3DSkin(await inflateBinary(b64)), opts);
  } catch (e) {
    console.warn('skin failed:', key, e.message);
    return null;
  }
}
