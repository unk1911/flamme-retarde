#!/usr/bin/env python3
"""Fold the Slow Doodle viewer into one file that opens by double-click.

The same trick as tools/wardrobe/bundle.py, and for the same reason: ES
modules cannot be imported from a `file://` page — the origin is opaque and
every `import` is a CORS failure — so three's addons become IIFEs and the GLB
and the textures travel as base64. Nothing is fetched; it opens off a share
with the network unplugged.

Writes `slowdoodle.html` at the repository root.
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from build import bundle_three, fetch_addon      # noqa: E402

HERE = Path(__file__).resolve().parent
WORK = ROOT / 'build' / 'slowdoodle'
OUT = ROOT / 'slowdoodle.html'


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
    # Each addon in its OWN scope: as classic scripts they would share the
    # global one, and both open with `const { Quaternion, ... } = THREE`.
    gltf = '(() => {\n' + demodule(fetch_addon('loaders/GLTFLoader.js'), ['GLTFLoader']) + '\n})();'
    orbit = '(() => {\n' + demodule(fetch_addon('controls/OrbitControls.js'), ['OrbitControls']) + '\n})();'

    maps = {}
    for f in sorted(WORK.glob('*.png')):
        maps[f.name] = 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()
    glb = (WORK / 'slowdoodle.glb').read_bytes()

    page = (HERE / 'viewer.html').read_text()
    head = page.split('<script type="importmap">', 1)[0]
    body = page.split('<script type="module">', 1)[1].rsplit('</script>', 1)[0]
    body = re.sub(r"^import[^\n]*\n", '', body, flags=re.M)
    body = body.replace("const t = texLoader.load(SRC.tex + file);",
                        "const t = texLoader.load(MAPS[file]);")
    body = body.replace("new GLTFLoader().load(SRC.glb + '?b=' + Date.now(), (g) => {",
                        "new GLTFLoader().parse(__b64(__GLB), '', (g) => {")
    # A rewrite that silently misses leaves a page fetching from a path that is
    # not there, which on file:// fails as a CORS error far from the cause.
    for probe in ('MAPS[file]', '__b64(__GLB)'):
        assert probe in body, 'bundle rewrite missed: ' + probe

    OUT.write_text(head
                   + '<script>%s</script>\n<script>%s</script>\n<script>%s</script>\n'
                     '<script>%s</script>\n<script>\n' % (three, bgu, gltf, orbit)
                   + 'const MAPS = {%s};\n' % ','.join('"%s":"%s"' % kv for kv in maps.items())
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
    print('wrote %s — %.2f MB (glb %.2f MB, %d maps)'
          % (OUT.name, OUT.stat().st_size / 1e6, len(glb) / 1e6, len(maps)))


if __name__ == '__main__':
    main()
