#!/usr/bin/env python3
"""Cut the Bucketeers of America song down to what a radio can carry.

Misha, 7 Sep: "we now have the 'Bucketeers of America' song, that we can hear
playing on the radio, when we stand on the 1st floor of the vikendica, in the
front yard". Two mixes arrived, 20.27 s and 23.98 s, both 256 kbps 44.1 kHz
stereo, 1 418 KB between them, and both are full-band modern masters: -6.3 and
-6.6 dBFS RMS, flat to 16 kHz, with -8.4 dB of their energy below 120 Hz.

None of that reaches the ear this is written for. What plays it is a plastic
set on a shelf in the boravak, heard from the yard through an open slider, and
this script is where the set's own front end lives — the half of it that is
cheaper to bake once than to compute sixty times a second.

A THIRD PIECE IS COMING and this file is where it goes: a humming version of
the same tune for the Bucketeer to carry with her. It is not here yet, it is
not a radio, and it will not want this filtering — so it gets its own row when
it arrives rather than being squeezed into these two.

WHY 200 Hz AND 6 kHz, measured rather than chosen.

build/payload/radio.mp3 is a REAL small radio: the transistor set in the
kabina, recorded standing over it on 23 Aug. So the game already contains a
measurement of what a 60 mm paper cone in a plastic box does to music, and the
only honest thing to do with a studio master is to match it. Normalised to unit
RMS and read in octave-ish bands, in dB:

                      60    120    250    500    900   1600   2800   4600
    kabina radio    -43.8  -26.0  -15.7  -12.3  -16.5  -13.4  -21.4  -21.9
    song, raw       -15.9  -18.6  -18.9  -12.3  -14.2  -17.8  -23.9  -30.5
    song, hp 150    -34.5  -21.0  -18.1  -11.3  -13.2  -16.9  -23.6  -33.9
    song, hp 200    -43.3  -24.6  -18.5  -11.1  -13.0  -16.7  -23.4  -33.7
    song, hp 260    -51.8  -29.7  -19.5  -11.0  -12.8  -16.5  -23.2  -33.5

A second-order high-pass at 200 Hz — fourth order once `sosfiltfilt` has run it
both ways — lands the bottom two bands within half a decibel of the real set.
150 leaves 9 dB too much at 60 Hz, which is a bass cabinet and not a radio; 260
takes 6 dB too much and starts on the telephone that cut_field.py's radio note
warns about. So 200, and it is a match and not a taste.

The top is the other end of the same argument and is worth less: the song has
little up there to begin with (-33.7 at 4.6 kHz against the real set's -21.9,
because that recording carries a phone's own hiss and room). 6 kHz is where
`radioTune` already lids the kabina set at the near end of its sweep, and this
is the same radio, so it is the same number — and lidding here rather than in
the game means the encoder does not spend bits on 6-8 kHz that a biquad throws
away a moment later.

WHY 16 kHz AND 48 kbps, likewise measured. Encoded from the band-limited
reference and decoded again, the error left in 180-5800 Hz, aligned for the
coder's delay:

        16 kHz  32k   79 KB   16.5 dB SNR
        16 kHz  40k   99 KB   20.2
        16 kHz  48k  119 KB   22.4
        16 kHz  56k  139 KB   23.9
        16 kHz  64k  159 KB   24.8

The knee is at 48k and that is also, exactly, what `radio.mp3` ships at — same
rate, same bitrate, same encoder — so the two sets in this game are the same
set. 22.4 dB SNR puts the coder's noise at -41 dBFS against a clip that ships
at -18.94; in the yard the radio plays about 13 dB under its own file level, so
that noise arrives at about -55 dBFS with a beach at -32 over the top of it.

-18.94 dBFS is not a taste either: it is `radio.mp3`'s own shipped RMS, so the
two sets are levelled to each other and the game's gain is a distance and a
wall rather than a fader that also has to fix a mastering difference.

    python3 tools/cut_song.py            # both
    python3 tools/cut_song.py bucketeers1
"""

import os
import sys

import numpy as np

from cut_field import SR, decode, filt, finish

SRC = '/mnt/c/tmp/flamme-retarde'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'build', 'payload')

# `at`/`sec` are the whole of each file: neither is a window into something
# longer that we get to choose from, they arrived already cut. Both start and
# both end mid-phrase at full level, which is the fact that decides how the
# game plays them — see SONG in src/80-audio.js, which fades a bar in and a bar
# out because there is no other honest way to start and stop a fragment.
SONGS = [
    dict(key='bucketeers1', src='bucketeers-of-america1.mp3',
         at=0.0, sec=20.27, rate=16000, kbps=48, rms=-18.94,
         hp=(2, 200), lp=(2, 6000),
         what='Bucketeers of America, mix 1'),
    dict(key='bucketeers2', src='bucketeers-of-america2.mp3',
         at=0.0, sec=23.98, rate=16000, kbps=48, rms=-18.94,
         hp=(2, 200), lp=(2, 6000),
         what='Bucketeers of America, mix 2'),
]


def cut_song(s):
    """One mix, band-limited to the set that plays it, and levelled to it."""
    path = os.path.join(SRC, s['src'])
    if not os.path.exists(path):
        sys.exit(f"error: {path} is not there — the masters live outside the "
                 f"repo and are not committed")
    src_bytes = os.path.getsize(path)
    x = decode(path)
    end = min(len(x), int((s['at'] + s['sec']) * SR))
    y = filt(x[int(s['at'] * SR):end].copy(), s)
    # 8 ms at each end, as cut_birds does, and for the same reason: the game
    # fades these over a bar and a fade cannot be relied on to have started
    # before the first sample. Applied before the level is read, so it cannot
    # move it.
    n = int(0.008 * SR)
    y[:n] *= np.linspace(0, 1, n)
    y[-n:] *= np.linspace(1, 0, n)
    kb, peak = finish(s, y)
    # Read back what the decoder actually hands the game. `SONG.gain` in
    # src/80-audio.js is scaled against this number and not against the RMS
    # written above it — a 16 kHz 48k encode of a dense master is not the file
    # that went in, and the level the room hears is the one that comes out.
    back = decode(os.path.join(OUT, s['key'] + '.mp3'))
    got = 20 * np.log10(np.sqrt(np.mean(back ** 2)))
    dpk = 20 * np.log10(np.max(np.abs(back)))
    print(f"  {s['key']:<12s} {s['sec']:5.2f} s  {src_bytes / 1024:7.1f} KB in, "
          f"{kb:6.1f} KB out ({src_bytes / 1024 / kb:4.1f}x)  "
          f"{s['rate']:5d} Hz {s['kbps']:3d}k  "
          f"decodes at {got:+.2f} dBFS RMS, crest {dpk - got:4.1f} dB, "
          f"peak {peak:+.1f}/{dpk:+.1f}")
    return dict(s, kb=kb, src_kb=src_bytes / 1024, got=got, peak=peak)


if __name__ == '__main__':
    only = sys.argv[1:]
    rows = [cut_song(s) for s in SONGS if not only or s['key'] in only]
    print(f"\n  {sum(r['src_kb'] for r in rows):.0f} KB of masters -> "
          f"{sum(r['kb'] for r in rows):.0f} KB shipped, which is "
          f"{sum(r['kb'] for r in rows) * 4 / 3:.0f} KB once build.py has "
          f"base64'd it into the bundle")
