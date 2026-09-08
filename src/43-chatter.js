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
//
// ══ AND THEN THE REQUIREMENT MOVED ═══════════════════════════════════════════
//
// Everything above stands and none of it was wrong. One of its premises is no
// longer true, which is a different thing, and it is worth being exact about
// which one.
//
// Misha, 8 Sep 2026: *"when the bathers are chatting amongst themselves, ok it
// doesn't have to be within 12 words, but i am thinking, maybe you can
// pre-render some of their conversations, pre-cache some of it, and when i
// sorta approach within an 'ears-shot' of them, that's when their convo becomes
// audible, perhaps not SUPER LOUD, but yeah audible, and this way, it sounds
// the most natural... there's no pause betwixt their chatter and it feels super
// organic."*
//
// The case against recorded speech, three tables up, rests on one sentence:
// ambient chatter is "many speakers, constantly, saying nothing in particular".
// He has just asked for them to be saying something IN PARTICULAR and to be
// able to make it out. Every clause of the old argument still holds for what it
// was written about — a murmur across four hundred metres of shore does want a
// synthesiser, and the voice service still cannot be used, for the reason it
// could never be used: three to six seconds of model call and speech synthesis
// is fatal for a conversation that is supposed to be ALREADY HAPPENING when you
// walk up. You would arrive, stand there, and hear it start.
//
// So the argument is not overturned, it is BOUNDED, and there are now two of
// them with a distance between them:
//
//   FAR   the synth below, unchanged. No payload, never the same twice, and it
//         carries every conversation on the shore that you are not close to.
//   NEAR  fifteen conversations baked by `tools/cut_chat.py` in the eight
//         bathers' own ElevenLabs voices, played from the mouth of whoever is
//         holding the floor. See `WORDS`.
//
// WHY THE SPLIT IS THE DESIGN AND NOT A COMPROMISE. The bark clips' lesson is
// still the governing one — "sixteen clips is sixteen clips, and the ear finds
// the period inside a minute" — and the library is fifteen. What saves it is
// that the library is only ever spent on a conversation you can actually make
// out. Measured, walking at 1.35 m/s for 900 s and logging every group's
// closest approach and how long it stayed inside it:
//
//     within        conversations   of those, a pass      one every
//                   that came in    lasting over 3 s
//      6 m               4                3               5.0 min
//      8 m               4                4               3.8
//     10 m               7                6               2.5
//     12 m              10                9               1.7
//     14 m              20               17               0.9
//     16 m              25               20               0.8
//     20 m              34               28               0.5
//
// The whole shore produces a conversation every 15 s. Eleven metres produces
// one every two minutes, and THAT is the rate the library is spent at. So
// eleven is a number tuned for recurrence, and the sound was checked against it
// afterwards rather than the other way round — see `WORDS.on`.
//
// ── AND THE HONEST ANSWER ABOUT FIFTEEN ──────────────────────────────────────
//
// That table is the promenade EDGE, at s 2, and it is the kindest lane on the
// beach. Four half-hour walks, one at each of s 2, 6, 10 and 14, every line
// played logged as it was played:
//
//                  conversations   of the   lines    of those  the same LINE
//     lane          heard   /min      15    played     unheard   heard again
//     s  2            17    0.57       9        55        82 %      12.9 min
//     s  6            30    1.00      12        78        85 %      12.3
//     s 10            46    1.53      14       117        74 %       6.2
//     s 14            47    1.57      15       118        74 %       6.4
//
// Out on the sand a player passes THREE TIMES as many conversations as at the
// water's edge, and all fifteen come round inside half an hour. So the plain
// answer to "is fifteen enough" is: fifteen conversations are not, and fifteen
// conversations are not what a player hears. What they hear is 135 lines, of
// which three or four go past in the ten seconds a pass lasts, and the number
// that decides whether a repeat registers is how long before the same SENTENCE
// comes round — six minutes at worst, thirteen at best, with 74 to 85 per cent
// of everything heard in half an hour being something not heard before.
//
// That is what `nextK` buys and it is the whole reason it exists. Without it a
// second hearing overlapped the first by 44 to 62 per cent and the repeat was
// the same words.
//
// If the library is ever allowed to grow, it goes in a straight line: thirty
// conversations would put the first repeated sentence at twelve to twenty-six
// minutes. And it should grow where the misses are rather than evenly — see
// `CHAT_CLASS`.
//
// ── ONE MEASUREMENT DECIDED THE SHAPE OF EVERY SCRIPT ────────────────────────
//
// 234 conversations over four lanes: 230 pairs and FOUR threes, and all four of
// the threes were out on the sand rather than on the promenade, where 106 of
// 106 were pairs. `findGroup` will build a three — it looks for somebody
// standing with BOTH of the first two — and on the concrete nobody ever is,
// because separate groups sit 3 to 6 m apart and the third person is always
// somebody else's.
//
// So every baked script is two-handed and strictly alternating, which is
// exactly what `nextTurn` already does to a pair: following the script changes
// nothing at all about who speaks. The 1.7 per cent that are threes are cast by
// nobody and stay on the synth, which is what they sounded like yesterday.
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
  if (!ctx || !io || !io.out || chatMuted) return false;
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

// ── and the other half: fifteen conversations, already going on ──────────────
/**
 * The library, off the payload, or nothing at all.
 *
 * `chatidx.json` is written by `tools/cut_chat.py` and inlined verbatim by
 * build.py, so this is a plain object and not a string to parse. A build whose
 * payload has been stripped leaves `CHAT_LIB` null and every conversation on
 * the beach on the synth, which is what shipped before this and is a game that
 * is quieter rather than a game that is broken — the same rule `sampleLoad`
 * states for every other baked clip.
 */
const CHAT_LIB = (typeof PAYLOAD !== 'undefined' && PAYLOAD.chatidx)
  ? PAYLOAD.chatidx : null;

/**
 * Which voices may stand in for which.
 *
 * Every line is baked in ONE bather's voice, so a script can only be played by
 * a group whose people match its cast — and fifteen scripts cannot cover the
 * thirty-six pairs eight kinds can make. This is where the slack is, and where
 * it is NOT.
 *
 * Two kinds are interchangeable if they are the same sex and the same age. The
 * young men are Harry and Liam and the young women are Jessica and Niamh: a
 * young man in the other young man's voice is a young man, and nobody who has
 * heard one of them yelp can tell you which of the two hosed figures it was. A
 * nine-year-old in a seventy-year-old's voice is a defect, and that is exactly
 * where the line is drawn — the two children, the old woman and the old man are
 * each alone in their class and can only ever be themselves.
 *
 * The runtime still prefers an EXACT kind match and only falls back to the
 * class — see `pickConv`. What the class buys is coverage: counted over four
 * half-hour walks, the seven class pairs the fifteen scripts are written for
 * account for 75, 87, 89 and 90 per cent of the groups that came inside
 * `WORDS.on`. The rest never get words and stay on the synth, which is what
 * that group sounded like yesterday.
 *
 * WHAT IS MISSED, in order of how often, because this is the list to work down
 * if the library ever grows: an old man with an old woman, two young women, two
 * old women, a child with an adult, two old men, and the 1.7 per cent that are
 * threes. None of them is worth a script before the crowded pairings have more
 * than four between them — see the recurrence table in the header, which says
 * the shortage is depth on the common pairs and not breadth across the rare
 * ones.
 */
const CHAT_CLASS = {
  girl_child: 'girl',
  boy_child: 'boy',
  woman_young_slim: 'womanY',
  woman_young_full: 'womanY',
  woman_old: 'womanO',
  man_young_fit: 'manY',
  man_young_lean: 'manY',
  man_old_heavy: 'manO',
};

/**
 * How near you have to be for a murmur to turn into words, and how loud it is
 * when it does.
 *
 * ── the two radii, and why `on` is a recurrence number and not a level ──
 *
 * `on` is the one number that decides whether fifteen conversations is enough.
 * The rate at which the library is spent is the rate at which a player comes
 * inside this radius, and the table in the header is that rate against the
 * radius: eleven metres is one conversation every two minutes, and sixteen is
 * one every fifty seconds. Between those two the bag of fifteen empties in
 * thirty minutes or in twelve.
 *
 * Eleven, then, and it was chosen against the recurrence and then CHECKED
 * against the sound rather than the other way round: at 11 m this is 12.1 dB
 * down and behind a 3.9 kHz lid, which is a voice you can tell is a voice and
 * are only catching about half the words of — so the boundary is not a moment
 * where a murmur becomes a transcript, it is a moment where a murmur starts to
 * have words in it. Which is what walking towards two people actually does.
 *
 * `off` at fifteen is hysteresis and nothing more. Without a gap a player
 * standing at the boundary flips between a recorded voice and a synthesised one
 * every turn, and those two do not sound like the same person.
 *
 * `warm` is neither. It is where the conversation is CHOSEN and its clip asked
 * for, twenty-four metres out, and it is here because of `beadWarm`'s lesson in
 * 80-audio.js: "a decode that starts when the sound is wanted is a sound that
 * is missing the first time it is asked for". At 1.35 m/s, twenty-four metres
 * is ten seconds of walking, and a decode takes forty milliseconds. Choosing
 * early costs nothing — a conversation is not marked as heard until somebody
 * has actually heard two lines of it, so a group you never reach spends
 * nothing.
 *
 * ── the level, which is the thing he asked for ──
 *
 * `gain` and `half` are set TOGETHER and not independently, and the pair of
 * them is one decision: they are the two numbers that make this louder than the
 * synth up close and EXACTLY EQUAL TO IT at the boundary. Solve
 * `gain·far(11) = CHAT_LEVEL.gain·farSynth(11)` and the crossing is silent —
 * the only thing that changes as you step over eleven metres is which of the
 * two is talking, and at eleven metres both are behind the same 3.9 kHz lid.
 * Get this wrong and the boundary is a step in loudness, which is the one thing
 * in a crossfade the ear cannot be talked out of hearing.
 *
 * That leaves one free number, which is how much louder than the synth this is
 * when you are standing in it, and that is the whole of his *"perhaps not SUPER
 * LOUD, but yeah audible"*. 0.62 and 3.8 make it +3.84 dB on the synth at 3 m,
 * +0.31 at eleven, and −0.83 by twenty-two — so it is louder exactly where it
 * has to be understood and QUIETER than what it replaced everywhere else. The
 * vikendica's own bird question is answered by that last column before any
 * measurement: the living room is 22 m from the nearest conversation and this
 * is never scheduled past `off` at fifteen, so the indoor path is the synth it
 * always was, unchanged, and the 0.07 dB in the header still stands verbatim.
 *
 * MEASURED, and not by two recordings — the bed drifts 4.35 dB between
 * ten-second windows, so the phases are INTERLEAVED, five cycles of eight
 * ten-second blocks with 3.5 s of guard at the head of each so a reverb tail
 * cannot be counted as the block after it. About 980 windows a phase, on an
 * AnalyserNode on `audio.tap()`, at t 280 s 2 against a bed of −33.82 dBFS:
 *
 *     one voice every 2.9 s at  3 m, recorded     +2.62 dB on the bed
 *     one voice every 2.9 s at  3 m, synthesised  +0.75
 *     one voice every 2.9 s at 11 m, recorded     +0.82
 *     one voice every 2.9 s at 11 m, synthesised  −0.42
 *     the four control blocks                     −0.48 … +0.37
 *
 * The last row is the method's own floor, 0.85 dB, and it is the number the
 * other four have to be read against. Two things follow. The recorded voice at
 * three metres is 2.6 dB over a beach that has a crowd already recorded into
 * it, which is audible and is not shouting. And ACROSS THE BOUNDARY the two
 * voices land 1.2 dB apart — inside a decibel and a half of the control's own
 * spread — so stepping over eleven metres is not a step in loudness.
 *
 * ── AND IT DOES NOT TOUCH THE BIRDS ──────────────────────────────────────────
 *
 * The same run, per band, for the loudest case there is — standing three metres
 * from two people and never letting the voice stop:
 *
 *      60   120   250   500   900  1600  2800 | 4600  7000  11000
 *    +0.28 +4.80 +4.73 +2.91 +1.26 +2.74 +4.53| −0.04  0.00  −2.10
 *
 * Everything the voice adds is between 120 Hz and 4.6 kHz, which is where a
 * voice is. THE TWO BANDS THE BIRDS LIVE IN DO NOT MOVE: 4.6-7 kHz by −0.04 dB
 * and 7-11 kHz by nothing at all, against a control that cannot resolve better
 * than 0.85. That is structural rather than lucky — `cut_chat.py` lids every
 * clip at 6 kHz before the encoder sees it, because `lpNear` throws that band
 * away anyway, so there is nothing up there for it to add. The swallow's
 * twitter runs to 11 kHz and the wagtail's call is nothing but top, and neither
 * of them is being competed with by a sound that stops at six.
 *
 * Confirmed a second way, three separate thirty-second recordings through
 * `tools/sfx.mjs` off the same tap, against a control taken with `chatMute`:
 * the far murmur reads +0.96 dB overall and −0.06/−0.12 in those two bands; the
 * close words read +3.54 dB overall and +0.22/+0.05.
 *
 * The one band that DOES move and has a bird in it is 500-900 Hz, up 2.9 dB,
 * where the collared dove sits. Said out loud rather than left to be found: it
 * is only that loud with your ear three metres from two people on the promenade
 * at t 280, which is fifty metres from the dove's pine at t 243 s 46, where its
 * own distance term is 0.202 and it coos once every twenty-two to seventy-four
 * seconds. The place that bird is the loudest thing is the living room, and
 * this voice does not go in there at all.
 *
 * ── the pace ──
 *
 * `gap` is what goes between one line and the next answering it, and it is
 * short on purpose: *"there's no pause betwixt their chatter"*. Two hundred
 * milliseconds is the median gap between turns in a real conversation in every
 * language anybody has measured, and the spread up to half a second is what
 * stops it being a metronome. It is scheduled here rather than baked into the
 * file for exactly that reason — a pause inside an mp3 cannot be shortened when
 * somebody answers quickly.
 *
 * `floor` is this voice's own version of `CHAT.floor`, and it is a twelfth of
 * it. That number exists so three murmurs at once are a promenade and not a
 * party; a conversation you are standing next to must never have a line
 * swallowed because somebody twenty metres away said something first. So a
 * scripted line is barred by almost nothing, and a murmur is still barred by
 * `CHAT.floor` from landing on top of one.
 *
 * `entry` is how many lines in a player may join, and it is the cheapest
 * variety in the whole design. Nine lines with seven possible entry points, and
 * a dwell of about ten seconds meaning three or four lines are actually heard,
 * is a conversation whose second hearing usually overlaps its first by nothing
 * at all. It is also the honest answer to his own words: you are not meant to
 * hear it start.
 *
 * `keep` is how many lines have to have been HEARD before a conversation counts
 * as used up. Two. A player who caught one line and walked on has not heard
 * that conversation in any sense a repeat could spoil, and spending a fifteenth
 * of the library on it is the difference between a bag that lasts half an hour
 * and one that lasts twenty minutes.
 */
const WORDS = {
  on: 11,
  off: 15,
  warm: 24,
  // 0.62 with `half` 3.8 — see above; the pair is one decision. 0.62 is also,
  // by coincidence worth noting rather than relying on, the radio's own gain.
  gain: 0.62,
  half: 3.8,
  roll: 1.5,
  // The same two numbers the synth uses, because it is the same promenade and
  // the same air. A voice at thirty metres over open concrete has no sibilance
  // left; at arm's length it has all of it.
  lpNear: 6000,
  lpFar: 1450,
  verb: 0.12,
  gap: [0.18, 0.55],
  floor: 0.07,
  entry: 6,
  keep: 2,
};

/** One conversation's decoded buffer, and the alignment it came back with. */
const wordBuf = {};

/**
 * The control run's switch, and it earns its place in shipping code for the
 * same reason `songMuted` in 80-audio.js does.
 *
 * The question this whole voice has to answer — does it bury the birds — cannot
 * be answered from one recording, because the place it is asked about is never
 * silent: there is a field recording of this promenade underneath it, a
 * hillside of cicadas, four birds on their own clocks and other people talking
 * further down the shore. What settles it is the SAME thirty seconds with one
 * voice taken out, and every other way of getting that control — a second
 * build, a git stash, a hand-edited gain — is a different page, and a different
 * page is a different answer.
 *
 * It stops BOTH halves, the synth and the recordings, because half a control is
 * not one. It is off, the game never writes it, and `__fr.jad.chatMute` is the
 * only thing that touches it.
 */
let chatMuted = false;

/**
 * Ask for a conversation's clip, and work out where its lines really are.
 *
 * THE OFFSETS IN THE INDEX ARE NOT TRUSTED, and the note over `cut_chat.py`'s
 * `find_gaps` has the measurement: whether an mp3 decoder honours the gapless
 * tag and eats the encoder's 1 105-sample delay is not a property of the
 * decoder. Sweeping sixteen settings through one build of ffmpeg, the delay
 * appeared and vanished with the BITRATE — 92 ms at 12 kHz 24k and nothing at
 * all at 12 kHz 32k. There is no constant to hard-code and no reason to believe
 * Chrome does whatever ffmpeg did, and a table that is 92 ms out clips the
 * first consonant off every line in the library.
 *
 * So the tool writes down where the first line began in ITS decode, and this
 * finds the first line again in the browser's, and everything else moves by the
 * difference. One scan of a few thousand samples, once per conversation, and it
 * is correct for any decoder whatever it does with the tag.
 */
function wordsWarm(ci) {
  if (!CHAT_LIB || wordBuf[ci] !== undefined) return;
  const C = CHAT_LIB.conv[ci];
  if (!C || !audio || !audio.chatLoad) return;
  // Marked as asked-for before the call, so a decode in flight is not asked for
  // again sixty times a second — `sampleTried`'s reason, one level up.
  wordBuf[ci] = null;
  audio.chatLoad(C.key, (buf) => {
    const d = buf.getChannelData(0);
    // Only as far as the delay could possibly have pushed it. A quarter of a
    // second past where the tool found it is four times the largest delay in
    // that sweep, and stopping there means a clip that somehow decoded to
    // silence falls back to the baked table instead of scanning 24 s of it.
    const n = Math.min(d.length,
      Math.ceil((C.at0 + 0.25) * buf.sampleRate));
    const thr = CHAT_LIB.onset;
    let i = 0;
    while (i < n && Math.abs(d[i]) <= thr) i++;
    wordBuf[ci] = { buf, shift: i < n ? i / buf.sampleRate - C.at0 : 0 };
  });
}

/**
 * One recorded line, out of one conversation, from one person's mouth.
 *
 * The counterpart of `chatSay` and deliberately the same shape: the same
 * distance law, the same lid, the same reverb send, the same bus. What is
 * different is only that the mouth is a recording instead of three bandpasses,
 * and that is the point — the two have to be interchangeable at eleven metres
 * or the crossover is audible.
 *
 * `rate` is a fifteenth of a semitone either side of one, keyed on the
 * speaker's own seed so a given figure always sounds like themselves. It is not
 * for variety across hearings — the entry point does that — it is so that two
 * different pairs playing the same script are two different pairs. Narrow, for
 * `bark`'s reason: past a few per cent this stops being a person and starts
 * being a tape speed.
 */
function chatWords(ctx, io, buf, off, dur, d, seed) {
  if (!ctx || !io || !io.out || !buf || chatMuted) return false;
  const far = 1 / (1 + Math.pow(Math.max(d, 0.1) / WORDS.half, WORDS.roll));
  const t0 = ctx.currentTime + 0.015;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.985 + seed * 0.030;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  // 0.4, and it is DECIBELS. A lowpass biquad's Q is read in dB by the Web
  // Audio spec where a bandpass's is not, so 0.7 here would be a resonance and
  // not a Butterworth — the same trap `chatSay` and half of 80-audio.js are
  // written against.
  lp.Q.value = 0.4;
  lp.frequency.value = WORDS.lpFar
    + (WORDS.lpNear - WORDS.lpFar) * Math.pow(far, 0.55);
  const g = ctx.createGain();
  g.gain.value = WORDS.gain * far;
  src.connect(lp).connect(g).connect(io.out);
  if (io.verb) {
    const w = ctx.createGain();
    w.gain.value = WORDS.verb * far;
    g.connect(w).connect(io.verb);
  }
  // A slice of the buffer and not the whole of it: `start(when, offset,
  // duration)` is one node and no seek, which is the entire reason the fifteen
  // ship as fifteen files rather than as a hundred and thirty-five.
  src.start(t0, Math.max(0, off), dur);
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
   * THE BAG, which is the whole of the answer to "fifteen clips is fifteen
   * clips".
   *
   * A conversation index against the clock at which somebody last actually
   * heard it. Not a boolean, because the number is what makes the ordering work
   * once they have all been heard: `pickConv` prefers unheard, then an exact
   * voice match, and among equals the one that has been unheard LONGEST. So the
   * fifteen come out in a shuffled order with nothing repeating until the pool
   * a group can draw from is exhausted, and then in order of age — which is the
   * longest possible interval between two hearings of the same one, by
   * construction rather than by luck.
   *
   * Written only when `WORDS.keep` lines of it have been played to somebody.
   * Choosing a conversation costs nothing; being overheard is what spends it.
   */
  const spent = {};
  /**
   * WHERE THE LAST PERSON TO OVERHEAR THIS CONVERSATION GOT TO IN IT.
   *
   * The bag decides how long before a conversation comes round again; this
   * decides whether you can TELL when it does, and it turned out to matter
   * more. Measured over three half-hour walks along the beach itself rather
   * than the promenade edge, a player passes 1.2 to 1.5 conversations a minute
   * — three times the rate at the water's edge — so fifteen come round in
   * minutes however they are shuffled, and the interval alone cannot save it.
   *
   * But a pass only lasts about ten seconds, which is three or four lines of
   * nine. So the second hearing does not have to be the same three or four.
   * Starting it where the last one stopped means the first three passes at a
   * conversation play lines 0-3, 4-6 and 7-8 and share NOTHING; what comes
   * round is the conversation, and what a player hears is more of it. Without
   * this, entry points chosen by hash overlapped by 40 to 80 per cent and the
   * repeat was the same words.
   *
   * It is per CONVERSATION and not per group on purpose: the point is that the
   * next pair to be overheard saying this carries on from where the last pair
   * was interrupted, which nobody can hear as anything at all.
   */
  const nextK = {};
  let nWords = 0, nCast = 0;
  // Which conversations were actually heard and when, so the recurrence
  // interval can be MEASURED over half an hour of walking rather than argued
  // about from the size of the library. Nothing in the game reads it.
  const heard = [];

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
      // The pre-rendered half, and all five are set here rather than left to
      // arrive undefined: `conv` is which of the fifteen, `role` which way
      // round the cast sits on these two, `k` the line, `on` whether it is
      // words rather than a murmur at this instant, and `heard` how many lines
      // somebody has actually been close enough to hear. `d` is the group's
      // distance, written every frame by `step`.
      conv: null, role: 0, k: -1, on: false, heard: 0, d: 1e9,
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
   * Which of the fifteen these two are having, if any of them is theirs.
   *
   * Returns true if this group now has a script. Called at `WORDS.warm`, which
   * is twenty-four metres and ten seconds of walking before anything is heard,
   * so that the decode has landed by the time it is wanted.
   *
   * THE ORDER OF PREFERENCE IS THE WHOLE FUNCTION and every step of it is
   * about the fifteen going as far as they can:
   *
   *   1. the cast must match by CLASS, either way round. A script is strictly
   *      alternating, so which of the two speaks its first line is free, and
   *      allowing both orders doubles what fifteen scripts can be cast onto.
   *   2. unheard beats heard, which is the bag.
   *   3. an exact kind match beats a class match, so a Harry script goes to
   *      Harry while there is one going.
   *   4. and among equals, whichever has gone unheard longest.
   *
   * A conversation another live group already holds is skipped outright. Two
   * groups within earshot at once is rare — the survey saw at most one — but
   * two people on one bench and two on the next having word for word the same
   * conversation is the single most damning thing this could do, and it is one
   * comparison to make it impossible.
   */
  function pickConv(G, not) {
    if (!CHAT_LIB || G.who.length !== 2) return false;
    const ka = dep.voice(G.who[0]), kb = dep.voice(G.who[1]);
    const ca = CHAT_CLASS[ka], cb = CHAT_CLASS[kb];
    if (!ca || !cb) return false;
    const n = CHAT_LIB.conv.length;
    // Scanned from an offset that depends on who these two are, so that ties —
    // and at the start of a session everything is a tie — do not always fall to
    // conversation zero. `findGroup` scans from an offset for the same reason.
    const o = (chatJit(G.who[0].idx * 31 + G.who[1].idx, 3313) * n) | 0;
    let best = -1, bestScore = -1, bestAt = 0, bestRole = 0;
    for (let i = 0; i < n; i++) {
      const ci = (o + i) % n;
      if (ci === not) continue;
      const C = CHAT_LIB.conv[ci];
      const c0 = CHAT_CLASS[C.cast[0]], c1 = CHAT_CLASS[C.cast[1]];
      let role = 0;
      if (c0 === ca && c1 === cb) role = 1;
      else if (c0 === cb && c1 === ca) role = 2;
      if (!role) continue;
      let taken = false;
      for (const H of groups) if (H !== G && H.conv === ci) taken = true;
      if (taken) continue;
      const exact = role === 1 ? (C.cast[0] === ka && C.cast[1] === kb)
        : (C.cast[0] === kb && C.cast[1] === ka);
      const at = spent[ci];
      const score = (at == null ? 4 : 0) + (exact ? 2 : 0);
      if (score > bestScore
        || (score === bestScore && at != null && at < bestAt)) {
        best = ci; bestScore = score; bestAt = at == null ? 0 : at;
        bestRole = role;
      }
    }
    if (best < 0) return false;
    G.conv = best;
    G.role = bestRole;
    G.heard = 0;
    // WHERE THEY ARE UP TO WHEN YOU ARRIVE.
    //
    // Where the last person to overhear this one stopped, if anybody has — see
    // `nextK`, which is what actually keeps fifteen from sounding like fifteen.
    // Otherwise a hash, so that the first hearing of the day is not line zero
    // either: you are never meant to hear one start.
    //
    // The hash is keyed on `nGroup` and not only on who these two are, because
    // the same pair meets on the same stretch of promenade five times in a
    // quarter of an hour and keyed on their indices alone they would join at
    // the same line every time. `nGroup` moves every time anybody anywhere on
    // the beach starts talking, which makes it the shore's own clock.
    const lines = CHAT_LIB.conv[best].lines.length;
    const span = Math.min(WORDS.entry, Math.max(1, lines - 2));
    G.k = nextK[best] != null ? nextK[best]
      : (chatJit(G.who[0].idx + nGroup * 13, 9127) * span) | 0;
    G.k -= 1;                       // `nextTurn` steps on to it
    nCast++;
    wordsWarm(best);
    return true;
  }

  /** Whose mouth line `k` of the script comes out of. */
  function spkOf(G, k) {
    return (k % 2 === 0) === (G.role === 1) ? 0 : 1;
  }

  /**
   * Hand the floor to somebody else.
   *
   * Never to the same person twice running in a group of two, which would be a
   * monologue; in a group of three it is allowed once in five, because somebody
   * carrying on after a pause is a real thing and a strict round robin is the
   * most machine-like pattern there is.
   *
   * A GROUP WITH A SCRIPT IS DRIVEN BY THE SCRIPT INSTEAD, and for a pair that
   * is not a change: a script alternates and so does `1 - G.spk`. It is written
   * as a branch rather than left to coincide because a three would need it, and
   * because a turn's LENGTH does change — it becomes the length of the line
   * that is about to be said plus a beat, which is the only honest way to have
   * somebody finish a sentence before the next person starts one.
   */
  function nextTurn(G) {
    const n = G.who.length;
    let s;
    if (G.conv != null) {
      const L = CHAT_LIB.conv[G.conv].lines;
      G.k = (G.k + 1) % L.length;
      // Round the end of the script and still standing there. Nine lines is
      // twenty-three seconds and the longest a walking player ever spent inside
      // eleven metres was twenty-one, so this is the standing-still case — and
      // hearing line one again is the worst thing in the design. So they change
      // the subject: another conversation off the bag with a cast that fits,
      // which is what two people who have finished one actually do. If there is
      // no other, it wraps, which is the least bad of the two.
      if (G.k === 0 && G.heard > 0 && pickConv(G, G.conv)) {
        G.k = (G.k + 1) % CHAT_LIB.conv[G.conv].lines.length;
      }
      s = spkOf(G, G.k);
      G.spk = s;
      G.turn++;
      nTurn++;
      G.next = G.t + CHAT_LIB.conv[G.conv].lines[G.k].d + WORDS.gap[0]
        + chatJit(G.who[s].idx + G.turn * 7, 331)
          * (WORDS.gap[1] - WORDS.gap[0]);
    } else {
      const r = chatJit(G.who[0].idx * 17 + G.turn, 1213);
      s = G.spk;
      if (n === 2) s = 1 - G.spk;
      else if (r < 0.20) s = G.spk;
      else s = (G.spk + 1 + ((r * 100) | 0) % (n - 1)) % n;
      G.spk = s;
      G.turn++;
      nTurn++;
      G.next = G.t + CHAT.turn[0]
        + chatJit(G.who[s].idx + G.turn * 7, 331) * (CHAT.turn[1] - CHAT.turn[0]);
    }
    // Whether this turn is spoken out loud, and which hand goes up if one does.
    //
    // EVERY turn is spoken once the words are on, and that is not a level
    // decision, it is what a conversation is. Under half of them are voiced at
    // a distance because a group that makes a noise every two seconds across
    // the shore is an argument; standing next to two people and hearing one
    // sentence in two is not a conversation with pauses in it, it is a
    // conversation with holes in it.
    const sp = G.who[s];
    G.say = G.on ? true : chatJit(sp.idx + G.turn * 13, 2711) < CHAT.voiced;
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
   * The line this group is up to, out of the mouth of whoever is holding the
   * floor.
   *
   * Returns false if it could not be played, and the caller RETRIES on the next
   * frame rather than marking the turn spoken — which is the difference between
   * a conversation and a conversation with a line missing out of it. The only
   * things that stop it are a clip that has not finished decoding and the
   * global floor, and both are gone within a frame or two.
   */
  function sayLine(G, who) {
    const W = wordBuf[G.conv];
    if (!W || !audio || !audio.chatWords) return false;
    if (clock - saidAt < WORDS.floor) return false;
    const L = CHAT_LIB.conv[G.conv].lines[G.k];
    if (!L) return false;
    const fg = G.who[G.spk];
    const d = Math.hypot(fg.x - who.x, fg.z - who.z);
    if (!audio.chatWords(W.buf, L.at + W.shift, L.d, d, fg.seed)) return false;
    saidAt = clock;
    nSaid++;
    nWords++;
    G.heard++;
    // Spent only once somebody has actually heard `keep` lines of it. Catching
    // one line on the way past is not hearing a conversation, and charging the
    // library a fifteenth for it is the difference between a bag that lasts
    // half an hour and one that lasts twenty minutes.
    if (G.heard === WORDS.keep) spent[G.conv] = clock;
    // And the next pair to be overheard having this conversation carry on from
    // here. See `nextK`.
    nextK[G.conv] = (G.k + 1) % CHAT_LIB.conv[G.conv].lines.length;
    if (heard.length >= 200) heard.shift();
    heard.push({ c: G.conv, k: G.k, t: +clock.toFixed(1), d: +d.toFixed(1),
      idx: fg.idx });
    if (sayLog.length >= 24) sayLog.shift();
    sayLog.push({ idx: fg.idx, key: CHAT_LIB.conv[G.conv].key + ':' + G.k,
      d: +d.toFixed(1) });
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
      // ── how far off you are, and therefore whether this has words in it ──
      //
      // The GROUP's distance and not the speaker's, and taken over the nearest
      // of them. Two people talking are up to 5.5 m apart, so measured off
      // whoever happens to hold the floor this would cross the boundary and
      // come back every time the floor changed — which is a conversation
      // switching between a recording and a synthesiser on alternate lines, and
      // those two do not sound like the same person. The LEVEL is still the
      // speaker's own distance; only the decision is the group's.
      let dd = 1e9;
      for (const fg of G.who) {
        const ax = fg.x - who.x, az = fg.z - who.z;
        const q = ax * ax + az * az;
        if (q < dd) dd = q;
      }
      G.d = Math.sqrt(dd);
      if (CHAT_LIB) {
        // Chosen and asked for well out, so the decode has landed. See
        // `WORDS.warm`, and `beadWarm` in 80-audio.js for why this is separate
        // from wanting it.
        if (G.conv == null && G.d <= WORDS.warm) pickConv(G);
        else if (G.conv != null && !wordBuf[G.conv]) wordsWarm(G.conv);
        if (!G.on && G.conv != null && G.d <= WORDS.on && wordBuf[G.conv]) {
          // Straight into it, on this frame, and not at the next turn. The
          // whole request is that there is no pause: you come inside earshot
          // and they are already talking. Waiting for the current turn to run
          // out would put up to four seconds of nothing between arriving and
          // hearing anything, which is the very gap pre-rendering exists to
          // remove.
          G.on = true;
          // AND THE CURSOR IS SET HERE AND NOT AT CASTING, which is worth the
          // paragraph because casting it there and letting it run was the first
          // version and it measurably leaked.
          //
          // The script starts running when the group is CHOSEN, twenty-four
          // metres out, so that the conversation is genuinely in progress
          // rather than waiting for you. Ten seconds of walking is three or
          // four lines, and those are lines nobody heard — so a pass that was
          // meant to begin where the last listener left off began four lines
          // past it, and the four in between were never played to anybody. Over
          // three half-hour walks that put 44 to 62 per cent of a second
          // hearing on words already heard.
          //
          // Snapping to `nextK` on the frame the words come on costs nothing —
          // nobody has heard a syllable of it yet, so there is nothing for the
          // jump to be audible in — and it is what makes the guarantee a
          // guarantee: three passes at a nine-line conversation play 0-3, 4-6
          // and 7-8 and share nothing at all.
          const nL = CHAT_LIB.conv[G.conv].lines.length;
          if (nextK[G.conv] != null) G.k = (nextK[G.conv] + nL - 1) % nL;
          G.spoke = false;
          nextTurn(G);
        } else if (G.on && (G.d > WORDS.off || !wordBuf[G.conv])) {
          // The second half of that is the safety net and not the common case:
          // a clip whose decode never landed would otherwise leave a group
          // marked as speaking words and saying nothing at all, which is the
          // one failure here that is silent in both senses. Dropping back to
          // the murmur is what a build with no payload does anyway.
          G.on = false;
        }
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
        if (G.on) {
          // Not marked spoken until it actually was — see `sayLine`.
          if (sayLine(G, who)) G.spoke = true;
        } else {
          G.spoke = true;
          speak(G.who[G.spk], who, CHAT_TALK);
        }
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
      // The pre-rendered half. `words` is how many recorded lines have been
      // played, `cast` how many groups were given a script at all, and `spent`
      // how much of the bag is gone. `heard` is the log the recurrence interval
      // is MEASURED off — every line, which conversation it came out of and
      // when — because "does fifteen repeat" is a claim about half an hour of
      // walking and cannot be settled by counting the library.
      lib: CHAT_LIB ? CHAT_LIB.conv.length : 0,
      words: nWords, cast: nCast,
      spent: Object.keys(spent).length,
      buf: Object.keys(wordBuf).filter((k) => wordBuf[k]).length,
      heard: heard.slice(),
      groups: groups.map((G) => ({
        t: +G.t.toFixed(2), dur: +G.dur.toFixed(1), turn: G.turn,
        spk: G.who[G.spk].idx, walk: G.walk,
        conv: G.conv, on: !!G.on, k: G.k, heard: G.heard,
        d: +G.d.toFixed(1),
        apart: +Math.hypot(G.who[0].x - G.who[1].x,
          G.who[0].z - G.who[1].z).toFixed(2),
        who: G.who.map((fg) => ({
          idx: fg.idx, mode: fg.mode, kind: dep.voice(fg),
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
    /**
     * Both voices off, for the control half of a measurement. See `chatMuted`.
     *
     * `__fr.jad.chatMute(1)` and then thirty seconds of the same beach is the
     * only honest "without" this thing has.
     */
    mute: (v) => { chatMuted = !!v; return chatMuted; },
    /** Say one line on demand, so the synth can be recorded on its own. */
    sayNow: (kind, key, d) => (audio && audio.chat
      ? audio.chat(kind, key, d, 0.5) : false),
    /**
     * Play one baked line on demand, at a stated distance.
     *
     * The pair to `sayNow`, and it exists for the same reason: a level cannot
     * be measured off a thing that fires when it feels like it. `wordsNow(0, 3,
     * 3)` puts line three of the first conversation three metres away, so the
     * recorded voice and the synthesised one can be recorded against the same
     * bed at the same range and differenced.
     *
     * It warms the clip and returns false until the decode lands, so a probe
     * calls it twice: once to ask, and once a moment later to hear it.
     */
    wordsNow: (c, l, d) => {
      if (!CHAT_LIB) return null;
      const C = CHAT_LIB.conv[c];
      if (!C || !C.lines[l]) return null;
      wordsWarm(c);
      const W = wordBuf[c];
      if (!W || !audio || !audio.chatWords) return false;
      const L = C.lines[l];
      return audio.chatWords(W.buf, L.at + W.shift, L.d, d == null ? 3 : d,
        0.5);
    },
    /**
     * The synth's phrase list, and the whole baked library beside it.
     *
     * `lines()` used to be twenty-six keys. It is now the two halves of this
     * file in one call, because the question a probe actually asks is which of
     * the two a given noise came out of, and `shift` is the answer to whether
     * the browser's decoder ate the encoder's delay — the one number in here
     * that could silently be wrong. See `wordsWarm`.
     */
    lines: () => ({
      synth: Object.keys(CHAT_LINES),
      words: CHAT_LIB ? CHAT_LIB.conv.map((C, i) => ({
        i, key: C.key, cast: C.cast, topic: C.topic, n: C.lines.length,
        at0: C.at0,
        shift: wordBuf[i] ? +wordBuf[i].shift.toFixed(4) : null,
        spent: spent[i] == null ? null : +spent[i].toFixed(1),
        say: C.lines.map((L) => L.t),
      })) : null,
    }),
  };
}
