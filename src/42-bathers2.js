// -----------------------------------------------------------------------------
// The Jadrija bathers, v2: a photographic skin, real hair, real swimwear.
//
// tools/blender/bathers_v2.py bakes the same eight bodies `bathers_mh.py` does,
// with the same skeletons and the same solved clips, but builds them the way
// Baye v2.0 is built — the base mesh's own UVs with a photograph on them, and a
// hairstyle and swimwear from the MakeHuman packs fitted to each body through
// its `.mhclo`. tools/bathers_v2_tex.py writes the textures and `bathers2.json`,
// which is what this file dresses them from.
//
// ── dressed per PERSON, not per body ───────────────────────────────────────
//
// There are forty-eight skinned figures and eight bodies between them. The v4
// blobs had their colours baked into their vertices, so every figure on body
// three was the same woman in the same red suit — and the note over
// `BATHER_PAINT` in 42-crowd.js is frank that the instanced tier had to be
// repainted to match, which cost the promotable half of the beach its palette.
//
// A textured figure can be told what to wear, so the direction of that copy
// turns round. Each person keeps the colours the beach dealt them — `fg.suit`,
// `fg.hair` — and the figure that draws them is dyed to match, and their skin
// is picked from a pool of real skins that is right for that body's age and
// sex, nearest in tone to the `fg.skin` they were dealt. `fg.skin` is then set
// to the chosen skin's own mean tone, so the instanced stand-in that draws
// them from fifty metres is the same colour as the figure that draws them from
// two. Nobody changes colour when you walk up to them, and the beach gets its
// variety back.
//
// ── eyes and mouth are in the body's draw ──────────────────────────────────
//
// On Baye they are parts with their own materials. Forty-eight figures times
// two is ninety-six draw calls for shapes a few millimetres across, so the bake
// folds them into the body and flags them in the UV: u in [2, 3) is an eyeball,
// u in [4, 5) is teeth and tongue. The branch below reads that.
// -----------------------------------------------------------------------------

/** Whether this build carries the v2 bathers at all. */
function bather2Table() {
  return (typeof PAYLOAD !== 'undefined' && PAYLOAD.bathers2) || null;
}

/** A payload texture, decoded once and shared by every figure that wears it. */
const BATHER2_TEX = new Map();
function bather2Tex(key) {
  if (BATHER2_TEX.has(key)) return BATHER2_TEX.get(key);
  const t = v5Tex(key);
  BATHER2_TEX.set(key, t);
  return t;
}

/**
 * The palettes a figure is dressed from when nobody has said who it is — a
 * rider, a passenger, a figure on its first frame. The crowd re-dresses every
 * figure as the person it is drawing the moment it draws them.
 */
const BATHER2_SUIT = [
  [0.780, 0.220, 0.240], [0.140, 0.300, 0.560], [0.930, 0.870, 0.300],
  [0.180, 0.480, 0.420], [0.850, 0.470, 0.620], [0.110, 0.160, 0.280],
];
const BATHER2_HAIR = [[0.120, 0.095, 0.080], [0.300, 0.200, 0.110],
  [0.560, 0.470, 0.360], [0.060, 0.050, 0.045]];
// Grey, for the two bodies the table marks `grey`: an old man with the dark
// brown of a twenty-year-old is a wig.
const BATHER2_GREY = [[0.62, 0.60, 0.57], [0.78, 0.77, 0.74], [0.47, 0.46, 0.44]];

/**
 * Who this person is, as a v2 figure: which skin, and what colour hair and
 * swimwear. Deterministic in `fg.seed` — RULE 4 in 42-crowd.js, no draw off
 * the shore's stream — and written back on to `fg` so the instanced tier
 * paints the stand-in the same.
 *
 * Mutates `fg.skin`, `fg.hair` and `fg.suit`, and that is the point of it.
 */
function bather2Pick(kind, fg) {
  const T = bather2Table();
  const spec = T && T.bathers[kind];
  if (!spec) return null;
  if (fg.b2 && fg.b2.kind === kind) return fg.b2;
  const seed = fg.seed || 0;
  const want = fg.skin || [0.76, 0.585, 0.45];
  // Nearest in tone, with the seed breaking a near tie: a pool of four where
  // the palette only ever lands on two of them is a pool of two.
  let best = null, bestD = 1e9;
  spec.skins.forEach((s, i) => {
    const t = T.tones[s];
    if (!t) return;
    const d = Math.hypot(t[0] - want[0], t[1] - want[1], t[2] - want[2])
      + 0.06 * crowdJit(seed * 997 + i, 71);
    if (d < bestD) { bestD = d; best = s; }
  });
  if (!best) best = spec.skins[0];
  let hair = fg.hair || BATHER2_HAIR[0];
  if (spec.grey) hair = BATHER2_GREY[Math.floor(crowdJit(seed * 991, 72) * 3) % 3];
  // NEVER WHITE. The beach palette carries a near-white suit, and on a v4
  // figure it was a flat colour with a mesh edge round it. On a textured one
  // it is a one-piece the colour of the skin under it, which at ten metres is
  // a person with nothing on — the thing the note over `SUITS` in
  // bathers_mh.py already learned once about a pale bikini. On a CHILD that
  // is not a colour question at all, so it is not left to the palette.
  let suit = fg.suit || BATHER2_SUIT[0];
  if (Math.min(suit[0], suit[1], suit[2]) > 0.72) {
    suit = BATHER2_SUIT[1 + Math.floor(crowdJit(seed * 983, 73) * 5) % 5];
  }
  fg.skin = T.tones[best] || want;
  fg.hair = hair;
  fg.suit = suit;
  fg.b2 = { kind, skin: best, hair, suit };
  return fg.b2;
}

/**
 * Where the eyes are in this blob's bind pose, measured once per blob.
 *
 * Off the vertices the bake flagged as eyeball (u in [2, 3)), split on the
 * figure's own z, which is across it — the export faces +x.
 */
function bather2Eyes(data) {
  if (data.eyes2) return data.eyes2;
  const pos = data.geo.getAttribute('position');
  const uv = data.geo.getAttribute('uv');
  const L = [0, 0, 0, 0], R = [0, 0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    if (u < 2 || u >= 3) continue;
    const a = pos.getZ(i) >= 0 ? L : R;
    a[0] += pos.getX(i); a[1] += pos.getY(i); a[2] += pos.getZ(i); a[3]++;
  }
  const c = (a) => (a[3] ? new THREE.Vector3(a[0] / a[3], a[1] / a[3], a[2] / a[3])
    : new THREE.Vector3(0, -99, 0));
  data.eyes2 = { l: c(L), r: c(R) };
  return data.eyes2;
}

/**
 * Where the mouth is in this blob's bind pose, measured once per blob: the
 * front of the teeth in x, and the height of the bite. Off the vertices the
 * bake flagged as teeth and tongue (u >= 4). The body shader below draws the
 * inside of a mouth off these — teeth at the front, tongue and throat
 * behind, darker the deeper — because until the jaw could open nothing ever
 * saw it, and at a full JawDrop one flat colour was a pink slab in the face.
 */
function bather2Mouth(data) {
  if (data.mouth2) return data.mouth2;
  const pos = data.geo.getAttribute('position');
  const uv = data.geo.getAttribute('uv');
  let xm = -1e9;
  for (let i = 0; i < pos.count; i++) if (uv.getX(i) >= 4) xm = Math.max(xm, pos.getX(i));
  let y = 0, n = 0;
  for (let i = 0; i < pos.count; i++) {
    if (uv.getX(i) >= 4 && pos.getX(i) > xm - 0.006) { y += pos.getY(i); n++; }
  }
  data.mouth2 = new THREE.Vector3(xm, n ? y / n : -99, 0);
  return data.mouth2;
}

/**
 * The thin parts, for the skin's back light (`SKIN_LIT` in 41-skin.js),
 * measured once per blob: the ear, as a centre (x, y, |z|) and a radius, off
 * the bind pose — the most lateral skin on the head between the eye and
 * 6 cm under it, behind the eyes — and the four finger and thumb bones.
 */
function bather2Thin(data) {
  if (data.thin2) return data.thin2;
  const pos = data.geo.getAttribute('position');
  const bi = data.geo.getAttribute('aBoneIdx');
  const bw = data.geo.getAttribute('aBoneWt');
  const B = (n) => data.bones.findIndex((b) => b.name === n);
  const head = B('head');
  const e = bather2Eyes(data);
  const ey = (e.l.y + e.r.y) / 2, ex = (e.l.x + e.r.x) / 2;
  const sc = bi.normalized ? 255 : 1;
  const cand = [];
  for (let i = 0; i < pos.count; i++) {
    if (Math.round(bi.getX(i) * sc) !== head || bw.getX(i) < 0.5) continue;
    const x = pos.getX(i), y = pos.getY(i);
    if (y > ey + 0.01 || y < ey - 0.06 || x > ex - 0.04 || x < ex - 0.16) continue;
    cand.push([x, y, Math.abs(pos.getZ(i))]);
  }
  let ear = [0, -99, 0, 0.001];
  if (cand.length > 8) {
    const zm = Math.max(...cand.map((c) => c[2]));
    const on = cand.filter((c) => c[2] > zm - 0.012);
    const m = [0, 1, 2].map((k) => on.reduce((a, c) => a + c[k], 0) / on.length);
    ear = [m[0], m[1], m[2] - 0.006, 0.032];
  }
  data.thin2 = { ear: new THREE.Vector4(...ear),
    fing: new THREE.Vector4(B('thumbL'), B('fingersL'), B('thumbR'), B('fingersR')) };
  return data.thin2;
}

/**
 * Where this blob's swimsuit top is, measured once per blob: `[tiles, hasTop,
 * cutY, backX]` for the `wear` shader's `uTopCut`.
 *
 * Misha, 29 Sep 2026: *"many of the women bathers have their tops either
 * fully off or partially off"*. Nothing new is drawn for it and no texture is
 * added. The body under the swimwear is whole — tools/blender/bathers_v2.py
 * does not cut it out under the garments the way baye2.py does with a
 * `.mhclo`'s `delete_verts` — so a top taken off is the top's fragments not
 * drawn, and what shows is the skin that was always there.
 *
 * WHICH fragments is the only question, and the bake answers it: the
 * swimwear is packed into the atlas one garment to a tile, hair first
 * (`garment(... u_band=True)`), so on a body with a separate top the top is
 * tile 1 exactly. The one-piece has no top to take off; it is rolled down
 * instead, which is everything of it above the waist — 42 per cent of the
 * way up the suit from the crotch to the straps, which on this body is the
 * line between the ribs and the hip. `backX` is half way between the back of
 * the top and the front of it, for a top UNDONE: the band and the back
 * straps gone and the cups left under her, which is what somebody lying on
 * her front with the clasp open looks like from anywhere you can see her.
 */
function bather2TopCut(data, kind) {
  if (data.topCut) return data.topCut;
  const T = bather2Table();
  const spec = T && T.bathers[kind];
  const n = (T && T.lum && T.lum['n_' + kind]) || 2;
  const hasTop = !!(spec && spec.top);
  const grp = (data.groups || []).find((g) => g.name === 'wear');
  const pos = data.geo.getAttribute('position');
  const uv = data.geo.getAttribute('uv');
  const idx = data.geo.getIndex();
  let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
  if (grp && uv && idx) {
    for (let k = grp.start; k < grp.start + grp.count; k++) {
      const v = idx.getX(k);
      const tile = Math.floor(uv.getX(v) * n);
      if (tile < 1) continue;                       // the hair
      if (hasTop && tile !== 1) continue;           // the bottoms
      const x = pos.getX(v), y = pos.getY(v);
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
    }
  }
  const ok = y1 > y0;
  data.topCut = [n, hasTop ? 1 : 0, ok ? y0 + (y1 - y0) * 0.42 : 1e3,
    ok ? (x0 + x1) * 0.5 : -1e3];
  return data.topCut;
}

/**
 * One v2 bather figure, on a parsed blob, with uniforms of its own.
 *
 * Fresh uniform objects per call and not a shared option set: forty-eight
 * figures reading one `{ value }` would all wear whatever the last one was
 * dressed in.
 */
function bather2Figure(data, kind) {
  const T = bather2Table();
  const spec = T && T.bathers[kind];
  const eyes = bather2Eyes(data);
  const mouth = bather2Mouth(data);
  const thin = bather2Thin(data);
  // How wet this person is, 0 to 1 — hosed, dunked, drying off. Written by
  // `bather2Face` below.
  const wetU = { value: 0 };
  const skinU = { value: null };
  // The top: 0 on, 1 off, 2 undone. See `bather2TopCut`, and `TOPS_KINDS`
  // in 42-crowd.js for who it can ever be anything but 0 on.
  const topU = { value: 0 };
  const cut = bather2TopCut(data, kind);
  const hairDye = { value: new THREE.Color(0.3, 0.2, 0.1) };
  const suitDye = { value: new THREE.Color(0.14, 0.3, 0.56) };
  // Each half's own mean luminance, so a dye lands on its colour whether the
  // map underneath is dark denim or a pale orange panel. Measured by the tex
  // tool on the quantised pixels rather than typed here.
  const L = (k, d) => (T && T.lum && T.lum[k + '_' + kind]) || d;
  const split = 1 / L('n', 2);
  // The face — see `bather2Face` below and tools/face_morphs.py. Per FIGURE
  // uniforms over a per-BODY texture: every figure on this body shares the
  // displacements and owns its own weights.
  const M = data.morphs || null;
  const mTex = M ? skinMorphTex(data) : null;
  const mU = M ? {
    uMorphTex: { value: mTex }, uMorphDim: { value: M.dim },
    uMorphOn: { value: 0 }, uMorphW: { value: new Float32Array(M.nt) },
  } : {};
  const fig = skinnedFigure(data, {
    spec: 0.09, specPower: 24, vcol: false,
    uniforms: {
      uSkin: skinU,
      uEyeL: { value: eyes.l }, uEyeR: { value: eyes.r },
      uMouth: { value: mouth },
      uEar: { value: thin.ear }, uThinB: { value: thin.fing },
      ...skinUniforms(wetU),
      ...mU,
    },
    vdecl: (M ? morphDecl(M.nt) : '') + '\nuniform vec4 uEar;\nuniform vec4 uThinB;\n',
    // vShut: how shut THIS side's lid is, for the eyeball under it (below).
    // The export faces +x, so z is across the face, and MakeHuman's left
    // (shutL) is the blob's negative z — see to_blob in tools/face_morphs.py.
    vert: (M ? morphVert(M.nt) + '  vShut = uMorphOn > 0.5 ? (position.z < 0.0 ? uMorphW['
      + M.names.indexOf('shutL') + '] : uMorphW[' + M.names.indexOf('shutR') + ']) : 0.0;\n'
      : '  vShut = 0.0;\n')
      // The thin parts, for the skin's back light: the fingers and thumbs by
      // bone, the ear by where it is in the bind pose (`bather2Thin`).
      + '  {\n'
      + '    float tb = floor(aBoneIdx.x * 255.0 + 0.5);\n'
      + '    vec4 td = abs(vec4(tb) - uThinB);\n'
      + '    float fing = min(min(td.x, td.y), min(td.z, td.w)) < 0.5 ? 0.8 : 0.0;\n'
      + '    vec3 eq = vec3(position.x, position.y, abs(position.z)) - uEar.xyz;\n'
      + '    vThin = max(fing, 1.0 - smoothstep(uEar.w * 0.45, uEar.w, length(eq)));\n'
      + '  }\n',
    decl: 'uniform sampler2D uSkin;\nuniform vec3 uEyeL;\nuniform vec3 uEyeR;\n'
      + 'uniform vec3 uMouth;\nvarying float vShut;' + SKIN_DECL,
    lit: SKIN_LIT,
    body: SKIN_PREP + `
      // Sampled before the branch and not inside it: a texture read in
      // divergent control flow has no derivatives, and the mip level is
      // chosen from them. The flagged corners sit outside [0, 1] and read
      // the clamped edge, which the branch then throws away.
      vec3 sk = texture2D(uSkin, vUv).rgb;
      if (vUv.x > 4.0) {
        // The inside of a mouth (bather2Mouth). Teeth across the front,
        // tongue and throat behind them, and all of it in the shade of the
        // lips: there is no occlusion in this renderer, so without the
        // darkening an open mouth faced into the sun lights up like a lamp.
        // No sky in it either — env 0 — which is what made it lavender.
        float dep = uMouth.x - vLocal.x;
        float bite = abs(vLocal.y - uMouth.y);
        float tooth = (1.0 - smoothstep(0.007, 0.011, dep))
          * (1.0 - smoothstep(0.010, 0.014, bite));
        // The teeth warmer and brighter than a tooth is, on purpose: the sun
        // never reaches them, so what lights them is the sky alone, and under
        // a blue sky an honest ivory comes out the grey-green of a gum shield.
        base = mix(vec3(0.42, 0.13, 0.13), vec3(0.92, 0.84, 0.70), tooth);
        base *= mix(1.0, 0.12, smoothstep(0.004, 0.035, dep));
        spec = 0.10 * tooth;
        env = 0.0;
      } else if (vUv.x > 2.0) {
        // The iris, drawn in bind space off the measured eye centre — the
        // same construction as v5Parts' eyes, whose thresholds are angles and
        // so hold on a child's eyeball as well as on Baye's.
        vec3 ec = distance(vLocal, uEyeL) < distance(vLocal, uEyeR) ? uEyeL : uEyeR;
        vec3 rd = normalize(vLocal - ec);
        float a = rd.x;
        base = vec3(0.86, 0.83, 0.79);
        float iris = smoothstep(0.918, 0.941, a);
        float pupil = smoothstep(0.9885, 0.9925, a);
        float limb = smoothstep(0.925, 0.937, a) * (1.0 - smoothstep(0.945, 0.960, a));
        base = mix(base, vec3(0.28, 0.24, 0.18), iris);
        base = mix(base, vec3(0.02), pupil);
        base *= 1.0 - 0.7 * limb;
        spec = 0.45;
        // A shut lid on a decimated face does not quite meet the lower one
        // everywhere, and what showed through the gap was white. Under a
        // closing lid the eyeball goes to the dark of a lash line, so a gap
        // reads as the lashes rather than as an eye left open a crack.
        float shut = smoothstep(0.55, 0.92, vShut);
        base = mix(base, vec3(0.045, 0.032, 0.028), shut);
        spec *= 1.0 - shut;
      } else {
        base = sk;
        // The T-zone, oily: the forehead over the brows and the length of the
        // nose, found off the eye centres in the bind pose so it lands on a
        // child's face as well as a man's.
        vec3 em = 0.5 * (uEyeL + uEyeR);
        float es = max(abs(uEyeL.z - uEyeR.z), 0.03);
        vec3 q = vLocal - em;
        float az = abs(q.z) / es;
        float fore = smoothstep(0.012, 0.028, q.y) * (1.0 - smoothstep(0.055, 0.08, q.y))
          * (1.0 - smoothstep(0.55, 0.9, az)) * smoothstep(-0.03, -0.005, q.x);
        float nose = (1.0 - smoothstep(0.18, 0.32, az)) * smoothstep(-0.06, -0.04, q.y)
          * (1.0 - smoothstep(0.0, 0.02, q.y)) * smoothstep(0.0, 0.012, q.x);
        skOil = max(fore, nose);
        ${SKIN_ON}
      }
    `,
    parts: {
      // HAIR AND SWIMWEAR ARE ONE PART. They are the same shader — double-
      // sided, alpha-cut, dyed — on two textures, and as two parts they cost
      // two draw calls a figure: ninety-six on the promenade, measured 336 to
      // 466. So they share one atlas, the hair in the first tile and the
      // swimwear after it, and the dye is chosen by which tile this fragment
      // is in. The dye keeps the map's luminance as SHADING and supplies the
      // colour itself, which is what dye does to hair and to cloth — see
      // `hairDye` in 41-skin.js for why multiplying a dark map by a colour
      // gives a dark result.
      wear: {
        color: 0xffffff, side: THREE.DoubleSide, spec: 0.10, specPower: 26,
        // Cloth and hair are not skin and must not take skin's lift — the
        // fishnet that came out silver taught that.
        emissive: 0.05,
        uniforms: {
          uWear: { value: bather2Tex('bwear_' + kind) },
          uHairDye: hairDye, uSuitDye: suitDye,
          uLum: { value: new THREE.Vector2(L('hair', 0.3), L('suit', 0.4)) },
          uSplit: { value: split },
          uTop: topU,
          uTopCut: { value: new THREE.Vector4(cut[0], cut[1], cut[2], cut[3]) },
        },
        decl: 'uniform sampler2D uWear;\nuniform vec3 uHairDye;\n'
          + 'uniform vec3 uSuitDye;\nuniform vec2 uLum;\nuniform float uSplit;\n'
          + 'uniform float uTop;\nuniform vec4 uTopCut;',
        body: 'vec4 tc = texture2D(uWear, vUv);\n'
          + 'if (tc.a < 0.5) discard;\n'
          + 'bool isHair = vUv.x < uSplit;\n'
          // The top, off or undone (`bather2TopCut`): its tile on a bikini,
          // everything over the waist on a one-piece; and undone is only the
          // half of it behind `backX`.
          + 'if (!isHair && uTop > 0.5) {\n'
          + '  float tile = floor(vUv.x * uTopCut.x);\n'
          + '  bool isTop = uTopCut.y > 0.5 ? (tile > 0.5 && tile < 1.5)'
          + ' : vLocal.y > uTopCut.z;\n'
          + '  if (isTop && (uTop < 1.5 || vLocal.x < uTopCut.w)) discard;\n'
          + '}\n'
          + 'float tl = dot(tc.rgb, vec3(0.299, 0.587, 0.114));\n'
          + 'float lm = isHair ? uLum.x : uLum.y;\n'
          + 'base = (isHair ? uHairDye : uSuitDye)'
          + ' * clamp(0.30 + 0.70 * tl / lm, 0.0, 1.8);\n'
          // A shade less gloss on hair than on cloth: on a dyed grey or a
          // short dark crop the extra sheen is what turned hair into a helmet.
          + 'if (isHair) spec = 0.08;',
      },
    },
  });
  fig.kind2 = kind;
  fig.wet = wetU;
  if (M) {
    fig.morph = { on: mU.uMorphOn, w: mU.uMorphW.value, names: M.names,
      at: Object.fromEntries(M.names.map((n, i) => [n, i])),
      cur: new Float32Array(M.nt), who: null };
  }
  /**
   * Put this figure in somebody's clothes. Called by the crowd whenever the
   * person it is drawing changes (see `step` in 42-crowd.js), and once here
   * with nobody, so that a rider or a passenger — who is never anybody in
   * particular — still comes out dressed.
   */
  fig.dress = (fg) => {
    const p = bather2Pick(kind, fg);
    if (!p) return;
    // By BODY, and never by what `fg` asks: see `TOPS_KINDS`.
    topU.value = TOPS_KINDS.has(kind) ? (fg.top | 0) : 0;
    skinU.value = bather2Tex('bskin_' + p.skin);
    hairDye.value.setRGB(p.hair[0], p.hair[1], p.hair[2]);
    suitDye.value.setRGB(p.suit[0], p.suit[1], p.suit[2]);
  };
  bather2Made = (bather2Made + 1) | 0;
  fig.dress({ seed: (bather2Made * 0.6180339) % 1,
    skin: spec && T.tones[spec.skins[bather2Made % spec.skins.length]],
    suit: BATHER2_SUIT[bather2Made % BATHER2_SUIT.length],
    hair: BATHER2_HAIR[bather2Made % BATHER2_HAIR.length] });
  return fig;
}
let bather2Made = 0;

// -----------------------------------------------------------------------------
// FACES. Misha, 30 Sep 2026, after a promo for a paid add-on whose people
// smile and squint: could ours be "even more human" — the expressions first.
//
// Until now the bathers had none. They did not blink, their mouths did not
// move when a line came out of them, and a woman hosed off a café chair took
// it with the face she had been reading her phone with.
//
// The shapes are not typed here. They are MakeHuman's own face rig — its
// CC0 pose units, LeftUpperLidClosed, JawDrop, MouthLeftPullUp and so on —
// baked on to each body as nine displacements of the head by
// tools/face_morphs.py, shipped in the fr3d (v12), and blended in the vertex
// shader in front of the skinning (`morphVert` in 41-skin.js), so a blink
// rides every clip a body has. What is written here is only WHEN:
//
//   blinking    always, on irregular intervals, now and then twice, the
//               two lids a hair apart
//   hosed       eyes screwed shut, a grimace, the mouth open — while the
//               water is on them and while they are a ragdoll; a scowl
//               once they are up and glaring, and while they swear
//   talking     the jaw and lips, off the voice's own level for a line from
//               the voice service, on a syllable envelope for everything else
//   chatting    a smile now and then between people talking, and a laugh
//   sun         screwed-up eyes sitting or standing in a bright sun, and
//               eyes shut lying on a towel under it
//
// A person's moods are on the PERSON (`fg.fx`, deadlines on the face clock)
// and what the face is showing is on the FIGURE (`f.morph.cur`), because a
// slot changes hands and the scowl belongs to whoever was hosed, not to the
// mesh that happened to be drawing them.
// -----------------------------------------------------------------------------

const FACE2 = {
  // Metres: past this nobody's face is updated and the shader skips it.
  near: 26,
  // Drying, s after the last water: soaked until the first, dry by the second.
  // A couple of minutes, which is an August afternoon on a Dalmatian beach.
  dry: [15, 150],
  // The blink, s. Closing is quicker than opening, which is what makes a
  // blink read as a blink rather than a wink played slowly. `gap` is the
  // shortest wait between them plus a skewed dice roll up to `spread`: most
  // gaps short, a few long, which is how people blink (2 to 10 s, mean ~4).
  blink: { shut: 0.07, hold: 0.03, open: 0.16, gap: 1.4, spread: 6.5, again: 0.16, lag: 0.014 },
  // How fast an expression goes on and comes off, 1/s. A flinch is fast; a
  // scowl fading is slow.
  on: 16, off: 4.5,
  // What each mood is made of, in the nine targets' own terms.
  // No lower lid in it: the upper one is already shut, and raising the lower
  // past it crossed the two into points. `smile` carries the cheeks up.
  // And `wide` no further than 0.45: pulled past about 0.8 the corners of a
  // child's mouth go back behind the ends of her teeth, which then show
  // through the cheek, and at 0.6 with the jaw down a young man's lower
  // incisors come through his lower lip.
  hose: { shutL: 1, shutR: 1, squint: 0.2, smile: 0.35, scowl: 0.85, wide: 0.45, jaw: 0.35 },
  scowl: { scowl: 0.95, wide: 0.12, squint: 0.25 },
  smile: { smile: 0.85, squint: 0.25 },
  laugh: { smile: 1.0, squint: 0.55, shutL: 0.25, shutR: 0.25, brows: 0.2 },
  // Speech: how far the jaw goes, resting and at the loudest syllable. MH's
  // JawDrop is a gape of about 25 mm; speech is a quarter of that.
  talk: [0.04, 0.30],
  // Sun, by what they are doing; scaled by how high it is.
  sun: { lie: { shutL: 0.92, shutR: 0.92, squint: 0.3 },
    sit: { squint: 0.55, scowl: 0.12, shutL: 0.12, shutR: 0.12 },
    stand: { squint: 0.35, scowl: 0.08 } },
};
let FACE2_T = 0;

/**
 * Ask a person's face for something, for `secs`: 'hose', 'scowl', 'talk',
 * 'smile' or 'laugh'. Safe on anybody, drawn or not, figure or no figure.
 */
function faceCue(fg, what, secs) {
  if (!fg) return;
  const F = fg.fx || (fg.fx = {});
  F[what] = Math.max(F[what] || 0, FACE2_T + secs);
}

/** The face clock, advanced once a frame by the crowd that draws them. */
function faceClock(dt) { FACE2_T += dt; }

const FACE2_WANT = new Float32Array(16);

/**
 * One bather's face, for one frame. `f` is the figure, `fg` the person it is
 * drawing, `d2` the camera's squared distance to them.
 */
function bather2Face(f, fg, dt, d2) {
  const m = f.morph;
  if (!m) return;
  const at = m.at, nt = m.cur.length;
  if (m.who !== fg) { m.who = fg; m.cur.fill(0); }
  // Wet: from the last water on them, drying over `FACE2.dry` s. Before the
  // distance cut — a soaked shine reads from further off than a blink does.
  {
    const F0 = fg.fx || (fg.fx = {});
    const X0 = fg.topple;
    if ((F0.hose || 0) > FACE2_T || fg.dunk
        || (X0 && (X0.phase === 'wet' || X0.phase === 'live'))) F0.wetAt = FACE2_T;
    if (f.wet) {
      f.wet.value = F0.wetAt == null ? 0
        : 1 - Math.min(1, Math.max(0, (FACE2_T - F0.wetAt - FACE2.dry[0]) / (FACE2.dry[1] - FACE2.dry[0])));
    }
  }
  if (d2 > FACE2.near * FACE2.near) {
    if (m.on.value) { m.on.value = 0; m.cur.fill(0); m.w.fill(0); }
    return;
  }
  const F = fg.fx || (fg.fx = {});
  const T = FACE2_T;
  const left = (k) => Math.max(0, (F[k] || 0) - T);
  const W = FACE2_WANT;
  W.fill(0);
  const lay = (mix, a) => {
    if (a <= 0) return;
    for (const k in mix) {
      const i = at[k];
      if (i !== undefined) W[i] = Math.max(W[i], mix[k] * a);
    }
  };

  // ── hosed ──
  const X = fg.topple;
  let hose = left('hose') > 0 ? 1 : 0;
  let scowl = left('scowl') > 0 ? 1 : 0;
  if (X) {
    if (X.phase === 'wet' || X.phase === 'live') hose = 1;
    else if (X.phase === 'up' || X.phase === 'reseat') { hose = Math.max(hose, 0.45); scowl = 1; }
    else if (X.phase === 'away' && X.away && X.away.phase === 'glare') scowl = 1;
  }
  if (fg.dunk) hose = Math.max(hose, 0.6);
  lay(FACE2.hose, hose);
  lay(FACE2.scowl, scowl * (1 - hose));

  // ── talking ──
  let talk = left('talk') > 0 ? 1 : 0;
  let lvl = -1;
  if (typeof voice !== 'undefined' && voice.saying && voice.saying() === 'bather'
      && voice.sayingPid && voice.sayingPid() === fg.idx) {
    talk = 1;
    lvl = typeof audio !== 'undefined' && audio.voiceLevel ? audio.voiceLevel() : 0;
  }
  if (talk) {
    F.talkT = (F.talkT || 0) + dt;
    F.talkPk = lvl >= 0 ? Math.max(F.talkPk || 0, lvl) : 0;
    const ph = F.talkT + (fg.seed || 0) * 7.1;
    // The meter where there is one and it reads anything; otherwise two beats
    // crossed, which is a jaw at speech rate rather than a flap on one sine.
    const env = lvl >= 0 && F.talkPk > 0.02 ? lvl
      : Math.max(0, 0.55 + 0.45 * Math.sin(ph * 16.3) * Math.sin(ph * 5.9));
    const [j0, j1] = FACE2.talk;
    W[at.jaw] = Math.max(W[at.jaw], j0 + (j1 - j0) * env);
    // Vowels: the lips spread and pushed, slowly and out of step with the jaw.
    const v = Math.sin(ph * 3.7 + Math.sin(ph * 1.3) * 2.0);
    W[at.wide] = Math.max(W[at.wide], 0.35 * Math.max(0, v) * env);
    W[at.kiss] = Math.max(W[at.kiss], 0.55 * Math.max(0, -v) * env);
  } else { F.talkT = 0; F.talkPk = 0; }

  // ── chatting ──
  if (!hose && !scowl) {
    const lg = left('laugh');
    if (lg > 0) {
      lay(FACE2.laugh, 1);
      // Laughing is the jaw going on its own, a few times a second.
      W[at.jaw] = Math.max(W[at.jaw], 0.18 + 0.16 * Math.abs(Math.sin(T * 9.5 + (fg.seed || 0) * 3)));
    } else if (left('smile') > 0) lay(FACE2.smile, 1);
  }

  // ── the sun ──
  //
  // Not under a roof: every terrace seat on this shore is under its shop's
  // awning (`shopKit` seats only frontages that have one), so a café sitter
  // is in the shade whatever the hour. Anybody else upright screws their eyes
  // up by how much they are FACING it — the figure's +x is (cos yaw, −sin yaw)
  // in the world — and somebody on their back on a towel has it full in the
  // face and just shuts them.
  const covered = fg.sitAt && fg.sitAt.shop;
  if (!hose && !covered && typeof U !== 'undefined' && U.uSunDir) {
    const sd = U.uSunDir.value;
    let s = Math.min(1, Math.max(0, (sd.y - 0.12) / 0.45))
      * (1 - Math.min(1, U.uNight ? U.uNight.value : 0));
    const mode = fg.mode === 'lie' ? 'lie' : fg.mode === 'sit' ? 'sit' : 'stand';
    if (mode !== 'lie') {
      const h = Math.hypot(sd.x, sd.z) || 1;
      const toward = (Math.cos(fg.yaw || 0) * sd.x - Math.sin(fg.yaw || 0) * sd.z) / h;
      s *= 0.3 + 0.7 * Math.max(0, toward);
    }
    // Face down on the mole there is no sun in anybody's eyes.
    if (s > 0 && !(mode === 'lie' && fg.prone)) lay(FACE2.sun[mode], s);
  }

  // ── on and off, and then the blink over the top ──
  const kOn = 1 - Math.exp(-FACE2.on * dt), kOff = 1 - Math.exp(-FACE2.off * dt);
  for (let i = 0; i < nt; i++) {
    const c = m.cur[i];
    m.cur[i] = c + (W[i] - c) * (W[i] > c ? kOn : kOff);
  }
  const B = FACE2.blink;
  const bk = F.bk || (F.bk = { next: FACE2_T + crowdJit((fg.seed || 0) * 131, 17) * 3, n: 0 });
  if (T >= bk.next + B.shut + B.hold + B.open + B.lag) {
    bk.n++;
    const r = crowdJit((fg.seed || 0) * 977 + bk.n, 29);
    bk.next = T + (r < B.again ? 0.12
      : B.gap + B.spread * Math.pow(crowdJit((fg.seed || 0) * 353 + bk.n, 31), 1.8));
  }
  const lid = (u) => (u < 0 ? 0 : u < B.shut ? u / B.shut
    : u < B.shut + B.hold ? 1 : u < B.shut + B.hold + B.open
      ? 1 - (u - B.shut - B.hold) / B.open : 0);
  const u = T - bk.next;
  const bL = lid(u), bR = lid(u - B.lag);
  let any = false;
  for (let i = 0; i < nt; i++) {
    let v = m.cur[i];
    if (i === at.shutL) v = v + (1 - v) * bL;
    else if (i === at.shutR) v = v + (1 - v) * bR;
    m.w[i] = v;
  }
  // The lower lid gives way to a shutting upper one. Displacements add, and
  // a lower lid raised to meet an upper lid that is already coming down past
  // it crosses the two into points — so the squint comes off as the lids
  // close, and a blink in the middle of a squint is still a blink.
  const sh = Math.max(m.w[at.shutL], m.w[at.shutR]);
  m.w[at.squint] *= 1 - 0.85 * sh * sh;
  for (let i = 0; i < nt; i++) if (m.w[i] > 0.002) any = true;
  m.on.value = any ? 1 : 0;
}
