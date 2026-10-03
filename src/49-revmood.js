// -----------------------------------------------------------------------------
// Roles reversed: Chloe's MOOD, and your begging (1.583.0).
//
// Misha, 2 Oct 2026: *"the dialogue needs to be more interesting/kinda
// random/ chloe is disciplining baye, which is good, but if baye is not
// obeying, chloe has to progressively become more stern, and deliver more
// spanks/slaps, and collar pulls or what nots, and then if baye please her
// then chloe should progressively cool off and become gentler with baye, but
// baye should always be allowed to ask chloe to spank her or to do whatever,
// especially begging to be spanked, whipped, disciplined, and chloe then gets
// excited and does it and says some random shit and that excitement should go
// in waves."*
//
// The same two adults and the same game as 1.561.0 onward; the safeword ends
// all of it, at any mood, and she goes straight to her aftercare.
//
// THREE VALUES, all state and none of them a coin flip:
//
//   - STERN (0..1). Up with every order you leave undone, and more for each
//     one in a row (`missRun`); held where it is for `holdFor` seconds after
//     the last, so while you keep defying her it only climbs. Down with every
//     order kept, and more for a run of them; after the hold it eases back
//     toward where she started on its own.
//   - WARM (0..1). Up as you please her, down when you do not. What shows is
//     warmth that sternness leaves room for (`warm * (1 - stern)`): praise,
//     her hand in your hair, the hug, the spoon, fewer and lighter spanks.
//   - EXCITEMENT (0..1). Begging lights it, not the order book: a reservoir
//     (`drive`) filled by each beg and spent by each wave. A wave RISES fast
//     (a second or so), RIDES for 7-14 s with a wobble on it, EBBS over a few
//     seconds, and after a lull of 6-16 s, if there is drive left, it SURGES
//     again on its own, a little lower each time. Beg again and the reservoir
//     fills and the next wave comes at once. It reaches everything that reads
//     her heat (`rev.dom.heat` is her base heat plus a share of it), so the
//     moves that come with heat (the hair, the hip tease, the toys, more
//     slaps a round) ride the waves too.
//
// WHAT READS THEM: her picks (`rmoodWeight`, a multiplier per candidate),
// how many slaps a round and how hard (`rmoodSpanks`, `rmoodForce`), how long
// she gives you for an order (`rmoodWaitK`), how soon she decides again
// (`rmoodGapK`), the collar's tugs and the hair as discipline, and every line
// she says (`rmoodLine`: a flavour of the beat by her tone, never one of the
// last dozen she said). Her voice on the service is told the mood too
// (`rev_mood`, `rev_stern`, `rev_warm`, `rev_excite`, `rev_beg` in the scene).
// -----------------------------------------------------------------------------

const RMOOD = {
  stern0: 0.22, warm0: 0.35,
  missUp: 0.16, missStep: 0.05,     // stern per order left undone, and per one in a row before it
  keepDown: 0.10, keepStreak: 0.03, // stern off per order kept, and per one in a run
  warmUp: 0.10, warmMiss: 0.22,
  holdFor: 25,                      // s after the last miss before she eases off on her own
  relaxTau: 70, warmTau: 150,
  exHeat: 0.55,                     // her heat is her base heat plus this much of her excitement
  ex: { beg: 0.55, again: 0.35, harder: 0.25, max: 2.4, riseTau: 0.55, ride: [7, 14], ebbTau: 4.5,
    lull: [6, 16], spend: 0.6, last: 0.22 },
  begFor: 30,                       // s a beg she has not got to yet stays wanted
  recent: 14,                       // lines remembered so as not to say them again
};

/**
 * Her lines by tone. A beat's own table (`REV_SAY[kind]`, and the files after
 * this one add theirs) is the neutral pool; a tone's pool here is picked from
 * three times in four while she is in that tone. New beats: `beg` (by what
 * you begged for), `surge`, `sterner`, `soften`, `harder`.
 */
const RMOOD_SAY = {
  good: {
    stern: ['Finally.', 'Better. Keep it that way.', 'Mm. That took you long enough.', 'Okay. That I can work with.',
      "See? Not so hard.", 'Good. Now stay like that.', 'Hm. Acceptable.', "That's more like it."],
    warm: ["Aww, look at you. Perfect.", "You're doing so good, babe.", "That's my good girl.", 'Mmm. Gorgeous. Just like that.',
      "I'm so proud of you right now.", 'Perfect. You make this so easy.', 'Good girl. C\'mere, you.', "Ugh, you're adorable when you listen."],
    excited: ['Yes! Oh, that\'s it!', 'Hehe, yes! Good girl!', "Ooh, you're really into this.", 'Yes yes yes. Perfect.',
      "God, you're fun.", 'Ha! Good girl. Again later.'],
    neutral: ['Good.', 'Mm-hm. Nice.', 'Like that. Good.', "Okay, you're learning.", 'Nice. Stay there.', 'Thank you, babe.'],
  },
  slow: {
    stern: ['Again? Seriously?', "Okay, now I'm annoyed.", "That's twice. You're getting it harder.", 'No. Not good enough.',
      "Oh, you think I'm kidding?", 'Wrong answer, babe.', "You're testing me. Bad idea.", "Mm-mm. We're doing this the hard way."],
    warm: ['Hey. Did you forget about me?', "Aw, babe. Hm? I'm waiting.", "Too slow... but I'll let you make it up.",
      'Mm. Little tap for that, okay?'],
    excited: ["Ooh, you're being naughty on purpose.", 'Ha! You want it, don\'t you?', "Mm, disobeying? Fun.",
      "Oh, that's a spanking. Hehe. Yay."],
    neutral: ['Hm? Did you not hear me?', 'Too slow, babe.', "Mm-mm. That's a spanking.", 'Nope. Missed it.',
      "That wasn't a suggestion.", "Oh, so we're ignoring me now?"],
  },
  spank: {
    stern: ['Count.', "Don't you move.", 'That one was for not listening.', 'Still with me?', 'Again.', 'Hold still.',
      'Every one of these, you earned.', 'Mm. Harder next time if I have to.', 'Feel that? Good.', 'Stay. Down.'],
    warm: ['Just a little one.', 'There. Gentle.', 'Mm, pink and pretty.', 'One for luck.', "Easy. I've got you.", 'Soft one.'],
    excited: ['Ooh, listen to that!', 'Hehe. Again!', 'God, I love this.', "You're so pink. Yes.", 'Another! Hehe.',
      'Ha! Did you feel that one?', 'Mm, more? More.', "Okay, I'm having way too much fun."],
    neutral: ['You earned that one.', 'Count.', 'One more.', "Hehe. You're already pink.", 'Mm-hm.', 'Stay put.',
      'Breathe.', 'And another.'],
  },
  lash: {
    stern: ['Count them.', "We're not done.", 'Stay down.', 'You wanted to test me.', 'Again.'],
    excited: ['Ooh, that sound!', 'Hehe. My belt likes you.', 'Again? Again.', 'Yes. Yes.'],
    warm: ['Last couple. Breathe.', 'Easy, babe.'],
  },
  prowl: {
    stern: ['I see you.', "I'm deciding what you get.", 'Every little thing, babe. I see it.', "Don't get comfy."],
    warm: ['Take your time. I like looking at you.', "Mm. You're so pretty like this.", "Shh. You're doing fine."],
    excited: ["Okay, okay, what next... hehe.", "Ugh, I can't decide. Everything.", 'Mm. You look so spankable.'],
    neutral: ["Take your time. I'm enjoying the view.", 'Hm. What should I do with you...', 'Look at you.'],
  },
  on: {
    neutral: ["Okay. I'm in charge now... and you're all mine.", "You're mine now, babe. Listen up.",
      "Hehe. My turn. Let's see how good you are.", 'Okay, babe. My rules now.', "Rule one: you do what I say. Rule two... we'll see."],
  },
  buzz: {
    excited: ["Ooh, let's turn you on!", 'Hehe. Bzzz.', 'Let me play with this.'],
    stern: ['Let\'s see if this keeps you still.'],
    warm: ['Just a little buzz for you.'],
  },
  remote: {
    excited: ["Ooh. Phone out. Hehe.", "Let's play!"], stern: ["Hold still. I'm watching what this does."],
    warm: ['Little treat for being good.'],
  },
  remup: { excited: ['More! Hehe.', "Higher? Higher."], stern: ['Stronger. Take it.'] },
  hold: { stern: ['Down. Stay down.', "Don't even try it.", "You're not going anywhere."], excited: ['Mm, gotcha!', "Hehe. Can't move?"] },
  grip: { stern: ['Mine. Remember that.', 'Eyes where I put them.'], warm: ["Mm. You're mine.", 'Right here, babe.'], excited: ['Mine! Hehe.'] },
  stroke: { warm: ["You're so good for me.", "Shh. That's it.", 'Good girl. Breathe.', 'Mm. Soft hair.', "I've got you, babe."] },
  wait: { stern: ['I. Am. Waiting.', "I'm counting, babe.", 'Tick tock.'], warm: ['Whenever you\'re ready... like, now.'] },
  hair_pulled: {
    stern: ['Head up. Now.', 'Look at me when I talk to you.', 'Who do you belong to?', 'Mm. Listening now?'],
    excited: ['Oh, that gasp! Again!', 'Hehe. Gotcha.', 'Arch for me! Yes!'],
    warm: ['Easy... I\'ve got you.', 'Gentle. Just holding.'],
  },
  tug: { stern: ['Move.', 'When I pull, you come.', 'Now.'], excited: ['Come here, you!', 'Hehe. Up!'] },
  lead: { stern: ['Keep up.', 'Heel, babe.'], warm: ["Good girl. Slowly.", "That's it. With me."], excited: ['Walkies! Hehe.'] },
  circle: { stern: ["I'm deciding.", "Don't turn around."], warm: ['Mm. Gorgeous from every side.'], excited: ['Ooh, where first?'] },
  // NEW BEATS.
  // Begged for something: she is thrilled, and yes, and more than you asked.
  beg: {
    spank: ["Oh, you want it? Okay. Hehe.", 'Say please again... okay, okay!', "Mm, begging. I love that.",
      "You asked for it, babe. Literally.", "Oh, you're gonna get so many.", "Aww, needy. Okay. Bottom up.",
      "A spanking? You don't have to ask twice.", 'Ha! Yes. Come here.'],
    harder: ['Harder? Oh, you asked for it.', "Ooh. Okay, no more gentle.", "Harder? Hehe. Yes ma'am. I mean... yes.",
      'Brave. I like brave.', "Okay, you're gonna feel this one."],
    whip: ['My belt? Oh, you naughty thing.', 'You want the belt? Hehe. Okay.', "Oh, it's coming off. Right now.",
      "Mm, the belt. Good choice, babe."],
    discipline: ['Oh, you need discipline? I can do that.', "Punish you? Mm, gladly.", "Okay. You asked. Over you go.",
      "You've been bad? Tell me all about it... later."],
    hair: ['Your hair? Mm, come here.', 'Oh, you like that? Okay.', 'Hehe. Grab-able.'],
    collar: ['Mm, someone wants to be led.', 'You want the leash? Hehe. Come.', "Pull? Oh, I'll pull."],
  },
  // A wave of excitement coming back on its own.
  surge: ["Okay, I'm not done with you.", 'Mm... you know what? More.', "Ugh, you're so fun. Again.",
    "Hehe. I'm all worked up again.", 'Wait, wait... I want more.', "Round two? Round two.", 'Oh, I have ideas.'],
  // Crossing up into stern.
  sterner: ["Okay. Now I'm serious.", "I'm done asking nicely.", "Fine. We'll do it my way.", 'You keep testing me, babe.',
    "Oh, you're gonna learn today.", 'No more giggles. Listen.'],
  // Cooling off after stern.
  soften: ["Mm. That's better. See?", "Okay... I'm not mad anymore.", 'Good. You can relax a little.',
    "There's my good girl. Come back to me.", "See how nice I am when you listen?", 'Okay. Softer now. You earned it.'],
};
/** An order said in a mood: the order's own words, and a word in front or after. */
const RMOOD_ORDER = {
  stern: { pre: ['', '', 'Now. ', 'I said... ', 'Listen. '], post: ['', ' Now.', ' Right now.', " Don't make me ask twice.", ' Go.'] },
  warm: { pre: ['', '', 'Babe? ', 'Mm. '], post: ['', ' For me?', ' Good girl.', ' Slowly.'] },
  excited: { pre: ['', 'Ooh. ', 'Okay okay. ', 'Hehe. '], post: ['', ' Quick!', ' Hehe.'] },
};

const rmood = {
  stern: RMOOD.stern0, warm: RMOOD.warm0, missRun: 0, lastMiss: -1e9, lastKeep: -1e9,
  ex: { v: 0, drive: 0, ph: 'calm', t: 0, peak: 0, ride: 0, lull: 0, waves: 0, begs: 0 },
  tone: 'neutral', sternWas: RMOOD.stern0, wasStern: false,
  beg: null,          // a beg she has yet to give you: { what, n, hard, until, t }
  begLast: null,      // the last thing you begged for and when: for her voice
  hardNext: 0,        // extra force on the begged round
  recent: [], queue: [], hist: [], histAt: 0, log: [], bot: null, botT: 0, botKey: null, picks: [],
  heatBase: null,
};

function rmoodTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rmoodNote(s) { rmood.log.push([+rev.clock.toFixed(1), s]); if (rmood.log.length > 80) rmood.log.shift(); }
const _rmc = (x) => Math.max(0, Math.min(1, x));

// ── her heat is her base heat plus her excitement ────────────────────────────
//
// Everything that reads `rev.dom.heat` (the moves, the hair, the toys, the
// spank force, the belt's charge) now sees her excitement's waves. A write is
// a CHANGE to the base: `heat = min(1, heat + 0.03)` at the cap leaves the
// base alone rather than dragging it down by her excitement.
(function rmoodHeat() {
  if (typeof rev === 'undefined' || !rev.dom) return;
  let base = rev.dom.heat;
  const get = () => Math.min(1, base + RMOOD.exHeat * rmood.ex.v);
  Object.defineProperty(rev.dom, 'heat', {
    get, enumerable: true, configurable: true,
    set(x) { base = _rmc(base + (+x - get())); },
  });
  rmood.heatBase = () => base;
})();

/** Back to how she starts, at the swap. */
function rmoodReset() {
  Object.assign(rmood, { stern: RMOOD.stern0, warm: RMOOD.warm0, missRun: 0, lastMiss: -1e9, lastKeep: -1e9,
    tone: 'neutral', sternWas: RMOOD.stern0, wasStern: false, sternSaid: -1e9, beg: null, begLast: null, hardNext: 0, queue: [], hist: [], histAt: 0 });
  Object.assign(rmood.ex, { v: 0, drive: 0, ph: 'calm', t: 0, peak: 0, ride: 0, lull: 0, waves: 0, begs: 0 });
}

/** The safeword: no mood is left in her but care. */
function rmoodSafe() {
  rmood.beg = null; rmood.hardNext = 0; rmood.queue = [];
  Object.assign(rmood.ex, { v: 0, drive: 0, ph: 'calm', t: 0 });
  rmood.stern = 0; rmood.warm = 1; rmood.missRun = 0;
  rmood.tone = 'care';
  rmoodTrace({ pick: 'mood:safe', why: 'everything off' });
}

/** Her warmth as it shows: what her sternness leaves room for. */
function rmoodGentle() { return rmood.warm * (1 - rmood.stern); }

/** Her tone: 'stern' | 'warm' | 'excited' | 'neutral' (and 'care' after the safeword). */
function rmoodToneNow() {
  if (rev.care) return 'care';
  const e = rmood.ex.v, s = rmood.stern, g = rmoodGentle();
  if (e >= 0.42 && e >= s - 0.1) return 'excited';
  if (s >= 0.55) return 'stern';
  if (g >= 0.42 && s < 0.4) return 'warm';
  return 'neutral';
}

// ── kept, missed ─────────────────────────────────────────────────────────────

function rmoodKept(id, streak) {
  rmood.missRun = 0;
  rmood.lastKeep = rev.clock;
  rmood.stern = _rmc(rmood.stern - RMOOD.keepDown - RMOOD.keepStreak * Math.min(4, streak || 0));
  rmood.warm = _rmc(rmood.warm + (RMOOD.warmUp + 0.04 * Math.min(3, streak || 0)) * (1 - 0.5 * rmood.stern));
  // Pleasing her a little stirs her too, a ripple, not a beg.
  rmood.ex.drive = Math.min(RMOOD.ex.max, rmood.ex.drive + 0.04);
  rmoodNote('kept ' + id + ' stern ' + rmood.stern.toFixed(2) + ' warm ' + rmood.warm.toFixed(2));
}
function rmoodMissed(id) {
  rmood.missRun++;
  rmood.lastMiss = rev.clock;
  rmood.stern = _rmc(rmood.stern + RMOOD.missUp + RMOOD.missStep * Math.min(4, rmood.missRun - 1));
  rmood.warm = _rmc(rmood.warm - RMOOD.warmMiss);
  rmoodNote('missed ' + id + ' run ' + rmood.missRun + ' stern ' + rmood.stern.toFixed(2));
}

// ── begging ──────────────────────────────────────────────────────────────────

/** Excitement from a beg: the reservoir fills, and a wave starts now. */
function rmoodExcite(amount, why) {
  const X = rmood.ex;
  X.drive = Math.min(RMOOD.ex.max, X.drive + amount);
  if (X.ph === 'calm' || X.ph === 'ebb' || X.ph === 'lull') {
    X.ph = 'rise'; X.t = 0; X.waves++;
    X.peak = Math.min(1, 0.45 + 0.3 * X.drive);
  } else {
    // Mid-wave: higher, and longer.
    X.peak = Math.min(1, Math.max(X.peak, 0.45 + 0.3 * X.drive));
    if (X.ph === 'ride') X.ride += 4;
  }
  rmoodTrace({ pick: 'mood:excite', why, drive: +X.drive.toFixed(2), peak: +X.peak.toFixed(2) });
}

/**
 * You begged: 'spank' | 'harder' | 'whip' | 'discipline' | 'hair' | 'collar'.
 * She gets excited, says yes, and does it — more than you asked. Answers
 * { ok, label } for the ears' panel.
 */
function rmoodBeg(what) {
  if (!rev.on) return { ok: false, label: 'roles are not reversed' };
  // After the safeword nothing is asked of her but to look after you.
  if (rev.care) return { ok: false, label: 'Chloe: aftercare first — the safeword stopped all of it' };
  // ── 1.587.0 (src/49-revbind.js): what you said of it rides on the name
  // ('bind.cot.belt.blind'); and while you are tied, nothing that would move
  // you out of the tie (her pin, the drag, the collar, your hair).
  const opt = String(what).split('.');
  what = opt.shift();
  if (typeof rvbHolds === 'function' && rvbHolds() && /^(pin|drag|collar|hair)$/.test(what)) {
    return { ok: false, label: 'Chloe: you are tied up — not that, not now' };
  }
  // ── end 1.587.0
  const X = rmood.ex, D = rev.dom;
  const again = rmood.begLast && rev.clock - rmood.begLast.t < 12;
  X.begs++;
  rmoodExcite(RMOOD.ex.beg + (again ? RMOOD.ex.again : 0) + (what === 'harder' ? RMOOD.ex.harder : 0), 'begged: ' + what);
  rmood.begLast = { what, t: rev.clock };
  // ── 1.587.0: tie me up, blindfold me, untie me (src/49-revbind.js).
  if (/^(bind|blind|untie)$/.test(what) && typeof rvbAsk === 'function') {
    if (what !== 'untie') revSay('beg', true, rmoodBegLine(what), { still: revStill.dom });
    if (D.order) D.order = null;
    const r = rvbAsk(what, opt);
    return { ok: r.ok, label: 'Chloe, excited: ' + String(r.label).replace(/^chloe: /i, '') };
  }
  // ── end 1.587.0
  revSay('beg', true, rmoodBegLine(what), { still: revStill.dom });
  // Whatever order she had out, she lets it go: you asked for something better.
  if (D.order) {
    rmoodTrace({ pick: 'let go:' + D.order.id, why: 'you begged' });
    D.order = null;
  }
  // Her excitement as this wave will have it (it has not risen yet, this frame).
  const e = Math.max(X.v, X.peak);
  if (what === 'hair') {
    const r = typeof rvhAsk === 'function' ? rvhAsk('pull') : { ok: false, label: 'no hair' };
    return { ok: r.ok, label: 'Chloe, excited: ' + String(r.label).replace(/^chloe: /i, '') };
  }
  // Hauled by another hold — ear, arm, ankle, chin, neck, or 'haul' for the
  // one that fits (1.587.0, src/49-revhold.js).
  if (/^(ear|arm|ankle|chin|neck|haul)$/.test(what)) {
    const r = typeof rvoAsk === 'function' ? rvoAsk(what) : { ok: false, label: 'no hold' };
    return { ok: r.ok, label: 'Chloe, excited: ' + String(r.label).replace(/^chloe: /i, '') };
  }
  // Pinned on the cot (1.586.0, src/49-revpin.js).
  if (what === 'pin') {
    const r = typeof rvpAsk === 'function' ? rvpAsk() : { ok: false, label: 'no pin' };
    return { ok: r.ok, label: 'Chloe, excited: ' + String(r.label).replace(/^chloe: /i, '') };
  }
  // Walked round the room by it (1.584.0, src/49-revwalk.js).
  if (what === 'drag') {
    const r = typeof rvdAsk === 'function' ? rvdAsk() : { ok: false, label: 'no drag' };
    return { ok: r.ok, label: 'Chloe, excited: ' + String(r.label).replace(/^chloe: /i, '') };
  }
  if (what === 'collar' && typeof rvkCollarOn === 'function') {
    if (rvkCollarOn()) {
      const v = revView();
      const pose = v && v.leash ? v.leash.pose : null;
      const r = typeof rvkTug === 'function' ? rvkTug(pose === 'stand' ? 'down' : pose ? 'up' : null, 0.95, 'begged') : 'none';
      // And again, a moment later: more than you asked.
      rmood.queue.push({ act: 'tug', at: rev.clock + 3.5, gest: pose === 'stand' ? 'down' : pose ? 'up' : null });
      return { ok: r === true, label: 'Chloe pulls your collar' + (r === true ? '' : ' — ' + r) };
    }
    // Her belt in that hand: back on her first, then the collar (`rvkDecide`
    // takes an ask once she is free). MEASURED: refused 'the belt is in that
    // hand' the first time round.
    if (typeof rvkBeltOut === 'function' && rvkBeltOut() && typeof rvk !== 'undefined') {
      rvkAsk('beltback');
      rvk.col.ask = true;
      return { ok: true, label: 'Chloe, excited: her belt back on, then the collar' };
    }
    const r = typeof rvkAsk === 'function' ? rvkAsk('collar') : { ok: false, label: 'no collar' };
    return { ok: r.ok, label: 'Chloe, excited: ' + String(r.label).replace(/^chloe: /i, '') };
  }
  // A spanking, harder, the belt or discipline: more than you asked for.
  const n = Math.min(8, 3 + Math.floor(Math.random() * 2) + Math.floor(e * 2.5)
    + (what === 'discipline' ? 1 : 0) + Math.floor(rmood.stern * 2));
  rmood.beg = { what, n, hard: what === 'harder' || what === 'discipline', until: rev.clock + RMOOD.begFor, t: rev.clock };
  if (what === 'harder') rmood.hardNext = 4;
  else if (what === 'discipline') rmood.hardNext = 2;
  // The belt, asked for: off her jeans first if it is not in her hand.
  if (what === 'whip' && typeof rvkAsk === 'function' && !(typeof rvkBeltInHand === 'function' && rvkBeltInHand())) {
    const r = rvkAsk('belt');
    if (!r.ok) rmood.beg.what = 'spank';
  }
  // As soon as she can: now, if she is free.
  D.next = Math.min(D.next, rev.clock + 0.4);
  rmoodTrace({ pick: 'beg:' + what, why: 'n ' + n + ', excite ' + e.toFixed(2) });
  return { ok: true, label: 'Chloe, excited: ' + (what === 'whip' ? 'her belt' : what === 'harder' ? 'harder' : 'a spanking') + ', ' + n };
}

/**
 * Her decision while a beg is owed (from `revDecide`, before anything else):
 * the round you asked for, wherever she can give it — or the order that puts
 * you where she can. Answers what she did, or null.
 */
function rmoodBegDecide(v) {
  const B = rmood.beg, D = rev.dom;
  if (!B) return null;
  if (rev.clock > B.until) { rmoodTrace({ pick: 'beg:lapsed', why: B.what }); rmood.beg = null; rmood.hardNext = 0; return null; }
  if (typeof rvkBusy === 'function' && rvkBusy()) return null;
  const ctx = v ? v.ctx : null;
  if (!ctx) { D.next = rev.clock + 0.8; return 'beg:wait'; }
  // The leash in her hand: off, to have the hand for it.
  if (typeof rvkCollarOn === 'function' && rvkCollarOn()) {
    if (typeof rvkCollarEnd === 'function') rvkCollarEnd('begged');
    D.next = rev.clock + 1.5;
    rmoodTrace({ pick: 'beg:uncollar', why: 'her hand for it' });
    return 'beg:uncollar';
  }
  const belt = typeof rvkBeltInHand === 'function' && rvkBeltInHand();
  if (belt) {
    if (ctx === 'front' && typeof rvkBeltRoundStart === 'function') {
      const r = rvkBeltRoundStart(Math.min(6, B.n), 'begged: ' + B.what);
      if (r === true) { rmood.beg = null; D.next = rev.clock + 3; return 'beg:belt'; }
    }
    if (ctx !== 'front' && !D.order) { revOrder(ctx === 'stand' || ctx === 'kneel' || ctx === 'fours' ? 'cot' : 'front', 'begged: belt'); return 'beg:order'; }
    return null;
  }
  const canSpank = ctx === 'front' || ctx === 'stand' || ctx === 'kneel' || ctx === 'fours';
  if (canSpank) {
    const r = revSpankRound(B.n, 'begged: ' + B.what);
    if (r === true) {
      rmood.beg = null;
      D.punish = 0;
      D.next = rev.clock + 4 + B.n * 1.1;
      return 'beg:spank';
    }
    D.next = rev.clock + 1;
    return null;
  }
  // On your back, your side, sitting: on your tummy for it.
  if (!D.order) {
    revSay('beg', false, rmoodPick(['Then roll over. Quick!', 'Tummy. Now. Hehe.', "Turn over, I can't reach.", 'Roll over for it, babe.']));
    revOrder('front', 'begged: ' + B.what);
    return 'beg:order';
  }
  return null;
}

// ── the frame ────────────────────────────────────────────────────────────────

function rmoodTick(dt) {
  if (!rev.on) return;
  const X = rmood.ex, E = RMOOD.ex;
  if (rev.care) {
    X.v += (0 - X.v) * (1 - Math.exp(-dt / 0.4));
    rmood.tone = 'care';
    rmoodSample();
    return;
  }
  // ── her excitement's waves ──
  X.t += dt;
  if (X.ph === 'rise') {
    X.v += (X.peak - X.v) * (1 - Math.exp(-dt / E.riseTau));
    if (X.v > X.peak - 0.03 || X.t > 3) {
      X.ph = 'ride'; X.t = 0;
      X.ride = E.ride[0] + Math.random() * (E.ride[1] - E.ride[0]);
    }
  } else if (X.ph === 'ride') {
    // Riding it: a wobble on the top, two or three swells a ride.
    const w = 0.08 * Math.sin(X.t * 1.7) + 0.05 * Math.sin(X.t * 4.3 + 1);
    X.v += (_rmc(X.peak * (0.9 + w)) - X.v) * (1 - Math.exp(-dt / 0.5));
    if (X.t > X.ride) {
      X.ph = 'ebb'; X.t = 0;
      X.drive *= E.spend;
    }
  } else if (X.ph === 'ebb' || X.ph === 'lull') {
    X.v += (0.04 * X.drive - X.v) * (1 - Math.exp(-dt / E.ebbTau));
    if (X.ph === 'ebb' && X.v < 0.15 + 0.04 * X.drive) {
      X.ph = X.drive > E.last ? 'lull' : 'calm'; X.t = 0;
      X.lull = E.lull[0] + Math.random() * (E.lull[1] - E.lull[0]);
    } else if (X.ph === 'lull' && X.t > X.lull) {
      // ...and it comes back on its own, a little lower.
      X.ph = 'rise'; X.t = 0; X.waves++;
      X.peak = Math.min(1, 0.35 + 0.32 * X.drive);
      rmoodTrace({ pick: 'mood:surge', why: 'wave ' + X.waves, drive: +X.drive.toFixed(2), peak: +X.peak.toFixed(2) });
      rmood.queue.push({ say: 'surge', at: rev.clock + 0.6, until: rev.clock + 6 });
      // And she wants to do something about it, soon.
      rev.dom.next = Math.min(rev.dom.next, rev.clock + 1.2);
    }
  } else {
    X.v += (0 - X.v) * (1 - Math.exp(-dt / 3));
    X.drive = Math.max(0, X.drive - dt * 0.004);
  }
  // ── her sternness and warmth, easing on their own ──
  if (rev.clock - rmood.lastMiss > RMOOD.holdFor && rmood.stern > RMOOD.stern0) {
    rmood.stern += (RMOOD.stern0 - rmood.stern) * (1 - Math.exp(-dt / RMOOD.relaxTau));
  }
  rmood.warm += (RMOOD.warm0 - rmood.warm) * (1 - Math.exp(-dt / RMOOD.warmTau));
  // ── the turns of her mood, said ──
  const s = rmood.stern;
  // Getting sterner, said — once a minute at most: between two misses she
  // eases off a little and crosses the line again, and four "I'm serious"
  // in four minutes was one too many of them (MEASURED, first run).
  const upNow = (s >= 0.55 && rmood.sternWas < 0.55) || (s >= 0.8 && rmood.sternWas < 0.8);
  if (s >= 0.55) rmood.wasStern = true;
  if (upNow && rev.clock - (rmood.sternSaid || -1e9) > 60) {
    rmood.sternSaid = rev.clock;
    rmood.queue.push({ say: 'sterner', at: rev.clock + 2.6, until: rev.clock + 8 });
  }
  if (s < 0.35 && rmood.sternWas >= 0.35 && rmood.wasStern) { rmood.wasStern = false; rmood.queue.push({ say: 'soften', at: rev.clock + 2.6, until: rev.clock + 9 }); }
  rmood.sternWas = s;
  const tone = rmoodToneNow();
  if (tone !== rmood.tone) { rmoodTrace({ pick: 'mood:' + tone, why: 'stern ' + s.toFixed(2) + ' warm ' + rmood.warm.toFixed(2) + ' ex ' + X.v.toFixed(2) }); rmood.tone = tone; }
  // ── what she queued: a line when there is room for it, a second tug ──
  for (let i = rmood.queue.length - 1; i >= 0; i--) {
    const Q = rmood.queue[i];
    if (rev.clock < Q.at) continue;
    if (Q.act === 'tug') {
      if (typeof rvkTug === 'function') rvkTug(Q.gest, 0.9, 'begged, again');
      rmood.queue.splice(i, 1);
      continue;
    }
    if (rev.clock > Q.until) { rmood.queue.splice(i, 1); continue; }
    if (revSay(Q.say, false, null, { still: revStill.dom })) rmood.queue.splice(i, 1);
  }
  rmoodBotTick(dt);
  rmoodSample();
}

/** A sample a second of rev.clock, for the probe's timeline. */
function rmoodSample() {
  if (rev.clock - rmood.histAt < 1) return;
  rmood.histAt = rev.clock;
  rmood.hist.push([+rev.clock.toFixed(0), +rmood.stern.toFixed(2), +rmood.warm.toFixed(2), +rmood.ex.v.toFixed(2),
    +rmood.ex.drive.toFixed(2), rmood.ex.ph, rmood.tone, +rev.dom.heat.toFixed(2)]);
  if (rmood.hist.length > 900) rmood.hist.shift();
}

// ── what reads her mood ──────────────────────────────────────────────────────

/** A multiplier on one of her candidates (`revDecide`'s ids). */
function rmoodWeight(id) {
  const s = rmood.stern, g = rmoodGentle(), e = rmood.ex.v;
  const m = id.replace(/^(move|hair):/, '');
  let k = 1;
  if (id === 'spank') k = (1 + 1.3 * s) * (1 - 0.55 * g) * (1 + 1.6 * e);
  else if (id.startsWith('order:')) k = (1 + 0.6 * s) * (1 - 0.35 * g) * (1 - 0.45 * e);
  else if (id === 'hair:pull' || id === 'hair:upcot') k = (1 + 1.2 * s) * (1 - 0.5 * g) * (1 + 1.4 * e);
  else if (id === 'hair:draw' || id === 'hair:kneel') k = (1 + g) * (1 + 0.6 * e);
  // Walking you by your hair (1.584.0): discipline, and a game when she is wound up.
  else if (/^drag/.test(id)) k = (1 + 1.4 * s) * (1 - 0.6 * g) * (1 + 1.4 * e);
  // Her other holds (1.587.0): discipline, and a game when she is wound up.
  else if (/^haul/.test(id)) k = (1 + 1.4 * s) * (1 - 0.6 * g) * (1 + 1.2 * e);
  // Holding you down on the cot (1.586.0): discipline above all.
  else if (/^pin/.test(id)) k = (1 + 1.6 * s) * (1 - 0.5 * g) * (1 + 0.4 * e);
  // Tying you up (1.587.0): discipline, and a game when she is wound up.
  else if (/^bind/.test(id)) k = (1 + 1.3 * s) * (1 - 0.5 * g) * (1 + 1.1 * e);
  else if (m === 'hold') k = (1 + s) * (1 + 0.5 * e);
  else if (m === 'grip') k = (1 + 0.8 * s) * (1 + 0.4 * e);
  else if (m === 'stroke' || m === 'hug' || m === 'spoon' || m === 'sitby' || m === 'chin') k = (1 - 0.8 * s) * (1 + 2 * g) * (1 - 0.4 * e);
  else if (m === 'thrust') k = (1 - 0.7 * s) * (1 + 1.3 * e);
  else if (m === 'toy' || m === 'remote' || m === 'swap') k = (1 + 1.1 * e) * (1 + 0.3 * g);
  else if (id === 'prowl') k = (1 - 0.5 * s) * (1 - 0.6 * e);
  return Math.max(0.05, k);
}

/** Slaps in a round of hers: `n` as her heat chose it, and her mood on top. */
function rmoodSpanks(n, punish) {
  const s = rmood.stern, g = rmoodGentle(), e = rmood.ex.v;
  let m = n + Math.floor(s * (punish ? 4 : 2.5)) + Math.floor(e * 2.5);
  if (g > 0.5 && !punish) m -= 1 + (g > 0.75 ? 1 : 0);
  return Math.max(1, Math.min(8, m));
}
/** How hard: her heat's force, firmer stern, lighter warm, harder when you asked. */
function rmoodForce(k) {
  const s = rmood.stern, g = rmoodGentle();
  return Math.max(6, Math.min(20, k + 4 * s - 4 * g + rmood.hardNext));
}
/** How long she waits for an order to be kept: shorter the sterner she is. */
function rmoodWaitK() { return 1.25 - 0.5 * rmood.stern; }
/** How soon she decides again: sooner stern or excited, later warm. */
function rmoodGapK() { return Math.max(0.45, (1 - 0.25 * rmood.stern) * (1 - 0.4 * rmood.ex.v) * (1 + 0.3 * rmoodGentle())); }
/** Her hair pull as discipline: what sternness adds to her wanting it. */
function rmoodHairEx() { return 0.7 * Math.max(0, rmood.stern - 0.4) + 0.4 * rmood.ex.v; }
/** The collar: her chance of putting it on, of a tug, how firm. */
function rmoodCollarP() { return 0.4 * Math.max(0, rmood.stern - 0.3) + 0.15 * rmood.ex.v; }
function rmoodTugK() { return 1 + 1.6 * rmood.stern + 0.8 * rmood.ex.v; }

// ── her lines ────────────────────────────────────────────────────────────────

/** One of `L`, not among the last ones she said (the least recent if all were). */
function rmoodPick(L) {
  if (!L || !L.length) return null;
  const fresh = L.filter((x) => rmood.recent.indexOf(x) < 0);
  let l;
  if (fresh.length) l = fresh[Math.floor(Math.random() * fresh.length)];
  else l = L.slice().sort((a, b) => rmood.recent.indexOf(a) - rmood.recent.indexOf(b))[0];
  return l;
}
/** Remember a line as said. */
function rmoodSaid(l) {
  const i = rmood.recent.indexOf(l);
  if (i >= 0) rmood.recent.splice(i, 1);
  rmood.recent.push(l);
  if (rmood.recent.length > RMOOD.recent) rmood.recent.shift();
}
/** A begged-for line, by what. */
function rmoodBegLine(what) {
  const T = RMOOD_SAY.beg;
  return rmoodPick(T[what] || T.spank);
}

/**
 * The line for beat `kind` in her tone now: from the tone's pool three times
 * in four when there is one, else the beat's own table — never one of the
 * last dozen. Answers the line, or null to leave it to the caller.
 */
function rmoodLine(kind) {
  const tone = rmood.tone === 'care' ? 'neutral' : rmood.tone;
  const own = typeof REV_SAY !== 'undefined' ? REV_SAY[kind] : null;
  const T = RMOOD_SAY[kind];
  let pool = null;
  if (Array.isArray(T)) pool = T;
  else if (T) {
    const tp = T[tone];
    if (tp && tp.length && (tone !== 'neutral' || !own) && Math.random() < 0.75) pool = tp;
    else pool = (own || []).concat(T.neutral || []);
  }
  if (!pool || !pool.length) pool = own;
  if (!pool || !pool.length) return null;
  const L = pool.map((x) => (Array.isArray(x) ? (x[1] || x[0]) : x));
  return rmoodPick(L);
}

/** An order's words in her tone: the order itself always whole. */
function rmoodOrderLine(say) {
  const T = RMOOD_ORDER[rmood.tone];
  // A line that asks already ("curl up for me") is left as it is.
  if (!T || Math.random() < 0.35 || /for me|\?$/i.test(say)) return say;
  let pre = T.pre[Math.floor(Math.random() * T.pre.length)];
  if (/babe/i.test(say) && /babe/i.test(pre)) pre = '';
  const post = T.post[Math.floor(Math.random() * T.post.length)];
  // Lower case only after a lead-in that runs on into it ("I said... spread").
  const body = /\.\.\. $/.test(pre) && /^[A-Z]/.test(say) && !/^I\b/.test(say) ? say[0].toLowerCase() + say.slice(1) : say;
  return (pre + body + post).trim();
}

// ── her voice on the service ─────────────────────────────────────────────────

/** Her mood, for the scene block (`revScene`): keys and numbers only. */
function rmoodScene(o) {
  if (rev.care) return;
  o.rev_mood = rmood.tone === 'care' ? 'neutral' : rmood.tone;
  o.rev_stern = +rmood.stern.toFixed(2);
  o.rev_warm = +rmoodGentle().toFixed(2);
  o.rev_excite = +rmood.ex.v.toFixed(2);
  if (rmood.begLast && rev.clock - rmood.begLast.t < 20) o.rev_beg = rmood.begLast.what;
}

// ── the words ────────────────────────────────────────────────────────────────

/**
 * Begging, on the line `revWords` has normalised: 'rev.beg:<what>' or null.
 * In a sentence (twelve words at the most), not only the whole line, so
 * "please chloe spank me harder" is a beg; a question about it, or a "don't",
 * is not.
 */
function rmoodWords(t) {
  if (!t || t.split(' ').length > 12) return null;
  if (/^(did|why|how|when|have|has|were|was|are you|is|what|do you|does)\b/.test(t)) return null;
  if (/\b(don'?t|do not|no more|stop|never|nemoj|prestani|ne mojte|pas de|ne me)\b/.test(t)) return null;
  // Whole-line "more" and its kin: another round, harder. Not "jace" or
  // "plus fort" while she has a toy of yours buzzing: those are her remote's.
  const buzzing = typeof rvt !== 'undefined' && rvt.phoneOn;
  if (/^((please |oh )?(harder|do it harder|spank (me )?harder|again|do it again|more|one more|another( one)?|again please|more please|harder please|please more|please again|please harder))( chloe| mistress| babe)?( please)?$/.test(t)) return 'rev.beg:harder';
  if (!buzzing && /^(jace|jos( jednom| jednu| malo)?( molim( te)?)?|encore( une)?( fois)?|plus fort|encore plus fort)( s'?il te plait)?$/.test(t)) return 'rev.beg:harder';
  // ── 1.587.0 (src/49-revbind.js): tied up and blindfolded — "tie me up",
  // "tie my hands", "tie me to the bed", "blindfold me", "cover my eyes",
  // "untie me"; "zaveži me", "veži mi ruke", "poveži mi oči"; "attache-moi",
  // "bande-moi les yeux". What you said of it rides on the name: to the
  // cot, behind your back, to the hook, with her belt, a rope, and blind.
  {
    const bind = /\btie me( up| down)?\b|\btie (up )?(my|both my) (hands|wrists|arms)\b|\btie me to\b|\bbind me\b|\bbind (my|both my) (hands|wrists)\b|\btie (them|my wrists|my hands) (together|behind)\b|\b(za)?vezi me\b|\b(za)?vezi mi (ruke|zapesca)\b|\bsvezi me\b|\bpovezi me\b|\bpovezi mi ruke\b|\battache[- ]moi\b|\bligote[- ]moi\b/.test(t);
    const blind = /\bblindfold( me)?\b|\bcover (up )?my eyes\b|\bpovezi mi oci\b|\bzavezi mi oci\b|\bstavi mi povez\b|\bbande[- ]moi les yeux\b|\bbandeau\b|\bcache[- ]moi les yeux\b/.test(t);
    const untie = /\buntie (me|my (hands|wrists|arms))\b|^untie\b|\b(take|get) (the |this |my )?(blindfold|rope|ropes) off( me)?\b|\b(take|get) off (the |my )?(blindfold|rope)\b|\bodvezi me\b|\bodvezi mi (ruke|zapesca)\b|\b(skini|makni) mi (povez|uze)\b|\bdetache[- ]moi\b|\b(enleve|retire)[- ]moi (le |ce )?bandeau\b/.test(t);
    if (untie && typeof rvbHolds === 'function' && rvbHolds()) return 'rev.beg:untie';
    if (bind && !untie) {
      const o = [];
      if (/\b(bed|cot|krevet\w*|lit)\b/.test(t)) o.push('cot');
      else if (/\bbehind (my|your|the) back\b|\biza (ledja|leda)\b|\bdans le dos\b/.test(t)) o.push('back');
      else if (/\b(hook|wall|kuk\w*|vjesalic\w*|zid\w*|crochet|mur)\b|\barms up\b/.test(t)) o.push('hook');
      if (/\b(belt|remen\w*|ceinture)\b/.test(t)) o.push('belt');
      else if (/\b(rope|uze\w*|konop\w*|corde)\b/.test(t)) o.push('rope');
      if (blind) o.push('blind');
      return 'rev.beg:' + ['bind'].concat(o).join('.');
    }
    if (blind && !untie) return 'rev.beg:blind';
  }
  // ── end 1.587.0
  // Hauled by another hold (1.587.0, src/49-revhold.js): "pull my ear",
  // "twist my arm", "drag me by my ankle", "grab my chin", "push me down" —
  // before the pin's "hold me down" and the drag's "drag me".
  const hw = typeof rvoWords === 'function' ? rvoWords(t) : null;
  if (hw) return hw;
  // Pinned on the cot (1.586.0, src/49-revpin.js): "pin me down", "sit on
  // me", "hold me down", "hold my wrists", "pin my arms" — and in Croatian
  // and French. Not "hold me" alone: that is her hug, or the spoon.
  if (/\bpin me( down)?\b|\bpin (my|both my) (arms|wrists|hands)\b|\bsit on (me|my back|top of me)\b|\bhold me down\b|\bhold (my|both my) (wrists|arms|hands)( down)?\b|\b(get|climb) on top of me\b|\bprikovi me\b|\bsjedni na mene\b|\bdrzi me( dolje| prikovanu)?$|\bdrzi mi (ruke|zapesca)\b|\bimmobilise[- ]moi\b|\bassieds[- ]toi sur moi\b|\btiens[- ]moi( les poignets)?$|\btiens[- ]moi les poignets\b/.test(t)) return 'rev.beg:pin';
  // Walked round the room by your hair (1.584.0, src/49-revwalk.js): "drag
  // me", "pull me by the hair", "vuci me za kosu", "traîne-moi par les
  // cheveux" — before the plain pull, which "pull ... hair" also is. Not the
  // collar's: "drag me by my collar" is a tug on it.
  if (!/\b(collar|leash|ogrlic\w*|povod\w*|collier|laisse)\b/.test(t)
    && /\bdrag me\b|\b(pull|lead|walk|take|drag) me (a?round |about |round the room )?by (the|my|your) hair\b|\bvuci me\b|\bvodaj me za kosu\b|\bvodi me za kosu\b|\btraine[- ]moi\b|\b(tire|promene)[- ]moi par les cheveux\b/.test(t)) return 'rev.beg:drag';
  // Her fist in your hair, begged for.
  if (/\b(pull|grab|yank|take|tug)\b.*\bhair\b|\bhair pull\b|\b(za|mi) kosu\b|\bles cheveux\b/.test(t) && !/\b(draw|bring) me\b/.test(t)) return 'rev.beg:hair';
  // A pull on the collar or the leash (to put it on is `rev.collar`).
  if (/\b(pull|tug|yank|jerk|drag)\b.*\b(collar|leash)\b|\b(collar|leash) (pull|tug)\b|\b(povuci|cimni|trzni|vuci)\b.*\b(ogrlic|povod)\w*|\btire\b.*\b(collier|laisse)\b/.test(t)) return 'rev.beg:collar';
  // The belt, the whip.
  if (/\b(whip|flog|lash|strap|belt) me\b|\bwhip(ped|ping)?\b|\b(use|get|take off) (your |the )?belt on me\b|\b(isibaj|bicuj|izbicuj) me\b|\bremenom\b|\bfouette[- ]moi\b|\b(le )?fouet\b|\bavec (ta|la) ceinture\b/.test(t)) return 'rev.beg:whip';
  // Discipline, punishment.
  if (/\b(discipline|punish|correct) me\b|\bteach me a lesson\b|\b(i'?ve been|i was|i am|i'?m) (so )?(bad|naughty|disobedient)\b|\bi (need|want|deserve) (to be )?(discipline|disciplined|punished|punishment)\b|\bkazni me\b|\b(bila sam|ja sam) (zlocesta|neposlusna|nevaljala|losa)\b|\b(punis|corrige|discipline)[- ]moi\b|\bj'?ai ete (vilaine|mechante|desobeissante)\b/.test(t)) return 'rev.beg:discipline';
  // A spanking.
  const hard = /\b(harder|hard|jace|plus fort)\b/.test(t);
  if (/\b(spank|smack|slap|paddle|swat)\b.*\b(me|my|mine)\b|\b(spank|smack|slap)( it)?$|\bi (want|need|deserve|wanna)\b.*\b(spank|spanking|spanked|smack|slap)\w*\b|\b(give me|i'?ve earned|another) (a |some )?(spanking|smacks?|slaps?)\b|\b(spanking|spank me|spank)( please)?$|\b(udari|lupi|pljesni|isamaraj|islemaj|izlemaj|izudaraj|lupkaj|pljeskaj) me\b|\bdaj mi (po guzi|batine|packe|packu)\b|\bpo guzi\b|\b(fesse|tape|claque)[- ]moi\b|\b(une |la )?fessee\b/.test(t)) return hard ? 'rev.beg:harder' : 'rev.beg:spank';
  return null;
}

// ── the debug bot: a player who defies her, or obeys her ─────────────────────
//
// For the probe only (`__fr.reverse.mood.bot('defy' | 'obey' | null)`). 'defy'
// leaves every order undone; 'obey' keeps it a second and a half in, with the
// key the HUD shows (once; "wider" a press every 0.8 s), and "look at me" by
// turning to her face.
function rmoodBotTick(dt) {
  const B = rmood.bot;
  if (!B || B === 'defy') return;
  const O = rev.dom.order;
  if (!O) { rmood.botKey = null; return; }
  const age = rev.clock - O.t0;
  if (age < 1.5) return;
  const R = REV_ORDERS[O.id];
  if (!R) return;
  if (R.key === 'mouse') { if (typeof revApi !== 'undefined') revApi.lookAt(); return; }
  if (!R.key || R.key === 'WASD') return;
  const again = O.id === 'wider' || O.id === 'higher';
  if (rmood.botKey === O.t0 && !(again && rev.clock - rmood.botT > 0.8)) return;
  rmood.botKey = O.t0; rmood.botT = rev.clock;
  const m = /^(Shift\+)?(\d)$/.exec(R.key);
  if (m) revKey({ code: 'Digit' + m[2], shiftKey: !!m[1], preventDefault() {} });
}

// ── debug ────────────────────────────────────────────────────────────────────

const rmoodApi = {
  state: () => ({ tone: rmood.tone, stern: +rmood.stern.toFixed(3), warm: +rmood.warm.toFixed(3), gentle: +rmoodGentle().toFixed(3),
    missRun: rmood.missRun, ex: { v: +rmood.ex.v.toFixed(3), drive: +rmood.ex.drive.toFixed(3), ph: rmood.ex.ph,
      peak: +rmood.ex.peak.toFixed(2), waves: rmood.ex.waves, begs: rmood.ex.begs },
    beg: rmood.beg ? { what: rmood.beg.what, n: rmood.beg.n, left: +(rmood.beg.until - rev.clock).toFixed(1) } : null,
    heat: +rev.dom.heat.toFixed(3), heatBase: rmood.heatBase ? +rmood.heatBase().toFixed(3) : null,
    waitK: +rmoodWaitK().toFixed(2), gapK: +rmoodGapK().toFixed(2), recent: rmood.recent.slice(-6), queue: rmood.queue.length, bot: rmood.bot }),
  /** Set any of { stern, warm, excite, drive }; excite starts a wave at that peak. */
  set: (o = {}) => {
    if (o.stern != null) { rmood.stern = _rmc(+o.stern); rmood.sternWas = rmood.stern; }
    if (o.warm != null) rmood.warm = _rmc(+o.warm);
    if (o.drive != null) rmood.ex.drive = Math.max(0, Math.min(RMOOD.ex.max, +o.drive));
    if (o.excite != null) { rmood.ex.v = _rmc(+o.excite); rmood.ex.peak = rmood.ex.v; rmood.ex.ph = rmood.ex.v > 0 ? 'ride' : 'calm'; rmood.ex.t = 0; rmood.ex.ride = 10; }
    return rmoodApi.state();
  },
  beg: (what = 'spank') => rmoodBeg(what),
  words: (t) => rmoodWords(typeof _revNorm === 'function' ? _revNorm(t) : t),
  hist: (n = 900) => rmood.hist.slice(-n),
  log: () => rmood.log.slice(),
  bot: (m) => { if (m !== undefined) rmood.bot = m || null; return rmood.bot; },
  reset: () => { rmoodReset(); return rmoodApi.state(); },
  line: (kind) => rmoodLine(kind),
  /** The rounds she started, from the trace: [t, n, why]. */
  rounds: () => rev.trace.filter((e) => /^(spank|belt) x\d/.test(e.pick)).map((e) => [e.t, +e.pick.split('x')[1], e.why]),
};
if (typeof revApi !== 'undefined') revApi.mood = rmoodApi;

// The help sheet, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.revbeg': 'roles reversed: beg her, any time — "spank me", "harder", "please spank me", "whip me", "punish me", "discipline me", "pull my hair", "pull my collar". It excites her, in waves. Ignore her orders and she gets stricter (more spanks, harder, the collar, your hair); do as she says and she softens',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.revbeg': 'zamijenjene uloge: moli je, bilo kad — "udari me", "jače", "daj mi po guzi", "išibaj me", "kazni me", "povuci me za kosu", "povuci mi ogrlicu". To je uzbuđuje, u valovima. Ne slušaš li je, postaje stroža (više udaraca, jače, ogrlica, kosa); slušaš li, omekša',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.revbeg': 'rôles inversés : suppliez-la, quand vous voulez — « fesse-moi », « plus fort », « fouette-moi », « punis-moi », « tire-moi les cheveux », « tire sur mon collier ». Ça l’excite, par vagues. Désobéissez et elle devient plus sévère (plus de claques, plus fort, le collier, les cheveux) ; obéissez et elle s’adoucit',
  });
}
