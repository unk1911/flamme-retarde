// -----------------------------------------------------------------------------
// Roles reversed: Chloe hauls you about by other holds than your hair (1.587.0).
//
// Misha, 3 Oct 2026: *"run more interesting scenarios, in the kabine, all sorts
// of intrigues, baye getting pulled around by her hair, by other body parts,
// being used and abused, this is all part of the whole bdsm dynamic ... go all
// out and wild"*. The night loop's item A (plan/night-loop-2026-10-03.md).
//
// The same two adults and the same consensual game as src/49-reverse.js, and
// the safeword over all of it: "red" and every hold opens on that frame, and
// she goes to her aftercare as ever.
//
// THE LINE, said once in the plan and kept here: no sex between them. Nothing
// here grinds, thrusts or presses a pelvis against anybody, no face goes near
// anybody's crotch, and the neck hold is a hand on the NAPE — the back of the
// neck — never the throat. Each of those is measured on the skin, every hold.
//
// FIVE HOLDS (`rvo.M.kind`), one hand of hers or two, each a `rvm.move` of hers
// (src/49-revmoves.js runs her body, her arms, her look; this file asks):
//
//   EAR   — your ear pinched between her finger and thumb and you led round the
//           room by it, at her side and a little behind, your head tipped over
//           to her and your back bent toward her, shuffling. Your near hand
//           goes up to her wrist. A yank when you lag, or when she wants one.
//   ARM   — your arm twisted up behind your back, her one hand on your wrist and
//           the other on your elbow, you bent forward at the waist and walked
//           in front of her where she wants you: the cot, a corner, the door.
//           Cranked higher at a yank.
//   ANKLE — you lying on the cot: she goes to the end of it at your feet, takes
//           an ankle in both hands and drags you down the mattress toward her
//           in pulls (`jadrija.lieNudge`), then holds it there.
//   CHIN  — kneeling or standing: her hand under your jaw, your face tipped up
//           to hers and held there while she talks to you; turned this way and
//           that to look at you, or given a little shake.
//   NECK  — standing: her hand on the back of your neck, and you pushed down —
//           bent over the cot with your palms on the mattress if you are at it,
//           over your own knees if you are not — and held there. Her other hand
//           is free, and when she is stern or wound up she uses it on you.
//
// THE WALKS (ear, arm) are 1.585.0's hair drag (src/49-revwalk.js) with
// another hand: her path planned so that she AND you stay clear of the room
// (`rvoPlanWalk`, now to a place she chose rather than round the room), your
// body towed after your place off her (`rvoTow` — the drag's spring, lag and
// stumble), a yank when you lag. YOUR HEAD on the ear is a spring of its own
// (`rvoHead`): pulled over by the pinch, harder the further you lag, kicked by
// a yank and settling back.
//
// HER MOOD (src/49-revmood.js) sets all of it (`rvoMood`): stern, rougher and
// faster — a quicker walk, a lower bend, more yanks, a higher crank, longer
// holds, and the cot with a spanking at the end of it; excited, rough and
// playful in her waves — spurts, yanks for fun, shakes; warm, slow and light,
// a long leash of slack before any pull at all.
//
// WHEN: asked ("pull my ear", "twist my arm", "drag me by my ankle", "grab my
// chin", "push me down" … and in Croatian and French — a beg, `rmoodBeg`), or
// Shift+; (a beg for whichever hold fits where you are); or her own pick when
// she is stern or excited. She CHAINS them: led by the ear (or the arm) to the
// cot, bent over it by the neck, and spanked there.
// -----------------------------------------------------------------------------

const RVO = {
  // Your place off her, her frame (m): `side` out to her side `sg`, `fwd`
  // ahead of her. EAR: at her side, a little behind, near enough for her arm
  // to your ear with your head drawn over to her. ARM: in front of her and a
  // little to her side, her hands on your wrist and elbow behind your back —
  // half a metre root to root, which is as near as `revSteer` lets her come.
  // NECK: beside her, a hand ahead.
  place: {
    ear: { side: 0.64, fwd: -0.08 },
    arm: { side: 0.12, fwd: 0.62, head: 0.50 },
  },
  // Your body after her (the drag's): a spring on the miss (1/s), a body's
  // acceleration (m/s²), the most you walk (m/s), never nearer her than
  // `near` root to root, a walker's turn (rad/s), your keys leaning on it.
  kp: 2.6, accel: 1.9, vMax: 1.5, vTop: 1.8, near: 0.48, turn: 2.4, resist: 0.4, assist: 0.12,
  lurch: 0.8, lurchTau: 0.26, gap: 1.2, inWall: 0.26,
  // Planning: m off the walls for her and you, the body's half-width, the
  // sample step along a leg (m).
  wall: 0.30, body: 0.21, step: 0.15,
  // Your head on the ear (rad): tipped over to her this much at rest, and more
  // the further you lag; the spring (1/s²) and its damping; the most.
  ear: { tilt: 0.36, lagTilt: 0.55, k: 55, c: 9, most: 0.62, bow: 0.22, lat: 0.55, yank: 3.2 },
  // The arm behind your back: your bend (rad), how high your wrist is taken
  // up your back (m over your waist's level, at crank 1), your bend at a yank.
  arm: { bow: 0.42, bowStern: 0.30, wristBack: 0.115, crank0: 0.02, crank1: 0.13, yankBow: 0.22 },
  // The neck: your bend over the cot (rad) and in the room (over your knees).
  // Her place beside you as you go down: m out from your middle line, and
  // how far toward your nape from half way between it and your seat.
  // Her reach for your nape (m, shoulder to palm), and her bow and knees for
  // it at the most (rad, 0..1) — more and her head went down into you.
  neck: { bow: 1.58, bowRoom: 1.1, downT: 1.3, palmUp: 0.03, pelvis: 0.5, lat: 0.42, along: -0.05,
    reach: 0.46, herBow: 0.62, herW: 0.3 },
  // The chin: how far your face is tipped up toward hers at most (rad), the
  // turn either way when she looks you over.
  chin: { up: 0.95, turn: 0.42, shake: 0.10, arch: 0.12 },
  // The ankle: how far down the mattress she drags you (m, at mood 0..1),
  // each pull (m) and how quick (s), and how near the mattress's end your
  // pelvis may come (m).
  ankle: { far: [0.18, 0.42], pull: [0.06, 0.16], pullT: [0.55, 0.22], keep: 0.42, stand: 0.42 },
  // s to get to you and take hold before she gives up; the reach's tolerance (m).
  goT: 7, takeT: 2.6, takeNear: 0.04,
  // s before she picks one again on her own; and a kind again.
  cool: 26, coolKind: 50,
};

/** Her lines: each beat's own (neutral); the tone pools are below. */
const RVO_SAY = {
  hold_ear: ['Come here, you. By the ear.', 'Ear. Walk.', 'This way, babe.'],
  hold_arm: ['Arm behind your back. Walk.', 'Move.', "Let's go. You're coming with me."],
  hold_ankle: ['Where do you think you\'re going? Hm?', 'Come here.', 'Down you come.'],
  hold_chin: ['Look at me.', 'Eyes up. On me.', 'Chin up, babe.'],
  hold_neck: ['Down.', 'Bend over.', 'Head down. Stay.'],
  hold_yank: ['Keep up.', 'Hm? This way.', 'Come on.'],
  hold_walk: ['Almost there.', 'Keep walking.', 'Mm-hm. That way.'],
  hold_talk: ['You listening?', 'Good. Stay right there.', 'I like you like this.'],
  hold_done: ['There. Stay.', 'Okay. Good.', 'Better.'],
};
const RVO_MOOD_SAY = {
  hold_ear: {
    stern: ['By the ear, then. Since you won\'t listen.', 'Ear. Now. Walk.', "Oh, you're coming with me.",
      'Move. Every step I take, you take.', "Like a naughty little girl. Walk.", 'Not a word. Walk.'],
    warm: ['C\'mere, you. Gently...', 'Little walk, okay? By the ear. Hehe.', "Come with me, babe. I've got you.",
      'Easy... just follow my hand.'],
    excited: ['Ooh, by the ear! Come on! Hehe.', 'Gotcha! Let\'s go!', 'Ear! Ear! Walk! Hehe.',
      "Come on, come on, you're so slow!", 'Off we go, little one!'],
  },
  hold_arm: {
    stern: ['Arm up. Walk.', "Don't fight me. You'll lose.", 'Bend. Move. Now.', "You're going where I put you.",
      'Higher? Keep testing me.', 'Head down and walk.'],
    warm: ["Easy... I won't hurt you. Walk.", 'Slowly. I\'ve got your arm.', 'Mm. Just come with me, babe.'],
    excited: ['Hehe! Arrested! Walk!', "You're my prisoner now. Move!", 'Ooh, struggle! I dare you!',
      'March, babe! Hehe.'],
  },
  hold_ankle: {
    stern: ['Get back here.', 'Did I say you could lie up there?', 'Down. Here. Where I want you.',
      "Kick and it's worse.", 'You come when I pull.'],
    warm: ['C\'mere, sleepyhead. Hehe.', 'Little tug... come here, babe.', 'Mm, nope. Down here with me.'],
    excited: ['Gotcha by the foot! Hehe!', 'Wheee! Down you come!', 'Ha! Nowhere to go!', "I'm taking you! Hehe!"],
  },
  hold_chin: {
    stern: ['Look at me. Not the floor. Me.', 'Eyes. Up. Now.', 'Do I have your attention?',
      "Don't you dare look away.", 'Look at me when I talk to you.'],
    warm: ['Hey. Look at me. You\'re doing so good.', 'There she is. Hi.', "Let me see that pretty face.",
      'Look at me, babe. Mm.'],
    excited: ['Ooh, look at that face! Hehe.', 'Up, up, up! Look at me!', 'Hi! Hehe. You\'re mine.',
      'Look at you, all flushed!'],
  },
  hold_neck: {
    stern: ['Down. All the way.', 'Bend. Over. Now.', 'Head down. Stay there.', "You don't come up till I say.",
      'Down, and not a word.'],
    warm: ['Down you go... gently.', "Bend over for me, babe. I've got you.", 'Easy. Just stay down.'],
    excited: ['Down! Hehe!', 'Ooh, bend over! Yes!', "Down you go! Don't you dare get up!", 'Gotcha! Stay!'],
  },
  hold_yank: {
    stern: ['I said walk.', "Don't make me pull.", 'Faster.', 'Again? Keep up.', 'Did I say stop?', 'Move.'],
    warm: ['Oops. Easy, babe.', 'With me... closer.', 'Mm. This way.'],
    excited: ['Hehe! Yank!', 'Come here, you!', 'Ha! Squeak again!', 'Whoops! Hehe.', 'Faster, faster!'],
  },
  hold_walk: {
    stern: ['Eyes down. Walk.', "We're not done.", 'Keep going. I\'ll tell you when.'],
    warm: ['Look at you, coming along so nicely.', 'Good girl. Slowly.'],
    excited: ['Almost there! Hehe.', 'Faster! No, slower! Hehe.', 'Where shall I put you? Hmm!'],
  },
  hold_talk: {
    stern: ["Are you going to listen now?", "Next time I say something, you do it. Yes?", 'Say "yes, Chloe."',
      "I'm not angry. I'm in charge. There's a difference.", 'Do you know why you\'re here?', "You'll stay like this as long as I want.",
      "Good. Now you're paying attention.", 'I could keep you like this all night.'],
    warm: ["You're so pretty when you're obedient.", 'You know I adore you, right?', 'Mm. Good girl. I mean it.',
      "You're safe. I've got you.", 'Look how well you take it.'],
    excited: ['God, you\'re fun.', 'Hehe. What should I do with you next?', "Say please. Hehe.", 'I could eat you up. Hehe.',
      "Ugh, I love this. I love you like this.", "Don't move. I'm not done looking."],
  },
  hold_done: {
    stern: ['Stay there. Think about it.', 'Better. Stay.', 'Now you know.', "Don't move till I say."],
    warm: ['There. Good girl. C\'mere.', 'All done, babe. You did so well.', 'Okay, okay. Letting go.'],
    excited: ['Hehe. That was fun. Again later!', 'Phew! You okay? Hehe.', 'Best. Game. Ever.'],
  },
};
/** Her yes, by what you begged for: `RMOOD_SAY.beg.<kind>`. */
const RVO_BEG_SAY = {
  ear: ['By the ear? Oh, you naughty thing. C\'mere.', 'Your ear? Hehe. Okay.', 'Oh, I will. Come here.'],
  arm: ['Behind your back? Gladly.', 'Oh, you want to be marched? Okay.', 'Arm. Now. Hehe.'],
  ankle: ['By the ankle? Ha! Okay.', "Oh, I'm dragging you. Hold on.", 'Your foot? Mine now.'],
  chin: ['Look at you? Oh, you will.', 'Mm. Chin up, then.', 'Come here, pretty face.'],
  neck: ['Down? Oh, gladly.', 'Bend you over? Say less.', 'Mm, the back of your neck. Okay.'],
  haul: ['Oh, you want handling? Come here.', 'Mm. I know just where to grab you.', "Careful what you ask for, babe. Hehe."],
};

const rvo = {
  M: null,                   // the hold in hand (also `rvm.move` while it is on)
  last: -1e9, lastKind: {},  // when she last did one, and each kind
  n: 0, picks: [],           // how many, and her last picks
  after: null,               // { kind, until, asked } — once you are where it needs you
  chain: null,               // the next in a chain, { kind, dest } once this one is done
  head: { th: 0, v: 0 },     // your head on the ear: its tilt over to her, and how fast
  body: { bow: 0, lat: 0, neckP: 0, neckR: 0, neckY: 0, k: 0 },  // your body's aims as laid (rad)
  aimed: {},                 // which of your bones this file has an aim on
  cam: { p: 0, r: 0, j: 0 }, // your view's pitch, roll and jolt
  stats: null, all: [],      // what the last hold measured, and every one this session
  measure: true, every: 0.25,
  safeChk: null,
  view: null,                // debug: a camera off the two of you [az, d, h, at]
};
const _roA = new THREE.Vector3(), _roB = new THREE.Vector3(), _roC = new THREE.Vector3(), _roD = new THREE.Vector3();
const _roQ = new THREE.Quaternion(), _roQ2 = new THREE.Quaternion();
const _roUP = new THREE.Vector3(0, 1, 0);
const RVO_KINDS = ['ear', 'arm', 'ankle', 'chin', 'neck'];

function rvoTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvoSay(kind, force = false) {
  return typeof revSay === 'function' ? revSay(kind, force, null, { still: revStill.dom }) : null;
}
const rvoSm = (x) => { const e = Math.min(1, Math.max(0, x)); return e * e * (3 - 2 * e); };
const rvoQ = (ax, a) => new THREE.Quaternion().setFromAxisAngle(ax, a);

// ── her mood, read ───────────────────────────────────────────────────────────

/**
 * What her mood makes of it now (off `rmood`): pace (m/s), yank (u), how far
 * you may lag before she yanks (m), how often she yanks on her own (per s),
 * how long she holds (× a kind's own), how hard (0..1, the crank, the bend,
 * the pull), and how playful (the excited waves).
 */
function rvoMood() {
  const R = typeof rmood !== 'undefined' ? rmood : null;
  const s = R ? R.stern : 0.22, e = R ? R.ex.v : 0, g = typeof rmoodGentle === 'function' ? rmoodGentle() : 0.3;
  const tone = R ? R.tone : 'neutral';
  const c = (x, a, b) => Math.max(a, Math.min(b, x));
  return {
    s, e, g, tone,
    pace: c(0.58 + 0.36 * s + 0.22 * e - 0.20 * g, 0.44, 1.0),
    u: c(0.45 + 0.55 * s + 0.40 * e - 0.35 * g, 0.2, 1.2),
    lag: c(0.30 - 0.14 * s - 0.05 * e + 0.22 * g, 0.14, 0.55),
    own: Math.max(0, 0.26 * (s - 0.3)) + Math.max(0, 0.42 * (e - 0.22)),
    holdK: c(0.85 + 0.9 * s + 0.35 * e - 0.45 * g, 0.5, 1.9),
    hard: c(0.35 + 0.65 * s + 0.25 * e - 0.4 * g, 0, 1),
    play: c(e * 1.2 - 0.2 * s, 0, 1),
  };
}

// ── your body, read ──────────────────────────────────────────────────────────

/** Your chest's frame, world (not level): forward, up, right — the way your back is bent. */
function rvoChest() {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const i = f.boneIndex('chest');
  const q = f.boneTurn(i, new THREE.Quaternion()).premultiply(f.mesh.quaternion);
  const fw = new THREE.Vector3(1, 0, 0).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  return { fw, up, rt: new THREE.Vector3().crossVectors(fw, up).normalize(), P: revBone('chest', new THREE.Vector3()) };
}
/** Your body's level frame (chest forward, level): `rvhYourAxes`, with the figure's own turn. */
function rvoAxes() { return typeof rvhYourAxes === 'function' ? rvhYourAxes() : null; }

/**
 * Your ear on side `sg` (+1 your right, the bind's +z), world: the middle of
 * the outermost skin of your head at its height, and its normal out. Off the
 * head's bind vertices (`rvhPick`): +x forward, +y up, +z your right.
 */
function rvoEarIdx(sg) {
  const S = rvhBayeSkin();
  if (!S) return [];
  return rvhPick(S, 'ear' + sg, ['head'], (p, B) => {
    const h = B('head'); if (!h) return false;
    const x = p[0] - h[0], y = p[1] - h[1], z = (p[2] - h[2]) * sg;
    return x > -0.04 && x < 0.025 && y > 0.015 && y < 0.075 && z > 0.062;
  });
}
function rvoEar(sg) {
  const S = rvhBayeSkin(), idx = rvoEarIdx(sg);
  if (!S || !idx.length) return null;
  const P = rvhSkinSet(S, idx);
  const Hd = rvmYourHead();
  if (!Hd) return null;
  // The outermost few: the ear itself, not the hair over it.
  const side = Hd.rt.clone().multiplyScalar(sg);
  const L = P.map((p) => [p, p.clone().sub(Hd.C).dot(side)]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const T = new THREE.Vector3();
  for (const [p] of L) T.add(p);
  T.multiplyScalar(1 / L.length);
  return { T, n: side.clone().addScaledVector(Hd.up, 0.15).normalize(), Hd };
}

/**
 * The back of your neck (the nape: never the throat), world, and its normal:
 * between your neck bone and the base of your skull, out of the back of it.
 */
function rvoNape() {
  const Hd = rvmYourHead(), N = revBone('neck', new THREE.Vector3());
  if (!Hd || !N) return null;
  const C = rvoChest();
  const back = Hd.fw.clone().lerp(C ? C.fw : Hd.fw, 0.5).negate().normalize();
  const T = N.clone().lerp(Hd.H, 0.45).addScaledVector(back, 0.052);
  return { T, n: back, throat: N.clone().lerp(Hd.H, 0.3).addScaledVector(back, -0.05), Hd };
}

/** Your ankle, side `s` ('L'|'R'), world: the foot bone's head (the joint). */
function rvoAnkle(s) {
  return revBone('foot' + s, new THREE.Vector3());
}

/** Where your feet point along the cot (level, unit): head to feet. */
function rvoFootDir() {
  const H = revBone('head', new THREE.Vector3()), L = rvoAnkle('L'), R = rvoAnkle('R');
  if (!H || !L || !R) return null;
  const d = L.add(R).multiplyScalar(0.5).sub(H);
  d.y = 0;
  return d.lengthSq() > 1e-4 ? d.normalize() : null;
}

// ── where she walks you ──────────────────────────────────────────────────────

/** Your place off her, world, for her at (x, z) facing `yaw`. */
function rvoSpot(x, z, yaw, pl, sg) {
  const { f, r } = rvdAxes(yaw);
  return [x + r.x * pl.side * sg + f.x * pl.fwd, z + r.z * pl.side * sg + f.z * pl.fwd];
}
/** A segment of her walk, (a) to (b), facing `yaw` along it: clear for her and for you? */
function rvoSegClear(ax, az, bx, bz, yaw, pl, sg, slim = 0) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / RVO.step));
  for (let i = 0; i <= n; i++) {
    const k = i / n, hx = ax + (bx - ax) * k, hz = az + (bz - az) * k;
    // (Where you both start, slimmer: you start wherever you were.)
    const sl = i * RVO.step < slim;
    if (!rvdRoomOk(hx, hz, sl ? 0.12 : RVO.body, sl ? 0.16 : RVO.wall)) return false;
    const [yx, yz] = rvoSpot(hx, hz, yaw, pl, sg);
    if (!rvdRoomOk(yx, yz, sl ? 0.12 : RVO.body, sl ? 0.16 : RVO.wall)) return false;
    // Bent forward, your head is out ahead of your feet: inside the walls too
    // (MEASURED without this: your head 10 cm through the wall on a turn).
    if (pl.head) {
      const { f } = rvdAxes(yaw);
      if (!jadrija.kabina.room(yx + f.x * pl.head, yz + f.z * pl.head, sl ? 0.10 : 0.28)) return false;
    }
  }
  return true;
}
/** Her turn on the spot at (x, z) from `y0` to `y1`: your swing round her clear? */
function rvoTurnClear(x, z, y0, y1, pl, sg) {
  let d = y1 - y0; d = Math.atan2(Math.sin(d), Math.cos(d));
  const n = Math.max(2, Math.ceil(Math.abs(d) / 0.2));
  for (let i = 0; i <= n; i++) {
    const [yx, yz] = rvoSpot(x, z, y0 + d * i / n, pl, sg);
    if (!rvdRoomOk(yx, yz, RVO.body, RVO.wall)) return false;
  }
  return true;
}
/** Her place for your root at (x, z) facing `yaw`: your place off her taken back off. */
function rvoHerFor(x, z, yaw, pl, sg) {
  const { f, r } = rvdAxes(yaw);
  return [x - r.x * pl.side * sg - f.x * pl.fwd, z - r.z * pl.side * sg - f.z * pl.fwd];
}

/**
 * The places she takes you to (`dest`): beside the cot facing it (the room's
 * side, somewhere along it); into a corner, facing it; to the door, facing
 * it; or out into the middle of the floor. Answers [{ kind, x, z, yaw }] —
 * your root and the way you face at the end.
 */
function rvoDests(kind) {
  const out = [];
  const K = jadrija.kabina;
  if (kind === 'cot') {
    const Mt = typeof rvsMattress === 'function' ? rvsMattress() : null;
    if (!Mt) return out;
    for (const a of [0, -0.25, 0.25, -0.45, 0.45]) {
      const x = Mt.mid.x + Mt.out.x * (Mt.half + 0.46) + Mt.ax.x * a, z = Mt.mid.z + Mt.out.z * (Mt.half + 0.46) + Mt.ax.z * a;
      out.push({ kind, x, z, yaw: Math.atan2(Mt.out.x, Mt.out.z) });
    }
  } else if (kind === 'corner' || kind === 'mid') {
    // The room's corners off its walls: the box `room` answers for, found by walking out.
    const r = jadrija.rideFrom();
    const c = K.at ? jadrija.toWorld(K.at[0], K.at[1]) : [r.x, 0, r.z];
    const ex = (dx, dz) => { let d = 0.2; while (d < 6 && K.room(c[0] + dx * d, c[2] + dz * d, 0.5)) d += 0.1; return d - 0.1; };
    // The room's two axes, off the shore frame: t and s.
    const o = jadrija.toWorld(K.at[0], K.at[1]), ot = jadrija.toWorld(K.at[0] + 1, K.at[1]);
    const ux = ot[0] - o[0], uz = ot[2] - o[2], ul = Math.hypot(ux, uz) || 1;
    const t = [ux / ul, uz / ul], s = [-t[1], t[0]];
    if (kind === 'mid') {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * 6.283, d = 0.4 + Math.random() * 0.9;
        const x = c[0] + Math.cos(a) * d, z = c[2] + Math.sin(a) * d;
        if (rvdRoomOk(x, z)) out.push({ kind, x, z, yaw: Math.random() * 6.283 });
      }
      return out;
    }
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const dt = ex(t[0] * a, t[1] * a), ds = ex(s[0] * b, s[1] * b);
      // The corner, and you 0.42 m out of it on the diagonal, facing into it.
      const qx = c[0] + t[0] * a * dt + s[0] * b * ds, qz = c[2] + t[1] * a * dt + s[1] * b * ds;
      const ix = c[0] - qx, iz = c[2] - qz, il = Math.hypot(ix, iz) || 1;
      const x = qx + ix / il * 0.36, z = qz + iz / il * 0.36;
      out.push({ kind, x, z, yaw: Math.atan2(-(qx - x), -(qz - z)), corner: [qx, qz] });
    }
  } else if (kind === 'door') {
    const d = K.dc != null ? jadrija.toWorld(K.dc, K.face + 0.25 + 0.55) : null;
    const dd = K.dc != null ? jadrija.toWorld(K.dc, K.face) : null;
    if (d && dd) out.push({ kind, x: d[0], z: d[2], yaw: Math.atan2(-(dd[0] - d[0]), -(dd[2] - d[2])) });
  }
  return out;
}

/**
 * HER WALK to put you at `D` (your root, facing `D.yaw` at the end): your path
 * from where you stand, straight or by one turn (a point on a 0.3 m lattice of
 * the room), her path off it at your place's offset, and every piece of both
 * clear (`rvoSegClear`, `rvoTurnClear`). Answers { pts: [[x, z, yaw]...], S,
 * len, dest } (her points, her place to take hold) or null. `sg` the side of
 * her you are on.
 */
function rvoPlanWalk(kind, dests, sg) {
  const r = jadrija.rideFrom();
  if (!r || !dests.length) return null;
  const pl = RVO.place[kind];
  const K = jadrija.kabina;
  let best = null;
  // Your path: from where you stand, by `via` (a turn, or none), to a point
  // `ap` m short of D on the way D faces, and the last leg in to D facing it —
  // so you arrive facing where she wants you, with no turn on the spot.
  const ap = 0.65;
  const tryPath = (D, via) => {
    const A0 = [D.x - Math.sin(D.yaw) * -ap, D.z - Math.cos(D.yaw) * -ap];
    const ys = [[r.x, r.z]].concat(via ? [via] : []).concat([A0, [D.x, D.z]]);
    const pts = [];
    let len = 0, yawPrev = null, S = null;
    for (let i = 0; i < ys.length - 1; i++) {
      const [ax, az] = ys[i], [bx, bz] = ys[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.12) continue;
      const yaw = Math.atan2(-(bx - ax), -(bz - az));
      const A = rvoHerFor(ax, az, yaw, pl, sg), B = rvoHerFor(bx, bz, yaw, pl, sg);
      if (!S) S = [A[0], A[1], yaw];
      else {
        // At the turn: from her last point to this leg's start, facing round.
        const P0 = pts[pts.length - 1];
        if (!rvoTurnClear(P0[0], P0[1], yawPrev, yaw, pl, sg)) return null;
        if (Math.hypot(A[0] - P0[0], A[1] - P0[1]) > 0.05) {
          if (!rvoSegClear(P0[0], P0[1], A[0], A[1], yaw, pl, sg)) return null;
          pts.push([A[0], A[1], yaw]);
        }
      }
      if (!rvoSegClear(A[0], A[1], B[0], B[1], yaw, pl, sg, i === 0 ? 0.9 : 0)) return null;
      pts.push([B[0], B[1], yaw]);
      len += L; yawPrev = yaw;
    }
    if (!S || len < 0.6) return null;
    // Arrived facing D's way (the last leg is D's).
    let dl = yawPrev - D.yaw; dl = Math.atan2(Math.sin(dl), Math.cos(dl));
    if (Math.abs(dl) > 0.3) return null;
    // Her place to take hold: clear, with slim room (you start where you are).
    if (!rvdRoomOk(S[0], S[1], 0.12, 0.16)) return null;
    let turnSum = 0;
    for (let i = 1; i < pts.length; i++) { let d = pts[i][2] - pts[i - 1][2]; d = Math.atan2(Math.sin(d), Math.cos(d)); turnSum += Math.abs(d); }
    return { pts, S, len, dest: D, sc: len + 0.25 * turnSum + (via ? 0.4 : 0) };
  };
  for (const D of dests) {
    if (Math.hypot(D.x - r.x, D.z - r.z) < 0.3) continue;
    const p = tryPath(D, null);
    if (p && (!best || p.sc < best.sc)) best = p;
  }
  if (!best) {
    // One turn on the way: a point of the room's lattice.
    const c = K.at ? jadrija.toWorld(K.at[0], K.at[1]) : [r.x, 0, r.z];
    const W = [];
    for (let dx = -3; dx <= 3; dx += 0.3) for (let dz = -3.3; dz <= 3.3; dz += 0.3) {
      const x = c[0] + dx, z = c[2] + dz;
      if (rvdRoomOk(x, z, RVO.body, RVO.wall)) W.push([x, z]);
    }
    for (const D of dests) {
      for (const w of W) {
        const p = tryPath(D, w);
        if (p && (!best || p.sc < best.sc)) best = p;
      }
    }
  }
  return best;
}

// ── starting it ──────────────────────────────────────────────────────────────

/** Can she: on, not after the safeword, her hands free. */
function rvoFree(asked) {
  if (!rev.on || rev.care) return 'off';
  if (typeof rvkHandFull === 'function' && rvkHandFull()) return 'her hand is full';
  if (typeof rvkBusy === 'function' && rvkBusy()) return 'busy';
  if (!asked && ((typeof rvm !== 'undefined' && rvm.move) || rev.arm.mode === 'spank')) return 'busy';
  if (typeof rvm !== 'undefined' && rvm.move && rvm.move.id === 'care') return 'aftercare';
  return true;
}

/** Which hold fits where you are: ctx → kinds. */
function rvoFits(ctx) {
  if (ctx === 'stand') return ['ear', 'arm', 'neck', 'chin'];
  if (ctx === 'kneel' || ctx === 'cotKneel') return ['chin'];
  if (ctx === 'front' || ctx === 'back') return ['ankle'];
  return [];
}

/** Her own pick (from `revDecide`): stern or excited. */
function rvoCands(ctx, D) {
  if (rvo.M || rvo.after || rvoFree(false) !== true) return [];
  if (rev.clock - rvo.last < RVO.cool) return [];
  if (D.last.slice(-4).some((x) => /^haul/.test(x))) return [];
  const m = rvoMood();
  const want = Math.max(0, m.s - 0.40) * 1.7 + Math.max(0, m.e - 0.28) * 1.5;
  if (want < 0.06) return [];
  const out = [];
  const coolK = (k) => (rev.clock - (rvo.lastKind[k] || -1e9) < RVO.coolKind ? 0.25 : 1);
  for (const k of rvoFits(ctx)) {
    if (k === 'stand' && !rev.walk) continue;
    // Stern: the arm and the neck; excited: the ear and the ankle; both: the chin.
    const w = k === 'arm' ? 0.6 + 1.2 * m.s : k === 'neck' ? 0.5 + 1.1 * m.s + 0.4 * m.e
      : k === 'ear' ? 0.6 + 0.6 * m.s + 0.9 * m.e : k === 'ankle' ? 0.7 + 0.7 * m.s + 0.9 * m.e : 0.5 + 0.5 * m.s + 0.6 * m.e;
    out.push({ id: 'haul:' + k, s: 0.12 + 0.55 * want * w * coolK(k) });
  }
  return out;
}

/** Her pick, from `revDecide`: 'haul:<kind>'. */
function rvoChoose(id, why) {
  const kind = id.split(':')[1];
  const r = rvoStart(kind, { why });
  if (r === true) rvo.picks.push(kind);
  if (rvo.picks.length > 12) rvo.picks.shift();
  return r;
}

/**
 * Asked (a beg, `rmoodBeg(kind)`): `kind` one of the five, or 'haul' — the
 * one that fits where you are. Not where it fits, she has you there first
 * (on your feet for the ear, the arm, the neck; on the cot for the ankle).
 * Answers { ok, label }.
 */
function rvoAsk(kind) {
  if (!rev.on) return { ok: false, label: 'roles are not reversed' };
  if (rev.care) return { ok: false, label: 'aftercare' };
  const v = revView();
  const ctx = v ? v.ctx : null;
  if (kind === 'haul') {
    const fit = rvoFits(ctx);
    kind = fit.length ? fit[Math.floor(Math.random() * fit.length)] : 'ear';
  }
  if (rvo.M) {
    // Already: more of it.
    if (rvo.M.kind === kind || kind === 'haul') { rvoYank('asked again', 0.25); return { ok: true, label: 'Chloe: already — and harder, for asking' }; }
    // Another hold asked during one: chained, next.
    rvo.chain = { kind, asked: true };
    return { ok: true, label: 'Chloe: ' + kind + ' next' };
  }
  // Her belt or the leash in her hand: away first.
  if (typeof rvkBeltOut === 'function' && rvkBeltOut()) {
    rvkAsk('beltback');
    rvo.after = { kind, until: rev.clock + 22, asked: true };
    return { ok: true, label: 'Chloe: her belt back on, then your ' + kind };
  }
  if (typeof rvkCollarOn === 'function' && rvkCollarOn()) {
    rvkCollarEnd('begged');
    rvo.after = { kind, until: rev.clock + 22, asked: true };
    return { ok: true, label: 'Chloe: the collar off, then your ' + kind };
  }
  const need = rvoNeed(kind);
  if (!need.ok) {
    rvo.after = { kind, until: rev.clock + 26, asked: true };
    if (need.order && typeof revOrder === 'function' && !rev.dom.order) revOrder(need.order, 'haul:' + kind);
    return { ok: true, label: 'Chloe: ' + need.say };
  }
  const r = rvoStart(kind, { why: 'asked', asked: true });
  return r === true ? { ok: true, label: 'Chloe: your ' + kind + ' — ' + ({ ear: 'by the ear, walk', arm: 'arm up your back, walk',
    ankle: 'by the ankle, down the cot', chin: 'chin up, eyes on her', neck: 'bent over by the neck' })[kind] }
    : { ok: false, label: kind + ': ' + r };
}

/** Where `kind` wants you: { ok } or the order that puts you there and what she says. */
function rvoNeed(kind) {
  const v = revView();
  const ctx = v ? v.ctx : null;
  if (kind === 'ankle') return ctx === 'front' || ctx === 'back' ? { ok: true } : { ok: false, order: 'cot', say: 'on the cot first (2)' };
  if (kind === 'chin') return ctx === 'stand' || ctx === 'kneel' || ctx === 'cotKneel' ? { ok: ctx !== 'stand' || rev.walk }
    : { ok: false, order: 'kneel', say: 'on your knees first (4)' };
  return ctx === 'stand' && rev.walk ? { ok: true } : { ok: false, order: 'stand', say: 'on your feet first (1)' };
}

/**
 * Start a hold. `o.why`, `o.asked`, `o.dest` (where the walk goes: 'cot' |
 * 'corner' | 'door' | 'mid'), `o.chained`. Answers true or why not.
 */
function rvoStart(kind, o = {}) {
  const asked = !!o.asked;
  const fr = rvoFree(asked || o.chained);
  if (fr !== true) return fr;
  if (RVO_KINDS.indexOf(kind) < 0) return 'no such hold';
  const need = rvoNeed(kind);
  if (!need.ok) return 'not there: ' + need.say;
  if (asked && typeof rvhYield === 'function') rvhYield();
  if (typeof rvm !== 'undefined' && rvm.move && !o.chained) return 'busy';
  const m = rvoMood();
  const M = { id: 'haul', kind, ph: 'go', t: 0, tp: 0, why: o.why || 'mood', asked, chained: !!o.chained, mood0: m,
    held: false, v: { x: 0, z: 0 }, lv: { x: 0, z: 0 }, lag: 0, lagMax: 0, lastYank: -1e9, yanks: [], said: 0,
    err: { R: [], L: [] }, grip: { R: [], L: [] }, yourHand: [], gap: 9, inside: 0, gapLog: [], pelvis: 9, faceCrotch: 9, throat: 9,
    wall: 0, wallD: 0, furn: 0, furnAt: null, measAt: 0, tl: [], dist: 0, walkT: 0, struggles: 0, spanks: 0, rounds: 0 };
  // Each kind's set-up: her place to take hold, and which hands.
  const r = jadrija.rideFrom();
  if (kind === 'ear' || kind === 'arm') {
    // Where to: the cot (and over it, by the neck, when she is stern or it is
    // a chain), a corner, the door, or somewhere in the middle.
    let dk = o.dest;
    if (!dk) {
      const x = Math.random();
      dk = m.s > 0.5 ? (x < 0.6 ? 'cot' : x < 0.85 ? 'corner' : 'door')
        : m.e > 0.4 ? (x < 0.4 ? 'cot' : x < 0.65 ? 'mid' : x < 0.85 ? 'corner' : 'door')
          : (x < 0.45 ? 'mid' : x < 0.75 ? 'cot' : 'corner');
    }
    const order = [dk, 'cot', 'mid', 'corner', 'door'].filter((k, i, a) => a.indexOf(k) === i);
    let P = null;
    for (const dkk of order) {
      // You on her right by preference (her right hand), her left where the room has none.
      for (const sg of kind === 'arm' ? [-1, 1] : [1, -1]) {
        P = rvoPlanWalk(kind, rvoDests(dkk), sg);
        if (P) { P.sg = sg; P.dk = dkk; break; }
      }
      if (P) break;
    }
    if (!P) return 'no room to walk you';
    M.plan = P; M.sg = P.sg; M.dest = P.dk; M.i = 0;
    if (kind === 'ear') {
      M.s = P.sg > 0 ? 'R' : 'L';             // her hand on your ear: the one on your side
      M.earSg = P.sg > 0 ? -1 : 1;            // you on her right: your LEFT ear (bind −z)
    } else {
      // Behind you on your right (you on her left, sg −1): your right arm, her
      // left hand on the wrist and her right on your elbow; mirrored the other side.
      M.ys = P.sg < 0 ? 'R' : 'L';
      M.s = P.sg < 0 ? 'L' : 'R'; M.s2 = M.s === 'L' ? 'R' : 'L';
      // You are turned the way she will walk you while she takes your arm.
      M.faceTo = P.S[2];
    }
    revGo(P.S[0], P.S[1]);
    const { f } = rvdAxes(P.S[2]);
    rev.ch.face = new THREE.Vector3(P.S[0] + f.x * 3, rev.ch.y, P.S[1] + f.z * 3);
    // Next, at the cot: over it, by the neck — a chain, when she is stern
    // or wound up (and more often than not when you are hers to discipline).
    if (P.dk === 'cot' && !rvo.chain && !o.keepChain && (m.s > 0.45 || (m.e > 0.5 && Math.random() < 0.6) || (asked && Math.random() < 0.4))) {
      rvo.chain = { kind: 'neck', dest: 'cot' };
    }
  } else if (kind === 'ankle') {
    const Mt = rvsMattress(), fd = rvoFootDir();
    if (!Mt || !fd) return 'no cot';
    // The ankle nearer the room, both her hands on it: right on the ankle, left on the shin.
    const L = rvoAnkle('L'), R = rvoAnkle('R');
    M.ys = (L.clone().sub(Mt.mid).dot(Mt.out) > R.clone().sub(Mt.mid).dot(Mt.out)) ? 'L' : 'R';
    M.fd = fd;
    // How far down: her mood's, and no further than leaves your seat on the foam.
    const Pv = revBone('pelvis', new THREE.Vector3());
    const alongFd = Mt.ax.dot(fd) >= 0 ? 1 : -1;
    const pvAlong = Pv.clone().sub(Mt.mid).dot(Mt.ax) * alongFd;
    const room = Math.max(0, Mt.len - RVO.ankle.keep - pvAlong);
    M.far = Math.min(room, RVO.ankle.far[0] + (RVO.ankle.far[1] - RVO.ankle.far[0]) * m.hard);
    M.moved = 0;
    if (M.far < 0.06) return 'already at the end of the cot';
    M.s = 'R'; M.s2 = 'L';
    const P = rvoAnklePlace(M);
    if (!P) return 'noplace';
    M.place = P;
    revGo(P.x, P.z);
    rev.ch.face = new THREE.Vector3(P.x + Math.sin(-P.yaw) * 3, rev.ch.y, P.z - Math.cos(P.yaw) * 3);
    rvm.goal = { x: P.x, z: P.z, yaw: P.yaw, mode: 'stand' };
  } else if (kind === 'chin') {
    const Hd = rvmYourHead();
    if (!Hd) return 'no head';
    M.s = 'R';
    const sp = rvmChinSpot(Hd);
    const P = rvmPlan([{ s: 'R', T: sp.T, n: sp.n }], { mode: 'stand', prefer: new THREE.Vector3(Hd.fw.x, 0, Hd.fw.z).normalize(), preferK: 2.5, ring: [0.42, 0.48, 0.55, 0.62] });
    if (!P) return 'noplace';
    M.place = P;
    rvmGoPlan(P);
    M.holdT = (6 + Math.random() * 4) * m.holdK;
  } else if (kind === 'neck') {
    const sp = rvoNeckPlace(M, m, o);
    // Not at the cot and she is stern (or there is no room here to bend
    // you): marched there by the arm first, and bent over it.
    if ((!sp || (!M.cot && m.s > 0.45 && Math.random() < 0.75)) && !o.chained && !o.here) {
      rvo.chain = { kind: 'neck', dest: 'cot', asked };
      const r2 = rvoStart('arm', { why: (o.why || 'mood') + ' (to the cot for the neck)', asked, dest: 'cot', chained: false, keepChain: true });
      if (r2 === true) return true;
      rvo.chain = null;
    }
    if (!sp) return 'noplace';
  }
  if (typeof rvm !== 'undefined') {
    if (rvm.move && o.chained) rvm.move = null;
    rvm.move = M; rvmWant('stand'); rvm.body.bowTo = 0; rvm.body.wTo = 0;
  }
  rvo.M = M;
  rvo.last = rev.clock; rvo.lastKind[kind] = rev.clock; rvo.n++;
  rvo.after = null;
  rvo.head.th = 0; rvo.head.v = 0;
  rvoTrace({ pick: 'haul:' + kind, why: M.why, dest: M.dest || null, tone: m.tone, pace: +m.pace.toFixed(2), hard: +m.hard.toFixed(2) });
  return true;
}

/** The ankle: her place at the end of the cot past your feet, facing up it. */
function rvoAnklePlace(M) {
  const A = rvoAnkle(M.ys);
  if (!A) return null;
  const fd = M.fd;
  for (const d of [RVO.ankle.stand, 0.48, 0.38, 0.55]) {
    for (const lat of [0, 0.10, -0.10, 0.2]) {
      const x = A.x + fd.x * d - fd.z * lat, z = A.z + fd.z * d + fd.x * lat;
      if (!rvdRoomOk(x, z, 0.16, 0.18)) continue;
      return { x, z, yaw: Math.atan2(fd.x, fd.z), d };
    }
  }
  return null;
}

/**
 * The neck: her place beside you, at your left flank, facing it — her left
 * hand to your nape, her right free for your bottom. Bent over the cot if you
 * are at it (facing it, near its edge), over your own knees if not.
 */
function rvoNeckPlace(M, m, o = {}) {
  const r = jadrija.rideFrom();
  const Mt = rvsMattress();
  const ax = rvoAxes();
  if (!r || !ax) return null;
  // At the cot: facing it, your feet within a body of its edge.
  let cot = false;
  if (Mt) {
    const off = (r.x - Mt.mid.x) * Mt.out.x + (r.z - Mt.mid.z) * Mt.out.z - Mt.half;
    const al = Math.abs((r.x - Mt.mid.x) * Mt.ax.x + (r.z - Mt.mid.z) * Mt.ax.z);
    const facing = -(ax.fw.x * Mt.out.x + ax.fw.z * Mt.out.z);
    cot = off > 0.15 && off < 0.68 && al < Mt.len - 0.15 && facing > 0.75;
  }
  M.cot = cot;
  M.bowTo = cot ? RVO.neck.bow * (0.97 + 0.05 * m.hard) : RVO.neck.bowRoom * (0.9 + 0.15 * m.hard);
  // Her place: at your side, level with your shoulders, facing you — near
  // enough for her near hand to your nape while you are still upright. As
  // you go down she steps along with it (`rvoNeckServo`). Your left side by
  // preference; your right where the room has no place on your left (the
  // spot the 8 key puts you is a body off the west wall). The bent-over
  // place has to be there too, or she would be stood in the wall.
  const tryAt = (side) => {
    const left = ax.rt.clone().multiplyScalar(-side);
    // Bent, your nape goes about 0.55 m ahead of your feet: her place then
    // (at the cot, as near your hips as the cot leaves her).
    const bx = r.x + ax.fw.x * 0.08 + left.x * RVO.neck.lat, bz = r.z + ax.fw.z * 0.08 + left.z * RVO.neck.lat;
    if (!rvdRoomOk(bx, bz, 0.15, 0.32)) return null;
    for (const [lat, fw] of [[0.44, -0.04], [0.48, 0.0], [0.44, 0.06], [0.52, -0.06], [0.48, 0.12]]) {
      const x = r.x + left.x * lat + ax.fw.x * fw, z = r.z + left.z * lat + ax.fw.z * fw;
      if (rvdRoomOk(x, z, 0.15, 0.32)) return [x, z, fw];
    }
    return null;
  };
  let side = 1, at = tryAt(1);
  if (!at) { side = -1; at = tryAt(-1); }
  if (at) {
    const [x, z, fw] = at;
    M.side = side; M.s = side > 0 ? 'L' : 'R'; M.s2 = side > 0 ? 'R' : 'L';
    const yaw = Math.atan2(-(r.x + ax.fw.x * fw - x), -(r.z + ax.fw.z * fw - z));
    M.place = { x, z, yaw, mode: 'stand', bow: 0, w: 0 };
    revGo(x, z);
    rev.ch.face = new THREE.Vector3(x - Math.sin(yaw) * 3, rev.ch.y, z - Math.cos(yaw) * 3);
    rvm.goal = { x, z, yaw, mode: 'stand' };
    M.holdT = (cot ? 8 + Math.random() * 6 : 5 + Math.random() * 4) * m.holdK;
    // Already bent at the cot (on her arm, a chain): straight to where she
    // holds you down from — stepping there once your neck was in her hand
    // swung her palm round it toward your throat (MEASURED, 31 mm).
    if (cot && o.chained) rvoNeckServo(M, true);
    return M.place;
  }
  return null;
}

// ── the frame ────────────────────────────────────────────────────────────────

/** Her mood's offsets for this frame, and where her hand goes (side `s`), with the miss measured. */
function rvoHand(M, s, T, n, d, pole, shape = 'grip', rate = 9, k = 1, hold = null) {
  if (M.ph === 'out') return;
  const q = rvm.req[s];
  // The last frame's ask against where the palm was drawn: the miss; and the
  // palm against the point it holds (an ear, a wrist, a nape): the grip.
  if (M.sent && M.sent[s] && rvm.k[s] > 0.97 && M.held) {
    const p = rvmPalm(s, _roA);
    if (p) {
      M.err[s].push(p.distanceTo(M.sent[s]));
      if (p.distanceTo(M.sent[s]) > 0.1 && (M.big = M.big || []).length < 12) M.big.push([s, M.ph, +M.t.toFixed(2), +(p.distanceTo(M.sent[s]) * 1000).toFixed(0), +(M.sent[s].distanceTo(T) * 1000).toFixed(0)]);
      if (M.sentH && M.sentH[s]) M.grip[s].push(p.distanceTo(M.sentH[s]));
    }
  }
  void q;
  rvmAsk(s, { C: T.clone(), n: n.clone(), d: d.clone(), pole, cock: 0.05, shape, rate: rate * k, fb: true, fbK: 0.5 });
  (M.lastAsk = M.lastAsk || {})[s] = { C: T.clone(), n: n.clone(), d: d.clone(), pole: pole.clone() };
  (M.sent = M.sent || {})[s] = T.clone();
  (M.sentH = M.sentH || {})[s] = hold ? hold.clone() : null;
}

/**
 * YOUR BODY, TOWED (from `revTick`, while you are on your feet): during a walk
 * after your place off her; otherwise held where you stand while she has
 * hold of you (a struggle on W or S is hers to answer). Answers { yaw, sp }
 * for `jadrija.ride`, or null when this file is not holding you.
 */
function rvoTow(dt, Y) {
  const M = rvo.M;
  if (!M || !rev.last || M.kind === 'ankle') return null;
  const px = rev.last[0], pz = rev.last[1];
  if (M.ph !== 'walk') {
    if (M.kind === 'chin' && !rev.walk) return null;
    // Held still: where you are, facing where you face — a struggle, if you try.
    const tries = typeof keys !== 'undefined' && (keys.has('KeyW') || keys.has('KeyS'));
    if (M.held && tries && rev.clock - (M.strAt || -9) > 1.2) rvoStruggle(M);
    Y.x = px; Y.z = pz; Y.vx = 0; Y.vz = 0;
    // Turned with her on the last turn of a walk (the tow's own rate).
    let yaw = rev.yaw;
    if (M.faceTo != null) {
      let d = M.faceTo - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw += Math.max(-RVO.turn * dt, Math.min(RVO.turn * dt, d));
    }
    return { yaw, sp: 0 };
  }
  const C = rev.ch, { f, r } = rvdAxes(C.yaw);
  const pl = RVO.place[M.kind];
  M.offK = Math.min(1, (M.offK || 0) + dt / 1.0);
  const k = rvoSm(M.offK);
  // From where you actually were when her hand closed, out to your place.
  const s0 = M.side0 != null ? M.side0 : pl.side, f0 = M.fwd0 != null ? M.fwd0 : pl.fwd;
  const side = s0 + (pl.side - s0) * k, fwd = f0 + (pl.fwd - f0) * k;
  const tx = C.x + r.x * side * M.sg + f.x * fwd, tz = C.z + r.z * side * M.sg + f.z * fwd;
  const ex = tx - px, ez = tz - pz;
  let cx = f.x * C.sp + RVO.kp * ex, cz = f.z * C.sp + RVO.kp * ez;
  // Your keys: holding back drags your feet (a lag, so a yank); pressing on, a little help.
  const kx = Y.x - px, kz = Y.z - pz;
  const along = (kx * f.x + kz * f.z) / dt;
  const lean = along < 0 ? RVO.resist * Math.max(-3.5, along) : RVO.assist * Math.min(3.5, along);
  cx += f.x * lean; cz += f.z * lean;
  if (along < -0.3) M.resisting = (M.resisting || 0) + dt;
  const cl = Math.hypot(cx, cz);
  if (cl > RVO.vMax) { cx *= RVO.vMax / cl; cz *= RVO.vMax / cl; }
  let dvx = cx - M.v.x, dvz = cz - M.v.z;
  const dl = Math.hypot(dvx, dvz), am = RVO.accel * dt;
  if (dl > am) { dvx *= am / dl; dvz *= am / dl; }
  M.v.x += dvx; M.v.z += dvz;
  const ld = Math.exp(-dt / RVO.lurchTau);
  M.lv.x *= ld; M.lv.z *= ld;
  let nx = px + (M.v.x + M.lv.x) * dt, nz = pz + (M.v.z + M.lv.z) * dt;
  // Her arm is only so long: within `reach` of her shoulder on your side
  // (the ear) or in front of her (the arm), and that strain is a yank.
  const reach = M.kind === 'ear' ? 0.66 : 0.76;
  const shx = C.x + r.x * 0.18 * M.sg, shz = C.z + r.z * 0.18 * M.sg;
  const ax = nx - shx, az = nz - shz, ad = Math.hypot(ax, az);
  M.strain = 0;
  if (ad > reach) {
    M.strain = ad - reach;
    nx = shx + ax / ad * reach; nz = shz + az / ad * reach;
    const ux = ax / ad, uz = az / ad, out = M.v.x * ux + M.v.z * uz;
    if (out > 0) { M.v.x -= ux * out; M.v.z -= uz * out; }
  }
  // Never nearer her than a body's width.
  {
    const gx = nx - C.x, gz = nz - C.z, gl = Math.hypot(gx, gz);
    if (gl < RVO.near && gl > 1e-4) { nx = C.x + gx / gl * RVO.near; nz = C.z + gz / gl * RVO.near; }
  }
  const mx = nx - px, mz = nz - pz, ml = Math.hypot(mx, mz), mTop = RVO.vTop * dt;
  if (ml > mTop) { nx = px + mx / ml * mTop; nz = pz + mz / ml * mTop; }
  // Inside the walls with a body's width to spare, and out of the furniture.
  const K = jadrija.kabina;
  {
    const Hh = revBone('head', _roD);
    if (K && Hh && !K.room(Hh.x, Hh.z, 0.06)) {
      const c = K.at ? jadrija.toWorld(K.at[0], K.at[1]) : [px, 0, pz];
      const cx = c[0] - nx, cz = c[2] - nz, cl = Math.hypot(cx, cz) || 1;
      nx += cx / cl * 0.6 * dt; nz += cz / cl * 0.6 * dt;
      M.headOff = (M.headOff || 0) + 1;
    }
  }
  if (K && rvo.body.bow > 0.2) {
    const hd = 0.10 + 0.62 * Math.sin(Math.min(1.3, rvo.body.bow * rvo.body.k));
    const fx = -Math.sin(rev.yaw), fz = -Math.cos(rev.yaw);
    if (!K.room(nx + fx * hd, nz + fz * hd, 0.10)) {
      // Your head would be at a wall: no step that takes it nearer. Already
      // there (her turn swung you round to it), only a step away from it.
      const c = K.at ? jadrija.toWorld(K.at[0], K.at[1]) : [px, 0, pz];
      const toC = (nx - px) * (c[0] - px) + (nz - pz) * (c[2] - pz);
      if (K.room(px + fx * hd, pz + fz * hd, 0.10) || toC <= 0) { nx = px; nz = pz; M.headHit = (M.headHit || 0) + 1; }
    }
  }
  if (K && !K.room(nx, nz, RVO.inWall) && K.room(px, pz, RVO.inWall)) {
    M.wallHit = (M.wallHit || 0) + 1;
    if (K.room(nx, pz, RVO.inWall)) nz = pz;
    else if (K.room(px, nz, RVO.inWall)) nx = px;
    else { nx = px; nz = pz; }
  }
  // And out of the furniture the collider does not know (MEASURED without
  // it: walked in front of her on a turn, your shins through the radio's table).
  for (const o of (typeof rvdObstacles === 'function' ? rvdObstacles() : [])) {
    const ox = nx - o[0], oz = nz - o[1], od = Math.hypot(ox, oz), rr = o[2] + 0.16;
    if (od < rr && od > 1e-4) { nx = o[0] + ox / od * rr; nz = o[1] + oz / od * rr; M.furnHit = (M.furnHit || 0) + 1; }
  }
  if (ground.confine) {
    const [qx, qz] = ground.confine(nx, nz, Y.y);
    if (Math.hypot(qx - nx, qz - nz) > 1e-4) M.rootHit = (M.rootHit || 0) + 1;
    nx = qx; nz = qz;
  }
  Y.x = nx; Y.z = nz; Y.vx = 0; Y.vz = 0;
  const step = Math.hypot(nx - px, nz - pz);
  M.dist += step;
  M.lag = Math.hypot(tx - nx, tz - nz);
  M.lagMax = Math.max(M.lagMax, M.lag);
  const sp = step / dt;
  let dyw = C.yaw - rev.yaw; dyw = Math.atan2(Math.sin(dyw), Math.cos(dyw));
  const yaw = rev.yaw + Math.max(-RVO.turn * dt, Math.min(RVO.turn * dt, dyw));
  // Your look: within a turned head of your body; and as she sets off, eased
  // to where you are going (and a little toward her, on the ear).
  let lk = Y.yaw - yaw; lk = Math.atan2(Math.sin(lk), Math.cos(lk));
  if (Math.abs(lk) > 1.0) Y.yaw = yaw + Math.sign(lk) * 1.0;
  else if (M.walkT < 1.2) Y.yaw -= (lk - (M.kind === 'ear' ? 0.35 * M.sg : 0)) * (1 - Math.exp(-3 * dt));
  return { yaw, sp };
}

/** A struggle against her hold (W/S, or now and then on your own): she answers it. */
function rvoStruggle(M) {
  if (!M || !M.held) return false;
  M.strAt = rev.clock;
  M.struggles++;
  const m = rvoMood();
  rev.jolt = Math.max(rev.jolt, 0.35);
  rvo.cam.j = Math.max(rvo.cam.j, 0.6);
  // She holds on harder: more of the bend, a crank, a squeeze — and, stern, longer.
  M.press = 0.6 + 0.4 * m.hard;
  if (M.holdT != null && m.s > 0.45) M.holdT += 2 + 3 * m.s;
  if (Math.random() < 0.8) {
    revSay('hold_yank', true, rmoodPick(m.tone === 'stern' ? ['Uh-uh. Stay.', 'Did I say move?', 'Try that again. Go on.', 'Still. Now.']
      : m.tone === 'excited' ? ['Hehe, nope!', 'Ooh, feisty! No.', "Where d'you think you're going?"]
        : ['Shh. Stay with me.', 'Easy, easy.', 'Nope. Stay.']), { still: revStill.dom });
  }
  rvoTrace({ pick: 'haul:struggle', why: M.kind });
  return true;
}

/**
 * W or S while she holds you in a pose (by the chin kneeling, by the ankle on
 * the cot): not "get up" — a struggle, and she holds on. True while any hold
 * of hers is on you, so the key is hers to answer.
 */
function rvoPoseStruggle() {
  const M = rvo.M;
  if (!M || M.ph === 'out') return false;
  if (M.held && rev.clock - (M.strAt || -9) > 1.2) rvoStruggle(M);
  return true;
}

/** A yank: her hand jerks, you stumble after it, a gasp. `why` 'lag' | 'mood' | ...; `extra` on her u. */
function rvoYank(why, extra = 0) {
  const M = rvo.M;
  if (!M || !M.held) return false;
  if (M.t - M.lastYank < RVO.gap) return false;
  const m = rvoMood();
  const u = Math.max(0.2, Math.min(1.3, m.u + extra + (why === 'lag' ? 0.25 * Math.min(1, M.lag / 0.4) : 0)));
  M.lastYank = M.t;
  M.yk = { t: 0, u };
  if (M.ph === 'walk') {
    const C = rev.ch, { f } = rvdAxes(C.yaw), r0 = rev.last;
    let dx = f.x, dz = f.z;
    if (r0) {
      const [tx, tz] = rvoSpot(C.x, C.z, C.yaw, RVO.place[M.kind], M.sg);
      const ex = tx - r0[0], ez = tz - r0[1], el = Math.hypot(ex, ez);
      if (el > 0.05) { dx = ex / el + f.x * 0.6; dz = ez / el + f.z * 0.6; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
    }
    // (Not a stumble that puts your head into a wall.)
    if (r0 && !jadrija.kabina.room(r0[0] + dx * 0.3 - Math.sin(rev.yaw) * 0.45, r0[1] + dz * 0.3 - Math.cos(rev.yaw) * 0.45, 0.08)) { dx = 0; dz = 0; }
    M.lv.x += dx * RVO.lurch * u; M.lv.z += dz * RVO.lurch * u;
  }
  if (M.kind === 'ear') rvo.head.v += RVO.ear.yank * u;
  rev.jolt = Math.max(rev.jolt, 0.5 * u);
  rvo.cam.j = Math.max(rvo.cam.j, u);
  M.yanks.push({ t: +M.t.toFixed(2), ph: M.ph, why, u: +u.toFixed(2), lag: +M.lag.toFixed(2), tone: m.tone });
  if (Math.random() < 0.7 && typeof audio !== 'undefined' && audio && audio.startle && state.phase !== 'intro') {
    audio.startle('woman_young_slim', 0.5 + 0.3 * u);
  }
  if (Math.random() < 0.55) rvoSay('hold_yank');
  rvoTrace({ pick: 'haul:yank', why, kind: M.kind, u: +u.toFixed(2), lag: +M.lag.toFixed(2) });
  return true;
}

/**
 * Once a frame from `revTick`, after her step and before her arms are solved:
 * the hold's phases, her hands, the yanks, her lines, the measures.
 */
function rvoTick(dt) {
  if (!rev.on) return;
  rvoSafeCheck();
  // You are where a hold you asked for (or she ordered for) wants you: now.
  if (rvo.after && !rvo.M) {
    const A = rvo.after;
    if (rev.clock > A.until) rvo.after = null;
    else if (!rev.dom.order && rvoNeed(A.kind).ok && rvoFree(true) === true && !(typeof rvm !== 'undefined' && rvm.move)
      && rev.arm.mode !== 'spank') {
      rvo.after = null;
      const r = rvoStart(A.kind, { why: A.asked ? 'asked (after)' : 'after', asked: A.asked });
      if (r !== true) rvoTrace({ pick: 'haul:' + r, why: 'after' });
    }
  }
  rvo.cam.j *= Math.exp(-dt / 0.25);
  const M = rvo.M;
  if (!M) return;
  if (typeof rvm !== 'undefined' && rvm.move !== M) { rvoDone(M, 'ended'); return; }
  M.t += dt; M.tp += dt;
  if (M.yk) M.yk.t += dt;
  const v = revView();
  const ctxOk = M.kind === 'ankle' ? v && (v.ctx === 'front' || v.ctx === 'back')
    : M.kind === 'chin' ? v && (v.ctx === 'stand' || v.ctx === 'kneel' || v.ctx === 'cotKneel')
      : v && v.ctx === 'stand' && rev.walk;
  if (!ctxOk) { rvoDone(M, 'you moved: ' + (v ? v.phase : '?')); return; }
  const m = rvoMood();
  if (M.kind === 'ear' || M.kind === 'arm') rvoWalkTick(M, dt, m);
  else if (M.kind === 'neck') rvoNeckTick(M, dt, m);
  else if (M.kind === 'chin') rvoChinTick(M, dt, m);
  else if (M.kind === 'ankle') rvoAnkleTick(M, dt, m);
  if (!rvo.M) return;
  if (rvo.measure && M.held && M.t >= M.measAt) { M.measAt = M.t + rvo.every; rvoMeasure(M); }
  if (rvo.view) rvoViewCam();
}

/** The walks: her to her place, her hand on you, then her path with you towed after. */
function rvoWalkTick(M, dt, m) {
  const C = rev.ch;
  const { f, r } = rvdAxes(C.yaw);
  if (M.ph === 'go') {
    let dy = M.plan.S[2] - C.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if ((revAt() && Math.abs(dy) < 0.15) || M.tp > RVO.goT) { M.ph = 'take'; M.tp = 0; }
    return;
  }
  const H = rvoWalkHold(M, dt, m);
  if (!H) { rvoDone(M, 'nothing to hold'); return; }
  if (M.ph === 'take') {
    const near = H.near;
    if ((H.ok && M.tp > 0.45) || (M.tp > RVO.takeT && near < 0.08)) {
      M.held = true; M.ph = 'walk'; M.t1 = M.t; M.takeMiss = +near.toFixed(3);
      const r0 = jadrija.rideFrom();
      if (r0) {
        const rx = r0.x - C.x, rz = r0.z - C.z;
        M.side0 = Math.max(0, Math.min(0.9, (rx * r.x + rz * r.z) * M.sg));
        M.fwd0 = Math.max(-0.3, Math.min(0.8, rx * f.x + rz * f.z));
      }
      M.i = 0;
      const p = M.plan.pts[0];
      revGo(p[0], p[1]);
      rev.ch.face = null;
      rvoSay('hold_' + M.kind, true);
      return;
    }
    if (M.tp > RVO.takeT + 1.6) { rvoDone(M, 'out of reach (' + (near * 100).toFixed(0) + ' cm)'); return; }
    return;
  }
  if (M.ph === 'walk') {
    M.walkT = M.t - M.t1;
    let pace = m.pace * (M.kind === 'arm' ? 0.95 : 0.9);
    // Behind you with your arm, she cannot walk through you: when you are
    // short of your place she checks her step until you are there.
    if (M.kind === 'arm') pace *= Math.max(0.2, Math.min(1, 1 - (M.lag - 0.12) / 0.35));
    // Excited: in spurts.
    if (m.e > 0.35) {
      M.burstAt = (M.burstAt == null ? 2 : M.burstAt) - dt;
      if (M.burstAt <= 0) { M.burst = 0.6 + Math.random() * 0.6; M.burstAt = 2 + Math.random() * 2.5; }
    }
    if (M.burst > 0) { M.burst -= dt; pace *= 1.35; }
    rvm.slow = pace / REV.walk;
    // Her turns at her mood's rate.
    const tr = (1.3 + 1.6 * m.s + 1.0 * m.e - 0.4 * m.g) * (M.kind === 'arm' ? 0.55 : 1);
    if (M.herYaw != null) {
      let d = C.yaw - M.herYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const lim = Math.max(0.8, tr) * dt;
      if (Math.abs(d) > lim) C.yaw = M.herYaw + Math.sign(d) * lim;
    }
    M.herYaw = C.yaw;
    const pts = M.plan.pts, p = pts[M.i];
    const dd = Math.hypot(p[0] - C.x, p[1] - C.z);
    const last = M.i >= pts.length - 1;
    if (!last && (dd < 0.22 || revAt())) {
      M.i++;
      revGo(pts[M.i][0], pts[M.i][1]);
      if (M.said < 2 && Math.random() < 0.45) { M.said++; rvoSay('hold_walk'); }
    } else if (last && revAt()) {
      // There, facing it (the last leg is its way): a moment, and your body
      // brought round square to it; then the next of the chain.
      const q = pts[pts.length - 1];
      rev.ch.face = new THREE.Vector3(C.x - Math.sin(q[2]) * 3, rev.ch.y, C.z - Math.cos(q[2]) * 3);
      M.arriveT = (M.arriveT || 0) + dt;
      if (M.arriveT > 0.35) { M.ph = 'there'; M.tp = 0; M.faceTo = q[2]; return; }
    }
    if (M.walkT > 40) { M.ph = 'there'; M.tp = 0; return; }
    // A yank: you lag, or she wants one.
    if (M.walkT > 0.8) {
      if (M.lag > m.lag) rvoYank('lag');
      else if (M.strain > 0.04) rvoYank('strain');
      else if (Math.random() < m.own * dt) rvoYank('mood');
    }
    M.pace = M.pace || []; M.pace.push(C.sp);
    return;
  }
  if (M.ph === 'there') {
    // Held a beat where she has put you, then the chain's next (her hand
    // changes grip) or let go with a line.
    rvm.slow = 0;
    if (M.tp > 0.9 + 0.8 * m.s) {
      if (rvo.chain) { const ch = rvo.chain; rvo.chain = null; rvoChainTo(M, ch); return; }
      rvoOut(M, 'done');
    }
    return;
  }
  if (M.ph === 'out') { rvoOutTick(M, dt); }
}

/** Her hands on you for the walks; answers { ok, near } (her palm to where it goes). */
function rvoWalkHold(M, dt, m) {
  const C = rev.ch, { f, r } = rvdAxes(C.yaw);
  const down = _roUP.clone().negate();
  if (M.kind === 'ear') {
    const E = rvoEar(M.earSg);
    if (!E) return null;
    // A pinch: her palm a little out from the ear and above it, her fingers
    // down the side of your head, curled on it.
    const Hd = E.Hd;
    const d = Hd.up.clone().negate().addScaledVector(Hd.fw, -0.3).normalize();
    const T = E.T.clone().addScaledVector(E.n, 0.028).addScaledVector(d, -0.035);
    const pole = new THREE.Vector3(r.x * M.sg, -0.55, r.z * M.sg).addScaledVector(new THREE.Vector3(f.x, 0, f.z), -0.3).normalize();
    rvoHand(M, M.s, T, E.n, d, pole, 'grip', M.ph === 'take' ? 7 : (M.yk && M.yk.t < 0.4 ? 18 : 11), 1, E.T);
    const p = rvmPalm(M.s, _roB);
    const near = p ? p.distanceTo(T) : 9;
    const sh = rvmShoulder(M.s, _roC);
    if (sh && M.held) { const sd = sh.distanceTo(T); M.shMax = Math.max(M.shMax || 0, sd); M.shSum = (M.shSum || 0) + sd; M.shN = (M.shN || 0) + 1; }
    if (M.ph !== 'take') rvoYourHandUp(M, dt, 1);
    return { ok: rvm.k[M.s] > 0.95 && near < RVO.takeNear, near };
  }
  // The arm: her one hand on your wrist where your hand is up your back, the
  // other on your elbow.
  const W = rvhBayeWrist(M.ys, new THREE.Vector3()), El = revBone('armL' + M.ys, new THREE.Vector3());
  const Ch = rvoChest();
  if (!W || !El || !Ch) return null;
  const back = Ch.fw.clone().negate();
  const T1 = W.clone().addScaledVector(back, 0.032).addScaledVector(Ch.up, 0.01);
  const T2 = El.clone().addScaledVector(back, 0.03).addScaledVector(Ch.rt, (M.ys === 'R' ? 1 : -1) * 0.02);
  const d1 = Ch.rt.clone().multiplyScalar(M.ys === 'R' ? -1 : 1);
  const pole = new THREE.Vector3(-r.x * M.sg, -0.7, -r.z * M.sg).addScaledVector(new THREE.Vector3(f.x, 0, f.z), -0.4).normalize();
  const pole2 = new THREE.Vector3(r.x * M.sg * -1, -0.6, r.z * M.sg * -1).normalize();
  const tk = M.ph === 'take' ? 7 : 12;
  if (M.armK > 0.6 || M.ph !== 'take') rvoHand(M, M.s, T1, back, d1, pole, 'grip', tk, 1, W);
  rvoHand(M, M.s2, T2, back, Ch.up.clone().negate(), pole2, 'grip', tk, 1, El);
  // Her bow closed on her real shoulders: she leans in to reach you.
  const sh1 = rvmShoulder(M.s, _roC), sh2 = rvmShoulder(M.s2, _roD);
  if (sh1 && sh2) {
    const need = Math.max(sh1.distanceTo(T1), sh2.distanceTo(T2)) - 0.43;
    rvm.body.bowTo = Math.max(0, Math.min(0.7, rvm.body.bowTo + need * Math.min(1, dt * 3)));
    if (M.held) M.reachShort = Math.max(M.reachShort || 0, need);
  }
  const p = rvmPalm(M.s2, _roB);
  const p1 = rvmPalm(M.s, _roA);
  const near = Math.max(p ? p.distanceTo(T2) : 9, M.armK > 0.9 && p1 ? p1.distanceTo(T1) : 0);
  return { ok: rvm.k[M.s2] > 0.95 && near < RVO.takeNear + 0.01 && M.armK > 0.9, near };
}

/**
 * YOUR HAND UP TO HER WRIST on the ear (the drag's `rvdYourHand`): the hand
 * on her side, solved on to her forearm a hand's width above her palm.
 */
function rvoYourHandUp(M, dt, want) {
  M.handK = damp(M.handK || 0, want, want ? 4 : 6, dt);
  if (M.handK < 0.02 || typeof rvhBayeArm !== 'function') return;
  const s = M.sg > 0 ? 'L' : 'R';
  const palm = rvmPalm(M.s, _roA), sh = rvmShoulder(M.s, _roC);
  if (!palm || !sh) return;
  const T = palm.clone().addScaledVector(sh.clone().sub(palm).normalize(), 0.10);
  if (!M.handT) M.handT = T.clone(); else M.handT.lerp(T, 1 - Math.exp(-14 * dt));
  const { f } = rvdAxes(rev.yaw);
  const pole = new THREE.Vector3(-f.x * 0.4, -1, -f.z * 0.4).normalize();
  rvhBayeArm(s, M.handT, pole, M.handK);
  if (M.handK > 0.97) {
    const yp = rvhBayePalm(s, new THREE.Vector3());
    if (yp) M.yourHand.push(yp.distanceTo(M.handT));
  }
}

/** Next in a chain: this hold's hand lets go, and the next is taken from here. */
function rvoChainTo(M, ch) {
  rvoDone(M, 'chain: ' + ch.kind, true);
  const r = rvoStart(ch.kind, { why: 'chain (' + M.kind + ')', chained: true, asked: !!ch.asked, dest: ch.dest });
  if (r !== true) {
    rvoTrace({ pick: 'haul:chain ' + ch.kind + ': ' + r });
    if (typeof rvm !== 'undefined' && rvm.move === null) rev.dom.next = Math.min(rev.dom.next, rev.clock + 1);
  }
}

/**
 * THE NECK: her left hand flat on the back of your neck, you pushed down and
 * held bent over. Her fingers lie up the back of your neck toward your head
 * — on the nape and the hair above it, never round to the front (measured:
 * `throat`). When she is stern or wound up she lets go with a "stay down",
 * spanks you where you are bent, and takes your neck again.
 */
function rvoNeckTick(M, dt, m) {
  const C = rev.ch;
  if (M.ph === 'go') {
    if (rvmSettled() || M.tp > RVO.goT) { M.ph = 'take'; M.tp = 0; }
    return;
  }
  const N = rvoNape();
  if (!N) { rvoDone(M, 'no nape'); return; }
  const Hd = N.Hd;
  // Up the neck, toward the back of the head: the way her fingers lie.
  const nk = revBone('neck', new THREE.Vector3());
  const d = Hd.H.clone().sub(nk || Hd.H).normalize();
  d.addScaledVector(N.n, -d.dot(N.n)).normalize();
  const T0 = N.T.clone().addScaledVector(N.n, 0.020 - 0.006 * (M.press || 0)).addScaledVector(d, -0.01);
  // Taking hold, her hand comes to your nape over the top of it — never up
  // past your throat from below (MEASURED, bent over: her palm rose from her
  // side under your neck, 10 mm off your throat on the way): a point a hand
  // above it first, then down on to it.
  let T = T0;
  if (M.ph === 'take') {
    const pw = rvmPalm(M.s, _roA), over = T0.clone().addScaledVector(N.n, 0.11);
    if (!M.over && pw && pw.distanceTo(over) < 0.05) M.over = true;
    if (!M.over) T = over;
  } else M.over = false;
  const { f, r } = rvdAxes(C.yaw);
  const pole = new THREE.Vector3(-r.x, -0.4, -r.z).addScaledVector(new THREE.Vector3(f.x, 0, f.z), -0.3).normalize();
  // (Walking back to it after a round she is upright and her hand is her own:
  // bowed from the spank, her head went low across your arm — MEASURED, 6 cm in.)
  if (M.ph === 'back') {
    rvoNeckServo(M);
    rvm.body.bowTo = 0; rvm.body.wTo = 0;
    let dy = (rev.ch.face ? Math.atan2(-(rev.ch.face.x - C.x), -(rev.ch.face.z - C.z)) : C.yaw) - C.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if ((revAt() && Math.abs(dy) < 0.2 && rvm.body.bow < 0.08) || M.tp > 5) { M.ph = 'take'; M.tp = 0; }
    return;
  }
  const onNape = M.ph !== 'stay';
  if (onNape) rvoHand(M, M.s, T, N.n, d, pole, 'soft', M.ph === 'take' ? 7 : 12, 1, N.T);
  else {
    // While her other hand spanks, this one is flat on the small of your back,
    // holding you down — not hanging at her side by your face.
    const sp = revBone('spine01', new THREE.Vector3()), Ch = rvoChest();
    if (sp && Ch) {
      const up = Ch.fw.clone().negate();
      rvmAsk(M.s, { C: sp.clone().addScaledVector(up, 0.11), n: up, d: Ch.up.clone(), pole, cock: 0, shape: 'flat', rate: 8 });
    }
  }
  // Her bow closed on her real shoulder — a little, and never her head down
  // into you: the place does the rest (`rvoNeckServo`).
  const sh = rvmShoulder(M.s, _roC);
  if (sh && onNape && rev.arm.mode !== 'spank') {
    const need = sh.distanceTo(T) - RVO.neck.reach;
    rvm.body.bowTo = Math.max(0, Math.min(RVO.neck.herBow, rvm.body.bowTo + need * Math.min(1, dt * 3)));
    rvm.body.wTo = Math.max(0, Math.min(RVO.neck.herW, rvm.body.wTo + (rvm.body.bowTo >= RVO.neck.herBow - 0.01 ? need : -0.1) * dt * 2));
    if (M.held) M.reachShort = Math.max(M.reachShort || 0, need);
  }
  const p = rvmPalm(M.s, _roB);
  const near = p ? p.distanceTo(T) : 9;
  if (M.ph === 'take') {
    if (M.retake) rvoNeckServo(M);
    if ((rvm.k[M.s] > 0.95 && near < RVO.takeNear && M.tp > 0.4) || (M.tp > RVO.takeT && near < 0.08)) {
      M.held = true; M.tp = 0;
      if (M.retake) { M.ph = 'held'; M.retake = false; }
      else { M.ph = 'down'; M.takeMiss = +near.toFixed(3); rvoSay('hold_neck', true); }
    } else if (M.tp > RVO.takeT + 1.6 + (M.retake ? 3 : 0)) {
      if (M.retake) rvoOut(M, 'done'); else rvoDone(M, 'out of reach (' + (near * 100).toFixed(0) + ' cm)');
    }
    return;
  }
  if (M.ph === 'down') {
    // Pushed down: the bend comes in, quicker stern, slower warm — and only
    // as fast as her hand keeps your nape (it is her hand doing it).
    rvoNeckServo(M);
    M.dU = (M.dU || 0) + dt;
    if (M.dU > RVO.neck.downT * (1.2 - 0.5 * m.hard)) { M.ph = 'held'; M.tp = 0; M.t2 = M.t; }
    return;
  }
  if (M.ph === 'held') {
    const tt = M.t - M.t2;
    rvoNeckServo(M);
    // Her other hand's turn: stern or wound up, "stay down", and a round on
    // your bottom where you are bent; more rounds the sterner.
    M.rounds0 = M.rounds0 != null ? M.rounds0 : Math.max(0, Math.round(0.3 + 2.4 * m.s + 1.4 * m.e - 1.4 * m.g));
    if (M.rounds < M.rounds0 && tt > 2.2 + M.rounds * 4 && typeof revSpankRound === 'function') {
      const n = typeof rmoodSpanks === 'function' ? rmoodSpanks(2 + Math.floor(Math.random() * 2), false) : 3;
      revSay('hold_talk', true, rmoodPick(m.tone === 'excited' ? ['Stay down! Hehe.', "Don't you move. I'm not done.", 'Stay! Good girl.']
        : m.tone === 'warm' ? ['Stay down for me, babe.', 'Stay just like that.'] : ['Stay down.', "Don't you dare get up.", 'Stay. Right there.', 'Down. And stay down.']),
      { still: revStill.dom });
      const r2 = revSpankRound(n, 'bent over, by the neck');
      M.rounds++;
      if (r2 === true) { M.spanks += n; M.ph = 'stay'; M.tp = 0; M.stayN = n; } else rvoTrace({ pick: 'haul:spank ' + r2 });
      return;
    }
    if (M.said < 3 && tt > 2 + M.said * 3.5 && Math.random() < dt * 0.8) { M.said++; rvoSay('hold_talk'); }
    // A push down harder now and then: stern, firmly; excited, playfully.
    if (Math.random() < dt * (0.10 + 0.25 * m.play + 0.15 * m.s)) M.press = 0.4 + 0.5 * m.hard;
    // Now and then you squirm on your own (not when she is gentle).
    if (m.g < 0.5 && Math.random() < dt * 0.05) rvoStruggle(M);
    if (tt > M.holdT) rvoOut(M, 'done');
    return;
  }
  if (M.ph === 'stay') {
    // You stay down while she spanks; then her hand back on your neck.
    if (rev.arm.mode !== 'spank' && M.tp > 0.6) {
      const tt = M.t - M.t2;
      if (tt > M.holdT + 4) { rvoOut(M, 'done'); return; }
      M.ph = 'back'; M.tp = 0; M.retake = true; M.servoAt = null;
      rvm.body.bowTo = 0; rvm.body.wTo = 0;
    }
    return;
  }
  if (M.ph === 'out') rvoOutTick(M, dt);
}

/**
 * Her place as you go down: beside you, level with the middle of your back
 * (between your nape and your seat), `RVO.neck.lat` m off it on your left,
 * facing you — so her left hand keeps your nape and her right reaches your
 * bottom. Stepped to, every few tenths, as you are drawn.
 */
function rvoNeckServo(M, first = false) {
  if (!first && M.servoAt != null && M.t < M.servoAt) return;
  M.servoAt = M.t + 0.3;
  const N = rvoNape(), P = revBone('pelvis', new THREE.Vector3()), ax = rvoAxes();
  if (!N || !P || !ax) return;
  const left = ax.rt.clone().multiplyScalar(-(M.side || 1));
  let x = null, z = null;
  for (let k = 0.5 - RVO.neck.along; k <= 1.15; k += 0.06) {
    const mid = N.T.clone().lerp(P, k);
    const qx = mid.x + left.x * RVO.neck.lat, qz = mid.z + left.z * RVO.neck.lat;
    if (rvdRoomOk(qx, qz, 0.14, 0.2)) { x = qx; z = qz; break; }
  }
  if (x == null) return;
  if (Math.hypot(x - rev.ch.x, z - rev.ch.z) > 0.06) revGo(x, z);
  if (first) { const yw = Math.atan2(left.x, left.z); M.place = { x, z, yaw: yw, mode: 'stand', bow: 0, w: 0 }; rvm.goal = { x, z, yaw: yw, mode: 'stand' }; }
  const yaw = Math.atan2(left.x, left.z);
  rev.ch.face = new THREE.Vector3(x - Math.sin(yaw) * 3, rev.ch.y, z - Math.cos(yaw) * 3);
}

/** THE CHIN: her hand under your jaw, your face held up to hers; looked over, shaken, talked to. */
function rvoChinTick(M, dt, m) {
  if (M.ph === 'go') {
    if (rvmSettled() || M.tp > 6) { M.ph = 'take'; M.tp = 0; rvm.body.bowTo = M.place.bow; }
    return;
  }
  const Hd = rvmYourHead();
  if (!Hd) { rvoDone(M, 'no head'); return; }
  const sp = rvmChinSpot(Hd);
  const { r } = rvmAxes(rev.ch.yaw);
  const T = sp.T.clone().addScaledVector(sp.n, 0.006);
  rvoHand(M, 'R', T, sp.n, Hd.fw.clone(), r.clone().multiplyScalar(0.45).add(_roA.set(0, -1, 0)).normalize(), m.g > 0.55 ? 'soft' : 'grip', M.ph === 'take' ? 6 : 10, 1, sp.T);
  const p = rvmPalm('R', _roB);
  const near = p ? p.distanceTo(T) : 9;
  const sh = rvmShoulder('R', _roC);
  if (sh) {
    const need = sh.distanceTo(T) - 0.44;
    rvm.body.bowTo = Math.max(0, Math.min(0.6, rvm.body.bowTo + need * Math.min(1, dt * 3)));
    if (M.held) M.reachShort = Math.max(M.reachShort || 0, need);
  }
  if (M.ph === 'take') {
    if ((rvm.k.R > 0.95 && near < RVO.takeNear && M.tp > 0.4) || (M.tp > RVO.takeT && near < 0.08)) {
      M.held = true; M.ph = 'held'; M.tp = 0; M.t2 = M.t; M.takeMiss = +near.toFixed(3);
      rvoSay('hold_chin', true);
      if (jadrija.autoMove) jadrija.autoMove({ glance: Math.min(12, M.holdT) });
    } else if (M.tp > RVO.takeT + 1.6) rvoDone(M, 'out of reach (' + (near * 100).toFixed(0) + ' cm)');
    return;
  }
  if (M.ph === 'held') {
    const tt = M.t - M.t2;
    rev.lookTo = Math.max(rev.lookTo || 0, 0.3);
    // What she does with your face: looks it over (stern, turned one way and
    // the other), a shake (excited), or just holds it (warm).
    if (!M.act || tt > M.act.end) {
      const x = Math.random();
      const kind = x < 0.35 + 0.3 * m.s ? 'turn' : x < 0.55 + 0.3 * m.play ? 'shake' : 'still';
      M.act = { kind, t0: tt, end: tt + 1.6 + Math.random() * 1.6, dir: Math.random() < 0.5 ? 1 : -1 };
    }
    if (M.said < 4 && tt > 1.6 + M.said * 2.6 && Math.random() < dt * 1.2) { M.said++; rvoSay('hold_talk'); }
    if (m.s > 0.5 && Math.random() < dt * 0.06) rvoYank('mood');
    if (tt > M.holdT) rvoOut(M, 'done');
    return;
  }
  if (M.ph === 'out') rvoOutTick(M, dt);
}

/** THE ANKLE: at the end of the cot, both hands on your ankle, and you dragged down it in pulls. */
function rvoAnkleTick(M, dt, m) {
  const C = rev.ch;
  const A = rvoAnkle(M.ys);
  if (!A) { rvoDone(M, 'no ankle'); return; }
  const fd = M.fd;
  // Her hands: right on the ankle from above, left on the shin a hand up it.
  const up = _roUP.clone();
  const across = new THREE.Vector3(-fd.z, 0, fd.x);
  const shin = A.clone().addScaledVector(fd, -0.19);
  const kneeB = revBone('legL' + M.ys, new THREE.Vector3());
  if (kneeB) shin.lerpVectors(A, kneeB, 0.38);
  const T1 = A.clone().addScaledVector(up, 0.045).addScaledVector(fd, -0.01);
  const T2 = shin.clone().addScaledVector(up, 0.05);
  const pole = new THREE.Vector3(fd.x, 0.2, fd.z).addScaledVector(across, 0.6).normalize();
  const pole2 = new THREE.Vector3(fd.x, 0.2, fd.z).addScaledVector(across, -0.6).normalize();
  if (M.ph === 'go') {
    rvm.body.wTo = 0;
    if (rvmSettled() || M.tp > RVO.goT) { M.ph = 'take'; M.tp = 0; rvm.body.wTo = 0.42; }
    return;
  }
  const shape = 'grip';
  rvoHand(M, 'R', T1, up, across, pole, shape, M.ph === 'take' ? 6 : 12, 1, A);
  rvoHand(M, 'L', T2, up, across.clone().negate(), pole2, shape, M.ph === 'take' ? 6 : 12, 1, shin);
  // Bent to it: her bow and her knees closed on her real shoulders.
  const sh1 = rvmShoulder('R', _roC), sh2 = rvmShoulder('L', _roD);
  if (sh1 && sh2) {
    const need = Math.max(sh1.distanceTo(T1), sh2.distanceTo(T2)) - 0.43;
    rvm.body.bowTo = Math.max(0, Math.min(1.05, rvm.body.bowTo + need * Math.min(1, dt * 3)));
    if (rvm.body.bowTo > 0.55) rvm.body.wTo = Math.min(0.55, rvm.body.wTo + need * dt * 1.5);
    if (M.held) M.reachShort = Math.max(M.reachShort || 0, need);
  }
  const p1 = rvmPalm('R', _roA), p2 = rvmPalm('L', _roB);
  const near = Math.max(p1 ? p1.distanceTo(T1) : 9, p2 ? p2.distanceTo(T2) : 9);
  if (M.ph === 'take') {
    if ((rvm.k.R > 0.95 && rvm.k.L > 0.95 && near < RVO.takeNear + 0.01 && M.tp > 0.5) || (M.tp > RVO.takeT + 1 && near < 0.09)) {
      M.held = true; M.ph = 'pull'; M.tp = 0; M.takeMiss = +near.toFixed(3);
      rvoSay('hold_ankle', true);
      M.pulls = []; M.nextPull = 0.35;
    } else if (M.tp > RVO.takeT + 2.6) rvoDone(M, 'out of reach (' + (near * 100).toFixed(0) + ' cm)');
    return;
  }
  if (M.ph === 'pull') {
    // Pulls: stern, a few hard jerks; warm, one slow draw; excited, in bursts.
    if (!M.cur && M.tp >= M.nextPull && M.moved < M.far - 0.01) {
      const P = RVO.ankle;
      const d = Math.min(M.far - M.moved, P.pull[0] + (P.pull[1] - P.pull[0]) * (m.g > 0.55 ? 1 : m.hard) * (0.8 + 0.4 * Math.random()));
      const T = m.g > 0.55 ? 1.6 * d / 0.16 : P.pullT[0] + (P.pullT[1] - P.pullT[0]) * m.hard;
      M.cur = { d, T, t: 0, done: 0 };
      M.pulls.push({ t: +M.t.toFixed(2), d: +d.toFixed(3), T: +T.toFixed(2) });
      rev.jolt = Math.max(rev.jolt, 0.25 + 0.4 * m.hard);
      rvo.cam.j = Math.max(rvo.cam.j, 0.4 + 0.5 * m.hard);
      if (Math.random() < 0.6 && typeof audio !== 'undefined' && audio && audio.startle && state.phase !== 'intro') audio.startle('woman_young_slim', 0.4 + 0.3 * m.hard);
      if (M.pulls.length > 1 && Math.random() < 0.5) rvoSay('hold_yank');
    }
    if (M.cur) {
      const Cu = M.cur;
      Cu.t += dt;
      const k = rvoSm(Cu.t / Cu.T), step = Cu.d * k - Cu.done;
      Cu.done += step;
      // You down the mattress, toward her; she steps back with it.
      const at = jadrija.lieNudge ? jadrija.lieNudge(fd.x * step, fd.z * step) : null;
      if (at) M.moved += step;
      const nx = C.x + fd.x * step, nz = C.z + fd.z * step;
      if (rvdRoomOk(nx, nz, 0.14, 0.16)) { C.x = nx; C.z = nz; }
      if (Cu.t >= Cu.T) {
        M.cur = null;
        M.nextPull = M.tp + (m.g > 0.55 ? 0.6 : 0.35 + 0.7 * Math.random() * (1 - 0.5 * m.play));
      }
    }
    if (!M.cur && M.moved >= M.far - 0.01) { M.ph = 'held'; M.tp = 0; M.t2 = M.t; M.holdT = (2.5 + Math.random() * 2) * m.holdK; }
    if (M.tp > 18) { M.ph = 'held'; M.tp = 0; M.t2 = M.t; M.holdT = 2; }
    return;
  }
  if (M.ph === 'held') {
    const tt = M.t - M.t2;
    if (M.said < 2 && tt > 0.8 + M.said * 2 && Math.random() < dt * 1.2) { M.said++; rvoSay('hold_talk'); }
    if (tt > M.holdT) {
      // Stern or wound up and you are on your tummy: a spanking, now she has you there.
      if (m.s > 0.45 || m.e > 0.55) {
        const v = revView();
        if (v && v.ctx === 'front') rvo.spankAfter = rev.clock + 0.8;
      }
      rvoOut(M, 'done');
    }
    return;
  }
  if (M.ph === 'out') rvoOutTick(M, dt);
}

/** Her hand opens: she straightens, you are let be, a line. */
function rvoOut(M, why) {
  M.ph = 'out'; M.tp = 0; M.outWhy = why; M.t3 = M.t;
  rev.ch.goal = null;
  rvm.slow = 0;
  if (why === 'done') rvoSay('hold_done', true);
}
function rvoOutTick(M, dt) {
  rvm.body.bowTo = 0; rvm.body.wTo = 0;
  const u = Math.min(1, M.tp / 0.35);
  if (M.lastAsk && u < 1) {
    for (const s of Object.keys(M.lastAsk)) {
      const q = M.lastAsk[s];
      const sh = rvmShoulder(s, new THREE.Vector3());
      const w = q.n.clone();
      // (The chin: back toward her shoulder, under your face. The nape: straight
      // up off it — toward her shoulder went round your neck, MEASURED.)
      if (sh && M.kind === 'chin') w.add(sh.sub(q.C).normalize().multiplyScalar(1.4));
      w.normalize();
      rvmAsk(s, { C: q.C.clone().addScaledVector(w, (M.kind === 'neck' ? 0.24 : 0.14) * rvoSm(u)), n: q.n, d: q.d, pole: q.pole, cock: 0.05, shape: 'rest', rate: 14 });
    }
  }
  if (M.kind === 'ear') rvoYourHandUp(M, dt, 0);
  if (M.tp > 0.7) rvoDone(M, M.outWhy || 'done');
}

/** Over: her hands off, the move ended, the measures kept. `keep` keeps her move for a chain. */
function rvoDone(M, why, keep = false) {
  rvo.M = null;
  M.held = false;
  rvo.lastBody = M;
  rvo.stats = rvoSummary(M, why);
  rvo.all.push(rvo.stats);
  if (rvo.all.length > 30) rvo.all.shift();
  rvoTrace({ pick: 'haul end:' + M.kind, why, yanks: M.yanks.length, dist: +M.dist.toFixed(1) });
  if (typeof rvm !== 'undefined' && rvm.move === M) {
    if (keep) rvm.move = null; else rvmEnd(why);
  }
  if (rvo.spankAfter && !keep) {
    // After the ankle: her round on you where she has dragged you to.
    rvo.spankAfter = null;
    const n = typeof rmoodSpanks === 'function' ? rmoodSpanks(2, false) : 3;
    if (typeof revSpankRound === 'function') revSpankRound(n, 'after the ankle');
  }
}

/** What one hold measured — `__fr.reverse.haul.last()`. */
function rvoSummary(M, why) {
  const mm = (a, k = 1000) => {
    if (!a || !a.length) return null;
    const L = Array.from(a).sort((x, y) => x - y), q = (fq) => +(L[Math.min(L.length - 1, Math.floor(fq * L.length))] * k).toFixed(1);
    return { n: L.length, med: q(0.5), p90: q(0.9), max: +(L[L.length - 1] * k).toFixed(1) };
  };
  const m0 = M.mood0;
  const pace = (M.pace || []).filter((x) => x > 0.1);
  return { kind: M.kind, why, dest: M.dest || null, cot: M.cot != null ? M.cot : null, tone: m0.tone,
    stern: +m0.s.toFixed(2), excite: +m0.e.toFixed(2), gentle: +m0.g.toFixed(2),
    t: +M.t.toFixed(1), walked: +M.dist.toFixed(2), walkT: +(M.walkT || 0).toFixed(1),
    pace: pace.length ? +(pace.reduce((a, b) => a + b, 0) / pace.length).toFixed(2) : null,
    lagMax: +M.lagMax.toFixed(2), yanks: M.yanks.length, yankLog: M.yanks.slice(0, 12),
    struggles: M.struggles, rounds: M.rounds, spanks: M.spanks, pulls: M.pulls || null, moved: M.moved != null ? +M.moved.toFixed(3) : null,
    holdT: M.holdT != null ? +M.holdT.toFixed(1) : null, takeMiss: M.takeMiss != null ? M.takeMiss : null,
    hand: { R: mm(M.err.R), L: mm(M.err.L) }, grip: { R: mm(M.grip.R), L: mm(M.grip.L) }, yourHand: mm(M.yourHand),
    reachShort: M.reachShort != null ? +(M.reachShort * 1000).toFixed(0) : null,
    shoulder: M.shN ? [+(M.shSum / M.shN).toFixed(3), +M.shMax.toFixed(3)] : null,
    gapMin: M.gap < 9 ? +(M.gap * 1000).toFixed(0) : null, gapAt: M.gapAt || null, inside: M.inside,
    arms: M.armGap != null ? +(M.armGap * 1000).toFixed(0) : null, armsIn: M.armIn || 0, armAt: M.armAt || null,
    pelvis: M.pelvis < 9 ? +(M.pelvis * 1000).toFixed(0) : null, faceCrotch: M.faceCrotch < 9 ? +(M.faceCrotch * 1000).toFixed(0) : null,
    throat: M.throat < 9 ? +(M.throat * 1000).toFixed(0) : null, throatAt: M.throatAt || null, throatBy: M.throatBy || null, throatDbg: M.throatDbg || null,
    wallOut: M.wall, wallDeep: M.wallD ? [M.wallWho, +(M.wallD * 1000).toFixed(0)] : null,
    furnIn: +(M.furn * 1000).toFixed(0), furnAt: M.furnAt, furnHits: M.furnHit || 0, big: M.big || null, rootHits: M.rootHit || 0, wallHits: M.wallHit || 0, wallGive: M.wallGive || 0,
    headMax: M.headMax != null ? +(M.headMax * 57.3).toFixed(0) : null, bowMax: M.bowMax != null ? +(M.bowMax * 57.3).toFixed(0) : null,
    gapLog: M.gapLog.slice(0, 60), tl: M.tl.slice(0, 80), safe: M.safe || null };
}

// ── your body, laid on ───────────────────────────────────────────────────────

/** Aim one of your bones (figure space), remembered so it can be taken off. */
function rvoAim(name, q) {
  const f = jadrija && jadrija.figure;
  if (!f) return;
  armAimQ(f, name, q);
  rvo.aimed[name] = true;
}
function rvoUnaim() {
  const f = jadrija && jadrija.figure;
  if (!f) return;
  for (const n of Object.keys(rvo.aimed)) f.aim(n, 0, 0, 1, 0);
  rvo.aimed = {};
}

/**
 * YOUR BODY to the hold (from `revTick`, after her moves, so it is laid last
 * and a slap's flinch is composed into it): your bend at the hips and up your
 * back, the tip of your head, the twist of your arm, your palms. Eased in and
 * out (`rvo.body.k`). Also your head's spring on the ear.
 */
function rvoAfter(dt) {
  const M = rvo.M || null;
  const f = jadrija && jadrija.figure;
  if (!f || !rev.on) return;
  const B = rvo.body;
  const m = rvoMood();
  // (The arm goes up your back as she takes hold: her hand goes to it there.)
  const want = M && M.kind !== 'ankle' && ((M.ph !== 'out' && (M.held || (M.kind === 'arm' && M.ph === 'take')
    || (M.kind === 'neck' && M.chained && B.k > 0.05)))
    // (Letting go of your neck: you stay down till her hand is off it — coming
    // up at once, your neck rose through her hand, MEASURED 10 mm off your throat.)
    || (M.kind === 'neck' && M.ph === 'out' && M.tp < 0.55)) ? 1 : 0;
  // What each kind wants of you: the bow forward (rad), the lean to her side,
  // your neck's pitch (+ up), roll (+ to your right) and turn (+ to your left).
  let bow = 0, lat = 0, nP = 0, nR = 0, nY = 0, hip = 0.45;
  const L = M || rvo.lastBody;
  const press = M && M.press ? M.press : 0;
  if (M && M.press) M.press = Math.max(0, M.press - dt * 1.5);
  if (L && L.kind === 'ear') {
    // The spring: pulled over by the pinch, more as you lag; a yank kicks it.
    const H = rvo.head, E = RVO.ear;
    const lagK = M ? Math.min(1, (M.lag || 0) / 0.45) : 0;
    const tgt = want * (E.tilt * (0.8 + 0.5 * m.hard) + E.lagTilt * lagK * 0.5);
    H.v += (-E.k * (H.th - tgt) - E.c * H.v) * dt;
    H.th += H.v * dt;
    H.th = Math.max(-0.1, Math.min(E.most, H.th));
    // Toward her: you on her right (sg +1) is her on your LEFT.
    const toHer = L.sg > 0 ? -1 : 1;
    nR = toHer * H.th * 0.75;
    lat = toHer * H.th * E.lat;
    bow = E.bow * (0.8 + 0.4 * m.hard) + 0.10 * Math.min(1, H.th / E.most);
    nP = -0.10;
    hip = 0.25;
    if (M) M.headMax = Math.max(M.headMax || 0, H.th);
  } else if (L && L.kind === 'arm') {
    const yk = M && M.yk && M.yk.t < 0.6 ? Math.sin(Math.PI * Math.min(1, M.yk.t / 0.6)) * M.yk.u : 0;
    bow = RVO.arm.bow + RVO.arm.bowStern * m.hard + RVO.arm.yankBow * yk + 0.12 * press;
    nP = -0.18;
    hip = 0.5;
  } else if (L && L.kind === 'neck') {
    const kd = M && (M.ph === 'go' || M.ph === 'take') && !M.retake ? 0 : M && M.ph === 'down' ? rvoSm((M.dU || 0) / (RVO.neck.downT * (1.2 - 0.5 * m.hard))) : 1;
    // From the bend you were already in (a chain off the arm), or upright.
    if (M && (M.ph === 'go' || M.ph === 'take') && !M.retake) M.bow0 = M.chained ? B.bow : 0;
    const b0 = M && M.bow0 != null ? M.bow0 : 0;
    bow = b0 + ((L.bowTo || RVO.neck.bow) - b0) * kd + 0.10 * press;
    nP = 0.25 * kd;      // the head kept up a little off the mattress, looking at it
    hip = RVO.neck.pelvis;
  } else if (L && L.kind === 'chin') {
    // Up to her face: the pitch that brings your eyes to hers, turned to her,
    // and what she does with it (looked over, shaken).
    const Hd = rvmYourHead();
    const Cf = typeof rvhChloeFace === 'function' ? rvhChloeFace(new THREE.Vector3()) : null;
    if (Hd && Cf) {
      const ax = rvoAxes();
      const dv = Cf.clone().sub(Hd.C);
      const hz = Math.hypot(dv.x, dv.z) || 1;
      nP = Math.max(0.05, Math.min(RVO.chin.up, Math.atan2(dv.y, hz) + 0.18 + 0.12 * m.hard));
      if (ax) {
        const sd = -(dv.x * ax.rt.x + dv.z * ax.rt.z) / hz, fwd = (dv.x * ax.fw.x + dv.z * ax.fw.z) / hz;
        nY = Math.max(-0.6, Math.min(0.6, Math.atan2(sd, Math.max(0.2, fwd))));
      }
      const A = M && M.act;
      if (A && M.ph === 'held') {
        const u = (M.t - M.t2 - A.t0) / (A.end - A.t0);
        if (A.kind === 'turn') nY += A.dir * RVO.chin.turn * Math.sin(Math.PI * 2 * Math.min(1, u)) * (0.6 + 0.4 * m.hard);
        if (A.kind === 'shake') nR += RVO.chin.shake * Math.sin((M.t - M.t2) * 14) * (0.5 + 0.5 * m.play) * Math.sin(Math.PI * Math.min(1, u));
      }
      if (M && M.yk && M.yk.t < 0.5) nP += 0.2 * M.yk.u * Math.sin(Math.PI * M.yk.t / 0.5);
    }
    // Your back arched a little with it: a face tipped up from the chest, not the neck alone.
    bow = -RVO.chin.arch * Math.min(1, nP / 0.6);
    hip = 0;
  }
  B.k = damp(B.k, want, want ? 3.5 : 4.5, dt);
  if (B.k < 0.003 && !want) {
    if (Object.keys(rvo.aimed).length) rvoUnaim();
    rvo.lastBody = null;
    rvo.head.th = 0; rvo.head.v = 0;
    return;
  }
  const k = B.k;
  // NEVER YOUR HEAD THROUGH A WALL: the bend gives way while your head is
  // within a hand of one (MEASURED without it: bent forward on her arm
  // facing the west wall, your head 26 cm into it), and comes back after.
  {
    const Hh = revBone('head', _roA), K = jadrija.kabina;
    const fx = -Math.sin(rev.yaw), fz = -Math.cos(rev.yaw);
    const inside = !Hh || !K || (K.room(Hh.x, Hh.z, 0.12) && K.room(Hh.x + fx * 0.15, Hh.z + fz * 0.15, 0.08));
    B.cap = Math.max(0.12, Math.min(1, (B.cap == null ? 1 : B.cap) + (inside ? 0.6 : -2.5) * dt));
    if (bow > 0) bow *= B.cap;
    if (M && !inside) M.wallGive = (M.wallGive || 0) + 1;
  }
  B.bow = damp(B.bow, bow, 5, dt); B.lat = damp(B.lat, lat, 6, dt);
  B.neckP = damp(B.neckP, nP, 6, dt); B.neckR = damp(B.neckR, nR, 10, dt); B.neckY = damp(B.neckY, nY, 6, dt);
  if (M) M.bowMax = Math.max(M.bowMax || 0, B.bow * k);
  const ax = rvoAxes();
  if (!ax) return;
  const fq = ax.fq;
  const rt = ax.rt.clone().applyQuaternion(fq).normalize(), fw = ax.fw.clone().applyQuaternion(fq).normalize();
  const up = _roUP.clone().applyQuaternion(fq).normalize();
  const bw = B.bow * k, lt = B.lat * k;
  // The flinch of a slap (`rvmFlinchTick` lays it on spine01/02 before this): kept in.
  const F = typeof rvm !== 'undefined' ? rvm.flinch : null;
  const fl = (sh) => (F && F.on && F.ax ? rvoQ(F.ax.clone().applyQuaternion(fq).normalize(), F.x * sh) : new THREE.Quaternion());
  // At the hips first (the pelvis over your thighs, your thighs kept where
  // they were), then up your back.
  const hb = bw * hip, sb = bw - hb;
  if (hip > 0) {
    rvoAim('pelvis', rvoQ(rt, -hb));
    rvoAim('legUL', rvoQ(rt, hb)); rvoAim('legUR', rvoQ(rt, hb));
  }
  rvoAim('spine01', fl(0.6).multiply(rvoQ(rt, -sb * 0.36)).multiply(rvoQ(fw, lt * 0.30)));
  rvoAim('spine02', fl(0.4).multiply(rvoQ(rt, -sb * 0.34)).multiply(rvoQ(fw, lt * 0.35)));
  rvoAim('spine03', rvoQ(rt, -sb * 0.30).multiply(rvoQ(fw, lt * 0.35)));
  rvoAim('neck', rvoQ(up, B.neckY * k).multiply(rvoQ(rt, B.neckP * k)).multiply(rvoQ(fw, B.neckR * k)));
  // Your arms: twisted up your back; your palms on the mattress or your knees.
  if (L && L.kind === 'arm' && typeof rvhBayeArm === 'function') rvoArmTwist(L, dt, m, k);
  if (L && L.kind === 'neck' && typeof rvhBayeArm === 'function') rvoPalmsDown(L, dt, k);
}

/** Your arm up your back: your palm between your shoulder blades, cranked higher at a yank. */
function rvoArmTwist(M, dt, m, k) {
  const Ch = rvoChest(), P3 = revBone('spine03', new THREE.Vector3()), Pv = revBone('spine01', new THREE.Vector3());
  if (!Ch || !P3 || !Pv) return;
  const yk = M.yk && M.yk.t < 0.6 ? Math.sin(Math.PI * Math.min(1, M.yk.t / 0.6)) * M.yk.u : 0;
  const crank = Math.min(1, 0.35 + 0.55 * m.hard + 0.5 * yk + 0.3 * (M.press || 0));
  M.crank = crank;
  const back = Ch.fw.clone().negate();
  const side = Ch.rt.clone().multiplyScalar(M.ys === 'R' ? 1 : -1);
  // Up your spine from the small of your back toward your shoulder blades.
  const T = Pv.clone().lerp(P3, 0.15 + 0.75 * crank).addScaledVector(back, RVO.arm.wristBack).addScaledVector(side, -0.02);
  const pole = side.clone().addScaledVector(back, 0.9).addScaledVector(Ch.up, -0.3).normalize();
  M.armK = damp(M.armK || 0, k, 3, dt);
  rvhBayeArm(M.ys, T, pole, M.armK);
  if (M.armK > 0.97) {
    const yp = rvhBayePalm(M.ys, new THREE.Vector3());
    if (yp) M.yourHand.push(yp.distanceTo(T));
  }
}

/** Your palms flat on the mattress in front of you (over the cot), or on your knees. */
function rvoPalmsDown(M, dt, k) {
  const ax = rvoAxes();
  if (!ax) return;
  M.palmK = damp(M.palmK || 0, M.ph === 'held' || M.ph === 'down' || M.ph === 'stay' || M.ph === 'back' || M.retake ? k : 0, 3, dt);
  if (M.palmK < 0.02) return;
  const Mt = rvsMattress();
  for (const s of ['L', 'R']) {
    const sh = rvhBayeShoulder(s, new THREE.Vector3());
    if (!sh) continue;
    const sd = s === 'R' ? 1 : -1;
    let T;
    if (M.cot && Mt) {
      // Under your shoulders and a little ahead: not out to the side, where she stands.
      T = sh.clone().addScaledVector(ax.fw, 0.05).addScaledVector(ax.rt, -sd * 0.02);
      T.y = Mt.top + RVO.neck.palmUp;
    } else {
      const kn = revBone('legL' + s, new THREE.Vector3()), hp = revBone('legU' + s, new THREE.Vector3());
      if (!kn || !hp) continue;
      T = hp.lerp(kn, 0.40).addScaledVector(ax.fw, 0.085);
    }
    // The elbows back and up, a little out: not out sideways into her.
    const pole = ax.rt.clone().multiplyScalar(sd * 0.25).addScaledVector(ax.fw, -0.8).addScaledVector(_roUP, 0.5).normalize();
    rvhBayeArm(s, T, pole, M.palmK);
    // The hand laid flat, the fingers forward along the mattress (or down
    // your thigh): the clip's hand hung its fingers straight down, 12-18 cm
    // into the foam (MEASURED). Last frame's own turn taken back off first.
    {
      const f = jadrija.figure, ih = f.boneIndex('hand' + s), ifg = f.boneIndex('fingers' + s);
      if (ih >= 0 && ifg >= 0) {
        const fq = f.mesh.quaternion.clone().invert();
        const cur = f.boneAt(ifg, new THREE.Vector3()).sub(f.boneAt(ih, new THREE.Vector3())).normalize();
        const was = (M.handQ = M.handQ || {})[s] || new THREE.Quaternion();
        const raw = cur.applyQuaternion(was.clone().invert());
        const want = (M.cot ? ax.fw.clone().addScaledVector(_roUP, -0.12) : ax.fw.clone().multiplyScalar(0.35).addScaledVector(_roUP, -1)).normalize().applyQuaternion(fq);
        const q = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(raw, want), Math.min(1, M.palmK));
        rvoAim('hand' + s, q);
        M.handQ[s] = q;
      }
    }
    (M.dbgPalm = M.dbgPalm || {})[s] = { T: [+T.x.toFixed(3), +T.y.toFixed(3), +T.z.toFixed(3)], sh: [+sh.x.toFixed(3), +sh.y.toFixed(3), +sh.z.toFixed(3)], k: +M.palmK.toFixed(2) };
    if (M.palmK > 0.97) {
      const yp = rvhBayePalm(s, new THREE.Vector3());
      if (yp) M.yourHand.push(yp.distanceTo(T));
    }
  }
}

/** Your view: tipped with your head, down over the cot, jolted at a yank. Answers [pitch, roll]. */
function rvoCamTilt() {
  const B = rvo.body, j = rvo.cam.j;
  if (B.k < 0.002 && j < 0.002) return null;
  const L = rvo.M || rvo.lastBody;
  let p = 0, r = 0;
  if (L && L.kind === 'ear') { r = -B.neckR * B.k * 0.8; p = -0.12 * B.k; }
  else if (L && L.kind === 'arm') p = -0.30 * B.k;
  else if (L && L.kind === 'neck') p = -0.62 * Math.min(1, B.bow / 1.1) * B.k;
  else if (L && L.kind === 'chin') { p = 0.0; r = -B.neckR * B.k * 0.6; }
  p -= 0.10 * j;
  r += 0.05 * j * Math.sin(rev.clock * 37);
  const Yw = ground && ground.you;
  if (Yw) p = Math.max(p, -1.0 - Yw.pitch);
  return [p, r];
}

// ── measured on the skin ─────────────────────────────────────────────────────

/**
 * The two of you apart (both CPU-skinned off their drawn palettes, `rvsGap`,
 * inside counted past 3 mm): her body with her hands and arms out, and her
 * arms alone (her hands out); her pelvis against yours, your face against her
 * hips and hers against yours, her hand against your throat on the neck
 * hold; and both bodies against the room's walls and furniture.
 */
function rvoMeasure(M) {
  if (typeof rvsGap !== 'function') return;
  const A = rvsBayeSkin(3), B = rvsChloeSkin(3);
  if (!A || !B) return;
  const G = rvsGap({ A, B, skip: { 2: 1, 3: 1, 4: 1, 5: 1 } });
  const H = rvsGap({ A, B, skip: { 0: 1, 1: 1, 4: 1, 5: 1, 6: 1 } });
  if (G) {
    if (G.all.s < M.gap) {
      M.gap = G.all.s;
      const w = Object.entries(G.by).sort((a, b) => a[1].s - b[1].s)[0];
      M.gapAt = w ? [w[0], w[1].sher, M.ph, +M.t.toFixed(2)] : null;
    }
    M.inside = Math.max(M.inside, G.all.inN);
    if (M.gapLog.length < 400) M.gapLog.push(+(G.all.s * 1000).toFixed(0));
  }
  if (H) {
    if (H.all.s < (M.armGap == null ? 9 : M.armGap)) {
      const w = Object.entries(H.by).sort((a, b) => a[1].s - b[1].s)[0];
      M.armAt = w ? [w[0], w[1].sher, M.ph, +M.t.toFixed(2)] : null;
    }
    M.armGap = Math.min(M.armGap == null ? 9 : M.armGap, H.all.s); M.armIn = Math.max(M.armIn || 0, H.all.inN);
  }
  // The line: her pelvis to yours (bone to bone), your face to her hips, hers to yours.
  const hp = you && you.fig ? you.fig.boneAt(you.fig.boneIndex('pelvis'), new THREE.Vector3()).applyMatrix4(you.mesh.matrixWorld) : null;
  const yp = revBone('pelvis', new THREE.Vector3());
  const yf = rvmYourFace(new THREE.Vector3());
  const hf = typeof rvhChloeFace === 'function' ? rvhChloeFace(new THREE.Vector3()) : null;
  if (hp && yp) M.pelvis = Math.min(M.pelvis, hp.distanceTo(yp));
  if (hp && yp && yf && hf) M.faceCrotch = Math.min(M.faceCrotch, yf.distanceTo(hp), hf.distanceTo(yp));
  // The neck hold: her hand never round to your throat.
  if (M.kind === 'neck') {
    // Her hands against the FRONT of your neck — the throat: any of her hand
    // skin in front of your neck's middle (toward your throat), how near the
    // throat's skin it comes. The nape is the back of it.
    const N = rvoNape(), nk = revBone('neck', new THREE.Vector3());
    if (N && nk) {
      const Cn = nk.clone().lerp(N.Hd.H, 0.35), fr = N.n.clone().negate();
      for (let i = 0; i < B.n; i++) {
        if (B.reg[i] !== 4 && B.reg[i] !== 5) continue;
        const x = B.p[3 * i] - Cn.x, y = B.p[3 * i + 1] - Cn.y, z = B.p[3 * i + 2] - Cn.z;
        const front = x * fr.x + y * fr.y + z * fr.z;
        if (front < 0.01) continue;
        const d = Math.hypot(B.p[3 * i] - N.throat.x, B.p[3 * i + 1] - N.throat.y, B.p[3 * i + 2] - N.throat.z);
        if (d < ((M.throatBy = M.throatBy || {})[M.ph] || 9)) M.throatBy[M.ph] = +d.toFixed(3);
        if (d < M.throat) { M.throat = d; M.throatAt = [RVS_REG[B.reg[i]], M.ph, +M.t.toFixed(2), rev.arm.mode || '-', +(front * 100).toFixed(1), +((x * N.Hd.rt.x + y * N.Hd.rt.y + z * N.Hd.rt.z) * 100).toFixed(1), +((Cn.distanceTo(N.throat)) * 100).toFixed(1)]; }
        if (d < 0.04 && !M.throatDbg) { const v3 = (p) => p ? [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] : null; M.throatDbg = { v: [+B.p[3 * i].toFixed(3), +B.p[3 * i + 1].toFixed(3), +B.p[3 * i + 2].toFixed(3)], neck: v3(nk), H: v3(N.Hd.H), T: v3(N.T), n: v3(N.n), throat: v3(N.throat), palmL: v3(rvmPalm("L", new THREE.Vector3())), palmR: v3(rvmPalm("R", new THREE.Vector3())), yp: [v3(rvhBayePalm("L", new THREE.Vector3())), v3(rvhBayePalm("R", new THREE.Vector3()))] }; }
      }
    }
  }
  // The walls and the furniture, for both of you.
  const K = jadrija.kabina, fy = rev.ch.y;
  const obs = typeof rvdObstacles === 'function' ? rvdObstacles() : [];
  const Mt = rvsMattress();
  for (const [S, who] of [[A, 'you'], [B, 'her']]) {
    for (let i = 0; i < S.n; i += 2) {
      const x = S.p[3 * i], y = S.p[3 * i + 1], z = S.p[3 * i + 2];
      if (!K.room(x, z, -0.02)) {
        M.wall++;
        let dd = 0.02;
        while (dd < 0.3 && !K.room(x, z, -dd - 0.02)) dd += 0.02;
        if (dd > M.wallD) {
          const r0 = jadrija.rideFrom();
          M.wallD = dd; M.wallWho = who + ' ' + RVS_REG[S.reg[i]] + ' ' + M.ph + ' @' + M.t.toFixed(1) + ' at ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2)
            + (r0 ? ' root ' + r0.x.toFixed(2) + ',' + r0.z.toFixed(2) + ' yaw ' + rev.yaw.toFixed(2) : '');
        }
      }
      let d = 0;
      // The cot's frame, under the mattress's top (a hand over it is over it).
      if (Mt && y - fy < 0.40) {
        const a = Math.abs((x - Mt.mid.x) * Mt.ax.x + (z - Mt.mid.z) * Mt.ax.z), o = Math.abs((x - Mt.mid.x) * Mt.out.x + (z - Mt.mid.z) * Mt.out.z);
        if (a < Mt.len + 0.04 && o < Mt.half + 0.02) d = Math.max(d, Math.min(Mt.len + 0.04 - a, Mt.half + 0.02 - o));
      }
      // Into the mattress from above (more than its give).
      if (Mt && y < Mt.top - 0.03 && y - fy > 0.30) {
        const a = Math.abs((x - Mt.mid.x) * Mt.ax.x + (z - Mt.mid.z) * Mt.ax.z), o = Math.abs((x - Mt.mid.x) * Mt.out.x + (z - Mt.mid.z) * Mt.out.z);
        if (a < Mt.len - 0.02 && o < Mt.half - 0.02) d = Math.max(d, Mt.top - 0.03 - y);
      }
      let what = 'cot';
      if (y - fy < 0.60) obs.forEach((o, j) => { const e = o[2] - 0.08 - Math.hypot(x - o[0], z - o[1]); if (e > d) { d = e; what = ['tabouret', 'stand', 'table'][j] || 'obs' + j; } });
      if (d > M.furn) { M.furn = d; M.furnAt = who + ' ' + RVS_REG[S.reg[i]] + ' ' + what + ' ' + M.ph + ' @' + M.t.toFixed(1); }
    }
  }
  if (M.tl.length < 200) {
    M.tl.push([+M.t.toFixed(2), M.ph, G ? +(G.all.s * 1000).toFixed(0) : null, H ? +(H.all.s * 1000).toFixed(0) : null,
      +(rvo.body.bow * rvo.body.k * 57.3).toFixed(0), +(rvo.head.th * 57.3).toFixed(0), +(M.lag || 0).toFixed(2)]);
  }
}

/** The safeword's frame: her palms off you — measured until they are 5 cm off where they held. */
function rvoSafeCheck() {
  const K = rvo.safeChk;
  if (!K) return;
  K.n++;
  const off = K.sides.every((s) => { const pm = rvmPalm(s, new THREE.Vector3()); return !pm || pm.distanceTo(K.W[s]) > 0.05; });
  if (off || K.n > 120) {
    K.M.safe.free = off ? K.n : null; K.M.safe.freeT = +(rev.clock - K.t).toFixed(3);
    rvo.safeChk = null;
  }
}

/** The safeword: every hold opens this instant, you are let up where you are. */
function rvoSafe() {
  rvo.after = null; rvo.chain = null; rvo.spankAfter = null;
  const M = rvo.M;
  if (!M) return;
  const sides = [M.s, M.s2].filter(Boolean);
  M.safe = { t: rev.clock, ph: M.ph, free: null };
  const W = {};
  for (const s of sides) W[s] = rvmPalm(s, new THREE.Vector3()) || new THREE.Vector3();
  rvo.safeChk = { M, t: rev.clock, n: 0, W, sides };
  // Her arms back to her clip on this frame — not eased off over half a second.
  for (const s of sides) { if (typeof rvmArmFree === 'function') rvmArmFree(s); rvm.req[s] = null; if (rvm.qs) rvm.qs[s] = null; }
  M.v.x = M.v.z = 0; M.lv.x = M.lv.z = 0;
  rev.ch.goal = null;
  rvo.cam.j = 0;
  rvo.head.v = 0;
  rvoDone(M, 'safeword');
}

/** Swapped back or left: all of it off, now. */
function rvoClear() {
  const M = rvo.M;
  if (M) rvo.stats = rvoSummary(M, 'cleared');
  rvo.M = null; rvo.after = null; rvo.chain = null; rvo.spankAfter = null; rvo.lastBody = null;
  rvo.body.k = 0; rvo.head.th = 0; rvo.head.v = 0;
  rvoUnaim();
}

/** The scene block's part (`revScene`): `rev_hold`, the hold she has on you. */
function rvoScene(o) {
  const M = rvo.M;
  if (M && M.held && M.ph !== 'out') o.rev_hold = M.kind;
}

/** Debug: a camera off the two of you — [az, d, h, 'mid'|'you'|'feet'] (az 0 in front of you). */
function rvoViewCam() {
  const [az, d, h, at] = rvo.view;
  const r = jadrija.rideFrom();
  if (!r) return;
  const Pv = revBone('pelvis', new THREE.Vector3());
  const Nn = at === 'nape' ? rvoNape() : null;
  const Tg = Nn ? Nn.T.clone() : at === 'you' ? Pv : at === 'feet' ? (rvoAnkle('L') || Pv) : Pv.clone().lerp(new THREE.Vector3(rev.ch.x, Pv.y, rev.ch.z), 0.5);
  if (!Nn) Tg.y = at === 'feet' ? rev.ch.y + 0.6 : rev.ch.y + 0.95;
  // `az` 'away': from your side away from her (square on to the two of you).
  let a0 = az;
  if (az === 'away') {
    const { r: rr } = rvdAxes(rev.yaw);
    a0 = ((rev.ch.x - r.x) * rr.x + (rev.ch.z - r.z) * rr.z) > 0 ? 1.57 : -1.57;
  }
  for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3]) {
    for (const k of [1, 0.85, 0.7, 0.55]) {
      const a = rev.yaw + a0 + da;
      const x = Tg.x - Math.sin(a) * d * k, z = Tg.z - Math.cos(a) * d * k;
      if (typeof revRoom === 'function' && !revRoom(x, z)) continue;
      rev.debugCam = [x, Nn ? Tg.y + h : rev.ch.y + h, z, Tg.x, Tg.y, Tg.z];
      return;
    }
  }
}

// ── the words ────────────────────────────────────────────────────────────────

/**
 * Begging for a hold, on the line `revWords` has normalised (from
 * `rmoodWords`): 'rev.beg:<kind>' or null. Before the hair drag's "drag me"
 * and the pin's "hold me down": "drag me by my ankle" is the ankle, "push me
 * down" the neck.
 */
function rvoWords(t) {
  if (/\b(ear|ears|uho|uha|uhu|oreille|oreilles)\b/.test(t)
    && /\b(pull|tug|drag|lead|take|walk|grab|pinch|twist|by)\b|\bvuci\b|\bpovuci\b|\bvodi\b|\bzavrni\b|\buhvati\b|\bza uho\b|\btire\b|\btraine\b|\bpince\b|\bpar l'?oreille\b|\bl'?oreille\b/.test(t)) return 'rev.beg:ear';
  if (/\b(twist|bend|pin|put|hold|wrench|crank)\b.*\barm\b|\barm (up )?behind (my|your) back\b|\barm lock\b|\bzavrni mi ruku\b|\bruk[ua] iza (ledja|leda)\b|\b(tords|tord)[- ]moi le bras\b|\b(le )?bras (dans|derriere) (le|mon) dos\b|\bclef de bras\b/.test(t)) return 'rev.beg:arm';
  if (/\b(drag|pull|yank|grab|take)\b.*\b(ankle|ankles|leg|legs|foot|feet)\b|\bpull my leg\b|\b(vuci|povuci|uhvati)\b.*\b(nog[ue]|noge|gleza\w*|stopal\w*)\b|\bza nogu\b|\bza gleza\w*\b|\b(tire|traine|attrape)[- ]moi\b.*\b(cheville|jambe|pied)s?\b|\bpar (la|les) (cheville|jambe|pied)s?\b/.test(t)) return 'rev.beg:ankle';
  if (/\b(grab|hold|lift|take|tilt|raise)\b.*\b(chin|jaw)\b|\bchin up\b|\bmake me look at you\b|\b(uhvati|podigni|drzi)\b.*\b(bradu|bradom|celjust)\b|\bza bradu\b|\bnatjeraj me da te gledam\b|\b(prends|tiens|leve|souleve)[- ]moi le menton\b|\bpar le menton\b|\boblige[- ]moi a te regarder\b/.test(t)) return 'rev.beg:chin';
  if (/\b(hold|grab|take|push|pin)\b.*\b(neck|nape|scruff)\b|\bby the (neck|nape|scruff)\b|\bpush me (down|over)\b|\bbend me over\b|\b(drzi|uhvati|primi)\b.*\b(vrat|zatilj\w*)\b|\bza (vrat|zatiljak)\b|\b(gurni|sagni) me( dolje)?\b|\b(tiens|prends|attrape)[- ]moi (par )?la nuque\b|\bpar la nuque\b|\b(pousse|penche)[- ]moi( vers le bas)?\b/.test(t)) return 'rev.beg:neck';
  return null;
}

// Her lines into the tables (`REV_SAY` the beat's own, RMOOD_SAY its tones):
// once the whole script has run, because 49-revmood.js comes after this file
// in the build and its `const`s are not there yet while this one runs.
function rvoRegister() {
  if (typeof REV_SAY !== 'undefined') Object.assign(REV_SAY, RVO_SAY);
  if (typeof RMOOD_SAY !== 'undefined') {
    Object.assign(RMOOD_SAY, RVO_MOOD_SAY);
    if (RMOOD_SAY.beg) Object.assign(RMOOD_SAY.beg, RVO_BEG_SAY);
  }
  // Her voice: taking hold is a line that goes up ahead of the queue.
  if (typeof CHLOE_SAY !== 'undefined' && CHLOE_SAY.prio) for (const k of RVO_KINDS) CHLOE_SAY.prio['hold_' + k] = 1;
}
setTimeout(rvoRegister, 0);

// The help sheet, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.revhold': 'roles reversed: Shift+; or "pull my ear", "twist my arm", "drag me by my ankle", "grab my chin", "push me down" — Chloe hauls you by your ear or your arm twisted up your back (to the cot, a corner, the door), drags you down the cot by an ankle, holds your face up by the chin, or bends you over by the back of your neck. Stern: rougher, faster, longer, the cot and a spanking; excited: rough and playful; warm: gentle. W/S struggles. "red" lets go at once',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.revhold': 'zamijenjene uloge: Shift+; ili "vuci me za uho", "zavrni mi ruku", "vuci me za nogu", "uhvati me za bradu", "gurni me dolje" — Chloe te vodi za uho ili s rukom zavrnutom iza leđa (do kreveta, u kut, do vrata), vuče te niz krevet za gležanj, drži ti lice gore za bradu ili te sagne za zatiljak. Stroga: grublje, brže, dulje; uzbuđena: grubo i razigrano; nježna: blago. W/S otimanje. "crvena" pušta odmah',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.revhold': 'rôles inversés : Maj+; ou « tire-moi l’oreille », « tords-moi le bras », « tire-moi par la cheville », « prends-moi le menton », « pousse-moi » — Chloe vous mène par l’oreille ou le bras tordu dans le dos (au lit, au coin, à la porte), vous tire au bas du lit par la cheville, vous tient le visage levé par le menton, ou vous penche par la nuque. Sévère : plus brusque, plus long ; excitée : brusque et joueuse ; tendre : doux. W/S pour se débattre. « rouge » lâche tout de suite',
  });
}

/** `__fr.reverse.haul` — see 49-reverse.js. */
const rvoApi = {
  ask: (kind = 'haul') => rvoAsk(kind),
  beg: (kind = 'haul') => (typeof rmoodBeg === 'function' ? rmoodBeg(kind) : null),
  start: (kind, dest) => rvoStart(kind, { why: 'probe', asked: true, dest }),
  yank: (extra = 0) => rvoYank('probe', extra),
  squirm: () => rvoStruggle(rvo.M),
  end: () => { if (rvo.M) rvoOut(rvo.M, 'probe'); return true; },
  chain: (kind, dest) => { rvo.chain = kind ? { kind, dest } : null; return rvo.chain; },
  plan: (kind = 'ear', dest = 'cot', sg = 1) => rvoPlanWalk(kind, rvoDests(dest), sg),
  dests: (k) => rvoDests(k),
  mood: () => rvoMood(),
  words: (t) => rvoWords(typeof _revNorm === 'function' ? _revNorm(t) : t),
  tune: (o) => Object.assign(RVO, o || {}),
  measure: (on) => { if (on != null) rvo.measure = !!on; return rvo.measure; },
  /** Debug: a camera off the two of you, [az, d, h, at], or null. */
  view: (a) => { rvo.view = a || null; if (!a) rev.debugCam = null; else rvoViewCam(); return rvo.view; },
  state: () => {
    const M = rvo.M;
    return M ? { kind: M.kind, ph: M.ph, t: +M.t.toFixed(2), held: M.held, dest: M.dest || null, i: M.i,
      lag: +(M.lag || 0).toFixed(3), yanks: M.yanks.length, dist: +M.dist.toFixed(2), moved: M.moved != null ? +M.moved.toFixed(3) : null,
      gap: M.gap < 9 ? +(M.gap * 1000).toFixed(0) : null, bow: +(rvo.body.bow * rvo.body.k * 57.3).toFixed(0),
      head: +(rvo.head.th * 57.3).toFixed(0), crank: M.crank != null ? +M.crank.toFixed(2) : null, chain: rvo.chain,
      short: M.reachShort != null ? +(M.reachShort * 1000).toFixed(0) : null, spank: rev.arm.mode === 'spank' }
      : { kind: null, after: rvo.after, chain: rvo.chain, last: rvo.stats ? rvo.stats.kind + ': ' + rvo.stats.why : null };
  },
  last: () => rvo.stats,
  cur: () => (rvo.M ? rvoSummary(rvo.M, 'running') : null),
  dbg: () => { const M = rvo.M || rvo.lastBody; return M ? { palm: M.dbgPalm || null, yp: ['L', 'R'].map((s) => { const p = rvhBayePalm(s, new THREE.Vector3()); return p ? [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] : null; }), arms: rvh.armDbg ? JSON.parse(JSON.stringify(rvh.armDbg)) : null, aimed: Object.keys(rvo.aimed), rvhAimed: Object.keys(rvh.aimed) } : null; },
  all: () => rvo.all.slice(),
  /** Debug: the bodies' points, world: your ear, nape, ankle, chin; her palms. */
  geo: () => {
    const v = (p) => (p ? [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] : null);
    const E = rvoEar(-1), E2 = rvoEar(1), N = rvoNape();
    return { earL: E ? v(E.T) : null, earR: E2 ? v(E2.T) : null, nape: N ? v(N.T) : null, throat: N ? v(N.throat) : null,
      ankleL: v(rvoAnkle('L')), ankleR: v(rvoAnkle('R')), fd: v(rvoFootDir()),
      palmR: v(rvmPalm('R', new THREE.Vector3())), palmL: v(rvmPalm('L', new THREE.Vector3())),
      you: jadrija.rideFrom(), her: { x: rev.ch.x, z: rev.ch.z, yaw: rev.ch.yaw }, mattress: (() => { const Mt = rvsMattress(); return Mt ? { mid: v(Mt.mid), out: v(Mt.out), ax: v(Mt.ax), top: Mt.top } : null; })() };
  },
};
if (typeof revApi !== 'undefined') revApi.haul = rvoApi;
