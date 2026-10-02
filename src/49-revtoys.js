// -----------------------------------------------------------------------------
// Roles reversed: the toys in Chloe's hands.
//
// Misha, 2 Oct 2026: *"if while in role reversal, and anal toy was inside
// baye (me), if sometimes chloe would pull it out briefly and pull it back
// in, same with lovense"*. The night loop's item 5.
//
// The same two adults and the same game as src/49-reverse.js,
// src/49-revkit.js and src/49-revmoves.js, and the safeword over all of it.
// While the roles are reversed and you — in Baye's body — are wearing the
// plug or the Lovense (`wear:plug`, `wear:lovense`), two more things are
// Chloe's to do, as moves of hers (`rvmStart('toy' | 'remote')`):
//
// HER HAND ON IT (`toy`). She goes where her right arm reaches the toy from
// (`rvmPlan`, kneeling by the cot for a low one), her palm is solved on to
// its base (`rvmSolve`, the 2c spank's solver: the palm's face on the
// base's outer face, the fingers along its long axis, pinched round its
// rim), and she slowly draws it partway out along its own axis, holds it a
// beat, and pushes it back in to its seat. The toy's half is 43-jadrija.js's
// `toyDraw` — an offset along the axis on top of the worn mount, with the
// part that is drawn always the part outside you (`drawFit` measures it) —
// and her hand is solved to where the base is THIS frame, after the draw, so
// it follows the base all the way out and back. Variants: one slow draw, a
// few short teasing ones, and (the plug) a twist about its axis.
//
// Where she cannot reach it she does not try: the plug faces the mattress
// when you lie on your back with your legs down, the Lovense when you lie on
// your front. Legs up, she can.
//
// HER REMOTE (`remote`). The phone in her left hand — the same Lovense app,
// both channels (`jadrija.remote`, `signalSet`) — on, up in steps, down,
// teasing bursts, off. What it does to you is the existing rhythm sync: your
// lips and eyes on the motor's beat.
//
// AND YOU (`rvtAsk`): "pull it out a bit", "izvuci malo", "push it back in",
// "turn it up", "pojačaj", "turn it off", "ugasi" — her moves, asked.
//
// THE SAFEWORD stops a draw where it is and the toy goes back to its seat
// (a third of a second), her hand comes off, and her remote switches off.
// -----------------------------------------------------------------------------

const RVT = {
  // How far out (m): a full draw is somewhere in [lo, hi]; a tease about
  // `tease`. `toyDraw` clamps to DRAW.max (34 / 22 mm) whatever is asked.
  depth: { plug: [0.024, 0.034], lovense: [0.015, 0.022], wand: [0.028, 0.044] },
  tease: { plug: 0.012, lovense: 0.009, wand: 0.016 },
  // Rad either way of a twist (the plug's oval base turned about its axis).
  twist: 0.35,
  // Her palm's skin off the grip point, out along the axis (m): just over
  // the plug's base, the Lovense's arm in her pinch.
  palmOff: { plug: 0.010, lovense: 0.007, wand: 0.006 },
  // The wand (1.572.0): how much more of you its draws, its pushes and its
  // motor reach, against the Lovense and the plug.
  wandX: 1.4,
  // How far her palm's face turns from the base's own toward her shoulder
  // (tan of it: 0.4 is 22°).
  tilt: 0.4,
  // Her plan (`rvmPlan`): the deepest bow and the longest arm she plans for.
  bowMax: 0.85, reach: 0.46,
  // Seconds: her hand on to it (at most), her grip closing, letting go; a
  // re-seat after the safeword, and after a move that ends mid-draw.
  reachMax: 3.0, grip: 0.35, let: 0.45, reseatSafe: 0.30, reseat: 0.6,
  // Remote levels (`signalLevel`), as steps.
  levels: [0.25, 0.5, 0.75, 1.0],
  // How long a level she leaves running lasts (s, before heat), and one a
  // player asked for.
  linger: [6, 14], asked: 30,
};

const RVT_SAY = {
  // English since 1.569.0, written for her (see `REV_SAY` in 49-reverse.js).
  draw: ['Slowly out...', 'Feel that?', 'Just a little... and back.'],
  tease: ['Out... in... out...', "Hehe. Don't move."],
  twist: ['A little twist for you...'],
  pushin: ['And back in. There.', 'Good girl. All snug again.'],
  remote: ["Ooh. Let's switch you on.", "Let's see what this does..."],
  remup: ['Stronger?', 'A little more.'],
  remdown: ['Okay, a bit softer.'],
  remtease: ['On... off... hehe.'],
  remoff: ["Okay. Off. Breathe, babe."],
  toyno: ["Can't reach it from here, babe."],
  // The wand (1.572.0): her swap, and her remote on it.
  swap: ["Let's trade this for something bigger.", "I've got a better toy for you, babe.", 'Okay. Time for the good one.'],
  swapin: ["There. Now we're talking.", 'Mmm. That one fits you.', 'All the way in. Good girl.'],
  wandon: ["Oh, you're gonna feel this one.", "That's the big motor, babe. Hold on."],
  wandup: ['Too much? Hehe. No?', "Look at you shaking. More?"],
};

const rvt = {
  // A move of hers asked by you, waiting for her to be free; and the
  // variant/key the next `rvtStart` takes.
  ask: null, pre: null,
  // The draw going back to its seat with no hand on it (safeword, a move
  // ended under it).
  reseat: null,
  // The palm against the grip point, measured each frame at the top of the
  // next (what was drawn): `sent` the target, then the timeline.
  sent: null, line: [], log: [], phone: null, phoneOn: 0,
  shiver: 0, lastKey: null, gate: {},
};
const _tA = new THREE.Vector3(), _tB = new THREE.Vector3(), _tC = new THREE.Vector3();
const _tQ = new THREE.Quaternion(), _tM = new THREE.Matrix4();

function rvtNote(s) { rvt.log.push([+rev.clock.toFixed(1), s]); if (rvt.log.length > 60) rvt.log.shift(); }
function rvtTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvtSay(kind, force = false) {
  return typeof revSay === 'function' ? revSay(kind, force, null, { still: revStill.dom }) : null;
}

/** The toys you are wearing that have a motor and a base: 'plug', 'lovense', 'wand'. */
function rvtWorn() {
  const w = jadrija && jadrija.worn ? jadrija.worn() : [];
  return w.filter((k) => k === 'plug' || k === 'lovense' || k === 'wand');
}

/** The level a toy's remote is at: 0 off, else 0.15..1. */
function rvtLevel(key) { return jadrija && jadrija.remote ? jadrija.remote(key) || 0 : 0; }

// ── can she reach it? ────────────────────────────────────────────────────────

/**
 * WHETHER HER HAND CAN GET TO A TOY, where you are: the ways each toy can
 * be got at (the plug from behind you; the Lovense from in front of you),
 * then the room's answer — 10 cm out along its way out of you must be
 * clear air above the mattress or the floor, or her hand would have to come
 * up through the cot to it. The Lovense rides your pelvis rigidly and your
 * skin there follows your thighs, so with your hips folded it stands off
 * you; it is only hers to draw where it sits on you (`drawSeat`: its exit
 * within a centimetre of your skin), asked once a pose.
 */
const RVT_CTX = {
  plug: { front: 1, fours: 1, stand: 1, kneel: 1, cotKneel: 1, back: 1 },
  lovense: { back: 1, stand: 1, kneel: 1, cotKneel: 1, sit: 1 },
};
function rvtReach(key, v) {
  // The wand is got at the way the toy in that hole is (1.572.0).
  const ctxT = RVT_CTX[key === 'wand' ? (rvtHoleOf('wand') === 'back' ? 'plug' : 'lovense') : key];
  if (!v || !v.ctx || !ctxT[v.ctx]) return 'not from here';
  const g = jadrija.grip ? jadrija.grip(key) : null;
  if (!g) return 'not worn';
  // Its handle is what her hand takes, and the handle is out already.
  const A = key === 'wand' ? _tA.copy(g.p) : _tA.copy(g.p).addScaledVector(g.out, 0.10);
  const fy = rev.ch.y;
  if (v.onBed) {
    const G = typeof rvmCotGeom === 'function' ? rvmCotGeom() : null;
    if (G && A.y < G.top + 0.04) return 'against the mattress';
  } else if (A.y < fy + 0.08) return 'against the floor';
  if (key === 'lovense') {
    const gk = v.phase + '|' + (v.liftL || 0) + (v.liftR || 0) + '|' + (+(v.legsSp || 0)).toFixed(1);
    let s = rvt.gate[gk];
    if (s === undefined) {
      s = jadrija.drawSeat ? jadrija.drawSeat('lovense') : 0;
      rvt.gate = { [gk]: s };
    }
    if (s != null && s < -0.010) return 'off your skin here';
  }
  return true;
}

/** The worn toys she can reach now. */
function rvtReachable(v) {
  return rvtWorn().filter((k) => rvtReach(k, v) === true);
}

// ── her choices ──────────────────────────────────────────────────────────────

/** Her candidates for `revDecide`: her hand on a toy, her remote. */
function rvtCands(ctx, D) {
  const out = [];
  if (!ctx || (typeof rvm !== 'undefined' && rvm.move)) return out;
  const ks = rvtWorn();
  if (!ks.length) {
    // Nothing in you yet: the wand is still hers to put in (1.572.0).
    const v0 = revView();
    if (D.obey >= 2 && D.heat > 0.45 && typeof rvtSwapPick === 'function' && typeof rvtSwapPick(v0) === 'object'
      && D.last.slice(-4).indexOf('swap') < 0) out.push({ id: 'move:swap', s: 0.08 + 0.25 * D.heat });
    return out;
  }
  const recent = (id) => D.last.slice(-4).filter((x) => x === id).length;
  const v = revView();
  if (rvtReachable(v).length && D.obey + D.miss >= 1) {
    out.push({ id: 'move:toy', s: (0.30 + 0.55 * D.heat + 0.08 * Math.min(3, D.streak)) * (recent('toy') ? 0.3 : 1) });
  }
  if (D.obey >= 1) out.push({ id: 'move:remote', s: (0.25 + 0.6 * D.heat) * (recent('remote') ? 0.35 : 1) });
  // Her swap for the wand (1.572.0): now and then, warm, with the wand on
  // the shelf and a hole she can get at.
  if (D.obey >= 2 && D.heat > 0.35 && !recent('swap') && typeof rvtSwapPick === 'function'
    && typeof rvtSwapPick(v) === 'object') {
    out.push({ id: 'move:swap', s: 0.10 + 0.30 * D.heat });
  }
  return out;
}

/** Which of the reachable ones, and how: a slow draw, teasing, or a twist. */
function rvtVariant(key) {
  const h = rev.dom.heat, r = Math.random();
  if ((key === 'plug' || key === 'wand') && r < 0.2 + 0.15 * h) return 'twist';
  if (r < 0.55 + 0.1 * h) return 'tease';
  return 'draw';
}

/** The draw's own clock: a list of draws out and back in. */
function rvtCycles(key, kind) {
  const R = (a, b) => a + (b - a) * Math.random();
  const [lo, hi] = RVT.depth[key];
  if (kind === 'tease') {
    const n = 3 + (Math.random() < 0.5 ? 1 : 0);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ D: RVT.tease[key] * R(0.8, 1.25), tOut: R(0.40, 0.55), tHold: R(0.12, 0.25), tIn: R(0.35, 0.50), gap: R(0.15, 0.35) });
    return out;
  }
  if (kind === 'twist') return [{ D: lo * R(0.45, 0.6), tOut: R(0.8, 1.0), tHold: 2.0, tIn: R(0.8, 1.0), tw: RVT.twist, gap: 0 }];
  return [{ D: R(lo, hi), tOut: R(1.0, 1.5), tHold: R(0.6, 0.95), tIn: R(0.9, 1.25), gap: 0 }];
}

/**
 * Set a move up (`rvmStart` calls this for 'toy' and 'remote'): which toy,
 * where she goes, the clock. Answers true or why not.
 */
function rvtStart(M) {
  const v = revView();
  const pre = rvt.pre;
  rvt.pre = null;
  // Her swap for the wand (1.572.0) — see `rvtSwapStart`.
  if (M.id === 'swap') return rvtSwapStart(M, v, pre);
  if (M.id === 'remote') {
    const ks = rvtWorn();
    if (!ks.length) return 'nothing worn';
    const running = ks.filter((k) => rvtLevel(k) > 0);
    M.key = pre && pre.key ? pre.key : running.length ? running[Math.floor(Math.random() * running.length)]
      : ks[Math.floor(Math.random() * ks.length)];
    M.act = pre && pre.act ? pre.act : null;
    M.plan2 = rvtRemotePlan(M);
    M.ph = 'take';
    M.dur = M.plan2.reduce((a, s) => Math.max(a, s.t), 0) + 1.6;
    M.ctx = null;           // the remote does not care where you are
    return true;
  }
  const ks = rvtReachable(v);
  if (!ks.length) return 'unreachable';
  const key = pre && pre.key && ks.includes(pre.key) ? pre.key : ks[Math.floor(Math.random() * ks.length)];
  const g = jadrija.grip(key);
  if (!g) return 'not worn';
  const C = g.wand ? g.p.clone() : g.p.clone().addScaledVector(g.out, RVT.palmOff[key]);
  // Rather on the side the toy faces out to, level.
  const pref = new THREE.Vector3(g.out.x, 0, g.out.z);
  // A deeper bow than a spank's (0.62 rad): the base of a toy on you lying
  // with your legs up is low and in the middle of the cot, and she leans
  // over the mattress to it. Her arm a hair further out too (0.46 m of its
  // 0.477 to the wrist), since she holds rather than swings.
  const o = Object.assign({ bowMax: RVT.bowMax, reach: RVT.reach }, pref.lengthSq() > 0.01 ? { prefer: pref.normalize(), preferK: 0.6 } : {});
  // You on your feet: she keeps half a metre off you as she walks
  // (`revSteer`), so a place nearer than that is one she never gets to —
  // the rings start past it, and low on you she kneels to it.
  if (rev.walk) { o.ring = [0.62, 0.68, 0.75]; if (C.y - rev.ch.y < 1.0) o.mode = 'kneel'; }
  // On her knees if standing cannot reach it: a toy at your hips with you
  // on your feet is under a standing woman's reach (her shoulder at 1.41 m
  // and her bow stops at 0.62 rad), and over a kneeling one's.
  const P = rvmPlan([{ s: 'R', T: C, n: g.out }], o) || rvmPlan([{ s: 'R', T: C, n: g.out }], Object.assign({ mode: 'kneel' }, o));
  if (!P) return 'noplace';
  M.key = key;
  M.plan = P;
  M.kind = pre && pre.kind ? pre.kind : rvtVariant(key);
  if (M.kind === 'twist' && key !== 'plug' && key !== 'wand') M.kind = 'draw';
  M.cyc = rvtCycles(key, M.kind);
  M.i = 0; M.ct = 0; M.d = 0; M.tw = 0;
  M.dur = 30;
  rvt.lastKey = key;
  return true;
}

/** Her remote's beats for this move: `{ t, lvl }` (lvl 0 is off), and the lines. */
function rvtRemotePlan(M) {
  const L = RVT.levels, h = rev.dom.heat, cur = rvtLevel(M.key);
  const out = [];
  const act = M.act;
  // Asked: done as soon as the phone is in her hand.
  const ta = act ? 0.45 : 1.0;
  if (act === 'off' || (!act && cur > 0 && Math.random() < 0.35)) {
    const run = rvtWorn().filter((k) => rvtLevel(k) > 0);
    (run.length ? run : [M.key]).forEach((k, j) => out.push({ t: ta, lvl: 0, key: k, say: j ? null : 'remoff' }));
    return out;
  }
  if (act === 'down') {
    const i = L.findIndex((x) => x >= cur - 0.01);
    out.push({ t: ta, lvl: i <= 0 ? 0 : L[i - 1], say: i <= 0 ? 'remoff' : 'remdown', down: true });
    return out;
  }
  if (act === 'up' || act === 'on') {
    const i = cur > 0 ? Math.min(L.length - 1, L.findIndex((x) => x >= cur - 0.01) + 1) : act === 'on' ? 1 : 0;
    out.push({ t: ta, lvl: L[Math.max(0, i)], say: cur > 0 ? 'remup' : 'remote', secs: RVT.asked });
    return out;
  }
  if (Math.random() < 0.4) {
    // Teasing bursts: on, off, on, off — then left on low, or off.
    const lv = L[1 + Math.floor(Math.random() * (1 + Math.round(h * 2)))] || L[2];
    let t = 0.9;
    for (let i = 0; i < 4; i++) { out.push({ t, lvl: lv, say: i === 0 ? 'remtease' : null }); t += 0.55 + Math.random() * 0.35; out.push({ t, lvl: 0 }); t += 0.6 + Math.random() * 0.5; }
    if (Math.random() < 0.6) out.push({ t, lvl: L[0], secs: RVT.linger[0] + (RVT.linger[1] - RVT.linger[0]) * h });
    return out;
  }
  // Up in steps, from where it is.
  let i = cur > 0 ? L.findIndex((x) => x >= cur - 0.01) : -1;
  const top = Math.min(L.length - 1, 1 + Math.round(h * 2.4));
  let t = 1.0, first = true;
  while (i < top) {
    i++;
    out.push({ t, lvl: L[i], say: first ? (cur > 0 ? 'remup' : 'remote') : (Math.random() < 0.5 ? 'remup' : null),
      secs: RVT.linger[0] + (RVT.linger[1] - RVT.linger[0]) * h + 6 });
    first = false;
    t += 1.4 + Math.random() * 0.8;
  }
  if (!out.length) out.push({ t: 1.0, lvl: L[top], say: 'remote', secs: RVT.linger[1] });
  return out;
}

/** A remote beat: set the channel, and say so. */
function rvtRemoteSet(key, lvl, secs = 0) {
  if (!jadrija || !jadrija.remote) return 'none';
  if (lvl <= 0) return jadrija.remote(key, false);
  if (rvtLevel(key) > 0 && jadrija.remoteLevel) { jadrija.remoteLevel(key, lvl); return 'level'; }
  return jadrija.remote(key, true, secs || RVT.linger[1], lvl);
}

// ── the move, a frame ────────────────────────────────────────────────────────

const _sm = (x) => { const e = Math.min(1, Math.max(0, x)); return e * e * (3 - 2 * e); };

/** The draw's clock: this frame's `d` and twist, or null when every cycle is done. */
function rvtDrawAt(M, dt) {
  const c = M.cyc[M.i];
  if (!c) return null;
  M.ct += dt;
  const t = M.ct;
  let d = 0, tw = 0, part = 'out';
  if (M.push && t < c.tOut + c.tHold) { M.ct = c.tOut + c.tHold; return rvtDrawAt(M, 0); }
  if (t < c.tOut) d = c.D * _sm(t / c.tOut);
  else if (t < c.tOut + c.tHold) {
    d = c.D; part = 'hold';
    if (c.tw) tw = c.tw * Math.sin(((t - c.tOut) / c.tHold) * Math.PI * 4) * Math.min(1, (t - c.tOut) / 0.3, (c.tOut + c.tHold - t) / 0.3);
  } else if (t < c.tOut + c.tHold + c.tIn) { d = c.D * (1 - _sm((t - c.tOut - c.tHold) / c.tIn)); part = 'in'; }
  else if (t < c.tOut + c.tHold + c.tIn + c.gap) { d = 0; part = 'gap'; }
  else { M.i++; M.ct = 0; if (M.push) M.i = M.cyc.length; return rvtDrawAt(M, 0); }
  // Each draw out and each push back in, felt.
  if (part !== M.part) {
    if (part === 'out') rvtFelt(M, 'out', c.D);
    if (part === 'in') rvtFelt(M, 'in', c.D);
    M.part = part;
  }
  return { d, tw, part };
}

/**
 * WHAT YOU FEEL OF IT: a small shiver of your view, a breath (her gasps,
 * soft — Baye's own voice, which is the body you are in), your back easing
 * after it (the flinch spring, gently), on each draw out and each push in.
 */
function rvtFelt(M, how, D) {
  // The wand reaches you harder (1.572.0): `RVT.wandX` on all of it.
  const x = M.key === 'wand' ? RVT.wandX : 1;
  const k = Math.min(1, D / 0.03) * x;
  rvt.shiver = Math.min(1.4, rvt.shiver + (how === 'out' ? 0.55 : 0.8) * (0.5 + 0.5 * k));
  if (typeof rev !== 'undefined') rev.jolt = Math.min(1.4, rev.jolt + (how === 'in' ? 0.25 : 0.12) * k);
  const A = typeof audio !== 'undefined' && audio ? audio : null;
  if (A && A.herGasp && (how === 'in' || Math.random() < 0.6)) A.herGasp(Math.min(0.9, 0.25 + 0.35 * k), true, 0.25 + Math.random() * 0.3);
  else if (A && A.herMoan && how === 'in' && Math.random() < 0.3) A.herMoan();
  const g = jadrija.grip ? jadrija.grip(M.key) : null;
  if (g && typeof rvmFlinch === 'function') { rvmFlinch(g.out.clone().negate(), 2.5 * k); rvm.flinch.push = 0; }
  M.felt = (M.felt || 0) + 1;
}

/**
 * HER HAND ROUND THE WAND'S HANDLE (1.572.0): not on a base, round a
 * handle — the palm on the handle's side toward her shoulder, its face in
 * to the handle's axis, and the fingers wrapping across it. `P` the
 * handle's axis point, `axis` its line, `r` its radius there.
 */
function rvtWandHold(P, axis, r, fb = true) {
  const sh = rvmShoulder('R', _tB);
  const ax = axis.clone().normalize();
  const u = sh ? sh.clone().sub(P) : new THREE.Vector3(0, 1, 0);
  u.addScaledVector(ax, -u.dot(ax));
  if (u.lengthSq() < 1e-6) u.set(0, 1, 0).addScaledVector(ax, -ax.y);
  u.normalize();
  const C = P.clone().addScaledVector(u, r + RVT.palmOff.wand);
  const d = new THREE.Vector3().crossVectors(ax, u).normalize();
  const { f, r: rr } = rvmAxes(rev.ch.yaw);
  rvmAsk('R', { C, n: u, d, pole: rr.clone().add(_tA.set(0, 0.35, 0)).addScaledVector(f, -0.3), cock: 0,
    shape: 'pinch', rate: 9, fb });
  return C;
}

/** Her hand on it this frame: the toy drawn first, then her palm to its base. */
function rvtHand(M, dt) {
  const g = jadrija.grip(M.key);
  if (!g) return null;
  if (g.wand) return rvtWandHold(g.p, g.long, g.r || 0.017, true);
  const C = g.p.clone().addScaledVector(g.out, RVT.palmOff[M.key]);
  const { f, r } = rvmAxes(rev.ch.yaw);
  const pole = r.clone().add(_tA.set(0, 0.35, 0)).addScaledVector(f, -0.3);
  // HER PALM A LITTLE ON ITS SIDE, toward her: square on to the base's
  // face it is a hand turned 110-120° off her forearm from where she kneels
  // (MEASURED, `rvm.last`) — a wrist at its end stop that the arm cannot
  // quite draw. A pinch from her side of it is the same hold.
  const sh = rvmShoulder('R', _tB);
  const n = g.out.clone();
  if (sh) {
    const to = sh.sub(C);
    to.addScaledVector(g.out, -to.dot(g.out));
    if (to.lengthSq() > 1e-6) n.addScaledVector(to.normalize(), RVT.tilt).normalize();
  }
  // The lag taken off (`fb`) as soon as the arm is hers, on the way in too:
  // without it the palm arrives 5 cm behind where it was sent (MEASURED).
  const on = M.ph !== 'reach';
  rvmAsk('R', { C, n, d: g.long.clone(), pole, cock: 0, shape: on ? 'pinch' : 'soft',
    rate: on ? 9 : 4.5, fb: true });
  return C;
}

/** The toy move and the remote move, a frame (from `rvmMoveTick`). */
function rvtMoveTick(M, dt) {
  if (M.id === 'remote') { rvtRemoteTick(M, dt); return; }
  if (M.id === 'swap') { rvtSwapTick(M, dt); return; }
  if (!rvtWorn().includes(M.key)) { rvmEnd('toy gone'); return; }
  if (M.ph === 'go') {
    if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
    if (rvmSettled() || M.t > 7) { M.ph = 'reach'; M.t0 = M.t; rvm.body.bowTo = M.plan.bow; rvm.body.wTo = M.plan.w || 0; }
    return;
  }
  const tt = M.t - M.t0;
  if (M.ph === 'reach') {
    const C = rvtHand(M, dt);
    // Her bow closed on it by feedback on her real shoulder, as the spank's.
    const sh = rvmShoulder('R', _tB);
    if (sh && C) {
      const need = sh.distanceTo(C) - RVM.reach;
      rvm.body.bowTo = Math.max(0, Math.min(RVM.bowMax + 0.2, rvm.body.bowTo + need * Math.min(1, dt * 3)));
      if (M.plan.mode === 'stand' && rvm.body.bowTo > RVM.bowMax) rvm.body.wTo = Math.min(0.5, rvm.body.wTo + need * dt * 2);
      M.short = Math.max(0, need);
    }
    const palm = rvmPalm('R', _tC);
    M.err0 = palm && C ? palm.distanceTo(C) : 9;
    if ((rvm.k.R > 0.97 && M.err0 < 0.02) || tt > RVT.reachMax) {
      if (M.err0 > 0.06) {
        // Short after all her bowing: once, somewhere nearer on her knees
        // (the plan's standing bow is a guess at a bend her knees then do
        // not make); then she lets it be.
        const g = !M.replanned ? jadrija.grip(M.key) : null;
        const P = g ? rvmPlan([{ s: 'R', T: g.p.clone().addScaledVector(g.out, RVT.palmOff[M.key]), n: g.out }],
          { mode: 'kneel', bowMax: RVT.bowMax, reach: RVT.reach - 0.03 }) : null;
        rvtTrace({ pick: 'toy:reach', why: (M.err0 * 100).toFixed(0) + ' cm off — ' + (P ? 'kneeling nearer' : 'letting go') });
        if (P) { M.replanned = true; M.plan = P; rvmGoPlan(P); M.ph = 'go'; M.t = 0; return; }
        rvmEnd('out of reach'); return;
      }
      M.ph = 'grip'; M.t0 = M.t;
      // From here her back and knees stay put: a body still settling under
      // the arm is a palm drawn behind where it was sent.
      rvm.body.bowTo = rvm.body.bow; rvm.body.wTo = rvm.body.w;
    }
    return;
  }
  if (M.ph === 'grip') {
    rvt.sent = { C: rvtHand(M, dt), key: M.key, ph: 'grip' };
    if (tt > RVT.grip) {
      M.ph = 'draw'; M.t0 = M.t;
      rvtSay(M.kind === 'tease' ? 'tease' : M.kind === 'twist' ? 'twist' : 'draw', true);
      rvtTrace({ pick: 'toy:' + M.kind + ':' + M.key, why: M.cyc.length + ' draw' + (M.cyc.length > 1 ? 's' : '') + ', '
        + M.cyc.map((c) => Math.round(c.D * 1000)).join('/') + ' mm' });
    }
    return;
  }
  if (M.ph === 'draw') {
    const s = rvtDrawAt(M, dt);
    if (!s) {
      jadrija.draw(M.key, 0, 0);
      M.d = 0; M.tw = 0;
      M.ph = 'let'; M.t0 = M.t;
      if (Math.random() < 0.6 || M.push) rvtSay('pushin', !!M.push);
      // And her hand stays on it this frame too: a frame with no ask is
      // her arm let go, and it comes back a lag behind.
      rvt.sent = { C: rvtHand(M, dt), key: M.key, ph: 'let', d: 0 };
      return;
    }
    jadrija.draw(M.key, s.d, s.tw);
    M.d = s.d; M.tw = s.tw; M.part = s.part;
    M.maxD = Math.max(M.maxD || 0, s.d);
    const C = rvtHand(M, dt);
    rvt.sent = { C, key: M.key, ph: s.part, d: s.d };
    return;
  }
  if (M.ph === 'let') {
    // A moment on it, seated, then her hand off.
    if (tt < RVT.let) { const C = rvtHand(M, dt); rvt.sent = { C, key: M.key, ph: 'let', d: 0 }; return; }
    rvmEnd('done');
  }
}

/** The end of a move (`rvmEnd`'s hook): a draw left out goes back, the phone away. */
function rvtEnd(M, why) {
  rvt.sent = null;
  // Her swap (1.572.0): a toy in her hand goes to its place, and a wand
  // partway in goes back to its seat — the safeword leaves it seated.
  if (M.id === 'swap') {
    if (M.carry) { jadrija.toyHome(M.carryKey, M.carry); M.carry = null; }
    for (const k of [M.old, 'wand']) {
      const s = k && jadrija.draw ? jadrija.draw(k) : null;
      if (s && s.d > 0.0002) rvt.reseat = { key: k, d0: s.d, tw0: s.tw, t: 0, T: why === 'safeword' ? RVT.reseatSafe : RVT.reseat };
    }
    rvtTrace({ pick: 'swap end:' + (M.old || '-') + '→wand:' + M.hole, why: why + ' at ' + M.ph });
    return;
  }
  if (M.id === 'toy' && M.key) {
    const s = jadrija.draw ? jadrija.draw(M.key) : null;
    if (s && (s.d > 0.0002 || Math.abs(s.tw) > 0.002)) {
      rvt.reseat = { key: M.key, d0: s.d, tw0: s.tw, t: 0, T: why === 'safeword' ? RVT.reseatSafe : RVT.reseat };
    }
    rvtTrace({ pick: 'toy end:' + M.key, why: why + (M.maxD ? ', out ' + Math.round(M.maxD * 1000) + ' mm' : '') });
  }
  if (M.id === 'remote') rvt.phoneOn = 0;
}

// ── her remote ───────────────────────────────────────────────────────────────

/** The phone in her hand: a dark slab with the app lit pink on it, made once. */
function rvtPhone() {
  if (rvt.phone) return rvt.phone;
  if (typeof scene === 'undefined' || !scene) return null;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.0715, 0.1465, 0.0078),
    solidMaterial(new THREE.Color(0.055, 0.058, 0.066), { spec: 0.9, specPower: 120, vcol: false }));
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.10, 0.22) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.0655, 0.138), glow);
  screen.position.z = 0.0040;
  // The level, a bar up the middle of the app — longer as she turns it up.
  const barM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.42, 0.78) });
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.09), barM);
  bar.position.set(0, -0.005, 0.0042);
  g.add(body, screen, bar);
  for (const m of g.children) { m.castShadow = false; m.receiveShadow = false; }
  g.visible = false;
  scene.add(g);
  rvt.phone = { g, glow, bar };
  return rvt.phone;
}

/** The phone on her left palm, screen up off it, along her fingers. */
function rvtPhonePlace() {
  const P = rvt.phone;
  if (!P) return;
  const show = rvt.phoneOn > 0.5 && rev.on && you && you.fig;
  P.g.visible = !!show;
  if (!show) return;
  const f = you.fig, ih = f.boneIndex('handL');
  if (ih < 0) { P.g.visible = false; return; }
  const HB = rvmHandBind('L');
  _tQ.copy(you.mesh.quaternion).multiply(f.boneTurn(ih, new THREE.Quaternion()));
  const d = _tA.copy(HB.d).applyQuaternion(_tQ).normalize();
  const n = _tB.copy(HB.n).applyQuaternion(_tQ).normalize();
  const palm = rvmPalm('L', new THREE.Vector3());
  if (!palm) { P.g.visible = false; return; }
  P.g.position.copy(palm).addScaledVector(n, 0.0045).addScaledVector(d, 0.012);
  // Its screen turned up to her eyes, along her fingers: the roll a hand
  // gives a phone it is reading, which her solved wrist only nearly has.
  const eye = typeof rvkEye === 'function' ? rvkEye(new THREE.Vector3()) : null;
  const z = eye ? eye.sub(P.g.position).normalize() : n.clone();
  if (z.dot(n) < 0.2) z.addScaledVector(n, 0.2 - z.dot(n)).normalize();
  const y = d.clone().addScaledVector(z, -d.dot(z)).normalize();
  const x = _tC.crossVectors(y, z).normalize();
  _tM.makeBasis(x, y, z);
  P.g.quaternion.setFromRotationMatrix(_tM);
  // The app: brighter, and a longer bar, the higher it is.
  let lv = 0;
  for (const k of rvtWorn()) lv = Math.max(lv, rvtLevel(k));
  P.glow.color.setRGB(0.20 + 0.25 * lv, 0.06 + 0.06 * lv, 0.14 + 0.16 * lv);
  P.bar.scale.y = Math.max(0.04, lv);
  P.bar.position.y = -0.05 + 0.045 * Math.max(0.04, lv);
}

/** Her left hand holding the phone up in front of her, palm up, to read it. */
function rvtPhoneHand() {
  const sh = rvmShoulder('L', new THREE.Vector3());
  if (!sh) return;
  const { f, r } = rvmAxes(rev.ch.yaw);
  const up = _tA.set(0, 1, 0);
  const C = sh.clone().addScaledVector(f, 0.27).addScaledVector(r, 0.08).addScaledVector(up, -0.24);
  // Palm up and a little toward her face: the palm faces −n.
  const n = f.clone().multiplyScalar(0.55).addScaledVector(up, -0.83).normalize();
  rvmAsk('L', { C, n, d: f.clone(), pole: r.clone().negate().add(_tB.set(0, -0.6, 0)), cock: 0, shape: 'soft', rate: 5 });
}

function rvtRemoteTick(M, dt) {
  const t = M.t;
  rvtPhone();
  rvtPhoneHand();
  rvt.phoneOn = rvm.k.L > 0.55 && t < M.dur - 0.5 ? 1 : 0;
  // Her eyes on it for the beats, on you between.
  M.look = M.plan2.some((s) => t > s.t - 0.6 && t < s.t + 0.5) || t < 1.0 || (t % 2.2) < 1.4;
  for (const s of M.plan2) {
    if (s.done || t < s.t) continue;
    s.done = true;
    const key = s.key || M.key;
    // Turned down or off is never turned ON: a channel that ran out under
    // her thumb while she was getting to it stays off.
    if (s.down && rvtLevel(key) <= 0) continue;
    const r = rvtRemoteSet(key, s.lvl, s.secs || 0);
    // On the wand, her own lines for it (1.572.0).
    const say = key === 'wand' && s.say === 'remote' ? 'wandon' : key === 'wand' && s.say === 'remup' && Math.random() < 0.6 ? 'wandup' : s.say;
    if (say) rvtSay(say, say === 'remote' || say === 'wandon' || say === 'remoff' || !!M.act);
    rvtTrace({ pick: 'remote:' + key, why: (s.lvl ? 'level ' + (RVT.levels.indexOf(s.lvl) + 1) + '/4' : 'off') + ' (' + r + ')' });
    rvtNote('remote ' + key + ' ' + s.lvl);
  }
  if (t > M.dur) rvmEnd('done');
}

// ── you, asking ──────────────────────────────────────────────────────────────

/**
 * Your words for her moves (`revWords` answers 'rev.toy:<draw|tease|twist|
 * push>' and 'rev.remote:<on|up|down|off>'). Her hand: started now if she is
 * free, or as soon as she is (after an order you owe her, a round of hers).
 * Her remote: the channel changes now, with her line — and if she is free,
 * the phone in her hand with it.
 */
function rvtAsk(what) {
  if (!rev.on) return { ok: false, label: 'roles: not reversed' };
  if (rev.care) return { ok: false, label: 'chloe: not now — she is looking after you' };
  const ks = rvtWorn();
  const [kind0, act0] = what.split(':');
  if (!ks.length && !(kind0 === 'toy' && /^swap/.test(act0 || ''))) return { ok: false, label: 'chloe: you are not wearing a toy' };
  const [kind, act] = what.split(':');
  const M = typeof rvm !== 'undefined' ? rvm.move : null;
  // Her swap for the wand (1.572.0): 'toy:swap', 'toy:swap.front', 'toy:swap.back'.
  if (kind === 'toy' && /^swap/.test(act || '')) {
    if (M && M.id === 'swap') return { ok: false, label: 'chloe: she is on it already' };
    const hole = act === 'swap.back' ? 'back' : act === 'swap.front' ? 'front' : null;
    if (rvtWorn().includes('wand') && (!hole || rvtHoleOf('wand') === hole)) return { ok: false, label: 'chloe: the wand is in you already' };
    const P = rvtSwapPick(revView(), hole);
    if (typeof P === 'string') { rvtSay('toyno', true); return { ok: false, label: 'chloe: not now — ' + P }; }
    rvt.ask = { kind: 'swap', hole: P.hole, t: rev.clock };
    return { ok: true, label: 'chloe: the wand, ' + (P.hole === 'back' ? 'behind' : 'in front') + (P.old ? ' (the ' + P.old + ' out first)' : '') + (rvtFree() ? '' : ' (when she is free)') };
  }
  if (kind === 'toy') {
    if (act === 'push') {
      if (M && M.id === 'toy' && M.ph === 'draw') { M.push = true; return { ok: true, label: 'chloe: pushes it back in' }; }
      if (rvt.ask && rvt.ask.kind === 'toy') { rvt.ask = null; return { ok: true, label: 'chloe: leaves it where it is' }; }
      return { ok: false, label: 'chloe: it is all the way in' };
    }
    if (M && M.id === 'toy') return { ok: false, label: 'chloe: her hand is on it already' };
    const v = revView();
    const ok = ks.filter((k) => rvtReach(k, v) === true);
    if (!ok.length) {
      rvtSay('toyno', true);
      const why = ks.map((k) => k + ': ' + rvtReach(k, v)).join(', ');
      return { ok: false, label: 'chloe: she cannot reach it from there (' + why + ') — on your front, on all fours, or legs up' };
    }
    const key = ok.includes(rvt.lastKey) && ok.length > 1 && Math.random() < 0.5 ? rvt.lastKey : ok[Math.floor(Math.random() * ok.length)];
    rvt.ask = { kind: 'toy', var: act === 'draw' ? 'draw' : act, key, t: rev.clock };
    return { ok: true, label: 'chloe: ' + (act === 'tease' ? 'teases you with the ' : act === 'twist' ? 'twists the ' : 'draws out the ') + key + (rvtFree() ? '' : ' (when she is free)') };
  }
  if (kind === 'remote') {
    const running = ks.filter((k) => rvtLevel(k) > 0);
    const key = running.length ? running[0] : ks.includes(rvt.lastKey) ? rvt.lastKey : ks[0];
    const pre = { key, act };
    const L = RVT.levels, cur = rvtLevel(key);
    if (act === 'off' && !running.length) return { ok: false, label: 'chloe: it is off already' };
    // The channel now, whatever she is doing; the phone in her hand if she is free.
    if (rvtFree() && typeof rvmStart === 'function') {
      rvt.pre = pre;
      const r = rvmStart('remote', 'asked');
      if (r === true) return { ok: true, label: 'chloe: the remote — ' + act };
      rvt.pre = null;
    }
    const plan = rvtRemotePlan({ key, act });
    for (const s of plan) {
      if (s.down && rvtLevel(s.key || key) <= 0) continue;
      rvtRemoteSet(s.key || key, s.lvl, s.secs || 0);
      if (s.say) rvtSay(s.say, true);
    }
    return { ok: true, label: 'chloe: the remote — ' + act + ' (' + key + ', was ' + (cur ? Math.round(cur * 4) + '/4' : 'off') + ')' };
  }
  return { ok: false, label: 'chloe: ?' };
}

/**
 * YOUR WORDS FOR IT, the whole line (normalised: lower case, no accents),
 * from `revWords`: 'rev.toy:draw' | ':tease' | ':twist' | ':push',
 * 'rev.remote:on' | ':up' | ':down' | ':off', or null. English, Croatian,
 * French. The remote's come first: "turn it up" is not a twist.
 */
const RVT_TOY = '(it|(the |my |your )?(plug|butt ?plug|toy|lovense|lovens|lovesense|vibe|vibrator|egg|cep|wand|g ?spot( vibe| vibrator| wand| toy)?))';
// The wand (1.572.0): "use the wand", "put the wand in", "swap it for the
// wand", "the big one" — and, with a hole, "the wand in my ass", "...in my
// pussy", "stavi mi štapić", "mets la baguette". Before the rest: "put the
// wand in" is not "push it back in".
const RVT_WAND = '((the |your |that |a )?(pink |big )?(wand|g ?spot( vibe| vibrator| wand| toy)?|big (one|toy|vibe)|pink (one|toy)|stapic|baguette))';
const RVT_SWAPW = new RegExp('^((please )?((use|try|get|grab|bring) ' + RVT_WAND + '( on me| for me)?|(put|stick|slide) ' + RVT_WAND + '|(swap|switch|trade|change) (it|that|the toy|toys|the toys)( out)? for ' + RVT_WAND + '|(stavi|daj|uzmi) (mi )?' + RVT_WAND + '|(utilise|mets)[- ](moi )?' + RVT_WAND + '|' + RVT_WAND + ')( in( me)?| (in|into) (my|me|the|your) \\w+| up (my|me) \\w+| in front| behind| u \\w+| dans \\w+( \\w+)?)?( please)?)$');
const RVT_WORDS = [
  ['rev.remote:up', new RegExp('^((turn|crank|switch) ' + RVT_TOY + ' up|(make it )?stronger( please)?|(more|higher) (vibration|power|intensity)|jace|pojacaj( ga| to| jace| malo)?|plus fort|augmente[- ]le)$')],
  ['rev.remote:down', new RegExp('^((turn|switch) ' + RVT_TOY + ' down|(make it )?(softer|weaker|gentler)( please)?|slabije|(smanji|stisaj)( ga| to| malo)?|moins fort|baisse[- ]le)$')],
  ['rev.remote:off', new RegExp('^((turn|switch|shut) ' + RVT_TOY + ' off|(turn|switch|shut) off ' + RVT_TOY + '|(ugasi|iskljuci)( ga| to| cep| plug| lovense)?|eteins[- ]le|arrete la vibration)$')],
  ['rev.remote:on', new RegExp('^((turn|switch) ' + RVT_TOY + ' on|(turn|switch) on ' + RVT_TOY + '|(buzz|vibrate)( me| it)?|(use|get) (the |your )?remote|(upali|ukljuci)( ga| to| cep| plug| lovense)?|allume[- ]le)$')],
  ['rev.toy:push', new RegExp('^((push|put|slide) ' + RVT_TOY + ' (back )?in( please)?|(push|put) it back|back in|(gurni|vrati|stavi) ga( natrag| nazad| unutra)?|(remets?|renfonce|enfonce)[- ]le)$')],
  ['rev.toy:tease', new RegExp('^(tease me( with it)?|(pull it )?(in and out|out and in)( slowly)?|van[- ]unutra|unutra[- ]van|izvuci (ga )?pa vrati|dedans[- ]dehors|dehors[- ]dedans)$')],
  ['rev.toy:twist', new RegExp('^((twist|rotate|turn) ' + RVT_TOY + '( a (bit|little))?|(zavrti|okreni) (ga|cep)( malo)?|tourne[- ]le)$')],
  ['rev.toy:draw', new RegExp('^((pull|take|draw|ease) ' + RVT_TOY + ' out( a (little )?bit| a little( way)?| slowly| partway| halfway)?( please)?|(pull|take|draw) out ' + RVT_TOY + '( a (little )?bit| a little| slowly)?|izvuci( ga| cep| plug)?( malo| polako| (do )?pola)?|izvadi ga malo|(tire|sors)[- ]le( un peu| doucement)?)$')],
];
function rvtWords(t) {
  if (RVT_SWAPW.test(t)) {
    if (/\b(ass|butt|bum|back|behind|bottom|guzu|dupe|cul|derriere|fesses)\b/.test(t)) return 'rev.toy:swap.back';
    if (/\b(pussy|front|cunt|vagina|picku|picu|chatte)\b/.test(t)) return 'rev.toy:swap.front';
    return 'rev.toy:swap';
  }
  for (const [name, re] of RVT_WORDS) if (re.test(t)) return name;
  return null;
}

/** Whether she can take a move now: no order owed, no round, no move of hers. */
function rvtFree() {
  return rev.on && !rev.care && !rev.dom.order && rev.arm.mode !== 'spank' && !(typeof rvm !== 'undefined' && rvm.move)
    && !(typeof rvkBusy === 'function' && rvkBusy()) && !(typeof rvkHandFull === 'function' && rvkHandFull());
}

// ── the frame ───────────────────────────────────────────────────────────────

/**
 * Each frame from `revTick`, before her moves are ticked: what her palm was
 * drawn at against where it was sent (the frame before), a draw left out
 * going back to its seat, a move you asked for once she is free, and her
 * phone on her hand.
 */
function rvtTick(dt) {
  if (!rev.on) return;
  // Measured: the palm as drawn against the grip point it was sent to.
  if (rvt.sent && rvt.sent.C) {
    const p = rvmPalm('R', _tA);
    if (p) {
      const e = p.distanceTo(rvt.sent.C);
      const v = revView();
      const H = rvm.last && rvm.last.R;
      rvt.line.push({ t: +rev.clock.toFixed(2), key: rvt.sent.key, ph: rvt.sent.ph, d: +((rvt.sent.d || 0) * 1000).toFixed(1),
        err: +(e * 1000).toFixed(1), ctx: v ? v.ctx : null, phase: v ? v.phase : null, hand: H ? H.hand : null });
      if (rvt.line.length > 2000) rvt.line.shift();
    }
    rvt.sent = null;
  }
  if (rvt.reseat) {
    const R = rvt.reseat;
    R.t += dt;
    const k = 1 - _sm(R.t / R.T);
    jadrija.draw(R.key, R.d0 * k, R.tw0 * k);
    if (R.t >= R.T) { jadrija.draw(R.key, 0, 0); rvt.reseat = null; }
  }
  if (rvt.ask && rvtFree()) {
    const A = rvt.ask;
    rvt.ask = null;
    if (A.kind === 'swap') {
      if (rev.clock - A.t < 30) {
        rvt.pre = { hole: A.hole };
        const r = rvmStart('swap', 'asked');
        if (r !== true) { rvt.pre = null; rvtTrace({ pick: 'swap:asked', why: String(r) }); }
      }
    } else if (rev.clock - A.t < 30) {
      rvt.pre = { key: A.key, kind: A.var };
      const r = rvmStart('toy', 'asked');
      if (r !== true) { rvt.pre = null; rvtTrace({ pick: 'toy:asked', why: String(r) }); }
    }
  }
  rvtWandFelt(dt);
  rvt.shiver *= Math.exp(-3.5 * dt);
  rvtPhonePlace();
}

/** Her look while she does it: the base under her hand, or the phone. */
function rvtLookAt() {
  const M = typeof rvm !== 'undefined' ? rvm.move : null;
  if (!M) return null;
  if (M.id === 'swap') {
    if (M.carry) return M.carry.position.clone();
    if (M.ph === 'take') return jadrija.toyProp('wand');
    if (M.ph === 'put') return rvtHomeAt(M.carryKey);
    const g = M.key && jadrija.grip ? jadrija.grip(M.key) : null;
    return M.ph !== 'go' && M.ph !== 'home' && M.ph !== 'fetch' && g ? g.p : null;
  }
  if (M.id === 'toy' && M.ph !== 'go') {
    // Mostly on it; now and then up at your face.
    if ((rev.clock % 4.5) > 3.6) return null;
    const g = jadrija.grip(M.key);
    return g ? g.p : null;
  }
  if (M.id === 'remote' && M.look && rvt.phone && rvt.phone.g.visible) return rvt.phone.g.position.clone();
  return null;
}

/** Your view's shiver (`revCamera`, first person): [pitch, roll], rad. */
function rvtCamTilt() {
  const s = rvt.shiver;
  if (s < 0.004) return null;
  const c = rev.clock;
  return [0.010 * s * Math.sin(c * 23.0), 0.012 * s * Math.sin(c * 31.0 + 1.3)];
}

/** The scene's part (`revScene`): which toy is drawn partway out, and the remote's level, 0..4. */
function rvtScene(o) {
  for (const k of rvtWorn()) {
    const s = jadrija.draw ? jadrija.draw(k) : null;
    if (s && s.d > 0.003) o.toy_drawn = k;
  }
  let lv = 0;
  for (const k of rvtWorn()) lv = Math.max(lv, rvtLevel(k));
  if (lv > 0) o.remote_level = Math.max(1, Math.round(lv * 4));
}

/** The HUD's tag: the remote's level, while it runs. */
function rvtHudTag() {
  let lv = 0;
  for (const k of rvtWorn()) lv = Math.max(lv, rvtLevel(k));
  if (!lv) return '';
  const n = Math.max(1, Math.round(lv * 4));
  return 'REMOTE ' + '▮'.repeat(n) + '▯'.repeat(4 - n);
}

/** The safeword's part: the draw back to its seat, her hand off, her remote off. */
function rvtSafe() {
  rvt.ask = null; rvt.pre = null; rvt.wandUp = 0;
  for (const k of rvtWorn()) {
    if (rvtLevel(k) > 0 && jadrija.remote) jadrija.remote(k, false);
    const s = jadrija.draw ? jadrija.draw(k) : null;
    if (s && (s.d > 0.0002 || Math.abs(s.tw) > 0.002) && !(rvt.reseat && rvt.reseat.key === k)) {
      rvt.reseat = { key: k, d0: s.d, tw0: s.tw, t: 0, T: RVT.reseatSafe };
    }
  }
  rvt.phoneOn = 0;
  rvtPhonePlace();
}

/** Swapped back or left: everything of this seated and put away at once. */
function rvtClear() {
  rvt.ask = null; rvt.pre = null; rvt.reseat = null; rvt.sent = null; rvt.shiver = 0;
  rvt.phoneOn = 0;
  if (rvt.phone) rvt.phone.g.visible = false;
  if (jadrija && jadrija.draw) for (const k of rvtWorn()) {
    jadrija.draw(k, 0, 0);
    // Back to full for whoever turns it on next, if it is still running.
    if (rvtLevel(k) > 0 && jadrija.remoteLevel) jadrija.remoteLevel(k, 1);
  }
}

// ── the wand: her swap (1.572.0) ─────────────────────────────────────────────

/**
 * HER SWAP. Misha, 2 Oct 2026, of the third toy: *"it can go into either
 * hole, for a more intense experience"* — and the night loop's item 10: she
 * can swap it in for the Lovense or the plug as a move of hers.
 *
 * One move, in stages, all of them hers:
 *
 *   go/reach/grip   her hand on the toy in that hole, the way her draw
 *                   starts (`rvtHand`) — skipped if the hole is empty
 *   pull            drawn all the way out of you (its own `DRAW.max`, then
 *                   off you: `toyTake`), and in her right hand
 *   home            walked back to where it lives — the plug's shelf, the
 *                   Lovense's stool — and set down there (`toyHome`)
 *   fetch           to the shelf for the wand (`toyMark`), off it into her
 *                   hand (`toyTake`)
 *   back            to you, planned to the wand's grip as it will sit
 *                   (`toyMountAt`) — kneeling by the cot for a low one
 *   insert          into you 45 mm out (`toyIn`), and her hand pushes it
 *                   home along its own curve, slowly
 *
 * The safeword over all of it (`rvtEnd`): a toy in her hand goes to its
 * place, and a wand partway in is seated, its remote off.
 */
const RVT_SWAP = { pull: 0.9, put: 0.85, take: 0.85, push: 1.6, dmax: 0.045, carryUp: -0.30 };

/** Which hole a worn toy is in. */
function rvtHoleOf(key) {
  if (key === 'plug') return 'back';
  if (key === 'lovense') return 'front';
  const h = jadrija.toyHoles ? jadrija.toyHoles() : null;
  return h && h.back === 'wand' ? 'back' : 'front';
}

/** Where a toy lives when it is not in anybody, world. */
function rvtHomeAt(key) {
  const K = jadrija.kabina && jadrija.kabina.kit ? jadrija.kabina.kit() : null;
  const sp = !K ? null : key === 'plug' ? K.plugSpot : key === 'wand' ? K.wandSpot : K.spot;
  if (!sp) return null;
  const w = jadrija.toWorld(sp[0], sp[1]);
  return new THREE.Vector3(w[0], sp[2], w[2]);
}

/** Whether her hand could get the wand in that hole, where you are. */
function rvtSwapReach(hole, v) {
  const ctxT = RVT_CTX[hole === 'back' ? 'plug' : 'lovense'];
  if (!v || !v.ctx || !ctxT[v.ctx]) return 'not from here';
  const m = jadrija.toyMountAt ? jadrija.toyMountAt('wand', hole) : null;
  if (!m) return 'no mount';
  const A = m.p.clone().addScaledVector(m.out, 0.10);
  if (v.onBed) {
    const G = typeof rvmCotGeom === 'function' ? rvmCotGeom() : null;
    if (G && A.y < G.top + 0.02) return 'against the mattress';
  } else if (A.y < rev.ch.y + 0.08) return 'against the floor';
  return true;
}

/** Can she swap now, and into which hole: { hole, old } or a reason. */
function rvtSwapPick(v, want) {
  if (!jadrija.toyProp || !jadrija.toyProp('wand')) return 'the wand is not on the shelf';
  if (!rvtHomeAt('wand')) return 'no shelf';
  const H = (jadrija.toyHoles && jadrija.toyHoles()) || {};
  const holes = want ? [want] : ['front', 'back'].filter((h) => H[h]).concat(['front', 'back'].filter((h) => !H[h]));
  const why = [];
  for (const h of holes) {
    const r = rvtSwapReach(h, v);
    if (r === true) return { hole: h, old: H[h] || null };
    why.push(h + ': ' + r);
  }
  return why.join(', ');
}

function rvtSwapStart(M, v, pre) {
  const P0 = rvtSwapPick(v, pre && pre.hole);
  if (typeof P0 === 'string') return P0;
  M.kind = 'swap';
  M.hole = P0.hole; M.old = P0.old; M.key = P0.old || 'wand';
  M.dur = 90; M.carry = null; M.carryKey = null;
  if (M.old) {
    const g = jadrija.grip(M.old);
    if (!g) return 'not worn';
    const C = g.wand ? g.p.clone() : g.p.clone().addScaledVector(g.out, RVT.palmOff[M.old]);
    const pref = new THREE.Vector3(g.out.x, 0, g.out.z);
    const o = Object.assign({ bowMax: RVT.bowMax, reach: RVT.reach }, pref.lengthSq() > 0.01 ? { prefer: pref.normalize(), preferK: 0.6 } : {});
    if (rev.walk) { o.ring = [0.62, 0.68, 0.75]; if (C.y - rev.ch.y < 1.0) o.mode = 'kneel'; }
    const P = rvmPlan([{ s: 'R', T: C, n: g.out }], o) || rvmPlan([{ s: 'R', T: C, n: g.out }], Object.assign({ mode: 'kneel' }, o));
    if (!P) return 'noplace';
    M.plan = P;
    M.ph = 'go';
  } else {
    M.ph = 'fetchGo';
  }
  rvt.lastKey = 'wand';
  return true;
}

/** Her right hand carrying a toy at her side, palm in. */
function rvtCarryHand() {
  const sh = rvmShoulder('R', _tB);
  if (!sh) return;
  const { f, r } = rvmAxes(rev.ch.yaw);
  const C = sh.clone().addScaledVector(f, 0.24).addScaledVector(r, 0.02).add(_tA.set(0, RVT_SWAP.carryUp, 0));
  rvmAsk('R', { C, n: r.clone(), d: f.clone(), pole: r.clone().add(_tA.set(0, -0.6, 0)), cock: 0, shape: 'pinch', rate: 6 });
}

/** The toy in her hand: in her fist, its long way across her palm. */
function rvtCarryPlace(M) {
  const m = M.carry;
  if (!m || !you || !you.fig) return;
  const f = you.fig, ih = f.boneIndex('handR');
  if (ih < 0) return;
  const HB = rvmHandBind('R');
  _tQ.copy(you.mesh.quaternion).multiply(f.boneTurn(ih, new THREE.Quaternion()));
  const d = _tA.copy(HB.d).applyQuaternion(_tQ).normalize();
  const n = _tB.copy(HB.n).applyQuaternion(_tQ).normalize();
  const palm = rvmPalm('R', new THREE.Vector3());
  if (!palm) return;
  const y = new THREE.Vector3().crossVectors(n, d).normalize();
  const z = n.clone();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  m.quaternion.setFromRotationMatrix(_tM.makeBasis(x, y, z));
  // Its grip in her fist: the wand's handle (its origin), the plug's waist.
  const mid = M.carryKey === 'plug' ? 0.052 : 0;
  m.position.copy(palm).addScaledVector(n, 0.016).addScaledVector(d, 0.02).addScaledVector(y, -mid);
  m.visible = true;
}

/** Her hand reaching to a world point `T` (a shelf, a stool), palm down to it. */
function rvtHandTo(T) {
  const { f, r } = rvmAxes(rev.ch.yaw);
  const n = _tC.set(0, 1, 0);
  rvmAsk('R', { C: T.clone().add(_tA.set(0, 0.035, 0)), n: n.clone(), d: f.clone(), pole: r.clone().add(_tA.set(0, -0.5, 0)), cock: 0, shape: 'pinch', rate: 7 });
}

/** Walk her to a toy's place: its fetch mark, facing the place. */
function rvtWalkTo(key) {
  const mk = jadrija.toyMark ? jadrija.toyMark(key) : null;
  const H = rvtHomeAt(key);
  if (!mk || !H) return false;
  rvmWant('stand');
  rvm.body.bowTo = 0; rvm.body.wTo = 0;
  revGo(mk[0], mk[1]);
  rev.ch.face = new THREE.Vector3(H.x, rev.ch.y, H.z);
  return true;
}

function rvtSwapTick(M, dt) {
  const tt = M.t - (M.t0 || 0);
  const next = (ph) => { M.ph = ph; M.t0 = M.t; };
  if (M.carry) { rvtCarryPlace(M); }
  if (M.ph === 'go') {
    if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
    if (rvmSettled() || M.t > 7) { next('reach'); rvm.body.bowTo = M.plan.bow; rvm.body.wTo = M.plan.w || 0; }
    return;
  }
  if (M.ph === 'reach' || M.ph === 'grip' || M.ph === 'pull') {
    if (!rvtWorn().includes(M.old)) { rvmEnd('toy gone'); return; }
    const C = rvtHand(M, dt);
    if (M.ph === 'reach') {
      const sh = rvmShoulder('R', _tB);
      if (sh && C) {
        const need = sh.distanceTo(C) - RVM.reach;
        rvm.body.bowTo = Math.max(0, Math.min(RVM.bowMax + 0.2, rvm.body.bowTo + need * Math.min(1, dt * 3)));
      }
      const palm = rvmPalm('R', _tC);
      M.err0 = palm && C ? palm.distanceTo(C) : 9;
      if ((rvm.k.R > 0.97 && M.err0 < 0.025) || tt > RVT.reachMax) {
        if (M.err0 > 0.07) { rvtTrace({ pick: 'swap:reach', why: (M.err0 * 100).toFixed(0) + ' cm off — letting go' }); rvmEnd('out of reach'); return; }
        next('grip');
        rvm.body.bowTo = rvm.body.bow; rvm.body.wTo = rvm.body.w;
      }
      return;
    }
    if (M.ph === 'grip') {
      if (tt > RVT.grip) { next('pull'); rvtSay('swap', true); rvtTrace({ pick: 'toy:swap:' + M.old + '→wand:' + M.hole, why: 'heat ' + rev.dom.heat.toFixed(2) }); }
      return;
    }
    // Out, all the way, and off you into her hand.
    const D = (jadrija.drawMax ? jadrija.drawMax(M.old) : 0.03) || 0.03;
    jadrija.draw(M.old, D * _sm(tt / RVT_SWAP.pull));
    if (tt >= RVT_SWAP.pull) {
      rvtFelt(M, 'out', 0.03);
      M.carry = jadrija.toyTake(M.old);
      M.carryKey = M.old;
      if (!M.carry || !rvtWalkTo(M.old)) { rvmEnd('nowhere to put it'); return; }
      next('home');
    }
    return;
  }
  if (M.ph === 'home') {
    rvtCarryHand();
    if (revAt() && tt > 0.5) next('put');
    else if (tt > 12) { rvmEnd('stuck'); }
    return;
  }
  if (M.ph === 'put') {
    const H = rvtHomeAt(M.carryKey);
    rvtHandTo(H);
    if (tt >= RVT_SWAP.put) {
      jadrija.toyHome(M.carryKey, M.carry);
      M.carry = null; M.carryKey = null;
      // The wand is on the same shelf as the plug: straight to it.
      const W = rvtHomeAt('wand');
      const here = jadrija.toyMark('wand');
      if (here && Math.hypot(here[0] - rev.ch.x, here[1] - rev.ch.z) < 0.35) { rev.ch.face = new THREE.Vector3(W.x, rev.ch.y, W.z); next('take'); }
      else { rvtWalkTo('wand'); next('fetch'); }
    }
    return;
  }
  if (M.ph === 'fetchGo') {
    if (!rvtWalkTo('wand')) { rvmEnd('no shelf'); return; }
    rvtSay('swap', true);
    rvtTrace({ pick: 'toy:swap:→wand:' + M.hole, why: 'heat ' + rev.dom.heat.toFixed(2) });
    next('fetch');
    return;
  }
  if (M.ph === 'fetch') {
    if (revAt() && tt > 0.5) next('take');
    else if (tt > 12) rvmEnd('stuck');
    return;
  }
  if (M.ph === 'take') {
    const P = jadrija.toyProp('wand');
    if (!P) { rvmEnd('wand gone'); return; }
    rvtHandTo(P);
    if (tt >= RVT_SWAP.take) {
      M.carry = jadrija.toyTake('wand');
      M.carryKey = 'wand';
      const m = jadrija.toyMountAt('wand', M.hole);
      if (!M.carry || !m) { rvmEnd('no wand'); return; }
      const C = m.grip.clone().addScaledVector(m.out, RVT_SWAP.dmax);
      const pref = new THREE.Vector3(m.out.x, 0, m.out.z);
      const o = Object.assign({ bowMax: RVT.bowMax, reach: RVT.reach }, pref.lengthSq() > 0.01 ? { prefer: pref.normalize(), preferK: 0.6 } : {});
      if (rev.walk) { o.ring = [0.62, 0.68, 0.75]; if (C.y - rev.ch.y < 1.0) o.mode = 'kneel'; }
      const P2 = rvmPlan([{ s: 'R', T: C, n: m.out }], o) || rvmPlan([{ s: 'R', T: C, n: m.out }], Object.assign({ mode: 'kneel' }, o));
      if (!P2) { rvmEnd('noplace'); return; }
      M.plan = P2;
      rvmGoPlan(P2);
      next('back');
    }
    return;
  }
  if (M.ph === 'back') {
    rvtCarryHand();
    if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
    if (rvmSettled() || tt > 10) { next('reach2'); rvm.body.bowTo = M.plan.bow; rvm.body.wTo = M.plan.w || 0; }
    return;
  }
  if (M.ph === 'reach2') {
    const m = jadrija.toyMountAt('wand', M.hole);
    if (!m) { rvmEnd('no mount'); return; }
    const C = rvtWandHold(m.grip.clone().addScaledVector(m.out, RVT_SWAP.dmax), m.out.clone().negate(), 0.0172, true);
    const sh = rvmShoulder('R', _tB);
    if (sh) {
      const need = sh.distanceTo(C) - RVM.reach;
      rvm.body.bowTo = Math.max(0, Math.min(RVM.bowMax + 0.2, rvm.body.bowTo + need * Math.min(1, dt * 3)));
    }
    const palm = rvmPalm('R', _tC);
    const err = palm ? palm.distanceTo(C) : 9;
    if ((rvm.k.R > 0.95 && err < 0.04) || tt > RVT.reachMax) {
      const r2 = jadrija.toyIn('wand', M.hole, M.carry, RVT_SWAP.dmax);
      M.carry = null; M.carryKey = null;
      if (r2 !== 'on') { rvmEnd('could not: ' + r2); return; }
      M.key = 'wand';
      M.d = RVT_SWAP.dmax;
      next('insert');
    }
    return;
  }
  if (M.ph === 'insert') {
    const d = RVT_SWAP.dmax * (1 - _sm(tt / RVT_SWAP.push));
    jadrija.draw('wand', d);
    M.d = d;
    M.maxD = Math.max(M.maxD || 0, d);
    rvt.sent = { C: rvtHand(M, dt), key: 'wand', ph: 'in', d };
    if (tt >= RVT_SWAP.push) {
      jadrija.draw('wand', 0);
      M.d = 0;
      rvtFelt(M, 'in', 0.04);
      rvtSay('swapin', true);
      next('let');
    }
    return;
  }
  if (M.ph === 'let') {
    if (tt < RVT.let) { rvt.sent = { C: rvtHand(M, dt), key: 'wand', ph: 'let', d: 0 }; return; }
    rvmEnd('done');
  }
}

/**
 * ── AND WHILE IT RUNS IN YOU ─────────────────────────────────────────────
 *
 * The Lovense and the plug reach you as your lips and eyes on their beat.
 * The wand is more: on top of that, your view trembles with it (`rvtCamTilt`,
 * worth what the pulse is), your breath catches on its strong pulses (Baye's
 * own gasps, louder the higher she has it), and on the hardest of them your
 * back gives under it (the flinch spring) — `RVT.wandX` times what the same
 * level of the Lovense would be, which is nothing.
 */
function rvtWandFelt(dt) {
  if (!rvtWorn().includes('wand')) { rvt.wandUp = 0; return; }
  const lv = rvtLevel('wand');
  if (!lv) { rvt.wandUp = 0; return; }
  const T = jadrija.toyView ? jadrija.toyView() : null;
  const k = T ? Math.min(1.3, T.beat) : lv;
  rvt.shiver = Math.max(rvt.shiver, 0.30 * k * RVT.wandX);
  const up = k > 0.55;
  if (up && !rvt.wandUp) {
    rvt.wandPulses = (rvt.wandPulses || 0) + 1;
    const A = typeof audio !== 'undefined' && audio ? audio : null;
    if (A && A.herGasp && Math.random() < 0.35 + 0.5 * lv) A.herGasp(0.2 + 0.45 * lv, true, 0.2 + Math.random() * 0.3);
    if (lv >= 0.7 && typeof rvmFlinch === 'function') {
      const g = jadrija.grip ? jadrija.grip('wand') : null;
      if (g) { rvmFlinch(g.out.clone().negate(), 1.2 + 1.6 * lv); rvm.flinch.push = 0; }
    }
  }
  rvt.wandUp = up;
}

// The help sheet, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.revtoys': 'roles reversed, wearing the plug, the Lovense or the wand: Chloe draws it partway out and back on her own, and uses her remote. Ask her: "pull it out a bit", "tease me", "twist it", "push it back in"; "turn it on", "turn it up", "turn it down", "turn it off"; and "use the wand" (in front) or "the wand in my ass" — she swaps it in',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.revtoys': 'zamijenjene uloge, s čepom, Lovenseom ili štapićem: Chloe ga sama malo izvuče i vrati, i koristi daljinski. Zamoli je: "izvuci malo", "van-unutra", "okreni ga", "vrati ga unutra"; "upali", "pojačaj", "slabije", "ugasi"; i "use the wand" — stavi ti štapić',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.revtoys': 'rôles inversés, avec le plug, le Lovense ou la baguette : Chloe le retire un peu et le remet d’elle-même, et se sert de la télécommande. Demandez-lui : « tire-le un peu », « dedans-dehors », « tourne-le », « remets-le » ; « allume-le », « plus fort », « moins fort », « éteins-le » ; et « use the wand » — elle vous la met',
  });
}

// Her hand pinched round a base: the fingers half closed, the thumb across.
if (typeof RVM !== 'undefined') RVM.hands.pinch = [0.72, 0.62];

/** `__fr.reverse.toys` — see 49-reverse.js. */
const rvtApi = {
  /** Start her hand on a toy: kind 'draw' | 'tease' | 'twist', key 'plug' | 'lovense'. */
  start: (kind = 'draw', key = null) => { rvt.pre = { kind, key }; const r = rvmStart('toy', 'probe'); if (r !== true) rvt.pre = null; return r; },
  remote: (act = null, key = null) => { rvt.pre = { act, key }; const r = rvmStart('remote', 'probe'); if (r !== true) rvt.pre = null; return r; },
  /** Her swap for the wand (1.572.0): `swap(hole)` — 'front' | 'back' | null (hers to choose). */
  swap: (hole = null) => { rvt.pre = { hole }; const r = rvmStart('swap', 'probe'); if (r !== true) rvt.pre = null; return r; },
  swapPick: (hole = null) => rvtSwapPick(revView(), hole),
  ask: (what) => rvtAsk(what),
  reach: () => { const v = revView(); const o = {}; for (const k of rvtWorn()) o[k] = rvtReach(k, v); return o; },
  /** Debug: where she would go for `key` — the plan, standing and kneeling. */
  plan: (key = 'plug', opt = {}) => {
    const g = jadrija.grip(key);
    if (!g) return null;
    const C = g.p.clone().addScaledVector(g.out, RVT.palmOff[key]);
    const t = (o) => { const P = rvmPlan([{ s: 'R', T: C, n: g.out }], Object.assign({ bowMax: RVT.bowMax, reach: RVT.reach }, opt, o)); return P ? { x: +P.x.toFixed(2), z: +P.z.toFixed(2), mode: P.mode, bow: +P.bow.toFixed(2), score: +P.score.toFixed(2) } : null; };
    const why = {};
    const k2 = t({ mode: 'kneel', why });
    return { C: rvmV(C), out: rvmV(g.out), ch: rvmV(new THREE.Vector3(rev.ch.x, rev.ch.y, rev.ch.z)), def: t({}), kneel: k2, why,
      stand: t({ mode: 'stand' }), head15: t({ mode: 'kneel', headR: 0.15 }) };
  },
  /** The palm-to-grip timeline (mm), `reset` clears; `stats` by pose and phase. */
  line: (reset = false) => { const a = rvt.line.slice(); if (reset) rvt.line.length = 0; return a; },
  stats: () => {
    const by = {};
    for (const e of rvt.line) { const k = e.key + ':' + e.phase + ':' + e.ph; (by[k] = by[k] || []).push(e.err); }
    const o = {};
    for (const k of Object.keys(by)) {
      const L = by[k].slice().sort((x, y) => x - y);
      o[k] = { n: L.length, mean: +(L.reduce((x, y) => x + y, 0) / L.length).toFixed(1), med: L[L.length >> 1], max: L[L.length - 1] };
    }
    // And the hand's turn off the forearm (deg), by pose.
    const hb = {};
    for (const e of rvt.line) if (e.hand != null) { const k = e.key + ':' + e.phase; (hb[k] = hb[k] || []).push(e.hand); }
    for (const k of Object.keys(hb)) {
      const L = hb[k];
      o['hand ' + k] = { mean: Math.round(L.reduce((x, y) => x + y, 0) / L.length), max: Math.max(...L) };
    }
    return o;
  },
  state: () => {
    const M = typeof rvm !== 'undefined' ? rvm.move : null;
    const o = { move: M && (M.id === 'toy' || M.id === 'remote' || M.id === 'swap') ? { id: M.id, key: M.key, kind: M.kind, ph: M.ph, part: M.part,
      hole: M.hole || null, old: M.old || null, carry: M.carryKey || null,
      d: M.d != null ? +(M.d * 1000).toFixed(1) : null, tw: M.tw != null ? +(M.tw * 57.3).toFixed(0) : null, i: M.i,
      n: M.cyc ? M.cyc.length : null, err0: M.err0 != null ? +(M.err0 * 1000).toFixed(1) : null, felt: M.felt || 0,
      plan: M.plan ? { mode: M.plan.mode, bow: +M.plan.bow.toFixed(2) } : null } : null,
    plan: rvm.plan,
    ask: rvt.ask, reseat: rvt.reseat ? { key: rvt.reseat.key, t: +rvt.reseat.t.toFixed(2) } : null,
    phone: !!(rvt.phone && rvt.phone.g.visible), shiver: +rvt.shiver.toFixed(2), wandPulses: rvt.wandPulses || 0, log: rvt.log.slice(-8) };
    for (const k of rvtWorn()) o[k] = { draw: jadrija.draw(k), level: rvtLevel(k) };
    return o;
  },
};

if (typeof REV_SAY !== 'undefined') Object.assign(REV_SAY, RVT_SAY);
if (typeof revApi !== 'undefined') revApi.toys = rvtApi;
