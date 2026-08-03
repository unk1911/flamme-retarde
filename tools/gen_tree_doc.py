#!/usr/bin/env python3
"""Typeset docs/how-a-tree-is-drawn.pdf — how the vegetation is generated.

The ring tables below are transcribed from src/45-trees.js, and everything the
document shows is computed from them: the four silhouettes are the real
profiles, the plan view is the actual output of vegRing(), and the triangle
counts are counted rather than quoted. Change a profile in the source and the
figures follow; they cannot drift into being decorative.

Typesetting is MathML through headless Chrome, there being no LaTeX in this
toolchain. Two things to know if you edit the equations: Chrome implements
MathML Core, which ignores mtable's columnalign, and it drops display style
inside table cells so fractions shrink to subscript size. Both are avoided by
laying equations out as a CSS grid of individual <math> elements. Chrome will
also not stretch parentheses around a tall fraction whatever you ask of
minsize, so name the quotient instead of parenthesising it.

    python3 tools/gen_tree_doc.py [--html-only]
"""
import html
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT = ROOT / "docs" / "how-a-tree-is-drawn.pdf"

CHROME = ("google-chrome", "chromium", "chromium-browser", "google-chrome-stable")

# ---------------------------------------------------------------- species data

BARK = (0.30, 0.23, 0.17)
OLIVE_BARK = (0.33, 0.29, 0.24)

SPECIES = [
    dict(
        name="Aleppo pine", key="pine", seg=8, split=3,
        bark=BARK, leaf=(0.14, 0.24, 0.13), size=(7, 13, 1.9),
        rings=[(0.00, 0.055, 0), (0.26, 0.040, 0), (0.48, 0.034, 0),
               (0.50, 0.34, 0.22), (0.62, 0.42, 0.21), (0.74, 0.45, 0.20),
               (0.86, 0.36, 0.19), (0.95, 0.22, 0.16), (1.00, 0.06, 0)],
        note="Bare leaning trunk, flat irregular umbrella.",
    ),
    dict(
        name="Cypress", key="cypress", seg=8, split=1,
        bark=BARK, leaf=(0.09, 0.17, 0.11), size=(7, 14, 1.0),
        rings=[(0.00, 0.045, 0), (0.10, 0.070, 0), (0.32, 0.105, 0.10),
               (0.66, 0.095, 0.10), (0.90, 0.060, 0), (1.00, 0.010, 0)],
        note="The dark exclamation mark in every churchyard.",
    ),
    dict(
        name="Olive", key="olive", seg=8, split=2,
        bark=OLIVE_BARK, leaf=(0.36, 0.41, 0.30), size=(3.4, 5.4, 1.7),
        rings=[(0.00, 0.14, 0), (0.20, 0.10, 0), (0.30, 0.44, 0.24),
               (0.46, 0.53, 0.23), (0.62, 0.56, 0.22), (0.80, 0.47, 0.21),
               (0.92, 0.32, 0.19), (1.00, 0.10, 0)],
        note="Short, thick, gnarled, and much harder to set alight.",
    ),
    dict(
        name="Maquis scrub", key="bush", seg=6, split=0,
        bark=BARK, leaf=(0.26, 0.30, 0.19), size=(0.9, 2.2, 1.5),
        rings=[(0.00, 0.42, 0), (0.38, 0.58, 0.28), (0.74, 0.46, 0.26),
               (1.00, 0.10, 0)],
        note="No trunk worth modelling, and why the whole coast goes up.",
    ),
]


def rgb(c, mul=1.0):
    return "#%02x%02x%02x" % tuple(
        max(0, min(255, round(v * mul * 255))) for v in c)


def ring_radius(i, seg, r, y, jag):
    """The equation itself, verbatim from vegRing()."""
    return r * (1 + jag * math.sin(i * 2.37 + y * 6.1))


def tri_count(sp):
    return (len(sp["rings"]) - 1) * sp["seg"] * 2


# ------------------------------------------------------------------- figure A

def profile_svg(sp, w=168, h=250):
    """Side elevation of one species, drawn from its real ring table."""
    rings = sp["rings"]
    rmax = max(r for _, r, _ in rings)
    pad_t, pad_b = 18, 30
    usable = h - pad_t - pad_b
    sy = usable                       # height 1.0 -> usable px
    sx = min(usable, (w - 30) / (2 * rmax * 1.06))
    cx = w / 2

    def X(r):
        return cx + r * sx

    def Y(y):
        return h - pad_b - y * sy

    out = [f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
           f'role="img" aria-label="{sp["name"]} profile">']

    # ground line
    out.append(f'<line x1="6" y1="{Y(0):.1f}" x2="{w-6}" y2="{Y(0):.1f}" '
               f'stroke="#c9c2b4" stroke-width="1"/>')

    # one filled band per ring gap, so the bark/leaf split is visible
    for k in range(len(rings) - 1):
        y0, r0, _ = rings[k]
        y1, r1, _ = rings[k + 1]
        col = sp["bark"] if k < sp["split"] else sp["leaf"]
        pts = (f'{X(r0):.1f},{Y(y0):.1f} {X(r1):.1f},{Y(y1):.1f} '
               f'{X(-r1):.1f},{Y(y1):.1f} {X(-r0):.1f},{Y(y0):.1f}')
        out.append(f'<polygon points="{pts}" fill="{rgb(col, 1.9)}" '
                   f'stroke="{rgb(col, 1.25)}" stroke-width="0.7"/>')

    # the rings themselves, as ticks with their vertices marked
    for (y, r, jag) in rings:
        out.append(f'<line x1="{X(-r):.1f}" y1="{Y(y):.1f}" '
                   f'x2="{X(r):.1f}" y2="{Y(y):.1f}" '
                   f'stroke="#2b2721" stroke-width="0.6" opacity="0.55"/>')
        out.append(f'<circle cx="{X(r):.1f}" cy="{Y(y):.1f}" r="1.5" '
                   f'fill="#2b2721" opacity="0.7"/>')
        out.append(f'<circle cx="{X(-r):.1f}" cy="{Y(y):.1f}" r="1.5" '
                   f'fill="#2b2721" opacity="0.7"/>')

    lo, hi, _ = sp["size"]
    out.append(f'<text x="{cx}" y="{h-16}" text-anchor="middle" '
               f'class="fname">{html.escape(sp["name"])}</text>')
    out.append(f'<text x="{cx}" y="{h-5}" text-anchor="middle" class="fmeta">'
               f'{len(sp["rings"])} rings &#215; {sp["seg"]} sides '
               f'&#8594; {tri_count(sp)} tris</text>')
    out.append(f'<text x="{cx}" y="{Y(1)-6:.1f}" text-anchor="middle" '
               f'class="fmeta">{lo}&#8211;{hi} m</text>')
    out.append("</svg>")
    return "\n".join(out)


# ------------------------------------------------------------------- figure B

def jag_svg(w=300, h=300):
    """Plan view of one canopy ring: the jag term versus a perfect circle."""
    y, r, jag, seg = 0.74, 0.45, 0.20, 8
    cx = cy = w / 2
    s = (w / 2 - 46) / r

    out = [f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
           f'role="img" aria-label="ring irregularity">']
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{r*s:.1f}" fill="none" '
               f'stroke="#b9b1a2" stroke-width="1" stroke-dasharray="4 4"/>')

    pts, spokes = [], []
    for i in range(seg):
        a = (i / seg) * 2 * math.pi
        rr = ring_radius(i, seg, r, y, jag)
        px, py = cx + math.cos(a) * rr * s, cy + math.sin(a) * rr * s
        pts.append((px, py, rr, i, a))
        nx, ny = cx + math.cos(a) * r * s, cy + math.sin(a) * r * s
        spokes.append((nx, ny))

    poly = " ".join(f"{p[0]:.1f},{p[1]:.1f}" for p in pts)
    out.append(f'<polygon points="{poly}" fill="#2f4a2a" fill-opacity="0.16" '
               f'stroke="#2f4a2a" stroke-width="1.6"/>')

    for (px, py, rr, i, a), (nx, ny) in zip(pts, spokes):
        out.append(f'<line x1="{nx:.1f}" y1="{ny:.1f}" x2="{px:.1f}" '
                   f'y2="{py:.1f}" stroke="#a3492f" stroke-width="1.1"/>')
        out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="2.6" '
                   f'fill="#2f4a2a"/>')
        lx = cx + math.cos(a) * (rr * s + 17)
        ly = cy + math.sin(a) * (rr * s + 17) + 3.5
        out.append(f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
                   f'class="fmeta">{i}</text>')

    out.append(f'<circle cx="{cx}" cy="{cy}" r="1.8" fill="#2b2721"/>')
    out.append(f'<text x="{cx}" y="{h-6}" text-anchor="middle" class="fmeta">'
               f'canopy ring at y = 0.74, r = 0.45, j = 0.20, n = 8'
               f'</text>')
    out.append("</svg>")
    return "\n".join(out)


def jag_table():
    y, r, jag, seg = 0.74, 0.45, 0.20, 8
    cells = []
    for i in range(seg):
        rr = ring_radius(i, seg, r, y, jag)
        cells.append((i, rr, rr / r))
    head = "".join(f"<th>{i}</th>" for i, _, _ in cells)
    row1 = "".join(f"<td>{rr:.3f}</td>" for _, rr, _ in cells)
    row2 = "".join(f"<td>{k*100:.0f}%</td>" for _, _, k in cells)
    return (f'<table class="num"><thead><tr><th>i</th>{head}</tr></thead>'
            f'<tbody><tr><th>&#961;<sub>i</sub></th>{row1}</tr>'
            f'<tr><th>of r</th>{row2}</tr></tbody></table>')


# ------------------------------------------------------------ code formatting

TOKEN = re.compile(r"""
   (?P<comment>//[^\n]*)
 | (?P<string>'[^'\n]*'|"[^"\n]*")
 | (?P<kw>\b(?:const|let|var|function|for|return|new|of|in|if|else)\b)
 | (?P<num>\b\d+\.?\d*\b)
 | (?P<fn>\b[A-Za-z_$][\w$]*(?=\s*\())
""", re.X)


def code(src, caption=None):
    out, pos = [], 0
    for m in TOKEN.finditer(src):
        out.append(html.escape(src[pos:m.start()]))
        kind = m.lastgroup
        out.append(f'<span class="{kind}">{html.escape(m.group())}</span>')
        pos = m.end()
    out.append(html.escape(src[pos:]))
    cap = f'<div class="cap">{caption}</div>' if caption else ""
    return f'<figure class="code">{cap}<pre>{"".join(out)}</pre></figure>'


# ------------------------------------------------------------------- the page

VEG_RING = """function vegRing(y, r, seg, jag = 0) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    const rr = r * (1 + jag * Math.sin(i * 2.37 + y * 6.1));
    pts.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  return pts;
}"""

PINE = """const pine = vegGeo([
  vegRing(0.00, 0.055, S), vegRing(0.26, 0.040, S), vegRing(0.48, 0.034, S),
  vegRing(0.50, 0.34, S, 0.22), vegRing(0.62, 0.42, S, 0.21),
  vegRing(0.74, 0.45, S, 0.20), vegRing(0.86, 0.36, S, 0.19),
  vegRing(0.95, 0.22, S, 0.16), vegRing(1.00, 0.06, S),
], S, 3, bark, [0.14, 0.24, 0.13]);"""

LOFT = """const a = at(r, p), b = at(r, p + 1),
      c = at(r + 1, p + 1), d = at(r + 1, p);
idx.push(a, b, c,  a, c, d);"""

INSTANCE = """const h = lo + rng() * (hi - lo);
out[pick].push({
  x, y, z, h,
  w: h * wide * (0.78 + rng() * 0.44) / ((lo + hi) * 0.5),
  yaw: rng() * TAU,
  tint: 0.80 + rng() * 0.34,
  warm: rng() * 0.16,
});"""

REPACK = """const fade = 1 - sat((Math.sqrt(d2) - R * 0.80) / (R * 0.20));
if (fade < 0.02) continue;

const char = fire ? fire.charAt(t.x, t.z) : 0;
const alight = fire ? fire.intensityAt(t.x, t.z) : 0;
const shrink = (1 - 0.40 * char) * (0.35 + 0.65 * fade);"""


def M(inner, block=True):
    """Chrome implements MathML Core, which ignores mtable's columnalign and
    drops displaystyle inside cells — so equations are laid out as a CSS grid
    of individual <math> elements instead, each forced to display style."""
    d = ' displaystyle="true"' if block else ""
    return f"<math{d}>{inner}</math>"


def eqrows(rows):
    cells = []
    for lhs, rhs in rows:
        cells.append(f'<div class="eq-l">{M(lhs)}</div>'
                     f'<div class="eq-o">{M("<mo>=</mo>")}</div>'
                     f'<div class="eq-r">{M(rhs)}</div>')
    return f'<div class="eqgrid">{"".join(cells)}</div>'


def eqone(inner):
    return f'<div class="eqone">{M(inner)}</div>'


def paren(inner, size=None):
    """size forces the delimiters taller — Chrome will not stretch them to fit
    a fraction on its own."""
    a = f' minsize="{size}" maxsize="{size}"' if size else ""
    return f'<mrow><mo{a}>(</mo>{inner}<mo{a}>)</mo></mrow>'


TIMES = "<mo>&#8290;</mo>"     # invisible times
APPLY = "<mo>&#8289;</mo>"     # function application
TH = '<msub><mi>&#952;</mi><mi>i</mi></msub>'
RHO = '<msub><mi>&#961;</mi><mi>i</mi></msub>'


EQ_RING = eqrows([
    (TH,
     "<mfrac><mrow><mn>2</mn><mi>&#960;</mi><mi>i</mi></mrow>"
     "<mi>n</mi></mfrac>"),
    (RHO,
     f'<mi>r</mi>{TIMES}' + paren(
         f'<mn>1</mn><mo>+</mo><mi>j</mi>{TIMES}<mi>sin</mi>{APPLY}'
         + paren(f'<mn>2.37</mn>{TIMES}<mi>i</mi><mo>+</mo>'
                 f'<mn>6.1</mn>{TIMES}<mi>y</mi>'))),
    ('<msub><mi>P</mi><mi>i</mi></msub>',
     paren(f'{RHO}{TIMES}<mi>cos</mi>{APPLY}{TH}'
           f'<mo>,</mo><mspace width="0.5em"/><mi>y</mi>'
           f'<mo>,</mo><mspace width="0.5em"/>'
           f'{RHO}{TIMES}<mi>sin</mi>{APPLY}{TH}')),
])

EQ_TRIS = eqone(
    f'<mi>T</mi><mo>=</mo><mn>2</mn>{TIMES}'
    + paren('<mi>R</mi><mo>&#8722;</mo><mn>1</mn>') + TIMES + '<mi>n</mi>')

H_LO = '<msub><mi>h</mi><mi>lo</mi></msub>'
H_HI = '<msub><mi>h</mi><mi>hi</mi></msub>'

EQ_SIZE = eqrows([
    ('<mi>h</mi>',
     f'{H_LO}<mo>+</mo><mi>&#958;</mi>{TIMES}'
     + paren(f'{H_HI}<mo>&#8722;</mo>{H_LO}')),
    ('<mi>w</mi>',
     '<mfrac>'
     f'<mrow><mi>h</mi>{TIMES}<mi>k</mi>{TIMES}'
     + paren(f'<mn>0.78</mn><mo>+</mo><mn>0.44</mn>{TIMES}<mi>&#958;</mi>')
     + '</mrow>'
     '<mrow><mfrac><mn>1</mn><mn>2</mn></mfrac>'
     + paren(f'{H_LO}<mo>+</mo>{H_HI}') + '</mrow></mfrac>'),
])

EQ_FADE = eqrows([
    ('<mi>u</mi>',
     '<mfrac>'
     f'<mrow><mi>d</mi><mo>&#8722;</mo><mn>0.80</mn>{TIMES}<mi>R</mi></mrow>'
     f'<mrow><mn>0.20</mn>{TIMES}<mi>R</mi></mrow></mfrac>'),
    ('<mi>f</mi>',
     f'<mn>1</mn><mo>&#8722;</mo><mi>sat</mi>{APPLY}'
     + paren('<mi>u</mi>')),
    ('<mi>s</mi>',
     paren(f'<mn>1</mn><mo>&#8722;</mo><mn>0.40</mn>{TIMES}<mi>c</mi>')
     + TIMES
     + paren(f'<mn>0.35</mn><mo>+</mo><mn>0.65</mn>{TIMES}<mi>f</mi>')),
])

CSS = """
@page { size: A4; margin: 15mm 16mm 14mm; }
:root {
  --ink: #23201b; --dim: #6d675c; --rule: #ddd6c7;
  --paper: #fbf9f4; --panel: #f3efe5; --accent: #8a4a2c;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--paper); color: var(--ink);
  font-family: "Iowan Old Style", Palatino, "Palatino Linotype", Georgia,
               "DejaVu Serif", serif;
  font-size: 10.5pt; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.sheet { max-width: 178mm; margin: 0 auto; padding: 4mm 0 0; }
h1 { font-size: 20pt; margin: 0 0 2px; letter-spacing: -0.01em; font-weight: 600; }
.sub { color: var(--dim); font-size: 10pt; margin: 0 0 4px;
       font-variant: small-caps; letter-spacing: 0.06em; }
.rule { height: 2px; background: var(--ink); margin: 8px 0 16px; }
h2 { font-size: 13pt; margin: 20px 0 6px; font-weight: 600;
     break-after: avoid; }
h2 .n { color: var(--accent); font-variant-numeric: tabular-nums;
        margin-right: 8px; }
h3 { font-size: 10.5pt; margin: 14px 0 4px; font-weight: 600; color: var(--dim);
     font-variant: small-caps; letter-spacing: 0.05em; break-after: avoid; }
p { margin: 0 0 9px; text-align: justify; hyphens: auto; }
p.lead { font-size: 11.5pt; }
code, kbd { font-family: "SF Mono", "DejaVu Sans Mono", Menlo, Consolas,
            monospace; font-size: 0.88em; background: var(--panel);
            padding: 0.05em 0.32em; border-radius: 3px; }
figure { margin: 12px 0; break-inside: avoid; }
figure.code { margin: 10px 0 12px; }
figure.code pre {
  margin: 0; padding: 9px 12px; background: #262320; color: #e6e0d4;
  border-radius: 5px; overflow-x: auto;
  font-family: "SF Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace;
  font-size: 8.4pt; line-height: 1.5;
}
.cap { font-size: 8pt; color: var(--dim); margin-bottom: 4px;
       font-variant: small-caps; letter-spacing: 0.07em; }
.comment { color: #7f8a72; font-style: italic; }
.string  { color: #d9a05b; }
.kw      { color: #c98fc0; }
.num     { color: #86b8d8; }
.fn      { color: #8fd0a6; }
math { font-size: 12.5pt; }
.eqbox { background: var(--panel); border-left: 3px solid var(--accent);
         padding: 10px 16px; margin: 13px 0; break-inside: avoid; }
.eqgrid { display: grid;
          grid-template-columns: max-content max-content max-content;
          column-gap: 9px; row-gap: 11px;
          justify-content: center; align-items: center; }
.eq-l { text-align: right; }
.eq-r { text-align: left; }
.eqone { text-align: center; }
.gallery { display: flex; gap: 6px; justify-content: space-between;
           align-items: flex-end; margin: 10px 0 4px; break-inside: avoid; }
.gallery svg, .side svg { flex: 0 0 auto; }
.fname { font-size: 8.6px; font-weight: 600; fill: #23201b;
         font-family: Georgia, serif; }
.fmeta { font-size: 7.4px; fill: #6d675c;
         font-family: "DejaVu Sans Mono", monospace; }
.side { display: flex; gap: 18px; align-items: center; break-inside: avoid; }
.side .txt { flex: 1 1 auto; }
table.num { border-collapse: collapse; font-size: 8pt; margin: 8px 0 2px;
            font-family: "DejaVu Sans Mono", monospace; width: 100%; }
table.num th, table.num td { border: 1px solid var(--rule); padding: 2px 5px;
                             text-align: center; white-space: nowrap; }
table.num thead th { background: var(--panel); }
table.num tbody th { background: var(--panel); text-align: right;
                     font-weight: 600; }
.note { border-left: 3px solid var(--rule); padding-left: 12px;
        color: var(--dim); font-size: 9.6pt; margin: 12px 0; }
.foot { margin-top: 22px; border-top: 1px solid var(--rule); padding-top: 8px;
        font-size: 8.6pt; color: var(--dim); display: flex;
        justify-content: space-between; }
.src { font-family: "DejaVu Sans Mono", monospace; font-size: 0.94em; }
"""


def build():
    gallery = "\n".join(profile_svg(s) for s in SPECIES)
    total = sum(tri_count(s) for s in SPECIES)

    body = f"""
<div class="sheet">
<p class="sub">Flamme Retard&#233; &#183; technical note</p>
<h1>How a tree is drawn</h1>
<div class="rule"></div>

<p class="lead">There is no L-system, no branching, no recursion and no
imported model. A tree in &#352;ibenik is a <strong>stack of rings lofted into
a tube</strong> &#8212; one prototype per species, drawn thousands of times by
four instanced draw calls. Two functions do all of it.</p>

<h2><span class="n">1</span>The ring</h2>

<p>Every profile in the landscape is generated by one twelve-line function.
It walks <math><mi>n</mi></math> points around a circle at height
<math><mi>y</mi></math>, modulating the radius as it goes:</p>

{code(VEG_RING, "src/45-trees.js:47")}

<p>Which is to say, for <math><mi>i</mi><mo>=</mo><mn>0</mn>
<mo>&#8230;</mo><mi>n</mi><mo>&#8722;</mo><mn>1</mn></math>:</p>

<div class="eqbox">{EQ_RING}</div>

<p>The whole trick is the <math><mi>j</mi></math> term &#8212; the
<code>jag</code> argument. Take it away and you have a lathe: a perfectly
circular canopy that the eye reads as a cone of revolution from any angle.</p>

<div class="side">
  <div class="txt">
    <p><strong>2.37 is deliberately not an integer.</strong> If the frequency
    divided evenly into <math><mn>2</mn><mi>&#960;</mi></math> the wobble
    would close up around the ring and simply produce a smaller, still
    symmetric polygon. Because it does not, vertex&#160;0 and vertex&#160;<math><mi>n</mi></math>
    disagree about the radius, and the seam falls somewhere arbitrary.</p>
    <p><strong>The <math><mn>6.1</mn><mo>&#8290;</mo><mi>y</mi></math> term
    re-phases per height.</strong> The ring at
    <math><mi>y</mi><mo>=</mo><mn>0.62</mn></math> bulges in different
    directions from the one at <math><mi>y</mi><mo>=</mo><mn>0.74</mn></math>,
    so the canopy leans and lumps down its length instead of being an extruded
    silhouette.</p>
    {jag_table()}
  </div>
  {jag_svg()}
</div>

<h2><span class="n">2</span>The species</h2>

<p>A species is then just a table of numbers. An Aleppo pine is nine of
them &#8212; three thin rings for the bare trunk, then the flat umbrella
that reads as Dalmatia from a thousand feet:</p>

{code(PINE, "src/45-trees.js:85")}

<p>Everything is normalised to height&#160;1, so <math><mi>y</mi></math> runs
<math><mn>0</mn><mo>&#8594;</mo><mn>1</mn></math> and radii are in the same
units. <code>S&#160;=&#160;8</code> is the side count.
<code>split&#160;=&#160;3</code> means rings&#160;0&#8211;2 are painted bark and
everything above is leaf &#8212; as <em>vertex colours</em>, so a single
instanced draw carries both materials without a second pass.</p>

<div class="gallery">
{gallery}
</div>
<p class="cap" style="text-align:center">Every profile in the game, drawn from
its own ring table. Ticks mark the rings; brown bands are below the split.</p>

<p>Skinning the stack is the other half. <code>loft()</code> emits the quad
grid between consecutive rings &#8212; two triangles per side per gap, wound
consistently:</p>

{code(LOFT, "src/30-material.js:180")}

<div class="eqbox">{EQ_TRIS}</div>

<p>for <math><mi>R</mi></math> rings of <math><mi>n</mi></math> sides. A pine
is {tri_count(SPECIES[0])} triangles, a cypress {tri_count(SPECIES[1])}, an
olive {tri_count(SPECIES[2])}, a maquis bush {tri_count(SPECIES[3])}.
<strong>{total} triangles is the entire flora of &#352;ibenik</strong> &#8212;
everything else is instancing.</p>

<div class="note">Eight sides, not five. A pentagonal cross-section is what
made the hillside read as faceted from low down; eight is the point where a
canopy stops having corners. Since the landscape is four draw calls whatever
the count, that is the entire cost.</div>

<h2><span class="n">3</span>The individual</h2>

<p>The prototype is identical for every pine on the coast. All the variety is
per-instance, from a <code>mulberry32</code> stream seeded on the 512&#160;m
tile coordinate &#8212; so the same tree is in the same place every time you
fly back over it.</p>

{code(INSTANCE, "src/45-trees.js:219")}

<div class="eqbox">{EQ_SIZE}</div>

<p>with <math><mi>&#958;</mi></math> a fresh uniform draw on
<math><mo stretchy="false">[</mo><mn>0</mn><mo>,</mo><mn>1</mn>
<mo stretchy="false">)</mo></math>, and
<math><mi>k</mi></math> the species' canopy aspect (1.9 for pine, 1.0 for
cypress). Note that <math><mi>w</mi></math> is proportional to
<em>this</em> tree's <math><mi>h</mi></math> rather than drawn independently:
a tall pine is a big pine, and you never get a spindly giant standing next to
a fat dwarf.</p>

<h3>Per frame</h3>

<p>Two more multipliers are applied when the visible set is repacked, roughly
twice a second and whenever the camera crosses a tile boundary:</p>

{code(REPACK, "src/45-trees.js:286")}

<div class="eqbox">{EQ_FADE}</div>

<p>Here <math><mi>d</mi></math> is distance to camera and
<math><mi>R</mi></math> the 2200&#160;m draw radius, so
<math><mi>u</mi></math> is how far you are into the outer fifth of it &#8212;
<math><mn>0</mn></math> at
<math><mn>0.80</mn><mo>&#8290;</mo><mi>R</mi></math>,
<math><mn>1</mn></math> at the edge. <code>sat</code> clamps it, and
<math><mi>f</mi></math> sinks the tree into the ground across that band. A
hard cutoff draws a visible ring of forest around the hillside and the eye
finds it instantly; a fade does not.</p>

<p>The second, <math><mi>s</mi></math>, is the fire reading.
<math><mi>c</mi></math> is the char value from the automaton at that
tree's position &#8212; the same grid the fire simulation burns &#8212; so a
tree standing in a burning cell shrinks 40&#160;% and its instance colour is
driven from green to a black stick. The flame itself is somebody else's
problem, drawn by <span class="src">38-flames.js</span>.</p>

<div class="foot">
  <span>Flamme Retard&#233; v{version()} &#183; <span class="src">src/45-trees.js</span>,
  <span class="src">src/30-material.js</span></span>
  <span>{total} triangles &#183; 4 draw calls &#183; 34&#8202;000 instances</span>
</div>
</div>
"""

    print("triangles: " + ", ".join(
        f"{s['key']}={tri_count(s)}" for s in SPECIES) + f", total={total}")

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>How a tree is drawn &#183; Flamme Retard&#233;</title>
<style>{CSS}</style>
</head><body>{body}</body></html>"""


def version() -> str:
    """The stamp from build.py, so the colophon cannot drift from the build."""
    m = re.search(r'^VERSION\s*=\s*"([^"]+)"',
                  (ROOT / "build.py").read_text(), re.M)
    return m.group(1) if m else "?"


def render(doc: str) -> None:
    chrome = next((c for c in CHROME if shutil.which(c)), None)
    if not chrome:
        sys.exit("error: need Chrome or Chromium on PATH to typeset the PDF\n"
                 "       (--html-only writes the page without rendering it)")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "doc.html"
        page.write_text(doc, encoding="utf-8")
        r = subprocess.run([
            chrome, "--headless", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--no-pdf-header-footer",
            f"--print-to-pdf={OUT}", page.as_uri(),
        ], capture_output=True, text=True)
    if r.returncode != 0 or not OUT.exists():
        sys.exit(f"error: {chrome} failed to print the PDF\n{r.stderr}")
    print(f"wrote {OUT} — {OUT.stat().st_size/1024:.0f} KB, via {chrome}")


def main() -> None:
    doc = build()
    if "--html-only" in sys.argv:
        out = OUT.with_suffix(".html")
        out.write_text(doc, encoding="utf-8")
        print(f"wrote {out} ({len(doc)/1024:.1f} KB)")
        return
    render(doc)


if __name__ == "__main__":
    main()
