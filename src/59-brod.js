// -----------------------------------------------------------------------------
// Brod — the boat to Šibenik.
//
// Misha, after an evening at Jadrija: *"Where Brod is — the pier where the boat
// comes to take people to Šibenik. Today it was too late for the boat. I am
// thinking of integrating a side-quest: to board the Jadrija–Šibenik boat and
// go on a trip to Šibenik through the beautiful sea, passing St Nicholas'
// fortress and so on."*
//
// So this is the one thing you do in this game that is not firefighting, not a
// race and not a board: you stand on a deck for nine minutes and the coast the
// rest of the game is flown over at three hundred metres goes past at eye
// height. Everything it sails through is already in the world — the same height
// field, the same cover raster, the same Gerstner sea, the same thirteen
// thousand footprints — and none of it was authored for this, which is the
// point. It is the only view of Šibenik in the game taken from the direction
// Šibenik has always been looked at from.
//
// ── the route ───────────────────────────────────────────────────────────────
//
// `CHANNEL` is not drawn by hand, and the thing that drew it is now committed
// as `tools/channel.py`: a min-clearance Dijkstra through the shipped SEA mask
// of `build/payload/terrain_c.png`, from the berth to the town quay, with the
// step cost `1 + 260/clearance` so the line hunts the middle of the water
// instead of cutting the corners; then smoothed — no pass may push a point
// inside 22 m of clearance — and resampled at 150 m.
//
//     python3 tools/channel.py --from=-1783,336 --to=1457,-822
//
// Twenty-seven waypoints, 3 850 m, every one of them `isSea` at 6.35 m
// resolution and none of them with less than 100 m of water round it once she
// is clear of the quay.
//
// What it passes, measured against the OSM geometry rather than remembered:
//
//     s    600 m   Tvrđava svetog Nikole      170 m to starboard
//     s    800 m   into Kanal svetog Ante, and the shores close to 250 m
//     s  1 860 m   the narrows — 220 m of water, karst both sides
//     s  3 850 m   alongside at Šibenik, 86 m from the cathedral
//
// It was 4 469 m and it started at the mole. What the move to the Brod takes
// out is the loop north about Rt Jadrija: the Brod is on the far side of the
// point already, which is the whole reason the boat comes to it and not to the
// bathing mole — from the Brod you leave straight up the channel with the
// fortress ahead and to starboard, and from the mole you cannot.
//
// The fortress passes on the **starboard** hand, which is the hand it passes on
// coming in from the sea. Getting that right is why 48-landmarks.js had to be
// fixed before any of this could be built: it was 74 cm under the water and
// aimed 106° off.
//
// ── what this first pass is not ─────────────────────────────────────────────
//
// You do not steer. A scheduled passenger boat is not a vehicle you are given,
// it is a vehicle you are *on*, and the whole of what you do aboard is walk her
// deck and look — which is exactly what two hours of survey footage of this
// coast are of. A wheel would turn nine minutes of Dalmatia into nine minutes
// of not hitting things.
//
// And there is no timetable. Misha's "today it was too late for the boat" is
// the feeling this is built out of and it is deliberately *not* the mechanic: a
// side quest behind a clock you cannot see is a side quest nobody finds. She
// lies alongside the Brod with her engine ticking over from the moment you can
// walk out to her, and she waits.
// -----------------------------------------------------------------------------

/**
 * HOW MUCH BIGGER SHE IS THAN SHE WAS AUTHORED.
 *
 * Reported: *"the boat itself... at the moment it is too tiny. it has to be
 * bigger... it's a ferry that ferries like 60 people back and forth... for now,
 * only i barely fit on it"*. He is right, and the number says why: she was
 * 15.6 m by 4.20, which on this coast is a twenty-passenger day boat, and once
 * the deckhouse and the bulwarks are taken out of it there is about eleven
 * square metres of standable deck. Sixty people need three times that. A
 * Dalmatian wooden passenger boat that carries sixty is 22 to 24 m.
 *
 * So: 1.45, uniformly. 22.6 m by 6.09, and 2.1x the deck.
 *
 * UNIFORM, and that word is load-bearing. Stretching her in x and z only would
 * have kept the freeboard the tide and the mole were tuned against — but it
 * also leaves every normal in the loft wrong by the anisotropy, and a hull is
 * a thing you read entirely by its shading. Scaled the same in all three, the
 * normals are untouched and every number below stays in the proportion it was
 * measured in.
 *
 * And it happens to fix the boarding rather than break it. `JET.top` at the
 * mole is 1.46 m above the sea; her side deck was 1.06, so you used to step
 * DOWN 0.4 m onto her. At 1.45 it is 1.54 — level with the quay, with 0.7 m of
 * bulwark to swing a leg over, which is how you get on a passenger boat.
 *
 * IT IS NOT AN OBJECT3D SCALE, deliberately. Scaling `boat` would scale the
 * mesh correctly and then quietly scale the person standing on it: `you.x/z`
 * are LOCAL coordinates, so `localToWorld` would multiply the walking speed by
 * 1.45 and stand your eye 2.35 m over the deck. The mesh is scaled through a
 * wrapper on the builder and the numbers the game reasons with are scaled here,
 * once, off the same constant.
 */
const BROD_K = 1.75;

/**
 * AND BIGGER AGAIN, BECAUSE SIZE WAS ONLY HALF OF IT.
 *
 * Misha, 4 Sep 2026: *"the boat itself, it's still not big enough, it must
 * carry 60-80 people to sibenik... your boat can maybe carry 1.25 people....
 * needs to be BIGGGGGER"*. He is right twice over, and the second one is the
 * interesting one.
 *
 * 1.45 put her at 22.6 m, which on this coast really is a sixty-passenger
 * hull. 1.75 puts her at **27.3 m by 7.35**, which is the top of the range and
 * not the bottom of it, and that is the easy half.
 *
 * The hard half is that a hull does not say how many people it takes — SEATS
 * do. What she was, at any scale, was an open boat with a shed on it and two
 * benches down the cockpit: fifteen metres of bench, about thirty places, and
 * from thirty metres off nothing at all to count. Which is precisely what "1.25
 * people" means. So she now has what every excursion boat on this coast has and
 * she did not:
 *
 *   - an UPPER DECK on the deckhouse roof, railed all round, with a bench down
 *     each side of it. This is the single thing that reads as capacity from the
 *     shore, and it is the reason you can tell a working passenger boat from a
 *     large private one at half a mile.
 *   - four benches in the cockpit where there were two.
 *   - a boarding gate cut in the port bulwark, which she needs now for a
 *     reason the note below explains.
 *
 * Counted, at 0.50 m a place: 2 x 5.95 m up top and 4 x 5.30 m below, times
 * 1.75, is 20.8 + 37.1 = **58 m of bench, about 116 places seated and standing
 * room besides**. She is a boat that takes eighty people and looks like one.
 *
 * THE STEP AT THE QUAY CHANGES, and that is what the gate is for. At 1.45 her
 * side deck was 1.54 against a mole at 1.46 — level, step across. At 1.75 it is
 * 1.86 and her bulwark top is 1.13 m above the coping, which nobody swings a
 * leg over. Every boat this size has a gate cut in the bulwark instead, and now
 * so does she: a gap in the topsides amidships to port with a threshold in it,
 * on the side she lies alongside.
 */

const BROD = {
  // Fifteen and a half metres, four and a bit across. The Jadrija boat is a
  // wooden Dalmatian motor passenger boat, and the best picture of one in the
  // whole survey is not a photograph of a boat: it is the mural painted on the
  // end wall of the kabine block (`1000150392`), which is what the people who
  // live with her think she looks like. White hull, dark strake along the
  // sheer with a thin gold cove line under it, low white deckhouse with a long
  // row of square lights, white pipe rails forward, open cockpit aft.
  // As built: `BROD_K` times the 15.6 x 4.20 she was drawn at. See the note
  // over that constant — she is a sixty-passenger boat now, which is 22.6 m,
  // and both of these are read by the sea-sampling in `place`.
  loa: 15.6 * BROD_K,
  beam: 4.20 * BROD_K,

  eye: 1.62,                 // your eyes above whatever you are standing on

  // Speed. A 16 m wooden boat on a single diesel does 13 to 16 knots and this
  // one does 15.6, which puts 4 469 m of channel at nine and a half minutes.
  // That is a long time to be a passenger and it is the honest number; the
  // alternative is a boat that crosses the channel like a RIB, and the subject
  // of this whole mode is how long and how slow this coast is.
  cruise: 8.0,
  accel: 0.26,               // m/s² — she is twenty tonnes and gathers way slowly
  brake: 0.34,
  slowAt: 300,               // m from the berth that she comes off cruise
  letGo: 5.0,                // s alongside with the engine on before she moves

  // The walkable deck, in her frame: +x forward, +z to starboard.
  //
  // **Bands along her length, clamped athwart by her own hull**, and not four
  // rectangles. Rectangles was the first cut and it did not work, for a reason
  // that is obvious once you have walked into it: a hull is a shape that
  // narrows, so a rectangle is either inside the boat at its widest station or
  // outside her at its narrowest, and four of them laid end to end leave *gaps
  // between them* where nothing is standable. Measured on the built page:
  // boarding on the starboard side deck and pressing S for thirty seconds
  // walked you 2.5 m aft and stopped dead at the after end of that rectangle,
  // with the cockpit 0.20 m away across a strip of nothing.
  //
  // So each band gives an x range, the sole it stands at, and a `hole` — the
  // half-width taken out of the middle of it by the deckhouse. The outer limit
  // is `brodSheer(x)` less the bulwark and a hand's breadth, which is the hull.
  // The bands **overlap** at both joins, and the first match wins, so stepping
  // aft off the side deck puts you down the 0.34 m into the cockpit rather than
  // into the sea.
  //
  // Written at the size she was drawn and scaled by `BROD_K` where the table
  // is closed, so these stay comparable with the stations above and with every
  // number in `brodProto`.
  decks: [
    { x0: -7.50, x1: -1.20, y: 0.72, hole: 0 },      // the cockpit, full width
    { x0: -1.35, x1: 4.40, y: 1.06, hole: 1.16 },    // the side decks
    { x0: 4.30, x1: 6.60, y: 1.22, hole: 0 },        // the foredeck
  ],
  edge: 0.06,                // how far in from the bulwark you may stand — a
                             // person's clearance, so it does NOT scale
  walk: 1.55,                // m/s about the deck — it is a deck, not a runway
  run: 2.6,

  // How she sits. Sampled off the real Gerstner surface at four points, so the
  // heel and the trim are the sea's business and not a clock's: a hull that
  // pitches on a canned sine in a sea that has waves in it is the one thing on
  // the water that looks wrong from the deck of it.
  probe: 0.62,               // fraction of loa/beam the four samples sit at
  soften: 0.55,              // twenty tonnes does not take every wavelet
  heelRate: 1.9,             // rad/s the attitude is allowed to chase at

  board: 7.0,                // m from the boarding mark that she may be got on

  /**
   * The Brod, in world metres. This is where she lies.
   *
   * Misha, the evening of 23 August: *"the boat sidequest, u placed the boat in
   * the wrong spot... the boat should be at the Brod, facing St Nicholas
   * fortress, that's where the boat comes to."* Then, the next morning, having
   * walked out to the point three photographs put it at: *"that's your brod
   * alright."*
   *
   * That confirmed the **place**. What settles the **structure** is OSM, and it
   * turns out to have been carrying it the whole time — two things nothing in
   * this game had ever looked at:
   *
   *   1. `Jadrija VII`, an asphalt `highway=unclassified` tagged
   *      `source=survey`, comes down the headland and **dead-ends** at world
   *      (-1758, 316). A road that ends at the water ends at a landing.
   *   2. The `natural=coastline` way runs out from that terminus as a finger
   *      six metres wide and about forty-five long, out to a tip at (-1726,
   *      299) and back down the other side. That is not a shore. That is a
   *      mole, drawn as coastline the way built moles usually are.
   *
   * Fitted to those eight coastline points by principal axis: a pier bearing
   * **55.5°**, root on the shore at (-1770.5, 328.5), 46 m long. It is 45 m
   * north-east of the point he stood on, which is where the road brings you and
   * where you would stand looking at it.
   *
   * None of that was visible in the DEM. The height field is 6.35 m a pixel and
   * it has the whole finger under water — the tip reads -4.4 m — which is why
   * the first cut of this built a pier of its own out of nothing, pointing
   * straight at the fortress because that was the only constraint it had.
   *
   * From the head, Tvrđava svetog Nikole is **646 m away on bearing 130.4°**.
   * The pier runs 55.5°, so the fortress lies almost square off the south-east
   * face — and that is `1000150377` exactly: the coping edge straight across the
   * bottom of a portrait frame with the fortress centred above it. He was
   * standing on the pier looking across it, not along it. The distance is
   * inside the 620–680 m the photographs measure and the bearing is the one
   * they were taken on.
   *
   * So she lies on the **south-east face**, which is the face the fittings were
   * photographed on and the face that looks at the fortress. The small craft
   * in `1000150378` and `1000150357` lie on the other one, med-moored bow-to
   * in a line — built now, in `moor` below.
   *
   * `wide`, `top` and `apron` are still a placement: the coastline gives the
   * plan and says nothing about the section.
   */
  quay: {
    root: [-1770.5, 328.5],  // world x, z — the shore end of the pier
    face: 55.5,              // compass bearing it runs out along
    len: 46.0,
    wide: 6.0,
    top: 1.15,               // deck above sea level; the bathing mole's is 1.46
    apron: 30.0,             // the causeway off the root, back on to the shore
  },

  // Landmark callouts, in metres run. `side` is the hand it passes on.
  // Re-timed when the berth moved to the Brod: the route is 3 850 m from there
  // and was 4 433 m from the mole, and it is not a uniform shortening — the
  // Brod is already round the point, so what the passage loses is the whole
  // northward loop about Rt Jadrija at the front of it. Every call below is
  // the arc length at which the new route passes the thing it names, projected
  // from the old one and re-measured against the OSM geometry.
  //
  // `brod.callLight` is gone with the loop. From the mole the Rt Jadrija light
  // came abeam at 184 m; from the Brod its closest approach is 539 m and it is
  // astern from the moment you let go. Announcing it would be announcing
  // something you cannot pick out, which is worse than saying nothing.
  calls: [
    { at: 40, key: 'brod.callAway', side: '' },
    { at: 520, key: 'brod.callNikola', side: 'stbd' },
    { at: 800, key: 'brod.callChannel', side: '' },
    { at: 1860, key: 'brod.callNarrows', side: '' },
    { at: 2860, key: 'brod.callSpilja', side: 'port' },
    { at: 3470, key: 'brod.callTown', side: '' },
    { at: 3800, key: 'brod.callBerth', side: '' },
  ],
};

/**
 * The channel, in world metres. See the header for how it was cut.
 *
 * The berth is *not* in here: it is worked out from the mole at load time and
 * pushed on the front, so that moving the mole moves the boat, the fittings,
 * the boarding mark and the first leg of the voyage together. That is the rule
 * `swimRun` is exported under in 43-jadrija.js and it is the same rule.
 */
const CHANNEL = [
  [-1596.0, 343.6], [-1488.7, 448.3], [-1373.4, 542.3], [-1224.1, 548.4],
  [-1100.1, 471.2], [-996.5, 362.8], [-885.1, 263.2], [-736.8, 249.4],
  [-588.8, 226.2], [-447.0, 182.5], [-303.4, 147.3], [-157.3, 115.3],
  [-20.5, 61.8], [106.0, -17.1], [255.6, -22.2], [405.6, -20.7],
  [546.9, 26.3], [693.4, 8.0], [814.5, -80.3], [917.5, -189.2],
  [1021.4, -297.4], [1122.4, -407.9], [1181.6, -543.8], [1286.3, -651.2],
  [1392.3, -757.3], [1457.5, -822.4],
];

/**
 * The `rotation.y` that points a model's local **+X** along the world vector
 * (dx, dz).
 *
 * Written down once and used everywhere in this file, because it is not the
 * yaw the rest of the game uses. A walker's yaw in 43-jadrija.js and
 * 47-ground.js is a compass bearing — `atan2(ux, -uz)`, zero facing north,
 * with the body's forward on local −Z. Every hull in 37-props.js is built with
 * its forward on **+X** instead, and three.js maps local +X to
 * `(cos θ, −sin θ)`, so the two differ by a quarter turn and a sign. Mixing
 * them puts a boat broadside on its own course, which is exactly what the
 * first cut of this file did.
 */
const yawOfX = (dx, dz) => Math.atan2(-dz, dx);

// And the deck bands, brought up to size. In place rather than as a derived
// table because `deckAt` and `slideIn` are the only readers and both want the
// built metres — see the note over `BROD_K` for why this is not an Object3D
// scale. `hole` is the deckhouse's half-width and scales with the house.
for (const d of BROD.decks) {
  d.x0 *= BROD_K; d.x1 *= BROD_K; d.y *= BROD_K; d.hole *= BROD_K;
}
// The bulwark, which `deckAt` subtracts off the sheer to get the inboard face
// of it. Structure, not clearance, so it scales.
const BROD_BULK = 0.24 * BROD_K;

/**
 * Her stations: `[x, keel y, chine y, chine half-beam, sheer y, sheer half-beam]`.
 *
 * Out here rather than inside `brodProto` because two things read it and they
 * have to agree: the loft that draws the hull, and `brodSheer` below, which is
 * what decides how far out on her deck you are allowed to stand. When they were
 * two tables the deck was a guess at the hull.
 *
 * The sheer is the line the whole boat is read by — high at the stem, lowest
 * about two thirds aft, lifting a hand's breadth again at the transom.
 *
 * These heights were 0.45 m lower on the first cut and it was the one thing
 * about her that was measurably wrong. `JET.top` at the Jadrija mole comes out
 * at **1.46 m** above the sea — the terrace lip, not the 0.72 the comment in
 * 43-jadrija.js quotes — so a boat with 1.05 m of freeboard lies with her
 * gunwale 0.4 m *below* the quay you board her from, and from the mole all you
 * can see of her is a roof. She is a passenger boat: her rail comes to the
 * pier, which is how anybody gets on.
 */
/** As authored, at the size she was drawn. `BROD_ST` below is these times K. */
const BROD_ST0 = [
  [7.80, 0.35, 0.62, 0.10, 2.24, 0.22],
  [7.10, -0.55, -0.10, 0.34, 2.05, 0.72],
  [5.90, -1.00, -0.52, 0.74, 1.86, 1.26],
  [4.20, -1.14, -0.72, 1.14, 1.68, 1.75],
  [2.00, -1.15, -0.80, 1.44, 1.55, 2.02],
  [-0.60, -1.13, -0.80, 1.52, 1.48, 2.10],
  [-3.20, -1.06, -0.76, 1.50, 1.48, 2.08],
  [-5.90, -0.90, -0.64, 1.42, 1.54, 1.99],
  [-7.80, -0.62, -0.46, 1.28, 1.62, 1.82],
];

/** The same stations at the size she is actually built. */
const BROD_ST = BROD_ST0.map((r) => r.map((v) => v * BROD_K));

/**
 * A `propBuilder` that scales everything through it.
 *
 * So that `brodProto` below can go on being written in the metres she was
 * measured in — a deckhouse from x -1.35 to 4.55, seven lights a side, a
 * 70 mm cove line — while what comes out is 1.45 times the size. The
 * alternative was multiplying two hundred literals by hand, and the reason not
 * to is not the typing: half of those numbers are colours, exponents and
 * counts, and the first one of those multiplied by 1.45 is a bug nobody finds
 * for a month.
 *
 * Normals pass through untouched, which is correct and is the whole reason the
 * scale is uniform: scaling a vector by a positive scalar does not change its
 * direction.
 */
function scaledBuilder(b, k) {
  const S = (p) => [p[0] * k, p[1] * k, p[2] * k];
  return {
    tri: (a, c, d, cl) => b.tri(S(a), S(c), S(d), cl),
    quad: (a, c, d, e, cl) => b.quad(S(a), S(c), S(d), S(e), cl),
    smooth: (a, c, d, na, nb, nc, ca, cb, cc) =>
      b.smooth(S(a), S(c), S(d), na, nb, nc, ca, cb, cc),
    box: (cx, cy, cz, sx, sy, sz, cl, top) =>
      b.box(cx * k, cy * k, cz * k, sx * k, sy * k, sz * k, cl, top),
    geo: () => b.geo(),
    count: () => b.count(),
  };
}

/** The sheer height and half-beam at any x, interpolated between stations. */
function brodSheer(x) {
  let a = BROD_ST[0], c = BROD_ST[1];
  for (let i = 0; i < BROD_ST.length - 1; i++) {
    if (x <= BROD_ST[i][0] && x >= BROD_ST[i + 1][0]) {
      a = BROD_ST[i]; c = BROD_ST[i + 1]; break;
    }
  }
  const u = clamp((a[0] - x) / ((a[0] - c[0]) || 1), 0, 1);
  return [a[4] + (c[4] - a[4]) * u, a[5] + (c[5] - a[5]) * u];
}

/**
 * The hull, the house and everything standing on her.
 *
 * Local frame is `boatProto`'s — **+X forward, +Y up, +Z to starboard** — so
 * that anything in 37-props.js can be hung off her without a second convention
 * to get wrong. y = 0 is the designed waterline: below it is antifouling, above
 * it is the boat.
 *
 * Built the way `boatNearProto` is, and for its reason rather than by copying
 * it: a hull is a section that changes along its length and no arrangement of
 * flat plates has any of it. Nine stations, seven points a side — keel through
 * garboard and chine to the sheer — with rocker, sheer and flare, shaded smooth
 * across the grid so there is no crease under the rubbing strake.
 *
 * What this one has that the six-metre runabout does not is a **near-plumb stem
 * and a counter aft**. That is the difference between a modern GRP hull and a
 * wooden boat built on this coast in the middle of the last century, and from
 * anywhere on the water it is most of the silhouette.
 */
function brodProto() {
  const raw = propBuilder();
  // Everything below is written at the size she was drawn; `scaledBuilder`
  // multiplies it on the way out. See `BROD_K`.
  const b = scaledBuilder(raw, BROD_K);
  const HULL = [0.905, 0.900, 0.878];       // white, weathered
  const SHEER = [0.118, 0.145, 0.190];      // the dark strake along the sheer
  const COVE = [0.686, 0.545, 0.243];       // and the gold line under it
  const BOOT = [0.230, 0.106, 0.086];       // antifouling
  const DECK = [0.560, 0.470, 0.352];       // laid timber, oiled
  const HOUSE = [0.912, 0.906, 0.886];
  const GLASS = [0.140, 0.196, 0.216];
  const TRIM = [0.400, 0.290, 0.170];       // varnished mahogany
  const RAIL = [0.845, 0.845, 0.840];
  const DARK = [0.180, 0.185, 0.195];

  // [x, keel y, chine y, chine half-beam, sheer y, sheer half-beam]
  //
  // The sheer is the line the whole boat is read by: high at the stem, lowest
  // about two thirds aft, lifting a hand's breadth again at the transom.
  // The AUTHORED stations, not the scaled ones: the builder above does the
  // scaling, and feeding it a table that has already been scaled would square
  // the boat.
  const ST = BROD_ST0;

  const NS = 7;
  const N = NS * 2 - 1;
  const tAt = (j) => Math.abs(j - (NS - 1)) / (NS - 1);
  const sAt = (j) => (j < NS - 1 ? -1 : 1);
  const pt = (st, s, t) => {
    const [x, ky, cy, cw, sy, sw] = st;
    if (t <= 0.60) {
      const u = t / 0.60;
      return [x, ky + (cy - ky) * Math.pow(u, 0.70), s * cw * Math.pow(u, 1.20)];
    }
    const u = (t - 0.60) / 0.40;
    return [x, cy + (sy - cy) * Math.pow(u, 0.94),
      s * (cw + (sw - cw) * Math.pow(u, 0.58))];
  };
  const G = ST.map((st) => {
    const row = [];
    for (let j = 0; j < N; j++) row.push(pt(st, sAt(j), tAt(j)));
    return row;
  });
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const GN = G.map((row, i) => row.map((_, j) => {
    const u = sub(G[Math.min(G.length - 1, i + 1)][j], G[Math.max(0, i - 1)][j]);
    const v = sub(row[Math.min(N - 1, j + 1)], row[Math.max(0, j - 1)]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0]];
    const L = Math.hypot(n[0], n[1], n[2]) || 1;
    // x runs bow to stern down the array, so the cross comes out pointing in.
    return [-n[0] / L, -n[1] / L, -n[2] / L];
  }));
  // Three bands rather than two: antifouling under the chine, white topsides,
  // and the last strake before the gunwale in the dark colour.
  for (let i = 0; i < G.length - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const A = G[i][j], B = G[i][j + 1], C = G[i + 1][j + 1], D = G[i + 1][j];
      const na = GN[i][j], nb = GN[i][j + 1], nc = GN[i + 1][j + 1], nd = GN[i + 1][j];
      const t0 = tAt(j), t1 = tAt(j + 1);
      const col = Math.max(t0, t1) < 0.62 ? BOOT
        : (Math.min(t0, t1) > 0.90 ? SHEER : HULL);
      b.smooth(A, B, C, na, nb, nc, col, col, col);
      b.smooth(A, C, D, na, nc, nd, col, col, col);
    }
  }
  // The transom, fanned to a point a little below the sole so she has a counter
  // and a shadow under it rather than a wall.
  {
    const row = G[G.length - 1];
    const c = [row[0][0], -0.10, 0];
    for (let j = 0; j < N - 1; j++) {
      const col = tAt(j) < 0.62 ? BOOT : (tAt(j) > 0.90 ? SHEER : HULL);
      b.tri(row[j + 1], row[j], c, col);
    }
  }

  /**
   * A quad on one side of her, wound so that its face points the right way.
   *
   * Everything from the bulwark outwards is written once with a `s = ±1`
   * multiplier on the z, which is how the port and starboard copies of a thing
   * get built from one line — and **mirroring a polygon reverses its winding**.
   * `propBuilder.tri` takes the normal off the winding and three.js culls back
   * faces, so half of every mirrored pair was inside out. The symptom was
   * specific and took a screenshot to see: standing on her deck you could look
   * down at the *port* bulwark and see the dark outer strake from the inboard
   * side, with sea through the gap where the white inner face should have been,
   * and the whole cockpit read as a hole in the boat.
   *
   * Every quad in this file that carries an `s` goes through here.
   */
  const sideQuad = (s, A, B, C, D, col) =>
    (s > 0 ? b.quad(D, C, B, A, col) : b.quad(A, B, C, D, col));

  // Local, and off `BROD_ST0` for the same reason `ST` is: `brodSheer` answers
  // in built metres, which is what the deck logic wants and is exactly what
  // must not come in here.
  const sheerAt = (x) => {
    let a = BROD_ST0[0], c = BROD_ST0[1];
    for (let i = 0; i < BROD_ST0.length - 1; i++) {
      if (x <= BROD_ST0[i][0] && x >= BROD_ST0[i + 1][0]) {
        a = BROD_ST0[i]; c = BROD_ST0[i + 1]; break;
      }
    }
    const u = clamp((a[0] - x) / ((a[0] - c[0]) || 1), 0, 1);
    return [a[4] + (c[4] - a[4]) * u, a[5] + (c[5] - a[5]) * u];
  };

  // ── the deck and the bulwark ─────────────────────────────────────────────
  // The sheer curves and the sole does not; that is the whole difference
  // between a gunwale you look over and a floor you stand on. The sole steps up
  // twice going forward — cockpit, side deck, foredeck — which is what the
  // engine under the house and the chain locker under the foredeck do to it.
  const soleAt = (x) => (x > 4.30 ? 1.22 : (x > -1.35 ? 1.06 : 0.72));
  {
    const NX = 26;
    for (let i = 0; i < NX; i++) {
      const x0 = 7.6 - 15.8 * (i / NX);
      const x1 = 7.6 - 15.8 * ((i + 1) / NX);
      const [y0, w0] = sheerAt(x0), [y1, w1] = sheerAt(x1);
      const i0 = Math.max(0.02, w0 - 0.24), i1 = Math.max(0.02, w1 - 0.24);
      const sy = soleAt((x0 + x1) * 0.5);
      for (const s of [1, -1]) {
        // cap
        sideQuad(s, [x0, y0, s * w0], [x1, y1, s * w1],
          [x1, y1, s * i1], [x0, y0, s * i0], TRIM);
        // outer face, in the dark strake colour
        sideQuad(s, [x0, y0 - 0.40, s * w0], [x1, y1 - 0.40, s * w1],
          [x1, y1, s * w1], [x0, y0, s * w0], SHEER);
        // Inner face, painted out white like the rest of the inside — and
        // carried all the way down to the sole rather than a fixed 0.40, which
        // is what left a gap you could see the sea through once the sheer went
        // up and the sole did not follow it the same distance.
        sideQuad(s, [x1, y1, s * i1], [x1, sy, s * i1],
          [x0, sy, s * i0], [x0, y0, s * i0], HOUSE);
      }
      b.quad([x0, sy, -i0], [x1, sy, -i1], [x1, sy, i1], [x0, sy, i0], DECK);
    }
    // The gold cove line: one 70 mm strip a side, standing 12 mm off the
    // topside so it never z-fights the hull it is painted on.
    for (let i = 0; i < NX; i++) {
      const x0 = 7.3 - 15.2 * (i / NX);
      const x1 = 7.3 - 15.2 * ((i + 1) / NX);
      const [y0, w0] = sheerAt(x0), [y1, w1] = sheerAt(x1);
      for (const s of [1, -1]) {
        sideQuad(s, [x0, y0 - 0.50, s * (w0 + 0.012)], [x1, y1 - 0.50, s * (w1 + 0.012)],
          [x1, y1 - 0.43, s * (w1 + 0.012)], [x0, y0 - 0.43, s * (w0 + 0.012)], COVE);
      }
    }
  }

  // ── the deckhouse ────────────────────────────────────────────────────────
  // Aft face at x -1.35, forward at 4.55, 2.40 wide and 1.94 high off the side
  // deck, with the wheelhouse standing proud of it at the front. Seven lights a
  // side, which is what the mural has, and the mural is the only thing in the
  // survey that shows the whole boat at once.
  //
  // 2.20 wide and stopping at x 4.30, both of which are the hull's doing rather
  // than a preference: she is 4.20 in the beam amidships and 3.4 at the after
  // end of the house, and a house 2.40 across leaves a side deck that has
  // narrowed to nothing by the time it reaches the wheelhouse. A side deck you
  // cannot get to the end of is a side deck that ends in a wall.
  b.box(1.475, 1.06 + 0.97, 0, 5.65, 1.94, 2.20, HOUSE, HOUSE);
  b.box(3.75, 1.06 + 1.20, 0, 1.10, 1.48, 1.90, HOUSE, HOUSE);
  {
    const y = 1.06 + 1.22;
    for (let i = 0; i < 7; i++) {
      const x = -0.85 + i * 0.79;
      for (const s of [1, -1]) b.box(x, y, s * 1.115, 0.52, 0.60, 0.03, GLASS);
    }
    for (let i = -1; i <= 1; i++) {
      b.box(4.31, 1.06 + 1.36, i * 0.60, 0.03, 0.64, 0.52, GLASS);
    }
    // The door into the house, on the port side aft, standing open.
    b.box(-1.37, 1.06 + 0.86, -0.56, 0.04, 1.72, 0.70, DARK);
  }
  // The roof: a flat deck with a coaming, and the boat's one piece of shade.
  // Everybody on every boat in the survey sits under this.
  b.box(1.475, 1.06 + 1.99, 0, 5.95, 0.10, 2.46, HOUSE, HOUSE);
  b.box(3.75, 1.06 + 1.99, 0, 1.20, 0.10, 2.10, HOUSE, HOUSE);

  // ── the upper deck ───────────────────────────────────────────────────────
  // And what stands on that roof, which is the whole answer to "your boat can
  // maybe carry 1.25 people". A hull does not say how many people it takes;
  // seats do, and the one place a boat this size puts them where they can be
  // COUNTED from the shore is on top of the house.
  //
  // Stanchions and two rails, not a solid coaming: a solid one is a bulwark
  // and reads as a second deckhouse, and what has to read from half a mile is
  // that there is nothing up there but people.
  {
    const y0 = 1.06 + 2.04;                  // the roof's top face
    const X0 = -1.44, X1 = 4.39, Z = 1.19;   // just inboard of the roof edge
    const NS2 = 9;
    for (let i = 0; i <= NS2; i++) {
      const x = X0 + (X1 - X0) * (i / NS2);
      for (const s of [1, -1]) b.box(x, y0 + 0.45, s * Z, 0.05, 0.90, 0.05, RAIL);
    }
    // The two rails, and the transverse pair that closes the after end. The
    // forward end is open on to the wheelhouse roof, which is where the
    // skipper's ladder comes up and where nobody stands.
    for (const h of [0.42, 0.86]) {
      for (const s of [1, -1]) {
        b.box((X0 + X1) * 0.5, y0 + h, s * Z, X1 - X0, 0.045, 0.045, RAIL);
      }
      b.box(X0, y0 + h, 0, 0.045, 0.045, Z * 2, RAIL);
    }
    // A bench down each side, backs to the rail, which is how they are on
    // every one of these. The seat is 0.42 off the deck and 0.40 across, so a
    // person on it sits with their knees inboard and their back to the sea.
    for (const s of [1, -1]) {
      b.box(1.475, y0 + 0.42, s * 0.94, 5.95, 0.08, 0.40, TRIM);
      b.box(1.475, y0 + 0.21, s * 1.12, 5.95, 0.42, 0.06, TRIM);
      b.box(1.475, y0 + 0.66, s * 1.13, 5.95, 0.34, 0.05, TRIM);
    }
    // The ladder up, on the starboard side against the after wall of the
    // house. Five rungs from the side deck to the roof.
    for (let i = 0; i <= 5; i++) {
      b.box(-1.22, 1.06 + i * (0.98 / 5) + 0.08, 0.88, 0.05, 0.05, 0.52, RAIL);
    }
    for (const z of [0.64, 1.12]) {
      b.box(-1.22, 1.06 + 0.57, z, 0.06, 1.14, 0.06, RAIL);
    }
  }

  // ── the rails ────────────────────────────────────────────────────────────
  // Pipe stanchions and two wires round the foredeck only. Aft the bulwark is
  // the rail, which is why you can sit on it.
  {
    const NST = 6;
    for (let i = 0; i <= NST; i++) {
      const x = 4.7 + (7.3 - 4.7) * (i / NST);
      const [y, w] = sheerAt(x);
      for (const s of [1, -1]) b.box(x, y + 0.40, s * (w - 0.12), 0.05, 0.80, 0.05, RAIL);
    }
    for (const s of [1, -1]) {
      for (const h of [0.36, 0.72]) {
        const [ya, wa] = sheerAt(4.7), [yb, wb] = sheerAt(7.3);
        // Both windings, not one: a wire is 35 mm of nothing and you are as
        // often inboard of it as outboard, so it is the one thing on her that
        // has to be visible from both sides.
        b.quad([4.7, ya + h, s * (wa - 0.12)], [7.3, yb + h, s * (wb - 0.12)],
          [7.3, yb + h + 0.035, s * (wb - 0.12)], [4.7, ya + h + 0.035, s * (wa - 0.12)],
          RAIL);
        b.quad([4.7, ya + h + 0.035, s * (wa - 0.12)], [7.3, yb + h + 0.035, s * (wb - 0.12)],
          [7.3, yb + h, s * (wb - 0.12)], [4.7, ya + h, s * (wa - 0.12)], RAIL);
      }
    }
  }

  // ── the fittings ─────────────────────────────────────────────────────────
  // A mast forward of the house with the ensign at its head, a stub exhaust out
  // of the port quarter of the roof, and benches down both sides of the
  // cockpit. The ensign is a flat panel and not cloth, because the only thing
  // that reads from the far side of a fifteen-metre deck is red-white-blue.
  b.box(4.44, 1.06 + 2.90, 0, 0.14, 3.90, 0.14, TRIM);
  b.box(2.40, 1.06 + 2.36, -0.86, 0.16, 0.66, 0.16, DARK);
  // FOUR benches in the cockpit and not two: the outboard pair against the
  // bulwark, which is where they always were, and an inboard pair back to back
  // with them down the middle. That is the arrangement on a boat that has to
  // seat people rather than carry a family, and it doubles what can be counted
  // from the pier without narrowing the gangway either side to less than the
  // 0.55 m a person needs.
  for (const s of [1, -1]) {
    b.box(-4.20, 0.72 + 0.42, s * 1.42, 5.30, 0.08, 0.52, TRIM);
    b.box(-4.20, 0.72 + 0.20, s * 1.66, 5.30, 0.42, 0.06, TRIM);
    b.box(-4.20, 0.72 + 0.42, s * 0.48, 5.30, 0.08, 0.46, TRIM);
    b.box(-4.20, 0.72 + 0.62, s * 0.24, 5.30, 0.32, 0.05, TRIM);
  }
  // The boarding gate, to port, amidships, on the side she lies alongside.
  // See the note over `BROD_K`: her bulwark now stands 1.13 m over the coping
  // and a passenger boat answers that with a gap in the topsides, not with a
  // longer leg. Drawn as the two posts either side of it and a threshold
  // across the bottom — the gap itself is the absence of the dark strake, and
  // the strake is lofted, so what makes the hole is a piece of deck-coloured
  // hull standing in front of it.
  {
    const [ys, ws] = sheerAt(0.60);
    b.box(0.60, ys - 0.32, -(ws - 0.05), 1.30, 0.64, 0.10, DECK, DECK);
    for (const dx of [-0.72, 0.72]) {
      b.box(0.60 + dx, ys - 0.20, -(ws - 0.06), 0.13, 0.90, 0.13, TRIM);
    }
    b.box(0.60, ys + 0.02, -(ws - 0.06), 1.58, 0.09, 0.14, TRIM);
  }
  // Two lifebuoys, lashed to the after rail of the upper deck where they can
  // be reached. 0.42 across and not 0.62: a lifebuoy is 0.75 m outside and
  // this table is authored at 1/1.75 of built, so the first cut put two
  // metre-and-a-bit rings on the roof and they read as deck cargo.
  for (const s of [1, -1]) {
    b.box(-1.46, 1.06 + 2.50, s * 0.62, 0.09, 0.42, 0.42, [0.760, 0.180, 0.090]);
    b.box(-1.44, 1.06 + 2.50, s * 0.62, 0.09, 0.22, 0.22, HOUSE);
  }

  // ── the awning over the aft deck ──────────────────────────────────────────
  // The other half of what makes a hull read as a ferry, and the half that is
  // about SHADE. Nobody crosses this channel in August on an open deck: every
  // excursion boat on this coast has a flat canvas over the after well on four
  // posts, stepped down from the deckhouse roof, and from the shore it is the
  // thing that turns a long open boat into a boat with a saloon on it.
  //
  // The posts stand hard against the bulwark rather than inboard, so the whole
  // 0.55 m gangway between the benches stays clear. The canvas is a solid
  // panel and not cloth, for the same reason the ensign is: at the distance
  // this is looked at, a slack surface and a flat one differ by nothing and
  // one of them costs a simulation.
  {
    const yS = 0.72, yT = 0.72 + 2.14;      // the cockpit sole and the canvas
    const XS = [-6.95, -1.62];
    for (const x of XS) {
      const [, w] = sheerAt(x);
      for (const sg of [1, -1]) {
        b.box(x, (yS + yT) * 0.5, sg * (w - 0.16), 0.10, yT - yS, 0.10, TRIM);
      }
    }
    const [, wA] = sheerAt(XS[0]), [, wF] = sheerAt(XS[1]);
    // 0.86 of the sheer and not right out to it. An awning that reaches the
    // bulwark is a roof, and from above — which is the one view where this
    // thing is the whole boat — a roof over the full beam hides the deck it is
    // shading and she goes back to being a box.
    const wm = (Math.max(wA, wF) - 0.10) * 0.86;
    // The canvas, with a shallow fall aft so it is not a table top, and a
    // valance round the edge which is the only part of it anybody sees from
    // the deck under it.
    // Cream and not white. At 0.88 it came back off the render as a lit
    // rectangle with no shading in it at all — canvas in full Dalmatian sun is
    // bright, but a face that clips is a face with no form, and from overhead
    // the awning is most of what you see of her.
    b.box((XS[0] + XS[1]) * 0.5, yT, 0, XS[1] - XS[0] + 0.40, 0.06, wm * 2,
      [0.735, 0.722, 0.688], [0.775, 0.762, 0.726]);
    b.box((XS[0] + XS[1]) * 0.5, yT - 0.09, 0, XS[1] - XS[0] + 0.40, 0.12, 0.05,
      [0.640, 0.628, 0.598]);
  }
  for (let i = 0; i < 3; i++) {
    const col = [[0.78, 0.16, 0.16], [0.94, 0.94, 0.94], [0.10, 0.20, 0.52]][i];
    b.box(4.90, 1.06 + 4.40 - i * 0.18, 0, 0.80, 0.18, 0.02, col);
  }
  return b.geo();
}

/**
 * The pier furniture at the head of the mole.
 *
 * All of it is off two photographs of 23 August 2026 — `1000150377` (portrait,
 * straight out across the water at St Nicholas') and `1000150378` (the same
 * quay, wide) — and it is worth being exact about what they can and cannot
 * settle, because neither carries GPS and there is no landmark in either frame
 * that this game already knows to within a hundred metres.
 *
 * They settle the **fittings**, and there are five, in this order along the
 * coping: a squared **timber rubbing baulk** bedded along the very edge,
 * weathered silver, with the bolt heads showing; a fat **cast-iron mushroom
 * bollard**, rusted through its paint, half a metre across and knee high; a
 * **stainless bitt** on a bolted base plate with a bar through its head and
 * three turns of white rope round it; a length of that rope flaked on the
 * concrete beside it; and a grey **cylindrical rubber fender** hung over the
 * edge on a lanyard so that only its top shows.
 *
 * They do not settle **where**. So the berth is a *placement*, and the argument
 * for it is that the mole is the only structure at Jadrija standing over open
 * water — 42 m out, 11 m across, 0.72 m of freeboard, stone armour at the head
 * — and no aerial of this shore shows another. If the boat comes somewhere
 * else, one constant moves it.
 *
 * This also overturns something the model says out loud. 43-jadrija.js at the
 * mole reads *"no boat comes: there is no bollard, no fender and no moored hull
 * anywhere in thirty-nine photographs"*, which was true of the survey it was
 * written against and is not true of this one. The bollards are photographed.
 *
 * Built in the mole's own frame — **+x out along it from the root, +z athwart
 * it** — and dropped on the world with one transform, which is the only way to
 * keep a fitting square to a quay that is not square to anything. `M.side` is
 * ±1 for which hand the berth is on, applied to the coordinates rather than as
 * a negative `scale.z`: mirroring a mesh reverses its winding, and a
 * back-face-culled bollard is a bollard-shaped hole.
 */
function moleFittings(M) {
  const b = propBuilder();
  const PATCH = [0.700, 0.686, 0.646];
  const TIMBER = [0.560, 0.540, 0.498];
  const RUST = [0.396, 0.208, 0.130];
  const STEEL = [0.760, 0.766, 0.772];
  const ROPE = [0.870, 0.850, 0.800];
  const RUBBER = [0.330, 0.336, 0.342];
  const TOP = M.top, W = M.w, SD = M.side || 1;
  const V = (d) => d * SD;

  // The rubbing baulk: 0.24 x 0.20 squared timber lying on the coping with its
  // outer face flush, so it stands 0.14 m proud of the deck. In lengths,
  // because a nineteen-metre baulk is not a thing and the joints show.
  for (let u = M.out - 19; u < M.out - 1.4; u += 2.4) {
    const l = Math.min(2.35, (M.out - 1.4) - u);
    b.box(u + l / 2, TOP + 0.07, V(W - 0.10), l, 0.20, 0.24, TIMBER, TIMBER);
    b.box(u + l / 2, TOP + 0.18, V(W - 0.10), 0.05, 0.03, 0.05, RUST, RUST);
  }
  // The cast-iron mushroom, 6.4 m in from the head: a stub, a swelling and a
  // cap. Three boxes is enough at the size it is — the whole thing is 0.52 m
  // across and you are never further from it than the boat is.
  {
    const u = M.out - 6.4, v = V(W - 0.62);
    b.box(u, TOP + 0.10, v, 0.30, 0.20, 0.30, RUST, RUST);
    b.box(u, TOP + 0.26, v, 0.44, 0.14, 0.44, RUST, RUST);
    b.box(u, TOP + 0.37, v, 0.52, 0.10, 0.52, RUST, RUST);
  }
  // The stainless bitt, 12.8 m in, on its plate, with the bar through the head,
  // three turns of rope on it and the tail flaked out on the slab.
  {
    const u = M.out - 12.8, v = V(W - 0.66);
    b.box(u, TOP + 0.004, v, 0.92, 0.01, 0.92, PATCH, PATCH);
    b.box(u, TOP + 0.02, v, 0.46, 0.03, 0.46, STEEL, STEEL);
    b.box(u, TOP + 0.23, v, 0.26, 0.42, 0.26, STEEL, STEEL);
    b.box(u, TOP + 0.41, v, 0.52, 0.06, 0.06, STEEL, STEEL);
    for (let i = 0; i < 3; i++) b.box(u, TOP + 0.14 + i * 0.05, v, 0.32, 0.04, 0.32, ROPE, ROPE);
    for (let i = 0; i < 5; i++) {
      const a = 0.9 + i * 0.75;
      b.box(u - 0.4 - i * 0.22, TOP + 0.025, v - V(0.30 + Math.sin(a) * 0.22),
        0.55, 0.04, 0.05, ROPE, ROPE);
    }
  }
  // The fender: a 0.9 m grey cylinder over the edge on a lanyard, top just
  // showing above the timber.
  {
    const u = M.out - 9.6, v = V(W + 0.08);
    b.box(u, TOP - 0.34, v, 0.30, 0.90, 0.30, RUBBER, RUBBER);
    b.box(u, TOP + 0.06, v, 0.04, 0.34, 0.04, ROPE, ROPE);
  }
  return b.geo();
}

/**
 * The Brod's frame, in world metres, derived once from `BROD.quay`.
 *
 * `+x` runs **out along the pier** from the shore root to the head — which is
 * the same frame `moleFittings` was written in, and the reason it drops on to
 * this pier unchanged. `+z` is athwart, and `side` picks the hand she lies on:
 * −1 is the north-east face, open water and the channel, with the marina of
 * small craft on the south-west face where `1000150378` shows it.
 *
 * Worth checking rather than assuming: three.js maps local +X to
 * `(cos θ, −sin θ)` and local +Z to `(sin θ, cos θ)`, so with
 * `θ = yawOfX(ax, az)` local +z lands on `(−az, ax)`. Take the quarter turn the
 * other way and every fitting ends up on the wrong face of the pier.
 */
function brodAnchor() {
  const Q = BROD.quay;
  const b = Q.face * Math.PI / 180;
  const ax = Math.sin(b), az = -Math.cos(b);     // out along the pier, from a bearing
  const tx = -az, tz = ax;                       // local +z, athwart
  const w = Q.wide * 0.5;
  const rx = Q.root[0], rz = Q.root[1];
  return {
    root: [rx, rz], along: [ax, az], athw: [tx, tz],
    w, out: Q.len, top: Q.top, apron: Q.apron, side: 1,
    head: [rx + ax * Q.len, rz + az * Q.len],
    toW: (u, v) => [rx + ax * u + tx * v, rz + az * u + tz * v],
    /** World point -> (u, v) in the pier's frame. A rigid frame, so this is exact. */
    local: (wx, wz) => {
      const dx = wx - rx, dz = wz - rz;
      return [dx * ax + dz * az, dx * tx + dz * tz];
    },
  };
}

/**
 * The pier itself: thirty-four metres of masonry off the north-east shore of
 * the spit, pointing at St Nicholas'.
 *
 * The deck, a battered skirt round all four sides, a coping course standing
 * proud of it, and a rubble ramp off the root. Nothing else — the fittings are
 * `moleFittings`, which was written off the photographs *of this pier* and has
 * only ever been in the wrong place.
 *
 * The skirt is a batter and not a wall, per rule 7: at 1.8 km from the origin a
 * vertical slab of masonry reads as cardboard, and what makes a pier look like
 * a pier from the deck of a boat is that its base is wider than its top. 0.30 m
 * over 2.5 m of height, which is what shows under the rubbing baulk.
 *
 * The ramp's landward edge is sampled off the real DEM rather than assumed
 * flat. It is nearly flat here — the shelf is 0.2 m for forty metres — but
 * "nearly" is the kind of thing that puts one end of a ramp in a trench, and
 * asking costs eight lookups once.
 */
function brodQuay(M) {
  const b = propBuilder();
  // Taken off the bathing mole rather than invented: `CONC[2]` is the deck of
  // the one other structure in this game that stands over open water, and
  // `STONE` is its wall. The first cut of this was a neutral pale grey around
  // 0.70 and it rendered as white paper — a limestone quay is a *warm* half
  // value, and at this scene's ambient anything above about 0.55 stops having
  // a surface at all. Same finding as the timber, from the other end.
  const DECK = [0.507, 0.451, 0.383];
  const JOINT = [0.442, 0.392, 0.332];
  const COPE = [0.545, 0.487, 0.414];
  const FACE = [0.393, 0.347, 0.292];
  const RUB = [0.470, 0.424, 0.362];
  const TOP = M.top, W = M.w, L = M.out;
  const BASE = -2.10;                  // how far down the skirt is carried
  const BAT = 0.30;                    // how far it stands out at the bottom
  const COPE_H = 0.16, LIP = 0.10;
  const P = (u, v, y) => { const w = M.toW(u, v); return [w[0], y, w[1]]; };

  // All four sides, walked as a loop of corners, so the ends meet the flanks in
  // a mitre instead of in a seam you can see from the boat and so the four
  // cannot drift apart. COPE_H is the shadow line under the coping: it is the
  // thing that says "pier" at two hundred metres and at two, which is why the
  // coping is its own course and not just the top of the wall.
  const rim = [[0, -W], [0, W], [L, W], [L, -W], [0, -W]];
  for (let i = 0; i < rim.length - 1; i++) {
    const [u0, v0] = rim[i], [u1, v1] = rim[i + 1];
    // Outward from this side, so the batter leans the right way on each face
    // without anything having to know which face it is on.
    const ex = u1 - u0, ev = v1 - v0;
    const el = Math.hypot(ex, ev) || 1;
    const ou = ev / el, ov = -ex / el;
    const O = (u, v, d, y) => P(u + ou * d, v + ov * d, y);
    b.quad(O(u0, v0, BAT, BASE), O(u1, v1, BAT, BASE),
      O(u1, v1, LIP, TOP - COPE_H), O(u0, v0, LIP, TOP - COPE_H), FACE);
    b.quad(O(u0, v0, LIP, TOP - COPE_H), O(u1, v1, LIP, TOP - COPE_H),
      O(u1, v1, LIP, TOP), O(u0, v0, LIP, TOP), COPE);
    b.quad(O(u0, v0, LIP, TOP), O(u1, v1, LIP, TOP),
      O(u1, v1, 0, TOP), O(u0, v0, 0, TOP), COPE);
  }
  // The deck, laid in slabs across the pier with a joint between each pair.
  //
  // One quad was the first cut and it is the same mistake the kabine row was:
  // a hundred metres of untextured plane reads as a game, and thirty-four
  // metres of it reads as a game you are standing on. The slabs are 2.2 m —
  // what a poured bay is — and each takes a small step of tone off a sine hash
  // of its index, so the deck has a grain running across it and a walker has
  // something to measure their own pace against.
  //
  // Coplanar and *adjacent*, never overlapping: two quads that share an edge
  // are exact at any distance, and two that share a plane are the z-fight rule
  // 5 is about. So the joint is a slab of its own colour, not a line laid over
  // the top of one.
  const BAY = 2.2, JW = 0.06;
  const nBay = Math.max(1, Math.round(L / BAY));
  const hash = (i) => Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  for (let i = 0; i < nBay; i++) {
    const u0 = (i / nBay) * L, u1 = ((i + 1) / nBay) * L;
    const k = (hash(i) - Math.floor(hash(i)) - 0.5) * 0.055;
    const cl = [DECK[0] + k, DECK[1] + k * 0.92, DECK[2] + k * 0.84];
    b.quad(P(u0, -W, TOP), P(u0, W, TOP), P(u1 - JW, W, TOP), P(u1 - JW, -W, TOP), cl);
    if (i < nBay - 1) {
      b.quad(P(u1 - JW, -W, TOP), P(u1 - JW, W, TOP),
        P(u1, W, TOP), P(u1, -W, TOP), JOINT);
    }
  }

  // The causeway off the root, back on to the shore.
  //
  // Thirty metres of it, and that is measured rather than chosen: along this
  // axis the DEM runs 0.01 m at the root and does not get above a foot until
  // 40 m inland — a flat wet limestone shelf, which is what the tip of this
  // spit is. So the pier does not begin at a beach; it begins at a causeway
  // over the shelf, and the causeway is what carries the deck down to ground
  // that is actually ground.
  //
  // The confirmed coordinate — 43.724982, 15.847840, where he stood — is 15 m
  // along it. Walk out from there and you are on the approach to the pier,
  // which is where a photograph of the pier gets taken from.
  //
  // Drawn as a top and two flanks, because a ribbon with no sides reads as a
  // painted line on the water from the deck of the boat. Wound the same way
  // round as the deck above: the first cut of the ramp was wound the other way
  // and rendered as the inside of itself, which at this hour is black.
  const A = M.apron, NSEG = 10;
  const gy = (u, v) => {
    const q = M.toW(u, v);
    return Math.max(groundAt(q[0], q[1]), 0.10);
  };
  // The deck height along it: the pier's top at the root, the shelf at the far
  // end, straight between.
  const ry = (u) => {
    const k = (u + A) / A;
    return gy(-A, 0) * (1 - k) + TOP * k;
  };
  for (let i = 0; i < NSEG; i++) {
    const u0 = -A + (i / NSEG) * A, u1 = -A + ((i + 1) / NSEG) * A;
    const y0 = ry(u0), y1 = ry(u1);
    b.quad(P(u0, -W, y0), P(u0, W, y0), P(u1, W, y1), P(u1, -W, y1), RUB);
    // the two flanks, down to whatever the shelf is doing under them
    b.quad(P(u0, -W, gy(u0, -W) - 0.25), P(u1, -W, gy(u1, -W) - 0.25),
      P(u1, -W, y1), P(u0, -W, y0), FACE);
    b.quad(P(u1, W, gy(u1, W) - 0.25), P(u0, W, gy(u0, W) - 0.25),
      P(u0, W, y0), P(u1, W, y1), FACE);
  }
  return b.geo();
}

/**
 * Standing on the Brod.
 *
 * `localeAt` sends this stretch of shore to open country, whose `walkY` is the
 * DEM and nothing else — so without this the pier is a metre of masonry you
 * walk straight through and stand inside, at the height of the water it is
 * standing in. The resort cannot answer for it either: the Brod is 134 m
 * outside `jadrija.inField` and the shore frame does not reach it. See the note
 * in `local()` in 43-jadrija.js for what happens if you make it try.
 *
 * So: open country, with the pier's own deck laid over it. Eleven members, of
 * which three change — everything else about walking on a headland was already
 * right.
 */
function brodLocale(city) {
  const M = brodAnchor();
  const Q = BROD.quay;
  const mid = M.toW(Q.len * 0.5, 0);
  const base = openLocale(mid[0], mid[1], city);
  const A = M.apron;
  // The deck over the pier, the ramp behind it, the DEM everywhere else. The
  // ramp is what you walk up to get on: a metre of step at the root of a pier
  // is a pier nobody boards from.
  const walkY = (wx, wz) => {
    const [u, v] = M.local(wx, wz);
    if (v > -M.w && v < M.w && u > -A && u < M.out) {
      if (u >= 0) return M.top;
      // The causeway, and the same straight line the geometry draws — sampled
      // at its far end and not underfoot, or the deck you walk on would ripple
      // over a shelf the deck you can see is bridging.
      const k = (u + A) / A;                       // 0 at the shelf, 1 at the root
      const far = M.toW(-A, 0);
      return Math.max(groundAt(far[0], far[1]), 0.10) * (1 - k) + M.top * k;
    }
    return Math.max(groundAt(wx, wz), 0);
  };
  const cx = base.site.x, cz = base.site.z;
  return {
    ...base,
    kind: 'brod',
    walkY,
    toWorld: (t, s) => [cx + t, walkY(cx + t, cz + s), cz + s],
    /**
     * The pier stands in the water for most of its length, so `!isSea` on its
     * own refuses the whole of the thing you came here to walk out along.
     */
    standable: (wx, wz) => {
      const [u, v] = M.local(wx, wz);
      if (v > -M.w && v < M.w && u > -A && u < M.out) return true;
      return !isSea(wx, wz);
    },
  };
}

/** True if a point belongs to the Brod rather than to open country. */
function atBrod(x, z) {
  const Q = BROD.quay;
  const b = Q.face * Math.PI / 180;
  const cx = Q.root[0] + Math.sin(b) * Q.len * 0.5;
  const cz = Q.root[1] - Math.cos(b) * Q.len * 0.5;
  return Math.hypot(x - cx, z - cz) < 110;
}

/**
 * One of them, built the first time somebody stands there.
 *
 * `localeAt` is called on every parachute landing, every debug teleport and
 * every `?gps=` link, and `openLocale` inside it walks the city's footprint
 * list — so handing back a fresh locale each time would rebuild a thousand
 * blockers to answer a question about a quay that never moves.
 */
let brodLoc = null;
function brodLocaleCached(city) {
  if (!brodLoc) brodLoc = brodLocale(city);
  return brodLoc;
}

/**
 * The boat, the berth and the voyage.
 *
 * The same five verbs as the kite, the foil and the swim — `enter`, `leave`,
 * `look`, `update`, `pose` — plus `draw`, and a sixth that none of the other
 * water modes needs: `idle`. She is **scenery when you are not on her**. A boat
 * that only exists once you are aboard is a boat nobody ever decides to board.
 */
function buildBrod(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const mat = solidMaterial(0xffffff, { spec: 0.10, specPower: 30,
    body: 'base *= vVCol;' });

  const hull = new THREE.Mesh(brodProto(), mat);
  const boat = new THREE.Group();
  boat.add(hull);
  group.add(boat);

  let fitting = null;            // the pier furniture, once we know where it goes
  let route = null;              // [[x, z], ...], berth first
  let arc = null;                // cumulative metres along it
  let total = 0;
  let berth = null;              // { x, z, yaw } alongside the mole
  let dock = null;               // { x, y, z } — the mark you stand on to board
  let quay = null;               // { x, z, yaw } alongside at Šibenik

  let active = false;
  let phase = 'moored';          // moored | letgo | run | slow | alongside
  let s = 0, sp = 0, tmr = 0;
  let said = -1;                 // index of the last callout fired

  const you = { x: -4.4, z: 0, yaw: 0, pitch: -0.02, deck: 0.38 };
  const att = { y: 0, roll: 0, pitch: 0, yaw: 0 };

  const tmpV = new THREE.Vector3();
  const tmpW = new THREE.Vector3();
  const qBoat = new THREE.Quaternion();
  const qHead = new THREE.Quaternion();
  const eHead = new THREE.Euler(0, 0, 0, 'YXZ');

  /**
   * Lay the quay, the berth and the route out.
   *
   * Everything is derived from `BROD.quay` rather than written down: the
   * masonry, the fittings, the berth, the boarding mark and the first leg of
   * the voyage all move together when the coordinate moves. That was the rule
   * when the berth was taken from `jadrija.mole` and it is still the rule; only
   * the anchor has changed, from a structure in the resort's shore frame to a
   * pair of degrees in the world.
   *
   * She lies on the **south-east** face: the face the fittings were
   * photographed on and the face St Nicholas' lies square off. There is 3.3 m
   * of water under her there against 1.15 m of draught, and the pier's other
   * side is the one the small craft use.
   */
  function moor() {
    const A = brodAnchor();
    const BERTH_IN = 8.0;
    const hx = A.head[0], hz = A.head[1];
    const rx = A.root[0], rz = A.root[1];
    const ox = A.along[0], oz = A.along[1];
    const sgn = A.side;
    const px = A.athw[0] * sgn, pz = A.athw[1] * sgn;
    const bx = hx - ox * BERTH_IN + px * (A.w + 2.35);
    const bz = hz - oz * BERTH_IN + pz * (A.w + 2.35);
    berth = { x: bx, z: bz, yaw: yawOfX(ox, oz) };
    dock = { x: hx - ox * BERTH_IN + px * (A.w - 1.4),
      z: hz - oz * BERTH_IN + pz * (A.w - 1.4), y: A.top };

    route = [[bx, bz], ...CHANNEL.map((p) => [p[0], p[1]])];
    arc = [0];
    for (let i = 1; i < route.length; i++) {
      arc.push(arc[i - 1] + Math.hypot(route[i][0] - route[i - 1][0],
        route[i][1] - route[i - 1][1]));
    }
    total = arc[arc.length - 1];
    const last = route[route.length - 1], prev = route[route.length - 2];
    quay = { x: last[0], z: last[1],
      yaw: yawOfX(last[0] - prev[0], last[1] - prev[1]) };

    if (!fitting) {
      // The masonry is built straight into world coordinates — `brodQuay` has
      // the frame and does the transform itself, because its ramp samples the
      // DEM and the DEM only answers in world metres.
      const quayMesh = new THREE.Mesh(brodQuay(A), mat);
      quayMesh.updateMatrixWorld();
      scene.add(quayMesh);
      // The fittings are not: they were written in the mole's own frame and
      // they stay in it, which is the whole reason that frame was chosen.
      fitting = new THREE.Mesh(
        moleFittings({ top: A.top, w: A.w, out: A.out, side: sgn }), mat);
      fitting.position.set(rx, 0, rz);
      fitting.rotation.y = yawOfX(ox, oz);
      fitting.updateMatrixWorld();
      scene.add(fitting);

      // ── the small craft on the other face ──
      //
      // The note over `BROD.quay` has said for a fortnight that "the marina of
      // small craft in `1000150378` is the inlet behind the root, running
      // south-west, and is not built", and this is that. Asked for by name:
      // *"the boats sitting parked on the walkway towards the boat to
      // sibenik"*.
      //
      // MED MOORED, bows to the quay and sterns out on a line, which is what
      // `1000150357` has: a row of white cabin motorboats side by side with
      // their bows a metre off the coping and the walkway running past their
      // pulpits. Alongside would have been easier and is not what is there —
      // and the difference matters, because bow-to is why the walk out to the
      // ferry has a wall of boats down one side of it rather than one boat.
      //
      // On the face the ferry does not use. `A.side` picks hers; these take
      // the other, which is also the sheltered one and is where the photograph
      // puts them.
      {
        const raft = new THREE.Group();
        raft.position.set(rx, 0, rz);
        raft.rotation.y = yawOfX(ox, oz);
        const shells = [boatProto(true), boatProto(false)];
        // Bow a metre off the coping: the hull is six metres and its origin is
        // amidships, so the centre sits four metres out from the edge.
        const v = -sgn * (A.w + 4.6);
        // FRACT, not `% 1`. JavaScript's remainder keeps the sign of the
        // dividend, so a sine hash taken with `% 1` lands in (-1, 1) — which
        // put half the row on a scale of 0.54 and picked the open boat for
        // every negative draw. What came out was a line of flat little skiffs
        // with three cabin boats in it, and the fleet in `1000150357` is the
        // other way round.
        const fr = (n) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
        for (let k = 0; k < 12; k++) {
          const h = fr(k * 12.9898);
          const j = fr(k * 78.233 + 2.1);
          const m = new THREE.Mesh(shells[h > 0.28 ? 0 : 1], mat);
          m.position.set(5.5 + k * 2.85 + j * 0.35, 0, v);
          // Her bow points at the quay, which on this face is +z when the
          // ferry is on -z. A child whose local +X must land on the group's
          // ±z takes a quarter turn the matching way round.
          m.rotation.y = -sgn * Math.PI / 2 + (j - 0.5) * 0.12;
          m.scale.setScalar(0.88 + h * 0.34);
          raft.add(m);
        }
        raft.updateMatrixWorld();
        scene.add(raft);
      }
    }
    reset();
    return true;
  }

  /** Put her back alongside at Jadrija with her engine ticking over. */
  function reset() {
    phase = 'moored'; s = 0; sp = 0; tmr = 0; said = -1;
    you.x = -4.4; you.z = 0; you.yaw = 0; you.pitch = -0.02; you.deck = 0.72;
    if (berth) place(berth.x, berth.z, berth.yaw);
  }

  /** Where the route is at `d` metres run: position and heading. */
  function atS(d) {
    const q = clamp(d, 0, total);
    let i = 1;
    while (i < arc.length - 1 && arc[i] < q) i++;
    const u = (q - arc[i - 1]) / ((arc[i] - arc[i - 1]) || 1);
    const a = route[i - 1], c = route[i];
    return { x: a[0] + (c[0] - a[0]) * u, z: a[1] + (c[1] - a[1]) * u,
      yaw: yawOfX(c[0] - a[0], c[1] - a[1]) };
  }

  /**
   * Sit her on the sea.
   *
   * Four samples of the real Gerstner surface — bow, stern, port, starboard —
   * because heel and trim are the sea's business. Twenty tonnes does not take
   * every wavelet, so the differences are scaled by `soften` before the angles
   * come out of them, and the result is *chased* rather than assigned: a hull
   * snapped to the surface every frame jitters at the wave scales this sea has
   * under five metres.
   */
  function place(x, z, yaw, dt) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const fwd = [c, -sn];                          // her local +X, in the world
    const stb = [sn, c];                           // her local +Z
    const a = BROD.loa * 0.5 * BROD.probe, w = BROD.beam * 0.5 * BROD.probe;
    const hb = seaHeightAt(x + fwd[0] * a, z + fwd[1] * a);
    const hs = seaHeightAt(x - fwd[0] * a, z - fwd[1] * a);
    const hq = seaHeightAt(x + stb[0] * w, z + stb[1] * w);
    const hp = seaHeightAt(x - stb[0] * w, z - stb[1] * w);
    const y = (hb + hs + hp + hq) * 0.25;
    const trim = Math.atan2((hb - hs) * BROD.soften, 2 * a);
    const heel = Math.atan2((hq - hp) * BROD.soften, 2 * w);
    if (dt) {
      const r = 1 - Math.exp(-BROD.heelRate * dt);
      att.y += (y - att.y) * r;
      att.pitch += (trim - att.pitch) * r;
      att.roll += (heel - att.roll) * r;
    } else { att.y = y; att.pitch = trim; att.roll = heel; }
    att.yaw = yaw;
    boat.position.set(x, att.y, z);
    boat.rotation.set(0, 0, 0);
    boat.rotateY(yaw);
    // Bow up is a positive turn about her own starboard axis (+Z); starboard up
    // is a negative turn about her own forward axis (+X). Both applied in her
    // frame, after the yaw, which is what `rotateZ`/`rotateX` do.
    boat.rotateZ(att.pitch);
    boat.rotateX(-att.roll);
    boat.updateMatrixWorld();
  }

  /**
   * Is (lx, lz) somewhere you may stand? The sole there, or null.
   *
   * A band in x, a hole in the middle where the deckhouse is, and the hull for
   * the outer limit — see the note over `BROD.decks` for why it is not four
   * rectangles. First match wins, and the bands overlap on purpose.
   */
  function deckAt(lx, lz) {
    const out = brodSheer(lx)[1] - BROD_BULK - BROD.edge;
    const a = Math.abs(lz);
    for (const d of BROD.decks) {
      if (lx > d.x0 && lx < d.x1 && a >= d.hole && a < out) return d.y;
    }
    return null;
  }

  /**
   * The same step, with the hull allowed to push you in.
   *
   * The gunwale is not a wall you stop at, it is a line that closes on you as
   * she narrows — walk forward along a side deck and the boat gets thinner
   * under your feet, so the honest answer to "there is no deck at the z you
   * asked for" is to move you inboard, not to stop you. Without this you walk
   * up the port side and halt at x 3.84 with the bow four metres away and
   * nothing on the screen saying why.
   *
   * The **house is not treated the same way**, and that is the point of the
   * asymmetry: `hole` is a refusal and `out` is a clamp. Sliding you past the
   * inner limit would teleport you sideways out of the middle of the cockpit
   * and on to a side deck the moment you walked at the back of the deckhouse.
   */
  function slideIn(lx, lz) {
    const out = brodSheer(lx)[1] - BROD_BULK - BROD.edge;
    const a = Math.abs(lz);
    for (const d of BROD.decks) {
      if (lx <= d.x0 || lx >= d.x1) continue;
      if (a < d.hole || out <= d.hole + 0.04) continue;
      return { z: Math.sign(lz || 1) * Math.min(a, out - 0.02), y: d.y };
    }
    return null;
  }

  // ── the verbs ─────────────────────────────────────────────────────────────

  /** True when you are near enough on the mole to step aboard. */
  function canBoard(x, z) {
    if (!dock || active || phase !== 'moored') return false;
    return Math.hypot(x - dock.x, z - dock.z) < BROD.board;
  }

  /**
   * Step aboard.
   *
   * You land on the **port side deck**, standing, looking forward, and both
   * halves of that are decided rather than convenient.
   *
   * Port because that is the rail the pier is against, and it is worth being
   * exact about why, because this was wrong and the comment that was here was
   * the reason it stayed wrong. She lies bow-out, offset from the pier's
   * centreline by `w + 2.35` on the side the pier's fittings are on — so the
   * pier is on the hand a boat bow-out has to *its own port*, whatever face of
   * the pier that is. This said "starboard because that is the side the mole
   * is on", asserted rather than derived, and it had you stepping over her and
   * landing on the rail facing open water.
   *
   * Forward because the first cut put you in the middle of the cockpit facing
   * the bow, three metres from the aft wall of the deckhouse, and nine minutes
   * of Dalmatia opened on a shot of a white wall.
   *
   * Which hand the voyage is best watched from is a separate question and you
   * answer it with your legs: the fortress goes by 170 m to **starboard** at s
   * 600, so the first thing to do after letting go is cross her deck.
   */
  function enter() {
    if (!route || active) return false;
    active = true;
    group.visible = true;
    phase = 'letgo';
    s = 0; sp = 0; tmr = 0; said = -1;
    you.x = 1.20; you.z = -1.30; you.yaw = 0; you.pitch = -0.02;
    you.deck = deckAt(you.x, you.z) ?? 1.06;
    return true;
  }

  function leave() { active = false; }

  function look(dx, dy) {
    you.yaw += dx;
    you.pitch = clamp(you.pitch - dy, -1.30, 1.20);
    if (you.yaw > Math.PI) you.yaw -= Math.PI * 2;
    if (you.yaw < -Math.PI) you.yaw += Math.PI * 2;
  }

  /**
   * One frame of the voyage.
   *
   * Returns null, `'call'` when a landmark has just come up, or `'alongside'`
   * the one time she finishes. The phases are a straight line and there is no
   * way back up them: she is a scheduled boat, not a vehicle.
   */
  function update(dt, ctl = {}) {
    if (!active || !route) return null;
    tmr += dt;
    let out = null;

    if (phase === 'letgo') {
      if (tmr > BROD.letGo) { phase = 'run'; tmr = 0; }
    } else if (phase === 'run') {
      sp = Math.min(BROD.cruise, sp + BROD.accel * dt);
      s += sp * dt;
      if (total - s < BROD.slowAt) phase = 'slow';
    } else if (phase === 'slow') {
      // Stop *on* the berth rather than near it. The fastest she may still be
      // going is the speed that brings her to rest exactly at `total` under
      // `brake` — v = sqrt(2 a d) — and she is never allowed above it. The
      // floor under it is what stops the last two metres taking a minute.
      const d = Math.max(0, total - s);
      sp = Math.min(sp, Math.sqrt(2 * BROD.brake * d));
      sp = Math.max(sp, 0.45 * sat(d / 30));
      s += sp * dt;
      if (d < 0.5) { phase = 'alongside'; sp = 0; s = total; out = 'alongside'; }
    }

    const P = atS(s);
    place(P.x, P.z,
      (phase === 'moored' || phase === 'letgo') ? berth.yaw : P.yaw, dt);

    // Walking her deck. Everything is in her frame, so the deck moves under you
    // and you are never integrated in world metres at all — which is the whole
    // reason a passenger is cheap where a driver is not.
    const step = (ctl.sprint ? BROD.run : BROD.walk) * dt;
    const f = clamp(ctl.fwd || 0, -1, 1), r = clamp(ctl.side || 0, -1, 1);
    if (f || r) {
      const c = Math.cos(you.yaw), sn = Math.sin(you.yaw);
      const nx = you.x + (c * f - sn * r) * step;
      const nz = you.z + (sn * f + c * r) * step;
      const dy = deckAt(nx, nz);
      if (dy != null) { you.x = nx; you.z = nz; you.deck = dy; }
      else {
        const sl = slideIn(nx, nz);
        if (sl) { you.x = nx; you.z = sl.z; you.deck = sl.y; }
        else {
          // And then, only if the hull could not take it, slide along whichever
          // axis still lands on a deck — so the side of the house is something
          // you brush past rather than stop dead against. Same rule the walk
          // model uses ashore.
          const ax = deckAt(nx, you.z);
          if (ax != null) { you.x = nx; you.deck = ax; }
          const az = deckAt(you.x, nz);
          if (az != null) { you.z = nz; you.deck = az; }
        }
      }
    }

    for (let i = 0; i < BROD.calls.length; i++) {
      if (i > said && s >= BROD.calls[i].at) { said = i; out = out || 'call'; }
    }
    return out;
  }

  /**
   * Put the camera where your head is.
   *
   * The head is composed **on top of her attitude** rather than beside it —
   * `qBoat * qHead` — so her heel rolls the horizon under you and her trim
   * lifts it. That roll is the only thing on the screen that says you are on
   * water rather than on a moving platform, and adding it afterwards as a
   * `rotateZ` gets it wrong the moment you are not looking over the bow.
   *
   * `-π/2 - you.yaw` is the quarter turn between a camera, which looks down its
   * own -Z, and a hull, whose forward is +X. See `yawOfX`.
   */
  function pose(camera) {
    if (!active) return;
    tmpV.set(you.x, you.deck + BROD.eye, you.z);
    boat.localToWorld(tmpV);
    camera.position.copy(tmpV);
    boat.getWorldQuaternion(qBoat);
    eHead.set(you.pitch, -Math.PI / 2 - you.yaw, 0, 'YXZ');
    qHead.setFromEuler(eHead);
    camera.quaternion.copy(qBoat).multiply(qHead);
  }

  /**
   * Scenery, when you are not aboard.
   *
   * She is drawn whenever the camera is within a kilometre of the berth and the
   * mode is not running, which is what makes the mole somewhere you walk out to
   * *for a reason*. She does not move: she lies there rolling on the chop until
   * somebody gets on her.
   */
  function idle(dt, cam) {
    if (active || !berth) return;
    const d = Math.hypot(cam.x - berth.x, cam.z - berth.z);
    group.visible = d < 1000;
    if (group.visible) place(berth.x, berth.z, berth.yaw, dt);
  }

  /** Nothing on her animates yet. See the header for what is missing. */
  function draw() {}

  return {
    you,
    get active() { return active; },
    get phase() { return phase; },
    get run() { return s; },
    get total() { return total; },
    get speed() { return sp; },
    get call() { return said >= 0 ? BROD.calls[said] : null; },
    get dock() { return dock; },
    get berth() { return berth; },
    get quay() { return quay; },
    moor, reset, enter, leave, look, update, pose, draw, idle, canBoard,
    /**
     * Put her `m` metres along the passage. Nothing in the game calls this: it
     * is for a screenshot and for a test, because nine and a half minutes is
     * not a thing a headless page can wait out.
     */
    seek: (m) => {
      if (!route) return null;
      s = clamp(m, 0, total);
      sp = BROD.cruise;
      phase = total - s < BROD.slowAt ? 'slow' : 'run';
      said = -1;
      for (let i = 0; i < BROD.calls.length; i++) if (s >= BROD.calls[i].at) said = i;
      const P = atS(s);
      place(P.x, P.z, P.yaw);
      return s;
    },
    /** Where you are standing, in world metres — for the handover to the water. */
    where: () => {
      tmpW.set(you.x, you.deck, you.z);
      boat.localToWorld(tmpW);
      return [tmpW.x, tmpW.y, tmpW.z];
    },
    /** And which way you are looking, as the compass yaw everything ashore uses. */
    heading: () => {
      tmpW.set(Math.cos(you.yaw), 0, Math.sin(you.yaw));
      boat.localToWorld(tmpW).sub(boat.position);
      return Math.atan2(tmpW.x, -tmpW.z);
    },
    stats: () => ({
      on: active ? 1 : 0,
      phase,
      run: +s.toFixed(0),
      total: +total.toFixed(0),
      sp: +sp.toFixed(2),
      at: [+boat.position.x.toFixed(0), +boat.position.z.toFixed(0)],
      heel: +(att.roll * 57.3).toFixed(1),
      trim: +(att.pitch * 57.3).toFixed(1),
      you: [+you.x.toFixed(2), +you.z.toFixed(2)],
      said,
      dock: dock ? [+dock.x.toFixed(0), +dock.z.toFixed(0)] : null,
      tris: hull.geometry.attributes.position.count / 3
        + (fitting ? fitting.geometry.attributes.position.count / 3 : 0),
    }),
  };
}
