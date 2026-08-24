#!/usr/bin/env python3
"""
Cut the Jadrija field recordings into the beds the game loops.

Six recordings were made on the peninsula in August 2026 with a phone in a
pocket-sized recorder, mono, 48 kHz, AAC. They live outside the repo — they are
Misha's own footage and they are large — at

    /mnt/c/tmp/refs/jadrija/field-recordings/

and this is the only thing that has ever turned them into what ships. Run it
whenever a bed wants re-cutting; it is deterministic and it overwrites.

TWO KINDS OF THING COME OUT OF HERE, and the second one arrived on 24 August.
A BED loops for as long as the game is open and everything below about seams,
insets and the length search exists for it. A CUE plays once, under a moment,
and then stops — and none of that machinery applies to it, because a one-shot
has no join to hide. `cut_cue` is its own six lines for exactly that reason:
the alternative was to let `pick` search for a seam that will never be heard,
which is a search returning an answer to a question nobody asked. What a cue
needs instead is a window chosen by hand off the shape of the recording, and
the two paths share only the tail — filter, level, encode — which is where the
duplication would actually have cost something.

WHAT THE HARD PART IS

Not the filtering, which is four lines. The window. A bed loops for as long as
the game is open, so what the ear eventually finds is not a click at the join —
noise has no click — it is a *period*: the same laugh, the same slap of water,
the same second of somebody's radio, coming round again at a fixed interval,
which is the one thing that never happens in a real place. Two separate things
follow from that and this script does both.

Make the period long. The first cut of these clips ran nine to nineteen
seconds, which is a period you can count, and it was heard as one inside a
minute. So each window here is as long as its source honestly gives: the whole
of the promenade recording bar its two ends, a minute of the pier, a minute of
the wood. Where the source will not give a long one — the hillside chorus is
eleven seconds of the forty-one, and the rest of that recording has no chorus
in it at all — the length is what it is and the shortfall is made up in
80-audio.js by running two playheads at different rates, which turns a period
of eleven seconds into one of three minutes.

Then make the join inaudible. A window is scored on how well its two ends match
at a 0.5 s inset — the same inset `loopStart`/`loopEnd` use over there, so that
whatever leading padding the MP3 decoder decides to hand back cannot walk the
seam off the place it was chosen at. Matched in level *and* in spectrum, over a
third of a second each side, because a step in either is what gives a loop away
and a discontinuity in noise nobody could have predicted is not heard at all.
"""

import subprocess, sys, os
import numpy as np
import scipy.signal as sig

SRC = '/mnt/c/tmp/refs/jadrija/field-recordings'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'build', 'payload')
SR = 48000

# The six sources, by the names they carry on the recorder. Numbered here in
# the order they were made, which is also the order they sort in.
FILES = {
    1: 'Voice 260811_213809.m4a',
    2: 'Voice 260812_114708 jadrija cicadas.m4a',
    3: 'Voice 260813_174530 jadrija ambience.m4a',
    4: 'Voice 260816_194310 jadria pier.m4a',
    5: 'Voice 260817_150851 jadrija sibenik boat.m4a',
    6: 'Voice 260817_153025 jadrija ambience - cicadas - walking - '
       'through - magical - forest.m4a',
    7: 'WhatsApp Audio 2026-08-23 at 5.50.13 AM - radio.mp4',
    # Not a recording — the sound track of the six-minute 4K pan along the
    # kabine of 23 Aug, which is in the survey folder and not in with the
    # others. An absolute path, because it does not live under SRC.
    8: '/mnt/c/tmp/refs/jadrija/survey/4/'
       '1000150414-super-valuable-pan-kabine-and-other-stuffs.mp4',
    9: 'WhatsApp Audio 2026-08-24 at 8.54.48 AM - fs.mp4',
}
# 1 is not cut. It was recorded at 21:38 and is broadband 200-2000 Hz with no
# cicada and no cricket band in it; nobody has been able to say what it is, and
# the game has no night to put it in anyway. Naming it would be inventing it.

# ── the beds ────────────────────────────────────────────────────────────────
#
# `rate` and `hp`/`lp` are unchanged from the first cut, deliberately: the
# levels and the timbre of these five have been listened to and liked, and the
# only thing this pass is allowed to change is how much of each recording is in
# them and how they are mixed. `rms` is the measured RMS of the clip that
# shipped, to the hundredth of a decibel, so the new cut lands at exactly the
# loudness the old one was heard at.
#
# `window` is the stretch of the source the search is allowed to look in, and it
# is the only place a judgement about content is made:
#
#   shore    all of the promenade recording. It runs 27.6 s and there is no
#            more of it; 26 s is the whole thing bar a handling bump at each end.
#   cicadas  the chorus is in the first twelve seconds of the hillside
#            recording and after that it is 15 dB down and gone — the 4.2-6.2
#            kHz band drops from -38 to -55 at second twelve and never comes
#            back. So this bed is eleven seconds, and 80-audio doubles it.
#   wood     the walk is 104 s and the chorus is in nearly all of it. The last
#            twelve seconds are the walk back out, where the band drops 15 dB.
#   lapping  the pier, all of it. 73 s.
#   boat     two minutes of diesel at a very steady 65 Hz. Any window will do,
#            which is why this one has the cleanest seam of the five.
#   radio    the transistor set in the kabina, 23 Aug, and the only one of
#            these that is not a place. The first 2.2 s are the recorder being
#            put down at -37 dBFS; after that it is level to the end.
#
# `bar` is for the radio and for nothing else, and it is the only judgement in
# this file that is about music rather than about noise. A seam is scored on
# level and spectrum, both of which are blind to a beat — and a beat is the one
# thing an ear tracks without being asked, so a loop that joins beautifully in
# both and lands three tenths of a second early in the bar is heard as a skip
# every time it comes round. Constrain the LENGTH to a whole number of bars and
# the pulse carries across the seam whatever the start offset is. The harmony
# can still step; the pulse cannot, and the pulse is what gives a loop away.
#
# 127.06 bpm, measured by combing the onset envelope over periods from 0.40 to
# 0.55 s at a fifth of a millisecond and summing the response at one, two and
# four beats: 0.47220 s a beat, 1.88880 s a bar, comb score 0.79 against a
# noise floor of about 0.1. Twenty bars is 37.8 s and the source gives 39.2.
BEDS = [
    dict(key='shore',   src=3, window=(0.6, 26.9), length=(23.0, 26.0),
         rate=22050, kbps=96, hp=(3, 180), lp=None,  rms=-28.16,
         what='the promenade, 13 Aug'),
    dict(key='cicadas', src=2, window=(0.3, 12.2), length=(9.5, 11.5),
         rate=24000, kbps=96, hp=(8, 1900), lp=(2, 10500), rms=-25.17,
         what='the hillside, 12 Aug'),
    dict(key='wood',    src=6, window=(2.0, 92.0), length=(52.0, 76.0),
         rate=24000, kbps=96, hp=(6, 2400), lp=(2, 10500), rms=-25.23,
         what='inside the pines, 17 Aug'),
    dict(key='lapping', src=4, window=(0.6, 72.4), length=(52.0, 70.0),
         rate=22050, kbps=96, hp=(3, 180), lp=None,  rms=-23.98,
         what='the pier, 16 Aug'),
    dict(key='boat',    src=5, window=(1.0, 119.0), length=(34.0, 44.0),
         rate=16000, kbps=64, hp=(2, 45),  lp=None,  rms=-20.45,
         what='the channel off Sibenik, 17 Aug'),
    # -18.94 dBFS is not a taste: it is the level the three synthesised stations
    # it replaces came out of the rig at. Those were measured by rebuilding
    # `radioNote` in numpy and running each station through the old rig at the
    # near end of its sweep — a 1320 Hz bandpass at Q 0.62 into a 340 Hz
    # highpass — which put them at -18.55, -19.41 and -19.39 dBFS, mean -19.11.
    # The new rig is a 150 Hz highpass and a 6 kHz lowpass, which costs a
    # unit-RMS clip 0.17 dB, so the file goes in 0.17 dB hotter and the room
    # hears exactly what it heard before. The source rolls off 17 dB by 4 kHz
    # and is 37 dB down by 8 kHz, so 16 kHz sampling throws nothing away.
    # ── the rows ────────────────────────────────────────────────────────────
    #
    # The one bed in here that is not from the recorder. Misha's note on the
    # 23 Aug batch says the pan "can be harvested for its AUDIO — you get the
    # sea splashing against the rock and the sounds of people around the
    # kabine", and it can, and it is the right source for it — but not for the
    # reason it is the obvious one, so both candidates were measured.
    #
    # There is also a dedicated 61 s recording made the same evening and named
    # `jadrija - kabine - water`, which is the obvious choice and is the wrong
    # one. Normalised to unit RMS and read in third-octave bands it is a
    # bottom-heavy recording and almost nothing else: -13.9 dB at 60-120 Hz and
    # -11.7 at 120-250, then falling off a cliff — -27.7 by 2.8 kHz, -38.1 by
    # 7 kHz, thirteen decibels under the shipped promenade clip in the band
    # where voices live. That is a pocket and a hand on a phone, not a beach.
    #
    # The pan's own track, over its first minute, is flat: -13.9 at 250-500,
    # -15.7 at 500-900, -16.9 at 900-1600 and still -22.2 at 4.6 kHz. It is
    # 9 dB quieter overall — the phone's gain rides down under a 4K capture —
    # and level is the one thing normalisation fixes for nothing.
    #
    # What is in that first minute is the walk along the front of the row: the
    # water working the concrete a couple of metres below, children, flip-flops
    # on the slab, a family going past close enough to hear the words. Which is
    # a different sound from `shore` and not a louder one — `shore` is two
    # hundred people at forty metres and this is four people at two, so the two
    # of them divide by position the way the sea and the pines already do.
    dict(key='kabine',  src=8, window=(1.0, 62.0), length=(38.0, 56.0),
         rate=22050, kbps=96, hp=(3, 180), lp=(2, 10500), rms=-28.16,
         what='along the rows, 23 Aug'),
    dict(key='radio',   src=7, window=(2.2, 41.3), length=(26.4, 37.8),
         rate=16000, kbps=48, hp=(2, 60),  lp=None,  rms=-18.94,
         bar=1.88880, what='the set in the kabina, 23 Aug'),
]

# ── the cues ────────────────────────────────────────────────────────────────
#
# One so far: what plays when the girl on the beach turns.
#
# WHAT THE SOURCE IS, measured and not guessed, because rule 12 applies to a
# recording as much as to a shopfront. 122.77 s, mono, 48 kHz. Normalised to
# unit RMS and read in third-octave bands it is -39.1 dB at 60-120 Hz, -26.9 at
# 120-250, then up to a plateau of -13.4 to -13.0 across 900-4600 and still
# -19.9 at 7-11 kHz. That shape is not a place: the six field recordings all
# carry 12 to 20 dB more below 250 Hz than this does. It is the shape the
# `radio` source has — -42.4, -26.4, then a plateau — and the radio is a small
# speaker recorded on a phone. So this is music, played out of a speaker, into
# the same phone.
#
# It has a tempo, and it does not drift: the onset envelope autocorrelates at
# 0.536 over the whole two minutes at a lag of 3.3925 s, with the half and the
# eighth of that lag under it. **0.42406 s a beat, 141.49 bpm, and eight beats
# to a two-bar phrase.** That is worth two decimal places because the game's
# own beat is 0.43 s — the synth this replaces was pinned to `FIRE_DUR` in
# tools/blender/human_mh.py so that her boot lands on the beat, and 141.49
# against 139.53 would walk three quarters of a beat apart over the 26 s the
# routine used to run for. 80-audio.js plays the clip at 1.0140 to close that,
# which is 24 cents of pitch and is why the tempo is measured here rather than
# rounded.
#
# It survived the window going four times longer, which was not a given: two
# decimal places of beat is 255 beats of accumulation over the cue that ships
# now, and a tenth of a per cent out would be half a beat by the end of it.
# Re-measured by folding the onset envelope onto a candidate phrase length over
# the whole 8.50-117.06 s and taking the length whose folded profile has the
# most contrast, the answer is 3.39270 s a phrase against the 3.39248 written
# here — 0.22 ms a phrase, 7 ms over the whole cue, and the folding score at
# the shipped value is 0.4846 against the peak's 0.4907. So the constant
# stands.
#
# WHERE THE WINDOW IS. The recording has a shape and the shape is what chose
# it. There is a stop-start intro: the track drops to -39 dB or lower for
# about half a second at the end of every phrase, at 4.6, 8.0, 11.4, 14.7 and
# 18.1 s, the gaps getting shallower each time, and from 25.1 s on there are no
# gaps at all and it runs level to the end. So the first 25 s builds and the
# rest sits.
#
# The window starts 1.1154 s before the downbeat at 8.5030 s. The lead-in is
# deliberate and is the whole reason the start is not on the beat: `FIRE.lead`
# is 1.10 s of game time, the length of the `flare` clip, and what has to land
# on the downbeat is her first stamp — so the clip has to carry 1.10 s of game
# time, 1.1154 s of source, in front of its own downbeat. What is in that
# 1.1154 s here is the deepest gap in the recording, falling from -24 to
# -41 dB. It is a hole in front of the hit, which is what the riser it replaces
# was for. Measured over the candidate downbeats, this one has the biggest step
# across its downbeat of any window in the file — the lead-in is -29.56 dBFS
# against -23.10 for the bar after it, +6.46 dB.
#
# WHERE IT ENDS, which is a measurement and not the length of the file. The
# record stops at 117.10 s and the last 5.67 s of the recording is not it. At
# 117.10 the level steps from -22.4 dBFS to -25.3 and then to -28.4 across
# 119.50-120.45, and — the part that says what it is — the top goes with it:
# the 5-11 kHz band carries -13.3 dB of the energy up to 117.06 and -18.1 dB
# after it. On the spectrogram everything above about 5 kHz simply stops on one
# frame and what is left is a couple of harmonic stacks down at 1-3 kHz. It is
# the speaker being turned off or walked away from, with the phone still
# running. Cutting to 122.77 because that is where the file ends would ship six
# seconds of somebody's room.
#
# So the window is the lead-in plus **32 phrases**, 109.67476 s, ending at
# 117.06231 s — 38 ms before the step. That the record's own last hit sits at
# 117.04, inside the bar this boundary closes, is the corroboration: counting
# thirty-two phrases off that downbeat lands on the end of the music to within
# a fortieth of a second, which a wrong phrase length could not do.
#
# 109.6748 s of source is 108.1592 s at 1.0140, against a routine that is
# `FIRE.lead` plus `SHOW.blazeFor` — 1.10 + 106.3 — and a 0.45 s stop fade, so
# 107.85 s. The clip outlasts the longest turn by three tenths of a second,
# which is the margin the 28 s cut had, and there is nothing left in the
# recording to make it longer with.
#
# THE LEVEL, which is measured the way the radio's was and then cannot be
# written here.
#
# Measured first: the `firestarter` synth was lifted whole out of 80-audio.js
# into an OfflineAudioContext — `fireInit`, `fireRiser`, the crash, and
# `fireBeat` scheduled on the same grid `fireTick` schedules it on, with
# `fireBus.gain` pinned at 1 so what is read is what feeds the bus — and
# rendered at 48 kHz. It comes out at **-14.228 dBFS RMS** over the beat,
# -14.402 over the whole cue including the riser, and it PEAKS at -1.62. A
# crest factor of 12.6 dB.
#
# This recording's crest factor over the chosen window is 17.62 dB, and it is
# the material and not a click: 10 270 samples in the window are over half the
# peak. So a file normalised to -14.23 dBFS RMS peaks at **+3.39 dBFS** and is
# a clipped file. That is not a window that can be picked again — every
# candidate downbeat in the recording comes out between 16.9 and 18.5 dB of
# crest — and the note above `finish` is right that the answer is not a
# limiter.
#
# So the level match is split. The file ships at -18.13 dBFS RMS, which puts
# its peak at the -0.50 dBFS `finish` allows, and 80-audio.js puts the
# difference back on the sample's own gain node — so what reaches `fireBus` is
# at `target`, -14.23 dBFS, and the room hears the cue at the level it heard
# the synth at. Nothing clips on the way: the peak at the bus INPUT is +3.39
# dBFS whichever way the split is made, and the bus is at `FIRE.gain` 0.50, so
# what arrives at the master peaks at -2.62 dBFS against the synth's -7.64.
# Louder in the peaks by 5.0 dB, identical in RMS, and that difference is
# simply what music is next to a drum machine.
#
# The tenth of a decibel between this and the -18.03 the 28 s cut shipped at is
# the whole reason `finish` checks the peak instead of assuming it, and the
# check earned its keep here: the loudest single sample in the recording is at
# 115.83 s, which is inside the long window and was nowhere near the short one,
# and re-cutting at -18.03 came back `!! firestarter peaks at -0.41 dBFS — pick
# again`. A longer window catches a louder peak. It is written on the tin.
#
# `makeup` is not -18.13 subtracted from -14.23, and the 0.59 dB it is out by
# is the encoder. LAME at 80 kbps mono into 24 kHz throws away everything over
# about 11 kHz, and this source still carries -19.9 dB of its energy in the
# 7-11 kHz band and more above it, so the clip that comes BACK out of the file
# is 0.59 dB quieter than the one that went in. `cut_cue` decodes the mp3 it
# just wrote and reads it, rather than trusting the number it asked for; the
# constant below is that measurement and the tool shouts if a re-cut moves it.
# This is the same correction the `radio` bed carries for its own rig, applied
# at the other end of the chain.
#
# THE BITRATE STAYS AT 80. Four times the window is four times the file — 277
# KB became 1 072, and base64 in the page makes that 1 429 KB against 369, so
# the build goes from 23.91 MB to 24.95. 64 kbps was cut and measured as the
# alternative and saves 214 KB of that (286 KB in the page, 1.1% of the
# build), which is not enough to pay for taking a bitrate off the one piece of
# music in the game — every other clip in the payload is a bed under something
# and this one is the thing you are listening to.
CUES = [
    dict(key='firestarter', src=9, at=7.38755, sec=109.67476,
         rate=24000, kbps=80, hp=(2, 70), lp=None, rms=-18.13,
         target=-14.23, makeup=4.49, what='the turn, 24 Aug'),
]

INSET = 0.5     # s — where 80-audio.js puts loopStart and loopEnd
MATCH = 0.35    # s — how much of each end the seam is judged on
STEP = 0.02     # s — the search grid


def source(bed):
    """Where bed's source file is. FILES may carry an absolute path."""
    f = FILES[bed['src']]
    return f if os.path.isabs(f) else os.path.join(SRC, f)


def decode(path):
    """One source recording as float64 mono at 48 kHz."""
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR),
         '-f', 's16le', '-'], stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, '<i2').astype(np.float64) / 32768.0


def bands(x, sr):
    """Third-octave-ish energies, in dB, for the seam's spectral distance."""
    f, P = sig.welch(x, sr, nperseg=min(2048, len(x)))
    edges = [120, 250, 500, 900, 1600, 2800, 4600, 7000, 11000, 16000]
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (f >= lo) & (f < hi)
        out.append(10 * np.log10(max(P[m].sum(), 1e-20)) if m.any() else -200.0)
    return np.array(out)


def seam(x, a, L, sr):
    """
    How badly the two ends of the window [a, a+L] would join, in decibels.

    The head is what plays just after the loop point and the tail is what plays
    just before it, so those are the two the ear hears back to back for ever.
    Level counts double: a step in loudness is heard as an edit, where a step in
    colour is heard as the wind changing.
    """
    i = int((a + INSET) * sr)
    j = int((a + L - INSET - MATCH) * sr)
    n = int(MATCH * sr)
    head, tail = x[i:i + n], x[j:j + n]
    if len(head) < n or len(tail) < n:
        return 1e9, 0.0, 0.0
    dl = 20 * np.log10(max(np.sqrt(np.mean(head ** 2)), 1e-9)
                       / max(np.sqrt(np.mean(tail ** 2)), 1e-9))
    ds = float(np.mean(np.abs(bands(head, sr) - bands(tail, sr))))
    return 2.0 * abs(dl) + ds, dl, ds


def pick(x, bed, sr):
    """
    The best window, longest-first among the ones that join well.

    Length is not free to collapse: a seam is a fraction of a second and a
    period is the whole point, so a window that is two seconds longer is worth
    a tenth of a decibel of seam. That is what the `- 0.05 * L` is, and without
    it this search returns the shortest length on offer every time.
    """
    w0, w1 = bed['window']
    best = None
    # Whole bars for anything that has a beat in it, half-second steps for
    # everything else. See the note on `bar` above.
    drop = bed.get('bar', 0.5)
    L = bed['length'][1]
    if bed.get('bar'):
        L = drop * int(L / drop + 1e-9)
    while L >= bed['length'][0] - 1e-9:
        a = w0
        while a + L <= w1 + 1e-9:
            s, dl, ds = seam(x, a, L, sr)
            score = s - 0.05 * L
            if best is None or score < best[0]:
                best = (score, a, L, s, dl, ds)
            a += STEP
        L -= drop
    return best


def filt(y, spec):
    """
    The filters, at 48 kHz and before the resample, so the resampler's own
    anti-alias is the only thing shaping the top and nothing has to be undone.
    """
    if spec['hp']:
        y = sig.sosfiltfilt(sig.butter(spec['hp'][0], spec['hp'][1],
                                       btype='high', fs=SR, output='sos'), y)
    if spec['lp']:
        y = sig.sosfiltfilt(sig.butter(spec['lp'][0], spec['lp'][1],
                                       btype='low', fs=SR, output='sos'), y)
    return y


def finish(spec, y):
    """
    To the level the clip it replaces was heard at, exactly, and then encoded.

    A longer window catches more of whatever the loudest thing in the recording
    is — somebody shouting on the pier is 8 dB over the rest of it — and the
    level is set by RMS, so the peak has to be checked and not assumed.
    Anything over -0.5 dBFS would clip the decoder rather than the file; nothing
    here comes near it, and if something ever does the answer is a different
    window, not a limiter.
    """
    y = y * (10 ** (spec['rms'] / 20) / max(np.sqrt(np.mean(y ** 2)), 1e-12))
    peak = 20 * np.log10(np.max(np.abs(y)))
    if peak > -0.5:
        print(f"  !! {spec['key']} peaks at {peak:+.2f} dBFS — pick again")
    tmp = f"/tmp/cut_{spec['key']}.wav"
    import scipy.io.wavfile as wav
    wav.write(tmp, SR, (np.clip(y, -1, 1) * 32767).astype('<i2'))
    dst = os.path.join(OUT, spec['key'] + '.mp3')
    subprocess.run(['lame', '--quiet', '-m', 'm', '--resample',
                    str(spec['rate'] / 1000.0), '-b', str(spec['kbps']),
                    '--cbr', tmp, dst], check=True)
    return os.path.getsize(dst) / 1024.0, peak


def cut(bed):
    x = decode(source(bed))
    score, a, L, s, dl, ds = pick(x, bed, SR)
    y = filt(x[int(a * SR):int((a + L) * SR)].copy(), bed)
    kb, peak = finish(bed, y)
    print(f"  {bed['key']:<12s} {L:5.1f} s  from {a:6.2f} s of r{bed['src']}  "
          f"{bed['rate']:5d} Hz {bed['kbps']:3d}k {kb:6.1f} KB  "
          f"seam {dl:+.2f} dB level, {ds:.2f} dB spectrum  peak {peak:+.1f}")
    return dict(bed, sec=L, at=a, kb=kb, seam_l=dl, seam_s=ds, peak=peak)


def cut_cue(cue):
    """
    A one-shot, at a window somebody chose by hand.

    No seam, no inset, no search: the clip is played once and stopped, so both
    of its ends are heard exactly once and neither is heard next to the other.
    Everything this shares with a bed is in `filt` and `finish`.

    What it does that no bed does is read the file back. A bed's level is set
    by RMS before the encoder and that is the end of it, because a bed is
    crossfaded against other beds cut the same way and they all lose the same
    top. A cue is levelled against a SYNTHESISER, and the number that has to
    match is the one that comes out of the decoder — so the mp3 is decoded
    again here and the make-up the game has to apply is measured rather than
    subtracted.
    """
    x = decode(source(cue))
    a, L = cue['at'], cue['sec']
    y = filt(x[int(a * SR):int((a + L) * SR)].copy(), cue)
    kb, peak = finish(cue, y)
    back = decode(os.path.join(OUT, cue['key'] + '.mp3'))
    got = 20 * np.log10(np.sqrt(np.mean(back ** 2)))
    dpk = 20 * np.log10(np.max(np.abs(back)))
    makeup = cue['target'] - got
    if abs(makeup - cue['makeup']) > 0.05:
        print(f"  !! {cue['key']}: 80-audio.js carries makeup {cue['makeup']:+.2f} dB "
              f"and this cut needs {makeup:+.2f} — FIRE.samp is wrong")
    print(f"  {cue['key']:<12s} {L:5.1f} s  from {a:6.2f} s of r{cue['src']}  "
          f"{cue['rate']:5d} Hz {cue['kbps']:3d}k {kb:6.1f} KB  "
          f"one-shot, decodes at {got:+.2f} dBFS, makeup {makeup:+.2f}"
          f"      peak {peak:+.1f}/{dpk:+.1f}")
    return dict(cue, kb=kb, peak=peak, got=got, need=makeup)


if __name__ == '__main__':
    only = sys.argv[1:] 
    rows = [cut(b) for b in BEDS if not only or b['key'] in only]
    rows += [cut_cue(c) for c in CUES if not only or c['key'] in only]
    print()
    print('  clip          source                        s    rate  kbps     KB')
    for r in rows:
        print(f"  {r['key']:<12s}  {r['what']:<26s} {r['sec']:5.1f}  "
              f"{r['rate']:5d}  {r['kbps']:4d}  {r['kb']:6.1f}")
    print(f"  total {sum(r['kb'] for r in rows):.0f} KB")
