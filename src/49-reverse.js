// -----------------------------------------------------------------------------
// Roles reversed: you in Baye's body, Chloe giving the orders.
//
// Misha, 1 Oct 2026: *"if inside the kabine, using some command like 'reverse
// roles', and we would switch up and i (played by chloe), would sorta "turn
// into" baye, and baye into chloe, and she would ask me to do all things and
// spank me, in "autonomous" mode"*.
//
// Phase one: a first playable. Two adults, a game they both agreed to, a
// safeword that ends it at once. Everything here is the kabina's and nothing
// leaves it.
//
// THE SWAP. "reverse roles" / "switch roles" / "zamijenimo uloge" (typed in
// the page — `revWords`, matched in 49-ears.js before anything is sent — or
// said: `rev.swap` in the service). Only in the kabina, with Baye in it.
//
//   - YOU ARE IN HER BODY. The walker (`ground.you`) is moved to where she
//     stands and drives her: while she is standing (`dwell`) she is put where
//     the walker is and faces where it faces (`jadrija.ride`, which is her
//     `dwell` and nothing else — see `bayeRide` in 43-jadrija.js), with her
//     own walk off the walker's speed. Anything asked of her — the hotkeys
//     1-7, a typed or spoken ask — is hers as ever, through `askShow` and
//     1.559.3's direct roads; while she is in a pose the walker is pinned to
//     her and the mouse only looks.
//   - THE CAMERA is in her head: first person off her head bone, a hand's
//     width in front of her face along your line of sight, so her own face is
//     behind the near plane; B is the ground's own third person behind her.
//   - HER OWN MODE is off while you drive her (`autoOff`), and her own clock
//     of moves with it.
//
// CHLOE IS THE NPC. Her figure (49-you.js) is driven through `you.drive`
// from where you stood. She walks with a steer-and-slide against the room's
// own collider (`ground.confine`), turns to face, crouches by the cot the way
// you do (`crouchSolve`), and spanks with her right arm — measured: the hand
// is closed on the spot by feedback before the swing, so the strike lands
// where her hand was, and the slap is `buttSlap`'s path with her hand as its
// side (`cotSpank`, the mark, your reflex, the scene's record).
//
// SHE GIVES ORDERS (`domDecide`, the autonomous mode's selector turned
// round): every few seconds she scores what she could do where you are — an
// order that fits (`REV_ORDERS`), a round of spanks, the remote if you are
// wearing a toy, a walk round you — and picks one, weighted. An order is a
// line, a wait, and a check of your body against it: kept, she praises and
// warms up a little (more, firmer); ignored, she teases and you are spanked
// for it.
//
// THE RULES, which are not scored:
//   - the safeword ("red", "crvena", "stop") ends it at once: she stops, comes
//     to your head, her hand on your hair, a soft line, and the roles go back;
//   - "reverse roles" again swaps back; so does leaving the room, the ground,
//     or any skip key;
//   - never outside the kabina, never the belt or the collar (refused while
//     the swap is on, and the swap refused while either is).
// -----------------------------------------------------------------------------

const REV = {
  cam: { up: 0.075, fwd: 0.090, ahead: 0.10 },   // eye off the head bone; lens ahead of it, m
  yawRate: 9,           // 1/s her body turns to the walker's heading
  gap: [3.5, 7],        // s between Chloe's decisions
  orderWait: 10,        // s she gives you to obey
  hold: 0.7,            // s an order must be kept for to count
  still: 6,             // s "be still" lasts
  walk: 1.25,           // m/s Chloe's walk
  near: 1.25,           // m she stands off you, idling
  side: 0.60,           // m off your pelvis, beside the cot, to spank
  behind: 0.55,         // m behind you standing
  lineGap: 2.2,         // s between two of her lines
  keep: 120,            // decisions kept in the trace
  heatTau: 90, heatRest: 0.2,
  joltK: 0.03,          // m the camera drops at a slap
  // Standing, she comes round behind you: built (`revBehindFree`, `revSpot`)
  // and off in phase one — her wrist got to 8-19 cm of the cheek and from
  // the side it read as a hand on your hip. The cot is where she spanks.
  standSpank: false,
};

/**
 * Her lines: [Croatian, English gloss, French gloss]. Chloe is a confident,
 * teasing young woman; short, in the room, a laugh in some of them.
 */
const REV_SAY = {
  on: [['Sad sam ja ti... a ti si ja. Hehe.', "Now I'm you... and you're me. Hehe.", 'Maintenant je suis toi... et toi moi. Hihi.'],
    ['Moja si sad. Slušaj me.', "You're mine now. Listen to me.", "Tu es à moi maintenant. Écoute-moi."]],
  off: [['Dobro... vraćamo se.', 'Okay... back to us.', "D'accord... on redevient nous."]],
  good: [['Dobra cura.', 'Good girl.', 'Gentille fille.'],
    ['Tako je. Vidiš da možeš.', "That's it. See, you can.", "C'est ça. Tu vois que tu peux."],
    ['Mm, poslušna si danas.', "Mm, you're obedient today.", "Mm, tu es obéissante aujourd'hui."]],
  slow: [['Hm? Nisi me čula?', "Hm? Didn't you hear me?", "Hm ? Tu ne m'as pas entendue ?"],
    ['Prespora si, ljubavi.', 'Too slow, love.', 'Trop lente, chérie.'],
    ['E, sad ćeš dobiti po guzi.', "Right. Now you're getting spanked.", 'Bon. Maintenant tu vas avoir la fessée.']],
  spank: [['Ovo je za tebe.', "This one's for you.", 'Celle-là est pour toi.'],
    ['Broji.', 'Count.', 'Compte.'], ['Još jedna.', 'One more.', 'Encore une.'],
    ['Hehe. Crvena si već.', "Hehe. You're red already.", 'Hihi. Tu es déjà toute rouge.']],
  buzz: [['Da vidimo što ovo radi...', "Let's see what this does...", 'Voyons ce que ça fait...']],
  prowl: [['Mm... gledam te.', "Mm... I'm watching you.", 'Mm... je te regarde.']],
  care: [['Hej, hej... gotovo je. Tu sam.', "Hey, hey... it's over. I'm here.", "Hé, hé... c'est fini. Je suis là."],
    ['Bila si super. Dođi.', 'You were amazing. Come here.', 'Tu as été géniale. Viens.']],
};

/**
 * THE ORDERS. `ctx` where she gives it (the autonomous mode's `autoCtx`),
 * `ok(v, R)` whether your body keeps it now, `key` the hotkey that does it
 * (shown on the HUD), and the line.
 */
const REV_FRONT = { flatheld: 1, edgeHeld: 1 };
const REV_ORDERS = {
  cot: { ctx: { stand: 1, kneel: 1, fours: 1 }, w: 1.2, key: '2',
    ok: (v) => v.onBed && v.lying, say: ['Na krevet. Odmah.', 'On the cot. Now.', 'Sur le lit. Tout de suite.'] },
  front: { ctx: { back: 1.6, side: 1.3, sit: 1, cotKneel: 1, stand: 0.5 }, w: 1.0, key: '3',
    ok: (v) => v.onBed && REV_FRONT[v.phase], say: ['Na trbuh, curo.', 'On your tummy, girl.', 'Sur le ventre, ma belle.'] },
  back: { ctx: { front: 1, side: 1, sit: 0.6 }, w: 0.6, key: '7',
    ok: (v) => v.onBed && v.phase === 'cradle', say: ['Okreni se na leđa.', 'Roll onto your back.', 'Mets-toi sur le dos.'] },
  spread: { ctx: { front: 1, back: 1, stand: 0.5 }, w: 1.2, key: '5',
    ok: (v) => v.legsSp > 0.2 * Math.max(0.05, v.legsSpMax), say: ['Raširi noge. Više.', 'Spread your legs. More.', 'Écarte les jambes. Plus.'] },
  together: { ctx: { front: 1, back: 1 }, w: 0.6, key: '5',
    ok: (v) => v.legsSp < 0.05, say: ['Noge skupa.', 'Legs together.', 'Les jambes serrées.'] },
  armsOut: { ctx: { front: 1, back: 1, side: 0.4 }, w: 0.8, key: '6',
    ok: (v) => v.arms > 0.5, say: ['Ruke u stranu.', 'Arms out to the sides.', 'Les bras sur les côtés.'] },
  armsIn: { ctx: { front: 1, back: 1 }, w: 0.4, key: '6',
    ok: (v) => v.arms < 0.1, say: ['Ruke uz tijelo.', 'Arms by your sides.', 'Les bras le long du corps.'] },
  still: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1 }, w: 0.7, key: '',
    still: true, say: ['Ne miči se. Ni mrdnut.', "Don't move. Not a twitch.", 'Ne bouge pas. Pas un geste.'] },
  look: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, fours: 1 }, w: 0.8, key: 'mouse',
    ok: (v, R) => revLooking() || (v.gaze > 0 && v.gaze !== Infinity && !v.away), say: ['Pogledaj me.', 'Look at me.', 'Regarde-moi.'] },
  kneel: { ctx: { stand: 1 }, w: 0.8, key: '4',
    ok: (v) => v.phase === 'kept' || v.phase === 'bedKneel', say: ['Na koljena.', 'On your knees.', 'À genoux.'] },
  come: { ctx: { stand: 1 }, w: 0.6, key: 'WASD',
    ok: (v, R) => R.walk && revGap() < 1.3, say: ['Dođi ovamo.', 'Come here.', 'Viens ici.'] },
  turn: { ctx: { stand: 1 }, w: 0.6, key: 'mouse',
    ok: (v, R) => R.walk && revFacing() < -0.5, say: ['Okreni se. Leđima prema meni.', 'Turn around. Back to me.', 'Retourne-toi. Dos à moi.'] },
  stand: { ctx: { kneel: 1, fours: 1, sit: 0.3 }, w: 0.4, key: '1',
    ok: (v) => v.phase === 'dwell', say: ['Ustani.', 'Stand up.', 'Debout.'] },
};

// The help sheet and the HUD, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.reverse': 'in the kabina, say or type "reverse roles" — you are in Baye\'s body and Chloe gives the orders (and spanks). Do what she says: the keys below, or type it ("lie on the cot", "spread my legs"). "red" or "crvena" ends it at once; "reverse roles" again swaps back',
    'help.k.revkeys': 'roles reversed: 1 stand up · 2 lie on the cot · 3 on your front · 4 kneel · 5 legs apart / together · 6 arms out / in · 7 on your back. Look at her with the mouse; W gets you up; type the rest ("lotus", "on my side")',
    'rev.hud': 'ROLES REVERSED', 'rev.order': 'she wants',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.reverse': 'u kabini reci ili utipkaj "zamijenimo uloge" — ti si u Bayeinom tijelu, a Chloe zapovijeda (i udara). Radi što kaže: tipke ispod, ili utipkaj ("lezi na krevet", "raširi noge"). "crvena" odmah završava; "zamijenimo uloge" opet vraća',
    'help.k.revkeys': 'zamijenjene uloge: 1 ustani · 2 lezi na krevet · 3 na trbuh · 4 klekni · 5 noge raširi / skupi · 6 ruke u stranu / uz tijelo · 7 na leđa. Pogledaj je mišem; W te diže; ostalo utipkaj ("lotos", "na bok")',
    'rev.hud': 'ZAMIJENJENE ULOGE', 'rev.order': 'želi',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.reverse': 'dans la cabine, dites ou tapez « inverser les rôles » — vous êtes dans le corps de Baye et Chloe donne les ordres (et la fessée). Faites ce qu’elle dit : les touches ci-dessous, ou tapez-le (« sur le lit », « écarte les jambes »). « rouge » arrête tout de suite ; « inverser les rôles » à nouveau rend les rôles',
    'help.k.revkeys': 'rôles inversés : 1 debout · 2 sur le lit · 3 sur le ventre · 4 à genoux · 5 jambes écartées / serrées · 6 bras écartés / le long du corps · 7 sur le dos. Regardez-la à la souris ; W vous relève ; tapez le reste (« lotus », « sur le côté »)',
    'rev.hud': 'RÔLES INVERSÉS', 'rev.order': 'elle veut',
  });
}

// ── the state ────────────────────────────────────────────────────────────────

const rev = {
  on: false, clock: 0, why: null, startedAt: 0,
  walk: false, yaw: 0, riseAt: -1e9, wasPhase: null,
  // Chloe: walker-convention yaw (forward = (-sin, -cos)), her floor, her goal.
  ch: { x: 0, y: 0, z: 0, yaw: 0, sp: 0, goal: null, stuck: 0 },
  // Her right arm: `mode` null | 'spank' | 'care'; phase, clock; learned angle.
  arm: { mode: null, ph: 'idle', t: 0, A: 0.9, E: 0.3, w: 0, lift: 0, at: null, n: 0, k: 10, hit: null, side: 1, tgt: null, posed: false, err: 0 },
  // Her side of it: next decision, the order out, your record, her heat.
  dom: { on: true, next: 0, order: null, obey: 0, miss: 0, streak: 0, heat: REV.heatRest, punish: 0,
    lastLine: -1e9, last: [], moved: 0, stillFrom: null, decisions: 0 },
  care: null, jolt: 0, trace: [], hud: null, hudWas: '', slaps: 0, log: [],
};
const _rvA = new THREE.Vector3(), _rvB = new THREE.Vector3(), _rvQ = new THREE.Quaternion();
const _rvF = new THREE.Vector3(), _rvU = new THREE.Vector3(), _rvH = new THREE.Vector3();

function revActive() { return !!rev.on; }
/** Whether this file drives Chloe's figure (90-app.js's `poseSwimBody` stands back). */
function revOwnsYou() { return !!rev.on; }
/** The person Baye is with while the roles are reversed: Chloe. */
function revWho() { return rev.on ? { x: rev.ch.x, y: rev.ch.y, z: rev.ch.z } : null; }
function revScene() { return rev.on ? { roles: 'reversed' } : null; }

function revLang() { return typeof LANG !== 'undefined' ? LANG : 'en'; }
function revSay(kind, force = false, line = null) {
  const L = line ? [line] : REV_SAY[kind];
  if (!L || !L.length) return null;
  if (!force && rev.clock - rev.dom.lastLine < REV.lineGap) return null;
  const l = L[Math.floor(Math.random() * L.length)];
  rev.dom.lastLine = rev.clock;
  const g = revLang() === 'fr' ? l[2] : revLang() === 'hr' ? '' : l[1];
  if (typeof voice !== 'undefined' && voice && voice.sub) voice.sub('Chloe: ' + l[0], 3.2, g || '');
  rev.log.push([+rev.clock.toFixed(1), l[0]]);
  if (rev.log.length > 40) rev.log.shift();
  return l[0];
}
function revTrace(e) {
  e.t = +rev.clock.toFixed(1);
  rev.trace.push(e);
  if (rev.trace.length > REV.keep) rev.trace.shift();
}

// ── where everybody is ───────────────────────────────────────────────────────

/** Baye's view (`autoView`) and her context (`autoCtx`, 49-auto.js). */
function revView() {
  const v = jadrija && jadrija.autoView ? jadrija.autoView() : null;
  if (v) { v.ctx = typeof autoCtx === 'function' ? autoCtx(v) : null; }
  return v;
}
/** A bone of hers, world. */
function revBone(name, out) {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const i = f.boneIndex(name);
  if (i < 0) return null;
  f.mesh.updateMatrixWorld();
  return f.boneAt(i, out).applyMatrix4(f.mesh.matrixWorld);
}
/** Her head, world: the eye point and her head's forward. */
function revHead() {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const h = f.boneIndex('head');
  if (h < 0) return null;
  f.mesh.updateMatrixWorld();
  const p = f.boneAt(h, _rvH).applyMatrix4(f.mesh.matrixWorld);
  _rvQ.copy(f.mesh.quaternion).multiply(f.boneTurn(h, new THREE.Quaternion()));
  _rvF.set(1, 0, 0).applyQuaternion(_rvQ);
  _rvU.set(0, 1, 0).applyQuaternion(_rvQ);
  return { p, f: _rvF, u: _rvU,
    eye: _rvA.copy(p).addScaledVector(_rvU, REV.cam.up).addScaledVector(_rvF, REV.cam.fwd) };
}
/** Chloe's head, world (standing eye, or as she is crouched). */
function revChloeHead(out) {
  if (you && you.fig && you.mesh) {
    const i = you.fig.boneIndex('head');
    if (i >= 0) { you.mesh.updateMatrixWorld(); return you.fig.boneAt(i, out).applyMatrix4(you.mesh.matrixWorld); }
  }
  return out.set(rev.ch.x, rev.ch.y + 1.6, rev.ch.z);
}
/** Level metres from your body to Chloe. */
function revGap() {
  const r = jadrija.rideFrom ? jadrija.rideFrom() : null;
  return r ? Math.hypot(r.x - rev.ch.x, r.z - rev.ch.z) : 9;
}
/** Your facing against the way to Chloe, -1 (back to her) .. 1. */
function revFacing() {
  const r = jadrija.rideFrom ? jadrija.rideFrom() : null;
  if (!r) return 0;
  const dx = rev.ch.x - r.x, dz = rev.ch.z - r.z, d = Math.hypot(dx, dz) || 1;
  return (-Math.sin(r.yaw) * dx - Math.cos(r.yaw) * dz) / d;
}
/**
 * Whether you are looking at her: your line of sight (the walker's yaw and
 * pitch) from HER eye, on Chloe's face. Not the camera's: this is asked
 * before the camera is put in her head, when it is still at a standing
 * walker's eye — lying on the cot that is a metre over her, and a lens aimed
 * from her eye at Chloe's face looked over Chloe's head from there (two
 * "look at me" orders failed that way with the test player looking).
 */
function revLooking() {
  const H = revChloeHead(_rvB);
  const E = revHead();
  const o = E ? E.eye : camera.position;
  const Y = ground && ground.you;
  if (!Y) return false;
  const cp = Math.cos(Y.pitch);
  const dx = H.x - o.x, dy = H.y - o.y, dz = H.z - o.z, n = Math.hypot(dx, dy, dz) || 1;
  return (-Math.sin(Y.yaw) * cp * dx + Math.sin(Y.pitch) * dy - Math.cos(Y.yaw) * cp * dz) / n > 0.9;
}
/** In the kabina, and how far in: the walker's, or a point's. */
function revInKab(x, z) {
  const K = jadrija && jadrija.kabina;
  return !!(K && K.inside && K.inside(x, z) > 0.5);
}

// ── on and off ───────────────────────────────────────────────────────────────

/** Swap. Answers 'on' or why not. */
function revOn(src = 'typed') {
  if (rev.on) return 'already';
  if (typeof state === 'undefined' || state.phase !== 'ground' || !ground || !ground.ok || !jadrija || !you) return 'ground';
  const Y = ground.you;
  if (!revInKab(Y.x, Y.z)) return 'kabina';
  const v = revView();
  if (!v || !v.inKab) return 'nobaye';
  if (v.swim) return 'nobaye';
  if (v.leash || (typeof collarActive === 'function' && collarActive())) return 'collar';
  if (typeof beltActive === 'function' && beltActive()) return 'belt';
  const r = jadrija.rideFrom();
  if (!r) return 'nobaye';
  if (typeof autoActive === 'function' && autoActive()) autoOff('rev');
  // Chloe where you stood, facing where you faced, standing.
  Y.crouch = false;
  Object.assign(rev.ch, { x: Y.x, y: Y.y, z: Y.z, yaw: Y.yaw, sp: 0, goal: null, stuck: 0 });
  rev.on = true;
  rev.startedAt = rev.clock;
  rev.why = src;
  rev.care = null;
  rev.jolt = 0;
  rev.yaw = r.yaw;
  rev.wasPhase = v.phase;
  rev.ctxWas = undefined;
  rev.last = null;
  rev.walk = v.phase === 'dwell';
  Object.assign(rev.arm, { mode: null, ph: 'idle', t: 0, w: 0, lift: 0, n: 0, posed: false });
  Object.assign(rev.dom, { on: rev.dom.on, next: rev.clock + 3.0, order: null, obey: 0, miss: 0, streak: 0,
    heat: REV.heatRest, punish: 0, last: [], moved: 0, stillFrom: null });
  // You into her: the walker where she stands, looking where she looks.
  ground.put(r.x, r.z, r.yaw, 0, r.y);
  jadrija.ride({ x: Y.x, z: Y.z, yaw: r.yaw, sp: 0 });
  revDriveChloe(0);
  revTrace({ pick: 'SWAPPED', why: src, ctx: v.ctx, phase: v.phase });
  revSay('on', true);
  revHud();
  return 'on';
}

/** Swap back. `why` 'asked' | 'safe' | 'left'. */
function revOff(why = 'asked') {
  if (!rev.on) return 'not on';
  rev.on = false;
  if (jadrija && jadrija.ride) jadrija.ride(null);
  revArmClear();
  Object.assign(rev.arm, { mode: null, ph: "idle", t: 0, w: 0, lift: 0, bow: 0 });
  // You back into Chloe: where she is standing, facing where she faces.
  if (ground && ground.ok && state.phase === 'ground') {
    const C = rev.ch;
    // Facing her: you were just in there.
    const H = revBone('head', new THREE.Vector3());
    const yaw = H ? Math.atan2(-(H.x - C.x), -(H.z - C.z)) : C.yaw;
    const pitch = H ? Math.atan2(H.y - (C.y + 1.66), Math.max(0.3, Math.hypot(H.x - C.x, H.z - C.z))) : 0;
    ground.put(C.x, C.z, yaw, Math.max(-1.2, pitch), C.y);
  }
  if (jadrija && jadrija.petTouch) jadrija.petTouch(0);
  if (you) you.drive(null);
  rev.care = null;
  revTrace({ pick: 'SWAPPED BACK', why });
  if (why === 'asked') revSay('off', true);
  revHud();
  return 'off';
}

/** The safeword: she stops, comes to you, her hand in your hair — then back. */
function revSafe(who = 'you') {
  if (!rev.on) return 'not on';
  if (typeof audio !== 'undefined' && audio && audio.herHush) audio.herHush('safe');
  if (typeof sceneSafe === 'function') sceneSafe(who, 'rev');
  rev.dom.order = null;
  rev.care = { t: 0, said: false };
  revArmStop();
  revTrace({ pick: 'SAFEWORD', why: who });
  revHud();
  return 'stopped';
}

// ── the words ────────────────────────────────────────────────────────────────

const _revNorm = (text) => (typeof autoNorm === 'function' ? autoNorm(text)
  : String(text || '').toLowerCase().trim());

/**
 * The swap's words, and — while it is on — its safeword and your body's own
 * poses, the whole line. Answers 'rev.swap' | 'rev.off' | 'rev.safe' |
 * 'rev.ask:<name>' | 'rev.dom.on' / 'rev.dom.off' | null.
 */
function revWords(text) {
  let t = _revNorm(text);
  if (!t) return null;
  if (/^((let'?s |lets )?(reverse|switch|swap|change|flip) (the )?(roles|places)( please)?|roles? reversed?|reverse|role ?(swap|reversal)|(ajmo |hajde |ajde )?zamijeni(mo)? (se )?(uloge|mjesta)|zamjena uloga|obrnute uloge|obrni uloge|(on )?(inverse|echange)[rz]? (les )?roles|inversion des roles)$/.test(t)) {
    return rev.on ? 'rev.off' : 'rev.swap';
  }
  if (!rev.on) return null;
  if (/^((swap|switch|change) (us )?back|(back to )?normal( roles)?|roles? back|end (the )?(role )?swap|vrati(mo)? (nas|uloge)|vratimo se|remets? (les )?roles)$/.test(t)) return 'rev.off';
  if (typeof autoSafeword === 'function' ? autoSafeword(text) : /^(red|crvena|stop)$/.test(t)) return 'rev.safe';
  t = t.replace(/^(ok(ay)?|yes|da|dobro|oui|d'accord)( |$)/, '').replace(/ (for you|mistress|ma'?am|madam|chloe)$/, '').trim();
  const arms = /\b(arms?|ruke|bras)\b/.test(t);
  const v = revView();
  const front = v && REV_FRONT[v.phase];
  if (/^(stand( up)?|get up|on (my|your) feet|ustani( se)?|ustajem|digni se|debout|(je me )?leve)$/.test(t)) return 'rev.ask:rise';
  if (/^((i'?ll |i will )?(lie|lay|get)( down)? (on|onto) (the )?(cot|bed)|(on|onto) the (cot|bed)|lie down|(lezi|lezem|legni|legnem)( na krevet)?|na krevet|sur le lit|(je m'?allonge|allonge[- ]toi)( sur le lit)?)$/.test(t)) return 'rev.ask:recline.bed';
  if (/^((roll |get |lie |turn )?(over )?(on|onto) (my|your|the) (front|tummy|stomach|belly)|(okreni se |lezi )?na trbuh|sur le ventre)$/.test(t)) return 'rev.ask:flat';
  if (/^((roll |get |lie |turn )?(over )?(on|onto) (my|your|the) back|(okreni se |lezi )?na ledja|sur le dos)$/.test(t)) return front ? 'rev.ask:turn' : 'rev.ask:recline.bed';
  if (/^((get )?(down )?on (my|your) knees|kneel( down| up)?|klekni( se)?|klecim|na koljena|a genoux)$/.test(t)) return v && v.onBed ? 'rev.ask:sit.knees' : 'rev.ask:submit';
  if (/^(lotus|cross[- ]?legged|sit cross[- ]?legged|turski( sjed)?|en tailleur)$/.test(t)) return 'rev.ask:lotus';
  if (/^((on|onto) (my|your) side|na bok|sur le cote)$/.test(t)) return 'rev.ask:side.left';
  if (/^((get )?(down )?on (all|my|your) fours|(all )?fours|na sve (cetiri|4)|a quatre pattes)$/.test(t)) return 'rev.ask:fours';
  if (/^(sit( up)?|sjedni|sjedim|assis(e)?)$/.test(t)) return 'rev.ask:sit.bed';
  if (/^(curl up|sklupcaj se|en boule)$/.test(t)) return 'rev.ask:fetal';
  if (/^((i'?ll )?(spread|open) (my |your |the )?(legs|arms)( wide| apart| wider)?|legs (apart|open|wide)|spread( them)?|rasiri( noge| ruke)?|razmakni noge|ecarte( les jambes| les bras)?)$/.test(t)) return arms ? 'rev.ask:arms.wide' : 'rev.ask:legs.spread';
  if (/^((put |bring |close )?(my |your |the )?(legs|arms) (together|in|down|closed)|(close|shut) (my |your )?legs|together|skupi( noge| ruke)?|spoji noge|serre( les jambes)?)$/.test(t)) return arms ? 'rev.ask:arms.down' : 'rev.ask:legs.close';
  if (/^(arms (out|wide)( to the sides?)?|ruke u stranu|bras ecartes)$/.test(t)) return 'rev.ask:arms.wide';
  if (/^(arms (in|down)|ruke (uz tijelo|dolje)|bras le long du corps)$/.test(t)) return 'rev.ask:arms.down';
  if (/^(look at (her|chloe|you)|i'?m looking( at you)?|pogledaj je|gledam te|je te regarde)$/.test(t)) return 'rev.ask:look';
  if (/^(look down|eyes down|spusti pogled|baisse les yeux)$/.test(t)) return 'rev.ask:look.down';
  if (/^(turn( around| over)?|roll over|okreni se|retourne[- ]toi)$/.test(t)) return 'rev.ask:turn';
  return null;
}

/** Do a word. Answers { ok, label } for the ears' panel. */
function revAct(name) {
  if (name === 'rev.swap' || name === 'rev.on') {
    const r = revOn('typed');
    const lab = { on: 'roles reversed — you are Baye now, Chloe is in charge (1-7 your poses, "red" ends it)',
      already: 'the roles are already reversed', ground: 'only on foot', kabina: 'only in the kabina',
      nobaye: 'she has to be in the kabina with you', collar: 'not with the collar on her — take it off first',
      belt: 'not with your belt out — put it back first' }[r] || r;
    return { ok: r === 'on', label: 'roles: ' + lab };
  }
  if (name === 'rev.off') {
    const r = revOff('asked');
    return { ok: r === 'off', label: 'roles: ' + (r === 'off' ? 'swapped back — you are Chloe again' : 'they are not reversed') };
  }
  if (name === 'rev.safe') {
    const r = revSafe('you');
    return { ok: r === 'stopped', label: 'red — Chloe stops, comes to you, and the roles go back' };
  }
  if (name === 'rev.dom.off' || name === 'rev.dom.on') { rev.dom.on = name === 'rev.dom.on'; return { ok: true, label: 'chloe: ' + (rev.dom.on ? 'in charge' : 'waiting') }; }
  if (name.startsWith('rev.ask:')) {
    const a = name.slice(8);
    const got = revAsk(a);
    return { ok: got === true, label: 'you: ' + (got === true ? a : 'cannot — ' + got) };
  }
  return { ok: false, label: 'roles: ?' };
}

/** Your own body, asked: the same road as any ask of hers, done at once. */
function revAsk(name) {
  if (!rev.on || !jadrija || !jadrija.askShow) return 'off';
  if (rev.care) return 'aftercare';
  // A pose asked while the order is "be still" is a move.
  rev.dom.moved += 1;
  const r = jadrija.askShow(name, 'rev');
  // And on your way to doing what she said, she waits for it: the cot is a
  // walk and a lie-down, the kneel eleven seconds of going down (MEASURED:
  // "kneel" pressed at 2.9 s into the order, ignored at 10).
  const O = rev.dom.order;
  if (r === true && O && !O.ext) { O.ext = 1; O.t0 = Math.min(rev.clock, O.t0 + 9); }
  revTrace({ pick: 'you:' + name, why: r === true ? 'asked' : String(r) });
  return r;
}

/** The hotkeys, while the roles are reversed. Answers true when it took the key. */
function revKey(e) {
  if (!rev.on) return false;
  // The keys that put you somewhere else end it first, and then do their own thing.
  if (/^(Digit[089]|Numpad[089]|KeyV|KeyR|KeyO)$/.test(e.code)) { revOff('left'); return false; }
  // Your belt and the collar are Chloe's, and she is not using them yet.
  if (e.code === 'Backslash' || e.code === 'Equal') {
    e.preventDefault();
    if (typeof toast === 'function') toast('not while the roles are reversed');
    return true;
  }
  const m = /^(?:Digit|Numpad)([1-7])$/.exec(e.code);
  if (!m) return false;
  e.preventDefault();
  const v = revView();
  if (!v) return true;
  const n = +m[1];
  const front = REV_FRONT[v.phase];
  let a = null;
  if (n === 1) a = 'rise';
  else if (n === 2) a = 'recline.bed';
  else if (n === 3) a = 'flat';
  else if (n === 4) a = v.onBed ? 'sit.knees' : 'submit';
  else if (n === 5) a = v.legsSp > 0.05 ? 'legs.close' : 'legs.spread';
  else if (n === 6) a = v.arms > 0.1 ? 'arms.down' : 'arms.wide';
  // On your back: from your front it is the roll over; anywhere else, the cot.
  else if (n === 7) a = front ? 'turn' : 'recline.bed';
  const r = revAsk(a);
  if (r !== true && typeof toast === 'function') toast(a + ': ' + r);
  return true;
}

// ── Chloe, walking ───────────────────────────────────────────────────────────

/** Her goal: a point and a face-to point. */
function revGo(x, z, fx, fz) { rev.ch.goal = { x, z, fx, fz }; rev.ch.stuck = 0; }
function revAt() { return !rev.ch.goal; }

function revSteer(dt) {
  const C = rev.ch, G = C.goal;
  let want = 0;
  if (G) {
    const dx = G.x - C.x, dz = G.z - C.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { C.goal = null; }
    else {
      want = Math.min(REV.walk, d * 2.2);
      // Turned on to the way first, then walking.
      const yw = Math.atan2(-dx, -dz);
      let dy = yw - C.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      C.yaw += dy * (1 - Math.exp(-8 * dt));
      if (Math.abs(dy) > 1.2) want *= 0.2;
    }
  }
  C.sp += (want - C.sp) * (1 - Math.exp(-6 * dt));
  if (C.sp > 0.01) {
    const nx = C.x - Math.sin(C.yaw) * C.sp * dt, nz = C.z - Math.cos(C.yaw) * C.sp * dt;
    let [px, pz] = ground.confine ? ground.confine(nx, nz, C.y) : [nx, nz];
    // And not through your body.
    const r = jadrija.rideFrom ? jadrija.rideFrom() : null;
    if (r && rev.walk) {
      const ox = px - r.x, oz = pz - r.z, od = Math.hypot(ox, oz);
      if (od < 0.5 && od > 1e-4) { px = r.x + ox / od * 0.5; pz = r.z + oz / od * 0.5; }
    }
    const moved = Math.hypot(px - C.x, pz - C.z);
    C.stuck = G && moved < 0.3 * C.sp * dt ? C.stuck + dt : 0;
    if (G && C.stuck > 1.2) C.goal = null;     // as near as the room lets her
    C.x = px; C.z = pz;
  }
  // Arrived: face the point she was going to face.
  if (!C.goal && rev.ch.face) {
    const F = rev.ch.face;
    const yw = Math.atan2(-(F.x - C.x), -(F.z - C.z));
    let dy = yw - C.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    C.yaw += dy * (1 - Math.exp(-6 * dt));
  }
  if (ground.floorAt) {
    const y = ground.floorAt(C.x, C.z, C.y);
    if (Number.isFinite(y)) C.y = y;
  }
}

/** Put her figure where she is, her crouch and her arm on it. */
function revDriveChloe(dt) {
  if (!you || !you.drive) return;
  const C = rev.ch, A = rev.arm;
  let cr = null;
  if (A.w > 0.003 && typeof crouchSolve === 'function') {
    const st = you.fig.state;
    cr = crouchSolve(A.w, 'idle', st && st.curT ? st.curT : 0);
  }
  if (cr) {
    crouchAims(cr, 0, 0, 0, 0, 0);
    // And over further than a crouch bows, to reach across the cot.
    const bw = (A.bow || 0) * A.lift;
    if (bw > 0.003) {
      you.fig.aim('spine01', 0, 0, -1, cr.b * 0.45 + bw * 0.40);
      you.fig.aim('spine02', 0, 0, -1, cr.b * 0.33 + bw * 0.35);
      you.fig.aim('spine03', 0, 0, -1, cr.b * 0.22 + bw * 0.25);
    }
    const base = cr.b + CROUCH_YOU.arm * A.w;
    you.fig.aim('armUR', 0, 0, 1, base + A.A * A.lift);
    you.fig.aim('armLR', 0, 0, 1, CROUCH_YOU.elbow * A.w + A.E * A.lift);
    A.posed = true;
  } else if (A.posed) revArmClear();
  const cd = cr ? cr.drop : 0, cb = cr ? cr.back : 0;
  you.drive({
    at: [C.x + Math.sin(C.yaw) * cb, C.y - cd, C.z + Math.cos(C.yaw) * cb],
    yaw: C.yaw + Math.PI / 2, pitch: 0, seen: true, wet: false,
    clip: C.sp > 0.2 ? 'walk' : 'idle',
    speed: C.sp > 0.2 ? Math.min(2, Math.max(0.6, C.sp / 0.92)) : 1,
  });
}

function revArmClear() {
  const A = rev.arm;
  if (!you || !you.fig) return;
  if (A.posed && typeof CROUCH_BONES !== 'undefined') for (const b of CROUCH_BONES) you.fig.aim(b, 0, 0, 1, 0);
  A.posed = false;
  if (typeof crouchPosed !== 'undefined') crouchPosed = false;
}

// ── Chloe's hand ─────────────────────────────────────────────────────────────
//
// The swing. Down by the cot (the crouch, `w`), her hand laid on the spot
// and held there while the angle that puts it there is found by feedback
// (`aim`), up (`wind`), down on to it accelerating (`strike`), the slap on
// the frame it arrives, a moment on you (`hold`), and up off you (`lift`).
// Then the next of the round, or she stands.

const REV_ARM = { aim: 0.55, wind: 0.30, strike: 0.11, hold: 0.10, lift: 0.30, rise: 0.45,
  windA: 1.15, windE: 1.0, crouch: 0.85, maxAim: 2.0 };

/** Where on you she is going for, world, and the cot's `hit` for it. */
function revSpot(v) {
  const P = revBone('pelvis', new THREE.Vector3());
  if (!P) return null;
  if (v.ctx === 'stand') {
    const r = jadrija.rideFrom();
    const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
    const side = Math.random() < 0.5 ? 1 : -1;
    const B = jadrija.butt ? jadrija.butt() : null;
    const c = B && B.find((b) => b.side === side);
    const T = c ? new THREE.Vector3(c.x, c.y, c.z) : P.clone().add(new THREE.Vector3(-fx * 0.12, -0.05, -fz * 0.12));
    return { T, hit: null, side, from: [r.x - fx * REV.behind, r.z - fz * REV.behind], face: P };
  }
  // On the cot: beside you, level with your seat, on the side the room is.
  const hf = jadrija.headFrame ? jadrija.headFrame() : null;
  const ax = hf ? hf.ax : 1, az = hf ? hf.az : 0;
  const px = -az, pz = ax;
  let best = null;
  for (const sgn of [1, -1]) {
    const sx = P.x + px * REV.side * sgn, sz = P.z + pz * REV.side * sgn;
    const [cx, cz] = ground.confine ? ground.confine(sx, sz, rev.ch.y) : [sx, sz];
    const bad = Math.hypot(cx - sx, cz - sz) + (jadrija.kabina.room(cx, cz, 0.15) ? 0 : 5);
    const score = bad * 4 + 0.2 * Math.hypot(cx - rev.ch.x, cz - rev.ch.z);
    if (!best || score < best.score) best = { score, x: cx, z: cz };
  }
  // Aimed at your seat from her eye there, with a hand's width of play.
  const o = new THREE.Vector3(best.x, rev.ch.y + 1.25, best.z);
  const jit = (Math.random() - 0.35) * 0.16;
  const aim = P.clone().add(new THREE.Vector3(-ax * jit, 0.05, -az * jit));
  const d = aim.clone().sub(o);
  const hit = jadrija.cotAim ? jadrija.cotAim(o, d) : null;
  const ok = hit && !hit.miss;
  const T = ok ? new THREE.Vector3(hit.x, hit.y, hit.z) : P.clone().add(new THREE.Vector3(0, 0.08, 0));
  rev.spotDbg = { P: P.toArray().map((x) => +x.toFixed(2)), ax: +ax.toFixed(2), az: +az.toFixed(2), from: [+best.x.toFixed(2), +best.z.toFixed(2)], T: T.toArray().map((x) => +x.toFixed(2)), reg: ok ? hit.reg : null };
  // Square on to the cot, and not on to the spot: a hand reaches across a
  // bed from the side of it, and a body turned at a slant slides her along
  // the frame when she leans in (MEASURED, 0.46 m towards your head).
  const nx = P.x - best.x, nz = P.z - best.z, nl = Math.hypot(nx, nz) || 1;
  const face = new THREE.Vector3(best.x + nx / nl * 2, P.y, best.z + nz / nl * 2);
  return { T, hit: ok ? hit : null, side: ok && hit.side ? hit.side : 1, from: [best.x, best.z], face };
}

/**
 * Room behind you, standing, for her to spank you from: the spot clear of
 * the walls and the furniture. With your back to a wall she came at you
 * from the side instead and her hand found your hip (photographed).
 */
function revBehindFree() {
  const r = jadrija.rideFrom ? jadrija.rideFrom() : null;
  if (!r) return false;
  const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
  const bx = r.x - fx * REV.behind, bz = r.z - fz * REV.behind;
  const [cx, cz] = ground.confine ? ground.confine(bx, bz, rev.ch.y) : [bx, bz];
  return Math.hypot(cx - bx, cz - bz) < 0.04 && jadrija.kabina.room(bx, bz, 0.15);
}

/** Start a round: `n` slaps, how hard. */
function revSpankRound(n, why) {
  if (!rev.on) return 'off';
  const v = revView();
  if (!v || !(v.ctx === 'front' || v.ctx === 'stand')) return 'notthere';
  if (v.ctx === 'stand' && !revBehindFree()) return 'wall';
  const S = revSpot(v);
  if (!S) return 'nospot';
  const A = rev.arm;
  Object.assign(A, { mode: 'spank', ph: 'go', t: 0, n, at: S, tgt: S.T.clone(), err: 0, lift: 0, bow: 0 });
  A.k = 9 + 7 * rev.dom.heat + (Math.random() < rev.dom.heat * 0.4 ? 4 : 0);
  revGo(S.from[0], S.from[1]);
  rev.ch.face = S.face;
  revTrace({ pick: 'spank x' + n, why, heat: +rev.dom.heat.toFixed(2) });
  return true;
}

function revArmStop() {
  const A = rev.arm;
  if (A.mode === 'spank') { A.mode = null; A.ph = 'rise'; A.t = 0; }
}

/** Her hand, world (the wrist), or null. */
function revHand(out) {
  if (!you || !you.fig) return null;
  const i = you.fig.boneIndex('handR');
  if (i < 0) return null;
  you.mesh.updateMatrixWorld();
  return you.fig.boneAt(i, out).applyMatrix4(you.mesh.matrixWorld);
}

/** The slap, with her hand as its side — `buttSlap` in 90-app.js, `from` hers. */
function revSlap(S, k) {
  const from = revHand(new THREE.Vector3()) || new THREE.Vector3(rev.ch.x, rev.ch.y + 1.2, rev.ch.z);
  // The pillow side of the hand: from a little above it, the way a palm comes.
  from.y += 0.25;
  if (audio && audio.slap) audio.slap();
  const hit = S.hit ? { ...S.hit, x: rev.arm.tgt.x, y: rev.arm.tgt.y, z: rev.arm.tgt.z } : null;
  if (typeof apprenticeSlap === 'function') apprenticeSlap(S.side, hit ? hit.bind : null, hit ? hit.reg : 'butt');
  if (jadrija.slapped && (!hit || hit.reg === 'butt')) jadrija.slapped();
  const on = !!(jadrija.cotSpank && jadrija.cotSpank(S.side, from, k, hit));
  const last = on && jadrija.cotLast ? jadrija.cotLast() : null;
  if (typeof sceneHit === 'function') sceneHit('hand', last && last.u >= 0.6 ? 2 : 1, hit ? hit.reg : 'butt');
  rev.slaps++;
  rev.jolt = Math.min(1.4, rev.jolt + 0.6 + 0.4 * (last ? last.u : 0.5));
  rev.dom.heat = Math.min(1, rev.dom.heat + 0.03);
  revTrace({ pick: 'slap', why: (hit ? hit.reg : 'cheek') + (on ? ' (cot)' : ''), k: +k.toFixed(1),
    u: last ? +last.u.toFixed(2) : null, miss: +rev.arm.err.toFixed(3) });
}

function revArmTick(dt) {
  const A = rev.arm, R = REV_ARM;
  const ease = (a, b, k) => a + (b - a) * (1 - Math.exp(-k * dt));
  if (A.mode === 'care') {
    // Down to you, her hand on your hair, slowly round.
    A.w = ease(A.w, rev.walk ? 0 : R.crouch * 0.7, 6);
    A.lift = ease(A.lift, 1, 5);
    const H = revBone('head', new THREE.Vector3());
    if (H) { A.tgt = H.add(new THREE.Vector3(0, 0.10, 0)); revArmFit(dt, 1.6); }
    A.A += Math.sin(rev.clock * 2.4) * 0.12 * dt;
    return;
  }
  if (A.mode !== 'spank') {
    // Up again, the arm down.
    A.w = ease(A.w, 0, 5);
    A.lift = ease(A.lift, 0, 6);
    if (A.w < 0.004) A.w = 0;
    if (A.lift < 0.004) A.lift = 0;
    return;
  }
  A.t += dt;
  // The spot, again: you move under her (the cot's ragdoll, your own asks).
  const v = revView();
  if (!v || !(v.ctx === 'front' || v.ctx === 'stand' || A.ph === 'hold' || A.ph === 'lift')) {
    revTrace({ pick: 'spank off', why: 'you moved: ' + (v ? v.phase : '?') });
    A.mode = null; A.ph = 'rise'; return;
  }
  if (A.ph === 'go') {
    A.w = ease(A.w, 0, 6);
    if (revAt() || A.t > 6) { A.ph = 'aim'; A.t = 0; A.lift = 0; }
    return;
  }
  const crouchTo = v.ctx === 'stand' ? 0.35 : R.crouch;
  if (A.ph === 'aim') {
    A.w = ease(A.w, crouchTo, 7);
    A.lift = ease(A.lift, 1, 5);
    A.E = ease(A.E, 0.30, 6);
    revArmFit(dt, 3.0);
    if (rev.armStop === 'aim') return;
    if (A.t > R.aim && (A.err < 0.05 || A.t > R.aim + 1.4)) { A.ph = 'wind'; A.t = 0; A.base = A.A; A.baseE = A.E; }
    return;
  }
  const u = (x) => Math.min(1, Math.max(0, x));
  if (A.ph === 'wind') {
    const e = u(A.t / R.wind), s = e * e * (3 - 2 * e);
    A.A = A.base + R.windA * s; A.E = A.baseE + R.windE * s;
    if (A.t >= R.wind) { A.ph = 'strike'; A.t = 0; if (Math.random() < 0.6) revSay('spank'); }
    return;
  }
  if (A.ph === 'strike') {
    const e = u(A.t / R.strike), s = e * e;
    A.A = A.base + R.windA * (1 - s); A.E = A.baseE + R.windE * (1 - s);
    if (A.t >= R.strike) {
      revSlap(A.at, A.k);
      A.ph = 'hold'; A.t = 0;
    }
    return;
  }
  if (A.ph === 'hold') { if (A.t >= R.hold) { A.ph = 'lift'; A.t = 0; } return; }
  if (A.ph === 'lift') {
    const e = u(A.t / R.lift);
    A.A = A.base + 0.35 * e;
    if (A.t >= R.lift) {
      A.n -= 1;
      if (A.n > 0) { A.ph = 'aim'; A.t = R.aim * 0.6; A.at = revSpot(v) || A.at; A.tgt = A.at.T.clone(); }
      else { A.mode = null; A.ph = 'rise'; A.t = 0; }
    }
  }
}

/**
 * Her hand on to the spot by feedback: the arm's swing for the height, her
 * feet for the rest. `gain` how quickly. `A.err` what is left, m.
 */
function revArmFit(dt, gain) {
  const A = rev.arm, C = rev.ch;
  const H = revHand(new THREE.Vector3());
  const S = revShoulder(new THREE.Vector3());
  if (!H || !S || !A.tgt) return;
  // The wrist a palm's breadth above the skin.
  const T = _rvB.copy(A.tgt).add(_rvU.set(0, 0.055, 0));
  const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw);
  const ex = T.x - H.x, ey = T.y - H.y, ez = T.z - H.z;
  A.err = Math.hypot(ex, ey, ez);
  // The swing, in her own fore-and-aft plane: the angle from straight down
  // of shoulder-to-hand against shoulder-to-spot, and the difference taken.
  const hx = H.x - S.x, hy = H.y - S.y, hz = H.z - S.z;
  const tx = T.x - S.x, ty = T.y - S.y, tz = T.z - S.z;
  const ph = Math.atan2(hx * fx + hz * fz, -hy), pt = Math.atan2(tx * fx + tz * fz, -ty);
  const k = Math.min(1, gain * dt * 2.5);
  A.A = Math.min(REV_ARM.maxAim, Math.max(-0.3, A.A + (pt - ph) * k));
  // Out of reach: lean in over it (her back, `bow`), and step where the
  // room lets her - across, mostly, since the cot stops her coming nearer.
  const far = Math.hypot(tx, ty, tz) - Math.hypot(hx, hy, hz);
  A.bow = Math.min(0.5, Math.max(0, (A.bow || 0) + far * k * 0.8));
  const rx = -fz, rz = fx;
  const across = ex * rx + ez * rz;
  const step = Math.min(1, gain * dt * 0.8);
  let nx = C.x + rx * across * step, nz = C.z + rz * across * step;
  if (ground.confine) [nx, nz] = ground.confine(nx, nz, C.y);
  // Nearer, only where the frame lets her come in straight.
  if (far > 0.01) {
    const qx = nx + fx * far * step, qz = nz + fz * far * step;
    const [cx, cz] = ground.confine ? ground.confine(qx, qz, C.y) : [qx, qz];
    if (Math.hypot(cx - qx, cz - qz) < 0.002) { nx = qx; nz = qz; }
  }
  C.x = nx; C.z = nz;
  // And still facing it.
  const F = rev.ch.face;
  if (F) {
    const yw = Math.atan2(-(F.x - C.x), -(F.z - C.z));
    let dy = yw - C.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    C.yaw += dy * (1 - Math.exp(-5 * dt));
  }
}

/** Her right shoulder, world. */
function revShoulder(out) {
  if (!you || !you.fig) return null;
  const i = you.fig.boneIndex('armUR');
  if (i < 0) return null;
  you.mesh.updateMatrixWorld();
  return you.fig.boneAt(i, out).applyMatrix4(you.mesh.matrixWorld);
}

// ── Chloe's choices ──────────────────────────────────────────────────────────

/** An order: said, and timed. */
function revOrder(id, why = 'mood') {
  const O = REV_ORDERS[id];
  if (!O) return 'no such order';
  if (!rev.on) return 'off';
  const v = revView();
  const r = jadrija.rideFrom();
  rev.dom.order = { id, t0: rev.clock, held: 0, start: r ? [r.x, r.z] : null, phase: v ? v.phase : null };
  rev.dom.moved = 0;
  revSay(null, true, O.say);
  revTrace({ pick: 'order:' + id, why, ctx: v ? v.ctx : null, heat: +rev.dom.heat.toFixed(2) });
  revHud();
  return true;
}

/** Whether the order out is kept, this frame. */
function revKept(O, v, R) {
  if (O.still) return null;
  try { return !!O.ok(v, R); } catch (e) { return false; }
}

function revOrderTick(dt, v) {
  const D = rev.dom, Ord = D.order;
  if (!Ord) return;
  const O = REV_ORDERS[Ord.id];
  const age = rev.clock - Ord.t0;
  if (O.still) {
    // Kept by not moving: no pose asked, the walker where it was.
    const r = jadrija.rideFrom();
    const drift = r && Ord.start ? Math.hypot(r.x - Ord.start[0], r.z - Ord.start[1]) : 0;
    const broke = D.moved > 0 || (rev.walk && drift > 0.25) || (v && v.phase !== Ord.phase && age > 0.5);
    if (broke) return revOrderEnd(false, 'you moved');
    if (age >= REV.still) return revOrderEnd(true, 'still for ' + REV.still + ' s');
    return;
  }
  const ok = v && revKept(O, v, rev);
  Ord.held = ok ? Ord.held + dt : 0;
  if (Ord.held >= REV.hold) return revOrderEnd(true, 'kept');
  if (age > REV.orderWait) revOrderEnd(false, 'not done in ' + REV.orderWait + ' s');
}

function revOrderEnd(kept, why) {
  const D = rev.dom, id = D.order ? D.order.id : '?';
  D.order = null;
  if (kept) {
    D.obey++; D.streak++;
    D.heat = Math.min(1, D.heat + 0.08);
    D.punish = 0;
    revSay('good', true);
    D.next = rev.clock + 2.2 + Math.random() * 2;
  } else {
    D.miss++; D.streak = 0;
    D.punish = 1;
    revSay('slow', true);
    D.next = rev.clock + 1.4;
  }
  revTrace({ pick: (kept ? 'kept:' : 'ignored:') + id, why, heat: +D.heat.toFixed(2), obey: D.obey, miss: D.miss });
  revHud();
}

/** The worn toys she has a remote for: the Lovense, and the plug if it is in. */
function revToys() {
  const w = jadrija && jadrija.worn ? jadrija.worn() : [];
  return w.filter((k) => k === 'lovense' || /plug/.test(k));
}

/** Her decision: score what she could do where you are, and pick one. */
function revDecide() {
  const D = rev.dom, v = revView();
  D.decisions++;
  const ctx = v ? v.ctx : null;
  if (!ctx) { D.next = rev.clock + 1; revTrace({ pick: '-', why: 'you are between poses', phase: v ? v.phase : null }); return null; }
  const cands = [];
  const recent = (id) => D.last.slice(-3).filter((x) => x === id).length;
  for (const id of Object.keys(REV_ORDERS)) {
    const O = REV_ORDERS[id];
    const w = O.ctx[ctx];
    if (!w) continue;
    if (!O.still && revKept(O, v, rev)) continue;     // already so: no order in it
    let s = O.w * w * (0.6 + 0.5 * D.heat);
    s *= recent(id) ? 0.25 : 1;
    cands.push({ id: 'order:' + id, s });
  }
  // On her front on the cot, or standing — Chloe comes round behind you.
  const canSpank = ctx === 'front' || (REV.standSpank && ctx === 'stand' && revBehindFree());
  if (canSpank) {
    cands.push({ id: 'spank', s: (D.punish ? 4 : (ctx === 'front' ? 1.0 : 0.5) + 1.2 * D.heat + 0.25 * D.streak)
      * (recent('spank') > 1 ? 0.5 : 1) });
  }
  const toys = revToys();
  if (toys.length && D.obey >= 1) cands.push({ id: 'buzz', s: 0.25 + 0.6 * D.heat });
  if (rev.walk && revGap() > 2.2) cands.push({ id: 'prowl', s: 0.6 });
  else cands.push({ id: 'prowl', s: 0.25 });
  if (D.punish && !canSpank) {
    // The spanking you have earned wants you where she can give it.
    const want = ctx === 'stand' ? 'order:cot' : 'order:front';
    const c = cands.find((x) => x.id === want);
    if (c) c.s *= 3;
  }
  const tot = cands.reduce((a, c) => a + c.s, 0);
  let x = Math.random() * tot, pick = cands[cands.length - 1];
  for (const c of cands) { x -= c.s; if (x <= 0) { pick = c; break; } }
  const alt = cands.slice().sort((a, b) => b.s - a.s).slice(0, 4).map((c) => c.id + ' ' + c.s.toFixed(2)).join(', ');
  D.last.push(pick.id.startsWith('order:') ? pick.id.slice(6) : pick.id);
  if (D.last.length > 8) D.last.shift();
  D.next = rev.clock + REV.gap[0] + (REV.gap[1] - REV.gap[0]) * Math.random();
  if (pick.id.startsWith('order:')) {
    revOrder(pick.id.slice(6), 'alt: ' + alt);
    D.next = rev.clock + REV.orderWait + 1;
  } else if (pick.id === 'spank') {
    const n = D.punish ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * (1 + D.heat * 3));
    const r = revSpankRound(Math.min(4, n), (D.punish ? 'punishment' : 'mood') + ' | alt: ' + alt);
    D.punish = 0;
    if (r !== true) revTrace({ pick: 'spank:' + r });
    D.next = rev.clock + 4 + n * 1.2;
  } else if (pick.id === 'buzz') {
    const k = toys[Math.floor(Math.random() * toys.length)];
    const secs = 5 + Math.round(6 * D.heat);
    const r = jadrija.signal ? jadrija.signal(k, true, secs) : 'none';
    revSay('buzz', true);
    revTrace({ pick: 'buzz:' + k, why: String(r) + ' ' + secs + ' s | alt: ' + alt });
  } else {
    // Round you, to a new place to watch you from.
    const r = jadrija.rideFrom();
    if (r) {
      const a = Math.random() * Math.PI * 2;
      const gx = r.x + Math.cos(a) * REV.near * 1.2, gz = r.z + Math.sin(a) * REV.near * 1.2;
      const [cx, cz] = ground.confine ? ground.confine(gx, gz, rev.ch.y) : [gx, gz];
      if (jadrija.kabina.room(cx, cz, 0.2)) revGo(cx, cz);
      const P = revBone('pelvis', new THREE.Vector3());
      rev.ch.face = P || new THREE.Vector3(r.x, r.y, r.z);
    }
    if (Math.random() < 0.4) revSay('prowl');
    revTrace({ pick: 'prowl', why: 'alt: ' + alt });
  }
  return pick.id;
}

// ── the frame ────────────────────────────────────────────────────────────────

/** Once a frame from 90-app.js, after both walkers have moved and before the picture. */
function revTick(dt) {
  rev.clock += dt;
  if (!rev.on) return;
  if (state.phase !== 'ground' || !ground || !ground.ok || !jadrija || !jadrija.rideFrom) { revOff('left'); return; }
  const Y = ground.you;
  const v = revView();
  if (!v || !v.inKab || v.swim) { revOff('left'); return; }
  const r = jadrija.rideFrom();
  // ── you, in her ──
  const walk = v.phase === 'dwell' && !v.ask;
  if (walk && !rev.walk) {
    // Back on her feet: the walker to where she is standing.
    ground.put(r.x, r.z, Y.yaw, Y.pitch, r.y);
    rev.yaw = r.yaw;
  }
  rev.walk = walk;
  if (walk) {
    if (!revInKab(Y.x, Y.z)) { revOff('left'); return; }
    // Her pace, not yours: the walker is 3.4 m/s in this room and her
    // stroll is solved for 1.37 (1.75 times that is the most its clock
    // stretches before her feet slide). Q is a quicker walk.
    const top = typeof keys !== 'undefined' && keys.has('KeyQ') ? 2.3 : 1.45;
    if (rev.last && dt > 0) {
      const mx = Y.x - rev.last[0], mz = Y.z - rev.last[1], md = Math.hypot(mx, mz);
      if (md > top * dt && md < 1) {
        const k = top * dt / md;
        Y.x = rev.last[0] + mx * k; Y.z = rev.last[1] + mz * k;
      }
      const v = Math.hypot(Y.vx, Y.vz);
      if (v > top) { Y.vx *= top / v; Y.vz *= top / v; }
    }
    // Not through Chloe either.
    const ox = Y.x - rev.ch.x, oz = Y.z - rev.ch.z, od = Math.hypot(ox, oz);
    if (od < 0.5 && od > 1e-4) { Y.x = rev.ch.x + ox / od * 0.5; Y.z = rev.ch.z + oz / od * 0.5; }
    let dy = Y.yaw - rev.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    rev.yaw += dy * (1 - Math.exp(-REV.yawRate * dt));
    jadrija.ride({ x: Y.x, z: Y.z, yaw: rev.yaw, sp: Math.hypot(Y.vx, Y.vz) });
    rev.last = [Y.x, Y.z];
  } else {
    rev.last = null;
    // In a pose: the walker is pinned to her, the mouse only looks. W or S
    // is "get up", once.
    Y.x = r.x; Y.z = r.z; Y.vx = 0; Y.vz = 0;
    if (typeof keys !== 'undefined' && (keys.has('KeyW') || keys.has('KeyS')) && rev.clock - rev.riseAt > 2.5
      && !rev.care && v.ctx) {
      rev.riseAt = rev.clock;
      revAsk('rise');
    }
    jadrija.ride({ x: r.x, z: r.z, yaw: r.yaw, sp: 0 });
  }
  if (v.phase !== rev.wasPhase) { rev.wasPhase = v.phase; }
  rev.lie = !!(v.lying && v.onBed);
  // Arrived in a pose (or just swapped): your eyes on to her, once, eased —
  // after that the mouse is yours.
  if (v.ctx !== rev.ctxWas) {
    if (v.ctx && (v.ctx !== 'stand' || rev.ctxWas === undefined)) rev.lookTo = 0.9;
    rev.ctxWas = v.ctx;
  }
  if (rev.lookTo > 0) {
    rev.lookTo -= dt;
    const Hc = revChloeHead(new THREE.Vector3()), O = camera.position;
    const yw = Math.atan2(-(Hc.x - O.x), -(Hc.z - O.z));
    const pt = Math.atan2(Hc.y - O.y, Math.hypot(Hc.x - O.x, Hc.z - O.z));
    let dy = yw - Y.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const k = 1 - Math.exp(-7 * dt);
    Y.yaw += dy * k; Y.pitch += (pt - Y.pitch) * k;
    if (walk) rev.yaw = Y.yaw;
  }
  // ── Chloe ──
  revSteer(dt);
  revArmTick(dt);
  if (rev.care) { revCareTick(dt, v); if (!rev.on) return; }
  else {
    rev.dom.heat += (REV.heatRest - rev.dom.heat) * (1 - Math.exp(-dt / REV.heatTau));
    revOrderTick(dt, v);
  }
  if (!rev.care && rev.dom.on) {
    if (!rev.dom.order && rev.arm.mode !== 'spank' && rev.clock >= rev.dom.next) revDecide();
  }
  // Idling: facing you.
  if (!rev.care && !rev.ch.goal && rev.arm.mode == null) rev.ch.face = revBone('pelvis', new THREE.Vector3()) || rev.ch.face;
  revDriveChloe(dt);
  revCamera(dt);
  revHud();
}

/** The safeword's end: to your head, a hand on your hair, a soft line, back. */
function revCareTick(dt, v) {
  const K = rev.care;
  K.t += dt;
  {
    if (!K.go) {
      K.go = true;
      const H = revBone('head', new THREE.Vector3());
      if (H) {
        const r = jadrija.rideFrom();
        // Beside your head, on the open side.
        let best = null;
        for (const a of [0, 1.2, -1.2, 2.4, -2.4, Math.PI]) {
          const yaw = r.yaw + a;
          const gx = H.x - Math.sin(yaw) * 0.55, gz = H.z - Math.cos(yaw) * 0.55;
          const [cx, cz] = ground.confine ? ground.confine(gx, gz, rev.ch.y) : [gx, gz];
          const bad = Math.hypot(cx - gx, cz - gz) + (jadrija.kabina.room(cx, cz, 0.15) ? 0 : 5);
          if (!best || bad < best.bad) best = { bad, x: cx, z: cz };
        }
        revGo(best.x, best.z);
        rev.ch.face = H;
      }
    }
  }
  if (!K.said && K.t > 0.4) { K.said = true; revSay('care', true); }
  if (K.go && revAt() && rev.arm.mode !== 'care') { rev.arm.mode = 'care'; rev.arm.lift = 0; K.handAt = K.t; }
  if (rev.arm.mode === 'care' && jadrija.petTouch) jadrija.petTouch(Math.min(1, (K.t - K.handAt) / 0.8));
  // Four and a half seconds of her hand, then the roles go back.
  if ((K.handAt != null && K.t - K.handAt > 4.5) || K.t > 12) {
    rev.arm.mode = null;
    revOff('safe');
  }
}

/** The camera: in her head (first person), or behind her in the room (B). */
function revCamera(dt) {
  rev.jolt *= Math.exp(-9 * dt);
  if (camOverride) return;
  if (rev.debugCam) {
    const D = rev.debugCam;
    camera.position.set(D[0], D[1], D[2]);
    camera.lookAt(D[3], D[4], D[5]);
    camera.updateMatrixWorld();
    return;
  }
  if (bodyCam) { revThird(dt); return; }
  rev.c3 = null;
  const H = revHead();
  if (!H) return;
  const d = camera.getWorldDirection(_rvB);
  camera.position.copy(H.eye).addScaledVector(d, REV.cam.ahead);
  // Lying down, a little over the pillow, as a head lifts to look: level
  // with her own eye her arms beside her head fill the picture.
  const v = rev.lie;
  rev.lieK = (rev.lieK || 0) + ((v ? 1 : 0) - (rev.lieK || 0)) * (1 - Math.exp(-4 * dt));
  if (rev.lieK > 0.002) { camera.position.y += 0.10 * rev.lieK; camera.position.addScaledVector(d, 0.05 * rev.lieK); }
  if (rev.jolt > 0.01) {
    camera.position.y -= REV.joltK * rev.jolt;
    camera.rotateX(-0.05 * rev.jolt);
    camera.rotateZ(0.02 * rev.jolt * Math.sin(rev.clock * 40));
  }
  camera.updateMatrixWorld();
}

/**
 * THE THIRD PERSON, in the room. The ground's own pull-back wants 1.7 m of
 * clear air behind the walker and in this room it rarely gets it (1.554.1
 * says as much), so it collapses into her head. This one stands off her
 * where the room has space: behind your line of sight first, then round
 * either way, at 2.6, 2.1 or 1.7 m, inside the room and clear of the
 * furniture (`ground.confine` leaves the point where it is), a little above
 * her, aimed at her chest — or at her seat lying down. Eased, so a change
 * of side is a move and not a cut.
 */
function revThird(dt) {
  const Y = ground.you;
  const T = rev.walk ? revBone('spine03', new THREE.Vector3()) : revBone('pelvis', new THREE.Vector3());
  if (!T) return;
  if (!rev.walk) T.y += 0.12;
  const fy = rev.ch.y;
  let best = null;
  for (const a of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.8, -1.8, 2.3, -2.3, Math.PI]) {
    for (const d of [2.6, 2.1, 1.7]) {
      const yaw = Y.yaw + a;
      const px = T.x + Math.sin(yaw) * d, pz = T.z + Math.cos(yaw) * d;
      const [cx, cz] = ground.confine ? ground.confine(px, pz, fy) : [px, pz];
      if (Math.hypot(cx - px, cz - pz) > 0.01 || !revRoom(px, pz)) continue;
      best = { x: px, z: pz, d };
      break;
    }
    if (best) break;
  }
  if (!best) return;
  const want = new THREE.Vector3(best.x,
    Math.min(fy + 2.55, Math.max(fy + 0.5, T.y + 0.65 - Math.sin(Y.pitch) * best.d * 0.7)), best.z);
  if (!rev.c3) rev.c3 = want.clone();
  else rev.c3.lerp(want, 1 - Math.exp(-5 * dt));
  camera.position.copy(rev.c3);
  if (!rev.t3) rev.t3 = T.clone(); else rev.t3.lerp(T, 1 - Math.exp(-8 * dt));
  camera.lookAt(rev.t3);
  if (rev.jolt > 0.01) camera.rotateZ(0.015 * rev.jolt * Math.sin(rev.clock * 40));
  camera.updateMatrixWorld();
}

/** Whether a point is well inside the big room: its walls, plus a margin. */
function revRoom(x, z) {
  const K = jadrija && jadrija.kabina;
  return !!(K && K.room && K.room(x, z, 0.3));
}

/** The tag, top right, and the order out under it. */
function revHud() {
  if (typeof document === 'undefined') return;
  if (!rev.hud) {
    const host = document.getElementById('ground-hud');
    if (!host) return;
    const el = document.createElement('div');
    el.id = 'gh-rev';
    el.hidden = true;
    el.style.cssText = 'position:absolute;right:1.4rem;top:3.1rem;font-size:.56rem;letter-spacing:.2em;'
      + 'text-transform:uppercase;color:var(--ember-hi);padding:.28rem .6rem;border-radius:3px;'
      + 'border:1px solid rgba(255,140,90,.45);background:rgba(20,12,10,.45);max-width:22rem;text-align:right;line-height:1.6';
    host.appendChild(el);
    rev.hud = el;
  }
  const O = rev.dom.order ? REV_ORDERS[rev.dom.order.id] : null;
  const T0 = typeof T === 'function' ? T : (k) => k;
  const lang = revLang();
  const txt = !rev.on ? '' : T0('rev.hud') + (rev.care ? ' · ♥' : '')
    + (O ? '\n' + T0('rev.order') + ': ' + (lang === 'fr' ? O.say[2] : lang === 'hr' ? O.say[0] : O.say[1])
      + (O.key ? ' [' + O.key + ']' : '') : '');
  if (txt === rev.hudWas) return;
  rev.hudWas = txt;
  rev.hud.style.whiteSpace = 'pre-line';
  rev.hud.textContent = txt;
  rev.hud.hidden = !rev.on;
}

/** `__fr.reverse` — see 90-app.js. */
const revApi = {
  on: () => revOn('probe'),
  off: () => revOff('asked'),
  safe: () => revSafe('you'),
  hear: (text) => { const w = revWords(text); return w ? revAct(w) : null; },
  words: (text) => revWords(text),
  key: (n) => revKey({ code: 'Digit' + n, preventDefault() {} }),
  ask: (name) => revAsk(name),
  order: (id) => revOrder(id, 'probe'),
  spank: (n = 1) => revSpankRound(n, 'probe'),
  decide: () => revDecide(),
  /** Chloe's choices on or off (off: she waits — for a probe of the controls). */
  dom: (on) => { if (on != null) rev.dom.on = !!on; return rev.dom.on; },
  set: (o = {}) => {
    if (o.heat != null) rev.dom.heat = +o.heat;
    if (o.next != null) rev.dom.next = rev.clock + +o.next;
    return { heat: rev.dom.heat, next: +(rev.dom.next - rev.clock).toFixed(1) };
  },
  trace: (n = 40) => rev.trace.slice(-n),
  said: () => rev.log.slice(),
  state: () => {
    const v = revView();
    const H = revHead();
    return { on: rev.on, walk: rev.walk, clock: +rev.clock.toFixed(1), care: rev.care ? +rev.care.t.toFixed(1) : null,
      ctx: v ? v.ctx : null, phase: v ? v.phase : null,
      order: rev.dom.order ? { id: rev.dom.order.id, age: +(rev.clock - rev.dom.order.t0).toFixed(1) } : null,
      dom: { on: rev.dom.on, next: +(rev.dom.next - rev.clock).toFixed(1), heat: +rev.dom.heat.toFixed(2),
        obey: rev.dom.obey, miss: rev.dom.miss, streak: rev.dom.streak, punish: rev.dom.punish, decisions: rev.dom.decisions },
      chloe: { x: +rev.ch.x.toFixed(2), y: +rev.ch.y.toFixed(2), z: +rev.ch.z.toFixed(2), yaw: +rev.ch.yaw.toFixed(2),
        sp: +rev.ch.sp.toFixed(2), goal: !!rev.ch.goal },
      arm: { mode: rev.arm.mode, ph: rev.arm.ph, w: +rev.arm.w.toFixed(2), A: +rev.arm.A.toFixed(2), E: +rev.arm.E.toFixed(2),
        err: +rev.arm.err.toFixed(3), n: rev.arm.n,
        hand: (() => { const h = revHand(new THREE.Vector3()); return h ? h.toArray().map((x) => +x.toFixed(3)) : null; })(),
        tgt: rev.arm.tgt ? rev.arm.tgt.toArray().map((x) => +x.toFixed(3)) : null },
      spot: rev.spotDbg || null, slaps: rev.slaps, gap: +revGap().toFixed(2), looking: rev.on ? revLooking() : null,
      cam: camera.position.toArray().map((x) => +x.toFixed(3)),
      eye: H ? H.eye.toArray().map((x) => +x.toFixed(3)) : null,
      walker: ground && ground.you ? [+ground.you.x.toFixed(2), +ground.you.z.toFixed(2)] : null };
  },
  /** Debug: a fixed camera [x, y, z, tx, ty, tz] over everything, or null. */
  view: (a) => { rev.debugCam = a || null; return !!rev.debugCam; },
  /** Debug: hold her hand on the spot ('aim') instead of swinging, or null. */
  armStop: (ph) => { rev.armStop = ph || null; return rev.armStop; },
  /** Debug: a side-on view of her arm and the spot, from wherever the room has space. */
  side: (d = 2.4) => {
    const t = rev.arm.tgt || new THREE.Vector3(rev.ch.x, rev.ch.y + 0.6, rev.ch.z);
    const dx = rev.ch.x - t.x, dz = rev.ch.z - t.z, n = Math.hypot(dx, dz) || 1;
    for (const sg of [1, -1, 0.5, -0.5]) {
      for (const k of [1, 0.8, 0.6]) {
        const x = t.x - dz / n * d * k * sg + dx / n * 0.3, z = t.z + dx / n * d * k * sg + dz / n * 0.3;
        if (revRoom(x, z)) { rev.debugCam = [x, rev.ch.y + 1.5, z, (t.x + rev.ch.x) / 2, t.y + 0.25, (t.z + rev.ch.z) / 2]; return rev.debugCam; }
      }
    }
    return null;
  },
  /** Debug: is (x, z) clear room for the third person's lens? */
  room: (x, z) => ({ inside: jadrija.kabina.inside(x, z), room: revRoom(x, z),
    confine: ground.confine(x, z, rev.ch.y) }),
  /** Point the camera (the walker's look) at Chloe's face: "look at me". */
  lookAt: () => {
    if (!ground || !ground.you) return null;
    const H = revChloeHead(new THREE.Vector3());
    const O = camera.position;
    ground.you.yaw = Math.atan2(-(H.x - O.x), -(H.z - O.z));
    ground.you.pitch = Math.atan2(H.y - O.y, Math.hypot(H.x - O.x, H.z - O.z));
    return [ground.you.yaw, ground.you.pitch];
  },
};
