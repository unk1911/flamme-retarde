#!/usr/bin/env python3
"""The kiss, from the moment her lips reach yours to when they leave.

    python3 tools/cut_kiss.py            # writes build/payload/kiss.mp3

Misha, 25 Sep 2026: *"i no longer hear the kissing sound, during the kiss,
there should be kissing sound, here is one ... kiss.mp3"*. The source is that
file, committed as `assets/audio/kiss_misha.mp3` — see
`assets/audio/CREDITS.md` for where it is from.

WHAT IS CHANGED:
  1. CUT to 0.52–4.46 s. Stepped in 50 ms windows the source is five smacks —
     0.60, 1.75, 2.90, a double at 3.15, and 4.25 s — in 5.04 s of room tone.
     Her lips arrive `SHOW.kissIn` (0.75 s) into the kiss and stay
     `SHOW.kissHold` (3.4 s); the clip is fired on the arrival, so the first
     smack is contact, three are the hold and the last is her leaving.
  2. Downmixed to mono and resampled to 22 050 Hz.
  3. Peak normalised to -1.0 dBFS: it is five transients in near-silence,
     and an RMS target would be a statement about the silence.
  4. Ten milliseconds of fade in and fifty out.

DETERMINISTIC, like everything else build.py commits.
"""
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'audio', 'kiss_misha.mp3')
OUT = os.path.join(ROOT, 'build', 'payload')
SR = 22050
KBPS = 64
CUT = (0.52, 4.46)    # s — see note 1
PEAK = -1.0
FADE_IN, FADE_OUT = 0.010, 0.050


def main(argv):
    if not os.path.exists(SRC):
        sys.exit(f'missing source: {SRC}')
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', SRC, '-f', 'f32le', '-ac', '1',
         '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64).copy()
    y = y[int(CUT[0] * SR):int(CUT[1] * SR)]
    y -= y.mean()
    y *= 10 ** (PEAK / 20.0) / np.abs(y).max()
    a, b = int(FADE_IN * SR), int(FADE_OUT * SR)
    y[:a] *= np.linspace(0, 1, a)
    y[-b:] *= np.linspace(1, 0, b)

    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, 'kiss.mp3')
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{KBPS}k', '-map_metadata', '-1',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', dst],
        input=pcm, check=True)
    print(f'  wrote {dst}  {len(y) / SR:.2f}s  '
          f'{os.path.getsize(dst) / 1024.0:.1f} KB  {SR} Hz  {KBPS} kbps')


if __name__ == '__main__':
    main(sys.argv[1:])
