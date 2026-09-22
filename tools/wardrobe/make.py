#!/usr/bin/env python3
"""Build wardrobe.html end to end: fetch, fit, bake, bundle.

    python3 tools/wardrobe/make.py

Not part of `build.py`. The output is committed, like build/payload's blobs,
so the game and the viewer both build without a network round trip; this runs
only when the rack changes.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

for step, cmd in (
    ('fetch + fit', [sys.executable, str(HERE / 'assets.py')]),
    ('bake', ['blender', '-b', '-noaudio', '-P', str(HERE / 'bake.py'), '--', str(ROOT)]),
    ('bundle', [sys.executable, str(HERE / 'bundle.py')]),
):
    print('== %s' % step)
    r = subprocess.run(cmd, capture_output=True, text=True)
    keep = [l for l in r.stdout.splitlines()
            if l.startswith(('  ', '[wardrobe]', '[bake]', 'wrote'))]
    print('\n'.join(keep[-6:] if step == 'bake' else keep))
    if r.returncode:
        print(r.stdout[-3000:]); print(r.stderr[-3000:])
        sys.exit('%s failed' % step)
