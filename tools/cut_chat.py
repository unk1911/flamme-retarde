#!/usr/bin/env python3
"""Bake the bathers' conversations, so they are already happening when you
walk up.

Misha, 8 Sep 2026: *"when the bathers are chatting amongst themselves ... maybe
you can pre-render some of their conversations, pre-cache some of it, and when i
sorta approach within an 'ears-shot' of them, that's when their convo becomes
audible ... there's no pause betwixt their chatter and it feels super organic."*

He has named the blocker correctly. Every spoken line in this game that is a
real sentence is a live round trip — a model call and then a speech synthesis,
back to back on somebody else's machines — and `49-voice.js` measures that at
three to six seconds. For a conversation that is supposed to be ALREADY IN
PROGRESS when you arrive, that latency is not a blemish, it is the whole defect:
you walk up, stand there, and hear it start. Nothing tuned at runtime fixes it.
So it is baked here, at build time, exactly as `cut_song.py` bakes the radio —
run the tool when the news should be fresher, pay nothing at runtime, and the
page stays one self-contained file with no fetch in it.

WHAT THIS DOES NOT REPLACE. The formant synth in `43-chatter.js` stays and
carries every conversation you are not close to. That is not sentiment about
code already written: it is the only defence this library has against its own
size. See the long note over `WORDS` in that file — the short version is that
fifteen conversations spent on every murmur across four hundred metres of shore
would recur in minutes, and fifteen spent only on the ones you can actually make
out last three quarters of an hour.

── THE CAST, AND WHY IT IS NOT FREE TO CHOOSE ────────────────────────────────

Every line is baked in the voice of a specific one of the eight bathers, off
`BATHER_VOICE` in `server/baye/baye.py`, so that the woman who yelps when you
hose her is the woman who talks. That means a conversation can only be played by
a group whose people match its cast — and which groups actually form is a fact
about the beach, not a choice. Measured, walking at 1.35 m/s along four
different lanes for half an hour each, 234 conversations:

    230 WERE PAIRS. Four were threes, and all four of those were out on the
    sand; on the promenade itself 106 of 106 were pairs.

`findGroup` will build a three — it looks for somebody standing with both of
the first two — and on the concrete nobody ever is: separate groups sit 3 to 6 m
apart and the third person is always somebody else's. So every script below is
two-handed and strictly alternating, and the runtime's rule that a pair never
speaks twice running is then the same thing as following the script. The 1.7 per
cent that are threes are cast by nobody and stay on the synth.

And by voice class, as a share of 106 conversations on the promenade:

    young man + old woman        26   24.5 %
    young man + young woman      22   20.8 %
    young man + young man        11   10.4 %
    boy + girl                   10    9.4 %
    old woman + young woman       9    8.5 %
    old man + young man           9    8.5 %
    old man + young woman         7    6.6 %
    everything else              12   11.3 %   (old man + old woman, two old
                                                women, two old men, a child
                                                with an adult)

The fifteen are allotted in those proportions. Checked afterwards against the
groups that actually came within earshot on four half-hour walks, it covers 75,
87, 89 and 90 per cent of them — call it 85. The rest never get words and stay
on the synth, and that is the right failure: a murmur is what that group sounded
like yesterday.

WHERE THE MISSES ARE, in order, because this is the list to work down if the
library is ever allowed to grow: an old man with an old woman, two young women,
two old women, a child with an adult, and two old men. Each is a few per cent
and none of them is worth a script of its own before the crowded pairings have
more than four between them.

WITHIN a class there are two kinds and two voices — `man_young_fit` is Harry and
`man_young_lean` is Liam, `woman_young_slim` is Jessica and `woman_young_full`
is Niamh — so the four young-man/old-woman scripts are split two and two between
Harry and Liam, and the runtime prefers an exact-kind match before it will
accept a class match. A young man in Liam's voice when he was cast as Harry is a
young man; a nine-year-old in Bill's voice is a defect, and the class rule is
drawn exactly where that line is.

── WHAT THEY TALK ABOUT ──────────────────────────────────────────────────────

Misha named the subjects: current politics, news, market and crypto news,
bitcoin, litecoin, ethereum, dogecoin. The prices are FETCHED at bake time from
the same Coinbase endpoint `43-jadrija.js` already puts on the television, so
the talk and the screen in the konoba agree — and the model is told to keep the
numbers vague anyway ("under eighty", "nine cents"), because a beach
conversation that quotes four significant figures is a price ticker with a
person in front of it, and because a clip that names a number is stale the
following afternoon where "it's down again" is not.

IN ENGLISH, WITH A WORD OF CROATIAN, and that is this game's own convention
rather than a shortcut. The thirty-two bark clips are English in every language
and say so; Baye, the cat and the hosed bathers are all English; the balloon
over a bather's head is translated and the recording under it is not. Two
Croatians talking to each other in English is a stretch — and the alternative is
a library he cannot understand, when the entire request was to be able to make
out that they are discussing bitcoin. So: the register of `PERSONA_BATHER`,
which is where the topical direction for these people is being written.

RULE 12 reaches this file. Nothing invents a Croatian institution, party,
politician, newspaper or place: the model is given Jadrija and Šibenik, which
the game already names, and forbidden the rest. A synthesised vowel is not a
claim to be a word; a named ministry is a claim to be a ministry.

── AND WHAT COMES OUT ────────────────────────────────────────────────────────

ONE MP3 PER CONVERSATION and not one per line, which is worth the paragraph.
Thirty-two bark clips are 32 files because a bark is one utterance fired on its
own; a conversation is nine utterances that are only ever played in order, and
splitting them costs a file header and a decode apiece for nothing. So each
conversation is its lines laid end to end with `GAP` of silence between them,
and `chatidx.json` carries where each one starts. `AudioBufferSourceNode.start`
takes an offset and a duration, so playing line five is one node and no seek.

THE OFFSETS ARE MEASURED IN THE DECODED FILE AND NOT WRITTEN FROM THE SOURCE
TIMELINE, AND THE GAME MEASURES THEM AGAIN. Both halves of that are here
because of a real result rather than out of caution.

An mp3 decoder inserts the encoder's own delay — 1 105 samples at whatever rate
the file is — unless it honours the gapless tag LAME writes, and WHETHER IT
DOES IS NOT A PROPERTY OF THE DECODER. Sweeping sixteen encoder settings
through `ffmpeg` and asking each one where its own signal actually starts:

    12 kHz  24k   +92.1 ms       12 kHz  32k, 40k, 48k    0.0 ms
    16 kHz  24k, 32k   +69.1     16 kHz  40k, 48k         0.0
    22 kHz  every rate  +50.1    24 kHz  every rate       +46.0

Same decoder, same tool, same source; the delay appears and disappears with the
bitrate. So there is no constant to hard-code and no setting that can be trusted
to behave the same in Chrome, and an offset table written from the source
timeline would clip the first consonant off every line — or not — depending on a
bitrate somebody changed for an unrelated reason.

So: the tool encodes, decodes what it wrote, finds the silences it put there,
and writes the offsets it FOUND, plus `at0`, where the first line begins. If it
cannot find the right number of gaps it refuses the file. And `chatBuf` in
43-chatter.js finds the first onset again in the buffer the browser decoded and
shifts the whole table by the difference — one scan of a tenth of a second, once
per conversation, which makes the game correct for any decoder whatever it does
with the tag.

Run it:

    python3 tools/cut_chat.py --pilot        # one conversation, end to end
    python3 tools/cut_chat.py                # all fifteen
    python3 tools/cut_chat.py chat00 chat07  # named ones
    python3 tools/cut_chat.py --rates        # the encoder sweep, no API calls

Text and raw speech are cached under CACHE so a re-run of the encoder costs
nothing; `--fresh` throws the cache away and pays for the library again.
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
# Outside the repository, like the song masters: this is thirty dollars of
# somebody else's compute and it is not source.
CACHE = '/mnt/c/tmp/flamme-retarde/chat'

MODEL = 'gpt-5.6-luna'                  # the same one `baye.py` uses
TTS_MODEL = 'eleven_multilingual_v2'    # its slow, better one — latency is free here

# ── the encode ────────────────────────────────────────────────────────────────
#
# 12 kHz and 24 kbps, both measured, and `--rates` is the sweep that settled
# them. The band that matters is the one the GAME leaves, not the one the file
# has: `WORDS` in 43-chatter.js lids a voice at 6 000 Hz with the listener
# standing on top of it and at 1 450 Hz across the promenade, so a bit spent
# above 6 kHz is a bit a biquad throws away a moment later — the same argument
# `cut_song.py` makes about lidding the radio before the encoder.
#
# SNR against the band-limited reference, over the whole pilot conversation,
# measured through the lid the game actually applies at each range:
#
#                            3 500 Hz     5 000 Hz     6 000 Hz
#                             (at 10 m)     (at 5 m)   (standing in it)
#     12 kHz  24k   66.2 KB    17.2 dB      16.5 dB      16.3 dB
#     12 kHz  32k   88.5 KB    20.3        19.6         19.3
#     12 kHz  40k  110.6 KB    22.9        22.2         21.7
#     16 kHz  24k   66.1 KB    16.9        16.2         16.0
#     16 kHz  32k   88.2 KB    18.8        18.2         18.0
#     16 kHz  40k  110.4 KB    21.2        20.6         20.5
#
# 12 kHz BEATS 16 kHz AT EVERY BITRATE, including in the 3 500 Hz band, and that
# is the reverse of what was expected — the worry was that a 12 kHz encode's own
# anti-alias would eat 5-6 kHz where a fricative lives. It does, and it does not
# matter, because the game has already lidded that band away and what the
# encoder saves by not coding it up there it spends on the vowels down here. The
# guess was wrong and the sweep is why there is a sweep.
#
# AND 24k AND NOT 32k, WHICH IS THE ONE PLACE THIS PARTS COMPANY WITH
# `cut_song.py`. That file takes the knee, and the knee here is at 32k too: 40k
# buys 2.6 dB for a third more payload, 24k gives 3.1 dB back for a quarter
# less. The difference is what the clip is FOR. The radio is a thing you stand
# and listen to; this is nine sentences overheard across six metres of concrete
# with a field recording of a crowd underneath them. 17.2 dB puts the coder's
# noise 17 dB under a clip that ships at -20.0 dBFS RMS, so -37 dBFS in the
# file; at three metres the game plays it 8.8 dB down, so that noise arrives at
# about -46 dBFS with a promenade at -33.6 sitting twelve decibels over it. It
# is not audible, and 32k would have spent 340 KB of the bundle proving it.
#
# The number this is really trading against is the LENGTH, and that is the whole
# argument: 24k buys nine lines a conversation instead of seven, which is two
# more places a player can join one. See `WORDS.entry`.
RATE = 12000
KBPS = 24
# -20.0 dBFS RMS, which is `bump_*.mp3`'s own shipped level. Those are the other
# recorded voices in this game and they were levelled there; two sets of human
# speech that ship at different RMS mean the game's gain has to fix a mastering
# difference as well as a distance, which is the mistake `cut_song.py` names.
RMS = -20.0
# Between lines. Long enough that a ten-millisecond disagreement between two
# decoders is inaudible, short enough that the silence detector cannot miss it,
# and it is NOT the conversational gap — that is `WORDS.gap` in 43-chatter.js
# and is scheduled, because a pause baked into a file cannot be shortened when
# somebody answers quickly.
GAP = 0.16
# Below `peak - 34 dB` for this long is silence. 34 dB down is under the quietest
# unvoiced consonant in these takes and over the room noise ElevenLabs leaves.
HUSH_DB = 34.0
HUSH = 0.09
# And the absolute threshold that says "speech starts here", shared with
# `chatBuf` in 43-chatter.js so the two ends of the alignment agree by
# construction. -46 dBFS is 26 dB under the levelled RMS of every clip here and
# 12 dB over the loudest thing in the silence between the lines, measured across
# the pilot: the gaps read -58 dBFS and the coder's own noise is under that.
ONSET = 10 ** (-46.0 / 20)

# The eight voices, off BATHER_VOICE in server/baye/baye.py. Copied rather than
# imported for the reason that file's own note gives about the mesh names: the
# server is a different machine with a different deploy, and a bake tool that
# cannot run without it is a bake tool that cannot run. `rate` is the child
# trick — there are no child voices on the account, so the two children are an
# adult voice sped up, which raises pitch and speed together. In the game that
# is `playbackRate` with `preservesPitch` off; here it is a resample, applied
# before the level is read so it cannot move it.
VOICE = {
    'girl_child':       ('6nGWYkWm4p3WN2Es5h1E', 1.20),  # Tiara
    'boy_child':        ('bIHbv24MWmeRgasZH58o', 1.20),  # Will
    'woman_young_slim': ('cgSgspJ2msm6clMCkdW9', 1.00),  # Jessica
    'woman_young_full': ('1e9Gn3OQenGu4rjQ3Du1', 1.00),  # Niamh
    'woman_old':        ('XrExE9yKIg1WjnnlVkGX', 1.00),  # Matilda
    'man_young_fit':    ('SOYHLrjzK2X1ezoPC6cr', 1.00),  # Harry
    'man_young_lean':   ('TX3LPaxmHKxFdv7VOQHJ', 1.00),  # Liam
    'man_old_heavy':    ('pqHfZKP75CvOlQylNhV4', 1.00),  # Bill
}

# And who they are, in the words the model gets — BATHER_WHO, same file, same
# reason for the copy.
WHO = {
    'girl_child':       'a girl of about eight, on the beach with her family',
    'boy_child':        'a boy of about nine, who has been in and out of the '
                        'water all morning',
    'woman_young_slim': 'a slim woman in her twenties, sunbathing',
    'woman_young_full': 'a woman in her twenties, just out of the sea',
    'woman_old':        'a woman of about seventy, who has been coming to this '
                        'beach her whole life',
    'man_young_fit':    'a fit man in his twenties, showing off a bit',
    'man_young_lean':   'a lean man in his late twenties, half asleep',
    'man_old_heavy':    'a heavy man of about seventy, in the shade, not '
                        'getting up for anybody',
}

# ── the fifteen ───────────────────────────────────────────────────────────────
#
# The allotment is the measured class distribution above and the topics are the
# ones he named. Two things are deliberate in the spread and are the answer to
# "fifteen clips is fifteen clips":
#
#   NO TWO CONVERSATIONS WITH THE SAME CAST HAVE THE SAME SUBJECT, so a repeat
#   inside a voice pair is at least a different thing being talked about.
#
#   AND THE CROWDED PAIRINGS GET THE MOST. Of the nine passes a walking player
#   made within twelve metres of a conversation over fifteen minutes, six were
#   the same young-man-and-old-woman pair on the same stretch of promenade —
#   which is not a fault in the crowd, it is what a promenade is. They get four
#   scripts and everybody else gets one or two.
CONV = [
    dict(key='chat00', cast=['man_young_lean', 'woman_old'],
         topic='bitcoin falling again',
         brief='He follows the price and is gloomy about it. She has heard '
               'about it from a nephew who put money in and thinks the whole '
               'thing is madness. Neither of them is an expert.'),
    dict(key='chat01', cast=['man_young_fit', 'woman_old'],
         topic='the fire inland and the smoke over the hill',
         brief='A yellow aeroplane keeps going over. She remembers other '
               'summers and other fires. He is impressed by the aircraft.'),
    dict(key='chat02', cast=['man_young_lean', 'woman_old'],
         topic='the price of everything this summer',
         brief='Coffee, the electricity bill, what a parasol costs now. She '
               'compares it with what it used to be. Grumbling, not angry.'),
    dict(key='chat03', cast=['man_young_fit', 'woman_old'],
         topic='politics and who is supposed to be dealing with any of it',
         brief='Nobody is named. They are cynical in the ordinary way people '
               'are on a beach: they were promised something and nothing '
               'happened, and neither of them expects it to.'),
    dict(key='chat04', cast=['man_young_lean', 'woman_young_full'],
         topic='ethereum, which he is explaining badly',
         brief='He half understands it and is confident. She is not impressed '
               'and asks the obvious question he cannot answer.'),
    dict(key='chat05', cast=['man_young_fit', 'woman_young_slim'],
         topic='dogecoin, which stopped being funny',
         brief='It is nine cents. One of them bought some as a joke years ago '
               'and will not say how much.'),
    dict(key='chat06', cast=['man_young_lean', 'woman_young_slim'],
         topic='rent, tourists and working two jobs in August',
         brief='The news of the season for anybody who actually lives here. '
               'Wry rather than bitter.'),
    dict(key='chat07', cast=['man_young_fit', 'man_young_lean'],
         topic='one of them lost money trading and the other saw it coming',
         brief='Two young men, one needling the other. Litecoin comes into '
               'it. Neither will admit the actual figure.'),
    dict(key='chat08', cast=['man_young_lean', 'man_young_fit'],
         topic='whether any of it is worth holding for ten years',
         brief='The long argument, in short sentences, between somebody who '
               'believes and somebody who thinks it is a casino.'),
    dict(key='chat09', cast=['boy_child', 'girl_child'],
         topic='bitcoin, as reported by somebody\'s father',
         brief='NINE AND EIGHT YEARS OLD. They are repeating something a '
               'parent said at breakfast and have it slightly wrong. They do '
               'not understand it and do not pretend to. Short, silly, '
               'delighted. One of them is more interested in the jellyfish.'),
    dict(key='chat10', cast=['girl_child', 'boy_child'],
         topic='the aeroplane that scoops water out of the channel',
         brief='CHILDREN. They have both seen it and are arguing about how '
               'much water it takes and whether it could pick up a boat.'),
    dict(key='chat11', cast=['woman_old', 'woman_young_full'],
         topic='the news, and a son who has gone abroad to work',
         brief='The older woman asks after him. The younger one is used to '
               'the question. Warm, a little resigned.'),
    dict(key='chat12', cast=['woman_old', 'woman_young_slim'],
         topic='pensions, prices and how hot it has got',
         brief='The heat is the opening and the money is what it turns into. '
               'The older one does most of the talking.'),
    dict(key='chat13', cast=['man_old_heavy', 'man_young_lean'],
         topic='litecoin, and an old man who is not impressed by any of it',
         brief='The young one is enthusiastic. The old one has seen money '
               'invented before and says so slowly, in very few words.'),
    dict(key='chat14', cast=['man_old_heavy', 'woman_young_full'],
         topic='the news, the government and the ferry timetable',
         brief='He complains, at length and comfortably. She agrees just '
               'enough to keep it going.'),
]

# What each conversation must obey, and every clause of it is here because of
# how the game plays them rather than because of taste.
RULES = """WRITE EXACTLY {n} LINES, strictly alternating: speaker A, speaker B,
speaker A, and so on, starting with A. One line is one person speaking once.

THREE TO ELEVEN WORDS A LINE, AND AVERAGE SEVEN. Several lines are three or
four words. This is a beach, not a panel discussion, and what carries across
six metres of concrete is a short remark and not a paragraph. Count the words.

THE LISTENER JOINS IN THE MIDDLE. A player walks up and starts hearing at line
four or line six, whichever the game picks, and walks away again. So:
- NO LINE MAY DEPEND ON BEING FIRST. No greetings, no "so anyway", no "listen",
  no introducing the subject. It is already being talked about when we arrive.
- NO LINE MAY DEPEND ON BEING LAST. No goodbyes, no "right, I'm off", no
  summing up, no conclusion. It is still going on when we leave.
- Any three consecutive lines must make sense on their own.
- Do not build a joke over eight lines that only pays off at the end.

HOW THEY TALK:
- Ordinary spoken English, contractions, interruptions, unfinished thoughts.
- AT MOST TWO LINES IN THE WHOLE THING carry a Croatian word, and never two
  such lines in a row: "joj", "ma daj", "dobro", "ajme", "e pa", "hvala". Three
  people saying "ajme" in twenty seconds is one person with a tic, not a coast.
  Most conversations should have one, and some should have none at all.
- No dash and no semicolon. No emoji, no asterisks, no stage directions, no
  quotation marks.
- Never say the other person's name. Never say your own.
- Never mention the player, a hose, a fire hose, or being sprayed with water.
  Nothing has happened to these two. They are just talking.

WHAT YOU MAY NOT NAME. No political party, no politician, no minister, no
ministry, no newspaper, no television channel, no company, no bank, no exchange,
no football club, no brand. No place except Jadrija, Sibenik and the sea. If you
want to refer to who is in charge, say "they" or "the ones in charge".

NUMBERS. Keep them round and spoken: "under eighty", "nine cents", "two and a
half thousand", "fifty odd". Never a price to the cent or a four-figure exact
number: this is baked into the game and will be heard months from now.

AND AT MOST ONE LINE IN THE WHOLE CONVERSATION MAY NAME A PRICE. Never a list
of them. Two people on a beach saying what three coins are worth, one after the
other, is a price ticker with a person standing in front of it, and it is the
one thing that would give this away as written rather than overheard.

Return ONLY a JSON array of {n} strings, in order, nothing else."""


# ── the model ─────────────────────────────────────────────────────────────────

def prices():
    """What the market is doing, from the endpoint the game's own television
    uses. Failure is not fatal: a conversation about prices being down is still
    a conversation about prices being down."""
    out = {}
    for k in ('BTC', 'ETH', 'LTC', 'DOGE'):
        try:
            with urllib.request.urlopen(
                    f'https://api.coinbase.com/v2/prices/{k}-USD/spot',
                    timeout=15) as r:
                out[k] = float(json.load(r)['data']['amount'])
        except Exception:
            pass
    return out


def write_lines(c, n, px):
    """One conversation's words. One model call, not one per line."""
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('error: no OPENAI_API_KEY in the environment')
    a, b = c['cast']
    mkt = ', '.join(f'{k} about ${v:,.4g}' for k, v in px.items()) or 'unknown'
    sysmsg = (
        'You write overheard dialogue for a video game set on the beach at '
        'Jadrija, near Sibenik, on the Dalmatian coast, in August 2026. It is '
        'hot, the cicadas are deafening, and there is a fire somewhere inland '
        'with aircraft working it. The people are Croatian and are speaking '
        'English, which is the convention this game already uses for every '
        'spoken line in it.')
    usr = (
        f'SPEAKER A is {WHO[a]}.\n'
        f'SPEAKER B is {WHO[b]}.\n\n'
        f'THEY ARE TALKING ABOUT: {c["topic"]}.\n'
        f'{c["brief"]}\n\n'
        f'For reference, today the market is: {mkt}. Do not quote these '
        f'figures exactly.\n\n'
        + RULES.format(n=n))
    body = json.dumps({
        'model': MODEL,
        'messages': [{'role': 'system', 'content': sysmsg},
                     {'role': 'user', 'content': usr}],
        'max_completion_tokens': 4000,
    }).encode()
    req = urllib.request.Request(
        'https://api.openai.com/v1/chat/completions', data=body,
        headers={'Authorization': 'Bearer ' + key,
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.load(r)
    txt = d['choices'][0]['message']['content'].strip()
    if txt.startswith('```'):
        txt = txt.split('\n', 1)[1].rsplit('```', 1)[0]
    lines = json.loads(txt)
    if not isinstance(lines, list) or len(lines) != n:
        raise RuntimeError(f'{c["key"]}: model returned {len(lines)} lines, '
                           f'wanted {n}')
    return [str(s).strip() for s in lines], d.get('usage', {})


# ── the voice ─────────────────────────────────────────────────────────────────

def say(text, voice):
    """One line, as ElevenLabs mp3 bytes. 44.1 kHz 128k in, because everything
    this tool does afterwards is a filter and a resample and neither wants to
    start from something already band-limited."""
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
            # The body can carry the reason (quota, bad voice id); it never
            # carries the key.
            raise RuntimeError(f'elevenlabs {e.code}: '
                               f'{e.read().decode()[:200]}')
    raise RuntimeError('elevenlabs: gave up')


# ── the audio ─────────────────────────────────────────────────────────────────

def trim(y):
    """Off the top and the tail, to the speech.

    ElevenLabs leaves a couple of hundred milliseconds of room either side and
    that is dead payload nine times a conversation. Cut at 34 dB under the
    line's own peak, then give 30 ms back at each end so no plosive loses its
    closure and no fricative its tail."""
    a = np.abs(y)
    thr = np.max(a) * (10 ** (-HUSH_DB / 20))
    idx = np.flatnonzero(a > thr)
    if len(idx) == 0:
        return y
    pad = int(0.030 * SR)
    return y[max(0, idx[0] - pad):min(len(y), idx[-1] + pad)]


def speed(y, rate):
    """A child, which on this account is an adult played fast.

    Linear interpolation and not a resampler with a filter in it, because that
    is EXACTLY what the browser does to the live voice service's answer:
    `playbackRate` with `preservesPitch` off, which the two children have always
    been. Matching the artefact matters more than removing it — the girl who
    talks and the girl who yelps have to be one person."""
    if abs(rate - 1.0) < 1e-6:
        return y
    n = int(len(y) / rate)
    return np.interp(np.arange(n) * rate, np.arange(len(y)), y)


def level(y):
    """To RMS over the VOICED part, not over the line.

    A line with a pause in the middle of it has a lower whole-line RMS than the
    same line said straight through, so levelling on that makes the hesitant
    line louder — which is backwards. The measure is taken over everything
    within 30 dB of the line's own peak, which is the speech."""
    a = np.abs(y)
    m = a > np.max(a) * (10 ** (-30.0 / 20))
    r = np.sqrt(np.mean(y[m] ** 2)) if m.any() else np.sqrt(np.mean(y ** 2))
    return y * (10 ** (RMS / 20) / max(r, 1e-12))


def band(y):
    """The filters, at 48 kHz and before the resample, so the resampler's own
    anti-alias is the only thing shaping the top — `cut_field.py`'s rule.

    80 Hz because `man_old_heavy` is Bill and Bill's f0 lives at 100-150 Hz;
    anything under 80 in a studio voice is a microphone stand. 6 000 Hz because
    `CHAT_WORDS.lpNear` is 6 000 and the encoder must not spend bits on a band
    a biquad throws away a moment later."""
    sos = sig.butter(2, 80, 'hp', fs=SR, output='sos')
    y = sig.sosfiltfilt(sos, y)
    sos = sig.butter(2, 6000, 'lp', fs=SR, output='sos')
    return sig.sosfiltfilt(sos, y)


def encode(y, dst, rate=RATE, kbps=KBPS):
    import scipy.io.wavfile as wav
    tmp = '/tmp/cut_chat_tmp.wav'
    wav.write(tmp, SR, (np.clip(y, -1, 1) * 32767).astype('<i2'))
    subprocess.run(['lame', '--quiet', '-m', 'm', '--resample',
                    str(rate / 1000.0), '-b', str(kbps), '--cbr', tmp, dst],
                   check=True)
    return os.path.getsize(dst) / 1024.0


def find_gaps(y, want):
    """Where the silences we put in actually landed, in the decoded file.

    The alignment guarantee, and it is measured rather than assumed — see the
    header. Everything under `peak - HUSH_DB` for at least `HUSH` seconds is a
    run of silence; we wrote `want` of them between the lines, plus whatever is
    at the two ends. Take the `want` longest interior runs and use their
    midpoints as the cuts. If there are not that many, the file is wrong and the
    caller must not ship it."""
    a = np.abs(y)
    thr = np.max(a) * (10 ** (-HUSH_DB / 20))
    # A short moving maximum, so one zero crossing inside a vowel is not a gap.
    w = int(0.012 * SR)
    env = np.maximum.reduceat(a, np.arange(0, len(a), w))
    quiet = env <= thr
    runs = []
    i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            runs.append((i * w, j * w))
            i = j
        else:
            i += 1
    inner = [r for r in runs
             if r[0] > 0 and r[1] < len(a) - w and (r[1] - r[0]) / SR >= HUSH]
    if len(inner) < want:
        return None
    inner.sort(key=lambda r: r[0] - r[1])          # longest first
    cuts = sorted((r[0] + r[1]) // 2 for r in inner[:want])
    return cuts


def first_onset(y):
    """The first sample of speech, in seconds, by the same test the game uses.

    Written against an ABSOLUTE threshold rather than against the file's own
    peak, because it has to agree with a five-line scan in `chatBuf` that sees
    one buffer and has no reason to walk all of it looking for a maximum. Every
    clip is levelled to the same RMS by `level`, so an absolute threshold is a
    fixed number of decibels under the speech in every one of them."""
    a = np.abs(y)
    i = np.flatnonzero(a > ONSET)
    return float(i[0]) / SR if len(i) else 0.0


def bands_db(x):
    """Octave-ish energies, for the encoder sweep's SNR."""
    f, P = sig.welch(x, SR, nperseg=4096)
    m = (f >= 180) & (f < 5800)
    return f, P, m


def cut(c, n, px, fresh=False):
    """One conversation, from a topic to a row of `chatidx.json`."""
    os.makedirs(CACHE, exist_ok=True)
    tpath = os.path.join(CACHE, c['key'] + '.json')
    if fresh or not os.path.exists(tpath):
        lines, usage = write_lines(c, n, px)
        json.dump({'lines': lines, 'usage': usage, 'at': time.time(),
                   'topic': c['topic'], 'cast': c['cast']},
                  open(tpath, 'w'), indent=1)
        print(f"  {c['key']}  wrote {len(lines)} lines  "
              f"({usage.get('total_tokens', '?')} tokens)")
    lines = json.load(open(tpath))['lines']

    pieces, index, chars = [], [], 0
    for i, text in enumerate(lines):
        kind = c['cast'][i % 2]
        vid, rate = VOICE[kind]
        mp = os.path.join(CACHE, f"{c['key']}_{i:02d}.mp3")
        if fresh or not os.path.exists(mp):
            open(mp, 'wb').write(say(text, vid))
            chars += len(text)
        y = level(speed(trim(decode(mp)), rate))
        pieces.append(y)
        index.append(dict(r=i % 2, k=kind, t=text))

    gap = np.zeros(int(GAP * SR))
    whole = pieces[0]
    for y in pieces[1:]:
        whole = np.concatenate([whole, gap, y])
    whole = band(whole)
    peak = 20 * np.log10(np.max(np.abs(whole)))
    if peak > -0.5:
        print(f"  !! {c['key']} peaks at {peak:+.2f} dBFS")

    dst = os.path.join(OUT, c['key'] + '.mp3')
    kb = encode(whole, dst)

    # Read back what the decoder actually hands the game, and find the gaps in
    # THAT rather than trusting the timeline that went in.
    back = decode(dst)
    cuts = find_gaps(back, len(pieces) - 1)
    if cuts is None:
        sys.exit(f"error: {c['key']} — could not find {len(pieces) - 1} gaps in "
                 f"the decoded file. Do not ship it.")
    edges = [0] + list(cuts) + [len(back)]
    for i in range(len(pieces)):
        a, b = edges[i], edges[i + 1]
        index[i]['at'] = round(a / SR, 3)
        index[i]['d'] = round((b - a) / SR, 3)
    # Where the first line actually begins, which is the anchor the game
    # re-measures against. See the header: whether the decoder ate the
    # encoder's delay is not a thing this tool gets to know about Chrome.
    at0 = first_onset(back)
    got = 20 * np.log10(np.sqrt(np.mean(back ** 2)))
    secs = len(back) / SR
    print(f"  {c['key']:<8s} {c['cast'][0][:16]:<16s} + {c['cast'][1][:16]:<16s}"
          f" {len(lines):2d} lines  {secs:5.1f} s  {kb:6.1f} KB  "
          f"{chars:4d} new chars  decodes at {got:+.2f} dBFS, peak {peak:+.1f}, "
          f"onset {at0 * 1000:.0f} ms")
    return dict(key=c['key'], cast=c['cast'], topic=c['topic'], at0=round(at0, 3),
                lines=index, kb=kb, secs=secs, chars=chars)


def rates():
    """The encoder sweep, off whatever is already cached. No API calls."""
    key = CONV[0]['key']
    src = [os.path.join(CACHE, f'{key}_{i:02d}.mp3') for i in range(20)]
    src = [p for p in src if os.path.exists(p)]
    if not src:
        sys.exit('error: nothing cached — run --pilot first')
    c = CONV[0]
    pieces = [level(speed(trim(decode(p)), VOICE[c['cast'][i % 2]][1]))
              for i, p in enumerate(src)]
    gap = np.zeros(int(GAP * SR))
    whole = pieces[0]
    for y in pieces[1:]:
        whole = np.concatenate([whole, gap, y])
    ref = band(whole)
    sos = sig.butter(4, [180, 5800], 'bp', fs=SR, output='sos')
    r = sig.sosfiltfilt(sos, ref)
    print(f'  reference {len(ref) / SR:.1f} s  {len(ref)} samples')
    r4 = sig.resample_poly(r, 4, 1)
    for rate in (12000, 16000, 22050, 24000):
        for kbps in (24, 32, 40, 48):
            dst = '/tmp/cut_chat_rate.mp3'
            kb = encode(ref, dst, rate, kbps)
            raw = decode(dst)
            b4 = sig.resample_poly(sig.sosfiltfilt(sos, raw), 4, 1)
            # ALIGN BY SEARCHING FOR THE BEST SNR, AT A QUARTER OF A SAMPLE,
            # and neither half of that is fussiness.
            #
            # The correlation peak got this wrong on five rows of twelve: it
            # read a lag of zero where the true offset was the encoder's own
            # 1 105 samples, and then reported a HIGHER SNR for the misaligned
            # pair than for the aligned one, which is impossible and is the
            # tell. A coded signal is a filtered signal, and the correlation of
            # speech with a lowpassed copy of itself is broad enough that the
            # argmax lands wherever the biggest vowel is. What is wanted is the
            # alignment that minimises the ERROR, so search for that directly.
            #
            # And at four times the rate, because the encoder's resampler
            # leaves a FRACTIONAL delay: at whole samples the peak was so sharp
            # that four samples either side of it cost six decibels, which is
            # not a coder's noise floor, it is a phase error being measured
            # instead of one. Reading the same file at quarter-sample steps
            # moved 16 kHz 32k from 7.4 dB to its real figure.
            def snr_at(bb4, rr4, lag):
                if lag >= 0:
                    x, y = bb4[lag:], rr4
                else:
                    x, y = bb4, rr4[-lag:]
                n = min(len(x), len(y))
                e = x[:n] - y[:n]
                return 10 * np.log10(np.mean(y[:n] ** 2)
                                     / max(np.mean(e ** 2), 1e-20))
            coarse = max(range(-200, 7001, 25),
                         key=lambda L: snr_at(b4, r4, L * 4))
            best = max(((snr_at(b4, r4, L), L)
                        for L in range(coarse * 4 - 120, coarse * 4 + 121)),
                       key=lambda t: t[0])
            print(f'    {rate:5d} Hz {kbps:3d}k  {kb:6.1f} KB  '
                  f'{best[0]:5.1f} dB SNR  lag {best[1] / 4 / SR * 1000:+6.1f} ms'
                  f'  length {(len(raw) - len(ref)) / SR * 1000:+7.1f} ms')


if __name__ == '__main__':
    argv = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if '--rates' in flags:
        rates()
        sys.exit(0)
    n = int(os.environ.get('CHAT_LINES', '9'))
    todo = [c for c in CONV if not argv or c['key'] in argv]
    if '--pilot' in flags:
        todo = todo[:1]
    px = prices()
    print(f"  market: {px}")
    rows = [cut(c, n, px, '--fresh' in flags) for c in todo]
    idx = dict(rate=RATE, kbps=KBPS, rms=RMS, gap=GAP, onset=round(ONSET, 6),
               conv=[{k: r[k] for k in ('key', 'cast', 'topic', 'at0', 'lines')}
                     for r in rows])
    if len(rows) == len(CONV):
        json.dump(idx, open(os.path.join(OUT, 'chatidx.json'), 'w'),
                  separators=(',', ':'), ensure_ascii=False)
        print('  wrote chatidx.json')
    else:
        print('  (partial run — chatidx.json NOT rewritten)')
    kb = sum(r['kb'] for r in rows)
    print(f"\n  {len(rows)} conversations, {sum(r['secs'] for r in rows):.0f} s, "
          f"{kb:.0f} KB shipped, {kb * 4 / 3:.0f} KB once build.py has base64'd "
          f"it. {sum(r['chars'] for r in rows)} characters of speech bought.")
