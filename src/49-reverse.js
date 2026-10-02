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
// own collider (`ground.confine`), turns to face, and spanks with her right
// arm; the slap is `buttSlap`'s path with her hand as its side (`cotSpank`,
// the mark, your reflex, the scene's record). Since 1.565.0 (phase 2c,
// src/49-revmoves.js) she goes where her arm reaches the spot from, KNEELS
// by the cot (her own `submit` clip, held), her palm is solved on to the spot
// (within a few millimetres, measured), standing, kneeling and on all fours
// as well as on the cot; her head and eyes follow you; and she has more moves
// than the spank (circling, your hair, holding you down, sitting by you, your
// chin, your nape, hands on her hips while she waits).
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
//   - HER VOICE (1.563.0): her lines are said in her own voice through the
//     service when it can (`voice.chloe`, `PERSONA_CHLOE`, Nina), the
//     phase-one captions when it cannot; what you say goes to her, not Baye
//     (`converseChloe`); and the safeword cuts her off mid-word;
//   - "reverse roles" again swaps back; so does leaving the room, the ground,
//     or any skip key;
//   - never outside the kabina; and the swap is refused while your belt is out
//     or the collar is on her. Since 1.564.0 (phase 2b, src/49-revkit.js) the
//     belt and the collar are CHLOE'S while the roles are reversed: she takes
//     her belt off and uses it on you on the cot, or puts the collar on you
//     and leads you, on her own as the scene warms up or when you ask ("use
//     the belt", "collar me", the backslash and =) — one at a time, one right
//     hand.
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
  // Off the cot too — standing, kneeling, on all fours. Off in phase one
  // (her wrist got to 8-19 cm of the cheek, and from the side it read as a
  // hand on your hip); on since 1.565.0, when her palm is solved on to the
  // spot and she goes where her arm reaches it from (src/49-revmoves.js).
  standSpank: true,
};

/**
 * Her lines, in English since 1.569.0 (Misha: "she is really from the west
 * coast and all"): Chloe is a young Californian on holiday at Jadrija, and
 * she talks like one. Each line was written for her, not translated from the
 * Croatian she had before, and the caption is the line itself, no gloss.
 * Short, in the room, a laugh in some of them.
 */
const REV_SAY = {
  on: ["Okay. I'm in charge now... and you're all mine.", "You're mine now, babe. Listen up."],
  off: ['Okay, okay... back to us.'],
  good: ['Good girl.', 'There it is. See? Easy.', "Look at you, listening so well."],
  slow: ['Hm? Did you not hear me?', 'Too slow, babe.', "Mm-mm. That's a spanking."],
  spank: ['You earned that one.', 'Count.', 'One more.', "Hehe. You're already pink."],
  buzz: ["Let's see what this does..."],
  prowl: ["Take your time. I'm enjoying the view."],
  care: ["Hey, hey... it's over. I've got you.", "You were amazing. C'mere."],
  // Her belt and the collar (1.564.0, src/49-revkit.js).
  belt: ['Okay. Belt time.', 'See this? My belt. Hehe.'],
  lash: ['Another one.', 'Stay still, baby girl.', 'Count.', "Hehe. You're all pink."],
  beltback: ["That's enough for now.", "Okay. Belt's going back on."],
  collar: ["C'mere. Collar time.", "You're gonna wear my collar now."],
  lead: ['Come on. Follow me.', 'Slowly... like that. Good girl.'],
  tug: ['Up. Up you get.', 'Down, girl.', 'Over here.'],
  uncollar: ["Okay, that's enough. Let me get this off you."],
};

/**
 * THE ORDERS. `ctx` where she gives it (the autonomous mode's `autoCtx`),
 * `ok(v, R)` whether your body keeps it now, `key` the hotkey that does it
 * (shown on the HUD), and the line.
 */
const REV_FRONT = { flatheld: 1, edgeHeld: 1 };
const REV_ORDERS = {
  cot: { ctx: { stand: 1, kneel: 1, fours: 1 }, w: 1.2, key: '2',
    ok: (v) => v.onBed && v.lying, say: 'On the cot. Like, now.', hud: ['Na krevet. Odmah.', 'On the cot. Now.', 'Sur le lit. Tout de suite.'] },
  front: { ctx: { back: 1.6, side: 1.3, sit: 1, cotKneel: 1, stand: 0.5 }, w: 1.0, key: '3',
    ok: (v) => v.onBed && REV_FRONT[v.phase], say: 'On your tummy, babe.', hud: ['Na trbuh, curo.', 'On your tummy, girl.', 'Sur le ventre, ma belle.'] },
  back: { ctx: { front: 1, side: 1, sit: 0.6 }, w: 0.6, key: '7',
    ok: (v) => v.onBed && v.phase === 'cradle', say: 'Roll onto your back.', hud: ['Okreni se na leđa.', 'Roll onto your back.', 'Mets-toi sur le dos.'] },
  spread: { ctx: { front: 1, back: 1, stand: 0.5 }, w: 1.2, key: '5',
    ok: (v) => v.legsSp > 0.2 * Math.max(0.05, v.legsSpMax), say: 'Spread your legs. More.', hud: ['Raširi noge. Više.', 'Spread your legs. More.', 'Écarte les jambes. Plus.'] },
  together: { ctx: { front: 1, back: 1 }, w: 0.6, key: '5',
    ok: (v) => v.legsSp < 0.05, say: 'Legs together.', hud: ['Noge skupa.', 'Legs together.', 'Les jambes serrées.'] },
  armsOut: { ctx: { front: 1, back: 1, side: 0.4 }, w: 0.8, key: '6',
    ok: (v) => v.arms > 0.5, say: 'Arms out to the sides.', hud: ['Ruke u stranu.', 'Arms out to the sides.', 'Les bras sur les côtés.'] },
  armsIn: { ctx: { front: 1, back: 1 }, w: 0.4, key: '6',
    ok: (v) => v.arms < 0.1, say: 'Arms down by your sides.', hud: ['Ruke uz tijelo.', 'Arms by your sides.', 'Les bras le long du corps.'] },
  still: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1 }, w: 0.7, key: '',
    still: true, say: 'Don\'t move. Not even a twitch.', hud: ['Ne miči se. Ni mrdnut.', "Don't move. Not a twitch.", 'Ne bouge pas. Pas un geste.'] },
  look: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, fours: 1 }, w: 0.8, key: 'mouse',
    ok: (v, R) => revLooking() || (v.gaze > 0 && v.gaze !== Infinity && !v.away), say: 'Look at me.', hud: ['Pogledaj me.', 'Look at me.', 'Regarde-moi.'] },
  kneel: { ctx: { stand: 1 }, w: 0.8, key: '4',
    ok: (v) => v.phase === 'kept' || v.phase === 'bedKneel', say: 'On your knees.', hud: ['Na koljena.', 'On your knees.', 'À genoux.'] },
  come: { ctx: { stand: 1 }, w: 0.6, key: 'WASD',
    ok: (v, R) => R.walk && revGap() < 1.3, say: 'Come here.', hud: ['Dođi ovamo.', 'Come here.', 'Viens ici.'] },
  turn: { ctx: { stand: 1 }, w: 0.6, key: 'mouse',
    ok: (v, R) => R.walk && revFacing() < -0.5, say: 'Turn around. Back to me.', hud: ['Okreni se. Leđima prema meni.', 'Turn around. Back to me.', 'Retourne-toi. Dos à moi.'] },
  stand: { ctx: { kneel: 1, fours: 1, sit: 0.3 }, w: 0.4, key: '1',
    ok: (v) => v.phase === 'dwell', say: 'Stand up.', hud: ['Ustani.', 'Stand up.', 'Debout.'] },
  // YOUR LEGS' LADDER (1.566.0): one up, both up, higher, wider, down — on
  // your back or your front on the cot (`LIFT` in 43-jadrija.js). `can` is
  // whether the order makes sense where you are at all.
  legL: { ctx: { back: 0.9, front: 0.6 }, w: 0.8, key: 'Shift+1', can: (v) => !!v.liftMode && !revBothUp(v),
    ok: (v) => !!v.liftL && !(v.liftR && revRank(v.liftR) >= revRank(v.liftL)),
    say: 'Left leg up.', hud: ['Lijevu nogu gore.', 'Left leg up.', 'La jambe gauche en l’air.'] },
  legR: { ctx: { back: 0.9, front: 0.6 }, w: 0.8, key: 'Shift+2', can: (v) => !!v.liftMode && !revBothUp(v),
    ok: (v) => !!v.liftR && !(v.liftL && revRank(v.liftL) >= revRank(v.liftR)),
    say: 'Right leg up.', hud: ['Desnu nogu gore.', 'Right leg up.', 'La jambe droite en l’air.'] },
  bothUp: { ctx: { back: 1.1, front: 0.7 }, w: 0.9, key: 'Shift+3', can: (v) => !!v.liftMode,
    ok: (v) => revBothUp(v), say: 'Both legs up.', hud: ['Obje noge gore.', 'Both legs up.', 'Les deux jambes en l’air.'] },
  higher: { ctx: { back: 0.9 }, w: 0.8, key: 'Shift+4',
    can: (v) => v.onBed && !!v.liftMode, ok: (v) => revRank(v.liftL) >= 3 && revRank(v.liftR) >= 3,
    say: 'Both legs up. Higher.', hud: ['Obje noge gore. Više.', 'Both legs up. Higher.', 'Les deux jambes en l’air. Plus haut.'] },
  // "Even wider" means as wide as you go (1.575.0): it was kept at 1.65 of
  // a ceiling of 2.4 on your back, two presses in. Every step there is a
  // press (Shift+5, 0.35 each), so she waits longer for it.
  wider: { ctx: { back: 0.9, front: 0.5, stand: 0.4 }, w: 0.8, key: 'Shift+5', wait: 16,
    can: (v) => v.legsSpMax > 1.01, ok: (v) => v.legsSpMax > 1.01 && v.legsSp >= v.legsSpMax - 0.05,
    say: 'Wider. Even wider.', hud: ['Šire. Još šire.', 'Wider. Even wider.', 'Plus écartées. Encore.'] },
  legsDown: { ctx: { back: 0.7, front: 0.7 }, w: 0.5, key: 'Shift+3',
    can: (v) => !!v.liftMode && !!(v.liftL || v.liftR || (v.phase === 'cradle' && !v.legsDown)),
    ok: (v) => !v.liftL && !v.liftR && (v.phase !== 'cradle' || !!v.legsDown),
    say: 'Legs down.', hud: ['Spusti noge.', 'Legs down.', 'Baisse les jambes.'] },
};
/** How high a leg is on the ladder (`LIFT_RANK` in 43-jadrija.js). */
function revRank(k) { return { 0: 0, 1: 1, s: 1.5, 2: 2, 3: 3, 4: 4 }[k || 0] || 0; }
/**
 * Both legs up: on your back the knees held in the cradle, or both at the
 * foot-up shape or past it; on your front both shins up.
 */
function revBothUp(v) {
  if (v.phase === 'cradle' && !v.legsDown) return true;
  const lo = v.liftMode === 'front' ? 1 : 2;
  return revRank(v.liftL) >= lo && revRank(v.liftR) >= lo;
}

// The help sheet and the HUD, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.reverse': 'in the kabina, say or type "reverse roles" — you are in Baye\'s body and Chloe gives the orders (and spanks). Do what she says: the keys below, or type it ("lie on the cot", "spread my legs"). "red" or "crvena" ends it at once; "reverse roles" again swaps back',
    'help.k.revlegs': 'roles reversed, your legs on the cot (Shift and a number): Shift+1 left leg up / down · Shift+2 right leg up / down · Shift+3 both legs up / down · Shift+4 higher · Shift+5 wider · Shift+6 lower. Or type it: "left leg up", "both legs up", "higher", "wider", "legs down"',
    'help.k.revkeys': 'roles reversed: 1 stand up · 2 lie on the cot · 3 on your front · 4 kneel · 5 legs apart / together · 6 arms out / in · 7 on your back · \\ her belt (off, or back on) · = her collar (on, or off). Look at her with the mouse; W gets you up; type the rest ("lotus", "on my side", "bend over", "use the belt", "collar me")',
    'help.k.revmoves': 'roles reversed: - Chloe shows off beside the cot (or say "show me your moves") · Shift+- she hugs and kisses you, on your back on the cot (or say "hug me", "kiss me")',
    'rev.hud': 'ROLES REVERSED', 'rev.order': 'she wants',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.reverse': 'u kabini reci ili utipkaj "zamijenimo uloge" — ti si u Bayeinom tijelu, a Chloe zapovijeda (i udara). Radi što kaže: tipke ispod, ili utipkaj ("lezi na krevet", "raširi noge"). "crvena" odmah završava; "zamijenimo uloge" opet vraća',
    'help.k.revlegs': 'zamijenjene uloge, tvoje noge na krevetu (Shift i broj): Shift+1 lijeva noga gore / dolje · Shift+2 desna noga gore / dolje · Shift+3 obje noge gore / dolje · Shift+4 više · Shift+5 šire · Shift+6 niže. Ili utipkaj: "lijevu nogu gore", "obje noge gore", "više", "šire", "spusti noge"',
    'help.k.revkeys': 'zamijenjene uloge: 1 ustani · 2 lezi na krevet · 3 na trbuh · 4 klekni · 5 noge raširi / skupi · 6 ruke u stranu / uz tijelo · 7 na leđa · \\ njezin remen · = njezina ogrlica. Pogledaj je mišem; W te diže; ostalo utipkaj ("lotos", "na bok", "sagni se", "remen", "ogrlica")',
    'help.k.revmoves': 'zamijenjene uloge: - Chloe se pokazuje kraj kreveta (ili reci "pokaži mi") · Shift+- grli te i ljubi, na leđima na krevetu (ili reci "zagrli me", "poljubi me")',
    'rev.hud': 'ZAMIJENJENE ULOGE', 'rev.order': 'želi',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.reverse': 'dans la cabine, dites ou tapez « inverser les rôles » — vous êtes dans le corps de Baye et Chloe donne les ordres (et la fessée). Faites ce qu’elle dit : les touches ci-dessous, ou tapez-le (« sur le lit », « écarte les jambes »). « rouge » arrête tout de suite ; « inverser les rôles » à nouveau rend les rôles',
    'help.k.revlegs': 'rôles inversés, vos jambes sur le lit (Maj et un chiffre) : Maj+1 jambe gauche en l’air / baissée · Maj+2 jambe droite · Maj+3 les deux en l’air / baissées · Maj+4 plus haut · Maj+5 plus écartées · Maj+6 plus bas. Ou tapez-le : « jambe gauche en l’air », « les deux jambes en l’air », « plus haut »',
    'help.k.revkeys': 'rôles inversés : 1 debout · 2 sur le lit · 3 sur le ventre · 4 à genoux · 5 jambes écartées / serrées · 6 bras écartés / le long du corps · 7 sur le dos · \\ sa ceinture · = son collier. Regardez-la à la souris ; W vous relève ; tapez le reste (« lotus », « sur le côté », « penche-toi », « ceinture », « collier »)',
    'help.k.revmoves': 'rôles inversés : - Chloe se montre à côté du lit (ou dites « montre-moi ») · Maj+- elle vous serre et vous embrasse, sur le dos sur le lit (ou « serre-moi », « embrasse-moi »)',
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
  // How her lines went out (1.563.0): 'voice' | 'caption' | 'drop', counted.
  said: {},
};
const _rvA = new THREE.Vector3(), _rvB = new THREE.Vector3(), _rvQ = new THREE.Quaternion();
const _rvF = new THREE.Vector3(), _rvU = new THREE.Vector3(), _rvH = new THREE.Vector3();

function revActive() { return !!rev.on; }
/** Whether this file drives Chloe's figure (90-app.js's `poseSwimBody` stands back). */
function revOwnsYou() { return !!rev.on; }
/** The person Baye is with while the roles are reversed: Chloe. */
function revWho() {
  if (!rev.on) return null;
  // Her fist in your hair holds your body where it faces (1.574.0, `rvhWho`).
  const h = typeof rvhWho === 'function' ? rvhWho() : null;
  return h || { x: rev.ch.x, y: rev.ch.y, z: rev.ch.z };
}
/**
 * The scene block's part of this (`sceneTalk` in 90-app.js): the swap, and
 * since 1.563.0 Chloe's side of it for her own voice on the service — the
 * order out, kept and missed, her heat, the aftercare. Keys and numbers only.
 */
function revScene() {
  if (!rev.on) return null;
  const D = rev.dom, o = { roles: 'reversed' };
  if (D.order) o.rev_order = D.order.id;
  if (D.obey) o.rev_obey = D.obey;
  if (D.miss) o.rev_miss = D.miss;
  o.rev_heat = +D.heat.toFixed(2);
  if (rev.care) o.rev_care = true;
  // Her belt in her hand (1.564.0) — the collar is the page's own `collar_on`.
  if (typeof rvkScene === 'function') rvkScene(o);
  // A toy she has drawn partway out, and her remote's level (1.567.0).
  if (typeof rvtScene === 'function') rvtScene(o);
  // Lying behind you on the cot, holding you (1.573.0).
  if (typeof rvmScene === 'function') rvmScene(o);
  // Her fist in your hair, or you drawn in to her side (1.574.0).
  if (typeof rvhScene === 'function') rvhScene(o);
  // Her mood, and what you last begged for (1.583.0).
  if (typeof rmoodScene === 'function') rmoodScene(o);
  return o;
}

function revLang() { return typeof LANG !== 'undefined' ? LANG : 'en'; }
/**
 * A line of hers. Since 1.563.0 it is SAID, in her own voice, when the voice
 * service can (`voice.chloe` in 49-voice.js: the beat goes up as a key and
 * the words come back from `PERSONA_CHLOE`, in English since 1.569.0). The
 * phase-one line is still picked here, and it is the caption whenever the
 * line is not voiced: signed out, too soon after the last one, the service
 * slow or saying no. `o.order` is the order a beat is about; `o.still()`
 * whether a reply that lands late is still worth saying.
 */
function revSay(kind, force = false, line = null, o = {}) {
  const L = line ? [line] : REV_SAY[kind];
  const moodL = !line && typeof rmoodLine === 'function';
  if (!moodL && (!L || !L.length)) return null;
  if (!force && rev.clock - rev.dom.lastLine < REV.lineGap) return null;
  // English since 1.569.0: a line is one string, and the caption is it. A
  // table entry still written the old way ([hr, en, fr]) speaks its English.
  // Since 1.583.0 the line is picked in her mood (`rmoodLine`: stern, warm,
  // excited or neutral) and never one of the last dozen she said; an order
  // keeps its words whole, with a word of her mood before or after it.
  let l = moodL ? rmoodLine(kind) : L[Math.floor(Math.random() * L.length)];
  if (l == null) return null;
  if (Array.isArray(l)) l = l[1] || l[0];
  if (line && kind === 'order' && typeof rmoodOrderLine === 'function') l = rmoodOrderLine(l);
  if (typeof rmoodSaid === 'function') rmoodSaid(l);
  rev.dom.lastLine = rev.clock;
  const cap = () => {
    if (typeof voice !== 'undefined' && voice && voice.sub) voice.sub('Chloe: ' + l, 3.2, '');
  };
  const V = typeof voice !== 'undefined' && voice && voice.chloe
    ? voice.chloe(kind, Object.assign({ fallback: cap }, o)) : 'caption';
  if (V === 'caption') cap();
  rev.said[V] = (rev.said[V] || 0) + 1;
  rev.log.push([+rev.clock.toFixed(1), l, V]);
  if (rev.log.length > 40) rev.log.shift();
  return l;
}
/** Whether a beat's reply is still worth saying when it lands. */
const revStill = {
  dom: () => rev.on && !rev.care,
  order: (O) => () => rev.on && !rev.care && rev.dom.order === O,
  care: () => true,
  off: () => !rev.on,
};
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
  if (typeof rvmClear === 'function') rvmClear();
  if (typeof rvtClear === 'function') rvtClear();
  // Her mood starts where it starts (1.583.0, src/49-revmood.js).
  if (typeof rmoodReset === 'function') rmoodReset();
  Object.assign(rev.dom, { on: rev.dom.on, next: rev.clock + 3.0, order: null, obey: 0, miss: 0, streak: 0,
    heat: REV.heatRest, punish: 0, last: [], moved: 0, stillFrom: null });
  // You into her: the walker where she stands, looking where she looks.
  ground.put(r.x, r.z, r.yaw, 0, r.y);
  jadrija.ride({ x: Y.x, z: Y.z, yaw: r.yaw, sp: 0 });
  revDriveChloe(0);
  revTrace({ pick: 'SWAPPED', why: src, ctx: v.ctx, phase: v.phase });
  revSay('on', true, null, { still: revStill.dom });
  revHud();
  return 'on';
}

/** Swap back. `why` 'asked' | 'safe' | 'left'. */
function revOff(why = 'asked') {
  if (!rev.on) return 'not on';
  // Her belt back on her and the collar off you, now (1.564.0).
  if (typeof rvkClear === 'function') rvkClear(why);
  // Her moves, hands, knees and look (1.565.0).
  if (typeof rvmClear === 'function') rvmClear();
  // A toy she had drawn partway out, seated; her phone away (1.567.0).
  if (typeof rvtClear === 'function') rvtClear();
  // Her fist out of your hair (1.574.0).
  if (typeof rvhClear === 'function') rvhClear();
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
  // Walked out, or a key that puts you somewhere else: her line stops with
  // the game. Her aftercare line ('safe') is left to finish.
  if (why === 'left' && typeof voice !== 'undefined' && voice && voice.chloeHush) voice.chloeHush();
  if (why === 'asked') revSay('off', true, null, { still: revStill.off });
  revHud();
  return 'off';
}

/** The safeword: she stops, comes to you, her hand in your hair — then back. */
function revSafe(who = 'you') {
  if (!rev.on) return 'not on';
  // Whatever she was saying stops mid-word, and what she was about to say is
  // never said: the safeword wins over her voice too (1.563.0).
  if (typeof voice !== 'undefined' && voice && voice.chloeHush) voice.chloeHush();
  if (typeof audio !== 'undefined' && audio && audio.herHush) audio.herHush('safe');
  if (typeof sceneSafe === 'function') sceneSafe(who, 'rev');
  rev.dom.order = null;
  rev.care = { t: 0, said: false };
  revArmStop();
  // And her belt and the collar (1.564.0): a swing stops where it is and she
  // lets go of the strap; the collar comes off at once.
  if (typeof rvkSafe === 'function') rvkSafe();
  // And her fist in your hair (1.574.0): open, this instant.
  if (typeof rvhSafe === 'function') rvhSafe();
  // And her moves (1.565.0): a hold, a grip, a hand on your chin — all off.
  if (typeof rvmSafe === 'function') rvmSafe();
  // And the toys (1.567.0): a draw stops where it is and goes back to its
  // seat, her hand comes off it, and her remote switches off.
  if (typeof rvtSafe === 'function') rvtSafe();
  // And her mood (1.583.0): no sternness, no excitement, no beg owed — care.
  if (typeof rmoodSafe === 'function') rmoodSafe();
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
  // Begging her (1.583.0, src/49-revmood.js): "spank me", "harder", "whip
  // me", "punish me", "pull my hair", "pull my collar" — in a sentence.
  const bw = typeof rmoodWords === 'function' ? rmoodWords(t) : null;
  if (bw) return bw;
  // Her belt and the collar (1.564.0), asked for — or asked to put away.
  if (/^((put |take )?(your |the )?belt (back|away)( on)?|belt back|(vrati|stavi) (si )?remen|remen natrag|remets? (ta )?ceinture)$/.test(t)) return 'rev.beltback';
  if (/^((please )?(use |get |take off |take out )?(your |the |a )?belt( on me| please)?|belt me|whip me( with (your|the) belt)?|(uzmi |daj )?(svoj )?remen|remenom|(prends |utilise )?(ta |la )?ceinture)$/.test(t)) return 'rev.belt';
  if (/^((take |get )?(the |my )?collar off( me)?|(take |get )off (the |my )?collar|unclip( me)?|unleash me|(skini|makni) (mi )?(ogrlicu|povodac)|(enleve|retire)[- ]moi (le |ce )?collier)$/.test(t)) return 'rev.uncollar';
  if (/^((please )?collar me|put (the |a |your )?collar on me|put (a |the )?leash on me|leash me|(the )?collar( please)?|(stavi mi |daj mi )?(ogrlic[au]|povodac)|mets[- ]moi (le |ton |un )?collier|(le |un )?collier)$/.test(t)) return 'rev.collar';
  t = t.replace(/^(ok(ay)?|yes|da|dobro|oui|d'accord)( |$)/, '').replace(/ (for you|mistress|ma'?am|madam|chloe)$/, '').trim();
  // The toy you are wearing, in her hands (1.567.0, src/49-revtoys.js):
  // drawn out a little and back, teased, twisted, pushed back in; and her
  // remote, on, up, down, off. "pull it out" is her drawing it partway — the
  // whole line, so it never takes a sentence that only mentions a toy.
  const tw = typeof rvtWords === 'function' ? rvtWords(t) : null;
  if (tw) return tw;
  // Your hair in her fist (1.574.0, src/49-revpull.js): "pull my hair", "draw me in".
  const hw = typeof rvhWords === 'function' ? rvhWords(t) : null;
  if (hw) return hw;
  // Her hip tease and her hug and kiss (1.569.0, src/49-revmoves.js).
  if (/^((come on |go on )?show me (your|what you('ve| have) got|some) ?(moves|got)?( then| babe| please)?|show me what you('ve| have) got|show off( for me)?|dance for me|(pokazi|pokazes) mi( sto znas| svoje pokrete| pokrete)?|montre[- ]moi( ce que tu sais faire| tes mouvements)?)$/.test(t)) return 'rev.move:thrust';
  // Lying behind you and holding you (1.573.0, src/49-revmoves.js): "spoon
  // me" anywhere; "cuddle me", "hold me", "zagrli me" and "câlin" mean it on
  // the cot (on your back they are still her hug, 1.569.0).
  if (/^((please |come |come and |let'?s )?spoon( me| with me)?( please)?|be my (big )?spoon|(please )?(cuddle|hold) me( close| tight)?( please)?|cuddle( with me)?|(zagrli|mazi) me u krevetu|lezi (iza|uz) mene|(fais|fait)[- ]moi un calin( au lit)?|un calin|calin|serre[- ]moi contre toi)$/.test(t)) {
    const vv = revView();
    const forced = /spoon|krevetu|lezi|calin|contre toi/.test(t);
    if (forced || !(vv && vv.ctx === 'back')) return 'rev.move:spoon';
  }
  if (/^(zagrli me)$/.test(t)) {
    const vv = revView();
    if (vv && vv.onBed && vv.ctx !== 'back') return 'rev.move:spoon';
  }
  if (/^((please )?(hug|kiss|cuddle|hold) me( please)?|(give me |i want )?a (hug|kiss)( please)?|come here and (hug|kiss) me|(zagrli|poljubi) me|zagrljaj|pusu|(fais|fait)[- ]moi un (calin|bisou)|embrasse[- ]moi|serre[- ]moi( dans tes bras)?)$/.test(t)) return 'rev.move:hug';
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
  // Your legs' ladder (1.566.0): "left leg up", "both legs up", "higher",
  // "legs down" — see `liftWords` in 49-auto.js; and "wider".
  const lw = typeof liftWords === 'function'
    ? liftWords(t, !!(v && (v.liftL || v.liftR || (v.phase === 'cradle' && !v.legsDown)))) : null;
  if (lw) return 'rev.ask:' + lw;
  if (/^((spread |open )?(my |your |the |them |legs )?(even |a bit |bit )?wider|(jos |malo )*sire|rasiri (ih |noge )?(jos|vise|sire)|plus ecartees?|ecarte encore)$/.test(t)) return 'rev.ask:legs.wider';
  if (/^((i'?ll )?(spread|open) (my |your |the )?(legs|arms)( wide| apart| wider)?|legs (apart|open|wide)|spread( them)?|rasiri( noge| ruke)?|razmakni noge|ecarte( les jambes| les bras)?)$/.test(t)) return arms ? 'rev.ask:arms.wide' : 'rev.ask:legs.spread';
  if (/^((put |bring |close )?(my |your |the )?(legs|arms) (together|in|down|closed)|(close|shut) (my |your )?legs|together|skupi( noge| ruke)?|spoji noge|serre( les jambes)?)$/.test(t)) return arms ? 'rev.ask:arms.down' : 'rev.ask:legs.close';
  if (/^(arms (out|wide)( to the sides?)?|ruke u stranu|bras ecartes)$/.test(t)) return 'rev.ask:arms.wide';
  if (/^(arms (in|down)|ruke (uz tijelo|dolje)|bras le long du corps)$/.test(t)) return 'rev.ask:arms.down';
  if (/^(look at (her|chloe|you)|i'?m looking( at you)?|pogledaj je|gledam te|je te regarde)$/.test(t)) return 'rev.ask:look';
  if (/^(look down|eyes down|spusti pogled|baisse les yeux)$/.test(t)) return 'rev.ask:look.down';
  if (/^(turn( around| over)?|roll over|okreni se|retourne[- ]toi)$/.test(t)) return 'rev.ask:turn';
  // Bent over the cot's edge (1.565.0: she spanks you there too).
  if (/^(bend over( the (cot|bed|edge))?|over the edge|(na rub|preko ruba)( kreveta)?|sagni se|penche[- ]toi)$/.test(t)) return 'rev.ask:flat.edge';
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
  if (name.startsWith('rev.beg:') && typeof rmoodBeg === 'function') return rmoodBeg(name.slice(8));
  // Asked for her belt, the collar or her fist in your hair the plain way:
  // it stirs her too, if less than begging (1.583.0).
  if ((name === 'rev.belt' || name === 'rev.collar' || name === 'rev.hair:pull') && !rev.care
    && typeof rmoodExcite === 'function') rmoodExcite(0.3, 'asked: ' + name.slice(4));
  if ((name === 'rev.belt' || name === 'rev.beltback' || name === 'rev.collar' || name === 'rev.uncollar')
    && typeof rvkAsk === 'function') {
    return rvkAsk(name.slice(4));
  }
  if (name.startsWith('rev.move:') && typeof rvmAskMove === 'function') return rvmAskMove(name.slice(9));
  if (name.startsWith('rev.hair:') && typeof rvhAsk === 'function') return rvhAsk(name.slice(9));
  if ((name.startsWith('rev.toy:') || name.startsWith('rev.remote:')) && typeof rvtAsk === 'function') {
    return rvtAsk(name.slice(4));
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
  // Chloe lying behind you (1.573.0): she gets up off the cot first, and then
  // it is done — nobody rolls over through her.
  if (typeof rvmSpoonAsk === 'function' && rvmSpoonAsk(name)) {
    revTrace({ pick: 'you:' + name, why: 'after she is up' });
    return true;
  }
  // A pose asked while the order is "be still" is a move.
  rev.dom.moved += 1;
  // On her leash (1.564.0): the leash's own poses, and nothing that would
  // have you walk out of the collar.
  const lr = typeof rvkLeashAsk === 'function' ? rvkLeashAsk(name) : null;
  if (lr !== null) {
    const O = rev.dom.order;
    if (lr === true && O && !O.ext) { O.ext = 1; O.t0 = Math.min(rev.clock, O.t0 + 6); }
    revTrace({ pick: 'you:' + name + ' (leash)', why: lr === true ? 'asked' : String(lr) });
    return lr;
  }
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
  // Your belt and the collar are Chloe's (1.564.0): the backslash asks for
  // her belt (or for it back on her), = for the collar (or off you).
  if (e.code === 'Backslash' || e.code === 'Equal') {
    e.preventDefault();
    if (typeof rvkAsk === 'function') {
      const belt = e.code === 'Backslash';
      const r = rvkAsk(belt ? (rvkBeltInHand() && !rvkBeltRound() ? 'beltback' : 'belt')
        : (rvkCollarOn() ? 'uncollar' : 'collar'));
      if (typeof toast === 'function') toast(r.label);
    }
    return true;
  }
  // Her moves, asked by key (1.569.0): - her hip tease beside the cot,
  // Shift+- her hug and kiss (you on your back on the cot).
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
    e.preventDefault();
    if (typeof rvmAskMove === 'function') {
      const r = rvmAskMove(e.shiftKey ? 'hug' : 'thrust');
      if (typeof toast === 'function') toast(r.label);
    }
    return true;
  }
  // Your hair in her fist (1.574.0): . the pull from behind, , the kneeling draw.
  if (e.code === 'Period' || e.code === 'Comma') {
    e.preventDefault();
    if (typeof rvhAsk === 'function') {
      const r = rvhAsk(e.code === 'Period' ? 'pull' : 'draw');
      if (typeof toast === 'function') toast(r.label);
    }
    return true;
  }
  const m = /^(?:Digit|Numpad)([1-7])$/.exec(e.code);
  if (!m) return false;
  e.preventDefault();
  const v = revView();
  if (!v) return true;
  const n = +m[1];
  // SHIFT AND 7 (1.573.0): Chloe lies down behind you and holds you.
  if (e.shiftKey && n === 7 && typeof rvmAskMove === 'function') {
    const r = rvmAskMove('spoon');
    if (typeof toast === 'function') toast(r.label);
    return true;
  }
  // SHIFT AND A NUMBER (1.566.0): your legs' ladder. 1 the left leg up, or
  // down again; 2 the right; 3 both up, or down; 4 higher; 5 wider; 6 lower.
  if (e.shiftKey && n <= 6) {
    const up = (k) => revRank(k) > 0;
    const a = n === 1 ? (up(v.liftL) ? 'legs.leftdown' : 'legs.leftup')
      : n === 2 ? (up(v.liftR) ? 'legs.rightdown' : 'legs.rightup')
        : n === 3 ? (revBothUp(v) ? 'legs.down' : 'legs.bothup')
          : n === 4 ? 'legs.higher' : n === 5 ? 'legs.wider' : 'legs.lower';
    const r = revAsk(a);
    if (r !== true && typeof toast === 'function') toast(a + ': ' + r);
    return true;
  }
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
  // Kneeling, sitting, or on her way up (1.565.0): turned, never walked. And
  // a slow walk when a move asks for one (her circles round the cot).
  const held = typeof rvmHold === 'function' && rvmHold();
  const slow = typeof rvm !== 'undefined' && rvm.slow ? rvm.slow : 1;
  if (typeof rvm !== 'undefined') rvm.slow = 0;
  if (G) {
    const dx = G.x - C.x, dz = G.z - C.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { C.goal = null; }
    else if (held) { want = 0; }
    else {
      want = Math.min(REV.walk * slow, d * 2.2);
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

/**
 * Put her figure where she is: her body (`rvmBody` in src/49-revmoves.js —
 * standing, walking, kneeling, sitting on the cot's edge), the bend of her
 * knees standing (`crouchSolve`, the player's own crouch), and her bow and
 * the turn of her trunk laid up her spine. Her arms are solved after this
 * (`rvmTick`, `rvkTick`), on the pose this leaves.
 */
const REV_SPINE = ['spine01', 'spine02', 'spine03'];
const REV_BOW = [0.40, 0.35, 0.25], REV_TURN = [0.30, 0.35, 0.35];
const _rvT = new THREE.Quaternion(), _rvW = new THREE.Quaternion();
const _rvY = new THREE.Vector3(0, 1, 0), _rvZ = new THREE.Vector3(0, 0, -1);
function revDriveChloe(dt) {
  if (!you || !you.drive) return;
  const C = rev.ch, A = rev.arm;
  const Bd = typeof rvmBody === 'function' ? rvmBody(dt)
    : { clip: C.sp > 0.2 ? 'walk' : 'idle', fade: 0.2, speed: C.sp > 0.2 ? Math.min(2, Math.max(0.6, C.sp / 0.92)) : 1 };
  const B = typeof rvm !== 'undefined' ? rvm.body : null;
  const w = B && B.mode === 'stand' && !(B.was && B.was !== 'stand' && B.t < 1) ? B.w : 0;
  let cr = null;
  if (w > 0.003 && typeof crouchSolve === 'function') {
    const st = you.fig.state;
    cr = crouchSolve(w, 'idle', st && st.curT ? st.curT : 0, B.push || 0);
  }
  if (cr) { crouchAims(cr, 0, 0, 0, 0, 0); A.posed = true; } else if (A.posed) revArmClear();
  // The bow (over the cot, down to you) and the turn of her trunk.
  const bow = B ? B.bow : 0, turn = B ? B.turn : 0, cb = cr ? cr.b : 0;
  if (Math.abs(bow) > 0.003 || Math.abs(turn) > 0.003) {
    for (let i = 0; i < 3; i++) {
      _rvW.setFromAxisAngle(_rvZ, (cr ? cb * [0.45, 0.33, 0.22][i] : 0) + bow * REV_BOW[i]);
      _rvT.setFromAxisAngle(_rvY, turn * REV_TURN[i]);
      armAimQ(you.fig, REV_SPINE[i], _rvT.multiply(_rvW));
    }
    A.bowed = true;
  } else if (A.bowed) {
    if (!cr) for (const n of REV_SPINE) you.fig.aim(n, 0, 0, 1, 0);
    A.bowed = false;
  }
  // Lying behind you on the cot (1.573.0): her place and her whole turn are
  // the spoon's (`rvmSpoonDrive`), on Baye's own frame.
  const sp = typeof rvmSpoonDrive === 'function' ? rvmSpoonDrive() : null;
  if (sp) {
    rev.lastDrive = you.drive({ at: [sp.at.x, sp.at.y, sp.at.z], yaw: C.yaw + Math.PI / 2, quat: sp.quat, pitch: 0,
      seen: true, wet: false, clip: Bd.clip, fade: Bd.fade, speed: Bd.speed, hat: !(typeof rvmHatOff === 'function' && rvmHatOff()) });
    return;
  }
  const sit = typeof rvmSitAt === 'function' ? rvmSitAt() : null;
  const cd = cr ? cr.drop : 0, cbk = cr ? cr.back : 0;
  rev.lastDrive = you.drive({
    at: sit ? [sit.x, sit.y, sit.z] : [C.x + Math.sin(C.yaw) * cbk, C.y - cd, C.z + Math.cos(C.yaw) * cbk],
    yaw: C.yaw + Math.PI / 2, pitch: 0, seen: true, wet: false,
    clip: Bd.clip, fade: Bd.fade, speed: Bd.speed, hat: !(typeof rvmHatOff === 'function' && rvmHatOff()),
  });
}

function revArmClear() {
  const A = rev.arm;
  if (!you || !you.fig) return;
  if (A.posed && typeof CROUCH_BONES !== 'undefined') for (const b of CROUCH_BONES) you.fig.aim(b, 0, 0, 1, 0);
  A.posed = false;
  A.bowed = false;
  if (typeof crouchPosed !== 'undefined') crouchPosed = false;
}

// ── Chloe's hand ─────────────────────────────────────────────────────────────
//
// Since 1.565.0 the swing is src/49-revmoves.js's (`rvmSpankStart`,
// `rvmSpankTick`): the place planned and gone to, her knees or a bend, her
// palm solved on to the spot and the slap on the frame it lands. `rev.arm`
// is still its state.

/** Start a round: `n` slaps, how hard. On the cot, standing, kneeling, on all fours. */
function revSpankRound(n, why) {
  if (!rev.on) return 'off';
  const v = revView();
  if (!v || !(v.ctx === 'front' || (REV.standSpank && (v.ctx === 'stand' || v.ctx === 'kneel' || v.ctx === 'fours')))) return 'notthere';
  return rvmSpankStart(n, why);
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
  revTrace({ pick: 'slap', why: (hit ? hit.reg : 'cheek') + (on ? ' (cot)' : ' (' + (rev.arm.ctx || '?') + ')'), k: +k.toFixed(1),
    u: last ? +last.u.toFixed(2) : null });
}

/** The swing a frame (`rvmSpankTick`); the aftercare's hand is a move of hers now. */
function revArmTick(dt) {
  if (rev.arm.mode === 'spank' && typeof rvmSpankTick === 'function') rvmSpankTick(dt);
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
  revSay('order', true, O.say, { order: id, still: revStill.order(rev.dom.order) });
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
  // Sterner, less time (1.583.0): 12.5 s at her gentlest, 7.5 at her sternest.
  const wait = +((O.wait || REV.orderWait) * (typeof rmoodWaitK === 'function' ? rmoodWaitK() : 1)).toFixed(1);
  if (age > wait) revOrderEnd(false, 'not done in ' + wait + ' s');
}

function revOrderEnd(kept, why) {
  const D = rev.dom, id = D.order ? D.order.id : '?';
  D.order = null;
  // A soft one (1.573.0: "curl up for me", before she lies down with you):
  // not a test. Kept, what comes next is her answer; not, it is let go.
  if (REV_ORDERS[id] && REV_ORDERS[id].soft) {
    if (kept) D.obey++;
    revTrace({ pick: (kept ? 'kept:' : 'let go:') + id, why, heat: +D.heat.toFixed(2) });
    revHud();
    return;
  }
  // Her mood (1.583.0): sterner for a miss, and more for a run of them;
  // softer and warmer for each kept.
  if (typeof rmoodKept === 'function') { if (kept) rmoodKept(id, D.streak + 1); else rmoodMissed(id); }
  if (kept) {
    D.obey++; D.streak++;
    D.heat = Math.min(1, D.heat + 0.08);
    D.punish = 0;
    revSay('good', true, null, { order: id, still: revStill.dom });
    D.next = rev.clock + 2.2 + Math.random() * 2;
  } else {
    D.miss++; D.streak = 0;
    D.punish = 1;
    revSay('slow', true, null, { order: id, still: revStill.dom });
    D.next = rev.clock + 1.4;
  }
  revTrace({ pick: (kept ? 'kept:' : 'ignored:') + id, why, heat: +D.heat.toFixed(2), obey: D.obey, miss: D.miss });
  revHud();
}

/** The worn toys she has a remote for: the Lovense, the plug, the wand (1.572.0). */
function revToys() {
  const w = jadrija && jadrija.worn ? jadrija.worn() : [];
  return w.filter((k) => k === 'lovense' || k === 'wand' || /plug/.test(k));
}

/** Her decision: score what she could do where you are, and pick one. */
function revDecide() {
  const D = rev.dom, v = revView();
  D.decisions++;
  // A beg of yours she owes you first (1.583.0, `rmoodBegDecide`).
  const bg = typeof rmoodBegDecide === 'function' ? rmoodBegDecide(v) : null;
  if (bg) { revTrace({ pick: bg, ctx: v ? v.ctx : null, heat: +D.heat.toFixed(2) }); return bg; }
  // Her belt and the collar first (1.564.0, `rvkDecide`): off, on, a round of
  // the belt, and all she does with you on the leash.
  const kit = typeof rvkDecide === 'function' ? rvkDecide(v) : null;
  if (kit) {
    if (kit !== 'busy') revTrace({ pick: 'kit:' + kit, ctx: v ? v.ctx : null, heat: +D.heat.toFixed(2) });
    return kit;
  }
  const ctx = v ? v.ctx : null;
  if (!ctx) { D.next = rev.clock + 1; revTrace({ pick: '-', why: 'you are between poses', phase: v ? v.phase : null }); return null; }
  const cands = [];
  const recent = (id) => D.last.slice(-3).filter((x) => x === id).length;
  for (const id of Object.keys(REV_ORDERS)) {
    const O = REV_ORDERS[id];
    const w = O.ctx[ctx];
    if (!w) continue;
    if (!O.still && revKept(O, v, rev)) continue;     // already so: no order in it
    if (O.can && !O.can(v)) continue;                 // nothing in it here (1.566.0)
    let s = O.w * w * (0.6 + 0.5 * D.heat);
    s *= recent(id) ? 0.25 : 1;
    cands.push({ id: 'order:' + id, s });
  }
  // On her front on the cot — and since 1.565.0 standing, kneeling or on all
  // fours, where she comes to your side to do it. Not with her belt or the
  // leash in that hand (1.564.0).
  const full = typeof rvkHandFull === 'function' && rvkHandFull();
  const floorW = { stand: 0.6, kneel: 0.5, fours: 0.75 };
  const canSpank = !full && (ctx === 'front' || (REV.standSpank && !!floorW[ctx]));
  if (canSpank) {
    cands.push({ id: 'spank', s: (D.punish ? 4 : (ctx === 'front' ? 1.0 : floorW[ctx]) + 1.2 * D.heat + 0.25 * D.streak)
      * (recent('spank') > 1 ? 0.5 : 1) });
  }
  // Her moves (1.565.0, src/49-revmoves.js): circling the cot, her hand in
  // your hair, holding you down, sitting by you, your chin, your nape.
  if (typeof rvmCands === 'function') for (const c of rvmCands(ctx, D)) cands.push(c);
  // Her fist in your hair, when she is excited (1.574.0, src/49-revpull.js).
  if (typeof rvhCands === 'function') for (const c of rvhCands(ctx, D)) cands.push(c);
  // The remote: since 1.567.0 a move of hers with the phone in her hand
  // (`move:remote`, src/49-revtoys.js, among `rvmCands`); the bare buzz is
  // what is left without that file.
  const toys = revToys();
  if (toys.length && D.obey >= 1 && typeof rvtCands !== 'function') cands.push({ id: 'buzz', s: 0.25 + 0.6 * D.heat });
  if (rev.walk && revGap() > 2.2) cands.push({ id: 'prowl', s: 0.6 });
  else cands.push({ id: 'prowl', s: 0.25 });
  // (And with her belt in her hand, the cot is where she wants you.)
  if ((D.punish || (full && typeof rvkBeltInHand === 'function' && rvkBeltInHand())) && !canSpank) {
    // The spanking you have earned wants you where she can give it.
    const want = ctx === 'stand' ? 'order:cot' : 'order:front';
    const c = cands.find((x) => x.id === want);
    if (c) c.s *= 3;
  }
  // Her mood on all of it (1.583.0, `rmoodWeight`): stern, more spanks,
  // orders, the hair and holding you down; warm, her hand in your hair, the
  // hug and the spoon; excited, more of everything with energy in it.
  if (typeof rmoodWeight === 'function') for (const c of cands) c.s *= rmoodWeight(c.id);
  const tot = cands.reduce((a, c) => a + c.s, 0);
  let x = Math.random() * tot, pick = cands[cands.length - 1];
  for (const c of cands) { x -= c.s; if (x <= 0) { pick = c; break; } }
  const alt = cands.slice().sort((a, b) => b.s - a.s).slice(0, 4).map((c) => c.id + ' ' + c.s.toFixed(2)).join(', ');
  D.last.push(pick.id.replace(/^(order|move):/, ''));
  if (D.last.length > 8) D.last.shift();
  const gk = typeof rmoodGapK === 'function' ? rmoodGapK() : 1;
  D.next = rev.clock + (REV.gap[0] + (REV.gap[1] - REV.gap[0]) * Math.random()) * gk;
  if (pick.id.startsWith('order:')) {
    revOrder(pick.id.slice(6), 'alt: ' + alt);
    D.next = rev.clock + REV.orderWait + 1;
  } else if (pick.id === 'spank') {
    const n0 = D.punish ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * (1 + D.heat * 3));
    // More the sterner or more excited she is, fewer the gentler (1.583.0).
    const n = typeof rmoodSpanks === 'function' ? rmoodSpanks(Math.min(4, n0), !!D.punish) : Math.min(4, n0);
    const r = revSpankRound(n, (D.punish ? 'punishment' : 'mood') + ' | alt: ' + alt);
    D.punish = 0;
    if (r !== true) revTrace({ pick: 'spank:' + r });
    D.next = rev.clock + (4 + n * 1.2) * Math.min(1, gk + 0.2);
  } else if (pick.id.startsWith('move:')) {
    const r = rvmStart(pick.id.slice(5), 'mood | alt: ' + alt);
    if (r !== true) revTrace({ pick: pick.id + ':' + r });
    D.next = rev.clock + 3;
  } else if (pick.id.startsWith('hair:') && typeof rvhChoose === 'function') {
    const r = rvhChoose(pick.id, 'mood | alt: ' + alt);
    if (r !== true) revTrace({ pick: pick.id + ':' + r });
    D.next = rev.clock + 3;
  } else if (pick.id === 'buzz') {
    const k = toys[Math.floor(Math.random() * toys.length)];
    const secs = 5 + Math.round(6 * D.heat);
    const r = jadrija.signal ? jadrija.signal(k, true, secs) : 'none';
    revSay('buzz', true, null, { still: revStill.dom });
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
    if (Math.random() < 0.4) revSay('prowl', false, null, { still: revStill.dom });
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
  // Her last contact, measured against her palm as it was drawn (1.565.0).
  if (typeof rvmMeasure === 'function') rvmMeasure();
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
      && !rev.care && v.ctx && !(typeof rvkCollarOn === 'function' && rvkCollarOn())) {
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
    // At her face; or once at a point a move of hers asks (1.573.0: your two hands).
    const Hc = rev.lookAtP ? rev.lookAtP.clone() : revChloeHead(new THREE.Vector3()), O = camera.position;
    if (rev.lookTo <= 0) rev.lookAtP = null;
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
  // Her mood a frame (1.583.0): the waves of her excitement, her sternness easing.
  if (typeof rmoodTick === 'function') rmoodTick(dt);
  if (rev.care) { revCareTick(dt, v); if (!rev.on) return; }
  else {
    rev.dom.heat += (REV.heatRest - rev.dom.heat) * (1 - Math.exp(-dt / REV.heatTau));
    revOrderTick(dt, v);
  }
  const busy = typeof rvmBusy === 'function' && rvmBusy();
  if (!rev.care && rev.dom.on) {
    if (!rev.dom.order && rev.arm.mode !== 'spank' && !busy && rev.clock >= rev.dom.next) revDecide();
  }
  // Idling: facing you — not while she stands square to the cot with her
  // belt, and not with you on her leash (she leads, or faces your neck), and
  // not in the middle of a move of hers, which turns her itself.
  const kitFace = typeof rvkBeltRound === 'function' && (rvkBeltRound() || rvkCollarOn());
  if (!rev.care && !rev.ch.goal && rev.arm.mode == null && !kitFace && !busy) rev.ch.face = revBone('pelvis', new THREE.Vector3()) || rev.ch.face;
  if (kitFace && !rev.ch.goal && !rev.ch.face) rev.ch.face = revBone('pelvis', new THREE.Vector3());
  revDriveChloe(dt);
  // Her belt and the collar (1.564.0): her arms solved, the strap stepped.
  if (typeof rvkTick === 'function') rvkTick(dt);
  // Her hand on a toy you wear, her phone (1.567.0): the last contact
  // measured, a draw going back, a move you asked for.
  if (typeof rvtTick === 'function') rvtTick(dt);
  // Her fist in your hair (1.574.0): its asks of her arms, before they are solved.
  if (typeof rvhTick === 'function') rvhTick(dt);
  // Her moves, her hands, her look (1.565.0).
  if (typeof rvmTick === 'function') rvmTick(dt);
  revCamera(dt);
  revHud();
}

/** The safeword's end: to your head, a hand on your hair, a soft line, back. */
function revCareTick(dt, v) {
  const K = rev.care;
  K.t += dt;
  if (!K.go) {
    // To your head — kneeling by it if it is down — and her hand on your hair
    // (1.565.0: a move of hers, `care`, with her palm solved on to it and
    // her fingers soft; it says when her hand is there).
    K.go = true;
    rev.arm.mode = 'care';
    K.how = typeof rvmStart === 'function' ? rvmStart('care', 'safeword') : 'none';
  }
  if (!K.said && K.t > 0.4) { K.said = true; revSay('care', true, null, { still: revStill.care }); }
  const M = typeof rvm !== 'undefined' ? rvm.move : null;
  if (K.handAt == null && ((M && (M.id === 'care' || M.id === 'spoon') && M.handOn) || (K.how !== true && K.t > 1.5))) K.handAt = K.t;
  // Lying with you when you said it (1.573.0): she holds you through it, gets
  // up the way she came, and only then do the roles go back.
  if (M && M.id === 'spoon') {
    if (K.t > 45) { rev.arm.mode = null; revOff('safe'); }
    return;
  }
  if (K.how !== true && K.handAt != null && jadrija.petTouch) jadrija.petTouch(Math.min(1, (K.t - K.handAt) / 0.8));
  // Four and a half seconds of her hand, then the roles go back — and not in
  // the middle of her saying it's over (1.563.0: her line is a round trip
  // now, a second or three), up to fourteen seconds in all.
  const talking = typeof voice !== 'undefined' && voice && voice.chloeBusy && voice.chloeBusy();
  if ((K.handAt != null && K.t - K.handAt > 4.5 && !talking) || K.t > 14) {
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
  // Her hand lifting your chin, or holding your hair at the nape (1.565.0):
  // your head tipped up toward her, a little rolled.
  // Lying with her (1.573.0): your own breath, a few millimetres and a nod.
  const cb = typeof rvmCamBreath === 'function' ? rvmCamBreath() : 0;
  if (cb) { camera.position.y += 0.005 * cb; camera.rotateX(-0.008 * cb); }
  const tl = typeof rvmCamTilt === 'function' ? rvmCamTilt() : null;
  if (tl && (tl[0] > 0.002 || tl[1] > 0.002)) { camera.rotateX(tl[0]); camera.rotateZ(tl[1]); }
  // A toy drawn out or pushed back in (1.567.0): a shiver.
  const sv = typeof rvtCamTilt === 'function' ? rvtCamTilt() : null;
  if (sv) { camera.rotateX(sv[0]); camera.rotateZ(sv[1]); }
  // Your head pulled back by your hair (1.574.0): your view with it.
  const hv = typeof rvhCamTilt === 'function' ? rvhCamTilt() : null;
  if (hv && (hv[0] > 0.002 || Math.abs(hv[1]) > 0.002)) { camera.rotateX(hv[0]); camera.rotateZ(hv[1]); }
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
  const kitTag = [typeof rvkHudTag === 'function' && rev.on ? rvkHudTag() : '',
    typeof rvtHudTag === 'function' && rev.on ? rvtHudTag() : ''].filter(Boolean).join(' · ');
  const txt = !rev.on ? '' : T0('rev.hud') + (rev.care ? ' · ♥' : '') + (kitTag ? ' · ' + kitTag : '')
    + (O ? '\n' + T0('rev.order') + ': ' + (lang === 'fr' ? O.hud[2] : lang === 'hr' ? O.hud[0] : O.hud[1])
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
  key: (n, shift = false) => revKey({ code: 'Digit' + n, shiftKey: !!shift, preventDefault() {} }),
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
      mood: typeof rmoodApi !== 'undefined' ? rmoodApi.state() : null,
      spot: rev.spotDbg || null, slaps: rev.slaps, gap: +revGap().toFixed(2), looking: rev.on ? revLooking() : null,
      lines: Object.assign({}, rev.said),
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
