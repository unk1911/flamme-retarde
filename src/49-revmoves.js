// -----------------------------------------------------------------------------
// Roles reversed, phase 2c: Chloe's hand put where it lands, her knees, her
// eyes, and more of what she does to you.
//
// Plan, 2 Oct 2026 (the night loop, item 3): *"standing spanks done properly
// + more Chloe moves. Fix the 8–19 cm misses (solve the arm to the target with
// the same two-bone hinge solver as 1.561.1), kneel-by-the-cot instead of
// squat, head tracking you, hand poses (open palm, grip), circling, hair
// stroke, hand on your back holding you down, sitting on the cot edge."*
//
// The same two adults and the same game as src/49-reverse.js and
// src/49-revkit.js, and the safeword over all of it.
//
// HER PALM IS SOLVED ON TO THE SPOT (`rvmSolve`). Phase one swung her arm
// about one axis and leaned her in until the wrist was near the spot, which
// put the wrist 2-5 cm off it on the cot and 8-19 cm off it standing. Now the
// spot comes first and everything is worked back from it:
//   - the hand's attitude: the palm's face on to the skin (the flat of it
//     against the skin's own normal), the fingers along the skin pointing
//     away from her shoulder — and, winding up, the wrist cocked back;
//   - the wrist: where that palm puts it (the palm's middle is 75 mm along
//     the hand and its skin 19 mm off the bone line, measured off her mesh);
//   - the arm: the two-bone hinge solve of 1.561.1 (`hingeArm`'s algebra,
//     here returning its two turns), from her clip's own arm, the elbow
//     toward a pole;
//   - the hand: the turn left between the arm's and the one wanted, with the
//     twist about the forearm shared half and half between the forearm and
//     the hand, which is how this rig carries pronation.
// MEASURED at contact against the spot, every strike: see the CHANGELOG.
//
// SHE GOES WHERE HER ARM REACHES FROM (`rvmPlan`), before she reaches:
// round the spot in rings, each place clear of the room, the furniture and
// your body, turned so the spot is a little to the right of her (her right
// hand's side), and scored by how far she would have to bow to reach it.
// Low spots — you on the cot, kneeling, on all fours — she KNEELS to (her own
// `submit` clip held at its KNEEL key: both knees down, her back upright);
// high ones she takes standing, with a bend of her knees and a bow. The bow
// is then closed by feedback on her real shoulder while her hand waits over
// the spot.
//
// STANDING, KNEELING, ON ALL FOURS there is no cot ragdoll to take the slap:
// your body flinches (your hips pushed forward off her hand, your back
// arching after it — a spring on your spine, `rvmFlinch`) and your camera
// jolts.
//
// HER HEAD FOLLOWS YOU (`rvmLook`, the gaze of 43-jadrija.js turned round):
// neck and head share the turn, limited, and her irises take the rest. She
// watches your face; while her hand is on its way to you, she watches it.
//
// HER HANDS HAVE SHAPES (`rvmFingers`): the flat of the palm with the fingers
// together for a slap, a grip for your hair, a soft cup for a caress.
//
// HER MOVES (`rvmStart`, picked in her selector `revDecide` by where you are
// and how warm she is): slow circles round the cot; her hand stroking your
// hair; her hand pressed flat on the small of your back, holding you down
// (your body settles under it, and now and then her other hand spanks you
// while it does); sitting on the cot's edge beside you and leaning over;
// tilting your chin up when you kneel; a light hold of your hair at the
// nape. And while an order waits, she stands over you with her hands on her
// hips.
// -----------------------------------------------------------------------------

const RVM = {
  // The flat of her palm, on the hand bone, bind frame: its middle `along` m
  // down the hand from the wrist, its skin `off` m out of the palm's face —
  // and the hand's own line and the palm's face, right hand (the left is the
  // mirror). Measured off her mesh: the vertices skinned to `fingersR` in
  // the first 115 mm past the wrist, their plane's normal by its smallest
  // spread, and which face is the palm by the thumb's side of it.
  along: 0.075, off: 0.019,
  dirR: [0.749, -0.587, 0.307], palmR: [-0.055, -0.561, -0.826],
  // m from her shoulder she plans a wrist to be (her arm is 0.477 to the
  // wrist): a hair short of straight, so an elbow still reads.
  reach: 0.44,
  // A spot lower than this off the floor, she kneels for (m).
  kneelAt: 0.74,
  // `submit`'s KNEEL key (s): both knees down, her back upright, hands in
  // front of her. Held there.
  kneelT: 1.0, riseT: 0.85,
  // Her shoulders' heights standing and kneeling, and the joint her back
  // bows about (m off the floor) — what the plan reaches with.
  shY: 1.41, shYk: 0.95, hipY: 0.98, hipYk: 0.50, shX: 0.015, shZ: 0.176,
  bowMax: 0.62,
  // The rings she looks for a place on, round the spot (m).
  ring: [0.40, 0.47, 0.55, 0.64, 0.75, 0.88],
  // THE SWING, seconds: her hand over the spot first, wound up, down on to
  // it accelerating, on it, off it.
  T: { ready: 0.45, wind: 0.30, strike: 0.11, hold: 0.08, lift: 0.25 },
  // m out along the skin's normal: waiting over it, wound up (and up), and
  // lifted off; and how far the palm presses in, at the hold.
  readyOff: 0.15, windOff: 0.30, windUp: 0.07, liftOff: 0.12, press: 0.004,
  // rad her wrist is cocked back at the top of the wind-up.
  cock: 0.75,
  // Her look: how the neck and head share it, how far round the two go
  // (rad), how fast it comes, and how far her irises go on from there.
  look: { neck: 0.55, head: 0.45, max: 1.2, rate: 4.0, eye: 0.38 },
  // Hand shapes: the fingers' curl and the thumb's, rad.
  hands: { rest: [0, 0], flat: [-0.08, 0.20], grip: [1.15, 0.65], soft: [0.38, 0.18], hip: [0.85, 0.45], cup: [0.16, 0.10] },
  // Your flinch, standing, kneeling or on all fours: the spring on your
  // spine (rad of arch at a slap of `k` 12, its stiffness and damping), and
  // the push of your hips (m, standing).
  flinch: { arch: 0.16, w: 22, z: 0.35, push: 0.045 },
  // Holding you down: N on the small of your back, and the reflexes taken off.
  holdN: 70, calm: 0.85,
};

const RVM_SAY = {
  // English since 1.569.0, written for her (see `REV_SAY` in 49-reverse.js).
  circle: ["Let me see you from every side.", 'Mm. You look so good like this.'],
  stroke: ["There... you're so good.", "Shh. I'm right here."],
  hold: ['Stay down.', "Don't even try."],
  sitby: ['Let me get a good look at you.'],
  chin: ['Chin up. Look at me.'],
  grip: ['Mm. Stay just like that.', "You're mine."],
  wait: ["I'm waiting.", 'Hm? Well?'],
  // 1.569.0: showing off beside the cot, and holding you.
  thrust: ['Hehe. Like what you see?', 'Mm, watch me, babe.', "Mm-hm. Don't you dare look away."],
  hug: ['C\'mere, you.', "Mm. I've got you."],
  kiss: ['Mm. You taste like the beach.', 'One more... okay, two.'],
  // 1.573.0: lying behind you on the cot, holding you.
  spoon: ["C'mere. I've got you.", 'Stay. Just like this.', 'Mm. Right where you belong.'],
  nuzzle: ['Mm. You smell like sunscreen.', 'Love you, babe.'],
  spoonup: ["Okay. I'm right here.", 'Mm. Okay, up we get.'],
  curlup: ["C'mere... curl up for me."],
  later: ['Okay... later, then.'],
};

const rvm = {
  // Her body: 'stand' | 'kneel' | 'sit', what it is going to, since when; the
  // bow and the bend of her knees, and what they are going to.
  body: { mode: 'stand', want: 'stand', t: 0, bow: 0, bowTo: 0, w: 0, wTo: 0, turn: 0, turnTo: 0, sit: null, y0: 0 },
  // This frame's asks of her two arms (from the move or the swing), and
  // whether this file's aims are on each.
  req: { R: null, L: null }, on: { R: false, L: false }, k: { R: 0, L: 0 },
  hand: { R: 'rest', L: 'rest' }, curl: { R: [0, 0], L: [0, 0] },
  // Her look: what is applied (to take back off), how much, at what.
  look: { at: 0, on: false, tgt: null },
  move: null, acc: [], pend: null, said: 0,
  flinch: { x: 0, v: 0, ax: null, on: false, nh: null, push: 0 },
  plan: null, log: [], nape: 0, chin: 0, solves: 0,
  // The lag each arm is drawn behind its solve, and what was sent (see `rvmArms`).
  fb: { R: { e: new THREE.Vector3(), sent: new THREE.Vector3(), ok: false },
    L: { e: new THREE.Vector3(), sent: new THREE.Vector3(), ok: false } },
};
const _mA = new THREE.Vector3(), _mB = new THREE.Vector3(), _mC = new THREE.Vector3(), _mD = new THREE.Vector3();
const _mE = new THREE.Vector3(), _mF = new THREE.Vector3(), _mG = new THREE.Vector3(), _mH = new THREE.Vector3();
const _mS = new THREE.Vector3(), _mW = new THREE.Vector3(), _mU = new THREE.Vector3(), _mV = new THREE.Vector3();
const _mK = new THREE.Vector3(), _mL = new THREE.Vector3(), _mN = new THREE.Vector3(), _mT = new THREE.Vector3();
const _mQ = new THREE.Quaternion(), _mQ2 = new THREE.Quaternion(), _mQ3 = new THREE.Quaternion(), _mQ4 = new THREE.Quaternion();
const _mQU = new THREE.Quaternion(), _mQL = new THREE.Quaternion(), _mQH = new THREE.Quaternion(), _mQI = new THREE.Quaternion();
const _mM = new THREE.Matrix4(), _mM0 = new THREE.Matrix4(), _mM1 = new THREE.Matrix4();
const _mUP = new THREE.Vector3(0, 1, 0);

function rvmNote(s) { rvm.log.push([+rev.clock.toFixed(1), s]); if (rvm.log.length > 60) rvm.log.shift(); }
function rvmTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvmV(v) { return v ? [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)] : null; }

// ── her hand, solved ─────────────────────────────────────────────────────────

/** The hand's line, the palm's face and the knuckles' axis, bind frame, for side `s`. */
const rvmHandB = {};
function rvmHandBind(s) {
  if (rvmHandB[s]) return rvmHandB[s];
  const m = s === 'R' ? 1 : -1;
  const d = new THREE.Vector3(RVM.dirR[0], RVM.dirR[1], RVM.dirR[2] * m).normalize();
  const n = new THREE.Vector3(RVM.palmR[0], RVM.palmR[1], RVM.palmR[2] * m);
  n.addScaledVector(d, -n.dot(d)).normalize();
  // Rotating the fingers by +angle about `k` turns the line `d` toward `n`,
  // into the palm: k × d = n.
  const k = new THREE.Vector3().crossVectors(d, n).normalize();
  const B = new THREE.Matrix4().makeBasis(d, n, k);
  const o = d.clone().multiplyScalar(RVM.along).addScaledVector(n, RVM.off);
  rvmHandB[s] = { d, n, k, B, Bt: B.clone().transpose(), o };
  return rvmHandB[s];
}

/** The figure-space turn that lays the hand's (line, palm) on (`t`, `n`): a matrix. */
function rvmTurnFor(s, t, n, out) {
  const H = rvmHandBind(s);
  const l = _mL.crossVectors(t, n).normalize();
  _mM0.makeBasis(t, n, l);
  return out.multiplyMatrices(_mM0, H.Bt);
}

/**
 * Her clip's arm this frame, side `s`, figure space, on the collarbone as
 * drawn. `F` another figure on the same rig (`{ fig, mesh }`; 1.573.0, Baye's
 * own arm while Chloe spoons her) — the rigs are bone for bone the same, so
 * the arm's indices and lengths are.
 */
function rvmChain(s, F = null) {
  const A = typeof rvkArmInit === 'function' ? rvkArmInit() : null;
  const f = F ? F.fig : you && you.fig;
  if (!A || !f) return null;
  const a = A[s];
  const R = f.bindRest(), lq = f.local().q;
  const S = f.boneAt(a.iu, new THREE.Vector3());
  const qP = f.boneTurn(a.ip, new THREE.Quaternion()).multiply(a.pq);
  const qU = new THREE.Quaternion(lq[4 * a.iu], lq[4 * a.iu + 1], lq[4 * a.iu + 2], lq[4 * a.iu + 3]).premultiply(qP);
  const E = new THREE.Vector3(R.t[3 * a.il], R.t[3 * a.il + 1], R.t[3 * a.il + 2]).applyQuaternion(qU).add(S);
  const qL = new THREE.Quaternion(lq[4 * a.il], lq[4 * a.il + 1], lq[4 * a.il + 2], lq[4 * a.il + 3]).premultiply(qU);
  const W = new THREE.Vector3(R.t[3 * a.ih], R.t[3 * a.ih + 1], R.t[3 * a.ih + 2]).applyQuaternion(qL).add(E);
  const qH = new THREE.Quaternion(lq[4 * a.ih], lq[4 * a.ih + 1], lq[4 * a.ih + 2], lq[4 * a.ih + 3]).premultiply(qL);
  let hinge = a.e.clone().applyQuaternion(qU.clone().multiply(a.bq));
  // Somebody else's arm (`F`, 1.573.0): the hinge her clip has the elbow bent
  // on, not the bind's. Baye's curled arm is turned off the bind's plane, and
  // the two-bone solve keeps what the clip has off its hinge — 7.9 cm at the
  // wrist (MEASURED) before this; 0 after.
  // And hers, lying behind you (her `fetalHeld` arm is just as far off it).
  if (F || (typeof rvmSpoonOn === 'function' && rvmSpoonOn())) { const h = E.clone().sub(S).cross(W.clone().sub(E)); if (h.lengthSq() > 1e-6) hinge = h.normalize(); }
  const bH = new THREE.Quaternion(R.bindQ[4 * a.ih], R.bindQ[4 * a.ih + 1], R.bindQ[4 * a.ih + 2], R.bindQ[4 * a.ih + 3]);
  return { a, S, E, W, qU, qL, qH, hinge, bH };
}

/**
 * The two bones to wrist goal `G` (figure space), the elbow toward `P`:
 * `hingeArm`'s algebra (1.561.1), its two turns handed back.
 */
function rvmTwoBone(c, G, P) {
  const { a, S, E, W, hinge } = c;
  const l1 = a.l1, l2 = a.l2;
  const D = G.clone().sub(S);
  const dl = D.length() || 1e-3;
  const u = D.multiplyScalar(1 / dl);
  const d = Math.min(Math.max(dl, Math.abs(l1 - l2) + 1e-3), (l1 + l2) * 0.999);
  const ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const sa = Math.sqrt(1 - ca * ca);
  const v = P.clone().addScaledVector(u, -P.dot(u));
  if (v.lengthSq() < 1e-8) v.set(1, 0, 0).addScaledVector(u, -u.x);
  v.normalize();
  const dirU = u.clone().multiplyScalar(ca).addScaledVector(v, sa);
  const elbow = S.clone().addScaledVector(dirU, l1);
  const wrist = S.clone().addScaledVector(u, d);
  const dirL = wrist.clone().sub(elbow).normalize();
  const r0 = E.clone().sub(S).normalize();
  const h0 = hinge.clone().addScaledVector(r0, -hinge.dot(r0));
  const h1 = new THREE.Vector3().crossVectors(dirU, dirL);
  const QU = new THREE.Quaternion(), QL = new THREE.Quaternion();
  if (h0.lengthSq() < 1e-8 || h1.lengthSq() < 1e-10) QU.setFromUnitVectors(r0, dirU);
  else {
    h0.normalize(); h1.normalize();
    const M0 = new THREE.Matrix4().makeBasis(r0, h0, new THREE.Vector3().crossVectors(r0, h0));
    const M1 = new THREE.Matrix4().makeBasis(dirU, h1, new THREE.Vector3().crossVectors(dirU, h1));
    QU.setFromRotationMatrix(M1.multiply(M0.transpose()));
  }
  const rl = W.clone().sub(E).normalize().applyQuaternion(QU);
  if (h1.lengthSq() > 0.5) {
    rl.addScaledVector(h1, -rl.dot(h1));
    const phi = Math.atan2(new THREE.Vector3().crossVectors(rl, dirL).dot(h1), rl.dot(dirL));
    QL.setFromAxisAngle(h1, phi);
  } else QL.setFromUnitVectors(rl.normalize(), dirL);
  return { QU, QL, wrist, elbow, dirL, short: dl - d };
}

/**
 * HER ARM AND HAND TO A SPOT, side `s` ('R' | 'L'). The palm's middle to
 * world point `Cw`, its face against the skin whose normal (out of the skin)
 * is `nW`, the fingers along the skin toward `dW` (projected on to it), the
 * elbow toward `poleW`, the wrist cocked back `cock` rad — `k` 0..1 of the
 * way from her clip's own arm. Writes the aims on her upper arm, forearm and
 * hand, and answers the palm's point as solved (world) into `out`.
 *
 * WHICH WAY THE FINGERS LIE is the one thing a palm on skin leaves free, and
 * it is chosen, not typed: of the ways round the skin's normal within 100° of
 * `dW`, the one whose hand turn off the forearm (as her clip carries the
 * hand) is least, with a little cost for straying from `dW` — a slap lands
 * with the hand in line with the arm swinging it.
 *
 * The chain is the clip's own this frame (her local pose) carried by her
 * collarbone as it was last drawn, as `rvkArm` reads it — so a kneel or a bow
 * laid on her spine is in it.
 */
function rvmSolve(s, Cw, nW, dW, poleW, cock, k, out = null, F = null) {
  const c = rvmChain(s, F);
  if (!c) return null;
  const f = F ? F.fig : you.fig, mesh = F ? F.mesh : you.mesh;
  const Mi = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const mqi = mesh.quaternion.clone().invert();
  const n = nW.clone().applyQuaternion(mqi).normalize().negate();
  const t0 = dW.clone().applyQuaternion(mqi);
  t0.addScaledVector(n, -t0.dot(n));
  if (t0.lengthSq() < 1e-6) t0.set(0, -1, 0).addScaledVector(n, n.y);
  t0.normalize();
  const C = Cw.clone().applyMatrix4(Mi);
  const P = poleW.clone().applyQuaternion(mqi);
  const HB = rvmHandBind(s);
  const attitude = (t) => {
    const tt = t.clone(), nn = n.clone();
    if (cock) {
      // Cocked back: the fingers turned up off the skin about the knuckles'
      // line — a turn by −cock about t × n takes t away from n.
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().crossVectors(tt, nn).normalize(), -cock);
      tt.applyQuaternion(q); nn.applyQuaternion(q);
    }
    const M = rvmTurnFor(s, tt, nn, new THREE.Matrix4());
    return { q: new THREE.Quaternion().setFromRotationMatrix(M), off: HB.o.clone().applyMatrix4(M) };
  };
  const handTurn = (sol, att) => {
    const qHd = att.q.clone().multiply(c.bH);
    const qHnow = sol.QL.clone().multiply(sol.QU).multiply(c.qH);
    return qHd.multiply(qHnow.invert());
  };
  const angOf = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  // A first solve along `dW`, to choose the fingers' way with.
  let att = attitude(t0);
  let sol = rvmTwoBone(c, C.clone().sub(att.off), P);
  let best = null;
  for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75]) {
    const t = t0.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(n, da));
    const at2 = attitude(t);
    const sc = angOf(handTurn(sol, at2)) + 0.18 * Math.abs(da);
    if (!best || sc < best.sc) best = { sc, at: at2, da };
  }
  if (best.da !== 0) { att = best.at; sol = rvmTwoBone(c, C.clone().sub(att.off), P); }
  const kk = Math.max(0, Math.min(1, k));
  const QU = kk >= 1 ? sol.QU : new THREE.Quaternion().slerpQuaternions(_mQI, sol.QU, kk);
  const QL = kk >= 1 ? sol.QL : new THREE.Quaternion().slerpQuaternions(_mQI, sol.QL, kk);
  let QH = att.q.clone().multiply(c.bH).multiply(QL.clone().multiply(QU).multiply(c.qH).invert());
  if (kk < 1) QH = new THREE.Quaternion().slerpQuaternions(_mQI, QH, kk);
  // The twist about the forearm's line, half of it to the forearm.
  const fax = sol.dirL;
  const pr = fax.clone().multiplyScalar(QH.x * fax.x + QH.y * fax.y + QH.z * fax.z);
  const tw = new THREE.Quaternion(pr.x, pr.y, pr.z, QH.w);
  const tl = Math.hypot(tw.x, tw.y, tw.z, tw.w);
  let half = _mQI;
  if (tl > 1e-6) { tw.x /= tl; tw.y /= tl; tw.z /= tl; tw.w /= tl; half = new THREE.Quaternion().slerpQuaternions(_mQI, tw, 0.5); }
  armAimQ(f, 'armU' + s, QU);
  armAimQ(f, 'armL' + s, half.clone().multiply(QL));
  armAimQ(f, 'hand' + s, QH.clone().multiply(half.clone().invert()));
  // Somebody else's arm (`F`): the aims are laid, and nothing of hers is touched.
  if (F) { F.pred = { E: sol.elbow.clone().applyMatrix4(mesh.matrixWorld), W: sol.wrist.clone().applyMatrix4(mesh.matrixWorld) }; return out ? out.copy(sol.wrist).add(att.off).applyMatrix4(mesh.matrixWorld) : null; }
  rvm.on[s] = true;
  rvm.solves++;
  rvm.last = rvm.last || {};
  // For a probe: the hand's turn off the forearm and its twist (deg), the
  // fingers' way off `dW`, and how far the wrist goal was past her reach.
  rvm.last[s] = { hand: +(angOf(QH) * 57.3).toFixed(0), twist: +(angOf(tw) * 57.3).toFixed(0), da: best.da,
    short: +sol.short.toFixed(3) };
  if (!out) return null;
  return out.copy(sol.wrist).add(att.off).applyMatrix4(mesh.matrixWorld);
}

/** Her palm's point as she is drawn now, world (side `s`); or `F`'s. */
function rvmPalm(s, out, F = null) {
  const f = F ? F.fig : you && you.fig;
  if (!f) return null;
  const i = f.boneIndex('hand' + s);
  if (i < 0) return null;
  const B = f.bindRest(), T = B.bindT, HB = rvmHandBind(s);
  // The bind offset is off the hand's head in the bind pose; `boneTurn` carries it.
  _mA.copy(HB.o).applyQuaternion(f.boneTurn(i, _mQ));
  f.boneAt(i, out).add(_mA);
  void T;
  return out.applyMatrix4(F ? F.mesh.matrixWorld : you.mesh.matrixWorld);
}

/** Her fingers: `curl` rad into the palm and `thumb` rad, side `s`, about the knuckles as drawn. */
function rvmFingers(s, curl, thumb) {
  const f = you && you.fig;
  if (!f) return;
  if (Math.abs(curl) < 0.01 && Math.abs(thumb) < 0.01) {
    f.aim('fingers' + s, 0, 0, 1, 0); f.aim('thumb' + s, 0, 0, 1, 0);
    return;
  }
  const HB = rvmHandBind(s);
  const ih = f.boneIndex('hand' + s);
  const ax = _mA.copy(HB.k).applyQuaternion(f.boneTurn(ih, _mQ));
  f.aim('fingers' + s, ax.x, ax.y, ax.z, curl);
  f.aim('thumb' + s, ax.x, ax.y, ax.z, thumb);
}

/** Let an arm go back to her clip (and her hand open). */
function rvmArmFree(s) {
  const f = you && you.fig;
  if (!f) return;
  if (rvm.on[s]) {
    f.aim('armU' + s, 0, 0, 1, 0); f.aim('armL' + s, 0, 0, 1, 0); f.aim('hand' + s, 0, 0, 1, 0);
    rvm.on[s] = false;
  }
  rvm.k[s] = 0;
}

/**
 * An ask of one arm for this frame: `{ C, n, d, pole, cock, shape }` (world
 * vectors), eased in from the clip's arm and out again by `rvmArms`.
 */
function rvmAsk(s, o) { rvm.req[s] = o; }

/** Her shoulder, world, side `s` (as last drawn). */
function rvmShoulder(s, out) {
  const A = typeof rvkArmInit === 'function' ? rvkArmInit() : null;
  if (!A || !you || !you.fig) return null;
  return you.fig.boneAt(A[s].iu, out).applyMatrix4(you.mesh.matrixWorld);
}

/** Her right and forward, world (walker yaw). */
function rvmAxes(yaw) {
  return { f: new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), r: new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)) };
}

/** The arms, once a frame after the moves have asked: solved, or let go. */
function rvmArms(dt) {
  const kitR = typeof rvk !== 'undefined' && rvk.armOn && rvk.armOn.R;
  const kitL = typeof rvk !== 'undefined' && rvk.armOn && rvk.armOn.L;
  for (const s of ['R', 'L']) {
    const q = rvm.req[s];
    // Her belt or the leash has this hand: the toys' file solves it.
    if ((s === 'R' && kitR) || (s === 'L' && kitL)) { if (rvm.on[s]) { rvm.on[s] = false; } rvm.k[s] = 0; rvm.req[s] = null; rvm.fb[s].ok = false; continue; }
    if (q) {
      rvm.k[s] = q.snap ? 1 : damp(rvm.k[s], 1, q.rate || 7, dt);
      if (rvm.k[s] > 0.995) rvm.k[s] = 1;
      // THE LAST FRAME'S MISS TAKEN OFF (`fb`): the solve reads her collarbone
      // as it was last drawn and her clip's arm as last sampled, so while her
      // body moves under it — a bow still easing in, her knees still bending,
      // her clip breathing — the palm is drawn a frame behind the place it was
      // solved for. MEASURED before this: 4.5 cm off standing, almost all of it
      // short of the skin. Where the palm was drawn against where it was sent
      // is that lag, and it changes slowly; so it is sent that much the other
      // way. Only once the arm is fully hers (k = 1).
      const fb = rvm.fb[s];
      const C = q.C.clone();
      if (q.fb && rvm.k[s] >= 1 && fb.ok) C.sub(fb.e); else fb.e.set(0, 0, 0);
      rvmSolve(s, C, q.n, q.d, q.pole, q.cock || 0, rvm.k[s], q.out || null);
      fb.sent.copy(C); fb.ok = !!q.fb && rvm.k[s] >= 1; fb.gain = q.fbK || 0.8;
      rvm.last = rvm.last || {};
      rvm.qs = rvm.qs || {}; rvm.qs[s] = q;
      const sh = RVM.hands[q.shape || 'rest'] || RVM.hands.rest;
      const c = rvm.curl[s];
      c[0] = damp(c[0], sh[0], 12, dt); c[1] = damp(c[1], sh[1], 12, dt);
      rvmFingers(s, c[0] * rvm.k[s], c[1] * rvm.k[s]);
      rvm.hand[s] = q.shape || 'rest';
    } else if (rvm.on[s]) {
      // Back to her clip over a few frames: the last ask, eased off.
      const last = rvm.qs && rvm.qs[s];
      rvm.fb[s].ok = false;
      rvm.k[s] = damp(rvm.k[s], 0, 8, dt);
      if (rvm.k[s] < 0.02 || !last) { rvmArmFree(s); rvmFingers(s, 0, 0); rvm.curl[s][0] = rvm.curl[s][1] = 0; rvm.hand[s] = 'rest'; }
      else {
        rvmSolve(s, last.C, last.n, last.d, last.pole, last.cock || 0, rvm.k[s]);
        rvmFingers(s, rvm.curl[s][0] * rvm.k[s], rvm.curl[s][1] * rvm.k[s]);
      }
    }
    rvm.req[s] = null;
  }
}

// ── where she goes to reach ──────────────────────────────────────────────────

/** Your body's points on the floor (level), when you are not on the cot. */
function rvmYourFeet() {
  const f = jadrija && jadrija.figure;
  if (!f) return [];
  const out = [];
  f.mesh.updateMatrixWorld();
  for (const n of ['pelvis', 'spine03', 'head', 'legLL', 'legLR', 'footL', 'footR', 'toeL', 'toeR', 'handL', 'handR']) {
    const i = f.boneIndex(n);
    if (i < 0) continue;
    const p = f.boneAt(i, new THREE.Vector3()).applyMatrix4(f.mesh.matrixWorld);
    out.push([p.x, p.z, p.y]);
  }
  return out;
}

/** Your trunk and head, world: what her own head keeps off. */
function rvmYourBones() {
  const f = jadrija && jadrija.figure;
  if (!f) return [];
  const out = [];
  for (const n of ['pelvis', 'spine02', 'spine03', 'chest', 'neck', 'head']) {
    const p = revBone(n, new THREE.Vector3());
    if (p) out.push(p);
  }
  // The middle of your head, not its root.
  const Hd = rvmYourHead();
  if (Hd) out.push(Hd.C);
  return out;
}

/**
 * WHERE SHE STANDS (OR KNEELS) TO REACH. `reach` is a list of `{ s, T, n }`
 * (the hand, the world spot, the skin's normal there). Each place round the
 * spots, in rings, is kept only if the room, the furniture and your body
 * leave it free (and, kneeling, the shins behind her too); she is turned so
 * the spots sit a little to the side of the hand that reaches them; and it is
 * scored by the bow her back needs to bring that shoulder within reach, by
 * whether her shoulder is on the skin's side of it, by the walk, and by
 * `o.prefer` (a level direction from the spot she would rather be on).
 * Answers `{ x, z, yaw, mode, bow, w }` or null.
 */
function rvmPlan(reach, o = {}) {
  if (!reach.length || !ground || !jadrija || !jadrija.kabina) return null;
  const fy = rev.ch.y;
  const cx = reach.reduce((a, r) => a + r.T.x, 0) / reach.length;
  const cz = reach.reduce((a, r) => a + r.T.z, 0) / reach.length;
  const low = Math.min(...reach.map((r) => r.T.y)) - fy;
  const mode = o.mode || (low < RVM.kneelAt ? 'kneel' : 'stand');
  const v = revView();
  const feet = v && v.onBed ? [] : rvmYourFeet();
  const body = rvmYourBones();
  const clear = (x, z, r) => {
    const [qx, qz] = ground.confine ? ground.confine(x, z, fy) : [x, z];
    if (Math.hypot(qx - x, qz - z) > 0.012) return false;
    if (!jadrija.kabina.room(x, z, 0.10)) return false;
    for (const p of feet) if (Math.hypot(p[0] - x, p[1] - z) < r) return false;
    return true;
  };
  const shY = mode === 'kneel' ? RVM.shYk : RVM.shY, hipY = mode === 'kneel' ? RVM.hipYk : RVM.hipY;
  let best = null;
  const rings = o.ring || RVM.ring;
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2;
    for (const rr of rings) {
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (!clear(x, z, 0.30)) { if (o.why) o.why.clear = (o.why.clear || 0) + 1; continue; }
      // Turned so the spots sit `phi` to the reaching hand's side of her.
      const s0 = reach[0].s;
      const yD = Math.atan2(-(cx - x), -(cz - z));
      for (const phi of o.phi || [0.40, 0.20, 0.62]) {
        const yaw = yD + (s0 === 'R' ? phi : -phi) * (reach.length > 1 ? 0.3 : 1);
        const { f, r } = rvmAxes(yaw);
        if (mode === 'kneel' && !clear(x - f.x * 0.38, z - f.z * 0.38, 0.22)) continue;
        // The least bow that brings every hand's shoulder within reach.
        let bow = -1;
        for (let b = 0; b <= (o.bowMax || RVM.bowMax) + 1e-6; b += 0.05) {
          let ok = true;
          for (const R of reach) {
            const sg = R.s === 'R' ? 1 : -1;
            const up = (shY - hipY) * Math.cos(b), fw = (shY - hipY) * Math.sin(b) + RVM.shX;
            const sx = x + f.x * fw + r.x * RVM.shZ * sg, sz = z + f.z * fw + r.z * RVM.shZ * sg, sy = fy + hipY + up;
            if (Math.hypot(R.T.x - sx, R.T.y - sy, R.T.z - sz) > (o.reach || RVM.reach)) { ok = false; break; }
          }
          if (ok) { bow = b; break; }
        }
        if (bow < 0) { if (o.why) o.why.reach = (o.why.reach || 0) + 1; continue; }
        // And her head, bowed that far, clear of you: kneeling close behind
        // you it went into your back (photographed).
        const hy = (shY - hipY) * 1.30, hx = x + f.x * (hy * Math.sin(bow) + 0.06), hz = z + f.z * (hy * Math.sin(bow) + 0.06);
        const hh = fy + hipY + hy * Math.cos(bow);
        if (body.some((p) => Math.hypot(p.x - hx, p.y - hh, p.z - hz) < (o.headR || 0.27))) { if (o.why) o.why.head = (o.why.head || 0) + 1; continue; }
        let score = bow * 1.4 + Math.abs(rr - 0.5) * 0.4 + Math.abs(phi - 0.4) * 0.3
          + 0.10 * Math.hypot(x - rev.ch.x, z - rev.ch.z);
        for (const R of reach) {
          // Her shoulder on the skin's own side of the spot: a hand comes at
          // skin from outside it.
          const sg = R.s === 'R' ? 1 : -1;
          const sx = x + r.x * RVM.shZ * sg, sz = z + r.z * RVM.shZ * sg, sy = fy + shY;
          const side = (sx - R.T.x) * R.n.x + (sy - R.T.y) * R.n.y + (sz - R.T.z) * R.n.z;
          if (side < 0.05) score += 3 + (0.05 - side) * 6;
          // And not with the spot behind or inside her: level, in front.
          const lx = R.T.x - x, lz = R.T.z - z;
          if (lx * f.x + lz * f.z < 0.12) score += 2;
        }
        if (o.prefer) {
          const dx = x - cx, dz = z - cz, dd = Math.hypot(dx, dz) || 1;
          score -= (dx * o.prefer.x + dz * o.prefer.z) / dd * (o.preferK || 0.8);
        }
        if (!best || score < best.score) best = { x, z, yaw, mode, bow, score, r: rr, phi };
      }
    }
  }
  if (best) {
    best.w = mode === 'stand' ? Math.max(0, Math.min(0.45, (1.05 - low) * 0.9)) : 0;
    rvm.plan = { x: +best.x.toFixed(2), z: +best.z.toFixed(2), yaw: +best.yaw.toFixed(2), mode, bow: +best.bow.toFixed(2),
      w: +best.w.toFixed(2), r: best.r, phi: best.phi, score: +best.score.toFixed(2) };
  }
  return best;
}

/** Go there: walk, then turn, then kneel or bend. `P` from `rvmPlan`. */
function rvmGoPlan(P) {
  if (!P) return false;
  const { f } = rvmAxes(P.yaw);
  rvm.body.want = 'stand';
  revGo(P.x, P.z);
  rev.ch.face = new THREE.Vector3(P.x + f.x * 3, rev.ch.y, P.z + f.z * 3);
  rvm.goal = P;
  return true;
}

/** There, turned, and down (or bent) as the plan has it. */
function rvmSettled() {
  const P = rvm.goal;
  if (!P || !revAt()) return false;
  let dy = P.yaw - rev.ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  if (Math.abs(dy) > 0.12) return false;
  const B = rvm.body;
  if (P.mode === 'kneel') return B.mode === 'kneel' && B.t > RVM.kneelT + 0.05;
  return B.mode === 'stand';
}

/** Down on her knees, or up, or sitting — `rvmBody` does the rest. */
function rvmWant(mode) { rvm.body.want = mode; }

// ── her body ─────────────────────────────────────────────────────────────────

/**
 * Whether she is held where she is this frame: kneeling, sitting, or on her
 * way up or down. `revSteer` turns her but does not walk her.
 */
function rvmHold() {
  const B = rvm.body;
  return B.mode !== 'stand' || B.want !== 'stand' || B.t < RVM.riseT && B.was && B.was !== 'stand';
}

/**
 * Her body this frame, for `revDriveChloe`: the clip, its fade, the bend and
 * the bow, and where her root goes. KNEELING is her own `submit` clip, held
 * at its KNEEL key (both knees down, her back upright); getting up is the
 * idle faded in over `riseT`, which lifts her as it comes. SITTING on the
 * cot's edge is `sitHeld` with her root on the mattress (`rvmSitTick`).
 */
function rvmBody(dt) {
  const B = rvm.body;
  B.t += dt;
  // Pinning you on the cot (1.586.0, src/49-revpin.js): astride your back,
  // her body is that file's from the climb on to her feet again.
  if (B.mode === 'pin') {
    const r = typeof rvpBody === 'function' ? rvpBody(dt) : null;
    if (r) return r;
    B.mode = 'stand'; B.want = 'stand'; B.t = 9; B.was = null;
  }
  // Lying behind you (1.573.0): the spoon has her until it puts her back on
  // the edge, sitting — `rvmSpoonTick`. Down on to her side over the swing,
  // and up on to the edge again over the way out.
  if (B.mode === 'spoon') {
    const M = rvm.move;
    if (!M || M.id !== 'spoon' || M.lie == null) { B.mode = 'stand'; B.want = 'stand'; B.t = 0; }
    else {
      // Sitting while her legs come up (or go down), lying from there.
      const P = RVM_SPOON, lying = M.ph === 'up' ? M.lie >= 0.999 : M.lie >= P.legsUp;
      const T = M.ph === 'up' ? P.upT : P.swingT;
      return { clip: lying ? 'fetalHeld' : 'sitHeld', fade: T * (1 - P.legsUp) * 0.9, speed: 1 };
    }
  }
  // Walking? Not while down: up first.
  if (B.mode !== 'stand' && rev.ch.goal) B.want = 'stand';
  // Down only once the getting up is done; kneeling to sitting is via standing.
  if (B.want !== B.mode && !(B.mode === 'stand' && B.was && B.was !== 'stand' && B.t < RVM.riseT)) {
    B.was = B.mode; B.mode = B.mode !== 'stand' ? 'stand' : B.want; B.t = 0;
    rvmNote('body ' + B.was + ' → ' + B.mode);
  }
  B.bow = damp(B.bow, B.bowTo, 5, dt);
  B.w = damp(B.w, B.wTo, 5, dt);
  B.turn = damp(B.turn, B.turnTo, 4, dt);
  B.push = damp(B.push || 0, B.pushTo || 0, 10, dt);
  const st = you.fig.state;
  if (B.mode === 'kneel') {
    // Held at the KNEEL key.
    if (st && st.cur && you.fig.playing() === 'submit' && st.curT > RVM.kneelT) st.curT = RVM.kneelT;
    return { clip: 'submit', fade: 0.25, speed: 1 };
  }
  if (B.mode === 'sit') return { clip: 'sitHeld', fade: 0.8, speed: 1 };
  const walk = rev.ch.sp > 0.2;
  return { clip: walk ? 'walk' : 'idle', fade: B.was && B.was !== 'stand' && B.t < 0.1 ? RVM.riseT : 0.25,
    speed: walk ? Math.min(2, Math.max(0.6, rev.ch.sp / 0.92)) : 1 };
}

// ── her look ─────────────────────────────────────────────────────────────────

const _lkA = new THREE.Quaternion();   // what was aimed last frame
const _lkR = new THREE.Quaternion(), _lkS = new THREE.Quaternion();
/**
 * HER HEAD AND EYES ON `T` (world), or let go with null. 43-jadrija.js's
 * gaze, on her: the turn that takes her nose as the CLIP holds it (last
 * frame's own aim taken back off) on to the way to you, limited, 0.55 of it
 * on her neck and 0.45 on her head — and her irises on from there, up to
 * `look.eye` rad, in her head's bind frame.
 */
function rvmLook(T, dt) {
  const f = you && you.fig, L = rvm.look, C = RVM.look;
  if (!f) return;
  L.at = damp(L.at, T ? 1 : 0, C.rate, dt);
  const hi = f.boneIndex('head');
  if (hi < 0) return;
  if (L.at < 0.004) {
    if (L.on) { f.aim('neck', 0, 1, 0, 0); f.aim('head', 0, 1, 0, 0); _lkA.identity(); L.on = false; if (you.eyes) you.eyes(null); }
    return;
  }
  if (T) L.tgt = T.clone();
  if (!L.tgt) return;
  L.on = true;
  const mqi = _mQ4.copy(you.mesh.quaternion).invert();
  // Between her eyes.
  const H = f.boneAt(hi, _mA).applyMatrix4(you.mesh.matrixWorld);
  const hq = f.boneTurn(hi, _mQ);
  const eye = _mB.set(0.114, 0.032, 0).applyQuaternion(hq).applyQuaternion(you.mesh.quaternion).add(H);
  const v = _mC.copy(L.tgt).sub(eye).applyQuaternion(mqi);
  if (v.lengthSq() < 1e-6) return;
  v.normalize();
  // Her head as the clip holds it: last frame's own aim taken back off.
  const clipH = _mQ3.copy(_lkA).invert().multiply(hq);
  const Fc = _mD.set(1, 0, 0).applyQuaternion(clipH).normalize();
  _lkR.setFromUnitVectors(Fc, v);
  const sp = Math.hypot(_lkR.x, _lkR.y, _lkR.z);
  const ang = 2 * Math.atan2(sp, _lkR.w);
  const k = Math.min(1, ang > 1e-4 ? C.max / ang : 1) * L.at;
  _lkR.copy(_lkS.slerpQuaternions(_mQI, _lkR, k));
  _lkA.copy(_lkR);
  armAimQ(f, 'neck', _lkS.slerpQuaternions(_mQI, _lkR, C.neck));
  armAimQ(f, 'head', _lkS.slerpQuaternions(_mQI, _lkR, C.head));
  // Her eyes: what is left, in her head's bind frame once it has turned.
  if (you.eyes) {
    const hNew = _mQ2.copy(_lkR).multiply(clipH);   // R · the clip's head: hers this frame
    const e = _mE.copy(v).applyQuaternion(hNew.invert());
    const ea = Math.acos(Math.max(-1, Math.min(1, e.x)));
    if (ea > C.eye) {
      const p = Math.hypot(e.y, e.z) || 1;
      e.set(Math.cos(C.eye), Math.sin(C.eye) * e.y / p, Math.sin(C.eye) * e.z / p);
    }
    // Eased with the look, and never down past the lids.
    e.y = Math.max(-0.30, Math.min(0.30, e.y));
    e.lerpVectors(_mF.set(1, 0, 0), e, L.at);
    you.eyes([e.x, e.y, e.z]);
    L.eye = [e.x, e.y, e.z];
  }
}

/** Your face (the body you are in), world. */
function rvmYourFace(out) {
  const H = revBone('head', out);
  if (!H) return null;
  const f = jadrija.figure;
  const hq = f.boneTurn(f.boneIndex('head'), _mQ);
  return H.add(_mA.set(0.10, 0.07, 0).applyQuaternion(hq).applyQuaternion(f.mesh.quaternion));
}

/** Your head's frame, world: its middle, its up and its forward. */
function rvmYourHead() {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const hi = f.boneIndex('head');
  const H = revBone('head', new THREE.Vector3());
  if (!H) return null;
  const q = f.boneTurn(hi, new THREE.Quaternion()).premultiply(f.mesh.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), fw = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const C = H.clone().addScaledVector(up, 0.085).addScaledVector(fw, 0.015);
  return { H, C, up, fw, rt: new THREE.Vector3().crossVectors(fw, up).normalize() };
}

// ── what she hits: spots on you ──────────────────────────────────────────────

/** Your pelvis's frame, world: where it is, its up, its forward. */
function rvmYourPelvis() {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const P = revBone('pelvis', new THREE.Vector3());
  if (!P) return null;
  const q = f.boneTurn(f.boneIndex('pelvis'), new THREE.Quaternion()).premultiply(f.mesh.quaternion);
  return { P, q, up: new THREE.Vector3(0, 1, 0).applyQuaternion(q), fw: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
    rt: new THREE.Vector3(0, 0, 1).applyQuaternion(q) };
}

/**
 * A spot on your bottom, OFF THE COT (standing, kneeling, on all fours): the
 * fullest point of cheek `side` as you are drawn (`jadrija.butt`, off
 * v2.0's own rear profile), a hand's width of play laid on it in your
 * pelvis's frame — and the skin's normal there, out from your pelvis's own
 * line at that height. Answers `{ T, n, side, hit: null, key }`.
 */
function rvmFloorSpot(side, jit) {
  const Pv = rvmYourPelvis();
  if (!Pv) return null;
  const B = jadrija.butt ? jadrija.butt() : null;
  const c = B && B.find((b) => b.side === side);
  const T = c ? new THREE.Vector3(c.x, c.y, c.z)
    : Pv.P.clone().addScaledVector(Pv.fw, -0.13).addScaledVector(Pv.rt, 0.07 * side).addScaledVector(Pv.up, -0.07);
  // Its normal: out of your pelvis's line through that height.
  const rel = _mA.copy(T).sub(Pv.P);
  const ax = Pv.P.clone().addScaledVector(Pv.up, rel.dot(Pv.up));
  const n = T.clone().sub(ax);
  n.addScaledVector(Pv.fw, -0.35 * Math.max(0, n.dot(Pv.fw)));
  n.normalize();
  if (jit) T.addScaledVector(Pv.up, jit[0]).addScaledVector(Pv.rt, jit[1]);
  return { T, n, side, hit: null, floor: true };
}

/**
 * A spot on you ON THE COT, from point `o` (her eye) at `aim` (world): the
 * cot's own `cotAim`, which says what it is (bottom, thigh, back), which side,
 * and the skin's normal there. Answers `{ T, n, side, hit }` or null.
 */
function rvmCotSpot(o, aim) {
  if (!jadrija.cotAim) return null;
  const d = aim.clone().sub(o);
  const hit = jadrija.cotAim(o, d);
  if (!hit || hit.miss) return null;
  const n = hit.n ? new THREE.Vector3(hit.n[0], hit.n[1], hit.n[2]) : new THREE.Vector3(0, 1, 0);
  return { T: new THREE.Vector3(hit.x, hit.y, hit.z), n, side: hit.side || 1, hit, o: o.clone(), aim: aim.clone() };
}

/** A point on your back's skin, from straight over it (the hold, the stroke). */
function rvmCotSkinUnder(p) {
  const o = p.clone().add(_mA.set(0, 0.6, 0));
  return rvmCotSpot(o, p);
}

// ── the swing ───────────────────────────────────────────────────────────────
//
// `rev.arm` (49-reverse.js) is the swing's state, as it was in phase one:
// `mode` 'spank', its phase, its clock, how many, how hard. What changed is
// everything inside it: the place is planned and gone to first (`go`), she
// kneels or bends (`down`), her hand waits over the spot while her bow
// closes on it (`ready`), winds up (`wind`), comes down on to it accelerating
// with the palm opening flat (`strike`), and on the frame it arrives the slap
// is `revSlap`'s — then a moment on you (`hold`) and off (`lift`).

/** A spot for this stroke, wherever you are: on the cot by `cotAim`, off it by your cheek. */
function rvmSpankSpot(v) {
  const A = rev.arm;
  if (v.ctx === 'front') {
    const Pv = rvmYourPelvis();
    if (!Pv) return null;
    // Aimed from over her side of you at your seat (the near cheek most of
    // the time), with play, the way phase one did — from her eye where she
    // will kneel, or where she is.
    const hf = jadrija.headFrame ? jadrija.headFrame() : null;
    const ax = hf ? hf.ax : 1, az = hf ? hf.az : 0;
    const across = new THREE.Vector3(-az, 0, ax);
    // From the ROOM'S side of the cot, whichever side of you she is on now
    // (1.575.0). The cot's other long side is the wall: after a move at
    // your head she could be standing past its end on the wall's side, and
    // a spot aimed from there was one no floor reaches — MEASURED in a
    // playtest bent over the edge, 54-92 cm short, two rounds of replans and
    // 90 s of her walking to and fro without a slap.
    const G = rvmCotGeom();
    const roomSide = G && G.out ? (G.out.x * across.x + G.out.z * across.z >= 0 ? 1 : -1) : 0;
    const sideOf = roomSide || ((rev.ch.x - Pv.P.x) * across.x + (rev.ch.z - Pv.P.z) * across.z >= 0 ? 1 : -1);
    const o = Pv.P.clone().addScaledVector(across, 0.62 * (A.from || sideOf)).add(_mA.set(0, 0.62, 0));
    const r = Math.random();
    const along = r < 0.12 ? 0.20 : r < 0.25 ? -0.20 : (Math.random() - 0.4) * 0.12;
    const aim = Pv.P.clone().add(_mA.set(-ax * along, 0.04, -az * along))
      .addScaledVector(across, (Math.random() - 0.3) * 0.10 * (A.from || sideOf));
    const S = rvmCotSpot(o, aim);
    if (S && S.hit && (S.hit.reg === 'butt' || S.hit.reg === 'thigh' || S.hit.reg === 'back')) return S;
    const S2 = rvmCotSpot(o, Pv.P.clone().add(_mA.set(0, 0.06, 0)));
    return S2 && S2.hit ? S2 : null;
  }
  const side = A.side0 || (Math.random() < 0.5 ? 1 : -1);
  return rvmFloorSpot(side, [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.04 * side]);
}

/** The spot again this frame: you move under her (the ragdoll, your own body). */
function rvmSpotNow(S) {
  if (!S) return null;
  if (S.floor) {
    const N = rvmFloorSpot(S.side, null);
    if (!N) return S;
    if (S.jitL == null) {
      const Pv = rvmYourPelvis();
      const q = Pv.q.clone().invert();
      S.jitL = S.T.clone().sub(N.T).applyQuaternion(q);
    }
    const Pv = rvmYourPelvis();
    N.T.add(S.jitL.clone().applyQuaternion(Pv.q));
    S.T.copy(N.T); S.n.copy(N.n);
    return S;
  }
  // On the cot: the same ray, asked again, kept only near where it was.
  const N = rvmCotSpot(S.o, S.T.clone().addScaledVector(S.n, -0.01));
  if (N && N.T.distanceTo(S.T) < 0.07) { S.T.copy(N.T); S.n.copy(N.n); S.hit = N.hit; }
  return S;
}

/** Start a round: `n` slaps. Answers true, or why not. */
function rvmSpankStart(n, why, o = {}) {
  if (!rev.on) return 'off';
  const v = revView();
  const ctx = v ? v.ctx : null;
  if (!(ctx === 'front' || ctx === 'stand' || ctx === 'kneel' || ctx === 'fours')) return 'notthere';
  const A = rev.arm;
  Object.assign(A, { mode: 'spank', ph: 'go', t: 0, n, err: 0, side0: null, from: null, ctx, hits: 0, hold: !!o.hold, fails: 0, replans: 0 });
  A.k = 9 + 7 * rev.dom.heat + (Math.random() < rev.dom.heat * 0.4 ? 4 : 0);
  // Firmer stern, lighter warm, harder when you begged for harder (1.583.0).
  if (typeof rmoodForce === 'function') { A.k = rmoodForce(A.k); rmood.hardNext = 0; }
  if (ctx !== 'front') A.side0 = Math.random() < 0.5 ? 1 : -1;
  // A spot she has somewhere to stand for — up to four tries (1.575.0).
  // The spot is a ray at you with play in it, and bent over the edge one in
  // five went high on your back or to your far thigh, where no floor reaches:
  // the whole round was refused for that one draw ('noplace', MEASURED).
  let S = null, P = null, reach = null;
  for (let tries = 0; tries < 4 && !P; tries++) {
    S = o.pin && typeof rvpSpankSpot === 'function' ? rvpSpankSpot() : rvmSpankSpot(v);
    if (!S) continue;
    reach = [{ s: 'R', T: S.T, n: S.n }];
    // Holding you down with her left hand while her right does it.
    if (o.hold && rvm.move && rvm.move.id === 'hold' && rvm.move.spot) reach.push({ s: 'L', T: rvm.move.spot.T, n: rvm.move.spot.n });
    // Already where her hand reaches it from — on her knees by you holding you
    // down, or still there from the last round: she stays where she is.
    const lowT = Math.min(...reach.map((r) => r.T.y)) - rev.ch.y < RVM.kneelAt;
    const here = !rev.ch.goal && rvm.body.mode === (lowT ? 'kneel' : 'stand') && reach.every((r) => {
      const sh = rvmShoulder(r.s, new THREE.Vector3());
      return sh && sh.distanceTo(r.T) < RVM.reach + 0.05;
    });
    // Only from where she is (1.575.0: her other fist in your hair). Asked
    // before anything of hers is moved: the old way planned, walked and stood
    // her up, and then took it back — her knees stayed wanting up, and her
    // palm was 25 cm off your hair for the rest of the hold, MEASURED.
    if (o.stay) { if (here) P = { x: rev.ch.x, z: rev.ch.z, yaw: rev.ch.yaw, mode: rvm.body.mode, bow: rvm.body.bow, w: rvm.body.w, here: true }; continue; }
    // From on top of you (1.586.0): where she is, always — her trunk turns to it (`rvpSpankReach`).
    if (o.pin) { P = { x: rev.ch.x, z: rev.ch.z, yaw: rev.ch.yaw, mode: 'pin', bow: 0, w: 0, here: true }; continue; }
    P = here ? { x: rev.ch.x, z: rev.ch.z, yaw: rev.ch.yaw, mode: rvm.body.mode, bow: rvm.body.bow, w: rvm.body.w, here: true }
      : rvmPlan(reach, { prefer: ctx === 'front' ? null : S.n });
  }
  if (!S) { A.mode = null; return 'nospot'; }
  if (o.stay && !P) { A.mode = null; return 'out of reach'; }
  if (!P) { A.mode = null; rvmTrace({ pick: 'spank:noplace', why: ctx }); return 'noplace'; }
  A.stay = !!o.stay || !!o.pin;
  A.pin = !!o.pin;
  A.at = S; A.tgt = S.T.clone();
  // On the cot: her side of you, for the spots that follow.
  if (ctx === 'front') {
    const Pv = rvmYourPelvis();
    const hf = jadrija.headFrame ? jadrija.headFrame() : null;
    const ax = hf ? hf.ax : 1, az = hf ? hf.az : 0;
    A.from = (P.x - Pv.P.x) * -az + (P.z - Pv.P.z) * ax >= 0 ? 1 : -1;
  }
  A.plan = P;
  if (P.here) rvm.goal = P; else rvmGoPlan(P);
  rvmTrace({ pick: 'spank x' + n, why, ctx, heat: +rev.dom.heat.toFixed(2), place: P.mode + ' bow ' + P.bow.toFixed(2) });
  return true;
}

/** The swing, a frame. From `revArmTick` while `rev.arm.mode` is 'spank'. */
function rvmSpankTick(dt) {
  const A = rev.arm, R = RVM.T;
  A.t += dt;
  const v = revView();
  const ctx = v ? v.ctx : null;
  if (A.ph !== 'hold' && A.ph !== 'lift' && ctx !== A.ctx) {
    rvmTrace({ pick: 'spank off', why: 'you moved: ' + (v ? v.phase : '?') });
    A.mode = null; A.ph = 'rise'; return;
  }
  const S = A.at;
  if (A.ph === 'go') {
    if (A.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
    if (A.pin || rvmSettled() || A.t > 7) { A.ph = 'ready'; A.t = 0; if (!A.stay) { rvm.body.bowTo = A.plan.bow; rvm.body.wTo = A.plan.w; } }
    return;
  }
  rvmSpotNow(S);
  const T = S.T, n = S.n;
  const sh = rvmShoulder('R', _mS);
  // The fingers along the skin, away from her shoulder.
  const dW = _mD.copy(T).sub(sh || T);
  const { f, r } = rvmAxes(rev.ch.yaw);
  // The elbow out and a little up and back.
  const pole = new THREE.Vector3().copy(r).multiplyScalar(1).addScaledVector(f, -0.35).add(_mA.set(0, 0.35, 0));
  const at = (k, cock, shape, snap = false) => {
    const C = new THREE.Vector3().copy(T).addScaledVector(n, k);
    rvmAsk('R', { C, n: n.clone(), d: dW.clone(), pole, cock, shape, rate: 9, snap, fb: true });
    return C;
  };
  const u = (x) => Math.min(1, Math.max(0, x));
  const sm = (x) => { const e = u(x); return e * e * (3 - 2 * e); };
  // From the wind-up on, her back and knees stay where they are: a body
  // still settling under the arm is a palm drawn behind where it was sent.
  if (A.ph !== 'ready' && !(A.stay && A.ph === 'go')) { rvm.body.bowTo = rvm.body.bow; rvm.body.wTo = rvm.body.w; }
  if (A.ph === 'ready') {
    at(RVM.readyOff, RVM.cock * 0.3, 'flat');
    // Her bow closed on the spot by feedback on her real shoulder — not
    // while her other hand holds your hair (`stay`): the bow carries that
    // shoulder too, and the fist rode 9-10 cm off your hair while it moved
    // (MEASURED, 1.575.0). She is within reach of both already.
    // From on top of you (1.586.0): her trunk turned and bent to it, closed on her real shoulder.
    if (sh && A.pin && typeof rvpSpankReach === 'function') A.err = rvpSpankReach(sh, T, dt);
    else if (sh && A.stay) A.err = Math.max(0, sh.distanceTo(T) - RVM.reach - 0.05);
    else if (sh) {
      const need = sh.distanceTo(T) - RVM.reach;
      rvm.body.bowTo = Math.max(0, Math.min(RVM.bowMax + 0.25, rvm.body.bowTo + need * Math.min(1, dt * 3)));
      if (A.plan.mode === 'stand' && rvm.body.bowTo > RVM.bowMax) rvm.body.wTo = Math.min(0.5, rvm.body.wTo + need * dt * 2);
      A.err = Math.max(0, need);
    }
    if (rev.armStop === 'aim') return;
    // Still out of reach after all that bowing: not a swing at the air (one
    // landed 22 cm off before this, MEASURED) — somewhere nearer, or the
    // next spot.
    if (A.t > R.ready + 1.2 && A.err >= 0.03) {
      A.replans = (A.replans || 0) + 1;
      const P = A.replans <= 2 && !A.pin ? rvmPlan([{ s: 'R', T: S.T, n: S.n }], { prefer: S.floor ? S.n : null }) : null;
      rvmTrace({ pick: 'spank:reach', why: (A.err * 100).toFixed(0) + ' cm short, ' + (P ? 'moving' : 'next spot') });
      if (P) { A.plan = P; rvmGoPlan(P); A.ph = 'go'; A.t = 0; }
      else {
        // A spot given up on. Twice in one round and the round is over: no
        // more walking round the cot after a slap that is not there.
        A.fails = (A.fails || 0) + 1;
        if (A.fails >= 2) {
          rvmTrace({ pick: 'spank:gave up', why: A.fails + ' spots out of reach' });
          A.mode = null; A.ph = 'rise'; A.t = 0; A.fails = 0; rvm.downFor = 1.0;
          return;
        }
        A.ph = 'lift'; A.t = R.lift; A.replans = 0;
      }
      return;
    }
    if (A.t > R.ready && (A.err < 0.015 || A.t > R.ready + 1.2) && rvm.k.R > 0.97) {
      A.ph = 'wind'; A.t = 0; A.replans = 0;
    }
    return;
  }
  if (A.ph === 'wind') {
    const e = sm(A.t / R.wind);
    const C = new THREE.Vector3().copy(T).addScaledVector(n, RVM.readyOff + (RVM.windOff - RVM.readyOff) * e)
      .add(_mA.set(0, RVM.windUp * e, 0));
    rvmAsk('R', { C, n: n.clone(), d: dW.clone(), pole, cock: RVM.cock * (0.3 + 0.7 * e), shape: 'flat', snap: true, fb: true });
    if (A.t >= R.wind) {
      A.ph = 'strike'; A.t = 0; A.at1 = false;
      A.w0 = C.clone();
      if (Math.random() < 0.55) revSay('spank', false, null, { still: revStill.dom });
    }
    return;
  }
  if (A.ph === 'strike') {
    const e = u(A.t / R.strike), s = e * e;
    const C = new THREE.Vector3().lerpVectors(A.w0, T, s);
    rvmAsk('R', { C, n: n.clone(), d: dW.clone(), pole, cock: RVM.cock * (1 - s), shape: 'flat', snap: true, fb: true });
    // ARRIVED, and one frame on it before it counts: the frame the palm
    // first reaches the spot it is solved against the arm as it was a frame
    // earlier and further up, and the lag (`fb`) is the last frame's — up to
    // 5 cm off at full stretch, kneeling (MEASURED). On the next it is the
    // spot's own. 17 ms.
    if (A.t >= R.strike && !A.at1) { A.at1 = true; return; }
    if (A.t >= R.strike) {
      A.at1 = false;
      // Contact: on this frame the palm is drawn on the spot — measured next
      // frame, off the bones as drawn.
      rvm.pend = { T: T.clone(), n: n.clone(), ctx: A.ctx, phase: v ? v.phase : null, reg: S.hit ? S.hit.reg : 'cheek', t: rev.clock };
      revSlap(S, A.k);
      if (S.floor) rvmFlinch(n, A.k);
      A.ph = 'hold'; A.t = 0; A.hits++;
    }
    return;
  }
  if (A.ph === 'hold') {
    at(-RVM.press, 0, 'flat', true);
    if (rev.armStop === 'hold') return;
    if (A.t >= R.hold) { A.ph = 'lift'; A.t = 0; }
    return;
  }
  if (A.ph === 'lift') {
    at(RVM.liftOff * sm(A.t / R.lift), 0.15 * sm(A.t / R.lift), 'flat', true);
    if (A.t >= R.lift) {
      A.n -= 1;
      if (A.n > 0) {
        const N = A.pin && typeof rvpSpankSpot === 'function' ? rvpSpankSpot() : rvmSpankSpot(v);
        if (N && A.pin) { A.at = N; A.tgt = N.T.clone(); A.ph = 'ready'; A.t = R.ready * 0.55; return; }
        if (N) {
          A.at = N; A.tgt = N.T.clone();
          // Still in reach from where she is? Then on; else to a new place.
          const sh2 = rvmShoulder('R', _mE);
          if (sh2 && sh2.distanceTo(N.T) < RVM.reach + 0.10) { A.ph = 'ready'; A.t = R.ready * 0.55; }
          else if (A.stay) { A.mode = null; A.ph = 'rise'; A.t = 0; return; }
          else {
            const P = rvmPlan([{ s: 'R', T: N.T, n: N.n }], { prefer: N.floor ? N.n : null });
            if (P) { A.plan = P; rvmGoPlan(P); A.ph = 'go'; A.t = 0; } else A.ph = 'ready';
          }
          return;
        }
      }
      A.mode = null; A.ph = 'rise'; A.t = 0;
      rvm.downFor = 1.6;
    }
  }
}

/** The palm against the spot, measured: called at the top of a frame after a contact. */
function rvmMeasure() {
  // The lag, each side whose last solve asked for it: drawn against sent.
  for (const s of ['R', 'L']) {
    const fb = rvm.fb[s];
    if (!fb.ok) continue;
    const d = rvmPalm(s, new THREE.Vector3());
    if (!d) continue;
    // What was sent was the goal less the last estimate; what is left over is
    // added to it, so the estimate is the whole lag.
    fb.e.lerp(d.sub(fb.sent), fb.gain || 0.8);
    if (fb.e.length() > 0.12) fb.e.setLength(0.12);
  }
  const P = rvm.pend;
  if (!P) return;
  rvm.pend = null;
  const palm = rvmPalm('R', new THREE.Vector3());
  if (!palm) return;
  const e = palm.distanceTo(P.T);
  const into = palm.clone().sub(P.T).dot(P.n);
  rvm.acc.push({ t: +P.t.toFixed(1), ctx: P.ctx, phase: P.phase, reg: P.reg, err: +e.toFixed(4), along: +into.toFixed(4),
    twist: rvm.last && rvm.last.R ? rvm.last.R.twist : null, short: rvm.last && rvm.last.R ? rvm.last.R.short : null,
    mode: rvm.body.mode, bow: +rvm.body.bow.toFixed(2) });
  if (rvm.acc.length > 200) rvm.acc.shift();
  rev.arm.err = e;
}

// ── your flinch, off the cot ─────────────────────────────────────────────────

/**
 * A slap with nothing under you but the floor: your hips pushed forward off
 * her hand and your back arching after it — a spring on your spine (about
 * the line across you, square to the push), and standing, the whole of you a
 * few centimetres forward. The camera's jolt is `revSlap`'s.
 */
function rvmFlinch(n, k) {
  const F = rvm.flinch;
  const nh = new THREE.Vector3(n.x, 0, n.z);
  if (nh.lengthSq() < 1e-4) nh.set(0, 0, 1);
  nh.normalize();
  F.nh = nh;
  // About the line across you: up × (the push's way back out), world.
  F.ax = new THREE.Vector3().crossVectors(_mUP, nh).normalize();
  F.v += RVM.flinch.arch * (k / 12) * RVM.flinch.w;
  F.on = true;
  const v = revView();
  F.push = v && v.ctx === 'stand' ? RVM.flinch.push * Math.min(1.4, k / 12) : 0;
}

function rvmFlinchTick(dt) {
  const F = rvm.flinch, f = jadrija && jadrija.figure;
  if (!F.on || !f) return;
  const w = RVM.flinch.w, z = RVM.flinch.z;
  F.v += (-w * w * F.x - 2 * z * w * F.v) * dt;
  F.x += F.v * dt;
  if (Math.abs(F.x) < 1e-4 && Math.abs(F.v) < 1e-3) {
    F.on = false; F.x = 0; F.v = 0;
    f.aim('spine01', 0, 0, 1, 0); f.aim('spine02', 0, 0, 1, 0);
    return;
  }
  const ax = _mA.copy(F.ax).applyQuaternion(_mQ.copy(f.mesh.quaternion).invert());
  f.aim('spine01', ax.x, ax.y, ax.z, F.x * 0.6);
  f.aim('spine02', ax.x, ax.y, ax.z, F.x * 0.4);
  // Standing: the push of your hips, walked in a few frames.
  if (F.push > 1e-4 && ground && ground.you && rev.walk) {
    const step = Math.min(F.push, 0.6 * dt);
    ground.you.x -= F.nh.x * step; ground.you.z -= F.nh.z * step;
    F.push -= step;
  }
}

// ── her moves ────────────────────────────────────────────────────────────────

/** The moves she can choose where you are: `[{ id, s }]` for `revDecide`. */
function rvmCands(ctx, D) {
  const out = [];
  if (!ctx || rvm.move) return out;
  const onCot = ctx === 'front' || ctx === 'back' || ctx === 'side' || ctx === 'sit' || ctx === 'cotKneel';
  const recent = (id) => D.last.slice(-4).filter((x) => x === id).length;
  // Her belt or the leash in her hand: only what `rvmStart` will do with it
  // full (1.575.0 — the rest were picked, refused 'hand full', and cost her
  // three seconds of standing there each; up to four in a row, MEASURED).
  const full = typeof rvkHandFull === 'function' && rvkHandFull();
  const add = (id, s) => { if (!full || id === 'circle') out.push({ id: 'move:' + id, s: s * (recent(id) ? 0.3 : 1) }); };
  if (onCot) add('circle', 0.35);
  if (onCot || ctx === 'kneel' || ctx === 'fours') add('stroke', 0.30 + 0.25 * Math.min(2, D.streak));
  if (ctx === 'front') add('hold', 0.35 + 0.5 * D.heat);
  if (ctx === 'front' || ctx === 'back' || ctx === 'side') add('sitby', 0.32);
  if (ctx === 'kneel' || ctx === 'cotKneel') add('chin', 0.70);
  if (ctx === 'kneel' || ctx === 'fours' || ctx === 'stand' || ctx === 'cotKneel' || ctx === 'front') add('grip', 0.25 + 0.45 * D.heat);
  // 1.569.0. Her hip tease, now and then at middling heat and never twice in
  // a few picks; her hug and kiss while you are on your back, likelier the
  // better you have been doing.
  if ((onCot || ctx === 'stand' || ctx === 'kneel') && !recent('thrust') && D.heat > 0.3 && D.heat < 0.85) add('thrust', 0.22);
  if (ctx === 'back' && !recent('hug')) add('hug', 0.16 + 0.22 * Math.min(2, D.streak));
  // 1.573.0. Lying behind you and holding you: on the cot, when she is not
  // worked up — after a run of you doing what she says, or just because — and
  // likeliest when you are already curled up on your side. Never twice close
  // together (a minute off after one).
  if (onCot && !recent('spoon') && D.heat < 0.62 && rev.clock >= (rvm.spoonCool || 0)) {
    add('spoon', (ctx === 'side' ? 0.30 : 0.10) + 0.10 * Math.min(3, D.streak) + (D.heat < 0.35 ? 0.12 : 0));
  }
  // The toys you are wearing, in her hands (1.567.0, src/49-revtoys.js).
  if (typeof rvtCands === 'function' && !full) for (const c of rvtCands(ctx, D)) out.push(c);
  return out;
}

function rvmSay(kind, force = false) {
  return typeof revSay === 'function' ? revSay(kind, force, null, { still: revStill.dom }) : null;
}

/** Whether a move of hers is on (her other choices wait for it). */
function rvmBusy() { return !!rvm.move; }

/**
 * Start move `id`. Each is a plan (where she goes, what her hands reach for)
 * and a clock; `rvmMoveTick` runs it. Answers true or why not.
 */
function rvmStart(id, why = 'mood') {
  if (!rev.on) return 'off';
  // The aftercare while she is lying with you (1.573.0): it is this. She
  // keeps holding you; nothing else of hers goes on.
  if (id === 'care' && rvmSpoonOn()) {
    const S = rvm.move;
    S.care = true; S.kissing = false; S.handOn = true;
    if (S.ph === 'on') S.t0 = S.t;
    rvmTrace({ pick: 'spoon:care', why });
    return true;
  }
  // The aftercare while she is on top of you (1.586.0): she is getting off
  // (the safeword did that, `rvpSafe`); the care comes once she is off.
  if (id === 'care' && typeof rvpOn === 'function' && rvpOn()) {
    rvp.M.careAfter = true;
    rvmTrace({ pick: 'pin:care', why });
    return true;
  }
  if (rvm.move && id !== 'care') return 'busy';
  if (rev.arm.mode === 'spank' && id !== 'care') return 'busy';
  const v = revView();
  const ctx = v ? v.ctx : null;
  const M = { id, t: 0, ph: 'go', why, ctx, dur: 6 };
  const full = typeof rvkHandFull === 'function' && rvkHandFull();
  if (full && id !== 'care' && id !== 'hips' && id !== 'circle') return 'hand full';
  if (id === 'circle') {
    M.dur = 9 + Math.random() * 4;
    const pts = rvmCirclePath();
    if (!pts || pts.length < 3) return 'no room';
    M.pts = pts; M.i = 0;
  } else if (id === 'stroke' || id === 'care') {
    const Hd = rvmYourHead();
    if (!Hd) return 'no head';
    M.dur = id === 'care' ? 99 : 5 + Math.random() * 2;
    M.spot = rvmHairSpot(Hd, 0);
    const P = rvmPlan([{ s: 'R', T: M.spot.T, n: M.spot.n }], { prefer: Hd.up.y < 0.5 ? Hd.up : null, preferK: 0.3 });
    if (!P) return 'noplace';
    M.plan = P;
  } else if (id === 'hold') {
    const sp = rvmBackSpot();
    if (!sp) return 'no back';
    M.spot = sp; M.dur = 6 + Math.random() * 3;
    M.spank = Math.random() < 0.35 + 0.4 * rev.dom.heat + (typeof rmood !== 'undefined' ? 0.3 * rmood.stern : 0);
    const P = rvmPlan([{ s: 'L', T: sp.T, n: sp.n }]);
    if (!P) return 'noplace';
    M.plan = P;
  } else if (id === 'sitby') {
    const S = rvmSitSpot();
    if (!S) return 'no edge';
    M.sit = S; M.dur = 7 + Math.random() * 3;
  } else if (id === 'chin') {
    const Hd = rvmYourHead();
    if (!Hd) return 'no head';
    M.dur = 3.6;
    const sp = rvmChinSpot(Hd);
    const P = rvmPlan([{ s: 'R', T: sp.T, n: sp.n }], { mode: 'stand', prefer: new THREE.Vector3(Hd.fw.x, 0, Hd.fw.z).normalize(), preferK: 2.5, ring: [0.45, 0.52, 0.60] });
    if (!P) return 'noplace';
    M.plan = P; M.spot = sp;
  } else if (id === 'grip') {
    const Hd = rvmYourHead();
    if (!Hd) return 'no head';
    M.dur = 3.5 + Math.random() * 1.5;
    const sp = rvmNapeSpot(Hd);
    const P = rvmPlan([{ s: 'R', T: sp.T, n: sp.n }], { prefer: new THREE.Vector3(-Hd.fw.x, 0, -Hd.fw.z).normalize(), preferK: 1.2 });
    if (!P) return 'noplace';
    M.plan = P; M.spot = sp;
  } else if (id === 'hips') {
    M.dur = 99;
    const r = jadrija.rideFrom();
    const Fc = rvmYourFace(new THREE.Vector3());
    if (!r || !Fc) return 'nobody';
    // Over you: in front of you, a stride off, facing you.
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = r.yaw + (i % 2 ? 1 : -1) * Math.floor((i + 1) / 2) * 0.35;
      for (const d of [0.85, 1.05, 0.7]) {
        const x = Fc.x - Math.sin(a) * d, z = Fc.z - Math.cos(a) * d;
        const [qx, qz] = ground.confine ? ground.confine(x, z, rev.ch.y) : [x, z];
        if (Math.hypot(qx - x, qz - z) > 0.01 || !jadrija.kabina.room(x, z, 0.15)) continue;
        if (rvmYourFeet().some((p) => Math.hypot(p[0] - x, p[1] - z) < 0.35)) continue;
        best = { x, z }; break;
      }
      if (best) break;
    }
    if (best) { revGo(best.x, best.z); rev.ch.face = Fc.clone(); }
    M.ph = 'on';
  } else if (id === 'thrust') {
    // BESIDE the cot, never at its foot: level with your hips, a long step
    // off its edge, facing you across it.
    const S = rvmBesideSpot('pelvis', [0.62, 0.72, 0.55], 0.55);
    if (!S) return 'no room beside the cot';
    M.spot = S; M.dur = 5.4 + Math.random() * 1.4; M.gap = 9;
    revGo(S.x, S.z); rev.ch.face = S.face;
  } else if (id === 'hug') {
    if (ctx !== 'back') return 'not on your back';
    const H = rvmHugSpots();
    if (!H) return 'no shoulders';
    const P = rvmPlan([{ s: 'R', T: H.far.T, n: H.far.n }, { s: 'L', T: H.near.T, n: H.near.n }],
      { mode: 'kneel', prefer: H.out, preferK: 3, bowMax: 1.15, headR: 0.12, reach: 0.46 });
    if (!P) return 'noplace';
    M.plan = P; M.dur = 9; M.gap = 9; M.kissD = 9;
  } else if (id === 'spoon') {
    // Lying behind you (1.573.0): curled up on your side first — asked for
    // you if you asked, or her soft order if it was her idea.
    if (!v || v.swim || (v.leash && v.leash.clipped)) return 'not now';
    const curled = v.phase === 'fetalHeld' && v.onBed;
    M.ph = curled ? 'go' : 'curl'; M.t0 = 0; M.dur = 9999; M.ctx = null;
    M.asked = why === 'asked' || why === 'probe';
    M.turnDir = RVM_SPOON.turnDir || 0;
  } else if ((id === 'toy' || id === 'remote' || id === 'swap') && typeof rvtStart === 'function') {
    // The toys in her hands (1.567.0, src/49-revtoys.js); her swap for the wand (1.572.0).
    const r = rvtStart(M);
    if (r !== true) return r;
  } else return 'no such move';
  if (M.plan) rvmGoPlan(M.plan);
  rvm.move = M;
  rvmTrace({ pick: 'move:' + id, why, ctx, heat: +rev.dom.heat.toFixed(2), place: M.plan ? M.plan.mode + ' bow ' + M.plan.bow.toFixed(2) : null });
  rvmNote('move ' + id + ' (' + why + ')');
  return true;
}

/** End the move: her hands back, up on her feet unless something else wants her down. */
function rvmEnd(why = 'done') {
  const M = rvm.move;
  if (!M) return;
  // The pin (1.586.0): she lets go and gets off you first; it ends itself.
  if (M.id === 'pin' && !M.done && typeof rvpRelease === 'function') { rvpRelease(M, why); return; }
  // The spoon (1.573.0): on the cot, she gets up the way she came first and
  // it ends itself (`rvmSpoonDone`); before that, you ease out of the curl.
  if (M.id === 'spoon' && !M.done) {
    if (M.lie != null || M.ph === 'up' || M.ph === 'stand') { rvmSpoonUp(M, why); return; }
    M.ph = 'fade'; M.done = true; M.outWhy = why;
    rvm.spoonFade = M;
    if (jadrija.curlShift) jadrija.curlShift(0, RVM_SPOON.shiftRate);
    if (rev.dom.order && rev.dom.order.id === 'curl') rev.dom.order = null;
    rvm.lastSpoon = rvmSpoonReport(M);
  }
  rvm.move = null;
  if (M.id === 'sitby' || M.id === 'spoon') rvmWant('stand');
  else rvm.downFor = M.id === 'care' ? 0 : 1.2;
  // A draw left out goes back to its seat; the phone goes away (1.567.0).
  if ((M.id === 'toy' || M.id === 'remote' || M.id === 'swap') && typeof rvtEnd === 'function') rvtEnd(M, why);
  rvm.nape = 0; rvm.chin = 0;
  if (M.id === 'thrust' || M.id === 'hug') { rvm.body.pushTo = 0; rvm.body.turnTo = 0; rvm.body.bowTo = 0; rvm.body.wTo = 0; }
  if (M.gap != null && M.gap < 9) rvmTrace({ pick: 'move gap:' + M.id, why: 'min ' + M.gap.toFixed(3) + ' m' + (M.kissD != null && M.kissD < 9 ? ', faces ' + M.kissD.toFixed(3) + ' m' : '') });
  rvm.lastGap = { id: M.id, gap: M.gap != null ? +M.gap.toFixed(3) : null, kissD: M.kissD != null ? +M.kissD.toFixed(3) : null,
    kissed: !!M.kissed, pushMax: M.pushMax != null ? +M.pushMax.toFixed(3) : null, why };
  if (jadrija && jadrija.petTouch && (M.id === 'stroke' || M.id === 'care')) jadrija.petTouch(0);
  rvmTrace({ pick: 'move end:' + M.id, why });
  if (rev.dom && !rev.care) rev.dom.next = Math.max(rev.dom.next, rev.clock + 1.5 + Math.random() * 1.5);
}

/** A spot on your hair, `u` 0 at your crown to 1 at the back of your head. */
function rvmHairSpot(Hd, u) {
  const toHer = new THREE.Vector3(rev.ch.x - Hd.C.x, 0, rev.ch.z - Hd.C.z).normalize();
  const a = Hd.up.clone().multiplyScalar(0.92).addScaledVector(toHer, 0.25).normalize();
  const b = Hd.up.clone().multiplyScalar(0.35).addScaledVector(Hd.fw, -0.85).addScaledVector(toHer, 0.2).normalize();
  const n = a.clone().lerp(b, u).normalize();
  return { T: Hd.C.clone().addScaledVector(n, 0.108), n };
}
/** Under your chin. */
function rvmChinSpot(Hd) {
  const n = Hd.up.clone().negate().addScaledVector(Hd.fw, 0.35).normalize();
  return { T: Hd.H.clone().addScaledVector(Hd.fw, 0.085).addScaledVector(Hd.up, -0.035), n };
}
/** The back of your head, low, where the hair gathers at the nape. */
function rvmNapeSpot(Hd) {
  const n = Hd.fw.clone().negate().addScaledVector(Hd.up, 0.25).normalize();
  return { T: Hd.C.clone().addScaledVector(Hd.up, -0.035).addScaledVector(n, 0.10), n };
}
/** The small of your back, on the cot: its skin from straight over it. */
function rvmBackSpot() {
  const f = jadrija && jadrija.figure;
  const p = revBone('spine02', new THREE.Vector3());
  if (!f || !p) return null;
  const S = rvmCotSkinUnder(p);
  if (S) return S;
  return { T: p.add(_mA.set(0, 0.10, 0)), n: new THREE.Vector3(0, 1, 0) };
}

/** Round the cot: points 1 m off its middle, in the room, in order. */
function rvmCotGeom() {
  const K = jadrija.kabina, kit = K && K.kit ? K.kit() : null;
  if (!kit || !kit.cot || !jadrija.toWorld) return null;
  const c = jadrija.toWorld(kit.cot[0], kit.cot[1]);
  const c2 = jadrija.toWorld(kit.cot[0], kit.cot[1] + 1);
  const e = kit.cotEdge ? jadrija.toWorld(kit.cotEdge[0], kit.cotEdge[1]) : null;
  const ax = new THREE.Vector3(c2[0] - c[0], 0, c2[2] - c[2]).normalize();
  const mid = new THREE.Vector3(c[0], kit.cot[2], c[2]);
  const edge = e ? new THREE.Vector3(e[0], kit.cot[2], e[2]) : null;
  return { mid, ax, top: kit.cot[2], edge, out: edge ? new THREE.Vector3(edge.x - mid.x, 0, edge.z - mid.z).normalize() : null };
}
function rvmCirclePath() {
  const G = rvmCotGeom();
  if (!G) return null;
  const pts = [];
  const across = new THREE.Vector3(-G.ax.z, 0, G.ax.x);
  const start = Math.atan2((rev.ch.x - G.mid.x) * across.x + (rev.ch.z - G.mid.z) * across.z,
    (rev.ch.x - G.mid.x) * G.ax.x + (rev.ch.z - G.mid.z) * G.ax.z);
  const dir = Math.random() < 0.5 ? 1 : -1;
  for (let i = 1; i <= 14; i++) {
    const a = start + dir * i * Math.PI * 2 / 12;
    // An ellipse round a 1.9 by 0.7 m bed.
    const x = G.mid.x + G.ax.x * Math.cos(a) * 1.45 + across.x * Math.sin(a) * 0.95;
    const z = G.mid.z + G.ax.z * Math.cos(a) * 1.45 + across.z * Math.sin(a) * 0.95;
    const [qx, qz] = ground.confine ? ground.confine(x, z, rev.ch.y) : [x, z];
    if (!jadrija.kabina.room(qx, qz, 0.2)) continue;
    pts.push([qx, qz]);
  }
  return pts;
}

/**
 * WHERE SHE SITS: on the cot's inner edge beside your thighs, facing out
 * into the room — her pelvis 0.10 m in from the edge (her own backside is
 * the rest), level with your knees on the side nearer your feet, which is
 * where there is edge to sit on.
 */
function rvmSitSpot() {
  const G = rvmCotGeom();
  const Pv = rvmYourPelvis();
  if (!G || !G.edge || !Pv) return null;
  const hf = jadrija.headFrame ? jadrija.headFrame() : null;
  // Toward your feet along the cot.
  const toHead = hf ? new THREE.Vector3(hf.ax, 0, hf.az) : G.ax.clone();
  const along = (Pv.P.x - G.mid.x) * G.ax.x + (Pv.P.z - G.mid.z) * G.ax.z;
  const sgn = toHead.dot(G.ax) >= 0 ? -1 : 1;
  const sAt = along + sgn * 0.34;
  const edgeAt = new THREE.Vector3(G.mid.x, G.top, G.mid.z).addScaledVector(G.ax, sAt);
  const inset = (G.edge.x - G.mid.x) * G.out.x + (G.edge.z - G.mid.z) * G.out.z;
  const seat = edgeAt.clone().addScaledVector(G.out, inset - 0.10);
  const stand = edgeAt.clone().addScaledVector(G.out, inset + 0.32);
  const [qx, qz] = ground.confine ? ground.confine(stand.x, stand.z, rev.ch.y) : [stand.x, stand.z];
  if (!jadrija.kabina.room(qx, qz, 0.12)) return null;
  // Facing out, the way a person sits on a bed's edge.
  const yaw = Math.atan2(-G.out.x, -G.out.z);
  return { seat, stand: new THREE.Vector3(qx, rev.ch.y, qz), yaw, top: G.top, out: G.out.clone(), ax: G.ax.clone(), toHead: sgn };
}

/** Your body's bones, world: trunk, head and every limb (a raised leg too). */
const RVM_ALL = ['pelvis', 'spine02', 'spine03', 'chest', 'neck', 'head', 'armUL', 'armUR', 'armLL', 'armLR', 'handL', 'handR',
  'legUL', 'legUR', 'legLL', 'legLR', 'footL', 'footR', 'toeL', 'toeR'];
function rvmYourAll() {
  const out = [];
  for (const n of RVM_ALL) { const p = revBone(n, new THREE.Vector3()); if (p) out.push(p); }
  return out;
}
/** Her bones that could touch you: trunk, head, hands, knees. */
const RVM_HER = ['pelvis', 'spine02', 'chest', 'head', 'handL', 'handR', 'legLL', 'legLR', 'legUL', 'legUR'];
function rvmGapNow(skip = null) {
  if (!you || !you.fig) return 9;
  const mine = rvmYourAll();
  let g = 9;
  you.mesh.updateMatrixWorld();
  for (const n of RVM_HER) {
    if (skip && skip[n]) continue;
    const i = you.fig.boneIndex(n);
    if (i < 0) continue;
    const q = you.fig.boneAt(i, _mT).applyMatrix4(you.mesh.matrixWorld);
    for (const p of mine) g = Math.min(g, p.distanceTo(q));
  }
  return g;
}

/**
 * A place BESIDE the cot (1.569.0): level with your bone `at` along it, `offs`
 * m out from its edge into the room, facing you across it — and kept only if
 * every bone of yours, a raised leg included, is at least `clear` m off it on
 * the level. Never the cot's foot: that is between your legs.
 */
function rvmBesideSpot(at, offs, clear) {
  const G = rvmCotGeom();
  const B = revBone(at, new THREE.Vector3());
  if (!G || !G.edge || !B) return null;
  const inset = (G.edge.x - G.mid.x) * G.out.x + (G.edge.z - G.mid.z) * G.out.z;
  const along0 = (B.x - G.mid.x) * G.ax.x + (B.z - G.mid.z) * G.ax.z;
  const mine = rvmYourAll();
  for (const off of offs) {
    for (const da of [0, 0.12, -0.12, 0.24, -0.24]) {
      const a = along0 + da;
      const x = G.mid.x + G.ax.x * a + G.out.x * (inset + off), z = G.mid.z + G.ax.z * a + G.out.z * (inset + off);
      const [qx, qz] = ground.confine ? ground.confine(x, z, rev.ch.y) : [x, z];
      if (Math.hypot(qx - x, qz - z) > 0.02 || !jadrija.kabina.room(x, z, 0.15)) continue;
      if (mine.some((p) => Math.hypot(p.x - x, p.z - z) < clear)) continue;
      const face = new THREE.Vector3(x - G.out.x * 3, rev.ch.y, z - G.out.z * 3);
      return { x, z, face, along: a, off, out: G.out.clone() };
    }
  }
  return null;
}

/**
 * YOUR SHOULDERS, for her hug (1.569.0): you on your back on the cot, her
 * at its side. The far one she wraps a hand over the top of, the near one
 * she holds from above. `out` is the cot's room side, where she comes from.
 */
function rvmHugSpots() {
  const G = rvmCotGeom();
  const a = revBone('armUL', new THREE.Vector3()), b = revBone('armUR', new THREE.Vector3());
  if (!G || !G.out || !a || !b) return null;
  const da = (a.x - G.mid.x) * G.out.x + (a.z - G.mid.z) * G.out.z;
  const db = (b.x - G.mid.x) * G.out.x + (b.z - G.mid.z) * G.out.z;
  const near = da > db ? a : b, far = da > db ? b : a;
  const away = G.out.clone().negate();
  const nF = away.clone().multiplyScalar(0.55).add(_mUP).normalize();
  return {
    out: G.out.clone(), nearB: near, farB: far,
    far: { T: far.clone().addScaledVector(away, 0.035).addScaledVector(_mUP, 0.045), n: nF },
    near: { T: near.clone().addScaledVector(_mUP, 0.065).addScaledVector(G.out, 0.01), n: _mUP.clone() },
  };
}

/** The move, a frame (after her body is placed, before her arms are solved). */
function rvmMoveTick(dt) {
  const M = rvm.move;
  if (!M) return;
  M.t += dt;
  const v = revView();
  const ctx = v ? v.ctx : null;
  // Lying behind you (1.573.0) keeps its own count of where you are.
  if (M.id === 'spoon') {
    if (M.ph === 'curl' && !M.begun) {
      M.begun = true;
      if (M.asked) { rvmSay('curlup', true); if (typeof revAsk === 'function') revAsk('fetal'); }
      else if (typeof revOrder === 'function') revOrder('curl', 'spoon');
    }
    rvmSpoonTick(M, dt);
    return;
  }
  // Pinning you on the cot (1.586.0, src/49-revpin.js) keeps its own count too.
  if (M.id === 'pin') { if (typeof rvpTick === 'function') rvpTick(M, dt); return; }
  // You moved out of it (a move is about where you are), except the care.
  if (M.id !== 'care' && M.id !== 'hips' && M.ctx && ctx !== M.ctx) { rvmEnd('you moved: ' + (v ? v.phase : '?')); return; }
  const { f, r } = rvmAxes(rev.ch.yaw);
  // Her hand on a toy you are wearing, or her remote (1.567.0).
  if ((M.id === 'toy' || M.id === 'remote' || M.id === 'swap') && typeof rvtMoveTick === 'function') { rvtMoveTick(M, dt); return; }
  if (M.id === 'circle') {
    if (M.ph === 'go') { rvmSay('circle'); M.ph = 'walk'; }
    if (revAt() || (rev.ch.stuck > 0.8)) {
      if (M.i >= M.pts.length || M.t > M.dur) { rvmEnd('done'); return; }
      const p = M.pts[M.i++];
      revGo(p[0], p[1]);
    }
    rvm.slow = 0.45;
    return;
  }
  if (M.id === 'stroke' || M.id === 'care') {
    const Hd = rvmYourHead();
    if (!Hd) { rvmEnd('no head'); return; }
    if (M.ph === 'go') {
      if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
      if (rvmSettled() || M.t > 7) { M.ph = 'on'; M.t0 = M.t; rvm.body.bowTo = M.plan.bow; if (M.id === 'stroke') rvmSay('stroke'); }
      return;
    }
    const tt = M.t - M.t0;
    // Slowly from your crown to the back of your head and up again.
    const uu = 0.5 - 0.5 * Math.cos(tt * Math.PI * 2 / 2.6);
    const sp = rvmHairSpot(Hd, uu * 0.85);
    const sh = rvmShoulder('R', _mS);
    if (sh) { const need = sh.distanceTo(sp.T) - RVM.reach; rvm.body.bowTo = Math.max(0, Math.min(RVM.bowMax, rvm.body.bowTo + need * dt * 2)); }
    const d = Hd.fw.clone().negate();
    rvmAsk('R', { C: sp.T.addScaledVector(sp.n, 0.004), n: sp.n, d, pole: r.clone().add(_mA.set(0, -0.3, 0)).addScaledVector(f, -0.2),
      cock: 0.15, shape: 'soft', rate: 5 });
    if (jadrija.petTouch) jadrija.petTouch(Math.min(1, tt / 0.8));
    M.handOn = rvm.k.R > 0.9;
    if (tt > M.dur) rvmEnd('done');
    return;
  }
  if (M.id === 'hold') {
    if (M.ph === 'go') {
      if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
      if (rvmSettled() || M.t > 7) { M.ph = 'on'; M.t0 = M.t; rvm.body.bowTo = M.plan.bow; rvmSay('hold'); }
      return;
    }
    const tt = M.t - M.t0;
    const sp = rvmBackSpot() || M.spot;
    M.spot = sp;
    const sh = rvmShoulder('L', _mS);
    if (sh) { const need = sh.distanceTo(sp.T) - RVM.reach; rvm.body.bowTo = Math.max(0, Math.min(RVM.bowMax, rvm.body.bowTo + need * dt * 2)); }
    // Fingers across your back, toward your far side.
    const Pv = rvmYourPelvis();
    const d = Pv ? Pv.rt.clone().multiplyScalar(((rev.ch.x - Pv.P.x) * Pv.rt.x + (rev.ch.z - Pv.P.z) * Pv.rt.z) > 0 ? -1 : 1) : f.clone();
    rvmAsk('L', { C: sp.T.clone().addScaledVector(sp.n, -0.006 * Math.min(1, tt / 0.5)), n: sp.n, d,
      pole: r.clone().negate().add(_mA.set(0, 0.25, 0)).addScaledVector(f, -0.2), cock: 0, shape: 'flat', rate: 6 });
    if (rvm.k.L > 0.85 && jadrija.cotPress) jadrija.cotPress('spine02', sp.T, RVM.holdN * Math.min(1, tt / 0.6), dt, RVM.calm);
    // And now and then her other hand, while this one holds you.
    if (M.spank && !M.spanked && tt > 1.6 && rev.arm.mode !== 'spank') {
      M.spanked = true;
      const n = 2 + Math.floor(Math.random() * (1 + rev.dom.heat * 2));
      const rr = rvmSpankStart(n, 'held down', { hold: true });
      if (rr !== true) rvmTrace({ pick: 'hold+spank:' + rr });
    }
    if (tt > M.dur && rev.arm.mode !== 'spank') rvmEnd('done');
    return;
  }
  if (M.id === 'sitby') { rvmSitTick(M, dt); return; }
  if (M.id === 'thrust') { rvmThrustTick(M, dt); return; }
  if (M.id === 'hug') { rvmHugTick(M, dt); return; }
  if (M.id === 'chin') {
    const Hd = rvmYourHead();
    if (!Hd) { rvmEnd('no head'); return; }
    if (M.ph === 'go') {
      if (rvmSettled() || M.t > 6) { M.ph = 'on'; M.t0 = M.t; rvmSay('chin', true); rvm.body.bowTo = M.plan.bow; }
      // Your eyes come up to hers with your chin (49-reverse.js's own ease).
      if (M.ph === 'on') rev.lookTo = 1.1;
      return;
    }
    const tt = M.t - M.t0;
    const sp = rvmChinSpot(Hd);
    const lift = Math.min(1, tt / 0.7);
    rvmAsk('R', { C: sp.T.addScaledVector(sp.n, 0.005), n: sp.n, d: Hd.fw.clone(), pole: r.clone().add(_mA.set(0, -0.6, 0)),
      cock: 0.2, shape: 'soft', rate: 6 });
    rvm.chin = rvm.k.R > 0.8 ? lift * (tt < M.dur - 0.5 ? 1 : Math.max(0, (M.dur - tt) / 0.5)) : 0;
    // Your face up to hers: her gaze (Baye's own, at "you", who is Chloe)
    // and your camera with it.
    if (rvm.chin > 0.3 && jadrija.autoMove && !M.glanced) { M.glanced = true; jadrija.autoMove({ glance: 3 }); }
    if (tt > M.dur) rvmEnd('done');
    return;
  }
  if (M.id === 'grip') {
    const Hd = rvmYourHead();
    if (!Hd) { rvmEnd('no head'); return; }
    if (M.ph === 'go') {
      if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
      if (rvmSettled() || M.t > 7) { M.ph = 'on'; M.t0 = M.t; rvm.body.bowTo = M.plan.bow; }
      return;
    }
    const tt = M.t - M.t0;
    const sp = rvmNapeSpot(Hd);
    rvmAsk('R', { C: sp.T.addScaledVector(sp.n, -0.004), n: sp.n, d: Hd.up.clone().negate(), pole: r.clone().add(_mA.set(0, -0.4, 0)),
      cock: 0.1, shape: 'grip', rate: 7 });
    const g = rvm.k.R > 0.85 ? Math.min(1, (tt - 0.3) / 0.6) : 0;
    rvm.nape = Math.max(0, g) * (tt < M.dur - 0.6 ? 1 : Math.max(0, (M.dur - tt) / 0.6));
    if (g > 0.5 && !M.said) { M.said = true; rvmSay('grip'); }
    if (tt > M.dur) rvmEnd('done');
    return;
  }
  if (M.id === 'hips') {
    // Her hands on her hips while she waits, her look on you.
    const sides = { R: 1, L: -1 };
    if (!rev.ch.goal && !(typeof rvkHandFull === 'function' && rvkHandFull())) {
      for (const s of ['R', 'L']) {
        const sg = sides[s];
        const hip = new THREE.Vector3(0.035, 1.0, 0.165 * sg).applyMatrix4(you.mesh.matrixWorld);
        const n = new THREE.Vector3(0.15, 0.1, sg).applyQuaternion(you.mesh.quaternion).normalize();
        const d = new THREE.Vector3(0.35, -1, 0.05 * sg).applyQuaternion(you.mesh.quaternion);
        const pole = new THREE.Vector3(-0.55, 0.15, sg).applyQuaternion(you.mesh.quaternion);
        rvmAsk(s, { C: hip.addScaledVector(n, 0.012), n, d, pole, cock: -0.1, shape: 'hip', rate: 5 });
      }
      if (!M.said && M.t > 1.6) { M.said = true; if (Math.random() < 0.5) rvmSay('wait'); }
    }
    if (!rev.dom.order) rvmEnd('order over');
  }
}

/**
 * HER HIP TEASE (1.569.0). Misha: *"pelvic humps next to me"*. Beside the
 * cot, facing you across it, hands on her hips: a few slow thrusts of her
 * hips into the air, each a little roll. Her hips go FORWARD while her boots
 * stay where they stand (`crouchSolve`'s `push`, the legs re-reached for it)
 * and her knees soften (`w`); her shoulders go back as they come (a negative
 * bow up her spine), and her trunk turns a little with each, which is the
 * roll. Nowhere near you: she is placed a long step off the edge and the
 * gap from any bone of hers to any of yours is measured every frame.
 */
const RVM_THRUST = { P: 1.15, push: 0.085, w: 0.16, back: 0.13, roll: 0.10 };
function rvmThrustTick(M, dt) {
  const B = rvm.body;
  if (M.ph === 'go') {
    let dy = 0;
    if (revAt() && rev.ch.face) { const F = rev.ch.face; dy = Math.atan2(-(F.x - rev.ch.x), -(F.z - rev.ch.z)) - rev.ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); }
    if ((revAt() && Math.abs(dy) < 0.15) || M.t > 7) { M.ph = 'on'; M.t0 = M.t; rvmSay('thrust', true); }
    return;
  }
  const tt = M.t - M.t0;
  // In over half a second, out over the last.
  const env = Math.min(1, tt / 0.6) * Math.max(0, Math.min(1, (M.dur - tt) / 0.6));
  const ph = tt * Math.PI * 2 / RVM_THRUST.P;
  // Slow out, a beat held, back: a raised cosine squared.
  const c = 0.5 - 0.5 * Math.cos(ph), k = c * c * env;
  B.pushTo = RVM_THRUST.push * k;
  B.wTo = RVM_THRUST.w * env;
  B.bowTo = -RVM_THRUST.back * k;
  B.turnTo = RVM_THRUST.roll * Math.sin(ph) * env;
  // Hands on her hips (the `hips` move's own ask).
  for (const s of ['R', 'L']) {
    const sg = s === 'R' ? 1 : -1;
    const hip = new THREE.Vector3(0.035, 1.0, 0.165 * sg).applyMatrix4(you.mesh.matrixWorld);
    const n = new THREE.Vector3(0.15, 0.1, sg).applyQuaternion(you.mesh.quaternion).normalize();
    const d = new THREE.Vector3(0.35, -1, 0.05 * sg).applyQuaternion(you.mesh.quaternion);
    const pole = new THREE.Vector3(-0.55, 0.15, sg).applyQuaternion(you.mesh.quaternion);
    rvmAsk(s, { C: hip.addScaledVector(n, 0.012), n, d, pole, cock: -0.1, shape: 'hip', rate: 5 });
  }
  M.gap = Math.min(M.gap, rvmGapNow());
  M.pushMax = Math.max(M.pushMax || 0, B.push || 0);
  if (tt > M.dur) { B.pushTo = 0; B.bowTo = 0; B.turnTo = 0; B.wTo = 0; rvmEnd('done'); }
}

/**
 * HER HUG AND KISS, you on your back on the cot (1.569.0) — your legs down
 * or raised (1.566.0's ladder) alike, because she comes from the cot's SIDE
 * at your shoulders and never near its foot. Kneeling at the edge, she leans
 * over you: her right hand wraps over your far shoulder, her left holds the
 * near one (both palms solved on, as every hand of hers is), her eyes on
 * yours; then she bows the rest of the way until her face is at yours, holds
 * the kiss, and comes back up into the hug before she lets go.
 */
const RVM_HUG = { kissAt: 1.8, kissD: 0.13, kissHold: 2.6, bowMax: 1.25 };
function rvmHugTick(M, dt) {
  const B = rvm.body;
  const H = rvmHugSpots();
  if (!H) { rvmEnd('no shoulders'); return; }
  if (M.ph === 'go') {
    if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
    if (rvmSettled() || M.t > 8) { M.ph = 'on'; M.t0 = M.t; B.bowTo = M.plan.bow; rvmSay('hug', true); }
    return;
  }
  const tt = M.t - M.t0;
  const { r } = rvmAxes(rev.ch.yaw);
  // Both hands on: her reach closed by her bow, as the stroke does.
  const shR = rvmShoulder('R', _mS);
  const Fc = rvmYourFace(new THREE.Vector3());
  const hi = you.fig.boneIndex('head');
  const myHead = hi >= 0 ? you.fig.boneAt(hi, _mK).applyMatrix4(you.mesh.matrixWorld) : null;
  // Her face: a little in front of her head bone.
  const myFace = myHead ? myHead.clone().add(_mL.set(0.10, 0.07, 0).applyQuaternion(you.fig.boneTurn(hi, _mQ)).applyQuaternion(you.mesh.quaternion)) : null;
  const kd = Fc && myFace ? Fc.distanceTo(myFace) : 9;
  M.kissD = Math.min(M.kissD, kd);
  const kissing = tt > RVM_HUG.kissAt && tt < RVM_HUG.kissAt + RVM_HUG.kissHold + 1.0;
  if (!kissing && shR) {
    const need = shR.distanceTo(H.far.T) - RVM.reach;
    B.bowTo = Math.max(0, Math.min(RVM_HUG.bowMax, B.bowTo + need * dt * 2));
  } else if (kissing && Fc && myFace) {
    // The rest of the way down, by her face against yours.
    const need = kd - RVM_HUG.kissD;
    B.bowTo = Math.max(0, Math.min(RVM_HUG.bowMax, B.bowTo + Math.max(-0.4, Math.min(0.4, need)) * dt * 2.5));
    if (!M.kissed && kd < RVM_HUG.kissD + 0.05) {
      M.kissed = true; M.kissAt = +tt.toFixed(2);
      if (audio && audio.kiss) audio.kiss();
      rvmSay('kiss', true);
    }
  }
  rvmAsk('R', { C: H.far.T.clone().addScaledVector(H.far.n, 0.004), n: H.far.n, d: H.out.clone().negate().addScaledVector(_mUP, -0.6).normalize(),
    pole: r.clone().add(_mA.set(0, 0.35, 0)), cock: 0.1, shape: 'soft', rate: 4 });
  rvmAsk('L', { C: H.near.T.clone().addScaledVector(H.near.n, 0.004), n: H.near.n, d: H.out.clone().negate(),
    pole: r.clone().negate().add(_mA.set(0, 0.35, 0)), cock: 0.1, shape: 'soft', rate: 4 });
  // Her trunk and head never into you: her hands and the kiss are the only touch.
  M.gap = Math.min(M.gap, rvmGapNow({ handL: 1, handR: 1, head: 1 }));
  if (tt > M.dur) rvmEnd('done');
}

/** A move of hers asked for by you (a key or your words), 1.569.0. */
function rvmAskMove(id) {
  if (!rev.on) return { ok: false, label: 'roles are not reversed' };
  if (rev.care) return { ok: false, label: 'aftercare' };
  if (id === 'kiss') id = 'hug';
  if (rvm.move && rvm.move.id === id) return { ok: true, label: 'Chloe: already' };
  // On the cot with you (1.573.0): she gets up first, and then does it.
  if (rvmSpoonOn()) {
    const S = rvm.move;
    S.queueMove = id;
    rvmSpoonUp(S, 'asked: ' + id);
    return { ok: true, label: 'Chloe: getting up first' };
  }
  if (rvm.move && rvm.move.id !== 'care') rvmEnd('asked: ' + id);
  if (rev.arm.mode === 'spank' && typeof revArmStop === 'function') revArmStop();
  const r = rvmStart(id, 'asked');
  if (r === true) return { ok: true, label: id === 'hug' ? 'Chloe: a hug and a kiss' : id === 'spoon' ? 'Chloe: lying down behind you' : 'Chloe: showing off' };
  if (id === 'hug' && r === 'not on your back') return { ok: false, label: 'hug: on your back on the cot (7)' };
  return { ok: false, label: id + ': ' + r };
}

/**
 * SITTING ON THE EDGE: up to it, turned out to the room, down on to it
 * (`sitHeld` faded in while her root goes from the floor to the mattress,
 * so her pelvis travels a straight line), her legs solved so her feet stay
 * on the floor, then turned to you and leaning over, a hand on your back.
 */
function rvmSitTick(M, dt) {
  const S = M.sit;
  const B = rvm.body;
  if (M.ph === 'go') {
    revGo(S.stand.x, S.stand.z);
    rev.ch.face = new THREE.Vector3(S.stand.x + S.out.x * 3, rev.ch.y, S.stand.z + S.out.z * 3);
    M.ph = 'walk';
    return;
  }
  if (M.ph === 'walk') {
    let dy = S.yaw - rev.ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if ((revAt() && Math.abs(dy) < 0.1) || M.t > 7) {
      M.ph = 'down'; M.t0 = M.t; rvmWant('sit');
      B.sit = { from: new THREE.Vector3(rev.ch.x, rev.ch.y, rev.ch.z), to: S.seat.clone(), k: 0 };
      rvmSay('sitby');
    }
    return;
  }
  const tt = M.t - M.t0;
  if (B.sit) B.sit.k = Math.min(1, tt / 0.8);
  // Turned to you and over you.
  const lean = Math.min(1, Math.max(0, (tt - 0.9) / 1.2)) * (tt < M.dur - 0.8 ? 1 : Math.max(0, (M.dur - tt) / 0.8));
  B.turnTo = 0.55 * S.toHead * -1 * lean;
  B.bowTo = 0.32 * lean;
  if (lean > 0.6) {
    // Her hand (the one toward you) on the small of your back, or your hair.
    const v = revView();
    // The nearest of the small of your back, your bottom and your hair.
    const sh = rvmShoulder('R', _mS), shL = rvmShoulder('L', _mE);
    const Hd = rvmYourHead();
    const P0 = revBone('pelvis', new THREE.Vector3());
    const cands = [v && v.ctx === 'front' ? rvmBackSpot() : null,
      v && v.ctx === 'front' && P0 ? rvmCotSkinUnder(P0.add(_mA.set(0, 0.05, 0))) : null,
      Hd ? rvmHairSpot(Hd, 0.3) : null].filter((c) => c && c.T);
    const dist = (c) => Math.min(sh ? sh.distanceTo(c.T) : 9, shL ? shL.distanceTo(c.T) : 9);
    const sp = cands.sort((a, b) => dist(a) - dist(b))[0] || null;
    if (sp) {
      const s = sh && shL && shL.distanceTo(sp.T) < sh.distanceTo(sp.T) ? 'L' : 'R';
      const shS = s === 'R' ? sh : shL;
      if (shS && shS.distanceTo(sp.T) < RVM.reach + 0.12) {
        const { f, r } = rvmAxes(rev.ch.yaw);
        rvmAsk(s, { C: sp.T.clone().addScaledVector(sp.n, 0.004), n: sp.n, d: f.clone().negate(),
          pole: (s === 'R' ? r.clone() : r.clone().negate()).add(_mA.set(0, -0.3, 0)), cock: 0.1, shape: 'soft', rate: 4 });
      }
      M.reach = shS ? +shS.distanceTo(sp.T).toFixed(2) : null;
    }
  }
  if (tt > M.dur) { B.turnTo = 0; B.bowTo = 0; rvmEnd('done'); }
}

// ── SPOONING (1.573.0) ───────────────────────────────────────────────────────
//
// Misha, 2 Oct 2026, 06:40: *"if at certain intimate moments of show of
// affection that Chloe could slide in lay on the cot next to baye (baye being
// in fetal pose) and spoon ... ultimately we are in love"*. The safeword is
// over it like everything else, and turns it into the aftercare (she keeps
// holding you).
//
// THE COT IS 0.66 M ACROSS, and Baye's own `fetal` — knees to her chest — is
// 0.58 of it, with her back at the room-side edge: there is nowhere behind her
// for anybody. So the curl she is held in while Chloe is there is LOOSER and
// she is moved over: a SPOON CURL, both of them in it, solved — not typed —
// on each body's own frame:
//   - the thigh at `hip` off her own long axis (the pelvis's, so a spine curled
//     over it does not count) and the shin `knee` back off the thigh, in her
//     own sagittal plane; then each joint put at a HEIGHT over the mattress
//     (the under knee and ankle resting on the foam, the upper ones on them),
//     segment lengths kept, and `hingeArm` laying the bones on those points;
//   - her mark slid across the cot (`jadrija.curlShift`) until the front of her
//     — her face — is at the wall-side edge of the mattress, MEASURED off her
//     skinned mesh, not off a bone;
//   - her upper hand off her knee and on to the top of her hip, palm solved on
//     to the skin (`rvmSolve`, the 2c palm solve, for her arm this time, on
//     the hinge her clip bends that elbow on).
// Chloe lies down behind her on the same curl — the same rig, the same solve,
// her own knee a little straighter — so the two shapes nest, and she is put
// along Baye's back by ONE translation in Baye's frame (`back` behind her,
// `feet` toward her feet), which is then closed by feedback on the measured
// skin-to-skin gap until the nearest point of her body (trunk, legs, under
// arm) is `gap` m off Baye's skin. Her upper arm goes over Baye's waist, its
// elbow the way a search finds clearest of her (`rvsArmPole`), and her palm is
// solved on to the back of Baye's hand on her hip (the hand-hold); her under
// arm goes up the pillow with the palm under her own cheek; her face is turned
// into Baye's nape (`rvmLook`, aimed past it), and now and then she reaches
// the last centimetre or two and kisses the skin nearest her lips.
//
// THEY BREATHE: both chests rise (an aim on the chest about each one's own
// across-axis). Baye's rate is a sleeper's; Chloe arrives a little out of
// breath and her rate eases on to Baye's (tau `tau` s) while her phase is
// drawn on to Baye's (a coupling `lock` rad/s): in sync in about twenty
// seconds. Traced (`__fr.reverse.moves.spoon().breath`).
//
// THE WAY IN is the way a person gets in behind somebody: to the room-side
// edge level with her waist, sat down on it (`sitby`'s sit), turned on it to
// face the cot's foot with her knees drawn up and her feet off the floor and on
// to the mattress (`rvsKneesUp`), her hands on the edge behind her taking her
// weight, and then down on to her side behind Baye — the clip crossfaded from
// `sitHeld` to `fetalHeld` while her root goes on to her place a little wide of
// it and slides in. Baye makes room: her knees straighter and her mark a
// little further over while Chloe gets in, and then she shuffles back into
// her and they draw their knees up together (`tuck`). MEASURED, skin to skin,
// ten times a second all the way down and all the way up (`rvsMoveGap`). THE
// WAY OUT is the same run backwards: back off her, up on to the edge, sat,
// stood.
// -----------------------------------------------------------------------------

const RVM_SPOON = {
  // The spoon curl (rad): the thigh off her long axis, the knee's bend.
  hip: 0.66, knee: 1.35,
  // The knees straighter (rad) while she gets in — your feet under you, not
  // tucked back across the edge she lies down on (MEASURED: her legs came up
  // on to your shins) — and both drawn up into the curl together once she is
  // down, over `tuckT` s.
  kneeIn: 0.55, tuckT: 1.6,
  // Chloe's own knee: a little straighter, so her feet stay on the cot behind her.
  kneeC: 1.15,
  // Joint heights over the mattress top (m): the under knee and ankle on the
  // foam (their half-thickness, a little sunk), the upper ones resting on them.
  kneeY: [0.048, 0.150], ankY: [0.040, 0.112],
  // Her front this far inside the wall-side edge of the mattress (m), and the
  // first guess at the shift it takes (refined off her mesh).
  edge: 0.0, shift0: 0.22, shiftRate: 1.1,
  // Chloe off Baye: behind her (m, against her front) and toward her feet;
  // the gap she settles to (m, skin to skin); the bounds of the feedback.
  back0: 0.27, feet: 0.06, gap: 0.016, backMin: 0.12, backMax: 0.42,
  // She lies down `wide` m further back than that, clear of your legs, and
  // slides in close by the gap (at most `slide` m a measurement); and on the
  // way out she slides back the same before she sits up. MEASURED: swung
  // straight on to her place, her shins went 8 cm through yours on the way.
  wide: 0.22, slide: 0.02,
  // Where she sits on the edge first: level with this bone of yours, and this far
  // on along the cot toward your head (m); and which way she turns lying down
  // (+1, -1, or 0 the short way).
  seatBone: 'spine02', seatAlong: 0, turnDir: 0,
  // Of the swing: the share that is her legs coming up on to the cot (sat,
  // turned to face its foot, `longIn` m further on to it) before she lies down.
  legsUp: 0.42, longIn: 0.07,
  // Her seat this far in from the cot's inner edge (m; out is +), and how much
  // further toward the wall you are while she gets in (m).
  seatIn: 0.06, bayeExtra: 0.12,
  // And how far her root lifts in the middle of lying down (m).
  arc: 0.05,
  // On the way out, how long she takes sliding back off you before she sits up (s).
  upSlide: 0.8,
  // Her hands stay on the mattress at its edge, taking her weight, until she is
  // this far down; then one goes to yours and the other under her cheek.
  handsAt: 0.8,
  // Seconds: Baye loosening, the sit, the swing down, the settle, the way up.
  loosen: 1.8, sitT: 0.8, swingT: 2.6, settleT: 2.2, upT: 2.3,
  // Seconds: held at most, unasked; held in the aftercare; waiting on you to curl up.
  // Her own idea (1.575.0): 45-70 s. Two of four long playtests had her pick
  // it and hold the full 120, two minutes of nothing else in a session.
  hold: 120, holdOwn: [45, 70], care: 9, curlWait: 26,
  // Seconds: her hand to her beanie and away, taking it off or putting it on.
  hatT: 1.1,
  // Breath (Hz, s, rad/s, rad): hers, Chloe's on arriving, the ease, the pull.
  breath: { her: 0.20, mine: 0.30, tau: 7.0, lock: 0.85, chest: 0.034, spine: 0.012 },
  // Between kisses on her shoulder (s), and how long one is (s).
  kiss: [7, 12], kissT: 1.9,
  // With `handAt` 'belly': where the two hands meet, this far down from her
  // chest bone toward her waist (m), and her elbow's pole there [up her long
  // axis, her front, her right].
  handDown: 0.20,
  bPole: [-0.6, 0.6, 0.1],
  // Where your hand is when she holds it (`rvsHandSpot`): 'hip' or 'belly';
  // on the hip, this far up your long axis and forward of the hip joint (m),
  // and your elbow's pole lying along your side.
  handAt: 'hip', hipUp: 0.04, hipFw: 0.05, bPoleHip: [0.15, -0.75, 0.55],
  // And Chloe's elbow over your waist: [your right (up, lying), your front, up your long axis].
  cPole: [1.0, -0.45, -0.35],
  // Her palm this far off the back of your hand (m): resting on it.
  handOff: 0.004,
  // Her hand's shape on yours (`RVM.hands`): curled a little over it, no more.
  handShape: 'cup',
  // Her face into your nape: this far off it (m) at most, never nearer your
  // skin than `headMin`, turned no more than `nuzzleMax` rad up her spine.
  nuzzle: 0.05, headMin: 0.018, nuzzleMax: 0.16,
  // Her under palm this far below the middle of her head (m): under her cheek.
  cheek: 0.105,
};

/** Baye as a figure for the shared solves (`{ fig, mesh }`). */
function rvsBaye() {
  const f = jadrija && jadrija.figure;
  return f ? { fig: f, mesh: f.mesh } : null;
}

/** A figure's own frame (figure space), off her pelvis: up her long axis, her front, her right. */
function rvsFrame(f) {
  const q = f.boneTurn(f.boneIndex('pelvis'), new THREE.Quaternion());
  return { up: new THREE.Vector3(0, 1, 0).applyQuaternion(q), fw: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
    rt: new THREE.Vector3(0, 0, 1).applyQuaternion(q) };
}

/**
 * A limb as her clip has it this frame, figure space: its root `S`, middle `E`,
 * end `W`, the hinge between, and the two lengths — the clip's own chain under
 * its parent as drawn (`rvmSitLegs`' algebra), so an aim already laid on the
 * limb itself is not in it.
 */
function rvsLimb(f, nU, nL, nE) {
  const R = f.bindRest(), lq = f.local().q;
  const iu = f.boneIndex(nU), il = f.boneIndex(nL), ie = f.boneIndex(nE);
  const ip = f.bones[iu].parent;
  const S = f.boneAt(iu, new THREE.Vector3());
  const bP = new THREE.Quaternion(R.bindQ[4 * ip], R.bindQ[4 * ip + 1], R.bindQ[4 * ip + 2], R.bindQ[4 * ip + 3]);
  const qP = f.boneTurn(ip, new THREE.Quaternion()).multiply(bP);
  const qU = new THREE.Quaternion(lq[4 * iu], lq[4 * iu + 1], lq[4 * iu + 2], lq[4 * iu + 3]).premultiply(qP);
  const E = new THREE.Vector3(R.t[3 * il], R.t[3 * il + 1], R.t[3 * il + 2]).applyQuaternion(qU).add(S);
  const qL = new THREE.Quaternion(lq[4 * il], lq[4 * il + 1], lq[4 * il + 2], lq[4 * il + 3]).premultiply(qU);
  const W = new THREE.Vector3(R.t[3 * ie], R.t[3 * ie + 1], R.t[3 * ie + 2]).applyQuaternion(qL).add(E);
  const h = E.clone().sub(S).cross(W.clone().sub(E));
  if (h.lengthSq() < 1e-8) h.set(0, 0, 1);
  return { S, E, W, hinge: h.normalize(), l1: E.distanceTo(S), l2: W.distanceTo(E) };
}

/** `P` moved to height `y` on the end of segment `O`→`P` of length `L`, its level bearing kept. */
function rvsAtHeight(O, P, L, y) {
  const dy = Math.max(-0.95 * L, Math.min(0.95 * L, y - O.y));
  const hx = P.x - O.x, hz = P.z - O.z, hl = Math.hypot(hx, hz);
  if (hl < 1e-5) return P.clone();
  const h = Math.sqrt(L * L - dy * dy);
  return new THREE.Vector3(O.x + hx / hl * h, O.y + dy, O.z + hz / hl * h);
}

/**
 * THE SPOON CURL'S LEGS on figure `F` (lying on her left side), `k` 0..1 of
 * the way from her clip's: each thigh `hip` off her long axis toward her front,
 * each shin `knee` back off it, and then knee and ankle put at their heights
 * over the mattress (`kneeY`, `ankY`, the under leg first) with the segment
 * lengths kept. Answers the points, figure space, for a probe.
 */
function rvsLegs(F, k, who = 'B', tuck = 1, from = null) {
  const f = F.fig, P0 = RVM_SPOON;
  // Chloe's curl may be her own (`hipC`, `kneeC`); Baye's is the table's. And
  // `tuck` 0..1 of the way from `kneeIn` to it: her knees come in once she
  // is down (see `kneeIn`).
  const kn = who === 'C' ? (P0.kneeC != null ? P0.kneeC : P0.knee) : P0.knee;
  const P = { hip: who === 'C' && P0.hipC != null ? P0.hipC : P0.hip, knee: P0.kneeIn + (kn - P0.kneeIn) * tuck,
    kneeY: P0.kneeY, ankY: P0.ankY };
  if (!jadrija.hingeArm || k <= 0.001) return null;
  const fr = rvsFrame(f);
  const kit = jadrija.kabina && jadrija.kabina.kit ? jadrija.kabina.kit() : null;
  if (!kit || !kit.cot) return null;
  const yTop = kit.cot[2] - F.mesh.position.y;
  const d = fr.up.clone().multiplyScalar(-Math.cos(P.hip)).addScaledVector(fr.fw, Math.sin(P.hip));
  const n = fr.up.clone().multiplyScalar(Math.sin(P.hip)).addScaledVector(fr.fw, Math.cos(P.hip));
  const e = d.clone().multiplyScalar(Math.cos(P.knee)).addScaledVector(n, -Math.sin(P.knee));
  const out = {};
  for (const s of ['L', 'R']) {
    const C = rvsLimb(f, 'legU' + s, 'legL' + s, 'foot' + s);
    const i = s === 'L' ? 0 : 1;
    const K = rvsAtHeight(C.S, C.S.clone().addScaledVector(d, C.l1), C.l1, yTop + P.kneeY[i]);
    const A = rvsAtHeight(K, K.clone().addScaledVector(e, C.l2), C.l2, yTop + P.ankY[i]);
    // From her clip's leg — or from `from` (Chloe's knees up, getting in).
    const K0 = from ? from[s].K : C.E, A0 = from ? from[s].A : C.W;
    const G = A0.clone().lerp(A, k);
    const pole = K0.clone().lerp(K, k).sub(C.S);
    jadrija.hingeArm(f, 'legU' + s, 'legL' + s, C.S, C.E, C.W, C.hinge, G, pole);
    out[s] = { S: C.S, K, A };
  }
  return out;
}
/**
 * CHLOE'S LEGS GETTING IN (and out), figure space, on her own frame: `e` 0..1
 * from her feet on the floor in front of the edge to her knees drawn up and
 * her feet flat on the mattress by her seat — the legs swung up on to the cot
 * without being stretched out along it, where your legs are. Laid on her
 * when `apply`; the knees-up points are what the lying down starts from.
 */
function rvsKneesUp(e, apply = true) {
  const f = you.fig;
  const fr = rvsFrame(f);
  const floorY = rev.ch.y - you.mesh.position.y;
  const out = {};
  const tu = fr.fw.clone().multiplyScalar(Math.cos(0.55)).addScaledVector(fr.up, Math.sin(0.55));
  const sh = fr.fw.clone().multiplyScalar(0.22).addScaledVector(fr.up, -1).normalize();
  for (const s of ['L', 'R']) {
    const C = rvsLimb(f, 'legU' + s, 'legL' + s, 'foot' + s);
    const sg = s === 'R' ? 1 : -1;
    const Ku = C.S.clone().addScaledVector(tu, C.l1).addScaledVector(fr.rt, 0.02 * sg);
    const Au = Ku.clone().addScaledVector(sh, C.l2);
    const Kf = C.S.clone().addScaledVector(fr.fw, C.l1 * 0.97).addScaledVector(fr.rt, 0.03 * sg);
    const Af = Kf.clone().addScaledVector(fr.fw, 0.06);
    Af.y = floorY + 0.08;
    const K = Kf.lerp(Ku, e), A = Af.lerp(Au, e);
    if (apply) jadrija.hingeArm(f, 'legU' + s, 'legL' + s, C.S, C.E, C.W, C.hinge, A, K.clone().sub(C.S));
    out[s] = { K, A };
  }
  return out;
}
function rvsLegsFree(f) { for (const n of ['legUL', 'legLL', 'legUR', 'legLR']) f.aim(n, 0, 0, 1, 0); }

// ── skin against skin, on the CPU ────────────────────────────────────────────
//
// Both bodies skinned on the CPU off the palettes that draw them — Baye's
// drawn body is v2.0 (`appr`), wearing her skeleton's palette; Chloe's is her
// own — the way `legsMeasure` in 43-jadrija.js does it, and the vertices of
// one hashed into 3 cm cells to find, for every vertex of the other, the
// nearest of the first and which side of its surface it is on (its normal).
// MEASURED, not estimated: this is what says "no interpenetration".

const RVS_REG = ['trunk', 'head', 'armL', 'armR', 'handL', 'handR', 'legs'];
function rvsRegOf(n) {
  if (/^(head|neck|jaw|eye)/.test(n)) return 1;
  if (/^(hand|fingers|thumb|idx|thb)[0-9]*L$/.test(n) || /^(fingers|thumb)L$/.test(n)) return 4;
  if (/^(hand|fingers|thumb|idx|thb)[0-9]*R$/.test(n)) return 5;
  if (/^arm[UL]L$/.test(n) || n === 'clavicleL') return 2;
  if (/^arm[UL]R$/.test(n) || n === 'clavicleR') return 3;
  if (/^(leg|foot|toe)/.test(n)) return 6;
  return 0;
}
const _rvsCache = new WeakMap();
function rvsSkinPrep(mesh, fig) {
  const g = mesh.geometry;
  let C = _rvsCache.get(g);
  if (C) return C;
  const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
  const BI = g.getAttribute('aBoneIdx'), BW = g.getAttribute('aBoneWt');
  if (!pos || !BI || !BW) return null;
  const bsc = BI.normalized ? 255 : 1;
  const ix = g.getIndex(), r = g.drawRange;
  const start = ix ? r.start : 0, end = ix ? Math.min(ix.count, r.start + r.count) : pos.count;
  const seen = new Uint8Array(pos.count), list = [];
  for (let i = start; i < end; i++) { const v = ix ? ix.getX(i) : i; if (!seen[v]) { seen[v] = 1; list.push(v); } }
  const n = list.length;
  const P = new Float32Array(3 * n), N = new Float32Array(3 * n), I = new Uint16Array(4 * n), W = new Float32Array(4 * n), reg = new Uint8Array(n);
  const names = fig.bones.map((b) => b.name);
  for (let j = 0; j < n; j++) {
    const v = list[j];
    P[3 * j] = pos.getX(v); P[3 * j + 1] = pos.getY(v); P[3 * j + 2] = pos.getZ(v);
    if (nrm) { N[3 * j] = nrm.getX(v); N[3 * j + 1] = nrm.getY(v); N[3 * j + 2] = nrm.getZ(v); }
    let best = -1, bw = 0;
    for (let w = 0; w < 4; w++) {
      I[4 * j + w] = Math.round(BI.getComponent(v, w) * bsc);
      W[4 * j + w] = BW.getComponent(v, w);
      if (W[4 * j + w] > bw) { bw = W[4 * j + w]; best = I[4 * j + w]; }
    }
    reg[j] = best >= 0 && names[best] ? rvsRegOf(names[best]) : 0;
  }
  C = { n, P, N, I, W, reg };
  _rvsCache.set(g, C);
  return C;
}
/** The vertices as drawn now, world: `{ n, p, nr, reg }` (every `stride`-th). */
function rvsSkin(mesh, fig, stride = 1) {
  const C = rvsSkinPrep(mesh, fig);
  if (!C) return null;
  const Pal = fig.pose().palette;
  mesh.updateMatrixWorld();
  const M = mesh.matrixWorld.elements;
  const m = Math.ceil(C.n / stride);
  const p = new Float32Array(3 * m), nr = new Float32Array(3 * m), reg = new Uint8Array(m);
  let o = 0;
  for (let j = 0; j < C.n; j += stride, o++) {
    const x = C.P[3 * j], y = C.P[3 * j + 1], z = C.P[3 * j + 2];
    const nx = C.N[3 * j], ny = C.N[3 * j + 1], nz = C.N[3 * j + 2];
    let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
    for (let w = 0; w < 4; w++) {
      const wt = C.W[4 * j + w];
      if (wt <= 0) continue;
      const b = C.I[4 * j + w] * 12;
      px += wt * (Pal[b] * x + Pal[b + 1] * y + Pal[b + 2] * z + Pal[b + 3]);
      py += wt * (Pal[b + 4] * x + Pal[b + 5] * y + Pal[b + 6] * z + Pal[b + 7]);
      pz += wt * (Pal[b + 8] * x + Pal[b + 9] * y + Pal[b + 10] * z + Pal[b + 11]);
      qx += wt * (Pal[b] * nx + Pal[b + 1] * ny + Pal[b + 2] * nz);
      qy += wt * (Pal[b + 4] * nx + Pal[b + 5] * ny + Pal[b + 6] * nz);
      qz += wt * (Pal[b + 8] * nx + Pal[b + 9] * ny + Pal[b + 10] * nz);
    }
    p[3 * o] = M[0] * px + M[4] * py + M[8] * pz + M[12];
    p[3 * o + 1] = M[1] * px + M[5] * py + M[9] * pz + M[13];
    p[3 * o + 2] = M[2] * px + M[6] * py + M[10] * pz + M[14];
    const ax = M[0] * qx + M[4] * qy + M[8] * qz, ay = M[1] * qx + M[5] * qy + M[9] * qz, az = M[2] * qx + M[6] * qy + M[10] * qz;
    const l = Math.hypot(ax, ay, az) || 1;
    nr[3 * o] = ax / l; nr[3 * o + 1] = ay / l; nr[3 * o + 2] = az / l;
    reg[o] = C.reg[j];
  }
  return { n: m, p, nr, reg };
}
/** Baye's drawn body, skinned (v2.0 if she is the one drawn, else her skeleton's own mesh). */
function rvsBayeSkin(stride = 1) {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const A = typeof appr !== 'undefined' && appr && appr.mesh && appr.mesh.visible ? appr.mesh : f.mesh;
  return rvsSkin(A, f, stride);
}
function rvsChloeSkin(stride = 1) { return you && you.fig ? rvsSkin(you.fig.mesh, you.fig, stride) : null; }

/**
 * THE GAP: every vertex of Chloe's against the nearest of Baye's within 8 cm.
 * Answers, by Chloe's region, the least distance and the least SIGNED one
 * (negative: inside Baye's skin, by her normal there), with the pair; `in`
 * counts vertices more than 3 mm inside. `skip` regions of hers left out;
 * `only` Baye's regions to measure against (null: all).
 */
function rvsGap(o = {}) {
  const A = o.A || rvsBayeSkin(o.strideB || 1), B = o.B || rvsChloeSkin(o.strideC || 1);
  if (!A || !B) return null;
  const Cs = 0.03, cells = new Map();
  const key = (x, y, z) => ((Math.floor(x / Cs) * 73856093) ^ (Math.floor(y / Cs) * 19349663) ^ (Math.floor(z / Cs) * 83492791));
  for (let i = 0; i < A.n; i++) {
    if (o.only && !o.only[A.reg[i]]) continue;
    const k = key(A.p[3 * i], A.p[3 * i + 1], A.p[3 * i + 2]);
    let L = cells.get(k);
    if (!L) { L = []; cells.set(k, L); }
    L.push(i);
  }
  const by = {};
  let all = { d: 9, s: 9, inN: 0 };
  for (let j = 0; j < B.n; j++) {
    const r = B.reg[j];
    if (o.skip && o.skip[r]) continue;
    const x = B.p[3 * j], y = B.p[3 * j + 1], z = B.p[3 * j + 2];
    // The three nearest of hers (within 8 cm): inside her only if it is
    // behind the skin at all three — one vertex's normal is a poor witness a
    // few centimetres off, round a heel or a knuckle (it read 8 cm "into" her
    // at shins that were nowhere near before this).
    let b0 = 1e9, b1 = 1e9, b2 = 1e9, i0 = -1, i1 = -1, i2 = -1;
    const lim = 0.08 * 0.08;
    const cx = Math.floor(x / Cs), cy = Math.floor(y / Cs), cz = Math.floor(z / Cs);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
      const L = cells.get(((cx + a) * 73856093) ^ ((cy + b) * 19349663) ^ ((cz + c) * 83492791));
      if (!L) continue;
      for (const i of L) {
        const dx = x - A.p[3 * i], dy = y - A.p[3 * i + 1], dz = z - A.p[3 * i + 2];
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd >= lim || dd >= b2) continue;
        if (dd < b0) { b2 = b1; i2 = i1; b1 = b0; i1 = i0; b0 = dd; i0 = i; }
        else if (dd < b1) { b2 = b1; i2 = i1; b1 = dd; i1 = i; }
        else { b2 = dd; i2 = i; }
      }
    }
    if (i0 < 0) continue;
    const bi = i0, d = Math.sqrt(b0);
    const side = (i) => (i < 0 ? -1 : (x - A.p[3 * i]) * A.nr[3 * i] + (y - A.p[3 * i + 1]) * A.nr[3 * i + 1] + (z - A.p[3 * i + 2]) * A.nr[3 * i + 2]);
    const inside = side(i0) < 0 && side(i1) < 0 && side(i2) < 0;
    const sg = inside ? -d : d;
    const R = by[RVS_REG[r]] || (by[RVS_REG[r]] = { d: 9, s: 9, inN: 0, n: 0, at: null, her: null });
    R.n++;
    if (d < R.d) { R.d = d; R.at = [x, y, z]; R.her = RVS_REG[A.reg[bi]]; }
    if (sg < R.s) { R.s = sg; R.sat = [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)]; R.sher = RVS_REG[A.reg[bi]]; }
    if (sg < -0.003) { R.inN++; all.inN++; }
    if (d < all.d) all.d = d;
    if (sg < all.s) all.s = sg;
  }
  for (const k of Object.keys(by)) {
    const R = by[k];
    R.d = +R.d.toFixed(4); R.s = +R.s.toFixed(4);
    if (R.at) R.at = R.at.map((v) => +v.toFixed(3));
  }
  all.d = +all.d.toFixed(4); all.s = +all.s.toFixed(4);
  return { all, by, nA: A.n, nB: B.n };
}

/** Baye's skin vertex nearest `P` among regions `regs` (null: all): `{ p, n, d }`. */
function rvsNearest(A, P, regs = null) {
  if (!A) return null;
  let bd = 1e9, bi = -1;
  for (let i = 0; i < A.n; i++) {
    if (regs && !regs[A.reg[i]]) continue;
    const dx = A.p[3 * i] - P.x, dy = A.p[3 * i + 1] - P.y, dz = A.p[3 * i + 2] - P.z;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd < bd) { bd = dd; bi = i; }
  }
  if (bi < 0) return null;
  return { p: new THREE.Vector3(A.p[3 * bi], A.p[3 * bi + 1], A.p[3 * bi + 2]),
    n: new THREE.Vector3(A.nr[3 * bi], A.nr[3 * bi + 1], A.nr[3 * bi + 2]), d: Math.sqrt(bd) };
}
/**
 * How far the back of her hand is from its palm, along the palm's normal
 * `pn`, at the palm's middle `P`: the furthest of her hand's vertices behind
 * the palm within 2 cm of that line. MEASURED, so her palm lands on skin.
 */
function rvsHandTh(A, P, pn) {
  if (!A) return 0.035;
  let best = 0;
  for (let i = 0; i < A.n; i++) {
    if (A.reg[i] !== 5) continue;
    const dx = A.p[3 * i] - P.x, dy = A.p[3 * i + 1] - P.y, dz = A.p[3 * i + 2] - P.z;
    const a = -(dx * pn.x + dy * pn.y + dz * pn.z);
    const ox = dx + pn.x * a, oy = dy + pn.y * a, oz = dz + pn.z * a;
    if (ox * ox + oy * oy + oz * oz > 0.02 * 0.02) continue;
    if (a > best) best = a;
  }
  return best > 0.01 && best < 0.08 ? best : 0.035;
}

/** The mattress, world: its middle, its across axis (toward the room) and its long one, half-sizes, top. */
function rvsMattress() {
  const K = jadrija.kabina, kit = K && K.kit ? K.kit() : null;
  if (!kit || !kit.cot || !jadrija.toWorld) return null;
  const c = jadrija.toWorld(kit.cot[0], kit.cot[1] + 0.10);
  const cA = jadrija.toWorld(kit.cot[0] + 1, kit.cot[1] + 0.10), cS = jadrija.toWorld(kit.cot[0], kit.cot[1] + 1.10);
  // `t` grows toward the wall, so the room is −t.
  const out = new THREE.Vector3(c[0] - cA[0], 0, c[2] - cA[2]).normalize();
  const ax = new THREE.Vector3(cS[0] - c[0], 0, cS[2] - c[2]).normalize();
  return { mid: new THREE.Vector3(c[0], kit.cot[2], c[2]), out, ax, half: 0.335, len: 0.915, top: kit.cot[2] };
}
/** A skin's extent on the mattress: across it (room side −, wall side +, m off its middle), and its lowest point against the top. */
function rvsSpan(S, Mt, skip = null) {
  let lo = 9, hi = -9, low = 9, len0 = 9, len1 = -9, loR = 0, hiR = 0;
  for (let i = 0; i < S.n; i++) {
    if (skip && skip[S.reg[i]]) continue;
    const dx = S.p[3 * i] - Mt.mid.x, dz = S.p[3 * i + 2] - Mt.mid.z;
    const a = -(dx * Mt.out.x + dz * Mt.out.z), l = dx * Mt.ax.x + dz * Mt.ax.z;
    if (a < lo) { lo = a; loR = S.reg[i]; }
    if (a > hi) { hi = a; hiR = S.reg[i]; }
    if (l < len0) len0 = l; if (l > len1) len1 = l;
    if (Math.abs(a) < Mt.half && Math.abs(l) < Mt.len) low = Math.min(low, S.p[3 * i + 1] - Mt.top);
  }
  return { room: +(lo + Mt.half).toFixed(3), wall: +(Mt.half - hi).toFixed(3), lo: +lo.toFixed(3), hi: +hi.toFixed(3),
    by: [RVS_REG[loR], RVS_REG[hiR]],
    low: +low.toFixed(3), len: [+len0.toFixed(3), +len1.toFixed(3)] };
}

// ── the two of them ──────────────────────────────────────────────────────────

/** Whether Chloe is on the cot with you (lying down, on her way down, or getting up). */
function rvmSpoonOn() { const M = rvm.move; return !!(M && M.id === 'spoon' && M.lie != null); }
/** Whether a spoon is going at all (waiting for you, walking, sitting, lying, getting up). */
function rvmSpooning() { const M = rvm.move; return !!(M && M.id === 'spoon'); }

/** Baye's frame in the world: her front and up her long axis, both level. */
function rvsBayeAxes() {
  const B = rvsBaye();
  if (!B) return null;
  const fr = rvsFrame(B.fig), q = B.mesh.quaternion;
  const fw = fr.fw.applyQuaternion(q), up = fr.up.applyQuaternion(q), rt = fr.rt.applyQuaternion(q);
  fw.y = 0; up.y = 0;
  return { fw: fw.normalize(), up: up.normalize(), rt };
}

/** Where Chloe's figure goes, lying behind Baye: her mesh's place and turn (Baye's, moved `W`). */
function rvsLiePlace(M) {
  const B = rvsBaye(), X = rvsBayeAxes();
  if (!B || !X) return null;
  const at = B.mesh.position.clone().addScaledVector(X.fw, -M.W.a).addScaledVector(X.up, -M.W.c);
  // Her `fetalHeld` was baked before Baye's was lifted 4 cm on to the foam
  // (FETAL's `@root`, 24 Sep): the difference of the two roots, put back.
  if (M.rootD) at.add(M.rootD.clone().applyQuaternion(B.mesh.quaternion));
  return { at, q: B.mesh.quaternion.clone() };
}

/**
 * Chloe's figure this frame, while the spoon has her (from `revDriveChloe`):
 * `{ at, quat }`, or null when the rest of her moves have her. Down from the
 * seat to her place behind Baye along `M.lie` 0..1 (smoothstep), with a lift
 * of a few centimetres in the middle of it and her turn going round from
 * facing the room to facing Baye's back the way `M.turnDir` says.
 */
function rvmSpoonDrive() {
  const M = rvm.move;
  if (!M || M.id !== 'spoon' || M.lie == null || !M.seatAt) return null;
  const L = rvsLiePlace(M);
  if (!L || !M.longAt) return null;
  const P = RVM_SPOON, u = Math.max(0, Math.min(1, M.lie));
  const sm = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
  const yawOf = (q) => 2 * Math.atan2(q.y, q.w);
  const turn = (y0, y1, dir, e) => {
    let dy = Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0));
    if (dir && Math.sign(dy) !== dir) dy += dir * Math.PI * 2;
    return y0 + dy * e;
  };
  let at, yaw;
  if (u < P.legsUp) {
    // THE LEGS UP: still sitting, turned on the edge from the room to the foot
    // of the cot, her feet off the floor and up along the mattress, and her
    // seat a little further on to it.
    const e = sm(u / P.legsUp);
    at = M.seatAt.clone().lerp(M.longAt, e);
    yaw = turn(yawOf(M.seatQ), M.longYaw, M.legsDir, e);
  } else {
    // AND DOWN: from sitting along the cot on to her side behind you, her
    // place and her turn going on to yours as she lies down.
    const e = sm((u - P.legsUp) / (1 - P.legsUp));
    at = M.longAt.clone().lerp(L.at, e);
    at.y += P.arc * Math.sin(Math.PI * e);
    yaw = turn(M.longYaw, yawOf(L.q), M.turnDir || 0, e);
  }
  const quat = new THREE.Quaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
  return { at, quat };
}

/** Her seat on the room-side edge, level with Baye's waist; the floor in front of it. */
function rvsSeat() {
  const G = rvmCotGeom();
  const P = revBone(RVM_SPOON.seatBone, new THREE.Vector3());
  if (!G || !G.edge || !P) return null;
  const along = (P.x - G.mid.x) * G.ax.x + (P.z - G.mid.z) * G.ax.z + RVM_SPOON.seatAlong;
  const edgeAt = new THREE.Vector3(G.mid.x, G.top, G.mid.z).addScaledVector(G.ax, along);
  const inset = (G.edge.x - G.mid.x) * G.out.x + (G.edge.z - G.mid.z) * G.out.z;
  const seat = edgeAt.clone().addScaledVector(G.out, inset + RVM_SPOON.seatIn);
  const stand = edgeAt.clone().addScaledVector(G.out, inset + 0.36);
  const [qx, qz] = ground.confine ? ground.confine(stand.x, stand.z, rev.ch.y) : [stand.x, stand.z];
  if (!jadrija.kabina.room(qx, qz, 0.12)) return null;
  return { seat, stand: new THREE.Vector3(qx, rev.ch.y, qz), yaw: Math.atan2(-G.out.x, -G.out.z), out: G.out.clone() };
}

/** Where your two hands meet, world: on your chest, below your chest bone, and its skin's normal. */
function rvsHandSpot(BS) {
  const X = rvsBayeAxes(), C = revBone('chest', new THREE.Vector3()), S3 = revBone('spine03', new THREE.Vector3());
  if (!X || !C || !S3) return null;
  const B = rvsBaye();
  const fr = rvsFrame(B.fig), q = B.mesh.quaternion;
  const fw = fr.fw.applyQuaternion(q).normalize(), up = fr.up.applyQuaternion(q).normalize(), rt = fr.rt.applyQuaternion(q).normalize();
  // WHERE: on the top of her hip, a little forward of it (`hip`) — her upper
  // arm lying along her side, as it does asleep, and the one place Chloe's
  // arm over her waist reaches with its elbow bent — or on her belly
  // (`belly`), below the chest bone.
  const hipAt = RVM_SPOON.handAt === 'hip';
  const HJ = revBone('legUR', new THREE.Vector3());
  const O = hipAt && HJ ? HJ.clone().addScaledVector(up, RVM_SPOON.hipUp).addScaledVector(fw, RVM_SPOON.hipFw)
    : C.clone().addScaledVector(up, -RVM_SPOON.handDown).addScaledVector(rt, 0.025);
  const dir = hipAt ? rt.clone().addScaledVector(fw, 0.35).normalize() : fw.clone();
  // Her skin there: the furthest vertex of hers out along `dir` within 4 cm of the line.
  let best = -9, Pt = null, Nn = null;
  if (BS) {
    for (let i = 0; i < BS.n; i++) {
      const r = BS.reg[i];
      if (r !== 0 && !(hipAt && r === 6)) continue;
      const dx = BS.p[3 * i] - O.x, dy = BS.p[3 * i + 1] - O.y, dz = BS.p[3 * i + 2] - O.z;
      const f = dx * dir.x + dy * dir.y + dz * dir.z;
      const ox = dx - dir.x * f, oy = dy - dir.y * f, oz = dz - dir.z * f;
      if (ox * ox + oy * oy + oz * oz > 0.04 * 0.04 || f < 0) continue;
      if (f > best) { best = f; Pt = new THREE.Vector3(BS.p[3 * i], BS.p[3 * i + 1], BS.p[3 * i + 2]); Nn = new THREE.Vector3(BS.nr[3 * i], BS.nr[3 * i + 1], BS.nr[3 * i + 2]); }
    }
  }
  if (!Pt) { Pt = O.clone().addScaledVector(dir, 0.13); Nn = dir.clone(); }
  // Her fingers: down her thigh toward her knee on her hip; down her front on her belly.
  const K = revBone('legLR', new THREE.Vector3());
  const fd = hipAt && HJ && K ? K.clone().sub(HJ).normalize() : rt.clone().multiplyScalar(-0.75).addScaledVector(up, -0.55).normalize();
  return { T: Pt, n: Nn.normalize(), fw, up, rt, fd, hip: hipAt };
}

/**
 * BAYE IN THE SPOON CURL, a frame (`M.bk` 0..1 of the way): her legs, her
 * upper hand off her knee and on to her chest (palm solved on to the skin), and
 * her breath. The curl's shift is set where it is decided (`rvmSpoonTick`).
 */
function rvsBayePose(M, dt) {
  const B = rvsBaye();
  if (!B) return;
  const k = M.bk;
  if (k > 0.001) {
    if (M.legT) { const f = B.fig; M.legErr = ["L", "R"].map((s) => +f.boneAt(f.boneIndex("legL" + s), new THREE.Vector3()).distanceTo(M.legT[s].K).toFixed(4)); }
    M.legT = rvsLegs(B, k, 'B', M.tuck || 0);
    if (M.hand && (M.armK || 0) > 0.001) {
      const H = M.hand;
      // Fingers down her front toward the mattress and her waist; the elbow
      // back along her side.
      const d = H.fd.clone();
      const bp = H.hip ? RVM_SPOON.bPoleHip : RVM_SPOON.bPole;
      const pole = H.up.clone().multiplyScalar(bp[0]).addScaledVector(H.fw, bp[1]).addScaledVector(H.rt, bp[2]);
      if (M.pred) { const ae = revBone("armLR", new THREE.Vector3()), aw = revBone("handR", new THREE.Vector3()); M.predErr = [+ae.distanceTo(M.pred.E).toFixed(4), +aw.distanceTo(M.pred.W).toFixed(4)]; }
      const pm = rvmPalm('R', new THREE.Vector3(), B);
      if (pm) M.bayeErr = pm.distanceTo(H.T.clone().addScaledVector(H.n, 0.004));
      const got = rvmSolve('R', H.T.clone().addScaledVector(H.n, 0.004), H.n, d, pole, 0, Math.min(k, M.armK || 0), new THREE.Vector3(), B);
      if (got) M.bayeSolveErr = got.distanceTo(H.T.clone().addScaledVector(H.n, 0.004));
      M.pred = B.pred;
    }
    M.bOn = true;
  } else if (M.bOn) {
    rvsLegsFree(B.fig);
    for (const n of ['armUR', 'armLR', 'handR']) B.fig.aim(n, 0, 0, 1, 0);
    M.bOn = false;
  }
}

/** The breath of both, a frame: phases, Chloe's rate easing on to Baye's, and the chests. */
function rvsBreath(M, dt) {
  const Br = RVM_SPOON.breath, S = M.br;
  const TAU = Math.PI * 2;
  S.thB = (S.thB + TAU * Br.her * dt) % TAU;
  // Chloe: her rate eases on to Baye's once she is lying with her, and her
  // phase is drawn to Baye's — the more the longer she has been there.
  const on = M.ph === 'on' || M.ph === 'settle';
  if (on) S.f += (Br.her - S.f) * (1 - Math.exp(-dt / Br.tau));
  const dphi = Math.atan2(Math.sin(S.thB - S.thC), Math.cos(S.thB - S.thC));
  const pull = on ? Br.lock * Math.min(1, (M.tOn || 0) / 6) : 0;
  S.thC = (S.thC + (TAU * S.f + pull * Math.sin(dphi)) * dt + TAU) % TAU;
  S.bB = 0.5 - 0.5 * Math.cos(S.thB);
  S.bC = 0.5 - 0.5 * Math.cos(S.thC);
  S.dphi = dphi;
  // The chests: up and out a little, about each one's own across-axis.
  // (Chloe's on her chest alone: her spine is where her reach to you goes.)
  const lay = (f, b, w, both) => {
    const fr = rvsFrame(f);
    f.aim('chest', fr.rt.x, fr.rt.y, fr.rt.z, (Br.chest + (both ? 0 : Br.spine)) * b * w);
    if (both) f.aim('spine03', fr.rt.x, fr.rt.y, fr.rt.z, Br.spine * b * w);
  };
  const Bf = rvsBaye();
  const wB = Math.min(1, M.bk * 1.2);
  if (Bf && wB > 0.001) lay(Bf.fig, S.bB, wB, true);
  const wC = M.lie != null ? Math.min(1, M.lie) : 0;
  if (you && you.fig && wC > 0.001) lay(you.fig, S.bC, wC, false);
  S.t += dt;
  if (S.t - S.last >= 0.25) {
    S.last = S.t;
    S.trace.push([+M.t.toFixed(2), +S.f.toFixed(3), +dphi.toFixed(3), +S.bB.toFixed(3), +S.bC.toFixed(3), M.ph]);
    if (S.trace.length > 600) S.trace.shift();
  }
}
function rvsBreathOff(M) {
  const Bf = rvsBaye();
  if (Bf) { Bf.fig.aim('chest', 0, 0, 1, 0); Bf.fig.aim('spine03', 0, 0, 1, 0); }
  if (you && you.fig) { you.fig.aim('chest', 0, 0, 1, 0); you.fig.aim('spine03', 0, 0, 1, 0); }
}

/**
 * Chloe's arms, legs, face, lying: her legs in the spoon curl (`rvsLegs`, the
 * same solve as Baye's), her upper palm on the back of Baye's hand, her face
 * into Baye's nape — or, kissing, the last few centimetres to her shoulder.
 */
function rvsChloePose(M, dt) {
  const P0 = RVM_SPOON, u = M.lie != null ? Math.max(0, Math.min(1, M.lie)) : 0;
  // `k`: how far into lying down she is (0 while her legs come up).
  const k = u <= P0.legsUp ? 0 : (u - P0.legsUp) / (1 - P0.legsUp);
  const F = { fig: you.fig, mesh: you.mesh };
  const sm = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
  if (u < P0.legsUp) {
    // Her feet off the floor and up, knees drawn up, on to the cot.
    rvsKneesUp(sm(u / P0.legsUp)); rvm.legsOn = true;
  } else { rvsLegs(F, Math.max(0.002, sm(k)), 'C', M.tuck || 0, rvsKneesUp(1, false)); rvm.legsOn = true; }
  // Her hands while she turns on the edge and lies down: on the mattress at
  // its edge, behind her hips, taking her weight — on the room side of her and
  // never back on to you (her clip's hands are on the mattress either side,
  // and turned to face the cot's foot the left one went into your back,
  // MEASURED). Let go as she lies down; then her arms are the spoon's.
  if (u > 0.02 && k < RVM_SPOON.handsAt) {
    const Gc = rvmCotGeom(), Pv = you.fig.boneAt(0, new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld);
    if (Gc && Gc.out && Gc.edge) {
      const inset = (Gc.edge.x - Gc.mid.x) * Gc.out.x + (Gc.edge.z - Gc.mid.z) * Gc.out.z;
      const along = (Pv.x - Gc.mid.x) * Gc.ax.x + (Pv.z - Gc.mid.z) * Gc.ax.z;
      const fwC = new THREE.Vector3(1, 0, 0).applyQuaternion(you.mesh.quaternion).setY(0).normalize();
      const fa = fwC.x * Gc.ax.x + fwC.z * Gc.ax.z;
      // Her right beside her hip, her left behind her, both just in from the edge.
      for (const [s, back, inn] of [['R', -0.04, 0.0], ['L', 0.17, 0.05]]) {
        const C = new THREE.Vector3(Gc.mid.x, Gc.top + 0.004, Gc.mid.z).addScaledVector(Gc.ax, along - fa * back)
          .addScaledVector(Gc.out, inset + 0.03 - inn);
        rvmAsk(s, { C, n: new THREE.Vector3(0, 1, 0), d: Gc.out.clone(), pole: Gc.out.clone().add(new THREE.Vector3(0, 0.3, 0)).addScaledVector(fwC, -0.4),
          cock: 0, shape: 'flat', rate: 4 });
      }
    }
  }
  const B = rvsBaye();
  if (!B) return;
  // Her hand on yours: the back of Baye's hand — the palm's own point carried
  // through to its back (the hand is 4 cm thick there) — her palm on it, her
  // fingers along Baye's, the elbow up and back over Baye's waist.
  if (k >= RVM_SPOON.handsAt && M.bk > 0.9 && (M.armK || 0) > 0.9) {
    const HB = rvmHandBind('R');
    const bq = B.fig.boneTurn(B.fig.boneIndex('handR'), new THREE.Quaternion()).premultiply(B.mesh.quaternion);
    const pn = HB.n.clone().applyQuaternion(bq).normalize();
    const P = rvmPalm('R', new THREE.Vector3(), B);
    if (P) {
      // How thick her hand is there, off her mesh (once): the back of it.
      if (M.handTh == null) M.handTh = rvsHandTh(rvsBayeSkin(1), P, pn);
      const D = P.addScaledVector(pn, -M.handTh);
      M.dorsum = D.clone(); M.dorsumN = pn.clone().negate();
      const X = rvsBayeAxes();
      const shC = rvmShoulder('R', new THREE.Vector3());
      // Her fingers the way her arm comes, from behind you over your waist.
      const d = shC ? D.clone().sub(shC) : X.fw.clone();
      const cp = RVM_SPOON.cPole;
      // Her elbow: the way the search found clear of you (`rvsArmPole`), from
      // when she has settled; the typed lean until then.
      // Once, when she has settled: searched again, a pole that is nearly as
      // good flips the elbow round the arm (MEASURED: 40 cm at the palm, for a
      // frame or two) — so it is kept.
      if (M.ph === 'on' && M.poleT == null) { M.poleT = M.t; rvsArmPole(M, D, d.clone().normalize()); }
      let pole = M.armPole ? M.armPole.clone()
        : X.rt.clone().multiplyScalar(cp[0]).addScaledVector(X.fw, cp[1]).addScaledVector(X.up, cp[2]);
      // Her elbow kept the way it is once it is over you (the found way a
      // little too), so a kiss that turns her shoulders does not swing it round
      // the arm — MEASURED: 41 cm at the palm, for a frame, before this.
      if (M.armPole && rvm.k.R > 0.9 && shC) {
        const ei = you.fig.boneIndex('armLR');
        const el = you.fig.boneAt(ei, new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld);
        pole = el.sub(shC).normalize().addScaledVector(M.armPole.clone().normalize(), 0.3);
      }
      rvmAsk('R', { C: D.clone().addScaledVector(M.dorsumN, RVM_SPOON.handOff), n: M.dorsumN.clone(), d, pole, cock: 0, shape: RVM_SPOON.handShape,
        rate: 2.2 });
    }
  }
  // Her under arm up past her head and folded back under it, the palm under
  // her own cheek — the way Baye's own curl lies on her hand, and the one
  // place an under arm goes with somebody lying in front of her: her elbow up
  // the pillow, nowhere between the two of them. (Her `fetalHeld` is the
  // older bake, whose under arm reaches straight out past her head and, behind
  // Baye, into her.)
  if (k >= RVM_SPOON.handsAt) {
    const hiC = you.fig.boneIndex('head');
    const hqC = you.fig.boneTurn(hiC, new THREE.Quaternion()).premultiply(you.mesh.quaternion);
    const Hc = you.fig.boneAt(hiC, new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld)
      .add(new THREE.Vector3(0.015, 0.085, 0).applyQuaternion(hqC));
    const fwC = new THREE.Vector3(1, 0, 0).applyQuaternion(hqC), upC = new THREE.Vector3(0, 1, 0).applyQuaternion(hqC);
    const cheek = Hc.clone().add(new THREE.Vector3(0, -RVM_SPOON.cheek, 0)).addScaledVector(fwC, 0.03);
    const d = fwC.clone().setY(0);
    if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
    const pole = upC.clone().setY(0).normalize().multiplyScalar(1).add(new THREE.Vector3(0, -0.6, 0));
    rvmAsk('L', { C: cheek.addScaledVector(new THREE.Vector3(0, -1, 0), 0.004), n: new THREE.Vector3(0, -1, 0), d: d.normalize(), pole,
      cock: 0, shape: 'soft', rate: 3 });
  }
  // Her face into Baye's nape, or her lips to Baye's shoulder.
  const Hd = rvmYourHead();
  if (!Hd) return;
  M.nape = rvmNapeSpot(Hd).T;
  const hi = you.fig.boneIndex('head');
  const hq = you.fig.boneTurn(hi, new THREE.Quaternion());
  const face = you.fig.boneAt(hi, new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld)
    .add(new THREE.Vector3(0.10, 0.07, 0).applyQuaternion(hq).applyQuaternion(you.mesh.quaternion));
  // A kiss: on the skin of yours nearest her lips when it begins — the back of
  // your shoulder, the top of your back — carried on your chest bone after.
  const Cb = revBone('chest', new THREE.Vector3());
  if (M.kissing && !M.kissP && Cb) {
    const N = rvsNearest(rvsBayeSkin(1), face, { 0: 1, 3: 1 });
    if (N) { M.kissRel = N.p.clone().sub(Cb); M.kissP = N.p; }
  }
  if (M.kissP && Cb && M.kissRel) M.kissP = Cb.clone().add(M.kissRel);
  if (!M.kissing) { M.kissP = null; M.kissRel = null; }
  const tgt = M.kissing && M.kissP ? M.kissP : M.nape;
  // Her eyes on it — but aimed at a point well past it, along the same line
  // from the middle of her head: a look at a point 6 cm off turns her head,
  // which moves her eyes, which turns the look, a frame at a time (MEASURED:
  // her head 4 cm to and fro every other frame, all through a kiss).
  const hc = you.fig.boneAt(you.fig.boneIndex('head'), new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld);
  const key = M.kissing ? 'k' : 'n';
  M.lookAge = (M.lookAge || 0) + dt;
  if (!M.lookFar || M.lookKey !== key || M.lookAge > 1.5) { M.lookFar = tgt.clone().addScaledVector(tgt.clone().sub(hc).normalize(), 0.6); M.lookKey = key; M.lookAge = 0; }
  M.lookT = M.lookFar;
  M.faceD = face.distanceTo(tgt);
  // The reach: the top of her spine turned so her face comes to it, and back.
  // Kissing, all the way to the skin; otherwise a little way into your nape
  // (`nuzzle` m off it), and never nearer your skin than `headMin` by the
  // measured gap of her head (`M.headGap`, twice a second).
  const P = RVM_SPOON;
  // (Once her lips are on your skin — by the mesh, `kissMin` — she reaches no further.)
  if (M.kissing) M.reach = Math.max(0, Math.min(0.24, (M.reach || 0) + (M.kissMin < 0.01 ? 0 : (M.faceD - 0.010) * dt * 3.0)));
  else {
    const hg = M.headGap == null ? 9 : M.headGap;
    const go = M.faceD > P.nuzzle && hg > P.headMin ? Math.min(M.faceD - P.nuzzle, hg - P.headMin) : hg < P.headMin * 0.7 ? -0.05 : 0;
    const cap = Math.max(P.nuzzleMax, Math.min(0.32, (M.reach || 0)));
    M.reach = Math.max(0, Math.min(go >= 0 ? P.nuzzleMax : cap, (M.reach || 0) + go * dt * 1.2 - (go < 0 ? dt * 0.05 : 0)));
    if ((M.reach || 0) > P.nuzzleMax) M.reach = Math.max(P.nuzzleMax, M.reach - dt * 0.25);
  }
  const ci = you.fig.boneIndex('chest');
  const C0 = you.fig.boneAt(ci, new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld);
  // The axis taken once, as the reach begins, and kept: worked out afresh
  // each frame from where her face has got to, it turns over as her face
  // passes the line to the skin and she rocks to and fro a frame at a time
  // (MEASURED: her face 12 and 16 cm off, alternately, for a whole kiss).
  if (!M.reachAx || M.reach < 0.002) {
    const a0 = face.clone().sub(C0).cross(tgt.clone().sub(C0));
    M.reachAx = a0.lengthSq() > 1e-8 ? a0.normalize().applyQuaternion(you.mesh.quaternion.clone().invert()) : null;
  }
  const ax = M.reachAx;
  if (ax && M.reach > 0.002) {
    you.fig.aim('spine03', ax.x, ax.y, ax.z, M.reach * 0.6);
    you.fig.aim('spine02', ax.x, ax.y, ax.z, M.reach * 0.4);
    M.reachOn = true;
  } else if (M.reachOn) {
    you.fig.aim('spine03', 0, 0, 1, 0); you.fig.aim('spine02', 0, 0, 1, 0);
    M.reachOn = false;
  }
}

/**
 * WHICH WAY HER ELBOW GOES, OVER YOUR WAIST: solved, not typed. Her arm from
 * her shoulder to the back of your hand is two bones and one free turn — the
 * elbow anywhere round the shoulder-to-wrist line — and of 24 ways round it,
 * this keeps the one whose upper arm and forearm (capsules of 4.8 and 3.6 cm,
 * off `rvmTwoBone`, the arm's own solve) stand furthest off your skin, your own
 * arm included, everywhere but the hand she is holding; ties go to the one
 * nearest `cPole`. Answers the pole (world) and its clearance (m).
 */
function rvsArmPole(M, D, dl) {
  const c = rvmChain('R');
  const S = rvmShoulder('R', new THREE.Vector3());
  const X = rvsBayeAxes();
  const A = rvsBayeSkin(2);
  if (!c || !S || !X || !A) return null;
  const HB = rvmHandBind('R');
  // The wrist, where her palm on the back of your hand puts it: back along
  // her fingers by the palm's reach, out off your hand by its depth.
  const Wr = D.clone().addScaledVector(dl, -HB.o.length() * 0.95).addScaledVector(M.dorsumN, RVM.off + RVM_SPOON.handOff);
  const Mi = new THREE.Matrix4().copy(you.mesh.matrixWorld).invert();
  const qi = you.mesh.quaternion.clone().invert();
  const Wf = Wr.clone().applyMatrix4(Mi);
  const cp = RVM_SPOON.cPole;
  const base = X.rt.clone().multiplyScalar(cp[0]).addScaledVector(X.fw, cp[1]).addScaledVector(X.up, cp[2]);
  const ax = Wr.clone().sub(S).normalize();
  const b0 = base.clone().addScaledVector(ax, -base.dot(ax)).normalize();
  const b1 = new THREE.Vector3().crossVectors(ax, b0);
  const segD = (p, a, b) => {
    const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
    return p.distanceTo(a.clone().addScaledVector(ab, t));
  };
  // Your skin, less the hand she holds and what is within 7 cm of it.
  const pts = [];
  const P = new THREE.Vector3();
  for (let i = 0; i < A.n; i++) {
    if (A.reg[i] === 5) continue;
    P.set(A.p[3 * i], A.p[3 * i + 1], A.p[3 * i + 2]);
    if (P.distanceTo(D) < 0.04) continue;
    if (P.distanceTo(S) > 0.75) continue;
    pts.push(P.clone());
  }
  let best = null;
  for (let i = 0; i < 24; i++) {
    const a = (i - 12) / 12 * Math.PI;
    const pole = b0.clone().multiplyScalar(Math.cos(a)).addScaledVector(b1, Math.sin(a));
    const sol = rvmTwoBone(c, Wf.clone(), pole.clone().applyQuaternion(qi));
    const E = sol.elbow.clone().applyMatrix4(you.mesh.matrixWorld), W = sol.wrist.clone().applyMatrix4(you.mesh.matrixWorld);
    let cl = 9;
    for (const q of pts) {
      cl = Math.min(cl, segD(q, S, E) - 0.048, segD(q, E, W) - 0.036);
      if (cl < -0.08) break;
    }
    const score = Math.min(cl, 0.012) - 0.004 * Math.abs(a);
    if (!best || score > best.score) best = { score, cl, pole, a };
  }
  M.armPole = best.pole; M.armCl = best.cl; M.armA = best.a;
  return best;
}

/** Baye's mesh across the cot, measured, and the shift that puts her front `edge` m inside its wall side. */
function rvsFitShift(M) {
  const Mt = rvsMattress(), BS = rvsBayeSkin(2);
  if (!Mt || !BS) return null;
  // Off everything but her legs and her upper arm: the legs are straighter while
  // Chloe gets in (`kneeIn`) and the hand still on her knee (`armK`), and drawn
  // up and on her hip after, neither is ever the front of her.

  const sp = rvsSpan(BS, Mt, { 6: 1, 3: 1, 5: 1 });
  const now = jadrija.curlShift ? jadrija.curlShift().d : 0;
  // `t` grows toward the wall, which is +across here: the shift adds to it one for one.
  const want = now + (sp.wall - RVM_SPOON.edge);
  M.fit = { span: sp, shift: +want.toFixed(3), was: +now.toFixed(3) };
  return want;
}

/** The gap, once, now: Chloe against Baye (everything of hers but the hand on yours and the arm to it). */
function rvsGapNow(M, stride = 2) {
  const A = rvsBayeSkin(stride);
  const B = rvsChloeSkin(stride);
  if (!A || !B) return null;
  const G = rvsGap({ A, B, skip: { 3: 1, 5: 1 } });
  const H = rvsGap({ A, B, skip: { 0: 1, 1: 1, 2: 1, 4: 1, 6: 1 } });
  const Mt = rvsMattress();
  return { G, H, spanB: Mt ? rvsSpan(A, Mt) : null, spanC: Mt ? rvsSpan(B, Mt) : null };
}

/**
 * THE SPOON, a frame. Phases: `curl` (waiting for you to be curled up on your
 * side), `go` (to the edge, you shifting over and loosening), `sit`, `swing`
 * (down on to her side behind you), `settle` (in close, by the measured gap),
 * `on` (held: the hand-hold, the breath, now and then a kiss on your
 * shoulder), `up` (the way she came), and `stand`.
 */
function rvmSpoonTick(M, dt) {
  const P = RVM_SPOON, Bd = rvm.body;
  const v = revView();
  const curled = v && v.phase === 'fetalHeld' && v.onBed;
  M.br = M.br || { thB: Math.random() * 6.28, thC: Math.random() * 6.28, f: P.breath.mine, t: 0, last: -1, trace: [], bB: 0, bC: 0, dphi: 0 };
  // Baye loosens (and slides over) from the moment Chloe comes, and curls up
  // again once she has gone.
  const wantB = M.ph === 'curl' ? 0 : M.ph === 'stand' ? 0 : 1;
  if (M.ph !== 'curl' && !curled && M.lie == null && M.ph !== 'stand') { rvmEnd('you moved'); return; }
  M.bk = Math.max(0, Math.min(1, (M.bk || 0) + (wantB ? dt : -dt) / P.loosen));
  // Your hand off your knee and on to your hip only once she is down beside
  // you (it was in her way coming down, MEASURED), and back as she gets up.
  const wantA = M.ph === 'settle' || M.ph === 'on';
  M.armK = Math.max(0, Math.min(1, (M.armK || 0) + (wantA ? dt : -dt) / 1.1));
  if (M.bk > 0.6 && !M.hand) {
    const BS = rvsBayeSkin(2);
    M.hand = rvsHandSpot(BS);
  }
  if (M.hand && M.bk > 0) {
    // Her chest moves with her breath and her slide: the spot rides her chest bone.
    const C = revBone('chest', new THREE.Vector3());
    if (C && M.handRel == null) M.handRel = M.hand.T.clone().sub(C);
    if (C && M.handRel) M.hand.T = C.clone().add(M.handRel);
  }
  rvsBayePose(M, dt);
  rvsBreath(M, dt);
  if (M.lie != null) rvsChloePose(M, dt);
  M.t2 = (M.t2 || 0) + dt;
  if (M.ph === 'curl') {
    if (curled && (!rev.dom.order || rev.dom.order.id !== 'curl')) { M.ph = 'go'; M.t0 = M.t; return; }
    if (!rev.dom.order && !M.asked && M.t > 1.0) { rvmSay('later', true); rvmEnd('not curled'); return; }
    if (M.t > P.curlWait) { rvmEnd('not curled in time'); return; }
    return;
  }
  if (M.ph === 'go') {
    if (!M.seat) {
      if (jadrija.curlShift) jadrija.curlShift(P.shift0, P.shiftRate);
      M.seat = rvsSeat();
      if (!M.seat) { rvmEnd('no edge'); return; }
      revGo(M.seat.stand.x, M.seat.stand.z);
      rev.ch.face = new THREE.Vector3(M.seat.stand.x + M.seat.out.x * 3, rev.ch.y, M.seat.stand.z + M.seat.out.z * 3);
    }
    // Her front measured off her mesh once she has loosened, and the shift set by it.
    if (M.bk >= 1 && !M.fitted && M.t - M.t0 > P.loosen + 0.3) {
      M.fitted = true;
      const s = rvsFitShift(M);
      // And while she gets in, a little further still (`bayeExtra`): you
      // shuffle back into her once she is down.
      if (s != null) M.fitShift = Math.max(0, Math.min(0.40, s));
      if (M.fitShift != null && jadrija.curlShift) jadrija.curlShift(M.fitShift + P.bayeExtra, P.shiftRate);
    }
    let dy = M.seat.yaw - rev.ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const there = revAt() && Math.abs(dy) < 0.12;
    if ((there || M.t - M.t0 > 9) && M.fitted) {
      // Settled where she is now? The seat again off where your waist is.
      const S2 = rvsSeat();
      if (S2) M.seat.seat = S2.seat;
      M.ph = 'sit'; M.t0 = M.t; rvmWant('sit');
      Bd.sit = { from: new THREE.Vector3(rev.ch.x, rev.ch.y, rev.ch.z), to: M.seat.seat.clone(), k: 0 };
    }
    return;
  }
  if (M.ph === 'sit') {
    const tt = M.t - M.t0;
    if (Bd.sit) Bd.sit.k = Math.min(1, tt / P.sitT);
    // Her beanie off as she sits (1.575.0): her right hand up to her crown,
    // and it comes away with the hand. Nobody lies down in bed in a wool hat.
    rvsHatHand(M, tt, false);
    const C = jadrija.curlShift ? jadrija.curlShift() : null;
    const settled = !C || !C.mark || Math.hypot(C.at[0] - C.mark[0], C.at[1] - C.mark[1]) < 0.02;
    if (tt > P.sitT + 0.35 && (settled || tt > 5) && Bd.mode === 'sit') {
      M.ph = 'swing'; M.t0 = M.t;
      M.seatAt = you.mesh.position.clone(); M.seatQ = you.mesh.quaternion.clone();
      // Her legs up: sat along the cot facing its foot, a little further on.
      const Xa = rvsBayeAxes(), Gc = rvmCotGeom();
      const foot = Xa ? Xa.up.clone().negate() : new THREE.Vector3(0, 0, 1);
      M.longYaw = Math.atan2(-foot.z, foot.x);
      M.longAt = M.seatAt.clone().addScaledVector(Gc && Gc.out ? Gc.out : new THREE.Vector3(), -P.longIn);
      M.legsDir = 0;
      M.W = { a: P.back0 + P.wide, c: P.feet };
      // The two clips' roots: the same pose below the root on this rig, but
      // not the same height (see `rvsLiePlace`). Measured off both, now.
      const Bf = rvsBaye();
      if (Bf) {
        const qa = new Float32Array(4 * 64), ta = new Float32Array(3), qb = new Float32Array(4 * 64), tb = new Float32Array(3);
        if (you.fig.sample('fetalHeld', 0, qa, ta) && Bf.fig.sample('fetalHeld', 0, qb, tb)) {
          M.rootD = new THREE.Vector3(tb[0] - ta[0], tb[1] - ta[1], tb[2] - ta[2]);
        }
      }
      M.lie = 0;
      Bd.mode = 'spoon'; Bd.want = 'spoon'; Bd.t = 0;
      rvmNote('body sit → spoon');
    }
    return;
  }
  if (M.ph === 'swing') {
    M.lie = Math.min(1, (M.t - M.t0) / P.swingT);
    rvsMoveGap(M, dt);
    if (M.lie >= 1 && M.fitShift != null && jadrija.curlShift) jadrija.curlShift(M.fitShift, P.shiftRate * 0.7);
    if (M.lie >= 1) { M.ph = 'settle'; M.t0 = M.t; M.gapLog = []; revSay('spoon', true, RVM_SAY.spoon[Math.random() < 0.5 ? 0 : 1], { still: revStill.dom }); }
    return;
  }
  if (M.ph === 'settle' || M.ph === 'on') {
    M.lie = 1;
    M.tuck = Math.min(1, (M.tuck || 0) + dt / P.tuckT);
    M.tOn = (M.tOn || 0) + dt;
    // In close: the measured gap, every few frames while settling and twice a
    // second after, the offset moved by what it is off.
    M.gapT = (M.gapT || 0) - dt;
    if (M.gapT <= 0) {
      M.gapT = M.ph === 'settle' ? 0.06 : M.kissing ? 0.1 : 0.5;
      const R = rvsGapNow(M, M.ph === 'settle' ? 3 : 2);
      if (R) {
        // Her body (trunk, legs, under arm) and her head, apart: while she
        // kisses you her lips are meant to touch.
        const by = R.G.by, of = (k) => (by[k] ? Math.min(by[k].d, by[k].s) : 9);
        const body = Math.min(of('trunk'), of('legs'), of('armL'), of('handL'));
        const head = of('head');
        // (Her head keeps its own distance — the nuzzle, `headMin` — so where
        // she lies is set by her body alone.)
        const g = body;
        M.lastGap = R;
        if (M.ph === 'settle') {
          const err = P.gap - g;
          M.W.a = Math.max(P.backMin, Math.min(P.backMax + P.wide, M.W.a + Math.max(-P.slide, Math.min(P.slide, err * 0.75))));
        } else if (!M.kissing && (M.kissOff || 0) <= 0) {
          // Held, she stays in close: back off a touch if her body is on you,
          // in again if it has drifted off (a kiss turns her shoulders into
          // you; it never moves where she lies — MEASURED: three kisses had
          // walked her 8 cm back before this).
          M.W.a = Math.max(P.backMin, Math.min(P.backMax, M.W.a + Math.max(-0.01, Math.min(0.03, (P.gap - body) * 0.5))));
        }
        if (M.ph === 'on' && !M.kissing && (M.kissOff || 0) <= 0) {
          M.gapMin = Math.min(M.gapMin == null ? 9 : M.gapMin, g);
          M.gapLog.push([+M.t.toFixed(1), +body.toFixed(4), +head.toFixed(4), R.G.all.inN, +R.H.all.d.toFixed(4), +R.H.all.s.toFixed(4)]);
          if (M.gapLog.length > 400) M.gapLog.shift();
        }
        if (M.kissing && by.head) M.kissMin = Math.min(M.kissMin, by.head.d);
        if (!M.kissing) M.headGap = head;
      }
    }
    if (M.ph === 'settle' && M.t - M.t0 > P.settleT) {
      M.ph = 'on'; M.t0 = M.t; M.nextKiss = M.t + P.kiss[0] + Math.random() * (P.kiss[1] - P.kiss[0]);
      M.nextLine = M.t + 22 + Math.random() * 12;
      // Your eyes down to your two hands, once.
      if (M.dorsum) { rev.lookAtP = M.dorsum.clone(); rev.lookTo = 1.3; }
    }
    if (M.ph !== 'on') return;
    // The hand-hold: her palm against the back of your hand.
    if (M.dorsum) {
      const pm = rvmPalm('R', new THREE.Vector3());
      if (pm) {
        const e = pm.distanceTo(M.dorsum); M.handErr = e;
        if (M.t - M.t0 > 1.5 && e > (M.handErrMax || 0)) { M.handErrMax = e; M.handErrAt = [+M.t.toFixed(2), !!M.kissing, +(M.reach || 0).toFixed(2)]; }
      }
    }
    // Now and then a kiss on your shoulder — not in the aftercare's first seconds.
    if (!M.kissing && M.t > M.nextKiss && !M.care) { M.kissing = true; M.kissT = 0; M.kissMin = 9; }
    if ((M.kissOff || 0) > 0) M.kissOff -= dt;
    if (M.kissing) {
      M.kissT += dt;
      if (!M.kissed && M.kissMin < 0.012) {
        M.kissed = true; M.kisses = (M.kisses || 0) + 1;
        if (audio && audio.kiss) audio.kiss();
        if (Math.random() < 0.45) rvmSay('nuzzle');
      }
      if (M.kissT > P.kissT) {
        M.kissing = false; M.kissed = false; M.kissOff = 1.2;
        (M.kissLog = M.kissLog || []).push(+M.kissMin.toFixed(4));
        M.nextKiss = M.t + P.kiss[0] + Math.random() * (P.kiss[1] - P.kiss[0]);
      }
    }
    if (!M.care && M.t > M.nextLine) { M.nextLine = M.t + 30 + Math.random() * 20; rvmSay('spoon'); }
    if (M.holdFor == null) M.holdFor = M.asked ? P.hold : P.holdOwn[0] + Math.random() * (P.holdOwn[1] - P.holdOwn[0]);
    const longest = M.care ? P.care : M.holdFor;
    if (M.t - M.t0 > longest) rvmSpoonUp(M, M.care ? 'aftercare held' : 'time');
    return;
  }
  if (M.ph === 'up') {
    // Back off you first (the first third), then up on to the edge.
    const tu = M.t - M.t0, slideT = P.upSlide;
    M.tuck = Math.max(0, (M.tuck || 0) - dt / (P.tuckT * 0.5));
    if (M.W) M.W.a = M.upA + P.wide * Math.min(1, tu / slideT);
    M.lie = tu < slideT ? 1 : Math.max(0, 1 - (tu - slideT) / P.upT);
    rvsMoveGap(M, dt);
    if (M.lie <= 0) {
      // Sat on the edge again, as she came: the sit's own way up from here.
      M.lie = null; M.ph = 'stand'; M.t0 = M.t;
      Bd.mode = 'sit'; Bd.want = 'sit'; Bd.t = 0;
      Bd.sit = { from: new THREE.Vector3(M.seat.stand.x, rev.ch.y, M.seat.stand.z), to: M.seat.seat.clone(), k: 1 };
      rvsLegsFree(you.fig);
      for (const n of ['chest', 'spine03', 'spine02']) you.fig.aim(n, 0, 0, 1, 0);
      M.reachOn = false; M.reach = 0;
      rvmNote('body spoon → sit');
    }
    return;
  }
  if (M.ph === 'stand') {
    // And back on, sat on the edge again before she stands.
    rvsHatHand(M, M.t - M.t0, true);
    if (M.t - M.t0 > 0.35 && Bd.want !== 'stand') rvmWant('stand');
    if (jadrija.curlShift && M.t - M.t0 > 0.6) jadrija.curlShift(0, P.shiftRate);
    if (Bd.mode === 'stand' && M.t - M.t0 > 0.6 && M.bk <= 0) rvmSpoonDone(M);
  }
}

/**
 * On her way down on to the cot or up off it, her body against yours, ten
 * times a second (her right arm and hand left out: they are reaching for you).
 * The least of it is `M.wayGap`, signed (negative: into you).
 */
function rvsMoveGap(M, dt) {
  M.wayT = (M.wayT || 0) - dt;
  if (M.wayT > 0) return;
  M.wayT = 0.1;
  const R = rvsGapNow(M, 3);
  if (!R) return;
  const by = R.G.by;
  let g = 9, at = null;
  for (const k of ['trunk', 'legs', 'head', 'armL', 'handL']) if (by[k] && Math.min(by[k].d, by[k].s) < g) { g = Math.min(by[k].d, by[k].s); at = k + ' into ' + by[k].sher + ' ' + JSON.stringify(by[k].sat); }
  if (g < (M.wayGap == null ? 9 : M.wayGap)) { M.wayGap = g; M.wayAt = at + ' @' + M.ph + ' ' + (M.lie || 0).toFixed(2); }
}

/**
 * HER BEANIE (1.575.0). Off as she sits on the edge to lie down with you, on
 * again sat on the edge getting up: her right hand to her crown and away,
 * over `hatT` s, the hat going (or coming) with the hand at the top of it.
 * Her boots stay on — they are part of her body mesh (`boots()` in
 * tools/blender/human_mh.py), and there is no leg drawn inside them to show.
 */
function rvsHatHand(M, tt, on) {
  const T = RVM_SPOON.hatT;
  if (tt > T) { if (!on) M.hatOff = true; else M.hatOff = false; return; }
  const u = tt / T, k = Math.sin(Math.PI * Math.min(1, u));
  if (u > 0.5) M.hatOff = !on;
  const hi = you.fig.boneIndex('head');
  if (hi < 0 || k < 0.02) return;
  const H = you.fig.boneAt(hi, new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld);
  const hq = you.fig.boneTurn(hi, new THREE.Quaternion()).premultiply(you.mesh.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hq), fw = new THREE.Vector3(1, 0, 0).applyQuaternion(hq);
  // Over her crown, a little back, palm down on it — and up off it as it goes.
  const C = H.clone().addScaledVector(up, 0.17 + (u > 0.5 ? 0.06 * (u - 0.5) * 2 : 0)).addScaledVector(fw, -0.02);
  const { r } = rvmAxes(rev.ch.yaw);
  rvmAsk('R', { C, n: up.clone(), d: fw.clone(), pole: r.clone().add(new THREE.Vector3(0, -0.2, 0)), cock: 0.1, shape: 'soft', rate: 6 + 10 * k });
}
/** Whether her beanie is off (the spoon has taken it off her). */
function rvmHatOff() {
  const M = rvm.move;
  return !!(M && M.id === 'spoon' && M.hatOff && rev.on);
}

/** Up off the cot, the way she came. `why` for the trace; your ask after, if any. */
function rvmSpoonUp(M, why) {
  if (M.ph === 'up' || M.ph === 'stand') return;
  M.outWhy = why;
  M.kissing = false;
  if (M.lie == null) { rvmSpoonDone(M); return; }
  M.ph = 'up'; M.t0 = M.t; M.upA = M.W ? M.W.a : 0;
  // And you make room for her to sit up, as you did for her to lie down.
  if (M.fitShift != null && jadrija.curlShift) jadrija.curlShift(M.fitShift + RVM_SPOON.bayeExtra, RVM_SPOON.shiftRate);
  if (!M.care) rvmSay('spoonup', true);
  rvmTrace({ pick: 'spoon:up', why });
}

/** Done: everything of the spoon off both of you, and then whatever you asked for. */
function rvmSpoonDone(M) {
  rvsBreathOff(M);
  const B = rvsBaye();
  if (B) { rvsLegsFree(B.fig); for (const n of ['armUR', 'armLR', 'handR']) B.fig.aim(n, 0, 0, 1, 0); }
  if (jadrija.curlShift) jadrija.curlShift(0, RVM_SPOON.shiftRate);
  if (M.lie != null && you && you.fig) rvsLegsFree(you.fig);
  M.lie = null;
  rvm.lastSpoon = rvmSpoonReport(M);
  M.done = true;
  rvm.spoonCool = rev.clock + 60;
  const q = M.queue, qm = M.queueMove;
  rvmEnd(M.outWhy || 'done');
  if (q && typeof revAsk === 'function') revAsk(q);
  else if (qm) rvmStart(qm, 'asked');
}

/** What the spoon measured, for a probe and the trace. */
function rvmSpoonReport(M) {
  if (!M) return null;
  const G = M.lastGap;
  return { ph: M.ph, t: +(M.t || 0).toFixed(1), why: M.why, out: M.outWhy || null, care: !!M.care,
    W: M.W ? { a: +M.W.a.toFixed(3), c: +M.W.c.toFixed(3) } : null, fit: M.fit || null,
    gap: G ? { all: G.G.all, by: G.G.by, hand: G.H.all, spanB: G.spanB, spanC: G.spanC } : null,
    gapMin: M.gapMin != null ? +M.gapMin.toFixed(4) : null,
    handErr: M.handErr != null ? +M.handErr.toFixed(4) : null, handErrMax: M.handErrMax != null ? +M.handErrMax.toFixed(4) : null,
    faceD: M.faceD != null ? +M.faceD.toFixed(3) : null, kisses: M.kisses || 0, kissMin: M.kissLog || [],
    breath: M.br ? { f: +M.br.f.toFixed(3), dphi: +M.br.dphi.toFixed(3), n: M.br.trace.length } : null,
    bk: +(M.bk || 0).toFixed(2), lie: M.lie == null ? null : +M.lie.toFixed(2), queue: M.queue || null,
    handTh: M.handTh != null ? +M.handTh.toFixed(4) : null, handErrAt: M.handErrAt || null, wayGap: M.wayGap != null ? +M.wayGap.toFixed(4) : null, wayAt: M.wayAt || null,
    armCl: M.armCl != null ? +M.armCl.toFixed(4) : null, armA: M.armA != null ? +M.armA.toFixed(2) : null,
    predErr: M.predErr || null, legErr: M.legErr || null, bayeErr: M.bayeErr != null ? +M.bayeErr.toFixed(4) : null, bayeSolveErr: M.bayeSolveErr != null ? +M.bayeSolveErr.toFixed(4) : null, gapLog: M.gapLog ? M.gapLog.slice(-8) : null };
}

/** Your ask while she is on the cot with you: she gets up first, and then it is done. */
function rvmSpoonAsk(name) {
  const M = rvm.move;
  if (!M || M.id !== 'spoon') return false;
  if (name === 'fetal' && (M.ph === 'curl')) return false;
  M.queue = name;
  rvmSpoonUp(M, 'you asked: ' + name);
  return true;
}

// ── the frame ───────────────────────────────────────────────────────────────

/** Her root this frame, sitting: on the mattress (the move's), eased from where she stood. */
function rvmSitK() {
  const B = rvm.body;
  if (!B.sit) return 0;
  if (B.mode === 'sit' || B.want === 'sit') return B.sit.k;
  if (B.mode === 'stand' && B.was === 'sit' && B.t < RVM.riseT) return 1 - B.t / RVM.riseT;
  B.sit = null;
  return 0;
}
function rvmSitAt() {
  const B = rvm.body;
  const k = rvmSitK();
  if (!B.sit || k <= 0) return null;
  const e = k * k * (3 - 2 * k);
  return new THREE.Vector3().lerpVectors(B.sit.from, B.sit.to, e);
}

/** Her legs, sitting: the feet put on the floor in front of the edge. */
function rvmSitLegs(kSpoon = null) {
  const f = you.fig;
  // Lying behind you, her legs are the spoon's (`rvsChloePose`) — which asks
  // for these, eased off, while she swings them up on to the cot.
  if (kSpoon == null && rvmSpoonOn()) return;
  const k = kSpoon != null ? kSpoon : Math.min(1, rvmSitK() * 1.2);
  if (k <= 0.001 || !jadrija.hingeArm) { rvmLegsFree(); return; }
  const fy = rev.ch.y;
  const M = you.mesh.matrixWorld;
  _mM.copy(M).invert();
  const R = f.bindRest(), L = f.local(), lq = L.q;
  for (const s of ['L', 'R']) {
    const iu = f.boneIndex('legU' + s), il = f.boneIndex('legL' + s), ia = f.boneIndex('foot' + s);
    const ip = f.bones[iu].parent;
    const S = f.boneAt(iu, new THREE.Vector3());
    const bP = new THREE.Quaternion(R.bindQ[4 * ip], R.bindQ[4 * ip + 1], R.bindQ[4 * ip + 2], R.bindQ[4 * ip + 3]);
    const qP = f.boneTurn(ip, new THREE.Quaternion()).multiply(bP);
    const qU = new THREE.Quaternion(lq[4 * iu], lq[4 * iu + 1], lq[4 * iu + 2], lq[4 * iu + 3]).premultiply(qP);
    const E = new THREE.Vector3(R.t[3 * il], R.t[3 * il + 1], R.t[3 * il + 2]).applyQuaternion(qU).add(S);
    const qL = new THREE.Quaternion(lq[4 * il], lq[4 * il + 1], lq[4 * il + 2], lq[4 * il + 3]).premultiply(qU);
    const W = new THREE.Vector3(R.t[3 * ia], R.t[3 * ia + 1], R.t[3 * ia + 2]).applyQuaternion(qL).add(E);
    // The knee's hinge: across her, figure space.
    const hinge = new THREE.Vector3(0, 0, 1);
    // The ankle on the floor a little in front of the knee and out to its side.
    const sg = s === 'R' ? 1 : -1;
    const goalW = new THREE.Vector3(0.36, 0, 0.12 * sg).applyMatrix4(M);
    goalW.y = fy + 0.08;
    const G = goalW.applyMatrix4(_mM);
    G.lerpVectors(W, G, k);
    jadrija.hingeArm(f, 'legU' + s, 'legL' + s, S, E, W, hinge, G, new THREE.Vector3(1, 0.2, 0.15 * sg));
  }
  rvm.legsOn = true;
}
function rvmLegsFree() {
  if (!rvm.legsOn || !you || !you.fig) return;
  for (const n of ['legUL', 'legLL', 'legUR', 'legLR']) you.fig.aim(n, 0, 0, 1, 0);
  rvm.legsOn = false;
}

/**
 * Each frame, from `revTick`, after her figure is driven and the toys have
 * had her right hand: the measure of the last contact, the move, her arms,
 * her look, your flinch.
 */
function rvmTick(dt) {
  if (!rev.on || !you || !you.fig) return;
  if (typeof rvkPlace === 'function') rvkPlace();
  const B = rvm.body;
  // Kneeling after it, a little, then up — unless something wants her down.
  if (rvm.downFor > 0) {
    rvm.downFor -= dt;
    if (rvm.downFor <= 0 && !rvm.move && rev.arm.mode !== 'spank') { rvmWant('stand'); B.bowTo = 0; B.wTo = 0; B.turnTo = 0; }
  } else if (!rvm.move && rev.arm.mode !== 'spank' && rev.arm.mode !== 'care' && B.want !== 'stand') {
    rvmWant('stand'); B.bowTo = 0; B.wTo = 0;
  }
  if (!rvm.move && rev.arm.mode !== 'spank') { B.bowTo = rvm.downFor > 0 ? B.bowTo * 0.5 : 0; if (B.mode === 'stand') B.wTo = 0; }
  rvmMoveTick(dt);
  // You easing back into your own curl after a spoon that never got her on
  // the cot (1.573.0).
  const SF = rvm.spoonFade;
  if (SF && rvm.move !== SF) {
    SF.bk = Math.max(0, SF.bk - dt / RVM_SPOON.loosen);
    rvsBayePose(SF, dt);
    if (SF.br) rvsBreath(SF, dt);
    if (SF.bk <= 0) { rvsBreathOff(SF); rvm.spoonFade = null; }
  }
  // Her hands on her hips while an order waits on you.
  const D = rev.dom;
  // (Two orders in three: the rest she just watches you.)
  if (!rvm.move && D.order && rev.arm.mode == null && !rev.care && rev.clock - D.order.t0 > 2.6
    && !(typeof rvkBusy === 'function' && rvkBusy()) && !(typeof rvkHandFull === 'function' && rvkHandFull())) {
    if (D.order.hips == null) D.order.hips = Math.random() < 0.67;
    if (D.order.hips) rvmStart('hips', 'waiting');
  }
  rvmSitLegs();
  rvmArms(dt);
  rvmYourTilt(dt);
  // Her look: at your face; while her hand goes to you, at where it goes.
  let T = null;
  if (rev.arm.mode === 'spank' && rev.arm.at && rev.arm.ph !== 'go') T = rev.arm.at.T;
  else if (rvm.move && rvm.move.id === 'hold' && rvm.move.spot && rvm.move.ph !== 'go' && rev.clock % 5 < 2) T = rvm.move.spot.T;
  else if (typeof rvkBeltRound === 'function' && rvkBeltRound() && typeof rvkPlanP !== 'undefined' && rvkPlanP.aim && rvk.belt.ph !== 'go') T = rvkPlanP.aim;
  else if (rvmSpoonOn() && rvm.move.lookT && rvm.move.lie > 0.3) T = rvm.move.lookT;
  else T = (typeof rvtLookAt === 'function' ? rvtLookAt() : null) || rvmYourFace(new THREE.Vector3());
  // Not over her shoulder while she walks away: ahead, then.
  if (T && rev.ch.goal && rev.ch.sp > 0.3) {
    const { f } = rvmAxes(rev.ch.yaw);
    const dx = T.x - rev.ch.x, dz = T.z - rev.ch.z;
    if ((dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1) < -0.2) T = null;
  }
  rvmLook(T, dt);
  rvmFlinchTick(dt);
}

/**
 * The camera's share (from `revCamera`, first person): your chin lifted by
 * her hand, your head held back by your hair — a pitch up toward her and a
 * little roll. Answers [pitch, roll] in rad.
 */
function rvmCamTilt() {
  return [0.07 * rvm.chin + 0.12 * rvm.nape, 0.03 * rvm.nape];
}

/** Your body's answer to her hand in your hair: your upper back eased back. */
function rvmYourTilt(dt) {
  const f = jadrija && jadrija.figure;
  if (!f) return;
  const k = rvm.nape;
  rvm.napeK = damp(rvm.napeK || 0, k, 6, dt);
  if (rvm.napeK < 0.004) { if (rvm.napeOn) { f.aim('chest', 0, 0, 1, 0); rvm.napeOn = false; } return; }
  rvm.napeOn = true;
  // Head and chest back: about your own across-axis (+z, the figure's), +.
  f.aim('chest', 0, 0, 1, 0.16 * rvm.napeK);
}

/** The safeword's part: every move ends, her hands come off you. */
function rvmSafe() {
  // On top of you (1.586.0): `rvpSafe` has let go and has her getting off.
  if (typeof rvpOn === 'function' && rvpOn()) { rvm.pend = null; rvm.nape = 0; rvm.chin = 0; return; }
  // Lying with you, she stays: the spoon is the aftercare (1.573.0).
  if (rvmSpoonOn() && rvm.move.ph !== 'up' && rvm.move.ph !== 'stand') {
    const S = rvm.move;
    S.care = true; S.kissing = false;
    if (S.ph === 'on') S.t0 = S.t;
    rvm.pend = null;
    return;
  }
  if (rvm.move) rvmEnd('safeword');
  rvm.pend = null;
  rvm.nape = 0; rvm.chin = 0;
  rvm.body.bowTo = 0; rvm.body.turnTo = 0; rvm.body.pushTo = 0; rvm.body.wTo = 0;
  if (rvm.body.mode === 'sit') rvmWant('stand');
}

/** Swapped back or left: everything of hers off. */
function rvmClear() {
  // Off you, now (1.586.0).
  if (typeof rvpClear === 'function') rvpClear();
  // Lying behind you, or you loosened for her: all of it off you (1.573.0).
  const SM = rvm.move && rvm.move.id === 'spoon' ? rvm.move : rvm.spoonFade;
  if (SM) {
    rvsBreathOff(SM);
    const Bf = rvsBaye();
    if (Bf) { rvsLegsFree(Bf.fig); for (const n of ['armUR', 'armLR', 'handR']) Bf.fig.aim(n, 0, 0, 1, 0); }
    if (jadrija && jadrija.curlShift) jadrija.curlShift(0, RVM_SPOON.shiftRate);
    if (you && you.fig) rvsLegsFree(you.fig);
    rvm.lastSpoon = rvmSpoonReport(SM);
  }
  rvm.spoonFade = null;
  rvm.move = null; rvm.pend = null;
  rvm.nape = 0; rvm.chin = 0; rvm.downFor = 0;
  rvmArmFree('R'); rvmArmFree('L');
  rvmFingers('R', 0, 0); rvmFingers('L', 0, 0);
  rvmLegsFree();
  const f = you && you.fig;
  if (f) { f.aim('neck', 0, 1, 0, 0); f.aim('head', 0, 1, 0, 0); f.aim('spine01', 0, 0, 1, 0); f.aim('spine02', 0, 0, 1, 0); f.aim('spine03', 0, 0, 1, 0); f.aim('chest', 0, 0, 1, 0); }
  _lkA.identity();
  rvm.look.on = false; rvm.look.at = 0;
  if (you && you.eyes) you.eyes(null);
  Object.assign(rvm.body, { mode: 'stand', want: 'stand', t: 9, bow: 0, bowTo: 0, w: 0, wTo: 0, turn: 0, turnTo: 0, push: 0, pushTo: 0, sit: null, was: null });
  const b = jadrija && jadrija.figure;
  if (b) { b.aim('spine01', 0, 0, 1, 0); b.aim('spine02', 0, 0, 1, 0); b.aim('chest', 0, 0, 1, 0); }
  rvm.flinch.on = false; rvm.flinch.x = 0; rvm.flinch.v = 0;
}

/** `__fr.reverse.moves` — see 49-reverse.js. */
const rvmApi = {
  start: (id, why = 'probe') => rvmStart(id, why),
  ask: (id) => rvmAskMove(id),
  gap: () => ({ now: rvm.move ? +rvmGapNow().toFixed(3) : null, last: rvm.lastGap || null,
    move: rvm.move ? { id: rvm.move.id, ph: rvm.move.ph, gap: +(rvm.move.gap || 0).toFixed(3), kissD: rvm.move.kissD != null ? +rvm.move.kissD.toFixed(3) : null, kissed: !!rvm.move.kissed } : null,
    push: +(rvm.body.push || 0).toFixed(3), bow: +rvm.body.bow.toFixed(2), mode: rvm.body.mode }),
  end: () => { rvmEnd('probe'); return true; },
  /**
   * The spoon (1.573.0): what it measured — the gap (by her region, signed),
   * the hand-hold's error, her face off your nape, the kisses, the breath —
   * of the one going, or the last. `spoonGap(1)` measures it now at full
   * density; `spoonBreath(n)` the breath's trace, [t, her rate, phase
   * difference, your chest, hers, phase of the spoon].
   */
  spoon: () => (rvm.move && rvm.move.id === 'spoon' ? rvmSpoonReport(rvm.move) : rvm.lastSpoon || null),
  spoonGap: (stride = 1) => { const R = rvsGapNow(rvm.move, stride); return R ? { all: R.G.all, by: R.G.by, hand: R.H.all, handBy: R.H.by, spanB: R.spanB, spanC: R.spanC } : null; },
  spoonBreath: (n = 200) => (rvm.move && rvm.move.br ? rvm.move.br.trace.slice(-n) : null),
  /**
   * Debug: your eyes (the walker's look) on to a point now — 'hands' (yours
   * and hers, on your chest), 'her' (her face), or [x, y, z] — plus `dy`, `dp`
   * rad more. Answers [yaw, pitch].
   */
  spoonLook: (what = 'hands', dy = 0, dp = 0) => {
    const M = rvm.move, Y = ground && ground.you;
    if (!Y) return null;
    let p = Array.isArray(what) ? new THREE.Vector3(what[0], what[1], what[2]) : null;
    if (what === 'hands') p = M && M.dorsum ? M.dorsum.clone() : revBone('handR', new THREE.Vector3());
    if (what === 'her') p = revChloeHead(new THREE.Vector3());
    if (!p) return null;
    const c = camera.position;
    Y.yaw = Math.atan2(-(p.x - c.x), -(p.z - c.z)) + dy;
    Y.pitch = Math.atan2(p.y - c.y, Math.hypot(p.x - c.x, p.z - c.z)) + dp;
    return [+Y.yaw.toFixed(3), +Y.pitch.toFixed(3)];
  },
  /** Debug: a close camera on 'hands' or 'heads' (from the wall side, or `from` 'room'), or null. */
  spoonView: (what = 'hands', from = 'wall', d = 0.55) => {
    const M = rvm.move;
    if (!what) { rev.debugCam = null; return null; }
    const X = rvsBayeAxes();
    if (!X) return null;
    const T = what === 'hands' ? (M && M.dorsum ? M.dorsum.clone() : revBone('handR', new THREE.Vector3()))
      : revBone('neck', new THREE.Vector3());
    if (!T) return null;
    const out = X.fw.clone().multiplyScalar(from === 'room' ? -1 : 1);
    const c = T.clone().addScaledVector(out, d).add(new THREE.Vector3(0, d * 0.55, 0)).addScaledVector(X.up, from === 'room' ? 0.15 : -0.10);
    rev.debugCam = [c.x, c.y, c.z, T.x, T.y, T.z];
    return rev.debugCam.map((x) => +x.toFixed(3));
  },
  /**
   * Debug: both right arms (shoulder, elbow, wrist, palm) and the targets, in
   * your own frame off your chest bone — [your front, up your long axis, your
   * right (up, lying)] in cm.
   */
  spoonArms: () => {
    const M = rvm.move, Bf = rvsBaye();
    const C = revBone('chest', new THREE.Vector3());
    if (!Bf || !C) return null;
    const fr = rvsFrame(Bf.fig), q = Bf.mesh.quaternion;
    const fw = fr.fw.applyQuaternion(q), up = fr.up.applyQuaternion(q), rt = fr.rt.applyQuaternion(q);
    const L = (v) => { if (!v) return null; const d = v.clone().sub(C); return [Math.round(d.dot(fw) * 100), Math.round(d.dot(up) * 100), Math.round(d.dot(rt) * 100)]; };
    const yb = (n) => revBone(n, new THREE.Vector3());
    const yc = (n) => { const i = you.fig.boneIndex(n); return you.fig.boneAt(i, new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld); };
    return { baye: { sh: L(yb('armUR')), el: L(yb('armLR')), wr: L(yb('handR')), palm: L(rvmPalm('R', new THREE.Vector3(), Bf)) },
      chloe: { sh: L(yc('armUR')), el: L(yc('armLR')), wr: L(yc('handR')), palm: L(rvmPalm('R', new THREE.Vector3())) },
      spot: M && M.hand ? L(M.hand.T) : null, dorsum: M && M.dorsum ? L(M.dorsum) : null, chestToSpine2: L(yb('spine02')) };
  },
  /** Debug: the spoon's numbers, merged. */
  spoonTune: (o) => Object.assign(RVM_SPOON, o || {}),
  spank: (n = 1, hold = false) => rvmSpankStart(n, 'probe', { hold }),
  /** Debug: a spank spot now and her plan for it, with why places were refused. */
  spotPlan: () => {
    const v = revView(); const S = v ? rvmSpankSpot(v) : null;
    if (!S) return null;
    const why = {}; const P = rvmPlan([{ s: 'R', T: S.T, n: S.n }], { why });
    const G = rvmCotGeom();
    return { T: rvmV(S.T), n: rvmV(S.n), reg: S.hit ? S.hit.reg : null, o: rvmV(S.o), out: G && rvmV(G.out), mid: G && rvmV(G.mid),
      plan: P ? { x: +P.x.toFixed(2), z: +P.z.toFixed(2), mode: P.mode, bow: +P.bow.toFixed(2) } : null, why, ch: [rev.ch.x, rev.ch.z] };
  },
  /** The contacts measured: palm against the spot, m. `reset` clears. */
  acc: (reset = false) => { const a = rvm.acc.slice(); if (reset) rvm.acc.length = 0; return a; },
  stats: () => {
    const a = rvm.acc;
    const by = {};
    for (const e of a) { const k = e.phase || e.ctx; (by[k] = by[k] || []).push(e.err); }
    const o = {};
    for (const k of Object.keys(by)) {
      const L = by[k].slice().sort((x, y) => x - y);
      o[k] = { n: L.length, mean: +(L.reduce((x, y) => x + y, 0) / L.length * 100).toFixed(2), max: +(L[L.length - 1] * 100).toFixed(2),
        med: +(L[Math.floor(L.length / 2)] * 100).toFixed(2) };
    }
    return o;
  },
  state: () => ({ body: { mode: rvm.body.mode, want: rvm.body.want, t: +rvm.body.t.toFixed(2), bow: +rvm.body.bow.toFixed(2),
    w: +rvm.body.w.toFixed(2), turn: +rvm.body.turn.toFixed(2) },
  move: rvm.move ? { id: rvm.move.id, ph: rvm.move.ph, t: +rvm.move.t.toFixed(1), reach: rvm.move.reach || null } : null,
  plan: rvm.plan, k: { R: +rvm.k.R.toFixed(2), L: +rvm.k.L.toFixed(2) }, hand: Object.assign({}, rvm.hand),
  on: Object.assign({}, rvm.on), look: +rvm.look.at.toFixed(2), last: rvm.last || null, nape: +rvm.nape.toFixed(2), chin: +rvm.chin.toFixed(2),
  palm: rvmV(rvmPalm('R', new THREE.Vector3())), arm: rev.arm.mode ? { ph: rev.arm.ph, n: rev.arm.n, tgt: rvmV(rev.arm.at && rev.arm.at.T) } : null,
  solves: rvm.solves, log: rvm.log.slice(-12),
  fb: { R: rvmV(rvm.fb.R.e), sent: rvmV(rvm.fb.R.sent), ok: rvm.fb.R.ok }, req: rvm.qs && rvm.qs.R ? rvmV(rvm.qs.R.C) : null }),
};

// Her lines for the moves, with the rest of hers (49-reverse.js's `revSay`).
if (typeof REV_SAY !== 'undefined') Object.assign(REV_SAY, RVM_SAY);
// Her soft order before she lies down with you (1.573.0): never one of her
// own picks (no `ctx`), never punished, and kept by you curling up on your side.
if (typeof REV_ORDERS !== 'undefined') {
  REV_ORDERS.curl = { ctx: {}, w: 0, key: 'Shift+7', soft: true, wait: 16,
    ok: (v) => v.phase === 'fetalHeld' && v.onBed, say: "C'mere... curl up for me.",
    hud: ['Sklupčaj se za mene.', 'Curl up for me.', 'Mets-toi en boule pour moi.'] };
}
/** The scene's part of the spoon (`revScene`): lying with you, and whether it is the aftercare. */
function rvmScene(o) {
  if (rvmSpoonOn()) o.rev_spoon = rvm.move.care ? 'care' : 'on';
}
/** Your breath in your camera, lying with her: −0.5 out .. 0.5 in, or 0. */
function rvmCamBreath() {
  const M = rvm.move;
  if (!M || M.id !== 'spoon' || !M.br || !(M.bk > 0)) return 0;
  return (M.br.bB - 0.5) * Math.min(1, M.bk);
}
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, { 'help.k.revspoon': 'roles reversed: Chloe lies down behind you on the cot and holds you, you curled up on your side (or say "spoon me", "cuddle me", "hold me"). Move, or ask for anything, and she gets up first' });
  Object.assign(STRINGS.hr || {}, { 'help.k.revspoon': 'zamijenjene uloge: Chloe legne iza tebe na krevet i drži te, a ti si sklupčana na boku (ili reci "zagrli me u krevetu"). Pomakni se ili traži bilo što, i ona prvo ustane' });
  Object.assign(STRINGS.fr || {}, { 'help.k.revspoon': 'rôles inversés : Chloe s’allonge derrière vous sur le lit et vous tient, vous en boule sur le côté (ou dites « fais-moi un câlin », « serre-moi »). Bougez, ou demandez quoi que ce soit, et elle se lève d’abord' });
}
if (typeof revApi !== 'undefined') revApi.moves = rvmApi;
