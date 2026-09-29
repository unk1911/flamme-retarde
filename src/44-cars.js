/**
 * The cars parked in the wood behind Jadrija.
 *
 * The geometry is baked by `tools/blender/cars.py` — six body types and a
 * covered car, a body blob each, the far tier of the rest, and a near kit (see
 * "two tiers" below) — and everything in this file is about getting them onto the
 * ground facing the right way. The shore build in `src/43-jadrija.js` decides
 * *where* each one stands, because that is a question about the shore: which
 * bands of `t` are clear of the shops, how far inland a car can be before it is
 * standing in somebody's front room, and where the playground railing is. This
 * file decides what model turns up, what colour it is painted, and how the
 * whole row gets drawn: three calls a model, two more for a model with a car
 * inside the kit's 30 m and one per near wheel, and one for the dark under
 * every car.
 *
 * ── three layers per model ────────────────────────────────────────────────
 *
 * `SOLID_VERT` does `vColor = aInstColor` for an instanced draw and the
 * fragment stage does `base = uBase * vColor` and then `base *= vVCol`. So the
 * per-instance colour multiplies every vertex colour in the mesh, and one blob
 * per car would mean picking dark blue for a car and getting dark blue
 * headlamps, dark blue glass and dark blue tyres with it. `carNearProto` in
 * `src/37-props.js` has exactly that flaw and gets away with it because its
 * lamps are three boxes seen at 300 m; these are seen from two.
 *
 * So each model gets instanced layers over the same instance list. The `body`
 * layer carries a mesh whose vertex colours are white (and 0.3 in the shut
 * lines, which the paint then darkens) and an `aInstColor` holding the paint.
 * The `gloss` layer carries the glass, the lamp lenses, the alloys and the
 * gloss-black trim; the `trim` layer the tyres, plastics, plates and the
 * underside — both in their own colours, with `aInstColor` left at 1.0 so
 * nothing tints them. Body and gloss are three materials' worth of difference
 * from the trim (see `carMaterials`), which is why they are layers and not
 * vertex colours in one mesh.
 *
 * ── why it does not borrow the town's layer ───────────────────────────────
 *
 * `propLayer` itself is reused as-is: it takes a `BufferGeometry` carrying
 * position / normal / aVCol, which is exactly what `readFR3D` hands back. What
 * is not reused is the town's *car layer*, whose capacity is budgeted in
 * `PROPS` against the traffic on the coast road and has nothing spare for a
 * resort. Reusing the function is not the thing the comment in the shore build
 * warns about; reusing the layer is.
 *
 * ── the palettes ──────────────────────────────────────────────────────────
 *
 * Weighted off the footage rather than off a guess about what an old Dalmatian
 * car park holds. The nose-in row under the olives is overwhelmingly white,
 * with silver next and one or two dark cars in it; the van is white because
 * small panel vans are; and red belongs almost entirely to `oldhatch`, which is
 * the one older squarer car in either walk-through and the only red thing in
 * them. Rule 12: these are body types and colour weights, not marques.
 *
 * ── two tiers (28 Sep, the second pass) ───────────────────────────────────
 *
 * After 1.539.0 the verdict was "clearly better but still mid-detail, not
 * photoreal", and Misha: *"yes improve cars more, and perhaps decrease total
 * numbers of cars by 33%"*. The detail a car needs from two metres — glass you
 * can see a cabin through, a loaded tyre with a brake disc behind its spokes,
 * lamps with something in them, a plate you could nearly read — is twice the
 * triangles and none of it shows from sixty. So there are two tiers, and the
 * body is in neither: it is one mesh at every distance, drawn for every car
 * within `CAR_DRAW_M`, so the silhouette never pops. What changes at
 * `CAR_KIT_M` is everything on, in and behind it.
 *
 * In 1.542.2 the near tier was baked-but-not-shipped: drawn as a second copy
 * of everything but the paint, swapped in at 40 m, it cost too much at the car
 * park and was 1.14 MB of page. In 1.543.4 it ships as a KIT on top of the far
 * tier, which is now drawn at every distance — see "the kit" over
 * `buildJadrijaCars` for what is in it, what it replaces, and what it cost.
 */

const CAR_PAINT = {
  white: [0.962, 0.958, 0.948],
  pearl: [0.918, 0.926, 0.930],
  silver: [0.748, 0.762, 0.780],
  grey: [0.548, 0.558, 0.572],
  slate: [0.262, 0.272, 0.288],
  blue: [0.148, 0.202, 0.328],
  red: [0.520, 0.128, 0.108],
  sand: [0.638, 0.608, 0.545],
  // The two the row did not have, and a car park in 2026 does. Black is not
  // zero: 0.03 of diffuse under a clearcoat is what a black car is, and the
  // reflection on top of it (see `CAR_PAINT_GLSL`) is most of what you see.
  black: [0.030, 0.031, 0.034],
  navy: [0.050, 0.070, 0.135],
  scarlet: [0.560, 0.045, 0.040],
  // Not a paint: the fitted cover on the car that is left for the season.
  //
  // The blue in it is measured OFF and not on, which is the same trap the
  // lavender bank fell into. Sampled across `a_087`, the cover's blue lean
  // runs 0.078 in full sun and 0.115 in the sky-lit midtones — but 0.030 in
  // the deep shade under the pine, where no sky reaches it. That last one is
  // the fabric; the other two are the sky, and the game puts the sky back by
  // itself. Mixed at 0.10 this would be a blue car cover.
  cover: [0.652, 0.668, 0.692],
};

/**
 * The five, with how often each turns up and what it is painted.
 *
 * `w` are shares of the row and they sum to one; the picker walks them in
 * order. `oldhatch` is deliberately the rarest of the cars — the footage has
 * exactly one of them against a dozen moderns, and a wood full of squarer old
 * hatchbacks would be a period piece rather than this August.
 */
const CAR_MODELS = [
  // Two of the fifty-two are put away under covers, and two is the number the
  // footage has: `a_048`-`a_050` and `a_086`-`a_089` in v595, both among the
  // pines. (There is a third behind a gate on the lane at `b_047`, which the
  // survey catalogued as a glass-recycling igloo and is not — see the note in
  // tools/blender/cars.py.)
  //
  // 0.05 is fitted to that count and not derived from it. `carModelFor` walks
  // these weights against `jit`, which is a sine hash over the station index
  // and not a uniform draw, so fifty-two of them do not land in proportion:
  // 0.04 gave one covered car, 0.06 gave four, 0.05 gives two. The weight is
  // the dial and the count on the built page is the reading, which is the same
  // way every other number on this shore was arrived at.
  //
  // The 0.05 comes off `supermini`, the commonest, so the rest of the mix
  // keeps its shape. Every car in the row changes model when this table
  // changes, and that is fine and is why the note on `carModelFor` exists: the
  // car loop takes no `rng()` calls, so nothing else on the beach moves with
  // it. Rule 4 is about the `rng` stream and this is not in it.
  { key: 'covered', w: 0.05, paint: ['cover'], matte: true },
  // Still white-heavy, because the footage is — but with a black, a navy and
  // a red in the mix, since "per-car colours from a realistic palette" was
  // the ask (28 Sep) and a row of nothing but white and silver is the other
  // way the wood read as one car pasted forty times.
  { key: 'supermini', w: 0.24,
    paint: ['white', 'white', 'white', 'white', 'pearl', 'silver', 'silver',
      'grey', 'slate', 'blue', 'black', 'scarlet'] },
  { key: 'crossover', w: 0.22,
    paint: ['white', 'white', 'white', 'pearl', 'silver', 'silver', 'grey',
      'slate', 'blue', 'black', 'navy'] },
  { key: 'estate', w: 0.15,
    paint: ['white', 'white', 'silver', 'silver', 'pearl', 'grey', 'slate',
      'sand', 'black', 'navy'] },
  { key: 'van', w: 0.10,
    paint: ['white', 'white', 'white', 'white', 'white', 'pearl', 'silver'] },
  { key: 'oldhatch', w: 0.08,
    paint: ['red', 'red', 'red', 'white', 'blue', 'slate'] },
  // The saloon Misha's list named (28 Sep) and the wood did not have. Its
  // 0.16 came off the others, the covered car's 0.05 untouched, so the one
  // car under a cover is still the one it was. Most of it off `oldhatch`:
  // at 0.14 the sine hash put three old red three-doors in thirteen, two of
  // them side by side, and the footage has exactly one.
  { key: 'sedan', w: 0.16,
    paint: ['white', 'silver', 'silver', 'grey', 'slate', 'black', 'navy', 'pearl'] },
];

/**
 * Which paints are metallic. Solid white and the two reds are not — they are
 * the paints that come without flake — and nearly everything else a car park
 * holds in 2026 is. It decides the flop (a metallic darkens toward its edges)
 * and the sparkle; see `CAR_PAINT_GLSL`.
 */
const CAR_METALLIC = new Set(['pearl', 'silver', 'grey', 'slate', 'blue', 'sand',
  'black', 'navy']);

/**
 * What is parked at this station, from a hash the caller already has.
 *
 * `j` is `jit(t|0, 25)`, which is a sine hash and not a draw off `rng` — see
 * the note over `jit` in the shore build. That is the whole reason the number
 * of models here is free to change: the car loop takes no `rng()` calls at all,
 * so nothing downstream of it on the beach moves when this table does.
 */
function carModelFor(j) {
  let a = 0;
  for (const m of CAR_MODELS) {
    a += m.w;
    if (j < a) return m;
  }
  return CAR_MODELS[0];
}

/** Fallback extents, for a build whose payload was not baked. */
const CAR_FALLBACK = { x0: -1.95, x1: 2.05, hw: 0.86, h: 1.50,
  ax: [-1.24, 1.24], r: 0.30, tr: 0.69 };

/**
 * The model's dimensions, in metres, read straight out of the sidecar.
 *
 * `build.py` inlines a `.json` payload verbatim, so `PAYLOAD.cars` is a plain
 * object and this is synchronous — which is what the shore build needs, since
 * it pushes the walk blockers for the row hundreds of lines before anything is
 * inflated. One source of truth: the numbers come off the same Blender specs
 * that produced the meshes, so a car and its blocker cannot drift apart.
 *
 * `x0`/`x1` are the tail and the nose in model space, with the origin at the
 * wheelbase centre; `hw` is the widest half-width, which is the car's extent
 * *along the shore* because the row is parked nose-in; `h` is the overall
 * height, roof box included.
 */
function carSize(key) {
  const table = (typeof PAYLOAD !== 'undefined' && PAYLOAD.cars) || null;
  return (table && table[key]) || CAR_FALLBACK;
}

/**
 * The two finishes that are not matt, as `lit` hooks for `solidMaterial`.
 *
 * "The cars still look like shit" (28 Sep) was partly geometry and partly
 * this: every car was lit by the prop shader's one blinn lobe at 0.34 with a
 * mirror of the sky scaled by the same 0.34 — which is a plastic toy, the
 * same sheen on the paint, the glass, the tyres and the number plates.
 *
 * Paint is a CLEARCOAT: a coloured diffuse base under a clear dielectric
 * layer, so the reflection is Fresnel — 4 % looking straight at a panel, all
 * of it at a grazing angle — and whatever it reflects is added over the
 * colour, not multiplied by it. That is why a black car is black with the
 * sky on it and a white car is white: the coat is the same on both.
 *
 * What it reflects is not the sky on its own. These are parked in a pine
 * wood, so the reflection is dimmed toward the horizon, where the trunks and
 * the canopy are, and below it is the ground; and it is dimmed again in the
 * shade (`sh`), which is the cheapest occlusion there is and is right under
 * a tree. A sky-mirror under a pine canopy is what made the last version's
 * roofs glow.
 *
 * Gloss is glass, lamp lenses, alloys and the gloss-black trim, told apart by
 * the vertex colour: anything bright is metal (reflection tinted by the base,
 * F0 0.6), anything dark is a dielectric (F0 0.05) whose reflection REPLACES
 * what is behind it as the angle closes, which is what a windscreen does.
 *
 * (NO BACKTICKS in the GLSL below — it is a template literal.)
 */
const CAR_SOFT_GLSL = `
  // The canopy's shadow, softened. One tap of the near cascade lays the pine
  // shade on a car as square blocks a hand across, which the needle floor
  // hides and a smooth white door does not. Five taps 18 cm apart, pushed 5 cm
  // off the panel so a car does not shade itself, and the sun term already
  // in col is corrected by the difference. Paint and gloss only: on a black
  // tyre or through a pane nobody can see the blocks, and five shadow taps a
  // pixel over the trim and the glass was most of what the second pass first
  // cost (measured, 28 Sep).
  vec3 cP = vWorld + n * 0.05;
  float cSh = (shadowAt(cP) + shadowAt(cP + vec3(0.18, 0.0, 0.0))
    + shadowAt(cP - vec3(0.18, 0.0, 0.0)) + shadowAt(cP + vec3(0.0, 0.0, 0.18))
    + shadowAt(cP - vec3(0.0, 0.0, 0.18))) * 0.2;
  col += base * uSunColor * uSunI * ndl * INV_PI * (cSh - sh);
  sh = cSh;
`;
const CAR_ENV_GLSL = `
  // What the ground takes off a car's lower half. Sky ambient comes from
  // above, and the bottom 40 cm of a door, a sill, a wheel, see less of it
  // and more of the dark under the car: without this every car was lit as
  // evenly at the rocker as at the roof, which is a car on a turntable. In
  // the car's own frame (vLocal is the model position, metres off the ground).
  float cAo = mix(0.50, 1.0, smoothstep(0.04, 0.60, vLocal.y));
  col -= base * ambientAt(n, uAmbSky, uAmbGround, uAmbI) * INV_PI * 2.2 * (1.0 - cAo);
  vec3 cV = -viewDir;
  float cNV = clamp(dot(n, cV), 0.0, 1.0);
  vec3 cR = reflect(viewDir, n);
  vec3 cE = skyColor(normalize(cR), false);
  cE *= mix(0.28, 1.0, smoothstep(0.02, 0.55, cR.y));
  cE = mix(uAmbGround * uAmbI * 0.30, cE, smoothstep(-0.12, 0.04, cR.y));
  float cOcc = mix(0.40, 1.0, sh) * mix(0.55, 1.0, cAo);
  float cSun = pow(max(dot(n, normalize(uSunDir - viewDir)), 0.0), 1200.0) * sh;
`;

/**
 * The paint, per instance: `vSuit` is (metallic, dust, sun-bleach), see
 * `carFinish`. Three things 1.539.0's clearcoat did not have, each of which a
 * photograph of a parked car has and a render usually does not:
 *
 *   FLOP AND FLAKE. A metallic is brighter looking straight at a panel and
 *   darker toward its edges, because the flakes lie flat in the coat; and
 *   close to, the flakes catch the sun one at a time. The sparkle is a hash
 *   on a cell grid in the car's own frame, and the cell is sized to the
 *   pixel — doubled in steps as the car gets further off, like a mip — so a
 *   flake is never smaller than a pixel and never shimmers as you walk. It
 *   is kept faint: this is the thing that is easy to overdo.
 *
 *   DUST. These are parked on a limestone track under pines in August. The
 *   lower 40 cm of every car carries the track's dust, broken up by noise so
 *   the line is not ruled, and the flat tops carry a little of what falls
 *   out of the trees. Dust is matt, so where there is dust the clearcoat
 *   gives up its reflection.
 *
 *   SUN. The old three-door's red has been out in forty summers of this and
 *   is chalky and paler on top, where the sun hits it, with no gloss left to
 *   speak of.
 *
 * And the INSIDE. From the near tier on, the glass is see-through, and what
 * you see through it of the body's own panels is their back faces — so the
 * back face of the paint is drawn as door trim, and the underside of the roof
 * as a pale headliner. That is the whole inside of a car's doors, for no
 * geometry at all.
 */
const CAR_PAINT_BODY = `
  base *= vVCol;
  float cIn = gl_FrontFacing ? 0.0 : 1.0;
  n = gl_FrontFacing ? n : -n;
  env = 0.0;
  // Sun-bleached: chalkier and paler, more so on what faces the sky.
  base = mix(base, vec3(dot(base, vec3(0.30, 0.52, 0.18))) * 0.80 + vec3(0.15, 0.11, 0.10),
    vSuit.z * (0.28 + 0.38 * max(n.y, 0.0)));
  // Dust, low down and on the tops. vnoise2 is the shared value noise.
  float cN = vnoise2(vLocal.xz * 9.0 + vLocal.y * 3.0) * 0.6 + vnoise2(vLocal.zy * 23.0 + 7.0) * 0.4;
  float cD = vSuit.y * (1.0 - smoothstep(0.08, 0.48, vLocal.y + (cN - 0.5) * 0.24));
  cD += vSuit.y * 0.40 * smoothstep(0.55, 0.95, n.y) * smoothstep(0.40, 0.80, cN);
  cD = clamp(cD, 0.0, 0.80) * (1.0 - cIn);
  base = mix(base, vec3(0.43, 0.39, 0.32), cD);
  // The inside of the doors, dark, and the headliner, pale.
  if (cIn > 0.5) base = n.y < -0.5 ? vec3(0.17, 0.165, 0.155) : vec3(0.036, 0.036, 0.040);
`;
// The five taps are for the OUTSIDE of a panel. Its back face is the door
// trim and the headliner, seen only through the kit's glass (28 Sep), where a
// canopy's blocks cannot be told from the cabin's own dark — and a timer round
// each draw put the paint's cost up by a fifth at the car park the day the
// glass went clear, which was those taps on the inside of every door.
const CAR_PAINT_GLSL = '  if (cIn < 0.5) {' + CAR_SOFT_GLSL + '  }\n' + CAR_ENV_GLSL + `
  float cMt = vSuit.x * (1.0 - cIn);
  float cK = (1.0 - cIn) * (1.0 - 0.85 * cD) * (1.0 - 0.60 * vSuit.z);
  // The flop, on the colour and not on the coat's reflection.
  col *= mix(1.0, 0.76 + 0.36 * cNV, cMt);
  vec3 cHv = normalize(uSunDir - viewDir);
  // A metallic's broad sheen, in its own colour, under the coat's sharp glint.
  col += base * uSunColor * uSunI * pow(max(dot(n, cHv), 0.0), 24.0) * 0.30 * sh * cMt;
  float cF = 0.04 + 0.96 * pow(1.0 - cNV, 5.0);
  col = col * (1.0 - cF * 0.85 * cK) + cE * cF * uCoat * cOcc * cK;
  col += uSunColor * cSun * 2.5 * cK;
  // The flake, on a pixel-sized grid (see above).
  float cFw = max(length(fwidth(vLocal)), 1e-5);
  float cLv = max(0.0, ceil(log2(cFw / 0.0007)));
  vec3 cCell = floor(vLocal / (0.0007 * exp2(cLv)));
  float cHh = fract(sin(dot(cCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vec3 cFn = normalize(n + (vec3(fract(cHh * 13.17), fract(cHh * 71.31), fract(cHh * 29.73)) - 0.5) * 0.55);
  float cFl = pow(max(dot(cFn, cHv), 0.0), 700.0) * step(0.86, cHh);
  col += uSunColor * cFl * sh * cMt * cK * 0.7 / (1.0 + cLv);
`;
const CAR_GLOSS_TAIL = `
  float cM = smoothstep(0.30, 0.55, max(max(vVCol.r, vVCol.g), vVCol.b));
  float cF0 = mix(0.09, 0.60, cM);
  float cF = cF0 + (1.0 - cF0) * pow(1.0 - cNV, 5.0);
  vec3 cTint = mix(vec3(1.0), base / max(max(base.r, base.g), max(base.b, 1e-3)), cM);
  col = col * (1.0 - cF * (1.0 - cM) * 0.9) + cE * cF * cTint * uCoat * cOcc;
  col += uSunColor * cSun * 3.0;
`;
const CAR_GLOSS_GLSL = CAR_SOFT_GLSL + CAR_ENV_GLSL + CAR_GLOSS_TAIL;

/**
 * The matt trim — tyres, plastics, plates.
 *
 * It lit the cabin too, in the second pass, telling the seats from a tyre by
 * where they stood — inside the body's own box. The cabin is the kit's now and
 * says what it is in its own colour (`CAR_KIT_GLSL`), and nothing of the far
 * trim stands in that box, so the test went with it.
 */
const CAR_TRIM_GLSL = CAR_ENV_GLSL + `
  // Rubber and plastic: a little of the sky at a grazing angle, no more.
  float cF = 0.03 + 0.25 * pow(1.0 - cNV, 5.0);
  col += cE * cF * cOcc * 0.6;
`;

/**
 * The see-through glass, near tier only.
 *
 * A pane is two things: a reflection added on top, and a filter on whatever
 * is behind it. So this is drawn PREMULTIPLIED (one, one-minus-source-alpha):
 * the colour written is the reflection alone, and alpha is how much of what is
 * behind is taken away — the pane's own absorption (its vertex colour is how
 * much it lets through, baked per pane: the windscreen and front door glass
 * 0.64, the privacy glass behind the B-pillar 0.30) plus what the Fresnel
 * reflection takes, which at a grazing angle is nearly all of it. That is why
 * a windscreen shows the cabin looking in square and a mirror of the sky
 * looking along it.
 */
const CAR_GLASS_GLSL = CAR_ENV_GLSL + `
  float gT = vVCol.r;
  float gF = 0.04 + 0.96 * pow(1.0 - cNV, 5.0);
  col = cE * gF * cOcc + uSunColor * cSun * 3.0 + vec3(0.006, 0.008, 0.008) * (1.0 - gT);
  alpha = 1.0 - gT * (1.0 - gF);
`;

/**
 * The near KIT's one material (28 Sep, third pass) — see "the kit" below.
 *
 * The second pass drew the near tier as three layers a model, gloss, trim and
 * glass, because they are three materials; that was three draws a model on
 * top of the far tier's, and draws, not pixels, were where its cost went
 * (measured with a timer round each draw: the near tier's own GPU time at the
 * car park was 0.2 ms, and the page paid three times that). So everything of
 * the kit that is not glass is ONE layer and one material, and a surface says
 * which finish it is in the low bits of its baked colour (`classed` in
 * tools/blender/cars.py): the blue byte odd for gloss — the chrome, the
 * lenses, the alloys, the rotor — the green byte odd for the cabin, which is
 * lit by what comes through the glass. The finishes are the second pass's,
 * unchanged: `CAR_GLOSS_TAIL`, the trim's matt lobe and grazing sheen, and the
 * cabin's third of the sky. None of it takes the paint's five shadow taps.
 */
const CAR_KIT_BODY = 'base *= vVCol;\n  n = gl_FrontFacing ? n : -n;\n  env = 0.0;\n'
  + '  vec3 kCl = floor(vVCol * 255.0 + 0.5);\n'
  + '  float kG = mod(kCl.b, 2.0);\n'
  + '  float kC = mod(kCl.g, 2.0);\n'
  + '  spec = 0.10 * kG;';
const CAR_KIT_GLSL = CAR_ENV_GLSL + `
  // The cabin sees a third of the sky the bonnet does.
  col -= base * ambientAt(n, uAmbSky, uAmbGround, uAmbI) * INV_PI * 2.2 * cAo * 0.62 * kC;
  // Rubber and plastic: the trim's own broad lobe (the base lobe above is the
  // gloss's, and is zero here for the trim), and a little sky at a grazing angle.
  col += uSunColor * pow(max(dot(n, hv), 0.0), 18.0) * 0.08 * sh * (1.0 - kG);
  vec3 kT = col + cE * (0.03 + 0.25 * pow(1.0 - cNV, 5.0)) * cOcc * (1.0 - kC) * 0.6;
  float cM = smoothstep(0.30, 0.55, max(max(vVCol.r, vVCol.g), vVCol.b));
  float cF0 = mix(0.09, 0.60, cM);
  float cF = cF0 + (1.0 - cF0) * pow(1.0 - cNV, 5.0);
  vec3 cTint = mix(vec3(1.0), base / max(max(base.r, base.g), max(base.b, 1e-3)), cM);
  vec3 kGl = col * (1.0 - cF * (1.0 - cM) * 0.9) + cE * cF * cTint * cOcc
    + uSunColor * cSun * 3.0;
  col = mix(kT, kGl, kG);
`;

/**
 * Where the kit starts, in the VERTEX stage, and the far tier gives way.
 *
 * `uCarKit` is the radius. A car inside it draws the kit and, in the far
 * layers, loses the two things the kit replaces — the opaque glass (its baked
 * colour, 7/9/11 in bytes, is the glass's alone) and the four wheels (the
 * space round each axle, out of `aInstSuit` = the axles' x and the wheel's
 * radius and `aInstHair` = the wheels' lateral span and whether this car has
 * a kit at all; the covered car has not). A car outside it draws neither kit
 * nor hole. Both sides take the same test on the same number — the car's own
 * position, which on a kit layer rides in `aInstSuit` because a wheel's
 * `aInstPos` is the wheel's — so there is never a frame with both the far
 * wheel and the near one, or neither. What is cut is collapsed to a point,
 * which the rasteriser drops, rather than discarded, which would cost the
 * whole layer its early depth test.
 */
const CAR_KIT_VDECL = 'uniform vec3 uCamPos;\nuniform float uCarKit;';
const CAR_FAR_VERT = `
  if (aInstHair.z > 0.5) {
    vec2 cD = aInstPos.xz - uCamPos.xz;
    if (dot(cD, cD) < uCarKit * uCarKit) {
      vec3 cB = floor(aVCol * 255.0 + 0.5);
      float cGl = step(abs(cB.r - 7.0) + abs(cB.g - 9.0) + abs(cB.b - 11.0), 0.5);
      float cWx = min(abs(p.x - aInstSuit.x), abs(p.x - aInstSuit.y));
      float cAz = abs(p.z);
      float cWh = step(length(vec2(cWx, p.y - aInstSuit.z)), aInstSuit.z + 0.006)
        * step(aInstHair.x, cAz) * step(cAz, aInstHair.y);
      if (cGl + cWh > 0.5) p = vec3(0.0);
    }
  }
`;
const CAR_KIT_VERT = `
  vec2 cD = aInstSuit.xz - uCamPos.xz;
  if (dot(cD, cD) >= uCarKit * uCarKit) p = vec3(0.0);
`;

/**
 * Draw only the cars within a band of distance from the camera.
 *
 * One layer holds every car of a model from one end of the shore to the
 * other, so its bounding sphere is 360 m across and is in frame from nearly
 * anywhere on the promenade — and the better cars are 8 000 triangles each
 * where the old ones were 1 000. Measured at the promenade (t 460 looking
 * west) that was +0.8 ms of GPU for cars standing behind two rows of kabine
 * and a wood. So each layer keeps its full instance list aside and, when the
 * set within range changes, packs just those to the front and draws that
 * many. The camera is `U.uCamPos`, which is the eye in every pass — the
 * shadow pass included, so a car does not lose its shadow before itself.
 *
 * `r0`/`r1` are the band: [0, 130) for the body and the far tier. The kit's
 * layers pass `by`, the attribute that holds the CAR's position (a wheel's own
 * is a metre off it), and are cut a few metres wide of `CAR_KIT_M` — the
 * exact cut is the vertex stage's (`CAR_KIT_VERT`), so this list only has to
 * be a superset of it, and a frame late is harmless. A kit layer is also
 * HIDDEN while its list is empty, which a far layer never is inside 130 m:
 * an empty layer still costs its program, its uniforms and its buffers every
 * frame, and at the promenade that was eighteen of them for nothing. A hidden
 * mesh gets no `onBeforeRender`, so a kit layer's step is not hung on its own
 * mesh but returned, and `buildJadrijaCars` runs it off the bodies'.
 */
const CAR_DRAW_M = 130;
// The near KIT's radius (see "the kit" in `buildJadrijaCars`).
//
// The second pass drew its near tier to 40 m and it did not ship: it was
// measured at 3.0-3.7 ms against 1.0-2.6 for the far tier alone. The kit is
// drawn to 30 m. Nearly all of what it adds reads from under fifteen — plate
// lettering, lug nuts, a tyre's moulding, the LED strip in a lamp — and what
// reads further, the cabin through the glass, is behind a pane that is 30 %
// and 64 % transmissive and under a pine canopy: at thirty metres a seat back
// is two pixels of a dark window. The band only decides how many cars pay for
// the kit, not how many draws it is, which is set by how many body types have
// a car inside it.
const CAR_KIT_M = 30;
function nearOnly(L, n, r0 = 0, r1 = CAR_DRAW_M, by = null) {
  const attrs = Object.entries(L.geo.attributes)
    .filter(([, a]) => a.isInstancedBufferAttribute).map(([, a]) => a);
  const posA = L.geo.attributes[by || 'aInstPos'];
  const full = attrs.map((a) => a.array.slice(0, n * a.itemSize));
  const pos = full[attrs.indexOf(posA)];
  let key = -1, pending = -1;
  const step = () => {
    // A rewrite reaches the GPU at the start of the NEXT render call, so the
    // new count waits for it; until then this draws a prefix of the old list.
    if (pending >= 0) { L.geo.instanceCount = pending; pending = -1; }
    const cp = U.uCamPos.value;
    let bits = 0;
    const idx = [];
    for (let i = 0; i < n; i++) {
      const dx = pos[i * 3] - cp.x, dz = pos[i * 3 + 2] - cp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r0 * r0 && d2 < r1 * r1) { idx.push(i); bits = (bits * 31 + i + 1) % 1000000007; }
    }
    bits = bits * 64 + idx.length;
    if (bits === key) return;
    key = bits;
    attrs.forEach((a, m) => {
      const w = a.itemSize;
      let k = 0;
      for (const i of idx) {
        for (let c = 0; c < w; c++) a.array[k * w + c] = full[m][i * w + c];
        k++;
      }
      a.needsUpdate = true;
    });
    pending = idx.length;
    L.geo.instanceCount = Math.min(L.geo.instanceCount, idx.length);
    if (by) L.mesh.visible = idx.length > 0;
  };
  if (!by) L.mesh.onBeforeRender = step;
  return step;
}
let carMats = null;
const CAR_KIT_U = { value: CAR_KIT_M };
/** One material per finish, shared by every model and both car parks. */
function carMaterials() {
  if (carMats) return carMats;
  const mk = (lit, spec, specPower, coat, body, vert) => solidMaterial(0xffffff, {
    instanced: true, spec, specPower, side: THREE.DoubleSide,
    // env 0: the default sky mirror is off, and the one in `lit` replaces it.
    body: body || 'base *= vVCol;\n  n = gl_FrontFacing ? n : -n;\n  env = 0.0;',
    uniforms: { uCoat: { value: coat }, uCarKit: CAR_KIT_U },
    decl: 'uniform float uCoat;',
    ...(vert ? { vert, vdecl: CAR_KIT_VDECL } : {}),
    lit,
  });
  carMats = {
    paint: mk(CAR_PAINT_GLSL, 0.10, 60, 0.95, CAR_PAINT_BODY),
    gloss: mk(CAR_GLOSS_GLSL, 0.10, 90, 1.0, null, CAR_FAR_VERT),
    // The trim keeps a lobe of its own, turned down from the 0.34 everything
    // used to share: 0.08 at 18 is rubber and textured plastic.
    trim: mk(CAR_TRIM_GLSL, 0.08, 18, 0.0, null, CAR_FAR_VERT),
    // The kit: everything near that is not glass, in one draw (see
    // CAR_KIT_GLSL). Its base lobe is the gloss's; the trim's is in `lit`.
    kit: mk(CAR_KIT_GLSL, 0.10, 90, 1.0, CAR_KIT_BODY, CAR_KIT_VERT),
    glass: mk(CAR_GLASS_GLSL, 0.0, 90, 1.0,
      'n = gl_FrontFacing ? n : -n;\n  env = 0.0;\n  spec = 0.0;', CAR_KIT_VERT),
  };
  const g = carMats.glass;
  g.transparent = true;
  g.depthWrite = false;
  g.blending = THREE.CustomBlending;
  g.blendSrc = THREE.OneFactor;
  g.blendDst = THREE.OneMinusSrcAlphaFactor;
  // One pass, not three.js's two. A transparent double-sided material is
  // drawn back faces first and then front, which is a second draw a model for
  // what is two panes of tint over each other: summed the other way round
  // they differ by one reflection times the other pane's alpha, a level or
  // two out of 255 on a window, and the draw is a draw.
  g.forceSinglePass = true;
  return carMats;
}

/**
 * The per-car finish: `(metallic, dust, sun-bleach)`, off the paint and a hash
 * of where the car stands — no `rng`, like everything else about the row.
 *
 * Dust is between a quarter and three quarters: every car in the wood has come
 * down the same limestone track, and some of them last week. The van works and
 * the old three-door has not been washed this summer, so theirs is heavier;
 * the old car is also the one that is sun-bleached.
 */
function carFinish(s, model) {
  const name = Object.keys(CAR_PAINT).find((k) => CAR_PAINT[k] === s.tint) || '';
  const h = (k) => {
    const v = Math.sin(s.x * (12.9898 + k) + s.z * (78.233 - k)) * 43758.5453;
    return v - Math.floor(v);
  };
  if (model.matte) return [0, 0, 0];
  const dust = 0.22 + 0.50 * h(1) + (model.key === 'van' ? 0.12 : 0)
    + (model.key === 'oldhatch' ? 0.22 : 0);
  const bleach = model.key === 'oldhatch' ? 0.55 + 0.45 * h(2) : 0;
  return [CAR_METALLIC.has(name) ? 1 : 0, Math.min(0.95, dust), bleach];
}

/**
 * Draw the row.
 *
 * `sites` is what the shore build collected: `{ x, y, z, yaw, pitch, roll,
 * model, tint }` per car, already in world space, turned to face the water and
 * tilted to sit on the slope it stands on. Per model, instanced layers over
 * the same list: the paint, the gloss and the trim for every car in range, and
 * the near kit's glass and the rest of the kit for the cars inside
 * `CAR_KIT_M`; and one layer per near WHEEL, over every car that runs it. One
 * layer per material (`carMaterials`), each with a real bounding sphere over
 * the instances that ended up in it, rather than `propLayer`'s 1e9 one, so the
 * whole car park culls as a unit the moment you are looking the other way.
 *
 * ── the kit (28 Sep, third pass) ──────────────────────────────────────────
 *
 * *"I guess the cars were half-finished, can u finish off that one?"* (Misha,
 * 28 Sep). The second pass had built a near tier and left it out, on cost.
 * It was a second copy of every part of a car that is not paint — the shell's
 * glass, lamps, plastics and underside, the plates, the mirrors, four wheels —
 * swapped for the far one at 40 m: three more layers a model and 1.14 MB of
 * page. Two measurements said where that went. A timer round each draw put
 * the near tier's own GPU time at the car park at 0.2 ms; toggling it in the
 * page, synchronously and paired 200 times, put its whole cost at 0.4 ms. The
 * difference is the draws, and the draws were the thing to cut.
 *
 * So the far tier is drawn at EVERY distance now, and the near tier is a kit
 * drawn on top of it, holding only what the far tier has not got: the see-
 * through glass (one layer, transparent), and one layer of everything else —
 * the cabin, the lamp inserts, the plate lettering, the grille bars, badges,
 * wipers and aerial — in one material (`CAR_KIT_GLSL`). The far tier gives up
 * its opaque glass and its wheels to the kit inside `CAR_KIT_M`, in the vertex
 * stage (`CAR_FAR_VERT`), and nothing else, so the silhouette is the same mesh
 * on both sides of the line. The wheels are one blob per WHEEL, not four per
 * car: baked once at the origin and stood at each axle end here, and shared by
 * every body type that runs it (the estate and the saloon run the same one).
 * Two draws a model with a car inside 30 m, and one per wheel; none otherwise.
 */
async function buildJadrijaCars(scene, sites) {
  const layers = [];
  let tris = 0, trisNear = 0;
  const counts = {};
  const _q = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3();
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  // The kit layers' steps (see `nearOnly`), run off every body layer's.
  const kitSteps = [];
  const wheels = new Map();

  const blob = async (key) => {
    const b64 = typeof PAYLOAD !== 'undefined' ? PAYLOAD[key] : null;
    if (!b64) return null;
    try {
      return readFR3D(await inflateBinary(b64));
    } catch (e) {
      console.warn('car failed:', key, e.message);
      return null;
    }
  };

  // One instanced layer over `items`: `{ pos, q, color, suit, hair }` each,
  // world space. The bounding sphere is over the positions, grown by the
  // geometry's own radius.
  const layer = (geo, items, fin, name) => {
    const L = propLayer(scene, geo, items.length, { spec: 0.08, specPower: 18 });
    if (fin) {
      L.mesh.material.dispose();
      L.mesh.material = carMaterials()[fin];
    }
    const suit = items[0].suit
      ? new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3) : null;
    const hair = items[0].hair
      ? new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3) : null;
    if (suit) L.geo.setAttribute('aInstSuit', suit);
    if (hair) L.geo.setAttribute('aInstHair', hair);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    items.forEach((it, i) => {
      L.aPos.array.set(it.pos, i * 3);
      L.aRot.array.set([it.q.x, it.q.y, it.q.z, it.q.w], i * 4);
      L.aScale.array.set([1, 1, 1], i * 3);
      L.aColor.array.set(it.color, i * 3);
      if (suit) suit.array.set(it.suit, i * 3);
      if (hair) hair.array.set(it.hair, i * 3);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], it.pos[k]);
        hi[k] = Math.max(hi[k], it.pos[k]);
      }
    });
    for (const a of [L.aPos, L.aRot, L.aScale, L.aColor, suit, hair]) if (a) a.needsUpdate = true;
    L.geo.instanceCount = items.length;
    // A real bounding sphere, and frustum culling switched back on. The
    // instance positions are world positions and the layer's mesh carries no
    // transform, so the sphere is simply the box round them grown by the
    // model's own radius. Left at `propLayer`'s 1e9 default the row is drawn
    // on every frame of the game, including the ones spent over the channel
    // with the resort three kilometres behind the aeroplane.
    L.geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3((lo[0] + hi[0]) * 0.5, (lo[1] + hi[1]) * 0.5, (lo[2] + hi[2]) * 0.5),
      Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.5
        + (geo.boundingSphere ? geo.boundingSphere.radius : 3));
    L.mesh.frustumCulled = true;
    L.mesh.name = name;
    layers.push(L);
    return L;
  };

  for (const model of CAR_MODELS) {
    const mine = sites.filter((s) => s.model === model.key);
    counts[model.key] = mine.length;
    if (!mine.length) continue;

    // The body and the far tier, all three or none: a body with no trim is a
    // car with no wheels, and one with no gloss is a car with no glass —
    // worse than the boxes before. The kit is all-or-nothing on its own;
    // without it the far tier draws every car all the way in, which is
    // 1.542.3 exactly, and the covered car has no kit at all.
    const base = 'car_' + model.key;
    const far = { body: await blob(base + '_fr3d'), gloss: await blob(base + '_gloss_fr3d'),
      trim: await blob(base + '_trim_fr3d') };
    if (!far.body || !far.gloss || !far.trim) { console.warn('no car payload:', base); continue; }
    const sz = carSize(model.key);
    const kit = sz.wheel && sz.wo ? { glass: await blob(base + '_nglass_fr3d'),
      det: await blob(base + '_ndet_fr3d') } : null;
    let wheel = null;
    if (kit && kit.glass && kit.det) {
      const wk = 'car_wheel_' + sz.wheel;
      if (!wheels.has(wk)) {
        const g = await blob(wk + '_fr3d');
        wheels.set(wk, g ? { geo: g, items: [] } : null);
      }
      wheel = wheels.get(wk);
    }
    const hasKit = !!wheel;
    const finish = mine.map((s) => carFinish(s, model));

    // Per car: where it stands, and what the far layers need to know to clear
    // the kit's space (`CAR_FAR_VERT`): the axles and the wheel's radius, the
    // wheels' lateral span, and whether it has a kit.
    const wo = sz.wo || [0, 0];
    const span = [Math.min(wo[0], wo[1]) - (sz.wd || 0) - 0.012, Math.max(wo[0], wo[1]) + 0.03];
    const cars = mine.map((s) => {
      // Roll about the model's X, pitch about its Z — see the shore build.
      _e.set(s.roll || 0, s.yaw, s.pitch || 0, 'YXZ');
      return { pos: [s.x, s.y, s.z], q: new THREE.Quaternion().setFromEuler(_e) };
    });
    const ax = sz.ax || CAR_FALLBACK.ax;
    const plan = [['body', far.body, model.matte ? null : 'paint'],
      ['gloss', far.gloss, 'gloss'], ['trim', far.trim, 'trim']];
    for (const [half, geo, fin] of plan) {
      // Only the paint is tinted. That is the whole point of the others
      // being layers of their own: 1.0 through the multiply leaves the baked
      // colours exactly as Blender wrote them. The finish, per car, on the
      // paint only: `aInstSuit` is the crowd's second colour, and the paint
      // reads it as (metallic, dust, sun-bleach).
      const items = cars.map((c, i) => ({
        pos: c.pos, q: c.q,
        color: half === 'body' ? mine[i].tint : [1, 1, 1],
        suit: half === 'body' ? finish[i] : [ax[0], ax[1], hasKit ? sz.r : -1],
        hair: half === 'body' ? null : [span[0], span[1], hasKit ? 1 : 0],
      }));
      const L = layer(geo, items, fin, base + '_' + half);
      tris += (geo.index.count / 3) * mine.length;
      trisNear += (geo.index.count / 3) * mine.length;
      nearOnly(L, mine.length);
      L.half = half;
      if (half === 'body') {
        // The kit's steps ride on the bodies', which are drawn whenever any
        // car of theirs is — see `nearOnly`.
        const own = L.mesh.onBeforeRender;
        L.mesh.onBeforeRender = () => { own(); for (const f of kitSteps) f(); };
      }
    }
    if (!hasKit) continue;

    // The kit: the glass, and everything else in one layer. `aInstSuit` is
    // the car's own position, which is what the vertex stage cuts on.
    const kitItems = cars.map((c) => ({ pos: c.pos, q: c.q, color: [1, 1, 1], suit: c.pos }));
    for (const [half, geo, fin] of [['nglass', kit.glass, 'glass'], ['ndet', kit.det, 'kit']]) {
      const L = layer(geo, kitItems, fin, base + '_' + half);
      if (fin === 'glass') L.mesh.renderOrder = 3;
      trisNear += (geo.index.count / 3) * mine.length;
      kitSteps.push(nearOnly(L, mine.length, 0, CAR_KIT_M + 4, 'aInstSuit'));
      L.half = half;
    }
    // And its four wheels, onto the shared wheel's list. The wheel is baked
    // with its axle on x = 0 and its outer face on z = 0, running inboard
    // toward +z: that is the right-hand wheel as it stands (model z = -Y in
    // Blender), so the right-hand pair goes on as they are at z = -outer, and
    // the left-hand pair turned half round about the vertical, which puts the
    // outer face out and the tread still on the ground, at z = +outer.
    for (const c of cars) {
      for (let k = 0; k < 2; k++) {
        for (const side of [1, -1]) {
          _v.set(ax[k], 0, -side * wo[k]).applyQuaternion(c.q);
          _q2.copy(c.q);
          if (side < 0) _q2.multiply(flip);
          wheel.items.push({ pos: [c.pos[0] + _v.x, c.pos[1] + _v.y, c.pos[2] + _v.z],
            q: _q2.clone(), color: [1, 1, 1], suit: c.pos });
        }
      }
    }
  }
  for (const [wk, w] of wheels) {
    if (!w || !w.items.length) continue;
    const L = layer(w.geo, w.items, 'kit', wk);
    trisNear += (w.geo.index.count / 3) * w.items.length;
    kitSteps.push(nearOnly(L, w.items.length, 0, CAR_KIT_M + 4, 'aInstSuit'));
    L.half = 'wheel';
  }
  // Nothing of the kit is drawn until a body has had its first look round.
  for (const L of layers) if (L.half === 'nglass' || L.half === 'ndet' || L.half === 'wheel') L.mesh.visible = false;

  // ── the dark under every car ────────────────────────────────────────────
  // What made the last row look parked on glass was not the wheels, which
  // touch the ground within 3 cm on every car (measured by raycast, 28 Sep),
  // but the ground UNDER the car, lit exactly as brightly as the ground beside
  // it. Under a real car it is nearly black — no sky reaches it — and that
  // dark footprint is how the eye reads contact. One soft ellipse per car,
  // one instanced draw for the whole row, blended over the ground and never
  // written to depth. It follows the car's pitch and roll, so it follows the
  // slope the car stands on.
  //
  // And, second pass, a darker spot where each tyre meets the ground. The
  // ellipse is the sky the car hides; the spot is the crease where a loaded
  // tyre sits on the gravel, and without it the wheels stood ON the ground
  // rather than in it. The four spots are placed off the model's own axles
  // and track (`carSize`), handed to the shader as quad-local fractions in
  // the instance colour, which this layer had spare.
  if (sites.length) {
    const q = new THREE.PlaneGeometry(1, 1, 1, 1);
    q.rotateX(-Math.PI / 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', q.attributes.position);
    g.setAttribute('normal', q.attributes.normal);
    g.setAttribute('aVCol', new THREE.BufferAttribute(new Float32Array(12).fill(1), 3));
    g.setIndex(q.index);
    const L = propLayer(scene, g, sites.length);
    L.mesh.material.dispose();
    L.mesh.material = solidMaterial(0x000000, {
      instanced: true, transparent: true, depthWrite: false,
      // Radial in the car's own frame (`vLocal` is the unit quad), so one
      // quad scaled per car is the right ellipse for every body.
      body: 'float cd = length(vLocal.xz * 2.0);\n'
        + '  alpha = 0.62 * (1.0 - smoothstep(0.35, 1.0, cd));\n'
        + '  vec2 cq = vLocal.xz, cs = vec2(0.070, 0.095);\n'
        + '  float cw = 1.0 - smoothstep(0.0, 1.0, length((cq - vColor.xz) / cs));\n'
        + '  cw = max(cw, 1.0 - smoothstep(0.0, 1.0, length((cq - vec2(vColor.x, -vColor.z)) / cs)));\n'
        + '  cw = max(cw, 1.0 - smoothstep(0.0, 1.0, length((cq - vColor.yz) / cs)));\n'
        + '  cw = max(cw, 1.0 - smoothstep(0.0, 1.0, length((cq - vec2(vColor.y, -vColor.z)) / cs)));\n'
        + '  alpha = max(alpha, 0.78 * cw);\n'
        + '  base = vec3(0.0); spec = 0.0; env = 0.0;',
    });
    L.mesh.renderOrder = 2;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    sites.forEach((s, i) => {
      const sz = carSize(s.model);
      _e.set(s.roll || 0, s.yaw, s.pitch || 0, 'YXZ');
      _q.setFromEuler(_e);
      // The footprint's middle, which is not the wheelbase centre.
      const mid = (sz.x0 + sz.x1) * 0.5;
      const off = new THREE.Vector3(mid, 0.045, 0).applyQuaternion(_q);
      const p = [s.x + off.x, s.y + off.y, s.z + off.z];
      const lx = (sz.x1 - sz.x0) * 1.12, lz = sz.hw * 2.3;
      const ax = sz.ax || CAR_FALLBACK.ax;
      L.aPos.array.set(p, i * 3);
      L.aRot.array.set([_q.x, _q.y, _q.z, _q.w], i * 4);
      L.aScale.array.set([lx, 1, lz], i * 3);
      L.aColor.array.set([(ax[1] - mid) / lx, (ax[0] - mid) / lx,
        (sz.tr || CAR_FALLBACK.tr) / lz], i * 3);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], p[k]);
        hi[k] = Math.max(hi[k], p[k]);
      }
    });
    for (const a of [L.aPos, L.aRot, L.aScale, L.aColor]) a.needsUpdate = true;
    L.geo.instanceCount = sites.length;
    L.geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3((lo[0] + hi[0]) * 0.5, (lo[1] + hi[1]) * 0.5, (lo[2] + hi[2]) * 0.5),
      Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.5 + 3);
    L.mesh.frustumCulled = true;
  }

  return {
    layers,
    /**
     * For the shadow pass in src/90-app.js — instanced, near cascade only. Not
     * the gloss layers: glass lets the sun through, so the cabin of a real
     * car throws a lighter shadow than its body, and a rim is inside its tyre.
     * Nor the kit: the far trim's wheels are cut out of the MAIN pass only
     * (the depth pass has its own vertex program), so every car keeps its
     * far wheels' shadow at every distance, and a seat or a lug nut under a
     * roof has no shadow anyone could see. The body and the far trim.
     */
    meshes: () => layers.filter((L) => L.half === 'body' || L.half === 'trim')
      .map((L) => L.mesh),
    count: sites.length,
    counts,
    tris,
    trisNear,
  };
}

/**
 * Which cars to leave out, so the row is two thirds of what the rules allow.
 *
 * *"perhaps decrease total numbers of cars by 33%"* (Misha, 28 Sep). Not every
 * third car: that is a thinned grid, and a car park is not thinned, it is
 * *filled* — people park near the path, in the shade, next to where somebody
 * else already did, and leave the far end empty. So each car gets a
 * popularity off two slow waves along the shore (64 m and 27 m) with a little
 * of the car's own hash on top, and the least popular third are not parked.
 * What is left is clumps of two to four with real gaps between them.
 *
 * `ts` is each car's `t`; `keep` marks cars that are never dropped (the one
 * under a cover — the car the footage makes a point of); `hash(t)` is the
 * caller's own `jit` on a slot of its choosing. Sine hashes, no `rng()`, so
 * nothing else on the beach moves.
 */
function carsToDrop(ts, keep, hash) {
  const pop = ts.map((t, i) => (keep[i] ? 99 : Math.sin(t * 0.0982 + 1.3)
    + 0.6 * Math.sin(t * 0.2327 + 0.4) + 0.35 * (hash(t) - 0.5)));
  const order = ts.map((_t, i) => i).sort((a, b) => pop[a] - pop[b]);
  return new Set(order.slice(0, Math.round(ts.length / 3)));
}
