#!/usr/bin/env python3
"""Fold the wardrobe viewer into one file that opens by double-click.

The same trick `build.py` plays on the game: ES modules cannot be imported
from a `file://` page — the origin is opaque and every `import` is a CORS
failure — so the three addons are rewritten into IIFEs and every texture and
mesh travels as base64. What comes out needs no server and no network, which
is the point: it has to open off a Synology share from a Windows desktop as
readily as off the public site.

Writes `wardrobe.html` at the repo root, beside `flamme-retarde.html`, and
`tools/deploy.sh` puts both on the server.
"""
import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from build import bundle_three, fetch_addon      # noqa: E402

HERE = Path(__file__).resolve().parent
WORK = ROOT / 'build' / 'wardrobe'
OUT = ROOT / 'wardrobe.html'


def demodule(src, exports):
    def imp(m):
        names = [n.strip().replace(' as ', ': ')
                 for n in m.group(1).split(',') if n.strip()]
        if m.group(2).endswith('BufferGeometryUtils.js'):
            return 'const {%s} = window.__bgu;' % ', '.join(names)
        return 'const {%s} = THREE;' % ', '.join(names)
    src = re.sub(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)'\s*;", imp, src, flags=re.S)
    src = re.sub(r"export\s*\{[^}]*\}\s*;", '', src, flags=re.S)
    return src + '\n' + '\n'.join('window.%s = %s;' % (e, e) for e in exports)


def main():
    three = bundle_three()
    bgu = ('window.__bgu = (() => {\n'
           + demodule(fetch_addon('utils/BufferGeometryUtils.js'), [])
           + '\nreturn { toTrianglesDrawMode };\n})();')
    # Each addon gets its OWN scope. As classic scripts they share the global
    # one, and both open with `const { Quaternion, ... } = THREE` — the second
    # to load redeclares every name the first took and the page dies on line
    # one.
    gltf = '(() => {\n' + demodule(fetch_addon('loaders/GLTFLoader.js'),
                                   ['GLTFLoader']) + '\n})();'
    orbit = '(() => {\n' + demodule(fetch_addon('controls/OrbitControls.js'),
                                    ['OrbitControls']) + '\n})();'

    MIME = {'.png': 'image/png', '.jpg': 'image/jpeg'}
    maps, raw = {}, 0
    for f in sorted(WORK.iterdir()) + sorted((HERE / 'maps').iterdir()):
        if f.suffix not in MIME:
            continue
        key = ('../../build/wardrobe/' if f.parent == WORK else './maps/') + f.name
        maps[key] = 'data:%s;base64,%s' % (
            MIME[f.suffix], base64.b64encode(f.read_bytes()).decode())
        raw += f.stat().st_size
    glb = (WORK / 'wardrobe.glb').read_bytes()
    print('  %d textures %.2f MB · wardrobe.glb %.2f MB'
          % (len(maps), raw / 1e6, len(glb) / 1e6))

    page = (HERE / 'viewer.html').read_text()
    head = page.split('<script type="importmap">', 1)[0]
    body = page.split('<script type="module">', 1)[1].rsplit('</script>', 1)[0]
    body = re.sub(r"^import[^\n]*\n", '', body, flags=re.M)
    # The manifest was fetched, and top-level await is a module thing; this is
    # a classic script now, so it is inlined instead.
    body = body.replace(
        "const MAN = await (await fetch('../../build/wardrobe/manifest.json')).json();",
        'const MAN = __MAN;')
    body = body.replace("const t = tl.load(file);", "const t = tl.load(MAPS[file] || file);")
    # GLTFLoader.parse takes an ArrayBuffer, so nothing is fetched.
    body = body.replace(
        "new GLTFLoader().load('../../build/wardrobe/wardrobe.glb?b=' + Date.now(), (g) => {",
        "new GLTFLoader().parse(__b64(__GLB), '', (g) => {")
    # A rewrite that silently misses leaves a page that fetches from a path
    # that is not there, which on `file://` fails as a CORS error a long way
    # from the cause.
    for probe in ('const MAN = __MAN;', 'MAPS[file]', "__b64(__GLB)"):
        assert probe in body, 'bundle rewrite missed: ' + probe

    OUT.write_text(head + '<script>%s</script>\n<script>%s</script>\n'
                          '<script>%s</script>\n<script>%s</script>\n<script>\n'
                   % (three, bgu, gltf, orbit)
                   + 'const __MAN = %s;\n' % json.dumps(json.loads((WORK / 'manifest.json').read_text()))
                   + 'const MAPS = %s;\n' % json.dumps(maps)
                   + 'const __GLB = "%s";\n' % base64.b64encode(glb).decode()
                   + '''function __b64(s) {
  const bin = atob(s), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a.buffer;
}
(() => {
const GLTFLoader = window.GLTFLoader, OrbitControls = window.OrbitControls;
''' + body + '''
})();
</script></body></html>''')
    print('wrote %s — %.2f MB' % (OUT.name, OUT.stat().st_size / 1e6))


if __name__ == '__main__':
    main()
