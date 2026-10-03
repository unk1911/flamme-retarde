// -----------------------------------------------------------------------------
// Roles reversed: BOUND AND BLIND (1.587.0).
//
// Misha, 3 Oct 2026, the night loop: *"run more interesting scenarios, in the
// kabine, all sorts of intrigues ... this is all part of the whole bdsm
// dynamic ... go all out and wild"*. Item B of plan/night-loop-2026-10-03.md:
// wrists tied — to the cot frame, behind your back, to the hook — with
// Chloe's belt or a rope; a blindfold; left tied while she teases, checks the
// knots and makes you wait; untied, and her aftercare.
//
// The same two adults and the same consensual game as src/49-reverse.js, and
// the safeword over all of it: "red", and on that frame the ties are off, the
// blindfold is off, her remote is off — and then her aftercare, as ever.
//
// THE LINE, as everywhere in this game: no sex. Nothing here presses the two
// bodies together; her hands go to your wrists, your head and your hair, and
// the spanks are the existing spanks. Her whisper is at your ear.
//
// WHAT IT IS (`rvb.M`, a state of its own that lives through her other moves):
//
//   THE TIE (`kind`):
//     'cot'  — lying on the cot, face down or face up: your arms stretched up
//              over your head and your wrists tied together to the cot's end
//              rail beyond it (`rvbAnchor`).
//     'back' — standing or kneeling: your wrists tied together behind you, at
//              the small of your back, and the tail of the rope hanging.
//     'hook' — standing: she walks you to the coat hook on the east wall
//              (put there for this, `rvbKab`), you face the wall, your arms go
//              up and your wrists are tied to it.
//   WITH (`how`): a soft rope off the shelf (a coil of it lies at the shelf's
//   east end, and after a tie wherever she dropped it — she fetches it from
//   there), or HER BELT, off her jeans (the waist band in 49-you.js's shader
//   goes, `you.belt`, and the strap is carried folded in her fist).
//   THE ROPE IS DRAWN ON YOU: the coils round your wrists are the convex hull
//   of your skin there, measured off your mesh (`rvbHull`) and carried on your
//   forearms; then the tether to the anchor, round it, and back, or the tail.
//   It is drawn on as she ties and off as she unties (`tieU`).
//   YOUR ARMS ARE HELD: solved to the tie every frame (`rvbArms`, the 1.574
//   arm solve, `rvhBayeArm`), your keys cannot move them (`rvbYourAsk`), and W
//   or S — or any walking — is a STRUGGLE (`rvbStruggle`): your wrists pull
//   against the rope, your view jolts, and she notices.
//
//   THE BLINDFOLD: a dark cloth band over your eyes, fitted to your head the
//   way a stretched band sits — the convex hull of your head, hair, lashes and
//   brows at eye height, row by row (`rvbBandFit`) — carried on your head
//   bone. First person goes nearly black with a faint leak of light at the
//   bottom edge (`#rvb-dark`), and the sound stays: her voice and her steps
//   are panned and weighed by where she is (`audio.voiceSpace`, `stepAt`).
//
//   LEFT TIED (`rvbActs`): she walks away and makes you wait; comes back;
//   checks the knots (a tug); teases with her remote and the toys you wear
//   (`rvmStart('toy')` — 49-revtoys.js); spanks you if you struggle; comes to
//   your ear and whispers; praises you. Then she unties you (the rope comes
//   off as you watch), the blindfold comes off, your arms come down, and a
//   beat of aftercare: her hand in your hair, and a soft line.
//
// HER MOOD (src/49-revmood.js) sets it (`rvbMood`): STERN, longer, tighter (your
// arms further stretched), more checks, longer waits away, and a spank for a
// struggle; EXCITED, playful teasing in waves (her remote, the toys, short
// trips away, quick returns); WARM, short and soft, lots of praise, her hand in
// your hair.
//
// WHEN: asked — a beg (`rmoodBeg('bind' | 'blind' | 'untie')`): "tie me up",
// "tie my hands", "tie me to the bed", "blindfold me", "cover my eyes",
// "untie me", "zaveži me", "veži mi ruke", "poveži mi oči", "attache-moi",
// "bande-moi les yeux", or Shift+\ (tie) and Shift+= (blindfold) — or her own
// pick when she is stern or excited (`rvbCands`).
// -----------------------------------------------------------------------------

const RVB = {
  // THE ROPE: 8.4 mm soft cotton, laid (the colour twists along it).
  ropeR: 0.0042, ropeSides: 7, ropeCol: [0.80, 0.71, 0.54], ropeDark: 0.78,
  // Its coils round your wrists: how many, how far apart along your forearms
  // (m), how far off your skin's hull (m), and where along your forearm from
  // the wrist bone the middle of them is.
  coilTurns: 3, coilPitch: 0.0100, coilClear: 0.0010, coilUp: 0.034,
  // THE BELT (43-belt.js's): two turns of it, side by side.
  beltTurns: 2, beltPitch: 0.037, beltUp: 0.045,
  // Your wrists apart in the tie (m, middle to middle), and the most the
  // stern tie stretches you on (m beyond the loose one).
  wristGap: 0.050, stretch: 0.035,
  // THE COT: your wrists this far up over the end rail's top (m) and out
  // beyond its outer face (m); the rail's own section (from the frame in
  // 43-jadrija.js, `kabinaKit`: 50 mm along the cot, its top 40 mm under the
  // mattress top at the head end).
  cotUp: 0.062, cotOut: 0.030, railIn: 0.900, railOut: 0.950, railTop: -0.040, railBot: -0.160,
  // THE HOOK: the room's s (local) on the east wall, how high off the floor
  // (m), how far it stands out from the wall; where you stand (off the wall,
  // m) and where your wrists hang (under it, out from the wall, m).
  hookS: 23.05, hookY: 1.90, hookOut: 0.050, standOff: 0.36, wristBelow: 0.105, wristOut: 0.140,
  // BEHIND YOUR BACK: your palms behind your skin (m), at the top of your
  // bottom (m under the pelvis bone), and apart (m).
  backOff: 0.050, backDown: 0.090,
  // Times, s.
  goT: 10, fetchT: 0.9, armsT: 1.3, tieT: 2.8, beltTieT: 2.2, tugT: 0.6, untieT: 1.7, freeT: 0.9,
  blindT: 1.5, blindOffT: 1.2, darkIn: 0.45, darkOut: 1.0, stowT: 1.0, unbuckleT: 1.1,
  // Your struggle: how far your wrists pull (m), how long, and a breather.
  sqAmp: 0.026, sqT: 0.65, sqCool: 1.1,
  // Seconds before she picks it again on her own.
  cool: 60,
  // How often it is measured (s), skin to skin and the rope on you.
  every: 0.5,
  // First person, blindfolded: how dark (0..1).
  dark: 0.955,
};

/** Her lines (neutral); the tone pools are RVB_MOOD_SAY. */
const RVB_SAY = {
  bind: ["There. Now you're not going anywhere.", 'Hold still while I do this.', 'Wrists. Together. Good.'],
  bind_hold: ['Look at you, all tied up.', 'Comfy? You should be.', "Mm. I'm not in a hurry."],
  bind_squirm: ["Mm-mm. That rope's not going anywhere.", 'Pull all you like.', "Careful. You'll only make it tighter."],
  bind_check: ['Let me check these.', 'Still nice and snug.', 'Mm. Good knots.'],
  bind_away: ["Stay. I'll be right over here.", "Don't go anywhere. Oh wait, you can't."],
  bind_back: ["Miss me?", "I'm back."],
  bind_whisper: ["I'm right here.", 'Shh. Listen to me.', "Guess what I'm thinking."],
  bind_good: ['Good girl.', "You're doing so well.", 'So patient.'],
  bind_off: ["Okay. Let's get you out of these.", 'Untying you now.', 'There. Hands free.'],
  bind_no: ['Not yet.', 'Nope. I decide.', 'Patience.'],
  blind_on: ["Close your eyes. Now you can't see a thing.", "Eyes covered. Just my voice now.", 'Blindfold on.'],
  blind_off: ['Okay. Eyes. Slowly.', 'Blindfold off. Easy, the light.', "Hey. There you are."],
  bind_care: ["You were amazing. C'mere.", 'Hey. How are your wrists?', "I've got you. You did so good."],
};
const RVB_MOOD_SAY = {
  bind: {
    stern: ['Hands. Now.', "You're going to stay exactly like this.", "Don't you dare move.", 'Tight. The way you need it.',
      "That's for not listening.", 'There. Try getting out of that.'],
    warm: ['Easy... gentle. Tell me if it pinches.', 'There we go. Not too tight?', "Shh. I've got you.", 'Soft rope, soft knots. Okay?'],
    excited: ['Ooh, tied up! Hehe.', "Hehe, you're all mine now.", "Okay okay okay, hold still! Hehe.", 'Gotcha. Literally.',
      "Oh, this is gonna be fun."],
  },
  bind_hold: {
    stern: ["You stay like that until I say.", "I could leave you like this all night.", "Think about what you did.",
      'Quiet. You wait.', "Every second, babe. I'm counting.", "You don't get to decide when this ends."],
    warm: ["You look so beautiful like this.", "I'm right here, okay?", 'Breathe. Slow.', "You're doing so good for me."],
    excited: ["Hehe, you can't do anything!", "Mm, what should I do with you...", 'Wriggle for me. Go on.',
      "Ooh, I have ideas.", "You're so cute all tied up!", 'Ready? No? Too bad. Hehe.'],
  },
  bind_squirm: {
    stern: ['Stop pulling.', 'Did I say you could struggle?', "That's another minute.", 'Still. Now.', 'Pull again and see.',
      'You really want to test me?'],
    warm: ['Easy... easy, babe.', "Shh, you're okay.", "Hey. Relax into it. I'm here."],
    excited: ['Hehe, struggle more!', 'Ooh, feisty!', "Aww, can't get loose? Hehe.", 'Nice try, babe!'],
  },
  bind_check: {
    stern: ['Tighter.', "Hm. Still tight. Good.", "You've been pulling. I can tell.", "Not loose enough to slip. Shame."],
    warm: ['Not too tight? Wiggle your fingers.', 'Let me check... all good.', 'Okay. Fingers warm? Good.'],
    excited: ['Knots, knots, knots. Hehe.', "Still stuck! Yay.", 'Let me just... yep. Trapped.'],
  },
  bind_away: {
    stern: ["Wait there. I'll come back when I feel like it.", "I'm going over here. You wait.", 'Think about it. Alone.',
      "Don't move. I'll know."],
    warm: ["Right over here, babe. I can see you.", "Just a sec. I'm not going far."],
    excited: ["Hehe, bye! Don't go anywhere!", 'Be right back... maybe.', "Wait for me! Hehe."],
  },
  bind_back: {
    stern: ['Still here. Good.', 'Hm. You moved.', "I'm back. Did you miss me?"],
    warm: ["Hey, I'm here. Right here.", 'Back, babe.'],
    excited: ['Boo! Hehe.', 'Missed me? I missed you.', "Surprise! Hehe."],
  },
  bind_whisper: {
    stern: ["You're mine. Say it.", "I'm not done with you.", 'Every little sound. I hear it.', "You don't move unless I say."],
    warm: ['You are so good for me.', "I'm so proud of you.", 'Shh. Just breathe with me.', "I've got you, babe. Always."],
    excited: ["I'm right behind you... hehe.", "Guess where I am.", 'Do you know what I want to do next?', 'Shh... listen.'],
  },
  bind_good: {
    stern: ['Hm. Better.', 'Good. Stay like that.', "That's how you wait."],
    warm: ["Good girl. So good.", "You're doing amazing.", 'Perfect. Just perfect.', 'So patient. I love that.',
      "Look how well you're doing."],
    excited: ['Yes! Good girl!', "You're so good at this, hehe."],
  },
  bind_off: {
    stern: ["Fine. You've earned it.", "That's enough. For now.", 'Hands. Slowly.'],
    warm: ['Okay, babe. Off they come.', "There. All done. You did so well.", 'Let me get these off you.'],
    excited: ["Okay okay, freedom! Hehe.", 'Aww, already? Okay.', "Untie... untie... done!"],
  },
  bind_no: {
    stern: ['No.', "Ask me again and it's longer.", "You don't get to ask.", 'Not a chance.'],
    warm: ['Soon, babe. Soon.', 'A little longer, okay?'],
    excited: ['Hmm... no! Hehe.', 'Untie you? Nope.', 'Beg better. Hehe.'],
  },
  blind_on: {
    stern: ["You don't get to see.", "Eyes covered. Now you just listen.", 'Dark. Good.'],
    warm: ["I'm putting this over your eyes, okay? I'm right here.", 'Close your eyes for me.'],
    excited: ['Ooh, blindfold! Hehe.', "Now you can't see what's coming!", 'Guess what happens next.'],
  },
  blind_off: {
    stern: ['Eyes. Look at me.', 'There. You can see me now.'],
    warm: ['Slowly, babe. Let your eyes get used to it.', "Hey, you. There you are."],
    excited: ['Ta-da! Hehe.', "Surprise, it's me!"],
  },
  bind_care: {
    warm: ["You were so good. Let me rub your wrists.", 'Hey. All done. You okay?', "C'mere. I've got you.",
      'Shh. You were perfect.'],
    stern: ["Okay. That's done. You did well.", 'Come here. You were good.'],
    excited: ['That was so fun. You okay? Hehe.', "You were amazing, babe!"],
  },
};
const RVB_BEG_SAY = {
  bind: ['Tie you up? Oh, with pleasure.', "Mm. Hold out your wrists.", "You want to be tied? Hehe. Okay.",
    "Oh, I've got just the thing.", 'Say less. Hands.'],
  blind: ["A blindfold? Mm. Okay.", "You want it dark? Hehe.", 'Close your eyes for me...'],
  untie: ["Untie you? Hm. We'll see.", 'Ask nicely.'],
};

const rvb = {
  M: null,                // the bind going on
  last: -1e9, n: 0,       // when she last did one, how many
  after: null,            // { until, asked, want } — once you are where it needs you
  stats: null, all: [],   // what the last one measured, and every one this session
  measure: true,
  kab: null,              // the hook and the rope's coil, once made
  rope: null, belt: null, band: null, coil: null, carry: null, buckle: null,
  dark: null, darkK: 0, darkWas: -1,
  stepT: 0,
  frame: 0, safeChk: null,
};
const _rbA = new THREE.Vector3(), _rbB = new THREE.Vector3(), _rbC = new THREE.Vector3();
const _rbUP = new THREE.Vector3(0, 1, 0);
const _rbM = new THREE.Matrix4(), _rbQ = new THREE.Quaternion();

function rvbTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvbSay(kind, force = false) {
  return typeof revSay === 'function' ? revSay(kind, force, null, { still: revStill.dom }) : null;
}
const rvbSm = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const rvbCl = (x, a, b) => Math.max(a, Math.min(b, x));

// ── her mood, read ───────────────────────────────────────────────────────────

/**
 * What her mood makes of a tie (off `rmood`): how long you are left (s), how
 * tight (0 loose .. 1 stretched), how often she does something (s between),
 * how many checks, how long a wait away, and what she picks.
 */
function rvbMood() {
  const R = typeof rmood !== 'undefined' ? rmood : null;
  const s = R ? R.stern : 0.22, e = R ? R.ex.v : 0, g = typeof rmoodGentle === 'function' ? rmoodGentle() : 0.3;
  const tone = R ? R.tone : 'neutral';
  return {
    s, e, g, tone,
    hold: rvbCl(16 + 36 * s - 11 * g + 8 * e, 10, 62),
    tight: rvbCl(0.25 + 0.85 * s - 0.35 * g, 0, 1),
    gap: rvbCl(5.4 - 2.0 * s - 2.4 * e + 2.2 * g, 2.0, 9),
    checks: Math.max(0, Math.round(0.4 + 2.6 * s + 0.6 * e)),
    awayFor: s > 0.5 ? [7, 13] : e > 0.4 ? [2.5, 5] : [2.5, 4],
    away: Math.max(0.05, 0.25 + 1.6 * s + 0.5 * e - 0.5 * g),
    spankSq: rvbCl(0.1 + 0.95 * s + 0.25 * e - 0.8 * g, 0, 1),
    rounds: Math.max(0, Math.round(0.2 + 2.2 * s + 1.0 * e - 1.6 * g)),
    remote: 0.3 + 1.8 * e,
    whisper: 0.45 + 0.7 * e + 0.6 * g,
    praise: 0.1 + 2.4 * g,
    stroke: g > 0.35 ? 0.4 + 1.6 * g : 0,
    blindP: rvbCl(0.1 + 0.35 * s + 0.5 * e - 0.2 * g, 0, 0.9),
    beltP: rvbCl(0.15 + 0.55 * s - 0.2 * g, 0, 0.8),
  };
}

// ── the room: the hook, the rope's coil ──────────────────────────────────────

/** A material for rope, cloth and leather: vertex colours, lit by the room. */
function rvbMat(spec = 0.10, pw = 24) {
  return solidMaterial(0xffffff, { spec, specPower: pw, side: THREE.DoubleSide, body: 'base *= vVCol;' });
}

/**
 * The kabina's part (once): THE HOOK on the east wall — a brass rosette and a
 * stout hook out of it, the same brass as the towel's — and the coil of soft
 * rope at the shelf's east end. Answers `{ hook: { W, n, lat, tip, stand, yaw } }`
 * or null away from the kabina.
 */
function rvbKab() {
  if (rvb.kab) return rvb.kab;
  const J = typeof jadrija !== 'undefined' ? jadrija : null;
  const K = J && J.kabina;
  if (!K || !J.toWorld || !K.kit) return null;
  const kit = K.kit();
  if (!kit || !kit.cot) return null;
  const floor = K.floor;
  // The east wall's inner face at the hook's s: the room's own edge, walked to.
  const s = RVB.hookS;
  let t = kit.cot[0];
  for (let k = 0; k < 400; k++) { const w = J.toWorld(t + 0.005, s); if (!K.room(w[0], w[2], 0)) break; t += 0.005; }
  for (let k = 0; k < 20; k++) { const w = J.toWorld(t + 0.0005, s); if (!K.room(w[0], w[2], 0)) break; t += 0.0005; }
  const tw = t - 0.006;
  const w0 = J.toWorld(tw, s), w1 = J.toWorld(tw - 1, s), w2 = J.toWorld(tw, s + 1);
  const n = new THREE.Vector3(w1[0] - w0[0], 0, w1[2] - w0[2]).normalize();      // out of the wall, into the room
  const lat = new THREE.Vector3(w2[0] - w0[0], 0, w2[2] - w0[2]).normalize();    // along it (+s)
  const W = new THREE.Vector3(w0[0], floor + RVB.hookY, w0[2]);
  const hook = { W, n, lat, floor };
  // The hook: a rosette on the wall, the shank out of it, curling up to a ball tip.
  const BRASS = [0.600, 0.480, 0.240];
  const g = new THREE.Group();
  const mat = solidMaterial(new THREE.Color(...BRASS), { spec: 0.75, specPower: 70, vcol: false });
  const ros = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.008, 20), mat);
  ros.position.copy(W).addScaledVector(n, 0.004);
  ros.quaternion.setFromUnitVectors(_rbUP, n);
  g.add(ros);
  const P = (o, u) => W.clone().addScaledVector(n, o).add(new THREE.Vector3(0, u, 0));
  const curve = new THREE.CatmullRomCurve3([P(0.006, 0), P(0.030, -0.002), P(RVB.hookOut, 0.004), P(RVB.hookOut + 0.010, 0.020), P(RVB.hookOut + 0.008, 0.036)]);
  const shank = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0055, 10, false), mat);
  g.add(shank);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 10), mat);
  tip.position.copy(P(RVB.hookOut + 0.008, 0.036));
  g.add(tip);
  g.traverse((o) => { o.frustumCulled = false; });
  scene.add(g);
  hook.mesh = g;
  // Where the rope goes over it: round the shank 30 mm out (its section, 5.5 mm).
  hook.bar = P(0.032, -0.0015);
  hook.barR = 0.0055;
  // Where you stand: off the wall, facing it.
  hook.stand = W.clone().addScaledVector(n, RVB.standOff); hook.stand.y = floor;
  hook.yaw = Math.atan2(n.x, n.z);    // walker yaw facing −n (into the wall)
  // The rope's coil, at the shelf's east end, on the plank.
  const sh = kit.lights && kit.lights.shelf;
  let home = null;
  if (sh) {
    const c = J.toWorld(sh.t1 - 0.13, (sh.s0 + sh.s1) * 0.5 - 0.01);
    home = new THREE.Vector3(c[0], sh.y + 0.001, c[2]);
  }
  rvb.kab = { hook, home, floor };
  rvbCoilMake(home);
  rvbTrace({ pick: 'bind:kab', why: 'hook ' + W.toArray().map((x) => +x.toFixed(2)).join(',') });
  return rvb.kab;
}

// ── a tube, and a strap, along a path ────────────────────────────────────────

/** A dynamic tube mesh of up to `max` path points, `sides` round. */
function rvbTubeMake(max, sides, col, darkK, mat) {
  const nv = max * sides;
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), vc = new Float32Array(nv * 3);
  const idx = [];
  for (let i = 0; i < max - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k, b = i * sides + (k + 1) % sides, c = a + sides, d = b + sides;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aVCol', new THREE.BufferAttribute(vc, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, mat || rvbMat());
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, geo, pos, nrm, vc, max, sides, col, darkK, n: 0 };
}

/**
 * Lay tube `T` along path `pts` (Vector3s), radius `r`: parallel-transported
 * rings, and the rope's lay as a darker twist down it.
 */
function rvbTubeSet(T, pts, r) {
  const n = Math.min(pts.length, T.max);
  T.n = n;
  if (n < 2) { T.geo.setDrawRange(0, 0); T.mesh.visible = false; return; }
  const S = T.sides, P = T.pos, N = T.nrm, C = T.vc;
  const t = new THREE.Vector3(), nn = new THREE.Vector3(), bb = new THREE.Vector3(), tp = new THREE.Vector3();
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    tp.copy(t);
    t.subVectors(b, a);
    if (t.lengthSq() < 1e-12) t.copy(tp.lengthSq() > 0 ? tp : _rbUP); else t.normalize();
    if (i === 0) {
      nn.set(0, 1, 0); if (Math.abs(t.y) > 0.9) nn.set(1, 0, 0);
      nn.addScaledVector(t, -nn.dot(t)).normalize();
    } else {
      nn.addScaledVector(t, -nn.dot(t));
      if (nn.lengthSq() < 1e-8) { nn.set(0, 1, 0).addScaledVector(t, -t.y); }
      nn.normalize();
      len += pts[i].distanceTo(pts[i - 1]);
    }
    bb.crossVectors(t, nn);
    for (let k = 0; k < S; k++) {
      const th = k / S * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const o = (i * S + k) * 3;
      const ox = nn.x * c + bb.x * s, oy = nn.y * c + bb.y * s, oz = nn.z * c + bb.z * s;
      P[o] = pts[i].x + ox * r; P[o + 1] = pts[i].y + oy * r; P[o + 2] = pts[i].z + oz * r;
      N[o] = ox; N[o + 1] = oy; N[o + 2] = oz;
      // The lay: three strands, a darker groove between them, twisting.
      const lay = 0.5 + 0.5 * Math.cos(th * 3 - len / 0.0045 * Math.PI);
      const d = 1 - (1 - T.darkK) * lay;
      C[o] = T.col[0] * d; C[o + 1] = T.col[1] * d; C[o + 2] = T.col[2] * d;
    }
  }
  T.geo.attributes.position.needsUpdate = true;
  T.geo.attributes.normal.needsUpdate = true;
  T.geo.attributes.aVCol.needsUpdate = true;
  T.geo.setDrawRange(0, (n - 1) * S * 6);
  T.geo.boundingSphere = null;
  T.mesh.visible = true;
}

/**
 * Lay strap `T` (a tube of 4 sides, drawn flat) along `pts`, width `w`,
 * thickness `th`: its width along `W[i]` where given (the coils: along your
 * forearms), carried on where not.
 */
function rvbStrapSet(T, pts, W, w, th) {
  const n = Math.min(pts.length, T.max);
  T.n = n;
  if (n < 2) { T.geo.setDrawRange(0, 0); T.mesh.visible = false; return; }
  const P = T.pos, N = T.nrm, C = T.vc;
  const t = new THREE.Vector3(), ww = new THREE.Vector3(), nn = new THREE.Vector3(), tp = new THREE.Vector3();
  const hw = w * 0.5, ht = th * 0.5;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    tp.copy(t);
    t.subVectors(b, a);
    if (t.lengthSq() < 1e-12) t.copy(tp.lengthSq() > 0 ? tp : _rbUP); else t.normalize();
    if (W && W[i]) ww.copy(W[i]);
    else if (i === 0) { ww.set(0, 1, 0); }
    ww.addScaledVector(t, -ww.dot(t));
    if (ww.lengthSq() < 1e-8) ww.set(1, 0, 0).addScaledVector(t, -t.x);
    ww.normalize();
    nn.crossVectors(t, ww);
    // Four corners: (±w, ±t), normals out of the flat faces mostly.
    const cs = [[hw, ht], [-hw, ht], [-hw, -ht], [hw, -ht]];
    for (let k = 0; k < 4; k++) {
      const o = (i * 4 + k) * 3, cw = cs[k][0], ct = cs[k][1];
      P[o] = pts[i].x + ww.x * cw + nn.x * ct; P[o + 1] = pts[i].y + ww.y * cw + nn.y * ct; P[o + 2] = pts[i].z + ww.z * cw + nn.z * ct;
      const sg = ct > 0 ? 1 : -1;
      N[o] = nn.x * sg + ww.x * 0.25 * Math.sign(cw); N[o + 1] = nn.y * sg + ww.y * 0.25 * Math.sign(cw); N[o + 2] = nn.z * sg + ww.z * 0.25 * Math.sign(cw);
      const c = BELT.leather;
      C[o] = c[0]; C[o + 1] = c[1]; C[o + 2] = c[2];
    }
  }
  T.geo.attributes.position.needsUpdate = true;
  T.geo.attributes.normal.needsUpdate = true;
  T.geo.attributes.aVCol.needsUpdate = true;
  T.geo.setDrawRange(0, (n - 1) * 4 * 6);
  T.geo.boundingSphere = null;
  T.mesh.visible = true;
}

/** The coil of rope (a mesh of its own): five turns, lying flat or hanging in her hand. */
function rvbCoilMake(home) {
  if (rvb.coil) return rvb.coil;
  const pts = [];
  for (let i = 0; i <= 5 * 36; i++) {
    const a = i / 36 * Math.PI * 2, r = 0.072 + 0.004 * Math.sin(i * 0.7);
    pts.push(new THREE.Vector3(Math.cos(a) * r, (i / 36) * 0.0062 + 0.004, Math.sin(a) * r));
  }
  // The two ends tucked across it.
  pts.push(new THREE.Vector3(0.03, 0.04, 0.05), new THREE.Vector3(-0.04, 0.02, 0.08));
  const T = rvbTubeMake(pts.length + 2, 6, RVB.ropeCol, RVB.ropeDark);
  rvbTubeSet(T, pts, RVB.ropeR);
  T.mesh.matrixAutoUpdate = false;
  rvb.coil = { T, home: home ? home.clone() : null, at: home ? home.clone() : null, flat: true, inHand: false, onShelf: !!home };
  rvbCoilPlace();
  return rvb.coil;
}
/** The coil where it is: lying flat at `at`, or hanging from her right palm. */
function rvbCoilPlace() {
  const C = rvb.coil;
  if (!C) return;
  const m = C.T.mesh;
  if (C.hidden || (!C.inHand && !C.at)) { m.visible = false; return; }
  m.visible = true;
  if (C.inHand && typeof rvmPalm === 'function') {
    const pm = rvmPalm('R', new THREE.Vector3());
    if (!pm) { m.visible = false; return; }
    // Hanging from her fist, its plane upright and square to her.
    const { r } = rvmAxes(rev.ch.yaw);
    const q = new THREE.Quaternion().setFromUnitVectors(_rbUP, r);
    const c = pm.clone().add(new THREE.Vector3(0, -0.068, 0));
    m.matrix.compose(c, q, new THREE.Vector3(1, 1, 1));
  } else {
    m.matrix.compose(C.at, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
  }
  m.matrixWorldNeedsUpdate = true;
}

// ── where everybody is ───────────────────────────────────────────────────────

/** Your body's axes, world: pelvis, its up, your right, your front. */
function rvbBodyAx() {
  const Pv = revBone('pelvis', new THREE.Vector3()), Nk = revBone('neck', new THREE.Vector3());
  const SL = revBone('armUL', new THREE.Vector3()), SR = revBone('armUR', new THREE.Vector3());
  const S1 = revBone('spine01', new THREE.Vector3());
  if (!Pv || !Nk || !SL || !SR) return null;
  const up = Nk.clone().sub(Pv).normalize();
  // Your front off your pelvis's own frame (the figure faces +x), and your
  // right from it — not from the shoulders' names (MEASURED: the views built
  // off SR − SL looked at your back when they meant your face).
  const P = typeof rvmYourPelvis === 'function' ? rvmYourPelvis() : null;
  const fw = P ? P.fw.clone() : new THREE.Vector3(1, 0, 0);
  fw.addScaledVector(up, -fw.dot(up)).normalize();
  const rt = new THREE.Vector3().crossVectors(up, fw).normalize();
  return { Pv, Nk, SL, SR, S1, up, rt, fw };
}
/** Which side of you hand `s` is: +1 your right (`B.rt`), −1 your left — off its own shoulder. */
function rvbSide(B, s) {
  const Sh = s === 'R' ? B.SR : B.SL;
  return Sh.clone().sub(B.Nk).dot(B.rt) >= 0 ? 1 : -1;
}

/** The cot's end rail at your head: its middle (world), the way out of the cot there, across, and up. */
function rvbRail() {
  const Mt = typeof rvsMattress === 'function' ? rvsMattress() : null;
  const Pv = revBone('pelvis', new THREE.Vector3()), Hd = revBone('head', new THREE.Vector3());
  if (!Mt || !Pv || !Hd) return null;
  const sg = Math.sign((Hd.x - Pv.x) * Mt.ax.x + (Hd.z - Pv.z) * Mt.ax.z) || 1;
  const H = Mt.ax.clone().multiplyScalar(sg);
  const end = Mt.mid.clone().addScaledVector(H, 0.95);    // the frame's end (`cs1`), at the mattress top's height
  const mid = Mt.mid.clone().addScaledVector(H, (RVB.railIn + RVB.railOut) * 0.5);
  mid.y = Mt.top + (RVB.railTop + RVB.railBot) * 0.5;
  return { Mt, H, across: Mt.out.clone(), end, mid, top: Mt.top + RVB.railTop, bot: Mt.top + RVB.railBot,
    hd: (RVB.railOut - RVB.railIn) * 0.5, hh: (RVB.railTop - RVB.railBot) * 0.5 };
}

// ── your skin, only the part that matters (fast) ─────────────────────────────

/**
 * Your drawn skin, only regions `regs` (`RVS_REG`'s numbers), skinned on the
 * CPU off the palette that draws you — `rvsSkin`'s sums on a cached list of
 * vertices, not all 30-odd thousand. The rope wants your arms and hands, the
 * band your head: a twentieth of the work (MEASURED: the whole skin twice
 * every quarter second ran the game at a fifth of its speed).
 */
const _rvbSub = new Map();
function rvbSkinSub(regs) {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const mesh = typeof appr !== 'undefined' && appr && appr.mesh && appr.mesh.visible ? appr.mesh : f.mesh;
  const C = typeof rvsSkinPrep === 'function' ? rvsSkinPrep(mesh, f) : null;
  if (!C) return null;
  const key = mesh.uuid + ':' + Object.keys(regs).join(',');
  let L = _rvbSub.get(key);
  if (!L) { const a = []; for (let j = 0; j < C.n; j++) if (regs[C.reg[j]]) a.push(j); L = Int32Array.from(a); _rvbSub.set(key, L); }
  const Pal = f.pose().palette;
  mesh.updateMatrixWorld();
  const M = mesh.matrixWorld.elements;
  const m = L.length, p = new Float32Array(3 * m), nr = new Float32Array(3 * m), reg = new Uint8Array(m);
  for (let o = 0; o < m; o++) {
    const j = L[o];
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
/** A 2 cm hash of a skin, for nearest-vertex questions (`rvbNear`). */
function rvbHash(S) {
  const cells = new Map(), Cs = 0.02;
  for (let i = 0; i < S.n; i++) {
    const k = Math.floor(S.p[3 * i] / Cs) + ',' + Math.floor(S.p[3 * i + 1] / Cs) + ',' + Math.floor(S.p[3 * i + 2] / Cs);
    let L = cells.get(k); if (!L) { L = []; cells.set(k, L); } L.push(i);
  }
  S.cells = cells; S.Cs = Cs;
  return S;
}
/** The vertex of hashed skin `S` nearest `P` within 6 cm: `{ p, n, d }`, or null. */
function rvbNear(S, P) {
  const Cs = S.Cs, cx = Math.floor(P.x / Cs), cy = Math.floor(P.y / Cs), cz = Math.floor(P.z / Cs);
  let bd = 1e9, bi = -1;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) {
    const L = S.cells.get((cx + a) + ',' + (cy + b) + ',' + (cz + c));
    if (!L) continue;
    for (const i of L) {
      const dx = S.p[3 * i] - P.x, dy = S.p[3 * i + 1] - P.y, dz = S.p[3 * i + 2] - P.z, dd = dx * dx + dy * dy + dz * dz;
      if (dd < bd) { bd = dd; bi = i; }
    }
  }
  if (bi < 0) return null;
  return { p: new THREE.Vector3(S.p[3 * bi], S.p[3 * bi + 1], S.p[3 * bi + 2]), n: new THREE.Vector3(S.nr[3 * bi], S.nr[3 * bi + 1], S.nr[3 * bi + 2]), d: Math.sqrt(bd) };
}

// ── asking, her own pick ─────────────────────────────────────────────────────

/** Can she: on, not after the safeword, nothing else of hers in the way. */
function rvbFree(asked) {
  if (!rev.on || rev.care) return 'off';
  if (typeof rvp !== 'undefined' && rvp.M) return 'pinning you';
  if (typeof rvd !== 'undefined' && rvd.M) return 'dragging you';
  if (typeof rvkCollarOn === 'function' && rvkCollarOn()) return 'collar on';
  if (typeof rvkBusy === 'function' && rvkBusy()) return 'busy';
  if (!asked && ((typeof rvm !== 'undefined' && rvm.move) || rev.arm.mode === 'spank')) return 'busy';
  if (typeof rvm !== 'undefined' && rvm.move && rvm.move.id === 'care') return 'aftercare';
  return true;
}

/** Which tie your body is in for now: 'cot' (face down or up), 'back' (standing, kneeling), 'hook' (standing). */
function rvbKinds(v) {
  if (!v) return [];
  if (v.onBed && (v.phase === 'flatheld' || v.phase === 'cradle')) return ['cot'];
  if (v.ctx === 'stand') return ['hook', 'back'];
  if (v.ctx === 'kneel') return ['back'];
  return [];
}

/** Her own pick (from `revDecide`): stern or excited, and you where a tie goes. */
function rvbCands(ctx, D) {
  if (rvb.M || rvb.after || rvbFree(false) !== true) return [];
  if (rev.clock - rvb.last < RVB.cool) return [];
  if (D.last.slice(-6).some((x) => /^bind/.test(x))) return [];
  const m = rvbMood();
  const want = Math.max(0, m.s - 0.42) * 1.6 + Math.max(0, m.e - 0.35) * 1.0;
  if (want < 0.05) return [];
  const ks = rvbKinds(revView());
  if (!ks.length) return [];
  return [{ id: 'bind', s: 0.2 + 0.8 * want }];
}
/** Her pick, from `revDecide`. */
function rvbChoose(id, why) {
  const m = rvbMood();
  const v = revView();
  const ks = rvbKinds(v);
  let kind = ks[0];
  if (ks.includes('hook') && ks.includes('back')) kind = Math.random() < 0.45 + 0.4 * m.s ? 'hook' : 'back';
  return rvbStart(kind, { why, blind: Math.random() < m.blindP, how: Math.random() < m.beltP ? 'belt' : 'rope' });
}

/**
 * Asked (a beg, `rmoodBeg`): 'bind' (with what you said of it: 'cot' 'back'
 * 'hook' 'belt' 'rope' 'blind'), 'blind', or 'untie'. Answers { ok, label }.
 */
function rvbAsk(what, opts = []) {
  if (!rev.on) return { ok: false, label: 'roles are not reversed' };
  if (rev.care) return { ok: false, label: 'aftercare' };
  const M = rvb.M;
  const has = (k) => opts.includes(k);
  if (what === 'untie') {
    if (!M) return { ok: false, label: 'Chloe: nothing to untie' };
    return rvbUntieAsk();
  }
  if (what === 'blind') {
    if (M && M.blind) return { ok: true, label: 'Chloe: you are already blindfolded' };
    if (M) { M.blindWant = true; M.extra = (M.extra || 0) + 6; return { ok: true, label: 'Chloe: a blindfold, too' }; }
    const r = rvbStart(null, { why: 'asked', blind: true });
    return r === true ? { ok: true, label: 'Chloe: a blindfold over your eyes' } : { ok: false, label: 'blindfold: ' + r };
  }
  // A tie.
  if (M && M.kind) {
    M.extra = (M.extra || 0) + 8;
    if (has('blind') && !M.blind) M.blindWant = true;
    M.checkWant = true;
    return { ok: true, label: 'Chloe: already tied — and a little longer for asking' };
  }
  if (M && !M.kind) {
    // The blindfold alone on: it comes off first, then your wrists.
    M.holdFor = Math.min(M.holdFor, M.tHold + 2);
    rvb.after = { until: rev.clock + 30, asked: true, opts: opts.concat(['blind']) };
    return { ok: true, label: 'Chloe: your wrists next' };
  }
  // Out of the way first: her belt round, the collar, the pin, the spoon.
  if (typeof rvkBeltOut === 'function' && rvkBeltOut() && !(typeof rvkBeltInHand === 'function' && rvkBeltInHand())) {
    rvb.after = { until: rev.clock + 24, asked: true, opts };
    return { ok: true, label: 'Chloe: her belt first' };
  }
  if (typeof rvkCollarOn === 'function' && rvkCollarOn()) {
    rvkCollarEnd('begged');
    rvb.after = { until: rev.clock + 24, asked: true, opts };
    return { ok: true, label: 'Chloe: the collar off, then your wrists' };
  }
  if (typeof rvm !== 'undefined' && rvm.move && rvm.move.id === 'spoon') {
    rvmEnd('asked to be tied');
    rvb.after = { until: rev.clock + 30, asked: true, opts };
    return { ok: true, label: 'Chloe: up first, then your wrists' };
  }
  const v = revView();
  const ks = rvbKinds(v);
  let want = opts.find((k) => /^(cot|back|hook)$/.test(k)) || null;
  if (want && !ks.includes(want)) {
    // Where it needs you, first: on the cot, or on your feet.
    rvb.after = { until: rev.clock + 26, asked: true, opts };
    if (want === 'cot') { if (v && v.onBed) revAsk('flat'); else if (!rev.dom.order) revOrder('cot', 'bind'); return { ok: true, label: 'Chloe: on the cot first (2)' }; }
    if (!rev.dom.order) revOrder('stand', 'bind');
    return { ok: true, label: 'Chloe: on your feet first (1)' };
  }
  if (!ks.length) {
    rvb.after = { until: rev.clock + 26, asked: true, opts };
    if (v && v.onBed) { revAsk('flat'); return { ok: true, label: 'Chloe: on your tummy first (3)' }; }
    if (!rev.dom.order) revOrder('stand', 'bind');
    return { ok: true, label: 'Chloe: on your feet first (1)' };
  }
  const kind = want || (ks.length > 1 ? (Math.random() < 0.5 + 0.3 * rvbMood().s ? 'hook' : 'back') : ks[0]);
  const r = rvbStart(kind, { why: 'asked', blind: has('blind'), how: has('belt') ? 'belt' : has('rope') ? 'rope' : (Math.random() < rvbMood().beltP ? 'belt' : 'rope') });
  return r === true ? { ok: true, label: 'Chloe: ' + (kind === 'cot' ? 'your wrists to the cot' : kind === 'hook' ? 'to the hook on the wall' : 'your wrists behind your back') }
    : { ok: false, label: 'tie: ' + r };
}

/** "Untie me": warm, soon; stern, longer for asking; excited, a tease and maybe. Not the safeword — that is always "red". */
function rvbUntieAsk() {
  const M = rvb.M, m = rvbMood();
  if (!M) return { ok: false, label: 'nothing' };
  if (M.ph !== 'hold') {
    if (/^(untie|free|blindoff|stow|done)$/.test(M.ph)) return { ok: true, label: 'Chloe: already untying you' };
    M.untieAsked = true;
    return { ok: true, label: 'Chloe: once it is done' };
  }
  M.asks = (M.asks || 0) + 1;
  if (m.g > 0.42 || (m.s < 0.4 && Math.random() < 0.4 + 0.5 * m.g)) {
    M.holdFor = Math.min(M.holdFor, M.tHold + 1.5);
    rvbSay('bind_good', true);
    return { ok: true, label: 'Chloe: okay — untying you' };
  }
  if (m.s >= 0.45) { M.extra = (M.extra || 0) + 8 + 6 * m.s; rvbSay('bind_no', true); return { ok: true, label: 'Chloe: no — and longer for asking' }; }
  // Excited: a tease, and then — half the time — yes.
  rvbSay('bind_no', true);
  if (Math.random() < 0.5) M.holdFor = Math.min(M.holdFor, M.tHold + 5);
  return { ok: true, label: 'Chloe: hmm... maybe' };
}

/** After an order or a put-away: start once you are where the tie needs you. */
function rvbAfterTick() {
  const A = rvb.after;
  if (!A) return;
  if (rev.clock > A.until || rev.care) { rvb.after = null; return; }
  if (rvb.M) return;
  if (rev.arm.mode === 'spank' || (typeof rvkBusy === 'function' && rvkBusy()) || rev.dom.order) return;
  if (typeof rvm !== 'undefined' && rvm.move) return;
  const v = revView();
  const ks = rvbKinds(v);
  const want = (A.opts || []).find((k) => /^(cot|back|hook)$/.test(k)) || null;
  if (!ks.length || (want && !ks.includes(want))) { A.kind = null; return; }
  const k = want || ks[0];
  if (A.kind !== k) { A.kind = k; A.since = rev.clock; return; }
  if (rev.clock - A.since < 0.8) return;
  rvb.after = null;
  const o = A.opts || [];
  rvbStart(k, { why: A.asked ? 'asked (after)' : 'mood (after)', blind: o.includes('blind'), how: o.includes('belt') ? 'belt' : 'rope' });
}

// ── start ────────────────────────────────────────────────────────────────────

/**
 * Start: `kind` 'cot' | 'back' | 'hook', or null for the blindfold alone.
 * `o` { why, blind, how }. Answers true or why not.
 */
function rvbStart(kind, o = {}) {
  const why = o.why || 'mood';
  const asked = /^asked|^probe/.test(why);
  if (rvb.M) return 'already';
  const fr = rvbFree(asked);
  if (fr !== true) return fr;
  const v = revView();
  if (!v || !v.ctx) return 'between poses';
  if (kind && !rvbKinds(v).includes(kind)) return 'not where a ' + kind + ' tie goes (' + v.ctx + ')';
  if (!rvbKab()) return 'no kabina';
  if (typeof rvm !== 'undefined' && rvm.move) {
    if (!asked) return 'busy';
    rvmEnd('asked to be tied');
    if (rvm.move) return 'busy';
  }
  if (rev.arm.mode === 'spank') { if (!asked) return 'busy'; rev.arm.mode = null; rev.arm.ph = 'rise'; }
  let how = kind ? (o.how || 'rope') : null;
  // Her belt: on her (she takes it off) or in her hand already (she uses it).
  if (how === 'belt' && typeof rvk !== 'undefined') {
    const B = rvk.belt;
    if (B.ph !== 'off' && !(typeof rvkBeltInHand === 'function' && rvkBeltInHand() && !B.n)) how = 'rope';
  }
  const m = rvbMood();
  rev.dom.order = null;
  const M = { kind, how, blind: false, blindWant: !!o.blind, ph: kind ? 'fetch' : 'blindon', t: 0, t0: 0, why, asked, mood0: m,
    holdFor: kind ? m.hold : rvbCl(m.hold * 0.6, 10, 34), extra: 0, tight: m.tight, tieU: 0, armK: 0, bandK: 0, tHold: 0,
    nextAct: 2 + Math.random() * 1.5, checksDone: 0, roundsDone: 0, spanks: 0, squirms: 0, sqT: -1, sqDir: 1, aways: 0,
    whispers: 0, remotes: 0, toys: 0, praises: 0, strokes: 0, lines: 0, acts: [], timing: { start: +rev.clock.toFixed(2) },
    log: [], meas: { rope: [], ropeIn: 0, held: [], band: { min: 9, inN: 0 }, gap: { min: 9 }, wall: 0, wallD: 0, cot: 0, hookD: 9,
      arm: { min: 9, inN: 0 } },
    measAt: 0, clk: 0, sub: null, fb: { L: new THREE.Vector3(), R: new THREE.Vector3() } };
  rvb.M = M;
  rvb.last = rev.clock; rvb.n++;
  rvb.after = null;
  rvbPhase(M, M.ph);
  rvbTrace({ pick: 'bind:' + (kind || 'blind') + (how ? ':' + how : ''), why, tone: m.tone, hold: +M.holdFor.toFixed(1), blind: M.blindWant });
  return true;
}

/** Into phase `ph`: its clock reset, and what it starts with. */
function rvbPhase(M, ph) {
  M.ph = ph; M.t0 = M.t; M.pt = 0;
  M.timing[ph] = +rev.clock.toFixed(2);
  if (/^(fetch|go|lead|arms|tie|tug|blindon|untie|free|blindoff|stow|check|whisper|away)$/.test(ph)) rvbClaim(M);
}

/** Her body is the tie's this phase: `rvm.move` is a move of id 'bind' (her moves file leaves it to us). */
function rvbClaim(M) {
  if (typeof rvm === 'undefined') return;
  if (rvm.move && rvm.move.id === 'bind' && rvm.move.B === M) return;
  if (rvm.move) return;
  rvm.move = { id: 'bind', t: 0, ph: 'go', B: M, ctx: null, dur: 9999, why: 'bind' };
  M.sub = rvm.move;
}
/** And back: her moves file's again (she stands, unless something wants her down). */
function rvbRelease(M) {
  if (typeof rvm !== 'undefined' && rvm.move && rvm.move.id === 'bind') rvmEnd('bind ' + M.ph);
  M.sub = null;
}

// ── your arms in the tie ─────────────────────────────────────────────────────

/**
 * Where your WRISTS go in the tie (world, L and R), and your elbows' way:
 * over the end rail beyond your head (the cot), up under the hook (the hook),
 * or together at the small of your back. Stern, further stretched.
 */
function rvbWristGoal(M) {
  const B = rvbBodyAx();
  if (!B) return null;
  const st = RVB.stretch * (M.tight || 0);
  const gap = RVB.wristGap * 0.5;
  if (M.kind === 'cot') {
    const R = rvbRail();
    if (!R) return null;
    const C = R.end.clone().addScaledVector(R.H, RVB.cotOut + st);
    C.y = R.top + RVB.cotUp - st * 0.5;
    const lat = R.across.clone();
    // Your right on your right: face down your right is the cot's −across or +across as you lie.
    if (lat.dot(B.rt) < 0) lat.negate();
    const face = B.fw.y < 0 ? 'down' : 'up';
    const out = {};
    for (const s of ['L', 'R']) {
      const sg = rvbSide(B, s);
      out[s] = { W: C.clone().addScaledVector(lat, sg * gap),
        pole: lat.clone().multiplyScalar(sg * 0.7).add(new THREE.Vector3(0, face === 'down' ? 0.65 : 0.45, 0)).addScaledVector(R.H, -0.2) };
    }
    out.C = C; out.anchor = 'rail'; out.way = R.H.clone(); out.lat = lat;
    return out;
  }
  if (M.kind === 'hook') {
    const K = rvbKab();
    if (!K) return null;
    const h = K.hook;
    const C = h.bar.clone().addScaledVector(h.n, RVB.wristOut - 0.032).add(new THREE.Vector3(0, -RVB.wristBelow + st, 0));
    const lat = h.lat.clone();
    if (lat.dot(B.rt) < 0) lat.negate();
    const out = {};
    for (const s of ['L', 'R']) {
      const sg = rvbSide(B, s);
      out[s] = { W: C.clone().addScaledVector(lat, sg * gap),
        pole: lat.clone().multiplyScalar(sg * 0.85).addScaledVector(h.n, 0.35).add(new THREE.Vector3(0, -0.15, 0)) };
    }
    out.C = C; out.anchor = 'hook'; out.way = new THREE.Vector3(0, 1, 0); out.lat = lat;
    return out;
  }
  // Behind your back: at the small of it, your wrists' middle a forearm's
  // half-thickness behind your skin there (measured once off your back).
  const Pv = B.Pv;
  if (M.backSkin == null) {
    const T = rvbSkinSub({ 0: 1 });
    let best = 0.10;
    if (T) {
      best = 0;
      const at = Pv.clone().addScaledVector(B.up, RVB.backDown);
      for (let i = 0; i < T.n; i++) {
        const dx = T.p[3 * i] - at.x, dy = T.p[3 * i + 1] - at.y, dz = T.p[3 * i + 2] - at.z;
        if (Math.abs(dx * B.up.x + dy * B.up.y + dz * B.up.z) > 0.03 || Math.abs(dx * B.rt.x + dy * B.rt.y + dz * B.rt.z) > 0.05) continue;
        best = Math.max(best, -(dx * B.fw.x + dy * B.fw.y + dz * B.fw.z));
      }
      if (best < 0.04) best = 0.10;
    }
    M.backSkin = best;
  }
  const C = Pv.clone().addScaledVector(B.up, RVB.backDown).addScaledVector(B.fw, -(M.backSkin + RVB.backOff));
  const out = {};
  for (const s of ['L', 'R']) {
    const sg = rvbSide(B, s);
    out[s] = { W: C.clone().addScaledVector(B.rt, sg * gap),
      pole: B.rt.clone().multiplyScalar(sg * 0.8).addScaledVector(B.fw, -0.55).addScaledVector(B.up, -0.1) };
  }
  out.C = C; out.anchor = null; out.way = B.fw.clone().negate(); out.lat = B.rt.clone();
  return out;
}

/**
 * No further than your arms reach: the wrists' middle drawn back toward your
 * shoulders until each wrist is within 96 % of its arm (MEASURED: face up the
 * cot's end was 17 cm out of reach). The rope makes up the rest — the tether
 * to the rail is longer, and it is drawn to where your wrists are.
 */
function rvbReachClamp(G) {
  const A = typeof rvhBayeArms === 'function' ? rvhBayeArms() : null;
  if (!A) return;
  const SL = rvhBayeShoulder('L', new THREE.Vector3()), SR = rvhBayeShoulder('R', new THREE.Vector3());
  if (!SL || !SR) return;
  const mid = SL.clone().lerp(SR, 0.5);
  for (let it = 0; it < 4; it++) {
    let over = 0;
    for (const [s, Sh] of [['L', SL], ['R', SR]]) {
      const L = (A[s].l1 + A[s].l2) * 0.96;
      over = Math.max(over, G[s].W.distanceTo(Sh) - L);
    }
    if (over <= 0.001) break;
    const d = mid.clone().sub(G.C).normalize().multiplyScalar(over + 0.002);
    for (const k of ['L', 'R']) G[k].W.add(d);
    G.C.add(d);
    G.clamped = (G.clamped || 0) + over;
  }
  // On the cot, short of its end: up over the pillow, not into it.
  if (G.anchor === 'rail') {
    const R = rvbRail();
    if (R) {
      const al = G.C.clone().sub(R.Mt.mid).dot(R.H);
      if (al < 0.80) {
        const lift = Math.max(0, R.Mt.top + 0.125 - G.C.y);
        for (const k of ['L', 'R']) G[k].W.y += lift;
        G.C.y += lift;
      }
    }
  }
}

/**
 * HER HEAD CLEAR OF YOU, while the tie has her body: her bow eased off
 * while her head is nearer your trunk, head or arms than a head's width
 * (MEASURED before this: behind you kneeling her head went 80 mm into your
 * back, at the hook 29 mm into your raised arm). Bones and capsules, every
 * frame — cheap.
 */
function rvbHeadGuard(M, dt) {
  if (typeof rvm === 'undefined' || (rvm.move && rvm.move.id !== 'bind') || rev.arm.mode === 'spank') return;
  const H = revChloeHead(new THREE.Vector3());
  if (!H) return;
  H.y += 0.08;
  const B = (n) => revBone(n, new THREE.Vector3());
  const segs = [['pelvis', 'spine03', 0.13], ['spine03', 'neck', 0.13], ['neck', 'head', 0.07], ['armUL', 'armLL', 0.055], ['armLL', 'handL', 0.045],
    ['armUR', 'armLR', 0.055], ['armLR', 'handR', 0.045]];
  let worst = 9;
  for (const [a, b, r] of segs) {
    const A = B(a), E = B(b);
    if (!A || !E) continue;
    const ab = E.clone().sub(A), t = rvbCl(H.clone().sub(A).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
    worst = Math.min(worst, H.distanceTo(A.addScaledVector(ab, t)) - r);
  }
  const Hd = rvmYourHead();
  if (Hd) worst = Math.min(worst, H.distanceTo(Hd.C) - 0.11);
  M.headClear = Math.min(M.headClear == null ? 9 : M.headClear, worst);
  // Her head is ~0.10 m round: under 0.12 m of clearance, up out of her bow.
  if (worst < 0.12) {
    rvm.body.bowTo = Math.max(0, Math.min(rvm.body.bowTo, rvm.body.bow) - 1.4 * dt);
    if (M.whBow != null) M.whBow = rvm.body.bowTo;
  }
}

/** The way there for a hand (so it does not go through you): out to your side first, then in. */
function rvbArmVia(M, s, from, to) {
  const B = rvbBodyAx();
  if (!B) return null;
  const sg = rvbSide(B, s), Sh = s === 'R' ? B.SR : B.SL;
  if (M.kind === 'cot') {
    // Out beside your head, the pin's place for it (1.586.0), and then up over it.
    const R = rvbRail();
    const H = R ? R.H : B.up;
    const lat = (R ? R.across.clone() : B.rt.clone()); if (lat.dot(B.rt) < 0) lat.negate();
    const P = Sh.clone().addScaledVector(H, 0.20).addScaledVector(lat, sg * 0.20);
    P.y = Math.max(P.y, (R ? R.Mt.top : P.y) + 0.07);
    return P;
  }
  if (M.kind === 'hook') return Sh.clone().addScaledVector(B.fw, 0.30).addScaledVector(B.up, 0.12).addScaledVector(B.rt, sg * 0.05);
  return Sh.clone().addScaledVector(B.up, -0.42).addScaledVector(B.rt, sg * 0.10).addScaledVector(B.fw, -0.16);
}

/**
 * Your arms, a frame: to the tie by `M.armK` (0 your own arms, 1 tied) along
 * the way round, the struggle on top, and the miss of last frame taken off.
 */
function rvbArms(M, dt) {
  if (typeof rvhBayeArm !== 'function' || M.armK <= 0.001) { M.armsOn = false; return; }
  const G = rvbWristGoal(M);
  if (!G) return;
  rvbReachClamp(G);
  M.goal = G;
  const k = M.armK;
  // The struggle: your wrists pulled away from the tie (toward you), and back.
  const sq = M.sqUp || 0;
  for (const s of ['L', 'R']) {
    const Wg = G[s].W.clone();
    if (sq) {
      if (M.kind === 'back') Wg.addScaledVector(G.lat, (s === 'R' ? 1 : -1) * sq * 0.6);
      else Wg.addScaledVector(G.way, -sq);
    }
    // The tug of a check: toward the anchor.
    if (M.tugK) Wg.addScaledVector(G.way, M.tugK * 0.012);
    // Wrist → palm, as you are drawn now.
    const pm = rvhBayePalm(s, new THREE.Vector3()), wr = rvhBayeWrist(s, new THREE.Vector3());
    let T = Wg.add(pm.clone().sub(wr));
    // The way round while the arm is going there.
    if (M.ph === 'arms' && M.from && M.from[s] && M.armU < 1) {
      const via = rvbArmVia(M, s);
      const u = rvbSm(M.armU);
      if (via) {
        const a = M.from[s].clone().lerp(via, rvbSm(Math.min(1, u * 2)));
        T = u < 0.5 ? a : via.clone().lerp(T, rvbSm(u * 2 - 1));
      }
    }
    if (M.ph === 'free' && M.freeFrom && M.freeFrom[s]) {
      const via = rvbArmVia(M, s);
      const u = rvbSm(M.freeU || 0);
      if (via) T = u < 0.5 ? T.clone().lerp(via, u * 2) : via.clone();
    }
    // The miss (drawn palm against sent) taken off, slowly, once it is held.
    const fb = M.fb[s];
    if (k >= 0.99 && M.lastSent && M.lastSent[s]) {
      fb.lerp(pm.clone().sub(M.lastSent[s]), 0.35);
      if (fb.length() > 0.08) fb.setLength(0.08);
    } else fb.multiplyScalar(0.8);
    const send = T.clone().sub(fb);
    (M.lastSent = M.lastSent || {})[s] = send.clone();
    rvhBayeArm(s, send, G[s].pole, k);
    (M.want = M.want || {})[s] = T;
  }
  M.armsOn = true;
}

// ── the rope on you ──────────────────────────────────────────────────────────

/** Your wrists and forearms as drawn now: wrist, elbow, the way up the forearm. */
function rvbForearms() {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const o = {};
  for (const s of ['L', 'R']) {
    const W = revBone('hand' + s, new THREE.Vector3()), E = revBone('armL' + s, new THREE.Vector3());
    if (!W || !E) return null;
    o[s] = { W, E, d: E.clone().sub(W).normalize() };
  }
  return o;
}

/**
 * The bundle's frame now: the middle of the coils `C`, the axis they wind
 * about `a` (along your forearms), and `u`, `v` across it — `u` from your
 * left wrist to your right.
 */
function rvbBundle(M, up) {
  const F = rvbForearms();
  if (!F) return null;
  let a = F.L.d.clone().add(F.R.d);
  if (a.lengthSq() < 0.09) a = F.L.d.clone().sub(F.R.d);
  a.normalize();
  const QL = F.L.W.clone().addScaledVector(F.L.d, up), QR = F.R.W.clone().addScaledVector(F.R.d, up);
  const C = QL.clone().add(QR).multiplyScalar(0.5);
  const u = QR.clone().sub(QL); u.addScaledVector(a, -u.dot(a));
  if (u.lengthSq() < 1e-6) u.set(0, 1, 0).addScaledVector(a, -a.y);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(a, u).normalize();
  return { C, a, u, v, F };
}

/** 2D convex hull (monotone chain) of [[x, y], …]. */
function rvbHull2(P) {
  const p = P.slice().sort((A, B) => A[0] - B[0] || A[1] - B[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
/** A closed 2D polygon's radius from point `c` at angle `th` (the ray's last crossing). */
function rvbRayR(poly, c, th) {
  const dx = Math.cos(th), dy = Math.sin(th);
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const ex = B[0] - A[0], ey = B[1] - A[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const ax = A[0] - c[0], ay = A[1] - c[1];
    const t = (ax * ey - ay * ex) / den, s = (ax * dy - ay * dx) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.max(best, t);
  }
  return best;
}

/**
 * THE COILS' SHAPE, off your skin: for each turn, the convex hull of your
 * forearms' and hands' skin in that slice across the bundle, as radii from
 * its middle (`K` of them), in the bundle's own (u, v) — carried on your
 * forearms from there. Refreshed every few tenths of a second.
 */
function rvbHull(M, Bn, turns, pitch, rOff) {
  const S = rvbSkinSub({ 2: 1, 3: 1, 4: 1, 5: 1 });
  if (!S) return null;
  const K = 40, rows = [];
  for (let i = 0; i < turns; i++) {
    const off = (i - (turns - 1) / 2) * pitch;
    const pts = [];
    for (let j = 0; j < S.n; j++) {
      const r = S.reg[j];
      if (r < 2 || r > 5) continue;
      const dx = S.p[3 * j] - Bn.C.x, dy = S.p[3 * j + 1] - Bn.C.y, dz = S.p[3 * j + 2] - Bn.C.z;
      const al = dx * Bn.a.x + dy * Bn.a.y + dz * Bn.a.z;
      if (Math.abs(al - off) > pitch * 0.75 + 0.004) continue;
      const pu = dx * Bn.u.x + dy * Bn.u.y + dz * Bn.u.z, pv = dx * Bn.v.x + dy * Bn.v.y + dz * Bn.v.z;
      if (pu * pu + pv * pv > 0.09 * 0.09) continue;
      pts.push([pu, pv]);
    }
    if (pts.length < 6) return null;
    const H = rvbHull2(pts);
    let cx = 0, cy = 0;
    for (const q of H) { cx += q[0]; cy += q[1]; }
    cx /= H.length; cy /= H.length;
    const R = new Float32Array(K);
    for (let k = 0; k < K; k++) R[k] = rvbRayR(H, [cx, cy], k / K * Math.PI * 2) + rOff;
    rows.push({ off, c: [cx, cy], R });
  }
  return { rows, K, at: rev.clock };
}

/** A point on the hull row `w` at angle `th` (world), in bundle frame `Bn`. */
function rvbOnHull(Bn, row, K, th, along) {
  const x = ((th / (Math.PI * 2)) % 1 + 1) % 1 * K;
  const i0 = Math.floor(x) % K, i1 = (i0 + 1) % K, f = x - Math.floor(x);
  const r = row.R[i0] * (1 - f) + row.R[i1] * f;
  return Bn.C.clone().addScaledVector(Bn.u, row.c[0] + Math.cos(th) * r).addScaledVector(Bn.v, row.c[1] + Math.sin(th) * r)
    .addScaledVector(Bn.a, along);
}

/**
 * THE ROPE'S PATH this frame (world points; and for the belt the width's
 * way at each): the coils round your wrists, then — to an anchor — the
 * tether to it, round it, and back to the coils to a knot; behind your back,
 * a knot and the tail hanging. `M.ropeW` holds the belt's widths.
 */
function rvbRopePath(M) {
  const belt = M.how === 'belt';
  const turns = belt ? RVB.beltTurns : RVB.coilTurns, pitch = belt ? RVB.beltPitch : RVB.coilPitch;
  const up = belt ? RVB.beltUp : RVB.coilUp;
  const Bn = rvbBundle(M, up);
  if (!Bn) return null;
  const rOff = (belt ? BELT.thick * 0.5 : RVB.ropeR) + RVB.coilClear;
  // (The coils' shape is carried on your forearms; it is measured again
  // every 1.5 s, or as soon as the tie changes, not every frame.)
  if (!M.hull || rev.clock - M.hull.at > 1.5 || M.hull.turns !== turns) {
    const h = rvbHull(M, Bn, turns, pitch, rOff);
    if (h) { h.turns = turns; M.hull = h; }
  }
  const Hh = M.hull;
  if (!Hh) return null;
  const G = M.goal;
  const pts = [], W = [];
  // Where the anchor is from the bundle, across it: the coils end facing it.
  let A = null;
  const K = rvbKab();
  if (M.kind === 'cot') { const R = rvbRail(); if (R) A = R; }
  const anchorP = M.kind === 'hook' && K ? K.hook.bar.clone() : M.kind === 'cot' && A ? A.mid.clone().setY(A.top) : null;
  let th0 = 0;
  if (anchorP) {
    const d = anchorP.clone().sub(Bn.C);
    th0 = Math.atan2(d.dot(Bn.v), d.dot(Bn.u));
  } else {
    th0 = Math.atan2(-Bn.v.y, -Bn.u.y);    // the knot underneath
  }
  const per = 30, N = turns * per;
  const start = th0 - Math.PI * 2 * turns;
  for (let i = 0; i <= N; i++) {
    const tt = i / per;                    // turns done
    const th = start + tt * Math.PI * 2;
    const rw = Math.min(turns - 1, Math.floor(tt));
    const fr = tt - Math.floor(tt);
    // Along the axis, the turn's own slice, and the step to the next at the end of the turn.
    const row = Hh.rows[rw], row2 = Hh.rows[Math.min(turns - 1, rw + 1)];
    const along = row.off + (row2.off - row.off) * rvbSm((fr - 0.8) / 0.2);
    const R0 = { c: row.c, R: row.R };
    pts.push(rvbOnHull(Bn, R0, Hh.K, th, along));
    W.push(Bn.a.clone());
  }
  const last = pts[pts.length - 1].clone();
  if (M.kind === 'hook' && K) {
    // Up to the hook's shank, over it, and back down.
    const h = K.hook, b = h.bar, rr = h.barR + (belt ? BELT.thick * 0.5 : RVB.ropeR) + 0.0008;
    const lat = h.lat.clone();
    const sideA = b.clone().addScaledVector(lat, -rr * 1.4).add(new THREE.Vector3(0, -0.012, 0));
    for (let i = 1; i <= 8; i++) pts.push(last.clone().lerp(sideA, i / 8)), W.push(null);
    // Round the shank: in the plane across it (lat, up), a full turn.
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI + i / 24 * Math.PI * 2.05;
      pts.push(b.clone().addScaledVector(lat, Math.cos(a) * rr).add(new THREE.Vector3(0, Math.sin(a) * rr, 0)).addScaledVector(h.n, (i / 24 - 0.5) * 0.012));
      W.push(h.n.clone());
    }
    if (!belt) {
      const back = pts[0].clone().addScaledVector(Bn.a, -pitch * 0.5);
      const fromB = pts[pts.length - 1].clone();
      for (let i = 1; i <= 8; i++) pts.push(fromB.clone().lerp(back, i / 8)), W.push(null);
      rvbKnot(pts, W, Bn, back, 0.010);
    }
  } else if (M.kind === 'cot' && A) {
    // Down to the end rail, round it (its section: along the cot × up), and back up.
    const R = A, rr = (belt ? BELT.thick * 0.5 : RVB.ropeR) + 0.0012;
    const hd = R.hd + rr, hh = R.hh + rr;
    const c = R.mid.clone();
    const H = R.H, U = _rbUP;
    // The loop round the rail, about the across axis: a rounded rectangle.
    const loop = [];
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI / 2 + i / 32 * Math.PI * 2;      // from the top, out (+H) first
      const x = Math.cos(a), y = Math.sin(a);
      const k = Math.max(Math.abs(x) / hd, Math.abs(y) / hh) || 1;
      const sx = x / k, sy = y / k;
      // Rounded: halfway between the box and the ellipse.
      const ex = Math.cos(a) * hd, ey = Math.sin(a) * hh;
      loop.push(c.clone().addScaledVector(H, -(sx * 0.6 + ex * 0.4)).addScaledVector(U, sy * 0.6 + ey * 0.4)
        .addScaledVector(R.across, (i / 32 - 0.5) * 0.014));
    }
    const top = loop[0];
    // Over the mattress's end first when your wrists are short of it (face up
    // your arms do not reach past it, `rvbReachClamp`): not through the foam.
    const al = last.clone().sub(R.Mt.mid).dot(H);
    let from = last;
    if (al < 0.93) {
      const E = R.Mt.mid.clone().addScaledVector(H, 0.935).addScaledVector(R.across, last.clone().sub(R.Mt.mid).dot(R.across));
      E.y = R.Mt.top + rr + 0.004;
      for (let i = 1; i <= 8; i++) pts.push(last.clone().lerp(E, i / 8)), W.push(null);
      from = E;
    }
    for (let i = 1; i <= 8; i++) pts.push(from.clone().lerp(top, i / 8)), W.push(null);
    for (const p of loop) { pts.push(p); W.push(R.across.clone()); }
    if (!belt) {
      const back = pts[0].clone().addScaledVector(Bn.a, -pitch * 0.5);
      const fromB = pts[pts.length - 1].clone();
      for (let i = 1; i <= 8; i++) pts.push(fromB.clone().lerp(back, i / 8)), W.push(null);
      rvbKnot(pts, W, Bn, back, 0.010);
    }
  } else {
    // Behind your back: a knot, and the tail hanging under it.
    rvbKnot(pts, W, Bn, last, 0.011);
    const k0 = pts[pts.length - 1].clone();
    const tail = belt ? 0.30 : 0.20;
    for (let i = 1; i <= 10; i++) {
      const u = i / 10;
      pts.push(k0.clone().add(new THREE.Vector3(0, -tail * u, 0)).addScaledVector(Bn.v, 0.02 * Math.sin(u * 3)).addScaledVector(Bn.u, 0.01 * u));
      W.push(null);
    }
  }
  return { pts, W, Bn };
}
/** A knot: a small turn and a half round itself at `P`. */
function rvbKnot(pts, W, Bn, P, r) {
  for (let i = 0; i <= 14; i++) {
    const a = i / 14 * Math.PI * 3;
    pts.push(P.clone().addScaledVector(Bn.v, Math.cos(a) * r).addScaledVector(Bn.a, Math.sin(a) * r).addScaledVector(Bn.u, (i / 14 - 0.5) * 0.008));
    W.push(null);
  }
}

/** The first `u` (0..1) of a path by length. */
function rvbCut(P, u) {
  if (u >= 0.999) return P;
  let L = 0;
  const d = [0];
  for (let i = 1; i < P.pts.length; i++) { L += P.pts[i].distanceTo(P.pts[i - 1]); d.push(L); }
  const want = L * Math.max(0, u);
  const pts = [], W = [];
  for (let i = 0; i < P.pts.length; i++) {
    if (d[i] <= want) { pts.push(P.pts[i]); W.push(P.W[i]); continue; }
    const f = (want - d[i - 1]) / Math.max(1e-6, d[i] - d[i - 1]);
    pts.push(P.pts[i - 1].clone().lerp(P.pts[i], f)); W.push(P.W[i]);
    break;
  }
  return { pts, W, Bn: P.Bn };
}

/** Draw the tie this frame: the rope or the belt on you, `M.tieU` of it. */
function rvbDrawTie(M) {
  const on = M && M.kind && M.tieU > 0.002;
  if (!on) { if (rvb.rope) rvb.rope.mesh.visible = false; if (rvb.belt) rvb.belt.mesh.visible = false; if (rvb.buckle) rvb.buckle.visible = false; return null; }
  const P0 = rvbRopePath(M);
  if (!P0) return null;
  const P = rvbCut(P0, M.tieU);
  M.path = P0;
  if (M.how === 'belt') {
    if (!rvb.belt) rvb.belt = rvbTubeMake(400, 4, BELT.leather, 1, rvbMat(0.22, 34));
    rvbStrapSet(rvb.belt, P.pts, P.W, BELT.width, BELT.thick);
    if (rvb.rope) rvb.rope.mesh.visible = false;
    rvbBuckle(P.pts[0], P.pts[1], P.Bn.a);
  } else {
    if (!rvb.rope) rvb.rope = rvbTubeMake(420, RVB.ropeSides, RVB.ropeCol, RVB.ropeDark);
    rvbTubeSet(rvb.rope, P.pts, RVB.ropeR);
    if (rvb.belt) rvb.belt.mesh.visible = false;
    if (rvb.buckle) rvb.buckle.visible = false;
  }
  return P;
}
/** The belt's buckle where the strap starts on the coils. */
function rvbBuckle(P, Q, a) {
  if (!rvb.buckle) {
    const g = new THREE.Group();
    const bm = solidMaterial(new THREE.Color(...BELT.metal), { spec: 0.9, specPower: 90, vcol: false });
    const bw = BELT.width * 0.5 + 0.005, bl = 0.046, bar = 0.0035;
    const box = (sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), bm); b.position.set(x, y, z); g.add(b); };
    box(bar, bar, 2 * bw + bar, -bl / 2, 0, 0); box(bar, bar, 2 * bw + bar, bl / 2, 0, 0);
    box(bl, bar, bar, 0, 0, bw); box(bl, bar, bar, 0, 0, -bw);
    g.traverse((o) => { o.frustumCulled = false; });
    scene.add(g);
    rvb.buckle = g;
  }
  const g = rvb.buckle;
  const x = Q.clone().sub(P).normalize(), z = a.clone().addScaledVector(x, -a.dot(x)).normalize(), y = new THREE.Vector3().crossVectors(z, x);
  g.position.copy(P).addScaledVector(y, BELT.thick);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  g.visible = true;
}

/** Her belt, carried folded in her fist (from her waist to your wrists, and back). */
function rvbCarryBelt(on) {
  if (!on) { if (rvb.carry) rvb.carry.mesh.visible = false; return; }
  if (!rvb.carry) rvb.carry = rvbTubeMake(60, 4, BELT.leather, 1, rvbMat(0.22, 34));
  const pm = rvmPalm('R', new THREE.Vector3());
  if (!pm) return;
  const { f, r } = rvmAxes(rev.ch.yaw);
  const sw = 0.03 * Math.sin(rev.clock * 2.3) * Math.min(1, rev.ch.sp);
  const pts = [], W = [];
  const L = 0.42;
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const down = u < 0.5 ? u * 2 * L : (1 - u) * 2 * L;
    const bend = Math.sin(u * Math.PI) * 0.035;
    pts.push(pm.clone().add(new THREE.Vector3(0, -down - 0.03, 0)).addScaledVector(r, bend * (u < 0.5 ? -1 : 1) * 0.5).addScaledVector(f, sw + bend * 0.4));
    W.push(f.clone());
  }
  rvbStrapSet(rvb.carry, pts, W, BELT.width, BELT.thick);
}

// ── the blindfold ────────────────────────────────────────────────────────────

/**
 * THE BAND, fitted once per hairstyle, in Baye's bind frame (she faces +x, y
 * up): rows across its height at eye level, each the convex hull of
 * everything of her head there — skin, hair, lashes, brows, eyes — as radii
 * from the head's middle, plus a few millimetres; a knot at the back.
 * Answers the geometry, or null.
 */
function rvbBandFit() {
  const f = jadrija && jadrija.figure;
  const A = typeof appr !== 'undefined' && appr && appr.mesh && appr.mesh.visible ? appr : null;
  const fig = A || f;
  if (!fig || !fig.mesh) return null;
  const hair = A && A.parts ? (A.parts.hair2 && A.parts.hair2.visible ? 'hair2' : 'hair') : 'v1';
  if (rvb.band && (rvb.band.key === hair + (A ? 'A' : 'f') || rev.clock - (rvb.band.at || -9) < 3)) return rvb.band;
  const g = fig.mesh.geometry, pos = g.getAttribute('position'), ix = g.getIndex();
  if (!pos || !ix) return null;
  // Every vertex drawn: the body's range and each part's that is shown.
  const ranges = [g.drawRange];
  if (A && A.parts) for (const [k, p] of Object.entries(A.parts)) if (p && p.visible !== false && p.geometry && p.geometry.drawRange && (k !== 'hair' || hair === 'hair') && (k !== 'hair2' || hair === 'hair2')) ranges.push(p.geometry.drawRange);
  const seen = new Uint8Array(pos.count);
  // The eyes' middle, bind: off the apprentice's own measure, or the head.
  let eyeY = null, eyeX = null;
  if (A && typeof apprEye !== 'undefined' && apprEye && apprEye.uEyeL) { eyeY = (apprEye.uEyeL.value.y + apprEye.uEyeR.value.y) / 2; eyeX = (apprEye.uEyeL.value.x + apprEye.uEyeR.value.x) / 2; }
  const hiB = f.boneIndex('head');
  const R0 = f.bindRest ? f.bindRest() : null;
  const hb = R0 ? new THREE.Vector3(R0.bindT[3 * hiB], R0.bindT[3 * hiB + 1], R0.bindT[3 * hiB + 2]) : null;
  if (eyeY == null && hb) { eyeY = hb.y + 0.085; eyeX = hb.x + 0.08; }
  if (eyeY == null) return null;
  // The band: 46 mm high, its lower edge 20 mm under the eyes' middle; tipped
  // up 6 degrees at the back, over the bump of the head.
  const lo = eyeY - 0.020, hiY = eyeY + 0.026, rowsN = 5, tilt = 0.10;
  const P = [];
  for (const r of ranges) {
    const end = Math.min(ix.count, r.start + (Number.isFinite(r.count) ? r.count : ix.count));
    for (let i = r.start; i < end; i++) {
      const v = ix.getX(i);
      if (seen[v]) continue;
      seen[v] = 1;
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      if (y < lo - 0.04 || y > hiY + 0.06) continue;
      if (Math.abs(z) > 0.14 || x < eyeX - 0.30 || x > eyeX + 0.06) continue;
      P.push([x, y, z]);
    }
  }
  // The head's middle at that height (the skin's, front to back and across).
  let xmin = 9, xmax = -9, zmin = 9, zmax = -9;
  for (const p of P) { if (Math.abs(p[1] - eyeY) > 0.02) continue; xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); }
  const cx = (xmin + xmax) / 2, cz = (zmin + zmax) / 2;
  const K = 64, rows = [];
  for (let j = 0; j < rowsN; j++) {
    const h = lo + (hiY - lo) * j / (rowsN - 1);
    const pts = [];
    for (const p of P) {
      // The band's plane at this row, tipped: higher at the back (−x).
      const yy = h + (cx - p[0]) * tilt;
      if (Math.abs(p[1] - yy) > (hiY - lo) / (rowsN - 1) * 0.9 + 0.003) continue;
      pts.push([p[0] - cx, p[2] - cz]);
    }
    if (pts.length < 8) return null;
    const H = rvbHull2(pts);
    const R = new Float32Array(K);
    for (let k = 0; k < K; k++) R[k] = rvbRayR(H, [0, 0], k / K * Math.PI * 2);
    rows.push({ h, R });
  }
  // A stretched band takes the hull and smooths it: across the rows, the
  // larger of a row's and its neighbours' (it does not dip into an eye socket).
  for (let k = 0; k < K; k++) {
    const m = rows.map((r) => r.R[k]);
    for (let j = 0; j < rowsN; j++) rows[j].R[k] = Math.max(m[j], 0.5 * (m[Math.max(0, j - 1)] + m[Math.min(rowsN - 1, j + 1)]));
  }
  const clear = 0.0022, th = 0.0026;
  // The mesh: an inner and an outer skin, and the edges.
  const ring = (j, k, out) => {
    const a = k / K * Math.PI * 2, r = rows[j].R[k] + clear + (out ? th : 0);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const y = rows[j].h + (cx - x) * tilt;
    return [x, y, z];
  };
  const verts = [], cols = [], idx = [];
  const C0 = [0.045, 0.043, 0.050];
  const push = (p, c) => { verts.push(...p); cols.push(...c); return verts.length / 3 - 1; };
  const grid = (out) => {
    const base = verts.length / 3;
    for (let j = 0; j < rowsN; j++) for (let k = 0; k < K; k++) {
      // A weave's sheen: the faintest ribbing.
      const rib = 1 + 0.10 * Math.sin(k * 3.1) * (out ? 1 : 0.4);
      push(ring(j, k, out), [C0[0] * rib, C0[1] * rib, C0[2] * rib]);
    }
    for (let j = 0; j < rowsN - 1; j++) for (let k = 0; k < K; k++) {
      const a = base + j * K + k, b = base + j * K + (k + 1) % K, c = a + K, d = b + K;
      if (out) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    return base;
  };
  const bi = grid(false), bo = grid(true);
  for (let k = 0; k < K; k++) {
    const k1 = (k + 1) % K;
    for (const j of [0, rowsN - 1]) {
      const a = bi + j * K + k, b = bi + j * K + k1, c = bo + j * K + k, d = bo + j * K + k1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // The knot at the back (−x), and its two ends lying flat.
  const kb = Math.round(K / 2);
  const back = ring(Math.floor(rowsN / 2), kb, true);
  const knot = new THREE.SphereGeometry(0.011, 10, 8);
  knot.scale(0.8, 1, 1.3);
  const kp = knot.getAttribute('position');
  const k0 = verts.length / 3;
  for (let i = 0; i < kp.count; i++) push([back[0] + kp.getX(i) - 0.004, back[1] + kp.getY(i), back[2] + kp.getZ(i)], C0);
  const ki = knot.getIndex();
  for (let i = 0; i < ki.count; i++) idx.push(k0 + ki.getX(i));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('aVCol', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (rvb.band && rvb.band.mesh) { scene.remove(rvb.band.mesh); rvb.band.mesh.geometry.dispose(); }
  const mesh = new THREE.Mesh(geo, rvbMat(0.06, 12));
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  rvb.band = { key: hair + (A ? 'A' : 'f'), at: rev.clock, mesh, fig, rows, cx, cz, K, clear, th, tilt, n: P.length, eyeY };
  return rvb.band;
}

/** The band where your head is this frame (the head bone's palette), slid on by `k`. */
function rvbBandPlace(k) {
  const b = rvb.band;
  if (!b) return;
  if (k <= 0.001) { b.mesh.visible = false; return; }
  const f = jadrija.figure, hi = f.boneIndex('head');
  const Pal = f.pose().palette, o = hi * 12;
  _rbM.set(Pal[o], Pal[o + 1], Pal[o + 2], Pal[o + 3], Pal[o + 4], Pal[o + 5], Pal[o + 6], Pal[o + 7],
    Pal[o + 8], Pal[o + 9], Pal[o + 10], Pal[o + 11], 0, 0, 0, 1);
  const mw = (b.fig.mesh || f.mesh).matrixWorld;
  // Slid on from above the brow, and a little loose until it is tied.
  const s = 1 + 0.06 * (1 - k);
  const slide = new THREE.Matrix4().makeTranslation(0, 0.05 * (1 - k), 0);
  const sc = new THREE.Matrix4().makeTranslation(b.cx, b.rows[2].h, b.cz)
    .multiply(new THREE.Matrix4().makeScale(s, 1, s)).multiply(new THREE.Matrix4().makeTranslation(-b.cx, -b.rows[2].h, -b.cz));
  b.mesh.matrix.copy(mw).multiply(_rbM).multiply(slide).multiply(sc);
  b.mesh.matrixWorldNeedsUpdate = true;
  b.mesh.visible = true;
}

/**
 * FIRST PERSON, BLINDFOLDED: the view nearly black, a faint leak of the room's
 * light at the bottom edge where the band lifts off your cheeks. Only in your
 * own eyes — the third person (B), a debug lens, a set camera show the band.
 */
function rvbDark(k, dt) {
  if (typeof document === 'undefined') return;
  const fp = rev.on && !(typeof bodyCam !== 'undefined' && bodyCam) && !rev.debugCam && !(typeof camOverride !== 'undefined' && camOverride);
  const want = fp ? k : 0;
  if (!rvb.dark) {
    if (want <= 0.001) return;
    const el = document.createElement('div');
    el.id = 'rvb-dark';
    el.style.cssText = 'position:fixed;inset:0;z-index:33;pointer-events:none;opacity:0;'
      + 'background:linear-gradient(to top, rgba(58,44,30,.62) 0%, rgba(14,11,9,.90) 7%, rgba(3,3,4,.985) 22%, rgb(0,0,0) 60%);';
    document.body.appendChild(el);
    rvb.dark = el;
  }
  rvb.darkK = want;
  const o = +(want * RVB.dark / 0.985).toFixed(3);
  if (o !== rvb.darkWas) { rvb.dark.style.opacity = String(Math.min(1, o)); rvb.darkWas = o; rvb.dark.hidden = o <= 0.001; }
}

/**
 * Her voice and her steps, while you cannot see: panned to where she is
 * against your head, and louder near (`audio.voiceSpace`, `audio.stepAt`).
 */
function rvbHear(M, dt) {
  const A = typeof audio !== 'undefined' ? audio : null;
  if (!A) return;
  const blind = M && M.bandK > 0.5;
  if (!blind) {
    if (rvb.heard) { if (A.voiceSpace) A.voiceSpace(0, 1); rvb.heard = false; }
    return;
  }
  const Hc = revChloeHead(new THREE.Vector3());
  const E = camera.position;
  const d = Hc.clone().sub(E);
  const dist = Math.max(0.15, d.length());
  const rt = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const pan = rvbCl(d.dot(rt) / dist * 0.9, -0.9, 0.9);
  const gain = rvbCl(Math.pow(0.9 / dist, 0.7), 0.45, 1.6);
  if (A.voiceSpace) A.voiceSpace(pan, gain);
  rvb.heard = true;
  rvb.hearNow = { pan: +pan.toFixed(2), gain: +gain.toFixed(2), dist: +dist.toFixed(2) };
  // Her steps: a footfall a stride, while she walks.
  const sp = rev.ch.sp;
  if (sp > 0.25 && A.stepAt) {
    rvb.stepT -= dt;
    if (rvb.stepT <= 0) {
      rvb.stepT = 0.58 / Math.max(0.5, sp);
      const fd = Math.hypot(rev.ch.x - E.x, rev.ch.z - E.z);
      const fp = new THREE.Vector3(rev.ch.x - E.x, 0, rev.ch.z - E.z);
      const fpan = rvbCl(fp.dot(rt) / Math.max(0.2, fd), -0.9, 0.9);
      A.stepAt(0.55, rvbCl(1.3 / Math.max(0.6, fd), 0.25, 1.4), fpan);
      M.steps = (M.steps || 0) + 1;
    }
  } else rvb.stepT = 0.1;
}

// ── her hands ────────────────────────────────────────────────────────────────

/** Her two hands at the bundle (tying, checking, untying): either side of it, working round it. */
function rvbHandsAtBundle(M, work = 0, rate = 6) {
  const P = M.path && M.path.Bn;
  const G = M.goal;
  if (!P && !G) return;
  const C = P ? P.C.clone() : G.C.clone();
  const u = P ? P.u : G.lat, v = P ? P.v : _rbUP;
  const sh = rvmShoulder('R', new THREE.Vector3()) || C;
  for (const s of ['L', 'R']) {
    const sg = s === 'R' ? 1 : -1;
    const ph = rev.clock * 5.2 * work + (s === 'R' ? 0 : Math.PI);
    const r = 0.045 + 0.012 * Math.sin(ph);
    // On her side of the bundle: toward her.
    const toHer = sh.clone().sub(C).normalize();
    const side = u.clone().multiplyScalar(sg).addScaledVector(toHer, 0.6).normalize();
    const T = C.clone().addScaledVector(side, r).addScaledVector(v, 0.012 * Math.cos(ph) * work);
    const n = side.clone();
    rvmAsk(s, { C: T, n, d: v.clone().multiplyScalar(-1), pole: toHer.clone().multiplyScalar(-0.2).add(new THREE.Vector3(0, -0.3, 0)).addScaledVector(u, sg * 0.8),
      cock: 0, shape: 'soft', rate, fb: true });
  }
}

/** Her hands either side of your head (the blindfold on and off), and to the knot at the back of it. */
function rvbHandsAtHead(M, knot = 0) {
  const Hd = rvmYourHead();
  if (!Hd) return;
  for (const s of ['L', 'R']) {
    const sg = s === 'R' ? 1 : -1;
    // Her right hand on your left temple if she faces you, else on your right.
    const toHer = new THREE.Vector3(rev.ch.x - Hd.C.x, 0, rev.ch.z - Hd.C.z).normalize();
    const { r } = rvmAxes(rev.ch.yaw);
    const side = Hd.rt.dot(r) > 0 ? Hd.rt.clone() : Hd.rt.clone().negate();
    const sideP = Hd.C.clone().addScaledVector(side, sg * 0.095).addScaledVector(Hd.up, -0.03);
    const backP = Hd.C.clone().addScaledVector(Hd.fw, -0.10).addScaledVector(side, sg * 0.03).addScaledVector(Hd.up, -0.025);
    const T = sideP.lerp(backP, knot);
    const n = T.clone().sub(Hd.C).normalize();
    rvmAsk(s, { C: T.addScaledVector(n, 0.006), n, d: Hd.up.clone(), pole: side.clone().multiplyScalar(sg).add(new THREE.Vector3(0, -0.5, 0)).addScaledVector(toHer, 0.3),
      cock: 0.1, shape: 'soft', rate: 6, fb: true });
  }
}

/** Plan her place: both hands at `pts` (`{ s, T, n }`), and go there. */
function rvbGoTo(M, reach, o = {}) {
  // Tried as asked, then easier: her head nearer you (a hand's width), a
  // deeper bow, a longer reach, and wider rings (MEASURED: with the defaults
  // she found no place behind you kneeling, nor at the cot's end).
  const tries = [o, Object.assign({}, o, { headR: Math.min(o.headR || 0.27, 0.16) }),
    Object.assign({}, o, { headR: 0.12, bowMax: Math.max(o.bowMax || 0, 1.0), reach: Math.max(o.reach || 0, 0.47) }),
    Object.assign({}, o, { headR: 0.10, bowMax: 1.15, reach: 0.49, ring: o.ring ? o.ring.concat([0.80, 0.90]) : [0.30, 0.36, 0.42, 0.50, 0.60, 0.72, 0.85], prefer: null })];
  let P = null;
  for (const t of tries) { P = rvmPlan(reach, t); if (P) break; }
  if (!P) return false;
  M.plan = P;
  rvmGoPlan(P);
  return true;
}
/** There yet (and down, if it is a kneel)? */
function rvbThere(M) {
  if (!M.plan) return true;
  if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
  if (rvmSettled() || M.t - M.t0 > RVB.goT) {
    if (!M.bowed) { rvm.body.bowTo = M.plan.bow; rvm.body.wTo = M.plan.w || 0; M.bowed = true; }
    return true;
  }
  return false;
}

/** Where she ties from: at the cot's end beyond your head (kneeling), behind you, or beside you at the hook. */
function rvbTieOpts(M) {
  if (M.kind === 'cot') { const R = rvbRail(); return { mode: 'kneel', prefer: R ? R.H : null, preferK: 3, bowMax: 1.15, headR: 0.18, reach: 0.47, ring: [0.38, 0.44, 0.50, 0.58, 0.66] }; }
  if (M.kind === 'back') {
    // Beside you and a little behind — not straight behind: kneeling, your
    // feet are there, and her knees went into your calves (MEASURED, 80 mm).
    const B = rvbBodyAx();
    if (B && M.backSide == null) M.backSide = (rev.ch.x - B.Pv.x) * B.rt.x + (rev.ch.z - B.Pv.z) * B.rt.z >= 0 ? 1 : -1;
    const pref = B ? B.fw.clone().negate().addScaledVector(B.rt, 1.3 * (M.backSide || 1)).setY(0).normalize() : null;
    // You on your knees: she stands and bends to your wrists rather than
    // kneeling beside you — kneeling, her head came down by your shoulder and
    // into your arm (MEASURED, 72 mm).
    const v = revView();
    const kneel = v && v.ctx === 'kneel';
    if (kneel && B) {
      // You on your knees: from square beside you, kneeling, her arms across
      // to your back — from behind her knees were in your calves, bending
      // over you her head came down into your back (MEASURED, 80 mm both).
      return { prefer: B.rt.clone().multiplyScalar(M.backSide || 1).setY(0).normalize(), preferK: 3, headR: 0.22, reach: 0.47, bowMax: 0.8, ring: [0.48, 0.55, 0.62, 0.70] };
    }
    return { prefer: pref, preferK: 2.5, headR: 0.18, ring: [0.42, 0.50, 0.58, 0.66, 0.75] };
  }
  const K = rvbKab();
  return { mode: 'stand', prefer: K ? K.hook.lat.clone().multiplyScalar(M.herSide || 1) : null, preferK: 2, headR: 0.16, reach: 0.47 };
}
/** The reach for the bundle: both her hands at it. */
function rvbBundleReach(M) {
  const G = rvbWristGoal(M);
  if (!G) return null;
  rvbReachClamp(G);
  const n = M.kind === 'cot' ? new THREE.Vector3(0, 1, 0) : M.kind === 'hook' ? (rvbKab().hook.n.clone()) : rvbBodyAx().fw.clone().negate();
  return [{ s: 'R', T: G.C.clone().addScaledVector(G.lat, 0.04), n }, { s: 'L', T: G.C.clone().addScaledVector(G.lat, -0.04), n }];
}
/** The reach for your head: both her hands at it. */
function rvbHeadReach() {
  const Hd = rvmYourHead();
  if (!Hd) return null;
  return [{ s: 'R', T: Hd.C.clone().addScaledVector(Hd.rt, 0.09), n: Hd.rt.clone() }, { s: 'L', T: Hd.C.clone().addScaledVector(Hd.rt, -0.09), n: Hd.rt.clone().negate() }];
}

// ── the frame ────────────────────────────────────────────────────────────────

/** A frame, from `revTick` (before her moves and arms are solved). */
function rvbTick(dt) {
  rvb.frame++;
  if (!rvb.installed) rvbInstall();
  rvbSafeCheck();
  rvbAfterTick();
  const M = rvb.M;
  if (rvb.coil) rvbCoilPlace();
  if (!M) {
    rvbDraw(null, dt);
    return;
  }
  M.t += dt; M.clk += dt;
  M.mood = rvbMood();
  const v = revView();
  // Out of the pose it needs (a key nobody caught, the leash, the room): it ends.
  if (M.kind && M.armK > 0.5 && !rvbKinds(v).includes(M.kind) && !/^(free|blindoff|stow|done)$/.test(M.ph)) {
    if (!M.lost) M.lost = rev.clock;
    // Another pose for a second and a half, or between poses for four.
    if (rev.clock - M.lost > (v && v.ctx ? 1.5 : 4)) { rvbTrace({ pick: 'bind:lost', why: v ? v.phase : '?' }); M.untieFast = true; rvbPhase(M, 'untie'); }
  } else M.lost = null;
  rvbSquirmTick(M, dt);
  rvbPhaseTick(M, dt, v);
  if (!rvb.M) { rvbDraw(null, dt); return; }
  rvbArms(M, dt);
  rvbHeadGuard(M, dt);
  rvbDraw(M, dt);
  if (rvb.measure && M.clk >= M.measAt && M.kind && M.tieU > 0.95) { M.measAt = M.clk + RVB.every; rvbMeasure(M); }
}

/** What is drawn: the tie, the belt in her hand, the band, the dark, the sound. */
function rvbDraw(M, dt) {
  rvbDrawTie(M);
  rvbCarryBelt(!!(M && M.carry));
  if (M && M.bandK > 0.001) { if (rvbBandFit()) rvbBandPlace(M.bandK); }
  else if (rvb.band) rvb.band.mesh.visible = false;
  const dk = M ? M.darkK || 0 : 0;
  rvbDark(dk, dt);
  rvbHear(M, dt);
}

/** The phases. */
function rvbPhaseTick(M, dt, v) {
  const tt = M.t - M.t0;
  const m = M.mood;
  // The darkness follows the band, a beat behind it on and slower off (your eyes).
  const dkWant = M.bandK > 0.6 ? 1 : 0;
  M.darkK = damp(M.darkK || 0, dkWant, dkWant > (M.darkK || 0) ? 1 / RVB.darkIn * 2.2 : 1 / RVB.darkOut * 2.2, dt);
  if (dkWant === 0 && M.darkK < 0.01) M.darkK = 0;
  if (M.sub && typeof rvm !== 'undefined' && rvm.move !== M.sub) M.sub = null;
  switch (M.ph) {
    case 'fetch': return rvbFetch(M, tt, dt);
    case 'go': return rvbGo(M, tt, dt);
    case 'lead': return rvbLead(M, tt, dt);
    case 'arms': {
      // Your arms to the tie, round the way.
      if (!M.from) M.from = { L: rvhBayePalm('L', new THREE.Vector3()), R: rvhBayePalm('R', new THREE.Vector3()) };
      M.armU = Math.min(1, tt / RVB.armsT);
      M.armK = Math.min(1, tt / 0.25);
      if (M.how === 'belt') M.carry = true;
      const there = rvbThere(M);
      if (M.armU >= 1 && tt > RVB.armsT + 0.1 && (there || tt > RVB.goT)) {
        M.from = null;
        rvbPhase(M, 'tie');
        if (M.coilHand && rvb.coil) { rvb.coil.inHand = false; rvb.coil.hidden = true; }
        rvbSay('bind', true);
      }
      return;
    }
    case 'tie': {
      M.carry = false;
      const T = M.how === 'belt' ? RVB.beltTieT : RVB.tieT;
      M.tieU = Math.min(1, tt / T);
      rvbHandsAtBundle(M, 1, 7);
      if (M.tieU >= 1) { rvbPhase(M, 'tug'); }
      return;
    }
    case 'tug': {
      rvbHandsAtBundle(M, 0, 7);
      M.tugK = Math.sin(Math.PI * Math.min(1, tt / RVB.tugT));
      if (tt > RVB.tugT) {
        M.tugK = 0;
        M.timing.tied = +rev.clock.toFixed(2);
        if (M.blindWant && !M.blind) { rvbBlindGo(M); return; }
        rvbHoldGo(M);
      }
      return;
    }
    case 'blindon': return rvbBlindOn(M, tt, dt);
    case 'blindoff': return rvbBlindOff(M, tt, dt);
    case 'hold': return rvbHold(M, tt, dt, m);
    case 'check': return rvbCheck(M, tt, dt);
    case 'whisper': return rvbWhisper(M, tt, dt);
    case 'away': return rvbAway(M, tt, dt);
    case 'untie': {
      if (!M.untieGo) {
        M.untieGo = true; M.bowed = false;
        const R = rvbBundleReach(M);
        if (R && !M.untieFast) rvbGoTo(M, R, rvbTieOpts(M));
        if (!M.untieFast) rvbSay('bind_off', true);
      }
      if (!M.untieFast && !rvbThere(M)) return;
      if (!M.untieAt) M.untieAt = M.t;
      const u = (M.t - M.untieAt) / (M.untieFast ? 0.3 : RVB.untieT);
      M.tieU = Math.max(0, 1 - u);
      if (!M.untieFast) rvbHandsAtBundle(M, 1, 7);
      if (M.tieU <= 0) {
        M.tieU = 0;
        if (M.how === 'belt') M.carry = true;
        else if (rvb.coil) { rvb.coil.hidden = false; rvb.coil.inHand = true; rvb.coil.at = null; }
        M.freeFrom = { L: true, R: true };
        rvbPhase(M, 'free');
      }
      return;
    }
    case 'free': {
      M.freeU = Math.min(1, tt / RVB.freeT);
      M.armK = Math.max(0, 1 - rvbSm(M.freeU));
      if (M.freeU >= 1) {
        M.armK = 0;
        if (typeof rvhUnaim === 'function') rvhUnaim();
        // The rope: dropped where she stands. The belt: back on her.
        if (rvb.coil && rvb.coil.inHand) rvbCoilDrop();
        if (M.blind) { rvbPhase(M, 'blindoff'); return; }
        if (M.how === 'belt') { rvbPhase(M, 'stow'); return; }
        rvbEnd(M, 'done');
      }
      return;
    }
    case 'stow': {
      // Her belt back on: her hand to her buckle, the band painted back.
      M.carry = tt < RVB.stowT * 0.6;
      const bk = typeof rvkFig === 'function' ? rvkFig(RVK.buckle, new THREE.Vector3()) : null;
      if (bk) { const { f } = rvmAxes(rev.ch.yaw); rvmAsk('R', { C: bk.addScaledVector(f, 0.03), n: f.clone(), d: new THREE.Vector3(0, -1, 0), pole: new THREE.Vector3(0, -1, 0), cock: 0, shape: 'grip', rate: 8 }); }
      if (you && you.belt) you.belt(rvbSm(tt / RVB.stowT));
      if (tt > RVB.stowT) {
        if (you && you.belt) you.belt(1);
        if (typeof rvk !== 'undefined' && rvk.belt.ph === 'bound') rvk.belt.ph = 'off';
        if (typeof audio !== 'undefined' && audio && audio.beltQuiet) audio.beltQuiet();
        rvbEnd(M, 'done');
      }
      return;
    }
  }
}

/** Fetching it: her belt off her jeans, or the rope's coil from wherever it lies. */
function rvbFetch(M, tt, dt) {
  if (!M.kind) { rvbPhase(M, 'blindon'); return; }
  if (M.how === 'belt') {
    // In her hand already (her belt round, held): she uses it as it is.
    if (typeof rvk !== 'undefined' && rvk.belt.ph !== 'off' && rvk.belt.ph !== 'bound') {
      if (rvk.strap) rvk.strap.hide();
      if (typeof rvkArmFree === 'function') rvkArmFree('R');
      rvk.belt.ph = 'bound'; rvk.belt.n = 0;
      M.carry = true;
      rvbAfterFetch(M);
      return;
    }
    if (tt < 0.02) {
      if (typeof rvk !== 'undefined') rvk.belt.ph = 'bound';
      rev.ch.goal = null;
      if (typeof audio !== 'undefined' && audio && audio.beltBuckle) audio.beltBuckle(0.35);
    }
    const bk = typeof rvkFig === 'function' ? rvkFig(RVK.buckle, new THREE.Vector3()) : null;
    if (bk) { const { f } = rvmAxes(rev.ch.yaw); rvmAsk('R', { C: bk.addScaledVector(f, 0.03), n: f.clone(), d: new THREE.Vector3(0, -1, 0), pole: new THREE.Vector3(0, -1, 0), cock: 0, shape: 'grip', rate: 8 }); }
    const u = Math.max(0, (tt - 0.35) / (RVB.unbuckleT - 0.35));
    if (you && you.belt) you.belt(1 - rvbSm(u));
    M.carry = u > 0.7;
    if (tt > RVB.unbuckleT) { M.carry = true; rvbAfterFetch(M); }
    return;
  }
  // The rope: to where the coil is, her hand to it, and it is in her hand.
  const C = rvb.coil;
  if (!C || C.inHand) { M.coilHand = !!(C && C.inHand); rvbAfterFetch(M); return; }
  if (!M.fetchGo) {
    M.fetchGo = true; M.bowed = false;
    const T = C.at.clone().add(new THREE.Vector3(0, 0.03, 0));
    if (!rvbGoTo(M, [{ s: 'R', T, n: new THREE.Vector3(0, 1, 0) }], { ring: [0.40, 0.48, 0.56, 0.66] })) {
      // Out of reach: the rope is simply hers.
      C.inHand = true; C.at = null; M.coilHand = true; rvbAfterFetch(M); return;
    }
    M.fetchFrom = rev.clock;
  }
  if (!rvbThere(M)) return;
  if (!M.reachAt) M.reachAt = M.t;
  const T = C.at ? C.at.clone().add(new THREE.Vector3(0, 0.025, 0)) : null;
  if (T) rvmAsk('R', { C: T, n: new THREE.Vector3(0, 1, 0), d: T.clone().sub(rvmShoulder('R', new THREE.Vector3())).setY(0).normalize(), pole: new THREE.Vector3(0, -1, 0).add(rvmAxes(rev.ch.yaw).r), cock: 0, shape: 'grip', rate: 7, fb: true });
  if (M.t - M.reachAt > RVB.fetchT) {
    C.inHand = true; C.at = null; C.onShelf = false;
    M.coilHand = true;
    rvbAfterFetch(M);
  }
}
function rvbAfterFetch(M) {
  rvbRelease(M);
  rvbPhase(M, M.kind === 'hook' ? 'lead' : 'go');
}

/** To you, and where both her hands reach your wrists in the tie. */
function rvbGo(M, tt, dt) {
  if (!M.goGo) {
    M.goGo = true; M.bowed = false;
    const R = rvbBundleReach(M);
    const B = rvbBodyAx();
    if (!R || !rvbGoTo(M, R, rvbTieOpts(M))) {
      rvbTrace({ pick: 'bind:noplace', why: M.kind });
      rvbEnd(M, 'no place to tie from');
      return;
    }
  }
  const near = M.plan ? Math.hypot(rev.ch.x - M.plan.x, rev.ch.z - M.plan.z) : 0;
  if (near < 0.7 || tt > RVB.goT) {
    if (!rvbThere(M) && tt < RVB.goT) return;
    rvbPhase(M, 'arms');
  }
}

/** THE HOOK: she walks over to it and you are walked after her; you face the wall. */
function rvbLead(M, tt, dt) {
  const K = rvbKab();
  if (!K) { rvbEnd(M, 'no hook'); return; }
  const h = K.hook;
  if (!M.leadGo) {
    M.leadGo = true;
    // Her place: beside where you will stand, on the side the room is.
    let best = null;
    for (const sg of [1, -1]) {
      const p = h.stand.clone().addScaledVector(h.lat, sg * 0.62).addScaledVector(h.n, 0.10);
      const [qx, qz] = ground.confine ? ground.confine(p.x, p.z, rev.ch.y) : [p.x, p.z];
      if (Math.hypot(qx - p.x, qz - p.z) > 0.02 || !jadrija.kabina.room(p.x, p.z, 0.15)) continue;
      const d = Math.hypot(p.x - rev.ch.x, p.z - rev.ch.z);
      if (!best || d < best.d) best = { p, d, sg };
    }
    if (!best) { rvbTrace({ pick: 'bind:hook:noroom' }); M.kind = 'back'; rvbPhase(M, 'go'); return; }
    M.herSpot = best.p; M.herSide = best.sg;
    revGo(best.p.x, best.p.z);
    rev.ch.face = h.stand.clone();
    rvbSay('bind_away', false);
    M.towOn = true;
    M.tow = { v: new THREE.Vector3() };
  }
  // You: walked to your place (`rvbTow`), facing the wall. Then your arms.
  const r = jadrija.rideFrom();
  const there = r && Math.hypot(r.x - h.stand.x, r.z - h.stand.z) < 0.05;
  let dy = h.yaw - (rev.yaw || 0); dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  if ((there && Math.abs(dy) < 0.08 && revAt()) || tt > 14) {
    const R = rvbBundleReach(M);
    if (R) rvbGoTo(M, R, rvbTieOpts(M));
    M.bowed = false;
    rvbPhase(M, 'arms');
  }
}

/**
 * THE WALKER while you stand in a tie (`revTick`'s walk, as the drag's tow):
 * walked to the hook, held where you stand after — and any walking of yours
 * is a struggle. Answers `{ yaw, sp }` or null.
 */
function rvbTow(dt, Y) {
  const M = rvb.M;
  if (!M || !rev.last) return null;
  if (!M.kind || M.kind === 'cot') return null;
  if (/^(free|blindoff|stow|done)$/.test(M.ph) && M.armK < 0.05) return null;
  const px = rev.last[0], pz = rev.last[1];
  // What your keys asked this frame: a struggle, not a step.
  // (Your keys, not your place: her body's own push off you is not you.)
  const walking = typeof keys !== 'undefined' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => keys.has(k));
  if (walking && M.armK > 0.5) rvbStruggle('you');
  if (M.kind === 'hook' && M.ph === 'lead' && M.tow) {
    const h = rvbKab().hook;
    // After her, then to your place: her speed, a spring, never through a wall.
    const tx = h.stand.x, tz = h.stand.z;
    const ex = tx - px, ez = tz - pz, ed = Math.hypot(ex, ez);
    const sp = Math.min(0.85, ed * 1.6);
    const vx = ed > 1e-4 ? ex / ed * sp : 0, vz = ed > 1e-4 ? ez / ed * sp : 0;
    M.tow.v.x = damp(M.tow.v.x, vx, 4, dt); M.tow.v.z = damp(M.tow.v.z, vz, 4, dt);
    let nx = px + M.tow.v.x * dt, nz = pz + M.tow.v.z * dt;
    if (ground.confine) [nx, nz] = ground.confine(nx, nz, Y.y);
    Y.x = nx; Y.z = nz; Y.vx = 0; Y.vz = 0;
    const s = Math.hypot(M.tow.v.x, M.tow.v.z);
    // Turned to the way you walk, and at the end to the wall.
    let yaw = rev.yaw || 0;
    const want = ed > 0.25 ? Math.atan2(-ex, -ez) : h.yaw;
    let dy = want - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
    return { yaw, sp: s };
  }
  // Held where you are (the wall in front, at the hook).
  if (M.kind === 'hook' && M.leadGo) {
    const h = rvbKab().hook;
    Y.x = h.stand.x; Y.z = h.stand.z; Y.vx = 0; Y.vz = 0;
    let yaw = rev.yaw || 0;
    let dy = h.yaw - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
    return { yaw, sp: 0 };
  }
  Y.x = px; Y.z = pz; Y.vx = 0; Y.vz = 0;
  return { yaw: rev.yaw, sp: 0 };
}

// ── the blindfold on and off ─────────────────────────────────────────────────

function rvbBlindGo(M) {
  M.blindGoGo = false;
  rvbPhase(M, 'blindon');
}
function rvbBlindOn(M, tt, dt) {
  if (!M.blindGoGo) {
    M.blindGoGo = true; M.bowed = false;
    if (!rvbBandFit()) { rvbTrace({ pick: 'bind:blind:nofit' }); M.blindWant = false; if (M.kind) rvbHoldGo(M); else rvbEnd(M, 'no blindfold'); return; }
    const R = rvbHeadReach();
    const Hd = rvmYourHead();
    // (A ring off your head, not into it: kneeling, her trunk went into your head at 0.30, MEASURED.)
    if (!R || !rvbGoTo(M, R, { prefer: Hd ? Hd.fw.clone().negate().setY(0).normalize() : null, preferK: 1.5, reach: 0.47, ring: [0.42, 0.48, 0.55, 0.62, 0.70], headR: 0.2, bowMax: 0.9 })) {
      // From where she is, if her arms reach; else not at all.
      M.plan = null;
    }
  }
  if (!rvbThere(M)) return;
  if (!M.blindAt) { M.blindAt = M.t; rvbSay('blind_on', true); }
  const u = (M.t - M.blindAt) / RVB.blindT;
  rvbHandsAtHead(M, rvbSm((u - 0.55) / 0.35));
  M.bandK = rvbSm(u / 0.6);
  if (u >= 1) {
    M.blind = true; M.blindWant = false; M.blindAt = null;
    M.timing.blind = +rev.clock.toFixed(2);
    if (M.kind) rvbHoldGo(M);
    else rvbHoldGo(M);
  }
}
function rvbBlindOff(M, tt, dt) {
  if (!M.blindOffGo) {
    M.blindOffGo = true; M.bowed = false;
    if (!M.offFast) {
      const R = rvbHeadReach();
      const Hd = rvmYourHead();
      if (R) rvbGoTo(M, R, { prefer: Hd ? Hd.fw.clone().setY(0).normalize() : null, preferK: 1.2, reach: 0.47, ring: [0.42, 0.48, 0.55, 0.62, 0.70], headR: 0.2, bowMax: 0.9 });
      rvbSay('blind_off', true);
    }
  }
  if (!M.offFast && !rvbThere(M)) return;
  if (!M.blindAt) M.blindAt = M.t;
  const u = (M.t - M.blindAt) / RVB.blindOffT;
  if (!M.offFast) rvbHandsAtHead(M, 1 - rvbSm(u / 0.4));
  M.bandK = 1 - rvbSm((u - 0.3) / 0.6);
  if (u >= 1) {
    M.bandK = 0; M.blind = false; M.blindAt = null;
    if (M.how === 'belt') { rvbPhase(M, 'stow'); return; }
    rvbEnd(M, 'done');
  }
}

// ── left tied ────────────────────────────────────────────────────────────────

function rvbHoldGo(M) {
  // From close work (the knots, your ear, the blindfold): a step back off you
  // after it (MEASURED before: left standing where her hands had been, her
  // head was in your raised arm, 69 mm).
  if (/^(tug|check|whisper|blindon)$/.test(M.ph)) M.stepBack = true;
  rvbRelease(M);
  rvbPhase(M, 'hold');
  M.nextAct = M.tHold + 1.5 + Math.random() * 1.5;
}

/**
 * LEFT TIED: her choices every so often (her mood's `gap`, shorter in a wave
 * of excitement), until she has had you like this long enough. A beg of yours
 * she owes you first; a struggle answered (`rvbSquirmTick`).
 */
function rvbHold(M, tt, dt, m) {
  M.tHold += dt;
  if (M.backSayAt && rev.clock > M.backSayAt) { M.backSayAt = null; rvbSay('bind_back', true); }
  const busy = (typeof rvm !== 'undefined' && rvm.move) || rev.arm.mode === 'spank';
  if (M.blindWant && !M.blind && !busy) { rvbBlindGo(M); return; }
  if (M.checkWant && !busy) { M.checkWant = false; rvbPhase(M, 'check'); return; }
  const holdFor = M.holdFor + (M.extra || 0);
  if (M.tHold > holdFor && !busy) {
    if (M.kind) { M.untieGo = false; M.untieAt = null; rvbPhase(M, 'untie'); }
    else { M.blindOffGo = false; rvbPhase(M, 'blindoff'); }
    return;
  }
  if (busy) return;
  if (M.stepBack) {
    M.stepBack = false;
    const P = revBone('pelvis', new THREE.Vector3());
    if (P) {
      const d = new THREE.Vector3(rev.ch.x - P.x, 0, rev.ch.z - P.z);
      if (d.lengthSq() < 1e-4) d.set(1, 0, 0);
      d.normalize();
      for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
        const q = d.clone().applyAxisAngle(_rbUP, a);
        const x = P.x + q.x * 0.85, z = P.z + q.z * 0.85;
        const [cx, cz] = ground.confine ? ground.confine(x, z, rev.ch.y) : [x, z];
        if (Math.hypot(cx - x, cz - z) > 0.02 || !jadrija.kabina.room(x, z, 0.15)) continue;
        revGo(x, z); rev.ch.face = P.clone();
        break;
      }
    }
  }
  // A spanking you begged for: now, if you are where she can.
  const BG = typeof rmood !== 'undefined' ? rmood.beg : null;
  if (BG && /spank|harder|discipline|whip/.test(BG.what)) {
    rmood.beg = null;
    if (rvbSpank(M, Math.min(8, BG.n), 'begged: ' + BG.what) === true) return;
  }
  if (M.tHold < M.nextAct) return;
  rvbActs(M, m);
}

/** Her choice, now. */
function rvbActs(M, m) {
  const W = [];
  const toys = typeof revToys === 'function' ? revToys() : [];
  const v = revView();
  const canSpank = v && (v.ctx === 'front' || v.ctx === 'stand' || v.ctx === 'kneel');
  if (M.kind && M.checksDone < m.checks + 1) W.push(['check', 0.5 + 1.4 * m.s + 0.3 * m.e]);
  // (Not while you kneel: on your knees you shuffle after her past 1.35 m —
  // 43-jadrija.js's `creep` — and a tie is not that. MEASURED: it took you out of it.)
  if (M.aways < 2 + Math.round(m.s * 2) && !(v && v.ctx === 'kneel')) W.push(['away', m.away * (M.blind ? 1.3 : 1)]);
  W.push(['tease', 0.6 + 0.6 * m.e + 0.2 * m.g]);
  W.push(['whisper', m.whisper * (M.blind ? 1.6 : 1) * (M.whispers > 2 ? 0.4 : 1)]);
  if (m.g > 0.25) W.push(['praise', m.praise]);
  if (m.stroke && M.kind !== 'hook') W.push(['stroke', m.stroke]);
  if (toys.length) W.push(['remote', m.remote]);
  if (toys.length && typeof rvtCands === 'function') W.push(['toy', 0.25 + 0.9 * m.e]);
  if (canSpank && M.roundsDone < m.rounds) W.push(['spank', 0.8 + 1.4 * m.s + 1.0 * m.e]);
  if (!M.blind && !M.blindWant && M.kind) W.push(['blind', 0.15 + 0.4 * m.e + 0.25 * m.s]);
  const tot = W.reduce((a, w) => a + w[1], 0);
  let x = Math.random() * tot, pick = W[0][0];
  for (const w of W) { x -= w[1]; if (x <= 0) { pick = w[0]; break; } }
  if (M.force) { pick = M.force; M.force = null; }
  M.nextAct = M.tHold + m.gap * (0.7 + 0.6 * Math.random());
  M.acts.push([+M.tHold.toFixed(1), pick, m.tone]);
  if (pick === 'check') { rvbPhase(M, 'check'); }
  else if (pick === 'away') { rvbPhase(M, 'away'); }
  else if (pick === 'whisper') { rvbPhase(M, 'whisper'); }
  else if (pick === 'tease') { if (rvbSay('bind_hold')) M.lines++; }
  else if (pick === 'praise') { if (rvbSay('bind_good')) M.praises++; }
  else if (pick === 'blind') { M.blindWant = true; }
  else if (pick === 'stroke') {
    const r = rvmStart('stroke', 'bind');
    if (r === true) M.strokes++; else rvbSay('bind_good');
  } else if (pick === 'remote') {
    const k = toys[Math.floor(Math.random() * toys.length)];
    const lvl = Math.min(1, 0.35 + 0.45 * m.e + 0.2 * m.s);
    const r = jadrija.remote ? jadrija.remote(k, true, 4 + Math.round(5 * m.e), lvl) : 'none';
    M.remotes++;
    revSay('buzz', true, null, { still: revStill.dom });
    rvbTrace({ pick: 'bind:remote:' + k, why: String(r) + ' lvl ' + lvl.toFixed(2) });
  } else if (pick === 'toy') {
    const r = rvmStart('toy', 'bind');
    if (r === true) M.toys++;
    else {
      const k = toys[0];
      if (jadrija.remote) jadrija.remote(k, true, 4, 0.5);
      M.remotes++;
      rvbTrace({ pick: 'bind:toy:' + r, why: 'the remote instead' });
    }
  } else if (pick === 'spank') {
    const n0 = 2 + Math.floor(Math.random() * 2);
    rvbSpank(M, typeof rmoodSpanks === 'function' ? rmoodSpanks(n0, m.s > 0.55) : n0, 'tied');
  }
}

/** A round of `n` while you are tied, wherever you are (the existing spank: her palm solved on to the spot). */
function rvbSpank(M, n, why) {
  const r = typeof rvmSpankStart === 'function' ? rvmSpankStart(Math.max(1, n), why) : 'none';
  if (r === true) { M.roundsDone++; M.spankHits0 = rev.slaps; M.spanking = true; }
  else rvbTrace({ pick: 'bind:spank:' + r });
  return r;
}

/** CHECKING THE KNOTS: to your wrists, her hands on them, a tug, and a word. */
function rvbCheck(M, tt, dt) {
  if (!M.checkGo) {
    M.checkGo = true; M.bowed = false; M.checkAt = null;
    const R = rvbBundleReach(M);
    if (!R || !rvbGoTo(M, R, rvbTieOpts(M))) { M.checkGo = false; rvbTrace({ pick: 'bind:check:noplace' }); rvbHoldGo(M); return; }
  }
  if (!rvbThere(M) && tt < RVB.goT) return;
  if (!M.checkAt) { M.checkAt = M.t; rvbSay('bind_check', true); }
  const u = M.t - M.checkAt;
  rvbHandsAtBundle(M, u < 0.8 ? 0.6 : 0, 7);
  M.tugK = u > 0.8 && u < 1.4 ? Math.sin(Math.PI * (u - 0.8) / 0.6) : 0;
  if (u > 1.8) {
    M.tugK = 0; M.checksDone++; M.checkGo = false;
    // Stern: a little tighter each check.
    if (M.mood.s > 0.5) M.tight = Math.min(1, (M.tight || 0) + 0.15);
    rvbHoldGo(M);
  }
}

/** WHISPERING: to your head, close, her hand on your shoulder, a line at your ear. */
function rvbWhisper(M, tt, dt) {
  const Hd = rvmYourHead();
  if (!Hd) { rvbHoldGo(M); return; }
  if (!M.whGo) {
    M.whGo = true; M.bowed = false; M.whAt = null;
    // Her right hand on the side of your head, over your ear, on the side she
    // is on — so her arm brings her in close, and her head to your ear.
    const toHer = new THREE.Vector3(rev.ch.x - Hd.C.x, 0, rev.ch.z - Hd.C.z);
    const sgn = toHer.dot(Hd.rt) >= 0 ? 1 : -1;
    M.whSh = { sgn };
    const n = Hd.rt.clone().multiplyScalar(sgn);
    const T = Hd.C.clone().addScaledVector(n, 0.092).addScaledVector(Hd.up, 0.035);
    if (!rvbGoTo(M, [{ s: 'R', T, n }], { prefer: n.clone().setY(0).normalize(), preferK: 2.0, ring: [0.22, 0.27, 0.32, 0.38, 0.45], headR: 0.10, reach: 0.36, bowMax: 1.0 })) {
      M.whGo = false; rvbSay('bind_whisper', true); M.whispers++; rvbHoldGo(M); return;
    }
  }
  if (!rvbThere(M) && tt < RVB.goT) return;
  if (!M.whAt) { M.whAt = M.t; M.whispers++; rvbSay('bind_whisper', true); }
  const S = M.whSh;
  const n = Hd.rt.clone().multiplyScalar(S.sgn);
  const Th = Hd.C.clone().addScaledVector(n, 0.092 + 0.006).addScaledVector(Hd.up, 0.035);
  rvmAsk('R', { C: Th, n, d: Hd.up.clone(), pole: new THREE.Vector3(0, -1, 0), cock: 0.1, shape: 'soft', rate: 5, fb: true });
  if (jadrija.petTouch) jadrija.petTouch(Math.min(1, (M.t - M.whAt) / 0.8) * (M.mood && M.mood.g > 0.3 ? 1 : 0.5));
  // Her head in toward your ear: a lean, held where her head stays a hand clear of yours.
  const hd = revChloeHead(new THREE.Vector3()).distanceTo(Hd.C);
  M.whBow = rvbCl((M.whBow || rvm.body.bow || 0) + (hd > 0.24 ? 0.5 : hd < 0.19 ? -0.6 : 0) * dt, 0, 1.0);
  rvm.body.bowTo = M.whBow;
  // Her mouth to your ear: the head distance, measured.
  const ch = revChloeHead(new THREE.Vector3());
  const ear = Hd.C.clone().addScaledVector(Hd.rt, 0.075 * S.sgn).addScaledVector(Hd.up, -0.03);
  M.earD = Math.min(M.earD == null ? 9 : M.earD, ch.distanceTo(ear));
  if (M.t - M.whAt > 3.2) { M.whGo = false; if (jadrija.petTouch) jadrija.petTouch(0); rvbHoldGo(M); }
}

/** AWAY: across the room, and a wait; then back to you. */
function rvbAway(M, tt, dt) {
  if (!M.awGo) {
    M.awGo = true; M.awAt = null;
    const r = jadrija.rideFrom();
    let best = null;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = 1.8 + Math.random() * 1.6;
      const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
      const [qx, qz] = ground.confine ? ground.confine(x, z, rev.ch.y) : [x, z];
      if (Math.hypot(qx - x, qz - z) > 0.02 || !jadrija.kabina.room(x, z, 0.35)) continue;
      if (!best || d > best.d) best = { x, z, d };
    }
    if (!best) { M.awGo = false; rvbHoldGo(M); return; }
    M.aways++;
    revGo(best.x, best.z);
    rev.ch.face = null;
    rvbSay('bind_away', true);
    const af = M.mood.awayFor;
    M.awFor = af[0] + Math.random() * (af[1] - af[0]);
  }
  if (!revAt() && tt < 9) return;
  if (!M.awAt) { M.awAt = M.t; rev.ch.face = revBone('pelvis', new THREE.Vector3()); }
  if (M.t - M.awAt < M.awFor) return;
  // Back: to you, close.
  M.awGo = false;
  const Hd = rvmYourHead();
  if (Hd) {
    const P = rvmPlan([{ s: 'R', T: Hd.C.clone().addScaledVector(Hd.up, -0.2), n: Hd.fw.clone() }], { ring: [0.45, 0.55, 0.65] });
    if (P) rvmGoPlan(P);
  }
  rvbHoldGo(M);
  M.nextAct = M.tHold + 3.0;
  M.backSayAt = rev.clock + 1.6;
}

// ── your struggle, and her answer ────────────────────────────────────────────

/**
 * You struggle: W or S (or walking, or an ask your arms cannot do) while you
 * are tied — your wrists pull at the rope and come back, your view jolts.
 * Answers true when it was a struggle.
 */
function rvbStruggle(src = 'you') {
  const M = rvb.M;
  if (!M || !M.kind || M.safe || M.armK < 0.5 || !/^(tie|tug|hold|check|whisper|away|blindon)$/.test(M.ph)) return false;
  if (M.sqT >= 0 || rev.clock - (M.sqLast || -9) < RVB.sqCool) return true;
  M.sqT = 0; M.squirms++; M.sqLast = rev.clock;
  (M.sqLog = M.sqLog || []).push([+M.clk.toFixed(1), src, M.ph]);
  if (src === 'you') rev.dom.moved += 1;
  rev.jolt = Math.min(1.4, rev.jolt + 0.3);
  return true;
}
function rvbSquirmTick(M, dt) {
  // Now and then on your own, unless she is gentle with you.
  if (M.ph === 'hold' && M.sqT < 0 && M.mood) {
    M.ownAt = M.ownAt || M.clk + 10 + Math.random() * 8;
    if (M.clk > M.ownAt) { M.ownAt = M.clk + 11 + Math.random() * 9 + 10 * M.mood.g; if (M.mood.g < 0.55) rvbStruggle('own'); }
  }
  if (M.sqT < 0) { M.sqUp = 0; return; }
  M.sqT += dt;
  const T = RVB.sqT;
  // Two pulls: a hard one and a smaller.
  const u = M.sqT / T;
  M.sqUp = u < 0.5 ? RVB.sqAmp * Math.sin(Math.PI * u / 0.5) : RVB.sqAmp * 0.55 * Math.sin(Math.PI * (u - 0.5) / 0.5);
  if (M.sqT > T * 0.6 && !M.sqHeard) {
    M.sqHeard = true;
    rvbSquirmAnswer(M);
  }
  if (M.sqT > T) { M.sqT = -1; M.sqUp = 0; M.sqHeard = false; }
}
/** Her answer: a word, and — stern — a spank (where she can) and longer; excited, her remote; warm, a soft word. */
function rvbSquirmAnswer(M) {
  const m = M.mood || rvbMood();
  rvbSay('bind_squirm', true);
  if (m.s > 0.45) M.extra = (M.extra || 0) + 3 + 5 * m.s;
  const free = !(typeof rvm !== 'undefined' && rvm.move) && rev.arm.mode !== 'spank';
  if (M.ph === 'hold' && free && Math.random() < m.spankSq) {
    const v = revView();
    if (v && (v.ctx === 'front' || v.ctx === 'stand' || v.ctx === 'kneel')) {
      rvbSpank(M, typeof rmoodSpanks === 'function' ? rmoodSpanks(2, true) : 3, 'you struggled');
      return;
    }
  }
  if (M.ph === 'hold' && m.e > 0.4) {
    const toys = typeof revToys === 'function' ? revToys() : [];
    if (toys.length && jadrija.remote) { jadrija.remote(toys[0], true, 3, Math.min(1, 0.5 + 0.4 * m.e)); M.remotes++; }
  }
}

/** Your own ask while tied (`revAsk`): your arms cannot — a struggle; the rest after she unties you, or not at all. */
function rvbYourAsk(name) {
  const M = rvb.M;
  if (!M || !M.kind || M.armK < 0.3 || /^(free|stow|done)$/.test(M.ph)) return false;
  // Kneeling or standing with your hands behind you: you may go up and down.
  if (M.kind === 'back' && (name === 'rise' || name === 'submit')) return false;
  rvbStruggle('you');
  rvbTrace({ pick: 'you:' + name, why: 'tied — you pull at the ' + (M.how === 'belt' ? 'belt' : 'rope') });
  if (typeof toast === 'function') toast(name + ': tied — you pull at the ' + (M.how === 'belt' ? 'belt' : 'rope'));
  return true;
}

// ── the end of it ────────────────────────────────────────────────────────────

/** Done: the tie off you, the move over, her aftercare beat. */
function rvbEnd(M, why) {
  if (M.done) return;
  M.done = true;
  M.outWhy = M.outWhy || why;
  rvbRelease(M);
  M.tieU = 0; M.armK = 0; M.bandK = 0; M.darkK = 0; M.carry = false;
  if (typeof rvhUnaim === 'function') rvhUnaim();
  if (rvb.coil && rvb.coil.inHand) rvbCoilDrop();
  if (M.how === 'belt' && typeof rvk !== 'undefined' && rvk.belt.ph === 'bound') { rvk.belt.ph = 'off'; if (you && you.belt) you.belt(1); }
  M.timing.done = +rev.clock.toFixed(2);
  rvb.stats = rvbSummary(M);
  rvb.all.push(rvb.stats);
  if (rvb.all.length > 20) rvb.all.shift();
  rvb.M = null;
  rvbDraw(null, 0);
  rvbTrace({ pick: 'bind end', why: M.outWhy, held: rvb.stats.held, squirms: M.squirms, spanks: M.spanks });
  // The aftercare beat: her hand in your hair and a soft word (not after the safeword: that is the safeword's own).
  if (!M.safe && why === 'done' && rev.on && !rev.care) {
    rvbSay('bind_care', true);
    const r = typeof rvmStart === 'function' ? rvmStart('stroke', 'bind aftercare') : 'none';
    M.care = r === true;
    if (rvb.stats) rvb.stats.care = r === true ? 'stroke' : 'line (' + r + ')';
  }
  if (rev.dom && !rev.care) rev.dom.next = Math.max(rev.dom.next, rev.clock + 5);
}

/** The rope's coil out of her hand on to what is under it: the floor, or the mattress. */
function rvbCoilDrop() {
  const C = rvb.coil;
  if (!C) return;
  const pm = typeof rvmPalm === 'function' ? rvmPalm('R', new THREE.Vector3()) : null;
  const at = pm || new THREE.Vector3(rev.ch.x, rev.ch.y, rev.ch.z);
  let y = rev.ch.y + 0.002;
  const Mt = typeof rvsMattress === 'function' ? rvsMattress() : null;
  if (Mt) {
    const dx = at.x - Mt.mid.x, dz = at.z - Mt.mid.z;
    if (Math.abs(dx * Mt.out.x + dz * Mt.out.z) < Mt.half - 0.08 && Math.abs(dx * Mt.ax.x + dz * Mt.ax.z) < Mt.len - 0.08) y = Mt.top + 0.002;
  }
  C.inHand = false; C.hidden = false;
  C.at = new THREE.Vector3(at.x, y, at.z);
  // Not inside a wall.
  if (jadrija.kabina && !jadrija.kabina.room(C.at.x, C.at.z, 0.10)) {
    const r = jadrija.rideFrom();
    if (r) C.at.set(r.x * 0.5 + at.x * 0.5, rev.ch.y + 0.002, r.z * 0.5 + at.z * 0.5);
  }
}

/**
 * THE SAFEWORD (from `revSafe`, before her belt's own): on this frame the tie
 * is off you — the rope or the belt drops loose where your wrists were — the
 * blindfold is off and the dark with it, your arms are yours, and her
 * aftercare follows (49-reverse.js's). Her remote is the toys' (`rvtSafe`).
 */
function rvbSafe() {
  rvb.after = null;
  const M = rvb.M;
  if (!M || M.done) return false;
  M.safe = { t: rev.clock, frame: rvb.frame, ph: M.ph };
  // What was on, for the record: and then all of it off, this frame.
  const wasTied = M.tieU > 0.01, wasBlind = M.bandK > 0.01;
  // The rope: dropped loose on what is under your wrists.
  if (wasTied && M.how !== 'belt' && rvb.coil && M.path && M.path.Bn) {
    rvb.coil.inHand = false; rvb.coil.hidden = false;
    const P = M.path.Bn.C;
    rvb.coil.at = new THREE.Vector3(P.x, P.y, P.z);
    const Mt = rvsMattress();
    if (Mt) {
      const dx = P.x - Mt.mid.x, dz = P.z - Mt.mid.z;
      const on = Math.abs(dx * Mt.out.x + dz * Mt.out.z) < Mt.half && Math.abs(dx * Mt.ax.x + dz * Mt.ax.z) < Mt.len;
      rvb.coil.at.y = on ? Mt.top + 0.002 : rev.ch.y + 0.002;
    }
    if (!jadrija.kabina.room(rvb.coil.at.x, rvb.coil.at.z, 0.12)) rvb.coil.at.set(rev.ch.x, rev.ch.y + 0.002, rev.ch.z);
  }
  if (M.how === 'belt' && typeof rvk !== 'undefined' && rvk.belt.ph === 'bound') rvk.belt.ph = 'off';
  M.tieU = 0; M.armK = 0; M.bandK = 0; M.darkK = 0; M.carry = false; M.sqUp = 0; M.tugK = 0;
  if (typeof rvhUnaim === 'function') rvhUnaim();
  if (rvb.coil && rvb.coil.inHand) rvbCoilDrop();
  M.outWhy = 'safeword';
  M.safe.was = { tied: wasTied, blind: wasBlind };
  rvbDraw(M, 0);
  rvb.safeChk = { M, t: rev.clock, frame: rvb.frame, n: 0 };
  rvbEnd(M, 'safeword');
  return true;
}
/** The safeword's frame, counted: rope, band and dark off, your arms yours, the remote off. */
function rvbSafeCheck() {
  const K = rvb.safeChk;
  if (!K) return;
  const rope = !!(rvb.rope && rvb.rope.mesh.visible) || !!(rvb.belt && rvb.belt.mesh.visible);
  const band = !!(rvb.band && rvb.band.mesh.visible);
  const dark = rvb.darkK > 0.001;
  const lv = jadrija && jadrija.remote ? (revToys() || []).map((k) => jadrija.remote(k)) : [];
  const buzz = lv.some((x) => x && (x === true || x.on || x.level > 0 || x > 0));
  const S = K.M.safe;
  S.check = S.check || [];
  S.check.push({ frame: rvb.frame - K.frame, rope, band, dark, buzz });
  if (++K.n >= 3) { if (rvb.stats && rvb.stats.safe) rvb.stats.safe = Object.assign({}, S); rvb.safeChk = null; }
}

/** Swapped back or left: everything off, now, and her belt back on her. */
function rvbClear() {
  const M = rvb.M;
  if (M) { M.outWhy = M.outWhy || 'cleared'; M.done = true; rvb.stats = rvbSummary(M); }
  rvb.M = null; rvb.after = null; rvb.safeChk = null;
  if (typeof rvk !== 'undefined' && rvk.belt.ph === 'bound') rvk.belt.ph = 'off';
  if (you && you.belt && M && M.how === 'belt') you.belt(1);
  if (rvb.coil && rvb.coil.inHand) { rvb.coil.inHand = false; rvb.coil.at = rvb.coil.home ? rvb.coil.home.clone() : null; rvb.coil.onShelf = true; }
  if (typeof rvhUnaim === 'function') rvhUnaim();
  rvbDraw(null, 0);
  if (rvb.dark) { rvb.dark.style.opacity = '0'; rvb.dark.hidden = true; rvb.darkWas = 0; }
  if (typeof audio !== 'undefined' && audio && audio.voiceSpace) audio.voiceSpace(0, 1);
}

/** Whether her other choices wait: tied, or the blindfold on (`revDecide`). */
function rvbHolds() { return !!(rvb.M && !rvb.M.done); }

// ── measured ─────────────────────────────────────────────────────────────────

/**
 * Every `every` s while you are tied: the rope against your wrists' skin (the
 * coils' points, their surface against the nearest skin of your forearms and
 * hands — inside counted at 1.5 mm), your wrists against where the tie holds
 * them, your skin against the cot's frame and mattress, the walls and the
 * hook, the band against your head, and her skin against yours.
 */
function rvbMeasure(M) {
  if (!M.path) return;
  const Mm = M.meas;
  // Your arms and hands (the rope), your trunk, head and legs (what they must not go into).
  const AH = rvbSkinSub({ 2: 1, 3: 1, 4: 1, 5: 1 }), BODY = rvbSkinSub({ 0: 1, 1: 1, 6: 1 });
  if (!AH || !BODY) return;
  rvbHash(AH);
  const A = { n: AH.n + BODY.n, p: new Float32Array(3 * (AH.n + BODY.n)), nr: new Float32Array(3 * (AH.n + BODY.n)), reg: new Uint8Array(AH.n + BODY.n) };
  A.p.set(AH.p); A.p.set(BODY.p, 3 * AH.n); A.nr.set(AH.nr); A.nr.set(BODY.nr, 3 * AH.n); A.reg.set(AH.reg); A.reg.set(BODY.reg, AH.n);
  const belt = M.how === 'belt';
  const turns = belt ? RVB.beltTurns : RVB.coilTurns, per = 30;
  const rr = belt ? BELT.thick * 0.5 : RVB.ropeR;
  // THE COILS ON YOUR SKIN, as drawn this frame: every vertex of your forearms
  // and hands in each turn's slice, against the rope's inner surface at its
  // angle about the bundle — positive, the rope is off your skin by that
  // much; negative, your skin is through the rope. Per angle the nearest, and
  // of those the least (the deepest) and the middle (how snug it sits).
  void per;
  const Hh = M.hull, Bn = M.path.Bn;
  let mn = 9, inN = 0;
  const ds = [];
  if (Hh && Bn) {
    const pitch = belt ? RVB.beltPitch : RVB.coilPitch, rOff = rr + RVB.coilClear;
    for (const row of Hh.rows) {
      const bins = new Float32Array(Hh.K).fill(9);
      for (let i = 0; i < AH.n; i++) {
        const dx = AH.p[3 * i] - Bn.C.x, dy = AH.p[3 * i + 1] - Bn.C.y, dz = AH.p[3 * i + 2] - Bn.C.z;
        const al = dx * Bn.a.x + dy * Bn.a.y + dz * Bn.a.z;
        if (Math.abs(al - row.off) > pitch * 0.5) continue;
        const pu = dx * Bn.u.x + dy * Bn.u.y + dz * Bn.u.z - row.c[0], pv = dx * Bn.v.x + dy * Bn.v.y + dz * Bn.v.z - row.c[1];
        const r = Math.hypot(pu, pv);
        if (r > 0.09) continue;      // the hull's own reach (the hands beyond it are not under the rope)
        let th = Math.atan2(pv, pu); if (th < 0) th += Math.PI * 2;
        const x = th / (Math.PI * 2) * Hh.K, i0 = Math.floor(x) % Hh.K, f = x - Math.floor(x);
        const R = row.R[i0] * (1 - f) + row.R[(i0 + 1) % Hh.K] * f;
        const gap = (R - rOff + RVB.coilClear) - r;
        bins[i0] = Math.min(bins[i0], gap);
        mn = Math.min(mn, gap);
        if (gap < -0.0015) inN++;
      }
      for (const b of bins) if (b < 8) ds.push(b);
    }
  }
  ds.sort((a, b) => a - b);
  if (ds.length) Mm.rope.push([+M.clk.toFixed(2), +(mn * 1000).toFixed(1), +(ds[Math.floor(ds.length / 2)] * 1000).toFixed(1), inN, M.ph]);
  if (Mm.rope.length > 400) Mm.rope.shift();
  Mm.ropeIn = Math.max(Mm.ropeIn, inN);
  // Your wrists against the tie's place (the struggle and the tug left out).
  if (M.goal && !(M.sqUp > 0.001) && !M.tugK) {
    const F = rvbForearms();
    if (F) Mm.held.push([+M.clk.toFixed(2), +(F.L.W.distanceTo(M.goal.L.W) * 1000).toFixed(1), +(F.R.W.distanceTo(M.goal.R.W) * 1000).toFixed(1), M.ph]);
    if (Mm.held.length > 400) Mm.held.shift();
  }
  // The tether: from the coils to the anchor, how long.
  // Your arms and hands against your own trunk and head (behind your back, over your head).
  const arms = { n: 0, p: [], nr: [], reg: [] };
  const Bx = rvbBodyAx();
  const farSh = (i) => !Bx || Math.min(Math.hypot(A.p[3 * i] - Bx.SL.x, A.p[3 * i + 1] - Bx.SL.y, A.p[3 * i + 2] - Bx.SL.z),
    Math.hypot(A.p[3 * i] - Bx.SR.x, A.p[3 * i + 1] - Bx.SR.y, A.p[3 * i + 2] - Bx.SR.z)) > 0.14;
  for (let i = 0; i < A.n; i++) if (A.reg[i] >= 2 && A.reg[i] <= 5 && farSh(i)) { arms.p.push(A.p[3 * i], A.p[3 * i + 1], A.p[3 * i + 2]); arms.nr.push(A.nr[3 * i], A.nr[3 * i + 1], A.nr[3 * i + 2]); arms.reg.push(A.reg[i]); arms.n++; }
  const Bsk = { n: arms.n, p: Float32Array.from(arms.p), nr: Float32Array.from(arms.nr), reg: Uint8Array.from(arms.reg) };
  const Ra = rvsGap({ A, B: Bsk, only: { 0: 1, 1: 1, 6: 1 } });
  if (Ra) { const g = Math.min(Ra.all.d, Ra.all.s); if (g < Mm.arm.min) { Mm.arm.min = g; Mm.arm.at = M.ph; } Mm.arm.inN = Math.max(Mm.arm.inN, Ra.all.inN); }
  // The room: your skin past a wall; your arms and hands inside the cot's frame or mattress; and the hook.
  const K = jadrija.kabina, Mt = rvsMattress(), kb = rvbKab();
  let cotIn = 0, cotD = 0, hookD = 9;
  for (let i = 0; i < A.n; i++) {
    const x = A.p[3 * i], y = A.p[3 * i + 1], z = A.p[3 * i + 2];
    if (i % 3 === 0 && !K.room(x, z, -0.01)) { Mm.wall++; let dd = 0.01; while (dd < 0.3 && !K.room(x, z, -dd - 0.01)) dd += 0.01; if (dd > Mm.wallD) { Mm.wallD = dd; Mm.wallAt = RVS_REG[A.reg[i]] + ' @' + M.ph; } }
    if (A.reg[i] < 2 || A.reg[i] > 5) continue;
    if (Mt) {
      const dx = x - Mt.mid.x, dz = z - Mt.mid.z;
      const ac = Math.abs(dx * Mt.out.x + dz * Mt.out.z), al = Math.abs(dx * Mt.ax.x + dz * Mt.ax.z);
      // The mattress (to its top) and the frame's end rail beyond it.
      if (ac < Mt.half - 0.005 && al < Mt.len - 0.005 && y < Mt.top - 0.012) { cotIn++; cotD = Math.max(cotD, Mt.top - y); }
      if (ac < 0.35 && al > RVB.railIn && al < RVB.railOut && y < Mt.top + RVB.railTop && y > Mt.top + RVB.railBot) { cotIn++; cotD = Math.max(cotD, 0.01); }
    }
    if (kb && M.kind === 'hook') hookD = Math.min(hookD, Math.hypot(x - kb.hook.bar.x, y - kb.hook.bar.y, z - kb.hook.bar.z) - kb.hook.barR);
  }
  Mm.cot = Math.max(Mm.cot, cotIn); Mm.cotD = Math.max(Mm.cotD || 0, cotD);
  Mm.hookD = Math.min(Mm.hookD, hookD);
  // Her against you (her hands and arms left out — they are on you on purpose).
  const Bc = M.clk - (M.gapAt || -9) > 0.75 ? rvsChloeSkin(3) : null;
  if (Bc) M.gapAt = M.clk;
  if (Bc) {
    const Rg = rvsGap({ A, B: Bc, skip: { 2: 1, 3: 1, 4: 1, 5: 1 } });
    if (Rg) {
      const g = Math.min(Rg.all.d, Rg.all.s);
      // (Her spanks, the existing swing of 1.565.0, are counted apart: `gapSpank`.)
      if (rev.arm.mode === 'spank') { Mm.gapSpank = Math.min(Mm.gapSpank == null ? 9 : Mm.gapSpank, g); }
      else if (g < Mm.gap.min) {
        let who = null;
        for (const [k, r] of Object.entries(Rg.by)) if (Math.min(r.d, r.s) <= g + 1e-4) who = k + '>' + (r.sher || r.her);
        Mm.gap.min = g; Mm.gap.at = M.ph; Mm.gap.inN = Rg.all.inN; Mm.gap.who = who;
      }
    }
  }
  // The band on your head.
  if (M.bandK > 0.99 && rvb.band) rvbBandMeasure(M, null);
}
/** The band's inner surface against your head's skin, now (mm; negative inside). */
function rvbBandMeasure(M, A) {
  const b = rvb.band;
  if (!b || !b.mesh.visible) return null;
  const g = b.mesh.geometry, pos = g.getAttribute('position');
  b.mesh.updateMatrixWorld();
  const mw = b.mesh.matrix;
  const n = b.rows.length * b.K;   // the inner skin's vertices come first
  const H = rvbHash(rvbSkinSub({ 1: 1 }));
  let mn = 9, inN = 0;
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i += 2) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mw);
    const N = rvbNear(H, p);
    if (!N) continue;
    const side = (p.x - N.p.x) * N.n.x + (p.y - N.p.y) * N.n.y + (p.z - N.p.z) * N.n.z;
    const d = side < 0 ? -N.d : N.d;
    mn = Math.min(mn, d);
    if (d < -0.0015) inN++;
  }
  const R = M.meas.band;
  R.min = Math.min(R.min, mn); R.inN = Math.max(R.inN, inN);
  R.last = +(mn * 1000).toFixed(1);
  return { min: +(mn * 1000).toFixed(1), inN };
}

/** What one tie measured — `__fr.reverse.bind.last()`. */
function rvbSummary(M) {
  const st = (a, i) => {
    const L = a.map((r) => r[i]).filter((x) => x != null).sort((x, y) => x - y);
    if (!L.length) return null;
    return { n: L.length, min: L[0], med: L[Math.floor(L.length / 2)], p90: L[Math.min(L.length - 1, Math.floor(L.length * 0.9))], max: L[L.length - 1] };
  };
  const Mm = M.meas, m0 = M.mood0;
  return { kind: M.kind, how: M.how, blind: !!M.timing.blind, why: M.why, out: M.outWhy || null, tone: m0.tone,
    stern: +m0.s.toFixed(2), excite: +m0.e.toFixed(2), gentle: +m0.g.toFixed(2),
    planned: +M.holdFor.toFixed(1), held: +(M.tHold || 0).toFixed(1), extra: +(M.extra || 0).toFixed(1), tight: +(M.tight || 0).toFixed(2),
    acts: M.acts, checks: M.checksDone, rounds: M.roundsDone, squirms: M.squirms, sq: M.sqLog || [], aways: M.aways, whispers: M.whispers,
    earMin: M.earD != null ? +(M.earD * 1000).toFixed(0) : null, remotes: M.remotes, toys: M.toys, praises: M.praises, strokes: M.strokes,
    steps: M.steps || 0, timing: M.timing,
    ropeMin: st(Mm.rope, 1), ropeMed: st(Mm.rope, 2), ropeIn: Mm.ropeIn, heldL: st(Mm.held, 1), heldR: st(Mm.held, 2),
    armSelf: Mm.arm.min < 9 ? { min: +(Mm.arm.min * 1000).toFixed(1), inN: Mm.arm.inN, at: Mm.arm.at } : null,
    cot: Mm.cot, cotD: Mm.cotD ? +(Mm.cotD * 1000).toFixed(0) : 0, wall: Mm.wall, wallD: +(Mm.wallD * 1000).toFixed(0), wallAt: Mm.wallAt || null,
    hookD: Mm.hookD < 9 ? +(Mm.hookD * 1000).toFixed(1) : null,
    gap: Mm.gap.min < 9 ? { min: +(Mm.gap.min * 1000).toFixed(1), at: Mm.gap.at, inN: Mm.gap.inN, who: Mm.gap.who || null } : null,
    gapSpank: Mm.gapSpank != null ? +(Mm.gapSpank * 1000).toFixed(1) : null,
    band: Mm.band.min < 9 ? { min: +(Mm.band.min * 1000).toFixed(1), inN: Mm.band.inN } : null,
    headClear: M.headClear != null ? +(M.headClear * 1000).toFixed(0) : null, safe: M.safe || null, care: null };
}

// ── the rest ─────────────────────────────────────────────────────────────────

/** The scene block's part (`revScene`): how you are tied, and whether you can see. */
function rvbScene(o) {
  const M = rvb.M;
  if (!M || M.done) return;
  if (M.kind && M.tieU > 0.5) o.rev_bound = M.kind;
  if (M.bandK > 0.5) o.rev_blind = true;
}

/**
 * Her lines into the tables (`REV_SAY` the beat's own, RMOOD_SAY its tones)
 * and `__fr.reverse.bind` — once the script has run: this file sorts BEFORE
 * 49-reverse.js and 49-revmood.js ("revb" < "reve"), and their tables are
 * `const`s, which even `typeof` may not touch before they are made.
 */
function rvbInstall() {
  if (rvb.installed) return;
  rvb.installed = true;
  if (typeof REV_SAY !== 'undefined') Object.assign(REV_SAY, RVB_SAY);
  if (typeof RMOOD_SAY !== 'undefined') {
    Object.assign(RMOOD_SAY, RVB_MOOD_SAY);
    if (RMOOD_SAY.beg) Object.assign(RMOOD_SAY.beg, RVB_BEG_SAY);
  }
  if (typeof revApi !== 'undefined') revApi.bind = rvbApi;
}
setTimeout(rvbInstall, 0);

// The help sheet, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.revbind': 'roles reversed: Shift+\\ or "tie me up" / "tie my hands" / "tie me to the cot" — Chloe ties your wrists, with a rope off the shelf or her belt: to the cot\'s end rail over your head (lying down), behind your back (standing or kneeling), or to the hook on the wall (standing). Shift+= or "blindfold me" / "cover my eyes" — a blindfold, and you hear where she is. Left tied she walks away, checks the knots, teases, whispers; W or S struggles. "untie me" asks; "red" ends it at once',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.revbind': 'zamijenjene uloge: Shift+\\ ili "zaveži me", "veži mi ruke" — Chloe ti veže zapešća, užetom s police ili svojim remenom: za krevet iznad glave (ležeći), iza leđa (stojeći ili klečeći) ili za kuku na zidu (stojeći). Shift+= ili "poveži mi oči" — povez preko očiju, i čuješ gdje je. Dok si vezana odlazi, provjerava čvorove, zadirkuje, šapće; W ili S — otimaš se. "odveži me" moli; "crvena" odmah završava',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.revbind': 'rôles inversés : Maj+\\ ou « attache-moi » — Chloe vous attache les poignets, avec une corde de l’étagère ou sa ceinture : au bout du lit au-dessus de la tête (allongée), dans le dos (debout ou à genoux), ou au crochet du mur (debout). Maj+= ou « bande-moi les yeux » — un bandeau, et vous l’entendez où elle est. Attachée, elle s’éloigne, vérifie les nœuds, taquine, chuchote ; W ou S : vous tirez. « détache-moi » demande ; « rouge » arrête tout de suite',
  });
}

/** `__fr.reverse.bind` — see 49-reverse.js. */
const rvbApi = {
  ask: (what = 'bind', opts = []) => rvbAsk(what, [].concat(opts)),
  beg: (what = 'bind') => (typeof rmoodBeg === 'function' ? rmoodBeg(what) : null),
  start: (kind = null, o = {}) => rvbStart(kind, Object.assign({ why: 'probe' }, o)),
  untie: () => { const M = rvb.M; if (!M) return false; M.holdFor = 0; M.extra = 0; return true; },
  struggle: () => rvbStruggle('you'),
  /** Debug: her next choice now, or a given one ('check' 'away' 'whisper' 'tease' 'praise' 'stroke' 'remote' 'toy' 'spank' 'blind'). */
  act: (what) => { const M = rvb.M; if (!M || M.ph !== 'hold') return false; M.force = what || null; M.nextAct = 0; return true; },
  mood: () => rvbMood(),
  words: (t) => (typeof rmoodWords === 'function' ? rmoodWords(typeof _revNorm === 'function' ? _revNorm(t) : t) : null),
  tune: (o) => Object.assign(RVB, o || {}),
  measure: (on) => { if (on != null) rvb.measure = !!on; return rvb.measure; },
  kab: () => { const K = rvbKab(); if (!K) return null; const V = (p) => p && p.toArray().map((x) => +x.toFixed(3)); return { hook: V(K.hook.W), bar: V(K.hook.bar), n: V(K.hook.n), stand: V(K.hook.stand), yaw: +K.hook.yaw.toFixed(3), home: V(K.home), coil: rvb.coil ? { at: V(rvb.coil.at), inHand: rvb.coil.inHand } : null }; },
  state: () => {
    const M = rvb.M;
    if (!M) return { ph: null, after: rvb.after, last: rvb.stats ? rvb.stats.out : null };
    return { kind: M.kind, how: M.how, ph: M.ph, t: +(M.t - M.t0).toFixed(2), tieU: +M.tieU.toFixed(2), armK: +M.armK.toFixed(2), bandK: +M.bandK.toFixed(2),
      darkK: +(M.darkK || 0).toFixed(2), blind: M.blind, tHold: +M.tHold.toFixed(1), holdFor: +(M.holdFor + (M.extra || 0)).toFixed(1), tight: +(M.tight || 0).toFixed(2),
      squirms: M.squirms, checks: M.checksDone, aways: M.aways, rounds: M.roundsDone, acts: M.acts.slice(-5), sub: M.sub ? 'bind' : (rvm.move ? rvm.move.id : null),
      spank: rev.arm.mode, plan: rvm.plan || null, hear: rvb.hearNow || null,
      rope: M.meas.rope.slice(-1)[0] || null, held: M.meas.held.slice(-1)[0] || null, band: M.meas.band.last != null ? M.meas.band.last : null,
      want: M.want ? { L: M.want.L && M.want.L.toArray().map((x) => +x.toFixed(3)), R: M.want.R && M.want.R.toArray().map((x) => +x.toFixed(3)) } : null };
  },
  last: () => rvb.stats,
  all: () => rvb.all.slice(),
  /** Debug: the band on or off by hand (k 0..1), without a tie — for a look at the fit. */
  band: (k = 1) => { const b = rvbBandFit(); if (!b) return null; rvbBandPlace(k); const A = null; const M = { meas: { band: { min: 9, inN: 0 } } }; const r = k > 0.99 ? rvbBandMeasure(M, A) : null; return { n: b.n, rows: b.rows.map((r) => +r.h.toFixed(3)), eyeY: +b.eyeY.toFixed(3), fit: r }; },
  /** Debug: a camera on it — 'side', 'front', 'back', 'top', 'face', 'wrists', or null. */
  view: (which = 'side', d = 1.5, h = 0.25) => {
    if (!which) { rev.debugCam = null; return null; }
    const M = rvb.M;
    let T;
    if (which === 'face' || which === 'head') { const Hd = rvmYourHead(); if (!Hd) return null; T = Hd.C.clone(); }
    else if (which === 'wrists' && M && M.path) T = M.path.Bn.C.clone();
    else { const B = rvbBodyAx(); if (!B) return null; T = B.Pv.clone().lerp(B.Nk, 0.4); }
    const B = rvbBodyAx();
    const dirs = which === 'top' ? null : [B.rt, B.rt.clone().negate(), B.fw, B.fw.clone().negate(), B.rt.clone().add(B.fw).normalize(), B.rt.clone().sub(B.fw).normalize(),
      B.fw.clone().sub(B.rt).normalize(), B.fw.clone().add(B.rt).negate().normalize()];
    if (which === 'top') { rev.debugCam = [T.x + 0.05, T.y + 1.6, T.z + 0.05, T.x, T.y, T.z]; return rev.debugCam; }
    let order = dirs;
    if (which === 'front' || which === 'face') order = [B.fw, ...dirs];
    if (which === 'back') order = [B.fw.clone().negate(), ...dirs];
    for (const dir0 of order) {
      const dir = dir0.clone(); dir.y = 0; if (dir.lengthSq() < 1e-4) continue; dir.normalize();
      for (const k of [1, 0.8, 0.65, 0.5, 0.4]) {
        const c = T.clone().addScaledVector(dir, d * k);
        if (jadrija.kabina.room(c.x, c.z, 0.2) && (!ground.confine || Math.hypot(ground.confine(c.x, c.z, rev.ch.y)[0] - c.x, ground.confine(c.x, c.z, rev.ch.y)[1] - c.z) < 0.01)) { rev.debugCam = [c.x, T.y + h, c.z, T.x, T.y, T.z]; return rev.debugCam.map((x) => +x.toFixed(2)); }
      }
    }
    return null;
  },
};
