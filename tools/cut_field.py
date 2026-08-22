#!/usr/bin/env python3
"""
Cut the Jadrija field recordings into the beds the game loops.

Six recordings were made on the peninsula in August 2026 with a phone in a
pocket-sized recorder, mono, 48 kHz, AAC. They live outside the repo — they are
Misha's own footage and they are large — at

    /mnt/c/tmp/refs/jadrija/field-recordings/

and this is the only thing that has ever turned them into what ships. Run it
whenever a bed wants re-cutting; it is deterministic and it overwrites.

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
]

INSET = 0.5     # s — where 80-audio.js puts loopStart and loopEnd
MATCH = 0.35    # s — how much of each end the seam is judged on
STEP = 0.02     # s — the search grid


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
    L = bed['length'][1]
    while L >= bed['length'][0] - 1e-9:
        a = w0
        while a + L <= w1 + 1e-9:
            s, dl, ds = seam(x, a, L, sr)
            score = s - 0.05 * L
            if best is None or score < best[0]:
                best = (score, a, L, s, dl, ds)
            a += STEP
        L -= 0.5
    return best


def cut(bed):
    x = decode(os.path.join(SRC, FILES[bed['src']]))
    score, a, L, s, dl, ds = pick(x, bed, SR)
    y = x[int(a * SR):int((a + L) * SR)].copy()
    # The filters, at 48 kHz and before the resample, so the resampler's own
    # anti-alias is the only thing shaping the top and nothing has to be undone.
    if bed['hp']:
        y = sig.sosfiltfilt(sig.butter(bed['hp'][0], bed['hp'][1],
                                       btype='high', fs=SR, output='sos'), y)
    if bed['lp']:
        y = sig.sosfiltfilt(sig.butter(bed['lp'][0], bed['lp'][1],
                                       btype='low', fs=SR, output='sos'), y)
    # To the level the clip it replaces was heard at, exactly.
    y *= 10 ** (bed['rms'] / 20) / max(np.sqrt(np.mean(y ** 2)), 1e-12)
    peak = 20 * np.log10(np.max(np.abs(y)))
    # A longer window catches more of whatever the loudest thing in the
    # recording is — somebody shouting on the pier is 8 dB over the rest of it —
    # and the level above is set by RMS, so the peak has to be checked and not
    # assumed. Anything over -0.5 dBFS would clip the decoder rather than the
    # file; nothing here comes near it, and if something ever does the answer is
    # a different window, not a limiter.
    if peak > -0.5:
        print(f"  !! {bed['key']} peaks at {peak:+.2f} dBFS — pick again")
    tmp = f"/tmp/cut_{bed['key']}.wav"
    import scipy.io.wavfile as wav
    wav.write(tmp, SR, (np.clip(y, -1, 1) * 32767).astype('<i2'))
    dst = os.path.join(OUT, bed['key'] + '.mp3')
    subprocess.run(['lame', '--quiet', '-m', 'm', '--resample',
                    str(bed['rate'] / 1000.0), '-b', str(bed['kbps']),
                    '--cbr', tmp, dst], check=True)
    kb = os.path.getsize(dst) / 1024.0
    print(f"  {bed['key']:<8s} {L:5.1f} s  from {a:6.2f} s of r{bed['src']}  "
          f"{bed['rate']:5d} Hz {bed['kbps']:3d}k {kb:6.1f} KB  "
          f"seam {dl:+.2f} dB level, {ds:.2f} dB spectrum  peak {peak:+.1f}")
    return dict(bed, sec=L, at=a, kb=kb, seam_l=dl, seam_s=ds, peak=peak)


if __name__ == '__main__':
    only = sys.argv[1:] 
    rows = [cut(b) for b in BEDS if not only or b['key'] in only]
    print()
    print('  clip      source                        s    rate  kbps     KB')
    for r in rows:
        print(f"  {r['key']:<8s}  {r['what']:<26s} {r['sec']:5.1f}  "
              f"{r['rate']:5d}  {r['kbps']:4d}  {r['kb']:6.1f}")
    print(f"  total {sum(r['kb'] for r in rows):.0f} KB")
