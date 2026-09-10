#!/usr/bin/env python3
"""Ten litres of water going over a bucket's lip on to stone paving.

    python3 tools/cut_pour.py            # writes build/payload/pour.mp3
    python3 tools/cut_pour.py --wav      # and a wav next to it, to listen to

Misha, 10 Sep 2026: *"can u enhance the water pouring with very loud sound of
water bein gpoured as .mp3.. make it more immersive"*.

WHY THIS IS SYNTHESISED HERE AND NOT FETCHED. Two standing rules meet on this
file and point the same way. His is *"i wanna run my stuff on my own
infra/computers/hardware"* — the ElevenLabs exception he granted is for a
VOICE, and a bucket is not one. The house's is that everything in 80-audio.js
is made rather than recorded: a footstep is two filtered bursts, a gasp is four
ramps, a meow is a pitch arc under a formant sweep. He asked for an .mp3, which
is about the ASSET and not about where it comes from, so this is numpy on his
own machine and ffmpeg to encode. Nothing leaves the box.

WHAT WATER POURING ACTUALLY IS, in the order you hear it:

  1. THE LIP. A short rising hiss as the sheet breaks off the rim. It is what
     says "a vessel" rather than "a tap", and it is 60 ms.

  2. THE STREAM. Bandpassed noise. On its own this is a hiss and reads as gas,
     which is the same finding the Canadair drop's note records — *"a lowpassed
     roar is just an engine"*. Water needs the third layer.

  3. THE BUBBLES, which are the whole thing. A bubble entrained in water rings
     at its Minnaert frequency, f0 = 3.26 / r Hz for a radius r in metres, and
     it rings UP: as it radiates it loses energy, the effective stiffness
     rises, and the pitch sweeps upward over the decay. That upward chirp is
     the single feature that separates water from noise to a listener, and a
     pour is a few hundred of them a second across a range of radii. Modelled
     as van den Doel does it — a damped sinusoid whose frequency rises by a
     fixed fraction of its own decay — with radii from 0.15 mm to 8 mm.

  4. THE GLUGS. Three or four big ones, 90–190 Hz, spaced through the tip.
     These are the bucket taking air back as it empties and they are why a
     bucket does not sound like a hose. Without them this was a shower.

  5. THE IMPACT, 0.12 s late, which is the water arriving on stone rather than
     leaving the pail — flatter, brighter, and it outlasts the stream because
     what is on the ground is still moving after the bucket is empty.

  6. THE RUN-OFF. Sparse bubbles and a fading wash for another half second,
     into the channel. It is what stops the clip ending like a switch.

TIMED AGAINST HER, and this is the number that matters: `st.pour` traced at
1/60 s is zero until 0.52 s, crosses 0.55 at 0.62, peaks at 1.02 and is dry by
1.23. So the stream this clip carries is a 0.71 s event and the clip is fired
on the frame the stream appears, not on the frame she starts to roll the pail.

22 050 Hz and 96 kbps, which is `shore.mp3` and `lapping.mp3` — the two beds
already in this game that are water. The mutters' 12 kHz is not available to
this: a voice through a closed mouth has nothing over 5.8 kHz and every bubble
under 8 mm rings above it.

DETERMINISTIC. One seed, written down, because build.py commits its output and
a payload that changes when nothing changed is a diff nobody can read.
"""

import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'build', 'payload')

SR = 22050
KBPS = 96
SEED = 20260910

LEN = 1.90            # s of clip
LIP = 0.060           # s of the sheet breaking off the rim
STREAM0, STREAM1 = 0.02, 0.86      # the stream itself
FALL = 0.120          # s before what leaves the lip arrives on the stone
TAIL = 0.55           # s of run-off after the stream stops

# Peak just under clipping and a hot RMS, because he asked for loud and the
# game's own distance law is what makes it quiet again. -13 dBFS RMS is about
# 7 dB over the mutters, which are speech and lidded.
RMS = -13.0
PEAK = -0.8


def env(t, a, b, atk, rel):
    """A window over [a, b] with a raised-cosine attack and release."""
    e = np.zeros_like(t)
    on = (t >= a) & (t <= b)
    e[on] = 1.0
    if atk > 0:
        r = (t - a) / atk
        m = on & (r < 1)
        e[m] = 0.5 - 0.5 * np.cos(np.pi * np.clip(r[m], 0, 1))
    if rel > 0:
        r = (b - t) / rel
        m = on & (r < 1)
        e[m] *= 0.5 - 0.5 * np.cos(np.pi * np.clip(r[m], 0, 1))
    return e


def band(x, lo, hi):
    """Brick-wall bandpass in the frequency domain.

    An FFT filter rather than a biquad because this is offline and there is no
    reason to accept a phase response we would then have to reason about.
    """
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def bubble(n, f0, damp, chirp):
    """One entrained bubble: a damped sinusoid that rises as it dies.

    f(t) = f0 * (1 + chirp * damp * t), integrated for the phase, under
    exp(-damp * t). The rise is the part that sounds like water; a bubble
    synthesised at a fixed pitch is a woodblock.
    """
    t = np.arange(n) / SR
    ph = 2 * np.pi * f0 * (t + 0.5 * chirp * damp * t * t)
    return np.sin(ph) * np.exp(-damp * t)


def main(argv):
    rng = np.random.default_rng(SEED)
    n = int(LEN * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)

    # ── 1. the lip ────────────────────────────────────────────────────────────
    lip = rng.standard_normal(n) * env(t, 0.0, LIP, 0.008, 0.035)
    out += band(lip, 1800, 9000) * 0.45

    # ── 2. the stream ─────────────────────────────────────────────────────────
    # Two bands rather than one: the body of the falling column low, the
    # broken surface of it high, and the high one swells later because the
    # column does not break up until it has fallen a little.
    sh = env(t, STREAM0, STREAM1, 0.075, 0.16)
    out += band(rng.standard_normal(n) * sh, 260, 1500) * 0.42
    out += band(rng.standard_normal(n) * env(t, STREAM0 + 0.05, STREAM1, 0.16, 0.20),
                1500, 7500) * 0.30

    # ── 3. the bubbles ────────────────────────────────────────────────────────
    # Density follows the stream. 8 mm down to 0.15 mm of radius, drawn on a
    # log scale because that is how the sizes actually distribute, which puts
    # most of them high and a few of them satisfyingly low.
    rate = 620.0
    tt = STREAM0
    while tt < STREAM1 + TAIL:
        dens = np.interp(tt, [STREAM0, 0.20, 0.62, STREAM1, STREAM1 + TAIL],
                         [0.15, 1.00, 0.95, 0.35, 0.03])
        tt += rng.exponential(1.0 / max(rate * dens, 1e-3))
        if tt >= LEN - 0.02:
            break
        r = np.exp(rng.uniform(np.log(0.00015), np.log(0.008)))
        f0 = 3.26 / r
        if f0 > 9000:
            continue
        # van den Doel: damping rises with frequency, so the small bright ones
        # are ticks and the big ones ring.
        d = 0.043 * np.sqrt(f0) * rng.uniform(0.75, 1.45)
        m = min(int(0.09 * SR), n - int(tt * SR))
        if m < 16:
            continue
        i0 = int(tt * SR)
        amp = 0.115 * (f0 / 3000.0) ** -0.45 * rng.uniform(0.55, 1.0)
        out[i0:i0 + m] += bubble(m, f0, d, 0.10) * amp

    # ── 4. the glugs ──────────────────────────────────────────────────────────
    # The bucket taking air back. Placed by hand rather than drawn, because
    # four of them is a bucket and eleven of them is a drain.
    for at, f0 in ((0.135, 178.0), (0.352, 132.0), (0.596, 108.0), (0.790, 94.0)):
        m = min(int(0.30 * SR), n - int(at * SR))
        i0 = int(at * SR)
        out[i0:i0 + m] += bubble(m, f0, 0.043 * np.sqrt(f0) * 0.55, 0.16) * 0.36

    # ── 5. the impact on stone ────────────────────────────────────────────────
    # Flatter and brighter than the stream, and it OUTLASTS it: the bucket is
    # empty before the water on the ground has stopped moving.
    imp = env(t, STREAM0 + FALL, STREAM1 + FALL + 0.18, 0.10, 0.34)
    out += band(rng.standard_normal(n) * imp, 700, 10500) * 0.40
    out += band(rng.standard_normal(n) * imp, 120, 700) * 0.22

    # ── 6. the run-off ────────────────────────────────────────────────────────
    ro = env(t, STREAM1 + 0.02, LEN - 0.02, 0.12, 0.50)
    out += band(rng.standard_normal(n) * ro, 900, 8000) * 0.135

    # ── level ─────────────────────────────────────────────────────────────────
    out -= out.mean()
    out /= np.sqrt((out ** 2).mean())
    # SOFT KNEE AND NOT A CEILING, because water has a crest factor and a hard
    # rescale to the peak spends it. Normalised to RMS, the bubble transients
    # stand 12 dB over it; scaling the whole clip down until the tallest of
    # them fit under -0.8 dBFS cost 3.4 dB of everything else, which for a
    # sound asked for as "very loud" is the wrong 3.4 dB to give away. tanh at
    # three times RMS rounds the half-dozen tallest and leaves the body alone —
    # measured, it is 0.4% of samples touched.
    out = np.tanh(out / 3.0) * 3.0
    out *= 10 ** (RMS / 20.0) / np.sqrt((out ** 2).mean())
    pk = np.abs(out).max()
    lim = 10 ** (PEAK / 20.0)
    if pk > lim:
        out *= lim / pk
    # Six milliseconds either end, so the decoder's own padding never lands on
    # a step. Every clip in this payload gets this and it is not cosmetic: an
    # mp3 that starts on a discontinuity has a click no filter takes out.
    k = int(0.006 * SR)
    out[:k] *= np.linspace(0, 1, k)
    out[-k:] *= np.linspace(1, 0, k)

    pcm = (np.clip(out, -1, 1) * 32767).astype('<i2').tobytes()
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, 'pour.mp3')
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1',
         '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', f'{KBPS}k', dst],
        input=pcm, check=True)
    if '--wav' in argv:
        # NOT in build/payload. Everything in that directory is base64'd into
        # the page by `bundle_payload`, which does not care what it is: a wav
        # left there is 82 KB of mp3 turned into 1.6 MB of listening copy
        # welded into the build. Next to it, not in it.
        wav = os.path.join(ROOT, 'build', 'pour.wav')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR),
                        '-ac', '1', '-i', 'pipe:0', wav], input=pcm, check=True)
        print(f'  wrote {wav}')
    kb = os.path.getsize(dst) / 1024.0
    print(f'  wrote {dst}  {LEN:.2f}s  {kb:.1f} KB  {SR} Hz  {KBPS} kbps')
    print(f'  RMS {20 * np.log10(np.sqrt((out ** 2).mean())):.1f} dBFS   '
          f'peak {20 * np.log10(np.abs(out).max()):.1f} dBFS')


if __name__ == '__main__':
    main(sys.argv[1:])
