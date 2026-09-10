#!/usr/bin/env python3
"""Bake the Bucketeer's Croatian, so the woman carrying the water is a local.

Misha, 8 Sep 2026: *"the bucketeer baye, don't make her talk with that
saltry/jessica voice.. instead, she should occasionally say some short things,
in croatian voice.. perhaps croatian singing voice if u can make it happen with
eleven labs!"*

THERE IS NO BUCKETEER PERSONA AND THERE NEVER WAS, which is where this tool
comes from rather than a fourth entry in `SPEAKERS`. `45-bucketeer.js` has never
held a call to the voice service; `CAST` in `49-voice.js` holds `baye`, `cat`
and `bather`; and every line he has heard from a woman by the vikendica came out
of `PERSONA` — Baye's own — because `bayeGap` answers about whichever of her two
errands you are nearer to. One woman, two errands, one persona. So "the
Bucketeer talks in Jessica's voice" is not a casting mistake in a table
somewhere, it is the shore Baye being audible on a staircase, and the fix is to
give the staircase its own channel and take the live one off it. See the note
over `MUTTER` in 80-audio.js for that half.

── WHY THIS IS BAKED, AND IT IS NOT ONLY THE LATENCY ────────────────────────

`tools/cut_chat.py` already argues most of it: a live line is a model call and
then a speech synthesis, three to six seconds back to back, and a recording pays
none of that. That argument is the same here and it is not the strongest one.

THE STRONGEST ONE IS THAT A MUTTER BELONGS TO A BEAT. Her loop is twelve legs
and about forty seconds, and the things a person says while carrying water are
each tied to one moment of it: you say "ajme" as the weight comes off the floor,
"pomalo" going down an open flight, "evo vam vode" while you are tipping it out.
A live line is ASKED FOR at one moment and ARRIVES four seconds later, by which
time she is two legs further round — so the live path can only ever produce a
line about the loop in general, said at a moment chosen by a round trip. A baked
line fires on the frame the beat starts. That is the whole difference between a
woman working and a recording of one, and no amount of tuning at runtime buys
it, because the thing being tuned is somebody else's queue.

Two more things fall out of baking and both are worth having:

  SHE TALKS WITHOUT A SESSION. `ask` in 49-voice.js returns immediately unless
  `AUTH.user && AUTH.baye`, so today the Bucketeer is silent for anybody who has
  not signed in — which is most people who open the page. The hum is not, and
  the two halves of her being audible should not disagree about that.

  THE CROATIAN CAN BE CHECKED BEFORE IT SHIPS. See the transcription check
  below. A live path could not offer that at any price: nobody hears the line
  until a player does.

── THE VOICE, AND THE COLLISION IT WALKS INTO ────────────────────────────────

Enumerated off `/v1/voices` again rather than remembered, and the answer has not
moved since `cut_chat.py` asked: 44 voices, exactly two labelled `language: hr`
— Fran (male, Zagreb) and Balkanika (female). Three more carry `hr` in
`verified_languages` while labelled English or French, which is the weaker claim
and this tool is why it is weaker. AImee, Koraly and Samara X were each given
six of the lines below and the takes sent through `/v1/speech-to-text` with
`language_code=hrv`:

    Balkanika   19 of 19 lines     exact 17,  mean WER 10.5 %
    Samara X     6 of the 19       exact  5,  mean WER 33 %
    Koraly       6 of the 19       exact  4,  mean WER 50 %
    AImee        6 of the 19       exact  2,  mean WER 60 %

and the failures are not accents, they are the wrong language: all three read
`Ajme meni` as English and came back as "I'm a many" and "I'm menu". So there is
one usable Croatian woman on this account and the casting is not a choice.

WHICH RUNS STRAIGHT INTO `woman_old`. Balkanika is already the seventy-year-old
bather, in `BATHER_VOICE` in server/baye/baye.py and in `VOICE` in
`cut_chat.py`, and she is also the whole of `chat15`. The vikendica stands at
`t` 232, `s` 25.4 — on the open frontage with the promenade in front of it — so
the woman carrying water and the old woman on the concrete are inside a minute's
walk of each other, and handing the first one the second one's voice unaltered
makes them one person.

SO SHE IS PLAYED UP THREE AND HALF A FIFTH OF A SEMITONE, AND THE NUMBER WAS
MEASURED RATHER THAN PICKED. Median f0 over the voiced frames, 40 ms windows,
autocorrelation, everything put through this file's own trim/polish/level so
that the four figures are comparable:

    Jessica, who is the Bucketeer TODAY          210.1 Hz   (5 lines)
    Balkanika, the 23 clips below, as shipped    174.5 Hz   = `woman_old`
    `hum_bucketeer.mp3`, the shipped hum         272.7 Hz

    the 23 clips at `MUTTER.rate`, +3.2 st       209.6 Hz

Two things fall out of that one number and the second is the one that matters.

    IT LANDS HER WHERE THE BUCKETEER ALREADY IS. 209.6 against Jessica's 210.1
    is four hundredths of a semitone. A player who has had this woman humming
    and talking on that staircase for a fortnight hears the same register; what
    changes is the language and the person, which is what was asked for.

    AND IT LEAVES THE HUM ALONE, CORRECTLY — which is the whole answer to the
    coherence problem this change could have created. She hums and speaks four
    seconds apart on the same flight of stairs, so a new speaking voice at a
    new pitch would have made her two women. The shipped hum sits +4.52 st over
    Jessica and +4.56 st over Balkanika played up 3.2. The interval she hums
    above her own speech is preserved to four hundredths of a semitone, and
    `hum_bucketeer.mp3` is not touched — it is byte-identical to what shipped in
    1.357.0. See `MUTTER.rate` in 80-audio.js.

Against `woman_old` that is 3.2 semitones of pitch AND a 20 per cent shorter
vocal tract, because the shift is a plain resample and moves the formants with
the pitch — the same mechanism `voice_for` uses to make two children out of two
adults, and the same one `BUCK.humDrift` uses to put her hum in a different key
every burst. It is deliberately NOT baked into the mp3: it is `MUTTER.rate` in
80-audio.js, so the payload holds Balkanika as she came and one constant decides
how far from `woman_old` she stands.

AND IT IS WELL UNDER THE CLIFF. Swept end to end — the shipped 12 kHz mp3,
resampled the way an `AudioBufferSourceNode` resamples it, transcribed. Three
passes at each shift, because the transcriber is not deterministic and the same
23 files came back 20/23 and then 16/23 on two runs of the same pass; one run
cannot choose a shift and this file was nearly written as though it could:

    +0.0 st   exact 20.0 of 23  (19/20/21)   mean WER  7.7 %  (sd 1.5)
    +2.5 st   exact 17.3        (17/18/17)   mean WER 19.1 %  (sd 0.7)
    +3.2 st   exact 18.0        (18/19/17)   mean WER 16.7 %  (sd 1.2)
    +4.0 st   exact 18.0        (18/19/17)   mean WER 14.5 %  (sd 3.3)
    +5.0 st   exact 12.0        (12/12/12)   mean WER 37.3 %  (sd 4.1)

So the whole band from 2.5 to 4.0 is one flat plateau about two lines under
unshifted, and the cliff is between +4 and +5. Inside the plateau the choice is
free on this measurement and is made on the pitch above. 3.2 is not the best
score on the plateau; it is the number that lands on Jessica, and the scores
cannot tell 2.5, 3.2 and 4.0 apart.

WHAT THE TWO LINES COST. At +3.2 the lines that fail in at least two of three
passes are `fill_sporo`, `rest_fala`, `rest_lipo`, `rest_ubime` and `up_jos`.
Two of those fail unshifted as well and are not defects: `up_jos` comes back as
"Još jedan put", which is the same words with a space in them, and `rest_fala`
comes back as "Hvala Bogu", the transcriber standardising the Dalmatian `fala`
it was given. The three the shift actually costs are a lost word apiece on
two- and three-word clips with no context to lean on. They are kept, because
"Ubi me vrućina" and "Lipo je danas" are two of the best lines here and the
instrument that dislikes them is a transcriber with a sd of a line and a half.

WHAT IS NOT SETTLED BY ANY OF THAT is whether 3.2 semitones is enough for an
EAR to hear two women rather than one. The measurement says it is — `cut_chat.py`
treats the four semitones between Fran and Bill as plainly a different man, and
this is 3.2 plus a fifth off the vocal tract. Nobody in the loop that wrote this
has heard either voice. That is written down rather than smoothed over, and
`MUTTER.rate` is one line.

── AND THE SINGING ───────────────────────────────────────────────────────────

He asked for it as a question — "if u can make it happen" — and the answer is
half yes, so the half that is no is worth stating first.

`eleven_v3` IS on this account, and so is the music endpoint; both were called,
not assumed. v3 takes audio tags and `[humming]` and `[singing]` do something
real: measured as the fraction of voiced frames whose f0 has not moved a
quarter-tone in 60 ms, plain v3 speech holds 20 % with a longest plateau of
130 ms, `[singing]` holds 52 % at 440 ms and `[humming]` 64 % at 530 ms. That is
a voice holding notes, which is singing rather than speech.

WHAT IT CANNOT DO IS SING A GIVEN TUNE. The melody comes out of the model, and
there is no tune in the request to compare it against — so a sung Bucketeer
would be singing something nobody chose. She already hums a tune somebody DID
choose: Misha's own, *"i have a variant of the song, basically it's the
Bucketeer Baye, literally humming the tune to this song"*. Re-cutting the hum
out of a model that invents its own melody would throw that away to fix a
mismatch that is measured at four hundredths of a semitone. So the hum is not
touched, `hum_bucketeer.mp3` is byte-identical, and the singing that exists on
this account is reported rather than shipped.

AND THE TAGS ARE PAID FOR IN THE WORDS, which is the finding that decided the
model. Every line below was generated twice, on `eleven_multilingual_v2` and on
`eleven_v3` with a beat-appropriate tag, and both sets transcribed:

    eleven_multilingual_v2    exact 17 of 19,  mean WER 10.5 %
    eleven_v3 + audio tags    exact 13 of 19,  mean WER 25.4 %

(one pass each, on the raw 44.1 kHz takes, before the non-determinism below was
known about; the gap is four lines and twice the WER, which is well outside the
sd of a line and a half that pass-to-pass noise turned out to be)

and v3's extra failures are the ones that cost the most: `vrućina` came back as
`rutina` twice, both inside the `[sighs]` group, and `Fala Bogu` came back as
`Hvala Bogu` — the model NORMALISING the Dalmatian to standard Croatian, which
is the one thing this library exists to avoid. On a two-word mutter the words
are all there is. So it is `eleven_multilingual_v2`, the same model
`cut_chat.py` uses, and the being-out-of-breath is left to the game, which knows
which beat she is on and how much of the bucket is still in her hand.

── RULE 12 REACHES THE LANGUAGE ──────────────────────────────────────────────

`cut_chat.py` states it for `chat15` and it is the same rule twice: invented
text is forbidden, and invented Croatian is the same offence one layer down. A
model asked for beach Croatian hands back something that scans and that nobody
in this loop can vouch for. So every line in `LINES` is hand-written, carries
its gloss on the same row, and names no institution, party, newspaper or place.

The register is Šibenik where it can be vouched for: `lipo` and `di` are the
ikavian this coast speaks and not the standard `lijepo` and `gdje`, `fala` is
the Dalmatian `hvala`, and `pomalo` is the word the whole of Dalmatia uses for
taking it easy. `Pardon` is in because the game already uses it and because that
is what people say there.

ONE LINE WAS WRITTEN AND THEN DROPPED, and it is recorded so nobody writes it
again: `Pijte, pijte.` ("Drink, drink", to the plants). Both models mispronounce
the `ije` in `pijte` — multilingual_v2 says "pajte" and v3 says "pite" — at
every pitch shift tried. `tip_eto`, `tip_na` and `tip_zalij` replaced it and
transcribe exact.

── AND THEY ARE NOT SUBTITLED ────────────────────────────────────────────────

`cut_chat.py` settled this for the baked conversations and the argument is
stronger here. The caption path in 49-voice.js belongs to the live voice service
and a baked clip never touches it, so nothing here puts an untranslated string
in front of anybody. And these are not lines addressed to the player at all —
they are what somebody says to herself carrying ten litres down a flight of
stairs, and a subtitle would make them a speech. The Croatian and the gloss both
travel in `mutteridx.json` so that a probe can read what she said; nothing draws
them.

── WHAT COMES OUT ────────────────────────────────────────────────────────────

ONE MP3 PER LINE, which is the opposite of what `cut_chat.py` does and is that
file's own rule applied honestly: "thirty-two bark clips are 32 files because a
bark is one utterance fired on its own; a conversation is nine utterances that
are only ever played in order". A mutter is a bark. There is no order, no
offsets to measure and no decoder-delay problem to solve, so none of that
machinery is here.

12 kHz AND 32 kbps. The sample rate is `cut_chat.py`'s and so is its sweep — 12
kHz beat 16 kHz at every bitrate tested, because the game lids a voice long
before the encoder's own anti-alias bites. The BITRATE parts company with it,
and deliberately. That file took 24k over 32k because its clip is nine sentences
overheard across six metres of concrete with a field recording of a crowd under
them, and because the bit it saved bought two more lines of conversation.
Neither applies: this is a voice you are standing three metres from with
cicadas under it, it is the thing you are listening to rather than a thing you
are walking past, and the library is 23 clips of about a second whose whole size
is a rounding error against a 31 MB page. 32k buys about 3 dB of coder SNR for
about 23 KB and there is nothing here for the 23 KB to have been spent on
instead.

Levelled to −20.0 dBFS RMS, which is `bump_*.mp3`'s and `cut_chat.py`'s, for
that file's reason: two sets of recorded human speech shipping at different RMS
mean the game's gain has to fix a mastering difference as well as a distance.

Run it:

    python3 tools/cut_mutter.py              # the lot
    python3 tools/cut_mutter.py lift_ajme    # named ones
    python3 tools/cut_mutter.py --check      # transcribe what is cached, no
                                             #   synthesis, no money
    python3 tools/cut_mutter.py --fresh      # throw the cache away and pay again

Raw takes are cached under CACHE, outside the repository like the song masters
and the chat takes, and keyed on the voice for `cut_chat.py`'s reason: changing
the casting should re-render the lines and not the whole library.
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

import numpy as np
import scipy.signal as sig

from cut_field import SR, decode

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'build', 'payload')
CACHE = '/mnt/c/tmp/flamme-retarde/mutter'

TTS_MODEL = 'eleven_multilingual_v2'
# Zlata, and she is HER OWN VOICE rather than somebody else's moved.
#
# THE FIRST CUT OF THIS SHIPPED BALKANIKA PLAYED 3.2 SEMITONES UP, because she
# was the only female on the account labelled `language: hr` and she was already
# cast as `woman_old` on the promenade. Misha heard it: *"they all sound
# horrible, like a chipmunk on speed speaking 100mph."* Every instrument had
# said it was fine — median f0 209.6 against Jessica's 210.1, 0.0 per cent WER
# through speech-to-text, levels inside 0.4 dB — and not one of them can hear a
# chipmunk. The account's own library was the wrong shelf to be looking at: the
# SHARED library has three hundred voices tagged `hr`, and adding one is a POST
# and a free slot (30 on this tier, 1 of them used).
#
# Auditioned three, same six lines, native pitch: Nina at 181.8 Hz, Zlata at
# 195.2, Mila at 210.6. He picked Zlata — 6,108 people have cloned her and she
# is the most used Balkan female on the shelf. She is described as Balkan rather
# than Croatian, which is worth knowing and is not a defect: the two the library
# calls Croatian outright are Nina and Mila, and both were in the audition.
#
# `MUTTER.rate` is 1.0 now. Nothing stands between her and `woman_old` except
# being a different woman, which is the only thing that ever worked.
VOICE = 'V5O4WAcdw7w3Ccfvma8Z'

RATE = 12000
KBPS = 32
RMS = -20.0
# Off the top and the tail, at 34 dB under the line's own peak, with 30 ms given
# back at each end. `cut_chat.py`'s numbers and its reasoning: below this is
# under the quietest unvoiced consonant in these takes and over the room noise
# ElevenLabs leaves either side.
HUSH_DB = 34.0
TRIM_PAD = 0.030

# ── the lines ────────────────────────────────────────────────────────────────
#
# Hand-written, glossed, and grouped by the beat of her loop they belong to.
# `beat` is the key `45-bucketeer.js` looks them up by and the names are that
# file's own phase names, so a line can only be said at the moment it is about.
#
# She is not talking to you. Every one of these is muttered at a bucket, a tap,
# a plant or her own back, and the three `see` lines are the exception that
# proves it: those are what you say to somebody standing in your doorway when
# your hands are full, which is the one moment on this loop she has to address
# anybody.
#
# SHORT, because he asked for "short things" and because a woman with ten kilos
# on one arm going down an open flight is breathing through her nose. The
# longest here is five words.
LINES = [
    # the tap running into the pail, which is the one beat she stands still for
    ('fill_ajde',   'fill', 'Ajde, brže malo.',      'Come on, a bit faster.'),
    ('fill_sporo',  'fill', 'Sporo teče.',           'It runs slow.'),
    # ten kilos coming off the floor
    ('lift_ajme',   'lift', 'Ajme meni.',            'Oh dear me.'),
    ('lift_ledja',  'lift', 'Joj, leđa moja.',       'Oh, my back.'),
    # the outside flight, seventeen risers, no handrail on the room side
    ('down_pomalo', 'down', 'Pomalo, pomalo.',       'Easy does it.'),
    ('down_polako', 'down', 'Polako, polako.',       'Slowly, slowly.'),
    ('down_prolij', 'down', 'Samo da ne prolijem.',  "Just don't let me spill it."),
    # tipping it out over the plants on the porch
    ('tip_evo',     'tip',  'Evo vam vode.',         'Here is your water.'),
    ('tip_eto',     'tip',  'Eto ti.',               'There you go.'),
    ('tip_na',      'tip',  'Na, i tebi.',           'Here, you too.'),
    ('tip_zalij',   'tip',  'Sad si zalivena.',      'Now you are watered.'),
    # the pail down, her back straightened, the channel in front of her
    ('rest_uf',     'rest', 'Uf, vrućina.',          'Oof, the heat.'),
    ('rest_ubime',  'rest', 'Ubi me vrućina.',       'This heat is killing me.'),
    ('rest_fala',   'rest', 'Fala Bogu.',            'Thank God.'),
    ('rest_lipo',   'rest', 'Lipo je danas.',        'It is lovely today.'),
    ('rest_dosta',  'rest', 'Dosta mi je.',          'I have had enough.'),
    # back up the flight with an empty bucket, four times into the morning
    ('up_jos',      'up',   'Još jedanput.',         'One more time.'),
    ('up_zadnji',   'up',   'Zadnji put, kunem se.', 'Last time, I swear.'),
    ('up_di',       'up',   'Di sam stala?',         'Where did I leave off?'),
    ('up_opet',     'up',   'Opet ja.',              'Me again.'),
    # and you, standing in a one-metre doorway she is carrying a bucket through
    ('see_pardon',  'see',  'Pardon.',               'Excuse me.'),
    ('see_malo',    'see',  'Samo malo.',            'Just a moment.'),
    ('see_evo',     'see',  'Evo, evo.',             'Coming, coming.'),
]


# ── the synthesis ────────────────────────────────────────────────────────────

def say(text, voice):
    """One line, as ElevenLabs mp3 bytes.

    44.1 kHz 128k in, for `cut_chat.py`'s reason: everything this tool does
    afterwards is a filter, a level and a resample, and none of them wants to
    start from something already band-limited.

    The settings are that file's own. `stability` 0.42 is low enough that two
    takes of `Ajme meni` are not the same reading and high enough that a
    two-word line does not wander; `style` 0.35 is what puts the sigh in
    `Uf, vrućina` without an audio tag, which is the whole reason this is not
    running on v3.
    """
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        sys.exit('error: no ELEVENLABS_API_KEY in the environment')
    body = json.dumps({
        'text': text, 'model_id': TTS_MODEL,
        'voice_settings': {'stability': 0.42, 'similarity_boost': 0.75,
                           'style': 0.35, 'use_speaker_boost': True},
    }).encode()
    url = (f'https://api.elevenlabs.io/v1/text-to-speech/{voice}'
           f'?output_format=mp3_44100_128')
    req = urllib.request.Request(
        url, data=body,
        headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(3 * (attempt + 1))
                continue
            # The body carries the reason (quota, bad voice id). It never
            # carries the key.
            raise RuntimeError(f'elevenlabs {e.code}: {e.read().decode()[:200]}')
    raise RuntimeError('elevenlabs: gave up')


def transcribe(path, lang='hrv'):
    """The take, back through speech-to-text.

    `cut_chat.py` ran this to retire the question of whether two Croatian
    voices can carry English. It runs the other way round here and answers a
    question this tool could not otherwise answer at all: nobody in the loop
    that writes these lines can hear them, so "does she say the words that were
    handed to her" has to be a measurement or it is nothing.

    It scores intelligibility and it does NOT score accent. A transcriber
    cannot hear an accent, so how Dalmatian any of this sounds is unverified by
    anything but an ear — the same limit that file wrote down and the same one
    that applies here.
    """
    key = os.environ.get('ELEVENLABS_API_KEY')
    bd = '----frmutter'
    body = []
    for k, v in (('model_id', 'scribe_v1'), ('language_code', lang)):
        body.append(f'--{bd}\r\nContent-Disposition: form-data; '
                    f'name="{k}"\r\n\r\n{v}\r\n'.encode())
    body.append(f'--{bd}\r\nContent-Disposition: form-data; name="file"; '
                f'filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode())
    body.append(open(path, 'rb').read())
    body.append(f'\r\n--{bd}--\r\n'.encode())
    req = urllib.request.Request(
        'https://api.elevenlabs.io/v1/speech-to-text', data=b''.join(body),
        headers={'xi-api-key': key,
                 'Content-Type': f'multipart/form-data; boundary={bd}'})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r).get('text', '')
    except urllib.error.HTTPError as e:
        return '!! %d' % e.code


def words(s):
    """For the score only. The diacritics are folded because the transcriber
    disagrees with itself about them across takes of the same line, and a WER
    that moves on whether `vrucina` came back with its acute is measuring the
    transcriber."""
    fold = {'đ': 'dj', 'ć': 'c', 'č': 'c', 'ž': 'z', 'š': 's'}
    s = ''.join(fold.get(c, c) for c in s.lower())
    return [w for w in ''.join(
        c if c.isalnum() else ' ' for c in s).split() if w]


def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        d[i][0] = i
    for j in range(len(h) + 1):
        d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1,
                          d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1][-1] / max(len(r), 1)


# ── the audio ────────────────────────────────────────────────────────────────

def trim(y):
    """Off the top and the tail, to the speech. `cut_chat.py`'s, unchanged: cut
    at `HUSH_DB` under the line's own peak, then give 30 ms back at each end so
    no plosive loses its closure and no fricative its tail."""
    a = np.abs(y)
    thr = np.max(a) * (10 ** (-HUSH_DB / 20))
    idx = np.flatnonzero(a > thr)
    if len(idx) == 0:
        return y
    pad = int(TRIM_PAD * SR)
    return y[max(0, idx[0] - pad):min(len(y), idx[-1] + pad)]


def polish(y):
    """The two ends the encoder should not be given.

    80 Hz and not `cut_chat.py`'s 65, and the difference is the cast. That file
    set its corner under Fran, whose median f0 is 105 Hz. Every clip here is one
    woman at 181.8 Hz who is then PLAYED UP two and a half semitones, so her
    fundamental never comes near 80 and everything under it is room.

    5 800 Hz because the encode below is 12 kHz and its Nyquist is 6 000: a bit
    spent over that corner is a bit the encoder's own anti-alias throws away,
    and doing it here with a Butterworth is cheaper than letting the resampler
    do it with whatever it has. After `MUTTER.rate` the game hears her to
    6.7 kHz, which is a kilohertz and a half over where a muttered voice ends.
    """
    y = sig.sosfiltfilt(sig.butter(2, 80, 'hp', fs=SR, output='sos'), y)
    return sig.sosfiltfilt(sig.butter(2, 5800, 'lp', fs=SR, output='sos'), y)


def level(y, target=RMS):
    """To a fixed RMS, and NOT to a fixed peak.

    A peak normalise on twenty-three clips of different lengths and different
    amounts of voicing lands them at twenty-three different loudnesses, because
    what a peak measures is the single loudest plosive in the take. `Pardon.`
    peaks on its own P.
    """
    r = np.sqrt(np.mean(y * y)) + 1e-12
    g = (10 ** (target / 20)) / r
    # And do not let the gain the RMS asks for clip the peak. A hard limiter on
    # a one-second mutter is audible; 0.97 of full scale with the level backed
    # off to reach it is not.
    return y * min(g, 0.97 / (np.max(np.abs(y)) + 1e-12))


def encode(y, dst, rate=RATE, kbps=KBPS):
    import scipy.io.wavfile as wav
    tmp = os.path.join(CACHE, '_tmp.wav')
    wav.write(tmp, SR, (np.clip(y, -1, 1) * 32767).astype('<i2'))
    subprocess.run(['lame', '--quiet', '-m', 'm', '--resample',
                    str(rate / 1000.0), '-b', str(kbps), '--cbr', tmp, dst],
                   check=True)
    os.remove(tmp)
    return os.path.getsize(dst) / 1024.0


def cut(key, beat, hr, en, fresh=False):
    """One line, from a string to a row of `mutteridx.json`."""
    raw = os.path.join(CACHE, f'{key}_{VOICE[:8]}.mp3')
    if fresh or not os.path.exists(raw):
        open(raw, 'wb').write(say(hr, VOICE))
        paid = True
    else:
        paid = False
    y = level(polish(trim(decode(raw))))
    dst = os.path.join(OUT, f'mutter_{key}.mp3')
    kb = encode(y, dst)
    # AND AGAIN, ON WHAT WAS WRITTEN. `level` normalises the signal handed to
    # the encoder and the encoder does not hand it back: measured across the
    # first bake, the 23 files came out at a mean of −20.50 dBFS with a spread
    # of −21.34 to −20.31, so lame's own resample and filtering cost half a
    # decibel on average and a whole one between the quietest clip and the
    # loudest. That is the mastering difference `cut_song.py` says not to make
    # the game's gain fix, and it is one extra encode of a one-second file to
    # be rid of. Decode what was written, measure the error, apply it, encode
    # once more; the second pass lands inside a hundredth of a decibel because
    # the error is a gain and gains compose.
    err = RMS - 20 * np.log10(np.sqrt(np.mean(decode(dst) ** 2)) + 1e-12)
    if abs(err) > 0.02:
        kb = encode(np.clip(y * 10 ** (err / 20), -0.999, 0.999), dst)
    # The length is measured in what was WRITTEN and not in what went in, so
    # that the number the game schedules against is the number the browser will
    # decode. It is only used to keep her from starting a second line over the
    # first; nothing depends on it to the millisecond, which is why none of
    # `cut_chat.py`'s decoder-delay machinery is here.
    dur = len(decode(dst)) / SR
    print(f'  {key:14s} {beat:5s} {dur:5.2f}s  {kb:5.1f} KB  '
          f'{"paid" if paid else "cached"}   {hr}')
    return dict(key=key, beat=beat, hr=hr, en=en, len=round(dur, 3))


def main(argv):
    fresh = '--fresh' in argv
    check = '--check' in argv
    want = [a for a in argv if not a.startswith('-')]
    rows = [r for r in LINES if not want or r[0] in want]
    if not rows:
        sys.exit(f'no such line: {want}')
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    if check:
        # No synthesis and no money: score whatever is already cached.
        tot = bad = 0
        for key, _beat, hr, _en in rows:
            raw = os.path.join(CACHE, f'{key}_{VOICE[:8]}.mp3')
            if not os.path.exists(raw):
                print(f'  {key:14s} not cached')
                continue
            got = transcribe(raw)
            w = wer(hr, got)
            tot += 1
            bad += w > 0
            print(f'  {"  " if w == 0 else "! "}{key:14s} {hr!r} -> {got!r}'
                  f'   WER {w * 100:.0f}%')
        print(f'  {tot - bad}/{tot} exact')
        return

    print(f'baking {len(rows)} mutters, {TTS_MODEL}, voice {VOICE[:8]}')
    idx = [cut(*r, fresh=fresh) for r in rows]
    # Only rewrite the index when the whole library was baked; a run over one
    # named line must not drop the other twenty-two out of the game.
    if not want:
        json.dump({'voice': VOICE, 'lines': idx},
                  open(os.path.join(OUT, 'mutteridx.json'), 'w'),
                  ensure_ascii=False, indent=1)
        print('  wrote mutteridx.json')
    kb = sum(os.path.getsize(os.path.join(OUT, f'mutter_{r["key"]}.mp3'))
             for r in idx) / 1024.0
    print(f'  {len(idx)} clips, {kb:.0f} KB, '
          f'{sum(r["len"] for r in idx):.1f} s of speech')


if __name__ == '__main__':
    main(sys.argv[1:])
