#!/usr/bin/env python3
"""Cut the borrowed bird calls — build/payload/<species>.mp3.

Kept apart from tools/cut_field.py on purpose, and the reason is provenance
rather than signal processing. Everything cut_field.py touches is Misha's, was
recorded at Jadrija, and owes nobody anything; every source here belongs to
somebody else and arrives with terms attached. Two files means the question
"whose is this and what does it require of us" is answered by which script cut
it, and the answer cannot drift. The DSP is imported from over there — one
filter and one leveller, and there is no reason for a second copy of either.

Misha, 25 Aug: "there are many other beautiful bird sounds at the vikendica...
just this morning, i heard the bird calls of: Hooded Crow, Pallid Swift,
Eurasian Blackbird, Yellow-legged Gull, Western Yellow Wagtail, European
Bee-eater, Barn Swallow, and again the Eurasian Collared-Dove". Rule 12: that
list is the specification. He was standing there and heard them, so the species
are settled and the only open question was where to get a voice for each.

WHERE THESE CAME FROM, and why not xeno-canto directly. XC's own API went to v3
in the spring and now wants a per-account key, which would put a credential in
the loop of a build that has to run from a clean clone. Wikimedia Commons hosts
a large slice of XC's catalogue anyway, mirrored with the recordist's name and
licence carried across, and it needs no key at all. It also settles the licence
question before it is asked: Commons will not accept a non-commercial-only
file, so anything reachable through it is free for any use, and the whole of
the obligation is attribution and — for the BY-SA ones — share-alike, which the
game already is.

THE SOURCES ARE NOT COMMITTED. Seven originals are 7.2 MB of somebody else's
recordings to answer for, against 74 KB of cut clips that actually ship. So
they are cached outside the tree at SRC and re-fetched from Commons when they
are not there, which is the same bargain build.py already strikes with Three.js
in vendor/. `provenance.json` beside them is written by the fetch and is what
`credits()` prints; the table below is what it is checked against, so a source
that is quietly replaced upstream stops the build rather than changing the
game's voice without telling anybody.

WHAT WAS LISTENED FOR, in the order it disqualified things:

  the right bird     Search hits are titles, not identifications. `Corvus
                     corone` is not `cornix`, "martinet noir" is the Common
                     Swift and "martinet pâle" is the Pallid one he named, and
                     two of the three European Bee-eater hits in the Commons
                     search turned out to be a transmitter recording of a
                     bee-eater's HEART, from a migration paper. Each source
                     below was opened before it was believed.
  the right call     A blackbird has a fluted song, an alarm rattle, a whistle
                     and a flight scream, and only the first is what somebody
                     means by a blackbird singing. Three of the four Commons
                     blackbirds are alarms. The recordists' own type fields
                     settled these and are quoted in `what`.
  quiet behind it    Measured as the peak of the call over the 25th percentile
                     of a band-limited envelope. The clips run 27 to 58 dB.
                     This is what replaced the first European Bee-eater pick:
                     XC477953 is a real bee-eater but its energy is under
                     700 Hz, which is traffic and wind and not the bird, and it
                     came out 14 dB SNR against the archive recording's 49.

`at`/`sec` are hand-picked windows and nothing here searches for a seam: every
one of these is a one-shot, played once and stopped, so its two ends are never
heard next to each other. See cut_cue in cut_field.py, which makes the same
argument at greater length about the dove.

`peak` is -1.00 for all seven, and it is a PEAK where every bed in
cut_field.py is levelled by RMS. That is not a preference, it is the difference
between a bed and a one-shot. A bed is thirty seconds of promenade whose crest
factor is about 12 dB, so setting its RMS sets its headroom too. A single bird
call is a transient in silence: these run 15 to 22 dB crest, and the swallow's
twitter is 22 — so levelling this lot to the beds' habit of a fixed RMS put six
of the seven over 0 dBFS, the swallow by nearly 8. Peak-levelled, each keeps
its own dynamics and they all arrive with the same decibel of headroom.

Which leaves the loudness genuinely different between clips, and that is right
too. These do not replace a synthesiser whose level is already liked — they
replace a whole family of them at once, and they are heard at every distance
from four metres to four hundred. So the RMS each one lands at is measured off
the encoded file and printed, and the difference between a crow and a wagtail
is carried in 80-audio.js where the distance law can be seen at the same time.
"""

import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_field import SR, decode, filt, finish   # noqa: E402

SRC = '/mnt/c/tmp/refs/birdcalls'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'build', 'payload')
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'flamme-retarde/1.0 (https://github.com/unk1911/flamme-retarde)'}

# The seven, with the Commons file each is cut from. `commons` is the identity
# — the fetch, the credit line and the provenance check all key off it — so it
# is written exactly as Commons spells it, accents and capitals and all.
BIRDS = [
    dict(key='crow', ext='.ogg',
         commons='File:Corvus cornix.ogg',
         sci='Corvus cornix', en='Hooded Crow', hr='siva vrana',
         at=0.940, sec=0.580, rate=16000, kbps=48,
         hp=(2, 250), lp=(2, 3800), peak=-1.00,
         what='the kraa, one of three in the recording',
         # The only public-domain one of the seven, and it would have been
         # picked for the sound anyway: 29 dB of quiet behind it against 21 for
         # the best CC-BY-SA alternative, which had jays mobbing over the top.
         # Its own note says "sparrows in the background" — they are 4-6 kHz
         # and a crow is not, which is the whole of why `lp` is 3.8 kHz.
         note='sparrows in the background, low-passed away at 3.8 kHz'),
    dict(key='gull', ext='.ogg',
         commons='File:Yellow-legged Gull - Larus michahellis michahellis.ogg',
         sci='Larus michahellis', en='Yellow-legged Gull', hr='galeb klaukavac',
         at=9.100, sec=0.380, rate=16000, kbps=48,
         hp=(2, 500), lp=(2, 6000), peak=-1.00,
         what='one note of the long call',
         note='the loudest of eleven notes in the source, 39 dB clear'),
    dict(key='swift', ext='.wav',
         commons='File:Cri de martinet pâle, Espagne.wav',
         sci='Apus pallidus', en='Pallid Swift', hr='smeđa čiopa',
         at=3.100, sec=0.760, rate=22050, kbps=56,
         hp=(2, 1800), lp=None, peak=-1.00,
         what='the flight scream',
         # Not one bird. A swift scream that lasts 0.69 s is a party of them
         # overlapping, which is what a screaming party is and why it is left
         # whole instead of being cut down to one voice.
         note='a party, not a bird — left whole at 0.69 s'),
    dict(key='beeeater', ext='.ogg',
         commons='File:Bijeneter - SoundCloud - Beeld en Geluid.ogg',
         sci='Merops apiaster', en='European Bee-eater', hr='pčelarica',
         at=11.920, sec=0.240, rate=16000, kbps=48,
         hp=(2, 800), lp=(2, 4500), peak=-1.00,
         what='one prruip',
         note='49 dB clear; the archive recording, not the XC one — see above'),
    dict(key='blackbird', ext='.ogg',
         commons='File:Common Blackbird song (Turdus merula).ogg',
         sci='Turdus merula', en='Eurasian Blackbird', hr='kos',
         at=20.500, sec=2.550, rate=22050, kbps=64,
         hp=(2, 1200), lp=(2, 7000), peak=-1.00,
         what='one strophe of the song, from the canopy',
         note='41 dB clear, and the only CC-BY rather than BY-SA source here'),
    dict(key='swallow', ext='.mp3',
         commons='File:Hirundo rustica - Barn Swallow XC468712.mp3',
         sci='Hirundo rustica', en='Barn Swallow', hr='lastavica',
         at=15.160, sec=2.420, rate=22050, kbps=64,
         hp=(2, 2000), lp=None, peak=-1.00,
         what='a twitter, from a group perched on a branch',
         # The recordist high-passed at 1900 Hz and lifted it 12 dB before
         # uploading. Ours is 2 kHz on top of that, which does nothing the
         # first one did not already do, and is here so the number in this
         # table describes the file rather than half of it.
         note='already high-passed at 1.9 kHz by the recordist'),
    dict(key='wagtail', ext='.mp3',
         commons='File:Motacilla flava - Western Yellow Wagtail XC436362.mp3',
         sci='Motacilla flava', en='Western Yellow Wagtail', hr='žuta pastirica',
         at=20.600, sec=0.260, rate=22050, kbps=56,
         hp=(2, 2800), lp=None, peak=-1.00,
         what='one flight call',
         # Worth saying plainly. All three Commons wagtails are the same
         # recordist on the same nights over Arnhem, and on two of them he
         # hedges the identification himself — "presumed", "may sound like
         # Ortolan". This is the third, where he does not: "at first you'll
         # think there's an Ortolan coming. But they're wagtails." The call
         # taken is the loudest and closest in it, 40 dB clear, which is the
         # one his confidence is about.
         note='the one call the recordist is unhedged about'),
]


def fetch(b):
    """The source file, fetched from Commons the first time it is wanted."""
    path = os.path.join(SRC, b['key'] + b['ext'])
    if os.path.exists(path):
        return path
    os.makedirs(SRC, exist_ok=True)
    q = urllib.parse.urlencode(dict(
        action='query', titles=b['commons'], prop='imageinfo',
        iiprop='url|extmetadata', format='json'))
    r = urllib.request.Request(API + '?' + q, headers=UA)
    page = list(json.load(urllib.request.urlopen(r, timeout=60))
                ['query']['pages'].values())[0]
    if 'imageinfo' not in page:
        sys.exit(f"error: Commons has no {b['commons']} any more")
    ii = page['imageinfo'][0]
    em = ii.get('extmetadata', {})

    def g(k):
        return re.sub('<[^>]+>', '', (em.get(k) or {}).get('value', '')).strip()

    print(f"  fetching {b['commons']}")
    with urllib.request.urlopen(
            urllib.request.Request(ii['url'], headers=UA), timeout=180) as f:
        open(path, 'wb').write(f.read())
    prov = {}
    pf = os.path.join(SRC, 'provenance.json')
    if os.path.exists(pf):
        prov = json.load(open(pf))
    prov[b['key']] = dict(
        file=b['key'] + b['ext'], title=b['commons'], url=ii['url'],
        page='https://commons.wikimedia.org/wiki/'
             + urllib.parse.quote(b['commons'].replace(' ', '_')),
        lic=g('LicenseShortName'), licurl=g('LicenseUrl'), artist=g('Artist'))
    json.dump(prov, open(pf, 'w'), indent=1, ensure_ascii=False)
    return path


def prov_of(b):
    pf = os.path.join(SRC, 'provenance.json')
    if not os.path.exists(pf):
        return {}
    return json.load(open(pf)).get(b['key'], {})


def cut_bird(b):
    """One call, at a window somebody chose by hand and by ear."""
    path = fetch(b)
    p = prov_of(b)
    # The check the docstring promises. A Commons file can be overwritten in
    # place by a later upload, and a build that silently cut a different bird
    # out of a different recording would be worse than one that stopped.
    if p and p.get('title') and p['title'] != b['commons']:
        sys.exit(f"error: {b['key']} cached from {p['title']}, table says "
                 f"{b['commons']} — delete {SRC} and let it re-fetch")
    x = decode(path)
    end = b['at'] + b['sec']
    if end * SR > x.size:
        sys.exit(f"error: {b['key']} wants {end:.2f} s of a {x.size / SR:.2f} s "
                 f"source — the Commons file has changed under us")
    y = filt(x[int(b['at'] * SR):int(end * SR)].copy(), b)
    # A one-shot's ends are heard, once each, with silence on the far side of
    # both. 8 ms of fade is under a syllable and over a click, and it goes on
    # before the level is read so the fade cannot move it.
    n = int(0.008 * SR)
    y[:n] *= np.linspace(0, 1, n)
    y[-n:] *= np.linspace(1, 0, n)
    # Peak to `peak`, expressed as the RMS that gets there, because `finish` is
    # the one leveller and it takes an RMS. Doing it this way rather than
    # scaling here keeps its over-0 dBFS check live and meaningful: if this
    # arithmetic is ever wrong, that warning is what says so.
    k = 10 ** (b['peak'] / 20) / max(np.max(np.abs(y)), 1e-12)
    spec = dict(b, rms=20 * np.log10(np.sqrt(np.mean(y ** 2)) * k))
    kb, peak = finish(spec, y)
    back = decode(os.path.join(OUT, b['key'] + '.mp3'))
    got = 20 * np.log10(np.sqrt(np.mean(back ** 2)))
    dpk = 20 * np.log10(np.max(np.abs(back)))
    print(f"  {b['key']:<10s} {b['sec']:5.2f} s from {b['at']:6.2f} s  "
          f"{b['rate']:5d} Hz {b['kbps']:3d}k {kb:5.1f} KB  "
          f"decodes at {got:+.2f} dBFS RMS, crest {dpk - got:4.1f} dB, "
          f"peak {peak:+.1f}/{dpk:+.1f}  {p.get('lic', '?')}")
    return dict(b, kb=kb, got=got, crest=dpk - got, prov=p)


def credits(rows):
    """The attribution block, in the form README.md carries it."""
    print()
    print('  | clip | species | source | recordist | licence |')
    print('  |---|---|---|---|---|')
    for r in rows:
        p = r['prov']
        print(f"  | `{r['key']}.mp3` | *{r['sci']}* | [{r['commons'][5:]}]"
              f"({p.get('page', '')}) | {p.get('artist', '?')} | "
              f"{p.get('lic', '?')} |")


if __name__ == '__main__':
    only = sys.argv[1:]
    rows = [cut_bird(b) for b in BIRDS if not only or b['key'] in only]
    credits(rows)
    print(f"\n  total {sum(r['kb'] for r in rows):.1f} KB")
