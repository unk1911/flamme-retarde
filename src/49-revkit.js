// -----------------------------------------------------------------------------
// Roles reversed, phase 2b: the belt and the collar in Chloe's hands.
//
// Plan, 2 Oct 2026 (the night loop, item 2): *"Chloe uses the belt and the
// collar on player-Baye. Belt: she takes it off, the AVBD strap in HER hand
// (third-person arm), swings at the cot targets, same hit path/marks/sounds;
// collar: she buckles it on you, leads you (camera follows), tugs move your
// pose (reuse the leash pose steps). Safeword ends both."*
//
// The same two adults and the same game as src/49-reverse.js, with the two
// toys the player has used on Baye since 1.552.0 and 1.553.0 now in Chloe's
// hand, and the safeword over all of it.
//
// HER BELT is the player's belt, twice over: the strap is 43-belt.js's AVBD
// net (a second one, `rvkStrap`, so the player's stays exactly as it was),
// and what lands is 43-jadrija.js's `beltHit` — the cot's ragdoll through
// `cotSpank`, the line of a mark, the recorded crack and whp, your gasps. What
// is new is her arm: the buckle end is held by her right fist, and her arm is
// SOLVED to where the fist is to be (`rvkArm`, the two-bone hinge solve of
// 1.561.1 run on her figure), every frame, before the strap is stepped from
// the fist the solve actually reached. So the strap hangs from the hand that
// is drawn, and the hand is never asked for a place her arm cannot put it.
//
//   - OFF: her right hand to her buckle, the belt drawn out of the loops and
//     round her right hip (laid along a curve, as the first person's is, and
//     taken off her painted waist by the same amount), and held by the
//     buckle with the strap hanging.
//   - A ROUND, with you face down on the cot: she stands off the cot's side
//     where a strap reaches (`stand`), winds up over her right shoulder, and
//     brings it down in the upright plane through her shoulder and the spot
//     (`cotAim` from her eye — your bottom mostly, a thigh, now and then your
//     back), the strap's width square to that plane, its tongue steered by the
//     belt's own wrist (`BELT.guide`). Where a link meets you is the hit, and
//     that is all a hit is.
//   - BACK ON: to her waist and fed back in, buckled.
//
// THE COLLAR is the leash of 1.553.0 with the ends swapped. Baye's side of it
// (`leashStep` in 43-jadrija.js) follows "you", and while the roles are
// reversed "you" is Chloe (`revWho`) — so the body you are in goes to her,
// kneels up for it, goes down on all fours and crawls after her on her trail,
// and a firm tug moves your pose a step (all fours, your knees, your feet, the
// cot) exactly as one of yours moved Baye's. What is new is her hands: at your
// neck while it goes on and comes off (the same path the first person's hand
// takes, `collarHandTickIn`, laid on her arms here), at her hip with the loop
// while she leads you, drawn back in a tug. Your camera is in your head, so it
// goes down and up with your pose by itself; while it goes on it looks down.
//
// ONE RIGHT HAND: the belt and the leash are never in it together, as in the
// normal roles. And THE SAFEWORD over everything: "red" / "crvena" / "stop"
// stops a swing where it is — she lets go of the strap and it falls — takes
// the collar off at once, and then her aftercare, and the roles go back
// (`revSafe` calls `rvkSafe`).
// -----------------------------------------------------------------------------

const RVK = {
  // ── her belt ──
  // Seconds: her hand to the buckle; drawing it out; back to her waist; fed
  // in; buckled. `fast` of each after a safeword or a swap back.
  reachT: 0.45, drawT: 0.95, stowT: 0.40, feedT: 0.85, buckleT: 0.35,
  // Figure space (forward, up, her right), m. The buckle at the front of the
  // band the body shader paints (49-you.js: 0.958-0.996 up, the frame at
  // 0.977), where the belt leaves the loops at her right hip, and her fist
  // holding it by the buckle with the strap hanging — high enough that a
  // metre of leather clears the floor.
  buckle: [0.115, 0.977, 0.0], exit: [0.02, 0.977, 0.165], hold: [0.27, 1.13, 0.25],
  // Wrist to the middle of her fist, m; and how far from her shoulder a fist
  // may be asked for — her arm is 0.477 m to the wrist (measured off the
  // bind), so a hair short of straight.
  fist: 0.075, reach: 0.535,
  // THE SWING, in the upright plane through her right shoulder and the spot:
  // the fist stops `stop` m out along that line (as far as `d - strap` asks,
  // within that range) — a strap's reach short of you; the path's last `over`
  // m straight down the line; the wind-up `windUp` over her shoulder and
  // `windBack` behind it. Times as the first person's (BELT_HAND): the strike
  // from `strike[0]` s at no charge to `strike[1]` wound right up.
  strap: 0.85, stop: [0.24, 0.46], over: 0.26, windUp: 0.36, windBack: 0.17,
  windT: 0.40, strike: [0.62, 0.17], throughT: 0.12, backT: 0.45,
  // The strap flung back through the wind-up: where its curve ends off the
  // fist (back along the swing, up — m), and how much of the way to it each
  // frame is eased, at the top (see `rvkBeltTick`).
  fling: [0.70, -0.30, 0.22],
  // Her wrist on the strap, N/m (BELT.guide is the first person's 0.4): from
  // the top of the swing until it lands, the tongue steered to the spot.
  guide: 1.6,
  // Where she stands for it: off the cot's side, level with your seat, this
  // far out from your pelvis (m) — what puts her shoulder `strap` + `stop`
  // from the spot — and the least the room may leave her.
  stand: 0.78, standMin: 0.60,
  // A round: between strokes (s), and her own meter, the belt's: each crack
  // adds 0.2 + how hard, it cools over `cool` s, and she does not start a
  // stroke while it is over `easy` — she is watching you, not counting.
  gap: [0.9, 1.6], cool: 3.0, easy: 1.1,
  // How long she keeps it out (s), and how long before it comes out again.
  keep: [45, 75], again: 50,
  // ── the collar ──
  // How near she comes to put it on (m from your neck, level), and how far
  // she stands off while you crawl after her.
  near: 0.42, off: 1.15,
  // Her hand holding the loop while she leads you: figure space, at her hip.
  lead: [0.10, 0.98, 0.24],
  // Leading you round the room: every so often (s) she decides again; a tug
  // wants this much chain out first (m, ring to her hand) or she steps away.
  every: [4.5, 8.0], taut: 1.22,
  // How long she keeps you on it (s), and before it goes on again.
  collarKeep: [55, 85], collarAgain: 45,
};

const rvk = {
  strap: null,
  // Her belt: phase, clock, and her fist and how the strap leaves it.
  belt: { ph: 'off', t: 0, k: 0, out: 0, since: 0, keepFor: 60, rounds: 0, n: 0, next: 0, heat: 0,
    charge: 0.7, fast: false, ask: false, lastOff: -1e9, strokes: 0, lashes: 0, pats: 0, landed: 0, off: 0,
    hits: [], dropped: false, misses: [] },
  // The collar: asked for, when it went on, how long she keeps it, her next move.
  col: { want: null, since: 0, keepFor: 70, next: 0, tugs: 0, did: {}, lastOff: -1e9, goal: null,
    said: false, cot: false, tug: null, pend: null },
  armK: { R: 0, L: 0 }, armOn: { R: false, L: false }, fingers: false,
  log: [],
};
const _kA = new THREE.Vector3(), _kB = new THREE.Vector3(), _kC = new THREE.Vector3(), _kD = new THREE.Vector3();
const _kE = new THREE.Vector3(), _kF = new THREE.Vector3(), _kG = new THREE.Vector3(), _kH = new THREE.Vector3();
const _kS = new THREE.Vector3(), _kW = new THREE.Vector3(), _kU = new THREE.Vector3(), _kP = new THREE.Vector3();
const _kQ = new THREE.Quaternion(), _kQ2 = new THREE.Quaternion(), _kQ3 = new THREE.Quaternion();
const _kM = new THREE.Matrix4();
// Her fist this frame (world), the way the strap leaves it, and its attitude.
const rvkFist = new THREE.Vector3(), rvkQ = new THREE.Quaternion(), rvkDir = new THREE.Vector3(0, -1, 0);
const rvkAcross = new THREE.Vector3(1, 0, 0);
// The swing's plan, world.
const rvkPlanP = { S: new THREE.Vector3(), aim: new THREE.Vector3(), stop: new THREE.Vector3(),
  top: new THREE.Vector3(), wind: new THREE.Vector3(), back: new THREE.Vector3(), across: new THREE.Vector3(),
  from: new THREE.Vector3(), reg: null };

function rvkTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvkNote(s) { rvk.log.push([+rev.clock.toFixed(1), s]); if (rvk.log.length > 60) rvk.log.shift(); }

/** Her belt is out of the loops (drawing, held, swinging, going back). */
function rvkBeltOut() { return rvk.belt.ph !== 'off'; }
/** It is in her hand to use: held, or mid-round. */
function rvkBeltInHand() {
  const p = rvk.belt.ph;
  return p === 'hold' || p === 'go' || p === 'set' || p === 'wind' || p === 'strike' || p === 'through' || p === 'back';
}
/** A round of the belt is on (from walking over to the last stroke). */
function rvkBeltRound() { return rvk.belt.n > 0 && rvkBeltInHand(); }
/** The collar is on you (or on its way), by her hand. */
function rvkCollarOn() {
  if (rvk.col.want === 'on') return true;
  return typeof collarActive === 'function' && collarActive();
}
/** Her right hand is full: the belt or the leash. */
function rvkHandFull() { return rvkBeltOut() || rvkCollarOn(); }
/** Something of hers she is in the middle of, that her other choices wait for. */
function rvkBusy() {
  const p = rvk.belt.ph;
  return p === 'reach' || p === 'draw' || p === 'stow' || p === 'feed' || p === 'buckle' || rvkBeltRound()
    || rvk.col.want === 'on' || rvk.col.want === 'off' || !!rvk.col.tug || !!rvk.col.pend;
}

// ── her figure: placed now, and her arms solved ─────────────────────────────

/**
 * Her figure where `revDriveChloe` has just said it is to be. 49-you.js puts
 * it there in `tick`, after this file; a solve against last frame's place is
 * a fist two centimetres behind a woman walking, so it is put now (the same
 * transform, which `tick` then writes again).
 */
function rvkPlace() {
  const o = rev.lastDrive;
  if (!o || !you || !you.mesh) return false;
  you.mesh.position.set(o.at[0], o.at[1], o.at[2]);
  you.mesh.rotation.set(o.roll || 0, o.yaw + (typeof YOU !== 'undefined' ? YOU.face : 0), o.pitch || 0, 'YZX');
  you.mesh.updateMatrixWorld();
  return true;
}

let rvkArmSide = null;
/** Her two arms off the bind: bone indices and each elbow's hinge. */
function rvkArmInit() {
  if (rvkArmSide) return rvkArmSide;
  const f = you && you.fig;
  if (!f || !f.local || !f.bindRest) return null;
  const B = f.bindRest(), T = B.bindT;
  const out = {};
  for (const s of ['L', 'R']) {
    const iu = f.boneIndex('armU' + s), il = f.boneIndex('armL' + s), ih = f.boneIndex('hand' + s);
    if (iu < 0 || il < 0 || ih < 0) return null;
    const u = new THREE.Vector3(T[3 * il] - T[3 * iu], T[3 * il + 1] - T[3 * iu + 1], T[3 * il + 2] - T[3 * iu + 2]);
    const a = new THREE.Vector3(T[3 * ih] - T[3 * il], T[3 * ih + 1] - T[3 * il + 1], T[3 * ih + 2] - T[3 * il + 2]);
    out[s] = { iu, il, ih, ip: f.bones[iu].parent, e: u.clone().cross(a).normalize(),
      bq: new THREE.Quaternion(B.bindQ[4 * iu], B.bindQ[4 * iu + 1], B.bindQ[4 * iu + 2], B.bindQ[4 * iu + 3]).invert(),
      pq: (() => { const ip = f.bones[iu].parent; return new THREE.Quaternion(B.bindQ[4 * ip], B.bindQ[4 * ip + 1], B.bindQ[4 * ip + 2], B.bindQ[4 * ip + 3]); })(),
      l1: u.length(), l2: a.length(), fing: f.boneIndex('fingers' + s), thumb: f.boneIndex('thumb' + s) };
  }
  rvkArmSide = out;
  return out;
}

/**
 * HER ARM TO A FIST, side `s` ('R' | 'L'): her fist's middle to world point
 * `goalW`, the elbow toward world direction `poleW`, `k` 0..1 of the way from
 * where her clip has the arm. The chain is the clip's own this frame (the
 * local pose), carried by her collarbone as it was last drawn — so a crouch
 * or a lean laid on her spine is in it — and the solve is `hingeArm`, the
 * elbow bending on its hinge. Writes where the fist actually is into `out`
 * (world) and answers it, or null.
 */
function rvkArm(s, goalW, poleW, k, out) {
  const A = rvkArmInit();
  const f = you && you.fig;
  if (!A || !f || !jadrija || !jadrija.hingeArm) return null;
  const a = A[s];
  const R = f.bindRest(), L = f.local();
  const M = you.mesh.matrixWorld;
  _kM.copy(M).invert();
  // The collarbone as drawn (its turn since the bind, times the bind: its
  // figure-space attitude), and the shoulder on it.
  const S = f.boneAt(a.iu, _kS);
  f.boneTurn(a.ip, _kQ).multiply(a.pq);
  const lq = L.q;
  _kQ2.set(lq[4 * a.iu], lq[4 * a.iu + 1], lq[4 * a.iu + 2], lq[4 * a.iu + 3]);
  const qU = _kQ.clone().multiply(_kQ2);
  const E = _kE.set(R.t[3 * a.il], R.t[3 * a.il + 1], R.t[3 * a.il + 2]).applyQuaternion(qU).add(S);
  _kQ3.set(lq[4 * a.il], lq[4 * a.il + 1], lq[4 * a.il + 2], lq[4 * a.il + 3]);
  const qL = qU.clone().multiply(_kQ3);
  const W = _kW.set(R.t[3 * a.ih], R.t[3 * a.ih + 1], R.t[3 * a.ih + 2]).applyQuaternion(qL).add(E);
  const hinge = _kH.copy(a.e).applyQuaternion(qU.clone().multiply(a.bq));
  // The goal, in her frame: the wrist a fist short of where the fist is to be.
  const G = _kG.copy(goalW).applyMatrix4(_kM);
  _kD.copy(G).sub(S);
  let dl = _kD.length() || 1e-3;
  if (dl > RVK.reach) { _kD.multiplyScalar(RVK.reach / dl); dl = RVK.reach; G.copy(S).add(_kD); }
  _kU.copy(_kD).multiplyScalar(1 / dl);
  G.addScaledVector(_kU, -RVK.fist);
  G.lerpVectors(W, G, Math.max(0, Math.min(1, k)));
  _kQ.copy(you.mesh.quaternion).invert();
  const P = _kP.copy(poleW).applyQuaternion(_kQ);
  jadrija.hingeArm(f, 'armU' + s, 'armL' + s, S, E, W, hinge, G, P);
  // Where that put the wrist, and the fist on along the forearm: the
  // triangle again (the solve's own numbers; it clamps the reach as here).
  const l1 = a.l1, l2 = a.l2;
  const D = _kA.copy(G).sub(S);
  const gl = D.length() || 1e-3;
  D.multiplyScalar(1 / gl);
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(gl, (l1 + l2) * 0.999));
  const ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const sa = Math.sqrt(1 - ca * ca);
  const V = _kB.copy(P).addScaledVector(D, -P.dot(D));
  if (V.lengthSq() < 1e-8) V.set(1, 0, 0).addScaledVector(D, -D.x);
  V.normalize();
  const elbow = _kC.copy(S).addScaledVector(D.clone().multiplyScalar(ca).addScaledVector(V, sa), l1);
  const wrist = _kF.copy(S).addScaledVector(D, d);
  const fl = wrist.clone().sub(elbow).normalize();
  rvk.armOn[s] = true;
  if (!out) return null;
  return out.copy(wrist).addScaledVector(fl, RVK.fist).applyMatrix4(M);
}

/** Her fingers closed (a fist round a buckle or a loop) or open again. */
function rvkGrip(s, on, k = 1) {
  const A = rvkArmInit(), f = you && you.fig;
  if (!A || !f) return;
  if (!on || k < 0.02) {
    f.aim('fingers' + s, 0, 0, 1, 0); f.aim('thumb' + s, 0, 0, 1, 0);
    return;
  }
  // About the elbow's hinge as the hand carries it — the knuckles' axis on
  // this rig is near enough parallel to it — the fingers curled into the palm.
  const a = A[s];
  const ax = _kA.copy(a.e).applyQuaternion(f.boneTurn(a.ih, _kQ));
  const sg = s === 'R' ? 1 : -1;
  f.aim('fingers' + s, ax.x, ax.y, ax.z, sg * 1.25 * k);
  f.aim('thumb' + s, ax.x, ax.y, ax.z, sg * 0.55 * k);
}

/** Her arm given back to her clip: the aims off (not the crouch's own, if that holds it). */
function rvkArmFree(s) {
  const f = you && you.fig;
  if (!f || !rvk.armOn[s]) return;
  rvk.armOn[s] = false;
  if (!(rev.arm && rev.arm.posed)) { f.aim('armU' + s, 0, 0, 1, 0); f.aim('armL' + s, 0, 0, 1, 0); }
  rvkGrip(s, false);
}

/** A point in her figure's frame (forward, up, right), world, into `out`. */
function rvkFig(p, out) {
  return out.set(p[0], p[1], p[2]).applyMatrix4(you.mesh.matrixWorld);
}
/** A direction in her frame, world. */
function rvkFigDir(x, y, z, out) {
  return out.set(x, y, z).applyQuaternion(you.mesh.quaternion).normalize();
}
/** Her right shoulder, world (as last drawn). */
function rvkShoulder(out) {
  const A = rvkArmInit();
  if (!A || !you || !you.fig) return null;
  return you.fig.boneAt(A.R.iu, out).applyMatrix4(you.mesh.matrixWorld);
}
/** Her eye, world. */
function rvkEye(out) { return revChloeHead(out).add(_kA.set(0, 0.03, 0)); }

// ── her belt ─────────────────────────────────────────────────────────────────

/**
 * "Sad remen." She takes it off. `why` for the trace: 'mood' | 'asked' |
 * 'punish'. Answers true, or why not.
 */
function rvkBeltStart(why = 'mood') {
  if (!rev.on) return 'off';
  if (rev.care) return 'aftercare';
  const B = rvk.belt;
  if (B.ph !== 'off') return rvkBeltInHand() ? 'already' : 'busy';
  if (rvkCollarOn()) return 'collar';
  if (rev.arm.mode === 'spank') return 'busy';
  if (!you || !you.fig || !rvkArmInit()) return 'nobody';
  if (!rvk.strap) {
    rvk.strap = beltStrap(scene, { guide: RVK.guide });
    rvk.strap.onHit = rvkLanded;
  }
  Object.assign(B, { ph: 'reach', t: 0, k: 0, out: 0, since: rev.clock, rounds: 0, n: 0, fast: false, ask: false,
    keepFor: RVK.keep[0] + Math.random() * (RVK.keep[1] - RVK.keep[0]), dropped: false });
  // She stops where she is for it, facing you.
  rev.ch.goal = null;
  if (typeof audio !== 'undefined' && audio && audio.slapWarm) audio.slapWarm();
  // His unbuckle (1.552.1): its clink as her fist closes on the buckle and pulls.
  if (typeof audio !== 'undefined' && audio && audio.beltBuckle) audio.beltBuckle(RVK.reachT + 0.1);
  revSay('belt', true, null, { still: revStill.dom });
  rvkTrace({ pick: 'belt off', why });
  rvkNote('belt off (' + why + ')');
  revHud();
  return true;
}

/** Back on: to her waist, fed into the loops, buckled. `fast` after a safeword. */
function rvkBeltStow(why = 'done', fast = false) {
  const B = rvk.belt;
  if (B.ph === 'off') return 'not out';
  if (B.ph === 'reach' || B.ph === 'draw' || B.dropped) { rvkBeltSnap(); return 'snapped'; }
  if (B.ph === 'stow' || B.ph === 'feed' || B.ph === 'buckle') return 'going';
  B.n = 0;
  B.fast = !!fast;
  B.ph = 'stow'; B.t = 0;
  B.from = rvkFist.clone();
  B.lastOff = rev.clock;
  if (rvk.strap) rvk.strap.aim(null);
  if (!fast) revSay('beltback', false, null, { still: revStill.dom });
  rvkTrace({ pick: 'belt back', why });
  rvkNote('belt back (' + why + ')');
  return true;
}

/** Straight back on, no gesture: the swap back, leaving the room. */
function rvkBeltSnap() {
  const B = rvk.belt;
  if (typeof audio !== 'undefined' && audio && audio.beltQuiet) audio.beltQuiet();
  if (rvk.strap) rvk.strap.hide();
  if (you && you.belt) you.belt(1);
  B.ph = 'off'; B.k = 0; B.n = 0; B.dropped = false;
  B.lastOff = rev.clock;
  rvkArmFree('R');
}

/**
 * A ROUND: `n` strokes, face down on the cot. She goes to where a strap
 * reaches you from, and the rest is `rvkBeltTick`.
 */
function rvkBeltRoundStart(n, why = 'mood') {
  const B = rvk.belt;
  if (!rvkBeltInHand()) return 'no belt';
  if (B.n > 0) return 'already';
  const v = revView();
  if (!v || v.ctx !== 'front') return 'notthere';
  const S = rvkStandSpot();
  if (!S) return 'nospot';
  B.n = Math.max(1, Math.min(6, n | 0));
  B.ph = 'go'; B.t = 0;
  B.spot = S;
  B.charge = Math.min(1, 0.86 + 0.14 * rev.dom.heat + (why.startsWith('punish') ? 0.1 : 0));
  revGo(S.x, S.z);
  rev.ch.face = S.face;
  B.rounds++;
  rvkTrace({ pick: 'belt x' + B.n, why, heat: +rev.dom.heat.toFixed(2) });
  return true;
}

/**
 * Where she stands to use it: beside the cot, square to it, level with your
 * seat, `RVK.stand` out — on whichever side the room leaves her.
 */
function rvkStandSpot() {
  const P = revBone('pelvis', new THREE.Vector3());
  if (!P) return null;
  const hf = jadrija.headFrame ? jadrija.headFrame() : null;
  const ax = hf ? hf.ax : 1, az = hf ? hf.az : 0;
  const px = -az, pz = ax;
  let best = null;
  for (const sgn of [1, -1]) {
    for (const d of [RVK.stand, (RVK.stand + RVK.standMin) / 2, RVK.standMin]) {
      const sx = P.x + px * d * sgn, sz = P.z + pz * d * sgn;
      const [cx, cz] = ground.confine ? ground.confine(sx, sz, rev.ch.y) : [sx, sz];
      const bad = Math.hypot(cx - sx, cz - sz) + (jadrija.kabina.room(cx, cz, 0.2) ? 0 : 5);
      const score = bad * 4 + (RVK.stand - d) * 1.5 + 0.15 * Math.hypot(cx - rev.ch.x, cz - rev.ch.z);
      if (!best || score < best.score) best = { score, x: cx, z: cz, d };
    }
  }
  // Square on to the cot (see `revSpot`): facing across it, not at the spot.
  const nx = P.x - best.x, nz = P.z - best.z, nl = Math.hypot(nx, nz) || 1;
  // Turned a little to her left, so her right shoulder — the one the belt
  // comes from — is the one square on to you.
  const face = new THREE.Vector3(best.x + nx / nl * 2 + (-nz / nl) * 0.25, P.y, best.z + nz / nl * 2 + (nx / nl) * 0.25);
  return { x: best.x, z: best.z, d: best.d, face };
}

/**
 * Where the next stroke goes: a ray from her eye at you (`cotAim`), your
 * bottom most of the time, a thigh, now and then the small of your back.
 */
function rvkAimSpot() {
  const P = revBone('pelvis', new THREE.Vector3());
  if (!P) return null;
  const o = rvkEye(new THREE.Vector3());
  const hf = jadrija.headFrame ? jadrija.headFrame() : null;
  const ax = hf ? hf.ax : 1, az = hf ? hf.az : 0;
  const r = Math.random();
  // Along you from the pelvis: + toward your head.
  const along = r < 0.68 ? -0.04 + (Math.random() - 0.5) * 0.10 : r < 0.88 ? -0.17 - Math.random() * 0.08 : 0.15;
  const aim = P.clone().add(new THREE.Vector3(ax * along, 0.05, az * along));
  const hit = jadrija.cotAim ? jadrija.cotAim(o, aim.clone().sub(o)) : null;
  if (hit && !hit.miss) return { at: new THREE.Vector3(hit.x, hit.y, hit.z), reg: hit.reg };
  return { at: P.clone().add(new THREE.Vector3(0, 0.10, 0)), reg: null };
}

/** The stroke's plan: the plane, the stop, over the top, the wind-up. */
function rvkPlan() {
  const Pl = rvkPlanP;
  const S = rvkShoulder(Pl.S);
  if (!S) return false;
  const A = rvkAimSpot();
  if (!A) return false;
  Pl.aim.copy(A.at); Pl.reg = A.reg;
  const D = _kA.subVectors(Pl.aim, S);
  const d = D.length() || 1e-3;
  D.multiplyScalar(1 / d);
  Pl.stop.copy(S).addScaledVector(D, Math.max(RVK.stop[0], Math.min(RVK.stop[1], d - RVK.strap)));
  Pl.back.set(-D.x, 0, -D.z);
  if (Pl.back.lengthSq() < 1e-6) rvkFigDir(-1, 0, 0, Pl.back);
  Pl.back.normalize();
  Pl.across.set(-Pl.back.z, 0, Pl.back.x);
  Pl.top.copy(Pl.stop).addScaledVector(D, -RVK.over);
  Pl.top.y += 0.05;
  Pl.wind.copy(S).addScaledVector(Pl.back, RVK.windBack);
  Pl.wind.y += RVK.windUp;
  // Every point on her side of her reach.
  for (const p of [Pl.stop, Pl.top, Pl.wind]) {
    _kB.subVectors(p, S);
    const l = _kB.length();
    if (l > RVK.reach - 0.01) p.copy(S).addScaledVector(_kB, (RVK.reach - 0.01) / l);
  }
  return true;
}

/** The strap says it landed — `onHit` in 43-belt.js, on her strap. */
function rvkLanded(h) {
  const B = rvk.belt;
  if (!rev.on || B.dropped || (rvk.strap && rvk.strap.dropped)) return;
  const r = jadrija && jadrija.beltHit ? jadrija.beltHit(h, rvkEye(new THREE.Vector3())) : null;
  const k = Math.max(0, Math.min(1, (h.v - BELT.hit.pat) / (BELT.hit.top - BELT.hit.pat)));
  const u = Math.max(0, Math.min(1, (h.v - BELT.hit.crack) / (BELT.hit.top - BELT.hit.crack)));
  const crack = h.v >= BELT.hit.crack;
  // The strap coming round again after the stroke has landed (its tongue on
  // your arm or your calf, slow): part of the same stroke, not another one.
  const again = B.strokeHit === B.strokes;
  if (again && (!r || !r.reg || !crack)) { B.after = (B.after || 0) + 1; return; }
  if (r && r.reg) B.strokeHit = B.strokes;
  // (And how far from where she aimed, along you and across: + toward your head.)
  const hf = jadrija.headFrame ? jadrija.headFrame() : null, A = rvkPlanP.aim;
  const off = hf ? [+(((h.at[0] - A.x) * hf.ax + (h.at[2] - A.z) * hf.az)).toFixed(2), +((-(h.at[0] - A.x) * hf.az + (h.at[2] - A.z) * hf.ax)).toFixed(2)] : null;
  if (typeof audio !== 'undefined' && audio && audio.beltCrack) audio.beltCrack(k, crack, u);
  B.hits.push([B.strokes, r ? r.reg || 'off:' + r.part : '-', +h.v.toFixed(1), off]);
  if (B.hits.length > 48) B.hits.shift();
  // Your camera, with it — a crack more than a pat.
  rev.jolt = Math.min(1.6, rev.jolt + (crack ? 0.55 + 0.6 * u : 0.2));
  if (!r) return;
  if (!r.reg) {
    B.off++;
    rvkTrace({ pick: 'lash off', why: r.part, v: +h.v.toFixed(1) });
    return;
  }
  if (r.landed) B.landed++;
  if (crack) B.lashes++; else B.pats++;
  if (typeof sceneHit === 'function') sceneHit('belt', !crack ? 0 : u >= 0.5 ? 2 : 1, r.reg);
  B.heat += crack ? 0.2 + u : 0.03;
  rev.dom.heat = Math.min(1, rev.dom.heat + 0.025);
  rvkTrace({ pick: 'lash', why: r.reg + (r.landed ? ' (cot)' : ''), v: +h.v.toFixed(1), J: r.J, mark: r.mark });
  // YOUR ANSWER is your body's own — a gasp a second or two after, or a moan,
  // or nothing, by the weights the belt's answer has always used
  // (`BELT_REACT`). Not a line: what you say in this body is yours to say.
  if (typeof BELT_REACT !== 'undefined' && typeof audio !== 'undefined' && audio) {
    const W = BELT_REACT[crack ? 'crack' : 'pat'];
    const w = { moan: W.moan[0] + (W.moan[1] - W.moan[0]) * (crack ? u : 0),
      gasp: W.gasp[0] + (W.gasp[1] - W.gasp[0]) * (crack ? u : 0),
      none: W.none[0] + (W.none[1] - W.none[0]) * (crack ? u : 0) };
    if (B.react === 'gasp') w.gasp *= BELT_REACT.again;
    if (B.react === 'moan') w.moan *= BELT_REACT.again;
    let x = Math.random() * (w.moan + w.gasp + w.none);
    B.react = (x -= w.gasp) < 0 ? 'gasp' : (x -= w.moan) < 0 ? 'moan' : 'none';
    if (B.react === 'gasp' && audio.herGasp) audio.herGasp(crack ? u : 0, !crack);
    if (B.react === 'moan' && audio.herMoan) audio.herMoan();
  }
}

/**
 * Once a frame: where her fist is to be, her arm solved to it, the strap laid
 * or stepped from where the fist got to. After `revDriveChloe`.
 */
function rvkBeltTick(dt) {
  const B = rvk.belt;
  if (B.ph === 'off') return;
  B.t += dt;
  B.heat *= Math.exp(-dt / RVK.cool);
  const L = BELT.len, st = rvk.strap;
  const fast = B.fast ? 0.5 : 1;
  const hold = rvkFig(RVK.hold, _kG.clone());
  const buckle = rvkFig(RVK.buckle, new THREE.Vector3());
  const exit = rvkFig(RVK.exit, new THREE.Vector3());
  const fwd = rvkFigDir(1, 0, 0, new THREE.Vector3());
  const right = rvkFigDir(0, 0, 1, new THREE.Vector3());
  const down = new THREE.Vector3(0, -1, 0);
  // The fist goal and the strap's way out of it this frame.
  const goal = new THREE.Vector3();
  let dir = down.clone().addScaledVector(fwd, 0.2).normalize();
  let across = right;
  let k = 1;
  // The elbow: out and down at her side, out and up when the fist is over her shoulder.
  const pole = right.clone().multiplyScalar(1).add(down.clone().multiplyScalar(0.55)).addScaledVector(fwd, -0.25);
  const Pl = rvkPlanP;
  const smooth = (x) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
  if (B.ph === 'reach') {
    // From where her hand hangs, to the buckle.
    k = smooth(B.t / RVK.reachT);
    B.k = k;
    goal.copy(buckle);
    dir.copy(right).multiplyScalar(-1);
    if (B.t >= RVK.reachT) { B.ph = 'draw'; B.t = 0; }
  } else if (B.ph === 'draw') {
    const u = smooth(B.t / RVK.drawT);
    const mid = buckle.clone().addScaledVector(right, 0.32).addScaledVector(fwd, 0.08);
    mid.y += 0.10;
    if (u < 0.5) goal.lerpVectors(buckle, mid, smooth(u * 2)); else goal.lerpVectors(mid, hold, smooth(u * 2 - 1));
    B.out = L * smooth(B.t / (RVK.drawT * 0.9));
  } else if (B.ph === 'hold') {
    goal.copy(hold);
  } else if (B.ph === 'go') {
    goal.copy(hold);
    if (revAt() || B.t > 6) { B.ph = 'set'; B.t = 0; }
  } else if (B.ph === 'set') {
    // Square on, a breath; the plan; and not while you are still smarting.
    goal.copy(hold);
    const v = revView();
    if (!v || v.ctx !== 'front') { rvkRoundEnd('you moved'); }
    else if (B.t > 0.35 && B.heat < RVK.easy && rev.clock >= B.next) {
      if (rvkPlan()) {
        B.ph = 'wind'; B.t = 0;
        B.from = rvkFist.clone();
        B.windFrom = rvkFist.clone();
      } else rvkRoundEnd('no plan');
    }
  } else if (B.ph === 'wind') {
    const u = smooth(B.t / RVK.windT);
    goal.lerpVectors(B.windFrom, Pl.wind, u);
    dir = Pl.back.clone().multiplyScalar(0.7).add(new THREE.Vector3(0, 0.7, 0)).normalize()
      .lerp(dir, 1 - u).normalize();
    across = Pl.across;
    pole.copy(right).addScaledVector(fwd, 0.35).add(new THREE.Vector3(0, 0.25 * u, 0));
    if (B.t >= RVK.windT + 0.10 * B.charge) {
      B.ph = 'strike'; B.t = 0; B.strokes++;
      B.from = rvkFist.clone();
      if (st && BELT.guide > 0) st.aim([Pl.aim.x, Pl.aim.y, Pl.aim.z]);
      if (typeof audio !== 'undefined' && audio && audio.beltSwish) audio.beltSwish(0.3 + 0.7 * B.charge);
    }
  } else if (B.ph === 'strike') {
    const dur = RVK.strike[0] + (RVK.strike[1] - RVK.strike[0]) * Math.pow(B.charge, 0.7);
    const u = Math.min(1, B.t / dur);
    // Over the top and down, accelerating all the way — the first person's curve.
    const w = u * u, a = (1 - w) * (1 - w), b = 2 * w * (1 - w), c = w * w;
    goal.set(a * B.from.x + b * Pl.top.x + c * Pl.stop.x, a * B.from.y + b * Pl.top.y + c * Pl.stop.y,
      a * B.from.z + b * Pl.top.z + c * Pl.stop.z);
    const back = Pl.back.clone().multiplyScalar(0.7).add(new THREE.Vector3(0, 0.7, 0)).normalize();
    const at = new THREE.Vector3().subVectors(Pl.aim, Pl.stop).normalize();
    dir = back.lerp(at, u * u * u).normalize();
    across = Pl.across;
    pole.copy(right).addScaledVector(fwd, 0.35 * (1 - u)).add(new THREE.Vector3(0, 0.25 * (1 - u) - 0.5 * u, 0));
    if (u >= 1) { B.ph = 'through'; B.t = 0; B.from = rvkFist.clone(); }
  } else if (B.ph === 'through') {
    const u = smooth(B.t / RVK.throughT);
    const to = Pl.stop.clone().addScaledVector(_kA.subVectors(Pl.aim, Pl.S).normalize(), 0.06).add(new THREE.Vector3(0, -0.12, 0));
    goal.lerpVectors(B.from, to, u);
    dir = new THREE.Vector3().subVectors(Pl.aim, Pl.stop).normalize().lerp(down, u).normalize();
    across = Pl.across;
    if (B.t >= RVK.throughT) { B.ph = 'back'; B.t = 0; B.from = rvkFist.clone(); }
  } else if (B.ph === 'back') {
    const u = smooth(B.t / RVK.backT);
    goal.lerpVectors(B.from, hold, u);
    dir = down.clone().lerp(dir, u).normalize();
    if (st && st.aiming && B.t > 0.15) st.aim(null);
    if (B.t >= RVK.backT) {
      B.n -= 1;
      B.next = rev.clock + RVK.gap[0] + Math.random() * (RVK.gap[1] - RVK.gap[0]);
      if (B.n > 0) {
        B.ph = 'set'; B.t = 0;
        if (Math.random() < 0.45) revSay('lash', false, null, { still: revStill.dom });
      } else rvkRoundEnd('done');
    }
  } else if (B.ph === 'stow') {
    const u = smooth(B.t / (RVK.stowT * fast));
    goal.lerpVectors(B.from, buckle, u);
    if (B.t >= RVK.stowT * fast) {
      B.ph = 'feed'; B.t = 0;
      if (typeof audio !== 'undefined' && audio && audio.beltBuckle) audio.beltBuckle((RVK.feedT + RVK.buckleT * 0.5) * fast, true);
    }
  } else if (B.ph === 'feed') {
    goal.copy(buckle);
    const T = RVK.feedT * fast;
    B.out = L * (1 - smooth(B.t / T));
    if (B.t >= T) { B.ph = 'buckle'; B.t = 0; if (st) st.hide(); if (you && you.belt) you.belt(1); }
  } else if (B.ph === 'buckle') {
    goal.copy(buckle);
    k = 1 - smooth(B.t / (RVK.buckleT * fast));
    if (B.t >= RVK.buckleT * fast) { B.ph = 'off'; B.k = 0; rvkArmFree('R'); return; }
  } else if (B.ph === 'dropped') {
    // Let go of at the safeword: her hand is hers again, the strap where it fell.
    k = Math.max(0, 1 - B.t / 0.4);
    goal.copy(hold);
  }
  B.k = k;
  // Her arm to it, unless her hand is in your hair (the aftercare's).
  if (rev.arm.mode === 'care') { rvkArmFree('R'); } else if (k > 0.01) {
    rvkArm('R', goal, pole, k, rvkFist);
    rvkGrip('R', B.ph !== 'dropped' && B.ph !== 'reach' || B.t > RVK.reachT * 0.6, B.ph === 'reach' ? smooth((B.t / RVK.reachT - 0.6) / 0.4) : k);
  } else rvkArmFree('R');
  rvkDir.copy(dir);
  rvkAcross.copy(across);
  if (!st) return;
  // The strap: laid while it comes out and goes back, solved while it is held.
  if (B.ph === 'draw') {
    st.lay(beltSag(rvkFist, exit, B.out), B.out, [fwd.x, fwd.y, fwd.z], dt);
    if (you && you.belt) you.belt(1 - B.out / L);
    if (B.t >= RVK.drawT) {
      if (you && you.belt) you.belt(0);
      beltAttitude(_kA.subVectors(exit, rvkFist), rvkQ, right);
      st.release(rvkFist, rvkQ);
      B.ph = 'hold'; B.t = 0;
    }
    return;
  }
  if (B.ph === 'feed') {
    st.lay(beltSag(rvkFist, exit, Math.max(B.out, 0.001)), B.out, [fwd.x, fwd.y, fwd.z], dt,
      Math.max(0.2, Math.min(1, B.t / 0.15)));
    if (you && you.belt) you.belt(1 - B.out / L);
    return;
  }
  if (st.mode !== 'sim') return;
  st.setDrag(B.ph === 'wind' ? BELT.windDrag : BELT.drag);
  beltAttitude(rvkDir, rvkQ, rvkAcross);
  const w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : { caps: null, n: 0, boxes: null, nb: 0 };
  st.world(w.caps || [], w.n, w.boxes, w.nb, rev.ch.y);
  st.step(dt, rvkFist, rvkQ);
  // FLUNG BACK OVER HER SHOULDER. A wind-up throws the strap back behind the
  // hand, and that is where the swing starts from: over the top it comes,
  // and unrolls on to you. Solved alone it did not — off a hand that rises
  // and stops, a metre of leather swings forward under it like a pendulum,
  // and the strike started with the strap hanging in front of her fist
  // (MEASURED: its tongue 0.5 m out toward you at the top of the wind-up, and
  // two strokes in three landing on your arms, your shins or nothing). So
  // through the wind-up each step is eased toward the curve a flung strap
  // makes — back off the fist and falling behind her — with the velocity of
  // that easing kept, which is the throw; the rest is the solver's.
  if (B.ph === 'wind') {
    const u = smooth(B.t / RVK.windT);
    const end = rvkFist.clone().addScaledVector(Pl.back, RVK.fling[0]);
    end.y += RVK.fling[1];
    st.lay(beltSag(rvkFist, end, L), L, [rvkAcross.x, rvkAcross.y, rvkAcross.z], dt, RVK.fling[2] * u);
    st.release(rvkFist, rvkQ);
  }
  // Debug: the last stroke, frame by frame — her fist and the strap's tongue.
  if (B.ph === 'wind' && B.t <= dt + 1e-6) rvk.trace = [];
  if (rvk.trace && (B.ph === 'wind' || B.ph === 'strike' || B.ph === 'through' || B.ph === 'back') && rvk.trace.length < 900) {
    const e = st.ends();
    rvk.trace.push([B.ph[0], +B.t.toFixed(3), rvkFist.toArray().map((x) => +x.toFixed(3)), e.tip.map((x) => +x.toFixed(3)),
      +st.stats.tip.toFixed(1), st.stats.onHer]);
  }
}

/** The round over: back to holding it, and her other choices again. */
function rvkRoundEnd(why) {
  const B = rvk.belt;
  B.n = 0;
  if (rvkBeltInHand() || B.ph === 'set' || B.ph === 'go') B.ph = 'hold';
  if (rvk.strap) rvk.strap.aim(null);
  rev.dom.next = Math.max(rev.dom.next, rev.clock + 2.0);
  rvkTrace({ pick: 'belt round end', why });
}

// ── the collar ───────────────────────────────────────────────────────────────

/** "Ogrlica." She comes to you with it. Answers true, or why not. */
function rvkCollarStart(why = 'mood') {
  if (!rev.on) return 'off';
  if (rev.care) return 'aftercare';
  const C = rvk.col;
  if (rvkCollarOn()) return 'already';
  if (rvkBeltOut()) return 'belt';
  if (rev.arm.mode === 'spank') return 'busy';
  if (typeof colLock !== 'undefined' && colLock > 0) return 'later';
  const v = revView();
  if (!v || !(v.ctx === 'stand' || v.ctx === 'kneel' || v.ctx === 'fours')) {
    // Lying down or between poses: on your feet first — her order, and the
    // collar the moment you are up.
    C.pend = why;
    if (v && v.ctx && v.ctx !== 'stand' && typeof revOrder === 'function' && !rev.dom.order) revOrder('stand', 'collar');
    return 'pending';
  }
  C.pend = null;
  Object.assign(C, { want: 'on', since: rev.clock, next: rev.clock + 6, said: false, cot: false, tug: null,
    keepFor: RVK.collarKeep[0] + Math.random() * (RVK.collarKeep[1] - RVK.collarKeep[0]), asked: false });
  // To you: in front of you, near enough that your body has only a step to
  // come to her for it (Baye's own `leashCome`).
  const r = jadrija.rideFrom();
  if (r) {
    const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
    const gx = r.x + fx * 0.95, gz = r.z + fz * 0.95;
    const [cx, cz] = ground.confine ? ground.confine(gx, gz, rev.ch.y) : [gx, gz];
    if (jadrija.kabina.room(cx, cz, 0.2)) revGo(cx, cz);
    rev.ch.face = revBone('pelvis', new THREE.Vector3());
  }
  revSay('collar', true, null, { still: revStill.dom });
  rvkTrace({ pick: 'collar', why });
  rvkNote('collar (' + why + ')');
  revHud();
  return true;
}

/** Off again: her hands at your neck, then you are your own. */
function rvkCollarEnd(why = 'done') {
  const C = rvk.col;
  if (!rvkCollarOn()) return 'not on';
  if (C.want === 'on' && !(typeof collarActive === 'function' && collarActive())) {
    C.want = null; C.lastOff = rev.clock; return 'off';
  }
  C.want = 'off';
  C.tug = null;
  C.lastOff = rev.clock;
  const got = typeof collarCmd === 'function' ? collarCmd('collar.off') : 'none';
  revSay('uncollar', false, null, { still: revStill.dom });
  rvkTrace({ pick: 'collar off', why: why + ' · ' + got });
  return got;
}

/**
 * A tug of hers, `gest` 'up' / 'down' / null (toward the cot), firm or not
 * (`u`). If the chain is slack she steps off first, and tugs once it is out.
 */
function rvkTug(gest = null, u = 0.85, why = 'mood') {
  const C = rvk.col;
  const s = typeof collarState === 'function' ? collarState() : null;
  if (!s || !s.on || !s.clipped || s.offT != null) return 'not on';
  if (C.tug) return 'busy';
  C.tug = { gest, u, t: 0, why, stepped: false };
  rvkTrace({ pick: 'tug' + (gest ? ':' + gest : ''), why, u: +u.toFixed(2) });
  return true;
}

/** Each frame of a tug of hers: out to taut, the tug, her hand drawn with it. */
function rvkTugTick(dt, s) {
  const C = rvk.col, T = C.tug;
  if (!T) return;
  T.t += dt;
  const hand = typeof colHand !== 'undefined' ? colHand : null;
  const span = hand ? hand.distanceTo(s.ring) : 0;
  if (!T.sent) {
    // Out to the end of it first: a step away from you along the chain.
    // (Not for the cot: she is at its side and away from you is over it.)
    if (span < RVK.taut && T.t < 2.5 && T.why !== 'cot') {
      if (!T.stepGoal) {
        const dx = rev.ch.x - s.ring.x, dz = rev.ch.z - s.ring.z, dl = Math.hypot(dx, dz) || 1;
        const want = RVK.taut + 0.15 - span;
        const gx = rev.ch.x + dx / dl * want, gz = rev.ch.z + dz / dl * want;
        const [cx, cz] = ground.confine ? ground.confine(gx, gz, rev.ch.y) : [gx, gz];
        revGo(cx, cz);
        T.stepGoal = true;
      }
      return;
    }
    if (typeof collarTug === 'function' && collarTug(T.u, T.gest)) {
      T.sent = true; T.t = 0; C.tugs++;
      T.landed0 = typeof colLog !== 'undefined' ? colLog.landed : 0;
      if (T.gest || T.why === 'cot') revSay('tug', false, null, { still: revStill.dom });
    } else { C.tug = null; return; }
  }
  if (T.sent && (typeof colYank === 'undefined' || !colYank) && T.t > 0.2) {
    const landed = typeof colLog !== 'undefined' && colLog.landed > T.landed0;
    let did = landed ? colLog.did : 'slack';
    // TO THE COT, said as well as pulled: a leash with slack in it beside the
    // cot does not come taut (she cannot step back over the cot to take it
    // up), and her pull is then the word the player has for it, "on the cot"
    // (`leashPose`) — the same road on.
    if (T.why === 'cot' && did !== 'cot' && jadrija.leashPose) {
      const got = jadrija.leashPose('cot');
      if (got === 'ok') did = 'cot';
    }
    C.did[did] = (C.did[did] || 0) + 1;
    rvkTrace({ pick: 'tug did', why: did });
    C.tug = null;
  }
}

/**
 * Her side of the leash, once a frame: where her hands are (at your neck while
 * it goes on and comes off, the loop at her hip while she leads you, drawn
 * back in a tug), where she stands, and what she says. After `revDriveChloe`.
 */
function rvkCollarTick(dt) {
  const C = rvk.col;
  const s = typeof collarState === 'function' ? collarState() : null;
  const on = !!(s && s.on);
  if (C.want === 'on' && !on && !C.asked) {
    // Arrived in front of you (or as near as the room lets her): ask for it.
    if (revAt() || rev.clock - C.since > 5) {
      const got = typeof collarCmd === 'function' ? collarCmd('collar.on') : 'none';
      C.asked = true;
      rvkTrace({ pick: 'collar ask', why: String(got) });
      if (got !== 'asked') { C.want = null; C.lastOff = rev.clock; rvkArmFree('R'); rvkArmFree('L'); return; }
    }
  }
  if (!on) {
    if (C.want === 'off' || (C.want === 'on' && C.asked && rev.clock - C.since > 3)) { C.want = null; }
    rvkArmEase('R', dt); rvkArmEase('L', dt);
    return;
  }
  if (C.want === 'on' && s.clipped && s.putT >= 2.85) C.want = null;
  // Her words, when its side says something happened.
  const said = jadrija.leashSaid ? jadrija.leashSaid() : null;
  if (said === 'on') revSay('lead', true, null, { still: revStill.dom });
  const fwd = rvkFigDir(1, 0, 0, new THREE.Vector3());
  const right = rvkFigDir(0, 0, 1, new THREE.Vector3());
  const down = new THREE.Vector3(0, -1, 0);
  // WHERE SHE STANDS while it goes on: near enough that your neck is in her
  // reach — a hand's width in front of her is past it (the first person had
  // to crouch for the same reason, 1.553.0) — and facing you.
  const putting = s.phase === 'leashKneel' || s.phase === 'leashPut';
  // FIRST PERSON, A LOOK DOWN while it goes on: her hands at your throat,
  // which from your own eye are under your chin — and then up to her again.
  const Yw = ground && ground.you;
  if (Yw && !bodyCam && s.phase === 'leashPut') {
    const want = s.putT < 2.3 ? -0.5 : -0.1;
    Yw.pitch += (want - Yw.pitch) * (1 - Math.exp(-4 * dt));
  }
  const neck = s.neck;
  if (putting && neck) {
    const dx = neck.x - rev.ch.x, dz = neck.z - rev.ch.z, dl = Math.hypot(dx, dz);
    if (dl > RVK.near + 0.03) {
      const step = Math.min(dl - RVK.near, 0.9 * dt);
      const [nx, nz] = ground.confine ? ground.confine(rev.ch.x + dx / dl * step, rev.ch.z + dz / dl * step, rev.ch.y)
        : [rev.ch.x + dx / dl * step, rev.ch.z + dz / dl * step];
      rev.ch.x = nx; rev.ch.z = nz;
    }
    rev.ch.goal = null;
    rev.ch.face = neck.clone();
  }
  // And back off while you go down on all fours, your head coming forward.
  if (s.phase === 'leashDown' && neck) {
    const dx = rev.ch.x - s.ring.x, dz = rev.ch.z - s.ring.z, dl = Math.hypot(dx, dz);
    if (dl < 0.85 && dl > 1e-3) {
      const step = Math.min(0.85 - dl, 0.9 * dt);
      const [nx, nz] = ground.confine ? ground.confine(rev.ch.x + dx / dl * step, rev.ch.z + dz / dl * step, rev.ch.y)
        : [rev.ch.x + dx / dl * step, rev.ch.z + dz / dl * step];
      rev.ch.x = nx; rev.ch.z = nz;
    }
  }
  // HER HANDS. The putting on and the taking off are the first person's
  // paths (LEASH_ON.put / .off, `collarHandTickIn`) laid on her right hand;
  // her left holds the strap's other side at your neck while it goes round.
  const out = (p, d = 0.035) => p.clone().addScaledVector(s.fwd, d);
  const path = (t, ks) => {
    let i = 1;
    while (i < ks.length - 1 && ks[i][0] < t) i++;
    const [t0, a] = ks[i - 1], [t1, b] = ks[i];
    const v = Math.max(0, Math.min(1, (t - t0) / Math.max(1e-3, t1 - t0)));
    return a.clone().lerp(b, v * v * (3 - 2 * v));
  };
  const hold = rvkFig(RVK.lead, new THREE.Vector3());
  let goalR = hold, kR = s.clipped ? 1 : 0, goalL = null, kL = 0;
  const poleR = right.clone().add(down.clone().multiplyScalar(0.6)).addScaledVector(fwd, -0.2);
  const poleL = right.clone().multiplyScalar(-1).add(down.clone().multiplyScalar(0.6)).addScaledVector(fwd, -0.2);
  if (s.phase === 'leashPut') {
    const P = [[0, hold.clone()], [0.50, out(s.left, 0.01)], [0.95, out(s.neck, 0.02)], [1.30, out(s.right, 0.01)],
      [1.62, out(s.buckle, 0.0)], [2.18, out(s.ring, 0.02)], [2.85, hold.clone()]];
    goalR = path(s.putT, P);
    kR = Math.max(s.clipped ? 1 : 0, Math.min(1, s.putT / 0.35) * (1 - Math.max(0, Math.min(1, (s.putT - 2.45) / 0.45))));
    goalL = out(s.right, 0.015);
    kL = Math.min(1, s.putT / 0.35) * (1 - Math.max(0, Math.min(1, (s.putT - 1.3) / 0.4)));
  } else if (s.offT != null && !s.fast) {
    const P = [[0, hold.clone()], [0.50, out(s.ring, 0.02)], [1.05, out(s.buckle, 0.0)],
      [1.45, out(s.neck, 0.02)], [1.80, out(s.right, 0.02)], [2.40, hold.clone()]];
    goalR = path(s.offT, P);
    kR = Math.min(1, s.offT / 0.3) * (1 - Math.max(0, Math.min(1, (s.offT - 2.0) / 0.4)));
    rev.ch.face = s.neck.clone();
  } else if (s.clipped) {
    // The loop at her hip, the chain running out of it toward you; and a
    // tug's draw, back along the chain and up or down with it.
    goalR = hold.clone();
    if (typeof colYank !== 'undefined' && colYank && typeof collarDraw === 'function') {
      goalR.addScaledVector(colYank.dir, colYank.D * collarDraw(colYank.t));
      // And the lean a yank is made with: a step back with it (the first
      // person's `step`, for a chain with more slack than her arm draws).
      const Y = COLLAR.yank;
      if (colYank.step > 0 && colYank.t < Y.rise + Y.peak) {
        const want = colYank.step * Math.min(1, colYank.t / (Y.rise + Y.peak));
        const d = want - (colYank.rvkStepped || 0);
        if (d > 0) {
          const hx = colYank.dir.x, hz = colYank.dir.z, hl = Math.hypot(hx, hz) || 1;
          const [nx, nz] = ground.confine ? ground.confine(rev.ch.x + hx / hl * d, rev.ch.z + hz / hl * d, rev.ch.y)
            : [rev.ch.x + hx / hl * d, rev.ch.z + hz / hl * d];
          rev.ch.x = nx; rev.ch.z = nz;
          colYank.rvkStepped = want;
        }
      }
    }
  }
  if (rev.arm.mode === 'care') { rvkArmFree('R'); rvkArmFree('L'); }
  else {
    rvk.armK.R = damp(rvk.armK.R, kR, 10, dt);
    if (rvk.armK.R > 0.01) { rvkArm('R', goalR, poleR, rvk.armK.R, null); rvkGrip('R', s.clipped || s.phase === 'leashPut', rvk.armK.R); }
    else rvkArmFree('R');
    rvk.armK.L = damp(rvk.armK.L, kL, 10, dt);
    if (rvk.armK.L > 0.01 && goalL) { rvkArm('L', goalL, poleL, rvk.armK.L, null); rvkGrip('L', true, rvk.armK.L * 0.6); }
    else rvkArmFree('L');
  }
  rvkTugTick(dt, s);
}

/** An arm let back to her clip over a few frames. */
function rvkArmEase(s, dt) {
  if (!rvk.armOn[s]) { rvk.armK[s] = 0; return; }
  rvk.armK[s] = damp(rvk.armK[s], 0, 10, dt);
  if (rvk.armK[s] < 0.01) rvkArmFree(s);
}

// ── her choices with them ────────────────────────────────────────────────────

/**
 * HER DECISION, the toys' part (from `revDecide`, before anything else): the
 * belt or the collar off or on, a round of the belt, and everything she does
 * with you on the leash. Answers what she chose, or null for the rest of her
 * choices (orders, her hand, the remote, a walk round you).
 */
function rvkDecide(v) {
  const D = rev.dom, B = rvk.belt, C = rvk.col;
  const ctx = v ? v.ctx : null;
  if (rvkBusy()) { D.next = rev.clock + 0.6; return 'busy'; }
  // ── on the leash ──
  if (rvkCollarOn()) return rvkCollarDecide(v);
  // ── the belt in her hand ──
  if (rvkBeltInHand()) {
    if (rev.clock - B.since > B.keepFor || (B.rounds >= 3 && Math.random() < 0.5)) {
      rvkBeltStow('done');
      D.next = rev.clock + 3.5;
      return 'beltback';
    }
    if (ctx === 'front' && (D.punish || Math.random() < 0.62)) {
      const n = D.punish ? 3 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * (1 + D.heat * 3));
      const why = (D.punish ? 'punishment' : 'mood') + ' | belt';
      D.punish = 0;
      const r = rvkBeltRoundStart(n, why);
      if (r === true) { D.next = rev.clock + 3; return 'belt'; }
    }
    return null;
  }
  // ── asked for ──
  if (B.ask) { B.ask = false; const r = rvkBeltStart('asked'); if (r === true) { D.next = rev.clock + 3; return 'belt'; } }
  if (C.ask) { C.ask = false; const r = rvkCollarStart('asked'); if (r === true || r === 'pending') { D.next = rev.clock + 3; return 'collar'; } }
  // ── on her own, as the scene warms up ──
  const n = D.obey + D.miss;
  if (rev.clock - B.lastOff > RVK.again && (ctx === 'front' || ctx === 'stand')
    && (D.heat >= 0.45 || D.miss >= 2 || n >= 5)) {
    const p = 0.30 + (D.punish ? 0.30 : 0) + 0.25 * Math.max(0, D.heat - 0.45);
    if (Math.random() < p) { if (rvkBeltStart(D.punish ? 'punish' : 'mood') === true) { D.next = rev.clock + 3; return 'belt'; } }
  }
  if (rev.clock - C.lastOff > RVK.collarAgain && (ctx === 'stand' || ctx === 'kneel' || ctx === 'fours') && n >= 3) {
    if (Math.random() < 0.28) { if (rvkCollarStart('mood') === true) { D.next = rev.clock + 4; return 'collar'; } }
  }
  return null;
}

/** With you on the leash: lead you round, tug you up or down, to the cot, or off. */
function rvkCollarDecide(v) {
  const D = rev.dom, C = rvk.col;
  const s = typeof collarState === 'function' ? collarState() : null;
  D.next = rev.clock + RVK.every[0] + Math.random() * (RVK.every[1] - RVK.every[0]);
  if (!s || !s.clipped || s.offT != null) { D.next = rev.clock + 1; return 'collar wait'; }
  if (rev.clock - C.since > C.keepFor) { rvkCollarEnd('done'); D.next = rev.clock + 5; return 'uncollar'; }
  const L = v && v.leash;
  const pose = L ? L.pose : 'fours';
  if (s.mode === 'cot') {
    // On the cot on the end of it: a tug that lifts your head to her, or off.
    if (Math.random() < 0.5) { rvkTug(null, 0.45, 'cot lift'); return 'tug'; }
    if (rev.clock - C.since > C.keepFor * 0.7) { rvkCollarEnd('cot'); return 'uncollar'; }
    return 'watch';
  }
  if (!(v && v.ctx === 'leash')) { D.next = rev.clock + 1; return 'collar wait'; }
  const cands = [];
  cands.push({ id: 'lead', s: 1.2 });
  if (pose === 'fours') cands.push({ id: 'up', s: 0.8 });
  if (pose === 'kneel') { cands.push({ id: 'up', s: 0.5 }); cands.push({ id: 'down', s: 0.6 }); }
  if (pose === 'stand') cands.push({ id: 'down', s: 0.9 });
  if (rev.clock - C.since > 25 && !C.cot) cands.push({ id: 'cot', s: 0.5 + 0.6 * D.heat });
  cands.push({ id: 'look', s: 0.35 });
  if (D.punish) { const up = cands.find((c) => c.id === (pose === 'stand' ? 'down' : 'up')); if (up) up.s *= 3; }
  const tot = cands.reduce((a, c) => a + c.s, 0);
  let x = Math.random() * tot, pick = cands[cands.length - 1];
  for (const c of cands) { x -= c.s; if (x <= 0) { pick = c; break; } }
  D.punish = 0;
  if (pick.id === 'lead') {
    // Somewhere else in the room, and you after her on her trail.
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2, d = 1.6 + Math.random() * 1.4;
      const gx = rev.ch.x + Math.cos(a) * d, gz = rev.ch.z + Math.sin(a) * d;
      const [cx, cz] = ground.confine ? ground.confine(gx, gz, rev.ch.y) : [gx, gz];
      if (Math.hypot(cx - gx, cz - gz) < 0.05 && jadrija.kabina.room(cx, cz, 0.45)) {
        revGo(cx, cz);
        rev.ch.face = null;
        if (Math.random() < 0.45) revSay('lead', false, null, { still: revStill.dom });
        rvkTrace({ pick: 'lead', why: 'to ' + cx.toFixed(1) + ', ' + cz.toFixed(1) });
        return 'lead';
      }
    }
    return 'lead:nowhere';
  }
  if (pick.id === 'up' || pick.id === 'down') { rvkTug(pick.id, 0.85, 'pose ' + pose); return 'tug'; }
  if (pick.id === 'cot') {
    // Beside the cot, and then a firm pull toward it — the leash's own road on.
    const S = rvkCotSide();
    if (S) {
      revGo(S.x, S.z);
      C.cot = true;
      C.toCot = { t: rev.clock };
      rvkTrace({ pick: 'lead to cot' });
      return 'cot';
    }
    return 'cot:nowhere';
  }
  revOrder('look', 'leash');
  return 'look';
}

/** A place by the cot's long side, on the room's side of it. */
function rvkCotSide() {
  const K = jadrija.kabina;
  const kit = K && K.kit ? K.kit() : null;
  const cot = kit && kit.cot;
  if (!cot) return null;
  const c = jadrija.toWorld ? jadrija.toWorld(cot[0], cot[1]) : null;
  if (!c) return null;
  let best = null;
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    const x = c[0] + Math.cos(a) * 1.05, z = c[2] + Math.sin(a) * 1.05;
    const [cx, cz] = ground.confine ? ground.confine(x, z, rev.ch.y) : [x, z];
    const bad = Math.hypot(cx - x, cz - z) + (K.room(cx, cz, 0.3) ? 0 : 5);
    if (!best || bad < best.bad) best = { bad, x: cx, z: cz };
  }
  return best && best.bad < 1 ? best : null;
}

/** Each frame, the toys' part of her (from `revTick`, after `revDriveChloe`). */
function rvkTick(dt) {
  if (!rev.on || !you || !you.fig) return;
  rvkPlace();
  rvkBeltTick(dt);
  if (!rvkBeltOut()) rvkCollarTick(dt);
  // Led to the cot: there, and you near enough — a firm pull toward it.
  const C = rvk.col;
  if (C.toCot && revAt() && !C.tug) {
    C.toCot = null;
    rvkTug(null, 0.9, 'cot');
  }
  // The collar she wants on once you are up (asked while you were lying down).
  if (C.pend && !rvkBusy() && !rev.care) {
    const v = revView();
    if (v && (v.ctx === 'stand' || v.ctx === 'kneel')) { const w = C.pend; C.pend = null; rvkCollarStart(w); }
  }
  // A dropped strap goes on falling where it fell, to the floor.
  const B = rvk.belt;
  if (B.ph === 'dropped' && rvk.strap && rvk.strap.mode === 'sim') {
    const w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : { caps: null, n: 0, boxes: null, nb: 0 };
    rvk.strap.world(w.caps || [], w.n, w.boxes, w.nb, rev.ch.y);
    rvk.strap.step(dt, rvkFist, rvkQ);
  }
}

/**
 * THE SAFEWORD, its toys' part (from `revSafe`): a swing stops where it is —
 * her hand lets go and the strap falls — a belt still coming out goes back
 * in at once, and the collar comes off, fast. Nothing of it lands after.
 */
function rvkSafe() {
  const B = rvk.belt, C = rvk.col;
  let did = [];
  if (B.ph !== 'off') {
    if (B.ph === 'reach' || B.ph === 'draw' || B.ph === 'stow' || B.ph === 'feed' || B.ph === 'buckle') {
      rvkBeltSnap(); did.push('belt on');
    } else {
      B.n = 0;
      const mid = B.ph === 'wind' || B.ph === 'strike' || B.ph === 'through';
      if (rvk.strap) rvk.strap.drop();
      B.dropped = true;
      B.ph = 'dropped'; B.t = 0;
      did.push(mid ? 'dropped mid-swing' : 'dropped');
    }
    B.lastOff = rev.clock;
  }
  C.tug = null; C.toCot = null; C.pend = null;
  if (typeof collarActive === 'function' && collarActive()) {
    if (jadrija && jadrija.leashOff) jadrija.leashOff('you');
    if (typeof colLock !== 'undefined') colLock = COLLAR.lock;
    if (typeof colYank !== 'undefined') colYank = null;
    C.want = null; C.lastOff = rev.clock;
    did.push('collar off');
  } else if (C.want) { C.want = null; did.push('collar cancelled'); }
  if (did.length) rvkTrace({ pick: 'safeword: ' + did.join(', ') });
  return did;
}

/** The swap back (or out of the room): everything of hers put away now. */
function rvkClear(why) {
  const B = rvk.belt, C = rvk.col;
  if (B.ph !== 'off') rvkBeltSnap();
  C.tug = null; C.toCot = null; C.pend = null;
  if (typeof collarActive === 'function' && collarActive() && jadrija && jadrija.leashOff) {
    jadrija.leashOff(why === 'asked' ? null : 'away');
  }
  C.want = null;
  rvkArmFree('R'); rvkArmFree('L');
  rvk.armK.R = rvk.armK.L = 0;
}

/**
 * The player asking: "use the belt" / "remen", "belt back", "collar me" /
 * "ogrlica", "take the collar off". Answers { ok, label }.
 */
function rvkAsk(what) {
  if (!rev.on) return { ok: false, label: 'roles: they are not reversed' };
  if (rev.care) return { ok: false, label: 'chloe: the aftercare first' };
  const B = rvk.belt, C = rvk.col;
  if (what === 'belt') {
    if (rvkBeltInHand()) {
      // Out already: the next round is now, if you are where she can.
      const v = revView();
      if (v && v.ctx === 'front' && B.n === 0) {
        const r = rvkBeltRoundStart(2 + Math.floor(Math.random() * 2), 'asked');
        return { ok: r === true, label: 'chloe: ' + (r === true ? 'the belt, now' : 'not now — ' + r) };
      }
      return { ok: false, label: 'chloe: it is in her hand — on your front on the cot for it' };
    }
    if (rvkCollarOn()) return { ok: false, label: 'chloe: the leash is in that hand — the collar off first' };
    if (rvkBusy()) { B.ask = true; return { ok: true, label: 'chloe: in a moment' }; }
    const r = rvkBeltStart('asked');
    return { ok: r === true, label: 'chloe: ' + (r === true ? 'her belt comes off' : 'not now — ' + r) };
  }
  if (what === 'beltback') {
    const r = rvkBeltStow('asked');
    return { ok: r === true || r === 'snapped', label: 'chloe: ' + (r === true || r === 'snapped' ? 'the belt goes back on' : 'the belt is ' + r) };
  }
  if (what === 'collar') {
    if (rvkCollarOn()) return { ok: false, label: 'chloe: it is on you already' };
    if (rvkBeltOut()) return { ok: false, label: 'chloe: the belt is in that hand — it goes back on first' };
    if (rvkBusy()) { C.ask = true; return { ok: true, label: 'chloe: in a moment' }; }
    const r = rvkCollarStart('asked');
    return { ok: r === true || r === 'pending', label: 'chloe: ' + (r === true ? 'the collar — come here'
      : r === 'pending' ? 'on your feet first, then the collar' : 'not now — ' + r) };
  }
  if (what === 'uncollar') {
    const r = rvkCollarEnd('asked');
    return { ok: r === 'off', label: 'chloe: ' + (r === 'off' ? 'she takes the collar off' : 'the collar is ' + r) };
  }
  return { ok: false, label: 'chloe: ?' };
}

/**
 * Your own pose on the leash, asked (a key, or the words): the leash's poses
 * and nothing else — anything else would have you walk out of the collar.
 * Answers true or why not; null when it is not the leash's to answer.
 */
function rvkLeashAsk(name) {
  if (!rvkCollarOn() || !(typeof collarActive === 'function' && collarActive())) return null;
  const map = { rise: 'stand', submit: 'kneel', 'sit.knees': 'kneel', fours: 'fours', flat: 'fours',
    'recline.bed': 'cot' };
  const p = map[name];
  if (!p) return name === 'look' || name === 'look.down' ? null : 'on the leash';
  const got = jadrija.leashPose ? jadrija.leashPose(p) : 'not on';
  return got === 'ok' ? true : got;
}

/** The scene block's part (from `revScene`): her belt out, what it has done. */
function rvkScene(o) {
  if (rvkBeltInHand()) o.belt_out = true;
  return o;
}

/** The tag's part (from `revHud`). */
function rvkHudTag() {
  const B = rvk.belt;
  if (B.ph !== 'off' && B.ph !== 'dropped') return T0k('rvk.belt');
  if (rvkCollarOn()) return T0k('rvk.collar');
  return '';
}
function T0k(k) { return typeof T === 'function' ? T(k) : k; }

if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, { 'rvk.belt': 'her belt', 'rvk.collar': 'on her leash' });
  Object.assign(STRINGS.hr || {}, { 'rvk.belt': 'njezin remen', 'rvk.collar': 'na njezinu povocu' });
  Object.assign(STRINGS.fr || {}, { 'rvk.belt': 'sa ceinture', 'rvk.collar': 'en laisse' });
}

/** `__fr.reverse.kit` — the debug half. */
const rvkApi = {
  belt: () => rvkAsk('belt'),
  beltBack: () => rvkAsk('beltback'),
  collar: () => rvkAsk('collar'),
  uncollar: () => rvkAsk('uncollar'),
  start: (what) => (what === 'collar' ? rvkCollarStart('probe') : rvkBeltStart('probe')),
  round: (n = 3) => rvkBeltRoundStart(n, 'probe'),
  tug: (gest = null, u = 0.85) => rvkTug(gest, u, 'probe'),
  cot: () => { const S = rvkCotSide(); if (!S) return null; revGo(S.x, S.z); rvk.col.cot = true; rvk.col.toCot = { t: rev.clock }; return S; },
  lead: () => rvkCollarDecide(Object.assign(revView() || {}, {})),
  tune: (o) => Object.assign(RVK, o || {}),
  trace: () => rvk.trace || [],
  pelvis: () => { const P = revBone('pelvis', new THREE.Vector3()); return P ? P.toArray() : null; },
  state: () => {
    const B = rvk.belt, C = rvk.col, st = rvk.strap;
    const s = typeof collarState === 'function' ? collarState() : null;
    return {
      belt: { ph: B.ph, t: +B.t.toFixed(2), k: +B.k.toFixed(2), n: B.n, rounds: B.rounds, strokes: B.strokes,
        lashes: B.lashes, pats: B.pats, landed: B.landed, off: B.off, heat: +B.heat.toFixed(2), charge: +B.charge.toFixed(2),
        dropped: B.dropped, hits: B.hits.slice(-12), worn: you && you.belt ? +you.belt().toFixed(2) : null,
        fist: rvkFist.toArray().map((x) => +x.toFixed(3)),
        strap: st ? { mode: st.mode, dropped: st.dropped, tip: +st.stats.tip.toFixed(2), vMax: +st.stats.vMax.toFixed(2),
          rescues: st.stats.rescues, msAvg: +(st.stats.msSum / Math.max(1, st.stats.frames)).toFixed(3),
          msMax: +st.stats.msMax.toFixed(3), onHer: st.stats.onHer, last: st.stats.last,
          buckle: st.mode !== 'off' ? st.ends().buckle.map((x) => +x.toFixed(3)) : null } : null,
        plan: { aim: rvkPlanP.aim.toArray().map((x) => +x.toFixed(2)), reg: rvkPlanP.reg } },
      collar: { want: C.want, on: !!(s && s.on), clipped: !!(s && s.clipped), phase: s ? s.phase : null, mode: s ? s.mode : null,
        pose: s ? s.pose : null, tugs: C.tugs, did: Object.assign({}, C.did), tug: C.tug ? { gest: C.tug.gest, sent: !!C.tug.sent } : null,
        since: +(rev.clock - C.since).toFixed(1), pend: C.pend },
      arms: { R: +rvk.armK.R.toFixed(2), L: +rvk.armK.L.toFixed(2), on: Object.assign({}, rvk.armOn) },
      log: rvk.log.slice(-20),
      // Where she stands against you: along you (+ toward your head) and across, m.
      stand: (() => {
        const P = revBone('pelvis', new THREE.Vector3());
        const hf = jadrija && jadrija.headFrame ? jadrija.headFrame() : null;
        if (!P || !hf) return null;
        const dx = rev.ch.x - P.x, dz = rev.ch.z - P.z;
        return { along: +(dx * hf.ax + dz * hf.az).toFixed(2), across: +(-dx * hf.az + dz * hf.ax).toFixed(2),
          spot: rvk.belt.spot ? [+rvk.belt.spot.x.toFixed(2), +rvk.belt.spot.z.toFixed(2)] : null };
      })(),
    };
  },
};
// `__fr.reverse.kit`: on the reverse's own debug object (49-reverse.js comes first).
if (typeof revApi !== 'undefined') revApi.kit = rvkApi;
