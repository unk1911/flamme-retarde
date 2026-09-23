#!/usr/bin/env python3
"""The eight bathers' textures, and the table the runtime dresses them from.

    python3 tools/bathers_v2_tex.py

Writes, into build/payload:

    bskin_<skin>.jpg      every skin any bather's pool names, once each
    bwear_<bather>.png    each bather's hairstyle and swimwear, side by side
    bathers2.json         which pool each bather picks from, and every skin's
                          mean tone, which is how a person gets theirs

and tools/bathers_v2_CREDITS.md.

── why the skins are a POOL and not one per figure ──────────────────────────

Forty-eight figures stand in for eighty-odd people, and eight bodies between
them. With one skin per body the beach is eight people six times over, which
is what the painted v4 figures already were — the note over `BATHER_PAINT` in
42-crowd.js is candid that this was the price of nobody changing colour when
you walk up to them. A textured figure can be told which skin to wear, so each
PERSON gets one: the nearest in tone to the palette colour they were dealt
when the beach was built, from a pool that is right for that body's age and
sex. The pool is the only thing here that keeps an old man old and a child a
child, which is why it is listed per body in tools/blender/bathers_v2.json
rather than being one big list.

── the dilation, again ──────────────────────────────────────────────────────

Every skin is dilated into its own gutter before it is saved, for the reason
tools/wardrobe/assets.py gives at length: the flat tone behind the UV islands
bleeds into the last texel of real skin under bilinear filtering and draws a
light line down every seam.
"""
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools' / 'wardrobe'))
from assets import dilate, uv_mask  # noqa: E402

PACKS = ROOT / 'build' / 'mh_assets'
OUT = ROOT / 'build' / 'payload'
WEAR = json.loads((ROOT / 'tools' / 'blender' / 'bathers_v2.json').read_text())
OK = ('CC0', 'CC-BY')

# Pixels are the budget: all of it is base64'd into one page. A skin is seen
# from a metre and a half at the closest; hair and swimwear are small on
# screen and quantise well.
SKIN_PX, SKIN_Q = 768, 82
SUIT_PX, SUIT_COLOURS = 512, 96


# The packs the bathers draw on, and where each lives. Named per pack because
# the zip's suffix is the pack's licence and the site is not consistent about
# spelling it — `_cc0`, `_ccby` and `_cc-by` all occur.
PACK_URLS = {
    'skins01': 'skins01/skins01_cc0.zip',
    'skins02': 'skins02/skins02_cc0.zip',
    'hair01': 'hair01/hair01_cc0.zip',
    'underwear02': 'underwear02/underwear02_cc0.zip',
    'underwear03': 'underwear03/underwear03_cc-by.zip',
    'shirts01': 'shirts01/shirts01_cc0.zip',
    'pants01': 'pants01/pants01_cc0.zip',
    'makehuman_system_assets': 'makehuman_system_assets/makehuman_system_assets_cc0.zip',
}


def fetch_packs():
    """Download any pack not already under build/mh_assets.

    A pack that is there as a symlink — a worktree sharing main's cache — is
    there. 280 MB for the system assets, once; the cache is gitignored.
    """
    import io
    import urllib.request
    import zipfile
    PACKS.mkdir(parents=True, exist_ok=True)
    for name, rel in PACK_URLS.items():
        if (PACKS / name).exists():
            continue
        url = 'https://files2.makehumancommunity.org/asset_packs/' + rel
        print('[bathers2tex] downloading %s' % url)
        with urllib.request.urlopen(url) as r:
            zipfile.ZipFile(io.BytesIO(r.read())).extractall(PACKS / name)


fetch_packs()


def walk_dirs():
    for root, dirs, _files in os.walk(PACKS, followlinks=True):
        for d in dirs:
            yield Path(root) / d


REG = {}
for root, _dirs, files in os.walk(PACKS, followlinks=True):
    if root.endswith('packs'):
        for f in files:
            if f.endswith('.json'):
                REG.update(json.load(open(os.path.join(root, f))))
DIRS = {}
for d in walk_dirs():
    DIRS.setdefault(d.name, d)


def diffuse(name):
    d = DIRS.get(name)
    if d is None:
        sys.exit('[bathers2tex] no asset %s' % name)
    for m in sorted(d.glob('*.mhmat')):
        for ln in m.read_text(errors='ignore').splitlines():
            g = re.match(r'\s*diffuseTexture\s+(\S+)', ln)
            if g:
                for cand in (d / g.group(1), d / Path(g.group(1)).name):
                    if cand.exists():
                        return cand
    pngs = [p for p in sorted(d.glob('*.png')) if 'thumb' not in p.name.lower()
            and 'norm' not in p.name.lower() and 'nrm' not in p.name.lower()]
    if pngs:
        return pngs[0]
    sys.exit('[bathers2tex] %s has no diffuse texture' % name)


def licence(name, used):
    e = REG.get(name)
    if not e:
        sys.exit('[bathers2tex] %s is in no pack registry — cannot vouch for its licence' % name)
    lic = (e.get('license') or '?').strip()
    if lic not in OK:
        sys.exit('[bathers2tex] %s is %s, not CC0/CC-BY — refused' % (name, lic))
    used[name] = {'lic': lic, 'author': e.get('author') or e.get('original_author') or '?',
                  'src': e.get('source', '')}


def nostrils(im):
    """Take the red cavity paint out of the bottom-right of the layout.

    MakeHuman skins paint the inside of the nose and mouth a saturated red, in
    their own islands at the bottom right of the map (u 0.70 to 0.95, v below
    0.2), trusting MakeHuman's renderer to occlude a cavity. Nothing here
    occludes it, and on a straight nose nothing needs to: those faces point at
    the ground. The old-age morphs tip the nose up, and `woman_old` walked the
    promenade with a red disc on the end of her face.

    Found by elimination, and the eliminations are the useful part. An
    ellipse round the nostrils where they show on the FACE island changed
    nothing; neither did a mask rasterised from the faces within 25 mm of the
    base mesh's nose tip, because the morph moves which faces those are.
    Painting every red texel in the corner green turned the disc green, which
    is the whole answer.

    That corner also holds islands from elsewhere on the body, so it is not
    blanked: only texels markedly REDDER than this skin's own tone are pulled
    toward the tone, slightly shadowed, on a ramp — so a dark skin, whose
    cavity paint is not red against it, is left alone, and ordinary skin in
    the corner is not touched at all.
    """
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w = a.shape[:2]
    tone = a[int(h * 0.50):int(h * 0.53), int(w * 0.84):int(w * 0.86)].reshape(-1, 3).mean(0)
    ys, xs = np.mgrid[0:h, 0:w]
    u, v = xs / w, 1.0 - ys / h
    box = (u > 0.70) & (u < 0.95) & (v < 0.20)
    red = (a[..., 0] - a[..., 1]) - (tone[0] - tone[1])
    k = (np.clip((red - 0.08) / 0.12, 0, 1) * box)[..., None]
    a = a * (1 - k) + (tone * 0.80)[None, None, :] * k
    return Image.fromarray((a * 255).round().clip(0, 255).astype(np.uint8))


def mean_lum(im):
    """Mean luminance of the opaque texels, in the texture's own byte space.

    The runtime dyes hair and swimwear by taking the map's luminance as
    shading and supplying the colour itself, divided by THIS, so that dark
    denim and a pale orange one-piece both land on the dye colour on average
    rather than one coming out near-black and the other washed out.
    """
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255.0
    m = a[..., 3] > 0.5
    if not m.any():
        return 0.4
    l = a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
    return round(max(0.05, float(l[m].mean())), 4)


def quant(im, colours):
    # FASTOCTREE is the only PIL quantiser that keeps alpha; the default one
    # drops it and every hair card goes opaque.
    return im.convert('RGBA').quantize(colors=colours, method=Image.FASTOCTREE)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for stale in [p for p in OUT.iterdir() if p.name.startswith(('bskin_', 'bhair_', 'bsuit_', 'bwear_'))]:
        stale.unlink()
    used, tones, table, lum = {}, {}, {}, {}
    mask = uv_mask(SKIN_PX)
    for bather, spec in WEAR['bathers'].items():
        for sk in spec['skins']:
            licence(sk, used)
            if sk in tones:
                continue
            im = Image.open(diffuse(sk)).convert('RGB').resize((SKIN_PX, SKIN_PX), Image.LANCZOS)
            im = nostrils(dilate(im, mask))
            # The mean tone of the torso island, in the texture's own byte
            # space — the same stretched space the beach's palette is in, so
            # the two can be compared directly and the instanced stand-in can
            # be painted with it.
            a = np.asarray(im).astype(np.float32) / 255.0
            y0, y1 = int(SKIN_PX * 0.23), int(SKIN_PX * 0.47)
            x0, x1 = int(SKIN_PX * 0.23), int(SKIN_PX * 0.43)
            tones[sk] = [round(float(x), 3) for x in a[y0:y1, x0:x1].reshape(-1, 3).mean(0)]
            im.save(OUT / ('bskin_%s.jpg' % sk), quality=SKIN_Q, optimize=True)

        # One atlas: the hairstyle in the first tile and each piece of
        # swimwear in a tile after it, in the order tools/blender/
        # bathers_v2.py packed the UVs — asset k gets u -> (u + k) / n.
        names = [spec['hair']] + [spec[k] for k in ('top', 'btm') if spec.get(k)]
        tiles = []
        for s in names:
            licence(s, used)
            tiles.append(Image.open(diffuse(s)).convert('RGBA').resize((SUIT_PX, SUIT_PX), Image.LANCZOS))
        atlas = Image.new('RGBA', (SUIT_PX * len(tiles), SUIT_PX))
        for k, tile in enumerate(tiles):
            atlas.paste(tile, (SUIT_PX * k, 0))
        wq = quant(atlas, SUIT_COLOURS)
        wq.save(OUT / ('bwear_%s.png' % bather), optimize=True)
        # Each half's own mean luminance, measured on the quantised pixels the
        # page will actually sample. Hair is floored, and the floor is
        # measured rather than chosen: afro01's map averages 0.05 and
        # short01's 0.10, and dividing by that turns every lighter fleck of
        # curl into a highlight at the clamp — which rendered as foil.
        rgba = wq.convert('RGBA')
        lum['hair_' + bather] = max(0.18, mean_lum(rgba.crop((0, 0, SUIT_PX, SUIT_PX))))
        lum['suit_' + bather] = mean_lum(rgba.crop((SUIT_PX, 0, rgba.size[0], SUIT_PX)))
        lum['n_' + bather] = len(tiles)
        suit = names[1:]
        print('[bathers2tex] %-17s hair %-8s suit %s' % (bather, spec['hair'], '+'.join(suit)))

        table[bather] = {'skins': spec['skins'], 'grey': bool(spec.get('grey')),
                         'child': bool(spec.get('child'))}
        print('[bathers2tex] %-17s hair %-8s suit %s' % (bather, spec['hair'], '+'.join(suit)))

    (OUT / 'bathers2.json').write_text(json.dumps({'tones': tones, 'lum': lum,
                                                   'bathers': table},
                                                  separators=(',', ':')))
    n = sum(p.stat().st_size for p in OUT.iterdir()
            if p.name.startswith(('bskin_', 'bwear_')))
    print('[bathers2tex] %d skins, %.2f MB of texture' % (len(tones), n / 1e6))
    credits(used)


def credits(used):
    by = sorted({v['author'] for v in used.values() if v['lic'] == 'CC-BY'})
    lines = ['# Bather credits', '',
             'Skins, hairstyles and swimwear on the Jadrija bathers come from the',
             'MakeHuman community asset packs, fitted to each bather through its',
             '`.mhclo` by `tools/blender/bathers_v2.py`. Licences are as stated by',
             "each pack's own registry (`packs/<pack>.json`).", '',
             'Index: <https://static.makehumancommunity.org/assets/assetpacks.html>', '',
             '## CC-BY — attribution required', '', ', '.join(by) or '(none)', '',
             '## Every asset', '', '| asset | licence | author |', '| --- | --- | --- |']
    for k, v in sorted(used.items()):
        lines.append('| %s | %s | %s |' % (k, v['lic'], v['author']))
    (ROOT / 'tools' / 'bathers_v2_CREDITS.md').write_text('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
