#!/usr/bin/env python3
"""Baye's bucket going over, conditioned from a recording of a real one.

    python3 tools/cut_pour.py            # writes build/payload/pour.mp3
    python3 tools/cut_pour.py --wav      # and a listening copy in build/

SOURCE, AND ITS LICENCE. `assets/audio/pour_freesound_421184_inspectorj.mp3` —
"Water, Pouring, A.wav" by InspectorJ (Jonathan Shaw) on freesound.org, CC BY
4.0, a tub of icy water poured onto snow-laden concrete with the microphone
about half a metre from the splash. Credited in `assets/audio/CREDITS.md` and
in the README, and the changes this tool makes are listed below, which is what
that licence asks for. It permits redistribution and modification including
commercially, which matters here because the build base64s every asset into one
public HTML file in a public repository.

THIS FILE USED TO SYNTHESISE THE SOUND AND THE SYNTHESIS WAS BAD. Misha, 10 Sep
2026: *"omg your water poured out sounds like shit!"*. He was right, and the
measurement that says why is worth keeping, because it is not the one the first
version was reasoning about.

That version modelled the physics carefully — Minnaert bubbles with the upward
chirp, glugs for the bucket taking air, a separate impact layer — and got the
ENVELOPE wrong, which turned out to be the only thing that mattered. Stepped in
50 ms windows it went to -10.4 dBFS within 0.2 s and then sat between -9.8 and
-10.8 for eight hundred milliseconds: a trapezoid. Measured the same way, a
real vessel being tipped is a RAMP —

    -41.1  -47.4  -41.1  -34.2  -27.8  -25.8  -17.5  -15.7   dBFS
     0.20   0.30   0.40   0.50   0.60   0.70   0.80   0.90    s

— twenty-five decibels of swell across nine hundred milliseconds, because the
flow rate climbs as the angle does and a bucket does not pour at a constant
rate at any point in its travel. No amount of bubble modelling fixes a
plateau, and the bubbles were never what was wrong.

A SECOND CANDIDATE WAS REJECTED ON THE SAME MEASUREMENT. Freesound 174637 by
altfuture is CC0 rather than CC BY, so it would have cost no attribution at
all — but stepped the same way it peaks at 0.25 s and is gone by 0.70: a splat.
It is water hitting the ground, thrown, not water leaving a vessel. The licence
was the cheaper one and the sound was the wrong event.

WHAT IS CHANGED, which is the list CC BY asks for:

  1. TRIMMED 0.438 s off the head. The source peaks 0.938 s in; her stream
     peaks 0.50 s after it starts, traced at 1/60 s — `st.pour` is zero until
     0.52, peaks at 1.02 and is dry by 1.23 — and the sound is fired on the
     stream's rising edge. Trimming to put the recording's peak 0.50 s from
     its own start lands the two peaks within 50 ms of each other. Nothing is
     trimmed off the tail: what is left runs 2.40 s, and the water on the
     ground is still moving long after her pail is empty.
  2. Downmixed to mono and resampled to 22 050 Hz, which is `shore.mp3` and
     `lapping.mp3`, the two beds in this game that are already water.
  3. Levelled to -13.0 dBFS RMS through a soft knee — see the note there.
  4. Six milliseconds of fade at each end, so the decoder's own padding never
     lands on a step.

DETERMINISTIC, like everything else build.py commits.
"""

import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'audio',
                   'pour_freesound_421184_inspectorj.mp3')
OUT = os.path.join(ROOT, 'build', 'payload')

SR = 22050
KBPS = 96
HEAD = 0.438          # s off the front — see note 1
RMS = -13.0
PEAK = -0.8
FADE = 0.006


def main(argv):
    if not os.path.exists(SRC):
        sys.exit(f'missing source: {SRC}\n'
                 'It is CC BY 4.0 and committed to this repo; see '
                 'assets/audio/CREDITS.md')
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', SRC, '-f', 'f32le', '-ac', '1',
         '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64).copy()
    y = y[int(HEAD * SR):]

    y -= y.mean()
    y /= np.sqrt((y ** 2).mean())
    # SOFT KNEE AND NOT A CEILING, because water has a crest factor and a hard
    # rescale to the tallest sample spends it. tanh at three times RMS rounds
    # the half-dozen tallest transients and leaves the body of the sound alone.
    y = np.tanh(y / 3.0) * 3.0
    y *= 10 ** (RMS / 20.0) / np.sqrt((y ** 2).mean())
    pk = np.abs(y).max()
    lim = 10 ** (PEAK / 20.0)
    if pk > lim:
        y *= lim / pk
    k = int(FADE * SR)
    y[:k] *= np.linspace(0, 1, k)
    y[-k:] *= np.linspace(1, 0, k)

    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, 'pour.mp3')
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{KBPS}k', dst],
        input=pcm, check=True)
    if '--wav' in argv:
        # NOT in build/payload. Everything in that directory is base64'd into
        # the page by `bundle_payload`, which does not care what it is.
        wav = os.path.join(ROOT, 'build', 'pour.wav')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR),
                        '-ac', '1', '-i', 'pipe:0', wav], input=pcm, check=True)
        print(f'  wrote {wav}')
    print(f'  wrote {dst}  {len(y) / SR:.2f}s  '
          f'{os.path.getsize(dst) / 1024.0:.1f} KB  {SR} Hz  {KBPS} kbps')
    print(f'  RMS {20 * np.log10(np.sqrt((y ** 2).mean())):.1f} dBFS   '
          f'peak {20 * np.log10(np.abs(y).max()):.1f} dBFS')


if __name__ == '__main__':
    main(sys.argv[1:])
