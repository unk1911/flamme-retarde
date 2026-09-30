#!/usr/bin/env python3
"""The belt's own sounds, and her gasps: eleven recordings of Misha's.

    python3 tools/cut_belt.py          # writes build/payload/belt_whp0..2.mp3,
                                       #   belt_unbuckle0..1.mp3, gasp0..5.mp3
    python3 tools/cut_belt.py --check  # and reads each one back, in bands

Misha, 30 Sep 2026: *"when she takes out the belt, (i.e,. when '\\' is
pressed), it should use/alternate between these unbuckle sounds:
sp-unbuckle-0.mp3, sp-unbuckle-1.mp3. and when belt lands, should alternate
between several sounds: belt-whp-0.mp3, belt-whp-1.mp3, belt-whp-2.mp3. and a
second or two later, her reaction, in addition to the existing ones, should
also add these ones: sp-gasp-[0-5].mp3."* The sources are those files,
committed as `assets/audio/whp_belt-whp-*.mp3`, `unbuckle_sp-unbuckle-*.mp3`
and `gasp_sp-gasp-*.mp3` — see `assets/audio/CREDITS.md`.

All eleven came as 48 kHz stereo at 192 kbps, and none of them is stereo in
anything but name: left against right correlates 0.996-1.000 and the side
channel is 27-39 dB under the mid in every one. They are folded to mono.

THE WHPS ARE TWO AND THREE STROKES EACH, and a strap lands once. Stepped in
5 ms windows, whp-0 has a stroke at 0.555 s and another at 1.617; whp-1 at
0.108, 0.943 and 1.651; whp-2 at 0.903 and 1.963 — each a snap that rises in
5 ms and is 40 dB down 100-160 ms later, over a floor at -45 to -35 dBFS.
Played whole, one landing would be answered by one or two more a second
apart that nothing on screen did. So each is cut to ONE stroke (`WHP`, the
cleanest of its file: the most crack in 1.2-16 kHz, the least wind in front
of it), and the game rotates the three.

WHAT A STROKE IS, in bands at its peak: nearly all of it 1.2-16 kHz — the
edge of the leather — with a body at 400-1200 Hz, and 7-16 kHz only 5-10 dB
under the loudest band. That is a crack and not a thud, so in the game it
REPLACES the synthesised crack rather than sitting under it (see `beltCrack`
in 80-audio.js). Under 120 Hz there is a separate thing: 20-60 Hz carries 5-12
dB of each window's energy, and in whp-0 it arrives as a -10 dBFS pulse 40 ms
BEFORE the snap — the strap's own wind on the microphone. A fourth-order
highpass at 120 Hz takes it, causal, so nothing rings ahead of the transient.

AND AT 32 kHz, not 22: 11-16 kHz is -15 dB of a stroke's energy and the
unbuckles' clinks carry -4 to -8 dB up there, so 22 050 Hz dulls both, where
at 32 kHz and 64 kbps a stroke costs 3 KB. The gasps are breath and voice,
and go at 24 kHz and 48 kbps: read back in bands (`--check`) every band to 11
kHz is within 0.6 dB of the source, where 22 050 Hz lost 2-2.6 dB at 7-11 kHz
and 32 kHz at 64 kbps kept everything for 17 KB more. What 24 kHz gives up is
11-16 kHz in gasp-2 and gasp-3, breath 25-30 dB under the voice.

WHAT IS CHANGED:
  1. Strokes: highpassed (above); cut from 3 ms before the first 1 ms window
     within 30 dB of the stroke's loudest to where 10 ms windows fall 42 dB
     under it or to the floor, and levelled so the loudest 10 ms of each
     reads -12.5 dBFS, peaks capped at -1.0 dBFS — three takes in rotation
     should not be three distances. The loudest 10 ms and not a longer RMS,
     because what differs between them is how long the tail is, and not how
     hard it lands. The slap (`cut_slap.py`) reads -10.4 on the same
     measure, so at the game's gain of 1 a full swing lands about as loud
     as the hand, and brighter. 2 ms fade in, 30 ms out.
  2. Unbuckles: highpassed at 150 Hz, second order (the pre-roll of
     unbuckle-0 is handling rumble, 20-60 Hz); trimmed of anything before
     and after the last 10 ms window within 38 dB of the loudest; and
     levelled to the same loudest 10 ms, peaks capped at -1.0 dBFS. As
     supplied unbuckle-1's clink is 6 dB under unbuckle-0's. 3 ms in, 30 ms out.
  3. Gasps: trimmed like the moans (`cut_moan.py`: 20 ms windows, -45 dBFS),
     except that an island after the end of the breath — a tail under 60 ms
     after 100 ms of quiet, which is the start of the next take in gasp-0
     and gasp-4 — is dropped; the silences inside gasp-5 (four breaths in 4
     s) are kept. Levelled as the moans are: the voiced 100 ms windows to
     -18 dBFS RMS unless the peak would pass -1.0 dBFS. The sources begin at
     full voice on their first sample and several are clipped (gasp-4 has
     3015 samples at full scale); a clip cannot be undone, only not made
     worse. 8 ms in — the head is already in the breath — and 40 out.

DETERMINISTIC, like everything else build.py commits: fixed windows, no
randomness, LAME with the bit-exact flags.
"""
import os
import subprocess
import sys

import numpy as np
import scipy.signal as sig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'audio')
OUT = os.path.join(ROOT, 'build', 'payload')
IN_SR = 48000
PEAK = -1.0

# The one stroke of each file, s (see the note: the cleanest of its file).
WHP = [('whp_belt-whp-0.mp3', 1.617), ('whp_belt-whp-1.mp3', 0.943), ('whp_belt-whp-2.mp3', 1.963)]
WHP_HP = (4, 120)           # order, Hz
WHP_ON, WHP_OFF = -30.0, -42.0
WHP_TOP = -12.5             # dBFS, the loudest 10 ms window
UNB = ['unbuckle_sp-unbuckle-0.mp3', 'unbuckle_sp-unbuckle-1.mp3']
UNB_HP = (2, 150)
UNB_GATE = -38.0            # dB under the loudest 10 ms window
UNB_TOP = -14.0             # dBFS, the loudest 10 ms window
GASP = [f'gasp_sp-gasp-{i}.mp3' for i in range(6)]
GASP_GATE, VOICED, GASP_RMS = -45.0, -40.0, -18.0


def db(x):
    return 20 * np.log10(max(float(x), 1e-12))


def decode(path, sr=IN_SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1',
                          '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).copy()


def windows(y, sec, sr):
    w = max(1, int(round(sec * sr)))
    n = len(y) // w
    return np.sqrt(np.mean(y[:n * w].reshape(n, w) ** 2, axis=1)), w


def highpass(y, spec, sr):
    return sig.sosfilt(sig.butter(spec[0], spec[1], 'highpass', fs=sr, output='sos'), y)


def fade(y, a, b, sr):
    a, b = int(a * sr), int(b * sr)
    y[:a] *= np.linspace(0, 1, a)
    y[-b:] *= np.linspace(1, 0, b)
    return y


def resample(y, sr):
    """48 kHz float to `sr`, polyphase — the same every run."""
    from math import gcd
    g = gcd(IN_SR, sr)
    return sig.resample_poly(y, sr // g, IN_SR // g)


def encode(y, sr, kbps, name):
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, name)
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(sr), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', '-map_metadata', '-1',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', dst],
        input=pcm, check=True)
    return dst


EDGES = [120, 250, 500, 900, 1600, 2800, 4600, 7000, 11000, 16000]


def bands(x, sr):
    f, P = sig.welch(x, sr, nperseg=min(1024, len(x)))
    out = []
    for lo, hi in zip(EDGES[:-1], EDGES[1:]):
        m = (f >= lo) & (f < hi)
        out.append(10 * np.log10(max(P[m].sum(), 1e-20)) if m.any() else -200.0)
    return np.array(out)


def check(dst, ref48, sr):
    """The file read back against the 48 kHz float it was made from, in bands,
    counting only the bands within 30 dB of the loudest — what the ear gets."""
    back = decode(dst, IN_SR)
    n = min(len(back), len(ref48))
    # LAME's leading delay: align on the cross-correlation peak, ±30 ms.
    lag = int(np.argmax(sig.correlate(back[:n], ref48[:n], mode='full', method='fft')) - (n - 1))
    lag = max(-1440, min(1440, lag))
    b = back[max(0, lag):]
    r = ref48[max(0, -lag):]
    n = min(len(b), len(r))
    B, R = bands(b[:n], IN_SR), bands(r[:n], IN_SR)
    live = R > R.max() - 30
    d = np.where(live, B - R, 0)
    worst = int(np.argmax(np.abs(d)))
    return d, worst, live


def report(tag, dst, y, sr, ref48, want_check):
    kb = os.path.getsize(dst) / 1024.0
    line = (f'  {os.path.basename(dst):<20s} {len(y) / sr:5.2f}s {sr:5d} Hz {kb:5.1f} KB  '
            f'peak {db(np.abs(y).max()):5.1f}  rms {db(np.sqrt(np.mean(y ** 2))):6.1f}  {tag}')
    print(line)
    if want_check:
        d, worst, live = check(dst, ref48, sr)
        cells = ' '.join((f'{v:+5.1f}' if l else '    .') for v, l in zip(d, live))
        print(f'      bands {EDGES[0]}..{EDGES[-1]} Hz, file minus source, dB: {cells}   '
              f'worst {d[worst]:+.2f} at {EDGES[worst]}-{EDGES[worst + 1]} Hz')
    return kb


def cut_whp(want_check):
    sr, kbps = 32000, 64
    total = 0
    for k, (name, at) in enumerate(WHP):
        x = highpass(decode(os.path.join(SRC, name)), WHP_HP, IN_SR)
        x -= x.mean()
        # The stroke's loudest 1 ms window, within 60 ms of where it was measured.
        r1, w1 = windows(x, 0.001, IN_SR)
        c = int(at * 1000)
        pk = c - 60 + int(np.argmax(r1[c - 60:c + 60]))
        top = db(r1[pk])
        on = pk
        while on > 0 and db(r1[on - 1]) > top + WHP_ON:
            on -= 1
        a = max(0, (on - 3) * w1)
        r10, w10 = windows(x, 0.010, IN_SR)
        floor = db(np.percentile(r10, 20))
        j = pk // 10
        while j < len(r10) - 1 and db(r10[j]) > max(top + WHP_OFF, floor + 3):
            j += 1
        e = min(len(x), (j + 1) * w10 + int(0.03 * IN_SR))
        y = x[a:e].copy()
        g = min(10 ** ((WHP_TOP - db(windows(y, 0.010, IN_SR)[0].max())) / 20),
                10 ** (PEAK / 20) / np.abs(y).max())
        y = fade(y * g, 0.002, 0.030, IN_SR)
        ref = y.copy()
        z = resample(y, sr)
        dst = encode(z, sr, kbps, f'belt_whp{k}.mp3')
        total += report(f'stroke at {pk / 1000:.3f} s of {name}, loudest 10 ms '
                        f'{db(windows(z, 0.010, sr)[0].max()):.1f} dBFS',
                        dst, z, sr, ref, want_check)
    return total


def cut_unbuckle(want_check):
    sr, kbps = 32000, 64
    total = 0
    for k, name in enumerate(UNB):
        x = highpass(decode(os.path.join(SRC, name)), UNB_HP, IN_SR)
        x -= x.mean()
        r, w = windows(x, 0.010, IN_SR)
        top = db(r.max())
        on = np.nonzero([db(v) > top + UNB_GATE for v in r])[0]
        y = x[on[0] * w:(on[-1] + 1) * w].copy()
        g = min(10 ** ((UNB_TOP - top) / 20), 10 ** (PEAK / 20) / np.abs(y).max())
        y = fade(y * g, 0.003, 0.030, IN_SR)
        ref = y.copy()
        z = resample(y, sr)
        dst = encode(z, sr, kbps, f'belt_unbuckle{k}.mp3')
        rz, wz = windows(z, 0.010, sr)
        total += report(f'loudest 10 ms {db(rz.max()):.1f} dBFS at {int(np.argmax(rz)) * 10} ms',
                        dst, z, sr, ref, want_check)
    return total


def cut_gasp(want_check):
    sr, kbps = 24000, 48
    total = 0
    for k, name in enumerate(GASP):
        x = decode(os.path.join(SRC, name))
        x -= x.mean()
        r, w = windows(x, 0.020, IN_SR)
        on = np.nonzero([db(v) > GASP_GATE for v in r])[0]
        # An island at the end: under 60 ms after 100 ms of quiet is not hers.
        while len(on) > 1:
            gap = on[-1] - on[-2]
            run = 1
            while run < len(on) and on[-run] - on[-run - 1] == 1:
                run += 1
            if gap > 5 and run * 20 < 60:
                on = on[:-run]
            else:
                break
        y = x[on[0] * w:(on[-1] + 1) * w].copy()
        rv, _ = windows(y, 0.100, IN_SR)
        v = rv[[db(q) > VOICED for q in rv]]
        rms = np.sqrt(np.mean(v ** 2))
        g = min(10 ** ((GASP_RMS - db(rms)) / 20), 10 ** (PEAK / 20) / np.abs(y).max())
        y = fade(y * g, 0.008, 0.040, IN_SR)
        ref = y.copy()
        z = resample(y, sr)
        dst = encode(z, sr, kbps, f'gasp{k}.mp3')
        rv, _ = windows(z, 0.100, sr)
        v = rv[[db(q) > VOICED for q in rv]]
        total += report(f'voiced {db(np.sqrt(np.mean(v ** 2))):.1f} dBFS  gain {db(g):+.1f} dB',
                        dst, z, sr, ref, want_check)
    return total


def main(argv):
    want = '--check' in argv
    for f in [n for n, _ in WHP] + UNB + GASP:
        if not os.path.exists(os.path.join(SRC, f)):
            sys.exit(f'missing source: {f}')
    kb = cut_whp(want) + cut_unbuckle(want) + cut_gasp(want)
    print(f'  total {kb:.1f} KB of mp3, {kb * 4 / 3:.1f} KB in the page as base64')


if __name__ == '__main__':
    main(sys.argv[1:])
