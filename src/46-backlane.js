// -----------------------------------------------------------------------------
// The back lane, and the plots along it.
//
// Behind the resort's parking there is a made lane with houses on it, and until
// now the game had the houses and not the lane. The survey said so in one line —
// *"the back lane — two-storey pale yellow render, grey-green louvred shutters,
// vine pergola on green steel, cars nose-in against a low rubble-based wall. The
// game has houses there and no lane, no parking, no walls"* — and standing on
// that ground is exactly that: bare needle floor, pine trunks, and three
// property walls fronting nothing.
//
// ── what is measured and what is placed ───────────────────────────────────────
//
// v595 walks the whole of it, `a_006` to `a_054`, and it carries no GPS. So
// every OBJECT in this file comes off the footage and every POSITION in it is
// argued from something already in the build. The two are kept apart on purpose,
// because this shore has a file full of notes about which is which.
//
// The lane's BAND is not a free choice, and that is the part worth reading. Two
// numbers already in `src/43-jadrija.js` close on it from either side:
//
//   * the dust track behind the lane wall runs out at `WALL.s + 7.4` = 36.6, and
//     the note over the nose-in car row says its deepest possible tail is 37.1;
//   * the three frontage walls — `gardenWall` at t 224.0-239.5, `palisadeWall`
//     at 241.0-257.5 and `lavenderBank` at 259.0-291.0 — all stand on s 40.4,
//     and each is about a third of a metre thick, so their seaward face is at
//     40.23.
//
// That leaves a gap of 3.6 m between the resort's parking and the plot
// boundaries, which is a lane, and the car row's own note already calls it one:
// *"One nose-in row on the lane's seaward side is what fits."* The lane was
// implied by the code before it was drawn. What is placed here is that it exists
// at all, and how far it runs: t 214 to 340, which starts where the tarmac apron
// and the dust track both start and stops six metres short of the sanitary block
// and the trampoline compound at 346.4.
//
// The rest is placement and says so at each site: two more plot frontages, west
// of the garden wall and east of the lavender bank, on the same s 40.4 line the
// three existing ones are on and by the same argument they were placed under —
// that a house in Dalmatia has a boundary and these stand on bare sand.
//
// ── why it is not in `src/35-city.js` ─────────────────────────────────────────
//
// The plain white boxes with painted-on windows behind this lane are the town
// builder's, and they are right for thirteen thousand buildings seen from an
// aeroplane. Fixing twenty houses at Jadrija by changing the thing that draws
// Šibenik is the wrong lever. This is an overlay in the resort's own code, next
// to the resort's own kerb blocks, fence panels and boundary walls, which went
// in the same way and are recorded the same way.
//
// ── what is here ─────────────────────────────────────────────────────────────
//
// The carriageway with its limestone edging; the two boundary runs, on a
// rendered base at the west end and on field rubble at the east; a lay-by with
// five cars nose-in against the rubble, drawn through `src/44-cars.js` rather
// than by anything of this file's own; a vine pergola on green steel over them;
// the green barrier and the striped bollards where the made ground gives out
// into the wood; and a dressing pass over the town builder's own boxes behind
// it — which is half of what was wanted and says so where it is done.
//
// ── rule 4 ────────────────────────────────────────────────────────────────────
//
// Not one `rng()` draw anywhere in here. Everything jittered is jittered off
// `jit`, the sine hash, on slots 300-361 for this file's own work and 121-125
// for the car row — never on 21-25, which the shore build's own row uses, and
// which at a shared 4 m spacing would have drawn this row as that one's
// reflection. The census is the proof and it does not move: 446/333/86/27
// either side.
// -----------------------------------------------------------------------------

const LANE = {
  // Where it runs, along the shore. 214 is where `43-jadrija.js` starts the
  // tarmac apron and the dust track — the whole of the made ground behind this
  // resort begins on the same line, which is what a surfacing gang does. 340 is
  // six metres short of `SAN.t0` and `TRAMP.t0`; past that the resort owns the
  // band and the lane has nothing to front.
  t0: 214.0,
  t1: 340.0,
  // And across it. See the header: both edges are somebody else's number.
  //
  // 36.60 butts the dust track's last course exactly rather than lapping it.
  // Two co-planar surfaces two kilometres from the origin fight (rule 5) and
  // these do not overlap at all, so there is nothing to fight — but it does
  // mean the odd long tail out of the nose-in row overhangs the lane edge by up
  // to half a metre, which is what `a_030` and `a_033` have and is left alone.
  s0: 36.60,
  s1: 40.05,
  // The frontage the plot boundaries stand on, and the three that are already
  // on it. Read here rather than repeated: if the garden wall ever moves, the
  // lane's inland edge has to move with it.
  front: 40.4,
  // How much of the inland edge is limestone edging rather than carriageway.
  // `a_036` and `a_039` both have it: a strip of irregular flags laid against
  // the boundary, half a metre wide, that the concrete was poured up to.
  gutter: 0.62,
  /**
   * How high the pour stands over the dirt, and it is NOT a taste number.
   *
   * It went in at 0.038 — a hair over the dust track's 0.03 — and the lane was
   * invisible. Not dim, not the wrong colour: absent. Painted magenta at that
   * height nothing came back at all, and at 0.25 the whole strip came back at
   * once, which is what a surface *underneath* something looks like and not
   * what a surface with a colour problem looks like.
   *
   * What it is underneath is the terrain mesh, which is a different
   * tessellation of the same hillside and at this LOD sits about a tenth of a
   * metre over what `groundAt` reports. `36-roads.js` has known this the whole
   * time — `ROADS.lift` is 0.45 "to survive terrain LOD" — and the note over it
   * is the one that should have been read before this was drawn at 38 mm.
   *
   * 0.13 is the smallest step that clears it along the whole 126 m, checked at
   * both ends and from a hundred metres up the lane where the tile behind you
   * has already dropped an LOD. It is also not a fudge: a concrete lane poured
   * on dirt *does* stand about that proud of the dirt beside it, which is why
   * the strip is drawn as a slab with a skirt rather than as a sheet — see the
   * carriageway. A sheet at this height would float.
   *
   * The material carries `polygonOffset` as well, for the same reason the roads
   * do. The lift handles the geometry; the offset handles the z-buffer where
   * the two tessellations run nearly parallel.
   */
  lift: 0.13,
  /** How far the skirt runs below it, so no edge of this ever shows daylight. */
  skirt: 0.34,
};

/**
 * The lay-by, and it is A PLACEMENT.
 *
 * `a_018`, `a_030` and `a_033` all film the same arrangement: a house set back
 * behind its own apron with four or five cars nose-in against the boundary wall
 * and the lane running past their tails. The game has forty-eight cars behind
 * the kabine and every one of them faces the water, because they are the
 * resort's; nothing anywhere is parked at a house.
 *
 * So the frontage steps inland here — 40.4 out to 45.6 — and the five and a
 * half metres it opens up is the apron. t 302 to 332 is chosen and not
 * surveyed: it is the stretch east of the lavender bank where OSM's own
 * footprints thin out, so an apron there stands in front of a gap rather than
 * through somebody's wall.
 */
const LAYBY = { t0: 302.0, t1: 332.0, s: 45.6 };

/** The pergola's four legs, as a box, because the wood has to keep out of it. */
const PERG = { t0: LAYBY.t0 + 2.2, t1: LAYBY.t0 + 10.6, s0: 40.75, s1: 44.6 };

/**
 * The boundary runs this file adds, west and east of the three that exist.
 *
 * Three entries for two properties: the east one is in two lengths because the
 * lay-by's own frontage steps inland between them, and a run that walks `t`
 * cannot lay the returns that get it there — those are drawn separately below.
 */
const RUNS = [
  // West of `gardenWall`, which starts at 224.0. A rendered base with a black
  // bar railing on it — `a_006`, the clearest fence in the whole walk.
  { t0: 214.0, t1: 222.6, kind: 'render', gate: null },
  // East of `lavenderBank`, which stops at 291.0. Field rubble, because the
  // survey's line for this ground says *rubble-based* and because a fourth
  // masonry on this shore would be gilding — the approach piers at t 216 are
  // already built of exactly this stone and this is the same field.
  { t0: 292.6, t1: LAYBY.t0, kind: 'rubble', gate: [296.4, 299.0] },
  { t0: LAYBY.t1, t1: 338.4, kind: 'rubble', gate: null },
];

const LANE_COL = {
  /*
   * EVERY FLAT GROUND COLOUR IN HERE IS AN ALBEDO, NOT A PHOTOGRAPH.
   *
   * This block used to hold the numbers straight off the frames, and it was
   * wrong in a way no amount of re-reading the frames could show, because the
   * error is not in the frames. A photograph of concrete under a Dalmatian sky
   * ALREADY CONTAINS THAT SKY. Feed it back in as an albedo and the renderer
   * adds the sky a second time.
   *
   * Measured rather than argued. The pour was built flat at its own constant,
   * 1.000:0.969:0.929, and photographed from directly above at t 277 with the
   * strip masked off exactly (paint it magenta, threshold the frame, keep the
   * mask — 67,372 px of nothing but lane). It came back 1.000:1.054:1.114.
   * So this surface renders
   *
   *     T = [1.000, 1.088, 1.199]
   *
   * against its own albedo: eight per cent green-heavy and TWENTY per cent
   * blue-heavy. A warm concrete at R/B 1.076 leaves the screen at 0.898. The
   * lane was not a cool grey because anybody chose one; it was a warm grey with
   * the sky counted twice.
   *
   * So every flat number below is now the albedo that RENDERS at what the walk
   * measured, which is the frame value divided by T. They look absurd on the
   * page — the pour is a pale terracotta — and they are correct on the screen.
   * Check them by shooting, never by reading.
   *
   * The masonry is NOT corrected. T was calibrated on an up-facing surface,
   * which takes the whole sky hemisphere; a wall takes half of it and has its
   * own transform. `render`, `renderCap`, `stone`, `core`, `iron` and `steel`
   * are still frame values and still owe this same measurement.
   */
  // The carriageway.
  //
  // Measured as a RATIO and not as a number, which is the lesson the lavender
  // bank paid for. `a_024` has the lane at 188,174,158 in full sun with the
  // needle floor beside it at 157,123,102, and what separates them is not value
  // — it is that the floor's channels spread 1.00 : 0.79 : 0.65 and the lane's
  // spread 1.00 : 0.93 : 0.84. The lane is the flat one. `a_027` and `a_051`,
  // both shot into shade, agree: 143,143,146 and 143,137,135.
  //
  // So this is mixed flat and a step lighter than the resort's tarmac apron at
  // 0.348,0.338,0.318, and that difference is the point of building it: the
  // apron is twenty summers of asphalt and warm-grey, the lane is concrete and
  // cool-grey, and the seam between them is where the resort stops.
  road: [0.4930, 0.4309, 0.3703],
  // The crown, a shade darker. `a_024` has the wheel tracks and the middle
  // within one count of each other, so this is deliberately almost nothing —
  // 4%, which is a line you notice and cannot measure. Anything more is a
  // painted centre stripe, and this lane has none.
  crown: [0.4729, 0.4133, 0.3552],
  // The earth, tracked onto the pour — and this is the ground's single largest
  // surface, not a detail laid on it.
  //
  // Classified by red-over-blue across eight frames of the walk, the ground out
  // here falls in three populations and not two: cool pour at 1.000:0.985:0.982
  // for 34% of it, red earth at 1.000:0.825:0.634 for 21%, and BETWEEN those,
  // at 1.000:0.923:0.837, forty-four per cent of every frame. The build had one
  // per cent of that middle. Pour and earth met at a polygon edge and nothing
  // crossed it, which is why the ground read as two paints and not as a place.
  //
  // So this is the middle, held at the pour's own luminance less 4% — dust
  // darkens concrete a little — and carried a shade past the measured ratio to
  // 1.000:0.900:0.800, because it is the far end of a blend and not its mean.
  tracked: [0.5090, 0.4072, 0.3141],
  // The limestone edging. Warmer and darker than the pour it is laid against —
  // 174,161,144 off `a_036`, which against that frame's carriageway is about
  // 0.94 : 0.92 : 0.90.
  kerb: [0.4821, 0.4053, 0.3280],
  joint: [0.352, 0.330, 0.300],
  // Lumps of the old surface lying off the seaward edge. The apron already has
  // these and for the same reason: an edge somebody laid is straight and an
  // edge that broke is not.
  crumb: [0.4319, 0.3758, 0.3209],
  // Render on the west boundary's base wall. A newer wall than the lane wall
  // down at s 29.2, so a little paler than its 0.615.
  render: [0.648, 0.630, 0.592],
  renderCap: [0.552, 0.536, 0.494],
  // Field rubble, and these are the approach piers' own two colours: the stones
  // sit loose on the face and what shows between them is mortar in shadow.
  stone: [0.455, 0.428, 0.386],
  core: [0.330, 0.315, 0.288],
  // The railing. Near-black, a hair blue, and kept within a few per cent of the
  // garden wall's own railing at 0.082,0.084,0.090 — the two are a hundred and
  // fifty metres apart on one lane and are not two different blacks.
  iron: [0.076, 0.079, 0.086],
  // Painted steel, and it is GREEN.
  //
  // `a_048` has a welded-mesh panel fence on green posts and `a_051` has a
  // green tube barrier along the lane edge, both of them in deep shade at
  // 26,38,36 against foliage beside them at 53,60,57. Half the value of the
  // leaf and bluer than it: this is a moss green with a real blue lean, not the
  // yellow-green the shutters are painted. Mixed at 0.082,0.128,0.098 — the
  // shutter colour — it came out as more foliage.
  steel: [0.116, 0.178, 0.162],
  // Vine, over the pergola. Dark underneath and sunlit on top, which is the
  // whole of why a leaf mass reads as one.
  vineDk: [0.088, 0.176, 0.084],
  vineLt: [0.268, 0.412, 0.176],
  // The worn dust of the apron itself, where the tyres have taken the needles
  // off. The resort's own track is drawn in these; the same four, because it is
  // the same dirt.
  dust: [[0.5672, 0.4624, 0.3456], [0.5944, 0.4840, 0.3615],
    [0.5432, 0.4447, 0.3333], [0.6108, 0.4998, 0.3774]],
};

/**
 * The sine hash, again.
 *
 * The same two lines as `jit` in the shore build, and copied rather than
 * exported for the reason that note gives: this file is concatenated after that
 * one but the hash lives inside `buildJadrija`'s scope, and reaching down the
 * concatenation for it is rule 3 waiting to happen. Slots 300-399 are reserved
 * to this file so nothing here can collide with a draw taken in there.
 */
function laneJit(i, k) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function buildBackLane(scene, jad, city) {
  if (!jad || !jad.toWorld || !jad.blockers) return null;

  const jit = laneJit;
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // Two buffers, for the reason the shore build keeps two: the carriageway is
  // flat on the ground and casting a shadow map from it costs a draw and buys
  // nothing, while everything that stands up has to be in the caster list or
  // the fence is a line of floating black bars at seven in the evening.
  const floor = propBuilder();
  const up = propBuilder();
  let b = floor;

  // The shore frame, from the locale rather than from a second copy of it.
  // `toWorld` already answers with the surface height at (t, s), which out here
  // past `JAD.back` is the terrain — so a lane laid on it follows the hillside
  // for free and there is no second draping rule to get wrong.
  const P = (t, s, y) => {
    const w = jad.toWorld(t, s);
    return y == null ? w : [w[0], y, w[2]];
  };
  const gY = (t, s) => jad.toWorld(t, s)[1];

  /** The inland unit normal at `t`, for turning a car to face the boundary. */
  function normalAt(t) {
    const a = jad.toWorld(t, 0), c = jad.toWorld(t, 1);
    const nx = c[0] - a[0], nz = c[2] - a[2];
    const L = Math.hypot(nx, nz) || 1;
    return [nx / L, nz / L];
  }

  // `boxIn`'s vertex order out of the shore build, so the winding and the
  // normals match everything else on this lane.
  function boxTS(t0, t1, s0, s1, y0, y1, col, topCol) {
    const A = P(t0, s0, y0), B = P(t1, s0, y0);
    const C = P(t1, s1, y0), D = P(t0, s1, y0);
    const a = [A[0], y1, A[2]], q = [B[0], y1, B[2]];
    const c = [C[0], y1, C[2]], d = [D[0], y1, D[2]];
    b.quad(a, q, c, d, topCol || col);
    b.quad(D, C, B, A, col);
    b.quad(A, B, q, a, col);
    b.quad(C, D, d, c, col);
    b.quad(B, C, c, q, col);
    b.quad(D, A, a, d, col);
  }

  /** A round upright: `n` sides, from `y0` to `y1`, radius in metres. */
  function tubeTS(t, s, y0, y1, r, col, n = 6) {
    // The radius is in world metres and `t`/`s` are the frame's own units,
    // which are metres here as well — the shore is parameterised by its own arc
    // length and `s` is a true offset. So no scale conversion, unlike the
    // palisade's pales, which have to be converted because they are *counted*
    // along a trapezium rather than placed on it.
    const ring = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      ring.push([t + Math.cos(a) * r, s + Math.sin(a) * r]);
    }
    for (let k = 0; k < n; k++) {
      const [t0, s0] = ring[k], [t1, s1] = ring[(k + 1) % n];
      b.quad(P(t0, s0, y0), P(t1, s1, y0), P(t1, s1, y1), P(t0, s0, y1),
        shade(col, 0.94 + 0.12 * (k / n)));
    }
    const cap = ring.map(([tt, ss]) => P(tt, ss, y1));
    for (let k = 1; k < n - 1; k++) b.tri(cap[0], cap[k], cap[k + 1], col);
  }

  /**
   * A knocked-about ellipsoid of leaf, with soft normals.
   *
   * Written flat in world space rather than in the shore frame, because a vine
   * is a lump and not a length of anything — and because `smooth` wants a
   * normal the un-dented ellipsoid would have had, which is cheapest to take
   * where the ellipsoid is round.
   */
  function leaf(cx, cy, cz, rx, ry, rz, key, nu = 8, nv = 5) {
    const V = [];
    for (let j = 0; j <= nv; j++) {
      const ph = (j / nv) * Math.PI;
      const row = [];
      for (let i = 0; i <= nu; i++) {
        const th = (i / nu) * TAU;
        const sx = Math.sin(ph) * Math.cos(th);
        const sy = Math.cos(ph);
        const sz = Math.sin(ph) * Math.sin(th);
        // The dent, and it is per-vertex rather than per-face: a vine read from
        // the lane is an outline, and an outline is what the dents are for.
        const d = 0.74 + jit(key * 61 + j * 13 + (i % nu), 341) * 0.52;
        const lit = sat(sy * 0.5 + 0.5);
        row.push({
          p: [cx + sx * rx * d, cy + sy * ry * d, cz + sz * rz * d],
          n: [sx, sy, sz],
          c: [lerp(LANE_COL.vineDk[0], LANE_COL.vineLt[0], lit),
            lerp(LANE_COL.vineDk[1], LANE_COL.vineLt[1], lit),
            lerp(LANE_COL.vineDk[2], LANE_COL.vineLt[2], lit)],
        });
      }
      V.push(row);
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const A = V[j][i], B2 = V[j][i + 1], C = V[j + 1][i + 1], D = V[j + 1][i];
        b.smooth(A.p, B2.p, C.p, A.n, B2.n, C.n, A.c, B2.c, C.c);
        b.smooth(A.p, C.p, D.p, A.n, C.n, D.n, A.c, C.c, D.c);
      }
    }
  }

  // Everything that stands up and is bigger than a bollard, for `confine`.
  const runs = [];
  const block = (t0, t1, s0, s1, y, h) => runs.push({
    t: (t0 + t1) * 0.5, s: (s0 + s1) * 0.5,
    a: (t1 - t0) * 0.5, c: (s1 - s0) * 0.5, h, y,
  });

  // ── the carriageway ────────────────────────────────────────────────────────
  //
  // Three courses across, cut station to station along it. Not one quad per
  // bay: the lane falls three quarters of a metre over the hundred and twenty-
  // six it runs and rises over the same distance across itself, and a quad that
  // wide takes the average of its own corners and comes out as a plane laid on
  // a hillside.
  {
    const SEAM = LANE.s1 - LANE.gutter;
    /**
     * The trees that were already standing where the lane goes.
     *
     * Three of them, and finding out how was the whole of an afternoon: the
     * first build had a pine trunk dead in the middle of the carriageway at
     * t 220 and two more half on it at 254.7 and 262.2. The grove keep-out
     * further down was written for the darted wood and does nothing about
     * these, because these are not darted — they are the shore build's OWN
     * hand-placed trees, in `greens`, put in the wood years before there was a
     * lane to be in the way of.
     *
     * They are not moved, and that is not laziness. Moving one means reaching
     * into `43-jadrija.js` for a list that the blocker pass, the shadow pass
     * and the aerial all read, to get a tree out of the way of a road that did
     * not exist when it was planted — which is backwards. What happens in the
     * real place when a pour meets a tree that was there first is that the pour
     * stops: `a_036` and `a_051` both have a pine hard against the edge of the
     * concrete with a bare ring of needles round its foot, and `a_054` has the
     * lane narrowing between two of them.
     *
     * So the carriageway is cut round them. Found from the locale's own blocker
     * list rather than from a copy of the tree layout — tall, thin, unrotated
     * and in the band is a trunk and is nothing else on this shore — and read
     * here, before anything of this file's own has been pushed into it.
     */
    const trunks = [];
    for (const bl of jad.blockers) {
      if (bl.rot != null || bl.h < 3 || bl.a > 0.9 || bl.c > 0.9) continue;
      if (bl.t < LANE.t0 - 3 || bl.t > LANE.t1 + 3) continue;
      if (bl.s < LANE.s0 - 1.2 || bl.s > LANE.s1 + 1.2) continue;
      // The bare ring: the trunk's own half-width and a boot's width of dirt.
      trunks.push({ t: bl.t, s: bl.s, r: Math.max(bl.a, bl.c) + 0.42 });
    }
    const clear = (t, sv) => {
      for (const k of trunks) {
        const dt = t - k.t, ds = sv - k.s;
        if (dt * dt + ds * ds < k.r * k.r) return false;
      }
      return true;
    };
    // 0.86 by 0.475 cells, which is finer than the pour needs and exactly as
    // fine as the holes do: at the 1.55 by 0.94 this started on, a 0.84 m
    // trunk took a three-metre bite out of the lane.
    const STEP = 0.86, NC = 6;
    for (let t = LANE.t0; t < LANE.t1 - 0.01; t += STEP) {
      const t1 = Math.min(t + STEP, LANE.t1);
      const k = (t * 0.5) | 0;
      let poured = 0;
      for (let c = 0; c < NC; c++) {
        // Two wheel tracks and the crown between them, at three cells each.
        // The cut lines are jittered a hand's breadth per bay so the strip is
        // not six ruled stripes — a lane somebody poured in one go still
        // wanders, because the shuttering did.
        const w = (SEAM - LANE.s0) / NC;
        const a0 = c === 0 ? LANE.s0
          : LANE.s0 + w * c + (jit(k, 300 + c) - 0.5) * 0.20;
        const a1 = c === NC - 1 ? SEAM
          : LANE.s0 + w * (c + 1) + (jit(k, 301 + c) - 0.5) * 0.20;
        if (!clear((t + t1) * 0.5, (a0 + a1) * 0.5)) continue;
        poured++;
        const base = (c === 2 || c === 3) ? LANE_COL.crown : LANE_COL.road;
        // A pour is not one colour along its length either. 5%, which is the
        // width of the band the three frames disagree over.
        const g = 0.955 + jit(k * 7 + c, 305) * 0.095;
        // And it is not one colour ACROSS, which is the whole of what was wrong
        // with it. See `tracked`. The earth comes up onto the pour at both long
        // edges — hard at the seaward one, because that is the side the cars
        // cross — so the colour ramps in from each edge, and the strength of
        // the ramp wanders along the lane in two octaves. Patchy and not two
        // ruled stripes: a lane is dirtiest where somebody turned on it.
        const u = (c + 0.5) / NC;
        const along = 0.40 + 0.62
          * (0.66 * jit(k, 317) + 0.34 * jit(k >> 2, 318));
        const wash = Math.min(0.90, along
          * (Math.max(0, 1 - u / 0.42)
            + Math.max(0, 1 - (1 - u) / 0.28) * 0.66));
        const col = [base[0] * g * (1 - wash) + LANE_COL.tracked[0] * wash,
          base[1] * g * (1 - wash) + LANE_COL.tracked[1] * wash,
          base[2] * g * (1 - wash) + LANE_COL.tracked[2] * wash];
        b.quad(P(t, a0, gY(t, a0) + LANE.lift),
          P(t1, a0, gY(t1, a0) + LANE.lift),
          P(t1, a1, gY(t1, a1) + LANE.lift),
          P(t, a1, gY(t, a1) + LANE.lift), col);
      }
      if (!poured) continue;
      // The two long edges, dropped into the dirt. This is what makes the lift
      // honest: the strip is a pour with a thickness, so from down the lane you
      // read a concrete edge standing over the needle floor — which is `a_051`
      // and `a_054` exactly — rather than a sheet hovering over it.
      const edge = shade(LANE_COL.road, 0.86);
      for (const [sv, sgn] of [[LANE.s0, -1], [LANE.s1, 1]]) {
        if (!clear((t + t1) * 0.5, sv)) continue;
        const y0 = gY(t, sv), y1 = gY(t1, sv);
        const A = P(t, sv, y0 + LANE.lift), B2 = P(t1, sv, y1 + LANE.lift);
        const C = P(t1, sv, y1 - LANE.skirt), D = P(t, sv, y0 - LANE.skirt);
        if (sgn < 0) b.quad(A, B2, C, D, edge);
        else b.quad(D, C, B2, A, edge);
      }
    }

    // ── the limestone edging ─────────────────────────────────────────────
    //
    // Laid as flags with a joint between them, and the joint is what makes it
    // read as stone rather than as a painted margin — the same finding the
    // promenade's crazy paving is built on. It stands 0.022 m over the pour,
    // which is not a rule-5 problem: the two surfaces butt at `SEAM` rather
    // than lapping, and the flag's own foot closes the step.
    const FLAG = 0.72;
    for (let t = LANE.t0; t < LANE.t1 - 0.01; t += FLAG) {
      const t1 = Math.min(t + FLAG, LANE.t1);
      const key = (t * 3) | 0;
      const jn = 0.035;
      const s0 = SEAM + (jit(key, 310) - 0.5) * 0.09;
      // Round the trunks, same as the pour: an edging that runs on through a
      // pine reads worse than the hole does.
      if (!clear((t + t1) * 0.5, (s0 + LANE.s1) * 0.5)) continue;
      const y0 = gY(t, s0) + LANE.lift;
      const y1 = gY(t1, s0) + LANE.lift;
      // The bed the flags sit in, drawn full width so the joints have
      // something dark behind them.
      b.quad(P(t, s0, y0 + 0.006), P(t1, s0, y1 + 0.006),
        P(t1, LANE.s1, gY(t1, LANE.s1) + LANE.lift + 0.006),
        P(t, LANE.s1, gY(t, LANE.s1) + LANE.lift + 0.006), LANE_COL.joint);
      const g = 0.88 + jit(key, 311) * 0.26;
      const col = [LANE_COL.kerb[0] * g, LANE_COL.kerb[1] * g,
        LANE_COL.kerb[2] * g];
      // The flag itself: a slab, so the riser between it and the pour is a
      // real face with a real normal and takes a real shadow.
      boxTS(t + jn, t1 - jn, s0 + 0.03, LANE.s1 - 0.02,
        gY((t + t1) * 0.5, s0) - LANE.skirt,
        gY((t + t1) * 0.5, s0) + LANE.lift + 0.022, shade(col, 0.92), col);
    }

    // ── and the seaward edge, broken ─────────────────────────────────────
    //
    // The apron down at s 33 already crumbles into the gravel and this does
    // the same where it meets the dust. Half a dozen lumps to the ten metres,
    // in the buffer that casts, because a lump that throws no shadow is a
    // stain.
    b = up;
    for (let t = LANE.t0 + 0.4; t < LANE.t1; t += 1.15) {
      if (jit((t * 4) | 0, 315) > 0.44) continue;
      const s = LANE.s0 + (jit((t * 4) | 0, 316) - 0.5) * 0.55;
      const r = 0.070 + jit((t * 4) | 0, 317) * 0.075;
      const y = gY(t, s);
      const g = 0.90 + jit((t * 4) | 0, 318) * 0.22;
      tubeTS(t, s, y - 0.03, y + r * 0.62, r, shade(LANE_COL.crumb, g), 5);
    }
    b = floor;
  }

  // ── the plot boundaries ────────────────────────────────────────────────────
  /**
   * A low base wall with a black bar railing standing on it.
   *
   * `a_006` is the frame this is built from and it is square on: a rendered
   * base about a third of a metre out of the ground, and on it a railing of
   * plain round bars with a flat top rail, a lighter rail near the foot, and a
   * heavier square post every couple of metres. Nothing decorative on it at all
   * — no finials, no scrollwork, no pattern. `a_018` and `a_030` have the same
   * fence again on a rubble base instead of a rendered one, which is the only
   * difference between the two runs this file lays.
   *
   * The base is built in level lengths that step at the joint, which is what
   * every other wall on this shore does and for the reason the garden wall's
   * note gives: a wall that follows a falling grade is a ramp with a face on it.
   */
  function boundary(t0, t1, kind, gate, s = LANE.front) {
    const rubble = kind === 'rubble';
    const AW = rubble ? 0.185 : 0.150;      // half the base's thickness
    const RUN = 3.4;
    const open = (t) => gate && t > gate[0] - 0.05 && t < gate[1] + 0.05;
    for (let a = t0; a < t1 - 0.01; a += RUN) {
      const c = Math.min(a + RUN, t1);
      if (open(a) && open(c)) continue;
      let hi = -1e9;
      for (let u = a; u <= c; u += 0.55) hi = Math.max(hi, gY(u, s));
      // Quantised to the course, so two neighbouring lengths step by a whole
      // stone and not by four millimetres.
      const top = Math.round((hi + 0.42) / 0.14) * 0.14;
      const base = gY((a + c) * 0.5, s) - 0.32;
      const key = (a * 9) | 0;

      if (rubble) {
        // Core first, dark, because what shows between field stones is mortar
        // in shadow — the approach piers found this and it is the same wall.
        boxTS(a, c, s - AW + 0.055, s + AW - 0.055, base, top - 0.03,
          LANE_COL.core, shade(LANE_COL.core, 1.06));
        // The stones, turned every way. Rounded field limestone, no two the
        // same, sitting proud of the core rather than tiled flat on it.
        for (let k = 0; k < 44; k++) {
          const u = jit(key * 3 + k, 320);
          const tt = a + 0.11 + u * (c - a - 0.22);
          const yy = base + 0.10 + jit(key * 3 + k, 321) * (top - base - 0.20);
          const r = 0.062 + jit(key * 3 + k, 322) * 0.058;
          const face = k % 2 ? s + AW - 0.055 : s - AW + 0.055;
          const g = 0.86 + jit(key * 3 + k, 323) * 0.30;
          const col = [LANE_COL.stone[0] * g, LANE_COL.stone[1] * g,
            LANE_COL.stone[2] * g];
          // Along the face and not across it: the stone's long axis is
          // horizontal on nearly all of them, which is how a waller lays.
          boxTS(tt - r * 1.35, tt + r * 1.35, face - 0.055, face + 0.055,
            yy - r * 0.78, yy + r * 0.78, col, shade(col, 1.08));
        }
      } else {
        boxTS(a, c, s - AW, s + AW, base, top - 0.055,
          LANE_COL.render, shade(LANE_COL.render, 1.04));
        // Render is one flat sheet and reads like one, so the cap is what has
        // to do the work: a dressed course oversailing both faces, which is
        // the only horizontal on it and therefore the only shadow line.
      }
      const CO = rubble ? 0.055 : 0.070;
      boxTS(a, c, s - AW - CO, s + AW + CO, top - 0.055, top,
        shade(rubble ? LANE_COL.stone : LANE_COL.renderCap, 0.94),
        shade(rubble ? LANE_COL.stone : LANE_COL.renderCap, 1.09));
      block(a, c, s - AW - CO - 0.02, s + AW + CO + 0.02, base, top - base);

      // ── the railing ────────────────────────────────────────────────────
      if (open((a + c) * 0.5)) continue;
      const back = b;
      b = up;
      const IR = LANE_COL.iron;
      const rt = top + 0.98;
      // Two rails and a foot rail. The top one is flat bar laid on edge, which
      // is what catches the sun along a whole run and is the line you actually
      // see from down the lane.
      boxTS(a, c, s - 0.021, s + 0.021, rt - 0.045, rt + 0.015, IR,
        shade(IR, 1.9));
      boxTS(a, c, s - 0.016, s + 0.016, top + 0.115, top + 0.155, IR,
        shade(IR, 1.5));
      // The bars. 0.118 m apart, which is 52 mm of steel and 66 mm of daylight
      // — measured against the 0.98 m the railing stands, which the frame gives
      // as 8.4 gaps to the metre.
      const PITCH = 0.118;
      const n = Math.max(1, Math.round((c - a - 0.14) / PITCH));
      for (let k = 0; k <= n; k++) {
        const tt = a + 0.07 + (c - a - 0.14) * (k / n);
        boxTS(tt - 0.0155, tt + 0.0155, s - 0.0155, s + 0.0155,
          top + 0.02, rt - 0.02, IR, shade(IR, 1.7));
      }
      // And the posts, heavier and square, standing a little over the rail.
      for (let tt = a; tt <= c + 0.01; tt += 2.35) {
        const u = Math.min(tt, c - 0.05);
        boxTS(u - 0.042, u + 0.042, s - 0.042, s + 0.042,
          top - 0.02, rt + 0.075, shade(IR, 1.2), shade(IR, 2.2));
      }
      block(a, c, s - 0.10, s + 0.10, top, 1.05);
      b = back;
    }
  }

  for (const R of RUNS) boundary(R.t0, R.t1, R.kind, R.gate);

  // The lay-by's own boundary: the same rubble wall, stepped inland, with the
  // two returns that get it there. Without the returns the run stops on a hole
  // and the wall reads as two walls.
  boundary(LAYBY.t0, LAYBY.t1, 'rubble', null, LAYBY.s);
  {
    const back = b;
    b = up;
    // The returns are drawn on the `s` axis, so `boundary` cannot lay them —
    // it walks `t`. Two short lengths of the same rubble, capped the same.
    for (const [tt, s0, s1] of [[LAYBY.t0, LANE.front, LAYBY.s],
      [LAYBY.t1, LANE.front, LAYBY.s]]) {
      const hi = Math.max(gY(tt, s0), gY(tt, s1));
      const top = Math.round((hi + 0.42) / 0.14) * 0.14;
      const base = Math.min(gY(tt, s0), gY(tt, s1)) - 0.32;
      boxTS(tt - 0.185, tt + 0.185, s0, s1, base, top - 0.055,
        LANE_COL.core, shade(LANE_COL.core, 1.06));
      for (let k = 0; k < 26; k++) {
        const yy = base + 0.10 + jit(k * 7 + (tt | 0), 325) * (top - base - 0.20);
        const ss = s0 + 0.11 + jit(k * 7 + (tt | 0), 326) * (s1 - s0 - 0.22);
        const r = 0.062 + jit(k * 7 + (tt | 0), 327) * 0.055;
        const face = k % 2 ? tt + 0.13 : tt - 0.13;
        const g = 0.86 + jit(k * 7 + (tt | 0), 328) * 0.30;
        const col = shade(LANE_COL.stone, g);
        boxTS(face - 0.055, face + 0.055, ss - r * 1.35, ss + r * 1.35,
          yy - r * 0.78, yy + r * 0.78, col, shade(col, 1.08));
      }
      boxTS(tt - 0.24, tt + 0.24, s0, s1, top - 0.055, top,
        shade(LANE_COL.stone, 0.94), shade(LANE_COL.stone, 1.09));
      block(tt - 0.26, tt + 0.26, s0, s1, base, top - base);
    }
    b = back;
  }

  // ── the apron the cars stand on ────────────────────────────────────────────
  //
  // Not a pavement. `a_030` and `a_033` both film this and it is bare dirt worn
  // down to dust by the turning, with the needle litter pushed to the edges —
  // which is exactly what the resort's own track is drawn as behind the lane
  // wall, in the same four colours, because it is the same dirt.
  {
    const step = 2.4, nS = 2;
    for (let t = LAYBY.t0; t < LAYBY.t1 - 0.01; t += step) {
      const t1 = Math.min(t + step, LAYBY.t1);
      for (let k = 0; k < nS; k++) {
        const a0 = LANE.s1 + (LAYBY.s - 0.4 - LANE.s1) * (k / nS)
          + (jit(t | 0, 330 + k) - 0.5) * 0.7;
        const a1 = k === nS - 1 ? LAYBY.s - 0.4
          : LANE.s1 + (LAYBY.s - 0.4 - LANE.s1) * ((k + 1) / nS)
            + (jit(t | 0, 332 + k) - 0.5) * 0.7;
        const c = LANE_COL.dust[((jit(t | 0, 334 + k) * 97) | 0)
          % LANE_COL.dust.length];
        b.quad(P(t, a0, gY(t, a0) + 0.028), P(t1, a0, gY(t1, a0) + 0.028),
          P(t1, a1, gY(t1, a1) + 0.028), P(t, a1, gY(t, a1) + 0.028), c);
      }
    }
  }

  // ── the vine pergola ───────────────────────────────────────────────────────
  /**
   * Green steel and a vine over it, standing over the parked cars.
   *
   * `a_012` and `a_015` are the two frames: a frame of square steel tube on
   * four legs with wire strained across the top of it, a grapevine grown right
   * over the wire, and cars parked underneath in its shade. `a_012`'s own frame
   * is rust-red rather than green — that is a different property, and the
   * survey's line for this ground says green, which `a_048`'s mesh fence and
   * `a_051`'s barrier both are. Two properties, two paints.
   *
   * The beam stands at 2.45 m, which is what clears the tallest of the five car
   * models at 1.90 with a hand's breadth over the roof box. Placed over the west
   * half of the apron, because that is the half the lane looks straight into
   * coming down it.
   */
  {
    const back = b;
    b = up;
    const P0 = PERG.t0, P1 = PERG.t1;
    const SA = PERG.s0, SB = PERG.s1;
    const ST = LANE_COL.steel;
    const beam = 2.45;
    for (const tt of [P0, P1]) {
      for (const ss of [SA, SB]) {
        const y = gY(tt, ss);
        // A pad under each leg. Every post in the world stands on one and it is
        // the one thing that stops a steel frame reading as pushed into sand.
        boxTS(tt - 0.13, tt + 0.13, ss - 0.13, ss + 0.13, y - 0.10, y + 0.055,
          [0.560, 0.545, 0.512], [0.605, 0.590, 0.556]);
        // 0.09 m of section, and it was 0.076 and disappeared. Under a vine
        // this deep the leg is in its own shade for the whole of its length,
        // and a dark green post 76 mm wide seen against a dark green mass at
        // three metres is not a thin post, it is no post — the first cut read
        // as a hedge floating over a car park. What makes a pergola a pergola
        // is that you can see it is HELD UP.
        boxTS(tt - 0.045, tt + 0.045, ss - 0.045, ss + 0.045, y + 0.02,
          gY(tt, ss) + beam, ST, shade(ST, 1.25));
        block(tt - 0.12, tt + 0.12, ss - 0.12, ss + 0.12, y, beam);
      }
      // The cross-beams, over the legs.
      boxTS(tt - 0.052, tt + 0.052, SA - 0.10, SB + 0.10,
        gY(tt, (SA + SB) * 0.5) + beam - 0.085,
        gY(tt, (SA + SB) * 0.5) + beam, ST, shade(ST, 1.3));
    }
    for (const ss of [SA, SB]) {
      boxTS(P0 - 0.10, P1 + 0.10, ss - 0.048, ss + 0.048,
        gY((P0 + P1) * 0.5, ss) + beam - 0.075,
        gY((P0 + P1) * 0.5, ss) + beam + 0.010, ST, shade(ST, 1.3));
    }
    // The wire the vine is trained on: five strands across, thin enough that
    // what you read is the vine and not the frame.
    for (let k = 1; k < 6; k++) {
      const ss = SA + (SB - SA) * (k / 6);
      boxTS(P0, P1, ss - 0.008, ss + 0.008,
        gY((P0 + P1) * 0.5, ss) + beam + 0.010,
        gY((P0 + P1) * 0.5, ss) + beam + 0.026, shade(ST, 0.8));
    }
    // And the vine. A run of overlapping lumps rather than one slab, because a
    // grapevine grown over a frame is thick where it was tied and thin where it
    // was not — a slab reads as an awning, which is what the first cut was.
    for (let tt = P0 - 0.2; tt < P1 + 0.3; tt += 0.72) {
      for (let ss = SA - 0.1; ss < SB + 0.2; ss += 0.76) {
        const key = ((tt * 5) | 0) * 31 + ((ss * 5) | 0);
        // One lump in six is missing, and that is the difference between a
        // vine and a hedge laid on a frame. A grapevine trained over wire is
        // thick where it was tied and bare where it was not, and it is the
        // holes that let you see the steel and the sky through it — with the
        // mat closed the whole thing read as an awning somebody bought.
        if (jit(key, 351) > 0.84) continue;
        // Flatter than it was, too: 0.20 of half-height on a 0.60 lump gave a
        // ceiling of green boulders. A vine over wire is a LAYER.
        const y = gY(tt, ss) + beam + 0.055 + jit(key, 345) * 0.10;
        const w = jad.toWorld(tt + (jit(key, 346) - 0.5) * 0.26,
          ss + (jit(key, 347) - 0.5) * 0.26);
        leaf(w[0], y, w[2], 0.52 + jit(key, 348) * 0.20,
          0.125 + jit(key, 349) * 0.065, 0.52 + jit(key, 350) * 0.20, key);
      }
    }
    // Two shoots hanging off the seaward edge, which is the detail that says
    // the thing is alive and not a canopy somebody bought.
    for (const [tt, ss, d] of [[P0 + 1.4, SA - 0.15, 0.55], [P1 - 2.1, SA - 0.2, 0.85]]) {
      const w = jad.toWorld(tt, ss);
      leaf(w[0], gY(tt, ss) + beam - d, w[2], 0.30, 0.34, 0.26,
        ((tt * 7) | 0) + 11);
    }
    b = back;
  }

  // ── what is parked against the wall ────────────────────────────────────────
  /**
   * Nose-in, facing the boundary, which is the whole point of them.
   *
   * The resort's forty-eight all face the water because they are the resort's;
   * these face inland because they belong to the house. `src/44-cars.js` draws
   * both — `buildJadrijaCars` takes a site list and builds its own layers, so
   * calling it a second time costs ten instanced draws for six cars and reuses
   * every line of the model table, the paint weights and the bounding-sphere
   * work. Rewriting a car here would have been the wrong lever twice over.
   *
   * The hash slots are 121-125 rather than the shore build's 21-25, and that
   * matters: the row up here steps 4.0 m like the one down there, so on the
   * shared slots the two would have drawn the same models in the same order and
   * this would read as the car park's reflection.
   */
  const carSites = [];
  {
    for (let t = LAYBY.t0 + 3.4; t < LAYBY.t1 - 2.4; t += 4.0) {
      if (jit(t | 0, 121) > 0.86) continue;
      const model = carModelFor(jit(t | 0, 125));
      const size = carSize(model.key);
      const len = size.x1 - size.x0;
      // The nose stops a hand's breadth off the wall's seaward face. The wall
      // centre is `LAYBY.s`, half its thickness is 0.185, and the cap
      // oversails it by 0.055 — so 0.30 of clearance puts the bumper under the
      // cap and not through it.
      const nose = LAYBY.s - 0.185 - 0.055 - 0.30 - jit(t | 0, 123) * 0.35;
      const tail = nose - len;
      const y = gY(t, nose - len * 0.5);
      const tint = CAR_PAINT[model.paint[
        ((jit(t | 0, 124) * 97) | 0) % model.paint.length]];
      // The model's origin is the wheelbase centre and its +X is the nose, so
      // the origin stands `x1` behind the bumper. A yaw of `a` sends +X to
      // (cos a, -sin a) and the nose has to look along +(nx, nz), which is the
      // shore normal — the exact mirror of the row behind the kabine.
      const [nx, nz] = normalAt(t);
      const [x, , z] = P(t, nose - size.x1, y);
      carSites.push({ x, y, z, model: model.key, tint,
        yaw: Math.atan2(-nz, nx) });
      block(t - size.hw - 0.06, t + size.hw + 0.06, tail - 0.1, nose + 0.1,
        y, size.h);
    }
  }

  // ── the seam where the lane gives out into the wood ────────────────────────
  /**
   * Green tube barriers and striped bollards, and this is `a_051` and `a_054`.
   *
   * Where the lane runs out at either end there is a low green steel barrier —
   * two horizontal tubes on uprights, knee to hip — holding cars off the needle
   * floor, and a run of red-and-white bollards along the edge beside it. Both
   * are the same object: they say "the made ground stops here", which is the
   * only thing at either end of this lane that needs saying.
   *
   * NO COLLIDER on the bollards, for the reason the wood-edge kerb blocks have
   * none: `GROUND.girth` is 0.55 and `confine` adds it to every half-extent, so
   * a line of 0.06 m posts at 1.4 m centres comes out as a sealed wall across
   * the band the crowd, the cars and the walker all cross. The barrier itself
   * is a single 4 m object with real gaps either side of it and does get one.
   */
  {
    const back = b;
    b = up;
    const ST = LANE_COL.steel;
    for (const [t0, t1] of [[LANE.t0 + 1.2, LANE.t0 + 5.4],
      [LANE.t1 - 5.6, LANE.t1 - 1.4]]) {
      const s = LANE.s0 - 0.35;
      const y0 = gY(t0, s), y1 = gY(t1, s);
      const h = 0.92;
      for (const tt of [t0, (t0 + t1) * 0.5, t1]) {
        tubeTS(tt, s, gY(tt, s) - 0.12, gY(tt, s) + h, 0.036, ST, 6);
      }
      for (const r of [h, h * 0.56]) {
        boxTS(t0, t1, s - 0.030, s + 0.030,
          (y0 + y1) * 0.5 + r - 0.030, (y0 + y1) * 0.5 + r + 0.030,
          ST, shade(ST, 1.3));
      }
      block(t0, t1, s - 0.12, s + 0.12, (y0 + y1) * 0.5, h);
    }
    // The bollards. Red and white in bands, which is two boxes and not a
    // texture — rule 12 does not come into it, there is no lettering on them.
    for (const [t0, t1] of [[LANE.t0 + 6.6, LANE.t0 + 13.6],
      [LANE.t1 - 13.4, LANE.t1 - 6.4]]) {
      for (let tt = t0; tt <= t1 + 0.01; tt += 1.45) {
        const s = LANE.s0 - 0.28;
        const y = gY(tt, s);
        const H = 0.86;
        for (let k = 0; k < 5; k++) {
          const col = k % 2 ? [0.520, 0.088, 0.078] : [0.855, 0.842, 0.822];
          tubeTS(tt, s, y + H * (k / 5), y + H * ((k + 1) / 5), 0.038,
            col, 6);
        }
      }
    }
    b = back;
  }

  // ── the houses along it ────────────────────────────────────────────────────
  /**
   * Dressing the town builder's own boxes, in place — and what could not be.
   *
   * The houses behind this lane are the ones the survey calls *"two-storey pale
   * yellow render, grey-green louvred shutters"*, and what stands there is a
   * white box with black rectangles painted on it. `43-jadrija.js` already
   * rebuilds the twenty-seven houses inside 64 m of the water properly; these
   * are the survivors past that line, drawn by `35-city.js` along with the
   * other thirteen thousand.
   *
   * TWO THINGS WERE TRIED HERE AND ONE OF THEM IS NOT POSSIBLE.
   *
   * The openings are not. Every window, sill, lintel and shutter on a town
   * house is a fragment test in the facade shader against a per-building
   * `seed`, and that seed is `fract(vVCol.r * 91.7 + ...)` — it is *derived
   * from the wall colour*, and the wall colour comes off the town builder's own
   * `rng` stream in the order it happened to reach that building. To hang a
   * real sill on a real window from out here, this file would have to know
   * where the shader put the window, which means replaying thirteen thousand
   * draws of somebody else's stream in the right order. That is the "second
   * copy that can be wrong" the cars file warns about, and it is not done.
   *
   * The RENDER is possible, and it is the half that was actually wrong. The
   * town's wall palette is Dalmatian bone and unrendered grey — right for
   * Šibenik, whose old town is stone — and this peninsula is not that. It is
   * post-war holiday houses in painted render, and the shore build measured the
   * colour years ago for the twenty-seven it rebuilds: `RENDER` in
   * `43-jadrija.js`, seven pale sands. `a_006` measures the house on this lane
   * at 209,202,177 in full sun, which is 1.00 : 0.967 : 0.847 — and
   * `RENDER[1]`, at 0.800, 0.762, 0.672, is 1.00 : 0.953 : 0.840. The palette
   * was already this colour. The boxes simply were not using it.
   *
   * So the vertex colours of the footprints that front this lane are rewritten
   * to it, one colour per building so the shader's seed stays consistent across
   * a building's four walls — which also means the window rhythm and the
   * shutters re-roll, and that is fine and unavoidable: the seed IS the colour.
   *
   * And a PLINTH, which is the other half of the shore build's own diagnosis of
   * these boxes: *"nothing on the whole building projects: no eave, no sill, no
   * shutter, no plinth, so there is not one shadow anywhere on it."* A plinth
   * needs no seed. It is the one piece of relief that can be hung on a box
   * whose openings are unknowable, and it is the piece that stops the wall
   * meeting the ground like a sheet of card pushed into sand.
   */
  const RENDER = [
    [0.760, 0.726, 0.648], [0.800, 0.762, 0.672], [0.726, 0.688, 0.606],
    [0.782, 0.730, 0.618], [0.742, 0.716, 0.664], [0.796, 0.740, 0.634],
    [0.712, 0.692, 0.640],
  ];
  const PLINTH = [0.560, 0.540, 0.492];
  let dressed = 0;
  if (city && city.walls && typeof world !== 'undefined' && world.town) {
    // Every footprint near the lane, whether the town drew it or not: a vertex
    // has to be assigned to the building it belongs to and not merely to one
    // whose box it happened to land in, and the neighbours are what make that
    // decidable.
    const near = [];
    for (const bl of world.town) {
      const poly = bl.p;
      if (!poly || poly.length < 3) continue;
      let cx = 0, cz = 0;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const q of poly) {
        cx += q[0]; cz += q[1];
        if (q[0] < x0) x0 = q[0];
        if (q[0] > x1) x1 = q[0];
        if (q[1] < z0) z0 = q[1];
        if (q[1] > z1) z1 = q[1];
      }
      cx /= poly.length; cz /= poly.length;
      const [t, sv] = jad.local(cx, cz);
      // The box this pass works in: the lane's own run plus a house either
      // side, and back to 112 m, which is the second row of roofs — the far
      // side of the lane behind this one is most of what you see over the
      // near side's ridges.
      if (t < LANE.t0 - 18 || t > LANE.t1 + 32 || sv < LANE.front || sv > 112) {
        continue;
      }
      near.push({ poly, cx, cz, x0, x1, z0, z1,
        // The town skips whatever the resort claimed, so these are exactly the
        // boxes it drew.
        town: !jad.ownsBuilding(bl), h: bl.h || 6 });
    }
    const mine = near.filter((h) => h.town);
    if (mine.length) {
      // A colour each, off the hash and not off a draw. Neighbours have to
      // differ or seven identical houses is a housing estate, and a housing
      // estate is what the town builder's own per-building jitter exists to
      // avoid.
      for (const h of mine) {
        const key = ((h.cx * 3) | 0) * 131 + ((h.cz * 3) | 0);
        const bs = RENDER[(jit(key, 360) * RENDER.length) | 0];
        const g = 0.93 + jit(key, 361) * 0.15;
        h.col = [bs[0] * g, bs[1] * g, bs[2] * g];
      }
      // The eave overhangs the footprint by `CITY.overhang`, and the gable ends
      // and parapets that go into the WALL buffer stand on the overhung box —
      // so a vertex may be up to that far outside the outline it belongs to.
      const OVER = 0.62;
      let BX0 = Infinity, BX1 = -Infinity, BZ0 = Infinity, BZ1 = -Infinity;
      for (const h of mine) {
        BX0 = Math.min(BX0, h.x0 - OVER); BX1 = Math.max(BX1, h.x1 + OVER);
        BZ0 = Math.min(BZ0, h.z0 - OVER); BZ1 = Math.max(BZ1, h.z1 + OVER);
      }
      const G = city.walls.geometry;
      const pos = G.getAttribute('position'), col = G.getAttribute('aVCol');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        if (x < BX0 || x > BX1 || z < BZ0 || z > BZ1) continue;
        let best = null, bd = Infinity;
        for (const h of near) {
          if (x < h.x0 - OVER || x > h.x1 + OVER
            || z < h.z0 - OVER || z > h.z1 + OVER) continue;
          const d = (x - h.cx) * (x - h.cx) + (z - h.cz) * (z - h.cz);
          if (d < bd) { bd = d; best = h; }
        }
        if (!best || !best.town) continue;
        col.setXYZ(i, best.col[0], best.col[1], best.col[2]);
      }
      col.needsUpdate = true;

      // And the plinth. Built on the town's own arithmetic — the wall runs from
      // the LOWEST corner's ground minus 1.2 — so the doorstep is that lowest
      // ground whatever the slope does, which is the one number this has to
      // agree with or the plinth floats.
      const back = b;
      b = up;
      for (const h of mine) {
        let gLo = Infinity;
        for (const q of h.poly) {
          gLo = Math.min(gLo, Math.max(groundAt(q[0], q[1]), 0));
        }
        const n = h.poly.length;
        // Pushed out from the centroid rather than offset along each edge:
        // wrong by a few centimetres on a long thin plan and exactly right on
        // a square one, which is what these are. Same trick, same reason, as
        // the shore build's own houses.
        const span = Math.max(2, Math.hypot(h.x1 - h.x0, h.z1 - h.z0) * 0.25);
        const swell = 1 + 0.17 / span;
        for (let i = 0; i < n; i++) {
          const q = h.poly[i], r = h.poly[(i + 1) % n];
          const px = h.cx + (q[0] - h.cx) * swell, pz = h.cz + (q[1] - h.cz) * swell;
          const qx = h.cx + (r[0] - h.cx) * swell, qz = h.cz + (r[1] - h.cz) * swell;
          const y0 = gLo - 0.55, y1 = gLo + 0.44;
          b.quad([px, y0, pz], [qx, y0, qz], [qx, y1, qz], [px, y1, pz], PLINTH);
          // The top, which is the whole point: it is the only horizontal face
          // on the building, so it is the only thing that catches the sun and
          // puts a line of shadow under itself.
          b.quad([q[0], y1, q[1]], [r[0], y1, r[1]], [qx, y1, qz], [px, y1, pz],
            shade(PLINTH, 1.14));
        }
        dressed++;
      }
      b = back;
    }
  }

  // ── on to the scene ────────────────────────────────────────────────────────
  const FACE = 'n = gl_FrontFacing ? n : -n; base *= vVCol;';
  const floorMesh = new THREE.Mesh(floor.geo(), solidMaterial(0xffffff, {
    spec: 0.05, specPower: 18, side: THREE.DoubleSide, body: FACE,
  }));
  // Biased toward the camera, the way the road ribbons are and for the same
  // reason: the lane and the terrain are two tessellations of one hillside, and
  // the lift settles the geometry while this settles the z-buffer where they
  // run nearly parallel over a hundred and twenty metres.
  floorMesh.material.polygonOffset = true;
  floorMesh.material.polygonOffsetFactor = -3;
  floorMesh.material.polygonOffsetUnits = -6;
  const upMesh = new THREE.Mesh(up.geo(), solidMaterial(0xffffff, {
    spec: 0.06, specPower: 20, side: THREE.DoubleSide, emissive: 0.07,
    body: FACE,
  }));
  for (const m of [floorMesh, upMesh]) {
    m.geometry.computeBoundingSphere();
    scene.add(m);
  }

  // ── and nothing grows on it ────────────────────────────────────────────────
  /**
   * A hole in the wood, the width of the carriageway.
   *
   * The peninsula's pines are darted in by `45-trees.js`, which asks
   * `jadrija.grove.at(x, z)` per dart what grows there. It reads that property
   * off `jadrija` every time rather than capturing it, so wrapping it here is
   * enough — and trees are built at load *after* this file runs, so the wrap is
   * in place before the first dart is thrown.
   *
   * Wrapped from out here rather than by teaching `grove` about the lane, and
   * that is deliberate: the dependency between these two files runs one way,
   * and a lane that has to be known about in `43-jadrija.js` to be walked down
   * is a lane that cannot be taken out again.
   *
   * The empty table is the trick the shore build already uses for the boulder
   * and the anchor, and its note says why it has to be an empty table and not
   * `null`: null means "not mine, ask the cover map", which on this peninsula
   * is `GROWS[URBAN]` and a cypress. An empty object is truthy, so the cover
   * map is never asked, and the species roll finds nothing in it and drops the
   * dart.
   *
   * The hole is the made strip plus 0.6 m and NO MORE. `a_030`, `a_036` and
   * `a_051` all have pines standing hard against the edge of this lane and one
   * of them leaning over it, which is most of what the place looks like; what
   * they do not have is a trunk in the middle of the carriageway, which is what
   * the first build put at t 219 and t 302.
   */
  {
    const g0 = jad.grove;
    if (g0 && g0.at) {
      const NOTHING = Object.freeze({});
      // The world box first, for the reason `grove.at`'s own note gives: this
      // is called nine thousand times a vegetation tile and `local` is a scan
      // of thirty-odd stations. Walked rather than cornered — the shore is a
      // polyline, so the four corners of the (t, s) box do not bound the world
      // quad it maps to.
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let t = LANE.t0 - 2; t <= LANE.t1 + 2; t += 8) {
        for (const sv of [LANE.s0 - 1, LAYBY.s + 1]) {
          const w = jad.toWorld(t, sv);
          x0 = Math.min(x0, w[0]); x1 = Math.max(x1, w[0]);
          z0 = Math.min(z0, w[2]); z1 = Math.max(z1, w[2]);
        }
      }
      jad.grove = {
        houses: g0.houses,
        tile: g0.tile,
        at: (x, z) => {
          if (x < x0 || x > x1 || z < z0 || z > z1) return g0.at(x, z);
          const [t, s] = jad.local(x, z);
          if (t > LANE.t0 - 1.2 && t < LANE.t1 + 1.2
            && s > LANE.s0 - 0.6 && s < LANE.s1 + 0.6) return NOTHING;
          // And out of the pergola, where a pine would come up through the
          // vine and take the frame with it.
          if (t > PERG.t0 - 0.8 && t < PERG.t1 + 0.8
            && s > PERG.s0 - 0.8 && s < PERG.s1 + 0.8) return NOTHING;
          return g0.at(x, z);
        },
      };
    }
  }

  // Into the locale's own blocker list, by reference. `47-ground.js` takes that
  // array once on retarget and reads it every frame afterwards, so anything
  // pushed here is a wall from the moment it is pushed.
  for (const r of runs) jad.blockers.push(r);

  return {
    meshes: [floorMesh, upMesh],
    casters: [upMesh],
    sites: carSites,
    tris: (floor.count() + up.count()) / 3,
    blockers: runs.length,
    dressed,
  };
}
