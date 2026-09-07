// -----------------------------------------------------------------------------
// People talking to each other.
//
// Misha, of the beach: "there should be more small chat and like few-syllable
// interactions between the bathers themselves ya know? they should greet each
// other, put on airs of discussing local events".
//
// WHAT WAS ALREADY HERE, because the failure mode of this change was building a
// second one of it. 43-jadrija.js has had greetings since the crowd learned to
// see each other: `stepGreet` finds two people who are near each other and
// turned the right way, turns both heads, puts a hand up on whichever of them
// is more than 1.9 m off, and stops any walker involved for 3.4 s. Sixty of
// them logged over four hundred seconds at five stations. That is a *hello*,
// and it is finished.
//
// Two things it is not.
//
// It is SILENT. Two people wave at each other on a promenade in August and say
// nothing, which reads as a mime — and "few-syllable interactions" is the half
// of the request that has no code behind it at all.
//
// And it is OVER IN THREE SECONDS. `turn + hold + back` is 3.15 s and then the
// same person is barred for forty. Nobody on this beach has ever stood and
// talked to anybody. What "putting on airs of discussing local events" asks for
// is not a longer wave, it is a different event: two or three people angled at
// each other for half a minute, taking turns, with the head moving on whoever
// is speaking. That is a CONVERSATION and it is what this file is.
//
// ── the two halves ────────────────────────────────────────────────────────────
//
// `makeChatter` is the behaviour: who is standing with whom, who is talking at
// this instant, and where every one of their heads is pointed. It writes the
// same two fields the greeting writes — `fg.look` and `fg.lookY`, read by both
// crowd tiers in 42-crowd.js — plus one the greeting cannot: a real nod, which
// is the note over `NOD` below.
//
// `chatSay` is the noise, and it is synthesised here rather than recorded. The
// argument is in the note over `CHAT_LINES`; the short version is that thirty-
// two bark clips cost 298 KB for sixteen lines in two voices, and ambient
// crowd talk needs hundreds of utterances in eight voices that nobody is meant
// to be able to make out.
//
// ── which channel, decided rather than assumed ────────────────────────────────
//
// There are three ways to make a person on this beach make a noise and only one
// of them is right for this.
//
//   the voice service   49-voice.js and server/baye/baye.py, with a
//                       PERSONA_BATHER already written. It is a model call and
//                       a speech synthesis back to back — three to six seconds
//                       — it costs money per line, its own floor is 20 s per
//                       speaker, and it is built for ONE person near you saying
//                       a sentence about something that just happened. Ambient
//                       chatter is the opposite of every one of those: many
//                       speakers, constantly, saying nothing in particular. It
//                       would be the wrong shape at any price. NOT USED.
//
//   the bark clips      recorded, in `bark`. Sixteen lines, two voices, English
//                       in every language, and levelled to be heard — they are
//                       what somebody says when you tread on them. A crowd
//                       murmur made of sixteen clips is sixteen clips, and the
//                       ear finds the period inside a minute. See the note over
//                       length in 80-audio.js, which learned this about the
//                       beds. NOT USED.
//
//   synthesis           this file. A syllable is a pitch, two formants and an
//                       onset, and a phrase is a handful of those with a
//                       contour over them. It costs no payload, it is a
//                       different utterance every time, and it takes the eight
//                       voices straight off `YELP` in 80-audio.js so that the
//                       woman who yelps when you hose her is the same woman who
//                       says dobar dan.
//
// ── and what it must not bury ────────────────────────────────────────────────
//
// The bed at Jadrija is a FIELD RECORDING OF THIS PROMENADE, with the people on
// it — `shore` in 80-audio.js, 24.5 s at -28.2 dBFS scaled by 0.30, which lands
// about -38.5 dBFS on the outdoor bus at the water's edge. So a continuous
// synthesised murmur is not missing; it is already there, and laying a second
// one over it is the mistake that file names explicitly about the cicadas:
// "the same texture twice and uncorrelated, which is not the same thing as more
// of it".
//
// What the bed CANNOT do is come from a person you can see. So nothing here is
// continuous. It is short utterances, sparse, attenuated hard with distance,
// fired only by a pair or a group that is doing the thing in front of you.
//
// AND IT DOES NOT BURY THE BIRDS, measured rather than asserted, because that
// complaint has been made once already about the music and the answer then was
// five goes at a level. Everything below is one number off one instrument — an
// AnalyserNode on `audio.tap()`, which is the last node before the speakers, so
// it is the dBFS of samples the graph actually computed and not a gain somebody
// wrote. Sampled INTERLEAVED, eight windows of bed then fourteen of bed-plus-
// voice, twenty-four times over, so that the bed's own drift — 4.35 dB between
// ten-second windows, which is what makes two separate recordings useless for
// this — cancels between the two halves. The control, the identical run with
// nothing fired, comes back bed −33.13 and "voice" −33.21: 0.08 dB, which is
// the noise floor of the method.
//
//   on the promenade, t 280 s 2
//     the bed                            −33.64 dBFS RMS
//     one phrase at 3 m                  −35.70   →  2.1 dB UNDER the bed
//     one phrase at 15 m                 under the floor — the bed's own drift
//                                        swallows it, which is the finding and
//                                        not a failed reading
//
//   in the vikendica living room, which is the one place the birds are the
//   loudest thing and the whole reason `perchBus` has its own stage of the wall
//     the room                           −35.50 dBFS RMS
//     a bather's phrase at 22 m          the bed reads −35.50 with the voice
//                                        firing and −35.43 without: 0.07 dB,
//                                        which is BELOW the control's own
//                                        0.08 dB floor. It is not quiet in
//                                        there, it is absent.
//
// The second block is the one that answers the question, and it is structural
// rather than lucky. The birds come through `perchBus` at 0.44; the chatter
// goes through `outBus`, which in that room measures 0.062 with a 504 Hz lid on
// it — the chatter IS part of the beach the wall is shutting out, and it is 24
// dB down before its own distance law has taken anything off it. The dove in
// there is fourteen decibels OVER what is left of the beach. Nothing that
// cannot be measured against the room can bury it.
//
// And the rate, which is the other half of "does it bury anything": stepped 93
// s at t 280 and read off `chats()`, eleven conversations, fifty-three turns
// and NINETEEN utterances — one every 4.9 s somewhere in earshot, at 6.8 to 32
// m. Most of those are past fifteen metres and are inside the promenade rather
// than on top of it.
// -----------------------------------------------------------------------------

/**
 * The hash, and RULE 4 is why there is one.
 *
 * Not one draw off `rng` in this file, ever. The Jadrija layout is downstream
 * of a single stream, and a draw taken to decide which of twenty-six phrases
 * somebody says would move every parasol on the beach.
 *
 * The same two lines as `jit` in the shore build, `crowdJit` in 42-crowd and
 * `laneJit` in 46-backlane, and copied a fourth time rather than imported for
 * the reason those give: a hash is pure, two callers landing on the same (i, k)
 * costs nothing, and what a shared one would cost is a dependency on a file
 * that belongs to somebody else's evening.
 *
 * Keyed on `fg.idx` — the casting order, which is the only stable name anybody
 * in this crowd has — and on a turn counter, so that a person's habits hold
 * across a whole conversation while the phrase changes every time they open
 * their mouth. Keyed on the seed alone it would be one person with one line.
 *
 * `Math.random` still appears below, twice, and only for SCHEDULING: which
 * group forms at 14:32 and how long this turn runs. That is the same division
 * `findPair` in 43-jadrija.js already draws and for the same reason — rule 4 is
 * about the layout, and the layout is not being asked.
 */
function chatJit(i, k) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// ── the sound of a language, without the language ────────────────────────────
/**
 * Croatian vowels, as the two formants that are the whole of what a vowel is.
 *
 * F1 and F2 in hertz for a reference adult male tract, scaled per speaker
 * below. Croatian is unusually good to do this with: five pure monophthongs
 * with no diphthongs and no reduction, so each one really is a fixed pair of
 * resonances held for the length of the syllable, which is exactly what two
 * bandpass filters over a sawtooth make. English "a" is three different vowels
 * depending on the county and could not be done this way at all.
 *
 * These are the standard values for /a e i o u/ and nothing about them was
 * tuned by ear. The tell that it is working is that the vowels are
 * distinguishable from each other at three metres and the WORDS are not — see
 * `CHAT_LINES`.
 */
const CHAT_VOW = {
  a: [700, 1250],
  e: [500, 1850],
  i: [300, 2250],
  o: [480, 950],
  u: [350, 750],
};

/**
 * What is in front of a vowel, in three classes and not thirty.
 *
 * A consonant is a gesture of the mouth in the twenty milliseconds before the
 * voice starts, and at ten metres across a promenade there are three of them
 * that can be told apart:
 *
 *   p   a STOP — d, b, k, t, g, p. The mouth is shut, so there is silence, and
 *       then it opens with a click. The silence is the half that carries: a
 *       syllable that starts abruptly out of nothing reads as a consonant even
 *       when the burst is inaudible.
 *   f   a FRICATIVE — s, š, ž, h, and the first half of j. Fifty milliseconds
 *       of noise with the voice off.
 *   m   a NASAL or LIQUID — m, n, l, r, v. The voice is already on but the
 *       mouth is nearly shut, so it is a low murmur that opens into the vowel.
 *       No silence and no noise, which is what makes it the third one.
 *   -   nothing. The syllable starts on the vowel.
 *
 * `hz` is where the burst or the noise band sits, `dur` how long the gesture
 * takes, and `gap` how much of that is silent before the voice comes back.
 */
const CHAT_ONS = {
  '-': { hz: 0, dur: 0.000, gap: 0.000, kind: 0 },
  p: { hz: 1900, dur: 0.055, gap: 0.042, kind: 1 },
  f: { hz: 4600, dur: 0.070, gap: 0.062, kind: 2 },
  m: { hz: 320, dur: 0.055, gap: 0.000, kind: 3 },
};

/**
 * The phrases, and what they are and are not.
 *
 * Each is a list of `[onset, vowel, seconds]` and a flag for whether the pitch
 * goes UP at the end, which is the difference between a remark and a question
 * in every language anybody has looked at.
 *
 * They are SHAPES OF CROATIAN and not Croatian. The key names the phrase they
 * are cut to the rhythm of — `dobardan` really is o-a-a with a stop in front of
 * each, at 115, 105 and 260 ms, falling — and at three metres in a quiet room a
 * few of them do come out as the words. At the range anybody hears them in this
 * game, over a promenade bed, what survives is the number of syllables, the
 * stress, and whether it went up at the end. That is the whole intent: RULE 12's
 * argument about invented lettering on a sign applies to a language as much as
 * to a masthead, and a synthesised vowel is not a claim to be a word.
 *
 * WHY THERE ARE TWO POOLS. A greeting is one to three syllables and lands on
 * its own — bok, dobar dan, ajde. A turn in a conversation is two to five and
 * is one of several. Mixing them gives you people who greet each other for
 * thirty seconds, which is the carousel this was written to avoid.
 *
 * Stress on the first syllable, which is where Croatian puts it, and it is why
 * the last syllable of nearly every one of these is the LONG one — the length
 * is the phrase-final lengthening that happens in any language when a speaker
 * stops, and without it every line ends as if it were cut off.
 */
const CHAT_LINES = {
  // ── passing, or arriving: a hello ──
  bok: { syl: [['p', 'o', 0.21]], up: 0 },
  ej: { syl: [['-', 'e', 0.26]], up: 0 },
  dan: { syl: [['p', 'a', 0.25]], up: 0 },
  ajde: { syl: [['-', 'a', 0.15], ['p', 'e', 0.19]], up: 0 },
  evo: { syl: [['-', 'e', 0.13], ['m', 'o', 0.20]], up: 0 },
  dobro: { syl: [['p', 'o', 0.13], ['m', 'o', 0.21]], up: 0 },
  zdravo: { syl: [['f', 'a', 0.14], ['m', 'o', 0.22]], up: 0 },
  dobardan: {
    syl: [['p', 'o', 0.115], ['m', 'a', 0.105], ['p', 'a', 0.26]], up: 0,
  },
  kakosi: {
    syl: [['p', 'a', 0.12], ['p', 'o', 0.115], ['f', 'i', 0.22]], up: 1,
  },
  dobrojutro: {
    syl: [['p', 'o', 0.12], ['m', 'o', 0.105], ['f', 'u', 0.13],
      ['p', 'o', 0.21]],
    up: 0,
  },
  // ── standing about, discussing whatever it is ──
  pada: { syl: [['p', 'a', 0.14], ['p', 'a', 0.21]], up: 0 },
  nemoj: {
    syl: [['m', 'a', 0.12], ['m', 'e', 0.11], ['m', 'o', 0.23]], up: 0,
  },
  neznam: { syl: [['m', 'e', 0.14], ['f', 'a', 0.25]], up: 0 },
  nista: { syl: [['m', 'i', 0.13], ['f', 'a', 0.23]], up: 0 },
  takoje: {
    syl: [['p', 'a', 0.13], ['p', 'o', 0.12], ['-', 'e', 0.21]], up: 0,
  },
  bogami: {
    syl: [['m', 'o', 0.12], ['p', 'a', 0.115], ['m', 'i', 0.22]], up: 0,
  },
  svakidan: {
    syl: [['f', 'a', 0.12], ['p', 'i', 0.11], ['p', 'a', 0.25]], up: 0,
  },
  evosad: {
    syl: [['-', 'e', 0.12], ['m', 'o', 0.11], ['f', 'a', 0.23]], up: 0,
  },
  ondaono: {
    syl: [['-', 'o', 0.12], ['p', 'a', 0.11], ['-', 'o', 0.115],
      ['m', 'o', 0.21]],
    up: 0,
  },
  bilojeto: {
    syl: [['m', 'i', 0.115], ['m', 'o', 0.105], ['-', 'e', 0.10],
      ['p', 'o', 0.24]],
    up: 0,
  },
  kakojebilo: {
    syl: [['p', 'a', 0.115], ['p', 'o', 0.10], ['-', 'e', 0.095],
      ['m', 'i', 0.105], ['m', 'o', 0.22]],
    up: 0,
  },
  jesteste: { syl: [['f', 'e', 0.15], ['f', 'e', 0.23]], up: 0 },
  // ── and the ones that go up, which is what makes it a conversation ──
  stoje: { syl: [['f', 'o', 0.14], ['-', 'e', 0.22]], up: 1 },
  jelda: { syl: [['-', 'e', 0.115], ['m', 'a', 0.23]], up: 1 },
  kadto: { syl: [['p', 'a', 0.14], ['p', 'o', 0.22]], up: 1 },
  aje: { syl: [['-', 'a', 0.12], ['-', 'e', 0.21]], up: 1 },
};
/** Which of the above are a hello, and which are a turn in a conversation. */
const CHAT_HELLO = ['bok', 'ej', 'dan', 'ajde', 'evo', 'dobro', 'zdravo',
  'dobardan', 'kakosi', 'dobrojutro'];
const CHAT_TALK = ['pada', 'nemoj', 'neznam', 'nista', 'takoje', 'bogami',
  'svakidan', 'evosad', 'ondaono', 'bilojeto', 'kakojebilo', 'jesteste',
  'stoje', 'jelda', 'kadto', 'aje'];

/**
 * How loud a person talking is, and how far it carries.
 *
 * `gain` is what one utterance is scaled by at nought metres, on the OUTDOOR
 * bus — the same stage the promenade, the cicadas and the sea against the edge
 * go through, so a shut door takes the chatter away with them, which is right:
 * a conversation on the concrete is not audible from the vikendica's sofa and
 * would be the one sound in the game that walked through a wall.
 *
 * The levels it comes out at are in the header, measured at t 280 and in the
 * vikendica rather than computed. The number that matters is that a phrase at
 * three metres sits WITH the promenade bed and not over it.
 *
 * `half` is where it is down six decibels and `gone` is where it stops being
 * scheduled at all. Seven metres is a conversation you are standing beside;
 * thirty-four is across the width of the resort, where a voice is a couple of
 * syllables under everything else and is the reason a busy stretch sounds busy.
 *
 * The `roll` of 1.5 is between a point in free air and a point in a room, which
 * is what a promenade with huts down one side of it is — the same power the
 * perched birds are given in 80-audio.js and for the same reason.
 */
const CHAT_LEVEL = {
  // 0.30, and the three goes it took are worth recording because the answer
  // moved 6 dB. 0.115 put a phrase at 3 m at −40.4 dBFS against a −34.1 bed,
  // which is six decibels under the place and is a person mouthing; 0.18 was
  // −6.3 and still under. 0.30 is −35.7 against −33.6, which is two decibels
  // under the promenade at the closest range anybody ever stands to a
  // conversation — and about level is the target rather than over it, because
  // the bed is a recording of THIS promenade with people already on it, and a
  // synthesised voice that stands proud of that is a person shouting.
  gain: 0.30,
  half: 7,
  roll: 1.5,
  gone: 34,
  // What is left of the top of a voice at each end. A person at thirty metres
  // over open concrete has no sibilance left; the vowels get through and the
  // consonants do not, which is most of why crowd talk is unintelligible.
  lpNear: 6000,
  lpFar: 1450,
  // Into the valley convolver, lightly. A voice outdoors on a hard promenade
  // has a slap on it and nothing more.
  verb: 0.12,
};

/**
 * Say one phrase, in one of the eight voices, at one distance.
 *
 * @param ctx  the AudioContext
 * @param io   `{ out, verb, noise, V }` — the outdoor bus, the reverb send, the
 *             shared noise buffer, and this speaker's row of `YELP` in
 *             80-audio.js. `V` is passed in rather than duplicated here: the
 *             eight voices are already written down once, keyed by the same
 *             cast names, and a second copy is a copy that can disagree.
 * @param key  a key of `CHAT_LINES`
 * @param d    metres from the listener
 * @param seed 0..1, this speaker's own, so two people are not one person
 *
 * ONE OSCILLATOR FOR THE WHOLE PHRASE and not one per syllable, which is not
 * an optimisation. Speech is continuous voicing with the mouth moving over it:
 * the formants slide from one vowel to the next in about forty milliseconds and
 * that slide — coarticulation — is most of what separates a sentence from a row
 * of beeps. Re-triggering the oscillator every syllable throws it away.
 */
function chatSay(ctx, io, key, d, seed) {
  if (!ctx || !io || !io.out) return false;
  const P = CHAT_LINES[key];
  if (!P || d > CHAT_LEVEL.gone) return false;
  const V = io.V || { f0: 250, f1: 760, f2: 1320, rasp: 0.15 };
  // How long this speaker's tract is, taken off the vowel they already have.
  // `YELP` holds each of the eight saying "ah", so dividing by the reference
  // "a" above is exactly the scale between that person's mouth and the table's.
  // F1 and F2 get their own, because a child is not a man played fast.
  const k1 = V.f1 / CHAT_VOW.a[0], k2 = V.f2 / CHAT_VOW.a[1];
  // Not the same person twice, and not the same person's own second sentence.
  // Narrow: past about eight per cent this stops sounding like a mood and
  // starts sounding like a tape speed, which is the lesson `bark` records.
  const j = 0.94 + seed * 0.12;
  const far = 1 / (1 + Math.pow(Math.max(d, 0.1) / CHAT_LEVEL.half,
    CHAT_LEVEL.roll));
  const amp = CHAT_LEVEL.gain * far;
  const t0 = ctx.currentTime + 0.015;

  // ── the plan, laid out before anything is scheduled ──
  // Where every syllable starts and stops, so the pitch contour can be written
  // across the whole phrase rather than syllable by syllable. A contour that is
  // recomputed per syllable is a contour with a step in it at every boundary.
  const n = P.syl.length;
  const seg = [];
  let t = t0;
  for (let i = 0; i < n; i++) {
    const [ons, vow, len] = P.syl[i];
    const O = CHAT_ONS[ons] || CHAT_ONS['-'];
    // Every speaker takes their own time over it, and a child a little less.
    const L = len * (0.88 + seed * 0.24) * (k1 > 1.1 ? 0.92 : 1);
    seg.push({ o: O, vow, a: t + O.gap, b: t + O.gap + L, ons: t, dur: L });
    t = t + O.gap + L;
    // The gap between syllables inside a word, which is nearly nothing — the
    // onset of the next one carries the boundary. Only the last one gets air.
    if (i < n - 1) t += 0.012;
  }
  const end = t;

  // ── the voice ──
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  // Declination: a statement drifts down about a fifth over its length, which
  // is what a speaker running out of breath does and is the single strongest
  // cue that a phrase has FINISHED. A question does the same and then jumps a
  // third on the last syllable. Held flat, every line sounds like a list.
  const f0 = V.f0 * j;
  for (let i = 0; i < n; i++) {
    const s = seg[i];
    const u = n > 1 ? i / (n - 1) : 0;
    let hz = f0 * (1 - 0.17 * u);
    // Stress on the first, which is where Croatian puts it.
    if (i === 0 && n > 1) hz *= 1.09;
    if (P.up && i === n - 1) hz *= 1.30;
    osc.frequency.setValueAtTime(Math.max(60, hz), s.a);
    // And inside the syllable a small fall, which is a vocal fold slowing down
    // and is present in every syllable of every language.
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(60, hz * (P.up && i === n - 1 ? 1.10 : 0.94)), s.b);
  }

  // The envelope, which is where the consonants actually live. A stop is a
  // hole in the voicing and the hole is what the ear hears; the burst on top of
  // it is confirmation. So this is scheduled first and the noise second.
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  for (let i = 0; i < n; i++) {
    const s = seg[i];
    // How hard this syllable is hit. First loudest, last a little down, and
    // never flat — a phrase of equal syllables is a metronome.
    const lv = (i === 0 ? 1.0 : i === n - 1 ? 0.80 : 0.66)
      * (0.90 + chatJit(i + 1, seed * 1000) * 0.18);
    if (s.o.kind === 3) {
      // A nasal: the voice is already on, quietly, through a shut mouth.
      env.gain.setValueAtTime(Math.max(0.0001, 0.16 * lv), s.ons);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0001, lv), s.a + 0.020);
    } else {
      env.gain.setValueAtTime(0.0001, s.ons);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0001, lv),
        s.a + 0.018);
    }
    env.gain.setValueAtTime(Math.max(0.0001, lv), s.b - s.dur * 0.30);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, lv * 0.30), s.b);
    if (i === n - 1) {
      env.gain.exponentialRampToValueAtTime(0.0001, s.b + 0.055);
    }
  }

  // ── the mouth ──
  // Three bandpasses in parallel. F1 and F2 are the vowel; the third is fixed
  // and weak and is only there to stop the pair reading as a filter sweep,
  // which is the same trick `yelp` uses and for the same reason.
  const sum = ctx.createGain();
  sum.gain.value = 1;
  // Everything, voiced and unvoiced, after the envelope has been applied to the
  // half of it that the envelope is about. See the consonants below.
  const mix = ctx.createGain();
  mix.gain.value = 1;
  const bps = [];
  for (let b = 0; b < 3; b++) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = [7.0, 9.0, 11.0][b];
    const g = ctx.createGain();
    g.gain.value = [1.0, 0.62, 0.16][b];
    osc.connect(bp).connect(g).connect(sum);
    bps.push(bp);
  }
  for (let i = 0; i < n; i++) {
    const s = seg[i];
    const F = CHAT_VOW[s.vow] || CHAT_VOW.a;
    const hz = [F[0] * k1, F[1] * k2, 2650 * k2];
    for (let b = 0; b < 3; b++) {
      // 45 ms to get there, from wherever the last vowel left it. This ramp IS
      // the coarticulation: the mouth is a slow object and the tongue is
      // already on its way to the next vowel while the current one is still
      // sounding. Set with setValueAtTime instead and each syllable is a
      // separate event, which is a robot reading a list.
      bps[b].frequency.setTargetAtTime(Math.max(90, hz[b]),
        Math.max(t0, s.ons - 0.030), 0.018);
    }
  }

  // ── and the consonants on top ──
  //
  // ROUTED ROUND THE ENVELOPE AND NOT THROUGH IT, which is the one mistake in
  // here worth writing down because it silently un-made half the effect. The
  // bursts started on `sum`, upstream of `env` — and `env` is at 0.0001 during
  // a stop's closure by construction, since the closure IS the envelope going
  // to nothing. A burst scheduled six milliseconds before the release lands 60
  // per cent of the way up a 60 ms exponential from 1e-4, which is 2.5 per cent
  // of full: every plosive in every phrase was being attenuated to inaudibility
  // by the very thing that makes it a plosive. They go to `mix`, downstream.
  //
  // Only the two that make a noise. A nasal is already drawn, in the envelope.
  if (io.noise) {
    for (let i = 0; i < n; i++) {
      const s = seg[i];
      if (s.o.kind !== 1 && s.o.kind !== 2) continue;
      const src = ctx.createBufferSource();
      src.buffer = io.noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      // A stop is a click and wants a wide filter; a fricative is a hiss and
      // wants a narrow one held for fifty milliseconds.
      bp.Q.value = s.o.kind === 1 ? 1.1 : 2.2;
      bp.frequency.value = s.o.hz * (0.85 + chatJit(i + 7, seed * 700) * 0.30)
        * (k1 > 1.05 ? 1.15 : 1);
      const g = ctx.createGain();
      // A burst lands ON the release of the closure, which is the instant the
      // voice comes back — so it is scheduled against `s.a` and not `s.ons`.
      const at = s.o.kind === 1 ? s.a - 0.006 : s.ons;
      const dur = s.o.kind === 1 ? 0.012 : s.o.dur;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(s.o.kind === 1 ? 0.55 : 0.22,
        at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(bp).connect(g).connect(mix);
      src.start(at); src.stop(at + dur + 0.02);
    }
    // The breath under all of it. Every real vocal noise has one, and it is
    // most of what separates a shout from a synthesiser — `yelp`'s note, and
    // it holds at a tenth of the level here because this is talking.
    const air = ctx.createBufferSource();
    air.buffer = io.noise; air.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.Q.value = 1.3;
    nf.frequency.value = V.f2 * 1.4;
    const ng = ctx.createGain();
    ng.gain.value = 0.055 * (V.rasp || 0.15);
    air.connect(nf).connect(ng).connect(env);
    air.start(t0); air.stop(end + 0.10);
  }

  // ── out ──
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.4;
  lp.frequency.value = CHAT_LEVEL.lpFar
    + (CHAT_LEVEL.lpNear - CHAT_LEVEL.lpFar) * Math.pow(far, 0.55);
  const out = ctx.createGain();
  out.gain.value = amp;
  sum.connect(env).connect(mix);
  mix.connect(lp).connect(out).connect(io.out);
  if (io.verb) {
    const w = ctx.createGain();
    w.gain.value = CHAT_LEVEL.verb * far;
    out.connect(w).connect(io.verb);
  }
  osc.start(t0);
  osc.stop(end + 0.14);
  return true;
}

/**
 * The nod, and why it is not in 42-crowd.js with the rest of the head.
 *
 * Both crowd tiers turn a head by YAW and only by yaw: `fg.lookY` goes on the
 * head at 0.70 and on the chest at 0.30, and there is no channel anywhere in
 * that file for a chin going down. Which was right while the only things a
 * bather did with their head were watch you go past and say hello — both of
 * those are a turn — and is not enough for a conversation, where the listener
 * agreeing is the single most legible thing in the whole picture.
 *
 * `aim` is the way in. It lays one delta per BONE over whatever the clip is
 * doing, it keeps exactly one per bone, and `neck` is free: 42-crowd writes
 * `head` and `chest`, and the only other claim on `neck` is `holdPhone` in
 * 43-jadrija.js, which is why nobody holding a phone is ever put in a
 * conversation. See `freeToChat`.
 *
 * The axis is (0, 0, -1) and that is not a guess — it is the axis `holdPhone`
 * already tips a reader's chin down on, and the rig's own convention says why:
 * "a joint's rotation.z swings its far end toward +X, i.e. forward". Rotation
 * about X is a head tipped toward a shoulder, which is a shrug and not a nod,
 * and it is the mistake this would have been.
 *
 * SKINNED FIGURES ONLY. The instanced tier has no `aim` — it is posed from a
 * scratch skeleton and read out into instance buffers — and at the range the
 * instanced tier is drawing anybody (past 28 m on this shore, measured) a nod
 * is a fraction of a pixel. Nothing is lost.
 */
const NOD = {
  // How far the chin goes down. 0.16 rad is nine degrees, which on a 0.23 m
  // head is about 3 cm of movement at the crown — small, and it has to be:
  // photographed at 0.30 this is a bow, and people agreeing with each other on
  // a promenade do not bow.
  deep: 0.16,
  // Down and up. Down faster than up, which is what a nod is; equal and it
  // reads as a float.
  down: 0.17, up: 0.26,
  // Two in a row as often as one, because that is what people do.
  twice: 0.45,
};

/**
 * Everything about who is talking to whom.
 *
 * `dep` is the small handful of things this needs from the shore build and
 * cannot see from out here:
 *
 *   aim(fg, x, z)   the yaw that would point `fg` at a point, unclamped —
 *                   `greetAim` in 43-jadrija.js, which is also the test for
 *                   whether two people could see each other at all
 *   free(fg)        whether this person is available at all: `freeToGreet`,
 *                   which already rules out sunbathers, the shop staff, anybody
 *                   mid-bump and anybody mid-hello
 *   voice(fg)       which of the eight this person is, as a `YELP` key
 */
function makeChatter(dep) {
  const CHAT = {
    // ── two bands, and both of them were MEASURED ───────────────────────────
    //
    // This started at one band, `near: 3.0, arc: 1.15` — a café table, and a
    // wedge inside the neck's own reach — on the reasoning that a conversation
    // is closer and more square-on than a wave. Both halves of that were wrong,
    // and it took `chatSurvey` to find out, because a beach with nobody talking
    // on it looks identical whichever of the three tests is the one failing.
    //
    // Every pair within 6 m of each other and inside 48 m of you, at four
    // stations, as `[metres apart, the worse of the two bearings in radians]`:
    //
    //   t 206   5.17/1.85  4.48/2.10  3.86/2.85
    //   t 246   5.28/0.16  5.92/0.80  5.17/1.85  5.14/1.95  4.47/2.10 …
    //   t 276   5.28/0.16  5.52/1.25  5.10/1.80  5.14/1.95  4.31/2.03 …
    //   t 318   4.87/0.01  5.28/0.16  5.45/1.30  0.85/1.85  5.91/1.98 …
    //
    // Read the two columns against each other. EVERYTHING THAT FACES IS ABOUT
    // FIVE METRES AWAY AND EVERYTHING CLOSE IS SIDE-ON OR BACK TO BACK. At the
    // original numbers the count of qualifying pairs on this whole shore was
    // ZERO, at every station, and twenty seconds of sim produced no
    // conversation at all.
    //
    // The survey photographs say why, and they say it is not a fault in the
    // placement. Counted off 86 stills at the real Jadrija, people who are
    // together are 0.4 to 1.1 m apart — adjacent café chairs touch, families on
    // towels are shoulder to shoulder, across a small round table is 0.9 to 1.1
    // — and separate groups on the concrete mole are 3 to 6 m apart. And they
    // sit in exactly two geometries, which do not mix: a ring facing INWARD
    // round a table or round nothing (20260821_175856, four people, chairs
    // touching), or a row facing OUT AT THE WATER (1000150343, a couple on a
    // bench 0.5 m apart both looking at the sea; 1000150338, three men in a
    // straight line 0.8 to 1.0 m apart). The second of those is two people
    // talking at a mutual bearing of ninety degrees, and it is the commonest
    // arrangement on the beach — and it was the one the first cut ruled out by
    // construction.
    //
    // Hence two bands, which is what the photographs actually show:
    //
    //   TOGETHER    within 2.8 m and facing anywhere but away. 2.8 is over the
    //               0.4-1.1 m the survey measures and under the 3-6 m gap
    //               between groups, so it cannot marry two neighbouring
    //               families; 2.35 rad is 135 degrees, which takes in a row on
    //               a bench at ninety and stops well short of the 2.6-2.9 pairs
    //               in the table above, who are back to back on the same square
    //               of concrete and are not together at all.
    //
    //   ACROSS      up to 5.5 m if they are properly squared up — 1.35 rad, so
    //               both of them within seventy-seven degrees. That is the
    //               5.28/0.16 and 4.87/0.01 pairs, and on a promenade five
    //               metres apart and facing each other IS two people talking.
    //
    // What makes the second one read at that range is not the numbers, it is
    // that the participants TURN — see `easy` and `slew`, which was the part
    // that was missing rather than mis-tuned.
    near: 2.8,
    arc: 2.35,
    far: 5.5,
    farArc: 1.35,
    // And how close is too close. Lower than the greeting's 0.85 because people
    // who are talking stand closer than people who are hailing each other —
    // adjacent chairs on that terrace are touching — and 0.45 m is still two
    // people and not one.
    min: 0.45,
    // How far off their own nose somebody leaves the person they are talking
    // to, once they have turned. NOT zero: two people squared up face to face
    // at half a metre is an argument, and at five metres it is a duel. Half a
    // radian is 29 degrees, which is how people actually stand — angled, with
    // the last of it done by the head.
    easy: 0.50,
    // And how fast the body gets there. 1.5 rad/s turns a person 60 degrees in
    // 0.7 s, which is a step round rather than a spin.
    slew: 1.5,
    // Only where it can be seen. A conversation is a POSTURE rather than a
    // gesture, so it reads further off than a raised arm does — but past fifty
    // metres two figures angled at each other are two figures.
    see: 48,
    // How many run at once, anywhere. The cost of this is bounded by exactly
    // this number: three groups of at most three people is nine figures whose
    // heads are written per frame, against a crowd of about 450.
    live: 3,
    // How often the beach is asked, and how often an ask that finds a group is
    // allowed to become one.
    //
    // Same shape as the greeting's and the same lesson: `every` is an ATTEMPT,
    // most attempts find nobody, and the ones that succeed are wherever people
    // are actually standing together — so the result is clustered by
    // construction and the empty west end of this shore stays empty with no
    // special-casing at all.
    every: 3.2,
    odds: 0.55,
    // How long one lasts. Two numbers, because a walker is not a sitter: three
    // people at a café table talk until you have walked past them, and two
    // people who have stopped on the promenade to talk are blocking it. The
    // second is short enough that a walker's whole errand still happens.
    dur: [16, 46],
    walkDur: [9, 19],
    // How long one person holds the floor. The spread is the whole of it: turns
    // of a fixed length are a metronome, and the beach already knows this about
    // pause times — "a promenade where everybody pauses for the same four
    // seconds reads as a carousel".
    turn: [1.4, 4.2],
    // Of those turns, how many are actually spoken out loud. Under half,
    // because most of a conversation is somebody listening and because a group
    // that makes a noise every two seconds is an argument.
    voiced: 0.44,
    // And the least time between any two utterances anywhere on the beach, so
    // that three groups in earshot are a promenade and not a party.
    floor: 0.85,
    // Past this nobody is close enough to be heard at all and the synth is
    // never started. `CHAT_LEVEL.gone`, and it is the same number on purpose.
    hear: CHAT_LEVEL.gone,
    // The most a neck does before the body has to follow.
    //
    // NOT the greeting's 1.05, and the difference is the same one `easy` is
    // about. 1.05 is a GLANCE — the head goes round, the shoulders come a third
    // of the way with it, and it is back in two seconds. This is somebody who
    // has settled into talking to a person beside them, which on a real neck is
    // seventy to eighty degrees of head over twenty-five of chest, and 1.45 rad
    // is eighty-three of those two split the 0.70/0.30 the tiers already apply.
    // It only ever bites where the body has stopped short — see `easy` — so the
    // common case is a residual of half a radian and this number never comes
    // into it at all.
    reach: 1.45,
    // How long a head takes to come round at the start and to let go at the
    // end. Longer than a greeting's 0.40, because turning to somebody you are
    // about to talk to for half a minute is not the same movement as noticing
    // them.
    turnIn: 0.70, turnOut: 0.90,
    // The same person does not start another one inside this.
    again: 55,
    // And a hand, now and then, on whoever is speaking. `fg.gArm` is the
    // greeting's own wave and this is a fraction of it — see `GEST`.
    gest: 0.30,
  };

  /**
   * The gesture, which is the greeting's wave turned most of the way down.
   *
   * `fg.gArm` is a WEIGHT — both tiers lerp toward a full over-the-head wave by
   * it — so a small one is not a small wave, it is an arm lifted a little away
   * from the body with the elbow bent, which is what a hand does when somebody
   * is explaining something. At 0.30 the instanced tier puts the upper arm
   * about thirty degrees out; the skinned tier slerps thirty per cent of the
   * way from wherever the clip has it.
   *
   * `hold` is short and `every` is long on purpose. A hand that is up for the
   * whole conversation is a person hailing a taxi for half a minute.
   */
  const GEST = { on: 0.30, up: 0.22, hold: 0.85, down: 0.35, odds: 0.38 };

  const groups = [];
  let clock = 0;
  let clk = 0;
  let saidAt = -1e3;
  // For the probe. A rate cannot be photographed — "a conversation somewhere in
  // view most of the time" is a claim about four hundred seconds of beach, not
  // about a frame — so the thing counts itself, and the pose pairs come with
  // the count because WHICH groups form is what decides whether any of this was
  // worth building. A shore where every conversation is two people in chairs
  // needs no walker handling at all.
  let nGroup = 0, nSaid = 0, nTurn = 0, nNod = 0;
  const byMode = {};
  const sayLog = [];

  /**
   * Whether this person can be put in a conversation.
   *
   * `dep.free` is the greeting's own test and carries the four that are
   * obvious: a sunbather is lying on their side in a frame none of this is
   * written in, the shop staff are at work, and anybody mid-bump or mid-hello
   * already has somebody writing their head.
   *
   * The two that are this file's own:
   *
   * ANYBODY HOLDING A PHONE IS OUT. Two reasons and both are sufficient.
   * `holdPhone` in 43-jadrija.js owns `neck` on those figures and `aim` keeps
   * one rotation per bone, so a nod on a phone-reader would be deleted on the
   * next frame — or worse, would delete the chin that is looking at the screen.
   * And it is true anyway: the person at the table on their phone is the one
   * who is NOT talking to you, and having them opt out is a detail nobody would
   * have thought to ask for.
   *
   * AND ANYBODY WHO HAS JUST DONE IT. Fifty-five seconds is long enough that
   * you cannot stand and watch one pair go round twice.
   */
  const freeToChat = (fg) => !fg.chat && !fg.phone && dep.free(fg)
    && fg.mode !== 'lie' && clock - (fg.cAt == null ? -1e3 : fg.cAt) >= CHAT.again;

  /** Two or three people who are plausibly standing together, or nothing. */
  function findGroup(pool, from = -1) {
    const n = pool.length;
    if (n < 2) return null;
    // Scanned from a random offset and not from the front, for the reason
    // `findPair` gives at length: the pool is in casting order and casting
    // order is stable, so a scan from zero finds the same two people on the
    // same terrace every time and the rest of the beach never says a word.
    const o = from >= 0 ? from : (Math.random() * n) | 0;
    for (let ii = 0; ii < n; ii++) {
      const a = pool[(o + ii) % n];
      for (let jj = 1; jj < n; jj++) {
        const b = pool[(o + ii + jj) % n];
        if (!pairOk(a, b)) continue;
        const g = [a, b];
        // A third, if there is one who is standing with BOTH of them. Which is
        // the test that makes a group a group rather than a chain: three people
        // in a line, each facing the next, is a queue.
        //
        // Not always, and the share is a hash of the two who are already in it
        // rather than a coin — so the same two people at the same table have
        // the same habit about whether they talk to the man beside them, which
        // is a fact about a group and not about a frame.
        if (chatJit(a.idx * 31 + b.idx, 4409) < 0.42) {
          for (let kk = 1; kk < n; kk++) {
            const c = pool[(o + ii + jj + kk) % n];
            if (c === a || c === b) continue;
            if (pairOk(a, c) && pairOk(b, c)) { g.push(c); break; }
          }
        }
        return g;
      }
    }
    return null;
  }

  /** Near enough, not on top of each other, and both of them facing. */
  function pairOk(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > CHAT.far || d < CHAT.min) return false;
    // Both of them, and this is the test that stops a conversation being held
    // at the back of somebody's head. One-sided reads far worse than none: the
    // eye finds the turned head, follows it, and lands on a stranger looking at
    // the sea.
    const w = Math.max(Math.abs(dep.aim(a, b.x, b.z)),
      Math.abs(dep.aim(b, a.x, a.z)));
    return d <= CHAT.near ? w <= CHAT.arc : w <= CHAT.farArc;
  }

  /** Take a conversation off somebody and leave nothing of it behind. */
  function release(fg) {
    fg.chat = null;
    fg.look = 0;
    fg.lookY = 0;
    fg.gArm = 0;
    fg.cAt = clock;
    // The nod's delta is on a MESH and not on this person — see `sweepNods`,
    // which is the other end of the same guarantee and the one that catches a
    // slot changing hands mid-sentence.
    fg.nod = 0;
    fg.nodOn = 0;
    // And the body back where it was standing. In the ordinary case this is
    // already true to a thousandth — the turn is scaled by the same `ease` that
    // has just gone to zero — so what this actually catches is the interrupted
    // case: somebody walked into mid-sentence, whose body is still round at
    // their friend while a bump takes over their head. There the snap is right
    // and it is invisible, because the thing the eye is on at that instant is
    // the head coming round to YOU.
    if (!fg.beat && fg.yawB != null) fg.yaw = fg.yawB;
    fg.yawA = 0;
  }

  /** Start one. `pool` is already filtered; `g` is who. */
  function open(g) {
    const walk = g.some((fg) => !!fg.beat);
    const R = walk ? CHAT.walkDur : CHAT.dur;
    const key = g.map((fg) => fg.mode).sort().join('+');
    byMode[key] = (byMode[key] || 0) + 1;
    const G = {
      who: g,
      t: 0,
      dur: R[0] + Math.random() * (R[1] - R[0]),
      spk: (chatJit(g[0].idx, 77) * g.length) | 0,
      turn: 0,
      next: 0,
      walk,
    };
    for (const fg of g) {
      fg.chat = G;
      fg.cAt = clock;
      fg.gArm = 0;
      // Where this person's body was standing before anybody spoke to them, so
      // that it can be put back. Walkers do not need one — the walk loop
      // rewrites their yaw from the shore's tangent every frame — but they get
      // one anyway, because `release` should not have to know which kind it is.
      fg.yawB = fg.yaw;
      fg.yawA = 0;
      // The head has to come from wherever the idle sweep left it, which is
      // what `lookT` counts. Its own, per person, so three people do not all
      // turn on the same frame.
      fg.cT = -chatJit(fg.idx, 811) * 0.35;
    }
    nextTurn(G);
    groups.push(G);
    nGroup++;
    return G;
  }

  /**
   * Hand the floor to somebody else.
   *
   * Never to the same person twice running in a group of two, which would be a
   * monologue; in a group of three it is allowed once in five, because somebody
   * carrying on after a pause is a real thing and a strict round robin is the
   * most machine-like pattern there is.
   */
  function nextTurn(G) {
    const n = G.who.length;
    const r = chatJit(G.who[0].idx * 17 + G.turn, 1213);
    let s = G.spk;
    if (n === 2) s = 1 - G.spk;
    else if (r < 0.20) s = G.spk;
    else s = (G.spk + 1 + ((r * 100) | 0) % (n - 1)) % n;
    G.spk = s;
    G.turn++;
    nTurn++;
    G.next = G.t + CHAT.turn[0]
      + chatJit(G.who[s].idx + G.turn * 7, 331) * (CHAT.turn[1] - CHAT.turn[0]);
    // Whether this turn is spoken out loud, and which hand goes up if one does.
    const sp = G.who[s];
    G.say = chatJit(sp.idx + G.turn * 13, 2711) < CHAT.voiced;
    G.gest = chatJit(sp.idx + G.turn * 19, 5501) < GEST.odds;
    G.gAt = G.t + 0.25 + chatJit(sp.idx + G.turn, 907) * 0.5;
    G.spoke = false;
    // And the listeners nod, some of them, somewhere in the middle of it —
    // which is the only thing in here that is aimed at the person who is NOT
    // doing anything, and is most of why a group of three reads as three people
    // rather than one person and two mannequins.
    for (let i = 0; i < n; i++) {
      const fg = G.who[i];
      fg.nodAt = i === s ? -1
        : (chatJit(fg.idx + G.turn * 23, 6197) < 0.55
          ? G.t + 0.45 + chatJit(fg.idx + G.turn, 4001) * 1.0 : -1);
      fg.nod = 0;
      fg.nodN = chatJit(fg.idx + G.turn * 29, 733) < NOD.twice ? 2 : 1;
    }
  }

  /**
   * Say it, if anybody is close enough to hear.
   *
   * The gate is the LISTENER's distance and not the speaker's importance:
   * thirty-four metres is where `chatSay` stops being scheduled, and a group of
   * three on the far terrace costs nothing at all while you are at the other
   * end of the shore.
   */
  function speak(fg, who, pool) {
    if (clock - saidAt < CHAT.floor) return false;
    const d = Math.hypot(fg.x - who.x, fg.z - who.z);
    if (d > CHAT.hear) return false;
    if (!audio || !audio.chat) return false;
    const key = pool[(chatJit(fg.idx * 5 + Math.floor(clock * 2), 8677)
      * pool.length) | 0];
    if (!audio.chat(dep.voice(fg), key, d, fg.seed)) return false;
    saidAt = clock;
    nSaid++;
    if (sayLog.length >= 24) sayLog.shift();
    sayLog.push({ idx: fg.idx, key, d: +d.toFixed(1) });
    return true;
  }

  /**
   * A hello, out loud, for `stepGreet` to call.
   *
   * The greeting is the other half of what was asked for and it already exists;
   * all it was missing is the noise. One to three syllables, off the hello pool
   * rather than the talking one, and through the same global floor so that a
   * hello and a conversation two tables away are not on top of each other.
   */
  function hail(fg, who) {
    return speak(fg, who, CHAT_HELLO);
  }

  /**
   * Every conversation, advanced.
   *
   * Called from `updateCrowd` after the walkers have moved and BEFORE
   * `stepGreet` and `stepBump`, which is the same ordering argument those two
   * settle between themselves: all three write `fg.look`, being walked into
   * beats being said hello to, and being said hello to beats standing about
   * talking. Running first means the more urgent of the three overwrites this
   * on the frame it happens, and the group drops the person on the next one.
   */
  function step(dt, who, crowds) {
    clock += dt;
    for (let i = groups.length - 1; i >= 0; i--) {
      const G = groups[i];
      G.t += dt;
      // Anybody the world has taken back: walked into, said hello to, or drawn
      // into a hose. Let go completely rather than fight for a head a frame at
      // a time.
      let lost = false;
      for (const fg of G.who) if (fg.bumping || fg.gr || fg.chat !== G) lost = true;
      if (lost || G.t > G.dur) {
        for (const fg of G.who) if (fg.chat === G) release(fg);
        groups.splice(i, 1);
        continue;
      }
      if (G.t >= G.next) nextTurn(G);
      // A WALKER STOPS FOR IT, which the first cut did not do and which the
      // tally said mattered: of the first fifteen groups logged at t 318, ten
      // had a walker in them — `sit+walk` six, `walk+walk` four. Left walking,
      // what those are is two people sliding down the promenade with their
      // heads screwed round at each other, and in opposite directions.
      //
      // `wait` is the promenade's own "stand still and look at something" and
      // the loop in `updateCrowd` turns it into `mode = 'stand'` on the next
      // frame — the same mechanism `greetStop` uses, for the reason written up
      // over `GREET.stop`: the fix for a walker who cannot hold a pose is not
      // a clip, it is that people stop when somebody talks to them. Refreshed
      // every frame rather than set once, and to a number a good deal shorter
      // than the conversation, so that letting go of them is simply ceasing to
      // ask — they take one more breath and walk on.
      for (const fg of G.who) {
        if (fg.beat) fg.wait = Math.max(fg.wait || 0, 0.6);
      }
      // Spoken at the START of the turn, because that is what a turn IS: the
      // rest of it is the pause after, which is where the listeners nod.
      if (G.say && !G.spoke) {
        G.spoke = true;
        speak(G.who[G.spk], who, CHAT_TALK);
      }
      // In and out. The same eased shape the greeting and the bump both use,
      // for their reason: linear in and linear out is a servo.
      const w = Math.min(sat(G.t / CHAT.turnIn),
        1 - sat((G.t - (G.dur - CHAT.turnOut)) / CHAT.turnOut));
      const ease = w * w * (3 - 2 * w);
      for (let k = 0; k < G.who.length; k++) {
        const fg = G.who[k];
        fg.cT = (fg.cT || 0) + dt;
        const talking = k === G.spk;
        // WHO EACH OF THEM IS LOOKING AT, which is the whole illusion. A
        // listener looks at whoever is speaking; a speaker looks at whoever
        // they are speaking to, which in a pair is the other one and in a three
        // is the next one round. So when the floor changes, every head in the
        // group moves — and heads moving TOGETHER, in a pattern that keeps
        // changing, is what the eye reads as conversation at thirty metres
        // where no gesture is more than a couple of pixels.
        const to = talking
          ? G.who[(G.spk + 1 + ((G.turn + k) % (G.who.length - 1))) % G.who.length]
          : G.who[G.spk];
        // ── the body, which is the half that was missing ──────────────────
        //
        // People do not talk to each other over their own shoulder. They TURN,
        // and then the head does what is left — that is why the survey's row of
        // three men on a terrace and its couple on a bench are both a real
        // conversation at a ninety-degree bearing, and why the first cut of
        // this file could not have one at any distance.
        //
        // KEPT AS AN OFFSET FROM A BASE, and that is not a flourish. A walker's
        // yaw is rewritten from the promenade's own tangent by the loop in
        // `updateCrowd` on every frame, so an increment laid on it is gone by
        // the next one and a walker would turn 1.5 rad/s × dt and no further,
        // for ever. A stander's is written once at build and stays. An offset
        // over whichever base applies is the same code for both.
        //
        // And it unwinds for nothing: the target is scaled by `ease`, which is
        // already the in-and-out ramp, so the body turns away over the last
        // 0.9 s of the conversation and is back where it stood before anybody
        // spoke. `release` only has to drop the offset, and by then it is zero.
        const base = fg.beat ? fg.yaw : fg.yawB;
        let e0 = dep.aim(fg, to.x, to.z) + (fg.yaw - base);
        while (e0 > Math.PI) e0 -= TAU;
        while (e0 < -Math.PI) e0 += TAU;
        const over = Math.abs(e0) - CHAT.easy;
        const want = (over > 0 ? Math.sign(e0) * over : 0) * ease;
        const mx = CHAT.slew * dt;
        fg.yawA = (fg.yawA || 0) + clamp(want - (fg.yawA || 0), -mx, mx);
        fg.yaw = base + fg.yawA;
        // And the head takes what the body left, measured AFTER the turn.
        let y = dep.aim(fg, to.x, to.z);
        // The head moving while the mouth does. Two rates because one is a
        // wobble: 0.7 Hz is the phrase and 2.4 Hz is inside it, and the sum of
        // two incommensurate sines has no period the eye can catch.
        if (talking) {
          const p = fg.seed * 6.283;
          y += Math.sin(fg.cT * 4.4 + p) * 0.042
            + Math.sin(fg.cT * 1.7 + p * 1.7) * 0.030;
        } else {
          // And a listener is not a statue either — a slow drift, an eighth of
          // the speaker's, plus the occasional glance somewhere else entirely.
          y += Math.sin(fg.cT * 0.9 + fg.seed * 5.1) * 0.018;
        }
        fg.lookY = clamp(y, -CHAT.reach, CHAT.reach);
        fg.look = ease * (talking ? 0.94 : 0.98);
        // The nod, on a listener, part-way through somebody else's turn.
        if (fg.nodAt >= 0 && G.t >= fg.nodAt) {
          const u = G.t - fg.nodAt;
          const one = NOD.down + NOD.up;
          const c = Math.floor(u / one);
          if (c >= (fg.nodN || 1)) { fg.nod = 0; fg.nodAt = -1; fg.nodOn = 0; } else {
            const v = u - c * one;
            const q = v < NOD.down ? v / NOD.down
              : 1 - (v - NOD.down) / NOD.up;
            if (!fg.nodOn) { fg.nodOn = 1; nNod++; }
            fg.nod = NOD.deep * ease * (q * q * (3 - 2 * q));
          }
        } else if (fg.nod) { fg.nod = 0; fg.nodOn = 0; }
        // And the hand, on the speaker, now and then. Up quickly, held under a
        // second, and down again well before the turn ends.
        if (talking && G.gest) {
          const u = G.t - G.gAt;
          fg.gArm = u < 0 ? 0
            : CHAT.gest * ease * sat(u / GEST.up)
              * (1 - sat((u - GEST.up - GEST.hold) / GEST.down));
          // Which arm: the one on the side they are turned toward, the same
          // rule the greeting uses and for its reason — greeting somebody on
          // your left with your right hand is a gesture across your own chest.
          fg.gArmL = fg.lookY > 0;
        } else fg.gArm = 0;
      }
    }

    // The chins, which live on a mesh rather than on a person.
    sweepNods(crowds);

    // ── and now and then, a few people fall into talking ────────────────────
    clk += dt;
    if (clk < CHAT.every) return;
    clk = 0;
    if (groups.length >= CHAT.live) return;
    if (Math.random() >= CHAT.odds) return;
    const pool = [];
    const rr = CHAT.see * CHAT.see;
    for (const k in crowds) {
      for (const fg of crowds[k].live()) {
        const dx = fg.x - who.x, dz = fg.z - who.z;
        if (dx * dx + dz * dz > rr) continue;
        if (freeToChat(fg)) pool.push(fg);
      }
    }
    const g = findGroup(pool);
    if (g) open(g);
  }

  /**
   * Put every nod on the mesh that is drawing it, and take every other one off.
   *
   * THE MESH OUTLIVES THE PERSON ON IT. A roving slot changes hands whenever
   * you walk down the beach — `assign` in 42-crowd.js — and `rebind` there
   * clears `head` and `chest` and knows nothing about `neck`, so a delta left
   * standing is the next occupant of that slot arriving with their chin on
   * their chest and keeping it there. The same hazard `dropHold` exists for,
   * and answered the same way: walk the pairs every frame and clear anything
   * that is not being written this frame.
   *
   * Cheap. It is the twenty-four terrace figures plus the eight rovers, one
   * property read each in the common case, and only a hand-off actually walks
   * a bone list.
   */
  function sweepNods(crowds) {
    const skin = crowds && crowds.skin;
    if (!skin || !skin.pairs) return;
    const pairs = skin.pairs();
    for (let i = 0; i < pairs.length; i++) {
      const fg = pairs[i][0], f = pairs[i][1];
      if (!f) continue;
      const want = fg && fg.chat && fg.nod > 0 && !fg.phone ? fg.nod : 0;
      const had = nodOn[i] || 0;
      if (want === 0 && had === 0) continue;
      // Down and not up: `holdPhone` tips a reader's chin with (0, 0, -1) and
      // the rig's own convention says why — see the note over `NOD`.
      f.aim('neck', 0, 0, -1, want);
      nodOn[i] = want;
    }
  }
  const nodOn = [];

  return {
    step,
    hail,
    /** Whether this person is in a conversation, for `freeToGreet`'s use. */
    busy: (fg) => !!fg.chat,
    /**
     * Who is talking to whom, and how many have.
     *
     * `n`, `turns` and `said` are the three numbers the whole thing is tuned
     * against and the only way to see them is to step the sim and read them:
     * standing on the promenade waiting to catch a conversation is not a
     * measurement. `by` is which poses actually pair up, which is what decides
     * whether the walker handling earns its place.
     */
    stats: (cam) => ({
      n: nGroup, turns: nTurn, said: nSaid, nods: nNod, live: groups.length,
      // COPIED, both of them. A probe that reads this and then forces a
      // conversation in the same expression gets a `by` that has already been
      // written to by the thing it was meant to be the "before" of — which is
      // exactly what happened, and it looked like a group being counted twice.
      clock: +clock.toFixed(1), by: { ...byMode }, say: sayLog.slice(),
      groups: groups.map((G) => ({
        t: +G.t.toFixed(2), dur: +G.dur.toFixed(1), turn: G.turn,
        spk: G.who[G.spk].idx, walk: G.walk,
        apart: +Math.hypot(G.who[0].x - G.who[1].x,
          G.who[0].z - G.who[1].z).toFixed(2),
        who: G.who.map((fg) => ({
          idx: fg.idx, mode: fg.mode,
          look: +(fg.look || 0).toFixed(3),
          lookY: +(fg.lookY || 0).toFixed(3),
          nod: +(fg.nod || 0).toFixed(3),
          arm: +(fg.gArm || 0).toFixed(3),
          d: cam ? +Math.hypot(fg.x - cam.x, fg.z - cam.z).toFixed(1) : null,
          w: [+fg.x.toFixed(1), +fg.y.toFixed(2), +fg.z.toFixed(1)],
          // And in the shore's own frame, which is what a probe can actually
          // stand at: `__fr.jad.stand(t - 8, s, 0.79)` puts a camera eight
          // metres down the promenade from a conversation, looking at it. The
          // world triple cannot do that — there is no hook that takes one —
          // and hunting for the right station by sweeping the yaw is how the
          // first frames of this were shot, which cost four runs.
          ts: [+fg.t.toFixed(1), +(fg.lane + (fg.off || 0)).toFixed(1)],
          yaw: +fg.yaw.toFixed(3),
        })),
      })),
    }),
    /**
     * Start one, here, now, for a photograph.
     *
     * A conversation lasts up to forty-six seconds and starts at most every six,
     * somewhere on four hundred metres of shore, so the odds of a probe standing
     * in the right place at the right moment are not good enough to shoot
     * against. This picks the NEAREST group to you that passes the same tests
     * `findGroup` applies and opens it through the same `open`, so what a frame
     * shows afterwards is the real thing and not a private copy of it.
     */
    now: (crowds, cam, mode) => {
      const pool = [];
      for (const k in crowds) {
        for (const fg of crowds[k].live()) {
          const dx = fg.x - cam.x, dz = fg.z - cam.z;
          if (dx * dx + dz * dz > CHAT.see * CHAT.see) continue;
          if (mode && fg.mode !== mode) continue;
          if (freeToChat(fg)) pool.push(fg);
        }
      }
      pool.sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z)
        - Math.hypot(b.x - cam.x, b.z - cam.z));
      const g = findGroup(pool, 0);
      // WHY NOT, and it is not tidiness. Every test in `pairOk` fails silently
      // and the three of them fail for completely different reasons — nobody
      // eligible, everybody too far apart, everybody facing the sea — and from
      // outside all three look identical: a beach with nobody talking on it.
      // The first cut of this file found NO group anywhere at t 280 and it
      // took this to find out that the cause was the third: bathers on a
      // promenade face the water, not each other.
      if (!g) {
        let close = 0, best = null;
        for (let i = 0; i < pool.length && i < 40; i++) {
          for (let j = i + 1; j < pool.length && j < 40; j++) {
            const a = pool[i], b = pool[j];
            const dd = Math.hypot(a.x - b.x, a.z - b.z);
            if (dd > CHAT.far || dd < CHAT.min) continue;
            close++;
            const w = Math.max(Math.abs(dep.aim(a, b.x, b.z)),
              Math.abs(dep.aim(b, a.x, a.z)));
            if (!best || w < best.w) {
              best = { a: a.idx, b: b.idx, apart: +dd.toFixed(2),
                w: +w.toFixed(2) };
            }
          }
        }
        return { pool: pool.length, closeEnough: close, bestPair: best };
      }
      const G = open(g);
      return G.who.map((fg) => ({
        idx: fg.idx, mode: fg.mode,
        d: +Math.hypot(fg.x - cam.x, fg.z - cam.z).toFixed(2),
        w: [+fg.x.toFixed(1), +fg.y.toFixed(2), +fg.z.toFixed(1)],
        ts: [+fg.t.toFixed(1), +(fg.lane + (fg.off || 0)).toFixed(1)],
        yaw: +fg.yaw.toFixed(3),
      }));
    },
    /**
     * Every pair on this stretch, as `[metres apart, the worse bearing]`.
     *
     * The one measurement the whole file's geometry is set from, and it exists
     * because the three tests in `pairOk` all fail SILENTLY and all fail
     * identically from outside: a beach with nobody talking on it looks the
     * same whether nobody is eligible, everybody is too far apart, or everybody
     * is facing the sea. The first cut of this file found no group anywhere at
     * any station and it was this that said which of the three it was — see the
     * table over `near`, which is this hook's output.
     *
     * `grid` counts how many pairs would pass at a spread of (near, arc), so a
     * threshold can be moved with the count in front of you rather than by
     * rebuilding and watching. `seps` is the raw list, worst-bearing first,
     * which is where the shape of the beach actually shows.
     */
    survey: (crowds, cam) => {
      const pool = [];
      for (const k in crowds) {
        for (const fg of crowds[k].live()) {
          const dx = fg.x - cam.x, dz = fg.z - cam.z;
          if (dx * dx + dz * dz > CHAT.see * CHAT.see) continue;
          if (freeToChat(fg)) pool.push(fg);
        }
      }
      const NR = [2.0, 3.0, 4.5, 6.0], AR = [0.8, 1.15, 1.25, 1.6, 2.0, 3.2];
      const grid = {};
      const seps = [];
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const a = pool[i], b = pool[j];
          const dd = Math.hypot(a.x - b.x, a.z - b.z);
          if (dd < CHAT.min || dd > 6.0) continue;
          const w = Math.max(Math.abs(dep.aim(a, b.x, b.z)),
            Math.abs(dep.aim(b, a.x, a.z)));
          seps.push([+dd.toFixed(2), +w.toFixed(2)]);
          for (const nr of NR) {
            for (const ar of AR) {
              if (dd <= nr && w <= ar) {
                const key = nr + '/' + ar;
                grid[key] = (grid[key] || 0) + 1;
              }
            }
          }
        }
      }
      const modes = {};
      for (const fg of pool) modes[fg.mode] = (modes[fg.mode] || 0) + 1;
      return { pool: pool.length, modes, grid,
        seps: seps.sort((a, b) => a[1] - b[1]).slice(0, 14) };
    },
    /** Say one line on demand, so the synth can be recorded on its own. */
    sayNow: (kind, key, d) => (audio && audio.chat
      ? audio.chat(kind, key, d, 0.5) : false),
    lines: () => Object.keys(CHAT_LINES),
  };
}
