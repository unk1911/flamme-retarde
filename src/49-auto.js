// -----------------------------------------------------------------------------
// Her autonomous mode: she moves on her own.
//
// Misha, 1 Oct 2026: *"we should support a special mode, maybe after receiving
// a special reserved command like 'engage autonomous mode', where she executes
// a sequence of commands, on her own, whatever make sense, like i am thinking
// while on the cot tummy down, after several spanks maybe she spreads legs of
// her own accord, or narrows them back, or spreads arms, or brings them
// together ... she can just sorta become reactive (like a roomba that adjusts
// to its environment), reactive to verbal cues and/or some of our gestures
// and/or just autonomously doing certain things that fit the mood"*.
//
// A ROOMBA AND NOT A ROUTINE. Nothing here is a sequence. Every few seconds
// (3-8, longer when she has settled; sooner, a second or so, right after
// something happens to her) she looks at where she is and what has just been
// done to her, scores every move she has in that place, and picks one —
// weighted, not the best, so the same evening is not the same twice:
//
//   where she is     `autoCtx`: on the cot on her front / back / side,
//                    sitting or kneeling on it, kneeling or on all fours on
//                    the floor, standing in the kabina, on the leash, in the
//                    hammock, out on the grounds or the promenade
//   what happened    the scene's own record (`sceneLog` in 90-app.js): each
//                    slap and lash as it lands, how hard and where, each tug,
//                    your hand in her hair or petting her or on her, the hose
//   what you said    the cues (`autoCueWords`) — "good girl", "be still",
//                    "more", "spread", "together", "relax", "arch", "look at
//                    me", "come here", and the same in Croatian
//   her mood         `heat`, raised by what is done to her and by "more",
//                    lowered by "relax" and by time (a 75 s fall back to a
//                    resting 0.22), and `calm`, which petting and praise fill
//
// and the moves are only ever things she already does: the asks (`askShow`
// with `who` 'auto' — her legs and arms latches, her eyes, a yawn, the rolls
// she makes on the cot, the dances), and four small ones the cot's own
// ragdoll does when its muscles are asked (`cotMove` in 43-jadrija.js: heels
// up, a wriggle, an arch, her head up), her back straightened when she is
// upright, a glance at you or away, and a little rock of the hammock. Every
// pose change is one of 1.559.3's direct transitions, so a move is one move
// and never a tour of three poses on the way to it.
//
// THE RULES, which outrank the scoring and are not scored:
//   - the safeword ends it, whoever says it, and runs the aftercare;
//   - anything you ask of her yourself is done at once and holds her own
//     moves off for 10 s (`autoDirect`);
//   - "be still" holds every move until you say something else to her;
//   - she never gets the belt or the collar out, never leaves the room or
//     the scene she is in (no walk off, no errand, no getting up off the
//     cot), and never goes into the water — those are simply not moves.
//
// Cost: the decision is a few dozen comparisons every few seconds, the
// event poll four times a second; nothing per frame but a clock.
// -----------------------------------------------------------------------------

const AUTO = {
  gap: [3, 8],          // s between her moves
  settled: 1.6,         // ...times that, once she has settled (nothing for `quiet`, heat low)
  quiet: 30,            // s with nothing done to her that counts as settled
  react: [0.8, 1.8],    // s after a slap, a tug, the hose, before she answers it
  pause: 10,            // s a thing you asked her yourself holds her own moves off
  cuePause: 6,          // ...and a cue that is itself a move ("spread", "arch")
  poll: 0.25,           // s between looks at the scene's record
  far: 14,              // m: you further from her than this and she leaves it be
  bigGap: 40,           // s at least between two big moves (a roll, a change of pose)
  heatTau: 75, heatRest: 0.22, calmTau: 60, calmRest: 0.2,
  biasLife: 25,         // s a cue's lean on her choices takes to fade
  lineGap: 11, lineP: 0.35,
  keep: 80,             // decisions kept in the trace
};

/**
 * Her lines, in her Croatian, and what they mean (`auto.g.*` in 02-i18n.js).
 * The existing bark style: short, a laugh in them, and not one every move.
 */
const AUTO_SAY = {
  on: [['Mm... dobro. Sad ja vodim, hehe.', 'on0'], ['Samo gledaj.', 'on1'], ['Hehe, pusti mene.', 'on2']],
  off: [['Dobro, opet si ti glavna.', 'off0'], ['Mm, vraćam ti uzde.', 'off1']],
  open: [['Ovako?', 'open0'], ['Mm... gledaš?', 'open1'], ['Hehe, izvoli.', 'open2']],
  close: [['Hehe, ne još.', 'close0'], ['Mm, polako.', 'close1']],
  hit: [['Au! ...hehe.', 'hit0'], ['Mm, još jednom.', 'hit1'], ['Joj... peče.', 'hit2']],
  look: [['Što radiš tamo?', 'look0'], ['Hej, ti.', 'look1']],
  calm: [['Mmm...', 'calm0'], ['Lijepo mi je.', 'calm1']],
  good: [['Hehe, tvoja dobra cura.', 'good0'], ['Mm, znam.', 'good1']],
  still: [['Dobro... ne mičem se.', 'still0'], ['Mirna sam, mirna.', 'still1']],
  more: [['Još? Hehe, dobro.', 'more0'], ['Mm, može.', 'more1']],
  tug: [['Evo me, evo.', 'tug0'], ['Hehe, idem.', 'tug1']],
  ham: [['Ljuljaj me... ili ću sama.', 'ham0']],
  play: [['Gledaj ovo!', 'play0'], ['Hehe, za tebe.', 'play1']],
  hose: [['Hej! Hehe, mokra sam!', 'hose0']],
  come: [['Dođi ti meni.', 'come0']],
};

// ── the words ────────────────────────────────────────────────────────────────

/** A line as the matchers want it: lower case, no diacritics, no marks. */
function autoNorm(text) {
  return String(text || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[.!?,;:"“”]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The reserved commands, typed or heard (`auto.on` / `auto.off`): the whole
 * line. English, Croatian, French. "autonomous mode" alone is on.
 */
function autoWords(text) {
  const t = autoNorm(text);
  if (!t) return null;
  const noun = '(autonomous|autonomy|autopilot|auto|samostaln\\w*|autonomn\\w*)';
  if (new RegExp('^(disengage|disable|stop|end|exit|quit|cancel|turn off|switch off|deactivate|leave)( the| your)? '
    + noun + '( mode)?$').test(t)) return 'auto.off';
  if (new RegExp('^' + noun + '( mode| nacin| rezim)? (off|disengaged|stop|ends?)$').test(t)) return 'auto.off';
  if (/^(iskljuci|ugasi|prekini|zaustavi|stop) (autonomni|samostalni|samostalno|auto)( nacin| rezim)?( rada)?$/.test(t)) return 'auto.off';
  if (/^(desactive[rz]?|arrete[rz]?|coupe[rz]?) (le )?(mode )?(autonome|auto)$/.test(t)) return 'auto.off';
  if (/^((engage|enable|start|activate|turn on|switch on|go|enter)( the| your)? )?(autonomous|autonomy|autopilot)( mode)?( on| engaged| go)?$/.test(t)) return 'auto.on';
  if (/^auto( mode)? on$/.test(t)) return 'auto.on';
  if (/^((ukljuci|pokreni|upali) )?(autonomni|samostalni) (nacin|rezim)( rada)?$/.test(t)) return 'auto.on';
  if (/^(samostalno|budi samostalna|sama|ajde sama)$/.test(t)) return 'auto.on';
  if (/^((active[rz]?|lance[rz]?) )?(le )?mode autonome$/.test(t)) return 'auto.on';
  return null;
}

/** The safeword, the whole line — `beltWords`' own list, which stands for all of it. */
function autoSafeword(text) {
  return /^(red|crvena|crveno|rouge|safe ?word|stop( it)?|stani|dosta|enough|arrete)$/.test(autoNorm(text));
}

/**
 * THE CUES, matched in the page while the mode is on, in a short line (seven
 * words at the most, so a sentence that happens to contain "more" is still a
 * sentence). Answers a cue name, or null. `sub` 'arms' when the arms were
 * named ("spread your arms", "arms together").
 */
function autoCueWords(text) {
  const t = autoNorm(text);
  if (!t || t.split(' ').length > 7) return null;
  const arms = /\b(arms?|ruke|rukama|bras)\b/.test(t);
  if (/\b(be still|stay still|hold still|keep still|don'?t move|do not move|freeze|stop moving|ne mici se|ne mici|budi mirna|mirno|miruj|ne bouge\w*|reste immobile|immobile)\b/.test(t)) return { cue: 'still' };
  if (/\b(relax|calm down|settle( down)?|rest|easy|opusti\w*|smiri se|polako|detends?[- ]toi|doucement)\b/.test(t)) return { cue: 'relax' };
  if (/\b(together|close (your |them|those )?(legs|arms|up)?|legs closed|skupi\w*|spoji\w*|zajedno|zatvori\w*|serre\w*)\b/.test(t)) return { cue: 'together', sub: arms ? 'arms' : null };
  if (/\b(spread|wider|open (your |them |those |up)|apart|rasiri\w*|razmakni\w*|sire\w*|ecarte\w*)\b/.test(t)) return { cue: 'spread', sub: arms ? 'arms' : null };
  if (/\b(arch|chest out|straighten( up)?|sit up straight|izvij\w*|uspravi se|cambre\w*)\b/.test(t)) return { cue: 'arch' };
  if (!/\bno more\b/.test(t) && /^(more|again|keep going|go on|don'?t stop|jos|jos malo|jos jednom|nastavi|encore|continue)\b/.test(t)) return { cue: 'more' };
  if (/\b(look at me|eyes on me|look here|pogledaj me|gledaj me|regarde[- ]moi)\b/.test(t)) return { cue: 'look' };
  if (/\b(come here|come to me|over here|dodi|dodji|ovamo|viens)\b/.test(t)) return { cue: 'come' };
  if (/\b(good girl|good job|that'?s it|dobra (cura|curica|djevojka|djevojcica)|dobra si|bravo|bonne fille)\b/.test(t)) return { cue: 'good' };
  return null;
}

/**
 * HER LEGS' LADDER, in words (1.566.0) — "left leg up", "right leg down",
 * "both legs up", "left leg up straight", "legs straight up", "higher",
 * "lower", "legs down"; "lijevu nogu gore", "desnu nogu dolje", "obje noge
 * gore", "više", "niže", "spusti noge"; "jambe gauche en l'air", "les deux
 * jambes en l'air", "plus haut", "plus bas". The whole line, short (eight
 * words at most), and answers an ask name off `LIFT_ASKS` in 43-jadrija.js
 * (or `legs.down`), or null. `raised` says whether a leg is up, so the
 * bare Croatian "više" — which is also "more" — is "higher" only then.
 * Matched in the page (49-ears.js, and for your own body while the roles
 * are reversed, 49-reverse.js) so it works signed out; the voice service
 * has the same words (`legs.*` in server/baye/baye.py).
 */
function liftWords(text, raised = false) {
  let t = autoNorm(text);
  if (!t || t.split(' ').length > 8) return null;
  t = t.replace(/^(ok(ay)?|now|please|baye|babe|and|then|da|sad|ajde|hajde|allez)\s+/, '')
    .replace(/\s+(please|baye|babe|molim( te)?|sad|now|s'il te plait|stp)$/, '').trim();
  if (/\b(arms?|ruk\w*|bras|mouth|usta|bouche|hair|kos\w*|cheveux)\b/.test(t)) return null;
  const leg = /\b(legs?|nog\w*|jambes?|knees?|koljen\w*|genoux?)\b/.test(t);
  const left = /\b(left|lijev\w*|gauche)\b/.test(t), right = /\b(right|desn\w*|droite?)\b/.test(t) && !/\btendue? droite\b/.test(t);
  const both = /\b(both|two|obje|obadvije|dvije|les deux)\b/.test(t);
  const upW = /\b(up|raise\w*|lift\w*|gore|digni|podigni|dizi|uzdigni|leve\w*|en l'?air|monte\w*)\b/.test(t);
  const downW = /\b(down|lower|put down|flat|dolje|spusti\w*|baisse\w*|pose\w*|descend\w*)\b/.test(t);
  const straight = /\b(straight|ravn\w*|ispruz\w*|ispruzen\w*|tendue?s?)\b/.test(t);
  if (leg && (left || right) && !(left && right)) {
    const s = left ? 'left' : 'right';
    if (downW && !upW) return 'legs.' + s + 'down';
    if (upW || straight) return 'legs.' + s + (straight ? 'straight' : 'up');
    return null;
  }
  if (leg && both && upW && !downW) return straight ? 'legs.straight' : 'legs.bothup';
  if (leg && straight && upW && !downW) return 'legs.straight';
  // "spusti noge", "legs down": the ask it always was.
  if (leg && downW && !upW && !/\b(lower|nize)\b/.test(t)) return 'legs.down';
  if (/^((a )?(bit |little |tiny |touch |even )*(higher|more up|up more)|(legs? |noge |nogu )?(jos |malo )*(vise|gore) (gore|vise)|podigni (ih |ju |je )?(jos |vise)( malo)?|(encore )?plus haut)$/.test(t)) return 'legs.higher';
  if (/^(higher|(jos )?(vise|visa))$/.test(t)) return /^higher$/.test(t) || raised ? 'legs.higher' : null;
  if (/^((a )?(bit |little |tiny |touch |even )*lower|(legs? )?(a bit |little )?lower( them)?|(malo |jos )*nize|spusti (ih |ju |je )?(malo|nize)|(encore )?plus bas)$/.test(t)) return 'legs.lower';
  return null;
}

// ── the moves ────────────────────────────────────────────────────────────────
//
// Each: where (`ctx`), a base weight, the moods it is (`tags`), whether it can
// be done now (`can`), and doing it (`go`, which answers true or a reason).
// `big` moves change her pose and are kept to one in `bigGap` s; `inv` is the
// move that undoes it, which is held off for a few seconds after it so she
// does not flip-flop, and favoured once it has been a while.

const _autoAsk = (name) => (v) => {
  if (!jadrija || !jadrija.askShow) return 'gone';
  return jadrija.askShow(name, 'auto');
};
const _autoCan = (name) => (v) => !jadrija.autoWhy(name);
const _autoCot = (kind) => (v, k) => (jadrija.autoMove({ cot: kind, k }) ? true : 'rag');

const AUTO_FRONT = { front: 1 }, AUTO_LYING = { front: 1, back: 1, side: 1 };
const AUTO_MOVES = {
  // Her legs, wherever a spread means something (not kneeling, not on her side).
  spread: { ctx: { front: 1, back: 1, stand: 1, sit: 1 }, w: 1.0, tags: ['open'], inv: 'close', say: 'open',
    can: (v) => v.legsSp < 1 && (v.ctx !== 'sit' || v.phase === 'perchHeld') && !jadrija.autoWhy('legs.spread'),
    go: _autoAsk('legs.spread') },
  close: { ctx: { front: 1, back: 1, stand: 1, sit: 1 }, w: 0.9, tags: ['close'], inv: 'spread', say: 'close',
    can: (v) => v.legsSp > 0 && !jadrija.autoWhy('legs.close'), go: _autoAsk('legs.close') },
  // Her arms, lying down (LYING) — out to the sides, and back in.
  armsOut: { ctx: AUTO_LYING, w: 0.8, tags: ['open'], inv: 'armsIn', say: 'open',
    can: (v) => !v.arms && !jadrija.autoWhy('arms.wide'), go: _autoAsk('arms.wide') },
  armsIn: { ctx: AUTO_LYING, w: 0.7, tags: ['close', 'calm'], inv: 'armsOut',
    can: (v) => !!v.arms && !jadrija.autoWhy('arms.down'), go: _autoAsk('arms.down') },
  // Her legs flat or her knees up, on her back.
  legsDown: { ctx: { back: 1 }, w: 0.5, tags: ['calm'], inv: 'legsUp',
    can: (v) => !v.legsDown, go: _autoAsk('legs.down') },
  legsUp: { ctx: { back: 1 }, w: 0.5, tags: ['open'], inv: 'legsDown',
    can: (v) => !!v.legsDown, go: _autoAsk('legs.up') },
  // HER LEGS' LADDER (1.566.0) — on her back, and her shins up on her
  // front: a leg up of her own accord (whichever, at random), both, higher
  // as she warms up, lower and down again as she calms, and wider once they
  // are up — see `LIFT` in 43-jadrija.js. Each one rung, one move.
  legUp: { ctx: { back: 0.8, front: 0.6 }, w: 0.7, tags: ['open', 'play'], inv: 'legDown', say: 'open',
    can: (v) => !v.liftL && !v.liftR && (!!v.legsDown || v.liftMode === 'front') && !jadrija.autoWhy('legs.leftup'),
    go: () => _autoAsk(Math.random() < 0.5 ? 'legs.leftup' : 'legs.rightup')() },
  bothUp: { ctx: { back: 0.8, front: 0.5 }, w: 0.6, tags: ['open', 'heat'], inv: 'legDown',
    can: (v) => (!!v.legsDown || v.liftMode === 'front') && !jadrija.autoWhy('legs.bothup'), go: _autoAsk('legs.bothup') },
  higher: { ctx: { back: 1 }, w: 0.6, tags: ['heat', 'open'], inv: 'lower',
    can: (v) => !!(v.liftL || v.liftR) && v.heat > 0.35 && !jadrija.autoWhy('legs.higher'), go: _autoAsk('legs.higher') },
  straight: { ctx: { back: 1 }, w: 0.35, tags: ['play', 'open'], inv: 'legDown', say: 'play',
    can: (v) => !!v.legsDown && !jadrija.autoWhy('legs.straight'), go: _autoAsk('legs.straight') },
  lower: { ctx: { back: 1, front: 1 }, w: 0.5, tags: ['calm'], inv: 'higher',
    can: (v) => !!(v.liftL || v.liftR) && !jadrija.autoWhy('legs.lower'), go: _autoAsk('legs.lower') },
  legDown: { ctx: { back: 1, front: 1 }, w: 0.45, tags: ['calm', 'close'], inv: 'legUp',
    can: (v) => !!(v.liftL || v.liftR), go: _autoAsk('legs.down') },
  // And further apart than "apart", once she has something to go wider with.
  wider: { ctx: { back: 1, front: 1, stand: 1 }, w: 0.6, tags: ['open', 'heat'], inv: 'close', say: 'open',
    can: (v) => v.legsSp >= 1 && v.heat > 0.4 && !jadrija.autoWhy('legs.wider'), go: _autoAsk('legs.wider') },
  // The cot's ragdoll, asked (`cotMove`).
  heels: { ctx: AUTO_FRONT, w: 0.8, tags: ['play'], say: 'look', can: (v) => v.rag, go: _autoCot('heels') },
  wiggle: { ctx: AUTO_LYING, w: 0.9, tags: ['heat', 'play'], can: (v) => v.rag, go: _autoCot('wiggle') },
  arch: { ctx: { front: 1, cotKneel: 1, sit: 1 }, w: 0.9, tags: ['open', 'heat'], say: 'open',
    can: (v) => v.rag, go: _autoCot('arch') },
  // Her head up off the pillow and round to you: looking back over her shoulder.
  peek: { ctx: AUTO_FRONT, w: 0.8, tags: ['look'], say: 'look',
    can: (v) => v.rag && v.gaze !== Infinity,
    go: (v, k) => { jadrija.autoMove({ glance: 3 + 2 * k }); jadrija.autoMove({ cot: 'lift', k }); return true; } },
  // Her eyes: on you for a few seconds, away from you, lowered, up.
  glance: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, fours: 1, stand: 1, leash: 1, ham: 1, out: 1, ride: 1 },
    w: 0.9, tags: ['look'], can: (v) => v.gaze !== Infinity && !(v.gaze > 0 && !v.away),
    go: (v, k) => (jadrija.autoMove({ glance: 3 + 3 * k }) ? true : 'busy') },
  away: { ctx: { front: 1, back: 1, side: 1, ham: 1 }, w: 0.6, tags: ['shy'], inv: 'glance',
    can: (v) => v.gaze !== Infinity && !v.away,
    go: (v, k) => (jadrija.autoMove({ glance: 4 + 3 * k, away: true }) ? true : 'busy') },
  eyesDown: { ctx: { back: 1, sit: 1, cotKneel: 1, kneel: 1, fours: 1, stand: 1, leash: 1, ham: 1 }, w: 0.6,
    tags: ['shy'], inv: 'eyesUp', can: (v) => !v.eyesDown, go: _autoAsk('look.down') },
  eyesUp: { ctx: { back: 1, sit: 1, cotKneel: 1, kneel: 1, fours: 1, stand: 1, leash: 1, ham: 1 }, w: 0.5,
    tags: ['look'], inv: 'eyesDown', can: (v) => !!v.eyesDown, go: _autoAsk('look.up') },
  mouth: { ctx: { back: 1, sit: 1, cotKneel: 1, kneel: 1, ham: 1, leash: 1 }, w: 0.25, tags: ['heat'],
    can: (v) => !v.mouth && v.heat > 0.55, go: _autoAsk('mouth.open') },
  yawn: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, ham: 1, out: 1, leash: 1 }, w: 0.3,
    tags: ['calm'], say: 'calm', can: (v) => !v.yawn && v.heat < 0.4 && !jadrija.autoWhy('yawn'), go: _autoAsk('yawn') },
  // Settling: whatever her head and back were doing, let go.
  settle: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, leash: 1, ham: 1 }, w: 0.6,
    tags: ['calm'], say: 'calm', can: (v) => (v.gaze > 0 && v.gaze !== Infinity) || v.chest > 0,
    go: () => { jadrija.autoMove({ glance: 0 }); jadrija.autoMove({ chest: 0 }); return true; } },
  // Upright, her back straightened (`autoChest`), and let go again.
  chest: { ctx: { kneel: 1, stand: 1, leash: 1, out: 1 }, w: 0.6, tags: ['open'], inv: 'settle',
    can: (v) => !v.chest && (v.ctx !== 'leash' || v.leash.pose === 'kneel' || v.leash.pose === 'stand'),
    go: (v, k) => (jadrija.autoMove({ chest: 0.6 + 0.4 * k }) ? true : 'busy') },
  // Big: rolls on the cot, each the one direct road 1.559.3 gave it.
  rollSide: { ctx: { front: 1, back: 1 }, w: 0.5, big: 1, tags: ['calm', 'play'],
    can: () => !jadrija.autoWhy('side.left') || !jadrija.autoWhy('side.right'),
    go: () => _autoAsk(Math.random() < 0.5 ? 'side.left' : 'side.right')() },
  rollBack: { ctx: { front: 1 }, w: 0.4, big: 1, tags: ['open', 'look'], say: 'look',
    can: () => !jadrija.autoWhy('turn'), go: _autoAsk('turn') },
  rollFront: { ctx: { back: 1, side: 1 }, w: 0.5, big: 1, tags: ['heat'],
    can: () => !jadrija.autoWhy('flat'), go: _autoAsk('flat') },
  // Standing in the kabina, and out of doors: her own numbers, where she is.
  turnAway: { ctx: { stand: 1, kneel: 1 }, w: 0.4, tags: ['play'], can: (v) => !v.turnBack && !jadrija.autoWhy('turn'),
    go: _autoAsk('turn') },
  turnBack: { ctx: { stand: 1, kneel: 1 }, w: 0.6, tags: ['look'], can: (v) => !!v.turnBack, go: _autoAsk('turn') },
  shimmy: { ctx: { stand: 1, out: 1 }, w: 0.6, tags: ['play', 'heat'], say: 'play', big: 1,
    can: _autoCan('shimmy'), go: _autoAsk('shimmy') },
  twerk: { ctx: { stand: 1, out: 1 }, w: 0.5, tags: ['heat'], big: 1, can: _autoCan('twerk'), go: _autoAsk('twerk') },
  heart: { ctx: { stand: 1, out: 1, ham: 0 }, w: 0.5, tags: ['play', 'look'], big: 1, can: _autoCan('heart'), go: _autoAsk('heart') },
  note: { ctx: { out: 1 }, w: 0.3, tags: ['play'], big: 1, can: _autoCan('note'), go: _autoAsk('note') },
  joy: { ctx: { out: 1 }, w: 0.35, tags: ['play'], say: 'play', big: 1, can: _autoCan('joy'), go: _autoAsk('joy') },
  wheel: { ctx: { out: 1 }, w: 0.3, tags: ['play'], say: 'play', big: 1, can: _autoCan('wheel'), go: _autoAsk('wheel') },
  hairDown: { ctx: { stand: 1, out: 1, ham: 1 }, w: 0.3, tags: ['open', 'calm'], big: 1,
    can: (v) => v.hair === 'up' && !jadrija.autoWhy('hair.down'), go: _autoAsk('hair.down') },
  hairUp: { ctx: { stand: 1, out: 1, ham: 1 }, w: 0.15, tags: ['play'], big: 1,
    can: (v) => v.hair === 'down' && !jadrija.autoWhy('hair.up'), go: _autoAsk('hair.up') },
  kneel: { ctx: { stand: 1 }, w: 0.25, tags: ['heat', 'shy'], big: 1,
    can: (v) => v.heat > 0.5 && !jadrija.autoWhy('submit'), go: _autoAsk('submit') },
  // On the leash: up on her knees after a tug, down again, up on her feet.
  kneelUp: { ctx: { leash: 1 }, w: 0.7, tags: ['look', 'open'], say: 'tug', big: 1,
    can: (v) => v.leash.pose === 'fours', go: () => (jadrija.leashPose('kneel') === 'ok' ? true : 'leash') },
  down: { ctx: { leash: 1 }, w: 0.5, tags: ['shy', 'heat'], big: 1,
    can: (v) => v.leash.pose === 'kneel', go: () => (jadrija.leashPose('fours') === 'ok' ? true : 'leash') },
  standUp: { ctx: { leash: 1 }, w: 0.25, tags: ['play'], big: 1,
    can: (v) => v.leash.pose === 'kneel' && v.heat < 0.45, go: () => (jadrija.leashPose('stand') === 'ok' ? true : 'leash') },
  // AT THE PLAYGROUND (1.562.0): on to its kit of her own accord — the
  // swings, the nest, the seesaw, a trampoline, the slide, the horse — and
  // off again when she has had it a while. Only standing at the playground
  // (`atPlay`), never from the promenade: the mode never walks her off.
  pgSwing: { ctx: { out: 1 }, w: 0.45, tags: ['play'], say: 'play', big: 1,
    can: (v) => !!v.atPlay && !jadrija.autoWhy('pg:swing'), go: _autoAsk('pg:swing') },
  pgNest: { ctx: { out: 1 }, w: 0.25, tags: ['play', 'calm'], big: 1,
    can: (v) => !!v.atPlay && !jadrija.autoWhy('pg:nest'), go: _autoAsk('pg:nest') },
  pgSeesaw: { ctx: { out: 1 }, w: 0.3, tags: ['play', 'look'], big: 1,
    can: (v) => !!v.atPlay && !jadrija.autoWhy('pg:seesaw'), go: _autoAsk('pg:seesaw') },
  pgTramp: { ctx: { out: 1 }, w: 0.4, tags: ['play', 'heat'], say: 'play', big: 1,
    can: (v) => !!v.atPlay && !jadrija.autoWhy('pg:tramp'), go: _autoAsk('pg:tramp') },
  pgSlide: { ctx: { out: 1 }, w: 0.35, tags: ['play'], say: 'play', big: 1,
    can: (v) => !!v.atPlay && !jadrija.autoWhy('pg:slide'), go: _autoAsk('pg:slide') },
  pgRider: { ctx: { out: 1 }, w: 0.2, tags: ['play'], big: 1,
    can: (v) => !!v.atPlay && !jadrija.autoWhy('pg:rider'), go: _autoAsk('pg:rider') },
  pgOff: { ctx: { ride: 1 }, w: 0.5, tags: ['calm'], big: 1,
    can: (v) => !!v.pg && v.pg.t > 25 && v.pg.kind !== 'slide' && !jadrija.autoWhy('pg.off'), go: _autoAsk('pg.off') },
  // In the hammock: a little push of her own.
  rock: { ctx: { ham: 1 }, w: 1.0, tags: ['play', 'calm'], say: 'ham',
    can: (v) => !!v.hamSwing && Math.abs(v.hamSwing.peak || 0) < 0.2,
    go: (v, k) => (jadrija.autoMove({ rock: 0.15 + 0.15 * k }) ? true : 'swing') },
};

// ── the state ────────────────────────────────────────────────────────────────

const auto = {
  on: false, clock: 0, next: 0, polled: 0, pausedTo: 0, still: false,
  heat: AUTO.heatRest, calm: AUTO.calmRest, bias: {}, biasT: 0,
  lastEvent: -1e9, lastBig: -1e9, lastHard: -1e9, lastLine: -1e9, lastSay: -1e9, react: null,
  seenHit: 0, seenTug: 0, hits: [], last: [], doing: null, doingT: -1e9, ctx: null,
  trace: [], decisions: 0, moved: 0, engagedAt: 0, why: null,
  chestTo: 0, hudEl: null, hudWas: '',
};

/** Whether the mode is on — for "stop" meaning the safeword, and for the HUD. */
function autoActive() { return !!auto.on; }

/** Her context: a key off the moves' `ctx`, or null while she is between things. */
function autoCtx(v) {
  if (!v || v.swim) return null;
  if (v.ask || v.getUp) return null;
  const p = v.phase, L = v.leash;
  if (L && L.offing) return null;
  if (v.onBed && (p === 'flatheld' || p === 'edgeHeld')) return 'front';
  if (v.onBed && p === 'cradle') return 'back';
  if (v.onBed && (p === 'sideL' || p === 'sideR' || p === 'fetalHeld')) return 'side';
  if (v.onBed && (p === 'sitHeld' || p === 'lotusHeld' || p === 'perchHeld')) return 'sit';
  if (p === 'bedKneel') return 'cotKneel';
  if (L && L.clipped && L.mode === 'lead') {
    return AUTO_LEASH[p] ? 'leash' : null;
  }
  if (L && L.clipped) return null;
  if (p === 'kept') return 'kneel';
  if (p === 'fours') return 'fours';
  if (p === 'dwell' && v.inKab) return 'stand';
  if (p === 'hamHeld') return 'ham';
  // On the playground's kit (1.562.0): riding it, a stage of its own.
  if (v.pg && p === 'pgRide') return 'ride';
  if (!v.inKab && AUTO_OUT[p]) return 'out';
  return null;
}
const AUTO_OUT = { here: 1, grounds: 1, idle: 1, play: 1, rest: 1, bask: 1, orbit: 1, aim: 1, notice: 1 };
// Settled on the end of the leash (not going on, coming off, or between poses).
const AUTO_LEASH = { leashFours: 1, leashCrawl: 1, leashKnelt: 1, leashStand: 1, leashWalk: 1 };

function autoSay(kind, force = false) {
  const L = AUTO_SAY[kind];
  if (!L || !L.length) return null;
  if (!force && auto.clock - auto.lastLine < AUTO.lineGap) return null;
  const [text, id] = L[Math.floor(Math.random() * L.length)];
  auto.lastLine = auto.clock;
  const g = typeof T === 'function' ? T('auto.g.' + id) : '';
  if (typeof voice !== 'undefined' && voice && voice.sub) voice.sub(text, 2.6, g && g !== 'auto.g.' + id ? g : '');
  return text;
}

function autoLog(e) {
  e.t = +auto.clock.toFixed(1);
  auto.trace.push(e);
  if (auto.trace.length > AUTO.keep) auto.trace.shift();
}

/** A cue's lean on her choices: `tag` up by `k`, fading over `biasLife`. */
function autoLean(tag, k) { auto.bias[tag] = Math.min(3, (auto.bias[tag] || 0) + k); }

/** Her eyes and her back let go — on the way out, and for the safeword. */
function autoLetGo() {
  if (!jadrija || !jadrija.autoMove) return;
  const v = jadrija.autoView ? jadrija.autoView() : null;
  if (v && v.gaze > 0 && v.gaze !== Infinity) jadrija.autoMove({ glance: 0 });
  jadrija.autoMove({ chest: 0 });
}

/** On. `src` what asked: 'typed', 'heard', 'probe'. Answers 'on', or why not. */
function autoOn(src = 'typed') {
  if (auto.on) return 'already';
  if (typeof state === 'undefined' || state.phase !== 'ground' || !jadrija || !jadrija.autoView) return 'ground';
  const v = jadrija.autoView();
  if (!v) return 'gone';
  auto.on = true;
  auto.still = false;
  auto.pausedTo = 0;
  auto.heat = Math.max(auto.heat, AUTO.heatRest);
  auto.bias = {};
  auto.engagedAt = auto.clock;
  auto.next = auto.clock + 2.0;
  autoMark();
  autoLog({ ctx: autoCtx(v), pick: 'ENGAGED', why: src, heat: +auto.heat.toFixed(2) });
  autoSay('on', true);
  autoHud();
  return 'on';
}

/** Off. `why` 'asked' | 'safe' | 'left'. */
function autoOff(why = 'asked') {
  if (!auto.on) return 'not on';
  auto.on = false;
  auto.still = false;
  autoLetGo();
  autoLog({ pick: 'DISENGAGED', why, heat: +auto.heat.toFixed(2) });
  if (why === 'asked') autoSay('off', true);
  autoHud();
  return 'off';
}

/**
 * THE SAFEWORD, from 49-ears.js (`act('belt.stop')`) while the mode is on.
 * The belt and the collar each run their own stop and their own aftercare
 * (`beltSafeword`, `collarCmd`); with neither on her, the aftercare is the
 * belt's — your hand to her, her "Okay. Come here." — via `sceneCare`.
 */
function autoSafe(who = 'you') {
  const was = auto.on;
  if (was) autoOff('safe');
  const belt = typeof beltActive === 'function' && beltActive();
  const collar = typeof collarActive === 'function' && collarActive();
  if (!belt && !collar && typeof sceneCare === 'function') sceneCare(who);
  return was ? 'stopped' : 'not on';
}

/** Called by `sceneSafe` (90-app.js) whoever said it — her own red included. */
function autoSafeHook(who, of) {
  if (auto.on) autoOff('safe');
}

/**
 * SOMETHING YOU ASKED HER YOURSELF — from `askShow` (anything not asked by
 * this file) and from the ears' commands. Done at once by whoever owns it;
 * here it only holds her own moves off, and leans her the way you asked.
 */
function autoDirect(name) {
  if (!auto.on) return;
  // Your hand on her head is a touch, not an order.
  if (name === 'pet') { autoEvent('pet', 1); return; }
  auto.pausedTo = auto.clock + AUTO.pause;
  auto.still = false;
  const lean = { 'legs.spread': 'open', 'legs.wider': 'open', 'arms.wide': 'open', 'legs.close': 'close',
    'legs.leftup': 'open', 'legs.rightup': 'open', 'legs.bothup': 'open', 'legs.higher': 'open',
    'legs.straight': 'open', 'legs.leftstraight': 'open', 'legs.rightstraight': 'open',
    'legs.lower': 'calm', 'legs.leftdown': 'calm', 'legs.rightdown': 'calm', 'legs.down': 'calm',
    'arms.down': 'close', look: 'look', 'look.down': 'shy', yawn: 'calm' }[name];
  if (lean) autoLean(lean, 0.8);
  autoLog({ ctx: auto.ctx, pick: 'obeyed', why: 'you asked: ' + name + ' — her own moves held ' + AUTO.pause + ' s',
    heat: +auto.heat.toFixed(2) });
}

/**
 * A thing done to her, as it happened — `kind` 'spank' | 'lash' | 'tug' |
 * 'hair' | 'pet' | 'hand' | 'hose', `k` how much (a hit's hardness 0..2, or
 * seconds of a hand). Her mood moves, and a hit or a tug brings her next
 * move forward to answer it.
 */
function autoEvent(kind, k = 1) {
  const now = auto.clock;
  if (kind === 'spank' || kind === 'lash') {
    // Less each time the hotter she already is: a dozen in a minute takes her
    // near the top, two or three do not.
    auto.heat = Math.min(1, auto.heat + ((kind === 'lash' ? 0.07 : 0.045) + 0.03 * k) * (1 - 0.6 * auto.heat));
    auto.hits.push(now);
    if (k >= 2) auto.lastHard = now;
  } else if (kind === 'tug') auto.heat = Math.min(1, auto.heat + 0.05);
  else if (kind === 'hair') auto.heat = Math.min(1, auto.heat + 0.04 * k);
  else if (kind === 'hand') auto.heat = Math.min(1, auto.heat + 0.03 * k);
  else if (kind === 'hose') { auto.heat = Math.min(1, auto.heat + 0.03 * k); autoLean('play', 0.3 * k); }
  else if (kind === 'pet') { auto.calm = Math.min(1, auto.calm + 0.08 * k); auto.heat = Math.max(0, auto.heat - 0.01 * k); }
  while (auto.hits.length && now - auto.hits[0] > 30) auto.hits.shift();
  auto.lastEvent = now;
  if (kind === 'spank' || kind === 'lash' || kind === 'tug' || (kind === 'hose' && auto.react !== 'hose')) {
    const r = AUTO.react[0] + (AUTO.react[1] - AUTO.react[0]) * Math.random();
    if (auto.next > now + r) auto.next = now + r;
    auto.react = kind;
  }
}

/** Where the scene's record stands now, so only what lands after this is news. */
function autoMark() {
  const L = typeof sceneLog !== 'undefined' ? sceneLog : null;
  auto.seenHit = L && L.hits.length ? L.hits[L.hits.length - 1][0] : 0;
  auto.seenTug = L && L.tugs.length ? L.tugs[L.tugs.length - 1] : 0;
}

/** The poll: new hits and tugs off `sceneLog`, your hands this moment, the hose. */
function autoPoll(dt, v) {
  const L = typeof sceneLog !== 'undefined' ? sceneLog : null;
  if (L) {
    for (const h of L.hits) {
      if (h[0] <= auto.seenHit) continue;
      auto.seenHit = h[0];
      autoEvent(h[1] === 'belt' ? 'lash' : 'spank', h[2]);
    }
    for (const t of L.tugs) {
      if (t <= auto.seenTug) continue;
      auto.seenTug = t;
      autoEvent('tug', 1);
    }
  }
  if (typeof hairHeld !== 'undefined' && hairHeld) autoEvent('hair', dt);
  else if (typeof petK !== 'undefined' && petK > 0.5) autoEvent('pet', dt);
  if (typeof cupK !== 'undefined' && cupK > 0.5 && typeof reachKind !== 'undefined'
    && (reachKind === 'cup' || reachKind === 'hip' || reachKind === 'thigh')) autoEvent('hand', dt);
  if (v && v.hit > 0 && !v.inKab) autoEvent('hose', dt);
}

/**
 * THE SCORE of one move, now: its weight, times what its moods are worth in
 * this mood, times how fresh it is. Answers [score, why].
 */
function autoScore(id, M, v) {
  const now = auto.clock, H = auto.heat, C = auto.calm, B = auto.bias;
  const sinceEv = now - auto.lastEvent;
  const streak = auto.hits.filter((t) => now - t < 30).length;
  const flinch = now - auto.lastHard < 3;
  const why = [];
  let m = 0;
  for (const tag of M.tags) {
    let f = 0;
    if (tag === 'open') { f = 0.35 + 1.6 * H + (streak >= 3 ? 0.6 : 0) - (flinch ? 0.5 : 0); if (streak >= 3) why.push(streak + ' hits/30s'); }
    else if (tag === 'close') { f = 0.4 + 0.9 * (1 - H) + (flinch ? 1.0 : 0); if (flinch) why.push('flinch'); }
    else if (tag === 'look') { f = 0.5 + (sinceEv < 5 ? 1.2 : 0); if (sinceEv < 5) why.push('checks on you'); }
    else if (tag === 'shy') f = 0.35 + 0.6 * (1 - H) * (0.5 + C);
    else if (tag === 'heat') f = 0.2 + 1.8 * H;
    else if (tag === 'play') f = 0.45 + 0.6 * H;
    else if (tag === 'calm') f = 0.3 + 1.2 * C + 0.9 * (1 - H) - (sinceEv < 8 ? 0.5 : 0);
    f += B[tag] || 0;
    if (B[tag] > 0.2) why.push('cue:' + tag);
    m += Math.max(0.02, f);
  }
  m /= M.tags.length;
  let s = M.w * m;
  // Freshness: the same move again is dull; the move that undoes the last
  // one is held off a few seconds, then wanted.
  const last = auto.last[auto.last.length - 1];
  if (last && last.id === id) s *= 0.15;
  else if (auto.last.slice(-3).some((x) => x.id === id)) s *= 0.5;
  if (last && M.inv === last.id) s *= now - last.t < 6 ? 0.3 : 1.3;
  // Big ones are rare, and not while things are happening to her — unless
  // the big one IS the answer (up on her knees for a tug).
  const answers = auto.react === 'tug' && id === 'kneelUp';
  if (M.big && !answers) {
    // A gate and not a weight: at 0.05 a roll still came up one time in
    // fifty, and one was 5 s after the last (MEASURED, rollBack then
    // rollFront mid-spanking).
    if (now - auto.lastBig < AUTO.bigGap || sinceEv < 12) return [0, why];
    s *= 0.6;
  }
  // A hit just landed and this is an answer to it: the reflexive ones.
  if (auto.react === 'spank' || auto.react === 'lash') {
    if (id === 'wiggle' || id === 'peek' || id === 'heels' || id === 'close' || id === 'arch' || id === 'spread') { s *= 1.6; why.push('answers the hit'); }
  } else if (auto.react === 'tug' && (id === 'kneelUp' || id === 'glance' || id === 'peek')) { s *= id === 'kneelUp' ? 1.8 : 1.3; why.push('answers the tug'); }
  else if (auto.react === 'hose' && M.tags.includes('play')) { s *= 1.6; why.push('the hose'); }
  return [s, why];
}

/** Choose and do one move. Answers the trace entry, or null if there was nothing to do. */
function autoDecide(force = false) {
  const v = jadrija && jadrija.autoView ? jadrija.autoView() : null;
  const ctx = autoCtx(v);
  auto.ctx = ctx;
  if (!ctx) { auto.next = auto.clock + 1.0; auto.why = 'between'; return null; }
  v.ctx = ctx; v.heat = auto.heat;
  const cands = [];
  for (const id of Object.keys(AUTO_MOVES)) {
    const M = AUTO_MOVES[id];
    if (!M.ctx[ctx]) continue;
    let ok = false;
    try { ok = !!M.can(v); } catch (e) { ok = false; }
    if (!ok) continue;
    const [s, why] = autoScore(id, M, v);
    if (!(s > 0)) continue;
    // A little noise, so two near scores do not always fall the same way.
    cands.push({ id, s: s * (0.8 + 0.4 * Math.random()), why });
  }
  cands.sort((a, b) => b.s - a.s);
  const react = auto.react;
  auto.react = null;
  auto.decisions++;
  if (!cands.length) {
    autoLog({ ctx, pick: '-', why: 'nothing to do here', heat: +auto.heat.toFixed(2) });
    return null;
  }
  // Weighted pick, tried in order until one takes.
  const tries = cands.slice();
  let done = null;
  const failed = [];
  for (let n = 0; n < 3 && tries.length && !done; n++) {
    const tot = tries.reduce((a, c) => a + c.s, 0);
    let r = Math.random() * tot, i = 0;
    for (; i < tries.length - 1; i++) { r -= tries[i].s; if (r <= 0) break; }
    const c = tries.splice(i, 1)[0];
    const M = AUTO_MOVES[c.id];
    const k = Math.min(1, 0.3 + 0.7 * auto.heat + 0.2 * Math.random());
    let got;
    try { got = M.go(v, k); } catch (e) { got = 'error ' + e.message; }
    if (got === true) done = { c, M, k };
    else { c.fail = got; failed.push(c.id + ':' + got); }
  }
  const e = { ctx, phase: v.phase, heat: +auto.heat.toFixed(2), calm: +auto.calm.toFixed(2),
    react: react || undefined,
    alt: cands.slice(0, 4).map((c) => c.id + ' ' + c.s.toFixed(2)).join(', ') };
  if (!done) { e.pick = '-'; e.why = 'none took: ' + cands.slice(0, 3).map((c) => c.id + ':' + (c.fail || '?')).join(' '); autoLog(e); return e; }
  const { c, M } = done;
  e.pick = c.id;
  e.why = (c.why.length ? c.why.join(', ') : 'mood') + (react ? ' (after ' + react + ')' : '');
  if (failed.length) e.tried = failed.join(' ');
  auto.last.push({ id: c.id, t: auto.clock });
  if (auto.last.length > 6) auto.last.shift();
  if (M.big) auto.lastBig = auto.clock;
  auto.doing = c.id; auto.doingT = auto.clock;
  auto.moved++;
  // Her back straightened is held a while, then let go on its own.
  if (c.id === 'chest') auto.chestTo = auto.clock + 6 + 6 * Math.random();
  // And a line, sometimes: right after a hit it is about the hit.
  const kind = react === 'spank' || react === 'lash' ? 'hit' : react === 'tug' ? 'tug' : react === 'hose' ? 'hose' : M.say;
  if (kind && (react || Math.random() < AUTO.lineP)) e.said = autoSay(kind) || undefined;
  autoLog(e);
  return e;
}

/**
 * A CUE — "good girl", "be still", "more", "spread", "together", "relax",
 * "arch", "look at me", "come here". Answers { label, ask } for the ears'
 * panel; `ask` is the request this armed, so the service's echo of the same
 * line is not asked twice.
 */
function autoCue(cue, sub = null) {
  if (!auto.on) return { label: 'not in her own mode', ask: null };
  const v = jadrija && jadrija.autoView ? jadrija.autoView() : null;
  const ctx = autoCtx(v);
  let label = cue, ask = null;
  const go = (name) => {
    const r = jadrija.askShow(name, 'auto');
    if (r === true) ask = name;
    return r === true;
  };
  if (cue !== 'still' && cue !== 'good') auto.still = false;
  if (cue === 'still') {
    auto.still = true;
    label = 'still — she holds where she is until you say something else';
    autoSay('still', true);
  } else if (cue === 'good') {
    auto.calm = Math.min(1, auto.calm + 0.25);
    auto.heat = Math.min(1, auto.heat + 0.03);
    autoLean('look', 0.6); autoLean('shy', 0.4);
    if (!auto.still) jadrija.autoMove({ glance: 3 });
    autoSay('good', true);
    label = 'praised — she glows';
  } else if (cue === 'more') {
    auto.heat = Math.min(1, auto.heat + 0.15);
    autoLean('open', 1.2); autoLean('heat', 1.0);
    auto.next = Math.min(auto.next, auto.clock + 0.6);
    autoSay('more', true);
    label = 'more — warmer, and bolder';
  } else if (cue === 'relax') {
    auto.heat = Math.max(0, auto.heat - 0.2);
    auto.calm = Math.min(1, auto.calm + 0.3);
    autoLean('calm', 1.5);
    autoLetGo();
    auto.next = Math.max(auto.next, auto.clock + 5);
    autoSay('calm', true);
    label = 'relax — she lets go';
  } else if (cue === 'spread') {
    autoLean('open', 1.2);
    const ok = sub === 'arms' ? go('arms.wide') : go('legs.spread') || go('legs.wider');
    auto.pausedTo = auto.clock + AUTO.cuePause;
    label = (sub === 'arms' ? 'arms out' : 'legs apart') + (ok ? '' : ' (as far as they go here)');
  } else if (cue === 'together') {
    autoLean('close', 1.2);
    const ok = sub === 'arms' ? go('arms.down') : go('legs.close');
    auto.pausedTo = auto.clock + AUTO.cuePause;
    label = (sub === 'arms' ? 'arms in' : 'legs together') + (ok ? '' : ' (they already are)');
  } else if (cue === 'arch') {
    autoLean('open', 0.8);
    if (v && v.rag && jadrija.autoMove({ cot: 'arch', k: 0.9 })) label = 'arching her back';
    else if (jadrija.autoMove({ chest: 1 })) { label = 'straightening up'; auto.chestTo = auto.clock + 10; }
    auto.pausedTo = auto.clock + AUTO.cuePause;
  } else if (cue === 'look') {
    autoLean('look', 1.0);
    if (!jadrija.autoMove({ glance: 8 })) go('look');
    auto.pausedTo = auto.clock + AUTO.cuePause;
    label = 'her eyes on you';
  } else if (cue === 'come') {
    // To you, if she is on her feet; anywhere else she turns to you, and
    // asks you to come to her instead (she does not get off the cot).
    if (ctx === 'stand' || ctx === 'out') {
      const r = jadrija.askShow('hug');
      label = r === true ? 'coming over to you' : 'she stays';
      if (r === true) ask = 'hug';
    } else {
      jadrija.autoMove({ glance: 6 });
      if (v && v.rag) jadrija.autoMove({ cot: 'lift', k: 0.7 });
      autoSay('come', true);
      label = 'she turns to you — "come to me"';
    }
    autoLean('look', 0.8);
  }
  autoLog({ ctx, pick: 'cue:' + cue + (sub ? '/' + sub : ''), why: label, heat: +auto.heat.toFixed(2) });
  autoHud();
  return { label, ask };
}

/** The HUD tag, `#gh-auto` — only rewritten when it changes. */
function autoHud() {
  if (typeof document === 'undefined') return;
  if (!auto.hudEl) auto.hudEl = document.getElementById('gh-auto');
  const el = auto.hudEl;
  if (!el) return;
  const txt = !auto.on ? '' : (typeof T === 'function' ? T('auto.hud') : 'AUTONOMOUS')
    + (auto.still ? ' · ' + (typeof T === 'function' ? T('auto.still') : 'still')
      : auto.pausedTo > auto.clock ? ' · ' + (typeof T === 'function' ? T('auto.paused') : 'yours') : '');
  if (txt === auto.hudWas) return;
  auto.hudWas = txt;
  el.textContent = txt;
  el.hidden = !auto.on;
}

/** Once a tick, from 90-app.js. A clock and a comparison unless it is time. */
function autoTick(dt) {
  auto.clock += dt;
  if (!auto.on) return;
  if (state.phase !== 'ground' || !jadrija || !jadrija.autoView) { autoOff('left'); return; }
  // Her mood drifts home.
  auto.heat += (AUTO.heatRest - auto.heat) * (1 - Math.exp(-dt / AUTO.heatTau));
  auto.calm += (AUTO.calmRest - auto.calm) * (1 - Math.exp(-dt / AUTO.calmTau));
  if (auto.clock - auto.biasT > 1) {
    const f = Math.exp(-(auto.clock - auto.biasT) / AUTO.biasLife);
    for (const k of Object.keys(auto.bias)) { auto.bias[k] *= f; if (auto.bias[k] < 0.02) delete auto.bias[k]; }
    auto.biasT = auto.clock;
  }
  if (auto.clock - auto.polled < AUTO.poll) return;
  const pdt = auto.clock - auto.polled;
  auto.polled = auto.clock;
  const v = jadrija.autoView();
  autoPoll(Math.min(pdt, 1), v);
  if (auto.chestTo && auto.clock > auto.chestTo) { auto.chestTo = 0; jadrija.autoMove({ chest: 0 }); }
  autoHud();
  if (auto.clock < auto.next) return;
  // Held: still, or something you asked is hers to finish, or you are not
  // with her.
  if (auto.still) { auto.next = auto.clock + 1; auto.why = 'still'; return; }
  if (auto.clock < auto.pausedTo) { auto.next = auto.pausedTo; auto.why = 'yours'; return; }
  if (v && v.at && ground && ground.you && Math.hypot(v.at[0] - ground.you.x, v.at[2] - ground.you.z) > AUTO.far) {
    auto.next = auto.clock + 2; auto.why = 'far'; return;
  }
  auto.why = null;
  autoDecide();
  // And the next one: 3-8 s, longer once she has settled.
  const settled = auto.clock - auto.lastEvent > AUTO.quiet && auto.heat < 0.35;
  const g = AUTO.gap[0] + (AUTO.gap[1] - AUTO.gap[0]) * Math.random();
  auto.next = Math.max(auto.next, auto.clock + g * (settled ? AUTO.settled : 1));
}

/** For her voice — see `sceneTalk` in 90-app.js. */
function autoScene() {
  if (!auto.on) return null;
  const o = { auto: true };
  if (auto.still) o.auto_still = true;
  if (auto.doing && auto.clock - auto.doingT < 12) o.auto_doing = auto.doing;
  o.auto_heat = +auto.heat.toFixed(2);
  return o;
}

/** `__fr.auto` — see 90-app.js. */
const autoApi = {
  on: () => autoOn('probe'),
  off: () => autoOff('asked'),
  /** A typed line through the same matchers as the ears: a command, a cue, or nothing. */
  hear: (text) => {
    const w = autoWords(text);
    if (w) return w === 'auto.on' ? autoOn('probe') : autoOff('asked');
    if (auto.on && autoSafeword(text)) return autoSafe('you');
    const c = autoCueWords(text);
    return c ? autoCue(c.cue, c.sub) : null;
  },
  cue: (cue, sub = null) => autoCue(cue, sub),
  /** Choose a move now, whatever the clock says. */
  decide: () => autoDecide(true),
  /** Debug: do one named move the way the chooser would, logged as `do:<id>`. */
  do: (id, k = 0.7) => {
    const M = AUTO_MOVES[id], v = jadrija && jadrija.autoView ? jadrija.autoView() : null;
    if (!M || !v) return 'no such move';
    v.ctx = autoCtx(v); v.heat = auto.heat;
    if (!M.ctx[v.ctx]) return 'not here: ' + v.ctx;
    if (!M.can(v)) return 'cannot now';
    const got = M.go(v, k);
    if (got === true) { auto.last.push({ id, t: auto.clock }); auto.doing = id; auto.doingT = auto.clock; }
    autoLog({ ctx: v.ctx, phase: v.phase, pick: 'do:' + id, why: String(got), heat: +auto.heat.toFixed(2) });
    return got;
  },
  event: (kind, k = 1) => autoEvent(kind, k),
  state: () => ({ on: auto.on, ctx: auto.ctx, still: auto.still, why: auto.why,
    clock: +auto.clock.toFixed(1), next: +(auto.next - auto.clock).toFixed(1),
    paused: +Math.max(0, auto.pausedTo - auto.clock).toFixed(1),
    heat: +auto.heat.toFixed(3), calm: +auto.calm.toFixed(3),
    bias: Object.fromEntries(Object.entries(auto.bias).map(([k, x]) => [k, +x.toFixed(2)])),
    doing: auto.doing, decisions: auto.decisions, moved: auto.moved,
    last: auto.last.map((x) => x.id), view: jadrija && jadrija.autoView ? jadrija.autoView() : null }),
  mood: () => ({ heat: +auto.heat.toFixed(3), calm: +auto.calm.toFixed(3), hits30: auto.hits.length }),
  trace: (n = 30) => auto.trace.slice(-n),
  /** Set her mood or her clock for a probe: { heat, calm, next }. */
  set: (o = {}) => {
    if (o.heat != null) auto.heat = +o.heat;
    if (o.calm != null) auto.calm = +o.calm;
    if (o.next != null) auto.next = auto.clock + +o.next;
    if (o.pause != null) { auto.pausedTo = auto.clock + +o.pause; auto.next = Math.min(auto.next, auto.pausedTo); }
    return autoApi.mood();
  },
  moves: () => Object.fromEntries(Object.entries(AUTO_MOVES).map(([k, M]) => [k, Object.keys(M.ctx).filter((c) => M.ctx[c])])),
  words: (text) => ({ cmd: autoWords(text), cue: autoCueWords(text), safe: autoSafeword(text) }),
};
