// -----------------------------------------------------------------------------
// The ice cream, in your hand.
//
// Misha, 17 Sep 2026: *"i want her to bring back tha tyummy ice-cream and
// let's enjoy slupring it ya know"*, after sending shore Baye up to the
// slastičarnica for a stracciatella and getting her back empty handed. She
// fetches it in src/43-jadrija.js and hands it over by calling `giveCream`;
// everything from the hand-over on is in here.
//
// A CONE AND NO ARM, for the reason 61-beer.js gives at length and will not be
// repeated here: the only first-person limb rig in this game is 60-arms.js,
// three rigid pieces a side authored for a front crawl, and nothing in it
// holds anything. What you see when you eat an ice cream is the ICE CREAM. It
// comes up from the bottom of the frame, the scoop tips toward your face, and
// it goes back down. The hand is where a hand is in every photograph of
// somebody eating one — out of shot, behind the cone.
//
// ITS OWN PASS, same as the beer and same as the arms. The world's near plane
// is 1.2 m; this is 0.45 m from your eye, which is inside it. So there is a
// scene and a camera of its own with a 2 cm near, the world camera's fov and
// aspect copied every frame, and the whole thing composited over the finished
// frame with the depth cleared. See `creamRender`, called from the render
// chain in src/90-app.js immediately after `beerRender`.
//
// THE ROOT RIDES THE CAMERA, same as the beer, and for the same reason it
// spells out: every material in this game runs `applyWater` and `applyHaze` on
// the fragment's WORLD position, so an object living at its own scene's origin
// is an object at y = 0, which at Jadrija is under the sea. The cone hangs off
// `root`, which is put at the camera's world position and orientation every
// frame, and only then is it offset into view space.
//
// AND IT MELTS, which is the one thing the beer does not do and the reason
// this file is not a copy of it. A bottle of beer is the same object for as
// long as you hold it. An ice cream is on a clock from the moment it leaves
// the case, and on 6 August on this shore that clock is short. See `MELT`.
// -----------------------------------------------------------------------------

/**
 * What the sixteen pans in the Slastičarnica's case are, as colour.
 *
 * Every row is lifted from `GELATO` in src/43-jadrija.js, which read them off
 * six photographs of the counter taken on 22 August 2026 — the same numbers,
 * because the whole point is that what is in your hand is what was in the
 * case. They are copied rather than shared because `GELATO` lives inside that
 * file's closure and is not reachable from here; if those measurements are ever
 * corrected, correct them in both places.
 *
 *   `col`  the body of the ice cream
 *   `rib`  the dark through it, where there is any — null where the pan is one
 *          colour, which is what vanilla, pistachio, mango, green apple,
 *          watermelon and strawberry actually are in those frames
 *   `chip` how much of the surface that dark is, 0 to 1. Stracciatella is the
 *          top of the scale on purpose: it is not a swirl, it is shards of
 *          hard chocolate cracked through the mix, and it is the flavour he
 *          asked for. Čokolada's own ribbon is a darker fold in a brown pan
 *          and reads at a third of that.
 *
 * Keys are normalised — lower case, diacritics stripped, whitespace collapsed
 * — so that `Čokolada`, `čokolada` and `cokolada` are one flavour. The English
 * and Italian aliases are there because what arrives here came out of a
 * conversation and somebody who asks her for a chocolate one should get one.
 * Nothing in this table is ever drawn or displayed: no name goes on the cone,
 * on a wrapper or in a toast. Rule 12.
 */
const CREAM_FLAVOURS = {
  cokolada: { col: [0.545, 0.455, 0.365], rib: [0.175, 0.110, 0.075], chip: 0.34 },
  vanilija: { col: [0.790, 0.660, 0.235], rib: null, chip: 0 },
  stracciatella: { col: [0.845, 0.830, 0.795], rib: [0.140, 0.105, 0.085], chip: 1.00 },
  'jogurt sumsko voce': { col: [0.830, 0.800, 0.775], rib: [0.500, 0.140, 0.175], chip: 0.52 },
  pistaccio: { col: [0.660, 0.650, 0.340], rib: null, chip: 0 },
  'kinder bueno': { col: [0.815, 0.745, 0.640], rib: [0.530, 0.360, 0.210], chip: 0.46 },
  ljesnjak: { col: [0.755, 0.660, 0.530], rib: null, chip: 0 },
  lubenica: { col: [0.860, 0.490, 0.445], rib: null, chip: 0 },
  mango: { col: [0.835, 0.755, 0.340], rib: null, chip: 0 },
  'zelena jabuka': { col: [0.490, 0.680, 0.310], rib: null, chip: 0 },
  raffaello: { col: [0.830, 0.775, 0.680], rib: [0.490, 0.330, 0.180], chip: 0.40 },
  cookies: { col: [0.810, 0.745, 0.640], rib: [0.180, 0.125, 0.095], chip: 0.72 },
  jagoda: { col: [0.795, 0.310, 0.275], rib: null, chip: 0 },
};

/**
 * The same thirteen pans under the words somebody might actually say.
 *
 * Kept apart from the table above so that the measured rows stay a list of
 * what is in the case and nothing else. The value is a key into it.
 */
const CREAM_ALIAS = {
  chocolate: 'cokolada', cioccolato: 'cokolada', choc: 'cokolada',
  vanilla: 'vanilija', vaniglia: 'vanilija',
  strac: 'stracciatella', straciatella: 'stracciatella',
  stracciatela: 'stracciatella',
  yoghurt: 'jogurt sumsko voce', yogurt: 'jogurt sumsko voce',
  'forest fruit': 'jogurt sumsko voce',
  pistachio: 'pistaccio', pistacchio: 'pistaccio', pistache: 'pistaccio',
  bueno: 'kinder bueno', kinder: 'kinder bueno',
  hazelnut: 'ljesnjak', nocciola: 'ljesnjak', noisette: 'ljesnjak',
  watermelon: 'lubenica', pasteque: 'lubenica',
  'green apple': 'zelena jabuka', apple: 'zelena jabuka',
  jabuka: 'zelena jabuka',
  coconut: 'raffaello', kokos: 'raffaello',
  cookie: 'cookies', biscuit: 'cookies',
  strawberry: 'jagoda', fraise: 'jagoda', fragola: 'jagoda',
};

/**
 * And what you get when the word is one nobody here knows.
 *
 * The pale cream pan at the right-hand end of the front row, whose plaque is
 * turned away in every frame of the survey and which ships unnamed for that
 * reason. It is the exactly right fallback: an ice cream we cannot put a name
 * to already exists in that case, and it is this one.
 */
const CREAM_UNKNOWN = { col: [0.830, 0.800, 0.735], rib: null, chip: 0 };

const CREAM = {
  /**
   * Where the cone rides when it is just being carried: right, and LOW.
   *
   * Measured off the picture the way BEER.rest was, and the number that was
   * measured is where THE SCOOPS land — not where the group's origin is, which
   * is the cone's tip and is three rotations away from anything you can see.
   * That distinction cost the first two passes at this: every attempt to move
   * the ice cream in the frame moved the tip instead, and the tilt and the
   * cant then put the scoops somewhere else.
   *
   * At z −0.46 with this lens the frame is 0.493 m tall and 0.878 m wide, so
   * a scoop centred at (0.228, −0.128) sits 52% of the way right and 52% of
   * the way down — which is within a few per cent of where the beer's label
   * sits, and is deliberately so: two things held in the same hand should be
   * held in the same place. The cone's tip is then at y −0.271, 24 mm below
   * the bottom edge of the view, so the hand holding it is out of shot the way
   * it is in every photograph of somebody carrying one.
   */
  rest: [0.192, -0.271, -0.460],
  /**
   * And where it goes for a lick: up, in and across.
   *
   * Solved for rather than guessed at, by the same arithmetic — the scoops
   * want to sit at (0.087, −0.061, −0.220), which at that distance is 40% of
   * the way right and 50% down, with the whole ice cream about 260 px across
   * at 720p. That is an ice cream at your face and not a diagram of one.
   *
   * Two wrong answers before this one, and the same mistake both times: the
   * half-frame at a distance d is d·tan(fov/2) = 0.554·d, and it was taken
   * off the WRONG d twice. The first cut put every part of the cone below the
   * bottom edge and the mid-lick screenshot was an empty promenade; the
   * second had it in shot and jammed into the corner at 58% and 78%. The
   * measurement is worth doing on paper and it is worth then looking at the
   * screenshot, because the paper does not know about the rotations.
   */
  sip: [0.045, -0.175, -0.300],
  /** Radians the cone tips toward you, carried and at the mouth. */
  tiltRest: 0.12,
  tiltSip: 0.62,
  /** And canted across the view, always — an ice cream is never held plumb. */
  cantRest: -0.22,
  cantSip: -0.28,
  /**
   * Seconds: coming up, the lick itself, and going back down.
   *
   * 0.96 s all in, against the beer's 1.64 s, because a lick is a quicker
   * thing than a swig — the cone travels half as far and there is no swallow
   * at the end of it. The bite lands during `hold`, which is the window in
   * which the scoop is at your mouth and mostly out of frame: geometry that
   * changes shape does it there and not where you are looking at it.
   */
  up: 0.30,
  hold: 0.30,
  down: 0.36,
  /**
   * Licks to the whole thing — four a scoop, two scoops.
   *
   * Four is what a scoop takes here for the same reason the beer takes four
   * swigs: it is the smallest number that still reads as the same ice cream
   * you were handed a minute ago. Eight licks is about ten seconds of licking,
   * which against the melt clock below leaves plenty of room to eat it and
   * none at all to forget about it.
   */
  licks: 4,
  scoops: 2,

  /** Metres. A moulded gelato cone is 112 mm tall and 57 mm across the mouth. */
  h: 0.1120,
  r: 0.0285,
  /** The wafer, before the waffle lattice in the shader darkens it. */
  wafer: [0.780, 0.640, 0.410],

  /** The bottom scoop, which is the bigger of the two and overhangs the rim. */
  radA: 0.0305,
  hgtA: 0.0360,
  /**
   * And the top one, a shade smaller, set off centre and LEANING.
   *
   * The lean is 0.14 rad and it is the cheapest thing in this file. Two domes
   * on one axis are a snowman; the same two domes with the upper one tipped
   * eight degrees off are two scoops that were put on one at a time with a
   * spatula, which is what they are.
   */
  radB: 0.0272,
  hgtB: 0.0320,
  offB: [0.0035, -0.0025],
  leanB: 0.14,

  /** Segments round a scoop. 18 is enough at 0.45 m and the mesh is reshaped. */
  seg: 18,
  /**
   * How deep the folds are, as a fraction of the scoop's radius.
   *
   * A scoop off a gelato spatula is not a ball. It is a fold — three or four
   * lobes round it, deepest at the skirt where it was pressed onto the cone
   * and gone by the crown. That is what this is, and it is two cosines at
   * hash-chosen phases rather than per-vertex noise on purpose: white noise on
   * a 162-vertex dome is television static, and a regular lattice is worse
   * than nothing. Lobes are what the object actually has.
   *
   * 0.125, and the first pass had it at 0.075 — 2.3 mm on a 30 mm radius,
   * which at the distance this is held reads as absolutely nothing. Two balls
   * on a cone was the whole of the complaint about the first screenshot and
   * this number is most of the answer to it.
   */
  lobe: 0.125,
  /**
   * Which way the lick takes it off, in the cone's own frame.
   *
   * Up and toward you — local +z points back at your eye, because the group is
   * offset down the view axis and never yawed. A lick is a plane, and every
   * vertex past it is pushed back onto it, which is exactly the flat facet a
   * licked scoop carries. Nothing else about a half-eaten ice cream reads as
   * eaten rather than merely smaller.
   */
  biteN: [0, 0.419, 0.908],

  /** How far a run of melted cream gets down the cone, at full reach. */
  dripLen: 0.060,
};

/**
 * The melt clock.
 *
 * Picked off the real thing rather than tuned until it felt right, and the
 * reasoning is worth writing down because it is the whole of this file's claim
 * to not being the beer.
 *
 * Gelato is served at −11 to −13 °C, not the −18 °C of hard ice cream — that
 * is the definition of the stuff, and it is why a scoop out of an Italian case
 * is soft enough to fold and why it has minutes rather than a quarter of an
 * hour once it is out. Šibenik on 6 August is 31 to 33 °C in the shade, and
 * the promenade at Jadrija is white concrete radiating back at you.
 *
 * The heat balance on a 60 g scoop says forty minutes to melt it *through*:
 * about 12 kJ of latent heat against roughly 5 W of solar and convective load
 * over 60 cm² of surface. But nothing about eating an ice cream waits for the
 * core. What runs is the first millimetre, and everybody who has carried one
 * along a riva in August knows those numbers without doing the arithmetic:
 * it starts to go at the rim inside a minute, there is cream on your hand
 * shortly after, and by five minutes you are holding a wet cone.
 *
 * So: `full` 240 s, four minutes, at the top of the day. The first run appears
 * at `dripAt` — 0.18 of that, 43 s — which is the number a player will
 * actually meet, because 43 seconds is how long it takes to walk somewhere
 * with it. Four minutes is dawdling, and dawdling is what this is here to
 * punish.
 *
 * `shade` is the floor on the rate. `sunAngles` puts the local solar maximum
 * at 64.5°, and the rate scales with elevation off that — but not to zero,
 * because 32 °C air melts an ice cream in the shade too and a clock that
 * stopped under an awning would be a clock about the sun rather than about
 * the heat.
 */
const MELT = {
  full: 240,
  dripAt: 0.18,
  shade: 0.25,
  peakElev: 64.5,
  /**
   * And what a lick takes back off the clock.
   *
   * You do not lick the middle of an ice cream that is running, you lick the
   * side that is running — which is the same gesture and is why nobody thinks
   * of it as two different things. 0.05 is a fifth of the way back to dry per
   * lick, so eating it steadily keeps it ahead of the sun and putting it in
   * your pocket for a minute does not.
   */
  lickBack: 0.05,
};

/**
 * The scoop profile, normalised: radius in units of `rad`, height of `hgt`.
 *
 * Not a hemisphere. The widest part is below the middle, the crown is flat —
 * a spatula presses the top of a scoop down as it lifts it — and the skirt
 * drops a quarter of the height below the widest ring and comes back in,
 * which is the drape over whatever it is sitting on. A sphere has none of
 * those three things and reads as a ball on a triangle.
 */
const SCOOP_PROF = [
  // The skirt, drooping down over what it is sitting on.
  [0.88, -0.24],
  [1.00, -0.04],
  [1.00, 0.16],
  [0.97, 0.36],
  [0.90, 0.54],
  [0.79, 0.70],
  [0.62, 0.84],
  [0.36, 0.95],
  [0.00, 1.00],
];

/**
 * A run of melted cream, as a lathe profile: radius against y, with y running
 * from −1 at the leading bead up to 0 at the rim it came over.
 *
 * Downward and not upward so that the length can be a positive y scale. A
 * negative scale flips the winding and a drip with its normals inside out is a
 * black worm down the side of the cone.
 */
const DRIP_PROF = [
  [0.0000, -1.000],
  [0.0016, -0.962],
  [0.0021, -0.916],
  [0.0017, -0.860],
  [0.0011, -0.740],
  [0.0009, -0.430],
  [0.0011, 0.000],
];

/** The waffle on the wafer, and the sog once it has started to run. */
const WAFER_BODY = /* glsl */ `
  // A moulded cone carries a diamond lattice that converges toward the tip,
  // because the tip is where the circumference goes. So: an integer count
  // round — 36, which puts a cell at 5 mm at the mouth — so the pattern closes
  // across the seam, and a count along taken off vLocal.y in metres, which for
  // this mesh never changes and so cannot swim.
  float wu = vUv.x * 36.0;
  float wv = vLocal.y * 190.0;
  float wa = fract(wu + wv), wb = fract(wu - wv);
  float wline = min(min(wa, 1.0 - wa), min(wb, 1.0 - wb));
  base *= mix(0.68, 1.05, smoothstep(0.0, 0.14, wline));
  // And soggy from the rim down once it has started to run. Top down and not
  // bottom up: what soaks a cone is what came over the edge of it.
  float wet = uMelt * smoothstep(0.045, 0.112, vLocal.y);
  base = mix(base, base * 0.60, wet);
  spec += 0.30 * wet;
`;

/**
 * The chocolate in the scoop.
 *
 * Shards at jittered positions in a wrapped cell grid, which is a worley
 * lookup with a box metric instead of a distance — because stracciatella is
 * not dots, it is a bar of chocolate cracked into a running machine, and every
 * piece is a flat angular splinter. The cell index wraps in u so the field
 * closes round the scoop with no seam, and the scoop's uv is written once at
 * build time and never touched again by the reshaping below, so the chips stay
 * where they are while the ice cream shrinks under them.
 *
 * `uDens` is what fraction of cells carry a chip at all. Below 1 it is the
 * absence that makes it read as irregular rather than as a grid.
 */
const CREAM_BODY = /* glsl */ `
  // Almost no sky in it. Every surface in this game picks up a mirror of the
  // sky at 0.35 of its spec, and on something this pale that is the difference
  // between cream and a pale blue bath toy — the first screenshot of this was
  // a scoop of sky. env is the dial for exactly that (see the note over it in
  // 30-material.js), held apart from the sun highlight, which gelato does
  // have: it is wet. NO BACKTICKS IN HERE — one in this very comment ended the
  // template and broke the build, which is the third time on this project.
  env = 0.03;
  // AND IT IS TRANSLUCENT, which is the other half of the same complaint.
  //
  // The pan colours in CREAM_FLAVOURS were read off a chilled case under its
  // own lighting, and they are neutral. This sky is not: the hemispheric
  // ambient here is (0.41, 0.55, 0.73), so anything near white comes out about
  // 7% bluer in the blue channel than in the red — which on concrete is
  // nothing and on a scoop of stracciatella is a pale blue bath toy. It was,
  // in the first screenshot of this.
  //
  // The fix is not to warm the measured colour. It is that gelato is an
  // emulsion of fat, sugar and ice and light goes two or three millimetres
  // into it before it comes back, which is exactly why a white scoop in the
  // sun looks like cream and a white plastic ball in the same sun does not.
  // So: warmed, and warmed MORE on the side facing away from the sun, because
  // that is the side you are seeing light through rather than off.
  float thru = 1.0 - max(dot(n, uSunDir), 0.0);
  base *= mix(vec3(1.045, 1.000, 0.945), vec3(1.100, 1.000, 0.855), thru);
  float chip = 0.0;
  if (uChip > 0.001) {
    vec2 q = vUv * vec2(9.0, 5.0);
    vec2 ci = floor(q), cf = fract(q);
    float best = 4.0;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 o = vec2(float(dx), float(dy));
        vec2 cw = vec2(mod(ci.x + o.x, 9.0), ci.y + o.y);
        float hp = h21(cw + 0.5);
        if (hp > max(uDens, 0.001)) continue;
        float hx = h21(cw + vec2(17.3, 5.1));
        float hy = h21(cw + vec2(3.7, 11.9));
        vec2 d = cf - (o + vec2(0.18 + 0.64 * hx, 0.18 + 0.64 * hy));
        vec2 ax = normalize(vec2(hx - 0.5, hy - 0.5) + vec2(0.003, 0.001));
        vec2 rd = vec2(dot(d, ax), dot(d, vec2(-ax.y, ax.x)));
        vec2 hs = vec2(0.085 + 0.130 * hx, 0.038 + 0.062 * hy);
        best = min(best, max(abs(rd.x) / hs.x, abs(rd.y) / hs.y));
      }
    }
    chip = (1.0 - smoothstep(0.80, 1.00, best)) * uChip;
  }
  base = mix(base, uRib, chip);
  // Melting gelato goes wet before it goes anywhere, and a chip of chocolate
  // is the one part of it that was always shiny.
  spec += 0.30 * uMelt + 0.20 * chip;
`;

const CREAM_DECL = /* glsl */ `
uniform vec3 uRib;
uniform float uChip;
uniform float uDens;
uniform float uMelt;
`;

/** Just the melt, for the wafer and for the run down the side of it. */
const MELT_DECL = /* glsl */ `
uniform float uMelt;
`;

/**
 * A scoop's mesh: fixed topology, fixed uv, positions written every time the
 * shape changes.
 *
 * One buffer reshaped rather than a geometry rebuilt, because the shape changes
 * for two independent reasons — it is being eaten and it is melting — and both
 * are continuous. 18 by 9 is 162 vertices, so `computeVertexNormals` on it is
 * nothing; what would not be nothing is allocating a geometry a frame, which
 * is why `creamTick` only reshapes when the shape has actually moved.
 *
 * The apex ring is S vertices at the same point, which is what LatheGeometry
 * does too: a few degenerate triangles at the crown against a special case in
 * the index buffer and in every loop that walks it.
 */
function scoopGeometry() {
  const S = CREAM.seg, R = SCOOP_PROF.length;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(R * S * 3), 3));
  const uv = new Float32Array(R * S * 2);
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < S; j++) {
      uv[(i * S + j) * 2] = j / S;
      uv[(i * S + j) * 2 + 1] = i / (R - 1);
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * S + j, b = i * S + (j + 1) % S;
      const c = (i + 1) * S + (j + 1) % S, d = (i + 1) * S + j;
      idx.push(a, b, c, a, c, d);
    }
  }
  geo.setIndex(idx);
  return geo;
}

/**
 * Write one scoop's vertices for a given amount eaten and melted.
 *
 * @param eaten 0 to 1 — how much of this scoop has gone down your throat
 * @param melt  0 to 1 — how far the whole ice cream has run
 * @param seed  which scoop, so the two carry different folds
 * @param bite  whether the lick plane applies. It does not to the bottom scoop
 *              while the top one is still standing on it: you cannot get your
 *              mouth to a scoop with another scoop in the way, and a facet
 *              cut into something that is covered is a facet nobody sees and
 *              a silhouette that is wrong the moment it is uncovered.
 */
function shapeScoop(geo, rad, hgt, eaten, melt, seed, bite) {
  const S = CREAM.seg, R = SCOOP_PROF.length;
  const pos = geo.attributes.position.array;
  // Deterministic, out of the core hash and not out of rng(): everything that
  // runs in the Jadrija build has to come out the same twice. See 00-core.js.
  const p1 = hash2(seed, 11, 0x5c0091) * TAU;
  const p2 = hash2(seed, 23, 0x5c0091) * TAU;
  // Melting smooths the folds out — that is most of what "soft-edged" means
  // once it has been in the sun for a minute.
  const amp = CREAM.lobe * (1 - 0.72 * melt);
  const BN = CREAM.biteN;
  // The plane's distance from the scoop's own centre, in units of its radius.
  // 1.18 is clear of the mesh, so eaten = 0 cuts nothing.
  const bd = rad * (1.18 - 1.32 * eaten);
  const cy = 0.45 * hgt;
  for (let i = 0; i < R; i++) {
    const pr0 = SCOOP_PROF[i][0], ph0 = SCOOP_PROF[i][1];
    for (let j = 0; j < S; j++) {
      const th = j * TAU / S;
      // Deepest at the skirt, gone by the crown, and drifting a little ring to
      // ring so the lobes spiral the way a spatula leaves them.
      const fold = (1 - ph0) * amp
        * (Math.cos(3 * th + p1 + 0.38 * i) * 0.62
          + Math.cos(5 * th + p2 - 0.24 * i) * 0.38);
      const r = (pr0 + fold) * (1 + 0.12 * melt);
      // It slumps as it goes: the crown drops, the skirt spreads and sags.
      const ph = ph0 * (1 - 0.52 * melt) - 0.34 * melt * (1 - ph0);
      let px = Math.sin(th) * r * rad;
      let pz = Math.cos(th) * r * rad;
      let py = ph * hgt;
      if (bite && eaten > 0) {
        const t = BN[1] * (py - cy) + BN[2] * pz;
        if (t > bd) { py -= BN[1] * (t - bd); pz -= BN[2] * (t - bd); }
      }
      const o = (i * S + j) * 3;
      pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

function buildCream() {
  const stage = new THREE.Scene();
  // 2 cm of near, the world camera's lens copied in every frame. See the note
  // at the top, and `beerRender`, which this is.
  const cam = new THREE.PerspectiveCamera(58, 1.78, 0.02, 4);
  const root = new THREE.Group();
  const g = new THREE.Group();
  const C = CREAM;

  // One melt number, shared by reference across all four materials, so that
  // the scoop, the wafer, the runs and the pool in the bottom of the cone are
  // never a frame out of step with each other.
  const uMelt = { value: 0 };
  const wafer = solidMaterial(new THREE.Color(...C.wafer), {
    spec: 0.10, specPower: 24, vcol: false,
    decl: MELT_DECL, body: WAFER_BODY, uniforms: { uMelt },
  });
  const scoop = solidMaterial(new THREE.Color(...CREAM_UNKNOWN.col), {
    // Nearly matt, because gelato nearly is — there is a sheen on it out of
    // the case and it is a wide one, hence the low power. The rest of the
    // gloss arrives with the melt and with the chocolate, both of which the
    // fragment body adds.
    spec: 0.20, specPower: 22, vcol: false,
    decl: CREAM_DECL, body: CREAM_BODY,
    uniforms: {
      uRib: { value: new THREE.Color(0.14, 0.105, 0.085) },
      uChip: { value: 0 }, uDens: { value: 0.42 }, uMelt,
    },
  });
  // The runs and the pool get no chips. They are five millimetres across and a
  // chip field at the scoop's cell scale would put one shard across the whole
  // of a drip, which reads as a stripe. Wet and plain is what a run is.
  const run = solidMaterial(new THREE.Color(...CREAM_UNKNOWN.col), {
    spec: 0.46, specPower: 64, vcol: false,
    decl: MELT_DECL, body: 'spec += 0.20 * uMelt;', uniforms: { uMelt },
  });

  // ── the wafer ──────────────────────────────────────────────────────────
  //
  // Tip at the origin and the mouth at `h`, so vLocal.y is height up the cone
  // and the waffle can be measured in metres off it. The profile goes up the
  // outside to a small lip, back down the inside and closes on a shallow floor
  // — not because you can see into a cone with two scoops on it, but because
  // once it has all run you are holding an open one, and an unclosed mouth is
  // a see-through cone.
  const CP = [
    [0.0000, 0.0000], [0.0028, 0.0055], [0.0072, 0.0215], [0.0132, 0.0455],
    [0.0198, 0.0755], [0.0258, 0.1035], [C.r, C.h], [C.r, 0.1145],
    [0.0250, 0.1125], [0.0185, 0.1040], [0.0125, 0.0965], [0.0000, 0.0930],
  ];
  const cone = new THREE.Mesh(
    new THREE.LatheGeometry(CP.map(([x, y]) => new THREE.Vector2(x, y)), 22),
    wafer);
  g.add(cone);

  // ── the two scoops ─────────────────────────────────────────────────────
  const geoA = scoopGeometry(), geoB = scoopGeometry();
  const scoopA = new THREE.Mesh(geoA, scoop);
  scoopA.position.set(0, C.h + 0.004, 0);
  const scoopB = new THREE.Mesh(geoB, scoop);
  scoopB.position.set(C.offB[0], C.h + 0.004 + C.hgtA * 0.80, C.offB[1]);
  scoopB.rotation.z = C.leanB;
  g.add(scoopA); g.add(scoopB);

  // ── and what runs off it ───────────────────────────────────────────────
  //
  // Three runs at fixed hashed angles, one of them deliberately on the near
  // side: a drip you cannot see is a drip that did not happen. Each is its own
  // two-deep group — yaw on the outside, and inside it the lean that lays the
  // run along the flank, which stands 13.2° off vertical on this cone. A drip
  // leaves the rim vertically and then clings, and clinging is what you see.
  const drips = [];
  const dripGeo = new THREE.LatheGeometry(
    DRIP_PROF.map(([x, y]) => new THREE.Vector2(x, y)), 7);
  const lean = Math.atan2(C.r - 0.0072, C.h - 0.0215);
  for (let k = 0; k < 4; k++) {
    const ak = k * (TAU / 4) + (hash2(k, 7, 0x5c00d2) - 0.5) * 0.7;
    const yaw = new THREE.Group();
    yaw.rotation.y = ak;
    const m = new THREE.Mesh(dripGeo, run);
    // Just under the lip, and 1.2 mm proud of the flank — enough that it
    // stands on the surface rather than fighting it for the same depth value,
    // and not enough to break the silhouette, which 2.2 mm did: the run on the
    // far left of the cone hung off the edge of it in mid air.
    m.position.set(0, 0.1105, C.r + 0.0012);
    m.rotation.x = lean;
    // Each one gets a different reach, because four identical runs are a
    // decoration and three long and one short is an accident.
    m.userData.reach = 0.62 + hash2(k, 19, 0x5c00d2) * 0.62;
    yaw.add(m);
    g.add(yaw);
    drips.push(m);
  }
  // The pool in the bottom of the cone, which is all that is left at the end.
  const poolG = new THREE.CircleGeometry(0.0195, 14);
  poolG.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(poolG, run);
  pool.position.y = 0.1045;
  g.add(pool);

  for (const m of [cone, scoopA, scoopB, pool, ...drips]) {
    m.castShadow = false; m.receiveShadow = false;
  }
  g.visible = false;
  root.add(g);
  stage.add(root);
  return {
    stage, cam, root, group: g,
    cone, scoopA, scoopB, geoA, geoB, drips, pool,
    mat: { wafer, scoop, run, uMelt },
  };
}

/**
 * One cone, and the clock of the lick you are taking.
 *
 * `held` is seconds since she put it in your hand and `melt` is what that has
 * done to it. They are two numbers and not one because the melt rate is not
 * constant — it goes with the sun — so the elapsed time cannot be integrated
 * back out of it.
 */
const cream = {
  kit: null,
  out: false,          // a cone is in your hand
  flavour: null,       // the normalised key it came as, or null
  licks: 0,            // licks taken, over both scoops
  t: -1,               // seconds into a lick, or −1 between them
  held: 0,             // seconds since the hand-over
  melt: 0,             // 0 fresh out of the case, 1 nothing left on it
  shaped: -1,          // the licks+melt the scoops were last reshaped for
};

/** Make it once, the first time she hands one over. */
function creamKit() {
  if (!cream.kit) cream.kit = buildCream();
  return cream.kit;
}

/**
 * A flavour name as it was said, to a row in the table.
 *
 * Lower case, diacritics off, punctuation to spaces, whitespace collapsed —
 * so "Jogurt Šumsko voće", "jogurt sumsko voce" and "Jogurt  šumsko-voće" are
 * one thing. `normalize('NFD')` and then strip the combining marks, which is
 * the one line that handles č, ć, š, ž and đ without a table of them.
 */
function creamFlavour(name) {
  const k = String(name == null ? '' : name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    // đ has no decomposition — it is a letter, not a d with a mark on it.
    .replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const key = CREAM_ALIAS[k] || k;
  return { key, row: CREAM_FLAVOURS[key] || CREAM_UNKNOWN };
}

/** Put the flavour on the meshes. Called once, when it changes hands. */
function creamPaint(row) {
  const K = creamKit();
  K.mat.scoop.uniforms.uBase.value.setRGB(row.col[0], row.col[1], row.col[2]);
  // The run is the same ice cream, a touch paler because a film of it over a
  // wafer is thin and lit from both sides.
  K.mat.run.uniforms.uBase.value.setRGB(
    Math.min(1, row.col[0] * 1.06), Math.min(1, row.col[1] * 1.06),
    Math.min(1, row.col[2] * 1.06));
  const rib = row.rib || row.col;
  K.mat.scoop.uniforms.uRib.value.setRGB(rib[0], rib[1], rib[2]);
  K.mat.scoop.uniforms.uChip.value = row.rib ? row.chip : 0;
  // How many cells carry a shard. Stracciatella's chocolate is everywhere and
  // a ribbon flavour's is not, so the density goes with the amount.
  K.mat.scoop.uniforms.uDens.value = 0.28 + 0.40 * (row.rib ? row.chip : 0);
}

/**
 * SHE HANDS IT TO YOU. This is the whole of the join between her errand in
 * src/43-jadrija.js and the object in your hand, and it is deliberately one
 * call with one argument: the flavour, lower case, as a word.
 *
 * It takes effect on this frame. There is no pocket step and no key to accept
 * it, because what happened in the fiction is that somebody put an ice cream
 * in your hand, and an ice cream you have to press a button to start holding
 * is an inventory item.
 *
 * Answers a word for what happened, the way `drinkBeer` does, because her side
 * wants to say something and "nothing" is not usable:
 *
 *   'taken'     it is in your hand, and the toast has said so
 *   'have one'  you are already holding one — she keeps it, or eats it
 *   'not now'   you are not on foot, so there is nobody with a hand free
 */
function giveCream(flavour) {
  // On foot and nowhere else, same as the beer and for the same reason: the
  // overlay this draws into is shared with 60-arms.js, and a cone through a
  // forearm mid-crawl is worse than no cone.
  if (state.phase !== 'ground') return 'not now';
  if (cream.out) return 'have one';
  const f = creamFlavour(flavour);
  creamKit();
  creamPaint(f.row);
  cream.out = true;
  cream.flavour = f.key;
  cream.licks = 0;
  cream.t = -1;
  cream.held = 0;
  cream.melt = 0;
  cream.shaped = -1;
  toast(T('cream.got'));
  return 'taken';
}

/**
 * Put it down — or rather drop it, because nobody pockets an ice cream.
 * Walking off the beach with one is what calls this.
 */
function creamStow() {
  if (!cream.out) return false;
  cream.out = false;
  cream.flavour = null;
  cream.licks = 0;
  cream.t = -1;
  cream.held = 0;
  cream.melt = 0;
  cream.shaped = -1;
  if (cream.kit) cream.kit.group.visible = false;
  return true;
}

/**
 * ; — take a lick. Answers a word, same contract as `drinkBeer`.
 *
 *   'lick'      you took some
 *   'melted'    there was nothing on it but a puddle, so the cone has gone in
 *               the bin — which is what you do with a wet cone, and is the
 *               only way out of that state other than walking off the beach
 *   'mid lick'  one is already in progress
 *   'no cream'  nothing in your hand
 *   'not now'   not on foot
 */
function lickCream() {
  if (state.phase !== 'ground') return 'not now';
  if (!cream.out) return 'no cream';
  if (cream.t >= 0) return 'mid lick';
  if (cream.melt >= 1) {
    toast(T('cream.melted'));
    creamStow();
    return 'melted';
  }
  cream.t = 0;
  // Licking the side that is running is the same gesture as licking the top,
  // which is why nobody thinks of it as two things. See MELT.lickBack.
  cream.melt = Math.max(0, cream.melt - MELT.lickBack);
  if (audio && audio.lick) audio.lick();
  return 'lick';
}

/**
 * Draw it over the frame that is already there — see the note at the top.
 * Depth cleared, colour kept, `autoClear` put back afterwards, because a
 * renderer left with it off would wipe nothing on the NEXT frame either.
 */
function creamRender(renderer) {
  if (!cream.out || !cream.kit) return;
  const K = cream.kit;
  K.cam.fov = camera.fov;
  K.cam.aspect = camera.aspect;
  K.cam.position.copy(camera.position);
  K.cam.quaternion.copy(camera.quaternion);
  K.cam.updateProjectionMatrix();
  // The root rides the camera, so `group`'s offsets are view space and its
  // world position is yours — see the note over the top of this file.
  K.root.position.copy(camera.position);
  K.root.quaternion.copy(camera.quaternion);
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(K.stage, K.cam);
  renderer.autoClear = auto;
}

/**
 * Where the cone is and what shape it is in, this frame. Called from the frame
 * loop in src/90-app.js, immediately after `beerTick`.
 *
 * The arc is a pure function of the lick's own clock, exactly as the beer's
 * is: a held object that integrates is a held object that drifts, and this one
 * is 45 cm from the lens where a centimetre shows. The melt is the one thing
 * here that does integrate, and it is allowed to because it is not a position
 * — it is a quantity of heat that has already arrived.
 */
function creamTick(dt) {
  // And it goes if you leave the beach with it. A cone held in the cockpit is
  // a cone nobody asked for.
  if (cream.out && state.phase !== 'ground') creamStow();
  if (!cream.out) {
    if (cream.kit) cream.kit.group.visible = false;
    return;
  }
  const K = creamKit();
  K.group.visible = true;
  const C = CREAM;
  cream.held += dt;
  // The sun does the melting, and the shade does some of it too. See MELT.
  const sun = MELT.shade + (1 - MELT.shade)
    * sat(state.sunElev / MELT.peakElev);
  cream.melt = Math.min(1, cream.melt + dt * sun / MELT.full);

  let u = 0;                     // 0 carried, 1 at your mouth
  if (cream.t >= 0) {
    cream.t += dt;
    const total = C.up + C.hold + C.down;
    u = cream.t < C.up ? cream.t / C.up
      : cream.t < C.up + C.hold ? 1
        : 1 - (cream.t - C.up - C.hold) / C.down;
    if (cream.t >= total) {
      cream.t = -1;
      u = 0;
      cream.licks += 1;
    }
  }
  // How much has gone, counted continuously so nothing pops: the bite lands
  // across `hold`, which is the window the scoop spends at your mouth.
  const eff = cream.licks + (cream.t >= 0
    ? smoothstep(C.up, C.up + C.hold, cream.t) : 0);
  if (eff >= C.licks * C.scoops) {
    // All of it. The cone goes with the last mouthful, because the last
    // mouthful of an ice cream is the cone.
    creamStow();
    toast(T('cream.done'));
    return;
  }

  // ── where it is ────────────────────────────────────────────────────────
  const e = u * u * (3 - 2 * u);
  K.group.position.set(
    lerp(C.rest[0], C.sip[0], e),
    lerp(C.rest[1], C.sip[1], e),
    lerp(C.rest[2], C.sip[2], e));
  // Tipped toward you for the lick, and canted across the view the whole time:
  // an ice cream held dead upright in front of your face is a photograph of an
  // ice cream.
  K.group.rotation.set(lerp(C.tiltRest, C.tiltSip, e), 0,
    lerp(C.cantRest, C.cantSip, e));

  // ── and what shape it is in ────────────────────────────────────────────
  //
  // Reshaped only when the shape has moved, which over four minutes of melting
  // is about fifty times and over a lick is every frame of the hold. The melt
  // alone changes by 8e-5 a frame at 60 fps, and rebuilding 162 vertices and
  // their normals for that would be arithmetic nobody can see.
  const key = eff + cream.melt * 4;
  if (Math.abs(key - cream.shaped) > 0.004) {
    cream.shaped = key;
    const eatenB = sat(eff / C.licks);                 // the top one first
    const eatenA = sat((eff - C.licks) / C.licks);
    // Melt takes it off as well as eating does: what runs down the side is not
    // on the scoop any more.
    const wB = (1 - eatenB) * (1 - 0.55 * cream.melt);
    const wA = (1 - eatenA) * (1 - 0.55 * cream.melt);
    shapeScoop(K.geoA, C.radA * (0.58 + 0.42 * wA), C.hgtA * (0.40 + 0.60 * wA),
      eatenA, cream.melt, 1, eatenB >= 1);
    shapeScoop(K.geoB, C.radB * (0.58 + 0.42 * wB), C.hgtB * (0.40 + 0.60 * wB),
      eatenB, cream.melt, 2, true);
    K.scoopA.visible = eatenA < 1 && cream.melt < 1;
    K.scoopB.visible = eatenB < 1 && cream.melt < 1;
    // The top one sits on the bottom one, so where it sits moves as the bottom
    // one is eaten down and as both of them slump.
    K.scoopB.position.y = C.h + 0.004
      + C.hgtA * (0.40 + 0.60 * wA) * 0.80 * (1 - 0.30 * cream.melt);
  }

  // ── and what has run off it ────────────────────────────────────────────
  //
  // Full reach by the time the melt is half done, not at the end of it: a run
  // gets to the bottom of the cone long before there is nothing left on top,
  // and a run that grows in step with the melt all the way to 1 is a run that
  // is still a stub at the point a player would first notice one. Wider as
  // well as longer, so that a short run is a thin trickle rather than a blob
  // the same 4 mm across as a long one — which is what the first pass looked
  // like: four little white pegs stuck out sideways under the scoop.
  const runF = sat((cream.melt - MELT.dripAt) / 0.30);
  for (const m of K.drips) {
    const wide = 0.55 + 0.45 * runF;
    m.scale.set(wide, C.dripLen * runF * m.userData.reach, wide);
    m.visible = runF > 0.02;
  }
  // The pool, which is the whole of what is left once it has all gone over the
  // side. Only worth drawing once there is something in it.
  K.pool.visible = cream.melt > 0.45;
  K.pool.scale.setScalar(sat((cream.melt - 0.45) / 0.35) * 0.55 + 0.45);
  K.mat.uMelt.value = cream.melt;
}
