// -----------------------------------------------------------------------------
// Roles reversed: Chloe pins you on the cot (1.586.0).
//
// Misha, 2 Oct 2026: *"can chloe mount on top of baye while baye is lying on
// the cot"* — and, of this and the hair drag, *"yes queue up both of them"*.
// The queue's item 2 (plan/queue-2026-10-02.md).
//
// The same two adults and the same consensual game as src/49-reverse.js, and
// the safeword over all of it: "red", and on that frame her hands come off
// your wrists and she gets off you, and then her aftercare.
//
// THE LINE, as everywhere in this game: this is a PIN, a hold, not sex. Her
// pelvis is never over yours and never moves against you — no grinding, no
// rocking, no rhythm in her hips, no pressing together, and no face anywhere
// near anybody's crotch. Where she sits, and how still, is measured on the
// skin (see the CHANGELOG), and she sits where a hold puts a person:
//
//   FACE DOWN (`front`): she climbs on to the cot and kneels ASTRIDE YOUR
//   BACK, facing your head, her knees on the mattress either side of your
//   ribs (`kneeA`, `kneeOut`), kneeling up — her seat a hand over your back —
//   and leans forward on straight arms to hold your wrists down on the
//   mattress up by your head. To spank you she sits up on to your back,
//   above your hips and never on your bottom (`botGap`, measured), her knees
//   a hand further forward, turns and reaches back over her own hip, her
//   other hand on her own thigh.
//
//   FACE UP (`back`): NOT across your hips. Kneeling over somebody's hips
//   facing them reads as something else whatever the hands are doing, and
//   across your thighs her arms do not reach your wrists (1.2 m, MEASURED
//   off your bones). Nor above your head: your crown is at the mattress's
//   end. So she KNEELS ON THE FLOOR at the cot's end beyond your head and
//   holds your wrists down on the mattress either side of it — one hand
//   each, or one, while the other strokes your hair — her head kept 6 cm
//   or more clear of yours.
//
// HER WEIGHT SHOWS: she settles on your back and the cot's ragdoll takes it
// (`cotPress`, held drawn by `cotWake` in 43-jadrija.js), your wrists are
// pressed a few millimetres into the foam, and when you struggle (W or S, or
// now and then on your own) your wrists come up off it a little and she
// leans in and puts them back. Firmer the sterner she is.
//
// HER MOOD (src/49-revmood.js) sets the hold: stern, a firmer press, a longer
// pin and more spanks from it; warm, lighter, shorter, a hand to your hair;
// excited, playful, in waves — she does more while a wave rides.
//
// WHEN: asked ("pin me down", "sit on me", "hold me down", "hold my wrists",
// "pin my arms", "prikovi me", "sjedni na mene", "drži me", "immobilise-moi",
// "assieds-toi sur moi", "tiens-moi", or Shift+,) — a beg, so it excites her
// (`rmoodBeg('pin')`); or her own pick when she is stern and you are lying on
// the cot. Off the cot she has you lie down first.
//
// GETTING ON AND OFF is a climb, not a cut: to the cot's side, a knee up on
// the mattress, a hand on it, her other leg over your back with the knee
// high, down on to both knees, and settled; and off the same way back, on to
// her feet beside the cot (`rvpClimb`). The legs are solved (`hingeArm`, the
// knees on the foam and the shins along it), not a clip.
// -----------------------------------------------------------------------------

const RVP = {
  // FACE DOWN. Her seat: this far toward your head from your pelvis bone (m,
  // level, on your midline) — your back above your hips, never on them — and
  // her skin this far off yours there (m, resting on you, MEASURED).
  seatAlong: 0.15, seatGap: 0.010,
  // HER KNEES ARE WHERE SHE PUTS THEM, and her hips go where her thighs let
  // them (`rvpHipPose`): on the mattress beside your ribs, `kneeA` m toward
  // your head from your pelvis bone and `kneeOut` out from your midline (no
  // more than `kneeOutMax`, the mattress's edge), its skin `kneeSink` into
  // the foam at the lowest (a knee on a camp mattress gives a little). Her
  // shins back along it, the ankles `ankleIn` in from her knees: the first
  // cut splayed them out and her boots hung over the edge (photographed).
  // Sitting low on you forces the knees forward (a 0.44 m thigh); at your
  // armpits they met your upper arms, so they stay at your ribs and her
  // hips are as low as that allows.
  kneeA: 0.36, kneeASpank: 0.40, kneeOut: 0.29, kneeOutMax: 0.295, kneeSink: -0.004, ankleIn: -0.045, ankleY: 0.045, kneeY0: 0.055,
  // Kneeling up off you to lean on your wrists, her hips this much higher
  // than sitting (m), and how much of her sitting there is then (0..1).
  upH: 0.12, sitPin: 0.12, upFa: 0.12,
  // Sitting on you, the insides of her thighs against your sides: no deeper
  // than this into your skin (m) — two rigid meshes where flesh would give.
  thighIn: 0.022,
  // And none of her nearer your bottom than this (m).
  botGap: 0.015,
  // Her lean on to your wrists (rad, forward, the whole of her about her
  // hips) and the share of it that is her back bowing (the rest is her
  // pelvis tipping); and how much her hips come up off you as she leans (m a rad).
  lean: 1.15, leanBack: 0.4, leanMax: 1.4,
  // Your hands by your head: your palm this far toward the head from your
  // shoulder and out from it (m); your elbow's way.
  // (Forward of square: your upper arms clear of her knees.)
  bFwd: 0.26, bOut: 0.10, bPole: [0.55, 0.8, 0.35],
  // Her palm on the back of your wrist, this far off the skin (m); her grip.
  palmOff: 0.004, press: 0.004, pressStern: 0.004,
  // FACE UP: your wrists up by your head, on the mattress either side of it
  // — your palm this far toward the head from your shoulder and out from it
  // (m). Not above it: your crown is at the mattress's end (MEASURED, your
  // skin runs the whole 1.83 m of it), and there is no foam there to hold
  // them on.
  upFwd: 0.17, upOut: 0.11,
  // The climb, s: on (a knee up, the other leg over, down), settled, off;
  // and off after the safeword, quicker.
  goT: 8, onT: 2.9, settleT: 0.8, offT: 2.5, offSafeT: 1.5, standT: 0.75,
  // Where she stands to climb: this far out from the cot's edge (m).
  standOut: 0.34,
  // Her weight on you (N at the seat), stern and warm on it.
  weight: 260, weightStern: 80, weightWarm: -90,
  // The struggle: your wrists up off the foam (m) and back, s.
  squirmUp: 0.022, squirmT: 0.55, fixT: 0.45,
  // Seconds before she picks it again on her own.
  cool: 40,
  // The spank from on top: her trunk turned to it (rad, the most), bent
  // back and over to that side (rad, the most).
  twistMax: 1.15, sideMax: 0.6, backMax: 0.65, spankReach: 0.50,
  // Measure every this many s (skin to skin, the cot, the walls).
  every: 0.25,
};

/** Her lines (neutral); the tone pools are RVP_MOOD_SAY. */
const RVP_SAY = {
  pin: ['There. Now you stay put.', "Mm. Got you.", "Comfy? Good. You're not going anywhere."],
  pin_hold: ["Mm. Look at you, all pinned.", 'Not going anywhere, are you?', 'I like you right here.'],
  pin_squirm: ['Uh-uh. Stay.', 'Nope.', 'Where do you think you’re going?'],
  pin_off: ['Okay. Up you get, in a sec.', 'There. Off you.'],
};
const RVP_MOOD_SAY = {
  pin: {
    stern: ["Don't move. I mean it.", 'Stay down. You earned this.', 'You’re staying right here till I say.',
      'Hands where I put them.', 'Still. Now.'],
    warm: ["C'mere... I've got you.", 'Shh. Just stay with me.', 'Gentle. I’m right here.', 'Mm, there you are.'],
    excited: ['Gotcha! Hehe.', 'Ooh, pinned! Hehe.', "Now you're mine. Hehe!", 'Try to get up. I dare you.'],
  },
  pin_hold: {
    stern: ['Every time you wriggle, it’s longer.', 'You don’t move until I say.', 'Feel that? That’s me in charge.',
      'Quiet. Breathe.', 'I’ll let you up when you’ve learned.'],
    warm: ['You’re doing so well.', 'So good for me.', 'Mm. I could stay like this.', 'Breathe, babe. I’ve got you.'],
    excited: ['Hehe, you’re so cute like this.', 'Squirm for me. Go on.', 'Ooh, I could do this all day!', 'Comfy down there? Hehe.'],
  },
  pin_squirm: {
    stern: ['Did I say move?', 'Down.', 'Again? Down.', 'That’s another minute.', 'No.'],
    warm: ['Easy... easy.', 'Shh, stay with me.', 'Hey. I’ve got you.'],
    excited: ['Hehe, nope!', 'Nice try!', 'Ooh, feisty!', 'Where you going? Hehe.'],
  },
  pin_off: {
    stern: ['Fine. Up. Slowly.', 'That’ll do. For now.'],
    warm: ['Okay, babe. Letting you go.', 'There. All done. You did so good.'],
    excited: ['Phew! Hehe. Okay, you’re free.', 'Okay, okay, I’ll let you up. Hehe.'],
  },
};
const RVP_BEG_SAY = ['Pin you? Oh, gladly.', 'Mm. You asked for it. Stay right there.', 'Oh, you want me on top of you? Hehe. Okay.',
  "Hold you down? Say less.", 'Don’t you move. I’m coming.'];

const rvp = {
  M: null,                  // the pin going on (also `rvm.move`)
  last: -1e9, n: 0,         // when she last did one, how many
  after: null,              // { until, asked } — once you are lying down
  stats: null, all: [],     // what the last pin measured, and every one this session
  measure: true,
  seat: null,               // the drive's this frame: { at, quat } or null
  legsOn: false,            // her legs are this file's
  bArms: false,             // your arms are this file's
  squirmKey: 0,             // the last W/S struggle
  safeT: null,              // the safeword's frame, for the record
};
const _rvpA = new THREE.Vector3(), _rvpB = new THREE.Vector3(), _rvpC = new THREE.Vector3();
const _rvpUP = new THREE.Vector3(0, 1, 0);
const _rvpQ = new THREE.Quaternion(), _rvpQ2 = new THREE.Quaternion();

function rvpTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvpSay(kind, force = false) {
  return typeof revSay === 'function' ? revSay(kind, force, null, { still: revStill.dom }) : null;
}
const rvpSm = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const rvpLerp = (a, b, k) => a + (b - a) * k;

// ── her mood, read ───────────────────────────────────────────────────────────

/**
 * What her mood makes of a pin: how long (s), her weight (N), how firm her
 * grip (m into the foam, and her fingers' curl), how many spank rounds from
 * it and how often she does something (s between), and whether she strokes
 * your hair. All off `rmood`.
 */
function rvpMood() {
  const R = typeof rmood !== 'undefined' ? rmood : null;
  const s = R ? R.stern : 0.22, e = R ? R.ex.v : 0, g = typeof rmoodGentle === 'function' ? rmoodGentle() : 0.3;
  const tone = R ? R.tone : 'neutral';
  return {
    s, e, g, tone,
    hold: Math.max(9, Math.min(48, 16 + 26 * s - 9 * g + 6 * e)),
    weight: Math.max(150, RVP.weight + RVP.weightStern * s + RVP.weightWarm * g),
    press: Math.max(0.001, RVP.press + RVP.pressStern * s - 0.003 * g),
    curl: Math.max(0.55, Math.min(1.25, 0.85 + 0.35 * s - 0.25 * g)),
    rounds: Math.max(0, Math.round(0.4 + 2.6 * s + 1.4 * e - 1.6 * g)),
    gap: Math.max(2.2, Math.min(9, 5.2 - 2.0 * s - 2.2 * e + 2.6 * g)),
    stroke: g > 0.35 ? 0.5 + 0.5 * g : 0,
    squirmFix: 0.8 + 0.6 * s,
  };
}

// ── where everybody is ───────────────────────────────────────────────────────

/** Baye on the cot: the mattress, the way to her head (level), her midline, her side; or null. */
function rvpGeom() {
  const Mt = typeof rvsMattress === 'function' ? rvsMattress() : null;
  const Pv = revBone('pelvis', new THREE.Vector3()), Hd = revBone('head', new THREE.Vector3());
  const SL = revBone('armUL', new THREE.Vector3()), SR = revBone('armUR', new THREE.Vector3());
  if (!Mt || !Pv || !Hd || !SL || !SR) return null;
  const H = Mt.ax.clone().multiplyScalar(Math.sign((Hd.x - Pv.x) * Mt.ax.x + (Hd.z - Pv.z) * Mt.ax.z) || 1);
  // Across, level: your right, from the shoulders.
  const R0 = SR.clone().sub(SL); R0.y = 0;
  const lat = R0.addScaledVector(H, -R0.dot(H)).normalize();
  // Your midline at the pelvis (level) and its distance along the cot.
  const mid = Pv.clone();
  return { Mt, H, lat, Pv, Hd, SL, SR, mid, top: Mt.top };
}

/** A level point `along` m toward your head from your pelvis and `out` m to your right, at height y. */
function rvpAt(G, along, out, y) {
  return new THREE.Vector3(G.Pv.x + G.H.x * along + G.lat.x * out, y, G.Pv.z + G.H.z * along + G.lat.z * out);
}

/** The top of your skin round level point `P` (within `r` m), from the skinned mesh: its height (and the vertex in `out`). */
function rvpTopAt(S, P, r = 0.05, regs = null, out = null) {
  let best = -9, bi = -1;
  for (let i = 0; i < S.n; i++) {
    if (regs && !regs[S.reg[i]]) continue;
    const dx = S.p[3 * i] - P.x, dz = S.p[3 * i + 2] - P.z;
    if (dx * dx + dz * dz > r * r) continue;
    if (S.p[3 * i + 1] > best) { best = S.p[3 * i + 1]; bi = i; }
  }
  if (out && bi >= 0) out.set(S.p[3 * bi], S.p[3 * bi + 1], S.p[3 * bi + 2]);
  return best;
}

/** The furthest of your skin along `dir` within `r` m of `P` (into `out`); answers how far. */
function rvpExtAt(S, P, r, regs, dir, out) {
  let best = -9, bi = -1;
  for (let i = 0; i < S.n; i++) {
    if (regs && !regs[S.reg[i]]) continue;
    const dx = S.p[3 * i] - P.x, dy = S.p[3 * i + 1] - P.y, dz = S.p[3 * i + 2] - P.z;
    if (dx * dx + dy * dy + dz * dz > r * r) continue;
    const e = dx * dir.x + dy * dir.y + dz * dir.z;
    if (e > best) { best = e; bi = i; }
  }
  if (out && bi >= 0) out.set(S.p[3 * bi], S.p[3 * bi + 1], S.p[3 * bi + 2]);
  return best;
}

/** Her yaw (walker convention) facing level direction `d`. */
function rvpYaw(d) { return Math.atan2(-d.x, -d.z); }
/** Her figure's turn for walker yaw `yaw`, leaned forward `lean` rad and rolled `roll`. */
function rvpQuat(yaw, lean, roll = 0) {
  const q = new THREE.Quaternion().setFromAxisAngle(_rvpUP, yaw + Math.PI / 2 + (typeof YOU !== 'undefined' ? YOU.face || 0 : 0));
  // Her own +z is her right: a turn of −lean about it takes her front down.
  if (lean) q.multiply(_rvpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean));
  if (roll) q.multiply(_rvpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll));
  return q;
}

// ── asking, her own pick ─────────────────────────────────────────────────────

/** Can she: on, not after the safeword, her hands free. */
function rvpFree(asked) {
  if (!rev.on || rev.care) return 'off';
  if (typeof rvkHandFull === 'function' && rvkHandFull()) return 'her hand is full';
  if (typeof rvkBusy === 'function' && rvkBusy()) return 'busy';
  if (!asked && ((typeof rvm !== 'undefined' && rvm.move) || rev.arm.mode === 'spank')) return 'busy';
  if (typeof rvm !== 'undefined' && rvm.move && rvm.move.id === 'care') return 'aftercare';
  return true;
}

/** Which pin your body is in for: 'front' face down, 'back' face up, or null (and why). */
function rvpKind(v) {
  if (!v || !v.onBed) return null;
  if (v.phase === 'flatheld') return 'front';
  if (v.phase === 'cradle') return 'back';
  return null;
}

/** Her own pick (from `revDecide`): stern, you lying on the cot. */
function rvpCands(ctx, D) {
  if (rvp.M || rvp.after || rvpFree(false) !== true) return [];
  if (rev.clock - rvp.last < RVP.cool) return [];
  if (D.last.slice(-5).some((x) => /^pin/.test(x))) return [];
  const m = rvpMood();
  const want = Math.max(0, m.s - 0.45) * 1.8 + Math.max(0, m.e - 0.5) * 0.5;
  if (want < 0.06) return [];
  const v = revView();
  const k = rvpKind(v);
  if (k) return [{ id: 'pin', s: 0.2 + 0.8 * want }];
  return [];
}

/** Her pick, from `revDecide`. */
function rvpChoose(id, why) { return rvpStart(why); }

/**
 * Asked (a beg, `rmoodBeg('pin')`). On the cot face down or up, now; on it
 * some other way, on your tummy first; off it, on the cot first. Answers
 * { ok, label }.
 */
function rvpAsk() {
  if (!rev.on) return { ok: false, label: 'roles are not reversed' };
  if (rev.care) return { ok: false, label: 'aftercare' };
  if (rvp.M) {
    // Already: firmer, now.
    if (rvp.M.ph === 'hold') { rvp.M.fixAt = 0; rvp.M.extra = (rvp.M.extra || 0) + 8; return { ok: true, label: 'Chloe: already on you — and a little longer for asking' }; }
    return { ok: true, label: 'Chloe: already' };
  }
  if (typeof rvkBeltOut === 'function' && rvkBeltOut()) {
    rvkAsk('beltback');
    rvp.after = { until: rev.clock + 24, asked: true };
    return { ok: true, label: 'Chloe: her belt back on, then on top of you' };
  }
  if (typeof rvkCollarOn === 'function' && rvkCollarOn()) {
    rvkCollarEnd('begged');
    rvp.after = { until: rev.clock + 24, asked: true };
    return { ok: true, label: 'Chloe: the collar off, then on top of you' };
  }
  // Lying behind you (the spoon): she gets up first, then has you on your tummy.
  if (typeof rvm !== 'undefined' && rvm.move && rvm.move.id === 'spoon') {
    rvmEnd('asked to be pinned');
    rvp.after = { until: rev.clock + 30, asked: true, order: true };
    return { ok: true, label: 'Chloe: up off the cot first, then on top of you' };
  }
  const v = revView();
  const k = rvpKind(v);
  if (!k) {
    rvp.after = { until: rev.clock + 24, asked: true };
    if (v && v.ctx === 'front' && v.phase !== 'flatheld') { revAsk('flat'); return { ok: true, label: 'Chloe: all the way on the cot first' }; }
    if (v && v.ctx && typeof revOrder === 'function' && !rev.dom.order) revOrder(v.onBed ? 'front' : 'cot', 'pin');
    return { ok: true, label: 'Chloe: ' + (v && v.onBed ? 'on your tummy first (3)' : 'on the cot first (2)') };
  }
  const r = rvpStart('asked');
  return r === true ? { ok: true, label: 'Chloe: ' + (k === 'front' ? 'climbing on to your back' : 'down by your head, your wrists') }
    : { ok: false, label: 'pin: ' + r };
}

/**
 * The safeword's frame (`rvpSafe`): how many frames before her palms are
 * more than 5 cm off your wrists — counted here, every frame, since face up
 * the pin itself is over on the safeword's own frame.
 */
function rvpSafeCheck() {
  const K = rvp.safeChk;
  if (!K) return;
  K.n++;
  const off = ['L', 'R'].every((s) => { const pm = rvmPalm(s, new THREE.Vector3()); return !pm || pm.distanceTo(K.W[s]) > 0.05; });
  if (off || K.n > 120) {
    K.M.safe.free = off ? K.n : null; K.M.safe.freeT = +(rev.clock - K.t).toFixed(3);
    if (rvp.stats && rvp.stats.safe === K.M.safe) rvp.stats.safe = Object.assign({}, K.M.safe);
    rvp.safeChk = null;
  }
}

/** After an order or a put-away: start once you are lying down and she is free. */
function rvpAfterTick() {
  rvpSafeCheck();
  const A = rvp.after;
  if (!A) return;
  if (rev.clock > A.until || rev.care) { rvp.after = null; return; }
  if (rvp.M || rev.arm.mode === 'spank' || (typeof rvkBusy === 'function' && rvkBusy())) return;
  if (typeof rvm !== 'undefined' && rvm.move) return;
  const v = revView();
  const k = rvpKind(v);
  if (!k) {
    // Up off the cot after the spoon: her order on to your tummy, once.
    if (A.order && v && v.onBed && !rev.dom.order && typeof revOrder === 'function') { A.order = false; A.until = rev.clock + 24; revOrder('front', 'pin'); }
    A.kind = null;
    return;
  }
  // Held a moment, and not on the way through it (rolling from your side to
  // your tummy passes your back — MEASURED, she began the face-up pin there).
  if (rev.dom.order) return;
  if (A.kind !== k) { A.kind = k; A.since = rev.clock; return; }
  if (rev.clock - A.since < 0.8) return;
  rvp.after = null;
  rvpStart(A.asked ? 'asked (after)' : 'mood (after)');
}

// ── start ────────────────────────────────────────────────────────────────────

/** Start. Answers true or why not. */
function rvpStart(why = 'mood') {
  const asked = /^asked|^probe/.test(why);
  const fr = rvpFree(asked);
  if (fr !== true) return fr;
  const v = revView();
  const kind = rvpKind(v);
  if (!kind) return 'not lying on the cot';
  if (v.leash && v.leash.clipped) return 'on the leash';
  const G = rvpGeom();
  if (!G) return 'no cot';
  if (typeof rvm !== 'undefined' && rvm.move) {
    if (!asked) return 'busy';
    if (rvm.move.id === 'spoon') return 'busy';
    rvmEnd('asked to be pinned');
    if (rvm.move) return 'busy';
  }
  if (rev.arm.mode === 'spank') { if (!asked) return 'busy'; rev.arm.mode = null; rev.arm.ph = 'rise'; }
  const m = rvpMood();
  const M = { id: 'pin', kind, ph: 'go', t: 0, t0: 0, why, asked, mood0: m, ctx: null, dur: 9999,
    holdFor: m.hold, rounds: m.rounds, spanks: 0, roundsDone: 0, squirms: 0, fixes: 0, strokes: 0, remotes: 0, lines: 0,
    lean: 0, leanTo: 0, sit: 1, sitTo: 1, seatY: null, kneeY: [RVP.kneeY0, RVP.kneeY0], kneeOut: RVP.kneeOut, kneeA: RVP.kneeA,
    bk: 0, ck: 0, gripK: 0, squirm: 0, sqT: -1, fixAt: -1, nextAct: 2.0 + Math.random() * 1.5,
    twist: 0, side: 0, back: 0, hold1: null, stroke: null,
    log: [], gap: { min: 9, by: {}, at: null }, gapIn: 0, kneeLow: [9, 9], kneeLowMin: 9, wall: 0, wallD: 0, furn: 0,
    pp: [], palm: { L: [], R: [] }, bodyIn: 0, measAt: 0, timing: {}, said: [], seatLog: [] };
  if (kind === 'front') {
    const S = rvpStand(G);
    if (!S) return 'no room beside the cot';
    M.stand = S;
    revGo(S.x, S.z);
    rev.ch.face = new THREE.Vector3(S.x - S.out.x * 3, rev.ch.y, S.z - S.out.z * 3);
  } else {
    // Kneeling at your head, on the floor: the kneel plan with both hands on
    // your wrists where they will be.
    const W = rvpUpWrists(G);
    // Her right hand on whichever wrist is on her right where she kneels: both ways planned, the better kept.
    // From beyond your head if the room has floor there (your wrists either
    // side of her, in front of her), else from the cot's side.
    // Close in to the cot's end: from further off her bow brought her head
    // down on to yours (MEASURED, 79 mm into it at 0.64 m).
    const o = { mode: 'kneel', prefer: G.H.clone(), preferK: 3, bowMax: 1.15, headR: 0.18, reach: 0.47, ring: [0.38, 0.44, 0.50, 0.58, 0.66] };
    const P1 = rvmPlan([{ s: 'R', T: W.R.T, n: _rvpUP }, { s: 'L', T: W.L.T, n: _rvpUP }], o);
    const P2 = rvmPlan([{ s: 'R', T: W.L.T, n: _rvpUP }, { s: 'L', T: W.R.T, n: _rvpUP }], o);
    const P = P1 && (!P2 || P1.score <= P2.score) ? P1 : P2;
    if (!P) return 'no place to kneel by your head';
    M.swap = P === P2;
    M.plan = P;
    rvmGoPlan(P);
  }
  if (typeof rvm !== 'undefined') { rvm.move = M; rvm.body.bowTo = 0; }
  rvp.M = M;
  rvp.last = rev.clock; rvp.n++;
  rvp.after = null;
  rvpTrace({ pick: 'pin:' + kind, why, tone: m.tone, hold: +m.hold.toFixed(1), rounds: m.rounds, weight: Math.round(m.weight) });
  return true;
}

/** Where she stands to climb on: beside the cot on the room side, level with her seat. */
function rvpStand(G) {
  const Mt = G.Mt, out = Mt.out.clone();
  const seat = rvpAt(G, RVP.seatAlong, 0, Mt.top);
  const across = (seat.x - Mt.mid.x) * out.x + (seat.z - Mt.mid.z) * out.z;
  for (const da of [0, 0.10, -0.10, 0.2, -0.2]) {
    const P = seat.clone().addScaledVector(out, Mt.half - across + RVP.standOut).addScaledVector(G.H, da);
    const [qx, qz] = ground.confine ? ground.confine(P.x, P.z, rev.ch.y) : [P.x, P.z];
    if (Math.hypot(qx - P.x, qz - P.z) > 0.02 || !jadrija.kabina.room(P.x, P.z, 0.12)) continue;
    return { x: P.x, z: P.z, out, da };
  }
  return null;
}

/** Face up: your palms up by your head, either side of it, on the foam. */
function rvpUpWrists(G) {
  const o = {};
  for (const s of ['L', 'R']) {
    const sg = s === 'R' ? 1 : -1, Sh = s === 'R' ? G.SR : G.SL;
    const T = new THREE.Vector3(Sh.x + G.H.x * RVP.upFwd + G.lat.x * sg * RVP.upOut, G.top + 0.03,
      Sh.z + G.H.z * RVP.upFwd + G.lat.z * sg * RVP.upOut);
    o[s] = { T };
  }
  return o;
}

// ── her body, on the cot ─────────────────────────────────────────────────────
//
// Face down she is this file's from the first step of the climb to her feet
// on the floor again: her clip (`submit` held at its KNEEL key, both knees
// down and her back upright — 2c's kneel — and `idle` again at the end), her
// pelvis put where the pin puts it (`rvpDrive`, her root worked back from it
// off the drawn pose), her whole figure tipped forward by the lean, her back
// bowed, turned and bent by her own aims, and her legs solved on to the
// points below (`rvpKneelLeg`).

/** `rvmBody`'s answer while the pin has her body: the clip, its fade. */
function rvpBody(dt) {
  const M = rvp.M;
  if (!M || !M.body) return null;
  const st = you.fig.state;
  if (M.clip === 'submit' && st && st.cur && you.fig.playing() === 'submit' && st.curT > RVM.kneelT) st.curT = RVM.kneelT;
  return { clip: M.clip || 'submit', fade: M.clipFade || 0.5, speed: 1 };
}

/**
 * The drive's part (`revDriveChloe`): her root and turn this frame, worked
 * back from where her pelvis goes. Put on her mesh now as well, so every
 * solve this frame reads it (`you.tick` puts the same again).
 */
function rvpDrive() {
  const M = rvp.M;
  if (!M || !M.body || !you || !you.fig) return null;
  const B = M.body;
  const q = rvpQuat(B.yaw, B.pitch || 0, B.roll || 0);
  const f = you.fig, pi = f.boneIndex('pelvis');
  const off = f.boneAt(pi, _rvpA).clone().multiply(you.mesh.scale).applyQuaternion(q);
  const at = B.P.clone().sub(off);
  you.mesh.position.copy(at); you.mesh.quaternion.copy(q); you.mesh.updateMatrixWorld();
  rvp.seat = { at, quat: q };
  return rvp.seat;
}

/** Her leg `s` ('L' | 'R') this frame: hip (world), the clip's chain, the lengths. */
function rvpLimb(s) {
  const C = rvsLimb(you.fig, 'legU' + s, 'legL' + s, 'foot' + s);
  return { C, S: C.S.clone().applyMatrix4(you.mesh.matrixWorld), l1: C.l1, l2: C.l2 };
}

/** Slerp of two unit vectors. */
function rvpSlerp(a, b, k) {
  const d = Math.max(-1, Math.min(1, a.dot(b)));
  const th = Math.acos(d);
  if (th < 1e-4) return a.clone().lerp(b, k).normalize();
  const s = Math.sin(th);
  return a.clone().multiplyScalar(Math.sin((1 - k) * th) / s).addScaledVector(b, Math.sin(k * th) / s).normalize();
}

/** Two bones from hip `S` to ankle `A` (world), the knee toward `pole`: the thigh's and the shin's ways. */
function rvpTwo(S, A, l1, l2, pole) {
  const D = A.clone().sub(S);
  const dl = Math.min(Math.max(D.length(), Math.abs(l1 - l2) + 1e-3), (l1 + l2) * 0.999);
  const u = D.normalize();
  const ca = Math.max(-1, Math.min(1, (l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl)));
  const v = pole.clone().addScaledVector(u, -pole.dot(u));
  if (v.lengthSq() < 1e-8) v.set(0, 1, 0).addScaledVector(u, -u.y);
  v.normalize();
  const dT = u.clone().multiplyScalar(ca).addScaledVector(v, Math.sqrt(1 - ca * ca));
  const K = S.clone().addScaledVector(dT, l1);
  const W = S.clone().addScaledVector(u, dl);
  return { dT, dS: W.sub(K).normalize() };
}

/**
 * Kneeling astride, leg on `side` of your midline: the knee on the mattress
 * (`kneeOut` m out, its joint `ky` over the top) as far forward of her hip as
 * her thigh makes it, and the shin back along the foam, splayed out a little,
 * the ankle on it. Answers the two ways and the points.
 */
function rvpKneelLeg(G, L, side, ky, kneeOut, kneeA) {
  const S = L.S, l2 = L.l2;
  const K = rvpAt(G, kneeA, side * kneeOut, G.top + ky);
  const back = G.H.clone().negate().addScaledVector(G.lat, -side * RVP.ankleIn / l2).normalize();
  const A = rvsAtHeight(K, K.clone().addScaledVector(back, l2), l2, G.top + RVP.ankleY);
  return { dT: K.clone().sub(S).normalize(), dS: A.clone().sub(K).normalize(), K, A };
}

/**
 * HER HIPS, kneeling astride with her knees where they are: `sit` 1 her seat
 * on your back (at the height the skin says, `seatY`), 0 kneeling up off it
 * by `upH` — and as far back of her knees as her thighs make it at that
 * height. Answers where her pelvis bone goes (world), and the hips' along.
 */
function rvpHipPose(M, G, sit) {
  const f = you.fig, Mw = you.mesh.matrixWorld;
  const hL = f.boneAt(f.boneIndex('legUL'), new THREE.Vector3()).applyMatrix4(Mw);
  const hR = f.boneAt(f.boneIndex('legUR'), new THREE.Vector3()).applyMatrix4(Mw);
  const pv = f.boneAt(f.boneIndex('pelvis'), new THREE.Vector3()).applyMatrix4(Mw);
  const mid = hL.clone().lerp(hR, 0.5), off = pv.sub(mid), hw = hL.distanceTo(hR) / 2;
  const l1 = M.l1 || 0.443;
  const kY = G.top + (M.kneeY[0] + M.kneeY[1]) / 2;
  const sY = M.seatY != null ? M.seatY : G.top + 0.31;
  const db = M.kneeOut - hw;
  // Kneeling up no higher than her thighs reach with her knees still on the
  // foam (`upFa` m of them forward of her hips): a seat that had risen while
  // she sat up to spank lifted her knees 6 cm off it and her hands 12 cm
  // short of your wrists, MEASURED.
  const hjMax = kY + Math.sqrt(Math.max(0.01, l1 * l1 - db * db - RVP.upFa * RVP.upFa));
  const hj = Math.min(sY - off.y + RVP.upH * (1 - sit), sit < 0.5 ? hjMax : 9);
  const dy = hj - kY;
  const fa = Math.sqrt(Math.max(0.05 * 0.05, l1 * l1 - db * db - dy * dy));
  M.hipA = M.kneeA - fa;
  return rvpAt(G, M.hipA, 0, hj).add(off);
}

/** Her leg `s` laid on the ways `dT`, `dS` (world), `k` 0..1 of the way from her clip's. */
function rvpLayLeg(s, L, dT, dS, k) {
  const f = you.fig, Mi = new THREE.Matrix4().copy(you.mesh.matrixWorld).invert();
  const K = L.S.clone().addScaledVector(dT, L.l1), A = K.clone().addScaledVector(dS, L.l2);
  const C = L.C;
  const Gf = A.clone().applyMatrix4(Mi);
  const Kf = K.clone().applyMatrix4(Mi);
  const G = C.W.clone().lerp(Gf, k);
  const pole = C.E.clone().sub(C.S).lerp(Kf.sub(C.S), k);
  jadrija.hingeArm(f, 'legU' + s, 'legL' + s, C.S, C.E, C.W, C.hinge, G, pole);
  rvp.legsOn = true;
  return { K, A };
}
function rvpLegsFree() {
  if (!rvp.legsOn || !you || !you.fig) return;
  for (const n of ['legUL', 'legLL', 'legUR', 'legLR']) you.fig.aim(n, 0, 0, 1, 0);
  rvp.legsOn = false;
}

/** Her back: the bow (forward +), the turn (to her right +), the bend to her right (+) and back (+), up her spine. */
const RVP_SPINE = ['spine01', 'spine02', 'spine03'], RVP_SH = [0.30, 0.35, 0.35];
function rvpSpine(bow, twist, side, back) {
  const f = you.fig;
  if (Math.abs(bow) + Math.abs(twist) + Math.abs(side) + Math.abs(back) < 1e-3) {
    if (rvp.spineOn) { for (const n of RVP_SPINE) f.aim(n, 0, 0, 1, 0); rvp.spineOn = false; }
    return;
  }
  for (let i = 0; i < 3; i++) {
    const k = RVP_SH[i];
    const q = new THREE.Quaternion().setFromAxisAngle(_rvpUP, -twist * k)
      .multiply(_rvpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), side * k))
      .multiply(_rvpQ2.setFromAxisAngle(new THREE.Vector3(0, 0, -1), (bow - back) * k));
    armAimQ(f, RVP_SPINE[i], q);
  }
  rvp.spineOn = true;
}

// ── the climb ────────────────────────────────────────────────────────────────

/**
 * ON TO THE COT AND OFF IT, at `u` 0 (on her feet beside it) .. 1 (kneeling
 * astride you, settled). The same road both ways — off is `u` going back:
 *   0 → 0.32  her near knee up on to the mattress beside your waist, her
 *             weight going on to it; she turns along you;
 *   0.32→0.72 her other leg over your back, the knee lifted high and the
 *             shin folded under it, and down on the far side;
 *   0.72→1    down on to both knees, her seat on to your back.
 * Her other foot stays where it stood until it leaves the floor.
 */
function rvpClimb(M, G, u) {
  const C = M.climb;
  const sm = rvpSm;
  const e1 = sm(u / 0.32), e2 = sm((u - 0.32) / 0.40), e3 = sm((u - 0.72) / 0.28);
  const seat = rvpHipPose(M, G, 1);
  // Kneeling up as high as her thighs go with her knees where they will be
  // (0.44 m over the foam): lower, the near thigh went through your side as
  // her hips came over you (MEASURED, 39 mm).
  const P1 = rvpAt(G, M.kneeA - 0.18, C.near * 0.16, G.top + 0.42);
  const P2 = rvpAt(G, M.kneeA - 0.12, C.near * 0.03, G.top + 0.445);
  let P;
  if (u < 0.32) P = C.P0.clone().lerp(P1, e1);
  else if (u < 0.72) P = P1.clone().lerp(P2, e2);
  else P = P2.clone().lerp(seat, e3);
  const dy = Math.atan2(Math.sin(C.yaw1 - C.yaw0), Math.cos(C.yaw1 - C.yaw0));
  const yaw = C.yaw0 + dy * sm(u / 0.6);
  const pitch = 0.22 * Math.sin(Math.PI * Math.min(1, u / 0.85));
  M.body = { P, yaw, pitch, roll: 0 };
  return M.body;
}


/** Her legs through the climb, at `u` (see `rvpClimb`); `k` the solve's weight. */
function rvpClimbLegs(M, G, u, k) {
  const C = M.climb, out = {};
  const sm = rvpSm;
  const fwd = new THREE.Vector3(-Math.sin(M.body.yaw), 0, -Math.cos(M.body.yaw));
  for (const s of ['L', 'R']) {
    const L = rvpLimb(s);
    const side = s === 'R' ? C.rSide : -C.rSide;
    const fin = rvpKneelLeg(G, L, side, M.kneeY[s === 'L' ? 0 : 1], M.kneeOut, M.kneeA + (M.kneeAdj ? M.kneeAdj[s] : 0));
    const st = rvpTwo(L.S, C.foot[s], L.l1, L.l2, fwd.clone().add(new THREE.Vector3(0, 0.05, 0)));
    let dT, dS;
    if (side === C.near) {
      // Her near leg: the knee up on to the mattress first, her foot out to
      // the side behind her, off the cot — then the shin swept in on to the
      // foam above its top. (Slerped straight from standing to kneeling, the
      // foot swept through the cot's side, 24 cm under the top, MEASURED.)
      const mS = G.Mt.out.clone().multiplyScalar(0.75).addScaledVector(G.H, -0.6).add(new THREE.Vector3(0, 0.12, 0)).normalize();
      dT = rvpSlerp(st.dT, fin.dT, sm(u / 0.22));
      dS = u < 0.18 ? rvpSlerp(st.dS, mS, sm(u / 0.18)) : rvpSlerp(mS, fin.dS, sm((u - 0.18) / 0.14));
    } else if (u < 0.16) {
      dT = st.dT; dS = st.dS;
    } else {
      // The far leg: up off the floor on her own side first, the knee lifted
      // in front of her and the shin folded under it; over your back like
      // that; and down on the far side. (Swung straight from her foot on the
      // floor, the leg went through you, MEASURED.)
      // (The knee less far forward than first cut: it came down on your arm up by your head, MEASURED;
      // and the shin folded flatter, the foot above the mattress's top all the way over.)
      const mT = (sd) => G.H.clone().multiplyScalar(0.50).add(new THREE.Vector3(0, 0.45, 0)).addScaledVector(G.lat, sd * 0.25).normalize();
      const mS = (sd) => G.H.clone().multiplyScalar(-0.92).add(new THREE.Vector3(0, -0.25, 0)).addScaledVector(G.lat, sd * 0.1).normalize();
      if (u < 0.32) { const e = sm((u - 0.16) / 0.16); dT = rvpSlerp(st.dT, mT(C.near), e); dS = rvpSlerp(st.dS, mS(C.near), e); }
      else if (u < 0.54) { const e = sm((u - 0.32) / 0.22); dT = rvpSlerp(mT(C.near), mT(side), e); dS = rvpSlerp(mS(C.near), mS(side), e); }
      else { const e = sm((u - 0.54) / 0.18); dT = rvpSlerp(mT(side), fin.dT, e); dS = rvpSlerp(mS(side), fin.dS, e); }
    }
    out[s] = rvpLayLeg(s, L, dT, dS, k);
  }
  return out;
}

/** Kneeling astride, settled: both legs on their points. */
function rvpKneelLegs(M, G) {
  const C = M.climb, out = {};
  for (const s of ['L', 'R']) {
    const L = rvpLimb(s);
    const side = s === 'R' ? C.rSide : -C.rSide;
    const fin = rvpKneelLeg(G, L, side, M.kneeY[s === 'L' ? 0 : 1], M.kneeOut, M.kneeA + (M.kneeAdj ? M.kneeAdj[s] : 0));
    out[s] = rvpLayLeg(s, L, fin.dT, fin.dS, 1);
  }
  return out;
}

/** On her feet beside the cot again: her legs to where they stood, `k` of the way. */
function rvpStandLegs(M, k) {
  const C = M.climb, out = {};
  const fwd = new THREE.Vector3(-Math.sin(M.body.yaw), 0, -Math.cos(M.body.yaw));
  for (const s of ['L', 'R']) {
    const L = rvpLimb(s);
    const st = rvpTwo(L.S, C.foot[s], L.l1, L.l2, fwd.clone().add(new THREE.Vector3(0, 0.05, 0)));
    out[s] = rvpLayLeg(s, L, st.dT, st.dS, k);
  }
  return out;
}

// ── your wrists, and her hands on them ───────────────────────────────────────

/**
 * Where your palms go, held: face down, by your head (`bFwd` toward it from
 * your shoulder, `bOut` out from it) palms on the foam; face up, together
 * above your head (`rvpUpWrists`). Lifted `up` m off it by a struggle.
 */
function rvpBayeTargets(M, G) {
  const out = {};
  const lift = M.sqUp || 0;
  if (M.kind === 'front') {
    for (const s of ['L', 'R']) {
      const sg = s === 'R' ? 1 : -1, Sh = s === 'R' ? G.SR : G.SL;
      const T = new THREE.Vector3(Sh.x + G.H.x * RVP.bFwd + G.lat.x * sg * RVP.bOut, G.top + 0.016 - (M.pressNow || 0) + lift,
        Sh.z + G.H.z * RVP.bFwd + G.lat.z * sg * RVP.bOut);
      const p = RVP.bPole;
      const pole = G.lat.clone().multiplyScalar(sg * p[0]).addScaledVector(G.H, p[1]).add(new THREE.Vector3(0, p[2], 0));
      out[s] = { T, pole };
    }
  } else {
    const W = rvpUpWrists(G);
    for (const s of ['L', 'R']) {
      const sg = s === 'R' ? 1 : -1;
      const T = W[s].T.clone();
      T.y = (M.upY != null ? M.upY : T.y) - (M.pressNow || 0) + lift;
      const pole = G.lat.clone().multiplyScalar(sg * 0.75).add(new THREE.Vector3(0, 0.55, 0)).addScaledVector(G.H, -0.2);
      out[s] = { T, pole };
    }
  }
  return out;
}

/** Your arms to the held place, `k` of the way, from where they were (`M.from`) over the take. */
function rvpBayeArms(M, G, k, take) {
  if (typeof rvhBayeArm !== 'function') return;
  const Tg = rvpBayeTargets(M, G);
  for (const s of ['L', 'R']) {
    const T = M.from && M.from[s] && take < 1 ? M.from[s].clone().lerp(Tg[s].T, rvpSm(take)) : Tg[s].T;
    rvhBayeArm(s, T, Tg[s].pole, k);
  }
  rvp.bArms = k > 0.01;
}

/**
 * The back of your wrist (face down) or its top (face up), world, and the
 * way out of it: the highest of your skin within 2.5 cm of a point 2 cm up
 * your forearm from the wrist, measured off your mesh and carried on the
 * hand bone after (`M.dors`, refreshed at each measure).
 */
function rvpWristTop(M, s, BS, dir = null) {
  const f = jadrija.figure, hi = f.boneIndex('hand' + s), li = f.boneIndex('armL' + s);
  const W = f.boneAt(hi, new THREE.Vector3()).applyMatrix4(f.mesh.matrixWorld);
  const E = f.boneAt(li, new THREE.Vector3()).applyMatrix4(f.mesh.matrixWorld);
  const q = f.boneTurn(hi, new THREE.Quaternion()).premultiply(f.mesh.quaternion);
  M.dors = M.dors || {};
  if (BS) {
    const P = W.clone().addScaledVector(E.clone().sub(W).normalize(), 0.02);
    const regs = s === 'L' ? { 2: 1, 4: 1 } : { 3: 1, 5: 1 };
    // The vertex itself (MEASURED: its height over the bone's own line was
    // 16 mm off the skin, the forearm not round under it).
    const T = new THREE.Vector3();
    const y = dir ? rvpExtAt(BS, P, 0.03, regs, dir, T) : rvpTopAt(BS, P, 0.022, regs, T);
    if (y > -8) M.dors[s] = T.sub(W).applyQuaternion(q.clone().invert());
  }
  const off = M.dors[s] ? M.dors[s].clone().applyQuaternion(q) : new THREE.Vector3(0, 0.03, 0);
  return { T: W.clone().add(off), W, E };
}

/**
 * Face down: the way out of your wrist where her palm meets it — its top and
 * its outer side (`sg` your side). Her arms come down to you near straight up
 * and down, and a palm laid flat on top of your wrist bent her hand 117-125
 * degrees back off her forearm (MEASURED); tipped to the wrist's outside, her
 * fingers run on down her forearm's line round it.
 */
function rvpGripN(G, sg) { return G.lat.clone().multiplyScalar(0.8 * sg).add(new THREE.Vector3(0, 0.6, 0)).normalize(); }

/** Her hand `s` on your wrist `s`: her palm on its top, her fingers round it. */
function rvpGrip(M, G, s, k = 1) {
  // Her hand `s`; your wrist `w` (face up she may have planned it crossed over).
  const w = M.swap ? (s === 'R' ? 'L' : 'R') : s;
  const D = rvpWristTop(M, w, null);
  const sg = w === 'R' ? 1 : -1;
  const fore = D.E.clone().sub(D.W).setY(0).normalize();
  // Her fingers on along her arm's own line, round your wrist (the solve lays
  // them on the skin): the least turn of her hand off her forearm.
  const shS = rvmShoulder(s, new THREE.Vector3());
  let d = shS ? D.T.clone().sub(shS).normalize() : G.H.clone();
  void fore;
  // The skin's way out where she holds it: up, tipped back toward her (face
  // down) — her arm comes down steeply from over you, and a palm laid flat
  // on top turned her hand 117-125 degrees back off her forearm (MEASURED).
  const nS = M.kind === 'front' ? rvpGripN(G, sg) : _rvpUP.clone();
  const C = D.T.clone().addScaledVector(nS, RVP.palmOff - (M.gripPress || 0));
  const pole = M.kind === 'front'
    ? G.lat.clone().multiplyScalar(sg * 0.75).add(new THREE.Vector3(0, 0.6, 0)).addScaledVector(G.H, -0.15)
    : (() => { const { r } = rvmAxes(rev.ch.yaw); return r.clone().multiplyScalar(s === 'R' ? 0.8 : -0.8).add(new THREE.Vector3(0, 0.5, 0)); })();
  rvmAsk(s, { C, n: nS, d, pole, cock: 0, shape: M.gripShape || 'hip', rate: 6 * k + 1, fb: true });
  M.want = M.want || {};
  M.want[s] = C;
  return C;
}

// ── the frame ────────────────────────────────────────────────────────────────

/** The pin, a frame — from `rvmMoveTick` (after her body is placed, before her arms are solved). */
function rvpTick(M, dt) {
  rvp.frame = (rvp.frame || 0) + 1;
  M.clk = (M.clk || 0) + dt;
  const v = revView();
  const G = rvpGeom();
  if (!G) { rvpOut(M, 'no cot'); return; }
  const kind = rvpKind(v);
  // You out of the pose (a key, a word): she lets go and gets off.
  if (kind !== M.kind && !/^(release|off|stand|out)$/.test(M.ph)) rvpRelease(M, 'you moved: ' + (v ? v.phase : '?'));
  M.G = G;
  const m = M.mood = rvpMood();
  // Struggle and her answer to it (a frame).
  rvpSquirmTick(M, dt);
  if (M.kind === 'front') rvpFrontTick(M, G, m, dt, v);
  else rvpBackTick(M, G, m, dt, v);
  if (rvp.measure && M.clk >= M.measAt && M.ph !== 'go') { M.measAt = M.clk + RVP.every; rvpMeasure(M, G); }
}

/** FACE DOWN: to the cot's side, on, settled, held, off, on her feet. */
function rvpFrontTick(M, G, m, dt, v) {
  const P = RVP;
  if (M.ph === 'go') {
    let dy = rvpYaw(M.stand.out.clone().negate()) - rev.ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if ((revAt() && Math.abs(dy) < 0.15) || M.t > P.goT) {
      const f = you.fig;
      const pw = (n) => f.boneAt(f.boneIndex(n), new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld);
      const yaw1 = rvpYaw(G.H);
      const rC = new THREE.Vector3(-G.H.z, 0, G.H.x);
      M.climb = { P0: pw('pelvis'), foot: { L: pw('footL'), R: pw('footR') }, yaw0: rev.ch.yaw, yaw1,
        rSide: Math.sign(rC.dot(G.lat)) || 1, near: Math.sign(G.Mt.out.dot(G.lat)) || 1 };
      M.foot0 = { L: M.climb.foot.L.clone(), R: M.climb.foot.R.clone() };
      // Her seat's height off your back's skin, a first guess (refined on the skin, `rvpMeasure`).
      const BS = rvsBayeSkin(2);
      const seatL = rvpAt(G, P.seatAlong, 0, 0);
      const top = BS ? rvpTopAt(BS, seatL, 0.07, { 0: 1 }) : G.top + 0.2;
      M.backTop = top;
      // (Her thighs are on your sides before her seat is on your back: higher than the seat alone says.)
      M.seatY = top + 0.20;
      M.l1 = rvsLimb(you.fig, 'legUL', 'legLL', 'footL').l1;
      rvm.body.mode = 'pin'; rvm.body.want = 'pin'; rvm.body.t = 0; rvm.body.bowTo = 0; rvm.body.bow = 0;
      M.clip = 'submit'; M.clipFade = 0.7;
      rev.ch.face = null; rev.ch.goal = null;
      M.ph = 'on'; M.t0 = M.t; M.timing.on = +rev.clock.toFixed(2);
      // Your hands up by your head as she comes: her knees go where your arms lay.
      M.from = { L: rvhBayePalm('L', new THREE.Vector3()), R: rvhBayePalm('R', new THREE.Vector3()) };
      rvpClimb(M, G, 0);
      rvpTrace({ pick: 'pin:on', why: 'climbing on', backTop: +(top - G.top).toFixed(3) });
    }
    return;
  }
  if (M.ph === 'on') {
    M.u = Math.min(1, (M.t - M.t0) / P.onT);
    M.ik = Math.min(1, (M.t - M.t0) / 0.35);
    rvpClimb(M, G, M.u);
    rvpClimbLegs(M, G, M.u, M.ik);
    rvpSpine(0, 0, 0, 0);
    rvpClimbHands(M, G, M.u);
    rvpBayeArms(M, G, Math.min(1, M.u / 0.08), Math.min(1, M.u / 0.18));
    if (M.u >= 1) { M.ph = 'settle'; M.t0 = M.t; M.timing.onEnd = +rev.clock.toFixed(2); M.from = null; }
    return;
  }
  if (M.ph === 'off') {
    const T = M.safe ? P.offSafeT : P.offT;
    M.u = Math.max(0, 1 - (M.t - M.t0) / T);
    rvpClimb(M, G, M.u);
    rvpClimbLegs(M, G, M.u, 1);
    rvpSpine(0, 0, 0, 0);
    rvpClimbHands(M, G, M.u);
    // Your arms where they are until she is off you (eased down under her
    // knees, they swept through them, MEASURED); then down.
    rvpBayeArms(M, G, 1, 1);
    if (M.u <= 0) { M.ph = 'stand'; M.t0 = M.t; M.clip = 'idle'; M.clipFade = 0.6; M.timing.offEnd = +rev.clock.toFixed(2); }
    return;
  }
  if (M.ph === 'stand') {
    const tt = M.t - M.t0;
    M.body = { P: M.climb.P0.clone(), yaw: M.climb.yaw0, pitch: 0, roll: 0 };
    rvpStandLegs(M, Math.max(0, 1 - Math.max(0, tt - 0.45) / 0.3));
    rvpBayeEase(M, G, dt);
    if (tt > P.standT) rvpDone(M);
    return;
  }
  // ── on you: settle, hold, release ──
  if (M.ph === 'settle') {
    const e = rvpSm((M.t - M.t0) / P.settleT);
    M.wK = e;
    if (M.t - M.t0 > P.settleT) {
      M.ph = 'hold'; M.t0 = M.t; M.sub = 'reach'; M.subT = 0; M.timing.hold = +rev.clock.toFixed(2);
      M.leanTo = P.lean; M.sitTo = P.sitPin;
      rvpSay('pin', true);
    }
  }
  if (M.ph === 'release') {
    M.wK = Math.max(0, (M.wK || 0) - dt / 0.5);
    M.leanTo = 0; M.reachK = 0; M.sitTo = 0.8;
    if (M.t - M.t0 > (M.safe ? 0.02 : 0.7) && M.lean < 0.12) { M.ph = 'off'; M.t0 = M.t; M.timing.off = +rev.clock.toFixed(2); }
  }
  // Her knees: up beside your ribs to hold your wrists, a hand's width
  // further forward to sit up and reach back for your bottom (with them at
  // the ribs she sits on it, or out of reach of it — MEASURED both ways).
  const spk = M.ph === 'hold' && (M.sub === 'situp' || M.sub === 'spank');
  M.kneeA = damp(M.kneeA, spk ? P.kneeASpank : P.kneeA, 3, dt);
  M.kneeOut = damp(M.kneeOut, spk ? P.kneeOutMax : P.kneeOut, 3, dt);
  // Her lean, how much she sits on you, her back.
  M.lean = damp(M.lean, M.leanTo + (M.fixLean || 0), M.safe ? 6 : 2.6, dt);
  M.sit = damp(M.sit, M.sitTo, M.safe ? 6 : 2.2, dt);
  M.reachK = damp(M.reachK || 0, M.reachTo || 0, 5, dt);
  const twist = M.reachK * P.twistMax, side = M.reachK * P.sideMax, back = M.reachK * P.backMax;
  const lean = Math.max(0, M.lean);
  M.body = { P: rvpHipPose(M, G, M.sit), yaw: M.climb.yaw1, pitch: lean * (1 - P.leanBack), roll: 0 };
  rvpSpine(lean * P.leanBack, twist, side, back);
  rvpKneelLegs(M, G);
  // Her weight on your back.
  // (Sitting, all of it on your back; kneeling up over your wrists, a share
  // on your back and the rest on her knees and your wrists.)
  const W = m.weight * (M.wK || 0) * (0.35 + 0.65 * M.sit) * (1 + 0.6 * (M.fixK || 0));
  if (W > 1 && jadrija.cotPress) {
    jadrija.cotPress('spine02', rvpAt(G, M.hipA != null ? M.hipA : P.seatAlong, 0, M.backTop || G.top + 0.2), W, dt, 0.5);
    if (jadrija.cotWake) jadrija.cotWake(0.25);
  }
  if (M.ph === 'hold') rvpHoldFront(M, G, m, dt);
  else rvpBayeArms(M, G, 1, 1);
}

/** While she is on you, face down: her hands, your wrists, what she does. */
function rvpHoldFront(M, G, m, dt) {
  const P = RVP;
  M.subT += dt;
  M.tHold = (M.tHold || 0) + dt;
  M.pressNow = M.sub === 'pin' ? m.press * Math.min(1, M.subT / 0.4) * (1 + 1.5 * (M.fixK || 0)) : 0;
  M.gripPress = 0.002 + 0.002 * m.s + 0.003 * (M.fixK || 0);
  if (M.sub === 'reach') {
    // Down on to your wrists, up by your head.
    rvpBayeArms(M, G, 1, 1);
    rvpGrip(M, G, 'L', 0.6); rvpGrip(M, G, 'R', 0.6);
    rvpLeanToReach(M, dt);
    if (M.subT > 0.9 && rvm.k.L > 0.9 && rvm.k.R > 0.9) { M.sub = 'take'; M.subT = 0; }
    return;
  }
  if (M.sub === 'take') {
    // Her weight on to them.
    const e = Math.min(1, M.subT / 0.6);
    rvpBayeArms(M, G, 1, 1);
    rvpGrip(M, G, 'L'); rvpGrip(M, G, 'R');
    rvpLeanToReach(M, dt);
    if (e >= 1) { M.sub = 'pin'; M.subT = 0; M.nextAct = M.tHold + 1.5 + Math.random() * 1.5; M.from = null; }
    return;
  }
  if (M.sub === 'pin') {
    rvpBayeArms(M, G, 1, 1);
    rvpGrip(M, G, 'L'); rvpGrip(M, G, 'R');
    rvpLeanToReach(M, dt);
    rvpActs(M, G, m);
    return;
  }
  if (M.sub === 'stroke') {
    // One hand off your wrist, into your hair; the other holds on.
    rvpBayeArms(M, G, 1, 1);
    rvpGrip(M, G, 'L');
    M.want = { L: M.want && M.want.L };
    const Hd = rvmYourHead();
    if (Hd) {
      const u = 0.5 - 0.5 * Math.cos(M.subT * Math.PI * 2 / 2.6);
      const sp = rvmHairSpot(Hd, 0.2 + u * 0.6);
      rvmAsk('R', { C: sp.T.addScaledVector(sp.n, 0.004), n: sp.n, d: G.H.clone().negate(), pole: G.lat.clone().add(new THREE.Vector3(0, 0.7, 0)),
        cock: 0.15, shape: 'soft', rate: 4 });
      if (jadrija.petTouch) jadrija.petTouch(Math.min(1, M.subT / 0.8));
    }
    rvpLeanToReach(M, dt, ['L']);
    if (M.subT > M.strokeFor) { M.sub = 'pin'; M.subT = 0.4; if (jadrija.petTouch) jadrija.petTouch(0); }
    return;
  }
  if (M.sub === 'situp') {
    // Hands off your wrists ("stay"), up off them, for her hand to your bottom.
    rvpBayeArms(M, G, 1, 1);
    rvpOwnThigh(M, 'L');
    M.leanTo = 0.12; M.sitTo = 1; M.reachTo = Math.max(M.reachTo || 0, 0.8 * Math.min(1, M.subT / 0.8));
    if ((M.lean < 0.3 && M.sit > 0.85) || M.subT > 1.8) {
      const r = rvmSpankStart(M.spankN, M.spankWhy || 'from on top', { pin: true });
      if (r === true) { M.sub = 'spank'; M.subT = 0; M.roundsDone++; M.spankHits0 = rev.slaps; }
      else { rvpTrace({ pick: 'pin:spank:' + r }); M.sub = 'reach'; M.subT = 0; M.leanTo = P.lean; M.sitTo = P.sitPin; M.reachTo = 0; }
    }
    return;
  }
  if (M.sub === 'spank') {
    rvpBayeArms(M, G, 1, 1);
    rvpOwnThigh(M, 'L');
    if (rev.arm.mode !== 'spank') {
      M.spanks += Math.max(0, rev.slaps - (M.spankHits0 != null ? M.spankHits0 : rev.slaps));
      M.sub = 'reach'; M.subT = 0; M.leanTo = P.lean; M.sitTo = P.sitPin; M.reachTo = 0;
      M.nextAct = M.tHold + 2.5 + Math.random() * 2;
    }
  }
}

/** Her lean closed on her reach to your wrists: further forward while her shoulders are short of them. */
function rvpLeanToReach(M, dt, sides = ['L', 'R']) {
  let worst = -9;
  for (const s of sides) {
    const sh = rvmShoulder(s, new THREE.Vector3());
    const C = M.want && M.want[s];
    if (!sh || !C) continue;
    worst = Math.max(worst, sh.distanceTo(C) - (RVM.reach - 0.01));
  }
  if (worst > -8) {
    M.leanTo = Math.max(0.25, Math.min(RVP.leanMax, M.leanTo + Math.max(-0.08, Math.min(0.08, worst)) * dt * 3));
    M.reachMiss = worst;
  }
}

/** Her hand resting on her own thigh (side `s`), palm down. */
function rvpOwnThigh(M, s) {
  const f = you.fig, Mw = you.mesh.matrixWorld;
  const U = f.boneAt(f.boneIndex('legU' + s), new THREE.Vector3()).applyMatrix4(Mw);
  const K = f.boneAt(f.boneIndex('legL' + s), new THREE.Vector3()).applyMatrix4(Mw);
  const along = K.clone().sub(U).normalize();
  const C = U.clone().lerp(K, 0.62).add(new THREE.Vector3(0, 0.075, 0));
  const { r } = rvmAxes(M.climb ? M.climb.yaw1 : rev.ch.yaw);
  rvmAsk(s, { C, n: _rvpUP.clone(), d: along, pole: r.clone().multiplyScalar(s === 'R' ? 0.6 : -0.6).add(new THREE.Vector3(0, 0.2, 0)),
    cock: 0, shape: 'cup', rate: 5 });
}

/** On the climb her near hand goes down on the mattress beside you, taking her weight, and comes away. */
function rvpClimbHands(M, G, u) {
  const C = M.climb;
  const k = Math.sin(Math.PI * Math.max(0, Math.min(1, (u - 0.08) / 0.7)));
  if (k < 0.05) return;
  // Her near hand (her right if her right is on the room side).
  const s = C.near === C.rSide ? 'R' : 'L';
  const T = rvpAt(G, M.kneeA - 0.08, C.near * (G.Mt.half - 0.05), G.top + 0.012);
  // Within the mattress, on the room side of you.
  rvmAsk(s, { C: T, n: _rvpUP.clone(), d: G.H.clone(), pole: G.Mt.out.clone().add(new THREE.Vector3(0, 0.4, 0)).addScaledVector(G.H, -0.3),
    cock: 0, shape: 'flat', rate: 5 * k + 1 });
}

/** Your arms back to your own, eased. */
function rvpBayeEase(M, G, dt) {
  M.bEase = damp(M.bEase == null ? 1 : M.bEase, 0, M.safe ? 7 : 4, dt);
  if (M.bEase > 0.02 && rvp.bArms) rvpBayeArms(M, G, M.bEase, 1);
  else rvp.bArms = false;
}

// ── what she does from there ─────────────────────────────────────────────────

/**
 * Her choices while she holds you, every so often (her mood's `gap`, shorter
 * in a wave of excitement): a round of spanks from on top (face down), a line,
 * her grip tightened, your hair stroked, her remote, an order to be still.
 * And a beg of yours she owes you comes first. Her mood is read afresh each
 * time, so a wave that rises mid-pin shows in what she does.
 */
function rvpActs(M, G, m) {
  // How long she holds you: stern, longer; and you begging for more, longer.
  const holdFor = M.holdFor + (M.extra || 0);
  if (M.tHold > holdFor && rev.arm.mode !== 'spank') { rvpRelease(M, 'done'); return; }
  // A spanking you begged for: now, from where she is.
  const BG = typeof rmood !== 'undefined' ? rmood.beg : null;
  if (BG && M.kind === 'front' && /spank|harder|discipline|whip/.test(BG.what)) {
    rmood.beg = null;
    rvpSpankNow(M, Math.min(8, BG.n), 'begged: ' + BG.what);
    return;
  }
  if (M.tHold < M.nextAct) return;
  const W = [];
  const toys = typeof revToys === 'function' ? revToys() : [];
  if (M.kind === 'front' && M.roundsDone < M.rounds) W.push(['spank', 1.2 + 1.5 * m.s + 1.2 * m.e]);
  W.push(['tease', 0.7 + 0.8 * m.e + 0.3 * m.g]);
  W.push(['squeeze', 0.4 + 0.9 * m.s + 0.3 * m.e]);
  if (m.stroke) W.push(['stroke', 1.8 * m.stroke]);
  if (toys.length) W.push(['remote', 0.5 + 1.2 * m.e]);
  if (!rev.dom.order) W.push(['still', 0.4 + 0.7 * m.s]);
  if (!rev.dom.order && M.kind === 'back') W.push(['look', 0.5]);
  const tot = W.reduce((a, w) => a + w[1], 0);
  let x = Math.random() * tot, pick = W[0][0];
  for (const w of W) { x -= w[1]; if (x <= 0) { pick = w[0]; break; } }
  if (M.force) { pick = M.force; M.force = null; }
  // Sooner in a wave of excitement, later when she is gentle.
  M.nextAct = M.tHold + m.gap * (0.7 + 0.6 * Math.random());
  (M.acts = M.acts || []).push([+M.tHold.toFixed(1), pick, m.tone]);
  if (pick === 'spank') {
    const n0 = 2 + Math.floor(Math.random() * 2);
    rvpSpankNow(M, typeof rmoodSpanks === 'function' ? rmoodSpanks(n0, m.s > 0.55) : n0, 'from on top');
  } else if (pick === 'tease') { if (rvpSay('pin_hold')) M.lines++; }
  else if (pick === 'squeeze') { M.fixAt = M.clk; M.fixWhy = 'squeeze'; }
  else if (pick === 'stroke') {
    M.sub = 'stroke'; M.subT = 0; M.strokeFor = 3 + 2 * m.g; M.strokes++;
    if (Math.random() < 0.6) rvpSay('stroke');
  } else if (pick === 'remote') {
    const k = toys[Math.floor(Math.random() * toys.length)];
    const lvl = Math.min(1, 0.35 + 0.4 * m.e + 0.2 * m.s);
    const r = jadrija.remote ? jadrija.remote(k, true, 4 + Math.round(5 * m.e), lvl) : 'none';
    M.remotes++;
    revSay('buzz', true, null, { still: revStill.dom });
    rvpTrace({ pick: 'pin:remote:' + k, why: String(r) + ' lvl ' + lvl.toFixed(2) });
  } else if (pick === 'still') {
    if (typeof revOrder === 'function') revOrder('still', 'pinned');
  } else if (pick === 'look') {
    if (typeof revOrder === 'function') revOrder('look', 'pinned');
  }
}

/** A round of `n` from on top: up off your wrists first (`situp`), then `rvmSpankStart`'s swing. */
function rvpSpankNow(M, n, why) {
  if (M.kind !== 'front' || M.ph !== 'hold') return false;
  M.sub = 'situp'; M.subT = 0; M.spankN = Math.max(1, n); M.spankWhy = why;
  M.want = {};
  return true;
}

/**
 * The spank from on top: her trunk turned right round to it, bent back and
 * over to that side, until her shoulder is in reach of the spot — closed on
 * her real shoulder by feedback (from `rvmSpankTick`'s ready). Answers how
 * far short it still is (m).
 */
function rvpSpankReach(sh, T, dt) {
  const M = rvp.M;
  if (!M || !sh) return 0;
  // Her palm, not her wrist, is what goes to the spot: a straight arm and the
  // palm's own 8 cm put it `spankReach` m from her shoulder (the standing
  // swing keeps to 0.44, an elbow still bent). From on top she reaches out
  // for it — MEASURED at 0.44, three spots in five given up 3-5 cm short.
  const d = sh.distanceTo(T) - (RVP.spankReach - 0.02);
  M.reachTo = Math.max(0, Math.min(1, (M.reachTo || 0) + Math.max(-0.1, Math.min(0.1, d)) * dt * 10));
  M.reachMissS = d;
  return Math.max(0, sh.distanceTo(T) - RVP.spankReach);
}

/** A spot on your bottom for a slap from on top: your near cheek on her right, from over her right shoulder. */
function rvpSpankSpot() {
  const M = rvp.M, G = M && M.G;
  if (!G) return null;
  const sh = rvmShoulder('R', new THREE.Vector3());
  if (!sh) return null;
  const sgR = M.climb ? M.climb.rSide : 1;
  const j = () => (Math.random() - 0.5);
  for (let i = 0; i < 4; i++) {
    // The top of the cheek, the near half of it (lower, and she is out of reach, MEASURED: 4-5 cm short).
    const aim = rvpAt(G, 0.04 + j() * 0.03, sgR * (0.08 + j() * 0.04), G.Pv.y + 0.06);
    const o = sh.clone().add(new THREE.Vector3(0, 0.35, 0)).addScaledVector(G.H, -0.05);
    const S = rvmCotSpot(o, aim);
    if (S && S.hit && S.hit.reg === 'butt') return S;
  }
  return null;
}

// ── your struggle, and her answer ────────────────────────────────────────────

/**
 * You struggle (W or S held while she holds you, or now and then on your
 * own): your wrists up off the foam a little, against her hands, and back —
 * and she leans in, presses them down and says so. Answers true when it was
 * a struggle (the key is not "get up").
 */
function rvpStruggle(src = 'you') {
  const M = rvp.M;
  if (!M || M.ph !== 'hold' || M.safe) return false;
  if (rev.clock - rvp.squirmKey < 1.1) return true;
  rvp.squirmKey = rev.clock;
  if (M.sqT >= 0) return true;
  M.sqT = 0; M.squirms++;
  (M.sqLog = M.sqLog || []).push([+M.tHold.toFixed(1), src]);
  if (src === 'you') rev.dom.moved += 1;
  rev.jolt = Math.min(1.4, rev.jolt + 0.25);
  return true;
}
function rvpSquirmTick(M, dt) {
  // Now and then on your own (not when she is gentle with you).
  if (M.ph === 'hold' && M.sub === 'pin' && M.sqT < 0 && !M.safe) {
    M.ownAt = M.ownAt || M.clk + 9 + Math.random() * 7;
    if (M.clk > M.ownAt) { M.ownAt = M.clk + 10 + Math.random() * 8 + 10 * M.mood0.g; if (M.mood.g < 0.6) rvpStruggle('own'); }
  }
  if (M.sqT >= 0) {
    M.sqT += dt;
    const T = RVP.squirmT;
    M.sqUp = M.sqT < T ? RVP.squirmUp * Math.sin(Math.PI * Math.min(1, M.sqT / T)) * (M.sqT > T * 0.6 ? 0.6 : 1) : 0;
    if (M.sqT > T * 0.55 && M.fixAt < M.clk - 1) { M.fixAt = M.clk; M.fixWhy = 'squirm'; }
    if (M.sqT > T) { M.sqT = -1; M.sqUp = 0; }
  }
  // Her answer: a lean in, her grip down harder, her weight — for `fixT` s.
  const ft = M.clk - (M.fixAt == null ? -9 : M.fixAt);
  const fk = M.fixAt >= 0 && ft < RVP.fixT ? Math.sin(Math.PI * ft / RVP.fixT) : 0;
  M.fixK = fk * (M.mood ? M.mood.squirmFix : 1);
  M.fixLean = 0.07 * fk;
  if (M.fixAt >= 0 && ft < dt * 1.5 && M.fixWhy) {
    M.fixes++;
    if (M.fixWhy === 'squirm') {
      rvpSay('pin_squirm', true);
      // Sterner, longer: every wriggle a few seconds more.
      if (M.mood && M.mood.s > 0.45) M.extra = (M.extra || 0) + 3 + 3 * M.mood.s;
    }
    M.fixWhy = null;
  }
}

// ── face up: kneeling at your head ───────────────────────────────────────────

function rvpBackTick(M, G, m, dt, v) {
  if (M.ph === 'go') {
    if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
    if (rvmSettled() || M.t > RVP.goT) {
      M.ph = 'hold'; M.t0 = M.t; M.sub = 'reach'; M.subT = 0; M.timing.hold = +rev.clock.toFixed(2);
      rvm.body.bowTo = M.plan.bow;
      // Your wrists' height above your head: the pillow under them, off your mesh.
      const BS = rvsBayeSkin(2);
      const W = rvpUpWrists(G);
      void BS; void W;
      M.upY = G.top + 0.025;
      rvpSay('pin', true);
    }
    return;
  }
  if (M.ph === 'release') {
    // Her hands up off your wrists, her back up, and then she stands.
    rvpBayeEase(M, G, dt);
    rvm.body.bowTo = 0;
    const tt = M.t - M.t0;
    if (!M.safe && M.want) for (const s of ['L', 'R']) {
      const C = M.want[s];
      if (C) rvmAsk(s, { C: C.clone().add(new THREE.Vector3(0, Math.min(0.25, tt * 0.5), 0)), n: _rvpUP.clone(), d: G.H.clone(), pole: G.lat.clone().multiplyScalar(s === 'R' ? 1 : -1).add(new THREE.Vector3(0, 0.5, 0)), cock: 0, shape: 'soft', rate: 6 });
    }
    if (tt > (M.safe ? 0.02 : 0.7)) rvpDone(M);
    return;
  }
  if (M.ph !== 'hold') return;
  M.subT += dt;
  M.tHold = (M.tHold || 0) + dt;
  M.pressNow = (M.sub === 'pin' || M.sub === 'stroke') ? m.press * Math.min(1, M.subT / 0.4) * (1 + 1.5 * (M.fixK || 0)) : 0;
  M.gripPress = 0.002 + 0.002 * m.s + 0.003 * (M.fixK || 0);
  const bow = () => {
    let worst = -9;
    for (const s of ['L', 'R']) {
      const sh = rvmShoulder(s, new THREE.Vector3()), C = M.want && M.want[s];
      if (sh && C) worst = Math.max(worst, sh.distanceTo(C) - (RVM.reach - 0.01));
    }
    // Her head kept clear of yours: no further down than leaves `headGap` between them.
    const cap = M.headCap != null ? M.headCap : 1.3;
    if (worst > -8) { rvm.body.bowTo = Math.max(0, Math.min(cap, rvm.body.bowTo + Math.max(-0.08, Math.min(0.08, worst)) * dt * 3 + 0.06 * (M.fixK || 0) * dt)); M.reachMiss = worst; }
  };
  if (M.sub === 'reach' || M.sub === 'take') {
    if (!M.from) M.from = { L: rvhBayePalm('L', new THREE.Vector3()), R: rvhBayePalm('R', new THREE.Vector3()) };
    const e = M.sub === 'take' ? Math.min(1, M.subT / 1.4) : 0;
    rvpBayeArms(M, G, 1, e);
    rvpGrip(M, G, 'L', 0.6); rvpGrip(M, G, 'R', 0.6);
    bow();
    if (M.sub === 'reach' && M.subT > 1.0 && rvm.k.L > 0.9 && rvm.k.R > 0.9) { M.sub = 'take'; M.subT = 0; }
    else if (M.sub === 'take' && e >= 1) { M.sub = 'pin'; M.subT = 0; M.from = null; M.nextAct = M.tHold + 1.5 + Math.random() * 1.5; }
    return;
  }
  if (M.sub === 'pin') {
    rvpBayeArms(M, G, 1, 1);
    rvpGrip(M, G, 'L'); rvpGrip(M, G, 'R');
    bow();
    rvpActs(M, G, m);
    return;
  }
  if (M.sub === 'stroke') {
    // Her left hand keeps its wrist, her right goes to your hair. (Not one
    // hand over both: up either side of your head they are 0.4 m apart, and
    // between them is your face, MEASURED.)
    rvpBayeArms(M, G, 1, 1);
    rvpGrip(M, G, 'L');
    M.want = { L: M.want && M.want.L };
    const { r } = rvmAxes(rev.ch.yaw);
    const Hd = rvmYourHead();
    if (Hd) {
      const u = 0.5 - 0.5 * Math.cos(M.subT * Math.PI * 2 / 2.6);
      const sp = rvmHairSpot(Hd, u * 0.7);
      rvmAsk('R', { C: sp.T.addScaledVector(sp.n, 0.004), n: sp.n, d: Hd.fw.clone().negate(), pole: r.clone().add(new THREE.Vector3(0, -0.3, 0)),
        cock: 0.15, shape: 'soft', rate: 4 });
      if (jadrija.petTouch) jadrija.petTouch(Math.min(1, M.subT / 0.8));
    }
    bow();
    if (M.subT > M.strokeFor) { M.sub = 'pin'; M.subT = 0.4; if (jadrija.petTouch) jadrija.petTouch(0); }
  }
}

// ── the end of it ────────────────────────────────────────────────────────────

/** She lets go: her hands off you, and (face down) off the cot the way she came. */
function rvpRelease(M, why) {
  if (/^(release|off|stand|out)$/.test(M.ph)) { if (why === 'safeword') M.safe = true; return; }
  M.outWhy = M.outWhy || why;
  if (M.want) M.want = Object.assign({}, M.want);
  if (M.ph === 'go') { rvpDone(M); return; }
  if (rev.arm.mode === 'spank') { rev.arm.mode = null; rev.arm.ph = 'rise'; }
  M.ph = 'release'; M.t0 = M.t; M.timing.release = +rev.clock.toFixed(2);
  M.sub = null; M.reachTo = 0;
  if (M.kind === 'front') M.want = {};
  if (jadrija.petTouch) jadrija.petTouch(0);
  if (why === 'done' || why === 'time') rvpSay('pin_off', true);
  rvpTrace({ pick: 'pin:release', why, held: +(M.tHold || 0).toFixed(1), spanks: M.spanks, rounds: M.roundsDone, squirms: M.squirms });
}

/** Done: everything of the pin off both of you, the move over, then whatever was asked. */
function rvpDone(M) {
  if (M.done) return;
  M.done = true;
  rvpLegsFree();
  rvpSpine(0, 0, 0, 0);
  if (rvm.body.mode === 'pin') Object.assign(rvm.body, { mode: 'stand', want: 'stand', t: 9, was: null, bow: 0, bowTo: 0 });
  if (M.climb) { rev.ch.yaw = M.climb.yaw0; }
  M.body = null; rvp.seat = null;
  M.timing.done = +rev.clock.toFixed(2);
  rvp.M = null;
  rvp.stats = rvpSummary(M);
  rvp.all.push(rvp.stats);
  if (rvp.all.length > 20) rvp.all.shift();
  rvpTrace({ pick: 'pin end', why: M.outWhy || 'done', held: rvp.stats.held, spanks: M.spanks });
  const q = M.queue, care = M.careAfter;
  if (typeof rvm !== 'undefined' && rvm.move === M) { rvm.move = null; rvm.downFor = M.kind === 'back' ? 1.0 : 0; }
  if (rev.dom && !rev.care) rev.dom.next = Math.max(rev.dom.next, rev.clock + 2 + Math.random() * 1.5);
  if (care && rev.care && typeof rvmStart === 'function') rvmStart('care', 'safeword');
  else if (q && typeof revAsk === 'function') revAsk(q);
}
function rvpOut(M, why) { M.outWhy = why; rvpDone(M); }

/** Your own ask while she holds you (`revAsk`): she lets go and gets off first, then it is done. */
function rvpYourAsk(name) {
  const M = rvp.M;
  if (!M || M.done) return false;
  M.queue = name;
  rvpRelease(M, 'you asked: ' + name);
  return true;
}

// ── measured ─────────────────────────────────────────────────────────────────

/**
 * Every `every` s from the climb on: skin to skin (her body, her hands left
 * out, against all of you — inside counted at 3 mm), her knees against the
 * foam, both of you against the walls, her palms against your wrists, her
 * pelvis against yours, and the seat's height closed on the skin.
 */
function rvpMeasure(M, G) {
  const A = rvsBayeSkin(2), B = rvsChloeSkin(2);
  if (!A || !B) return;
  const holding = M.ph === 'hold' && (M.sub === 'pin' || M.sub === 'take' || M.sub === 'reach' || M.sub === 'stroke');
  // Her hands (and her arms) are meant to be on you: measured apart, below.
  const R = rvsGap({ A, B, skip: { 2: 1, 3: 1, 4: 1, 5: 1 } });
  // And all of her against your bottom and legs alone: her seat is on your
  // back, never on your bottom (MEASURED before this: settling, the backs of
  // her thighs 31 mm into the top of it).
  const Rb = rvsGap({ A, B, only: { 6: 1 }, skip: { 2: 1, 3: 1, 4: 1, 5: 1 } });
  const gBot = Rb ? Math.min(Rb.all.d, Rb.all.s) : 9;
  M.botMin = Math.min(M.botMin == null ? 9 : M.botMin, gBot);
  if (M.ph === 'hold' || M.ph === 'settle') M.botHold = Math.min(M.botHold == null ? 9 : M.botHold, gBot);
  const ph = M.ph + (M.sub ? ':' + M.sub : '');
  if (R) {
    const by = R.by, key = (k) => (by[k] ? Math.min(by[k].d, by[k].s) : 9);
    const g = { trunk: key('trunk'), legs: key('legs'), head: key('head') };
    const gm = Math.min(g.trunk, g.legs, g.head);
    if (gm < M.gap.min) { M.gap.min = gm; M.gap.at = ph; M.gap.who = gm === g.trunk ? 'trunk ' + (by.trunk && by.trunk.sher) : gm === g.legs ? 'legs ' + (by.legs && by.legs.sher) : 'head'; }
    M.gapIn = Math.max(M.gapIn, R.all.inN);
    if (M.kind === 'back' && M.ph === 'hold') {
      // Face up her head over yours: her bow held where it leaves 6 cm.
      if (g.head < 0.06) M.headCap = Math.max(0.2, rvm.body.bow - 0.06);
      else if (g.head > 0.10 && M.headCap != null) M.headCap = Math.min(1.3, M.headCap + 0.02);
    }
    const pk = M.ph === 'hold' && M.sub ? 'hold:' + M.sub : M.ph;
    const P = M.gap.by[pk] = M.gap.by[pk] || { min: 9, inN: 0 };
    if (gm < P.min) {
      const w = gm === g.trunk ? 'trunk' : gm === g.legs ? 'legs' : 'head';
      const sat = by[w] && by[w].sat ? new THREE.Vector3(by[w].sat[0], by[w].sat[1], by[w].sat[2]) : null;
      const rl = sat ? sat.clone().sub(G.Pv) : null;
      P.who = w + '>' + (by[w] && by[w].sher) + (M.u != null && M.ph !== 'hold' ? ' u' + M.u.toFixed(2) : '') + (M.sub ? ' ' + M.sub : '')
        + (rl ? ' @' + [rl.dot(G.H), rl.dot(G.lat), sat.y - G.top].map((x) => x.toFixed(2)).join(',') : '');
    }
    P.min = Math.min(P.min, gm); P.inN = Math.max(P.inN, R.all.inN);
    // Her seat on your back: closed on the skin to `seatGap` (slowly, once a measure).
    M.lastBy = Object.fromEntries(Object.entries(by).map(([k, r]) => [k, [+(r.d * 1000).toFixed(0), +(r.s * 1000).toFixed(0), r.inN, r.sher, r.sat]]));
    if (M.kind === 'front' && (M.ph === 'settle' || M.ph === 'hold' || (M.ph === 'on' && M.u > 0.72)) && by.trunk && M.sit > 0.8) {
      // Her seat and her thighs both: astride you, the insides of her thighs
      // are on your sides before her seat is on your back (MEASURED: closed
      // on her seat alone, her thighs were 5-7 cm into your flanks).
      const err = Math.max(RVP.seatGap - g.trunk, -RVP.thighIn - g.legs, RVP.botGap - gBot);
      const lim = M.ph === 'hold' ? 0.008 : 0.015;
      M.seatY += Math.max(-lim, Math.min(lim, err * 0.7));
      M.seatLog.push([+M.clk.toFixed(2), +(g.trunk * 1000).toFixed(1), +(g.legs * 1000).toFixed(1), +(M.seatY - G.top).toFixed(3)]);
      if (M.seatLog.length > 200) M.seatLog.shift();
      // Her thighs off your sides.
    }
  }
  // Each knee off you on its own side: back a little where it touches you
  // (your arm up by your head on one side, your shoulder lower on the other —
  // MEASURED, the left knee in to 29 mm and the right clear).
  if (M.kind === 'front' && (M.ph === 'settle' || M.ph === 'hold' || M.ph === 'release')) {
    M.kneeAdj = M.kneeAdj || { L: 0, R: 0 };
    for (const s of ['L', 'R']) {
      const side = s === 'R' ? M.climb.rSide : -M.climb.rSide;
      const idx = [];
      for (let j = 0; j < B.n; j++) {
        if (B.reg[j] !== 6) continue;
        const l = (B.p[3 * j] - G.Pv.x) * G.lat.x + (B.p[3 * j + 2] - G.Pv.z) * G.lat.z;
        if (l * side > 0.05) idx.push(j);
      }
      const Bs = { n: idx.length, p: new Float32Array(idx.length * 3), nr: new Float32Array(idx.length * 3), reg: new Uint8Array(idx.length) };
      idx.forEach((j, k) => { for (let c = 0; c < 3; c++) { Bs.p[3 * k + c] = B.p[3 * j + c]; Bs.nr[3 * k + c] = B.nr[3 * j + c]; } Bs.reg[k] = 6; });
      const Rs = rvsGap({ A, B: Bs });
      const gs = Rs ? Math.min(Rs.all.d, Rs.all.s) : 9;
      if (gs < 0.006) M.kneeAdj[s] = Math.max(-0.09, M.kneeAdj[s] - 0.008);
      else if (gs > 0.025) M.kneeAdj[s] = Math.min(0, M.kneeAdj[s] + 0.003);
    }
  }
  // Her knees on the foam: the lowest of her skin within 10 cm of each knee, off the mattress top.
  if (M.kind === 'front' && M.ph !== 'go' && M.ph !== 'stand') {
    const f = you.fig, Mw = you.mesh.matrixWorld;
    ['L', 'R'].forEach((s, i) => {
      const K = f.boneAt(f.boneIndex('legL' + s), new THREE.Vector3()).applyMatrix4(Mw);
      let lo = 9;
      for (let j = 0; j < B.n; j++) {
        if (B.reg[j] !== 6) continue;
        const dx = B.p[3 * j] - K.x, dy = B.p[3 * j + 1] - K.y, dz = B.p[3 * j + 2] - K.z;
        if (dx * dx + dy * dy + dz * dz > 0.10 * 0.10) continue;
        lo = Math.min(lo, B.p[3 * j + 1] - G.top);
      }
      M.kneeLow[i] = lo;
      const on = M.ph === 'settle' || M.ph === 'hold' || M.ph === 'release';
      if (on) {
        M.kneeLowMin = Math.min(M.kneeLowMin, lo);
        M.kneeLowMax = Math.max(M.kneeLowMax == null ? -9 : M.kneeLowMax, lo);
        // (Only while the knee is down on it: a knee her thigh holds off the
        // foam is not a knee to sink — MEASURED, it ran the goal 6 cm in.)
        if (lo < 0.03) M.kneeY[i] = Math.max(0.02, Math.min(0.07, M.kneeY[i] + Math.max(-0.01, Math.min(0.01, (RVP.kneeSink - lo) * 0.6))));
      }
    });
  }
  // Both of you against the walls, and her against the cot's frame (her skin below the mattress top over it).
  const K = jadrija.kabina, Mt = G.Mt;
  for (const [S, who] of [[A, 'you'], [B, 'her']]) {
    for (let i = 0; i < S.n; i += 3) {
      const x = S.p[3 * i], y = S.p[3 * i + 1], z = S.p[3 * i + 2];
      if (!K.room(x, z, -0.02)) {
        M.wall++;
        let dd = 0.02;
        while (dd < 0.3 && !K.room(x, z, -dd - 0.02)) dd += 0.02;
        if (dd > M.wallD) { M.wallD = dd; M.wallWho = who + ' ' + RVS_REG[S.reg[i]] + ' @' + ph; }
      }
      if (who === 'her') {
        const dx = x - Mt.mid.x, dz = z - Mt.mid.z;
        const a = Math.abs(dx * Mt.out.x + dz * Mt.out.z), l = Math.abs(dx * Mt.ax.x + dz * Mt.ax.z);
        if (a < Mt.half - 0.01 && l < Mt.len - 0.01 && y < Mt.top - 0.02) {
          const d = Mt.top - y;
          if (d > M.furn) { const rl = new THREE.Vector3(x, y, z).sub(G.Pv); M.furn = d; M.furnAt = RVS_REG[S.reg[i]] + ' @' + ph + (M.u != null ? ' u' + M.u.toFixed(2) : '') + ' ' + [rl.dot(G.H), rl.dot(G.lat)].map((v) => v.toFixed(2)).join(','); }
        }
      }
    }
  }
  // Her palms on your wrists: against where they were sent, and against your skin there.
  if (holding && M.want) {
    for (const s of ['L', 'R']) {
      const C = M.want[s];
      if (!C || rvm.k[s] < 0.95) continue;
      const pm = rvmPalm(s, new THREE.Vector3());
      if (!pm) continue;
      const regs = s === 'L' ? { 2: 1, 4: 1, 3: 1, 5: 1 } : { 3: 1, 5: 1, 2: 1, 4: 1 };
      const N = rvsNearest(A, pm, regs);
      M.palm[s].push([+(pm.distanceTo(C) * 1000).toFixed(1), N ? +(N.d * 1000).toFixed(1) : null]);
      if (M.palm[s].length > 400) M.palm[s].shift();
    }
  }
  // Her pelvis and yours; and hers held still against your back while she holds you.
  const pc = you.fig.boneAt(you.fig.boneIndex('pelvis'), new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld);
  const pb = revBone('pelvis', new THREE.Vector3()), s2 = revBone('spine02', new THREE.Vector3());
  M.ppMin = Math.min(M.ppMin == null ? 9 : M.ppMin, pc.distanceTo(pb));
  if (M.ph === 'hold' && s2) {
    const rel = pc.clone().sub(s2);
    M.pp.push([+M.clk.toFixed(2), +rel.dot(G.H).toFixed(4), +rel.dot(G.lat).toFixed(4), +rel.y.toFixed(4), M.sub]);
    if (M.pp.length > 600) M.pp.shift();
  }
  // And the back of your wrists, from your skin, for her palms.
  if (M.ph === 'hold') {
    rvpWristTop(M, 'L', A, M.kind === 'front' ? rvpGripN(G, -1) : null);
    rvpWristTop(M, 'R', A, M.kind === 'front' ? rvpGripN(G, 1) : null);
  }
  (M.log = M.log || []).push([+M.clk.toFixed(2), ph, R ? +R.all.d.toFixed(4) : null, R ? R.all.inN : null, M.kneeLow.map((x) => +x.toFixed(3)),
    +(M.lean || 0).toFixed(2), +(rvm.body.bow || 0).toFixed(2)]);
  if (M.log.length > 300) M.log.shift();
}

/** What one pin measured — `__fr.reverse.pin.last()`. */
function rvpSummary(M) {
  const st = (a, i) => {
    const L = a.map((r) => r[i]).filter((x) => x != null).sort((x, y) => x - y);
    if (!L.length) return null;
    return { n: L.length, med: L[Math.floor(L.length / 2)], p90: L[Math.min(L.length - 1, Math.floor(L.length * 0.9))], max: L[L.length - 1] };
  };
  const hold = M.pp.filter((r) => r[4] === 'pin');
  const sd = (i) => {
    if (hold.length < 3) return null;
    const v = hold.map((r) => r[i]), mu = v.reduce((a, b) => a + b, 0) / v.length;
    return { sd: +(Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) * 1000).toFixed(1), range: +((Math.max(...v) - Math.min(...v)) * 1000).toFixed(1) };
  };
  const m0 = M.mood0;
  return { kind: M.kind, why: M.why, out: M.outWhy || null, tone: m0.tone, stern: +m0.s.toFixed(2), excite: +m0.e.toFixed(2), gentle: +m0.g.toFixed(2),
    planned: { hold: +m0.hold.toFixed(1), rounds: m0.rounds, weight: Math.round(m0.weight) },
    held: M.timing.hold && M.timing.release ? +(M.timing.release - M.timing.hold).toFixed(1) : +(M.tHold || 0).toFixed(1), extra: +(M.extra || 0).toFixed(1),
    rounds: M.roundsDone, spanks: M.spanks, squirms: M.squirms, fixes: M.fixes, strokes: M.strokes, remotes: M.remotes, acts: M.acts || [],
    timing: M.timing, gapMin: +(M.gap.min * 1000).toFixed(1), gapAt: M.gap.at, gapWho: M.gap.who || null,
    gapBy: Object.fromEntries(Object.entries(M.gap.by).map(([k, v]) => [k, { min: +(v.min * 1000).toFixed(1), inN: v.inN, who: v.who || null }])),
    inside: M.gapIn, kneeLow: M.kneeLowMin < 9 ? [+(M.kneeLowMin * 1000).toFixed(1), +(M.kneeLowMax * 1000).toFixed(1)] : null,
    wall: M.wall, wallD: M.wallD ? [M.wallWho, +(M.wallD * 1000).toFixed(0)] : null, frame: M.furn ? [+(M.furn * 1000).toFixed(1), M.furnAt] : null,
    palmL: st(M.palm.L, 0), palmR: st(M.palm.R, 0), skinL: st(M.palm.L, 1), skinR: st(M.palm.R, 1),
    pelvisMin: M.ppMin != null ? +(M.ppMin * 1000).toFixed(0) : null,
    bottom: M.botMin != null ? +(M.botMin * 1000).toFixed(1) : null, bottomOn: M.botHold != null ? +(M.botHold * 1000).toFixed(1) : null, seatStill: { along: sd(1), across: sd(2), up: sd(3) },
    seat: M.seatLog.slice(-4), safe: M.safe || null, reachMiss: M.reachMiss != null ? +M.reachMiss.toFixed(3) : null,
    kneeOut: +M.kneeOut.toFixed(3), kneeAdj: M.kneeAdj ? [+M.kneeAdj.L.toFixed(3), +M.kneeAdj.R.toFixed(3)] : null, sq: M.sqLog || [] };
}

// ── the rest ─────────────────────────────────────────────────────────────────

/** The scene block's part (`revScene`): on top of you, or holding your wrists. */
function rvpScene(o) {
  const M = rvp.M;
  if (M && (M.ph === 'settle' || M.ph === 'hold')) o.rev_pin = M.kind === 'front' ? 'astride' : 'wrists';
}

/**
 * The safeword: her hands off your wrists on this frame, and off you —
 * face down, off the cot the quick way (`offSafeT`); face up, up from her
 * knees — and then her aftercare (`rvmStart('care')` once she is off).
 */
function rvpSafe() {
  rvp.after = null;
  const M = rvp.M;
  if (!M || M.done) return false;
  M.safe = { t: rev.clock, frame: rvp.frame || 0, free: null };
  rvp.safeChk = { M, t: rev.clock, n: 0, W: { L: rvpWristTop(M, M.swap ? 'R' : 'L', null).T, R: rvpWristTop(M, M.swap ? 'L' : 'R', null).T } };
  rvp.safeT = rev.clock;
  M.careAfter = true;
  M.pressNow = 0; M.sqUp = 0; M.sqT = -1; M.fixAt = -9;
  M.want = {};
  rvmArmFree('R'); rvmArmFree('L'); rvmFingers('R', 0, 0); rvmFingers('L', 0, 0);
  if (rev.arm.mode === 'spank') { rev.arm.mode = null; rev.arm.ph = 'rise'; }
  if (jadrija.petTouch) jadrija.petTouch(0);
  if (M.ph === 'go') { rvpDone(M); return true; }
  M.outWhy = 'safeword';
  if (M.ph !== 'off' && M.ph !== 'stand') { M.ph = 'release'; M.t0 = M.t; M.sub = null; M.timing.release = +rev.clock.toFixed(2); }
  return true;
}
/** Whether a pin is still going (the safeword's own road is this file's). */
function rvpOn() { return !!(rvp.M && !rvp.M.done); }

/** Swapped back or left: all of it off, now. */
function rvpClear() {
  const M = rvp.M;
  if (M) { M.outWhy = M.outWhy || 'cleared'; rvp.stats = rvpSummary(M); M.done = true; }
  rvpLegsFree();
  if (you && you.fig) rvpSpine(0, 0, 0, 0);
  if (rvm.body.mode === 'pin') Object.assign(rvm.body, { mode: 'stand', want: 'stand', t: 9, was: null });
  if (M && M.climb && rev.ch) rev.ch.yaw = M.climb.yaw0;
  rvp.M = null; rvp.after = null; rvp.seat = null; rvp.bArms = false;
}

// Her lines into the tables (`REV_SAY` the beat's own, RMOOD_SAY its tones).
if (typeof REV_SAY !== 'undefined') Object.assign(REV_SAY, RVP_SAY);
if (typeof RMOOD_SAY !== 'undefined') {
  Object.assign(RMOOD_SAY, RVP_MOOD_SAY);
  if (RMOOD_SAY.beg) RMOOD_SAY.beg.pin = RVP_BEG_SAY;
}

// The help sheet, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.revpin': 'roles reversed, on the cot: Shift+, or "pin me down" / "sit on me" / "hold me down" / "hold my wrists" — face down Chloe climbs on and kneels astride your back holding your wrists down by your head (and spanks you from there); face up she kneels at your head holding your wrists above it. W or S struggles (she holds you down harder). Stern: longer, firmer, more spanks; warm: shorter, lighter, a hand in your hair. "red" and she lets go and gets off at once',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.revpin': 'zamijenjene uloge, na krevetu: Shift+, ili "prikovi me", "sjedni na mene", "drži me" — na trbuhu Chloe se popne i klekne preko tvojih leđa, drži ti zapešća uz glavu (i udara te odande); na leđima klekne uz tvoju glavu i drži ti zapešća iznad nje. W ili S — otimaš se (drži te jače). Stroga: dulje, čvršće, više udaraca; nježna: kraće, lakše, ruka u kosi. "crvena" i pušta te i silazi odmah',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.revpin': 'rôles inversés, sur le lit : Maj+, ou « immobilise-moi », « assieds-toi sur moi », « tiens-moi » — sur le ventre, Chloe monte et s’agenouille à cheval sur votre dos en vous tenant les poignets près de la tête (et vous fesse de là) ; sur le dos, elle s’agenouille près de votre tête et vous tient les poignets au-dessus. W ou S : vous vous débattez (elle tient plus fort). Sévère : plus long, plus ferme, plus de claques ; tendre : plus court, plus léger, une main dans vos cheveux. « rouge » et elle lâche et descend tout de suite',
  });
}

/** `__fr.reverse.pin` — see 49-reverse.js. */
const rvpApi = {
  ask: () => rvpAsk(),
  beg: () => (typeof rmoodBeg === 'function' ? rmoodBeg('pin') : null),
  start: () => rvpStart('probe'),
  end: () => { if (rvp.M) rvpRelease(rvp.M, 'probe'); return true; },
  squirm: () => rvpStruggle('you'),
  /** Debug: her next choice now, or a given one ('spank' | 'tease' | 'squeeze' | 'stroke' | 'remote' | 'still' | 'look'). */
  act: (what) => { const M = rvp.M; if (!M || M.ph !== 'hold') return false; M.force = what || null; M.nextAct = 0; return true; },
  spank: (n = 3) => (rvp.M ? rvpSpankNow(rvp.M, n, 'probe') : false),
  mood: () => rvpMood(),
  words: (t) => (typeof rmoodWords === 'function' ? rmoodWords(typeof _revNorm === 'function' ? _revNorm(t) : t) : null),
  tune: (o) => Object.assign(RVP, o || {}),
  measure: (on) => { if (on != null) rvp.measure = !!on; return rvp.measure; },
  /** Debug: where things are — the cot, your bones, your back's top at her seat. */
  geom: () => {
    const G = rvpGeom();
    if (!G) return null;
    const V = (p) => (p ? [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] : null);
    const rel = (p) => { const d = p.clone().sub(G.Pv); return [+d.dot(G.H).toFixed(3), +d.dot(G.lat).toFixed(3), +(p.y - G.top).toFixed(3)]; };
    const o = {};
    for (const n of ['pelvis', 'spine01', 'spine02', 'spine03', 'chest', 'neck', 'head', 'armUL', 'armUR', 'armLL', 'armLR', 'handL', 'handR', 'legUL', 'legUR', 'legLL', 'legLR', 'footL', 'footR']) {
      const p = revBone(n, new THREE.Vector3()); if (p) o[n] = rel(p);
    }
    const BS = rvsBayeSkin(2);
    const tops = BS ? [-0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65].map((a) => [a, +(rvpTopAt(BS, rvpAt(G, a, 0, 0), 0.06) - G.top).toFixed(3)]) : null;
    const kit = jadrija.kabina.kit();
    const span = BS ? rvsSpan(BS, G.Mt) : null;
    const f = you.fig, Mw = you.mesh.matrixWorld;
    const her = {};
    for (const n of ['pelvis', 'spine03', 'head', 'legUL', 'legLL', 'footL', 'legUR', 'legLR', 'footR', 'handL', 'handR', 'armUR']) her[n] = rel(f.boneAt(f.boneIndex(n), new THREE.Vector3()).applyMatrix4(Mw));
    const wid = BS ? [-0.35, -0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35, 0.45].map((a) => {
      let lo = 0, hi = 0;
      for (let i = 0; i < BS.n; i++) {
        const d = new THREE.Vector3(BS.p[3 * i], BS.p[3 * i + 1], BS.p[3 * i + 2]).sub(G.Pv);
        if (Math.abs(d.dot(G.H) - a) > 0.03) continue;
        const l = d.dot(G.lat);
        lo = Math.min(lo, l); hi = Math.max(hi, l);
      }
      return [a, +lo.toFixed(3), +hi.toFixed(3)];
    }) : null;
    return { wid, top: +G.top.toFixed(3), H: V(G.H), lat: V(G.lat), out: V(G.Mt.out), mid: V(G.Mt.mid), half: G.Mt.half, len: G.Mt.len,
      kit: Object.keys(kit), cot: kit.cot, bones: o, tops, span, her, ch: [+rev.ch.x.toFixed(2), +rev.ch.z.toFixed(2), +rev.ch.y.toFixed(2)],
      legs: (() => { const L = rvsLimb(f, 'legUL', 'legLL', 'footL'); return [+L.l1.toFixed(3), +L.l2.toFixed(3)]; })(),
      phase: revView() ? revView().phase : null };
  },
  /** Debug: a camera on the pin — 'side' (from the room), 'head', 'feet', 'top', 'wall', or null. */
  view: (which = 'side', d = 1.7, h = 0.55) => {
    if (!which) { rev.debugCam = null; return null; }
    const G = rvpGeom();
    if (!G) return null;
    const T = rvpAt(G, RVP.kneeA, 0, G.top + 0.25);
    let dir = G.Mt.out.clone();
    if (which === 'head') dir = G.H.clone();
    if (which === 'feet') dir = G.H.clone().negate();
    if (which === 'wall') dir = G.Mt.out.clone().negate();
    if (which === 'top') { rev.debugCam = [T.x + G.Mt.out.x * 0.3, T.y + 2.0, T.z + G.Mt.out.z * 0.3, T.x, T.y, T.z]; return rev.debugCam; }
    if (which === 'diag') dir = G.Mt.out.clone().addScaledVector(G.H, 0.8).normalize();
    if (which === 'diagf') dir = G.Mt.out.clone().addScaledVector(G.H, -0.8).normalize();
    for (const k of [1, 0.85, 0.7, 0.55, 0.45]) {
      const c = T.clone().addScaledVector(dir, d * k);
      if (jadrija.kabina.room(c.x, c.z, 0.12)) { rev.debugCam = [c.x, T.y + h, c.z, T.x, T.y, T.z]; return rev.debugCam.map((x) => +x.toFixed(2)); }
    }
    return null;
  },
  state: () => {
    const M = rvp.M;
    return M ? { kind: M.kind, ph: M.ph, sub: M.sub || null, t: +M.t.toFixed(2), u: M.u != null ? +M.u.toFixed(2) : null, lean: +(M.lean || 0).toFixed(2),
      leanTo: +(M.leanTo || 0).toFixed(2), reachK: +(M.reachK || 0).toFixed(2), tHold: +(M.tHold || 0).toFixed(1), holdFor: +(M.holdFor + (M.extra || 0)).toFixed(1),
      spanks: M.spanks, rounds: M.roundsDone, squirms: M.squirms, seatY: M.seatY != null ? +(M.seatY - (M.G ? M.G.top : 0)).toFixed(3) : null,
      kneeY: M.kneeY.map((x) => +x.toFixed(3)), kneeLow: M.kneeLow.map((x) => +x.toFixed(3)), kneeOut: +M.kneeOut.toFixed(3),
      gapMin: +(M.gap.min * 1000).toFixed(1), gapAt: M.gap.at, inside: M.gapIn, k: { L: +rvm.k.L.toFixed(2), R: +rvm.k.R.toFixed(2) },
      palmL: M.palm.L.slice(-1)[0] || null, palmR: M.palm.R.slice(-1)[0] || null, body: rvm.body.mode, clip: you.fig.playing(),
      reachMiss: M.reachMiss != null ? +M.reachMiss.toFixed(3) : null, arm: rev.arm.mode, sit: +(M.sit || 0).toFixed(2), hipA: M.hipA != null ? +M.hipA.toFixed(3) : null,
      by: M.lastBy || null, log: (M.log || []).slice(-3) }
      : { ph: null, after: rvp.after, last: rvp.stats ? rvp.stats.out : null };
  },
  last: () => rvp.stats,
  all: () => rvp.all.slice(),
  /** Debug: each of her palms against your wrist under it, now (mm), and what is nearest. */
  palms: () => {
    const M = rvp.M;
    if (!M) return null;
    const A = rvsBayeSkin(1), o = {};
    for (const s of ['L', 'R']) {
      const pm = rvmPalm(s, new THREE.Vector3()), D = rvpWristTop(M, s, null), C = M.want && M.want[s];
      const N = rvsNearest(A, pm), Nt = rvsNearest(A, D.T);
      o[s] = { palmC: C ? +(pm.distanceTo(C) * 1000).toFixed(1) : null, palmT: +(pm.distanceTo(D.T) * 1000).toFixed(1),
        palmSkin: N ? +(N.d * 1000).toFixed(1) : null, reg: N ? RVS_REG[A.reg[A.p.indexOf(N.p.x) / 3 | 0]] : null,
        tSkin: Nt ? +(Nt.d * 1000).toFixed(1) : null, k: +rvm.k[s].toFixed(2), last: rvm.last && rvm.last[s] };
    }
    return o;
  },
};
if (typeof revApi !== 'undefined') revApi.pin = rvpApi;
