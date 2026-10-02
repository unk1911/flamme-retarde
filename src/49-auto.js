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
//
// DEEPER (1.568.0, the night loop's item 6). Misha: *"keep improving the role
// reversal as well as 'autonomous' modes, to essentially take advantage of
// the work that has already been done with all the different
// toys/tools/positions"*. An audit first — five long sessions, five minutes
// each at ×4 (face down with slaps, standing, on the leash, the plug running,
// her legs) — and what it found is what this pass is:
//
//   - SHE NEVER STOPPED. A move every 3.9 s (median, face down under the
//     slaps), never a beat of stillness, so the room read as a machine
//     ticking. Now a `rest` is one of her choices — a breath, nothing — and
//     the gap stretches with calm and with recovery.
//   - SHE FLIP-FLOPPED. Legs apart, together, apart, together (the undoing
//     move was ×1.3 wanted six seconds after), eyes down / up / down on the
//     leash. Now the undoing move is held off 20 s unless her mood truly
//     turned (a flinch, your cue, her recovery), nothing repeats within her
//     last three picks, and the slow things (a yawn, her hair, her mouth)
//     have cooldowns of their own (five yawns in four minutes, measured).
//   - HER LEGS JITTERED. Both legs up as her very first move at rest heat,
//     one down, one up. Now the ladder is a direction (`ladder`): one leg
//     up, the foot up, both, higher, straight up as she warms — a rung at a
//     time, 7 s apart at the least — and down again the same way as she
//     cools or recovers.
//   - THE SAME LINE. "Mm, još jednom." six times in sixteen, "Hehe, idem." on
//     every tug. Now a line is never one of the last four she said, a hit's
//     line knows how hard it was and how hot she is, and a tug's knows the
//     pose she is in.
//
// And what she has now that she did not:
//
//   ANTICIPATION   slaps that come in a rhythm are a rhythm she learns: a
//                  beat before the next is due she braces (`brace`, both
//                  knees drawn a little and held, face down; standing, her
//                  back tightens and her eyes drop) and holds still; when it
//                  is late she peeks back for it ("Pa?...").
//   TEASING BACK   at a middling heat with nothing asked of her for a while,
//                  `cheek` builds, and she spends it: a wiggle and a look
//                  back, a cheeky line ("Je li to sve?"); on the leash she
//                  stays put for a tug ("Hehe... natjeraj me.") and comes on
//                  the next. Tell her anything and she complies, and says so.
//   RECOVERY       `ache` is the sting of the last half minute, filled by
//                  hard slaps and lashes; past 0.55, once they stop, she
//                  settles — her eyes and back let go, her legs close, a
//                  raised leg comes down, she breathes — and for 16-22 s she
//                  only does quiet things, slower.
//   MEMORY         "good girl" or your hand in her hair within 8 s of a move
//                  rewards that move, and she leans into it for minutes.
//   THE TOYS       the plug or the Lovense running in her is felt: the
//                  moment it goes on, up, down or off she answers it (a gasp,
//                  an arch, her heels, "Oh! ...uključila si ga."), while it
//                  runs she squirms, arches, clenches her legs at a high
//                  level and lets them fall open as she warms, and after a
//                  while she asks — for it stronger ("Jače... molim te."),
//                  softer when it has been full for long, or for it on at
//                  all. "Stronger" / "jače" / "turn it down" / "turn it off"
//                  answer her, with your phone on you.
//   YOUR HANDS     your hand in her hair, on her hip, her thigh, her breast,
//                  your thumb at her mouth, your fist in her hair: she
//                  stills for it (no moves of her own while it is on her),
//                  and answers it a beat later — turns her head into a pet,
//                  pushes into a hip, arches into a breast, and on a thigh
//                  opens that leg (her knee up, on her back), or teasingly
//                  closes them, or lets a raised one down.
//   THE LEASH      a tug on all fours brings her up on her knees; kneeling,
//                  she presents herself (back straight, eyes up: "Tu sam.
//                  Vodi me."); and the resisting, above.
//
// A debug readout of all of it (her mood, the rhythm, the ladder, the last
// picks and why): `?autodbg` on the page, or `__fr.auto.dbg(true)`. Dev only.
// -----------------------------------------------------------------------------

const AUTO = {
  gap: [3, 8],          // s between her moves
  settled: 1.6,         // ...times that, once she has settled (nothing for `quiet`, heat low)
  slowed: 1.7,          // ...times that, while she recovers
  quiet: 30,            // s with nothing done to her that counts as settled
  react: [0.8, 1.8],    // s after a slap, a tug, the hose, before she answers it
  pause: 10,            // s a thing you asked her yourself holds her own moves off
  cuePause: 6,          // ...and a cue that is itself a move ("spread", "arch")
  poll: 0.25,           // s between looks at the scene's record
  far: 14,              // m: you further from her than this and she leaves it be
  bigGap: 40,           // s at least between two big moves (a roll, a change of pose)
  heatTau: 75, heatRest: 0.22, calmTau: 60, calmRest: 0.2,
  biasLife: 25,         // s a cue's lean on her choices takes to fade
  lineGap: 11, lineP: 0.35, reactLineP: 0.6, lineMem: 4,
  keep: 80,             // decisions kept in the trace
  // 1.568.0 —
  memN: 3,              // picks: the same move not again within her last this many
  invHold: 20,          // s the move that undoes the last is held off
  legGap: 7,            // s at least between two rungs of her legs' ladder
  rest: 0.55,           // a beat of nothing: its weight, before her mood
  ache: { hand: 0.09, belt: 0.14, hard: 0.08, tau: 22, at: 0.55, after: 4.5, again: 30, secs: [16, 22] },
  brace: { lead: 1.0, min: 3.5, max: 12, cv: 0.45, late: 2.5, p: 0.7 },
  cheek: { lo: 0.28, hi: 0.72, rate: 0.022, quiet: 15, gap: 50, at: 0.55, comply: 25 },
  reward: { within: 8, tau: 240, most: 2.5, k: 0.45 },
  hand: { after: [0.6, 1.2], again: [6, 10], long: 2.0 },
  toy: { heat: 0.012, react: [0.4, 1.0], ask: 30, askAfter: 20, full: 50, onAfter: 40, step: 0.25, thanks: 20 },
};

/**
 * Her lines, in her Croatian, and what they mean (`auto.g.*` in 02-i18n.js).
 * The existing bark style: short, a laugh in them, and not one every move.
 * You are Chloe, so what she says to you is said to a woman ("glavna",
 * "uključila si").
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
  // 1.568.0 — a hit that was hard, and a hit when she is hot for them.
  hitHard: [['Au! To je bilo jako...', 'hitHard0'], ['Ah! ...joj, joj.', 'hitHard1'], ['Ssss... peče!', 'hitHard2']],
  hitHot: [['Da... još.', 'hitHot0'], ['Mm... tako.', 'hitHot1'], ['Hehe... jače, ako smiješ.', 'hitHot2']],
  // The next one is late, and she looks back for it.
  wait: [['Pa? ...', 'wait0'], ['Čekam...', 'wait1'], ['Hehe... gdje si stala?', 'wait2']],
  // Teasing back, and giving in once told.
  tease: [['Je li to sve?', 'tease0'], ['Hehe, jedva sam osjetila.', 'tease1'], ['Uhvati me, ako možeš.', 'tease2'],
    ['Mm... a sad?', 'tease3']],
  comply: [['Dobro, dobro... hehe.', 'comply0'], ['Kako ti kažeš.', 'comply1'], ['Mm... slušam.', 'comply2']],
  // A run of hard ones, and her settling after it.
  recover: [['Uff... daj mi sekundu.', 'recover0'], ['Diši... diši...', 'recover1'], ['Peče... ali dobro je.', 'recover2']],
  // Your hands.
  pet: [['Mmm... to.', 'pet0'], ['Još me tako mazi.', 'pet1'], ['Hehe... kao mačka.', 'pet2']],
  hand: [['Mm... ruka ti je topla.', 'hand0'], ['Ostavi je tu.', 'hand1']],
  thighOpen: [['Mm... izvoli.', 'thighOpen0'], ['Samo nastavi...', 'thighOpen1']],
  thighClose: [['Hehe... ne tako brzo.', 'thighClose0'], ['Polako, polako...', 'thighClose1']],
  handOff: [['Hej... vrati ruku.', 'handOff0'], ['Mm... već?', 'handOff1']],
  pull: [['Ah! ...da.', 'pull0'], ['Mm... drži me.', 'pull1']],
  // The toy in her, as you turn it.
  buzzOn: [['Oh! ...uključila si ga.', 'buzzOn0'], ['Mmm... evo ga.', 'buzzOn1']],
  buzzUp: [['Ah... jače je.', 'buzzUp0'], ['Mm! ...da, tako.', 'buzzUp1']],
  buzzDown: [['Mm... nježnije.', 'buzzDown0'], ['Hej... zašto slabije?', 'buzzDown1']],
  buzzOff: [['Hej... zašto si stala?', 'buzzOff0'], ['Mm... već?', 'buzzOff1']],
  toyMore: [['Jače... molim te.', 'toyMore0'], ['Pojačaj ga... malo.', 'toyMore1']],
  toyLess: [['Previše je... slabije.', 'toyLess0'], ['Ah... uspori malo.', 'toyLess1']],
  toyOn: [['Upali ga... molim te.', 'toyOn0'], ['A igračka? ...hehe.', 'toyOn1']],
  toyThanks: [['Da... tako. Hvala.', 'toyThanks0'], ['Mmm... savršeno.', 'toyThanks1']],
  // On the leash: kneeling, standing, presenting, and resisting.
  tugKneel: [['Tu sam, tu.', 'tugKneel0'], ['Mm... evo me.', 'tugKneel1'], ['Čujem te, čujem.', 'tugKneel2']],
  tugStand: [['Idem, idem.', 'tugStand0'], ['Hehe, vodi.', 'tugStand1']],
  present: [['Tu sam. Vodi me.', 'present0'], ['Tvoja sam.', 'present1']],
  resist: [['Hehe... natjeraj me.', 'resist0'], ['Neću još.', 'resist1']],
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
  // The toy in her, while she is in her own mode (1.568.0): your remote in
  // words — "stronger", "turn it down", "turn it on", "turn it off". The
  // whole line, so "harder" about anything else is not this.
  const toy = autoToyCueWords(t);
  if (toy) return { cue: toy };
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

/** The toy cues, on a normalised line: 'toyup' | 'toydown' | 'toyon' | 'toyoff', or null. */
function autoToyCueWords(t) {
  t = t.replace(/\s+(please|molim( te)?|stp|s'il te plait)$/, '').trim();
  if (/^(turn (it|the toy|her toy|the vibe) up( a bit| a little| more)?|(a bit |a little )?stronger|more power|pojacaj( ga| ju)?( malo| jos)?|(malo |jos )?jace|plus fort|monte[- ]le)$/.test(t)) return 'toyup';
  if (/^(turn (it|the toy|her toy|the vibe) down( a bit| a little)?|(a bit |a little )?(softer|weaker|gentler)|smanji( ga| ju)?( malo)?|(malo )?slabije|njeznije|moins fort|baisse[- ]le)$/.test(t)) return 'toydown';
  if (/^(turn (it|the toy|her toy|the vibe) on|switch (it|the toy) on|upali( ga| ju)?|ukljuci( ga| ju)|allume[- ]le)$/.test(t)) return 'toyon';
  if (/^(turn (it|the toy|her toy|the vibe) off|switch (it|the toy) off|ugasi( ga| ju)|iskljuci( ga| ju)|eteins[- ]le)$/.test(t)) return 'toyoff';
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
// move that undoes it, which is held off for `invHold` s after it so she
// does not flip-flop. `cool` is a move's own rest, s (a yawn is not a thing
// you do twice in a minute). `lad` marks a rung of her legs' ladder, which
// is not scored freely at all: only the next rung in the direction she is
// going may come up (see `autoLadderNext`).

const _autoAsk = (name) => (v) => {
  if (!jadrija || !jadrija.askShow) return 'gone';
  return jadrija.askShow(name, 'auto');
};
const _autoCan = (name) => (v) => !jadrija.autoWhy(name);
const _autoCot = (kind) => (v, k) => (jadrija.autoMove({ cot: kind, k }) ? true : 'rag');
/** A toy of hers running now — the plug or the Lovense, worn and on. */
const _autoBuzz = (v) => !!(v.toy && v.toy.on && v.toy.on.length);

const AUTO_FRONT = { front: 1 }, AUTO_LYING = { front: 1, back: 1, side: 1 };
const AUTO_EVERY = { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, fours: 1, stand: 1, leash: 1, ham: 1, out: 1, ride: 1 };
const AUTO_MOVES = {
  // A BEAT OF NOTHING (1.568.0): she breathes, and the room is still. Weighed
  // like any move, worth more the calmer she is, and most while she recovers.
  rest: { ctx: AUTO_EVERY, w: AUTO.rest, tags: ['calm'], rest: 1,
    can: () => true,
    go: (v, k) => {
      if (auto.heat > 0.55 && Math.random() < 0.35) autoBreath(0.3);
      return true;
    } },
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
  legsUp: { ctx: { back: 1 }, w: 0.5, tags: ['open'], inv: 'legsDown', cool: 30,
    can: (v) => !!v.legsDown && !v.liftL && !v.liftR, go: _autoAsk('legs.up') },
  // HER LEGS' LADDER (1.566.0) — on her back, and her shins up on her
  // front. Since 1.568.0 a direction and not a dice roll: see `autoLadderNext`.
  // From the cradle (her knees held up) "one leg up" keeps that one up and
  // lays the other flat, which is the same rung from the other side.
  legUp: { ctx: { back: 0.8, front: 0.6 }, w: 0.7, tags: ['open', 'play'], lad: 1, say: 'open',
    can: (v) => !v.liftL && !v.liftR && !!v.liftMode && !jadrija.autoWhy('legs.leftup'),
    go: () => _autoAsk(autoLadderSide() === 'L' ? 'legs.leftup' : 'legs.rightup')() },
  bothUp: { ctx: { back: 0.8, front: 0.5 }, w: 0.6, tags: ['open', 'heat'], lad: 1,
    can: (v) => (!!v.legsDown || v.liftMode === 'front') && !jadrija.autoWhy('legs.bothup'), go: _autoAsk('legs.bothup') },
  higher: { ctx: { back: 1, front: 1 }, w: 0.6, tags: ['heat', 'open'], lad: 1,
    can: (v) => !!(v.liftL || v.liftR || (v.liftMode === 'back' && !v.legsDown)) && !jadrija.autoWhy('legs.higher'),
    go: _autoAsk('legs.higher') },
  lower: { ctx: { back: 1, front: 1 }, w: 0.5, tags: ['calm'], lad: 1,
    can: (v) => !!(v.liftL || v.liftR) && !jadrija.autoWhy('legs.lower'), go: _autoAsk('legs.lower') },
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
  glance: { ctx: AUTO_EVERY,
    w: 0.9, tags: ['look'], can: (v) => v.gaze !== Infinity && !(v.gaze > 0 && !v.away),
    go: (v, k) => (jadrija.autoMove({ glance: 3 + 3 * k }) ? true : 'busy') },
  away: { ctx: { front: 1, back: 1, side: 1, ham: 1 }, w: 0.6, tags: ['shy'], inv: 'glance',
    can: (v) => v.gaze !== Infinity && !v.away,
    go: (v, k) => (jadrija.autoMove({ glance: 4 + 3 * k, away: true }) ? true : 'busy') },
  eyesDown: { ctx: { back: 1, sit: 1, cotKneel: 1, kneel: 1, fours: 1, stand: 1, leash: 1, ham: 1 }, w: 0.6,
    tags: ['shy'], inv: 'eyesUp', can: (v) => !v.eyesDown, go: _autoAsk('look.down') },
  eyesUp: { ctx: { back: 1, sit: 1, cotKneel: 1, kneel: 1, fours: 1, stand: 1, leash: 1, ham: 1 }, w: 0.5,
    tags: ['look'], inv: 'eyesDown', can: (v) => !!v.eyesDown, go: _autoAsk('look.up') },
  mouth: { ctx: { back: 1, sit: 1, cotKneel: 1, kneel: 1, ham: 1, leash: 1 }, w: 0.25, tags: ['heat'], cool: 40,
    can: (v) => !v.mouth && v.heat > 0.55, go: _autoAsk('mouth.open') },
  yawn: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, ham: 1, out: 1, leash: 1 }, w: 0.3,
    tags: ['calm'], say: 'calm', cool: 75,
    can: (v) => !v.yawn && v.heat < 0.4 && !_autoBuzz(v) && !jadrija.autoWhy('yawn'), go: _autoAsk('yawn') },
  // Settling: whatever her head and back were doing, let go.
  settle: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, leash: 1, ham: 1 }, w: 0.6,
    tags: ['calm'], say: 'calm', cool: 10, inv: 'chest', can: (v) => (v.gaze > 0 && v.gaze !== Infinity) || v.chest > 0,
    go: () => { jadrija.autoMove({ glance: 0 }); jadrija.autoMove({ chest: 0 }); return true; } },
  // Upright, her back straightened (`autoChest`), and let go again.
  chest: { ctx: { kneel: 1, stand: 1, leash: 1, out: 1 }, w: 0.6, tags: ['open'], inv: 'settle', cool: 12,
    can: (v) => !v.chest && (v.ctx !== 'leash' || v.leash.pose === 'kneel' || v.leash.pose === 'stand'),
    go: (v, k) => (jadrija.autoMove({ chest: 0.6 + 0.4 * k }) ? true : 'busy') },
  // TEASING BACK (1.568.0): a wiggle and a look back, a cheeky line — when
  // she is warm but not hot, nothing has been asked of her for a while, and
  // `cheek` has built. Scored on `cheek`, and only offered past `cheek.at`.
  tease: { ctx: { front: 1, back: 1, side: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, out: 1 }, w: 1.0, tags: ['tease'],
    say: 'tease', can: (v) => autoCheeky() && v.gaze !== Infinity,
    go: (v, k) => autoTeaseDo(v, k) },
  // Big: rolls on the cot, each the one direct road 1.559.3 gave it.
  rollSide: { ctx: { front: 1, back: 1 }, w: 0.5, big: 1, tags: ['calm', 'play'],
    can: () => !jadrija.autoWhy('side.left') || !jadrija.autoWhy('side.right'),
    go: () => _autoAsk(Math.random() < 0.5 ? 'side.left' : 'side.right')() },
  rollBack: { ctx: { front: 1 }, w: 0.4, big: 1, tags: ['open', 'look'], say: 'look',
    can: () => !jadrija.autoWhy('turn'), go: _autoAsk('turn') },
  rollFront: { ctx: { back: 1, side: 1 }, w: 0.5, big: 1, tags: ['heat'],
    can: () => !jadrija.autoWhy('flat'), go: _autoAsk('flat') },
  // Standing in the kabina, and out of doors: her own numbers, where she is.
  turnAway: { ctx: { stand: 1, kneel: 1 }, w: 0.4, tags: ['play'], cool: 20, inv: 'turnBack',
    can: (v) => !v.turnBack && !jadrija.autoWhy('turn'), go: _autoAsk('turn') },
  turnBack: { ctx: { stand: 1, kneel: 1 }, w: 0.6, tags: ['look'], can: (v) => !!v.turnBack, go: _autoAsk('turn') },
  shimmy: { ctx: { stand: 1, out: 1 }, w: 0.6, tags: ['play', 'heat'], say: 'play', big: 1,
    can: _autoCan('shimmy'), go: _autoAsk('shimmy') },
  twerk: { ctx: { stand: 1, out: 1 }, w: 0.5, tags: ['heat'], big: 1, can: _autoCan('twerk'), go: _autoAsk('twerk') },
  heart: { ctx: { stand: 1, out: 1, ham: 0 }, w: 0.5, tags: ['play', 'look'], big: 1, can: _autoCan('heart'), go: _autoAsk('heart') },
  note: { ctx: { out: 1 }, w: 0.3, tags: ['play'], big: 1, can: _autoCan('note'), go: _autoAsk('note') },
  joy: { ctx: { out: 1 }, w: 0.35, tags: ['play'], say: 'play', big: 1, can: _autoCan('joy'), go: _autoAsk('joy') },
  wheel: { ctx: { out: 1 }, w: 0.3, tags: ['play'], say: 'play', big: 1, can: _autoCan('wheel'), go: _autoAsk('wheel') },
  hairDown: { ctx: { stand: 1, out: 1, ham: 1 }, w: 0.3, tags: ['open', 'calm'], big: 1, cool: 120,
    can: (v) => v.hair === 'up' && !jadrija.autoWhy('hair.down'), go: _autoAsk('hair.down') },
  hairUp: { ctx: { stand: 1, out: 1, ham: 1 }, w: 0.15, tags: ['play'], big: 1, cool: 120,
    can: (v) => v.hair === 'down' && !jadrija.autoWhy('hair.up'), go: _autoAsk('hair.up') },
  kneel: { ctx: { stand: 1 }, w: 0.25, tags: ['heat', 'shy'], big: 1, cool: 60,
    can: (v) => v.heat > 0.5 && !jadrija.autoWhy('submit'), go: _autoAsk('submit') },
  // On the leash: up on her knees after a tug, down again, up on her feet.
  kneelUp: { ctx: { leash: 1 }, w: 0.7, tags: ['look', 'open'], big: 1,
    can: (v) => v.leash.pose === 'fours', go: () => (jadrija.leashPose('kneel') === 'ok' ? true : 'leash') },
  down: { ctx: { leash: 1 }, w: 0.5, tags: ['shy', 'heat'], big: 1,
    can: (v) => v.leash.pose === 'kneel', go: () => (jadrija.leashPose('fours') === 'ok' ? true : 'leash') },
  standUp: { ctx: { leash: 1 }, w: 0.25, tags: ['play'], big: 1,
    can: (v) => v.leash.pose === 'kneel' && v.heat < 0.45, go: () => (jadrija.leashPose('stand') === 'ok' ? true : 'leash') },
  // PRESENTING HERSELF (1.568.0): up on her knees on the leash, her back
  // straight, her eyes up at you, held. What a tug kneeling gets.
  present: { ctx: { leash: 1 }, w: 0.45, tags: ['look', 'open'], say: 'present', cool: 25,
    can: (v) => v.leash.pose === 'kneel' && !v.chest && v.gaze !== Infinity,
    go: (v, k) => {
      jadrija.autoMove({ chest: 0.85 + 0.15 * k });
      if (v.eyesDown) jadrija.askShow('look.up', 'auto');
      jadrija.autoMove({ glance: 5 + 3 * k });
      auto.chestTo = auto.clock + 7 + 4 * Math.random();
      return true;
    } },
  // HER TOYS (1.568.0): the plug or the Lovense running in her, felt. Tagged
  // `toy`, which is worth what she is feeling of it (`buzzK`) — so while it
  // runs high these are most of what she does, and at a low hum they are
  // now and then.
  toySquirm: { ctx: AUTO_LYING, w: 1.0, tags: ['toy', 'heat'], can: (v) => _autoBuzz(v) && v.rag,
    go: (v, k) => (jadrija.autoMove({ cot: 'wiggle', k: Math.min(1, 0.35 + 0.65 * auto.buzzLvl) }) ? true : 'rag') },
  toyArch: { ctx: { front: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, leash: 1 }, w: 0.9, tags: ['toy', 'open'],
    can: (v) => _autoBuzz(v) && (v.rag || ((v.ctx === 'kneel' || v.ctx === 'stand' || v.ctx === 'leash') && !v.chest)),
    go: (v, k) => {
      if (v.rag) return jadrija.autoMove({ cot: 'arch', k: Math.min(1, 0.3 + 0.7 * auto.buzzLvl) }) ? true : 'rag';
      auto.chestTo = auto.clock + 3 + 3 * Math.random();
      return jadrija.autoMove({ chest: 0.5 + 0.5 * auto.buzzLvl }) ? true : 'busy';
    } },
  toyHeels: { ctx: AUTO_FRONT, w: 0.7, tags: ['toy', 'play'], can: (v) => _autoBuzz(v) && v.rag,
    go: (v, k) => (jadrija.autoMove({ cot: 'heels', k: 0.4 + 0.6 * auto.buzzLvl }) ? true : 'rag') },
  // Her legs pressed together on a strong pulse — and let fall apart again
  // as she warms to it.
  toyClench: { ctx: { front: 1, back: 1, stand: 1, sit: 1 }, w: 0.8, tags: ['toy', 'close'], inv: 'toyOpen',
    can: (v) => _autoBuzz(v) && auto.buzzLvl >= 0.6 && v.legsSp > 0 && !jadrija.autoWhy('legs.close'),
    go: _autoAsk('legs.close') },
  toyOpen: { ctx: { front: 1, back: 1, stand: 1, sit: 1 }, w: 0.8, tags: ['toy', 'open'], inv: 'toyClench', say: 'open',
    can: (v) => _autoBuzz(v) && v.heat > 0.45 && v.legsSp < 1 && (v.ctx !== 'sit' || v.phase === 'perchHeld')
      && !jadrija.autoWhy('legs.spread'),
    go: _autoAsk('legs.spread') },
  toyMouth: { ctx: { back: 1, sit: 1, cotKneel: 1, kneel: 1, stand: 1, leash: 1 }, w: 0.5, tags: ['toy', 'heat'], cool: 25,
    can: (v) => _autoBuzz(v) && auto.buzzLvl >= 0.7 && !v.mouth, go: _autoAsk('mouth.open') },
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
// The moves that are not chosen but happen to her — logged under these
// names, and the voice service has words for each (`AUTO_DOING`).
const AUTO_SPECIAL = ['brace', 'peekBack', 'recover', 'resist', 'toyReact', 'toyMore', 'toyLess', 'toyOn',
  'handTurn', 'handLean', 'handOpen', 'handClose', 'handEase', 'handOff'];

// ── the state ────────────────────────────────────────────────────────────────

const auto = {
  on: false, clock: 0, next: 0, polled: 0, pausedTo: 0, still: false,
  heat: AUTO.heatRest, calm: AUTO.calmRest, bias: {}, biasT: 0,
  lastEvent: -1e9, lastBig: -1e9, lastHard: -1e9, lastLine: -1e9, lastSay: -1e9, react: null,
  seenHit: 0, seenTug: 0, hits: [], last: [], doing: null, doingT: -1e9, ctx: null,
  trace: [], decisions: 0, moved: 0, engagedAt: 0, why: null,
  chestTo: 0, hudEl: null, hudWas: '',
  // 1.568.0 —
  ache: 0, acheRun: 0, cheek: 0, hitHard: 0, lastHit: -1e9, lastOrder: -1e9, lastTease: -1e9, teased: false,
  recoverTo: 0, lastRecover: -1e9, holdTo: 0, queue: [], said: [],
  antic: null, ladder: { dir: 0, at: -1e9, topAt: 0, side: 'L' },
  reward: {}, used: {},
  hand: null, toyLvl: 0, toyAt: -1e9, toyHigh: 0, buzzK: 0, buzzLvl: 0, toyAsked: -1e9, toyWant: null,
  toyOffAt: -1e9, toyReact: null, resisted: -1e9, tugs: 0,
  dbgOn: false, dbgEl: null,
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

/**
 * A line of hers, of `kind`. Never one of the last `lineMem` she said (with
 * one line to a kind, that one, but not twice running), and not inside
 * `lineGap` of the last unless `force`.
 */
function autoSay(kind, force = false) {
  const L = AUTO_SAY[kind];
  if (!L || !L.length) return null;
  if (!force && auto.clock - auto.lastLine < AUTO.lineGap) return null;
  let pool = L.filter((x) => !auto.said.includes(x[1]));
  if (!pool.length) pool = L.filter((x) => x[1] !== auto.said[auto.said.length - 1]);
  if (!pool.length) pool = L;
  const [text, id] = pool[Math.floor(Math.random() * pool.length)];
  auto.lastLine = auto.clock;
  auto.said.push(id);
  if (auto.said.length > AUTO.lineMem) auto.said.shift();
  const g = typeof T === 'function' ? T('auto.g.' + id) : '';
  if (typeof voice !== 'undefined' && voice && voice.sub) voice.sub(text, 2.6, g && g !== 'auto.g.' + id ? g : '');
  return text;
}

/** A breath of hers, soft — Baye's own gasps (`herGasp`), quieter. */
function autoBreath(u = 0.35, after = null) {
  const A = typeof audio !== 'undefined' && audio ? audio : null;
  if (A && A.herGasp) A.herGasp(u, true, after == null ? 0.1 + 0.3 * Math.random() : after);
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

/** Everything of the moment cleared: what she was in the middle of, held, owed. */
function autoClearMoment() {
  auto.queue.length = 0;
  auto.holdTo = 0;
  auto.recoverTo = 0;
  auto.antic = null;
  auto.toyReact = null;
  auto.react = null;
  if (auto.hand) auto.hand.reacted = true;
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
  auto.cheek = 0;
  auto.ache = 0;
  auto.acheRun = 0;
  autoClearMoment();
  auto.hand = null;
  auto.ladder = { dir: auto.heat >= 0.4 ? 1 : -1, at: -1e9, topAt: 0, side: Math.random() < 0.5 ? 'L' : 'R' };
  auto.toyLvl = v.toy && v.toy.on.length ? v.toy.lvl : 0;
  auto.toyAt = auto.clock;
  auto.toyOffAt = auto.clock;
  auto.engagedAt = auto.clock;
  auto.next = auto.clock + 2.0;
  autoMark();
  autoLog({ ctx: autoCtx(v), pick: 'ENGAGED', why: src, heat: +auto.heat.toFixed(2) });
  autoSay('on', true);
  autoHud();
  return 'on';
}

/** Off. `why` 'asked' | 'safe' | 'left' | 'rev'. Mid-move or not: nothing of hers is owed after this. */
function autoOff(why = 'asked') {
  if (!auto.on) return 'not on';
  auto.on = false;
  auto.still = false;
  autoClearMoment();
  auto.hand = null;
  autoLetGo();
  autoLog({ pick: 'DISENGAGED', why, heat: +auto.heat.toFixed(2) });
  if (why === 'asked') autoSay('off', true);
  autoHud();
  autoDbg();
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
 * Told, after teasing: she gives in, and says so — once per tease. Answers
 * the line, or null when there was nothing to give in from.
 */
function autoComply() {
  if (!auto.teased || auto.clock - auto.lastTease > AUTO.cheek.comply) return null;
  auto.teased = false;
  auto.cheek = 0;
  auto.calm = Math.min(1, auto.calm + 0.08);
  const said = autoSay('comply', true);
  autoLog({ ctx: auto.ctx, pick: 'complies', why: 'told, after teasing', heat: +auto.heat.toFixed(2), said });
  return said;
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
  auto.lastOrder = auto.clock;
  auto.queue.length = 0;
  auto.holdTo = 0;
  const lean = { 'legs.spread': 'open', 'legs.wider': 'open', 'arms.wide': 'open', 'legs.close': 'close',
    'legs.leftup': 'open', 'legs.rightup': 'open', 'legs.bothup': 'open', 'legs.higher': 'open',
    'legs.straight': 'open', 'legs.leftstraight': 'open', 'legs.rightstraight': 'open',
    'legs.lower': 'calm', 'legs.leftdown': 'calm', 'legs.rightdown': 'calm', 'legs.down': 'calm',
    'arms.down': 'close', look: 'look', 'look.down': 'shy', yawn: 'calm' }[name];
  if (lean) autoLean(lean, 0.8);
  // Your hand on her legs' ladder sets the way it goes from here.
  if (/^legs\.(leftup|rightup|bothup|higher|straight|leftstraight|rightstraight)$/.test(name)) {
    auto.ladder.dir = 1; auto.ladder.at = auto.clock; auto.ladder.topAt = 0;
  } else if (/^legs\.(lower|leftdown|rightdown|down)$/.test(name)) { auto.ladder.dir = -1; auto.ladder.at = auto.clock; }
  autoComply();
  autoLog({ ctx: auto.ctx, pick: 'obeyed', why: 'you asked: ' + name + ' — her own moves held ' + AUTO.pause + ' s',
    heat: +auto.heat.toFixed(2) });
}

/**
 * "GOOD GIRL", OR YOUR HAND IN HER HAIR, just after a move of hers: that
 * move was liked, and she leans into it (`reward`, fading over minutes).
 */
function autoRewardLast(how) {
  const L = auto.last[auto.last.length - 1];
  if (!L || L.id === 'rest' || auto.clock - L.t > AUTO.reward.within) return null;
  auto.reward[L.id] = Math.min(AUTO.reward.most, (auto.reward[L.id] || 0) + 1);
  autoLog({ ctx: auto.ctx, pick: 'rewarded', why: L.id + ' (' + how + ') — she will lean into it',
    heat: +auto.heat.toFixed(2) });
  return L.id;
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
    // And the sting of it, which is not the heat: a run of hard ones fills
    // it, and it is what she recovers from (`ache`).
    auto.ache = Math.min(1, auto.ache + (kind === 'lash' ? AUTO.ache.belt : AUTO.ache.hand) + AUTO.ache.hard * k);
    // What it stood at when the run stopped is what she recovers from.
    auto.acheRun = auto.ache;
    auto.hits.push(now);
    auto.lastHit = now;
    auto.hitHard = k;
    if (k >= 2) auto.lastHard = now;
    // A hit spends the cheek: she got what she was asking for.
    auto.cheek = Math.max(0, auto.cheek - 0.25);
    autoAnticHit(now);
  } else if (kind === 'tug') { auto.heat = Math.min(1, auto.heat + 0.05); auto.tugs++; }
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
    // A brace ends the moment the thing it was for lands.
    auto.holdTo = Math.min(auto.holdTo, now);
  }
}

/** Where the scene's record stands now, so only what lands after this is news. */
function autoMark() {
  const L = typeof sceneLog !== 'undefined' ? sceneLog : null;
  auto.seenHit = L && L.hits.length ? L.hits[L.hits.length - 1][0] : 0;
  auto.seenTug = L && L.tugs.length ? L.tugs[L.tugs.length - 1] : 0;
}

/**
 * YOUR HAND ON HER this moment, as the hands' own state has it (90-app.js):
 * `{ kind, side }` — 'pull' your fist in her hair from behind, 'pet' your hand
 * on her head, 'breast' | 'hip' | 'thigh' your hand there (`side` 'L' / 'R',
 * her own, for a thigh), 'mouth' your thumb at her lip — or null.
 */
function autoHandNow() {
  if (typeof hairHeld !== 'undefined' && hairHeld) return { kind: 'pull' };
  if (typeof petK !== 'undefined' && petK > 0.5) return { kind: 'pet' };
  if (typeof cupK !== 'undefined' && cupK > 0.5 && typeof reachKind !== 'undefined'
    && (reachKind === 'cup' || reachKind === 'hip' || reachKind === 'thigh')) {
    // `hips().thighs` is [left (legUL), right (legUR)] — see 43-jadrija.js.
    const side = typeof cupSide !== 'undefined' && cupSide === 1 ? 'R' : 'L';
    return { kind: reachKind === 'cup' ? 'breast' : reachKind, side };
  }
  if (typeof thumbK !== 'undefined' && thumbK > 0.5 && typeof reachKind !== 'undefined' && reachKind === 'thumb') {
    return { kind: 'mouth' };
  }
  return null;
}

/** The poll: new hits and tugs off `sceneLog`, your hands this moment, the hose, the toys. */
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
  autoHandPoll(v);
  autoToyPoll(dt, v);
}

// ── her mood's three new parts: anticipation, cheek, recovery ────────────────

/**
 * THE RHYTHM of your slaps, if they have one: the last five in 30 s, three
 * gaps at least, their median between `brace.min` and `brace.max` s and
 * none of them further off it than `brace.cv` of it. Answers { every, next }
 * or null.
 */
function autoRhythm() {
  const H = auto.hits.slice(-5);
  if (H.length < 4) return null;
  const g = [];
  for (let i = 1; i < H.length; i++) g.push(H[i] - H[i - 1]);
  const s = g.slice().sort((a, b) => a - b), m = s[s.length >> 1];
  const B = AUTO.brace;
  if (m < B.min || m > B.max) return null;
  if (g.some((x) => Math.abs(x - m) > B.cv * m)) return null;
  return { every: m, next: H[H.length - 1] + m };
}

/** A hit landed: a fresh wait for the next, nothing braced or peeked yet. */
function autoAnticHit(now) {
  auto.antic = { hit: now, braced: false, peeked: false };
}

/**
 * Anticipation, at each poll: braced a beat before the next is due, and a
 * look back for it once it is late. Answers what it did, or null.
 */
function autoAntic(v, ctx) {
  const A = auto.antic;
  if (!A || !ctx || auto.recoverTo > auto.clock) return null;
  const R = autoRhythm();
  if (!R) return null;
  const now = auto.clock, B = AUTO.brace;
  const lying = ctx === 'front' || ctx === 'back' || ctx === 'side';
  if (!A.braced && now >= R.next - B.lead && now < R.next + 0.3 && now - auto.doingT > 0.8) {
    A.braced = true;
    // Not every time: now and then she just waits for it.
    if (Math.random() > B.p) return null;
    const hold = R.next - now + 1.2;
    let did = false;
    if (lying && v.rag) did = jadrija.autoMove({ cot: 'brace', k: 0.4 + 0.5 * auto.heat, hold });
    else if (ctx === 'stand' || ctx === 'kneel' || ctx === 'cotKneel' || ctx === 'sit' || ctx === 'leash') {
      did = jadrija.autoMove({ chest: 0.35 });
      auto.chestTo = now + hold;
      if (!v.eyesDown && v.gaze !== Infinity) jadrija.autoMove({ glance: 0 });
    }
    // And still: nothing of her own until it lands or the wait is over.
    auto.holdTo = now + hold;
    auto.next = Math.max(auto.next, auto.holdTo);
    autoDid('brace', { why: 'expects the next (every ' + R.every.toFixed(1) + ' s)' + (did ? '' : ', held still') });
    return 'brace';
  }
  if (!A.peeked && now > R.next + Math.max(B.late, 0.8 * R.every) && v.gaze !== Infinity) {
    A.peeked = true;
    jadrija.autoMove({ glance: 3.5 });
    if (ctx === 'front' && v.rag) jadrija.autoMove({ cot: 'lift', k: 0.6 });
    const said = Math.random() < 0.65 ? autoSay('wait') : null;
    autoDid('peekBack', { why: 'the next is late (every ' + R.every.toFixed(1) + ' s)', said });
    return 'peekBack';
  }
  return null;
}

/** Whether she has the cheek to tease you now — see `tease`. */
function autoCheeky() {
  const C = AUTO.cheek, now = auto.clock;
  return auto.cheek >= C.at && auto.heat >= C.lo && auto.heat <= C.hi && auto.ache < 0.45
    && now - auto.lastOrder > C.quiet && now - auto.lastTease > C.gap && !auto.still
    && auto.recoverTo <= now && !auto.hand && auto.buzzLvl < 0.6;
}

/** Her cheek builds while she is warm, not hot, and not told anything. */
function autoCheekTick(dt) {
  const C = AUTO.cheek, now = auto.clock;
  const ok = auto.heat >= C.lo && auto.heat <= C.hi && now - auto.lastOrder > C.quiet && auto.ache < 0.45;
  auto.cheek = ok ? Math.min(1, auto.cheek + C.rate * dt * (0.6 + Math.random() * 0.8))
    : Math.max(0, auto.cheek - C.rate * dt);
}

/** The tease itself, by where she is: a wiggle and a look back, and a line. */
function autoTeaseDo(v, k) {
  const ctx = v.ctx;
  let did = false;
  if (ctx === 'front' && v.rag) {
    did = jadrija.autoMove({ cot: 'wiggle', k: 0.5 });
    autoQueue(0.7, () => { jadrija.autoMove({ glance: 3 }); jadrija.autoMove({ cot: 'lift', k: 0.5 }); });
  } else if ((ctx === 'back' || ctx === 'side') && v.rag) {
    did = jadrija.autoMove({ cot: 'wiggle', k: 0.4 });
    jadrija.autoMove({ glance: 3.5 });
  } else if ((ctx === 'sit' || ctx === 'cotKneel') && v.rag) {
    did = jadrija.autoMove({ cot: 'arch', k: 0.3 });
    jadrija.autoMove({ glance: 3.5 });
  } else if (ctx === 'stand' || ctx === 'kneel') {
    // Her back to you, and a look back over her shoulder.
    if (!v.turnBack && !jadrija.autoWhy('turn')) did = jadrija.askShow('turn', 'auto') === true;
    autoQueue(1.6, () => jadrija.autoMove({ glance: 3 }));
    did = did || jadrija.autoMove({ glance: 3 });
  } else did = jadrija.autoMove({ glance: 3 });
  if (!did) return 'busy';
  auto.lastTease = auto.clock;
  auto.teased = true;
  auto.cheek = 0;
  return true;
}

/**
 * RECOVERY: past `ache.at` and `ache.after` s since the last hit, she
 * settles — her eyes and back let go, her legs close, a raised leg comes
 * down a rung, a breath and a line — and for `ache.secs` she is slower and
 * quieter. Answers whether it began.
 */
function autoRecoverTick(v, ctx) {
  const A = AUTO.ache, now = auto.clock;
  if (auto.recoverTo > now || !ctx) return false;
  // A pause is a pause against the rhythm she has learnt: with slaps every
  // 5 s, 4.5 s without one is not the end of the run.
  const Rh = autoRhythm();
  const after = Math.max(A.after, Rh ? 1.6 * Rh.every : 0);
  if (auto.acheRun < A.at || now - auto.lastHit < after || now - auto.lastHit > after + 12
    || now - auto.lastRecover < A.again) return false;
  auto.recoverTo = now + A.secs[0] + (A.secs[1] - A.secs[0]) * Math.random();
  auto.lastRecover = now;
  auto.ladder.dir = -1;
  auto.cheek = 0;
  autoLetGo();
  autoBreath(0.55, 0.2);
  const steps = [];
  if (v.legsSp > 0 && !jadrija.autoWhy('legs.close')) {
    autoQueue(1.3, () => jadrija.askShow('legs.close', 'auto'));
    steps.push('legs together');
  }
  if ((v.liftL || v.liftR) && !jadrija.autoWhy('legs.lower')) {
    autoQueue(2.6, () => jadrija.askShow('legs.lower', 'auto'));
    steps.push('a leg down');
  }
  if (v.arms && !jadrija.autoWhy('arms.down')) {
    autoQueue(3.6, () => jadrija.askShow('arms.down', 'auto'));
    steps.push('arms in');
  }
  autoQueue(4.5, () => autoBreath(0.4));
  autoQueue(9, () => autoBreath(0.3));
  const said = autoSay('recover', true);
  auto.next = Math.max(auto.next, now + 6);
  autoDid('recover', { why: 'a run of hard ones (ache ' + auto.acheRun.toFixed(2) + ' at the last)'
    + (steps.length ? ': ' + steps.join(', ') : ''), said });
  return true;
}

/** A step of something she is in the middle of, `secs` from now. */
function autoQueue(secs, fn) { auto.queue.push({ at: auto.clock + secs, fn }); }

function autoQueueTick() {
  if (!auto.queue.length) return;
  const now = auto.clock;
  for (let i = 0; i < auto.queue.length; i++) {
    const q = auto.queue[i];
    if (q.at > now) continue;
    auto.queue.splice(i--, 1);
    try { q.fn(); } catch (e) { /* the moment passed */ }
  }
}

/** A move of hers that was not chosen but happened — logged and remembered like one. */
function autoDid(id, o = {}) {
  const v = jadrija && jadrija.autoView ? jadrija.autoView() : null;
  auto.doing = id; auto.doingT = auto.clock;
  auto.moved++;
  autoLog({ ctx: auto.ctx, phase: v ? v.phase : undefined, heat: +auto.heat.toFixed(2), calm: +auto.calm.toFixed(2),
    pick: id, why: o.why || '', said: o.said || undefined });
}

// ── your hands on her ────────────────────────────────────────────────────────

/**
 * Your hand arrives, stays, and goes. She stills for it (none of her own
 * moves while it is on her), answers it `hand.after` s after it arrives, and
 * again now and then while it stays.
 */
function autoHandPoll(v) {
  const H = autoHandNow(), now = auto.clock, P = AUTO.hand;
  const was = auto.hand;
  if (H && (!was || was.kind !== H.kind || was.side !== (H.side || null))) {
    auto.hand = { kind: H.kind, side: H.side || null, t0: now, reacted: false,
      at: now + P.after[0] + (P.after[1] - P.after[0]) * Math.random(), n: 0 };
    if (H.kind === 'pet' && !(was && was.kind === 'pet')) autoRewardLast('pet');
    return;
  }
  if (!H && was) {
    auto.hand = null;
    // A hand that stayed, gone: a look after it, and now and then a word.
    if (now - was.t0 > P.long && auto.on && !auto.still && now >= auto.pausedTo) {
      const ok = v && v.gaze !== Infinity && jadrija.autoMove({ glance: 2.5 });
      const said = auto.heat > 0.4 && Math.random() < 0.45 ? autoSay('handOff') : null;
      const where = { pet: 'hair', pull: 'hair', mouth: 'lip' }[was.kind] || was.kind;
      if (ok || said) autoDid('handOff', { why: 'your hand left her ' + where, said });
    }
  }
}

/** What she does for your hand, by where it is and where she is. Answers the special's id, or null. */
function autoHandReact(v, ctx) {
  const Hn = auto.hand;
  if (!Hn || auto.clock < Hn.at) return null;
  const first = !Hn.reacted;
  Hn.reacted = true;
  Hn.n++;
  const P = AUTO.hand;
  Hn.at = auto.clock + P.again[0] + (P.again[1] - P.again[0]) * Math.random();
  // Later on, not every time: a hand that stays is mostly just held still for.
  if (!first && Math.random() < 0.45) return null;
  const lying = ctx === 'front' || ctx === 'back' || ctx === 'side';
  const upright = ctx === 'stand' || ctx === 'kneel' || ctx === 'leash' || ctx === 'fours';
  const H = auto.heat, gazeOk = v.gaze !== Infinity;
  let id = null, why = '', said = null;
  if (Hn.kind === 'pet') {
    // Her head turned into it, and on her front, up off the pillow to it.
    if (gazeOk) jadrija.autoMove({ glance: 4 });
    if (ctx === 'front' && v.rag) jadrija.autoMove({ cot: 'lift', k: 0.45 });
    if (!first && !v.eyesDown && (upright || ctx === 'back' || ctx === 'sit')) jadrija.askShow('look.down', 'auto');
    auto.calm = Math.min(1, auto.calm + 0.05);
    id = 'handTurn'; why = 'your hand in her hair — her head into it';
    if (first || Math.random() < 0.4) said = autoSay('pet');
  } else if (Hn.kind === 'pull') {
    auto.heat = Math.min(1, auto.heat + 0.04);
    if (v.rag && (ctx === 'front' || ctx === 'sit' || ctx === 'cotKneel')) jadrija.autoMove({ cot: 'arch', k: 0.4 });
    else if (upright || ctx === 'sit' || ctx === 'cotKneel') { jadrija.autoMove({ chest: 0.8 }); auto.chestTo = auto.clock + 4; }
    id = 'handLean'; why = 'your fist in her hair — her back arched to it';
    said = autoSay('pull', first);
  } else if (Hn.kind === 'hip' || Hn.kind === 'breast') {
    // She pushes into it.
    if (v.rag && (ctx === 'sit' || ctx === 'cotKneel' || ctx === 'front')) jadrija.autoMove({ cot: 'arch', k: 0.25 });
    else if (lying && v.rag) jadrija.autoMove({ cot: 'wiggle', k: 0.2 });
    else if (!v.chest) { jadrija.autoMove({ chest: Hn.kind === 'breast' ? 0.75 : 0.5 }); auto.chestTo = auto.clock + 5; }
    if (gazeOk) jadrija.autoMove({ glance: 3.5 });
    if (Hn.kind === 'breast' && H > 0.6 && !v.mouth && !jadrija.autoWhy('mouth.open')) jadrija.askShow('mouth.open', 'auto');
    id = 'handLean'; why = 'your hand on her ' + Hn.kind + ' — she pushes into it';
    if (first && Math.random() < 0.6) said = autoSay('hand');
  } else if (Hn.kind === 'mouth') {
    if (v.eyesDown) jadrija.askShow('look.up', 'auto');
    if (gazeOk) jadrija.autoMove({ glance: 4 });
    id = 'handTurn'; why = 'your thumb at her lip — her eyes up at you';
  } else if (Hn.kind === 'thigh') {
    const r = autoHandThigh(v, ctx, Hn.side);
    if (!r) return null;
    ({ id, why, said } = r);
  }
  if (!id) return null;
  autoDid(id, { why, said: said || undefined });
  return id;
}

/**
 * Your hand on her THIGH: that leg opens (on her back, its knee comes up —
 * the ladder's first rung, on that side; elsewhere her legs apart), or, at a
 * middling heat and with the cheek for it, she closes them on you; with a
 * leg raised she lets it down a rung.
 */
function autoHandThigh(v, ctx, side) {
  const H = auto.heat;
  const raised = side === 'L' ? v.liftL : v.liftR;
  const back = ctx === 'back' && v.liftMode === 'back' && !!v.legsDown;
  const r = Math.random();
  const tease = H > 0.25 && H < 0.6 && v.legsSp > 0 && (auto.cheek > 0.3 || r < 0.25);
  if (tease && !jadrija.autoWhy('legs.close')) {
    jadrija.askShow('legs.close', 'auto');
    // ...and give in a few seconds later.
    autoQueue(3.5 + 2 * Math.random(), () => { if (auto.hand && auto.hand.kind === 'thigh') jadrija.askShow('legs.spread', 'auto'); });
    return { id: 'handClose', why: 'your hand on her thigh — legs closed on you, teasing', said: autoSay('thighClose', true) };
  }
  if (raised && H < 0.45 && !jadrija.autoWhy('legs.lower')) {
    jadrija.askShow('legs.lower', 'auto');
    return { id: 'handEase', why: 'your hand on her raised thigh — she lets it down', said: null };
  }
  if (back && !raised && !jadrija.autoWhy(side === 'L' ? 'legs.leftup' : 'legs.rightup')) {
    jadrija.askShow(side === 'L' ? 'legs.leftup' : 'legs.rightup', 'auto');
    auto.ladder.at = auto.clock; auto.ladder.side = side;
    return { id: 'handOpen', why: 'your hand on her ' + (side === 'L' ? 'left' : 'right') + ' thigh — that knee up, open',
      said: Math.random() < 0.6 ? autoSay('thighOpen') : null };
  }
  if (v.legsSp < 1 && (ctx === 'stand' || ctx === 'back' || ctx === 'sit') && !jadrija.autoWhy('legs.spread')) {
    jadrija.askShow('legs.spread', 'auto');
    return { id: 'handOpen', why: 'your hand on her thigh — her legs apart for it', said: Math.random() < 0.5 ? autoSay('thighOpen') : null };
  }
  // Apart already, and warm: wider for it.
  if (v.legsSp >= 1 && H > 0.5 && (ctx === 'stand' || ctx === 'back') && !jadrija.autoWhy('legs.wider')) {
    jadrija.askShow('legs.wider', 'auto');
    return { id: 'handOpen', why: 'your hand on her thigh — wider for it', said: Math.random() < 0.5 ? autoSay('thighOpen') : null };
  }
  if (v.gaze !== Infinity) {
    jadrija.autoMove({ glance: 3 });
    return { id: 'handTurn', why: 'your hand on her thigh — she watches it', said: null };
  }
  return null;
}

// ── the toys in her ──────────────────────────────────────────────────────────

/** The toys, at each poll: what she feels of them, and a change in them noticed. */
function autoToyPoll(dt, v) {
  const T0 = v && v.toy;
  const on = !!(T0 && T0.on && T0.on.length);
  const lvl = on ? T0.lvl : 0;
  const beat = on ? T0.beat : 0;
  // What she feels: the pulse, eased over a second and a half.
  auto.buzzK += (beat - auto.buzzK) * (1 - Math.exp(-dt / 1.5));
  auto.buzzLvl = lvl;
  if (on) auto.heat = Math.min(1, auto.heat + dt * AUTO.toy.heat * auto.buzzK * (1 - 0.4 * auto.heat));
  const was = auto.toyLvl;
  if (Math.abs(lvl - was) > 0.04) {
    const how = !was ? 'on' : !lvl ? 'off' : lvl > was ? 'up' : 'down';
    auto.toyLvl = lvl;
    auto.toyAt = auto.clock;
    if (!lvl) auto.toyOffAt = auto.clock;
    if (how === 'on' || how === 'up') auto.heat = Math.min(1, auto.heat + 0.04);
    const R = AUTO.toy.react;
    auto.toyReact = { how, lvl, at: auto.clock + R[0] + (R[1] - R[0]) * Math.random() };
    // An answer to what she asked for.
    const W = auto.toyWant;
    if (W && auto.clock - W.t < AUTO.toy.thanks
      && ((W.dir === 'more' && (how === 'up' || how === 'on')) || (W.dir === 'less' && (how === 'down' || how === 'off'))
        || (W.dir === 'on' && how === 'on'))) {
      auto.toyReact.thanks = true;
    }
    auto.toyWant = null;
  }
  if (lvl >= 0.9) auto.toyHigh += dt; else auto.toyHigh = 0;
}

/** Her answer to the toy being turned: on, up, down, off. Answers the special's id, or null. */
function autoToyReact(v, ctx) {
  const R = auto.toyReact;
  if (!R || auto.clock < R.at) return null;
  auto.toyReact = null;
  const lying = ctx === 'front' || ctx === 'back' || ctx === 'side';
  const L = R.lvl;
  let said = null, what = '';
  if (R.how === 'on' || R.how === 'up') {
    autoBreath(0.3 + 0.5 * L, 0.05);
    if (v.rag && ctx === 'front') {
      if (L >= 0.7) { jadrija.autoMove({ cot: Math.random() < 0.5 ? 'arch' : 'heels', k: 0.4 + 0.6 * L }); what = 'arched / heels up'; }
      else { jadrija.autoMove({ cot: 'lift', k: 0.5 }); jadrija.autoMove({ glance: 3 }); what = 'a look back'; }
    } else if (v.rag && lying) { jadrija.autoMove({ cot: 'wiggle', k: 0.3 + 0.6 * L }); what = 'a squirm'; }
    else if (v.rag) { jadrija.autoMove({ cot: 'arch', k: 0.3 + 0.6 * L }); what = 'arched'; }
    else if (!v.chest) { jadrija.autoMove({ chest: 0.4 + 0.5 * L }); auto.chestTo = auto.clock + 4; what = 'her back straight'; }
    said = R.thanks ? autoSay('toyThanks', true) : autoSay(R.how === 'on' ? 'buzzOn' : 'buzzUp', R.how === 'on');
  } else if (R.how === 'down') {
    if (v.gaze !== Infinity) jadrija.autoMove({ glance: 3 });
    said = R.thanks ? autoSay('toyThanks', true) : Math.random() < 0.6 ? autoSay('buzzDown') : null;
    what = 'a look';
  } else {
    if (v.gaze !== Infinity) jadrija.autoMove({ glance: 3.5 });
    if (ctx === 'front' && v.rag) jadrija.autoMove({ cot: 'lift', k: 0.5 });
    said = R.thanks ? autoSay('toyThanks', true) : autoSay('buzzOff', true);
    what = 'a look back';
  }
  autoDid('toyReact', { why: 'the toy ' + R.how + (R.how === 'off' ? '' : ' (' + Math.round(L * 100) + '%)') + ' — ' + what, said });
  return 'toyReact';
}

/**
 * Asking for it: stronger, after a while at a low level and warm; softer,
 * after a long time at full and hot; on, worn and off a long while, warm.
 * A line and a look, and `toyWant` so your answer is thanked.
 */
function autoToyAsk(v) {
  const T0 = v.toy, P = AUTO.toy, now = auto.clock;
  if (!T0 || now - auto.toyAsked < P.ask || v.gaze === Infinity) return null;
  const on = T0.on.length > 0;
  let dir = null;
  if (on && now - auto.toyAt > P.askAfter && auto.toyLvl <= 0.55 && auto.heat > 0.5) dir = 'more';
  else if (on && auto.toyHigh > P.full && auto.heat > 0.65) dir = 'less';
  else if (!on && now - auto.toyOffAt > P.onAfter && auto.heat > 0.55) dir = 'on';
  if (!dir) return null;
  auto.toyAsked = now;
  auto.toyWant = { dir, t: now };
  jadrija.autoMove({ glance: 4 });
  const id = dir === 'more' ? 'toyMore' : dir === 'less' ? 'toyLess' : 'toyOn';
  const said = autoSay(id, true);
  autoDid(id, { why: dir === 'more' ? 'the toy low ' + Math.round(now - auto.toyAt) + ' s, and she is warm'
    : dir === 'less' ? 'the toy at full ' + Math.round(auto.toyHigh) + ' s' : 'the toy in her, and off', said });
  return id;
}

// ── her legs' ladder ─────────────────────────────────────────────────────────

const AUTO_RUNG = { 0: 0, 1: 1, s: 1.5, 2: 2, 3: 3, 4: 4 };
/** Which leg goes first: the one your hand is on, else the one she last chose. */
function autoLadderSide() {
  if (auto.hand && auto.hand.kind === 'thigh' && auto.hand.side) return auto.hand.side;
  auto.ladder.side = auto.ladder.side === 'L' ? 'R' : 'L';
  return auto.ladder.side;
}
/**
 * THE NEXT RUNG, in the direction she is going (`ladder.dir`): up — one
 * leg's knee, its foot up, both, straight up, and over when she is hot; on
 * her front a shin, both, the knees off the mattress — and down again a rung
 * at a time. Null at the top or the bottom.
 */
function autoLadderNext(v) {
  const m = v.liftMode;
  if (!m) return null;
  // In the cradle her hands hold both knees up (rung 2 either side): up from
  // there is one leg kept up and the other laid down while she is warm, both
  // straight up when she is hot; down from there is not the ladder's (her
  // legs stretched out is `legsDown`, a move of its own).
  if (m === 'back' && !v.legsDown) return auto.ladder.dir > 0 ? (auto.heat > 0.6 ? 'higher' : 'legUp') : null;
  const a = AUTO_RUNG[v.liftL] || 0, b = AUTO_RUNG[v.liftR] || 0;
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (auto.ladder.dir > 0) {
    if (hi === 0) return 'legUp';
    if (m === 'front') return lo === 0 ? 'bothUp' : hi < 2 ? 'higher' : null;
    if (lo === 0) return hi < 2 ? 'higher' : 'bothUp';
    if (hi < 3) return 'higher';
    if (hi < 4 && auto.heat > 0.75) return 'higher';
    return null;
  }
  return hi > 0 ? 'lower' : null;
}
/** Which way the ladder goes, with some give either side so it does not flicker. */
function autoLadderTick(v) {
  const Ld = auto.ladder, now = auto.clock;
  if (!v || !v.liftMode) return;
  const a = AUTO_RUNG[v.liftL] || 0, b = AUTO_RUNG[v.liftR] || 0, hi = Math.max(a, b);
  if (Ld.dir > 0) {
    const top = !autoLadderNext(v) && hi > 0;
    if (top && !Ld.topAt) Ld.topAt = now;
    if (!top) Ld.topAt = 0;
    if (auto.heat < 0.33 || auto.recoverTo > now || auto.calm > 0.75 || (Ld.topAt && now - Ld.topAt > 25)) {
      Ld.dir = -1; Ld.topAt = 0;
    }
  } else if (auto.heat > 0.5 && auto.recoverTo <= now && now - auto.lastRecover > 60 && now - Ld.at > 30
    && (hi === 0 || auto.heat > 0.8)) {
    Ld.dir = 1;
  }
}

// ── the choice ───────────────────────────────────────────────────────────────

/**
 * THE SCORE of one move, now: its weight, times what its moods are worth in
 * this mood, times how fresh it is. Answers [score, why].
 */
function autoScore(id, M, v) {
  const now = auto.clock, H = auto.heat, C = auto.calm, B = auto.bias;
  const sinceEv = now - auto.lastEvent;
  const streak = auto.hits.filter((t) => now - t < 30).length;
  const flinch = now - auto.lastHard < 3;
  const recovering = auto.recoverTo > now;
  const why = [];
  // Recovering, she does only the quiet things.
  if (recovering && !M.tags.some((t) => t === 'calm' || t === 'close' || t === 'shy' || t === 'look')) return [0, why];
  let m = 0;
  for (const tag of M.tags) {
    let f = 0;
    if (tag === 'open') { f = 0.35 + 1.6 * H + (streak >= 3 ? 0.6 : 0) - (flinch ? 0.5 : 0); if (streak >= 3) why.push(streak + ' hits/30s'); }
    else if (tag === 'close') { f = 0.4 + 0.9 * (1 - H) + (flinch ? 1.0 : 0) + (recovering ? 0.8 : 0); if (flinch) why.push('flinch'); }
    else if (tag === 'look') { f = 0.5 + (sinceEv < 5 ? 1.2 : 0); if (sinceEv < 5) why.push('checks on you'); }
    else if (tag === 'shy') f = 0.35 + 0.6 * (1 - H) * (0.5 + C);
    else if (tag === 'heat') f = 0.2 + 1.8 * H;
    else if (tag === 'play') f = 0.45 + 0.6 * H;
    else if (tag === 'calm') f = 0.3 + 1.2 * C + 0.9 * (1 - H) - (sinceEv < 8 ? 0.5 : 0) + (recovering ? 1.5 : 0);
    else if (tag === 'tease') { f = 0.4 + 2.2 * auto.cheek; why.push('cheek ' + auto.cheek.toFixed(2)); }
    else if (tag === 'toy') {
      f = 0.3 + 2.6 * auto.buzzK + 0.6 * auto.buzzLvl;
      why.push('the toy ' + Math.round(auto.buzzLvl * 100) + '%');
    }
    f += B[tag] || 0;
    if (B[tag] > 0.2) why.push('cue:' + tag);
    m += Math.max(0.02, f);
  }
  m /= M.tags.length;
  let s = M.w * m;
  if (M.rest) {
    // Stillness is wanted more the calmer she is, while she recovers, and
    // with your hand on her; less while things are happening to her.
    s *= 0.6 + 0.8 * C + 0.6 * (1 - H) + (recovering ? 1.6 : 0) - (sinceEv < 3 ? 0.5 : 0);
    if (recovering) why.push('recovering');
    // But not rest after rest after rest: stillness is a beat, not a stop.
    let n = 0;
    for (let i = auto.last.length - 1; i >= 0 && auto.last[i].id === 'rest'; i--) n++;
    if (!recovering) s *= [1, 0.7, 0.35, 0.15][Math.min(3, n)];
    return [Math.max(0.05, s), why];
  }
  // MEMORY. Nothing again within her last `memN` picks; a move's own
  // cooldown; the undoing move held off `invHold` s unless her mood turned
  // (a flinch, your cue, her recovery) — and no ×1.3 for it after, which
  // was the flip-flop.
  const picks = auto.last.filter((x) => x.id !== 'rest');
  if (picks.slice(-AUTO.memN).some((x) => x.id === id)) return [0, why];
  if (M.cool && now - (auto.used[id] || -1e9) < M.cool) return [0, why];
  const undo = M.inv ? picks.find((x) => x.id === M.inv && now - x.t < AUTO.invHold) : null;
  if (undo) {
    const turned = (M.tags.includes('close') && (flinch || recovering)) || M.tags.some((t) => (B[t] || 0) > 0.5);
    if (!turned) s *= 0.12; else why.push('her mood turned');
  }
  // HER LEGS' LADDER: only the next rung in her direction, and not hard on
  // the heels of the last one.
  if (M.lad) {
    if (now - auto.ladder.at < AUTO.legGap) return [0, why];
    if (autoLadderNext(v) !== id) return [0, why];
    s *= 2.2;
    why.push('ladder ' + (auto.ladder.dir > 0 ? 'up' : 'down'));
  }
  // What you liked.
  const rw = auto.reward[id] || 0;
  if (rw > 0.05) { s *= 1 + AUTO.reward.k * rw; why.push('you liked it'); }
  // The toy on its pulse: what she does is the toy's, mostly.
  if (M.tags.includes('toy') && auto.buzzK > 0.35) s *= 1.3;
  // Big ones are rare, and not while things are happening to her — unless
  // the big one IS the answer (up on her knees for a tug).
  const answers = auto.react === 'tug' && id === 'kneelUp';
  if (M.big && !answers) {
    // A gate and not a weight: at 0.05 a roll still came up one time in
    // fifty, and one was 5 s after the last (MEASURED, rollBack then
    // rollFront mid-spanking). And none while a toy runs in her.
    // Nor in her first half minute, nor just after you asked her something.
    if (now - auto.lastBig < AUTO.bigGap || sinceEv < 12 || (auto.buzzLvl > 0 && !id.startsWith('pg'))
      || now - auto.engagedAt < 30 || now - auto.lastOrder < 25) return [0, why];
    s *= 0.6;
  }
  // A hit just landed and this is an answer to it: the reflexive ones.
  if (auto.react === 'spank' || auto.react === 'lash') {
    if (id === 'wiggle' || id === 'peek' || id === 'heels' || id === 'close' || id === 'arch' || id === 'spread') { s *= 1.6; why.push('answers the hit'); }
  } else if (auto.react === 'tug' && (id === 'kneelUp' || id === 'present' || id === 'glance' || id === 'peek')) {
    s *= id === 'kneelUp' || id === 'present' ? 2.2 : 1.3; why.push('answers the tug');
  } else if (auto.react === 'hose' && M.tags.includes('play')) { s *= 1.6; why.push('the hose'); }
  return [s, why];
}

/** Her line for a hit, by how hard it was and how hot she is. */
function autoHitLine() {
  if (auto.hitHard >= 2 || auto.clock - auto.lastHard < 2) return 'hitHard';
  if (auto.heat > 0.65 && auto.ache < 0.5) return 'hitHot';
  return 'hit';
}

/** Her line for a tug, by the pose she is in on the end of it. */
function autoTugLine(v) {
  const p = v && v.leash ? v.leash.pose : null;
  return p === 'kneel' ? 'tugKneel' : p === 'stand' ? 'tugStand' : 'tug';
}

/** Choose and do one move. Answers the trace entry, or null if there was nothing to do. */
function autoDecide(force = false) {
  const v = jadrija && jadrija.autoView ? jadrija.autoView() : null;
  const ctx = autoCtx(v);
  auto.ctx = ctx;
  if (!ctx) { auto.next = auto.clock + 1.0; auto.why = 'between'; return null; }
  v.ctx = ctx; v.heat = auto.heat;
  // ON THE LEASH, TUGGED, WITH THE CHEEK FOR IT: she stays where she is for
  // this one, and laughs — the next tug she comes (`resist`).
  if (auto.react === 'tug' && ctx === 'leash') {
    if (auto.clock - auto.resisted < 20) {
      // The next tug after she stayed put: she comes (below).
    } else if (autoCheeky() || (auto.cheek > 0.35 && auto.heat > AUTO.cheek.lo && Math.random() < 0.5)) {
      auto.react = null;
      auto.resisted = auto.clock;
      auto.lastTease = auto.clock; auto.teased = true; auto.cheek = 0;
      jadrija.autoMove({ glance: 3.5 });
      autoDid('resist', { why: 'tugged — she stays put, teasing', said: autoSay('resist', true) });
      return null;
    }
  }
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
  // An answer to a hit or a tug is a move — or, once she has learnt your
  // rhythm, now and then she just takes it, still.
  const react = auto.react;
  if (react) {
    const rest = cands.findIndex((c) => c.id === 'rest');
    if (rest >= 0 && cands.length > 1) {
      if ((react === 'spank' || react === 'lash') && autoRhythm()) cands[rest].s *= 0.6;
      else cands.splice(rest, 1);
    }
  }
  cands.sort((a, b) => b.s - a.s);
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
  if (auto.last.length > 8) auto.last.shift();
  auto.used[c.id] = auto.clock;
  if (M.lad) auto.ladder.at = auto.clock;
  if (M.big) auto.lastBig = auto.clock;
  if (!M.rest) { auto.doing = c.id; auto.doingT = auto.clock; auto.moved++; }
  // Her back straightened is held a while, then let go on its own.
  if (c.id === 'chest') auto.chestTo = auto.clock + 6 + 6 * Math.random();
  // And a line, sometimes: right after a hit it is about the hit, after a
  // tug about where she is on the leash.
  const kind = react === 'spank' || react === 'lash' ? autoHitLine() : react === 'tug' ? (c.id === 'present' ? 'present' : autoTugLine(v))
    : react === 'hose' ? 'hose' : M.say;
  if (react === 'tug' && auto.teased && auto.clock - auto.resisted < 20) {
    // The tug after the one she stayed put for: she comes, and gives in
    // (the line is on the `complies` entry).
    autoComply();
  } else if (kind && (c.id === 'tease' || Math.random() < (react ? AUTO.reactLineP : AUTO.lineP))) {
    e.said = autoSay(kind, c.id === 'tease') || undefined;
  }
  autoLog(e);
  return e;
}

/**
 * A CUE — "good girl", "be still", "more", "spread", "together", "relax",
 * "arch", "look at me", "come here", and (1.568.0) the toy: "stronger" /
 * "turn it down" / "turn it on" / "turn it off". Answers { label, ask } for
 * the ears' panel; `ask` is the request this armed, so the service's echo
 * of the same line is not asked twice.
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
  // Anything you tell her is an order given: her cheek waits, and if she
  // was teasing, she gives in (and says so, instead of the cue's own line).
  if (cue !== 'good') auto.lastOrder = auto.clock;
  const complied = cue !== 'good' ? autoComply() : null;
  if (cue === 'still') {
    auto.still = true;
    auto.queue.length = 0;
    label = 'still — she holds where she is until you say something else';
    if (!complied) autoSay('still', true);
  } else if (cue === 'good') {
    auto.calm = Math.min(1, auto.calm + 0.25);
    auto.heat = Math.min(1, auto.heat + 0.03);
    autoLean('look', 0.6); autoLean('shy', 0.4);
    const rw = autoRewardLast('good girl');
    if (!auto.still) jadrija.autoMove({ glance: 3 });
    autoSay('good', true);
    label = 'praised — she glows' + (rw ? ' (and will do “' + rw + '” more)' : '');
  } else if (cue === 'more') {
    auto.heat = Math.min(1, auto.heat + 0.15);
    autoLean('open', 1.2); autoLean('heat', 1.0);
    auto.next = Math.min(auto.next, auto.clock + 0.6);
    if (!complied) autoSay('more', true);
    label = 'more — warmer, and bolder';
  } else if (cue === 'relax') {
    auto.heat = Math.max(0, auto.heat - 0.2);
    auto.calm = Math.min(1, auto.calm + 0.3);
    autoLean('calm', 1.5);
    autoLetGo();
    auto.ladder.dir = -1;
    auto.next = Math.max(auto.next, auto.clock + 5);
    if (!complied) autoSay('calm', true);
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
      if (!complied) autoSay('come', true);
      label = 'she turns to you — "come to me"';
    }
    autoLean('look', 0.8);
  } else if (cue === 'toyup' || cue === 'toydown' || cue === 'toyon' || cue === 'toyoff') {
    // With no toy on her, "stronger" is "more" and "softer" is "relax".
    if (!(v && v.toy && v.toy.worn.length) && (cue === 'toyup' || cue === 'toydown')) {
      return autoCue(cue === 'toyup' ? 'more' : 'relax', sub);
    }
    label = autoToyCue(cue, v);
  }
  autoLog({ ctx, pick: 'cue:' + cue + (sub ? '/' + sub : ''), why: label, heat: +auto.heat.toFixed(2) });
  autoHud();
  return { label, ask };
}

/**
 * YOUR REMOTE, IN WORDS, while she is in her own mode (1.568.0): a step of
 * `toy.step` up or down on whatever of hers is running, on, or off — through
 * the same signal path as the phone's buttons, so with your phone on you
 * (`signalCan`). Her answer is the toy's own (`autoToyReact`).
 */
function autoToyCue(cue, v) {
  const T0 = v && v.toy;
  if (!T0 || !T0.worn.length) return 'nothing of hers to turn — no toy on her';
  const J = jadrija, step = AUTO.toy.step;
  if (cue === 'toyon' || (cue === 'toyup' && !T0.on.length)) {
    let got = null;
    for (const k of T0.worn) got = J.signal(k, true);
    if (got !== 'on') return got === 'no sender' ? 'no phone on you to turn it on with' : 'it would not come on (' + got + ')';
    if (cue === 'toyup') for (const k of T0.worn) J.remoteLevel(k, 0.5);
    return 'the toy on' + (cue === 'toyup' ? ', at half' : '');
  }
  if (!T0.on.length) return 'it is not on';
  if (cue === 'toyoff') {
    let got = null;
    for (const k of T0.on) got = J.signal(k, false);
    return got === 'no sender' ? 'no phone on you to turn it off with' : 'the toy off';
  }
  const lvl = Math.round(T0.lvl / step) * step;
  const want = Math.max(step, Math.min(1, lvl + (cue === 'toyup' ? step : -step)));
  if (Math.abs(want - T0.lvl) < 0.01) return cue === 'toyup' ? 'it is already full' : 'it is already as low as it goes';
  for (const k of T0.on) J.remoteLevel(k, want);
  return 'the toy ' + (cue === 'toyup' ? 'up' : 'down') + ' to ' + Math.round(want * 100) + '%';
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

/** Her mood in a word, for her voice and the readout. */
function autoMood() {
  const now = auto.clock;
  if (!auto.on) return null;
  if (auto.still) return 'still';
  if (auto.recoverTo > now) return 'recovering';
  if (auto.holdTo > now) return 'bracing';
  if (auto.teased && now - auto.lastTease < 12) return 'teasing';
  if (auto.hand) return 'held';
  if (auto.buzzLvl > 0) return 'buzzing';
  if (auto.heat >= 0.7) return 'hot';
  if (auto.heat <= 0.3 && auto.calm >= 0.4) return 'easy';
  return null;
}

/**
 * THE READOUT (dev only): `?autodbg` on the page or `__fr.auto.dbg(true)` —
 * her mood's numbers as bars, the rhythm she has learnt, the ladder, what is
 * holding her, and her last picks and why. Rewritten at the poll, four times
 * a second, and only while it is shown.
 */
function autoDbg() {
  if (typeof document === 'undefined') return;
  if (!auto.dbgOn) { if (auto.dbgEl) auto.dbgEl.hidden = true; return; }
  if (!auto.dbgEl) {
    const el = document.createElement('div');
    el.id = 'auto-dbg';
    el.style.cssText = 'position:fixed;left:8px;bottom:96px;z-index:60;pointer-events:none;'
      + 'font:11px/1.35 ui-monospace,monospace;color:#d8f0e8;background:rgba(0,0,0,0.62);'
      + 'padding:6px 8px;border-radius:4px;white-space:pre;max-width:46vw;overflow:hidden';
    document.body.appendChild(el);
    auto.dbgEl = el;
  }
  const el = auto.dbgEl;
  el.hidden = false;
  const now = auto.clock;
  const bar = (x) => '█'.repeat(Math.round(Math.max(0, Math.min(1, x)) * 10)).padEnd(10, '·');
  const R = autoRhythm(), Ld = auto.ladder;
  const held = auto.still ? 'still' : now < auto.pausedTo ? 'yours ' + (auto.pausedTo - now).toFixed(0) + 's'
    : now < auto.holdTo ? 'braced' : auto.hand ? 'hand:' + auto.hand.kind : '';
  const lines = [
    'AUTO ' + (auto.on ? 'on' : 'off') + '  ' + (auto.ctx || '-') + '  mood ' + (autoMood() || '-') + (held ? '  [' + held + ']' : ''),
    'heat  ' + bar(auto.heat) + ' ' + auto.heat.toFixed(2) + '   calm  ' + bar(auto.calm) + ' ' + auto.calm.toFixed(2),
    'ache  ' + bar(auto.ache) + ' ' + auto.ache.toFixed(2) + '   cheek ' + bar(auto.cheek) + ' ' + auto.cheek.toFixed(2),
    'toy   ' + bar(auto.buzzK) + ' ' + (auto.buzzLvl ? Math.round(auto.buzzLvl * 100) + '%' : 'off')
      + '   rhythm ' + (R ? R.every.toFixed(1) + 's, next ' + (R.next - now).toFixed(1) : '-')
      + '   ladder ' + (Ld.dir > 0 ? 'up' : 'down') + (Ld.topAt ? ' (top)' : ''),
    'liked ' + (Object.entries(auto.reward).filter(([, x]) => x > 0.05).map(([k, x]) => k + ' ' + x.toFixed(1)).join(', ') || '-')
      + '   next ' + Math.max(0, auto.next - now).toFixed(1) + 's',
    '',
    ...auto.trace.slice(-9).reverse().map((e) => (e.t.toFixed(1)).padStart(6) + ' ' + String(e.pick).padEnd(10)
      + ' ' + String(e.why || '').slice(0, 64) + (e.said ? '  “' + e.said + '”' : '')),
  ];
  el.textContent = lines.join('\n');
}

/**
 * The specials, at each poll, in the order they outrank each other: a step
 * of what she is in the middle of; her answer to the toy being turned; the
 * start of a recovery; your hand; anticipation; asking for the toy. Answers
 * whether one of them moved her (which counts as her move for the gap).
 */
function autoSpecials(v, ctx) {
  autoQueueTick();
  // Your hand is answered wherever she is — between poses too (a pet
  // stands her in a beat of its own), with what needs no pose: her eyes.
  if (autoHandReact(v, ctx)) return true;
  if (!ctx) return false;
  if (autoToyReact(v, ctx)) return true;
  if (autoRecoverTick(v, ctx)) return true;
  if (auto.hand) return false;
  if (autoAntic(v, ctx)) return true;
  if (autoToyAsk(v)) return true;
  return false;
}

/** Once a tick, from 90-app.js. A clock and a comparison unless it is time. */
function autoTick(dt) {
  auto.clock += dt;
  if (!auto.on) return;
  if (state.phase !== 'ground' || !jadrija || !jadrija.autoView) { autoOff('left'); return; }
  // Her mood drifts home.
  auto.heat += (AUTO.heatRest - auto.heat) * (1 - Math.exp(-dt / AUTO.heatTau));
  auto.calm += (AUTO.calmRest - auto.calm) * (1 - Math.exp(-dt / AUTO.calmTau));
  auto.ache *= Math.exp(-dt / AUTO.ache.tau);
  if (auto.clock - auto.biasT > 1) {
    const span = auto.clock - auto.biasT;
    const f = Math.exp(-span / AUTO.biasLife);
    for (const k of Object.keys(auto.bias)) { auto.bias[k] *= f; if (auto.bias[k] < 0.02) delete auto.bias[k]; }
    const g = Math.exp(-span / AUTO.reward.tau);
    for (const k of Object.keys(auto.reward)) { auto.reward[k] *= g; if (auto.reward[k] < 0.05) delete auto.reward[k]; }
    auto.biasT = auto.clock;
  }
  if (auto.clock - auto.polled < AUTO.poll) return;
  const pdt = auto.clock - auto.polled;
  auto.polled = auto.clock;
  const v = jadrija.autoView();
  autoPoll(Math.min(pdt, 1), v);
  autoCheekTick(Math.min(pdt, 1));
  if (auto.chestTo && auto.clock > auto.chestTo) { auto.chestTo = 0; jadrija.autoMove({ chest: 0 }); }
  autoHud();
  autoDbg();
  // Held: still, or something you asked is hers to finish — nothing of hers
  // at all, not even the small things she does on her own.
  if (auto.still) { auto.queue.length = 0; auto.next = Math.max(auto.next, auto.clock + 1); auto.why = 'still'; return; }
  if (auto.clock < auto.pausedTo) { auto.next = Math.max(auto.next, auto.pausedTo); auto.why = 'yours'; return; }
  const ctx = autoCtx(v);
  auto.ctx = ctx;
  if (v) { v.ctx = ctx; autoLadderTick(v); }
  if (v && v.at && ground && ground.you && Math.hypot(v.at[0] - ground.you.x, v.at[2] - ground.you.z) > AUTO.far) {
    auto.next = Math.max(auto.next, auto.clock + 2); auto.why = 'far'; return;
  }
  if (v && autoSpecials(v, ctx)) {
    // Whatever she just did is her move for now: the next is a gap away —
    // unless a hit or a tug is waiting on its answer.
    if (!auto.react) auto.next = Math.max(auto.next, auto.clock + 2.5 + 2 * Math.random());
    return;
  }
  if (auto.clock < auto.next) return;
  // Braced, or your hand on her: still for it (a hit's answer still comes).
  if (auto.clock < auto.holdTo && !auto.react) { auto.why = 'braced'; return; }
  if (auto.hand && !auto.react) { auto.next = auto.clock + 1; auto.why = 'held'; return; }
  auto.why = null;
  autoDecide();
  // And the next one: 3-8 s, longer once she has settled or while she
  // recovers, a little shorter when she is hot.
  const settled = auto.clock - auto.lastEvent > AUTO.quiet && auto.heat < 0.35;
  const g = AUTO.gap[0] + (AUTO.gap[1] - AUTO.gap[0]) * Math.random();
  const f = (settled ? AUTO.settled : 1) * (auto.recoverTo > auto.clock ? AUTO.slowed : 1) * (auto.heat > 0.65 ? 0.85 : 1);
  auto.next = Math.max(auto.next, auto.clock + g * f);
}

/** For her voice — see `sceneTalk` in 90-app.js. */
function autoScene() {
  if (!auto.on) return null;
  const o = { auto: true };
  if (auto.still) o.auto_still = true;
  if (auto.doing && auto.clock - auto.doingT < 12) o.auto_doing = auto.doing;
  o.auto_heat = +auto.heat.toFixed(2);
  const m = autoMood();
  if (m && m !== 'still') o.auto_mood = m;
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
  state: () => ({ on: auto.on, ctx: auto.ctx, still: auto.still, why: auto.why, mood: autoMood(),
    clock: +auto.clock.toFixed(1), next: +(auto.next - auto.clock).toFixed(1),
    paused: +Math.max(0, auto.pausedTo - auto.clock).toFixed(1),
    heat: +auto.heat.toFixed(3), calm: +auto.calm.toFixed(3), ache: +auto.ache.toFixed(3), cheek: +auto.cheek.toFixed(3),
    bias: Object.fromEntries(Object.entries(auto.bias).map(([k, x]) => [k, +x.toFixed(2)])),
    reward: Object.fromEntries(Object.entries(auto.reward).map(([k, x]) => [k, +x.toFixed(2)])),
    doing: auto.doing, decisions: auto.decisions, moved: auto.moved,
    hand: auto.hand ? { kind: auto.hand.kind, side: auto.hand.side, n: auto.hand.n } : null,
    toy: { lvl: auto.buzzLvl, k: +auto.buzzK.toFixed(2), high: +auto.toyHigh.toFixed(1), want: auto.toyWant ? auto.toyWant.dir : null },
    ladder: { dir: auto.ladder.dir, top: !!auto.ladder.topAt }, rhythm: autoRhythm(),
    recovering: +Math.max(0, auto.recoverTo - auto.clock).toFixed(1), braced: +Math.max(0, auto.holdTo - auto.clock).toFixed(1),
    queue: auto.queue.length,
    last: auto.last.map((x) => x.id), view: jadrija && jadrija.autoView ? jadrija.autoView() : null }),
  mood: () => ({ heat: +auto.heat.toFixed(3), calm: +auto.calm.toFixed(3), ache: +auto.ache.toFixed(3),
    cheek: +auto.cheek.toFixed(3), hits30: auto.hits.length, mood: autoMood() }),
  trace: (n = 30) => auto.trace.slice(-n),
  /** Set her mood or her clock for a probe: { heat, calm, ache, cheek, next, pause }. */
  set: (o = {}) => {
    if (o.heat != null) auto.heat = +o.heat;
    if (o.calm != null) auto.calm = +o.calm;
    if (o.ache != null) { auto.ache = +o.ache; auto.acheRun = +o.ache; }
    if (o.cheek != null) auto.cheek = +o.cheek;
    if (o.next != null) auto.next = auto.clock + +o.next;
    if (o.pause != null) { auto.pausedTo = auto.clock + +o.pause; auto.next = Math.min(auto.next, auto.pausedTo); }
    if (o.lastOrder != null) auto.lastOrder = auto.clock - +o.lastOrder;
    return autoApi.mood();
  },
  /** The readout (dev only) on or off. */
  dbg: (on = true) => { auto.dbgOn = !!on; autoDbg(); return auto.dbgOn; },
  moves: () => Object.fromEntries(Object.entries(AUTO_MOVES).map(([k, M]) => [k, Object.keys(M.ctx).filter((c) => M.ctx[c])])),
  specials: () => AUTO_SPECIAL.slice(),
  words: (text) => ({ cmd: autoWords(text), cue: autoCueWords(text), safe: autoSafeword(text) }),
};
// The readout, asked for on the page's address.
if (typeof location !== 'undefined' && /[?&]autodbg\b/.test(location.search || '')) auto.dbgOn = true;
