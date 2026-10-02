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
  hands: { rest: [0, 0], flat: [-0.08, 0.20], grip: [1.15, 0.65], soft: [0.38, 0.18], hip: [0.85, 0.45] },
  // Your flinch, standing, kneeling or on all fours: the spring on your
  // spine (rad of arch at a slap of `k` 12, its stiffness and damping), and
  // the push of your hips (m, standing).
  flinch: { arch: 0.16, w: 22, z: 0.35, push: 0.045 },
  // Holding you down: N on the small of your back, and the reflexes taken off.
  holdN: 70, calm: 0.85,
};

const RVM_SAY = {
  circle: [['Polako... gledam te sa svih strana.', "Slowly... I'm looking at you from every side.", 'Doucement... je te regarde sous tous les angles.'],
    ['Mm. Lijepo izgledaš ovako.', 'Mm. You look lovely like this.', 'Mm. Tu es jolie comme ça.']],
  stroke: [['Tako... dobra si.', "There... you're good.", "Voilà... tu es sage."],
    ['Šššš. Tu sam.', "Shhh. I'm here.", 'Chut. Je suis là.']],
  hold: [['Ostani dolje.', 'Stay down.', 'Reste en bas.'], ['Ni ne pokušavaj.', "Don't even try.", "N'essaie même pas."]],
  sitby: [['Ajde da te malo pogledam.', 'Let me look at you a bit.', 'Laisse-moi te regarder un peu.']],
  chin: [['Gore glavu. Pogledaj me.', 'Head up. Look at me.', 'Relève la tête. Regarde-moi.']],
  grip: [['Mm. Ovako ostani.', 'Mm. Stay just like this.', 'Mm. Reste comme ça.'], ['Moja si.', "You're mine.", 'Tu es à moi.']],
  wait: [['Čekam.', "I'm waiting.", "J'attends."], ['Hm? I?', 'Hm? Well?', 'Hm ? Alors ?']],
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

/** Her clip's arm this frame, side `s`, figure space, on the collarbone as drawn. */
function rvmChain(s) {
  const A = typeof rvkArmInit === 'function' ? rvkArmInit() : null;
  const f = you && you.fig;
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
  const hinge = a.e.clone().applyQuaternion(qU.clone().multiply(a.bq));
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
function rvmSolve(s, Cw, nW, dW, poleW, cock, k, out = null) {
  const c = rvmChain(s);
  if (!c) return null;
  const f = you.fig, mesh = you.mesh;
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

/** Her palm's point as she is drawn now, world (side `s`). */
function rvmPalm(s, out) {
  const f = you && you.fig;
  if (!f) return null;
  const i = f.boneIndex('hand' + s);
  if (i < 0) return null;
  const B = f.bindRest(), T = B.bindT, HB = rvmHandBind(s);
  // The bind offset is off the hand's head in the bind pose; `boneTurn` carries it.
  _mA.copy(HB.o).applyQuaternion(f.boneTurn(i, _mQ));
  f.boneAt(i, out).add(_mA);
  void T;
  return out.applyMatrix4(you.mesh.matrixWorld);
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
      fb.sent.copy(C); fb.ok = !!q.fb && rvm.k[s] >= 1;
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
      if (!clear(x, z, 0.30)) continue;
      // Turned so the spots sit `phi` to the reaching hand's side of her.
      const s0 = reach[0].s;
      const yD = Math.atan2(-(cx - x), -(cz - z));
      for (const phi of o.phi || [0.40, 0.20, 0.62]) {
        const yaw = yD + (s0 === 'R' ? phi : -phi) * (reach.length > 1 ? 0.3 : 1);
        const { f, r } = rvmAxes(yaw);
        if (mode === 'kneel' && !clear(x - f.x * 0.38, z - f.z * 0.38, 0.22)) continue;
        // The least bow that brings every hand's shoulder within reach.
        let bow = -1;
        for (let b = 0; b <= RVM.bowMax + 1e-6; b += 0.05) {
          let ok = true;
          for (const R of reach) {
            const sg = R.s === 'R' ? 1 : -1;
            const up = (shY - hipY) * Math.cos(b), fw = (shY - hipY) * Math.sin(b) + RVM.shX;
            const sx = x + f.x * fw + r.x * RVM.shZ * sg, sz = z + f.z * fw + r.z * RVM.shZ * sg, sy = fy + hipY + up;
            if (Math.hypot(R.T.x - sx, R.T.y - sy, R.T.z - sz) > RVM.reach) { ok = false; break; }
          }
          if (ok) { bow = b; break; }
        }
        if (bow < 0) continue;
        // And her head, bowed that far, clear of you: kneeling close behind
        // you it went into your back (photographed).
        const hy = (shY - hipY) * 1.30, hx = x + f.x * (hy * Math.sin(bow) + 0.06), hz = z + f.z * (hy * Math.sin(bow) + 0.06);
        const hh = fy + hipY + hy * Math.cos(bow);
        if (body.some((p) => Math.hypot(p.x - hx, p.y - hh, p.z - hz) < 0.27)) continue;
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
    const sideOf = (rev.ch.x - Pv.P.x) * across.x + (rev.ch.z - Pv.P.z) * across.z >= 0 ? 1 : -1;
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
  Object.assign(A, { mode: 'spank', ph: 'go', t: 0, n, err: 0, side0: null, from: null, ctx, hits: 0, hold: !!o.hold });
  A.k = 9 + 7 * rev.dom.heat + (Math.random() < rev.dom.heat * 0.4 ? 4 : 0);
  if (ctx !== 'front') A.side0 = Math.random() < 0.5 ? 1 : -1;
  const S = rvmSpankSpot(v);
  if (!S) { A.mode = null; return 'nospot'; }
  A.at = S; A.tgt = S.T.clone();
  const reach = [{ s: 'R', T: S.T, n: S.n }];
  // Holding you down with her left hand while her right does it.
  if (o.hold && rvm.move && rvm.move.id === 'hold' && rvm.move.spot) reach.push({ s: 'L', T: rvm.move.spot.T, n: rvm.move.spot.n });
  // Already where her hand reaches it from — on her knees by you holding you
  // down, or still there from the last round: she stays where she is.
  const lowT = Math.min(...reach.map((r) => r.T.y)) - rev.ch.y < RVM.kneelAt;
  const here = !rev.ch.goal && rvm.body.mode === (lowT ? 'kneel' : 'stand') && reach.every((r) => {
    const sh = rvmShoulder(r.s, new THREE.Vector3());
    return sh && sh.distanceTo(r.T) < RVM.reach + 0.05;
  });
  const P = here ? { x: rev.ch.x, z: rev.ch.z, yaw: rev.ch.yaw, mode: rvm.body.mode, bow: rvm.body.bow, w: rvm.body.w, here: true }
    : rvmPlan(reach, { prefer: ctx === 'front' ? null : S.n });
  if (!P) { A.mode = null; rvmTrace({ pick: 'spank:noplace', why: ctx }); return 'noplace'; }
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
    if (rvmSettled() || A.t > 7) { A.ph = 'ready'; A.t = 0; rvm.body.bowTo = A.plan.bow; rvm.body.wTo = A.plan.w; }
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
  if (A.ph !== 'ready') { rvm.body.bowTo = rvm.body.bow; rvm.body.wTo = rvm.body.w; }
  if (A.ph === 'ready') {
    at(RVM.readyOff, RVM.cock * 0.3, 'flat');
    // Her bow closed on the spot by feedback on her real shoulder.
    if (sh) {
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
      const P = A.replans <= 2 ? rvmPlan([{ s: 'R', T: S.T, n: S.n }], { prefer: S.floor ? S.n : null }) : null;
      rvmTrace({ pick: 'spank:reach', why: (A.err * 100).toFixed(0) + ' cm short, ' + (P ? 'moving' : 'next spot') });
      if (P) { A.plan = P; rvmGoPlan(P); A.ph = 'go'; A.t = 0; } else { A.ph = 'lift'; A.t = R.lift; A.replans = 0; }
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
        const N = rvmSpankSpot(v);
        if (N) {
          A.at = N; A.tgt = N.T.clone();
          // Still in reach from where she is? Then on; else to a new place.
          const sh2 = rvmShoulder('R', _mE);
          if (sh2 && sh2.distanceTo(N.T) < RVM.reach + 0.10) { A.ph = 'ready'; A.t = R.ready * 0.55; }
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
    fb.e.lerp(d.sub(fb.sent), 0.8);
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
  const add = (id, s) => out.push({ id: 'move:' + id, s: s * (recent(id) ? 0.3 : 1) });
  if (onCot) add('circle', 0.35);
  if (onCot || ctx === 'kneel' || ctx === 'fours') add('stroke', 0.30 + 0.25 * Math.min(2, D.streak));
  if (ctx === 'front') add('hold', 0.35 + 0.5 * D.heat);
  if (ctx === 'front' || ctx === 'back' || ctx === 'side') add('sitby', 0.32);
  if (ctx === 'kneel' || ctx === 'cotKneel') add('chin', 0.70);
  if (ctx === 'kneel' || ctx === 'fours' || ctx === 'stand' || ctx === 'cotKneel' || ctx === 'front') add('grip', 0.25 + 0.45 * D.heat);
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
    M.spank = Math.random() < 0.35 + 0.4 * rev.dom.heat;
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
  rvm.move = null;
  if (M.id === 'sitby') rvmWant('stand');
  else rvm.downFor = M.id === 'care' ? 0 : 1.2;
  rvm.nape = 0; rvm.chin = 0;
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

/** The move, a frame (after her body is placed, before her arms are solved). */
function rvmMoveTick(dt) {
  const M = rvm.move;
  if (!M) return;
  M.t += dt;
  const v = revView();
  const ctx = v ? v.ctx : null;
  // You moved out of it (a move is about where you are), except the care.
  if (M.id !== 'care' && M.id !== 'hips' && M.ctx && ctx !== M.ctx) { rvmEnd('you moved: ' + (v ? v.phase : '?')); return; }
  const { f, r } = rvmAxes(rev.ch.yaw);
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
function rvmSitLegs() {
  const f = you.fig;
  const k = Math.min(1, rvmSitK() * 1.2);
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
  else T = rvmYourFace(new THREE.Vector3());
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
  if (rvm.move) rvmEnd('safeword');
  rvm.pend = null;
  rvm.nape = 0; rvm.chin = 0;
  rvm.body.bowTo = 0; rvm.body.turnTo = 0;
  if (rvm.body.mode === 'sit') rvmWant('stand');
}

/** Swapped back or left: everything of hers off. */
function rvmClear() {
  rvm.move = null; rvm.pend = null;
  rvm.nape = 0; rvm.chin = 0; rvm.downFor = 0;
  rvmArmFree('R'); rvmArmFree('L');
  rvmFingers('R', 0, 0); rvmFingers('L', 0, 0);
  rvmLegsFree();
  const f = you && you.fig;
  if (f) { f.aim('neck', 0, 1, 0, 0); f.aim('head', 0, 1, 0, 0); f.aim('spine01', 0, 0, 1, 0); f.aim('spine02', 0, 0, 1, 0); f.aim('spine03', 0, 0, 1, 0); }
  _lkA.identity();
  rvm.look.on = false; rvm.look.at = 0;
  if (you && you.eyes) you.eyes(null);
  Object.assign(rvm.body, { mode: 'stand', want: 'stand', t: 9, bow: 0, bowTo: 0, w: 0, wTo: 0, turn: 0, turnTo: 0, sit: null, was: null });
  const b = jadrija && jadrija.figure;
  if (b) { b.aim('spine01', 0, 0, 1, 0); b.aim('spine02', 0, 0, 1, 0); b.aim('chest', 0, 0, 1, 0); }
  rvm.flinch.on = false; rvm.flinch.x = 0; rvm.flinch.v = 0;
}

/** `__fr.reverse.moves` — see 49-reverse.js. */
const rvmApi = {
  start: (id) => rvmStart(id, 'probe'),
  end: () => { rvmEnd('probe'); return true; },
  spank: (n = 1, hold = false) => rvmSpankStart(n, 'probe', { hold }),
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
if (typeof revApi !== 'undefined') revApi.moves = rvmApi;
