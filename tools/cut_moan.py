#!/usr/bin/env python3
"""Her moan after the slap: one of three, picked at random each time.

    python3 tools/cut_moan.py            # writes build/payload/moan0..2.mp3

Misha, 25 Sep 2026: *"after the slap audio is played, the next sound that
should play is a randomized play of one of these: mo-0.mp3, mo-1.mp3,
mo-2.mp3"*. The sources are those files, committed as
`assets/audio/moan_mo-0.mp3` .. `moan_mo-2.mp3` — see
`assets/audio/CREDITS.md` for where they are from.

WHAT IS CHANGED:
  1. TRIMMED of silence at each end: anything before the first and after the
     last 20 ms window louder than -45 dBFS RMS. Nothing inside is cut —
     mo-0 is ten seconds of five moans and plays as it came.
  2. Downmixed to mono and resampled to 22 050 Hz.
  3. LEVELLED so the three sit together. As supplied they do not: mo-1 and
     mo-2 peak at +3 dBFS (clipped in the source) and mo-0 about 15 dB under
     them. Each is set so its VOICED windows (100 ms, above -40 dBFS) average
     -18 dBFS RMS, unless that would take its peak past -1.0 dBFS, in which
     case the peak wins.
  4. Five milliseconds of fade in and forty out — mo-0's last moan is cut off
     by the end of its file, and the fade is what stops that clicking.

DETERMINISTIC, like everything else build.py commits.
"""
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'audio', 'moan_mo-{}.mp3')
OUT = os.path.join(ROOT, 'build', 'payload')
SR = 22050
KBPS = 64
N = 3
GATE = -45.0          # dBFS, 20 ms windows — see note 1
VOICED = -40.0        # dBFS, 100 ms windows — see note 3
TARGET = -18.0        # dBFS RMS of the voiced windows
PEAK = -1.0
FADE_IN, FADE_OUT = 0.005, 0.040


def db(x):
    return 20 * np.log10(max(x, 1e-12))


def windows(y, sec):
    w = int(sec * SR)
    n = len(y) // w
    return np.sqrt(np.mean(y[:n * w].reshape(n, w) ** 2, axis=1)), w


def cut(i):
    src = SRC.format(i)
    if not os.path.exists(src):
        sys.exit(f'missing source: {src}')
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '1',
         '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64).copy()
    y -= y.mean()

    r, w = windows(y, 0.020)
    on = np.nonzero([db(v) > GATE for v in r])[0]
    y = y[on[0] * w:(on[-1] + 1) * w]

    r, _ = windows(y, 0.100)
    v = r[[db(x) > VOICED for x in r]]
    rms = np.sqrt(np.mean(v ** 2))
    gain = min(10 ** ((TARGET - db(rms)) / 20), 10 ** (PEAK / 20) / np.abs(y).max())
    y *= gain

    a, b = int(FADE_IN * SR), int(FADE_OUT * SR)
    y[:a] *= np.linspace(0, 1, a)
    y[-b:] *= np.linspace(1, 0, b)

    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, f'moan{i}.mp3')
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{KBPS}k', '-map_metadata', '-1',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', dst],
        input=pcm, check=True)
    r, _ = windows(y, 0.100)
    v = r[[db(x) > VOICED for x in r]]
    print(f'  wrote {dst}  {len(y) / SR:.2f}s  {os.path.getsize(dst) / 1024.0:.1f} KB  '
          f'voiced {db(np.sqrt(np.mean(v ** 2))):.1f} dBFS  peak {db(np.abs(y).max()):.1f}')


def main(argv):
    for i in range(N):
        cut(i)


if __name__ == '__main__':
    main(sys.argv[1:])
