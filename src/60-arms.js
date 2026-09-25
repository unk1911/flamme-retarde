// -----------------------------------------------------------------------------
// Your own arms, in the water.
//
// The rig has twenty-two clips and not one of them is a swim, and for most of
// this project that was the right answer: a swim clip is a whole body, and the
// only place a whole body is ever drawn is inside the bathroom mirror. There
// is no mirror in the Adriatic. Bake the finest front crawl anybody has ever
// solved in Blender and the game would show you exactly none of it.
//
// What the game *would* show you is what you can actually see while swimming,
// which is your own two arms and nothing else. That is the animation. Everyone
// who has been in the sea knows the picture: the far hand entering ahead of
// you, the near forearm sweeping down past the bottom of the frame, and then
// the elbow coming over high and outboard on the recovery, half of it out of
// shot. Miss that out and the first-person swim is a camera flying through
// water; put it in and it is a person.
//
// So this is a two-joint chain a side, driven by angles rather than by IK.
// Angles, because the shape of a crawl is a *cycle* and not a target: a hand
// does not go to a place, it goes round. An IK solve would need the same cycle
// written out to have something to aim at, and would then add a solver's
// worth of ways to be wrong at the singular pose, which for an arm is the one
// it spends a quarter of every stroke in — straight out ahead.
//
// Three things it has to get right, and none of them is the arm.
//
// The first is that the arms belong to the *body* and the camera does not. The
// head rolls with the stroke — that is `pose()` in 59-swim.js and it is what
// makes the horizon tip — and if the arms are parented to a rolling camera
// then the arms never roll, because they roll with it. So they hang off the
// camera's position and yaw and take the roll back out.
//
// The second is that they stop. There is no swimming on the spot: let go of
// everything and the jacket floats you, your arms scull, and the cycle has to
// wind down to that rather than keep churning. Out of air it stops altogether,
// because that is the whole of what running out of air does here — it takes
// the controls off you, and arms that carried on stroking would be arguing
// with the only consequence in the mode.
//
// The third is that they are *in* the water and have to be lit like it. That
// is free: `solidMaterial` carries `applyWater`, so an arm at four metres down
// goes the same green everything else does, and a hand that comes out on the
// recovery brightens as it clears the surface without a line of code.
//
// ── AND THE ARM IS HERS NOW ─────────────────────────────────────────────────
//
// Misha, 24 Sep 2026, with his thumb on Baye's lip: *"is there anything that
// can be done to make my extended hand look more natural/realistic? don't we
// have baye's hand available that we could model my (Chloe's extended hand)
// hand from? with beautiful fingers"*.
//
// Until then this chain carried lathes — a superellipse swept down a table of
// anatomist's widths for each limb, a palm with an arch, a thumb pad and
// fourteen beaded tubes for finger bones. Every number in it was measured and
// every one of them was right, and at forty centimetres it was still a
// mannequin's hand, because a hand is not a set of right numbers: it is a
// surface nobody can write down. MakeHuman's is not written down. It is the
// base mesh every person in this game is built on, modelled by people who
// model hands, under a photographed skin — and Chloe v2.0 already wears it.
//
// So `tools/hand_fp.py` cuts her right arm off below the deltoid, subdivides
// it once, gives it twenty bones (upper arm, a forearm in three twist
// segments, a hand, three a digit) off MakeHuman's own joint markers, paints
// nails on to her skin, and bakes it into `chloe2_arm`. Here it is skinned on
// the GPU exactly as she is — `FR_SKIN` in src/30-material.js — and the chain
// underneath it is the same chain it always was: the solve places a shoulder,
// an elbow and a wrist, and the bones are read off those three and a table of
// finger angles. The left arm is the same arm in a mirror; her body is
// symmetric below the neck, because `mh_morph.py` only ever touched her face.
// -----------------------------------------------------------------------------

const ARMS = {
  // Where the shoulders are, relative to the eye. Out, down and back: your eye
  // is at the top of your head and your shoulder is a good 28 cm under it, and
  // in a prone float the head is ahead of the shoulders as well as above them.
  // Written closer than that at first and the result was a forearm filling a
  // quarter of the frame — the arms were the right size and in the wrong place,
  // which at half a metre from a 58-degree lens is the same mistake as being
  // the wrong size.
  shoulder: [0.195, -0.245, 0.145],

  // And a little of it back when you look down, which is the only thing left
  // of what used to be a `lift` here.
  //
  // That number tipped the whole shoulder line up by twenty-four degrees so
  // that the stroke would ride in the bottom third of the picture, and it was
  // the reason the arms could never be got right: it sat between the numbers
  // that were being tuned and the thing being looked at, so every attempt to
  // move a hand *in the frame* moved it somewhere else as well. The stroke is
  // written in the eye's own frame now — see SWIM_KEYS — and there is nothing
  // left for a lift to do.
  //
  // What is left is this: a swimmer who looks down does not only move their
  // eyes, the shoulders follow about half way. It is what makes a duck-dive
  // read, and it is also what lets you look down to watch your own stroke.
  follow: 0.55,

  // Humerus and forearm. These are HER numbers — read off the blob's joints
  // when it loads, and these two are what they come out as, so that the chain
  // is the right length even for the few frames before it has.
  upper: 0.2391,
  fore: 0.2378,

  // The bar, for the kite mode. 52 cm across, which is a small bar and the
  // common one, and where it sits relative to the eye: out in front, down at
  // the bottom of the chest, exactly where 59-ride.js puts its end of the
  // lines so that the two halves of the rig meet.
  barW: 0.52,
  barAt: [0.0, -0.23, -0.46],

  // How much of a stroke a stopped swimmer still sculls.
  idle: 0.30,
};

/**
 * How a hand is held, joint by joint. Radians of flexion from her rest hand —
 * which is MakeHuman's, nearly flat with the fingers a little apart.
 *
 * `f` is index, middle, ring, little: knuckle, middle joint, end joint.
 * `fan` is how far apart they are held, per finger, as a fraction of `FAN`.
 * `t` is the thumb: [opposition, abduction, base, middle, end] — swung in
 * front of the palm, swung away from the index, then curled at its three
 * joints.
 *
 * THE CASCADE IS THE WHOLE OF A RELAXED HAND. A hand at rest does not curl its
 * four fingers alike: the index stays straightest and each finger toward the
 * little one closes a little further, so the tips make a fan that sweeps round
 * into the palm. Four fingers at one angle are a claw, and a claw is what
 * every first draft of `reach` looked like.
 */
const HAND_POSE = {
  // Thumb out to her lip, the rest of the hand let go — not a fist. Misha's
  // brief: "thumb extended toward her mouth, other fingers loosely curled, a
  // natural relaxed pose".
  //
  // And then, 24 Sep: *"it needs to be in her mouth, with the other fingers
  // more clenched"*. So the four close nearly to a fist — a hitchhiker's
  // hand, the curl still growing toward the little finger — and only the
  // thumb is out.
  reach: {
    f: [[1.05, 1.30, 0.80], [1.20, 1.45, 0.85], [1.28, 1.52, 0.85], [1.36, 1.52, 0.82]],
    fan: [-0.15, 0.0, -0.15, -0.30],
    // A touch past straight at the end joint: a thumb pressing on something
    // soft bends back at the tip, and one that stays dead straight is posed.
    t: [0.10, 0.40, 0.05, -0.05, 0.05],
  },
  // Round a 27 mm bar. Its own shape and not a relaxed hand run further round
  // the same arc — see the note that used to sit here on the kite grip: that
  // put 110 degrees into a finger that needs 190.
  fist: {
    f: [[1.30, 1.55, 0.95], [1.38, 1.60, 0.95], [1.42, 1.62, 0.92], [1.46, 1.60, 0.90]],
    fan: [-0.25, 0.0, -0.20, -0.35],
    t: [0.95, 0.10, 0.20, 0.55, 0.45],
  },
  // Petting her head — Misha, 24 Sep: *"pet her on top of the head, pet her
  // hair"*. A hand laid on a head is nearly flat and a little cupped to its
  // round, the fingers together, the thumb lying along the index.
  pet: {
    f: [[0.22, 0.26, 0.16], [0.24, 0.28, 0.16], [0.28, 0.30, 0.18], [0.32, 0.32, 0.20]],
    fan: [-0.35, 0.0, -0.35, -0.45],
    t: [0.30, 0.10, 0.10, 0.10, 0.10],
  },
  // A hand resting on a breast: open, the fingers together and gently curved
  // to its round, the thumb a little out.
  cup: {
    f: [[0.14, 0.18, 0.10], [0.16, 0.20, 0.10], [0.18, 0.22, 0.12], [0.20, 0.24, 0.14]],
    fan: [-0.20, 0.0, -0.20, -0.25],
    t: [0.25, 0.45, 0.10, 0.12, 0.10],
  },
  // The paddle and the let-go hand of a crawl.
  flat: {
    f: [[0.05, 0.09, 0.11], [0.05, 0.09, 0.11], [0.05, 0.09, 0.11], [0.05, 0.09, 0.11]],
    fan: [-0.9, 0.0, -0.9, -1.0],
    t: [0.30, -0.25, 0.10, 0.10, 0.15],
  },
  loose: {
    f: [[0.36, 0.48, 0.34], [0.42, 0.55, 0.40], [0.48, 0.58, 0.40], [0.54, 0.58, 0.38]],
    fan: [0.6, 0.0, 0.6, 1.0],
    t: [0.20, 0.30, 0.10, 0.20, 0.25],
  },
};
// Radians of fan at 1.0: the index swings this far toward the thumb and the
// little finger this far away from it. A spread hand is about thirty degrees
// from index to little.
const FAN = 0.13;

/** A fresh pose, copied from a preset so the swim can write into it. */
function handPose(src = HAND_POSE.reach) {
  return { f: src.f.map((r) => r.slice()), fan: src.fan.slice(), t: src.t.slice() };
}

/** Write a preset (or a blend of two) into a pose, in place. */
function setHandPose(out, a, b = null, u = 0) {
  for (let n = 0; n < 4; n++) {
    for (let k = 0; k < 3; k++) {
      out.f[n][k] = b ? a.f[n][k] + (b.f[n][k] - a.f[n][k]) * u : a.f[n][k];
    }
    out.fan[n] = b ? a.fan[n] + (b.fan[n] - a.fan[n]) * u : a.fan[n];
  }
  for (let k = 0; k < 5; k++) out.t[k] = b ? a.t[k] + (b.t[k] - a.t[k]) * u : a.t[k];
  return out;
}

/**
 * Decode `chloe2_arm.frhd` — see tools/hand_fp.py, which writes it.
 *
 * Her right arm in her own bind-pose figure space (the space `vLocal` means on
 * the mirror figure, which is why the sleeve below can be the sleeve that is
 * painted on her there, number for number), quantised: positions to 16 bits
 * over the arm's own box, UVs to 16, normals to 8, and a nail mask a vertex.
 * Then the joints the bones are built from: shoulder, elbow, wrist, and
 * MakeHuman's four markers down each digit.
 */
function readArmBlob(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
    dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'FRHD') throw new Error('not an arm blob: ' + magic);
  const nv = dv.getUint32(8, true), ni = dv.getUint32(12, true);
  const nj = dv.getUint32(16, true);
  let o = 20;
  const lo = [], ext = [];
  for (let i = 0; i < 3; i++) lo.push(dv.getFloat32(o + i * 4, true));
  for (let i = 0; i < 3; i++) ext.push(dv.getFloat32(o + 12 + i * 4, true));
  o += 24;
  const joints = [];
  for (let j = 0; j < nj; j++) {
    joints.push(new THREE.Vector3(dv.getFloat32(o, true), dv.getFloat32(o + 4, true),
      dv.getFloat32(o + 8, true)));
    o += 12;
  }
  // Copies rather than views: the 16-bit arrays land wherever the joint table
  // left them, and a Uint16Array view has to be 2-byte aligned.
  const qp = new Uint16Array(buf.slice(o, o + nv * 6)); o += nv * 6;
  const qt = new Uint16Array(buf.slice(o, o + nv * 4)); o += nv * 4;
  const qn = new Int8Array(buf, o, nv * 3); o += nv * 3;
  const bidx = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  const bwgt = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  const nail = new Uint8Array(buf, o, nv); o += nv;
  o = (o + 3) & ~3;
  const idx = nv < 65536 ? new Uint16Array(buf.slice(o, o + ni * 2))
    : new Uint32Array(buf.slice(o, o + ni * 4));
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    for (let c = 0; c < 3; c++) {
      pos[i * 3 + c] = lo[c] + (qp[i * 3 + c] / 65535) * ext[c];
      nrm[i * 3 + c] = qn[i * 3 + c] / 127;
    }
    uv[i * 2] = qt[i * 2] / 65535;
    uv[i * 2 + 1] = qt[i * 2 + 1] / 65535;
  }
  // Joint names in blob order: s, e, w, then f[n][k] for n 1..5 (thumb first),
  // k 1..4 — knuckle, the next two joints, and the tip.
  const J = { s: joints[0], e: joints[1], w: joints[2], f: [] };
  for (let n = 0; n < 5; n++) J.f.push(joints.slice(3 + n * 4, 7 + n * 4));
  return { nv, ni, pos, nrm, uv, bidx, bwgt, nail, idx, J };
}

/**
 * One side of her: a geometry, and everything the bones need to know about
 * where they were in the bind pose.
 *
 * The left arm is the right arm with Z negated — her right is +Z in figure
 * space, see `YOU.right` — and a mirror turns every triangle inside out, so
 * the winding is swapped with it.
 *
 * THE FRAMES. The chain above this writes three groups whose conventions were
 * fixed years before this mesh existed: every limb hangs down its own −Y, the
 * elbow bends about the shoulder's X and swings the forearm toward +Z, and the
 * palm faces the wrist's +Z. So each bone gets a bind frame in THOSE terms,
 * built off the joints: the upper arm's −Y down the humerus and its +Z toward
 * where her forearm actually bends (her rest elbow is 47 degrees in, which is
 * plenty to read the plane off), the forearm sharing that hinge, and the hand's
 * +Z out of the palm, found from the knuckle row. A bone's skin matrix is then
 * the group it rides times the inverse of its bind frame, and nothing about the
 * chain has to change to carry her.
 */
function armModel(blob, side) {
  const m = side < 0 ? new THREE.Vector3(1, 1, -1) : null;
  const P = (v) => (m ? v.clone().multiply(m) : v.clone());
  const J = { s: P(blob.J.s), e: P(blob.J.e), w: P(blob.J.w),
    f: blob.J.f.map((d) => d.map(P)) };

  const nv = blob.nv;
  const pos = new Float32Array(blob.pos), nrm = new Float32Array(blob.nrm);
  const idx = blob.idx.slice();
  if (m) {
    for (let i = 0; i < nv; i++) { pos[i * 3 + 2] *= -1; nrm[i * 3 + 2] *= -1; }
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(blob.uv, 2));
  // The nail mask rides in the red of `aVCol`, the one per-vertex channel the
  // shared vertex program already carries through to the fragment. Nothing
  // else on this material reads vertex colour.
  const vc = new Uint8Array(nv * 3);
  for (let i = 0; i < nv; i++) vc[i * 3] = blob.nail[i];
  g.setAttribute('aVCol', new THREE.BufferAttribute(vc, 3, true));
  g.setAttribute('aBoneIdx', new THREE.BufferAttribute(blob.bidx, 4, true));
  g.setAttribute('aBoneWt', new THREE.BufferAttribute(blob.bwgt, 4, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));

  const V = () => new THREE.Vector3();
  const frame = (o, x, y, z) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(o);
  const orth = (v, a) => v.clone().addScaledVector(a, -v.dot(a)).normalize();

  // Upper arm and forearm, sharing the elbow's hinge.
  const yu = V().subVectors(J.e, J.s).normalize().negate();
  const fd = V().subVectors(J.w, J.e).normalize();
  const zu = orth(fd, yu);
  const xu = V().crossVectors(yu, zu).normalize();
  const Fu = frame(J.s, xu, yu, zu);
  const yf = fd.clone().negate();
  const xf = orth(xu, yf);
  const zf = V().crossVectors(xf, yf).normalize();
  const Ff = frame(J.e, xf, yf, zf);

  // The hand: −Y from the wrist to the middle knuckle, +Z out of the palm.
  // Knuckle row crossed with the hand gives the palm on her right hand; the
  // mirror turns a cross product round, so the left takes it the other way.
  const a = V().subVectors(J.f[2][0], J.w).normalize();
  const kn = orth(V().subVectors(J.f[4][0], J.f[1][0]), a);
  const palm = V().crossVectors(a, kn).multiplyScalar(side).normalize();
  const yh = a.clone().negate();
  const zh = orth(palm, yh);
  const xh = V().crossVectors(yh, zh).normalize();
  const Fh = frame(J.w, xh, yh, zh);
  // Toward the thumb, across the palm.
  const lat = kn.clone().negate();

  const qf = new THREE.Quaternion().setFromRotationMatrix(Ff);
  const qh = new THREE.Quaternion().setFromRotationMatrix(Fh);
  // The hand's attitude to the forearm in the bind pose. Pronation is measured
  // from here, so a hand the chain holds as she was modelled twists nothing.
  const rel0Inv = qf.clone().invert().multiply(qh).invert();

  // The digits: for every bone, its head and the axes it turns on — all in
  // bind space, because a bone's local matrix is a rotation about its own
  // joint where that joint was, and the parent's skin matrix carries it from
  // there to wherever the hand has got to.
  const digits = [];
  for (let n = 0; n < 5; n++) {
    const bones = [];
    for (let k = 0; k < 3; k++) {
      const h = J.f[n][k], t = J.f[n][k + 1];
      const dir = V().subVectors(t, h).normalize();
      let flex;
      if (n === 0) {
        // The thumb's pad faces across the palm toward the index, not out of
        // it: the thumb sits most of a right angle round from the fingers. It
        // curls toward its pad.
        const pad = orth(V().copy(palm).addScaledVector(lat, -1), dir);
        flex = V().crossVectors(dir, pad).normalize();
      } else {
        // Toward the palm: rotating a bone about (bone x palm) carries it to
        // the palm, on either hand.
        flex = V().crossVectors(dir, palm).normalize();
      }
      bones.push({ h, dir, flex, len: h.distanceTo(t) });
    }
    // Which way is "apart" for this finger: away from the middle one.
    let fanSign = 0;
    if (n > 0 && n !== 2) {
      const sw = V().crossVectors(palm, bones[0].dir);
      fanSign = Math.sign(sw.dot(V().subVectors(J.f[n][0], J.f[2][0])));
    }
    digits.push({ bones, fanSign });
  }
  // The thumb's two swings at its root: in front of the palm (opposition,
  // turning the lateral side toward the palm) and away from the index.
  const opp = V().crossVectors(lat, palm).normalize();
  const abd = V().crossVectors(a, lat).normalize();

  // The pad of the thumb, in bind space: two thirds of the way down its last
  // bone and out on the pad side by its own radius. The part of a thumb that
  // touches a lip, found off the mesh rather than guessed: the vertex of that
  // bone that stands furthest out toward the pad at that station.
  const tb = digits[0].bones[2];
  const padDir = orth(V().copy(palm).addScaledVector(lat, -1), tb.dir);
  const station = V().copy(tb.h).addScaledVector(tb.dir, tb.len * 0.62);
  let best = -1e9, pad = station.clone();
  const pv = V();
  for (let i = 0; i < nv; i++) {
    if (blob.bidx[i * 4] !== 7 || blob.bwgt[i * 4] < 200) continue;
    pv.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const along = pv.clone().sub(tb.h).dot(tb.dir) - tb.len * 0.62;
    if (Math.abs(along) > 0.004) continue;
    const out = pv.clone().sub(station).dot(padDir);
    if (out > best) { best = out; pad.copy(pv); }
  }

  return {
    geo: g, J, Fu, Ff, Fh,
    FuInv: Fu.clone().invert(), FfInv: Ff.clone().invert(), FhInv: Fh.clone().invert(),
    rel0Inv, palm, lat, opp, abd, digits, pad,
    upper: J.s.distanceTo(J.e), fore: J.e.distanceTo(J.w),
  };
}

/**
 * Her skin, at forty centimetres, and her sleeve.
 *
 * The skin is the photograph — `chloe2_arm` is cut out of the same CC0 map she
 * wears, at twice the resolution of the copy on her body, because this is the
 * only place anybody is ever this close to it.
 *
 * The sleeve is the one on the mirror figure — the same three noise fields at
 * the same scales over the same bind-pose space, the same gates and the same
 * inks, see `sleeve` in 49-you.js — so the ink down your own forearm is the
 * ink in the mirror. (The hash under the noise is a steadier one, which draws
 * a different sleeve of the same kind; see `armHash`.) It stops at the wrist:
 * on the mirror figure it runs on to the knuckles, which at two metres is a
 * darker hand and at forty centimetres is camouflage over the fingers he
 * asked to be beautiful.
 *
 * Wet, in the water modes. Skin straight out of the sea carries a film of
 * water, and water is a dielectric with a strong Fresnel — nearly matte
 * face-on and close to a mirror at a grazing angle — which is why a wet arm
 * has a bright rim along its silhouette. `uWet` fades it out on dry land,
 * where the same rim on a hand in a dim cabin read as plastic.
 *
 * And nails that shine, which is the other half of a nail after its shape.
 */
const ARM_DECL = /* glsl */ `
  uniform sampler2D uSkin;
  uniform float uWet;
  uniform float uInk;
  uniform vec3 uWrist;
  uniform vec3 uForeDir;
  // NOT the sine hash the mirror figure uses. That one multiplies sin() of a
  // dot product in the tens of thousands by 43758, so a lattice corner hashed
  // from the cell on one side and from the cell on the other — the same
  // corner, but reached as i + 1 in one and as i in the next, which a compiler
  // is free to reassociate — comes out a different number. Every cell edge is
  // then a step, and at forty centimetres a sleeve of value noise came out as
  // a sleeve of little squares. This one is continuous in its input, so an
  // ulp in is an ulp out.
  float armHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float armNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec4 a = vec4(armHash(i), armHash(i + vec3(1.0, 0.0, 0.0)),
                  armHash(i + vec3(0.0, 1.0, 0.0)),
                  armHash(i + vec3(1.0, 1.0, 0.0)));
    vec4 b = vec4(armHash(i + vec3(0.0, 0.0, 1.0)),
                  armHash(i + vec3(1.0, 0.0, 1.0)),
                  armHash(i + vec3(0.0, 1.0, 1.0)),
                  armHash(i + vec3(1.0, 1.0, 1.0)));
    vec4 m = mix(a, b, f.z);
    vec2 n = mix(m.xz, m.yw, f.x);
    return mix(n.x, n.y, f.y);
  }
  float armFbm(vec3 p) {
    return 0.57 * armNoise(p)
         + 0.30 * armNoise(p * 2.13 + 11.7)
         + 0.13 * armNoise(p * 4.31 + 3.10);
  }
`;
const armSkinBody = () => /* glsl */ `
  base = texture2D(uSkin, vUv).rgb;
  float nail = vVCol.r;
  {
    float side = vLocal.z * ${YOU.right.toFixed(1)};
    float arm = smoothstep(0.180, 0.202, side)
      * smoothstep(0.900, 0.945, vLocal.y)
      * (1.0 - smoothstep(1.398, 1.452, vLocal.y));
    // Ending ragged rather than on a line, which read as a cuff.
    arm *= 1.0 - smoothstep(-0.050, -0.018,
      dot(vLocal - uWrist, uForeDir) - 0.030 * armFbm(vLocal * 55.0 + 2.1));
    if (arm > 0.002) {
      float f = armFbm(vLocal * 30.0);
      float g = armFbm(vLocal * 19.0 + 5.3);
      float h = armFbm(vLocal * 44.0 + 17.1);
      float ink = smoothstep(0.360, 0.520, f);
      float line = 1.0 - smoothstep(0.012, 0.032, abs(g - 0.520));
      float rose = smoothstep(0.600, 0.700, g)
        * smoothstep(0.400, 0.560, h);
      float leaf = smoothstep(0.560, 0.660, h) * (1.0 - rose);
      vec3 tat = vec3(${YOU.ink.map((n) => n.toFixed(3)).join(', ')});
      tat = mix(tat, vec3(${YOU.rose.map((n) => n.toFixed(3)).join(', ')}),
        rose * ink);
      tat = mix(tat, vec3(${YOU.leaf.map((n) => n.toFixed(3)).join(', ')}),
        leaf * ink);
      base *= mix(vec3(1.0), tat, arm * min(1.0, max(ink, line * 0.85)) * uInk);
    }
  }
  vec3 avd = normalize(vWorld - uCamPos);
  float afr = pow(1.0 - abs(dot(n, avd)), 3.2);
  spec = mix(spec, mix(0.09, 0.92, afr), uWet);
  base = mix(base, vec3(0.760, 0.335, 0.250), afr * 0.26 * uWet);
  spec = mix(spec, 0.30, nail);
  env = mix(spec, 0.16, nail);
`;
// A nail is a lacquer-smooth plate among skin that is not: a small, hard
// highlight on top of the skin's broad one.
const ARM_LIT = /* glsl */ `
  col += uSunColor * pow(max(dot(n, normalize(uSunDir - viewDir)), 0.0), 120.0)
    * vVCol.r * 0.45 * sh;
`;

/**
 * The arms you can see, and the cycle that moves them.
 *
 * `swim` is the object from 59-swim.js — this reads `you.stroke`, which is
 * already the phase of a stroke and is already wound down by how fast you are
 * actually going, so the cycle in here and the head lift in `pose()` are the
 * same cycle by construction rather than by two files agreeing.
 */
function buildArms() {
  // Their own scene and their own camera, which is the fourth thing this has
  // to get right and the one that decides whether it works at all.
  //
  // The world's near plane is 1.2 m. An arm is thirty centimetres from your
  // eye, so drawn in the world scene there is simply nothing there — every
  // triangle of it is in front of the clip and thrown away, which is exactly
  // what the first attempt looked like. And the near plane cannot come to
  // meet it: the note on `clipNear` in 90-app.js spells out the cost, and the
  // reason it is allowed indoors is that indoors the far end of the view is a
  // doorway. Out here the far end is the far end, four kilometres of town,
  // and pulling the near clip in tenfold to draw two arms would buy them with
  // a skyline that flickers.
  //
  // So the arms are a view model, in the sense every first-person game means
  // it: a second, tiny scene with a near plane of five centimetres and a far
  // plane of six metres, drawn over the finished frame with the depth buffer
  // cleared underneath it. What that costs is that the arms cannot be occluded
  // by the world, and at half a metre from your own face there is nothing to
  // occlude them with.
  const stage = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(58, 1, 0.05, 6);

  const root = new THREE.Group();
  root.visible = false;
  root.frustumCulled = false;
  stage.add(root);

  // The body, which is not the camera. See the note at the top.
  const body = new THREE.Group();
  root.add(body);

  // The chain: three groups a side, with nothing on them. They are where the
  // solve writes, and the skinned arm below reads them.
  const sides = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(ARMS.shoulder[0] * side, ARMS.shoulder[1], ARMS.shoulder[2]);
    body.add(shoulder);
    const elbow = new THREE.Group();
    elbow.position.set(0, -ARMS.upper, 0);
    shoulder.add(elbow);
    const wrist = new THREE.Group();
    wrist.position.set(0, -ARMS.fore, 0);
    elbow.add(wrist);
    sides.push({ side, shoulder, elbow, wrist, pose: handPose(), model: null, mesh: null,
      palette: null, tex: null, twist: 0, tipM: new THREE.Matrix4() });
  }

  // ── her arm, when it has decoded ──────────────────────────────────────────
  //
  // Asynchronous, because a gzip stream is; it lands a few frames after the
  // page does, and nothing has ever asked for a hand that early — the first
  // thing that does is a kabina or a kite, minutes in.
  const NB = 20;                         // bones a side; see BONES in hand_fp.py
  const armTex = v5Tex('chloe2_arm');
  const uWet = { value: 0 };
  // How dark the sleeve goes. The mirror figure lays it on at 0.93, which at
  // two metres is a dark arm with colour in it; a forearm filling a third of
  // the frame at that weight is a black one. `thumbAim({ ink })` to try others.
  const uInk = { value: 0.75 };
  let loaded = false;
  (async () => {
    const b64 = PAYLOAD.chloe2_arm_frhd;
    if (!b64) { console.warn('no chloe2_arm payload: no first-person arms'); return; }
    let blob;
    try {
      blob = readArmBlob(await inflateBinary(b64));
    } catch (e) {
      console.warn('arm blob failed:', e.message);
      return;
    }
    for (const a of sides) {
      const md = armModel(blob, a.side);
      a.model = md;
      a.palette = new Float32Array(NB * 12);
      a.tex = new THREE.DataTexture(a.palette, NB * 3, 1, THREE.RGBAFormat, THREE.FloatType);
      a.tex.minFilter = THREE.NearestFilter;
      a.tex.magFilter = THREE.NearestFilter;
      a.tex.generateMipmaps = false;
      a.tex.needsUpdate = true;
      const fd = new THREE.Vector3().subVectors(md.J.w, md.J.e).normalize();
      const mat = solidMaterial(new THREE.Color(1, 1, 1), {
        // Her body's own numbers — `loadSkin` in 49-you.js — so the arm and the
        // woman in the mirror are one material.
        spec: 0.09, specPower: 24,
        emissive: SKIN_EMISSIVE,
        defines: { FR_SKIN: '', FR_BONES: NB },
        uniforms: {
          uBones: { value: a.tex }, uBoneRows: { value: NB * 3 },
          uSkin: { value: armTex }, uWet, uInk,
          uWrist: { value: md.J.w.clone() }, uForeDir: { value: fd },
        },
        decl: ARM_DECL,
        body: armSkinBody(),
        lit: ARM_LIT,
      });
      a.mesh = new THREE.Mesh(md.geo, mat);
      a.mesh.frustumCulled = false;
      a.mesh.visible = false;
      root.add(a.mesh);
    }
    // Her humerus and forearm, so the chain is exactly the arm it carries.
    ARMS.upper = sides[1].model.upper;
    ARMS.fore = sides[1].model.fore;
    for (const a of sides) {
      a.elbow.position.y = -ARMS.upper;
      a.wrist.position.y = -ARMS.fore;
    }
    measureHand();
    loaded = true;
  })();

  // ── and the bar, for the other water mode ─────────────────────────────────
  //
  // 59-ride.js draws the kite and the long lines in the world, and it cannot
  // draw the near end of them: the front clip is at 1.2 m and a bar is two
  // thirds of a metre from your face, so everything from your hands up to
  // shoulder height is inside the clip and simply is not there. That left four
  // white lines starting in mid-air over the water, which reads as a fault
  // rather than as a rig.
  //
  // This scene is the answer, and it is already here for exactly this reason —
  // a five-centimetre near plane. So the bar, the last two metres of each
  // line, and the two hands holding it are drawn here, and the world's lines
  // carry on from where these stop. The join is well above the bar and behind
  // both hands, which is the one part of the frame nothing is looking at.
  const rig = new THREE.Group();
  rig.visible = false;
  rig.frustumCulled = false;
  root.add(rig);
  {
    const barMat = solidMaterial(new THREE.Color(0.10, 0.10, 0.12),
      { spec: 0.35, specPower: 50, vcol: false });
    const gripMat = solidMaterial(new THREE.Color(0.72, 0.16, 0.10),
      { spec: 0.22, specPower: 26, vcol: false });
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0135, 0.0135, ARMS.barW, 10, 1), barMat);
    bar.rotation.z = Math.PI / 2;
    rig.add(bar);
    // The grips, which are the only coloured part of a bar and the reason you
    // can tell at a glance which way up it is.
    for (const s2 of [-1, 1]) {
      const g = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0175, 0.0175, 0.125, 10, 1), gripMat);
      g.rotation.z = Math.PI / 2;
      g.position.x = s2 * ARMS.barW * 0.34;
      rig.add(g);
    }
    // The centre line running down out of the bar to the harness, which is the
    // part of a kite rig nobody draws and everybody has seen.
    const cl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.46, 5, 1),
      solidMaterial(new THREE.Color(0.80, 0.78, 0.72), { spec: 0.1, vcol: false }));
    cl.position.y = -0.23;
    rig.add(cl);
    for (const m of rig.children) m.frustumCulled = false;
  }

  const ease = (t) => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;

  // ── where the hand goes ───────────────────────────────────────────────────
  //
  // The note at the top of this file argued at some length that a stroke is a
  // cycle and not a target, and that angles were therefore the right way to
  // write one. The argument is fine and the conclusion was wrong, and it took
  // a screenshot to see why: what has to be right about a first-person arm is
  // not the arm, it is where the hand lands *in the picture*. A chain of Euler
  // angles hides that behind two compositions and a shoulder lift, so being
  // wrong about it is invisible from the code and fixing it is guesswork —
  // which is exactly how the old one ended up with a forearm lying across the
  // bottom of the frame with a hand on the inboard end of it, an arm that
  // looked, in the words of the report, screwed on backwards.
  //
  // A path does not hide it. The catch is at sixty-nine per cent across the
  // frame and sixty-two per cent down, and either it is or it is not; the
  // solve underneath is four lines of cosine rule and has one singular pose,
  // which is the straight arm, and a straight arm is the one thing a closed
  // form gets exactly right.
  //
  // Metres, in the eye's own frame — +x her right, +y up, −z the way she is
  // looking. x is in *side* units so one curve serves both arms.
  const SWIM_KEYS = [
    [0.115, -0.045, -0.335],   // the catch: ahead, inboard, hand just under
    [0.175, -0.115, -0.330],   // the front of the pull, still in shot
    [0.250, -0.250, -0.230],   // under the chest, going out of the bottom
    [0.290, -0.370, -0.035],   // the exit, at the hip and gone
    [0.360, -0.230,  0.030],   // out of the water, elbow leading
    [0.395, -0.045, -0.090],   // over the top, wide and high
    [0.200,  0.010, -0.290],   // reaching: back into shot, coming inboard
  ];
  // And what a hand does when there is no stroke in it. Not a hang: written as
  // arms-by-your-sides it was invisible, which is worse than not drawing them.
  // Treading water is elbows in, forearms out in front, palms moving — you can
  // see your own hands the whole time, and that is what makes floating read as
  // floating rather than as the camera having been let go of.
  const SCULL_KEYS = [
    [0.150, -0.115, -0.330],
    [0.235, -0.145, -0.300],
    [0.240, -0.190, -0.270],
    [0.155, -0.205, -0.295],
    [0.105, -0.170, -0.325],
    [0.110, -0.130, -0.340],
  ];
  const curveOf = (keys) => new THREE.CatmullRomCurve3(
    keys.map((k) => new THREE.Vector3(k[0], k[1], k[2])), true, 'catmullrom', 0.5);
  const strokePath = curveOf(SWIM_KEYS);
  const scullPath = curveOf(SCULL_KEYS);

  const _p1 = new THREE.Vector3();
  const _p2 = new THREE.Vector3();

  /** Where this hand is at phase `u`, with `amp` of a stroke in it. */
  function handAt(u, amp, out) {
    strokePath.getPoint(u, _p1);
    scullPath.getPoint(u, _p2);
    return out.set(mix(_p2.x, _p1.x, amp), mix(_p2.y, _p1.y, amp),
      mix(_p2.z, _p1.z, amp));
  }

  const _u = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _bx = new THREE.Vector3();
  const _by = new THREE.Vector3();
  const _bz = new THREE.Vector3();
  const _mm = new THREE.Matrix4();
  const _g = new THREE.Vector3();
  const _tw = new THREE.Vector3();
  const _qi = new THREE.Quaternion();
  const clamp1 = (v) => Math.min(1, Math.max(-1, v));

  /**
   * Put this arm's wrist at a point, with the elbow sent toward a hint.
   *
   * Two links and one closed form. The elbow angle is the cosine rule; the
   * upper arm is the line to the target tilted off it by the other cosine
   * rule, about an axis chosen so the elbow ends up where the hint asks —
   * which is the whole reason to do it this way. A high elbow is what
   * separates a crawl from a windmill and a dropped elbow is what makes a
   * kite bar look like it is being carried rather than held, and in both cases
   * it is one vector rather than a table of angles nobody can read.
   *
   * Everything is in the eye's frame. `pole` is a direction, not a point.
   */
  function reachWrist(a, tx, ty, tz, px, py, pz) {
    const S = ARMS.shoulder;
    _u.set(tx - S[0] * a.side - body.position.x,
      ty - S[1] - body.position.y,
      tz - S[2] - body.position.z);
    const raw = _u.length() || 1e-4;
    const L = ARMS.upper, F = ARMS.fore;
    // 0.998 rather than 1: a solve asked for exactly full reach lands on
    // acos(±1), where the derivative is infinite and a hand a millimetre too
    // far away snaps the elbow through straight.
    const d = Math.min(raw, (L + F) * 0.998);
    _u.multiplyScalar(1 / raw);
    const elb = Math.PI - Math.acos(clamp1((L * L + F * F - d * d) / (2 * L * F)));
    const back = Math.acos(clamp1(
      (L * L + d * d - F * F) / (2 * L * Math.max(d, 1e-4))));
    // The bend axis, perpendicular to both the reach and the hint. Cross this
    // way round and a positive `back` tilts the upper arm *toward* the hint,
    // which is what having a hint is for.
    _n.set(px, py, pz);
    _n.crossVectors(_u, _n);
    if (_n.lengthSq() < 1e-9) _n.set(a.side, 0, 0);
    _n.normalize();
    // A basis rather than three Euler angles, because the bone hangs down −Y
    // and bends about +X and this says exactly that: −Y is the upper arm, +X
    // is the axis the elbow turns on. Written as Eulers it was very nearly
    // right — the swing-out came through with its sign flipped, which on the
    // kite bar was two centimetres and invisible and in the water was an arm
    // that reached across the body instead of away from it.
    _by.copy(_u).applyAxisAngle(_n, back).negate();
    _bx.copy(_n);
    _bz.crossVectors(_bx, _by).normalize();
    _bx.crossVectors(_by, _bz).normalize();
    _mm.makeBasis(_bx, _by, _bz);
    a.shoulder.quaternion.setFromRotationMatrix(_mm);
    a.elbow.rotation.set(-elb, 0, 0);
  }

  /**
   * Turn the palm to face a direction.
   *
   * The chain shoulder → elbow → wrist bends in one plane and has no
   * pronation in it anywhere, so with the arm out in front the palm faces
   * wherever the shoulder happened to leave it and no amount of wrist bend
   * will turn it over. A real forearm rotates about its own axis, and that is
   * one number: a rotation about the wrist's Y, which is the forearm's axis.
   *
   * Solved rather than tabulated. The palm at zero twist faces the wrist's
   * +Z, so the answer is the wanted direction expressed in the forearm's own
   * frame, read off as an angle in its XZ plane. Order XZY so the twist is
   * innermost and the flex on top of it is a wrist bend rather than a second,
   * unwanted pronation.
   */
  function twistTo(a, nx, ny, nz, flex, acrossPalm) {
    _tw.set(nx, ny, nz).applyQuaternion(root.quaternion);
    a.elbow.getWorldQuaternion(_qi);
    _tw.applyQuaternion(_qi.invert());
    // Two ways to say the same one degree of freedom, and which one you pick
    // decides whether the answer is stable.
    //
    // A palm normal is the natural way to describe a paddle and a hopeless way
    // to describe a grip: gripping a bar, the direction the palm faces is
    // nearly along the forearm, and atan2 of a vector that is nearly all Y is
    // a number that swings wildly for a millimetre of nothing. That is what
    // the twisted wrists on the kite bar were. Across the palm — knuckle row
    // to knuckle row, the hand's own X — is the well-conditioned way to say
    // it, and it is also the true constraint: the bar goes *through* the fist,
    // so what has to line up with the bar is the tunnel, not the palm.
    a.wrist.rotation.set(flex, acrossPalm
      ? Math.atan2(-_tw.z, _tw.x)
      : Math.atan2(_tw.x, _tw.z), 0, 'XZY');
  }

  /**
   * Or turn the whole hand to face a way: `along` down the fingers, `palm` out
   * of the palm, both in the body's frame.
   *
   * `twistTo` has one degree of freedom, because on a lathe that was all a hand
   * had: which way the palm faces, with the hand carried straight on down the
   * forearm. A real hand also bends at the wrist, and a thumb to somebody's lip
   * is a bent wrist — without it the hand points wherever the forearm happens
   * to, which reaching up to a mouth is UP, and the knuckles came to rest in
   * front of her nose. This sets all three axes and leaves the forearm where
   * the solve put it; the skinning reads the bend and the pronation back off
   * the result, and `bendDeg` in the stats says how far the wrist went.
   */
  const _qw = new THREE.Quaternion();
  function orientTo(a, al, pn) {
    _by.set(-al[0], -al[1], -al[2]).normalize();
    _bz.set(pn[0], pn[1], pn[2]);
    _bz.addScaledVector(_by, -_bz.dot(_by)).normalize();
    _bx.crossVectors(_by, _bz).normalize();
    _mm.makeBasis(_bx, _by, _bz);
    _qw.setFromRotationMatrix(_mm).premultiply(root.quaternion);
    a.elbow.getWorldQuaternion(_qi);
    a.wrist.quaternion.copy(_qi.invert().multiply(_qw));
  }

  /**
   * Put a point *in the hand* on a point in the world, twice.
   *
   * The solve above places the wrist, and a wrist is not what holds anything:
   * the hand carries on for another nine centimetres past it, in a direction
   * that depends on the twist, which depends on the solve. So: aim the wrist
   * at the target, see where the palm actually landed, aim it at the target
   * minus that error, and do it again. Four passes, because the twist is
   * re-solved each time and the offset turns with it, so it converges rather
   * than lands: about a hand's length, then a centimetre, then two or three
   * millimetres. `missMm` in the probe is what is left.
   */
  function placeHand(a, tx, ty, tz, px, py, pz, ox, oy, oz, nx, ny, nz, flex,
    acrossPalm, along = null) {
    let cx = 0, cy = 0, cz = 0;
    for (let pass = 0; pass < 4; pass++) {
      reachWrist(a, tx + cx, ty + cy, tz + cz, px, py, pz);
      if (along) orientTo(a, along, [nx, ny, nz]);
      else twistTo(a, nx, ny, nz, flex, acrossPalm);
      _g.set(ox, oy, oz);
      // Fresh matrices first. `twistTo` refreshes the elbow and nothing below
      // it, so the wrist's world matrix here used to be the one left over from
      // the pass before — the error each pass corrected was the previous
      // pass's, which converges, slowly, to the right answer a frame late.
      a.wrist.updateWorldMatrix(true, false);
      a.wrist.localToWorld(_g);
      body.worldToLocal(_g);
      const ex = tx - (_g.x + body.position.x);
      const ey = ty - (_g.y + body.position.y);
      const ez = tz - (_g.z + body.position.z);
      // Reported, because a solve that quietly does not converge looks
      // exactly like a solve that is aiming at the wrong point, and the two
      // want opposite fixes.
      a.miss = Math.hypot(ex, ey, ez);
      if (pass === 3) break;
      cx += ex; cy += ey; cz += ez;
    }
  }

  /**
   * How loose the hand is at phase `u` — 0 a flat paddle, 1 a hand hanging.
   *
   * It lets go a little before the exit, because by then the hand is already
   * off the water and holding a paddle after the paddle has stopped working is
   * the glove again. Loosest with the elbow over the top. Gathered through the
   * last fifth so the fingertips lead the hand in, which is what the entry of
   * a crawl actually is — the hand goes in fingers first and the rest of the
   * arm follows it through the same hole.
   *
   * Zero at both ends with zero slope, so the seam at the catch is not a place
   * where anything visibly happens.
   */
  function grip(u) {
    const rise = ease(Math.min(1, Math.max(0, (u - 0.46) / 0.16)));
    const fall = ease(Math.min(1, Math.max(0, (u - 0.78) / 0.20)));
    return rise - fall;
  }

  const _e = new THREE.Euler();
  const _h1 = new THREE.Vector3();
  const _h2 = new THREE.Vector3();

  /**
   * Place and pose them.
   *
   * Called after `swim.pose(camera)` and before the render, because it takes
   * the camera's own transform apart: the position is the head, the yaw and
   * pitch are where you are looking, and the roll is the stroke, which belongs
   * to the head and not to the shoulders.
   */
  /**
   * Both hands on a bar.
   *
   * The whole pose is one constraint — the hands are at two fixed points in
   * front of you and the arms have to reach them — so it is the one pose in
   * the game that was always going to be a solve, and now that the swim is
   * one too they are the same four lines.
   *
   * `pull` is 0 for a bar held out at arm's length and 1 for a bar pulled in
   * to the hip, which is the whole of the power control and the reason you can
   * see how hard you are working without a gauge.
   */
  // How far forward the shoulders come for the bar. The swim's shoulder
  // offset is a *prone* one — behind the eye, because a swimmer's head is
  // ahead of their shoulders as well as above them — and on a board it is
  // exactly wrong.
  const RIDE_LEAN = 0.14;

  /** Shut the hand into a fist. Used to hold a bar and to find it. */
  function fistDigits(a) {
    setHandPose(a.pose, HAND_POSE.fist);
  }

  // ── the bones of the hand ─────────────────────────────────────────────────
  //
  // Every digit bone's local matrix is a rotation about its own joint, in bind
  // space, and its skin matrix is its parent's times that. So a finger is three
  // multiplications and never needs to know where the hand is.
  const _L = new THREE.Matrix4();
  const _R = new THREE.Matrix4();
  const _Rb = new THREE.Matrix4();
  const _Rc = new THREE.Matrix4();

  /** T(h) R T(-h), written in place: a rotation about a point. */
  function aboutPoint(out, R, h) {
    out.copy(R);
    const e = out.elements;
    e[12] = h.x - (e[0] * h.x + e[4] * h.y + e[8] * h.z);
    e[13] = h.y - (e[1] * h.x + e[5] * h.y + e[9] * h.z);
    e[14] = h.z - (e[2] * h.x + e[6] * h.y + e[10] * h.z);
    return out;
  }

  /** The local matrix of digit n (0 = thumb), bone k, under pose `ps`. */
  function digitLocal(md, ps, n, k, out) {
    const b = md.digits[n].bones[k];
    if (n === 0) {
      const t = ps.t;
      _R.makeRotationAxis(b.flex, t[2 + k]);
      if (k === 0) {
        // The thumb's root: in front of the palm, away from the index, then
        // its own curl. Applied to the bone in that order from the inside out.
        _Rb.makeRotationAxis(md.abd, t[1]);
        _Rc.makeRotationAxis(md.opp, t[0]);
        _R.premultiply(_Rb).premultiply(_Rc);
      }
    } else {
      _R.makeRotationAxis(b.flex, ps.f[n - 1][k]);
      if (k === 0 && md.digits[n].fanSign) {
        _Rb.makeRotationAxis(md.palm, ps.fan[n - 1] * FAN * md.digits[n].fanSign);
        _R.premultiply(_Rb);
      }
    }
    return aboutPoint(out, _R, b.h);
  }

  const _ri = new THREE.Matrix4();
  const _mE = new THREE.Matrix4();
  const _mH = new THREE.Matrix4();
  const _mX = new THREE.Matrix4();
  const _mT = new THREE.Matrix4();
  const _qa = new THREE.Quaternion();
  const _qb = new THREE.Quaternion();
  const _dig = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()];

  function putBone(a, i, M) {
    const e = M.elements, P = a.palette, o = i * 12;
    P[o] = e[0]; P[o + 1] = e[4]; P[o + 2] = e[8]; P[o + 3] = e[12];
    P[o + 4] = e[1]; P[o + 5] = e[5]; P[o + 6] = e[9]; P[o + 7] = e[13];
    P[o + 8] = e[2]; P[o + 9] = e[6]; P[o + 10] = e[10]; P[o + 11] = e[14];
  }

  /**
   * Read the chain and the pose into this arm's bone palette.
   *
   * PRONATION IS SHARED DOWN THE FOREARM. The chain turns the hand about the
   * forearm's axis at the wrist and nowhere else, which on a lathe was
   * invisible and on a real arm is a wrist wrung like a cloth: turn a hand
   * palm-down and every vertex of the forearm stays where it was while the
   * hand spins on the end of it. A forearm pronates along its whole length —
   * the radius crosses the ulna — so the twist is read back off the wrist
   * (swing and twist about the forearm's axis, relative to how the hand sat on
   * her in the bind pose) and handed out: none at the elbow, half half way,
   * all of it at the wrist, where the hand carries the same.
   */
  function skinArm(a) {
    const md = a.model;
    a.mesh.visible = a.shoulder.visible;
    if (!a.mesh.visible) return;
    a.wrist.updateWorldMatrix(true, false);
    _ri.copy(root.matrixWorld).invert();
    _mX.multiplyMatrices(_ri, a.shoulder.matrixWorld).multiply(md.FuInv);
    putBone(a, 0, _mX);
    _mE.multiplyMatrices(_ri, a.elbow.matrixWorld);
    _mH.multiplyMatrices(_ri, a.wrist.matrixWorld);
    _qa.setFromRotationMatrix(_mE).invert();
    _qb.setFromRotationMatrix(_mH);
    _qa.multiply(_qb).multiply(md.rel0Inv);
    let phi = 2 * Math.atan2(_qa.y, _qa.w);
    if (phi > Math.PI) phi -= Math.PI * 2;
    if (phi < -Math.PI) phi += Math.PI * 2;
    a.twist = phi;
    // How far the wrist is bent off the line of the forearm, for the stats.
    a.bend = 2 * Math.acos(Math.min(1, Math.hypot(_qa.w, _qa.y)));
    for (let k = 0; k < 3; k++) {
      _mT.makeRotationY(phi * k * 0.5);
      _mX.multiplyMatrices(_mE, _mT).multiply(md.FfInv);
      putBone(a, 1 + k, _mX);
    }
    _mH.multiply(md.FhInv);
    putBone(a, 4, _mH);
    for (let n = 0; n < 5; n++) {
      let par = _mH;
      for (let k = 0; k < 3; k++) {
        digitLocal(md, a.pose, n, k, _L);
        _dig[k].multiplyMatrices(par, _L);
        putBone(a, 5 + n * 3 + k, _dig[k]);
        par = _dig[k];
      }
      if (n === 2) a.tipM.copy(_dig[2]);
    }
    a.tex.needsUpdate = true;
  }

  /**
   * Where a bind-space point of the hand ends up under a pose, in the wrist
   * group's own frame — the frame `placeHand` aims in.
   */
  function handPoint(md, ps, n, k, p) {
    _mX.identity();
    for (let j = 0; j <= k; j++) {
      digitLocal(md, ps, n, j, _L);
      _mX.multiply(_L);
    }
    return p.clone().applyMatrix4(_mX).applyMatrix4(md.FhInv);
  }

  /**
   * Where the hole in a fist is, and where the pad of the thumb is, in the
   * wrist's own frame — measured, off her hand, in the pose each is used in.
   *
   * The hole: the middle of the loop the middle finger makes with the hand
   * shut — the mean of its four joints, knuckle to tip, which for a finger
   * curled most of the way round is the centre of the ring, and is where a
   * 27 mm bar goes. The first two attempts at this, years ago, were guesses —
   * five centimetres down the palm, then ten and a half — and both were wrong
   * the way a guess about a curled finger always is.
   *
   * The pad: the vertex of the last thumb bone that stands furthest out on the
   * pad side, two thirds of the way down it — see `armModel`. The pad and not
   * the tip, because the pad is the part of a thumb that touches a lip.
   */
  const GRIP_OFF = new THREE.Vector3();
  const THUMB_OFF = new THREE.Vector3();
  function measureHand() {
    const md = sides[1].model;
    const fist = handPose(HAND_POSE.fist);
    GRIP_OFF.copy(md.J.f[2][0]).applyMatrix4(md.FhInv);
    for (let k = 0; k < 3; k++) GRIP_OFF.add(handPoint(md, fist, 2, k, md.J.f[2][k + 1]));
    GRIP_OFF.multiplyScalar(0.25);
    THUMB_OFF.copy(handPoint(md, handPose(HAND_POSE.reach), 0, 2, md.pad));
    // And which way the thumb points, for `stats` — last joint to tip.
    THUMB_MID.copy(handPoint(md, handPose(HAND_POSE.reach), 0, 2, md.J.f[0][2]));
    THUMB_TIP.copy(handPoint(md, handPose(HAND_POSE.reach), 0, 2, md.J.f[0][3]));
    PALM_OFF.copy(md.J.w).applyMatrix4(md.FhInv)
      .lerp(md.J.f[2][0].clone().applyMatrix4(md.FhInv), 0.55);
  }
  const THUMB_MID = new THREE.Vector3();
  const THUMB_TIP = new THREE.Vector3();
  // The middle of the palm, for petting: a little over halfway from the wrist
  // to the middle finger's knuckle — measured off her hand like the rest.
  const PALM_OFF = new THREE.Vector3();

  // ── YOUR THUMB, TO HER MOUTH ──────────────────────────────────────────────
  //
  // Misha, 23 Sep 2026: *"in the kabine, and when her mouth is open, instead
  // of spraying with water, it should be my (chloe price)'s thumb reaching
  // for her open mouth and lips"*. The first arm this rig has ever had on dry
  // land, and it is the right one — the tattooed one — because it is the one
  // that reaches.
  //
  // THE HAND: thumb out, the rest of it let go. That is what a hand does when
  // the thumb is the only part of it that is going anywhere; an open hand with
  // a thumb on a lip reads as a slap about to happen, and a fist with a thumb
  // out reads as a fist. See `HAND_POSE.reach`.
  function thumbDigits(a) {
    setHandPose(a.pose, HAND_POSE.reach);
  }

  const _tt = new THREE.Vector3();
  const THUMB_REST = new THREE.Vector3(0.24, -0.46, -0.20);   // low, right, out of shot
  const THUMB_REACH = 0.44;       // m of shoulder-to-target it will do without leaning
  // 0.35 and not the 0.70 it was: with her bent over the stool, a lean that big
  // brought your own shoulder into the bottom corner of the frame as a pale
  // blob. The walk-in (THUMB_STAND in 90-app.js) closes the rest instead.
  const THUMB_LEAN = 0.35;        // and how far the body may lean in to close the rest
  const PET_LEAN = 0.55;          // and for petting, where you are bending over her
  // The hand's attitude at her mouth: elbow pole, the way the fingers point,
  // and the way the palm faces — all in the body's frame, +x right, +y up,
  // −z toward her. A table rather than literals so a probe can try several and
  // look (`__fr.arms.thumbAim`), which is the only way anybody has ever got a
  // first-person hand right.
  //
  // Picked from twenty-odd tried against her open mouth on 24 Sep 2026, the
  // day the hand became hers. Elbow low, forearm rising to her from the bottom
  // right; the hand carried on nearly level and turned palm-down, so the thumb
  // comes in across her lower lip with its pad on it and the loosely curled
  // fingers hang below her mouth instead of across her face. The wrist is 35
  // degrees off the forearm and the forearm pronated a quarter of that again —
  // a hand anybody could hold. Two runners-up, kept here because they are
  // real alternatives rather than failures: palm toward you with the thumb
  // rising to the lip from under her chin ({along [−0.9, −0.2, −0.35], palm
  // [0.1, 0.1, 1]}), and the same palm-down hand with the wrist let droop
  // ({along [−0.4, −0.5, −0.75], palm [−0.2, −0.7, 0.65]}) — tender, but a
  // limp wrist at 62 degrees.
  //
  // That was the thumb ON her lip. Since 24 Sep it goes IN — *"it needs to be
  // in her mouth, with the other fingers more clenched"* — and the hand that
  // does that is a different one: the fist below her chin, knuckles up and
  // forward, palm turned in to the left, so the thumb rises from it straight
  // into her mouth between her lips. Picked from twenty-odd attitudes by
  // which way the thumb actually points against the way her face does (0.44
  // of the way from across-the-mouth to dead into it, the rest being that it
  // comes up from below, as a thumb does), with the wrist 35 degrees off and
  // the forearm barely turned. The palm-down hand above put the thumb across
  // her mouth from the side, into her cheek.
  const THUMB_AIM = { pole: [0.40, -0.90, 0.00], along: [0.0, 0.70, -0.70],
    palm: [-1.0, 0.0, 0.0], flex: 0.10 };
  // And the hand on her head: fingers pointing away from you over the top of
  // it and tipped down its far side, palm down on her hair, the elbow out.
  // And the hand on her breast: fingers up and a little in, palm toward her.
  // And on her hip: fingers down and round the curve of it, palm in on her.
  // And on the inner face of her thigh — always the leg on your right, see the
  // gate in 90-app.js — so the palm faces right, on to it, fingers down.
  const THIGH_AIM = { pole: [0.60, -0.75, 0.20], along: [-0.05, -0.95, -0.30],
    palm: [0.45, 0.0, -0.89], flex: 0.10 };
  const HIP_AIM = { pole: [0.60, -0.75, 0.20], along: [0.10, -0.90, -0.40],
    palm: [-0.70, 0.0, -0.70], flex: 0.10 };
  const CUP_AIM = { pole: [0.55, -0.80, 0.10], along: [-0.20, 0.95, -0.10],
    palm: [0.0, 0.0, -1.0], flex: 0.10 };
  const PET_AIM = { pole: [0.55, -0.80, 0.10], along: [-0.15, -0.30, -0.94],
    palm: [0.0, -1.0, 0.0], flex: 0.10 };

  /**
   * `reach` is {x, y, z, k} — her lip in world metres, and 0..1 of the way
   * there. At 0 the hand is down out of shot; the caller eases `k`.
   */
  function updateReach(dt, reach, camera) {
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.position.copy(camera.position);
    cam.quaternion.copy(camera.quaternion);
    cam.updateProjectionMatrix();
    rig.visible = false;
    root.position.copy(camera.position);
    // Yaw and pitch with the head, no roll: you are looking at her mouth and
    // the arm goes where you look.
    _e.setFromQuaternion(camera.quaternion, 'YXZ');
    _e.z = 0;
    root.quaternion.setFromEuler(_e);
    root.updateMatrixWorld(true);

    sides[0].shoulder.visible = false;
    const a = sides[1];
    a.shoulder.visible = true;
    // The thumb, or the flat of the hand on her head — `kind` says which.
    const pet = reach.kind === 'pet', cup = reach.kind === 'cup';
    const thigh = reach.kind === 'thigh', hip = reach.kind === 'hip' || thigh;
    if (pet) setHandPose(a.pose, HAND_POSE.pet);
    else if (cup || hip) setHandPose(a.pose, HAND_POSE.cup);
    else thumbDigits(a);

    _tt.set(reach.x, reach.y, reach.z);
    root.worldToLocal(_tt);
    const k = ease(Math.min(1, Math.max(0, reach.k)));
    _tt.lerpVectors(THUMB_REST, _tt, k);

    // Lean in. The shoulder is 24 cm under the eye and 15 cm behind it, and a
    // mouth at arm's length from the EYE is out of reach from the SHOULDER —
    // so the body comes forward along the line to her by whatever the arm
    // cannot close, the way anybody leans in to touch a face. The shoulder is
    // never in shot, so nothing sees it move.
    const S = ARMS.shoulder;
    _p1.set(_tt.x - S[0], _tt.y - S[1], _tt.z - S[2]);
    const need = _p1.length() - THUMB_REACH;
    // Petting a head below you, you bend over it: more lean than a thumb gets.
    // And bending right down for her thigh, which is a metre below your eye.
    const lean = thigh ? 0.95 : pet || hip ? PET_LEAN : THUMB_LEAN;
    if (need > 0) body.position.copy(_p1.normalize().multiplyScalar(Math.min(need, lean)));
    else body.position.set(0, 0, 0);

    // Elbow down and out to the right; palm down, so the thumb pad comes to
    // the lip from in front with the fingers curled under her chin.
    const AIM = pet ? PET_AIM : cup ? CUP_AIM : thigh ? THIGH_AIM : hip ? HIP_AIM : THUMB_AIM;
    const OFF = pet || cup || hip ? PALM_OFF : THUMB_OFF;
    let P = AIM.pole, N = AIM.palm, G = AIM.along || null;
    // A hand laid ON her — breast, hip, thigh — is laid in the room's upright
    // frame, not in your view's: the rig hangs off your eye and pitches with
    // it, so looking down at her tipped a palm meant to face her chest into
    // it, fingers first. Undo the pitch for those.
    if (cup || hip) {
      const c = Math.cos(-_e.x), sn = Math.sin(-_e.x);
      const un = (v) => [v[0], v[1] * c - v[2] * sn, v[1] * sn + v[2] * c];
      P = un(P); N = un(N); if (G) G = un(G);
    }
    placeHand(a, _tt.x, _tt.y, _tt.z, P[0], P[1], P[2],
      OFF.x, OFF.y, OFF.z, N[0], N[1], N[2], AIM.flex, false, G);
  }

  function barPose(a, pull, t) {
    // The grips, in the eye's frame. Same three numbers `updateRide` puts the
    // bar at, so the hands cannot drift off it however the bar is sheeted.
    const tx = a.side * (ARMS.barW * 0.34);
    const ty = ARMS.barAt[1] + 0.055 * pull;
    const tz = ARMS.barAt[2] + 0.12 * pull + Math.sin(t * 1.7 + a.side) * 0.008;
    // Elbows down and outboard, which is where a rider's are: hanging off a
    // bar with your elbows up is a chin-up, not a kite.
    //
    // The point in the hand that has to land on the bar is the *hole* a fist
    // makes — past the knuckle row and on to the palmar side where the curled
    // fingers close over, measured off her hand in `measureHand`. Not the
    // wrist, which is what the first pass aimed at
    // and is why both hands sat a palm's width beyond the bar; and not the
    // middle of the palm either, which is what the second aimed at and put the
    // bar across the wrist with the fist above it holding nothing.
    //
    // And the palm faces down and back toward you, because that is an overhand
    // grip and an overhand grip is the only one anybody uses on a bar.
    // The fingers shut first, because the solve below aims the *hole* they
    // make at the bar and there is no hole in an open hand.
    fistDigits(a);
    // Across the palm, along the bar: the tunnel a fist makes is what the bar
    // goes through, so that is the axis to line up. Both hands the same way —
    // the two hands are mirrored, so her right thumb and her left thumb both
    // end up pointing in toward the middle of the bar, which is the grip
    // everybody actually uses.
    placeHand(a, tx, ty, tz,
      0.52 * a.side, -0.82, 0.24,
      GRIP_OFF.x, GRIP_OFF.y, GRIP_OFF.z,
      1, 0, 0,
      0.10 + 0.14 * pull, true);
  }

  /**
   * `ctx` is whichever water mode is running. Both of them are two arms in
   * front of a camera and nothing else in the game is, so they share the
   * scene, the material, the geometry and the draw — and differ only in what
   * the joints are told.
   */
  function update(dt, ctx, camera) {
    poseArms(dt, ctx, camera);
    if (!loaded) {
      root.visible = false;
      return;
    }
    // Wet in the water modes, dry in the kabina. See ARM_DECL.
    uWet.value = ctx && ctx.reach ? 0 : 1;
    if (root.visible) for (const a of sides) skinArm(a);
  }

  function poseArms(dt, ctx, camera) {
    const swim = ctx && ctx.active && ctx.you && ctx.you.stroke !== undefined
      ? ctx : null;
    const ride = ctx && ctx.active && !swim ? ctx : null;
    // Not in the water. Everything below this line still works and none of it
    // runs there any more.
    //
    // The verdict on the swim arms was that they were not working and were not
    // going to, and it is worth being precise about what that means, because
    // the code is staying: the *stroke* was the problem and not the arm. A
    // crawl seen from inside your own head is two limbs crossing most of the
    // frame twice a second, and at a 58-degree lens there is no version of
    // that which does not read as flailing — the closer it gets to a real
    // crawl the busier it looks, which is the opposite of how animation
    // usually goes. What replaces it is what you actually notice in the sea,
    // which is not your arms: it is the mask, and it is the bubbles. See
    // 62-mask.js.
    //
    // The bar grip is untouched. Hands on a kite bar are the same rig doing
    // the thing a first-person view is good at — holding still — and nobody
    // complained about those.
    // The thumb, on land. Checked first: it is handed a context of its own and
    // is never also a swim or a ride.
    reaching = !!(ctx && ctx.reach);
    if (ctx && ctx.reach) {
      root.visible = true;
      return updateReach(dt, ctx.reach, camera);
    }
    sides[0].shoulder.visible = true;
    sides[1].shoulder.visible = true;
    const on = !!ride;
    root.visible = on;
    rig.visible = !!ride;
    if (!on) return;
    if (ride) return updateRide(dt, ride, camera);

    // The view-model camera is the real one, minus its reach. Copied every
    // frame rather than shared, because the field of view is a control here —
    // Z is a lens — and arms that did not zoom with the rest of the picture
    // would be the one thing on screen that was not moving.
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.position.copy(camera.position);
    cam.quaternion.copy(camera.quaternion);
    cam.updateProjectionMatrix();

    const you = swim.you;
    body.position.set(0, 0, 0);
    root.position.copy(camera.position);
    // Yaw, and half the pitch. No roll: a prone swimmer's shoulders follow the
    // head down when it looks down — that is what makes a duck-dive read, and
    // it is also what lets you look down and watch your own stroke — but they
    // do not tip with it, and taking the roll out here is why the arms swing
    // under a horizon that is tipping rather than with it.
    _e.set(you.pitch * ARMS.follow, you.yaw, 0, 'YXZ');
    root.quaternion.setFromEuler(_e);

    // How much of a stroke there is. Sculling when you are still, nothing at
    // all when the air has run out and the jacket has the controls.
    const sp = Math.min(1, Math.hypot(you.vx, you.vz) / SWIM.cruise);
    const amp = you.spent ? 0 : ARMS.idle + (1 - ARMS.idle) * sp;

    for (const a of sides) {
      // Half a cycle apart, which is what alternating means.
      const u = (((you.stroke / (Math.PI * 2)) + (a.side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
      handAt(u, amp, _h1);
      // Which way the palm faces, and it is not a number in a table: through
      // the pull a hand is a paddle and faces the way the water has to go,
      // which is straight back down its own track, so the normal is the
      // direction it is travelling, backwards. Read off the path itself, so a
      // change to the stroke cannot leave the hands facing the old one.
      handAt((u + 0.02) % 1, amp, _h2);
      _h2.sub(_h1);
      if (_h2.lengthSq() < 1e-10) _h2.set(0, 0, -1);
      _h2.normalize().multiplyScalar(-1);
      // On the recovery it turns over and faces down and outboard, which is
      // what lets the arm come over the top edge-on instead of dragging a
      // plate through the air.
      const paddle = 1
        - ease(Math.min(1, Math.max(0, (u - 0.50) / 0.18)))
        + ease(Math.min(1, Math.max(0, (u - 0.95) / 0.05)));
      // Off the paddle it faces down and a little forward, which is the hand
      // going in fingertips first through its own hole — the one part of a
      // crawl anybody can see the point of from the inside, and the reason
      // the entry does not look like a slap.
      const nx = mix(0.32, _h2.x, paddle);
      const ny = mix(-0.88, _h2.y, paddle);
      const nz = mix(-0.35, _h2.z, paddle);
      // Elbow high and outboard of the line from shoulder to hand. One vector,
      // and it is the whole of the high-elbow catch.
      placeHand(a, _h1.x * a.side, _h1.y, _h1.z,
        0.78 * a.side, 0.58, 0.24,
        0.0, -0.050, 0.006,
        nx * a.side, ny, nz,
        0.14 - 0.30 * paddle);

      // And the hand on the end of it.
      //
      // Staggered, because four fingers that curl on the same frame are one
      // paddle with lines drawn on it — which is exactly what the welded
      // version looked like and exactly the complaint it earned. Each finger
      // lags the one before by about a hundredth of a cycle, and the little
      // finger travels a fifth further than the index, because a hand letting
      // go does not let go all at once or evenly.
      const ps = a.pose;
      for (let n = 0; n < 5; n++) {
        const thumb = n === 0;
        const i = n - 1;
        const lag = thumb ? 0.03 : i * 0.012;
        // The scull is what is left when there is no stroke: a floating hand
        // is never still, it opens and closes very slightly the whole time,
        // and a still one reads as a prop somebody is holding.
        const g = amp * grip(((u - lag) % 1 + 1) % 1)
          + (1 - amp) * (0.42 + 0.14 * Math.sin(u * Math.PI * 2 - Math.max(i, 0) * 0.6));
        const F = HAND_POSE.flat, O = HAND_POSE.loose;
        if (thumb) {
          for (let k = 0; k < 5; k++) ps.t[k] = mix(F.t[k], O.t[k], g);
        } else {
          const k1 = 0.90 + 0.08 * i;
          for (let k = 0; k < 3; k++) ps.f[i][k] = mix(F.f[i][k], O.f[i][k], g) * k1;
          // Together for the paddle — really together: a crawl's fingers
          // touch, and the version that kept a quarter of the fan in at the
          // catch came out as a starfish going past the lens.
          ps.fan[i] = mix(F.fan[i], O.fan[i], g);
        }
      }
    }
  }

  /**
   * The same two arms, on a bar instead of in a stroke.
   *
   * The body does not roll here and the camera does — you counter-lean against
   * the pull and your head stays a good deal squarer to the horizon than the
   * board is — so this takes the heel back out of the shoulders exactly the
   * way the swim takes the stroke roll out, and for the same reason.
   */
  function updateRide(dt, ride, camera) {
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.position.copy(camera.position);
    cam.quaternion.copy(camera.quaternion);
    cam.updateProjectionMatrix();

    const you = ride.you;
    root.position.copy(camera.position);
    // Yaw with the board and not with the head: turn to look at your kite and
    // your arms stay on the bar, which is the entire point of the mode having
    // a separate look in the first place.
    // Yaw only. The camera already rolls with the edge — see `pose` in
    // 59-ride.js — and rolling the shoulders as well rolled the bar twice, so
    // it came out across the frame at twenty-five degrees instead of the nine
    // the lean actually accounts for.
    _e.set(0, you.yaw, 0, 'YXZ');
    root.quaternion.setFromEuler(_e);
    body.position.set(0, 0, -RIDE_LEAN);

    rig.position.set(ARMS.barAt[0], ARMS.barAt[1] + 0.055 * you.pull,
      ARMS.barAt[2] + 0.12 * you.pull);
    rig.rotation.set(-0.24, 0, 0);

    const pull = you.pull;
    for (const a of sides) barPose(a, pull, you.t);
  }

  /**
   * Draw them, over the frame that has already been drawn.
   *
   * `autoClear` off and then back on: the whole point of this pass is that it
   * keeps the colour buffer and throws away the depth, and a renderer left
   * with autoClear off would wipe nothing on the *next* frame either.
   */
  //
  // `occ`, if given while the thumb is out, is her: drawn into this pass's
  // depth only, before the arm, so that a thumb in her mouth is IN it — behind
  // her upper lip and teeth — and her hands, when she raises them, in front
  // of yours. Otherwise the arm is on top of everything, and a thumb aimed
  // between her teeth would be drawn across her lips. Every material under
  // her is set not to write colour for the one draw and put back after.
  let reaching = false;
  const _occM = [];
  function render(renderer, occ) {
    if (!root.visible) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    if (occ && reaching) {
      _occM.length = 0;
      occ.traverseVisible((o) => {
        if (o.material && o.material.colorWrite) { o.material.colorWrite = false; _occM.push(o.material); }
      });
      renderer.render(occ, cam);
      for (const m of _occM) m.colorWrite = true;
    }
    renderer.render(stage, cam);
    renderer.autoClear = auto;
  }

  return {
    root, stage, cam,
    update, render,
    /**
     * Your right forearm in world metres — a point a third of the way from
     * wrist to elbow, where a hand would take hold of it — or null when the
     * arm is not out. For her hand on yours; see `gripArm` in 43-jadrija.js.
     */
    forearmAt: (out) => {
      const a = sides[1];
      if (!root.visible || !a.shoulder.visible) return null;
      const w = a.wrist.getWorldPosition(new THREE.Vector3());
      const e = a.elbow.getWorldPosition(new THREE.Vector3());
      return out.copy(w).lerp(e, 0.30);
    },
    /** Debug: try a hand attitude on her hip — see HIP_AIM. */
    hipAim: (o) => Object.assign(HIP_AIM, o || {}),
    /** Debug: try a hand attitude on her breast — see CUP_AIM. */
    cupAim: (o) => {
      const { pose, ...aim } = o || {};
      Object.assign(CUP_AIM, aim);
      if (pose) Object.assign(HAND_POSE.cup, pose);
      return CUP_AIM;
    },
    /** Debug: try a hand attitude for petting — see PET_AIM. */
    petAim: (o) => {
      const { pose, ...aim } = o || {};
      Object.assign(PET_AIM, aim);
      if (pose) Object.assign(HAND_POSE.pet, pose);
      return PET_AIM;
    },
    /** Debug: try a hand attitude for the thumb — see THUMB_AIM. */
    thumbAim: (o) => {
      const { pose, ink, ...aim } = o || {};
      if (ink !== undefined) uInk.value = ink;
      Object.assign(THUMB_AIM, aim);
      // A new hand shape moves the pad, so the pad is measured again.
      if (pose) {
        Object.assign(HAND_POSE.reach, pose);
        if (loaded) measureHand();
      }
      return THUMB_AIM;
    },
    stats: () => ({
      on: root.visible ? 1 : 0,
      mode: rig.visible ? 'bar' : (root.visible
        ? (sides[0].shoulder.visible ? 'swim' : 'thumb') : 'off'),
      // Her arm: twenty bones a side, and whether it has decoded.
      model: loaded ? 'mh' : 'loading',
      pieces: loaded ? sides.length * 20 : 0,
      tris: loaded ? sides[1].model.geo.index.count / 3 : 0,
      // How far the near hand's index knuckle is curled, radians. The one
      // number worth watching when a grip is wrong.
      grip: +sides[0].pose.f[0][0].toFixed(3),
      // Pronation carried down the right forearm, degrees — past about a
      // hundred the forearm is being wrung and the solve wants another aim.
      twistDeg: Math.round(sides[1].twist * 180 / Math.PI),
      bendDeg: Math.round((sides[1].bend || 0) * 180 / Math.PI),
      // The two measured points, mm in the wrist's frame.
      thumbOff: THUMB_OFF.toArray().map((v) => Math.round(v * 1000)),
      // Which way the thumb points, world, unit — against her face's forward
      // this says whether it goes INTO her mouth or across it.
      thumbDir: (() => {
        const w = sides[1].wrist;
        w.updateWorldMatrix(true, false);
        const t = w.localToWorld(THUMB_TIP.clone()), m = w.localToWorld(THUMB_MID.clone());
        return t.sub(m).normalize().toArray().map((v) => +v.toFixed(3));
      })(),
      gripOff: GRIP_OFF.toArray().map((v) => Math.round(v * 1000)),
    }),
    /**
     * Where the hands actually are *in the frame*, per cent across and down.
     *
     * The one number that decides whether a first-person arm works, and until
     * this existed the only way to read it was to take a screenshot and look.
     * A catch belongs somewhere near [69, 62] on the near side; a hand at
     * [104, 91] is out of shot and a hand at [50, 50] is in your face.
     */
    probe: () => sides.map((a) => {
      const pt = (o) => {
        const v = o.getWorldPosition(new THREE.Vector3()).project(cam);
        return [+((v.x * 0.5 + 0.5) * 100).toFixed(1),
          +((0.5 - v.y * 0.5) * 100).toFixed(1)];
      };
      return {
        side: a.side,
        wrist: pt(a.wrist),
        // The middle fingertip, off the skinned bone rather than a group.
        tip: pt({ getWorldPosition: (v) => (a.model
          ? v.copy(a.model.J.f[2][3]).applyMatrix4(a.tipM).applyMatrix4(root.matrixWorld)
          : a.wrist.getWorldPosition(v)) }),
        elbow: pt(a.elbow),
        // Millimetres between where the hand was asked to hold and where it
        // actually does. Under about three is a hand on a bar.
        missMm: Math.round((a.miss || 0) * 1000),
      };
    }),
  };
}
