#!/usr/bin/env python3
"""The slow lick's sounds: the Slow Doodle's slurps, and the two laughs.

    python3 tools/cut_lick.py            # writes build/payload/<slot>.mp3
    python3 tools/cut_lick.py --dry      # says what it would do, writes nothing

Misha, 25 Sep 2026, commissioning the slow lick: *"Misha will provide sound
effects shortly"*. This is where they go in. Drop the files in `assets/audio`
under these names — any number up to the slots, in any of mp3, wav, ogg, m4a
or flac, the part after the prefix is yours and only decides the order:

    assets/audio/doodle_lick_*.mp3     -> doodle_lick0 .. doodle_lick3
    assets/audio/laugh_baye_*.mp3      -> laugh_baye0  .. laugh_baye2
    assets/audio/laugh_chloe_*.mp3     -> laugh_chloe0 .. laugh_chloe2

then run this and `python3 build.py`. Every slot is optional: the game asks for
each by its payload key and a key that is not there costs nothing — no slurp
file means the placeholder slurp, no laugh file means no laugh. See
`── the slow lick ──` in src/80-audio.js.

Or skip this and put finished mp3s straight into build/payload under the slot
names (`build/payload/laugh_baye0.mp3`); build.py inlines whatever is there.
This only exists to trim and level them the way every other voice here is.

WHAT IS CHANGED, per file:
  1. TRIMMED of silence at each end: anything before the first and after the
     last 20 ms window louder than -45 dBFS RMS. Nothing inside is cut.
  2. Downmixed to mono and resampled to 22 050 Hz, like every voice clip.
  3. LEVELLED: the voiced windows (100 ms, above -40 dBFS) to `TARGET` dBFS
     RMS — a laugh at -18, like her moans, and a slurp at -21, because one
     plays three and a half times a second — unless that takes the peak past
     -1.0 dBFS, in which case the peak wins.
  4. Five milliseconds of fade in and forty out.
  5. A slot with no source any more is REMOVED from build/payload, so taking
     a take out is taking it out of the game too.

DETERMINISTIC, like everything else build.py commits.
"""
import glob
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'audio')
OUT = os.path.join(ROOT, 'build', 'payload')
SR = 22050
EXTS = ('.mp3', '.wav', '.ogg', '.m4a', '.flac')
# prefix in assets/audio, slot key in the payload, slots, target dBFS, kbps
SLOTS = [
    ('doodle_lick_', 'doodle_lick', 4, -21.0, 48),
    ('laugh_baye_', 'laugh_baye', 3, -18.0, 64),
    ('laugh_chloe_', 'laugh_chloe', 3, -18.0, 64),
]
GATE = -45.0
VOICED = -40.0
PEAK = -1.0
FADE_IN, FADE_OUT = 0.005, 0.040


def db(x):
    return 20 * np.log10(max(x, 1e-12))


def windows(y, sec):
    w = int(sec * SR)
    n = len(y) // w
    return np.sqrt(np.mean(y[:n * w].reshape(n, w) ** 2, axis=1)), w


def cut(src, dst, target, kbps, dry):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '1',
         '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64).copy()
    if not len(y):
        print(f'  skip {src}: no audio')
        return False
    y -= y.mean()
    r, w = windows(y, 0.020)
    on = np.nonzero([db(v) > GATE for v in r])[0]
    if not len(on):
        print(f'  skip {src}: silent')
        return False
    y = y[on[0] * w:(on[-1] + 1) * w]
    r, _ = windows(y, 0.100)
    v = r[[db(x) > VOICED for x in r]]
    rms = np.sqrt(np.mean(v ** 2)) if len(v) else np.sqrt(np.mean(y ** 2))
    gain = min(10 ** ((target - db(rms)) / 20), 10 ** (PEAK / 20) / np.abs(y).max())
    y *= gain
    a, b = int(FADE_IN * SR), int(FADE_OUT * SR)
    if len(y) > a + b:
        y[:a] *= np.linspace(0, 1, a)
        y[-b:] *= np.linspace(1, 0, b)
    print(f'  {os.path.basename(src)} -> {os.path.basename(dst)}  {len(y) / SR:.2f}s  '
          f'gain {db(gain):+.1f} dB  peak {db(np.abs(y).max()):.1f}')
    if dry:
        return True
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    os.makedirs(OUT, exist_ok=True)
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', '-map_metadata', '-1',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', dst],
        input=pcm, check=True)
    return True


def main(argv):
    dry = '--dry' in argv
    for prefix, key, n, target, kbps in SLOTS:
        srcs = sorted(p for p in glob.glob(os.path.join(SRC, prefix + '*'))
                      if os.path.splitext(p)[1].lower() in EXTS)
        if len(srcs) > n:
            print(f'{key}: {len(srcs)} files and {n} slots — the last '
                  f'{len(srcs) - n} are left out')
        print(f'{key}: {min(len(srcs), n)} of {n}')
        used = 0
        for src in srcs[:n]:
            if cut(src, os.path.join(OUT, f'{key}{used}.mp3'), target, kbps, dry):
                used += 1
        for i in range(used, n):
            stale = os.path.join(OUT, f'{key}{i}.mp3')
            if os.path.exists(stale):
                print(f'  remove {os.path.basename(stale)}: no source for it')
                if not dry:
                    os.remove(stale)


if __name__ == '__main__':
    main(sys.argv[1:])
