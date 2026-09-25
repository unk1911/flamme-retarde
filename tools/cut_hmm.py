#!/usr/bin/env python3
"""The Slow Doodle's "hmm?", when his nose goes through the kabina's curtain.

    python3 tools/cut_hmm.py            # writes build/payload/doodle_hmm.mp3
    python3 tools/cut_hmm.py --wav      # and a listening copy in build/

Misha, 25 Sep 2026: *"when he puts his muzzle into the kabine, he should make a
'hmm?' sound"*, and he picked the take himself — the first two seconds of this
file.

SOURCE, AND ITS LICENCE. `assets/audio/hmm_freesound_170781_esperar.mp3` —
"Hmm Ahh.wav" by esperar on freesound.org, CC0 1.0: "a young man saying 'Hmm'
and 'Ahh' several times with different inflections", 39.8 s. The copy here is
the one Pixabay's `freesound_community` account re-hosts under the same
recording (Pixabay 6426), which is where Misha downloaded it; the licence that
matters is the Freesound original's, and CC0 permits redistribution and
modification with no conditions. Credited in `assets/audio/CREDITS.md` and the
README anyway.

WHAT IS CHANGED:
  1. CUT to 0.88–1.76 s. Stepped in 50 ms windows, the first two seconds are
     silence to 0.93 s, one voiced "hmm?" to 1.66 s, and silence again; the
     cut keeps 50 ms of room either side so the onset and the tail are not
     clipped. Starting on the voice rather than at 0:00 is what lets it land
     on the frame his nose goes in instead of a second after.
  2. Downmixed to mono (it is mono already) and resampled to 22 050 Hz, like
     every voice clip in this game.
  3. Levelled to -18.0 dBFS RMS, peak held under -1.0 dBFS.
  4. Ten milliseconds of fade at each end, so the decoder's padding never
     lands on a step.

DETERMINISTIC, like everything else build.py commits.
"""
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'audio', 'hmm_freesound_170781_esperar.mp3')
OUT = os.path.join(ROOT, 'build', 'payload')
SR = 22050
KBPS = 64
CUT = (0.88, 1.76)    # s — see note 1
RMS = -18.0
PEAK = -1.0
FADE = 0.010


def main(argv):
    if not os.path.exists(SRC):
        sys.exit(f'missing source: {SRC}\n'
                 'It is CC0 and committed to this repo; see assets/audio/CREDITS.md')
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', SRC, '-f', 'f32le', '-ac', '1',
         '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64).copy()
    y = y[int(CUT[0] * SR):int(CUT[1] * SR)]
    y -= y.mean()
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
    dst = os.path.join(OUT, 'doodle_hmm.mp3')
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{KBPS}k', '-map_metadata', '-1',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', dst],
        input=pcm, check=True)
    if '--wav' in argv:
        # NOT in build/payload, which base64s whatever it finds.
        wav = os.path.join(ROOT, 'build', 'doodle_hmm.wav')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR),
                        '-ac', '1', '-i', 'pipe:0', wav], input=pcm, check=True)
        print(f'  wrote {wav}')
    print(f'  wrote {dst}  {len(y) / SR:.2f}s  '
          f'{os.path.getsize(dst) / 1024.0:.1f} KB  {SR} Hz  {KBPS} kbps')


if __name__ == '__main__':
    main(sys.argv[1:])
