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
const APPR = {
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
    hairTex: 'baye2_hair', legTex: 'baye2_leg',
    hairCol: APPR.hairCol, browCol: APPR.browCol, lidCol: 0xcf9e86,
  });
  apprEye = look.eye;

  const fig = await loadSkin('baye2_fr3d', {
    spec: 0.10, specPower: 26, vcol: false,
    uniforms: { uSkin: { value: v5Tex('baye2_skin') } },
    decl: 'uniform sampler2D uSkin;',
    // The whole of what makes her a different figure: one texture lookup.
    body: 'base = texture2D(uSkin, vUv).rgb;',
    parts: look.parts,
  });
  if (!fig) return null;

  // The eyes, measured off the geometry rather than guessed.
  v5Eyes(fig, apprEye);

  appr = fig;
  // Sized for poses, and deep enough for the lag at 240 fps: 128 slots of a
  // 30-bone rig is 73 thousand floats, a third of a megabyte.
  const nb = fig.bones.length;
  apprStride = 6 + nb * 19;
  apprRingN = 128;
  apprRing = new Float32Array(apprRingN * apprStride);
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
  while (back < apprN - 1 && apprClock - apprRing[apprSlot(back)] < APPR.lag) back++;
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
    at: [+appr.mesh.position.x.toFixed(2), +appr.mesh.position.y.toFixed(2),
      +appr.mesh.position.z.toFixed(2)],
  };
}
