// -----------------------------------------------------------------------------
// Roles reversed: Chloe walks you round the kabina by your hair (1.584.0).
//
// Misha, 2 Oct 2026: *"can chloe ... pull her by the hair harder around the
// kabine?"* — and, of this and the pin on the cot, *"yes queue up both of
// them"*. The queue's item 1 (plan/queue-2026-10-02.md).
//
// The same two adults and the same consensual game as src/49-reverse.js, and
// the safeword over all of it: "red" and her fist opens on that frame, you
// stop where you are, and she goes to her aftercare as ever.
//
// WHAT IT IS. You on your feet. She comes to your side, takes a fistful of
// your hair at the back of your head (the grab of 1.574.0, `hairGrab`) with
// the hand on your side, and sets off round the room with you at arm's length
// off her hip, your head pulled over toward her hand. Her right hand with you
// on her right by preference, her left with you on her left where the room
// has no walk for the other (`rvd.sg`). It is the collar's walk with her fist
// instead of the leash:
//
//   - HER PATH through the hut: legs she plans so that she AND you, a body's
//     width off her side, stay clear of the walls, the cot, the tabouret, the
//     set's stand and the radio's table (`rvdPlan`, checked every 15 cm along
//     both lines and round every turn — she turns away from you, so you swing
//     round the outside, at a rate her mood sets).
//   - HER PACE IS YOURS. Your body is towed after a spot off her hip
//     (`rvdTow`, from `revTick`): her speed, and a spring on how far you are
//     behind it, with a body's acceleration — so when she sets off sharply or
//     turns, you lag. Your keys only lean on it: holding back (S) drags your
//     feet, and that is a lag too. Her arm is only so long: past it, it takes
//     you with it; never nearer her than a body's width; never quicker than
//     a stumble; never through a wall.
//   - A YANK WHEN YOU LAG: past `lag` m behind, her fist jerks (`hairYank` in
//     43-jadrija.js, on top of the hold: more force and more draw for half a
//     second), you stumble a step after it, your view jolts with it, a gasp.
//   - YOUR HEAD is 1.545.0's `PULL_RAG` net — the same body the hair pull
//     moves (the body you are in IS Baye's) — with the pull aimed out past her
//     shoulder and a little back (`hairPullTune`), and its weight her mood's:
//     harder the further you lag, easing off past a bow of `headMost`.
//   - HER HAND is solved on to the fist every frame (`rvhHairHand`, the 1.574
//     pull's), and measured.
//
// HER MOOD (src/49-revmood.js) sets all of it: sterner, a faster walk, a harder
// hold, a shorter lag before she yanks, more legs, and yanks of her own to
// keep you smart; excited, quicker and in spurts, rough and playful, with
// yanks for the fun of it; warm, a slow stroll, a light hold, and a long
// leash of slack before she pulls at all.
//
// WHEN: asked ("drag me", "pull me by the hair", "vuci me za kosu",
// "traîne-moi par les cheveux", or Shift+.) — a beg, so it excites her too
// (`rmoodBeg('drag')`); or her own pick when she is stern or excited and you
// are standing. Not standing, she has you up first (1).
//
// THE LINE, as everywhere in this game: hair, the collar, spanks, toys and
// affection, never sex. Nothing here presses your bodies together — she
// keeps you a body's width off her side, and that is measured on the skin.
// -----------------------------------------------------------------------------

const RVD = {
  // Where you walk, off her right side and a little behind (m, her frame),
  // and where you stand while she takes hold — near enough for her arm to the
  // back of your head (0.44 m off her shoulder, `RVM.reach`).
  // (0.74 and 0.20 first: there her arm's reach — `reach` — pulled you in
  // while your place pushed you out, and the hair between snapped, 270 N
  // for a frame, your head wrenched round, MEASURED in the first second.)
  side: 0.68, back: 0.15, grabSide: 0.52, grabBack: 0.06, spread: 1.2,
  // The pull's aim: off her right hip (m out, m back) at this height off the
  // floor — your head drawn over to her, level. At her hip (1.02 m) the
  // first cut bowed your head 40-74 degrees and took the fist out of her
  // reach (MEASURED, 0.68-0.76 m off her shoulder); at her shoulder (0.18
  // out, 1.30 up) a yank brought your head up against her jaw (2-7 mm, skin
  // to skin, MEASURED); at 1.22 m, a body's width out, your crown went down
  // to her and your trunk folded away from her (70 degrees, photographed).
  // Out past her shoulder, a little behind her, at your own head's height:
  // your head turns to her and tips toward her hand, and stays up. The hand's draw past
  // the hair's length (PULL_RAG's own is 0.26, which put her fist on her own
  // shoulder at this distance), and no "out of your back" (the pull from
  // behind's): this one is sideways.
  eyeOut: 0.32, eyeBack: 0.15, eyeY: 1.45, draw: 0.14, outOf: 0.2,
  // Your head no further down than this (degrees off your pose, the net's
  // own measure): past it her hold eases off. MEASURED without it, an
  // excited yank put your head 74 degrees down, at the table's height, and
  // her fist 0.70 m off her shoulder.
  headMost: 32,
  // Your body after her: a spring on the miss (1/s), the most you walk
  // (m/s), and a body's acceleration (m/s²) — less than hers, so a sharp
  // start or a turn leaves you behind. Your keys: holding back counts this
  // much of the walker's own step against her.
  kp: 2.4, vMax: 1.75, accel: 1.8, resist: 0.45, assist: 0.15,
  // A yank: no sooner than `gap` s after the last; the stumble after it
  // (m/s at u = 1, decaying over `lurchTau` s); the pull's own extra (N and m
  // at u = 1 — see `hairYank`).
  arm: 0.62, reach: 0.50, near: 0.60, inWall: 0.26, turn: 2.2, vTop: 1.9,
  gap: 1.3, lurch: 0.95, lurchTau: 0.28, yankF: 90, yankDraw: 0.12,
  // Clear of the room: m from any wall for both of you, and the room's own
  // collider (girth 0.26 m indoors) at every sample.
  wall: 0.32, step: 0.15, body: 0.22,
  // s: to get to you and take hold before she gives up; the hold's ease out.
  goT: 7, reachT: 2.6, outT: 0.7,
  // s before she picks it again on her own.
  cool: 32,
};

/** Her lines: the beat's own (neutral); the tone pools are in RMOOD_SAY below. */
const RVD_SAY = {
  hair_drag: ['Come on. Walk.', 'Mm. This way, babe.', "With me. Let's go."],
  drag_yank: ['Keep up.', 'Hm? Faster.', 'This way.'],
  drag_walk: ['And round we go.', 'One more lap.', 'Little tour of the room.'],
  drag_done: ['Okay. Stay right there.', 'There. Good.'],
};
const RVD_MOOD_SAY = {
  hair_drag: {
    stern: ['Move. Now.', "You're coming with me.", "Walk. Don't make me pull harder.", 'Head down. Walk.',
      'Keep up, or I yank.', 'Up straight? No. Walk.'],
    warm: ['Easy... come with me, babe.', "Slowly. I've got you.", 'Little walk, okay? With me.',
      'Gentle. Just follow my hand.'],
    excited: ['Ooh, walkies! Hehe.', 'Come on, come on! This way!', "Let's go for a little tour. Hehe.",
      'Try to keep up, babe!'],
  },
  drag_yank: {
    stern: ['I said keep up.', "Don't you drag your feet.", 'Faster.', 'When I walk, you walk.', 'Did I say stop?',
      'Again? Walk.'],
    warm: ['Oops. Stay with me, babe.', 'Easy... with me.', 'Mm. Closer.'],
    excited: ['Hehe! Gotcha!', 'Whoops! Hehe.', 'Come here, you!', 'Oh, that squeak! Again!', 'Hehe, wobbly!'],
  },
  drag_walk: {
    stern: ["Round again. You're learning.", 'Eyes down. Walk.', 'Every corner of this room, babe.'],
    warm: ['Look at you, following so nicely.', 'Good girl. Nice and slow.'],
    excited: ['Wheee. Hehe.', 'Faster! No, slower. Hehe.', 'Strut for me. Go!'],
  },
  drag_done: {
    stern: ['Stand there. Think about it.', 'Better. Stay.', 'Now you know who leads.'],
    warm: ["There. Good girl. C'mere.", 'All done. You did so good.', 'Okay, okay. Letting go.'],
    excited: ['Hehe. That was fun. Again later.', "Phew! You okay? Hehe.", 'Best walk ever.'],
  },
};
const RVD_BEG_SAY = ["Drag you? Oh, gladly. C'mere.", 'Mm, by the hair? Okay. Hehe.',
  "You want a walk? You're getting a tour.", "Oh, you asked for it. Come here, you.", 'By the hair? Say less.'];

const rvd = {
  M: null,                   // the drag in hand (also `rvm.move` while it is on)
  last: -1e9, n: 0,          // when she last did one, and how many
  after: null,               // { until, asked } — once you are up (or her hand is free)
  camK: 0, yankCam: 0,       // your view's tilt, eased; and a yank's jolt in it
  stats: null, all: [],      // what the last drag measured, and every one this session
  follow: null,              // debug: a camera that walks beside you [az, d, h]
  sg: 1,                     // which side of her you are: 1 her right (her right hand in your hair), -1 her left
  measure: true,             // the skin gaps and the room, every `every` s
};
const _rvdA = new THREE.Vector3(), _rvdB = new THREE.Vector3(), _rvdC = new THREE.Vector3();
const _rvdUP = new THREE.Vector3(0, 1, 0);

function rvdTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvdSay(kind, force = false) {
  return typeof revSay === 'function' ? revSay(kind, force, null, { still: revStill.dom }) : null;
}
/** Her frame, world: forward and right off a walker-convention yaw. */
function rvdAxes(yaw) {
  return { f: { x: -Math.sin(yaw), z: -Math.cos(yaw) }, r: { x: Math.cos(yaw), z: -Math.sin(yaw) } };
}

// ── her mood, read ───────────────────────────────────────────────────────────

/**
 * What her mood makes of it now: pace (m/s), hold (× the arm's force), how
 * hard a yank (u), how far you may lag before one (m), how often she yanks
 * of her own accord (per s), and how many legs. All off `rmood`.
 */
function rvdMood() {
  const R = typeof rmood !== 'undefined' ? rmood : null;
  const s = R ? R.stern : 0.22, e = R ? R.ex.v : 0, g = typeof rmoodGentle === 'function' ? rmoodGentle() : 0.3;
  const tone = R ? R.tone : 'neutral';
  return {
    s, e, g, tone,
    pace: Math.max(0.42, Math.min(1.15, 0.66 + 0.36 * s + 0.24 * e - 0.26 * g)),
    hold: Math.max(0.5, Math.min(1.45, 0.85 + 0.5 * s + 0.3 * e - 0.35 * g)),
    u: Math.max(0.25, Math.min(1.2, 0.5 + 0.5 * s + 0.4 * e - 0.35 * g)),
    lag: Math.max(0.16, Math.min(0.55, 0.32 - 0.14 * s - 0.06 * e + 0.22 * g)),
    own: Math.max(0, 0.30 * (s - 0.35)) + Math.max(0, 0.45 * (e - 0.25)),
    legs: Math.max(3, Math.min(6, Math.round(3.2 + 2 * s + 1.8 * e - 1.2 * g))),
  };
}

// ── where she walks you ──────────────────────────────────────────────────────

/**
 * The room's floor pieces the collider does not know (only the cot is a
 * blocker): the tabouret with the bottle, the television's stand against the
 * back wall and the radio's table — world [x, z, r], round each a body's
 * clearance. Off `kabina.kit()`.
 */
let rvdObs = null;
function rvdObstacles() {
  if (rvdObs) return rvdObs;
  const K = jadrija && jadrija.kabina, kit = K && K.kit ? K.kit() : null;
  if (!kit || !jadrija.toWorld) return [];
  const out = [];
  const add = (t, s, r) => { const w = jadrija.toWorld(t, s); if (w) out.push([w[0], w[2], r]); };
  if (kit.table) add(kit.table[0], kit.table[1], kit.table[2] + 0.05);
  if (kit.screen) add(kit.screen[0], kit.screen[1] + 0.05, 0.42);
  if (kit.set) add(kit.set[0], kit.set[1], 0.36);
  rvdObs = out;
  return out;
}

/** A spot both of you can be: inside the room's walls, out of its furniture. */
function rvdRoomOk(x, z, body = RVD.body, wall = RVD.wall) {
  const K = jadrija && jadrija.kabina;
  if (!K || !K.room(x, z, wall)) return false;
  for (const o of rvdObstacles()) if (Math.hypot(x - o[0], z - o[1]) < o[2] + body) return false;
  if (!ground.confine) return true;
  const [cx, cz] = ground.confine(x, z, rev.ch.y);
  // (The round trip through the shore's frame alone is 1-2 cm: see `SLACK` in 47-ground.js.)
  return Math.hypot(cx - x, cz - z) < 0.04;
}
/** Your spot off hers, world, for her at (x, z) facing `yaw`. */
function rvdYourSpot(x, z, yaw, side = RVD.side, back = RVD.back) {
  const { f, r } = rvdAxes(yaw), sg = rvd.sg;
  return [x + r.x * side * sg - f.x * back, z + r.z * side * sg - f.z * back];
}
/** Her leg from (x, z) at `yaw`, `L` m: are both lines clear, every `step` m? */
function rvdLegClear(x, z, yaw, L, from = 0) {
  const { f } = rvdAxes(yaw);
  for (let d = 0; d <= L + 1e-6; d += RVD.step) {
    const hx = x + f.x * d, hz = z + f.z * d;
    const W = rvd.legWhy || (rvd.legWhy = {});
    // (Her too, off the first `from` m: slim clearances where you both start.)
    if (!(d < from ? rvdRoomOk(hx, hz, 0.12, 0.16) : rvdRoomOk(hx, hz))) { W.her = (W.her || 0) + 1; return false; }
    // (The first leg from where you stand: you are drawn out of a corner
    // over its first `from` m — where you start is wherever you were — but
    // never through the tabouret: MEASURED, your shin 19 cm into it, drawn
    // out of the pocket between it and the wall where the 8 key puts you.)
    // (Where you are along it: from where she took hold of you, out to your
    // place off her hip over the first metre — `spread`.)
    const k = from > 0 ? Math.min(1, d / 0.9) : 1;
    const [yx, yz] = rvdYourSpot(hx, hz, yaw, RVD.grabSide + (RVD.side - RVD.grabSide) * k, RVD.grabBack + (RVD.back - RVD.grabBack) * k);
    if (d < from) {
      // Inside the walls, and never nearer a piece of furniture than a
      // body's half-width — or than you already were, starting next to it.
      const K = jadrija.kabina;
      if (!K.room(yx, yz, 0.12)) { W.youWall = (W.youWall || 0) + 1; return false; }
      const [sx, sz] = rvdYourSpot(x, z, yaw, RVD.grabSide, RVD.grabBack);
      for (const o of rvdObstacles()) {
        const dn = Math.hypot(yx - o[0], yz - o[1]), d0 = Math.hypot(sx - o[0], sz - o[1]);
        if (dn < Math.min(d0 - 0.05, o[2] + 0.06)) { W.youObs = (W.youObs || 0) + 1; return false; }
      }
      continue;
    }
    if (!rvdRoomOk(yx, yz)) { W.you = (W.you || 0) + 1; return false; }
  }
  return true;
}
/** Her turn on the spot at (x, z) from `y0` to `y1`: is your swing round the outside clear? */
function rvdTurnClear(x, z, y0, y1) {
  let d = y1 - y0; d = Math.atan2(Math.sin(d), Math.cos(d));
  const n = Math.max(2, Math.ceil(Math.abs(d) / 0.2));
  for (let i = 0; i <= n; i++) {
    const [yx, yz] = rvdYourSpot(x, z, y0 + d * i / n);
    if (!rvdRoomOk(yx, yz)) return false;
  }
  return true;
}

/**
 * HER PATH: where she stands to take hold (your left side, facing the way
 * the first leg goes) and the legs from there, each clear for both of you
 * and for your swing round each turn. She turns away from you (to her left)
 * by preference — you on her right are then on the outside, and a turn is a
 * lag, which is a yank. Answers { S: [x, z, yaw], pts: [[x, z, yaw]...], len }
 * or null.
 */
function rvdPlan(legs) {
  const r = jadrija.rideFrom ? jadrija.rideFrom() : null;
  if (!r) return null;
  let best = null;
  const why = rvd.planWhy = { S: 0, leg: 0 };
  // Either side of her: her right hand with you off her right, or her left
  // with you off her left — whichever the room has a walk for. (Right-handed
  // only, from where the 8 key puts you — between the tabouret and the west
  // wall — there was none: her place beside you was in the wall.)
  const sgWas = rvd.sg;
  for (let k = 0; k < 72; k++) {
    const sg = rvd.sg = k % 2 ? -1 : 1;
    const h = (Math.floor(k / 2) / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const { f, r: rr } = rvdAxes(h);
    // Her, beside you: you off her side at the grab's distance.
    const sx = r.x - rr.x * RVD.grabSide * sg + f.x * RVD.grabBack, sz = r.z - rr.z * RVD.grabSide * sg + f.z * RVD.grabBack;
    if (!rvdRoomOk(sx, sz, 0.12, 0.16)) { why.S++; continue; }
    // The legs, greedily: the longest clear one among a few tries each.
    const pts = [];
    let x = sx, z = sz, y = h, len = 0;
    for (let l = 0; l < legs; l++) {
      let leg = null;
      for (let t = 0; t < 16; t++) {
        const turn = l === 0 ? 0 : sg * (-1.4 + Math.random() * 3.8);
        const yy = y + turn;
        if (l > 0 && !rvdTurnClear(x, z, y, yy)) continue;
        const want = 1.3 + Math.random() * 1.2;
        let L = want;
        while (L >= (l === 0 ? 1.4 : 0.9) && !rvdLegClear(x, z, yy, L, l === 0 ? 1.3 : 0)) L -= 0.2;
        if (L < (l === 0 ? 1.4 : 0.9)) continue;
        if (!leg || L > leg.L) leg = { L, yy };
        if (L >= want - 0.01) break;
      }
      if (!leg) break;
      const { f: ff } = rvdAxes(leg.yy);
      x += ff.x * leg.L; z += ff.z * leg.L; y = leg.yy; len += leg.L;
      pts.push([x, z, y]);
    }
    if (!pts.length) { why.leg++; continue; }
    // (Her right hand by a little, all else equal.)
    const sc = Math.min(pts.length, legs) * 2 + len + (sg > 0 ? 0.3 : 0);
    if (!best || sc > best.sc) best = { sc, S: [sx, sz, h], pts, len, sg };
    if (best.pts.length >= legs && best.len > legs * 1.4) break;
  }
  rvd.sg = sgWas;
  return best;
}

// ── starting it ──────────────────────────────────────────────────────────────

/** Can she: on, not after the safeword, her right hand free. */
function rvdFree(asked) {
  if (!rev.on || rev.care) return 'off';
  if (typeof rvkHandFull === 'function' && rvkHandFull()) return 'her hand is full';
  if (typeof rvkBusy === 'function' && rvkBusy()) return 'busy';
  if (!asked && ((typeof rvm !== 'undefined' && rvm.move) || rev.arm.mode === 'spank')) return 'busy';
  if (typeof rvm !== 'undefined' && rvm.move && rvm.move.id === 'care') return 'aftercare';
  return true;
}

/** Her own pick (from `revDecide`): stern or excited, you standing. */
function rvdCands(ctx, D) {
  if (rvd.M || rvd.after || rvdFree(false) !== true) return [];
  if (rev.clock - rvd.last < RVD.cool) return [];
  if (D.last.slice(-5).some((x) => /^drag/.test(x))) return [];
  const m = rvdMood();
  const want = Math.max(0, m.s - 0.42) * 1.6 + Math.max(0, m.e - 0.3) * 1.4;
  if (want < 0.08) return [];
  if (ctx === 'stand' && rev.walk) return [{ id: 'drag', s: 0.15 + 0.7 * want }];
  // On your knees, on all fours, sitting: up on your feet first (1), then.
  if (ctx === 'kneel' || ctx === 'fours' || ctx === 'sit') return [{ id: 'drag:up', s: 0.4 * (0.15 + 0.7 * want) }];
  return [];
}

/** Her pick, from `revDecide`: 'drag', or 'drag:up' — her order up first. */
function rvdChoose(id, why) {
  if (id === 'drag:up') {
    rvd.after = { until: rev.clock + 18, asked: false };
    return typeof revOrder === 'function' ? revOrder('stand', 'drag: ' + why) : 'no order';
  }
  return rvdStart(why);
}

/**
 * Asked (a beg, `rmoodBeg('drag')`). Standing, now; on the floor or the cot,
 * up first; her belt or the leash in her hand, put away first. Answers
 * { ok, label }.
 */
function rvdAsk() {
  if (!rev.on) return { ok: false, label: 'roles are not reversed' };
  if (rev.care) return { ok: false, label: 'aftercare' };
  if (rvd.M) {
    // More than you asked: a yank, now.
    if (rvd.M.ph === 'walk') { rvdYank('asked again', 0.2); return { ok: true, label: 'Chloe: already — and a yank for asking' }; }
    return { ok: true, label: 'Chloe: already' };
  }
  // Her belt or the leash in that hand: away first, then your hair.
  if (typeof rvkBeltOut === 'function' && rvkBeltOut()) {
    rvkAsk('beltback');
    rvd.after = { until: rev.clock + 22, asked: true };
    return { ok: true, label: 'Chloe: her belt back on, then your hair' };
  }
  if (typeof rvkCollarOn === 'function' && rvkCollarOn()) {
    rvkCollarEnd('begged');
    rvd.after = { until: rev.clock + 22, asked: true };
    return { ok: true, label: 'Chloe: the collar off, then your hair' };
  }
  const v = revView();
  if (!v || v.ctx !== 'stand' || !rev.walk) {
    rvd.after = { until: rev.clock + 22, asked: true };
    if (v && v.ctx && v.ctx !== 'stand' && typeof revOrder === 'function' && !rev.dom.order) revOrder('stand', 'drag');
    return { ok: true, label: 'Chloe: on your feet first (1)' };
  }
  const r = rvdStart('asked');
  return r === true ? { ok: true, label: 'Chloe: her fist in your hair — walk' } : { ok: false, label: 'drag: ' + r };
}

/** Start. Answers true or why not. */
function rvdStart(why = 'mood') {
  const asked = /^asked/.test(why);
  const fr = rvdFree(asked);
  if (fr !== true) return fr;
  const v = revView();
  if (!v || v.ctx !== 'stand' || !rev.walk) return 'not standing';
  if (!jadrija.hairGrab || !jadrija.hairPull || !jadrija.hairPullTune) return 'no hair';
  if (!jadrija.hairGrab()) return 'no hair to take';
  const m = rvdMood();
  const P = rvdPlan(m.legs);
  if (!P) return 'no room to walk you';
  if (asked && typeof rvhYield === 'function') rvhYield();
  if (typeof rvm !== 'undefined' && rvm.move) return 'busy';
  rvd.sg = P.sg;
  const M = { id: 'drag', kind: 'drag', ph: 'go', t: 0, clk: 0, why, plan: P, i: 0, mood0: m, sg: P.sg, s: P.sg > 0 ? 'R' : 'L',
    held: false, v: { x: 0, z: 0 }, lv: { x: 0, z: 0 }, lag: 0, lagMax: 0, lastYank: -1e9, yanks: [], offK: 0,
    dist: 0, walkT: 0, herDist: 0, err: [], errYank: [], gap: 9, gapLog: [], wall: 0, furn: 0, rootHit: 0,
    Fmax: 0, pitchMax: 0, chestMax: 0, rescues0: null, burst: 0, burstAt: 2 + Math.random() * 2,
    said: 0, measAt: 0, pace: [], wasAt: null, ease: 1, tl: [] };
  // To her place beside you, facing the way you will go.
  revGo(P.S[0], P.S[1]);
  const { f } = rvdAxes(P.S[2]);
  rev.ch.face = new THREE.Vector3(P.S[0] + f.x * 3, rev.ch.y, P.S[1] + f.z * 3);
  if (typeof rvm !== 'undefined') { rvm.move = M; rvmWant('stand'); rvm.body.bowTo = 0; }
  rvd.M = M;
  rvd.last = rev.clock; rvd.n++;
  rvd.after = null;
  const pr = jadrija.pullRag ? jadrija.pullRag() : null;
  M.rescues0 = pr ? pr.rescues : 0;
  rvdTrace({ pick: 'drag', why, legs: P.pts.length, len: +P.len.toFixed(1), tone: m.tone,
    pace: +m.pace.toFixed(2), hold: +m.hold.toFixed(2), lag: +m.lag.toFixed(2) });
  return true;
}

// ── the frame ────────────────────────────────────────────────────────────────

/**
 * YOUR BODY, TOWED (from `revTick`, while you are on your feet, before her
 * step): after the spot off her right hip, at her speed plus a spring on the
 * miss, with a body's acceleration, and your keys leaning on it. Answers
 * { yaw, sp } for `jadrija.ride`, or null when it is not towing you.
 */
function rvdTow(dt, Y) {
  const M = rvd.M;
  if (!M || !rev.last) return null;
  const px = rev.last[0], pz = rev.last[1];
  if (M.ph === 'go' || M.ph === 'reach') {
    // Stand still while she comes to you and takes hold.
    Y.x = px; Y.z = pz; Y.vx = 0; Y.vz = 0;
    return { yaw: rev.yaw, sp: 0 };
  }
  if (M.ph !== 'walk') return null;
  const C = rev.ch, { f, r } = rvdAxes(C.yaw);
  M.offK = Math.min(1, M.offK + dt / RVD.spread);
  const k = M.offK * M.offK * (3 - 2 * M.offK);
  // From where you actually were when her fist closed (she is not always
  // where she planned to stand: MEASURED, a metre of 'lag' in the first
  // second, and a yank for it, before this) out to your place.
  const s0 = M.side0 != null ? M.side0 : RVD.grabSide, b0 = M.back0 != null ? M.back0 : RVD.grabBack;
  const side = s0 + (RVD.side - s0) * k, back = b0 + (RVD.back - b0) * k;
  const tx = C.x + r.x * side * M.sg - f.x * back, tz = C.z + r.z * side * M.sg - f.z * back;
  const ex = tx - px, ez = tz - pz;
  // Her speed, and the spring.
  let cx = f.x * C.sp + RVD.kp * ex, cz = f.z * C.sp + RVD.kp * ez;
  // Your keys: the walker's own step this frame, along her way. Holding
  // back is a drag on your feet; pressing on, a little help.
  const kx = Y.x - px, kz = Y.z - pz;
  const along = (kx * f.x + kz * f.z) / dt;
  const lean = along < 0 ? RVD.resist * Math.max(-3.5, along) : RVD.assist * Math.min(3.5, along);
  cx += f.x * lean; cz += f.z * lean;
  const cl = Math.hypot(cx, cz), top = RVD.vMax + (along > 0 ? 0.3 : 0);
  if (cl > top) { cx *= top / cl; cz *= top / cl; }
  let dvx = cx - M.v.x, dvz = cz - M.v.z;
  const dl = Math.hypot(dvx, dvz), am = RVD.accel * dt;
  if (dl > am) { dvx *= am / dl; dvz *= am / dl; }
  M.v.x += dvx; M.v.z += dvz;
  // The stumble after a yank.
  const ld = Math.exp(-dt / RVD.lurchTau);
  M.lv.x *= ld; M.lv.z *= ld;
  let nx = px + (M.v.x + M.lv.x) * dt, nz = pz + (M.v.z + M.lv.z) * dt;
  // HER ARM IS ONLY SO LONG. Your body no further from her right shoulder
  // than `arm` m, level: past that her hand would have to leave your hair
  // (MEASURED without it: her fist 0.85 m off her shoulder at a corner, her
  // palm 34 cm off it). So her arm takes you along — and that strain is a
  // yank of hers (`rvdTick`).
  const shx = C.x + r.x * 0.18 * M.sg, shz = C.z + r.z * 0.18 * M.sg;
  const ax = nx - shx, az = nz - shz, ad = Math.hypot(ax, az);
  M.strain = 0;
  if (ad > RVD.arm) {
    M.strain = ad - RVD.arm;
    nx = shx + ax / ad * RVD.arm; nz = shz + az / ad * RVD.arm;
    // And what of your speed was carrying you away from her, gone.
    const ux = ax / ad, uz = az / ad, out = M.v.x * ux + M.v.z * uz;
    if (out > 0) { M.v.x -= ux * out; M.v.z -= uz * out; }
  }
  // And her hand: the fist (last frame's, as the net drew it) no further from
  // her shoulder than her arm reaches — your body comes with your head.
  if (M.over > 0 && M.overDir) {
    const c = Math.min(M.over * 0.8, 2.5 * dt);
    nx += M.overDir.x * c; nz += M.overDir.z * c;
    const ux = M.overDir.x, uz = M.overDir.z, away = -(M.v.x * ux + M.v.z * uz);
    if (away > 0) { M.v.x += ux * away; M.v.z += uz * away; }
  }
  // And never closer to her than a body's width (her root to yours): a yank
  // drew your feet to within 3 cm of her shin (MEASURED, skin to skin).
  {
    const gx = nx - C.x, gz = nz - C.z, gl = Math.hypot(gx, gz);
    if (gl < RVD.near && gl > 1e-4) { nx = C.x + gx / gl * RVD.near; nz = C.z + gz / gl * RVD.near; }
  }
  // All of it together no quicker than a stumble: the net your head is in
  // follows your hips at up to 4 m/s, and a yank's lurch on top of a catch-up
  // and her arm's correction made 3.4-4.1 — and the guard let go ('far', at
  // every second yank, MEASURED).
  const mx = nx - px, mz = nz - pz, ml = Math.hypot(mx, mz), mTop = RVD.vTop * dt;
  if (ml > mTop) { nx = px + mx / ml * mTop; nz = pz + mz / ml * mTop; }
  // Inside the room's walls with a body's width to spare, whatever the
  // collider says: a skin point of yours was 16 cm through a wall once
  // (MEASURED), your root at the wall's own girth with an arm out past it.
  const K = jadrija.kabina;
  if (K && !K.room(nx, nz, RVD.inWall) && K.room(px, pz, RVD.inWall)) {
    M.wallHit = (M.wallHit || 0) + 1;
    if (K.room(nx, pz, RVD.inWall)) nz = pz;
    else if (K.room(px, nz, RVD.inWall)) nx = px;
    else { nx = px; nz = pz; }
  }
  if (ground.confine) {
    const [qx, qz] = ground.confine(nx, nz, Y.y);
    if (Math.hypot(qx - nx, qz - nz) > 1e-4) M.rootHit++;
    nx = qx; nz = qz;
  }
  Y.x = nx; Y.z = nz; Y.vx = 0; Y.vz = 0;
  const step = Math.hypot(nx - px, nz - pz);
  M.dist += step;
  M.vTop = Math.max(M.vTop || 0, step / dt);
  M.lag = Math.hypot(tx - nx, tz - nz);
  M.lagAlong = (tx - nx) * f.x + (tz - nz) * f.z;
  M.lagMax = Math.max(M.lagMax, M.lag);
  // Facing her way — and turned no faster than `turn` rad/s. Your head is
  // the net's (world bodies jointed to your hips): swung round at her own
  // rate at a corner (8 rad/s), the net's head was left behind, read as 81
  // degrees of bow with no force on the hair at all, and the guard let go
  // ('far', twice a drag — MEASURED). Turned at a walker's rate, none.
  const sp = step / dt;
  let dyw = C.yaw - rev.yaw; dyw = Math.atan2(Math.sin(dyw), Math.cos(dyw));
  const yaw = rev.yaw + Math.max(-RVD.turn * dt, Math.min(RVD.turn * dt, dyw));
  // Your look stays yours, but within a turned head of your body — and as
  // she sets off, eased to where you are going and a little toward her, so
  // her arm is at the edge of your view (straight ahead, she was out of it).
  let lk = Y.yaw - yaw; lk = Math.atan2(Math.sin(lk), Math.cos(lk));
  if (Math.abs(lk) > 1.0) Y.yaw = yaw + Math.sign(lk) * 1.0;
  else if (M.walkT < 1.2) Y.yaw -= (lk - 0.35 * M.sg) * (1 - Math.exp(-3 * dt));
  return { yaw, sp };
}

/** A yank: her fist jerks, you stumble after it. `why` 'lag' | 'mood' | ...; `extra` on her u. */
function rvdYank(why, extra = 0) {
  const M = rvd.M;
  if (!M || M.ph !== 'walk' || !M.held) return false;
  if (M.clk - M.lastYank < RVD.gap) return false;
  const m = rvdMood();
  const u = Math.max(0.2, Math.min(1.3, m.u + extra + (why === 'lag' ? 0.25 * Math.min(1, M.lag / 0.45) : 0)));
  M.lastYank = M.clk;
  // You stumble a step after it: toward where you should be, and on her way.
  const C = rev.ch, { f } = rvdAxes(C.yaw), r0 = rev.last;
  let dx = f.x, dz = f.z;
  if (r0) {
    const [tx, tz] = rvdYourSpot(C.x, C.z, C.yaw);
    const ex = tx - r0[0], ez = tz - r0[1], el = Math.hypot(ex, ez);
    if (el > 0.05) { dx = ex / el + f.x * 0.6; dz = ez / el + f.z * 0.6; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
  }
  // From behind her, a yank is your whole body stumbling after her, not your
  // head bowed to your chest (MEASURED, the force alone: 77 degrees of bow,
  // from 110 N, with you half a metre behind).
  const frontal = Math.max(0, Math.min(1, (M.lagAlong || 0) / 0.35));
  M.yankK = 1 - 0.6 * frontal;
  M.lv.x += dx * RVD.lurch * u * (1 + 0.6 * frontal); M.lv.z += dz * RVD.lurch * u * (1 + 0.6 * frontal);
  rev.jolt = Math.max(rev.jolt, 0.5 * u);
  rvd.yankCam = Math.max(rvd.yankCam, u);
  jadrija.hairPullTune({ outOf: RVD.outOf, draw: RVD.draw, k: m.hold * M.ease, yankF: RVD.yankF * M.ease * M.yankK, yankDraw: RVD.yankDraw });
  if (!jadrija.hairYank(u)) return false;
  M.yanks.push({ t: +M.clk.toFixed(2), why, u: +u.toFixed(2), lag: +M.lag.toFixed(2), F: 0, pitch: 0, tone: m.tone });
  // A gasp, most times; and a line, some.
  if (Math.random() < 0.7 && typeof audio !== 'undefined' && audio && audio.startle && state.phase !== 'intro') {
    audio.startle('woman_young_slim', 0.6);
  }
  if (Math.random() < 0.55) rvdSay('drag_yank');
  rvdTrace({ pick: 'drag:yank', why, u: +u.toFixed(2), lag: +M.lag.toFixed(2) });
  return true;
}

/** The pull's eye this frame: off her right hip, at `eyeY` plus the net's own `down`. */
function rvdEye(out) {
  const C = rev.ch, { f, r } = rvdAxes(C.yaw);
  const sg = rvd.M ? rvd.M.sg : 1;
  const ax = C.x + r.x * RVD.eyeOut * sg - f.x * RVD.eyeBack, az = C.z + r.z * RVD.eyeOut * sg - f.z * RVD.eyeBack;
  // The WAY is from your head to that point; the pull aims a long reach
  // along it, never AT the point: near (as she takes hold, half a metre off)
  // the hand's draw overshot it and brought your head in against her jaw,
  // 1-3 mm, MEASURED.
  const Hd = rvmYourHead();
  if (!Hd) return out.set(ax, C.y + RVD.eyeY + 0.25, az);
  let dx = ax - Hd.C.x, dz = az - Hd.C.z;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl; dz /= dl;
  const dy = (C.y + RVD.eyeY) - Hd.C.y;
  return out.set(Hd.C.x + dx * 0.8, Hd.C.y + Math.max(-0.3, Math.min(0.1, dy)) + 0.25, Hd.C.z + dz * 0.8);
}

/**
 * Once a frame from `revTick`, after her step and before her arms are
 * solved: the drag's phases, her hand, the yanks, her lines, the measures.
 */
function rvdTick(dt) {
  if (!rev.on) return;
  // Up (or her hand free) for a drag you asked for: now.
  if (rvd.after && !rvd.M) {
    const v = revView();
    if (rev.clock > rvd.after.until) rvd.after = null;
    else if (v && v.ctx === 'stand' && rev.walk && !rev.dom.order && rvdFree(true) === true
      && !(typeof rvm !== 'undefined' && rvm.move) && rev.arm.mode !== 'spank') {
      const a = rvd.after; rvd.after = null;
      const r = rvdStart(a.asked ? 'asked (after)' : 'after');
      if (r !== true) rvdTrace({ pick: 'drag:' + r, why: 'after' });
    }
  }
  rvd.yankCam *= Math.exp(-dt / 0.25);
  const M = rvd.M;
  if (!M) { rvd.camK = damp(rvd.camK, 0, 3, dt); return; }
  // Ended from outside (an ask of another move, a toy, the safeword's moves).
  if (typeof rvm !== 'undefined' && rvm.move !== M) { rvdDone(M, 'ended'); return; }
  M.clk += dt;
  const v = revView();
  // Off your feet (an ask of yours, a fall into a pose): it is over.
  if (!v || v.ctx !== 'stand' || !rev.walk) { rvdDone(M, 'you left your feet: ' + (v ? v.phase : '?')); return; }
  const C = rev.ch, { f, r } = rvdAxes(C.yaw);
  const pole = new THREE.Vector3(r.x * M.sg, -0.45, r.z * M.sg).addScaledVector(new THREE.Vector3(f.x, 0, f.z), -0.25).normalize();
  const down = _rvdUP.clone().negate();
  const m = rvdMood();
  if (M.ph === 'go') {
    rvd.camK = damp(rvd.camK, 0, 3, dt);
    let dy = M.plan.S[2] - C.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if ((revAt() && Math.abs(dy) < 0.15) || M.clk > RVD.goT) { M.ph = 'reach'; M.t0 = M.clk; }
    return;
  }
  if (M.ph === 'reach') {
    const g = jadrija.hairGrab();
    const Hd = rvmYourHead();
    if (!g || !Hd) { rvdDone(M, 'no hair'); return; }
    const T = new THREE.Vector3(g.x, g.y, g.z);
    const n = T.clone().sub(Hd.C).normalize().add(_rvdA.set(0, 0.6, 0)).normalize();
    rvhHairHand(M.s, T.clone().addScaledVector(n, 0.015), n, down, pole, null, 0.8);
    const palm = rvmPalm(M.s, _rvdB);
    const near = palm ? palm.distanceTo(T) : 9;
    const tt = M.clk - M.t0;
    if ((rvm.k[M.s] > 0.95 && near < 0.035 && tt > 0.4) || (tt > RVD.reachT && near <= 0.06)) {
      jadrija.hairPullTune({ outOf: RVD.outOf, draw: RVD.draw, k: m.hold * 0.3, yankF: RVD.yankF, yankDraw: RVD.yankDraw });
      M.held = !!jadrija.hairPull(true, rvdEye(new THREE.Vector3()));
      if (!M.held) { jadrija.hairPullTune(null); rvdDone(M, 'would not take'); return; }
      M.ph = 'walk'; M.t1 = M.clk; M.reachMiss = +near.toFixed(3);
      rvm.body.bowTo = 0;
      const r0 = jadrija.rideFrom();
      if (r0) {
        const rx = r0.x - C.x, rz = r0.z - C.z;
        M.side0 = Math.max(0.45, Math.min(0.9, (rx * r.x + rz * r.z) * M.sg));
        M.back0 = Math.max(-0.2, Math.min(0.5, -(rx * f.x + rz * f.z)));
      }
      M.i = 0;
      const p = M.plan.pts[0];
      revGo(p[0], p[1]);
      rev.ch.face = null;
      rvdSay('hair_drag', true);
      return;
    }
    if (tt > RVD.reachT + 1.5) {
      // Once more, a step nearer you; then she gives it up — never a fist shut on the air.
      const r0 = jadrija.rideFrom();
      if (!M.retried && r0) {
        M.retried = true;
        const dx = r0.x - C.x, dz = r0.z - C.z, dl = Math.hypot(dx, dz) || 1, st = Math.min(0.15, near);
        revGo(C.x + dx / dl * st, C.z + dz / dl * st);
        rev.ch.face = new THREE.Vector3(C.x + f.x * 3, rev.ch.y, C.z + f.z * 3);
        M.ph = 'go'; M.t0 = M.clk;
        rvdTrace({ pick: 'drag:reach', why: (near * 100).toFixed(0) + ' cm off, a step nearer' });
        return;
      }
      rvdDone(M, 'out of reach (' + (near * 100).toFixed(0) + ' cm)');
      return;
    }
    return;
  }
  if (M.ph === 'walk') {
    M.walkT = M.clk - M.t1;
    // Her pace, her mood's — and in spurts when she is excited.
    let pace = m.pace;
    if (m.e > 0.35) {
      M.burstAt -= dt;
      if (M.burstAt <= 0) { M.burst = 0.7 + Math.random() * 0.7; M.burstAt = 2 + Math.random() * 2.5; }
    }
    if (M.burst > 0) { M.burst -= dt; pace *= 1.35; }
    if (typeof rvm !== 'undefined') rvm.slow = pace / REV.walk;
    // Her turns at her mood's rate, not her own 8 rad/s: you are on the
    // outside of every one of them, a body's width out, and a turn on the
    // spot left you 0.75 m behind your place (MEASURED). Gentle, she brings
    // you round; stern, she wheels and you are yanked after her.
    const tr = 1.3 + 1.6 * m.s + 1.0 * m.e - 0.4 * m.g;
    if (M.herYaw != null) {
      let d = C.yaw - M.herYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const lim = Math.max(0.8, tr) * dt;
      if (Math.abs(d) > lim) C.yaw = M.herYaw + Math.sign(d) * lim;
    }
    M.herYaw = C.yaw;
    M.pace.push(C.sp);
    if (M.wasAt) M.herDist += Math.hypot(C.x - M.wasAt[0], C.z - M.wasAt[1]);
    M.wasAt = [C.x, C.z];
    // Along her path: the next leg before she stops at the end of this one.
    const p = M.plan.pts[M.i];
    const dd = Math.hypot(p[0] - C.x, p[1] - C.z);
    // (She cuts a corner the gentler she is: warm, a curve you can follow;
    // stern, square, and a turn is a lag, which is a yank.)
    const cut = 0.3 + 0.35 * m.g - 0.1 * m.s;
    if (M.i < M.plan.pts.length - 1 && (dd < cut || revAt())) {
      M.i++;
      revGo(M.plan.pts[M.i][0], M.plan.pts[M.i][1]);
      if (M.said < 2 && Math.random() < 0.5) { M.said++; rvdSay('drag_walk'); }
    } else if (M.i >= M.plan.pts.length - 1 && revAt()) {
      rvdOut(M, 'done');
      return;
    }
    if (M.walkT > 40) { rvdOut(M, 'long enough'); return; }
    // The hold: her mood's, and harder the further you lag.
    // (Over its first second the hold comes on from a third: the net's own
    // grab is a 110 N yank, and with her setting off under it your head was
    // wrenched 56-79 degrees round, every first second, MEASURED.)
    const lagK = (1 + 0.5 * Math.min(1, M.lag / 0.5)) * M.ease * Math.min(1, 0.3 + M.walkT / 1.0);
    // And at once, off how far down your head already is (`ease` is the slow half).
    const prNow = jadrija.pullRag ? jadrija.pullRag() : null;
    const bow = prNow ? Math.max(0, -prNow.pitch - 25) : 0;
    const now = Math.max(0.3, 1 - bow / 30);
    jadrija.hairPullTune({ outOf: RVD.outOf, draw: RVD.draw, k: m.hold * lagK * now,
      yankF: RVD.yankF * M.ease * (M.yankK != null ? M.yankK : 1) * now, yankDraw: RVD.yankDraw });
    jadrija.hairPull(true, rvdEye(_rvdC));
    // A yank: you lag, or she wants one.
    if (M.walkT > 0.8) {
      if (M.lag > m.lag) rvdYank('lag');
      else if (M.strain > 0.03) rvdYank('strain');
      else if (Math.random() < m.own * dt) rvdYank('mood');
    }
    // Her hand on the fist as the net draws it.
    const F = jadrija.hairPullAt ? jadrija.hairPullAt() : null;
    if (F) {
      const T = new THREE.Vector3(F.x, F.y, F.z);
      const n = new THREE.Vector3(-F.hx, -F.hy, -F.hz).normalize();
      const yk = M.clk - M.lastYank < 0.5;
      // (Quicker through a yank: the fist moves 12 cm in a tenth of a second.)
      rvhHairHand(M.s, T, n, down, pole, M.walkT > 0.5 ? (yk ? M.errYank : M.err) : null, yk ? 2.2 : 1);
      const sh = rvmShoulder(M.s, _rvdA);
      if (sh) {
        const d = sh.distanceTo(T);
        M.fistMax = Math.max(M.fistMax || 0, d); M.fistMin = Math.min(M.fistMin == null ? 9 : M.fistMin, d);
        // Past her reach: `rvdTow` brings you in by it next frame.
        M.over = Math.max(0, d - RVD.reach);
        const hx = sh.x - T.x, hz = sh.z - T.z, hl = Math.hypot(hx, hz) || 1;
        M.overDir = { x: hx / hl, z: hz / hl };
      }
    }
    rvdYourHand(M, dt, 1);
    const pr = jadrija.pullRag ? jadrija.pullRag() : null;
    if (pr) {
      M.Fmax = Math.max(M.Fmax, pr.F);
      M.pitchMax = Math.min(M.pitchMax, pr.pitch);
      M.chestMax = Math.max(M.chestMax, Math.abs(pr.chest));
      const Y = M.yanks[M.yanks.length - 1];
      if (Y && M.clk - Y.t < 0.6) {
        Y.F = Math.max(Y.F, +pr.F.toFixed(0));
        if (M.headDown != null) { Y.down = Math.max(Y.down || 0, +M.headDown.toFixed(0)); Y.turn = Math.max(Y.turn || 0, +Math.abs(M.headTurn).toFixed(0)); }
      }
      // Your head as drawn: how far it looks down (deg, + down) and how far
      // it is turned off your body (deg, + to your left — to her).
      const Hd = rvmYourHead();
      if (Hd) {
        const yf = rvdAxes(rev.yaw).f;
        const hl = Math.hypot(Hd.fw.x, Hd.fw.z) || 1;
        M.headDown = Math.asin(Math.max(-1, Math.min(1, -Hd.fw.y))) * 57.3;
        const cr = yf.x * Hd.fw.z - yf.z * Hd.fw.x;
        M.headTurn = Math.atan2(-cr, (yf.x * Hd.fw.x + yf.z * Hd.fw.z)) * 57.3 * (hl > 0 ? 1 : 1);
        M.downMax = Math.max(M.downMax || -90, M.headDown);
        M.turnMax = Math.max(M.turnMax || 0, Math.abs(M.headTurn));
      }
      if (pr.pitch < -50 && (M.spikes = M.spikes || []).length < 30) {
        M.spikes.push([+M.walkT.toFixed(2), +pr.pitch.toFixed(0), M.headDown != null ? +M.headDown.toFixed(0) : null, M.headTurn != null ? +M.headTurn.toFixed(0) : null, +pr.chest.toFixed(0), +pr.F.toFixed(0), +M.lag.toFixed(2),
          +(M.over || 0).toFixed(2), +(M.strain || 0).toFixed(2), +(M.clk - M.lastYank).toFixed(2), +rev.ch.sp.toFixed(2),
          +Math.hypot(M.v.x, M.v.z).toFixed(2), +Math.hypot(M.lv.x, M.lv.z).toFixed(2), M.lagAlong != null ? +M.lagAlong.toFixed(2) : null]);
      }
      // Your head no lower than `headMost`: her hold eases off past it.
      const over = -pr.pitch - RVD.headMost;
      M.ease = Math.max(0.35, Math.min(1, M.ease + (over > 0 ? -over * 0.08 : 0.6) * dt));
      if (pr.rescues > M.rescues0) {
        M.rescued = (M.rescued || 0) + 1; M.rescues0 = pr.rescues;
        const r0 = jadrija.rideFrom();
        (M.rescueWhy = M.rescueWhy || []).push([+M.walkT.toFixed(2), pr.why, M.ph, +(M.vTop || 0).toFixed(2), +M.lag.toFixed(2),
          r0 && rev.last ? +Math.hypot(r0.x - rev.last[0], r0.z - rev.last[1]).toFixed(3) : null, +(M.clk - M.lastYank).toFixed(2)]);
        M.vTop = 0;
      }
      if (!pr.holding) { rvdOut(M, 'the net let go'); return; }
    }
    rvd.camK = damp(rvd.camK, Math.min(1.4, m.hold * lagK), 4, dt);
    if (rvd.measure && M.clk >= M.measAt) {
      M.measAt = M.clk + 0.25; rvdMeasure(M);
      if (pr && M.tl.length < 200) M.tl.push([+M.walkT.toFixed(2), +pr.pitch.toFixed(0), +(M.headDown || 0).toFixed(0), +(M.headTurn || 0).toFixed(0), +pr.F.toFixed(0), +M.lag.toFixed(2), +(M.over || 0).toFixed(2), +M.ease.toFixed(2)]);
    }
    return;
  }
  if (M.ph === 'out') {
    rvd.camK = damp(rvd.camK, 0, 4, dt);
    rvdYourHand(M, dt, 0);
    if (M.clk - M.t2 > RVD.outT) rvdDone(M, M.outWhy || 'done');
  }
}

/**
 * YOUR HAND UP TO HERS. The hand on her side goes up to her wrist while she
 * walks you — what anybody led by the hair does, to ease it and to keep up —
 * solved on to her forearm a hand's width above her palm (`rvhBayeArm`, your
 * arms' two-bone solve of 1.574.0). Without it your near hand swung with the
 * walk clip in front of you, between the two of you (photographed). Eased in
 * over half a second, out as her fist opens; measured.
 */
function rvdYourHand(M, dt, want) {
  M.handK = damp(M.handK || 0, want, want ? 4 : 6, dt);
  if (M.handK < 0.02 || typeof rvhBayeArm !== 'function') return;
  const s = M.sg > 0 ? 'L' : 'R';
  const palm = rvmPalm(M.s, _rvdB), sh = rvmShoulder(M.s, _rvdC);
  if (!palm || !sh) return;
  const T = palm.clone().addScaledVector(sh.clone().sub(palm).normalize(), 0.09);
  if (!M.handT) M.handT = T.clone(); else M.handT.lerp(T, 1 - Math.exp(-14 * dt));
  const { f } = rvdAxes(rev.yaw);
  const pole = new THREE.Vector3(-f.x * 0.4, -1, -f.z * 0.4).normalize();
  rvhBayeArm(s, M.handT, pole, M.handK);
  // The miss, once it is all hers: your palm against where it was sent.
  if (M.handK > 0.97 && typeof rvhBayePalm === 'function') {
    const yp = rvhBayePalm(s, new THREE.Vector3());
    if (yp && M.handT) (M.yourHand = M.yourHand || []).push(yp.distanceTo(M.handT));
  }
}

/** Her fist opens: you stop where you are, a line. */
function rvdOut(M, why) {
  if (M.held) { jadrija.hairPull(false); M.held = false; }
  M.ph = 'out'; M.t2 = M.clk; M.outWhy = why;
  rev.ch.goal = null;
  rev.ch.face = revBone('pelvis', new THREE.Vector3());
  M.v.x = M.v.z = 0; M.lv.x = M.lv.z = 0;
  if (why === 'done' || why === 'long enough') rvdSay('drag_done', true);
}

/** Over: the fist open, the move ended, the measures kept. */
function rvdDone(M, why) {
  if (M.held && jadrija.hairPull) { jadrija.hairPull(false); M.held = false; }
  if (jadrija.hairPullTune) jadrija.hairPullTune(null);
  rvd.M = null;
  rvd.stats = rvdSummary(M, why);
  rvd.all.push(rvd.stats);
  if (rvd.all.length > 20) rvd.all.shift();
  rvdTrace({ pick: 'drag end', why, yanks: M.yanks.length, dist: +M.dist.toFixed(1) });
  if (typeof rvm !== 'undefined' && rvm.move === M) rvmEnd(why);
}

/** What one drag measured — `__fr.reverse.drag.last()`. */
function rvdSummary(M, why) {
  const mm = (a, k = 1000) => {
    if (!a || !a.length) return null;
    const L = Array.from(a).sort((x, y) => x - y), q = (fq) => +(L[Math.min(L.length - 1, Math.floor(fq * L.length))] * k).toFixed(1);
    return { n: L.length, med: q(0.5), p90: q(0.9), max: +(L[L.length - 1] * k).toFixed(1) };
  };
  const pace = M.pace.filter((x) => x > 0.1);
  const m0 = M.mood0;
  return { why, tone: typeof rmood !== 'undefined' ? rmood.tone : m0.tone, stern: +m0.s.toFixed(2), excite: +m0.e.toFixed(2), gentle: +m0.g.toFixed(2),
    plan: { legs: M.plan.pts.length, len: +M.plan.len.toFixed(2) }, walked: +M.dist.toFixed(2), herWalked: +M.herDist.toFixed(2),
    t: +(M.walkT || 0).toFixed(1), pace: pace.length ? +(pace.reduce((a, b) => a + b, 0) / pace.length).toFixed(2) : 0,
    paceMax: pace.length ? +Math.max(...pace).toFixed(2) : 0,
    hold: +m0.hold.toFixed(2), lagYank: +m0.lag.toFixed(2), lagMax: +M.lagMax.toFixed(2),
    yanks: M.yanks.length, yankLog: M.yanks.slice(0, 12),
    headDownMax: M.downMax != null ? +M.downMax.toFixed(0) : null, headTurnMax: M.turnMax != null ? +M.turnMax.toFixed(0) : null,
    Fmax: +M.Fmax.toFixed(0), headPitchMin: +M.pitchMax.toFixed(1), chestMax: +M.chestMax.toFixed(1),
    hand: mm(M.err), handYank: mm(M.errYank), yourHand: mm(M.yourHand), reachMiss: M.reachMiss != null ? M.reachMiss : null,
    fist: M.fistMax ? [+M.fistMin.toFixed(3), +M.fistMax.toFixed(3)] : null,
    gapMin: M.gap < 9 ? +(M.gap * 1000).toFixed(0) : null, gapAt: M.gapAt || null, gapLog: M.gapLog.slice(0, 40),
    wallOut: M.wall, wallDeep: M.wallD ? [M.wallWho, +(M.wallD * 1000).toFixed(0)] : null, furnIn: +(M.furn * 1000).toFixed(0), furnAt: M.furnAt || null, rootHits: M.rootHit, wallHits: M.wallHit || 0, rescues: M.rescued || 0,
    rescueWhy: M.rescueWhy || null, tl: M.tl, spikes: M.spikes || null };
}

// ── measured on the skin ─────────────────────────────────────────────────────

const rvdSetsC = {};
let rvdSetsB = null;
/** The bone a skin vertex mostly follows, by name. */
function rvdBoneOf(Sk, vi) {
  const g = Sk.geo.attributes, bi = g.aBoneIdx.array, bw = g.aBoneWt.array;
  let top = 0, tb = -1;
  for (let j = 0; j < 4; j++) if (bw[4 * vi + j] > top) { top = bw[4 * vi + j]; tb = bi[4 * vi + j]; }
  return tb >= 0 && Sk.rig.bones[tb] ? Sk.rig.bones[tb].name : '?';
}
/** Her body but the arm that holds your hair (side `s`), and all of yours: skin vertex sets. */
function rvdSets(s = 'R') {
  const SC = rvhChloeSkin(), SB = rvhBayeSkin();
  if (!SC || !SB) return null;
  if (!rvdSetsC[s]) {
    const arm = new RegExp('^(armU|armL|hand|fingers|thumb)' + s + '$');
    const names = SC.rig.bones.map((b) => b.name).filter((n) => !arm.test(n));
    rvdSetsC[s] = rvhPick(SC, 'dragBody' + s, names, () => true, 9);
  }
  if (!rvdSetsB) {
    const names = SB.rig.bones.map((b) => b.name);
    rvdSetsB = rvhPick(SB, 'dragAll', names, () => true, 13);
  }
  return { SC, SB, C: rvdSetsC[s], B: rvdSetsB };
}
/**
 * The two of you apart (the nearest pair of skin points, her right arm left
 * out), and both bodies against the room: a skin point past a wall, or low
 * enough to meet the furniture and inside a piece of it.
 */
function rvdMeasure(M) {
  const S = rvdSets(M.s);
  if (!S) return;
  const A = rvhSkinSet(S.SC, S.C), B = rvhSkinSet(S.SB, S.B);
  const nb = rvhNearest(A, B);
  if (nb.d < M.gap) {
    // Which of her and which of you, for the record.
    const bone = rvdBoneOf;
    M.gapAt = [bone(S.SC, S.C[nb.i]), bone(S.SB, S.B[nb.j]), +M.walkT.toFixed(2), +(M.clk - M.lastYank).toFixed(2)];
  }
  M.gap = Math.min(M.gap, nb.d);
  if (M.gapLog.length < 400) M.gapLog.push(+(nb.d * 1000).toFixed(0));
  const K = jadrija.kabina, fy = rev.ch.y;
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i += 2) {
      const p = P[i];
      if (!K.room(p.x, p.z, -0.02)) {
        M.wall++;
        let dd = 0.02;
        while (dd < 0.3 && !K.room(p.x, p.z, -dd - 0.02)) dd += 0.02;
        if (dd > (M.wallD || 0)) {
          M.wallD = dd; M.wallWho = P === A ? 'her' : 'you';
          const r0 = jadrija.rideFrom();
          M.wallWho += ' ' + (P === A ? '' : rvdBoneOf(S.SB, S.B[i])) + ' ' + (r0 ? Math.hypot(p.x - r0.x, p.z - r0.z).toFixed(2) : '')
            + ' @' + M.walkT.toFixed(1) + ' root ' + (r0 ? [r0.x.toFixed(2), r0.z.toFixed(2)].join(',') : '') + ' her ' + rev.ch.x.toFixed(2) + ',' + rev.ch.z.toFixed(2);
          M.wallNow = true;
        }
      }
      // The cot's frame (its blocker, under the mattress's top at 0.44 m —
      // a hand over the mattress is over it, not in it); and the tabouret,
      // the set's stand and the radio's table, under their tops.
      let d = 0;
      if (p.y - fy < 0.40 && ground.confine) {
        const [cx, cz] = ground.confine(p.x, p.z, fy);
        d = Math.hypot(cx - p.x, cz - p.z) - 0.26;
      }
      if (p.y - fy < 0.60) for (const o of rvdObstacles()) d = Math.max(d, o[2] - 0.08 - Math.hypot(p.x - o[0], p.z - o[1]));
      if (d > M.furn) { M.furn = d; M.furnAt = (P === A ? 'her ' : 'you ') + rvdBoneOf(P === A ? S.SC : S.SB, (P === A ? S.C : S.B)[i]); }
    }
  }
  // A debug camera that walks along beside the two of you.
  if (rvd.follow) rvdFollowCam();
}

/** Debug: the camera off to the side of the two of you, `[az, d, h]` — az 0 in front of her. */
function rvdFollowCam() {
  const [az, d, h] = rvd.follow;
  const Hd = rvmYourHead();
  if (!Hd) return;
  const C = new THREE.Vector3(rev.ch.x, rev.ch.y + 1.0, rev.ch.z);
  const T = C.clone().lerp(Hd.C, 0.5);
  T.y = rev.ch.y + 1.05;
  for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, Math.PI]) {
    for (const k of [1, 0.85, 0.7]) {
      const a = rev.ch.yaw + az + da;
      const x = T.x - Math.sin(a) * d * k, z = T.z - Math.cos(a) * d * k;
      if (typeof revRoom === 'function' && !revRoom(x, z)) continue;
      rev.debugCam = [x, rev.ch.y + h, z, T.x, T.y, T.z];
      return;
    }
  }
}

// ── the rest ─────────────────────────────────────────────────────────────────

/** Your view: held down and over toward her hand while she walks you; a jolt at a yank. */
function rvdCamTilt() {
  const k = rvd.camK, y = rvd.yankCam;
  if (k < 0.002 && y < 0.002) return [0, 0];
  const Yw = ground && ground.you;
  let p = -(0.10 + 0.10 * k) * Math.min(1, k * 1.5) - 0.12 * y;
  if (Yw) p = Math.max(p, -0.9 - Yw.pitch);
  // (Rolled toward her: she is on your left when you are on her right.)
  const sg = rvd.M ? rvd.M.sg : 1;
  return [p, (0.07 * Math.min(1, k) + 0.08 * y) * sg];
}

/** The scene block's part (`revScene`): her fist in your hair, walking you. */
function rvdScene(o) {
  const M = rvd.M;
  if (M && M.held) o.rev_hair = 'drag';
}

/** The safeword: her fist opens this instant, you stop where you are. */
function rvdSafe() {
  rvd.after = null;
  const M = rvd.M;
  if (!M) return;
  if (M.held && jadrija.hairPull) { jadrija.hairPull(false); M.held = false; }
  M.v.x = M.v.z = 0; M.lv.x = M.lv.z = 0;
  rev.ch.goal = null;
  rvd.camK = 0; rvd.yankCam = 0;
  rvdDone(M, 'safeword');
}

/** Swapped back or left: all of it off, now. */
function rvdClear() {
  const M = rvd.M;
  if (M && M.held && jadrija && jadrija.hairPull) jadrija.hairPull(false);
  if (jadrija && jadrija.hairPullTune) jadrija.hairPullTune(null);
  if (M) { rvd.stats = rvdSummary(M, 'cleared'); }
  rvd.M = null; rvd.after = null; rvd.camK = 0; rvd.yankCam = 0;
}

// Her lines into the tables (`REV_SAY` the beat's own, RMOOD_SAY its tones).
if (typeof REV_SAY !== 'undefined') Object.assign(REV_SAY, RVD_SAY);
if (typeof RMOOD_SAY !== 'undefined') {
  Object.assign(RMOOD_SAY, RVD_MOOD_SAY);
  if (RMOOD_SAY.beg) RMOOD_SAY.beg.drag = RVD_BEG_SAY;
}

// The help sheet, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.revdrag': 'roles reversed: Shift+. or "drag me" / "pull me by the hair" — Chloe takes a fistful of your hair and walks you round the kabina at her side, yanking when you lag (S drags your feet). Sterner: faster, harder, more yanks; excited: rough and playful; warm: slow and gentle. She does it on her own when stern or excited. "red" lets go at once',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.revdrag': 'zamijenjene uloge: Shift+. ili "vuci me za kosu" — Chloe te zgrabi za kosu i vodi po kabini uz sebe, trza kad zaostaješ (S vuče noge). Stroža: brže, jače, više trzaja; uzbuđena: grubo i razigrano; nježna: polako i blago. Radi to i sama kad je stroga ili uzbuđena. "crvena" pušta odmah',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.revdrag': 'rôles inversés : Maj+. ou « traîne-moi par les cheveux » — Chloe vous prend par les cheveux et vous promène dans la cabine à son côté, avec un coup sec quand vous traînez (S freine). Plus sévère : plus vite, plus fort, plus de coups secs ; excitée : brusque et joueuse ; tendre : lente et douce. Elle le fait aussi d’elle-même. « rouge » lâche tout de suite',
  });
}

/** `__fr.reverse.drag` — see 49-reverse.js. */
const rvdApi = {
  ask: () => rvdAsk(),
  start: () => rvdStart('probe'),
  beg: () => (typeof rmoodBeg === 'function' ? rmoodBeg('drag') : null),
  yank: (extra = 0) => rvdYank('probe', extra),
  end: () => { if (rvd.M) rvdOut(rvd.M, 'probe'); return true; },
  plan: (legs = 3) => { rvd.legWhy = {}; const P = rvdPlan(legs); return { P, why: rvd.planWhy, leg: rvd.legWhy }; },
  mood: () => rvdMood(),
  /** Debug: the room as she sees it for this — a row per z, '#' blocked, '.' clear, 'Y' you, 'C' her. */
  grid: (st = 0.25) => {
    const r = jadrija.rideFrom(), K = jadrija.kabina, c = [r.x, r.z];
    const out = [];
    for (let z = c[1] - 8; z <= c[1] + 8; z += st) {
      let row = '';
      for (let x = c[0] - 8; x <= c[0] + 8; x += st) {
        const me = Math.hypot(x - r.x, z - r.z) < st * 0.6, her = Math.hypot(x - rev.ch.x, z - rev.ch.z) < st * 0.6;
        const ob = rvdObstacles().some((o) => Math.hypot(x - o[0], z - o[1]) < o[2]);
        row += me ? 'Y' : her ? 'C' : ob ? 'o' : !K.inside(x, z) ? ' ' : !K.room(x, z, RVD.wall) ? '|' : rvdRoomOk(x, z) ? '.' : '#';
      }
      out.push(row);
    }
    return { you: [+r.x.toFixed(2), +r.z.toFixed(2)], obs: rvdObstacles(), rows: out };
  },
  words: (t) => (typeof rmoodWords === 'function' ? rmoodWords(typeof _revNorm === 'function' ? _revNorm(t) : t) : null),
  tune: (o) => Object.assign(RVD, o || {}),
  measure: (on) => { if (on != null) rvd.measure = !!on; return rvd.measure; },
  /** Debug: a camera walking beside you two, [az, d, h], or null. */
  follow: (a) => { rvd.follow = a || null; if (!a) rev.debugCam = null; else rvdFollowCam(); return rvd.follow; },
  state: () => {
    const M = rvd.M;
    return M ? { ph: M.ph, clk: +M.clk.toFixed(2), walkT: +(M.walkT || 0).toFixed(2), i: M.i, legs: M.plan.pts.length,
      lag: +M.lag.toFixed(3), lagAlong: M.lagAlong != null ? +M.lagAlong.toFixed(3) : null, held: M.held,
      v: +Math.hypot(M.v.x, M.v.z).toFixed(2), her: +rev.ch.sp.toFixed(2), yanks: M.yanks.length, dist: +M.dist.toFixed(2),
      sinceYank: +(M.clk - M.lastYank).toFixed(2), strain: +(M.strain || 0).toFixed(3), down: M.headDown != null ? +M.headDown.toFixed(0) : null, turn: M.headTurn != null ? +M.headTurn.toFixed(0) : null, wall: M.wall, wallWho: M.wallWho || null,
      gap: M.gap < 9 ? +(M.gap * 1000).toFixed(0) : null, cam: +rvd.camK.toFixed(2),
      rag: jadrija.pullRag ? (({ F, pitch, chest, holding }) => ({ F, pitch, chest, holding }))(jadrija.pullRag()) : null }
      : { ph: null, after: rvd.after, last: rvd.stats ? rvd.stats.why : null };
  },
  last: () => rvd.stats,
  all: () => rvd.all.slice(),
};
if (typeof revApi !== 'undefined') revApi.drag = rvdApi;
