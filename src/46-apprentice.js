// ---------------------------------------------------------------------------
// Baye v2.0 — the textured figure, walking a couple of paces behind v1.0.
//
// ── what she is ────────────────────────────────────────────────────────────
//
// The same skeleton, the same bind pose and the same forty-nine clips as the
// woman on the terrace: `tools/blender/baye2.py` builds her through the same
// `armature()` and the same `skin()` that `human_mh.py` uses, so the two blobs
// carry bone-for-bone identical rigs. What is different is one thing. v1.0
// paints a person with GEOMETRY — subdivided, decimated to 26 000 triangles,
// coloured by a few dozen hand-placed cutters, carrying no UVs at all. v2.0
// keeps the base mesh's own topology and its own UV layout and puts a
// photographic skin on it, with a hairstyle, eyebrows, eyelashes and a fishnet
// that were modelled by people who model those things.
//
// ── why she is an apprentice and not a replacement ─────────────────────────
//
// Because nobody has watched her do the other forty-seven clips yet. v1.0 can
// be told what to do, can hold a straw, can cartwheel down a promenade and put
// her feet on the concrete each time; all of that is years of work that lives
// in `43-jadrija.js` and none of it has been asked of this mesh. So she
// shadows: she stands off the leader's shoulder and does whatever the leader
// has just started doing, and anything that goes wrong with her goes wrong
// where it can be seen and next to a known-good version of the same movement.
//
// SHE WEARS THE LEADER'S POSE, NOT HER CLIP. The first version copied the
// clip by name, and Misha found the hole in it in one sentence: *"when i said
// 'spread your arms', only baye v1.0 did"*. Arms held wide, a straw at a
// nostril, a head turned to you — half of what the leader does is `aim`s
// solved on to her after the clip, and a copy that listens for clip names
// cannot see any of it. The two rigs are the same rig, so the leader's
// finished palette is copied instead, bone for bone. See `wearPose` in
// 41-skin.js.
//
// The lag is the whole trick. Copying the leader on the same frame makes two
// dancers in lockstep, which reads as one figure drawn twice; a third of a
// second behind reads as somebody following along. The position is lagged
// through the same ring buffer for the same reason — she walks where the
// leader walked rather than beside her on a rail.
// ---------------------------------------------------------------------------

/** How far behind, in seconds, and how far off the leader's shoulder. */
/**
 * WHICH BAYE IS DRAWN. Misha, 23 Sep 2026: *"i think we are ready to 'park'
 * baye v1.0 and have baye v2.0 be the main one. can u 'stash away' baye
 * v1.0 if we ever need to recover her but now baye v2.0 becomes the primary
 * one"*.
 *
 * 'v2': v1.0 still runs — every routine, command, voice line, lip, straw
 * and cartwheel is written against `skinFig`, and all of it goes on — but
 * her own surface is not drawn (`material.visible`, NOT `mesh.visible`: the
 * things in her hands and the firestarter's horns are children of her mesh
 * and have to go on being drawn, now on v2.0's head) and casts no shadow.
 * v2.0 wears her finished pose on the same frame in the same place — see
 * `APPR.primary` in 46-apprentice.js.
 *
 * 'v1': the figure that shipped before, with v2.0 back as her apprentice.
 */
const BAYE = { primary: 'v2' };
// At module scope rather than inside `buildJadrija`, because the figure load
// reads it long before that function's body gets as far as its PARKED table —
// declared there, it was in its temporal dead zone at the one moment it was
// needed and the whole resort failed to build.

const APPR = {
  // How far behind the front of her teeth your thumb pad goes — see
  // `apprenticeLipBind`. Metres.
  thumbIn: 0.014,
  // Where a hand on her hip goes: the band of her height, metres.
  hipY: [0.96, 1.04], hipZ: 0.175,
  // Her inner thigh: the band the hand arrives in — the top of the stroke,
  // well short of the top of her legs — and the band it strokes down to.
  thighY: [0.67, 0.72], thighLo: [0.53, 0.58],
  // Petting her: how far each way along her head the stroke goes, how far
  // the palm rides above the top of her hair (half a hand's thickness), how
  // much the round of her head drops at the ends of the stroke, and how far
  // her eyes close while it happens. Metres, and 0..1 of a blink.
  petStroke: 0.045, petAbove: 0.016, petRound: 0.012, petLid: 0.18, buzzLid: 0.92,
  // True when v2.0 is THE figure rather than an apprentice — set by BAYE in
  // 43-jadrija.js. See the note in `apprStepBody`.
  primary: false,
  lag: 0.34,              // s of delay on both the clip and the path
  side: 1.15,             // m to the leader's left, in the leader's own frame
  back: 1.30,             // m behind her — outdoors; indoors see APPR_ROOM
  // Hair, brows and lashes are dark keratin, not black paint. The sheen is
  // what separates the two and it is the one thing the assets cannot carry,
  // because they ship with no texture at all — `diffuseColor 0 0 0` and
  // `backfaceCull False` is the whole of their material.
  hairCol: 0x6b4f3c,
  browCol: 0x2a1f18,
};

// ── indoors ─────────────────────────────────────────────────────────────────
//
// Where she may stand relative to the leader when they are both in the
// kabina, as (back, side) in the leader's own frame, best first. Tried in
// order against the WHOLE of the pose she is about to wear — see
// `kabinaFit` in 43-jadrija.js — and the first one her whole body fits at is
// where she goes.
//
// CLOSE, AND THIS IS MISHA'S CALL. *"because she keeps her distance slightly
// from baye v1.0 she 'falls out' of the range of the kabine sometimes...
// maybe if she would be a bit closer to baye v1.0 everything would be ok."*
// The 1.75 m this replaces was measured to put her outside the room for 97%
// of a minute of it; 0.80 m straight behind is one step of queue, and the
// first alternatives are half a metre either side of that before anything
// reaches further out.
const APPR_ROOM = [
  [0.80, 0.00], [0.60, 0.55], [0.60, -0.55], [0.00, 0.80], [0.00, -0.80],
  [1.10, 0.00], [0.95, 0.70], [0.95, -0.70], [0.00, 1.15], [0.00, -1.15],
  [-0.40, 0.90], [-0.40, -0.90], [0.00, 1.50], [0.00, -1.50], [1.50, 0.00],
  // And further out, for when the leader is lying down and is a metre and
  // three quarters long: beside her on the floor rather than along her.
  [0.00, 1.90], [0.00, -1.90], [1.90, 0.00], [0.90, 1.40], [0.90, -1.40],
  // And in FRONT of her, last, for a leader who has knelt in a corner with
  // her back to two walls — measured, `submit` in the front corner by the
  // door left nowhere behind or beside her that a whole body fitted.
  [-1.00, 0.00], [-0.90, 0.65], [-0.90, -0.65],
];

let appr = null;                 // the figure
// THE RING CARRIES WHOLE POSES. One slot a frame: when it was taken, where the
// leader stood and faced, what she was lifted by (the cot), and the palette,
// world rotations and world positions of every bone she was drawn with. A
// slot is `6 + 19 * bones` floats; see `apprSlot`.
let apprRing = null;
let apprStride = 0, apprRingN = 0;
let apprHead = 0, apprN = 0, apprClock = 0;
let apprClip = null;             // what the leader was last seen playing
let apprEye = null;              // her iris and blink uniforms
let apprJaw = null;              // her jaw uniforms — see v5Parts
let apprHang = null;             // which way is down, for her hair
let apprGape = null;             // the leader's mouth, per ring slot
let apprLeadFace = null;         // the leader's face, for the stats readout
let apprCalls = 0;               // frames apprenticeStep has run (diagnostic)
// Whether the two rigs are the same rig, decided once against the first
// leader she is handed. Null until then. If they ever are not, she falls back
// to copying clip names, which is what she did before and is still better
// than wearing a palette built for different bones.
let apprSame = null;
let apprMode = 'none';           // 'out', 'door', 'room', 'squeeze' — diagnostic
let apprCand = 0, apprCandAt = 0; // which APPR_ROOM entry, and since when
let apprPts = null, apprLead = null;   // scratch: her bones, the leader's bones
const apprP = new THREE.Vector3(), apprTgt = new THREE.Vector3();
let apprHave = false;            // whether `apprP` holds where she was last frame

/**
 * Build her. Returns null — quietly — if the blob is not in this build, which
 * is the same failure `loadSkin` already has and the same one it deserves:
 * the game without an apprentice is the game that shipped yesterday.
 */
async function loadApprentice() {
  if (!PAYLOAD.baye2_fr3d) return null;
  // Everything about how a v5 figure is put together lives in 41-skin.js, so
  // that she and Chloe cannot drift apart. What is hers is the four lines
  // below: which maps, and what colour her hair is.
  const look = v5Parts({
    hairTex: 'baye2_hair', legTex: 'baye2_leg', hair2Tex: 'baye2_hair2',
    hairCol: APPR.hairCol, browCol: APPR.browCol, lidCol: 0xdcbcad,
  });
  apprEye = look.eye;
  apprJaw = look.jaw;

  // The leader's added finger bones too (41-hands.js): she wears v1.0's
  // palette bone for bone, and `apprSameRig` checks the two agree.
  const fig = await loadSkinHands('baye2_fr3d', {
    spec: 0.10, specPower: 26, vcol: false,
    uniforms: { uSkin: { value: v5Tex('baye2_skin') }, ...look.jaw.uniforms,
      ...look.lid.uniforms },
    decl: 'uniform sampler2D uSkin;' + look.jaw.decl + look.lid.decl,
    vdecl: look.jaw.vdecl,
    // The whole of what makes her a different figure: one texture lookup —
    // and the inside of her mouth.
    body: 'base = texture2D(uSkin, vUv).rgb;' + look.jaw.frag,
    // And a mouth that opens when the leader's does — see `jaw` in v5Parts.
    // Her eyelids, which close for real — see LID_VERT — and then her jaw.
    vert: look.lid.vert + look.jaw.bodyVert,
    parts: look.parts,
  });
  if (!fig) return null;

  // The eyes, measured off the geometry rather than guessed.
  v5Eyes(fig, apprEye);
  v5Jaw(fig, apprJaw);
  if (fig.parts.hair2) fig.parts.hair2.visible = false;
  apprHang = look.hang;
  v5HairPivot(fig);

  appr = fig;
  // Sized for poses, and deep enough for the lag at 240 fps: 128 slots of a
  // 30-bone rig is 73 thousand floats, a third of a megabyte.
  const nb = fig.bones.length;
  apprStride = 6 + nb * 19;
  apprRingN = 128;
  apprRing = new Float32Array(apprRingN * apprStride);
  // How far the leader's mouth was open, slot for slot with the ring, so her
  // lips lag by exactly what her body lags by and not by some other amount.
  apprGape = new Float32Array(apprRingN);
  apprPts = new Float32Array(nb * 3);
  apprLead = new Float32Array(nb * 3);
  apprHead = 0; apprN = 0; apprClock = 0; apprClip = null; apprSame = null;
  fig.play('idle', { fade: 0 });
  fig.mesh.visible = false;      // until the leader has been somewhere
  return fig;
}

/**
 * Are these the same rig, bone for bone? Names, parents and rest transforms.
 *
 * They are by construction — `tools/blender/baye2.py` runs the same
 * `armature()` on the same joints — and measured, both blobs agree to six
 * decimals. It is still checked rather than assumed, once, because the whole
 * of `wearPose` rests on it: a palette solved for one skeleton and worn by
 * another is a body turned inside out, and the day somebody re-rigs one of
 * them without the other is the day that would ship.
 */
function apprSameRig(a, b) {
  if (!a.bones || !b.bones || a.bones.length !== b.bones.length) return false;
  if (!a.rest || !b.rest || !a.pose || !b.wearPose) return false;
  const ra = a.rest(), rb = b.rest();
  for (let i = 0; i < a.bones.length; i++) {
    if (a.bones[i].name !== b.bones[i].name) return false;
    if (a.bones[i].parent !== b.bones[i].parent) return false;
  }
  for (let k = 0; k < ra.restT.length; k++) {
    if (Math.abs(ra.restT[k] - rb.restT[k]) > 1e-4) return false;
  }
  for (let k = 0; k < ra.restQ.length; k++) {
    if (Math.abs(ra.restQ[k] - rb.restQ[k]) > 1e-4) return false;
  }
  return true;
}

/** The ring slot `back` frames behind the newest, as an offset into it. */
function apprSlot(back) {
  const i = ((apprHead - 1 - back) % apprRingN + apprRingN) % apprRingN;
  return i * apprStride;
}

/**
 * Her bones in world metres, for a pose laid down at (x, y, z) facing `yaw`.
 *
 * `T` is the pose's own figure-space bone positions. Her forward is +x turned
 * by `rotation.y`, which is the same pair `faceYaw` produces.
 */
function apprBones(out, T, n, x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < n; i++) {
    const px = T[i * 3], py = T[i * 3 + 1], pz = T[i * 3 + 2];
    out[i * 3] = x + px * c + pz * s;
    out[i * 3 + 1] = y + py;
    out[i * 3 + 2] = z - px * s + pz * c;
  }
  return out;
}

/** Nearest approach between two bodies, bone to bone, in metres. */
function apprGap(A, B, n) {
  let m = 1e9;
  for (let i = 0; i < n; i++) {
    const ax = A[i * 3], ay = A[i * 3 + 1], az = A[i * 3 + 2];
    for (let j = 0; j < n; j++) {
      const dx = ax - B[j * 3], dy = ay - B[j * 3 + 1], dz = az - B[j * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < m) m = d;
    }
  }
  return Math.sqrt(m);
}

/**
 * One frame of following.
 *
 * CALLED ONCE THE LEADER'S FRAME IS FINISHED — after `stepShow` and after
 * `placeHorns`, from the same block in 43-jadrija.js that updates her — and
 * not from inside `stepShow`, where it used to be. Two reasons, both
 * measured. Half of what the leader does indoors is solved AFTER her
 * placement, as `aim`s — arms held wide, a hand to the stool, a head to
 * whoever is talking — and the palette is only final once all of it has run.
 * And `jad.pose` skips `stepShow` altogether, so an apprentice stepped from
 * inside it was left mid-wander whenever the leader was held.
 *
 * `room` is null outdoors and `{ inside, fit, lift }` where there is a
 * kabina: the resort's own 0..1 ramp for being in it, the whole-body test
 * for a place to stand in it, and how far the leader is lifted this frame by
 * something she is ON rather than something she is DOING — the cot.
 */
function apprenticeStep(dt, leader, room = null) {
  if (!appr || !leader || !leader.mesh) return;
  apprCalls++;
  const t0 = performance.now();
  apprStepBody(dt, leader, room);
  // What she costs, as a running average in milliseconds — measured on the
  // CPU because the GPU this is tested on is shared, and an fps figure there
  // says as much about whoever else is rendering as about her.
  apprMs += (performance.now() - t0 - apprMs) * 0.05;
}

let apprMs = 0;

function apprStepBody(dt, leader, room) {
  // Leader gone — out of range, off the phase that has her at all. An
  // apprentice with nobody to follow stands and waits.
  if (!leader.mesh.visible) { appr.mesh.visible = false; apprHave = false; return; }
  if (apprSame === null) apprSame = apprSameRig(leader, appr);

  const nb = appr.bones.length;
  apprClock += dt;
  const m = leader.mesh;
  let o = apprSlot(-1);
  apprRing[o] = apprClock;
  apprRing[o + 1] = m.position.x;
  apprRing[o + 2] = m.position.y;
  apprRing[o + 3] = m.position.z;
  apprRing[o + 4] = m.rotation.y;
  apprRing[o + 5] = room ? room.lift || 0 : 0;
  // `face.gape` is what v1.0's own jaw is driven by: the voice meter while she
  // speaks, the syllable fallback, the open mouth of the hose and the straw.
  apprGape[o / apprStride] = leader.face ? leader.face.gape || 0 : 0;
  apprLeadFace = leader.face || null;
  if (apprSame) {
    const P = leader.pose();
    apprRing.set(P.palette, o + 6);
    apprRing.set(P.worldQ, o + 6 + nb * 12);
    apprRing.set(P.worldT, o + 6 + nb * 16);
  }
  apprHead = (apprHead + 1) % apprRingN;
  apprN = Math.min(apprN + 1, apprRingN);

  // The newest slot at least `lag` old, by the clock the slots were stamped
  // with rather than by a count of frames — a lag counted in frames doubles
  // when the promenade drops to 30 with the fire up.
  let back = 0;
  // No lag at all when she is the primary: she is not following anybody,
  // she IS the figure — the slot written this frame is the one she wears.
  const lag = APPR.primary ? 0 : APPR.lag;
  while (back < apprN - 1 && apprClock - apprRing[apprSlot(back)] < lag) back++;
  o = apprSlot(back);
  const x = apprRing[o + 1], y = apprRing[o + 2], z = apprRing[o + 3];
  const yaw = apprRing[o + 4], lift = apprRing[o + 5];

  // ── the pose ─────────────────────────────────────────────────────────────
  if (apprSame) {
    appr.wearPose(apprRing.subarray(o + 6, o + 6 + nb * 12),
      apprRing.subarray(o + 6 + nb * 12, o + 6 + nb * 16),
      apprRing.subarray(o + 6 + nb * 16, o + 6 + nb * 19));
  } else {
    // The fallback, and what she did before: the same clip by name. It misses
    // every `aim` the leader is given, which is why it is the fallback.
    const want = leader.playing();
    if (want && want !== apprClip) { apprClip = want; appr.play(want, { fade: 0.18 }); }
    if (leader.state) appr.state.speed = leader.state.speed;
    appr.update(dt);
  }

  // ── AS THE PRIMARY: exactly where the driver is, and nothing else ─────────
  //
  // Misha, 23 Sep 2026: *"i think we are ready to 'park' baye v1.0 and have
  // baye v2.0 be the main one... stash away baye v1.0 if we ever need to
  // recover her"*. v1.0 is not deleted and does not stop: everything Baye
  // does — every routine, every command, her voice, her lips, the straw in
  // her hand — is written against her, and all of it goes on running on an
  // undrawn figure. v2.0 wears that figure's finished pose on the same frame,
  // in the same place, at the same height — the cot included, because here
  // the lift IS where she is — and with the same mouth. See BAYE in
  // 43-jadrija.js for the one switch that turns it back.
  if (APPR.primary) {
    appr.mesh.position.copy(m.position);
    appr.mesh.rotation.y = m.rotation.y;
    appr.mesh.visible = true;
    apprMode = 'primary';
    v5Blink(apprEye, dt);
    // Petted, her eyelids a little heavy — looking up at you, not asleep.
    if (apprEye && leader.face && leader.face.pet) {
      apprEye.uLid.value = Math.max(apprEye.uLid.value, APPR.petLid * leader.face.pet);
    }
    // And the toy's beat: her eyes close on it — see `buzzFace` in the show.
    if (apprEye && leader.face && leader.face.buzz) {
      apprEye.uLid.value = Math.max(apprEye.uLid.value, APPR.buzzLid * leader.face.buzz);
    }
    if (apprEye && apprLidHold != null) apprEye.uLid.value = apprLidHold;
    if (apprJaw) {
      apprJaw.uniforms.uGape.value = apprGapeHold != null ? apprGapeHold
        : Math.min(1, Math.max(0, leader.face && leader.face.gape ? leader.face.gape : 0));
      apprJaw.uniforms.uSeal.value = apprSealHold != null ? apprSealHold
        : Math.min(1, Math.max(0, leader.face && leader.face.seal ? leader.face.seal : 0));
    }
    v5Hang(appr, apprHang);
    appr.mesh.updateMatrixWorld();
    return;
  }

  // ── where ────────────────────────────────────────────────────────────────
  //
  // Her forward is (cos, −sin) and her left is (sin, cos) in the LEADER's
  // frame at that moment, so every offset swings round with her.
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  const sx = Math.sin(yaw), sz = Math.cos(yaw);
  const inK = room && room.inside ? room.inside(x, z) : 0;
  const fit = room && room.fit;
  // A lift is a PLACE and not a body motion: the leader on the cot is 0.44 m
  // up because the mattress is, and the apprentice is not on the mattress.
  // Everything else in `y` — a somersault's height, the crouch at the plate —
  // is the body, and is copied.
  const py = y - lift;
  let damp = 0;
  if (inK <= 0 || !fit || !apprSame) {
    // OUTSIDE: exactly what she did before. Off the shoulder, blended toward
    // straight-behind across the threshold so she follows through the door
    // rather than into the jamb.
    const bk = APPR.back + (0.80 - APPR.back) * inK;
    const sd = APPR.side * (1 - inK);
    apprTgt.set(x - fx * bk + sx * sd, py, z - fz * bk + sz * sd);
    apprMode = inK > 0 ? 'door' : 'out';
    apprCand = 0;
  } else if (inK < 1) {
    // In the doorway: straight behind her, one step of queue. The same place
    // the first room candidate is, so crossing into the room is not a jump.
    apprTgt.set(x - fx * 0.80, py, z - fz * 0.80);
    apprMode = 'door';
    apprCand = 0;
  } else {
    // IN THE ROOM: the first place her whole body fits.
    //
    // HELD FOR THREE SECONDS ONCE CHOSEN, while it still fits. The first cut
    // re-asked for the best place every half second and she changed places
    // ten times a minute — measured — which reads as a woman who cannot
    // settle. A person who has found somewhere to stand stays there until
    // they are in the way.
    const T = apprRing.subarray(o + 6 + nb * 16, o + 6 + nb * 19);
    const L = leader.pose().worldT;
    apprBones(apprLead, L, nb, m.position.x, m.position.y, m.position.z, m.rotation.y);
    // How bad a place is: bones through a wall or into the furniture, plus a
    // whole body's worth if she would be inside the leader — 22 cm between
    // the nearest two joints is flesh touching, and closer is one body
    // through the other, which is worse than any wall.
    //
    // AND AGAINST WHAT SHE IS ABOUT TO DO, which is the one thing the lag
    // gives for free. She wears the leader's pose from a third of a second
    // ago, so the ring already holds every pose she will wear for the next
    // third of a second. A place that fits her kneeling but not the lying
    // down she is about to do is a place she would have to leave half way
    // through lying down — which is exactly where the first two cuts put her
    // outside the room. So each place is also tried against the middle and
    // the newest of those future poses, each at its own offset from where
    // the leader was then.
    const future = [back >> 1, 0];
    const score = (k) => {
      const [b, s] = APPR_ROOM[k];
      apprBones(apprPts, T, nb, x - fx * b + sx * s, py, z - fz * b + sz * s, yaw);
      let bad = fit.bad(apprPts, nb);
      if (apprGap(apprPts, apprLead, nb) < 0.22) bad += nb;
      for (const f of future) {
        if (f >= back) continue;
        const q = apprSlot(f);
        const qy = apprRing[q + 4];
        const qfx = Math.cos(qy), qfz = -Math.sin(qy);
        const qsx = Math.sin(qy), qsz = Math.cos(qy);
        const qx = apprRing[q + 1], qz = apprRing[q + 3];
        apprBones(apprPts, apprRing.subarray(q + 6 + nb * 16, q + 6 + nb * 19), nb,
          qx - qfx * b + qsx * s, apprRing[q + 2] - apprRing[q + 5],
          qz - qfz * b + qsz * s, qy);
        bad += fit.bad(apprPts, nb);
      }
      return bad;
    };
    let pick = -1;
    if (apprMode === 'room' && apprClock - apprCandAt < 3.0 && score(apprCand) === 0) {
      pick = apprCand;
    } else {
      // The first that fits outright, or — when nothing does, the leader
      // lying across the floor, say — the least bad. A hand through the
      // plaster for a moment is better than a woman standing in the alley.
      let best = 1e9;
      for (let k = 0; k < APPR_ROOM.length; k++) {
        const sc = score(k);
        if (sc < best) { best = sc; pick = k; if (sc === 0) break; }
      }
      apprMode = best === 0 ? 'room' : 'squeeze';
      if (pick !== apprCand) { apprCand = pick; apprCandAt = apprClock; }
    }
    const [b, s] = APPR_ROOM[pick];
    apprTgt.set(x - fx * b + sx * s, py, z - fz * b + sz * s);
    // Eased rather than snapped, so a change of place is a step and not a
    // teleport. Only in here — outside, where she walks a trail, easing would
    // put her behind her own feet.
    damp = 1 - Math.exp(-dt * 6);
  }
  if (!apprHave || damp === 0) {
    apprP.copy(apprTgt);
  } else {
    // ROUND HER, NOT THROUGH HER. Easing in a straight line from one side of
    // the leader to the other walks straight through the leader — measured,
    // 5 cm between their roots and 4 mm between the nearest two joints on
    // the frame she changed sides. So the move is eased in polar coordinates
    // about the leader: the angle takes the short way round and the radius
    // goes from one distance to the other, and she never comes closer than
    // the nearer of the two.
    const rx = apprP.x - x, rz = apprP.z - z;
    const tx = apprTgt.x - x, tz = apprTgt.z - z;
    const r0 = Math.hypot(rx, rz), r1 = Math.hypot(tx, tz);
    const a0 = Math.atan2(rz, rx);
    let da = Math.atan2(tz, tx) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const r = r0 + (r1 - r0) * damp, a = a0 + da * damp;
    apprP.set(x + Math.cos(a) * r, apprP.y + (apprTgt.y - apprP.y) * damp,
      z + Math.sin(a) * r);
  }
  apprHave = true;
  appr.mesh.position.copy(apprP);
  appr.mesh.rotation.y = yaw;
  appr.mesh.visible = apprN > 4;

  v5Blink(apprEye, dt);
  // The same damping v1.0's `faceTick` puts between face.gape and her uGape,
  // so the two mouths move with the same softness and not only the same size.
  if (apprJaw) {
    const u = apprJaw.uniforms.uGape;
    const want = Math.min(1, Math.max(0, apprGape[o / apprStride]));
    u.value += (want - u.value) * (1 - Math.exp(-13 * dt));
  }
  v5Hang(appr, apprHang);
  appr.mesh.updateMatrixWorld();
}

/**
 * Make her catch up at once, for a probe that has just held the leader.
 *
 * `jad.pose` freezes the leader, and she follows a frozen leader on her own —
 * she is stepped from the block that runs whether the leader is held or not,
 * and wears whatever the leader is wearing. What this adds is not waiting out
 * the lag: the ring is emptied, so the next step has only the held frame to
 * copy and she is in place and in pose on the first frame after.
 *
 * Only the fallback path — a rig that is not the leader's — still plays the
 * clip by name here.
 */
function apprenticePose(name, at, settle, leader) {
  if (!appr) return null;
  apprN = 0; apprHead = 0; apprHave = false;
  if (apprSame !== false) return { posed: name || null, by: 'pose' };
  if (!name) return { posed: appr.playing() };
  if (!appr.clips.includes(name)) return { posed: null, clips: appr.clips };
  apprClip = name;
  appr.play(name, { fade: 0 });
  appr.state.prev = null;
  const n = Math.max(1, Math.round((settle == null ? 1.5 : settle) * 60));
  for (let i = 0; i < n; i++) { appr.state.curT = at || 0; appr.update(1 / 60); }
  appr.state.curT = at || 0;
  return { posed: name, at: at || 0, by: 'clip' };
}

/**
 * Her hair up in the braid, or down and loose. Handed the leader's state every
 * frame by 43-jadrija.js — "hair down" is v1.0's latch (`hairDown`), and as
 * the primary v2.0 answers it with a hairstyle of her own rather than v1.0's
 * simulated chain, which was a different colour from her braid: Misha, *"the
 * hair color doesn't match her new awesome hair... somehow have her undo her
 * awesome natural hair and let it loose?"*.
 */
function apprenticeHair(down) {
  if (!appr || !appr.parts) return;
  const h = appr.parts.hair, h2 = appr.parts.hair2;
  if (!h2) return;
  h.visible = !down;
  h2.visible = !!down;
}

/** Where she is and which way she is facing, in world metres. */
function apprenticeAt() {
  if (!appr) return null;
  return { x: appr.mesh.position.x, y: appr.mesh.position.y,
    z: appr.mesh.position.z, yaw: appr.mesh.rotation.y };
}

/**
 * Debug: her body against a room, and against the leader, as it is drawn NOW.
 *
 * Independent of how she was placed — this reads her own mesh and her own
 * bones back, so a probe asking "is she in the room" is asking the thing it
 * means and not the placement's opinion of itself.
 */
function apprenticeCheck(leader, fit) {
  if (!appr || !appr.pose) return null;
  const nb = appr.bones.length;
  const A = apprBones(new Float32Array(nb * 3), appr.pose().worldT, nb,
    appr.mesh.position.x, appr.mesh.position.y, appr.mesh.position.z,
    appr.mesh.rotation.y);
  const out = { shown: appr.mesh.visible };
  // Zero inset: this is "is any bone through a wall or into the furniture",
  // not the placement's own margin for flesh.
  if (fit) {
    let low = 1e9, lowB = -1;
    for (let i = 0; i < nb; i++) {
      if (A[i * 3 + 1] < low) { low = A[i * 3 + 1]; lowB = i; }
    }
    out.low = +(low - fit.floor).toFixed(3);
    out.lowBone = lowB >= 0 ? appr.bones[lowB].name : null;
    out.inRoom = fit.ok(A, nb, 0.0);
    // Which bones, and where, in the room's own (t, s) and height off the
    // floor — so a failure says what it hit rather than only that it did.
    if (!out.inRoom) {
      out.bad = [];
      const T = [0, 0];
      for (let i = 0; i < nb; i++) {
        if (fit.bad(A.subarray(i * 3, i * 3 + 3), 1, 0.0) === 0) continue;
        fit.ts(A[i * 3], A[i * 3 + 2], T);
        out.bad.push([appr.bones[i].name, +T[0].toFixed(2), +T[1].toFixed(2),
          +(A[i * 3 + 1] - fit.floor).toFixed(2)]);
      }
    }
  }
  if (leader && leader.pose) {
    const L = apprBones(new Float32Array(nb * 3), leader.pose().worldT, nb,
      leader.mesh.position.x, leader.mesh.position.y, leader.mesh.position.z,
      leader.mesh.rotation.y);
    out.gap = +apprGap(A, L, nb).toFixed(3);
    out.root = +Math.hypot(appr.mesh.position.x - leader.mesh.position.x,
      appr.mesh.position.z - leader.mesh.position.z).toFixed(3);
    // Figure-space pose difference, bone by bone, as the largest angle
    // between her world rotation and the leader's. Against the leader NOW,
    // so it includes the lag — a held leader makes it the copy's own error.
    const Q = appr.pose().worldQ, R = leader.pose().worldQ;
    let worstA = 0, worstB = -1;
    for (let i = 0; i < nb; i++) {
      const d = Math.abs(Q[i * 4] * R[i * 4] + Q[i * 4 + 1] * R[i * 4 + 1]
        + Q[i * 4 + 2] * R[i * 4 + 2] + Q[i * 4 + 3] * R[i * 4 + 3]);
      const a = 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;
      if (a > worstA) { worstA = a; worstB = i; }
    }
    out.degMax = +worstA.toFixed(2);
    out.degBone = worstB >= 0 ? appr.bones[worstB].name : null;
    // And the same in position: every bone's figure-space head, hers against
    // the leader's, in millimetres. A hand held out on request is where this
    // shows first.
    const PT = appr.pose().worldT, RT = leader.pose().worldT;
    let mm = 0, mmB = -1;
    for (let i = 0; i < nb; i++) {
      const d = Math.hypot(PT[i * 3] - RT[i * 3], PT[i * 3 + 1] - RT[i * 3 + 1],
        PT[i * 3 + 2] - RT[i * 3 + 2]) * 1000;
      if (d > mm) { mm = d; mmB = i; }
    }
    out.mmMax = +mm.toFixed(2);
    out.mmBone = mmB >= 0 ? appr.bones[mmB].name : null;
  }
  return out;
}

/** Debug: turn her to an absolute yaw, without waiting for her to wander. */
/**
 * Debug: hold her mouth at `g` (0 shut, 1 wide) whatever the leader says, or
 * let go with null. Headless a frame is a second and the voice meter never
 * holds still for a photograph of the jaw.
 */
let apprGapeHold = null;
let apprSealHold = null;
let apprLidHold = null;
function apprenticeGape(g, seal, lid) {
  apprGapeHold = g == null ? null : Math.min(1, Math.max(0, +g));
  apprSealHold = seal == null ? null : Math.min(1, Math.max(0, +seal));
  apprLidHold = lid == null ? null : Math.min(1, Math.max(0, +lid));
  return apprGapeHold;
}

/**
 * Where her lower lip is this frame, in her bind frame: the middle of her
 * mouth, 6 mm down and 4 mm in, turned about the hinge by exactly what the
 * jaw in v5Parts is giving it. For the thumb — see `thumbReach` in
 * 43-jadrija.js — which has to land on the lip she is drawn with, and she is
 * drawn with this jaw and not v1.0's. Null until she is loaded.
 */
function apprenticeLipBind() {
  if (!appr || !apprJaw) return null;
  const U = apprJaw.uniforms;
  const c = U.uLipC.value, h = U.uHinge.value;
  if (c.y < -50 || h.y < -50) return null;
  // IN her mouth, since 24 Sep: 14 mm behind the front of her teeth and
  // halfway between the upper and lower rows — the point that is turned by
  // half of what the lower row is, which is the middle of the gap. The thumb
  // pad goes there, so the tip is further in still.
  const a = -0.5 * U.uGape.value * U.uJawA.value;
  const rx = c.x - APPR.thumbIn - h.x, ry = c.y - 0.003 - h.y;
  return [h.x + rx * Math.cos(a) - ry * Math.sin(a),
    h.y + rx * Math.sin(a) + ry * Math.cos(a), 0];
}

/**
 * The top of her hair, in her bind frame, for your hand to pet — `stroke` −1
 * to 1 runs it from her forehead back to her crown along the midline, and
 * down the round of her head at either end. Whichever hairstyle she is
 * wearing, measured off its own cards the first time it is asked for: the top
 * of it, and the middle front-to-back of what is up there.
 */
const _apprCrown = {};
function apprenticeCrownBind(stroke) {
  if (!appr || !appr.parts) return null;
  const name = appr.parts.hair2 && appr.parts.hair2.visible ? 'hair2' : 'hair';
  const part = appr.parts[name];
  if (!part) return null;
  if (!_apprCrown[name]) {
    const g = appr.mesh.geometry, pos = g.getAttribute('position'), ix = g.getIndex();
    const { start, count } = part.geometry.drawRange;
    let top = -1e9;
    for (let i = start; i < start + count; i++) {
      const v = ix.getX(i);
      if (Math.abs(pos.getZ(v)) < 0.03) top = Math.max(top, pos.getY(v));
    }
    let sx = 0, n = 0;
    for (let i = start; i < start + count; i++) {
      const v = ix.getX(i);
      if (Math.abs(pos.getZ(v)) < 0.03 && pos.getY(v) > top - 0.012) { sx += pos.getX(v); n++; }
    }
    _apprCrown[name] = [n ? sx / n : 0, top];
  }
  const [cx, top] = _apprCrown[name];
  // Forward is +x in her bind frame; the stroke goes forehead (+) to back (−).
  return [cx + APPR.petStroke * stroke, top + APPR.petAbove - APPR.petRound * stroke * stroke, 0];
}

/**
 * Her breasts, in her bind frame: the forward-most point of each in the band
 * between the armpit and the fold under it — measured off her mesh the first
 * time, the way the areolae were placed (and NOT the forward-most point of
 * the chest, which is the sternum). `side` +1 is her left (+z), −1 her right.
 */
let _apprBreast = null;
function apprenticeBreastBind(side) {
  if (!appr) return null;
  if (!_apprBreast) {
    const g = appr.mesh.geometry, pos = g.getAttribute('position');
    const { start, count } = g.drawRange;
    const ix = g.getIndex();
    const best = { 1: null, '-1': null };
    for (let i = start; i < start + count; i++) {
      const v = ix.getX(i);
      const y = pos.getY(v), z = pos.getZ(v), x = pos.getX(v);
      if (y < 1.18 || y > 1.32 || Math.abs(z) < 0.045 || Math.abs(z) > 0.12) continue;
      const k = z > 0 ? 1 : -1;
      if (!best[k] || x > best[k][0]) best[k] = [x, y, z];
    }
    _apprBreast = best;
  }
  return _apprBreast[side] || null;
}

/**
 * Her hip, in her bind frame, for a hand resting on it: the front-outer curve
 * of her side just below the waist — the vertex in the band where a hand on a
 * hip sits that stands furthest out along the diagonal between forward and
 * sideways. With the outward normal there, flattened level, for the palm to
 * face. `side` +1 her left, −1 her right. Measured once.
 */
let _apprHip = null;
function apprenticeHipBind(side) {
  if (!appr) return null;
  if (!_apprHip) {
    const g = appr.mesh.geometry, pos = g.getAttribute('position');
    const { start, count } = g.drawRange;
    const ix = g.getIndex();
    const best = { 1: null, '-1': null };
    for (let i = start; i < start + count; i++) {
      const v = ix.getX(i);
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      // Her body only: her hands hang at this height too, a little further
      // out, and the widest thing in the band was her wrist.
      if (y < APPR.hipY[0] || y > APPR.hipY[1] || Math.abs(z) < 0.06
        || Math.abs(z) > APPR.hipZ) continue;
      const k = z > 0 ? 1 : -1;
      // More forward than sideways: the front of the hip bone, where a hand
      // resting on it shows, rather than round the side of her where it is
      // behind her.
      const sc = 0.80 * x + 0.60 * Math.abs(z);
      if (!best[k] || sc > best[k][3]) best[k] = [x, y, z, sc];
    }
    _apprHip = best;
  }
  const b = _apprHip[side];
  return b ? [b[0], b[1], b[2]] : null;
}

/**
 * A point on the INNER face of her thigh, bind frame — the side that faces
 * her other leg, a little toward the front — in the height band `[y0, y1]`.
 * The leg's cross-section in that band is found from her own vertices (its
 * middle, per side), and the point is the one furthest toward her midline
 * with a little weight on being in front. `side` +1 her left, −1 her right.
 * Cached per band.
 */
const _apprThighs = {};
function apprenticeThighBind(side, y0 = APPR.thighY[0], y1 = APPR.thighY[1]) {
  if (!appr) return null;
  const key = y0.toFixed(3) + ':' + y1.toFixed(3);
  if (!_apprThighs[key]) {
    const g = appr.mesh.geometry, pos = g.getAttribute('position');
    const { start, count } = g.drawRange;
    const ix = g.getIndex();
    const pts = { 1: [], '-1': [] };
    for (let i = start; i < start + count; i++) {
      const v = ix.getX(i);
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      if (y < y0 || y > y1 || Math.abs(z) < 0.005 || Math.abs(z) > 0.15) continue;
      pts[z > 0 ? 1 : -1].push([x, y, z]);
    }
    const best = {};
    for (const k of [1, -1]) {
      const P = pts[k];
      if (!P.length) { best[k] = null; continue; }
      const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
      let b = null, bs = -1e9;
      for (const p of P) {
        const sc = -Math.abs(p[2]) + 1.1 * (p[0] - cx);
        if (sc > bs) { bs = sc; b = p; }
      }
      best[k] = b;
    }
    _apprThighs[key] = best;
  }
  const b = _apprThighs[key][side];
  return b ? [b[0], b[1], b[2]] : null;
}

/** Her, for the arm pass to draw into its depth — see `render` in 60-arms.js. */
function apprenticeOccluder() {
  return appr && appr.mesh.visible ? appr.mesh : null;
}

/** Debug: her bind-space vertices within `r` of the jaw hinge, by part. */
function apprenticeDump(r = 0.08, at = null) {
  if (!appr || !apprJaw) return null;
  const c = at === 'eye' && apprEye ? apprEye.uEyeL.value : apprJaw.uniforms.uLipC.value;
  const g = appr.mesh.geometry, pos = g.getAttribute('position'), ix = g.getIndex();
  const out = { c: c.toArray(), parts: {} };
  const groups = [['body', appr.mesh]].concat(Object.entries(appr.parts || {}));
  for (const [name, m] of groups) {
    const { start, count } = m.geometry.drawRange;
    const seen = new Set(), vs = [], tri = [], at = new Map();
    const near = (v) => Math.hypot(pos.getX(v) - c.x, pos.getY(v) - c.y, pos.getZ(v) - c.z) < r;
    for (let i = start; i + 2 < start + count; i += 3) {
      const a = ix.getX(i), b = ix.getX(i + 1), d = ix.getX(i + 2);
      if (name === 'body' && near(a) && near(b) && near(d)) tri.push([a, b, d]);
    }
    for (let i = start; i < start + Math.min(count, 1e7); i++) {
      const v = ix.getX(i);
      if (seen.has(v)) continue;
      seen.add(v);
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      if (Math.hypot(x - c.x, y - c.y, z - c.z) < r) vs.push([v, +x.toFixed(5), +y.toFixed(5), +z.toFixed(5)]);
    }
    out.parts[name] = vs;
    if (tri.length) out.tri = tri;
  }
  return out;
}

function apprenticeFace(yaw) {
  if (!appr) return null;
  appr.mesh.rotation.y = yaw;
  appr.mesh.updateMatrixWorld();
  return +yaw.toFixed(3);
}

/** What she is doing, for `__fr.stats().jadrija.apprentice`. */
function apprenticeStats() {
  if (!appr) return 'none';
  return {
    tris: appr.tris, nv: appr.nv,
    parts: Object.keys(appr.parts || {}).join('+') || 'none',
    clips: appr.clips.length,
    shown: !!appr.mesh.visible, calls: apprCalls,
    // How she is following: `pose` when she wears the leader's palette,
    // `clip` if the rigs ever stopped matching. And where: `out`, `door`,
    // `room`, or `squeeze` when nowhere in the room fits her whole body.
    by: apprSame === null ? '-' : (apprSame ? 'pose' : 'clip'),
    mode: apprMode, cand: apprCand, ms: +apprMs.toFixed(3),
    playing: appr.playing(),
    // Her mouth and the leader's, 0 shut to 1 wide — the way to check her
    // lips without looking. `lead` is v1.0's face.gape now; `gape` is hers,
    // which trails it by the lag and the damping, so while v1.0 speaks the two
    // move together a third of a second apart.
    gape: apprJaw ? +apprJaw.uniforms.uGape.value.toFixed(3) : null,
    seal: apprJaw ? +apprJaw.uniforms.uSeal.value.toFixed(3) : null,
    lid: apprEye ? +apprEye.uLid.value.toFixed(3) : null,
    lead: apprLeadFace ? +(apprLeadFace.gape || 0).toFixed(3) : null,
    at: [+appr.mesh.position.x.toFixed(2), +appr.mesh.position.y.toFixed(2),
      +appr.mesh.position.z.toFixed(2)],
    yaw: +appr.mesh.rotation.y.toFixed(4),
    jaw: apprJaw ? { pieces: apprJaw.pieces, nodes: apprJaw.lipNodes,
      hinge: apprJaw.uniforms.uHinge.value.toArray().map((v) => +v.toFixed(4)) } : null,
    // Which way is down for her hair, in her head's frame — see v5Hang.
    hang: apprHang ? apprHang.value.toArray().map((v) => +v.toFixed(3)) : null,
  };
}
