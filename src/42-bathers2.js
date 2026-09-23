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
  const skinU = { value: null };
  const hairDye = { value: new THREE.Color(0.3, 0.2, 0.1) };
  const suitDye = { value: new THREE.Color(0.14, 0.3, 0.56) };
  // Each half's own mean luminance, so a dye lands on its colour whether the
  // map underneath is dark denim or a pale orange panel. Measured by the tex
  // tool on the quantised pixels rather than typed here.
  const L = (k, d) => (T && T.lum && T.lum[k + '_' + kind]) || d;
  const split = 1 / L('n', 2);
  const fig = skinnedFigure(data, {
    spec: 0.09, specPower: 24, vcol: false,
    uniforms: {
      uSkin: skinU,
      uEyeL: { value: eyes.l }, uEyeR: { value: eyes.r },
    },
    decl: 'uniform sampler2D uSkin;\nuniform vec3 uEyeL;\nuniform vec3 uEyeR;',
    body: `
      // Sampled before the branch and not inside it: a texture read in
      // divergent control flow has no derivatives, and the mip level is
      // chosen from them. The flagged corners sit outside [0, 1] and read
      // the clamped edge, which the branch then throws away.
      vec3 sk = texture2D(uSkin, vUv).rgb;
      if (vUv.x > 4.0) {
        base = vec3(0.80, 0.60, 0.58);
        spec = 0.22;
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
      } else {
        base = sk;
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
        },
        decl: 'uniform sampler2D uWear;\nuniform vec3 uHairDye;\n'
          + 'uniform vec3 uSuitDye;\nuniform vec2 uLum;\nuniform float uSplit;',
        body: 'vec4 tc = texture2D(uWear, vUv);\n'
          + 'if (tc.a < 0.5) discard;\n'
          + 'bool isHair = vUv.x < uSplit;\n'
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
  /**
   * Put this figure in somebody's clothes. Called by the crowd whenever the
   * person it is drawing changes (see `step` in 42-crowd.js), and once here
   * with nobody, so that a rider or a passenger — who is never anybody in
   * particular — still comes out dressed.
   */
  fig.dress = (fg) => {
    const p = bather2Pick(kind, fg);
    if (!p) return;
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
