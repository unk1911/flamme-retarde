#!/usr/bin/env python3
"""Build slowdoodle.html end to end: textures, the rigged GLB, the bundle.

    python3 tools/slowdoodle/make.py

Not part of `build.py`: he is not in the game yet, and this is the page for
looking at him before he is. The output is committed, the way wardrobe.html
is, so the page is there without Blender.

Needs `build/mh_assets/hair01` (for the strand texture) — `tools/wardrobe/
assets.py` downloads it — and `tools/blender/assets/wolf.glb`, which is
committed.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
GLB = ROOT / 'build' / 'slowdoodle' / 'slowdoodle.glb'

for step, cmd in (
    ('textures', [sys.executable, str(HERE / 'textures.py')]),
    ('rig + parts + clips', ['blender', '-b', '-noaudio', '-P', str(HERE / 'doodle.py'), '--', str(GLB)]),
    ('bundle', [sys.executable, str(HERE / 'bundle.py')]),
):
    print('== %s' % step)
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    keep = [ln for ln in r.stdout.splitlines()
            if ln.startswith(('[tex]', '[doodle]', '[parts]', '[author]', 'wrote'))]
    print('\n'.join(keep))
    if r.returncode or 'Traceback' in r.stdout + r.stderr:
        print(r.stdout[-3000:])
        print(r.stderr[-3000:])
        sys.exit('%s failed' % step)
