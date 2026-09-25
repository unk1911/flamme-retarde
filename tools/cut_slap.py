#!/usr/bin/env python3
"""The slap, when you click with the crosshair on her backside in the kabina.

    python3 tools/cut_slap.py            # writes build/payload/slap.mp3

Misha, 25 Sep 2026: *"if cross-hairs click on her butt, play the sound on
synology at: b_0.ogg"*. The source is that file, committed as
`assets/audio/slap_b_0.ogg` — see `assets/audio/CREDITS.md` for where it is
from.

WHAT IS CHANGED:
  1. CUT to 0.02–0.46 s. Stepped in 25 ms windows the source is silent to
     0.03 s, one hit peaking at 0.05 s (-11 dBFS RMS in the window), a decay
     to -55 dBFS by 0.33 s, and 1.5 s of nothing after it. Starting on the hit
     is what makes it land on the click.
  2. Downmixed to mono and resampled to 22 050 Hz.
  3. Peak normalised to -1.0 dBFS and NOT levelled by RMS: it is one
     transient, and an RMS target on a transient is a statement about how
     long the silence after it is.
  4. Three milliseconds of fade in (it must not soften the hit) and twenty
     out.

DETERMINISTIC, like everything else build.py commits.
"""
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'audio', 'slap_b_0.ogg')
OUT = os.path.join(ROOT, 'build', 'payload')
SR = 22050
KBPS = 64
CUT = (0.02, 0.46)    # s — see note 1
PEAK = -1.0
FADE_IN, FADE_OUT = 0.003, 0.020


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
    dst = os.path.join(OUT, 'slap.mp3')
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{KBPS}k', '-map_metadata', '-1',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', dst],
        input=pcm, check=True)
    print(f'  wrote {dst}  {len(y) / SR:.2f}s  '
          f'{os.path.getsize(dst) / 1024.0:.1f} KB  {SR} Hz  {KBPS} kbps')


if __name__ == '__main__':
    main(sys.argv[1:])
