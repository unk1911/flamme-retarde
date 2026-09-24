#!/usr/bin/env python3
"""Put the Slow Doodle in the game: build/payload/doodle.fr3d.gz and doodle_hair.png.

    python3 tools/slowdoodle/game.py

Reads the rigged GLB that `make.py` builds at build/slowdoodle/slowdoodle.glb,
and if that is not there — it is not committed, and remaking it needs the
MakeHuman hair pack and a few minutes — takes the one already inlined in
slowdoodle.html, which IS committed and is byte for byte what `make.py`
bundled. So this needs Blender and nothing else.

Two outputs, both committed under build/payload/ the way the cat and the dog
are, so `build.py` never needs Blender:

  doodle.fr3d.gz   skinned v5: 44 bones, eight clips — see fr3d.py
  doodle_hair.png  the mane's strand card, 256 px, luminance and alpha only.
                   The game dyes it by luminance (so did the viewer), so the
                   colour channels of the 512 px RGBA original were 600 KB of
                   information nobody reads.

Licence, carried from the viewer's credits: body, rig and animation are
Quaternius's "Wolf", CC0; the strand texture is from the MakeHuman community
hair01 pack, CC0. Everything else on him was made in this repository.
"""
import base64
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORK = ROOT / 'build' / 'slowdoodle'
PAYLOAD = ROOT / 'build' / 'payload'


def sources():
    glb, tex = WORK / 'slowdoodle.glb', WORK / 'mane.png'
    if glb.exists() and tex.exists():
        return glb, tex
    page = (ROOT / 'slowdoodle.html').read_text()
    m = re.search(r'const __GLB = "([^"]+)"', page)
    t = re.search(r'"mane\.png":"data:image/png;base64,([^"]+)"', page)
    if not m or not t:
        sys.exit('no GLB in build/slowdoodle and none inlined in slowdoodle.html')
    WORK.mkdir(parents=True, exist_ok=True)
    glb.write_bytes(base64.b64decode(m.group(1)))
    tex.write_bytes(base64.b64decode(t.group(1)))
    print('took the GLB and the strand card out of slowdoodle.html')
    return glb, tex


def main():
    glb, tex = sources()
    out = PAYLOAD / 'doodle.fr3d.gz'
    r = subprocess.run(['blender', '-b', '-noaudio', '-P', str(HERE / 'fr3d.py'),
                        '--', str(glb), str(out)],
                       capture_output=True, text=True, cwd=ROOT)
    print('\n'.join(ln for ln in r.stdout.splitlines()
                    if ln.startswith(('[doodle-fr3d]', '[skin]'))))
    if r.returncode or 'Traceback' in r.stdout + r.stderr or not out.exists():
        print(r.stdout[-3000:])
        print(r.stderr[-3000:])
        sys.exit('fr3d export failed')

    im = Image.open(tex).convert('RGBA').resize((256, 256), Image.LANCZOS)
    r_, g_, b_, a_ = im.split()
    lum = Image.merge('RGB', (r_, g_, b_)).convert('L')
    hair = PAYLOAD / 'doodle_hair.png'
    Image.merge('LA', (lum, a_)).save(hair, optimize=True)
    print('%s  %.0f KB' % (hair.name, hair.stat().st_size / 1024))


if __name__ == '__main__':
    main()
