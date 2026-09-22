#!/usr/bin/env python3
"""Fetch the MakeHuman community asset packs, pick from them, and FIT.

── why this exists ───────────────────────────────────────────────────────────

An evening went into generating skin, hair and a swimsuit procedurally and the
result was, accurately, called a monstrosity. The community packs are authored
against `build/mh_base.obj` — the same 19 158-vertex base this project already
builds its people from, with the same UV layout — by people who model hair for
a living. Ten minutes of downloading beat the evening by a distance that is not
close.

── the fit, which is the part that is not obvious ────────────────────────────

An asset's `.obj` is NOT in the base mesh's space. It is in whatever space its
author modelled it in — on a tall body, a short one, a heavy one. The first
hairstyle tried landed perfectly and that was a coincidence; four of the next
five hung off the face with a bald crown.

The fitting lives in the `.mhclo` beside it. One line per asset vertex:

    v0 v1 v2  w0 w1 w2  dx dy dz

The vertex rides a triangle of BASE mesh vertices at those barycentric
weights, plus an offset — and the offset is in units of the body's own
proportions, which is what the three header lines are for:

    x_scale 5399 11998 1.3980   # |B[5399].x - B[11998].x| when I modelled this

so `sx = |B[a].x - B[b].x| / d` and

    fitted = w0*B[v0] + w1*B[v1] + w2*B[v2] + (dx*sx, dy*sy, dz*sz)

A line carrying a single integer is a vertex welded straight on to that base
vertex. Indices are into the base `.obj` IN FILE ORDER, so it is parsed here
rather than in Blender — Blender's importer reorders and splits, and an index
into a reordered array is silently the wrong vertex.

Vertex counts matching exactly, asset by asset, is the check that the indices
landed; it is printed for every asset for that reason.

── licensing, because this repository is public ──────────────────────────────

Every pack ships `packs/<pack>.json`, which is the community site's own
registry and the authoritative licence for each asset. The `# license` comment
inside an individual `.mhclo` is MakeHuman's boilerplate default and says
AGPL3 on assets the registry lists as CC0 — trusting it would have thrown out
half this wardrobe for no reason. Only CC0 and CC-BY are taken; anything else
is refused loudly rather than skipped quietly. See
tools/wardrobe/CREDITS.md, which this file writes.
"""
import io
import json
import re
import shutil
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'build' / 'mh_assets'
OUT = ROOT / 'build' / 'wardrobe'
URL = 'https://files2.makehumancommunity.org/asset_packs/%s/%s_cc0.zip'
OK_LICENCES = ('CC0', 'CC-BY')

# What she can wear. Order is the order of the buttons.
PICK = {
    'skin': [('skins01', 'toigo_light_skin_female_freckles'),
             ('skins01', 'toigo_light_skin_female_bronze'),
             ('skins01', 'toigo_light_skin_with_natural_makeup'),
             ('skins01', 'darthfurby_caucasian_female'),
             ('skins01', 'callharvey3d_midtoned_female'),
             ('skins01', 'cutoff3d_indian_female_enhanced'),
             ('skins01', 'onlytheghosts_middle_aged_eurasian_female')],
    'hair': [('hair01', 'littleright_bobcut_hair'),
             ('hair01', 'toigo_curled_under_bob_with_bangs'),
             ('hair01', 'cortu_short_messy_hair'),
             ('hair01', 'elvs_unkempt_french_braid'),
             ('hair01', 'rehmanpolanski_hair_bun_brown'),
             ('hair01', 'sonntag78_blond_with_headband'),
             ('hair01', 'culturalibre_hair_02'),
             ('hair01', 'o4saken_long01')],
    'lash': [('eyelashes01', 'mindfront_eyelashes_02'),
             ('eyelashes01', 'mindfront_eyelashes_04')],
    'brow': [('eyebrows01', 'mindfront_eyebrows_03'),
             ('eyebrows01', 'mindfront_eyebrows_07'),
             ('eyebrows01', 'mindfront_eyebrows_09')],
    'top':  [('underwear02', 'punkduck_bandeau_bikini_bra'),
             ('underwear02', 'punkduck_bikini02_bra'),
             ('underwear02', 'punkduck_brazilian_bikini_bra'),
             ('underwear02', 'punkduck_frill_bikini_top'),
             ('underwear02', 'mindfront_bikini_01'),
             ('underwear02', 'punkduck_sport_bra'),
             ('underwear02', 'elvs_bow_front_bra'),
             ('underwear02', 'punkduck_french_lingerie_bra'),
             ('underwear01', 'wolgade_female_top_01')],
    'btm':  [('underwear02', 'punkduck_bandeau_bikini_slip'),
             ('underwear02', 'punkduck_bikini02_slip'),
             ('underwear02', 'punkduck_brazilian_bikini_slip'),
             ('underwear02', 'punkduck_frill_bikini_bottom'),
             ('underwear02', 'punkduck_sport_briefs'),
             ('underwear02', 'elvs_bow_bottom_panty'),
             ('underwear02', 'elvs_lace_panty'),
             ('underwear02', 'elvs_crude_bootyshorts'),
             ('underwear01', 'wolgade_female_panties_01')],
    'leg':  [('underwear02', 'jaldmic_stockings'),
             ('underwear01', 'v0rt3x_stockings_black_fishnet_medium')],
}
# Everything here ends up base64'd into one file that opens by double-click, so
# pixels are the entire budget. A skin is the one thing worth 1024 px of
# photographic JPEG; a hair card needs its alpha and quantises well.
# Legwear is the exception: a fishnet is a fine regular grid and halving it
# blurs the holes shut, so it keeps its full resolution and quantises hard
# instead — it is two colours and an alpha.
MAXPX = {'skin': 1024, 'hair': 1024, 'top': 512, 'btm': 512, 'leg': 1024,
         'lash': 256, 'brow': 256}
QUANT = {'hair': 64, 'top': 96, 'btm': 96, 'leg': 16}


def packs():
    CACHE.mkdir(parents=True, exist_ok=True)
    for pack in sorted({p for items in PICK.values() for p, _ in items}):
        d = CACHE / pack
        if d.exists():
            continue
        print('  downloading %s' % pack)
        with urllib.request.urlopen(URL % (pack, pack)) as r:
            zipfile.ZipFile(io.BytesIO(r.read())).extractall(d)


def registry(pack):
    """The community site's own licence table — not the in-file boilerplate."""
    p = CACHE / pack / 'packs' / ('%s.json' % pack)
    return json.loads(p.read_text()) if p.exists() else {}


def find(pack, name):
    for d in (CACHE / pack).rglob(name):
        if d.is_dir():
            return d
    # Some packs name the folder after the author rather than the material.
    for d in (CACHE / pack).rglob('*'):
        if d.is_dir() and (d / (name + '.mhclo')).exists():
            return d
    return None


def diffuse_of(d):
    for m in sorted(d.glob('*.mhmat')):
        for ln in m.read_text(errors='ignore').splitlines():
            g = re.match(r'\s*diffuseTexture\s+(\S+)', ln)
            if g and (d / g.group(1)).exists():
                return d / g.group(1)
    pngs = [p for p in sorted(d.glob('*.png')) if 'thumb' not in p.name.lower()]
    return pngs[0] if pngs else None


# ── the fit ──────────────────────────────────────────────────────────────── #

def obj_verts(p):
    return [[float(x) for x in ln.split()[1:4]]
            for ln in p.read_text(errors='ignore').splitlines() if ln.startswith('v ')]


def read_mhclo(p):
    scale, refs, ws, offs, inv = {}, [], [], [], False
    for ln in p.read_text(errors='ignore').splitlines():
        w = ln.split()
        if not w:
            continue
        if w[0] in ('x_scale', 'y_scale', 'z_scale'):
            scale[w[0][0]] = (int(w[1]), int(w[2]), float(w[3]))
            continue
        if w[0] == 'verts':
            inv = True
            continue
        if not inv:
            continue
        try:
            if len(w) >= 9:
                refs.append((int(w[0]), int(w[1]), int(w[2])))
                ws.append((float(w[3]), float(w[4]), float(w[5])))
                offs.append((float(w[6]), float(w[7]), float(w[8])))
            elif len(w) == 1:
                i = int(w[0])
                refs.append((i, i, i)); ws.append((1.0, 0.0, 0.0)); offs.append((0.0,) * 3)
            else:
                break
        except ValueError:
            break
    return scale, refs, ws, offs


def fit(mhclo, base):
    sc, refs, ws, offs = read_mhclo(mhclo)
    if not refs:
        return None, 'no verts block', None
    hi = max(max(r) for r in refs)
    if hi >= len(base):
        return None, 'index %d past a %d-vertex base' % (hi, len(base)), None
    s = [1.0, 1.0, 1.0]
    for k, ax in (('x', 0), ('y', 1), ('z', 2)):
        if k in sc:
            a, b, d = sc[k]
            s[ax] = abs(base[a][ax] - base[b][ax]) / d if d else 1.0
    co = []
    for (a, b, c), (wa, wb, wc), off in zip(refs, ws, offs):
        co.append([base[a][i] * wa + base[b][i] * wb + base[c][i] * wc + off[i] * s[i]
                   for i in range(3)])
    return co, 's=%.3f,%.3f,%.3f' % tuple(s), (refs, ws)


def rewrite(obj_in, co, obj_out):
    """New positions, same faces, same UVs, same everything else."""
    lines, i = [], 0
    for ln in obj_in.read_text(errors='ignore').splitlines():
        if ln.startswith('v '):
            lines.append('v %.6f %.6f %.6f' % tuple(co[i])); i += 1
        else:
            lines.append(ln)
    obj_out.write_text('\n'.join(lines) + '\n')
    return i


def main():
    packs()
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.iterdir():
        if f.is_file() and f.suffix in ('.obj', '.png', '.jpg', '.json'):
            f.unlink()
    base = obj_verts(ROOT / 'build' / 'mh_base.obj')
    print('[wardrobe] base %d verts' % len(base))

    man, cred, bad = {}, {}, []
    for kind, items in PICK.items():
        man[kind] = []
        for pack, name in items:
            d = find(pack, name)
            if not d:
                bad.append('%s/%s not in the pack' % (pack, name)); continue
            entry = registry(pack).get(name, {})
            lic = (entry.get('license') or '?').strip()
            if lic not in OK_LICENCES:
                bad.append('%s is %s, not %s' % (name, lic, '/'.join(OK_LICENCES)))
                continue
            cred[name] = {'kind': kind, 'lic': lic, 'pack': pack,
                          'author': entry.get('author') or entry.get('original_author') or '?',
                          'src': entry.get('source', '')}
            rec = {'id': name, 'pack': pack, 'lic': lic, 'author': cred[name]['author']}

            obj = next(iter(sorted(d.glob('*.obj'))), None)
            mhclo = next(iter(sorted(d.glob('*.mhclo'))), None)
            if obj and kind != 'skin':
                if not mhclo:
                    bad.append('%s has no .mhclo, so it cannot be fitted' % name); continue
                co, note, _ = fit(mhclo, base)
                nv = len(obj_verts(obj))
                if co is None or len(co) != nv:
                    bad.append('%s: %s (%s fit vs %d obj verts)'
                               % (name, note, 'none' if co is None else len(co), nv))
                    continue
                rec['obj'] = '%s__%s.obj' % (kind, name)
                rewrite(obj, co, OUT / rec['obj'])
                rec['verts'] = nv

            tex, im = diffuse_of(d), None
            if tex:
                try:
                    im = Image.open(tex); im.load()
                except Exception as e:
                    # One asset in underwear02 ships a PNG no decoder likes.
                    # Its geometry is fine, so it goes in untextured.
                    print('  %-5s %-40s bad texture (%s)' % (kind, name, type(e).__name__))
            if im is not None:
                mx = MAXPX[kind]
                if max(im.size) > mx:
                    im = im.resize((mx, mx), Image.LANCZOS)
                alpha = im.mode in ('RGBA', 'LA') and kind != 'skin'
                rec['tex'] = '%s__%s.%s' % (kind, name, 'png' if alpha else 'jpg')
                rec['alpha'] = alpha
                if alpha:
                    q = QUANT.get(kind)
                    # FASTOCTREE is the only PIL quantiser that keeps an alpha
                    # channel. The default one drops it, every hair card goes
                    # opaque, and what you get is a rectangle of scalp over
                    # the face.
                    if q:
                        im = im.convert('RGBA').quantize(colors=q, method=Image.FASTOCTREE)
                    im.save(OUT / rec['tex'], optimize=True)
                else:
                    im.convert('RGB').save(OUT / rec['tex'], quality=84, optimize=True)
            man[kind].append(rec)
            print('  %-5s %-40s %-6s %-7s %s'
                  % (kind, name, lic, rec.get('verts', '-'), rec.get('tex', 'no texture')))

    if bad:
        raise SystemExit('[wardrobe] REFUSED:\n  ' + '\n  '.join(bad))

    (OUT / 'manifest.json').write_text(json.dumps(man, indent=1))
    credits_md(cred)
    n = sum(p.stat().st_size for p in OUT.iterdir() if p.suffix in ('.png', '.jpg'))
    print('[wardrobe] %d assets, %.2f MB of texture' % (len(cred), n / 1e6))


def credits_md(cred):
    """CC-BY is only free if you actually attribute, so this is generated."""
    by = sorted(v['author'] for v in cred.values() if v['lic'] == 'CC-BY')
    lines = ['# Wardrobe credits', '',
             'Every skin, hairstyle, garment, eyebrow and eyelash in',
             '`wardrobe.html` comes from the MakeHuman community asset packs,',
             'which are authored against the same base mesh this project',
             'builds its people from. Licences below are as stated by the',
             "community site's own pack registry (`packs/<pack>.json`), which",
             'is authoritative — the `# license` comment inside an individual',
             '`.mhclo` is MakeHuman boilerplate and is wrong for many of these.',
             '', 'Index: <https://static.makehumancommunity.org/assets/assetpacks.html>',
             '', '## CC-BY — attribution required', '',
             ', '.join(sorted(set(by))) or '(none)', '',
             '## Every asset', '',
             '| kind | asset | licence | author |', '| --- | --- | --- | --- |']
    for k, v in sorted(cred.items(), key=lambda x: (x[1]['kind'], x[0])):
        lines.append('| %s | %s | %s | %s |' % (v['kind'], k, v['lic'], v['author']))
    (Path(__file__).resolve().parent / 'CREDITS.md').write_text('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
